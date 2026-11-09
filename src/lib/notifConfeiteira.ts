import { supabase } from "@/lib/supabase";
import { carregarNotificacoes, criarNotificacaoPessoal, type Notif } from "@/lib/notificacoesUsuario";
import { nomeApresentavel } from "@/lib/nomeApresentavel";
import { STATUS_AINDA_NAO_PRONTO, hojeISO } from "@/lib/pedidoStatus";

/**
 * (09/11) Notificações da confeiteira (aba "Notificações" do sino): só o que é dela — pedido novo, Pix pra conferir,
 * orçamento, entregas de hoje, pedido atrasado, conta vencendo, PRO e resposta da equipe.
 * Os avisos de cadastro ("1 produto sem ficha técnica") ficam no "Seus próximos passos" do Início, não aqui.
 * Os textos são montados aqui, curtos (cabem numa linha): o nome do cliente vai só o primeiro nome.
 */
export type TipoNotif = "pedido" | "pix" | "orcamento" | "agenda" | "atrasado" | "conta" | "pro" | "equipe" | "teste";
export type NotifVista = {
  id: string; tipo: TipoNotif; titulo: string; detalhe: string; link: string; criada: string; lida: boolean;
  foto?: string | null; dia?: number; mes?: string;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const primeiro = (n?: string | null) => String(n || "").trim().split(/\s+/)[0] || "";
const juntar = (...p: (string | false | null | undefined)[]) => p.filter(Boolean).join(" · ");
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "sáb 14:00", "hoje 10:00", "amanhã" */
function quando(data?: string | null, hora?: string | null): string {
  if (!data) return "";
  const d = data.slice(0, 10), h = (hora || "").slice(0, 5);
  const hoje = hojeISO();
  const amanha = (() => { const x = new Date(); x.setDate(x.getDate() + 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; })();
  const dia = d === hoje ? "hoje" : d === amanha ? "amanhã" : DIAS[new Date(d + "T12:00:00").getDay()];
  return h ? `${dia} ${h}` : dia;
}

function tipoDe(n: Notif): TipoNotif | null {
  const ch = n.chave || "";
  if (/^conta_/.test(ch)) return "conta";
  switch (n.tipo) {
    case "pedido": return "pedido";
    case "pix": return "pix";
    case "orcamento": return "orcamento";
    case "agenda": return "agenda";
    case "atrasado": return "atrasado";
    case "pro": case "pro_vencendo": case "pro_atrasado": return "pro";
    case "sugestao": return "equipe";
    case "teste": return "teste";
    default: return null; // aviso de cadastro, notícia, conquista: fora
  }
}
const idDoLink = (link?: string | null, base = "pedidos") => new RegExp(`/${base}/([0-9a-f-]{36})`).exec(link || "")?.[1] || null;

type PedidoInfo = { id: string; numero: number | null; status: string | null; cliente_nome: string | null; data_entrega: string | null; horario_entrega: string | null; valor_total: number | null; pix_informado_valor: number | null; clientes: { nome: string | null } | null; pedido_itens: { nome_produto: string | null; imagem_url: string | null; quantidade: number | null; valor_unitario: number | null; produtos: { imagem_url: string | null } | null }[] | null };
type OrcInfo = { id: string; numero: number | null; cliente_nome: string | null };

/** As notificações da confeiteira, já com o texto curto e a imagem de cada tipo */
export async function carregarNotifConfeiteira(): Promise<NotifVista[]> {
  const todas = (await carregarNotificacoes(150)).filter(n => !!n.user_id && tipoDe(n));
  const idsPed = [...new Set(todas.filter(n => ["pedido", "pix", "atrasado"].includes(tipoDe(n)!)).map(n => idDoLink(n.link)).filter(Boolean) as string[])];
  const idsOrc = [...new Set(todas.filter(n => tipoDe(n) === "orcamento").map(n => idDoLink(n.link, "orcamentos")).filter(Boolean) as string[])];
  const [ped, orc] = await Promise.all([
    idsPed.length ? supabase.from("pedidos").select("id, numero, status, cliente_nome, data_entrega, horario_entrega, valor_total, pix_informado_valor, clientes(nome), pedido_itens(nome_produto, imagem_url, quantidade, valor_unitario, produtos(imagem_url))").in("id", idsPed) : Promise.resolve({ data: [] }),
    idsOrc.length ? supabase.from("orcamentos").select("id, numero, cliente_nome").in("id", idsOrc) : Promise.resolve({ data: [] }),
  ]);
  const P = new Map(((ped.data || []) as unknown as PedidoInfo[]).map(p => [p.id, p]));
  const O = new Map(((orc.data || []) as OrcInfo[]).map(o => [o.id, o]));
  const pedOk = !("error" in ped && ped.error);

  // (09/11) não mostra aviso de pedido que já foi apagado, nem "atrasado" de pedido que já ficou pronto/entregue/cancelado
  // (só quando a busca dos pedidos deu certo: sem internet, mostra tudo como estava)
  const vale = (n: Notif) => {
    const t = tipoDe(n)!;
    if (!pedOk || !["pedido", "pix", "atrasado"].includes(t)) return true;
    const id = idDoLink(n.link); if (!id) return true;
    const p = P.get(id); if (!p) return false;
    return t !== "atrasado" || STATUS_AINDA_NAO_PRONTO.includes(String(p.status || "agendado"));
  };

  return todas.filter(vale).map((n): NotifVista => {
    const tipo = tipoDe(n)!;
    const base = { id: n.id, tipo, link: n.link || "", criada: n.created_at, lida: n.lida };
    const p = P.get(idDoLink(n.link) || "");
    // (09/11) com mais de um produto: a foto do item mais caro (preço × quantidade) que tenha foto
    const fotoDe = (i: NonNullable<PedidoInfo["pedido_itens"]>[number]) => i.imagem_url || i.produtos?.imagem_url || null;
    const foto = [...(p?.pedido_itens || [])].filter(fotoDe)
      .sort((a, b) => (Number(b.valor_unitario) || 0) * (Number(b.quantidade) || 1) - (Number(a.valor_unitario) || 0) * (Number(a.quantidade) || 1))
      .map(fotoDe)[0] || null;
    const cli = primeiro(p?.clientes?.nome || p?.cliente_nome); // sem cadastro: o nome que ela escreveu no pedido
    const num = p?.numero ? `#${p.numero}` : "";
    switch (tipo) {
      case "pedido":
        // (09/11) a entrega no título (é o que decide se dá pra fazer); embaixo valor · número · cliente, igual ao Pix
        return { ...base, titulo: juntar("Novo pedido", p && quando(p.data_entrega, p.horario_entrega)), foto,
          detalhe: p ? juntar(Number(p.valor_total) > 0 && brl(Number(p.valor_total)), num, cli) : (n.mensagem || "") };
      case "pix": {
        const v = Number(p?.pix_informado_valor) || 0;
        return { ...base, titulo: "Pix pra conferir", detalhe: p ? juntar(v > 0 && brl(v), num, cli) : "Confira e confirme o pagamento" };
      }
      case "atrasado":
        return { ...base, titulo: num ? `Pedido ${num} atrasado` : "Pedido atrasado", foto, detalhe: p ? juntar(cli, `era ${quando(p.data_entrega, p.horario_entrega)}`) : (n.mensagem || "") };
      case "orcamento": {
        const o = O.get(idDoLink(n.link, "orcamentos") || "");
        const t = /aprovado/i.test(n.titulo) ? "Orçamento aprovado" : /recusado/i.test(n.titulo) ? "Orçamento recusado" : "Novo orçamento pra fazer";
        return { ...base, titulo: t, detalhe: juntar(o?.numero ? `#${o.numero}` : "", primeiro(o?.cliente_nome) || primeiro(n.mensagem)) };
      }
      case "agenda": {
        const d = new Date(n.created_at);
        return { ...base, titulo: n.titulo, detalhe: n.mensagem || "", dia: d.getDate(), mes: MESES[d.getMonth()] };
      }
      case "conta": {
        // título gravado: "Vence amanhã: Aluguel" / "Vence hoje: …" / "Atrasada: …"
        const [sit, ...resto] = String(n.titulo || "").split(":");
        const t = /atrasada/i.test(sit) ? "Conta atrasada" : /hoje/i.test(sit) ? "Conta vence hoje" : "Conta vence amanhã";
        return { ...base, titulo: t, detalhe: resto.join(":").trim() || "Conta a pagar" };
      }
      case "pro": {
        const t = n.tipo === "pro_atrasado" ? "PRO em atraso" : n.tipo === "pro_vencendo" ? "Seu PRO vence em breve" : "Seu PRO está ativo";
        const d = n.tipo === "pro" ? "Todos os recursos liberados" : "Renove para manter tudo";
        return { ...base, titulo: t, detalhe: d };
      }
      case "equipe":
        return { ...base, titulo: "Equipe Doonly respondeu", detalhe: "Sobre a sua ideia" };
      case "teste":
        return { ...base, titulo: n.titulo || "Deu certo!", detalhe: n.mensagem || "Os avisos estão chegando aqui" };
    }
  });
}

/** Quantas notificações da confeiteira ainda não foram lidas (o sino). Nunca lança. */
export async function contarNotifConfeiteira(): Promise<number> {
  // (09/11) conta pela mesma lista da tela (o número do sino bate com o que aparece)
  try { return (await carregarNotifConfeiteira()).filter(n => !n.lida).length; } catch { return 0; }
}

/**
 * Os avisos do dia que o app mesmo cria (uma vez por dia/pedido, a chave não repete):
 * "3 entregas hoje" e "Pedido #125 atrasado". Roda ao abrir o app.
 */
export async function gerarAvisosDoDia(uid: string): Promise<void> {
  try {
    const hoje = hojeISO();
    const desde = (() => { const x = new Date(); x.setDate(x.getDate() - 7); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; })();
    const { data } = await supabase.from("pedidos").select("id, numero, data_entrega, horario_entrega, status, clientes(nome)")
      .eq("user_id", uid).gte("data_entrega", desde).lte("data_entrega", hoje + "T23:59:59");
    const lista = (data || []) as unknown as { id: string; numero: number | null; data_entrega: string; horario_entrega: string | null; status: string | null; clientes: { nome: string | null } | null }[];
    const abertos = lista.filter(p => STATUS_AINDA_NAO_PRONTO.includes(String(p.status || "agendado")) || ["finalizado", "aguardando_retirada", "em_entrega"].includes(String(p.status)));
    const deHoje = abertos.filter(p => p.data_entrega.slice(0, 10) === hoje).sort((a, b) => String(a.horario_entrega || "99").localeCompare(String(b.horario_entrega || "99")));
    if (deHoje.length) {
      const pri = deHoje[0];
      await criarNotificacaoPessoal({ tipo: "agenda", titulo: deHoje.length === 1 ? "1 entrega hoje" : `${deHoje.length} entregas hoje`,
        mensagem: juntar(pri.horario_entrega ? `A primeira às ${pri.horario_entrega.slice(0, 5)}` : "Veja na agenda", primeiro(pri.clientes?.nome)), link: "/agenda", chave: `entregas-${hoje}` });
    }
    for (const p of lista.filter(p => p.data_entrega.slice(0, 10) < hoje && STATUS_AINDA_NAO_PRONTO.includes(String(p.status || "agendado")))) {
      await criarNotificacaoPessoal({ tipo: "atrasado", titulo: "Pedido atrasado", mensagem: primeiro(p.clientes?.nome), link: `/pedidos/${p.id}/editar`, chave: `atrasado-${p.id}` });
    }
  } catch { /* sem internet: tenta na próxima abertura */ }
}

/** (09/11) O "aviso de teste" (ligar as notificações / botão Testar) também entra na lista do sino, e o sino balança */
export async function avisoDeTesteNaLista(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id; if (!uid) return;
    const { data } = await supabase.from("profiles").select("nome").eq("id", uid).maybeSingle();
    const nome = nomeApresentavel((data as { nome?: string } | null)?.nome);
    // o nome vai no título ("Deu certo, Bruno!"): na segunda linha não cabia junto com o texto
    await criarNotificacaoPessoal({ tipo: "teste", titulo: nome ? `Deu certo, ${nome}!` : "Deu certo!", mensagem: "Os avisos estão chegando aqui",
      link: "/configuracoes/notificacoes", chave: `teste-${Date.now()}` });
  } catch { /* sem internet: fica só o aviso no aparelho */ }
}

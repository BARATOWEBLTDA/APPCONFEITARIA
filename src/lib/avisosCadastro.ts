import { supabase } from "@/lib/supabase";
import { criarNotificacaoPessoal } from "@/lib/notificacoesUsuario";

/**
 * (13/10) O que falta cadastrar pro app mostrar os números certos (lucro, caixa, contas).
 * Cada item vira uma notificação (uma vez só, pela chave) e uma linha no cartão "Falta pouco" da Início.
 * Leitura que falha não vira aviso: o item só aparece quando dá pra ter certeza que falta.
 */
export type AvisoCadastro = {
  chave: string; titulo: string; texto: string; link: string; estado?: { abrir: string }; icone: "custos" | "maquininha" | "ficha" | "caixa" | "conta" | "entrega" | "descricao" | "banner";
  /** (16/10) dica do cardápio: aparece no cartão, mas não vira notificação */
  semNotificar?: boolean;
  /** (15/10) pro cartão "Pra fazer": urgência e a linha curta (cabe numa linha no celular) */
  nivel: "urgente" | "atencao" | "normal"; curto: { t: string; s: string };
};

const diaISO = (somar = 0) => { const d = new Date(); d.setDate(d.getDate() + somar); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export async function lerAvisosCadastro(uid: string): Promise<AvisoCadastro[]> {
  const [fixos, variaveis, perfil, produtos, contas] = await Promise.all([
    supabase.from("custos_fixos").select("id").eq("user_id", uid).limit(1),
    supabase.from("custos_variaveis").select("*").eq("user_id", uid),
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.from("produtos").select("id, descricao, produto_insumos(id)").eq("user_id", uid).eq("disponivel", true),
    // (15/10) também as que vencem hoje e as atrasadas (antes só as de amanhã)
    supabase.from("contas_pagar").select("id, descricao, vencimento").eq("user_id", uid).eq("status", "pendente").lte("vencimento", diaISO(1)).order("vencimento"),
  ]);
  const l: AvisoCadastro[] = [];
  // contas primeiro (são as mais urgentes): atrasada, hoje, amanhã. A chave muda com a situação, pra avisar de novo quando vira "hoje"
  if (!contas.error) for (const c of (contas.data as any[]) || []) {
    const v = String(c.vencimento || "").slice(0, 10);
    const sit = v < diaISO(0) ? "atrasada" : v === diaISO(0) ? "hoje" : "amanha";
    l.push({ chave: sit === "amanha" ? `conta_vence_${c.id}` : `conta_${sit}_${c.id}`, icone: "conta",
      titulo: `${sit === "atrasada" ? "Atrasada" : sit === "hoje" ? "Vence hoje" : "Vence amanhã"}: ${c.descricao}`,
      texto: "Pague ou marque como paga em A pagar pro seu caixa ficar sempre certo.", link: "/financeiro/a-pagar", estado: { abrir: `pagar:${c.id}` },
      nivel: sit === "amanha" ? "atencao" : "urgente",
      curto: { t: sit === "atrasada" ? `${c.descricao} atrasado` : String(c.descricao), s: sit === "atrasada" ? "Já venceu" : sit === "hoje" ? "Vence hoje" : "Vence amanhã" } });
  }
  // (16/10) custos fixos e taxa da maquininha ficam na mesma tela: viram um aviso só ("Custos e taxas")
  const faltaFixos = !fixos.error && (fixos.data || []).length === 0;
  const vendeCartao = !perfil.error && ((perfil.data as any)?.formas_pagamento || []).some((f: string) => f === "credito" || f === "debito");
  const temTaxa = ((variaveis.data as any[]) || []).some(v => v.forma || /maquin/i.test(String(v.nome || "")));
  const faltaTaxa = vendeCartao && !variaveis.error && !temTaxa;
  if (faltaFixos || faltaTaxa) {
    const s = faltaFixos && faltaTaxa ? "Aluguel, luz e a maquininha" : faltaFixos ? "Aluguel, luz, internet" : "Taxa da maquininha";
    l.push({ chave: "falta_custos", icone: "custos", titulo: faltaFixos && faltaTaxa ? "Cadastre seus custos e a taxa da maquininha" : faltaFixos ? "Cadastre seus custos fixos" : "Cadastre a taxa da maquininha",
      texto: faltaFixos && faltaTaxa ? "Aluguel, luz e a taxa da maquininha entram no custo de cada produto." : faltaFixos ? "Aluguel, luz e internet entram no custo. Sem eles, o lucro parece maior." : "A taxa muda no débito e no crédito. Cadastre pra ver o lucro de cada venda.", link: "/custos", estado: { abrir: faltaFixos ? "fixo" : "maquininha" }, nivel: "normal",
      curto: { t: faltaFixos ? "Custos e taxas" : "Taxa da maquininha", s } });
  }
  const semFicha = !produtos.error ? ((produtos.data as any[]) || []).filter(p => !(p.produto_insumos || []).length).length : 0;
  if (semFicha > 0)
    l.push({ chave: "falta_ficha_tecnica", icone: "ficha", titulo: semFicha === 1 ? "1 produto sem ficha técnica" : `${semFicha} produtos sem ficha técnica`, texto: "Monte a receita de cada produto pra saber o custo e o lucro de verdade.", link: "/ficha-tecnica", estado: { abrir: "sem-ficha" }, nivel: "normal", curto: { t: `${semFicha} sem ficha técnica`, s: "Pro app saber o lucro" } });
  if (!perfil.error && perfil.data && (perfil.data as any).caixa_inicio_em == null)
    l.push({ chave: "falta_saldo_caixa", icone: "caixa", titulo: "Informe o saldo do caixa", texto: "Diga quanto tem hoje na gaveta e no banco pro Financeiro bater certinho.", link: "/financeiro", estado: { abrir: "saldo" }, nivel: "normal", curto: { t: "Saldo do caixa", s: "Quanto tem hoje" } });
  // (16/10) o "Pra vender mais" do cardápio veio pra cá: taxa de entrega, descrição dos produtos e banner
  const pf: any = !perfil.error ? perfil.data : null;
  if (pf) {
    const fe: string[] = Array.isArray(pf.formas_entrega) ? pf.formas_entrega : [];
    const semTaxa = fe.includes("entrega_propria") && !(Number(pf.valor_entrega_propria) > 0) && !(Array.isArray(pf.entrega_por_bairro) && pf.entrega_por_bairro.length);
    if (semTaxa) l.push({ chave: "falta_taxa_entrega", icone: "entrega", titulo: "Defina a taxa de entrega", texto: "Sem a taxa, o cardápio mostra entrega grátis e o frete sai do seu bolso.",
      link: "/checkout-config", nivel: "atencao", curto: { t: "Taxa de entrega", s: "Sem ela, a entrega sai grátis" } });
  }
  const semDesc = !produtos.error ? ((produtos.data as any[]) || []).filter(p => !String(p.descricao || "").trim()).length : 0;
  if (semDesc > 0) l.push({ chave: "falta_descricao", icone: "descricao", semNotificar: true, titulo: semDesc === 1 ? "1 produto sem descrição" : `${semDesc} produtos sem descrição`,
    texto: "Conte o sabor, o tamanho e quantas pessoas serve. Ajuda a escolher.", link: "/produtos", nivel: "normal", curto: { t: `${semDesc} sem descrição`, s: "Sabor, tamanho e quantos serve" } });
  if (pf && !(pf.banner_url || pf.banner1_url || pf.banner_topo_url)) l.push({ chave: "falta_banner", icone: "banner", semNotificar: true, titulo: "Crie um banner de promoção",
    texto: "Anuncie a promoção da semana no topo do cardápio, antes dos produtos.", link: "/cardapio-design", nivel: "normal", curto: { t: "Banner de promoção", s: "No topo do cardápio" } });
  return l;
}

/** Manda cada aviso pras notificações (uma vez só por chave) */
export function notificarAvisosCadastro(avisos: AvisoCadastro[]) {
  // (15/10) velocidade: cada aviso vira notificação no máximo 1 vez por dia neste aparelho
  // (antes conferia no banco, aviso por aviso, toda vez que o Início abria)
  const d = new Date(), hoje = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const k = "doonly_avisos_notificados";
  let feitos: { dia: string; chaves: string[] } = { dia: hoje, chaves: [] };
  try { const v = JSON.parse(localStorage.getItem(k) || "null"); if (v?.dia === hoje && Array.isArray(v.chaves)) feitos = v; } catch {}
  const novos = avisos.filter(a => !a.semNotificar && !feitos.chaves.includes(a.chave));
  if (!novos.length) return;
  for (const a of novos) criarNotificacaoPessoal({ tipo: "aviso", titulo: a.titulo, mensagem: a.texto, link: a.link, chave: a.chave }).catch(() => {});
  try { localStorage.setItem(k, JSON.stringify({ dia: hoje, chaves: [...feitos.chaves, ...novos.map(a => a.chave)] })); } catch {}
}

import { supabase } from "@/lib/supabase";

/**
 * Extrato (Transações, 03/10): recebimentos de pedidos (tabela pagamentos) + lançamentos manuais
 * (tabela financeiro: entradas avulsas, despesas e contas pagas), num intervalo de datas.
 * Nada se apaga: estornar marca estornado_em e o item sai das contas (fica riscado no extrato).
 */
export type MovExtrato = {
  id: string; origem: "pagamento" | "manual"; ref: string; tipo: "entrada" | "saida";
  valor: number; data: string; titulo: string; detalhe: string;
  forma: string | null; categoria: string | null; pedidoId: string | null; estornado: boolean; ordem: string;
};

const FORMA: Record<string, string> = { pix: "Pix", dinheiro: "Dinheiro", credito: "Crédito", debito: "Débito", boleto: "Boleto" };
const TIPO: Record<string, string> = { sinal: "Sinal", parcial: "Parcial", restante: "Restante", total: "Pagamento", pagamento: "Pagamento", migracao: "Pagamento" };
export const nomeForma = (f?: string | null) => (f ? FORMA[f] || f : "");

export async function carregarExtrato(uid: string, ini: string, fim: string): Promise<{ itens: MovExtrato[]; semEstornoManual: boolean }> {
  const [pag, fin1] = await Promise.all([
    supabase.from("pagamentos").select("id, valor, forma, tipo, recebido_em, pedido_id, created_at, estornado_em")
      .eq("user_id", uid).gte("recebido_em", ini).lte("recebido_em", fim),
    supabase.from("financeiro").select("id, tipo, categoria, descricao, valor, data, created_at, estornado_em")
      .eq("user_id", uid).gte("data", ini).lte("data", fim),
  ]);
  // sem a coluna de estorno (SQL não rodado), busca sem ela
  let fin: any = fin1, semEstornoManual = false;
  if (fin1.error) {
    semEstornoManual = true;
    fin = await supabase.from("financeiro").select("id, tipo, categoria, descricao, valor, data").eq("user_id", uid).gte("data", ini).lte("data", fim);
  }
  const pagamentos: any[] = pag.error ? [] : (pag.data as any[]) || [];
  const ids = [...new Set(pagamentos.map(g => g.pedido_id).filter(Boolean))];
  const nomes: Record<string, { numero: any; cliente: string }> = {};
  if (ids.length) {
    // 09/10: o nome vem também do cadastro da cliente (pedido feito só com a cliente escolhida não tinha cliente_nome)
    const r1: any = await supabase.from("pedidos").select("id, numero, cliente_nome, clientes(nome)").in("id", ids);
    const data: any[] = (r1.error ? (await supabase.from("pedidos").select("id, numero, cliente_nome").in("id", ids)).data : r1.data) || [];
    for (const x of data) {
      const cad = Array.isArray(x.clientes) ? x.clientes[0]?.nome : x.clientes?.nome;
      nomes[x.id] = { numero: x.numero, cliente: String(x.cliente_nome || cad || "").trim() };
    }
  }
  const itens: MovExtrato[] = [];
  for (const g of pagamentos) {
    const n = g.pedido_id ? nomes[g.pedido_id] : null;
    itens.push({
      id: "g" + g.id, origem: "pagamento", ref: g.id, tipo: "entrada", valor: Number(g.valor) || 0, data: g.recebido_em,
      titulo: `${TIPO[g.tipo] || "Pagamento"}${n ? ` · Pedido #${n.numero ?? "—"}` : " de pedido"}`,
      detalhe: [n?.cliente, nomeForma(g.forma)].filter(Boolean).join(" · "),
      forma: g.forma || null, categoria: "Pedidos", pedidoId: g.pedido_id || null, estornado: !!g.estornado_em, ordem: `${g.recebido_em} ${g.created_at || ""}`,
    });
  }
  for (const l of ((fin.data as any[]) || [])) {
    const entrada = l.tipo === "entrada";
    itens.push({
      id: "f" + l.id, origem: "manual", ref: l.id, tipo: entrada ? "entrada" : "saida", valor: Number(l.valor) || 0, data: l.data,
      titulo: l.descricao || l.categoria || (entrada ? "Entrada" : "Despesa"),
      detalhe: l.categoria ? (entrada ? l.categoria : `Despesa · ${l.categoria}`) : (entrada ? "Entrada avulsa" : "Despesa"),
      forma: null, categoria: l.categoria || null, pedidoId: null, estornado: !!l.estornado_em, ordem: `${l.data} ${l.created_at || ""}`,
    });
  }
  itens.sort((a, b) => b.ordem.localeCompare(a.ordem));
  return { itens, semEstornoManual };
}

/** Estorna um item do extrato. Recebimento: o pedido volta a ter saldo. Conta paga: a conta volta pra "A pagar". */
export async function estornar(m: MovExtrato): Promise<{ ok: boolean; erro?: string }> {
  const agora = new Date().toISOString();
  if (m.origem === "pagamento") {
    const { error } = await supabase.from("pagamentos").update({ estornado_em: agora }).eq("id", m.ref);
    return error ? { ok: false, erro: "Não foi possível estornar agora." } : { ok: true };
  }
  const { error } = await supabase.from("financeiro").update({ estornado_em: agora }).eq("id", m.ref);
  if (error) return { ok: false, erro: /estornado_em/i.test(error.message) ? "Pra estornar lançamentos, rode o SQL do estorno no Supabase." : "Não foi possível estornar agora." };
  // se era o pagamento de uma conta, ela volta pra "A pagar"
  await supabase.from("contas_pagar").update({ status: "pendente", pago_em: null, valor_pago: null, forma: null, financeiro_id: null }).eq("financeiro_id", m.ref).then(() => {}, () => {});
  return { ok: true };
}

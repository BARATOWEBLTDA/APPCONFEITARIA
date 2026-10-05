import { supabase } from "@/lib/supabase";
import { valorRecebidoPedido } from "@/lib/financeiroPedido";

/**
 * Financeiro · Passo 7 (03/10) — os números do mês do painel, com UMA regra cada:
 *   Recebido ....... pagamentos com data de recebimento no mês + entradas avulsas (caixa: o que entrou)
 *   Despesas pagas . saídas do financeiro com data no mês, até hoje
 *   Vendido ........ pedidos ENTREGUES no mês (data de entrega), sem cancelados — o valor final
 *   Lucro .......... vendido − custo dos ingredientes (ficha técnica) − despesas pagas do mês,
 *                    SEM as despesas de insumos (o ingrediente já está no custo da ficha; senão contaria 2x)
 * Sem a tabela de pagamentos (SQL do Passo 1 não rodado), o recebido usa a regra antiga (pelo mês da entrega).
 */
export type Semana = { label: string; entradas: number; saidas: number; acumulado: number };
export type MesFinanceiro = {
  recebido: number; recebidoPedidos: number; entradasAvulsas: number; qtdRecebimentos: number;
  despesasPagas: number; despesasInsumos: number;
  vendido: number; qtdVendidos: number; cmv: number; semFicha: number;
  lucro: number; margem: number;
  semanas: Semana[]; fonteRecebido: "pagamentos" | "pedidos";
};

const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const ehInsumo = (cat?: string | null) => /insumo|ingrediente|mat[eé]ria/i.test(cat || "");

/** Custo dos ingredientes de 1 unidade de cada produto, pela ficha técnica (com conversão de unidades). */
export async function custoPorProduto(produtoIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!produtoIds.length) return out;
  const { data } = await supabase.from("produto_insumos")
    .select("produto_id, quantidade, unidade_utilizada, insumos(custo_unitario, unidade)").in("produto_id", produtoIds);
  const fator: Record<string, number> = { kg: 1, g: 0.001, L: 1, l: 1, ml: 0.001, un: 1 };
  for (const f of (data as any[]) || []) {
    const qtd = Number(f.quantidade) || 0, custo = Number(f.insumos?.custo_unitario) || 0;
    const uUsada = f.unidade_utilizada || f.insumos?.unidade || "", uInsumo = f.insumos?.unidade || "";
    const fu = fator[uUsada], fi = fator[uInsumo];
    const c = fu != null && fi != null && fi > 0 ? ((qtd * fu) / fi) * custo : qtd * custo;
    out[f.produto_id] = (out[f.produto_id] || 0) + c;
  }
  return out;
}

export async function carregarMes(uid: string, ano: number, mes0: number): Promise<MesFinanceiro> {
  const ini = iso(new Date(ano, mes0, 1)), fim = iso(new Date(ano, mes0 + 1, 0)), hoje = iso(new Date());
  const ate = fim < hoje ? fim : hoje;

  const [pag, fin, vend] = await Promise.all([
    supabase.from("pagamentos").select("valor, recebido_em").eq("user_id", uid).is("estornado_em", null).gte("recebido_em", ini).lte("recebido_em", ate),
    supabase.from("financeiro").select("tipo, categoria, valor, data").eq("user_id", uid).gte("data", ini).lte("data", ate),
    supabase.from("pedidos").select("id, valor_total, status, data_entrega, pedido_itens(quantidade, produtos(id))")
      .eq("user_id", uid).eq("status", "entregue").gte("data_entrega", ini).lte("data_entrega", fim),
  ]);

  // ── Recebido ──
  let fonteRecebido: MesFinanceiro["fonteRecebido"] = "pagamentos";
  let recebimentos: { valor: number; data: string }[] = [];
  if (!pag.error) {
    recebimentos = ((pag.data as any[]) || []).map(g => ({ valor: r2(g.valor), data: g.recebido_em }));
  } else {
    fonteRecebido = "pedidos";
    const { data: peds } = await supabase.from("pedidos").select("valor_total, valor_recebido, status, status_pagamento, data_entrega")
      .eq("user_id", uid).gte("data_entrega", ini).lte("data_entrega", ate);
    recebimentos = ((peds as any[]) || []).map(p => ({ valor: r2(valorRecebidoPedido(p)), data: p.data_entrega })).filter(x => x.valor > 0);
  }
  const lanc = ((fin.data as any[]) || []);
  const entradasAv = lanc.filter(l => l.tipo === "entrada");
  const saidas = lanc.filter(l => l.tipo !== "entrada");
  const recebidoPedidos = r2(recebimentos.reduce((s, x) => s + x.valor, 0));
  const entradasAvulsas = r2(entradasAv.reduce((s, l) => s + (Number(l.valor) || 0), 0));
  const despesasPagas = r2(saidas.reduce((s, l) => s + (Number(l.valor) || 0), 0));
  const despesasInsumos = r2(saidas.filter(l => ehInsumo(l.categoria)).reduce((s, l) => s + (Number(l.valor) || 0), 0));

  // ── Vendido e custo dos ingredientes ──
  const vendidos = ((vend.data as any[]) || []).filter(p => p.status !== "cancelado");
  const vendido = r2(vendidos.reduce((s, p) => s + (Number(p.valor_total) || 0), 0));
  const ids = [...new Set(vendidos.flatMap(p => (p.pedido_itens || []).map((it: any) => it.produtos?.id).filter(Boolean)))] as string[];
  const custo = await custoPorProduto(ids);
  let cmv = 0, semFicha = 0;
  for (const p of vendidos) {
    let faltou = false;
    for (const it of p.pedido_itens || []) {
      const c = custo[it.produtos?.id];
      if (!c) { faltou = true; continue; }
      cmv += c * (Number(it.quantidade) || 0);
    }
    if (faltou) semFicha++;
  }
  cmv = r2(cmv);
  const lucro = r2(vendido - cmv - (despesasPagas - despesasInsumos));
  const margem = vendido > 0 ? Math.round((lucro / vendido) * 100) : 0;

  // ── Fluxo por semana (dias 1–7, 8–14, 15–21, 22–28, 29–fim) ──
  const ult = new Date(ano, mes0 + 1, 0).getDate();
  const faixas = [[1, 7], [8, 14], [15, 21], [22, 28], [29, ult]].filter(([a]) => a <= ult);
  const dia = (d: string) => Number(d.slice(8, 10));
  let acumulado = 0;
  const semanas: Semana[] = faixas.map(([a, b]) => {
    const e = recebimentos.filter(x => dia(x.data) >= a && dia(x.data) <= b).reduce((s, x) => s + x.valor, 0)
            + entradasAv.filter(l => dia(l.data) >= a && dia(l.data) <= b).reduce((s, l) => s + (Number(l.valor) || 0), 0);
    const sa = saidas.filter(l => dia(l.data) >= a && dia(l.data) <= b).reduce((s, l) => s + (Number(l.valor) || 0), 0);
    acumulado += e - sa;
    return { label: a === b ? `${a}` : `${a}–${b}`, entradas: r2(e), saidas: r2(sa), acumulado: r2(acumulado) };
  });

  return {
    recebido: r2(recebidoPedidos + entradasAvulsas), recebidoPedidos, entradasAvulsas, qtdRecebimentos: recebimentos.length,
    despesasPagas, despesasInsumos, vendido, qtdVendidos: vendidos.length, cmv, semFicha, lucro, margem, semanas, fonteRecebido,
  };
}

/** Resumo das contas a pagar pendentes (null se a tabela ainda não existir). */
export async function resumoAPagar(): Promise<{ total: number; qtd: number; proxima: string | null } | null> {
  const { data, error } = await supabase.from("contas_pagar").select("valor, vencimento").eq("status", "pendente").order("vencimento", { ascending: true });
  if (error) return null;
  const l = (data as any[]) || [];
  return { total: r2(l.reduce((s, c) => s + (Number(c.valor) || 0), 0)), qtd: l.length, proxima: l[0]?.vencimento || null };
}

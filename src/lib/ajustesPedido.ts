import { supabase } from "@/lib/supabase";

/**
 * Financeiro · Passo 3 (03/10) — ajuste do valor do pedido na hora de finalizar
 * (desconto, taxa de entrega, acréscimo). O total do pedido passa a ser o novo valor, e o
 * ajuste fica registrado em "pedido_ajustes" (com o motivo), junto do valor original.
 * Sem a tabela (SQL não rodado), só atualiza o total e anota no histórico do pedido.
 */
export type TipoAjuste = "desconto" | "acrescimo";

const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function ajustarValorPedido(opts: {
  pedidoId: string; totalAtual: number; tipo: TipoAjuste; valor: number; motivo?: string | null; userId?: string | null;
}): Promise<{ ok: boolean; novoTotal: number; erro?: string }> {
  const valor = r2(opts.valor);
  const antes = r2(opts.totalAtual);
  const novoTotal = r2(opts.tipo === "acrescimo" ? antes + valor : antes - valor);
  if (valor <= 0) return { ok: true, novoTotal: antes };
  if (novoTotal < 0) return { ok: false, novoTotal: antes, erro: "O desconto passa do valor do pedido" };

  let uid = opts.userId || null;
  if (!uid) { const { data } = await supabase.auth.getUser(); uid = data.user?.id || null; }

  // 1) histórico do ajuste (a tabela pode ainda não existir: segue sem ela)
  await supabase.from("pedido_ajustes").insert({
    user_id: uid, pedido_id: opts.pedidoId, tipo: opts.tipo, valor, motivo: opts.motivo || null,
    total_antes: antes, total_depois: novoTotal,
  }).then(() => {}, () => {});

  // 2) o novo total, e o desconto/acréscimo do pedido junto — senão uma edição depois recalcularia
  //    o total pelos campos e "desfaria" o ajuste (o gatilho dos pagamentos recalcula o pago/parcial)
  const { data: atual } = await supabase.from("pedidos").select("desconto, acrescimo").eq("id", opts.pedidoId).maybeSingle();
  const campo = opts.tipo === "desconto" ? "desconto" : "acrescimo";
  const valorCampo = r2((Number((atual as any)?.[campo]) || 0) + valor);
  let { error } = await supabase.from("pedidos").update({ valor_total: novoTotal, [campo]: valorCampo }).eq("id", opts.pedidoId);
  if (error && /acrescimo/i.test(error.message || "")) {
    // a coluna "acrescimo" não existe nessa conta: grava só o total
    ({ error } = await supabase.from("pedidos").update({ valor_total: novoTotal }).eq("id", opts.pedidoId));
  }
  if (error) return { ok: false, novoTotal: antes, erro: error.message };

  // 3) anota no histórico do pedido
  const rotulo = opts.tipo === "desconto" ? "Desconto" : "Acréscimo";
  supabase.from("pedido_historico").insert({
    pedido_id: opts.pedidoId, user_id: uid, evento: "Valor ajustado",
    descricao: `${rotulo} de ${brl(valor)}${opts.motivo ? ` (${opts.motivo})` : ""} · ${brl(antes)} → ${brl(novoTotal)}`,
  }).then(() => {}, () => {});

  return { ok: true, novoTotal };
}

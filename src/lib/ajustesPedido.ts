import { supabase } from "@/lib/supabase";
import { r2 } from "@/lib/moeda";
import { explicarErro } from "@/lib/erros";
import { faltaNoBanco } from "@/lib/pagamentos";

/**
 * Financeiro · Passo 3 (03/10) — ajuste do valor do pedido na hora de finalizar
 * (desconto, taxa de entrega, acréscimo). O total do pedido passa a ser o novo valor, e o
 * ajuste fica registrado em "pedido_ajustes" (com o motivo), junto do valor original.
 * Sem a tabela (SQL não rodado), só atualiza o total e anota no histórico do pedido.
 */
export type TipoAjuste = "desconto" | "acrescimo";

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ERRO_AJUSTE = "Não deu para ajustar o valor. Tente de novo.";

/**
 * (11/10) A conta é feita em cima do que está NO BANCO agora, não do total que a tela mandou
 * (a lista aberta há tempo gravava um total velho por cima). `totalAtual` fica só de reserva, pra devolver em caso de erro.
 * Ordem: lê o pedido → grava o novo total → só então registra o ajuste. Se algo falhar antes, nada fica pela metade.
 */
export async function ajustarValorPedido(opts: {
  pedidoId: string; totalAtual: number; tipo: TipoAjuste; valor: number; motivo?: string | null; userId?: string | null;
}): Promise<{ ok: boolean; novoTotal: number; erro?: string }> {
  const valor = r2(opts.valor);
  const daTela = r2(opts.totalAtual);
  if (valor <= 0) return { ok: true, novoTotal: daTela };

  // 1) o pedido como está no banco (a coluna "acrescimo" pode não existir nessa conta)
  let temAcrescimo = true;
  let lido = await supabase.from("pedidos").select("valor_total, desconto, acrescimo").eq("id", opts.pedidoId).maybeSingle();
  if (lido.error && faltaNoBanco(lido.error)) {
    temAcrescimo = false;
    lido = await supabase.from("pedidos").select("valor_total, desconto").eq("id", opts.pedidoId).maybeSingle() as typeof lido;
  }
  if (lido.error) return { ok: false, novoTotal: daTela, erro: explicarErro(lido.error, ERRO_AJUSTE) };
  if (!lido.data) return { ok: false, novoTotal: daTela, erro: "Esse pedido não existe mais." };
  const atual: any = lido.data;
  const antes = r2(Number(atual.valor_total) || 0);
  const novoTotal = r2(opts.tipo === "acrescimo" ? antes + valor : antes - valor);
  if (novoTotal < 0) return { ok: false, novoTotal: antes, erro: "O desconto passa do valor do pedido" };

  let uid = opts.userId || null;
  if (!uid) { const { data } = await supabase.auth.getUser(); uid = data.user?.id || null; }

  // 2) o novo total, e o desconto/acréscimo do pedido junto — senão uma edição depois recalcularia
  //    o total pelos campos e "desfaria" o ajuste (o gatilho dos pagamentos recalcula o pago/parcial)
  const campo = opts.tipo === "desconto" ? "desconto" : "acrescimo";
  const valorCampo = r2((Number(atual[campo]) || 0) + valor);
  const mudanca = campo === "acrescimo" && !temAcrescimo ? { valor_total: novoTotal } : { valor_total: novoTotal, [campo]: valorCampo };
  const { error } = await supabase.from("pedidos").update(mudanca).eq("id", opts.pedidoId);
  if (error) return { ok: false, novoTotal: antes, erro: explicarErro(error, ERRO_AJUSTE) };

  // 3) com o total gravado, o registro do ajuste (a tabela pode ainda não existir: segue sem ela)
  const { error: erroAjuste } = await supabase.from("pedido_ajustes").insert({
    user_id: uid, pedido_id: opts.pedidoId, tipo: opts.tipo, valor, motivo: opts.motivo || null,
    total_antes: antes, total_depois: novoTotal,
  });
  if (erroAjuste && !faltaNoBanco(erroAjuste)) console.error("[Doonly] ajuste gravado no pedido, mas não no histórico de ajustes", erroAjuste);

  // 4) anota no histórico do pedido
  const rotulo = opts.tipo === "desconto" ? "Desconto" : "Acréscimo";
  supabase.from("pedido_historico").insert({
    pedido_id: opts.pedidoId, user_id: uid, evento: "Valor ajustado",
    descricao: `${rotulo} de ${brl(valor)}${opts.motivo ? ` (${opts.motivo})` : ""} · ${brl(antes)} → ${brl(novoTotal)}`,
  }).then(() => {}, () => {});

  return { ok: true, novoTotal };
}

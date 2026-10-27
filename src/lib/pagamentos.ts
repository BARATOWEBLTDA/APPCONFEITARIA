import { supabase } from "@/lib/supabase";

/**
 * Financeiro · Passo 1 (03/10) — cada recebimento vira uma linha em "pagamentos".
 * O valor_recebido e o status_pagamento do pedido são a SOMA dessas linhas, mantida pelo banco
 * (supabase/sql/pagamentos.sql). Ninguém mais escreve valor_recebido "na mão".
 *
 * Enquanto o SQL não tiver sido rodado (a tabela não existe), estas funções gravam do jeito antigo,
 * direto no pedido — assim nada quebra entre o deploy e a confeiteira rodar o SQL.
 */
export type TipoPagamento = "sinal" | "parcial" | "restante" | "total" | "pagamento";

const hojeBR = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const tabelaNaoExiste = (e: any) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /pagamentos/i.test(e.message || "") && /exist|schema cache|not find/i.test(e.message || ""));

/** Texto gravado na observação do recebimento estornado porque o PEDIDO FOI EXCLUÍDO (10/10). Não é devolução de dinheiro: o caixa lê isso. */
export const ESTORNO_POR_EXCLUSAO = "Pedido excluído";
/** (27/10) recebimento que SUBSTITUI um estornado (o que sobrou ao diminuir um pagamento): o caixa conta ele mesmo com a data antiga */
export const SUBSTITUI_RECEBIMENTO = "Ajuste no Editar pedido · substitui um recebimento";

/**
 * O erro é de coluna ou tabela que ainda não existe no banco (SQL não rodado)? (10/10)
 * Só nesse caso o financeiro usa o plano B (regra antiga). Queda de internet ou qualquer outro erro
 * NÃO é isso: a tela avisa "Não deu pra carregar" em vez de mostrar um número errado.
 *   42703 coluna não existe · 42P01 tabela não existe · PGRST204/PGRST205 coluna/tabela fora do cache do PostgREST
 */
export function faltaNoBanco(e: unknown): boolean {
  if (!e) return false;
  const x = e as { code?: unknown; message?: unknown };
  if (["42703", "42P01", "PGRST204", "PGRST205"].includes(String(x.code || ""))) return true;
  return /does not exist|schema cache/i.test(String(x.message || ""));
}

/** Normaliza a forma ("PIX", "Pix", "Cartão de crédito"…) pros 4 valores do app. */
export function normalizarForma(f?: string | null): string | null {
  const s = String(f || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!s) return null;
  if (s.includes("pix")) return "pix";
  if (s.includes("dinheiro")) return "dinheiro";
  if (s.includes("debito")) return "debito";
  if (s.includes("credito") || s === "cartao") return "credito";
  return s;
}

/** Atualiza o pedido do jeito antigo (só usado se a tabela de pagamentos ainda não existir). */
async function gravarNoPedidoLegado(pedidoId: string, novoRecebido: number) {
  const { data: p } = await supabase.from("pedidos").select("valor_total").eq("id", pedidoId).maybeSingle();
  const total = Number((p as any)?.valor_total) || 0;
  const v = r2(Math.min(Math.max(0, novoRecebido), Math.max(total, novoRecebido)));
  const status = v > 0 && v >= total - 0.009 ? "pago" : v > 0 ? "parcial" : "pendente";
  await supabase.from("pedidos").update({ valor_recebido: v, status_pagamento: status }).eq("id", pedidoId);
  return { valor_recebido: v, status_pagamento: status };
}

async function recebidoAtual(pedidoId: string): Promise<number> {
  const { data: p } = await supabase.from("pedidos").select("valor_total, status_pagamento, valor_recebido").eq("id", pedidoId).maybeSingle();
  const pp: any = p || {};
  if (pp.status_pagamento === "pago") return Number(pp.valor_total) || 0;
  if (pp.status_pagamento === "parcial") return Number(pp.valor_recebido) || 0;
  return 0;
}

/**
 * Registra um recebimento de um pedido (o valor que entrou AGORA).
 * Devolve como o pedido ficou, pra tela atualizar sem precisar recarregar.
 */
export async function registrarPagamento(opts: {
  pedidoId: string; userId?: string | null; valor: number; forma?: string | null;
  tipo?: TipoPagamento; origem?: string; observacao?: string | null; recebidoEm?: string;
  /** criação do pedido: o pedido já nasce com o valor certo, então sem a tabela não precisa gravar de novo */
  pedidoJaTemOValor?: boolean;
}): Promise<{ ok: boolean; legado: boolean; valor_recebido?: number; status_pagamento?: string; erro?: string }> {
  const valor = r2(opts.valor);
  if (!opts.pedidoId || valor <= 0) return { ok: true, legado: false };
  let uid = opts.userId || null;
  if (!uid) { const { data } = await supabase.auth.getUser(); uid = data.user?.id || null; }
  const { error } = await supabase.from("pagamentos").insert({
    user_id: uid, pedido_id: opts.pedidoId, valor, forma: normalizarForma(opts.forma),
    tipo: opts.tipo || "pagamento", origem: opts.origem || "app",
    observacao: opts.observacao || null, recebido_em: opts.recebidoEm || hojeBR(),
  });
  if (!error) {
    const { data: p } = await supabase.from("pedidos").select("valor_recebido, status_pagamento").eq("id", opts.pedidoId).maybeSingle();
    return { ok: true, legado: false, valor_recebido: Number((p as any)?.valor_recebido) || 0, status_pagamento: (p as any)?.status_pagamento };
  }
  // (17/10 · R06) o banco recusou porque esse mesmo recebimento acabou de entrar (dois toques, duas abas, nova tentativa):
  // não é erro, o dinheiro já está registrado uma vez
  // (27/10) não diz mais "registrado": dois pagamentos iguais de verdade (dois Pix de R$ 50) perdiam o segundo sem aviso
  if (/pagamento_repetido/.test(String(error.message || ""))) {
    const v = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return { ok: false, legado: false, erro: `Um recebimento igual (${v}) acabou de entrar neste pedido. Se é outro pagamento, espere 15 segundos e registre de novo.` };
  }
  if (/recebido_acima_do_total/.test(String(error.message || ""))) {
    return { ok: false, legado: false, erro: "Esse valor passa do total do pedido. Confira o que já foi recebido (talvez já tenha sido registrado em outra tela)." };
  }
  if (tabelaNaoExiste(error)) {
    if (opts.pedidoJaTemOValor) return { ok: true, legado: true };
    const novo = (await recebidoAtual(opts.pedidoId)) + valor;
    return { ok: true, legado: true, ...(await gravarNoPedidoLegado(opts.pedidoId, novo)) };
  }
  console.error("[pagamentos] não consegui registrar:", error);
  return { ok: false, legado: false };
}

/**
 * Deixa o recebido de um pedido igual a "alvo" (usado quando ela muda o pagamento no Editar pedido).
 * Subiu → registra a diferença. Desceu → estorna os pagamentos mais recentes (nada é apagado)
 * e, se passar do ponto, registra o que faltou.
 */
export async function ajustarRecebido(opts: { pedidoId: string; alvo: number; forma?: string | null; userId?: string | null })
: Promise<{ ok: boolean; legado: boolean }> {
  const alvo = r2(Math.max(0, opts.alvo));
  const { data: ativos, error } = await supabase.from("pagamentos")
    .select("id, valor, created_at, recebido_em").eq("pedido_id", opts.pedidoId).is("estornado_em", null).order("created_at", { ascending: false });
  if (error) {
    if (tabelaNaoExiste(error)) { await gravarNoPedidoLegado(opts.pedidoId, alvo); return { ok: true, legado: true }; }
    console.error("[pagamentos] não consegui ajustar:", error);
    return { ok: false, legado: false };
  }
  let soma = r2((ativos || []).reduce((s: number, p: any) => s + (Number(p.valor) || 0), 0));
  if (alvo > soma + 0.009) {
    const r = await registrarPagamento({ pedidoId: opts.pedidoId, userId: opts.userId, valor: alvo - soma, forma: opts.forma, tipo: "pagamento", observacao: "Ajuste no Editar pedido" });
    return { ok: r.ok, legado: r.legado };
  }
  // (4.29) o que sobra depois de estornar SUBSTITUI o recebimento estornado: fica com a data dele, não com a de hoje
  // (sinal de 160 no dia 8 corrigido pra 100 no dia 12 continua sendo dinheiro que entrou no dia 8)
  let dataSubstituida: string | undefined;
  for (const p of (ativos || []) as any[]) {
    if (soma <= alvo + 0.009) break;
    if (!dataSubstituida && p.recebido_em) dataSubstituida = String(p.recebido_em).slice(0, 10);
    const { error: e2 } = await supabase.from("pagamentos").update({ estornado_em: new Date().toISOString() }).eq("id", p.id);
    if (e2) { console.error("[pagamentos] não consegui estornar:", e2); return { ok: false, legado: false }; }
    soma = r2(soma - (Number(p.valor) || 0));
  }
  if (alvo > soma + 0.009) {
    const r = await registrarPagamento({ pedidoId: opts.pedidoId, userId: opts.userId, valor: alvo - soma, forma: opts.forma, tipo: "pagamento", observacao: dataSubstituida ? SUBSTITUI_RECEBIMENTO : "Ajuste no Editar pedido", recebidoEm: dataSubstituida });
    return { ok: r.ok, legado: r.legado };
  }
  return { ok: true, legado: false };
}

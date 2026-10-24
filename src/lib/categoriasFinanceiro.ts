/**
 * Categorias dos lançamentos manuais do financeiro (4.29).
 * Aporte e retirada são dinheiro da dona, não do negócio: mexem no saldo em caixa,
 * mas ficam fora do recebido, das despesas, do resultado e do lucro.
 */
export const APORTE = "Aporte (dinheiro seu)";
export const RETIRADA = "Retirada para você";

/** true = não conta como venda nem como despesa (aporte ou retirada da dona). */
export const ehDinheiroDaDona = (cat?: string | null) => /^\s*(aporte|retirada pra)/i.test(cat || "");

/** Nome na tela. "Insumos" (valor antigo, ainda salvo) aparece como "Ingredientes". */
export const nomeCategoriaFin = (cat?: string | null) => {
  const c = String(cat || "").trim();
  return /^insumos?$/i.test(c) ? "Ingredientes" : c;
};

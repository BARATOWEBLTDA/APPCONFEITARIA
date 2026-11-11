/**
 * (6.131) Descrição da loja feita pela IA: no máximo 160 letras (umas 3 linhas no topo do cardápio do celular).
 * A IA às vezes passa do pedido; aqui o texto é cortado no fim de uma frase (ou de uma palavra), nunca no meio dela.
 * (11/11) Quem escreve à mão tem o mesmo limite (LIMITE_DESCRICAO): até 160 cabe em 3 linhas no topo do cardápio, no celular.
 */
export const LIMITE_DESCRICAO = 160;
export const LIMITE_DESCRICAO_IA = LIMITE_DESCRICAO;

export function ajustarDescricao(bruto: string, max = LIMITE_DESCRICAO_IA): string {
  let t = String(bruto || "").replace(/\s+/g, " ").replace(/^["“'\s]+|["”'\s]+$/g, "").trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max + 1);
  // termina na última frase completa, se ela não deixar o texto curto demais
  const fimFrase = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf("! "), corte.lastIndexOf("? "), /[.!?]$/.test(corte) ? corte.length - 1 : -1);
  if (fimFrase >= max * 0.55) return corte.slice(0, fimFrase + 1).trim();
  // senão, termina na última palavra inteira e fecha com ponto
  const curto = t.slice(0, max);
  t = curto.slice(0, curto.lastIndexOf(" ") > 0 ? curto.lastIndexOf(" ") : max - 1).replace(/[\s,;:–—-]+$/, "");
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

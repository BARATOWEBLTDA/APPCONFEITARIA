/**
 * Campos de dinheiro do financeiro (03/10): máscara de real, como no app do banco.
 * A pessoa digita só os números e o campo vai formando: 1 → 0,01 · 125 → 1,25 · 125050 → 1.250,50.
 */
export function mascaraBRL(digitado: string): string {
  const d = String(digitado).replace(/\D/g, "").replace(/^0+/, "").slice(0, 11);
  if (!d) return "";
  const c = d.padStart(3, "0");
  return `${Number(c.slice(0, -2)).toLocaleString("pt-BR")},${c.slice(-2)}`;
}

/** Número → texto do campo ("1.250,50"). Zero ou vazio vira campo vazio. */
export function textoBRL(v: number | null | undefined): string {
  const n = Number(v) || 0;
  return n ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
}

/** Texto do campo → número ("1.250,50" → 1250.5). */
export function lerBRL(s: string): number {
  return Math.round((parseFloat(String(s).replace(/\./g, "").replace(",", ".")) || 0) * 100) / 100;
}

/**
 * Arredonda pra centavos (11/10): UMA conta só pro app inteiro.
 * Use em toda linha de item (preço × quantidade) e em todo total antes de mostrar, comparar ou gravar.
 * Sem isso, 0,5 kg × R$ 19,99 dava 9,995 e cada tela mostrava um centavo diferente.
 */
export const r2 = (v: number | null | undefined): number => {
  const n = Number(v) || 0;
  if (!Number.isFinite(n)) return 0; // (11/10) Infinity/NaN viram 0
  // o "+ 1e-9" corrige o caso em que 1,005 está guardado como 1,00499999 e arredondaria pra baixo
  // (11/10) "|| 0" evita devolver -0 (mostrava "-R$ 0,00")
  return Math.round((n + Math.sign(n) * 1e-9) * 100) / 100 || 0;
};

/** Soma valores em reais sem sujeira de ponto flutuante (soma em centavos inteiros). */
export const somarReais = (valores: (number | null | undefined)[]): number =>
  valores.reduce<number>((s, v) => s + Math.round(r2(v) * 100), 0) / 100;

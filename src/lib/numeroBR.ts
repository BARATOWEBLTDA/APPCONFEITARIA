/**
 * Lê um número digitado do jeito brasileiro (30/09).
 *   "7,50" → 7.5 · "1.250,90" → 1250.9 · "1.000" → 1000 · "3.000" → 3000 · "0.5" → 0.5 · "2,5" → 2.5
 * Antes o app usava parseFloat direto: "1.000" (g) virava 1 e o custo ficava 1000× maior.
 */
export function parseNumBR(v: string | number | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!s) return 0;
  let n: number;
  if (s.includes(",")) n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) n = parseFloat(s.replace(/\./g, "")); // ponto de milhar
  else n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

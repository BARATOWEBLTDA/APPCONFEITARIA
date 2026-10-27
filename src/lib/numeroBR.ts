/**
 * Lê um número digitado do jeito brasileiro (30/09).
 *   "7,50" → 7.5 · "1.250,90" → 1250.9 · "1.000" → 1000 · "3.000" → 3000 · "0.5" → 0.5 · "2,5" → 2.5 · "0.250" → 0.25
 * Antes o app usava parseFloat direto: "1.000" (g) virava 1 e o custo ficava 1000× maior.
 */
export function parseNumBR(v: string | number | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!s) return 0;
  let n: number;
  if (s.includes(",")) n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  // ponto de milhar ("1.000"); se a parte inteira é só zero ("0.250", "0.500") é decimal, não milhar (10/10)
  else if (/^\d{1,3}(\.\d{3})+$/.test(s) && !/^0+\./.test(s)) n = parseFloat(s.replace(/\./g, ""));
  else n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lê um peso digitado e devolve em kg (11/10). 0 = não entendeu.
 *   "500g" → 0.5 · "1.500g" → 1.5 · "1,5" → 1.5 · "1.5" → 1.5 · "20" → 20 · "0,5 kg" → 0.5 · "500" → 0.5 · "1.500" → 1.5
 * Com "g" é grama, com "kg" é quilo. Sem unidade: até 99 é quilo; de 100 pra cima é grama (ninguém vende bolo de 100 kg).
 * Antes "1.500g" virava 0,0015 kg e "20" virava 0,02 kg.
 */
export function lerPesoKg(v: string | number | null | undefined): number {
  const s = String(v ?? "").toLowerCase().replace(/\s/g, "");
  // a unidade pode estar pela metade enquanto a pessoa digita ("1,5k"): vale pela primeira letra
  const m = s.match(/^([\d.,]+)([a-z]*)$/);
  if (!m) return 0;
  const emKg = /^[kq]/.test(m[2]);
  const emG = /^g/.test(m[2]);
  if (m[2] && !emKg && !emG) return 0;
  let n: number;
  // em kg, "1.500" é um e meio (decimal); em gramas, ponto ou vírgula antes de 3 dígitos é milhar ("1.500g")
  if (emKg) n = parseFloat(m[1].replace(",", "."));
  else if (emG) n = parseNumBR(m[1].replace(/[.,](?=\d{3}$)/, ""));
  else n = parseNumBR(m[1]);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const kg = emKg ? n : emG || n >= 100 ? n / 1000 : n;
  return Math.round(kg * 1000) / 1000;
}

/** (27/10) Campo de dinheiro igual ao resto do app: os números entram pelos centavos ("1000" → "10,00"). Vazio fica vazio. */
export function mascaraReais(v: string): string {
  const d = String(v ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!d) return "";
  const n = parseInt(d, 10) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/** Valor salvo (número) para o texto do campo de dinheiro: 0.1 → "0,10" (antes aparecia "0.1"). */
export function reaisParaCampo(v: number | string | null | undefined): string {
  const n = typeof v === "number" ? v : parseNumBR(v as any);
  return n > 0 ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
}

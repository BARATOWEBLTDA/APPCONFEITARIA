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

/**
 * (10/11) Nome de cliente como gente escreve: "joão pedro silva" ou "JOÃO PEDRO SILVA" vira "João Pedro Silva".
 * Só mexe quando o nome veio todo minúsculo ou todo maiúsculo; quem escreveu "Ana LUIZA" de propósito fica como está.
 * "de", "da", "dos", "e"… ficam minúsculos no meio do nome.
 */
const LIGACOES = new Set(["de", "da", "do", "das", "dos", "e", "di", "du"]);
export function nomeDePessoa(nome: string | null | undefined): string {
  const t = String(nome ?? "").trim().replace(/\s+/g, " ");
  if (!t || (t !== t.toLowerCase() && t !== t.toUpperCase())) return t;
  return t.toLowerCase().split(" ").map((p, i) => (i > 0 && LIGACOES.has(p) ? p : p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1))).join(" ");
}

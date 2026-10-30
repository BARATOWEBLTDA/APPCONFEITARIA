/**
 * (30/10 · 5.35) Nome de item (complemento, produto…) arrumado para o cardápio:
 *  "topo de bolo" → "Topo de Bolo" · "TOPO DE BOLO" → "Topo de Bolo" · espaços sobrando saem.
 * Preposições e artigos ficam minúsculos (menos na primeira palavra). Palavras com número ficam como estão.
 */
const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "com", "sem", "em", "no", "na", "nos", "nas", "para", "pra", "a", "o", "as", "os", "ou", "por", "ao", "à", "um", "uma", "uns", "umas"]);

export function formatarNomeItem(nome: string): string {
  const limpo = nome.replace(/\s+/g, " ").trim();
  if (!limpo) return "";
  return limpo.split(" ").map((w, i) => {
    if (/\d/.test(w)) return w;
    const min = w.toLocaleLowerCase("pt-BR");
    if (i > 0 && MINUSCULAS.has(min)) return min;
    return min.charAt(0).toLocaleUpperCase("pt-BR") + min.slice(1);
  }).join(" ");
}

/** O nome parece uma frase ("Escolha um topo de bolo", "Quer vela?") em vez do nome do item? */
const VERBOS = /^(escolha|escolher|escolhe|selecione|selecionar|adicione|adicionar|coloque|colocar|quer|deseja|gostaria|inclua|incluir|marque|marcar|monte|montar|personalize|personalizar|peça|pedir)\b/i;
export function parecefrase(nome: string): boolean {
  const n = nome.trim();
  if (!n) return false;
  return VERBOS.test(n) || /[?!.]$/.test(n) || n.split(/\s+/).length > 5;
}

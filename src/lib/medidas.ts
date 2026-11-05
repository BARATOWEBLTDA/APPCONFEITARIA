/**
 * (6.150) Conversor de medidas: quanto pesa cada medida caseira, por ingrediente.
 * Base: xícara de 240 ml nivelada (padrão das receitas brasileiras). Valores aproximados, das tabelas de culinária.
 */
export type Medida = "xicara" | "copo" | "csopa" | "ccha" | "ml" | "g";

/** ml de cada medida */
/** ml de cada medida (gramas não têm volume fixo: dependem do ingrediente) */
export const ML: Record<Exclude<Medida, "g">, number> = { xicara: 240, copo: 190, csopa: 15, ccha: 5, ml: 1 };

export const MEDIDAS: { v: Medida; um: string; varios: string }[] = [
  { v: "xicara", um: "xícara", varios: "xícaras" },
  { v: "copo", um: "copo americano", varios: "copos americanos" },
  { v: "csopa", um: "colher de sopa", varios: "colheres de sopa" },
  { v: "ccha", um: "colher de chá", varios: "colheres de chá" },
  { v: "ml", um: "ml", varios: "ml" },
  { v: "g", um: "grama", varios: "gramas" },
];

/** gramas em 1 xícara (240 ml) */
export type Ingrediente = { id: string; nome: string; xicara: number; grupo: "Secos" | "Gorduras" | "Líquidos" | "Outros" | "Seus"; proprio?: boolean };

/** foto do ingrediente (os cadastrados por ela usam a tigela neutra) */
export const fotoIngrediente = (i: Ingrediente) => `/ingredientes/${i.proprio ? "seu" : i.id}.webp`;

export const INGREDIENTES: Ingrediente[] = [
  { id: "farinha", nome: "Farinha de trigo", xicara: 120, grupo: "Secos" },
  { id: "acucar", nome: "Açúcar refinado", xicara: 180, grupo: "Secos" },
  { id: "acucar-cristal", nome: "Açúcar cristal", xicara: 200, grupo: "Secos" },
  { id: "acucar-mascavo", nome: "Açúcar mascavo", xicara: 150, grupo: "Secos" },
  { id: "acucar-confeiteiro", nome: "Açúcar de confeiteiro", xicara: 120, grupo: "Secos" },
  { id: "chocolate-po", nome: "Chocolate em pó", xicara: 90, grupo: "Secos" },
  { id: "cacau", nome: "Cacau em pó", xicara: 80, grupo: "Secos" },
  { id: "amido", nome: "Amido de milho", xicara: 120, grupo: "Secos" },
  { id: "leite-po", nome: "Leite em pó", xicara: 100, grupo: "Secos" },
  { id: "coco", nome: "Coco ralado", xicara: 80, grupo: "Secos" },
  { id: "aveia", nome: "Aveia em flocos", xicara: 80, grupo: "Secos" },
  { id: "fuba", nome: "Fubá", xicara: 120, grupo: "Secos" },
  { id: "polvilho", nome: "Polvilho", xicara: 150, grupo: "Secos" },
  { id: "fermento", nome: "Fermento em pó", xicara: 192, grupo: "Secos" },
  { id: "bicarbonato", nome: "Bicarbonato", xicara: 220, grupo: "Secos" },
  { id: "sal", nome: "Sal", xicara: 288, grupo: "Secos" },
  { id: "castanha", nome: "Castanhas picadas", xicara: 120, grupo: "Secos" },
  { id: "granulado", nome: "Granulado", xicara: 160, grupo: "Secos" },
  { id: "manteiga", nome: "Manteiga", xicara: 200, grupo: "Gorduras" },
  { id: "margarina", nome: "Margarina", xicara: 200, grupo: "Gorduras" },
  { id: "oleo", nome: "Óleo", xicara: 220, grupo: "Gorduras" },
  { id: "leite", nome: "Leite", xicara: 245, grupo: "Líquidos" },
  { id: "agua", nome: "Água", xicara: 240, grupo: "Líquidos" },
  { id: "leite-condensado", nome: "Leite condensado", xicara: 310, grupo: "Líquidos" },
  { id: "creme-leite", nome: "Creme de leite", xicara: 245, grupo: "Líquidos" },
  { id: "chantilly", nome: "Creme de leite fresco", xicara: 240, grupo: "Líquidos" },
  { id: "mel", nome: "Mel", xicara: 340, grupo: "Líquidos" },
  { id: "doce-leite", nome: "Doce de leite", xicara: 300, grupo: "Outros" },
  { id: "nutella", nome: "Creme de avelã", xicara: 300, grupo: "Outros" },
  { id: "requeijao", nome: "Cream cheese", xicara: 240, grupo: "Outros" },
];

/** gramas de "qtd" na medida escolhida */
export function emGramas(ing: Ingrediente, qtd: number, medida: Medida) {
  return medida === "g" ? qtd : (ing.xicara / ML.xicara) * ML[medida] * qtd;
}

/** volume em ml de "qtd" na medida (gramas viram ml pelo peso do ingrediente) */
export function emMl(ing: Ingrediente, qtd: number, medida: Medida) {
  return medida === "g" ? qtd / (ing.xicara / ML.xicara) : ML[medida] * qtd;
}

/** número de receita: 1,5 → "1 ½"; 0,25 → "¼" (quando fecha numa fração comum) */
const FRACOES: [number, string][] = [[0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"]];
export function numeroReceita(n: number) {
  const int = Math.floor(n + 1e-9), resto = n - int;
  if (resto < 0.04) return String(int);
  const f = FRACOES.find(([v]) => Math.abs(v - resto) < 0.04);
  if (f) return int ? `${int} ${f[1]}` : f[1];
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

/** "1,5" / "1 1/2" / "½" → 1.5 */
export function lerQuantidade(t: string): number {
  const s = t.trim().replace(/¼/g, " 1/4").replace(/½/g, " 1/2").replace(/¾/g, " 3/4").replace(/⅓/g, " 1/3").replace(/⅔/g, " 2/3").trim();
  if (!s) return 0;
  let total = 0;
  for (const p of s.split(/\s+/)) {
    const m = p.match(/^(\d+)\/(\d+)$/);
    if (m) total += Number(m[1]) / Number(m[2]) || 0;
    else total += Number(p.replace(",", ".")) || 0;
  }
  return total;
}

export function gramasTexto(g: number) {
  if (g >= 1000) return `${(g / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;
  return `${g < 10 ? g.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : Math.round(g)} g`;
}

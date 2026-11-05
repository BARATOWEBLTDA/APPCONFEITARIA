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

/**
 * (6.151) Fotos reais dos ingredientes: Unsplash (licença livre, uso comercial sem atribuição obrigatória),
 * servidas já recortadas no tamanho certo pelo CDN deles. Se a foto não carregar, fica a ilustração da tigela.
 */
const FOTOS: Record<string, string> = {
  "farinha": "photo-1627485937980-221c88ac04f9",
  "acucar": "photo-1634612831148-03a8550e1d52",
  "acucar-cristal": "photo-1673791031202-ebc0eea03bf2",
  "acucar-mascavo": "photo-1704079611177-a3a60ce6f975",
  "acucar-confeiteiro": "photo-1738667763809-d064c7a0fc69",
  "chocolate-po": "photo-1640958899669-12f9b327d38f",
  "cacau": "photo-1765710686877-f7c433d88936",
  "amido": "photo-1714842981153-ffeaf74e7a1a",
  "leite-po": "photo-1704650312191-005ab02786f5",
  "coco": "photo-1582362731298-b3f9789a17ce",
  "aveia": "photo-1598048851887-0263d4f43e73",
  "fuba": "photo-1673694800551-b84c5e7d2933",
  "polvilho": "photo-1641301553499-9a0ff924fcb5",
  "fermento": "photo-1737098140591-f0988ae7e15a",
  "bicarbonato": "photo-1770732851655-a789335a31c8",
  "sal": "photo-1558394299-f2e6198506a6",
  "castanha": "photo-1693812879904-b8161644ce5a",
  "granulado": "photo-1657502360008-667db038296b",
  "manteiga": "photo-1589985270826-4b7bb135bc9d",
  "margarina": "photo-1660190368311-64d54386e494",
  "oleo": "photo-1552592074-ea7a91b851b3",
  "leite": "photo-1517448931760-9bf4414148c5",
  "agua": "photo-1781510350868-b81dfa490295",
  "leite-condensado": "photo-1612676855298-c7116c892b1a",
  "creme-leite": "photo-1633893215271-f7e1fca081ad",
  "chantilly": "photo-1786695144564-d1cd05367032",
  "mel": "photo-1587049352851-8d4e89133924",
  "doce-leite": "photo-1729673520938-98c2394f33df",
  "nutella": "photo-1551578657-a7e74acb0135",
  "requeijao": "photo-1573810655264-8d1e50f1592d",
};
export const ilustracaoIngrediente = (i: Ingrediente) => `/ingredientes/${i.proprio ? "seu" : i.id}.webp`;
export const fotoIngrediente = (i: Ingrediente, px = 96) => {
  const f = !i.proprio && FOTOS[i.id];
  return f ? `https://images.unsplash.com/${f}?w=${px}&h=${px}&fit=crop&q=70&auto=format` : ilustracaoIngrediente(i);
};

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

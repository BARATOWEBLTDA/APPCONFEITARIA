/**
 * (04/11 · 6.31) Categorias dos ingredientes: UMA lista só, a mesma na janela do ingrediente,
 * no filtro da tela Ingredientes e na Doo. A categoria é obrigatória.
 * categoriaPeloNome() marca sozinha quando o nome deixa claro o que é (leite condensado → Laticínios e ovos);
 * quando não deixa, devolve null e a confeiteira escolhe.
 */
export const CATEGORIAS_INSUMO = [
  "Secos", "Laticínios e ovos", "Chocolates", "Frutas", "Carnes e frios",
  "Embalagens", "Decorações", "Descartáveis", "Bebidas", "Outros",
] as const;
export type CategoriaInsumo = (typeof CATEGORIAS_INSUMO)[number];

const sem = (t: string) => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** a primeira regra que bate vale: as mais específicas vêm antes ("doce de leite" antes de "leite", "coco ralado" antes de "coco") */
const REGRAS: [RegExp, CategoriaInsumo][] = [
  [/\b(copos?|colher(es|inhas?)?|garfos?|guardanapos?|pratinhos?|pratos? descartave|palitos?|luvas?|filme pvc|papel aluminio|papel manteiga|canudos?)\b/, "Descartáveis"],
  [/\b(caixas?|embalage(m|ns)|sacos?|saquinhos?|sacolas?|potes?|tampas?|forminhas?|formas? de papel|bandejas?|cake ?boards?|bases? para bolo|etiquetas?|tags?|celofane|tubetes?|blister|marmitas?)\b/, "Embalagens"],
  [/\b(topos?|toppers?|velas?|confeitos?|glitter|brilho|perolas?|flor(es)?|fitas?|lacos?|papel de arroz|pasta americana|corantes?|sprinkles?|po para decorar|confetes?)\b/, "Decorações"],
  [/\b(chocolates?|cacau|granulados?|nutella|creme de avela|avela|gotas de chocolate|ganache|bis|kit ?kat|ovomaltine|nescau)\b/, "Chocolates"],
  [/\b(doce de leite|leite condensado|creme de leite|leites?|manteiga|margarina|queijos?|requeijao|cream cheese|iogurtes?|chantilly|chantininho|nata|ovos?|claras?|gemas?|mucarela|mussarela)\b/, "Laticínios e ovos"],
  [/\b(coco ralado|coco em flocos|farinhas?|acucar(es)?|fermento|amido|maisena|fuba|aveia|sal|bicarbonato|polvilho|castanhas?|nozes|amendoim|amendoas?|pistache|oleos?|gordura|granola|trigo|glucose|mel|essencias?|extratos?|aromas?|gelatina|po royal|uvas? passas?)\b/, "Secos"],
  [/\b(morangos?|limao|limoes|maracuja|pessegos?|frutas?|bananas?|abacaxis?|cocos?|uvas?|cerejas?|kiwis?|mangas?|laranjas?|macas?|ameixas?|framboesas?|mirtilos?|amoras?|polpas?|goiabas?)\b/, "Frutas"],
  [/\b(frango|carnes?|presunto|calabresa|bacon|linguicas?|peito de peru|atum|salsichas?|salame|lombo|camarao)\b/, "Carnes e frios"],
  [/\b(refrigerantes?|sucos?|aguas?|cafe|cha|vinhos?|cervejas?|licor|rum|conhaque|energeticos?)\b/, "Bebidas"],
];

export function categoriaPeloNome(nome: string): CategoriaInsumo | null {
  const n = sem(nome);
  if (n.trim().length < 3) return null;
  for (const [re, c] of REGRAS) if (re.test(n)) return c;
  return null;
}

/** categoria salva antes da lista única → a da lista (pelo nome quando a antiga não diz) */
export function normalizarCategoria(cat: string | null | undefined, nome = ""): CategoriaInsumo | "" {
  const c = (cat || "").trim();
  if ((CATEGORIAS_INSUMO as readonly string[]).includes(c)) return c as CategoriaInsumo;
  if (c === "Laticínios" || c === "Refrigerados") return "Laticínios e ovos";
  if (c === "Salgados") return "Carnes e frios";
  return categoriaPeloNome(nome) || (c ? "Outros" : "");
}

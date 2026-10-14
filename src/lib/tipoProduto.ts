/**
 * (14/10) O tipo do produto agora sai do nome (e da categoria): a tela "Que tipo de produto?" saiu.
 * Serve pra sugerir a categoria, as escolhas, os sabores e se o bolo começa por kg.
 */
export type TipoProduto = "bolos" | "doces" | "salgados" | "sobremesas" | "kitfesta";

const norm = (x: string) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// a ordem importa: "kit festa" antes de bolo; "bolo no pote" é bolo; "torta salgada" é salgado
const REGRAS: [TipoProduto, RegExp][] = [
  ["kitfesta", /\bkit\b|\bcombo\b/],
  ["salgados", /salgad|coxinha|kibe|quibe|esfiha|esfirra|empad|pastel|risol|enroladinho|bolinha de queijo|croquete|mini pizza|torta salgada/],
  ["bolos", /\bbolo|naked|red velvet/],
  ["sobremesas", /pudi|torta|mousse|pave|cheesecake|sobremesa|\bpote\b|mil folhas|banoffee|tiramisu/],
  ["doces", /brigadeir|docinho|\bdoce|bombo|trufa|beijinho|cajuzinho|brownie|cookie|macar|marrac|bem casado|pao de mel|alfajor/],
];

/** Tipo pelo nome (e categoria). Nome que não diz nada vira "doces". Vazio: null. */
export function tipoPeloNome(nome: string, categoria = ""): TipoProduto | null {
  const n = norm(nome);
  if (!n.trim()) return null;
  for (const [t, re] of REGRAS) if (re.test(n)) return t;
  const c = norm(categoria);
  for (const [t, re] of REGRAS) if (re.test(c)) return t;
  return "doces";
}

/** Palavras pra achar uma categoria da confeiteira que já é desse tipo (ex.: "Pudins" é sobremesa) */
export const PALAVRAS_CATEGORIA: Record<TipoProduto, RegExp> = {
  bolos: /bolo/, doces: /doce|docinho|brigadeiro|bombo/, salgados: /salgad/,
  sobremesas: /sobremesa|pudi|torta|pote|mousse/, kitfesta: /kit|combo|festa/,
};

/** Categoria padrão de cada tipo (criada na hora se a conta não tiver) */
export const CATEGORIA_PADRAO: Record<TipoProduto, { nome: string; icone: number }> = {
  bolos: { nome: "Bolos", icone: 6 }, doces: { nome: "Doces", icone: 1 }, salgados: { nome: "Salgados", icone: 3 },
  sobremesas: { nome: "Sobremesas", icone: 10 }, kitfesta: { nome: "Kit festa", icone: 28 },
};

/** A categoria a sugerir: uma da confeiteira que combine, ou a padrão do tipo */
export function categoriaSugerida(nome: string, categorias: string[]): { nome: string; existe: boolean; icone: number } | null {
  const t = tipoPeloNome(nome);
  if (!t) return null;
  const dela = categorias.find(c => PALAVRAS_CATEGORIA[t].test(norm(c)));
  if (dela) return { nome: dela, existe: true, icone: 0 };
  const p = CATEGORIA_PADRAO[t];
  return { nome: p.nome, existe: categorias.some(c => norm(c) === norm(p.nome)), icone: p.icone };
}

export const ehBoloNoPote = (nome: string) => /\bpote\b/.test(norm(nome));

/**
 * Forma de venda do produto — lista ÚNICA usada no cardápio do cliente (02/10).
 * Antes cada tela tinha a sua lista e nenhuma conhecia "caixa": o produto vendido por
 * caixa aparecia pro cliente como "/un" e "Unidade".
 */
const SUFIXO: Record<string, string> = {
  unidade: "un", tamanho: "un", outros: "un",
  fatia: "fatia", kg: "kg", cento: "cento",
  caixa: "caixa", "kit-caixa": "caixa", "kit-festa": "kit", kit: "kit",
};
const ETIQUETA: Record<string, string> = {
  unidade: "Unidade", tamanho: "Unidade", outros: "Unidade",
  fatia: "Fatia", kg: "KG", cento: "Cento",
  caixa: "Caixa", "kit-caixa": "Caixa", "kit-festa": "Kit festa", kit: "Kit",
  "sob-encomenda": "Encomenda", "tamanho-p": "P", "tamanho-m": "M", "tamanho-g": "G", "tamanho-xg": "XG",
};
const CURTA: Record<string, string> = {
  unidade: "UN", tamanho: "UN", outros: "UN",
  fatia: "FATIA", kg: "KG", cento: "100",
  caixa: "CAIXA", "kit-caixa": "CAIXA", "kit-festa": "KIT", kit: "KIT",
  "sob-encomenda": "Enc", "tamanho-p": "P", "tamanho-m": "M", "tamanho-g": "G", "tamanho-xg": "XG",
};

/** "/un", "/caixa", "/kg"… sem a barra: un, caixa, kg */
export const sufixoVenda = (fv?: string | null) => SUFIXO[String(fv || "")] || "un";
/** Etiqueta por extenso: Unidade, Caixa, KG, Fatia… */
export const etiquetaVenda = (fv?: string | null) => ETIQUETA[String(fv || "")] || "Unidade";
/** Etiqueta curta (cartão do computador): UN, CAIXA, KG… */
export const etiquetaCurtaVenda = (fv?: string | null) => CURTA[String(fv || "")] || "UN";
/** Texto do preço: "Preço da caixa", "Preço do quilo", "Preço unitário"… */
export const rotuloPrecoVenda = (fv?: string | null) => {
  const s = sufixoVenda(fv);
  return s === "caixa" ? "Preço da caixa" : s === "kg" ? "Preço do quilo" : s === "fatia" ? "Preço da fatia" : s === "cento" ? "Preço do cento" : s === "kit" ? "Preço do kit" : "Preço unitário";
};

/** Unidade do preço pro cliente (08/10): "por kg", "o cento", "a caixa", "a unidade"… */
export const unidadeCliente = (fv?: string | null) => ({ un: "a unidade", fatia: "a fatia", kg: "por kg", cento: "o cento", caixa: "a caixa", kit: "o kit" } as Record<string, string>)[sufixoVenda(fv)] || "a unidade";

/**
 * (18/10) Cores do cardápio público: só três, todas no topo da loja.
 *  · Borda da logo (cor_borda)
 *  · Nome da loja (cor_nome)
 *  · Faixa do topo (cor_navbar): atrás da logo, no lugar da foto do topo; no computador, a barra de cima.
 * Botões, ícones, "Sobre a loja" e o resto ficam sempre no rosa do Doonly.
 * Grátis: escolhe entre as cores prontas de cada uma. PRO: qualquer cor.
 * cor_botao, cor_background, cor_sacola e cor_rodape não são mais usadas (ficam no banco).
 */
export type CampoCor = "cor_borda" | "cor_nome" | "cor_navbar";

export const COR_BOTOES = "#EC4899";

export const PADRAO: Record<CampoCor, string> = { cor_borda: "#EC4899", cor_nome: "#2C1219", cor_navbar: "#BF6B84" };

export const PRONTAS: Record<CampoCor, { nome: string; cor: string }[]> = {
  cor_borda: [
    { nome: "Rosa", cor: "#EC4899" }, { nome: "Roxo", cor: "#7C3AED" }, { nome: "Azul", cor: "#2563EB" },
    { nome: "Verde", cor: "#16A34A" }, { nome: "Laranja", cor: "#EA580C" }, { nome: "Chocolate", cor: "#7B4A36" },
  ],
  cor_nome: [
    { nome: "Chocolate", cor: "#2C1219" }, { nome: "Preto", cor: "#111111" }, { nome: "Rosa", cor: "#BE185D" },
    { nome: "Roxo", cor: "#6D28D9" }, { nome: "Azul", cor: "#1D4ED8" }, { nome: "Verde", cor: "#15803D" },
  ],
  cor_navbar: [
    { nome: "Rosa antigo", cor: "#BF6B84" }, { nome: "Rosa", cor: "#EC4899" }, { nome: "Roxo", cor: "#7C3AED" },
    { nome: "Azul", cor: "#2563EB" }, { nome: "Verde", cor: "#16A34A" }, { nome: "Chocolate", cor: "#7B4A36" },
  ],
};

const hex6 = (c?: string | null) => (c && /^#[0-9a-fA-F]{6}$/.test(c.trim()) ? c.trim().toUpperCase() : null);

/** A cor que vale no cardápio: PRO usa a que escolheu; grátis só se for uma das prontas daquele item. */
export function corDoItem(campo: CampoCor, salva: string | null | undefined, isPro: boolean): string {
  const h = hex6(salva);
  if (h && (isPro || PRONTAS[campo].some(p => p.cor === h))) return h;
  return PADRAO[campo];
}

const lum = (c: string) => { const h = hex6(c); if (!h) return 0; const n = parseInt(h.slice(1), 16); return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
/** Cor clara? (pra decidir se o texto em cima é escuro ou branco) */
export const corClara = (c: string) => lum(c) > 170;
/** O nome em cima do topo (computador): a cor escolhida se der pra ler; senão branco ou chocolate. */
export function nomeSobreTopo(nome: string, topo: string): string {
  return Math.abs(lum(nome) - lum(topo)) >= 90 ? nome : (corClara(topo) ? "#2C1219" : "#FFFFFF");
}

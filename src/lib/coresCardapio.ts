/**
 * (18/10) Cores do cardápio público, simplificadas pra duas:
 *  · cor principal (cor_botao): botões, ícones, categoria ativa e o anel da logo, no celular e no computador;
 *  · cor do topo (cor_navbar): faixa de cima no celular (sem foto do topo), barra do computador e topo do "Sobre a loja".
 * O nome da loja é automático (escuro no celular, branco ou escuro no computador conforme o topo).
 * Grátis: escolhe a principal entre as cores prontas. PRO: qualquer cor na principal e no topo.
 * cor_borda, cor_nome, cor_background, cor_sacola e cor_rodape não são mais usadas (ficam no banco).
 */
export const COR_PRINCIPAL_PADRAO = "#EC4899";
export const COR_TOPO_PADRAO = "#BF6B84";

export const CORES_PRONTAS: { nome: string; cor: string }[] = [
  { nome: "Rosa", cor: "#EC4899" },
  { nome: "Roxo", cor: "#7C3AED" },
  { nome: "Azul", cor: "#2563EB" },
  { nome: "Verde", cor: "#16A34A" },
  { nome: "Laranja", cor: "#EA580C" },
  { nome: "Chocolate", cor: "#7B4A36" },
];

const hex6 = (c?: string | null) => (c && /^#[0-9a-fA-F]{6}$/.test(c.trim()) ? c.trim().toUpperCase() : null);
export const ehCorPronta = (c?: string | null) => { const h = hex6(c); return !!h && CORES_PRONTAS.some(p => p.cor === h); };

/** Cor principal que vale no cardápio: PRO usa a que escolheu; grátis só se for uma das prontas. */
export function corPrincipal(salva: string | null | undefined, isPro: boolean): string {
  const h = hex6(salva);
  if (h && (isPro || ehCorPronta(h))) return h;
  return COR_PRINCIPAL_PADRAO;
}
/** Cor do topo: só PRO escolhe. */
export function corTopo(salva: string | null | undefined, isPro: boolean): string {
  const h = hex6(salva);
  return isPro && h && h !== "#FFFFFF" ? h : COR_TOPO_PADRAO;
}
/** Cor clara? (pra decidir se o texto em cima é escuro ou branco) */
export function corClara(c: string): boolean {
  const h = hex6(c); if (!h) return false;
  const n = parseInt(h.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 170;
}

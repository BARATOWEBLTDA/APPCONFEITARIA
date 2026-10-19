/**
 * (18/10) Temas do cardápio público. Por enquanto: 'normal' e 'natal'.
 * O tema é uma "roupa" por cima do Clássico: muda o topo (faixa, borda da logo, nome), põe a touquinha na logo,
 * o aviso de temporada, um enfeite nos produtos e uma animação no "Pedido enviado".
 * Com "ligar sozinho", o tema só vale entre tema_inicio e tema_fim (fora disso, Normal).
 */
export type Tema = "normal" | "natal";

export const AVISO_NATAL_PADRAO = "Encomendas de Natal até 20/12";
/** (19/10) imagem da capa que vem com o tema (a confeitaria pode trocar pela dela ou por outra da biblioteca) */
export const CAPA_NATAL_PADRAO = "/banners/galeria/capa-natal-panetone-gotas-2.webp";

/** Cores do Natal (bordô, dourado e creme; vermelho fechado, que não cansa a vista). */
export const NATAL = { topo: "#6E1F27", borda: "#C9A227", nome: "#8B2332", aviso: "#7A5A06", avisoFundo: "#FBF3DB" };

const hojeISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** O tema que vale hoje pra este perfil. */
export function temaAtivo(p: { tema_cardapio?: string | null; tema_auto?: boolean | null; tema_inicio?: string | null; tema_fim?: string | null } | null | undefined, hoje = new Date()): Tema {
  if (!p || p.tema_cardapio !== "natal") return "normal";
  if (!p.tema_auto) return "natal";
  const h = hojeISO(hoje);
  const ini = (p.tema_inicio || "").slice(0, 10), fim = (p.tema_fim || "").slice(0, 10);
  if (ini && h < ini) return "normal";
  if (fim && h > fim) return "normal";
  return "natal";
}

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

/** O tema que vale hoje. (30/10 · 5.46) o tema de Natal saiu do app: o cardápio fica sempre nas cores da loja (mesmo quem tinha escolhido o Natal) */
export function temaAtivo(_p?: { tema_cardapio?: string | null } | null, _hoje?: Date): Tema {
  return "normal";
}

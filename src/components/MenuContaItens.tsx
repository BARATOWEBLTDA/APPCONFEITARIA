/**
 * (07/10 · 2.98) Os itens do menu da foto foram pro MenuConta.tsx, que agora é um só pro app inteiro.
 * Aqui ficou só o atalho que abre o chat do Doo IA, usado em várias telas.
 */

/** Abre o chat do Doo IA (o mesmo do menu de baixo). (21/10) com texto: a Doo abre já mandando o pedido */
let pedidoDoo = "";
export function abrirDooIA(texto?: string) { pedidoDoo = texto || ""; window.dispatchEvent(new CustomEvent("doonly:abrir-doo")); }
/** O pedido que veio junto com o "abrir" (some depois de lido) */
export function pegarPedidoDoo(): string { const t = pedidoDoo; pedidoDoo = ""; return t; }

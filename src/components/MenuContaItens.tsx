/**
 * (07/10 · 2.98) Os itens do menu da foto foram pro MenuConta.tsx, que agora é um só pro app inteiro.
 * Aqui ficou só o atalho que abre o chat do Doo IA, usado em várias telas.
 */

/** Abre o chat do Doo IA (o mesmo do menu de baixo) */
export function abrirDooIA() { window.dispatchEvent(new CustomEvent("doonly:abrir-doo")); }

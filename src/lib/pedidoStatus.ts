/**
 * Regra ÚNICA de "pedido atrasado" (02/10) — usada no Início, em "Suas atualizações", na Agenda e em Pedidos.
 * Atrasado = a data de entrega já passou E o pedido ainda NÃO ficou pronto.
 * Pedido pronto, saindo pra entrega, entregue ou cancelado não está atrasado.
 */
export const STATUS_AINDA_NAO_PRONTO = [
  "aguardando_pagamento", "aguardando_aceite", "novo", "pendente",
  "agendado", "confirmado", "em_producao", "em_preparo",
];

/** Data de hoje no horário do Brasil (AAAA-MM-DD). */
export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function pedidoAtrasado(p: { data_entrega?: string | null; status?: string | null }, hoje = hojeISO()): boolean {
  if (!p?.data_entrega) return false;
  return p.data_entrega.slice(0, 10) < hoje && STATUS_AINDA_NAO_PRONTO.includes(String(p.status || "agendado"));
}

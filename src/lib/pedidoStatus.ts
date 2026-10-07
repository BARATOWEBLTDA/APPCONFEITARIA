/**
 * Regra ÚNICA de "pedido atrasado" (02/10) — usada no Início, em "Suas atualizações", na Agenda e em Pedidos.
 * Atrasado = a data de entrega já passou E o pedido ainda NÃO ficou pronto.
 * Pedido pronto, saindo pra entrega, entregue ou cancelado não está atrasado.
 */
export const STATUS_AINDA_NAO_PRONTO = [
  "aguardando_pagamento", "aguardando_aceite", "novo", "pendente",
  "agendado", "confirmado", "em_producao", "em_preparo",
];

/**
 * Uma data no formato AAAA-MM-DD, no horário do aparelho (o do Brasil).
 * Nunca use toISOString().slice(0, 10) pra isso: ele converte pro horário de Londres e, depois das 21h, já devolve o dia seguinte.
 */
export function dataISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Data de hoje no horário do Brasil (AAAA-MM-DD). */
export function hojeISO(): string {
  return dataISO(new Date());
}

export function pedidoAtrasado(p: { data_entrega?: string | null; status?: string | null }, hoje = hojeISO()): boolean {
  if (!p?.data_entrega) return false;
  return p.data_entrega.slice(0, 10) < hoje && STATUS_AINDA_NAO_PRONTO.includes(String(p.status || "agendado"));
}

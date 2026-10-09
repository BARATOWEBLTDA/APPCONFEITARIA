import { supabase } from "@/lib/supabase";

/**
 * Histórico das etapas do pedido (09/10). Toda mudança de situação grava a data e a hora,
 * pra o "Acompanhar pedido" mostrar quando cada etapa aconteceu — de qualquer tela que mudou
 * (lista de Pedidos, Agenda, Finalizar pedido, tela do pedido). Silencioso: não trava a tela se falhar.
 */
const ROTULO: Record<string, string> = {
  aguardando_pagamento: "Aguardando Pagamento",
  aguardando_aceite: "Aguardando Aceite",
  agendado: "Agendado",
  em_producao: "Em Produção",
  finalizado: "Finalizado",
  aguardando_retirada: "Aguardando Retirada",
  em_entrega: "Em Entrega",
  entregue: "Entregue",
  cancelado: "Pedido cancelado",
};

export function registrarEtapa(pedidoId: string, status: string, detalhe?: string) {
  const evento = ROTULO[status] || status;
  return supabase.from("pedido_historico")
    .insert({ pedido_id: pedidoId, evento, descricao: detalhe || `Status alterado para "${evento}"` })
    .then(() => {}, () => {});
}

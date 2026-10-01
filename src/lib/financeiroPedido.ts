/**
 * Quanto de um pedido já entrou no caixa (30/09).
 * Antes o Financeiro só contava pedido marcado como "pago" — e os pedidos do cardápio nunca recebem essa
 * marca (passam de aceito → produção → entregue sem perguntar), então ficavam todos fora do faturamento.
 *   · cancelado / estornado ............ 0
 *   · pago ............................. valor total
 *   · parcial (sinal) .................. o que foi recebido
 *   · pendente (fiado) ................. 0
 *   · sem marca + já entregue/concluído  valor total (pago na entrega/retirada)
 */
const STATUS_CONCLUIDOS = ["entregue", "concluido"];

export function valorRecebidoPedido(p: { status?: string | null; status_pagamento?: string | null; valor_total?: any; valor_recebido?: any }): number {
  const total = Number(p.valor_total) || 0;
  if (p.status === "cancelado" || p.status_pagamento === "estornado") return 0;
  if (p.status_pagamento === "pago") return total;
  if (p.status_pagamento === "parcial") return Math.min(total, Number(p.valor_recebido) || 0);
  if (p.status_pagamento === "pendente") return 0;
  return STATUS_CONCLUIDOS.includes(String(p.status || "")) ? total : 0;
}

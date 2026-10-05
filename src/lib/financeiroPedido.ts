/**
 * Quanto de um pedido já entrou no caixa.
 *   · cancelado / estornado ............ 0
 *   · pago ............................. valor total
 *   · parcial (sinal) .................. o que foi recebido
 *   · pendente (fiado, cardápio) ....... 0 — até ela registrar o pagamento
 *   · sem marca + já entregue/concluído  valor total (só pedidos antigos, de antes da situação existir)
 *
 * Financeiro · Passo 0 (03/10): os pedidos do cardápio nascem "pendente". Agora, ao marcar como
 * Entregue com saldo, o app pergunta quanto entrou (Pedidos.tsx); o parcial soma com o que já tinha.
 * Pendente de propósito: no Passo 1, cada recebimento vira uma linha em "pagamentos" (com data e forma)
 * e esta função passa a somar essas linhas, em vez de ler um número só do pedido.
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

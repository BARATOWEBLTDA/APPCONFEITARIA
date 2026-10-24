import { avisar, type IconeAviso } from "@/components/base";
import { nomeDaSituacao, nomeDeGente } from "@/components/pedidos/pedidoTexto";

/**
 * (24/10) Aviso de quando o pedido muda de situação, no cartão novo:
 * em cima o que aconteceu ("Em produção"), embaixo qual pedido e de quem ("Pedido #57 · Maria Teste"),
 * o ícone com a cor da ação e, quando dá, "Desfazer" (volta para a situação anterior) ou "Ver" (abre o pedido).
 */
type PedidoAviso = { numero?: number | string | null; tipo_entrega?: string | null; cliente_nome?: string | null };

const O_QUE: Record<string, { texto: string; icone: IconeAviso }> = {
  agendado: { texto: "Pedido aceito", icone: "aceito" },
  em_producao: { texto: "Em produção", icone: "producao" },
  finalizado: { texto: "Pronto", icone: "pronto" },
  aguardando_retirada: { texto: "Pronto para retirar", icone: "pronto" },
  em_entrega: { texto: "Saiu para entrega", icone: "entrega" },
  entregue: { texto: "Entregue", icone: "entregue" },
  cancelado: { texto: "Pedido cancelado", icone: "cancelado" },
};

export function avisoDaSituacao(p: PedidoAviso, status: string, pago = false) {
  const nome = p.cliente_nome ? nomeDeGente(p.cliente_nome) : "";
  const detalhe = [`Pedido #${p.numero ?? ""}`, nome].filter(Boolean).join(" · ");
  if (pago) return { texto: "Pagamento registrado", detalhe, icone: "pago" as IconeAviso };
  const o = O_QUE[status];
  const texto = status === "entregue" && p.tipo_entrega === "retirada" ? "Retirado" : o?.texto || nomeDaSituacao(status);
  return { texto, detalhe, icone: (o?.icone || "aceito") as IconeAviso };
}

export function avisarMudanca(p: PedidoAviso, status: string, opc: { pago?: boolean; desfazer?: () => void; ver?: () => void } = {}) {
  const a = avisoDaSituacao(p, status, opc.pago);
  const acao = opc.desfazer ? { rotulo: "Desfazer", aoTocar: opc.desfazer } : opc.ver ? { rotulo: "Ver", aoTocar: opc.ver } : undefined;
  avisar(a.texto, { detalhe: a.detalhe, icone: a.icone, acao, duracao: 5000 });
}

/** Depois de desfazer: "Pedido #57 voltou para Agendado." */
export function avisarDesfeito(p: PedidoAviso, statusAnterior: string) {
  avisar(`Voltou para ${nomeDaSituacao(statusAnterior)}`, { detalhe: `Pedido #${p.numero ?? ""}`, tipo: "info" });
}

import { CheckCircle, Copy, FilePdf, PencilSimple, Trash } from '@phosphor-icons/react'
import IconeWhatsApp from '@/components/IconeWhatsApp'
import { MenuMais, type ItemMenuMais } from '@/components/base'
import type { Pedido } from './pedidoTexto'
import { pixDoPedido, rs, temTelefone } from './pedidoTexto'

/**
 * "Mais ações" do pedido (08/10 · 3.11). (31/10 · 5.84) No padrão MenuMais: o ⋮ abre o menu colado no botão,
 * igual ao resto do app (antes abria uma janela de baixo).
 */
export type AcaoMenu = 'confirmar_pix' | 'editar' | 'duplicar' | 'contatar' | 'compartilhar' | 'pdf' | 'excluir'

const Zap = ({ size }: { size?: number }) => <IconeWhatsApp size={size} />

export function itensMenuPedido(p: Pedido, aoEscolher: (p: Pedido, acao: AcaoMenu) => void): ItemMenuMais[] {
  const px = pixDoPedido(p)
  const vai = (acao: AcaoMenu) => () => aoEscolher(p, acao)
  return [
    ...(px?.estado === 'conferir' ? [{ Ic: CheckCircle, t: `Confirmar Pix de ${rs(px.valor)}`, sub: 'O cliente já pagou pelo cardápio', aoTocar: vai('confirmar_pix') }] : []),
    { Ic: PencilSimple, t: 'Editar pedido', sub: 'Itens, data e pagamento', aoTocar: vai('editar') },
    { Ic: Copy, t: 'Duplicar pedido', sub: 'Um igual, para outra data', aoTocar: vai('duplicar') },
    ...(temTelefone(p) ? [{ Ic: Zap, t: 'Chamar no WhatsApp', sub: 'Abre a conversa com o cliente', aoTocar: vai('contatar') }] : []),
    { Ic: Zap, t: 'Enviar resumo do pedido', sub: 'O pedido escrito no WhatsApp', aoTocar: vai('compartilhar') },
    { Ic: FilePdf, t: 'Baixar PDF', sub: 'Para imprimir ou mandar', aoTocar: vai('pdf') },
    { Ic: Trash, t: 'Excluir pedido', sub: 'Apaga de vez', perigo: true, aoTocar: vai('excluir') },
  ]
}

export default function MenuPedido({ p, aoEscolher, className }: { p: Pedido; aoEscolher: (p: Pedido, acao: AcaoMenu) => void; className?: string }) {
  return <MenuMais rotulo={`Mais ações do pedido #${p.numero || ''}`} className={className} itens={itensMenuPedido(p, aoEscolher)} />
}

import { useRef } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle, Copy, FilePdf, PencilSimple, Trash } from '@phosphor-icons/react'
import IconeWhatsApp from '@/components/IconeWhatsApp'
import { Janela } from '@/components/base'
import type { Pedido } from './pedidoTexto'
import { nomeCliente, pixDoPedido, rs, temTelefone } from './pedidoTexto'

/**
 * "Mais ações" do pedido (08/10 · 3.11): a janela padrão do app (no celular sobe de baixo).
 * Antes era uma gaveta própria, com "Editar Pedido" e companhia em maiúsculas.
 * Quem escolhe faz a ação e depois fecha a janela (assim o "voltar" do Android não se perde).
 */
export type AcaoMenu = 'confirmar_pix' | 'editar' | 'duplicar' | 'contatar' | 'compartilhar' | 'pdf' | 'excluir'

type Props = { p: Pedido | null; aoFechar: () => void; aoEscolher: (p: Pedido, acao: AcaoMenu) => void }

export default function MenuPedido({ p: atual, aoFechar, aoEscolher }: Props) {
  // guarda o último pedido pra janela não ficar vazia enquanto faz o movimento de fechar
  const ultimo = useRef<Pedido | null>(null)
  if (atual) ultimo.current = atual
  const p = atual || ultimo.current
  // "Chamar no WhatsApp" e "Enviar resumo" abrem o WhatsApp: os dois com o logo oficial (IconeWhatsApp)
  const px = p ? pixDoPedido(p) : null
  const itens: [AcaoMenu, string, ReactNode][] = [
    ...(px?.estado === 'conferir' ? [['confirmar_pix', `Confirmar Pix de ${rs(px.valor)}`, <CheckCircle size={20} weight="bold" />] as [AcaoMenu, string, ReactNode]] : []),
    ['editar', 'Editar pedido', <PencilSimple size={20} weight="bold" />],
    ['duplicar', 'Duplicar pedido', <Copy size={20} weight="bold" />],
    ...(p && temTelefone(p) ? [['contatar', 'Chamar no WhatsApp', <IconeWhatsApp size={20} />] as [AcaoMenu, string, ReactNode]] : []),
    ['compartilhar', 'Enviar resumo do pedido', <IconeWhatsApp size={20} />],
    ['pdf', 'Baixar PDF', <FilePdf size={20} weight="bold" />],
  ]
  return (
    <Janela aberta={!!atual} aoFechar={aoFechar} tipo="conteudo" titulo={p ? `Pedido #${p.numero || ''}` : ''}>
      {p && (
        <>
          <p className="pdm-quem">{nomeCliente(p)}</p>
          <div className="pdm">
            {itens.map(([acao, nome, ic]) => (
              <button key={acao} type="button" className="pdm-it" onClick={() => aoEscolher(p, acao)}>
                <span className="pdm-ic" aria-hidden="true">{ic}</span><span>{nome}</span>
              </button>
            ))}
            <button type="button" className="pdm-it pdm-it--excluir" onClick={() => aoEscolher(p, 'excluir')}>
              <span className="pdm-ic" aria-hidden="true"><Trash size={20} weight="bold" /></span><span>Excluir pedido</span>
            </button>
          </div>
        </>
      )}
    </Janela>
  )
}

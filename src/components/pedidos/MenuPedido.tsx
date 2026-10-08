import { useRef } from 'react'
import { Copy, FilePdf, PencilSimple, ShareNetwork, Trash, WhatsappLogo } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { Janela } from '@/components/base'
import type { Pedido } from './pedidoTexto'
import { nomeCliente, temTelefone } from './pedidoTexto'

/**
 * "Mais ações" do pedido (08/10 · 3.11): a janela padrão do app (no celular sobe de baixo).
 * Antes era uma gaveta própria, com "Editar Pedido" e companhia em maiúsculas.
 * Quem escolhe faz a ação e depois fecha a janela (assim o "voltar" do Android não se perde).
 */
export type AcaoMenu = 'editar' | 'duplicar' | 'contatar' | 'compartilhar' | 'pdf' | 'excluir'

type Props = { p: Pedido | null; aoFechar: () => void; aoEscolher: (p: Pedido, acao: AcaoMenu) => void }

export default function MenuPedido({ p: atual, aoFechar, aoEscolher }: Props) {
  // guarda o último pedido pra janela não ficar vazia enquanto faz o movimento de fechar
  const ultimo = useRef<Pedido | null>(null)
  if (atual) ultimo.current = atual
  const p = atual || ultimo.current
  const itens: [AcaoMenu, string, Icon][] = [
    ['editar', 'Editar pedido', PencilSimple],
    ['duplicar', 'Duplicar pedido', Copy],
    ...(p && temTelefone(p) ? [['contatar', 'Chamar no WhatsApp', WhatsappLogo] as [AcaoMenu, string, Icon]] : []),
    ['compartilhar', 'Enviar resumo do pedido', ShareNetwork],
    ['pdf', 'Baixar PDF', FilePdf],
  ]
  return (
    <Janela aberta={!!atual} aoFechar={aoFechar} tipo="conteudo" titulo={p ? `Pedido #${p.numero || ''}` : ''}>
      {p && (
        <>
          <p className="pdm-quem">{nomeCliente(p)}</p>
          <div className="pdm">
            {itens.map(([acao, nome, Ic]) => (
              <button key={acao} type="button" className="pdm-it" onClick={() => aoEscolher(p, acao)}>
                <span className="pdm-ic" aria-hidden="true"><Ic size={20} weight="bold" /></span><span>{nome}</span>
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

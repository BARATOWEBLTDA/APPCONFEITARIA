import { useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import { BotaoIcone } from './Botao'
import { Titulo } from './Titulo'
import { useFase, useSobreposicao } from './useSobreposicao'
import './base.css'

/**
 * Gaveta do Doonly (07/10 · guia v2): entra pela direita e ocupa a altura toda.
 * Pra filtros e opções: o miolo rola, o título e os botões de baixo ficam parados.
 * Fecha no X, tocando fora, no Esc e no "voltar" do Android. A tela de trás não rola.
 */
type PropsGaveta = {
  aberta: boolean
  aoFechar: () => void
  titulo: string
  children: ReactNode
  /** os botões fixos de baixo: o último é o principal e ocupa o espaço que sobra */
  rodape?: ReactNode
}

export function Gaveta({ aberta, aoFechar, titulo, children, rodape }: PropsGaveta) {
  const caixa = useRef<HTMLDivElement>(null)
  const idTitulo = useId()
  const fase = useFase(aberta)
  useSobreposicao(aberta, aoFechar, caixa)
  if (!aberta && fase === 'fechada') return null
  return createPortal(
    <div className={`ui-veu ui-veu--gaveta${aberta ? '' : ' ui-veu--saindo'}`} onClick={aoFechar}>
      <div ref={caixa} tabIndex={-1} className="ui-gaveta" role="dialog" aria-modal="true" aria-labelledby={idTitulo} onClick={e => e.stopPropagation()}>
        <div className="ui-gaveta-cab">
          <Titulo nivel="janela" id={idTitulo}>{titulo}</Titulo>
          <BotaoIcone rotulo="Fechar" onClick={aoFechar}><X size={20} weight="bold" /></BotaoIcone>
        </div>
        <div className="ui-gaveta-corpo">{children}</div>
        {rodape ? <div className="ui-gaveta-pe">{rodape}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

import type { ReactNode } from 'react'
import './base.css'

/**
 * Título do Doonly (07/10 · guia v2, A2).
 *   nivel: tela (22px) · janela (18px) · secao (16px)
 *   contagem: o número no quadradinho ("Hoje  4")
 *   apoio: uma frase embaixo · acao: o que fica à direita ("+ Adicionar")
 * Nunca quebra linha: título comprido corta com "…".
 */
type PropsTitulo = {
  children: ReactNode
  nivel?: 'tela' | 'janela' | 'secao'
  contagem?: number
  apoio?: ReactNode
  acao?: ReactNode
  /** vermelho só pra "Atrasado" */
  tom?: 'vermelho'
  id?: string
  className?: string
}

export function Titulo({ children, nivel = 'secao', contagem, apoio, acao, tom, id, className = '' }: PropsTitulo) {
  const Marca = nivel === 'tela' ? 'h1' : nivel === 'janela' ? 'h2' : 'h3'
  const classes = ['ui-tit', `ui-tit--${nivel}`, tom ? `ui-tit--${tom}` : '', className].filter(Boolean).join(' ')
  return (
    <div className={classes}>
      <div className="ui-tit-t">
        <div className="ui-tit-l">
          <Marca className="ui-tit-h" id={id}>{children}</Marca>
          {typeof contagem === 'number' ? <i className="ui-tit-n">{contagem}</i> : null}
        </div>
        {apoio ? <p className="ui-tit-a">{apoio}</p> : null}
      </div>
      {acao ? <div className="ui-tit-acao">{acao}</div> : null}
    </div>
  )
}

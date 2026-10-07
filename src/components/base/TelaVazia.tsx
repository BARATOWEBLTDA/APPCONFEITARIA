import type { ReactNode } from 'react'
import './base.css'

/**
 * Tela vazia do Doonly (07/10 · guia v2, A11).
 * Diz o que houve, o que fazer e traz o botão. Nunca parece tela quebrada.
 *   icone: Phosphor de 30px, peso regular
 *   acao: o <Botao> (quando faz sentido ter)
 *   caixa: com a borda tracejada (dentro de uma página que já tem fundo)
 */
type PropsTelaVazia = {
  icone: ReactNode
  titulo: string
  texto?: string
  acao?: ReactNode
  caixa?: boolean
  compacta?: boolean
  className?: string
}

export function TelaVazia({ icone, titulo, texto, acao, caixa = false, compacta = false, className = '' }: PropsTelaVazia) {
  const classes = ['ui-vazia', caixa ? 'ui-vazia--caixa' : '', compacta ? 'ui-vazia--compacta' : '', className].filter(Boolean).join(' ')
  return (
    <div className={classes}>
      <span className="ui-vazia-ic" aria-hidden="true">{icone}</span>
      <p className="ui-vazia-t">{titulo}</p>
      {texto ? <p className="ui-vazia-x">{texto}</p> : null}
      {acao ? <div className="ui-vazia-acao">{acao}</div> : null}
    </div>
  )
}

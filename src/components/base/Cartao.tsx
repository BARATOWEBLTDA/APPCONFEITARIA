import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react'
import './base.css'

/**
 * Cartão do Doonly (07/10 · guia v2, A12).
 *   aoTocar: o cartão inteiro vira tocável (com teclado e foco)
 *   espaco: normal (16px) · compacto (12px) · sem (a foto encosta na borda)
 */
type PropsCartao = Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> & {
  children: ReactNode
  aoTocar?: () => void
  espaco?: 'normal' | 'compacto' | 'sem'
}

export function Cartao({ children, aoTocar, espaco = 'normal', className = '', ...resto }: PropsCartao) {
  const classes = ['ui-cartao', espaco !== 'normal' ? `ui-cartao--${espaco}` : '', aoTocar ? 'ui-cartao--toca' : '', className].filter(Boolean).join(' ')
  if (!aoTocar) return <div className={classes} {...resto}>{children}</div>
  const tecla = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return // Enter num botão de dentro é do botão
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aoTocar() }
  }
  return <div className={classes} role="button" tabIndex={0} onClick={aoTocar} onKeyDown={tecla} {...resto}>{children}</div>
}

/**
 * Linha de rótulo + texto ("Situação: Agendado"), no lugar de etiqueta.
 * A cor só reforça: a informação está sempre escrita.
 */
type PropsLinha = { rotulo: string; children: ReactNode; tom?: 'azul' | 'laranja' | 'verde' | 'vermelho' | 'rosa' }

export function Linha({ rotulo, children, tom }: PropsLinha) {
  return <p className={`ui-linha${tom ? ` ui-linha--${tom}` : ''}`}><span>{rotulo}:</span><b>{children}</b></p>
}

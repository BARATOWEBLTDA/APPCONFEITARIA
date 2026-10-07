import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'
import './base.css'

/**
 * Botão do Doonly (07/10 · guia v2, A6).
 *   variante: principal (rosa) · secundario (cinza) · suave (rosa clarinho) · vinho · perigo (vermelho) · link
 *   tamanho: g = 48px (padrão) · m = 44px · p = 36px (com área de toque de 44px)
 *   carregando: mostra a rodinha e ignora novos toques (nada é salvo duas vezes)
 * O texto diz o que o botão faz: "Salvar pedido", nunca "OK".
 */
export type VarianteBotao = 'principal' | 'secundario' | 'suave' | 'vinho' | 'perigo' | 'link'
export type TamanhoBotao = 'g' | 'm' | 'p'

type PropsBotao = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children: ReactNode
  variante?: VarianteBotao
  tamanho?: TamanhoBotao
  /** ícone antes do texto (Phosphor, 16 ou 20px, bold) */
  icone?: ReactNode
  /** ícone depois do texto (ex.: seta) */
  iconeDepois?: ReactNode
  carregando?: boolean
  /** ocupa a largura toda */
  cheio?: boolean
}

export function Botao({ children, variante = 'principal', tamanho = 'g', icone, iconeDepois, carregando = false, cheio = false, className = '', type = 'button', onClick, ...resto }: PropsBotao) {
  const classes = ['ui-bt', `ui-bt--${variante}`, tamanho !== 'g' ? `ui-bt--${tamanho}` : '', cheio ? 'ui-bt--cheio' : '', className].filter(Boolean).join(' ')
  const aoTocar = (e: MouseEvent<HTMLButtonElement>) => {
    if (carregando) { e.preventDefault(); return }
    onClick?.(e)
  }
  return (
    <button type={type} className={classes} aria-busy={carregando || undefined} onClick={aoTocar} {...resto}>
      {carregando ? <span className="ui-gira" aria-hidden="true" /> : icone ? <span className="ui-bt-ic" aria-hidden="true">{icone}</span> : null}
      <span className="ui-bt-t">{children}</span>
      {iconeDepois && !carregando ? <span className="ui-bt-ic" aria-hidden="true">{iconeDepois}</span> : null}
    </button>
  )
}

/**
 * Botão só com ícone. O "rotulo" é obrigatório: é o nome que o leitor de tela fala
 * e a dica que aparece ao parar o mouse ("Fechar", "Mais opções").
 */
type PropsBotaoIcone = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & {
  rotulo: string
  children: ReactNode
  /** neutro (cinza) · suave (rosa clarinho) · limpo (sem fundo) · claro (sobre o cabeçalho rosa) */
  variante?: 'neutro' | 'suave' | 'limpo' | 'claro'
  tamanho?: 'g' | 'p'
}

export function BotaoIcone({ rotulo, children, variante = 'neutro', tamanho = 'g', className = '', type = 'button', ...resto }: PropsBotaoIcone) {
  const classes = ['ui-bti', variante !== 'neutro' ? `ui-bti--${variante}` : '', tamanho === 'p' ? 'ui-bti--p' : '', className].filter(Boolean).join(' ')
  return <button type={type} className={classes} aria-label={rotulo} title={rotulo} {...resto}>{children}</button>
}

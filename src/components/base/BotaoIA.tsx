/**
 * (30/10 · 5.33) Botão de IA, o mesmo em todo o app (antes cada tela tinha o seu: preto, link rosa, borda rosa, cinza).
 * Caixinha cinza sem borda, estrela rosa e o texto. Enquanto a IA escreve: "Gerando…".
 *   <BotaoIA carregando={gerando} onClick={gerar} />              → "Gerar com IA"
 *   <BotaoIA carregando={gerando} onClick={gerar}>Gerar outras</BotaoIA>
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Sparkle } from '@phosphor-icons/react'

export function BotaoIA({ carregando, children = 'Gerar com IA', textoCarregando = 'Gerando…', className = '', disabled, ...resto }:
  ButtonHTMLAttributes<HTMLButtonElement> & { carregando?: boolean; textoCarregando?: string; children?: ReactNode }) {
  return (
    <button type="button" className={`ui-ia ${className}`.trim()} disabled={disabled || carregando} aria-busy={carregando || undefined} {...resto}>
      <Sparkle size={15} weight="fill" aria-hidden="true" />{carregando ? textoCarregando : children}
    </button>
  )
}

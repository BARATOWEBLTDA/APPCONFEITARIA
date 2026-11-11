import { X } from '@phosphor-icons/react'
import type { ButtonHTMLAttributes } from 'react'
import './base.css'

/**
 * (11/11) Os X do app, num padrão só (antes eram 15 jeitos e 7 tamanhos de ícone):
 * · BotaoFechar: fecha janela, gaveta e folha (sem fundo, X 20 cinza, área de 44 px)
 * · BotaoLimpar: limpa a busca ou um campo (sem fundo, X 18 cinza, 36 px)
 * · BotaoTirar: tira um item de uma lista (sem fundo, X 16 cinza claro, 36 px)
 * Exceções de propósito: o X branco em cima da foto e o do chat do Doo (fundo escuro).
 */
type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & { rotulo?: string }

function base(tipo: string, tam: number, rotuloPadrao: string) {
  return function BotaoX({ rotulo = rotuloPadrao, className = '', type = 'button', ...resto }: Props) {
    return (
      <button type={type} className={`ui-bti ui-x ui-x--${tipo} ${className}`.trim()} aria-label={rotulo} title={rotulo} {...resto}>
        <X size={tam} weight="bold" aria-hidden="true" />
      </button>
    )
  }
}

export const BotaoFechar = base('fechar', 20, 'Fechar')
export const BotaoLimpar = base('limpar', 18, 'Limpar a busca')
export const BotaoTirar = base('tirar', 16, 'Tirar')

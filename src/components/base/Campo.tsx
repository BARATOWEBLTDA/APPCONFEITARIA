import { useId, useState } from 'react'
import type { InputHTMLAttributes, ReactNode, Ref, TextareaHTMLAttributes } from 'react'
import { Eye, EyeSlash, WarningCircle } from '@phosphor-icons/react'
import { BotaoIcone } from './Botao'
import './base.css'

/**
 * Campo do Doonly (07/10 · guia v2, A7 e C · Formulários).
 *   rotulo: sempre em cima do campo (o texto de dentro é só um exemplo)
 *   erro: aparece embaixo do campo, dizendo como corrigir
 *   dica: uma frase de apoio embaixo (some quando tem erro)
 *   prefixo: "R$" · icone: o que o campo abre (calendário, relógio, lupa)
 *   type="password": ganha o olho de mostrar e esconder a senha
 * Letra de 16px (o iPhone não dá zoom) e altura de 48px (igual ao botão).
 */
type Comum = {
  rotulo: string
  dica?: string
  erro?: string
  /** marca "opcional" ao lado do rótulo */
  opcional?: boolean
  /** marca "obrigatório" ao lado do rótulo (use quando a maioria dos campos é opcional) */
  obrigatorio?: boolean
}

function Moldura({ id, rotulo, dica, erro, opcional, obrigatorio, desativado, className, children }: Comum & { id: string; desativado?: boolean; className?: string; children: ReactNode }) {
  const classes = ['ui-campo', erro ? 'ui-campo--erro' : '', desativado ? 'ui-campo--off' : '', className || ''].filter(Boolean).join(' ')
  return (
    <div className={classes}>
      <label className="ui-campo-r" htmlFor={id}>
        <span>{rotulo}</span>
        {obrigatorio ? <small className="obr">obrigatório</small> : opcional ? <small>opcional</small> : null}
      </label>
      {children}
      {erro
        ? <p className="ui-campo-msg" id={`${id}-msg`} role="alert"><WarningCircle size={14} weight="bold" aria-hidden="true" /><span>{erro}</span></p>
        : dica ? <p className="ui-campo-msg" id={`${id}-msg`}>{dica}</p> : null}
    </div>
  )
}

type PropsCampo = Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & Comum & {
  prefixo?: ReactNode
  icone?: ReactNode
  /** algo no fim do campo (ex.: um botão de limpar) */
  depois?: ReactNode
  ref?: Ref<HTMLInputElement>
}

export function Campo({ rotulo, dica, erro, opcional, obrigatorio, prefixo, icone, depois, className, id, type = 'text', disabled, ref, ...resto }: PropsCampo) {
  const gerado = useId()
  const meuId = id || `campo-${gerado}`
  const [mostrar, setMostrar] = useState(false)
  const senha = type === 'password'
  return (
    <Moldura id={meuId} rotulo={rotulo} dica={dica} erro={erro} opcional={opcional} obrigatorio={obrigatorio} desativado={disabled} className={className}>
      <div className="ui-campo-c" onClick={e => { if (e.target === e.currentTarget) (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus() }}>
        {icone ? <span className="ui-campo-ic" aria-hidden="true">{icone}</span> : null}
        {prefixo ? <span className="ui-campo-pre" aria-hidden="true">{prefixo}</span> : null}
        <input
          ref={ref} id={meuId} type={senha && mostrar ? 'text' : type} disabled={disabled}
          aria-invalid={erro ? true : undefined} aria-required={obrigatorio || undefined}
          aria-describedby={erro || dica ? `${meuId}-msg` : undefined}
          {...resto}
        />
        {senha && !disabled
          ? <BotaoIcone className="ui-campo-olho" variante="limpo" tamanho="p" rotulo={mostrar ? 'Esconder a senha' : 'Mostrar a senha'} aria-pressed={mostrar} onClick={() => setMostrar(v => !v)}>
              {mostrar ? <EyeSlash size={20} weight="bold" /> : <Eye size={20} weight="bold" />}
            </BotaoIcone>
          : depois}
      </div>
    </Moldura>
  )
}

type PropsCampoArea = TextareaHTMLAttributes<HTMLTextAreaElement> & Comum & { ref?: Ref<HTMLTextAreaElement> }

/** Campo de várias linhas (observações, recado do bolo). */
export function CampoArea({ rotulo, dica, erro, opcional, obrigatorio, className, id, disabled, ref, ...resto }: PropsCampoArea) {
  const gerado = useId()
  const meuId = id || `campo-${gerado}`
  return (
    <Moldura id={meuId} rotulo={rotulo} dica={dica} erro={erro} opcional={opcional} obrigatorio={obrigatorio} desativado={disabled} className={className}>
      <div className="ui-campo-c">
        <textarea
          ref={ref} id={meuId} disabled={disabled}
          aria-invalid={erro ? true : undefined} aria-required={obrigatorio || undefined}
          aria-describedby={erro || dica ? `${meuId}-msg` : undefined}
          {...resto}
        />
      </div>
    </Moldura>
  )
}

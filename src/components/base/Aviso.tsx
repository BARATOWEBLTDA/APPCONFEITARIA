import { useEffect, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { Check, Info, X } from '@phosphor-icons/react'
import './base.css'

/**
 * Aviso rápido do Doonly (07/10 · guia v2, A10): a pílula branca que sobe embaixo da tela
 * e some sozinha. Curto e no passado: "Pedido salvo." · "Endereço copiado."
 *
 *   avisar('Pedido salvo.')
 *   avisar('Sem conexão. Confira a internet e tente de novo.', { tipo: 'erro' })
 *   avisar('Brigadeiro removido.', { acao: { rotulo: 'Desfazer', aoTocar: desfazer } })
 *
 * Um por vez: o novo entra no lugar do anterior. Não precisa montar nada na tela.
 * A altura de onde ele sobe é a variável --ui-aviso-base (a tela pode mudar).
 * Com janela ou gaveta aberta ele aparece em cima, pra não cobrir os botões de baixo.
 */
export type OpcoesAviso = {
  tipo?: 'ok' | 'erro' | 'info'
  /** em milissegundos (padrão: 2500; erro e aviso com ação: 5000) */
  duracao?: number
  acao?: { rotulo: string; aoTocar: () => void }
}
type Item = OpcoesAviso & { id: number; texto: string }

let atual: Item | null = null
let contador = 0
let montado = false
const ouvintes = new Set<() => void>()
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f) } }
const definir = (item: Item | null) => { atual = item; ouvintes.forEach(f => f()) }

function Lugar() {
  const item = useSyncExternalStore(assinar, () => atual, () => null)
  const [saindo, setSaindo] = useState(false)
  useEffect(() => {
    if (!item) return
    setSaindo(false)
    const tempo = item.duracao ?? (item.tipo === 'erro' || item.acao ? 5000 : 2500)
    const t1 = window.setTimeout(() => setSaindo(true), tempo)
    const t2 = window.setTimeout(() => { if (atual?.id === item.id) definir(null) }, tempo + 200)
    return () => { window.clearTimeout(t1); window.clearTimeout(t2) }
  }, [item])
  if (!item) return <div className="ui-aviso-ar" aria-live="polite" />
  const tipo = item.tipo || 'ok'
  return (
    <div className="ui-aviso-ar" aria-live={tipo === 'erro' ? 'assertive' : 'polite'}>
      <div key={item.id} className={`ui-aviso ui-aviso--${tipo}${saindo ? ' ui-aviso--saindo' : ''}`} role={tipo === 'erro' ? 'alert' : 'status'}>
        <span className="ui-aviso-ic" aria-hidden="true">
          {tipo === 'erro' ? <X size={11} weight="bold" /> : tipo === 'info' ? <Info size={12} weight="bold" /> : <Check size={11} weight="bold" />}
        </span>
        <span className="ui-aviso-t">{item.texto}</span>
        {item.acao ? <button type="button" className="ui-aviso-acao" onClick={() => { const acao = item.acao; definir(null); acao?.aoTocar() }}>{item.acao.rotulo}</button> : null}
      </div>
    </div>
  )
}

export function avisar(texto: string, opcoes: OpcoesAviso = {}) {
  if (typeof document === 'undefined') return
  if (!montado) {
    montado = true
    const lugar = document.createElement('div')
    document.body.appendChild(lugar)
    createRoot(lugar).render(<Lugar />)
  }
  definir({ ...opcoes, id: ++contador, texto })
}

/** Tira o aviso da tela antes da hora (ao trocar de tela, por exemplo). */
export function fecharAviso() {
  definir(null)
}

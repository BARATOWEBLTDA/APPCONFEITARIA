import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Botao, Janela } from '@/components/base'
import './dataHora.css'

// ── Horários 07:00–22:00 de 30 em 30 min (lista de apoio, mantida pra quem importa) ──
function gerarHorarios(): string[] {
  const slots: string[] = []
  for (let h = 7; h <= 22; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 22) slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

export const HORARIOS = gerarHorarios()

interface HorarioSheetProps {
  value: string
  onChange: (v: string) => void
  onClose: () => void
  titulo?: string
}

const ALTURA = 44 // altura de cada linha da rodinha
const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTOS_BASE = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

/** Uma coluna da rodinha: rola e para sempre numa linha (a do meio é a escolhida) */
function Rodinha({ itens, valor, aoMudar, rotulo }: { itens: string[]; valor: string; aoMudar: (v: string) => void; rotulo: string }) {
  const caixa = useRef<HTMLDivElement>(null)
  const parar = useRef<number | undefined>(undefined)
  const idx = Math.max(0, itens.indexOf(valor))

  // começa já no valor escolhido
  useEffect(() => {
    const el = caixa.current
    if (el) el.scrollTop = idx * ALTURA
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const aoRolar = () => {
    window.clearTimeout(parar.current)
    parar.current = window.setTimeout(() => {
      const el = caixa.current
      if (!el) return
      const i = Math.min(itens.length - 1, Math.max(0, Math.round(el.scrollTop / ALTURA)))
      if (itens[i] !== valor) aoMudar(itens[i])
    }, 90)
  }
  const ir = (i: number) => caixa.current?.scrollTo({ top: i * ALTURA, behavior: 'smooth' })
  const teclado = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); ir(Math.min(itens.length - 1, idx + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); ir(Math.max(0, idx - 1)) }
  }

  return (
    <div className="dh-roda" ref={caixa} onScroll={aoRolar} tabIndex={0} onKeyDown={teclado}
      role="listbox" aria-label={rotulo} aria-activedescendant={`dh-${rotulo}-${valor}`}>
      {itens.map((it, i) => (
        <div key={it} id={`dh-${rotulo}-${it}`} role="option" aria-selected={it === valor}
          className={`dh-roda-it${it === valor ? ' sel' : ''}`} onClick={() => ir(i)}>{it}</div>
      ))}
    </div>
  )
}

/**
 * Janela de escolher o horário (a mesma em todo o app).
 * 13/10: duas rodinhas, hora e minuto (como o relógio do celular). No celular sobe de baixo; no computador fica no meio.
 * Os minutos andam de 5 em 5; um horário salvo fora disso (14:37) aparece na lista do mesmo jeito.
 */
export default function HorarioSheet({ value, onChange, onClose, titulo = 'Horário' }: HorarioSheetProps) {
  const ok = /^\d{2}:\d{2}$/.test(value || '')
  const [h, setH] = useState(ok ? value.slice(0, 2) : '09')
  const [m, setM] = useState(ok ? value.slice(3, 5) : '00')
  const [minutos] = useState(() => (MINUTOS_BASE.includes(m) ? MINUTOS_BASE : [...MINUTOS_BASE, m].sort()))

  const confirmar = () => { onChange(`${h}:${m}`); onClose() }

  return (
    <Janela aberta aoFechar={onClose} tipo="conteudo" titulo={titulo}
      acoes={<Botao cheio onClick={confirmar}>Usar {h}:{m}</Botao>} umaAcao>
      <div className="dh-relogio">
        <span className="dh-faixa" aria-hidden="true" />
        <Rodinha itens={HORAS} valor={h} aoMudar={setH} rotulo="Hora" />
        <b className="dh-dois" aria-hidden="true">:</b>
        <Rodinha itens={minutos} valor={m} aoMudar={setM} rotulo="Minuto" />
      </div>
    </Janela>
  )
}

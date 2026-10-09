import { useEffect, useRef, useState } from 'react'
import { Botao, Campo, Janela } from '@/components/base'
import './dataHora.css'

// ── Horários 07:00–22:00 de 30 em 30 min ────────────────────────────────────
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

/** "1437" / "14:37" / "9" → "14:37" / "09:00" (ou null se não for um horário) */
function lerHora(t: string): string | null {
  const d = t.replace(/\D/g, '').slice(0, 4)
  if (!d) return null
  const h = parseInt(d.length <= 2 ? d : d.slice(0, d.length - 2)), m = d.length <= 2 ? 0 : parseInt(d.slice(-2))
  if (h > 23 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Janela de escolher o horário (a mesma em todo o app).
 * 09/10 (3.53): no padrão do guia. Grade de horários de 30 em 30 min (toque e pronto)
 * e, embaixo, um campo pra digitar outro horário (14:37).
 */
export default function HorarioSheet({ value, onChange, onClose, titulo = 'Horário' }: HorarioSheetProps) {
  const [outro, setOutro] = useState(value && !HORARIOS.includes(value) ? value : '')
  const [erro, setErro] = useState('')
  const grade = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = value ? grade.current?.querySelector(`[data-hora="${value}"]`) as HTMLElement | null : null
    if (el) el.scrollIntoView({ block: 'center' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const escolher = (hora: string) => { onChange(hora); onClose() }
  const usarOutro = () => {
    const h = lerHora(outro)
    if (!h) { setErro('Escreva um horário como 14:30'); return }
    escolher(h)
  }

  return (
    <Janela aberta aoFechar={onClose} tipo="conteudo" titulo={titulo}>
      <div className="dh-horas" ref={grade}>
        {HORARIOS.map(hora => (
          <button key={hora} type="button" data-hora={hora} className={value === hora ? 'sel' : ''} aria-pressed={value === hora} onClick={() => escolher(hora)}>{hora}</button>
        ))}
      </div>
      <div className="dh-outro">
        <Campo rotulo="Outro horário" placeholder="14:45" inputMode="numeric" maxLength={5} value={outro} erro={erro || undefined}
          onChange={e => { setErro(''); const d = e.target.value.replace(/\D/g, '').slice(0, 4); setOutro(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d) }}
          onKeyDown={e => { if (e.key === 'Enter') usarOutro() }} />
        <Botao variante="secundario" disabled={!outro} onClick={usarOutro}>Usar</Botao>
      </div>
    </Janela>
  )
}

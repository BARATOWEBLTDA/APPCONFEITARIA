import { useState } from 'react'
import { CalendarBlank } from '@phosphor-icons/react'
import CalendarioSheet, { dataPorExtenso } from '@/components/CalendarioSheet'
import './dataHora.css'

/**
 * Campo de data do app (03/10): mostra "Sábado, 17/10/2026" e abre o calendário do app ao tocar.
 * Substitui o <input type="date"> do navegador (que muda de cara em cada celular).
 * 09/10: mesma altura, borda e letra do Campo (48px, 16px).
 */
export default function CampoData({ valor, onChange, titulo, min, max, placeholder = 'Escolher a data', cor, id, className, curto }: {
  valor?: string | null; onChange: (iso: string) => void; titulo?: string; min?: string; max?: string; placeholder?: string; cor?: string; id?: string; className?: string; curto?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button type="button" id={id} className={`cdata ${className || ''}`} onClick={() => setAberto(true)} aria-label={`${titulo || 'Data'}: ${valor ? dataPorExtenso(valor) : placeholder}`}>
        <CalendarBlank size={20} weight="bold" aria-hidden="true" />
        <span className={valor ? '' : 'ph'}>{valor ? dataPorExtenso(valor, curto) : placeholder}</span>
      </button>
      {aberto && <CalendarioSheet valor={valor} titulo={titulo} min={min} max={max} cor={cor} onClose={() => setAberto(false)} onConfirmar={d => { onChange(d); setAberto(false) }} />}
    </>
  )
}

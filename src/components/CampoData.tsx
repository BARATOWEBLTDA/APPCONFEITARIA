import { useState } from 'react'
import CalendarioSheet, { dataPorExtenso } from '@/components/CalendarioSheet'

/**
 * Campo de data do app (03/10): mostra "Sábado, 17/10/2026" e abre o calendário do app ao tocar.
 * Substitui o <input type="date"> do navegador (que muda de cara em cada celular).
 */
export default function CampoData({ valor, onChange, titulo, min, max, placeholder = 'Escolher a data', cor, id, className, curto }: {
  valor?: string | null; onChange: (iso: string) => void; titulo?: string; min?: string; max?: string; placeholder?: string; cor?: string; id?: string; className?: string; curto?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button type="button" id={id} className={`cdata ${className || ''}`} onClick={() => setAberto(true)} aria-label={titulo || 'Escolher a data'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
        <span className={valor ? '' : 'ph'}>{valor ? dataPorExtenso(valor, curto) : placeholder}</span>
      </button>
      {aberto && <CalendarioSheet valor={valor} titulo={titulo} min={min} max={max} cor={cor} onClose={() => setAberto(false)} onConfirmar={d => { onChange(d); setAberto(false) }} />}
      <style>{`
        .cdata { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; box-sizing: border-box; height: 46px; border: 1.5px solid #EDE6E9; border-radius: 12px; padding: 0 12px; background: #fff; font-family: inherit; font-size: 15px; color: #2C1219; cursor: pointer; text-align: left; }
        .cdata svg { color: #C33A6E; flex-shrink: 0; }
        .cdata span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .cdata .ph { color: #9A8E94; }
        .cdata:focus-visible { outline: none; border-color: #E85A8C; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
      `}</style>
    </>
  )
}

import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { ptBR } from 'react-day-picker/locale'

interface DatePickerFieldProps {
  label: string
  value: string // formato YYYY-MM-DD
  onChange: (value: string) => void
  required?: boolean
  minDate?: Date
  placeholder?: string
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function DatePickerField({
  label,
  value,
  onChange,
  required,
  minDate,
  placeholder = 'Selecionar data',
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = value ? new Date(value + 'T12:00:00') : undefined

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleSelect = (date: Date | undefined) => {
    if (!date) return
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    onChange(`${y}-${m}-${d}`)
    setOpen(false)
  }

  return (
    <div className="dpf-wrap" ref={ref}>
      <label className="pf-label">{label}{required && ' *'}</label>

      <button
        type="button"
        className={`dpf-trigger${open ? ' open' : ''}${value ? ' has-value' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span className="dpf-trigger-text">
          {value ? formatDateDisplay(value) : placeholder}
        </span>
        {value && (
          <button
            type="button"
            className="dpf-clear"
            onClick={e => { e.stopPropagation(); onChange('') }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          style={{ marginLeft: 'auto', flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="dpf-popover">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            locale={ptBR}
            disabled={minDate ? { before: minDate } : undefined}
            showOutsideDays
            className="dpf-calendar"
          />
        </div>
      )}

      <style>{`
        .dpf-wrap { position: relative; display: flex; flex-direction: column; gap: 0.3rem; }

        .dpf-trigger {
          display: flex; align-items: center; gap: 0.5rem;
          border: 1.5px solid var(--border, #E9E9EE);
          border-radius: 8px; padding: 0.55rem 0.75rem;
          background: var(--bg-body, #FAFAFA);
          cursor: pointer; font-family: 'Geist', sans-serif;
          font-size: 0.85rem; text-align: left;
          transition: border-color 0.15s;
          color: var(--text-muted, #9CA3AF);
          width: 100%;
        }
        .dpf-trigger.has-value { color: var(--text-primary, #1F2937); }
        .dpf-trigger:hover, .dpf-trigger.open { border-color: var(--primary, #FF6FA9); }
        .dpf-trigger svg:first-child { color: var(--primary, #FF6FA9); flex-shrink: 0; }

        .dpf-trigger-text { flex: 1; }

        .dpf-clear {
          background: none; border: none; cursor: pointer; padding: 2px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 4px; color: var(--text-muted, #9CA3AF);
          transition: color 0.15s;
          flex-shrink: 0;
        }
        .dpf-clear:hover { color: #ef4444; }

        .dpf-popover {
          position: absolute; top: calc(100% + 6px); left: 0; z-index: 100;
          background: white; border-radius: 14px;
          border: 1.5px solid var(--border, #E9E9EE);
          box-shadow: 0 8px 32px rgba(0,0,0,0.12);
          animation: dpfFadeIn 0.15s ease;
          min-width: 300px;
        }
        @keyframes dpfFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── react-day-picker custom styles ── */
        .dpf-calendar {
          padding: 1rem;
          font-family: 'Geist', sans-serif;
        }
        .dpf-calendar .rdp-month_caption {
          display: flex; align-items: center; justify-content: center;
          font-size: 0.92rem; font-weight: 700;
          color: var(--text-title, #1F2937);
          margin-bottom: 0.75rem; text-transform: capitalize;
        }
        .dpf-calendar .rdp-nav {
          display: flex; gap: 0.25rem;
        }
        .dpf-calendar .rdp-button_previous,
        .dpf-calendar .rdp-button_next {
          width: 28px; height: 28px; border-radius: 8px;
          border: 1.5px solid var(--border, #E9E9EE);
          background: white; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; color: var(--text-secondary, #6B7280);
        }
        .dpf-calendar .rdp-button_previous:hover,
        .dpf-calendar .rdp-button_next:hover {
          border-color: var(--primary, #FF6FA9);
          color: var(--primary, #FF6FA9);
          background: var(--primary-light, #FFF1F7);
        }
        .dpf-calendar .rdp-weekdays {
          display: grid; grid-template-columns: repeat(7, 1fr);
          margin-bottom: 0.25rem;
        }
        .dpf-calendar .rdp-weekday {
          text-align: center; font-size: 0.72rem; font-weight: 700;
          color: var(--text-muted, #9CA3AF); padding: 0.25rem 0;
          text-transform: uppercase;
        }
        .dpf-calendar .rdp-month_grid {
          width: 100%;
        }
        .dpf-calendar .rdp-week {
          display: grid; grid-template-columns: repeat(7, 1fr);
        }
        .dpf-calendar .rdp-day {
          text-align: center; padding: 0;
        }
        .dpf-calendar .rdp-day_button {
          width: 34px; height: 34px; border-radius: 8px;
          border: none; background: none; cursor: pointer;
          font-size: 0.83rem; font-weight: 500;
          color: var(--text-primary, #374151);
          font-family: 'Geist', sans-serif;
          transition: background 0.12s, color 0.12s;
          margin: 1px auto; display: flex;
          align-items: center; justify-content: center;
          width: 100%;
        }
        .dpf-calendar .rdp-day_button:hover {
          background: var(--primary-light, #FFF1F7);
          color: var(--primary, #FF6FA9);
        }
        .dpf-calendar .rdp-selected .rdp-day_button {
          background: var(--primary, #FF6FA9) !important;
          color: white !important;
          font-weight: 700;
        }
        .dpf-calendar .rdp-today .rdp-day_button {
          border: 1.5px solid var(--primary, #FF6FA9);
          color: var(--primary, #FF6FA9);
          font-weight: 700;
        }
        .dpf-calendar .rdp-selected.rdp-today .rdp-day_button {
          border: none;
          color: white !important;
        }
        .dpf-calendar .rdp-outside .rdp-day_button {
          color: var(--text-muted, #9CA3AF);
          opacity: 0.4;
        }
        .dpf-calendar .rdp-disabled .rdp-day_button {
          color: var(--text-muted, #9CA3AF);
          opacity: 0.3;
          cursor: not-allowed;
        }
        .dpf-calendar .rdp-disabled .rdp-day_button:hover {
          background: none;
          color: var(--text-muted, #9CA3AF);
        }
      `}</style>
    </div>
  )
}

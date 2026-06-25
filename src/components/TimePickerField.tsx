import { useState, useRef, useEffect } from 'react'

interface TimePickerFieldProps {
  label?: string
  value: string // formato HH:MM
  onChange: (value: string) => void
  placeholder?: string
  minuteStep?: 10 | 15 | 30 | 60
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))

function getMinutes(step: 10 | 15 | 30 | 60) {
  const steps: Record<number, string[]> = {
    10: ['00', '10', '20', '30', '40', '50'],
    15: ['00', '15', '30', '45'],
    30: ['00', '30'],
    60: ['00'],
  }
  return steps[step]
}

function formatDisplay(value: string) {
  if (!value) return ''
  const [h, m] = value.split(':')
  return `${h}:${m}`
}

export function TimePickerField({
  label,
  value,
  onChange,
  placeholder = 'Selecionar horário',
  minuteStep = 10,
}: TimePickerFieldProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const hourRef = useRef<HTMLDivElement>(null)
  const minuteRef = useRef<HTMLDivElement>(null)

  const selectedHour = value ? value.split(':')[0] : ''
  const selectedMinute = value ? value.split(':')[1] : ''
  const minutes = getMinutes(minuteStep)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Scroll to selected hour/minute when opening
  useEffect(() => {
    if (!open) return
    setTimeout(() => {
      if (hourRef.current && selectedHour) {
        const el = hourRef.current.querySelector(`[data-hour="${selectedHour}"]`) as HTMLElement
        if (el) el.scrollIntoView({ block: 'center' })
      }
      if (minuteRef.current && selectedMinute) {
        const el = minuteRef.current.querySelector(`[data-minute="${selectedMinute}"]`) as HTMLElement
        if (el) el.scrollIntoView({ block: 'center' })
      }
    }, 50)
  }, [open])

  const selectHour = (h: string) => {
    const min = selectedMinute || '00'
    onChange(`${h}:${min}`)
  }

  const selectMinute = (m: string) => {
    const h = selectedHour || '08'
    onChange(`${h}:${m}`)
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div className="tpf-wrap" ref={ref}>
      {label && <label className="pf-label">{label}</label>}

      <button
        type="button"
        className={`tpf-trigger${open ? ' open' : ''}${value ? ' has-value' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span className="tpf-trigger-text">
          {value ? formatDisplay(value) : placeholder}
        </span>
        {value && (
          <button type="button" className="tpf-clear" onClick={clear}>
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
        <div className="tpf-popover">
          <div className="tpf-header">
            <span className="tpf-header-label">Hora</span>
            <span className="tpf-separator">:</span>
            <span className="tpf-header-label">Minuto</span>
          </div>

          <div className="tpf-cols">
            {/* Horas */}
            <div className="tpf-col" ref={hourRef}>
              {HOURS.map(h => (
                <button
                  key={h}
                  data-hour={h}
                  type="button"
                  className={`tpf-item${selectedHour === h ? ' selected' : ''}`}
                  onClick={() => selectHour(h)}
                >
                  {h}
                </button>
              ))}
            </div>

            <div className="tpf-divider" />

            {/* Minutos */}
            <div className="tpf-col tpf-col-min" ref={minuteRef}>
              {minutes.map(m => (
                <button
                  key={m}
                  data-minute={m}
                  type="button"
                  className={`tpf-item${selectedMinute === m ? ' selected' : ''}`}
                  onClick={() => { selectMinute(m); setOpen(false) }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {value && (
            <div className="tpf-footer">
              <span className="tpf-preview">{formatDisplay(value)}</span>
              <button type="button" className="tpf-confirm" onClick={() => setOpen(false)}>
                Confirmar
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        .tpf-wrap { position: relative; display: flex; flex-direction: column; gap: 0.3rem; }

        .tpf-trigger {
          display: flex; align-items: center; gap: 0.5rem;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-sm); padding: 0.55rem 0.75rem;
          background: var(--bg-body);
          cursor: pointer; font-family: 'Geist', sans-serif;
          font-size: var(--font-button); text-align: left;
          transition: border-color var(--dur-fast);
          color: var(--text-muted);
          width: 100%;
        }
        .tpf-trigger.has-value { color: var(--text-primary); font-weight: var(--fw-medium); }
        .tpf-trigger:hover, .tpf-trigger.open { border-color: var(--primary); }
        .tpf-trigger svg:first-child { color: var(--primary); flex-shrink: 0; }
        .tpf-trigger-text { flex: 1; }

        .tpf-clear {
          background: none; border: none; cursor: pointer; padding: 2px;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-sm); color: var(--text-muted);
          transition: color var(--dur-fast); flex-shrink: 0;
        }
        .tpf-clear:hover { color: #ef4444; }

        .tpf-popover {
          position: absolute; top: calc(100% + 6px); left: 0; z-index: 100;
          background: white; border-radius: var(--radius-lg);
          border: 1.5px solid var(--border);
          box-shadow: 0 8px 32px rgba(0,0,0,0.12);
          animation: tpfFadeIn 0.15s ease;
          min-width: 200px; overflow: hidden;
        }
        @keyframes tpfFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .tpf-header {
          display: flex; align-items: center; justify-content: space-around;
          padding: 0.65rem 1rem 0.5rem;
          border-bottom: 1px solid var(--border);
        }
        .tpf-header-label {
          font-size: var(--font-caption); font-weight: var(--fw-bold); color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.06em; flex: 1; text-align: center;
        }
        .tpf-separator {
          font-size: var(--font-input); font-weight: var(--fw-bold); color: var(--text-muted);
          padding: 0 0.25rem;
        }

        .tpf-cols {
          display: flex; align-items: stretch;
          max-height: 200px;
        }

        .tpf-col {
          flex: 1; overflow-y: auto; padding: 0.35rem 0.4rem;
          display: flex; flex-direction: column; gap: 2px;
          scrollbar-width: thin; scrollbar-color: var(--border) transparent;
        }
        .tpf-col::-webkit-scrollbar { width: 4px; }
        .tpf-col::-webkit-scrollbar-thumb { background: var(--border); border-radius: var(--radius-sm); }

        .tpf-col-min { flex: 0.8; }

        .tpf-divider {
          width: 1px; background: var(--border); flex-shrink: 0; margin: 0.35rem 0;
        }

        .tpf-item {
          width: 100%; padding: 0.45rem 0.5rem;
          border: none; border-radius: var(--radius-sm); background: none;
          cursor: pointer; font-family: 'Geist', sans-serif;
          font-size: var(--font-button); font-weight: var(--fw-medium);
          color: var(--text-primary);
          transition: background 0.1s, color 0.1s;
          text-align: center;
        }
        .tpf-item:hover { background: var(--primary-light); color: var(--primary); }
        .tpf-item.selected {
          background: var(--primary) !important;
          color: white !important; font-weight: var(--fw-bold);
        }

        .tpf-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.6rem 0.85rem;
          border-top: 1px solid var(--border);
          background: var(--bg-body);
        }
        .tpf-preview {
          font-size: var(--font-modal-title); font-weight: var(--fw-bold);
          color: var(--text-title);
          font-family: 'Geist Mono', monospace;
          letter-spacing: 0.05em;
        }
        .tpf-confirm {
          background: var(--primary); color: white;
          border: none; border-radius: var(--radius-sm); padding: 0.4rem 0.9rem;
          font-size: var(--font-helper); font-weight: var(--fw-semibold); cursor: pointer;
          font-family: 'Geist', sans-serif; transition: opacity var(--dur-fast);
        }
        .tpf-confirm:hover { opacity: 0.88; }
      `}</style>
    </div>
  )
}

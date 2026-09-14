import { useState, useEffect, useRef } from 'react'

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

/**
 * Bottom sheet reutilizável de seleção de horário.
 * Abre de baixo pra cima, mostra horários de 30 em 30 min (07:00–22:00)
 * e permite digitar horário custom.
 *
 * Uso:
 * ```tsx
 * const [aberto, setAberto] = useState(false)
 * const [hora, setHora] = useState('')
 *
 * <input readOnly value={hora} onClick={() => setAberto(true)} />
 * {aberto && (
 *   <HorarioSheet
 *     value={hora}
 *     onChange={setHora}
 *     onClose={() => setAberto(false)}
 *   />
 * )}
 * ```
 */
export default function HorarioSheet({ value, onChange, onClose, titulo = 'Horário' }: HorarioSheetProps) {
  const [digitando, setDigitando] = useState(false)
  const [customHora, setCustomHora] = useState(value || '')
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!value || !listRef.current) return
    const el = listRef.current.querySelector(`[data-hora="${value}"]`) as HTMLElement
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [])

  // Trava scroll do body
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [])

  const handleSelect = (hora: string) => { onChange(hora); onClose() }

  const handleCustomConfirm = () => {
    const digits = customHora.replace(/\D/g, '').slice(0, 4)
    if (digits.length === 4) {
      const h = parseInt(digits.slice(0, 2))
      const m = parseInt(digits.slice(2))
      if (h <= 23 && m <= 59) { onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`); onClose(); return }
    }
    onChange(customHora); onClose()
  }

  return (
    <>
      <div className="hs-overlay" onClick={onClose} />
      <div className="hs-sheet">
        <div className="hs-handle" />
        <div className="hs-header">
          <span className="hs-title">{titulo}</span>
          <button className="hs-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        {!digitando ? (
          <>
            <div className="hs-list" ref={listRef}>
              {HORARIOS.map(hora => (
                <button key={hora} data-hora={hora} className={`hs-item${value === hora ? ' hs-item--on' : ''}`} onClick={() => handleSelect(hora)}>
                  {hora}
                  {value === hora && <svg width="16" height="16" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </button>
              ))}
            </div>
            <div className="hs-footer">
              <button className="hs-custom-btn" onClick={() => { setCustomHora(value || ''); setDigitando(true) }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                Digitar outro horário
              </button>
            </div>
          </>
        ) : (
          <div className="hs-custom-form">
            <p className="hs-custom-label">Digite o horário</p>
            <input className="hs-custom-input" placeholder="14:37" inputMode="numeric" maxLength={5} value={customHora} autoFocus
              onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(0, 4); setCustomHora(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d) }} />
            <div className="hs-custom-actions">
              <button className="hs-btn-ghost" onClick={() => setDigitando(false)}>Voltar</button>
              <button className="hs-btn-primary" onClick={handleCustomConfirm}>Confirmar</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .hs-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 10000; animation: hsFadeIn 0.2s ease; }
        .hs-sheet {
          position: fixed; bottom: 0; left: 0; right: 0;
          background: #fff;
          border-radius: 20px 20px 0 0;
          z-index: 10001;
          max-height: 72vh;
          display: flex; flex-direction: column;
          animation: hsSlideUp 0.28s cubic-bezier(0.32,0.72,0,1);
          box-shadow: 0 -4px 32px rgba(0,0,0,0.15);
          font-family: var(--font-base) !important;
        }
        .hs-handle {
          width: 36px; height: 4px;
          background: #E5D8DE; border-radius: 999px;
          margin: 10px auto 0;
        }
        .hs-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px 12px;
          border-bottom: 1px solid #F0EBED;
        }
        .hs-title {
          font-size: 15px; font-weight: 900; letter-spacing: -0.01em;
          color: #2D1F26;
          font-family: var(--font-base) !important;
        }
        .hs-close {
          all: unset;
          padding: 6px; border-radius: 50%;
          color: #6B5D64; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .hs-close:hover { background: #F5F1F3; }

        .hs-list { overflow-y: auto; flex: 1; padding: 8px 0; }
        .hs-list::-webkit-scrollbar { display: none; }
        .hs-item {
          all: unset;
          width: 100%; box-sizing: border-box;
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px;
          font-size: 15px;
          font-family: var(--font-base) !important;
          font-weight: 500;
          color: #2D1F26;
          cursor: pointer;
          transition: background 0.1s;
          border-bottom: 0.5px solid #F0EBED;
        }
        .hs-item:last-child { border-bottom: none; }
        .hs-item:hover { background: #FDFAFB; }
        .hs-item--on {
          color: #E85A8C;
          font-weight: 800;
          background: #FDF3F7;
        }

        .hs-footer {
          padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid #F0EBED;
        }
        .hs-custom-btn {
          all: unset;
          width: 100%; box-sizing: border-box;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px;
          border-radius: 8px;
          border: 1.5px dashed #E85A8C;
          color: #E85A8C;
          font-size: 13.5px; font-weight: 700;
          font-family: var(--font-base) !important;
          cursor: pointer;
        }
        .hs-custom-btn:hover { background: #FDF3F7; }

        .hs-custom-form {
          padding: 20px 16px calc(32px + env(safe-area-inset-bottom, 0px));
          display: flex; flex-direction: column; gap: 16px;
        }
        .hs-custom-label {
          font-size: 13px; font-weight: 700;
          color: #6B5D64; margin: 0;
          font-family: var(--font-base) !important;
        }
        .hs-custom-input {
          border: 1.5px solid #E5D8DE;
          border-radius: 10px;
          padding: 14px 16px;
          font-size: 24px; font-weight: 900;
          font-family: var(--font-base) !important;
          color: #2D1F26;
          text-align: center;
          letter-spacing: 0.1em;
          background: #FDFAFB;
          outline: none;
          width: 100%; box-sizing: border-box;
        }
        .hs-custom-input:focus { border-color: #E85A8C; background: #fff; }
        .hs-custom-actions { display: flex; gap: 10px; }
        .hs-btn-ghost {
          all: unset;
          flex: 1; box-sizing: border-box;
          padding: 12px; text-align: center;
          border-radius: 8px;
          background: #F5F1F3;
          color: #6B5D64;
          font-size: 13.5px; font-weight: 700;
          font-family: var(--font-base) !important;
          cursor: pointer;
        }
        .hs-btn-primary {
          all: unset;
          flex: 1; box-sizing: border-box;
          padding: 12px; text-align: center;
          border-radius: 8px;
          background: #E85A8C;
          color: #fff;
          font-size: 13.5px; font-weight: 800;
          font-family: var(--font-base) !important;
          cursor: pointer;
          box-shadow: 0 3px 0 #C33A6E;
        }
        .hs-btn-primary:active { transform: translateY(3px); box-shadow: 0 0 0 #C33A6E; }

        @keyframes hsFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes hsSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>
  )
}

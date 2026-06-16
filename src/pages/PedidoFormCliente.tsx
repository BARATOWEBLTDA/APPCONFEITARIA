import { useState, useEffect } from 'react'
import { DatePickerField } from '@/components/DatePickerField'
import { useIsMobile } from '@/hooks/use-mobile'
import { type Pedido, ORIGENS, formatTelefone } from '@/pages/pedidoFormTypes'

type Props = {
  pedido: Pedido
  set: (field: keyof Pedido, value: any) => void
  clientes: any[]
  salvarComoNovo: boolean
  setSalvarComoNovo: (v: boolean) => void
  onNext: () => void
}

// ── Horários 07:00–22:00 de 30 em 30 min ────────────────────────────────────
function gerarHorarios(): string[] {
  const slots: string[] = []
  for (let h = 7; h <= 22; h++) {
    slots.push(`${String(h).padStart(2,'0')}:00`)
    if (h < 22) slots.push(`${String(h).padStart(2,'0')}:30`)
  }
  return slots
}
const HORARIOS = gerarHorarios()

// ── Bottom Sheet de horário ──────────────────────────────────────────────────
function HorarioSheet({ value, onChange, onClose }: {
  value: string; onChange: (v: string) => void; onClose: () => void
}) {
  const [digitando, setDigitando] = useState(false)
  const [customHora, setCustomHora] = useState(value || '')
  const listRef = { current: null as HTMLDivElement | null }

  useEffect(() => {
    if (!value || !listRef.current) return
    const el = (listRef.current as HTMLDivElement).querySelector(`[data-hora="${value}"]`) as HTMLElement
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [])

  const handleSelect = (hora: string) => { onChange(hora); onClose() }

  const handleCustomConfirm = () => {
    const digits = customHora.replace(/\D/g, '').slice(0, 4)
    if (digits.length === 4) {
      const h = parseInt(digits.slice(0, 2))
      const m = parseInt(digits.slice(2))
      if (h <= 23 && m <= 59) { onChange(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`); onClose(); return }
    }
    onChange(customHora); onClose()
  }

  return (
    <>
      <div className="hs-overlay" onClick={onClose} />
      <div className="hs-sheet">
        <div className="hs-handle" />
        <div className="hs-header">
          <span className="hs-title">Horário de entrega</span>
          <button className="hs-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {!digitando ? (
          <>
            <div className="hs-list" ref={(el) => { listRef.current = el }}>
              {HORARIOS.map(hora => (
                <button key={hora} data-hora={hora} className={`hs-item${value === hora ? ' hs-item--on' : ''}`} onClick={() => handleSelect(hora)}>
                  {hora}
                  {value === hora && <svg width="16" height="16" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </button>
              ))}
            </div>
            <div className="hs-footer">
              <button className="hs-custom-btn" onClick={() => { setCustomHora(value || ''); setDigitando(true) }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Digitar outro horário
              </button>
            </div>
          </>
        ) : (
          <div className="hs-custom-form">
            <p className="hs-custom-label">Digite o horário</p>
            <input className="hs-custom-input" placeholder="14:37" inputMode="numeric" maxLength={5} value={customHora}
              onChange={e => { const d = e.target.value.replace(/\D/g,'').slice(0,4); setCustomHora(d.length > 2 ? `${d.slice(0,2)}:${d.slice(2)}` : d) }} />
            <div className="hs-custom-actions">
              <button className="hs-btn-ghost" onClick={() => setDigitando(false)}>Voltar</button>
              <button className="hs-btn-primary" onClick={handleCustomConfirm}>Confirmar</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function StepCliente({ pedido, set, clientes, salvarComoNovo, setSalvarComoNovo, onNext }: Props) {
  const isMobile = useIsMobile()
  const [showOrigem, setShowOrigem] = useState(!!pedido.origem)
  const [showEndereco, setShowEndereco] = useState(pedido.tipo_entrega === 'entrega')
  const [showHorarioSheet, setShowHorarioSheet] = useState(false)
  const [tocado, setTocado] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [clienteEncontrado, setClienteEncontrado] = useState<any>(null)

  const clienteNovo = !!pedido.cliente_nome && !pedido.cliente_id

  // ── Busca silenciosa por telefone ─────────────────────────────────────────
  const buscarPorTelefone = (tel: string) => {
    const digits = tel.replace(/\D/g, '')
    if (digits.length < 8) {
      setClienteEncontrado(null)
      if (pedido.cliente_id) set('cliente_id', undefined)
      return
    }
    const encontrado = clientes.find(c => {
      const dW = (c.whatsapp || '').replace(/\D/g, '')
      const dT = (c.telefone || '').replace(/\D/g, '')
      return dW === digits || dT === digits ||
        (dW.length >= 8 && digits.endsWith(dW.slice(-8))) ||
        (dT.length >= 8 && digits.endsWith(dT.slice(-8)))
    })
    if (encontrado) {
      setClienteEncontrado(encontrado)
      set('cliente_id', encontrado.id)
      set('cliente_nome', encontrado.nome)
      let endereco: Record<string, string> = {}
      try { endereco = typeof encontrado.endereco === 'string' ? JSON.parse(encontrado.endereco) : (encontrado.endereco || {}) } catch { /* ok */ }
      if (endereco.rua) {
        set('endereco_cep', endereco.cep || '')
        set('endereco_rua', endereco.rua || '')
        set('endereco_numero', endereco.numero || '')
        set('endereco_complemento', endereco.complemento || '')
        set('endereco_bairro', endereco.bairro || '')
        set('endereco_cidade', endereco.cidade || '')
      }
    } else {
      setClienteEncontrado(null)
      if (pedido.cliente_id) set('cliente_id', undefined)
    }
  }

  // ── CEP autopreenchimento ─────────────────────────────────────────────────
  const buscarCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (!data.erro) {
        set('endereco_rua', data.logradouro || '')
        set('endereco_bairro', data.bairro || '')
        set('endereco_cidade', data.localidade || '')
      }
    } catch { /* silencioso */ }
    setBuscandoCep(false)
  }

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
    const formatted = digits.length > 5 ? `${digits.slice(0,5)}-${digits.slice(5)}` : digits
    set('endereco_cep', formatted)
    if (digits.length === 8) buscarCep(digits)
  }

  const canNext = !!pedido.cliente_nome && !!pedido.data_entrega

  return (
    <div className="step-root">

      {/* ── Bloco: Cliente ── */}
      <div className="pf2-card">
        <p className="pf2-card-eyebrow">Quem está pedindo?</p>

        {/* Nome */}
        <div className="pf2-field">
          <label className="pf2-label">
            Nome do cliente
            <span className="pf2-required">*</span>
            {pedido.cliente_id && <span className="pf2-badge pf2-badge--ok">✓ Cadastrado</span>}
          </label>
          <input
            className={`pf2-input${tocado && !pedido.cliente_nome ? ' pf2-input--error' : ''}`}
            placeholder="Digite o nome..."
            value={pedido.cliente_nome}
            onChange={e => {
              set('cliente_nome', e.target.value)
              if (pedido.cliente_id) { set('cliente_id', undefined); setClienteEncontrado(null) }
            }}
            onBlur={() => setTocado(true)}
          />
          {tocado && !pedido.cliente_nome && <span className="pf2-error-msg">Campo obrigatório</span>}
        </div>

        {/* WhatsApp */}
        <div className="pf2-field" style={{ marginTop: '0.75rem' }}>
          <label className="pf2-label">WhatsApp</label>
          <input
            className="pf2-input"
            placeholder="(41) 9 9999-0000"
            value={pedido.cliente_whatsapp}
            onChange={e => {
              const formatted = formatTelefone(e.target.value)
              set('cliente_whatsapp', formatted)
              buscarPorTelefone(formatted)
            }}
            inputMode="numeric"
            maxLength={16}
          />
          {clienteEncontrado && (
            <div className="pf2-cliente-encontrado">
              <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Cliente encontrado: <strong>{clienteEncontrado.nome}</strong>
            </div>
          )}
        </div>

        {/* Toggle: Salvar como novo cliente */}
        {clienteNovo && (
          <div
            className={`pf2-optional-toggle pf2-novo-cliente-toggle${salvarComoNovo ? ' pf2-optional-toggle--on' : ''}`}
            style={{ marginTop: '0.25rem' }}
            onClick={() => setSalvarComoNovo(!salvarComoNovo)}
          >
            <div className={`pf2-check${salvarComoNovo ? ' pf2-check--on' : ''}`}>
              {salvarComoNovo && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <div style={{ flex: 1 }}>
              <span className="pf2-opt-label" style={{ display: 'block' }}>Salvar como novo cliente</span>
              {salvarComoNovo && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted,#C39EAA)' }}>Será cadastrado ao salvar o pedido</span>}
            </div>
          </div>
        )}

        {/* Opcional: Origem */}
        <div className="pf2-optional-toggle" onClick={() => { setShowOrigem(v => !v); if (showOrigem) set('origem', '') }}>
          <div className={`pf2-check${showOrigem ? ' pf2-check--on' : ''}`}>
            {showOrigem && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <span className="pf2-opt-label">Como conheceu / origem do pedido</span>
          {pedido.origem && !showOrigem && <span className="pf2-opt-badge">{pedido.origem}</span>}
        </div>
        {showOrigem && (
          <div className="pf2-optional-body">
            <select className="pf2-input" value={pedido.origem} onChange={e => set('origem', e.target.value)}>
              <option value="">Selecionar...</option>
              {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── Bloco: Entrega ── */}
      <div className="pf2-card">
        <p className="pf2-card-eyebrow">Quando e como entregar?</p>

        <div className="pf2-row">
          {/* Data */}
          <div className="pf2-field" style={{ flex: 2 }}>
            {isMobile ? (
              <>
                <label className="pf2-label">Data de entrega <span className="pf2-required">*</span></label>
                <label className={`pf2-input pf2-native-display${pedido.data_entrega ? ' pf2-native-display--filled' : ''}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pedido.data_entrega ? new Date(pedido.data_entrega + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Selecionar data'}
                  </span>
                  <input type="date" value={pedido.data_entrega} min={new Date().toISOString().split('T')[0]} onChange={e => set('data_entrega', e.target.value)}
                    style={{ position: 'absolute', opacity: 0, inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                </label>
              </>
            ) : (
              <DatePickerField label="Data de entrega" value={pedido.data_entrega} onChange={v => set('data_entrega', v)} required minDate={new Date()} placeholder="Selecionar data" />
            )}
          </div>

          {/* Horário */}
          <div className="pf2-field">
            <label className="pf2-label">Horário</label>
            {isMobile ? (
              <button type="button" className={`pf2-input pf2-hora-btn${pedido.horario_entrega ? ' pf2-hora-btn--filled' : ''}`} onClick={() => setShowHorarioSheet(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>{pedido.horario_entrega || '--:--'}</span>
              </button>
            ) : (
              <input className="pf2-input" type="time" value={pedido.horario_entrega} onChange={e => set('horario_entrega', e.target.value)} />
            )}
          </div>
        </div>

        {/* Tipo de entrega */}
        <div className="pf2-toggle-group" style={{ marginTop: '0.25rem' }}>
          {[{ value: 'retirada', label: 'Retirada' }, { value: 'entrega', label: 'Entrega' }].map(t => (
            <button key={t.value} type="button"
              className={`pf2-toggle-btn${pedido.tipo_entrega === t.value ? ' pf2-toggle-btn--on' : ''}`}
              onClick={() => { set('tipo_entrega', t.value); if (t.value === 'entrega') setShowEndereco(true) }}
            >
              {t.label}
              {pedido.tipo_entrega === t.value && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 4 }}>
                  <polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Endereço */}
        {pedido.tipo_entrega === 'entrega' && (
          <>
            <div className="pf2-optional-toggle" onClick={() => setShowEndereco(v => !v)} style={{ marginTop: '0.5rem' }}>
              <div className={`pf2-check${showEndereco ? ' pf2-check--on' : ''}`}>
                {showEndereco && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span className="pf2-opt-label">Endereço de entrega</span>
              {pedido.endereco_rua && !showEndereco && <span className="pf2-opt-badge">{pedido.endereco_rua}, {pedido.endereco_numero}</span>}
            </div>
            {showEndereco && (
              <div className="pf2-optional-body">
                <div className="pf2-row">
                  <div className="pf2-field">
                    <label className="pf2-label">CEP {buscandoCep && <span style={{ fontSize: '0.68rem', color: 'var(--primary)' }}>buscando...</span>}</label>
                    <input className="pf2-input" placeholder="00000-000" value={pedido.endereco_cep} onChange={handleCepChange} inputMode="numeric" maxLength={9} />
                  </div>
                  <div className="pf2-field" style={{ flex: 2 }}>
                    <label className="pf2-label">Número</label>
                    <input className="pf2-input" placeholder="Nº" value={pedido.endereco_numero} onChange={e => set('endereco_numero', e.target.value)} />
                  </div>
                </div>
                <div className="pf2-field" style={{ marginBottom: '0.65rem' }}>
                  <label className="pf2-label">Rua / Avenida</label>
                  <input className="pf2-input" placeholder="Preenchido pelo CEP..." value={pedido.endereco_rua} onChange={e => set('endereco_rua', e.target.value)} />
                </div>
                <div className="pf2-row">
                  <div className="pf2-field">
                    <label className="pf2-label">Complemento</label>
                    <input className="pf2-input" placeholder="Apto, bloco..." value={pedido.endereco_complemento} onChange={e => set('endereco_complemento', e.target.value)} />
                  </div>
                  <div className="pf2-field">
                    <label className="pf2-label">Bairro</label>
                    <input className="pf2-input" value={pedido.endereco_bairro} onChange={e => set('endereco_bairro', e.target.value)} />
                  </div>
                </div>
                <div className="pf2-field">
                  <label className="pf2-label">Cidade</label>
                  <input className="pf2-input" value={pedido.endereco_cidade} onChange={e => set('endereco_cidade', e.target.value)} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Rodapé ── */}
      <div className="pf2-footer">
        <button className="pf2-btn-primary" onClick={onNext} disabled={!canNext}>
          Próximo: Produtos
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        {!canNext && <p className="pf2-footer-hint">{!pedido.cliente_nome ? 'Informe o nome do cliente' : 'Informe a data de entrega'}</p>}
      </div>

      {showHorarioSheet && <HorarioSheet value={pedido.horario_entrega} onChange={v => set('horario_entrega', v)} onClose={() => setShowHorarioSheet(false)} />}

      <style>{`
        .pf2-cliente-encontrado {
          display: flex; align-items: center; gap: 5px;
          margin-top: 6px; padding: 6px 10px;
          background: #f0fdf4; border: 1px solid #bbf7d0;
          border-radius: 8px; font-size: 0.78rem; color: #16a34a;
          font-family: 'Geist', sans-serif;
        }
        .pf2-hora-btn { display: flex; align-items: center; gap: 8px; color: var(--text-muted,#C39EAA); cursor: pointer; text-align: left; width: 100%; }
        .pf2-hora-btn--filled { color: var(--text-primary,#431524); }
        .pf2-native-display { position: relative; display: flex; align-items: center; gap: 8px; border-radius: 12px; color: var(--text-muted,#C39EAA); cursor: pointer; user-select: none; white-space: nowrap; overflow: hidden; min-width: 0; }
        .pf2-native-display--filled { color: var(--text-primary,#431524); }
        .pf2-native-display input[type="date"] { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; cursor: pointer; font-size: 16px; }
        .hs-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 100; animation: hsFadeIn 0.2s ease; }
        .hs-sheet { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-card,#fff); border-radius: 20px 20px 0 0; z-index: 101; max-height: 72vh; display: flex; flex-direction: column; animation: hsSlideUp 0.28s cubic-bezier(0.32,0.72,0,1); box-shadow: 0 -4px 32px rgba(0,0,0,0.15); }
        .hs-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--border,#ECC2D0); margin: 10px auto 0; flex-shrink: 0; }
        .hs-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px 8px; flex-shrink: 0; border-bottom: 1px solid var(--border,#ECC2D0); }
        .hs-title { font-size: 0.95rem; font-weight: 700; color: var(--text-title,#431524); font-family: 'Geist',sans-serif; }
        .hs-close { width: 28px; height: 28px; border-radius: 50%; background: var(--bg-subtle,#F7EEF1); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-secondary,#6E3548); }
        .hs-list { overflow-y: auto; flex: 1; padding: 8px 0; }
        .hs-list::-webkit-scrollbar { display: none; }
        .hs-item { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: none; border: none; font-size: 1rem; font-family: 'Geist',sans-serif; font-weight: 500; color: var(--text-primary,#431524); cursor: pointer; transition: background 0.1s; border-bottom: 0.5px solid var(--border,#ECC2D0); }
        .hs-item:last-child { border-bottom: none; }
        .hs-item:hover { background: var(--bg-subtle,#F7EEF1); }
        .hs-item--on { color: var(--primary,#986274); font-weight: 700; background: var(--primary-light,#F7EEF1); }
        .hs-footer { padding: 10px 16px 24px; flex-shrink: 0; border-top: 1px solid var(--border,#ECC2D0); }
        .hs-custom-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border-radius: 12px; border: 1.5px dashed var(--primary,#986274); background: none; color: var(--primary,#986274); font-size: 0.88rem; font-weight: 600; font-family: 'Geist',sans-serif; cursor: pointer; }
        .hs-custom-form { padding: 20px 16px 32px; display: flex; flex-direction: column; gap: 16px; }
        .hs-custom-label { font-size: 0.85rem; font-weight: 600; color: var(--text-secondary,#6E3548); margin: 0; font-family: 'Geist',sans-serif; }
        .hs-custom-input { border: 1.5px solid var(--border,#ECC2D0); border-radius: 12px; padding: 0.75rem 1rem; font-size: 1.5rem; font-family: 'Geist',sans-serif; color: var(--text-primary,#431524); text-align: center; letter-spacing: 0.1em; background: var(--bg-input,#fff); outline: none; width: 100%; box-sizing: border-box; }
        .hs-custom-input:focus { border-color: var(--primary,#986274); }
        .hs-custom-actions { display: flex; gap: 10px; }
        .hs-btn-ghost { flex: 1; padding: 12px; border: 1.5px solid var(--border,#ECC2D0); border-radius: 12px; background: none; font-size: 0.88rem; font-weight: 600; color: var(--text-secondary,#6E3548); font-family: 'Geist',sans-serif; cursor: pointer; }
        .hs-btn-primary { flex: 2; padding: 12px; background: var(--primary,#986274); color: white; border: none; border-radius: 12px; font-size: 0.88rem; font-weight: 600; font-family: 'Geist',sans-serif; cursor: pointer; }
        @keyframes hsFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes hsSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </div>
  )
}

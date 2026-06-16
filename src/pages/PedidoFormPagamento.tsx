import { useState, useRef } from 'react'
import { type Pedido, formatMoney, parseMoney, formatMoneyInput } from '@/pages/pedidoFormTypes'

type Props = {
  pedido: Pedido
  set: (field: keyof Pedido, value: any) => void
  cupons: any[]
  saving: boolean
  onSalvar: () => void
  onSalvarEIniciar: () => void
  onBack: () => void
  isEdicao: boolean
}

function MoneyInput({ value, onChange, placeholder }: { value: number; onChange: (v: number) => void; placeholder?: string }) {
  const [display, setDisplay] = useState(value > 0 ? formatMoneyInput(value) : '')
  const prev = useRef(value)
  if (value !== prev.current && value !== parseMoney(display)) {
    prev.current = value
    setDisplay(value > 0 ? formatMoneyInput(value) : '')
  }
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', pointerEvents: 'none' }}>R$</span>
      <input
        className="pf2-input" inputMode="numeric"
        placeholder={placeholder || '0,00'} value={display}
        onChange={e => { const n = parseMoney(e.target.value); prev.current = n; setDisplay(formatMoneyInput(n)); onChange(n) }}
        onFocus={e => e.target.select()}
        style={{ paddingLeft: '2.2rem' }}
      />
    </div>
  )
}

const FORMAS_PAGAMENTO = [
  { value: 'pix',      label: 'PIX',      img: '/pix.png' },
  { value: 'dinheiro', label: 'Dinheiro', icon: '💵' },
  { value: 'credito',  label: 'Crédito',  img: '/credito.webp' },
  { value: 'debito',   label: 'Débito',   img: '/debito.png' },
  { value: 'fiado',    label: 'Fiado',    icon: '🤝' },
]

const STATUS_PAG = {
  pendente: { label: 'Pendente',       color: '#d97706', bg: '#fef3c7', dot: '#f59e0b' },
  parcial:  { label: 'Sinal recebido', color: '#3b82f6', bg: '#eff6ff', dot: '#3b82f6' },
  pago:     { label: 'Pago',           color: '#16a34a', bg: '#f0fdf4', dot: '#22c55e' },
} as const

export default function StepPagamento({ pedido, set, cupons, saving, onSalvar, onSalvarEIniciar, onBack, isEdicao }: Props) {
  const [showSinal, setShowSinal] = useState(pedido.valor_sinal > 0)
  const [showDesconto, setShowDesconto] = useState(pedido.desconto > 0 || !!pedido.cupom_codigo)

  const totalPago = pedido.valor_sinal + pedido.valor_recebido
  const valorRestante = Math.max(0, pedido.valor_total - totalPago)
  const statusPagAuto: keyof typeof STATUS_PAG =
    valorRestante === 0 && pedido.valor_total > 0 ? 'pago'
    : totalPago > 0 ? 'parcial'
    : 'pendente'

  const pagStatus = STATUS_PAG[statusPagAuto]

  const aplicarCupom = (cup: any) => {
    if (!cup) { set('cupom_codigo', ''); set('cupom_desconto', 0); return }
    const desc = cup.tipo === 'percentual' ? (pedido.valor_produtos * cup.desconto) / 100 : cup.desconto
    set('cupom_codigo', cup.codigo)
    set('cupom_desconto', desc)
  }

  return (
    <div className="step-root">

      {/* ── Total sempre visível ── */}
      <div className="pf2-total-bar">
        <div>
          <p className="pf2-total-label">Total do pedido</p>
          {(pedido.desconto > 0 || pedido.cupom_desconto > 0) && (
            <p className="pf2-total-original">{formatMoney(pedido.valor_produtos + pedido.taxa_entrega)}</p>
          )}
        </div>
        <p className="pf2-total-value">{formatMoney(pedido.valor_total)}</p>
      </div>

      {/* ── Bloco: Pagamento ── */}
      <div className="pf2-card">
        <div className="pf2-card-head-row">
          <p className="pf2-card-eyebrow" style={{ margin: 0 }}>Como vai pagar?</p>
          <span className="pf2-pag-badge" style={{ background: pagStatus.bg, color: pagStatus.color }}>
            <span className="pf2-pag-dot" style={{ background: pagStatus.dot }} />
            {pagStatus.label}
          </span>
        </div>

        {/* Formas de pagamento */}
        <div className="pf2-pay-grid">
          {FORMAS_PAGAMENTO.map(f => (
            <button
              key={f.value}
              type="button"
              className={`pf2-pay-btn${pedido.forma_pagamento === f.value ? ' pf2-pay-btn--on' : ''}`}
              onClick={() => set('forma_pagamento', f.value)}
            >
              {'img' in f
                ? <img src={(f as any).img} alt={f.label} style={{ width: 26, height: 26, objectFit: 'contain' }} />
                : <span style={{ fontSize: '1.15rem' }}>{(f as any).icon}</span>
              }
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        {/* Opcional: Sinal */}
        <div
          className={`pf2-optional-toggle${showSinal ? ' pf2-optional-toggle--on' : ''}`}
          onClick={() => { if (showSinal) { set('valor_sinal', 0); set('data_sinal', '') }; setShowSinal(v => !v) }}
        >
          <div className={`pf2-check${showSinal ? ' pf2-check--on' : ''}`}>
            {showSinal && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <span className="pf2-opt-label">Sinal recebido</span>
          {pedido.valor_sinal > 0 && !showSinal && (
            <span className="pf2-opt-badge" style={{ color: '#3b82f6' }}>{formatMoney(pedido.valor_sinal)}</span>
          )}
        </div>
        {showSinal && (
          <div className="pf2-optional-body">
            <div className="pf2-row">
              <div className="pf2-field">
                <label className="pf2-label">Valor do sinal</label>
                <MoneyInput value={pedido.valor_sinal} onChange={v => set('valor_sinal', v)} />
              </div>
              <div className="pf2-field">
                <label className="pf2-label">Data do sinal</label>
                <input className="pf2-input" type="date" value={pedido.data_sinal} onChange={e => set('data_sinal', e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Opcional: Desconto / Cupom */}
        <div
          className={`pf2-optional-toggle${showDesconto ? ' pf2-optional-toggle--on' : ''}`}
          onClick={() => {
            if (showDesconto) { set('desconto', 0); set('cupom_codigo', ''); set('cupom_desconto', 0) }
            setShowDesconto(v => !v)
          }}
        >
          <div className={`pf2-check${showDesconto ? ' pf2-check--on' : ''}`}>
            {showDesconto && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <span className="pf2-opt-label">Desconto ou cupom</span>
          {(pedido.desconto > 0 || pedido.cupom_desconto > 0) && !showDesconto && (
            <span className="pf2-opt-badge" style={{ color: '#16a34a' }}>
              -{formatMoney(pedido.desconto + pedido.cupom_desconto)}
            </span>
          )}
        </div>
        {showDesconto && (
          <div className="pf2-optional-body">
            <div className="pf2-row">
              <div className="pf2-field">
                <label className="pf2-label">Desconto manual</label>
                <MoneyInput value={pedido.desconto} onChange={v => set('desconto', v)} />
              </div>
              {cupons.length > 0 && (
                <div className="pf2-field">
                  <label className="pf2-label">Cupom</label>
                  <select
                    className="pf2-input"
                    value={pedido.cupom_codigo}
                    onChange={e => aplicarCupom(cupons.find(c => c.codigo === e.target.value) || null)}
                  >
                    <option value="">Selecionar...</option>
                    {cupons.map(c => (
                      <option key={c.id} value={c.codigo}>
                        {c.codigo} — {c.tipo === 'percentual' ? `${c.desconto}%` : formatMoney(c.desconto)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {pedido.cupom_desconto > 0 && (
              <p style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600, marginTop: '0.25rem' }}>
                Cupom aplicado: -{formatMoney(pedido.cupom_desconto)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Bloco: Valor pago + restante ── */}
      <div className="pf2-card">
        <p className="pf2-card-eyebrow">Recebimento</p>
        <div className="pf2-row">
          <div className="pf2-field">
            <label className="pf2-label">Valor pago na entrega</label>
            <MoneyInput value={pedido.valor_recebido} onChange={v => set('valor_recebido', v)} />
          </div>
          <div className="pf2-field">
            <label className="pf2-label">Restante</label>
            <div className="pf2-input pf2-input--readonly" style={{ color: valorRestante > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
              {formatMoney(valorRestante)}
            </div>
          </div>
        </div>
        {valorRestante > 0 && (
          <div className="pf2-field" style={{ maxWidth: '50%' }}>
            <label className="pf2-label">Receber restante em</label>
            <input className="pf2-input" type="date" value={pedido.data_pagamento_restante} onChange={e => set('data_pagamento_restante', e.target.value)} />
          </div>
        )}
      </div>

      {/* ── Resumo financeiro ── */}
      <div className="pf2-resumo">
        <div className="pf2-resumo-row">
          <span>Produtos</span>
          <span>{formatMoney(pedido.valor_produtos)}</span>
        </div>
        {pedido.taxa_entrega > 0 && (
          <div className="pf2-resumo-row">
            <span>Taxa de entrega</span>
            <span>{formatMoney(pedido.taxa_entrega)}</span>
          </div>
        )}
        {pedido.desconto > 0 && (
          <div className="pf2-resumo-row pf2-resumo-row--desconto">
            <span>↓ Desconto</span>
            <span>-{formatMoney(pedido.desconto)}</span>
          </div>
        )}
        {pedido.cupom_desconto > 0 && (
          <div className="pf2-resumo-row pf2-resumo-row--desconto">
            <span>🏷️ {pedido.cupom_codigo}</span>
            <span>-{formatMoney(pedido.cupom_desconto)}</span>
          </div>
        )}
        <div className="pf2-resumo-total">
          <span>Total</span>
          <span>{formatMoney(pedido.valor_total)}</span>
        </div>
      </div>

      {/* ── Rodapé ── */}
      <div className="pf2-footer">
        <button className="pf2-btn-ghost pf2-btn-back" onClick={onBack} disabled={saving}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar
        </button>
        <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
          {!isEdicao && (
            <button className="pf2-btn-ghost" style={{ flex: 1 }} onClick={onSalvarEIniciar} disabled={saving}>
              Salvar e novo
            </button>
          )}
          <button className="pf2-btn-salvar" style={{ flex: 2 }} onClick={onSalvar} disabled={saving}>
            {saving ? 'Salvando...' : isEdicao ? 'Salvar alterações' : '✓ Salvar pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}

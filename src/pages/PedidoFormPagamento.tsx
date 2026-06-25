import { useState, useRef, useEffect } from 'react'
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

type ModoRecebimento = 'integral' | 'sinal' | 'entrega'

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

export default function StepPagamento({ pedido, set, cupons, saving, onSalvar, onBack, isEdicao }: Props) {
  const [showDesconto, setShowDesconto] = useState(pedido.desconto > 0 || !!pedido.cupom_codigo)

  // Detecta modo inicial baseado no estado do pedido
  const getModoInicial = (): ModoRecebimento => {
    if (pedido.valor_recebido >= pedido.valor_total && pedido.valor_total > 0) return 'integral'
    if (pedido.valor_sinal > 0) return 'sinal'
    return 'entrega'
  }
  const [modo, setModo] = useState<ModoRecebimento>(getModoInicial)

  const handleModo = (novoModo: ModoRecebimento) => {
    setModo(novoModo)
    // Limpa valores anteriores ao trocar
    set('valor_sinal', 0)
    set('data_sinal', '')
    set('valor_recebido', novoModo === 'integral' ? pedido.valor_total : 0)
  }

  // Recalcula valor_recebido quando o total muda e o modo é "integral".
  // Fica num useEffect (e não direto no corpo do componente) porque aqui
  // estamos atualizando o estado do componente PAI (via `set`) a partir de
  // uma mudança detectada no filho — fazer isso durante o render é um
  // anti-padrão no React e pode gerar o warning "Cannot update a component
  // while rendering a different component".
  useEffect(() => {
    if (modo === 'integral' && pedido.valor_total > 0 && pedido.valor_recebido !== pedido.valor_total) {
      set('valor_recebido', pedido.valor_total)
    }
  }, [modo, pedido.valor_total, pedido.valor_recebido, set])

  const totalRecebido = pedido.valor_recebido
  const restante = Math.max(0, pedido.valor_total - totalRecebido)
  const statusPag: 'pendente' | 'parcial' | 'pago' =
    restante === 0 && pedido.valor_total > 0 ? 'pago'
    : totalRecebido > 0 ? 'parcial'
    : 'pendente'

  const STATUS_CONFIG = {
    pendente: { label: 'Pendente',   color: '#d97706', bg: '#fef3c7', dot: '#f59e0b' },
    parcial:  { label: 'Sinal pago', color: '#3b82f6', bg: '#eff6ff', dot: '#3b82f6' },
    pago:     { label: 'Pago',       color: '#16a34a', bg: '#f0fdf4', dot: '#22c55e' },
  }
  const sc = STATUS_CONFIG[statusPag]

  const aplicarCupom = (cup: any) => {
    if (!cup) { set('cupom_codigo', ''); set('cupom_desconto', 0); return }
    const desc = cup.tipo === 'percentual' ? (pedido.valor_produtos * cup.desconto) / 100 : cup.desconto
    set('cupom_codigo', cup.codigo)
    set('cupom_desconto', desc)
  }

  const MODOS: { key: ModoRecebimento; label: string }[] = [
    { key: 'integral', label: 'Pago integralmente' },
    { key: 'sinal',    label: 'Recebi um sinal' },
    { key: 'entrega',  label: 'Receber na entrega' },
  ]

  return (
    <div className="step-root">

      {/* ── Status do pedido ── */}
      <div className="pf2-card">
        <p className="pf2-card-eyebrow">Status do pedido no Kanban</p>
        <div className="pf2-status-grid">
          {[
            { key: 'novo',        label: '🆕 Novo' },
            { key: 'em_producao', label: '🍰 Em Produção' },
            { key: 'pronto',      label: '✅ Pronto' },
            { key: 'a_caminho',   label: '🚗 A Caminho / Retirado' },
            { key: 'concluido',   label: '🎉 Concluído' },
          ].map(s => (
            <button
              key={s.key}
              type="button"
              className={`pf2-status-btn${pedido.status === s.key ? ' pf2-status-btn--on' : ''}`}
              onClick={() => set('status', s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Total fixo no topo ── */}
      <div className="pf2-total-bar">
        <div>
          <p className="pf2-total-label">Total do pedido</p>
          {(pedido.desconto > 0 || pedido.cupom_desconto > 0) && (
            <p className="pf2-total-original">{formatMoney(pedido.valor_produtos + pedido.taxa_entrega)}</p>
          )}
        </div>
        <p className="pf2-total-value">{formatMoney(pedido.valor_total)}</p>
      </div>

      {/* ── Forma de pagamento ── */}
      <div className="pf2-card">
        <p className="pf2-card-eyebrow">Como vai pagar?</p>
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
            <span className="pf2-opt-badge" style={{ color: '#16a34a' }}>-{formatMoney(pedido.desconto + pedido.cupom_desconto)}</span>
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
                  <select className="pf2-input" value={pedido.cupom_codigo} onChange={e => aplicarCupom(cupons.find(c => c.codigo === e.target.value) || null)}>
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
          </div>
        )}
      </div>

      {/* ── Recebimento ── */}
      <div className="pf2-card">
        <div className="pf2-card-head-row">
          <p className="pf2-card-eyebrow" style={{ margin: 0 }}>Como será o recebimento?</p>
          <span className="pf2-status-pill" style={{ background: sc.bg, color: sc.color }}>
            <span className="pf2-status-dot" style={{ background: sc.dot }} />
            {sc.label}
          </span>
        </div>

        {/* Radio options */}
        <div className="pf2-receb-opcoes">
          {MODOS.map(m => (
            <button
              key={m.key}
              type="button"
              className={`pf2-receb-opcao${modo === m.key ? ' pf2-receb-opcao--on' : ''}`}
              onClick={() => handleModo(m.key)}
            >
              <div className={`pf2-radio${modo === m.key ? ' pf2-radio--on' : ''}`}>
                {modo === m.key && <div className="pf2-radio-dot" />}
              </div>
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Detalhe: Sinal */}
        {modo === 'sinal' && (
          <div className="pf2-optional-body" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="pf2-row">
              <div className="pf2-field">
                <label className="pf2-label">Valor do sinal</label>
                <MoneyInput
                  value={pedido.valor_sinal}
                  onChange={v => {
                    set('valor_sinal', v)
                    set('valor_recebido', v)
                  }}
                />
              </div>
              <div className="pf2-field">
                <label className="pf2-label">Data do sinal</label>
                <input className="pf2-input" type="date" value={pedido.data_sinal} onChange={e => set('data_sinal', e.target.value)} />
              </div>
            </div>
            {pedido.valor_sinal > 0 && restante > 0 && (
              <div className="pf2-receb-restante">
                <span>Falta receber na entrega</span>
                <span style={{ color: '#dc2626', fontWeight: 700 }}>{formatMoney(restante)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Resumo financeiro ── */}
      <div className="pf2-resumo">
        <div className="pf2-resumo-row"><span>Produtos</span><span>{formatMoney(pedido.valor_produtos)}</span></div>
        {pedido.taxa_entrega > 0 && <div className="pf2-resumo-row"><span>Taxa de entrega</span><span>{formatMoney(pedido.taxa_entrega)}</span></div>}
        {pedido.desconto > 0 && <div className="pf2-resumo-row pf2-resumo-row--desconto"><span>↓ Desconto</span><span>-{formatMoney(pedido.desconto)}</span></div>}
        {pedido.cupom_desconto > 0 && <div className="pf2-resumo-row pf2-resumo-row--desconto"><span>🏷️ {pedido.cupom_codigo}</span><span>-{formatMoney(pedido.cupom_desconto)}</span></div>}
        <div className="pf2-resumo-total"><span>Total</span><span>{formatMoney(pedido.valor_total)}</span></div>
      </div>

      {/* ── Rodapé ── */}
      <div className="pf2-footer">
        <button className="pf2-btn-ghost pf2-btn-back" onClick={onBack} disabled={saving}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar
        </button>
        <button className="pf2-btn-salvar" style={{ flex: 1 }} onClick={onSalvar} disabled={saving}>
          {saving ? 'Salvando...' : isEdicao ? '✓ Salvar alterações' : '✓ Salvar pedido'}
        </button>
      </div>


      <div className="pf2-desktop-save">
        <button className="pf2-btn-salvar" style={{ width: '100%', padding: '0.85rem' }} onClick={onSalvar} disabled={saving}>
          {saving ? 'Salvando...' : isEdicao ? '✓ Salvar alterações' : '✓ Salvar pedido'}
        </button>
      </div>

      <style>{`
        .pf2-desktop-save { display: none; }
        @media (min-width: 768px) {
          .pf2-desktop-save { display: block; margin-top: 0.5rem; }
          .pf2-footer { display: none !important; }
        }

        .pf2-receb-opcoes {
          display: flex; flex-direction: column;
          padding: 0.5rem 1rem 0.75rem;
          gap: var(--gap-tight);
        }
        .pf2-receb-opcao {
          display: flex; align-items: center; gap: var(--gap-stack);
          padding: 0.75rem 1rem;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          background: var(--bg-body);
          font-size: var(--font-button); font-weight: var(--fw-medium);
          color: var(--text-secondary);
          font-family: 'Geist',sans-serif;
          cursor: pointer; transition: all var(--dur-fast);
          text-align: left; width: 100%;
        }
        .pf2-receb-opcao:hover { border-color: var(--primary); }
        .pf2-receb-opcao--on {
          border-color: var(--primary);
          background: var(--primary-light);
          color: var(--text-title);
          font-weight: var(--fw-semibold);
        }
        .pf2-radio {
          width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
          border: 2px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          transition: all var(--dur-fast);
        }
        .pf2-radio--on { border-color: var(--primary); }
        .pf2-radio-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--primary);
        }
        .pf2-receb-restante {
          display: flex; justify-content: space-between;
          padding: 0.5rem 0; margin-top: 0.25rem;
          font-size: var(--font-button); color: var(--text-secondary);
          border-top: 1px dashed var(--border);
        }
        .pf2-card-head-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.85rem 1rem 0; margin-bottom: 0;
        }
        .pf2-status-pill {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: var(--font-caption); font-weight: var(--fw-semibold);
          padding: 4px 10px; border-radius: var(--radius-full);
        }
        .pf2-status-grid {
          display: flex; flex-direction: column; gap: 0.4rem;
          padding: 0.5rem 1rem 0.75rem;
        }
        .pf2-status-btn {
          display: flex; align-items: center;
          padding: 0.6rem 1rem;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          background: var(--bg-body);
          font-size: var(--font-button); font-weight: var(--fw-medium);
          color: var(--text-secondary);
          font-family: 'Geist',sans-serif;
          cursor: pointer; transition: all var(--dur-fast);
          text-align: left; width: 100%;
        }
        .pf2-status-btn:hover { border-color: var(--primary); }
        .pf2-status-btn--on {
          border-color: var(--primary);
          background: var(--primary-light);
          color: var(--text-title);
          font-weight: var(--fw-bold);
        }
        .pf2-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
      `}</style>
    </div>
  )
}

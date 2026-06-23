import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"

const PAGAMENTOS = [
  { key: 'pix',                label: 'Pix' },
  { key: 'dinheiro',           label: 'Dinheiro' },
  { key: 'credito',            label: 'Cartão de Crédito' },
  { key: 'debito',             label: 'Cartão de Débito' },
  { key: 'link_pagamento',     label: 'Link de Pagamento' },
  { key: 'mercado_pago',       label: 'Mercado Pago' },
  { key: 'pagamento_retirada', label: 'Pagamento na Retirada' },
]

const ENTREGAS = [
  { key: 'retirada',        label: 'Retirada no local' },
  { key: 'entrega_propria', label: 'Entrega própria' },
  { key: 'motoboy',         label: 'Motoboy' },
  { key: 'uber_flash',      label: 'Uber Flash' },
  { key: 'combinar',        label: 'Combinar pelo WhatsApp' },
]

const SectionLabel = ({ children, icon, sub }: any) => (
  <div className="chk-section-header">
    {icon && <div className="chk-section-icon">{icon}</div>}
    <div style={{ flex: 1, minWidth: 0 }}>
      <p className="chk-section-label">{children}</p>
      {sub && <p className="chk-section-sub">{sub}</p>}
    </div>
  </div>
)

const Check = ({ active, label, onClick }: any) => (
  <div className={`chk-check${active ? ' chk-check--active' : ''}`} onClick={onClick}>
    <span className="chk-check-label">{label}</span>
    <div className="chk-checkbox">
      {active && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
    </div>
  </div>
)

const Toggle = ({ checked, onChange }: any) => (
  <label className="chk-toggle">
    <input type="checkbox" checked={checked} onChange={onChange} />
    <span className="chk-toggle-slider" />
  </label>
)

export default function CheckoutConfigPage() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [autoSaved, setAutoSaved] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [formasPagamento, setFormasPagamento] = useState<string[]>(['pix'])
  const [formasEntrega, setFormasEntrega] = useState<string[]>(['retirada'])
  const [valorEntregaPropria, setValorEntregaPropria] = useState('')
  const [entregaPorBairro, setEntregaPorBairro] = useState<{ bairro: string; valor: string }[]>([])
  const [enderecoRetirada, setEnderecoRetirada] = useState('')
  const [horarioRetirada, setHorarioRetirada] = useState('')
  const [exibirCampoTroco, setExibirCampoTroco] = useState(true)
  const [cupons, setCupons] = useState<{ codigo: string; tipo: string; valor: string; ativo: boolean }[]>([])
  const [aceitaAgendamento, setAceitaAgendamento] = useState(true)
  const [prazoMinimo, setPrazoMinimo] = useState('24')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase.from('profiles').select('formas_pagamento, formas_entrega, valor_entrega_propria, entrega_por_bairro, endereco_retirada, horario_retirada, exibir_campo_troco, cupons_desconto, aceita_agendamento, prazo_minimo_horas').eq('id', user.id).single()
      if (data) {
        setFormasPagamento(data.formas_pagamento || ['pix'])
        setFormasEntrega(data.formas_entrega || ['retirada'])
        setValorEntregaPropria(data.valor_entrega_propria ? data.valor_entrega_propria.toString() : '')
        setEntregaPorBairro((data.entrega_por_bairro || []).map((b: any) => ({ bairro: b.bairro, valor: b.valor?.toString() || '0' })))
        setEnderecoRetirada(data.endereco_retirada || '')
        setHorarioRetirada(data.horario_retirada || '')
        setExibirCampoTroco(data.exibir_campo_troco !== false)
        setCupons((data.cupons_desconto || []).map((c: any) => ({ ...c, valor: c.valor?.toString() || '0' })))
        setAceitaAgendamento(data.aceita_agendamento !== false)
        setPrazoMinimo(data.prazo_minimo_horas?.toString() || '24')
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (loading || !userId) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      await supabase.from('profiles').update({
        formas_pagamento: formasPagamento,
        formas_entrega: formasEntrega,
        valor_entrega_propria: valorEntregaPropria ? parseFloat(valorEntregaPropria) : 0,
        entrega_por_bairro: entregaPorBairro.filter(b => b.bairro.trim()).map(b => ({ bairro: b.bairro, valor: parseFloat(b.valor) || 0 })),
        endereco_retirada: enderecoRetirada,
        horario_retirada: horarioRetirada,
        exibir_campo_troco: exibirCampoTroco,
        cupons_desconto: cupons.filter(c => c.codigo.trim()).map(c => ({ ...c, valor: parseFloat(c.valor) || 0 })),
        aceita_agendamento: aceitaAgendamento,
        prazo_minimo_horas: parseInt(prazoMinimo) || 24,
      }).eq('id', userId)
      setAutoSaved(true)
      setTimeout(() => setAutoSaved(false), 2000)
    }, 2000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [formasPagamento, formasEntrega, valorEntregaPropria, entregaPorBairro, enderecoRetirada, horarioRetirada, exibirCampoTroco, cupons, aceitaAgendamento, prazoMinimo])

  const togglePagamento = (key: string) => {
    setFormasPagamento(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }
  const toggleEntrega = (key: string) => {
    setFormasEntrega(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }
  const addBairro = () => setEntregaPorBairro(prev => [...prev, { bairro: '', valor: '' }])
  const removeBairro = (i: number) => setEntregaPorBairro(prev => prev.filter((_, idx) => idx !== i))
  const addCupom = () => setCupons(prev => [...prev, { codigo: '', tipo: 'percentual', valor: '', ativo: true }])
  const removeCupom = (i: number) => setCupons(prev => prev.filter((_, idx) => idx !== i))

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'40vh'}}>
      <div className="chk-spinner" />
      <style>{`@keyframes chkspin{to{transform:rotate(360deg)}} .chk-spinner{width:32px;height:32px;border:3px solid var(--primary-light, #FFF1F7);border-top-color:var(--primary, #FF6FA9);border-radius:50%;animation:chkspin 0.7s linear infinite}`}</style>
    </div>
  )

  return (
    <>
      <div className="chk-root">
        <div className="chk-header">
          <div>
            <h1 className="chk-title">Configurações do Checkout</h1>
            <p className="chk-sub">Configure pagamento, entrega e cupons do seu cardápio</p>
          </div>
          {autoSaved && <span className="chk-autosave">✓ Salvo automaticamente</span>}
        </div>

        <div className="chk-grid">

          {/* ── COLUNA 1: Formas de Pagamento ── */}
          <div className="chk-card">
            <SectionLabel
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="3"/><line x1="2" y1="10" x2="22" y2="10"/></svg>}
              sub="Marque apenas as que você aceita"
            >Formas de pagamento</SectionLabel>

            <div className="chk-list">
              {PAGAMENTOS.map(p => (
                <Check key={p.key} active={formasPagamento.includes(p.key)} label={p.label} onClick={() => togglePagamento(p.key)} />
              ))}
            </div>

            {formasPagamento.includes('dinheiro') && (
              <>
                <hr className="chk-divider" />
                <div className="chk-toggle-row">
                  <div>
                    <p className="chk-toggle-label">Exibir campo "Troco para"</p>
                    <p className="chk-toggle-sub">Quando o cliente pagar em dinheiro</p>
                  </div>
                  <Toggle checked={exibirCampoTroco} onChange={(e: any) => setExibirCampoTroco(e.target.checked)} />
                </div>
              </>
            )}
          </div>

          {/* ── COLUNA 2: Formas de Entrega ── */}
          <div className="chk-card">
            <SectionLabel
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="6" width="15" height="12" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>}
              sub="Marque as opções disponíveis"
            >Formas de entrega</SectionLabel>

            <div className="chk-list">
              {ENTREGAS.map(e => (
                <Check key={e.key} active={formasEntrega.includes(e.key)} label={e.label} onClick={() => toggleEntrega(e.key)} />
              ))}
            </div>

            {formasEntrega.includes('retirada') && (
              <>
                <hr className="chk-divider" />
                <p className="chk-sublabel">Endereço de retirada</p>
                <input className="chk-input" value={enderecoRetirada} onChange={e => setEnderecoRetirada(e.target.value)} placeholder="Rua, número, bairro..." />
                <input className="chk-input" value={horarioRetirada} onChange={e => setHorarioRetirada(e.target.value)} placeholder="Horário de retirada (ex: 08h às 18h)" />
              </>
            )}

            {formasEntrega.includes('entrega_propria') && (
              <>
                <hr className="chk-divider" />
                <p className="chk-sublabel">Valor da entrega própria</p>
                <div className="chk-money-row">
                  <span className="chk-prefix">R$</span>
                  <input className="chk-input" style={{width:'120px'}} value={valorEntregaPropria} onChange={e => setValorEntregaPropria(e.target.value.replace(/[^0-9.,]/g,''))} placeholder="0,00" />
                </div>
                <div className="chk-row-between">
                  <p className="chk-sublabel">Valor por bairro (opcional)</p>
                  <button onClick={addBairro} className="chk-btn-add">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Bairro
                  </button>
                </div>
                {entregaPorBairro.map((b, i) => (
                  <div key={i} className="chk-bairro-row">
                    <input className="chk-input" style={{flex:1}} value={b.bairro} onChange={e => setEntregaPorBairro(prev => prev.map((x,j) => j===i ? {...x, bairro:e.target.value} : x))} placeholder="Nome do bairro" />
                    <div className="chk-money-row">
                      <span className="chk-prefix">R$</span>
                      <input className="chk-input" style={{width:'80px'}} value={b.valor} onChange={e => setEntregaPorBairro(prev => prev.map((x,j) => j===i ? {...x, valor:e.target.value.replace(/[^0-9.,]/g,'')} : x))} placeholder="0,00" />
                    </div>
                    <button onClick={() => removeBairro(i)} className="chk-btn-remove" aria-label="Remover bairro">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* ── COLUNA 3: Agendamento + Cupons ── */}
          <div className="chk-stack">

            {/* ── AGENDAMENTO ── */}
            <div className="chk-card">
              <SectionLabel
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
                sub="Cliente escolhe data e horário de entrega/retirada"
              >Agendamento</SectionLabel>

              <div className="chk-toggle-row">
                <p className="chk-toggle-label">Aceitar agendamento</p>
                <Toggle checked={aceitaAgendamento} onChange={(e: any) => setAceitaAgendamento(e.target.checked)} />
              </div>

              {aceitaAgendamento && (
                <div className="chk-prazo-row">
                  <span>Prazo mínimo de antecedência:</span>
                  <input className="chk-input" style={{width:'64px',textAlign:'center'}} value={prazoMinimo} onChange={e => setPrazoMinimo(e.target.value.replace(/\D/g,''))} />
                  <span className="chk-muted">horas</span>
                </div>
              )}
            </div>

            {/* ── CUPONS ── */}
            <div className="chk-card">
              <div className="chk-row-between" style={{alignItems:'flex-start'}}>
                <SectionLabel
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>}
                  sub="Crie códigos promocionais"
                >Cupons</SectionLabel>
                <button onClick={addCupom} className="chk-btn-add" style={{marginTop:'4px'}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Cupom
                </button>
              </div>

              {cupons.length === 0 && (
                <div className="chk-cupons-empty">
                  <div className="chk-cupons-empty-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>
                  </div>
                  <p className="chk-cupons-empty-text">Nenhum cupom ainda. Toque em <strong>+ Cupom</strong> para criar.</p>
                </div>
              )}

              {cupons.map((c, i) => (
                <div key={i} className={`chk-cupom-card${c.ativo ? '' : ' chk-cupom-card--inactive'}`}>
                  <div className="chk-cupom-top">
                    <div className="chk-cupom-tag">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                    </div>
                    <input className="chk-cupom-codigo" value={c.codigo} onChange={e => setCupons(prev => prev.map((x,j) => j===i ? {...x, codigo:e.target.value.toUpperCase()} : x))} placeholder="CÓDIGO" />
                  </div>
                  <div className="chk-cupom-row">
                    <select className="chk-input chk-cupom-select" value={c.tipo} onChange={e => setCupons(prev => prev.map((x,j) => j===i ? {...x, tipo:e.target.value} : x))}>
                      <option value="percentual">% Percentual</option>
                      <option value="fixo">R$ Fixo</option>
                    </select>
                    <div className="chk-money-row" style={{flex:1}}>
                      <span className="chk-prefix">{c.tipo === 'percentual' ? '%' : 'R$'}</span>
                      <input className="chk-input" style={{textAlign:'center'}} value={c.valor} onChange={e => setCupons(prev => prev.map((x,j) => j===i ? {...x, valor:e.target.value.replace(/[^0-9.,]/g,'')} : x))} placeholder="0" />
                    </div>
                  </div>
                  <div className="chk-cupom-footer">
                    <label className="chk-cupom-ativo">
                      <Toggle checked={c.ativo} onChange={(e: any) => setCupons(prev => prev.map((x,j) => j===i ? {...x, ativo:e.target.checked} : x))} />
                      <span>{c.ativo ? 'Ativo' : 'Inativo'}</span>
                    </label>
                    <button onClick={() => removeCupom(i)} className="chk-cupom-remove">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>{/* fim chk-stack */}

        </div>{/* fim chk-grid */}
      </div>

      <style>{`
        @keyframes chkspin { to { transform:rotate(360deg); } }
        @keyframes chkFadeIn { from{opacity:0} to{opacity:1} }

        .chk-root { font-family:'Geist', sans-serif; width:100%; display:flex; flex-direction:column; gap:1.25rem; }
        .chk-header { display:flex; align-items:flex-end; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; padding:0.5rem 0; }
        .chk-title { font-size:1.4rem; font-weight:700; color:var(--text-title, #1F2937); margin:0 0 0.3rem; letter-spacing:-0.02em; }
        .chk-sub { font-size:0.86rem; color:var(--text-secondary, #6B7280); margin:0; }
        .chk-autosave { display:inline-flex; align-items:center; gap:0.35rem; font-size:0.76rem; font-weight:600; color:var(--success, #22C55E); background:#f0fdf4; padding:0.32rem 0.8rem; border-radius:50px; border:1px solid #dcfce7; animation:chkFadeIn 0.3s ease; }

        /* ── Grid ── */
        .chk-grid { display:flex; flex-direction:column; gap:1.25rem; }
        @media (min-width:900px) {
          .chk-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:1.25rem; align-items:start; }
          .chk-stack { display:flex; flex-direction:column; gap:1.25rem; }
        }

        /* ── Card ── */
        .chk-card {
          background:var(--bg-card, #FFFFFF); border-radius:20px; padding:1.4rem;
          box-shadow:var(--shadow-card, 0 2px 12px rgba(0,0,0,0.05));
          border:1px solid var(--border, #E9E9EE);
          display:flex; flex-direction:column; gap:0.85rem;
          width:100%; box-sizing:border-box;
          position:relative; overflow:hidden;
          transition:box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .chk-card::before {
          content:""; position:absolute; top:-60px; right:-60px;
          width:140px; height:140px;
          background:radial-gradient(circle, var(--primary-light, #FFF1F7) 0%, transparent 70%);
          pointer-events:none; opacity:0.7;
        }
        .chk-card:hover {
          box-shadow:0 4px 24px rgba(255,111,169,0.08), 0 1px 2px rgba(16,24,40,0.04);
          border-color:rgba(255,111,169,0.18);
        }
        .chk-card > * { position:relative; z-index:1; }

        /* ── Section header ── */
        .chk-section-header { display:flex; align-items:center; gap:0.7rem; padding-bottom:1rem; border-bottom:1px solid var(--border, #E9E9EE); }
        .chk-section-icon {
          width:36px; height:36px; flex-shrink:0; border-radius:11px;
          background:var(--primary-light, #FFF1F7); color:var(--primary, #FF6FA9);
          display:flex; align-items:center; justify-content:center;
        }
        .chk-section-label { font-size:0.95rem; font-weight:700; color:var(--text-title, #1F2937); margin:0; letter-spacing:-0.01em; }
        .chk-section-sub { font-size:0.74rem; color:var(--text-muted, #9CA3AF); margin:0.1rem 0 0; line-height:1.3; }

        .chk-sublabel { margin:0; font-size:0.82rem; font-weight:600; color:var(--text-primary, #374151); }
        .chk-muted { font-size:0.82rem; color:var(--text-muted, #9CA3AF); }
        .chk-divider { border:none; border-top:1px solid var(--border, #E9E9EE); margin:0.25rem 0; }
        .chk-row-between { display:flex; align-items:center; justify-content:space-between; gap:0.5rem; }

        /* ── Checklist (Check component) ── */
        .chk-list { display:flex; flex-direction:column; gap:0.45rem; }
        .chk-check {
          display:flex; align-items:center; gap:0.75rem;
          padding:0.72rem 0.9rem; border-radius:12px;
          border:1.5px solid var(--border, #E9E9EE);
          background:var(--bg-card, #FFFFFF);
          cursor:pointer; transition:all 0.18s;
        }
        .chk-check:hover {
          border-color:rgba(255,111,169,0.45);
          background:var(--primary-light, #FFF1F7);
          transform:translateY(-1px);
        }
        .chk-check--active {
          border-color:var(--primary, #FF6FA9);
          background:var(--primary-light, #FFF1F7);
          box-shadow:0 2px 8px rgba(255,111,169,0.12);
        }
        .chk-check-label {
          flex:1; font-size:0.88rem; font-weight:500;
          color:var(--text-primary, #374151);
        }
        .chk-check--active .chk-check-label {
          font-weight:700; color:var(--primary-dark, #F85A9A);
        }
        .chk-checkbox {
          width:22px; height:22px; border-radius:7px;
          border:2px solid var(--border, #E9E9EE);
          background:transparent;
          display:flex; align-items:center; justify-content:center;
          transition:all 0.18s; flex-shrink:0;
        }
        .chk-check--active .chk-checkbox {
          border-color:transparent;
          background:var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A));
          box-shadow:0 2px 6px rgba(255,111,169,0.32);
        }

        /* ── Input ── */
        .chk-input {
          width:100%; padding:0.65rem 0.95rem;
          border:1.5px solid var(--border, #E9E9EE); border-radius:10px;
          font-family:'Geist', sans-serif; font-size:0.88rem;
          color:var(--text-title, #1F2937); outline:none;
          box-sizing:border-box; background:var(--bg-input, #FFFFFF);
          transition:border-color 0.15s, box-shadow 0.15s;
        }
        .chk-input:hover { border-color:var(--text-muted, #9CA3AF); }
        .chk-input:focus { border-color:var(--primary, #FF6FA9); box-shadow:0 0 0 3px rgba(255,111,169,0.12); }

        .chk-money-row { display:flex; align-items:center; gap:0.4rem; }
        .chk-prefix { font-size:0.85rem; font-weight:600; color:var(--text-secondary, #6B7280); flex-shrink:0; }

        /* ── Bairro row ── */
        .chk-bairro-row { display:flex; gap:0.5rem; align-items:center; }
        .chk-btn-remove {
          padding:0.5rem; background:#fff5f5;
          border:1.5px solid #fee2e2; border-radius:10px;
          cursor:pointer; display:flex; align-items:center; justify-content:center;
          color:var(--error, #EF4444); transition:all 0.15s; flex-shrink:0;
        }
        .chk-btn-remove:hover { background:#fee2e2; border-color:#fca5a5; }

        /* ── Botão add ── */
        .chk-btn-add {
          display:inline-flex; align-items:center; gap:5px;
          padding:0.45rem 0.95rem;
          background:var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A));
          color:#fff; border:none; border-radius:50px;
          font-family:'Geist', sans-serif; font-size:0.78rem; font-weight:700;
          cursor:pointer; white-space:nowrap;
          box-shadow:0 2px 8px rgba(255,111,169,0.3);
          transition:transform 0.15s, box-shadow 0.15s;
        }
        .chk-btn-add:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(255,111,169,0.4); }

        /* ── Toggle ── */
        .chk-toggle-row { display:flex; justify-content:space-between; align-items:center; gap:1rem; }
        .chk-toggle-label { margin:0; font-size:0.86rem; font-weight:600; color:var(--text-primary, #374151); }
        .chk-toggle-sub { margin:0.1rem 0 0; font-size:0.72rem; color:var(--text-muted, #9CA3AF); }
        .chk-toggle { position:relative; display:inline-block; width:44px; height:24px; flex-shrink:0; }
        .chk-toggle input { opacity:0; width:0; height:0; }
        .chk-toggle-slider {
          position:absolute; cursor:pointer; inset:0;
          background:var(--border, #E9E9EE); border-radius:24px; transition:0.25s;
        }
        .chk-toggle-slider:before {
          content:""; position:absolute; height:18px; width:18px;
          left:3px; bottom:3px; background:var(--bg-card, #FFFFFF);
          border-radius:50%; transition:0.25s;
          box-shadow:0 1px 3px rgba(0,0,0,0.2);
        }
        .chk-toggle input:checked + .chk-toggle-slider {
          background:var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A));
        }
        .chk-toggle input:checked + .chk-toggle-slider:before { transform:translateX(20px); }

        /* ── Prazo agendamento ── */
        .chk-prazo-row {
          display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;
          font-size:0.84rem; font-weight:500; color:var(--text-primary, #374151);
          padding:0.7rem 0.85rem; background:var(--primary-light, #FFF1F7);
          border-radius:12px; border:1px dashed rgba(255,111,169,0.35);
        }

        /* ── Cupons empty ── */
        .chk-cupons-empty {
          display:flex; flex-direction:column; align-items:center; gap:0.6rem;
          padding:1.5rem 1rem; text-align:center;
          background:var(--bg-body, #F7F7F8);
          border-radius:14px; border:1.5px dashed var(--border, #E9E9EE);
        }
        .chk-cupons-empty-icon {
          width:46px; height:46px; border-radius:50%;
          background:var(--primary-light, #FFF1F7);
          color:var(--primary, #FF6FA9);
          display:flex; align-items:center; justify-content:center;
        }
        .chk-cupons-empty-text {
          margin:0; font-size:0.8rem; color:var(--text-secondary, #6B7280);
          max-width:240px; line-height:1.4;
        }
        .chk-cupons-empty-text strong { color:var(--primary-dark, #F85A9A); font-weight:700; }

        /* ── Cupom card ── */
        .chk-cupom-card {
          padding:0.9rem; background:var(--bg-card, #FFFFFF);
          border:1.5px solid var(--border, #E9E9EE); border-radius:14px;
          display:flex; flex-direction:column; gap:0.65rem;
          transition:all 0.18s; position:relative; overflow:hidden;
        }
        .chk-cupom-card::before {
          content:""; position:absolute; left:0; top:0; bottom:0; width:4px;
          background:var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A));
        }
        .chk-cupom-card--inactive { opacity:0.6; }
        .chk-cupom-card--inactive::before { background:var(--text-muted, #9CA3AF); }

        .chk-cupom-top { display:flex; align-items:center; gap:0.5rem; padding-left:0.35rem; }
        .chk-cupom-tag {
          width:28px; height:28px; border-radius:8px;
          background:var(--primary-light, #FFF1F7);
          color:var(--primary, #FF6FA9);
          display:flex; align-items:center; justify-content:center;
          flex-shrink:0;
        }
        .chk-cupom-codigo {
          flex:1; padding:0.5rem 0.65rem; background:transparent;
          border:1.5px dashed var(--border, #E9E9EE);
          border-radius:8px; outline:none;
          font-family:'Geist Mono', ui-monospace, monospace;
          font-size:0.95rem; font-weight:800; letter-spacing:0.08em;
          color:var(--primary-dark, #F85A9A); text-transform:uppercase;
        }
        .chk-cupom-codigo:focus { border-color:var(--primary, #FF6FA9); border-style:solid; background:var(--primary-light, #FFF1F7); }
        .chk-cupom-codigo::placeholder { color:var(--text-muted, #9CA3AF); letter-spacing:0.05em; }

        .chk-cupom-row { display:flex; gap:0.5rem; padding-left:0.35rem; }
        .chk-cupom-select { width:auto; padding-right:1.8rem; cursor:pointer; }

        .chk-cupom-footer {
          display:flex; justify-content:space-between; align-items:center;
          padding-top:0.55rem; padding-left:0.35rem;
          border-top:1px dashed var(--border, #E9E9EE);
        }
        .chk-cupom-ativo {
          display:flex; align-items:center; gap:0.5rem;
          font-size:0.78rem; font-weight:600;
          color:var(--text-primary, #374151); cursor:pointer;
        }
        .chk-cupom-remove {
          display:inline-flex; align-items:center; gap:4px;
          background:none; border:none; padding:4px 8px; border-radius:8px;
          font-size:0.76rem; font-weight:600;
          color:var(--error, #EF4444); cursor:pointer;
          transition:background 0.15s;
        }
        .chk-cupom-remove:hover { background:#fee2e2; }

        .chk-spinner { width:32px; height:32px; border:3px solid var(--primary-light, #FFF1F7); border-top-color:var(--primary, #FF6FA9); border-radius:50%; animation:chkspin 0.7s linear infinite; display:inline-block; }
      `}</style>
    </>
  )
}

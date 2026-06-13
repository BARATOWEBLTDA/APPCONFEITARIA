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
      <div style={{width:'32px',height:'32px',border:'3px solid var(--primary-light, #FFF1F7)',borderTopColor:'var(--primary, #FF6FA9)',borderRadius:'50%',animation:'spin 0.7s linear infinite'}} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const s = {
    outer: { width:'100%',display:'flex',justifyContent:'center',paddingBottom:'3rem',background:'var(--bg-body, #F7F7F8)' } as React.CSSProperties,
    root: { fontFamily:'inherit',width:'100%',maxWidth:'900px',display:'flex',flexDirection:'column' as const,gap:'1.25rem',padding:'0 1.5rem' },
    header: { display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:'2rem',paddingBottom:'0.75rem',borderBottom:'1px solid var(--border, #E9E9EE)',flexWrap:'wrap' as const,gap:'0.5rem' },
    title: { fontSize:'1.45rem',fontWeight:800,color:'var(--text-title, #1F2937)',margin:'0 0 0.2rem' },
    sub: { fontSize:'0.84rem',color:'var(--text-secondary, #6B7280)',margin:0,fontStyle:'italic' as const },
    autosave: { fontSize:'0.77rem',fontWeight:600,color:'var(--success, #22C55E)',background:'#f0fdf4',padding:'0.3rem 0.75rem',borderRadius:'50px',border:'1px solid #bbf7d0' },
    card: { background:'var(--bg-card, #FFFFFF)',borderRadius:'16px',padding:'1.25rem',boxShadow:'var(--shadow-card, 0 2px 12px rgba(0,0,0,0.06))',border:'1px solid var(--border, #E9E9EE)',display:'flex',flexDirection:'column' as const,gap:'0.75rem' },
    label: { fontSize:'0.68rem',fontWeight:800,color:'var(--primary, #FF6FA9)',textTransform:'uppercase' as const,letterSpacing:'0.15em',margin:0,paddingBottom:'0.6rem',borderBottom:'1px solid var(--primary-light, #FFF1F7)' },
    hint: { fontSize:'0.75rem',color:'var(--text-muted, #9CA3AF)',margin:0 },
    check: { display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.65rem 0.85rem',borderRadius:'10px',border:'1.5px solid var(--border, #E9E9EE)',cursor:'pointer',transition:'all 0.15s' } as React.CSSProperties,
    checkActive: { border:'1.5px solid var(--primary, #FF6FA9)',background:'var(--primary-light, #FFF1F7)' },
    input: { width:'100%',padding:'0.6rem 1rem',border:'1.5px solid var(--border, #E9E9EE)',borderRadius:'10px',fontFamily:'inherit',fontSize:'0.88rem',color:'var(--text-title, #1F2937)',outline:'none',boxSizing:'border-box' as const,background:'var(--bg-input, #FFFFFF)' },
    toggle: { position:'relative' as const,display:'inline-block',width:'44px',height:'24px',flexShrink:0 },
    toggleRow: { display:'flex',justifyContent:'space-between',alignItems:'center',gap:'1rem' },
    btnAdd: { padding:'0.5rem 1rem',background:'var(--primary-light, #FFF1F7)',border:'1.5px solid var(--primary-light, #FFF1F7)',borderRadius:'50px',fontFamily:'inherit',fontSize:'0.8rem',fontWeight:700,color:'var(--primary-dark, #F85A9A)',cursor:'pointer' },
    btnRemove: { padding:'0.4rem',background:'#fff5f5',border:'1px solid #fee2e2',borderRadius:'8px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' },
  }

  return (
    <div style={s.outer}>
      <div style={s.root}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>Configurações do Checkout</h1>
            <p style={s.sub}>Configure pagamento, entrega e cupons do seu cardápio</p>
          </div>
          {autoSaved && <span style={s.autosave}>✓ Salvo automaticamente</span>}
        </div>

        {/* ── AGENDAMENTO ── */}
        <div style={s.card}>
          <p style={s.label}>Agendamento</p>
          <div style={s.toggleRow}>
            <div>
              <p style={{margin:0,fontSize:'0.85rem',fontWeight:600,color:'var(--text-primary, #374151)'}}>Aceitar agendamento</p>
              <p style={{margin:'0.1rem 0 0',fontSize:'0.72rem',color:'var(--text-muted, #9CA3AF)'}}>Cliente escolhe data e horário de entrega/retirada</p>
            </div>
            <label style={s.toggle}>
              <input type="checkbox" checked={aceitaAgendamento} onChange={e => setAceitaAgendamento(e.target.checked)} style={{opacity:0,width:0,height:0}} />
              <span style={{position:'absolute',cursor:'pointer',inset:0,background:aceitaAgendamento?'var(--primary, #FF6FA9)':'var(--border, #E9E9EE)',borderRadius:'24px',transition:'0.3s'}}>
                <span style={{position:'absolute',height:'18px',width:'18px',left:aceitaAgendamento?'23px':'3px',bottom:'3px',background:'var(--bg-card, #FFFFFF)',borderRadius:'50%',transition:'0.3s',boxShadow:'0 1px 4px rgba(0,0,0,0.18)'}} />
              </span>
            </label>
          </div>
          {aceitaAgendamento && (
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
              <span style={{fontSize:'0.82rem',color:'var(--text-primary, #374151)',fontWeight:500}}>Prazo mínimo de antecedência:</span>
              <input value={prazoMinimo} onChange={e => setPrazoMinimo(e.target.value.replace(/\D/g,''))} style={{...s.input,width:'60px',textAlign:'center'}} />
              <span style={{fontSize:'0.82rem',color:'var(--text-muted, #9CA3AF)'}}>horas</span>
            </div>
          )}
        </div>

        {/* ── FORMAS DE PAGAMENTO ── */}
        <div style={s.card}>
          <p style={s.label}>Formas de pagamento</p>
          <p style={s.hint}>Marque apenas as que você aceita</p>
          <div style={{display:'flex',flexDirection:'column',gap:'0.45rem'}}>
            {PAGAMENTOS.map(p => (
              <div key={p.key} onClick={() => togglePagamento(p.key)} style={{...s.check, ...(formasPagamento.includes(p.key) ? s.checkActive : {})}}>
                <span style={{flex:1,fontSize:'0.88rem',fontWeight:formasPagamento.includes(p.key)?700:500,color:formasPagamento.includes(p.key)?'var(--primary-dark, #F85A9A)':'var(--text-primary, #374151)'}}>{p.label}</span>
                <div style={{width:'20px',height:'20px',borderRadius:'6px',border:formasPagamento.includes(p.key)?'2px solid var(--primary, #FF6FA9)':'2px solid var(--border, #E9E9EE)',background:formasPagamento.includes(p.key)?'var(--primary, #FF6FA9)':'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {formasPagamento.includes(p.key) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
              </div>
            ))}
          </div>
          {formasPagamento.includes('dinheiro') && (
            <>
              <hr style={{border:'none',borderTop:'1px solid var(--border, #E9E9EE)',margin:'0.25rem 0'}} />
              <div style={s.toggleRow}>
                <div>
                  <p style={{margin:0,fontSize:'0.85rem',fontWeight:600,color:'var(--text-primary, #374151)'}}>Exibir campo "Troco para"</p>
                  <p style={{margin:'0.1rem 0 0',fontSize:'0.72rem',color:'var(--text-muted, #9CA3AF)'}}>Quando o cliente pagar em dinheiro</p>
                </div>
                <label style={s.toggle}>
                  <input type="checkbox" checked={exibirCampoTroco} onChange={e => setExibirCampoTroco(e.target.checked)} style={{opacity:0,width:0,height:0}} />
                  <span style={{position:'absolute',cursor:'pointer',inset:0,background:exibirCampoTroco?'var(--primary, #FF6FA9)':'var(--border, #E9E9EE)',borderRadius:'24px',transition:'0.3s'}}>
                    <span style={{position:'absolute',height:'18px',width:'18px',left:exibirCampoTroco?'23px':'3px',bottom:'3px',background:'var(--bg-card, #FFFFFF)',borderRadius:'50%',transition:'0.3s',boxShadow:'0 1px 4px rgba(0,0,0,0.18)'}} />
                  </span>
                </label>
              </div>
            </>
          )}
        </div>

        {/* ── FORMAS DE ENTREGA ── */}
        <div style={s.card}>
          <p style={s.label}>Formas de entrega</p>
          <p style={s.hint}>Marque as opções disponíveis</p>
          <div style={{display:'flex',flexDirection:'column',gap:'0.45rem'}}>
            {ENTREGAS.map(e => (
              <div key={e.key} onClick={() => toggleEntrega(e.key)} style={{...s.check, ...(formasEntrega.includes(e.key) ? s.checkActive : {})}}>
                <span style={{flex:1,fontSize:'0.88rem',fontWeight:formasEntrega.includes(e.key)?700:500,color:formasEntrega.includes(e.key)?'var(--primary-dark, #F85A9A)':'var(--text-primary, #374151)'}}>{e.label}</span>
                <div style={{width:'20px',height:'20px',borderRadius:'6px',border:formasEntrega.includes(e.key)?'2px solid var(--primary, #FF6FA9)':'2px solid var(--border, #E9E9EE)',background:formasEntrega.includes(e.key)?'var(--primary, #FF6FA9)':'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {formasEntrega.includes(e.key) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
              </div>
            ))}
          </div>

          {formasEntrega.includes('retirada') && (
            <>
              <hr style={{border:'none',borderTop:'1px solid var(--border, #E9E9EE)',margin:'0.25rem 0'}} />
              <p style={{margin:0,fontSize:'0.82rem',fontWeight:600,color:'var(--text-primary, #374151)'}}>Endereço de retirada</p>
              <input value={enderecoRetirada} onChange={e => setEnderecoRetirada(e.target.value)} placeholder="Rua, número, bairro..." style={s.input} />
              <input value={horarioRetirada} onChange={e => setHorarioRetirada(e.target.value)} placeholder="Horário de retirada (ex: 08h às 18h)" style={s.input} />
            </>
          )}

          {formasEntrega.includes('entrega_propria') && (
            <>
              <hr style={{border:'none',borderTop:'1px solid var(--border, #E9E9EE)',margin:'0.25rem 0'}} />
              <p style={{margin:0,fontSize:'0.82rem',fontWeight:600,color:'var(--text-primary, #374151)'}}>Valor da entrega própria</p>
              <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                <span style={{fontSize:'0.88rem',color:'var(--text-secondary, #6B7280)'}}>R$</span>
                <input value={valorEntregaPropria} onChange={e => setValorEntregaPropria(e.target.value.replace(/[^0-9.,]/g,''))} placeholder="0,00" style={{...s.input,width:'120px'}} />
              </div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <p style={{margin:0,fontSize:'0.82rem',fontWeight:600,color:'var(--text-primary, #374151)'}}>Valor por bairro (opcional)</p>
                <button onClick={addBairro} style={s.btnAdd}>+ Bairro</button>
              </div>
              {entregaPorBairro.map((b, i) => (
                <div key={i} style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
                  <input value={b.bairro} onChange={e => setEntregaPorBairro(prev => prev.map((x,j) => j===i ? {...x, bairro:e.target.value} : x))} placeholder="Nome do bairro" style={{...s.input,flex:1}} />
                  <div style={{display:'flex',alignItems:'center',gap:'0.3rem'}}>
                    <span style={{fontSize:'0.82rem',color:'var(--text-secondary, #6B7280)'}}>R$</span>
                    <input value={b.valor} onChange={e => setEntregaPorBairro(prev => prev.map((x,j) => j===i ? {...x, valor:e.target.value.replace(/[^0-9.,]/g,'')} : x))} placeholder="0,00" style={{...s.input,width:'80px'}} />
                  </div>
                  <button onClick={() => removeBairro(i)} style={s.btnRemove}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--error, #EF4444)" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── CUPONS ── */}
        <div style={s.card}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <p style={s.label}>Cupons de desconto</p>
            <button onClick={addCupom} style={s.btnAdd}>+ Cupom</button>
          </div>
          {cupons.length === 0 && <p style={s.hint}>Nenhum cupom cadastrado. Clique em "+ Cupom" para criar.</p>}
          {cupons.map((c, i) => (
            <div key={i} style={{padding:'0.85rem',background:'var(--primary-light, #FFF1F7)',borderRadius:'12px',display:'flex',flexDirection:'column',gap:'0.5rem',border:'1px solid var(--primary-light, #FFF1F7)'}}>
              <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
                <input value={c.codigo} onChange={e => setCupons(prev => prev.map((x,j) => j===i ? {...x, codigo:e.target.value.toUpperCase()} : x))} placeholder="CÓDIGO" style={{...s.input,flex:1,textTransform:'uppercase',fontWeight:700}} />
                <select value={c.tipo} onChange={e => setCupons(prev => prev.map((x,j) => j===i ? {...x, tipo:e.target.value} : x))} style={{...s.input,width:'auto'}}>
                  <option value="percentual">% Percentual</option>
                  <option value="fixo">R$ Fixo</option>
                </select>
                <div style={{display:'flex',alignItems:'center',gap:'0.3rem'}}>
                  <span style={{fontSize:'0.82rem',color:'var(--text-secondary, #6B7280)'}}>{c.tipo === 'percentual' ? '%' : 'R$'}</span>
                  <input value={c.valor} onChange={e => setCupons(prev => prev.map((x,j) => j===i ? {...x, valor:e.target.value.replace(/[^0-9.,]/g,'')} : x))} placeholder="0" style={{...s.input,width:'70px',textAlign:'center'}} />
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <label style={{display:'flex',alignItems:'center',gap:'0.4rem',fontSize:'0.8rem',color:'var(--text-primary, #374151)',cursor:'pointer'}}>
                  <input type="checkbox" checked={c.ativo} onChange={e => setCupons(prev => prev.map((x,j) => j===i ? {...x, ativo:e.target.checked} : x))} />
                  Ativo
                </label>
                <button onClick={() => removeCupom(i)} style={{background:'none',border:'none',fontSize:'0.78rem',color:'var(--error, #EF4444)',fontWeight:600,cursor:'pointer'}}>Remover</button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

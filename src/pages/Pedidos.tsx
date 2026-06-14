import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

type Pedido = {
  id: string
  numero: number
  cliente_nome: string
  status: string
  status_pagamento: string
  prioridade: string
  data_entrega: string
  horario_entrega: string
  valor_total: number
  valor_recebido: number
  tipo_entrega: string
  forma_pagamento: string
  etiquetas: string[]
  origem: string
  created_at: string
}

const STATUS_LIST = [
  { key: 'todos', label: 'Todos' },
  { key: 'novo', label: 'Novo' },
  { key: 'aguardando_pagamento', label: 'Aguardando' },
  { key: 'confirmado', label: 'Confirmado' },
  { key: 'em_producao', label: 'Produção' },
  { key: 'pronto', label: 'Pronto' },
  { key: 'saiu_entrega', label: 'Saiu' },
  { key: 'entregue', label: 'Entregue' },
  { key: 'cancelado', label: 'Cancelado' },
]

// Só mostra filtros com pedidos (exceto "Todos")
const STATUS_LIST_VISIVEIS = (pedidos: Pedido[]) => STATUS_LIST.filter(
  s => s.key === 'todos' || pedidos.some(p => p.status === s.key)
)

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  novo:                 { label: 'Novo',            color: '#1d4ed8', bg: '#dbeafe' },
  aguardando_pagamento: { label: 'Aguardando',      color: '#92400e', bg: '#fef3c7' },
  confirmado:           { label: 'Confirmado',      color: '#5b21b6', bg: '#ede9fe' },
  em_producao:          { label: 'Em produção',     color: '#9a3412', bg: '#ffedd5' },
  pronto:               { label: 'Pronto',          color: '#14532d', bg: '#dcfce7' },
  saiu_entrega:         { label: 'Saiu p/ entrega', color: '#065f46', bg: '#d1fae5' },
  entregue:             { label: 'Entregue',        color: '#374151', bg: '#f3f4f6' },
  cancelado:            { label: 'Cancelado',       color: '#991b1b', bg: '#fee2e2' },
  atrasado:             { label: 'Atrasado',        color: '#991b1b', bg: '#fee2e2' },
  pendente:             { label: 'Novo',            color: '#1d4ed8', bg: '#dbeafe' },
}

const PAG_CONFIG: Record<string, string> = {
  pix: 'PIX', dinheiro: 'Dinheiro', credito: 'Crédito',
  debito: 'Débito', transferencia: 'Transf.',
}

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function formatMoney(v: number) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function isAtrasado(pedido: Pedido) {
  if (['entregue', 'cancelado'].includes(pedido.status)) return false
  if (!pedido.data_entrega) return false
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return parseLocalDate(pedido.data_entrega) < hoje
}

function diasParaEntrega(data: string) {
  if (!data) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return Math.ceil((parseLocalDate(data).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

// Linha de alerta: ícone + texto na mesma linha
function AlertaLinha({ icon, texto, cor }: { icon: React.ReactNode; texto: string; cor: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'row', alignItems: 'center',
      gap: '6px', color: cor, fontSize: '13px', fontWeight: 500,
      lineHeight: '1.3', whiteSpace: 'nowrap', overflow: 'hidden',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{texto}</span>
    </div>
  )
}

export default function Pedidos() {
  const navigate = useNavigate()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) fetchPedidos(user.id)
    })
  }, [])

  const fetchPedidos = async (uid: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('pedidos').select('*').eq('user_id', uid)
      .order('created_at', { ascending: false })
    setPedidos(data || [])
    setLoading(false)
  }

  const pedidosFiltrados = pedidos.filter(p => {
    const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus
    const matchBusca = !busca || p.cliente_nome?.toLowerCase().includes(busca.toLowerCase()) || String(p.numero).includes(busca)
    return matchStatus && matchBusca
  })

  const contadores = STATUS_LIST.reduce((acc, s) => {
    acc[s.key] = s.key === 'todos' ? pedidos.length : pedidos.filter(p => p.status === s.key).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div style={{ fontFamily: "'Geist', sans-serif", display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-title,#1F2937)', margin: 0 }}>Pedidos</h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted,#9CA3AF)', margin: '0.2rem 0 0' }}>{pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} no total</p>
        </div>
        <button onClick={() => navigate('/pedidos/novo')} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          background: 'var(--primary,#FF6FA9)', color: 'white', border: 'none',
          borderRadius: '10px', padding: '0.6rem 1.1rem', fontSize: '0.85rem',
          fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo pedido
        </button>
      </div>

      {/* Busca */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-card,#fff)', border: '1.5px solid var(--border,#E9E9EE)', borderRadius: '10px', padding: '0.55rem 0.85rem' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted,#9CA3AF)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--text-primary,#1F2937)', background: 'transparent' }}
          placeholder="Buscar por nome ou número..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '2px' }}>
        {STATUS_LIST_VISIVEIS(pedidos).map(s => (
          <button
            key={s.key}
            onClick={() => setFiltroStatus(s.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              background: filtroStatus === s.key ? 'var(--primary,#FF6FA9)' : 'var(--bg-card,#fff)',
              border: `1.5px solid ${filtroStatus === s.key ? 'var(--primary,#FF6FA9)' : 'var(--border,#E9E9EE)'}`,
              borderRadius: '20px', padding: '0.35rem 0.85rem',
              fontSize: '0.78rem', fontWeight: 500,
              color: filtroStatus === s.key ? 'white' : 'var(--text-secondary,#6B7280)',
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            {s.label}
            {contadores[s.key] > 0 && (
              <span style={{
                background: filtroStatus === s.key ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.08)',
                borderRadius: '10px', padding: '0 6px', fontSize: '0.7rem', fontWeight: 700,
              }}>{contadores[s.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--primary-light,#FFF1F7)', borderTopColor: 'var(--primary,#FF6FA9)', borderRadius: '50%', animation: 'pedSpin 0.7s linear infinite' }} />
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 1rem', gap: '0.5rem' }}>
          <div style={{ width: '64px', height: '64px', background: 'var(--primary-light,#FFF1F7)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary,#FF6FA9)" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-title,#1F2937)', margin: 0 }}>
            {busca || filtroStatus !== 'todos' ? 'Nenhum pedido encontrado' : 'Nenhum pedido ainda'}
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted,#9CA3AF)', margin: 0 }}>
            {busca || filtroStatus !== 'todos' ? 'Tente outro filtro' : 'Crie seu primeiro pedido agora'}
          </p>
          {filtroStatus === 'todos' && !busca && (
            <button onClick={() => navigate('/pedidos/novo')} style={{ marginTop: '0.5rem', background: 'var(--primary,#FF6FA9)', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1.25rem', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
              Criar primeiro pedido
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '0.75rem' }}>
          {pedidosFiltrados.map(p => {
            const atrasado = isAtrasado(p)
            const status = atrasado ? 'atrasado' : (p.status || 'pendente')
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['novo']
            const dias = diasParaEntrega(p.data_entrega)

            const corData = atrasado ? '#dc2626' : dias === 0 ? '#d97706' : dias === 1 ? '#d97706' : '#16a34a'
            const textoData = atrasado ? 'Atrasada' : dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : `Em ${dias} dias`

            return (
              <div
                key={p.id}
                onClick={() => navigate(`/pedidos/${p.id}`)}
                style={{
                  background: 'var(--bg-card,#fff)',
                  border: '1.5px solid var(--border,#E9E9EE)',
                  borderRadius: '16px',
                  padding: '1.1rem 1.25rem',
                  cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.transform = 'translateY(-2px)'
                  el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.09)'
                  el.style.borderColor = 'var(--primary,#FF6FA9)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.transform = ''
                  el.style.boxShadow = ''
                  el.style.borderColor = 'var(--border,#E9E9EE)'
                }}
              >
                {/* ── Header: número + status ── */}
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted,#9CA3AF)' }}>
                    Pedido #{p.numero || '—'}
                    {p.origem === 'cardapio' && (
                      <span style={{ marginLeft: '6px', fontSize: '0.65rem', fontWeight: 700, background: '#ede9fe', color: '#5b21b6', borderRadius: '5px', padding: '1px 7px' }}>
                        via Cardápio
                      </span>
                    )}
                  </span>
                  <span style={{
                    display: 'inline-block', fontSize: '0.72rem', fontWeight: 700,
                    padding: '4px 10px', borderRadius: '6px', whiteSpace: 'nowrap',
                    flexShrink: 0, color: cfg.color, background: cfg.bg,
                  }}>
                    {cfg.label}
                  </span>
                </div>

                {/* ── Nome do cliente ── */}
                <p style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title,#1F2937)', lineHeight: 1.3 }}>
                  {p.cliente_nome || 'Cliente não informado'}
                </p>

                {/* ── Divisória ── */}
                <div style={{ height: '1px', background: 'var(--border,#E9E9EE)', marginBottom: '0.75rem' }} />

                {/* ── Alertas ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '0.85rem' }}>

                  {p.data_entrega && (
                    <AlertaLinha
                      cor={corData}
                      texto={`${textoData} · ${formatDate(p.data_entrega)}${p.horario_entrega ? ` às ${p.horario_entrega.slice(0, 5)}` : ''}`}
                      icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
                    />
                  )}

                  {p.status_pagamento !== 'pago' ? (
                    <AlertaLinha
                      cor={p.status_pagamento === 'parcial' ? '#d97706' : '#dc2626'}
                      texto={`${p.status_pagamento === 'parcial' ? 'Pagamento parcial' : 'Pagamento pendente'} · ${PAG_CONFIG[p.forma_pagamento] || 'PIX'}`}
                      icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}
                    />
                  ) : (
                    <AlertaLinha
                      cor="#16a34a"
                      texto={`Pagamento recebido · ${PAG_CONFIG[p.forma_pagamento] || 'PIX'}`}
                      icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    />
                  )}

                  <AlertaLinha
                    cor="var(--text-secondary,#6B7280)"
                    texto={p.tipo_entrega === 'retirada' ? 'Retirada no local' : p.tipo_entrega === 'entrega' ? 'Entrega' : 'Consumo no local'}
                    icon={p.tipo_entrega === 'retirada'
                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                      : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg>
                    }
                  />
                </div>

                {/* ── Rodapé ── */}
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid var(--border,#E9E9EE)', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'row', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {p.prioridade === 'alta' && (
                      <span style={{ fontSize: '0.67rem', fontWeight: 700, background: '#fee2e2', color: '#dc2626', borderRadius: '5px', padding: '2px 7px', border: '1px solid #fecaca' }}>↑ Urgente</span>
                    )}
                    {(p.etiquetas || []).slice(0, 3).map((e: string) => (
                      <span key={e} style={{ fontSize: '0.67rem', fontWeight: 600, background: 'var(--bg-body,#F7F7F8)', border: '1px solid var(--border,#E9E9EE)', color: 'var(--text-secondary,#6B7280)', borderRadius: '5px', padding: '2px 7px' }}>{e}</span>
                    ))}
                    {p.prioridade !== 'alta' && !(p.etiquetas || []).length && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted,#9CA3AF)' }}>—</span>
                    )}
                  </div>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-title,#1F2937)', whiteSpace: 'nowrap' }}>
                    {formatMoney(p.valor_total)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @keyframes pedSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
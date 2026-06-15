import { useState, useEffect } from 'react'
import PedidosKanban from '@/pages/PedidosKanban'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

type PedidoItem = {
  nome_produto: string
  quantidade: number
  valor_unitario: number
  observacoes?: string
  personalizacoes?: {
    massa?: string | null
    recheio?: string | null
    cobertura?: string | null
  }
  produtos?: {
    imagem_url?: string | null
  } | null
}

type Pedido = {
  id: string
  numero: number
  cliente_nome: string
  cliente_telefone: string
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
  pedido_itens?: PedidoItem[]
}

const STATUS_LIST = [
  { key: 'todos',                label: 'Todos' },
  { key: 'novo',                 label: 'Novo' },
  { key: 'aguardando_pagamento', label: 'Aguardando' },
  { key: 'confirmado',           label: 'Confirmado' },
  { key: 'em_producao',          label: 'Produção' },
  { key: 'pronto',               label: 'Pronto' },
  { key: 'saiu_entrega',         label: 'Saiu' },
  { key: 'entregue',             label: 'Entregue' },
  { key: 'cancelado',            label: 'Cancelado' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  novo:                 { label: 'Novo',             color: '#1d4ed8', bg: '#dbeafe', dot: '#3b82f6' },
  aguardando_pagamento: { label: 'Aguardando',       color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  confirmado:           { label: 'Confirmado',       color: '#5b21b6', bg: '#ede9fe', dot: '#8b5cf6' },
  em_producao:          { label: 'Em produção',      color: '#9a3412', bg: '#ffedd5', dot: '#f97316' },
  pronto:               { label: 'Pronto',           color: '#14532d', bg: '#dcfce7', dot: '#22c55e' },
  saiu_entrega:         { label: 'Saiu p/ entrega',  color: '#065f46', bg: '#d1fae5', dot: '#10b981' },
  entregue:             { label: 'Entregue',         color: '#374151', bg: '#f3f4f6', dot: '#9ca3af' },
  cancelado:            { label: 'Cancelado',        color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' },
  atrasado:             { label: 'Atrasado',         color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' },
  pendente:             { label: 'Novo',             color: '#1d4ed8', bg: '#dbeafe', dot: '#3b82f6' },
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

function horasParaEntrega(data: string, hora: string) {
  if (!data || !hora) return null
  const [h, m] = hora.split(':').map(Number)
  const entrega = parseLocalDate(data)
  entrega.setHours(h, m, 0, 0)
  return Math.ceil((entrega.getTime() - Date.now()) / (1000 * 60 * 60))
}

function MiniCarrinho({ itens = [] }: { itens?: PedidoItem[] }) {
  if (!itens.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', margin: '0.5rem 0 0.75rem' }}>
      {itens.map((item, i) => {
        const imgUrl = item.produtos?.imagem_url
        const pers = item.personalizacoes
        const chips: string[] = []
        if (pers?.massa) chips.push(pers.massa)
        if (pers?.recheio) chips.push(pers.recheio)
        if (pers?.cobertura) chips.push(pers.cobertura)
        if (item.observacoes) chips.push(item.observacoes)

        return (
          <div key={i}>
            {i > 0 && <div style={{ height: '1px', background: 'var(--border,#E9E9EE)', margin: '0.5rem 0' }} />}
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '0.65rem' }}>
              {/* Thumbnail 60x60 */}
              <div style={{
                width: '60px', height: '60px', borderRadius: '8px', flexShrink: 0,
                background: 'var(--bg-body,#F3F4F6)',
                border: '1px solid var(--border,#E9E9EE)',
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {imgUrl
                  ? <img src={imgUrl} alt={item.nome_produto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted,#C4C4C4)" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                }
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: chips.length ? '0.4rem' : 0 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-title,#1F2937)', lineHeight: 1.3 }}>
                    {item.nome_produto}
                  </span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary,#6B7280)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {item.quantidade}x
                  </span>
                </div>
                {chips.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {chips.map((chip, ci) => (
                      <span key={ci} style={{
                        fontSize: '0.68rem', fontWeight: 500,
                        background: 'var(--primary-light,#FFF1F7)',
                        color: 'var(--primary,#FF6FA9)',
                        border: '1px solid rgba(255,111,169,0.2)',
                        borderRadius: '5px', padding: '2px 7px',
                        whiteSpace: 'nowrap',
                      }}>+ {chip}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Pedidos() {
  const navigate = useNavigate()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'lista' | 'kanban'>('lista')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) fetchPedidos(user.id)
    })
  }, [])

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('pedidos').update({ status }).eq('id', id)
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, status } : p))
  }

  const fetchPedidos = async (uid: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('pedidos')
      .select('*, pedido_itens(nome_produto, quantidade, valor_unitario, observacoes, personalizacoes, produtos(imagem_url))')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    setPedidos(data || [])
    setLoading(false)
  }

  const pedidosFiltrados = pedidos.filter(p => {
    const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus
    const matchBusca = !busca || p.cliente_nome?.toLowerCase().includes(busca.toLowerCase()) || String(p.numero).includes(busca)
    return matchStatus && matchBusca
  })

  const statusVisiveis = STATUS_LIST.filter(
    s => s.key === 'todos' || pedidos.some(p => p.status === s.key)
  )

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
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Toggle lista/kanban */}
          <div style={{ display: 'flex', background: 'var(--bg-card,#fff)', border: '1.5px solid var(--border,#E9E9EE)', borderRadius: '10px', padding: '3px', gap: '2px' }}>
            <button
              onClick={() => setView('lista')}
              title="Ver lista"
              style={{
                padding: '0.35rem 0.6rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
                background: view === 'lista' ? 'var(--primary,#FF6FA9)' : 'transparent',
                color: view === 'lista' ? 'white' : 'var(--text-secondary,#6B7280)',
                transition: 'all 0.15s',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
            <button
              onClick={() => setView('kanban')}
              title="Ver kanban"
              style={{
                padding: '0.35rem 0.6rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
                background: view === 'kanban' ? 'var(--primary,#FF6FA9)' : 'transparent',
                color: view === 'kanban' ? 'white' : 'var(--text-secondary,#6B7280)',
                transition: 'all 0.15s',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="11" rx="1"/></svg>
            </button>
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
      </div>

      {/* Kanban view */}
      {view === 'kanban' && (
        <PedidosKanban
          pedidos={pedidos}
          onStatusChange={updateStatus}
          onNovo={() => navigate('/pedidos/novo')}
        />
      )}

      {view === 'lista' && <>
      {/* Busca */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-card,#fff)', border: '1.5px solid var(--border,#E9E9EE)', borderRadius: '10px', padding: '0.6rem 0.9rem' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted,#9CA3AF)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--text-primary,#1F2937)', background: 'transparent' }}
          placeholder="Buscar por cliente, número ou telefone..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        {busca && (
          <button onClick={() => setBusca('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted,#9CA3AF)', display: 'flex', alignItems: 'center', padding: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      {/* Filtros — só mostra os que têm pedidos */}
      <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '2px' }}>
        {statusVisiveis.map(s => (
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '0.75rem' }}>
          {pedidosFiltrados.map(p => {
            const atrasado = isAtrasado(p)
            const status = atrasado ? 'atrasado' : (p.status || 'pendente')
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['novo']
            const dias = diasParaEntrega(p.data_entrega)
            const horas = dias === 0 ? horasParaEntrega(p.data_entrega, p.horario_entrega) : null

            const valorPendente = Math.max(0, (p.valor_total || 0) - (p.valor_recebido || 0))
            const isUrgente = p.prioridade === 'alta' || (horas !== null && horas <= 3 && horas >= 0)

            return (
              <div
                key={p.id}
                onClick={() => navigate(`/pedidos/${p.id}`)}
                style={{
                  background: 'var(--bg-card,#fff)',
                  border: `1.5px solid ${isUrgente ? '#fca5a5' : 'var(--border,#E9E9EE)'}`,
                  borderRadius: '16px',
                  padding: '1.1rem 1.25rem',
                  cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                  fontFamily: 'inherit',
                  position: 'relative',
                  overflow: 'hidden',
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
                  el.style.borderColor = isUrgente ? '#fca5a5' : 'var(--border,#E9E9EE)'
                }}
              >
                {/* Faixa urgente */}
                {isUrgente && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0,
                    background: '#fee2e2', padding: '4px 1.25rem',
                    fontSize: '0.72rem', fontWeight: 700, color: '#dc2626',
                    display: 'flex', alignItems: 'center', gap: '5px',
                  }}>
                    {atrasado ? 'ATRASADO' : horas !== null && horas <= 3 ? `Entrega em ${horas}h` : 'URGENTE'}
                  </div>
                )}

                <div style={{ marginTop: isUrgente ? '1.5rem' : 0 }}>

                  {/* Número + status */}
                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted,#9CA3AF)' }}>
                      Pedido #{p.numero || '—'}
                      {p.origem === 'cardapio' && (
                        <span style={{ marginLeft: '6px', background: '#ede9fe', color: '#5b21b6', borderRadius: '4px', padding: '1px 6px', fontSize: '0.62rem', fontWeight: 700 }}>via Cardápio</span>
                      )}
                    </span>
                    {/* Status com dot */}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 10px', borderRadius: '6px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: cfg.dot, flexShrink: 0, display: 'inline-block' }} />
                      {cfg.label}
                    </span>
                  </div>

                  {/* Cliente */}
                  <div style={{ marginBottom: '0.65rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted,#9CA3AF)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente</span>
                    <p style={{ margin: '1px 0 0', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-title,#1F2937)', lineHeight: 1.25 }}>
                      {p.cliente_nome || 'Não informado'}
                    </p>
                  </div>

                  {/* Mini carrinho */}
                  <MiniCarrinho itens={p.pedido_itens} />

                  {/* Divisória */}
                  <div style={{ height: '1px', background: 'var(--border,#E9E9EE)', margin: '0 0 0.75rem' }} />

                  {/* Data + hora + entrega */}
                  {p.data_entrega && (
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: atrasado ? '#dc2626' : dias === 0 ? '#d97706' : 'var(--text-secondary,#6B7280)', lineHeight: 1.2 }}>
                          {atrasado ? 'Atrasado' : dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : formatDate(p.data_entrega)}
                        </div>
                        {p.horario_entrega && (
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: atrasado ? '#dc2626' : dias === 0 ? '#d97706' : 'var(--text-title,#1F2937)', lineHeight: 1.1 }}>
                            {p.horario_entrega.slice(0, 5)}
                          </div>
                        )}
                      </div>
                      <div style={{ width: '1px', height: '32px', background: 'var(--border,#E9E9EE)' }} />
                      <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary,#6B7280)' }}>
                        {p.tipo_entrega === 'retirada' ? 'Retirada' : p.tipo_entrega === 'entrega' ? 'Entrega' : 'Local'}
                      </div>
                    </div>
                  )}

                  {/* Pagamento */}
                  {p.status_pagamento !== 'pago' ? (
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px', marginBottom: '0.85rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: p.status_pagamento === 'parcial' ? '#d97706' : '#dc2626' }}>
                        {PAG_CONFIG[p.forma_pagamento] || 'PIX'} {p.status_pagamento === 'parcial' ? 'parcial' : 'pendente'}
                        {valorPendente > 0 && ` · ${formatMoney(valorPendente)}`}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px', marginBottom: '0.85rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#16a34a' }}>
                        {PAG_CONFIG[p.forma_pagamento] || 'PIX'} · Pago
                      </span>
                    </div>
                  )}

                  {/* Rodapé: etiquetas + valor GRANDE */}
                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid var(--border,#E9E9EE)', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'row', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {(p.etiquetas || []).slice(0, 2).map((e: string) => (
                        <span key={e} style={{ fontSize: '0.67rem', fontWeight: 600, background: 'var(--bg-body,#F7F7F8)', border: '1px solid var(--border,#E9E9EE)', color: 'var(--text-secondary,#6B7280)', borderRadius: '5px', padding: '2px 7px' }}>{e}</span>
                      ))}
                      {!(p.etiquetas || []).length && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted,#9CA3AF)' }}>—</span>
                      )}
                    </div>
                    <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-title,#1F2937)', whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}>
                      {formatMoney(p.valor_total)}
                    </span>
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}

      </> }

      <style>{`@keyframes pedSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

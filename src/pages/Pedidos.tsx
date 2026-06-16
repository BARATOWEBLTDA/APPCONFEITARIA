import { useState, useEffect, useRef } from 'react'
import PedidosKanban from '@/pages/PedidosKanban'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/hooks/use-mobile'

type PedidoItem = {
  nome_produto: string
  quantidade: number
  valor_unitario: number
  observacoes?: string
  personalizacoes?: { massa?: string | null; recheio?: string | null; cobertura?: string | null }
  produtos?: { imagem_url?: string | null } | null
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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  novo:                 { label: 'Novo',            color: '#1d4ed8', bg: '#dbeafe', dot: '#3b82f6' },
  aguardando_pagamento: { label: 'Aguardando',      color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  confirmado:           { label: 'Confirmado',      color: '#5b21b6', bg: '#ede9fe', dot: '#8b5cf6' },
  em_producao:          { label: 'Em produção',     color: '#9a3412', bg: '#ffedd5', dot: '#f97316' },
  pronto:               { label: 'Pronto',          color: '#14532d', bg: '#dcfce7', dot: '#22c55e' },
  saiu_entrega:         { label: 'Saiu p/ entrega', color: '#065f46', bg: '#d1fae5', dot: '#10b981' },
  entregue:             { label: 'Entregue',        color: '#374151', bg: '#f3f4f6', dot: '#9ca3af' },
  cancelado:            { label: 'Cancelado',       color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' },
  atrasado:             { label: 'Atrasado',        color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' },
  pendente:             { label: 'Novo',            color: '#1d4ed8', bg: '#dbeafe', dot: '#3b82f6' },
}

const PAG_CONFIG: Record<string, string> = {
  pix: 'PIX', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito', transferencia: 'Transf.',
}

const TODOS_STATUS = [
  { key: 'novo', label: 'Novo' },
  { key: 'aguardando_pagamento', label: 'Aguardando' },
  { key: 'confirmado', label: 'Confirmado' },
  { key: 'em_producao', label: 'Em produção' },
  { key: 'pronto', label: 'Pronto' },
  { key: 'saiu_entrega', label: 'Saiu p/ entrega' },
  { key: 'entregue', label: 'Entregue' },
  { key: 'cancelado', label: 'Cancelado' },
]

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

function isAtrasado(p: Pedido) {
  if (['entregue', 'cancelado'].includes(p.status)) return false
  if (!p.data_entrega) return false
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return parseLocalDate(p.data_entrega) < hoje
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, margin: '0.5rem 0 0.75rem' }}>
      {itens.map((item, i) => {
        const imgUrl = item.produtos?.imagem_url
        const chips: string[] = []
        if (item.personalizacoes?.massa) chips.push(item.personalizacoes.massa)
        if (item.personalizacoes?.recheio) chips.push(item.personalizacoes.recheio)
        if (item.personalizacoes?.cobertura) chips.push(item.personalizacoes.cobertura)
        if (item.observacoes) chips.push(item.observacoes)
        return (
          <div key={i}>
            {i > 0 && <div style={{ height: 1, background: 'var(--border,#E9E9EE)', margin: '0.5rem 0' }} />}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
              <div style={{ width: 60, height: 60, borderRadius: 8, flexShrink: 0, background: 'var(--bg-body,#F3F4F6)', border: '1px solid var(--border,#E9E9EE)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {imgUrl
                  ? <img src={imgUrl} alt={item.nome_produto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted,#C4C4C4)" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: chips.length ? '0.4rem' : 0 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-title,#1F2937)', lineHeight: 1.3 }}>{item.nome_produto}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary,#6B7280)', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.quantidade}x</span>
                </div>
                {chips.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {chips.map((chip, ci) => (
                      <span key={ci} style={{ fontSize: '0.68rem', fontWeight: 500, background: 'var(--primary-light,#FFF1F7)', color: 'var(--primary,#986274)', border: '1px solid rgba(152,98,116,0.2)', borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap' }}>+ {chip}</span>
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

// ── Drawer de Filtros ────────────────────────────────────────────────────────
function FiltroDrawer({
  statusSelecionados, setStatusSelecionados,
  periodoFiltro, setPeriodoFiltro,
  onClose,
}: {
  statusSelecionados: string[]
  setStatusSelecionados: (v: string[]) => void
  periodoFiltro: string
  setPeriodoFiltro: (v: string) => void
  onClose: () => void
}) {
  const [localStatus, setLocalStatus] = useState<string[]>(statusSelecionados)
  const [localPeriodo, setLocalPeriodo] = useState(periodoFiltro)

  const toggleStatus = (key: string) => {
    setLocalStatus(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    )
  }

  const aplicar = () => {
    setStatusSelecionados(localStatus)
    setPeriodoFiltro(localPeriodo)
    onClose()
  }

  const limpar = () => {
    setLocalStatus(TODOS_STATUS.filter(s => s.key !== 'cancelado').map(s => s.key))
    setLocalPeriodo('todos')
  }

  return (
    <>
      <div className="fd-overlay" onClick={onClose} />
      <div className="fd-drawer">
        <div className="fd-handle" />
        <div className="fd-header">
          <span className="fd-title">Filtros</span>
          <button className="fd-limpar" onClick={limpar}>Limpar</button>
        </div>

        <div className="fd-body">
          <p className="fd-section-label">Status</p>
          <div className="fd-status-grid">
            {TODOS_STATUS.map(s => {
              const cfg = STATUS_CONFIG[s.key]
              const on = localStatus.includes(s.key)
              return (
                <button
                  key={s.key}
                  className={`fd-status-btn${on ? ' fd-status-btn--on' : ''}`}
                  style={on ? { background: cfg.bg, borderColor: cfg.dot, color: cfg.color } : {}}
                  onClick={() => toggleStatus(s.key)}
                >
                  <span className="fd-dot" style={{ background: cfg.dot }} />
                  {s.label}
                </button>
              )
            })}
          </div>

          <p className="fd-section-label" style={{ marginTop: '1.25rem' }}>Período</p>
          <div className="fd-periodo-grid">
            {[
              { key: 'todos', label: 'Todos' },
              { key: 'hoje', label: 'Hoje' },
              { key: 'semana', label: 'Esta semana' },
              { key: 'mes', label: 'Este mês' },
            ].map(p => (
              <button
                key={p.key}
                className={`fd-periodo-btn${localPeriodo === p.key ? ' fd-periodo-btn--on' : ''}`}
                onClick={() => setLocalPeriodo(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="fd-footer">
          <button className="fd-aplicar" onClick={aplicar}>Aplicar filtros</button>
        </div>
      </div>
    </>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Pedidos() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'lista' | 'kanban'>('lista')
  const [busca, setBusca] = useState('')
  const [showFiltro, setShowFiltro] = useState(false)

  // Filtros — por padrão exclui cancelados
  const [statusSelecionados, setStatusSelecionados] = useState<string[]>(
    TODOS_STATUS.filter(s => s.key !== 'cancelado').map(s => s.key)
  )
  const [periodoFiltro, setPeriodoFiltro] = useState('todos')

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

  // ── Filtragem ──────────────────────────────────────────────────────────────
  const pedidosFiltrados = pedidos.filter(p => {
    const matchStatus = statusSelecionados.includes(p.status)
    const matchBusca = !busca ||
      p.cliente_nome?.toLowerCase().includes(busca.toLowerCase()) ||
      String(p.numero).includes(busca)

    let matchPeriodo = true
    if (periodoFiltro !== 'todos' && p.data_entrega) {
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
      const data = parseLocalDate(p.data_entrega)
      if (periodoFiltro === 'hoje') {
        matchPeriodo = data.getTime() === hoje.getTime()
      } else if (periodoFiltro === 'semana') {
        const fim = new Date(hoje); fim.setDate(fim.getDate() + 7)
        matchPeriodo = data >= hoje && data <= fim
      } else if (periodoFiltro === 'mes') {
        matchPeriodo = data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear()
      }
    }

    return matchStatus && matchBusca && matchPeriodo
  })

  const filtrosAtivos = statusSelecionados.length !== TODOS_STATUS.filter(s => s.key !== 'cancelado').length || periodoFiltro !== 'todos'

  return (
    <div style={{ fontFamily: "'Geist', sans-serif", display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-title,#431524)', margin: 0 }}>Pedidos</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted,#C39EAA)', margin: '0.15rem 0 0' }}>
            {pedidosFiltrados.length} pedido{pedidosFiltrados.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Toggle lista/kanban — só no desktop */}
          {!isMobile && (
            <div style={{ display: 'flex', background: 'var(--bg-card,#fff)', border: '1.5px solid var(--border,#ECC2D0)', borderRadius: '10px', padding: '3px', gap: '2px' }}>
              <button onClick={() => setView('lista')} title="Lista" style={{ padding: '0.35rem 0.6rem', borderRadius: '7px', border: 'none', cursor: 'pointer', background: view === 'lista' ? 'var(--primary,#986274)' : 'transparent', color: view === 'lista' ? 'white' : 'var(--text-secondary,#6E3548)', transition: 'all 0.15s' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
              <button onClick={() => setView('kanban')} title="Kanban" style={{ padding: '0.35rem 0.6rem', borderRadius: '7px', border: 'none', cursor: 'pointer', background: view === 'kanban' ? 'var(--primary,#986274)' : 'transparent', color: view === 'kanban' ? 'white' : 'var(--text-secondary,#6E3548)', transition: 'all 0.15s' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="11" rx="1"/></svg>
              </button>
            </div>
          )}

          {/* Botão filtro */}
          <button
            onClick={() => setShowFiltro(true)}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: '10px', border: `1.5px solid ${filtrosAtivos ? 'var(--primary,#986274)' : 'var(--border,#ECC2D0)'}`, background: filtrosAtivos ? 'var(--primary-light,#F7EEF1)' : 'var(--bg-card,#fff)', cursor: 'pointer', color: filtrosAtivos ? 'var(--primary,#986274)' : 'var(--text-secondary,#6E3548)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            {filtrosAtivos && <span style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, borderRadius: '50%', background: 'var(--primary,#986274)', border: '2px solid white' }} />}
          </button>

          {/* Novo pedido */}
          <button onClick={() => navigate('/pedidos/novo')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--primary,#986274)', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {!isMobile && 'Novo pedido'}
          </button>
        </div>
      </div>

      {/* Kanban — só desktop */}
      {!isMobile && view === 'kanban' && (
        <PedidosKanban pedidos={pedidos} onStatusChange={updateStatus} onNovo={() => navigate('/pedidos/novo')} />
      )}

      {(isMobile || view === 'lista') && (
        <>
          {/* Busca */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-card,#fff)', border: '1.5px solid var(--border,#ECC2D0)', borderRadius: '12px', padding: '0.6rem 0.9rem' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted,#C39EAA)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--text-primary,#431524)', background: 'transparent' }}
              placeholder="Buscar por cliente ou número..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
            {busca && (
              <button onClick={() => setBusca('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted,#C39EAA)', display: 'flex', padding: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>

          {/* Lista */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
              <div style={{ width: 32, height: 32, border: '3px solid var(--primary-light,#F7EEF1)', borderTopColor: 'var(--primary,#986274)', borderRadius: '50%', animation: 'pedSpin 0.7s linear infinite' }} />
            </div>
          ) : pedidosFiltrados.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 1rem', gap: '0.5rem' }}>
              <div style={{ width: 64, height: 64, background: 'var(--primary-light,#F7EEF1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary,#986274)" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-title,#431524)', margin: 0 }}>
                {busca || filtrosAtivos ? 'Nenhum pedido encontrado' : 'Nenhum pedido ainda'}
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted,#C39EAA)', margin: 0 }}>
                {busca || filtrosAtivos ? 'Tente ajustar os filtros' : 'Crie seu primeiro pedido agora'}
              </p>
              {!filtrosAtivos && !busca && (
                <button onClick={() => navigate('/pedidos/novo')} style={{ marginTop: '0.5rem', background: 'var(--primary,#986274)', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1.25rem', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                  Criar primeiro pedido
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
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
                    style={{ background: 'var(--bg-card,#fff)', border: `1.5px solid ${isUrgente ? '#fca5a5' : 'var(--border,#ECC2D0)'}`, borderRadius: '16px', padding: '1rem 1.1rem', cursor: 'pointer', fontFamily: 'inherit', position: 'relative', overflow: 'hidden' }}
                  >
                    {isUrgente && (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: '#fee2e2', padding: '4px 1.1rem', fontSize: '0.72rem', fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 5 }}>
                        {atrasado ? 'ATRASADO' : horas !== null && horas <= 3 ? `Entrega em ${horas}h` : 'URGENTE'}
                      </div>
                    )}
                    <div style={{ marginTop: isUrgente ? '1.5rem' : 0 }}>
                      {/* Número + status */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted,#C39EAA)' }}>
                          Pedido #{p.numero || '—'}
                          {p.origem === 'cardapio' && <span style={{ marginLeft: 6, background: '#ede9fe', color: '#5b21b6', borderRadius: 4, padding: '1px 6px', fontSize: '0.62rem', fontWeight: 700 }}>via Cardápio</span>}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 10px', borderRadius: 6 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0, display: 'inline-block' }} />
                          {cfg.label}
                        </span>
                      </div>
                      {/* Cliente */}
                      <div style={{ marginBottom: '0.65rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted,#C39EAA)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente</span>
                        <p style={{ margin: '1px 0 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title,#431524)', lineHeight: 1.25 }}>{p.cliente_nome || 'Não informado'}</p>
                      </div>
                      <MiniCarrinho itens={p.pedido_itens} />
                      <div style={{ height: 1, background: 'var(--border,#ECC2D0)', margin: '0 0 0.65rem' }} />
                      {/* Data + entrega */}
                      {p.data_entrega && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                          <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: atrasado ? '#dc2626' : dias === 0 ? '#d97706' : 'var(--text-secondary,#6E3548)', lineHeight: 1.2 }}>
                              {atrasado ? 'Atrasado' : dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : formatDate(p.data_entrega)}
                            </div>
                            {p.horario_entrega && (
                              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: atrasado ? '#dc2626' : dias === 0 ? '#d97706' : 'var(--text-title,#431524)', lineHeight: 1.1 }}>
                                {p.horario_entrega.slice(0, 5)}
                              </div>
                            )}
                          </div>
                          <div style={{ width: 1, height: 32, background: 'var(--border,#ECC2D0)' }} />
                          <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary,#6E3548)' }}>
                            {p.tipo_entrega === 'retirada' ? 'Retirada' : 'Entrega'}
                          </div>
                        </div>
                      )}
                      {/* Pagamento */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        {p.status_pagamento !== 'pago' ? (
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: p.status_pagamento === 'parcial' ? '#d97706' : '#dc2626' }}>
                            {PAG_CONFIG[p.forma_pagamento] || 'PIX'} {p.status_pagamento === 'parcial' ? 'parcial' : 'pendente'}
                            {valorPendente > 0 && ` · ${formatMoney(valorPendente)}`}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#16a34a' }}>
                            {PAG_CONFIG[p.forma_pagamento] || 'PIX'} · Pago ✓
                          </span>
                        )}
                      </div>
                      {/* Rodapé */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.65rem', borderTop: `1px solid var(--border,#ECC2D0)` }}>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {(p.etiquetas || []).slice(0, 2).map((e: string) => (
                            <span key={e} style={{ fontSize: '0.67rem', fontWeight: 600, background: 'var(--bg-subtle,#F7EEF1)', border: '1px solid var(--border,#ECC2D0)', color: 'var(--text-secondary,#6E3548)', borderRadius: 5, padding: '2px 7px' }}>{e}</span>
                          ))}
                          {!(p.etiquetas || []).length && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted,#C39EAA)' }}>—</span>}
                        </div>
                        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-title,#431524)', whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}>
                          {formatMoney(p.valor_total)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Drawer de filtros */}
      {showFiltro && (
        <FiltroDrawer
          statusSelecionados={statusSelecionados}
          setStatusSelecionados={setStatusSelecionados}
          periodoFiltro={periodoFiltro}
          setPeriodoFiltro={setPeriodoFiltro}
          onClose={() => setShowFiltro(false)}
        />
      )}

      <style>{`
        @keyframes pedSpin { to { transform: rotate(360deg); } }

        .fd-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 100; animation: hsFadeIn 0.2s ease; }
        .fd-drawer { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-card,#fff); border-radius: 20px 20px 0 0; z-index: 101; max-height: 80vh; display: flex; flex-direction: column; animation: hsSlideUp 0.28s cubic-bezier(0.32,0.72,0,1); box-shadow: 0 -4px 32px rgba(0,0,0,0.15); }
        .fd-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--border,#ECC2D0); margin: 10px auto 0; flex-shrink: 0; }
        .fd-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px 10px; border-bottom: 1px solid var(--border,#ECC2D0); flex-shrink: 0; }
        .fd-title { font-size: 1rem; font-weight: 700; color: var(--text-title,#431524); font-family: 'Geist',sans-serif; }
        .fd-limpar { background: none; border: none; font-size: 0.85rem; color: var(--primary,#986274); font-weight: 600; cursor: pointer; font-family: 'Geist',sans-serif; }
        .fd-body { overflow-y: auto; flex: 1; padding: 16px; }
        .fd-section-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted,#C39EAA); margin: 0 0 10px; font-family: 'Geist',sans-serif; }
        .fd-status-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .fd-status-btn { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; border: 1.5px solid var(--border,#ECC2D0); background: var(--bg-body,#FAFAFA); font-size: 0.82rem; font-weight: 500; color: var(--text-secondary,#6E3548); cursor: pointer; font-family: 'Geist',sans-serif; transition: all 0.15s; }
        .fd-status-btn--on { font-weight: 700; }
        .fd-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .fd-periodo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .fd-periodo-btn { padding: 10px; border-radius: 10px; border: 1.5px solid var(--border,#ECC2D0); background: var(--bg-body,#FAFAFA); font-size: 0.85rem; font-weight: 500; color: var(--text-secondary,#6E3548); cursor: pointer; font-family: 'Geist',sans-serif; transition: all 0.15s; }
        .fd-periodo-btn--on { border-color: var(--primary,#986274); background: var(--primary-light,#F7EEF1); color: var(--primary,#986274); font-weight: 700; }
        .fd-footer { padding: 12px 16px 28px; flex-shrink: 0; border-top: 1px solid var(--border,#ECC2D0); }
        .fd-aplicar { width: 100%; padding: 14px; background: var(--primary,#986274); color: white; border: none; border-radius: 12px; font-size: 0.95rem; font-weight: 600; font-family: 'Geist',sans-serif; cursor: pointer; }

        @keyframes hsFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes hsSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </div>
  )
}

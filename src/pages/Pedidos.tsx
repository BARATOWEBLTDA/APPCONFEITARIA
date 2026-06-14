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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  novo:                 { label: 'Novo',           color: '#1d4ed8', bg: '#dbeafe' },
  aguardando_pagamento: { label: 'Aguardando',     color: '#92400e', bg: '#fef3c7' },
  confirmado:           { label: 'Confirmado',     color: '#5b21b6', bg: '#ede9fe' },
  em_producao:          { label: 'Em produção',    color: '#9a3412', bg: '#ffedd5' },
  pronto:               { label: 'Pronto',         color: '#14532d', bg: '#dcfce7' },
  saiu_entrega:         { label: 'Saiu p/ entrega',color: '#065f46', bg: '#d1fae5' },
  entregue:             { label: 'Entregue',       color: '#374151', bg: '#f3f4f6' },
  cancelado:            { label: 'Cancelado',      color: '#991b1b', bg: '#fee2e2' },
  atrasado:             { label: 'Atrasado',       color: '#991b1b', bg: '#fee2e2' },
  pendente:             { label: 'Novo',           color: '#1d4ed8', bg: '#dbeafe' },
}

const PRIORIDADE_CONFIG: Record<string, { color: string; label: string }> = {
  alta:  { color: '#ef4444', label: '↑ Alta' },
  media: { color: '#f59e0b', label: '→ Média' },
  baixa: { color: '#6b7280', label: '↓ Baixa' },
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

function isAtrasado(pedido: Pedido) {
  if (['entregue', 'cancelado'].includes(pedido.status)) return false
  if (!pedido.data_entrega) return false
  return new Date(pedido.data_entrega) < new Date(new Date().toDateString())
}

function diasParaEntrega(data: string) {
  if (!data) return null
  const hoje = new Date(new Date().toDateString())
  const entrega = new Date(data)
  const diff = Math.ceil((entrega.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

export default function Pedidos() {
  const navigate = useNavigate()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [busca, setBusca] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserId(user.id); fetchPedidos(user.id) }
    })
  }, [])

  const fetchPedidos = async (uid: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('pedidos')
      .select('*')
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

  const contadores = STATUS_LIST.reduce((acc, s) => {
    acc[s.key] = s.key === 'todos' ? pedidos.length : pedidos.filter(p => p.status === s.key).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="ped-root">

      {/* ── Header ── */}
      <div className="ped-header">
        <div>
          <h1 className="ped-title">Pedidos</h1>
          <p className="ped-subtitle">{pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} no total</p>
        </div>
        <button className="ped-btn-novo" onClick={() => navigate('/pedidos/novo')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo pedido
        </button>
      </div>

      {/* ── Busca ── */}
      <div className="ped-busca-wrap">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted,#9CA3AF)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          className="ped-busca"
          placeholder="Buscar por nome ou número..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {/* ── Filtro status ── */}
      <div className="ped-filtros">
        {STATUS_LIST.map(s => (
          <button
            key={s.key}
            className={`ped-filtro-btn${filtroStatus === s.key ? ' ativo' : ''}`}
            onClick={() => setFiltroStatus(s.key)}
          >
            {s.label}
            {contadores[s.key] > 0 && (
              <span className="ped-filtro-count">{contadores[s.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <div className="ped-empty">
          <div className="ped-spinner" />
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="ped-empty">
          <div className="ped-empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary,#FF6FA9)" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <p className="ped-empty-title">{busca || filtroStatus !== 'todos' ? 'Nenhum pedido encontrado' : 'Nenhum pedido ainda'}</p>
          <p className="ped-empty-sub">{busca || filtroStatus !== 'todos' ? 'Tente outro filtro ou busca' : 'Crie seu primeiro pedido agora'}</p>
          {filtroStatus === 'todos' && !busca && (
            <button className="ped-btn-novo" onClick={() => navigate('/pedidos/novo')}>
              Criar primeiro pedido
            </button>
          )}
        </div>
      ) : (
        <div className="ped-lista">
          {pedidosFiltrados.map(p => {
            const atrasado = isAtrasado(p)
            const status = atrasado ? 'atrasado' : (p.status || 'pendente')
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['novo']
            const dias = diasParaEntrega(p.data_entrega)
            const prio = PRIORIDADE_CONFIG[p.prioridade] || PRIORIDADE_CONFIG['media']

            return (
              <div
                key={p.id}
                className="ped-card"
                onClick={() => navigate(`/pedidos/${p.id}`)}
              >
                {/* Linha 1 */}
                <div className="ped-card-row1">
                  <div className="ped-card-left">
                    <span className="ped-numero">#{p.numero || '—'}</span>
                    {p.origem === 'cardapio' && (
                      <span className="ped-origem-badge">Cardápio</span>
                    )}
                  </div>
                  <span className="ped-status-pill" style={{ color: cfg.color, background: cfg.bg }}>
                    {cfg.label}
                  </span>
                </div>

                {/* Nome cliente */}
                <p className="ped-cliente">{p.cliente_nome || 'Cliente não informado'}</p>

                {/* Linha info */}
                <div className="ped-card-info">
                  <div className="ped-info-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {p.data_entrega ? (
                      <span style={{ color: atrasado ? '#ef4444' : dias !== null && dias <= 1 ? '#f59e0b' : 'inherit' }}>
                        {formatDate(p.data_entrega)}
                        {dias !== null && !['entregue','cancelado'].includes(p.status) && (
                          <span style={{ marginLeft: 4, fontSize: '0.7rem', opacity: 0.8 }}>
                            {atrasado ? '• Atrasado' : dias === 0 ? '• Hoje' : dias === 1 ? '• Amanhã' : `• ${dias}d`}
                          </span>
                        )}
                      </span>
                    ) : '—'}
                  </div>
                  <div className="ped-info-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                    {p.tipo_entrega === 'retirada' ? 'Retirada' : p.tipo_entrega === 'entrega' ? 'Entrega' : 'Local'}
                  </div>
                  <div className="ped-info-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    {PAG_CONFIG[p.forma_pagamento] || p.forma_pagamento || 'PIX'}
                  </div>
                </div>

                {/* Linha bottom */}
                <div className="ped-card-bottom">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="ped-prio" style={{ color: prio.color }}>{prio.label}</span>
                    {(p.etiquetas || []).slice(0, 2).map((e: string) => (
                      <span key={e} className="ped-etiqueta">{e}</span>
                    ))}
                  </div>
                  <span className="ped-valor">{formatMoney(p.valor_total)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        .ped-root { font-family: 'Geist', sans-serif; display: flex; flex-direction: column; gap: 1rem; }

        .ped-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .ped-title { font-size: 1.5rem; font-weight: 700; color: var(--text-title, #1F2937); margin: 0; }
        .ped-subtitle { font-size: 0.82rem; color: var(--text-muted, #9CA3AF); margin: 0.2rem 0 0; }

        .ped-btn-novo {
          display: flex; align-items: center; gap: 0.4rem;
          background: var(--primary, #FF6FA9); color: white;
          border: none; border-radius: 10px; padding: 0.6rem 1.1rem;
          font-size: 0.85rem; font-weight: 600; cursor: pointer;
          font-family: 'Geist', sans-serif; white-space: nowrap;
          transition: opacity 0.15s;
        }
        .ped-btn-novo:hover { opacity: 0.88; }

        .ped-busca-wrap { display: flex; align-items: center; gap: 0.5rem; background: var(--bg-card, #fff); border: 1.5px solid var(--border, #E9E9EE); border-radius: 10px; padding: 0.55rem 0.85rem; }
        .ped-busca { flex: 1; border: none; outline: none; font-size: 0.85rem; font-family: 'Geist', sans-serif; color: var(--text-primary, #1F2937); background: transparent; }
        .ped-busca::placeholder { color: var(--text-muted, #9CA3AF); }

        .ped-filtros { display: flex; gap: 0.4rem; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
        .ped-filtros::-webkit-scrollbar { display: none; }
        .ped-filtro-btn {
          display: flex; align-items: center; gap: 0.35rem;
          background: var(--bg-card, #fff); border: 1.5px solid var(--border, #E9E9EE);
          border-radius: 20px; padding: 0.35rem 0.85rem;
          font-size: 0.78rem; font-weight: 500; color: var(--text-secondary, #6B7280);
          cursor: pointer; font-family: 'Geist', sans-serif; white-space: nowrap;
          transition: all 0.15s;
        }
        .ped-filtro-btn.ativo { background: var(--primary, #FF6FA9); border-color: var(--primary, #FF6FA9); color: white; }
        .ped-filtro-count { background: rgba(0,0,0,0.12); border-radius: 10px; padding: 0 6px; font-size: 0.7rem; font-weight: 700; }
        .ped-filtro-btn.ativo .ped-filtro-count { background: rgba(255,255,255,0.3); }

        .ped-lista { display: grid; grid-template-columns: 1fr; gap: 0.6rem; }

        .ped-card {
          background: var(--bg-card, #fff);
          border: 1.5px solid var(--border, #E9E9EE);
          border-radius: 14px; padding: 1rem 1.1rem;
          cursor: pointer; transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
          display: flex; flex-direction: column; gap: 0.5rem;
        }
        .ped-card:hover { border-color: var(--primary, #FF6FA9); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(255,111,169,0.1); }

        .ped-card-row1 { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
        .ped-card-left { display: flex; align-items: center; gap: 0.5rem; }
        .ped-numero { font-size: 0.78rem; font-weight: 700; color: var(--text-muted, #9CA3AF); font-family: 'Geist Mono', monospace; }
        .ped-origem-badge { font-size: 0.65rem; font-weight: 600; background: #ede9fe; color: #5b21b6; border-radius: 6px; padding: 1px 6px; }

        .ped-status-pill { font-size: 0.72rem; font-weight: 600; padding: 3px 10px; border-radius: 20px; white-space: nowrap; }

        .ped-cliente { font-size: 0.95rem; font-weight: 600; color: var(--text-title, #1F2937); margin: 0; }

        .ped-card-info { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
        .ped-info-item { display: flex; align-items: center; gap: 0.3rem; font-size: 0.78rem; color: var(--text-secondary, #6B7280); }

        .ped-card-bottom { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-top: 0.15rem; }
        .ped-prio { font-size: 0.72rem; font-weight: 600; }
        .ped-etiqueta { font-size: 0.65rem; font-weight: 600; background: var(--bg-body, #F7F7F8); border: 1px solid var(--border, #E9E9EE); color: var(--text-secondary, #6B7280); border-radius: 6px; padding: 1px 7px; }
        .ped-valor { font-size: 1rem; font-weight: 700; color: var(--text-title, #1F2937); }

        .ped-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 1rem; gap: 0.5rem; }
        .ped-empty-icon { width: 64px; height: 64px; background: var(--primary-light, #FFF1F7); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 0.5rem; }
        .ped-empty-title { font-size: 1rem; font-weight: 600; color: var(--text-title, #1F2937); margin: 0; }
        .ped-empty-sub { font-size: 0.82rem; color: var(--text-muted, #9CA3AF); margin: 0; }
        .ped-spinner { width: 32px; height: 32px; border: 3px solid var(--primary-light, #FFF1F7); border-top-color: var(--primary, #FF6FA9); border-radius: 50%; animation: pedSpin 0.7s linear infinite; }
        @keyframes pedSpin { to { transform: rotate(360deg); } }

        @media (min-width: 768px) { .ped-lista { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) {
          .ped-title { font-size: 1.2rem; }
          .ped-card { padding: 0.85rem; }
          .ped-card-info { gap: 0.6rem; }
        }
      `}</style>
    </div>
  )
}

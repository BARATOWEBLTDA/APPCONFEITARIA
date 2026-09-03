import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

type Pedido = {
  id: string
  numero: number
  cliente_nome: string
  cliente_telefone: string
  status: string
  data_entrega: string
  horario_entrega: string
  valor_total: number
  tipo_entrega: string
  forma_pagamento: string
  status_pagamento: string
  origem: string
  pedido_itens?: { nome_produto: string; quantidade: number; produtos?: { forma_venda?: string | null } | null }[]
}

const COLUNAS = [
  { key: 'novo',        label: 'Novo',        color: 'var(--primary)', bg: 'var(--bg-subtle)', border: 'var(--border)' },
  { key: 'em_producao', label: 'Em Produção', color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
  { key: 'pronto',      label: 'Pronto',      color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
  { key: 'a_caminho',   label: 'A Caminho / Retirado', color: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd' },
  { key: 'concluido',   label: 'Concluído',   color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
]

const PROXIMO: Record<string, string> = {
  novo:        'em_producao',
  em_producao: 'pronto',
  pronto:      'a_caminho',
  a_caminho:   'concluido',
}

const ANTERIOR: Record<string, string> = {
  em_producao: 'novo',
  pronto:      'em_producao',
  a_caminho:   'pronto',
  concluido:   'a_caminho',
}

const PAG_CONFIG: Record<string, string> = {
  pix: 'PIX', dinheiro: 'Dinheiro', credito: 'Crédito',
  debito: 'Débito', transferencia: 'Transf.',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  novo:        { label: 'Novo',              color: '#534AB7', bg: '#EEEDFE' },
  em_producao: { label: 'Em Produção',       color: '#9a3412', bg: '#ffedd5' },
  pronto:      { label: 'Pronto',            color: '#14532d', bg: '#dcfce7' },
  a_caminho:   { label: 'A Caminho',         color: '#0369a1', bg: '#e0f2fe' },
  concluido:   { label: 'Concluído',         color: '#374151', bg: '#f3f4f6' },
  cancelado:   { label: 'Cancelado',         color: '#991b1b', bg: '#fee2e2' },
}

function formatQtd(qtd: number, formaVenda?: string | null): string {
  const fv = formaVenda || ''
  if (fv === 'kg') return `${qtd}kg`
  if (fv === 'cento') return `${qtd} cento`
  if (fv === 'fatia') return `${qtd} fatia${qtd > 1 ? 's' : ''}`
  if (fv === 'caixa') return `${qtd} caixa${qtd > 1 ? 's' : ''}`
  if (fv === 'kit-festa') return `${qtd} kit${qtd > 1 ? 's' : ''}`
  return `${qtd}un`
}

function formatMoney(v: number) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseLocalDate(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day)
}

function diasParaEntrega(data: string) {
  if (!data) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return Math.ceil((parseLocalDate(data).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

export default function PedidosKanban({ pedidos, onStatusChange, onNovo }: {
  pedidos: Pedido[]
  onStatusChange: (id: string, status: string) => Promise<void>
  onNovo: () => void
}) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState<string | null>(null)

  const getProximo = (p: Pedido) => PROXIMO[p.status] || ''

  const avancar = async (e: React.MouseEvent, p: Pedido) => {
    e.stopPropagation()
    const proximo = getProximo(p)
    if (!proximo) return
    setLoading(p.id + '_avancar')
    await onStatusChange(p.id, proximo)
    setLoading(null)
  }

  const voltar = async (e: React.MouseEvent, p: Pedido) => {
    e.stopPropagation()
    const anterior = ANTERIOR[p.status]
    if (!anterior) return
    setLoading(p.id + '_voltar')
    await onStatusChange(p.id, anterior)
    setLoading(null)
  }

  const cancelar = async (e: React.MouseEvent, p: Pedido) => {
    e.stopPropagation()
    if (!confirm(`Cancelar pedido #${p.numero} de ${p.cliente_nome}?`)) return
    setLoading(p.id + '_cancelar')
    await onStatusChange(p.id, 'cancelado')
    setLoading(null)
  }

  return (
    <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '1rem', alignItems: 'flex-start' }}>
      {COLUNAS.map(col => {
        const colPedidos = pedidos.filter(p => p.status === col.key)
        return (
          <div key={col.key} style={{ minWidth: 270, width: 270, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Cabeçalho */}
            <div style={{ background: col.color, borderRadius: 10, padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>{col.label}</span>
              <span style={{ background: 'rgba(255,255,255,0.25)', color: 'white', fontSize: '0.72rem', fontWeight: 700, padding: '1px 8px', borderRadius: 20 }}>{colPedidos.length}</span>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {colPedidos.length === 0 && (
                <div style={{ background: col.bg, border: `1.5px dashed ${col.border}`, borderRadius: 10, padding: '1.5rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.78rem' }}>
                  Nenhum pedido
                </div>
              )}
              {colPedidos.map(p => {
                const dias = diasParaEntrega(p.data_entrega)
                const atrasado = dias !== null && dias < 0 && !['concluido', 'cancelado', 'excluido'].includes(p.status)
                const hoje = dias === 0
                const isLoading = loading?.startsWith(p.id)
                const proximo = getProximo(p)

                const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG['novo']

                return (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/pedidos/${p.id}`)}
                    style={{ background: 'var(--bg-card,#fff)', border: `1.5px solid ${atrasado ? '#fca5a5' : 'var(--border,var(--border))'}`, borderRadius: 10, padding: '0.85rem', cursor: 'pointer', opacity: isLoading ? 0.6 : 1, transition: 'box-shadow 0.15s', fontFamily: "'Geist',sans-serif" }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = ''}
                  >
                    {/* Topo: número + status + botões */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted,var(--text-muted))' }}>Pedido #{p.numero || '—'}</span>
                        {atrasado && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#dc2626', background: '#fee2e2', borderRadius: 4, padding: '1px 6px' }}>ATRASADO</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 3 }} onClick={e => e.stopPropagation()}>
                        {ANTERIOR[p.status] && (
                          <button onClick={e => voltar(e, p)} disabled={!!isLoading} title="Voltar" style={{ width: 24, height: 24, borderRadius: 6, border: '1.5px solid var(--border,var(--border))', background: 'var(--bg-body,#FAFAFA)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary,var(--primary-dark))' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                          </button>
                        )}
                        {p.status !== 'concluido' && (
                          <button onClick={e => cancelar(e, p)} disabled={!!isLoading} title="Cancelar" style={{ width: 24, height: 24, borderRadius: 6, border: '1.5px solid #fecaca', background: '#fee2e2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        )}
                        {proximo && (
                          <button onClick={e => avancar(e, p)} disabled={!!isLoading} title="Avançar" style={{ width: 24, height: 24, borderRadius: 6, border: `1.5px solid ${col.color}`, background: col.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: col.color }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Badge de status atual */}
                    <div style={{ marginBottom: '0.5rem' }}>
                      <span style={{ display: 'inline-block', fontSize: '0.65rem', fontWeight: 700, color: sc.color, background: sc.bg, borderRadius: 20, padding: '3px 10px', letterSpacing: '0.02em' }}>
                        ● {sc.label}
                      </span>
                    </div>

                    {/* Cliente */}
                    <p style={{ margin: '0 0 0.15rem', fontSize: '0.72rem', color: 'var(--text-muted,var(--text-muted))', fontWeight: 500 }}>Cliente</p>
                    <p style={{ margin: '0 0 0.4rem', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-title,var(--text-title))', lineHeight: 1.3 }}>{p.cliente_nome || 'Não informado'}</p>

                    {/* Itens */}
                    {p.pedido_itens && p.pedido_itens.length > 0 && (
                      <div style={{ marginBottom: '0.4rem' }}>
                        {p.pedido_itens.slice(0, 2).map((item, i) => (
                          <p key={i} style={{ margin: '0 0 2px', fontSize: '0.75rem', color: 'var(--text-secondary,var(--primary-dark))' }}>
                            {item.nome_produto} ({formatQtd(item.quantidade, item.produtos?.forma_venda)})
                          </p>
                        ))}
                        {p.pedido_itens.length > 2 && (
                          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted,var(--text-muted))' }}>+{p.pedido_itens.length - 2} item(s)</p>
                        )}
                      </div>
                    )}

                    <div style={{ height: 1, background: 'var(--border,var(--border))', margin: '0.4rem 0' }} />

                    {/* Data e tipo entrega */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', color: 'var(--text-secondary,var(--primary-dark))', marginBottom: '0.35rem' }}>
                      <span style={{ color: atrasado ? '#dc2626' : hoje ? '#d97706' : 'inherit', fontWeight: atrasado || hoje ? 600 : 400 }}>
                        {p.data_entrega ? `${atrasado ? 'Atrasado' : hoje ? 'Hoje' : p.data_entrega.split('-').reverse().join('/')}${p.horario_entrega ? ` · ${p.horario_entrega.slice(0, 5)}` : ''}` : 'Sem data'}
                      </span>
                      <span>{p.tipo_entrega === 'retirada' ? 'Retirada' : 'Entrega'}</span>
                    </div>

                    {/* Pagamento e valor */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 500, color: p.status_pagamento === 'pago' ? '#16a34a' : '#dc2626' }}>
                        {PAG_CONFIG[p.forma_pagamento] || 'PIX'} · {p.status_pagamento === 'pago' ? 'Pago' : 'Pendente'}
                      </span>
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-title,var(--text-title))' }}>{formatMoney(p.valor_total)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

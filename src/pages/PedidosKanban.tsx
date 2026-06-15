import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

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
  pedido_itens?: { nome_produto: string; quantidade: number }[]
}

const COLUNAS = [
  { key: 'novo',        label: 'Novo',        color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'confirmado',  label: 'Confirmado',  color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
  { key: 'em_producao', label: 'Em produção', color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
  { key: 'pronto',      label: 'Pronto',      color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
  { key: 'entregue',    label: 'Entregue',    color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
]

const PROXIMO: Record<string, string> = {
  novo: 'confirmado',
  confirmado: 'em_producao',
  em_producao: 'pronto',
  pronto: 'entregue',
}

const ANTERIOR: Record<string, string> = {
  confirmado: 'novo',
  em_producao: 'confirmado',
  pronto: 'em_producao',
  entregue: 'pronto',
}

const PAG_CONFIG: Record<string, string> = {
  pix: 'PIX', dinheiro: 'Dinheiro', credito: 'Crédito',
  debito: 'Débito', transferencia: 'Transf.',
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

  const avancar = async (e: React.MouseEvent, p: Pedido) => {
    e.stopPropagation()
    const proximo = PROXIMO[p.status]
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
    <div style={{ fontFamily: "'Geist', sans-serif", display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-title,#1F2937)', margin: 0 }}>Pedidos</h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted,#9CA3AF)', margin: '0.2rem 0 0' }}>{pedidos.filter(p => p.status !== 'cancelado').length} pedidos ativos</p>
        </div>
        <button onClick={onNovo} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          background: 'var(--primary,#FF6FA9)', color: 'white', border: 'none',
          borderRadius: '10px', padding: '0.6rem 1.1rem', fontSize: '0.85rem',
          fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo pedido
        </button>
      </div>

      {/* Kanban */}
      <div style={{
        display: 'flex', gap: '0.75rem',
        overflowX: 'auto', paddingBottom: '1rem',
        alignItems: 'flex-start',
      }}>
        {COLUNAS.map(col => {
          const colPedidos = pedidos.filter(p => p.status === col.key)
          return (
            <div key={col.key} style={{
              minWidth: '280px', width: '280px', flexShrink: 0,
              display: 'flex', flexDirection: 'column', gap: '0.5rem',
            }}>
              {/* Cabeçalho da coluna */}
              <div style={{
                background: col.color, borderRadius: '10px',
                padding: '0.6rem 0.85rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'white' }}>{col.label}</span>
                <span style={{
                  background: 'rgba(255,255,255,0.25)', color: 'white',
                  fontSize: '0.75rem', fontWeight: 700,
                  padding: '1px 8px', borderRadius: '20px',
                }}>{colPedidos.length} pedido{colPedidos.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {colPedidos.length === 0 && (
                  <div style={{
                    background: col.bg, border: `1.5px dashed ${col.border}`,
                    borderRadius: '12px', padding: '1.5rem',
                    textAlign: 'center', color: 'var(--text-muted,#9CA3AF)',
                    fontSize: '0.78rem',
                  }}>
                    Nenhum pedido
                  </div>
                )}

                {colPedidos.map(p => {
                  const dias = diasParaEntrega(p.data_entrega)
                  const atrasado = dias !== null && dias < 0 && !['entregue','cancelado'].includes(p.status)
                  const hoje = dias === 0
                  const resumoItens = p.pedido_itens?.slice(0,2).map(i => i.nome_produto).join(', ') || ''
                  const isLoadingCard = loading?.startsWith(p.id)

                  return (
                    <div
                      key={p.id}
                      onClick={() => navigate(`/pedidos/${p.id}`)}
                      style={{
                        background: 'var(--bg-card,#fff)',
                        border: `1.5px solid ${atrasado ? '#fca5a5' : 'var(--border,#E9E9EE)'}`,
                        borderRadius: '12px',
                        padding: '0.85rem',
                        cursor: 'pointer',
                        opacity: isLoadingCard ? 0.6 : 1,
                        transition: 'box-shadow 0.15s',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = ''}
                    >
                      {/* Atrasado banner */}
                      {atrasado && (
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#dc2626', background: '#fee2e2', borderRadius: '5px', padding: '2px 7px', marginBottom: '0.5rem', display: 'inline-block' }}>
                          ATRASADO
                        </div>
                      )}

                      {/* Número + ações */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted,#9CA3AF)' }}>Pedido #{p.numero || '—'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={e => e.stopPropagation()}>
                          {/* Voltar */}
                          {ANTERIOR[p.status] && (
                            <button
                              onClick={e => voltar(e, p)}
                              disabled={!!isLoadingCard}
                              title="Voltar status"
                              style={{
                                width: '26px', height: '26px', borderRadius: '6px',
                                border: '1.5px solid var(--border,#E9E9EE)',
                                background: 'var(--bg-body,#F7F7F8)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--text-secondary,#6B7280)', transition: 'all 0.15s',
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </button>
                          )}

                          {/* Cancelar */}
                          {p.status !== 'entregue' && (
                            <button
                              onClick={e => cancelar(e, p)}
                              disabled={!!isLoadingCard}
                              title="Cancelar pedido"
                              style={{
                                width: '26px', height: '26px', borderRadius: '6px',
                                border: '1.5px solid #fecaca',
                                background: '#fee2e2',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#dc2626', transition: 'all 0.15s',
                              }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          )}

                          {/* Avançar */}
                          {PROXIMO[p.status] && (
                            <button
                              onClick={e => avancar(e, p)}
                              disabled={!!isLoadingCard}
                              title={`Avançar para ${PROXIMO[p.status]}`}
                              style={{
                                width: '26px', height: '26px', borderRadius: '6px',
                                border: `1.5px solid ${col.color}`,
                                background: col.bg,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: col.color, transition: 'all 0.15s',
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Nome cliente */}
                      <p style={{ margin: '0 0 0.2rem', fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-title,#1F2937)', lineHeight: 1.3 }}>
                        {p.cliente_nome || 'Cliente não informado'}
                      </p>

                      {/* Produtos */}
                      {resumoItens && (
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary,#6B7280)' }}>
                          {resumoItens}
                        </p>
                      )}

                      {/* Telefone */}
                      {p.cliente_telefone && (
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary,#6B7280)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                          {p.cliente_telefone}
                        </p>
                      )}

                      {/* Divisória */}
                      <div style={{ height: '1px', background: 'var(--border,#E9E9EE)', margin: '0.5rem 0' }} />

                      {/* Data + entrega */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary,#6B7280)' }}>
                        <span style={{ color: atrasado ? '#dc2626' : hoje ? '#d97706' : 'inherit', fontWeight: atrasado || hoje ? 600 : 400 }}>
                          {p.data_entrega
                            ? `${atrasado ? 'Atrasado' : hoje ? 'Hoje' : p.data_entrega.split('-').reverse().join('/')}${p.horario_entrega ? ` · ${p.horario_entrega.slice(0,5)}` : ''}`
                            : 'Sem data'
                          }
                        </span>
                        <span>{p.tipo_entrega === 'retirada' ? 'Retirada' : p.tipo_entrega === 'entrega' ? 'Entrega' : 'Local'}</span>
                      </div>

                      {/* Pagamento + total */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 500,
                          color: p.status_pagamento === 'pago' ? '#16a34a' : '#dc2626',
                        }}>
                          {PAG_CONFIG[p.forma_pagamento] || 'PIX'} · {p.status_pagamento === 'pago' ? 'Pago' : 'Pendente'}
                        </span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-title,#1F2937)' }}>
                          {formatMoney(p.valor_total)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

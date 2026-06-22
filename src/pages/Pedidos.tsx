import { useState, useEffect } from 'react'
import PedidosKanban from '@/pages/PedidosKanban'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/hooks/use-mobile'

type PedidoItem = {
  nome_produto: string; quantidade: number; valor_unitario: number
  observacoes?: string
  imagem_url?: string | null
  personalizacoes?: { massa?: string | null; recheio?: string | null; cobertura?: string | null }
  produtos?: { imagem_url?: string | null; forma_venda?: string | null } | null
}

type Pedido = {
  id: string; numero: number; cliente_nome: string; cliente_telefone: string
  status: string; status_pagamento: string; prioridade: string
  data_entrega: string; horario_entrega: string; valor_total: number
  valor_recebido: number; tipo_entrega: string; forma_pagamento: string
  etiquetas: string[]; origem: string; created_at: string
  endereco_rua?: string; endereco_numero?: string; endereco_complemento?: string
  endereco_bairro?: string; endereco_cidade?: string; endereco_cep?: string
  personalizacao_tema?: string; personalizacao_nome?: string; personalizacao_idade?: string
  personalizacao_cor?: string; personalizacao_obs?: string
  observacoes?: string
  pedido_itens?: PedidoItem[]
}

// ── Status reais do sistema (usados pelo Kanban e pelo filtro) ────────────────
const TODOS_STATUS = [
  { key: 'novo',        label: 'Novo',                 color: '#534AB7', bg: '#EEEDFE', dot: '#7F77DD' },
  { key: 'em_producao', label: 'Em produção',          color: '#9a3412', bg: '#ffedd5', dot: '#f97316' },
  { key: 'pronto',      label: 'Pronto',               color: '#14532d', bg: '#dcfce7', dot: '#22c55e' },
  { key: 'a_caminho',   label: 'A Caminho / Retirado', color: '#0369a1', bg: '#e0f2fe', dot: '#0ea5e9' },
  { key: 'concluido',   label: 'Concluído',            color: '#374151', bg: '#f3f4f6', dot: '#9ca3af' },
  { key: 'cancelado',   label: 'Cancelado',            color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' },
]

const PAG_CONFIG: Record<string, string> = {
  pix: 'PIX', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito', transferencia: 'Transf.',
}

// Status visíveis por padrão (sem cancelado)
const STATUS_PADRAO = ['novo', 'em_producao', 'pronto', 'a_caminho', 'concluido']

// ── Status simplificado, só pra exibição na lista ──────────────────────────────
const STATUS_GROUPS = [
  { key: 'novo',        label: 'Novo',        color: '#534AB7', bg: '#EEEDFE', dot: '#7F77DD' },
  { key: 'em_producao', label: 'Em produção', color: '#854F0B', bg: '#FAEEDA', dot: '#EF9F27' },
  { key: 'pronto',      label: 'Pronto',      color: '#14532d', bg: '#dcfce7', dot: '#22c55e' },
  { key: 'a_caminho',   label: 'A Caminho',   color: '#0369a1', bg: '#e0f2fe', dot: '#0ea5e9' },
  { key: 'concluido',   label: 'Concluído',   color: '#374151', bg: '#f3f4f6', dot: '#9ca3af' },
  { key: 'cancelado',   label: 'Cancelado',   color: '#791F1F', bg: '#FCEBEB', dot: '#E24B4A' },
]
const STATUS_GROUP_CONFIG = Object.fromEntries(STATUS_GROUPS.map(s => [s.key, s]))

function getStatusGroup(status: string): string {
  const s = status || 'novo'
  if (s === 'cancelado' || s === 'excluido') return 'cancelado'
  if (s === 'concluido' || s === 'entregue') return 'concluido'
  if (s === 'a_caminho' || s === 'aguardando_retirada' || s === 'aguardando_entrega') return 'a_caminho'
  if (s === 'pronto') return 'pronto'
  if (s === 'em_producao') return 'em_producao'
  return 'novo' // novo, confirmado
}

// ── Quantidade com a unidade certa, conforme a forma de venda do produto ──────
const UNIDADE_LABEL: Record<string, string> = {
  fatia: 'fatia', kg: 'kg', cento: 'cento', caixa: 'caixa', 'kit-festa': 'kit',
}
function formatItemQuantidade(qtd: number, formaVenda?: string | null): string {
  const unidade = formaVenda ? UNIDADE_LABEL[formaVenda] : undefined
  const fracionavel = formaVenda === 'kg' || formaVenda === 'cento'
  const qtdStr = Number.isInteger(qtd) ? String(qtd) : String(qtd).replace('.', ',')
  if (!unidade) return `${qtdStr}x`
  return fracionavel ? `${qtdStr} ${unidade}` : `${qtdStr}x ${unidade}`
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

function isAtrasado(p: Pedido) {
  if (['concluido', 'cancelado', 'excluido', 'entregue'].includes(p.status)) return false
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

// ── Endereço de entrega completo, pro modal de mapa ────────────────────────────
function enderecoCompletoPedido(p: Pedido): string {
  return [
    p.endereco_rua && p.endereco_numero ? `${p.endereco_rua}, ${p.endereco_numero}` : p.endereco_rua,
    p.endereco_complemento,
    p.endereco_bairro,
    p.endereco_cidade,
    p.endereco_cep,
  ].filter(Boolean).join(', ')
}

// ── Modal de mapa (mesmo padrão já usado no cardápio público) ─────────────────
function MapaModal({ endereco, onClose }: { endereco: string; onClose: () => void }) {
  return (
    <>
      <div className="map-overlay" onClick={onClose} />
      <div className="map-sheet" onClick={e => e.stopPropagation()}>
        <iframe
          width="100%" height="200" style={{ border: 'none', display: 'block' }}
          src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_KEY}&q=${encodeURIComponent(endereco)}`}
          allowFullScreen
        />
        <div style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '1rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary,#986274)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <p style={{ fontFamily: 'inherit', fontSize: '0.9rem', color: 'var(--text-primary,#431524)', lineHeight: 1.5, margin: 0 }}>{endereco}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <a href={`https://waze.com/ul?q=${encodeURIComponent(endereco)}`} target="_blank" rel="noopener noreferrer" className="map-btn map-btn--waze">
              <img src="/waze.png" alt="" width={20} height={20} style={{ objectFit: 'contain' }} />
              Waze
            </a>
            <a href={`https://maps.google.com/?q=${encodeURIComponent(endereco)}`} target="_blank" rel="noopener noreferrer" className="map-btn map-btn--maps">
              <img src="/google-maps.png" alt="" width={20} height={20} style={{ objectFit: 'contain' }} />
              Google Maps
            </a>
          </div>
          <button onClick={onClose} className="map-btn-close">Fechar</button>
        </div>
      </div>
    </>
  )
}

// ── Card de pedido (lista) ──────────────────────────────────────────────────
function PedidoCard({ p, isMobile, onAbrirMapa, onVerPedido }: {
  p: Pedido
  isMobile: boolean
  onAbrirMapa: (endereco: string) => void
  onVerPedido: (p: Pedido) => void
}) {
  const navigate = useNavigate()
  const atrasado = isAtrasado(p)
  const dias = diasParaEntrega(p.data_entrega)
  const horas = dias === 0 ? horasParaEntrega(p.data_entrega, p.horario_entrega) : null
  const valorPendente = Math.max(0, (p.valor_total || 0) - (p.valor_recebido || 0))
  const isUrgente = p.prioridade === 'alta' || (horas !== null && horas <= 3 && horas >= 0)
  const grupo = STATUS_GROUP_CONFIG[getStatusGroup(p.status)]

  const itens = p.pedido_itens || []
  const primeiroItem = itens[0]
  const outrosItens = itens.length - 1
  const temEndereco = p.tipo_entrega === 'entrega' && !!p.endereco_rua

  // Campos condicionais — só aparecem se a confeiteira preencheu no cadastro do pedido
  const extras: string[] = []
  if (p.personalizacao_tema) extras.push(`Tema: ${p.personalizacao_tema}`)
  if (p.personalizacao_nome) extras.push(`Nome: ${p.personalizacao_nome}`)
  if (p.personalizacao_idade) extras.push(`Idade: ${p.personalizacao_idade}`)
  if (p.personalizacao_cor) extras.push(`Cor: ${p.personalizacao_cor}`)
  if (p.personalizacao_obs) extras.push(`Decoração: ${p.personalizacao_obs}`)
  if (p.observacoes) extras.push(`Obs: ${p.observacoes}`)
  itens.forEach(item => {
    if (item.personalizacoes?.massa) extras.push(item.personalizacoes.massa)
    if (item.personalizacoes?.recheio) extras.push(item.personalizacoes.recheio)
    if (item.personalizacoes?.cobertura) extras.push(item.personalizacoes.cobertura)
    if (item.observacoes) extras.push(item.observacoes)
  })

  const dataLabel = !p.data_entrega ? null
    : atrasado ? 'Atrasado'
    : dias === 0 ? 'Hoje'
    : dias === 1 ? 'Amanhã'
    : formatDate(p.data_entrega)
  const dataCor = atrasado ? '#dc2626' : dias === 0 ? '#d97706' : 'var(--text-secondary,#6E3548)'

  const pagamentoLabel = p.status_pagamento === 'pago'
    ? `${PAG_CONFIG[p.forma_pagamento] || 'PIX'} · Pago`
    : `${PAG_CONFIG[p.forma_pagamento] || 'PIX'} · ${p.status_pagamento === 'parcial' ? 'Parcial' : 'Pendente'}${valorPendente > 0 ? ` · ${formatMoney(valorPendente)}` : ''}`
  const pagamentoCor = p.status_pagamento === 'pago' ? '#16a34a' : p.status_pagamento === 'parcial' ? '#d97706' : '#dc2626'

  const ProdutoRow = (
    primeiroItem && (
      <div className="ped-card-produto-row">
        <div className="ped-card-produto-img">
          {(primeiroItem.imagem_url || primeiroItem.produtos?.imagem_url)
            ? <img src={primeiroItem.imagem_url || primeiroItem.produtos?.imagem_url || ''} alt={primeiroItem.nome_produto} />
            : <span>🎂</span>}
        </div>
        <div className="ped-card-produto-info">
          <p className="ped-card-produto-nome">
            {primeiroItem.nome_produto}
            {outrosItens > 0 && <span className="ped-card-mais-itens"> +{outrosItens} item{outrosItens > 1 ? 's' : ''}</span>}
          </p>
          <p className="ped-card-produto-qtd">{formatItemQuantidade(primeiroItem.quantidade, primeiroItem.produtos?.forma_venda)}</p>
        </div>
      </div>
    )
  )

  const EntregaInfo = (
    <div>
      {dataLabel && <p className="ped-card-data" style={{ color: dataCor }}>{dataLabel}{p.horario_entrega ? ` · ${p.horario_entrega.slice(0, 5)}` : ''}</p>}
      <p className="ped-card-tipo-entrega">{p.tipo_entrega === 'retirada' ? 'Retirada' : 'Entrega'}</p>
      {temEndereco && (
        <button type="button" className="ped-card-mapa" onClick={e => { e.stopPropagation(); onAbrirMapa(enderecoCompletoPedido(p)) }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          Ver no mapa
        </button>
      )}
    </div>
  )

  return (
    <div onClick={() => isMobile ? onVerPedido(p) : navigate(`/pedidos/${p.id}`)} className="ped-card" style={{ border: `1.5px solid ${isUrgente ? '#fca5a5' : 'var(--border,#ECC2D0)'}` }}>
      {isUrgente && (
        <div className="ped-card-banner">
          {atrasado ? 'Atrasado' : horas !== null && horas <= 3 ? `Entrega em ${horas}h` : 'Urgente'}
        </div>
      )}

      <div className="ped-card-head" style={!isMobile ? { display: 'none' } : { display: 'none' }} />

      {isMobile ? (
        <div className="mob-card-inner">

          {/* Linha 1: Pedido # + Status + Data/hora */}
          <div className="mob-card-topo">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span className="ped-card-numero">Pedido #{p.numero || '—'}{p.origem === 'cardapio' && <span className="ped-card-origem"> · Cardápio</span>}</span>
              <span className="ped-card-status" style={{ color: grupo.color, background: grupo.bg }}>
                <span className="ped-card-status-dot" style={{ background: grupo.dot }} />
                {grupo.label}
              </span>
            </div>
            <p className="mob-card-cliente">{p.cliente_nome || 'Não informado'}</p>
            {p.created_at && (
              <span className="mob-card-datetime">
                {new Date(p.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' })}
                {' · '}
                {new Date(p.created_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}
              </span>
            )}
          </div>

          <div className="mob-card-divider" />

          {/* Linha 2: Produto + subtotal */}
          {primeiroItem && (
            <div className="mob-card-produto">
              <div className="mob-card-produto-img">
                {(primeiroItem.imagem_url || primeiroItem.produtos?.imagem_url)
                  ? <img src={primeiroItem.imagem_url || primeiroItem.produtos?.imagem_url || ''} alt={primeiroItem.nome_produto} />
                  : <span>🎂</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="mob-card-produto-nome">
                  {primeiroItem.nome_produto}
                  {outrosItens > 0 && <span className="ped-card-mais-itens"> +{outrosItens}</span>}
                </p>
                <p className="mob-card-produto-qtd">{formatItemQuantidade(primeiroItem.quantidade, primeiroItem.produtos?.forma_venda)}</p>
              </div>
              <p className="mob-card-valor">{formatMoney(p.valor_total)}</p>
            </div>
          )}

          <div className="mob-card-divider" />

          {/* Linha 3: Pagamento + Entrega */}
          <div className="mob-card-rodape">
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="mob-card-info-label">Pgto:</span>
              <span style={{ fontSize: '0.78rem', color: pagamentoCor, fontWeight: 600 }}>{PAG_CONFIG[p.forma_pagamento] || 'PIX'}</span>
              <span className="ped-card-status" style={{ color: pagamentoCor, background: p.status_pagamento === 'pago' ? '#dcfce7' : p.status_pagamento === 'parcial' ? '#FAEEDA' : '#fee2e2', fontSize: '0.68rem', padding: '2px 7px' }}>
                {p.status_pagamento === 'pago' ? 'Pago' : p.status_pagamento === 'parcial' ? 'Parcial' : 'Pendente'}
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary,#6E3548)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {p.tipo_entrega === 'retirada' ? '📦 Retirada' : '🛵 Entrega'}
              {dataLabel && <span style={{ color: dataCor, fontWeight: 600 }}>· {dataLabel}</span>}
            </span>
          </div>

        </div>
      ) : (
        /* ── Layout desktop: tabela limpa estilo design referência ── */
        <div className="ped-dt-row">
          {/* Pedido # + data criação */}
          <div className="ped-dt-col ped-dt-col--num">
            <span className="ped-dt-num">#{p.numero || '—'}</span>
            {p.origem === 'cardapio' && <span className="ped-card-origem">Cardápio</span>}
            <span className="ped-dt-criado">
              {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' }) + ' - ' + new Date(p.created_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : ''}
            </span>
          </div>

          {/* Cliente */}
          <div className="ped-dt-col ped-dt-col--cliente">
            <span className="ped-dt-cliente-nome">{p.cliente_nome || 'Não informado'}</span>
          </div>

          {/* Produto */}
          <div className="ped-dt-col ped-dt-col--produto">
            {primeiroItem ? (
              <div className="ped-dt-produto-row">
                <div className="ped-dt-produto-img">
                  {(primeiroItem.imagem_url || primeiroItem.produtos?.imagem_url)
                    ? <img src={primeiroItem.imagem_url || primeiroItem.produtos?.imagem_url || ''} alt={primeiroItem.nome_produto} />
                    : <span>🎂</span>}
                </div>
                <div>
                  <p className="ped-dt-produto-nome">
                    {primeiroItem.nome_produto}
                    {outrosItens > 0 && <span className="ped-card-mais-itens"> +{outrosItens}</span>}
                  </p>
                  <p className="ped-dt-produto-qtd">{formatItemQuantidade(primeiroItem.quantidade, primeiroItem.produtos?.forma_venda)}</p>
                </div>
              </div>
            ) : <span className="ped-dt-vazio">—</span>}
          </div>

          {/* Entrega */}
          <div className="ped-dt-col ped-dt-col--entrega">
            {dataLabel && (
              <p className="ped-dt-data" style={{ color: dataCor }}>
                {dataLabel}{p.horario_entrega ? ` · ${p.horario_entrega.slice(0,5)}` : ''}
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <p className="ped-dt-tipo">{p.tipo_entrega === 'retirada' ? 'Retirada' : 'Entrega'}</p>
              {temEndereco && (
                <button type="button" className="ped-card-mapa" onClick={e => { e.stopPropagation(); onAbrirMapa(enderecoCompletoPedido(p)) }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  Ver no mapa
                </button>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="ped-dt-col ped-dt-col--status">
            <span className="ped-card-status" style={{ color: grupo.color, background: grupo.bg }}>
              <span className="ped-card-status-dot" style={{ background: grupo.dot }} />
              {grupo.label}
            </span>
          </div>

          {/* Valor + pagamento */}
          <div className="ped-dt-col ped-dt-col--valor">
            <p className="ped-dt-valor">{formatMoney(p.valor_total)}</p>
            <p className="ped-dt-pag" style={{ color: pagamentoCor }}>{pagamentoLabel}</p>
          </div>

          {/* Ver Pedido */}
          <div className="ped-dt-col ped-dt-col--ver">
            <button type="button" className="ped-dt-ver-btn" onClick={e => { e.stopPropagation(); onVerPedido(p) }}>
              Ver pedido
            </button>
          </div>
        </div>
      )}

      {(extras.length > 0 || (p.etiquetas || []).length > 0) && isMobile && (
        <div className="ped-card-extras">
          {extras.map((e, i) => <span key={i} className="ped-card-chip">{e}</span>)}
          {(p.etiquetas || []).slice(0, 4).map(e => <span key={e} className="ped-card-chip ped-card-chip--etiqueta">{e}</span>)}
        </div>
      )}
    </div>
  )
}

// ── Modal de detalhes do pedido ──────────────────────────────────────────────
function ModalPedido({ p, onClose, onEditar, onExcluir }: { p: Pedido; onClose: () => void; onEditar: () => void; onExcluir: () => void }) {
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const grupo = STATUS_GROUP_CONFIG[getStatusGroup(p.status)]
  const itens = p.pedido_itens || []
  const valorPendente = Math.max(0, (p.valor_total || 0) - (p.valor_recebido || 0))
  const pagamentoCor = p.status_pagamento === 'pago' ? '#16a34a' : p.status_pagamento === 'parcial' ? '#d97706' : '#dc2626'
  const pagamentoLabel = p.status_pagamento === 'pago'
    ? `${PAG_CONFIG[p.forma_pagamento] || 'PIX'} · Pago`
    : `${PAG_CONFIG[p.forma_pagamento] || 'PIX'} · ${p.status_pagamento === 'parcial' ? 'Parcial' : 'Pendente'}${valorPendente > 0 ? ` · ${formatMoney(valorPendente)}` : ''}`

  const enderecoCompleto = [p.endereco_rua && p.endereco_numero ? `${p.endereco_rua}, ${p.endereco_numero}` : p.endereco_rua, p.endereco_complemento, p.endereco_bairro, p.endereco_cidade].filter(Boolean).join(', ')

  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  return (
    <>
      <div className="mp-overlay" onClick={onClose} />
      <div className="mp-modal" onClick={e => e.stopPropagation()}>
        <div className="mp-handle" />

        <div className="mp-body">

          {/* ── Seção 1: Identificação ── */}
          <div className="mp-secao">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <span className="mp-numero">Pedido #{p.numero || '—'}</span>
                {p.created_at && (
                  <p className="mp-criado">
                    {new Date(p.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' })}
                    {' · '}
                    {new Date(p.created_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}
                  </p>
                )}
                {p.origem === 'cardapio' && <p className="mp-criado">via Cardápio</p>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="ped-card-status" style={{ color: grupo.color, background: grupo.bg }}>
                  <span className="ped-card-status-dot" style={{ background: grupo.dot }} />
                  {grupo.label}
                </span>
                <button className="mp-fechar" onClick={onClose}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
          </div>

          {/* ── Seção 2: Dados do cliente e entrega ── */}
          <div className="mp-secao">
            <p className="mp-secao-titulo">Cliente</p>
            <p className="mp-secao-val">{p.cliente_nome || '—'}</p>
            {p.cliente_telefone && <p className="mp-secao-sub">{p.cliente_telefone}</p>}
            <div style={{ height: 10 }} />
            <p className="mp-secao-titulo">Entrega</p>
            <p className="mp-secao-val">{p.tipo_entrega === 'retirada' ? 'Retirada' : 'Entrega'}{p.data_entrega ? ` · ${formatDate(p.data_entrega)}${p.horario_entrega ? ` às ${p.horario_entrega.slice(0,5)}` : ''}` : ''}</p>
            {enderecoCompleto && <p className="mp-secao-sub">{enderecoCompleto}</p>}
          </div>

          {/* ── Seção 3: Produtos + pagamento + botões ── */}
          <div className="mp-secao">
            {itens.length > 0 && (
              <>
                <p className="mp-secao-titulo">Produtos</p>
                <div className="mp-itens">
                  {itens.map((item, i) => (
                    <div key={i} className="mp-item">
                      <div className="mp-item-img">
                        {(item.imagem_url || item.produtos?.imagem_url) ? <img src={item.imagem_url || item.produtos?.imagem_url!} alt={item.nome_produto} /> : <span>🎂</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="mp-item-nome">{item.nome_produto}</p>
                        <p className="mp-item-qtd">{formatItemQuantidade(item.quantidade, item.produtos?.forma_venda)} · {formatMoney(item.valor_unitario)}</p>
                        {item.personalizacoes?.massa && <p className="mp-item-extra">Massa: {item.personalizacoes.massa}</p>}
                        {item.personalizacoes?.recheio && <p className="mp-item-extra">Recheio: {item.personalizacoes.recheio}</p>}
                        {item.personalizacoes?.cobertura && <p className="mp-item-extra">Cobertura: {item.personalizacoes.cobertura}</p>}
                        {item.observacoes && <p className="mp-item-extra">Obs: {item.observacoes}</p>}
                      </div>
                      <p className="mp-item-total">{formatMoney(item.quantidade * item.valor_unitario)}</p>
                    </div>
                  ))}
                </div>
                <div style={{ height: 10 }} />
              </>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p className="mp-secao-titulo">Pagamento</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span className="mp-secao-val">{PAG_CONFIG[p.forma_pagamento] || 'PIX'}</span>
                  <span className="ped-card-status" style={{ color: pagamentoCor, background: p.status_pagamento === 'pago' ? '#dcfce7' : p.status_pagamento === 'parcial' ? '#FAEEDA' : '#fee2e2', fontSize: '0.68rem', padding: '2px 8px' }}>
                    {p.status_pagamento === 'pago' ? 'Pago' : p.status_pagamento === 'parcial' ? 'Parcial' : 'Pendente'}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p className="mp-secao-titulo">Total</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-title,#431524)', margin: 0 }}>{formatMoney(p.valor_total)}</p>
              </div>
            </div>

            {/* Botões */}
            <div className="mp-btns">
              <button className="mp-btn-editar" onClick={onEditar}>Editar pedido</button>
              {!confirmExcluir ? (
                <button className="mp-btn-excluir" onClick={() => setConfirmExcluir(true)}>Excluir pedido</button>
              ) : (
                <div className="mp-confirm-excluir">
                  <p>Tem certeza? Esta ação não pode ser desfeita.</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="mp-btn-fechar" style={{ flex: 1 }} onClick={() => setConfirmExcluir(false)}>Cancelar</button>
                    <button className="mp-btn-confirmar-excluir" style={{ flex: 1 }} onClick={onExcluir}>Sim, excluir</button>
                  </div>
                </div>
              )}
              <button className="mp-btn-fechar" onClick={onClose}>Fechar</button>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

// ── Drawer de Filtros ────────────────────────────────────────────────────────
function FiltroDrawer({ statusSelecionados, setStatusSelecionados, periodoFiltro, setPeriodoFiltro, dataInicio, setDataInicio, dataFim, setDataFim, onClose }: {
  statusSelecionados: string[]
  setStatusSelecionados: (v: string[]) => void
  periodoFiltro: string
  setPeriodoFiltro: (v: string) => void
  dataInicio: string
  setDataInicio: (v: string) => void
  dataFim: string
  setDataFim: (v: string) => void
  onClose: () => void
}) {
  const [localStatus, setLocalStatus] = useState<string[]>(statusSelecionados)
  const [localPeriodo, setLocalPeriodo] = useState(periodoFiltro)
  const [localInicio, setLocalInicio] = useState(dataInicio)
  const [localFim, setLocalFim] = useState(dataFim)

  const toggleStatus = (key: string) =>
    setLocalStatus(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key])

  const aplicar = () => {
    setStatusSelecionados(localStatus)
    setPeriodoFiltro(localPeriodo)
    setDataInicio(localInicio)
    setDataFim(localFim)
    onClose()
  }

  const limpar = () => {
    setLocalStatus(STATUS_PADRAO)
    setLocalPeriodo('todos')
    setLocalInicio('')
    setLocalFim('')
  }

  return (
    <>
      <div className="fd-overlay" onClick={onClose} />
      <div className="fd-drawer">
        <div className="fd-handle" />
        <div className="fd-header">
          <span className="fd-title">Filtros</span>
          <button className="fd-limpar" onClick={limpar}>Limpar tudo</button>
        </div>
        <div className="fd-body">
          {/* Status */}
          <p className="fd-label">Status</p>
          <div className="fd-status-grid">
            {TODOS_STATUS.map(s => {
              const on = localStatus.includes(s.key)
              return (
                <button
                  key={s.key}
                  className="fd-status-btn"
                  style={on ? { background: s.bg, borderColor: s.dot, color: s.color, fontWeight: 700 } : {}}
                  onClick={() => toggleStatus(s.key)}
                >
                  <span className="fd-dot" style={{ background: s.dot }} />
                  {s.label}
                </button>
              )
            })}
          </div>

          {/* Período */}
          <p className="fd-label" style={{ marginTop: '1.25rem' }}>Período de entrega</p>
          <div className="fd-periodo-grid">
            {[
              { key: 'todos',        label: 'Todos' },
              { key: 'hoje',         label: 'Hoje' },
              { key: 'semana',       label: 'Esta semana' },
              { key: 'mes',          label: 'Este mês' },
              { key: 'personalizado', label: 'Personalizado' },
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

          {/* Datas personalizadas */}
          {localPeriodo === 'personalizado' && (
            <div className="fd-datas">
              <div className="fd-data-field">
                <label className="fd-data-label">De</label>
                <input type="date" className="fd-data-input" value={localInicio} onChange={e => setLocalInicio(e.target.value)} />
              </div>
              <div className="fd-data-field">
                <label className="fd-data-label">Até</label>
                <input type="date" className="fd-data-input" value={localFim} onChange={e => setLocalFim(e.target.value)} />
              </div>
            </div>
          )}
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
  const [statusSelecionados, setStatusSelecionados] = useState<string[]>(STATUS_PADRAO)
  const [periodoFiltro, setPeriodoFiltro] = useState('todos')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [mapaAberto, setMapaAberto] = useState<string | null>(null)
  const [modalPedido, setModalPedido] = useState<Pedido | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) fetchPedidos(user.id) })
  }, [])

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('pedidos').update({ status }).eq('id', id)
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, status } : p))
  }

  const excluirPedido = async (id: string) => {
    await supabase.from('pedido_itens').delete().eq('pedido_id', id)
    await supabase.from('pedidos').delete().eq('id', id)
    setModalPedido(null)
    setPedidos(prev => prev.filter(p => p.id !== id))
  }

  const fetchPedidos = async (uid: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('pedidos')
      .select('*, pedido_itens(nome_produto, quantidade, valor_unitario, observacoes, personalizacoes, imagem_url, produtos(imagem_url, forma_venda))')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    setPedidos(data || [])
    setLoading(false)
  }

  const pedidosFiltrados = pedidos.filter(p => {
    const matchStatus = statusSelecionados.includes(p.status)
    const matchBusca = !busca ||
      p.cliente_nome?.toLowerCase().includes(busca.toLowerCase()) ||
      String(p.numero).includes(busca)

    let matchPeriodo = true
    if (p.data_entrega) {
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
      const data = parseLocalDate(p.data_entrega)
      if (periodoFiltro === 'hoje') {
        matchPeriodo = data.getTime() === hoje.getTime()
      } else if (periodoFiltro === 'semana') {
        const fim = new Date(hoje); fim.setDate(fim.getDate() + 7)
        matchPeriodo = data >= hoje && data <= fim
      } else if (periodoFiltro === 'mes') {
        matchPeriodo = data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear()
      } else if (periodoFiltro === 'personalizado') {
        if (dataInicio) matchPeriodo = data >= parseLocalDate(dataInicio)
        if (dataFim && matchPeriodo) matchPeriodo = data <= parseLocalDate(dataFim)
      }
    }

    return matchStatus && matchBusca && matchPeriodo
  })

  const filtrosAtivos =
    statusSelecionados.length !== STATUS_PADRAO.length ||
    !STATUS_PADRAO.every(s => statusSelecionados.includes(s)) ||
    periodoFiltro !== 'todos'

  return (
    <div style={{ fontFamily: "'Geist', sans-serif", display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

      {/* ── Header com padding mobile ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', paddingTop: isMobile ? '1.25rem' : 0 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-title,#431524)', margin: 0 }}>Pedidos</h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted,#C39EAA)', margin: '0.1rem 0 0' }}>
            {pedidosFiltrados.length} pedido{pedidosFiltrados.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {/* Toggle lista/kanban — só desktop */}
          {!isMobile && (
            <div style={{ display: 'flex', background: 'var(--bg-card,#fff)', border: '1.5px solid var(--border,#ECC2D0)', borderRadius: 10, padding: 3, gap: 2 }}>
              <button onClick={() => setView('lista')} title="Lista" style={{ padding: '0.35rem 0.6rem', borderRadius: 7, border: 'none', cursor: 'pointer', background: view === 'lista' ? 'var(--primary,#986274)' : 'transparent', color: view === 'lista' ? 'white' : 'var(--text-secondary,#6E3548)', transition: 'all 0.15s' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
              <button onClick={() => setView('kanban')} title="Kanban" style={{ padding: '0.35rem 0.6rem', borderRadius: 7, border: 'none', cursor: 'pointer', background: view === 'kanban' ? 'var(--primary,#986274)' : 'transparent', color: view === 'kanban' ? 'white' : 'var(--text-secondary,#6E3548)', transition: 'all 0.15s' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="11" rx="1"/></svg>
              </button>
            </div>
          )}

          {/* Botão filtro */}
          <button
            onClick={() => setShowFiltro(true)}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${filtrosAtivos ? 'var(--primary,#986274)' : 'var(--border,#ECC2D0)'}`, background: filtrosAtivos ? 'var(--primary-light,#F7EEF1)' : 'var(--bg-card,#fff)', cursor: 'pointer', color: filtrosAtivos ? 'var(--primary,#986274)' : 'var(--text-secondary,#6E3548)', flexShrink: 0 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            {filtrosAtivos && <span style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, borderRadius: '50%', background: 'var(--primary,#986274)', border: '2px solid white' }} />}
          </button>

          {/* Novo pedido */}
          <button
            onClick={() => navigate('/pedidos/novo')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--primary,#986274)', color: 'white', border: 'none', borderRadius: 10, padding: isMobile ? '0.6rem 0.75rem' : '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {!isMobile && 'Registrar pedido'}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-card,#fff)', border: '1.5px solid var(--border,#ECC2D0)', borderRadius: 12, padding: '0.6rem 0.9rem' }}>
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
                {busca || filtrosAtivos ? 'Tente ajustar os filtros' : 'Registre seu primeiro pedido'}
              </p>
              {!filtrosAtivos && !busca && (
                <button onClick={() => navigate('/pedidos/novo')} style={{ marginTop: '0.5rem', background: 'var(--primary,#986274)', color: 'white', border: 'none', borderRadius: 10, padding: '0.6rem 1.25rem', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                  Registrar primeiro pedido
                </button>
              )}
            </div>
          ) : (
            <div className={!isMobile ? 'ped-dt-wrapper' : ''} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.65rem' : 0 }}>
              {/* Cabeçalho da tabela — só desktop */}
              {!isMobile && (
                <div className="ped-dt-header">
                  <div className="ped-dt-col ped-dt-col--num">Pedido</div>
                  <div className="ped-dt-col ped-dt-col--cliente">Cliente</div>
                  <div className="ped-dt-col ped-dt-col--produto">Produto</div>
                  <div className="ped-dt-col ped-dt-col--entrega">Entrega</div>
                  <div className="ped-dt-col ped-dt-col--status">Status</div>
                  <div className="ped-dt-col ped-dt-col--valor">Valor</div>
                  <div className="ped-dt-col ped-dt-col--ver"></div>
                </div>
              )}
              {pedidosFiltrados.map(p => (
                <PedidoCard key={p.id} p={p} isMobile={isMobile} onAbrirMapa={setMapaAberto} onVerPedido={setModalPedido} />
              ))}
            </div>
          )}
        </>
      )}

      {showFiltro && (
        <FiltroDrawer
          statusSelecionados={statusSelecionados} setStatusSelecionados={setStatusSelecionados}
          periodoFiltro={periodoFiltro} setPeriodoFiltro={setPeriodoFiltro}
          dataInicio={dataInicio} setDataInicio={setDataInicio}
          dataFim={dataFim} setDataFim={setDataFim}
          onClose={() => setShowFiltro(false)}
        />
      )}

      {mapaAberto && <MapaModal endereco={mapaAberto} onClose={() => setMapaAberto(null)} />}
      {modalPedido && <ModalPedido p={modalPedido} onClose={() => setModalPedido(null)} onEditar={() => { setModalPedido(null); navigate(`/pedidos/${modalPedido.id}`) }} onExcluir={() => excluirPedido(modalPedido.id)} />}

      <style>{`
        @keyframes pedSpin { to { transform: rotate(360deg); } }
        @keyframes hsFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes hsSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }

        /* ── Card de pedido ── */
        .ped-card { background: var(--bg-card,#fff); border-radius: 14px; cursor: pointer; font-family: inherit; position: relative; overflow: hidden; }
        .ped-card-banner { background: #fee2e2; padding: 4px 1.1rem; font-size: 0.72rem; font-weight: 700; color: #dc2626; }
        .ped-card-head { display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1.1rem 0; gap: 0.5rem; }
        .ped-card-numero { font-size: 0.72rem; font-weight: 600; color: var(--text-muted,#C39EAA); }
        .ped-card-origem { margin-left: 6px; background: #ede9fe; color: #5b21b6; border-radius: 4px; padding: 1px 6px; font-size: 0.62rem; font-weight: 700; }
        .ped-card-status { display: inline-flex; align-items: center; gap: 5px; font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: 8px; flex-shrink: 0; }
        .ped-card-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .ped-card-body { padding: 0.65rem 1.1rem 0; }
        .ped-card-cliente { margin: 0 0 0.5rem; font-size: 1.02rem; font-weight: 700; color: var(--text-title,#431524); line-height: 1.25; }
        .ped-card-produto-row { display: flex; align-items: center; gap: 0.65rem; min-width: 0; }
        .ped-card-produto-img { width: 42px; height: 42px; border-radius: 8px; flex-shrink: 0; background: var(--bg-subtle,#F7EEF1); border: 1px solid var(--border,#ECC2D0); overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
        .ped-card-produto-img img { width: 100%; height: 100%; object-fit: cover; }
        .ped-card-produto-info { flex: 1; min-width: 0; }
        .ped-card-produto-nome { margin: 0; font-size: 0.85rem; font-weight: 600; color: var(--text-title,#431524); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ped-card-mais-itens { font-weight: 500; color: var(--text-muted,#C39EAA); }
        .ped-card-produto-qtd { margin: 2px 0 0; font-size: 0.75rem; color: var(--text-secondary,#6E3548); }
        .ped-card-data { margin: 0; font-size: 0.82rem; font-weight: 600; line-height: 1.3; }
        .ped-card-tipo-entrega { margin: 1px 0 0; font-size: 0.75rem; color: var(--text-secondary,#6E3548); }
        .ped-card-mapa { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; padding: 0; margin-top: 3px; font-size: 0.72rem; font-weight: 600; color: var(--primary,#986274); cursor: pointer; font-family: inherit; }
        .ped-card-mapa:hover { text-decoration: underline; }
        .ped-card-pagamento { font-size: 0.82rem; font-weight: 600; }
        .ped-card-valor { font-size: 1.15rem; font-weight: 800; color: var(--text-title,#431524); letter-spacing: -0.02em; }
        .ped-card-extras { border-top: 1px solid var(--border,#ECC2D0); padding: 0.65rem 1.1rem; display: flex; flex-wrap: wrap; gap: 6px; margin-top: 0.85rem; }
        .ped-card-chip { font-size: 0.7rem; font-weight: 500; background: var(--bg-subtle,#F7EEF1); color: var(--primary,#986274); border: 1px solid var(--border,#ECC2D0); border-radius: 6px; padding: 3px 8px; }
        .ped-card-chip--etiqueta { background: var(--bg-body,#FAFAFA); color: var(--text-secondary,#6E3548); }

        /* ── Card mobile novo ── */
        .mob-card-inner { display: flex; flex-direction: column; padding: 0.65rem 0.9rem; gap: 0.45rem; }
        .mob-card-topo { display: flex; flex-direction: column; gap: 2px; }
        .mob-card-cliente { font-size: 0.92rem; font-weight: 700; color: var(--text-title,#431524); margin: 2px 0 0; }
        .mob-card-datetime { font-size: 0.7rem; color: var(--text-muted,#C39EAA); }
        .mob-card-meta { display: flex; gap: 10px; font-size: 0.72rem; color: var(--text-muted,#C39EAA); }
        .mob-card-divider { height: 1px; border-top: 1px dashed var(--border,#ECC2D0); margin: 0.1rem 0; }
        .mob-card-produto { display: flex; align-items: center; gap: 8px; }
        .mob-card-produto-img { width: 34px; height: 34px; border-radius: 7px; flex-shrink: 0; background: var(--bg-subtle,#F7EEF1); border: 1px solid var(--border,#ECC2D0); overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 1rem; }
        .mob-card-produto-img img { width: 100%; height: 100%; object-fit: cover; }
        .mob-card-produto-nome { font-size: 0.82rem; font-weight: 600; color: var(--text-title,#431524); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
        .mob-card-produto-qtd { font-size: 0.7rem; color: var(--text-secondary,#6E3548); margin: 1px 0 0; }
        .mob-card-infos { display: flex; flex-direction: column; gap: 3px; }
        .mob-card-info-row { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 0.78rem; color: var(--text-secondary,#6E3548); }
        .mob-card-info-label { font-weight: 600; color: var(--text-title,#431524); font-size: 0.75rem; }
        .mob-card-rodape { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
        .mob-card-valor { font-size: 1rem; font-weight: 800; color: var(--text-title,#431524); margin: 0; letter-spacing: -0.02em; white-space: nowrap; }


        .ped-card-rodape { display: flex; align-items: flex-end; justify-content: space-between; padding: 0.85rem 1.1rem; gap: 0.75rem; }
        .ped-card-rodape-direita { text-align: right; }
        .ped-card-rodape-direita .ped-card-valor { margin: 4px 0 0; }

        /* ── Modal de pedido ── */
        .mp-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--border,#ECC2D0); margin: 10px auto 0; flex-shrink: 0; }
        @media (min-width: 768px) { .mp-handle { display: none; } }
        .mp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9998; animation: hsFadeIn 0.2s ease; }
        .mp-modal { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-card,#fff); border-radius: 20px 20px 0 0; z-index: 9999; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 -4px 32px rgba(0,0,0,0.2); animation: hsSlideUp 0.28s cubic-bezier(0.32,0.72,0,1); font-family: inherit; }
        @media (min-width: 768px) { .mp-modal { top: 50%; left: 50%; right: auto; bottom: auto; transform: translate(-50%,-50%); border-radius: 16px; width: 420px; max-width: 95vw; animation: hsFadeIn 0.2s ease; box-shadow: 0 20px 60px rgba(0,0,0,0.2); } }
        .mp-numero { font-size: 1rem; font-weight: 800; color: var(--text-title,#431524); }
        .mp-criado { font-size: 0.68rem; color: var(--text-muted,#C39EAA); margin: 2px 0 0; }
        .mp-fechar { background: none; border: none; cursor: pointer; color: var(--text-muted,#C39EAA); display: flex; padding: 4px; border-radius: 6px; flex-shrink: 0; }
        .mp-fechar:hover { background: var(--bg-subtle,#F7EEF1); color: var(--text-title,#431524); }
        .mp-body { overflow-y: auto; flex: 1; padding: 0 1rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .mp-secao { background: var(--bg-subtle,#F7EEF1); border-radius: 14px; padding: 0.85rem 1rem; }
        .mp-secao-titulo { font-size: 0.7rem; font-weight: 700; color: var(--text-muted,#C39EAA); text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 2px; }
        .mp-secao-val { font-size: 0.9rem; font-weight: 600; color: var(--text-title,#431524); margin: 0; }
        .mp-secao-sub { font-size: 0.78rem; color: var(--text-secondary,#6E3548); margin: 2px 0 0; }
        .mp-itens { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
        .mp-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px dashed var(--border,#ECC2D0); }
        .mp-item:last-child { border-bottom: none; padding-bottom: 0; }
        .mp-item-img { width: 34px; height: 34px; border-radius: 7px; background: var(--bg-card,#fff); border: 1px solid var(--border,#ECC2D0); overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; }
        .mp-item-img img { width: 100%; height: 100%; object-fit: cover; }
        .mp-item-nome { font-size: 0.84rem; font-weight: 600; color: var(--text-title,#431524); margin: 0; }
        .mp-item-qtd { font-size: 0.72rem; color: var(--text-secondary,#6E3548); margin: 1px 0 0; }
        .mp-item-extra { font-size: 0.68rem; color: var(--text-muted,#C39EAA); margin: 1px 0 0; }
        .mp-item-total { font-size: 0.84rem; font-weight: 700; color: var(--text-title,#431524); flex-shrink: 0; margin: 0; }
        .mp-btns { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
        .mp-btn-excluir { width: 100%; background: #fff1f2; border: 1.5px solid #fca5a5; color: #dc2626; border-radius: 12px; padding: 0.75rem; font-size: 0.9rem; font-weight: 600; cursor: pointer; font-family: inherit; }
        .mp-confirm-excluir { background: #fff1f2; border-radius: 12px; padding: 0.85rem 1rem; }
        .mp-confirm-excluir p { font-size: 0.82rem; color: #dc2626; margin: 0 0 10px; font-weight: 500; }
        .mp-btn-confirmar-excluir { background: #dc2626; border: none; color: white; border-radius: 10px; padding: 0.65rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; font-family: inherit; }
        .mp-btn-fechar { width: 100%; background: var(--bg-card,#fff); border: 1.5px solid var(--border,#ECC2D0); color: var(--text-secondary,#6E3548); border-radius: 12px; padding: 0.75rem; font-size: 0.9rem; font-weight: 600; cursor: pointer; font-family: inherit; }

        @media (min-width: 768px) {
          /* Wrapper da lista vira um bloco com borda e radius */
          .ped-dt-wrapper { background: var(--bg-card,#fff); border: 1.5px solid var(--border,#ECC2D0); border-radius: 14px; overflow: hidden; width: 100%; }

          /* Cabeçalho */
          .ped-dt-header {
            display: grid;
            grid-template-columns: 145px 160px 1fr 160px 110px 130px 100px;
            align-items: center;
            padding: 0.55rem 1.25rem;
            background: #6E3548;
            border-bottom: 1.5px solid var(--border,#ECC2D0);
            font-size: 0.65rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: rgba(236,194,208,0.8);
            gap: 16px;
          }

          /* Cada linha de pedido no desktop */
          .ped-dt-row {
            display: grid;
            grid-template-columns: 145px 160px 1fr 160px 110px 130px 100px;
            align-items: center;
            padding: 0.8rem 1.25rem;
            gap: 16px;
            cursor: pointer;
            transition: background 0.12s;
          }
          .ped-dt-row:last-child { border-bottom: none; }
          .ped-dt-row:nth-child(odd) { background: #ffffff; }
          .ped-dt-row:nth-child(even) { background: #ffffff; }
          .ped-dt-row:hover { background: var(--bg-subtle,#F7EEF1); }
          .ped-dt-row > * { min-height: 54px; }

          /* Colunas individuais */
          .ped-dt-col { display: flex; flex-direction: column; justify-content: center; min-width: 0; }
          .ped-dt-col--num { gap: 2px; }
          .ped-dt-col--cliente { flex-direction: row; align-items: center; gap: 10px; width: 100%; }
          .ped-dt-col--produto { flex-direction: row; align-items: center; gap: 0; }
          .ped-dt-col--entrega { gap: 2px; }
          .ped-dt-col--status { align-items: flex-start; }
          .ped-dt-cliente-info { flex: 1; min-width: 0; }

          /* Número do pedido */
          .ped-dt-num { font-size: 0.9rem; font-weight: 700; color: var(--primary,#986274); }
          .ped-dt-criado { font-size: 0.7rem; color: var(--text-muted,#C39EAA); margin-top: 1px; }

          /* Avatar do cliente */
          .ped-dt-avatar {
            width: 34px; height: 34px; border-radius: 50%;
            background: var(--primary-light,#F7EEF1);
            border: 1.5px solid var(--border,#ECC2D0);
            color: var(--primary,#986274);
            font-size: 0.78rem; font-weight: 700;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
          }
          .ped-dt-cliente-nome {
            font-size: 0.95rem; font-weight: 400;
            color: var(--text-title,#431524);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }

          .ped-dt-col--ver { align-items: flex-end; }
          .ped-dt-ver-btn {
            background: none; border: 1.5px solid var(--primary,#986274);
            color: var(--primary,#986274); border-radius: 8px;
            padding: 0.35rem 0.75rem; font-size: 0.75rem; font-weight: 600;
            cursor: pointer; font-family: inherit; white-space: nowrap;
            transition: all 0.15s;
          }
          .ped-dt-ver-btn:hover { background: var(--primary,#986274); color: white; }

          /* Produto */
          .ped-dt-produto-row { display: flex; align-items: center; gap: 10px; min-width: 0; width: 100%; }
          .ped-dt-produto-img {
            width: 36px; height: 36px; border-radius: 7px; flex-shrink: 0;
            background: var(--bg-subtle,#F7EEF1); border: 1px solid var(--border,#ECC2D0);
            overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 1rem; line-height: 1;
          }
          .ped-dt-produto-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
          .ped-dt-produto-info { flex: 1; min-width: 0; }
          .ped-dt-produto-nome {
            font-size: 0.84rem; font-weight: 600; color: var(--text-title,#431524);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; margin: 0; max-width: 280px;
          }
          .ped-dt-produto-qtd { font-size: 0.72rem; color: var(--text-secondary,#6E3548); margin: 2px 0 0; }

          /* Entrega */
          .ped-dt-data { font-size: 0.84rem; font-weight: 600; margin: 0; }
          .ped-dt-tipo { font-size: 0.75rem; color: var(--text-secondary,#6E3548); margin: 2px 0 0; }

          /* Valor */
          .ped-dt-valor { font-size: 1rem; font-weight: 800; color: var(--text-title,#431524); letter-spacing: -0.02em; margin: 0; }
          .ped-dt-pag { font-size: 0.72rem; font-weight: 600; margin: 3px 0 0; }

          .ped-dt-vazio { color: var(--text-muted,#C39EAA); font-size: 0.85rem; }

          /* No desktop, o card vira uma linha flat — sem borda/radius próprios */
          .ped-card { border: none !important; border-radius: 0 !important; background: transparent !important; border-bottom: 1.5px solid #D4A0B0 !important; }
          .ped-card:last-child { border-bottom: none !important; }

          /* Banner de urgente ainda aparece no desktop */
          .ped-card-banner { border-radius: 0; }
        }

        /* ── Modal de mapa ── */
        .map-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 200; animation: hsFadeIn 0.2s ease; }
        .map-sheet { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-card,#fff); border-radius: 20px 20px 0 0; z-index: 201; max-width: 480px; margin: 0 auto; max-height: 80vh; overflow-y: auto; animation: hsSlideUp 0.28s cubic-bezier(0.32,0.72,0,1); box-shadow: 0 -4px 32px rgba(0,0,0,0.15); }
        .map-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.7rem; border-radius: 12px; font-family: inherit; font-size: 0.88rem; font-weight: 700; text-decoration: none; }
        .map-btn--waze { background: #33CCFF; color: white; }
        .map-btn--maps { background: #ecf3ff; color: #4285f4; }
        .map-btn-close { width: 100%; padding: 0.85rem; background: var(--bg-subtle,#F7EEF1); color: var(--text-primary,#431524); border: none; border-radius: 50px; font-family: inherit; font-size: 0.95rem; font-weight: 700; cursor: pointer; }

        .fd-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 300; animation: hsFadeIn 0.2s ease; }
        .fd-drawer { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-card,#fff); border-radius: 20px 20px 0 0; z-index: 301; max-height: 85vh; display: flex; flex-direction: column; animation: hsSlideUp 0.28s cubic-bezier(0.32,0.72,0,1); box-shadow: 0 -4px 32px rgba(0,0,0,0.15); }
        @media (min-width: 768px) {
          .fd-drawer { top: 0; bottom: 0; left: auto; right: 0; width: 320px; border-radius: 0; max-height: 100vh; animation: hsSlideRight 0.28s cubic-bezier(0.32,0.72,0,1); box-shadow: -4px 0 32px rgba(0,0,0,0.15); }
          .fd-handle { display: none; }
          .fd-datas { flex-direction: column; gap: 8px; }
          .fd-data-field { width: 100%; }
          .fd-data-input { width: 100%; box-sizing: border-box; }
        }
        @keyframes hsSlideRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .fd-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--border,#ECC2D0); margin: 10px auto 0; flex-shrink: 0; }
        .fd-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px 10px; border-bottom: 1px solid var(--border,#ECC2D0); flex-shrink: 0; }
        .fd-title { font-size: 1rem; font-weight: 700; color: var(--text-title,#431524); font-family: 'Geist',sans-serif; }
        .fd-limpar { background: none; border: none; font-size: 0.85rem; color: var(--primary,#986274); font-weight: 600; cursor: pointer; font-family: 'Geist',sans-serif; }
        .fd-body { overflow-y: auto; flex: 1; padding: 16px; }
        .fd-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted,#C39EAA); margin: 0 0 10px; font-family: 'Geist',sans-serif; }
        .fd-status-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .fd-status-btn { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; border: 1.5px solid var(--border,#ECC2D0); background: var(--bg-body,#FAFAFA); font-size: 0.82rem; font-weight: 500; color: var(--text-secondary,#6E3548); cursor: pointer; font-family: 'Geist',sans-serif; transition: all 0.15s; }
        .fd-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .fd-periodo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .fd-periodo-btn { padding: 10px; border-radius: 8px; border: 1.5px solid var(--border,#ECC2D0); background: var(--bg-body,#FAFAFA); font-size: 0.85rem; font-weight: 500; color: var(--text-secondary,#6E3548); cursor: pointer; font-family: 'Geist',sans-serif; transition: all 0.15s; text-align: center; }
        .fd-periodo-btn--on { border-color: var(--primary,#986274); background: var(--primary-light,#F7EEF1); color: var(--primary,#986274); font-weight: 700; }
        .fd-datas { display: flex; gap: 10px; margin-top: 12px; }
        .fd-data-field { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .fd-data-label { font-size: 0.72rem; font-weight: 600; color: var(--text-secondary,#6E3548); font-family: 'Geist',sans-serif; }
        .fd-data-input { border: 1.5px solid var(--border,#ECC2D0); border-radius: 8px; padding: 0.55rem 0.75rem; font-size: 0.85rem; font-family: 'Geist',sans-serif; color: var(--text-primary,#431524); background: var(--bg-input,#fff); outline: none; width: 100%; box-sizing: border-box; }
        .fd-data-input:focus { border-color: var(--primary,#986274); }
        .fd-footer { padding: 12px 16px 28px; flex-shrink: 0; border-top: 1px solid var(--border,#ECC2D0); }
        .fd-aplicar { width: 100%; padding: 14px; background: var(--primary,#986274); color: white; border: none; border-radius: 12px; font-size: 0.95rem; font-weight: 600; font-family: 'Geist',sans-serif; cursor: pointer; }
      `}</style>
    </div>
  )
}

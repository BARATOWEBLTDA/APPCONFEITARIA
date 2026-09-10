// v2: excluir pedido + modal 3 secoes + imagem_url
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/hooks/use-mobile'
import { ClipboardText, CurrencyDollar, CheckCircle, Cake } from '@phosphor-icons/react'
import BtnNovo from '@/components/BtnNovo'

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
  { key: 'confirmado',  label: 'Confirmado',           color: '#0e7490', bg: '#cffafe', dot: '#0891b2' },
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
const STATUS_PADRAO = ['novo', 'confirmado', 'em_producao', 'pronto', 'a_caminho', 'concluido']

// ── Status simplificado, só pra exibição na lista ──────────────────────────────
const STATUS_GROUPS = [
  { key: 'novo',        label: 'Novo',        color: '#534AB7', bg: '#EEEDFE', dot: '#7F77DD' },
  { key: 'confirmado',  label: 'Confirmado',  color: '#0e7490', bg: '#cffafe', dot: '#0891b2' },
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
  if (s === 'confirmado') return 'confirmado'
  return 'novo' // novo, pendente
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <p style={{ fontFamily: 'inherit', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>{endereco}</p>
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
  const dataCor = atrasado ? '#dc2626' : dias === 0 ? '#d97706' : 'var(--text-secondary)'

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

  // ── Desktop: retorna <tr> direto, sem wrapper div ──
  if (!isMobile) {
    return (
      <tr className="ped-dt-row" onClick={() => onVerPedido(p)}>
        <td className="ped-td">
          <span className="ped-dt-num">#{p.numero || '—'}</span>
          <span className="ped-dt-criado">{p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' }) + ' · ' + new Date(p.created_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : ''}</span>
          {p.origem === 'cardapio' && <span className="ped-dt-origem-tag">Cardápio</span>}
        </td>
        <td className="ped-td">
          <span className="ped-dt-cliente-nome">{p.cliente_nome || 'Não informado'}</span>
          {p.cliente_telefone && <span className="ped-dt-cliente-tel">{p.cliente_telefone}</span>}
        </td>
        <td className="ped-td">
          {primeiroItem ? (
            <div className="ped-dt-produto-row">
              <div className="ped-dt-produto-img">
                {(primeiroItem.imagem_url || primeiroItem.produtos?.imagem_url)
                  ? <img src={primeiroItem.imagem_url || primeiroItem.produtos?.imagem_url || ''} alt={primeiroItem.nome_produto} />
                  : <span>🎂</span>}
              </div>
              <div>
                <p className="ped-dt-produto-nome">{primeiroItem.nome_produto}{outrosItens > 0 && <span className="ped-card-mais-itens"> +{outrosItens}</span>}</p>
                <p className="ped-dt-produto-qtd">{formatItemQuantidade(primeiroItem.quantidade, primeiroItem.produtos?.forma_venda)}</p>
              </div>
            </div>
          ) : <span className="ped-dt-vazio">—</span>}
        </td>
        <td className="ped-td">
          {dataLabel && <p className="ped-dt-data" style={{ color: dataCor }}>{dataLabel}{p.horario_entrega ? ` · ${p.horario_entrega.slice(0,5)}` : ''}</p>}
          <p className="ped-dt-tipo">{p.tipo_entrega === 'retirada' ? 'Retirada' : 'Entrega'}</p>
        </td>
        <td className="ped-td">
          {p.origem === 'cardapio' && p.status === 'novo' ? (
            <span className="ped-card-status plist-tag--aprovar">
              <span className="plist-tag-pulse" />
              Aguardando aprovação
            </span>
          ) : (
            <span className="ped-card-status" style={{ color: grupo.color, background: grupo.bg }}>
              <span className="ped-card-status-dot" style={{ background: grupo.dot }} />
              {grupo.label}
            </span>
          )}
        </td>
        <td className="ped-td">
          <p className="ped-dt-valor">{formatMoney(p.valor_total)}</p>
          <p className="ped-dt-pag" style={{ color: pagamentoCor }}>{pagamentoLabel}</p>
        </td>
        <td className="ped-td">
          <button type="button" className="ped-dt-ver-btn" onClick={e => { e.stopPropagation(); onVerPedido(p) }}>Ver detalhes</button>
        </td>
      </tr>
    )
  }

  // ── Mobile: lista minimalista (formato mensagens) ──

  // Data relativa curta pra mostrar no canto: "14:32" (hoje), "Ontem", "Seg", "05/09"
  const dataCurta = (() => {
    if (!p.created_at) return ''
    const d = new Date(p.created_at)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const dPuro = new Date(d); dPuro.setHours(0, 0, 0, 0)
    const diffDias = Math.round((hoje.getTime() - dPuro.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDias === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    if (diffDias === 1) return 'Ontem'
    if (diffDias < 7) return ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()]
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  })()

  const totalItens = itens.length
  const nomeProdutoResumo = primeiroItem
    ? `${primeiroItem.nome_produto}${outrosItens > 0 ? ` + ${outrosItens} item${outrosItens > 1 ? 's' : ''}` : ''}`
    : 'Sem produtos'

  return (
    <div className="plist-item" onClick={() => onVerPedido(p)}>
      <div className="plist-img">
        {(primeiroItem?.imagem_url || primeiroItem?.produtos?.imagem_url)
          ? <img src={primeiroItem.imagem_url || primeiroItem.produtos?.imagem_url || ''} alt={primeiroItem.nome_produto} />
          : <span className="plist-img-emoji">🎂</span>}
        {totalItens > 1 && <span className="plist-img-badge">{totalItens}</span>}
      </div>

      <div className="plist-info">
        <div className="plist-row-top">
          <p className="plist-cliente">{p.cliente_nome || 'Não informado'}</p>
          <span className="plist-time">{dataCurta}</span>
        </div>

        <div className="plist-row-mid">
          <p className="plist-produto">{nomeProdutoResumo}</p>
          <span className="plist-valor">{formatMoney(p.valor_total)}</span>
        </div>

        <div className="plist-tags">
          {p.origem === 'cardapio' && p.status === 'novo' && (
            <span className="plist-tag plist-tag--aprovar">
              <span className="plist-tag-pulse" />
              Aguardando aprovação
            </span>
          )}
          {!(p.origem === 'cardapio' && p.status === 'novo') && (
            <span className="plist-tag" style={{ color: grupo.color, background: grupo.bg }}>
              <span className="plist-tag-dot" style={{ background: grupo.dot }} />
              {grupo.label}
            </span>
          )}
          <span
            className="plist-tag"
            style={{
              color: pagamentoCor,
              background: p.status_pagamento === 'pago' ? '#DCFCE7' : p.status_pagamento === 'parcial' ? '#FEF3C7' : '#FEE2E2'
            }}
          >
            {p.status_pagamento === 'pago' ? 'Pago' : p.status_pagamento === 'parcial' ? 'Parcial' : 'Pendente'}
          </span>
          {atrasado && <span className="plist-tag plist-tag--atrasado">Atrasado</span>}
          {!atrasado && dias === 0 && (
            <span className="plist-tag plist-tag--hoje">
              Hoje{p.horario_entrega ? ` ${p.horario_entrega.slice(0, 5)}` : ''}
            </span>
          )}
          {!atrasado && dias === 1 && <span className="plist-tag plist-tag--amanha">Amanhã</span>}
          {p.tipo_entrega === 'entrega' && temEndereco && <span className="plist-tag plist-tag--neutral">🛵 Entrega</span>}
        </div>
      </div>
    </div>
  )
}

// ── Modal de detalhes do pedido ──────────────────────────────────────────────
function ModalPedido({ p, onClose, onEditar, onExcluir, onAprovar }: { p: Pedido; onClose: () => void; onEditar: () => void; onExcluir: () => void; onAprovar: () => void }) {
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const grupo = STATUS_GROUP_CONFIG[getStatusGroup(p.status)]
  const itens = p.pedido_itens || []
  const valorPendente = Math.max(0, (p.valor_total || 0) - (p.valor_recebido || 0))
  const pagamentoCor = p.status_pagamento === 'pago' ? '#16a34a' : p.status_pagamento === 'parcial' ? '#d97706' : '#dc2626'
  const pagamentoLabel = p.status_pagamento === 'pago'
    ? `${PAG_CONFIG[p.forma_pagamento] || 'PIX'} · Pago`
    : `${PAG_CONFIG[p.forma_pagamento] || 'PIX'} · ${p.status_pagamento === 'parcial' ? 'Parcial' : 'Pendente'}${valorPendente > 0 ? ` · ${formatMoney(valorPendente)}` : ''}`

  // Pedido do cardápio ainda não aprovado — precisa da ação da confeiteira
  const aguardandoAprovacao = p.origem === 'cardapio' && p.status === 'novo'

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

        {/* Banner de aprovação — cola no topo do modal quando aplicável */}
        {aguardandoAprovacao ? (
          <div className="mp-banner-aprovar">
            <div className="mp-handle mp-handle--sobre-banner" />
            <div className="mp-banner-content">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div>
                <p className="mp-banner-title">Pedido aguardando sua aprovação</p>
                <p className="mp-banner-sub">Este pedido veio do cardápio digital. Confira os detalhes e aprove pra iniciar a produção.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mp-handle" />
        )}

        {/* Header fixo */}
        <div className="mp-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mp-numero">Pedido #{p.numero || '—'}</span>
              <span className="ped-card-status" style={{ color: grupo.color, background: grupo.bg }}>
                <span className="ped-card-status-dot" style={{ background: grupo.dot }} />
                {grupo.label}
              </span>
            </div>
            <p className="mp-criado">
              {p.created_at && (
                <>
                  {new Date(p.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' })}
                  {' · '}
                  {new Date(p.created_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}
                </>
              )}
              {p.origem === 'cardapio' && <> · via Cardápio</>}
            </p>
          </div>
          <button className="mp-fechar" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body com scroll */}
        <div className="mp-body">

          {/* Cliente */}
          <div className="mp-grupo">
            <p className="mp-grupo-titulo">Cliente</p>
            <p className="mp-grupo-val">{p.cliente_nome || '—'}</p>
            {p.cliente_telefone && <p className="mp-grupo-sub">{p.cliente_telefone}</p>}
          </div>

          {/* Entrega */}
          <div className="mp-grupo">
            <p className="mp-grupo-titulo">{p.tipo_entrega === 'retirada' ? 'Retirada' : 'Entrega'}</p>
            {p.data_entrega && <p className="mp-grupo-val">{formatDate(p.data_entrega)}{p.horario_entrega ? ` às ${p.horario_entrega.slice(0,5)}` : ''}</p>}
            {enderecoCompleto && <p className="mp-grupo-sub">{enderecoCompleto}</p>}
          </div>

          {/* Produtos */}
          {itens.length > 0 && (
            <div className="mp-grupo">
              <p className="mp-grupo-titulo">Produtos ({itens.length})</p>
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
            </div>
          )}

          {/* Pagamento + Total */}
          <div className="mp-resumo">
            <div className="mp-resumo-row">
              <span className="mp-resumo-label">Pagamento</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="mp-resumo-val">{PAG_CONFIG[p.forma_pagamento] || 'PIX'}</span>
                <span className="ped-card-status" style={{ color: pagamentoCor, background: p.status_pagamento === 'pago' ? '#dcfce7' : p.status_pagamento === 'parcial' ? '#FAEEDA' : '#fee2e2', fontSize: '0.68rem', padding: '2px 8px' }}>
                  {p.status_pagamento === 'pago' ? 'Pago' : p.status_pagamento === 'parcial' ? 'Parcial' : 'Pendente'}
                </span>
              </div>
            </div>
            <div className="mp-resumo-row mp-resumo-total">
              <span className="mp-resumo-label-total">Total</span>
              <span className="mp-resumo-val-total">{formatMoney(p.valor_total)}</span>
            </div>
          </div>

        </div>

        {/* Footer fixo com botões */}
        <div className="mp-footer">
          {!confirmExcluir ? (
            <>
              {aguardandoAprovacao && (
                <button className="mp-btn-aprovar" onClick={onAprovar}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Aprovar pedido
                </button>
              )}
              <button className={aguardandoAprovacao ? "mp-btn-editar mp-btn-editar--secondary" : "mp-btn-editar"} onClick={onEditar}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                {aguardandoAprovacao ? 'Editar' : 'Editar pedido'}
              </button>
              <button className="mp-btn-excluir" onClick={() => setConfirmExcluir(true)} title="Excluir pedido">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
              </button>
            </>
          ) : (
            <div className="mp-confirm-excluir">
              <p>Excluir este pedido? Esta ação não pode ser desfeita.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="mp-btn-cancel" onClick={() => setConfirmExcluir(false)}>Cancelar</button>
                <button className="mp-btn-confirmar-excluir" onClick={onExcluir}>Sim, excluir</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Drawer de Filtros ────────────────────────────────────────────────────────
function FiltroDrawer({ statusSelecionados, setStatusSelecionados, periodoFiltro, setPeriodoFiltro, dataInicio, setDataInicio, dataFim, setDataFim, onClose, pedidos }: {
  statusSelecionados: string[]
  setStatusSelecionados: (v: string[]) => void
  periodoFiltro: string
  setPeriodoFiltro: (v: string) => void
  dataInicio: string
  setDataInicio: (v: string) => void
  dataFim: string
  setDataFim: (v: string) => void
  onClose: () => void
  pedidos: Pedido[]
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

  // Contadores por status (só considera o filtro de status pra dar sensação viva)
  const countByStatus = TODOS_STATUS.reduce((acc, s) => {
    acc[s.key] = pedidos.filter(p => p.status === s.key).length
    return acc
  }, {} as Record<string, number>)

  // Preview: quantos pedidos vão aparecer com os filtros selecionados
  const previewCount = pedidos.filter(p => {
    if (!localStatus.includes(p.status)) return false
    if (localPeriodo === 'todos') return true
    if (!p.data_entrega) return localPeriodo === 'todos'
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const data = parseLocalDate(p.data_entrega)
    if (localPeriodo === 'hoje') return data.getTime() === hoje.getTime()
    if (localPeriodo === 'semana') {
      const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - hoje.getDay())
      const fimSemana = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate() + 6)
      return data >= inicioSemana && data <= fimSemana
    }
    if (localPeriodo === 'mes') return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear()
    if (localPeriodo === 'personalizado') {
      if (localInicio && data < parseLocalDate(localInicio)) return false
      if (localFim && data > parseLocalDate(localFim)) return false
      return true
    }
    return true
  }).length

  return (
    <>
      <div className="fd-overlay" onClick={onClose} />
      <div className="fd-drawer">
        <div className="fd-handle" />
        <div className="fd-header">
          <span className="fd-title">Filtros</span>
          <button className="fd-limpar" onClick={limpar}>Restaurar padrão</button>
        </div>
        <div className="fd-body">

          {/* Preview do resultado — feedback vivo */}
          <div className="fd-preview">
            <div>
              <p className="fd-preview-lbl">Resultado</p>
              <p className="fd-preview-txt">
                <span className="fd-preview-num">{previewCount}</span>
                <span className="fd-preview-unit"> {previewCount === 1 ? 'pedido' : 'pedidos'}</span>
              </p>
            </div>
            <span className="fd-preview-hint">com os filtros abaixo</span>
          </div>

          {/* Card Status */}
          <div className="fd-card">
            <div className="fd-card-head">
              <p className="fd-card-title">Status</p>
              <span className="fd-card-count">{localStatus.length}/{TODOS_STATUS.length}</span>
            </div>
            <div className="fd-card-body">
              {TODOS_STATUS.map(s => {
                const on = localStatus.includes(s.key)
                const cnt = countByStatus[s.key] || 0
                return (
                  <button
                    key={s.key}
                    className={`fd-status-row${on ? ' fd-status-row--on' : ''}`}
                    onClick={() => toggleStatus(s.key)}
                    type="button"
                  >
                    <span className={`fd-check${on ? ' fd-check--on' : ''}`}>
                      {on && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </span>
                    <span className="fd-status-dot" style={{ background: s.dot }} />
                    <span className="fd-status-lbl">{s.label}</span>
                    <span className="fd-status-cnt">{cnt}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Card Período */}
          <div className="fd-card">
            <div className="fd-card-head">
              <p className="fd-card-title">Período de entrega</p>
            </div>
            <div className="fd-segments">
              {[
                { key: 'todos',        label: 'Todos' },
                { key: 'hoje',         label: 'Hoje' },
                { key: 'semana',       label: 'Semana' },
                { key: 'mes',          label: 'Mês' },
                { key: 'personalizado', label: 'Custom' },
              ].map(p => (
                <button
                  key={p.key}
                  type="button"
                  className={`fd-segment${localPeriodo === p.key ? ' fd-segment--on' : ''}`}
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
  const location = useLocation()
  const isMobile = useIsMobile()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Filtro especial "aguardando aprovação" — ativado via ?filtro=aguardando (vindo do Início)
  const params = new URLSearchParams(location.search)
  const [filtroAguardando, setFiltroAguardando] = useState(params.get('filtro') === 'aguardando')

  const [busca, setBusca] = useState('')
  const [showFiltro, setShowFiltro] = useState(false)
  const [statusSelecionados, setStatusSelecionados] = useState<string[]>(STATUS_PADRAO)
  const [periodoFiltro, setPeriodoFiltro] = useState('todos')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [mapaAberto, setMapaAberto] = useState<string | null>(null)
  const [modalPedido, setModalPedido] = useState<Pedido | null>(null)
  const [totalProdutos, setTotalProdutos] = useState<number | null>(null)
  const [modalSemProdutos, setModalSemProdutos] = useState(false)

  const handleNovoPedido = () => {
    if (totalProdutos === 0) {
      setModalSemProdutos(true)
      return
    }
    navigate('/pedidos/novo')
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      fetchPedidos(user.id)
      supabase.from('produtos').select('id', { count: 'exact', head: true }).eq('user_id', user.id).then(({ count }) => {
        setTotalProdutos(count ?? 0)
      })
    })
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

  // Aprova pedido vindo do cardápio público (muda status de 'novo' → 'confirmado')
  const aprovarPedido = async (id: string) => {
    const { error } = await supabase
      .from('pedidos')
      .update({ status: 'confirmado' })
      .eq('id', id)
    if (error) { console.error('Erro ao aprovar pedido:', error); return }
    // Grava no histórico
    if (userId) {
      await supabase.from('pedido_historico').insert({
        pedido_id: id,
        user_id: userId,
        evento: 'Pedido aprovado',
        descricao: 'Pedido do cardápio digital aprovado pela confeiteira',
      })
    }
    // Atualiza estado local (sem refetch)
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, status: 'confirmado' } : p))
    setModalPedido(prev => prev && prev.id === id ? { ...prev, status: 'confirmado' } : prev)
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
    // Filtro rápido "Aguardando aprovação" — vem do alerta no Início
    if (filtroAguardando) {
      return p.origem === 'cardapio' && p.status === 'novo'
    }
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
    <>
    {loading ? (
      <div style={{ minHeight: "calc(100vh - 5rem)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ width: 32, height: 32, border: "3px solid var(--primary-light)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    ) : (totalProdutos === 0 || pedidos.length === 0) ? (
      <div className="ped-hero-wrap">
        {totalProdutos === 0 ? (
          /* CENÁRIO 1: sem produtos — hero split simples (bloqueando) */
          <div className="ped-hero-split">
            <div className="ped-hero-left">
              <span className="ped-hero-eyebrow">⚠️ CADASTRE PRIMEIRO</span>
              <h1 className="ped-hero-title">Antes precisamos<br/>de produtos</h1>
              <p className="ped-hero-desc">
                Pra registrar pedidos, você precisa ter produtos cadastrados.
                Vamos começar pelo seu catálogo?
              </p>
              <div className="ped-hero-actions">
                <button className="ped-hero-btn-primary" onClick={() => navigate('/produtos')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                  CADASTRAR PRODUTO
                </button>
              </div>
              <div className="ped-hero-tip">
                <div className="ped-hero-tip-icon">💡</div>
                <div>
                  <p className="ped-hero-tip-t">Dica: comece pelos mais vendidos</p>
                  <p className="ped-hero-tip-d">Cadastre 3-5 produtos principais primeiro. Depois volta aqui pra registrar pedidos.</p>
                </div>
              </div>
            </div>
            <aside className="ped-hero-right" aria-label="Vídeo tutorial">
              <div className="ped-hero-video-thumb">
                <button
                  type="button"
                  className="ped-hero-video-play"
                  onClick={() => alert("🎬 Vídeo em produção! Em breve disponível.")}
                  aria-label="Assistir tutorial"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
              </div>
              <div className="ped-hero-video-footer">
                <span className="ped-hero-video-t">🎬 Como funciona</span>
                <span className="ped-hero-video-badge">EM BREVE</span>
              </div>
            </aside>
          </div>
        ) : (
          /* CENÁRIO 2: tem produtos mas sem pedidos — 3 cards educativos */
          <div className="ped-hero-3cards">
            <div className="ped-hero-3cards-head">
              <span className="ped-hero-eyebrow">📋 SEUS PEDIDOS</span>
              <h1 className="ped-hero-title">Comece a receber<br/>seus pedidos</h1>
              <p className="ped-hero-desc">
                Existem 2 formas de receber pedidos no Doonly.
                Escolha por onde começar:
              </p>
            </div>

            <div className="ped-cards-grid">
              {/* Card 1: manual (primary rosa) */}
              <button className="ped-card ped-card--primary" onClick={handleNovoPedido}>
                <div className="ped-card-icon">✍️</div>
                <div className="ped-card-t">Cadastrar manualmente</div>
                <div className="ped-card-d">Cliente ligou ou mandou WhatsApp? Registre o pedido aqui em 30 segundos.</div>
                <div className="ped-card-cta">Começar agora →</div>
              </button>

              {/* Card 2: compartilhar cardápio */}
              <button className="ped-card" onClick={() => navigate('/cardapio-config')}>
                <div className="ped-card-icon">🔗</div>
                <div className="ped-card-t">Compartilhar cardápio</div>
                <div className="ped-card-d">Envie o link do seu cardápio digital e receba pedidos automaticamente pelo WhatsApp.</div>
                <div className="ped-card-cta ped-card-cta--pink">Ver meu link →</div>
              </button>

              {/* Card 3: tutorial */}
              <button className="ped-card" onClick={() => alert("🎬 Vídeo em produção! Em breve disponível.")}>
                <div className="ped-card-icon">🎬</div>
                <div className="ped-card-t">Ver tutorial</div>
                <div className="ped-card-d">Aprenda em 2 minutos como o sistema de pedidos funciona de ponta a ponta.</div>
                <div className="ped-card-cta ped-card-cta--pink">Assistir →</div>
              </button>
            </div>

            <div className="ped-hero-tip ped-hero-tip--center">
              <div className="ped-hero-tip-icon">💡</div>
              <div>
                <p className="ped-hero-tip-t">Confeitarias que divulgam o cardápio 3x/semana recebem 5x mais pedidos</p>
                <p className="ped-hero-tip-d">Poste o link em stories, status do WhatsApp e Instagram.</p>
              </div>
            </div>
          </div>
        )}

        <style>{`
          .ped-hero-wrap {
            min-height: calc(100vh - 5rem);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: var(--space-4);
            font-family: var(--font-base);
          }
          /* ═══ HERO SPLIT (cenário 1: sem produtos) ═══ */
          .ped-hero-split {
            display: flex;
            flex-direction: column;
            gap: var(--space-4);
            width: 100%;
          }
          .ped-hero-left {
            display: flex; flex-direction: column;
            gap: var(--space-3);
            order: 2;
            text-align: center;
            align-items: center;
          }
          .ped-hero-right {
            display: flex; flex-direction: column;
            background: linear-gradient(135deg, var(--accent), #4A3038);
            border-radius: var(--radius-lg);
            padding: var(--space-2);
            box-shadow: 0 10px 30px rgba(45, 31, 38, 0.2);
            order: 1;
          }
          .ped-hero-video-thumb {
            aspect-ratio: 16/10;
          max-height: 200px;
            background: linear-gradient(135deg, var(--primary), #7C3AED);
            border-radius: var(--radius-md);
            display: flex; align-items: center; justify-content: center;
            position: relative; overflow: hidden;
          }
          .ped-hero-video-thumb::before {
            content: ""; position: absolute; inset: 0;
            background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.2) 100%);
          }
          .ped-hero-video-play {
            width: 50px; height: 50px;
            border-radius: var(--radius-full);
            background: rgba(255,255,255,0.95); border: none;
            display: flex; align-items: center; justify-content: center;
            color: var(--primary); cursor: pointer;
            box-shadow: 0 6px 24px rgba(0,0,0,0.35);
            transition: transform var(--dur-fast) var(--ease-out);
            position: relative; z-index: 2;
          }
          .ped-hero-video-play:hover { transform: scale(1.08); }
          .ped-hero-video-play svg { margin-left: 3px; }
          .ped-hero-video-footer {
            display: flex; justify-content: space-between; align-items: center;
            padding: var(--space-3) var(--space-2) var(--space-1);
            color: var(--text-inverse);
          }
          .ped-hero-video-t { font-size: var(--text-sm); font-weight: var(--fw-bold); }
          .ped-hero-video-badge {
            background: var(--primary); color: var(--text-inverse);
            padding: var(--space-1) var(--space-2);
            border-radius: var(--radius-full);
            font-size: 0.625rem; font-weight: var(--fw-black);
            letter-spacing: 0.08em;
          }

          /* ═══ 3 CARDS (cenário 2: sem pedidos) ═══ */
          .ped-hero-3cards {
            display: flex; flex-direction: column;
            gap: var(--space-5);
            width: 100%;
            max-width: 900px;
          }
          .ped-hero-3cards-head {
            text-align: center;
            display: flex; flex-direction: column;
            gap: var(--space-2);
            align-items: center;
          }
          .ped-cards-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: var(--space-3);
          }
          .ped-card {
            display: flex; flex-direction: column;
            gap: var(--space-2);
            background: var(--bg-card);
            border: 1.5px solid var(--border);
            border-radius: var(--radius-lg);
            padding: var(--space-4);
            text-align: left;
            cursor: pointer;
            font-family: var(--font-base);
            transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
          }
          .ped-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.08);
            border-color: var(--primary-light);
          }
          .ped-card--primary {
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            color: var(--text-inverse);
            border: none;
            box-shadow: 0 6px 0 var(--primary-dark);
          }
          .ped-card--primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 0 var(--primary-dark);
          }
          .ped-card--primary:active {
            transform: translateY(4px);
            box-shadow: 0 0 0 var(--primary-dark);
          }
          .ped-card-icon {
            width: 44px; height: 44px;
            border-radius: var(--radius-md);
            background: var(--primary-light);
            display: flex; align-items: center; justify-content: center;
            font-size: 22px;
            flex-shrink: 0;
          }
          .ped-card--primary .ped-card-icon { background: rgba(255,255,255,0.25); }
          .ped-card-t {
            font-size: var(--text-md);
            font-weight: var(--fw-black);
            color: var(--text-title);
            letter-spacing: -0.01em;
          }
          .ped-card--primary .ped-card-t { color: var(--text-inverse); }
          .ped-card-d {
            font-size: var(--text-sm);
            color: var(--text-secondary);
            line-height: 1.5;
            flex: 1;
          }
          .ped-card--primary .ped-card-d { color: rgba(255,255,255,0.9); }
          .ped-card-cta {
            font-size: var(--text-sm);
            font-weight: var(--fw-black);
            color: var(--text-inverse);
            margin-top: var(--space-1);
          }
          .ped-card-cta--pink { color: var(--primary); }

          /* ═══ Comum: eyebrow / título / desc / botões / dica ═══ */
          .ped-hero-eyebrow {
            font-size: var(--text-sm); font-weight: var(--fw-black);
            color: var(--primary);
            text-transform: uppercase; letter-spacing: 0.1em;
            line-height: 1;
          }
          .ped-hero-title {
            font-size: 2rem;
            font-weight: var(--fw-black);
            letter-spacing: -0.03em; line-height: 1.15;
            color: var(--text-title);
            margin: var(--space-1) 0 0;
          }
          .ped-hero-desc {
            font-size: var(--text-md);
            color: var(--text-secondary);
            line-height: 1.55;
            margin: var(--space-2) 0 0;
            max-width: 480px;
          }
          .ped-hero-actions {
            display: flex; gap: var(--space-2); flex-wrap: wrap;
            margin-top: var(--space-3);
            justify-content: center;
          }
          .ped-hero-btn-primary {
            display: inline-flex; align-items: center;
            gap: var(--space-2);
            background: var(--primary); color: var(--text-inverse);
            border: none;
            padding: var(--space-4) var(--space-6);
            border-radius: var(--radius-md);
            font-size: var(--text-md); font-weight: var(--fw-black);
            cursor: pointer;
            font-family: var(--font-base) !important;
            letter-spacing: 0.03em; text-transform: uppercase;
            box-shadow: 0 4px 0 var(--primary-dark);
            transition: transform 0.08s ease, box-shadow 0.08s ease;
          }
          .ped-hero-btn-primary:hover { filter: brightness(1.05); }
          .ped-hero-btn-primary:active {
            transform: translateY(4px);
            box-shadow: 0 0 0 var(--primary-dark);
          }
          .ped-hero-tip {
            display: flex; gap: var(--space-3);
            background: var(--primary-light);
            padding: var(--space-3) var(--space-4);
            border-radius: var(--radius-md);
            align-items: flex-start;
            margin-top: var(--space-4);
            text-align: left;
            max-width: 480px;
          }
          .ped-hero-tip--center { max-width: 640px; margin: 0 auto; }
          .ped-hero-tip-icon { font-size: var(--text-xl); line-height: 1; flex-shrink: 0; }
          .ped-hero-tip-t {
            font-size: var(--text-sm); font-weight: var(--fw-black);
            color: var(--text-title); margin: 0 0 var(--space-1);
          }
          .ped-hero-tip-d {
            font-size: var(--text-sm); color: var(--text-secondary);
            line-height: 1.5; margin: 0;
          }

          /* ═══ Desktop ═══ */
          @media (min-width: 900px) {
            .ped-hero-split {
              flex-direction: row;
              align-items: center; justify-content: center;
              gap: var(--space-6);
            }
            .ped-hero-left {
              order: 1;
              gap: var(--space-4);
              flex: 1.3 1 440px;
              max-width: 560px; min-width: 0;
              text-align: left; align-items: flex-start;
            }
            .ped-hero-right {
              order: 2;
              padding: var(--space-2);
              flex: 1 1 340px;
              max-width: 460px; min-width: 0;
            }
            .ped-hero-eyebrow { font-size: var(--text-sm); }
            .ped-hero-title { font-size: 2.5rem; line-height: 1.05; }
            .ped-hero-desc { font-size: var(--text-lg); }
            .ped-hero-tip-t { font-size: var(--text-sm); }
            .ped-hero-tip-d { font-size: var(--text-sm); }
            .ped-hero-btn-primary { padding: var(--space-4) var(--space-6); font-size: var(--text-md); }
            .ped-hero-actions { justify-content: flex-start; }
            .ped-hero-video-play { width: 60px; height: 60px; }
            .ped-hero-video-play svg { width: 28px; height: 28px; }
            .ped-hero-video-t { font-size: var(--text-sm); }
            /* 3 cards em grid horizontal no desktop */
            .ped-cards-grid { grid-template-columns: repeat(3, 1fr); }
            .ped-card-t { font-size: var(--text-lg); }
          }
        `}</style>
      </div>
    ) : (
    <div style={{ fontFamily: "'Geist', sans-serif", display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1.25rem 1rem 6rem' }}>

      {/* ── Header com padding mobile ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', paddingTop: isMobile ? '1.25rem' : 0 }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-black)', color: 'var(--text-title)', margin: 0, letterSpacing: '-0.02em' }}>Pedidos</h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.1rem 0 0' }}>
            {pedidosFiltrados.length} pedido{pedidosFiltrados.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {/* Botão filtro */}
          <button
            onClick={() => setShowFiltro(true)}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${filtrosAtivos ? 'var(--primary)' : 'var(--border)'}`, background: filtrosAtivos ? 'var(--primary-light)' : 'var(--bg-card)', cursor: 'pointer', color: filtrosAtivos ? 'var(--primary)' : 'var(--text-secondary)', flexShrink: 0 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            {filtrosAtivos && <span style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)', border: '2px solid white' }} />}
          </button>

          {/* Novo pedido */}
          <BtnNovo label="Registrar pedido" onClick={handleNovoPedido} />
        </div>
      </div>

      {(
        <>
          {/* Busca */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '0.6rem 0.9rem' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--text-primary)', background: 'transparent' }}
              placeholder="Buscar por cliente ou número..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
            {busca && (
              <button onClick={() => setBusca('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>

          {/* Chip de filtro ativo "Aguardando aprovação" — vindo do alerta do Início */}
          {filtroAguardando && (
            <div className="ped-filtro-ativo-chip">
              <div className="ped-filtro-ativo-info">
                <span className="ped-filtro-ativo-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </span>
                <div>
                  <p className="ped-filtro-ativo-title">Aguardando aprovação</p>
                  <p className="ped-filtro-ativo-sub">Mostrando só pedidos do cardápio que precisam ser aprovados</p>
                </div>
              </div>
              <button
                className="ped-filtro-ativo-close"
                onClick={() => { setFiltroAguardando(false); navigate('/pedidos', { replace: true }) }}
                aria-label="Ver todos os pedidos"
              >
                Ver todos
              </button>
            </div>
          )}

          {/* Cards de métricas — só desktop */}
          {!isMobile && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
              {[
                { label: 'Total de pedidos', value: pedidos.length, sub: 'Todos os registros', bg: '#EEEDFE', icon: <ClipboardText size={22} weight="duotone" color="#534AB7" /> },
                { label: 'Faturamento', value: pedidos.reduce((acc, p) => acc + (p.valor_total || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), sub: 'Valor total', bg: '#E1F5EE', icon: <CurrencyDollar size={22} weight="duotone" color="#0F6E56" /> },
                { label: 'Concluídos', value: pedidos.filter(p => ['concluido','entregue'].includes(p.status)).length, sub: 'Pedidos finalizados', bg: '#dcfce7', icon: <CheckCircle size={22} weight="duotone" color="#14532d" /> },
                { label: 'Em produção', value: pedidos.filter(p => p.status === 'em_producao').length, sub: 'No momento', bg: '#FAEEDA', icon: <Cake size={22} weight="duotone" color="#854F0B" /> },
              ].map((card, i) => (
                <div key={i} style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {card.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px' }}>{card.label}</p>
                    <p style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-title)', margin: 0, letterSpacing: '-0.02em' }}>{card.value}</p>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '1px 0 0' }}>{card.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lista */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
              <div style={{ width: 32, height: 32, border: '3px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'pedSpin 0.7s linear infinite' }} />
            </div>
          ) : pedidosFiltrados.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 1rem', gap: '0.5rem' }}>
              <div style={{ width: 64, height: 64, background: 'var(--primary-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-title)', margin: 0 }}>
                {busca || filtrosAtivos ? 'Nenhum pedido encontrado' : 'Nenhum pedido ainda'}
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                {busca || filtrosAtivos ? 'Tente ajustar os filtros' : 'Registre seu primeiro pedido'}
              </p>
              {!filtrosAtivos && !busca && (
                <button onClick={handleNovoPedido} style={{ marginTop: '0.5rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 10, padding: '0.6rem 1.25rem', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                  Registrar primeiro pedido
                </button>
              )}
            </div>
          ) : (
            <div className={!isMobile ? 'ped-dt-wrapper' : ''} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {!isMobile ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                  <thead>
                    <tr style={{ background: 'var(--text-title)' }}>
                      <th className="ped-th">Pedido</th>
                      <th className="ped-th">Cliente</th>
                      <th className="ped-th">Produto</th>
                      <th className="ped-th">Entrega</th>
                      <th className="ped-th">Status</th>
                      <th className="ped-th">Valor</th>
                      <th className="ped-th">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosFiltrados.map(p => (
                      <PedidoCard key={p.id} p={p} isMobile={false} onAbrirMapa={setMapaAberto} onVerPedido={setModalPedido} />
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="plist-container">
                  {pedidosFiltrados.map(p => (
                    <PedidoCard key={p.id} p={p} isMobile={true} onAbrirMapa={setMapaAberto} onVerPedido={setModalPedido} />
                  ))}
                </div>
              )}
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
          pedidos={pedidos}
        />
      )}

      {mapaAberto && <MapaModal endereco={mapaAberto} onClose={() => setMapaAberto(null)} />}
      {modalPedido && <ModalPedido p={modalPedido} onClose={() => setModalPedido(null)} onEditar={() => { setModalPedido(null); navigate(`/pedidos/${modalPedido.id}`) }} onExcluir={() => excluirPedido(modalPedido.id)} onAprovar={() => aprovarPedido(modalPedido.id)} />}

      {/* ── Modal: precisa cadastrar produtos primeiro ── */}
      {modalSemProdutos && (
        <>
          <div onClick={() => setModalSemProdutos(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            zIndex: 9998, animation: 'hsFadeIn 0.2s ease',
          }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 'min(380px, calc(100vw - 2rem))',
            background: 'white', borderRadius: 20,
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            zIndex: 9999, padding: '1.75rem 1.5rem 1.5rem',
            fontFamily: 'inherit', textAlign: 'center',
            animation: 'hsFadeIn 0.25s ease',
          }}>
            <button onClick={() => setModalSemProdutos(false)} style={{
              position: 'absolute', top: 12, right: 12, width: 32, height: 32,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', borderRadius: 8,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            {/* Ícone Doo */}
            <div style={{
              width: 88, height: 88, borderRadius: '28%', background: 'var(--text-title)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(61,26,36,0.25)',
            }}>
              <div style={{
                width: 74, height: 74, borderRadius: '28%', background: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                <img src="/Sistema/semprodutos.png" alt="Sem produtos" style={{
                  width: 96, height: 96, objectFit: 'cover', objectPosition: 'top center',
                }} />
              </div>
            </div>

            <h3 style={{
              fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-title)',
              margin: '0 0 8px', letterSpacing: '-0.02em',
            }}>
              Ainda não temos produtos!
            </h3>

            <p style={{
              fontSize: '0.9rem', color: 'var(--text-secondary)',
              margin: '0 0 1.5rem', lineHeight: 1.5,
            }}>
              Para registrar um pedido, primeiro precisamos cadastrar o que você vende. Vamos lá?
            </p>

            <button
              onClick={() => { setModalSemProdutos(false); navigate('/produtos', { state: { abrirCadastro: true } }) }}
              style={{
                width: '100%', background: 'var(--text-title)', color: 'white', border: 'none',
                borderRadius: 12, padding: '0.85rem', fontSize: '0.95rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 12px rgba(61,26,36,0.25)',
                marginBottom: 8,
              }}
            >
              Cadastrar meu primeiro produto
            </button>
            <button
              onClick={() => setModalSemProdutos(false)}
              style={{
                width: '100%', background: 'transparent', color: 'var(--text-muted)',
                border: 'none', padding: '0.5rem', fontSize: '0.82rem', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Agora não
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes pedSpin { to { transform: rotate(360deg); } }
        @keyframes hsFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes hsSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }

        /* ── Lista minimalista (mobile) — formato mensagens ── */
        .plist-container {
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          overflow: hidden;
          border: 1px solid var(--border);
          box-shadow: 0 2px 8px rgba(45, 31, 38, 0.04);
        }

        /* Chip de filtro ativo (aguardando aprovação) */
        .ped-filtro-ativo-chip {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 12px 14px;
          background: linear-gradient(135deg, var(--primary-light), #FFF8FA);
          border: 1.5px solid rgba(232, 90, 140, 0.25);
          border-radius: var(--radius-md);
        }
        .ped-filtro-ativo-info { display: flex; align-items: flex-start; gap: 10px; flex: 1; min-width: 0; }
        .ped-filtro-ativo-icon {
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--primary); color: #fff;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 0 0 0 rgba(232, 90, 140, 0.55);
          animation: aprovarPulse 2s ease-in-out infinite;
        }
        .ped-filtro-ativo-title {
          margin: 0;
          font-size: 13px;
          font-weight: 800;
          color: var(--text-title);
          letter-spacing: -0.01em;
        }
        .ped-filtro-ativo-sub {
          margin: 2px 0 0;
          font-size: 11px;
          color: var(--text-secondary);
          line-height: 1.4;
        }
        .ped-filtro-ativo-close {
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          color: var(--text-secondary);
          border-radius: 999px;
          padding: 6px 12px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
          transition: background var(--dur-fast), color var(--dur-fast);
        }
        .ped-filtro-ativo-close:hover { background: var(--primary); color: #fff; border-color: var(--primary); }
        .plist-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 12px;
          background: var(--bg-card);
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          transition: background var(--dur-fast);
          font-family: inherit;
        }
        .plist-item:hover, .plist-item:active { background: var(--bg-subtle); }
        .plist-item:last-child { border-bottom: none; }

        .plist-img {
          width: 52px; height: 52px;
          border-radius: 14px;
          background: var(--bg-subtle);
          flex-shrink: 0;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .plist-img img {
          width: 100%; height: 100%;
          object-fit: cover;
        }
        .plist-img-emoji {
          font-size: 24px;
          line-height: 1;
        }
        .plist-img-badge {
          position: absolute;
          bottom: -3px; right: -3px;
          min-width: 20px; height: 20px;
          padding: 0 5px;
          border-radius: 999px;
          background: var(--primary);
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid var(--bg-card);
          line-height: 1;
        }

        .plist-info { flex: 1; min-width: 0; }

        .plist-row-top {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
        }
        .plist-cliente {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: var(--text-title);
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }
        .plist-time {
          font-size: 11px;
          font-weight: 500;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .plist-row-mid {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
          margin-top: 3px;
        }
        .plist-produto {
          margin: 0;
          font-size: 12px;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }
        .plist-valor {
          font-size: 13px;
          font-weight: 800;
          color: var(--primary);
          flex-shrink: 0;
          letter-spacing: -0.01em;
        }

        .plist-tags {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 6px;
          flex-wrap: wrap;
        }
        .plist-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 9.5px;
          font-weight: 800;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .plist-tag-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          display: inline-block;
        }
        .plist-tag--hoje { background: var(--primary-light); color: var(--primary-dark); }
        .plist-tag--amanha { background: #F0F9FF; color: #075985; }
        .plist-tag--atrasado { background: #FEE2E2; color: #B91C1C; }
        .plist-tag--neutral { background: var(--bg-subtle); color: var(--text-secondary); font-weight: 700; }

        /* Tag "Aguardando aprovação" — destaque rosa forte com pulso */
        .plist-tag--aprovar {
          background: var(--primary);
          color: #fff;
          box-shadow: 0 0 0 0 rgba(232, 90, 140, 0.55);
          animation: aprovarPulse 2s ease-in-out infinite;
        }
        .plist-tag-pulse {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #fff;
          display: inline-block;
          animation: dotBlink 1s ease-in-out infinite;
        }
        @keyframes aprovarPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(232, 90, 140, 0.55); }
          50%      { box-shadow: 0 0 0 8px rgba(232, 90, 140, 0); }
        }
        @keyframes dotBlink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }

        /* Esconde a lista minimalista no desktop (usa tabela lá) */
        @media (min-width: 768px) {
          .plist-item, .plist-container { display: none; }
        }

        /* ── Card de pedido (mantido pro desktop e legado) ── */
        .ped-card { background: var(--bg-card); border-radius: var(--radius-lg); cursor: pointer; font-family: inherit; position: relative; overflow: hidden; }
        .ped-card-banner { background: #fee2e2; padding: 4px 1.1rem; font-size: var(--font-caption); font-weight: var(--fw-bold); color: #dc2626; }
        .ped-card-head { display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1.1rem 0; gap: 0.5rem; }
        .ped-card-numero { font-size: var(--font-caption); font-weight: var(--fw-semibold); color: var(--text-muted); }
        .ped-card-origem { margin-left: 6px; background: #ede9fe; color: #5b21b6; border-radius: var(--radius-sm); padding: 1px 6px; font-size: var(--font-caption); font-weight: var(--fw-bold); }
        .ped-card-status { display: inline-flex; align-items: center; gap: 5px; font-size: var(--font-caption); font-weight: var(--fw-bold); padding: 3px 10px; border-radius: var(--radius-sm); flex-shrink: 0; }
        .ped-card-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .ped-card-body { padding: 0.65rem 1.1rem 0; }
        .ped-card-cliente { margin: 0 0 0.5rem; font-size: var(--font-input); font-weight: var(--fw-bold); color: var(--text-title); line-height: 1.25; }
        .ped-card-produto-row { display: flex; align-items: center; gap: 0.65rem; min-width: 0; }
        .ped-card-produto-img { width: 42px; height: 42px; border-radius: var(--radius-sm); flex-shrink: 0; background: var(--bg-subtle); border: 1px solid var(--border); overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: var(--font-modal-title); }
        .ped-card-produto-img img { width: 100%; height: 100%; object-fit: cover; }
        .ped-card-produto-info { flex: 1; min-width: 0; }
        .ped-card-produto-nome { margin: 0; font-size: var(--font-button); font-weight: var(--fw-semibold); color: var(--text-title); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ped-card-mais-itens { font-weight: var(--fw-medium); color: var(--text-muted); }
        .ped-card-produto-qtd { margin: 2px 0 0; font-size: var(--font-helper); color: var(--text-secondary); }
        .ped-card-data { margin: 0; font-size: var(--font-helper); font-weight: var(--fw-semibold); line-height: 1.3; }
        .ped-card-tipo-entrega { margin: 1px 0 0; font-size: var(--font-helper); color: var(--text-secondary); }
        .ped-card-mapa { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; padding: 0; margin-top: 3px; font-size: var(--font-caption); font-weight: var(--fw-semibold); color: var(--primary); cursor: pointer; font-family: inherit; }
        .ped-card-mapa:hover { text-decoration: underline; }
        .ped-card-pagamento { font-size: var(--font-helper); font-weight: var(--fw-semibold); }
        .ped-card-valor { font-size: var(--font-modal-title); font-weight: var(--fw-black); color: var(--text-title); letter-spacing: -0.02em; }
        .ped-card-extras { border-top: 1px solid var(--border); padding: 0.65rem 1.1rem; display: flex; flex-wrap: wrap; gap: 6px; margin-top: 0.85rem; }
        .ped-card-chip { font-size: var(--font-caption); font-weight: var(--fw-medium); background: var(--bg-subtle); color: var(--primary); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 3px 8px; }
        .ped-card-chip--etiqueta { background: var(--bg-body); color: var(--text-secondary); }

        /* ── Card mobile novo ── */
        .mob-card-inner { display: flex; flex-direction: column; padding: 0.65rem 0.9rem; gap: 0.45rem; }
        .mob-card-topo { display: flex; flex-direction: column; gap: 2px; }
        .mob-card-cliente { font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--text-title); margin: 2px 0 0; }
        .mob-card-datetime { font-size: var(--font-caption); color: var(--text-muted); }
        .mob-card-meta { display: flex; gap: 10px; font-size: var(--font-caption); color: var(--text-muted); }
        .mob-card-divider { height: 1px; border-top: 1px dashed var(--border); margin: 0.1rem 0; }
        .mob-card-produto { display: flex; align-items: center; gap: 8px; }
        .mob-card-produto-img { width: 34px; height: 34px; border-radius: var(--radius-sm); flex-shrink: 0; background: var(--bg-subtle); border: 1px solid var(--border); overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: var(--font-input); }
        .mob-card-produto-img img { width: 100%; height: 100%; object-fit: cover; }
        .mob-card-produto-nome { font-size: var(--font-helper); font-weight: var(--fw-semibold); color: var(--text-title); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
        .mob-card-produto-qtd { font-size: var(--font-caption); color: var(--text-secondary); margin: 1px 0 0; }
        .mob-card-infos { display: flex; flex-direction: column; gap: 3px; }
        .mob-card-info-row { display: flex; align-items: center; gap: 6px; margin: 0; font-size: var(--font-helper); color: var(--text-secondary); }
        .mob-card-info-label { font-weight: var(--fw-semibold); color: var(--text-title); font-size: var(--font-helper); }
        .mob-card-rodape { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
        .mob-card-valor { font-size: var(--font-input); font-weight: var(--fw-black); color: var(--text-title); margin: 0; letter-spacing: -0.02em; white-space: nowrap; }


        .ped-card-rodape { display: flex; align-items: flex-end; justify-content: space-between; padding: 0.85rem 1.1rem; gap: 0.75rem; }
        .ped-card-rodape-direita { text-align: right; }
        .ped-card-rodape-direita .ped-card-valor { margin: 4px 0 0; }

        /* ── Modal de pedido ── */
        .mp-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--border); margin: 10px auto 0; flex-shrink: 0; }
        @media (min-width: 768px) { .mp-handle { display: none; } }
        .mp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9998; animation: hsFadeIn 0.2s ease; }
        .mp-modal { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-card); border-radius: var(--radius-xl) 20px 0 0; z-index: 9999; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 -4px 32px rgba(0,0,0,0.2); animation: hsSlideUp 0.28s cubic-bezier(0.32,0.72,0,1); font-family: inherit; }
        @media (min-width: 768px) { .mp-modal { top: 50%; left: 50%; right: auto; bottom: auto; transform: translate(-50%,-50%); border-radius: var(--radius-lg); width: 460px; max-width: 95vw; max-height: 85vh; animation: hsFadeIn 0.2s ease; box-shadow: 0 20px 60px rgba(0,0,0,0.2); } }

        /* Header */
        .mp-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 1rem 1.25rem 0.85rem; border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .mp-numero { font-size: var(--font-modal-title); font-weight: var(--fw-black); color: var(--text-title); }
        .mp-criado { font-size: var(--font-caption); color: var(--text-muted); margin: 4px 0 0; }
        .mp-fechar { background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; padding: 6px; border-radius: var(--radius-sm); flex-shrink: 0; transition: all 0.15s; }
        .mp-fechar:hover { background: var(--bg-subtle); color: var(--text-title); }

        /* Body */
        .mp-body { overflow-y: auto; flex: 1; padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
        .mp-grupo { display: flex; flex-direction: column; }
        .mp-grupo-titulo { font-size: var(--font-caption); font-weight: var(--fw-bold); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 4px; }
        .mp-grupo-val { font-size: var(--font-input); font-weight: var(--fw-semibold); color: var(--text-title); margin: 0; }
        .mp-grupo-sub { font-size: var(--font-helper); color: var(--text-secondary); margin: 3px 0 0; line-height: 1.4; }

        /* Itens */
        .mp-itens { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
        .mp-item { display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--bg-subtle); border-radius: var(--radius-md); }
        .mp-item-img { width: 40px; height: 40px; border-radius: var(--radius-sm); background: var(--bg-card); border: 1px solid var(--border); overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: var(--font-modal-title); flex-shrink: 0; }
        .mp-item-img img { width: 100%; height: 100%; object-fit: cover; }
        .mp-item-nome { font-size: var(--font-button); font-weight: var(--fw-semibold); color: var(--text-title); margin: 0; }
        .mp-item-qtd { font-size: var(--font-helper); color: var(--text-secondary); margin: 2px 0 0; }
        .mp-item-extra { font-size: var(--font-caption); color: var(--text-muted); margin: 2px 0 0; }
        .mp-item-total { font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--text-title); flex-shrink: 0; margin: 0; }

        /* Resumo pagamento + total */
        .mp-resumo { background: var(--bg-subtle); border-radius: var(--radius-md); padding: 0.85rem 1rem; display: flex; flex-direction: column; gap: 8px; }
        .mp-resumo-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .mp-resumo-label { font-size: var(--font-helper); color: var(--text-secondary); font-weight: var(--fw-medium); }
        .mp-resumo-val { font-size: var(--font-button); font-weight: var(--fw-semibold); color: var(--text-title); }
        .mp-resumo-total { padding-top: 8px; border-top: 1px dashed var(--border); }
        .mp-resumo-label-total { font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--text-title); }
        .mp-resumo-val-total { font-size: var(--font-modal-title); font-weight: var(--fw-black); color: var(--text-title); letter-spacing: -0.02em; }

        /* Footer */
        .mp-footer { padding: 0.85rem 1.25rem 1.25rem; border-top: 1px solid var(--border); flex-shrink: 0; display: flex; gap: 8px; flex-wrap: wrap; }
        .mp-btn-editar { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--text-title); border: none; color: white; border-radius: var(--radius-md); padding: 0.8rem; font-size: var(--font-button); font-weight: var(--fw-semibold); cursor: pointer; font-family: inherit; transition: opacity 0.15s; }
        .mp-btn-editar:hover { opacity: 0.92; }
        .mp-btn-editar--secondary { background: transparent; color: var(--text-title); border: 1.5px solid var(--border); }
        .mp-btn-editar--secondary:hover { background: var(--bg-subtle); opacity: 1; }

        /* Botão APROVAR — destaque rosa chunky */
        .mp-btn-aprovar {
          flex: 1 1 100%;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          background: var(--primary); color: #fff; border: none;
          border-radius: var(--radius-md);
          padding: 0.95rem;
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: var(--fw-black);
          letter-spacing: 0.02em;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 3px 0 var(--primary-dark);
          transition: transform var(--dur-fast), background var(--dur-fast);
        }
        .mp-btn-aprovar:hover { background: var(--btn-primary-hover); }
        .mp-btn-aprovar:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--primary-dark); }

        /* Banner destaque topo do modal — cola no topo, herda border-radius */
        .mp-banner-aprovar {
          display: flex; flex-direction: column;
          padding: 0 0 12px;
          background: linear-gradient(135deg, var(--primary-light), #FFF8FA);
          border-bottom: 1px solid var(--border);
          border-top-left-radius: 20px;
          border-top-right-radius: 20px;
          color: var(--primary-dark);
          animation: mpBannerPulse 2.5s ease-in-out infinite;
        }
        .mp-banner-content {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 4px 16px 0;
        }
        .mp-banner-content > svg { flex-shrink: 0; margin-top: 2px; color: var(--primary); }

        /* Handle que fica DENTRO do banner (em cima do rosa) */
        .mp-handle--sobre-banner {
          background: rgba(232, 90, 140, 0.45) !important;
          margin: 10px auto 8px !important;
        }
        @keyframes mpBannerPulse {
          0%, 100% { background: linear-gradient(135deg, var(--primary-light), #FFF8FA); }
          50%      { background: linear-gradient(135deg, #FBCADB, #FEE9F0); }
        }
        .mp-banner-title {
          margin: 0;
          font-size: 13px;
          font-weight: 800;
          color: var(--text-title);
          letter-spacing: -0.01em;
        }
        .mp-banner-sub {
          margin: 3px 0 0;
          font-size: 11px;
          color: var(--text-secondary);
          line-height: 1.4;
        }
        .mp-btn-excluir { width: 44px; height: 44px; background: #fff1f2; border: 1.5px solid #fca5a5; color: #dc2626; border-radius: var(--radius-md); cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; }
        .mp-btn-excluir:hover { background: #fee2e2; }
        .mp-confirm-excluir { width: 100%; background: #fff1f2; border: 1.5px solid #fca5a5; border-radius: var(--radius-md); padding: 0.85rem 1rem; }
        .mp-confirm-excluir p { font-size: var(--font-button); color: #991b1b; margin: 0 0 10px; font-weight: var(--fw-medium); }
        .mp-btn-cancel { flex: 1; background: var(--bg-card); border: 1.5px solid var(--border); color: var(--text-secondary); border-radius: var(--radius-sm); padding: 0.55rem; font-size: var(--font-button); font-weight: var(--fw-semibold); cursor: pointer; font-family: inherit; }
        .mp-btn-confirmar-excluir { flex: 1; background: #dc2626; border: none; color: white; border-radius: var(--radius-sm); padding: 0.55rem; font-size: var(--font-button); font-weight: var(--fw-semibold); cursor: pointer; font-family: inherit; }

        @media (min-width: 768px) {
          .ped-dt-wrapper { background: var(--bg-card); border: 1.5px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; width: 100%; }

          .ped-th { padding: 0.85rem 1rem; font-size: var(--font-caption); font-weight: var(--fw-bold); text-transform: uppercase; letter-spacing: 0.12em; color: #ffffff; text-align: left; white-space: nowrap; }
          .ped-th:nth-child(1) { min-width: 130px; }
          .ped-th:nth-child(2) { min-width: 150px; }
          .ped-th:nth-child(3) { min-width: 160px; }
          .ped-th:nth-child(4) { min-width: 140px; }
          .ped-th:nth-child(5) { min-width: 100px; }
          .ped-th:nth-child(6) { min-width: 110px; }
          .ped-th:nth-child(7) { min-width: 110px; }

          .ped-dt-row { cursor: pointer; transition: background 0.12s; border-bottom: 1px solid var(--border); }
          .ped-dt-row:last-child { border-bottom: none; }
          .ped-dt-row:hover { background: var(--bg-subtle); }

          .ped-td { padding: 0.65rem 1rem; vertical-align: middle; font-family: inherit; }

          /* Colunas individuais */
          .ped-dt-col { display: flex; flex-direction: column; justify-content: center; min-width: 0; }
          .ped-dt-col--num { gap: 2px; }
          .ped-dt-col--cliente { gap: 2px; }
          .ped-dt-col--produto { flex-direction: row; align-items: center; gap: 0; }
          .ped-dt-col--entrega { gap: 2px; }
          .ped-dt-col--status { align-items: flex-start; }

          /* Número do pedido */
          .ped-dt-num { font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--primary); display: block; }
          .ped-dt-criado { font-size: var(--font-caption); color: var(--text-muted); display: block; margin-top: 1px; }
          .ped-dt-origem-tag { font-size: var(--font-caption); font-weight: var(--fw-semibold); color: #185FA5; background: #E6F1FB; padding: 1px 6px; border-radius: var(--radius-sm); margin-top: 2px; display: inline-block; }

          /* Cliente */
          .ped-dt-cliente-nome { font-size: var(--font-button); font-weight: var(--fw-medium); color: var(--text-title); display: block; white-space: nowrap; }
          .ped-dt-cliente-tel { font-size: var(--font-caption); color: var(--text-muted); display: block; }

          .ped-dt-ver-btn { background: none; border: 1.5px solid var(--primary); color: var(--primary); border-radius: var(--radius-sm); padding: 0.3rem 0.7rem; font-size: var(--font-caption); font-weight: var(--fw-semibold); cursor: pointer; font-family: inherit; white-space: nowrap; transition: all 0.15s; }
          .ped-dt-ver-btn:hover { background: var(--primary); color: white; }

          /* Produto */
          .ped-dt-produto-row { display: flex; align-items: center; gap: 10px; min-width: 0; width: 100%; }
          .ped-dt-produto-img {
            width: 36px; height: 36px; border-radius: var(--radius-sm); flex-shrink: 0;
            background: var(--bg-subtle); border: 1px solid var(--border);
            overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: var(--font-input); line-height: 1;
          }
          .ped-dt-produto-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
          .ped-dt-produto-info { flex: 1; min-width: 0; }
          .ped-dt-produto-nome {
            font-size: var(--font-button); font-weight: var(--fw-semibold); color: var(--text-title);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; margin: 0; max-width: 280px;
          }
          .ped-dt-produto-qtd { font-size: var(--font-caption); color: var(--text-secondary); margin: 2px 0 0; }

          /* Entrega */
          .ped-dt-data { font-size: var(--font-button); font-weight: var(--fw-semibold); margin: 0; }
          .ped-dt-tipo { font-size: var(--font-helper); color: var(--text-secondary); margin: 2px 0 0; }

          /* Valor */
          .ped-dt-valor { font-size: var(--font-input); font-weight: var(--fw-black); color: var(--text-title); letter-spacing: -0.02em; margin: 0; }
          .ped-dt-pag { font-size: var(--font-caption); font-weight: var(--fw-semibold); margin: 3px 0 0; }

          .ped-dt-vazio { color: var(--text-muted); font-size: var(--font-button); }

          /* No desktop, o card vira uma linha flat — sem borda/radius próprios */
          .ped-card { border: none !important; border-radius: 0 !important; background: transparent !important; border-bottom: 1.5px solid #D4A0B0 !important; }
          .ped-card:last-child { border-bottom: none !important; }

          /* Banner de urgente ainda aparece no desktop */
          .ped-card-banner { border-radius: 0; }
        }

        /* ── Modal de mapa ── */
        .map-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 200; animation: hsFadeIn 0.2s ease; }
        .map-sheet { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-card); border-radius: var(--radius-xl) 20px 0 0; z-index: 201; max-width: 480px; margin: 0 auto; max-height: 80vh; overflow-y: auto; animation: hsSlideUp 0.28s cubic-bezier(0.32,0.72,0,1); box-shadow: 0 -4px 32px rgba(0,0,0,0.15); }
        .map-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.7rem; border-radius: var(--radius-md); font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-bold); text-decoration: none; }
        .map-btn--waze { background: #33CCFF; color: white; }
        .map-btn--maps { background: #ecf3ff; color: #4285f4; }
        .map-btn-close { width: 100%; padding: 0.85rem; background: var(--bg-subtle); color: var(--text-primary); border: none; border-radius: var(--radius-full); font-family: inherit; font-size: var(--font-input); font-weight: var(--fw-bold); cursor: pointer; }

        .fd-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 300; animation: hsFadeIn 0.2s ease; }
        .fd-drawer { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-card); border-radius: var(--radius-xl) 20px 0 0; z-index: 301; max-height: 85vh; display: flex; flex-direction: column; animation: hsSlideUp 0.28s cubic-bezier(0.32,0.72,0,1); box-shadow: 0 -4px 32px rgba(0,0,0,0.15); }
        @media (min-width: 768px) {
          .fd-drawer { top: 0; bottom: 0; left: auto; right: 0; width: 320px; border-radius: 0; max-height: 100vh; animation: hsSlideRight 0.28s cubic-bezier(0.32,0.72,0,1); box-shadow: -4px 0 32px rgba(0,0,0,0.15); }
          .fd-handle { display: none; }
          .fd-datas { flex-direction: column; gap: 8px; }
          .fd-data-field { width: 100%; }
          .fd-data-input { width: 100%; box-sizing: border-box; }
        }
        @keyframes hsSlideRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .fd-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--border); margin: 10px auto 0; flex-shrink: 0; }
        .fd-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .fd-title { font-size: 15px; font-weight: 800; color: var(--text-title); font-family: 'Geist',sans-serif; letter-spacing: -0.01em; }
        .fd-limpar { background: none; border: none; font-size: 12px; color: var(--text-secondary); font-weight: 600; cursor: pointer; font-family: 'Geist',sans-serif; text-decoration: underline; text-underline-offset: 2px; text-decoration-color: rgba(45,31,38,0.2); }
        .fd-limpar:hover { color: var(--text-title); text-decoration-color: currentColor; }
        .fd-body { overflow-y: auto; flex: 1; padding: 14px 16px 20px; display: flex; flex-direction: column; gap: 12px; background: var(--bg-body); }

        /* Preview do resultado — feedback vivo */
        .fd-preview {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px;
          background: var(--text-title);
          border-radius: var(--radius-md);
          color: #fff;
        }
        .fd-preview-lbl {
          margin: 0;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.6);
        }
        .fd-preview-txt { margin: 2px 0 0; display: flex; align-items: baseline; gap: 5px; }
        .fd-preview-num { font-size: 24px; font-weight: 900; letter-spacing: -0.02em; line-height: 1; }
        .fd-preview-unit { font-size: 13px; font-weight: 600; opacity: 0.85; }
        .fd-preview-hint { font-size: 11px; color: rgba(255,255,255,0.6); text-align: right; max-width: 100px; line-height: 1.3; }

        /* Cards de categoria */
        .fd-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        .fd-card-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px 8px;
        }
        .fd-card-title {
          margin: 0;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-secondary);
        }
        .fd-card-count {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
        }
        .fd-card-body { padding: 2px 6px 8px; }

        /* Linhas de status */
        .fd-status-row {
          display: flex; align-items: center; gap: 12px;
          width: 100%;
          padding: 10px 10px;
          background: none; border: none;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          font-family: 'Geist', sans-serif;
          transition: background 0.12s;
        }
        .fd-status-row:hover { background: var(--bg-subtle); }
        .fd-status-row--on { background: var(--bg-subtle); }
        .fd-check {
          width: 20px; height: 20px;
          border-radius: 5px;
          border: 1.5px solid var(--border);
          background: var(--bg-card);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          color: #fff;
          transition: background 0.12s, border-color 0.12s;
        }
        .fd-check--on {
          background: var(--text-title);
          border-color: var(--text-title);
        }
        .fd-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .fd-status-lbl {
          flex: 1;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-title);
        }
        .fd-status-cnt {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          background: var(--bg-subtle);
          padding: 2px 8px;
          border-radius: 999px;
          font-variant-numeric: tabular-nums;
          min-width: 22px;
          text-align: center;
        }
        .fd-status-row--on .fd-status-cnt { background: var(--bg-card); color: var(--text-secondary); }

        /* Segmented control pro período */
        .fd-segments {
          display: flex;
          background: var(--bg-subtle);
          border-radius: 10px;
          padding: 3px;
          gap: 2px;
          margin: 4px 10px 10px;
        }
        .fd-segment {
          flex: 1;
          padding: 8px 4px;
          border: none;
          background: none;
          border-radius: 8px;
          font-family: 'Geist', sans-serif;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
          transition: background 0.12s, color 0.12s, box-shadow 0.12s;
        }
        .fd-segment--on {
          background: var(--bg-card);
          color: var(--text-title);
          font-weight: 700;
          box-shadow: 0 1px 3px rgba(45,31,38,0.08);
        }

        /* Datas */
        .fd-datas { display: flex; gap: 10px; padding: 4px 12px 12px; }
        .fd-data-field { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .fd-data-label { font-size: 11px; font-weight: 600; color: var(--text-secondary); font-family: 'Geist',sans-serif; }
        .fd-data-input { border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 12px; font-family: 'Geist',sans-serif; color: var(--text-primary); background: var(--bg-card); outline: none; width: 100%; box-sizing: border-box; }
        .fd-data-input:focus { border-color: var(--text-title); }

        .fd-footer { padding: 12px 16px 28px; flex-shrink: 0; border-top: 1px solid var(--border); background: var(--bg-card); }
        .fd-aplicar { width: 100%; padding: 13px; background: var(--text-title); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Geist',sans-serif; cursor: pointer; letter-spacing: 0.02em; transition: opacity 0.15s; }
        .fd-aplicar:hover { opacity: 0.9; }
      `}</style>
    </div>
    )}
    </>
  )
}

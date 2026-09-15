// ── EditarPedido.tsx ─────────────────────────────────────────────────────────
// Tela de edição de pedido — design novo estilo Dora
// FASE 1: casca (header + tabs + footer)
// FASE 2: tab Cliente completa
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import HorarioSheet from '@/components/HorarioSheet'

// ── Tipos ─────────────────────────────────────────────────────────────────
type PedidoItem = {
  id?: string
  produto_id?: string | null
  nome_produto: string
  quantidade: number
  valor_unitario: number
  observacoes?: string
  imagem_url?: string | null
}

type Pedido = {
  id: string
  numero?: number
  cliente_id?: string | null
  cliente_nome: string
  cliente_telefone: string
  status: string
  status_pagamento: string
  valor_total: number
  valor_recebido: number
  valor_produtos?: number
  desconto?: number
  taxa_entrega?: number
  forma_pagamento: string
  tipo_entrega: string
  tipo_venda?: string
  data_entrega: string
  horario_entrega: string
  endereco_rua?: string
  endereco_numero?: string
  endereco_bairro?: string
  endereco_cidade?: string
  endereco_complemento?: string
  observacoes?: string
  origem?: string
  data_prevista_pagamento?: string
  created_at?: string
  pedido_itens?: PedidoItem[]
}

interface Cliente {
  id: string
  nome: string
  telefone?: string
  whatsapp?: string
  rua?: string
  numero?: string
  bairro?: string
  cidade?: string
  complemento?: string
}

type Tab = 'cliente' | 'itens' | 'valores' | 'pagar'

// ── Config de status ──────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  aguardando_pagamento: { label: 'Aguardando Pagamento', bg: '#FEF0DF', color: '#854F0B' },
  aguardando_aceite:    { label: 'Aguardando Aceite',    bg: '#FEF0DF', color: '#854F0B' },
  agendado:             { label: 'Agendado',             bg: '#E6F1FB', color: '#185FA5' },
  em_producao:          { label: 'Em Produção',          bg: '#FCE0E9', color: '#993556' },
  finalizado:           { label: 'Finalizado',           bg: '#E1F5EE', color: '#0F6E56' },
  aguardando_retirada:  { label: 'Aguardando Retirada',  bg: '#E1F5EE', color: '#0F6E56' },
  em_entrega:           { label: 'Em Entrega',           bg: '#E6F1FB', color: '#185FA5' },
  entregue:             { label: 'Entregue',             bg: '#F1EFE8', color: '#5F5E5A' },
  cancelado:            { label: 'Cancelado',            bg: '#FCEBEB', color: '#791F1F' },
}
const STATUS_OPCOES = ['aguardando_pagamento','aguardando_aceite','agendado','em_producao','finalizado','aguardando_retirada','em_entrega','entregue']

// ── Utils ─────────────────────────────────────────────────────────────────
function formatMoney(v: number) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function toTitleCase(s: string): string {
  if (!s) return ''
  const minusc = new Set(['de','da','do','das','dos','e','com','para','a','o','em','na','no'])
  return s.toLowerCase().split(' ').map((w, i) => {
    if (i > 0 && minusc.has(w)) return w
    return w.charAt(0).toUpperCase() + w.slice(1)
  }).join(' ')
}
function formatDataHora(dataStr?: string | null, horaStr?: string | null): string {
  if (!dataStr) return '—'
  const [y, m, d] = dataStr.split('-')
  const hora = horaStr ? ` às ${horaStr.slice(0, 5)}` : ''
  return `${d}/${m}${hora}`
}
function initialsOf(nome: string): string {
  if (!nome) return '?'
  const partes = nome.trim().split(/\s+/)
  return (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase()
}
function formatCep(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 8)
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`
  return digits
}
function formatTelefone(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

// Data de HOJE em ISO (YYYY-MM-DD) no fuso local
function hojeISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}
function amanhaISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

// ── Ícones inline ─────────────────────────────────────────────────────────
const I = {
  cal:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  clock:  () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  print:  () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  home:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  truck:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  hand:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 17V5a1.5 1.5 0 0 1 3 0v6"/><path d="M14 11a1.5 1.5 0 0 1 3 0v3"/><path d="M17 12a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-2c-2 0-2.5-.4-4-2l-3.5-3.5C4 15.6 4.5 14 6 14h1"/><path d="M11 11V6a1.5 1.5 0 0 0-3 0v9"/></svg>,
  menu:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  user:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  box:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  dollar: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  card:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  chevL:  () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  chevD:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  x:      () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  ban:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
export default function EditarPedido() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [tab, setTab] = useState<Tab>('cliente')

  // ── State editável (populated no load) ────────────────────────────────
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [clienteNome, setClienteNome] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')

  const [statusPedido, setStatusPedido] = useState('agendado')
  const [tipoEntrega, setTipoEntrega] = useState<'retirada' | 'entrega'>('retirada')
  const [dataEntrega, setDataEntrega] = useState('')
  const [horarioEntrega, setHorarioEntrega] = useState('')

  const [enderecoCep, setEnderecoCep] = useState('')
  const [enderecoRua, setEnderecoRua] = useState('')
  const [enderecoNumero, setEnderecoNumero] = useState('')
  const [enderecoBairro, setEnderecoBairro] = useState('')
  const [enderecoCidade, setEnderecoCidade] = useState('Curitiba')
  const [enderecoComplemento, setEnderecoComplemento] = useState('')
  const [cepLoading, setCepLoading] = useState(false)

  // ── Modais ────────────────────────────────────────────────────────────
  const [modalCliente, setModalCliente] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [buscaCliente, setBuscaCliente] = useState('')
  const [statusDropdownAberto, setStatusDropdownAberto] = useState(false)
  const [horaSheetAberto, setHoraSheetAberto] = useState(false)

  // ── Load do pedido + lista de clientes ────────────────────────────────
  useEffect(() => {
    if (!id) return
    let cancelado = false
    ;(async () => {
      const [{ data: pedidoData, error }, { data: user }] = await Promise.all([
        supabase.from('pedidos').select('*, pedido_itens(*)').eq('id', id).single(),
        supabase.auth.getUser(),
      ])
      if (cancelado) return
      if (error || !pedidoData) {
        alert('Não foi possível carregar o pedido.')
        navigate('/pedidos')
        return
      }
      const p = pedidoData as Pedido
      setPedido(p)
      // Popular states editáveis
      setClienteId(p.cliente_id || null)
      setClienteNome(p.cliente_nome || '')
      setClienteTelefone(p.cliente_telefone || '')
      setStatusPedido(p.status || 'agendado')
      setTipoEntrega((p.tipo_entrega as 'retirada' | 'entrega') || 'retirada')
      setDataEntrega(p.data_entrega || '')
      setHorarioEntrega(p.horario_entrega || '')
      setEnderecoRua(p.endereco_rua || '')
      setEnderecoNumero(p.endereco_numero || '')
      setEnderecoBairro(p.endereco_bairro || '')
      setEnderecoCidade(p.endereco_cidade || 'Curitiba')
      setEnderecoComplemento(p.endereco_complemento || '')
      // Carregar lista de clientes
      if (user?.user) {
        const { data: cls } = await supabase
          .from('clientes')
          .select('id,nome,telefone,whatsapp,rua,numero,bairro,cidade,complemento')
          .eq('user_id', user.user.id)
          .order('nome')
        if (!cancelado) setClientes(cls || [])
      }
      setCarregando(false)
    })()
    return () => { cancelado = true }
  }, [id])

  // ── Fecha dropdown de status ao clicar fora ───────────────────────────
  useEffect(() => {
    if (!statusDropdownAberto) return
    const onDoc = () => setStatusDropdownAberto(false)
    // pequeno delay pra não fechar no mesmo clique que abriu
    const t = setTimeout(() => document.addEventListener('click', onDoc), 0)
    return () => { clearTimeout(t); document.removeEventListener('click', onDoc) }
  }, [statusDropdownAberto])

  // ── CEP ───────────────────────────────────────────────────────────────
  const fetchCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (!data.erro) {
        if (data.logradouro) setEnderecoRua(data.logradouro)
        if (data.bairro) setEnderecoBairro(data.bairro)
        if (data.localidade) setEnderecoCidade(data.localidade)
      }
    } catch {}
    setCepLoading(false)
  }

  // ── Selecionar cliente do modal ───────────────────────────────────────
  const selecionarCliente = (c: Cliente) => {
    setClienteId(c.id)
    setClienteNome(c.nome)
    setClienteTelefone(c.telefone || c.whatsapp || '')
    // Se tem endereço no cadastro do cliente, preenche
    if (c.rua) setEnderecoRua(c.rua)
    if (c.numero) setEnderecoNumero(c.numero)
    if (c.bairro) setEnderecoBairro(c.bairro)
    if (c.cidade) setEnderecoCidade(c.cidade)
    if (c.complemento) setEnderecoComplemento(c.complemento)
    setModalCliente(false)
    setBuscaCliente('')
  }

  // ── Handler de salvar (Fase 6) ────────────────────────────────────────
  const handleSalvar = async () => {
    setSalvando(true)
    alert('Salvar alterações — Fase 6')
    setSalvando(false)
  }

  // ── Derivados pro header ──────────────────────────────────────────────
  const totalItens = pedido?.pedido_itens?.length || 0
  const total = pedido?.valor_total || 0
  const origemLabel = pedido?.origem === 'cardapio' ? 'Cardápio' : 'Manual'
  const tipoEntregaIcon = tipoEntrega === 'entrega' ? I.truck : I.home

  // ── Loading state ────────────────────────────────────────────────────
  if (carregando || !pedido) {
    return (
      <div className="ep-loading">
        <div className="ep-spinner" />
        <p>Carregando pedido...</p>
        <style>{`
          .ep-loading { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #888780; font-family: var(--font-base) !important; }
          .ep-spinner { width: 32px; height: 32px; border: 3px solid #F1EFE8; border-top-color: #E85A8C; border-radius: 50%; animation: epspin 0.8s linear infinite; }
          @keyframes epspin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    )
  }

  return (
    <div className="ep-wrap">
      {/* ═══ HEADER STICKY ═══ */}
      <div className="ep-header">
        <div className="ep-header-top">
          <button className="ep-back" onClick={() => navigate('/pedidos')} aria-label="Voltar">
            <I.chevL />
          </button>
          <div className="ep-header-title-wrap">
            <div className="ep-header-title">
              <I.cal />
              Editar Pedido <span className="ep-num">#{pedido.numero || '—'}</span>
            </div>
          </div>
          <div className="ep-header-actions">
            <button className="ep-icon-btn" aria-label="Timeline" title="Acompanhar pedido">
              <I.clock />
            </button>
            <button className="ep-icon-btn" aria-label="Exportar PDF" title="Exportar PDF">
              <I.print />
            </button>
          </div>
        </div>

        <div className="ep-header-info">
          <div className="ep-header-cliente">
            {clienteNome ? toTitleCase(clienteNome) : <span className="ep-cliente-vazio">Cliente não informado</span>}
          </div>
          <div className="ep-header-meta">
            <span className="ep-header-meta-item">
              {tipoEntregaIcon()}
              {formatDataHora(dataEntrega, horarioEntrega)}
            </span>
            <span className="ep-tag-origem">
              {pedido.origem === 'cardapio' ? <I.menu /> : <I.hand />}
              {origemLabel}
            </span>
          </div>
        </div>

        {/* ═══ TABS ═══ */}
        <div className="ep-tabs">
          <button className={`ep-tab ${tab === 'cliente' ? 'ep-tab--ativa' : ''}`} onClick={() => setTab('cliente')}>
            <I.user />
            <span>Cliente</span>
          </button>
          <button className={`ep-tab ${tab === 'itens' ? 'ep-tab--ativa' : ''}`} onClick={() => setTab('itens')}>
            <I.box />
            <span>Itens {totalItens > 0 && <span className="ep-tab-badge">({totalItens})</span>}</span>
          </button>
          <button className={`ep-tab ${tab === 'valores' ? 'ep-tab--ativa' : ''}`} onClick={() => setTab('valores')}>
            <I.dollar />
            <span>Valores</span>
          </button>
          <button className={`ep-tab ${tab === 'pagar' ? 'ep-tab--ativa' : ''}`} onClick={() => setTab('pagar')}>
            <I.card />
            <span>Pagar</span>
          </button>
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div className="ep-body">
        {tab === 'cliente' && (
          <div className="ep-tab-content">

            {/* ─── SEÇÃO: Informações do Cliente ─── */}
            <div className="ep-section">
              <div className="ep-section-title">
                <I.user />
                Informações do Cliente
              </div>

              <label className="ep-label">Cliente <span className="ep-label-req">*</span></label>
              {clienteNome || clienteTelefone ? (
                <div className="ep-cliente-card">
                  <div className="ep-cliente-avatar">{initialsOf(clienteNome || '?')}</div>
                  <div className="ep-cliente-info">
                    <div className="ep-cliente-nome">{clienteNome ? toTitleCase(clienteNome) : 'Sem nome'}</div>
                    {clienteTelefone && <div className="ep-cliente-tel">{clienteTelefone}</div>}
                  </div>
                  <button type="button" className="ep-cliente-trocar" onClick={() => setModalCliente(true)}>
                    Trocar
                  </button>
                </div>
              ) : (
                <button type="button" className="ep-btn-selecionar" onClick={() => setModalCliente(true)}>
                  <I.search />
                  Selecionar cliente
                </button>
              )}
            </div>

            {/* ─── SEÇÃO: Status e Entrega ─── */}
            <div className="ep-section">
              <div className="ep-section-title">
                <I.box />
                Status e Entrega
              </div>

              <label className="ep-label">Status do pedido</label>
              <div className="ep-status-wrap">
                <button
                  type="button"
                  className="ep-status-atual"
                  onClick={e => { e.stopPropagation(); setStatusDropdownAberto(o => !o) }}
                >
                  <span className="ep-status-icon" style={{ background: (STATUS_CONFIG[statusPedido] || STATUS_CONFIG.agendado).bg, color: (STATUS_CONFIG[statusPedido] || STATUS_CONFIG.agendado).color }}>
                    <I.box />
                  </span>
                  <div className="ep-status-info">
                    <div className="ep-status-label">{(STATUS_CONFIG[statusPedido] || STATUS_CONFIG.agendado).label}</div>
                  </div>
                  <span className="ep-status-alterar">
                    Alterar <I.chevD />
                  </span>
                </button>
                {statusDropdownAberto && (
                  <div className="ep-status-drop" onClick={e => e.stopPropagation()}>
                    {STATUS_OPCOES.map(s => {
                      const cfg = STATUS_CONFIG[s]
                      return (
                        <button
                          key={s}
                          type="button"
                          className={`ep-status-opt ${statusPedido === s ? 'ep-status-opt--sel' : ''}`}
                          onClick={() => { setStatusPedido(s); setStatusDropdownAberto(false) }}
                        >
                          <span className="ep-status-dot" style={{ background: cfg.color }} />
                          {cfg.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="ep-cancelar-btn"
                onClick={() => alert('Cancelar pedido — Fase 8 (bottom sheet)')}
              >
                <span className="ep-cancelar-ic"><I.ban /></span>
                <span className="ep-cancelar-txt">Cancelar pedido</span>
              </button>

              <label className="ep-label ep-label--mt">Tipo de Entrega <span className="ep-label-req">*</span></label>
              <div className="ep-toggle-2">
                <button
                  type="button"
                  className={`ep-toggle-opt ${tipoEntrega === 'entrega' ? 'ep-toggle-opt--sel' : ''}`}
                  onClick={() => setTipoEntrega('entrega')}
                >
                  <I.truck />
                  Entrega
                </button>
                <button
                  type="button"
                  className={`ep-toggle-opt ${tipoEntrega === 'retirada' ? 'ep-toggle-opt--sel' : ''}`}
                  onClick={() => setTipoEntrega('retirada')}
                >
                  <I.home />
                  Retirada
                </button>
              </div>

              {tipoEntrega === 'entrega' && (
                <div className="ep-endereco">
                  <div className="ep-row-2">
                    <div>
                      <label className="ep-label">CEP</label>
                      <input
                        className="ep-input"
                        placeholder="00000-000"
                        inputMode="numeric"
                        value={enderecoCep}
                        onChange={e => {
                          const f = formatCep(e.target.value)
                          setEnderecoCep(f)
                          if (f.replace(/\D/g, '').length === 8) fetchCep(f)
                        }}
                      />
                    </div>
                    <div>
                      <label className="ep-label">Cidade</label>
                      <input
                        className="ep-input"
                        value={enderecoCidade}
                        onChange={e => setEnderecoCidade(e.target.value)}
                        disabled={cepLoading}
                      />
                    </div>
                  </div>
                  <label className="ep-label">Rua</label>
                  <input className="ep-input" value={enderecoRua} onChange={e => setEnderecoRua(e.target.value)} placeholder="Rua ou avenida" disabled={cepLoading} />
                  <div className="ep-row-2">
                    <div>
                      <label className="ep-label">Número</label>
                      <input className="ep-input" value={enderecoNumero} onChange={e => setEnderecoNumero(e.target.value)} placeholder="Nº" inputMode="numeric" />
                    </div>
                    <div>
                      <label className="ep-label">Bairro</label>
                      <input className="ep-input" value={enderecoBairro} onChange={e => setEnderecoBairro(e.target.value)} disabled={cepLoading} />
                    </div>
                  </div>
                  <label className="ep-label">Complemento</label>
                  <input className="ep-input" value={enderecoComplemento} onChange={e => setEnderecoComplemento(e.target.value)} placeholder="Apto, casa, referência..." />
                </div>
              )}
            </div>

            {/* ─── SEÇÃO: Data e Hora ─── */}
            <div className="ep-section">
              <div className="ep-section-title">
                <I.cal />
                Data de Entrega
              </div>

              <div className="ep-row-2">
                <div>
                  <label className="ep-label">Data <span className="ep-label-req">*</span></label>
                  <input
                    type="date"
                    className="ep-input"
                    value={dataEntrega}
                    onChange={e => setDataEntrega(e.target.value)}
                  />
                </div>
                <div>
                  <label className="ep-label">Hora</label>
                  <button type="button" className="ep-input ep-input-btn" onClick={() => setHoraSheetAberto(true)}>
                    {horarioEntrega ? horarioEntrega.slice(0, 5) : <span style={{ color: '#B4B2A9' }}>Escolher</span>}
                  </button>
                </div>
              </div>

              <div className="ep-quick-chips">
                <button
                  type="button"
                  className={`ep-chip ${dataEntrega === hojeISO() ? 'ep-chip--sel' : ''}`}
                  onClick={() => setDataEntrega(hojeISO())}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  className={`ep-chip ${dataEntrega === amanhaISO() ? 'ep-chip--sel' : ''}`}
                  onClick={() => setDataEntrega(amanhaISO())}
                >
                  Amanhã
                </button>
              </div>
            </div>

          </div>
        )}

        {tab === 'itens'    && <TabPlaceholder titulo="Itens do Pedido" descricao="Aqui vai a lista de itens com adicionar/remover. (Fase 3)" />}
        {tab === 'valores'  && <TabPlaceholder titulo="Valores" descricao="Desconto, acréscimo, taxa de entrega, total. (Fase 4)" />}
        {tab === 'pagar'    && <TabPlaceholder titulo="Pagamento" descricao="Forma de pagamento e situação (total/parcial/fiado). (Fase 5)" />}
      </div>

      {/* ═══ FOOTER STICKY ═══ */}
      <div className="ep-footer">
        <div className="ep-footer-total">
          <span className="ep-footer-total-label">Total:</span>
          <span className="ep-footer-total-val">{formatMoney(total)}</span>
        </div>
        <div className="ep-footer-btns">
          <button className="ep-btn ep-btn--ghost" onClick={() => navigate('/pedidos')} disabled={salvando}>
            Cancelar
          </button>
          <button className="ep-btn ep-btn--primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {/* ═══ MODAL CLIENTE ═══ */}
      {modalCliente && (
        <div className="ep-modal-overlay" onClick={() => setModalCliente(false)}>
          <div className="ep-modal" onClick={e => e.stopPropagation()}>
            <div className="ep-modal-header">
              <h3 className="ep-modal-title">Buscar cliente</h3>
              <button className="ep-modal-close" onClick={() => setModalCliente(false)} aria-label="Fechar">
                <I.x />
              </button>
            </div>
            <div className="ep-modal-search">
              <I.search />
              <input
                className="ep-modal-search-input"
                placeholder="Nome ou telefone..."
                value={buscaCliente}
                onChange={e => setBuscaCliente(e.target.value)}
                autoFocus
              />
            </div>
            <div className="ep-modal-lista">
              {clientes.filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) || (c.telefone || '').includes(buscaCliente)).map(c => (
                <button key={c.id} type="button" className="ep-modal-item" onClick={() => selecionarCliente(c)}>
                  <div className="ep-modal-item-avatar">{initialsOf(c.nome)}</div>
                  <div className="ep-modal-item-info">
                    <div className="ep-modal-item-nome">{toTitleCase(c.nome)}</div>
                    {(c.telefone || c.whatsapp) && <div className="ep-modal-item-sub">{formatTelefone(c.telefone || c.whatsapp || '')}</div>}
                  </div>
                </button>
              ))}
              {clientes.length === 0 && <p className="ep-modal-empty">Nenhum cliente cadastrado ainda</p>}
              {clientes.length > 0 && clientes.filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) || (c.telefone || '').includes(buscaCliente)).length === 0 && (
                <p className="ep-modal-empty">Nenhum cliente encontrado com "{buscaCliente}"</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ HORARIO SHEET ═══ */}
      {horaSheetAberto && (
        <HorarioSheet
          value={horarioEntrega}
          onChange={setHorarioEntrega}
          onClose={() => setHoraSheetAberto(false)}
          titulo="Horário de entrega"
        />
      )}

      {/* ═══ STYLES ═══ */}
      <style>{`
        .ep-wrap {
          min-height: 100vh;
          background: #F8F5F1;
          padding-bottom: 140px;
          font-family: var(--font-base) !important;
        }

        /* ── HEADER ────────────────────────────────────────────────── */
        .ep-header {
          position: sticky;
          top: 0;
          z-index: 20;
          background: #fff;
          border-bottom: 1px solid #F1EFE8;
        }
        .ep-header-top {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 12px 4px;
        }
        .ep-back {
          all: unset;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2C2C2A;
          cursor: pointer;
          transition: background 0.15s;
          flex-shrink: 0;
        }
        .ep-back:hover { background: #F5F1F3; }
        .ep-header-title-wrap { flex: 1; min-width: 0; }
        .ep-header-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 700;
          color: #2C2C2A;
          letter-spacing: -0.01em;
          font-family: var(--font-base) !important;
        }
        .ep-num { color: #888780; font-weight: 700; }
        .ep-header-actions {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }
        .ep-icon-btn {
          all: unset;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #5F5E5A;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .ep-icon-btn:hover { background: #F5F1F3; color: #2C2C2A; }

        .ep-header-info { padding: 4px 16px 12px; }
        .ep-header-cliente {
          font-size: 14px;
          font-weight: 600;
          color: #2C2C2A;
          letter-spacing: -0.005em;
        }
        .ep-cliente-vazio { color: #B4B2A9; font-style: italic; font-weight: 500; }
        .ep-header-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 6px;
        }
        .ep-header-meta-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #5F5E5A;
        }
        .ep-tag-origem {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: #F1EFE8;
          color: #5F5E5A;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 999px;
        }

        /* ── TABS ──────────────────────────────────────────────────── */
        .ep-tabs {
          display: flex;
          gap: 0;
          border-top: 1px solid #F1EFE8;
          background: #fff;
        }
        .ep-tab {
          all: unset;
          flex: 1;
          padding: 10px 4px;
          text-align: center;
          font-size: 12.5px;
          font-weight: 600;
          color: #888780;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          border-bottom: 2px solid transparent;
          transition: color 0.15s, border-color 0.15s;
        }
        .ep-tab:hover { color: #5F5E5A; }
        .ep-tab--ativa {
          color: #E85A8C;
          border-bottom-color: #E85A8C;
          font-weight: 700;
        }
        .ep-tab-badge { font-weight: 700; }

        /* ── BODY ──────────────────────────────────────────────────── */
        .ep-body { padding: 16px 12px; }
        .ep-tab-content { display: flex; flex-direction: column; gap: 14px; }

        .ep-section {
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 14px;
          padding: 16px;
        }
        .ep-section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 700;
          color: #2C2C2A;
          letter-spacing: -0.01em;
          margin-bottom: 14px;
        }

        .ep-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #5F5E5A;
          margin-bottom: 6px;
          letter-spacing: -0.005em;
        }
        .ep-label--mt { margin-top: 14px; }
        .ep-label-req { color: #E85A8C; font-weight: 700; }

        .ep-input {
          width: 100%;
          box-sizing: border-box;
          padding: 12px 14px;
          border: 1.5px solid #E8E5DC;
          border-radius: 10px;
          font-size: 14px;
          color: #2C2C2A;
          background: #fff;
          font-family: var(--font-base) !important;
          transition: border-color 0.15s;
          outline: none;
        }
        .ep-input:focus { border-color: #E85A8C; }
        .ep-input:disabled { background: #F8F5F1; color: #888780; }
        .ep-input-btn {
          all: unset;
          box-sizing: border-box;
          width: 100%;
          padding: 12px 14px;
          border: 1.5px solid #E8E5DC;
          border-radius: 10px;
          font-size: 14px;
          color: #2C2C2A;
          background: #fff;
          text-align: left;
          cursor: pointer;
        }
        .ep-row-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 12px;
        }
        .ep-row-2:last-child { margin-bottom: 0; }

        /* Cliente card */
        .ep-cliente-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1.5px solid #F0EBED;
          border-radius: 12px;
          background: #FAF8F5;
        }
        .ep-cliente-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #FCE0E9;
          color: #993556;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          letter-spacing: -0.01em;
          flex-shrink: 0;
        }
        .ep-cliente-info { flex: 1; min-width: 0; }
        .ep-cliente-nome {
          font-size: 14px;
          font-weight: 700;
          color: #2C2C2A;
          letter-spacing: -0.01em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ep-cliente-tel {
          font-size: 12.5px;
          color: #888780;
          margin-top: 2px;
        }
        .ep-cliente-trocar {
          all: unset;
          padding: 6px 12px;
          background: #fff;
          border: 1px solid #E8E5DC;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
          color: #5F5E5A;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .ep-cliente-trocar:hover { background: #F5F1F3; color: #2C2C2A; border-color: #E85A8C; }

        .ep-btn-selecionar {
          all: unset;
          box-sizing: border-box;
          width: 100%;
          padding: 12px;
          border: 1.5px dashed #E8E5DC;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #5F5E5A;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .ep-btn-selecionar:hover { background: #FAF8F5; border-color: #E85A8C; color: #E85A8C; }

        /* Status */
        .ep-status-wrap { position: relative; }
        .ep-status-atual {
          all: unset;
          box-sizing: border-box;
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1.5px solid #E8E5DC;
          border-radius: 12px;
          cursor: pointer;
          background: #fff;
          transition: border-color 0.15s;
        }
        .ep-status-atual:hover { border-color: #B4B2A9; }
        .ep-status-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .ep-status-info { flex: 1; min-width: 0; }
        .ep-status-label {
          font-size: 14px;
          font-weight: 700;
          color: #2C2C2A;
          letter-spacing: -0.01em;
        }
        .ep-status-alterar {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 12.5px;
          font-weight: 600;
          color: #E85A8C;
          flex-shrink: 0;
        }
        .ep-status-drop {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          z-index: 30;
          background: #fff;
          border: 1px solid #E8E5DC;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          padding: 6px;
          max-height: 280px;
          overflow-y: auto;
        }
        .ep-status-opt {
          all: unset;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 13.5px;
          font-weight: 600;
          color: #2C2C2A;
          cursor: pointer;
          width: 100%;
          box-sizing: border-box;
          transition: background 0.12s;
        }
        .ep-status-opt:hover { background: #F5F1F3; }
        .ep-status-opt--sel { background: #FCE0E9; color: #993556; }
        .ep-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Botão Cancelar Pedido */
        .ep-cancelar-btn {
          all: unset;
          box-sizing: border-box;
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          margin-top: 10px;
          border: 1.5px solid #FCEBEB;
          border-radius: 12px;
          cursor: pointer;
          background: #FEF2F2;
          transition: background 0.15s, border-color 0.15s;
        }
        .ep-cancelar-btn:hover { background: #FCEBEB; border-color: #F09595; }
        .ep-cancelar-ic {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #FCEBEB;
          color: #B91C1C;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .ep-cancelar-txt {
          font-size: 14px;
          font-weight: 700;
          color: #B91C1C;
          letter-spacing: -0.01em;
        }

        /* Toggle 2 (Entrega/Retirada) */
        .ep-toggle-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .ep-toggle-opt {
          all: unset;
          box-sizing: border-box;
          padding: 14px 12px;
          border: 1.5px solid #E8E5DC;
          border-radius: 12px;
          text-align: center;
          font-size: 14px;
          font-weight: 600;
          color: #5F5E5A;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #fff;
          transition: all 0.15s;
        }
        .ep-toggle-opt:hover { border-color: #B4B2A9; }
        .ep-toggle-opt--sel {
          border-color: #E85A8C;
          background: #FDF3F7;
          color: #E85A8C;
          font-weight: 700;
        }

        /* Endereço */
        .ep-endereco { margin-top: 14px; }

        /* Quick chips (Hoje / Amanhã) */
        .ep-quick-chips {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }
        .ep-chip {
          all: unset;
          padding: 6px 14px;
          border: 1px solid #E8E5DC;
          border-radius: 999px;
          font-size: 12.5px;
          font-weight: 600;
          color: #5F5E5A;
          cursor: pointer;
          background: #fff;
          transition: all 0.15s;
        }
        .ep-chip:hover { background: #F5F1F3; }
        .ep-chip--sel {
          background: #FCE0E9;
          color: #993556;
          border-color: #F4C0D1;
        }

        /* ── FOOTER ────────────────────────────────────────────────── */
        .ep-footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 20;
          background: #fff;
          border-top: 1px solid #F1EFE8;
          padding: 12px 12px calc(12px + env(safe-area-inset-bottom, 0px));
          box-shadow: 0 -4px 12px rgba(0,0,0,0.04);
        }
        .ep-footer-total {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .ep-footer-total-label {
          font-size: 13px;
          color: #5F5E5A;
          font-weight: 600;
        }
        .ep-footer-total-val {
          font-size: 18px;
          font-weight: 800;
          color: #2C2C2A;
          letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums;
        }
        .ep-footer-btns {
          display: grid;
          grid-template-columns: 1fr 1.4fr;
          gap: 8px;
        }
        .ep-btn {
          all: unset;
          box-sizing: border-box;
          text-align: center;
          padding: 12px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.01em;
          cursor: pointer;
          transition: background 0.15s, opacity 0.15s;
        }
        .ep-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ep-btn--ghost { background: #F1EFE8; color: #2C2C2A; }
        .ep-btn--ghost:hover:not(:disabled) { background: #E8E5DC; }
        .ep-btn--primary { background: #E85A8C; color: #fff; }
        .ep-btn--primary:hover:not(:disabled) { background: #C33A6E; }

        /* ── MODAL CLIENTE ─────────────────────────────────────────── */
        .ep-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(20, 15, 18, 0.45);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          animation: epFadeIn 0.18s ease-out;
        }
        @keyframes epFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .ep-modal {
          width: 100%;
          max-width: 480px;
          background: #fff;
          border-radius: 20px 20px 0 0;
          padding: 16px calc(16px + env(safe-area-inset-bottom, 0px));
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          animation: epSheetIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        @keyframes epSheetIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .ep-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .ep-modal-title {
          font-size: 16px;
          font-weight: 700;
          color: #2C2C2A;
          margin: 0;
          letter-spacing: -0.01em;
        }
        .ep-modal-close {
          all: unset;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #5F5E5A;
          cursor: pointer;
          transition: background 0.15s;
        }
        .ep-modal-close:hover { background: #F5F1F3; }
        .ep-modal-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border: 1.5px solid #E8E5DC;
          border-radius: 12px;
          color: #888780;
          margin-bottom: 12px;
        }
        .ep-modal-search:focus-within { border-color: #E85A8C; color: #E85A8C; }
        .ep-modal-search-input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 14px;
          color: #2C2C2A;
          background: transparent;
          font-family: var(--font-base) !important;
        }
        .ep-modal-lista {
          flex: 1;
          overflow-y: auto;
          overscroll-behavior: contain;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-height: 200px;
        }
        .ep-modal-item {
          all: unset;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.12s;
        }
        .ep-modal-item:hover { background: #F5F1F3; }
        .ep-modal-item-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #FCE0E9;
          color: #993556;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 13px;
          flex-shrink: 0;
        }
        .ep-modal-item-info { flex: 1; min-width: 0; }
        .ep-modal-item-nome {
          font-size: 14px;
          font-weight: 700;
          color: #2C2C2A;
          letter-spacing: -0.01em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ep-modal-item-sub {
          font-size: 12.5px;
          color: #888780;
          margin-top: 2px;
        }
        .ep-modal-empty {
          text-align: center;
          font-size: 13px;
          color: #888780;
          padding: 20px;
          font-style: italic;
        }

        /* Placeholder de fase */
        .ep-placeholder {
          background: #fff;
          border: 1px dashed #E8E5DC;
          border-radius: 14px;
          padding: 32px 20px;
          text-align: center;
        }
        .ep-placeholder-t {
          font-size: 15px;
          font-weight: 700;
          color: #2C2C2A;
          margin: 0 0 6px;
        }
        .ep-placeholder-d {
          font-size: 13px;
          color: #888780;
          margin: 0;
        }
      `}</style>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// PLACEHOLDER TEMPORÁRIO (fases 3-5)
// ═════════════════════════════════════════════════════════════════════════════
function TabPlaceholder({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="ep-placeholder">
      <p className="ep-placeholder-t">{titulo}</p>
      <p className="ep-placeholder-d">{descricao}</p>
    </div>
  )
}

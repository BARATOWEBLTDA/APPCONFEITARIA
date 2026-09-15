// ── EditarPedido.tsx ─────────────────────────────────────────────────────────
// Tela de edição de pedido — design novo estilo Dora
// FASE 1: casca (header + tabs + footer)
// FASE 2: tab Cliente completa
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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

interface Produto {
  id: string
  nome: string
  preco_normal: number
  forma_venda?: string
  imagem_url?: string
  categoria?: string
}

type Tab = 'cliente' | 'itens' | 'valores' | 'pagar'
type SituacaoPag = 'total' | 'parcial' | 'fiado'

interface HistoricoEvento {
  id: string
  evento: string
  descricao?: string
  created_at: string
}

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

// Máscara ao digitar: "150" → 1,50 / "1500" → 15,00
const parseMaskMoney = (s: string): number => {
  const digits = s.replace(/\D/g, '')
  if (!digits) return 0
  return parseInt(digits) / 100
}
const formatMaskMoney = (v: number): string => {
  if (!v) return ''
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
// TIMELINE HELPERS (Fase 7)
// ═════════════════════════════════════════════════════════════════════════════

// Mapa: status → evento(s) na tabela pedido_historico que indicam esse passo
const EVENTO_MAP: Record<string, string[]> = {
  criado: ['Pedido criado', 'criado'],
  aguardando_pagamento: ['Aguardando pagamento', 'pagamento_pendente'],
  aguardando_aceite: ['Aguardando aceite', 'aceite_pendente'],
  agendado: ['Agendado', 'aceito', 'Pedido aprovado'],
  em_producao: ['Em produção', 'producao_iniciada'],
  finalizado: ['Finalizado', 'producao_finalizada'],
  aguardando_retirada: ['Aguardando retirada', 'pronto'],
  em_entrega: ['Em entrega', 'saiu_entrega'],
  entregue: ['Entregue', 'concluido'],
}

// Ordem visual dos passos por tipo de entrega
const PASSOS_RETIRADA = ['criado', 'aguardando_aceite', 'agendado', 'em_producao', 'finalizado', 'aguardando_retirada', 'entregue']
const PASSOS_ENTREGA  = ['criado', 'aguardando_aceite', 'agendado', 'em_producao', 'finalizado', 'em_entrega', 'entregue']

const LABEL_PASSO: Record<string, string> = {
  criado: 'Pedido Criado',
  aguardando_pagamento: 'Aguardando Pagamento',
  aguardando_aceite: 'Aguardando Aceite',
  agendado: 'Agendado',
  em_producao: 'Em Produção',
  finalizado: 'Finalizado',
  aguardando_retirada: 'Pronto para Retirada',
  em_entrega: 'Saiu para Entrega',
  entregue: 'Entregue',
}

// Retorna a posição do status atual na sequência (pra saber o que já passou)
function posicaoStatus(status: string, sequencia: string[]): number {
  const map: Record<string, string> = {
    aguardando_pagamento: 'aguardando_aceite', // colapsa se não tem aguardando_pagamento na sequência
    novo: 'criado',
    confirmado: 'agendado',
  }
  const chave = map[status] || status
  return sequencia.indexOf(chave)
}

// Formata data completa dd/mm às HH:MM
function formatDataCompleta(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const h = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${dia}/${mes} às ${h}`
}

// "há 2 horas", "há 3 minutos", "há 5 dias"
function tempoRelativo(iso?: string): string {
  if (!iso) return ''
  const agora = Date.now()
  const t = new Date(iso).getTime()
  const diff = agora - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora mesmo'
  if (min < 60) return `há ${min} ${min === 1 ? 'minuto' : 'minutos'}`
  const h = Math.floor(min / 60)
  if (h < 24) return `há cerca de ${h} ${h === 1 ? 'hora' : 'horas'}`
  const d = Math.floor(h / 24)
  if (d < 30) return `há ${d} ${d === 1 ? 'dia' : 'dias'}`
  const m = Math.floor(d / 30)
  return `há ${m} ${m === 1 ? 'mês' : 'meses'}`
}

// Pedido está atrasado? Data de entrega + hora já passou e não foi entregue
function pedidoAtrasado(dataEntrega?: string, horaEntrega?: string, status?: string): boolean {
  if (!dataEntrega) return false
  if (status === 'entregue' || status === 'cancelado') return false
  const dataStr = `${dataEntrega}T${(horaEntrega || '23:59').slice(0, 5)}`
  const alvo = new Date(dataStr).getTime()
  return Date.now() > alvo
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
  const [salvouOk, setSalvouOk] = useState(false)
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

  // ── Itens editáveis + produtos disponíveis ────────────────────────────
  const [itens, setItens] = useState<PedidoItem[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [modalProduto, setModalProduto] = useState(false)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null)
  const [catDropdownAberto, setCatDropdownAberto] = useState(false)

  // ── Valores (Fase 4) ──────────────────────────────────────────────────
  const [desconto, setDesconto] = useState(0)
  const [acrescimo, setAcrescimo] = useState(0)
  const [taxaEntrega, setTaxaEntrega] = useState(0)

  // ── Pagamento (Fase 5) ────────────────────────────────────────────────
  const [formaPagamento, setFormaPagamento] = useState('PIX')
  const [situacaoPag, setSituacaoPag] = useState<SituacaoPag>('total')
  const [valorParcial, setValorParcial] = useState(0)
  const [dataPrevistaPagamento, setDataPrevistaPagamento] = useState('')

  // ── Modais ────────────────────────────────────────────────────────────
  const [modalCliente, setModalCliente] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [buscaCliente, setBuscaCliente] = useState('')
  const [statusDropdownAberto, setStatusDropdownAberto] = useState(false)
  const [horaSheetAberto, setHoraSheetAberto] = useState(false)

  // ── Timeline (Fase 7) ─────────────────────────────────────────────────
  const [timelineAberto, setTimelineAberto] = useState(false)
  const [historico, setHistorico] = useState<HistoricoEvento[]>([])
  const [historicoCarregando, setHistoricoCarregando] = useState(false)

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
      // Popular valores (Fase 4)
      setDesconto(p.desconto || 0)
      setTaxaEntrega(p.taxa_entrega || 0)
      // acrescimo não é salvo separado na tabela hoje — se um dia for, popula aqui
      // Popular pagamento (Fase 5)
      setFormaPagamento(p.forma_pagamento || 'PIX')
      if (p.status_pagamento === 'pendente') {
        setSituacaoPag('fiado')
        setValorParcial(0)
      } else if (p.status_pagamento === 'parcial') {
        setSituacaoPag('parcial')
        setValorParcial(p.valor_recebido || 0)
      } else {
        setSituacaoPag('total')
        setValorParcial(0)
      }
      setDataPrevistaPagamento(p.data_prevista_pagamento || '')
      // Popular itens editáveis
      setItens((p.pedido_itens || []).map(it => ({
        id: it.id,
        produto_id: it.produto_id,
        nome_produto: it.nome_produto,
        quantidade: it.quantidade,
        valor_unitario: it.valor_unitario,
        observacoes: it.observacoes || '',
        imagem_url: it.imagem_url || null,
      })))
      // Carregar lista de clientes + produtos
      if (user?.user) {
        const [{ data: cls }, { data: prds }] = await Promise.all([
          supabase.from('clientes').select('id,nome,telefone,whatsapp,rua,numero,bairro,cidade,complemento').eq('user_id', user.user.id).order('nome'),
          supabase.from('produtos').select('id,nome,preco_normal,forma_venda,imagem_url,categoria').eq('user_id', user.user.id).order('nome'),
        ])
        if (!cancelado) {
          setClientes(cls || [])
          setProdutos(prds || [])
        }
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

  // ── Timeline: trava scroll do body + carrega histórico ao abrir ───────
  useEffect(() => {
    if (!timelineAberto) return
    // Trava scroll
    const scrollY = window.scrollY
    const original = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    }
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    // Carrega histórico se ainda não carregou
    ;(async () => {
      if (!pedido?.id) return
      setHistoricoCarregando(true)
      const { data } = await supabase
        .from('pedido_historico')
        .select('id, evento, descricao, created_at')
        .eq('pedido_id', pedido.id)
        .order('created_at', { ascending: true })
      setHistorico((data as HistoricoEvento[]) || [])
      setHistoricoCarregando(false)
    })()
    return () => {
      document.body.style.overflow = original.overflow
      document.body.style.position = original.position
      document.body.style.top = original.top
      document.body.style.width = original.width
      window.scrollTo(0, scrollY)
    }
  }, [timelineAberto, pedido?.id])

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
    if (salvando) return
    setSalvando(true)

    try {
      // Validação básica
      if (itens.length === 0) {
        alert('Adicione pelo menos um item ao pedido antes de salvar.')
        setSalvando(false)
        return
      }
      if (!dataEntrega) {
        alert('Informe a data de entrega antes de salvar.')
        setSalvando(false)
        return
      }

      // Derivar status_pagamento e valor_recebido a partir da situação escolhida
      let statusPag: string
      let valorRecebido: number
      if (situacaoPag === 'fiado') {
        statusPag = 'pendente'
        valorRecebido = 0
      } else if (situacaoPag === 'parcial') {
        statusPag = 'parcial'
        valorRecebido = Math.min(valorParcial, total)
      } else {
        statusPag = 'pago'
        valorRecebido = total
      }

      // Recalcular valor dos produtos (soma bruta dos itens)
      const valorProdutos = itens.reduce((acc, it) => acc + (it.valor_unitario || 0) * (it.quantidade || 1), 0)

      // ── 1) UPDATE do pedido ─────────────────────────────────────────
      const { error: errPedido } = await supabase
        .from('pedidos')
        .update({
          cliente_id: clienteId,
          cliente_nome: clienteNome,
          cliente_telefone: clienteTelefone,
          status: statusPedido,
          status_pagamento: statusPag,
          valor_recebido: valorRecebido,
          valor_total: total,
          valor_produtos: valorProdutos,
          desconto: desconto,
          taxa_entrega: tipoEntrega === 'entrega' ? taxaEntrega : 0,
          forma_pagamento: formaPagamento,
          tipo_entrega: tipoEntrega,
          data_entrega: dataEntrega,
          horario_entrega: horarioEntrega || null,
          endereco_rua: tipoEntrega === 'entrega' ? enderecoRua : '',
          endereco_numero: tipoEntrega === 'entrega' ? enderecoNumero : '',
          endereco_bairro: tipoEntrega === 'entrega' ? enderecoBairro : '',
          endereco_cidade: tipoEntrega === 'entrega' ? enderecoCidade : '',
          endereco_complemento: tipoEntrega === 'entrega' ? enderecoComplemento : '',
          data_prevista_pagamento: situacaoPag === 'fiado' ? (dataPrevistaPagamento || null) : null,
        })
        .eq('id', pedido!.id)

      if (errPedido) {
        console.error('Erro ao atualizar pedido:', errPedido)
        alert('Não foi possível salvar as alterações do pedido: ' + errPedido.message)
        setSalvando(false)
        return
      }

      // ── 2) Substituir itens: DELETE tudo → INSERT tudo ──────────────
      const { error: errDel } = await supabase.from('pedido_itens').delete().eq('pedido_id', pedido!.id)
      if (errDel) {
        console.error('Erro ao remover itens antigos:', errDel)
        alert('O pedido foi salvo, mas houve problema ao atualizar os itens: ' + errDel.message)
        setSalvando(false)
        return
      }

      if (itens.length > 0) {
        const itensInsert = itens.map(it => ({
          pedido_id: pedido!.id,
          produto_id: it.produto_id || null,
          nome_produto: it.nome_produto,
          quantidade: it.quantidade,
          valor_unitario: it.valor_unitario,
          observacoes: it.observacoes || '',
          imagem_url: it.imagem_url || null,
        }))
        const { error: errIns } = await supabase.from('pedido_itens').insert(itensInsert)
        if (errIns) {
          console.error('Erro ao inserir itens:', errIns)
          alert('O pedido foi salvo, mas houve problema ao gravar os itens: ' + errIns.message)
          setSalvando(false)
          return
        }
      }

      // Sucesso
      setSalvouOk(true)
      // Volta pra listagem depois de mostrar o feedback
      setTimeout(() => {
        navigate('/pedidos')
      }, 700)
    } catch (err: any) {
      console.error('Erro inesperado ao salvar:', err)
      alert('Erro inesperado ao salvar: ' + (err?.message || 'desconhecido'))
      setSalvando(false)
    }
  }

  // ── Handlers de itens ─────────────────────────────────────────────────
  const addItem = (p: Produto) => {
    setItens(prev => [...prev, {
      produto_id: p.id,
      nome_produto: p.nome,
      quantidade: 1,
      valor_unitario: p.preco_normal || 0,
      observacoes: '',
      imagem_url: p.imagem_url || null,
    }])
    setModalProduto(false)
    setBuscaProduto('')
    setCatDropdownAberto(false)
  }

  const removerItem = (idx: number) => {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  const updateQtd = (idx: number, delta: number) => {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, quantidade: Math.max(1, it.quantidade + delta) } : it))
  }

  const setQtdManual = (idx: number, valor: number) => {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, quantidade: Math.max(1, Math.floor(valor) || 1) } : it))
  }

  // ── Derivados pro header ──────────────────────────────────────────────
  const subtotalItens = itens.reduce((acc, it) => acc + (it.valor_unitario || 0) * (it.quantidade || 1), 0)
  const totalItens = itens.length
  // Total calculado: subtotal + taxa (se entrega) − desconto + acréscimo
  const total = Math.max(0, subtotalItens + (tipoEntrega === 'entrega' ? taxaEntrega : 0) - desconto + acrescimo)
  const origemLabel = pedido?.origem === 'cardapio' ? 'Cardápio' : 'Manual'
  const tipoEntregaIcon = tipoEntrega === 'entrega' ? I.truck : I.home

  // Categorias derivadas dos produtos
  const categoriasComContagem: { nome: string; count: number }[] = (() => {
    const map: Record<string, number> = {}
    produtos.forEach(p => {
      const c = (p.categoria || '').trim()
      if (!c) return
      map[c] = (map[c] || 0) + 1
    })
    return Object.entries(map).map(([nome, count]) => ({ nome, count })).sort((a, b) => a.nome.localeCompare(b.nome))
  })()

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
            <button className="ep-icon-btn" onClick={() => setTimelineAberto(true)} aria-label="Timeline" title="Acompanhar pedido">
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

        {tab === 'itens' && (
          <div className="ep-tab-content">
            <div className="ep-section">
              <div className="ep-section-title">
                <I.box />
                Itens do Pedido {totalItens > 0 && <span className="ep-section-count">({totalItens})</span>}
              </div>

              {itens.length === 0 ? (
                <div className="ep-itens-vazio">
                  <div className="ep-itens-vazio-ic"><I.box /></div>
                  <p className="ep-itens-vazio-t">Nenhum item ainda</p>
                  <p className="ep-itens-vazio-d">Adicione produtos ao pedido tocando no botão abaixo.</p>
                </div>
              ) : (
                <div className="ep-itens-lista">
                  {itens.map((it, idx) => (
                    <div key={idx} className="ep-item-card">
                      <div className="ep-item-foto">
                        {it.imagem_url ? <img src={it.imagem_url} alt={it.nome_produto} /> : <span>🎂</span>}
                      </div>
                      <div className="ep-item-info">
                        <div className="ep-item-nome">{toTitleCase(it.nome_produto)}</div>
                        <div className="ep-item-preco">{formatMoney(it.valor_unitario)} <span className="ep-item-x">×</span> {it.quantidade}</div>
                        <div className="ep-item-subtotal">{formatMoney((it.valor_unitario || 0) * (it.quantidade || 1))}</div>
                      </div>
                      <div className="ep-item-acoes">
                        <div className="ep-qtd-wrap">
                          <button
                            type="button"
                            className="ep-qtd-btn"
                            onClick={() => updateQtd(idx, -1)}
                            disabled={it.quantidade <= 1}
                            aria-label="Diminuir"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            className="ep-qtd-input"
                            value={it.quantidade}
                            min={1}
                            onChange={e => setQtdManual(idx, Number(e.target.value))}
                          />
                          <button type="button" className="ep-qtd-btn" onClick={() => updateQtd(idx, +1)} aria-label="Aumentar">
                            +
                          </button>
                        </div>
                        <button type="button" className="ep-item-remover" onClick={() => removerItem(idx)} aria-label="Remover item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button type="button" className="ep-add-item" onClick={() => setModalProduto(true)}>
                <span className="ep-add-item-ic">+</span>
                Adicionar item
              </button>

              {itens.length > 0 && (
                <div className="ep-subtotal-row">
                  <span>Subtotal dos itens</span>
                  <span className="ep-subtotal-val">{formatMoney(subtotalItens)}</span>
                </div>
              )}
            </div>
          </div>
        )}
        {tab === 'valores' && (
          <div className="ep-tab-content">
            <div className="ep-section">
              <div className="ep-section-title">
                <I.dollar />
                Valores
              </div>

              {/* Subtotal — read-only vindo dos itens */}
              <div className="ep-val-row ep-val-row--readonly">
                <div className="ep-val-label">
                  <span className="ep-val-label-t">Subtotal dos itens</span>
                  <span className="ep-val-label-d">{totalItens} {totalItens === 1 ? 'item' : 'itens'} no pedido</span>
                </div>
                <span className="ep-val-num">{formatMoney(subtotalItens)}</span>
              </div>

              {/* Taxa de entrega — só se for entrega */}
              {tipoEntrega === 'entrega' && (
                <div className="ep-val-row">
                  <div className="ep-val-label">
                    <span className="ep-val-label-t">Taxa de entrega</span>
                    <span className="ep-val-label-d">Adicionado ao total</span>
                  </div>
                  <div className="ep-val-input-wrap">
                    <span className="ep-val-input-prefix">R$</span>
                    <input
                      className="ep-val-input"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={formatMaskMoney(taxaEntrega)}
                      onChange={e => setTaxaEntrega(parseMaskMoney(e.target.value))}
                    />
                  </div>
                </div>
              )}

              {/* Desconto */}
              <div className="ep-val-row">
                <div className="ep-val-label">
                  <span className="ep-val-label-t">Desconto</span>
                  <span className="ep-val-label-d">Subtraído do total</span>
                </div>
                <div className="ep-val-input-wrap ep-val-input-wrap--minus">
                  <span className="ep-val-input-prefix">− R$</span>
                  <input
                    className="ep-val-input"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={formatMaskMoney(desconto)}
                    onChange={e => setDesconto(parseMaskMoney(e.target.value))}
                  />
                </div>
              </div>

              {/* Acréscimo */}
              <div className="ep-val-row">
                <div className="ep-val-label">
                  <span className="ep-val-label-t">Acréscimo</span>
                  <span className="ep-val-label-d">Adicionado ao total</span>
                </div>
                <div className="ep-val-input-wrap ep-val-input-wrap--plus">
                  <span className="ep-val-input-prefix">+ R$</span>
                  <input
                    className="ep-val-input"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={formatMaskMoney(acrescimo)}
                    onChange={e => setAcrescimo(parseMaskMoney(e.target.value))}
                  />
                </div>
              </div>

              {/* Resumo do cálculo */}
              <div className="ep-val-resumo">
                <div className="ep-val-resumo-row">
                  <span>Subtotal</span>
                  <span>{formatMoney(subtotalItens)}</span>
                </div>
                {tipoEntrega === 'entrega' && taxaEntrega > 0 && (
                  <div className="ep-val-resumo-row">
                    <span>Taxa de entrega</span>
                    <span>+ {formatMoney(taxaEntrega)}</span>
                  </div>
                )}
                {desconto > 0 && (
                  <div className="ep-val-resumo-row ep-val-resumo-row--neg">
                    <span>Desconto</span>
                    <span>− {formatMoney(desconto)}</span>
                  </div>
                )}
                {acrescimo > 0 && (
                  <div className="ep-val-resumo-row">
                    <span>Acréscimo</span>
                    <span>+ {formatMoney(acrescimo)}</span>
                  </div>
                )}
                <div className="ep-val-resumo-total">
                  <span>Total</span>
                  <span>{formatMoney(total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {tab === 'pagar' && (
          <div className="ep-tab-content">

            {/* ─── SEÇÃO: Forma de Pagamento ─── */}
            <div className="ep-section">
              <div className="ep-section-title">
                <I.card />
                Forma de Pagamento
              </div>

              <div className="ep-pag-formas">
                {[
                  { key: 'PIX',      label: 'PIX',      svg: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15c1 0 3 0 5-2s3-3 4-3 2 0 4 2 4 3 5 3"/><path d="M4 9c1 0 3 0 5 2s3 3 4 3 2 0 4-2 4-3 5-3"/></svg>) },
                  { key: 'Dinheiro', label: 'Dinheiro', svg: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 6v.01M18 18v.01"/></svg>) },
                  { key: 'Cartão',   label: 'Cartão',   svg: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>) },
                  { key: 'Boleto',   label: 'Boleto',   svg: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="1"/><line x1="8" y1="4" x2="8" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="16" y1="4" x2="16" y2="20"/></svg>) },
                ].map(f => (
                  <button
                    key={f.key}
                    type="button"
                    className={`ep-pag-forma ${formaPagamento === f.key ? 'ep-pag-forma--sel' : ''}`}
                    onClick={() => setFormaPagamento(f.key)}
                  >
                    <span className="ep-pag-forma-ic">{f.svg}</span>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── SEÇÃO: Situação do Pagamento ─── */}
            <div className="ep-section">
              <div className="ep-section-title">
                <I.dollar />
                Situação do Pagamento
              </div>

              <div className="ep-pag-sits">
                {/* PAGO */}
                <button
                  type="button"
                  className={`ep-pag-sit ${situacaoPag === 'total' ? 'ep-pag-sit--sel ep-pag-sit--sel-total' : ''}`}
                  onClick={() => setSituacaoPag('total')}
                >
                  <div className="ep-pag-sit-radio" />
                  <div className="ep-pag-sit-info">
                    <div className="ep-pag-sit-t">Pago total</div>
                    <div className="ep-pag-sit-d">Cliente já pagou o valor completo</div>
                  </div>
                  <div className="ep-pag-sit-badge ep-pag-sit-badge--green">Pago</div>
                </button>

                {/* PARCIAL */}
                <button
                  type="button"
                  className={`ep-pag-sit ${situacaoPag === 'parcial' ? 'ep-pag-sit--sel ep-pag-sit--sel-parcial' : ''}`}
                  onClick={() => setSituacaoPag('parcial')}
                >
                  <div className="ep-pag-sit-radio" />
                  <div className="ep-pag-sit-info">
                    <div className="ep-pag-sit-t">Pago parcial</div>
                    <div className="ep-pag-sit-d">Cliente pagou uma parte, resto fica pendente</div>
                  </div>
                  <div className="ep-pag-sit-badge ep-pag-sit-badge--amber">Parcial</div>
                </button>

                {situacaoPag === 'parcial' && (
                  <div className="ep-pag-sit-extra">
                    <label className="ep-label">Valor recebido</label>
                    <div className="ep-val-input-wrap">
                      <span className="ep-val-input-prefix">R$</span>
                      <input
                        className="ep-val-input"
                        inputMode="numeric"
                        placeholder="0,00"
                        value={formatMaskMoney(valorParcial)}
                        onChange={e => {
                          const v = parseMaskMoney(e.target.value)
                          // Não deixa valor recebido passar do total
                          setValorParcial(Math.min(v, total))
                        }}
                      />
                    </div>
                    {valorParcial > 0 && (
                      <div className="ep-pag-sit-info-row">
                        <span>Valor pendente</span>
                        <span className="ep-pag-sit-pendente">{formatMoney(Math.max(0, total - valorParcial))}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* FIADO */}
                <button
                  type="button"
                  className={`ep-pag-sit ${situacaoPag === 'fiado' ? 'ep-pag-sit--sel ep-pag-sit--sel-fiado' : ''}`}
                  onClick={() => setSituacaoPag('fiado')}
                >
                  <div className="ep-pag-sit-radio" />
                  <div className="ep-pag-sit-info">
                    <div className="ep-pag-sit-t">Fiado</div>
                    <div className="ep-pag-sit-d">Cliente vai pagar depois</div>
                  </div>
                  <div className="ep-pag-sit-badge ep-pag-sit-badge--red">Pendente</div>
                </button>

                {situacaoPag === 'fiado' && (
                  <div className="ep-pag-sit-extra">
                    <label className="ep-label">Data prevista de pagamento <span className="ep-label-opt">(opcional)</span></label>
                    <input
                      type="date"
                      className="ep-input"
                      value={dataPrevistaPagamento}
                      onChange={e => setDataPrevistaPagamento(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ─── SEÇÃO: Resumo ─── */}
            <div className="ep-section">
              <div className="ep-section-title">
                <I.card />
                Resumo do Pagamento
              </div>
              <div className="ep-pag-resumo">
                <div className="ep-pag-resumo-row">
                  <span>Forma</span>
                  <span className="ep-pag-resumo-val">{formaPagamento}</span>
                </div>
                <div className="ep-pag-resumo-row">
                  <span>Total do pedido</span>
                  <span className="ep-pag-resumo-val">{formatMoney(total)}</span>
                </div>
                <div className="ep-pag-resumo-row">
                  <span>Valor recebido</span>
                  <span className="ep-pag-resumo-val ep-pag-resumo-val--green">
                    {formatMoney(situacaoPag === 'total' ? total : situacaoPag === 'parcial' ? valorParcial : 0)}
                  </span>
                </div>
                <div className="ep-pag-resumo-row ep-pag-resumo-row--big">
                  <span>Valor pendente</span>
                  <span className="ep-pag-resumo-val ep-pag-resumo-val--pendente">
                    {formatMoney(situacaoPag === 'total' ? 0 : situacaoPag === 'parcial' ? Math.max(0, total - valorParcial) : total)}
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ═══ FOOTER STICKY ═══ */}
      <div className="ep-footer">
        <div className="ep-footer-total">
          <span className="ep-footer-total-label">Total:</span>
          <span className="ep-footer-total-val">{formatMoney(total)}</span>
        </div>
        <div className="ep-footer-btns">
          <button className="ep-btn ep-btn--ghost" onClick={() => navigate('/pedidos')} disabled={salvando || salvouOk}>
            Cancelar
          </button>
          <button
            className={`ep-btn ${salvouOk ? 'ep-btn--success' : 'ep-btn--primary'}`}
            onClick={handleSalvar}
            disabled={salvando || salvouOk}
          >
            {salvouOk ? (
              <span className="ep-btn-ok">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Salvo!
              </span>
            ) : salvando ? 'Salvando...' : 'Salvar Alterações'}
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

      {/* ═══ MODAL PRODUTO ═══ */}
      {modalProduto && (() => {
        const produtosFiltrados = produtos.filter(p => {
          const matchBusca = p.nome.toLowerCase().includes(buscaProduto.toLowerCase())
          const matchCat = !filtroCategoria || (p.categoria || '').trim() === filtroCategoria
          return matchBusca && matchCat
        })
        const labelFiltro = filtroCategoria || 'Todas'
        const temCategorias = categoriasComContagem.length > 0
        return (
          <div className="ep-modal-overlay" onClick={() => { setModalProduto(false); setCatDropdownAberto(false) }}>
            <div className="ep-modal" onClick={e => e.stopPropagation()}>
              <div className="ep-modal-header">
                <h3 className="ep-modal-title">Escolher produto</h3>
                <button className="ep-modal-close" onClick={() => setModalProduto(false)} aria-label="Fechar">
                  <I.x />
                </button>
              </div>

              <div className="ep-modal-search">
                <I.search />
                <input
                  className="ep-modal-search-input"
                  placeholder="Buscar produto..."
                  value={buscaProduto}
                  onChange={e => setBuscaProduto(e.target.value)}
                  autoFocus
                />
              </div>

              {temCategorias && (
                <div className="ep-cat-dropdown-wrap">
                  <button
                    type="button"
                    className={`ep-cat-dropdown-btn ${filtroCategoria ? 'ep-cat-dropdown-btn--ativo' : ''}`}
                    onClick={() => setCatDropdownAberto(o => !o)}
                  >
                    <span>{labelFiltro}</span>
                    <I.chevD />
                  </button>
                  {catDropdownAberto && (
                    <div className="ep-cat-dropdown-menu">
                      <button type="button" className={`ep-cat-dropdown-item ${!filtroCategoria ? 'ep-cat-dropdown-item--sel' : ''}`} onClick={() => { setFiltroCategoria(null); setCatDropdownAberto(false) }}>
                        <span>Todas</span>
                        <span className="ep-cat-dropdown-count">{produtos.length}</span>
                      </button>
                      {categoriasComContagem.map(c => (
                        <button key={c.nome} type="button" className={`ep-cat-dropdown-item ${filtroCategoria === c.nome ? 'ep-cat-dropdown-item--sel' : ''}`} onClick={() => { setFiltroCategoria(c.nome); setCatDropdownAberto(false) }}>
                          <span>{c.nome}</span>
                          <span className="ep-cat-dropdown-count">{c.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="ep-modal-lista">
                {produtosFiltrados.map(p => (
                  <button key={p.id} type="button" className="ep-prod-item" onClick={() => addItem(p)}>
                    <div className="ep-prod-item-img">
                      {p.imagem_url ? <img src={p.imagem_url} alt={p.nome} /> : <span>🎂</span>}
                    </div>
                    <div className="ep-prod-item-info">
                      <div className="ep-prod-item-nome">{toTitleCase(p.nome)}</div>
                      {p.categoria && <div className="ep-prod-item-cat">{p.categoria}</div>}
                    </div>
                    <div className="ep-prod-item-preco">{formatMoney(p.preco_normal)}</div>
                  </button>
                ))}
                {produtos.length === 0 && (
                  <p className="ep-modal-empty">Nenhum produto cadastrado. <a href="/produtos" style={{ color: '#E85A8C', fontWeight: 700 }}>Cadastrar produto</a></p>
                )}
                {produtos.length > 0 && produtosFiltrados.length === 0 && (
                  <p className="ep-modal-empty">Nenhum produto encontrado{buscaProduto ? ` com "${buscaProduto}"` : ''}</p>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ═══ TIMELINE SHEET (Fase 7) ═══ */}
      {timelineAberto && createPortal(
        (() => {
          const seq = tipoEntrega === 'entrega' ? PASSOS_ENTREGA : PASSOS_RETIRADA
          const posAtual = posicaoStatus(statusPedido, seq)
          // Map de status → data do evento (do histórico)
          const dataDoPasso: Record<string, string> = {}
          historico.forEach(h => {
            // Procura qual passo esse evento representa
            for (const [passo, aliases] of Object.entries(EVENTO_MAP)) {
              if (aliases.some(a => (h.evento || '').toLowerCase().includes(a.toLowerCase()))) {
                if (!dataDoPasso[passo]) dataDoPasso[passo] = h.created_at
              }
            }
          })
          // Se não tem "criado" no histórico, usa created_at do pedido
          if (!dataDoPasso.criado && pedido?.created_at) dataDoPasso.criado = pedido.created_at

          const atrasado = pedidoAtrasado(dataEntrega, horarioEntrega, statusPedido)

          return (
            <div className="ep-tl-overlay" onClick={() => setTimelineAberto(false)}>
              <div className="ep-tl-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="ep-tl-handle" />

                <div className="ep-tl-header">
                  <div className="ep-tl-title-wrap">
                    <I.clock />
                    <h3 className="ep-tl-title">Acompanhar Pedido</h3>
                  </div>
                  <button className="ep-tl-close" onClick={() => setTimelineAberto(false)} aria-label="Fechar">
                    <I.x />
                  </button>
                </div>

                {/* Card do pedido */}
                <div className="ep-tl-card">
                  <div className="ep-tl-card-ic">
                    <I.card />
                  </div>
                  <div>
                    <div className="ep-tl-card-num">Pedido #{pedido?.numero || '—'}</div>
                    {clienteNome && (
                      <div className="ep-tl-card-cli">
                        <I.user />
                        {toTitleCase(clienteNome)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status atual + previsão */}
                <div className="ep-tl-info-grid">
                  <div>
                    <div className="ep-tl-info-label">Status atual</div>
                    <div className="ep-tl-info-val">{(STATUS_CONFIG[statusPedido] || STATUS_CONFIG.agendado).label}</div>
                    {dataDoPasso[seq[posAtual] || 'criado'] && (
                      <div className="ep-tl-info-sub">{tempoRelativo(dataDoPasso[seq[posAtual] || 'criado'])}</div>
                    )}
                  </div>
                  <div>
                    <div className="ep-tl-info-label">{tipoEntrega === 'entrega' ? 'Entrega prevista' : 'Retirada prevista'}</div>
                    <div className="ep-tl-info-val">{formatDataHora(dataEntrega, horarioEntrega)}</div>
                    {atrasado && (
                      <div className="ep-tl-info-alerta">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/></svg>
                        Atrasado
                      </div>
                    )}
                  </div>
                </div>

                {/* Steps */}
                {historicoCarregando ? (
                  <div className="ep-tl-loading">
                    <div className="ep-spinner" />
                    <p>Carregando eventos...</p>
                  </div>
                ) : (
                  <div className="ep-tl-steps">
                    {seq.map((passo, i) => {
                      const feito = i <= posAtual
                      const atual = i === posAtual
                      const dataPasso = dataDoPasso[passo]
                      return (
                        <div key={passo} className={`ep-tl-step ${feito ? 'ep-tl-step--feito' : 'ep-tl-step--pendente'} ${atual ? 'ep-tl-step--atual' : ''}`}>
                          <div className="ep-tl-step-col">
                            <div className="ep-tl-step-dot">
                              {feito ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              ) : null}
                            </div>
                            {i < seq.length - 1 && <div className="ep-tl-step-linha" />}
                          </div>
                          <div className="ep-tl-step-info">
                            <div className="ep-tl-step-row">
                              <div className="ep-tl-step-label">{LABEL_PASSO[passo]}</div>
                              {dataPasso && <div className="ep-tl-step-data">{formatDataCompleta(dataPasso)}</div>}
                            </div>
                            {atual && !dataPasso && (
                              <div className="ep-tl-step-sub">Status atual</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })(),
        document.body
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
        .ep-label-opt { color: #B4B2A9; font-weight: 500; }

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
        .ep-btn--success {
          background: #0F6E56;
          color: #fff;
          opacity: 1 !important;
          cursor: default;
        }
        .ep-btn-ok {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          justify-content: center;
        }

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

        /* ── FASE 7: TIMELINE ─────────────────────────────────────── */
        .ep-tl-overlay {
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
        .ep-tl-sheet {
          width: 100%;
          max-width: 480px;
          background: #fff;
          border-radius: 20px 20px 0 0;
          padding: 8px 16px calc(24px + env(safe-area-inset-bottom, 0px));
          max-height: 88vh;
          overflow-y: auto;
          overscroll-behavior: contain;
          animation: epSheetIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .ep-tl-handle {
          width: 40px;
          height: 4px;
          background: #E8E5DC;
          border-radius: 999px;
          margin: 4px auto 12px;
        }
        .ep-tl-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .ep-tl-title-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #2C2C2A;
        }
        .ep-tl-title {
          font-size: 17px;
          font-weight: 800;
          color: #2C2C2A;
          margin: 0;
          letter-spacing: -0.01em;
        }
        .ep-tl-close {
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
        .ep-tl-close:hover { background: #F5F1F3; }

        .ep-tl-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: #FAF8F5;
          border: 1px solid #F0EBED;
          border-radius: 12px;
          margin-bottom: 12px;
        }
        .ep-tl-card-ic {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: #F1EFE8;
          color: #5F5E5A;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .ep-tl-card-num {
          font-size: 15px;
          font-weight: 800;
          color: #2C2C2A;
          letter-spacing: -0.01em;
        }
        .ep-tl-card-cli {
          font-size: 12.5px;
          color: #888780;
          font-weight: 600;
          margin-top: 4px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .ep-tl-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          padding: 12px 4px;
          border-top: 1px solid #F1EFE8;
          border-bottom: 1px solid #F1EFE8;
          margin-bottom: 20px;
        }
        .ep-tl-info-label {
          font-size: 11.5px;
          color: #888780;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .ep-tl-info-val {
          font-size: 14px;
          font-weight: 800;
          color: #2C2C2A;
          letter-spacing: -0.01em;
          line-height: 1.25;
        }
        .ep-tl-info-sub {
          font-size: 11.5px;
          color: #888780;
          font-weight: 500;
          margin-top: 3px;
        }
        .ep-tl-info-alerta {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          margin-top: 4px;
          font-size: 11.5px;
          font-weight: 700;
          color: #B91C1C;
        }

        .ep-tl-loading {
          text-align: center;
          padding: 20px;
          color: #888780;
          font-size: 13px;
        }
        .ep-tl-loading .ep-spinner {
          margin: 0 auto 8px;
        }

        .ep-tl-steps {
          display: flex;
          flex-direction: column;
        }
        .ep-tl-step {
          display: flex;
          gap: 12px;
          min-height: 56px;
        }
        .ep-tl-step-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex-shrink: 0;
          padding-top: 2px;
        }
        .ep-tl-step-dot {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-weight: 800;
          transition: all 0.2s;
        }
        .ep-tl-step-linha {
          width: 2px;
          flex: 1;
          background: #E8E5DC;
          margin: 4px 0;
        }
        .ep-tl-step--feito .ep-tl-step-dot {
          background: #E1F5EE;
          color: #0F6E56;
        }
        .ep-tl-step--feito .ep-tl-step-linha {
          background: #C0DEC9;
        }
        .ep-tl-step--atual .ep-tl-step-dot {
          background: #FCE0E9;
          color: #E85A8C;
          box-shadow: 0 0 0 4px #FEF0F5;
        }
        .ep-tl-step--pendente .ep-tl-step-dot {
          background: #fff;
          border: 2px solid #E8E5DC;
          color: transparent;
        }

        .ep-tl-step-info {
          flex: 1;
          padding-bottom: 20px;
          min-width: 0;
        }
        .ep-tl-step:last-child .ep-tl-step-info {
          padding-bottom: 0;
        }
        .ep-tl-step-row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: flex-start;
        }
        .ep-tl-step-label {
          font-size: 14px;
          font-weight: 700;
          color: #2C2C2A;
          letter-spacing: -0.01em;
        }
        .ep-tl-step--pendente .ep-tl-step-label {
          color: #B4B2A9;
          font-weight: 600;
        }
        .ep-tl-step-data {
          font-size: 11.5px;
          color: #888780;
          font-weight: 600;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .ep-tl-step-sub {
          font-size: 11.5px;
          color: #E85A8C;
          font-weight: 700;
          margin-top: 2px;
        }

        /* ── FASE 5: TAB PAGAR ────────────────────────────────────── */
        .ep-pag-formas {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .ep-pag-forma {
          all: unset;
          box-sizing: border-box;
          padding: 14px 10px;
          border: 1.5px solid #E8E5DC;
          border-radius: 12px;
          text-align: center;
          font-size: 13.5px;
          font-weight: 700;
          color: #5F5E5A;
          cursor: pointer;
          background: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          transition: all 0.15s;
          letter-spacing: -0.01em;
        }
        .ep-pag-forma:hover { border-color: #B4B2A9; }
        .ep-pag-forma-ic {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #888780;
          transition: color 0.15s;
        }
        .ep-pag-forma--sel {
          border-color: #E85A8C;
          background: #FDF3F7;
          color: #E85A8C;
        }
        .ep-pag-forma--sel .ep-pag-forma-ic { color: #E85A8C; }

        .ep-pag-sits {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ep-pag-sit {
          all: unset;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border: 1.5px solid #E8E5DC;
          border-radius: 12px;
          cursor: pointer;
          background: #fff;
          transition: all 0.15s;
        }
        .ep-pag-sit:hover { border-color: #B4B2A9; }
        .ep-pag-sit-radio {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid #B4B2A9;
          flex-shrink: 0;
          position: relative;
          transition: all 0.15s;
        }
        .ep-pag-sit--sel { border-color: #E85A8C; }
        .ep-pag-sit--sel .ep-pag-sit-radio {
          border-color: #E85A8C;
        }
        .ep-pag-sit--sel .ep-pag-sit-radio::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          right: 3px;
          bottom: 3px;
          background: #E85A8C;
          border-radius: 50%;
        }
        .ep-pag-sit--sel-total { background: #F5FCF8; }
        .ep-pag-sit--sel-parcial { background: #FEFAEE; }
        .ep-pag-sit--sel-fiado { background: #FEF7F7; }
        .ep-pag-sit-info { flex: 1; min-width: 0; }
        .ep-pag-sit-t {
          font-size: 14px;
          font-weight: 700;
          color: #2C2C2A;
          letter-spacing: -0.01em;
        }
        .ep-pag-sit-d {
          font-size: 12px;
          color: #888780;
          font-weight: 500;
          margin-top: 2px;
        }
        .ep-pag-sit-badge {
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          flex-shrink: 0;
        }
        .ep-pag-sit-badge--green { background: #E1F5EE; color: #0F6E56; }
        .ep-pag-sit-badge--amber { background: #FEF0DF; color: #854F0B; }
        .ep-pag-sit-badge--red   { background: #FCEBEB; color: #791F1F; }

        .ep-pag-sit-extra {
          background: #FAF8F5;
          border: 1px solid #F0EBED;
          border-radius: 12px;
          padding: 14px;
          margin-top: -2px;
        }
        .ep-pag-sit-info-row {
          display: flex;
          justify-content: space-between;
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid #E8E5DC;
          font-size: 13px;
          color: #5F5E5A;
          font-weight: 600;
        }
        .ep-pag-sit-pendente {
          color: #B91C1C;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }

        .ep-pag-resumo {
          background: #FAF8F5;
          border: 1px solid #F0EBED;
          border-radius: 12px;
          padding: 14px;
        }
        .ep-pag-resumo-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          color: #5F5E5A;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .ep-pag-resumo-row:last-child { margin-bottom: 0; }
        .ep-pag-resumo-row--big {
          margin-top: 8px;
          padding-top: 10px;
          border-top: 1px solid #E8E5DC;
          font-size: 14px;
        }
        .ep-pag-resumo-val {
          color: #2C2C2A;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.01em;
        }
        .ep-pag-resumo-val--green { color: #0F6E56; }
        .ep-pag-resumo-val--pendente { color: #B91C1C; }

        /* ── FASE 4: TAB VALORES ──────────────────────────────────── */
        .ep-val-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #F1EFE8;
        }
        .ep-val-row:first-of-type { padding-top: 0; }
        .ep-val-row--readonly { background: transparent; }
        .ep-val-label { min-width: 0; }
        .ep-val-label-t {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: #2C2C2A;
          letter-spacing: -0.01em;
        }
        .ep-val-label-d {
          display: block;
          font-size: 11.5px;
          color: #888780;
          font-weight: 500;
          margin-top: 2px;
        }
        .ep-val-num {
          font-size: 15px;
          font-weight: 800;
          color: #2C2C2A;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.01em;
          flex-shrink: 0;
        }
        .ep-val-input-wrap {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border: 1.5px solid #E8E5DC;
          border-radius: 10px;
          background: #fff;
          transition: border-color 0.15s;
          flex-shrink: 0;
          width: 140px;
          box-sizing: border-box;
        }
        .ep-val-input-wrap:focus-within { border-color: #E85A8C; }
        .ep-val-input-wrap--minus { border-color: #F4C0D1; background: #FEF7FA; }
        .ep-val-input-wrap--minus:focus-within { border-color: #E85A8C; }
        .ep-val-input-wrap--plus { border-color: #B5D4F4; background: #F5FAFE; }
        .ep-val-input-wrap--plus:focus-within { border-color: #378ADD; }
        .ep-val-input-prefix {
          font-size: 12.5px;
          font-weight: 700;
          color: #888780;
          flex-shrink: 0;
          letter-spacing: -0.01em;
        }
        .ep-val-input-wrap--minus .ep-val-input-prefix { color: #C33A6E; }
        .ep-val-input-wrap--plus .ep-val-input-prefix { color: #185FA5; }
        .ep-val-input {
          width: 100%;
          min-width: 0;
          border: none;
          outline: none;
          text-align: right;
          font-size: 14px;
          font-weight: 700;
          color: #2C2C2A;
          background: transparent;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-base) !important;
          letter-spacing: -0.01em;
        }

        .ep-val-resumo {
          margin-top: 16px;
          padding: 14px;
          background: #FAF8F5;
          border: 1px solid #F0EBED;
          border-radius: 12px;
        }
        .ep-val-resumo-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: #5F5E5A;
          font-weight: 600;
          margin-bottom: 6px;
          font-variant-numeric: tabular-nums;
        }
        .ep-val-resumo-row--neg { color: #C33A6E; }
        .ep-val-resumo-total {
          display: flex;
          justify-content: space-between;
          font-size: 16px;
          font-weight: 800;
          color: #2C2C2A;
          margin-top: 8px;
          padding-top: 10px;
          border-top: 1px solid #E8E5DC;
          letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums;
        }
        .ep-section-count {
          font-size: 13px;
          font-weight: 600;
          color: #888780;
          margin-left: 4px;
        }
        .ep-itens-vazio {
          text-align: center;
          padding: 24px 12px;
          border: 1px dashed #E8E5DC;
          border-radius: 12px;
        }
        .ep-itens-vazio-ic {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #F5F1F3;
          color: #888780;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }
        .ep-itens-vazio-t {
          font-size: 14px;
          font-weight: 700;
          color: #2C2C2A;
          margin: 0 0 4px;
        }
        .ep-itens-vazio-d {
          font-size: 12.5px;
          color: #888780;
          margin: 0;
        }
        .ep-itens-lista {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ep-item-card {
          display: grid;
          grid-template-columns: 48px 1fr;
          gap: 12px;
          padding: 12px;
          border: 1px solid #F0EBED;
          border-radius: 12px;
          background: #FAF8F5;
        }
        .ep-item-foto {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          background: #F5F1F3;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          overflow: hidden;
          flex-shrink: 0;
        }
        .ep-item-foto img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .ep-item-info { min-width: 0; }
        .ep-item-nome {
          font-size: 14px;
          font-weight: 700;
          color: #2C2C2A;
          letter-spacing: -0.01em;
          line-height: 1.3;
        }
        .ep-item-preco {
          font-size: 12.5px;
          color: #888780;
          margin-top: 2px;
          font-variant-numeric: tabular-nums;
        }
        .ep-item-x {
          color: #B4B2A9;
          margin: 0 2px;
        }
        .ep-item-subtotal {
          font-size: 14px;
          font-weight: 800;
          color: #2C2C2A;
          margin-top: 4px;
          letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums;
        }
        .ep-item-acoes {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 4px;
        }
        .ep-qtd-wrap {
          display: flex;
          align-items: center;
          background: #fff;
          border: 1px solid #E8E5DC;
          border-radius: 10px;
          overflow: hidden;
        }
        .ep-qtd-btn {
          all: unset;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 700;
          color: #5F5E5A;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
        }
        .ep-qtd-btn:hover:not(:disabled) { background: #F5F1F3; color: #E85A8C; }
        .ep-qtd-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ep-qtd-input {
          width: 40px;
          border: none;
          outline: none;
          text-align: center;
          font-size: 14px;
          font-weight: 700;
          color: #2C2C2A;
          background: transparent;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-base) !important;
          -moz-appearance: textfield;
        }
        .ep-qtd-input::-webkit-outer-spin-button,
        .ep-qtd-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .ep-item-remover {
          all: unset;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          font-size: 12.5px;
          font-weight: 600;
          color: #B91C1C;
          cursor: pointer;
          border-radius: 8px;
          transition: background 0.15s;
        }
        .ep-item-remover:hover { background: #FEF2F2; }

        .ep-add-item {
          all: unset;
          box-sizing: border-box;
          width: 100%;
          margin-top: 12px;
          padding: 12px;
          border: 1.5px dashed #F4C0D1;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 700;
          color: #E85A8C;
          cursor: pointer;
          background: #FDF3F7;
          transition: background 0.15s, border-color 0.15s;
        }
        .ep-add-item:hover { background: #FCE0E9; border-color: #E85A8C; }
        .ep-add-item-ic {
          font-size: 18px;
          line-height: 1;
        }

        .ep-subtotal-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid #F1EFE8;
          font-size: 13px;
          color: #5F5E5A;
          font-weight: 600;
        }
        .ep-subtotal-val {
          font-size: 15px;
          font-weight: 800;
          color: #2C2C2A;
          letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums;
        }

        /* Categoria dropdown (modal produto) */
        .ep-cat-dropdown-wrap {
          position: relative;
          margin-bottom: 12px;
        }
        .ep-cat-dropdown-btn {
          all: unset;
          box-sizing: border-box;
          width: 100%;
          padding: 10px 14px;
          border: 1.5px solid #E8E5DC;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13.5px;
          font-weight: 600;
          color: #5F5E5A;
          cursor: pointer;
          background: #fff;
          transition: border-color 0.15s, color 0.15s;
        }
        .ep-cat-dropdown-btn:hover { border-color: #B4B2A9; }
        .ep-cat-dropdown-btn--ativo {
          border-color: #E85A8C;
          color: #E85A8C;
        }
        .ep-cat-dropdown-menu {
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
          max-height: 240px;
          overflow-y: auto;
        }
        .ep-cat-dropdown-item {
          all: unset;
          box-sizing: border-box;
          width: 100%;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #2C2C2A;
          cursor: pointer;
          transition: background 0.12s;
        }
        .ep-cat-dropdown-item:hover { background: #F5F1F3; }
        .ep-cat-dropdown-item--sel { background: #FCE0E9; color: #993556; }
        .ep-cat-dropdown-count {
          font-size: 11.5px;
          font-weight: 700;
          color: #888780;
          background: #F1EFE8;
          padding: 2px 8px;
          border-radius: 999px;
        }
        .ep-cat-dropdown-item--sel .ep-cat-dropdown-count {
          background: #fff;
          color: #993556;
        }

        /* Produto item no modal */
        .ep-prod-item {
          all: unset;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.12s;
        }
        .ep-prod-item:hover { background: #F5F1F3; }
        .ep-prod-item-img {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: #F5F1F3;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          overflow: hidden;
          flex-shrink: 0;
        }
        .ep-prod-item-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .ep-prod-item-info { flex: 1; min-width: 0; }
        .ep-prod-item-nome {
          font-size: 13.5px;
          font-weight: 700;
          color: #2C2C2A;
          letter-spacing: -0.01em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ep-prod-item-cat {
          font-size: 11.5px;
          color: #888780;
          margin-top: 1px;
        }
        .ep-prod-item-preco {
          font-size: 13.5px;
          font-weight: 800;
          color: #2C2C2A;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.01em;
          flex-shrink: 0;
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

import CalendarioSheet from '@/components/CalendarioSheet'
import CampoData from '@/components/CampoData'
import { DotsThree, Check, Heart, Plus, NotePencil, Trash, PencilSimple, ArrowUp, ArrowCounterClockwise, CalendarBlank, Image as ImageIcon, CaretRight, Phone, ArrowsDownUp, Cake } from '@phosphor-icons/react'
import IconeWhatsApp from '@/components/IconeWhatsApp'
import { type DialogoOpcoes, type IconeDialogo } from '@/components/DialogoApp'
import AppPageHeader from '@/components/AppPageHeader'
import { Botao, BotaoIcone, CampoArea, Janela, Linha, Titulo, avisar as avisarBase, confirmar, informar } from '@/components/base'
import { ArrowsLeftRight, Clock, CreditCard, DotsThreeVertical, Package, Truck, WhatsappLogo } from '@phosphor-icons/react'
import { SITUACOES, avisoDaMudanca, dataLonga, grupoDoStatus, nomeDaSituacao, nomeDeProduto } from '@/components/pedidos/pedidoTexto'
import { tocarSom } from '@/hooks/useSom'
import '@/components/pedidos/telaPedido.css'
import { Paperclip, MagnifyingGlassPlus, Quotes, MapPin, MapTrifold, Copy, Money, Storefront, Tag } from '@phosphor-icons/react'
import { CartProvider } from '@/context/CartContext'
import { ProductModal } from '@/components/cart/ProductModal'
import { itemDoCarrinhoParaPedido } from '@/lib/itemDoCarrinho'
import { carregarGruposDoBanco } from '@/lib/produto-grupos'
import { kitAtivo } from '@/lib/kitQuantidade'
import FinalizarPedidoSheet from '@/components/pedidos/FinalizarPedidoSheet'
import { ReceberSheet } from '@/pages/FinanceiroAReceber'
import Folha, { FOLHA_CSS } from '@/components/financeiro/Folha'
import { mascaraBRL, textoBRL, lerBRL } from '@/lib/moeda'
import { valorRecebidoPedido } from '@/lib/financeiroPedido'
import { useTravarRolagem } from '@/hooks/useTravarRolagem'
// ── EditarPedido.tsx ─────────────────────────────────────────────────────────
import { ajustarRecebido } from '@/lib/pagamentos'
import CampoNumero from "@/components/ui/CampoNumero"
import ReqTag from "@/components/ReqTag";
// Tela de edição de pedido — design novo estilo Dora
// FASE 1: casca (header + tabs + footer)
// FASE 2: tab Cliente completa
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { gerarPedidoPDF } from '@/lib/gerarPedidoPDF'
import HorarioSheet from '@/components/HorarioSheet'
import { criarBreakdownV1, criarPersonalizacoesV1, SNAPSHOT_VERSION_ATUAL } from '@/lib/pedido-snapshot'

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

type Tab = 'itens' | 'entrega' | 'pagamento'
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
/** "Sábado 10/10/26 às 14h" (minutos só quando tem: "às 14h30"). Sem data: "sem data". */
function quandoCabecalho(dataStr?: string | null, horaStr?: string | null): string {
  if (!dataStr) return 'sem data'
  const [y, m, d] = dataStr.slice(0, 10).split('-').map(Number)
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  const dia = DIAS[new Date(y, m - 1, d).getDay()]
  const data = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(y).slice(-2)}`
  if (!horaStr) return `${dia} ${data}`
  const [hh, mm] = horaStr.slice(0, 5).split(':')
  return `${dia} ${data} às ${Number(hh)}h${mm && mm !== '00' ? mm : ''}`
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
  const [recarga, setRecarga] = useState(0) // recarrega o pedido depois de salvar
  // abre na aba pedida pela lista ("Ver endereço" → ?aba=entrega)
  const [tab, setTab] = useState<Tab>(() => { const a = new URLSearchParams(window.location.search).get('aba'); return a === 'entrega' || a === 'pagamento' ? a : 'itens' })

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
  // Como o pagamento estava ao abrir — se ela não mexer no pagamento, o recebido é preservado (Passo 0)
  const pagInicialRef = useRef<{ situacao: SituacaoPag; parcial: number } | null>(null)
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

  // ── Cancelar pedido (Fase 8) ──────────────────────────────────────────
  const [cancelarAberto, setCancelarAberto] = useState(false)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [mostrarMotivoCliente, setMostrarMotivoCliente] = useState(false)
  const [cancelando, setCancelando] = useState(false)

  // ══════════════ Tela nova (03/10): etapas, pagamentos, ajustes e "alterações não salvas" ══════════════
  const [pagamentos, setPagamentos] = useState<any[]>([])
  const [pagamentosOk, setPagamentosOk] = useState(false) // a tabela de pagamentos existe (SQL do Passo 1)
  const [ajustesHist, setAjustesHist] = useState<any[]>([])
  const [ajustesPendentes, setAjustesPendentes] = useState<{ tipo: 'desconto' | 'acrescimo'; valor: number; motivo: string }[]>([])
  const [menuAberto, setMenuAberto] = useState(false)
  const [etapasAberto, setEtapasAberto] = useState(false)
  const [receberAberto, setReceberAberto] = useState(false)
  const [ajusteAberto, setAjusteAberto] = useState(false)
  const [finalizarAberto, setFinalizarAberto] = useState(false)
  const [devolverSinal, setDevolverSinal] = useState<boolean | null>(null)
  const [recadoEditando, setRecadoEditando] = useState<number | null>(null)
  // janela do app (no lugar do alert/confirm do navegador)
  // janelas do app (08/10 · 3.15): a de aviso e a de confirmar são as peças padrão
  const avisarJanela = (titulo: string, texto?: string, icone: IconeDialogo = 'alerta') => { informar({ titulo, texto, icone }) }
  const confirmarJanela = (o: DialogoOpcoes) => confirmar({ titulo: o.titulo, texto: o.texto, icone: o.icone, rotulo: o.rotuloConfirmar, perigo: o.perigo })
  // Excluir pedido (03/10): veio da janela da lista, que saiu; aqui fica longe do toque fácil
  const excluirPedido = async () => {
    const ok = await confirmarJanela({ titulo: `Excluir o pedido #${pedido?.numero ?? ''}?`, texto: 'Ele some da lista, da agenda e do financeiro. Não dá pra desfazer. Se a cliente só desistiu, prefira "Cancelar pedido".', icone: 'erro', rotuloConfirmar: 'Excluir', perigo: true })
    if (!ok || !pedido) return
    await supabase.from('pedido_itens').delete().eq('pedido_id', pedido.id)
    const { error } = await supabase.from('pedidos').delete().eq('id', pedido.id)
    if (error) { avisarJanela('Não foi possível excluir', 'Confira a internet e tente de novo. (' + error.message + ')', 'erro'); return }
    navigate('/pedidos')
  }
  const snapshotRef = useRef<string | null>(null)

  const carregarPagamentos = async (pid: string) => {
    const r = await supabase.from('pagamentos').select('id, valor, forma, tipo, recebido_em, estornado_em, created_at').eq('pedido_id', pid).order('created_at', { ascending: true })
    if (r.error) { setPagamentosOk(false); setPagamentos([]) } else { setPagamentosOk(true); setPagamentos((r.data as any[]) || []) }
    const a = await supabase.from('pedido_ajustes').select('tipo, valor, motivo, created_at').eq('pedido_id', pid).order('created_at', { ascending: true })
    setAjustesHist(a.error ? [] : ((a.data as any[]) || []))
  }
  // Depois de receber, estornar ou finalizar: lê de novo o que o banco calculou (o recebido é do banco)
  const recarregarDinheiro = async () => {
    if (!pedido) return
    const { data } = await supabase.from('pedidos').select('status, status_pagamento, valor_recebido, valor_total, desconto, acrescimo').eq('id', pedido.id).maybeSingle()
    if (data) {
      const d: any = data
      setPedido(p => p ? { ...p, ...d } : p)
      setStatusPedido(d.status || statusPedido)
      // o ajuste feito no "Finalizar pedido" mexe no desconto/acréscimo: a tela acompanha (sem virar "alteração")
      if (typeof d.desconto === 'number' || typeof d.acrescimo === 'number') {
        const novoDesc = Number(d.desconto) || 0, novoAcr = Number(d.acrescimo) || 0
        setDesconto(novoDesc); setAcrescimo(novoAcr)
        if (snapshotRef.current) { const s = JSON.parse(snapshotRef.current); s.desconto = novoDesc; s.acrescimo = novoAcr; snapshotRef.current = JSON.stringify(s) }
      }
    }
    await carregarPagamentos(pedido.id)
  }
  const avisar = (m: string) => avisarBase(m)

  // ── Itens (03/10): fechados com resumo, abrem ao tocar; remover com "Desfazer"; adicionar com opções ──
  const [itemMenu, setItemMenu] = useState<number | null>(null) // ⋯ de um item
  const num2 = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const [removido, setRemovido] = useState<{ item: any; idx: number } | null>(null)
  const removidoTimer = useRef<any>(null)
  const [produtoOpcoes, setProdutoOpcoes] = useState<any | null>(null)
  const removerComDesfazer = (idx: number) => {
    const item = itens[idx]
    setItens(prev => prev.filter((_, i) => i !== idx))
    setRemovido({ item, idx })
    clearTimeout(removidoTimer.current)
    removidoTimer.current = setTimeout(() => setRemovido(null), 6000)
  }
  const desfazerRemocao = () => {
    if (!removido) return
    setItens(prev => { const n = [...prev]; n.splice(Math.min(removido.idx, n.length), 0, removido.item); return n })
    setRemovido(null); clearTimeout(removidoTimer.current)
  }
  // foto do item: a do próprio item ou a do cadastro do produto
  // fotos dos produtos do próprio pedido (mesmo inativos ou fora da lista de adicionar)
  const [fotosProdutos, setFotosProdutos] = useState<Record<string, string>>({})
  const idsProdutosItens = [...new Set(itens.map((x: any) => x.produto_id).filter(Boolean))].sort().join(',')
  useEffect(() => {
    if (!idsProdutosItens) return
    ;(async () => {
      const { data } = await supabase.from('produtos').select('id, imagem_url').in('id', idsProdutosItens.split(','))
      const m: Record<string, string> = {}
      for (const p of (data as any[]) || []) if (p.imagem_url) m[p.id] = p.imagem_url
      setFotosProdutos(m)
    })()
  }, [idsProdutosItens])
  const fotoDoItem = (it: any): string | null => {
    const f = it.imagem_url || fotosProdutos[it.produto_id] || produtos.find(x => x.id === it.produto_id)?.imagem_url || ''
    return String(f).split(/,(?=\s*https?:)/).map(s => s.trim()).filter(Boolean)[0] || null // várias fotos separadas por vírgula: pega a primeira
  }
  // produto com opções (tamanho, recheios, kit…) abre a janela do cardápio; simples entra direto
  const escolherProduto = async (p: Produto) => {
    const { data } = await supabase.from('produtos').select('*').eq('id', p.id).maybeSingle()
    const completo: any = data || p
    const temOpcoes = carregarGruposDoBanco(completo).some(g => g.ativo && g.opcoes.length > 0) || kitAtivo(completo.kit_qtd)
    if (temOpcoes) { setModalProduto(false); setBuscaProduto(''); setCatDropdownAberto(false); setProdutoOpcoes(completo); return }
    addItem(p)
    avisar(`${p.nome} adicionado.`)
  }


  // ── Cartão da cliente (03/10): foto, cliente desde, nº de pedidos, gasto, último pedido e aniversário ──
  const [clienteInfo, setClienteInfo] = useState<{ foto: string | null; desde: string | null; nascimento: string | null; pedidos: number; gasto: number; ultimo: string | null } | null>(null)
  useEffect(() => {
    if (!clienteId) { setClienteInfo(null); return }
    let vivo = true
    ;(async () => {
      const [c, ps] = await Promise.all([
        supabase.from('clientes').select('foto_url, created_at, data_nascimento').eq('id', clienteId).maybeSingle(),
        supabase.from('pedidos').select('id, valor_total, status, data_entrega, created_at').eq('cliente_id', clienteId).neq('status', 'cancelado'),
      ])
      if (!vivo) return
      const outros = ((ps.data as any[]) || []).filter(x => x.id !== pedido?.id)
      const datas = outros.map(x => (x.data_entrega || x.created_at || '').slice(0, 10)).filter(Boolean).sort()
      setClienteInfo({
        foto: (c.data as any)?.foto_url || null, desde: (c.data as any)?.created_at || null, nascimento: (c.data as any)?.data_nascimento || null,
        pedidos: outros.length, gasto: outros.reduce((s, x) => s + (Number(x.valor_total) || 0), 0), ultimo: datas.length ? datas[datas.length - 1] : null,
      })
    })()
    return () => { vivo = false }
  }, [clienteId, pedido?.id])
  // aniversário nos próximos 15 dias (contando hoje)
  const aniversario = (() => {
    const n = clienteInfo?.nascimento; if (!n) return null
    const [, mm, dd] = n.slice(0, 10).split('-').map(Number); if (!mm || !dd) return null
    const h = new Date(); const hoje = new Date(h.getFullYear(), h.getMonth(), h.getDate())
    let prox = new Date(h.getFullYear(), mm - 1, dd); if (prox < hoje) prox = new Date(h.getFullYear() + 1, mm - 1, dd)
    const dias = Math.round((prox.getTime() - hoje.getTime()) / 86400000)
    return dias <= 15 ? { dias, data: `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}` } : null
  })()
  const desdeTxt = clienteInfo?.desde ? new Date(clienteInfo.desde).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('. de ', '/').replace(' de ', '/').replace('.', '') : ''
  const telDigitos = (clienteTelefone || '').replace(/\D/g, '')
  const nomeCurto = (n: string) => { const p = toTitleCase(n.trim()).split(/\s+/).filter(Boolean); return p.length > 2 ? `${p[0]} ${p[p.length - 1]}` : p.join(' ') }

  // ── Aba Entrega (03/10) ──────────────────────────────────────────────
  const [editandoEndereco, setEditandoEndereco] = useState(false)
  const [cepAchado, setCepAchado] = useState(false)
  const [dataSheet, setDataSheet] = useState(false)
  const [lojaInfo, setLojaInfo] = useState<{ nome: string; endereco: { linha1: string; linha2: string; completo: string } | null } | null>(null)
  const [enderecoDaCliente, setEnderecoDaCliente] = useState<{ rua: string; numero: string; bairro: string; cidade: string; complemento: string; cep: string } | null>(null)
  const enderecoAntes = useRef<any>(null)
  useTravarRolagem(dataSheet)
  const enderecoTemAlgo = !!(enderecoRua || enderecoNumero || enderecoBairro) // só a cidade (sugerida pela loja) não conta como endereço
  const enderecoCompleto = [[enderecoRua, enderecoNumero].filter(Boolean).join(', '), enderecoComplemento, enderecoBairro, enderecoCidade, enderecoCep ? `CEP ${enderecoCep}` : ''].filter(Boolean).join(' - ')
  const isoMaisDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  const diaPorExtenso = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${DIAS_SEMANA[new Date(y, m - 1, d).getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}` }
  const diaCurto = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${DIAS_SEMANA[new Date(y, m - 1, d).getDay()].slice(0, 3)} ${d}` }
  const horaCurta = (h: string) => { const [hh, mm] = h.slice(0, 5).split(':'); return `${Number(hh)}h${mm && mm !== '00' ? mm : ''}` }
  const quandoTexto = `${dataEntrega ? diaPorExtenso(dataEntrega) : 'data a combinar'}${horarioEntrega ? ` às ${horaCurta(horarioEntrega)}` : ''}`
  const primeiroNome = clienteNome.trim() ? toTitleCase(clienteNome.trim().split(/\s+/)[0]) : ''
  const textoEntregador = `Entrega do pedido #${pedido?.numero ?? ''}${primeiroNome ? ` · ${toTitleCase(clienteNome.trim())}` : ''}\n${quandoTexto}\n${enderecoCompleto}${clienteTelefone ? `\nTelefone: ${clienteTelefone}` : ''}`
  const textoRetirada = `Oi${primeiroNome ? `, ${primeiroNome}` : ''}! Seu pedido #${pedido?.numero ?? ''} pode ser retirado ${quandoTexto.charAt(0).toLowerCase() + quandoTexto.slice(1)}, em: ${lojaInfo?.endereco?.completo || ''}`
  const copiarEndereco = async () => { try { await navigator.clipboard.writeText(enderecoCompleto); avisar('Endereço copiado.') } catch { avisar('Não foi possível copiar.') } }
  const abrirEdicaoEndereco = () => { enderecoAntes.current = { enderecoCep, enderecoRua, enderecoNumero, enderecoBairro, enderecoCidade, enderecoComplemento }; setCepAchado(false); setEditandoEndereco(true) }
  const cancelarEdicaoEndereco = () => {
    const a = enderecoAntes.current
    if (a) { setEnderecoCep(a.enderecoCep); setEnderecoRua(a.enderecoRua); setEnderecoNumero(a.enderecoNumero); setEnderecoBairro(a.enderecoBairro); setEnderecoCidade(a.enderecoCidade); setEnderecoComplemento(a.enderecoComplemento) }
    setEditandoEndereco(false)
  }
  const usarEnderecoDaCliente = () => {
    const c = enderecoDaCliente; if (!c) return
    setEnderecoRua(c.rua); setEnderecoNumero(c.numero); setEnderecoBairro(c.bairro); setEnderecoCidade(c.cidade); setEnderecoComplemento(c.complemento)
    if (c.cep) { const d = c.cep.replace(/\D/g, ''); setEnderecoCep(d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : c.cep) }
    setEditandoEndereco(false); avisar('Endereço da cliente aplicado.')
  }
  // endereço da loja (pra retirada) e o do cadastro da cliente
  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) return
      const { data } = await supabase.from('profiles').select('nome_loja, endereco').eq('id', user.id).maybeSingle()
      let a: any = {}; try { a = (data as any)?.endereco ? (typeof (data as any).endereco === 'string' ? JSON.parse((data as any).endereco) : (data as any).endereco) : {} } catch { a = {} }
      const l1 = [a.rua, a.numero].filter(Boolean).join(', '), l2 = [a.bairro, a.cidade].filter(Boolean).join(' · ')
      setLojaInfo({ nome: (data as any)?.nome_loja || '', endereco: (l1 || l2) ? { linha1: l1 || l2, linha2: l1 ? l2 : '', completo: [l1, a.bairro, a.cidade].filter(Boolean).join(' - ') } : null })
    })()
  }, [])
  useEffect(() => {
    if (!clienteId) { setEnderecoDaCliente(null); return }
    ;(async () => {
      const { data } = await supabase.from('clientes').select('rua, numero, bairro, cidade, complemento, cep').eq('id', clienteId).maybeSingle()
      const c: any = data || {}
      setEnderecoDaCliente(c.rua || c.bairro || c.cidade ? { rua: c.rua || '', numero: c.numero || '', bairro: c.bairro || '', cidade: c.cidade || '', complemento: c.complemento || '', cep: c.cep || '' } : null)
    })()
  }, [clienteId])



  // O que dá pra editar e salvar — usado pra saber se há alterações não salvas
  const estadoEditavel = () => ({
    clienteId, clienteNome, clienteTelefone, tipoEntrega, dataEntrega, horarioEntrega: (horarioEntrega || '').slice(0, 5),
    enderecoCep, enderecoRua, enderecoNumero, enderecoBairro, enderecoCidade, enderecoComplemento,
    taxaEntrega: tipoEntrega === 'entrega' ? taxaEntrega : 0, desconto, acrescimo, dataPrevistaPagamento: dataPrevistaPagamento || '',
    itens: itens.map(it => [it.produto_id || it.nome_produto, it.quantidade, it.valor_unitario, it.observacoes || '']),
  })
  useEffect(() => { if (!carregando && pedido && snapshotRef.current === null) snapshotRef.current = JSON.stringify(estadoEditavel()) }) // eslint-disable-line react-hooks/exhaustive-deps
  const alteracoes = (() => {
    if (!snapshotRef.current) return 0
    const antes = JSON.parse(snapshotRef.current), agora: any = estadoEditavel()
    let n = Object.keys(agora).filter(k => JSON.stringify(antes[k]) !== JSON.stringify(agora[k])).length
    if (ajustesPendentes.length) n = Math.max(n, ajustesPendentes.length)
    return n
  })()


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
        avisarJanela('Não foi possível abrir o pedido', 'Confira a internet e tente de novo.', 'erro')
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
      { const d = String((p as any).endereco_cep || '').replace(/\D/g, ''); setEnderecoCep(d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d) } // CEP: antes não era lido
      // Popular valores (Fase 4)
      setDesconto(p.desconto || 0)
      setTaxaEntrega(p.taxa_entrega || 0)
      // Acréscimo: se a coluna existir na tabela, popula; senão fica 0
      if (typeof (p as any).acrescimo === 'number') {
        setAcrescimo((p as any).acrescimo)
      }
      // Popular pagamento (Fase 5)
      setFormaPagamento(p.forma_pagamento || 'PIX')
      // Financeiro · Passo 0: pedido sem situação (antigo) ou estornado não abre mais como "pago"
      let sitInicial: SituacaoPag = 'fiado', parcialInicial = 0
      if (p.status_pagamento === 'pago') sitInicial = 'total'
      else if (p.status_pagamento === 'parcial') { sitInicial = 'parcial'; parcialInicial = p.valor_recebido || 0 }
      else if (!p.status_pagamento && p.status === 'entregue') sitInicial = 'total' // mesma regra do financeiro pra pedidos antigos
      setSituacaoPag(sitInicial)
      setValorParcial(parcialInicial)
      pagInicialRef.current = { situacao: sitInicial, parcial: parcialInicial }
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
        // As escolhas do item (tamanho, massa, recheios, kit, adicionais, foto de referência) vão junto:
        // antes não eram carregadas, e salvar a edição apagava todas elas.
        personalizacoes: (it as any).personalizacoes ?? null,
        preco_breakdown: (it as any).preco_breakdown ?? null,
        snapshot_version: (it as any).snapshot_version ?? null,
      })))
      carregarPagamentos(p.id)
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
      snapshotRef.current = null // tira a "foto" de novo: depois de salvar, nada fica pendente
      setCarregando(false)
    })()
    return () => { cancelado = true }
  }, [id, recarga])

  // ── Fecha dropdown de status ao clicar fora ───────────────────────────
  useEffect(() => {
    if (!statusDropdownAberto) return
    const onDoc = () => setStatusDropdownAberto(false)
    // pequeno delay pra não fechar no mesmo clique que abriu
    const t = setTimeout(() => document.addEventListener('click', onDoc), 0)
    return () => { clearTimeout(t); document.removeEventListener('click', onDoc) }
  }, [statusDropdownAberto])

  // ── Cancelar sheet: trava scroll do body ──────────────────────────────
  useEffect(() => {
    if (!cancelarAberto) return
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
    return () => {
      document.body.style.overflow = original.overflow
      document.body.style.position = original.position
      document.body.style.top = original.top
      document.body.style.width = original.width
      window.scrollTo(0, scrollY)
    }
  }, [cancelarAberto])

  // ── Handler de cancelar pedido (Fase 8) ───────────────────────────────
  const handleConfirmarCancelamento = async () => {
    if (!pedido || cancelando) return
    if (recebidoAtual > 0.009 && pagamentosOk && devolverSinal === null) { avisarJanela('Falta uma resposta', 'Escolha o que aconteceu com o valor que você já recebeu deste pedido.', 'alerta'); return }
    setCancelando(true)
    try {
      const motivoLimpo = motivoCancelamento.trim()
      // Tenta salvar com as colunas novas (motivo/mostrar); se der erro de coluna, cai pra fallback
      const payloadCompleto: any = {
        status: 'cancelado',
        motivo_cancelamento: motivoLimpo || null,
        mostrar_motivo_ao_cliente: motivoLimpo ? mostrarMotivoCliente : false,
      }
      let { error } = await supabase.from('pedidos').update(payloadCompleto).eq('id', pedido.id)

      // Se der erro (provavelmente colunas não existem), tenta só com status
      if (error) {
        console.warn('Fallback: colunas motivo/mostrar não existem, salvando só status.', error.message)
        const r = await supabase.from('pedidos').update({ status: 'cancelado' }).eq('id', pedido.id)
        error = r.error
      }

      if (error) {
        avisarJanela('Não foi possível cancelar', 'Confira a internet e tente de novo. (' + error.message + ')', 'erro')
        setCancelando(false)
        return
      }

      // Registra no histórico (silencioso — não falha se tabela não existir)
      // Devolveu o sinal? Os recebimentos são estornados (saem do caixa, ficam no histórico)
      if (devolverSinal) {
        await supabase.from('pagamentos').update({ estornado_em: new Date().toISOString() }).eq('pedido_id', pedido.id).is('estornado_em', null).then(() => {}, () => {})
      }
      supabase.from('pedido_historico').insert({
        pedido_id: pedido.id,
        evento: 'Pedido cancelado',
        descricao: motivoLimpo || 'Sem motivo informado',
      }).then(() => {}, () => {})

      setCancelarAberto(false)
      navigate('/pedidos')
    } catch (err: any) {
      avisarJanela('Não foi possível cancelar', 'Algo deu errado. Tente de novo em instantes.', 'erro')
      setCancelando(false)
    }
  }

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

  // ── Handler de exportar PDF ───────────────────────────────────────────
  const handleExportarPDF = async () => {
    if (!pedido) return
    // Usa o state atual (que pode ter mudanças não salvas) pra gerar o PDF
    await gerarPedidoPDF({
      id: pedido.id,
      numero: pedido.numero,
      cliente_nome: clienteNome,
      cliente_telefone: clienteTelefone,
      status: statusPedido,
      status_pagamento: situacaoPag === 'total' ? 'pago' : situacaoPag === 'parcial' ? 'parcial' : 'pendente',
      tipo_entrega: tipoEntrega,
      tipo_venda: pedido.tipo_venda,
      data_entrega: dataEntrega,
      horario_entrega: horarioEntrega,
      endereco_rua: enderecoRua,
      endereco_numero: enderecoNumero,
      endereco_bairro: enderecoBairro,
      endereco_cidade: enderecoCidade,
      endereco_complemento: enderecoComplemento,
      valor_total: total,
      valor_produtos: subtotalItens,
      valor_recebido: situacaoPag === 'total' ? total : situacaoPag === 'parcial' ? valorParcial : 0,
      desconto: desconto,
      acrescimo: acrescimo,
      taxa_entrega: tipoEntrega === 'entrega' ? taxaEntrega : 0,
      forma_pagamento: formaPagamento,
      observacoes: pedido.observacoes,
      data_prevista_pagamento: situacaoPag === 'fiado' ? dataPrevistaPagamento : null,
      origem: pedido.origem,
      cupom_codigo: (pedido as any).cupom_codigo,
      created_at: pedido.created_at,
      pedido_itens: itens,
    })
  }

  // ── Handler de salvar (Fase 6) ────────────────────────────────────────
  const handleSalvar = async () => {
    if (salvando) return
    setSalvando(true)

    try {
      // Validação básica
      if (itens.length === 0) {
        avisarJanela('O pedido está sem itens', 'Adicione pelo menos um item antes de salvar.', 'alerta')
        setSalvando(false)
        return
      }
      if (!dataEntrega) {
        avisarJanela('Falta a data', 'Escolha a data de entrega ou retirada antes de salvar.', 'alerta')
        setSalvando(false)
        return
      }

      // Derivar status_pagamento e valor_recebido.
      // Financeiro · Passo 0: só regrava o pagamento se ela MEXEU no pagamento. Se mudou só itens, data,
      // cliente…, preserva o que já foi recebido (antes, um pedido "pago" que aumentou de valor marcava
      // a diferença como recebida, e pedidos antigos/estornados eram salvos como "pago").
      const ini = pagInicialRef.current
      const mexeuNoPagamento = !ini || ini.situacao !== situacaoPag || (situacaoPag === 'parcial' && ini.parcial !== valorParcial)
      let statusPag: string | undefined
      let valorRecebido: number | undefined
      if (mexeuNoPagamento) {
        if (situacaoPag === 'fiado') { statusPag = 'pendente'; valorRecebido = 0 }
        else if (situacaoPag === 'parcial') { statusPag = 'parcial'; valorRecebido = Math.min(valorParcial, total) }
        else { statusPag = 'pago'; valorRecebido = total }
      } else if (pedido?.status_pagamento === 'pago' || pedido?.status_pagamento === 'parcial') {
        const totalAntigo = Number(pedido?.valor_total) || 0
        const jaRecebido = pedido.status_pagamento === 'pago' ? totalAntigo : (Number(pedido.valor_recebido) || 0)
        valorRecebido = Math.min(jaRecebido, total)
        statusPag = valorRecebido >= total - 0.009 ? 'pago' : valorRecebido > 0 ? 'parcial' : 'pendente'
      } else if (pedido?.status_pagamento === 'pendente') {
        statusPag = 'pendente'; valorRecebido = 0
      } // sem situação (antigo) ou estornado: não toca no pagamento
      // Tela nova (03/10): com a tabela de pagamentos, o recebido é do banco (soma dos pagamentos) — o salvar não toca nele
      if (pagamentosOk) { statusPag = undefined; valorRecebido = undefined }

      // Recalcular valor dos produtos (soma bruta dos itens)
      const valorProdutos = itens.reduce((acc, it) => acc + (it.valor_unitario || 0) * (it.quantidade || 1), 0)

      // Detectar mudança de status pra registrar no histórico
      const statusAntigo = pedido?.status
      const statusMudou = statusAntigo && statusAntigo !== statusPedido

      // Payload completo (com acrescimo — se coluna não existir, cai no fallback abaixo)
      const payloadCompleto: any = {
        cliente_id: clienteId,
        cliente_nome: clienteNome,
        cliente_telefone: clienteTelefone,
        status: statusPedido,
        ...(statusPag !== undefined ? { status_pagamento: statusPag, valor_recebido: valorRecebido } : {}),
        valor_total: total,
        valor_produtos: valorProdutos,
        desconto: desconto,
        acrescimo: acrescimo,
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
        endereco_cep: tipoEntrega === 'entrega' ? (enderecoCep.replace(/\D/g, '') || null) : null, // antes o CEP se perdia ao salvar
        data_prevista_pagamento: mexeuNoPagamento
          ? (situacaoPag === 'fiado' ? (dataPrevistaPagamento || null) : null)
          : ((pedido as any)?.data_prevista_pagamento ?? null),
      }

      // ── 1) UPDATE do pedido ─────────────────────────────────────────
      let { error: errPedido } = await supabase
        .from('pedidos')
        .update(payloadCompleto)
        .eq('id', pedido!.id)

      // Fallback: se a coluna "acrescimo" não existir, tenta sem ela
      if (errPedido && String(errPedido.message || '').toLowerCase().includes('acrescimo')) {
        console.warn('Fallback: coluna "acrescimo" não existe, salvando sem ela.')
        const { acrescimo: _, ...payloadSemAcrescimo } = payloadCompleto
        const r = await supabase.from('pedidos').update(payloadSemAcrescimo).eq('id', pedido!.id)
        errPedido = r.error
      }

      if (errPedido) {
        console.error('Erro ao atualizar pedido:', errPedido)
        avisarJanela('Não foi possível salvar', 'Confira a internet e tente de novo. (' + errPedido.message + ')', 'erro')
        setSalvando(false)
        return
      }

      // Ajustes de valor feitos nesta edição: ficam registrados com o motivo
      if (ajustesPendentes.length) {
        const { data: { user: u } } = await supabase.auth.getUser()
        let corrente = total - ajustesPendentes.reduce((s, a) => s + (a.tipo === 'acrescimo' ? a.valor : -a.valor), 0)
        for (const a of ajustesPendentes) {
          const depois = corrente + (a.tipo === 'acrescimo' ? a.valor : -a.valor)
          await supabase.from('pedido_ajustes').insert({ user_id: u?.id, pedido_id: pedido!.id, tipo: a.tipo, valor: a.valor, motivo: a.motivo || null, total_antes: Math.round(corrente * 100) / 100, total_depois: Math.round(depois * 100) / 100 }).then(() => {}, () => {})
          supabase.from('pedido_historico').insert({ pedido_id: pedido!.id, evento: 'Valor ajustado', descricao: `${a.tipo === 'desconto' ? 'Desconto' : 'Acréscimo'} de ${formatMoney(a.valor)}${a.motivo ? ` (${a.motivo})` : ''}` }).then(() => {}, () => {})
          corrente = depois
        }
      }

      // Financeiro · Passo 1: ela mudou o pagamento → os registros de pagamento acompanham
      // (subiu: registra a diferença; desceu: estorna os mais recentes — nada é apagado)
      if (mexeuNoPagamento && valorRecebido !== undefined) {
        await ajustarRecebido({ pedidoId: pedido!.id, alvo: valorRecebido, forma: formaPagamento })
      }

      // Registra mudança de status no histórico (silencioso — não falha se tabela não existir)
      if (statusMudou) {
        const labelNovo = (STATUS_CONFIG[statusPedido] || {}).label || statusPedido
        supabase.from('pedido_historico').insert({
          pedido_id: pedido!.id,
          evento: labelNovo,
          descricao: `Status alterado manualmente para "${labelNovo}"`,
        }).then(() => {}, () => {})
      }

      // ── 2) Substituir itens: DELETE tudo → INSERT tudo ──────────────
      const { error: errDel } = await supabase.from('pedido_itens').delete().eq('pedido_id', pedido!.id)
      if (errDel) {
        console.error('Erro ao remover itens antigos:', errDel)
        avisarJanela('Salvo pela metade', 'O pedido foi salvo, mas os itens não foram atualizados. Tente salvar de novo. (' + errDel.message + ')', 'erro')
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
          // ─── Snapshot Passo 0A ─────────────────────────────────────
          // EditarPedido preserva o snapshot original de cada item se existir,
          // e cria snapshot básico pra itens novos adicionados na edição
          // Mantém TUDO o que o item já tinha (kit, adicionais, foto de referência…); só completa o formato
          personalizacoes: (it as any).personalizacoes && typeof (it as any).personalizacoes === 'object'
            ? { ...criarPersonalizacoesV1((it as any).personalizacoes), ...(it as any).personalizacoes }
            : criarPersonalizacoesV1({}),
          preco_breakdown: (it as any).preco_breakdown || criarBreakdownV1({ final: it.valor_unitario }),
          snapshot_version: (it as any).snapshot_version || SNAPSHOT_VERSION_ATUAL,
        }))
        const { error: errIns } = await supabase.from('pedido_itens').insert(itensInsert)
        if (errIns) {
          console.error('Erro ao inserir itens:', errIns)
          avisarJanela('Salvo pela metade', 'O pedido foi salvo, mas os itens não foram gravados. Tente salvar de novo. (' + errIns.message + ')', 'erro')
          setSalvando(false)
          return
        }
      }

      setAjustesPendentes([])
      // Sucesso: continua no pedido (03/10 — antes voltava pra lista), já com tudo recarregado
      setSalvouOk(true)
      setSalvando(false)
      setRecarga(x => x + 1)
      avisar('Alterações salvas.')
      setTimeout(() => setSalvouOk(false), 1800)
    } catch (err: any) {
      console.error('Erro inesperado ao salvar:', err)
      avisarJanela('Não foi possível salvar', 'Algo deu errado. Tente de novo em instantes.', 'erro')
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

  // ── Dinheiro do pedido (tela nova) ─────────────────────────────────────
  const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100
  const pagAtivos = pagamentos.filter(g => !g.estornado_em)
  const recebidoAtual = pagamentosOk ? r2(pagAtivos.reduce((s, g) => s + (Number(g.valor) || 0), 0)) : (pedido ? valorRecebidoPedido(pedido as any) : 0)
  const faltaReceber = Math.max(0, r2(total - recebidoAtual))
  // Conta de cada item (03/10): preço do produto + adicionais − promoção = valor do item.
  // Vem do preco_breakdown gravado; se não fechar com o valor (item antigo ou editado), mostra só o valor.
  function contaDoItem(it: any) {
    const bd = it.preco_breakdown || {}
    const base = Number(bd.base_efetivo ?? bd.preco_base_original) || 0
    const adicionais = Number(bd.adicionais_total) || 0
    const desconto = Number(bd.desconto) || 0
    const valor = Number(it.valor_unitario) || 0
    const fecha = base > 0 && Math.abs(base + adicionais - desconto - valor) < 0.02
    const sub = base + adicionais
    return { detalhar: fecha && (adicionais > 0 || desconto > 0), base, adicionais, desconto, pct: fecha && desconto > 0 && sub > 0 ? Math.round((desconto / sub) * 100) : 0, fecha }
  }
  const somaContas = itens.reduce((acc, it: any) => {
    const c = contaDoItem(it), q = it.quantidade || 1
    if (c.fecha) { acc.base += c.base * q; acc.adic += c.adicionais * q; acc.desc += c.desconto * q } else acc.base += (Number(it.valor_unitario) || 0) * q
    return acc
  }, { base: 0, adic: 0, desc: 0 })
  const adicionaisTotal = r2(somaContas.adic)
  const promocoesTotal = r2(somaContas.desc)
  // o desconto do pedido pode juntar o cupom (do cardápio) e um desconto dado à parte
  const descontoCupom = (pedido as any)?.cupom_codigo ? r2(Math.min(Number((pedido as any)?.cupom_desconto) || 0, desconto)) : 0
  const descontoManual = r2(Math.max(0, desconto - descontoCupom))
  const produtosTotal = r2(subtotalItens - adicionaisTotal + promocoesTotal)

  // ── Etapas do pedido ───────────────────────────────────────────────────
  // Etapas dinâmicas (03/10): mudam com o tipo (entrega/retirada) e com o status
  const ETAPAS: string[] = tipoEntrega === 'retirada'
    ? ['Agendado', 'Em produção', 'Pronto pra retirar', statusPedido === 'entregue' ? 'Retirado' : 'Retirada']
    : ['Agendado', 'Em produção', statusPedido === 'em_entrega' ? 'Saiu pra entrega' : 'Pronto', 'Entregue']
  const posEtapa = statusPedido === 'em_producao' ? 1 : ['finalizado', 'aguardando_retirada', 'em_entrega'].includes(statusPedido) ? 2 : statusPedido === 'entregue' ? 3 : 0
  const proximaEtapa: { s: string; l: string } | null = (() => {
    switch (statusPedido) {
      case 'aguardando_pagamento': case 'aguardando_aceite': return { s: 'agendado', l: 'Aceitar pedido' }
      case 'agendado': return { s: 'em_producao', l: 'Iniciar produção' }
      case 'em_producao': return tipoEntrega === 'retirada' ? { s: 'aguardando_retirada', l: 'Pronto pra retirar' } : { s: 'finalizado', l: 'Marcar como pronto' }
      case 'finalizado': return tipoEntrega === 'retirada' ? { s: 'aguardando_retirada', l: 'Pronto pra retirar' } : { s: 'em_entrega', l: 'Saiu pra entrega' }
      case 'aguardando_retirada': return { s: 'entregue', l: 'Confirmar retirada' }
      case 'em_entrega': return { s: 'entregue', l: 'Confirmar entrega' }
      default: return null
    }
  })()
  // Mudar a etapa grava na hora (como na tela de Pedidos). Entregue com saldo → "Finalizar pedido".
  const irParaEtapa = async (novo: string) => {
    if (!pedido || novo === statusPedido) return
    if (alteracoes > 0) { avisarJanela('Salve antes de mudar a etapa', 'Você tem alterações não salvas. Salve ou descarte antes de mudar a etapa do pedido.', 'info'); return }
    if (novo === 'entregue' && faltaReceber > 0.009) { setFinalizarAberto(true); return }
    const { error } = await supabase.from('pedidos').update({ status: novo }).eq('id', pedido.id)
    if (error) { avisarJanela('Não foi possível mudar a etapa', 'Confira a internet e tente de novo.', 'erro'); return }
    const label = (STATUS_CONFIG[novo] || {}).label || novo
    supabase.from('pedido_historico').insert({ pedido_id: pedido.id, evento: label, descricao: `Status alterado para "${label}"` }).then(() => {}, () => {})
    setStatusPedido(novo); setPedido(p => p ? { ...p, status: novo } : p)
    avisar(avisoDaMudanca({ numero: pedido.numero } as any, novo))
    if (novo === 'entregue') tocarSom('sucesso')
  }
  const estornarPagamento = async (g: any) => {
    const ok = await confirmarJanela({ titulo: `Estornar ${formatMoney(Number(g.valor) || 0)}?`, texto: 'Use quando o recebimento foi lançado errado. O valor sai do caixa e volta a faltar neste pedido. Ele continua no histórico, riscado.', icone: 'estorno', rotuloConfirmar: 'Estornar', perigo: true })
    if (!ok) return
    const { error } = await supabase.from('pagamentos').update({ estornado_em: new Date().toISOString() }).eq('id', g.id)
    if (error) { avisarJanela('Não foi possível estornar', 'Confira a internet e tente de novo.', 'erro'); return }
    await recarregarDinheiro(); avisar('Recebimento estornado.')
  }
  const NOME_FORMA: Record<string, string> = { pix: 'Pix', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito', boleto: 'Boleto' }
  const NOME_TIPO: Record<string, string> = { sinal: 'Sinal', parcial: 'Parcial', restante: 'Restante', total: 'Pagamento', pagamento: 'Pagamento', migracao: 'Pagamento' }
  const dataCurtaBR = (iso?: string) => { if (!iso) return ''; const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '') }

  // ── Loading state ────────────────────────────────────────────────────
  if (carregando || !pedido) {
    return (
      <>
        <AppPageHeader title="Pedido" subtitle="Abrindo o pedido…" onBack={() => navigate('/pedidos')} />
        <p className="tpd-carregando" role="status"><span className="ui-gira" aria-hidden="true" />Carregando o pedido…</p>
      </>
    )
  }

  // ── Topo da tela (08/10 · 3.15): situação, entrega, aviso e o próximo passo num cartão só ──
  const grupoAtual = grupoDoStatus(statusPedido)
  const situacao = { nome: nomeDaSituacao(grupoAtual), tom: SITUACOES.find(x => x.chave === grupoAtual)?.tom }
  const atrasadoHoje = !!dataEntrega && dataEntrega.slice(0, 10) < hojeISO() && !['entregue', 'cancelado'].includes(grupoAtual)
  const novoPedido = grupoAtual === 'aguardando_aceite'
  const origemTexto = pedido.origem === 'cardapio' ? 'Pedido feito pelo cardápio digital' : 'Pedido lançado por você'
  const subtituloTopo = `${primeiroNome ? `${primeiroNome} · ` : ''}${dataLonga(dataEntrega, horarioEntrega)}`

  return (
    <>
    <AppPageHeader title={`Pedido #${pedido.numero || '—'}`} subtitle={subtituloTopo} onBack={() => navigate('/pedidos')} />
    <div className="ep-wrap ep2 tpd">
      <section className={`tpd-sit${novoPedido ? ' aceitar' : ''}${atrasadoHoje ? ' atr' : ''}`} aria-label="Situação do pedido">
        <div className="tpd-sit-l">
          <div className="tpd-sit-tx">
            <Linha rotulo="Situação" tom={situacao.tom}>{situacao.nome}</Linha>
            <Linha rotulo={tipoEntrega === 'entrega' ? 'Entrega' : 'Retirada'} tom={atrasadoHoje ? 'vermelho' : undefined}>{dataLonga(dataEntrega, horarioEntrega)}</Linha>
            {atrasadoHoje && <p className="tpd-aviso atr">A data de entrega já passou.</p>}
            {novoPedido && <p className="tpd-aviso">{pedido.origem === 'cardapio' ? 'Chegou pelo cardápio. Aceite pra entrar na sua agenda.' : 'Aceite pra entrar na sua agenda.'}</p>}
          </div>
          <BotaoIcone rotulo="Mais ações" variante="limpo" className="tpd-mais" onClick={() => setMenuAberto(true)}><DotsThreeVertical size={24} weight="bold" /></BotaoIcone>
        </div>
        {statusPedido !== 'cancelado' && (
          <ol className="tpd-passos" aria-label="Etapas do pedido">
            {ETAPAS.map((n, i) => {
              const feita = i < posEtapa || statusPedido === 'entregue'
              const atual = !feita && i === posEtapa && !['aguardando_pagamento', 'aguardando_aceite'].includes(statusPedido)
              return <li key={i} className={feita ? 'feita' : atual ? 'atual' : ''} aria-current={atual ? 'step' : undefined}><i>{feita ? <Check size={14} weight="bold" /> : i + 1}</i><span>{n}</span></li>
            })}
          </ol>
        )}
        {proximaEtapa ? <Botao className="tpd-acao" cheio onClick={() => irParaEtapa(proximaEtapa.s)}>{proximaEtapa.l}</Botao>
          : statusPedido === 'entregue' ? <p className="tpd-fim"><Check size={16} weight="bold" /> {tipoEntrega === 'retirada' ? 'Pedido retirado' : 'Pedido entregue'}</p> : null}
      </section>

      {/* abas: só no celular */}
      <div className="tpd-abas" role="tablist" aria-label="Partes do pedido">
        {([['itens', 'Itens', Cake], ['entrega', tipoEntrega === 'entrega' ? 'Entrega' : 'Retirada', tipoEntrega === 'entrega' ? Truck : Storefront], ['pagamento', 'Pagamento', CreditCard]] as [Tab, string, any][]).map(([k, l, Ic]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className="tpd-aba" onClick={() => setTab(k)}><Ic size={20} weight={tab === k ? 'fill' : 'bold'} aria-hidden="true" /><span>{l}</span></button>
        ))}
      </div>

      <div className="ep2-grid">
        <div className="ep2-col">
          {/* ── ITENS (com o cartão do cliente) ── */}
          <div className={`ep2-sec ${tab === 'itens' ? 'ativa' : ''}`}>
            {/* ── Cartão da cliente (opção A + estados especiais) ── */}
            <section className="ep2-card tpd-card">
              <Titulo acao={clienteNome.trim() ? <Botao variante="link" icone={<ArrowsLeftRight size={16} weight="bold" />} onClick={() => setModalCliente(true)}>Trocar</Botao> : undefined}>Cliente</Titulo>
              {!clienteNome.trim() ? (
                <div className="tpd-cli-vz">
                  <p>Este pedido ainda não tem cliente.</p>
                  <Botao variante="suave" tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={() => setModalCliente(true)}>Escolher cliente</Botao>
                </div>
              ) : (<>
                <button type="button" className="tpd-cli" onClick={() => clienteId ? navigate(`/clientes/${clienteId}`) : setModalCliente(true)} aria-label={clienteId ? 'Abrir o perfil da cliente' : 'Escolher a cliente'}>
                  {clienteInfo?.foto ? <img className="tpd-ini" src={clienteInfo.foto} alt="" /> : <span className="tpd-ini" aria-hidden="true">{initialsOf(toTitleCase(clienteNome.trim()))}</span>}
                  <span className="tpd-cli-tx">
                    <b>{toTitleCase(clienteNome.trim())}</b>
                    <span>{telDigitos ? formatTelefone(clienteTelefone) : 'Sem telefone'}</span>
                    <small>{origemTexto}</small>
                  </span>
                  {clienteId && <CaretRight size={20} weight="bold" className="tpd-cli-seta" aria-hidden="true" />}
                </button>
                {clienteId && clienteInfo && clienteInfo.pedidos > 0 && (
                  <div className="tpd-cli-st">
                    <span><b>{clienteInfo.pedidos + 1}</b><small>pedidos</small></span>
                    <span><b>{formatMoney(clienteInfo.gasto + total)}</b><small>já gastou</small></span>
                    <span><b>{clienteInfo.ultimo ? clienteInfo.ultimo.slice(8, 10) + '/' + clienteInfo.ultimo.slice(5, 7) : '—'}</b><small>último pedido</small></span>
                  </div>
                )}
                {aniversario && (
                  <p className="tpd-aniv"><Cake size={20} weight="bold" aria-hidden="true" /><span><b>Aniversário {aniversario.dias === 0 ? 'hoje' : `dia ${aniversario.data}`}</b>{aniversario.dias === 0 ? '!' : ` · daqui a ${aniversario.dias} ${aniversario.dias === 1 ? 'dia' : 'dias'}.`} Que tal um mimo no pedido?</span></p>
                )}
                {telDigitos ? (
                  <div className="tpd-dois">
                    <a className="ui-bt ui-bt--secundario ui-bt--m" href={`https://wa.me/55${telDigitos}`} target="_blank" rel="noreferrer"><span className="ui-bt-ic" aria-hidden="true"><WhatsappLogo size={20} weight="bold" className="tpd-zap" /></span><span className="ui-bt-t">WhatsApp</span></a>
                    <a className="ui-bt ui-bt--secundario ui-bt--m" href={`tel:+55${telDigitos}`}><span className="ui-bt-ic" aria-hidden="true"><Phone size={20} weight="bold" /></span><span className="ui-bt-t">Ligar</span></a>
                  </div>
                ) : (
                  <Botao className="tpd-mt" variante="suave" tamanho="m" cheio icone={<Plus size={20} weight="bold" />} onClick={() => clienteId ? navigate(`/clientes/${clienteId}`) : setModalCliente(true)}>Adicionar telefone</Botao>
                )}
              </>)}
            </section>

            <section className="ep2-card tpd-card">
              <Titulo contagem={itens.length} acao={<Botao variante="link" icone={<Plus size={16} weight="bold" />} onClick={() => setModalProduto(true)}><span className="tpd-add-g">Adicionar item</span><span className="tpd-add-c">Adicionar</span></Botao>}>Itens do pedido</Titulo>
              {itens.length === 0 ? <p className="tpd-vz">Nenhum item. Toque em Adicionar item.</p> : (
                <ul className="tpd-itens">
                  {itens.map((it: any, idx) => {
                    const p = it.personalizacoes || {}
                    const extras: any[] = Array.isArray(p.extras) ? p.extras : []
                    const sabores: any[] = p.kit?.sabores || []
                    const eKit = !!p.kit?.total
                    const q = it.quantidade || 1
                    const campos: [string, string][] = []
                    if (p.tamanho?.nome) campos.push(['Tamanho', `${p.tamanho.nome}${p.tamanho.peso_kg && !/kg/i.test(p.tamanho.nome) ? ` (${String(p.tamanho.peso_kg).replace('.', ',')} kg)` : ''}`])
                    if (p.massa?.nome) campos.push(['Massa', p.massa.nome])
                    if (p.sabor?.nome) campos.push(['Sabor', p.sabor.nome])
                    if (Array.isArray(p.recheios) && p.recheios.length) campos.push([p.recheios.length > 1 ? 'Recheios' : 'Recheio', p.recheios.map((r: any) => r.nome).join(', ')])
                    if (p.cobertura?.nome) campos.push(['Cobertura', p.cobertura.nome])
                    if (sabores.length) campos.push(['Sabores', sabores.map((x: any) => `${x.qtd} de ${String(x.nome).toLowerCase()}`).join(', ')])
                    if (extras.length) campos.push(['Adicionais', extras.map((e: any) => e.nome).join(', ')])
                    const obs = (it.observacoes || '').trim()
                    const foto = fotoDoItem(it)
                    return (
                      <li key={it.id || `n${idx}`}>
                        <div className="tpd-it-topo">
                          <span className="tpd-ft" aria-hidden="true"><Package size={20} weight="bold" />{foto && <img src={foto} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />}</span>
                          <div className="tpd-it-tx">
                            <b><em>{q}x</em> {nomeDeProduto(it.nome_produto)}</b>
                            <span>{formatMoney((it.valor_unitario || 0) * q)}{q > 1 ? ` · ${formatMoney(it.valor_unitario || 0)} ${eKit ? 'por kit' : 'cada'}` : ''}</span>
                          </div>
                          <BotaoIcone rotulo={`Opções de ${it.nome_produto}`} variante="limpo" tamanho="p" onClick={() => setItemMenu(idx)}><DotsThree size={20} weight="bold" /></BotaoIcone>
                        </div>
                        {campos.length > 0 && <div className="tpd-it-esc">{campos.map(([k, v]) => <Linha key={k} rotulo={k}>{v}</Linha>)}</div>}
                        {(p.foto_referencia || obs) && (
                          <div className="tpd-recado">
                            {p.foto_referencia && (
                              <a className="tpd-ref" href={p.foto_referencia} target="_blank" rel="noreferrer" aria-label="Ampliar a foto de referência">
                                <ImageIcon size={24} aria-hidden="true" /><img src={p.foto_referencia} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
                              </a>
                            )}
                            <div>
                              <small>Recado do item</small>
                              {obs ? <p>“{obs}”</p> : <p>Foto de referência</p>}
                              {p.foto_referencia && <span>Toque na foto pra ampliar</span>}
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* ── ENTREGA (03/10): como sai primeiro, data em português, endereço pronto pra ler ── */}
          <div className={`ep2-sec ${tab === 'entrega' ? 'ativa' : ''}`}>
            <section className="ep2-card tpd-card">
              <div className="tpd-seg" role="group" aria-label="Como o pedido sai">
                <button type="button" aria-pressed={tipoEntrega === 'entrega'} onClick={() => setTipoEntrega('entrega')}><Truck size={20} weight={tipoEntrega === 'entrega' ? 'fill' : 'bold'} aria-hidden="true" />Entrega</button>
                <button type="button" aria-pressed={tipoEntrega === 'retirada'} onClick={() => setTipoEntrega('retirada')}><Storefront size={20} weight={tipoEntrega === 'retirada' ? 'fill' : 'bold'} aria-hidden="true" />Retirada</button>
              </div>
              <div className="tpd-quando">
                <div className="ui-campo">
                  <span className="ui-campo-r"><span>{tipoEntrega === 'entrega' ? 'Data da entrega' : 'Data da retirada'}</span></span>
                  <button type="button" className="ui-campo-c tpd-fal" onClick={() => setDataSheet(true)}><span className="ui-campo-ic" aria-hidden="true"><CalendarBlank size={20} weight="bold" /></span><span className={dataEntrega ? '' : 'tpd-ph'}>{dataEntrega ? diaPorExtenso(dataEntrega) : 'Escolher'}</span></button>
                </div>
                <div className="ui-campo">
                  <span className="ui-campo-r"><span>Horário</span></span>
                  <button type="button" className="ui-campo-c tpd-fal" onClick={() => setHoraSheetAberto(true)}><span className="ui-campo-ic" aria-hidden="true"><Clock size={20} weight="bold" /></span><span className={horarioEntrega ? '' : 'tpd-ph'}>{horarioEntrega ? horarioEntrega.slice(0, 5) : 'Escolher'}</span></button>
                </div>
              </div>
            </section>

            {tipoEntrega === 'entrega' ? (
              <div className="ep2-card">
                <Titulo acao={!editandoEndereco && enderecoTemAlgo ? <Botao variante="link" icone={<PencilSimple size={16} weight="bold" />} onClick={abrirEdicaoEndereco}>Editar</Botao> : undefined}>Endereço de entrega</Titulo>
                {!editandoEndereco && enderecoTemAlgo ? (<>
                  <div className="ep2-addr tpd-end">
                    <div><b>{[enderecoRua, enderecoNumero].filter(Boolean).join(', ') || 'Endereço sem rua'}</b>
                      {enderecoComplemento && <small>{enderecoComplemento}</small>}
                      <small>{[enderecoBairro, enderecoCidade].filter(Boolean).join(' · ')}{enderecoCep ? ` · CEP ${enderecoCep}` : ''}</small></div>
                  </div>
                  <div className="tpd-dois">
                    <a className="ui-bt ui-bt--secundario ui-bt--m" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`} target="_blank" rel="noreferrer"><span className="ui-bt-ic" aria-hidden="true"><MapTrifold size={20} weight="bold" /></span><span className="ui-bt-t">Ver no mapa</span></a>
                    <Botao variante="secundario" tamanho="m" icone={<Copy size={20} weight="bold" />} onClick={copiarEndereco}>Copiar</Botao>
                  </div>
                  <a className="ui-bt ui-bt--secundario ui-bt--m ui-bt--cheio tpd-entregador" href={`https://wa.me/?text=${encodeURIComponent(textoEntregador)}`} target="_blank" rel="noreferrer"><span className="ui-bt-ic" aria-hidden="true"><WhatsappLogo size={20} weight="bold" className="tpd-zap" /></span><span className="ui-bt-t">Mandar pro entregador</span></a>
                </>) : (<>
                  {enderecoDaCliente && (
                    <button className="ep2-usar" onClick={usarEnderecoDaCliente}>Usar o endereço {clienteNome.trim() ? `de ${toTitleCase(clienteNome.trim().split(/\s+/)[0])}` : 'da cliente'}
                      <span>{[enderecoDaCliente.rua, enderecoDaCliente.numero].filter(Boolean).join(', ')}{enderecoDaCliente.bairro ? ` · ${enderecoDaCliente.bairro}` : ''}</span></button>
                  )}
                  <label className="ep2-lb" htmlFor="ep2-cep">CEP</label>
                  <div className={`ep2-in ${cepAchado ? 'ok' : ''}`}>
                    <input id="ep2-cep" inputMode="numeric" placeholder="00000-000" value={enderecoCep}
                      onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(0, 8); setEnderecoCep(d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d); setCepAchado(false); if (d.length === 8) fetchCep(d).then(() => setCepAchado(true)) }} />
                    {cepLoading ? <em>buscando…</em> : cepAchado ? <em className="ok">✓ endereço achado</em> : null}
                  </div>
                  <div className="ep2-row-rn">
                    <div><label className="ep2-lb" htmlFor="ep2-rua">Rua</label><input id="ep2-rua" className="ep2-in" value={enderecoRua} onChange={e => setEnderecoRua(e.target.value)} /></div>
                    <div><label className="ep2-lb" htmlFor="ep2-num">Número</label><input id="ep2-num" className="ep2-in" inputMode="numeric" value={enderecoNumero} onChange={e => setEnderecoNumero(e.target.value)} /></div>
                  </div>
                  <label className="ep2-lb" htmlFor="ep2-comp">Complemento</label>
                  <input id="ep2-comp" className="ep2-in" placeholder="Apto, bloco, referência…" value={enderecoComplemento} onChange={e => setEnderecoComplemento(e.target.value)} />
                  <div className="ep2-row-bc">
                    <div><label className="ep2-lb" htmlFor="ep2-bai">Bairro</label><input id="ep2-bai" className="ep2-in" value={enderecoBairro} onChange={e => setEnderecoBairro(e.target.value)} /></div>
                    <div><label className="ep2-lb" htmlFor="ep2-cid">Cidade</label><input id="ep2-cid" className="ep2-in" value={enderecoCidade} onChange={e => setEnderecoCidade(e.target.value)} /></div>
                  </div>
                  {enderecoTemAlgo && (
                    <div className="ep2-end-fim">
                      <button className="ep2-lk cinza" onClick={cancelarEdicaoEndereco}>Cancelar</button>
                      <button className="ep2-b1" onClick={() => setEditandoEndereco(false)}>Usar este endereço</button>
                    </div>
                  )}
                </>)}
                <div className="ep2-taxa"><span>Taxa de entrega</span>
                  <span className="ep2-mini"><em>R$</em><input inputMode="numeric" value={textoBRL(taxaEntrega) || ''} placeholder="0,00" onChange={e => setTaxaEntrega(lerBRL(mascaraBRL(e.target.value)))} aria-label="Taxa de entrega" /></span></div>
              </div>
            ) : (
              <div className="ep2-card">
                <Titulo>Onde retirar</Titulo>
                {lojaInfo?.endereco ? (<>
                  <div className="ep2-addr tpd-end"><div><b>{lojaInfo.nome || 'Sua loja'}</b><small>{lojaInfo.endereco.linha1}</small>{lojaInfo.endereco.linha2 && <small>{lojaInfo.endereco.linha2}</small>}</div></div>
                  <p className="ep2-nota">O endereço vem dos <button className="ep2-lk" onClick={() => navigate('/cardapio-config')}>Dados da loja</button>.</p>
                </>) : (
                  <p className="ep2-vazio">Cadastre o endereço da sua loja nos <button className="ep2-lk" onClick={() => navigate('/cardapio-config')}>Dados da loja</button> pra ele aparecer aqui e na mensagem pra cliente.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── PAGAMENTO (no computador: coluna fixa à direita) ── */}
        <div className={`ep2-col ep2-col-dir ep2-sec ${tab === 'pagamento' ? 'ativa' : ''}`}>
          <div className="ep2-card">
            <Titulo>Valores</Titulo>
            {/* cada item com o seu valor e de onde ele vem (produto, adicionais, promoção) — a aba Itens não tem valores */}
            {itens.map((it: any, idx) => {
              const c = contaDoItem(it), q = it.quantidade || 1
              const eKit = !!it.personalizacoes?.kit?.total
              const extras: any[] = Array.isArray(it.personalizacoes?.extras) ? it.personalizacoes.extras : []
              const origem: string[] = []
              if (!c.fecha && q > 1) origem.push(`${formatMoney(it.valor_unitario || 0)} ${eKit ? 'por kit' : 'cada'}`)
              return (
                <div key={it.id || `v${idx}`} className="ep3-pv">
                  <div className="ep3-pv-h"><span><em>{q}x</em> {it.nome_produto}</span><b>{formatMoney((it.valor_unitario || 0) * q)}</b></div>
                  {c.fecha ? (
                    <div className="ep3-pv-d">
                      <p><span>Produto{q > 1 ? ` · ${q} × ${formatMoney(c.base)}` : ''}</span><b>{formatMoney(c.base * q)}</b></p>
                      {extras.filter(e => Number(e.valor) > 0).map((e, i) => <p key={i}><span>+ {e.nome}{q > 1 ? ` · ${q} × ${formatMoney(Number(e.valor))}` : ''}</span><b>{formatMoney(Number(e.valor) * q)}</b></p>)}
                      {c.desconto > 0 && <p className="pr"><span><Tag size={13} weight="bold" />Promoção{c.pct ? ` ${c.pct}%` : ''}</span><b>− {formatMoney(c.desconto * q)}</b></p>}
                    </div>
                  ) : origem.length > 0 && <p className="ep3-pv-u">{origem.join(' · ')}</p>}
                </div>
              )
            })}
            <div className="ep2-ln ep3-pv-itens"><span>Itens</span><b>{formatMoney(subtotalItens)}</b></div>
            {tipoEntrega === 'entrega' && <div className="ep2-ln"><span>Taxa de entrega</span><b>{formatMoney(taxaEntrega)}</b></div>}
            {/* cupom do cardápio separado do desconto dado à parte (03/10) */}
            {descontoCupom > 0 && <div className="ep2-ln promo"><span>Cupom {String((pedido as any)?.cupom_codigo || '').toUpperCase()}</span><b>− {formatMoney(descontoCupom)}</b></div>}
            {descontoManual > 0 && <div className="ep2-ln neg"><span>Desconto</span><b>− {formatMoney(descontoManual)}</b></div>}
            {acrescimo > 0 && <div className="ep2-ln"><span>Acréscimo</span><b>+ {formatMoney(acrescimo)}</b></div>}
            <div className="ep2-ln tt"><span>Total do pedido</span><b>{formatMoney(total)}</b></div>
            {[...ajustesHist, ...ajustesPendentes.map(a => ({ ...a, pendente: true }))].length > 0 && (
              <div className="ep2-ajs">{[...ajustesHist, ...ajustesPendentes.map(a => ({ ...a, pendente: true }))].map((a: any, i) => (
                <span key={i}>{a.tipo === 'desconto' ? 'Desconto' : 'Acréscimo'} de {formatMoney(Number(a.valor) || 0)}{a.motivo ? ` · ${a.motivo}` : ''}{a.pendente ? ' (ainda não salvo)' : ''}</span>
              ))}</div>
            )}
            <Botao className="tpd-aj" variante="link" icone={<PencilSimple size={16} weight="bold" />} onClick={() => setAjusteAberto(true)}>Dar desconto ou acrescentar valor</Botao>
          </div>

          <div className="ep2-card">
            <Titulo>Pagamentos</Titulo>
            {pagamentosOk ? (pagamentos.length === 0 ? <p className="ep2-vazio">Nenhum recebimento ainda.</p> : pagamentos.map(g => (
              <div key={g.id} className={`ep2-pg ${g.estornado_em ? 'est' : ''}`}>
                <span className="ep2-pg-ic" aria-hidden="true"><ArrowUp size={20} weight="bold" /></span>
                <div><b>{NOME_TIPO[g.tipo] || 'Pagamento'} · {NOME_FORMA[g.forma] || g.forma || '—'}</b><small>{g.estornado_em ? 'Estornado · ' : ''}{dataCurtaBR(g.recebido_em)}</small></div>
                <b className="v">{formatMoney(Number(g.valor) || 0)}</b>
                {!g.estornado_em && <BotaoIcone rotulo="Estornar este recebimento" variante="limpo" tamanho="p" onClick={() => estornarPagamento(g)}><ArrowCounterClockwise size={20} weight="bold" /></BotaoIcone>}
              </div>
            ))) : <p className="ep2-vazio">Recebido até agora: <b>{formatMoney(recebidoAtual)}</b>. (A lista de recebimentos aparece depois do SQL do Passo 1.)</p>}
            {statusPedido !== 'cancelado' && (faltaReceber > 0.009 ? (<>
              <div className="tpd-falta">
                <Linha rotulo="Recebido">{formatMoney(recebidoAtual)}</Linha>
                <Linha rotulo="Falta receber" tom="laranja">{formatMoney(faltaReceber)}</Linha>
                <div className="tpd-barra" role="progressbar" aria-label="Quanto já foi recebido" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, (recebidoAtual / (total || 1)) * 100))}><i style={{ width: `${Math.min(100, (recebidoAtual / (total || 1)) * 100)}%` }} /></div>
              </div>
              <Botao className="tpd-receber" cheio icone={<ArrowUp size={20} weight="bold" />} onClick={() => setReceberAberto(true)}>Registrar recebimento</Botao>
              <div className="tpd-comb">
                <span className="ui-campo-r"><span>Combinado pra pagar o resto</span><small>opcional</small></span>
                <CampoData valor={dataPrevistaPagamento || ''} onChange={setDataPrevistaPagamento} titulo="Combinado pra pagar" placeholder="Na entrega" />
              </div>
            </>) : <p className="tpd-quitado"><Check size={16} weight="bold" /> Pedido pago</p>)}
          </div>

          {/* salvar (computador) */}
          <div className="ep2-save-desk">
            {alteracoes > 0 ? (<>
              <span className="ep2-mud">{alteracoes} {alteracoes === 1 ? 'alteração não salva' : 'alterações não salvas'}</span>
              <Botao cheio onClick={handleSalvar} carregando={salvando} disabled={salvouOk}>{salvouOk ? 'Salvo' : 'Salvar alterações'}</Botao>
              <Botao variante="secundario" cheio onClick={() => window.location.reload()} disabled={salvando}>Descartar</Botao>
            </>) : <span className="ep2-salvo"><Check size={16} weight="bold" /> Tudo salvo</span>}
          </div>
        </div>
      </div>

      {/* salvar (celular): só aparece quando há algo pra salvar */}
      {alteracoes > 0 && (
        <div className="ep2-foot">
          <span className="ep2-mud">{alteracoes} {alteracoes === 1 ? 'alteração não salva' : 'alterações não salvas'}</span>
          <Botao variante="secundario" tamanho="m" onClick={() => window.location.reload()} disabled={salvando}>Descartar</Botao>
          <Botao tamanho="m" onClick={handleSalvar} carregando={salvando} disabled={salvouOk}>{salvouOk ? 'Salvo' : 'Salvar alterações'}</Botao>
        </div>
      )}
      {removido && (
        <div className="ep2-toast ep2-toast--desfazer" role="status"><span>{removido.item?.nome_produto || 'Item'} removido</span><button onClick={desfazerRemocao}>Desfazer</button></div>
      )}
      {produtoOpcoes && (
        <CartProvider>
          <ProductModal isOpen product={produtoOpcoes} onClose={() => setProdutoOpcoes(null)} corBotao="#E85A8C" rotuloAdicionar="Adicionar ao pedido"
            onAdicionar={(item: any) => {
              setItens(prev => [...prev, { ...itemDoCarrinhoParaPedido(item), observacoes: item.observations || '', imagem_url: produtoOpcoes.imagem_url || null } as any])
              setProdutoOpcoes(null); avisar(`${produtoOpcoes.nome} adicionado.`)
            }} />
        </CartProvider>
      )}

      {dataSheet && <CalendarioSheet valor={dataEntrega} titulo={tipoEntrega === 'entrega' ? 'Data da entrega' : 'Data da retirada'}
        onClose={() => setDataSheet(false)} onConfirmar={(d) => { setDataEntrega(d); setDataSheet(false) }} />}
      {/* ── ⋯ de um item: quantidade, recado e remover ── */}
      <Janela
        aberta={itemMenu !== null && !!itens[itemMenu]} aoFechar={() => setItemMenu(null)} tipo="conteudo"
        titulo={itemMenu !== null && itens[itemMenu] ? `${itens[itemMenu].quantidade}x ${nomeDeProduto(itens[itemMenu].nome_produto)}` : 'Item'}
        acoes={itemMenu !== null && itens[itemMenu] ? <>
          <Botao variante="secundario" icone={<Trash size={20} weight="bold" />} onClick={() => { const i = itemMenu; setItemMenu(null); removerComDesfazer(i) }}>Remover item</Botao>
          <Botao onClick={() => setItemMenu(null)}>Pronto</Botao>
        </> : undefined}
      >
        {itemMenu !== null && itens[itemMenu] && (
          <div className="tpd-im">
            <div className="ui-campo">
              <span className="ui-campo-r"><span>Quantidade</span></span>
              <div className="tpd-qtd">
                <BotaoIcone rotulo="Diminuir" disabled={itens[itemMenu].quantidade <= 1} onClick={() => updateQtd(itemMenu, -1)}><span aria-hidden="true">−</span></BotaoIcone>
                <input type="number" inputMode="numeric" value={itens[itemMenu].quantidade} onChange={e => setQtdManual(itemMenu, Number(e.target.value))} aria-label="Quantidade" />
                <BotaoIcone rotulo="Aumentar" onClick={() => updateQtd(itemMenu, 1)}><Plus size={20} weight="bold" /></BotaoIcone>
              </div>
            </div>
            <CampoArea rotulo="Recado do item" opcional rows={2} placeholder="Ex.: escrever Parabéns, Lia! em rosa" value={itens[itemMenu].observacoes || ''}
              onChange={e => { const v = e.target.value; setItens(prev => prev.map((x, i) => i === itemMenu ? { ...x, observacoes: v } : x)) }} />
          </div>
        )}
      </Janela>

      {/* ── mais ações do pedido: a mesma janela da lista ── */}
      <Janela aberta={menuAberto} aoFechar={() => setMenuAberto(false)} tipo="conteudo" titulo={`Pedido #${pedido.numero || ''}`}>
        <div className="tpd-menu">
          <button type="button" className="tpd-mi" onClick={() => { setMenuAberto(false); setTimelineAberto(true) }}><span className="tpd-mi-ic" aria-hidden="true"><Clock size={20} weight="bold" /></span>Acompanhar pedido</button>
          <button type="button" className="tpd-mi" onClick={() => { setMenuAberto(false); handleExportarPDF() }}><span className="tpd-mi-ic" aria-hidden="true"><I.print /></span>Imprimir ou baixar PDF</button>
          {statusPedido !== 'cancelado' && <button type="button" className="tpd-mi" onClick={() => { setMenuAberto(false); setEtapasAberto(true) }}><span className="tpd-mi-ic" aria-hidden="true"><Package size={20} weight="bold" /></span>Mudar a etapa</button>}
          {statusPedido !== 'cancelado' && <button type="button" className="tpd-mi perigo sep" onClick={() => { setMenuAberto(false); setDevolverSinal(null); setCancelarAberto(true) }}><span className="tpd-mi-ic" aria-hidden="true"><I.ban /></span>Cancelar pedido</button>}
          <button type="button" className={`tpd-mi perigo${statusPedido === 'cancelado' ? ' sep' : ''}`} onClick={() => { setMenuAberto(false); excluirPedido() }}><span className="tpd-mi-ic" aria-hidden="true"><Trash size={20} weight="bold" /></span>Excluir pedido</button>
        </div>
      </Janela>

      {/* ── mudar a etapa (qualquer uma, inclusive voltar) ── */}
      <Janela aberta={etapasAberto} aoFechar={() => setEtapasAberto(false)} tipo="conteudo" titulo="Mudar a etapa">
        <div className="tpd-menu">
          {SITUACOES.filter(x => x.chave !== 'cancelado').map(x => (
            <button key={x.chave} type="button" className={`tpd-mi${x.chave === grupoAtual ? ' sel' : ''}`} aria-current={x.chave === grupoAtual ? 'true' : undefined} onClick={() => { setEtapasAberto(false); irParaEtapa(x.chave) }}>
              <span className={`tpd-pt t-${x.tom || 'cinza'}`} aria-hidden="true" />{x.nome}{x.chave === grupoAtual && <em>atual</em>}
            </button>
          ))}
        </div>
      </Janela>

      {/* ── ajustar valor (fica registrado com o motivo ao salvar) ── */}
      {ajusteAberto && <AjusteSheet total={total} onClose={() => setAjusteAberto(false)} onAplicar={(a) => {
        if (a.tipo === 'desconto') setDesconto(d => r2(d + a.valor)); else setAcrescimo(x => r2(x + a.valor))
        setAjustesPendentes(l => [...l, a]); setAjusteAberto(false)
      }} />}

      {receberAberto && pedido && <ReceberSheet item={{
        id: pedido.id, numero: pedido.numero ?? null, cliente_nome: clienteNome, valor_total: total, valor_recebido: recebidoAtual,
        status: statusPedido, status_pagamento: (pedido as any).status_pagamento ?? null, forma_pagamento: pedido.forma_pagamento,
        data_entrega: dataEntrega, horario_entrega: horarioEntrega, data_prevista_pagamento: dataPrevistaPagamento || null,
        total, recebido: recebidoAtual, falta: faltaReceber, dataRef: null, dias: null,
      } as any} onClose={() => setReceberAberto(false)} onFeito={async (msg) => { setReceberAberto(false); await recarregarDinheiro(); avisar(msg) }} />}

      {finalizarAberto && pedido && <FinalizarPedidoSheet
        pedido={{ id: pedido.id, numero: pedido.numero ?? null, cliente_nome: clienteNome, status: statusPedido, valor_total: total, valor_recebido: recebidoAtual,
          status_pagamento: (pedido as any).status_pagamento ?? null, forma_pagamento: pedido.forma_pagamento }}
        novoStatus="entregue" novoStatusLabel="Entregue"
        onCancelar={() => setFinalizarAberto(false)}
        onConcluido={async () => { setFinalizarAberto(false); await recarregarDinheiro(); avisar(`Pedido #${pedido.numero ?? ''} entregue.`); tocarSom('sucesso') }} />}

      <style>{EP2_CSS}{FOLHA_CSS}</style>

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
                  <button key={p.id} type="button" className="ep-prod-item" onClick={() => escolherProduto(p)}>
                    <div className="ep-prod-item-img">
                      {p.imagem_url ? <img src={String(p.imagem_url).split(/,(?=\s*https?:)/)[0].trim()} alt={p.nome} /> : <I.box />}
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

      {/* ═══ CANCELAR PEDIDO SHEET (Fase 8) ═══ */}
      {cancelarAberto && createPortal(
        (() => {
          const motivosPreset = [
            'Sem ingredientes para produzir',
            'Não conseguimos entregar na data',
            'Fora da área de entrega',
            'Pagamento não confirmado',
            'Cliente desistiu do pedido',
          ]
          const valorRecebidoAtual = recebidoAtual
          return (
            <div className="ep-cnc-overlay" onClick={() => !cancelando && setCancelarAberto(false)}>
              <div className="ep-cnc-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="ep-tl-handle" />

                <div className="ep-cnc-header">
                  <div className="ep-cnc-title-wrap">
                    <div className="ep-cnc-title-ic">
                      <I.ban />
                    </div>
                    <h3 className="ep-cnc-title">Cancelar Pedido</h3>
                  </div>
                </div>

                <p className="ep-cnc-aviso">
                  Esta ação não pode ser desfeita. Deseja realmente cancelar este pedido?
                </p>

                {/* Card do pedido */}
                <div className="ep-cnc-card">
                  <div className="ep-cnc-card-ic">
                    <I.card />
                  </div>
                  <div>
                    <div className="ep-cnc-card-num">Pedido #{pedido?.numero || '—'}</div>
                    <div className="ep-cnc-card-sub">
                      {valorRecebidoAtual > 0
                        ? `${formatMoney(valorRecebidoAtual)} já recebido`
                        : 'Nenhum pagamento registrado'}
                    </div>
                  </div>
                </div>

                {/* Chips de motivo */}
                <div className="ep-cnc-section">
                  <div className="ep-cnc-section-header">
                    <span className="ep-cnc-section-title">Motivo do cancelamento</span>
                    <span className="ep-cnc-section-opt">opcional</span>
                  </div>
                  <div className="ep-cnc-chips">
                    {motivosPreset.map(m => (
                      <button
                        key={m}
                        type="button"
                        className={`ep-cnc-chip ${motivoCancelamento === m ? 'ep-cnc-chip--sel' : ''}`}
                        onClick={() => setMotivoCancelamento(motivoCancelamento === m ? '' : m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="ep-cnc-textarea"
                    placeholder="Escreva o motivo ou escolha um acima"
                    value={motivoCancelamento}
                    onChange={e => setMotivoCancelamento(e.target.value)}
                    rows={3}
                  />

                  {/* Toggle mostrar ao cliente */}
                  <div className="ep-cnc-toggle-row">
                    <div className="ep-cnc-toggle-info">
                      <div className="ep-cnc-toggle-t">Mostrar ao cliente</div>
                      <div className="ep-cnc-toggle-d">Escreva um motivo acima para poder mostrá-lo ao cliente.</div>
                    </div>
                    <button
                      type="button"
                      className={`ep-cnc-switch ${mostrarMotivoCliente ? 'ep-cnc-switch--on' : ''}`}
                      onClick={() => motivoCancelamento.trim() && setMostrarMotivoCliente(v => !v)}
                      disabled={!motivoCancelamento.trim()}
                      aria-label="Mostrar motivo ao cliente"
                    >
                      <span className="ep-cnc-switch-dot" />
                    </button>
                  </div>
                </div>

                {/* Botões */}
                {valorRecebidoAtual > 0.009 && pagamentosOk && (
                  <div className="ep2-devol">
                    <b>Você já recebeu {formatMoney(valorRecebidoAtual)} deste pedido. O que aconteceu com esse dinheiro?</b>
                    <label><input type="radio" name="devol" checked={devolverSinal === true} onChange={() => setDevolverSinal(true)} />Devolvi pra cliente (sai do caixa)</label>
                    <label><input type="radio" name="devol" checked={devolverSinal === false} onChange={() => setDevolverSinal(false)} />Fiquei com ele (continua no caixa)</label>
                  </div>
                )}
                <div className="ep-cnc-btns">
                  <button
                    className="ep-btn ep-btn--ghost"
                    onClick={() => setCancelarAberto(false)}
                    disabled={cancelando}
                  >
                    Voltar
                  </button>
                  <button
                    className="ep-btn ep-cnc-btn-danger"
                    onClick={handleConfirmarCancelamento}
                    disabled={cancelando}
                  >
                    {cancelando ? 'Cancelando...' : 'Cancelar pedido'}
                  </button>
                </div>
              </div>
            </div>
          )
        })(),
        document.body
      )}

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
          titulo={tipoEntrega === 'retirada' ? 'Horário da retirada' : 'Horário da entrega'}
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
        /* Celular: a barra fica acima do menu de baixo (antes ficava atrás e não dava pra tocar em Salvar) */
        @media (max-width: 767px) {
          .ep-footer { bottom: calc(56px + env(safe-area-inset-bottom, 0px)); padding-bottom: 12px; }
          /* iPhone com o teclado aberto: a barra fica logo acima do teclado (antes ficava escondida atrás) */
          html.teclado-aberto .ep-footer { bottom: var(--teclado, 0px); }
          .ep-wrap { padding-bottom: 210px !important; }
        }
        /* Computador: começa depois do menu lateral */
        @media (min-width: 768px) {
          .ep-footer { left: 220px; }
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
          font-weight: 700;
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

        /* ── FASE 8: CANCELAR PEDIDO SHEET ────────────────────────── */
        .ep-cnc-overlay {
          position: fixed;
          inset: 0;
          z-index: 110;
          background: rgba(20, 15, 18, 0.5);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          animation: epFadeIn 0.18s ease-out;
        }
        .ep-cnc-sheet {
          width: 100%;
          max-width: 480px;
          background: #fff;
          border-radius: 20px 20px 0 0;
          padding: 8px 16px calc(20px + env(safe-area-inset-bottom, 0px));
          max-height: 88vh;
          overflow-y: auto;
          overscroll-behavior: contain;
          animation: epSheetIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .ep-cnc-header {
          margin-bottom: 12px;
        }
        .ep-cnc-title-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .ep-cnc-title-ic {
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
        .ep-cnc-title {
          font-size: 18px;
          font-weight: 700;
          color: #2C2C2A;
          margin: 0;
          letter-spacing: -0.01em;
        }
        .ep-cnc-aviso {
          font-size: 13.5px;
          color: #5F5E5A;
          line-height: 1.5;
          margin: 0 0 16px;
        }
        .ep-cnc-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: #FAF8F5;
          border: 1px solid #F0EBED;
          border-radius: 12px;
          margin-bottom: 16px;
        }
        .ep-cnc-card-ic {
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
        .ep-cnc-card-num {
          font-size: 15px;
          font-weight: 700;
          color: #2C2C2A;
          letter-spacing: -0.01em;
        }
        .ep-cnc-card-sub {
          font-size: 12.5px;
          color: #888780;
          margin-top: 4px;
          font-weight: 600;
        }

        .ep-cnc-section {
          background: #FAF8F5;
          border: 1px solid #F0EBED;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 16px;
        }
        .ep-cnc-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .ep-cnc-section-title {
          font-size: 13.5px;
          font-weight: 700;
          color: #2C2C2A;
          letter-spacing: -0.01em;
        }
        .ep-cnc-section-opt {
          font-size: 12px;
          color: #B4B2A9;
          font-weight: 500;
        }

        .ep-cnc-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 10px;
        }
        .ep-cnc-chip {
          all: unset;
          padding: 6px 12px;
          border: 1px solid #E8E5DC;
          border-radius: 999px;
          font-size: 12.5px;
          font-weight: 600;
          color: #5F5E5A;
          cursor: pointer;
          background: #fff;
          transition: all 0.15s;
        }
        .ep-cnc-chip:hover { background: #F5F1F3; }
        .ep-cnc-chip--sel {
          background: #FCEBEB;
          color: #B91C1C;
          border-color: #F09595;
        }

        .ep-cnc-textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 12px;
          border: 1.5px solid #E8E5DC;
          border-radius: 10px;
          font-size: 13.5px;
          color: #2C2C2A;
          background: #fff;
          font-family: var(--font-base) !important;
          resize: vertical;
          min-height: 68px;
          outline: none;
          transition: border-color 0.15s;
        }
        .ep-cnc-textarea:focus { border-color: #B91C1C; }
        .ep-cnc-textarea::placeholder { color: #B4B2A9; }

        .ep-cnc-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid #E8E5DC;
        }
        .ep-cnc-toggle-info { flex: 1; min-width: 0; }
        .ep-cnc-toggle-t {
          font-size: 13.5px;
          font-weight: 700;
          color: #2C2C2A;
          letter-spacing: -0.01em;
        }
        .ep-cnc-toggle-d {
          font-size: 11.5px;
          color: #888780;
          font-weight: 500;
          margin-top: 3px;
          line-height: 1.35;
        }
        .ep-cnc-switch {
          all: unset;
          width: 42px;
          height: 24px;
          border-radius: 999px;
          background: #E8E5DC;
          position: relative;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.2s;
        }
        .ep-cnc-switch:disabled { opacity: 0.5; cursor: not-allowed; }
        .ep-cnc-switch-dot {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .ep-cnc-switch--on { background: #E85A8C; }
        .ep-cnc-switch--on .ep-cnc-switch-dot { transform: translateX(18px); }

        .ep-cnc-btns {
          display: grid;
          grid-template-columns: 1fr 1.4fr;
          gap: 10px;
        }
        .ep-cnc-btn-danger {
          background: #B91C1C;
          color: #fff;
        }
        .ep-cnc-btn-danger:hover:not(:disabled) { background: #991B1B; }

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
          font-weight: 700;
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
          font-weight: 700;
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
          font-weight: 700;
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
          font-weight: 700;
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
          font-weight: 700;
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
          font-weight: 700;
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
          font-weight: 700;
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
          font-weight: 700;
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
          font-weight: 700;
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
          font-weight: 700;
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
          font-weight: 700;
          color: #2C2C2A;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.01em;
          flex-shrink: 0;
        }
      `}</style>
    </div>
    </>
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

// ══════════════ Ajustar valor do pedido (desconto ou acréscimo, com motivo) ══════════════
function AjusteSheet({ total, onClose, onAplicar }: { total: number; onClose: () => void; onAplicar: (a: { tipo: 'desconto' | 'acrescimo'; valor: number; motivo: string }) => void }) {
  const [tipo, setTipo] = useState<'desconto' | 'acrescimo'>('desconto')
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const MOTIVOS = tipo === 'desconto' ? ['Combinado com a cliente', 'Atraso', 'Arredondamento', 'Cliente fiel'] : ['Taxa de entrega', 'Item a mais', 'Embalagem especial']
  const v = lerBRL(valor)
  const novo = Math.max(0, Math.round((total + (tipo === 'acrescimo' ? v : -v)) * 100) / 100)
  const aplicar = () => {
    if (v <= 0) { setErro('Digite o valor'); return }
    if (tipo === 'desconto' && v > total) { setErro('O desconto passa do valor do pedido'); return }
    onAplicar({ tipo, valor: v, motivo: motivo.trim() })
  }
  return (
    <Folha titulo="Ajustar valor do pedido" sub="O ajuste fica registrado no histórico, com o motivo" onClose={onClose}>
      <p className="fo-lb">O que é?</p>
      <div className="fo-seg"><button type="button" className={tipo === 'desconto' ? 'on' : ''} onClick={() => { setTipo('desconto'); setMotivo('') }}>Desconto</button><button type="button" className={tipo === 'acrescimo' ? 'on' : ''} onClick={() => { setTipo('acrescimo'); setMotivo('') }}>Acréscimo</button></div>
      <label className="fo-lb" htmlFor="aj-v">Valor</label>
      <div className="fo-in"><span>R$</span><input id="aj-v" inputMode="numeric" placeholder="0,00" value={valor} onChange={e => { setValor(mascaraBRL(e.target.value)); setErro('') }} autoFocus /></div>
      <p className="fo-lb">Motivo <em>(opcional)</em></p>
      <div className="fo-chips">{MOTIVOS.map(m => <button type="button" key={m} className={motivo === m ? 'on' : ''} onClick={() => setMotivo(m)}>{m}</button>)}</div>
      <input className="fo-txt" style={{ marginTop: 8 }} placeholder="Ou escreva o motivo" value={MOTIVOS.includes(motivo) ? '' : motivo} onChange={e => setMotivo(e.target.value)} />
      {v > 0 && <div className="fo-dica">O total do pedido vai de <b>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b> para <b>{novo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b>. Vale quando você salvar.</div>}
      {erro && <p className="fo-erro">{erro}</p>}
      <button type="button" className="fo-cta" onClick={aplicar}>Aplicar ajuste</button>
    </Folha>
  )
}

// ══════════════ Estilo da tela nova (ep2-*) ══════════════
const EP2_CSS = `
  .ep2 { background: #F4EEF1 !important; padding-bottom: 150px !important;
    /* encosta nas bordas como o cabeçalho padrão do app (cancela o espaço da página) */
    margin-top: calc(-1 * (var(--pad-page-top, 1.5rem) + env(safe-area-inset-top, 0px))); margin-left: calc(50% - 50vw); margin-right: calc(50% - 50vw); }
  @media (min-width: 768px) { .ep2 { margin: -3rem -2rem 0; } }
  .ep2-qty { display: inline-flex; align-items: center; border: 1.5px solid #EDE6E9; border-radius: 10px; background: #fff; overflow: hidden; }
  .ep2-qty button { width: 34px; height: 34px; border: none; background: none; color: #C33A6E; font-family: inherit; font-size: 18px; font-weight: 800; cursor: pointer; }
  .ep2-qty button:disabled { color: #D6CBD0; cursor: default; }
  .ep2-qty input { width: 38px; height: 34px; border: none; outline: none; text-align: center; font-family: inherit; font-size: 15px; font-weight: 800; color: #2C1219; background: none; -moz-appearance: textfield; }
  .ep2-qty input::-webkit-outer-spin-button, .ep2-qty input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .ep2-hd { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 8px; background: #E85A8C; color: #fff; padding: calc(12px + env(safe-area-inset-top, 0px)) 12px 12px; }
  .ep2-hd-t { flex: 1; min-width: 0; } .ep2-hd-t b { display: block; font-size: 19px; font-weight: 900; letter-spacing: -.01em; line-height: 1.15; } /* título mais perto da linha de baixo */
  .ep2-hd-sub { display: flex; align-items: center; gap: 4px; font-size: 12.5px; line-height: 1.3; opacity: .95; white-space: nowrap; min-width: 0; margin-top: 2px; }
  .ep2-hd-nome { min-width: 0; overflow: hidden; text-overflow: ellipsis; flex-shrink: 1; font-weight: 700; }
  .ep2-hd-quando { flex-shrink: 0; } .ep2-hd-virg { flex-shrink: 0; margin-left: -4px; font-weight: 700; }

  .ep2-hd-bt { width: 36px; height: 36px; border-radius: 11px; border: none; background: rgba(255,255,255,.18); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
  .ep2-hd-bt svg { width: 18px; height: 18px; }
  .ep2-hd-orig { font-size: 11.5px; font-weight: 800; background: rgba(255,255,255,.2); border-radius: 8px; padding: 5px 9px; flex-shrink: 0; }
  @media (max-width: 767px) { .ep2-hd-orig, .ep2-so-desk { display: none !important; } }
  .ep2-st { background: #fff; padding: 16px 14px 14px; display: flex; flex-direction: column; gap: 12px; } /* mais espaço até o cabeçalho rosa */
  .ep2-st-chip { align-self: flex-start; font-size: 11.5px; font-weight: 800; color: #854F0B; background: #FEF0DF; border-radius: 7px; padding: 3px 9px; }
  /* etapas: número em vez de círculo vazio, e uma linha de progresso ligando as etapas */
  .ep2-st-l { display: flex; justify-content: space-between; gap: 4px; position: relative; }
  .ep2-st-l::before, .ep2-st-l::after { content: ""; position: absolute; top: 12px; left: 12.5%; height: 3px; border-radius: 3px; }
  .ep2-st-l::before { right: 12.5%; background: #EFE7EB; }
  .ep2-st-l::after { width: calc(75% * var(--prog, 0)); background: #16A34A; transition: width .3s ease; }
  .ep2-st-p { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; color: #9A8E94; text-align: center; line-height: 1.2; position: relative; z-index: 1; }
  .ep2-st-p i { width: 26px; height: 26px; border-radius: 50%; background: #F1EAEE; color: #A99BA2; display: flex; align-items: center; justify-content: center; font-style: normal; font-size: 12px; font-weight: 800; box-shadow: 0 0 0 3px #fff; }
  .ep2-st-p.ok { color: #2C1219; } .ep2-st-p.ok i { background: #16A34A; color: #fff; }
  .ep2-st-p.atual { color: #C33A6E; } .ep2-st-p.atual i { background: #E85A8C; color: #fff; box-shadow: 0 0 0 3px #fff, 0 0 0 6px rgba(232,90,140,.22); }
  .ep2-st-bt { border: none; background: #2C1219; color: #fff; border-radius: 11px; padding: 11px; font-family: inherit; font-size: 13.5px; font-weight: 800; cursor: pointer; }
  .ep2-st-fim, .ep2-quitado, .ep2-salvo { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; font-weight: 800; color: #15803D; background: #F0FDF4; border-radius: 10px; padding: 9px; }
  .ep2-st-cancel { text-align: center; font-size: 13.5px; font-weight: 800; color: #991B1B; background: #FEF2F2; border-radius: 10px; padding: 10px; }
  .ep2-tabs { display: flex; background: #fff; border-bottom: 1px solid #F0EBED; position: sticky; top: calc(60px + env(safe-area-inset-top, 0px)); z-index: 25; }
  .ep2-tabs { justify-content: center; gap: 2px; } /* abas juntas no centro */
  .ep2-tabs button { flex: none; display: flex; align-items: center; justify-content: center; gap: 6px; border: none; background: none; padding: 12px 12px; font-family: inherit; font-size: 13.5px; font-weight: 700; color: #9A8E94; border-bottom: 2.5px solid transparent; cursor: pointer; position: relative; }
  .ep2-tabs button svg { width: 16px; height: 16px; } .ep2-tabs button.on { color: #C33A6E; border-color: #E85A8C; }
  .ep2-tab-dot { width: 7px; height: 7px; border-radius: 50%; background: #F59E0B; }
  .ep2-grid { padding: 12px; display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
  .ep2-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .ep2-sec { display: none; flex-direction: column; gap: 12px; } .ep2-sec.ativa { display: flex; }
  @media (min-width: 1024px) {
    .ep2-tabs { display: none; }
    .ep2-sec { display: flex !important; }
    .ep2-grid { grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 16px; padding: 18px 24px; max-width: 1200px; margin: 0 auto; align-items: start; }
    .ep2-col-dir { position: sticky; top: 150px; }
    .ep2-st { flex-direction: row; align-items: center; justify-content: space-between; padding: 12px 24px; } .ep2-st-l { flex: 1; max-width: 560px; }
    .ep2-hd { padding: 16px 24px; } .ep2-foot { display: none !important; }
  }
  .ep2-card, .ep2-cli, .ep2-save-desk { background: #fff; border: 1px solid #EADFE4; border-radius: 16px; padding: 14px; box-shadow: 0 1px 2px rgba(44,18,25,.05), 0 8px 22px -6px rgba(44,18,25,.10); }
  .ep2-ct { margin: 0 0 8px; font-size: 15px; font-weight: 900; color: #2C1219; } .ep2-ct em { font-style: normal; color: #9A8E94; font-weight: 700; }
  .ep2-cli { display: flex; align-items: center; gap: 10px; padding: 10px 12px; }
  .ep2-av { width: 40px; height: 40px; border-radius: 50%; background: #FCE7F3; color: #C33A6E; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; flex-shrink: 0; }
  .ep2-cli-t { flex: 1; min-width: 0; } .ep2-cli-t b { display: block; font-size: 14.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .ep2-cli-t small { font-size: 12px; color: #888780; }
  .ep2-lk { border: none; background: none; padding: 4px 6px; font-family: inherit; font-size: 13px; font-weight: 800; color: #C33A6E; cursor: pointer; }
  .ep2-wa { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 800; color: #15803D; background: #DCFCE7; border-radius: 8px; padding: 6px 9px; text-decoration: none; flex-shrink: 0; }
  /* cartão da cliente (opção A) */
  .ep2-ca, .ep2-cv { background: #fff; border: 1px solid #EADFE4; border-radius: 16px; padding: 12px; box-shadow: 0 1px 2px rgba(44,18,25,.05), 0 8px 22px -6px rgba(44,18,25,.10); }
  .ep2-cv { display: flex; align-items: center; gap: 10px; border-style: dashed; border-color: #F3C9DA; box-shadow: none; background: #FFFAFC; }
  .ep2-ca-top { display: flex; align-items: center; gap: 10px; width: 100%; border: none; background: none; padding: 0; font-family: inherit; text-align: left; color: #2C1219; cursor: pointer; }
  .ep2-ca .ep2-av, .ep2-cv .ep2-av { width: 44px; height: 44px; background: #F1EDEF; color: #6B5D64; object-fit: cover; }
  .ep2-av.vz { border: 2px dashed #DDD0D6; color: #A99BA2; } .ep2-av.vz svg { width: 18px; height: 18px; }
  .ep2-ca .ep2-cli-t b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; } .ep2-cli-rot { font-weight: 600; color: #8A7E84; }
  .ep2-ca .ep2-cli-t small, .ep2-cv .ep2-cli-t small { display: block; line-height: 1.35; margin-top: 2px; }
  .ep2-ca .ep2-tag { display: table; }
  .ep2-ca-chev { color: #C9BEC3; flex-shrink: 0; }
  .ep2-tag { display: inline-block; margin-top: 4px; font-size: 11px; font-weight: 800; border-radius: 6px; padding: 2px 8px; } .ep2-tag.nova { background: #E0F2FE; color: #075985; }
  .ep2-ca-st { display: none; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; background: #FAF7F8; border-radius: 11px; padding: 8px; }
  @media (min-width: 1024px) { .ep2-ca-st { display: grid; } }
  .ep2-ca-st span { text-align: center; } .ep2-ca-st b { display: block; font-size: 14px; font-weight: 700; } .ep2-ca-st small { font-size: 11px; color: #888780; }
  .ep2-aniv { display: flex; gap: 8px; align-items: flex-start; margin-top: 10px; background: #FFF1F6; border-radius: 10px; padding: 9px 10px; font-size: 12.5px; color: #9D174D; line-height: 1.4; }
  .ep2-aniv svg { flex-shrink: 0; margin-top: 1px; }
  .ep2-ca-bts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; }
  .ep2-cb { display: flex; align-items: center; justify-content: center; gap: 5px; border: 1.5px solid #EDE6E9; background: #fff; border-radius: 11px; padding: 9px 4px; font-family: inherit; font-size: 13px; font-weight: 800; color: #4B3A42; text-decoration: none; cursor: pointer; }
  .ep2-cb.wa { background: #16A34A; border-color: #16A34A; color: #fff; }
  .ep2-cb.mute { grid-column: span 2; color: #9A8E94; font-weight: 600; border-style: dashed; } .ep2-cb.mute u { color: #C33A6E; font-weight: 800; }
  .ep2-add { display: inline-flex; align-items: center; gap: 4px; border: none; background: #E85A8C; color: #fff; border-radius: 10px; padding: 9px 11px; font-family: inherit; font-size: 13px; font-weight: 800; cursor: pointer; flex-shrink: 0; }
  /* itens (03/10): fechados com resumo no celular, abrem ao tocar; no computador ficam abertos */
  .ep2-sec-h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 8px; }
  .ep2-sec-h .ep2-ct { margin: 0; } .ep2-sec-h span { font-size: 12.5px; color: #6B5D64; white-space: nowrap; } .ep2-sec-h span b { color: #2C1219; font-weight: 700; }
  .ep2-it { padding: 0 !important; overflow: hidden; }
  .ep2-it-h { display: flex; align-items: center; gap: 10px; width: 100%; border: none; background: none; padding: 10px; font-family: inherit; text-align: left; color: #2C1219; cursor: pointer; }
  .ep2-it-h .ep2-it-n { flex: 1; min-width: 0; } .ep2-it-h .ep2-it-n b { font-size: 14.5px; }
  .ep2-it-res { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 12px; color: #888780; line-height: 1.35; margin-top: 2px; }
  .ep2-it-marcas { display: block; font-style: normal; font-size: 11px; font-weight: 700; color: #B08A9A; margin-top: 2px; }
  .ep2-it-r { flex-shrink: 0; text-align: right; } .ep2-it-r b { display: block; font-size: 14.5px; font-weight: 700; } .ep2-it-r small { font-size: 11.5px; color: #888780; }
  .ep2-it-chev { color: #C9BEC3; flex-shrink: 0; transition: transform .2s ease; } .ep2-it.aberto .ep2-it-chev { transform: rotate(180deg); }
  .ep2-it-det { display: none; border-top: 1px solid #F5F0F2; padding: 4px 12px 12px; } .ep2-it.aberto .ep2-it-det { display: block; }
  .ep2-it-det > .ep2-chip { margin-top: 8px; }
  @media (min-width: 1024px) { .ep2-it-det { display: block; } .ep2-it-chev, .ep2-it-marcas { display: none; } .ep2-it-h { cursor: default; } .ep2-it-res { display: none; } }
  .ep2-toast--desfazer { display: flex; align-items: center; gap: 14px; justify-content: space-between; min-width: 260px; }
  .ep2-toast--desfazer::before { content: none; }
  .ep2-toast--desfazer button { border: none; background: none; color: #C33A6E; font-family: inherit; font-size: 14px; font-weight: 800; cursor: pointer; padding: 2px 4px; }
  /* ══ itens em estilo cupom (03/10): sempre abertos, valores em coluna, personalização como anexo grampeado ══ */
  .ep2-cupom { position: relative; background: #FFFDF8; border-radius: 10px 10px 0 0; padding: 14px 14px 16px; margin-bottom: 10px; box-shadow: 0 10px 24px -12px rgba(44,18,25,.28); font-variant-numeric: tabular-nums; }
  .ep2-cupom::after { content: ""; position: absolute; left: 0; right: 0; bottom: -8px; height: 8px; background: radial-gradient(circle at 7px 0, #FFFDF8 6.5px, transparent 7px) 0 0 / 14px 8px repeat-x; } /* borda serrilhada */
  .ep2-cup-h { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 4px; } /* sem a linha tracejada embaixo do título */
  .ep2-cup-h b { font-size: 12px; font-weight: 900; letter-spacing: .12em; color: #2C1219; } .ep2-cup-h span { font-size: 12px; font-weight: 700; color: #9A8E94; }
  .ep2-cup-it { padding: 10px 0 11px; border-bottom: 1.5px dashed #E6DADF; display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 10px; align-items: start; }
  .ep2-cup-f { position: relative; width: 44px; height: 44px; border-radius: 11px; background: #F3EEF1; color: #B5A6AD; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-top: 1px; }
  .ep2-cup-f svg { width: 20px; height: 20px; } .ep2-cup-f img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .ep2-cup-c { min-width: 0; }
  .ep2-cup-ih { display: flex; align-items: baseline; gap: 6px; }
  .ep2-cup-q { font-size: 13.5px; font-weight: 900; color: #C33A6E; min-width: 26px; flex-shrink: 0; }
  .ep2-cup-n { font-size: 15px; font-weight: 800; color: #2C1219; min-width: 0; }
  .ep2-cup-ih i, .ep2-cup-l i { flex: 1; border-bottom: 1.5px dotted #D6C8CF; transform: translateY(-3px); min-width: 12px; }
  .ep2-cup-v { font-size: 15px; font-weight: 700; color: #2C1219; white-space: nowrap; }
  .ep2-cup-mx { align-self: center; border: none; background: #F5EEF1; color: #8C7B84; width: 30px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; margin-left: 2px; }
  .ep2-cup-l { display: flex; align-items: baseline; gap: 6px; font-size: 13px; color: #4B3A42; padding: 3px 0 0 0; line-height: 1.35; }
  .ep2-cup-l b { font-weight: 700; color: #2C1219; white-space: nowrap; }
  .ep2-cup-un span { font-size: 12px; color: #9A8E94; }
  .ep2-anexo { position: relative; margin: 14px 4px 4px 0; background: #fff; border: 1.5px dashed #F3A9C6; border-radius: 12px; padding: 12px; transform: rotate(-.6deg); box-shadow: 0 6px 14px -8px rgba(195,58,110,.35); }
  .ep2-anexo-clip { position: absolute; top: -12px; left: 16px; width: 26px; height: 26px; border-radius: 50%; background: #fff; color: #C33A6E; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 4px rgba(0,0,0,.18); }
  .ep2-anexo-t { margin: 2px 0 8px; font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: #C33A6E; }
  .ep2-anexo-foto { position: relative; display: block; width: 100%; height: 150px; border-radius: 10px; overflow: hidden; background: linear-gradient(135deg, #F7C6D9, #C9B4F5); }
  .ep2-anexo-foto img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .ep2-anexo-ph { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); color: #fff; }
  .ep2-anexo-zm { position: absolute; right: 8px; bottom: 8px; display: inline-flex; align-items: center; gap: 4px; background: rgba(44,18,25,.78); color: #fff; font-size: 12px; font-weight: 800; border-radius: 8px; padding: 5px 9px; }
  .ep2-anexo-rec { display: flex; gap: 8px; align-items: flex-start; margin-top: 10px; font-size: 14px; color: #2C1219; line-height: 1.4; font-style: italic; }
  .ep2-anexo-rec svg { color: #E85A8C; flex-shrink: 0; margin-top: 2px; }
  .ep2-anexo-foto + .ep2-anexo-rec { margin-top: 10px; } .ep2-anexo-t + .ep2-anexo-rec { margin-top: 0; }
  .ep2-cup-tot { padding-top: 10px; } .ep2-cup-tot > span { font-size: 12px; color: #9A8E94; }
  .ep2-cup-tot > div { display: flex; justify-content: space-between; align-items: baseline; border-top: 1.5px solid #2C1219; margin-top: 7px; padding-top: 8px; }
  .ep2-cup-tot > div b:first-child { font-size: 15px; font-weight: 800; } .ep2-cup-tot > div b:last-child { font-size: 17px; font-weight: 700; }
  .ep2-cupom .ep2-addi { margin-top: 12px; }
  .ep2-im-lb { font-size: 13px; font-weight: 800; color: #4B3A42; margin: 12px 4px 6px; } .ep2-im-lb em { font-style: normal; font-weight: 500; color: #9A8E94; }
  .ep2-sh .ep2-qty { align-self: flex-start; margin-left: 4px; }
  .ep2-im-rec { width: 100%; box-sizing: border-box; border: 1.5px solid #EDE6E9; border-radius: 12px; padding: 10px 12px; font-family: inherit; font-size: 15px; color: #2C1219; resize: vertical; }
  .ep2-im-rec:focus { outline: none; border-color: #E85A8C; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .ep2-im-bts { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding: 0 4px; }
  .ep2-im-bts .ep2-b1 { padding: 12px 26px; }
  /* ══ aba Entrega (03/10) ══ */
  .ep2-seg2 { display: flex; background: #E9DFE4; border-radius: 13px; padding: 3px; }
  .ep2-seg2 button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px; border: none; background: none; border-radius: 11px; padding: 11px; font-family: inherit; font-size: 14.5px; font-weight: 800; color: #6B5D64; cursor: pointer; }
  .ep2-seg2 button svg { width: 17px; height: 17px; } .ep2-seg2 button.on { background: #fff; color: #C33A6E; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .ep2-when { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 8px; }
  .ep2-when button { display: flex; align-items: center; gap: 8px; border: 1.5px solid #EDE6E9; background: #fff; border-radius: 12px; padding: 11px 12px; font-family: inherit; font-size: 14.5px; color: #2C1219; cursor: pointer; text-align: left; min-width: 0; }
  .ep2-when button svg { color: #C33A6E; flex-shrink: 0; width: 16px; height: 16px; } .ep2-when b { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ep2-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 9px; }
  .ep2-chips button { display: inline-flex; align-items: center; gap: 4px; border: 1.5px solid #EDE6E9; background: #fff; border-radius: 99px; padding: 7px 12px; font-family: inherit; font-size: 13px; font-weight: 700; color: #4B3A42; cursor: pointer; }
  .ep2-chips button.on { border-color: #E85A8C; background: #FFF1F6; color: #C33A6E; }
  .ep2-addr { display: flex; gap: 10px; align-items: flex-start; background: #FAF7F8; border-radius: 12px; padding: 11px; }
  .ep2-addr > svg { color: #C33A6E; flex-shrink: 0; margin-top: 1px; } .ep2-addr > div { flex: 1; min-width: 0; }
  .ep2-addr b { display: block; font-size: 15px; font-weight: 700; color: #2C1219; } .ep2-addr small { display: block; font-size: 13px; color: #6B5D64; margin-top: 2px; line-height: 1.35; }
  .ep2-addr .ep2-lk { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; }
  .ep2-acts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 9px; } .ep2-acts.dois { grid-template-columns: 1fr 1.6fr; }
  .ep2-acts > * { display: flex; align-items: center; justify-content: center; gap: 5px; border: 1.5px solid #EDE6E9; background: #fff; border-radius: 11px; padding: 10px 4px; font-family: inherit; font-size: 13px; font-weight: 800; color: #4B3A42; text-decoration: none; cursor: pointer; }
  .ep2-acts > .wa { background: #16A34A; border-color: #16A34A; color: #fff; }
  .ep2-usar { display: flex; flex-direction: column; gap: 2px; width: 100%; text-align: left; background: #FFF1F6; border: 1.5px dashed #F3A9C6; border-radius: 12px; padding: 10px 12px; font-family: inherit; font-size: 13.5px; font-weight: 800; color: #C33A6E; cursor: pointer; margin-bottom: 4px; }
  .ep2-usar span { font-weight: 600; color: #6B5D64; font-size: 12.5px; }
  .ep2-lb { display: block; font-size: 12.5px; font-weight: 800; color: #4B3A42; margin: 10px 0 5px; }
  .ep2-in { width: 100%; box-sizing: border-box; height: 46px; border: 1.5px solid #EDE6E9; border-radius: 11px; padding: 0 12px; font-family: inherit; font-size: 15px; color: #2C1219; background: #fff; min-width: 0; }
  div.ep2-in { display: flex; align-items: center; gap: 8px; } div.ep2-in input { flex: 1; min-width: 0; border: none; outline: none; font: inherit; color: inherit; background: none; height: 100%; }
  div.ep2-in em { font-style: normal; font-size: 12px; font-weight: 700; color: #9A8E94; white-space: nowrap; } div.ep2-in em.ok { color: #15803D; } div.ep2-in.ok { border-color: #86EFAC; }
  input.ep2-in:focus, div.ep2-in:focus-within { outline: none; border-color: #E85A8C; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .ep2-row-rn { display: grid; grid-template-columns: minmax(0, 1fr) 92px; gap: 8px; } .ep2-row-bc { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
  .ep2-end-fim { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; } .ep2-end-fim .ep2-b1 { padding: 11px 18px; font-size: 14px; }
  .ep2-lk.cinza { color: #9A8E94; }
  .ep2-taxa { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding-top: 11px; border-top: 1px solid #F3EEF1; font-size: 13.5px; color: #4B3A42; }
  .ep2-taxa > svg { color: #9A8E94; } .ep2-taxa .ep2-mini { margin-left: auto; }
  .ep2-nota { margin: 9px 0 0; font-size: 12px; color: #9A8E94; } .ep2-nota .ep2-lk, .ep2-vazio .ep2-lk { padding: 0; font-size: inherit; text-decoration: underline; }
  .ep2-cal-h { display: flex; justify-content: space-between; align-items: center; margin: 10px 4px 6px; } .ep2-cal-h b { font-size: 15px; }
  .ep2-cal-h button { width: 32px; height: 32px; border-radius: 9px; border: none; background: #FFF1F6; color: #C33A6E; font-size: 18px; font-weight: 800; cursor: pointer; }
  .ep2-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; text-align: center; padding: 0 2px; }
  .ep2-cal i { font-style: normal; font-size: 11px; font-weight: 800; color: #9A8E94; padding: 4px 0; }
  .ep2-cal button { border: none; background: none; border-radius: 9px; padding: 8px 0; font-family: inherit; font-size: 14px; color: #2C1219; cursor: pointer; }
  .ep2-cal button.hj { box-shadow: inset 0 0 0 1.5px #E85A8C; } .ep2-cal button.sel { background: #E85A8C; color: #fff; font-weight: 800; }
  .ep2-cal-ok { width: 100%; margin-top: 14px; }
  /* ══ itens do pedido (03/10): modelo aprovado — nome numa linha, campos com rótulo, adicionais em caixinhas
        (uma por linha), referência grande e centralizada, valor no fim. Nada quebra linha (só o recado). ══ */
  .ep3 { background: #fff; border-radius: 16px; padding: 14px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(44,18,25,.05), 0 8px 22px -6px rgba(44,18,25,.10); border: 1px solid #EADFE4; font-variant-numeric: tabular-nums; }
  .ep3-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; } .ep3-h b { font-size: 15.5px; font-weight: 800; color: #2C1219; } .ep3-h span { font-size: 12.5px; font-weight: 600; color: #9A8E94; }
  .ep3-it { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 10px; padding: 13px 0; border-top: 1px solid #F2ECEF; }
  .ep3-h + .ep3-it { border-top: none; }
  .ep3-c { min-width: 0; }
  .ep3-nmw { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; } .ep3-nmw .ep3-nm { flex: 1; min-width: 0; margin: 0; }
  .ep3-add-h { display: inline-flex; align-items: center; gap: 4px; border: none; background: #FDF2F6; color: #C33A6E; border-radius: 10px; padding: 7px 11px; font-family: inherit; font-size: 13.5px; font-weight: 800; cursor: pointer; }
  .ep3-cont { margin: 8px 0 0; padding-top: 10px; border-top: 1px solid #F2ECEF; font-size: 12.5px; color: #9A8E94; text-align: center; }
  .ep3-nm { margin: 0 0 4px; font-size: 15.5px; font-weight: 700; color: #2C1219; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ep3-nm em { font-style: normal; font-weight: 800; color: #C33A6E; }
  .ep3-cp { margin: 0; font-size: 13.5px; color: #2C1219; line-height: 1.55; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .ep3-cp span { color: #8A7E84; }
  .ep3-ads { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; margin-top: 3px; min-width: 0; } .ep3-ads > span:first-child { font-size: 13.5px; color: #8A7E84; }
  .ep3-ad { display: inline-flex; gap: 5px; max-width: 100%; box-sizing: border-box; white-space: nowrap; font-size: 12.5px; font-weight: 600; color: #2C1219; border: 1.5px solid #E8DDE2; border-radius: 8px; padding: 3px 9px; background: #fff; }
  .ep3-ad > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; } /* só o nome encolhe */
  .ep3-ad b { flex-shrink: 0; font-weight: 700; color: #C33A6E; } /* o valor fica sempre visível */
  .ep3-obs { margin-top: 10px; } .ep3-obs small { display: block; font-size: 12px; font-weight: 700; color: #8A7E84; }
  .ep3-ref { display: flex; justify-content: center; margin: 7px 0 2px -54px; } /* centralizada no item inteiro */
  .ep3-ref a { position: relative; display: block; width: 100%; max-width: 260px; height: 180px; border-radius: 12px; overflow: hidden; background: linear-gradient(135deg, #F7C6D9, #C9B4F5); box-shadow: 0 6px 16px -8px rgba(44,18,25,.35); }
  .ep3-ref img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .ep3-obs p { margin: 6px 0 0; font-size: 13.5px; font-style: italic; color: #2C1219; line-height: 1.45; }
  .ep3-conta { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #EDE4E8; }
  .ep3-conta small { display: block; font-size: 11.5px; color: #A99CA2; margin-bottom: 2px; }
  .ep3-conta p { display: flex; justify-content: space-between; gap: 10px; margin: 0; font-size: 13px; line-height: 1.6; white-space: nowrap; }
  .ep3-conta p span { color: #8A7E84; overflow: hidden; text-overflow: ellipsis; } .ep3-conta p b { font-weight: 600; color: #2C1219; }
  .ep3-conta p.promo span, .ep3-conta p.promo b { color: #15803D; }
  .ep3-conta + .ep3-vl { margin-top: 4px; }
  .ep3-vl { display: flex; align-items: center; gap: 6px; margin-top: 9px; } .ep3-vl > span { font-size: 13.5px; color: #8A7E84; } .ep3-vl small { font-size: 12px; color: #A99CA2; white-space: nowrap; }
  .ep3-vl b { margin-left: auto; font-size: 16px; font-weight: 700; color: #2C1219; white-space: nowrap; }
  .ep3-pv { padding: 9px 0; border-bottom: 1px solid #F2ECEF; } .ep2-ct + .ep3-pv { padding-top: 2px; }
  .ep3-pv-h { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .ep3-pv-h span { font-size: 14px; font-weight: 700; color: #2C1219; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .ep3-pv-h em { font-style: normal; font-weight: 800; color: #C33A6E; }
  .ep3-pv-h b { font-size: 14.5px; font-weight: 700; white-space: nowrap; }
  .ep3-pv p { margin: 2px 0 0; font-size: 12.5px; color: #8A7E84; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ep3-pv-d { margin-top: 4px; }
  .ep3-pv-d p { display: flex; justify-content: space-between; gap: 10px; margin: 0; font-size: 12.5px; line-height: 1.65; color: #8A7E84; white-space: nowrap; }
  .ep3-pv-d p span { min-width: 0; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px; } .ep3-pv-d p b { font-weight: 600; color: #6B5D64; flex-shrink: 0; }
  .ep3-pv-d p.pr span, .ep3-pv-d p.pr b { color: #15803D; }
  .ep3-pv-itens { margin-top: 6px; }
  .ep3-tot { margin-top: 4px; padding-top: 10px; border-top: 1px solid #2C1219; } .ep3-tot > span { font-size: 12px; color: #9A8E94; }
  .ep3-tot > div { display: flex; justify-content: space-between; align-items: baseline; margin-top: 3px; } .ep3-tot > div span { font-size: 14.5px; font-weight: 700; } .ep3-tot > div b { font-size: 17px; font-weight: 700; }
  .ep3-add { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; margin-top: 12px; border: none; border-radius: 12px; padding: 11px; background: #FDF2F6; color: #C33A6E; font-family: inherit; font-size: 14px; font-weight: 800; cursor: pointer; }
  .ep2-it { border: 1.5px solid #F0EBED; border-radius: 14px; padding: 12px; margin-bottom: 10px; background: #FEFCFD; }
  .ep2-it-top { display: flex; gap: 10px; align-items: center; }
  .ep2-it-f { width: 44px; height: 44px; border-radius: 12px; background: #FCE7F3; color: #C33A6E; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
  .ep2-it-f { position: relative; } .ep2-it-f img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; } /* se a foto não carregar, aparece o ícone por baixo */ .ep2-it-f svg { width: 20px; height: 20px; }
  .ep2-it-n { flex: 1; min-width: 0; } .ep2-it-n b { display: block; font-size: 15px; font-weight: 800; color: #2C1219; }
  .ep2-chip { display: inline-block; margin: 4px 4px 0 0; font-size: 11.5px; font-weight: 800; color: #993556; background: #FCE0E9; border-radius: 7px; padding: 3px 8px; }
  .ep2-esc { margin-top: 10px; border-top: 1px solid #F5F0F2; padding-top: 7px; }
  .ep2-ln { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-size: 13.5px; padding: 4px 0; color: #4B3A42; }
  .ep2-ln span { color: #888780; } .ep2-ln b { font-weight: 700; color: #2C1219; text-align: right; } .ep2-ln.neg b { color: #DC2626; } .ep2-card > .ep2-ln.promo span, .ep2-ln.promo b { color: #15803D; }
  .ep2-card > .ep2-ln span { color: #4B3A42; }
  .ep2-ln.tt { border-top: 1px solid #F0EBED; margin-top: 6px; padding-top: 10px; font-size: 15.5px; } .ep2-ln.tt span { color: #2C1219; font-weight: 800; } .ep2-ln.tt b { font-size: 18px; }
  .ep2-ln-in { align-items: center; }
  .ep2-mini { display: inline-flex; align-items: center; gap: 4px; border: 1.5px solid #EDE6E9; border-radius: 9px; padding: 4px 8px; width: 110px; background: #fff; }
  .ep2-mini em { font-style: normal; font-size: 12px; color: #9A8E94; font-weight: 700; }
  .ep2-mini input { width: 100%; min-width: 0; border: none; outline: none; font-family: inherit; font-size: 14px; font-weight: 700; color: #2C1219; text-align: right; background: none; }
  .ep2-sab { display: flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 700; color: #2C1219; padding: 3px 0; } .ep2-sab svg { color: #E85A8C; }
  .ep2-ad { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 8px; background: #FFF6F9; border-radius: 10px; padding: 8px 10px; font-size: 13px; font-weight: 700; color: #2C1219; }
  .ep2-ad span { display: flex; align-items: center; gap: 6px; } .ep2-ad b { color: #C33A6E; white-space: nowrap; }
  .ep2-foto { display: flex; align-items: center; gap: 10px; margin-top: 8px; border: 1.5px solid #EDE6E9; border-radius: 12px; padding: 7px; text-decoration: none; color: #2C1219; }
  .ep2-foto-i { width: 46px; height: 46px; border-radius: 10px; background: linear-gradient(135deg, #F7C6D9, #C4B5FD); display: flex; align-items: center; justify-content: center; color: #fff; overflow: hidden; position: relative; flex-shrink: 0; }
  .ep2-foto-i img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .ep2-foto b { display: block; font-size: 13px; } .ep2-foto small { font-size: 11.5px; color: #888780; }
  .ep2-ob { display: flex; gap: 7px; align-items: flex-start; width: 100%; text-align: left; margin-top: 8px; background: #FFFBEB; border: none; border-radius: 10px; padding: 8px 10px; font-family: inherit; font-size: 12.5px; color: #92400E; line-height: 1.4; cursor: pointer; }
  .ep2-ob svg { flex-shrink: 0; margin-top: 2px; }
  .ep2-recado-ed { display: flex; gap: 6px; align-items: center; margin-top: 8px; } .ep2-recado-ed .ep-input { flex: 1; }
  .ep2-pr { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-top: 10px; padding-top: 8px; border-top: 1px solid #F5F0F2; font-size: 12px; color: #6B5D64; }
  .ep2-pr b { font-size: 16px; font-weight: 700; color: #2C1219; white-space: nowrap; }
  .ep2-ac { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 10px; }
  .ep2-rm { display: inline-flex; align-items: center; gap: 5px; border: none; background: none; font-family: inherit; font-size: 13px; font-weight: 800; color: #DC2626; cursor: pointer; padding: 6px 2px; }
  .ep2-addi { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; border: 2px dashed #F3C9DA; border-radius: 12px; padding: 12px; background: #FFF6F9; color: #C33A6E; font-family: inherit; font-weight: 800; font-size: 14px; cursor: pointer; }
  .ep2-ajs { display: flex; flex-direction: column; gap: 3px; margin-top: 8px; font-size: 12px; color: #9A8E94; }
  .ep2-aj { display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; border: none; background: none; padding: 4px 0; font-family: inherit; font-size: 12.5px; font-weight: 600; color: #B0809A; cursor: pointer; } /* mais leve */
  .ep2-vazio { margin: 2px 0 6px; font-size: 13px; color: #888780; line-height: 1.45; }
  .ep2-pg { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid #F5F0F2; } .ep2-pg:first-of-type { border-top: none; }
  .ep2-pg-ic { width: 32px; height: 32px; border-radius: 10px; background: #DCFCE7; color: #15803D; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .ep2-pg > div { flex: 1; min-width: 0; } .ep2-pg div b { display: block; font-size: 13.5px; color: #2C1219; } .ep2-pg small { font-size: 12px; color: #888780; }
  .ep2-pg .v { font-size: 14px; font-weight: 700; color: #15803D; white-space: nowrap; }
  .ep2-pg-x { width: 32px; height: 32px; border-radius: 9px; border: 1.5px solid #EDE6E9; background: #fff; color: #9A8E94; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
  .ep2-pg.est { opacity: .5; } .ep2-pg.est .v, .ep2-pg.est div b { text-decoration: line-through; }
  .ep2-falta { margin-top: 10px; background: #FFFBEB; border-radius: 12px; padding: 10px 12px; }
  .ep2-falta > div:first-child { display: flex; justify-content: space-between; align-items: baseline; } .ep2-falta small { font-size: 12.5px; font-weight: 700; color: #92400E; } .ep2-falta b { font-size: 18px; font-weight: 700; color: #B45309; }
  .ep2-bar { height: 6px; border-radius: 9px; background: #FDE68A; margin-top: 7px; overflow: hidden; } .ep2-bar i { display: block; height: 100%; background: #22C55E; border-radius: 9px; }
  .ep2-rec { margin-top: 10px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; border: none; border-radius: 12px; padding: 13px; background: #16A34A; color: #fff; font-family: inherit; font-weight: 800; font-size: 14.5px; cursor: pointer; box-shadow: 0 6px 14px -6px rgba(22,163,74,.6); }
  .ep2-prev { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 10px; font-size: 12.5px; color: #6B5D64; }
  .ep2-prev-d { width: 150px; } .ep2-prev-d .cdata { height: 36px; font-size: 13.5px; padding: 0 10px; }
  .ep2-prev em { font-style: normal; font-weight: 700; color: #2C1219; }
  .ep2-save-desk { display: none; } @media (min-width: 1024px) { .ep2-save-desk { display: flex; flex-direction: column; gap: 8px; } }
  .ep2-mud { font-size: 12.5px; font-weight: 800; color: #B45309; text-align: center; }
  .ep2-b1, .ep2-b2 { border: none; border-radius: 12px; padding: 13px; font-family: inherit; font-size: 14.5px; font-weight: 800; cursor: pointer; }
  .ep2-b1 { background: #E85A8C; color: #fff; box-shadow: 0 3px 0 #C33A6E; } .ep2-b1.ok { background: #16A34A; box-shadow: none; } .ep2-b2 { background: #F3EEF1; color: #4B3A42; }
  .ep2-b1:disabled, .ep2-b2:disabled { opacity: .7; cursor: default; }
  .ep2-foot { position: fixed; left: 0; right: 0; bottom: calc(56px + env(safe-area-inset-bottom, 0px)); z-index: 40; background: #fff; border-top: 1px solid #F0EBED; box-shadow: 0 -6px 16px rgba(44,18,25,.08); padding: 8px 12px 10px; display: grid; grid-template-columns: 1fr 1.6fr; gap: 8px; animation: ep2Sobe .2s ease; }
  html.teclado-aberto .ep2-foot { bottom: var(--teclado, 0px); }
  .ep2-foot .ep2-mud { grid-column: 1 / -1; }
  @keyframes ep2Sobe { from { transform: translateY(20px); opacity: 0; } to { transform: none; opacity: 1; } }
  .ep2-toast { position: fixed; left: 50%; bottom: calc(150px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 1400; display: inline-flex; align-items: center; gap: 8px; background: #fff; color: #2C1219; padding: 9px 15px 9px 11px; border-radius: 99px; border: 1px solid #EDE4E8; font-size: 13px; font-weight: 600; box-shadow: 0 6px 18px -6px rgba(44,18,25,.25); max-width: calc(100vw - 32px); white-space: nowrap; animation: ep2ToastIn .2s ease; }
  .ep2-toast::before { content: "✓"; display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: #DCFCE7; color: #15803D; font-size: 11px; font-weight: 900; flex-shrink: 0; }
  @keyframes ep2ToastIn { from { opacity: 0; transform: translate(-50%, 6px); } to { opacity: 1; transform: translate(-50%, 0); } }
  .ep2-ov { position: fixed; inset: 0; z-index: 1300; background: rgba(45,31,38,.5); display: flex; align-items: flex-end; justify-content: center; font-family: var(--font-base); }
  @media (min-width: 768px) { .ep2-ov { align-items: center; } }
  .ep2-sh { width: 100%; max-width: 440px; background: #fff; border-radius: 22px 22px 0 0; padding: 10px 14px calc(16px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; gap: 2px; max-height: 88dvh; overflow-y: auto; }
  @media (min-width: 768px) { .ep2-sh { border-radius: 22px; } }
  .ep2-alca { display: block; width: 40px; height: 4px; border-radius: 9px; background: #E5DDE1; margin: 0 auto 10px; }
  .ep2-sh-t { font-size: 17px; font-weight: 900; color: #2C1219; padding: 2px 6px 8px; }
  .ep2-mi { display: flex; align-items: center; gap: 12px; border: none; background: none; border-radius: 12px; padding: 13px 10px; font-family: inherit; font-size: 15px; font-weight: 700; color: #2C1219; cursor: pointer; text-align: left; }
  .ep2-mi:hover { background: #FAF7F8; } .ep2-mi svg { width: 18px; height: 18px; color: #6B5D64; } .ep2-mi.perigo, .ep2-mi.perigo svg { color: #DC2626; }
  .ep2-mi.sel { background: #FFF1F6; } .ep2-mi em { margin-left: auto; font-style: normal; font-size: 12px; font-weight: 800; color: #C33A6E; }
  .ep2-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .ep2-devol { margin: 12px 0 4px; border: 1.5px solid #FDE68A; background: #FFFBEB; border-radius: 12px; padding: 10px 12px; }
  .ep2-devol b { display: block; font-size: 13.5px; color: #92400E; margin-bottom: 8px; }
  .ep2-devol label { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: #4B3A42; padding: 5px 0; cursor: pointer; line-height: 1.35; }
  .ep2-devol input { margin-top: 2px; accent-color: #E85A8C; }
`


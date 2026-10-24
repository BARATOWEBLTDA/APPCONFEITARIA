import CalendarioSheet from '@/components/CalendarioSheet'
import { useState, useEffect, useMemo, useRef } from 'react'
import { criarPedido, novoIdTentativa, lerProdutosDeVenda, opcoesDoProduto as opcoesDoProdutoLib, opcaoKitLivre, quantidadesSugeridas, precoDeVenda, totalDe, type DadosPedido } from '@/lib/pedidosDoo'
import { gerarPedidoPDF } from '@/lib/gerarPedidoPDF'
import { abrirJanela } from '@/lib/pdfDoonly'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { erroDeConexao, explicarErro } from '@/lib/erros'
import { r2 } from '@/lib/moeda'
import { digitosTelefone } from '@/lib/telefone'
import { voltarOuIr } from '@/lib/voltar'
import AppPageHeader from '@/components/AppPageHeader'
import { COMO_NOVA_VENDA, TOUR_NOVA_VENDA } from "@/lib/comoTelas";
import HorarioSheet from '@/components/HorarioSheet'
import { tocarSom } from '@/hooks/useSom'
import { Bank, CalendarBlank, CalendarDots, Check, Clock, Copy, CreditCard, Lightning, MagnifyingGlass, Minus, Money, Package, Plus, QrCode, Storefront, Trash, Truck, UserPlus, WarningCircle, X } from '@phosphor-icons/react'
import { Botao, BotaoIcone, Campo, CampoArea, Janela, Linha, TelaVazia, Titulo, avisar, confirmar } from '@/components/base'
import { historicoAssentado } from '@/components/base/useSobreposicao'
import { dataLonga, itemComQtd, nomeDeProduto, recebidoPedido, rs, saldoPedido, telefoneBonito } from '@/components/pedidos/pedidoTexto'
import { pesoLivre } from '@/lib/itemPedido'
import '@/components/pedidos/telaPedido.css'
import './novaVenda.css'

// ── Tipos ─────────────────────────────────────────────────────────────────
type TipoVenda = 'encomenda' | 'pronta_entrega' | null
type TipoEntrega = 'retirada' | 'entrega'
type SituacaoPag = 'total' | 'parcial' | 'fiado' | 'na_entrega'

interface ItemVenda {
  produto_id?: string
  nome_produto: string
  quantidade: number
  valor_unitario: number
  imagem_url?: string
  forma_venda?: string
  observacoes: string
  /** Tamanho ou kit escolhido (vai pro pedido como as escolhas do item) */
  opcaoLabel?: string
  personalizacoes?: any
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
  foto_url?: string
}

interface Produto {
  id: string
  nome: string
  preco_normal: number
  forma_venda?: string
  imagem_url?: string
  categoria?: string
  grupo_tamanhos?: any
  kit_qtd?: any
  // promoção (11/10): a venda sai pelo preço que o cliente paga, como no cardápio
  promocao?: boolean | null
  tipo_promocao?: string | null
  desconto_percentual?: number | null
  preco_promocional?: number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────
// "2026-10-20" → "Terça, 20/10" (o que aparece no campo de data)
// (no meio da frase, minusculo=true: "até terça, 20/10")
const SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const dataDoCampo = (iso: string, minusculo = false): string => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const dia = SEMANA[new Date(y, m - 1, d).getDay()]
  return `${minusculo ? dia.toLowerCase() : dia}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
// a foto do produto pode vir com várias URLs separadas por vírgula: usa a primeira
const primeiraFoto = (f?: string) => (f ? String(f).split(/,(?=\s*https?:)/)[0].trim() : '')

// Máscara ao digitar: "150" → "1,50" / "1500" → "15,00" / "150000" → "1.500,00"
const parseMaskMoney = (s: string): number => {
  const digits = s.replace(/\D/g, '')
  if (!digits) return 0
  return parseInt(digits) / 100
}
const formatMaskMoney = (v: number): string => {
  if (!v) return ''
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const initialsOf = (name: string) => {
  return name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'
}

// "BOLO DE CHOCOLATE" -> "Bolo de Chocolate"
const toTitleCase = (str: string): string => {
  const preposicoes = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'para', 'a', 'o', 'em', 'na', 'no'])
  return str.toLowerCase().split(/\s+/).map((word, i) => {
    if (i > 0 && preposicoes.has(word)) return word
    return word.charAt(0).toUpperCase() + word.slice(1)
  }).join(' ')
}

// ── Etapas ────────────────────────────────────────────────────────────────
// (o passo 1 se chama "Venda" por dentro; na tela aparece como "Produtos")
const ETAPAS_ENCOMENDA = ['Venda', 'Cliente', 'Entrega', 'Pagamento', 'Revisar']
const ETAPAS_PRONTA    = ['Venda', 'Cliente', 'Entrega', 'Pagamento', 'Revisar']
const NOME_DO_PASSO: Record<string, string> = { Venda: 'Produtos' }

// Em que situação o pedido entra: o valor gravado não muda, só o nome na tela (igual à lista de pedidos)
const COMECOS = [
  { chave: 'aguardando_aceite', nome: 'Novo pedido', dica: 'Fica em "Para aceitar" na sua lista até você aceitar.' },
  { chave: 'agendado', nome: 'Agendado', dica: 'Já confirmado com o cliente, entra na agenda.' },
  { chave: 'finalizado', nome: 'Pronto', dica: 'Já está feito, esperando o cliente.' },
  { chave: 'entregue', nome: 'Entregue', dica: 'O cliente já levou o pedido.' },
] as const

// ─────────────────────────────────────────────────────────────────────────
export default function NovaVenda() {
  const navigate = useNavigate()

  // ── State principal ─────────────────────────────────────────────────────
  const [etapa, setEtapa] = useState(1)
  const locNV = useLocation()
  const [origemDoo, setOrigemDoo] = useState(false)
  const preenchidaRef = useRef(false)
  const idTentativaRef = useRef(novoIdTentativa()) // (17/10 · R07) mesmo id se ela tocar em salvar de novo
  const [userId, setUserId] = useState<string | null>(null)

  const [tipo, setTipo] = useState<TipoVenda>(null)
  const [itens, setItens] = useState<ItemVenda[]>([])
  const [semCliente, setSemCliente] = useState(false)
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [clienteNome, setClienteNome] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const [modoNovoCli, setModoNovoCli] = useState(false)
  const clienteDoEnderecoRef = useRef<string | null>(null) // de qual cliente é o endereço que está na tela (pra troca de cliente)

  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>('retirada')
  // (16/10) pronta entrega com retirada: o cliente já levou (padrão) ou ainda vem buscar (pagou pelo WhatsApp e passa depois)
  const [vemBuscar, setVemBuscar] = useState(false)
  const [dataEntrega, setDataEntrega] = useState('')
  const [horarioEntrega, setHorarioEntrega] = useState('')
  const [enderecoRua, setEnderecoRua] = useState('')
  const [enderecoNumero, setEnderecoNumero] = useState('')
  const [enderecoBairro, setEnderecoBairro] = useState('')
  // (11/10) a cidade começa com a da loja (Dados da loja), e vazia se a loja não tiver. Antes era "Curitiba" pra todo mundo.
  const [enderecoCidade, setEnderecoCidade] = useState('')
  const cidadeDaLoja = useRef('')
  const [enderecoComplemento, setEnderecoComplemento] = useState('')
  const [taxaEntrega, setTaxaEntrega] = useState(0)

  const [desconto, setDesconto] = useState(0)
  const [acrescimo, setAcrescimo] = useState(0)
  // 10/10: nada vem marcado em "Quanto já entrou?" (antes "Tudo agora" vinha marcado e dava pra registrar como paga sem escolher)
  const [situacaoPag, setSituacaoPag] = useState<SituacaoPag | null>(null)
  const [valorParcial, setValorParcial] = useState(0)
  const [statusPedido, setStatusPedido] = useState<'aguardando_aceite' | 'agendado' | 'finalizado' | 'entregue'>('agendado')
  const [dataPrevistaPagamento, setDataPrevistaPagamento] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('PIX')

  const [observacoes, setObservacoes] = useState('')

  // Modal produtos
  const [modalProduto, setModalProduto] = useState(false)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produtosLoaded, setProdutosLoaded] = useState(false)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null)

  // Clientes (21/10: escolhidos na própria tela, sem janela)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [buscaCliente, setBuscaCliente] = useState('')
  const [recentes, setRecentes] = useState<string[]>([]) // ids dos clientes dos últimos pedidos

  const [salvando, setSalvando] = useState(false)
  const salvandoRef = useRef(false)
  salvandoRef.current = salvando
  const [sucessoAberto, setSucessoAberto] = useState(false)
  const [pedidoCriado, setPedidoCriado] = useState<any>(null)
  const [horaSheetAberto, setHoraSheetAberto] = useState(false)
  const [calNv, setCalNv] = useState<'entrega' | 'pagamento' | null>(null) // calendário do app
  const [enderecoCep, setEnderecoCep] = useState('')
  const [cepLoading, setCepLoading] = useState(false)

  // Busca CEP via ViaCEP
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

  // Formata CEP enquanto digita: "12345678" → "12345-678"
  const formatCep = (v: string): string => {
    const digits = v.replace(/\D/g, '').slice(0, 8)
    if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`
    return digits
  }

  // ── Load inicial ────────────────────────────────────────────────────────
  // (11/10) Se a leitura falhar, a tela diz "Não deu pra carregar" com "Tentar de novo".
  // Antes o erro virava lista vazia e aparecia "Cadastre seu primeiro produto", travando a venda de quem já tinha produtos.
  const [erroCarga, setErroCarga] = useState('')
  const [tentativaCarga, setTentativaCarga] = useState(0)
  useEffect(() => {
    let vivo = true
    const falhou = (e: unknown) => { if (!vivo) return; setErroCarga(explicarErro(e, 'Tente de novo em instantes.')); setProdutosLoaded(true) }
    supabase.auth.getUser().then(async ({ data: { user }, error: erroConta }) => {
      if (!vivo) return
      if (!user) { if (erroConta && erroDeConexao(erroConta)) falhou(erroConta); else navigate('/login'); return }
      setUserId(user.id)
      const [{ data: prds, error: e1 }, { data: cls, error: e2 }, { data: loja }] = await Promise.all([
        lerProdutosDeVenda(user.id), // com os campos da promoção
        supabase.from('clientes').select('id,nome,telefone,whatsapp,rua,numero,bairro,cidade,complemento,foto_url').eq('user_id', user.id).order('nome'),
        supabase.from('profiles').select('endereco').eq('id', user.id).maybeSingle(),
      ])
      if (!vivo) return
      if (e1 || e2) { falhou(e1 || e2); return }
      // cidade da loja (profiles.endereco, em JSON); sem ela, o campo fica vazio
      const lerEndereco = (cru: any): any => { try { return cru ? (typeof cru === 'string' ? JSON.parse(cru) : cru) : {} } catch { return {} } }
      cidadeDaLoja.current = String(lerEndereco((loja as any)?.endereco)?.cidade || '').trim()
      if (cidadeDaLoja.current) setEnderecoCidade(atual => atual || cidadeDaLoja.current)
      setProdutos((prds || []) as Produto[])
      setClientes(cls || [])
      // (21/10) "Últimos clientes": os dos pedidos mais recentes (se a leitura falhar, a lista mostra os primeiros por nome)
      supabase.from('pedidos').select('cliente_id').eq('user_id', user.id).not('cliente_id', 'is', null)
        .order('created_at', { ascending: false }).limit(60)
        .then(({ data }) => { if (vivo && data) setRecentes([...new Set((data as any[]).map(r => r.cliente_id).filter(Boolean))].slice(0, 5)) }, () => {})
      setErroCarga('')
      setProdutosLoaded(true)
      // Veio da página da cliente ("Novo pedido"): já começa com ela escolhida (08/10 · 3.34)
      const doLink = new URLSearchParams(window.location.search).get('cliente')
      const escolhida = doLink ? (cls || []).find((c: any) => c.id === doLink) : null
      if (escolhida) selecionarCliente(escolhida as any)
    }).catch(falhou)
    return () => { vivo = false }
  }, [tentativaCarga]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ajusta tipoEntrega default quando muda o tipo de venda
  useEffect(() => {
    // Veio preenchida da Doo IA: mantém a entrega que já veio (não volta pra "Retirada")
    if (preenchidaRef.current) { preenchidaRef.current = false; return }
    setTipoEntrega('retirada')
  }, [tipo])

  // Pronta entrega com retirada: o cliente já levou, então o pedido entra como entregue
  // (o criarPedido já força isso; aqui a tela mostra a mesma coisa). Pagamento começa em "Tudo agora".
  const prontaRetirada = tipo === 'pronta_entrega' && tipoEntrega === 'retirada'
  const buscaDepois = prontaRetirada && vemBuscar
  const jaLevou = prontaRetirada && !vemBuscar
  useEffect(() => { if (jaLevou) setStatusPedido('entregue') }, [jaLevou])
  // vem buscar: entra como "Pronto pra retirar", com a data de hoje já marcada
  useEffect(() => { if (buscaDepois) { setStatusPedido('finalizado'); setDataEntrega(d => d && d >= hojeISO() ? d : hojeISO()) } }, [buscaDepois])
  useEffect(() => { if (tipo === 'pronta_entrega') setSituacaoPag(s => s ?? 'total') }, [tipo])

  // Scroll pro topo quando muda de etapa ou entra na tela de sucesso
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [etapa, sucessoAberto])

  // ── Cálculos ────────────────────────────────────────────────────────────
  // (11/10) a mesma conta que grava o pedido (lib/pedidosDoo), em centavos certos: o total da tela é o total gravado
  const total = useMemo(
    () => totalDe({ itens, tipoEntrega, taxaEntrega, desconto, acrescimo }),
    [itens, taxaEntrega, desconto, acrescimo, tipoEntrega]
  )

  // Lista de categorias com contagem (ordenada)
  const categoriasComContagem = useMemo(() => {
    const map = new Map<string, number>()
    produtos.forEach(p => {
      const cat = (p.categoria || '').trim()
      if (cat) map.set(cat, (map.get(cat) || 0) + 1)
    })
    return Array.from(map.entries())
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [produtos])

  // Etapas dinâmicas
  const etapas = tipo === 'pronta_entrega' ? ETAPAS_PRONTA : ETAPAS_ENCOMENDA
  const totalEtapas = etapas.length
  const etapaLabelAtual = etapas[etapa - 1]

  // ── Validação por etapa ────────────────────────────────────────────────
  // 10/10: o "Continuar" sempre responde; quando falta algo, diz o quê (no aviso e no próprio passo)
  const oQueFalta = (): string | null => {
    if (etapaLabelAtual === 'Venda') {
      if (!tipo && itens.length === 0) return 'Escolha o tipo de venda e adicione pelo menos um produto para continuar.'
      if (itens.length === 0) return 'Adicione pelo menos um produto para continuar.'
      if (!tipo) return 'Escolha o tipo de venda para continuar.'
      return null
    }
    if (etapaLabelAtual === 'Entrega') {
      if (tipo === 'encomenda' && !dataEntrega) return 'Escolha a data para continuar.'
      if (tipoEntrega === 'entrega' && !enderecoRua.trim()) return 'Escreva a rua para continuar.'
      return null
    }
    if (etapaLabelAtual === 'Pagamento') {
      if (!situacaoPag) return 'Escolha quanto já entrou para continuar.'
      // Pagamento parcial precisa do valor recebido (maior que zero e menor que o total)
      if (situacaoPag === 'parcial' && !(r2(valorParcial) > 0 && r2(valorParcial) < total)) return 'Escreva quanto ele já pagou para continuar.'
    }
    return null
  }
  const [tentou, setTentou] = useState(false)
  useEffect(() => { setTentou(false) }, [etapa])

  // ── Passos no histórico (11/10) ─────────────────────────────────────────
  // Cada "Continuar" coloca uma entrada no histórico: o voltar do navegador ou do Android volta um passo
  // (antes saía da tela e a venda se perdia sem perguntar). No primeiro passo, com produto já escolhido,
  // o voltar pergunta antes de sair, igual ao botão Cancelar.
  // É o mesmo jeito das janelas do app (useSobreposicao): a entrada copia o que o roteador guardou e leva as marcas "nv".
  const sessaoNv = useRef('')   // de qual venda são as entradas (criado na primeira entrada; as de uma venda antiga não valem)
  const profNv = useRef(0)      // quantas entradas desta venda estão no histórico
  const etapaRef = useRef(etapa)
  const temDados = useRef(false)
  useEffect(() => { etapaRef.current = etapa; temDados.current = itens.length > 0 && !sucessoAberto })
  const perguntandoSaida = useRef(false)
  const recolhendo = useRef(false)
  const lixoAbaixo = useRef(false) // tem entrada de outra venda logo abaixo: sair pelo "voltar" não tiraria desta tela

  const empurrarPasso = (passo: number, de = 0) => {
    const st = (window.history.state || {}) as any
    if (st.uiJanela) return // tem janela do app fechando por cima: não mexe (segue sem a entrada)
    if (!sessaoNv.current) sessaoNv.current = Math.random().toString(36).slice(2)
    try {
      window.history.pushState({ ...st, nvSessao: sessaoNv.current, nvProf: profNv.current + 1, nvEtapa: passo, nvDe: de }, '')
      profNv.current += 1
    } catch { /* sem histórico: segue sem o voltar */ }
  }
  /** Vai pra um passo colocando uma entrada no histórico (o voltar leva pro passo de onde veio). */
  const irParaPasso = (passo: number) => { empurrarPasso(passo, etapa); setEtapa(passo) }
  /** Troca de passo sem entrada nova (só acerta a marca da entrada atual). */
  const trocarPasso = (passo: number) => {
    const st = window.history.state as any
    if (profNv.current > 0 && st?.nvSessao === sessaoNv.current) { try { window.history.replaceState({ ...st, nvEtapa: passo, nvDe: 0 }, '') } catch { /* nada */ } }
    setEtapa(passo)
  }
  /** Tira do histórico as entradas da venda (antes de sair da tela, ou quando a venda foi registrada). */
  const recolherPassos = (quantas = profNv.current) => new Promise<void>(resolve => {
    if (quantas <= 0) { resolve(); return }
    recolhendo.current = true
    let feito = false
    const fim = () => { if (feito) return; feito = true; window.removeEventListener('popstate', chegou); recolhendo.current = false; profNv.current = 0; resolve() }
    const chegou = () => { if (!(Number((window.history.state as any)?.nvProf) > 0)) fim() }
    window.addEventListener('popstate', chegou)
    window.setTimeout(fim, 600) // segurança: nunca fica esperando
    try { window.history.go(-quantas) } catch { fim() }
  })

  // Voltou pra esta tela pelo histórico e caiu numa entrada de uma venda antiga: tira essas entradas (senão cada "voltar" não faria nada)
  const limpouVelhas = useRef(false)
  useEffect(() => {
    const st = window.history.state as any
    const velhas = Number(st?.nvProf) || 0
    if (limpouVelhas.current || velhas <= 0 || st?.nvSessao === sessaoNv.current) return
    limpouVelhas.current = true
    recolherPassos(velhas)
  }, [])

  // O voltar do navegador/Android
  useEffect(() => {
    const aoVoltarNoHistorico = () => {
      if (recolhendo.current || perguntandoSaida.current) return
      const st = (window.history.state || {}) as any
      if (st.uiJanela) return // o voltar fechou uma janela e ainda tem outra por cima
      const prof = st.nvSessao === sessaoNv.current ? Number(st.nvProf) || 0 : 0
      if (prof === profNv.current) return // nada desta venda saiu do histórico (foi uma janela do app fechando)
      profNv.current = prof
      // (11/10) registrando a venda: não pergunta "Cancelar?" (a venda seria gravada mesmo assim); a entrada volta
      if (prof === 0 && salvandoRef.current) { empurrarPasso(etapaRef.current); return }
      if (prof > 0) { setEtapa(Math.min(5, Math.max(1, Number(st.nvEtapa) || 1))); return }
      // saiu da última entrada da venda: a pessoa está indo embora da tela
      const sair = () => { if (lixoAbaixo.current) navigate('/pedidos', { replace: true }); else voltarOuIr(navigate, '/pedidos') }
      if (!temDados.current) { sair(); return }
      perguntandoSaida.current = true
      confirmar({ titulo: 'Cancelar esta venda?', texto: 'O que você preencheu até aqui vai ser perdido.', rotulo: 'Cancelar venda', rotuloVoltar: 'Continuar a venda', perigo: true }).then(ok => {
        perguntandoSaida.current = false
        if (ok) sair()
        else empurrarPasso(etapaRef.current) // ficou: a entrada volta pro histórico
      })
    }
    window.addEventListener('popstate', aoVoltarNoHistorico)
    return () => window.removeEventListener('popstate', aoVoltarNoHistorico)
  }, [navigate])

  // Tem produto na venda e nenhuma entrada no histórico: coloca uma, pro voltar perguntar antes de sair
  const temItens = itens.length > 0
  useEffect(() => {
    if (!temItens || sucessoAberto || profNv.current > 0) return
    let vivo = true
    // espera a janela de escolher o produto tirar a entrada dela do histórico
    historicoAssentado().then(() => { if (vivo && profNv.current === 0 && !perguntandoSaida.current && !recolhendo.current) empurrarPasso(etapaRef.current) })
    return () => { vivo = false }
  }, [temItens, sucessoAberto, locNV.key])

  const proximaEtapa = () => {
    const falta = oQueFalta()
    if (falta) { setTentou(true); return }
    if (etapa < totalEtapas) irParaPasso(etapa + 1)
  }
  const voltarEtapa = () => {
    if (etapa <= 1) { sairDaVenda(); return }
    // a entrada de baixo é o passo anterior: volta pelo histórico (o mesmo caminho do voltar do aparelho)
    const st = window.history.state as any
    if (profNv.current > 0 && st?.nvSessao === sessaoNv.current && st.nvEtapa === etapa && st.nvDe === etapa - 1) { window.history.back(); return }
    trocarPasso(etapa - 1)
  }
  // Sair no meio: se já tem produto, pergunta antes de perder o que foi preenchido
  const sairDaVenda = async () => {
    if (itens.length > 0) {
      const ok = await confirmar({ titulo: 'Cancelar esta venda?', texto: 'O que você preencheu até aqui vai ser perdido.', rotulo: 'Cancelar venda', perigo: true })
      if (!ok) return
    }
    await recolherPassos() // sem isso, o "voltar" na lista de pedidos caía de novo nos passos desta venda
    navigate('/pedidos')
  }

  // ── Adicionar produto ──────────────────────────────────────────────────
  // Produto com tamanhos (P/M/G, pelo peso) ou kits: pergunta qual antes de adicionar (30/09).
  // Antes entrava sempre com o menor preço, sem jeito de escolher.
  const opcoesDoProduto = (p: Produto) => opcoesDoProdutoLib(p) // mesma regra da Doo IA
  const [qtdLivre, setQtdLivre] = useState<number | null>(null) // (14/10) kit "ele escolhe": quantidade escolhida
  // (16/10) "Outro tamanho": vendeu um peso que não está na lista (o preço sai do preço do kg, e dá pra mudar)
  const [outro, setOutro] = useState<{ aberto: boolean; peso: string; valor: number }>({ aberto: false, peso: '', valor: 0 })
  const [escolhaProduto, setEscolhaProduto] = useState<{ p: Produto; opcoes: { label: string; valor: number; pers: any }[] } | null>(null)
  const addProduto = (p: Produto, escolha?: { label: string; valor: number; pers: any }) => {
    if (!escolha) {
      const ops = opcoesDoProduto(p)
      if (ops.length > 1) { setEscolhaProduto({ p, opcoes: ops }); setModalProduto(false); return }
      if (ops.length === 1) escolha = ops[0]
    }
    setEscolhaProduto(null)
    setItens([...itens, {
      ...(escolha ? { opcaoLabel: escolha.label, personalizacoes: escolha.pers } : {}),
      produto_id: p.id,
      nome_produto: p.nome,
      quantidade: 1,
      valor_unitario: escolha ? escolha.valor : precoDeVenda(p), // (11/10) com a promoção (antes entrava o preço cheio)
      imagem_url: p.imagem_url,
      forma_venda: p.forma_venda,
      observacoes: '',
    }])
    setModalProduto(false)
    setBuscaProduto('')
    setFiltroCategoria(null)
  }
  const removerItem = (idx: number) => setItens(itens.filter((_, i) => i !== idx))
  const duplicarItem = (idx: number) => {
    const item = itens[idx]
    if (!item) return
    // Insere duplicado logo abaixo do original
    const novoItens = [...itens]
    novoItens.splice(idx + 1, 0, { ...item, observacoes: '' })
    setItens(novoItens)
  }
  const atualizarQtd = (idx: number, qtd: number) => {
    if (qtd < 1) return
    setItens(itens.map((it, i) => i === idx ? { ...it, quantidade: qtd } : it))
  }
  const atualizarObs = (idx: number, obs: string) => {
    setItens(itens.map((it, i) => i === idx ? { ...it, observacoes: obs } : it))
  }

  // ── Selecionar cliente ─────────────────────────────────────────────────
  const selecionarCliente = (c: Cliente) => {
    setClienteId(c.id)
    setClienteNome(c.nome)
    setClienteTelefone(c.telefone || c.whatsapp || '')
    setSemCliente(false)
    setModoNovoCli(false)
    // (10/10) Trocou de cliente: o endereço inteiro passa a ser o dela (vazio no que ela não tem).
    // Antes só os campos preenchidos entravam e sobrava pedaço do endereço da cliente anterior.
    // Mesma cliente de novo: não mexe. Sem cliente antes + cliente sem endereço: fica o que ela digitou.
    const anterior = clienteDoEnderecoRef.current
    const temEndereco = !!(c.rua || c.numero || c.bairro || c.cidade || c.complemento)
    if (c.id !== anterior && (anterior || temEndereco)) {
      setEnderecoRua(c.rua || '')
      setEnderecoNumero(c.numero || '')
      setEnderecoBairro(c.bairro || '')
      setEnderecoCidade(c.cidade || '')
      setEnderecoComplemento(c.complemento || '')
      setEnderecoCep('') // o CEP era do endereço anterior
    }
    clienteDoEnderecoRef.current = c.id
    setBuscaCliente('')
  }

  // ── Finalizar Venda ────────────────────────────────────────────────────
  // (11/10) cliente nova que já foi cadastrada numa tentativa em que o pedido falhou: a próxima tentativa usa a mesma
  // (antes cada "Registrar venda" cadastrava a cliente de novo). Vale enquanto o nome e o telefone forem os mesmos.
  const clienteCriada = useRef<{ id: string; chave: string } | null>(null)
  const finalizarVenda = async () => {
    if (!userId || salvando) return
    // (11/10) o Editar da Doo abre direto no Revisar: a data da encomenda é conferida aqui também
    if (tipo !== 'pronta_entrega' && (!dataEntrega || dataEntrega < hojeISO())) { trocarPasso(3); avisar(dataEntrega ? 'Essa data já passou. Escolha outra.' : 'Escolha a data da entrega.', { tipo: 'info' }); return }
    if (!semCliente && !clienteId && !modoNovoCli && clienteNome.trim()) { trocarPasso(2); avisar('Escolha a cliente para continuar.', { tipo: 'info' }); return }
    if (!situacaoPag) { trocarPasso(etapas.indexOf('Pagamento') + 1); avisar('Escolha quanto já entrou para continuar.', { tipo: 'info' }); return }
    // o total pode ter mudado depois do passo do pagamento (tirou um produto, deu desconto): o sinal continua tendo que ser menor
    if (situacaoPag === 'parcial' && !(r2(valorParcial) > 0 && r2(valorParcial) < total)) { trocarPasso(etapas.indexOf('Pagamento') + 1); avisar('O sinal precisa ser menor que o total. Confira o pagamento.', { tipo: 'info' }); return }
    setSalvando(true)

    const clienteNovo = !semCliente && !clienteId && modoNovoCli && !!clienteNome.trim()
    const chaveCliente = `${clienteNome.trim().toLowerCase()}|${digitosTelefone(clienteTelefone)}`
    const jaCriada = clienteNovo && clienteCriada.current?.chave === chaveCliente ? clienteCriada.current.id : null
    try {
      // Salvar: a mesma função usada pela Doo IA (lib/pedidosDoo) — pedido igual nos dois caminhos
      const res = await criarPedido(userId, {
        idTentativa: idTentativaRef.current,
        tipo: (tipo || 'encomenda') as any, itens, semCliente, clienteId: clienteId || jaCriada, clienteNome, clienteTelefone,
        clienteNovo,
        tipoEntrega: tipoEntrega as any, vemBuscar: buscaDepois, dataEntrega, horarioEntrega,
        endereco: { rua: enderecoRua, numero: enderecoNumero, bairro: enderecoBairro, cidade: enderecoCidade, complemento: enderecoComplemento },
        taxaEntrega, desconto, acrescimo, formaPagamento, situacaoPag, valorParcial, dataPrevistaPagamento,
        // "Pronto" de retirada entra como "Pronto pra retirar" (o mesmo caminho da lista e da tela do pedido)
        statusPedido: statusPedido === 'finalizado' && tipoEntrega === 'retirada' ? 'aguardando_retirada' : statusPedido,
        observacoes, origem: origemDoo ? 'doo' : 'manual',
      })
      if (res.ok === false) {
        // (11/10) não gravou (ou gravou sem os produtos e foi desfeito): mostra o erro e fica no Revisar, sem tela de sucesso
        if (clienteNovo && res.clienteId) clienteCriada.current = { id: res.clienteId, chave: chaveCliente }
        avisar(res.erro, { tipo: 'erro' })
        return
      }
      clienteCriada.current = null
      idTentativaRef.current = novoIdTentativa() // a próxima venda é outro pedido
      if (res.aviso) avisar(res.aviso, { tipo: 'info' })
      const novoPedido: any = res.pedido
      // a cliente nova entra na lista da tela (a próxima venda já acha ela na busca)
      if (clienteNovo && res.clienteId && !clientes.some(c => c.id === res.clienteId)) {
        const comEndereco = tipoEntrega === 'entrega' ? { rua: enderecoRua, numero: enderecoNumero, bairro: enderecoBairro, cidade: enderecoCidade, complemento: enderecoComplemento } : {}
        setClientes(prev => [...prev, { id: res.clienteId as string, nome: clienteNome.trim(), whatsapp: clienteTelefone.trim(), ...comEndereco }].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')))
      }

      // Salva dados do pedido pra mostrar na tela de sucesso
      // (11/10) total e pagamento são os que ficaram GRAVADOS: se o recebimento não entrou, a tela não diz mais "Sinal de R$ 50,00"
      setPedidoCriado({
        id: novoPedido.id,
        numero: novoPedido.numero || null, // sem número: a tela diz só "Pedido registrado" (nunca mostra o id interno)
        itens: [...itens],
        clienteNome: semCliente || !clienteNome ? '' : clienteNome,
        clienteTelefone: semCliente ? '' : clienteTelefone,
        total: novoPedido.valor_total != null ? Number(novoPedido.valor_total) || 0 : total,
        recebido: recebidoPedido(novoPedido),
        falta: saldoPedido(novoPedido),
        statusPagamento: String(novoPedido.status_pagamento || ''),
        tipo,
        dataEntrega,
        horarioEntrega,
      })
      setSucessoAberto(true)
      // os passos desta venda saem do histórico: o voltar não reabre uma venda já registrada.
      // (14/10) voltar no histórico devolvia a rolagem do meio da tela: depois disso, sobe pro topo
      const pTopo = () => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); document.scrollingElement?.scrollTo?.(0, 0) }
      Promise.resolve(recolherPassos()).finally(() => { pTopo(); requestAnimationFrame(pTopo); setTimeout(pTopo, 120) })
      tocarSom('pedido')
    } catch (e) {
      avisar(explicarErro(e, 'Não deu para registrar a venda. Tente de novo.'), { tipo: 'erro' })
    } finally {
      setSalvando(false)
    }
  }

  // Comprovante da venda no modelo padrão de PDF (o mesmo do pedido). Grátis pra todos.
  const exportarPdf = async () => {
    const pc = pedidoCriado
    if (!pc?.id) return
    const janela = abrirJanela()
    const { data } = await supabase.from('pedidos').select('*, pedido_itens(*, produtos(forma_venda))').eq('id', pc.id).maybeSingle()
    await gerarPedidoPDF((data || { id: pc.id, numero: pc.numero, valor_total: pc.total }) as any, janela)
  }

  // Veio do "Editar" do cartão da Doo IA: abre preenchida, direto no Revisar
  // (11/10) Vale também pra quem JÁ está nesta tela e toca "Editar" no cartão: antes só era lido ao abrir a tela e nada era preenchido.
  const jaAbriu = useRef(false)
  const rascunhoLido = useRef('') // a entrada do histórico de onde o rascunho já foi lido (não preenche duas vezes)
  useEffect(() => {
    const d = (locNV.state as any)?.rascunhoDoo as DadosPedido | undefined
    const chegouComATelaAberta = jaAbriu.current
    jaAbriu.current = true
    if (!d || rascunhoLido.current === locNV.key) return
    rascunhoLido.current = locNV.key
    // tira o rascunho do histórico (recarregar a página não preenche de novo), sem apagar o que o roteador guarda nele
    navigate(locNV.pathname + locNV.search, { replace: true, state: null })
    if (chegouComATelaAberta) {
      // a entrada nova entrou por cima dos passos da venda que estava na tela: eles não valem mais
      if (profNv.current > 0) lixoAbaixo.current = true
      sessaoNv.current = '' // as entradas antigas deixam de valer (a próxima entrada cria outra marca)
      profNv.current = 0
      setSucessoAberto(false); setPedidoCriado(null); setEnderecoCep('')
    }
    clienteCriada.current = null
    setOrigemDoo(true)
    if (d.tipo !== tipo) preenchidaRef.current = true
    setTipo(d.tipo as any); setItens(d.itens as any)
    clienteDoEnderecoRef.current = d.clienteId || null
    setSemCliente(d.semCliente); setClienteId(d.clienteId); setClienteNome(d.clienteNome); setClienteTelefone(d.clienteTelefone); setModoNovoCli(d.clienteNovo)
    setTipoEntrega(d.tipoEntrega as any); setDataEntrega(d.dataEntrega); setHorarioEntrega(d.horarioEntrega)
    setEnderecoRua(d.endereco.rua); setEnderecoNumero(d.endereco.numero); setEnderecoBairro(d.endereco.bairro); setEnderecoCidade(d.endereco.cidade); setEnderecoComplemento(d.endereco.complemento)
    setTaxaEntrega(d.taxaEntrega); setDesconto(d.desconto); setAcrescimo(d.acrescimo)
    setFormaPagamento(d.formaPagamento); setSituacaoPag(d.situacaoPag); setValorParcial(d.valorParcial); setDataPrevistaPagamento(d.dataPrevistaPagamento)
    setStatusPedido((d.statusPedido || 'agendado') as any); setObservacoes(d.observacoes)
    // (11/10) mais de uma cliente com o nome que a Doo ouviu: abre no passo da cliente pra ela escolher qual é
    trocarPasso(!d.semCliente && !d.clienteId && !d.clienteNovo && d.clienteNome ? 2 : 5)
  }, [locNV.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset completo pra nova venda
  const resetVenda = () => {
    trocarPasso(1)
    setOrigemDoo(false) // (11/10) a venda seguinte é manual (antes continuava saindo como "pela Doo IA")
    clienteCriada.current = null
    setTipo(null)
    setItens([])
    clienteDoEnderecoRef.current = null
    setClienteId(null); setClienteNome(''); setClienteTelefone(''); setSemCliente(false); setModoNovoCli(false)
    setTipoEntrega('retirada'); setVemBuscar(false)
    setDataEntrega(''); setHorarioEntrega('')
    setEnderecoRua(''); setEnderecoNumero(''); setEnderecoBairro(''); setEnderecoCidade(cidadeDaLoja.current); setEnderecoComplemento(''); setTaxaEntrega(0); setEnderecoCep('')
    setDesconto(0); setAcrescimo(0); setSituacaoPag(null); setValorParcial(0); setDataPrevistaPagamento(''); setFormaPagamento('PIX'); setStatusPedido('agendado')
    setObservacoes('')
    setPedidoCriado(null); setSucessoAberto(false)
  }


  // ── Render (08/10 · 3.17, no padrão do guia) ───────────────────────────
  // Título "Nova venda" (igual ao menu), passos com nome, rodapé fixo com o total,
  // botões de 44px, campos com rótulo, sem emoji e janelas padrão do app.
  const isUltima = etapa === totalEtapas
  const primeiroNome = (clienteNome || '').trim().split(/\s+/)[0] || ''
  const nomeDaCliente = semCliente || !clienteNome.trim() ? 'Venda avulsa' : toTitleCase(clienteNome.trim())
  const ehEntrega = tipoEntrega === 'entrega'
  const taxaConta = ehEntrega ? taxaEntrega : 0
  const falta = situacaoPag === 'parcial' ? Math.max(0, r2(total - valorParcial)) : situacaoPag === 'total' ? 0 : total
  const nomeForma = formaPagamento === 'PIX' ? 'Pix' : formaPagamento
  // o mesmo texto no Revisar e na tela de venda registrada
  const textoPagamento =
    situacaoPag === 'total' ? `Pago · ${nomeForma}`
    : situacaoPag === 'parcial' ? `Sinal de ${rs(valorParcial)} · ${nomeForma}`
    : situacaoPag === 'na_entrega' ? (ehEntrega ? 'Paga na entrega' : 'Paga na retirada')
    : situacaoPag === 'fiado' ? `Vai pagar depois${dataPrevistaPagamento ? ` · até ${dataDoCampo(dataPrevistaPagamento, true)}` : ''}`
    : 'Falta escolher'
  const enderecoTexto = [[enderecoRua, enderecoNumero].filter(Boolean).join(', '), enderecoBairro].filter(Boolean).join(' · ')
  // subtítulo (10/10): no passo 1 explica a escolha; depois mostra o tipo escolhido; no fim, que a venda foi registrada
  const subtituloTopo = sucessoAberto ? 'Venda registrada' : etapa === 1 || !tipo ? 'Encomenda ou pronta entrega' : tipo === 'pronta_entrega' ? 'Pronta entrega' : 'Encomenda'
  // (16/10) a seta do topo volta um passo (no primeiro, pergunta antes de cancelar), igual ao "Voltar" de baixo
  const cabecalho = <AppPageHeader title="Nova venda" subtitle={subtituloTopo} infoComo={COMO_NOVA_VENDA} infoTour={TOUR_NOVA_VENDA} onBack={sucessoAberto ? () => navigate('/pedidos') : voltarEtapa} />

  // ═══ Venda registrada ═══
  if (sucessoAberto && pedidoCriado) {
    const pc = pedidoCriado
    const naAgenda = pc.tipo === 'encomenda' && statusPedido !== 'entregue'
    // (11/10) o pagamento que ficou gravado no pedido (se o recebimento não entrou, o pedido ficou "a receber")
    const pagoGravado = pc.statusPagamento === 'pago'
    const pagamentoGravado = pagoGravado ? `Pago · ${nomeForma}`
      : pc.recebido > 0 ? `Sinal de ${rs(pc.recebido)} · ${nomeForma}`
      : situacaoPag === 'na_entrega' || situacaoPag === 'fiado' ? textoPagamento
      : 'A receber'
    return (
      <>
        {cabecalho}
        <div className="nv3">
          <section className="nv3-card nv3-ok" aria-live="polite">
            <span className="nv3-ok-ic" aria-hidden="true"><Check size={32} weight="bold" /></span>
            <h2>{pc.numero ? `Pedido #${pc.numero} registrado` : 'Pedido registrado'}</h2>
            <p>{naAgenda ? 'Já está na sua lista de pedidos e na agenda.' : 'Já está na sua lista de pedidos.'}</p>
            <div className="nv3-res">
              <Linha rotulo="Cliente">{pc.clienteNome ? toTitleCase(pc.clienteNome) : 'Venda avulsa'}</Linha>
              {(pc.tipo === 'encomenda' || buscaDepois) && pc.dataEntrega && <Linha rotulo={ehEntrega ? 'Entrega' : 'Retirada'}>{dataLonga(pc.dataEntrega, pc.horarioEntrega)}</Linha>}
              <Linha rotulo="Total">{rs(pc.total)}</Linha>
              <Linha rotulo="Pagamento" tom={pagoGravado ? 'verde' : 'laranja'}>{pagamentoGravado}</Linha>
              {!pagoGravado && pc.falta > 0.009 && <Linha rotulo="Falta receber" tom="laranja">{rs(pc.falta)}</Linha>}
            </div>
            <Botao cheio onClick={() => navigate(`/pedidos/${pc.id}/editar`)}>Abrir o pedido</Botao>
            <div className="nv3-2">
              <Botao variante="secundario" icone={<Plus size={20} weight="bold" />} onClick={resetVenda}>Nova venda</Botao>
              <Botao variante="secundario" onClick={exportarPdf}>Baixar PDF</Botao>
            </div>
            <Botao variante="link" onClick={() => navigate('/pedidos')}>Ver todos os pedidos</Botao>
          </section>
        </div>
      </>
    )
  }

  // ── Carregando (só o giro, sem piscar o formulário) ──
  if (!produtosLoaded) {
    return (
      <>
        {cabecalho}
        <p className="nv3-carregando" role="status"><span className="ui-gira" aria-hidden="true" />Abrindo a venda…</p>
      </>
    )
  }

  // ── Não deu pra ler os produtos ou os clientes (11/10): avisa e deixa tentar de novo ──
  if (erroCarga) {
    return (
      <>
        {cabecalho}
        <div className="nv3">
          <TelaVazia
            icone={<WarningCircle size={30} />}
            titulo="Não deu para carregar"
            texto={erroCarga}
            acao={<Botao variante="suave" tamanho="m" onClick={() => { setErroCarga(''); setProdutosLoaded(false); setTentativaCarga(t => t + 1) }}>Tentar de novo</Botao>}
          />
        </div>
      </>
    )
  }

  // ── Precisa ter ao menos 1 produto cadastrado ──
  if (produtos.length === 0) {
    return (
      <>
        {cabecalho}
        <div className="nv3">
          <TelaVazia
            icone={<Package size={30} />}
            titulo="Cadastre seu primeiro produto"
            texto="Você precisa ter pelo menos um produto cadastrado para registrar vendas."
            acao={<Botao tamanho="m" onClick={() => navigate('/produtos')}>Cadastrar produto</Botao>}
          />
        </div>
      </>
    )
  }

  const nomePasso = (n: string) => NOME_DO_PASSO[n] || n
  const clienteEscolhida = clienteId ? clientes.find(x => x.id === clienteId) : undefined
  const podeUsarEndereco = !!clienteEscolhida?.rua && (clienteEscolhida.rua !== enderecoRua || (clienteEscolhida.numero || '') !== enderecoNumero)
  const usarEnderecoDaCliente = () => {
    const c = clienteEscolhida
    if (!c) return
    setEnderecoRua(c.rua || ''); setEnderecoNumero(c.numero || ''); setEnderecoBairro(c.bairro || '')
    if (c.cidade) setEnderecoCidade(c.cidade)
    setEnderecoComplemento(c.complemento || '')
  }
  const tirarCliente = () => {
    clienteDoEnderecoRef.current = null // o endereço dela sai junto, logo abaixo
    setClienteId(null); setClienteNome(''); setClienteTelefone('')
    setEnderecoRua(''); setEnderecoNumero(''); setEnderecoBairro(''); setEnderecoComplemento('')
  }
  const comeco = COMECOS.find(c => c.chave === statusPedido) || COMECOS[1]

  return (
    <>
    {cabecalho}

    <div className="nv3">
      {/* Passos: "Passo 2 de 5 · Cliente" no celular; o nome de todos a partir do tablet */}
      <div className="nv3-passos">
        <p><b>Passo {etapa} de {totalEtapas}</b> · {nomePasso(etapaLabelAtual)}</p>
        <ol aria-label={`Passo ${etapa} de ${totalEtapas}: ${nomePasso(etapaLabelAtual)}`}>
          {etapas.map((n, i) => <li key={n} className={i + 1 < etapa ? 'feito' : i + 1 === etapa ? 'atual' : ''} aria-current={i + 1 === etapa ? 'step' : undefined}><i /><span>{nomePasso(n)}</span></li>)}
        </ol>
      </div>

      {/* (21/10) no computador: os passos à esquerda e o resumo da venda fixo à direita */}
      <div className="nv3-grade">
      <div className="nv3-col">

      {/* ═══ PASSO 1: tipo + produtos ═══ */}
      {etapaLabelAtual === 'Venda' && (
        <>
          <section className="nv3-card">
            <Titulo>Que tipo de venda é?</Titulo>
            <div className="nv3-tipos" role="group" aria-label="Tipo de venda">
              <button type="button" aria-pressed={tipo === 'encomenda'} onClick={() => setTipo('encomenda')}>
                <CalendarDots size={24} weight={tipo === 'encomenda' ? 'fill' : 'bold'} /><b>Encomenda</b><small>Para outro dia</small>
              </button>
              <button type="button" aria-pressed={tipo === 'pronta_entrega'} onClick={() => setTipo('pronta_entrega')}>
                <Lightning size={24} weight={tipo === 'pronta_entrega' ? 'fill' : 'bold'} /><b>Pronta entrega</b><small>Já está pronto</small>
              </button>
            </div>
            {!tipo && (itens.length > 0 || tentou) && <p className="nv3-dica nv3-falta">Escolha o tipo de venda para continuar.</p>}
          </section>

          <section className="nv3-card nv3-card--produtos">
            <Titulo contagem={itens.length}>Produtos</Titulo>
            {itens.length === 0 ? (
              <div className="nv3-vz">
                <span className="nv3-vz-ic" aria-hidden="true"><Package size={30} /></span>
                <b>Nenhum produto ainda</b>
                <p>Adicione o que o cliente pediu.</p>
                <Botao icone={<Plus size={20} weight="bold" />} onClick={() => setModalProduto(true)}>Adicionar produto</Botao>
                {tentou && <p className="nv3-dica nv3-falta">Adicione pelo menos um produto para continuar.</p>}
              </div>
            ) : (
              <ul className="nv3-itens">
                {itens.map((it, idx) => {
                  const foto = primeiraFoto(it.imagem_url)
                  const nome = nomeDeProduto(it.nome_produto)
                  return (
                    <li key={idx}>
                      <div className="nv3-it">
                        <span className="nv3-ft" aria-hidden="true"><Package size={20} weight="bold" />{foto && <img src={foto} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />}</span>
                        <div className="nv3-it-tx">
                          {/* (14/10) nome em cima; embaixo "Tamanho: Pequeno · R$ 15,00" */}
                          <b>{nome}</b>
                          <span>{it.opcaoLabel ? `${it.personalizacoes?.kit ? 'Kit' : 'Tamanho'}: ${it.opcaoLabel} · ` : ''}{rs(r2(it.valor_unitario * it.quantidade))}{it.quantidade > 1 ? ` (${rs(it.valor_unitario)} cada)` : ''}</span>
                        </div>
                      </div>
                      <div className="nv3-it-ctl">
                        <div className="nv3-qtd">
                          <BotaoIcone rotulo={`Diminuir ${nome}`} tamanho="p" disabled={it.quantidade <= 1} onClick={() => atualizarQtd(idx, it.quantidade - 1)}><Minus size={20} weight="bold" /></BotaoIcone>
                          <b aria-live="polite" aria-label={`Quantidade: ${it.quantidade}`}>{it.quantidade}</b>
                          <BotaoIcone rotulo={`Aumentar ${nome}`} tamanho="p" onClick={() => atualizarQtd(idx, it.quantidade + 1)}><Plus size={20} weight="bold" /></BotaoIcone>
                        </div>
                        <BotaoIcone rotulo={`Duplicar ${nome}`} variante="limpo" tamanho="p" onClick={() => duplicarItem(idx)}><Copy size={20} weight="bold" /></BotaoIcone>
                        <BotaoIcone rotulo={`Remover ${nome}`} variante="limpo" tamanho="p" className="nv3-lixo" onClick={() => removerItem(idx)}><Trash size={20} weight="bold" /></BotaoIcone>
                      </div>
                      <Campo rotulo="Recado do item" opcional placeholder="Ex.: escrever Parabéns, Lia! em rosa" value={it.observacoes} onChange={e => atualizarObs(idx, e.target.value)} />
                    </li>
                  )
                })}
              </ul>
            )}
            {/* (14/10) adicionar outro produto: embaixo dos produtos já escolhidos */}
            {itens.length > 0 && <Botao variante="secundario" cheio className="nv3-add" icone={<Plus size={20} weight="bold" />} onClick={() => setModalProduto(true)}>Adicionar novo produto</Botao>}
          </section>
        </>
      )}

      {/* ═══ PASSO 2: cliente (opcional) ═══ */}
      {etapaLabelAtual === 'Cliente' && (
        <>
          <section className="nv3-card">
            <Titulo>Para quem é?</Titulo>
            {modoNovoCli ? (
              <>
                <div className="nv3-cols">
                  <Campo className="nv3-larga" rotulo="Nome do cliente" placeholder="Ex.: Mariana Albuquerque" autoComplete="off" value={clienteNome} onChange={e => setClienteNome(e.target.value)} />
                  <Campo className="nv3-larga" rotulo="Telefone ou WhatsApp" opcional type="tel" inputMode="tel" placeholder="(41) 99999-0000" value={clienteTelefone} onChange={e => setClienteTelefone(e.target.value)} />
                </div>
                <p className="nv3-dica">Ele fica salvo nos seus clientes quando você registrar a venda.</p>
                <Botao variante="link" icone={<X size={16} weight="bold" />} onClick={() => { setModoNovoCli(false); setClienteNome(''); setClienteTelefone('') }}>Voltar para a lista</Botao>
              </>
            ) : (
              <>
                {/* (21/10) busca e lista na própria tela; "Sem cliente" vem marcado */}
                <div className="ui-campo-c nv3-cbusca">
                  <span className="ui-campo-ic" aria-hidden="true"><MagnifyingGlass size={20} weight="bold" /></span>
                  <input type="search" inputMode="search" autoComplete="off" aria-label="Buscar cliente pelo nome ou telefone" placeholder="Buscar pelo nome ou telefone" value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} />
                  {buscaCliente && <BotaoIcone variante="limpo" tamanho="p" rotulo="Limpar a busca" onClick={() => setBuscaCliente('')}><X size={20} weight="bold" /></BotaoIcone>}
                </div>
                <Botao cheio className="nv3-cnovo" icone={<UserPlus size={20} weight="bold" />} onClick={() => { tirarCliente(); setModoNovoCli(true) }}>Cadastrar novo cliente</Botao>
                {(() => {
                  const q = buscaCliente.trim().toLowerCase()
                  // (11/10) o telefone é procurado nos dois campos e só pelos números ("41 9999" acha "(41) 99999-0000")
                  const qTel = buscaCliente.replace(/\D/g, '')
                  const qSem55 = digitosTelefone(buscaCliente)
                  const acha = (c: Cliente) => (c.nome || '').toLowerCase().includes(q)
                    || (qTel.length >= 3 && [c.telefone, c.whatsapp].some(t => String(t || '').replace(/\D/g, '').includes(qTel) || (qSem55.length >= 3 && digitosTelefone(t).includes(qSem55))))
                  let lista: Cliente[]
                  if (q) lista = clientes.filter(acha).slice(0, 30)
                  else {
                    const ult = recentes.map(id => clientes.find(c => c.id === id)).filter(Boolean) as Cliente[]
                    lista = ult.length ? ult : clientes.slice(0, 5)
                    if (clienteEscolhida && !lista.some(c => c.id === clienteEscolhida.id)) lista = [clienteEscolhida, ...lista.slice(0, 4)]
                  }
                  const linha = (c: Cliente) => {
                    const on = clienteId === c.id
                    return (
                      <button key={c.id} type="button" className={`nv3-cl${on ? ' on' : ''}`} aria-pressed={on} onClick={() => selecionarCliente(c)}>
                        <span className="nv3-ini" aria-hidden="true">{c.foto_url ? <img src={c.foto_url} alt="" /> : initialsOf(c.nome || '?')}</span>
                        <span className="nv3-cl-tx"><b>{toTitleCase(c.nome || 'Sem nome')}</b><small>{(c.telefone || c.whatsapp) ? telefoneBonito(c.telefone || c.whatsapp || '') : 'Sem telefone'}</small></span>
                        <i className="nv3-radio" aria-hidden="true" />
                      </button>
                    )
                  }
                  return (
                    <>
                      <p className="nv3-cl-t">{q ? 'Clientes encontrados' : 'Últimos clientes'}</p>
                      <div className="nv3-cls">
                        {!q && (
                          <button type="button" className={`nv3-cl${!clienteId ? ' on' : ''}`} aria-pressed={!clienteId} onClick={tirarCliente}>
                            <span className="nv3-ini nv3-ini--sem" aria-hidden="true"><Minus size={20} weight="bold" /></span>
                            <span className="nv3-cl-tx"><b>Sem cliente</b><small>Fica como Venda avulsa</small></span>
                            <i className="nv3-radio" aria-hidden="true" />
                          </button>
                        )}
                        {lista.map(linha)}
                      </div>
                      {q && lista.length === 0 && <p className="nv3-dica">Nenhum cliente com “{buscaCliente.trim()}”.</p>}
                      {clienteId && enderecoTexto && <p className="nv3-dica">Endereço: {enderecoTexto}</p>}
                    </>
                  )
                })()}
              </>
            )}
          </section>
        </>
      )}

      {/* ═══ PASSO 3: entrega ═══ */}
      {etapaLabelAtual === 'Entrega' && (
        <>
          <section className="nv3-card">
            <Titulo>Como o pedido chega?</Titulo>
            <div className="nv3-seg" role="group" aria-label="Retirada ou entrega">
              <button type="button" aria-pressed={!ehEntrega} onClick={() => setTipoEntrega('retirada')}><Storefront size={20} weight={!ehEntrega ? 'fill' : 'bold'} />Retirada</button>
              <button type="button" aria-pressed={ehEntrega} onClick={() => setTipoEntrega('entrega')}><Truck size={20} weight={ehEntrega ? 'fill' : 'bold'} />Entrega</button>
            </div>
            <p className="nv3-dica">{ehEntrega ? 'Você leva o pedido até o cliente.' : 'O cliente vem buscar com você.'}</p>
            {prontaRetirada && (
              <>
                <p className="nv3-sub">O cliente já levou?</p>
                <div className="nv3-seg" role="group" aria-label="O cliente já levou?">
                  <button type="button" aria-pressed={!vemBuscar} onClick={() => setVemBuscar(false)}><Check size={20} weight="bold" />Já levou</button>
                  <button type="button" aria-pressed={vemBuscar} onClick={() => setVemBuscar(true)}><Clock size={20} weight={vemBuscar ? 'fill' : 'bold'} />Vem buscar</button>
                </div>
                <p className="nv3-dica">{vemBuscar ? 'Entra como "Pronto para retirar" e aparece nas suas entregas.' : 'Entra como entregue.'}</p>
              </>
            )}
            {(tipo === 'encomenda' || buscaDepois) && (
              <div className="nv3-cols nv3-dh">
                <div className="ui-campo">
                  <span className="ui-campo-r"><span>{ehEntrega ? 'Data da entrega' : 'Data da retirada'}</span></span>
                  <button type="button" className="ui-campo-c nv3-abre" onClick={() => setCalNv('entrega')}>
                    <span className="ui-campo-ic" aria-hidden="true"><CalendarBlank size={20} weight="bold" /></span>
                    <span className={dataEntrega ? '' : 'nv3-ph'}>{dataEntrega ? dataDoCampo(dataEntrega) : 'Escolher'}</span>
                  </button>
                </div>
                <div className="ui-campo">
                  <span className="ui-campo-r"><span>Horário</span><small>opcional</small></span>
                  <button type="button" className="ui-campo-c nv3-abre" onClick={() => setHoraSheetAberto(true)}>
                    <span className="ui-campo-ic" aria-hidden="true"><Clock size={20} weight="bold" /></span>
                    <span className={horarioEntrega ? '' : 'nv3-ph'}>{horarioEntrega || 'Escolher'}</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {ehEntrega && (
            <section className="nv3-card">
              <Titulo acao={podeUsarEndereco ? <Botao variante="link" onClick={usarEnderecoDaCliente}>Usar o de {primeiroNome}</Botao> : undefined}>Endereço</Titulo>
              <div className="nv3-cols">
                <Campo
                  rotulo="CEP" opcional inputMode="numeric" placeholder="00000-000" maxLength={9} value={enderecoCep}
                  dica={cepLoading ? 'Buscando o endereço…' : undefined}
                  onChange={e => { const m = formatCep(e.target.value); setEnderecoCep(m); if (m.replace(/\D/g, '').length === 8) fetchCep(m) }}
                />
                <span />
              </div>
              <div className="nv3-cols nv3-rn">
                <Campo rotulo="Rua" placeholder="Ex.: Rua das Flores" value={enderecoRua} onChange={e => setEnderecoRua(e.target.value)} />
                <Campo rotulo="Número" inputMode="numeric" placeholder="120" value={enderecoNumero} onChange={e => setEnderecoNumero(e.target.value)} />
              </div>
              <div className="nv3-cols">
                <Campo rotulo="Bairro" placeholder="Ex.: Centro" value={enderecoBairro} onChange={e => setEnderecoBairro(e.target.value)} />
                <Campo rotulo="Cidade" value={enderecoCidade} onChange={e => setEnderecoCidade(e.target.value)} />
              </div>
              <Campo rotulo="Complemento" opcional placeholder="Ex.: apto, bloco, ponto de referência" value={enderecoComplemento} onChange={e => setEnderecoComplemento(e.target.value)} />
              <div className="nv3-taxa">
                <Campo rotulo="Taxa de entrega" opcional prefixo="R$" inputMode="numeric" placeholder="0,00" value={formatMaskMoney(taxaEntrega)} onChange={e => setTaxaEntrega(parseMaskMoney(e.target.value))} />
              </div>
            </section>
          )}
          {tipo === 'encomenda' && !dataEntrega && <p className={`nv3-dica nv3-centro${tentou ? ' nv3-falta' : ''}`}>Escolha a data para continuar.</p>}
          {ehEntrega && !enderecoRua.trim() && <p className={`nv3-dica nv3-centro${tentou ? ' nv3-falta' : ''}`}>Escreva a rua para continuar.</p>}
        </>
      )}

      {/* ═══ PASSO 4: pagamento ═══ */}
      {etapaLabelAtual === 'Pagamento' && (
        <>
          <section className="nv3-card">
            <Titulo>Quanto já entrou?</Titulo>
            <div role="radiogroup" aria-label="Quanto já entrou">
              {([
                { chave: 'total', nome: 'Tudo agora', dica: `Recebi ${rs(total)}` },
                { chave: 'parcial', nome: 'Só uma parte (sinal)', dica: 'Você escreve quanto recebeu' },
                ...(tipo === 'encomenda' || buscaDepois ? [{ chave: 'na_entrega', nome: ehEntrega ? 'Paga na entrega' : 'Paga na retirada', dica: ehEntrega ? 'Ele paga quando receber o pedido' : 'Ele paga quando vier buscar' }] : []),
                { chave: 'fiado', nome: 'Vai pagar depois', dica: 'Você escolhe a data combinada' },
              ] as { chave: SituacaoPag; nome: string; dica: string }[]).map(o => (
                <div key={o.chave}>
                  <label className={`nv3-op${situacaoPag === o.chave ? ' on' : ''}`}>
                    <input type="radio" name="nv3-situacao" className="nv3-esc" checked={situacaoPag === o.chave} onChange={() => setSituacaoPag(o.chave)} />
                    <i className="nv3-rd" aria-hidden="true" />
                    <span><b>{o.nome}</b><small>{o.dica}</small></span>
                  </label>
                  {o.chave === 'parcial' && situacaoPag === 'parcial' && (
                    <div className="nv3-op-mais">
                      <Campo
                        rotulo="Quanto ele já pagou" prefixo="R$" inputMode="numeric" placeholder="0,00"
                        value={formatMaskMoney(valorParcial)} onChange={e => setValorParcial(parseMaskMoney(e.target.value))}
                        erro={valorParcial > 0 && r2(valorParcial) >= total ? `Precisa ser menos que ${rs(total)}. Se ele pagou tudo, escolha "Tudo agora".` : undefined}
                        dica={valorParcial > 0 && r2(valorParcial) < total ? `Falta ${rs(r2(total - valorParcial))}` : undefined}
                      />
                    </div>
                  )}
                  {o.chave === 'fiado' && situacaoPag === 'fiado' && (
                    <div className="nv3-op-mais ui-campo">
                      <span className="ui-campo-r"><span>Combinado para pagar em</span><small>opcional</small></span>
                      <button type="button" className="ui-campo-c nv3-abre" onClick={() => setCalNv('pagamento')}>
                        <span className="ui-campo-ic" aria-hidden="true"><CalendarBlank size={20} weight="bold" /></span>
                        <span className={dataPrevistaPagamento ? '' : 'nv3-ph'}>{dataPrevistaPagamento ? dataDoCampo(dataPrevistaPagamento) : 'Escolher'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!situacaoPag && <p className={`nv3-dica${tentou ? ' nv3-falta' : ''}`}>Escolha quanto já entrou para continuar.</p>}
          </section>

          {/* (21/10) "Como ele pagou?" só quando entrou dinheiro (antes vinha primeiro, com o Pix marcado, até pra quem vai pagar depois) */}
          {(situacaoPag === 'total' || situacaoPag === 'parcial') && <section className="nv3-card">
            <Titulo>Como ele pagou?</Titulo>
            <div className="nv3-formas" role="group" aria-label="Forma de pagamento">
              {([['PIX', 'Pix', QrCode], ['Dinheiro', 'Dinheiro', Money], ['Crédito', 'Crédito', CreditCard], ['Débito', 'Débito', Bank]] as const).map(([chave, nome, Icone]) => (
                <button key={chave} type="button" aria-pressed={formaPagamento === chave} onClick={() => setFormaPagamento(chave)}>
                  <Icone size={24} weight={formaPagamento === chave ? 'fill' : 'bold'} />{nome}
                </button>
              ))}
            </div>
          </section>}

          <section className="nv3-card">
            <Titulo>Desconto ou acréscimo</Titulo>
            <div className="nv3-cols nv3-cols--fim">
              <Campo rotulo="Desconto" opcional prefixo="R$" inputMode="numeric" placeholder="0,00" value={formatMaskMoney(desconto)} onChange={e => setDesconto(parseMaskMoney(e.target.value))} />
              <Campo rotulo="Acréscimo" opcional prefixo="R$" inputMode="numeric" placeholder="0,00" value={formatMaskMoney(acrescimo)} onChange={e => setAcrescimo(parseMaskMoney(e.target.value))} />
            </div>
          </section>
        </>
      )}

      {/* ═══ PASSO 5: revisar ═══ */}
      {etapaLabelAtual === 'Revisar' && (
        <>
          <section className="nv3-card">
            <Titulo>Em que situação o pedido entra?</Titulo>
            <div className="nv3-sit" role="group" aria-label="Em que situação o pedido entra">
              {COMECOS.map(c => <button key={c.chave} type="button" aria-pressed={statusPedido === c.chave} disabled={jaLevou && c.chave !== 'entregue'} onClick={() => setStatusPedido(c.chave)}>{c.nome}</button>)}
            </div>
            <p className="nv3-dica"><b>{comeco.nome}:</b> {comeco.dica}</p>
          </section>

          <section className="nv3-card nv3-res-card">
            <Titulo acao={<Botao variante="link" onClick={() => irParaPasso(1)}>Editar</Botao>}>Resumo</Titulo>
            <div className="nv3-res">
              <Linha rotulo="Tipo">{tipo === 'pronta_entrega' ? 'Pronta entrega' : 'Encomenda'}</Linha>
              <Linha rotulo="Cliente">{nomeDaCliente}</Linha>
              {clienteTelefone && !semCliente && <Linha rotulo="Telefone">{telefoneBonito(clienteTelefone)}</Linha>}
              {tipo === 'encomenda' || buscaDepois
                ? <Linha rotulo={ehEntrega ? 'Entrega' : 'Retirada'}>{dataLonga(dataEntrega, horarioEntrega)}</Linha>
                : <Linha rotulo="Como chega">{ehEntrega ? 'Entrega' : 'Retirada'}</Linha>}
              {ehEntrega && enderecoTexto && <Linha rotulo="Endereço">{enderecoTexto}</Linha>}
              <Linha rotulo="Pagamento" tom={situacaoPag === 'total' ? 'verde' : 'laranja'}>{textoPagamento}</Linha>
            </div>
            <div className="nv3-contas">
              {itens.map((it, idx) => (
                <div key={idx}>
                  <p><span>{itemComQtd(`${nomeDeProduto(it.nome_produto)}${it.opcaoLabel ? ` · ${it.opcaoLabel}` : ''}`, it.quantidade, it.forma_venda === 'kg' && !pesoLivre(it, 'kg') ? null : it.forma_venda)}</span><span>{rs(r2(it.valor_unitario * it.quantidade))}</span></p>
                  {it.observacoes && <p className="rec"><span>Recado: {it.observacoes}</span></p>}
                </div>
              ))}
              {taxaConta > 0 && <p className="dim"><span>Taxa de entrega</span><span>{rs(taxaConta)}</span></p>}
              {desconto > 0 && <p className="dim"><span>Desconto</span><span>− {rs(desconto)}</span></p>}
              {acrescimo > 0 && <p className="dim"><span>Acréscimo</span><span>{rs(acrescimo)}</span></p>}
              {/* o total fica no rodapé (sem repetir aqui) */}
              {situacaoPag === 'parcial' && <p className="dim"><span>Recebido agora</span><span>{rs(valorParcial)}</span></p>}
              {situacaoPag !== 'total' && <p className="falta"><span>Falta receber</span><span>{rs(falta)}</span></p>}
            </div>
          </section>

          <section className="nv3-card">
            <CampoArea rotulo="Observações do pedido" opcional placeholder="Ex.: cuidados especiais, alergias, decoração" value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </section>
        </>
      )}
      </div>

      {/* ═══ Resumo da venda (computador largo) ═══ */}
      <aside className="nv3-lado" aria-label="Resumo da venda">
        <h2>Resumo da venda</h2>
        {itens.length === 0
          ? <p className="nv3-lado-vz">Nenhum produto ainda.</p>
          : (
            <div className="nv3-lado-its">
              {itens.map((it, idx) => (
                <div key={idx}>
                  <p><span>{itemComQtd(`${nomeDeProduto(it.nome_produto)}${it.opcaoLabel ? ` · ${it.opcaoLabel}` : ''}`, it.quantidade, it.forma_venda === 'kg' && !pesoLivre(it, 'kg') ? null : it.forma_venda)}</span><span>{rs(r2(it.valor_unitario * it.quantidade))}</span></p>
                  {it.observacoes && <p className="rec"><span>Recado: {it.observacoes}</span></p>}
                </div>
              ))}
              {taxaConta > 0 && <p className="dim"><span>Taxa de entrega</span><span>{rs(taxaConta)}</span></p>}
              {desconto > 0 && <p className="dim"><span>Desconto</span><span>− {rs(desconto)}</span></p>}
              {acrescimo > 0 && <p className="dim"><span>Acréscimo</span><span>{rs(acrescimo)}</span></p>}
            </div>
          )}
        <div className="nv3-lado-inf">
          <p><span>Tipo</span><b className={tipo ? '' : 'falta'}>{tipo === 'pronta_entrega' ? 'Pronta entrega' : tipo === 'encomenda' ? 'Encomenda' : 'Falta escolher'}</b></p>
          <p><span>Cliente</span><b className={etapa < 2 ? 'falta' : ''}>{etapa < 2 ? 'Falta escolher' : nomeDaCliente}</b></p>
          <p><span>{ehEntrega ? 'Entrega' : 'Retirada'}</span><b className={etapa < 3 || ((tipo === 'encomenda' || buscaDepois) && !dataEntrega) ? 'falta' : ''}>{
            etapa < 3 ? 'Falta escolher'
            : tipo === 'encomenda' || buscaDepois ? (dataEntrega ? dataLonga(dataEntrega, horarioEntrega) : 'Falta escolher')
            : jaLevou ? 'Já levou' : ehEntrega ? 'Entrega' : 'Retirada'}</b></p>
          <p><span>Pagamento</span><b className={!situacaoPag ? 'falta' : situacaoPag === 'total' ? 'ok' : 'lar'}>{textoPagamento}</b></p>
        </div>
        <p className="nv3-lado-tot"><span>Total</span><b>{rs(total)}</b></p>
        {situacaoPag && situacaoPag !== 'total' && itens.length > 0 && <p className="nv3-lado-falta"><span>Falta receber</span><b>{rs(falta)}</b></p>}
        <div className="nv3-lado-bts">
          {isUltima
            ? <Botao cheio onClick={finalizarVenda} carregando={salvando}>Registrar venda</Botao>
            : <Botao cheio onClick={proximaEtapa}>Continuar</Botao>}
          <Botao cheio variante="secundario" onClick={voltarEtapa} disabled={salvando}>{etapa === 1 ? 'Cancelar' : 'Voltar'}</Botao>
        </div>
      </aside>
      </div>
    </div>

    {/* Rodapé fixo: total sempre à vista + Voltar e Continuar.
        (16/10) no passo 1 só aparece depois do tipo de venda e de um produto (antes cobria o cartão de produtos) */}
    {!(etapa === 1 && !(tipo && itens.length > 0)) && <div className="nv3-pe">
      <div className="nv3-pe-in">
        <p className="nv3-pe-tot"><span>Total</span><b>{rs(total)}</b></p>
        <div className="nv3-pe-bts">
          <Botao variante="secundario" onClick={voltarEtapa} disabled={salvando}>{etapa === 1 ? 'Cancelar' : 'Voltar'}</Botao>
          {isUltima
            ? <Botao onClick={finalizarVenda} carregando={salvando}>Registrar venda</Botao>
            : <Botao onClick={proximaEtapa}>Continuar</Botao>}
        </div>
      </div>
    </div>}

    {/* ═══ Escolher o tamanho ou o kit ═══ */}
    <Janela aberta={!!escolhaProduto} aoFechar={() => { setEscolhaProduto(null); setQtdLivre(null); setOutro({ aberto: false, peso: '', valor: 0 }) }} tipo="conteudo" titulo={escolhaProduto ? nomeDeProduto(escolhaProduto.p.nome) : ''}>
      {escolhaProduto && (
        <>
          <p className="tpj-txt">{escolhaProduto.p.kit_qtd?.ativo ? (escolhaProduto.p.kit_qtd?.modo === 'livre' ? 'Quantas unidades o cliente levou?' : 'Qual kit o cliente levou?') : 'Qual tamanho?'}</p>
          {/* (14/10) kit "ele escolhe": quantidades redondas em botões + campo pra qualquer outra (antes era uma lista de 100, 150, 200…) */}
          {escolhaProduto.p.kit_qtd?.modo === 'livre' ? (() => {
            const p = escolhaProduto.p
            const kq: any = p.kit_qtd
            const min = Number(kq.livre?.min) || 1, max = Number(kq.livre?.max) || 0, passo = Number(kq.livre?.passo) || 1
            const q = qtdLivre ?? min
            const op = opcaoKitLivre(p, q)
            const valida = !!op && (q - min) % passo === 0
            return (
              <div className="nv3-livre">
                <div className="nv3-livre-chips" role="group" aria-label="Quantidades">
                  {quantidadesSugeridas(p).map(n => (
                    <button key={n} type="button" className={n === q ? 'on' : ''} onClick={() => setQtdLivre(n)}>{n === 100 ? 'Cento' : `${n} un.`}</button>
                  ))}
                </div>
                <div className="nv3-livre-qtd">
                  <button type="button" aria-label="Menos" disabled={q - passo < min} onClick={() => setQtdLivre(Math.max(min, q - passo))}><Minus size={18} weight="bold" /></button>
                  <input inputMode="numeric" aria-label="Quantidade" value={q || ''} onChange={e => setQtdLivre(parseInt(e.target.value.replace(/\D/g, '')) || 0)} />
                  <span>unidades</span>
                  <button type="button" aria-label="Mais" disabled={!!max && q + passo > max} onClick={() => setQtdLivre(q + passo)}><Plus size={18} weight="bold" /></button>
                </div>
                <p className="nv3-livre-dica">De {min} a {max || '…'}, de {passo} em {passo}.</p>
                <Botao cheio disabled={!valida} onClick={() => { if (op && valida) { setQtdLivre(null); addProduto(p, op) } }}>
                  {valida ? `Adicionar · ${rs(op!.valor)}` : 'Quantidade fora do que o kit aceita'}
                </Botao>
              </div>
            )
          })() : (() => {
            const kit = !!escolhaProduto.p.kit_qtd?.ativo
            const ops: any[] = (escolhaProduto.p as any).grupo_tamanhos?.opcoes || []
            const dados = (o: { label: string }) => ops.find(x => String(x?.nome || '').trim() === o.label) || {}
            const serveDe = (o: { label: string }) => { const v = String(dados(o).serve || '').trim(); return /^\d+$/.test(v) ? `${v} pessoas` : v }
            const comServe = !kit && escolhaProduto.opcoes.some(o => serveDe(o))
            // preço do kg: produto vendido por kg, ou tamanhos com preço pelo peso
            const precoKg = !kit && (escolhaProduto.p.forma_venda === 'kg' || (escolhaProduto.p as any).grupo_tamanhos?.modo_preco_tamanho === 'por_peso') ? precoDeVenda(escolhaProduto.p) : 0
            const pesoNum = parseFloat(outro.peso.replace(',', '.')) || 0
            const addOutro = () => {
              const label = pesoNum > 0 ? `${String(pesoNum).replace('.', ',')} kg` : 'Outro tamanho'
              addProduto(escolhaProduto.p, { label, valor: r2(outro.valor), pers: { tamanho: { nome: label, preco: r2(outro.valor), peso_kg: pesoNum || null } } })
              setOutro({ aberto: false, peso: '', valor: 0 })
            }
            return (
              <>
              <div className={`nv3-tab${comServe ? ' nv3-tab--3' : ''}`} role="table" aria-label={kit ? 'Kits' : 'Tamanhos'}>
                <div className="nv3-tab-l nv3-tab-h" role="row"><span role="columnheader">{kit ? 'Kit' : 'Tamanho'}</span>{comServe && <span role="columnheader">Serve até</span>}<span role="columnheader">Preço</span></div>
                {escolhaProduto.opcoes.map(o => {
                  const esg = !!dados(o).esgotado
                  const peso = o.pers?.tamanho?.peso_kg && o.pers.tamanho.peso_kg + '' !== o.label ? `${String(o.pers.tamanho.peso_kg).replace('.', ',')} kg` : ''
                  return (
                    <button type="button" role="row" key={o.label} className={`nv3-tab-l${esg ? ' esg' : ''}`} onClick={() => addProduto(escolhaProduto.p, o)}>
                      <span role="cell" className="nv3-tab-n"><i className="nv3-radio" aria-hidden="true" /><span><b>{o.label}</b>{(peso || esg) && <small>{[peso, esg ? 'Esgotado' : ''].filter(Boolean).join(' · ')}</small>}</span></span>
                      {comServe && <span role="cell">{serveDe(o) || '—'}</span>}
                      <span role="cell" className="nv3-tab-p">{rs(o.valor)}</span>
                    </button>
                  )
                })}
                {!kit && (
                  <button type="button" role="row" className={`nv3-tab-l nv3-tab-outro${outro.aberto ? ' on' : ''}`} aria-expanded={outro.aberto} onClick={() => setOutro(o => ({ ...o, aberto: !o.aberto }))}>
                    <span role="cell" className="nv3-tab-n"><i className="nv3-radio" aria-hidden="true" /><span><b>Outro tamanho</b><small>{precoKg ? `${rs(precoKg)} o kg` : 'Você digita o preço'}</small></span></span>
                  </button>
                )}
              </div>
              {outro.aberto && (
                <div className="nv3-outro">
                  <div className="nv3-cols">
                    <Campo rotulo="Peso" opcional={!precoKg} inputMode="decimal" placeholder="Ex.: 2,3" depois={<span className="nv3-kg" aria-hidden="true">kg</span>} value={outro.peso}
                      onChange={e => { const v = e.target.value.replace(/[^\d,.]/g, ''); const n = parseFloat(v.replace(',', '.')) || 0; setOutro(o => ({ ...o, peso: v, valor: precoKg && n > 0 ? r2(precoKg * n) : o.valor })) }} />
                    <Campo rotulo="Preço" prefixo="R$" inputMode="numeric" placeholder="0,00" value={formatMaskMoney(outro.valor)} onChange={e => setOutro(o => ({ ...o, valor: parseMaskMoney(e.target.value) }))} />
                  </div>
                  <Botao cheio disabled={!(outro.valor > 0)} onClick={addOutro}>{outro.valor > 0 ? `Adicionar · ${rs(outro.valor)}` : 'Escreva o preço'}</Botao>
                </div>
              )}
              </>
            )
          })()}
        </>
      )}
    </Janela>

    {/* ═══ Adicionar produto (janela padrão; categorias em botões) ═══ */}
    {(() => {
      const q = buscaProduto.trim().toLowerCase()
      const lista = produtos.filter(p => (p.nome || '').toLowerCase().includes(q) && (!filtroCategoria || (p.categoria || '').trim() === filtroCategoria))
      return (
        <Janela aberta={modalProduto} aoFechar={() => setModalProduto(false)} tipo="conteudo" titulo="Adicionar produto">
          <div className="ui-campo-c tpj-busca">
            <span className="ui-campo-ic" aria-hidden="true"><MagnifyingGlass size={20} weight="bold" /></span>
            <input type="search" inputMode="search" autoComplete="off" aria-label="Buscar produto" placeholder="Buscar produto" value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} />
          </div>
          {categoriasComContagem.length > 0 && (
            <div className="tpj-cats" role="group" aria-label="Ver por categoria">
              <button type="button" className="tpj-cat" aria-pressed={!filtroCategoria} onClick={() => setFiltroCategoria(null)}>Todas</button>
              {categoriasComContagem.map(c => <button key={c.nome} type="button" className="tpj-cat" aria-pressed={filtroCategoria === c.nome} onClick={() => setFiltroCategoria(c.nome)}>{c.nome}</button>)}
            </div>
          )}
          <div className="tpj-lista">
            {lista.map(p => {
              const foto = primeiraFoto(p.imagem_url)
              return (
                <button key={p.id} type="button" className="tpj-it" onClick={() => addProduto(p)}>
                  <span className="tpj-ft" aria-hidden="true"><Package size={20} weight="bold" />{foto && <img src={foto} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />}</span>
                  <span className="tpj-tx"><b>{nomeDeProduto(p.nome || 'Produto sem nome')}</b>{p.categoria && <small>{p.categoria}</small>}</span>
                  {/* (11/10) produto simples: o preço já com a promoção, o mesmo que entra na venda (com tamanhos ou kit, o preço aparece na escolha) */}
                  <span className="tpj-preco">{rs(opcoesDoProduto(p).length ? p.preco_normal : precoDeVenda(p))}</span>
                </button>
              )
            })}
            {lista.length === 0 && <p className="tpj-vz">Nenhum produto{q ? ` com “${buscaProduto.trim()}”` : ' nessa categoria'}.</p>}
          </div>
        </Janela>
      )
    })()}

    {/* calendário e horário do app */}
    {/* encomenda (e pagamento combinado) não aceita dia que já passou */}
    {calNv && <CalendarioSheet valor={calNv === 'entrega' ? dataEntrega : dataPrevistaPagamento} min={hojeISO()} titulo={calNv === 'entrega' ? (ehEntrega ? 'Data da entrega' : 'Data da retirada') : 'Pagamento combinado pra'}
      onClose={() => setCalNv(null)} onConfirmar={d => { if (calNv === 'entrega') setDataEntrega(d); else setDataPrevistaPagamento(d); setCalNv(null) }} />}
    {horaSheetAberto && (
      <HorarioSheet value={horarioEntrega} onChange={setHorarioEntrega} onClose={() => setHoraSheetAberto(false)} titulo={ehEntrega ? 'Horário da entrega' : 'Horário da retirada'} />
    )}
    </>
  )
}

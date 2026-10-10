import CalendarioSheet from '@/components/CalendarioSheet'
import { useState, useEffect, useMemo, useRef } from 'react'
import { criarPedido, opcoesDoProduto as opcoesDoProdutoLib, type DadosPedido } from '@/lib/pedidosDoo'
import { gerarPedidoPDF } from '@/lib/gerarPedidoPDF'
import { abrirJanela } from '@/lib/pdfDoonly'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import AppPageHeader from '@/components/AppPageHeader'
import HorarioSheet from '@/components/HorarioSheet'
import { tocarSom } from '@/hooks/useSom'
import { Bank, CalendarBlank, CalendarDots, Check, Clock, Copy, CreditCard, Lightning, MagnifyingGlass, Minus, Money, Package, Plus, QrCode, Storefront, Trash, Truck, UserPlus, X } from '@phosphor-icons/react'
import { Botao, BotaoIcone, Campo, CampoArea, Janela, Linha, TelaVazia, Titulo, avisar, confirmar } from '@/components/base'
import { dataLonga, itemComQtd, nomeDeProduto, rs, telefoneBonito } from '@/components/pedidos/pedidoTexto'
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
  { chave: 'aguardando_aceite', nome: 'Novo pedido', dica: 'Fica em "Pra aceitar" na sua lista até você aceitar.' },
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
  const [userId, setUserId] = useState<string | null>(null)

  const [tipo, setTipo] = useState<TipoVenda>(null)
  const [itens, setItens] = useState<ItemVenda[]>([])
  const [semCliente, setSemCliente] = useState(false)
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [clienteNome, setClienteNome] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const [modoNovoCli, setModoNovoCli] = useState(false)

  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>('retirada')
  const [dataEntrega, setDataEntrega] = useState('')
  const [horarioEntrega, setHorarioEntrega] = useState('')
  const [enderecoRua, setEnderecoRua] = useState('')
  const [enderecoNumero, setEnderecoNumero] = useState('')
  const [enderecoBairro, setEnderecoBairro] = useState('')
  const [enderecoCidade, setEnderecoCidade] = useState('Curitiba')
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

  // Modal cliente
  const [modalCliente, setModalCliente] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [buscaCliente, setBuscaCliente] = useState('')

  const [salvando, setSalvando] = useState(false)
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
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { navigate('/login'); return }
      setUserId(user.id)
      const [{ data: prds }, { data: cls }] = await Promise.all([
        supabase.from('produtos').select('id,nome,preco_normal,forma_venda,imagem_url,categoria,grupo_tamanhos,kit_qtd').eq('user_id', user.id).order('nome'),
        supabase.from('clientes').select('id,nome,telefone,whatsapp,rua,numero,bairro,cidade,complemento,foto_url').eq('user_id', user.id).order('nome'),
      ])
      setProdutos(prds || [])
      setClientes(cls || [])
      setProdutosLoaded(true)
      // Veio da página da cliente ("Novo pedido"): já começa com ela escolhida (08/10 · 3.34)
      const doLink = new URLSearchParams(window.location.search).get('cliente')
      const escolhida = doLink ? (cls || []).find((c: any) => c.id === doLink) : null
      if (escolhida) selecionarCliente(escolhida as any)
    })
  }, [])

  // Ajusta tipoEntrega default quando muda o tipo de venda
  useEffect(() => {
    // Veio preenchida da Doo IA: mantém a entrega que já veio (não volta pra "Retirada")
    if (preenchidaRef.current) { preenchidaRef.current = false; return }
    setTipoEntrega('retirada')
  }, [tipo])

  // Scroll pro topo quando muda de etapa ou entra na tela de sucesso
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [etapa, sucessoAberto])

  // ── Cálculos ────────────────────────────────────────────────────────────
  const subtotalProdutos = useMemo(
    () => itens.reduce((acc, i) => acc + i.valor_unitario * i.quantidade, 0),
    [itens]
  )
  const total = useMemo(
    () => Math.max(0, subtotalProdutos + (tipoEntrega === 'entrega' ? taxaEntrega : 0) - desconto + acrescimo),
    [subtotalProdutos, taxaEntrega, desconto, acrescimo, tipoEntrega]
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
      if (!tipo && itens.length === 0) return 'Escolha o tipo de venda e adicione pelo menos um produto pra continuar.'
      if (itens.length === 0) return 'Adicione pelo menos um produto pra continuar.'
      if (!tipo) return 'Escolha o tipo de venda pra continuar.'
      return null
    }
    if (etapaLabelAtual === 'Entrega') {
      if (tipo === 'encomenda' && !dataEntrega) return 'Escolha a data pra continuar.'
      if (tipoEntrega === 'entrega' && !enderecoRua.trim()) return 'Escreva a rua pra continuar.'
      return null
    }
    if (etapaLabelAtual === 'Pagamento') {
      if (!situacaoPag) return 'Escolha quanto já entrou pra continuar.'
      // Pagamento parcial precisa do valor recebido (maior que zero e menor que o total)
      if (situacaoPag === 'parcial' && !(valorParcial > 0 && valorParcial < total)) return 'Escreva quanto ele já pagou pra continuar.'
    }
    return null
  }
  const [tentou, setTentou] = useState(false)
  useEffect(() => { setTentou(false) }, [etapa])

  const proximaEtapa = () => {
    const falta = oQueFalta()
    if (falta) { setTentou(true); return }
    if (etapa < totalEtapas) setEtapa(e => e + 1)
  }
  const voltarEtapa = () => {
    if (etapa > 1) setEtapa(e => e - 1)
    else sairDaVenda()
  }
  // Sair no meio: se já tem produto, pergunta antes de perder o que foi preenchido
  const sairDaVenda = async () => {
    if (itens.length > 0) {
      const ok = await confirmar({ titulo: 'Cancelar esta venda?', texto: 'O que você preencheu até aqui vai ser perdido.', rotulo: 'Cancelar venda', perigo: true })
      if (!ok) return
    }
    navigate('/pedidos')
  }

  // ── Adicionar produto ──────────────────────────────────────────────────
  // Produto com tamanhos (P/M/G, pelo peso) ou kits: pergunta qual antes de adicionar (30/09).
  // Antes entrava sempre com o menor preço, sem jeito de escolher.
  const opcoesDoProduto = (p: Produto) => opcoesDoProdutoLib(p) // mesma regra da Doo IA
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
      valor_unitario: escolha ? escolha.valor : p.preco_normal,
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
    // Puxa endereço cadastrado (se tiver)
    if (c.rua) setEnderecoRua(c.rua)
    if (c.numero) setEnderecoNumero(c.numero)
    if (c.bairro) setEnderecoBairro(c.bairro)
    if (c.cidade) setEnderecoCidade(c.cidade)
    if (c.complemento) setEnderecoComplemento(c.complemento)
    setModalCliente(false)
    setBuscaCliente('')
  }

  // ── Finalizar Venda ────────────────────────────────────────────────────
  const finalizarVenda = async () => {
    if (!userId || salvando) return
    if (!situacaoPag) { setEtapa(etapas.indexOf('Pagamento') + 1); avisar('Escolha quanto já entrou pra continuar.', { tipo: 'info' }); return }
    setSalvando(true)

    // Salvar: a mesma função usada pela Doo IA (lib/pedidosDoo) — pedido igual nos dois caminhos
    const res = await criarPedido(userId, {
      tipo: (tipo || 'encomenda') as any, itens, semCliente, clienteId, clienteNome, clienteTelefone,
      clienteNovo: !semCliente && !clienteId && modoNovoCli && !!clienteNome.trim(),
      tipoEntrega: tipoEntrega as any, dataEntrega, horarioEntrega,
      endereco: { rua: enderecoRua, numero: enderecoNumero, bairro: enderecoBairro, cidade: enderecoCidade, complemento: enderecoComplemento },
      taxaEntrega, desconto, acrescimo, formaPagamento, situacaoPag, valorParcial, dataPrevistaPagamento,
      // "Pronto" de retirada entra como "Pronto pra retirar" (o mesmo caminho da lista e da tela do pedido)
      statusPedido: statusPedido === 'finalizado' && tipoEntrega === 'retirada' ? 'aguardando_retirada' : statusPedido,
      observacoes, origem: origemDoo ? 'doo' : 'manual',
    })
    if (res.ok === false) {
      avisar('Não deu pra registrar a venda: ' + res.erro, { tipo: 'erro' })
      setSalvando(false)
      return
    }
    if (res.aviso) avisar(res.aviso, { tipo: 'info' })
    const novoPedido: any = res.pedido

    // Salva dados do pedido pra mostrar na tela de sucesso
    setPedidoCriado({
      id: novoPedido.id,
      numero: novoPedido.numero || null, // sem número: a tela diz só "Pedido registrado" (nunca mostra o id interno)
      itens: [...itens],
      clienteNome: semCliente || !clienteNome ? '' : clienteNome,
      clienteTelefone: semCliente ? '' : clienteTelefone,
      total,
      tipo,
      dataEntrega,
      horarioEntrega,
    })
    setSucessoAberto(true)
    setSalvando(false)
    tocarSom('pedido')
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
  useEffect(() => {
    const d = (locNV.state as any)?.rascunhoDoo as DadosPedido | undefined
    if (!d) return
    window.history.replaceState({}, '')
    setOrigemDoo(true)
    preenchidaRef.current = true
    setTipo(d.tipo as any); setItens(d.itens as any)
    setSemCliente(d.semCliente); setClienteId(d.clienteId); setClienteNome(d.clienteNome); setClienteTelefone(d.clienteTelefone); setModoNovoCli(d.clienteNovo)
    setTipoEntrega(d.tipoEntrega as any); setDataEntrega(d.dataEntrega); setHorarioEntrega(d.horarioEntrega)
    setEnderecoRua(d.endereco.rua); setEnderecoNumero(d.endereco.numero); setEnderecoBairro(d.endereco.bairro); setEnderecoCidade(d.endereco.cidade); setEnderecoComplemento(d.endereco.complemento)
    setTaxaEntrega(d.taxaEntrega); setDesconto(d.desconto); setAcrescimo(d.acrescimo)
    setFormaPagamento(d.formaPagamento); setSituacaoPag(d.situacaoPag); setValorParcial(d.valorParcial); setDataPrevistaPagamento(d.dataPrevistaPagamento)
    setStatusPedido((d.statusPedido || 'agendado') as any); setObservacoes(d.observacoes)
    setEtapa(5)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset completo pra nova venda
  const resetVenda = () => {
    setEtapa(1)
    setTipo(null)
    setItens([])
    setClienteId(null); setClienteNome(''); setClienteTelefone(''); setSemCliente(false); setModoNovoCli(false)
    setTipoEntrega('retirada')
    setDataEntrega(''); setHorarioEntrega('')
    setEnderecoRua(''); setEnderecoNumero(''); setEnderecoBairro(''); setEnderecoCidade('Curitiba'); setEnderecoComplemento(''); setTaxaEntrega(0); setEnderecoCep('')
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
  const falta = situacaoPag === 'parcial' ? Math.max(0, total - valorParcial) : situacaoPag === 'total' ? 0 : total
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
  const cabecalho = <AppPageHeader title="Nova venda" subtitle={subtituloTopo} onBack={sucessoAberto ? () => navigate('/pedidos') : sairDaVenda} />

  // ═══ Venda registrada ═══
  if (sucessoAberto && pedidoCriado) {
    const pc = pedidoCriado
    const naAgenda = pc.tipo === 'encomenda' && statusPedido !== 'entregue'
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
              {pc.tipo === 'encomenda' && pc.dataEntrega && <Linha rotulo={ehEntrega ? 'Entrega' : 'Retirada'}>{dataLonga(pc.dataEntrega, pc.horarioEntrega)}</Linha>}
              <Linha rotulo="Total">{rs(pc.total)}</Linha>
              <Linha rotulo="Pagamento" tom={situacaoPag === 'total' ? 'verde' : 'laranja'}>{textoPagamento}</Linha>
              {situacaoPag !== 'total' && falta > 0.009 && <Linha rotulo="Falta receber" tom="laranja">{rs(falta)}</Linha>}
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

  // ── Precisa ter ao menos 1 produto cadastrado ──
  if (produtos.length === 0) {
    return (
      <>
        {cabecalho}
        <div className="nv3">
          <TelaVazia
            icone={<Package size={30} />}
            titulo="Cadastre seu primeiro produto"
            texto="Você precisa ter pelo menos um produto cadastrado pra registrar vendas."
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

      {/* ═══ PASSO 1: tipo + produtos ═══ */}
      {etapaLabelAtual === 'Venda' && (
        <>
          <section className="nv3-card">
            <Titulo>Que tipo de venda é?</Titulo>
            <div className="nv3-tipos" role="group" aria-label="Tipo de venda">
              <button type="button" aria-pressed={tipo === 'encomenda'} onClick={() => setTipo('encomenda')}>
                <CalendarDots size={24} weight={tipo === 'encomenda' ? 'fill' : 'bold'} /><b>Encomenda</b><small>Pra entregar ou retirar em outro dia</small>
              </button>
              <button type="button" aria-pressed={tipo === 'pronta_entrega'} onClick={() => setTipo('pronta_entrega')}>
                <Lightning size={24} weight={tipo === 'pronta_entrega' ? 'fill' : 'bold'} /><b>Pronta entrega</b><small>O cliente está levando agora</small>
              </button>
            </div>
            {!tipo && (itens.length > 0 || tentou) && <p className="nv3-dica nv3-falta">Escolha o tipo de venda pra continuar.</p>}
          </section>

          <section className="nv3-card">
            <Titulo contagem={itens.length} acao={itens.length > 0 ? <Botao variante="link" icone={<Plus size={16} weight="bold" />} onClick={() => setModalProduto(true)}>Adicionar</Botao> : undefined}>Produtos</Titulo>
            {itens.length === 0 ? (
              <div className="nv3-vz">
                <span className="nv3-vz-ic" aria-hidden="true"><Package size={30} /></span>
                <b>Nenhum produto ainda</b>
                <p>Adicione o que o cliente pediu.</p>
                <Botao icone={<Plus size={20} weight="bold" />} onClick={() => setModalProduto(true)}>Adicionar produto</Botao>
                {tentou && <p className="nv3-dica nv3-falta">Adicione pelo menos um produto pra continuar.</p>}
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
                          <b>{nome}{it.opcaoLabel ? ` · ${it.opcaoLabel}` : ''}</b>
                          <span>{rs(it.valor_unitario * it.quantidade)}{it.quantidade > 1 ? ` · ${rs(it.valor_unitario)} cada` : ''}</span>
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
          </section>
        </>
      )}

      {/* ═══ PASSO 2: cliente (opcional) ═══ */}
      {etapaLabelAtual === 'Cliente' && (
        <>
          <section className="nv3-card">
            <Titulo>Pra quem é?</Titulo>
            {modoNovoCli ? (
              <>
                <div className="nv3-cols">
                  <Campo className="nv3-larga" rotulo="Nome do cliente" placeholder="Ex.: Mariana Albuquerque" autoComplete="off" value={clienteNome} onChange={e => setClienteNome(e.target.value)} />
                  <Campo className="nv3-larga" rotulo="Telefone ou WhatsApp" opcional type="tel" inputMode="tel" placeholder="(41) 99999-0000" value={clienteTelefone} onChange={e => setClienteTelefone(e.target.value)} />
                </div>
                <p className="nv3-dica">Ele fica salvo nos seus clientes quando você registrar a venda.</p>
                <Botao variante="link" icone={<X size={16} weight="bold" />} onClick={() => { setModoNovoCli(false); setClienteNome(''); setClienteTelefone('') }}>Voltar pra busca</Botao>
              </>
            ) : clienteId ? (
              <>
                <div className="nv3-cli">
                  <span className="nv3-ini" aria-hidden="true">{clienteEscolhida?.foto_url ? <img src={clienteEscolhida.foto_url} alt="" /> : initialsOf(clienteNome)}</span>
                  <div className="nv3-cli-tx">
                    <b>{toTitleCase(clienteNome)}</b>
                    <span>{clienteTelefone ? telefoneBonito(clienteTelefone) : 'Sem telefone'}</span>
                    {enderecoTexto && <small>{enderecoTexto}</small>}
                  </div>
                  <BotaoIcone rotulo="Tirar o cliente" variante="limpo" tamanho="p" onClick={tirarCliente}><X size={20} weight="bold" /></BotaoIcone>
                </div>
                <div className="nv3-cli-acoes">
                  <Botao variante="secundario" tamanho="m" icone={<MagnifyingGlass size={20} weight="bold" />} onClick={() => setModalCliente(true)}>Trocar cliente</Botao>
                  <Botao variante="secundario" tamanho="m" icone={<UserPlus size={20} weight="bold" />} onClick={() => { tirarCliente(); setModoNovoCli(true) }}>Novo cliente</Botao>
                </div>
              </>
            ) : (
              <div className="nv3-cli-acoes nv3-cli-acoes--so">
                <Botao variante="secundario" tamanho="m" icone={<MagnifyingGlass size={20} weight="bold" />} onClick={() => setModalCliente(true)}>Escolher cliente</Botao>
                <Botao variante="secundario" tamanho="m" icone={<UserPlus size={20} weight="bold" />} onClick={() => { setModoNovoCli(true); setClienteId(null); setClienteNome(''); setClienteTelefone('') }}>Novo cliente</Botao>
              </div>
            )}
          </section>
          <p className="nv3-dica nv3-centro">O cliente é opcional. Sem ele, a venda fica como "Venda avulsa".</p>
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
            {tipo === 'encomenda' && (
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
          {tipo === 'encomenda' && !dataEntrega && <p className={`nv3-dica nv3-centro${tentou ? ' nv3-falta' : ''}`}>Escolha a data pra continuar.</p>}
          {ehEntrega && !enderecoRua.trim() && <p className={`nv3-dica nv3-centro${tentou ? ' nv3-falta' : ''}`}>Escreva a rua pra continuar.</p>}
        </>
      )}

      {/* ═══ PASSO 4: pagamento ═══ */}
      {etapaLabelAtual === 'Pagamento' && (
        <>
          <section className="nv3-card">
            <Titulo>Como ele pagou?</Titulo>
            <div className="nv3-formas" role="group" aria-label="Forma de pagamento">
              {([['PIX', 'Pix', QrCode], ['Dinheiro', 'Dinheiro', Money], ['Crédito', 'Crédito', CreditCard], ['Débito', 'Débito', Bank]] as const).map(([chave, nome, Icone]) => (
                <button key={chave} type="button" aria-pressed={formaPagamento === chave} onClick={() => setFormaPagamento(chave)}>
                  <Icone size={24} weight={formaPagamento === chave ? 'fill' : 'bold'} />{nome}
                </button>
              ))}
            </div>
          </section>

          <section className="nv3-card">
            <Titulo>Quanto já entrou?</Titulo>
            <div role="radiogroup" aria-label="Quanto já entrou">
              {([
                { chave: 'total', nome: 'Tudo agora', dica: `Recebi ${rs(total)}` },
                { chave: 'parcial', nome: 'Só uma parte (sinal)', dica: 'Você escreve quanto recebeu' },
                ...(tipo === 'encomenda' ? [{ chave: 'na_entrega', nome: ehEntrega ? 'Paga na entrega' : 'Paga na retirada', dica: ehEntrega ? 'Ele paga quando receber o pedido' : 'Ele paga quando vier buscar' }] : []),
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
                        rotulo="Quanto ele já pagou" prefixo="R$" inputMode="numeric" placeholder="0,00" autoFocus
                        value={formatMaskMoney(valorParcial)} onChange={e => setValorParcial(parseMaskMoney(e.target.value))}
                        erro={valorParcial > 0 && valorParcial >= total ? `Precisa ser menos que ${rs(total)}. Se ele pagou tudo, escolha "Tudo agora".` : undefined}
                        dica={valorParcial > 0 && valorParcial < total ? `Falta ${rs(total - valorParcial)}` : undefined}
                      />
                    </div>
                  )}
                  {o.chave === 'fiado' && situacaoPag === 'fiado' && (
                    <div className="nv3-op-mais ui-campo">
                      <span className="ui-campo-r"><span>Combinado pra pagar em</span><small>opcional</small></span>
                      <button type="button" className="ui-campo-c nv3-abre" onClick={() => setCalNv('pagamento')}>
                        <span className="ui-campo-ic" aria-hidden="true"><CalendarBlank size={20} weight="bold" /></span>
                        <span className={dataPrevistaPagamento ? '' : 'nv3-ph'}>{dataPrevistaPagamento ? dataDoCampo(dataPrevistaPagamento) : 'Escolher'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!situacaoPag && <p className={`nv3-dica${tentou ? ' nv3-falta' : ''}`}>Escolha quanto já entrou pra continuar.</p>}
          </section>

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
              {COMECOS.map(c => <button key={c.chave} type="button" aria-pressed={statusPedido === c.chave} onClick={() => setStatusPedido(c.chave)}>{c.nome}</button>)}
            </div>
            <p className="nv3-dica"><b>{comeco.nome}:</b> {comeco.dica}</p>
          </section>

          <section className="nv3-card">
            <Titulo acao={<Botao variante="link" onClick={() => setEtapa(1)}>Editar</Botao>}>Resumo</Titulo>
            <div className="nv3-res">
              <Linha rotulo="Tipo">{tipo === 'pronta_entrega' ? 'Pronta entrega' : 'Encomenda'}</Linha>
              <Linha rotulo="Cliente">{nomeDaCliente}</Linha>
              {clienteTelefone && !semCliente && <Linha rotulo="Telefone">{telefoneBonito(clienteTelefone)}</Linha>}
              {tipo === 'encomenda'
                ? <Linha rotulo={ehEntrega ? 'Entrega' : 'Retirada'}>{dataLonga(dataEntrega, horarioEntrega)}</Linha>
                : <Linha rotulo="Como chega">{ehEntrega ? 'Entrega' : 'Retirada'}</Linha>}
              {ehEntrega && enderecoTexto && <Linha rotulo="Endereço">{enderecoTexto}</Linha>}
              <Linha rotulo="Pagamento" tom={situacaoPag === 'total' ? 'verde' : 'laranja'}>{textoPagamento}</Linha>
            </div>
            <div className="nv3-contas">
              {itens.map((it, idx) => (
                <div key={idx}>
                  <p><span>{itemComQtd(`${nomeDeProduto(it.nome_produto)}${it.opcaoLabel ? ` · ${it.opcaoLabel}` : ''}`, it.quantidade, it.forma_venda)}</span><span>{rs(it.valor_unitario * it.quantidade)}</span></p>
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

    {/* Rodapé fixo: total sempre à vista + Voltar e Continuar */}
    <div className="nv3-pe">
      <div className="nv3-pe-in">
        <p className="nv3-pe-tot"><span>Total</span><b>{rs(total)}</b></p>
        <div className="nv3-pe-bts">
          <Botao variante="secundario" onClick={voltarEtapa} disabled={salvando}>{etapa === 1 ? 'Cancelar' : 'Voltar'}</Botao>
          {isUltima
            ? <Botao onClick={finalizarVenda} carregando={salvando}>Registrar venda</Botao>
            : <Botao onClick={proximaEtapa}>Continuar</Botao>}
        </div>
      </div>
    </div>

    {/* ═══ Escolher o tamanho ou o kit ═══ */}
    <Janela aberta={!!escolhaProduto} aoFechar={() => setEscolhaProduto(null)} tipo="conteudo" titulo={escolhaProduto ? nomeDeProduto(escolhaProduto.p.nome) : ''}>
      {escolhaProduto && (
        <>
          <p className="tpj-txt">{escolhaProduto.p.kit_qtd?.ativo ? 'Qual kit o cliente levou?' : 'Qual tamanho?'}</p>
          <div className="tpj-lista">
            {escolhaProduto.opcoes.map(o => (
              <button type="button" key={o.label} className="tpj-it" onClick={() => addProduto(escolhaProduto.p, o)}>
                <span className="tpj-tx"><b>{o.label}</b>{o.pers?.tamanho?.peso_kg && o.pers.tamanho.peso_kg + '' !== o.label ? <small>{String(o.pers.tamanho.peso_kg).replace('.', ',')} kg</small> : null}</span>
                <span className="tpj-preco">{rs(o.valor)}</span>
              </button>
            ))}
          </div>
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
                  <span className="tpj-preco">{rs(p.preco_normal)}</span>
                </button>
              )
            })}
            {lista.length === 0 && <p className="tpj-vz">Nenhum produto{q ? ` com “${buscaProduto.trim()}”` : ' nessa categoria'}.</p>}
          </div>
        </Janela>
      )
    })()}

    {/* ═══ Escolher cliente (janela padrão) ═══ */}
    {(() => {
      const q = buscaCliente.trim().toLowerCase()
      const lista = clientes.filter(c => (c.nome || '').toLowerCase().includes(q) || (c.telefone || '').includes(buscaCliente.trim()))
      return (
        <Janela aberta={modalCliente} aoFechar={() => setModalCliente(false)} tipo="conteudo" titulo="Escolher cliente">
          <div className="ui-campo-c tpj-busca">
            <span className="ui-campo-ic" aria-hidden="true"><MagnifyingGlass size={20} weight="bold" /></span>
            <input type="search" inputMode="search" autoComplete="off" aria-label="Buscar cliente por nome ou telefone" placeholder="Nome ou telefone" value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} />
          </div>
          <div className="tpj-lista">
            {lista.map(c => (
              <button key={c.id} type="button" className="tpj-it" onClick={() => selecionarCliente(c)}>
                <span className="tpj-ini" aria-hidden="true">{initialsOf(c.nome || '?')}</span>
                <span className="tpj-tx"><b>{toTitleCase(c.nome || 'Sem nome')}</b>{(c.telefone || c.whatsapp) && <small>{telefoneBonito(c.telefone || c.whatsapp || '')}</small>}</span>
              </button>
            ))}
            {clientes.length === 0 && <p className="tpj-vz">Nenhum cliente cadastrado ainda.</p>}
            {clientes.length > 0 && lista.length === 0 && <p className="tpj-vz">Nenhum cliente com “{buscaCliente.trim()}”.</p>}
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

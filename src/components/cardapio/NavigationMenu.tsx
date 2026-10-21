import { NeveNatal, temaNatalLigado } from '@/components/tema/Natal'
import { useState, useEffect, useMemo, useRef } from 'react'
import { montarMensagem as montarMensagemModelo } from '@/lib/mensagens'
import { CalendarioSheet, HorariosSheet } from '@/components/cardapio/AgendaSheets'
import { antecedenciaHoras, calcularRegras, deIso, horarioPermitido, primeiraData, rotuloData } from '@/lib/agendaCardapio'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, CalendarBlank, CaretRight, Check, ChatCircleDots, Clock, CreditCard, Money, PixLogo, Plus, ClipboardText, House, ShoppingBag as Sacola, Storefront, Tag, Truck, User, X } from '@phosphor-icons/react'
import IconeWhatsApp from '@/components/IconeWhatsApp'
import { useCart } from '@/hooks/useCart'
import { CartItemComponent, unidadeItem } from '@/components/cart/CartItemComponent'
import { formatCurrency } from '@/utils/helpers'
import { useDeviceDetection } from '@/hooks/useDeviceDetection'
import { PerfilTab } from './PerfilTab'
import { PedidosTab } from './PedidosTab'
import { itemDoCarrinhoParaPedido } from '@/lib/itemDoCarrinho'
import { contarItens, detalhesItem, qtdItem, semMeioEmoji, valorLinha } from '@/lib/itemSacola'
import { r2, somarReais } from '@/lib/moeda'
import { Campo, CampoArea, avisar } from '@/components/base'
import { esquecerCupomEscolhido, lerCupomEscolhido } from '@/lib/cupons'
import { useSobreposicao } from '@/components/base/useSobreposicao'
import { explicarErro } from '@/lib/erros'
import { linkWhatsApp } from '@/lib/telefone'
import { lojaAtualCheckout, lojaAtualId, lojaAtualNome, lojaAtualWhatsApp } from './lojaAtual'
import { digitosAoDigitar } from './telefoneDigitado'
import { ProductModal } from '@/components/cart/ProductModal'
import { precoDoCartao } from './ItensCardapio'
import { SeloVerificado } from './SeloVerificado'
import type { Produto } from '@/types/database'
import { corClara } from '@/lib/coresCardapio'
import { pixelEvento } from '@/lib/facebookPixel'
import '@/components/cart/sacola.css'

/**
 * Pedido em envio (10/10). Fica fora do componente pra valer mesmo se a sacola fechar e abrir:
 * se a tentativa falha no meio, a próxima (com os mesmos dados) usa o MESMO id, e a loja não recebe pedido repetido nem pela metade.
 */
type TentativaPedido = { id: string; assinatura: string; gravado: boolean; quando: number }
// (17/10 · R08) a tentativa também fica guardada no aparelho: recarregou a página ou fechou e abriu o cardápio
// no meio do envio, o próximo envio com os mesmos dados usa o MESMO id (antes gerava outro e a loja recebia 2 pedidos)
const CHAVE_TENTATIVA = 'doonly:tentativaPedido'
const lerTentativaSalva = (): TentativaPedido | null => {
  try { const t = JSON.parse(localStorage.getItem(CHAVE_TENTATIVA) || 'null'); return t && typeof t.id === 'string' && typeof t.assinatura === 'string' ? t : null } catch { return null }
}
const salvarTentativa = (t: TentativaPedido | null) => {
  try { if (t) localStorage.setItem(CHAVE_TENTATIVA, JSON.stringify(t)); else localStorage.removeItem(CHAVE_TENTATIVA) } catch { /* sem armazenamento: fica só na memória */ }
}
let tentativaPedido: TentativaPedido | null = lerTentativaSalva()
/** Envio em andamento: fica fora do componente porque a sacola pode fechar e abrir no meio (a trava do componente zerava). */
let enviandoPedido = false

const novoIdPedido = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16) })

/** Tira um pedido que ficou sem os itens. Só diz "sim" quando o banco confirma que apagou. */
async function desfazerPedido(id: string): Promise<boolean> {
  try {
    const { error, count } = await supabase.from('pedidos').delete({ count: 'exact' }).eq('id', id)
    return !error && count === 1
  } catch { return false }
}

/** A tentativa pra esses dados: a mesma de antes (mesmo id) ou uma nova. */
async function abrirTentativa(assinatura: string): Promise<TentativaPedido> {
  const t = tentativaPedido
  if (t && t.assinatura === assinatura && Date.now() - t.quando <= 15 * 60_000) return t
  // Os dados mudaram (ou passou muito tempo) depois de uma tentativa que ficou pela metade: tira a antiga, se o banco deixar
  if (t?.gravado) await desfazerPedido(t.id)
  tentativaPedido = { id: novoIdPedido(), assinatura, gravado: false, quando: Date.now() }
  salvarTentativa(tentativaPedido)
  return tentativaPedido
}
const marcarGravada = (t: TentativaPedido) => { t.gravado = true; if (t === tentativaPedido) salvarTentativa(t) }
const fecharTentativa = () => { tentativaPedido = null; salvarTentativa(null) }

interface CheckoutConfig {
  /** (4.27) a loja pausou os pedidos: dá pra montar a sacola, mas não enviar */
  loja_pausada?: boolean
  /** texto da loja pra mensagem do pedido (Mensagens do WhatsApp) */
  msg_pedido?: string | null
  formas_pagamento: string[]
  formas_entrega: string[]
  valor_entrega_propria: number
  entrega_por_bairro: { bairro: string; valor: number }[]
  endereco_retirada: string
  horario_retirada: string
  exibir_campo_troco: boolean
  cupons_desconto: { codigo: string; tipo: string; valor: number; ativo: boolean }[]
  tem_cupom?: boolean
  aceita_agendamento: boolean
  prazo_minimo_horas: number
  /** Finalizar encomenda (02/10) */
  horario?: any
  antecedencias?: Record<string, { ant?: string | null; pronta?: boolean | null }>
}

const DEFAULT_CONFIG: CheckoutConfig = {
  formas_pagamento: ['pix', 'dinheiro', 'credito', 'debito'],
  formas_entrega: ['retirada', 'entrega_propria'],
  valor_entrega_propria: 0,
  entrega_por_bairro: [],
  endereco_retirada: '',
  horario_retirada: '',
  exibir_campo_troco: true,
  cupons_desconto: [],
  aceita_agendamento: true,
  prazo_minimo_horas: 24,
}

const LABEL_ENTREGA: Record<string, { label: string }> = {
  retirada:         { label: 'Retirar no local' },
  entrega_propria:  { label: 'Entrega própria' },
  motoboy:          { label: 'Motoboy' },
  uber_flash:       { label: 'Uber Flash' },
  combinar:         { label: 'Combinar pelo WhatsApp' },
}

const LABEL_PAGAMENTO: Record<string, { label: string }> = {
  pix:              { label: 'Pix' },
  dinheiro:         { label: 'Dinheiro' },
  credito:          { label: 'Cartão de crédito' },
  debito:           { label: 'Cartão de débito' },
  link_pagamento:   { label: 'Link de pagamento' },
  mercado_pago:     { label: 'Mercado Pago' },
  pagamento_retirada: { label: 'Pagamento na retirada' },
}
const ICONE_PAGAMENTO: Record<string, any> = { pix: PixLogo, dinheiro: Money, credito: CreditCard, debito: CreditCard }

/** "Sáb, 11 de out" */
function dataCurta(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  if (isNaN(d.getTime())) return iso
  const s = d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Faixa cinza de cada parte do finalizar (igual ao produto aberto da 8.2) */
function Cab({ t, sub, obr, opc, ok, falta, pendente }: { t: string; sub?: string; obr?: boolean; opc?: boolean; ok?: boolean; falta?: string; pendente?: string }) {
  // pendente: já começou mas falta algo ("Falta o endereço") — no lugar de "Obrigatório"
  return (
    <header className={`sc-g-cab${falta ? ' falta' : ''}`}>
      <span><b>{t}</b>{(falta || sub) && <small>{falta || sub}</small>}</span>
      {obr && (ok && !falta ? <i className="sc-ok" aria-label="Pronto"><Check size={14} weight="bold" /></i> : <i className="sc-obr">{pendente || 'Obrigatório'}</i>)}
      {opc && <i className="sc-obr sc-opc">Opcional</i>}
    </header>
  )
}

/** (19/10) "Peça também" na sacola: foto, nome e preço; tocar abre o produto (escolher tamanho etc.) */
function SugestaoSacola({ produto, cor }: { produto: Produto; cor: string }) {
  const [aberto, setAberto] = useState(false)
  const foto = produto.imagem_url?.split(',')[0]?.trim()
  const { final, aPartir } = precoDoCartao(produto)
  return (
    <>
      <button type="button" className="sc-sug-it" onClick={() => setAberto(true)} aria-label={`Ver ${produto.nome}`}>
        <span className="sc-sug-ft">{foto ? <img src={foto} alt="" loading="lazy" /> : null}<i style={{ background: cor }}><Plus size={14} weight="bold" /></i></span>
        <b>{produto.nome}</b>
        {/* (20/10) "a partir de" numa linha própria, acima do preço (antes encostava no cartão do lado) */}
        <small>{aPartir ? 'a partir de' : '\u00a0'}</small>
        <strong>{formatCurrency(final)}</strong>
      </button>
      <ProductModal isOpen={aberto} onClose={() => setAberto(false)} product={produto} corBotao={cor} />
    </>
  )
}

/* ─── Conteúdo interno do carrinho (reutilizado em mobile e desktop) ─── */
function CartContent({
  step, setStep, items, totalPrice, updateQuantity, updateObservations, removeItem, clearCart,
  config, onClose, corBotao, corTopo, logoUrl, sugestoes = [], verificada = false, direto = false,
}: any) {
  const [limparPergunta, setLimparPergunta] = useState(false)
  const [dataEntrega, setDataEntrega] = useState('')
  const [horaEntrega, setHoraEntrega] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [cupomDigitado, setCupomDigitado] = useState('')
  const [cupomAplicado, setCupomAplicado] = useState<{ codigo: string; tipo: string; valor: number } | null>(null)
  const [cupomErro, setCupomErro] = useState('')
  const [formaEntrega, setFormaEntrega] = useState('')
  const [bairroSelecionado, setBairroSelecionado] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [trocoParaStr, setTrocoParaStr] = useState('')
  const [cep, setCep] = useState('')
  const [rua, setRua] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [cepLoading, setCepLoading] = useState(false)
  const [pedidoConfirmado, setPedidoConfirmado] = useState<{numero: number; itens: any[]; whatsapp: string; storeName: string; total: number; quando: string} | null>(null)
  // 08/10 · 3.30: cupom abre na sacola, endereço salvo já vem marcado, botão treme quando falta algo
  const [cupomAberto, setCupomAberto] = useState(false)
  const [endNovo, setEndNovo] = useState(false)
  const [treme, setTreme] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [cepErro, setCepErro] = useState('')
  const [cepAviso, setCepAviso] = useState('')

  // ═══ Finalizar encomenda (02/10): tudo numa tela só ═══
  const [feErro, setFeErro] = useState<'' | 'agenda' | 'endereco' | 'pagamento' | 'dados'>('')
  const [calAberto, setCalAberto] = useState(false)
  const [horaAberta, setHoraAberta] = useState(false)
  const refAgenda = useRef<HTMLDivElement>(null), refEndereco = useRef<HTMLDivElement>(null)
  const refPagamento = useRef<HTMLDivElement>(null), refDados = useRef<HTMLDivElement>(null)
  const opsEntrega = useMemo(() => {
    const f: string[] = config.formas_entrega || ['retirada']
    return { ret: f.includes('retirada'), ent: ['entrega_propria', 'motoboy', 'uber_flash', 'combinar'].find(k => f.includes(k)) || '' }
  }, [config.formas_entrega])
  const metodosPag = useMemo(() => {
    const m = (config.formas_pagamento || []).filter((k: string) => ['pix', 'dinheiro', 'credito', 'debito'].includes(k))
    return m.length ? m : ['pix']
  }, [config.formas_pagamento])
  const horasAnt = useMemo(() => antecedenciaHoras(items.map((i: any) => i.id), config.antecedencias, config.prazo_minimo_horas, config.aceita_agendamento !== false),
    [items, config.antecedencias, config.prazo_minimo_horas, config.aceita_agendamento])
  // (11/10) as regras eram calculadas uma vez só, com a hora de quando o finalizar abriu.
  // Agora o relógio é lido de novo ao abrir a data ou o horário (e mais uma vez na hora de enviar).
  const [relogio, setRelogio] = useState(0)
  const acertarRelogio = () => setRelogio(Date.now())
  const regras = useMemo(() => calcularRegras(new Date(), config.horario, horasAnt), [config.horario, horasAnt, step, relogio])
  const primeiraDisp = useMemo(() => primeiraData(config.horario, regras.minimo), [config.horario, regras])
  const ehEntrega = !!formaEntrega && formaEntrega !== 'retirada'
  useEffect(() => {
    if (step !== 'finalizar') return
    if (!formaEntrega) setFormaEntrega(opsEntrega.ret ? 'retirada' : (opsEntrega.ent || 'retirada'))
    // Pronta entrega com a loja aberta: já vem marcado hoje, no próximo horário (ela pode trocar)
    if (!dataEntrega && regras.sugestao) { setDataEntrega(regras.sugestao.data); setHoraEntrega(regras.sugestao.hora) }
    if (!formaPagamento && metodosPag.length === 1) setFormaPagamento(metodosPag[0])
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps
  const irPara = (r: any) => setTimeout(() => r.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  // 10/10: trava também por ref (dois toques seguidos não mandam dois pedidos)
  const enviandoRef = useRef(false)
  const enviarFinalizar = async () => {
    if (enviando || enviandoRef.current || enviandoPedido) return
    if (config.loja_pausada) { avisar('A loja pausou os pedidos por enquanto. Chame no WhatsApp pra combinar.', { tipo: 'erro' }); return }
    let falta: typeof feErro = ''
    // (11/10) confere a data e a hora com o relógio de AGORA (a tela pode ter ficado aberta um tempão):
    // precisa estar dentro do expediente e respeitar a antecedência a partir deste momento
    let horarioVenceu = ''
    if (dataEntrega && horaEntrega) {
      const agora = new Date()
      if (!horarioPermitido(dataEntrega, horaEntrega, config.horario, calcularRegras(new Date(agora.getTime() - 15 * 60_000), config.horario, horasAnt).minimo)) { // 15 min de folga: o horário que a tela ofereceu há pouco continua valendo
        const [h, m] = horaEntrega.split(':').map(Number)
        const escolhido = deIso(dataEntrega); escolhido.setHours(h || 0, m || 0, 0, 0)
        horarioVenceu = escolhido < agora ? 'Esse horário já passou. Escolha outro.' : 'Esse horário não está mais livre. Escolha outro.'
      }
    }
    if (!dataEntrega || !horaEntrega || horarioVenceu) falta = 'agenda'
    else if (ehEntrega && formaEntrega !== 'combinar' && (!rua.trim() || !numero.trim() || (config.entrega_por_bairro.length > 0 && !bairroSelecionado))) falta = 'endereco'
    else if (!formaPagamento) falta = 'pagamento'
    else if (!nome.trim() || telefone.replace(/\D/g, '').length < 10) falta = 'dados'
    setFeErro(falta)
    if (horarioVenceu) {
      setDataEntrega(''); setHoraEntrega(''); acertarRelogio()
      avisar(horarioVenceu, { tipo: 'erro' })
    }
    if (falta) {
      irPara({ agenda: refAgenda, endereco: refEndereco, pagamento: refPagamento, dados: refDados }[falta])
      setTreme(true); setTimeout(() => setTreme(false), 400)
      return
    }
    enviandoRef.current = true; enviandoPedido = true
    setEnviando(true)
    try { await enviarPedido() } finally { enviandoRef.current = false; enviandoPedido = false; setEnviando(false) }
  }

  // Toca som de sucesso quando o pedido é confirmado
  useEffect(() => {
    if (pedidoConfirmado) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const tocarNota = (freq: number, inicio: number, duracao: number) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.type = 'sine'
          osc.frequency.value = freq
          gain.gain.setValueAtTime(0, ctx.currentTime + inicio)
          gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + inicio + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + duracao)
          osc.start(ctx.currentTime + inicio)
          osc.stop(ctx.currentTime + inicio + duracao)
        }
        tocarNota(880, 0, 0.15)
        tocarNota(1175, 0.12, 0.25)
      } catch {}
    }
  }, [pedidoConfirmado])

  // Pegar dados do cliente logado
  const clienteLogado = (() => {
    try {
      const uid = lojaAtualId()
      const saved = localStorage.getItem(`cardapio_cliente_${uid}`)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })()
  const [nome, setNome] = useState(clienteLogado?.nome || '')
  const [telefone, setTelefone] = useState(clienteLogado?.telefone || '')

  // Endereços que o cliente já usou nesta loja (salvos no aparelho depois de cada pedido com entrega)
  const enderecosSalvos: any[] = useMemo(() => {
    try {
      const uid = lojaAtualId()
      const lista = JSON.parse(localStorage.getItem(`enderecos_${uid}_${telefone.replace(/\D/g, '')}`) || '[]')
      return Array.isArray(lista) ? lista.filter((e: any) => e && e.rua) : []
    } catch { return [] }
  }, [telefone])
  const usarEndereco = (e: any) => {
    setRua(e.rua || ''); setNumero(e.numero || ''); setComplemento(e.complemento || ''); setBairro(e.bairro || ''); setCidade(e.cidade || ''); setCep(e.cep || '')
    setBairroSelecionado(config.entrega_por_bairro.some((b: any) => b.bairro === e.bairro) ? e.bairro : '')
    setEndNovo(false); setFeErro('')
  }
  useEffect(() => {
    if (formaEntrega === 'entrega_propria' && !rua && !endNovo && enderecosSalvos.length) usarEndereco(enderecosSalvos[0])
  }, [formaEntrega]) // eslint-disable-line react-hooks/exhaustive-deps

  const buscarCep = async (v: string) => {
    const c = v.replace(/\D/g,'')
    if (c.length !== 8) return
    setCepLoading(true); setCepErro(''); setCepAviso('')
    // CEP com 8 números nunca fica vermelho: se a busca não acha (ou falha), só avisa pra preencher à mão
    const naoAchou = config.entrega_por_bairro.length > 0
      ? 'Não achamos esse CEP. Preencha a rua abaixo e escolha o bairro.'
      : 'Não achamos esse CEP. Preencha rua e bairro abaixo.'
    try {
      const res = await fetch(`https://viacep.com.br/ws/${c}/json/`)
      const d = await res.json()
      if (d.erro) { setCepAviso(naoAchou) } else {
        setRua(d.logradouro || '')
        setBairro(d.bairro || '')
        setCidade(d.localidade || '')
      }
    } catch { setCepAviso(naoAchou) }
    setCepLoading(false)
  }

  const count = contarItens(items)

  const freteValor = useMemo(() => {
    if (formaEntrega === 'retirada' || formaEntrega === 'combinar') return 0
    if (formaEntrega === 'entrega_propria') {
      if (config.entrega_por_bairro.length > 0 && bairroSelecionado) {
        const b = config.entrega_por_bairro.find((x: any) => x.bairro === bairroSelecionado)
        return b ? b.valor : config.valor_entrega_propria
      }
      return config.valor_entrega_propria
    }
    return 0
  }, [formaEntrega, bairroSelecionado, config])

  // 10/10: o desconto nunca passa do subtotal (percentual vai de 0 a 100) e o total nunca fica negativo
  const desconto = useMemo(() => {
    if (!cupomAplicado) return 0
    const valor = Math.max(0, Number(cupomAplicado.valor) || 0)
    const bruto = cupomAplicado.tipo === 'percentual' ? r2(totalPrice * Math.min(100, valor) / 100) : r2(valor)
    return Math.max(0, Math.min(bruto, totalPrice))
  }, [cupomAplicado, totalPrice])

  // (11/10) uma conta só de centavos (lib/moeda): o subtotal já vem como a soma das linhas arredondadas
  const totalFinal = Math.max(0, somarReais([totalPrice, -desconto, freteValor]))

  const [validandoCupom, setValidandoCupom] = useState(false)
  // Subtotal com que o cupom foi conferido (se a sacola mudar, confere de novo)
  const subtotalDoCupom = useRef(0)
  const aplicarCupom = async (codigo?: string) => {
    setCupomErro('')
    const code = (codigo ?? cupomDigitado).trim().toUpperCase()
    if (!code) return
    const loja = lojaAtualId()
    setValidandoCupom(true)
    try {
      // Validação no banco: ativo, período, valor mínimo e limite de usos
      // (20/10) com o WhatsApp já preenchido, confere também o cupom "só no primeiro pedido"
      const { data, error } = await supabase.rpc('cardapio_validar_cupom', { p_loja: loja, p_codigo: code, p_subtotal: totalPrice, p_telefone: telefone.replace(/\D/g, '') || null })
      const r: any = data
      if (!error && r?.ok) {
        subtotalDoCupom.current = totalPrice
        setCupomAplicado({ codigo: r.codigo, tipo: r.tipo, valor: Number(r.valor) || 0 })
      } else {
        setCupomErro(r?.erro || 'Cupom inválido ou expirado')
        setCupomAplicado(null)
      }
    } catch {
      setCupomErro('Não foi possível validar o cupom. Tente de novo.')
      setCupomAplicado(null)
    }
    setValidandoCupom(false)
  }

  const removerCupom = () => { setCupomAplicado(null); setCupomDigitado(''); setCupomErro(''); esquecerCupomEscolhido() }

  // (20/10) cupom que o cliente tocou no topo do cardápio: já entra aplicado na sacola (1 cupom por pedido)
  useEffect(() => {
    const usarEscolhido = () => {
      const code = lerCupomEscolhido()
      if (!code || !temCupom || items.length === 0 || cupomAplicado?.codigo === code) return
      setCupomDigitado(code); setCupomAberto(true); void aplicarCupom(code)
    }
    usarEscolhido()
    window.addEventListener('doonly:cupom', usarEscolhido)
    return () => window.removeEventListener('doonly:cupom', usarEscolhido)
  }, [items.length > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  // 10/10: a sacola mudou com o cupom aplicado → confere o cupom de novo com o subtotal novo (pedido mínimo etc.).
  // Se a conferência falhar por falta de internet, o cupom fica como está.
  useEffect(() => {
    if (!cupomAplicado || subtotalDoCupom.current === totalPrice) return
    const subtotal = totalPrice
    subtotalDoCupom.current = subtotal
    let valendo = true
    ;(async () => {
      try {
        if (subtotal <= 0) { if (valendo) setCupomAplicado(null); return }
        const { data, error } = await supabase.rpc('cardapio_validar_cupom', { p_loja: lojaAtualId(), p_codigo: cupomAplicado.codigo, p_subtotal: subtotal })
        if (!valendo || error) return
        const r: any = data
        if (r?.ok) setCupomAplicado({ codigo: r.codigo, tipo: r.tipo, valor: Number(r.valor) || 0 })
        else { setCupomAplicado(null); avisar(r?.erro || 'O cupom não vale mais pra essa sacola.', { tipo: 'info' }) }
      } catch { /* sem internet: mantém o cupom */ }
    })()
    return () => { valendo = false }
  }, [totalPrice]) // eslint-disable-line react-hooks/exhaustive-deps

  const enviarPedido = async () => {
    if (!nome.trim() || !telefone.trim()) return avisar('Preencha o seu nome e o WhatsApp', { tipo: 'erro' })
    // (20/10) confere o cupom com o WhatsApp antes de enviar (cupom só pro primeiro pedido); se não valer, avisa e tira
    if (cupomAplicado) {
      try {
        const { data, error } = await supabase.rpc('cardapio_validar_cupom', { p_loja: lojaAtualId(), p_codigo: cupomAplicado.codigo, p_subtotal: totalPrice, p_telefone: telefone.replace(/\D/g, '') })
        const r: any = data
        if (!error && r && !r.ok) { setCupomAplicado(null); esquecerCupomEscolhido(); return avisar(`${r.erro || 'O cupom não vale pra esse pedido'}. Tiramos o cupom: confira o total e envie de novo.`, { tipo: 'erro' }) }
      } catch { /* sem internet: o banco confere ao criar o pedido */ }
    }
    if (!formaEntrega) return avisar('Escolha como vai receber', { tipo: 'erro' })
    if (!formaPagamento) return avisar('Escolha como vai pagar', { tipo: 'erro' })
    // Endereço vai junto em toda entrega com endereço (antes o do motoboy/Uber Flash ficava de fora)
    const temEndereco = ehEntrega && formaEntrega !== 'combinar'

    // 10/10: a loja é a que ESTA aba abriu (não a última gravada no navegador)
    const whatsapp = lojaAtualWhatsApp()
    const storeName = lojaAtualNome() || 'Cardápio'
    const confeteiraUserId = lojaAtualId()

    // ── Mensagem do WhatsApp (montada depois de salvar, pra levar o nº do pedido) ──
    const montarMensagem = (numPedido: number) => {
      const diaSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
      let quando = ''
      if (dataEntrega) {
        const d = new Date(dataEntrega + 'T12:00:00')
        if (!isNaN(d.getTime())) quando = `${diaSemana[d.getDay()]}, ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
      }
      if (horaEntrega) quando += quando ? ` às ${horaEntrega}` : `às ${horaEntrega}`

      // 09/10 (3.59): a abertura vem do texto da loja (Mensagens do WhatsApp); aqui só o bloco do pedido
      let m = ''
      if (numPedido) m += `*PEDIDO #${numPedido}*\n\n`

      items.forEach((item: any) => {
        const qtd = qtdItem(item) // bolo por kg COM tamanho é "1×", não "1 kg"
        m += `*${qtd} ${item.name}* — ${formatCurrency(valorLinha(item))}\n`
        const detalhes: string[] = []
        const e = item.escolhas
        if (e) {
          if (e.tamanho?.nome) {
            // Não repete o peso quando o nome já é o peso ("2 kg" em vez de "2 kg (~2 kg)")
            const pesoTxt = e.tamanho.peso_kg ? `${String(e.tamanho.peso_kg).replace('.', ',')} kg` : ''
            const nomeTemPeso = pesoTxt && e.tamanho.nome.replace(/\s/g, '').toLowerCase() === pesoTxt.replace(/\s/g, '').toLowerCase()
            detalhes.push(`Tamanho ${e.tamanho.nome}${pesoTxt && !nomeTemPeso ? ` (~${pesoTxt})` : ''}`)
          }
          if (e.sabor?.nome) detalhes.push(`Sabor ${e.sabor.nome}`)
          if (e.massa?.nome) detalhes.push(`Massa ${e.massa.nome}`)
          if (e.recheios?.length) {
            const nomes = e.recheios.map((r: any) => r.nome)
            const lista = nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : nomes[0]
            detalhes.push(`Recheio${nomes.length > 1 ? 's' : ''}: ${lista}`)
          }
          if (e.cobertura?.nome) detalhes.push(`Cobertura ${e.cobertura.nome}`)
          if (e.kit?.sabores?.length) detalhes.push(`Kit ${e.kit.total} un: ${e.kit.sabores.map((s: any) => `${s.nome} × ${s.qtd}`).join(', ')}`)
        } else {
          if (item.selectedMassa) detalhes.push(`Massa ${item.selectedMassa}`)
          if (item.selectedRecheio) detalhes.push(`Recheio: ${item.selectedRecheio}`)
          if (item.selectedCobertura) detalhes.push(`Cobertura ${item.selectedCobertura}`)
        }
        if (detalhes.length) m += `_${detalhes.join(' · ')}_\n`
        // Adicionais cadastrados pela confeiteira (topo de bolo, vela...)
        if (Array.isArray(item.extrasBiblioteca) && item.extrasBiblioteca.length) {
          m += `Adicionais: ${item.extrasBiblioteca.map((x: any) => x.valor > 0 ? `${x.nome} (+${formatCurrency(x.valor)})` : x.nome).join(', ')}\n`
        }
        if (item.observations) m += `Obs.: ${item.observations}\n`
        // 10/10: a foto vai gravada no pedido; na mensagem só entra se for um link (nunca a imagem em texto)
        if (item.fotoReferencia) m += /^https?:\/\//i.test(String(item.fotoReferencia)) ? `Foto de referência: ${item.fotoReferencia}\n` : `Foto de referência: enviada no pedido\n`
        m += `\n`
      })

      m += `Subtotal: ${formatCurrency(totalPrice)}\n`
      if (freteValor > 0) m += `Entrega: ${formatCurrency(freteValor)}\n`
      if (desconto > 0) m += `${cupomAplicado ? `Cupom ${cupomAplicado.codigo}` : 'Desconto'}: − ${formatCurrency(desconto)}\n`
      m += `*Total: ${formatCurrency(totalFinal)}*\n\n`

      const pgtoLabel = LABEL_PAGAMENTO[formaPagamento]?.label || formaPagamento
      m += `*Pagamento:* ${pgtoLabel}`
      if (formaPagamento === 'dinheiro' && trocoParaStr) m += ` (troco pra R$ ${trocoParaStr})`
      m += `\n\n`

      if (formaEntrega === 'retirada') {
        m += `*Retirada:* ${quando || 'a combinar'}\n`
      } else if (formaEntrega === 'entrega_propria') {
        m += `*Entrega:* ${quando || 'a combinar'}\n`
        if (rua) m += `${rua}${numero ? ', ' + numero : ''}${complemento ? ' · ' + complemento : ''}\n`
        if (bairro || cidade || cep) m += `${[bairro, cidade].filter(Boolean).join(', ')}${cep ? ` · CEP ${cep}` : ''}\n`
      } else {
        m += `*Entrega:* ${LABEL_ENTREGA[formaEntrega]?.label || formaEntrega}${quando ? ` · ${quando}` : ''}\n`
        if (temEndereco && rua) m += `${rua}${numero ? ', ' + numero : ''}${complemento ? ' · ' + complemento : ''}${bairro ? ' · ' + bairro : ''}\n`
      }

      if (observacoes.trim()) m += `\n*Observação:* ${observacoes.trim()}\n`
      m += `\n*Cliente:* ${nome.trim()} · ${telefone.trim()}`
      return montarMensagemModelo('pedido_cardapio', { pedido: m, loja: storeName, nome: nome.trim().split(' ')[0], numero: numPedido || '' }, config.msg_pedido ?? null)
    }

    // ── Salva pedido no Supabase e vincula cliente ──
    // 10/10: se o pedido (ou os itens) não gravar, a sacola NÃO é limpa e a tela de "Pedido enviado" não aparece:
    // avisa e a cliente tenta de novo. Antes o erro ia só pro console e o pedido aparecia como enviado.
    const falhou = (err: unknown) => {
      // (4.24) recusas do banco com motivo: explica em vez do "tente de novo" genérico
      const msg = String((err as { message?: unknown } | null)?.message ?? '')
      if (/loja_pausada/.test(msg)) return avisar('A loja pausou os pedidos agora há pouco. Chame no WhatsApp pra combinar.', { tipo: 'erro' })
      if (/cupom_esgotado/.test(msg)) return avisar('Este cupom acabou de esgotar. Tire o cupom e envie de novo.', { tipo: 'erro' })
      // (17/10) o servidor confere a data e a forma de entrega
      if (/data_invalida/.test(msg)) return avisar('A data escolhida já passou. Escolha outra data e envie de novo.', { tipo: 'erro' })
      if (/entrega_invalida/.test(msg)) return avisar('A forma de entrega mudou na loja. Escolha de novo como receber e envie.', { tipo: 'erro' })
      if (/item_invalido/.test(msg)) return avisar('Um produto da sacola mudou ou saiu do cardápio. Confira a sacola e envie de novo.', { tipo: 'erro' })
      avisar(explicarErro(err, 'Não deu pra enviar o pedido. Tente de novo.'), { tipo: 'erro' })
    }
    if (!confeteiraUserId) return falhou(null)
    if (items.length === 0) return avisar('Sua sacola está vazia', { tipo: 'erro' })
    let numeroPedido = 0
    try {
      let clienteId: string | null = null
      // Função segura no banco: acha o cliente pelo telefone ou cria (sem ler a tabela direto)
      const { data: listaCliente } = await supabase.rpc('cardapio_cliente', {
        p_loja: confeteiraUserId, p_telefone: telefone.trim(), p_nome: nome.trim(),
      })
      if (Array.isArray(listaCliente) && listaCliente[0]) clienteId = listaCliente[0].id

      const dadosPedido = {
        user_id: confeteiraUserId, cliente_id: clienteId,
        cliente_nome: nome.trim(), cliente_telefone: telefone.trim(), cliente_whatsapp: telefone.trim(),
        status: 'novo', origem: 'cardapio', prioridade: 'media',
        data_entrega: dataEntrega || null, horario_entrega: horaEntrega || null,
        tipo_entrega: formaEntrega === 'retirada' ? 'retirada' : 'entrega',
        taxa_entrega: freteValor,
        endereco_rua: temEndereco ? rua : null,
        endereco_numero: temEndereco ? numero : null,
        endereco_complemento: temEndereco ? complemento : null,
        endereco_bairro: temEndereco ? bairro : null,
        endereco_cidade: temEndereco ? cidade : null,
        endereco_cep: temEndereco ? cep.replace(/\D/g,'') : null,
        forma_pagamento: formaPagamento, status_pagamento: 'pendente',
        valor_produtos: totalPrice, cupom_codigo: cupomAplicado?.codigo || null,
        cupom_desconto: desconto || 0, desconto: desconto || 0,
        valor_total: totalFinal, observacoes: observacoes || null,
      }

      // O id é gerado aqui, então o pedido é gravado sem precisar ler a tabela de volta.
      // Tentando de novo com os mesmos dados, o id é o mesmo (não cria outro pedido na loja).
      const tentativa = await abrirTentativa(JSON.stringify(dadosPedido))
      const novoPedidoId = tentativa.id

      const itensDoPedido = items.map((item: any) => ({
        // Tudo o que o cliente escolheu vai pro pedido (regra única em lib/itemDoCarrinho)
        pedido_id: novoPedidoId, user_id: confeteiraUserId, desconto: 0,
        ...itemDoCarrinhoParaPedido(item),
      }))

      // (4.22) O banco cria o pedido e os itens de uma vez (função cardapio_criar_pedido): confere a loja e os produtos,
      // refaz a soma, o cupom e o total, e não duplica numa nova tentativa. Sem a função no banco, grava como antes.
      const viaBanco = await supabase.rpc('cardapio_criar_pedido', {
        p_loja: confeteiraUserId, p_pedido: { id: novoPedidoId, ...dadosPedido, forma_entrega: formaEntrega, bairro_taxa: bairroSelecionado || null }, p_itens: itensDoPedido,
      })
      const semFuncao = !!viaBanco.error && (viaBanco.error.code === 'PGRST202' || viaBanco.error.code === '42883' || /could not find the function/i.test(String(viaBanco.error.message || '')))
      if (viaBanco.error && !semFuncao) return falhou(viaBanco.error)

      if (semFuncao) {
        if (!tentativa.gravado) {
          const { error: erroPedido } = await supabase.from('pedidos').insert({ id: novoPedidoId, ...dadosPedido })
          // "Esse id já existe" numa nova tentativa: o pedido tinha gravado e só a resposta se perdeu no caminho
          const jaGravado = !!erroPedido && (erroPedido as any).code === '23505' && /pkey/i.test(String(erroPedido.message || ''))
          if (erroPedido && !jaGravado) return falhou(erroPedido)
          marcarGravada(tentativa)
        }

        const { error: erroItens } = await supabase.from('pedido_itens').insert(itensDoPedido)
        if (erroItens) {
          // Pedido sem itens não vale: tenta desfazer. Se o banco não deixar apagar, a próxima tentativa completa esse mesmo pedido.
          // (23503 no pedido_id = o pedido não existe mais no banco: começa do zero na próxima. 23503 em outra coluna,
          //  como um produto que a loja apagou, não: aí a tentativa continua a mesma e não cria pedido repetido)
          const pedidoSumiu = (erroItens as any).code === '23503' && /pedido_id|pedidos/i.test(`${erroItens.message || ''} ${(erroItens as any).details || ''}`)
          if (await desfazerPedido(novoPedidoId) || pedidoSumiu) fecharTentativa()
          return falhou(erroItens)
        }
      }
      fecharTentativa()

      // Daqui pra baixo o pedido já está gravado: nada disso impede o "Pedido enviado"
      try {
        // Loga o cliente automaticamente após o pedido (se ainda não estiver logado)
        // (4.23) o banco devolve um código de acesso: com ele o cliente vê os próprios pedidos na aba Pedidos
        const acesso: string | undefined = (viaBanco.data as any)?.acesso || undefined
        const salvo = (() => { try { return JSON.parse(localStorage.getItem(`cardapio_cliente_${confeteiraUserId}`) || 'null') } catch { return null } })()
        const mesmoTel = salvo && String(salvo.telefone || '').replace(/\D/g, '').slice(-11) === telefone.replace(/\D/g, '').slice(-11)
        if (clienteId && (!salvo || (mesmoTel && acesso))) {
          localStorage.setItem(`cardapio_cliente_${confeteiraUserId}`, JSON.stringify({
            id: clienteId, nome: nome.trim(), telefone: telefone.trim(), ...(acesso ? { token: acesso } : {}),
          }))
        }
        // Entrega: guarda o endereço em "Dados pessoais" pra próxima compra (sem repetir)
        if (formaEntrega === 'entrega_propria' && rua.trim()) {
          const chave = `enderecos_${confeteiraUserId}_${telefone.replace(/\D/g, '')}`
          const lista: any[] = JSON.parse(localStorage.getItem(chave) || '[]')
          const cepLimpo = cep.replace(/\D/g, '')
          const jaTem = lista.some((e: any) =>
            (e.rua || '').trim().toLowerCase() === rua.trim().toLowerCase() &&
            (e.numero || '').trim() === numero.trim() &&
            (e.cep || '').replace(/\D/g, '') === cepLimpo)
          if (!jaTem) {
            lista.unshift({ rua: rua.trim(), numero: numero.trim(), complemento: complemento.trim(), bairro: bairro.trim(), cidade: cidade.trim(), cep })
            localStorage.setItem(chave, JSON.stringify(lista.slice(0, 5)))
          }
        }
      } catch { /* sem localStorage: ignora */ }
      try {
        // Número do pedido (função segura no banco)
        const { data: num } = await supabase.rpc('cardapio_numero_pedido', { p_pedido: novoPedidoId })
        if (typeof num === 'number') numeroPedido = num
        // O histórico é só um registro: se falhar, o pedido vale do mesmo jeito
        const { error: erroHistorico } = await supabase.from('pedido_historico').insert({
          pedido_id: novoPedidoId, user_id: confeteiraUserId,
          evento: 'Pedido criado', descricao: 'Pedido recebido pelo Cardápio Digital',
        })
        if (erroHistorico) console.error('[Doonly] histórico do pedido:', erroHistorico)
      } catch (err) { console.error('[Doonly] depois de gravar o pedido:', err) }
    } catch (err) {
      return falhou(err)
    }

    // Mostra tela de sucesso em vez de fechar
    // (11/10) "meio emoji" em qualquer texto (observação, recado, nome) fazia o link dar erro e o WhatsApp abria sem a mensagem
    const whatsappUrl = (() => { try { return linkWhatsApp(whatsapp, semMeioEmoji(montarMensagem(numeroPedido))) } catch { return linkWhatsApp(whatsapp) } })()
    pixelEvento('Purchase', { value: totalFinal, num_items: items.length }) // (19/10) Pixel do Facebook: pedido enviado
    clearCart()
    setStep('cart')
    const quandoTxt = dataEntrega ? `${formaEntrega === 'retirada' ? 'Retirada' : 'Entrega'} ${rotuloData(dataEntrega).toLowerCase()}${horaEntrega ? ` às ${horaEntrega}` : ''}` : ''
    setPedidoConfirmado({ numero: numeroPedido, itens: items, whatsapp: whatsappUrl, storeName, total: totalFinal, quando: quandoTxt })
  }


  const accent = corBotao || '#E85A8C'
  const nomeLoja = lojaAtualNome()
  const temCupom = !!(config.tem_cupom || config.cupons_desconto.length > 0)

  // Entrega na sacola (08/10): segue o que a loja configurou
  //   só retirada → nem aparece · fixa → o valor · grátis → "Grátis" · por bairro → "Depende do bairro" · motoboy/combinar → "A combinar"
  const entregaTexto = !opsEntrega.ent ? '' : opsEntrega.ent === 'entrega_propria'
    ? (config.entrega_por_bairro.length > 0 ? 'Depende do bairro' : config.valor_entrega_propria > 0 ? formatCurrency(config.valor_entrega_propria) : 'Grátis')
    : 'A combinar'
  const entregaGratis = entregaTexto === 'Grátis'
  const rotuloTotal = !opsEntrega.ent || entregaGratis ? 'Total' : 'Total sem a entrega'
  const subtotalCupom = somarReais([totalPrice, -desconto])
  const freteTexto = formaEntrega !== 'entrega_propria' ? 'A combinar'
    : config.entrega_por_bairro.length > 0 && !bairroSelecionado ? 'Escolha o bairro'
    : freteValor > 0 ? formatCurrency(freteValor) : 'Grátis'
  const comEndereco = ehEntrega && formaEntrega !== 'combinar'

  const okReceber = !!formaEntrega && (!comEndereco || (!!rua.trim() && !!numero.trim() && (config.entrega_por_bairro.length === 0 || !!bairroSelecionado)))
  const okQuando = !!(dataEntrega && horaEntrega)
  const okDados = !!nome.trim() && telefone.replace(/\D/g, '').length >= 10
  const antTexto = regras.horas >= 48 && regras.horas % 24 === 0 ? `${regras.horas / 24} dias` : `${regras.horas}h`
  const limparEndereco = () => { setRua(''); setNumero(''); setComplemento(''); setBairro(''); setCidade(''); setCep(''); setBairroSelecionado(''); setCepErro(''); setCepAviso('') }
  // O que ainda falta na entrega (o selo diz isso em vez de voltar pra "Obrigatório")
  const faltaReceber = !formaEntrega || !comEndereco ? ''
    : !rua.trim() || !numero.trim() ? 'Falta o endereço'
    : config.entrega_por_bairro.length > 0 && !bairroSelecionado ? 'Falta o bairro' : ''

  const natal = temaNatalLigado() // (18/10) tema de Natal: neve e touquinha no Pedido enviado
  /* ═══ Pedido enviado ═══ */
  if (pedidoConfirmado) return (
    <div className="sc-enviado">
      {natal && <NeveNatal />}
      <div className="sc-enviado-in">
        <span className="sc-enviado-ic"><Check size={40} weight="bold" /></span>
        <h2>Pedido enviado!</h2>
        {natal && <p className="sc-enviado-festas">Boas festas!</p>}
        <p>{pedidoConfirmado.numero > 0 ? <>Pedido <b>#{pedidoConfirmado.numero}</b> · a </> : 'A '}<b>{pedidoConfirmado.storeName}</b> vai falar com você pelo WhatsApp.</p>
        <div className="sc-res">
          {pedidoConfirmado.itens.map((it: any, k: number) => {
            const det = detalhesItem(it)
            return (
              <span key={k}>
                <span><b>{qtdItem(it)} {it.name}</b>{det.length > 0 && <small>{det.join(' · ')}</small>}{it.observations && <small>Obs.: {it.observations}</small>}</span>
                <em>{formatCurrency(valorLinha(it))}{unidadeItem(it) && (it.quantity === 1
                  ? <small>{unidadeItem(it)}</small>
                  : <small>{formatCurrency(it.price)} {unidadeItem(it)}</small>)}</em>
              </span>
            )
          })}
          <span className="t"><span><b>Total</b></span><em>{formatCurrency(pedidoConfirmado.total)}</em></span>
          {pedidoConfirmado.quando && <span className="q"><CalendarBlank size={18} weight="bold" />{pedidoConfirmado.quando}</span>}
        </div>
        {pedidoConfirmado.whatsapp && <button type="button" className="sc-zap" onClick={() => window.open(pedidoConfirmado.whatsapp, '_blank')}><IconeWhatsApp size={22} />Mandar mensagem pra loja</button>}
        <button type="button" className="sc-bt-sec" onClick={() => { setPedidoConfirmado(null); onClose() }}>Voltar ao cardápio</button>
      </div>
    </div>
  )

  // (19/10) sacola com a cara da loja: faixa na cor do topo, logo e nome; "Limpar" no canto
  const topoSacola = (
    <div className="sc-topo sc-topo--loja" style={{ background: corTopo || '#BF6B84' }}>
      <button type="button" className="sc-bt" aria-label="Fechar" onClick={onClose}><ArrowLeft size={22} weight="bold" /></button>
      <span className="sc-topo-loja">
        <span className="sc-topo-logo" style={{ borderColor: accent }}>{logoUrl ? <img src={logoUrl} alt="" /> : <b>{(nomeLoja || 'D').charAt(0).toUpperCase()}</b>}</span>
        <span><b>Sacola</b>{nomeLoja && <small className="sc-topo-nome">{nomeLoja}{verificada && <SeloVerificado tamanho={14} />}</small>}</span>
      </span>
      <span />
      <span className="sc-topo-curva" aria-hidden="true" />
    </div>
  )
  const economia = Math.round(items.reduce((t: number, it: any) => t + (Number(it?.precoBreakdown?.desconto) || 0) * (Number(it?.quantity) || 0), 0) * 100) / 100
  const naSacola = new Set(items.map((it: any) => it.id))
  const pecaTambem = (sugestoes as Produto[]).filter(p => !naSacola.has(p.id)).slice(0, 8)

  const topo = (
    <div className="sc-topo">
      {step === 'finalizar'
        ? (direto
          ? <button type="button" className="sc-bt" aria-label="Fechar" onClick={onClose}><X size={22} weight="bold" /></button>
          : <button type="button" className="sc-bt" aria-label="Voltar pra sacola" onClick={() => { setStep('cart'); setFeErro('') }}><ArrowLeft size={22} weight="bold" /></button>)
        : <button type="button" className="sc-bt" aria-label="Fechar" onClick={onClose}><X size={22} weight="bold" /></button>}
      <span><b>{step === 'finalizar' ? 'Finalizar pedido' : 'Sacola'}</b>{nomeLoja && <small>{nomeLoja}</small>}</span>
      <span />
    </div>
  )

  /* ═══ Sacola ═══ */
  if (step !== 'finalizar') return (
    <>
      {topoSacola}
      <div className="sc-rolo">
        {items.length === 0 ? (
          <div className="sc-vazia">
            <span className="sc-vazia-ic"><Sacola size={32} weight="bold" /></span>
            <b>Sua sacola está vazia</b>
            <p>Escolha um produto no cardápio pra começar.</p>
            <button type="button" className="sc-bt-pri" style={{ background: accent }} onClick={onClose}>Ver o cardápio</button>
          </div>
        ) : (
          <>
            <div className="sc-loja">
              <span className="sc-loja-qtd">{count} {count === 1 ? 'item' : 'itens'}
                <button type="button" className={`sc-limpar${limparPergunta ? ' on' : ''}`} onClick={() => { if (limparPergunta) { clearCart(); setLimparPergunta(false) } else { setLimparPergunta(true); setTimeout(() => setLimparPergunta(false), 3000) } }}>{limparPergunta ? 'Limpar tudo?' : 'Limpar'}</button>
              </span>
              <button type="button" style={{ color: accent }} onClick={onClose}><Plus size={16} weight="bold" aria-hidden="true" />Adicionar mais</button>
            </div>
            <div className="sc-itens">
              {items.map((item: any) => (
                <CartItemComponent key={item.lineId ?? item.id} item={item} cor={accent} onUpdateQuantity={updateQuantity} onUpdateObservations={updateObservations} onRemove={removeItem} />
              ))}
            </div>
            {economia > 0 && <p className="sc-eco"><Tag size={18} weight="bold" aria-hidden="true" />Você está economizando {formatCurrency(economia)}</p>}

            {/* (19/10) Peça também: outros produtos da loja, como no iFood */}
            {pecaTambem.length > 0 && (
              <section className="sc-sug" aria-label="Peça também">
                <b className="sc-sug-tit">Peça também</b>
                <div className="sc-sug-lista">{pecaTambem.map(p => <SugestaoSacola key={p.id} produto={p} cor={accent} />)}</div>
              </section>
            )}

            {/* Cupom: só quando a loja tem cupom ativo */}
            {temCupom && (cupomAplicado ? (
              <button type="button" className="sc-linha ok" onClick={removerCupom}>
                <Tag size={20} weight="bold" /><span><b>Cupom {cupomAplicado.codigo}</b><small>− {formatCurrency(desconto)} · tirar o cupom</small></span><X size={18} weight="bold" />
              </button>
            ) : cupomAberto ? (
              <>
                <div className="sc-cupom">
                  <Campo rotulo="Código do cupom" value={cupomDigitado} autoFocus autoCapitalize="characters" placeholder="Ex.: DOCE10"
                    onChange={e => { setCupomDigitado(e.target.value.toUpperCase()); setCupomErro('') }}
                    onKeyDown={e => { if (e.key === 'Enter') aplicarCupom() }} />
                  <button type="button" className="sc-cupom-bt" style={{ alignSelf: 'flex-end' }} onClick={() => aplicarCupom()} disabled={!cupomDigitado.trim() || validandoCupom}>{validandoCupom ? '…' : 'Aplicar'}</button>
                </div>
                {cupomErro && <p className="sc-erro" role="alert">{cupomErro}</p>}
              </>
            ) : (
              <button type="button" className="sc-linha" onClick={() => setCupomAberto(true)}>
                <Tag size={20} weight="bold" /><span><b>Cupom</b><small>Tem um código? Coloque aqui</small></span><CaretRight size={18} weight="bold" />
              </button>
            ))}

            <div className="sc-valores">
              <b>Resumo</b>
              {/* (20/10) resumo aberto: subtotal sem desconto, a promoção em verde e a entrega que a loja já definiu */}
              <span>Subtotal<em>{formatCurrency(somarReais([totalPrice, economia]))}</em></span>
              {economia > 0 && <span className="ok">Promoção<em>− {formatCurrency(economia)}</em></span>}
              {desconto > 0 && <span className="ok">Cupom {cupomAplicado?.codigo}<em>− {formatCurrency(desconto)}</em></span>}
              {opsEntrega.ent && <span>Entrega<em className={entregaGratis ? 'ok' : ''}>{entregaTexto}</em></span>}
              <span className="t">{rotuloTotal}<em>{formatCurrency(subtotalCupom)}</em></span>
            </div>
          </>
        )}
      </div>
      {items.length > 0 && (
        <footer className="sc-pe">
          <span className="sc-pe-tot"><small>{rotuloTotal}</small><b>{formatCurrency(subtotalCupom)}</b><em>{count} {count === 1 ? 'item' : 'itens'}</em></span>
          {config.loja_pausada
            ? <button type="button" className="sc-bt-pri sc-bt-pausada" onClick={() => avisar('A loja pausou os pedidos por enquanto. Chame no WhatsApp pra combinar.', { tipo: 'info' })}>Pedidos pausados</button>
            : <button type="button" className="sc-bt-pri" style={{ background: accent }} onClick={() => { pixelEvento('InitiateCheckout', { value: totalPrice, num_items: items.length }); setStep('finalizar') }}>Continuar</button>}
        </footer>
      )}
    </>
  )

  /* ═══ Finalizar pedido ═══ */
  const tipo = formaEntrega === 'retirada' ? 'retirada' : 'entrega'
  return (
    <>
      {topo}
      <div className="sc-rolo">
        {/* Como receber + endereço */}
        <section ref={refEndereco}>
          <Cab t="Como você quer receber?" sub={opsEntrega.ret && opsEntrega.ent ? 'Escolha 1 opção' : undefined} obr ok={okReceber} pendente={faltaReceber || undefined}
            falta={feErro === 'endereco' ? (config.entrega_por_bairro.length > 0 && !bairroSelecionado && rua.trim() && numero.trim() ? 'Escolha o bairro da entrega' : 'Preencha o endereço da entrega') : undefined} />
          <div className={`sc-receber${opsEntrega.ret && opsEntrega.ent ? '' : ' um'}`}>
            {opsEntrega.ret && (
              <button type="button" aria-pressed={formaEntrega === 'retirada'} style={formaEntrega === 'retirada' ? { borderColor: accent } : undefined}
                onClick={() => { setFormaEntrega('retirada'); setBairroSelecionado(''); setFeErro('') }}>
                <Storefront size={22} weight="bold" /><b>Retirar na loja</b>
              </button>
            )}
            {opsEntrega.ent && (
              <button type="button" aria-pressed={ehEntrega} style={ehEntrega ? { borderColor: accent } : undefined}
                onClick={() => { setFormaEntrega(opsEntrega.ent); setFeErro('') }}>
                <Truck size={22} weight="bold" /><b>Entrega</b><small>{opsEntrega.ent === 'entrega_propria' ? entregaTexto : LABEL_ENTREGA[opsEntrega.ent]?.label || 'A combinar'}</small>
              </button>
            )}
          </div>
          {formaEntrega === 'retirada' && config.endereco_retirada && (
            <p className="sc-nota"><Storefront size={18} weight="bold" /><span>Retirar em <b>{config.endereco_retirada}</b></span></p>
          )}
          {formaEntrega === 'combinar' && (
            <p className="sc-nota"><ChatCircleDots size={18} weight="bold" /><span>A loja combina a entrega com você pelo WhatsApp.</span></p>
          )}
          {comEndereco && (
            <div className="sc-campos">
              {enderecosSalvos.length > 0 && !endNovo ? (
                <>
                  {enderecosSalvos.map((e: any, i: number) => {
                    const on = rua === e.rua && numero === e.numero
                    return (
                      <button key={i} type="button" className="sc-salvo" aria-pressed={on} style={on ? { borderColor: accent } : undefined} onClick={() => usarEndereco(e)}>
                        <span><b>{e.rua}{e.numero ? `, ${e.numero}` : ''}</b><small>{[e.complemento, e.bairro, e.cidade].filter(Boolean).join(' · ')}</small></span>
                        <i style={on ? { background: accent, borderColor: accent } : undefined}>{on && <Check size={14} weight="bold" color="#fff" />}</i>
                      </button>
                    )
                  })}
                  <button type="button" className="sc-mais" style={{ color: accent }} onClick={() => { setEndNovo(true); limparEndereco() }}><Plus size={18} weight="bold" />Usar outro endereço</button>
                </>
              ) : (
                <>
                  <div className="sc-campos-2">
                    <Campo rotulo="CEP" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={cep}
                      dica={cepLoading ? 'Procurando…' : cepAviso || undefined} erro={cepErro || undefined}
                      onBlur={() => { const n = cep.replace(/\D/g, '').length; setCepErro(n > 0 && n < 8 ? 'Faltam números no CEP' : '') }}
                      onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 8); setCep(v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v); setCepErro(''); setCepAviso(''); buscarCep(v) }} />
                    <Campo rotulo="Número" inputMode="numeric" value={numero} onChange={e => setNumero(e.target.value)}
                      erro={feErro === 'endereco' && !numero.trim() ? 'Falta o número' : undefined} />
                  </div>
                  <Campo rotulo="Rua" autoComplete="address-line1" value={rua} onChange={e => setRua(e.target.value)}
                    erro={feErro === 'endereco' && !rua.trim() ? 'Falta a rua' : undefined} />
                  {config.entrega_por_bairro.length === 0 && <Campo rotulo="Bairro" value={bairro} onChange={e => setBairro(e.target.value)} />}
                  <Campo rotulo="Complemento" placeholder="Ex.: apto 12, bloco B (se tiver)" value={complemento} onChange={e => setComplemento(e.target.value)} />
                  {endNovo && enderecosSalvos.length > 0 && (
                    <button type="button" className="sc-mais" style={{ color: accent }} onClick={() => usarEndereco(enderecosSalvos[0])}>Usar um endereço salvo</button>
                  )}
                </>
              )}
              {formaEntrega === 'entrega_propria' && config.entrega_por_bairro.length > 0 && (
                <>
                  <p className="sc-rot">Bairro</p>
                  <div className="sc-chips">
                    {config.entrega_por_bairro.map((b: any) => {
                      const on = bairroSelecionado === b.bairro
                      return (
                        <button type="button" key={b.bairro} aria-pressed={on} style={on ? { borderColor: accent, color: accent } : undefined}
                          onClick={() => { setBairroSelecionado(b.bairro); setBairro(b.bairro); setFeErro('') }}>
                          {b.bairro} · {b.valor > 0 ? formatCurrency(b.valor) : 'Grátis'}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        {/* Quando */}
        <section ref={refAgenda}>
          {/* (20/10) título curto e o prazo numa linha só (antes quebrava em duas) */}
          <Cab t={tipo === 'retirada' ? 'Quando busca?' : 'Quando chega?'} sub={regras.horas > 0 ? `${antTexto} de antecedência` : `Escolha o dia e o horário da ${tipo}`} obr ok={okQuando}
            falta={feErro === 'agenda' ? 'Escolha a data e o horário pra continuar' : undefined} />
          <div className="sc-quando">
            <button type="button" className={`sc-campo${feErro === 'agenda' && !dataEntrega ? ' err' : ''}`} onClick={() => { acertarRelogio(); setCalAberto(true) }}>
              <CalendarBlank size={20} weight="bold" /><span><small>Data</small><b className={dataEntrega ? '' : 'ph'}>{dataEntrega ? dataCurta(dataEntrega) : 'Escolher'}</b></span>
            </button>
            <button type="button" className={`sc-campo${feErro === 'agenda' && dataEntrega && !horaEntrega ? ' err' : ''}`} disabled={!dataEntrega} onClick={() => { acertarRelogio(); setHoraAberta(true) }}>
              <Clock size={20} weight="bold" /><span><small>Horário</small><b className={horaEntrega ? '' : 'ph'}>{horaEntrega || 'Escolher'}</b></span>
            </button>
          </div>
          {regras.cortado && primeiraDisp && (
            <div className="sc-aviso">
              <b>Pedido depois das {regras.fechamentoHoje}</b>
              <small>A produção de amanhã já fechou. A primeira data disponível é {primeiraDisp.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}.</small>
            </div>
          )}
        </section>

        {/* Pagamento */}
        <section ref={refPagamento}>
          <Cab t="Pagamento" sub={`Você paga na ${tipo}`} obr ok={!!formaPagamento} falta={feErro === 'pagamento' ? 'Escolha como vai pagar' : undefined} />
          <div role="radiogroup" aria-label="Forma de pagamento">
            {metodosPag.map((k: string) => {
              const on = formaPagamento === k
              const Ic = ICONE_PAGAMENTO[k] || Money
              return (
                <button key={k} type="button" className="sc-op" role="radio" aria-checked={on} onClick={() => { setFormaPagamento(k); setFeErro('') }}>
                  <span className="sc-op-ic"><Ic size={22} weight="bold" /></span><b>{LABEL_PAGAMENTO[k]?.label || k}</b>
                  <span className="sc-ctl" style={on ? { borderColor: accent } : undefined}>{on && <i style={{ background: accent }} />}</span>
                </button>
              )
            })}
          </div>
          {formaPagamento === 'dinheiro' && config.exibir_campo_troco && (
            <div className="sc-troco">
              <Campo rotulo="Troco pra quanto?" dica="Deixe em branco se não precisar de troco." prefixo="R$" inputMode="decimal" value={trocoParaStr} onChange={e => setTrocoParaStr(e.target.value.replace(/[^0-9.,]/g, ''))} />
            </div>
          )}
        </section>

        {/* Seus dados */}
        <section ref={refDados}>
          <Cab t="Seus dados" sub="Pra loja falar com você" obr ok={okDados} falta={feErro === 'dados' ? 'Preencha o seu nome e o WhatsApp' : undefined} />
          <div className="sc-campos">
            <Campo rotulo="Nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Como você se chama?" autoComplete="name"
              erro={feErro === 'dados' && !nome.trim() ? 'Falta o seu nome' : undefined} />
            <Campo rotulo="WhatsApp" value={telefone} inputMode="tel" autoComplete="tel" placeholder="(41) 9 9999-0000"
              erro={feErro === 'dados' && telefone.replace(/\D/g, '').length < 10 ? 'Coloque o número com DDD' : undefined}
              onChange={e => { const d = digitosAoDigitar(e.target.value); setTelefone(d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d) }} />
          </div>
        </section>

        {/* Recado */}
        <section>
          <Cab t="Recado pra loja" opc />
          <div className="sc-campos sc-recado">
            <CampoArea rotulo="" aria-label="Recado pra loja" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder='Ex.: escrever "Parabéns, Lia!" no bolo' rows={3} />
          </div>
        </section>

        <div className="sc-valores">
          <b>Resumo de valores</b>
          <span>Subtotal<em>{formatCurrency(totalPrice)}</em></span>
          {ehEntrega && <span>Entrega<em className={freteTexto === 'Grátis' ? 'ok' : ''}>{freteTexto}</em></span>}
          {desconto > 0 && <span className="ok">Cupom {cupomAplicado?.codigo}<em>− {formatCurrency(desconto)}</em></span>}
          <span className="t">Total<em>{formatCurrency(totalFinal)}</em></span>
        </div>
      </div>

      <footer className="sc-pe">
        <button type="button" className={`sc-bt-pri cheio${treme ? ' treme' : ''}`} style={{ background: accent }} disabled={enviando} onClick={enviarFinalizar}>
          <span>{enviando ? 'Enviando…' : 'Enviar pedido'}</span><b>{formatCurrency(totalFinal)}</b>
        </button>
      </footer>

      {calAberto && (
        <CalendarioSheet titulo={`Data da ${tipo}`} horario={config.horario} minimo={regras.minimo} valor={dataEntrega}
          onEscolher={(iso) => { setDataEntrega(iso); setHoraEntrega(''); setFeErro(''); setTimeout(() => { acertarRelogio(); setHoraAberta(true) }, 250) }}
          onClose={() => setCalAberto(false)} />
      )}
      {horaAberta && dataEntrega && (
        <HorariosSheet data={dataEntrega} horario={config.horario} minimo={regras.minimo} valor={horaEntrega}
          onEscolher={(h) => { setHoraEntrega(h); setFeErro('') }} onClose={() => setHoraAberta(false)} />
      )}
    </>
  )
}


/* ─── Componente principal ─── */
/* ─── Componente principal ─── */
export function NavigationMenu({ corBotao, celular, corTopo, logoUrl, sugestoes, verificada }: { corBotao?: string; /** a página está no layout de celular? (10/10) */ celular?: boolean; /** (19/10) a sacola com a cara da loja */ corTopo?: string; logoUrl?: string; sugestoes?: Produto[]; verificada?: boolean }) {
  const { items, totalPrice, updateQuantity, updateObservations, removeItem, clearCart } = useCart()
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<'cart' | 'finalizar'>('cart')
  // (20/10) computador: a coluna da direita já é a sacola, então "Finalizar pedido" abre direto no finalizar
  const [direto, setDireto] = useState(false)
  const [activeTab, setActiveTab] = useState('inicio')
  // Altura real do rodapé (menu + faixa "Meu pedido") — as abas Pedidos/Perfil param em cima dele
  const rodapeRef = useRef<HTMLDivElement>(null)
  const [alturaRodape, setAlturaRodape] = useState(62)
  useEffect(() => {
    const el = rodapeRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setAlturaRodape(el.getBoundingClientRect().height))
    ro.observe(el)
    return () => ro.disconnect()
  })
  // 10/10: a barra de baixo (sacola, Pedidos, Minha conta) segue a MESMA régua da página (celular = abaixo de 1024).
  // Antes usava 768: no tablet em pé (768 a 1023) a página era a de celular, mas sem a barra não dava pra abrir a sacola.
  const aparelho = useDeviceDetection()
  const isMobile = celular ?? aparelho !== 'desktop'

  const [config, setConfig] = useState<CheckoutConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    // 10/10: a configuração é a da loja desta aba (o localStorage fica só de reserva)
    const c = lojaAtualCheckout()
    if (c) setConfig({ ...DEFAULT_CONFIG, ...(c as Partial<CheckoutConfig>) })
  }, [isOpen])

  useEffect(() => {
    const handler = () => setIsOpen(true)
    const finalizar = () => { setDireto(true); setStep('finalizar'); setIsOpen(true) }
    window.addEventListener('open-cart', handler)
    window.addEventListener('open-checkout', finalizar)
    return () => { window.removeEventListener('open-cart', handler); window.removeEventListener('open-checkout', finalizar) }
  }, [])

  const count = contarItens(items)
  const accent = corBotao || '#ea1d2c'
  // (19/10) menu de baixo branco: a aba ativa vai na cor do topo da loja (cor clara demais não dá pra ler no branco)
  const corAtiva = corTopo && /^#[0-9a-f]{6}$/i.test(corTopo) && !corClara(corTopo) ? corTopo : '#2C1219'

  const handleClose = () => { setIsOpen(false); setStep('cart'); setDireto(false) }

  // Sacola (08/10 · 3.30): Esc e o voltar do Android fecham; no finalizar, o voltar volta pra sacola
  const caixaRef = useRef<HTMLDivElement>(null)
  useSobreposicao(isOpen, handleClose, caixaRef)
  useSobreposicao(isOpen && step === 'finalizar' && !direto, () => setStep('cart'), caixaRef)

  const sharedProps = {
    step, setStep, items, totalPrice,
    updateQuantity, updateObservations, removeItem, clearCart,
    config, onClose: handleClose, corBotao: accent, corTopo, logoUrl, sugestoes, verificada, direto,
  }

  return (
    <>
      <style>{`
        /* 08/10 · 3.28: menu de baixo (vinho, igual ao do app) e o botão do pedido na cor da loja */
        .cpn-pe { pointer-events: none; }
        .cpn-pe > * { pointer-events: auto; }
        .cpn-pedido { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 50px; margin: 0; padding: 6px 16px; border: 0; border-radius: 0; color: var(--ui-branco); font-family: inherit; text-align: left; white-space: nowrap; cursor: pointer; }
        .cpn-pedido-ic { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: var(--ui-raio); background: rgba(255,255,255,.2); flex: none; }
        .cpn-pedido-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .cpn-pedido-tx b { font-size: 15px; font-weight: 700; line-height: 1.25; }
        .cpn-pedido-tx small { font-size: 13px; opacity: .9; }
        .cpn-pedido strong { font-size: 16px; font-weight: 700; }
        /* (19/10) menu branco (padrão iFood/99): parada em cinza, ativa na cor do topo da loja */
        .cpn-pe { box-shadow: 0 -2px 12px rgba(44,18,25,.08); }
        .cpn-menu { display: flex; padding-bottom: env(safe-area-inset-bottom, 0px); background: #fff; border-top: 1px solid #EFE7E3; }
        .cpn-menu button { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 60px; margin: 0; border: 0; background: none; color: #8A7F82; font-family: inherit; font-size: 12.5px; font-weight: 500; white-space: nowrap; cursor: pointer; }
        .cpn-ic { display: flex; align-items: center; justify-content: center; width: 52px; height: 30px; border-radius: var(--ui-raio); }
        .cpn-menu button[aria-current="page"] { color: var(--cpn-ativa); font-weight: 700; }
        .cpn-menu button[aria-current="page"] .cpn-ic { background: color-mix(in srgb, var(--cpn-ativa) 12%, #fff); }
        /* (20/10) bolinha com a quantidade, no ícone da sacola */
        .cpn-ic, .cpn-pedido-ic { position: relative; }
        .cpn-bolinha { position: absolute; top: -3px; right: 6px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: #EF4444; color: #fff; font: 700 11px/18px system-ui, sans-serif; font-style: normal; text-align: center; box-shadow: 0 0 0 2px #fff; }
        .cpn-bolinha--sacola { top: -6px; right: -7px; background: #fff; box-shadow: 0 0 0 2px rgba(0,0,0,.08); }
      `}</style>

      {/* ═══ MOBILE: tab bar + cart vindo de baixo ═══ */}
      {isMobile && (
        <>
          <div ref={rodapeRef} className="cpn-pe fixed bottom-0 left-0 right-0 z-30" style={{ ['--cpn-ativa' as any]: corAtiva }}>
            {count > 0 && (
              <button type="button" className="cpn-pedido" style={{ background: accent }} onClick={() => setIsOpen(true)}>
                {/* (20/10) a quantidade fica no ícone da sacola (antes ia em "Pedidos" e parecia pedido feito) */}
                <span className="cpn-pedido-ic"><Sacola size={20} weight="fill" color="white" /><i className="cpn-bolinha cpn-bolinha--sacola" style={{ color: accent }} aria-hidden="true">{count > 9 ? '9+' : count}</i></span>
                <span className="cpn-pedido-tx"><b>Ver seu pedido</b><small>{count} {count === 1 ? 'item' : 'itens'}</small></span>
                <strong>{formatCurrency(totalPrice)}</strong>
                <CaretRight size={18} weight="bold" color="rgba(255,255,255,0.8)" />
              </button>
            )}

            <nav className="cpn-menu" aria-label="Menu do cardápio">
              {[
                { id: 'inicio',   label: 'Início',  Icone: House },
                { id: 'pedidos',  label: 'Pedidos', Icone: ClipboardText },
                { id: 'perfil',   label: 'Minha conta',  Icone: User },
              ].map(({ id, label, Icone }) => (
                <button key={id} type="button" aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)}>
                  <span className="cpn-ic"><Icone size={24} weight={activeTab === id ? "fill" : "regular"} /></span>{label}
                </button>
              ))}
            </nav>
          </div>

          {/* Painel Perfil */}
          {activeTab === 'perfil' && (
            /* Termina em cima do menu de baixo (antes cobria o menu e o cliente não conseguia voltar) */
            <div style={{position:'fixed',top:0,left:0,right:0,bottom:alturaRodape,zIndex:200,background:'#fff',display:'flex',flexDirection:'column',overflowY:'auto'}}>
              <div style={{flexShrink:0,height:'env(safe-area-inset-top, 0px)'}} />
              <PerfilTab accent={accent} confeteiraUserId={lojaAtualId()} />
            </div>
          )}

          {/* Painel Pedidos */}
          {activeTab === 'pedidos' && (
            <div style={{position:'fixed',top:0,left:0,right:0,bottom:alturaRodape,zIndex:200,background:'#fff',display:'flex',flexDirection:'column',overflowY:'auto'}}>
              <div style={{flexShrink:0,height:'env(safe-area-inset-top, 0px)'}} />
              <PedidosTab
                accent={accent}
                confeteiraUserId={lojaAtualId()}
                onIrParaPerfil={() => setActiveTab('perfil')}
                onVerCardapio={() => setActiveTab('inicio')}
              />
            </div>
          )}
        </>
      )}

      {/* ═══ Sacola e finalizar (celular e computador) ═══ */}
      {isOpen && (
        <div className="sc-veu" onClick={handleClose}>
          <div ref={caixaRef} className="sc" role="dialog" aria-modal="true" aria-label={step === 'finalizar' ? 'Finalizar pedido' : 'Sacola'} tabIndex={-1} onClick={e => e.stopPropagation()}>
            <CartContent key={`sacola-${isOpen}`} {...sharedProps} />
          </div>
        </div>
      )}
    </>
  )
}

import { useState, useEffect, useMemo, useRef } from 'react'
import { montarMensagem as montarMensagemModelo } from '@/lib/mensagens'
import { CalendarioSheet, HorariosSheet } from '@/components/cardapio/AgendaSheets'
import { antecedenciaHoras, calcularRegras, primeiraData, rotuloData } from '@/lib/agendaCardapio'
import { supabase } from '@/lib/supabase'
import { ShoppingBag, Home, ClipboardList, User, ChevronRight } from 'lucide-react'
import { ArrowLeft, CalendarBlank, CaretRight, Check, ChatCircleDots, Clock, CreditCard, Money, PixLogo, Plus, ShoppingBag as Sacola, Storefront, Tag, Truck, WhatsappLogo, X } from '@phosphor-icons/react'
import { useCart } from '@/hooks/useCart'
import { CartItemComponent } from '@/components/cart/CartItemComponent'
import { formatCurrency } from '@/utils/helpers'
import { useIsMobile } from '@/hooks/use-mobile'
import { PerfilTab } from './PerfilTab'
import { PedidosTab } from './PedidosTab'
import { itemDoCarrinhoParaPedido } from '@/lib/itemDoCarrinho'
import { contarItens, detalhesItem, qtdItem } from '@/lib/itemSacola'
import { Campo, CampoArea, avisar } from '@/components/base'
import { useSobreposicao } from '@/components/base/useSobreposicao'
import '@/components/cart/sacola.css'

interface CheckoutConfig {
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
function Cab({ t, sub, obr, ok, falta }: { t: string; sub?: string; obr?: boolean; ok?: boolean; falta?: string }) {
  return (
    <header className={`sc-g-cab${falta ? ' falta' : ''}`}>
      <span><b>{t}</b>{(falta || sub) && <small>{falta || sub}</small>}</span>
      {obr && (ok && !falta ? <i className="sc-ok" aria-label="Pronto"><Check size={14} weight="bold" /></i> : <i className="sc-obr">Obrigatório</i>)}
    </header>
  )
}

/* ─── Conteúdo interno do carrinho (reutilizado em mobile e desktop) ─── */
function CartContent({
  step, setStep, items, totalPrice, updateQuantity, updateObservations, removeItem, clearCart,
  config, onClose, corBotao,
}: any) {
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
  const regras = useMemo(() => calcularRegras(new Date(), config.horario, horasAnt), [config.horario, horasAnt, step])
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
  const enviarFinalizar = async () => {
    if (enviando) return
    let falta: typeof feErro = ''
    if (!dataEntrega || !horaEntrega) falta = 'agenda'
    else if (ehEntrega && formaEntrega !== 'combinar' && (!rua.trim() || !numero.trim() || (config.entrega_por_bairro.length > 0 && !bairroSelecionado))) falta = 'endereco'
    else if (!formaPagamento) falta = 'pagamento'
    else if (!nome.trim() || telefone.replace(/\D/g, '').length < 10) falta = 'dados'
    setFeErro(falta)
    if (falta) {
      irPara({ agenda: refAgenda, endereco: refEndereco, pagamento: refPagamento, dados: refDados }[falta])
      setTreme(true); setTimeout(() => setTreme(false), 400)
      return
    }
    setEnviando(true)
    try { await enviarPedido() } finally { setEnviando(false) }
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
      const uid = localStorage.getItem('cardapio_user_id') || ''
      const saved = localStorage.getItem(`cardapio_cliente_${uid}`)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })()
  const [nome, setNome] = useState(clienteLogado?.nome || '')
  const [telefone, setTelefone] = useState(clienteLogado?.telefone || '')

  // Endereços que a cliente já usou nesta loja (salvos no aparelho depois de cada pedido com entrega)
  const enderecosSalvos: any[] = useMemo(() => {
    try {
      const uid = localStorage.getItem('cardapio_user_id') || ''
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
    setCepLoading(true); setCepErro('')
    try {
      const res = await fetch(`https://viacep.com.br/ws/${c}/json/`)
      const d = await res.json()
      if (d.erro) { setCepErro('CEP não encontrado'); } else {
        setRua(d.logradouro || '')
        setBairro(d.bairro || '')
        setCidade(d.localidade || '')
      }
    } catch { setCepErro('Erro ao buscar CEP') }
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

  const desconto = useMemo(() => {
    if (!cupomAplicado) return 0
    if (cupomAplicado.tipo === 'percentual') return Math.round(totalPrice * cupomAplicado.valor) / 100
    return Math.min(cupomAplicado.valor, totalPrice)
  }, [cupomAplicado, totalPrice])

  const totalFinal = Math.round((totalPrice - desconto + freteValor) * 100) / 100

  const [validandoCupom, setValidandoCupom] = useState(false)
  const aplicarCupom = async () => {
    setCupomErro('')
    const code = cupomDigitado.trim().toUpperCase()
    if (!code) return
    const loja = localStorage.getItem('cardapio_user_id') || ''
    setValidandoCupom(true)
    try {
      // Validação no banco: ativo, período, valor mínimo e limite de usos
      const { data, error } = await supabase.rpc('cardapio_validar_cupom', { p_loja: loja, p_codigo: code, p_subtotal: totalPrice })
      const r: any = data
      if (!error && r?.ok) {
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

  const removerCupom = () => { setCupomAplicado(null); setCupomDigitado(''); setCupomErro('') }

  const enviarPedido = async () => {
    if (!nome.trim() || !telefone.trim()) return avisar('Preencha o seu nome e o WhatsApp', { tipo: 'erro' })
    if (!formaEntrega) return avisar('Escolha como vai receber', { tipo: 'erro' })
    if (!formaPagamento) return avisar('Escolha como vai pagar', { tipo: 'erro' })
    // Endereço vai junto em toda entrega com endereço (antes o do motoboy/Uber Flash ficava de fora)
    const temEndereco = ehEntrega && formaEntrega !== 'combinar'

    const whatsapp = localStorage.getItem('cardapio_whatsapp') || ''
    const storeName = localStorage.getItem('cardapio_nome') || 'Cardápio'
    const confeteiraUserId = localStorage.getItem('cardapio_user_id') || ''

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
        m += `*${qtd} ${item.name}* — ${formatCurrency(item.price * item.quantity)}\n`
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
        if (item.fotoReferencia) m += `Foto de referência: ${item.fotoReferencia}\n`
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

    const num = whatsapp.replace(/\D/g, '')

    // Resumo para tela de sucesso (mantém referência aos itens originais)

    // ── Salva pedido no Supabase e vincula cliente ──
    let numeroPedido = 0
    if (confeteiraUserId) {
      try {
        const telefoneLimpo = telefone.replace(/\D/g, '')
        let clienteId: string | null = null
        // Função segura no banco: acha o cliente pelo telefone ou cria (sem ler a tabela direto)
        const { data: listaCliente } = await supabase.rpc('cardapio_cliente', {
          p_loja: confeteiraUserId, p_telefone: telefone.trim(), p_nome: nome.trim(),
        })
        if (Array.isArray(listaCliente) && listaCliente[0]) clienteId = listaCliente[0].id

        // Loga o cliente automaticamente após o pedido (se ainda não estiver logado)
        if (clienteId && !localStorage.getItem(`cardapio_cliente_${confeteiraUserId}`)) {
          localStorage.setItem(`cardapio_cliente_${confeteiraUserId}`, JSON.stringify({
            id: clienteId, nome: nome.trim(), telefone: telefone.trim(),
          }))
        }

        // O id é gerado aqui, então o pedido é gravado sem precisar ler a tabela de volta
        const novoPedidoId: string = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16) })
        const { error: erroPedido } = await supabase.from('pedidos').insert({
            id: novoPedidoId,
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
          })
        if (erroPedido) throw erroPedido
        const pedidoSalvo = { id: novoPedidoId }

        // Entrega: guarda o endereço em "Dados pessoais" pra próxima compra (sem repetir)
        if (formaEntrega === 'entrega_propria' && rua.trim()) {
          try {
            const chave = `enderecos_${confeteiraUserId}_${telefoneLimpo}`
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
          } catch { /* sem localStorage: ignora */ }
        }

        if (pedidoSalvo) {
          // Número do pedido (função segura no banco)
          const { data: num } = await supabase.rpc('cardapio_numero_pedido', { p_pedido: novoPedidoId })
          if (typeof num === 'number') numeroPedido = num
          if (items.length > 0) {
            await supabase.from('pedido_itens').insert(
              items.map((item: any) => ({
                // Tudo o que o cliente escolheu vai pro pedido (regra única em lib/itemDoCarrinho)
                pedido_id: pedidoSalvo.id, user_id: confeteiraUserId, desconto: 0,
                ...itemDoCarrinhoParaPedido(item),
              }))
            )
            await supabase.from('pedido_historico').insert({
              pedido_id: pedidoSalvo.id, user_id: confeteiraUserId,
              evento: 'Pedido criado', descricao: 'Pedido recebido pelo Cardápio Digital',
            })
          }
        }
      } catch (err) {
        console.error('Erro ao salvar pedido no Supabase:', err)
      }
    }

    clearCart()
    setStep('cart')
    // Mostra tela de sucesso em vez de fechar
    const whatsappUrl = `https://wa.me/55${num}?text=${encodeURIComponent(montarMensagem(numeroPedido))}`
    const quandoTxt = dataEntrega ? `${formaEntrega === 'retirada' ? 'Retirada' : 'Entrega'} ${rotuloData(dataEntrega).toLowerCase()}${horaEntrega ? ` às ${horaEntrega}` : ''}` : ''
    setPedidoConfirmado({ numero: numeroPedido, itens: items, whatsapp: whatsappUrl, storeName, total: totalFinal, quando: quandoTxt })
  }


  const accent = corBotao || '#E85A8C'
  const nomeLoja = (() => { try { return localStorage.getItem('cardapio_nome') || '' } catch { return '' } })()
  const temCupom = !!(config.tem_cupom || config.cupons_desconto.length > 0)

  // Entrega na sacola (08/10): segue o que a loja configurou
  //   só retirada → nem aparece · fixa → o valor · grátis → "Grátis" · por bairro → "Depende do bairro" · motoboy/combinar → "A combinar"
  const entregaTexto = !opsEntrega.ent ? '' : opsEntrega.ent === 'entrega_propria'
    ? (config.entrega_por_bairro.length > 0 ? 'Depende do bairro' : config.valor_entrega_propria > 0 ? formatCurrency(config.valor_entrega_propria) : 'Grátis')
    : 'A combinar'
  const entregaGratis = entregaTexto === 'Grátis'
  const rotuloTotal = !opsEntrega.ent || entregaGratis ? 'Total' : 'Total sem a entrega'
  const subtotalCupom = Math.round((totalPrice - desconto) * 100) / 100
  const freteTexto = formaEntrega !== 'entrega_propria' ? 'A combinar'
    : config.entrega_por_bairro.length > 0 && !bairroSelecionado ? 'Escolha o bairro'
    : freteValor > 0 ? formatCurrency(freteValor) : 'Grátis'
  const comEndereco = ehEntrega && formaEntrega !== 'combinar'

  const okReceber = !!formaEntrega && (!comEndereco || (!!rua.trim() && !!numero.trim() && (config.entrega_por_bairro.length === 0 || !!bairroSelecionado)))
  const okQuando = !!(dataEntrega && horaEntrega)
  const okDados = !!nome.trim() && telefone.replace(/\D/g, '').length >= 10
  const antTexto = regras.horas >= 48 && regras.horas % 24 === 0 ? `${regras.horas / 24} dias` : `${regras.horas}h`
  const limparEndereco = () => { setRua(''); setNumero(''); setComplemento(''); setBairro(''); setCidade(''); setCep(''); setBairroSelecionado('') }

  /* ═══ Pedido enviado ═══ */
  if (pedidoConfirmado) return (
    <div className="sc-enviado">
      <div className="sc-enviado-in">
        <span className="sc-enviado-ic"><Check size={40} weight="bold" /></span>
        <h2>Pedido enviado!</h2>
        <p>{pedidoConfirmado.numero > 0 ? <>Pedido <b>#{pedidoConfirmado.numero}</b> · a </> : 'A '}<b>{pedidoConfirmado.storeName}</b> vai falar com você pelo WhatsApp.</p>
        <div className="sc-res">
          {pedidoConfirmado.itens.map((it: any, k: number) => {
            const det = detalhesItem(it)
            return (
              <span key={k}>
                <span><b>{qtdItem(it)} {it.name}</b>{det.length > 0 && <small>{det.join(' · ')}</small>}{it.observations && <small>Obs.: {it.observations}</small>}</span>
                <em>{formatCurrency(it.price * it.quantity)}</em>
              </span>
            )
          })}
          <span className="t"><span><b>Total</b></span><em>{formatCurrency(pedidoConfirmado.total)}</em></span>
          {pedidoConfirmado.quando && <span className="q"><CalendarBlank size={18} weight="bold" />{pedidoConfirmado.quando}</span>}
        </div>
        <button type="button" className="sc-zap" onClick={() => window.open(pedidoConfirmado.whatsapp, '_blank')}><WhatsappLogo size={22} weight="bold" />Mandar mensagem pra loja</button>
        <button type="button" className="sc-bt-sec" onClick={() => { setPedidoConfirmado(null); onClose() }}>Voltar ao cardápio</button>
      </div>
    </div>
  )

  const topo = (
    <div className="sc-topo">
      {step === 'finalizar'
        ? <button type="button" className="sc-bt" aria-label="Voltar pra sacola" onClick={() => { setStep('cart'); setFeErro('') }}><ArrowLeft size={22} weight="bold" /></button>
        : <button type="button" className="sc-bt" aria-label="Fechar" onClick={onClose}><X size={22} weight="bold" /></button>}
      <span><b>{step === 'finalizar' ? 'Finalizar pedido' : 'Sacola'}</b>{nomeLoja && <small>{nomeLoja}</small>}</span>
      <span />
    </div>
  )

  /* ═══ Sacola ═══ */
  if (step !== 'finalizar') return (
    <>
      {topo}
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
            <div className="sc-loja"><span>{nomeLoja || 'Seu pedido'}</span><button type="button" style={{ color: accent }} onClick={onClose}>Adicionar mais itens</button></div>
            {items.map((item: any) => (
              <CartItemComponent key={item.lineId ?? item.id} item={item} cor={accent} onUpdateQuantity={updateQuantity} onUpdateObservations={updateObservations} onRemove={removeItem} />
            ))}

            {/* Cupom: só quando a loja tem cupom ativo */}
            {temCupom && (cupomAplicado ? (
              <button type="button" className="sc-linha ok" onClick={removerCupom}>
                <Tag size={20} weight="bold" /><span><b>Cupom {cupomAplicado.codigo}</b><small>− {formatCurrency(desconto)} · toque pra tirar</small></span><X size={18} weight="bold" />
              </button>
            ) : cupomAberto ? (
              <>
                <div className="sc-cupom">
                  <Campo rotulo="Código do cupom" value={cupomDigitado} autoFocus autoCapitalize="characters" placeholder="Ex.: DOCE10"
                    onChange={e => { setCupomDigitado(e.target.value.toUpperCase()); setCupomErro('') }}
                    onKeyDown={e => { if (e.key === 'Enter') aplicarCupom() }} />
                  <button type="button" className="sc-cupom-bt" style={{ alignSelf: 'flex-end' }} onClick={aplicarCupom} disabled={!cupomDigitado.trim() || validandoCupom}>{validandoCupom ? '…' : 'Aplicar'}</button>
                </div>
                {cupomErro && <p className="sc-erro" role="alert">{cupomErro}</p>}
              </>
            ) : (
              <button type="button" className="sc-linha" onClick={() => setCupomAberto(true)}>
                <Tag size={20} weight="bold" /><span><b>Cupom</b><small>Tem um código? Coloque aqui</small></span><CaretRight size={18} weight="bold" />
              </button>
            ))}

            <div className="sc-valores">
              <b>Resumo de valores</b>
              <span>Subtotal<em>{formatCurrency(totalPrice)}</em></span>
              {desconto > 0 && <span className="ok">Cupom {cupomAplicado?.codigo}<em>− {formatCurrency(desconto)}</em></span>}
              {entregaTexto && <span>Entrega<em className={entregaGratis ? 'ok' : ''}>{entregaTexto}</em></span>}
              <span className="t">{rotuloTotal}<em>{formatCurrency(subtotalCupom)}</em></span>
            </div>
          </>
        )}
      </div>
      {items.length > 0 && (
        <footer className="sc-pe">
          <span className="sc-pe-tot"><small>{rotuloTotal}</small><b>{formatCurrency(subtotalCupom)}</b><em>{count} {count === 1 ? 'item' : 'itens'}</em></span>
          <button type="button" className="sc-bt-pri" style={{ background: accent }} onClick={() => setStep('finalizar')}>Continuar</button>
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
          <Cab t="Como você quer receber?" sub={opsEntrega.ret && opsEntrega.ent ? 'Escolha 1 opção' : undefined} obr ok={okReceber}
            falta={feErro === 'endereco' ? (config.entrega_por_bairro.length > 0 && !bairroSelecionado && rua.trim() && numero.trim() ? 'Escolha o bairro da entrega' : 'Preencha o endereço da entrega') : undefined} />
          <div className={`sc-receber${opsEntrega.ret && opsEntrega.ent ? '' : ' um'}`}>
            {opsEntrega.ret && (
              <button type="button" aria-pressed={formaEntrega === 'retirada'} style={formaEntrega === 'retirada' ? { borderColor: accent } : undefined}
                onClick={() => { setFormaEntrega('retirada'); setBairroSelecionado(''); setFeErro('') }}>
                <Storefront size={22} weight="bold" /><b>Retirar na loja</b><small>Grátis</small>
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
                      dica={cepLoading ? 'Procurando…' : undefined} erro={cepErro || undefined}
                      onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 8); setCep(v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v); buscarCep(v) }} />
                    <Campo rotulo="Número" inputMode="numeric" value={numero} onChange={e => setNumero(e.target.value)}
                      erro={feErro === 'endereco' && !numero.trim() ? 'Falta o número' : undefined} />
                  </div>
                  <Campo rotulo="Rua" autoComplete="address-line1" value={rua} onChange={e => setRua(e.target.value)}
                    erro={feErro === 'endereco' && !rua.trim() ? 'Falta a rua' : undefined} />
                  {config.entrega_por_bairro.length === 0 && <Campo rotulo="Bairro" value={bairro} onChange={e => setBairro(e.target.value)} />}
                  <Campo rotulo="Complemento" opcional placeholder="Apto, bloco…" value={complemento} onChange={e => setComplemento(e.target.value)} />
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
          <Cab t={`Quando? (${tipo})`} sub={regras.horas > 0 ? `Esse pedido precisa de ${antTexto} de antecedência` : `Escolha o dia e o horário da ${tipo}`} obr ok={okQuando}
            falta={feErro === 'agenda' ? 'Escolha a data e o horário pra continuar' : undefined} />
          <div className="sc-quando">
            <button type="button" className={`sc-campo${feErro === 'agenda' && !dataEntrega ? ' err' : ''}`} onClick={() => setCalAberto(true)}>
              <CalendarBlank size={20} weight="bold" /><span><small>Data</small><b className={dataEntrega ? '' : 'ph'}>{dataEntrega ? dataCurta(dataEntrega) : 'Escolher'}</b></span>
            </button>
            <button type="button" className={`sc-campo${feErro === 'agenda' && dataEntrega && !horaEntrega ? ' err' : ''}`} disabled={!dataEntrega} onClick={() => setHoraAberta(true)}>
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
              <Campo rotulo="Troco pra quanto?" opcional prefixo="R$" inputMode="decimal" value={trocoParaStr} onChange={e => setTrocoParaStr(e.target.value.replace(/[^0-9.,]/g, ''))} />
            </div>
          )}
        </section>

        {/* Seus dados */}
        <section ref={refDados}>
          <Cab t="Seus dados" sub="Pra loja falar com você" obr ok={okDados} falta={feErro === 'dados' ? 'Preencha o seu nome e o WhatsApp' : undefined} />
          <div className="sc-campos">
            <Campo rotulo="Nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Como você se chama?" autoComplete="name"
              erro={feErro === 'dados' && !nome.trim() ? 'Falta o seu nome' : undefined} />
            <Campo rotulo="WhatsApp" value={telefone} inputMode="tel" autoComplete="tel" placeholder="(00) 90000-0000"
              erro={feErro === 'dados' && telefone.replace(/\D/g, '').length < 10 ? 'Coloque o número com DDD' : undefined}
              onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(0, 11); setTelefone(d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d) }} />
          </div>
        </section>

        {/* Recado */}
        <section>
          <Cab t="Recado pra loja" sub="Opcional" />
          <div className="sc-campos">
            <CampoArea rotulo="Recado" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder={ehEntrega ? 'Ex.: tocar a campainha do portão' : 'Ex.: vou mandar outra pessoa buscar'} rows={3} />
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
          onEscolher={(iso) => { setDataEntrega(iso); setHoraEntrega(''); setFeErro(''); setTimeout(() => setHoraAberta(true), 250) }}
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
export function NavigationMenu({ corBotao }: { corBotao?: string }) {
  const { items, totalPrice, updateQuantity, updateObservations, removeItem, clearCart } = useCart()
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<'cart' | 'finalizar'>('cart')
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
  const isMobile = useIsMobile()

  const [config, setConfig] = useState<CheckoutConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cardapio_checkout_config')
      if (raw) setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(raw) })
    } catch {}
  }, [isOpen])

  useEffect(() => {
    const handler = () => setIsOpen(true)
    window.addEventListener('open-cart', handler)
    return () => window.removeEventListener('open-cart', handler)
  }, [])

  const count = contarItens(items)
  const accent = corBotao || '#ea1d2c'

  const handleClose = () => { setIsOpen(false); setStep('cart') }

  // Sacola (08/10 · 3.30): Esc e o voltar do Android fecham; no finalizar, o voltar volta pra sacola
  const caixaRef = useRef<HTMLDivElement>(null)
  useSobreposicao(isOpen, handleClose, caixaRef)
  useSobreposicao(isOpen && step === 'finalizar', () => setStep('cart'), caixaRef)

  const sharedProps = {
    step, setStep, items, totalPrice,
    updateQuantity, updateObservations, removeItem, clearCart,
    config, onClose: handleClose, corBotao: accent,
  }

  return (
    <>
      <style>{`
        /* 08/10 · 3.28: menu de baixo (vinho, igual ao do app) e o botão do pedido na cor da loja */
        .cpn-pe { pointer-events: none; }
        .cpn-pe > * { pointer-events: auto; }
        .cpn-pedido { display: flex; align-items: center; gap: 12px; width: calc(100% - 16px); min-height: 56px; margin: 0 8px 8px; padding: 8px 12px; border: 0; border-radius: 16px; color: #fff; font-family: inherit; text-align: left; box-shadow: 0 8px 24px rgba(44,18,25,.22); cursor: pointer; }
        .cpn-pedido-ic { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px; background: rgba(255,255,255,.2); flex: none; }
        .cpn-pedido-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .cpn-pedido-tx b { font-size: 15px; font-weight: 700; line-height: 1.25; }
        .cpn-pedido-tx small { font-size: 13px; opacity: .9; }
        .cpn-pedido strong { font-size: 16px; font-weight: 700; }
        .cpn-menu { display: flex; padding-bottom: env(safe-area-inset-bottom, 0px); background: #2C1219; box-shadow: 0 -2px 12px rgba(0,0,0,.12); }
        .cpn-menu button { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 60px; margin: 0; border: 0; background: none; color: rgba(255,255,255,.62); font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .cpn-ic { display: flex; align-items: center; justify-content: center; width: 52px; height: 30px; border-radius: 12px; }
        .cpn-menu button[aria-current="page"] { color: #fff; font-weight: 700; }
        .cpn-menu button[aria-current="page"] .cpn-ic { background: rgba(255,255,255,.16); }
      `}</style>

      {/* ═══ MOBILE: tab bar + cart vindo de baixo ═══ */}
      {isMobile && (
        <>
          <div ref={rodapeRef} className="cpn-pe fixed bottom-0 left-0 right-0 z-30">
            {count > 0 && (
              <button type="button" className="cpn-pedido" style={{ background: accent }} onClick={() => setIsOpen(true)}>
                <span className="cpn-pedido-ic"><ShoppingBag size={20} color="white" /></span>
                <span className="cpn-pedido-tx"><b>Ver seu pedido</b><small>{count} {count === 1 ? 'item' : 'itens'}</small></span>
                <strong>{formatCurrency(totalPrice)}</strong>
                <ChevronRight size={18} color="rgba(255,255,255,0.8)" />
              </button>
            )}

            <nav className="cpn-menu" aria-label="Menu do cardápio">
              {[
                { id: 'inicio',   label: 'Início',  icon: <Home size={24} /> },
                { id: 'pedidos',  label: 'Pedidos', icon: <ClipboardList size={24} /> },
                { id: 'perfil',   label: 'Minha conta',  icon: <User size={24} /> },
              ].map(({ id, label, icon }) => (
                <button key={id} type="button" aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)}>
                  <span className="cpn-ic">{icon}</span>{label}
                </button>
              ))}
            </nav>
          </div>

          {/* Painel Perfil */}
          {activeTab === 'perfil' && (
            /* Termina em cima do menu de baixo (antes cobria o menu e o cliente não conseguia voltar) */
            <div style={{position:'fixed',top:0,left:0,right:0,bottom:alturaRodape,zIndex:200,background:'#fff',display:'flex',flexDirection:'column',overflowY:'auto'}}>
              <div style={{flexShrink:0,height:'env(safe-area-inset-top, 0px)'}} />
              <PerfilTab accent={accent} confeteiraUserId={localStorage.getItem('cardapio_user_id') || ''} />
            </div>
          )}

          {/* Painel Pedidos */}
          {activeTab === 'pedidos' && (
            <div style={{position:'fixed',top:0,left:0,right:0,bottom:alturaRodape,zIndex:200,background:'#fff',display:'flex',flexDirection:'column',overflowY:'auto'}}>
              <div style={{flexShrink:0,height:'env(safe-area-inset-top, 0px)'}} />
              <PedidosTab
                accent={accent}
                confeteiraUserId={localStorage.getItem('cardapio_user_id') || ''}
                onIrParaPerfil={() => setActiveTab('perfil')}
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

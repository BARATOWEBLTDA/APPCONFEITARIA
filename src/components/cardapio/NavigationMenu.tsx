import CalendarioApp from '@/components/CalendarioSheet'
import { useState, useEffect, useMemo, useRef } from 'react'
import { CalendarioSheet, HorariosSheet } from '@/components/cardapio/AgendaSheets'
import { antecedenciaHoras, calcularRegras, primeiraData, rotuloData } from '@/lib/agendaCardapio'
import { supabase } from '@/lib/supabase'
import { ShoppingBag, X, MessageCircle, Trash2, Home, Tag, ClipboardList, User, ChevronRight, Minus, Plus, MapPin } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { CartItemComponent } from '@/components/cart/CartItemComponent'
import { formatCurrency } from '@/utils/helpers'
import { useIsMobile } from '@/hooks/use-mobile'
import { PerfilTab } from './PerfilTab'
import { PedidosTab } from './PedidosTab'
import HorarioSheet from '@/components/HorarioSheet'
import { itemDoCarrinhoParaPedido } from '@/lib/itemDoCarrinho'

interface CheckoutConfig {
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

const LABEL_ENTREGA: Record<string, { icon: string; label: string }> = {
  retirada:         { icon: '🏪', label: 'Retirar no local' },
  entrega_propria:  { icon: '🚗', label: 'Entrega própria' },
  motoboy:          { icon: '🏍️', label: 'Motoboy' },
  uber_flash:       { icon: '🚀', label: 'Uber Flash' },
  combinar:         { icon: '💬', label: 'Combinar pelo WhatsApp' },
}

const LABEL_PAGAMENTO: Record<string, { icon: string; label: string }> = {
  pix:              { icon: '⚡', label: 'Pix' },
  dinheiro:         { icon: '💵', label: 'Dinheiro' },
  credito:          { icon: '💳', label: 'Cartão de Crédito' },
  debito:           { icon: '💳', label: 'Cartão de Débito' },
  link_pagamento:   { icon: '🔗', label: 'Link de Pagamento' },
  mercado_pago:     { icon: '🟦', label: 'Mercado Pago' },
  pagamento_retirada: { icon: '🏪', label: 'Pagamento na Retirada' },
}

function SectionHeader({ title, subtitle }: { icon?: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div style={{marginBottom:'10px'}}>
      <p style={{margin:0,fontWeight:700,fontSize:'14px',color:'#3e3e3e'}}>{title}</p>
      {subtitle && <p style={{margin:'2px 0 0',fontSize:'12px',color:'#a0a0a0'}}>{subtitle}</p>}
    </div>
  )
}

function OptionButton({ selected, label, detail, onClick, accent }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        width:'100%', display:'flex', alignItems:'center',
        padding:'12px 14px', borderRadius:'10px',
        border: selected ? `2px solid ${accent||'#ea1d2c'}` : '1.5px solid #f0f0f0',
        background: selected ? '#fff' : '#fff',
        cursor:'pointer', textAlign:'left',
        transition:'all 0.15s',
      }}
    >
      <span style={{flex:1,fontWeight:selected?700:500,fontSize:'14px',color:selected?'#3e3e3e':'#717171'}}>
        {label}
      </span>
      {detail && <span style={{fontSize:'13px',fontWeight:600,color:'#a0a0a0',marginRight:'8px'}}>{detail}</span>}
      {selected && <div style={{width:'18px',height:'18px',borderRadius:'50%',background:accent||'#ea1d2c',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>}
    </button>
  )
}

function Divider() {
  return <div style={{height:'8px',background:'#f5f5f5',margin:'0 -20px'}} />
}

/* ─── Conteúdo interno do carrinho (reutilizado em mobile e desktop) ─── */
function CartContent({
  step, setStep, items, totalPrice, updateQuantity, updateObservations, removeItem, clearCart,
  config, onClose, corBotao,
}: any) {
  const [dataEntrega, setDataEntrega] = useState('')
  const [horaEntrega, setHoraEntrega] = useState('')
  const [horaSheetAberto, setHoraSheetAberto] = useState(false)
  const [calCardapio, setCalCardapio] = useState(false) // calendário do app
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
  const [pedidoConfirmado, setPedidoConfirmado] = useState<{numero: number; itens: any[]; whatsapp: string; storeName: string} | null>(null)
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
  const irPara = (r: any) => setTimeout(() => r.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  const enviarFinalizar = () => {
    let falta: typeof feErro = ''
    if (!dataEntrega || !horaEntrega) falta = 'agenda'
    else if (ehEntrega && formaEntrega !== 'combinar' && (!rua.trim() || !numero.trim() || (config.entrega_por_bairro.length > 0 && !bairroSelecionado))) falta = 'endereco'
    else if (!formaPagamento) falta = 'pagamento'
    else if (!nome.trim() || telefone.replace(/\D/g, '').length < 10) falta = 'dados'
    setFeErro(falta)
    if (falta) { irPara({ agenda: refAgenda, endereco: refEndereco, pagamento: refPagamento, dados: refDados }[falta]); return }
    enviarPedido()
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

  const count = items.reduce((acc: number, i: any) => acc + (i.saleType === 'kg' ? 1 : Math.floor(i.quantity)), 0)

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

  const minDate = useMemo(() => {
    const d = new Date()
    d.setHours(d.getHours() + (Number(config.prazo_minimo_horas) || 0))
    // Data no fuso do aparelho (toISOString é UTC e, depois das 21h, pulava pro dia seguinte)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [config.prazo_minimo_horas])

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
    if (!nome.trim()) return alert('Preencha seu nome')
    if (!telefone.trim()) return alert('Preencha seu WhatsApp')
    if (config.aceita_agendamento && !dataEntrega) return alert('Selecione a data de entrega')
    if (config.aceita_agendamento && !horaEntrega) return alert('Selecione o horário')
    if (!formaEntrega) return alert('Selecione a forma de entrega')
    if (!formaPagamento) return alert('Selecione a forma de pagamento')

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

      let m = `Oi, *${storeName}*! Acabei de fazer um pedido pelo cardápio 🧁\n\n`
      if (numPedido) m += `*PEDIDO #${numPedido}*\n\n`

      items.forEach((item: any) => {
        const qtd = item.saleType === 'kg' ? `${item.quantity} kg` : `${item.quantity}×`
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
      }

      if (observacoes.trim()) m += `\n*Observação:* ${observacoes.trim()}\n`
      m += `\n*Cliente:* ${nome.trim()} · ${telefone.trim()}`
      return m
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
            endereco_rua: formaEntrega === 'entrega_propria' ? rua : null,
            endereco_numero: formaEntrega === 'entrega_propria' ? numero : null,
            endereco_complemento: formaEntrega === 'entrega_propria' ? complemento : null,
            endereco_bairro: formaEntrega === 'entrega_propria' ? bairro : null,
            endereco_cidade: formaEntrega === 'entrega_propria' ? cidade : null,
            endereco_cep: formaEntrega === 'entrega_propria' ? cep.replace(/\D/g,'') : null,
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
    setPedidoConfirmado({ numero: numeroPedido, itens: items, whatsapp: whatsappUrl, storeName })
  }

  const accent = corBotao || '#ea1d2c'

  return (
    <>
      {/* ═══ TELA DE SUCESSO — fullscreen rosa ═══ */}
      {pedidoConfirmado && (
        <div style={{
          position:'fixed',inset:0,zIndex:500,
          background:accent,
          display:'flex',alignItems:'center',justifyContent:'center',
          padding:'24px',
          animation:'fadeIn 0.25s ease',
        }}>
          <div style={{
            background:'#fff',borderRadius:'24px',
            width:'420px',maxWidth:'100%',maxHeight:'90vh',overflowY:'auto',
            padding:'32px 24px',textAlign:'center',
            boxShadow:'0 24px 64px rgba(0,0,0,0.25)',
            animation:'successPop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
            display:'flex',flexDirection:'column',gap:'12px',alignItems:'center',
          }}>
            <div style={{width:'80px',height:'80px',borderRadius:'50%',background:'#22c55e',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'4px',animation:'checkPop 0.5s 0.2s both cubic-bezier(0.34,1.56,0.64,1)'}}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p style={{margin:0,fontWeight: 700,fontSize:'24px',color:'#3e3e3e'}}>Pedido Enviado!</p>
            <p style={{margin:0,fontSize:'14px',color:'#a0a0a0'}}>Agradecemos sua preferência!</p>
            {pedidoConfirmado.numero > 0 && (
              <p style={{margin:0,fontWeight:700,fontSize:'17px',color:accent}}>Pedido #{pedidoConfirmado.numero}</p>
            )}

            {/* Resumo */}
            <div style={{background:'#f9fafb',borderRadius:'14px',padding:'16px',width:'100%',textAlign:'left',marginTop:'4px',boxSizing:'border-box'}}>
              <p style={{margin:'0 0 10px',fontSize:'12px',fontWeight:700,color:'#a0a0a0',textTransform:'uppercase',letterSpacing:'0.05em'}}>Resumo do pedido</p>
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                {pedidoConfirmado.itens.map((item: any, i: number) => (
                  <div key={i} style={{display:'flex',justifyContent:'space-between',gap:'10px'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{margin:0,fontSize:'14px',fontWeight:600,color:'#3e3e3e'}}>
                        {item.saleType === 'kg' ? '' : `${item.quantity}x `}{item.name}
                      </p>
                      {(() => {
                        // Escolhas do item na tela de "Pedido enviado": antes faltavam o tamanho e o kit
                        const e: any = item.escolhas
                        const ls: string[] = []
                        if (e) {
                          if (e.tamanho?.nome) ls.push(`Tamanho: ${e.tamanho.nome}`)
                          if (e.sabor?.nome) ls.push(`Sabor: ${e.sabor.nome}`)
                          if (e.massa?.nome) ls.push(`Massa: ${e.massa.nome}`)
                          if (e.recheios?.length) ls.push(`Recheio: ${e.recheios.map((r: any) => r.nome).join(', ')}`)
                          if (e.cobertura?.nome) ls.push(`Cobertura: ${e.cobertura.nome}`)
                          if (e.kit?.sabores?.length) ls.push(`Kit ${e.kit.total} un: ${e.kit.sabores.map((x: any) => `${x.nome} × ${x.qtd}`).join(', ')}`)
                        } else {
                          if (item.selectedMassa) ls.push(`Massa: ${item.selectedMassa}`)
                          if (item.selectedRecheio) ls.push(`Recheio: ${item.selectedRecheio}`)
                          if (item.selectedCobertura) ls.push(`Cobertura: ${item.selectedCobertura}`)
                        }
                        return ls.length ? (
                          <div style={{marginTop:'2px',display:'flex',flexDirection:'column',gap:'1px'}}>
                            {ls.map((l, k) => <span key={k} style={{fontSize:'12px',color:'#a0a0a0'}}>{l}</span>)}
                          </div>
                        ) : null
                      })()}
                      {item.observations && (
                        <p style={{margin:'2px 0 0',fontSize:'12px',color:'#a0a0a0',fontStyle:'italic'}}>Obs: {item.observations}</p>
                      )}
                    </div>
                    <span style={{fontSize:'14px',fontWeight:700,color:'#3e3e3e',whiteSpace:'nowrap'}}>
                      {formatCurrency(item.price * (item.saleType === 'kg' ? item.quantity : item.quantity))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mensagem da loja */}
            <div style={{background:`${accent}10`,border:`1.5px solid ${accent}30`,borderRadius:'14px',padding:'14px',width:'100%',textAlign:'left',boxSizing:'border-box'}}>
              <p style={{margin:0,fontSize:'13px',color:'#3e3e3e',lineHeight:'1.5'}}>
                A loja <strong>{pedidoConfirmado.storeName}</strong> entrará em contato com você pelo WhatsApp informado em breve.
              </p>
              <p style={{margin:'8px 0 0',fontSize:'12px',color:'#717171'}}>
                Se quiser agilizar, envie uma mensagem para a loja:
              </p>
            </div>

            <button
              onClick={() => window.open(pedidoConfirmado.whatsapp, '_blank')}
              className="wa-btn-gradient"
              style={{width:'100%',padding:'14px',color:'white',border:'none',borderRadius:'14px',fontWeight:700,fontSize:'15px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',fontFamily:'inherit',marginTop:'4px',boxSizing:'border-box'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.004c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.84 14.07c-.25.7-1.45 1.35-2 1.43-.51.08-1.16.11-1.87-.12-.43-.14-.98-.32-1.69-.63-2.97-1.28-4.91-4.26-5.06-4.46-.15-.2-1.21-1.61-1.21-3.07s.76-2.18 1.03-2.47c.27-.3.59-.37.79-.37.2 0 .39 0 .56.01.18.01.42-.07.66.5.25.6.84 2.07.91 2.22.07.15.12.33.02.53-.1.2-.15.33-.3.5-.15.18-.31.4-.45.54-.15.15-.3.31-.13.61.17.3.76 1.25 1.63 2.02 1.12 1 2.06 1.31 2.36 1.46.3.15.48.13.65-.08.18-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.72.81 2.02.96.3.15.5.22.57.35.07.13.07.74-.18 1.44z"/></svg>
              Enviar mensagem no WhatsApp
            </button>
            <style>{`
              .wa-btn-gradient {
                background: linear-gradient(270deg, #25D366, #1ebe5d, #25D366, #2bd96e);
                background-size: 300% 300%;
                animation: waGradientMove 4s ease infinite;
              }
              @keyframes waGradientMove {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
            `}</style>

            <button
              onClick={() => { setPedidoConfirmado(null); onClose() }}
              style={{width:'100%',padding:'12px',background:'#f5f5f5',color:'#717171',border:'none',borderRadius:'14px',fontWeight:600,fontSize:'14px',cursor:'pointer',fontFamily:'inherit',boxSizing:'border-box'}}>
              Voltar ao cardápio
            </button>
          </div>
        </div>
      )}

      {!pedidoConfirmado && (<>
      {/* ═══ CART STEP ═══ */}
      {step === 'cart' && (
        <>
          <div className="ck-scroll" style={{flex:1,overflowY:'auto',padding:'12px 20px',display:'flex',flexDirection:'column',gap:'8px'}}>
            {items.length === 0 ? (
              <div style={{textAlign:'center',padding:'48px 20px'}}>
                <div style={{width:'72px',height:'72px',borderRadius:'50%',background:'#f5f5f5',margin:'0 auto 16px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <ShoppingBag size={32} color="#d4d4d4" />
                </div>
                <p style={{margin:0,fontWeight:700,fontSize:'16px',color:'#3e3e3e'}}>Seu pedido está vazio</p>
                <p style={{margin:'8px 0 0',fontSize:'14px',color:'#a0a0a0'}}>Adicione itens para fazer seu pedido</p>
              </div>
            ) : (
              items.map((item: any) => (
                <CartItemComponent key={item.lineId ?? item.id} item={item} onUpdateQuantity={updateQuantity} onUpdateObservations={updateObservations} onRemove={removeItem} />
              ))
            )}
          </div>

          {items.length > 0 && (
            <div style={{borderTop:'1px solid #f0f0f0',padding:'16px 20px',display:'flex',flexDirection:'column',gap:'10px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:'17px',fontWeight: 700,color:'#3e3e3e'}}>Total</span>
                <span style={{fontSize:'20px',fontWeight: 700,color:'#3e3e3e'}}>{formatCurrency(totalPrice)}</span>
              </div>
              <button
                onClick={() => setStep('finalizar')}
                style={{
                  width:'100%',padding:'15px',background:accent,color:'white',
                  border:'none',borderRadius:'14px',fontWeight: 700,fontSize:'16px',
                  cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',
                  boxShadow:`0 4px 16px ${accent}44`,fontFamily:'inherit',
                }}
              >
                Finalizar encomenda <ChevronRight size={18} />
              </button>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={onClose} style={{flex:1,padding:'12px',background:'transparent',border:'1.5px solid #e8e8e8',borderRadius:'12px',fontWeight:600,fontSize:'14px',color:'#717171',cursor:'pointer',fontFamily:'inherit'}}>
                  Continuar comprando
                </button>
                <button onClick={clearCart} style={{padding:'12px 16px',background:'transparent',border:'1.5px solid #fecaca',borderRadius:'12px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Trash2 size={16} color="#ef4444" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ FINALIZAR ENCOMENDA (02/10) — uma tela só ═══ */}
      {step === 'finalizar' && (
        <>
          <div className="fe-body">
            {/* Resumo do pedido */}
            <section className="fe-card">
              <p className="fe-tt">Resumo do pedido</p>
              {items.map((it: any, k: number) => (
                <div className="fe-rl" key={k}><span>{it.saleType === 'kg' ? `${it.quantity} kg` : `${it.quantity}×`} {it.name}{it.escolhas?.kit?.total ? ` · ${it.escolhas.kit.total} un.` : ''}{it.escolhas?.tamanho?.nome ? ` · ${it.escolhas.tamanho.nome}` : ''}</span><b>{formatCurrency(it.price * it.quantity)}</b></div>
              ))}
              {desconto > 0 && <div className="fe-rl fe-verde"><span>{cupomAplicado ? `Cupom ${cupomAplicado.codigo}` : 'Desconto'}</span><b>− {formatCurrency(desconto)}</b></div>}
              {ehEntrega && <div className="fe-rl"><span>Taxa de entrega</span><b>{freteValor > 0 ? formatCurrency(freteValor) : formaEntrega === 'entrega_propria' ? 'Grátis' : 'A combinar'}</b></div>}
              <div className="fe-rl fe-tot"><span>Total</span><b>{formatCurrency(totalFinal)}</b></div>
              {(config.tem_cupom || config.cupons_desconto.length > 0) && !cupomAplicado && (
                <div className="fe-cupom">
                  <input value={cupomDigitado} onChange={e => { setCupomDigitado(e.target.value.toUpperCase()); setCupomErro('') }} placeholder="Tem cupom? Digite aqui" />
                  <button type="button" onClick={aplicarCupom} disabled={!cupomDigitado.trim() || validandoCupom}>{validandoCupom ? '…' : 'Aplicar'}</button>
                </div>
              )}
              {cupomAplicado && <button type="button" className="fe-link" onClick={removerCupom}>Tirar o cupom {cupomAplicado.codigo}</button>}
              {cupomErro && <p className="fe-err">{cupomErro}</p>}
            </section>

            {/* Agendamento */}
            <section className="fe-card" ref={refAgenda}>
              <p className="fe-tt">Agendamento</p>
              {opsEntrega.ret && opsEntrega.ent && (
                <div className="fe-seg">
                  <button type="button" className={formaEntrega === 'retirada' ? 'on' : ''} onClick={() => { setFormaEntrega('retirada'); setBairroSelecionado('') }}>Retirada</button>
                  <button type="button" className={ehEntrega ? 'on' : ''} onClick={() => setFormaEntrega(opsEntrega.ent)}>Entrega</button>
                </div>
              )}
              {formaEntrega === 'retirada' && config.endereco_retirada && <p className="fe-nota">Retirar em: <b>{config.endereco_retirada}</b></p>}
              {regras.cortado && primeiraDisp && (
                <div className="fe-aviso">
                  <b>Pedido depois das {regras.fechamentoHoje}</b>
                  <small>A produção de amanhã já fechou. A primeira data disponível é <strong>{primeiraDisp.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}</strong>.</small>
                </div>
              )}

              {/* Endereço (só na entrega) */}
              {ehEntrega && formaEntrega !== 'combinar' && (
                <div ref={refEndereco} className={`fe-end${feErro === 'endereco' ? ' fe-campo-err' : ''}`}>
                  <p className="fe-lb">Endereço da entrega</p>
                  <div className="fe-row">
                    <input className="fe-in fe-f2" inputMode="numeric" placeholder="CEP" value={cep}
                      onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 8); const m = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v; setCep(m); buscarCep(v) }} />
                    <input className="fe-in" inputMode="numeric" placeholder="Número" value={numero} onChange={e => setNumero(e.target.value)} />
                  </div>
                  {cepLoading && <p className="fe-nota">Procurando o CEP…</p>}
                  {cepErro && <p className="fe-err">{cepErro}</p>}
                  <input className="fe-in" placeholder="Rua" value={rua} onChange={e => setRua(e.target.value)} />
                  {config.entrega_por_bairro.length > 0 ? (
                    <>
                      <p className="fe-lb">Bairro</p>
                      <div className="fe-chips">
                        {config.entrega_por_bairro.map((b: any) => (
                          <button type="button" key={b.bairro} className={bairroSelecionado === b.bairro ? 'on' : ''} onClick={() => { setBairroSelecionado(b.bairro); setBairro(b.bairro) }}>
                            {b.bairro} · {formatCurrency(b.valor)}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <input className="fe-in" placeholder="Bairro" value={bairro} onChange={e => setBairro(e.target.value)} />
                  )}
                  <input className="fe-in" placeholder="Complemento (apto, bloco…)" value={complemento} onChange={e => setComplemento(e.target.value)} />
                  {feErro === 'endereco' && <p className="fe-err">Preencha a rua, o número{config.entrega_por_bairro.length > 0 ? ' e o bairro' : ''}.</p>}
                </div>
              )}

              {/* Data e horário — a caixa obrigatória */}
              <div className={`fe-agenda${dataEntrega && horaEntrega ? ' ok' : ''}${feErro === 'agenda' ? ' err' : ''}`}>
                <span className="fe-leg">{dataEntrega && horaEntrega ? '✓ Agendado' : 'Obrigatório'}</span>
                <p className="fe-lb">Data da {formaEntrega === 'retirada' ? 'retirada' : 'entrega'}</p>
                <button type="button" className="fe-campo" onClick={() => setCalAberto(true)}>
                  <span className="fe-ci"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg></span>
                  <span className={dataEntrega ? '' : 'fe-ph'}>{dataEntrega ? rotuloData(dataEntrega) : 'Escolher a data'}</span>
                  <span className="fe-cd"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span>
                </button>
                <p className="fe-lb">Horário</p>
                <button type="button" className="fe-campo" disabled={!dataEntrega} onClick={() => setHoraAberta(true)}>
                  <span className="fe-ci"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>
                  <span className={horaEntrega ? '' : 'fe-ph'}>{horaEntrega || (dataEntrega ? 'Escolher o horário' : 'Escolha a data primeiro')}</span>
                  <span className="fe-cd"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span>
                </button>
                {regras.horas > 0 && <p className="fe-nota fe-nota--ag">Esse pedido precisa de {regras.horas >= 48 && regras.horas % 24 === 0 ? `${regras.horas / 24} dias` : `${regras.horas}h`} de antecedência.</p>}
                {feErro === 'agenda' && <p className="fe-err">Escolha a data e o horário da {formaEntrega === 'retirada' ? 'retirada' : 'entrega'}</p>}
              </div>
            </section>

            {/* Pagamento */}
            <section className={`fe-card${feErro === 'pagamento' ? ' fe-card-err' : ''}`} ref={refPagamento}>
              <p className="fe-tt">Pagamento</p>
              <p className="fe-pg">Pagamento na {formaEntrega === 'retirada' ? 'retirada' : 'entrega'} do pedido</p>
              <div className="fe-chips">
                {metodosPag.map((k: string) => (
                  <button type="button" key={k} className={formaPagamento === k ? 'on' : ''} onClick={() => { setFormaPagamento(k); setFeErro('') }}>
                    {({ pix: 'Pix', dinheiro: 'Dinheiro', credito: 'Cartão de crédito', debito: 'Cartão de débito' } as any)[k]}
                  </button>
                ))}
              </div>
              {formaPagamento === 'dinheiro' && config.exibir_campo_troco && (
                <input className="fe-in" inputMode="decimal" placeholder="Troco pra quanto? (opcional)" value={trocoParaStr} onChange={e => setTrocoParaStr(e.target.value)} />
              )}
              {feErro === 'pagamento' && <p className="fe-err">Escolha como vai pagar</p>}
            </section>

            {/* Seus dados */}
            <section className={`fe-card${feErro === 'dados' ? ' fe-card-err' : ''}`} ref={refDados}>
              <p className="fe-tt">Seus dados</p>
              <p className="fe-lb">Nome completo</p>
              <input className="fe-in" value={nome} onChange={e => setNome(e.target.value)} placeholder="Como você se chama?" autoComplete="name" />
              <p className="fe-lb">WhatsApp / celular</p>
              <input className="fe-in" value={telefone} inputMode="tel" autoComplete="tel" placeholder="(00) 9 0000-0000"
                onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(0, 11); setTelefone(d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d) }} />
              <p className="fe-lb">Observação <em>(opcional)</em></p>
              <textarea className="fe-in fe-ta" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Algum recado pra confeitaria?" />
              {feErro === 'dados' && <p className="fe-err">Preencha o seu nome e o WhatsApp</p>}
            </section>
          </div>

          <div className="fe-foot">
            <button type="button" className="fe-enviar" onClick={enviarFinalizar}>Enviar pedido · {formatCurrency(totalFinal)}</button>
          </div>

          {calAberto && (
            <CalendarioSheet titulo={`Data da ${formaEntrega === 'retirada' ? 'retirada' : 'entrega'}`} horario={config.horario} minimo={regras.minimo} valor={dataEntrega}
              onEscolher={(iso) => { setDataEntrega(iso); setHoraEntrega(''); setFeErro(''); setTimeout(() => setHoraAberta(true), 250) }}
              onClose={() => setCalAberto(false)} />
          )}
          {horaAberta && dataEntrega && (
            <HorariosSheet data={dataEntrega} horario={config.horario} minimo={regras.minimo} valor={horaEntrega}
              onEscolher={(h) => { setHoraEntrega(h); setFeErro('') }} onClose={() => setHoraAberta(false)} />
          )}
          <style>{FE_CSS}</style>
        </>
      )}

      {/* ═══ DADOS STEP ═══ */}
      {step === 'dados' && (
        <>
          <div className="ck-scroll" style={{flex:1,overflowY:'auto',padding:'24px 24px 8px'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              <div>
                <label style={{fontSize:'13px',fontWeight:600,color:'#717171',display:'block',marginBottom:'8px'}}>Seu nome</label>
                <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Como podemos te chamar?"
                  style={{width:'100%',padding:'16px',border:'2px solid #f0f0f0',borderRadius:'12px',fontSize:'16px',color:'#3e3e3e',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
                  onFocus={e=>(e.target.style.borderColor=accent)} onBlur={e=>(e.target.style.borderColor='#f0f0f0')} />
              </div>
              <div>
                <label style={{fontSize:'13px',fontWeight:600,color:'#717171',display:'block',marginBottom:'8px'}}>WhatsApp</label>
                <input value={telefone} onChange={e => {
                  const v = e.target.value.replace(/\D/g,'').slice(0,11)
                  let f = v
                  if (v.length > 10) f = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`
                  else if (v.length > 6) f = `(${v.slice(0,2)}) ${v.slice(2,6)}-${v.slice(6)}`
                  else if (v.length > 2) f = `(${v.slice(0,2)}) ${v.slice(2)}`
                  else if (v.length > 0) f = `(${v}`
                  setTelefone(f)
                }} placeholder="(00) 9 0000-0000" type="tel" inputMode="numeric"
                  style={{width:'100%',padding:'16px',border:'2px solid #f0f0f0',borderRadius:'12px',fontSize:'16px',color:'#3e3e3e',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
                  onFocus={e=>(e.target.style.borderColor=accent)} onBlur={e=>(e.target.style.borderColor='#f0f0f0')} />
              </div>
            </div>
          </div>
          <div style={{padding:'16px 24px 24px',borderTop:'1px solid #f0f0f0'}}>
            <button
              onClick={() => {
                if (!nome.trim()) return alert('Preencha seu nome')
                if (!telefone.trim() || telefone.replace(/\D/g,'').length < 10) return alert('Preencha seu WhatsApp')
                setStep('entrega')
              }}
              style={{width:'100%',padding:'16px',background:accent,color:'white',border:'none',borderRadius:'14px',fontWeight: 700,fontSize:'16px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',fontFamily:'inherit'}}>
              Continuar <ChevronRight size={18} />
            </button>
          </div>
        </>
      )}

      {/* ═══ ENTREGA STEP ═══ */}
      {step === 'entrega' && (
        <>
          <div className="ck-scroll" style={{flex:1,overflowY:'auto',padding:'20px',display:'flex',flexDirection:'column',gap:'16px'}}>
            {/* Data e horário */}
            {config.aceita_agendamento && (
              <div>
                <SectionHeader title="Data e horário" />
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                  <div>
                    <label style={{fontSize:'12px',fontWeight:600,color:'#717171',display:'block',marginBottom:'6px'}}>Data</label>
                    <button type="button" onClick={() => setCalCardapio(true)} style={{position:'relative',display:'flex',alignItems:'center',width:'100%',padding:'12px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'14px',color: dataEntrega ? '#3e3e3e' : '#a0a0a0',background:'#fff',cursor:'pointer',boxSizing:'border-box',fontFamily:'inherit',textAlign:'left'}}>
                      {dataEntrega ? new Date(dataEntrega + 'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric'}) : 'Definir data'}
                    </button>
                    {calCardapio && <CalendarioApp valor={dataEntrega} min={minDate} cor={accent} titulo="Data da entrega" onClose={() => setCalCardapio(false)} onConfirmar={d => { setDataEntrega(d); setCalCardapio(false) }} />}
                  </div>
                  <div>
                    <label style={{fontSize:'12px',fontWeight:600,color:'#717171',display:'block',marginBottom:'6px'}}>Horário</label>
                    {/* Mesmo seletor que sobe de baixo pra cima do app da confeiteira */}
                    <button type="button" onClick={() => setHoraSheetAberto(true)}
                      style={{width:'100%',display:'flex',alignItems:'center',gap:'8px',padding:'12px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'14px',color: horaEntrega ? '#3e3e3e' : '#a0a0a0',background:'#fff',cursor:'pointer',boxSizing:'border-box',fontFamily:'inherit',textAlign:'left'}}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" style={{flexShrink:0}}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                      {horaEntrega || 'Definir hora'}
                    </button>
                    {horaSheetAberto && (
                      <HorarioSheet
                        titulo="Horário"
                        value={horaEntrega}
                        onChange={(v) => setHoraEntrega(v)}
                        onClose={() => setHoraSheetAberto(false)}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Forma de entrega */}
            <div>
              <SectionHeader title="Forma de entrega" />
              <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                {/* Só as formas que a loja configurou no Checkout (antes eram sempre Retirada e Entrega) */}
                {(config.formas_entrega?.length ? config.formas_entrega : ['retirada']).includes('retirada') && (
                <OptionButton selected={formaEntrega==='retirada'} label="Retirar no local" detail="Grátis" accent={accent} onClick={() => { setFormaEntrega('retirada'); setBairroSelecionado('') }} />
                )}
                {(config.formas_entrega || []).includes('entrega_propria') && (
                <OptionButton selected={formaEntrega==='entrega_propria'} label="Entrega" detail={config.valor_entrega_propria > 0 ? formatCurrency(config.valor_entrega_propria) : 'Grátis'} accent={accent} onClick={() => { setFormaEntrega('entrega_propria'); setBairroSelecionado('') }} />
                )}
                {(config.formas_entrega || []).filter((k: string) => ['motoboy', 'uber_flash', 'combinar'].includes(k)).map((k: string) => (
                  <OptionButton key={k} selected={formaEntrega === k} label={LABEL_ENTREGA[k]?.label || k} detail="Valor a combinar" accent={accent} onClick={() => { setFormaEntrega(k); setBairroSelecionado('') }} />
                ))}
              </div>
              {formaEntrega === 'entrega_propria' && config.entrega_por_bairro.length > 0 && (
                <div style={{marginTop:'10px'}}>
                  <select value={bairroSelecionado} onChange={e => setBairroSelecionado(e.target.value)}
                    style={{width:'100%',padding:'12px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'14px',color:'#3e3e3e',outline:'none',background:'#fff',fontFamily:'inherit'}}>
                    <option value="">Escolha o bairro</option>
                    {config.entrega_por_bairro.map((b: any) => <option key={b.bairro} value={b.bairro}>{b.bairro} — {formatCurrency(b.valor)}</option>)}
                  </select>
                </div>
              )}

              {formaEntrega === 'entrega_propria' && (
                <div style={{marginTop:'12px',display:'flex',flexDirection:'column',gap:'8px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',margin:'4px 0'}}>
                    <div style={{flex:1,height:'1px',background:'#f0f0f0'}} />
                    <span style={{fontSize:'11px',fontWeight:600,color:'#a0a0a0',whiteSpace:'nowrap'}}>Endereço de entrega</span>
                    <div style={{flex:1,height:'1px',background:'#f0f0f0'}} />
                  </div>

                  {/* Endereços salvos */}
                  {(() => {
                    const userId = localStorage.getItem('cardapio_user_id') || ''
                    const telCliente = localStorage.getItem(`cardapio_cliente_${userId}`) ? JSON.parse(localStorage.getItem(`cardapio_cliente_${userId}`)!).telefone : ''
                    const key = `enderecos_${userId}_${telCliente.replace(/\D/g,'')}`
                    const saved = (() => { try { return JSON.parse(localStorage.getItem(key)||'[]') } catch { return [] } })()
                    if (saved.length === 0) return null
                    return (
                      <div style={{display:'flex',flexDirection:'column',gap:'6px',marginBottom:'4px'}}>
                        <p style={{margin:0,fontSize:'11px',fontWeight:600,color:'#a0a0a0'}}>Endereços salvos</p>
                        {saved.map((e: any, i: number) => (
                          <button key={i} type="button"
                            onClick={() => { setRua(e.rua); setNumero(e.numero); setComplemento(e.complemento); setBairro(e.bairro); setCidade(e.cidade); setCep(e.cep) }}
                            style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',border:`1.5px solid ${rua===e.rua&&numero===e.numero?accent:'#f0f0f0'}`,borderRadius:'10px',background:rua===e.rua&&numero===e.numero?`${accent}08`:'#fff',cursor:'pointer',textAlign:'left',width:'100%',fontFamily:'inherit'}}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={rua===e.rua&&numero===e.numero?accent:'#a0a0a0'} strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            <div>
                              <p style={{margin:0,fontSize:'13px',fontWeight:600,color:'#3e3e3e'}}>{e.rua}, {e.numero}</p>
                              <p style={{margin:0,fontSize:'11px',color:'#a0a0a0'}}>{e.bairro}{e.cidade?` · ${e.cidade}`:''}</p>
                            </div>
                          </button>
                        ))}
                        <div style={{display:'flex',alignItems:'center',gap:'8px',margin:'4px 0'}}>
                          <div style={{flex:1,height:'1px',background:'#f0f0f0'}} />
                          <span style={{fontSize:'11px',color:'#a0a0a0'}}>ou preencha manualmente</span>
                          <div style={{flex:1,height:'1px',background:'#f0f0f0'}} />
                        </div>
                      </div>
                    )
                  })()}
                  {/* CEP */}
                  <div style={{position:'relative'}}>
                    <input
                      value={cep} placeholder="CEP" inputMode="numeric"
                      onChange={e => {
                        let v = e.target.value.replace(/\D/g,'').slice(0,8)
                        if (v.length > 5) v = v.slice(0,5)+'-'+v.slice(5)
                        setCep(v)
                        if (v.replace(/\D/g,'').length === 8) buscarCep(v)
                      }}
                      style={{width:'100%',padding:'14px',paddingRight:'40px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'15px',color:'#3e3e3e',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
                      onFocus={e=>(e.target.style.borderColor=accent)} onBlur={e=>(e.target.style.borderColor='#f0f0f0')} />
                    {cepLoading && <div style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',width:'16px',height:'16px',border:'2px solid #f0f0f0',borderTopColor:accent,borderRadius:'50%',animation:'spin 0.6s linear infinite'}} />}
                  </div>
                  {cepErro && <p style={{margin:0,fontSize:'12px',color:'#ef4444'}}>{cepErro}</p>}
                  {/* Rua + Número */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 80px',gap:'8px'}}>
                    <input value={rua} onChange={e=>setRua(e.target.value)} placeholder="Rua / Avenida"
                      style={{padding:'14px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'15px',color:'#3e3e3e',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
                      onFocus={e=>(e.target.style.borderColor=accent)} onBlur={e=>(e.target.style.borderColor='#f0f0f0')} />
                    <input value={numero} onChange={e=>setNumero(e.target.value)} placeholder="Nº"
                      style={{padding:'14px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'15px',color:'#3e3e3e',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
                      onFocus={e=>(e.target.style.borderColor=accent)} onBlur={e=>(e.target.style.borderColor='#f0f0f0')} />
                  </div>
                  <input value={complemento} onChange={e=>setComplemento(e.target.value)} placeholder="Complemento (apto, bloco...)"
                    style={{width:'100%',padding:'14px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'15px',color:'#3e3e3e',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
                    onFocus={e=>(e.target.style.borderColor=accent)} onBlur={e=>(e.target.style.borderColor='#f0f0f0')} />
                  <input value={bairro} onChange={e=>setBairro(e.target.value)} placeholder="Bairro"
                    style={{width:'100%',padding:'14px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'15px',color:'#3e3e3e',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
                    onFocus={e=>(e.target.style.borderColor=accent)} onBlur={e=>(e.target.style.borderColor='#f0f0f0')} />
                  <input value={cidade} onChange={e=>setCidade(e.target.value)} placeholder="Cidade"
                    style={{width:'100%',padding:'14px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'15px',color:'#3e3e3e',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
                    onFocus={e=>(e.target.style.borderColor=accent)} onBlur={e=>(e.target.style.borderColor='#f0f0f0')} />
                </div>
              )}
              {formaEntrega === 'retirada' && config.endereco_retirada && (
                <div style={{marginTop:'10px',padding:'10px 14px',background:'#f9fafb',borderRadius:'10px'}}>
                  <p style={{margin:0,fontSize:'13px',color:'#3e3e3e',fontWeight:600}}>{config.endereco_retirada}</p>
                  {config.horario_retirada && <p style={{margin:'2px 0 0',fontSize:'12px',color:'#717171'}}>{config.horario_retirada}</p>}
                </div>
              )}
            </div>
          </div>
          <div style={{padding:'14px 20px',borderTop:'1px solid #f0f0f0'}}>
            <button
              onClick={() => {
                if (config.aceita_agendamento && !dataEntrega) return alert('Selecione a data')
                if (config.aceita_agendamento && !horaEntrega) return alert('Selecione o horário')
                if (!formaEntrega) return alert('Selecione a forma de entrega')
                setStep('checkout')
              }}
              style={{width:'100%',padding:'15px',background:accent,color:'white',border:'none',borderRadius:'14px',fontWeight: 700,fontSize:'16px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',fontFamily:'inherit'}}>
              Continuar <ChevronRight size={18} />
            </button>
          </div>
        </>
      )}

      {/* ═══ CHECKOUT STEP (pagamento + obs) ═══ */}
      {step === 'checkout' && (
        <>
          <div className="ck-scroll" style={{flex:1,overflowY:'auto',padding:'20px',display:'flex',flexDirection:'column',gap:'16px'}}>
            {/* Pagamento */}
            <div>
              <SectionHeader title="Forma de pagamento" />
              <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                {/* Só as formas que a loja aceita (antes eram sempre Pix, Dinheiro, Crédito e Débito) */}
                {(config.formas_pagamento?.length ? config.formas_pagamento : ['pix']).filter((k: string) => LABEL_PAGAMENTO[k]).map((k: string) => (
                  <OptionButton key={k} selected={formaPagamento === k} label={k === 'pix' ? 'PIX' : LABEL_PAGAMENTO[k].label} accent={accent} onClick={() => setFormaPagamento(k)} />
                ))}
              </div>
              {formaPagamento==='dinheiro' && config.exibir_campo_troco && (
                <div style={{marginTop:'10px',display:'flex',alignItems:'center',gap:'8px'}}>
                  <span style={{fontSize:'14px',color:'#717171',fontWeight:600}}>R$</span>
                  <input value={trocoParaStr} onChange={e => setTrocoParaStr(e.target.value.replace(/[^0-9.,]/g,''))}
                    placeholder="Troco para quanto?" inputMode="decimal"
                    style={{flex:1,padding:'12px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'14px',color:'#3e3e3e',outline:'none',fontFamily:'inherit'}}
                    onFocus={e=>(e.target.style.borderColor=accent)} onBlur={e=>(e.target.style.borderColor='#f0f0f0')} />
                </div>
              )}
            </div>

            {/* Cupom */}
            {(config.tem_cupom || config.cupons_desconto.length > 0) && (
              <div>
                <SectionHeader title="Cupom de desconto" />
                {cupomAplicado ? (
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'#f0fdf4',border:'1.5px solid #bbf7d0',borderRadius:'10px'}}>
                    <span style={{fontWeight:700,fontSize:'14px',color:'#16a34a'}}>{cupomAplicado.codigo} — {cupomAplicado.tipo==='percentual'?`-${cupomAplicado.valor}%`:`-${formatCurrency(cupomAplicado.valor)}`}</span>
                    <button onClick={removerCupom} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:'13px',fontWeight:600}}>Remover</button>
                  </div>
                ) : (
                  <div style={{display:'flex',gap:'8px'}}>
                    <input value={cupomDigitado} onChange={e=>{setCupomDigitado(e.target.value.toUpperCase());setCupomErro('')}} placeholder="Código do cupom"
                      style={{flex:1,padding:'12px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'14px',color:'#3e3e3e',outline:'none',textTransform:'uppercase',fontFamily:'inherit'}}
                      onFocus={e=>(e.target.style.borderColor=accent)} onBlur={e=>(e.target.style.borderColor='#f0f0f0')} />
                    <button onClick={aplicarCupom} disabled={validandoCupom} style={{padding:'12px 20px',background:accent,color:'white',border:'none',borderRadius:'10px',fontWeight:700,fontSize:'14px',cursor:'pointer',fontFamily:'inherit'}}>{validandoCupom ? '...' : 'Aplicar'}</button>
                  </div>
                )}
                {cupomErro && <p style={{margin:'6px 0 0',fontSize:'12px',color:'#ef4444'}}>{cupomErro}</p>}
              </div>
            )}

            {/* Observações */}
            <div>
              <SectionHeader title="Observações" />
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)}
                placeholder='Personalização, restrições, recados...'
                rows={3}
                style={{width:'100%',padding:'12px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'14px',color:'#3e3e3e',outline:'none',resize:'none',boxSizing:'border-box',fontFamily:'inherit',lineHeight:'1.5'}}
                onFocus={e=>(e.target.style.borderColor=accent)} onBlur={e=>(e.target.style.borderColor='#f0f0f0')} />
            </div>
          </div>

          {/* Footer checkout */}
          <div style={{borderTop:'1px solid #f0f0f0',padding:'14px 20px',background:'#fff',display:'flex',flexDirection:'column',gap:'8px'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'3px'}}>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{fontSize:'13px',color:'#a0a0a0'}}>Subtotal ({count} {count===1?'item':'itens'})</span>
                <span style={{fontSize:'13px',color:'#a0a0a0'}}>{formatCurrency(totalPrice)}</span>
              </div>
              {desconto > 0 && (
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontSize:'13px',color:'#16a34a'}}>🏷️ Desconto</span>
                  <span style={{fontSize:'13px',color:'#16a34a',fontWeight:600}}>-{formatCurrency(desconto)}</span>
                </div>
              )}
              {formaEntrega && (
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontSize:'13px',color:'#a0a0a0'}}>🚚 Frete</span>
                  <span style={{fontSize:'13px',color:freteValor>0?'#a0a0a0':'#16a34a',fontWeight:freteValor>0?400:600}}>
                    {freteValor > 0 ? formatCurrency(freteValor) : 'Grátis'}
                  </span>
                </div>
              )}
              <div style={{display:'flex',justifyContent:'space-between',marginTop:'4px',paddingTop:'6px',borderTop:'1px solid #f0f0f0'}}>
                <span style={{fontSize:'17px',fontWeight: 700,color:'#3e3e3e'}}>Total</span>
                <span style={{fontSize:'20px',fontWeight: 700,color:'#3e3e3e'}}>{formatCurrency(totalFinal)}</span>
              </div>
            </div>

            <button onClick={enviarPedido}
              style={{width:'100%',padding:'16px',background:accent,color:'white',border:'none',borderRadius:'14px',fontWeight: 700,fontSize:'16px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',fontFamily:'inherit'}}>
              Finalizar Pedido
            </button>
          </div>
        </>
      )}
      </>)}
    </>
  )
}

const FE_CSS = `
  .fe-body { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; background: #F4F1F2; padding: 16px 14px; display: flex; flex-direction: column; gap: 16px; }
  .fe-card { background: #fff; border-radius: 16px; padding: 16px; }
  .fe-card-err { box-shadow: 0 0 0 2px #FCA5A5; }
  .fe-tt { margin: 0 0 10px; font-size: 15px; font-weight: 900; color: #2C1219; }
  .fe-rl { display: flex; justify-content: space-between; gap: 10px; font-size: 13.5px; color: #4B3A42; padding: 4px 0; }
  .fe-rl span { min-width: 0; } .fe-rl b { font-weight: 800; white-space: nowrap; }
  .fe-verde { color: #15803D; }
  .fe-tot { border-top: 1px solid #F5F0F2; margin-top: 6px; padding-top: 10px; font-size: 15px; color: #2C1219; }
  .fe-cupom { display: flex; gap: 8px; margin-top: 12px; }
  .fe-cupom input { flex: 1; min-width: 0; border: 1.5px dashed #EDE6E9; border-radius: 12px; padding: 10px 12px; font-family: inherit; font-size: 15px; }
  .fe-cupom button { border: none; border-radius: 12px; padding: 0 14px; background: #2C1219; color: #fff; font-family: inherit; font-weight: 800; font-size: 13px; cursor: pointer; }
  .fe-cupom button:disabled { opacity: .4; }
  .fe-link { border: none; background: none; padding: 8px 0 0; font-family: inherit; font-size: 12.5px; font-weight: 700; color: #9A8E94; cursor: pointer; }
  .fe-seg { display: flex; background: #F5F0F2; border-radius: 11px; padding: 3px; margin-bottom: 4px; }
  .fe-seg button { flex: 1; border: none; background: none; padding: 10px; border-radius: 9px; font-family: inherit; font-size: 14px; font-weight: 800; color: #6B5D64; cursor: pointer; }
  .fe-seg button.on { background: #fff; color: #2C1219; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .fe-nota { margin: 8px 0 0; font-size: 12.5px; color: #6B5D64; line-height: 1.4; }
  .fe-aviso { margin-top: 12px; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 12px; padding: 10px 12px; }
  .fe-aviso b { display: block; font-size: 13px; color: #92400E; } .fe-aviso small { display: block; font-size: 12.5px; color: #92400E; line-height: 1.4; margin-top: 2px; } .fe-aviso strong { font-weight: 800; }
  .fe-lb { margin: 12px 0 6px; font-size: 12.5px; font-weight: 700; color: #4B3A42; } .fe-lb em { font-style: normal; font-weight: 500; color: #9A8E94; }
  .fe-in { display: block; width: 100%; box-sizing: border-box; min-height: 46px; margin-top: 8px; border: 1.5px solid #EDE6E9; border-radius: 12px; padding: 11px 12px; font-family: inherit; font-size: 16px; color: #2C1219; background: #fff; }
  .fe-in:focus { outline: none; border-color: #E85A8C; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .fe-lb + .fe-in { margin-top: 0; }
  .fe-ta { min-height: 72px; resize: none; line-height: 1.4; }
  .fe-row { display: flex; gap: 8px; } .fe-row .fe-in { flex: 1; min-width: 0; margin-top: 0; } .fe-row .fe-f2 { flex: 1.6; }
  .fe-end { margin-top: 4px; } .fe-campo-err .fe-in { border-color: #FCA5A5; }
  .fe-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .fe-chips button { border: 1.5px solid #EDE6E9; border-radius: 11px; background: #fff; padding: 9px 12px; font-family: inherit; font-size: 13.5px; font-weight: 700; color: #2C1219; cursor: pointer; }
  .fe-chips button.on { border-color: #E85A8C; background: #FFF1F6; color: #C33A6E; }
  .fe-pg { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #15803D; background: #F0FDF4; border-radius: 10px; padding: 9px 11px; }
  .fe-agenda { position: relative; margin-top: 20px; border: 2px dashed #F59E0B; border-radius: 14px; padding: 16px 12px 12px; background: #FFFBF2; }
  .fe-agenda.ok { border: 2px solid #86EFAC; background: #F7FEF9; }
  .fe-agenda.err { border-color: #EF4444; background: #FEF2F2; }
  .fe-leg { position: absolute; top: -11px; left: 12px; background: #F59E0B; color: #fff; font-size: 11px; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; box-shadow: 0 0 0 3px #fff; }
  .fe-agenda.ok .fe-leg { background: #16A34A; } .fe-agenda.err .fe-leg { background: #EF4444; }
  .fe-agenda .fe-lb { margin-top: 4px; }
  .fe-campo { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; margin-bottom: 10px; background: #fff; border: 1.5px solid #F3D9A8; border-radius: 12px; padding: 0 12px; font-family: inherit; font-size: 15px; font-weight: 700; color: #2C1219; text-align: left; cursor: pointer; }
  .fe-campo:disabled { opacity: .5; cursor: default; }
  .fe-agenda.ok .fe-campo { border-color: #BBF7D0; }
  .fe-ci { display: flex; color: #C2410C; } .fe-agenda.ok .fe-ci { color: #15803D; } .fe-ph { color: #B08A55; font-weight: 600; } .fe-cd { margin-left: auto; color: #B5AAB0; display: flex; }
  .fe-nota--ag { color: #92400E; margin-top: 0; }
  .fe-err { margin: 8px 0 0; font-size: 12.5px; font-weight: 800; color: #DC2626; }
  .fe-foot { border-top: 1px solid #F0EBED; background: #fff; padding: 12px 14px calc(14px + env(safe-area-inset-bottom, 0px)); }
  .fe-enviar { width: 100%; border: none; border-radius: 14px; padding: 16px; background: #16A34A; color: #fff; font-family: inherit; font-size: 16px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(22,163,74,.3); }
`

/* ─── Componente principal ─── */
export function NavigationMenu({ corBotao }: { corBotao?: string }) {
  const { items, totalPrice, updateQuantity, updateObservations, removeItem, clearCart } = useCart()
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<'cart' | 'dados' | 'entrega' | 'checkout' | 'finalizar'>('cart')
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

  const clienteLogado = (() => {
    try {
      const uid = localStorage.getItem('cardapio_user_id') || ''
      const saved = localStorage.getItem(`cardapio_cliente_${uid}`)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })()

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

  const count = items.reduce((acc, i) => acc + (i.saleType === 'kg' ? 1 : Math.floor(i.quantity)), 0)
  const accent = corBotao || '#ea1d2c'

  const tabs = [
    { id: 'inicio', label: 'Início', Icon: Home },
    { id: 'promocoes', label: 'Promoções', Icon: Tag },
    { id: 'pedidos', label: 'Pedidos', Icon: ClipboardList },
    { id: 'perfil', label: 'Perfil', Icon: User },
  ]

  const handleClose = () => { setIsOpen(false); setStep('cart') }

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
      const main = document.querySelector('.layout-main') as HTMLElement
      if (main) main.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
      const main = document.querySelector('.layout-main') as HTMLElement
      if (main) main.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
      const main = document.querySelector('.layout-main') as HTMLElement
      if (main) main.style.overflow = ''
    }
  }, [isOpen])

  const sharedProps = {
    step, setStep, items, totalPrice,
    updateQuantity, updateObservations, removeItem, clearCart,
    config, onClose: handleClose, corBotao: accent,
  }

  return (
    <>
      <style>{`
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes slideRight { from{transform:translateX(100%)} to{transform:translateX(0)} }
        @keyframes spin { to{transform:translateY(-50%) rotate(360deg)} }
        @keyframes progressPulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes fadeScaleIn { from{opacity:0;transform:translate(-50%,-50%) scale(0.95)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes successPop { 0%{opacity:0;transform:scale(0.8)} 100%{opacity:1;transform:scale(1)} }
        @keyframes checkPop { 0%{transform:scale(0)} 70%{transform:scale(1.15)} 100%{transform:scale(1)} }
        .ck-progress-bar { transition: width 0.4s cubic-bezier(0.4,0,0.2,1); animation: progressPulse 2s ease-in-out infinite; }
        .ck-scroll::-webkit-scrollbar { width:4px; }
        .ck-scroll::-webkit-scrollbar-thumb { background:#e5e7eb; border-radius: var(--radius-sm); }
      `}</style>

      {/* ═══ MOBILE: tab bar + cart vindo de baixo ═══ */}
      {isMobile && (
        <>
          <div ref={rodapeRef} className="fixed bottom-0 left-0 right-0 z-30" style={{paddingBottom:'env(safe-area-inset-bottom)', boxShadow:'0 -2px 12px rgba(0,0,0,0.15)'}}>
            {count > 0 && (
              <div
                onClick={() => setIsOpen(true)}
                style={{
                  background:'#16a34a', padding:'10px 18px',
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  cursor:'pointer',
                }}
              >
                <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                  <div style={{background:'rgba(255,255,255,0.2)',borderRadius:'10px',width:'36px',height:'36px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <ShoppingBag size={18} color="white" />
                  </div>
                  <div>
                    <span style={{color:'white',fontWeight:700,fontSize:'15px',display:'block',lineHeight:1.2}}>Ver seu pedido</span>
                    <span style={{color:'rgba(255,255,255,0.85)',fontSize:'12px'}}>{count} {count === 1 ? 'item' : 'itens'}</span>
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                  <span style={{color:'white',fontWeight: 700,fontSize:'16px'}}>{formatCurrency(totalPrice)}</span>
                  <ChevronRight size={18} color="rgba(255,255,255,0.7)" />
                </div>
              </div>
            )}

            <div style={{background: '#3E2A32'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-around', padding:'6px 8px 7px'}}>
              {[
                { id: 'inicio',   label: 'Início',  icon: <Home size={19} /> },
                { id: 'pedidos',  label: 'Pedidos', icon: <ClipboardList size={19} /> },
                { id: 'perfil',   label: 'Perfil',  icon: <User size={19} /> },
              ].map(({ id, label, icon }) => {
                const active = activeTab === id
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      padding: '5px 24px', borderRadius: '8px',
                      background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                      color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {icon}
                    <span style={{ fontSize: '10.5px', fontWeight: active ? 700 : 500, lineHeight: 1 }}>{label}</span>
                  </button>
                )
              })}
              </div>
            </div>
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

          {/* Modal mobile (bottom sheet) */}
          {isOpen && (
            <div
              onClick={handleClose}
              style={{position:'fixed',inset:0,zIndex:50,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'flex-end',justifyContent:'center'}}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  background:'#fff',borderRadius:'20px 20px 0 0',
                  width:'100%',maxWidth:'480px',maxHeight:'94vh',
                  display:'flex',flexDirection:'column',overflow:'hidden',
                  boxShadow:'0 -10px 50px rgba(0,0,0,0.2)',
                  animation:'slideUp 0.3s cubic-bezier(0.32,0.72,0,1)',
                }}
              >
                <div style={{display:'flex',justifyContent:'center',padding:'10px 0 0'}}>
                  <div style={{width:'36px',height:'4px',borderRadius:'4px',background:'#e5e7eb'}} />
                </div>
                <div style={{padding:'10px 20px 12px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                    {(step === 'dados' || step === 'entrega' || step === 'checkout' || step === 'finalizar') && (
                      <button onClick={() => step === 'checkout' ? setStep('entrega') : step === 'entrega' ? setStep('dados') : setStep('cart')} style={{background:'none',border:'none',cursor:'pointer',padding:'4px',display:'flex'}}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3e3e3e" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                      </button>
                    )}
                    <div style={{width:'42px',height:'42px',borderRadius:'12px',background:accent,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <ShoppingBag size={20} color="#fff" />
                    </div>
                    <div>
                      <h3 style={{margin:0,fontWeight: 700,fontSize:'18px',color:'#3e3e3e'}}>
                        {step === 'finalizar' ? 'Finalizar encomenda' : step === 'cart' ? 'Seu pedido' : step === 'dados' ? 'Seus dados' : step === 'entrega' ? 'Entrega' : 'Pagamento'}
                      </h3>
                      <p style={{margin:0,fontSize:'13px',color:'#a0a0a0'}}>
                        {step === 'finalizar' ? 'Revise e envie seu pedido' : step === 'cart' ? `${count} ${count===1?'item':'itens'}` : step === 'dados' ? 'Passo 1 de 3' : step === 'entrega' ? (clienteLogado ? 'Passo 1 de 2' : 'Passo 2 de 3') : (clienteLogado ? 'Passo 2 de 2' : 'Passo 3 de 3')}
                      </p>
                    </div>
                  </div>
                  <button onClick={handleClose} style={{width:'36px',height:'36px',borderRadius:'50%',background:'#f5f5f5',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <X size={18} color="#717171" />
                  </button>
                </div>
                {(step === 'dados' || step === 'entrega' || step === 'checkout') && (
                  <div style={{margin:'0 20px 12px',height:'3px',background:'#f0f0f0',borderRadius:'99px'}}>
                    <div className="ck-progress-bar" style={{height:'100%',width:step==='dados'?'33%':step==='entrega'?(clienteLogado?'50%':'66%'):(clienteLogado?'100%':'100%'),background:accent,borderRadius:'99px'}} />
                  </div>
                )}
                <div style={{height:'1px',background:'#f0f0f0',margin:'0 20px'}} />
                <CartContent key={`mobile-${isOpen}`} {...sharedProps} />
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ DESKTOP: modal centralizado ═══ */}
      {!isMobile && isOpen && (
        <>
          <div onClick={handleClose} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(2px)'}} />
          <div onClick={e => e.stopPropagation()} style={{
            position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
            width:'520px',maxWidth:'95vw',height:'auto',
            background:'#fff',zIndex:201,
            display:'flex',flexDirection:'column',
            boxShadow:'0 24px 64px rgba(0,0,0,0.2)',
            borderRadius:'20px',overflow:'hidden',
            animation:'fadeScaleIn var(--dur-normal) var(--ease-out)',
          }}>
            {/* Header */}
            <div style={{padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #f0f0f0',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                {(step === 'dados' || step === 'entrega' || step === 'checkout' || step === 'finalizar') && (
                  <button onClick={() => step === 'checkout' ? setStep('entrega') : step === 'entrega' ? setStep('dados') : setStep('cart')} style={{background:'none',border:'none',cursor:'pointer',padding:'4px',display:'flex'}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3e3e3e" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                  </button>
                )}
                <div style={{width:'40px',height:'40px',borderRadius:'12px',background:accent,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <ShoppingBag size={20} color="#fff" />
                </div>
                <div>
                  <h3 style={{margin:0,fontWeight: 700,fontSize:'17px',color:'#1f2937',fontFamily:'inherit'}}>
                    {step === 'finalizar' ? 'Finalizar encomenda' : step === 'cart' ? 'Seu pedido' : step === 'dados' ? 'Seus dados' : step === 'entrega' ? 'Entrega' : 'Pagamento'}
                  </h3>
                  <p style={{margin:0,fontSize:'12px',color:'#9ca3af'}}>
                    {step === 'finalizar' ? 'Revise e envie seu pedido' : step === 'cart' ? `${count} ${count===1?'item':'itens'}` : step === 'dados' ? 'Passo 1 de 3' : step === 'entrega' ? (clienteLogado ? 'Passo 1 de 2' : 'Passo 2 de 3') : (clienteLogado ? 'Passo 2 de 2' : 'Passo 3 de 3')}
                  </p>
                </div>
              </div>
              <button onClick={handleClose} style={{width:'32px',height:'32px',borderRadius:'50%',background:'#f5f5f5',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <X size={16} color="#6b7280" />
              </button>
            </div>
            {(step === 'dados' || step === 'entrega' || step === 'checkout') && (
              <div style={{margin:'0 20px 0',height:'3px',background:'#f0f0f0'}}>
                <div className="ck-progress-bar" style={{height:'100%',width:step==='dados'?'33%':step==='entrega'?(clienteLogado?'50%':'66%'):'100%',background:accent,borderRadius:'99px'}} />
              </div>
            )}
            <CartContent key={`desktop-${isOpen}`} {...sharedProps} />
          </div>
        </>
      )}
    </>
  )
}

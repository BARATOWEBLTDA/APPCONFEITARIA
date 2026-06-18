import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { ShoppingBag, X, MessageCircle, Trash2, Home, Tag, ClipboardList, User, ChevronRight, Minus, Plus, MapPin } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { CartItemComponent } from '@/components/cart/CartItemComponent'
import { formatCurrency } from '@/utils/helpers'
import { useIsMobile } from '@/hooks/use-mobile'

interface CheckoutConfig {
  formas_pagamento: string[]
  formas_entrega: string[]
  valor_entrega_propria: number
  entrega_por_bairro: { bairro: string; valor: number }[]
  endereco_retirada: string
  horario_retirada: string
  exibir_campo_troco: boolean
  cupons_desconto: { codigo: string; tipo: string; valor: number; ativo: boolean }[]
  aceita_agendamento: boolean
  prazo_minimo_horas: number
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

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
      <div style={{width:'32px',height:'32px',borderRadius:'10px',background:'#f5f5f5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',flexShrink:0}}>
        {icon}
      </div>
      <div>
        <p style={{margin:0,fontWeight:700,fontSize:'14px',color:'#3e3e3e'}}>{title}</p>
        {subtitle && <p style={{margin:0,fontSize:'12px',color:'#a0a0a0'}}>{subtitle}</p>}
      </div>
    </div>
  )
}

function OptionButton({ selected, label, icon, detail, onClick }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        width:'100%', display:'flex', alignItems:'center', gap:'10px',
        padding:'12px 14px', borderRadius:'10px',
        border: selected ? '2px solid #ea1d2c' : '1.5px solid #f0f0f0',
        background: selected ? '#fff5f5' : '#fff',
        cursor:'pointer', textAlign:'left',
        transition:'all 0.15s',
      }}
    >
      <span style={{fontSize:'18px',flexShrink:0}}>{icon}</span>
      <span style={{flex:1,fontWeight:selected?700:500,fontSize:'14px',color:selected?'#ea1d2c':'#3e3e3e'}}>
        {label}
      </span>
      {detail && <span style={{fontSize:'13px',fontWeight:700,color:'#717171'}}>{detail}</span>}
      {selected && <div style={{width:'18px',height:'18px',borderRadius:'50%',background:'#ea1d2c',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
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
  const [observacoes, setObservacoes] = useState('')
  const [cupomDigitado, setCupomDigitado] = useState('')
  const [cupomAplicado, setCupomAplicado] = useState<{ codigo: string; tipo: string; valor: number } | null>(null)
  const [cupomErro, setCupomErro] = useState('')
  const [formaEntrega, setFormaEntrega] = useState('')
  const [bairroSelecionado, setBairroSelecionado] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [trocoParaStr, setTrocoParaStr] = useState('')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')

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
    if (cupomAplicado.tipo === 'percentual') return totalPrice * (cupomAplicado.valor / 100)
    return Math.min(cupomAplicado.valor, totalPrice)
  }, [cupomAplicado, totalPrice])

  const totalFinal = totalPrice - desconto + freteValor

  const minDate = useMemo(() => {
    const d = new Date()
    d.setHours(d.getHours() + config.prazo_minimo_horas)
    return d.toISOString().split('T')[0]
  }, [config.prazo_minimo_horas])

  const aplicarCupom = () => {
    setCupomErro('')
    const code = cupomDigitado.trim().toUpperCase()
    if (!code) return
    const found = config.cupons_desconto.find((c: any) => c.codigo.toUpperCase() === code && c.ativo)
    if (found) {
      setCupomAplicado({ codigo: found.codigo, tipo: found.tipo, valor: found.valor })
    } else {
      setCupomErro('Cupom inválido ou expirado')
      setCupomAplicado(null)
    }
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

    let msg = `Olá! 👋\n\n`
    msg += `🧁 *NOVO PEDIDO — ${storeName.toUpperCase()}*\n\n`
    msg += `👤 *Nome:* ${nome}\n📞 *WhatsApp:* ${telefone}\n\n`
    msg += `━━━━━━━━━━━━━━━━━\n🛒 *ITENS DO PEDIDO*\n━━━━━━━━━━━━━━━━━\n\n`

    items.forEach((item: any, i: number) => {
      const qty = item.saleType === 'kg' ? `${item.quantity}kg` : `${item.quantity} un`
      msg += `*${i + 1}. ${item.name}*\n`
      msg += `   Qtd: ${qty} × ${formatCurrency(item.price)} = *${formatCurrency(item.price * item.quantity)}*\n`
      if (item.selectedMassa) msg += `   🎂 Massa: ${item.selectedMassa}\n`
      if (item.selectedRecheio) msg += `   🥄 Recheio: ${item.selectedRecheio}\n`
      if (item.selectedCobertura) msg += `   ✨ Cobertura: ${item.selectedCobertura}\n`
      msg += `\n`
    })

    msg += `━━━━━━━━━━━━━━━━━\n`
    if (config.aceita_agendamento && dataEntrega) {
      msg += `📅 *Data:* ${dataEntrega.split('-').reverse().join('/')}\n`
      msg += `🕒 *Horário:* ${horaEntrega}\n\n`
    }
    if (observacoes.trim()) msg += `📝 *Observações:* ${observacoes}\n\n`
    if (cupomAplicado) msg += `🏷️ *Cupom:* ${cupomAplicado.codigo} (${cupomAplicado.tipo === 'percentual' ? `-${cupomAplicado.valor}%` : `-${formatCurrency(cupomAplicado.valor)}`})\n\n`

    const entregaLabel = LABEL_ENTREGA[formaEntrega]?.label || formaEntrega
    msg += `🚚 *Entrega:* ${entregaLabel}\n`
    if (formaEntrega === 'entrega_propria' && bairroSelecionado) msg += `   📍 Bairro: ${bairroSelecionado}\n`

    const pgtoLabel = LABEL_PAGAMENTO[formaPagamento]?.label || formaPagamento
    msg += `💳 *Pagamento:* ${pgtoLabel}\n`
    if (formaPagamento === 'dinheiro' && trocoParaStr) msg += `   💰 Troco para: R$ ${trocoParaStr}\n`

    msg += `\n━━━━━━━━━━━━━━━━━\n`
    msg += `🛒 Subtotal: ${formatCurrency(totalPrice)}\n`
    if (desconto > 0) msg += `🏷️ Desconto: -${formatCurrency(desconto)}\n`
    if (freteValor > 0) msg += `🚚 Frete: ${formatCurrency(freteValor)}\n`
    else if (formaEntrega) msg += `🚚 Frete: Grátis\n`
    msg += `\n✅ *TOTAL: ${formatCurrency(totalFinal)}*`

    const num = whatsapp.replace(/\D/g, '')
    window.open(`https://wa.me/55${num}?text=${encodeURIComponent(msg)}`, '_blank')

    // ── Salva pedido no Supabase e vincula cliente ──
    if (confeteiraUserId) {
      try {
        const telefoneLimpo = telefone.replace(/\D/g, '')

        // Busca cliente pelo telefone ou cria novo
        let clienteId: string | null = null
        const { data: clienteExistente } = await supabase
          .from('clientes')
          .select('id')
          .eq('user_id', confeteiraUserId)
          .or(`telefone.ilike.%${telefoneLimpo}%,whatsapp.ilike.%${telefoneLimpo}%`)
          .single()

        if (clienteExistente) {
          clienteId = clienteExistente.id
        } else {
          const { data: novoCliente } = await supabase
            .from('clientes')
            .insert({
              user_id: confeteiraUserId,
              nome: nome.trim(),
              telefone: telefone.trim(),
              whatsapp: telefone.trim(),
            })
            .select('id')
            .single()
          if (novoCliente) clienteId = novoCliente.id
        }

        // Salva o pedido
        const valorProdutos = totalPrice
        const totalFinalCalc = totalFinal

        const { data: pedidoSalvo } = await supabase
          .from('pedidos')
          .insert({
            user_id: confeteiraUserId,
            cliente_id: clienteId,
            cliente_nome: nome.trim(),
            cliente_telefone: telefone.trim(),
            cliente_whatsapp: telefone.trim(),
            status: 'novo',
            origem: 'cardapio',
            prioridade: 'media',
            data_entrega: dataEntrega || null,
            horario_entrega: horaEntrega || null,
            tipo_entrega: formaEntrega === 'retirada' ? 'retirada' : 'entrega',
            taxa_entrega: freteValor,
            forma_pagamento: formaPagamento,
            status_pagamento: 'pendente',
            valor_produtos: valorProdutos,
            cupom_codigo: cupomAplicado?.codigo || null,
            cupom_desconto: desconto || 0,
            desconto: desconto || 0,
            valor_total: totalFinalCalc,
            observacoes: observacoes || null,
          })
          .select('id')
          .single()

        // Salva os itens do pedido
        if (pedidoSalvo && items.length > 0) {
          await supabase.from('pedido_itens').insert(
            items.map((item: any) => ({
              pedido_id: pedidoSalvo.id,
              user_id: confeteiraUserId,
              nome_produto: item.name,
              quantidade: item.quantity,
              valor_unitario: item.price,
              desconto: 0,
              observacoes: item.observations || null,
              personalizacoes: {
                massa: item.selectedMassa || null,
                recheio: item.selectedRecheio || null,
                cobertura: item.selectedCobertura || null,
              },
            }))
          )

          // Registra no histórico
          await supabase.from('pedido_historico').insert({
            pedido_id: pedidoSalvo.id,
            user_id: confeteiraUserId,
            evento: 'Pedido criado',
            descricao: `Pedido recebido pelo Cardápio Digital`,
          })
        }
      } catch (err) {
        // Falha silenciosa — WhatsApp já foi aberto, não impacta o cliente
        console.error('Erro ao salvar pedido no Supabase:', err)
      }
    }

    clearCart()
    setStep('cart')
    onClose()
  }

  const accent = corBotao || '#ea1d2c'

  return (
    <>
      {/* ═══ CART STEP ═══ */}
      {step === 'cart' && (
        <>
          <div className="ck-scroll" style={{flex:1,overflowY:'auto',padding:'12px 20px',display:'flex',flexDirection:'column',gap:'8px'}}>
            {items.length === 0 ? (
              <div style={{textAlign:'center',padding:'48px 20px'}}>
                <div style={{width:'72px',height:'72px',borderRadius:'50%',background:'#f5f5f5',margin:'0 auto 16px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <ShoppingBag size={32} color="#d4d4d4" />
                </div>
                <p style={{margin:0,fontWeight:700,fontSize:'16px',color:'#3e3e3e'}}>Sua sacola está vazia</p>
                <p style={{margin:'8px 0 0',fontSize:'14px',color:'#a0a0a0'}}>Adicione itens para fazer seu pedido</p>
              </div>
            ) : (
              items.map((item: any) => (
                <CartItemComponent key={item.id} item={item} onUpdateQuantity={updateQuantity} onUpdateObservations={updateObservations} onRemove={removeItem} />
              ))
            )}
          </div>

          {items.length > 0 && (
            <div style={{borderTop:'1px solid #f0f0f0',padding:'16px 20px',display:'flex',flexDirection:'column',gap:'10px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:'17px',fontWeight:800,color:'#3e3e3e'}}>Total</span>
                <span style={{fontSize:'20px',fontWeight:800,color:'#3e3e3e'}}>{formatCurrency(totalPrice)}</span>
              </div>
              <button
                onClick={() => setStep('checkout')}
                style={{
                  width:'100%',padding:'15px',background:accent,color:'white',
                  border:'none',borderRadius:'14px',fontWeight:800,fontSize:'16px',
                  cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',
                  boxShadow:`0 4px 16px ${accent}44`,fontFamily:'inherit',
                }}
              >
                Finalizar pedido <ChevronRight size={18} />
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

      {/* ═══ CHECKOUT STEP ═══ */}
      {step === 'checkout' && (
        <>
          <div className="ck-scroll" style={{flex:1,overflowY:'auto'}}>

            {/* Dados */}
            <div style={{padding:'16px 20px'}}>
              <SectionHeader icon={<User size={16} color="#717171" />} title="Seus dados" />
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome"
                  style={{width:'100%',padding:'12px 14px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'14px',color:'#3e3e3e',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
                  onFocus={e=>(e.target.style.borderColor=accent)} onBlur={e=>(e.target.style.borderColor='#f0f0f0')} />
                <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 9 0000-0000" type="tel"
                  style={{width:'100%',padding:'12px 14px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'14px',color:'#3e3e3e',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
                  onFocus={e=>(e.target.style.borderColor=accent)} onBlur={e=>(e.target.style.borderColor='#f0f0f0')} />
              </div>
            </div>

            <Divider />

            {/* Data */}
            {config.aceita_agendamento && (
              <>
                <div style={{padding:'16px 20px'}}>
                  <SectionHeader icon="📅" title="Data e horário" subtitle={`Agende com ${config.prazo_minimo_horas}h de antecedência`} />
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                    <div>
                      <label style={{fontSize:'12px',fontWeight:600,color:'#717171',display:'block',marginBottom:'6px'}}>Data da entrega</label>
                      <input type="date" value={dataEntrega} min={minDate} onChange={e => setDataEntrega(e.target.value)}
                        style={{width:'100%',padding:'12px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'14px',color:'#3e3e3e',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
                        onFocus={e=>(e.target.style.borderColor=accent)} onBlur={e=>(e.target.style.borderColor='#f0f0f0')} />
                    </div>
                    <div>
                      <label style={{fontSize:'12px',fontWeight:600,color:'#717171',display:'block',marginBottom:'6px'}}>Horário</label>
                      <input type="time" value={horaEntrega} onChange={e => setHoraEntrega(e.target.value)}
                        style={{width:'100%',padding:'12px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'14px',color:'#3e3e3e',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
                        onFocus={e=>(e.target.style.borderColor=accent)} onBlur={e=>(e.target.style.borderColor='#f0f0f0')} />
                    </div>
                  </div>
                </div>
                <Divider />
              </>
            )}

            {/* Observações */}
            <div style={{padding:'16px 20px'}}>
              <SectionHeader icon="📝" title="Observações" subtitle="Personalização, restrições, recados..." />
              <textarea
                value={observacoes} onChange={e => setObservacoes(e.target.value)}
                placeholder={'Ex: Escrever "Parabéns Ana" no bolo\nSem morango\nEntregar após 18h'}
                rows={3}
                style={{width:'100%',padding:'12px 14px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'14px',color:'#3e3e3e',outline:'none',resize:'none',boxSizing:'border-box',fontFamily:'inherit',lineHeight:'1.5'}}
                onFocus={e=>(e.target.style.borderColor=accent)} onBlur={e=>(e.target.style.borderColor='#f0f0f0')} />
            </div>

            <Divider />

            {/* Cupom */}
            {config.cupons_desconto.length > 0 && (
              <>
                <div style={{padding:'16px 20px'}}>
                  <SectionHeader icon="🏷️" title="Cupom de desconto" />
                  {cupomAplicado ? (
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'#f0fdf4',border:'1.5px solid #bbf7d0',borderRadius:'10px'}}>
                      <div>
                        <span style={{fontWeight:700,fontSize:'14px',color:'#16a34a'}}>{cupomAplicado.codigo}</span>
                        <span style={{fontSize:'13px',color:'#22c55e',marginLeft:'8px'}}>
                          {cupomAplicado.tipo === 'percentual' ? `-${cupomAplicado.valor}%` : `-${formatCurrency(cupomAplicado.valor)}`}
                        </span>
                      </div>
                      <button onClick={removerCupom} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:'13px',fontWeight:600}}>Remover</button>
                    </div>
                  ) : (
                    <div style={{display:'flex',gap:'8px'}}>
                      <input
                        value={cupomDigitado} onChange={e => { setCupomDigitado(e.target.value.toUpperCase()); setCupomErro('') }}
                        placeholder="Digite o código"
                        style={{flex:1,padding:'12px 14px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'14px',color:'#3e3e3e',outline:'none',textTransform:'uppercase',fontFamily:'inherit'}}
                        onFocus={e=>(e.target.style.borderColor=accent)} onBlur={e=>(e.target.style.borderColor='#f0f0f0')} />
                      <button onClick={aplicarCupom} style={{padding:'12px 20px',background:accent,color:'white',border:'none',borderRadius:'10px',fontWeight:700,fontSize:'14px',cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit'}}>
                        Aplicar
                      </button>
                    </div>
                  )}
                  {cupomErro && <p style={{margin:'6px 0 0',fontSize:'12px',color:'#ef4444'}}>{cupomErro}</p>}
                </div>
                <Divider />
              </>
            )}

            {/* Entrega */}
            <div style={{padding:'16px 20px'}}>
              <SectionHeader icon="🚚" title="Forma de entrega" subtitle="Como deseja receber seu pedido?" />
              <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                {config.formas_entrega.map((key: string) => {
                  const info = LABEL_ENTREGA[key] || { icon: '📦', label: key }
                  let detail = ''
                  if (key === 'retirada') detail = 'Grátis'
                  if (key === 'entrega_propria' && config.valor_entrega_propria > 0 && config.entrega_por_bairro.length === 0) {
                    detail = formatCurrency(config.valor_entrega_propria)
                  }
                  return <OptionButton key={key} selected={formaEntrega===key} label={info.label} icon={info.icon} detail={detail} onClick={() => { setFormaEntrega(key); setBairroSelecionado('') }} />
                })}
              </div>

              {formaEntrega === 'entrega_propria' && config.entrega_por_bairro.length > 0 && (
                <div style={{marginTop:'10px'}}>
                  <label style={{fontSize:'12px',fontWeight:600,color:'#717171',display:'block',marginBottom:'6px'}}>Selecione seu bairro</label>
                  <select value={bairroSelecionado} onChange={e => setBairroSelecionado(e.target.value)}
                    style={{width:'100%',padding:'12px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'14px',color:'#3e3e3e',outline:'none',background:'#fff',fontFamily:'inherit'}}>
                    <option value="">Escolha o bairro</option>
                    {config.entrega_por_bairro.map((b: any) => (
                      <option key={b.bairro} value={b.bairro}>{b.bairro} — {formatCurrency(b.valor)}</option>
                    ))}
                  </select>
                </div>
              )}

              {formaEntrega === 'retirada' && config.endereco_retirada && (
                <div style={{marginTop:'10px',padding:'10px 14px',background:'#f9fafb',borderRadius:'10px',display:'flex',alignItems:'flex-start',gap:'8px'}}>
                  <MapPin size={14} color="#717171" style={{marginTop:'2px',flexShrink:0}} />
                  <div>
                    <p style={{margin:0,fontSize:'13px',color:'#3e3e3e',fontWeight:600}}>Endereço para retirada</p>
                    <p style={{margin:'2px 0 0',fontSize:'12px',color:'#717171'}}>{config.endereco_retirada}</p>
                    {config.horario_retirada && <p style={{margin:'2px 0 0',fontSize:'12px',color:'#717171'}}>🕒 {config.horario_retirada}</p>}
                  </div>
                </div>
              )}
            </div>

            <Divider />

            {/* Pagamento */}
            <div style={{padding:'16px 20px'}}>
              <SectionHeader icon="💳" title="Forma de pagamento" />
              <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                {config.formas_pagamento.map((key: string) => {
                  const info = LABEL_PAGAMENTO[key] || { icon: '💰', label: key }
                  return <OptionButton key={key} selected={formaPagamento===key} label={info.label} icon={info.icon} onClick={() => setFormaPagamento(key)} />
                })}
              </div>

              {formaPagamento === 'dinheiro' && config.exibir_campo_troco && (
                <div style={{marginTop:'10px'}}>
                  <label style={{fontSize:'12px',fontWeight:600,color:'#717171',display:'block',marginBottom:'6px'}}>💰 Precisa de troco para quanto?</label>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <span style={{fontSize:'14px',color:'#717171',fontWeight:600}}>R$</span>
                    <input value={trocoParaStr} onChange={e => setTrocoParaStr(e.target.value.replace(/[^0-9.,]/g,''))}
                      placeholder="0,00" inputMode="decimal"
                      style={{flex:1,padding:'12px 14px',border:'2px solid #f0f0f0',borderRadius:'10px',fontSize:'14px',color:'#3e3e3e',outline:'none',fontFamily:'inherit'}}
                      onFocus={e=>(e.target.style.borderColor=accent)} onBlur={e=>(e.target.style.borderColor='#f0f0f0')} />
                  </div>
                </div>
              )}
            </div>

            <div style={{height:'20px'}} />
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
                <span style={{fontSize:'17px',fontWeight:800,color:'#3e3e3e'}}>Total</span>
                <span style={{fontSize:'20px',fontWeight:800,color:'#3e3e3e'}}>{formatCurrency(totalFinal)}</span>
              </div>
            </div>

            <button
              onClick={enviarPedido}
              style={{
                width:'100%',padding:'16px',
                background:'#25D366',color:'white',
                border:'none',borderRadius:'14px',
                fontWeight:800,fontSize:'16px',cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',
                boxShadow:'0 4px 20px rgba(37,211,102,0.3)',fontFamily:'inherit',
              }}
            >
              <MessageCircle size={20} /> Pedir pelo WhatsApp
            </button>
          </div>
        </>
      )}
    </>
  )
}

/* ─── Componente principal ─── */
export function NavigationMenu({ corBotao }: { corBotao?: string }) {
  const { items, totalPrice, updateQuantity, updateObservations, removeItem, clearCart } = useCart()
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<'cart' | 'checkout'>('cart')
  const [activeTab, setActiveTab] = useState('inicio')
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
        .ck-scroll::-webkit-scrollbar { width:4px; }
        .ck-scroll::-webkit-scrollbar-thumb { background:#e5e7eb; border-radius:4px; }
      `}</style>

      {/* ═══ MOBILE: tab bar + cart vindo de baixo ═══ */}
      {isMobile && (
        <>
          {count > 0 && (
            <div
              onClick={() => setIsOpen(true)}
              style={{
                position:'fixed', bottom:'62px', left:0, right:0, zIndex:40,
                background:'#3d3d3d', padding:'10px 18px',
                display:'flex', alignItems:'center', justifyContent:'space-between',
                boxShadow:'0 -2px 12px rgba(0,0,0,0.15)', cursor:'pointer',
              }}
            >
              <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                <div style={{background:'rgba(255,255,255,0.2)',borderRadius:'10px',width:'36px',height:'36px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <ShoppingBag size={18} color="white" />
                </div>
                <div>
                  <span style={{color:'white',fontWeight:700,fontSize:'15px',display:'block'}}>Ver sacola</span>
                  <span style={{color:'rgba(255,255,255,0.75)',fontSize:'12px'}}>{count} {count === 1 ? 'item' : 'itens'}</span>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                <span style={{color:'white',fontWeight:800,fontSize:'16px'}}>{formatCurrency(totalPrice)}</span>
                <ChevronRight size={18} color="rgba(255,255,255,0.7)" />
              </div>
            </div>
          )}

          <div className="fixed bottom-0 left-0 right-0 z-30 border-t" style={{background:accent,paddingBottom:'env(safe-area-inset-bottom)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-around',padding:'8px 0 10px'}}>
              {tabs.map(({id,label,Icon}) => {
                const active = activeTab === id
                return (
                  <button key={id} onClick={() => setActiveTab(id)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'4px 16px'}}>
                    <Icon size={22} color={active ? 'white' : 'rgba(255,255,255,0.55)'} />
                    <span style={{fontSize:'11px',fontWeight:active?700:400,color:active?'white':'rgba(255,255,255,0.55)'}}>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

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
                    {step === 'checkout' && (
                      <button onClick={() => setStep('cart')} style={{background:'none',border:'none',cursor:'pointer',padding:'4px',display:'flex'}}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3e3e3e" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                      </button>
                    )}
                    <div style={{width:'42px',height:'42px',borderRadius:'12px',background:accent,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <ShoppingBag size={20} color="#fff" />
                    </div>
                    <div>
                      <h3 style={{margin:0,fontWeight:800,fontSize:'18px',color:'#3e3e3e'}}>
                        {step === 'cart' ? 'Sacola' : 'Finalizar pedido'}
                      </h3>
                      <p style={{margin:0,fontSize:'13px',color:'#a0a0a0'}}>
                        {step === 'cart' ? `${count} ${count===1?'item':'itens'}` : 'Preencha os dados abaixo'}
                      </p>
                    </div>
                  </div>
                  <button onClick={handleClose} style={{width:'36px',height:'36px',borderRadius:'50%',background:'#f5f5f5',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <X size={18} color="#717171" />
                  </button>
                </div>
                <div style={{height:'1px',background:'#f0f0f0',margin:'0 20px'}} />
                <CartContent key={`mobile-${isOpen}`} {...sharedProps} />
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ DESKTOP: sidebar deslizando da direita ═══ */}
      {!isMobile && isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={handleClose}
            style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(2px)'}}
          />

          {/* Sidebar */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position:'fixed',top:0,right:0,bottom:0,zIndex:201,
              width:'420px',maxWidth:'96vw',
              background:'#fff',
              display:'flex',flexDirection:'column',
              boxShadow:'-8px 0 40px rgba(0,0,0,0.15)',
              animation:'slideRight 0.3s cubic-bezier(0.32,0.72,0,1)',
            }}
          >
            {/* Header */}
            <div style={{padding:'20px 20px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #f0f0f0'}}>
              <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                {step === 'checkout' && (
                  <button onClick={() => setStep('cart')} style={{background:'none',border:'none',cursor:'pointer',padding:'4px',display:'flex'}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3e3e3e" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                  </button>
                )}
                <div style={{width:'44px',height:'44px',borderRadius:'12px',background:accent,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <ShoppingBag size={22} color="#fff" />
                </div>
                <div>
                  <h3 style={{margin:0,fontWeight:800,fontSize:'19px',color:'#1f2937',fontFamily:'inherit'}}>
                    {step === 'cart' ? 'Sacola' : 'Finalizar pedido'}
                  </h3>
                  <p style={{margin:0,fontSize:'13px',color:'#9ca3af'}}>
                    {step === 'cart' ? `${count} ${count===1?'item':'itens'}` : 'Preencha os dados abaixo'}
                  </p>
                </div>
              </div>
              <button onClick={handleClose} style={{width:'36px',height:'36px',borderRadius:'50%',background:'#f5f5f5',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <X size={18} color="#6b7280" />
              </button>
            </div>

            <CartContent key={`desktop-${isOpen}`} {...sharedProps} />
          </div>
        </>
      )}
    </>
  )
}

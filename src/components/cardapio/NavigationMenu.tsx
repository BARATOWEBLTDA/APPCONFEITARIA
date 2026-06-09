import { useState } from 'react'
import { ShoppingBag, X, MessageCircle, Trash2, Home, Tag, ClipboardList, User, ChevronRight } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { CartItemComponent } from '@/components/cart/CartItemComponent'
import { formatCurrency } from '@/utils/helpers'
import { useIsMobile } from '@/hooks/use-mobile'

export function NavigationMenu() {
  const { items, totalPrice, updateQuantity, updateObservations, removeItem, clearCart } = useCart()
  const [isOpen, setIsOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [activeTab, setActiveTab] = useState('inicio')
  const isMobile = useIsMobile()

  const count = items.reduce((acc, i) => acc + (i.saleType === 'kg' ? 1 : Math.floor(i.quantity)), 0)

  const sendOrder = () => {
    if (!name.trim() || !phone.trim()) return alert('Preencha nome e telefone')
    const whatsapp = localStorage.getItem('cardapio_whatsapp') || '41998843669'
    const storeName = localStorage.getItem('cardapio_nome') || 'Cardápio'
    let msg = `Olá! 👋\n\n🧁 NOVO PEDIDO - ${storeName.toUpperCase()}\n\n👤 ${name}\n📞 ${phone}\n\n🛒 PEDIDO:\n\n`
    items.forEach((item, i) => {
      msg += `${i + 1}. ${item.name}\n   Qtd: ${item.saleType === 'kg' ? `${item.quantity}kg` : `${item.quantity} un`}`
      if (item.selectedMassa) msg += `\n   Massa: ${item.selectedMassa}`
      if (item.selectedRecheio) msg += `\n   Recheio: ${item.selectedRecheio}`
      if (item.selectedCobertura) msg += `\n   Cobertura: ${item.selectedCobertura}`
      msg += `\n   Subtotal: ${formatCurrency(item.price * item.quantity)}\n\n`
    })
    msg += `💰 TOTAL: ${formatCurrency(totalPrice)}`
    window.open(`https://wa.me/55${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank')
    clearCart(); setShowForm(false); setIsOpen(false)
  }

  const tabs = [
    { id: 'inicio',    label: 'Início',     Icon: Home },
    { id: 'promocoes', label: 'Promoções',  Icon: Tag },
    { id: 'pedidos',   label: 'Pedidos',    Icon: ClipboardList },
    { id: 'perfil',    label: 'Perfil',     Icon: User },
  ]

  return (
    <>
      {isMobile ? (
        <>
          {/* Barra "Ver sacola" — estilo iFood */}
          {count > 0 && (
            <div
              onClick={() => setIsOpen(true)}
              style={{
                position: 'fixed',
                bottom: '62px',
                left: '12px',
                right: '12px',
                zIndex: 40,
                background: '#ea1d2c',
                borderRadius: '12px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 6px 24px rgba(234,29,44,0.4)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  background: 'rgba(255,255,255,0.2)', borderRadius: '10px',
                  width: '36px', height: '36px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ShoppingBag size={18} color="white" />
                </div>
                <div>
                  <span style={{ color: 'white', fontWeight: 700, fontSize: '15px', display: 'block' }}>
                    Ver sacola
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px' }}>
                    {count} {count === 1 ? 'item' : 'itens'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'white', fontWeight: 800, fontSize: '16px' }}>
                  {formatCurrency(totalPrice)}
                </span>
                <ChevronRight size={18} color="rgba(255,255,255,0.7)" />
              </div>
            </div>
          )}

          {/* Menu inferior */}
          <div
            className="fixed bottom-0 left-0 right-0 z-30 border-t"
            style={{ background: '#ec4899', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 0 10px' }}>
              {tabs.map(({ id, label, Icon }) => {
                const active = activeTab === id
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 16px' }}
                  >
                    <Icon size={22} color={active ? 'white' : 'rgba(255,255,255,0.55)'} />
                    <span style={{ fontSize: '11px', fontWeight: active ? 700 : 400, color: active ? 'white' : 'rgba(255,255,255,0.55)' }}>
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Desktop — menu lateral com sacola */}
          <div
            className="fixed left-0 top-0 bottom-0 z-30 shadow-lg border-r w-20 flex flex-col justify-center"
            style={{ background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 50%, #f9a8d4 100%)' }}
          >
            <div className="px-4 py-3 flex justify-center">
              <button onClick={() => setIsOpen(true)} className="bg-white text-pink-600 relative px-6 rounded-full py-2 flex items-center gap-2 font-semibold">
                <ShoppingBag className="w-5 h-5" />
                {count > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">{count}</span>}
              </button>
            </div>
          </div>
          <div className="w-20" />
        </>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* MODAL CARRINHO — estilo iFood profissional        */}
      {/* ═══════════════════════════════════════════════════ */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position:'fixed', inset:0, zIndex:50,
            background:'rgba(0,0,0,0.6)',
            display:'flex', alignItems:'flex-end', justifyContent:'center',
            animation:'fadeIn 0.2s ease',
          }}
        >
          <style>{`
            @keyframes fadeIn { from{opacity:0} to{opacity:1} }
            @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
            .cart-scroll::-webkit-scrollbar { width:4px; }
            .cart-scroll::-webkit-scrollbar-thumb { background:#e5e7eb; border-radius:4px; }
          `}</style>

          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:'#ffffff',
              borderRadius:'20px 20px 0 0',
              width:'100%', maxWidth:'480px',
              maxHeight:'92vh',
              display:'flex', flexDirection:'column',
              overflow:'hidden',
              boxShadow:'0 -10px 50px rgba(0,0,0,0.2)',
              animation:'slideUp 0.3s cubic-bezier(0.32,0.72,0,1)',
            }}
          >
            {/* Drag handle */}
            <div style={{display:'flex',justifyContent:'center',padding:'10px 0 0'}}>
              <div style={{width:'36px',height:'4px',borderRadius:'4px',background:'#e5e7eb'}} />
            </div>

            {/* Header */}
            <div style={{
              padding:'12px 20px 14px',
              display:'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                <div style={{
                  width:'42px', height:'42px', borderRadius:'12px',
                  background:'#ea1d2c',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  <ShoppingBag size={20} color="#fff" />
                </div>
                <div>
                  <h3 style={{margin:0, fontWeight:800, fontSize:'18px', color:'#3e3e3e', letterSpacing:'-0.3px'}}>Sacola</h3>
                  <p style={{margin:0, fontSize:'13px', color:'#a0a0a0', fontWeight:500}}>
                    {count} {count === 1 ? 'item' : 'itens'} adicionados
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  width:'36px', height:'36px', borderRadius:'50%',
                  background:'#f5f5f5', border:'none', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#ebebeb')}
                onMouseLeave={e => (e.currentTarget.style.background = '#f5f5f5')}
              >
                <X size={18} color="#717171" />
              </button>
            </div>

            {/* Divisor */}
            <div style={{height:'1px',background:'#f0f0f0',margin:'0 20px'}} />

            {/* Lista de itens */}
            <div
              className="cart-scroll"
              style={{
                flex:1, overflowY:'auto', padding:'12px 20px',
                display:'flex', flexDirection:'column', gap:'8px',
              }}
            >
              {items.length === 0 ? (
                <div style={{textAlign:'center', padding:'48px 20px'}}>
                  <div style={{
                    width:'72px', height:'72px', borderRadius:'50%',
                    background:'#f5f5f5', margin:'0 auto 16px',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <ShoppingBag size={32} color="#d4d4d4" />
                  </div>
                  <p style={{margin:0, fontWeight:700, fontSize:'16px', color:'#3e3e3e'}}>Sua sacola está vazia</p>
                  <p style={{margin:'8px 0 0', fontSize:'14px', color:'#a0a0a0'}}>Adicione itens para fazer seu pedido</p>
                </div>
              ) : (
                items.map(item => (
                  <CartItemComponent
                    key={item.id}
                    item={item}
                    onUpdateQuantity={updateQuantity}
                    onUpdateObservations={updateObservations}
                    onRemove={removeItem}
                  />
                ))
              )}
            </div>

            {/* Footer fixo */}
            {items.length > 0 && (
              <div style={{
                borderTop:'1px solid #f0f0f0',
                padding:'16px 20px',
                paddingBottom:'max(20px, env(safe-area-inset-bottom))',
                background:'#fff',
                display:'flex', flexDirection:'column', gap:'12px',
              }}>
                {/* Resumo valores */}
                <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:'14px',color:'#717171'}}>Subtotal</span>
                    <span style={{fontSize:'14px',color:'#717171'}}>{formatCurrency(totalPrice)}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:'17px',fontWeight:800,color:'#3e3e3e'}}>Total</span>
                    <span style={{fontSize:'20px',fontWeight:800,color:'#3e3e3e'}}>{formatCurrency(totalPrice)}</span>
                  </div>
                </div>

                {/* Botão principal */}
                <button
                  onClick={() => setShowForm(true)}
                  style={{
                    width:'100%', padding:'16px',
                    background:'#25D366', color:'white',
                    border:'none', borderRadius:'14px',
                    fontWeight:800, fontSize:'16px',
                    cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:'10px',
                    boxShadow:'0 4px 20px rgba(37,211,102,0.3)',
                    transition:'transform 0.1s, box-shadow 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.01)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(37,211,102,0.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(37,211,102,0.3)' }}
                >
                  <MessageCircle size={20} /> Pedir pelo WhatsApp
                </button>

                {/* Ações secundárias */}
                <div style={{display:'flex',gap:'8px'}}>
                  <button
                    onClick={() => setIsOpen(false)}
                    style={{
                      flex:1, padding:'12px',
                      background:'transparent', border:'1.5px solid #e8e8e8',
                      borderRadius:'12px', fontWeight:600, fontSize:'14px',
                      color:'#717171', cursor:'pointer',
                      transition:'border-color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#c0c0c0')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#e8e8e8')}
                  >
                    Continuar comprando
                  </button>
                  <button
                    onClick={clearCart}
                    style={{
                      padding:'12px 16px',
                      background:'transparent', border:'1.5px solid #fecaca',
                      borderRadius:'12px', cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fff5f5')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* MODAL DADOS DO PEDIDO — estilo iFood              */}
      {/* ═══════════════════════════════════════════════════ */}
      {showForm && (
        <div
          onClick={() => setShowForm(false)}
          style={{
            position:'fixed', inset:0, zIndex:9999,
            background:'rgba(0,0,0,0.6)',
            display:'flex', alignItems:'flex-end', justifyContent:'center',
            animation:'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:'#ffffff',
              borderRadius:'20px 20px 0 0',
              width:'100%', maxWidth:'480px',
              padding:'0 0 max(20px, env(safe-area-inset-bottom))',
              boxShadow:'0 -10px 50px rgba(0,0,0,0.2)',
              animation:'slideUp 0.3s cubic-bezier(0.32,0.72,0,1)',
            }}
          >
            {/* Handle */}
            <div style={{display:'flex',justifyContent:'center',padding:'10px 0 0'}}>
              <div style={{width:'36px',height:'4px',borderRadius:'4px',background:'#e5e7eb'}} />
            </div>

            {/* Header */}
            <div style={{padding:'12px 20px 16px', display:'flex', alignItems:'center', gap:'12px'}}>
              <div style={{
                width:'42px', height:'42px', borderRadius:'12px',
                background:'#25D366',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <MessageCircle size={20} color="#fff" />
              </div>
              <div>
                <h3 style={{margin:0, fontWeight:800, fontSize:'18px', color:'#3e3e3e'}}>Finalizar pedido</h3>
                <p style={{margin:0, fontSize:'13px', color:'#a0a0a0', fontWeight:500}}>Informe seus dados para enviar</p>
              </div>
            </div>

            <div style={{height:'1px',background:'#f0f0f0',margin:'0 20px'}} />

            {/* Campos */}
            <div style={{padding:'16px 20px', display:'flex', flexDirection:'column', gap:'14px'}}>
              <div>
                <label style={{fontSize:'13px', fontWeight:700, color:'#3e3e3e', display:'block', marginBottom:'8px'}}>
                  Seu nome
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Como podemos te chamar?"
                  style={{
                    width:'100%', padding:'14px 16px',
                    border:'2px solid #f0f0f0', borderRadius:'12px',
                    fontSize:'15px', color:'#3e3e3e', outline:'none',
                    boxSizing:'border-box', fontFamily:'inherit',
                    transition:'border-color 0.2s',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#ea1d2c')}
                  onBlur={e => (e.target.style.borderColor = '#f0f0f0')}
                />
              </div>
              <div>
                <label style={{fontSize:'13px', fontWeight:700, color:'#3e3e3e', display:'block', marginBottom:'8px'}}>
                  WhatsApp
                </label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(00) 9 0000-0000"
                  type="tel"
                  style={{
                    width:'100%', padding:'14px 16px',
                    border:'2px solid #f0f0f0', borderRadius:'12px',
                    fontSize:'15px', color:'#3e3e3e', outline:'none',
                    boxSizing:'border-box', fontFamily:'inherit',
                    transition:'border-color 0.2s',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#ea1d2c')}
                  onBlur={e => (e.target.style.borderColor = '#f0f0f0')}
                />
              </div>
            </div>

            {/* Resumo rápido */}
            <div style={{
              margin:'0 20px 14px', padding:'12px 16px',
              background:'#f9fafb', borderRadius:'12px',
              display:'flex', justifyContent:'space-between', alignItems:'center',
            }}>
              <span style={{fontSize:'14px',color:'#717171'}}>{count} {count === 1 ? 'item' : 'itens'}</span>
              <span style={{fontSize:'16px',fontWeight:800,color:'#3e3e3e'}}>{formatCurrency(totalPrice)}</span>
            </div>

            {/* Botões */}
            <div style={{padding:'0 20px',display:'flex',gap:'10px'}}>
              <button
                onClick={() => setShowForm(false)}
                style={{
                  flex:1, padding:'14px',
                  background:'transparent', border:'1.5px solid #e8e8e8',
                  borderRadius:'12px', fontWeight:600, fontSize:'15px',
                  color:'#717171', cursor:'pointer',
                }}
              >
                Voltar
              </button>
              <button
                onClick={sendOrder}
                style={{
                  flex:2, padding:'14px',
                  background:'#25D366', border:'none',
                  borderRadius:'12px', color:'white',
                  fontWeight:800, fontSize:'15px', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                  boxShadow:'0 4px 20px rgba(37,211,102,0.3)',
                  transition:'transform 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.01)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <MessageCircle size={18} /> Enviar pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

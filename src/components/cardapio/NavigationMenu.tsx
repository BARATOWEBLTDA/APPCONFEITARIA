import { useState } from 'react'
import { ShoppingBag, X, MessageCircle, Trash2, Home, Tag, ClipboardList, User } from 'lucide-react'
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
          {/* Barra "Ver sacola" — aparece só quando tem itens */}
          {count > 0 && (
            <div
              onClick={() => setIsOpen(true)}
              style={{
                position: 'fixed',
                bottom: '62px',
                left: '0',
                right: '0',
                zIndex: 40,
                background: '#2d2d2d',
                borderRadius: '0',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 8px 24px rgba(236,72,153,0.45)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '10px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingBag size={18} color="white" />
                </div>
                <span style={{ color: 'white', fontWeight: 700, fontSize: '15px' }}>
                  Ver sacola · {count} {count === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '15px' }}>
                {formatCurrency(totalPrice)}
              </span>
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

      {/* Modal carrinho — design profissional */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position:'fixed', inset:0, zIndex:50,
            background:'rgba(0,0,0,0.55)',
            display:'flex', alignItems:'flex-end',
            justifyContent:'center',
            backdropFilter:'blur(2px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:'#fff',
              borderRadius:'24px 24px 0 0',
              width:'100%',
              maxWidth:'480px',
              maxHeight:'88vh',
              display:'flex',
              flexDirection:'column',
              overflow:'hidden',
              boxShadow:'0 -8px 40px rgba(0,0,0,0.18)',
            }}
          >
            {/* Handle */}
            <div style={{display:'flex',justifyContent:'center',padding:'12px 0 4px'}}>
              <div style={{width:'40px',height:'4px',borderRadius:'2px',background:'#e5e7eb'}} />
            </div>

            {/* Header */}
            <div style={{
              padding:'0 20px 16px',
              display:'flex', alignItems:'center', justifyContent:'space-between',
              borderBottom:'1px solid #f3f4f6',
            }}>
              <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                <div style={{
                  width:'38px', height:'38px', borderRadius:'12px',
                  background:'linear-gradient(135deg,#fce7f3,#fdf2f8)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  <ShoppingBag size={18} color="#ec4899" />
                </div>
                <div>
                  <p style={{margin:0, fontWeight:800, fontSize:'17px', color:'#111827'}}>Minha Sacola</p>
                  <p style={{margin:0, fontSize:'12px', color:'#9ca3af'}}>{count} {count === 1 ? 'item' : 'itens'}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  width:'34px', height:'34px', borderRadius:'50%',
                  background:'#f3f4f6', border:'none', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}
              >
                <X size={16} color="#6b7280" />
              </button>
            </div>

            {/* Itens */}
            <div style={{flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:'10px'}}>
              {items.length === 0 ? (
                <div style={{textAlign:'center', padding:'40px 0', color:'#9ca3af'}}>
                  <ShoppingBag size={48} style={{margin:'0 auto 12px', display:'block', opacity:0.3}} />
                  <p style={{margin:0, fontWeight:600}}>Sacola vazia</p>
                  <p style={{margin:'4px 0 0', fontSize:'13px'}}>Adicione produtos para continuar</p>
                </div>
              ) : (
                items.map(item => <CartItemComponent key={item.id} item={item} onUpdateQuantity={updateQuantity} onUpdateObservations={updateObservations} onRemove={removeItem} />)
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div style={{
                padding:'16px 20px 28px',
                borderTop:'1px solid #f3f4f6',
                background:'#fff',
                display:'flex', flexDirection:'column', gap:'10px',
              }}>
                {/* Total */}
                <div style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  background:'#f8f9fb', borderRadius:'14px', padding:'12px 16px',
                }}>
                  <span style={{fontWeight:700, fontSize:'15px', color:'#374151'}}>Total do pedido</span>
                  <span style={{fontWeight:800, fontSize:'18px', color:'#16a34a'}}>{formatCurrency(totalPrice)}</span>
                </div>

                {/* Botão WhatsApp */}
                <button
                  onClick={() => setShowForm(true)}
                  style={{
                    width:'100%', padding:'15px',
                    background:'linear-gradient(135deg, #25D366, #128C7E)',
                    color:'white', border:'none', borderRadius:'16px',
                    fontWeight:800, fontSize:'16px', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                    boxShadow:'0 4px 16px rgba(37,211,102,0.35)',
                  }}
                >
                  <MessageCircle size={20} /> Pedir pelo WhatsApp
                </button>

                {/* Voltar + Limpar */}
                <div style={{display:'flex', gap:'8px'}}>
                  <button
                    onClick={() => setIsOpen(false)}
                    style={{
                      flex:1, padding:'12px',
                      background:'#fff', border:'1.5px solid #fce7f3',
                      borderRadius:'14px', fontWeight:700, fontSize:'14px',
                      color:'#ec4899', cursor:'pointer',
                    }}
                  >
                    Continuar comprando
                  </button>
                  <button
                    onClick={clearCart}
                    style={{
                      padding:'12px 14px',
                      background:'#fff', border:'1.5px solid #fee2e2',
                      borderRadius:'14px', cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal dados pedido */}
      {showForm && (
        <div
          onClick={() => setShowForm(false)}
          style={{
            position:'fixed', inset:0, zIndex:9999,
            background:'rgba(0,0,0,0.55)',
            display:'flex', alignItems:'flex-end', justifyContent:'center',
            backdropFilter:'blur(2px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:'#fff',
              borderRadius:'24px 24px 0 0',
              width:'100%', maxWidth:'480px',
              padding:'20px 20px 36px',
              boxShadow:'0 -8px 40px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{display:'flex',justifyContent:'center',marginBottom:'16px'}}>
              <div style={{width:'40px',height:'4px',borderRadius:'2px',background:'#e5e7eb'}} />
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'20px'}}>
              <div style={{width:'38px',height:'38px',borderRadius:'12px',background:'linear-gradient(135deg,#dcfce7,#f0fdf4)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <MessageCircle size={18} color="#16a34a" />
              </div>
              <div>
                <p style={{margin:0,fontWeight:800,fontSize:'17px',color:'#111827'}}>Finalizar Pedido</p>
                <p style={{margin:0,fontSize:'12px',color:'#9ca3af'}}>Preencha seus dados para continuar</p>
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'12px',marginBottom:'20px'}}>
              <div>
                <label style={{fontSize:'13px',fontWeight:600,color:'#374151',display:'block',marginBottom:'6px'}}>Seu nome</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Como devemos te chamar?"
                  style={{
                    width:'100%', padding:'12px 14px',
                    border:'1.5px solid #e5e7eb', borderRadius:'12px',
                    fontSize:'15px', color:'#111827', outline:'none',
                    boxSizing:'border-box', fontFamily:'inherit',
                  }}
                  onFocus={e => e.target.style.borderColor='#ec4899'}
                  onBlur={e => e.target.style.borderColor='#e5e7eb'}
                />
              </div>
              <div>
                <label style={{fontSize:'13px',fontWeight:600,color:'#374151',display:'block',marginBottom:'6px'}}>WhatsApp</label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(00) 9 0000-0000"
                  type="tel"
                  style={{
                    width:'100%', padding:'12px 14px',
                    border:'1.5px solid #e5e7eb', borderRadius:'12px',
                    fontSize:'15px', color:'#111827', outline:'none',
                    boxSizing:'border-box', fontFamily:'inherit',
                  }}
                  onFocus={e => e.target.style.borderColor='#ec4899'}
                  onBlur={e => e.target.style.borderColor='#e5e7eb'}
                />
              </div>
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              <button
                onClick={() => setShowForm(false)}
                style={{
                  flex:1, padding:'13px',
                  background:'#fff', border:'1.5px solid #e5e7eb',
                  borderRadius:'14px', fontWeight:600, fontSize:'14px',
                  color:'#6b7280', cursor:'pointer',
                }}
              >
                Voltar
              </button>
              <button
                onClick={sendOrder}
                style={{
                  flex:2, padding:'13px',
                  background:'linear-gradient(135deg,#25D366,#128C7E)',
                  border:'none', borderRadius:'14px',
                  color:'white', fontWeight:800, fontSize:'15px',
                  cursor:'pointer', display:'flex', alignItems:'center',
                  justifyContent:'center', gap:'8px',
                  boxShadow:'0 4px 16px rgba(37,211,102,0.35)',
                }}
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

import { useState } from 'react'
import { ShoppingCart, X, MessageCircle, Trash2 } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { CartItemComponent } from '@/components/cart/CartItemComponent'
import { formatCurrency } from '@/utils/helpers'

export function DesktopNavigationMenu() {
  const { items, totalPrice, updateQuantity, updateObservations, removeItem, clearCart } = useCart()
  const [isOpen, setIsOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const count = items.reduce((acc, i) => acc + (i.saleType === 'kg' ? 1 : Math.floor(i.quantity)), 0)

  const sendOrder = () => {
    if (!name.trim() || !phone.trim()) return alert('Preencha nome e telefone')
    const whatsapp = localStorage.getItem('cardapio_whatsapp') || '41998843669'
    const storeName = localStorage.getItem('cardapio_nome') || 'Cardápio'
    let msg = `Olá! 👋\n\n🧁 NOVO PEDIDO - ${storeName.toUpperCase()}\n\n👤 ${name}\n📞 ${phone}\n\n🛒 PEDIDO:\n\n`
    items.forEach((item, i) => {
      msg += `${i + 1}. ${item.name}\n   Qtd: ${item.saleType === 'kg' ? `${item.quantity}kg` : `${item.quantity} un`}\n   Subtotal: ${formatCurrency(item.price * item.quantity)}\n\n`
    })
    msg += `💰 TOTAL: ${formatCurrency(totalPrice)}`
    window.open(`https://wa.me/55${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank')
    clearCart(); setShowForm(false); setIsOpen(false)
  }

  return (
    <>
      <div className="fixed left-0 top-0 bottom-0 z-30 shadow-lg border-r w-20 flex flex-col justify-center"
        style={{ background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 50%, #f9a8d4 100%)' }}>
        <div className="px-4 py-3 flex justify-center">
          <button onClick={() => setIsOpen(true)} className="bg-white text-pink-600 relative p-3 rounded-full flex items-center justify-center">
            <ShoppingCart className="w-6 h-6" />
            {count > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">{count}</span>}
          </button>
        </div>
      </div>
      <div className="w-20" />

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="font-bold text-pink-600 flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Meu Carrinho</h3>
              <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center"><X className="w-4 h-4 text-pink-600" /></button>
            </div>
            <div className="p-4">
              {items.length === 0 ? (
                <div className="text-center py-8 text-gray-400"><ShoppingCart className="w-12 h-12 mx-auto mb-3" /><p>Carrinho vazio</p></div>
              ) : (
                <div className="space-y-3">
                  {items.map(item => <CartItemComponent key={item.id} item={item} onUpdateQuantity={updateQuantity} onUpdateObservations={updateObservations} onRemove={removeItem} />)}
                  <div className="border-t pt-3 flex justify-between font-bold text-lg"><span>Total:</span><span className="text-green-600">{formatCurrency(totalPrice)}</span></div>
                  <button onClick={() => setShowForm(true)} className="w-full py-3 rounded-xl text-white font-bold flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
                    <MessageCircle className="w-5 h-5" /> Pedir pelo WhatsApp
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => setIsOpen(false)} className="flex-1 py-2 rounded-xl border border-pink-300 text-pink-600 font-medium">Voltar</button>
                    <button onClick={clearCart} className="py-2 px-3 rounded-xl bg-red-500 text-white"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4">Seus Dados</h3>
            <div className="space-y-3">
              <div><label className="text-sm font-medium text-gray-700">Nome</label><input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 p-2 border rounded-lg" /></div>
              <div><label className="text-sm font-medium text-gray-700">WhatsApp</label><input value={phone} onChange={e => setPhone(e.target.value)} className="w-full mt-1 p-2 border rounded-lg" /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border">Cancelar</button>
              <button onClick={sendOrder} className="flex-1 py-2 rounded-lg bg-green-600 text-white font-bold">Enviar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

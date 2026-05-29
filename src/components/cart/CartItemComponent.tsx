import { Trash2, Plus, Minus } from 'lucide-react'
import { CartItem } from '@/types/cart'
import { formatCurrency } from '@/utils/helpers'

interface Props {
  item: CartItem
  onUpdateQuantity: (id: string, quantity: number) => void
  onUpdateObservations: (id: string, observations: string) => void
  onRemove: (id: string) => void
}

export function CartItemComponent({ item, onUpdateQuantity, onRemove }: Props) {
  const dec = () => {
    const d = item.saleType === 'kg' ? 0.5 : 1
    if (item.quantity > d) onUpdateQuantity(item.id, item.quantity - d)
    else onRemove(item.id)
  }
  const inc = () => onUpdateQuantity(item.id, item.quantity + (item.saleType === 'kg' ? 0.5 : 1))

  return (
    <div className="flex gap-3 p-3 bg-white border-2 border-pink-100 rounded-xl shadow-sm">
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-pink-50 flex-shrink-0">
        {item.imageUrl ? <img src={item.imageUrl.split(',')[0]} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">🧁</div>}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <h4 className="font-bold text-gray-900 truncate text-sm">{item.name}</h4>
        {item.selectedMassa && <span className="text-xs text-pink-600">🎂 {item.selectedMassa}</span>}
        {item.selectedRecheio && <span className="text-xs text-purple-600">🥄 {item.selectedRecheio}</span>}
        <div className="flex items-center justify-between mt-1">
          <span className="font-bold text-green-600 text-sm">{formatCurrency(item.price * item.quantity)}</span>
          <div className="flex items-center gap-1 bg-pink-50 rounded-full px-1 py-0.5">
            <button onClick={dec} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-pink-200"><Minus className="w-3 h-3 text-pink-600" /></button>
            <span className="text-xs font-bold text-pink-800 w-8 text-center">{item.saleType === 'kg' ? `${item.quantity}kg` : `${item.quantity}un`}</span>
            <button onClick={inc} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-pink-200"><Plus className="w-3 h-3 text-pink-600" /></button>
          </div>
        </div>
      </div>
      <button onClick={() => onRemove(item.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
    </div>
  )
}

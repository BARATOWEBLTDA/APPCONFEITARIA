import { useState, useEffect } from 'react'
import { X, Plus, Minus, Check } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { Produto } from '@/types/database'
import { formatCurrency } from '@/utils/helpers'

interface Props {
  isOpen: boolean
  onClose: () => void
  product: Produto | null
}

export function ProductModal({ isOpen, onClose, product }: Props) {
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [observations, setObservations] = useState('')
  const [selectedMassa, setSelectedMassa] = useState('')
  const [selectedRecheio, setSelectedRecheio] = useState('')
  const [selectedCobertura, setSelectedCobertura] = useState('')

  useEffect(() => {
    if (product) { setQuantity(1); setObservations(''); setSelectedMassa(''); setSelectedRecheio(''); setSelectedCobertura('') }
  }, [product])

  if (!isOpen || !product) return null

  const inc = () => setQuantity(q => Math.min(q + (product.forma_venda === 'kg' ? 0.5 : 1), 50))
  const dec = () => setQuantity(q => Math.max(q - (product.forma_venda === 'kg' ? 0.5 : 1), product.forma_venda === 'kg' ? 0.5 : 1))

  const handleAdd = () => {
    addItem({ id: product.id, name: product.nome, description: product.descricao || '', price: product.preco_normal, imageUrl: product.imagem_url, saleType: product.forma_venda, quantity, observations, selectedMassa, selectedRecheio, selectedCobertura })
    onClose()
  }

  const firstImage = product.imagem_url?.split(',')[0]?.trim()

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 cursor-pointer" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 max-w-sm w-[90vw] max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 bg-white/90 backdrop-blur p-4 flex items-center justify-between border-b z-10">
          <h2 className="text-base font-bold text-pink-600">Personalize seu Pedido</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-5">
          <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-50">
            {firstImage ? <img src={firstImage} alt={product.nome} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-5xl bg-pink-50">🧁</div>}
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900">{product.nome}</h3>
            {product.descricao && <p className="text-gray-500 text-sm mt-1">{product.descricao}</p>}
            <span className="text-2xl font-black text-pink-600 mt-2 block">{formatCurrency(product.preco_normal)}</span>
          </div>

          {/* Quantidade */}
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-gray-400 block mb-2">Quantidade</label>
            <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-100">
              <button onClick={dec} className="h-10 w-10 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
              <span className="flex-1 text-center font-black text-xl">{product.forma_venda === 'kg' ? `${quantity}kg` : `${quantity} un`}</span>
              <button onClick={inc} className="h-10 w-10 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Massa */}
          {product.permite_personalizacao && product.massas_disponiveis && product.massas_disponiveis.length > 0 && (
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-pink-600 block mb-2">Escolha a Massa</label>
              <div className="grid grid-cols-1 gap-2">
                {product.massas_disponiveis.map(m => (
                  <button key={m} onClick={() => setSelectedMassa(m)} className={`flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold border-2 transition-all ${selectedMassa === m ? 'bg-pink-500 border-pink-500 text-white' : 'bg-white border-gray-100 text-gray-600'}`}>
                    <span>{m}</span>
                    {selectedMassa === m && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recheio */}
          {product.permite_personalizacao && product.recheios_disponiveis && product.recheios_disponiveis.length > 0 && (
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-pink-600 block mb-2">Escolha o Recheio</label>
              <div className="grid grid-cols-1 gap-2">
                {product.recheios_disponiveis.map(r => (
                  <button key={r} onClick={() => setSelectedRecheio(r)} className={`flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold border-2 transition-all ${selectedRecheio === r ? 'bg-pink-500 border-pink-500 text-white' : 'bg-white border-gray-100 text-gray-600'}`}>
                    <span>{r}</span>
                    {selectedRecheio === r && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-gray-400 block mb-2">Observações</label>
            <textarea value={observations} onChange={e => setObservations(e.target.value)} placeholder="Ex: Sem cereja, embalagem para presente..." className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-3 text-sm min-h-[80px] focus:outline-none focus:border-pink-400" />
          </div>

          <div className="bg-gray-900 rounded-2xl p-4 flex flex-col">
            <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Total</span>
            <span className="text-2xl font-black text-white">{formatCurrency(product.preco_normal * quantity)}</span>
          </div>

          <div className="flex flex-col gap-3 pb-4">
            <button onClick={handleAdd} className="w-full bg-pink-600 hover:bg-pink-700 text-white font-black py-4 rounded-2xl text-base shadow-lg">Adicionar ao Carrinho</button>
            <button onClick={onClose} className="w-full text-gray-600 font-bold py-2">Cancelar</button>
          </div>
        </div>
      </div>
    </>
  )
}

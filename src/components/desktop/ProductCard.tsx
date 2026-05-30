import { useState } from 'react'
import { Heart } from 'lucide-react'
import { Produto } from '@/types/database'
import { ProductModal } from '@/components/cart/ProductModal'

interface Props {
  product: Produto
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  backgroundColor: string
  borderColor?: string
}

export function DesktopProductCard({ product, isFavorite, onToggleFavorite, backgroundColor, borderColor = '#ec4899' }: Props) {
  const [showModal, setShowModal] = useState(false)
  const firstImage = product.imagem_url?.split(',')[0]?.trim() || null
  const formatSale = (s: string) => {
    const m: { [k: string]: string } = { 'tamanho-p': 'P', 'tamanho-m': 'M', 'tamanho-g': 'G', 'tamanho-xg': 'XG', 'kg': 'KG', 'cento': '100', 'sob-encomenda': 'Encomenda', 'outros': 'OUT' }
    return m[s] || 'UN'
  }
  return (
    <>
      <div className={`bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all h-full flex flex-col ${product.promocao ? 'border-4 border-dashed border-pink-500' : 'border-4 border-gray-100'}`}>
        <div className="p-4 flex-1 flex flex-col">
          <div className="w-full aspect-square rounded-xl flex items-center justify-center mb-4 bg-gray-50 overflow-hidden relative" style={{ backgroundColor }}>
            {firstImage ? <img src={firstImage} alt={product.nome} className="w-full h-full object-cover rounded-xl" /> : <span className="text-5xl">🧁</span>}
            {product.promocao && <div className="absolute top-4 -right-12 bg-red-500 text-white font-bold px-6 py-2 transform rotate-45 shadow-lg z-10" style={{ width: '180px', textAlign: 'center', fontSize: '0.8rem' }}>PROMOÇÃO</div>}
          </div>
          <div className="flex-1 flex flex-col">
            <div className="flex justify-between items-start mb-3">
              <h4 className="font-bold text-lg leading-tight flex-1 line-clamp-2">{product.nome}</h4>
              <button onClick={() => onToggleFavorite(product.id)} className="p-2 text-gray-400 hover:text-red-500 ml-3 flex-shrink-0"><Heart className="w-5 h-5" style={{ fill: isFavorite ? '#ef4444' : 'none' }} /></button>
            </div>
            <p className="text-gray-600 text-base mb-4 line-clamp-3 flex-1">{product.descricao}</p>
            <div className="mt-auto">
              {product.promocao && product.preco_promocional ? (
                <div className="mb-4">
                  <span className="text-lg text-red-500 line-through block">R$ {product.preco_normal.toFixed(2)}</span>
                  <div className="flex items-center gap-2"><span className="text-2xl font-bold text-green-600">R$ {product.preco_promocional.toFixed(2)}</span><span className="text-sm px-3 py-1 rounded-md" style={{ backgroundColor: '#6A0122', color: 'white' }}>{formatSale(product.forma_venda)}</span></div>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-4"><span className="text-2xl font-bold text-green-600">R$ {product.preco_normal.toFixed(2)}</span><span className="text-sm px-3 py-1 rounded-md" style={{ backgroundColor: '#6A0122', color: 'white' }}>{formatSale(product.forma_venda)}</span></div>
              )}
              <button onClick={() => setShowModal(true)} className="w-full py-3 px-4 rounded-xl text-white text-base font-semibold hover:scale-105 shadow-lg transition-all" style={{ backgroundColor: '#FF4F97' }}>Adicionar ao carrinho</button>
            </div>
          </div>
        </div>
      </div>
      <ProductModal isOpen={showModal} onClose={() => setShowModal(false)} product={product} />
    </>
  )
}

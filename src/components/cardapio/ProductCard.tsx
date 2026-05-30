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

const catIcons: { [k: string]: string } = { 'Bolos': '🎂', 'Cupcakes': '🧁', 'Doces': '🍮', 'Salgados': '🥐' }

export function ProductCard({ product, isFavorite, onToggleFavorite, backgroundColor, borderColor = '#ec4899' }: Props) {
  const [showModal, setShowModal] = useState(false)
  const firstImage = product.imagem_url?.split(',')[0]?.trim() || null

  const formatSale = (s: string) => {
    const m: { [k: string]: string } = { 'tamanho-p': 'P', 'tamanho-m': 'M', 'tamanho-g': 'G', 'tamanho-xg': 'XG', 'kg': 'KG', 'cento': '100', 'sob-encomenda': 'Encomenda', 'outros': 'OUT' }
    return m[s] || 'Unidade'
  }

  return (
    <>
      <div className={`bg-white rounded-lg overflow-hidden shadow-sm h-full flex flex-col ${product.promocao ? 'border-2 border-dashed border-pink-500' : 'border border-gray-100'}`}>
        <div className="p-3 flex-1 flex flex-col">
          <div className="w-full aspect-square rounded-lg flex items-center justify-center mb-3 bg-gray-50 overflow-hidden relative" style={{ backgroundColor }}>
            {firstImage ? (
              <img src={firstImage} alt={product.nome} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <span className="text-2xl">{catIcons[product.categoria] || '🧁'}</span>
            )}
            {product.promocao && (
              <div className="absolute top-3 -right-10 bg-red-500 text-white font-bold px-4 py-1 transform rotate-45 shadow-md z-10" style={{ width: '130px', textAlign: 'center', fontSize: '0.6rem' }}>PROMOÇÃO</div>
            )}
          </div>
          <div className="flex-1 flex flex-col">
            <div className="flex justify-between items-start mb-1">
              <h4 className="font-semibold text-xs leading-tight flex-1 line-clamp-2">{product.nome}</h4>
              <button onClick={() => onToggleFavorite(product.id)} className="p-1 bg-transparent border-none cursor-pointer text-gray-400 hover:text-red-500 ml-1 flex-shrink-0">
                <Heart className="w-3 h-3" style={{ fill: isFavorite ? '#ef4444' : 'none' }} />
              </button>
            </div>
            <p className="text-gray-500 text-xs mb-2 line-clamp-4 leading-tight flex-1">{product.descricao}</p>
            <div className="mt-auto">
              {product.promocao && product.preco_promocional ? (
                <div className="mb-2">
                  <span className="text-sm text-red-500 line-through block">R$ {product.preco_normal.toFixed(2)}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-bold text-green-600">R$ {product.preco_promocional.toFixed(2)}</span>
                    <span className="text-xs px-1 py-0 rounded-sm" style={{ backgroundColor: '#6A0122', color: 'white' }}>{formatSale(product.forma_venda)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-lg font-bold text-green-600">R$ {product.preco_normal.toFixed(2)}</span>
                  <span className="text-xs px-1 py-0 rounded-sm" style={{ backgroundColor: '#6A0122', color: 'white' }}>{formatSale(product.forma_venda)}</span>
                </div>
              )}
              <button onClick={() => setShowModal(true)} className="w-full py-2 px-3 rounded-lg text-white text-xs font-medium text-center" style={{ backgroundColor: '#FF4F97' }}>
                Adicionar ao carrinho
              </button>
            </div>
          </div>
        </div>
      </div>
      <ProductModal isOpen={showModal} onClose={() => setShowModal(false)} product={product} />
    </>
  )
}

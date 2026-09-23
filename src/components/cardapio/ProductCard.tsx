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
  corBotao?: string
}

const catIcons: { [k: string]: string } = { 'Bolos': '🎂', 'Cupcakes': '🧁', 'Doces': '🍮', 'Salgados': '🥐' }

export function ProductCard({ product, isFavorite, onToggleFavorite, backgroundColor, borderColor = '#E85A8C', corBotao = '#E85A8C' }: Props) {
  const [showModal, setShowModal] = useState(false)
  const firstImage = product.imagem_url?.split(',')[0]?.trim() || null

  const formatSale = (s: string) => {
    const m: { [k: string]: string } = { 'tamanho-p': 'P', 'tamanho-m': 'M', 'tamanho-g': 'G', 'tamanho-xg': 'XG', 'kg': 'KG', 'cento': '100', 'sob-encomenda': 'Encomenda', 'outros': 'OUT' }
    return m[s] || 'Unidade'
  }

  // Calcula preço promocional considerando % ou fixo
  const p = product as any
  const isPromo = product.promocao
  const isPct = p.tipo_promocao === 'percentual' && p.desconto_percentual > 0
  const descRatio = isPromo
    ? isPct
      ? p.desconto_percentual / 100
      : product.preco_promocional && product.preco_normal > 0
        ? 1 - (product.preco_promocional / product.preco_normal)
        : 0
    : 0
  const precoPromocional = isPromo && descRatio > 0
    ? parseFloat((product.preco_normal * (1 - descRatio)).toFixed(2))
    : (product.preco_promocional || 0)

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        className="bg-white rounded-xl overflow-hidden shadow-sm h-full flex flex-col border border-gray-100 cursor-pointer transition-shadow hover:shadow-md"
      >
        <div className="w-full aspect-square bg-gray-50 flex items-center justify-center overflow-hidden relative">
          {firstImage ? (
            <img src={firstImage} alt={product.nome} className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl">{catIcons[product.categoria] || '🧁'}</span>
          )}
          {product.promocao && (
            <div className="absolute top-3 -right-10 bg-red-500 text-white font-bold px-4 py-1 transform rotate-45 shadow-md z-10" style={{ width: '130px', textAlign: 'center', fontSize: '0.6rem' }}>PROMOÇÃO</div>
          )}
        </div>
        <div className="p-3 flex-1 flex flex-col items-center text-center">
          <h4 className="font-bold leading-tight line-clamp-2 mb-1" style={{ color: '#2C1219', fontSize: '13px' }}>{product.nome}</h4>
          <p className="text-gray-500 line-clamp-3 mb-2" style={{ fontSize: '11.5px', lineHeight: 1.4 }}>{product.descricao}</p>
          <div className="mt-auto flex items-baseline justify-center gap-1.5 flex-wrap">
            {isPromo && precoPromocional > 0 ? (
              <>
                <span className="text-red-500 line-through" style={{ fontSize: '11px' }}>R$ {product.preco_normal.toFixed(2)}</span>
                <span className="text-lg font-bold text-green-600">R$ {precoPromocional.toFixed(2)}</span>
                <span style={{ fontSize: '9.5px', color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.03em' }}>/ {formatSale(product.forma_venda).toLowerCase()}</span>
              </>
            ) : (
              <>
                <span className="text-lg font-bold text-green-600">R$ {product.preco_normal.toFixed(2)}</span>
                <span style={{ fontSize: '9.5px', color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.03em' }}>/ {formatSale(product.forma_venda).toLowerCase()}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <ProductModal isOpen={showModal} onClose={() => setShowModal(false)} product={product} corBotao={corBotao} />
    </>
  )
}

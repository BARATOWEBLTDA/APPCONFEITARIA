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

export function DesktopProductCard({ product, isFavorite, onToggleFavorite, backgroundColor, borderColor = '#ec4899', corBotao = '#ec4899' }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [hover, setHover] = useState(false)
  const firstImage = product.imagem_url?.split(',')[0]?.trim() || null

  const formatSale = (s: string) => {
    const m: Record<string, string> = { 'tamanho-p':'P','tamanho-m':'M','tamanho-g':'G','tamanho-xg':'XG','kg':'KG','cento':'100','sob-encomenda':'Enc','outros':'OUT' }
    return m[s] || 'UN'
  }

  return (
    <>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          background: '#fff',
          borderRadius: '12px',
          overflow: 'hidden',
          border: product.promocao ? '2px solid #f87171' : '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          transition: 'box-shadow 0.2s, transform 0.2s',
          boxShadow: hover ? '0 8px 24px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.06)',
          transform: hover ? 'translateY(-2px)' : 'none',
          cursor: 'pointer',
          position: 'relative',
        }}
        onClick={() => setShowModal(true)}
      >
        {/* Badge promoção */}
        {product.promocao && (
          <div style={{
            position: 'absolute', top: '10px', left: '10px', zIndex: 10,
            background: '#ef4444', color: 'white',
            fontSize: '10px', fontWeight: 800,
            padding: '3px 8px', borderRadius: '6px',
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            Promoção
          </div>
        )}

        {/* Favorito */}
        <button
          onClick={e => { e.stopPropagation(); onToggleFavorite(product.id) }}
          style={{
            position: 'absolute', top: '10px', right: '10px', zIndex: 10,
            background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%',
            width: '32px', height: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }}
        >
          <Heart size={15} color={isFavorite ? '#ef4444' : '#d1d5db'} fill={isFavorite ? '#ef4444' : 'none'} />
        </button>

        {/* Imagem */}
        <div style={{
          width: '100%', aspectRatio: '4/3',
          background: backgroundColor || '#f9fafb',
          overflow: 'hidden',
        }}>
          {firstImage
            ? <img src={firstImage} alt={product.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>🧁</div>
          }
        </div>

        {/* Conteúdo */}
        <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h4 style={{
            margin: '0 0 4px', fontWeight: 700, fontSize: '14px',
            color: '#1f2937', lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
          }}>
            {product.nome}
          </h4>

          <p style={{
            margin: '0 0 10px', fontSize: '12px', color: '#9ca3af',
            lineHeight: 1.4,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
            flex: 1,
          }}>
            {product.descricao}
          </p>

          {/* Preço */}
          <div style={{ marginTop: 'auto' }}>
            {product.promocao && product.preco_promocional ? (
              <div style={{ marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', color: '#ef4444', textDecoration: 'line-through' }}>
                  R$ {product.preco_normal.toFixed(2)}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a' }}>
                    R$ {product.preco_promocional.toFixed(2)}
                  </span>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '2px 6px',
                    borderRadius: '4px', background: '#374151', color: 'white',
                  }}>
                    {formatSale(product.forma_venda)}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a' }}>
                  R$ {product.preco_normal.toFixed(2)}
                </span>
                <span style={{
                  fontSize: '10px', fontWeight: 700, padding: '2px 6px',
                  borderRadius: '4px', background: '#374151', color: 'white',
                }}>
                  {formatSale(product.forma_venda)}
                </span>
              </div>
            )}

            {/* Botão */}
            <button
              onClick={e => { e.stopPropagation(); setShowModal(true) }}
              style={{
                width: '100%', padding: '10px',
                borderRadius: '10px', border: 'none',
                background: corBotao, color: 'white',
                fontSize: '13px', fontWeight: 700,
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Adicionar ao carrinho
            </button>
          </div>
        </div>
      </div>
      <ProductModal isOpen={showModal} onClose={() => setShowModal(false)} product={product} corBotao={corBotao} />
    </>
  )
}

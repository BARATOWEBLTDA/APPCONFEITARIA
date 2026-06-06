import { useState } from 'react'
import { Search } from 'lucide-react'
import { ProductCard } from './ProductCard'
import { Produto } from '@/types/database'
import { ProductModal } from '@/components/cart/ProductModal'

interface Props {
  produtos: Produto[]
  favorites: string[]
  onToggleFavorite: (id: string) => void
  backgroundColor: string
  borderColor: string
  corBotao?: string
  selectedCategory: string | null
  searchTerm: string
  onSearchChange: (t: string) => void
}

export function ProductList({ produtos, favorites, onToggleFavorite, backgroundColor, borderColor, corBotao = '#ec4899', selectedCategory, searchTerm, onSearchChange }: Props) {
  const [viewMode, setViewMode] = useState<'grid' | 'lista'>(() =>
    (localStorage.getItem('cardapio_viewMode') as 'grid' | 'lista') || 'grid'
  )
  const [modalProduct, setModalProduct] = useState<Produto | null>(null)

  const toggleView = (mode: 'grid' | 'lista') => {
    setViewMode(mode)
    localStorage.setItem('cardapio_viewMode', mode)
  }

  const filtered = produtos.filter(p => {
    const s = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || p.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
    const c = !selectedCategory || p.categoria === selectedCategory
    return s && c
  })
  const promo = filtered.filter(p => p.promocao)
  const regular = filtered.filter(p => !p.promocao)

  const ListItem = ({ p }: { p: Produto }) => {
    const isPromo = p.promocao
    const descPct = (p as any).tipo_promocao === 'percentual' && isPromo ? ((p as any).desconto_percentual || 0) / 100 : 0
    const descRatio = isPromo
      ? descPct > 0 ? descPct : p.preco_promocional && p.preco_normal > 0 ? 1 - (p.preco_promocional / p.preco_normal) : 0
      : 0
    const precoPromo = isPromo && descRatio > 0 ? parseFloat((p.preco_normal * (1 - descRatio)).toFixed(2)) : 0
    const firstImage = p.imagem_url?.split(',')[0]?.trim() || null

    return (
      <div onClick={() => setModalProduct(p)} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'white', borderRadius: '14px', padding: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer', border: isPromo ? '1.5px dashed #ec4899' : '1px solid #f3f4f6' }}>
        {/* Imagem */}
        <div style={{ width: '72px', height: '72px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: '#fdf2f8' }}>
          {firstImage
            ? <img src={firstImage} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🧁</div>
          }
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</p>
          {p.descricao && <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descricao}</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isPromo && precoPromo > 0
              ? <>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', textDecoration: 'line-through' }}>R$ {p.preco_normal.toFixed(2)}</span>
                  <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ec4899' }}>R$ {precoPromo.toFixed(2)}</span>
                </>
              : <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#22c55e' }}>R$ {p.preco_normal.toFixed(2)}</span>
            }
          </div>
        </div>
        {/* Botão */}
        <button onClick={e => { e.stopPropagation(); setModalProduct(p); }} style={{ flexShrink: 0, padding: '8px 12px', background: corBotao, color: 'white', border: 'none', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          + Adicionar
        </button>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor }}>
      {/* Barra de busca + toggle */}
      <div className="mb-4 px-4">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input type="text" placeholder="Buscar produtos..." value={searchTerm} onChange={e => onSearchChange(e.target.value)} className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-lg focus:border-pink-400 focus:outline-none" style={{ backgroundColor: '#fff' }} />
          </div>
          {/* Toggle grid/lista */}
          <div style={{ display: 'flex', background: 'white', borderRadius: '10px', padding: '3px', gap: '2px', border: '1px solid #f3f4f6', flexShrink: 0 }}>
            <button onClick={() => toggleView('grid')} style={{ width: '34px', height: '34px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: viewMode === 'grid' ? '#fdf2f8' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={viewMode === 'grid' ? '#ec4899' : '#9ca3af'} strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
            <button onClick={() => toggleView('lista')} style={{ width: '34px', height: '34px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: viewMode === 'lista' ? '#fdf2f8' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={viewMode === 'lista' ? '#ec4899' : '#9ca3af'} strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
          </div>
        </div>
      </div>

      {promo.length > 0 && (
        <div className="mb-6 px-4">
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><span>🔥</span> Promoções</h3>
          {viewMode === 'grid'
            ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {promo.map(p => <ProductCard key={p.id} product={p} isFavorite={favorites.includes(p.id)} onToggleFavorite={onToggleFavorite} backgroundColor={backgroundColor} borderColor={borderColor} corBotao={corBotao} />)}
              </div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {promo.map(p => <ListItem key={p.id} p={p} />)}
              </div>
          }
        </div>
      )}

      {regular.length > 0 && (
        <div className="mb-6 px-4">
          <h3 className="font-semibold text-lg mb-3">{selectedCategory || 'Todos os Produtos'}</h3>
          {viewMode === 'grid'
            ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {regular.map(p => <ProductCard key={p.id} product={p} isFavorite={favorites.includes(p.id)} onToggleFavorite={onToggleFavorite} backgroundColor={backgroundColor} borderColor={borderColor} corBotao={corBotao} />)}
              </div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {regular.map(p => <ListItem key={p.id} p={p} />)}
              </div>
          }
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500 px-4">
          <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Nenhum produto encontrado</p>
        </div>
      )}

      {modalProduct && (
        <ProductModal isOpen={!!modalProduct} onClose={() => setModalProduct(null)} product={modalProduct} corBotao={corBotao} />
      )}
    </div>
  )
}

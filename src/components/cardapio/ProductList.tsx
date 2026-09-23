import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, Check } from 'lucide-react'
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
  categories?: string[]
  onCategorySelect?: (cat: string | null) => void
  categoryCounts?: Record<string, number>
}

export function ProductList({ produtos, favorites, onToggleFavorite, backgroundColor, borderColor, corBotao = '#E85A8C', selectedCategory, searchTerm, onSearchChange, categories = [], onCategorySelect, categoryCounts = {} }: Props) {
  const [viewMode] = useState<'grid' | 'lista'>('grid')
  const [modalProduct, setModalProduct] = useState<Produto | null>(null)
  const [catOpen, setCatOpen] = useState(false)
  const catRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!catOpen) return
    const handler = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [catOpen])

  const totalProdutos = Object.values(categoryCounts).reduce((a: number, b: number) => a + b, 0) || produtos.length
  const catLabel = selectedCategory || 'Categorias'

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
      <div onClick={() => setModalProduct(p)} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-card)', borderRadius: '14px', padding: '10px', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', border: '1px solid #f3f4f6' }}>
        {/* Imagem */}
        <div style={{ width: '72px', height: '72px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: '#fdf2f8' }}>
          {firstImage
            ? <img src={firstImage} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🧁</div>
          }
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-title)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</p>
          {p.descricao && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descricao}</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isPromo && precoPromo > 0
              ? <>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>R$ {p.preco_normal.toFixed(2)}</span>
                  <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#E85A8C' }}>R$ {precoPromo.toFixed(2)}</span>
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
    <div>
      {/* Barra de busca + botão Categorias */}
      <div className="mb-4 px-4">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input type="text" placeholder="Buscar produtos..." value={searchTerm} onChange={e => onSearchChange(e.target.value)} className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-lg focus:border-pink-400 focus:outline-none" style={{ backgroundColor: '#fff' }} />
          </div>
          {/* Botão Categorias com dropdown */}
          {onCategorySelect && categories.length > 0 && (
            <div ref={catRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => setCatOpen(v => !v)}
                style={{
                  background: selectedCategory ? corBotao : '#F5F0F2',
                  color: selectedCategory ? '#fff' : '#2C1219',
                  borderRadius: '10px',
                  padding: '11px 14px',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'inherit',
                  transition: 'background 0.15s',
                  whiteSpace: 'nowrap',
                  maxWidth: '160px',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{catLabel}</span>
                <ChevronDown size={14} style={{ transform: catOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s', flexShrink: 0 }} />
              </button>

              {catOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: '#fff',
                  borderRadius: '12px',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.15), 0 0 0 1px #F0EBED',
                  padding: '6px',
                  zIndex: 30,
                  minWidth: '200px',
                  maxHeight: '340px',
                  overflowY: 'auto',
                }}>
                  <button
                    onClick={() => { onCategorySelect(null); setCatOpen(false) }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '13px',
                      color: !selectedCategory ? corBotao : '#2C1219',
                      background: !selectedCategory ? `${corBotao}0F` : 'transparent',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontWeight: !selectedCategory ? 700 : 500,
                      fontFamily: 'inherit',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {!selectedCategory && <Check size={13} />}
                      Todos os produtos
                    </span>
                    <span style={{
                      fontSize: '11px',
                      color: !selectedCategory ? '#fff' : '#9CA3AF',
                      background: !selectedCategory ? corBotao : '#F5F0F2',
                      padding: '2px 8px',
                      borderRadius: '20px',
                      fontWeight: 700,
                    }}>{totalProdutos}</span>
                  </button>
                  {categories.map(cat => {
                    const isSel = selectedCategory === cat
                    const count = categoryCounts[cat] ?? 0
                    return (
                      <button
                        key={cat}
                        onClick={() => { onCategorySelect(cat); setCatOpen(false) }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          fontSize: '13px',
                          color: isSel ? corBotao : '#2C1219',
                          background: isSel ? `${corBotao}0F` : 'transparent',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontWeight: isSel ? 700 : 500,
                          fontFamily: 'inherit',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isSel && <Check size={13} />}
                          {cat}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          color: isSel ? '#fff' : '#9CA3AF',
                          background: isSel ? corBotao : '#F5F0F2',
                          padding: '2px 8px',
                          borderRadius: '20px',
                          fontWeight: 700,
                        }}>{count}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
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

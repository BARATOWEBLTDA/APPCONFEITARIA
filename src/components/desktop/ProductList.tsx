import { Search } from 'lucide-react'
import { DesktopProductCard } from './ProductCard'
import { Produto } from '@/types/database'

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

export function DesktopProductList({ produtos, favorites, onToggleFavorite, backgroundColor, borderColor, corBotao = '#ec4899', selectedCategory, searchTerm, onSearchChange }: Props) {
  const filtered = produtos.filter(p => {
    const s = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || p.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
    const c = !selectedCategory || p.categoria === selectedCategory
    return s && c
  })
  const promo = filtered.filter(p => p.promocao)
  const regular = filtered.filter(p => !p.promocao)

  return (
    <div>
      {/* Search removido - está no top bar */}

      {/* Promoções */}
      {promo.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-title)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔥</span> Promoções
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '16px',
          }}>
            {promo.map(p => <DesktopProductCard key={p.id} product={p} isFavorite={favorites.includes(p.id)} onToggleFavorite={onToggleFavorite} backgroundColor={backgroundColor} borderColor={borderColor} corBotao={corBotao} />)}
          </div>
        </div>
      )}

      {/* Produtos */}
      {regular.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-title)', marginBottom: '16px' }}>
            {selectedCategory || 'Todos os Produtos'}
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '16px',
          }}>
            {regular.map(p => <DesktopProductCard key={p.id} product={p} isFavorite={favorites.includes(p.id)} onToggleFavorite={onToggleFavorite} backgroundColor={backgroundColor} borderColor={borderColor} corBotao={corBotao} />)}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <Search size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 4px' }}>Nenhum produto encontrado</h3>
          <p style={{ fontSize: '13px', margin: 0 }}>Tente buscar por outro termo</p>
        </div>
      )}
    </div>
  )
}

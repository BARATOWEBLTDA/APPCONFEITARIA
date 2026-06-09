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
      {/* Search compacto */}
      <div style={{ maxWidth: '420px', margin: '0 auto 28px', position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input
          type="text"
          placeholder="Buscar produtos..."
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px 10px 40px',
            border: '1.5px solid #e8e8e8', borderRadius: '10px',
            fontSize: '14px', color: '#3e3e3e', outline: 'none',
            fontFamily: 'inherit', boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => (e.target.style.borderColor = corBotao)}
          onBlur={e => (e.target.style.borderColor = '#e8e8e8')}
        />
      </div>

      {/* Promoções */}
      {promo.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1f2937', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1f2937', marginBottom: '16px' }}>
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
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
          <Search size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#6b7280', margin: '0 0 4px' }}>Nenhum produto encontrado</h3>
          <p style={{ fontSize: '13px', margin: 0 }}>Tente buscar por outro termo</p>
        </div>
      )}
    </div>
  )
}

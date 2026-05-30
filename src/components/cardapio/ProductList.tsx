import { Search } from 'lucide-react'
import { ProductCard } from './ProductCard'
import { Produto } from '@/types/database'

interface Props {
  produtos: Produto[]
  favorites: string[]
  onToggleFavorite: (id: string) => void
  backgroundColor: string
  borderColor: string
  selectedCategory: string | null
  searchTerm: string
  onSearchChange: (t: string) => void
}

export function ProductList({ produtos, favorites, onToggleFavorite, backgroundColor, borderColor, selectedCategory, searchTerm, onSearchChange }: Props) {
  const filtered = produtos.filter(p => {
    const s = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || p.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
    const c = !selectedCategory || p.categoria === selectedCategory
    return s && c
  })
  const promo = filtered.filter(p => p.promocao)
  const regular = filtered.filter(p => !p.promocao)

  return (
    <div style={{ backgroundColor }}>
      <div className="mb-6 px-4">
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input type="text" placeholder="Buscar produtos..." value={searchTerm} onChange={e => onSearchChange(e.target.value)} className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-lg focus:border-pink-400 focus:outline-none" style={{ backgroundColor: '#fff' }} />
        </div>
      </div>
      {promo.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><span>🔥</span> Promoções</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {promo.map(p => <ProductCard key={p.id} product={p} isFavorite={favorites.includes(p.id)} onToggleFavorite={onToggleFavorite} backgroundColor={backgroundColor} borderColor={borderColor} />)}
          </div>
        </div>
      )}
      {regular.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-lg mb-3">{selectedCategory || 'Todos os Produtos'}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {regular.map(p => <ProductCard key={p.id} product={p} isFavorite={favorites.includes(p.id)} onToggleFavorite={onToggleFavorite} backgroundColor={backgroundColor} borderColor={borderColor} />)}
          </div>
        </div>
      )}
      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Nenhum produto encontrado</p>
        </div>
      )}
    </div>
  )
}

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
    <div style={{ backgroundColor: '#FEF2F2' }}>
      <div className="mb-8 max-w-2xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input type="text" placeholder="Buscar produtos..." value={searchTerm} onChange={e => onSearchChange(e.target.value)} className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-pink-400 focus:outline-none" />
        </div>
      </div>
      {promo.length > 0 && (
        <div className="mb-10">
          <h3 className="text-2xl font-bold mb-6 flex items-center gap-3"><span>🔥</span> Promoções</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {promo.map(p => <DesktopProductCard key={p.id} product={p} isFavorite={favorites.includes(p.id)} onToggleFavorite={onToggleFavorite} backgroundColor={backgroundColor} borderColor={borderColor} corBotao={corBotao} />)}
          </div>
        </div>
      )}
      {regular.length > 0 && (
        <div className="mb-10">
          <h3 className="text-2xl font-bold mb-6">{selectedCategory || 'Todos os Produtos'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {regular.map(p => <DesktopProductCard key={p.id} product={p} isFavorite={favorites.includes(p.id)} onToggleFavorite={onToggleFavorite} backgroundColor={backgroundColor} borderColor={borderColor} corBotao={corBotao} />)}
          </div>
        </div>
      )}
      {filtered.length === 0 && (
        <div className="text-center py-20 text-gray-400"><Search className="w-16 h-16 mx-auto mb-4" /><h3 className="text-2xl font-bold mb-3">Nenhum produto encontrado</h3></div>
      )}
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { MagnifyingGlass, CaretDown, Check, SquaresFour, X } from '@phosphor-icons/react'
import { ProductCard } from './ProductCard'
import { Produto } from '@/types/database'
import { ProductModal } from '@/components/cart/ProductModal'
import './cardapioLista.css'

/**
 * Lista de produtos do cardápio no celular (08/10 · 3.28).
 * Busca na largura toda; embaixo o botão "Categorias" com a lista que abre (como antes),
 * sem o "Todos" repetido. Promoções primeiro, depois os produtos.
 */
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
  const [modalProduct, setModalProduct] = useState<Produto | null>(null)
  const [catOpen, setCatOpen] = useState(false)
  const catRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!catOpen) return
    const fora = (e: MouseEvent | TouchEvent) => { if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setCatOpen(false) }
    document.addEventListener('mousedown', fora); document.addEventListener('touchstart', fora); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('touchstart', fora); document.removeEventListener('keydown', esc) }
  }, [catOpen])

  // "Todos" vinha junto da lista e aparecia duas vezes ("Todos os produtos 3" e "Todos 0")
  const cats = categories.filter(c => c && c !== 'Todos')
  const totalProdutos = produtos.length

  const filtered = produtos.filter(p => {
    const s = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || p.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
    const c = !selectedCategory || p.categoria === selectedCategory
    return s && c
  })
  const promo = filtered.filter(p => p.promocao)
  const regular = filtered.filter(p => !p.promocao)
  const cartao = (p: Produto) => <ProductCard key={p.id} product={p} isFavorite={favorites.includes(p.id)} onToggleFavorite={onToggleFavorite} backgroundColor={backgroundColor} borderColor={borderColor} corBotao={corBotao} />

  return (
    <div className="cl">
      <div className="cl-busca">
        <MagnifyingGlass size={20} weight="bold" aria-hidden="true" />
        <input type="search" placeholder="Buscar no cardápio" aria-label="Buscar no cardápio" value={searchTerm} onChange={e => onSearchChange(e.target.value)} />
        {searchTerm && <button type="button" aria-label="Limpar a busca" onClick={() => onSearchChange('')}><X size={18} weight="bold" /></button>}
      </div>

      {onCategorySelect && cats.length > 0 && (
        <div ref={catRef} className="cl-cat">
          <button type="button" className={`cl-cat-bt${selectedCategory ? ' on' : ''}`} aria-expanded={catOpen} aria-haspopup="menu"
            style={selectedCategory ? { background: corBotao, borderColor: corBotao } : undefined} onClick={() => setCatOpen(v => !v)}>
            <SquaresFour size={20} weight="bold" aria-hidden="true" />
            <span>{selectedCategory || 'Categorias'}</span>
            <CaretDown size={16} weight="bold" aria-hidden="true" style={{ transform: catOpen ? 'rotate(180deg)' : undefined }} />
          </button>
          {catOpen && (
            <div className="cl-cat-menu" role="menu">
              {[null, ...cats].map(cat => {
                const sel = selectedCategory === cat
                const n = cat === null ? totalProdutos : (categoryCounts[cat] ?? 0)
                return (
                  <button key={cat || 'todos'} type="button" role="menuitemradio" aria-checked={sel}
                    style={sel ? { color: corBotao, background: `${corBotao}12` } : undefined}
                    onClick={() => { onCategorySelect(cat); setCatOpen(false) }}>
                    <span>{sel && <Check size={16} weight="bold" aria-hidden="true" />}{cat || 'Todos os produtos'}</span>
                    <small style={sel ? { background: corBotao, color: '#fff' } : undefined}>{n}</small>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {promo.length > 0 && (<>
        <h2 className="cl-h2">Promoções</h2>
        <div className="cl-grade">{promo.map(cartao)}</div>
      </>)}

      {regular.length > 0 && (<>
        <h2 className="cl-h2">{selectedCategory || 'Todos os produtos'}</h2>
        <div className="cl-grade">{regular.map(cartao)}</div>
      </>)}

      {filtered.length === 0 && (
        <div className="cl-vazio">
          <MagnifyingGlass size={32} aria-hidden="true" />
          <b>Nenhum produto encontrado</b>
          <span>{searchTerm ? 'Tente buscar com outra palavra.' : 'Escolha outra categoria.'}</span>
        </div>
      )}

      {modalProduct && (
        <ProductModal isOpen={!!modalProduct} onClose={() => setModalProduct(null)} product={modalProduct} corBotao={corBotao} />
      )}
    </div>
  )
}

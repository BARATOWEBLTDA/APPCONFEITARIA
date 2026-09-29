import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { CartItem } from '@/types/cart'

interface CartContextType {
  items: CartItem[]
  totalItems: number
  totalPrice: number
  addItem: (item: CartItem) => void
  updateQuantity: (id: string, quantity: number) => void
  updateObservations: (id: string, observations: string) => void
  removeItem: (id: string) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextType | null>(null)

/** Normaliza undefined e null para null, evitando falso-negativo na comparação */
const norm = (v: string | null | undefined): string | null => v ?? null

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  // Chave da linha: produto + TODAS as escolhas (tamanho, sabor, massa, recheios, cobertura,
  // adicionais, foto, observação) + preço. Opções diferentes = linha diferente na sacola.
  const chaveLinha = (it: any): string => {
    const base = JSON.stringify({
      id: it.id,
      escolhas: it.escolhas ?? null,
      massa: norm(it.selectedMassa), recheio: norm(it.selectedRecheio), cobertura: norm(it.selectedCobertura),
      extras: Array.isArray(it.extrasBiblioteca) ? it.extrasBiblioteca.map((x: any) => x.id).sort() : [],
      foto: it.fotoReferencia ?? null,
      obs: (it.observations || '').trim(),
      preco: it.price,
    })
    let h = 0
    for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) | 0
    return `${it.id}#${(h >>> 0).toString(36)}`
  }
  const mesmaLinha = (i: CartItem, alvo: string) => (i.lineId ?? i.id) === alvo

  const addItem = useCallback((newItem: CartItem) => {
    setItems(prev => {
      const lineId = chaveLinha(newItem)
      const existing = prev.find(i => i.lineId === lineId)

      if (existing) {
        // Mesma personalização: apenas soma a quantidade
        return prev.map(i =>
          i === existing ? { ...i, quantity: i.quantity + newItem.quantity } : i
        )
      }

      // Item novo: adiciona ao carrinho e dispara evento
      const updated = [...prev, { ...newItem, lineId }]
      window.dispatchEvent(new CustomEvent('cartUpdated', { detail: updated }))
      return updated
    })
  }, [])

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems(prev => prev.map(i => mesmaLinha(i, id) ? { ...i, quantity } : i))
  }, [])

  const updateObservations = useCallback((id: string, observations: string) => {
    setItems(prev => prev.map(i => mesmaLinha(i, id) ? { ...i, observations } : i))
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => !mesmaLinha(i, id)))
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const totalItems = items.reduce((acc, i) => acc + (i.saleType === 'kg' ? 1 : Math.floor(i.quantity)), 0)
  const totalPrice = items.reduce((acc, i) => acc + i.price * i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, totalItems, totalPrice, addItem, updateQuantity, updateObservations, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCartContext() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCartContext must be used within CartProvider')
  return ctx
}

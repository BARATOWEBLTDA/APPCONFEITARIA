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

  const addItem = useCallback((newItem: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i =>
        i.id === newItem.id &&
        norm(i.selectedMassa)     === norm(newItem.selectedMassa) &&
        norm(i.selectedRecheio)   === norm(newItem.selectedRecheio) &&
        norm(i.selectedCobertura) === norm(newItem.selectedCobertura)
      )

      if (existing) {
        // Item já existe com mesma personalização: apenas soma a quantidade
        return prev.map(i =>
          i === existing ? { ...i, quantity: i.quantity + newItem.quantity } : i
        )
      }

      // Item novo: adiciona ao carrinho e dispara evento
      const updated = [...prev, newItem]
      window.dispatchEvent(new CustomEvent('cartUpdated', { detail: updated }))
      return updated
    })
  }, [])

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i))
  }, [])

  const updateObservations = useCallback((id: string, observations: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, observations } : i))
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
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

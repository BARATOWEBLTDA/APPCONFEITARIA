import { useCartContext } from '@/context/CartContext'
import { CartItem } from '@/types/cart'

export function useCart() {
  return useCartContext()
}

export type { CartItem }

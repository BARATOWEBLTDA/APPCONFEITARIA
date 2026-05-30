export interface CartItem {
  id: string
  name: string
  description: string
  price: number
  imageUrl?: string
  saleType: string
  quantity: number
  observations?: string
  selectedMassa?: string
  selectedRecheio?: string
  selectedCobertura?: string
}

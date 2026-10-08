import { ProductCard } from '@/components/cardapio/ProductCard'
import { Produto } from '@/types/database'

/** Cartão do produto no computador (08/10 · 3.28): o mesmo do celular, com o botão "Adicionar". */
interface Props {
  product: Produto
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  backgroundColor: string
  borderColor?: string
  corBotao?: string
}

export function DesktopProductCard(props: Props) {
  return <ProductCard {...props} corBotao={props.corBotao || '#E85A8C'} comBotao />
}

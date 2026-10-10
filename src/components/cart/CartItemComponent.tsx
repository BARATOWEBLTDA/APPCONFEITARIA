import { Cake, Minus, Plus, Trash } from '@phosphor-icons/react'
import { CartItem } from '@/types/cart'
import { formatCurrency } from '@/utils/helpers'
import { detalhesItem, kgLivre } from '@/lib/itemSacola'
import { sufixoVenda, unidadeCliente } from '@/lib/formaVenda'

/**
 * Unidade do preço como no cardápio ("o cento", "a caixa", "por kg"…).
 * Vazio quando é por unidade, quando tem tamanho/kit (o preço é do item inteiro) ou por kg livre (já tem a linha "por kg").
 */
export function unidadeItem(item: any): string {
  if (!item || kgLivre(item) || item?.escolhas?.tamanho || item?.escolhas?.kit) return ''
  return sufixoVenda(item.saleType) === 'un' ? '' : unidadeCliente(item.saleType)
}

/** "Brigadeiro" → "brigadeiros", "Beijinho de coco" → "beijinhos de coco", "Pão de mel" → "pães de mel" */
function pluralSabor(nome: string, qtd: number): string {
  const n = String(nome || '').trim()
  if (!n) return ''
  const [p1, ...resto] = n.split(' ')
  let w = p1.charAt(0).toLowerCase() + p1.slice(1)
  if (qtd > 1) {
    if (/^pão$/i.test(w)) w = 'pães'
    else if (/ão$/i.test(w)) w = w.replace(/ão$/i, 'ões')
    else if (/[aeiouáéíóú]$/i.test(w)) w = w + 's'
    else if (/[rzs]$/i.test(w)) w = /s$/i.test(w) ? w : w + 'es'
    else if (/l$/i.test(w)) w = w.replace(/l$/i, 'is')
    else if (/m$/i.test(w)) w = w.replace(/m$/i, 'ns')
  }
  return [w, ...resto].join(' ')
}

interface Props {
  item: CartItem
  onUpdateQuantity: (id: string, quantity: number) => void
  onUpdateObservations?: (id: string, observations: string) => void
  onRemove: (id: string) => void
  cor?: string
}

/** Item da sacola (08/10 · 3.30): foto, escolhas numa linha, obs. e quantidade (lixeira quando está em 1). */
export function CartItemComponent({ item, onUpdateQuantity, onRemove, cor = '#E85A8C' }: Props) {
  // Age só nesta linha da sacola (mesmo produto com opções diferentes = linhas separadas)
  const linha = (item as any).lineId ?? item.id
  const livre = kgLivre(item)
  const passo = livre ? 0.5 : 1
  const ultimo = item.quantity <= passo
  const dec = () => (ultimo ? onRemove(linha) : onUpdateQuantity(linha, Math.round((item.quantity - passo) * 10) / 10))
  const inc = () => onUpdateQuantity(linha, Math.round((item.quantity + passo) * 10) / 10)
  const qtd = livre ? `${String(item.quantity).replace('.', ',')} kg` : String(item.quantity)
  const foto = item.imageUrl ? item.imageUrl.split(',')[0] : ''
  const kit = (item as any).escolhas?.kit
  const detalhes = detalhesItem(item)
  const unidade = unidadeItem(item)

  return (
    <div className="sc-it">
      {foto ? <img className="sc-it-ft" src={foto} alt="" /> : <span className="sc-it-ft sc-it-ft--vz"><Cake size={26} weight="duotone" /></span>}
      <div className="sc-it-tx">
        <b>{item.name}{kit?.total ? ` · ${kit.total} un.` : ''}</b>
        {kit?.sabores?.length ? (
          <small>{kit.sabores.filter((x: any) => x.qtd > 0).map((x: any) => `${x.qtd} ${pluralSabor(x.nome, x.qtd)}`).join(' · ')}</small>
        ) : null}
        {detalhes.length > 0 && <small>{detalhes.join(' · ')}</small>}
        {item.observations && <small className="sc-it-obs">Obs.: {item.observations}</small>}
        <strong>{formatCurrency(item.price * item.quantity)}{unidade && item.quantity === 1 && <em className="sc-it-un"> {unidade}</em>}</strong>
        {livre && <small>{formatCurrency(item.price)} por kg</small>}
        {unidade && item.quantity !== 1 && <small>{formatCurrency(item.price)} {unidade}</small>}
      </div>
      <div className="sc-qtd">
        <button type="button" aria-label={ultimo ? 'Tirar da sacola' : 'Diminuir'} onClick={dec}>
          {ultimo ? <Trash size={18} weight="bold" /> : <Minus size={18} weight="bold" />}
        </button>
        <b>{qtd}</b>
        <button type="button" aria-label="Aumentar" style={{ color: cor }} disabled={item.quantity >= 50} onClick={inc}><Plus size={18} weight="bold" /></button>
      </div>
    </div>
  )
}

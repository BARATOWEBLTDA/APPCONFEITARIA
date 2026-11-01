import { nomeExtra, textoSaboresKit } from '@/lib/kitTexto'
import { Cake, Minus, Plus, Trash } from '@phosphor-icons/react'
import { CartItem } from '@/types/cart'
import type { EscolhasV3 } from '@/types/cart'
import type { ItemDoCarrinho } from '@/lib/itemDoCarrinho'
import type { ExtraEscolhido } from '@/lib/kitTexto'

/** Linha da sacola com os campos que podem vir de versões antigas (referência) */
type ItemLinha = ItemDoCarrinho & { referencia_url?: string | null; escolhas?: EscolhasV3 & { referencia?: unknown } }
import { formatCurrency } from '@/utils/helpers'
import { detalhesItem, kgLivre, valorLinha } from '@/lib/itemSacola'
import { sufixoVenda, unidadeCliente } from '@/lib/formaVenda'

/**
 * Unidade do preço como no cardápio ("o cento", "a caixa", "por kg"…).
 * Vazio quando é por unidade, quando tem tamanho/kit (o preço é do item inteiro) ou por kg livre (já tem a linha "por kg").
 */
export function unidadeItem(item: Partial<CartItem> | null | undefined): string {
  if (!item || kgLivre(item) || item?.escolhas?.tamanho || item?.escolhas?.kit) return ''
  return sufixoVenda(item.saleType) === 'un' ? '' : unidadeCliente(item.saleType)
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
  const linha = item.lineId ?? item.id
  const livre = kgLivre(item)
  const passo = livre ? 0.5 : 1
  const ultimo = item.quantity <= passo
  const dec = () => (ultimo ? onRemove(linha) : onUpdateQuantity(linha, Math.round((item.quantity - passo) * 10) / 10))
  const inc = () => onUpdateQuantity(linha, Math.round((item.quantity + passo) * 10) / 10)
  const qtd = livre ? `${String(item.quantity).replace('.', ',')} kg` : String(item.quantity)
  const foto = item.imageUrl ? item.imageUrl.split(',')[0] : ''
  const kit = item.escolhas?.kit
  const detalhes = detalhesItem(item)
  const adicionais: ExtraEscolhido[] = Array.isArray((item as ItemLinha).extrasBiblioteca) ? (item as ItemLinha).extrasBiblioteca : []
  const escolhasLinhas = detalhes.slice(0, detalhes.length - adicionais.length)
  const unidade = unidadeItem(item)
  const total = valorLinha(item)
  const descontoLinha = Math.round((Number(item?.precoBreakdown?.desconto) || 0) * (Number(item.quantity) || 0) * 100) / 100
  const temReferencia = !!((item as ItemLinha).referencia_url || (item as ItemLinha).fotoReferencia || (item as ItemLinha).escolhas?.referencia)

  return (
    <div className="sc-it">
      {foto ? <img className="sc-it-ft" src={foto} alt="" /> : <span className="sc-it-ft sc-it-ft--vz"><Cake size={26} weight="duotone" /></span>}
      <div className="sc-it-tx">
        <b>{item.name}{kit?.total ? ` · ${kit.total} un.` : ''}</b>
        {kit?.sabores?.length ? (
          <small>{textoSaboresKit(kit.sabores)}</small>
        ) : null}
        {/* (19/10) uma escolha por linha (tamanho, massa, recheios...) e os adicionais com "+" */}
        {escolhasLinhas.length > 0 && <ul className="sc-it-det">{escolhasLinhas.map((d, k) => <li key={k}>{d}</li>)}</ul>}
        {adicionais.length > 0 && <ul className="sc-it-det sc-it-add">{adicionais.map((x, k: number) => <li key={k}>+ {nomeExtra(x)}</li>)}</ul>}
        {item.observations && <small className="sc-it-obs">Obs.: {item.observations}</small>}
        {temReferencia && <small className="sc-it-ref">Foto de referência anexada</small>}
      </div>
      {/* (20/10) o preço aparece uma vez só, com o seletor ao lado; o preço do kg/unidade só quando a quantidade não é 1 */}
      <div className="sc-it-pr">
        {livre && item.quantity !== 1 && <small>{formatCurrency(item.price)} o kg</small>}
        {unidade && item.quantity !== 1 && <small>{formatCurrency(item.price)} {unidade}</small>}
        {/* (24/10) em promoção: o preço cheio riscado em cima (a sacola soma o cheio no Subtotal e tira na linha Promoção) */}
        {descontoLinha > 0 && <s className="sc-it-de">{formatCurrency(total + descontoLinha)}</s>}
        <strong>{formatCurrency(total)}{unidade && item.quantity === 1 && <em className="sc-it-un"> {unidade}</em>}</strong>
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

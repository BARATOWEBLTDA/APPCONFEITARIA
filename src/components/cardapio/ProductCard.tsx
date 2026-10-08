import { useState } from 'react'
import { unidadeCliente } from '@/lib/formaVenda'
import { precoCardapio } from '@/lib/precoCardapio'
import { formatCurrency as fmtBRL } from '@/utils/helpers'
import { Cake } from '@phosphor-icons/react'
import { Produto } from '@/types/database'
import { ProductModal } from '@/components/cart/ProductModal'
import { SeloEntregaFoto } from "@/lib/entregaProduto";
import './cardapioLista.css'

/**
 * Cartão do produto no cardápio (08/10 · 3.28) — o mesmo no celular e no computador.
 * Preço em escuro com a unidade ("por kg", "o cento"…), etiqueta "Promoção" reta,
 * ícone no lugar do emoji quando não tem foto. No computador ganha o botão "Adicionar".
 */
interface Props {
  product: Produto
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  backgroundColor: string
  borderColor?: string
  corBotao?: string
  comBotao?: boolean
}

export function precoDoCartao(product: Produto) {
  const p = product as any
  const pc = precoCardapio(product)
  const descRatio = product.promocao
    ? (p.tipo_promocao === 'percentual' && p.desconto_percentual > 0
        ? p.desconto_percentual / 100
        : product.preco_promocional && product.preco_normal > 0 ? 1 - (product.preco_promocional / product.preco_normal) : 0)
    : 0
  const final = descRatio > 0 ? Math.round(pc.valor * (1 - descRatio) * 100) / 100 : pc.valor
  // Com tamanhos ou kit o preço é o do menor; aí a unidade não vale (não é "por kg")
  const unidade = pc.aPartir || p?.grupo_tamanhos?.ativo ? '' : unidadeCliente(product.forma_venda)
  return { de: descRatio > 0 ? pc.valor : 0, final, unidade }
}

export function ProductCard({ product, corBotao = '#E85A8C', comBotao = false }: Props) {
  const [showModal, setShowModal] = useState(false)
  const foto = product.imagem_url?.split(',')[0]?.trim() || null
  const { de, final, unidade } = precoDoCartao(product)

  return (
    <>
      <article className={`cl-pr${comBotao ? ' cl-pr--pc' : ''}`} role="button" tabIndex={0} aria-label={product.nome}
        onClick={() => setShowModal(true)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowModal(true) } }}>
        <div className="cl-pr-ft">
          {foto ? <img src={foto} alt="" loading="lazy" /> : <span className="cl-pr-sem"><Cake size={32} aria-hidden="true" /></span>}
          {product.promocao && <span className="cl-promo">Promoção</span>}
          <SeloEntregaFoto produto={product} />
        </div>
        <div className="cl-pr-tx">
          <b>{product.nome}</b>
          {product.descricao && <small>{product.descricao}</small>}
          <span className="cl-preco">
            {de > 0 && <s>{fmtBRL(de)}</s>}
            <strong>{fmtBRL(final)}</strong>{unidade && <em>{unidade}</em>}
          </span>
          {comBotao && (
            <button type="button" className="cl-add" style={{ background: corBotao }} onClick={e => { e.stopPropagation(); setShowModal(true) }}>Adicionar</button>
          )}
        </div>
      </article>
      <ProductModal isOpen={showModal} onClose={() => setShowModal(false)} product={product} corBotao={corBotao} />
    </>
  )
}

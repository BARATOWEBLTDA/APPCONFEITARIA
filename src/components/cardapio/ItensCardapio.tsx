import { useState } from 'react'
import { Cake } from '@phosphor-icons/react'
import { Produto } from '@/types/database'
import { ProductModal } from '@/components/cart/ProductModal'
import { formatCurrency as fmtBRL } from '@/utils/helpers'
import { seloEntrega } from '@/lib/entregaProduto'
import { precoDoCartao } from './ProductCard'
import './itensCardapio.css'

/**
 * Itens do cardápio no estilo de app de delivery (10/10 · 4.05).
 * - CartaoPromo: cartão de promoção, 2 por linha: foto, preço com o selo de %, preço antigo riscado + "-10%", nome e modo de entrega.
 * - LinhaProduto: produto em lista: nome, descrição, preço à esquerda e foto à direita.
 */

const fotoDe = (p: Produto) => p.imagem_url?.split(',')[0]?.trim() || null

function Entrega({ produto }: { produto: Produto }) {
  const s = seloEntrega(produto)
  if (!s) return null
  return s.tipo === 'pronta'
    ? <span className="ic-ent ic-ent--pronta">Pronta entrega</span>
    : <span className="ic-ent">Pedir {s.prazo} antes</span>
}

/** Preço com desconto do jeito do delivery: selo de % + preço novo; embaixo o antigo riscado e o "-10%" */
function PrecoPromo({ produto, cor }: { produto: Produto; cor: string }) {
  const { de, final, unidade, aPartir } = precoDoCartao(produto)
  const pct = de > 0 ? Math.round((1 - final / de) * 100) : 0
  return (
    <div className="ic-pp">
      <span className="ic-pp-novo">
        {pct > 0 && <span className="ic-pct" style={{ background: cor }} aria-hidden="true">%</span>}
        {aPartir && <small>a partir de</small>}
        <b>{fmtBRL(final)}</b>{unidade && <small>{unidade}</small>}
      </span>
      {pct > 0 && (
        <span className="ic-pp-de">
          <s>{fmtBRL(de)}</s>
          <span className="ic-off" style={{ background: cor }}>-{pct}%</span>
        </span>
      )}
    </div>
  )
}

function useAbrir(produto: Produto) {
  const [aberto, setAberto] = useState(false)
  const props = {
    role: 'button' as const, tabIndex: 0, 'aria-label': produto.nome,
    onClick: () => setAberto(true),
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAberto(true) } },
  }
  return { aberto, fechar: () => setAberto(false), props }
}

export function CartaoPromo({ produto, cor = '#E85A8C' }: { produto: Produto; cor?: string }) {
  const { aberto, fechar, props } = useAbrir(produto)
  const foto = fotoDe(produto)
  return (
    <>
      <article className="ic-cp" {...props}>
        <div className="ic-cp-ft">
          {foto ? <img src={foto} alt="" loading="lazy" /> : <span className="ic-sem"><Cake size={32} aria-hidden="true" /></span>}
        </div>
        <PrecoPromo produto={produto} cor={cor} />
        <b className="ic-cp-nome">{produto.nome}</b>
        <Entrega produto={produto} />
      </article>
      <ProductModal isOpen={aberto} onClose={fechar} product={produto} corBotao={cor} />
    </>
  )
}

export function LinhaProduto({ produto, cor = '#E85A8C' }: { produto: Produto; cor?: string }) {
  const { aberto, fechar, props } = useAbrir(produto)
  const foto = fotoDe(produto)
  const { de, final, unidade, aPartir } = precoDoCartao(produto)
  return (
    <>
      <article className="ic-ln" {...props}>
        <div className="ic-ln-tx">
          <b>{produto.nome}</b>
          {produto.descricao && <p>{produto.descricao}</p>}
          {de > 0 ? <PrecoPromo produto={produto} cor={cor} /> : (
            <span className="ic-ln-preco">
              {aPartir && <small>a partir de</small>}
              <b>{fmtBRL(final)}</b>{unidade && <small>{unidade}</small>}
            </span>
          )}
          <Entrega produto={produto} />
        </div>
        <div className="ic-ln-ft">
          {foto ? <img src={foto} alt="" loading="lazy" /> : <span className="ic-sem"><Cake size={28} aria-hidden="true" /></span>}
        </div>
      </article>
      <ProductModal isOpen={aberto} onClose={fechar} product={produto} corBotao={cor} />
    </>
  )
}

export type Secao = { id: string; nome: string; tipo: 'promo' | 'lista'; produtos: Produto[] }

/**
 * Monta as seções: Promoções (cartões) e depois uma lista por categoria, na ordem das categorias.
 * Produto em promoção fica só em Promoções. Sem categoria vai pra "Outros produtos"
 * (ou "Todos os produtos" quando a loja não usa categorias).
 */
export function montarSecoes(produtos: Produto[], categorias: string[], agrupar: boolean): Secao[] {
  const promo = produtos.filter(p => p.promocao)
  const resto = produtos.filter(p => !p.promocao)
  const secoes: Secao[] = []
  if (promo.length) secoes.push({ id: 'sec-promocoes', nome: 'Promoções', tipo: 'promo', produtos: promo })
  if (!agrupar || categorias.length === 0) {
    if (resto.length) secoes.push({ id: 'sec-todos', nome: promo.length ? 'Todos os produtos' : 'Cardápio', tipo: 'lista', produtos: resto })
    return secoes
  }
  categorias.forEach((c, i) => {
    const l = resto.filter(p => p.categoria === c)
    if (l.length) secoes.push({ id: `sec-cat-${i}`, nome: c, tipo: 'lista', produtos: l })
  })
  const sem = resto.filter(p => !p.categoria || !categorias.includes(p.categoria))
  if (sem.length) secoes.push({ id: 'sec-outros', nome: secoes.length ? 'Outros produtos' : 'Cardápio', tipo: 'lista', produtos: sem })
  return secoes
}

export function SecaoCardapio({ secao, cor, pc = false }: { secao: Secao; cor: string; pc?: boolean }) {
  return (
    <section id={secao.id} className={`ic-sec${pc ? ' ic-sec--pc' : ''}`}>
      <h2 className="ic-h2">{secao.nome}</h2>
      {secao.tipo === 'promo'
        ? <div className="ic-grade">{secao.produtos.map(p => <CartaoPromo key={p.id} produto={p} cor={cor} />)}</div>
        : <div className="ic-lista">{secao.produtos.map(p => <LinhaProduto key={p.id} produto={p} cor={cor} />)}</div>}
    </section>
  )
}

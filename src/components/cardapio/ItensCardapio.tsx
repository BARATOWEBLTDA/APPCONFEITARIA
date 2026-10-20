import { useState } from 'react'
import { Cake } from '@phosphor-icons/react'
import { Produto } from '@/types/database'
import { ProductModal } from '@/components/cart/ProductModal'
import { formatCurrency as fmtBRL } from '@/utils/helpers'
import { seloEntrega, SeloEntregaFoto } from '@/lib/entregaProduto'
import { unidadeCliente } from '@/lib/formaVenda'
import { tamanhosEsgotados, descontoCardapio, precoCardapioComPromocao } from '@/lib/precoCardapio'
// (o cartão antigo ProductCard saiu; o CSS dele continua carregando por aqui, na mesma ordem)
import './cardapioLista.css'
import './itensCardapio.css'

/**
 * Itens do cardápio no estilo de app de delivery (10/10 · 4.05).
 * - CartaoPromo: cartão de promoção, 2 por linha: foto, preço com o selo de %, preço antigo riscado + "-10%", nome e modo de entrega.
 * - LinhaProduto: produto em lista: nome, descrição, preço à esquerda e foto à direita.
 */

/** Preço do cartão: o de antes riscado (promoção), o final, a unidade ("por kg") e se é "a partir de" */
export function precoDoCartao(product: Produto) {
  const p = product as any
  // (11/10) a promoção e os centavos saem da mesma conta do produto aberto (lib/precoCardapio):
  // promoção em valor não entra em produto com tamanhos de preço fixo nem em kit
  const pc = precoCardapioComPromocao(product)
  // Com tamanhos ou kit o preço é o do menor; aí a unidade não vale (não é "por kg")
  const unidade = pc.aPartir || p?.grupo_tamanhos?.ativo ? '' : unidadeCliente(product.forma_venda)
  // Com mais de um tamanho (ou kit) o valor é o menor: "a partir de R$ 120,00", como no produto aberto
  return { de: pc.de, final: pc.final, unidade, aPartir: pc.aPartir }
}

const fotoDe = (p: Produto) => p.imagem_url?.split(',')[0]?.trim() || null

function Entrega({ produto }: { produto: Produto }) {
  if (tamanhosEsgotados(produto)) return <span className="ic-ent ic-ent--esg">Esgotado no momento</span> // (14/10)
  const s = seloEntrega(produto)
  if (!s) return null
  return s.tipo === 'pronta'
    ? <span className="ic-ent ic-ent--pronta">Pronta entrega</span>
    : <span className="ic-ent">Pedir {s.prazo} antes</span>
}

/** (17/10) Preço com desconto: só os dois valores na mesma linha, o antigo riscado e o novo (sem o selo de %).
 *  "a partir de" e a unidade ("por kg") vão numa linha pequena em cima, pra os valores caberem sem quebrar. */
function PrecoPromo({ produto }: { produto: Produto; cor?: string }) {
  const { de, final, unidade, aPartir } = precoDoCartao(produto)
  const rotulo = [aPartir ? 'a partir de' : '', unidade].filter(Boolean).join(' · ')
  return (
    <div className="ic-pp">
      {rotulo && <small className="ic-pp-rot">{rotulo}</small>}
      <span className="ic-pp-linha">
        {de > final && <s>{fmtBRL(de)}</s>}
        <b>{fmtBRL(final)}</b>
      </span>
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

export function CartaoPromo({ produto, cor = '#E85A8C', pc = false }: { produto: Produto; cor?: string; pc?: boolean }) {
  const { aberto, fechar, props } = useAbrir(produto)
  const foto = fotoDe(produto)
  return (
    <>
      <article className="ic-cp" {...props}>
        {/* (14/10) igual aos outros cartões: selo de entrega em cima da foto; depois nome, descrição e preço */}
        <div className="ic-cp-ft">
          {foto ? <img src={foto} alt="" loading="lazy" /> : <span className="ic-sem"><Cake size={32} aria-hidden="true" /></span>}
          {/* (20/10) no computador o prazo aparece só dentro do produto (e no filtro de entrega) */}
          {!pc && <SeloEntregaFoto produto={produto} />}
        </div>
        <b className="ic-cp-nome">{produto.nome}</b>
        {produto.descricao && <p className="ic-cp-desc">{produto.descricao}</p>}
        <PrecoPromo produto={produto} cor={cor} />
      </article>
      <ProductModal isOpen={aberto} onClose={fechar} product={produto} corBotao={cor} />
    </>
  )
}

export function LinhaProduto({ produto, cor = '#E85A8C', pc = false }: { produto: Produto; cor?: string; pc?: boolean }) {
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
          {(!pc || tamanhosEsgotados(produto)) && <Entrega produto={produto} />}
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
  // (11/10) "em promoção" é ter desconto de verdade no cardápio: promoção antiga em valor num produto
  // com tamanhos de preço fixo não dá desconto, então o produto fica na categoria dele
  const emPromocao = (p: Produto) => descontoCardapio(p) > 0
  const promo = produtos.filter(emPromocao)
  const resto = produtos.filter(p => !emPromocao(p))
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
        ? <div className="ic-grade">{secao.produtos.map(p => <CartaoPromo key={p.id} produto={p} cor={cor} pc={pc} />)}</div>
        : <div className="ic-lista">{secao.produtos.map(p => <LinhaProduto key={p.id} produto={p} cor={cor} pc={pc} />)}</div>}
    </section>
  )
}

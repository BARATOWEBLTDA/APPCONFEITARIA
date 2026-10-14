import { kitAtivo, precoMinKit } from '@/lib/kitQuantidade'
import { pesoDoTamanho } from '@/lib/itemSacola'
import { r2 } from '@/lib/moeda'
import { descontoPromocao } from '@/lib/produto-precificacao'

/**
 * Preço cheio de uma opção de tamanho, do jeito que o total cobra (11/10).
 * - Pelo peso: preço base × peso da opção (o `preco` antigo da opção não vale)
 * - Preço fixo: o preço da opção
 * Devolve 0 quando a opção não muda o preço (sem peso ou sem preço).
 */
export function precoDoTamanho(op: any, porPeso: boolean, precoBase: number): number {
  if (porPeso) {
    const kg = pesoDoTamanho(op, true)
    return kg > 0 ? r2((Number(precoBase) || 0) * kg) : 0
  }
  return r2(Math.max(0, Number(op?.preco) || 0))
}

/**
 * (14/10) Produto sem tamanho e sem kit em que "cada sabor tem o seu preço": o preço vem dos sabores.
 * Devolve os preços dos sabores (só os maiores que zero), ou null quando não é esse o caso.
 */
export function precosDosSabores(p: any): number[] | null {
  if (kitAtivo(p?.kit_qtd)) return null
  const gt = p?.grupo_tamanhos
  // (14/10) tamanho só como nome (preço fixo sem preço nenhum): o preço também vem dos sabores
  if (gt?.ativo && (gt.opcoes || []).length > 0 && (gt.modo_preco_tamanho === 'por_peso' || (gt.opcoes || []).some((o: any) => (Number(o?.preco) || 0) > 0))) return null
  const gs = p?.grupo_sabores
  if (!gs?.ativo || !gs.sabor_tem_preco_proprio || !(gs.opcoes || []).length) return null
  return (gs.opcoes || []).filter((o: any) => !o?.esgotado).map((o: any) => r2(Number(o?.preco) || 0)).filter((v: number) => v > 0)
}

/** (14/10) todos os tamanhos marcados como esgotados: o produto não dá pra pedir agora */
export function tamanhosEsgotados(p: any): boolean {
  const gt = p?.grupo_tamanhos
  const ops: any[] = gt?.ativo ? (gt.opcoes || []) : []
  return ops.length > 0 && ops.every(o => !!o?.esgotado)
}

/** O produto tem tamanhos de preço fixo valendo (grupo ativo, com preço em alguma opção)? */
function temTamanhoDePrecoFixo(p: any): boolean {
  const gt = p?.grupo_tamanhos
  if (!gt?.ativo || gt.modo_preco_tamanho === 'por_peso') return false
  return (gt.opcoes || []).some((o: any) => (Number(o?.preco) || 0) > 0)
}

/**
 * Desconto da promoção no cardápio, de 0 a 1 (11/10): UMA regra pro cartão, pro produto aberto, pra sacola e pro pedido.
 * - Promoção em %: vale sempre (tamanhos e kits também).
 * - Promoção em valor (preço promocional): só pra produto sem kit e sem tamanhos de preço fixo.
 *   Antes ela virava um desconto proporcional em todos os tamanhos (P de 80 por 40 deixava o M de 120 por 60).
 */
export function descontoCardapio(p: any): number {
  if (!p?.promocao) return 0
  const pct = Number(p.desconto_percentual) || 0
  const emPorcento = p.tipo_promocao === 'percentual' && pct > 0
  if (!emPorcento && (kitAtivo(p.kit_qtd) || temTamanhoDePrecoFixo(p))) return 0
  const d = descontoPromocao(p)
  return d > 0 && d <= 1 ? d : 0
}

/** Valor já com o desconto (0 a 1), em centavos certos. A mesma conta em todo lugar do cardápio. */
export function comDesconto(valor: number, desconto: number): number {
  const v = r2(valor)
  return desconto > 0 ? r2(v * (1 - desconto)) : v
}

/**
 * Preço que o cardápio mostra no card do produto.
 * - Kit por quantidade: menor preço do kit ("a partir de")
 * - Com tamanhos: menor tamanho (pelo peso: menor peso × preço base) — "a partir de" quando tem mais de 1
 * - Sem nada: o preço do produto
 */
export function precoCardapio(p: any): { valor: number; aPartir: boolean } {
  if (kitAtivo(p?.kit_qtd)) return { valor: r2(precoMinKit(p.kit_qtd)), aPartir: true }
  const gt = p?.grupo_tamanhos
  const todas: any[] = gt?.ativo ? (gt.opcoes || []) : []
  // (14/10) o "a partir de" conta só os tamanhos à venda (se todos estiverem esgotados, conta todos)
  const ops: any[] = todas.some(o => !o?.esgotado) ? todas.filter(o => !o?.esgotado) : todas
  if (ops.length > 0) {
    if (gt.modo_preco_tamanho === 'por_peso') {
      const pesos = ops.map(o => pesoDoTamanho(o, true)).filter(x => x > 0) // (10/10) sem peso_kg, lê o peso do nome
      const menor = pesos.length ? Math.min(...pesos) : 1
      return { valor: r2((Number(p.preco_normal) || 0) * menor), aPartir: ops.length > 1 }
    }
    const precos = ops.map(o => Number(o.preco) || 0).filter(x => x > 0)
    // (14/10) com "cada sabor tem o seu preço": "só o sabor" usa o sabor mais barato; "tamanho + sabor" soma os dois mais baratos
    const gs = p?.grupo_sabores
    const regra = gs?.regra_conflito_tamanho
    const sab: number[] = gs?.ativo && gs?.sabor_tem_preco_proprio ? (gs.opcoes || []).filter((o: any) => !o?.esgotado).map((o: any) => Number(o?.preco) || 0).filter((x: number) => x > 0) : []
    if (sab.length && regra === 'preco_sabor') return { valor: r2(Math.min(...sab)), aPartir: true }
    if (sab.length && precos.length && regra === 'tamanho_base_sabor_adicional') return { valor: r2(Math.min(...precos) + Math.min(...sab)), aPartir: true }
    if (precos.length) return { valor: r2(Math.min(...precos)), aPartir: ops.length > 1 }
  }
  // (14/10) preço pelo sabor: o card mostra o sabor mais barato ("a partir de" quando os preços mudam)
  const ps = precosDosSabores(p)
  if (ps && ps.length) return { valor: Math.min(...ps), aPartir: new Set(ps).size > 1 }
  return { valor: r2(Number(p?.preco_normal) || 0), aPartir: false }
}

/**
 * Preço do cartão já com a promoção (11/10): `de` é o preço cheio riscado (0 = sem promoção).
 * O produto aberto usa as mesmas funções (descontoCardapio + comDesconto), então o número é o mesmo.
 */
export function precoCardapioComPromocao(p: any): { de: number; final: number; aPartir: boolean } {
  const pc = precoCardapio(p)
  const d = descontoCardapio(p)
  const final = comDesconto(pc.valor, d)
  return { de: d > 0 && final < pc.valor ? pc.valor : 0, final, aPartir: pc.aPartir }
}

/** "serve 20 pessoas" ou "20 fatias", conforme o que a confeiteira escolheu no bolo */
export function textoRendimento(serve: any, unidade?: string): string {
  const n = String(serve || '').replace(/\D/g, '')
  if (!n) return ''
  return unidade === 'fatias' ? `${n} fatias` : `serve ${n} ${n === '1' ? 'pessoa' : 'pessoas'}`
}

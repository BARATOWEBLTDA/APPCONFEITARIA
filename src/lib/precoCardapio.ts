import { kitAtivo, precoMinKit } from '@/lib/kitQuantidade'

/**
 * Preço que o cardápio mostra no card do produto.
 * - Kit por quantidade: menor preço do kit ("a partir de")
 * - Com tamanhos: menor tamanho (pelo peso: menor peso × preço base) — "a partir de" quando tem mais de 1
 * - Sem nada: o preço do produto
 */
export function precoCardapio(p: any): { valor: number; aPartir: boolean } {
  if (kitAtivo(p?.kit_qtd)) return { valor: precoMinKit(p.kit_qtd), aPartir: true }
  const gt = p?.grupo_tamanhos
  const ops: any[] = gt?.ativo ? (gt.opcoes || []) : []
  if (ops.length > 0) {
    if (gt.modo_preco_tamanho === 'por_peso') {
      const pesos = ops.map(o => Number(o.peso_kg) || 0).filter(x => x > 0)
      const menor = pesos.length ? Math.min(...pesos) : 1
      return { valor: Math.round((Number(p.preco_normal) || 0) * menor * 100) / 100, aPartir: ops.length > 1 }
    }
    const precos = ops.map(o => Number(o.preco) || 0).filter(x => x > 0)
    if (precos.length) return { valor: Math.min(...precos), aPartir: ops.length > 1 }
  }
  return { valor: Number(p?.preco_normal) || 0, aPartir: false }
}

/** "serve 20 pessoas" ou "20 fatias", conforme o que a confeiteira escolheu no bolo */
export function textoRendimento(serve: any, unidade?: string): string {
  const n = String(serve || '').replace(/\D/g, '')
  if (!n) return ''
  return unidade === 'fatias' ? `${n} fatias` : `serve ${n} ${n === '1' ? 'pessoa' : 'pessoas'}`
}

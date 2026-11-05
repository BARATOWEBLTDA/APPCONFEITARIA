// ═══ Tipo de escolhas ricas do cliente (V3) ═══════════════════════
export interface EscolhaOpcao {
  id: string
  nome: string
  adicional?: number
  preco_proprio?: number  // pra sabor com preço próprio
  preco_fixo?: number     // pra tamanho com preço fixo
  peso_kg?: number | null // pra tamanho
}

export interface EscolhasV3 {
  massa?: EscolhaOpcao | null
  recheios?: EscolhaOpcao[]
  cobertura?: EscolhaOpcao | null
  sabor?: EscolhaOpcao | null
  tamanho?: EscolhaOpcao | null
  /** Kit por quantidade: quantos de cada sabor (docinhos, salgados...) */
  kit?: { modo: "fechado" | "livre"; total: number; sabores: { nome: string; qtd: number }[] } | null
}

export interface PrecoBreakdownCarrinho {
  preco_base_original: number
  base_efetivo: number
  adicionais_total: number
  subtotal: number
  desconto: number
  final: number  // preço unitário final
  /** (6.157) peso livre (kg sem tamanho): complementos que entram UMA vez na linha (fora do `final`, que é por kg) */
  extras_linha?: number
}

// ═══ Item do carrinho ═════════════════════════════════════════════
export interface CartItem {
  id: string
  /** Identifica a LINHA da sacola (mesmo produto com opções diferentes = linhas diferentes) */
  lineId?: string
  name: string
  description: string
  price: number  // preço unitário final (mantido pra retrocompat) — price × quantity = valor da linha
  /**
   * (6.157) Peso livre com complemento (topo de bolo…): o complemento entra uma vez na linha, não por kg.
   * `precoUnidade` = preço do kg (sem o complemento) · `extraLinha` = complementos da linha (uma vez).
   * `price` fica = precoUnidade + extraLinha ÷ quantity (refeito quando a quantidade muda), então
   * price × quantity continua sendo o valor da linha em todo lugar (sacola, total, pedido enviado).
   * Antes o topo de R$ 25 em 2,5 kg cobrava R$ 62,50.
   */
  precoUnidade?: number
  extraLinha?: number
  imageUrl?: string
  saleType: string
  quantity: number
  observations?: string

  // Legado (compatibilidade com fluxo antigo — não usa mais em V3)
  selectedMassa?: string
  selectedRecheio?: string
  selectedCobertura?: string

  // ═══ V3 ═══
  escolhas?: EscolhasV3
  precoBreakdown?: PrecoBreakdownCarrinho
}

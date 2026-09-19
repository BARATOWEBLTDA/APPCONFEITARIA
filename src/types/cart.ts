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
}

export interface PrecoBreakdownCarrinho {
  preco_base_original: number
  base_efetivo: number
  adicionais_total: number
  subtotal: number
  desconto: number
  final: number  // preço unitário final
}

// ═══ Item do carrinho ═════════════════════════════════════════════
export interface CartItem {
  id: string
  name: string
  description: string
  price: number  // preço unitário final (mantido pra retrocompat)
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

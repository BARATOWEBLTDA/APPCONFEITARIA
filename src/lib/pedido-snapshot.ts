/**
 * ═══════════════════════════════════════════════════════════════════
 * PEDIDO SNAPSHOT — helpers de leitura
 * ═══════════════════════════════════════════════════════════════════
 *
 * REGRA DURA — leia antes de mexer:
 *
 * Se a informação existe no snapshot, NUNCA busque do cadastro atual
 * do produto pra reconstruí-la.
 *
 * O snapshot é o histórico imutável do que o cliente pediu e pagou.
 * Consultar `produtos` pra completar dados quebra essa promessa:
 * se a confeiteira renomear ou excluir uma opção, pedidos antigos
 * passam a mostrar dados errados ou vazios.
 *
 * Este arquivo é o ÚNICO ponto autorizado a decidir "de onde vem a
 * informação de um item de pedido". Se você está lendo `produtos` em
 * outro lugar pra montar histórico, provavelmente é bug.
 *
 * Versões do snapshot:
 * - 0 = pedido legado (antes do Passo 0A) — só nome + qtd + valor
 * - 1 = fundação (2026-09-19) — preco_breakdown + personalizacoes v1
 * ═══════════════════════════════════════════════════════════════════
 */

// ─── Tipos do snapshot v1 ────────────────────────────────────────────

export interface PrecoBreakdownV1 {
  preco_base_original: number  // preço cadastrado no produto na hora da compra
  base_efetivo: number         // preço base depois de tamanho/peso (se aplicável)
  adicionais_total: number     // soma de todos os adicionais escolhidos
  subtotal: number             // base_efetivo + adicionais_total
  desconto: number             // valor absoluto do desconto/promoção
  final: number                // subtotal - desconto (preço unitário final)
}

export interface OpcaoSnapshotV1 {
  id?: string                  // rastreabilidade (não usar pra renderizar)
  nome: string                 // sempre presente — é o que a UI mostra
  adicional?: number           // pra opções que são adicionais (massa/recheio/cobertura)
  preco_proprio?: number       // pra sabores com preço próprio
  peso_kg?: number | null      // pra tamanhos
  preco_fixo?: number | null   // pra tamanhos com preço fixo
}

export interface PersonalizacoesV1 {
  massa?: OpcaoSnapshotV1 | null
  recheios?: OpcaoSnapshotV1[]         // array — pode ter múltiplos
  cobertura?: OpcaoSnapshotV1 | null
  sabor?: OpcaoSnapshotV1 | null
  tamanho?: OpcaoSnapshotV1 | null
}

// ─── Estrutura antiga (v0 — legado) ─────────────────────────────────

export interface PersonalizacoesLegado {
  massa?: string | null
  recheio?: string | null
  cobertura?: string | null
}

// ─── Item de pedido como vem do banco ────────────────────────────────

export interface PedidoItemRaw {
  id?: string
  produto_id?: string | null
  nome_produto: string
  quantidade: number
  valor_unitario: number
  observacoes?: string | null
  imagem_url?: string | null
  personalizacoes?: PersonalizacoesV1 | PersonalizacoesLegado | null
  preco_breakdown?: PrecoBreakdownV1 | null
  snapshot_version?: number
}

// ─── Item renderizado (o que a UI consome) ──────────────────────────

export interface ItemParaRender {
  nome: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  imagemUrl: string | null
  observacoes: string | null
  // Lista simples de "linhas de personalização" pra exibir na UI:
  // Ex: [{ label: "Massa", valor: "Chocolate" }, { label: "Recheio", valor: "Ninho, Doce de Leite" }]
  personalizacoesRender: Array<{ label: string; valor: string; adicional?: number }>
  // Breakdown do preço (só existe em snapshot v1+)
  breakdown: PrecoBreakdownV1 | null
  // Indicador pra UI mostrar aviso "pedido legado"
  isLegado: boolean
}

// ═══════════════════════════════════════════════════════════════════
// HELPER PRINCIPAL — a UI DEVE usar esta função pra montar exibição
// ═══════════════════════════════════════════════════════════════════

export function renderItemFromSnapshot(item: PedidoItemRaw): ItemParaRender {
  const version = item.snapshot_version ?? 0
  const quantidade = item.quantidade ?? 1
  const valorUnitario = item.valor_unitario ?? 0

  const base: Omit<ItemParaRender, "personalizacoesRender" | "breakdown" | "isLegado"> = {
    nome: item.nome_produto || "(produto sem nome)",
    quantidade,
    valorUnitario,
    valorTotal: quantidade * valorUnitario,
    imagemUrl: item.imagem_url || null,
    observacoes: item.observacoes || null,
  }

  if (version >= 1) {
    // Snapshot v1 — usa personalizacoes ricas
    const p = (item.personalizacoes || {}) as PersonalizacoesV1
    return {
      ...base,
      personalizacoesRender: personalizacoesV1ToLinhas(p),
      breakdown: item.preco_breakdown || null,
      isLegado: false,
    }
  }

  // Snapshot legado (v0) — tenta usar a estrutura antiga se existir,
  // mas NUNCA consulta produto atual pra completar
  const pLegado = (item.personalizacoes || {}) as PersonalizacoesLegado
  return {
    ...base,
    personalizacoesRender: personalizacoesLegadoToLinhas(pLegado),
    breakdown: null,
    isLegado: true,
  }
}

// ─── Conversores internos ────────────────────────────────────────────

function personalizacoesV1ToLinhas(p: PersonalizacoesV1): Array<{ label: string; valor: string; adicional?: number }> {
  const linhas: Array<{ label: string; valor: string; adicional?: number }> = []

  if (p.tamanho?.nome) {
    const extra = p.tamanho.peso_kg ? ` (~${p.tamanho.peso_kg.toString().replace(".", ",")} kg)` : ""
    linhas.push({ label: "Tamanho", valor: p.tamanho.nome + extra })
  }
  if (p.sabor?.nome) {
    linhas.push({
      label: "Sabor",
      valor: p.sabor.nome,
      adicional: p.sabor.adicional,
    })
  }
  if (p.massa?.nome) {
    linhas.push({
      label: "Massa",
      valor: p.massa.nome,
      adicional: p.massa.adicional,
    })
  }
  if (p.recheios && p.recheios.length > 0) {
    const nomes = p.recheios.map(r => r.nome).join(", ")
    const somaAdicional = p.recheios.reduce((s, r) => s + (r.adicional || 0), 0)
    linhas.push({
      label: p.recheios.length > 1 ? "Recheios" : "Recheio",
      valor: nomes,
      adicional: somaAdicional,
    })
  }
  if (p.cobertura?.nome) {
    linhas.push({
      label: "Cobertura",
      valor: p.cobertura.nome,
      adicional: p.cobertura.adicional,
    })
  }

  return linhas
}

function personalizacoesLegadoToLinhas(p: PersonalizacoesLegado): Array<{ label: string; valor: string }> {
  const linhas: Array<{ label: string; valor: string }> = []
  if (p.massa) linhas.push({ label: "Massa", valor: p.massa })
  if (p.recheio) linhas.push({ label: "Recheio", valor: p.recheio })
  if (p.cobertura) linhas.push({ label: "Cobertura", valor: p.cobertura })
  return linhas
}

// ═══════════════════════════════════════════════════════════════════
// HELPER PARA CRIAR SNAPSHOT AO SALVAR O PEDIDO
// ═══════════════════════════════════════════════════════════════════

/**
 * Monta o breakdown v1 a partir de valores conhecidos no momento da venda.
 *
 * Use no NovaVenda, PedidoForm, cardápio público — em todo lugar
 * que cria pedido_itens novos.
 *
 * Se você só tem o valor final (caso comum hoje, antes da coleta rica
 * do Fase 1), passa preco_final e o helper preenche os outros com 0.
 */
export function criarBreakdownV1(dados: {
  preco_base_original?: number
  base_efetivo?: number
  adicionais_total?: number
  subtotal?: number
  desconto?: number
  final: number   // único obrigatório — é o preço unitário final
}): PrecoBreakdownV1 {
  const final = dados.final
  return {
    preco_base_original: dados.preco_base_original ?? final,
    base_efetivo: dados.base_efetivo ?? final,
    adicionais_total: dados.adicionais_total ?? 0,
    subtotal: dados.subtotal ?? final,
    desconto: dados.desconto ?? 0,
    final,
  }
}

/**
 * Monta personalizacoes v1 a partir de dados brutos (strings soltas que
 * as UIs coletam hoje). Passo 0A aceita as duas formas:
 *
 * - Formato rico (Fase 1+): passa OpcaoSnapshotV1 direto
 * - Formato simples (hoje): passa só o nome como string, o helper adapta
 */
export function criarPersonalizacoesV1(dados: {
  massa?: string | OpcaoSnapshotV1 | null
  recheio?: string | OpcaoSnapshotV1 | null    // legado — vai virar recheios[]
  recheios?: OpcaoSnapshotV1[]
  cobertura?: string | OpcaoSnapshotV1 | null
  sabor?: OpcaoSnapshotV1 | null
  tamanho?: OpcaoSnapshotV1 | null
}): PersonalizacoesV1 {
  const p: PersonalizacoesV1 = {}

  if (dados.massa) {
    p.massa = typeof dados.massa === "string"
      ? { nome: dados.massa, adicional: 0 }
      : dados.massa
  }

  // Prioridade: recheios[] (formato novo) > recheio (legado, vira array de 1)
  if (dados.recheios && dados.recheios.length > 0) {
    p.recheios = dados.recheios
  } else if (dados.recheio) {
    p.recheios = [
      typeof dados.recheio === "string"
        ? { nome: dados.recheio, adicional: 0 }
        : dados.recheio
    ]
  }

  if (dados.cobertura) {
    p.cobertura = typeof dados.cobertura === "string"
      ? { nome: dados.cobertura, adicional: 0 }
      : dados.cobertura
  }

  if (dados.sabor) p.sabor = dados.sabor
  if (dados.tamanho) p.tamanho = dados.tamanho

  return p
}

// ═══════════════════════════════════════════════════════════════════
// VERSÃO ATUAL DO SNAPSHOT — use ao criar item novo
// ═══════════════════════════════════════════════════════════════════

export const SNAPSHOT_VERSION_ATUAL = 1

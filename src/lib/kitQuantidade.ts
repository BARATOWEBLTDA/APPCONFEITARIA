/**
 * Kit por quantidade — docinhos, salgados, bombons...
 * O cliente escolhe QUANTOS de cada sabor (ex.: Brigadeiro × 25, Beijinho × 25).
 *
 * Fica em produtos.kit_qtd (jsonb). Dois jeitos de vender:
 *  - "fechado": kits com quantidade e preço (50 un R$ 44,50 · 100 un R$ 89,00)
 *  - "livre":   mínimo, de quanto em quanto sobe, máximo e preço por cento
 * Regras: máximo de sabores diferentes e de quanto em quanto cada sabor sobe.
 */

export interface KitSabor { id: string; nome: string }
export interface KitFechado { id: string; qtd: number; preco: number }
export interface KitLivre { min: number; passo: number; max: number; preco_cento: number }

export interface KitQtdConfig {
  ativo: boolean
  /** Modelo escolhido no cadastro (docinhos, salgados ou do meu jeito) */
  modelo?: "docinhos" | "salgados" | "livre"
  sabores: KitSabor[]
  modo: "fechado" | "livre"
  kits: KitFechado[]
  livre: KitLivre
  max_sabores: number
  passo_sabor: number
}

/** O que o cliente escolheu (vai no carrinho, no pedido e na mensagem) */
export interface KitEscolha {
  modo: "fechado" | "livre"
  total: number
  sabores: { nome: string; qtd: number }[]
}

export const novoId = () => Math.random().toString(36).slice(2, 10)

export const KIT_VAZIO: KitQtdConfig = {
  ativo: false,
  sabores: [],
  modo: "fechado",
  kits: [{ id: "k50", qtd: 50, preco: 0 }, { id: "k100", qtd: 100, preco: 0 }],
  livre: { min: 100, passo: 50, max: 4000, preco_cento: 0 },
  max_sabores: 2,
  passo_sabor: 25,
}

export function kitAtivo(k: any): k is KitQtdConfig {
  return !!(k && k.ativo)
}

/** Kits fechados válidos (quantidade e preço preenchidos), do menor pro maior */
export function kitsValidos(k: KitQtdConfig): KitFechado[] {
  return (k.kits || []).filter(x => x.qtd > 0 && x.preco > 0).sort((a, b) => a.qtd - b.qtd)
}

/** Preço de uma quantidade no modo livre (preço por cento) */
export function precoLivre(k: KitQtdConfig, qtd: number): number {
  return Math.round(((k.livre?.preco_cento || 0) * qtd) / 100 * 100) / 100
}

/** Menor preço possível — vira o "a partir de" do cardápio */
export function precoMinKit(k: KitQtdConfig): number {
  if (k.modo === "livre") return precoLivre(k, k.livre?.min || 0)
  const v = kitsValidos(k)
  return v.length ? v[0].preco : 0
}

/** Mensagem do que falta no cadastro (null = pronto pra salvar) */
export function erroKit(k: KitQtdConfig): string | null {
  if (!k.sabores.filter(s => s.nome.trim()).length) return "Adicione pelo menos 1 sabor"
  if ((k.max_sabores || 0) < 1) return "Informe o máximo de sabores"
  if ((k.passo_sabor || 0) < 1) return "Informe de quanto em quanto cada sabor sobe"
  if (k.modo === "fechado") {
    if (!kitsValidos(k).length) return "Preencha a quantidade e o preço de pelo menos 1 kit"
  } else {
    const l = k.livre
    if (!(l.min > 0 && l.passo > 0 && l.max >= l.min)) return "Confira o mínimo, o passo e o máximo"
    if (!(l.preco_cento > 0)) return "Informe o preço por cento"
  }
  return null
}

/** "Brigadeiro × 25, Beijinho × 25" */
export function resumoKit(e?: KitEscolha | null): string {
  if (!e) return ""
  return e.sabores.filter(s => s.qtd > 0).map(s => `${s.nome} × ${s.qtd}`).join(", ")
}

// ═══ Cardápio: seleção do cliente ═══
export interface KitSelecao { kitId: string; qtdLivre: number; qtds: Record<string, number> }

export function selecaoInicial(k: KitQtdConfig): KitSelecao {
  return { kitId: kitsValidos(k)[0]?.id || "", qtdLivre: k.livre?.min || 0, qtds: {} }
}

export interface KitCalculo {
  alvo: number; soma: number; usados: number; preco: number
  completo: boolean; restante: number; escolha: KitEscolha
}

export function calcularKit(k: KitQtdConfig, sel: KitSelecao): KitCalculo {
  const alvo = k.modo === "fechado"
    ? (kitsValidos(k).find(x => x.id === sel.kitId)?.qtd || 0)
    : sel.qtdLivre
  const preco = k.modo === "fechado"
    ? (kitsValidos(k).find(x => x.id === sel.kitId)?.preco || 0)
    : precoLivre(k, alvo)
  const sabores = k.sabores.filter(s => s.nome.trim()).map(s => ({ nome: s.nome.trim(), qtd: sel.qtds[s.id] || 0 }))
  const soma = sabores.reduce((t, s) => t + s.qtd, 0)
  const usados = sabores.filter(s => s.qtd > 0).length
  const completo = alvo > 0 && soma === alvo && usados >= 1 && usados <= (k.max_sabores || 1)
  return { alvo, soma, usados, preco, completo, restante: alvo - soma, escolha: { modo: k.modo, total: alvo, sabores: sabores.filter(s => s.qtd > 0) } }
}

// ═══ Modelos prontos (cadastro fácil) ═══
export function presetKit(modelo: "docinhos" | "salgados" | "livre", atual?: KitQtdConfig | null): KitQtdConfig {
  const sabores = atual?.sabores || []
  if (modelo === "docinhos") return {
    ativo: true, modelo, sabores, modo: "fechado",
    kits: [{ id: novoId(), qtd: 50, preco: 0 }, { id: novoId(), qtd: 100, preco: 0 }],
    livre: { ...KIT_VAZIO.livre }, max_sabores: 2, passo_sabor: 25,
  }
  if (modelo === "salgados") return {
    ativo: true, modelo, sabores, modo: "livre", kits: [],
    livre: { min: 100, passo: 50, max: 4000, preco_cento: 0 }, max_sabores: 4, passo_sabor: 25,
  }
  return { ...KIT_VAZIO, ativo: true, modelo, sabores, kits: [{ id: novoId(), qtd: 0, preco: 0 }], max_sabores: 2, passo_sabor: 1 }
}

export const SUGESTOES_SABORES: Record<string, string[]> = {
  docinhos: ["Brigadeiro", "Beijinho", "Cajuzinho", "Ninho", "Casadinho", "Paçoca", "Churros", "Bicho de pé"],
  salgados: ["Coxinha", "Risole de carne", "Bolinha de queijo", "Kibe", "Enroladinho de salsicha", "Esfiha", "Pastel", "Empadinha"],
  livre: [],
}

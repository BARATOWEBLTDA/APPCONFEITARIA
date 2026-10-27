/**
 * A loja que ESTA aba abriu (10/10).
 * Antes a sacola lia a loja do localStorage, que é do navegador inteiro: com duas lojas em duas abas,
 * valia a última que carregou (o pedido podia ir pra loja errada). Agora cada aba guarda a sua na memória.
 * O localStorage continua sendo gravado e fica só de reserva.
 */
export type LojaAtual = {
  userId: string
  whatsapp: string
  nome: string
  /** o mesmo objeto gravado em cardapio_checkout_config (null = loja sem configuração) */
  checkout: Record<string, unknown> | null
  /** (27/10) a logo e o selo, para a tela do Pix aberta pelo Acompanhar pedido (antes aparecia só a inicial) */
  logo?: string | null
  verificada?: boolean
}

let atual: LojaAtual | null = null

const ler = (chave: string): string => { try { return localStorage.getItem(chave) || '' } catch { return '' } }

/** O cardápio chama ao carregar a loja. */
export function definirLojaAtual(loja: LojaAtual) { atual = loja }

export const lojaAtualId = (): string => atual?.userId || ler('cardapio_user_id')
export const lojaAtualWhatsApp = (): string => (atual ? atual.whatsapp : ler('cardapio_whatsapp'))
export const lojaAtualNome = (): string => (atual ? atual.nome : ler('cardapio_nome'))
export const lojaAtualLogo = (): string | null => atual?.logo || null
export const lojaAtualVerificada = (): boolean => !!atual?.verificada

/** Entrega e pagamento da loja desta aba (null = usa o padrão). */
export function lojaAtualCheckout(): Record<string, unknown> | null {
  if (atual) return atual.checkout
  try { const raw = localStorage.getItem('cardapio_checkout_config'); return raw ? JSON.parse(raw) : null } catch { return null }
}

/* (21/10) Produtos da loja desta aba: a janela do produto usa pro "Peça também" (sem buscar de novo) */
let produtosDaLoja: any[] = []
export function definirProdutosDaLoja(lista: any[]) { produtosDaLoja = Array.isArray(lista) ? lista : [] }
export const produtosDaLojaAtual = (): any[] => produtosDaLoja

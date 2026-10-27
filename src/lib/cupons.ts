/**
 * (20/10) Cupons de desconto: vitrine no cardápio (vouchers) e regras de exibição.
 * Os cupons ficam na tabela privada loja_cupons; o cardápio lê só os ativos pela função cardapio_cupons_vitrine.
 */

/** Liberado pra loja grátis enquanto testa. Pra voltar a ser só PRO: false (e o bloco do PRO em cardapio_validar_cupom, supabase/sql/cupons_vitrine.sql). */
export const CUPOM_LIBERADO_FREE = true
export const cupomDisponivel = (isPro: boolean) => isPro || CUPOM_LIBERADO_FREE

/** (27/10) PRO: cupons ativos sem limite, como promete a página do PRO (o cliente usa 1 por pedido; o topo do cardápio mostra os 2 mais novos) */
export const MAX_CUPONS_ATIVOS = Infinity

export type PublicoCupom = 'todos' | 'primeiro_pedido'
export type CupomVitrine = { codigo: string; tipo: string; valor: number; valor_minimo?: number | null; data_fim?: string | null; publico?: PublicoCupom }

const reais = (v: number) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** "10% OFF" · "R$ 10,00 OFF" */
export function textoDesconto(c: { tipo: string; valor: number | string }): string {
  const v = typeof c.valor === 'string' ? Number(String(c.valor).replace(',', '.')) : Number(c.valor)
  if (c.tipo === 'percentual') return `${(Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% OFF`
  return `${reais(v)} OFF`
}

/** A regra mais importante do cupom numa linha curta: 1º pedido > valor mínimo > validade > qualquer pedido */
export function regraCupom(c: CupomVitrine): string {
  if (c.publico === 'primeiro_pedido') return 'no seu 1º pedido'
  if (c.valor_minimo && Number(c.valor_minimo) > 0) return `acima de ${reais(Number(c.valor_minimo))}`
  if (c.data_fim) { const [, m, d] = String(c.data_fim).split('-'); if (d && m) return `até ${d}/${m}` }
  return 'em qualquer pedido'
}

/** Cupom que o cliente tocou no cardápio: já vai aplicado quando ele abrir a sacola */
const CHAVE = 'doonly:cupom-escolhido'
export function guardarCupomEscolhido(codigo: string) {
  try { sessionStorage.setItem(CHAVE, codigo) } catch { /* sem armazenamento: só copia */ }
  try { window.dispatchEvent(new Event('doonly:cupom')) } catch { /* nada */ }
}
export function lerCupomEscolhido(): string {
  try { return sessionStorage.getItem(CHAVE) || '' } catch { return '' }
}
export function esquecerCupomEscolhido() {
  try { sessionStorage.removeItem(CHAVE) } catch { /* nada */ }
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PedidoItem = {
  id?: string
  produto_id?: string
  nome_produto: string
  quantidade: number
  valor_unitario: number
  desconto: number
  observacoes: string
  imagem_url?: string
  personalizacoes: Record<string, string>
}

export type Pedido = {
  id?: string
  cliente_id?: string
  cliente_nome: string
  cliente_telefone: string
  cliente_whatsapp: string
  cliente_email: string
  status: string
  prioridade: string
  origem: string
  data_entrega: string
  horario_entrega: string
  tipo_entrega: string
  taxa_entrega: number
  endereco_cep: string
  endereco_rua: string
  endereco_numero: string
  endereco_complemento: string
  endereco_bairro: string
  endereco_cidade: string
  personalizacao_tema: string
  personalizacao_nome: string
  personalizacao_idade: string
  personalizacao_cor: string
  personalizacao_referencia: string
  personalizacao_obs: string
  valor_produtos: number
  desconto: number
  cupom_codigo: string
  cupom_desconto: number
  valor_total: number
  forma_pagamento: string
  status_pagamento: string
  valor_sinal: number
  data_sinal: string
  valor_recebido: number
  observacoes: string
  etiquetas: string[]
  responsavel_entrega: string
  responsavel_producao: string
  data_prevista_producao: string
  status_producao: string
  checklist_producao: any[]
}

// ─── Estado inicial ───────────────────────────────────────────────────────────

export const EMPTY_PEDIDO: Pedido = {
  cliente_nome: '', cliente_telefone: '', cliente_whatsapp: '', cliente_email: '',
  status: 'novo', prioridade: 'media', origem: '',
  data_entrega: '', horario_entrega: '', tipo_entrega: 'retirada', taxa_entrega: 0,
  endereco_cep: '', endereco_rua: '', endereco_numero: '', endereco_complemento: '',
  endereco_bairro: '', endereco_cidade: '',
  personalizacao_tema: '', personalizacao_nome: '', personalizacao_idade: '',
  personalizacao_cor: '', personalizacao_referencia: '', personalizacao_obs: '',
  valor_produtos: 0, desconto: 0, cupom_codigo: '', cupom_desconto: 0,
  responsavel_entrega: '', responsavel_producao: '', data_prevista_producao: '',
  status_producao: 'nao_iniciado', checklist_producao: [],
  valor_total: 0, forma_pagamento: 'pix', status_pagamento: 'pendente',
  valor_sinal: 0, data_sinal: '', valor_recebido: 0,  observacoes: '', etiquetas: [],
}

export const EMPTY_ITEM: PedidoItem = {
  nome_produto: '', quantidade: 1, valor_unitario: 0,
  desconto: 0, observacoes: '', imagem_url: '', personalizacoes: {},
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

export const ORIGENS = [
  'Instagram', 'Indicação', 'Google', 'Facebook', 'TikTok',
  'WhatsApp', 'Cardápio Digital', 'Outro',
]

export function parseMoney(v: string): number {
  const digits = v.replace(/\D/g, '')
  return digits ? parseInt(digits, 10) / 100 : 0
}

export function formatMoneyInput(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatMoney(v: number): string {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatTelefone(tel: string): string {
  if (!tel) return ''
  const digits = tel.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 11) return `(${digits.slice(0,2)}) ${digits[2]} ${digits.slice(3,7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`
  if (digits.length > 6)   return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`
  if (digits.length > 2)   return `(${digits.slice(0,2)}) ${digits.slice(2)}`
  return digits
}

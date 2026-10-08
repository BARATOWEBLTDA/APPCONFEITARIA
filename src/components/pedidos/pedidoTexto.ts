/**
 * Tudo o que a lista de pedidos escreve (08/10 · 3.11): situação, botão do próximo passo, datas, dinheiro.
 * As palavras seguem o dicionário do guia (C7): Novo pedido, Pronto, Pronto pra retirar, Saiu pra entrega.
 * A mesma regra vale pro cartão do celular, a linha do computador e o quadro.
 */
export type PedidoItem = {
  nome_produto: string; quantidade: number; valor_unitario: number
  observacoes?: string
  imagem_url?: string | null
  personalizacoes?: any
  produtos?: { imagem_url?: string | null; forma_venda?: string | null } | null
}

export type Pedido = {
  id: string; numero: number; cliente_nome: string; cliente_telefone: string
  status: string; status_pagamento: string; prioridade: string
  data_entrega: string; horario_entrega: string; valor_total: number
  valor_recebido: number; tipo_entrega: string; forma_pagamento: string
  etiquetas: string[]; origem: string; created_at: string
  tipo_venda?: string
  endereco_rua?: string; endereco_numero?: string; endereco_complemento?: string
  endereco_bairro?: string; endereco_cidade?: string; endereco_cep?: string
  observacoes?: string
  cliente_id?: string | null
  clientes?: { foto_url?: string | null } | null
  pedido_itens?: PedidoItem[]
}

export type Tom = 'azul' | 'laranja' | 'verde' | 'vermelho' | 'rosa'

/** Situações do banco (com os nomes antigos que ainda podem existir) */
export function grupoDoStatus(status: string): string {
  const s = status || 'aguardando_aceite'
  if (s === 'novo') return 'aguardando_aceite'
  if (s === 'confirmado') return 'agendado'
  if (s === 'pronto') return 'finalizado'
  if (s === 'a_caminho') return 'em_entrega'
  if (s === 'concluido') return 'entregue'
  return s
}

export const SITUACOES: { chave: string; nome: string; tom?: Tom }[] = [
  { chave: 'aguardando_pagamento', nome: 'Aguardando pagamento', tom: 'laranja' },
  { chave: 'aguardando_aceite', nome: 'Novo pedido', tom: 'laranja' },
  { chave: 'agendado', nome: 'Agendado', tom: 'azul' },
  { chave: 'em_producao', nome: 'Em produção', tom: 'rosa' },
  { chave: 'finalizado', nome: 'Pronto', tom: 'verde' },
  { chave: 'aguardando_retirada', nome: 'Pronto pra retirar', tom: 'verde' },
  { chave: 'em_entrega', nome: 'Saiu pra entrega', tom: 'azul' },
  { chave: 'entregue', nome: 'Entregue' },
  { chave: 'cancelado', nome: 'Cancelado', tom: 'vermelho' },
]
const SIT = Object.fromEntries(SITUACOES.map(s => [s.chave, s]))
export const nomeDaSituacao = (chave: string) => SIT[chave]?.nome || chave

export function situacaoDe(p: Pedido): { nome: string; tom?: Tom } {
  const s = SIT[grupoDoStatus(p.status)] || SIT.agendado
  return { nome: s.nome, tom: s.tom }
}

/** O botão do próximo passo (o mesmo fluxo de antes; só os textos mudaram) */
export function acaoDe(p: Pedido): { rotulo: string; proximo: string; pago?: boolean } | null {
  const g = grupoDoStatus(p.status)
  const retirada = p.tipo_entrega === 'retirada'
  switch (g) {
    // pedido do cardápio ainda precisa ser aceito depois de pago; o lançado por ela já fica agendado
    case 'aguardando_pagamento': return { rotulo: 'Recebi', proximo: p.origem === 'cardapio' ? 'aguardando_aceite' : 'agendado', pago: true }
    case 'aguardando_aceite': return { rotulo: 'Aceitar', proximo: 'agendado' }
    case 'agendado': return { rotulo: 'Produzir', proximo: 'em_producao' }
    case 'em_producao': return { rotulo: 'Pronto', proximo: 'finalizado' }
    case 'finalizado': return retirada ? { rotulo: 'Pronto pra retirar', proximo: 'aguardando_retirada' } : { rotulo: 'Saiu pra entrega', proximo: 'em_entrega' }
    case 'aguardando_retirada': return { rotulo: 'Retirou', proximo: 'entregue' }
    case 'em_entrega': return { rotulo: 'Entregue', proximo: 'entregue' }
    default: return null
  }
}

/** Pedido que chegou e ainda precisa ser aceito (fica no topo da lista, em destaque) */
export const precisaAceitar = (p: Pedido) => grupoDoStatus(p.status) === 'aguardando_aceite'

/** Aviso curto, no passado, de quando o pedido muda de situação (3.14) */
export function avisoDaMudanca(p: Pedido, status: string, pago = false): string {
  const n = `#${p.numero || ''}`
  if (pago) return `Pagamento do pedido ${n} registrado.`
  switch (status) {
    case 'agendado': return `Pedido ${n} aceito.`
    case 'em_producao': return `Pedido ${n} em produção.`
    case 'finalizado': return `Pedido ${n} pronto.`
    case 'aguardando_retirada': return `Pedido ${n} pronto pra retirar.`
    case 'em_entrega': return `Pedido ${n} saiu pra entrega.`
    case 'entregue': return `Pedido ${n} entregue.`
    case 'cancelado': return `Pedido ${n} cancelado.`
    default: return `Pedido ${n}: ${nomeDaSituacao(status)}.`
  }
}

export const terminou = (p: Pedido) => ['entregue', 'cancelado'].includes(grupoDoStatus(p.status))

export function dataISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function atrasado(p: Pedido): boolean {
  if (['concluido', 'cancelado', 'excluido', 'entregue'].includes(p.status)) return false
  return !!p.data_entrega && p.data_entrega.slice(0, 10) < dataISO(new Date())
}

// ── Quanto já entrou e quanto falta (Financeiro · Passo 0) ──
export function recebidoPedido(p: any): number {
  const total = Number(p?.valor_total) || 0
  if (p?.status_pagamento === 'pago') return total
  if (p?.status_pagamento === 'parcial') return Math.min(total, Number(p?.valor_recebido) || 0)
  return 0
}
export function saldoPedido(p: any): number {
  if (p?.status === 'cancelado' || p?.status_pagamento === 'estornado') return 0
  return Math.max(0, Math.round(((Number(p?.valor_total) || 0) - recebidoPedido(p)) * 100) / 100)
}

/** R$ 1.320,00 · com redondo=true, valor sem centavos fica "R$ 660" (linha resumida, como no guia) */
export function rs(v: number, redondo = false): string {
  const n = Number(v) || 0
  if (redondo && Math.abs(n - Math.round(n)) < 0.005) return `R$ ${Math.round(n).toLocaleString('pt-BR')}`
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const hora5 = (h?: string | null) => (h ? h.slice(0, 5) : '')
const dataDe = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d) }

/** "10 de outubro às 10:00 (Sábado)" */
export function dataLonga(data?: string | null, hora?: string | null): string {
  if (!data) return 'Sem data'
  const d = dataDe(data)
  return `${d.getDate()} de ${MESES[d.getMonth()]}${hora ? ` às ${hora5(hora)}` : ''} (${SEMANA[d.getDay()]})`
}
/** "Hoje às 16:30", "Amanhã às 09:30", "Sex, 9/10 às 14:00" */
export function dataCurta(data?: string | null, hora?: string | null): string {
  if (!data) return 'Sem data'
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const d = dataDe(data); const dias = Math.round((d.getTime() - hoje.getTime()) / 86400000)
  const h = hora ? ` às ${hora5(hora)}` : ''
  if (dias === 0) return `Hoje${h}`
  if (dias === 1) return `Amanhã${h}`
  return `${SEMANA[d.getDay()].slice(0, 3)}, ${d.getDate()}/${d.getMonth() + 1}${h}`
}
export const horaCurta = (h?: string | null) => hora5(h)

export function criadoEm(iso?: string): string {
  if (!iso) return ''
  const c = new Date(iso)
  return dataLonga(dataISO(c), `${String(c.getHours()).padStart(2, '0')}:${String(c.getMinutes()).padStart(2, '0')}`)
}

// "BOLO DE CHOCOLATE" → "Bolo de Chocolate" (nome de gente fica com as iniciais maiúsculas)
export function nomeDeGente(s: string): string {
  if (!s) return ''
  const minusc = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
  return s.trim().toLowerCase().split(/\s+/).map((w, i) => (i > 0 && minusc.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ')
}
/** Nome do produto como ela cadastrou; só o que veio TODO EM MAIÚSCULA vira frase normal */
export function nomeDeProduto(s: string): string {
  const t = String(s || '').trim()
  if (!t) return ''
  if (t === t.toUpperCase() && /[A-ZÀ-Ú]/.test(t)) return t.charAt(0) + t.slice(1).toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}
export const nomeCliente = (p: Pedido) => (p.cliente_nome ? nomeDeGente(p.cliente_nome) : 'Cliente não informado')

export function itensOrdenados(p: Pedido): PedidoItem[] {
  return [...(p.pedido_itens || [])].sort((a, b) => (b.valor_unitario || 0) * (b.quantidade || 1) - (a.valor_unitario || 0) * (a.quantidade || 1))
}
/** "2x Caixa com 12 brownies e mais 1" */
export function resumoItens(p: Pedido): string {
  const it = itensOrdenados(p)
  if (!it.length) return 'Sem itens'
  const q = it[0].quantidade || 1
  return `${q > 1 ? `${String(q).replace('.', ',')}x ` : ''}${nomeDeProduto(it[0].nome_produto)}${it.length > 1 ? ` e mais ${it.length - 1}` : ''}`
}
export function fotoDoItem(it?: PedidoItem): string | null {
  const f = String(it?.imagem_url || it?.produtos?.imagem_url || '')
  return f.split(/,(?=\s*https?:)/)[0].trim() || null
}
/** A foto do item mais caro que tiver foto */
export function fotoDoPedido(p: Pedido): string | null {
  for (const it of itensOrdenados(p)) { const f = fotoDoItem(it); if (f) return f }
  return null
}

/** "1kg", "2 fatias", "1 cento", "3x" */
export function qtdCurta(qtd: number, forma?: string | null): string {
  const q = Number.isInteger(qtd) ? String(qtd) : String(qtd).replace('.', ',')
  if (!forma) return `${q}x`
  if (forma === 'kg') return `${q} kg`
  if (forma === 'fatia') return `${q} ${qtd === 1 ? 'fatia' : 'fatias'}`
  if (forma === 'cento') return `${q} ${qtd === 1 ? 'cento' : 'centos'}`
  if (forma === 'caixa') return `${q} ${qtd === 1 ? 'caixa' : 'caixas'}`
  if (forma === 'kit-festa') return `${q} ${qtd === 1 ? 'kit' : 'kits'}`
  return `${q}x`
}

export function telefoneBonito(t?: string): string {
  const d = String(t || '').replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return t || ''
}
export const temTelefone = (p: Pedido) => String(p.cliente_telefone || '').replace(/\D/g, '').length >= 10
export function enderecoCurto(p: Pedido): string {
  return [[p.endereco_rua, p.endereco_numero].filter(Boolean).join(', '), p.endereco_bairro].filter(Boolean).join(' · ')
}

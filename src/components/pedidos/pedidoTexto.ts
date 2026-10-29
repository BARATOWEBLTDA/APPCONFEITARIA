/**
 * Tudo o que a lista de pedidos escreve (08/10 · 3.11): situação, botão do próximo passo, datas, dinheiro.
 * As palavras seguem o dicionário do guia (C7): Novo pedido, Pronto, Pronto pra retirar, Saiu pra entrega.
 * Botões (10/10): sempre verbo de ação, os mesmos da tela do pedido (VERBOS).
 * A mesma regra vale pro cartão do celular, a linha do computador e o quadro.
 */
import { pedidoAtrasado } from '@/lib/pedidoStatus'
import { pesoLivre } from '@/lib/itemPedido'

export type PedidoItem = {
  nome_produto: string; quantidade: number; valor_unitario: number
  observacoes?: string
  imagem_url?: string | null
  personalizacoes?: any
  produtos?: { imagem_url?: string | null; forma_venda?: string | null } | null
  forma_venda?: string | null
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
  /** (20/10) Pix pelo cardápio */
  pix_online?: boolean | null
  pix_informado_valor?: number | null
  pix_informado_tipo?: string | null
  pix_informado_em?: string | null
}

/**
 * Pix pelo cardápio (20/10): em que pé está, enquanto nada foi recebido.
 *   aguardando: o pedido veio com Pix pelo cardápio e o cliente ainda não disse que pagou
 *   conferir:   o cliente tocou em "Já paguei" (sinal ou total); falta ela conferir no banco e confirmar
 * Depois de confirmado vira um recebimento normal (Sinal pago / Pago) e isto devolve null.
 */
export function pixDoPedido(p: Pedido): { estado: 'aguardando' | 'conferir'; valor: number; tipo: 'sinal' | 'total' } | null {
  if (!p?.pix_online || grupoDoStatus(p.status) === 'cancelado') return null
  if ((p.status_pagamento || 'pendente') !== 'pendente') return null
  if (p.pix_informado_em && Number(p.pix_informado_valor) > 0) {
    return { estado: 'conferir', valor: Number(p.pix_informado_valor), tipo: p.pix_informado_tipo === 'sinal' ? 'sinal' : 'total' }
  }
  return { estado: 'aguardando', valor: 0, tipo: 'total' }
}

export type Tom = 'azul' | 'laranja' | 'verde' | 'vermelho' | 'rosa'

/** Situações do banco (com os nomes antigos que ainda podem existir) */
export function grupoDoStatus(status: string): string {
  const s = status || 'aguardando_aceite'
  if (s === 'novo' || s === 'pendente') return 'aguardando_aceite' // (27/10) situações antigas também aparecem na lista
  if (s === 'em_preparo') return 'em_producao'
  if (s === 'aguardando_entrega') return 'finalizado'
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
  { chave: 'aguardando_retirada', nome: 'Pronto para retirar', tom: 'verde' },
  { chave: 'em_entrega', nome: 'Saiu para entrega', tom: 'azul' },
  { chave: 'entregue', nome: 'Entregue' },
  { chave: 'cancelado', nome: 'Cancelado', tom: 'vermelho' },
]
const SIT = Object.fromEntries(SITUACOES.map(s => [s.chave, s]))
/** (4.24) Pedido de retirada que já foi entregue aparece como "Retirado". */
export const nomeDaSituacao = (chave: string, tipoEntrega?: string | null) =>
  grupoDoStatus(chave) === 'entregue' && tipoEntrega != null && tipoEntrega !== 'entrega' ? 'Retirado' : (SIT[chave]?.nome || SIT[grupoDoStatus(chave)]?.nome || chave)

export function situacaoDe(p: Pedido): { nome: string; tom?: Tom } {
  const g = grupoDoStatus(p.status)
  const s = SIT[g] || SIT.agendado
  return { nome: SIT[g] ? nomeDaSituacao(g, p.tipo_entrega || 'retirada') : s.nome, tom: s.tom }
}

/**
 * O próximo passo do pedido (10/10): o MESMO caminho e os MESMOS verbos na lista, no quadro e na tela do pedido.
 *   Retirada: Produzir → Marcar pronto (vai pra "Pronto pra retirar") → Marcar retirado.
 *   Entrega:  Produzir → Marcar pronto (vai pra "Pronto") → Saiu pra entrega → Marcar entregue.
 * Pedido de retirada que já está em "Pronto" (antigo) segue direto pra Marcar retirado.
 */
export const VERBOS = {
  receber: 'Recebi', aceitar: 'Aceitar', produzir: 'Produzir', pronto: 'Marcar pronto',
  saiu: 'Saiu para entrega', entregue: 'Marcar entregue', retirado: 'Marcar retirado',
} as const
export function proximoPasso(status: string, tipoEntrega?: string | null, origem?: string | null): { rotulo: string; proximo: string; pago?: boolean } | null {
  const g = grupoDoStatus(status)
  const retirada = tipoEntrega !== 'entrega'
  switch (g) {
    // pedido do cardápio ainda precisa ser aceito depois de pago; o lançado por ela já fica agendado
    case 'aguardando_pagamento': return { rotulo: VERBOS.receber, proximo: origem === 'cardapio' ? 'aguardando_aceite' : 'agendado', pago: true }
    case 'aguardando_aceite': return { rotulo: VERBOS.aceitar, proximo: 'agendado' }
    case 'agendado': return { rotulo: VERBOS.produzir, proximo: 'em_producao' }
    case 'em_producao': return retirada ? { rotulo: VERBOS.pronto, proximo: 'aguardando_retirada' } : { rotulo: VERBOS.pronto, proximo: 'finalizado' }
    case 'finalizado': return retirada ? { rotulo: VERBOS.retirado, proximo: 'entregue' } : { rotulo: VERBOS.saiu, proximo: 'em_entrega' }
    case 'aguardando_retirada': return { rotulo: VERBOS.retirado, proximo: 'entregue' }
    case 'em_entrega': return { rotulo: VERBOS.entregue, proximo: 'entregue' }
    default: return null
  }
}
export const acaoDe = (p: Pedido) => proximoPasso(p.status, p.tipo_entrega, p.origem)

/** Pedido que chegou e ainda precisa ser aceito (fica no topo da lista, em destaque) */
export const precisaAceitar = (p: Pedido) => grupoDoStatus(p.status) === 'aguardando_aceite'

/** Aviso curto, no passado, de quando o pedido muda de situação (3.14) */
export function avisoDaMudanca(p: Pick<Pedido, 'numero'> & { tipo_entrega?: string | null }, status: string, pago = false): string {
  const n = `#${p.numero || ''}`
  if (pago) return `Pagamento do pedido ${n} registrado.`
  switch (status) {
    case 'agendado': return `Pedido ${n} aceito.`
    case 'em_producao': return `Pedido ${n} em produção.`
    case 'finalizado': return `Pedido ${n} pronto.`
    case 'aguardando_retirada': return `Pedido ${n} pronto para retirar.`
    case 'em_entrega': return `Pedido ${n} saiu para entrega.`
    case 'entregue': return p.tipo_entrega === 'retirada' ? `Pedido ${n} retirado.` : `Pedido ${n} entregue.`
    case 'cancelado': return `Pedido ${n} cancelado.`
    default: return `Pedido ${n}: ${nomeDaSituacao(status)}.`
  }
}

export const terminou = (p: Pedido) => ['entregue', 'cancelado'].includes(grupoDoStatus(p.status))

export function dataISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** (11/10) A regra é uma só, a de lib/pedidoStatus: a data passou E o pedido ainda não ficou pronto. */
export function atrasado(p: Pick<Pedido, 'data_entrega' | 'status'>): boolean {
  return pedidoAtrasado(p)
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

/** R$ 1.320,00 (sempre com centavos; o parâmetro redondo ficou só por compatibilidade) */
export function rs(v: number, redondo = false): string {
  const n = Number(v) || 0
  void redondo // (4.29) dinheiro sempre com centavos, também na linha resumida
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const hora5 = (h?: string | null) => (h ? h.slice(0, 5) : '')
const dataDe = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d) }

/** "10 de outubro às 10:00 (sábado)": dia da semana em minúscula no meio da frase */
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
  const sem = SEMANA[d.getDay()].slice(0, 3)
  return `${sem.charAt(0).toUpperCase()}${sem.slice(1)}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}${h}` // (29/10 · 4.84) 01/11, como no resto do app
}
export const horaCurta = (h?: string | null) => hora5(h)

/** (28/10) há quanto tempo o pedido chegou, estilo gestor do iFood: "Chegou agora", "Chegou há 12 min", "Chegou há 3 h", "Chegou ontem às 18:40", "Chegou em 24/10 às 09:10" */
export function chegouHa(iso?: string | null, agora: Date = new Date()): string {
  if (!iso) return ''
  const c = new Date(iso)
  if (isNaN(c.getTime())) return ''
  const min = Math.floor((agora.getTime() - c.getTime()) / 60000)
  const hm = `${String(c.getHours()).padStart(2, '0')}:${String(c.getMinutes()).padStart(2, '0')}`
  if (min < 1) return 'Chegou agora'
  if (min < 60) return `Chegou há ${min} min`
  if (dataISO(c) === dataISO(agora)) return `Chegou há ${Math.floor(min / 60)} h`
  const ontem = new Date(agora); ontem.setDate(agora.getDate() - 1)
  if (dataISO(c) === dataISO(ontem)) return `Chegou ontem às ${hm}`
  return `Chegou em ${String(c.getDate()).padStart(2, '0')}/${String(c.getMonth() + 1).padStart(2, '0')} às ${hm}`
}

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
/**
 * Forma de venda do item: a do produto (lista) ou a que veio no próprio item (nova venda).
 * (11/10) Produto por kg só conta em kg quando é PESO LIVRE. Com tamanho escolhido ("M · 2 kg") ou kit,
 * a quantidade é de unidades: devolve null e o item sai como "1x Bolo red velvet · M (2 kg)", não "1 kg".
 */
export const formaDoItem = (it: { forma_venda?: string | null; personalizacoes?: any; produtos?: { forma_venda?: string | null } | null }) => {
  const forma = it.produtos?.forma_venda || it.forma_venda || null
  return forma === 'kg' && !pesoLivre(it, forma) ? null : forma
}
/** O tamanho escolhido no item, pra ir junto do nome: "M (2 kg)". Vazio quando o item não tem tamanho. */
export function tamanhoDoItem(it: { personalizacoes?: any }): string {
  let pers = it?.personalizacoes
  if (typeof pers === 'string') { try { pers = JSON.parse(pers) } catch { pers = null } }
  const t = pers?.tamanho ?? pers?.escolhas?.tamanho
  const nome = String((typeof t === 'string' ? t : t?.nome) || '').trim()
  if (!nome) return ''
  const peso = Number(t?.peso_kg) || 0
  return peso > 0 && !/kg/i.test(nome) ? `${nome} (${numeroBR(peso)} kg)` : nome
}
/** Nome do item com o tamanho: "Bolo red velvet · M (2 kg)" */
export function nomeDoItem(it: { nome_produto?: string | null; personalizacoes?: any }): string {
  const nome = nomeDeProduto(it?.nome_produto || ''), tam = tamanhoDoItem(it)
  return tam ? `${nome} · ${tam}` : nome
}
const numeroBR = (q: number) => (Number.isInteger(q) ? String(q) : q.toLocaleString('pt-BR', { maximumFractionDigits: 3 }))
/**
 * Quantidade junto do nome, conforme a forma de venda (10/10):
 *   unidade/caixa/kit: antes = "2x" (vazio quando é 1 e semUm=true)
 *   kg: depois = "1,5 kg" ("Bolo red velvet 1,5 kg")
 *   cento/fatia: depois = "2 centos" ("Brigadeiro · 2 centos")
 */
export function partesDaQtd(qtd: number, forma?: string | null, semUm = false): { antes: string; depois: string; sep: string } {
  const q = Number(qtd) || 1
  if (forma === 'kg') return { antes: '', depois: `${numeroBR(q)} kg`, sep: ' ' }
  if (forma === 'cento') return { antes: '', depois: `${numeroBR(q)} ${q === 1 ? 'cento' : 'centos'}`, sep: ' · ' }
  if (forma === 'fatia') return { antes: '', depois: `${numeroBR(q)} ${q === 1 ? 'fatia' : 'fatias'}`, sep: ' · ' }
  return { antes: semUm && q === 1 ? '' : `${numeroBR(q)}x`, depois: '', sep: '' }
}
/** "2x Brownie", "Bolo red velvet 1,5 kg", "Brigadeiro · 2 centos" */
export function itemComQtd(nome: string, qtd: number, forma?: string | null, semUm = false): string {
  const { antes, depois, sep } = partesDaQtd(qtd, forma, semUm)
  return `${antes ? `${antes} ` : ''}${nome}${depois ? `${sep}${depois}` : ''}`
}
/** "2x Caixa com 12 brownies e mais 1", "Bolo red velvet 1,5 kg" */
export function resumoItens(p: Pedido): string {
  const it = itensOrdenados(p)
  if (!it.length) return 'Sem itens'
  return `${itemComQtd(nomeDoItem(it[0]), it[0].quantidade || 1, formaDoItem(it[0]), true)}${it.length > 1 ? ` e mais ${it.length - 1}` : ''}`
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
  const q = numeroBR(Number(qtd) || 1)
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
/** Telefone de verdade: 10 ou mais dígitos e não um número de enfeite ("0000000000", "1111111111") */
export function telefoneValido(t?: string | null): boolean {
  const d = String(t || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  return d.length >= 10 && !/^(\d)\1+$/.test(d) && !/^\d{2}0+$/.test(d)
}
export const temTelefone = (p: Pedido) => telefoneValido(p.cliente_telefone)
export function enderecoCurto(p: Pedido): string {
  return [[p.endereco_rua, p.endereco_numero].filter(Boolean).join(', '), p.endereco_bairro].filter(Boolean).join(' · ')
}

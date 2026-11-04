/**
 * (24/10) Orçamentos: a cliente pede pelo link da loja, a confeiteira monta a proposta (3 etapas)
 * e manda o link; a cliente aprova (vira pedido na Agenda) ou recusa. Recurso do PRO.
 * O banco: tabela orcamentos + funções orcamento_loja, orcamento_solicitar, orcamento_ver e orcamento_responder.
 */
export type ItemOrcamento = {
  id: string
  produto_id?: string | null
  nome: string
  detalhe?: string
  quantidade: number
  valor_unitario: number
  imagem_url?: string | null
  /** (6.62) tamanho escolhido na caixinha do item ("2 kg · serve até 20 pessoas"); também vai no começo do detalhe */
  tamanho?: string | null
  /** (6.82) adicional que entrou junto com um item (o id do item): some quando ele desmarca */
  extra_de?: string | null
}

export type StatusOrcamento = 'novo' | 'rascunho' | 'enviado' | 'aprovado' | 'recusado'

export type Orcamento = {
  id: string
  user_id: string
  numero: number
  token: string
  status: StatusOrcamento
  origem: string
  cliente_id?: string | null
  cliente_nome?: string | null
  cliente_telefone?: string | null
  ocasiao?: string | null
  descricao?: string | null
  pessoas?: number | null
  data_evento?: string | null
  /** (6.51) último dia, quando o evento dura mais de um dia (null = um dia só) */
  data_evento_fim?: string | null
  /** (6.51) horário do evento, opcional ("15:00"; o banco devolve "15:00:00") */
  horario_evento?: string | null
  nome_evento?: string | null
  local_evento?: string | null
  orcamento_cliente?: number | null
  fotos?: string[] | null
  itens?: ItemOrcamento[] | null
  desconto: number
  acrescimo: number
  taxa_entrega: number
  tipo_entrega: string
  validade?: string | null
  sinal_tipo: 'sem' | '50' | 'total' | 'valor'
  sinal_valor: number
  forma_pagamento: 'pix' | 'dinheiro' | 'cartao' | 'combinar'
  mensagem?: string | null
  enviado_em?: string | null
  respondido_em?: string | null
  motivo_recusa?: string | null
  pedido_id?: string | null
  created_at: string
  updated_at?: string
}

const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100

export function somarItens(itens: ItemOrcamento[] | null | undefined): number {
  return r2((itens || []).reduce((s, i) => s + r2((Number(i.quantidade) || 0) * (Number(i.valor_unitario) || 0)), 0))
}

export function totalOrcamento(o: Pick<Orcamento, 'itens' | 'desconto' | 'acrescimo' | 'taxa_entrega' | 'tipo_entrega'>): number {
  const entrega = o.tipo_entrega === 'entrega' ? Number(o.taxa_entrega) || 0 : 0
  return r2(Math.max(0, somarItens(o.itens) - (Number(o.desconto) || 0) + (Number(o.acrescimo) || 0) + entrega))
}

export function valorSinal(o: Pick<Orcamento, 'sinal_tipo' | 'sinal_valor'>, total: number): number {
  if (o.sinal_tipo === '50') return r2(total / 2)
  if (o.sinal_tipo === 'total') return r2(total)
  if (o.sinal_tipo === 'valor') return r2(Math.min(Number(o.sinal_valor) || 0, total))
  return 0
}

export const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const FORMA_ORC: Record<string, string> = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', combinar: 'A combinar' }

/** "Sinal de 50% (R$ 220,00) no Pix · vale até 31/10" */
const COMO_PAGA: Record<string, string> = { pix: ' no Pix', dinheiro: ' em dinheiro', cartao: ' no cartão' }
export const textoEntrega = (taxa: number | null | undefined) => (Number(taxa) > 0 ? brl(Number(taxa)) : 'Grátis')
export function textoCondicoes(o: Orcamento, total: number): string {
  const sinal = valorSinal(o, total)
  const como = COMO_PAGA[o.forma_pagamento || ''] || ''
  const p: string[] = []
  if (o.sinal_tipo === 'total') p.push(`Pagamento total${como} para reservar a data`)
  else if (sinal > 0) p.push(`Sinal de ${o.sinal_tipo === '50' ? '50% ' : ''}(${brl(sinal)})${como} para reservar a data`)
  else p.push(como ? `Pagamento${como} na entrega` : 'Pagamento combinado com a loja')
  if (o.validade) p.push(`vale até ${dataCurta(o.validade)}`)
  return p.join(' · ')
}

export function dataCurta(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
/** "14 de dezembro (Domingo)" */
/** "15:00" → "15h"; "15:30" → "15h30" */
export function horaCurta(h?: string | null): string {
  const m = /^(\d{2}):(\d{2})/.exec(h || '')
  if (!m) return ''
  return `${Number(m[1])}h${m[2] === '00' ? '' : m[2]}`
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** (6.51) a data do evento por extenso, com os dias seguidos e o horário:
 *  "21 de novembro (Sábado) · às 15h" ou "1 a 3 de novembro (Domingo a Terça) · às 15h" */
export function dataDoEvento(o: { data_evento?: string | null; data_evento_fim?: string | null; horario_evento?: string | null }): string {
  if (!o.data_evento) return ''
  const hora = horaCurta(o.horario_evento)
  const fimIso = o.data_evento_fim && o.data_evento_fim > o.data_evento ? o.data_evento_fim : ''
  let txt = dataLonga(o.data_evento)
  if (fimIso) {
    const a = new Date(`${o.data_evento.slice(0, 10)}T12:00:00`), b = new Date(`${fimIso.slice(0, 10)}T12:00:00`)
    const ini = a.getMonth() === b.getMonth() ? String(a.getDate()) : `${a.getDate()} de ${MESES[a.getMonth()]}`
    txt = `${ini} a ${b.getDate()} de ${MESES[b.getMonth()]} (${DIAS[a.getDay()]} a ${DIAS[b.getDay()].toLowerCase()})`
  }
  return hora ? `${txt} · às ${hora}` : txt
}

/** (6.51) curtinho, para a lista: "21/11" ou "01/11 a 03/11" */
export function dataCurtaEvento(o: { data_evento?: string | null; data_evento_fim?: string | null }): string {
  if (!o.data_evento) return ''
  return o.data_evento_fim && o.data_evento_fim > o.data_evento ? `${dataCurta(o.data_evento)} a ${dataCurta(o.data_evento_fim)}` : dataCurta(o.data_evento)
}

export function dataLonga(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  if (isNaN(d.getTime())) return ''
  return `${d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })} (${DIAS[d.getDay()]})`
}

export function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function maisDias(n: number): string {
  const d = new Date(); d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const BASE = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_PUBLIC_URL || 'https://doonly.com.br'
/** O link fixo da loja para pedir orçamento */
export const linkPedirOrcamento = (codigo?: string | null, origem?: string) => (codigo ? `${origem || BASE}/o/${codigo}` : '')
/** O link da proposta para a cliente aprovar */
export const linkProposta = (token: string, origem?: string) => `${origem || BASE}/orcamento/${token}`

/** (6.82) o texto do link de pedir orçamento (Compartilhar) */
export const textoPedirOrcamento = (link: string, loja?: string) =>
  `Oi! Quer um orçamento${loja ? ` da *${loja}*` : ''}? Conte a sua ideia por aqui que eu te respondo pelo WhatsApp:\n${link}`
/** "sábado, 08/11" */
export function diaSemanaCurto(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return isNaN(d.getTime()) ? '' : `${DIAS[d.getDay()].toLowerCase()}, ${dataCurta(iso)}`
}
/** (6.82) a mensagem que vai no WhatsApp junto com o link da proposta (a confeiteira pode mudar antes de enviar) */
export function textoProposta(o: Orcamento, nomeLoja: string, link: string): string {
  const nome = (o.cliente_nome || '').trim().split(' ')[0]
  const total = totalOrcamento(o)
  const evento = (o.nome_evento || o.ocasiao || '').trim()
  const quando = o.data_evento
    ? (o.data_evento_fim && o.data_evento_fim > o.data_evento ? `${dataCurta(o.data_evento)} a ${dataCurta(o.data_evento_fim)}` : diaSemanaCurto(o.data_evento)) + (o.horario_evento ? ` às ${horaCurta(o.horario_evento)}` : '')
    : ''
  const linhas = [
    evento ? `*Evento:* ${evento}` : '',
    quando ? `*Data:* ${quando}` : '',
    total > 0 ? `*Total:* ${brl(total)}` : '',
  ].filter(Boolean)
  return `Oi${nome ? `, ${nome}` : ''}! Tudo bem?\n\nO seu orçamento da *${nomeLoja}* está pronto.${linhas.length ? `\n\n${linhas.join('\n')}` : ''}\n\nVeja os detalhes e aprove por aqui:\n${link}`
}

/** (6.82) o pedido que chegou pelo link, num texto corrido de poucas linhas (sem IA: na hora, sem custo e sem inventar nada) */
export function resumoDoPedido(o: Orcamento): string {
  const nome = (o.cliente_nome || 'O cliente').trim().split(' ')[0]
  const ocasiao = (o.ocasiao || o.nome_evento || '').trim()
  const partes: string[] = []
  const oc = ocasiao ? ocasiao.charAt(0).toLowerCase() + ocasiao.slice(1) : ''
  let abre = `${nome} pediu um orçamento${oc ? ` para ${/^(o|a|os|as|um|uma|meu|minha|nosso|nossa)\s/i.test(oc) ? oc : `o ${oc}`}` : ''}`
  if (o.data_evento) abre += `, ${o.data_evento_fim && o.data_evento_fim > o.data_evento ? `de ${dataCurta(o.data_evento)} a ${dataCurta(o.data_evento_fim)}` : `para ${diaSemanaCurto(o.data_evento)}`}${o.horario_evento ? ` às ${horaCurta(o.horario_evento)}` : ''}`
  if (o.pessoas) abre += `, para ${o.pessoas} pessoas`
  partes.push(`${abre}.`)
  const desc = (o.descricao || '').trim().replace(/\s+/g, ' ')
  if (desc) { const d = desc.charAt(0).toLowerCase() + desc.slice(1); partes.push(`A ideia é ${d.length > 220 ? `${d.slice(0, 217).trim()}…` : d}${/[.!?…]$/.test(d) ? '' : '.'}`) }
  if (Number(o.orcamento_cliente) > 0) partes.push(`Pretende gastar até ${brl(Number(o.orcamento_cliente))}.`)
  const nf = (o.fotos || []).length
  if (nf) partes.push(nf === 1 ? 'Mandou 1 foto de referência.' : `Mandou ${nf} fotos de referência.`)
  return partes.join(' ')
}

/** Sem resposta há 3 dias ou mais: a lista avisa para cobrar o retorno */
export function semResposta(o: Orcamento): boolean {
  if (o.status !== 'enviado' || !o.enviado_em) return false
  return Date.now() - new Date(o.enviado_em).getTime() >= 3 * 86400000
}


/** Reduz a foto para mandar junto do pedido de orçamento (vai guardada no próprio orçamento) */
export function reduzirFotoOrcamento(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const lado = 1000
        const esc = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight))
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(img.naturalWidth * esc)); c.height = Math.max(1, Math.round(img.naturalHeight * esc))
        const ctx = c.getContext('2d'); if (!ctx) throw new Error('sem canvas')
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/jpeg', 0.72))
      } catch (e) { reject(e) } finally { URL.revokeObjectURL(url) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('não é uma imagem')) }
    img.src = url
  })
}

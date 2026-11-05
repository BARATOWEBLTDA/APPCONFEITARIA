// ── acoesDoo.ts ──────────────────────────────────────────────────────────────
// (6.86) O que a Doo consegue fazer no app pela conversa, além de pedido e ingrediente:
// cliente, produto, orçamento, nome e horário da loja e cupom.
// A Doo só PREPARA (bloco acao-doonly); o app mostra um cartão e quem salva é a confeiteira.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '@/lib/supabase'
import { MAX_CUPONS_ATIVOS } from '@/lib/cupons'

export type HorarioDoo = {
  dias?: string[]; abertura?: string; fechamento?: string
  abre_sabado?: boolean; sabado_abertura?: string; sabado_fechamento?: string
  abre_domingo?: boolean; domingo_abertura?: string; domingo_fechamento?: string
}
export type AcaoCliente = { acao: 'cliente'; cliente_id?: string | null; nome: string; telefone?: string | null; data_nascimento?: string | null; email?: string | null; cidade?: string | null; observacoes?: string | null }
export type AcaoProduto = { acao: 'produto'; nome: string; preco: number; categoria?: string | null; descricao?: string | null; pronta_entrega?: boolean | null; forma_venda?: 'unidade' | 'kg' | null }
export type AcaoOrcamento = {
  acao: 'orcamento'; cliente?: { id?: string | null; nome?: string | null; telefone?: string | null } | null
  nome_evento?: string | null; data_evento?: string | null; horario_evento?: string | null; pessoas?: number | null; local_evento?: string | null
  itens?: { produto_id?: string | null; nome: string; detalhe?: string | null; quantidade?: number; valor_unitario?: number }[]
  tipo_entrega?: 'retirada' | 'entrega' | null; taxa_entrega?: number | null
}
export type AcaoLoja = { acao: 'loja'; nome_loja?: string | null; horario?: HorarioDoo | null }
export type AcaoCupom = { acao: 'cupom'; codigo: string; tipo: 'percentual' | 'fixo'; valor: number; valor_minimo?: number | null; data_fim?: string | null; limite_uso?: number | null; publico?: 'todos' | 'primeiro_pedido' | null }
/** (6.102) mão de obra e custos invisíveis (o que a ficha técnica usa para o custo) */
export type AcaoCustos = { acao: 'custos'; salario_mensal?: number | null; horas_dia?: number | null; dias?: string[] | null; custos_invisiveis_pct?: number | null }
export type AcaoDoo = AcaoCliente | AcaoProduto | AcaoOrcamento | AcaoLoja | AcaoCupom | AcaoCustos
export const ACOES_DOO = ['cliente', 'produto', 'orcamento', 'loja', 'cupom', 'custos'] as const
const DIA_NUM: Record<string, number> = { seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, dom: 7 }

const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = (iso?: string | null) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : '' }
const digitos = (t?: string | null) => String(t || '').replace(/\D/g, '')
const hora = (h?: string | null) => (/^\d{1,2}:\d{2}/.test(h || '') ? String(h).slice(0, 5) : '')
const DIAS_CURTOS: Record<string, string> = { Segunda: 'seg', Terça: 'ter', Quarta: 'qua', Quinta: 'qui', Sexta: 'sex' }

/** O horário em texto curto: "Seg a sex 08:00–18:00 · Sáb 09:00–14:00 · Dom fechado" */
export function textoHorario(h?: HorarioDoo | null): string {
  if (!h) return ''
  const dias = (h.dias || []).filter(d => DIAS_CURTOS[d])
  const semana = dias.length === 5 ? 'Seg a sex' : dias.length ? dias.map(d => DIAS_CURTOS[d]).join(', ') : 'Seg a sex fechado'
  const p = [`${semana}${dias.length ? ` ${hora(h.abertura)}–${hora(h.fechamento)}` : ''}`]
  p.push(h.abre_sabado ? `Sáb ${hora(h.sabado_abertura || h.abertura)}–${hora(h.sabado_fechamento || h.fechamento)}` : 'Sáb fechado')
  p.push(h.abre_domingo ? `Dom ${hora(h.domingo_abertura || h.abertura)}–${hora(h.domingo_fechamento || h.fechamento)}` : 'Dom fechado')
  return p.join(' · ')
}

/** Confere e limpa o que a IA mandou (null = bloco inválido) */
export function normalizarAcaoDoo(j: unknown): AcaoDoo | null {
  const o = j as Record<string, unknown> | null
  if (!o || typeof o !== 'object') return null
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const n = (v: unknown) => { const x = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v); return Number.isFinite(x) ? x : null }
  switch (o.acao) {
    case 'cliente': return s(o.nome) ? { acao: 'cliente', cliente_id: s(o.cliente_id), nome: s(o.nome)!, telefone: s(o.telefone), data_nascimento: s(o.data_nascimento), email: s(o.email), cidade: s(o.cidade), observacoes: s(o.observacoes) } : null
    case 'produto': return s(o.nome) && (n(o.preco) ?? 0) > 0 ? { acao: 'produto', nome: s(o.nome)!, preco: n(o.preco)!, categoria: s(o.categoria), descricao: s(o.descricao), pronta_entrega: o.pronta_entrega === false ? false : true, forma_venda: o.forma_venda === 'kg' ? 'kg' : 'unidade' } : null
    case 'orcamento': {
      const itens = Array.isArray(o.itens) ? (o.itens as Record<string, unknown>[]).filter(i => s(i?.nome)).map(i => ({ produto_id: s(i.produto_id), nome: s(i.nome)!, detalhe: s(i.detalhe), quantidade: Math.max(1, n(i.quantidade) || 1), valor_unitario: Math.max(0, n(i.valor_unitario) || 0) })) : []
      const c = o.cliente as Record<string, unknown> | null
      return { acao: 'orcamento', cliente: c ? { id: s(c.id), nome: s(c.nome), telefone: s(c.telefone) } : null, nome_evento: s(o.nome_evento), data_evento: s(o.data_evento), horario_evento: s(o.horario_evento), pessoas: n(o.pessoas), local_evento: s(o.local_evento), itens, tipo_entrega: o.tipo_entrega === 'entrega' ? 'entrega' : 'retirada', taxa_entrega: n(o.taxa_entrega) }
    }
    case 'loja': {
      const h = o.horario as HorarioDoo | null
      if (!s(o.nome_loja) && !h) return null
      return { acao: 'loja', nome_loja: s(o.nome_loja), horario: h && typeof h === 'object' ? h : null }
    }
    case 'cupom': {
      const cod = s(o.codigo)?.toUpperCase().replace(/\s+/g, '')
      const v = n(o.valor)
      if (!cod || !v || v <= 0) return null
      return { acao: 'cupom', codigo: cod.slice(0, 20), tipo: o.tipo === 'fixo' ? 'fixo' : 'percentual', valor: v, valor_minimo: n(o.valor_minimo), data_fim: s(o.data_fim), limite_uso: n(o.limite_uso), publico: o.publico === 'primeiro_pedido' ? 'primeiro_pedido' : 'todos' }
    }
    case 'custos': {
      const sal = n(o.salario_mensal), hd = n(o.horas_dia), pct = n(o.custos_invisiveis_pct)
      const dias = Array.isArray(o.dias) ? (o.dias as unknown[]).map(d => String(d).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 3)).filter(d => DIA_NUM[d]) : null
      if (sal == null && hd == null && pct == null && !dias?.length) return null
      return { acao: 'custos', salario_mensal: sal, horas_dia: hd, dias: dias?.length ? dias : null, custos_invisiveis_pct: pct }
    }
    default: return null
  }
}

/** O que o cartão mostra: título e as linhas (rótulo, valor) */
export function resumoAcaoDoo(a: AcaoDoo): { titulo: string; linhas: [string, string][] } {
  switch (a.acao) {
    case 'cliente': return { titulo: a.cliente_id ? 'Atualizar cliente' : 'Novo cliente', linhas: ([['Nome', a.nome], ['WhatsApp', a.telefone || ''], ['Aniversário', dataBR(a.data_nascimento)], ['E-mail', a.email || ''], ['Cidade', a.cidade || ''], ['Observações', a.observacoes || '']] as [string, string][]).filter(l => l[1]) }
    case 'produto': return { titulo: 'Novo produto', linhas: ([['Nome', a.nome], ['Preço', `${brl(a.preco)}${a.forma_venda === 'kg' ? ' o kg' : ''}`], ['Categoria', a.categoria || ''], ['Descrição', a.descricao || ''], ['Venda', a.pronta_entrega === false ? 'Sob encomenda' : 'Pronta entrega']] as [string, string][]).filter(l => l[1]) }
    case 'orcamento': {
      const tot = (a.itens || []).reduce((s, i) => s + (i.quantidade || 1) * (i.valor_unitario || 0), 0) + (a.tipo_entrega === 'entrega' ? Number(a.taxa_entrega) || 0 : 0)
      return { titulo: 'Novo orçamento', linhas: ([
        ['Cliente', a.cliente?.nome || ''], ['Evento', a.nome_evento || ''], ['Data', [dataBR(a.data_evento), hora(a.horario_evento)].filter(Boolean).join(' às ')],
        ['Pessoas', a.pessoas ? String(a.pessoas) : ''], ['Local', a.local_evento || ''],
        ['Itens', (a.itens || []).map(i => `${(i.quantidade || 1) > 1 ? `${i.quantidade} × ` : ''}${i.nome}${i.valor_unitario ? ` (${brl(i.valor_unitario)})` : ''}`).join('; ')],
        ['Entrega', a.tipo_entrega === 'entrega' ? `Sim${a.taxa_entrega ? `, taxa ${brl(a.taxa_entrega)}` : ''}` : 'Retirada'], ['Total', tot > 0 ? brl(tot) : ''],
      ] as [string, string][]).filter(l => l[1]) }
    }
    case 'loja': return { titulo: 'Dados da loja', linhas: ([['Nome da loja', a.nome_loja || ''], ['Horário', textoHorario(a.horario)]] as [string, string][]).filter(l => l[1]) }
    case 'custos': return { titulo: 'Mão de obra e custos', linhas: ([
      ['Salário que quer tirar', a.salario_mensal != null ? `${brl(a.salario_mensal)} por mês` : ''], ['Horas por dia', a.horas_dia != null ? `${a.horas_dia} h` : ''],
      ['Dias que produz', (a.dias || []).map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')], ['Custos invisíveis', a.custos_invisiveis_pct != null ? `${a.custos_invisiveis_pct}% sobre os ingredientes` : ''],
    ] as [string, string][]).filter(l => l[1]) }
    case 'cupom': return { titulo: 'Novo cupom', linhas: ([
      ['Código', a.codigo], ['Desconto', a.tipo === 'percentual' ? `${a.valor}%` : brl(a.valor)], ['Para', a.publico === 'primeiro_pedido' ? '1º pedido do cliente' : 'Todos os pedidos'],
      ['Pedido mínimo', a.valor_minimo ? brl(a.valor_minimo) : ''], ['Vale até', dataBR(a.data_fim)], ['Limite de usos', a.limite_uso ? String(a.limite_uso) : ''],
    ] as [string, string][]).filter(l => l[1]) }
  }
}

/** Salva de verdade (depois do "Confirmar" da confeiteira). Devolve o texto da confirmação e para onde "Abrir" leva. */
export async function executarAcaoDoo(uid: string, a: AcaoDoo): Promise<{ ok: true; feito: string; abrir?: string } | { ok: false; erro: string }> {
  try {
    switch (a.acao) {
      case 'cliente': {
        const tel = digitos(a.telefone)
        const dados = { nome: a.nome, ...(tel ? { telefone: tel, whatsapp: tel } : {}), ...(a.data_nascimento ? { data_nascimento: a.data_nascimento } : {}), ...(a.email ? { email: a.email } : {}), ...(a.cidade ? { cidade: a.cidade } : {}), ...(a.observacoes ? { observacoes: a.observacoes } : {}) }
        if (a.cliente_id) {
          const { error } = await supabase.from('clientes').update(dados).eq('id', a.cliente_id).eq('user_id', uid)
          if (error) throw error
          return { ok: true, feito: 'Cliente atualizado', abrir: '/clientes' }
        }
        if (tel.length >= 10) {
          const { data: ja } = await supabase.from('clientes').select('id, nome').eq('user_id', uid).or(`telefone.eq.${tel},whatsapp.eq.${tel}`).limit(1)
          if (ja && ja.length) return { ok: false, erro: `Esse WhatsApp já é de ${(ja[0] as { nome: string }).nome}.` }
        }
        const { error } = await supabase.from('clientes').insert({ user_id: uid, ...dados })
        if (error) throw error
        return { ok: true, feito: 'Cliente cadastrado', abrir: '/clientes' }
      }
      case 'produto': {
        const { data, error } = await supabase.from('produtos').insert({ user_id: uid, nome: a.nome, preco_normal: a.preco, categoria: a.categoria || null, descricao: a.descricao || null, pronta_entrega: a.pronta_entrega !== false, forma_venda: a.forma_venda || 'unidade', disponivel: true }).select('id').single()
        if (error) throw error
        if (a.categoria) {
          const { data: cat } = await supabase.from('categorias').select('nome').eq('user_id', uid).ilike('nome', a.categoria).limit(1)
          if (!cat || !cat.length) await supabase.from('categorias').insert({ user_id: uid, nome: a.categoria })
        }
        void data
        return { ok: true, feito: 'Produto no cardápio', abrir: '/produtos' }
      }
      case 'orcamento': {
        const itens = (a.itens || []).map((i, k) => ({ id: `d${k}${Date.now().toString(36)}`, produto_id: i.produto_id || null, nome: i.nome, detalhe: i.detalhe || null, quantidade: i.quantidade || 1, valor_unitario: i.valor_unitario || 0 }))
        const { data, error } = await supabase.from('orcamentos').insert({
          user_id: uid, origem: 'manual', status: 'rascunho', cliente_id: a.cliente?.id || null, cliente_nome: a.cliente?.nome || null, cliente_telefone: digitos(a.cliente?.telefone) || null,
          nome_evento: a.nome_evento || null, data_evento: a.data_evento || null, horario_evento: hora(a.horario_evento) || null, pessoas: a.pessoas || null, local_evento: a.local_evento || null,
          itens, tipo_entrega: a.tipo_entrega || 'retirada', taxa_entrega: a.tipo_entrega === 'entrega' ? Number(a.taxa_entrega) || 0 : 0,
          desconto: 0, acrescimo: 0, sinal_tipo: 'sem', sinal_valor: 0, forma_pagamento: 'combinar',
        }).select('id, numero').single()
        if (error) throw error
        const o = data as { id: string; numero: number }
        return { ok: true, feito: `Orçamento #${o.numero} criado`, abrir: `/orcamentos/${o.id}` }
      }
      case 'loja': {
        const up: Record<string, unknown> = {}
        if (a.nome_loja) up.nome_loja = a.nome_loja
        if (a.horario) {
          const { data: p } = await supabase.from('profiles').select('horario').eq('id', uid).maybeSingle()
          let atual: HorarioDoo = {}
          const bruto = (p as { horario?: unknown } | null)?.horario
          try { atual = typeof bruto === 'string' ? JSON.parse(bruto) : (bruto as HorarioDoo) || {} } catch { atual = {} }
          up.horario = JSON.stringify({ ...atual, ...a.horario })
        }
        const { error } = await supabase.from('profiles').update(up).eq('id', uid)
        if (error) throw error
        return { ok: true, feito: 'Loja atualizada', abrir: '/cardapio-config' }
      }
      case 'custos': {
        if (a.salario_mensal != null || a.horas_dia != null || a.dias?.length) {
          const { data: atual } = await supabase.from('config_mao_obra').select('salario_mensal, horas_dia, dias_semana_array').eq('user_id', uid).maybeSingle()
          const at = (atual || {}) as { salario_mensal?: number | null; horas_dia?: number | null; dias_semana_array?: number[] | null }
          const dias = a.dias?.length ? a.dias.map(d => DIA_NUM[d]).sort((x, y) => x - y) : (at.dias_semana_array?.length ? at.dias_semana_array : [1, 2, 3, 4, 5])
          const { error } = await supabase.from('config_mao_obra').upsert({ user_id: uid, salario_mensal: a.salario_mensal ?? at.salario_mensal ?? 0, horas_dia: a.horas_dia ?? at.horas_dia ?? 8, dias_semana: dias.length, dias_semana_array: dias, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
          if (error) throw error
        }
        if (a.custos_invisiveis_pct != null) {
          const { error } = await supabase.from('profiles').update({ custos_invisiveis_pct: Math.max(0, Math.min(100, a.custos_invisiveis_pct)) }).eq('id', uid)
          if (error) throw error
        }
        return { ok: true, feito: 'Custos atualizados', abrir: '/custos' }
      }
      case 'cupom': {
        const { data: lc } = await supabase.from('loja_cupons').select('cupons').eq('user_id', uid).maybeSingle()
        const lista = Array.isArray((lc as { cupons?: unknown } | null)?.cupons) ? ((lc as { cupons: Record<string, unknown>[] }).cupons) : []
        if (lista.some(c => String(c?.codigo || '').toUpperCase() === a.codigo)) return { ok: false, erro: `Já existe um cupom ${a.codigo}.` }
        const hoje = new Date().toISOString().slice(0, 10)
        const ativos = lista.filter(c => c?.ativo !== false && (!c?.data_fim || String(c.data_fim) >= hoje)).length
        const ativo = ativos < MAX_CUPONS_ATIVOS
        const novo = { codigo: a.codigo, tipo: a.tipo, valor: a.valor, ativo, data_inicio: null, data_fim: a.data_fim || null, limite_uso: a.limite_uso || null, valor_minimo: a.valor_minimo || null, publico: a.publico || 'todos', usos: 0 }
        const { error } = await supabase.from('loja_cupons').upsert({ user_id: uid, cupons: [...lista, novo], updated_at: new Date().toISOString() })
        if (error) throw error
        return { ok: true, feito: ativo ? `Cupom ${a.codigo} criado` : `Cupom ${a.codigo} criado pausado`, abrir: '/cupons' }
      }
    }
  } catch (e) {
    return { ok: false, erro: (e as { message?: string })?.message || 'Não deu para salvar. Tente de novo.' }
  }
}

/** As regras que a Doo segue para essas ações (vão no prompt do sistema) */
export function regrasAcoesDoo(loja: { nome_loja?: string | null; horario?: unknown }): string {
  let h: HorarioDoo | null
  try { h = typeof loja.horario === 'string' ? JSON.parse(loja.horario) : (loja.horario as HorarioDoo) || null } catch { h = null }
  return `

# AÇÕES NO APP: CLIENTE, PRODUTO, ORÇAMENTO, LOJA E CUPOM
Igual ao pedido e ao ingrediente: você só PREPARA. O app mostra um cartão e quem confirma e salva é a confeiteira. Pergunte SÓ o que falta, em uma frase curta. Nunca invente nome, telefone, preço ou data. Quando tiver o necessário, responda com UMA frase curta (ex.: "Confira e confirme no cartão abaixo.") e, no FINAL, UM bloco \`\`\`acao-doonly com o JSON. Nada depois do bloco. Nunca diga que salvou.

CLIENTE (precisa do nome; WhatsApp se ela souber). Para mudar um cliente que já existe na lista, use o id dele em cliente_id.
{"acao":"cliente","cliente_id":null,"nome":"Ana Souza","telefone":"41999990000","data_nascimento":"1990-05-12","email":null,"cidade":null,"observacoes":null}

PRODUTO (precisa do nome e do preço; pergunte a categoria se ela não disser; pronta_entrega false = sob encomenda; forma_venda "kg" só se for vendido por quilo). Foto, tamanhos e sabores ela completa depois na tela do produto: diga isso em meia frase.
{"acao":"produto","nome":"Bolo de pote Ninho","preco":15,"categoria":"Bolos de pote","descricao":"","pronta_entrega":true,"forma_venda":"unidade"}

ORÇAMENTO (precisa do cliente e de pelo menos um item com valor; data, horário, pessoas e local se ela souber). Itens do cardápio pelo id e o preço do cardápio; item sob medida com produto_id null e o valor que ela disser. Vira um rascunho que ela revisa e envia na tela de Orçamentos.
{"acao":"orcamento","cliente":{"id":null,"nome":"Ana","telefone":""},"nome_evento":"Aniversário da Malu","data_evento":"2026-12-05","horario_evento":"16:00","pessoas":40,"local_evento":"","itens":[{"produto_id":null,"nome":"Bolo 2 andares","detalhe":"tema jardim","quantidade":1,"valor_unitario":380}],"tipo_entrega":"retirada","taxa_entrega":0}

LOJA: nome da loja e horário de atendimento. Mande só o que muda. Horário: "dias" com os dias úteis abertos (Segunda, Terça, Quarta, Quinta, Sexta), "abertura" e "fechamento" HH:MM; sábado e domingo com abre_sabado / abre_domingo e os horários deles.
{"acao":"loja","nome_loja":"Doce Formiga","horario":{"dias":["Segunda","Terça","Quarta","Quinta","Sexta"],"abertura":"09:00","fechamento":"18:00","abre_sabado":true,"sabado_abertura":"09:00","sabado_fechamento":"13:00","abre_domingo":false}}
Hoje a loja se chama "${loja.nome_loja || 'sem nome'}" e o horário é: ${textoHorario(h) || 'não definido'}.

CUPOM (precisa do código e do desconto; tipo "percentual" ou "fixo" em reais; publico "primeiro_pedido" se for só para cliente novo; mínimo, validade AAAA-MM-DD e limite de usos só se ela falar).
{"acao":"cupom","codigo":"NATAL10","tipo":"percentual","valor":10,"valor_minimo":null,"data_fim":null,"limite_uso":null,"publico":"todos"}

MÃO DE OBRA E CUSTOS INVISÍVEIS (o que a ficha técnica usa para o custo de cada produto). Pergunte uma coisa de cada vez: quanto ela quer tirar de salário por mês, quantas horas trabalha por dia e em quais dias produz. Custos invisíveis são gás, luz, água e perdas, em % sobre os ingredientes: se ela não souber, sugira 25% e explique em uma frase. Mande só o que ela disse.
{"acao":"custos","salario_mensal":3000,"horas_dia":8,"dias":["seg","ter","qua","qui","sex","sab"],"custos_invisiveis_pct":25}

O QUE VOCÊ NÃO FAZ PELA CONVERSA (diga com honestidade, em uma frase, e diga onde ela faz): excluir qualquer coisa, mudar preço ou foto de produto que já existe, configurar entrega e taxas, Pix e formas de pagamento, cores e banners do cardápio, e mexer no financeiro. Ex.: "Isso eu ainda não faço por aqui: é em Cardápio digital › Dados da loja."
`
}

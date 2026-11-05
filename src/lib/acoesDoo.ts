// ── acoesDoo.ts ──────────────────────────────────────────────────────────────
// (6.86) O que a Doo consegue fazer no app pela conversa, além de pedido e ingrediente:
// cliente, produto, orçamento, loja e cardápio (todos os campos, 6.107), cupom e custos.
// A Doo só PREPARA (bloco acao-doonly); o app mostra um cartão e quem salva é a confeiteira.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '@/lib/supabase'
import { MAX_CUPONS_ATIVOS } from '@/lib/cupons'
import { limparFacebook, limparInstagram } from '@/lib/redesSociais'
import { adivinharTipo, normalizarChave, problemaNaChave } from '@/lib/pix'
import { atualizarPontoDaLoja } from '@/lib/taxaEntrega'
import { categoriaPeloNome } from '@/lib/categoriasInsumo'
import { gravarInsumosDoProduto, procurarInsumoPorNome, salvarInsumoDoo } from '@/lib/insumosDoo'
import { registrarPagamento } from '@/lib/pagamentos'
import { registrarEtapa } from '@/lib/historicoPedido'
import { grupoDoStatus, saldoPedido, nomeDaSituacao } from '@/components/pedidos/pedidoTexto'
import { lerProdutosDeVenda, opcoesDoProduto } from '@/lib/pedidosDoo'
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA } from '@/lib/categoriasFinanceiro'

export type HorarioDoo = {
  dias?: string[]; abertura?: string; fechamento?: string
  abre_sabado?: boolean; sabado_abertura?: string; sabado_fechamento?: string
  abre_domingo?: boolean; domingo_abertura?: string; domingo_fechamento?: string
}
export type AcaoCliente = { acao: 'cliente'; cliente_id?: string | null; nome: string; telefone?: string | null; data_nascimento?: string | null; email?: string | null; cidade?: string | null; observacoes?: string | null }
export type AcaoProduto = { acao: 'produto'; nome: string; preco: number; categoria?: string | null; descricao?: string | null; pronta_entrega?: boolean | null; forma_venda?: 'unidade' | 'kg' | null
  /** (6.106) o que ela respondeu às perguntas da Doo: rendimento ("serve 10 pessoas, 20 fatias"), destaque e promoção */
  rendimento?: string | null; destaque?: boolean; preco_promocional?: number | null; desconto_percentual?: number | null }
export type AcaoOrcamento = {
  acao: 'orcamento'; cliente?: { id?: string | null; nome?: string | null; telefone?: string | null } | null
  nome_evento?: string | null; data_evento?: string | null; horario_evento?: string | null; pessoas?: number | null; local_evento?: string | null
  itens?: { produto_id?: string | null; nome: string; detalhe?: string | null; quantidade?: number; valor_unitario?: number }[]
  tipo_entrega?: 'retirada' | 'entrega' | null; taxa_entrega?: number | null
}
/** (6.107) a Doo preenche qualquer campo da loja e do cardápio (Dados da loja, Entrega e pagamento, Pix, cores e pausa) */
export type EnderecoDoo = { cep?: string; rua?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; estado?: string }
export type AcaoLoja = {
  acao: 'loja'; nome_loja?: string | null; horario?: HorarioDoo | null
  descricao?: string | null; whatsapp?: string | null; endereco?: EnderecoDoo | null; mostrar_endereco?: 'completo' | 'cidade' | 'nao' | null
  instagram?: string | null; facebook?: string | null
  pagamentos?: string[] | null; troco?: boolean | null
  entregas?: string[] | null; horario_retirada?: string | null
  /** (6.115) bairros, cidades e faixas SOMAM aos que já existem (o mesmo nome atualiza o valor); "remover" tira pelo nome */
  taxa?: { modo: 'fixa' | 'bairro' | 'cidade' | 'raio' | 'combinar'; valor?: number | null; bairros?: { bairro: string; valor: number }[]; cidades?: { cidade: string; valor: number }[]; raios?: { km: number; valor: number }[]; fora_valor?: number | null; remover?: string[] } | null
  pix?: { chave?: string | null; nome?: string | null; cidade?: string | null; online?: boolean | null; modo?: 'escolha' | 'sinal' | 'total' | null; sinal_pct?: number | null; pagar_na_retirada?: boolean | null } | null
  cores?: { faixa_topo?: string | null; borda_logo?: string | null; nome_loja?: string | null } | null
  pausada?: boolean | null
}
const PAGAMENTOS_OK = ['pix', 'dinheiro', 'credito', 'debito']
const ENTREGAS_OK = ['retirada', 'entrega_propria', 'motoboy', 'uber_flash', 'combinar']
const NOME_PAG: Record<string, string> = { pix: 'Pix', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito' }
const NOME_ENT: Record<string, string> = { retirada: 'Retirada', entrega_propria: 'Entrega própria', motoboy: 'Motoboy', uber_flash: 'Uber Flash', combinar: 'Combinar pelo WhatsApp' }
const COR_OK = /^#[0-9a-fA-F]{6}$/
const fone = (v: string) => { const d = v.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11); return d.length < 10 ? '' : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` }
export type AcaoCupom = { acao: 'cupom'; codigo: string; tipo: 'percentual' | 'fixo'; valor: number; valor_minimo?: number | null; data_fim?: string | null; limite_uso?: number | null; publico?: 'todos' | 'primeiro_pedido' | null }
/** (6.102) mão de obra e custos invisíveis (o que a ficha técnica usa para o custo) */
export type AcaoCustos = { acao: 'custos'; salario_mensal?: number | null; horas_dia?: number | null; dias?: string[] | null; custos_invisiveis_pct?: number | null }
/** (6.114) ficha técnica pela conversa: o produto, os ingredientes com a quantidade da receita e, para os que ainda não existem, a embalagem e o preço */
export type ItemFichaDoo = { insumo_id?: string | null; nome: string; quantidade: number; unidade: string
  novo?: { unidade: string; qtd_embalagem: number; valor_compra: number; embalagem_tipo?: string | null; marca?: string | null } | null }
export type AcaoFicha = { acao: 'ficha'; produto_id?: string | null; produto_nome: string; rendimento?: string | null; itens: ItemFichaDoo[] }
/** (6.115) andar com o pedido: a próxima situação e/ou o dinheiro que entrou */
export type EtapaDoo = 'aceito' | 'produzindo' | 'pronto' | 'saiu' | 'entregue'
export type AcaoPedidoStatus = { acao: 'pedido_status'; numero: number; cliente?: string | null; etapa?: EtapaDoo | null; recebido?: number | 'tudo' | null; forma?: string | null }
/** (6.115) lançamento no financeiro: entrada, saída já paga ou conta a pagar */
export type AcaoLancamento = { acao: 'lancamento'; tipo: 'entrada' | 'saida'; valor: number; descricao?: string | null; categoria: string; data?: string | null; forma?: string | null; vencimento?: string | null }
/** (6.115) mudar um produto que já existe: preço, promoção, pausar, destaque, venda e textos */
export type AcaoProdutoEditar = { acao: 'produto_editar'; produto_id?: string | null; produto_nome: string; nome?: string | null; preco?: number | null
  preco_promocional?: number | null; desconto_percentual?: number | null; sem_promocao?: boolean; disponivel?: boolean | null; destaque?: boolean | null
  pronta_entrega?: boolean | null; descricao?: string | null; categoria?: string | null }
export type AcaoDoo = AcaoCliente | AcaoProduto | AcaoOrcamento | AcaoLoja | AcaoCupom | AcaoCustos | AcaoFicha | AcaoPedidoStatus | AcaoLancamento | AcaoProdutoEditar
export const ACOES_DOO = ['cliente', 'produto', 'orcamento', 'loja', 'cupom', 'custos', 'ficha', 'pedido_status', 'lancamento', 'produto_editar'] as const
const ETAPAS: Record<EtapaDoo, string> = { aceito: 'Aceito (agendado)', produzindo: 'Em produção', pronto: 'Pronto', saiu: 'Saiu para entrega', entregue: 'Entregue' }
const FORMAS_FIN: Record<string, string> = { pix: 'Pix', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito' }
const formaOk = (v: unknown) => { const x = String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); return x.includes('pix') ? 'pix' : x.includes('dinheiro') ? 'dinheiro' : x.includes('debito') ? 'debito' : x.includes('credito') || x.includes('cartao') ? 'credito' : null }
const dataOk = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null)
const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
/** unidades da receita e a família (para conferir com a unidade do ingrediente) */
const UNID: Record<string, { fam: string; base: number }> = { g: { fam: 'massa', base: 0.001 }, kg: { fam: 'massa', base: 1 }, ml: { fam: 'volume', base: 0.001 }, L: { fam: 'volume', base: 1 }, un: { fam: 'unidade', base: 1 }, m: { fam: 'comp', base: 1 }, cm: { fam: 'comp', base: 0.01 } }
const unidadeOk = (u: unknown) => { const x = String(u || '').trim(); const y = x.toLowerCase() === 'l' ? 'L' : x.toLowerCase(); return UNID[y] ? y : null }
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
    case 'produto': return s(o.nome) && (n(o.preco) ?? 0) > 0 ? { acao: 'produto', nome: s(o.nome)!, preco: n(o.preco)!, categoria: s(o.categoria), descricao: s(o.descricao), pronta_entrega: o.pronta_entrega === false ? false : true, forma_venda: o.forma_venda === 'kg' ? 'kg' : 'unidade',
      rendimento: s(o.rendimento)?.slice(0, 60) || null, destaque: o.destaque === true,
      // promoção só vale abaixo do preço cheio (em R$) ou entre 1% e 90% (em %)
      preco_promocional: (n(o.preco_promocional) ?? 0) > 0 && n(o.preco_promocional)! < n(o.preco)! ? n(o.preco_promocional) : null,
      desconto_percentual: (n(o.desconto_percentual) ?? 0) >= 1 && n(o.desconto_percentual)! <= 90 ? Math.round(n(o.desconto_percentual)!) : null } : null
    case 'orcamento': {
      const itens = Array.isArray(o.itens) ? (o.itens as Record<string, unknown>[]).filter(i => s(i?.nome)).map(i => ({ produto_id: s(i.produto_id), nome: s(i.nome)!, detalhe: s(i.detalhe), quantidade: Math.max(1, n(i.quantidade) || 1), valor_unitario: Math.max(0, n(i.valor_unitario) || 0) })) : []
      const c = o.cliente as Record<string, unknown> | null
      return { acao: 'orcamento', cliente: c ? { id: s(c.id), nome: s(c.nome), telefone: s(c.telefone) } : null, nome_evento: s(o.nome_evento), data_evento: s(o.data_evento), horario_evento: s(o.horario_evento), pessoas: n(o.pessoas), local_evento: s(o.local_evento), itens, tipo_entrega: o.tipo_entrega === 'entrega' ? 'entrega' : 'retirada', taxa_entrega: n(o.taxa_entrega) }
    }
    case 'loja': {
      const h = o.horario as HorarioDoo | null
      const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null)
      const lista = (v: unknown, ok: string[]) => (Array.isArray(v) ? [...new Set((v as unknown[]).map(x => String(x)).filter(x => ok.includes(x)))] : null)
      const bool = (v: unknown) => (typeof v === 'boolean' ? v : null)
      const e = obj(o.endereco)
      const endereco = e ? Object.fromEntries(['cep', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'estado'].map(k => [k, s(e[k])]).filter(([, v]) => v)) as EnderecoDoo : null
      const t = obj(o.taxa)
      const modo = t && ['fixa', 'bairro', 'cidade', 'raio', 'combinar'].includes(String(t.modo)) ? String(t.modo) as NonNullable<AcaoLoja['taxa']>['modo'] : null
      const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]).filter(x => x && typeof x === 'object') : [])
      const taxa = modo ? {
        modo, valor: n(t!.valor) != null ? Math.max(0, n(t!.valor)!) : null,
        bairros: arr(t!.bairros).filter(b => s(b.bairro) && n(b.valor) != null).map(b => ({ bairro: s(b.bairro)!, valor: Math.max(0, n(b.valor)!) })),
        cidades: arr(t!.cidades).filter(c => s(c.cidade) && n(c.valor) != null).map(c => ({ cidade: s(c.cidade)!, valor: Math.max(0, n(c.valor)!) })),
        raios: arr(t!.raios).filter(r => (n(r.km) ?? 0) > 0 && n(r.valor) != null).map(r => ({ km: n(r.km)!, valor: Math.max(0, n(r.valor)!) })).sort((x, y) => x.km - y.km),
        // (6.115) sem o campo, fica como está (antes mandar só um bairro apagava o "fora disso")
        fora_valor: !('fora_valor' in t!) ? undefined : n(t!.fora_valor) != null ? Math.max(0, n(t!.fora_valor)!) : null,
        remover: Array.isArray(t!.remover) ? (t!.remover as unknown[]).map(x => String(x).trim()).filter(Boolean).slice(0, 30) : [],
      } : null
      const px = obj(o.pix)
      const pix = px ? { chave: s(px.chave), nome: s(px.nome)?.slice(0, 25) || null, cidade: s(px.cidade)?.slice(0, 15) || null, online: bool(px.online),
        modo: (['escolha', 'sinal', 'total'].includes(String(px.modo)) ? px.modo : null) as 'escolha' | 'sinal' | 'total' | null,
        sinal_pct: n(px.sinal_pct) != null ? Math.min(90, Math.max(10, Math.round(n(px.sinal_pct)!))) : null, pagar_na_retirada: bool(px.pagar_na_retirada) } : null
      const c = obj(o.cores)
      const cor = (v: unknown) => (typeof v === 'string' && COR_OK.test(v.trim()) ? v.trim().toUpperCase() : null)
      const cores = c ? { faixa_topo: cor(c.faixa_topo), borda_logo: cor(c.borda_logo), nome_loja: cor(c.nome_loja) } : null
      const r: AcaoLoja = {
        acao: 'loja', nome_loja: s(o.nome_loja), horario: h && typeof h === 'object' ? h : null,
        descricao: s(o.descricao)?.slice(0, 300) || null, whatsapp: s(o.whatsapp) ? fone(s(o.whatsapp)!) || null : null,
        endereco: endereco && Object.keys(endereco).length ? endereco : null,
        mostrar_endereco: ['completo', 'cidade', 'nao'].includes(String(o.mostrar_endereco)) ? o.mostrar_endereco as 'completo' | 'cidade' | 'nao' : null,
        instagram: s(o.instagram), facebook: s(o.facebook),
        pagamentos: lista(o.pagamentos, PAGAMENTOS_OK), troco: bool(o.troco),
        entregas: lista(o.entregas, ENTREGAS_OK), horario_retirada: s(o.horario_retirada)?.slice(0, 80) || null,
        taxa, pix: pix && Object.values(pix).some(v => v != null) ? pix : null,
        cores: cores && Object.values(cores).some(Boolean) ? cores : null, pausada: bool(o.pausada),
      }
      if (r.pagamentos && !r.pagamentos.length) r.pagamentos = null
      if (r.entregas && !r.entregas.length) r.entregas = null
      return Object.entries(r).some(([k, v]) => k !== 'acao' && v != null) ? r : null
    }
    case 'cupom': {
      const cod = s(o.codigo)?.toUpperCase().replace(/\s+/g, '')
      const v = n(o.valor)
      if (!cod || !v || v <= 0) return null
      return { acao: 'cupom', codigo: cod.slice(0, 20), tipo: o.tipo === 'fixo' ? 'fixo' : 'percentual', valor: v, valor_minimo: n(o.valor_minimo), data_fim: s(o.data_fim), limite_uso: n(o.limite_uso), publico: o.publico === 'primeiro_pedido' ? 'primeiro_pedido' : 'todos' }
    }
    case 'ficha': {
      const itens = Array.isArray(o.itens) ? (o.itens as Record<string, unknown>[]).map(i => {
        const nv = i?.novo && typeof i.novo === 'object' ? i.novo as Record<string, unknown> : null
        const novo = nv && unidadeOk(nv.unidade) && (n(nv.qtd_embalagem) ?? 0) > 0 && (n(nv.valor_compra) ?? 0) > 0
          ? { unidade: unidadeOk(nv.unidade)!, qtd_embalagem: n(nv.qtd_embalagem)!, valor_compra: n(nv.valor_compra)!, embalagem_tipo: s(nv.embalagem_tipo), marca: s(nv.marca) } : null
        return { insumo_id: s(i?.insumo_id), nome: s(i?.nome) || '', quantidade: n(i?.quantidade) ?? 0, unidade: unidadeOk(i?.unidade) || '', novo }
      }).filter(i => i.nome && i.quantidade > 0 && i.unidade) : []
      if (!s(o.produto_nome) && !s(o.produto_id)) return null
      if (!itens.length) return null
      return { acao: 'ficha', produto_id: s(o.produto_id), produto_nome: s(o.produto_nome) || '', rendimento: s(o.rendimento)?.slice(0, 60) || null, itens }
    }
    case 'pedido_status': {
      const num = n(o.numero)
      const etapa = ['aceito', 'produzindo', 'pronto', 'saiu', 'entregue'].includes(String(o.etapa)) ? o.etapa as EtapaDoo : null
      const recebido = o.recebido === 'tudo' ? 'tudo' : (n(o.recebido) ?? 0) > 0 ? Math.round(n(o.recebido)! * 100) / 100 : null
      if (!num || num <= 0 || (!etapa && !recebido)) return null
      return { acao: 'pedido_status', numero: Math.round(num), cliente: s(o.cliente), etapa, recebido, forma: formaOk(o.forma) }
    }
    case 'lancamento': {
      const tipo = o.tipo === 'entrada' ? 'entrada' : o.tipo === 'saida' ? 'saida' : null
      const v = n(o.valor)
      if (!tipo || !v || v <= 0) return null
      const cats = tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA
      const pedida = s(o.categoria)?.toLowerCase()
      const categoria = cats.find(c => c.toLowerCase() === pedida) || (pedida && tipo === 'saida' && /ingrediente/.test(pedida) ? 'Insumos' : null) || 'Outros'
      const venc = tipo === 'saida' ? dataOk(o.vencimento) : null
      return { acao: 'lancamento', tipo, valor: Math.round(v * 100) / 100, descricao: s(o.descricao)?.slice(0, 120) || null, categoria, data: venc ? null : dataOk(o.data), forma: tipo === 'entrada' ? formaOk(o.forma) || 'pix' : null, vencimento: venc }
    }
    case 'produto_editar': {
      if (!s(o.produto_nome) && !s(o.produto_id)) return null
      const preco = (n(o.preco) ?? 0) > 0 ? n(o.preco) : null
      const r: AcaoProdutoEditar = { acao: 'produto_editar', produto_id: s(o.produto_id), produto_nome: s(o.produto_nome) || '', nome: s(o.nome)?.slice(0, 80) || null, preco,
        preco_promocional: (n(o.preco_promocional) ?? 0) > 0 ? n(o.preco_promocional) : null,
        desconto_percentual: (n(o.desconto_percentual) ?? 0) >= 1 && n(o.desconto_percentual)! <= 90 ? Math.round(n(o.desconto_percentual)!) : null,
        sem_promocao: o.sem_promocao === true, disponivel: typeof o.disponivel === 'boolean' ? o.disponivel : null, destaque: typeof o.destaque === 'boolean' ? o.destaque : null,
        pronta_entrega: typeof o.pronta_entrega === 'boolean' ? o.pronta_entrega : null, descricao: typeof o.descricao === 'string' ? o.descricao.trim().slice(0, 500) : null, categoria: s(o.categoria) }
      const muda = ['nome', 'preco', 'preco_promocional', 'desconto_percentual', 'disponivel', 'destaque', 'pronta_entrega', 'descricao', 'categoria'].some(k => (r as Record<string, unknown>)[k] != null) || r.sem_promocao
      return muda ? r : null
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
    case 'produto': return { titulo: 'Novo produto', linhas: ([['Nome', a.nome], ['Preço', `${brl(a.preco)}${a.forma_venda === 'kg' ? ' o kg' : ''}`], ['Categoria', a.categoria || ''], ['Descrição', a.descricao || ''], ['Venda', a.pronta_entrega === false ? 'Sob encomenda' : 'Pronta entrega'], ['Rendimento', a.rendimento || ''], ['Promoção', a.preco_promocional ? `${brl(a.preco_promocional)}${a.forma_venda === 'kg' ? ' o kg' : ''}` : a.desconto_percentual ? `${a.desconto_percentual}% de desconto` : ''], ['Destaque', a.destaque ? 'Sim, no topo do cardápio' : '']] as [string, string][]).filter(l => l[1]) }
    case 'orcamento': {
      const tot = (a.itens || []).reduce((s, i) => s + (i.quantidade || 1) * (i.valor_unitario || 0), 0) + (a.tipo_entrega === 'entrega' ? Number(a.taxa_entrega) || 0 : 0)
      return { titulo: 'Novo orçamento', linhas: ([
        ['Cliente', a.cliente?.nome || ''], ['Evento', a.nome_evento || ''], ['Data', [dataBR(a.data_evento), hora(a.horario_evento)].filter(Boolean).join(' às ')],
        ['Pessoas', a.pessoas ? String(a.pessoas) : ''], ['Local', a.local_evento || ''],
        ['Itens', (a.itens || []).map(i => `${(i.quantidade || 1) > 1 ? `${i.quantidade} × ` : ''}${i.nome}${i.valor_unitario ? ` (${brl(i.valor_unitario)})` : ''}`).join('; ')],
        ['Entrega', a.tipo_entrega === 'entrega' ? `Sim${a.taxa_entrega ? `, taxa ${brl(a.taxa_entrega)}` : ''}` : 'Retirada'], ['Total', tot > 0 ? brl(tot) : ''],
      ] as [string, string][]).filter(l => l[1]) }
    }
    case 'loja': {
      const en = a.endereco ? [[a.endereco.rua, a.endereco.numero].filter(Boolean).join(', '), a.endereco.bairro, [a.endereco.cidade, a.endereco.estado].filter(Boolean).join('/'), a.endereco.cep].filter(Boolean).join(' · ') : ''
      const tx = a.taxa ? (a.taxa.modo === 'combinar' ? 'A combinar pelo WhatsApp'
        : a.taxa.modo === 'fixa' ? (a.taxa.valor == null ? 'A combinar' : a.taxa.valor > 0 ? brl(a.taxa.valor) : 'Grátis')
        : a.taxa.modo === 'bairro' ? (a.taxa.bairros || []).map(b => `${b.bairro} ${b.valor > 0 ? brl(b.valor) : 'grátis'}`).join(', ')
        : a.taxa.modo === 'cidade' ? (a.taxa.cidades || []).map(c => `${c.cidade} ${c.valor > 0 ? brl(c.valor) : 'grátis'}`).join(', ')
        : (a.taxa.raios || []).map(r => `até ${String(r.km).replace('.', ',')} km ${r.valor > 0 ? brl(r.valor) : 'grátis'}`).join(', ')) + (a.taxa.fora_valor != null && a.taxa.modo !== 'fixa' && a.taxa.modo !== 'combinar' ? ` · fora disso ${brl(a.taxa.fora_valor)}` : '') : ''
      const px = a.pix ? [a.pix.chave ? `chave ${a.pix.chave}` : '', a.pix.nome || '', a.pix.cidade || '',
        a.pix.online === false ? 'desligado no cardápio' : a.pix.online ? 'pago pelo cardápio' : '',
        a.pix.modo === 'sinal' ? `sinal de ${a.pix.sinal_pct || 50}%` : a.pix.modo === 'total' ? 'valor total' : a.pix.modo === 'escolha' ? 'o cliente escolhe sinal ou total' : '',
        a.pix.pagar_na_retirada === true ? 'pode pagar na retirada' : ''].filter(Boolean).join(' · ') : ''
      const co = a.cores ? [a.cores.faixa_topo ? `faixa ${a.cores.faixa_topo}` : '', a.cores.borda_logo ? `borda ${a.cores.borda_logo}` : '', a.cores.nome_loja ? `nome ${a.cores.nome_loja}` : ''].filter(Boolean).join(' · ') : ''
      return { titulo: 'Dados da loja e do cardápio', linhas: ([
        ['Nome da loja', a.nome_loja || ''], ['Horário', textoHorario(a.horario)], ['Descrição', a.descricao || ''], ['WhatsApp', a.whatsapp || ''],
        ['Endereço', en], ['Endereço no cardápio', a.mostrar_endereco === 'completo' ? 'Completo' : a.mostrar_endereco === 'cidade' ? 'Só a cidade' : a.mostrar_endereco === 'nao' ? 'Não mostrar' : ''],
        ['Instagram', a.instagram ? `@${limparInstagram(a.instagram) || a.instagram.replace(/^@/, '')}` : ''], ['Facebook', a.facebook || ''],
        ['Pagamento', (a.pagamentos || []).map(k => NOME_PAG[k]).join(', ')], ['Troco', a.troco == null ? '' : a.troco ? 'Pergunta se precisa de troco' : 'Não pergunta'],
        ['Entrega', (a.entregas || []).map(k => NOME_ENT[k]).join(', ')], ['Horário de retirada', a.horario_retirada || ''], ['Taxa de entrega', tx],
        ['Pix', px], ['Cores', co], ['Loja', a.pausada == null ? '' : a.pausada ? 'Pausada (não recebe pedidos)' : 'Aberta para pedidos'],
      ] as [string, string][]).filter(l => l[1]) }
    }
    case 'ficha': {
      const q = (v: number) => String(Math.round(v * 1000) / 1000).replace('.', ',')
      return { titulo: `Ficha técnica · ${a.produto_nome}`, linhas: ([
        ...a.itens.map(i => [i.nome, `${q(i.quantidade)} ${i.unidade}${i.novo ? ` · novo: ${q(i.novo.qtd_embalagem)} ${i.novo.unidade} por ${brl(i.novo.valor_compra)}` : ''}`] as [string, string]),
        ['Rendimento', a.rendimento || ''],
      ] as [string, string][]).filter(l => l[1]) }
    }
    case 'custos': return { titulo: 'Mão de obra e custos', linhas: ([
      ['Salário que quer tirar', a.salario_mensal != null ? `${brl(a.salario_mensal)} por mês` : ''], ['Horas por dia', a.horas_dia != null ? `${a.horas_dia} h` : ''],
      ['Dias que produz', (a.dias || []).map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')], ['Custos invisíveis', a.custos_invisiveis_pct != null ? `${a.custos_invisiveis_pct}% sobre os ingredientes` : ''],
    ] as [string, string][]).filter(l => l[1]) }
    case 'pedido_status': return { titulo: `Pedido #${a.numero}${a.cliente ? ` · ${a.cliente}` : ''}`, linhas: ([
      ['Situação', a.etapa ? ETAPAS[a.etapa] : ''],
      ['Recebido', a.recebido === 'tudo' ? `Tudo o que falta${a.forma ? `, no ${FORMAS_FIN[a.forma]}` : ''}` : a.recebido ? `${brl(a.recebido)}${a.forma ? ` no ${FORMAS_FIN[a.forma]}` : ''}` : ''],
    ] as [string, string][]).filter(l => l[1]) }
    case 'lancamento': return { titulo: a.tipo === 'entrada' ? 'Nova entrada no financeiro' : a.vencimento ? 'Nova conta a pagar' : 'Nova saída no financeiro', linhas: ([
      ['Valor', brl(a.valor)], ['Descrição', a.descricao || ''], ['Categoria', a.categoria === 'Insumos' ? 'Ingredientes' : a.categoria],
      ['Recebido no', a.tipo === 'entrada' && a.forma ? FORMAS_FIN[a.forma] : ''], ['Vence', dataBR(a.vencimento)],
      ['Data', a.vencimento ? '' : a.data && a.data !== hojeLocal() ? dataBR(a.data) : 'Hoje'],
    ] as [string, string][]).filter(l => l[1]) }
    case 'produto_editar': return { titulo: `Mudar produto · ${a.produto_nome}`, linhas: ([
      ['Nome novo', a.nome || ''], ['Preço', a.preco ? brl(a.preco) : ''],
      ['Promoção', a.sem_promocao ? 'Tirar a promoção' : a.preco_promocional ? `Por ${brl(a.preco_promocional)}` : a.desconto_percentual ? `${a.desconto_percentual}% de desconto` : ''],
      ['No cardápio', a.disponivel === false ? 'Pausado (some do cardápio)' : a.disponivel === true ? 'Volta a aparecer' : ''],
      ['Destaque', a.destaque === true ? 'Sim, no topo do cardápio' : a.destaque === false ? 'Tirar do destaque' : ''],
      ['Venda', a.pronta_entrega === true ? 'Pronta entrega' : a.pronta_entrega === false ? 'Sob encomenda' : ''],
      ['Categoria', a.categoria || ''], ['Descrição', a.descricao == null ? '' : a.descricao || '(sem descrição)'],
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
        const promo = a.preco_promocional ? { promocao: true, tipo_promocao: 'fixo', preco_promocional: a.preco_promocional }
          : a.desconto_percentual ? { promocao: true, tipo_promocao: 'percentual', desconto_percentual: a.desconto_percentual } : {}
        const novo = { user_id: uid, nome: a.nome, preco_normal: a.preco, categoria: a.categoria || null, descricao: a.descricao || null, pronta_entrega: a.pronta_entrega !== false, forma_venda: a.forma_venda || 'unidade', disponivel: true,
          ...(a.rendimento ? { rendimento_qtd: a.rendimento } : {}), ...promo }
        let semDestaque = false
        let { data, error } = await supabase.from('produtos').insert({ ...novo, destaque: !!a.destaque }).select('id').single()
        // já tem 6 destaques: entra no cardápio sem destaque e a Doo avisa
        if (error && a.destaque && /limite_destaques/.test(`${error.message} ${(error as { hint?: string }).hint || ''}`)) {
          semDestaque = true
          ;({ data, error } = await supabase.from('produtos').insert({ ...novo, destaque: false }).select('id').single())
        }
        if (error) throw error
        if (a.categoria) {
          const { data: cat } = await supabase.from('categorias').select('nome').eq('user_id', uid).ilike('nome', a.categoria).limit(1)
          if (!cat || !cat.length) await supabase.from('categorias').insert({ user_id: uid, nome: a.categoria })
        }
        void data
        return { ok: true, feito: semDestaque ? 'Produto no cardápio (já tem 6 destaques, este ficou fora)' : a.destaque ? 'Produto no cardápio, em destaque' : 'Produto no cardápio', abrir: '/produtos' }
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
        // (6.115) a taxa também lê o perfil: antes mudar só a taxa gravava "retirada + entrega própria" por cima das outras formas de entrega
        const precisa = a.endereco || a.pix || a.entregas || a.taxa
        const { data: perf } = precisa ? await supabase.from('profiles').select('endereco, formas_entrega, endereco_retirada, nome_loja, pix_chave, pix_nome, pix_cidade, pix_online, entrega_por_bairro, entrega_por_cidade, entrega_por_raio').eq('id', uid).maybeSingle() : { data: null }
        if (precisa && !perf) return { ok: false, erro: 'Não deu para ler a loja agora. Confira a internet e tente de novo.' }
        const pf = (perf || {}) as { endereco?: string | null; formas_entrega?: string[] | null; endereco_retirada?: string | null; pix_chave?: string | null; pix_nome?: string | null; pix_cidade?: string | null; pix_online?: boolean | null
          entrega_por_bairro?: { bairro: string; valor: number }[] | null; entrega_por_cidade?: { cidade: string; valor: number; ativo?: boolean }[] | null; entrega_por_raio?: { km: number; valor: number; ativo?: boolean }[] | null }
        if (a.descricao) up.descricao_loja = a.descricao
        if (a.whatsapp) up.telefone = a.whatsapp
        let endNovo: EnderecoDoo | null = null
        if (a.endereco) {
          let atual: EnderecoDoo = {}
          try { atual = pf.endereco ? JSON.parse(pf.endereco) : {} } catch { atual = {} }
          endNovo = { cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', ...atual, ...a.endereco }
          up.endereco = JSON.stringify(endNovo)
        }
        if (a.mostrar_endereco) { up.mostrar_localizacao = a.mostrar_endereco === 'completo'; up.mostrar_apenas_cidade = a.mostrar_endereco === 'cidade' }
        if (a.instagram) { const i = limparInstagram(a.instagram); if (!i) return { ok: false, erro: 'Confira o Instagram: só o @ da loja, como @doceformiga.' }; up.instagram = i }
        if (a.facebook) { const f = limparFacebook(a.facebook); if (!f) return { ok: false, erro: 'Confira o Facebook: o link da página, como facebook.com/doceformiga.' }; up.facebook = f }
        if (a.pagamentos) up.formas_pagamento = a.pagamentos
        if (a.troco != null) up.exibir_campo_troco = a.troco
        if (a.entregas) up.formas_entrega = a.entregas
        if (a.horario_retirada) up.horario_retirada = a.horario_retirada
        // retirada ligada: o endereço de retirada acompanha o endereço da loja (igual Dados da loja)
        const retirada = (a.entregas || pf.formas_entrega || []).includes('retirada')
        if (endNovo && retirada) up.endereco_retirada = [[endNovo.rua, endNovo.numero, endNovo.complemento].filter(Boolean).join(', '), endNovo.bairro, [endNovo.cidade, endNovo.estado].filter(Boolean).join('/')].filter(Boolean).join(' · ')
        if (a.taxa) {
          const t = a.taxa
          up.entrega_modo = t.modo
          if (t.modo === 'fixa') up.valor_entrega_propria = t.valor
          // (6.115) soma aos que já existem: o mesmo nome atualiza o valor; "remover" tira (antes a lista nova apagava os outros bairros)
          const chave = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
          const fora = new Set((t.remover || []).map(chave))
          const somar = <T,>(antes: T[] | null | undefined, novos: T[], nome: (x: T) => string) => {
            const l = (Array.isArray(antes) ? antes : []).filter(x => !fora.has(chave(nome(x))))
            for (const x of novos) { const i = l.findIndex(y => chave(nome(y)) === chave(nome(x))); if (i >= 0) l[i] = { ...x, ...l[i], valor: (x as { valor: number }).valor }; else l.push(x) }
            return l
          }
          if (t.modo === 'bairro') up.entrega_por_bairro = somar(pf.entrega_por_bairro, t.bairros || [], b => b.bairro)
          if (t.modo === 'cidade') up.entrega_por_cidade = somar(pf.entrega_por_cidade, (t.cidades || []).map(c => ({ ...c, ativo: true })), c => c.cidade)
          if (t.modo === 'raio') up.entrega_por_raio = somar(pf.entrega_por_raio, (t.raios || []).map(r => ({ ...r, ativo: true })), r => String(r.km)).sort((x, y) => x.km - y.km)
          if (t.modo !== 'fixa' && t.modo !== 'combinar' && t.fora_valor !== undefined) up.entrega_fora_valor = t.fora_valor
          // entrega por taxa: a entrega própria fica ligada
          const ents = (up.formas_entrega as string[] | undefined) || pf.formas_entrega || ['retirada']
          if (t.modo !== 'combinar' && !ents.includes('entrega_propria')) up.formas_entrega = [...ents, 'entrega_propria']
        }
        if (a.pix) {
          const p = a.pix
          if (p.chave) {
            const tipo = adivinharTipo(p.chave)
            const erroChave = problemaNaChave(p.chave, tipo)
            if (erroChave) return { ok: false, erro: erroChave }
            up.pix_chave = normalizarChave(p.chave, tipo)
          }
          if (p.nome) up.pix_nome = p.nome
          if (p.cidade) up.pix_cidade = p.cidade
          if (p.modo) up.pix_modo = p.modo
          if (p.sinal_pct != null) up.pix_sinal_pct = p.sinal_pct
          if (p.pagar_na_retirada != null) up.pagar_na_retirada = p.pagar_na_retirada
          if (p.online != null) {
            // Pix pelo cardápio só liga com chave, nome e cidade (igual a tela de Pagamento)
            const chave = (up.pix_chave as string) || pf.pix_chave, nome = (up.pix_nome as string) || pf.pix_nome, cidade = (up.pix_cidade as string) || pf.pix_cidade
            if (p.online && (!chave || !nome || !cidade)) return { ok: false, erro: `Para receber o Pix pelo cardápio falta ${!chave ? 'a chave Pix' : !nome ? 'o nome de quem recebe' : 'a cidade'}.` }
            up.pix_online = p.online
          }
          if (p.chave || p.online) {
            const fp = (up.formas_pagamento as string[] | undefined)
            if (fp && !fp.includes('pix')) up.formas_pagamento = [...fp, 'pix']
          }
        }
        if (a.cores) {
          if (a.cores.faixa_topo) up.cor_navbar = a.cores.faixa_topo
          if (a.cores.borda_logo) up.cor_borda = a.cores.borda_logo
          if (a.cores.nome_loja) up.cor_nome = a.cores.nome_loja
          up.design_escolhido = true
        }
        if (a.pausada != null) up.loja_pausada = a.pausada
        const { error } = await supabase.from('profiles').update(up).eq('id', uid)
        if (error) throw error
        if (endNovo) void atualizarPontoDaLoja(uid, endNovo) // a taxa por raio sai do ponto da loja
        const soCores = a.cores && Object.keys(up).every(k => k.startsWith('cor_') || k === 'design_escolhido')
        const entregaPag = a.pagamentos || a.entregas || a.taxa || a.pix || a.troco != null || a.horario_retirada
        return { ok: true, feito: 'Loja atualizada', abrir: soCores ? '/cardapio-design' : entregaPag ? '/checkout-config' : '/cardapio-config' }
      }
      case 'ficha': {
        // 1) o produto: pelo id ou pelo nome
        let prodId = a.produto_id || null
        if (prodId) {
          const { data } = await supabase.from('produtos').select('id').eq('id', prodId).eq('user_id', uid).maybeSingle()
          if (!data) prodId = null
        }
        if (!prodId) {
          const { data } = await supabase.from('produtos').select('id, nome').eq('user_id', uid).ilike('nome', a.produto_nome.trim()).limit(1)
          prodId = (data as { id: string }[] | null)?.[0]?.id || null
        }
        if (!prodId) return { ok: false, erro: `Não achei o produto "${a.produto_nome}" no cardápio. Cadastre o produto primeiro.` }
        // 2) cada ingrediente: o que já existe (pelo id ou pelo nome) ou cadastra o novo
        const linhas: { insumo_id: string; quantidade: number; unidade_utilizada: string; quantidade_base: number; custo: number }[] = []
        const novos: string[] = []
        for (const i of a.itens) {
          let ins: { id: string; nome: string; unidade: string; custo_unitario: number } | null = null
          if (i.insumo_id) {
            const { data } = await supabase.from('insumos').select('id, nome, unidade, custo_unitario').eq('id', i.insumo_id).eq('user_id', uid).maybeSingle()
            ins = data as typeof ins
          }
          if (!ins) {
            const achado = await procurarInsumoPorNome(uid, i.nome).catch(() => null)
            if (achado) ins = { id: achado.id, nome: achado.nome, unidade: achado.unidade, custo_unitario: achado.custo_unitario }
          }
          if (!ins && i.novo) {
            const r = await salvarInsumoDoo(uid, { acao: 'insumo', nome: i.nome, marca: i.novo.marca || '', categoria: categoriaPeloNome(i.nome) || 'Outros', unidade: i.novo.unidade, embalagem_tipo: i.novo.embalagem_tipo || 'Avulso', qtd_embalagem: i.novo.qtd_embalagem, valor_compra: i.novo.valor_compra })
            if (r.ok === false) return { ok: false, erro: `${i.nome}: ${r.erro}` }
            ins = { id: r.id, nome: i.nome, unidade: i.novo.unidade, custo_unitario: i.novo.valor_compra / i.novo.qtd_embalagem }
            novos.push(i.nome)
          }
          if (!ins) return { ok: false, erro: `Falta o preço de ${i.nome}: diga quanto vem na embalagem e quanto pagou.` }
          const uIns = UNID[ins.unidade === 'l' ? 'L' : ins.unidade], uRec = UNID[i.unidade]
          if (!uIns || !uRec || uIns.fam !== uRec.fam) return { ok: false, erro: `${ins.nome} está cadastrado em ${ins.unidade} e a receita usa ${i.unidade}. Ajuste a unidade e tente de novo.` }
          const naUnidadeDoInsumo = (i.quantidade * uRec.base) / uIns.base
          linhas.push({ insumo_id: ins.id, quantidade: i.quantidade, unidade_utilizada: i.unidade, quantidade_base: i.quantidade * uRec.base, custo: naUnidadeDoInsumo * (Number(ins.custo_unitario) || 0) })
        }
        // 3) grava a ficha (substitui a anterior) e o rendimento
        const { error } = await gravarInsumosDoProduto(prodId, linhas.map(l => ({ user_id: uid, produto_id: prodId, insumo_id: l.insumo_id, quantidade: l.quantidade, unidade_utilizada: l.unidade_utilizada, quantidade_base: l.quantidade_base })))
        if (error) throw error
        if (a.rendimento) await supabase.from('produtos').update({ rendimento_qtd: a.rendimento, updated_at: new Date().toISOString() }).eq('id', prodId)
        const custo = linhas.reduce((t, l) => t + l.custo, 0)
        return { ok: true, feito: `Ficha salva · ingredientes ${brl(custo)}${novos.length ? ` · ${novos.length} ingrediente${novos.length > 1 ? 's' : ''} novo${novos.length > 1 ? 's' : ''}` : ''}`, abrir: '/ficha-tecnica' }
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
      case 'pedido_status': {
        const { data: lp, error: el } = await supabase.from('pedidos').select('id, numero, cliente_nome, status, tipo_entrega, valor_total, valor_recebido, status_pagamento, forma_pagamento')
          .eq('user_id', uid).eq('numero', a.numero).limit(1)
        if (el) throw el
        const p = (lp || [])[0] as { id: string; numero: number; cliente_nome: string | null; status: string; tipo_entrega: string | null; valor_total: number; valor_recebido: number; status_pagamento: string | null; forma_pagamento: string | null } | undefined
        if (!p) return { ok: false, erro: `Não achei o pedido #${a.numero}.` }
        const g = grupoDoStatus(p.status)
        if (g === 'cancelado') return { ok: false, erro: `O pedido #${p.numero} está cancelado.` }
        const retirada = p.tipo_entrega !== 'entrega'
        // a etapa vira a situação do banco (retirada: "pronto" é "Pronto para retirar"; "saiu" só existe na entrega)
        let novo: string | null = null
        if (a.etapa) {
          if (a.etapa === 'saiu' && retirada) return { ok: false, erro: `O pedido #${p.numero} é para retirar: ele vai de Pronto direto para Entregue.` }
          novo = { aceito: 'agendado', produzindo: 'em_producao', pronto: retirada ? 'aguardando_retirada' : 'finalizado', saiu: 'em_entrega', entregue: 'entregue' }[a.etapa]
          if (g === 'entregue' && novo !== 'entregue') return { ok: false, erro: `O pedido #${p.numero} já foi entregue. Para voltar a situação, use a tela do pedido.` }
          if (grupoDoStatus(novo) === g) novo = null
        }
        // 1) o dinheiro primeiro (igual a lista de Pedidos): se não gravar, a situação não muda
        let recebeu = 0
        const falta = saldoPedido(p)
        if (a.recebido) {
          if (falta <= 0.009) { if (!novo) return { ok: false, erro: `O pedido #${p.numero} já está pago.` } }
          else {
            const v = a.recebido === 'tudo' ? falta : Math.min(a.recebido, falta)
            const ja = falta < (Number(p.valor_total) || 0) - 0.009
            const r = await registrarPagamento({ pedidoId: p.id, userId: uid, valor: v, forma: a.forma || p.forma_pagamento, tipo: v >= falta - 0.009 ? (ja ? 'restante' : 'total') : 'parcial', origem: 'doo' })
            if (!r.ok) return { ok: false, erro: r.erro || 'Não deu para registrar o recebimento. Tente de novo.' }
            recebeu = v
          }
        }
        // 2) a situação (aceitar só vale se o pedido ainda está esperando)
        if (novo) {
          let q = supabase.from('pedidos').update({ status: novo }).eq('id', p.id)
          if (novo === 'agendado' && g === 'aguardando_aceite') q = q.in('status', ['aguardando_aceite', 'novo', 'pendente'])
          const { data: mudou, error } = await q.select('id')
          if (error) return { ok: false, erro: recebeu ? `O recebimento de ${brl(recebeu)} entrou, mas a situação não mudou. Tente de novo.` : 'Não deu para mudar a situação. Tente de novo.' }
          if (!mudou?.length) return { ok: false, erro: `O pedido #${p.numero} já tinha sido atualizado em outro lugar.` }
          registrarEtapa(p.id, novo, 'Pela Doo IA')
        }
        const sobra = Math.max(0, Math.round((falta - recebeu) * 100) / 100)
        const partes = [novo ? nomeDaSituacao(novo, p.tipo_entrega || 'retirada') : '', recebeu ? `${brl(recebeu)} recebido` : '', sobra > 0.009 ? `falta ${brl(sobra)}` : recebeu ? 'pago' : '']
        return { ok: true, feito: `#${p.numero} · ${partes.filter(Boolean).join(' · ')}`, abrir: `/pedidos/${p.id}/editar` }
      }
      case 'lancamento': {
        const hoje = hojeLocal()
        const desc = a.descricao || (a.categoria === 'Insumos' ? 'Ingredientes' : a.categoria)
        if (a.vencimento) {
          const { error } = await supabase.from('contas_pagar').insert({ user_id: uid, descricao: desc, categoria: a.categoria, valor: a.valor, vencimento: a.vencimento })
          if (error) throw error
          return { ok: true, feito: `Conta de ${brl(a.valor)} em A pagar · vence ${dataBR(a.vencimento)}`, abrir: '/financeiro' }
        }
        const data = a.data && a.data <= hoje ? a.data : hoje
        const linha: Record<string, unknown> = { user_id: uid, tipo: a.tipo, categoria: a.categoria, descricao: desc, valor: a.valor, data }
        let { error } = await supabase.from('financeiro').insert(a.tipo === 'entrada' ? { ...linha, forma: a.forma || 'pix' } : linha)
        if (error && a.tipo === 'entrada' && /forma/.test(error.message || '')) ({ error } = await supabase.from('financeiro').insert(linha))
        if (error) throw error
        return { ok: true, feito: `${a.tipo === 'entrada' ? 'Entrada' : 'Saída'} de ${brl(a.valor)} lançada${data === hoje ? '' : ` em ${dataBR(data)}`}`, abrir: '/financeiro' }
      }
      case 'produto_editar': {
        const { data: todos, error: el } = await lerProdutosDeVenda(uid, ',disponivel')
        if (el) throw el
        const semAc = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
        const lista = todos || []
        const p = (a.produto_id && lista.find(x => x.id === a.produto_id)) || lista.find(x => semAc(x.nome) === semAc(a.produto_nome))
          || (() => { const l = lista.filter(x => semAc(x.nome).includes(semAc(a.produto_nome))); return l.length === 1 ? l[0] : undefined })()
        if (!p) return { ok: false, erro: `Não achei o produto "${a.produto_nome}".` }
        const temOpcoes = opcoesDoProduto(p).length > 1
        if ((a.preco || a.preco_promocional) && temOpcoes) return { ok: false, erro: `${p.nome} tem tamanhos ou opções com preços diferentes: mude os preços na tela do produto.` }
        const precoBase = a.preco || Number(p.preco_normal) || 0
        if (a.preco_promocional && a.preco_promocional >= precoBase) return { ok: false, erro: `O preço da promoção precisa ser menor que ${brl(precoBase)}.` }
        const up: Record<string, unknown> = {}
        if (a.nome) up.nome = a.nome
        if (a.preco) up.preco_normal = a.preco
        if (a.sem_promocao) Object.assign(up, { promocao: false, preco_promocional: null, desconto_percentual: null })
        else if (a.preco_promocional) Object.assign(up, { promocao: true, tipo_promocao: 'fixo', preco_promocional: a.preco_promocional })
        else if (a.desconto_percentual) Object.assign(up, { promocao: true, tipo_promocao: 'percentual', desconto_percentual: a.desconto_percentual })
        if (a.disponivel != null) up.disponivel = a.disponivel
        if (a.destaque != null) up.destaque = a.destaque
        if (a.pronta_entrega != null) up.pronta_entrega = a.pronta_entrega
        if (a.descricao != null) up.descricao = a.descricao || null
        if (a.categoria) up.categoria = a.categoria
        const { error } = await supabase.from('produtos').update(up).eq('id', p.id).eq('user_id', uid)
        if (error) {
          if (/limite_destaques/.test(`${error.message} ${(error as { hint?: string }).hint || ''}`)) return { ok: false, erro: 'Já tem 6 produtos em destaque. Tire um do destaque antes.' }
          throw error
        }
        if (a.categoria) {
          const { data: cat } = await supabase.from('categorias').select('nome').eq('user_id', uid).ilike('nome', a.categoria).limit(1)
          if (!cat || !cat.length) await supabase.from('categorias').insert({ user_id: uid, nome: a.categoria })
        }
        return { ok: true, feito: `${a.nome || p.nome} atualizado`, abrir: '/produtos' }
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
/** (6.107) os campos da loja que a Doo lê para saber como está o cardápio hoje */
export const CAMPOS_LOJA_DOO = 'nome_loja, horario, descricao_loja, telefone, endereco, mostrar_localizacao, mostrar_apenas_cidade, instagram, facebook, formas_pagamento, exibir_campo_troco, formas_entrega, horario_retirada, entrega_modo, valor_entrega_propria, entrega_por_bairro, entrega_por_cidade, entrega_por_raio, entrega_fora_valor, pix_online, pix_chave, pix_nome, pix_cidade, pix_modo, pix_sinal_pct, pagar_na_retirada, cor_navbar, cor_borda, cor_nome, loja_pausada, logo_url, banner_url, banner_topo_url'
export type LojaDoo = Record<string, unknown> & { nome_loja?: string | null; horario?: unknown }

/** Como o cardápio está hoje, em linhas curtas (vai no prompt: a Doo sabe o que falta e não pergunta o que já tem) */
function estadoLoja(l: LojaDoo, h: HorarioDoo | null): string {
  const t = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '')
  let end: EnderecoDoo
  try { end = typeof l.endereco === 'string' ? JSON.parse(l.endereco) : (l.endereco as EnderecoDoo) || {} } catch { end = {} }
  const endTx = [[end.rua, end.numero].filter(Boolean).join(', '), end.bairro, [end.cidade, end.estado].filter(Boolean).join('/'), end.cep].filter(Boolean).join(' · ')
  const lst = (v: unknown) => (Array.isArray(v) ? v as Record<string, unknown>[] : [])
  const modo = t(l.entrega_modo) || (lst(l.entrega_por_bairro).length ? 'bairro' : 'fixa')
  const vf = l.valor_entrega_propria == null ? null : Number(l.valor_entrega_propria)
  const taxa = modo === 'combinar' ? 'a combinar pelo WhatsApp'
    : modo === 'bairro' ? `por bairro: ${lst(l.entrega_por_bairro).map(b => `${b.bairro} ${brl(Number(b.valor) || 0)}`).join(', ') || 'nenhum bairro'}`
    : modo === 'cidade' ? `por cidade: ${lst(l.entrega_por_cidade).map(c => `${c.cidade} ${brl(Number(c.valor) || 0)}`).join(', ') || 'nenhuma cidade'}`
    : modo === 'raio' ? `por distância: ${lst(l.entrega_por_raio).map(r => `até ${r.km} km ${brl(Number(r.valor) || 0)}`).join(', ') || 'nenhuma faixa'}`
    : vf == null ? 'valor fixo NÃO definido (aparece "a combinar")' : vf > 0 ? `fixa ${brl(vf)}` : 'grátis'
  const falta = (v: string) => v || 'FALTA'
  return [
    `Nome: ${falta(t(l.nome_loja))}`, `Horário: ${textoHorario(h) || 'FALTA'}`, `Descrição: ${falta(t(l.descricao_loja))}`, `WhatsApp: ${falta(t(l.telefone))}`,
    `Endereço: ${falta(endTx)} (no cardápio: ${l.mostrar_localizacao ? 'completo' : l.mostrar_apenas_cidade ? 'só a cidade' : 'não mostra'})`,
    `Instagram: ${t(l.instagram) ? '@' + t(l.instagram) : 'não tem'} · Facebook: ${t(l.facebook) || 'não tem'}`,
    `Pagamento: ${(Array.isArray(l.formas_pagamento) ? l.formas_pagamento as string[] : []).map(k => NOME_PAG[k] || k).join(', ') || 'FALTA'} · troco: ${l.exibir_campo_troco ? 'pergunta' : 'não pergunta'}`,
    `Entrega: ${(Array.isArray(l.formas_entrega) ? l.formas_entrega as string[] : []).map(k => NOME_ENT[k] || k).join(', ') || 'FALTA'} · horário de retirada: ${t(l.horario_retirada) || 'não definido'}`,
    `Taxa de entrega: ${taxa}`,
    `Pix: ${t(l.pix_chave) ? `chave ${t(l.pix_chave)}, ${t(l.pix_nome) || 'sem nome'}, ${t(l.pix_cidade) || 'sem cidade'}` : 'sem chave'} · pago pelo cardápio: ${l.pix_online ? `sim (${l.pix_modo === 'sinal' ? `sinal de ${l.pix_sinal_pct || 50}%` : l.pix_modo === 'total' ? 'valor total' : 'cliente escolhe'})` : 'não'}`,
    `Cores: faixa ${t(l.cor_navbar) || 'padrão'}, borda ${t(l.cor_borda) || 'padrão'}, nome ${t(l.cor_nome) || 'padrão'} · Logo: ${t(l.logo_url) ? 'tem' : 'FALTA'} · Foto do topo: ${t(l.banner_topo_url) ? 'tem' : 'não tem'}`,
    `Loja: ${l.loja_pausada ? 'PAUSADA (não recebe pedidos)' : 'aberta para pedidos'}`,
  ].map(x => '- ' + x).join('\n')
}

export function regrasAcoesDoo(loja: LojaDoo): string {
  let h: HorarioDoo | null
  try { h = typeof loja.horario === 'string' ? JSON.parse(loja.horario) : (loja.horario as HorarioDoo) || null } catch { h = null }
  return `

# AÇÕES NO APP: CLIENTE, PRODUTO, ORÇAMENTO, LOJA, CUPOM, PEDIDO E FINANCEIRO
Igual ao pedido e ao ingrediente: você só PREPARA. O app mostra um cartão e quem confirma e salva é a confeiteira. Pergunte SÓ o que falta, em uma frase curta. Nunca invente nome, telefone, preço ou data. Quando tiver o necessário, responda com UMA frase curta (ex.: "Confira e confirme no cartão abaixo.") e, no FINAL, UM bloco \`\`\`acao-doonly com o JSON. Nada depois do bloco. Nunca diga que salvou.

CLIENTE (precisa do nome; WhatsApp se ela souber). Para mudar um cliente que já existe na lista, use o id dele em cliente_id.
{"acao":"cliente","cliente_id":null,"nome":"Ana Souza","telefone":"41999990000","data_nascimento":"1990-05-12","email":null,"cidade":null,"observacoes":null}

PRODUTO (precisa do nome e do preço; pergunte a categoria se ela não disser; pronta_entrega false = sob encomenda; forma_venda "kg" só se for vendido por quilo).
Antes de mandar o bloco, para agilizar, pergunte NUMA mensagem só, curta e em lista, o que ela ainda não disse:
- Rendimento: quantas pessoas serve ou quantas fatias/unidades rende (vai para "rendimento", texto curto, ex.: "serve 10 pessoas, 20 fatias"). Pergunte só para bolo, torta, kit, caixa ou algo que se divide; doce unitário não precisa.
- Destaque: se quer em destaque (aparece no topo do cardápio, em cartão grande; cabem 6).
- Promoção: se quer pôr em promoção, com o preço promocional em R$ ("preco_promocional", menor que o preço) ou o desconto em % ("desconto_percentual").
Se ela responder "não", "pode ser sem" ou só uma parte, mande com o que ela disse, sem perguntar de novo. Foto, tamanhos e sabores ela completa depois na tela do produto: diga isso em meia frase.
{"acao":"produto","nome":"Bolo de pote Ninho","preco":15,"categoria":"Bolos de pote","descricao":"","pronta_entrega":true,"forma_venda":"unidade","rendimento":"","destaque":false,"preco_promocional":null,"desconto_percentual":null}

ORÇAMENTO (precisa do cliente e de pelo menos um item com valor; data, horário, pessoas e local se ela souber). Itens do cardápio pelo id e o preço do cardápio; item sob medida com produto_id null e o valor que ela disser. Vira um rascunho que ela revisa e envia na tela de Orçamentos.
{"acao":"orcamento","cliente":{"id":null,"nome":"Ana","telefone":""},"nome_evento":"Aniversário da Malu","data_evento":"2026-12-05","horario_evento":"16:00","pessoas":40,"local_evento":"","itens":[{"produto_id":null,"nome":"Bolo 2 andares","detalhe":"tema jardim","quantidade":1,"valor_unitario":380}],"tipo_entrega":"retirada","taxa_entrega":0}

LOJA E CARDÁPIO: você pode preencher QUALQUER campo da loja e do cardápio. Mande no bloco SÓ os campos que mudam (os outros ficam como estão). Pode juntar vários num bloco só.
- nome_loja; descricao (frase curta que aparece no cardápio, até 300 letras; ofereça escrever uma se estiver faltando); whatsapp (com DDD).
- horario: "dias" com os dias úteis abertos (Segunda, Terça, Quarta, Quinta, Sexta), "abertura" e "fechamento" HH:MM; sábado e domingo com abre_sabado / abre_domingo e os horários deles.
- endereco: {cep, rua, numero, complemento, bairro, cidade, estado (sigla)}; mostrar_endereco: "completo", "cidade" ou "nao" (o que o cliente vê no cardápio).
- instagram (o @) e facebook (o link da página).
- pagamentos: lista com "pix", "dinheiro", "credito", "debito" (a lista INTEIRA de como fica); troco: true para o cliente dizer se precisa de troco no dinheiro.
- entregas: lista com "retirada", "entrega_propria", "motoboy", "uber_flash", "combinar" (a lista INTEIRA); horario_retirada: texto curto (ex.: "das 9h às 18h").
- taxa (da entrega própria): {"modo":"fixa","valor":8} (valor 0 = grátis); {"modo":"bairro","bairros":[{"bairro":"Centro","valor":5}]}; {"modo":"cidade","cidades":[{"cidade":"Curitiba","valor":10}]}; {"modo":"raio","raios":[{"km":3,"valor":5},{"km":6,"valor":10}],"fora_valor":null}; {"modo":"combinar"}. "fora_valor": quanto cobra fora das faixas (null = não entrega fora).
  Bairros, cidades e faixas SOMAM aos que já existem: mande só os que entram ou mudam de valor (os outros continuam). Para tirar, "remover":["Centro"].
- pix: {"chave":"...","nome":"quem recebe","cidade":"cidade (até 15 letras)","online":true para o cliente pagar o Pix pelo cardápio,"modo":"escolha" (cliente escolhe sinal ou total), "sinal" ou "total","sinal_pct":50,"pagar_na_retirada":false}. Para ligar o online precisa da chave, do nome e da cidade.
- cores (do topo do cardápio, #RRGGBB): {"faixa_topo":"#F48FB1","borda_logo":"#FFFFFF","nome_loja":"#5A2E3E"}. Sugira cores que combinem com a logo e o estilo dela.
- pausada: true para parar de receber pedidos pelo cardápio (férias, agenda cheia); false para voltar.
Exemplo: {"acao":"loja","descricao":"Bolos caseiros e doces finos feitos com carinho em Curitiba.","pagamentos":["pix","dinheiro","credito","debito"],"entregas":["retirada","entrega_propria"],"taxa":{"modo":"bairro","bairros":[{"bairro":"Centro","valor":5},{"bairro":"Batel","valor":8}]}}
Para CONFIGURAR O CARDÁPIO TODO (ou "deixar a loja pronta"), olhe o que está com FALTA abaixo e pergunte uma coisa de cada vez, na ordem: WhatsApp, endereço, horário, descrição, pagamento e Pix, entrega e taxa. Junte as respostas e mande um bloco só no fim (ou um por parte, se ela preferir). Logo e banners você cria pela imagem (tipo "logo" ou "banner").
COMO O CARDÁPIO ESTÁ HOJE:
${estadoLoja(loja, h)}

CUPOM (precisa do código e do desconto; tipo "percentual" ou "fixo" em reais; publico "primeiro_pedido" se for só para cliente novo; mínimo, validade AAAA-MM-DD e limite de usos só se ela falar).
{"acao":"cupom","codigo":"NATAL10","tipo":"percentual","valor":10,"valor_minimo":null,"data_fim":null,"limite_uso":null,"publico":"todos"}

FICHA TÉCNICA (ingredientes de um produto do cardápio, com a quantidade da receita). Você MONTA a ficha inteira num bloco só: não cadastre ingrediente por ingrediente.
- produto_id: o id do produto na lista do cardápio (e produto_nome igual ao do cardápio). Se o produto não existe, ofereça cadastrar o produto antes.
- Para cada ingrediente: nome, quantidade e unidade USADAS NA RECEITA (g, kg, ml, L, un). Se ele já está na lista de insumos dela, mande o insumo_id. Se não está, mande "novo" com a embalagem e o preço que ela informou (unidade, qtd_embalagem, valor_compra). Ingrediente novo sem preço: pergunte numa mensagem só, em lista, o preço e a embalagem de TODOS que faltam.
- Use a unidade da receita na mesma família do cadastro (g ou kg para o que é pesado, ml ou L para líquido, un para ovos e embalagens).
- "rendimento" se ela disser (ex.: "1 kg, 10 fatias"). A ficha nova substitui a anterior do produto.
{"acao":"ficha","produto_id":"ID","produto_nome":"Bolo Mousse de Chocolate","rendimento":"1 kg","itens":[{"insumo_id":"ID","nome":"Leite condensado","quantidade":395,"unidade":"g"},{"insumo_id":null,"nome":"Gelatina incolor","quantidade":6,"unidade":"g","novo":{"unidade":"g","qtd_embalagem":24,"valor_compra":4.9,"embalagem_tipo":"Caixa"}}]}

MÃO DE OBRA E CUSTOS INVISÍVEIS (o que a ficha técnica usa para o custo de cada produto). Pergunte uma coisa de cada vez: quanto ela quer tirar de salário por mês, quantas horas trabalha por dia e em quais dias produz. Custos invisíveis são gás, luz, água e perdas, em % sobre os ingredientes: se ela não souber, sugira 25% e explique em uma frase. Mande só o que ela disse.
{"acao":"custos","salario_mensal":3000,"horas_dia":8,"dias":["seg","ter","qua","qui","sex","sab"],"custos_invisiveis_pct":25}

ANDAR COM O PEDIDO (ex.: "o pedido da Maria ficou pronto", "entreguei o #12", "ela pagou o resto no Pix"). Use o número do pedido das listas acima; se houver mais de um da mesma cliente ou ele não estiver nas listas, pergunte o número.
- etapa: "aceito" (aceitar pedido novo), "produzindo", "pronto", "saiu" (só pedido de entrega), "entregue". Só mande a etapa que ela disse.
- recebido: o valor que entrou agora, ou "tudo" para o que falta; forma: "pix", "dinheiro", "credito" ou "debito".
- Antes de marcar "entregue" (ou aceitar um que espera o Pix) um pedido que ainda tem valor a receber, pergunte numa frase se a cliente já pagou o que falta (diga o valor) e como.
- Cancelar pedido você não faz: diga que é na tela do pedido.
{"acao":"pedido_status","numero":12,"cliente":"Maria","etapa":"entregue","recebido":"tudo","forma":"pix"}

FINANCEIRO (dinheiro que entrou fora dos pedidos ou que saiu). Recebimento de PEDIDO não é aqui: use "pedido_status" com "recebido".
- tipo "saida" (gasto já pago) com categoria: ${CATEGORIAS_SAIDA.map(c => `"${c}"`).join(', ')}. "Insumos" é ingrediente. Conta que ainda vai pagar: mande "vencimento" (AAAA-MM-DD) e ela vai para A pagar.
- tipo "entrada" com categoria: ${CATEGORIAS_ENTRADA.map(c => `"${c}"`).join(', ')}, e "forma" (pix, dinheiro, credito, debito).
- data AAAA-MM-DD só se não for hoje (ex.: "ontem"). Descrição curta com o que ela disse.
{"acao":"lancamento","tipo":"saida","valor":32.5,"descricao":"Leite condensado","categoria":"Insumos","data":null,"forma":null,"vencimento":null}

MUDAR PRODUTO QUE JÁ EXISTE (preço, promoção, pausar ou voltar ao cardápio, destaque, pronta entrega ou encomenda, nome, categoria, descrição). Use o id da lista do cardápio (produto pausado não está na lista: mande só o produto_nome). Mande SÓ o que muda.
- disponivel false = pausar ("acabou", "esgotou", "tira do cardápio"); true = voltar. destaque true/false (cabem 6). sem_promocao true = tirar a promoção.
- Produto com tamanhos ou opções de preço: o preço muda na tela do produto (diga isso).
{"acao":"produto_editar","produto_id":"ID","produto_nome":"Bolo de pote Ninho","preco":16,"disponivel":null,"destaque":null}

O QUE VOCÊ NÃO FAZ PELA CONVERSA (diga com honestidade, em uma frase, e diga onde ela faz): excluir qualquer coisa, cancelar pedido, mudar foto, tamanhos ou sabores de produto, trocar o link (endereço) do cardápio, apagar ou corrigir lançamento do financeiro. Ex.: "Isso eu ainda não faço por aqui: é em Produtos, no produto."
`
}

/**
 * (04/11 · 6.43) 5 etapas: Evento, Itens, Valores (entrega, desconto e acréscimo), Condições e Enviar.
 * (24/10) Antes eram 3 etapas: Proposta (cliente, evento e itens), Condições (validade, sinal,
 * forma de pagamento e recado) e Enviar (prévia, WhatsApp, link e PDF). Salva como rascunho em qualquer etapa.
 * Respondido (aprovado ou recusado), a tela só mostra o resumo.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowsClockwise, CalendarBlank, CaretDown, Check, CheckCircle, Clock, Copy, UserPlus, UsersThree, FilePdf, MagnifyingGlass, MapPin, Minus, Package, PencilSimpleLine, Phone, Plus, Storefront, Trash, WarningCircle, X } from '@phosphor-icons/react'
import { CartaoPro } from '@/components/billing/RecursoPro'
import AppPageHeader from '@/components/AppPageHeader'
import CampoData from '@/components/CampoData'
import CalendarioMes from '@/components/CalendarioMes'
import HorarioSheet from '@/components/HorarioSheet'
import IconeWhatsApp from '@/components/IconeWhatsApp'
import { Botao, CaixasEscolha, Campo, CampoArea, Janela, MenuMais, TelaVazia, avisar, confirmar } from '@/components/base'
import { supabase } from '@/lib/supabase'
import { explicarErro } from '@/lib/erros'
import { useProfile, type Profile } from '@/hooks/useProfile'
import type { PostgrestError } from '@supabase/supabase-js'
import type { ProdutoPrecoJson } from '@/lib/precoCardapio'
import type { ProdutoCustoJson } from '@/lib/produto-precificacao'
import { usePlano } from '@/hooks/usePlano'
import { linkWhatsApp, mascaraTelefone, digitosAoDigitar } from '@/lib/telefone'
import { precoCardapioComPromocao, precoDoTamanho, descontoCardapio, comDesconto, type OpcaoGrupoJson } from '@/lib/precoCardapio'
import { calcularCustoLucro, lerMaoObraConta } from '@/lib/produto-precificacao'
import { gerarOrcamentoPDF } from '@/lib/gerarOrcamentoPDF'
import { CartProvider } from '@/context/CartContext'
import { ProductModal } from '@/components/cart/ProductModal'
import { carregarGruposDoBanco } from '@/lib/produto-grupos'
import { kitAtivo } from '@/lib/kitQuantidade'
import { itemDoCarrinhoParaPedido } from '@/lib/itemDoCarrinho'
import { detalhesItem } from '@/lib/itemSacola'
import { textoSaboresKit } from '@/lib/kitTexto'
import type { ItemDoCarrinho } from '@/lib/itemDoCarrinho'
import {
  FORMA_ORC, brl, hojeISO, dataLonga, diaSemanaCurto, horaCurta, linkProposta, maisDias, resumoDoPedido, somarItens, textoProposta, totalOrcamento, valorSinal,
  type ItemOrcamento, type Orcamento,
} from '@/lib/orcamentos'
import { COMO_ORCAMENTO, TOUR_ORCAMENTO } from '@/lib/comoTelas'
import PropostaOrcamento from '@/components/PropostaOrcamento'
import { chegouHa } from '@/components/pedidos/pedidoTexto'
import './orcamentos.css'

type Prod = ProdutoPrecoJson & { id: string; nome: string; categoria?: string | null; imagem_url?: string | null }
const novoId = () => Math.random().toString(36).slice(2, 10)
const foto1 = (f?: string | null) => (f ? String(f).split(/,(?=\s*(?:https?:|\/))/)[0].trim() : '')
const lerReais = (s: string) => { const d = s.replace(/\D/g, ''); return d ? parseInt(d, 10) / 100 : 0 }
const mostrarReais = (v: number) => (v > 0 ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')

const VAZIO = (uid: string): Orcamento => ({
  id: '', user_id: uid, numero: 0, token: '', status: 'rascunho', origem: 'manual', itens: [], fotos: [],
  desconto: 0, acrescimo: 0, taxa_entrega: 0, tipo_entrega: 'retirada', validade: maisDias(7),
  sinal_tipo: 'sem', sinal_valor: 0, forma_pagamento: 'combinar', created_at: new Date().toISOString(),
})

export default function OrcamentoEditar() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useProfile()
  const { isPro } = usePlano()
  const [o, setO] = useState<Orcamento | null>(null)
  const [erro, setErro] = useState('')
  const [etapa, setEtapa] = useState<number>(1)
  const [descModo, setDescModo] = useState<'sem' | 'pct' | 'valor'>('sem')
  const [descPct, setDescPct] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [mudou, setMudou] = useState(false)
  const [produtos, setProdutos] = useState<Prod[]>([])
  const [escolher, setEscolher] = useState(false)
  const [produtoOpcoes, setProdutoOpcoes] = useState<Record<string, any> | null>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [busca, setBusca] = useState('')
  const [extras, setExtras] = useState({ desconto: false, acrescimo: false, entrega: false })
  const [validadeTipo, setValidadeTipo] = useState<'3' | '7' | '15' | '30' | 'data' | 'sem'>('7')
  const [custos, setCustos] = useState<Record<string, number | null>>({})
  const [pedidoNumero, setPedidoNumero] = useState<number | null>(null)
  const [foto, setFoto] = useState('')
  // (6.62) cliente da lista ou novo, tamanho na caixinha do item e adicionais
  type Cli = { id: string; nome: string; telefone: string | null; whatsapp: string | null }
  type Extra = { id: string; nome: string; valor: number; descricao: string | null; imagem_url: string | null }
  const [clientes, setClientes] = useState<Cli[]>([])
  const [recentes, setRecentes] = useState<string[]>([])
  const [cliJanela, setCliJanela] = useState<null | 'lista' | 'novo'>(null)
  const [buscaCli, setBuscaCli] = useState('')
  const [novoCli, setNovoCli] = useState({ nome: '', tel: '' })
  const [salvandoCli, setSalvandoCli] = useState(false)
  const [adicionais, setAdicionais] = useState<Extra[]>([])
  const [tamanhoDe, setTamanhoDe] = useState<string | null>(null)
  // (6.82) janela de opções do item: tamanho (ou outro, digitado) e os adicionais cadastrados
  const [opTam, setOpTam] = useState<{ texto: string; preco: number } | 'outro' | null>(null)
  const [outroTam, setOutroTam] = useState({ nome: '', valor: 0 })
  const [opExtras, setOpExtras] = useState<string[]>([])
  const [msgZap, setMsgZap] = useState<string | null>(null)
  const [aprovando, setAprovando] = useState(false)
  const nomeLoja = profile?.nome_loja || 'Minha confeitaria'

  // carrega o orçamento (ou começa um novo) e os produtos do cardápio
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id || ''
      const [{ data: prods }, orc, { data: clis }, { data: ult }, { data: ext }] = await Promise.all([
        supabase.from('produtos').select('*').eq('user_id', uid).order('nome'),
        id && id !== 'novo' ? supabase.from('orcamentos').select('*').eq('id', id).maybeSingle() : Promise.resolve({ data: VAZIO(uid), error: null } as { data: Orcamento | null; error: PostgrestError | null }),
        supabase.from('clientes').select('id, nome, telefone, whatsapp').eq('user_id', uid).order('nome').limit(2000),
        supabase.from('pedidos').select('cliente_id').eq('user_id', uid).not('cliente_id', 'is', null).order('created_at', { ascending: false }).limit(40),
        supabase.from('biblioteca_extras').select('id, nome, valor, descricao, imagem_url').eq('user_id', uid).order('nome'),
      ])
      if (!vivo) return
      setProdutos((prods as Prod[]) || [])
      setClientes((clis as Cli[]) || [])
      setRecentes([...new Set(((ult as { cliente_id: string }[]) || []).map(x => x.cliente_id))])
      setAdicionais(((ext as Extra[]) || []).map(e => ({ ...e, valor: Number(e.valor) || 0 })))
      if (orc.error || !orc.data) { setErro(orc.error ? explicarErro(orc.error, 'Tente de novo em instantes.') : 'Este orçamento não existe mais.'); return }
      const d = orc.data as Orcamento
      d.itens = Array.isArray(d.itens) ? d.itens.map(i => ({ ...i, id: i.id || novoId() })) : []
      // pedido que chegou pelo link ainda não tem as condições: começa com 7 dias, sem sinal e a combinar
      d.forma_pagamento = d.forma_pagamento || 'combinar'
      d.sinal_tipo = d.sinal_tipo || 'sem'
      const validadePadrao = !d.validade && (d.status === 'novo' || d.status === 'rascunho')
      if (validadePadrao) d.validade = maisDias(7)
      setO(d)
      setExtras({ desconto: Number(d.desconto) > 0, acrescimo: Number(d.acrescimo) > 0, entrega: d.tipo_entrega === 'entrega' })
      setDescModo(Number(d.desconto) > 0 ? 'valor' : 'sem')
      if (validadePadrao) setValidadeTipo('7') // (6.175) padrão posto agora: é "7 dias" (contar do pedido antigo virava "Escolher data")
      else if (d.validade) {
        const dias = Math.round((new Date(`${d.validade}T12:00:00`).getTime() - new Date(`${(d.enviado_em || d.created_at).slice(0, 10)}T12:00:00`).getTime()) / 86400000)
        setValidadeTipo(dias === 3 ? '3' : dias === 15 ? '15' : dias === 30 ? '30' : dias === 7 ? '7' : 'data')
      } else if (d.status !== 'novo' && d.status !== 'rascunho') setValidadeTipo('sem') // (6.43) enviado sem validade = "Sem prazo"
      if (d.pedido_id) {
        const { data: p } = await supabase.from('pedidos').select('numero').eq('id', d.pedido_id).maybeSingle()
        if (vivo && p) setPedidoNumero((p as { numero: number | null }).numero)
      }
    })().catch(e => setErro(explicarErro(e, 'Tente de novo em instantes.')))
    return () => { vivo = false }
  }, [id])

  // custo de cada produto pela ficha técnica (para o lucro estimado)
  useEffect(() => {
    const ids = [...new Set((o?.itens || []).map(i => i.produto_id).filter(Boolean) as string[])].filter(x => !(x in custos))
    if (!ids.length) return
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id || ''
      const [{ data }, mao, { data: pf }] = await Promise.all([
        supabase.from('produtos').select('*, produto_insumos(quantidade, unidade_utilizada, insumos(*))').in('id', ids),
        lerMaoObraConta(uid).catch(() => null),
        supabase.from('profiles').select('custos_invisiveis_pct').eq('id', uid).maybeSingle(),
      ])
      const cv = (pf as { custos_invisiveis_pct?: number | null } | null)?.custos_invisiveis_pct != null ? Number((pf as { custos_invisiveis_pct?: number | null }).custos_invisiveis_pct) : null
      const novo: Record<string, number | null> = {}
      for (const x of ids) {
        const p = ((data as (ProdutoCustoJson & { id: string })[]) || []).find(y => y.id === x)
        const c = p ? calcularCustoLucro(p, mao, cv) : null
        novo[x] = c && c.temFicha ? c.custoTotal : null
      }
      setCustos(c => ({ ...c, ...novo }))
    })().catch(() => { /* sem o custo: o lucro não aparece */ })
  }, [o?.itens]) // eslint-disable-line react-hooks/exhaustive-deps

  const muda = (p: Partial<Orcamento>) => { setO(x => (x ? { ...x, ...p } : x)); setMudou(true) }
  // (6.171) desconto em %: acompanha o valor dos itens (antes ficava o R$ calculado na hora em que digitou)
  const subItens = o ? somarItens(o.itens) : 0
  useEffect(() => {
    if (descModo !== 'pct' || !o) return
    const p = Math.min(100, Number(String(descPct).replace(',', '.')) || 0)
    const d = Math.round(subItens * p) / 100
    if (Math.abs((Number(o.desconto) || 0) - d) > 0.004) setO(x => (x ? { ...x, desconto: d } : x))
  }, [subItens, descModo]) // eslint-disable-line react-hooks/exhaustive-deps
  // (6.51) evento de mais de um dia e horário (opcional)
  const [variosDias, setVariosDias] = useState<boolean | null>(null)
  const [horaAberta, setHoraAberta] = useState(false)
  const varios = variosDias ?? !!o?.data_evento_fim
  const ligarVarios = (on: boolean) => { setVariosDias(on); if (!on) muda({ data_evento_fim: null }) }
  const mudaInicio = (d: string) => muda({ data_evento: d, ...(o?.data_evento_fim && o.data_evento_fim <= d ? { data_evento_fim: null } : {}) })
  const mudaItem = (iid: string, p: Partial<ItemOrcamento>) => muda({ itens: (o?.itens || []).map(i => (i.id === iid ? { ...i, ...p } : i)) })
  const tiraItem = (iid: string) => muda({ itens: (o?.itens || []).filter(i => i.id !== iid) })

  // o que vale agora (os extras ligados e desligados entram na conta antes de salvar)
  const ov: Orcamento | null = o ? {
    ...o, desconto: extras.desconto ? Number(o.desconto) || 0 : 0, acrescimo: extras.acrescimo ? Number(o.acrescimo) || 0 : 0,
    tipo_entrega: extras.entrega ? 'entrega' : 'retirada', taxa_entrega: extras.entrega ? Number(o.taxa_entrega) || 0 : 0,
  } : null
  const total = ov ? totalOrcamento(ov) : 0
  const sinal = ov ? valorSinal(ov, total) : 0
  const respondido = o?.status === 'aprovado' || o?.status === 'recusado'

  // lucro: só quando todos os itens são do cardápio e têm ficha técnica
  const lucro = useMemo(() => {
    if (!o || !(o.itens || []).length) return null
    const semFicha = (o.itens || []).find(i => !i.produto_id || custos[i.produto_id] == null)
    if (semFicha) return { falta: semFicha.produto_id ? `${semFicha.nome} está sem ficha técnica` : 'itens personalizados não têm ficha técnica' }
    const custo = (o.itens || []).reduce((s, i) => s + (custos[i.produto_id!] || 0) * (Number(i.quantidade) || 0), 0)
    const base = total - (ov?.tipo_entrega === 'entrega' ? Number(ov.taxa_entrega) || 0 : 0)
    const l = base - custo
    return { valor: l, pct: base > 0 ? (l / base) * 100 : 0 }
  }, [o, ov, custos, total])

  const salvar = async (extra: Partial<Orcamento> = {}): Promise<Orcamento | null> => {
    if (!o) return null
    setSalvando(true)
    const dados: Record<string, unknown> = {
      cliente_id: o.cliente_id || null, cliente_nome: o.cliente_nome?.trim() || null, cliente_telefone: o.cliente_telefone?.trim() || null,
      data_evento: o.data_evento || null, data_evento_fim: varios && o.data_evento && o.data_evento_fim && o.data_evento_fim > o.data_evento ? o.data_evento_fim : null,
      horario_evento: o.horario_evento ? o.horario_evento.slice(0, 5) : null, nome_evento: o.nome_evento?.trim() || null, local_evento: o.local_evento?.trim() || null,
      pessoas: o.pessoas || null, itens: (o.itens || []).map(({ id: iid, ...i }) => ({ id: iid, ...i, quantidade: Number(i.quantidade) || 1, valor_unitario: Number(i.valor_unitario) || 0 })),
      desconto: extras.desconto ? Number(o.desconto) || 0 : 0, acrescimo: extras.acrescimo ? Number(o.acrescimo) || 0 : 0,
      tipo_entrega: extras.entrega ? 'entrega' : 'retirada', taxa_entrega: extras.entrega ? Number(o.taxa_entrega) || 0 : 0,
      validade: o.validade || null, sinal_tipo: o.sinal_tipo, sinal_valor: Number(o.sinal_valor) || 0, forma_pagamento: o.forma_pagamento,
      mensagem: o.mensagem?.trim() || null, updated_at: new Date().toISOString(), ...extra,
    }
    try {
      if (!o.id) {
        const { data, error } = await supabase.from('orcamentos').insert({ user_id: o.user_id, origem: 'manual', status: extra.status || 'rascunho', ...dados }).select().single()
        if (error) throw error
        const novo = { ...(data as Orcamento), itens: (data as Orcamento).itens?.map((i: ItemOrcamento) => ({ ...i, id: i.id || novoId() })) || [] }
        setO(novo); setMudou(false)
        window.history.replaceState(window.history.state, '', `/orcamentos/${novo.id}`)
        return novo
      }
      // (28/10) só grava se a cliente ainda não respondeu (aprovar pelo link e salvar aqui ao mesmo tempo apagava o "aprovado")
      const { data, error } = await supabase.from('orcamentos').update(dados).eq('id', o.id).in('status', ['novo', 'rascunho', 'enviado']).select().maybeSingle()
      if (error) throw error
      if (!data) {
        const { data: atual } = await supabase.from('orcamentos').select('*').eq('id', o.id).maybeSingle()
        if (atual) setO({ ...(atual as Orcamento), itens: ((atual as Orcamento).itens || []).map((i: ItemOrcamento) => ({ ...i, id: i.id || novoId() })) })
        setMudou(false)
        avisar('O cliente já respondeu este orçamento.', { tipo: 'erro' })
        return null
      }
      const novo = { ...(data as Orcamento), itens: (data as Orcamento).itens?.map((i: ItemOrcamento) => ({ ...i, id: i.id || novoId() })) || [] }
      setO(novo); setMudou(false)
      return novo
    } catch (e) {
      avisar(explicarErro(e, 'Não deu para salvar. Confira a internet e tente de novo.'), { tipo: 'erro' })
      return null
    } finally { setSalvando(false) }
  }

  // (6.43) o que falta em cada etapa pra seguir: 1 Evento (o cliente) · 2 Itens · 4 Condições (a validade)
  const faltaNa = (n: number): string => !o ? '' : n === 1 ? (!(o.cliente_nome || '').trim() ? 'Escreva o nome do cliente' : '')
    : n === 2 ? (!(o.itens || []).length ? 'Coloque pelo menos um item' : (o.itens || []).some(i => !i.nome.trim()) ? 'Um item está sem nome' : somarItens(o.itens) <= 0 ? 'Coloque o valor dos itens' : '')
    : n === 4 ? (validadeTipo === 'data' && !o.validade ? 'Escolha até quando o orçamento vale' : '') : ''
  const faltaAte = (n: number) => { for (let k = 1; k < n; k++) { const f = faltaNa(k); if (f) return f } return '' }
  const ETAPAS = ['Evento', 'Itens', 'Valores', 'Condições', 'Enviar'] as const

  const continuar = async () => {
    const f = faltaNa(etapa)
    if (f) { avisar(f, { tipo: 'erro' }); return }
    if (mudou || !o?.id) { const ok = await salvar(); if (!ok) return }
    setEtapa(e => Math.min(5, e + 1)); window.scrollTo({ top: 0 })
  }

  // (28/10) a validade de 7/15/30 dias conta do dia do envio (antes contava do dia em que o rascunho foi criado)
  const dadosEnvio = (ignorarValidade = false): Partial<Orcamento> | null => {
    if (!o) return null
    if (!ignorarValidade && validadeTipo === 'data' && o.validade && o.validade < hojeISO()) { avisar('A validade já passou. Escolha outra data.', { tipo: 'erro' }); return null }
    return { status: 'enviado', enviado_em: o.enviado_em || new Date().toISOString(), ...(validadeTipo === 'sem' ? { validade: null } : validadeTipo !== 'data' ? { validade: maisDias(Number(validadeTipo)) } : {}) }
  }
  const enviarWhats = async () => {
    if (!o) return
    const env = dadosEnvio(); if (!env) return
    const salvo = await salvar(env)
    if (!salvo) return
    const link = linkProposta(salvo.token, window.location.origin)
    const tel = salvo.cliente_telefone || ''
    const texto = msgZap != null && msgZap.trim() ? `${msgZap.trim()}\n${link}` : textoProposta(salvo, nomeLoja, link)
    window.open(linkWhatsApp(tel, texto) || `https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
    avisar('Orçamento enviado. Você recebe o aviso quando ele responder.', { tipo: 'ok' })
  }
  const copiarLink = async () => {
    if (!o) return
    const env = dadosEnvio(); if (!env) return
    const salvo = await salvar(env)
    if (!salvo) return
    try { await navigator.clipboard.writeText(linkProposta(salvo.token, window.location.origin)); avisar('Link copiado. Ele já pode abrir e aprovar.', { tipo: 'ok' }) }
    catch { avisar('Não deu para copiar. Tente de novo.', { tipo: 'erro' }) }
  }
  // (03/11) PDF no padrão novo (o mesmo do pedido), com os extras que valem agora
  const baixarPdf = () => {
    if (!ov) return
    void gerarOrcamentoPDF(ov)
  }

  // (6.82) o cliente aprovou pelo WhatsApp (sem tocar no link): ela aprova aqui e o orçamento vira pedido na Agenda
  const aprovarPeloPainel = async () => {
    if (!o) return
    const ok = await confirmar({ titulo: 'O cliente aprovou?', texto: 'O orçamento vira um pedido na sua Agenda, com os itens, a data e o sinal combinado.', rotulo: 'Aprovar e criar o pedido' })
    if (!ok) return
    setAprovando(true)
    try {
      let tok = o.token
      // ainda não enviado (ou vencido): grava como enviado, sem prazo vencido, para poder aprovar
      if (o.status !== 'enviado' || mudou || (o.validade && o.validade < hojeISO())) {
        const env = dadosEnvio(true); if (!env) return // (6.175) aprovar orçamento vencido: a validade sai, não trava
        const salvo = await salvar({ ...env, ...(o.validade && o.validade < hojeISO() ? { validade: null } : {}) })
        if (!salvo) return
        tok = salvo.token
      }
      const { data, error } = await supabase.rpc('orcamento_responder', { p_token: tok, p_aprovar: true, p_motivo: null })
      if (error) throw error
      const r = data as { ok?: boolean; erro?: string; pedido_numero?: number } | null
      if (!r?.ok) { avisar(r?.erro || 'Não deu para aprovar agora.', { tipo: 'erro' }); return }
      const { data: atual } = await supabase.from('orcamentos').select('*').eq('id', o.id).maybeSingle()
      if (atual) setO({ ...(atual as Orcamento), itens: ((atual as Orcamento).itens || []).map((i: ItemOrcamento) => ({ ...i, id: i.id || novoId() })) })
      if (r.pedido_numero) setPedidoNumero(r.pedido_numero)
      avisar(`Aprovado! Virou o pedido #${r.pedido_numero ?? ''}`.trim(), { tipo: 'ok' })
    } catch (e) { avisar(explicarErro(e, 'Não deu para aprovar. Confira a internet e tente de novo.'), { tipo: 'erro' }) }
    finally { setAprovando(false) }
  }

  const excluir = async () => {
    if (!o?.id) { navigate('/orcamentos'); return }
    const ok = await confirmar({ titulo: 'Excluir este orçamento?', texto: 'Ele some da lista e o link para de funcionar.', rotulo: 'Excluir', perigo: true })
    if (!ok) return
    const { error } = await supabase.from('orcamentos').delete().eq('id', o.id)
    if (error) { avisar('Não deu para excluir. Tente de novo.', { tipo: 'erro' }); return }
    avisar('Orçamento excluído', { tipo: 'ok' }); navigate('/orcamentos', { replace: true })
  }

  const recadoPronto = () => {
    const nome = (o?.cliente_nome || '').trim().split(' ')[0]
    const evento = o?.nome_evento || o?.ocasiao
    muda({ mensagem: `Oi${nome ? `, ${nome}` : ''}! Que alegria fazer parte ${evento ? `do ${evento.toLowerCase().startsWith('anivers') || evento.toLowerCase().startsWith('casa') || evento.toLowerCase().startsWith('chá') ? evento.charAt(0).toLowerCase() + evento.slice(1) : evento}` : 'da sua festa'}. Preparei este orçamento com carinho. Qualquer dúvida, é só me chamar.` })
  }

  // (6.82) o topo: o número do orçamento e, embaixo, o cliente e quando chegou
  const titulo = o?.id && o.numero ? `Orçamento #${o.numero}` : 'Novo orçamento'
  const subtitulo = o?.id ? [o.cliente_nome, o.origem === 'link' ? chegouHa(o.created_at).replace(/^Chegou/, 'pediu pelo link') : ''].filter(Boolean).join(' · ') || 'Monte a proposta e envie o link' : 'Monte a proposta e envie o link'
  if (erro) return (<><AppPageHeader title="Orçamento" subtitle="Proposta para o cliente" voltar="/orcamentos" /><div className="orc"><TelaVazia caixa icone={<WarningCircle size={30} />} titulo="Não deu para abrir o orçamento" texto={erro} acao={<Botao onClick={() => navigate('/orcamentos')}>Voltar para a lista</Botao>} /></div></>)
  if (!o) return (<><AppPageHeader title="Orçamento" subtitle="Proposta para o cliente" voltar="/orcamentos" /><div className="orc"><div className="orc-carregando"><span className="ui-gira" aria-label="Carregando" /></div></div></>)
  // (6.110) aberto por link na conta grátis: o convite no padrão do app (antes era um aviso com só "Voltar")
  if (!isPro) return (<><AppPageHeader title="Orçamento" subtitle="Proposta para o cliente" voltar="/orcamentos" /><div className="orc"><CartaoPro recurso="orcamentos" /></div></>)

  // (6.82) o que o cliente pediu pelo link: um resumo em texto corrido e, embaixo, os dados um por linha (com o mapa do local)
  const localMapa = (o.local_evento || '').trim()
  const temEndereco = /\d/.test(localMapa) || /\b(rua|r\.|av\.?|avenida|alameda|travessa|estrada|rodovia|pra[çc]a)\b/i.test(localMapa)
  const pediu = o.origem === 'link' ? (
    <section className="orc-card orc-pediu">
      <h2>O que ele pediu</h2>
      <p className="orc-pediu-res">{resumoDoPedido(o)}</p>
      <div className="orc-pediu-l">
        <p><span>Cliente:</span> {o.cliente_nome || 'Sem nome'}{o.cliente_telefone && <> · <a href={linkWhatsApp(o.cliente_telefone)} target="_blank" rel="noopener noreferrer">{mascaraTelefone(o.cliente_telefone)}</a></>}</p>
        {o.pessoas ? <p><span>Evento:</span> para {o.pessoas} pessoas</p> : null}
        {o.data_evento && <p><span>Dia:</span> {o.data_evento_fim && o.data_evento_fim > o.data_evento ? `${diaSemanaCurto(o.data_evento)} a ${diaSemanaCurto(o.data_evento_fim)}` : diaSemanaCurto(o.data_evento)}</p>}
        {o.horario_evento && <p><span>Hora:</span> {horaCurta(o.horario_evento)}</p>}
        {localMapa && <p><span>Local:</span> {localMapa}</p>}
        {Number(o.orcamento_cliente) > 0 && <p><span>Quer gastar:</span> até {brl(Number(o.orcamento_cliente))}</p>}
      </div>
      {localMapa && temEndereco && (
        <div className="orc-pediu-mapa">
          <iframe title={`Mapa: ${localMapa}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?q=${encodeURIComponent(localMapa)}&output=embed`} />
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(localMapa)}`} target="_blank" rel="noopener noreferrer"><MapPin size={16} weight="bold" />Abrir no mapa</a>
        </div>
      )}
      {(o.fotos || []).length > 0 && <div className="orc-fotos">{(o.fotos || []).map((f, k) => <button key={k} type="button" onClick={() => setFoto(f)} aria-label={`Ver a foto ${k + 1}`}><img src={f} alt="" /></button>)}</div>}
    </section>
  ) : null

  // ── respondido: só o resumo ──
  if (respondido) {
    return (<>
      <AppPageHeader title={titulo} subtitle={subtitulo} voltar="/orcamentos" infoComo={COMO_ORCAMENTO} />
      <div className="orc orc-ed">
        <div className="orc-ed-main">
          <section className={`orc-res orc-res--${o.status}`}>
            <b>{o.status === 'aprovado' ? `Aprovado${pedidoNumero ? ` · virou o pedido #${pedidoNumero}` : ''}` : 'Recusado'}</b>
            <small>{o.respondido_em ? `Respondido em ${new Date(o.respondido_em).toLocaleDateString('pt-BR')}` : ''}{o.motivo_recusa ? ` · “${o.motivo_recusa}”` : ''}</small>
            {o.pedido_id && <Botao tamanho="m" onClick={() => navigate(`/pedidos/${o.pedido_id}/editar`)}>Abrir o pedido</Botao>}
          </section>
          <section className="orc-card"><PropostaOrcamento o={ov!} /></section>
          <div className="orc-acoes-fim"><Botao variante="secundario" icone={<FilePdf size={18} weight="bold" />} onClick={baixarPdf}>Baixar PDF</Botao></div>
        </div>
        {pediu && <aside className="orc-ed-lado" aria-label="Resumo do orçamento">{pediu}</aside>}
      </div>
      {foto && <Janela aberta aoFechar={() => setFoto('')} tipo="conteudo" titulo="Foto de referência"><img className="orc-foto-g" src={foto} alt="Foto de referência" /></Janela>}
    </>)
  }

  // (28/10) cliente em cartão compacto quando já vem preenchido (pedido pelo link); "Editar" abre os campos
  // (6.62) cliente: dois cartões (da lista ou novo); escolhido, vira o cartão compacto com "Trocar"
  const temCli = !!(o.cliente_nome || '').trim()
  const digitos = (t?: string | null) => (t || '').replace(/\D/g, '')
  const usarCliente = (c: Cli) => { muda({ cliente_id: c.id, cliente_nome: c.nome, cliente_telefone: c.whatsapp || c.telefone || null }); setCliJanela(null) }
  const trocarCliente = () => muda({ cliente_id: null, cliente_nome: null, cliente_telefone: null })
  const abrirNovoCli = (nome = '') => { setNovoCli({ nome, tel: '' }); setCliJanela('novo') }
  const salvarNovoCli = async () => {
    const nome = novoCli.nome.trim(); const tel = digitos(novoCli.tel)
    if (!nome) { avisar('Escreva o nome do cliente', { tipo: 'erro' }); return }
    // o mesmo WhatsApp já está na lista: usa o cadastro que existe (não cria cliente repetido)
    const ja = tel.length >= 10 ? clientes.find(c => digitos(c.whatsapp) === tel || digitos(c.telefone) === tel) : undefined
    if (ja) { usarCliente(ja); avisar(`Esse WhatsApp já é de ${ja.nome}: usamos o cadastro dela`); return }
    setSalvandoCli(true)
    const { data, error } = await supabase.from('clientes').insert({ user_id: o.user_id, nome, telefone: tel || null, whatsapp: tel || null }).select('id, nome, telefone, whatsapp').single()
    setSalvandoCli(false)
    if (error || !data) { muda({ cliente_id: null, cliente_nome: nome, cliente_telefone: tel || null }); setCliJanela(null); return }
    setClientes(l => [...l, data as Cli].sort((a, b) => a.nome.localeCompare(b.nome)))
    usarCliente(data as Cli)
  }
  const listaClientes = (() => {
    const q = buscaCli.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); const qd = digitos(buscaCli)
    if (q) return clientes.filter(c => c.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q) || (qd.length >= 3 && (digitos(c.whatsapp).includes(qd) || digitos(c.telefone).includes(qd))))
    const pos = new Map(recentes.map((rid, k) => [rid, k]))
    return [...clientes].sort((a, b) => (pos.get(a.id) ?? 9999) - (pos.get(b.id) ?? 9999) || a.nome.localeCompare(b.nome))
  })()
  // (6.62) tamanhos do produto do cardápio (com a promoção), para escolher na caixinha do item
  const tamanhosDo = (pid?: string | null) => {
    const p = produtos.find(x => x.id === pid) as (Prod & { grupo_tamanhos?: { ativo?: boolean; modo_preco_tamanho?: string; opcoes?: (OpcaoGrupoJson & { serve?: string | number | null })[]; rendimento_unidade?: string } ; preco_normal?: number }) | undefined
    const gt = p?.grupo_tamanhos
    if (!p || !gt?.ativo || !(gt.opcoes || []).length) return []
    const porPeso = gt.modo_preco_tamanho === 'por_peso'; const desc = descontoCardapio(p as never)
    return (gt.opcoes || []).filter(op => op && op.nome).map(op0 => {
      const op = op0 as OpcaoGrupoJson & { serve?: string | number | null }
      const serve = op.serve ? (/^\d+$/.test(String(op.serve).trim()) ? `serve até ${String(op.serve).trim()} ${String(gt.rendimento_unidade || '').trim() || 'pessoas'}` : `serve ${op.serve}`) : ''
      return { nome: String(op.nome), texto: [String(op.nome), serve].filter(Boolean).join(' · '), preco: comDesconto(precoDoTamanho(op, porPeso, Number(p.preco_normal) || 0), desc), esgotado: !!(op as { esgotado?: boolean }).esgotado }
    })
  }
  // (6.82) abre as opções do item com o que ele já tem marcado
  const abrirOpcoes = (iid: string) => {
    const lista = (o?.itens || [])
    const it = lista.find(x => x.id === iid)
    const tams = tamanhosDo(it?.produto_id)
    const atual = tams.find(t => t.texto === it?.tamanho)
    setOpTam(atual || (it?.tamanho ? 'outro' : null))
    setOutroTam(atual || !it?.tamanho ? { nome: '', valor: 0 } : { nome: it.tamanho, valor: Number(it.valor_unitario) || 0 })
    setOpExtras(lista.filter(x => x.extra_de === iid).map(x => adicionais.find(a => a.nome === x.nome)?.id || '').filter(Boolean))
    setTamanhoDe(iid)
  }
  const confirmarOpcoes = () => {
    if (!tamanhoDe || !o) return
    const iid = tamanhoDe
    if (opTam === 'outro' && !outroTam.nome.trim()) { avisar('Escreva o tamanho', { tipo: 'erro' }); return }
    let itens = (o.itens || []).map(it => {
      if (it.id !== iid) return it
      const tam = opTam === 'outro' ? { texto: outroTam.nome.trim(), preco: outroTam.valor } : opTam
      if (!tam) return it
      const resto = (it.detalhe || '').startsWith(it.tamanho || '\u0000') ? (it.detalhe || '').slice((it.tamanho || '').length).replace(/^ · /, '') : (it.detalhe || '')
      return { ...it, tamanho: tam.texto, detalhe: [tam.texto, resto].filter(Boolean).join(' · '), ...(tam.preco > 0 ? { valor_unitario: tam.preco } : {}) }
    })
    // os adicionais deste item: tira os desmarcados e põe os novos logo depois dele
    const ja = itens.filter(x => x.extra_de === iid)
    itens = itens.filter(x => x.extra_de !== iid || opExtras.some(eid => adicionais.find(a => a.id === eid)?.nome === x.nome))
    const novos = opExtras.map(eid => adicionais.find(a => a.id === eid)).filter((a): a is Extra => !!a && !ja.some(x => x.nome === a.nome))
      .map(a => ({ id: novoId(), nome: a.nome, quantidade: 1, valor_unitario: a.valor, imagem_url: a.imagem_url || null, extra_de: iid }))
    const pos = itens.findIndex(x => x.id === iid)
    let fim = pos; while (fim + 1 < itens.length && itens[fim + 1].extra_de === iid) fim++
    itens = [...itens.slice(0, fim + 1), ...novos, ...itens.slice(fim + 1)]
    muda({ itens })
    setTamanhoDe(null)
  }
  const botoesEtapa = etapa < 5 ? (<>
    {/* (6.49) o "Rascunho" foi pro fim (etapa Enviar); a etapa 1 tem só o Continuar */}
    {etapa > 1 && <Botao variante="secundario" onClick={() => { setEtapa(e => Math.max(1, e - 1)); window.scrollTo({ top: 0 }) }}>Voltar</Botao>}
    <Botao carregando={salvando} onClick={() => void continuar()}>Continuar</Botao>
  </>) : null

  const prodsFiltrados = produtos.filter(p => !busca.trim() || p.nome.toLowerCase().includes(busca.trim().toLowerCase()))

  return (<>
    <AppPageHeader title={titulo} subtitle={subtitulo} voltar="/orcamentos" infoComo={COMO_ORCAMENTO} infoTour={TOUR_ORCAMENTO}
      rightActions={<MenuMais rotulo="Mais ações do orçamento" itens={[...(o.id && (o.itens || []).length ? [{ Ic: CheckCircle, t: "Marcar como aprovado", sub: "O cliente aprovou pelo WhatsApp", aoTocar: () => { void aprovarPeloPainel() } }] : []), { Ic: Trash, t: "Excluir orçamento", sub: "Apaga de vez", perigo: true, aoTocar: () => { void excluir() } }]} />} />
    <div className={`orc orc-ed${etapa === 1 ? " orc-ed--largo" : ""}`}>
      <div className="orc-ed-main">
        {/* (6.43) etapas numeradas: a bolinha rosa é a atual; com ✓ as feitas; toca numa pra ir (as da frente só sem nada faltando) */}
        <ol className="orc-etapas orc-etapas--n" aria-label="Etapas">
          {ETAPAS.map((t, k) => {
            const n = k + 1
            const bloqueada = n > etapa && !!faltaAte(n)
            return (
              <li key={t} className={etapa === n ? 'on' : etapa > n ? 'ok' : ''}>
                <button type="button" disabled={bloqueada} aria-current={etapa === n ? 'step' : undefined} onClick={() => { if (!bloqueada) { setEtapa(n); window.scrollTo({ top: 0 }) } }}>
                  <i aria-hidden="true">{etapa > n ? <Check size={13} weight="bold" /> : n}</i><span>{t}</span>
                </button>
              </li>
            )
          })}
        </ol>

        {/* (6.49) PC: cliente e evento à esquerda; à direita o calendário do mês, com os dias que já têm pedido */}
        {etapa === 1 && (<div className="orc-e1"><div className="orc-e1-col">
          {pediu}
          <section className="orc-card">
            <h2 className="orc-h-acao">Cliente{temCli && <button type="button" className="orc-link-bt" onClick={trocarCliente}><ArrowsClockwise size={14} weight="bold" />Trocar</button>}</h2>
            {temCli ? (
              <div className="orc-cli">
                <span className="orc-av" aria-hidden="true">{(o.cliente_nome || '?').trim().charAt(0).toUpperCase()}</span>
                <span className="orc-cli-tx"><b>{o.cliente_nome}</b><small>{o.cliente_telefone ? mascaraTelefone(o.cliente_telefone) : 'Sem WhatsApp'}</small></span>
                {digitos(o.cliente_telefone).length >= 10 && <>
                  <a className="orc-cli-ic" href={linkWhatsApp(o.cliente_telefone || '') || '#'} target="_blank" rel="noreferrer" aria-label="Chamar no WhatsApp" title="WhatsApp"><IconeWhatsApp size={20} /></a>
                  <a className="orc-cli-ic" href={`tel:+55${digitos(o.cliente_telefone)}`} aria-label="Ligar" title="Ligar"><Phone size={20} weight="bold" /></a>
                </>}
              </div>
            ) : (
              <div className="orc-add orc-add--cli">
                <button type="button" className="orc-add-op" onClick={() => { setBuscaCli(''); setCliJanela('lista') }} disabled={!clientes.length}>
                  <span className="orc-add-ic" aria-hidden="true"><UsersThree size={26} weight="duotone" /></span>
                  <b>Já é cliente</b><small>{clientes.length ? 'Escolher da sua lista' : 'Nenhum cliente ainda'}</small>
                </button>
                <button type="button" className="orc-add-op" onClick={() => abrirNovoCli()}>
                  <span className="orc-add-ic" aria-hidden="true"><UserPlus size={26} weight="duotone" /></span>
                  <b>Cliente novo</b><small>Nome e WhatsApp</small>
                </button>
              </div>
            )}
          </section>

          <section className="orc-card">
            <h2>Evento</h2>
            <div className={`orc-ev${varios ? ' orc-ev--varios' : ''}`}>
              <div className="orc-ev-data">
                <span className="ui-campo-r"><span>{varios ? 'Primeiro dia' : 'Data'}</span></span>
                <CampoData valor={o.data_evento || ''} onChange={mudaInicio} titulo={varios ? 'Primeiro dia do evento' : 'Data do evento'} placeholder="Escolher" curto />
              </div>
              <div className="orc-ev-hora">
                <span className="ui-campo-r"><span>Horário</span></span>
                <button type="button" className="cdata" onClick={() => setHoraAberta(true)} aria-label={`Horário: ${o.horario_evento ? o.horario_evento.slice(0, 5) : 'escolher'}`}>
                  <Clock size={20} weight="bold" aria-hidden="true" />
                  <span className={o.horario_evento ? '' : 'ph'}>{o.horario_evento ? o.horario_evento.slice(0, 5) : '--:--'}</span>
                </button>
              </div>
              <button type="button" role="checkbox" aria-checked={varios} className="orc-varios orc-ev-varios" onClick={() => ligarVarios(!varios)}>
                <i className="orc-chk" aria-hidden="true">{varios && <Check size={14} weight="bold" />}</i>O evento dura mais de um dia
              </button>
              {varios && (
                <div className="orc-ev-fim">
                  <span className="ui-campo-r"><span>Último dia</span></span>
                  <CampoData valor={o.data_evento_fim || ''} min={o.data_evento || undefined} onChange={d => muda({ data_evento_fim: o.data_evento && d > o.data_evento ? d : null })} titulo="Último dia do evento" placeholder="Escolher" curto />
                </div>
              )}
              <Campo className="orc-ev-nome" rotulo="Nome do evento" value={o.nome_evento || ''} placeholder="Ex.: Aniversário da Malu" onChange={e => muda({ nome_evento: e.target.value })} />
            </div>
            <div className="orc-2">
              <Campo rotulo="Pessoas" inputMode="numeric" value={o.pessoas ? String(o.pessoas) : ''} placeholder="Ex.: 40" onChange={e => muda({ pessoas: parseInt(e.target.value.replace(/\D/g, ''), 10) || null })} />
              <Campo rotulo="Local" value={o.local_evento || ''} placeholder="Ex.: Salão do prédio" onChange={e => muda({ local_evento: e.target.value })} />
            </div>
            {horaAberta && <HorarioSheet titulo="Horário do evento" value={o.horario_evento ? o.horario_evento.slice(0, 5) : ''} onChange={h => muda({ horario_evento: h })} aoLimpar={o.horario_evento ? () => muda({ horario_evento: null }) : undefined} onClose={() => setHoraAberta(false)} />}
          </section>
          </div>
          <section className="orc-card orc-e1-cal">
            <h2 className="orc-h-acao">{varios ? 'Dias do evento' : 'Data do evento'}
              <button type="button" role="checkbox" aria-checked={varios} className="orc-varios" onClick={() => ligarVarios(!varios)}>
                <i className="orc-chk" aria-hidden="true">{varios && <Check size={14} weight="bold" />}</i>Mais de um dia
              </button>
            </h2>
            <CalendarioMes valor={o.data_evento || ''} fim={o.data_evento_fim} varios={varios} onChange={(ini, fim) => muda({ data_evento: ini, data_evento_fim: fim })} />
          </section>
        </div>)}

        {etapa === 2 && (<>
          <section className="orc-card">
            <h2>Itens</h2>
            {(o.itens || []).length === 0 && <p className="orc-vz orc-vz--c">Como você quer colocar o primeiro item?</p>}
            {/* (6.54) os itens em caixinhas, preenchendo da esquerda para a direita */}
            {(o.itens || []).length > 0 && <div className="orc-itens">
            {(o.itens || []).map(i => (
              <div key={i.id} className="orc-item">
                <div className="orc-item-top">
                  <span className="orc-item-ft" aria-hidden="true">{i.imagem_url ? <img src={i.imagem_url} alt="" /> : <Package size={20} />}</span>
                  {i.produto_id
                    ? <b className="orc-item-n" title={i.nome}>{i.nome}</b>
                    : <input className="orc-item-in" value={i.nome} placeholder="Nome do item" onChange={e => mudaItem(i.id, { nome: e.target.value })} aria-label="Nome do item" />}
                  <button type="button" className="orc-tira" aria-label={`Tirar ${i.nome || 'o item'}`} title="Tirar" onClick={() => tiraItem(i.id)}><Trash size={18} weight="bold" /></button>
                </div>
                {!i.extra_de && !!i.produto_id && (tamanhosDo(i.produto_id).length > 0 || adicionais.length > 0) && (() => {
                  const temTam = !!i.produto_id && tamanhosDo(i.produto_id).length > 0
                  const nx = (o.itens || []).filter(x => x.extra_de === i.id).length
                  const rot = temTam ? (i.tamanho || 'Escolher o tamanho') : 'Adicionais'
                  return (
                    <button type="button" className={`orc-item-tam${temTam && !i.tamanho ? ' vazio' : ''}`} onClick={() => abrirOpcoes(i.id)}>
                      <span>{rot}{nx > 0 ? ` · ${nx} ${nx === 1 ? 'adicional' : 'adicionais'}` : ''}</span><CaretDown size={14} weight="bold" aria-hidden="true" />
                    </button>
                  )
                })()}
                <input className="orc-item-det" value={i.detalhe || ''} placeholder={i.produto_id ? 'Detalhe: sabor, tamanho, tema' : 'Ex.: 2 andares, tema jardim'} onChange={e => mudaItem(i.id, { detalhe: e.target.value })} aria-label="Detalhe do item" />
                <div className="orc-item-l">
                  <span className="orc-qtd">
                    <button type="button" aria-label="Diminuir" onClick={() => mudaItem(i.id, { quantidade: Math.max(1, (Number(i.quantidade) || 1) - 1) })}><Minus size={16} weight="bold" /></button>
                    <b>{i.quantidade}</b>
                    <button type="button" aria-label="Aumentar" onClick={() => mudaItem(i.id, { quantidade: (Number(i.quantidade) || 1) + 1 })}><Plus size={16} weight="bold" /></button>
                  </span>
                  <label className="orc-valor"><span>R$</span><input inputMode="numeric" value={mostrarReais(Number(i.valor_unitario) || 0)} placeholder="0,00" onChange={e => mudaItem(i.id, { valor_unitario: lerReais(e.target.value) })} aria-label="Valor de cada um" /></label>
                </div>
                {(Number(i.quantidade) || 1) > 1 && Number(i.valor_unitario) > 0 && <small className="orc-item-tot">{i.quantidade} × {brl(Number(i.valor_unitario))} = <b>{brl((Number(i.quantidade) || 1) * Number(i.valor_unitario))}</b></small>}
              </div>
            ))}
            </div>}
            {/* (6.53) as duas formas de pôr item: dois cartões quadrados no meio da tela */}
            {/* (6.99) com itens já na lista: um botão só "Adicionar outro produto" (abre os produtos, com o item personalizado no topo) */}
            {(o.itens || []).length > 0 && <Botao variante="secundario" cheio className="orc-add-outro" icone={<Plus size={20} weight="bold" />} onClick={() => { setBusca(''); setEscolher(true) }}>Adicionar outro produto</Botao>}
            {(o.itens || []).length === 0 && <div className="orc-add">
              <button type="button" className="orc-add-op" onClick={() => { setBusca(''); setEscolher(true) }}>
                <span className="orc-add-ic" aria-hidden="true"><Storefront size={26} weight="duotone" /></span>
                <b>Do cardápio</b><small>Seus produtos</small>
              </button>
              <button type="button" className="orc-add-op" onClick={() => muda({ itens: [...(o.itens || []), { id: novoId(), nome: '', quantidade: 1, valor_unitario: 0 }] })}>
                <span className="orc-add-ic" aria-hidden="true"><PencilSimpleLine size={26} weight="duotone" /></span>
                <b>Personalizado</b><small>Feito sob medida</small>
              </button>
            </div>}
            {(o.itens || []).length > 0 && <div className="orc-tot"><span>Subtotal dos itens</span><b>{brl(somarItens(o.itens))}</b></div>}
          </section>
        </>)}

        {etapa === 3 && (() => {
          const sub = somarItens(o.itens)
          const desc = extras.desconto ? Number(o.desconto) || 0 : 0
          const acr = extras.acrescimo ? Number(o.acrescimo) || 0 : 0
          const ent = extras.entrega ? Number(o.taxa_entrega) || 0 : 0
          return (<>
          <section className="orc-card">
            <h2>Entrega</h2>
            <CaixasEscolha rotulo="Entrega" valor={extras.entrega ? 'entrega' : 'retirada'} opcoes={[
              { v: 'retirada', t: 'Retirada', sub: 'O cliente busca na loja' },
              { v: 'entrega', t: 'Entrega', sub: 'Você leva até o local do evento' },
            ]} onMudar={k => { setExtras(x => ({ ...x, entrega: k === 'entrega' })); setMudou(true) }} />
            {extras.entrega && <div className="orc-mt"><Campo rotulo="Taxa de entrega" prefixo="R$" inputMode="numeric" placeholder="0,00" value={mostrarReais(Number(o.taxa_entrega) || 0)} dica="Deixe 0,00 se a entrega for grátis." onChange={e => muda({ taxa_entrega: lerReais(e.target.value) })} /></div>}
          </section>

          <section className="orc-card">
            <h2>Desconto</h2>
            <CaixasEscolha rotulo="Desconto" valor={descModo} opcoes={[
              { v: 'sem', t: 'Sem desconto', sub: 'O valor dos itens fica como está' },
              { v: 'pct', t: 'Em porcentagem', sub: 'Ex.: 10% do valor dos itens' },
              { v: 'valor', t: 'Em reais', sub: 'Ex.: R$ 20,00 a menos' },
            ]} onMudar={k => { setDescModo(k); setExtras(x => ({ ...x, desconto: k !== 'sem' })); if (k === 'sem') muda({ desconto: 0 }); else setMudou(true) }} />
            {descModo === 'pct' && <div className="orc-mt"><Campo rotulo="Quanto de desconto" inputMode="decimal" placeholder="10" value={descPct} depois={<span className="orc-pct">%</span>}
              dica={Number(o.desconto) > 0 ? `${brl(Number(o.desconto))} a menos` : undefined}
              onChange={e => { const v = e.target.value.replace(/[^\d,]/g, '').slice(0, 5); setDescPct(v); const p = Math.min(100, Number(v.replace(',', '.')) || 0); muda({ desconto: Math.round(sub * p) / 100 }) }} /></div>}
            {descModo === 'valor' && <div className="orc-mt"><Campo rotulo="Quanto de desconto" prefixo="R$" inputMode="numeric" placeholder="0,00" value={mostrarReais(Number(o.desconto) || 0)} onChange={e => muda({ desconto: lerReais(e.target.value) })} /></div>}
          </section>

          <section className="orc-card">
            <h2>Acréscimo</h2>
            <Campo rotulo="Valor a mais" prefixo="R$" inputMode="numeric" placeholder="0,00" value={mostrarReais(Number(o.acrescimo) || 0)} dica="Ex.: topo personalizado, embalagem especial, montagem no local."
              onChange={e => { const v = lerReais(e.target.value); setExtras(x => ({ ...x, acrescimo: v > 0 })); muda({ acrescimo: v }) }} />
          </section>

          <section className="orc-card orc-conta">
            <h2>A conta</h2>
            <div className="orc-conta-l"><span>Itens</span><b>{brl(sub)}</b></div>
            {desc > 0 && <div className="orc-conta-l"><span>Desconto</span><b className="menos">− {brl(desc)}</b></div>}
            {acr > 0 && <div className="orc-conta-l"><span>Acréscimo</span><b>+ {brl(acr)}</b></div>}
            {extras.entrega && <div className="orc-conta-l"><span>Entrega</span><b>{ent > 0 ? `+ ${brl(ent)}` : 'Grátis'}</b></div>}
            <div className="orc-tot"><span>Total</span><b>{brl(total)}</b></div>
          </section>
          </>)
        })()}

        {etapa === 4 && (<>
          <section className="orc-card">
            <h2>Vale até <small className="obr">obrigatório</small></h2>
            <div className="orc-seg orc-seg--5" role="radiogroup" aria-label="Vale até">
              {([['3', '3 dias'], ['7', '7 dias'], ['15', '15 dias'], ['data', 'Outra data'], ['sem', 'Sem prazo']] as const).map(([k, t]) => (
                <button key={k} type="button" role="radio" aria-checked={validadeTipo === k} onClick={() => { setValidadeTipo(k); if (k === 'sem') muda({ validade: null }); else if (k === 'data') muda({ validade: null }); else muda({ validade: maisDias(Number(k)) }) }}>{t}</button>
              ))}
            </div>
            {validadeTipo === 'data'
              ? <div className="orc-mt"><CampoData valor={o.validade || ''} onChange={d => muda({ validade: d })} titulo="Vale até" placeholder="Escolher a data" /></div>
              : validadeTipo === 'sem'
                ? <p className="orc-nota"><CalendarBlank size={16} weight="bold" aria-hidden="true" />Vale sem prazo: o cliente pode aprovar quando quiser.</p>
                : <p className="orc-nota"><CalendarBlank size={16} weight="bold" aria-hidden="true" />Vale até {dataLonga(o.validade)}</p>}
          </section>

          <section className="orc-card">
            <h2>Sinal para reservar a data</h2>
            {/* (29/10 · 5.04) caixinhas com o que cada uma faz (antes: seletor de 4 partes) */}
            <CaixasEscolha rotulo="Sinal para reservar a data" valor={(o.sinal_tipo || 'sem') as 'sem' | '50' | 'total' | 'valor'} opcoes={[
              { v: 'sem', t: 'Sem sinal', sub: 'Ele aceita e paga tudo depois' },
              { v: '50', t: 'Metade (50%)', sub: 'Metade para reservar, o resto na entrega' },
              { v: 'total', t: 'Tudo antes', sub: 'Paga o valor inteiro para reservar a data' },
              { v: 'valor', t: 'Outro valor', sub: 'Você escreve quanto é o sinal' },
            ]} onMudar={k => muda({ sinal_tipo: k })} />
            {o.sinal_tipo === 'valor' && <div className="orc-mt"><Campo rotulo="Valor do sinal" prefixo="R$" inputMode="numeric" placeholder="0,00" value={mostrarReais(Number(o.sinal_valor) || 0)} onChange={e => muda({ sinal_valor: lerReais(e.target.value) })} /></div>}
            {/* (6.82) o sinal e o resto em duas linhas curtas (antes a frase quebrava no celular) */}
            {o.sinal_tipo === 'sem' ? <p className="orc-nota">Ele aceita e paga tudo na entrega.</p>
              : o.sinal_tipo === 'total' ? <p className="orc-nota">Para reservar: <b>{brl(total)}</b></p>
              : <div className="orc-sinal-res"><p><span>Sinal</span><b>{brl(sinal)}</b></p><p><span>Na entrega</span><b>{brl(Math.max(0, total - sinal))}</b></p></div>}
          </section>

          <section className="orc-card">
            <h2>Como ele paga</h2>
            <div className="orc-seg" role="radiogroup" aria-label="Como ele paga">
              {(['pix', 'dinheiro', 'cartao', 'combinar'] as const).map(k => (
                <button key={k} type="button" role="radio" aria-checked={o.forma_pagamento === k} onClick={() => muda({ forma_pagamento: k })}>{k === 'combinar' ? 'Combinar' : FORMA_ORC[k]}</button>
              ))}
            </div>
            <p className="orc-nota">Nada é cobrado pelo link: é o combinado, e vira a forma de pagamento do pedido.</p>
          </section>

          <section className="orc-card">
            <h2>Recado para ele</h2>
            <CampoArea rotulo="" aria-label="Recado para o cliente" rows={3} value={o.mensagem || ''} placeholder="Ex.: Oi, Ana! Que alegria fazer parte do aniversário da Malu." onChange={e => muda({ mensagem: e.target.value })} />
            {!(o.mensagem || '').trim() && <button type="button" className="orc-link-bt" onClick={recadoPronto}><Plus size={14} weight="bold" />Usar um recado pronto</button>}
            <p className="orc-nota">Se ele não responder em 3 dias, o orçamento fica em destaque na lista para você pedir o retorno.</p>
          </section>
        </>)}

        {etapa === 5 && (<>
          <section className="orc-card">
            <h2>Assim o cliente vê</h2>
            <PropostaOrcamento o={ov!} />
          </section>
          {/* (6.82) a mensagem que vai no WhatsApp: ela muda do jeito dela; o link vai junto no final */}
          <section className="orc-card">
            <h2 className="orc-h-acao">Mensagem do WhatsApp{msgZap != null && <button type="button" className="orc-link-bt" onClick={() => setMsgZap(null)}><ArrowsClockwise size={14} weight="bold" />Voltar ao texto pronto</button>}</h2>
            <CampoArea rotulo="" aria-label="Mensagem do WhatsApp" rows={8} value={msgZap ?? textoProposta(ov!, nomeLoja, '').trimEnd()} onChange={e => setMsgZap(e.target.value)} />
            <p className="orc-nota">O link do orçamento vai junto, no final da mensagem.</p>
          </section>
          <section className="orc-pronta"><Check size={18} weight="bold" aria-hidden="true" /><span><b>Pronto para enviar</b><small>{(o.itens || []).length} {(o.itens || []).length === 1 ? 'item' : 'itens'} · {brl(total)}{o.status === 'enviado' ? ' · já enviado (o link continua o mesmo)' : ''}</small></span></section>
          <div className="orc-envio">
            <Botao icone={<IconeWhatsApp size={18} />} carregando={salvando} onClick={() => void enviarWhats()}>{o.status === 'enviado' ? 'Enviar de novo no WhatsApp' : 'Enviar no WhatsApp'}</Botao>
            <div className="orc-envio-2">
              <Botao variante="secundario" icone={<Copy size={18} weight="bold" />} onClick={() => void copiarLink()}>Copiar link</Botao>
              <Botao variante="secundario" icone={<FilePdf size={18} weight="bold" />} onClick={baixarPdf}>Baixar PDF</Botao>
            </div>
            {/* (6.82) o cliente aprovou pelo WhatsApp: ela aprova aqui */}
            <button type="button" className="orc-aprovar-painel" disabled={aprovando || salvando} onClick={() => void aprovarPeloPainel()}><CheckCircle size={18} weight="bold" />{aprovando ? 'Aprovando…' : 'O cliente aprovou pelo WhatsApp? Aprovar aqui'}</button>
            {o.status !== 'enviado' && !respondido && <button type="button" className="orc-rasc" disabled={salvando} onClick={async () => { const ok = await salvar(); if (ok) { avisar('Rascunho salvo. Você envia quando quiser.', { tipo: 'ok' }); navigate('/orcamentos') } }}>Salvar como rascunho e enviar depois</button>}
          </div>
        </>)}

        {/* (04/11 · 6.47) a prévia do lado saiu: a tela fica numa coluna só, no meio. A prévia abre no "Ver como fica";
            no computador os botões ficam aqui embaixo, no canto e do tamanho do texto */}
        {etapa < 5 && <div className="orc-acoes-pc">
          <span>{botoesEtapa}</span>
        </div>}
      </div>
    </div>



    {etapa < 5 && (
      <div className="orc-pe">
        <div className="orc-pe-in">{botoesEtapa}</div>
      </div>
    )}

    <Janela aberta={escolher} aoFechar={() => setEscolher(false)} tipo="conteudo" titulo="Produtos do cardápio" className="orc-esc-janela">
      <div className="orc-esc">
        <label className="orc-busca"><MagnifyingGlass size={20} weight="bold" /><input type="search" placeholder="Buscar produto" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar produto" />{busca && <button type="button" className="ui-busca-x" aria-label="Limpar a busca" onClick={() => setBusca('')}><X size={18} weight="bold" /></button>}</label>
        <div className="orc-esc-l">
          {/* (6.99) item sob medida também pela lista */}
          {(o.itens || []).length > 0 && !busca.trim() && (
            <button type="button" className="orc-esc-it" onClick={() => { setEscolher(false); muda({ itens: [...(o.itens || []), { id: novoId(), nome: '', quantidade: 1, valor_unitario: 0 }] }) }}>
              <span className="orc-item-ft" aria-hidden="true"><PencilSimpleLine size={20} /></span>
              <span className="orc-esc-tx"><b>Item personalizado</b><small>Feito sob medida: você escreve o nome e o valor</small></span>
            </button>
          )}
          {prodsFiltrados.map(p => {
            const pc = precoCardapioComPromocao(p)
            return (
              <button key={p.id} type="button" className="orc-esc-it" onClick={async () => {
                // (6.45) produto com opções (tamanho, sabores do kit, recheios…) abre a mesma janela do cardápio: ela escolhe em vez de escrever
                const { data } = await supabase.from('produtos').select('*').eq('id', p.id).maybeSingle()
                const completo = (data || p) as typeof p & { kit_qtd?: unknown }
                const temOpcoes = carregarGruposDoBanco(completo as Parameters<typeof carregarGruposDoBanco>[0]).some(g => g.ativo && g.opcoes.length > 0) || kitAtivo(completo.kit_qtd as Parameters<typeof kitAtivo>[0])
                setEscolher(false)
                if (temOpcoes) { setProdutoOpcoes(completo); return }
                const nid = novoId()
                muda({ itens: [...(o.itens || []), { id: nid, produto_id: p.id, nome: p.nome, quantidade: 1, valor_unitario: pc.final || 0, imagem_url: foto1(p.imagem_url) || null }] })
                if (tamanhosDo(p.id).length || adicionais.length) abrirOpcoes(nid)
              }}>
                <span className="orc-item-ft" aria-hidden="true">{foto1(p.imagem_url) ? <img src={foto1(p.imagem_url)} alt="" /> : <Package size={20} />}</span>
                <span className="orc-esc-tx"><b>{p.nome}</b>{p.categoria && <small>{p.categoria}</small>}</span>
                <em>{pc.aPartir ? <small>a partir de</small> : null}{brl(pc.final || 0)}</em>
              </button>
            )
          })}
          {prodsFiltrados.length === 0 && <p className="orc-vz">Nenhum produto com esse nome.</p>}
        </div>
      </div>
    </Janela>
    {produtoOpcoes && (
      <CartProvider>
        <ProductModal isOpen orcamento product={produtoOpcoes as never} onClose={() => setProdutoOpcoes(null)} corBotao="#E85A8C" rotuloAdicionar="Colocar no orçamento"
          onAdicionar={(item: ItemDoCarrinho) => {
            const it = itemDoCarrinhoParaPedido(item)
            const kit = (item.escolhas as { kit?: { sabores?: { nome: string; qtd: number }[] } } | undefined)?.kit
            const detalhe = [...detalhesItem(item as never), kit?.sabores?.length ? textoSaboresKit(kit.sabores) : '', (item.observations || '').trim()].filter(Boolean).join(' · ')
            const nid = novoId()
            muda({ itens: [...(o?.itens || []), { id: nid, produto_id: it.produto_id, nome: it.nome_produto, detalhe, quantidade: Number(it.quantidade) || 1, valor_unitario: Number(it.valor_unitario) || 0, imagem_url: foto1(String(produtoOpcoes.imagem_url || '')) || null }] })
            setProdutoOpcoes(null)
            if (tamanhosDo(it.produto_id).length || adicionais.length) abrirOpcoes(nid)
          }} />
      </CartProvider>
    )}
    {/* (6.62) cliente da lista: busca parada em cima e só a lista rola */}
    <Janela aberta={cliJanela === 'lista'} aoFechar={() => setCliJanela(null)} tipo="conteudo" titulo="Seus clientes" className="orc-esc-janela">
      <div className="orc-esc">
        <label className="orc-busca"><MagnifyingGlass size={20} weight="bold" /><input type="search" placeholder="Buscar nome ou telefone" value={buscaCli} onChange={e => setBuscaCli(e.target.value)} aria-label="Buscar cliente" />{buscaCli && <button type="button" className="ui-busca-x" aria-label="Limpar a busca" onClick={() => setBuscaCli('')}><X size={18} weight="bold" /></button>}</label>
        <div className="orc-esc-l">
          {listaClientes.map(c => (
            <button key={c.id} type="button" className="orc-esc-it" onClick={() => usarCliente(c)}>
              <span className="orc-av" aria-hidden="true">{c.nome.trim().charAt(0).toUpperCase()}</span>
              <span className="orc-esc-tx"><b>{c.nome}</b><small>{c.whatsapp || c.telefone ? mascaraTelefone(c.whatsapp || c.telefone || '') : 'Sem telefone'}</small></span>
            </button>
          ))}
          {listaClientes.length === 0 && (
            <div className="orc-vz orc-esc-nada">Nenhum cliente com “{buscaCli.trim()}”.
              <button type="button" className="orc-link-bt" onClick={() => abrirNovoCli(/\d/.test(buscaCli) ? '' : buscaCli.trim())}><UserPlus size={14} weight="bold" />Cadastrar como cliente novo</button>
            </div>
          )}
        </div>
      </div>
    </Janela>
    {/* (6.62) cliente novo: já entra na lista dela (no próximo orçamento é só escolher) */}
    <Janela aberta={cliJanela === 'novo'} aoFechar={() => setCliJanela(null)} tipo="conteudo" titulo="Cliente novo"
      acoes={<Botao cheio carregando={salvandoCli} onClick={() => void salvarNovoCli()}>Usar este cliente</Botao>} umaAcao>
      <div className="orc-novo-cli">
        <Campo rotulo="Nome" value={novoCli.nome} placeholder="Nome do cliente" autoFocus onChange={e => setNovoCli(n => ({ ...n, nome: e.target.value }))} />
        <Campo rotulo="WhatsApp" value={mascaraTelefone(novoCli.tel)} inputMode="tel" autoComplete="tel" placeholder="(41) 99999-0000" onChange={e => setNovoCli(n => ({ ...n, tel: digitosAoDigitar(e.target.value) }))} />
      </div>
    </Janela>
    {/* (6.82) opções do item: o tamanho (ou "Outro tamanho", digitado) e os adicionais cadastrados (cada um vira uma linha do orçamento) */}
    {tamanhoDe && (() => {
      const it = (o.itens || []).find(x => x.id === tamanhoDe)
      const tams = tamanhosDo(it?.produto_id)
      return (
        <Janela aberta aoFechar={() => setTamanhoDe(null)} tipo="conteudo" titulo={it?.nome || 'Opções do item'} umaAcao
          acoes={<Botao cheio onClick={confirmarOpcoes}>Pronto</Botao>}>
          <div className="orc-tams">
            {tams.length > 0 && <p className="orc-op-t">Tamanho</p>}
            {tams.map(t => (
              <button key={t.texto} type="button" className="orc-tam" aria-pressed={opTam !== 'outro' && opTam?.texto === t.texto} disabled={t.esgotado} onClick={() => setOpTam(t)}>
                <i className="orc-tam-bol" aria-hidden="true" />
                <span><b>{t.nome}</b>{t.texto !== t.nome && <small>{t.texto.slice(t.nome.length + 3)}</small>}</span>
                <em>{t.esgotado ? 'Esgotado' : t.preco > 0 ? brl(t.preco) : ''}</em>
              </button>
            ))}
            {tams.length > 0 && <>
              <button type="button" className="orc-tam" aria-pressed={opTam === 'outro'} onClick={() => setOpTam('outro')}>
                <i className="orc-tam-bol" aria-hidden="true" />
                <span><b>Outro tamanho</b><small>Você escreve o tamanho e o valor</small></span>
              </button>
              {opTam === 'outro' && <div className="orc-outro-tam">
                <Campo rotulo="Tamanho" value={outroTam.nome} placeholder="Ex.: 3 kg, 50 fatias" autoFocus onChange={e => setOutroTam(x => ({ ...x, nome: e.target.value }))} />
                <Campo rotulo="Valor" prefixo="R$" inputMode="numeric" placeholder="0,00" value={mostrarReais(outroTam.valor)} onChange={e => setOutroTam(x => ({ ...x, valor: lerReais(e.target.value) }))} />
              </div>}
            </>}
            {adicionais.length > 0 && <p className="orc-op-t">Adicionais</p>}
            {adicionais.map(e => {
              const on = opExtras.includes(e.id)
              return (
                <button key={e.id} type="button" className="orc-tam orc-tam--chk" aria-pressed={on} onClick={() => setOpExtras(l => on ? l.filter(x => x !== e.id) : [...l, e.id])}>
                  <i className="orc-chk" aria-hidden="true">{on && <Check size={14} weight="bold" />}</i>
                  <span><b>{e.nome}</b>{e.descricao && <small>{e.descricao}</small>}</span>
                  <em>{e.valor > 0 ? `+ ${brl(e.valor)}` : 'Grátis'}</em>
                </button>
              )
            })}
          </div>
        </Janela>
      )
    })()}
    {foto && <Janela aberta aoFechar={() => setFoto('')} tipo="conteudo" titulo="Foto de referência"><img className="orc-foto-g" src={foto} alt="Foto de referência" /></Janela>}
  </>)
}

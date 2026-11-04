/**
 * (04/11 · 6.43) 5 etapas: Evento, Itens, Valores (entrega, desconto e acréscimo), Condições e Enviar.
 * (24/10) Antes eram 3 etapas: Proposta (cliente, evento e itens), Condições (validade, sinal,
 * forma de pagamento e recado) e Enviar (prévia, WhatsApp, link e PDF). Salva como rascunho em qualquer etapa.
 * Respondido (aprovado ou recusado), a tela só mostra o resumo.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarBlank, Check, Copy, Eye, FilePdf, MagnifyingGlass, Minus, Package, PencilSimple, Phone, Plus, Trash, WarningCircle, X } from '@phosphor-icons/react'
import AppPageHeader from '@/components/AppPageHeader'
import CampoData from '@/components/CampoData'
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
import { precoCardapioComPromocao } from '@/lib/precoCardapio'
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
  FORMA_ORC, brl, hojeISO, textoEntrega, dataLonga, linkProposta, maisDias, somarItens, textoCondicoes, dataCurta, textoProposta, totalOrcamento, valorSinal,
  type ItemOrcamento, type Orcamento,
} from '@/lib/orcamentos'
import { COMO_ORCAMENTO, TOUR_ORCAMENTO } from '@/lib/comoTelas'
import './orcamentos.css'

type Prod = ProdutoPrecoJson & { id: string; nome: string; categoria?: string | null; imagem_url?: string | null }
/** O perfil com a logo da loja (vem do banco junto com o resto) */
type PerfilComLogo = (Profile & { logo_url?: string | null }) | null
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
  const [editarCli, setEditarCli] = useState<boolean | null>(null) // (28/10) null = automático (cartão quando já tem nome e WhatsApp)
  const [mudou, setMudou] = useState(false)
  const [produtos, setProdutos] = useState<Prod[]>([])
  const [escolher, setEscolher] = useState(false)
  const [verPrevia, setVerPrevia] = useState(false)
  const [produtoOpcoes, setProdutoOpcoes] = useState<Record<string, any> | null>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [busca, setBusca] = useState('')
  const [extras, setExtras] = useState({ desconto: false, acrescimo: false, entrega: false })
  const [validadeTipo, setValidadeTipo] = useState<'3' | '7' | '15' | '30' | 'data' | 'sem'>('7')
  const [custos, setCustos] = useState<Record<string, number | null>>({})
  const [pedidoNumero, setPedidoNumero] = useState<number | null>(null)
  const [foto, setFoto] = useState('')
  const nomeLoja = profile?.nome_loja || 'Minha confeitaria'

  // carrega o orçamento (ou começa um novo) e os produtos do cardápio
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id || ''
      const [{ data: prods }, orc] = await Promise.all([
        supabase.from('produtos').select('*').eq('user_id', uid).order('nome'),
        id && id !== 'novo' ? supabase.from('orcamentos').select('*').eq('id', id).maybeSingle() : Promise.resolve({ data: VAZIO(uid), error: null } as { data: Orcamento | null; error: PostgrestError | null }),
      ])
      if (!vivo) return
      setProdutos((prods as Prod[]) || [])
      if (orc.error || !orc.data) { setErro(orc.error ? explicarErro(orc.error, 'Tente de novo em instantes.') : 'Este orçamento não existe mais.'); return }
      const d = orc.data as Orcamento
      d.itens = Array.isArray(d.itens) ? d.itens.map(i => ({ ...i, id: i.id || novoId() })) : []
      // pedido que chegou pelo link ainda não tem as condições: começa com 7 dias, sem sinal e a combinar
      d.forma_pagamento = d.forma_pagamento || 'combinar'
      d.sinal_tipo = d.sinal_tipo || 'sem'
      if (!d.validade && (d.status === 'novo' || d.status === 'rascunho')) d.validade = maisDias(7)
      setO(d)
      setExtras({ desconto: Number(d.desconto) > 0, acrescimo: Number(d.acrescimo) > 0, entrega: d.tipo_entrega === 'entrega' })
      setDescModo(Number(d.desconto) > 0 ? 'valor' : 'sem')
      if (d.validade) {
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
      cliente_nome: o.cliente_nome?.trim() || null, cliente_telefone: o.cliente_telefone?.trim() || null,
      data_evento: o.data_evento || null, nome_evento: o.nome_evento?.trim() || null, local_evento: o.local_evento?.trim() || null,
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
  const dadosEnvio = (): Partial<Orcamento> | null => {
    if (!o) return null
    if (validadeTipo === 'data' && o.validade && o.validade < hojeISO()) { avisar('A validade já passou. Escolha outra data.', { tipo: 'erro' }); return null }
    return { status: 'enviado', enviado_em: o.enviado_em || new Date().toISOString(), ...(validadeTipo === 'sem' ? { validade: null } : validadeTipo !== 'data' ? { validade: maisDias(Number(validadeTipo)) } : {}) }
  }
  const enviarWhats = async () => {
    if (!o) return
    const env = dadosEnvio(); if (!env) return
    const salvo = await salvar(env)
    if (!salvo) return
    const link = linkProposta(salvo.token, window.location.origin)
    const tel = salvo.cliente_telefone || ''
    window.open(linkWhatsApp(tel, textoProposta(salvo, nomeLoja, link)) || `https://wa.me/?text=${encodeURIComponent(textoProposta(salvo, nomeLoja, link))}`, '_blank', 'noopener')
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

  const titulo = o?.id ? `Orçamento de ${(o.cliente_nome || 'cliente').split(' ')[0]}` : 'Novo orçamento'
  if (erro) return (<><AppPageHeader title="Orçamento" subtitle="Proposta para o cliente" voltar="/orcamentos" /><div className="orc"><TelaVazia caixa icone={<WarningCircle size={30} />} titulo="Não deu para abrir o orçamento" texto={erro} acao={<Botao onClick={() => navigate('/orcamentos')}>Voltar para a lista</Botao>} /></div></>)
  if (!o) return (<><AppPageHeader title="Orçamento" subtitle="Proposta para o cliente" voltar="/orcamentos" /><div className="orc"><div className="orc-carregando"><span className="ui-gira" aria-label="Carregando" /></div></div></>)
  if (!isPro) return (<><AppPageHeader title="Orçamento" subtitle="Proposta para o cliente" voltar="/orcamentos" /><div className="orc"><TelaVazia caixa icone={<WarningCircle size={30} />} titulo="Orçamentos é um recurso do PRO" texto={`Teste o PRO grátis por 7 dias para montar e enviar orçamentos.`} acao={<Botao onClick={() => navigate('/orcamentos')}>Voltar</Botao>} /></div></>)

  const pediu = o.origem === 'link' ? (
    <section className="orc-card orc-pediu">
      <h2>O que ele pediu</h2>
      <dl className="orc-kv">
        {o.ocasiao && <><dt>Para</dt><dd>{o.ocasiao}{o.pessoas ? ` · ${o.pessoas} pessoas` : ''}</dd></>}
        {o.data_evento && <><dt>Data</dt><dd>{dataLonga(o.data_evento)}</dd></>}
        {Number(o.orcamento_cliente) > 0 && <><dt>Quer gastar</dt><dd>até {brl(Number(o.orcamento_cliente))}</dd></>}
        {o.cliente_telefone && <><dt>WhatsApp</dt><dd><a href={linkWhatsApp(o.cliente_telefone)} target="_blank" rel="noopener noreferrer">{o.cliente_telefone}</a></dd></>}
      </dl>
      {o.descricao && <p className="orc-desc">“{o.descricao}”</p>}
      {(o.fotos || []).length > 0 && <div className="orc-fotos">{(o.fotos || []).map((f, k) => <button key={k} type="button" onClick={() => setFoto(f)} aria-label={`Ver a foto ${k + 1}`}><img src={f} alt="" /></button>)}</div>}
    </section>
  ) : null

  // ── respondido: só o resumo ──
  if (respondido) {
    return (<>
      <AppPageHeader title={titulo} subtitle={o.numero ? `Orçamento #${o.numero}` : 'Monte a proposta e envie o link'} voltar="/orcamentos" infoComo={COMO_ORCAMENTO} />
      <div className="orc orc-ed">
        <div className="orc-ed-main">
          <section className={`orc-res orc-res--${o.status}`}>
            <b>{o.status === 'aprovado' ? `Aprovado${pedidoNumero ? ` · virou o pedido #${pedidoNumero}` : ''}` : 'Recusado'}</b>
            <small>{o.respondido_em ? `Respondido em ${new Date(o.respondido_em).toLocaleDateString('pt-BR')}` : ''}{o.motivo_recusa ? ` · “${o.motivo_recusa}”` : ''}</small>
            {o.pedido_id && <Botao tamanho="m" onClick={() => navigate(`/pedidos/${o.pedido_id}/editar`)}>Abrir o pedido</Botao>}
          </section>
          <Resumo o={ov!} total={total} sinal={sinal} nomeLoja={nomeLoja} logo={(profile as PerfilComLogo)?.logo_url} />
          <div className="orc-acoes-fim"><Botao variante="secundario" icone={<FilePdf size={18} weight="bold" />} onClick={baixarPdf}>Baixar PDF</Botao></div>
        </div>
        {pediu && <aside className="orc-ed-lado" aria-label="Resumo do orçamento">{pediu}</aside>}
      </div>
      {foto && <Janela aberta aoFechar={() => setFoto('')} tipo="conteudo" titulo="Foto de referência"><img className="orc-foto-g" src={foto} alt="Foto de referência" /></Janela>}
    </>)
  }

  // (28/10) cliente em cartão compacto quando já vem preenchido (pedido pelo link); "Editar" abre os campos
  const cliPronto = !!(o.cliente_nome || '').trim() && (o.cliente_telefone || '').replace(/\D/g, '').length >= 10
  const verCampos = editarCli ?? !cliPronto
  const botoesEtapa = etapa < 5 ? (<>
    {etapa === 1
      ? <Botao variante="secundario" carregando={salvando && etapa === 1} onClick={async () => { const ok = await salvar(); if (ok) avisar('Rascunho salvo', { tipo: 'ok' }) }}>Rascunho</Botao>
      : <Botao variante="secundario" onClick={() => { setEtapa(e => Math.max(1, e - 1)); window.scrollTo({ top: 0 }) }}>Voltar</Botao>}
    <Botao carregando={salvando} onClick={() => void continuar()}>Continuar</Botao>
  </>) : null

  const prodsFiltrados = produtos.filter(p => !busca.trim() || p.nome.toLowerCase().includes(busca.trim().toLowerCase()))

  return (<>
    <AppPageHeader title={titulo} subtitle={o.numero ? `Orçamento #${o.numero}` : 'Monte a proposta e envie o link'} voltar="/orcamentos" infoComo={COMO_ORCAMENTO} infoTour={TOUR_ORCAMENTO}
      rightActions={<MenuMais rotulo="Mais ações do orçamento" itens={[{ Ic: Trash, t: "Excluir orçamento", sub: "Apaga de vez", perigo: true, aoTocar: () => { void excluir() } }]} />} />
    <div className="orc orc-ed">
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

        {etapa === 1 && (<>
          {pediu}
          <section className="orc-card">
            <h2 className="orc-h-acao">Cliente{!verCampos && <button type="button" className="orc-link-bt" onClick={() => setEditarCli(true)}><PencilSimple size={14} weight="bold" />Editar</button>}</h2>
            {verCampos ? (
              <div className="orc-2">
                <Campo rotulo="Nome" value={o.cliente_nome || ''} placeholder="Nome do cliente" onChange={e => muda({ cliente_nome: e.target.value })} />
                <Campo rotulo="WhatsApp" value={mascaraTelefone(o.cliente_telefone || '')} inputMode="tel" autoComplete="tel" placeholder="(41) 99999-0000" onChange={e => muda({ cliente_telefone: digitosAoDigitar(e.target.value) })} />
              </div>
            ) : (
              <div className="orc-cli">
                <span className="orc-av" aria-hidden="true">{(o.cliente_nome || '?').trim().charAt(0).toUpperCase()}</span>
                <span className="orc-cli-tx"><b>{o.cliente_nome}</b><small>{mascaraTelefone(o.cliente_telefone || '')}{o.origem === 'link' ? ' · pediu pelo link' : ''}</small></span>
                <a className="orc-cli-ic" href={linkWhatsApp(o.cliente_telefone || '') || '#'} target="_blank" rel="noreferrer" aria-label="Chamar no WhatsApp" title="WhatsApp"><IconeWhatsApp size={20} /></a>
                <a className="orc-cli-ic" href={`tel:+55${(o.cliente_telefone || '').replace(/\D/g, '')}`} aria-label="Ligar" title="Ligar"><Phone size={20} weight="bold" /></a>
              </div>
            )}
          </section>

          <section className="orc-card">
            <h2>Evento</h2>
            <div className="orc-ev">
              <div className="orc-ev-data">
                <span className="ui-campo-r"><span>Data</span></span>
                <CampoData valor={o.data_evento || ''} onChange={d => muda({ data_evento: d })} titulo="Data do evento" placeholder="Escolher" curto />
              </div>
              <Campo rotulo="Nome do evento" opcional value={o.nome_evento || ''} placeholder="Ex.: Aniversário da Malu" onChange={e => muda({ nome_evento: e.target.value })} />
            </div>
            <div className="orc-2">
              <Campo rotulo="Pessoas" opcional inputMode="numeric" value={o.pessoas ? String(o.pessoas) : ''} placeholder="Ex.: 40" onChange={e => muda({ pessoas: parseInt(e.target.value.replace(/\D/g, ''), 10) || null })} />
              <Campo rotulo="Local" opcional value={o.local_evento || ''} placeholder="Ex.: Salão do prédio" onChange={e => muda({ local_evento: e.target.value })} />
            </div>
          </section>

        </>)}

        {etapa === 2 && (<>
          <section className="orc-card">
            <h2>Itens</h2>
            {(o.itens || []).length === 0 && <p className="orc-vz">Coloque os produtos do seu cardápio ou um item personalizado (ex.: bolo de 2 andares com tema).</p>}
            {(o.itens || []).map(i => (
              <div key={i.id} className="orc-item">
                <span className="orc-item-ft" aria-hidden="true">{i.imagem_url ? <img src={i.imagem_url} alt="" /> : <Package size={20} />}</span>
                <div className="orc-item-c">
                  {i.produto_id
                    ? <b className="orc-item-n">{i.nome}</b>
                    : <input className="orc-item-in" value={i.nome} placeholder="Nome do item (ex.: Bolo 2 andares, tema jardim)" onChange={e => mudaItem(i.id, { nome: e.target.value })} aria-label="Nome do item" />}
                  <input className="orc-item-det" value={i.detalhe || ''} placeholder="Detalhe (opcional): sabor, tamanho, tema" onChange={e => mudaItem(i.id, { detalhe: e.target.value })} aria-label="Detalhe do item" />
                  <div className="orc-item-l">
                    <span className="orc-qtd">
                      <button type="button" aria-label="Diminuir" onClick={() => mudaItem(i.id, { quantidade: Math.max(1, (Number(i.quantidade) || 1) - 1) })}><Minus size={16} weight="bold" /></button>
                      <b>{i.quantidade}</b>
                      <button type="button" aria-label="Aumentar" onClick={() => mudaItem(i.id, { quantidade: (Number(i.quantidade) || 1) + 1 })}><Plus size={16} weight="bold" /></button>
                    </span>
                    <label className="orc-valor"><span>R$</span><input inputMode="numeric" value={mostrarReais(Number(i.valor_unitario) || 0)} placeholder="0,00" onChange={e => mudaItem(i.id, { valor_unitario: lerReais(e.target.value) })} aria-label="Valor de cada um" /></label>
                    <button type="button" className="orc-tira" aria-label={`Tirar ${i.nome || 'o item'}`} onClick={() => tiraItem(i.id)}><Trash size={18} weight="bold" /></button>
                  </div>
                </div>
              </div>
            ))}
            <div className="orc-add">
              <Botao variante="secundario" tamanho="m" icone={<Plus size={18} weight="bold" />} onClick={() => { setBusca(''); setEscolher(true) }}>Do cardápio</Botao>
              <Botao variante="secundario" tamanho="m" icone={<Plus size={18} weight="bold" />} onClick={() => muda({ itens: [...(o.itens || []), { id: novoId(), nome: '', quantidade: 1, valor_unitario: 0 }] })}>Personalizado</Botao>
            </div>
            <div className="orc-tot"><span>Subtotal dos itens</span><b>{brl(somarItens(o.itens))}</b></div>
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
            <h2>Acréscimo <small>opcional</small></h2>
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
            <p className="orc-nota">{o.sinal_tipo === 'sem' ? 'Sem sinal: ele aceita e paga tudo depois.' : o.sinal_tipo === 'total' ? `Ele paga tudo (${brl(total)}) para reservar a data.` : <>Sinal de <b>{brl(sinal)}</b> · o resto ({brl(Math.max(0, total - sinal))}) na entrega</>}</p>
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
            <h2>Recado para ele <small>opcional</small></h2>
            <CampoArea rotulo="" aria-label="Recado para o cliente" rows={3} value={o.mensagem || ''} placeholder="Ex.: Oi, Ana! Que alegria fazer parte do aniversário da Malu." onChange={e => muda({ mensagem: e.target.value })} />
            {!(o.mensagem || '').trim() && <button type="button" className="orc-link-bt" onClick={recadoPronto}><Plus size={14} weight="bold" />Usar um recado pronto</button>}
            <p className="orc-nota">Se ele não responder em 3 dias, o orçamento fica em destaque na lista para você pedir o retorno.</p>
          </section>
        </>)}

        {etapa === 5 && (<>
          <section className="orc-card">
            <h2>Assim o cliente vê</h2>
            <Resumo o={ov!} total={total} sinal={sinal} nomeLoja={nomeLoja} logo={(profile as PerfilComLogo)?.logo_url} />
          </section>
          <section className="orc-pronta"><Check size={18} weight="bold" aria-hidden="true" /><span><b>Pronto para enviar</b><small>{(o.itens || []).length} {(o.itens || []).length === 1 ? 'item' : 'itens'} · {brl(total)}{o.status === 'enviado' ? ' · já enviado (o link continua o mesmo)' : ''}</small></span></section>
          <div className="orc-envio">
            <Botao icone={<IconeWhatsApp size={18} />} carregando={salvando} onClick={() => void enviarWhats()}>{o.status === 'enviado' ? 'Enviar de novo no WhatsApp' : 'Enviar no WhatsApp'}</Botao>
            <div className="orc-envio-2">
              <Botao variante="secundario" icone={<Copy size={18} weight="bold" />} onClick={() => void copiarLink()}>Copiar link</Botao>
              <Botao variante="secundario" icone={<FilePdf size={18} weight="bold" />} onClick={baixarPdf}>Baixar PDF</Botao>
            </div>
          </div>
        </>)}

        {/* (04/11 · 6.47) a prévia do lado saiu: a tela fica numa coluna só, no meio. A prévia abre no "Ver como fica";
            no computador os botões ficam aqui embaixo, no canto e do tamanho do texto */}
        {etapa < 5 && <div className="orc-acoes-pc">
          <Botao variante="link" icone={<Eye size={18} weight="bold" />} onClick={() => setVerPrevia(true)}>Ver como fica</Botao>
          <span>{botoesEtapa}</span>
        </div>}
      </div>
    </div>

    <Janela aberta={verPrevia} aoFechar={() => setVerPrevia(false)} tipo="conteudo" titulo="Assim o cliente vê">
      <Resumo o={ov!} total={total} sinal={sinal} nomeLoja={nomeLoja} logo={(profile as PerfilComLogo)?.logo_url}
        montando={{ condicoes: etapa >= 4 || (o.status !== 'rascunho' && o.status !== 'novo') }} />
    </Janela>

    {etapa < 5 && (
      <div className="orc-pe">
        <div className="orc-pe-in">{botoesEtapa}</div>
      </div>
    )}

    <Janela aberta={escolher} aoFechar={() => setEscolher(false)} tipo="conteudo" titulo="Produtos do cardápio">
      <div className="orc-esc">
        <label className="orc-busca"><MagnifyingGlass size={18} weight="bold" /><input type="search" placeholder="Buscar produto" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar produto" /></label>
        <div className="orc-esc-l">
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
                muda({ itens: [...(o.itens || []), { id: novoId(), produto_id: p.id, nome: p.nome, quantidade: 1, valor_unitario: pc.final || 0, imagem_url: foto1(p.imagem_url) || null }] })
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
        <ProductModal isOpen product={produtoOpcoes as never} onClose={() => setProdutoOpcoes(null)} corBotao="#E85A8C" rotuloAdicionar="Colocar no orçamento"
          onAdicionar={(item: ItemDoCarrinho) => {
            const it = itemDoCarrinhoParaPedido(item)
            const kit = (item.escolhas as { kit?: { sabores?: { nome: string; qtd: number }[] } } | undefined)?.kit
            const detalhe = [...detalhesItem(item as never), kit?.sabores?.length ? textoSaboresKit(kit.sabores) : '', (item.observations || '').trim()].filter(Boolean).join(' · ')
            muda({ itens: [...(o?.itens || []), { id: novoId(), produto_id: it.produto_id, nome: it.nome_produto, detalhe, quantidade: Number(it.quantidade) || 1, valor_unitario: Number(it.valor_unitario) || 0, imagem_url: foto1(String(produtoOpcoes.imagem_url || '')) || null }] })
            setProdutoOpcoes(null)
          }} />
      </CartProvider>
    )}
    {foto && <Janela aberta aoFechar={() => setFoto('')} tipo="conteudo" titulo="Foto de referência"><img className="orc-foto-g" src={foto} alt="Foto de referência" /></Janela>}
  </>)
}

/** O orçamento como a cliente vê (prévia na etapa Enviar e o resumo depois de respondido) */
/** (6.46) montando: na prévia enquanto ela monta, o total só aparece com itens e as condições só a partir da etapa Condições
 *  (antes "Pagamento combinado com a loja · Vale até…" aparecia sem ela ter escolhido nada) */
export function Resumo({ o, total, sinal, nomeLoja, logo, montando }: { o: Orcamento; total: number; sinal: number; nomeLoja: string; logo?: string | null; montando?: { condicoes: boolean } }) {
  const temItens = (o.itens || []).length > 0
  const verCond = !montando || montando.condicoes
  return (
    <div className="orc-prev">
      <div className="orc-prev-loja">
        {logo ? <img src={logo} alt="" /> : <span>{nomeLoja.charAt(0)}</span>}
        <span><b>{nomeLoja}</b><small>Orçamento{o.cliente_nome ? ` para ${o.cliente_nome.split(' ')[0]}` : ''}</small></span>
      </div>
      {o.mensagem && <p className="orc-prev-msg">{o.mensagem}</p>}
      {/* (6.45) evento e data em linhas próprias (antes quebravam no meio) */}
      {(o.data_evento || o.nome_evento) && <p className="orc-prev-ev">{o.nome_evento && <b>{o.nome_evento}</b>}{o.data_evento && <span>{dataLonga(o.data_evento)}</span>}</p>}
      <div className="orc-prev-itens">
        {(o.itens || []).map(i => (
          <div key={i.id}><span><b>{i.quantidade > 1 ? `${i.quantidade} × ` : ''}{i.nome}</b>{i.detalhe && <small>{i.detalhe}</small>}</span><em>{brl(i.quantidade * i.valor_unitario)}</em></div>
        ))}
        {o.tipo_entrega === 'entrega' && <div><span><b>Entrega</b></span><em>{textoEntrega(o.taxa_entrega)}</em></div>}
        {Number(o.acrescimo) > 0 && <div><span><b>Acréscimo</b></span><em>{brl(o.acrescimo)}</em></div>}
        {Number(o.desconto) > 0 && <div className="ok"><span><b>Desconto</b></span><em>− {brl(o.desconto)}</em></div>}
      </div>
      {!montando || temItens ? <div className="orc-prev-tot"><span>Total</span><b>{brl(total)}</b></div> : <p className="orc-prev-vz">Os itens e o total aparecem aqui conforme você monta.</p>}
      {/* (6.45) uma informação por linha: como paga, o resto e a validade */}
      {verCond && <p className="orc-prev-cond">
        <span>{textoCondicoes({ ...o, validade: null }, total)}</span>
        {sinal > 0 && o.sinal_tipo !== 'total' && <span>Resto {brl(Math.max(0, total - sinal))} na entrega</span>}
        {o.validade && <span>Vale até {dataCurta(o.validade)}</span>}
      </p>}
    </div>
  )
}

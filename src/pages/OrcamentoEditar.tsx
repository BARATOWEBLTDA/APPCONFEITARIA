/**
 * (24/10) Montar o orçamento em 3 etapas: Proposta (cliente, evento e itens), Condições (validade, sinal,
 * forma de pagamento e recado) e Enviar (prévia, WhatsApp, link e PDF). Salva como rascunho em qualquer etapa.
 * Respondido (aprovado ou recusado), a tela só mostra o resumo.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarBlank, Check, Copy, FilePdf, MagnifyingGlass, Minus, Package, PencilSimple, Phone, Plus, Trash, WarningCircle, X } from '@phosphor-icons/react'
import AppPageHeader from '@/components/AppPageHeader'
import CampoData from '@/components/CampoData'
import IconeWhatsApp from '@/components/IconeWhatsApp'
import { Botao, CaixasEscolha, Campo, CampoArea, Janela, MenuMais, TelaVazia, avisar, confirmar } from '@/components/base'
import { supabase } from '@/lib/supabase'
import { explicarErro } from '@/lib/erros'
import { useProfile } from '@/hooks/useProfile'
import { usePlano } from '@/hooks/usePlano'
import { linkWhatsApp } from '@/lib/telefone'
import { precoCardapioComPromocao } from '@/lib/precoCardapio'
import { calcularCustoLucro, lerMaoObraConta } from '@/lib/produto-precificacao'
import { abrirJanela, card, esc, gerarDocumento, kv } from '@/lib/pdfDoonly'
import {
  FORMA_ORC, brl, hojeISO, textoEntrega, dataLonga, linkProposta, maisDias, somarItens, textoCondicoes, textoProposta, totalOrcamento, valorSinal,
  type ItemOrcamento, type Orcamento,
} from '@/lib/orcamentos'
import { COMO_ORCAMENTO, TOUR_ORCAMENTO } from '@/lib/comoTelas'
import './orcamentos.css'

type Prod = { id: string; nome: string; categoria?: string | null; imagem_url?: string | null; [k: string]: any }
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
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1)
  const [salvando, setSalvando] = useState(false)
  const [editarCli, setEditarCli] = useState<boolean | null>(null) // (28/10) null = automático (cartão quando já tem nome e WhatsApp)
  const [mudou, setMudou] = useState(false)
  const [produtos, setProdutos] = useState<Prod[]>([])
  const [escolher, setEscolher] = useState(false)
  const [busca, setBusca] = useState('')
  const [extras, setExtras] = useState({ desconto: false, acrescimo: false, entrega: false })
  const [validadeTipo, setValidadeTipo] = useState<'7' | '15' | '30' | 'data'>('7')
  const [custos, setCustos] = useState<Record<string, number | null>>({})
  const [pedidoNumero, setPedidoNumero] = useState<number | null>(null)
  const [foto, setFoto] = useState('')
  const nomeLoja = (profile as any)?.nome_loja || 'Minha confeitaria'

  // carrega o orçamento (ou começa um novo) e os produtos do cardápio
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id || ''
      const [{ data: prods }, orc] = await Promise.all([
        supabase.from('produtos').select('*').eq('user_id', uid).order('nome'),
        id && id !== 'novo' ? supabase.from('orcamentos').select('*').eq('id', id).maybeSingle() : Promise.resolve({ data: VAZIO(uid), error: null } as any),
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
      if (d.validade) {
        const dias = Math.round((new Date(`${d.validade}T12:00:00`).getTime() - new Date(`${(d.enviado_em || d.created_at).slice(0, 10)}T12:00:00`).getTime()) / 86400000)
        setValidadeTipo(dias === 15 ? '15' : dias === 30 ? '30' : dias === 7 ? '7' : 'data')
      }
      if (d.pedido_id) {
        const { data: p } = await supabase.from('pedidos').select('numero').eq('id', d.pedido_id).maybeSingle()
        if (vivo && p) setPedidoNumero((p as any).numero)
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
      const cv = (pf as any)?.custos_invisiveis_pct != null ? Number((pf as any).custos_invisiveis_pct) : null
      const novo: Record<string, number | null> = {}
      for (const x of ids) {
        const p = ((data as any[]) || []).find(y => y.id === x)
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
    const dados: any = {
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
        const novo = { ...(data as Orcamento), itens: (data as any).itens?.map((i: any) => ({ ...i, id: i.id || novoId() })) || [] }
        setO(novo); setMudou(false)
        window.history.replaceState(window.history.state, '', `/orcamentos/${novo.id}`)
        return novo
      }
      // (28/10) só grava se a cliente ainda não respondeu (aprovar pelo link e salvar aqui ao mesmo tempo apagava o "aprovado")
      const { data, error } = await supabase.from('orcamentos').update(dados).eq('id', o.id).in('status', ['novo', 'rascunho', 'enviado']).select().maybeSingle()
      if (error) throw error
      if (!data) {
        const { data: atual } = await supabase.from('orcamentos').select('*').eq('id', o.id).maybeSingle()
        if (atual) setO({ ...(atual as Orcamento), itens: ((atual as any).itens || []).map((i: any) => ({ ...i, id: i.id || novoId() })) })
        setMudou(false)
        avisar('O cliente já respondeu este orçamento.', { tipo: 'erro' })
        return null
      }
      const novo = { ...(data as Orcamento), itens: (data as any).itens?.map((i: any) => ({ ...i, id: i.id || novoId() })) || [] }
      setO(novo); setMudou(false)
      return novo
    } catch (e) {
      avisar(explicarErro(e, 'Não deu para salvar. Confira a internet e tente de novo.'), { tipo: 'erro' })
      return null
    } finally { setSalvando(false) }
  }

  const faltaEtapa1 = !o ? '' : !(o.cliente_nome || '').trim() ? 'Escreva o nome do cliente' : !(o.itens || []).length ? 'Coloque pelo menos um item' : (o.itens || []).some(i => !i.nome.trim()) ? 'Um item está sem nome' : total <= 0 ? 'Coloque o valor dos itens' : ''

  const continuar = async () => {
    if (etapa === 1 && faltaEtapa1) { avisar(faltaEtapa1, { tipo: 'erro' }); return }
    if (mudou || !o?.id) { const ok = await salvar(); if (!ok) return }
    setEtapa(e => (e < 3 ? ((e + 1) as 1 | 2 | 3) : e)); window.scrollTo({ top: 0 })
  }

  // (28/10) a validade de 7/15/30 dias conta do dia do envio (antes contava do dia em que o rascunho foi criado)
  const dadosEnvio = (): any | null => {
    if (!o) return null
    if (validadeTipo === 'data' && o.validade && o.validade < hojeISO()) { avisar('A validade já passou. Escolha outra data.', { tipo: 'erro' }); return null }
    return { status: 'enviado', enviado_em: o.enviado_em || new Date().toISOString(), ...(validadeTipo !== 'data' ? { validade: maisDias(Number(validadeTipo)) } : {}) }
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
  const baixarPdf = () => {
    if (!o) return
    const janela = abrirJanela()
    void gerarDocumento(() => ({
      titulo: `Orçamento #${o.numero || ''}`, tipo: 'Orçamento', numero: o.numero ? `#${o.numero}` : '',
      sub: [o.cliente_nome, o.data_evento ? dataLonga(o.data_evento) : ''].filter(Boolean).join(' · '),
      corpo: [
        o.mensagem ? card('Recado', `<p>${esc(o.mensagem)}</p>`) : '',
        card('Evento', kv([['Cliente', esc(o.cliente_nome || '')], ['Evento', esc(o.nome_evento || '')], ['Data', esc(dataLonga(o.data_evento))], ['Pessoas', o.pessoas ? String(o.pessoas) : ''], ['Local', esc(o.local_evento || '')]])),
        card('Itens', kv([
          // (27/10) o nome vai sem esc: o kv já protege o rótulo ("Bolo & Cia" saía "&amp;" e o Total saía com <b> escrito)
          ...(o.itens || []).map(i => [`${i.quantidade > 1 ? `${i.quantidade} × ` : ''}${i.nome}`, brl(i.quantidade * i.valor_unitario)] as [string, string]),
          ...(extras.desconto && o.desconto > 0 ? [['Desconto', `− ${brl(o.desconto)}`] as [string, string]] : []),
          ...(extras.acrescimo && o.acrescimo > 0 ? [['Acréscimo', brl(o.acrescimo)] as [string, string]] : []),
          ...(extras.entrega ? [['Entrega', textoEntrega(o.taxa_entrega)] as [string, string]] : []),
          ['Total', `<b>${brl(total)}</b>`],
        ])),
        card('Condições', `<p>${esc(textoCondicoes(o, total))}</p>`),
      ].join(''),
    }), janela)
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
  if (!isPro) return (<><AppPageHeader title="Orçamento" subtitle="Proposta para o cliente" voltar="/orcamentos" /><div className="orc"><TelaVazia caixa icone={<WarningCircle size={30} />} titulo="Orçamentos é um recurso do PRO" texto="Assine o PRO para montar e enviar orçamentos." acao={<Botao onClick={() => navigate('/orcamentos')}>Voltar</Botao>} /></div></>)

  const pediu = o.origem === 'link' ? (
    <section className="orc-card orc-pediu">
      <h3>O que ele pediu</h3>
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
          <Resumo o={ov!} total={total} sinal={sinal} nomeLoja={nomeLoja} logo={(profile as any)?.logo_url} />
          <div className="orc-acoes-fim"><Botao variante="secundario" icone={<FilePdf size={18} weight="bold" />} onClick={baixarPdf}>Baixar PDF</Botao></div>
        </div>
        {pediu && <aside className="orc-ed-lado">{pediu}</aside>}
      </div>
      {foto && <Janela aberta aoFechar={() => setFoto('')} tipo="conteudo" titulo="Foto de referência"><img className="orc-foto-g" src={foto} alt="Foto de referência" /></Janela>}
    </>)
  }

  // (28/10) cliente em cartão compacto quando já vem preenchido (pedido pelo link); "Editar" abre os campos
  const cliPronto = !!(o.cliente_nome || '').trim() && (o.cliente_telefone || '').replace(/\D/g, '').length >= 10
  const verCampos = editarCli ?? !cliPronto
  const botoesEtapa = etapa < 3 ? (<>
    {etapa === 1
      ? <Botao variante="secundario" carregando={salvando && etapa === 1} onClick={async () => { const ok = await salvar(); if (ok) avisar('Rascunho salvo', { tipo: 'ok' }) }}>Rascunho</Botao>
      : <Botao variante="secundario" onClick={() => setEtapa(e => (e > 1 ? ((e - 1) as 1 | 2 | 3) : e))}>Voltar</Botao>}
    <Botao carregando={salvando} onClick={() => void continuar()}>Continuar</Botao>
  </>) : null

  const prodsFiltrados = produtos.filter(p => !busca.trim() || p.nome.toLowerCase().includes(busca.trim().toLowerCase()))

  return (<>
    <AppPageHeader title={titulo} subtitle={o.numero ? `Orçamento #${o.numero}` : 'Monte a proposta e envie o link'} voltar="/orcamentos" infoComo={COMO_ORCAMENTO} infoTour={TOUR_ORCAMENTO}
      rightActions={<MenuMais rotulo="Mais ações do orçamento" itens={[{ Ic: Trash, t: "Excluir orçamento", sub: "Apaga de vez", perigo: true, aoTocar: () => { void excluir() } }]} />} />
    <div className="orc orc-ed">
      <div className="orc-ed-main">
        <ol className="orc-etapas" aria-label="Etapas">
          {(['Proposta', 'Condições', 'Enviar'] as const).map((t, k) => {
            const n = (k + 1) as 1 | 2 | 3
            return (
              <li key={t} className={etapa === n ? 'on' : etapa > n ? 'ok' : ''}>
                <button type="button" disabled={n > etapa && !!faltaEtapa1} onClick={() => { if (n < etapa || !faltaEtapa1) setEtapa(n) }}>
                  <i aria-hidden="true" /><span>{t}</span>
                </button>
              </li>
            )
          })}
        </ol>

        {etapa === 1 && (<>
          <div className="orc-so-cel">{pediu}</div>
          <section className="orc-card">
            <h3 className="orc-h-acao">Cliente{!verCampos && <button type="button" className="orc-link-bt" onClick={() => setEditarCli(true)}><PencilSimple size={14} weight="bold" />Editar</button>}</h3>
            {verCampos ? (
              <div className="orc-2">
                <Campo rotulo="Nome" value={o.cliente_nome || ''} placeholder="Nome do cliente" onChange={e => muda({ cliente_nome: e.target.value })} />
                <Campo rotulo="WhatsApp" value={o.cliente_telefone || ''} inputMode="tel" placeholder="(41) 9 9999-0000" onChange={e => muda({ cliente_telefone: e.target.value })} />
              </div>
            ) : (
              <div className="orc-cli">
                <span className="orc-av" aria-hidden="true">{(o.cliente_nome || '?').trim().charAt(0).toUpperCase()}</span>
                <span className="orc-cli-tx"><b>{o.cliente_nome}</b><small>{o.cliente_telefone}{o.origem === 'link' ? ' · pediu pelo link' : ''}</small></span>
                <a className="orc-cli-ic" href={linkWhatsApp(o.cliente_telefone || '') || '#'} target="_blank" rel="noreferrer" aria-label="Chamar no WhatsApp" title="WhatsApp"><IconeWhatsApp size={20} /></a>
                <a className="orc-cli-ic" href={`tel:+55${(o.cliente_telefone || '').replace(/\D/g, '')}`} aria-label="Ligar" title="Ligar"><Phone size={20} weight="bold" /></a>
              </div>
            )}
          </section>

          <section className="orc-card">
            <h3>Evento</h3>
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

          <section className="orc-card">
            <h3>Itens</h3>
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
            <div className="orc-ext">
              {(['desconto', 'acrescimo', 'entrega'] as const).map(k => (
                <button key={k} type="button" aria-pressed={extras[k]} onClick={() => { setExtras(x => ({ ...x, [k]: !x[k] })); setMudou(true) }}>
                  {extras[k] ? <X size={14} weight="bold" /> : <Plus size={14} weight="bold" />}{k === 'desconto' ? 'Desconto' : k === 'acrescimo' ? 'Acréscimo' : 'Entrega'}
                </button>
              ))}
            </div>
            {(extras.desconto || extras.acrescimo || extras.entrega) && (
              <div className="orc-2">
                {extras.desconto && <Campo rotulo="Desconto" prefixo="R$" inputMode="numeric" placeholder="0,00" value={mostrarReais(Number(o.desconto) || 0)} onChange={e => muda({ desconto: lerReais(e.target.value) })} />}
                {extras.acrescimo && <Campo rotulo="Acréscimo" prefixo="R$" inputMode="numeric" placeholder="0,00" value={mostrarReais(Number(o.acrescimo) || 0)} onChange={e => muda({ acrescimo: lerReais(e.target.value) })} />}
                {extras.entrega && <Campo rotulo="Taxa de entrega" prefixo="R$" inputMode="numeric" placeholder="0,00" value={mostrarReais(Number(o.taxa_entrega) || 0)} onChange={e => muda({ taxa_entrega: lerReais(e.target.value) })} />}
              </div>
            )}
            <div className="orc-tot"><span>Total</span><b>{brl(total)}</b></div>
            {(o.itens || []).length > 0 && somarItens(o.itens) > 0 && (lucro && 'valor' in lucro
              ? <p className={`orc-lucro${(lucro.valor ?? 0) < 0 ? ' ruim' : ''}`}>Lucro estimado {brl(lucro.valor ?? 0)} ({Math.round(lucro.pct ?? 0)}%) · pela ficha técnica</p>
              : lucro && 'falta' in lucro ? <p className="orc-lucro sem">Lucro não calculado: {lucro.falta}.</p> : null)}
          </section>
        </>)}

        {etapa === 2 && (<>
          <section className="orc-card">
            <h3>Vale até</h3>
            <div className="orc-seg" role="radiogroup" aria-label="Vale até">
              {([['7', '7 dias'], ['15', '15 dias'], ['30', '30 dias'], ['data', 'Data']] as const).map(([k, t]) => (
                <button key={k} type="button" role="radio" aria-checked={validadeTipo === k} onClick={() => { setValidadeTipo(k); if (k !== 'data') muda({ validade: maisDias(Number(k)) }) }}>{t}</button>
              ))}
            </div>
            {validadeTipo === 'data'
              ? <div className="orc-mt"><CampoData valor={o.validade || ''} onChange={d => muda({ validade: d })} titulo="Vale até" placeholder="Escolher a data" /></div>
              : <p className="orc-nota"><CalendarBlank size={16} weight="bold" aria-hidden="true" />Vale até {dataLonga(o.validade)}</p>}
          </section>

          <section className="orc-card">
            <h3>Sinal para reservar a data</h3>
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
            <h3>Como ele paga</h3>
            <div className="orc-seg" role="radiogroup" aria-label="Como ele paga">
              {(['pix', 'dinheiro', 'cartao', 'combinar'] as const).map(k => (
                <button key={k} type="button" role="radio" aria-checked={o.forma_pagamento === k} onClick={() => muda({ forma_pagamento: k })}>{k === 'combinar' ? 'Combinar' : FORMA_ORC[k]}</button>
              ))}
            </div>
            <p className="orc-nota">Nada é cobrado pelo link: é o combinado, e vira a forma de pagamento do pedido.</p>
          </section>

          <section className="orc-card">
            <h3>Recado para ele <small>opcional</small></h3>
            <CampoArea rotulo="" aria-label="Recado para o cliente" rows={3} value={o.mensagem || ''} placeholder="Ex.: Oi, Ana! Que alegria fazer parte do aniversário da Malu." onChange={e => muda({ mensagem: e.target.value })} />
            {!(o.mensagem || '').trim() && <button type="button" className="orc-link-bt" onClick={recadoPronto}><Plus size={14} weight="bold" />Usar um recado pronto</button>}
            <p className="orc-nota">Se ele não responder em 3 dias, o orçamento fica em destaque na lista para você pedir o retorno.</p>
          </section>
        </>)}

        {etapa === 3 && (<>
          <section className="orc-card">
            <h3>Assim o cliente vê</h3>
            <Resumo o={ov!} total={total} sinal={sinal} nomeLoja={nomeLoja} logo={(profile as any)?.logo_url} />
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

      </div>

      <aside className="orc-ed-lado">
        {pediu}
        {/* no computador, a prévia ao vivo fica do lado enquanto ela monta (na etapa Enviar ela já está no meio) */}
        {etapa < 3 && <section className="orc-card"><h3>Assim o cliente vê</h3><Resumo o={ov!} total={total} sinal={sinal} nomeLoja={nomeLoja} logo={(profile as any)?.logo_url} />
          {/* (28/10) no computador os botões ficam aqui, embaixo do total (como o Resumo da Nova venda) */}
          <div className="orc-lado-bts">{botoesEtapa}</div>
        </section>}
      </aside>
    </div>

    {etapa < 3 && (
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
              <button key={p.id} type="button" className="orc-esc-it" onClick={() => {
                muda({ itens: [...(o.itens || []), { id: novoId(), produto_id: p.id, nome: p.nome, quantidade: 1, valor_unitario: pc.final || 0, imagem_url: foto1(p.imagem_url) || null }] })
                setEscolher(false)
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
    {foto && <Janela aberta aoFechar={() => setFoto('')} tipo="conteudo" titulo="Foto de referência"><img className="orc-foto-g" src={foto} alt="Foto de referência" /></Janela>}
  </>)
}

/** O orçamento como a cliente vê (prévia na etapa Enviar e o resumo depois de respondido) */
export function Resumo({ o, total, sinal, nomeLoja, logo }: { o: Orcamento; total: number; sinal: number; nomeLoja: string; logo?: string | null }) {
  return (
    <div className="orc-prev">
      <div className="orc-prev-loja">
        {logo ? <img src={logo} alt="" /> : <span>{nomeLoja.charAt(0)}</span>}
        <span><b>{nomeLoja}</b><small>Orçamento{o.cliente_nome ? ` para ${o.cliente_nome.split(' ')[0]}` : ''}</small></span>
      </div>
      {o.mensagem && <p className="orc-prev-msg">{o.mensagem}</p>}
      {(o.data_evento || o.nome_evento) && <p className="orc-prev-ev">{[o.nome_evento, dataLonga(o.data_evento)].filter(Boolean).join(' · ')}</p>}
      <div className="orc-prev-itens">
        {(o.itens || []).map(i => (
          <div key={i.id}><span><b>{i.quantidade > 1 ? `${i.quantidade} × ` : ''}{i.nome}</b>{i.detalhe && <small>{i.detalhe}</small>}</span><em>{brl(i.quantidade * i.valor_unitario)}</em></div>
        ))}
        {o.tipo_entrega === 'entrega' && <div><span><b>Entrega</b></span><em>{textoEntrega(o.taxa_entrega)}</em></div>}
        {Number(o.acrescimo) > 0 && <div><span><b>Acréscimo</b></span><em>{brl(o.acrescimo)}</em></div>}
        {Number(o.desconto) > 0 && <div className="ok"><span><b>Desconto</b></span><em>− {brl(o.desconto)}</em></div>}
      </div>
      <div className="orc-prev-tot"><span>Total</span><b>{brl(total)}</b></div>
      <p className="orc-prev-cond">{textoCondicoes(o, total)}{sinal > 0 && o.sinal_tipo !== 'total' ? ` · resto ${brl(Math.max(0, total - sinal))} na entrega` : ''}</p>
    </div>
  )
}

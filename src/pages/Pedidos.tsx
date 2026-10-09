import { useCallback, useEffect, useMemo, useState } from 'react'
import { montarMensagem, dadosDoPedido } from '@/lib/mensagens'
import { useLocation, useNavigate } from 'react-router-dom'
import { Cake, CalendarDots, Funnel, Kanban, Lightning, ListBullets, MagnifyingGlass, Plus, Receipt, WarningCircle, X } from '@phosphor-icons/react'
import AppPageHeader from '@/components/AppPageHeader'
import { Botao, BotaoIcone, Janela, TelaVazia, Titulo, avisar, confirmar } from '@/components/base'
import FinalizarPedidoSheet from '@/components/pedidos/FinalizarPedidoSheet'
import FiltroLateral, { STATUS_PADRAO, bateData } from '@/components/pedidos/FiltroPedidos'
import { CartaoPedido, LinhaPedido } from '@/components/pedidos/CartaoPedido'
import MenuPedido from '@/components/pedidos/MenuPedido'
import type { AcaoMenu } from '@/components/pedidos/MenuPedido'
import QuadroPedidos from '@/components/pedidos/QuadroPedidos'
import type { Pedido } from '@/components/pedidos/pedidoTexto'
import { acaoDe, avisoDaMudanca, precisaAceitar, dataISO, grupoDoStatus, nomeCliente, nomeDaSituacao, nomeDeProduto, recebidoPedido, rs, saldoPedido, terminou } from '@/components/pedidos/pedidoTexto'
import { registrarPagamento } from '@/lib/pagamentos'
import { duplicarPedido } from '@/lib/duplicarPedido'
import { pedidoAtrasado } from '@/lib/pedidoStatus'
import { gerarPedidoPDF } from '@/lib/gerarPedidoPDF'
import { abrirJanela } from '@/lib/pdfDoonly'
import { supabase } from '@/lib/supabase'
import { registrarEtapa } from "@/lib/historicoPedido";
import { semAcento } from '@/lib/noticias'
import { tocarSom } from '@/hooks/useSom'
import '@/components/pedidos/pedidos.css'

/**
 * Meus Pedidos (08/10 · 3.11, no padrão do guia).
 *   Celular e tablet: cartões agrupados por dia (Atrasado, Hoje, Amanhã, os próximos dias, Concluídos).
 *   Computador (901px+): uma linha por pedido, nos mesmos grupos. Do tablet em pé pra cima ainda tem o Quadro (uma coluna por situação).
 *   Palavras do dicionário (Novo pedido, Pronto, Saiu pra entrega), botões de 44px, janelas e telas vazias padrão.
 * As regras de pagamento e de mudança de situação são as mesmas de antes (Financeiro · Passos 0 a 3).
 * (3.14) Pedidos pra aceitar ficam no topo, em destaque. Toda mudança de situação mostra um aviso curto; entregue também toca um som.
 */
const MEDIDA_COMPUTADOR = '(min-width: 901px)'
const MEDIDA_TABLET = '(min-width: 768px)'

export default function Pedidos() {
  const navigate = useNavigate()
  const location = useLocation()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'erro' | 'pronto'>('carregando')
  const [demorou, setDemorou] = useState(false)
  const [totalProdutos, setTotalProdutos] = useState<number | null>(null)
  const [computador, setComputador] = useState(() => window.matchMedia(MEDIDA_COMPUTADOR).matches)
  const [largo, setLargo] = useState(() => window.matchMedia(MEDIDA_TABLET).matches) // tablet em pé pra cima: tem o Quadro

  // Filtros rápidos que vêm do Início: ?filtro=aguardando (pedidos do cardápio pra aceitar) e ?filtro=atrasados
  const params = new URLSearchParams(location.search)
  const [filtroAguardando, setFiltroAguardando] = useState(params.get('filtro') === 'aguardando')
  const [filtroAtrasados, setFiltroAtrasados] = useState(params.get('filtro') === 'atrasados')

  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<'encomenda' | 'pronta_entrega'>('encomenda')
  const [modo, setModo] = useState<'lista' | 'quadro'>('lista')
  const [showFiltro, setShowFiltro] = useState(false)
  const [statusSelecionados, setStatusSelecionados] = useState<string[]>(STATUS_PADRAO)
  const [periodoFiltro, setPeriodoFiltro] = useState('todos')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [menuDe, setMenuDe] = useState<Pedido | null>(null)
  const [semProdutos, setSemProdutos] = useState(false)
  const [mudando, setMudando] = useState<string | null>(null)
  // "cliente pagou?" quando sai de Aguardando pagamento ou vai pra Entregue com saldo (Financeiro · Passo 3)
  const [pendingPag, setPendingPag] = useState<{ pedido: Pedido; novoStatus: string } | null>(null)

  useEffect(() => {
    const m = window.matchMedia(MEDIDA_COMPUTADOR), t = window.matchMedia(MEDIDA_TABLET)
    const muda = () => { setComputador(m.matches); setLargo(t.matches) }
    m.addEventListener('change', muda); t.addEventListener('change', muda)
    return () => { m.removeEventListener('change', muda); t.removeEventListener('change', muda) }
  }, [])

  const fetchPedidos = useCallback(async (uid: string) => {
    setEstado('carregando')
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, clientes(foto_url), pedido_itens(nome_produto, quantidade, valor_unitario, observacoes, personalizacoes, preco_breakdown, snapshot_version, imagem_url, produtos(imagem_url, forma_venda))')
      .eq('user_id', uid)
      .order('numero', { ascending: false })
    if (error) { setEstado('erro'); return }
    setPedidos((data || []) as Pedido[])
    setEstado('pronto')
  }, [])

  useEffect(() => {
    // Link antigo /pedidos?ver=ID (atalhos de outras telas): abre direto a tela do pedido
    const ver = new URLSearchParams(window.location.search).get('ver')
    if (ver) { navigate(`/pedidos/${ver}/editar`, { replace: true }); return }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      fetchPedidos(user.id)
      supabase.from('produtos').select('id', { count: 'exact', head: true }).eq('user_id', user.id).then(({ count }) => setTotalProdutos(count ?? 0))
    })
  }, [fetchPedidos, navigate])

  // o "carregando" só aparece se passar de 300ms
  useEffect(() => {
    if (estado !== 'carregando') { setDemorou(false); return }
    const t = window.setTimeout(() => setDemorou(true), 300)
    return () => window.clearTimeout(t)
  }, [estado])

  const handleNovoPedido = () => {
    if (totalProdutos === 0) { setSemProdutos(true); return }
    navigate('/vendas/novo')
  }

  /** Navega a partir de uma janela aberta: a tela nova entra no lugar da entrada que a janela guardou pro "voltar" */
  const irDaJanela = (para: string) => navigate(para, { replace: !!(window.history.state as { uiJanela?: boolean } | null)?.uiJanela })

  /** Confirmação de que deu certo (3.14): aviso curto sempre; som quando o pedido termina (respeita o som ligado/desligado em Notificações) */
  const confirmarMudanca = (p: Pedido, status: string, pago = false) => {
    registrarEtapa(p.id, status)
    avisar(avisoDaMudanca(p, status, pago))
    if (status === 'entregue') tocarSom('sucesso')
  }

  const updateStatus = async (id: string, status: string, pagoDireto = false) => {
    const pedido = pedidos.find(p => p.id === id)
    if (!pedido) return
    const statusAtual = grupoDoStatus(pedido.status)
    const falhou = () => avisar('Não deu pra mudar a situação. Confira a internet e tente de novo.', { tipo: 'erro' })

    // Regra 1 (Financeiro · Passo 0): entrar em Aguardando pagamento só muda a situação (um sinal já pago não some)
    if (status === 'aguardando_pagamento' && statusAtual !== 'aguardando_pagamento') {
      const { error } = await supabase.from('pedidos').update({ status }).eq('id', id)
      if (error) { falhou(); return }
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, status } : p))
      confirmarMudanca(pedido, status)
      return
    }

    // Botão "Recebi": entrou o que faltava (Passo 1: vira um pagamento registrado)
    if (statusAtual === 'aguardando_pagamento' && pagoDireto) {
      const { error } = await supabase.from('pedidos').update({ status }).eq('id', id)
      if (error) { falhou(); return }
      const falta = saldoPedido(pedido)
      const r = falta > 0
        ? await registrarPagamento({ pedidoId: id, valor: falta, forma: pedido.forma_pagamento, tipo: recebidoPedido(pedido) > 0 ? 'restante' : 'total' })
        : null
      const novo = r?.status_pagamento ? { valor_recebido: r.valor_recebido, status_pagamento: r.status_pagamento } : { valor_recebido: pedido.valor_total, status_pagamento: 'pago' }
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, status, ...novo } : p))
      confirmarMudanca(pedido, status, true)
      return
    }

    // Regra 2: saindo de Aguardando pagamento (menos pra cancelado) → pergunta "cliente pagou?"
    if (statusAtual === 'aguardando_pagamento' && status !== 'aguardando_pagamento' && status !== 'cancelado') {
      setPendingPag({ pedido, novoStatus: status })
      return
    }

    // Regra 3 (Passo 0): marcar como Entregue com saldo a receber → pergunta também, pro restante não ser esquecido
    if (status === 'entregue' && statusAtual !== 'entregue' && saldoPedido(pedido) > 0.009) {
      setPendingPag({ pedido, novoStatus: status })
      return
    }

    // Padrão: só muda a situação
    const { error } = await supabase.from('pedidos').update({ status }).eq('id', id)
    if (error) { falhou(); return }
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    confirmarMudanca(pedido, status)
  }

  const avancar = async (p: Pedido) => {
    const a = acaoDe(p)
    if (!a || mudando) return
    setMudando(p.id)
    try { await updateStatus(p.id, a.proximo, !!a.pago) } finally { setMudando(null) }
  }

  const excluirPedido = async (p: Pedido) => {
    await supabase.from('pedido_itens').delete().eq('pedido_id', p.id)
    const { error } = await supabase.from('pedidos').delete().eq('id', p.id)
    if (error) { avisar('Não deu pra excluir o pedido. Confira a internet e tente de novo.', { tipo: 'erro' }); return false }
    setPedidos(prev => prev.filter(x => x.id !== p.id))
    avisar('Pedido excluído.')
    return true
  }

  // ── "Mais ações" do pedido: faz a ação e depois fecha a janela ──
  const handleMenuAcao = async (p: Pedido, acao: AcaoMenu) => {
    const fechar = () => setMenuDe(null)
    if (acao === 'editar') { irDaJanela(`/pedidos/${p.id}/editar`); fechar(); return }
    if (acao === 'duplicar') {
      const r = await duplicarPedido(p.id)
      if ('erro' in r) { avisar(r.erro, { tipo: 'erro' }); return }
      irDaJanela(`/pedidos/${r.id}/editar`); fechar()
      return
    }
    if (acao === 'contatar') {
      const tel = (p.cliente_telefone || '').replace(/\D/g, '')
      if (!tel) return
      const num = tel.startsWith('55') ? tel : `55${tel}`
      const nome = p.cliente_nome ? nomeCliente(p).split(' ')[0] : ''
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(montarMensagem('sobre_pedido', dadosDoPedido(p, nome)))}`, '_blank')
      fechar(); return
    }
    if (acao === 'compartilhar') {
      const itens = p.pedido_itens || []
      const linhasItens = itens.map(it => `• ${String(it.quantidade).replace('.', ',')}x ${nomeDeProduto(it.nome_produto)}`).join('\n')
      const [y, m, d] = (p.data_entrega || '').split('-')
      const dataEnt = p.data_entrega ? `${d}/${m}/${y}` : '—'
      const hora = p.horario_entrega ? ` às ${p.horario_entrega.slice(0, 5)}` : ''
      const resumo = [
        `*Pedido #${p.numero || ''}*`,
        p.cliente_nome ? `Cliente: ${nomeCliente(p)}` : '',
        `${p.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada'}: ${dataEnt}${hora}`,
        '',
        linhasItens ? `*Itens:*\n${linhasItens}` : '',
        '',
        `*Total: ${rs(p.valor_total)}*`,
      ].filter(Boolean).join('\n')
      window.open(`https://wa.me/?text=${encodeURIComponent(resumo)}`, '_blank')
      fechar(); return
    }
    if (acao === 'pdf') {
      const janela = abrirJanela()
      // busca o pedido completo (com as escolhas de cada item) pro comprovante sair inteiro
      const { data } = await supabase.from('pedidos').select('*, pedido_itens(*)').eq('id', p.id).maybeSingle()
      await gerarPedidoPDF((data || p) as any, janela)
      fechar(); return
    }
    if (acao === 'excluir') {
      const ok = await confirmar({ titulo: `Excluir o pedido #${p.numero || ''}?`, texto: 'Ele some da lista, da agenda e do financeiro.', rotulo: 'Excluir', perigo: true })
      if (!ok) return
      if (await excluirPedido(p)) fechar()
    }
  }

  const abrirPedido = (p: Pedido) => navigate(`/pedidos/${p.id}/editar`)
  const verEndereco = (p: Pedido) => navigate(`/pedidos/${p.id}/editar?aba=entrega`)

  const pedidosFiltrados = useMemo(() => {
    const q = semAcento(busca)
    return pedidos.filter(p => {
      if (filtroAguardando) return p.origem === 'cardapio' && p.status === 'novo'
      if (filtroAtrasados) return pedidoAtrasado(p as any)
      if ((p.tipo_venda || 'encomenda') !== aba) return false
      const okStatus = statusSelecionados.includes(grupoDoStatus(p.status))
      const okBusca = !q || semAcento(p.cliente_nome || '').includes(q) || String(p.numero).includes(q)
      const okData = bateData(p, periodoFiltro === 'custom' ? 'personalizado' : periodoFiltro, dataInicio, dataFim)
      return okStatus && okBusca && okData
    })
  }, [pedidos, busca, aba, statusSelecionados, periodoFiltro, dataInicio, dataFim, filtroAguardando, filtroAtrasados])

  // Agrupado por dia: Atrasado, Hoje, Amanhã, os próximos dias, Sem data e Concluídos
  const grupos = useMemo(() => {
    const hojeD = new Date(); hojeD.setHours(0, 0, 0, 0)
    const hojeIso = dataISO(hojeD), amanhaD = new Date(hojeD); amanhaD.setDate(amanhaD.getDate() + 1); const amanhaIso = dataISO(amanhaD)
    const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
    const rot = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${DIAS[new Date(y, m - 1, d).getDay()]}, ${d}/${m}` }
    const porHora = (a: Pedido, b: Pedido) => String(a.data_entrega || '').localeCompare(String(b.data_entrega || '')) || String(a.horario_entrega || '').localeCompare(String(b.horario_entrega || ''))
    const g: { chave: string; titulo: string; itens: Pedido[] }[] = []
    const add = (chave: string, titulo: string, itens: Pedido[]) => { if (itens.length) g.push({ chave, titulo, itens }) }
    // pedidos pra aceitar vêm primeiro, em destaque (3.14); os outros seguem agrupados por dia
    add('aceitar', 'Pra aceitar', pedidosFiltrados.filter(p => !terminou(p) && precisaAceitar(p)).sort(porHora))
    const ativos = pedidosFiltrados.filter(p => !terminou(p) && !precisaAceitar(p)).sort(porHora)
    add('atrasado', 'Atrasado', ativos.filter(p => p.data_entrega && p.data_entrega < hojeIso))
    add('hoje', `Hoje · ${rot(hojeIso)}`, ativos.filter(p => p.data_entrega === hojeIso))
    add('amanha', `Amanhã · ${rot(amanhaIso)}`, ativos.filter(p => p.data_entrega === amanhaIso))
    const futuros = ativos.filter(p => p.data_entrega && p.data_entrega > amanhaIso)
    ;[...new Set(futuros.map(p => p.data_entrega))].forEach(d => { const t = rot(d); add('d' + d, t.charAt(0).toUpperCase() + t.slice(1), futuros.filter(p => p.data_entrega === d)) })
    add('semdata', 'Sem data', ativos.filter(p => !p.data_entrega))
    add('concluidos', 'Concluídos', pedidosFiltrados.filter(terminou).sort((a, b) => -porHora(a, b)))
    return g
  }, [pedidosFiltrados])

  const nFiltros = (statusSelecionados.length !== STATUS_PADRAO.length || !STATUS_PADRAO.every(s => statusSelecionados.includes(s)) ? 1 : 0) + (periodoFiltro !== 'todos' ? 1 : 0)
  const filtrando = nFiltros > 0 || !!busca.trim()
  const limparTudo = () => { setBusca(''); setStatusSelecionados(STATUS_PADRAO); setPeriodoFiltro('todos'); setDataInicio(''); setDataFim('') }
  const nEncomendas = pedidos.filter(p => (p.tipo_venda || 'encomenda') === 'encomenda').length
  const nPronta = pedidos.filter(p => p.tipo_venda === 'pronta_entrega').length
  const sairDoFiltroRapido = () => { setFiltroAguardando(false); setFiltroAtrasados(false); navigate('/pedidos', { replace: true }) }
  const quadro = largo && modo === 'quadro'

  const props = (p: Pedido) => ({ p, aoAbrir: abrirPedido, aoAvancar: avancar, aoMenu: setMenuDe, aoEndereco: verEndereco, mudando: mudando === p.id })

  const conteudo = () => {
    if (estado === 'carregando') return demorou ? <p className="pd-carregando" role="status"><span className="ui-gira" aria-hidden="true" />Carregando os pedidos…</p> : null
    if (estado === 'erro') return <TelaVazia icone={<WarningCircle size={30} />} titulo="Não deu pra carregar os pedidos" texto="Confira a internet e tente de novo." acao={<Botao variante="suave" tamanho="m" onClick={() => userId && fetchPedidos(userId)}>Tentar de novo</Botao>} />
    if (totalProdutos === 0 && pedidos.length === 0) return <TelaVazia icone={<Cake size={30} />} titulo="Cadastre um produto primeiro" texto="Pra registrar um pedido, você precisa ter pelo menos um produto." acao={<Botao icone={<Plus size={20} weight="bold" />} onClick={() => navigate('/produtos', { state: { abrirCadastro: true } })}>Cadastrar produto</Botao>} />
    if (pedidos.length === 0) return (
      <TelaVazia icone={<Receipt size={30} />} titulo="Nenhum pedido ainda" texto="Quando chegar uma encomenda, ela aparece aqui."
        acao={<div className="pd-vazio-acoes"><Botao icone={<Plus size={20} weight="bold" />} onClick={handleNovoPedido}>Registrar pedido</Botao><Botao variante="link" onClick={() => navigate('/cardapio')}>Divulgar o cardápio</Botao></div>} />
    )
    return null
  }
  const parada = conteudo()

  return (
    <>
      <AppPageHeader
        title="Meus Pedidos"
        subtitle="Acompanhe suas encomendas e produção"
        infoIcon="📋"
        infoContent={
          <>
            <p>Aqui ficam <strong>todas as suas encomendas</strong>, agrupadas por dia: o que está atrasado, o que entrega hoje, amanhã e nos próximos dias.</p>
            <p>O botão de cada pedido leva pro próximo passo: aceitar, produzir, marcar como pronto, entregar.</p>
          </>
        }
        infoTip={<>Toque num pedido pra abrir, ver tudo e marcar o pagamento.</>}
      />

      <div className="pd">
        {parada ?? (
          <>
            <div className="pd-barra">
              <div className="pd-abas" role="tablist" aria-label="Tipo de venda">
                <button type="button" role="tab" aria-selected={aba === 'encomenda'} className="pd-aba" onClick={() => setAba('encomenda')}>
                  <CalendarDots size={20} weight={aba === 'encomenda' ? 'fill' : 'bold'} aria-hidden="true" /><span>Encomendas</span><i>{nEncomendas}</i>
                </button>
                <button type="button" role="tab" aria-selected={aba === 'pronta_entrega'} className="pd-aba" onClick={() => setAba('pronta_entrega')}>
                  <Lightning size={20} weight={aba === 'pronta_entrega' ? 'fill' : 'bold'} aria-hidden="true" /><span>Pronta entrega</span><i>{nPronta}</i>
                </button>
              </div>
              <div className="pd-busca-l">
                <div className="ui-campo-c pd-busca" onClick={e => { if (e.target === e.currentTarget) e.currentTarget.querySelector('input')?.focus() }}>
                  <span className="ui-campo-ic" aria-hidden="true"><MagnifyingGlass size={20} weight="bold" /></span>
                  <input type="search" inputMode="search" enterKeyHint="search" autoComplete="off" aria-label="Buscar pedido por cliente ou número" placeholder="Buscar pedido" value={busca} onChange={e => setBusca(e.target.value)} />
                  {busca && <BotaoIcone className="pd-busca-x" variante="limpo" tamanho="p" rotulo="Limpar a busca" onClick={() => setBusca('')}><X size={20} weight="bold" /></BotaoIcone>}
                </div>
                <span className="pd-filtro">
                  <BotaoIcone rotulo={nFiltros ? `Filtros (${nFiltros} ligados)` : 'Filtros'} className={nFiltros ? 'ligado' : ''} onClick={() => setShowFiltro(true)}><Funnel size={20} weight={nFiltros ? 'fill' : 'bold'} /></BotaoIcone>
                  {nFiltros > 0 && <i aria-hidden="true">{nFiltros}</i>}
                </span>
                {largo && (
                  <div className="pd-modo" role="group" aria-label="Jeito de ver os pedidos">
                    <button type="button" aria-pressed={modo === 'lista'} onClick={() => setModo('lista')}><ListBullets size={20} weight="bold" aria-hidden="true" /><span>Lista</span></button>
                    <button type="button" aria-pressed={modo === 'quadro'} onClick={() => setModo('quadro')}><Kanban size={20} weight="bold" aria-hidden="true" /><span>Quadro</span></button>
                  </div>
                )}
                <Botao className="pd-novo" icone={<Plus size={20} weight="bold" />} onClick={handleNovoPedido}><span className="pd-novo-c">Novo</span><span className="pd-novo-g">Registrar pedido</span></Botao>
              </div>
            </div>

            {(filtroAguardando || filtroAtrasados) && (
              <div className={`pd-rapido${filtroAtrasados ? ' atr' : ''}`}>
                <div>
                  <b>{filtroAtrasados ? 'Pedidos atrasados' : 'Novos pedidos do cardápio'}</b>
                  <p>{filtroAtrasados ? 'A data de entrega passou e eles ainda não ficaram prontos.' : 'Só os pedidos do cardápio que você ainda precisa aceitar.'}</p>
                </div>
                <Botao variante="secundario" tamanho="p" onClick={sairDoFiltroRapido}>Ver todos</Botao>
              </div>
            )}

            {pedidosFiltrados.length === 0 ? (
              filtrando
                ? <TelaVazia icone={<MagnifyingGlass size={30} />} titulo="Nenhum pedido encontrado" texto={busca.trim() ? `Não achamos nada com “${busca.trim()}”.` : 'Nenhum pedido com esses filtros.'} acao={<Botao variante="suave" tamanho="m" onClick={limparTudo}>Ver todos os pedidos</Botao>} />
                : <TelaVazia icone={aba === 'pronta_entrega' ? <Lightning size={30} /> : <Receipt size={30} />} titulo={aba === 'pronta_entrega' ? 'Nenhuma venda de pronta entrega' : 'Nenhum pedido aqui'} texto={aba === 'pronta_entrega' ? 'As vendas do balcão aparecem aqui.' : 'Quando chegar uma encomenda, ela aparece aqui.'} />
            ) : quadro ? (
              <QuadroPedidos pedidos={pedidosFiltrados} aoAbrir={abrirPedido} aoAvancar={avancar} aoMover={(id, st) => updateStatus(id, st)} mudando={mudando} />
            ) : (
              <div className="pd-grupos">
                {computador && <div className="pdl-cab" aria-hidden="true"><span>Cliente e pedido</span><span>Situação</span><span>Pagamento</span><span>Entrega</span><span /><span /></div>}
                {grupos.map(g => (
                  <section key={g.chave} className="pd-grupo" aria-label={g.titulo}>
                    <Titulo contagem={g.itens.length} tom={g.chave === 'atrasado' ? 'vermelho' : undefined} apoio={g.chave === 'aceitar' ? 'Chegaram pelo cardápio. Aceite pra entrar na sua agenda.' : undefined}>{g.titulo}</Titulo>
                    {computador
                      ? <div className="pdl-tabela" role="table">{g.itens.map(p => <LinhaPedido key={p.id} {...props(p)} comDia={g.chave === 'concluidos' || g.chave === 'semdata'} />)}</div>
                      : <div className="pdc-lista">{g.itens.map(p => <CartaoPedido key={p.id} {...props(p)} />)}</div>}
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showFiltro && (
        <FiltroLateral
          statusSelecionados={statusSelecionados} setStatusSelecionados={setStatusSelecionados}
          periodoFiltro={periodoFiltro} setPeriodoFiltro={setPeriodoFiltro}
          dataInicio={dataInicio} setDataInicio={setDataInicio}
          dataFim={dataFim} setDataFim={setDataFim}
          onClose={() => setShowFiltro(false)}
          pedidos={pedidos}
        />
      )}

      <MenuPedido p={menuDe} aoFechar={() => setMenuDe(null)} aoEscolher={handleMenuAcao} />

      <Janela
        aberta={semProdutos} aoFechar={() => setSemProdutos(false)}
        titulo="Cadastre um produto primeiro" texto="Pra registrar um pedido, você precisa ter pelo menos um produto."
        icone={<Cake size={32} />}
        acoes={<>
          <Botao variante="secundario" onClick={() => setSemProdutos(false)}>Voltar</Botao>
          <Botao onClick={() => { irDaJanela('/produtos'); setSemProdutos(false) }} data-foco-inicial>Cadastrar produto</Botao>
        </>}
      />

      {pendingPag && (
        <FinalizarPedidoSheet
          pedido={pendingPag.pedido as any}
          novoStatus={pendingPag.novoStatus}
          novoStatusLabel={nomeDaSituacao(pendingPag.novoStatus)}
          aguardandoPagamento={grupoDoStatus(pendingPag.pedido.status) === 'aguardando_pagamento'}
          onCancelar={() => setPendingPag(null)}
          onConcluido={(r) => { setPedidos(prev => prev.map(p => p.id === pendingPag.pedido.id ? { ...p, ...r } : p)); confirmarMudanca(pendingPag.pedido, pendingPag.novoStatus); setPendingPag(null) }}
        />
      )}
    </>
  )
}

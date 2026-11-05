import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { COMO_PEDIDOS, TOUR_PEDIDOS } from "@/lib/comoTelas";
import { compartilharTexto } from "@/lib/compartilharCardapio";
import { montarMensagem, dadosDoPedido } from '@/lib/mensagens'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { Cake, CalendarDots, CaretDown, Funnel, Kanban, Lightning, ListBullets, MagnifyingGlass, Plus, Receipt, WarningCircle, X } from '@phosphor-icons/react'
import AppPageHeader from '@/components/AppPageHeader'
import { Botao, BotaoIcone, Janela, TelaVazia, Titulo, avisar, confirmar } from '@/components/base'
import FinalizarPedidoSheet from '@/components/pedidos/FinalizarPedidoSheet'
import FiltroLateral, { STATUS_PADRAO, bateData } from '@/components/pedidos/FiltroPedidos'
import { LinhaCompacta, LinhaPedido } from '@/components/pedidos/CartaoPedido'
import type { AcaoMenu } from '@/components/pedidos/MenuPedido'
import QuadroPedidos from '@/components/pedidos/QuadroPedidos'
import type { Pedido } from '@/components/pedidos/pedidoTexto'
import { pixDoPedido, acaoDe, formaDoItem, itemComQtd, precisaAceitar, dataISO, grupoDoStatus, nomeCliente, nomeDaSituacao, nomeDoItem, recebidoPedido, rs, saldoPedido, terminou } from '@/components/pedidos/pedidoTexto'
import { registrarPagamento } from '@/lib/pagamentos'
import { duplicarPedido } from '@/lib/duplicarPedido'
import { excluirPedido as excluirPedidoNoBanco } from '@/lib/pedidosDoo'
import { buscarTudo } from '@/lib/buscarTudo'
import { linkWhatsApp } from '@/lib/telefone'
import { pedidoAtrasado } from '@/lib/pedidoStatus'
import { gerarPedidoPDF, type PedidoPDF } from '@/lib/gerarPedidoPDF'
import { abrirJanela } from '@/lib/pdfDoonly'
import { supabase } from '@/lib/supabase'
import { registrarEtapa } from "@/lib/historicoPedido";
import { avisarDesfeito, avisarMudanca } from '@/lib/avisoPedido'
import { semAcento } from '@/lib/noticias'
import { tocarSom } from '@/hooks/useSom'
import { useAoVoltar, useDiaAtual } from '@/hooks/useAoVoltar'
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
type Sit = 'aceitar' | 'agenda' | 'prontos' | 'concluidos'
const SITS: { k: Sit; nome: string; curto?: string }[] = [
  { k: 'aceitar', nome: 'Para aceitar', curto: 'Novos' }, { k: 'agenda', nome: 'Agendados' }, { k: 'prontos', nome: 'Prontos' }, { k: 'concluidos', nome: 'Concluídos' },
]
/** Em que aba do celular o pedido fica: em produção fica em Agendados; esperando o Pix fica em Novos (6.04) */
/** (6.04) pedido do cardápio esperando o Pix: é pedido novo (o Início e o número no menu contam junto com os pra aceitar) */
const esperaPix = (p: Pedido) => grupoDoStatus(p.status) === 'aguardando_pagamento'
const sitDe = (p: Pedido): Sit => terminou(p) ? 'concluidos' : precisaAceitar(p) || esperaPix(p) ? 'aceitar'
  : ['finalizado', 'aguardando_retirada', 'em_entrega'].includes(grupoDoStatus(p.status)) ? 'prontos' : 'agenda'
const MEDIDA_TABLET = '(min-width: 768px)'

/**
 * Como a lista estava (11/10): busca, filtros, aba, lista ou quadro e a posição da rolagem.
 * Fica guardado enquanto o app está aberto (sessionStorage), com o id da conta na chave: outra conta não herda nada.
 * Volta sozinho quando ela saiu da lista há pouco (a seta da tela do pedido traz pra cá) ou quando retorna pelo "voltar".
 * Passado esse tempo, a lista abre do jeito normal (ninguém encontra uma busca de ontem).
 */
const CHAVE_TELA = 'doonly_pedidos_tela_'
const VALE_POR = 30 * 60 * 1000               // saiu da lista há menos de meia hora
const VALE_POR_AO_VOLTAR = 6 * 60 * 60 * 1000 // pelo "voltar" do aparelho ou do navegador
type TelaGuardada = { em: number; busca: string; aba: 'encomenda' | 'pronta_entrega'; modo: 'lista' | 'quadro'; status: string[]; periodo: string; ini: string; fim: string; y: number; sit?: string | null }
function lerTela(uid: string): TelaGuardada | null {
  try {
    // tira o que ficou de outra conta neste aparelho
    for (let i = sessionStorage.length - 1; i >= 0; i--) { const k = sessionStorage.key(i); if (k && k.startsWith(CHAVE_TELA) && k !== CHAVE_TELA + uid) sessionStorage.removeItem(k) }
    const t = JSON.parse(sessionStorage.getItem(CHAVE_TELA + uid) || 'null')
    return t && typeof t === 'object' && Array.isArray(t.status) ? t as TelaGuardada : null
  } catch { return null }
}
function guardarTela(uid: string, t: TelaGuardada) {
  try { sessionStorage.setItem(CHAVE_TELA + uid, JSON.stringify(t)) } catch { /* sem espaço ou sem permissão: segue sem guardar */ }
}

export default function Pedidos() {
  const navigate = useNavigate()
  const location = useLocation()
  const tipoNavegacao = useNavigationType()
  const hoje = useDiaAtual() // (11/10) muda sozinho quando vira o dia: "Hoje", "Amanhã" e "Atrasado" não ficam os de ontem
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'erro' | 'pronto'>('carregando')
  const [demorou, setDemorou] = useState(false)
  const [totalProdutos, setTotalProdutos] = useState<number | null>(null)
  const [computador, setComputador] = useState(() => window.matchMedia(MEDIDA_COMPUTADOR).matches)
  const [largo, setLargo] = useState(() => window.matchMedia(MEDIDA_TABLET).matches) // tablet em pé pra cima: tem o Quadro

  // Filtros rápidos que vêm do Início: ?filtro=aguardando (pedidos pra aceitar ou esperando pagamento) e ?filtro=atrasados
  const params = new URLSearchParams(location.search)
  const [filtroAguardando, setFiltroAguardando] = useState(params.get('filtro') === 'aguardando')
  const [filtroAtrasados, setFiltroAtrasados] = useState(params.get('filtro') === 'atrasados')

  // (22/10) celular: abas por situação (Pra aceitar, Agendados, Prontos, Concluídos). null = escolhe sozinho
  const [sit, setSit] = useState<Sit | null>(params.get('filtro') === 'aguardando' ? 'aceitar' : null)
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<'encomenda' | 'pronta_entrega'>('encomenda')
  const [modo, setModo] = useState<'lista' | 'quadro'>('lista')
  const [showFiltro, setShowFiltro] = useState(false)
  const [statusSelecionados, setStatusSelecionados] = useState<string[]>(STATUS_PADRAO)
  const [periodoFiltro, setPeriodoFiltro] = useState('todos')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [semProdutos, setSemProdutos] = useState(false)
  // (11/10) Trava POR PEDIDO: antes era uma só pra lista inteira, e tocar "Aceitar" em três pedidos seguidos
  // só mudava o primeiro, sem aviso. Agora cada pedido tem a sua (e o "carregando" aparece no botão de cada um).
  const [mudando, setMudando] = useState<ReadonlySet<string>>(() => new Set())
  const mudandoRef = useRef(new Set<string>())
  // (11/10) sobe a cada mudança feita aqui na tela: a recarga por trás que começou antes não sobrescreve a lista
  const versao = useRef(0)
  const mudarPedidos = (f: (prev: Pedido[]) => Pedido[]) => { versao.current++; setPedidos(f) }
  // "cliente pagou?" quando sai de Aguardando pagamento ou vai pra Entregue com saldo (Financeiro · Passo 3)
  const [pendingPag, setPendingPag] = useState<{ pedido: Pedido; novoStatus: string } | null>(null)

  useEffect(() => {
    const m = window.matchMedia(MEDIDA_COMPUTADOR), t = window.matchMedia(MEDIDA_TABLET)
    const muda = () => { setComputador(m.matches); setLargo(t.matches) }
    m.addEventListener('change', muda); t.addEventListener('change', muda)
    return () => { m.removeEventListener('change', muda); t.removeEventListener('change', muda) }
  }, [])

  // "quieto" (11/10): recarrega por trás, sem trocar a lista pelo "carregando" nem pela tela de erro (usado ao voltar pro app)
  const fetchPedidos = useCallback(async (uid: string, quieto = false) => {
    if (!quieto) setEstado('carregando')
    const v = versao.current
    // (10/10) de 1.000 em 1.000: a lista não corta mais quando a conta passa de mil pedidos (o "id" deixa a ordem fixa)
    const { data, error } = await buscarTudo<Pedido>((de, ate) => supabase
      .from('pedidos')
      .select('*, clientes(foto_url), pedido_itens(nome_produto, quantidade, valor_unitario, observacoes, personalizacoes, preco_breakdown, snapshot_version, imagem_url, produtos(imagem_url, forma_venda))')
      .eq('user_id', uid)
      .order('numero', { ascending: false })
      .order('id')
      .range(de, ate))
    if (error) { if (!quieto) setEstado('erro'); return }
    // uma mudança de situação começou enquanto a lista vinha: essa resposta pode estar velha, fica pra próxima
    if (quieto && mudandoRef.current.size > 0) return
    // (11/10) algo mudou aqui na tela enquanto a lista vinha: a resposta pode estar velha
    if (quieto && v !== versao.current) return
    setPedidos((data || []) as Pedido[])
    setEstado('pronto')
  }, [])

  const rolagemGuardada = useRef(0)             // onde a lista estava (pra guardar ao sair)
  const rolagemPraVoltar = useRef<number | null>(null) // posição a restaurar quando a lista carregar
  useEffect(() => {
    // Link antigo /pedidos?ver=ID (atalhos de outras telas): abre direto a tela do pedido
    const ver = new URLSearchParams(window.location.search).get('ver')
    if (ver) { navigate(`/pedidos/${ver}/editar`, { replace: true }); return }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      // (11/10) a lista volta como estava: busca, filtros, aba, lista/quadro e rolagem
      // (menos quando veio do Início com um filtro rápido na frente)
      const t = lerTela(user.id)
      const comFiltroRapido = !!new URLSearchParams(window.location.search).get('filtro')
      const faz = t ? Date.now() - (Number(t.em) || 0) : Infinity
      if (t && !comFiltroRapido && (faz < VALE_POR || (tipoNavegacao === 'POP' && faz < VALE_POR_AO_VOLTAR))) {
        setBusca(String(t.busca || '')); setAba(t.aba === 'pronta_entrega' ? 'pronta_entrega' : 'encomenda'); setModo(t.modo === 'quadro' ? 'quadro' : 'lista')
        setStatusSelecionados(t.status.filter(s => typeof s === 'string')); setPeriodoFiltro(String(t.periodo || 'todos')); setDataInicio(String(t.ini || '')); setDataFim(String(t.fim || ''))
        // (6.09) a aba do celular também volta (antes abria sempre na primeira com pedido)
        if (SITS.some(x => x.k === t.sit)) setSit(t.sit as Sit)
        rolagemPraVoltar.current = Number(t.y) > 0 ? Number(t.y) : null
      }
      setUserId(user.id)
      fetchPedidos(user.id)
      supabase.from('produtos').select('id', { count: 'exact', head: true }).eq('user_id', user.id).then(({ count }) => setTotalProdutos(count ?? 0))
    })
  }, [fetchPedidos, navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  // Guarda como a lista está: a cada mudança e ao sair da tela (com a rolagem do momento)
  useEffect(() => {
    if (!userId) return
    const guardar = () => guardarTela(userId, { busca, aba, modo, status: statusSelecionados, periodo: periodoFiltro, ini: dataInicio, fim: dataFim, em: Date.now(), y: rolagemGuardada.current, sit })
    guardar()
    return guardar // ao sair da tela (ou antes da próxima mudança): com a rolagem e a hora do momento
  }, [userId, busca, aba, modo, statusSelecionados, periodoFiltro, dataInicio, dataFim, sit])
  useEffect(() => {
    // com janela aberta a página fica presa no topo (trava da rolagem): essa posição não conta
    const aoRolar = () => { if (document.body.style.position !== 'fixed') rolagemGuardada.current = window.scrollY }
    window.addEventListener('scroll', aoRolar, { passive: true })
    return () => window.removeEventListener('scroll', aoRolar)
  }, [])
  // A lista chegou: volta pra posição em que estava (uma vez só)
  useEffect(() => {
    if (estado !== 'pronto' || rolagemPraVoltar.current == null) return
    const y = rolagemPraVoltar.current
    const quadro = window.requestAnimationFrame(() => { rolagemPraVoltar.current = null; window.scrollTo(0, y) })
    return () => window.cancelAnimationFrame(quadro)
  }, [estado])

  // (11/10) O app instalado fica aberto por dias: ao voltar pra ele (ou a internet voltar), a lista é buscada de novo.
  // Não recarrega com o "cliente pagou?" aberto nem com uma mudança de situação em andamento.
  useAoVoltar(() => { if (userId && estado === 'pronto' && !pendingPag && mudandoRef.current.size === 0) fetchPedidos(userId, true) })

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
  // (24/10) aviso em cartão com "Desfazer": volta a situação anterior se tocou sem querer (só quando foi só a situação que
  // mudou; com pagamento registrado, o botão é "Ver", que abre o pedido)
  const confirmarMudanca = (p: Pedido, status: string, pago = false, podeDesfazer = true, etapaJaRegistrada = false) => {
    if (!etapaJaRegistrada) registrarEtapa(p.id, status) // (27/10) a janela de finalizar já registra: antes "Entregue" saía 2 vezes
    const anterior = p.status
    avisarMudanca(p, status, {
      pago,
      ver: pago ? () => navigate(`/pedidos/${p.id}/editar`) : undefined,
      desfazer: !pago && podeDesfazer && anterior && anterior !== status ? () => { void desfazerMudanca(p, anterior) } : undefined,
    })
    if (status === 'entregue') tocarSom('sucesso')
  }
  const desfazerMudanca = async (p: Pedido, anterior: string) => {
    const { error } = await supabase.from('pedidos').update({ status: anterior }).eq('id', p.id)
    if (error) { avisar('Não deu para desfazer. Confira a internet e mude a situação no pedido.', { tipo: 'erro' }); return }
    mudarPedidos(prev => prev.map(x => x.id === p.id ? { ...x, status: anterior } : x))
    registrarEtapa(p.id, anterior, `Desfeito: voltou para "${nomeDaSituacao(anterior)}"`)
    avisarDesfeito(p, anterior)
  }

  const updateStatus = async (id: string, status: string, pagoDireto = false) => {
    const pedido = pedidos.find(p => p.id === id)
    if (!pedido) return
    const statusAtual = grupoDoStatus(pedido.status)
    const falhou = () => avisar('Não deu para mudar a situação. Confira a internet e tente de novo.', { tipo: 'erro' })

    // Regra 1 (Financeiro · Passo 0): entrar em Aguardando pagamento só muda a situação (um sinal já pago não some)
    if (status === 'aguardando_pagamento' && statusAtual !== 'aguardando_pagamento') {
      const { error } = await supabase.from('pedidos').update({ status }).eq('id', id)
      if (error) { falhou(); return }
      mudarPedidos(prev => prev.map(p => p.id === id ? { ...p, status } : p))
      confirmarMudanca(pedido, status)
      return
    }

    // Botão "Recebi": entrou o que faltava (Passo 1: vira um pagamento registrado)
    // (10/10) Primeiro o recebimento, depois a situação: se o pagamento não gravar, nada muda e o pedido
    // não aparece como pago. Antes a falha caía no "senão" e a lista mostrava pago, com aviso de sucesso.
    if (statusAtual === 'aguardando_pagamento' && pagoDireto) {
      // (11/10) Antes de registrar, relê o pedido no banco: a lista pode estar aberta há horas e o pagamento já ter
      // entrado (pelo cardápio, em outro aparelho). O valor registrado é o que falta DE VERDADE; se já está pago, não registra de novo.
      const { data: noBanco, error: errLer } = await supabase.from('pedidos').select('valor_total, valor_recebido, status_pagamento, status').eq('id', id).maybeSingle()
      if (errLer || !noBanco) { avisar('Não deu para conferir o pagamento deste pedido. Confira a internet e tente de novo.', { tipo: 'erro' }); return }
      const atual = { ...pedido, ...(noBanco as Partial<Pedido>) } as Pedido
      if (grupoDoStatus(atual.status) !== 'aguardando_pagamento') {
        // já saiu de "Aguardando pagamento" em outro lugar: a lista só passa a mostrar o que está gravado
        mudarPedidos(prev => prev.map(p => p.id === id ? { ...p, ...(noBanco as Partial<Pedido>) } : p))
        avisar(`O pedido #${pedido.numero || ''} já tinha sido atualizado.`, { tipo: 'info' })
        return
      }
      const falta = saldoPedido(atual)
      // (27/10) pergunta antes de lançar no caixa (antes um toque errado na lista já registrava o dinheiro)
      if (falta > 0) {
        const ok = await confirmar({ titulo: `Recebeu ${rs(falta)}?`, texto: `${nomeCliente(atual)} · pedido #${atual.numero || ''}. O valor entra no caixa.`, rotulo: 'Recebi', rotuloVoltar: 'Voltar' })
        if (!ok) return
      }
      const r = falta > 0
        ? await registrarPagamento({ pedidoId: id, valor: falta, forma: atual.forma_pagamento, tipo: recebidoPedido(atual) > 0 ? 'restante' : 'total' })
        : null
      if (r && !r.ok) {
        // relê o pedido: se o pagamento entrou e só a resposta se perdeu, a lista já mostra pago e o próximo toque não cobra de novo
        const { data: gravado } = await supabase.from('pedidos').select('valor_recebido, status_pagamento').eq('id', id).maybeSingle()
        if (gravado) mudarPedidos(prev => prev.map(p => p.id === id ? { ...p, ...(gravado as Partial<Pedido>) } : p))
        avisar(r.erro || 'Não deu para registrar o recebimento. Confira a internet e tente de novo.', { tipo: 'erro' }); return
      }
      const novo = !r ? { valor_total: atual.valor_total, valor_recebido: atual.valor_recebido, status_pagamento: atual.status_pagamento } // já estava pago: fica o que está gravado
        : r.status_pagamento ? { valor_total: atual.valor_total, valor_recebido: r.valor_recebido ?? atual.valor_total, status_pagamento: r.status_pagamento }
        : { valor_total: atual.valor_total, valor_recebido: atual.valor_total, status_pagamento: 'pago' }
      const { error } = await supabase.from('pedidos').update({ status }).eq('id', id)
      if (error) {
        // o dinheiro entrou, a situação não: a lista mostra o que está gravado (tocar de novo só muda a situação)
        mudarPedidos(prev => prev.map(p => p.id === id ? { ...p, ...novo } : p))
        if (r) avisar('O recebimento foi registrado, mas a situação do pedido não mudou. Tente de novo.', { tipo: 'erro' })
        else falhou()
        return
      }
      mudarPedidos(prev => prev.map(p => p.id === id ? { ...p, status, ...novo } : p))
      confirmarMudanca(pedido, status, !!r) // já estava pago: avisa só a mudança de situação
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
    // (6.78) aceitar só vale se o pedido ainda está esperando (cancelado em outro aparelho não volta como agendado)
    const aceitando = statusAtual === 'aguardando_aceite' && status === 'agendado'
    let q = supabase.from('pedidos').update({ status }).eq('id', id)
    if (aceitando) q = q.in('status', ['aguardando_aceite', 'novo', 'pendente'])
    const { data: mudou, error } = await q.select('id')
    if (error) { falhou(); return }
    if (aceitando && !mudou?.length) { avisar(`O pedido #${pedido.numero || ''} já tinha sido atualizado em outro lugar.`, { tipo: 'info' }); return }
    mudarPedidos(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    confirmarMudanca(pedido, status)
  }

  /** Liga e desliga a trava de um pedido (a tela mostra o "carregando" no botão dele). */
  const travar = (id: string, ligar: boolean) => {
    if (ligar) mudandoRef.current.add(id); else mudandoRef.current.delete(id)
    versao.current++
    setMudando(new Set(mudandoRef.current))
  }
  const avancar = async (p: Pedido) => {
    const a = acaoDe(p)
    if (!a || mudandoRef.current.has(p.id)) return
    travar(p.id, true)
    try { await updateStatus(p.id, a.proximo, !!a.pago) } finally { travar(p.id, false) }
  }

  // (11/10) Quadro: arrastar pra "Cancelado" um pedido que já tem dinheiro recebido não cancela direto.
  // Abre a tela do pedido já na janela de cancelar, que pergunta o que fazer com o valor (antes cancelava calado e o dinheiro ficava no caixa).
  const moverNoQuadro = async (id: string, status: string) => {
    if (mudandoRef.current.has(id)) return
    travar(id, true)
    try {
      if (status === 'cancelado') {
        const pedido = pedidos.find(p => p.id === id)
        // o recebido que está no banco agora (a lista pode estar velha); se a leitura falhar, vale o da lista
        const { data: noBanco } = await supabase.from('pedidos').select('valor_total, valor_recebido, status_pagamento').eq('id', id).maybeSingle()
        if (recebidoPedido({ ...pedido, ...((noBanco as Partial<Pedido>) || {}) }) > 0.009) { navigate(`/pedidos/${id}/editar`, { state: { abrirCancelar: true } }); return }
      }
      await updateStatus(id, status)
    } finally { travar(id, false) }
  }

  // (10/10) Excluir pelo lib/pedidosDoo. (6.157) não estorna mais: o recebido fica no caixa e nos relatórios como "Pedido excluído"
  // e para se algum passo falhar. A regra fica em lib/pedidosDoo, a mesma da tela do pedido.
  const excluindo = useRef(false)
  const excluirPedido = async (p: Pedido) => {
    if (excluindo.current) return false
    excluindo.current = true
    versao.current++
    try {
      const r = await excluirPedidoNoBanco(p.id)
      if (r.ok === false) {
        avisar(r.erro, { tipo: 'erro' })
        if (r.estornou) {
          // o pedido ficou, mas os recebimentos já saíram: a lista mostra o que está gravado
          const { data } = await supabase.from('pedidos').select('valor_recebido, status_pagamento').eq('id', p.id).maybeSingle()
          if (data) mudarPedidos(prev => prev.map(x => x.id === p.id ? { ...x, ...(data as Partial<Pedido>) } : x))
        }
        return false
      }
      mudarPedidos(prev => prev.filter(x => x.id !== p.id))
      avisar('Pedido excluído.')
      return true
    } finally { excluindo.current = false }
  }

  // (20/10) Pix pelo cardápio: ela confere no banco e confirma. Vira um recebimento normal (financeiro, "falta pagar").
  const confirmandoPix = useRef(false)
  const confirmarPix = async (p: Pedido) => {
    const px = pixDoPedido(p)
    if (!px || px.estado !== 'conferir' || confirmandoPix.current) return
    const ok = await confirmar({
      titulo: `Confirmar o Pix de ${rs(px.valor)}?`,
      texto: `Confira no app do banco se o Pix de ${nomeCliente(p)} entrou. ${px.tipo === 'sinal' ? 'Fica como sinal pago do pedido.' : 'O pedido fica pago.'}`,
      rotulo: 'Confirmar', rotuloVoltar: 'Ainda não',
    })
    if (!ok) return
    confirmandoPix.current = true
    try {
      const r = await registrarPagamento({ pedidoId: p.id, userId, valor: px.valor, forma: 'pix', tipo: px.tipo, origem: 'cardapio', observacao: 'Pix pelo cardápio' })
      if (!r.ok) { avisar(r.erro || 'Não deu para confirmar o Pix. Tente de novo.', { tipo: 'erro' }); return }
      const { data } = await supabase.from('pedidos').select('valor_recebido, status_pagamento').eq('id', p.id).maybeSingle()
      mudarPedidos(prev => prev.map(x => x.id === p.id ? { ...x, ...((data as Partial<Pedido>) || { valor_recebido: px.valor, status_pagamento: px.tipo === 'sinal' ? 'parcial' : 'pago' }) } : x))
      avisar(px.tipo === 'sinal' ? 'Sinal confirmado.' : 'Pix confirmado. Pedido pago.', { tipo: 'ok' })
    } finally { confirmandoPix.current = false }
  }

  // ── "Mais ações" do pedido: faz a ação e depois fecha a janela ──
  const duplicando = useRef(false) // (10/10) trava: dois toques seguidos criavam duas cópias
  const handleMenuAcao = async (p: Pedido, acao: AcaoMenu) => {
    const fechar = () => {}
    if (acao === 'confirmar_pix') { fechar(); await confirmarPix(p); return }
    if (acao === 'editar') { irDaJanela(`/pedidos/${p.id}/editar`); fechar(); return }
    if (acao === 'duplicar') {
      if (duplicando.current) return
      duplicando.current = true
      avisar('Duplicando o pedido…', { tipo: 'info' })
      try {
        const r = await duplicarPedido(p.id)
        if ('erro' in r) { avisar(r.erro, { tipo: 'erro' }); return }
        avisar(`${r.aviso} Ajuste a data da cópia.`) // (11/10) diz quando a cópia veio sem os descontos do original
        irDaJanela(`/pedidos/${r.id}/editar`); fechar()
      } finally { duplicando.current = false }
      return
    }
    if (acao === 'contatar') {
      const nome = p.cliente_nome ? nomeCliente(p).split(' ')[0] : ''
      // (10/10) o número sai de lib/telefone: trata o +55 e não confunde o DDD 55 com o código do país
      const link = linkWhatsApp(p.cliente_telefone, montarMensagem('sobre_pedido', dadosDoPedido(p, nome)))
      if (!link) { avisar('O telefone deste cliente está incompleto.', { tipo: 'info' }); return }
      window.open(link, '_blank')
      // (04/11 · 6.20) o atalho pra mudar o texto dessa mensagem fica aqui, onde ela manda
      avisar('Mensagem aberta no WhatsApp', { tipo: 'ok', acao: { rotulo: 'Editar o texto', aoTocar: () => navigate('/configuracoes/mensagens') } })
      fechar(); return
    }
    if (acao === 'compartilhar') {
      const itens = p.pedido_itens || []
      const linhasItens = itens.map(it => `• ${itemComQtd(nomeDoItem(it), it.quantidade, formaDoItem(it))}`).join('\n')
      // (6.82) mesmo padrão das outras mensagens: rótulos em negrito, data "sábado, 08/11 às 15:00" e o que falta pagar
      const SEM = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
      const dEnt = p.data_entrega ? new Date(`${p.data_entrega.slice(0, 10)}T12:00:00`) : null
      const quando = dEnt ? `${SEM[dEnt.getDay()]}, ${dEnt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}${p.horario_entrega ? ` às ${p.horario_entrega.slice(0, 5)}` : ''}` : 'a combinar'
      const falta = saldoPedido(p)
      const resumo = [
        `*Pedido #${p.numero || ''}*`,
        '',
        p.cliente_nome ? `*Cliente:* ${nomeCliente(p)}` : '',
        `*${p.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada'}:* ${quando}`,
        '',
        linhasItens ? `*Itens:*\n${linhasItens}` : '',
        '',
        `*Total:* ${rs(p.valor_total)}`,
        falta > 0.009 && p.status !== 'cancelado' ? `*Falta pagar:* ${rs(falta)}` : '',
      ].filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== '')).join('\n').replace(/\n{3,}/g, '\n\n').trim()
      // (16/10) compartilhar nativo do celular (WhatsApp, Telegram...); no computador copia o resumo
      void compartilharTexto(resumo, `Pedido #${p.numero || ''}`)
      fechar(); return
    }
    if (acao === 'pdf') {
      const janela = abrirJanela()
      // busca o pedido completo (com as escolhas de cada item) pro comprovante sair inteiro
      const { data } = await supabase.from('pedidos').select('*, pedido_itens(*, produtos(forma_venda))').eq('id', p.id).maybeSingle()
      await gerarPedidoPDF((data || p) as PedidoPDF, janela)
      fechar(); return
    }
    if (acao === 'excluir') {
      const ok = await confirmar({ titulo: `Excluir o pedido #${p.numero || ''}?`, texto: recebidoPedido(p) > 0 ? (p.status === 'cancelado' ? 'Ele some da lista. O sinal que você ficou continua no caixa.' : 'Ele some da lista e da agenda. O que já foi recebido continua no caixa.') : 'Ele some da lista, da agenda e do financeiro.', /* (6.157) o recebido fica no caixa e nos relatórios */ rotulo: 'Excluir', perigo: true })
      if (!ok) return
      if (await excluirPedido(p)) fechar()
    }
  }

  // (22/10) "Aceitar todos": os pedidos novos do cardápio vão pra agenda de uma vez (um aviso só)
  const aceitandoTodos = useRef(false)
  const aceitarTodos = async (lista: Pedido[]) => {
    const ids = lista.filter(p => precisaAceitar(p) && acaoDe(p)?.proximo === 'agendado' && !mudandoRef.current.has(p.id)).map(p => p.id)
    if (!ids.length || aceitandoTodos.current) return
    const ok = await confirmar({ titulo: `Aceitar os ${ids.length} pedidos?`, texto: 'Eles entram na sua agenda.', rotulo: 'Aceitar todos', rotuloVoltar: 'Agora não' })
    if (!ok) return
    aceitandoTodos.current = true
    ids.forEach(id => travar(id, true))
    try {
      // (27/10) só aceita o que ainda está esperando aceite no banco (cancelado em outro aparelho não volta pra agenda)
      const { data: aceitos, error } = await supabase.from('pedidos').update({ status: 'agendado' }).in('id', ids)
        .in('status', ['aguardando_aceite', 'novo', 'pendente']).select('id')
      if (error) { avisar('Não deu para aceitar os pedidos. Confira a internet e tente de novo.', { tipo: 'erro' }); return }
      const feitos = (aceitos || []).map((r: { id: string }) => r.id as string)
      feitos.forEach(id => registrarEtapa(id, 'agendado'))
      mudarPedidos(prev => prev.map(p => feitos.includes(p.id) ? { ...p, status: 'agendado' } : p))
      if (feitos.length < ids.length && userId) void fetchPedidos(userId, true) // algum mudou em outro aparelho: mostra como está
      avisar(feitos.length === 1 ? 'Pedido aceito.' : `${feitos.length} pedidos aceitos.`)
      setSit(null) // a aba vazia some: volta pra aba que tem pedido (Agendados)
    } finally { ids.forEach(id => travar(id, false)); aceitandoTodos.current = false }
  }

  const abrirPedido = (p: Pedido) => navigate(`/pedidos/${p.id}/editar`)
  const verEndereco = (p: Pedido) => navigate(`/pedidos/${p.id}/editar?aba=entrega`)

  const pedidosFiltrados = useMemo(() => {
    const q = semAcento(busca)
    return pedidos.filter(p => {
      // (10/10) a mesma regra do "X pra aceitar" do Início (STATUS_PENDENTES em pages/Inicio.tsx), de qualquer origem
      if (filtroAguardando && computador) return ['aguardando_aceite', 'aguardando_pagamento', 'novo', 'pendente'].includes(p.status)
      if (filtroAtrasados) return pedidoAtrasado(p, hoje)
      if (computador && (p.tipo_venda || 'encomenda') !== aba) return false
      const okStatus = statusSelecionados.includes(grupoDoStatus(p.status))
      const okBusca = !q || semAcento(p.cliente_nome || '').includes(q) || String(p.numero).includes(q)
      const okData = bateData(p, periodoFiltro === 'custom' ? 'personalizado' : periodoFiltro, dataInicio, dataFim)
      return okStatus && okBusca && okData
    })
  }, [pedidos, busca, aba, statusSelecionados, periodoFiltro, dataInicio, dataFim, filtroAguardando, filtroAtrasados, hoje, computador]) // "hoje": os filtros de data e de atrasado andam com o dia

  // Agrupado por dia: Atrasado, Hoje, Amanhã, os próximos dias, Sem data e Concluídos
  // (6.10) lista mais curta: agendados mostram os próximos 7 dias (o resto fica em "Mais pra frente", fechado)
  // e concluídos os últimos 7 dias ("Ver mais antigos" traz mais 30). Buscando ou filtrando, mostra tudo.
  const [verDepois, setVerDepois] = useState(false)
  const [diasConcluidos, setDiasConcluidos] = useState(7)
  const abreTudo = !!busca.trim() || periodoFiltro !== 'todos' || statusSelecionados.length !== STATUS_PADRAO.length || !STATUS_PADRAO.every(x => statusSelecionados.includes(x))
  const agrupar = useCallback((lista: Pedido[], cel = false) => {
    // (11/10) "hoje" vem do useDiaAtual: com a lista aberta de um dia pro outro, os grupos se refazem sozinhos
    const [ah, mh, dh] = hoje.split('-').map(Number)
    const hojeIso = hoje, amanhaIso = dataISO(new Date(ah, mh - 1, dh + 1)), ontemIso = dataISO(new Date(ah, mh - 1, dh - 1))
    const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
    const rot = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${DIAS[new Date(y, m - 1, d).getDay()]}, ${d}/${m}` }
    const porHora = (a: Pedido, b: Pedido) => String(a.data_entrega || '').localeCompare(String(b.data_entrega || '')) || String(a.horario_entrega || '').localeCompare(String(b.horario_entrega || ''))
    const g: { chave: string; titulo: string; itens: Pedido[] }[] = []
    const add = (chave: string, titulo: string, itens: Pedido[]) => { if (itens.length) g.push({ chave, titulo, itens }) }
    // pedidos pra aceitar vêm primeiro, em destaque (3.14); os outros seguem agrupados por dia
    add('aceitar', 'Para aceitar', lista.filter(p => !terminou(p) && precisaAceitar(p)).sort(porHora))
    // (6.04) celular: os que esperam o Pix ficam na aba Novos, num grupo logo depois dos pra aceitar
    if (cel) add('pix', 'Esperando o Pix', lista.filter(p => !terminou(p) && esperaPix(p)).sort(porHora))
    // (6.09) os que estão em produção ficam num grupo só, no topo: dá pra ver o que está no forno sem filtrar
    const emProducao = (p: Pedido) => grupoDoStatus(p.status) === 'em_producao'
    add('producao', 'Em produção', lista.filter(p => !terminou(p) && !precisaAceitar(p) && emProducao(p)).sort(porHora))
    const ativos = lista.filter(p => !terminou(p) && !precisaAceitar(p) && !(cel && esperaPix(p)) && !emProducao(p)).sort(porHora)
    // (11/10) "Atrasado" pela regra única (lib/pedidoStatus): a data passou E o pedido ainda não ficou pronto.
    // O que já está pronto (ou saiu pra entrega) e é de um dia anterior não é atraso: fica num grupo à parte, pra não sumir da lista.
    const passados = ativos.filter(p => p.data_entrega && p.data_entrega.slice(0, 10) < hojeIso)
    add('atrasado', 'Atrasado', passados.filter(p => pedidoAtrasado(p, hojeIso)))
    add('antes', 'De dias anteriores', passados.filter(p => !pedidoAtrasado(p, hojeIso)))
    add('hoje', `Hoje · ${rot(hojeIso)}`, ativos.filter(p => p.data_entrega === hojeIso))
    add('amanha', `Amanhã · ${rot(amanhaIso)}`, ativos.filter(p => p.data_entrega === amanhaIso))
    const semanaIso = dataISO(new Date(ah, mh - 1, dh + 6))
    const porDia = (lst: Pedido[]) => [...new Set(lst.map(p => p.data_entrega))].forEach(d => { const t = rot(d); add('d' + d, t.charAt(0).toUpperCase() + t.slice(1), lst.filter(p => p.data_entrega === d)) })
    const futuros = ativos.filter(p => p.data_entrega && p.data_entrega > amanhaIso)
    porDia(futuros.filter(p => abreTudo || p.data_entrega <= semanaIso))
    const depois = abreTudo ? [] : futuros.filter(p => p.data_entrega > semanaIso)
    if (depois.length) { if (verDepois) porDia(depois); else g.push({ chave: 'depois', titulo: 'Mais pra frente', itens: depois }) }
    add('semdata', 'Sem data', ativos.filter(p => !p.data_entrega))
    // concluídos: só os últimos dias (com 1.500 entregues a lista ficava enorme e lenta)
    const corte = dataISO(new Date(ah, mh - 1, dh - (diasConcluidos - 1)))
    const fimTodos = lista.filter(terminou).sort((a, b) => -porHora(a, b))
    const fim = abreTudo ? fimTodos : fimTodos.filter(p => !p.data_entrega || p.data_entrega.slice(0, 10) >= corte)
    const fimFora = fimTodos.length - fim.length
    if (!cel) add('concluidos', 'Concluídos', fim)
    else if (fimTodos.length) {
      // (6.09) celular: Concluídos separado por dia, com "Hoje" sempre em cima (o número da aba é o de hoje)
      const diaDe = (p: Pedido) => String(p.data_entrega || '').slice(0, 10)
      const titulo = (d: string) => {
        if (!d) return 'Sem data'
        const t = rot(d)
        return d === hojeIso ? `Hoje · ${t}` : d === ontemIso ? `Ontem · ${t}` : d === amanhaIso ? `Amanhã · ${t}` : t.charAt(0).toUpperCase() + t.slice(1)
      }
      const dias = [...new Set(fim.map(diaDe))]
      if (!dias.includes(hojeIso)) g.push({ chave: 'c-hoje', titulo: titulo(hojeIso), itens: [] })
      dias.forEach(d => { const itens = fim.filter(p => diaDe(p) === d); if (d === hojeIso) g.push({ chave: 'c-hoje', titulo: titulo(d), itens }); else add('c' + (d || 'sem'), titulo(d), itens) })
      // hoje sempre primeiro, mesmo quando tem entrega marcada pra frente
      g.sort((a, b) => Number(b.chave === 'c-hoje') - Number(a.chave === 'c-hoje'))
    }
    if (fimFora > 0) g.push({ chave: 'antigos', titulo: 'Ver mais antigos', itens: [] })
    return g
  }, [hoje, abreTudo, verDepois, diasConcluidos])
  const grupos = useMemo(() => agrupar(pedidosFiltrados), [agrupar, pedidosFiltrados])
  // celular: quantos em cada aba, a aba escolhida (ou a primeira com pedido) e os grupos dela
  const nSit = useMemo(() => {
    const n: Record<Sit, number> = { aceitar: 0, agenda: 0, prontos: 0, concluidos: 0 }
    // (6.03) Concluídos mostra só os entregues de hoje: o total de sempre só cresce e não diz nada
    pedidosFiltrados.forEach(p => { const s = sitDe(p); if (s !== 'concluidos') n[s]++; else if (grupoDoStatus(p.status) === 'entregue' && String(p.data_entrega || '').slice(0, 10) === hoje) n.concluidos++ })
    return n
  }, [pedidosFiltrados, hoje])
  const sitAtual: Sit = sit ?? (nSit.aceitar > 0 ? 'aceitar' : nSit.agenda > 0 || nSit.prontos === 0 ? 'agenda' : 'prontos')
  const gruposCel = useMemo(() => agrupar(pedidosFiltrados.filter(p => sitDe(p) === sitAtual), true), [agrupar, pedidosFiltrados, sitAtual])
  // (6.09) celular: buscou ou filtrou e a aba aberta ficou vazia? vai pra primeira aba que tem o resultado
  // (antes o filtro achava o pedido, mas ele ficava escondido em outra aba)
  const filtroAntes = useRef<string | null>(null)
  useEffect(() => {
    const agora = JSON.stringify([busca.trim(), statusSelecionados, periodoFiltro, dataInicio, dataFim])
    const antes = filtroAntes.current
    filtroAntes.current = agora
    if (computador || antes === null || antes === agora) return
    const n: Record<Sit, number> = { aceitar: 0, agenda: 0, prontos: 0, concluidos: 0 }
    pedidosFiltrados.forEach(p => { n[sitDe(p)]++ })
    if (n[sitAtual] > 0) return
    const alvo = SITS.find(t => n[t.k] > 0)
    if (alvo) setSit(alvo.k)
  }, [busca, statusSelecionados, periodoFiltro, dataInicio, dataFim, computador, pedidosFiltrados, sitAtual])

  // (22/10) o filtro conta o que a aba aberta vai mostrar (computador: Encomendas ou Pronta entrega).
  // (01/11 · 5.99) no celular as abas já são as situações: contando só a aba aberta, todas as outras situações apareciam com 0
  const pedidosDoFiltro = useMemo(() => {
    const q = semAcento(busca)
    return pedidos.filter(p => (!computador || (p.tipo_venda || 'encomenda') === aba)
      && (!q || semAcento(p.cliente_nome || '').includes(q) || String(p.numero).includes(q)))
  }, [pedidos, busca, computador, aba])

  const nFiltros = (statusSelecionados.length !== STATUS_PADRAO.length || !STATUS_PADRAO.every(s => statusSelecionados.includes(s)) ? 1 : 0) + (periodoFiltro !== 'todos' ? 1 : 0)
  const filtrando = nFiltros > 0 || !!busca.trim()
  const limparTudo = () => { setBusca(''); setStatusSelecionados(STATUS_PADRAO); setPeriodoFiltro('todos'); setDataInicio(''); setDataFim('') }
  // (6.10) "Mais pra frente" (fechado) e "Ver mais antigos" no fim da lista
  const BotaoMais = ({ g }: { g: { chave: string; itens: Pedido[] } }) => g.chave === 'depois'
    ? <button type="button" className="pd-mais" onClick={() => setVerDepois(true)}><span><b>Mais pra frente</b><small>{g.itens.length === 1 ? '1 pedido' : `${g.itens.length} pedidos`} depois de 7 dias</small></span><CaretDown size={18} weight="bold" aria-hidden="true" /></button>
    : <button type="button" className="pd-mais pd-mais--link" onClick={() => setDiasConcluidos(d => d + 30)}><b>Ver mais antigos</b></button>
  const nEncomendas = pedidos.filter(p => (p.tipo_venda || 'encomenda') === 'encomenda').length
  const nPronta = pedidos.filter(p => p.tipo_venda === 'pronta_entrega').length
  const sairDoFiltroRapido = () => { setFiltroAguardando(false); setFiltroAtrasados(false); navigate('/pedidos', { replace: true }) }
  const quadro = largo && modo === 'quadro'

  const props = (p: Pedido) => ({ p, aoAbrir: abrirPedido, aoAvancar: avancar, aoMenu: handleMenuAcao, aoEndereco: verEndereco, mudando: mudando.has(p.id), aoConfirmarPix: confirmarPix,
    // (28/10) Recusar o pedido novo: abre o pedido já na janela de cancelar (a mesma do Quadro), que cuida do sinal recebido
    aoRecusar: (x: Pedido) => navigate(`/pedidos/${x.id}/editar`, { state: { abrirCancelar: true } }) })

  const conteudo = () => {
    if (estado === 'carregando') return demorou ? <p className="pd-carregando" role="status"><span className="ui-gira" aria-hidden="true" />Carregando os pedidos…</p> : null
    if (estado === 'erro') return <TelaVazia icone={<WarningCircle size={30} />} titulo="Não deu para carregar os pedidos" texto="Confira a internet e tente de novo." acao={<Botao variante="suave" tamanho="m" onClick={() => userId && fetchPedidos(userId)}>Tentar de novo</Botao>} />
    if (totalProdutos === 0 && pedidos.length === 0) return <TelaVazia className="pd-sem-produto" icone={<img src="/Sistema/pedidos-sem-produto.webp" alt="" width={180} height={189} />} titulo="Cadastre um produto primeiro" texto="Para registrar um pedido, você precisa ter pelo menos um produto." acao={<Botao icone={<Plus size={20} weight="bold" />} onClick={() => navigate('/produtos')}>Cadastrar produto</Botao>} />
    // (19/10) sem pedido nenhum, a barra de cima (abas, busca, Lista/Quadro, Nova venda) fica: antes ela sumia e a tela "pulava"
    return null
  }
  const parada = conteudo()

  return (
    <>
      <AppPageHeader
        title="Meus pedidos"
        subtitle="Acompanhe suas encomendas e produção"
        infoIcon="📋" infoComo={COMO_PEDIDOS} infoTour={TOUR_PEDIDOS}
        infoContent={
          <>
            <p>Aqui ficam <strong>todas as suas encomendas</strong>, agrupadas por dia: o que está atrasado, o que entrega hoje, amanhã e nos próximos dias.</p>
            <p>O botão de cada pedido leva para o próximo passo: aceitar, produzir, marcar pronto, marcar entregue ou retirado.</p>
          </>
        }
        infoTip={<>Abra um pedido para ver tudo e marcar o pagamento.</>}
      />

      <div className={`pd${quadro ? " pd--quadro" : ""}`}>
        {parada ?? (
          <>
            <div className="pd-barra">
              {computador && <div className="pd-abas" role="tablist" aria-label="Tipo de venda">
                <button type="button" role="tab" aria-selected={aba === 'encomenda'} className="pd-aba" onClick={() => setAba('encomenda')}>
                  <CalendarDots size={20} weight={aba === 'encomenda' ? 'fill' : 'bold'} aria-hidden="true" /><span>Encomendas</span><i>{nEncomendas}</i>
                </button>
                <button type="button" role="tab" aria-selected={aba === 'pronta_entrega'} className="pd-aba" onClick={() => setAba('pronta_entrega')}>
                  <Lightning size={20} weight={aba === 'pronta_entrega' ? 'fill' : 'bold'} aria-hidden="true" /><span>Pronta entrega</span><i>{nPronta}</i>
                </button>
              </div>}
              <div className="pd-busca-l">
                <div className="ui-campo-c pd-busca" onClick={e => { if (e.target === e.currentTarget) e.currentTarget.querySelector('input')?.focus() }}>
                  <span className="ui-campo-ic" aria-hidden="true"><MagnifyingGlass size={20} weight="bold" /></span>
                  <input type="search" inputMode="search" enterKeyHint="search" autoComplete="off" aria-label="Buscar pedido por cliente ou número" placeholder="Buscar" value={busca} onChange={e => setBusca(e.target.value)} />
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
                {/* (22/10) no celular o "+" do menu de baixo já faz a nova venda */}
                {computador && <Botao className="pd-novo" icone={<Plus size={20} weight="bold" />} onClick={handleNovoPedido}>Nova venda</Botao>}
              </div>
            </div>

            {!computador && !quadro && !filtroAtrasados && pedidos.length > 0 && (
              <div className="pdk-abas" role="tablist" aria-label="Situação dos pedidos">
                {SITS.map(t => (
                  <button key={t.k} type="button" role="tab" aria-selected={sitAtual === t.k} className={`pdk-aba${t.k === 'aceitar' && nSit.aceitar > 0 ? ' alerta' : ''}`} onClick={() => { setSit(t.k); window.scrollTo(0, 0) }}>
                    <span className="pdk-aba-t">{t.curto ? <><span className="pdk-aba-l">{t.nome}</span><span className="pdk-aba-c">{t.curto}</span></> : t.nome}</span><i>{nSit[t.k]}</i>
                  </button>
                ))}
              </div>
            )}

            {(computador ? (filtroAguardando || filtroAtrasados) : filtroAtrasados) && (
              <div className={`pd-rapido${filtroAtrasados ? ' atr' : ''}`}>
                <div>
                  <b>{filtroAtrasados ? 'Pedidos atrasados' : 'Pedidos para aceitar'}</b>
                  <p>{filtroAtrasados ? 'A data de entrega passou e eles ainda não ficaram prontos.' : 'Os pedidos que esperam você aceitar ou o pagamento do cliente.'}</p>
                </div>
                <Botao variante="secundario" tamanho="p" onClick={sairDoFiltroRapido}>Ver todos</Botao>
              </div>
            )}

            {pedidos.length === 0 ? (
              <TelaVazia icone={<Receipt size={30} />} titulo="Nenhum pedido ainda" texto="Quando chegar uma encomenda, ela aparece aqui."
                acao={<Botao variante="link" onClick={() => navigate('/cardapio')}>Divulgar o cardápio</Botao>} />
            ) : pedidosFiltrados.length === 0 ? (
              filtrando
                ? <TelaVazia icone={<MagnifyingGlass size={30} />} titulo="Nenhum pedido encontrado" texto={busca.trim() ? `Não achamos nada com “${busca.trim()}”.` : 'Nenhum pedido com esses filtros.'} acao={<Botao variante="suave" tamanho="m" onClick={limparTudo}>Ver todos os pedidos</Botao>} />
                : <TelaVazia icone={aba === 'pronta_entrega' ? <Lightning size={30} /> : <Receipt size={30} />} titulo={aba === 'pronta_entrega' ? 'Nenhuma venda de pronta entrega' : 'Nenhum pedido aqui'} texto={aba === 'pronta_entrega' ? 'As vendas do balcão aparecem aqui.' : 'Quando chegar uma encomenda, ela aparece aqui.'} />
            ) : quadro ? (
              // o Quadro mostra o "carregando" de um pedido por vez (a trava em si é por pedido, aqui na lista)
              <QuadroPedidos pedidos={pedidosFiltrados} aoAbrir={abrirPedido} aoAvancar={avancar} aoMover={moverNoQuadro} mudando={mudando.values().next().value ?? null} />
            ) : !computador ? (
              /* (22/10) celular: a aba da situação, em linhas compactas; dentro de Agendados e Prontos, separado por dia */
              gruposCel.length === 0 ? (
                <TelaVazia icone={<Receipt size={30} />} titulo={sitAtual === 'aceitar' ? 'Nenhum pedido para aceitar' : sitAtual === 'prontos' ? 'Nenhum pedido pronto' : sitAtual === 'concluidos' ? 'Nenhum pedido concluído' : 'Nenhum pedido agendado'}
                  texto={sitAtual === 'aceitar' ? 'Os pedidos do cardápio aparecem aqui para você aceitar.' : 'Quando tiver, eles aparecem aqui.'} />
              ) : (
              <div className="pd-grupos pdk-grupos">
                {gruposCel.map(g => {
                  const unico = gruposCel.length === 1 && (g.chave === 'aceitar' || g.chave === 'concluidos')
                  if (g.chave === 'depois' || g.chave === 'antigos') return <BotaoMais key={g.chave} g={g} />
                  return (
                    <section key={g.chave} className="pd-grupo" aria-label={g.titulo}>
                      {g.chave === 'aceitar' ? (
                        <div className="pdk-topo"><span>{g.itens.length === 1 ? 'Chegou pelo cardápio' : 'Chegaram pelo cardápio'}</span>
                          {g.itens.length > 1 && <button type="button" className="pdk-todos" onClick={() => aceitarTodos(g.itens)}>Aceitar todos</button>}</div>
                      ) : !unico && <p className={`pdk-t${g.chave === 'atrasado' ? ' t-vermelho' : ''}`}>{g.titulo}{g.itens.length > 0 && <i>{g.itens.length}</i>}</p>}
                      {g.itens.length === 0
                        ? <p className="pdk-nada">Nenhum pedido entregue hoje ainda.</p>
                        : <div className="pdk-lista">{g.itens.map(p => <LinhaCompacta key={p.id} {...props(p)} />)}</div>}
                    </section>
                  )
                })}
              </div>
              )
            ) : (
              <div className="pd-grupos">
                {grupos.map(g => g.chave === 'depois' || g.chave === 'antigos' ? <BotaoMais key={g.chave} g={g} /> : (
                  <section key={g.chave} className="pd-grupo" aria-label={g.titulo}>
                    <Titulo contagem={g.itens.length} tom={g.chave === 'atrasado' ? 'vermelho' : undefined} apoio={g.chave === 'aceitar' ? (g.itens.length === 1 ? 'Chegou pelo cardápio. Aceite para entrar na sua agenda.' : 'Chegaram pelo cardápio. Aceite para entrar na sua agenda.') : undefined}>{g.titulo}</Titulo>
                    <div className="pdl-tabela" role="table">{g.itens.map(p => <LinhaPedido key={p.id} {...props(p)} comDia={g.chave === 'concluidos' || g.chave === 'semdata' || g.chave === 'antes'} />)}</div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showFiltro && (
        <FiltroLateral
          statusSelecionados={statusSelecionados} setStatusSelecionados={v => { setStatusSelecionados(v); if (!computador) setSit(sitAtual) }}
          periodoFiltro={periodoFiltro} setPeriodoFiltro={setPeriodoFiltro}
          dataInicio={dataInicio} setDataInicio={setDataInicio}
          dataFim={dataFim} setDataFim={setDataFim}
          onClose={() => setShowFiltro(false)}
          pedidos={pedidosDoFiltro}
        />
      )}


      <Janela
        aberta={semProdutos} aoFechar={() => setSemProdutos(false)}
        titulo="Cadastre um produto primeiro" texto="Para registrar um pedido, você precisa ter pelo menos um produto."
        icone={<Cake size={32} />}
        acoes={<>
          <Botao variante="secundario" onClick={() => setSemProdutos(false)}>Voltar</Botao>
          <Botao onClick={() => { irDaJanela('/produtos'); setSemProdutos(false) }} data-foco-inicial>Cadastrar produto</Botao>
        </>}
      />

      {pendingPag && (
        <FinalizarPedidoSheet
          pedido={pendingPag.pedido}
          novoStatus={pendingPag.novoStatus}
          novoStatusLabel={nomeDaSituacao(pendingPag.novoStatus, pendingPag.pedido.tipo_entrega || "retirada")}
          aguardandoPagamento={grupoDoStatus(pendingPag.pedido.status) === 'aguardando_pagamento'}
          onCancelar={() => setPendingPag(null)}
          onParcial={(r) => mudarPedidos(prev => prev.map(p => p.id === pendingPag.pedido.id ? { ...p, ...r } : p))}
          onConcluido={(r) => { mudarPedidos(prev => prev.map(p => p.id === pendingPag.pedido.id ? { ...p, ...r } : p)); confirmarMudanca(pendingPag.pedido, pendingPag.novoStatus, false, false, true); setPendingPag(null) }}
        />
      )}
    </>
  )
}

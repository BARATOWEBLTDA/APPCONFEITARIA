import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, TouchEvent } from 'react'
import { ArrowLeft, Bell, BookOpen, CalendarDots, Check, CaretRight, CurrencyDollar, FolderSimple, Gear, House, Plus, Receipt, ShoppingBag } from '@phosphor-icons/react'
import { Botao, BotaoIcone } from '@/components/base'
import { Mascote, NomeDoonly } from '@/components/marca/Mascote'
import { CartaoPedido, LinhaPedido } from '@/components/pedidos/CartaoPedido'
import { acaoDe, type Pedido } from '@/components/pedidos/pedidoTexto'
import '@/components/pedidos/pedidos.css'
import { tocarSom } from '@/hooks/useSom'
import { nomeApresentavel } from '@/lib/nomeApresentavel'
import './boasVindas.css'

/**
 * Boas-vindas (refeita em 07/10 no desenho do login) — a apresentação que aparece logo depois de criar a conta.
 * (09/10 · 3.68) As demonstrações de pedidos, dinheiro e custos copiam as telas reais do app.
 * 6 telas: Boas-vindas · Cardápio · Pedidos · Dinheiro · Custos · Primeiro passo.
 * (09/10 · 3.67) Textos refeitos pelo guia de marketing do onboarding: benefício concreto em cada tela, sem culpar,
 * tela nova do dinheiro (quem pagou e quem falta pagar) e o botão final leva aos Primeiros passos do Início.
 * Quem controla é o App (isOpen + onClose). O que foi mantido da versão antiga: as 3 demonstrações
 * (cardápio rolando, pedidos caindo, conta do lucro), o arrastar pro lado, o som e a vibração.
 * O que mudou: fundo vinho, mascote novo, títulos sem caixa alta, ícones no lugar de emoji, botão sempre
 * no lugar (não espera a animação), voltar visível, voltar do Android, setas do teclado e versão pra tela larga.
 */

type Props = {
  isOpen: boolean
  /** recebe o número da tela em que a pessoa estava (0 a 5) e se tocou em "Configurar minha confeitaria" */
  onClose: (telaAlcancada: number, configurar: boolean) => void
  /** primeiro nome de quem acabou de criar a conta (opcional) */
  nome?: string
}

const TOTAL = 6

/**
 * Pra navegar logo depois que as boas-vindas fecham: elas acabaram de pedir um "voltar" pra tirar a entrada
 * delas do histórico, e esse voltar desfaria a navegação. Espera ele terminar (ou 600ms) e só então segue.
 */
export function depoisDoVoltar(fn: () => void) {
  let foi = false
  const ir = () => { if (!foi) { foi = true; fn() } }
  if (window.history.state?.bvTela) { window.addEventListener('popstate', () => setTimeout(ir, 0), { once: true }); setTimeout(ir, 600) }
  else ir()
}

const vibrarLeve = () => {
  try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15) } catch { /* sem vibração: segue */ }
}

// Só as imagens que as telas usam (antes baixava 16, mais de 4 MB, várias de telas que já saíram).
// As fotos pequenas (clientes e produtos) têm versão leve em public/tutorial/leve.
// Fotos das demonstrações (09/10 · 3.85): trocar a imagem é só substituir o arquivo com o mesmo nome em
// public/tutorial/boas-vindas (quadrado, 264 x 264, .webp). Cliente sem foto mostra as iniciais.
const PRODUTO = {
  bolo: '/tutorial/boas-vindas/produtos/bolo-aniversario.webp',
  caixa: '/tutorial/boas-vindas/produtos/caixa-brigadeiro.webp',
  kit: '/tutorial/boas-vindas/produtos/kit-festa.webp',
  salgados: '/tutorial/boas-vindas/produtos/salgados-mistos.webp',
}
const fotoCliente = (id: string) => `/tutorial/boas-vindas/clientes/${id}.webp`

// Só as imagens que as telas usam
const IMAGENS = ['/tutorial/cardapio-exemplo.jpg', '/tutorial/cardapio-exemplo-nav.jpg', ...Object.values(PRODUTO)]

export default function BoasVindas({ isOpen, onClose, nome }: Props) {
  const [tela, setTela] = useState(0)
  const nomeOk = nomeApresentavel(nome)
  const [saindo, setSaindo] = useState(false)
  const telaRef = useRef(0)
  telaRef.current = tela
  const toque = useRef<{ x: number; y: number } | null>(null)
  const saindoRef = useRef(false)
  const temEntrada = useRef(false) // a entrada que as boas-vindas colocam no histórico (pro voltar do Android)
  const popsAIgnorar = useRef(0)

  useEffect(() => {
    if (!isOpen) return
    IMAGENS.forEach(src => { const img = new Image(); img.src = src })
  }, [isOpen])

  const terminar = useCallback((configurar = false) => {
    tocarSom('sucesso')
    vibrarLeve()
    const alcancada = telaRef.current
    // não deixa pra trás a entrada do histórico
    if (temEntrada.current) { temEntrada.current = false; try { if (window.history.state?.bvTela) { popsAIgnorar.current++; window.history.back() } } catch { /* nada */ } }
    saindoRef.current = false
    setTela(0)
    setSaindo(false)
    onClose(alcancada, configurar)
  }, [onClose])

  const voltar = useCallback(() => {
    if (telaRef.current === 0) return
    vibrarLeve()
    setTela(t => Math.max(0, t - 1))
  }, [])

  const avancar = useCallback(() => {
    if (telaRef.current < TOTAL - 1) {
      tocarSom('click')
      vibrarLeve()
      setTela(t => Math.min(TOTAL - 1, t + 1))
      return
    }
    // última tela: some em 200ms e entra no app (antes esperava 1,2s o foguete subir)
    if (saindoRef.current) return
    saindoRef.current = true
    setSaindo(true)
    window.setTimeout(() => terminar(true), 200)
  }, [terminar])

  // Setas do teclado (computador)
  useEffect(() => {
    if (!isOpen) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') avancar()
      else if (e.key === 'ArrowLeft') voltar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [isOpen, avancar, voltar])

  // Voltar do Android: volta uma tela. Na primeira, o voltar segue o caminho normal do aparelho.
  useEffect(() => {
    if (!isOpen) return
    const aoVoltar = () => {
      if (popsAIgnorar.current > 0) { popsAIgnorar.current--; return }
      temEntrada.current = false
      if (telaRef.current > 0) { vibrarLeve(); setTela(t => Math.max(0, t - 1)) }
    }
    window.addEventListener('popstate', aoVoltar)
    return () => window.removeEventListener('popstate', aoVoltar)
  }, [isOpen])
  useEffect(() => {
    if (!isOpen) return
    if (tela > 0 && !temEntrada.current) {
      try { window.history.pushState({ ...(window.history.state || {}), bvTela: true }, ''); temEntrada.current = true } catch { /* sem histórico: segue sem o voltar */ }
    } else if (tela === 0 && temEntrada.current) {
      // voltou pra primeira tela pelo botão: tira a entrada
      temEntrada.current = false
      try { if (window.history.state?.bvTela) { popsAIgnorar.current++; window.history.back() } } catch { /* nada */ }
    }
  }, [isOpen, tela])

  if (!isOpen) return null

  const aoTocar = (e: TouchEvent) => { const t = e.touches[0]; toque.current = { x: t.clientX, y: t.clientY } }
  const aoSoltar = (e: TouchEvent) => {
    const ini = toque.current
    toque.current = null
    if (!ini) return
    const t = e.changedTouches[0]
    const dx = t.clientX - ini.x, dy = t.clientY - ini.y
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return // foi rolagem, não arrasto
    if (dx < 0 && tela < TOTAL - 1) avancar()
    if (dx > 0) voltar()
  }

  const ultima = tela === TOTAL - 1
  const marca = tela === 0 || ultima // telas sem demonstração: o mascote fica em cima do texto
  const textoBotao = tela === 0 ? 'Ver como funciona' : ultima ? 'Configurar minha confeitaria' : 'Próximo'

  return (
    <div className={`bv-root bv-tela-${tela}${saindo ? ' bv-root--saindo' : ''}`} role="dialog" aria-modal="true" aria-label="Boas-vindas ao Doonly" onTouchStart={aoTocar} onTouchEnd={aoSoltar}>
      <header className="bv-topo">
        <div className="bv-topo-lado">
          {tela > 0 && <BotaoIcone rotulo="Voltar" variante="claro" onClick={voltar}><ArrowLeft size={20} weight="bold" /></BotaoIcone>}
        </div>
        <div className="bv-passos" role="img" aria-label={`Passo ${tela + 1} de ${TOTAL}`}>
          {Array.from({ length: TOTAL }).map((_, i) => <span key={i} className={i === tela ? 'bv-passo bv-passo--atual' : i < tela ? 'bv-passo bv-passo--feito' : 'bv-passo'} />)}
        </div>
        <div className="bv-topo-lado bv-topo-lado--fim">
          {!ultima && <button type="button" className="bv-pular" onClick={() => terminar(false)}>Pular</button>}
        </div>
      </header>

      <div className={`bv-corpo${marca ? ' bv-corpo--marca' : ''}`}>
        <div className="bv-lado">
          <div className="bv-texto" key={`t${tela}`} aria-live="polite">
            {tela === 0 && (<>
              {/* o nome e o título são uma frase só: "Juliana, que bom ter você aqui" */}
              {nomeOk ? <><p className="bv-oi">{nomeOk},</p><h1 className="bv-h">que bom ter <em>você aqui</em></h1></> : <h1 className="bv-h">Que bom ter <em>você aqui</em></h1>}
              <p className="bv-p">A partir de agora, seus pedidos, seu cardápio e seu dinheiro ficam num lugar só. Vem ver como funciona, leva 1 minuto.</p>
            </>)}
            {tela === 1 && (<>
              <p className="bv-sobre">Seus produtos em destaque</p>
              <h1 className="bv-h">Um cardápio lindo que <em>já vende sozinho</em></h1>
              <p className="bv-p">Monte com sabores e adicionais e mande o link no WhatsApp.</p>
            </>)}
            {tela === 2 && (<>
              <p className="bv-sobre">Chega de informação espalhada</p>
              <h1 className="bv-h">Cada encomenda <em>no seu lugar</em></h1>
              <p className="bv-p">Veja o que entregar hoje, amanhã e na semana, com todos os detalhes.</p>
            </>)}
            {tela === 3 && (<>
              <p className="bv-sobre">Seu dinheiro sob controle</p>
              <h1 className="bv-h">Saiba quem pagou e <em>quem falta pagar</em></h1>
              <p className="bv-p">Sinais, parcelas e pagamentos pendentes de cada pedido, sem conta no caderno.</p>
            </>)}
            {tela === 4 && (<>
              <p className="bv-sobre">Dos ingredientes ao lucro</p>
              <h1 className="bv-h">Descubra quanto custa <em>produzir</em></h1>
              <p className="bv-p">Monte a ficha técnica e veja quanto sobra em cada venda.</p>
            </>)}
            {tela === 5 && (<>
              <p className="bv-sobre">Agora é com você</p>
              <h1 className="bv-h">Sua confeitaria <em>começa aqui</em></h1>
              <p className="bv-p">Em poucos passos seu cardápio fica no ar, pronto pra mandar pros seus clientes.</p>
            </>)}
          </div>
          <div className="bv-base">
            <Botao cheio className="bv-botao" onClick={avancar} carregando={saindo} iconeDepois={<CaretRight size={18} weight="bold" />}>{textoBotao}</Botao>
          </div>
        </div>

        <div className="bv-demo" key={`d${tela}`}>
          {tela === 0 && <DemoMarca comMarca={!nomeOk} />}
          {tela === 1 && <DemoCardapio />}
          {tela === 2 && <DemoPedidos />}
          {tela === 3 && <DemoDinheiro />}
          {tela === 4 && <DemoLucro />}
          {tela === 5 && <DemoMarca pose="comemorando" />}
        </div>
        <span className="bv-esp" aria-hidden="true" />
      </div>
    </div>
  )
}

/* ───────── 1 e 6 · o mascote (acenando na chegada, comemorando no fim) ───────── */
/* Na primeira tela, o nome da pessoa abre a frase do título (09/10 · 3.77). Nome vazio, de teste, brincadeira ou
   ofensivo não aparece (lib/nomeApresentavel): aí a marca do Doonly volta embaixo do mascote. */
function DemoMarca({ comMarca = false, pose = 'acenando' }: { comMarca?: boolean; pose?: 'acenando' | 'comemorando' }) {
  return (
    <div className="bv-marca">
      <Mascote pose={pose} className="bv-marca-masc" />
      {comMarca && <NomeDoonly cor="branco" className="bv-marca-nome" />}
    </div>
  )
}

/* ───────── 2 · cardápio: print real rolando sozinho dentro do celular ───────── */
function DemoCardapio() {
  const janela = useRef<HTMLDivElement>(null)
  const print = useRef<HTMLImageElement>(null)

  // O print sobe e desce sozinho, devagar. Quem move é o próprio navegador (animação de CSS), por isso não engasga.
  // (07/10 · 2.93) Saiu a rolagem com o dedo ou com a rodinha do mouse dentro do celular: ela brigava com a rolagem automática.
  useEffect(() => {
    const caixa = janela.current, img = print.current
    if (!caixa || !img) return
    const VELOCIDADE = 38 // px por segundo
    const medir = () => {
      const distancia = Math.max(0, img.offsetHeight - caixa.clientHeight)
      img.style.setProperty('--bv-distancia', `${-distancia}px`)
      // 12% do tempo fica parado nas pontas (6% em cada), o resto anda na velocidade certa
      img.style.setProperty('--bv-tempo', `${Math.max(4, distancia / VELOCIDADE / 0.88).toFixed(2)}s`)
    }
    medir()
    img.addEventListener('load', medir)
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    obs?.observe(caixa)
    return () => { img.removeEventListener('load', medir); obs?.disconnect() }
  }, [])

  return (
    <div className="bv-cel">
      <div className="bv-cel-entalhe" />
      <div className="bv-cel-tela">
        <div className="bv-cel-rolo" ref={janela}>
          <img ref={print} className="bv-cel-print" src="/tutorial/cardapio-exemplo.jpg" alt="Cardápio online de uma confeitaria feito no Doonly" />
        </div>
        <img className="bv-cel-menu" src="/tutorial/cardapio-exemplo-nav.jpg" alt="" aria-hidden="true" />
      </div>
    </div>
  )
}

/* As demonstrações 3, 4 e 5 copiam as telas reais (09/10 · 3.68): o cartão de Pedidos, o "A receber" do
   Financeiro e o resumo da Ficha técnica. Quem abre o app depois reconhece o que viu aqui. */
const isoDia = (soma: number) => { const d = new Date(); d.setDate(d.getDate() + soma); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const item = (nome: string, img: string, qtd = 1, valor = 0) => ({ nome_produto: nome, quantidade: qtd, valor_unitario: valor, imagem_url: img })
const pedidoExemplo = (x: Partial<Pedido> & { pedido_itens: any[] }): Pedido => ({
  id: String(x.numero), numero: 0, cliente_nome: '', cliente_telefone: '', status: 'agendado', status_pagamento: 'pendente', prioridade: '',
  data_entrega: isoDia(0), horario_entrega: '', valor_total: 0, valor_recebido: 0, tipo_entrega: 'retirada', forma_pagamento: 'pix',
  etiquetas: [], origem: 'manual', created_at: new Date().toISOString(), ...x,
} as Pedido)
const nada = () => {}

/* ───────── 3 · pedidos (09/10 · 3.80): os pedidos vão chegando pelo cardápio, já pagos no Pix, cada um com o som de pedido,
   e o mais novo entra em cima (como na lista de Pedidos). Os cartões só aparecem, não se abrem; o botão de cada um
   segue o fluxo do app. As datas andam com o dia de hoje (entregas daqui a 3 a 5 dias). ───────── */
const TEL_SUPORTE = '11978414991'
// na ordem em que chegam: o último é o do bolo, que fica em cima
const CHEGADAS: { p: Pedido }[] = [
  { p: pedidoExemplo({ numero: 1049, cliente_nome: 'Marina Silva', cliente_telefone: TEL_SUPORTE, status: 'aguardando_aceite', status_pagamento: 'pago', forma_pagamento: 'pix', origem: 'cardapio', data_entrega: isoDia(5), horario_entrega: '16:30', valor_total: 650,
      pedido_itens: [item('Kit festa 30 pessoas', PRODUTO.kit, 1, 650)] }) },
  { p: pedidoExemplo({ numero: 1050, cliente_nome: 'Juliana Souza', cliente_telefone: TEL_SUPORTE, status: 'aguardando_aceite', status_pagamento: 'pago', forma_pagamento: 'pix', origem: 'cardapio', data_entrega: isoDia(4), horario_entrega: '09:00', valor_total: 90,
      pedido_itens: [item('1 cento de salgados mistos', PRODUTO.salgados, 1, 90)] }) },
  { p: pedidoExemplo({ numero: 1051, cliente_nome: 'Camila Rocha', cliente_telefone: TEL_SUPORTE, status: 'aguardando_aceite', status_pagamento: 'pago', forma_pagamento: 'pix', origem: 'cardapio', data_entrega: isoDia(3), horario_entrega: '14:00', valor_total: 320,
      pedido_itens: [item('Bolo de aniversário 2 kg', PRODUTO.bolo, 1, 320)] }) },
]
const INTERVALO_CHEGADA = 1500

function DemoPedidos() {
  const [chegaram, setChegaram] = useState(0)
  const [status, setStatus] = useState<Record<string, string>>({})
  useEffect(() => {
    const ts = CHEGADAS.map((_, i) => window.setTimeout(() => { tocarSom('pedido'); vibrarLeve(); setChegaram(i + 1) }, 700 + i * INTERVALO_CHEGADA))
    return () => ts.forEach(t => clearTimeout(t))
  }, [])
  const comStatus = (p: Pedido) => ({ ...p, status: status[p.id] || p.status })
  // o botão do cartão faz o mesmo que no app: Aceitar → Produzir → Pronto → Pronto pra retirar → Entregue
  const avancar = (p: Pedido) => {
    const prox = acaoDe(p)?.proximo
    if (!prox) return
    tocarSom(prox === 'entregue' ? 'sucesso' : 'click'); vibrarLeve()
    setStatus(s => ({ ...s, [p.id]: prox }))
  }
  const lista = CHEGADAS.slice(0, chegaram).reverse() // o mais novo em cima

  // Celular: os 3 cartões precisam caber inteiros entre o título e o botão. Mede o primeiro cartão que chegou,
  // calcula a altura dos 3 juntos e encolhe a lista (só o necessário) pra caber na tela de qualquer aparelho.
  const caixa = useRef<HTMLDivElement>(null)
  const [encaixe, setEncaixe] = useState<{ escala: number; altura: number } | null>(null)
  useLayoutEffect(() => {
    const medir = () => {
      const el = caixa.current
      const cartao = el?.querySelector('.pdc') as HTMLElement | null
      if (!el || !cartao || !el.offsetParent) return // no computador a lista do celular fica escondida
      const alturaFinal = (cartao.offsetHeight + 10) * CHEGADAS.length
      const base = (document.querySelector('.bv-base') as HTMLElement | null)?.offsetHeight || 96
      const sobra = window.innerHeight - el.getBoundingClientRect().top - base + 6
      const escala = Math.max(.6, Math.min(1, sobra / alturaFinal))
      setEncaixe({ escala, altura: alturaFinal * escala })
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [chegaram > 0])
  return (
    <>
      {/* celular e tablet: os cartões da lista de Pedidos */}
      <div className="bv-ped">
        {chegaram > 0 && <div className="bv-aviso" key={`a${chegaram}`}><Bell size={14} weight="fill" aria-hidden="true" /><span><b>Novo pedido</b> pelo cardápio</span></div>}
        <div className="bv-ped-lista" ref={caixa} style={encaixe ? { height: encaixe.altura } : undefined}>
          <div className="bv-ped-escala" style={encaixe && encaixe.escala < 1 ? { transform: `scale(${encaixe.escala})` } : undefined}>
          {lista.map(({ p }) => {
            const atual = comStatus(p)
            return (
              <div key={p.id} className={`bv-ped-entra${atual.status === 'aguardando_aceite' ? ' bv-ped--novo' : ''}`}>
                <div>
                  <CartaoPedido p={atual} aoAbrir={nada} aoAvancar={avancar} aoMenu={nada} aoEndereco={nada} />
                </div>
              </div>
            )
          })}
          </div>
        </div>
      </div>

      {/* computador: a tela de Pedidos do computador dentro de um notebook (09/10 · 3.75) */}
      <Notebook>
        <div className="bv-app">
          <aside className="bv-app-menu" aria-hidden="true">
            <div className="bv-app-perfil"><span>D</span><b>Olá, Doces da Ju</b></div>
            {MENU_PC.map(([Icone, nome]) => <p key={nome} className={nome === 'Pedidos' ? 'on' : ''}><Icone size={18} />{nome}</p>)}
          </aside>
          <div className="bv-app-main">
            <header className="bv-app-topo"><b>Meus pedidos</b><small>Acompanhe suas encomendas e produção</small></header>
            <div className="bv-app-corpo">
              {chegaram > 0 && <div className="bv-aviso bv-aviso--pc" key={`b${chegaram}`}><Bell size={14} weight="fill" aria-hidden="true" /><span><b>Novo pedido</b> pelo cardápio</span></div>}
              <div className="pdl-cab" aria-hidden="true"><span>Cliente e pedido</span><span>Situação</span><span>Pagamento</span><span>Entrega</span><span /><span /></div>
              <p className="bv-app-grupo">Esta semana{chegaram > 0 && <i>{chegaram}</i>}</p>
              {lista.length > 0 && (
                <div className="pdl-tabela">
                  {lista.map(({ p }) => {
                    const atual = comStatus(p)
                    return <div key={p.id} className={`bv-ped-entra${atual.status === 'aguardando_aceite' ? ' bv-ped--novo' : ''}`}><div><LinhaPedido p={atual} aoAbrir={nada} aoAvancar={avancar} aoMenu={nada} aoEndereco={nada} comDia /></div></div>
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </Notebook>
    </>
  )
}

const MENU_PC: [typeof House, string][] = [[House, 'Início'], [Plus, 'Nova Venda'], [FolderSimple, 'Cadastros'], [ShoppingBag, 'Cardápio Digital'], [Receipt, 'Pedidos'], [CalendarDots, 'Agenda'], [BookOpen, 'Receitas'], [CurrencyDollar, 'Financeiro'], [Gear, 'Configurações']]

/** Moldura de notebook: a tela do app é desenhada em 1040 x 650 e encolhe pra caber */
function Notebook({ children }: { children: ReactNode }) {
  const tela = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(.6)
  useEffect(() => {
    const el = tela.current
    if (!el) return
    const medir = () => { if (el.clientWidth) setEscala(el.clientWidth / 1040) }
    medir()
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    obs?.observe(el)
    return () => obs?.disconnect()
  }, [])
  return (
    <div className="bv-nb">
      <div className="bv-nb-tampa">
        <span className="bv-nb-cam" aria-hidden="true" />
        <div className="bv-nb-tela" ref={tela}>
          <div className="bv-nb-app" style={{ transform: `scale(${escala})` }}>{children}</div>
        </div>
      </div>
      <div className="bv-nb-base" aria-hidden="true"><i /></div>
    </div>
  )
}

/* ───────── 4 · dinheiro (09/10 · 3.85): quem pagou e quem falta pagar, num cartão só e sem conta pra fazer.
   Em cima, quanto falta receber na semana; embaixo, cada cliente com o que já pagou e o que falta. Só pra ver (sem toque). ───────── */
const RECEBER: { id: string; cliente: string; total: number; recebido: number; conta: string; alerta?: boolean }[] = [
  { id: 'camila', cliente: 'Camila Rocha', total: 320, recebido: 320, conta: 'Pagou tudo no Pix' },
  { id: 'carla', cliente: 'Carla Menezes', total: 180.5, recebido: 90, conta: 'Pagou o sinal' },
  { id: 'fernanda', cliente: 'Fernanda Lima', total: 260, recebido: 130, conta: 'Pagou metade' },
  { id: 'paula', cliente: 'Paula Ribeiro', total: 95, recebido: 0, conta: 'Não pagou · entrega amanhã', alerta: true },
]
const reais = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const iniciais = (nome: string) => nome.split(' ').map(p => p[0]).slice(0, 2).join('')

function DemoDinheiro() {
  const falta = RECEBER.reduce((s, r) => s + r.total - r.recebido, 0)
  const faltam = RECEBER.filter(r => r.recebido < r.total).length
  return (
    <div className="bv-din bv-cai" aria-hidden="true">
      <div className="bv-din-topo">
        <small>Falta receber esta semana</small>
        <b>R$ {reais(falta)}</b>
        <span>{faltam} clientes</span>
      </div>
      <ul className="bv-din-lista">
        {RECEBER.map(r => {
          const ok = r.recebido >= r.total
          return (
            <li key={r.id} className={ok ? 'ok' : r.alerta ? 'alerta' : ''}>
              <span className="bv-din-av">{iniciais(r.cliente)}<img src={fotoCliente(r.id)} alt="" onError={e => { e.currentTarget.style.display = 'none' }} /></span>
              <div className="bv-din-tx">
                <b>{r.cliente}</b>
                <small>{r.conta}</small>
              </div>
              {ok
                ? <span className="bv-din-ok"><Check size={14} weight="bold" />Pago</span>
                : <span className="bv-din-falta">falta<b>R$ {reais(r.total - r.recebido)}</b></span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ───────── 5 · custos: o resumo da Ficha técnica, montando a conta linha por linha ───────── */
const CONTA = [
  { rotulo: 'Ingredientes', valor: 3.45, cor: 'var(--ui-rosa)' },
  { rotulo: 'Custos invisíveis (25%)', valor: 0.86, cor: '#F59E0B' },
  { rotulo: 'Mão de obra (15 min)', valor: 2.1, cor: 'var(--ui-vinho)' },
]
const PRECO = 15
const CUSTO = CONTA.reduce((s, c) => s + c.valor, 0)
const LUCRO = PRECO - CUSTO

function DemoLucro() {
  const [linhas, setLinhas] = useState(0)
  const [pronto, setPronto] = useState(false)
  const [lucro, setLucro] = useState(0)
  useEffect(() => {
    const ts: number[] = []
    for (let i = 1; i <= CONTA.length + 2; i++) ts.push(window.setTimeout(() => setLinhas(i), 500 + i * 450))
    const fim = 500 + (CONTA.length + 2) * 450 + 300
    ts.push(window.setTimeout(() => setPronto(true), fim))
    // o lucro sobe contando, como quem faz a conta
    for (let k = 1; k <= 20; k++) ts.push(window.setTimeout(() => setLucro(LUCRO * k / 20), fim + k * 35))
    return () => ts.forEach(t => clearTimeout(t))
  }, [])
  const pc = (v: number) => `${(v / PRECO) * 100}%`
  const margem = pronto ? (lucro / PRECO) * 100 : 0
  return (
    <div className="bv-luc" aria-hidden="true">
      <div className="bv-luc-topo">
        <span className="bv-luc-foto"><img src={PRODUTO.caixa} alt="" /></span>
        <div className="bv-luc-lucro">
          <small>Seu lucro</small>
          <b>R$ {reais(lucro)}</b>
          <span>{margem.toFixed(0)}% de margem</span>
        </div>
      </div>
      <div className="bv-luc-barra">
        {CONTA.map((c, i) => <i key={c.rotulo} style={{ width: linhas > i ? pc(c.valor) : 0, background: c.cor }} />)}
        <i style={{ width: pronto ? pc(LUCRO) : 0, background: 'var(--ui-verde)' }} />
      </div>
      <div className="bv-luc-leg">
        <span style={{ '--c': 'var(--ui-rosa)' } as CSSProperties}>Ingredientes</span>
        <span style={{ '--c': '#F59E0B' } as CSSProperties}>Invisíveis</span>
        <span style={{ '--c': 'var(--ui-vinho)' } as CSSProperties}>Mão de obra</span>
        <span style={{ '--c': 'var(--ui-verde)' } as CSSProperties}>Lucro</span>
      </div>
      <div className="bv-luc-conta">
        {CONTA.map((c, i) => <div key={c.rotulo} className={linhas > i ? 'v' : ''}><span>{c.rotulo}</span><span>R$ {reais(c.valor)}</span></div>)}
        <div className={`bv-luc-t${linhas > CONTA.length ? ' v' : ''}`}><span>Custo total</span><span>R$ {reais(CUSTO)}</span></div>
        <div className={`bv-luc-pv${linhas > CONTA.length + 1 ? ' v' : ''}`}><span>Preço de venda</span><span>R$ {reais(PRECO)}</span></div>
      </div>
    </div>
  )
}

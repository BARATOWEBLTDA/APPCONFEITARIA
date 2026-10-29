import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, TouchEvent } from 'react'
import { ArrowLeft, ArrowSquareOut, Bell, CalendarBlank, CheckCircle, ClipboardText, CalendarDots, Check, CaretRight, CurrencyDollar, Gear, House, Package, Plus, Receipt, ShoppingBag, Sparkle, Users, Wallet } from '@phosphor-icons/react'
import { Botao, BotaoIcone } from '@/components/base'
import { Mascote, NomeDoonly } from '@/components/marca/Mascote'
import { CartaoPedido, LinhaPedido } from '@/components/pedidos/CartaoPedido'
import { acaoDe, type Pedido } from '@/components/pedidos/pedidoTexto'
import '@/components/pedidos/pedidos.css'
import { tocarSom } from '@/hooks/useSom'
import { nomeApresentavel } from '@/lib/nomeApresentavel'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { precisaInstalarNoIphone } from '@/lib/notifications'
import '@/components/financeiro/folha.css'
import { CSS_A_RECEBER } from '@/components/financeiro/aReceberCss'
import './boasVindas.css'

/**
 * Boas-vindas (refeita em 07/10 no desenho do login) — a apresentação que aparece logo depois de criar a conta.
 * (09/10 · 3.68) As demonstrações de pedidos, dinheiro e custos copiam as telas reais do app.
 * 7 telas: Boas-vindas · Cardápio · Pedidos · Dinheiro · Custos · Avisos (23/10) · Primeiro passo.
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

const TOTAL = 7
/** (23/10) a tela que pede pra ligar os avisos do celular (pedido novo e novidades chegam na hora) */
const AVISOS = 5

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
  kit: '/tutorial/boas-vindas/produtos/kit-festa.webp',
  salgados: '/tutorial/boas-vindas/produtos/salgados-mistos.webp',
}

// Só as imagens que as telas usam
const IMAGENS = ['/tutorial/cardapio-exemplo.jpg?v=3', '/tutorial/cardapio-exemplo-nav.jpg?v=3', ...Object.values(PRODUTO)]

export default function BoasVindas({ isOpen, onClose, nome }: Props) {
  const [tela, setTela] = useState(0)
  // (23/10) avisos do celular: já pede aqui, na primeira entrada (quem negar vê o pedido de novo no Pra fazer do Início)
  const push = usePushSubscription()
  const iphoneSemApp = precisaInstalarNoIphone()
  const podeAtivar = !iphoneSemApp && push.isSupported && !push.isSubscribed && push.permission !== 'denied'
  const podeAtivarRef = useRef(podeAtivar)
  podeAtivarRef.current = podeAtivar
  const ativarRef = useRef(async () => {})
  ativarRef.current = async () => { const ok = await push.subscribe(); if (ok) tocarSom('sucesso') }
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
    if (telaRef.current === AVISOS && podeAtivarRef.current) {
      // o toque no botão pede a permissão do aparelho (precisa sair direto do toque); ativando ou não, segue
      void ativarRef.current().finally(() => setTela(t => Math.min(TOTAL - 1, t + 1)))
      return
    }
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
  const textoBotao = tela === 0 ? 'Ver como funciona' : ultima ? 'Configurar minha confeitaria' : tela === AVISOS && podeAtivar ? 'Ativar avisos' : 'Próximo'

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
              <p className="bv-p">A partir de agora, seus pedidos, seu cardápio e seu dinheiro ficam em um lugar só. Vem ver como funciona, leva 1 minuto.</p>
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
            {tela === AVISOS && (<>
              <p className="bv-sobre">Não perca nenhum pedido</p>
              <h1 className="bv-h">Ative os <em>avisos</em> no seu celular</h1>
              <p className="bv-p">{push.isSubscribed ? 'Pronto: os avisos estão ativados neste aparelho.'
                : iphoneSemApp ? 'No iPhone, os avisos funcionam com o Doonly instalado na tela de início. No app, mostramos como fazer.'
                : push.permission === 'denied' ? 'Os avisos estão bloqueados neste navegador. Você pode liberar depois, em Configurações.'
                : 'Quando um cliente fizer um pedido pelo cardápio, o aviso chega na hora, mesmo com o app fechado. Novidades e dicas do Doonly também.'}</p>
            </>)}
            {tela === 6 && (<>
              <p className="bv-sobre">Agora é com você</p>
              {/* fecha com o nome, como abriu (sem nome válido, fica só "Sua confeitaria começa aqui") */}
              <h1 className="bv-h">{nomeOk ? <>{nomeOk}, sua confeitaria <em>começa aqui</em></> : <>Sua confeitaria <em>começa aqui</em></>}</h1>
              <p className="bv-p">São poucos passos rápidos para deixar seu cardápio no ar, pronto para mandar no WhatsApp.</p>
            </>)}
          </div>
          <div className="bv-base">
            <Botao cheio className="bv-botao" onClick={avancar} carregando={saindo || (tela === AVISOS && push.loading)} iconeDepois={<CaretRight size={18} weight="bold" />}>{textoBotao}</Botao>
            {tela === AVISOS && podeAtivar && <button type="button" className="bv-agora-nao" onClick={() => { vibrarLeve(); setTela(t => Math.min(TOTAL - 1, t + 1)) }}>Agora não</button>}
          </div>
        </div>

        <div className="bv-demo" key={`d${tela}`}>
          {tela === 0 && <DemoMarca comMarca={!nomeOk} />}
          {tela === 1 && <DemoCardapio />}
          {tela === 2 && <DemoPedidos />}
          {tela === 3 && <DemoDinheiro />}
          {tela === 4 && <DemoLucro />}
          {tela === AVISOS && <DemoAviso />}
          {tela === 6 && <DemoMarca pose="comemorando" />}
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

/* ───────── 6 · avisos: o aviso de pedido novo chegando na tela do celular ───────── */
function DemoAviso() {
  return (
    <div className="bv-notif" aria-hidden="true">
      <div className="bv-notif-hora"><b>09:41</b><span>sexta-feira, 24 de outubro</span></div>
      <div className="bv-notif-cartao">
        <div className="bv-notif-cab"><img src="/Sistema/icon-192.png" alt="" /><span>Doonly</span><em>agora</em></div>
        <div className="bv-notif-corpo">
          <div><b>Novo pedido</b><p>Juliana fez um pedido de R$ 120,00. Toque para ver.</p></div>
          <img src={PRODUTO.bolo} alt="" />
        </div>
      </div>
      <div className="bv-notif-cartao bv-notif-cartao--2">
        <div className="bv-notif-cab"><img src="/Sistema/icon-192.png" alt="" /><span>Doonly</span><em>1 h</em></div>
        <div className="bv-notif-corpo"><div><b>Pix recebido</b><p>Sinal de R$ 60,00 do pedido #128.</p></div></div>
      </div>
    </div>
  )
}

/* ───────── 2 · cardápio: print real rolando sozinho ───────── */
/* (13/10) No computador: o notebook com o cardápio do computador e o celular na frente, em diagonal (os 2 jeitos que o
   cliente vê). No celular: só o celular, levemente inclinado. */

/** O print sobe e desce sozinho, devagar. Quem move é o próprio navegador (animação de CSS), por isso não engasga. */
function PrintRolando({ src, alt = '', menu, velocidade = 38 }: { src: string; alt?: string; menu?: string; velocidade?: number }) {
  const janela = useRef<HTMLDivElement>(null)
  const print = useRef<HTMLImageElement>(null)
  // (07/10 · 2.93) Sem rolagem com o dedo ou com a rodinha do mouse: ela brigava com a rolagem automática.
  useEffect(() => {
    const caixa = janela.current, img = print.current
    if (!caixa || !img) return
    const medir = () => {
      const distancia = Math.max(0, img.offsetHeight - caixa.clientHeight)
      img.style.setProperty('--bv-distancia', `${-distancia}px`)
      // 12% do tempo fica parado nas pontas (6% em cada), o resto anda na velocidade certa
      img.style.setProperty('--bv-tempo', `${Math.max(4, distancia / velocidade / 0.88).toFixed(2)}s`)
    }
    medir()
    img.addEventListener('load', medir)
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    obs?.observe(caixa)
    return () => { img.removeEventListener('load', medir); obs?.disconnect() }
  }, [velocidade])
  return (
    <>
      <div className="bv-cel-rolo" ref={janela}>
        <img ref={print} className="bv-cel-print" src={src} alt={alt} />
      </div>
      {menu && <img className="bv-cel-menu" src={menu} alt="" aria-hidden="true" />}
    </>
  )
}

function Celular({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bv-cel${className ? ' ' + className : ''}`}>
      <div className="bv-cel-entalhe" />
      <div className="bv-cel-tela">{children}</div>
    </div>
  )
}

/** Desenha o conteúdo numa largura fixa e encolhe pra caber (a tela do celular pequeno do computador) */
function Encolhe({ largura, children }: { largura: number; children: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(.4)
  useEffect(() => {
    const el = caixa.current
    if (!el) return
    const medir = () => { if (el.clientWidth) setEscala(el.clientWidth / largura) }
    medir()
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    obs?.observe(el)
    return () => obs?.disconnect()
  }, [largura])
  return (
    <div className="bv-encolhe" ref={caixa}>
      <div style={{ width: largura, height: `${100 / escala}%`, transform: `scale(${escala})`, transformOrigin: '0 0' }}>{children}</div>
    </div>
  )
}

const PRINT_CEL = '/tutorial/cardapio-exemplo.jpg?v=3'
const PRINT_CEL_MENU = '/tutorial/cardapio-exemplo-nav.jpg?v=3'
const PRINT_PC = '/tutorial/cardapio-exemplo-pc.jpg?v=3'

function DemoCardapio() {
  return (
    <>
      <div className="bv-so-cel bv-incl">
        <Celular><PrintRolando src={PRINT_CEL} menu={PRINT_CEL_MENU} alt="Cardápio online de uma confeitaria feito no Doonly" /></Celular>
      </div>
      <div className="bv-dup-wrap" aria-hidden="true">
        <div className="bv-dup">
          {/* (15/10) no notebook a tela cabe inteira (promoções e o banner): sem rolar */}
          <Notebook><img className="bv-pc-print" src={PRINT_PC} alt="" /></Notebook>
          <Celular className="bv-cel--mini"><PrintRolando src={PRINT_CEL} menu={PRINT_CEL_MENU} /></Celular>
        </div>
      </div>
    </>
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

/* ───────── 3 · pedidos ───────── */
/* (13/10) A lista já começa com a semana andando (pedidos em produção, pronto, entregue) e só chegam 2 pedidos novos
   pelo cardápio, um de cada vez (o som toca 2 vezes, não a cada segundo). No computador: notebook e celular juntos,
   e o aviso "Novo pedido" num balão do lado de fora. Os cartões só aparecem, não se abrem; o botão de cada um
   segue o fluxo do app. As datas andam com o dia de hoje. */
const TEL_SUPORTE = '11978414991'
const JA_TINHA: Pedido[] = [
  pedidoExemplo({ numero: 1048, cliente_nome: 'Fernanda Lima', cliente_telefone: TEL_SUPORTE, status: 'em_producao', status_pagamento: 'parcial', forma_pagamento: 'pix', data_entrega: isoDia(1), horario_entrega: '10:00', valor_total: 260, valor_recebido: 130,
    pedido_itens: [item('Bolo de aniversário 3 kg', PRODUTO.bolo, 1, 260)] }),
  pedidoExemplo({ numero: 1047, cliente_nome: 'Paula Ribeiro', cliente_telefone: TEL_SUPORTE, status: 'aguardando_retirada', status_pagamento: 'pago', forma_pagamento: 'pix', data_entrega: isoDia(0), horario_entrega: '17:00', valor_total: 95, valor_recebido: 95,
    pedido_itens: [item('Meio cento de salgados', PRODUTO.salgados, 1, 95)] }),
  pedidoExemplo({ numero: 1046, cliente_nome: 'Marina Silva', cliente_telefone: TEL_SUPORTE, status: 'agendado', status_pagamento: 'pago', forma_pagamento: 'cartao', origem: 'cardapio', data_entrega: isoDia(5), horario_entrega: '16:30', valor_total: 650, valor_recebido: 650,
    pedido_itens: [item('Kit festa 30 pessoas', PRODUTO.kit, 1, 650)] }),
  pedidoExemplo({ numero: 1045, cliente_nome: 'Carla Menezes', cliente_telefone: TEL_SUPORTE, status: 'entregue', status_pagamento: 'pago', forma_pagamento: 'dinheiro', data_entrega: isoDia(-1), horario_entrega: '15:00', valor_total: 180.5, valor_recebido: 180.5,
    pedido_itens: [item('Bolo de aniversário 2 kg', PRODUTO.bolo, 1, 180.5)] }),
]
// os que chegam pelo cardápio, na ordem (o mais novo entra em cima)
const CHEGADAS: { p: Pedido; em: number }[] = [
  { em: 1400, p: pedidoExemplo({ numero: 1049, cliente_nome: 'Camila Rocha', cliente_telefone: TEL_SUPORTE, status: 'aguardando_aceite', status_pagamento: 'pago', forma_pagamento: 'pix', origem: 'cardapio', data_entrega: isoDia(3), horario_entrega: '14:00', valor_total: 150, valor_recebido: 150,
      pedido_itens: [item('Bolo de aniversário 2 kg', PRODUTO.bolo, 1, 150)] }) },
  { em: 7400, p: pedidoExemplo({ numero: 1050, cliente_nome: 'Juliana Souza', cliente_telefone: TEL_SUPORTE, status: 'aguardando_aceite', status_pagamento: 'pago', forma_pagamento: 'pix', origem: 'cardapio', data_entrega: isoDia(4), horario_entrega: '09:00', valor_total: 90, valor_recebido: 90,
      pedido_itens: [item('1 cento de salgados mistos', PRODUTO.salgados, 1, 90)] }) },
]
const NO_CELULAR = 3 // quantos cartões cabem na tela do celular

function DemoPedidos() {
  const [chegaram, setChegaram] = useState(0)
  const [status, setStatus] = useState<Record<string, string>>({})
  useEffect(() => {
    const ts = CHEGADAS.map((c, i) => window.setTimeout(() => { tocarSom('pedido'); vibrarLeve(); setChegaram(i + 1) }, c.em))
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
  const novos = CHEGADAS.slice(0, chegaram).map(c => c.p).reverse() // o mais novo em cima
  const lista = [...novos, ...JA_TINHA]
  const ehNovo = (p: Pedido) => novos.some(n => n.id === p.id)

  // Celular: os cartões precisam caber inteiros entre o título e o botão. Mede o primeiro cartão,
  // calcula a altura dos que cabem e encolhe a lista (só o necessário) pra caber na tela de qualquer aparelho.
  const caixa = useRef<HTMLDivElement>(null)
  const [encaixe, setEncaixe] = useState<{ escala: number; altura: number } | null>(null)
  useLayoutEffect(() => {
    const medir = () => {
      const el = caixa.current
      const cartao = el?.querySelector('.pdc') as HTMLElement | null
      if (!el || !cartao || !el.offsetParent) return // no computador a lista do celular fica escondida
      const alturaFinal = (cartao.offsetHeight + 10) * NO_CELULAR
      const base = (document.querySelector('.bv-base') as HTMLElement | null)?.offsetHeight || 96
      const sobra = window.innerHeight - el.getBoundingClientRect().top - base + 6
      const escala = Math.max(.6, Math.min(1, sobra / alturaFinal))
      setEncaixe({ escala, altura: alturaFinal * escala })
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])
  const cartoes = (qtd: number, comSombra = true) => lista.slice(0, qtd).map(p => {
    const atual = comStatus(p)
    const novo = ehNovo(p)
    return (
      <div key={p.id} className={`bv-ped-entra${novo ? '' : ' bv-ped-fixo'}${atual.status === 'aguardando_aceite' ? ' bv-ped--novo' : ''}${comSombra ? '' : ' bv-ped-liso'}`}>
        <div><CartaoPedido p={atual} aoAbrir={nada} aoAvancar={avancar} aoMenu={nada} aoEndereco={nada} /></div>
      </div>
    )
  })
  const aviso = (cls: string) => chegaram > 0 && <div className={cls} key={`a${chegaram}`}><Bell size={14} weight="fill" aria-hidden="true" /><span><b>Novo pedido</b> pelo cardápio</span></div>
  return (
    <>
      {/* celular e tablet: os cartões da lista de Pedidos */}
      <div className="bv-ped">
        {aviso('bv-aviso')}
        <div className="bv-ped-lista" ref={caixa} style={encaixe ? { height: encaixe.altura } : undefined}>
          <div className="bv-ped-escala" style={encaixe && encaixe.escala < 1 ? { transform: `scale(${encaixe.escala})` } : undefined}>
            {cartoes(NO_CELULAR)}
          </div>
        </div>
      </div>

      {/* computador: a tela de Pedidos do computador no notebook e a do celular na frente */}
      <div className="bv-dup-wrap">
        {aviso('bv-balao')}
        <div className="bv-dup">
          <Notebook>
            <div className="bv-app">
              <aside className="bv-app-menu" aria-hidden="true">
                <div className="bv-app-perfil"><span><img src="/tutorial/boas-vindas/doce-formiga.webp" alt="" /></span><b>Olá, Doce Formiga</b></div>
                {MENU_PC.map(([Icone, nome]) => <p key={nome} className={nome === 'Pedidos' ? 'on' : ''}><Icone size={18} />{nome}</p>)}
              </aside>
              <div className="bv-app-main">
                <header className="bv-app-topo"><b>Meus pedidos</b><small>Acompanhe suas encomendas e produção</small></header>
                <div className="bv-app-corpo">
                  <p className="bv-app-grupo">Esta semana<i>{lista.length}</i></p>
                  <div className="pdl-tabela">
                    {lista.map(p => {
                      const atual = comStatus(p)
                      return <div key={p.id} className={`bv-ped-entra${ehNovo(p) ? '' : ' bv-ped-fixo'}${atual.status === 'aguardando_aceite' ? ' bv-ped--novo' : ''}`}><div><LinhaPedido p={atual} aoAbrir={nada} aoAvancar={avancar} aoMenu={nada} aoEndereco={nada} comDia /></div></div>
                    })}
                  </div>
                </div>
              </div>
            </div>
          </Notebook>
          <Celular className="bv-cel--mini">
            <Encolhe largura={360}>
              <div className="bv-cel-app">
                <header><b>Pedidos</b></header>
                <div className="bv-cel-app-lista">{cartoes(4, false)}</div>
              </div>
            </Encolhe>
          </Celular>
        </div>
      </div>
    </>
  )
}

// 13/10: o mesmo menu do app de hoje (antes tinha "Cadastros", que saiu)
const MENU_PC: [typeof House, string][] = [[House, 'Início'], [Plus, 'Nova venda'], [ShoppingBag, 'Cardápio digital'], [Receipt, 'Pedidos'], [CalendarDots, 'Agenda'], [Users, 'Clientes'], [Package, 'Ingredientes'], [ClipboardText, 'Ficha técnica'], [CurrencyDollar, 'Financeiro'], [Sparkle, 'Doo IA'], [Gear, 'Configurações']]

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

/* ───────── 4 · dinheiro (29/10 · 4.65): a tela "A receber" de verdade (os 3 quadrinhos e os cartões, com o visual
   do app) e uma animação que roda uma vez: o dedo toca em Receber no pedido da Paula, sobe a janela do app já com
   o valor e o Pix, o dedo confirma, o cartão fica verde com "Quitado", sai da lista e o "Em 7 dias" desce.
   É só pra ver (sem toque). A caixa tem tamanho fixo e encolhe inteira pra caber em qualquer tela. ───────── */
type ItemDemo = { id: string; numero: number; cliente: string; total: number; recebido: number; dias: number }
const RECEBER: ItemDemo[] = [
  { id: 'paula', numero: 1047, cliente: 'Paula Ribeiro', total: 95, recebido: 0, dias: 1 },
  { id: 'carla', numero: 1045, cliente: 'Carla Menezes', total: 180.5, recebido: 90, dias: 2 },
  { id: 'fernanda', numero: 1048, cliente: 'Fernanda Lima', total: 260, recebido: 130, dias: 4 },
]
const reais = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const brlDemo = (n: number) => `R$ ${reais(n)}`
const quandoDemo = (d: number) => d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`
const entregaDemo = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '') }
const REC_LARGURA = 384, REC_ALTURA = 580
// os passos da animação (em milissegundos desde que a tela abriu)
const REC_TEMPOS = { dedo: 1500, toca: 2100, janela: 2350, dedo2: 3700, confirma: 4250, quitado: 4500, sai: 6000, fim: 7400 }

function DemoDinheiro() {
  const [passo, setPasso] = useState<keyof typeof REC_TEMPOS | 'inicio'>('inicio')
  const [semana, setSemana] = useState(RECEBER.reduce((s, r) => s + r.total - r.recebido, 0))
  const caixa = useRef<HTMLDivElement>(null)
  const palco = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)
  const escalaRef = useRef(1)
  const [dedo, setDedo] = useState<{ x: number; y: number } | null>(null)

  // encolhe a caixa inteira pra caber no espaço que sobrou (nunca passa de 1,15x)
  useLayoutEffect(() => {
    const el = caixa.current
    if (!el) return
    const medir = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (w && h) { const e = Math.min(1.15, w / REC_LARGURA, h / REC_ALTURA); escalaRef.current = e; setEscala(e) }
    }
    medir()
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    obs?.observe(el)
    return () => obs?.disconnect()
  }, [])

  // o dedo vai até um botão (a posição é medida dentro da caixa, sem a escala)
  const apontar = (seletor: string) => {
    const p = palco.current, alvo = p?.querySelector(seletor) as HTMLElement | null
    if (!p || !alvo) return
    const a = alvo.getBoundingClientRect(), b = p.getBoundingClientRect()
    const e = escalaRef.current || 1
    setDedo({ x: (a.left - b.left + a.width / 2) / e, y: (a.top - b.top + a.height / 2) / e })
  }

  useEffect(() => {
    const ts: number[] = []
    const em = (ms: number, f: () => void) => ts.push(window.setTimeout(f, ms))
    em(REC_TEMPOS.dedo, () => { setPasso('dedo'); apontar('.bv-rec-alvo') })
    em(REC_TEMPOS.toca, () => { setPasso('toca'); tocarSom('click'); vibrarLeve() })
    em(REC_TEMPOS.janela, () => { setPasso('janela'); setDedo(null) }) // o dedo some enquanto a janela sobe e volta em cima do Confirmar
    em(REC_TEMPOS.dedo2, () => { setPasso('dedo2'); apontar('.bv-rec-sh .ui-bt') })
    em(REC_TEMPOS.confirma, () => { setPasso('confirma'); tocarSom('click'); vibrarLeve() })
    em(REC_TEMPOS.quitado, () => { setPasso('quitado'); setDedo(null); tocarSom('sucesso'); vibrarLeve() })
    em(REC_TEMPOS.sai, () => setPasso('sai'))
    // o "Em 7 dias" desce contando, como quem faz a conta
    const de = RECEBER.reduce((s, r) => s + r.total - r.recebido, 0), ate = de - 95
    for (let k = 1; k <= 16; k++) em(REC_TEMPOS.sai + k * 35, () => setSemana(de - (de - ate) * k / 16))
    em(REC_TEMPOS.fim, () => setPasso('fim'))
    return () => ts.forEach(t => clearTimeout(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ordem = ['inicio', 'dedo', 'toca', 'janela', 'dedo2', 'confirma', 'quitado', 'sai', 'fim']
  const ja = (p: string) => ordem.indexOf(passo) >= ordem.indexOf(p)
  const janelaAberta = ja('janela') && !ja('quitado')
  const quitado = ja('quitado'), saiu = ja('sai')
  const qtdSemana = saiu ? 2 : 3
  return (
    <div className="bv-rec bv-cai" ref={caixa} aria-hidden="true">
      <style>{CSS_A_RECEBER}</style>
      <div className="bv-rec-palco" ref={palco} style={{ width: REC_LARGURA, height: REC_ALTURA, transform: `translateX(-50%) scale(${escala})` }}>
        <div className="far-resumo" style={{ '--far-n': 9 } as CSSProperties}>
          <div className="far-k far-k--zero"><small>Atrasados</small><b>R$ 0,00</b><i>0 pedidos</i></div>
          <div className="far-k"><small>Em 7 dias</small><b>{brlDemo(semana)}</b><i>{qtdSemana} pedidos</i></div>
          <div className="far-k far-k--zero"><small>Depois</small><b>R$ 0,00</b><i>0 pedidos</i></div>
        </div>
        <p className="far-gt">Próximos 7 dias</p>
        <div className="far-lista">
          {RECEBER.map((it, i) => {
            const paula = i === 0
            const recebido = paula && quitado ? it.total : it.recebido
            const falta = it.total - recebido
            return (
              <div key={it.id} className={`far-it${paula && quitado ? ' bv-rec-ok' : ''}${paula && saiu ? ' bv-rec-sai' : ''}`}>
                <div className="far-it-h">
                  <b>Pedido #{it.numero} · {it.cliente}</b>
                  {paula && quitado ? <span className="far-tg bv-rec-tg"><Check size={12} weight="bold" />Quitado</span> : <span className="far-tg">{quandoDemo(it.dias)}</span>}
                </div>
                <div className="far-it-v">
                  <small>{recebido > 0 ? `Pago ${brlDemo(recebido)}` : `Total ${brlDemo(it.total)}`}</small>
                  {falta > 0 ? <b>falta {brlDemo(falta)}</b> : <b className="bv-rec-pago">tudo pago</b>}
                </div>
                <div className="far-bar"><i style={{ width: `${Math.min(100, (recebido / it.total) * 100)}%` }} /></div>
                <div className="far-it-a">
                  <span><CalendarBlank size={15} />entrega {entregaDemo(it.dias)}</span>
                  <div className="far-bts">
                    <span className="far-ver"><ArrowSquareOut size={16} /><span>Abrir</span></span>
                    <span className={`far-rec${paula ? ' bv-rec-alvo' : ''}${paula && passo === 'toca' ? ' bv-rec-toque' : ''}`}>Receber</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* a janela "Receber" do app, por cima da lista */}
        <div className={`bv-rec-veu${janelaAberta ? ' on' : ''}`} />
        <div className={`bv-rec-sh${janelaAberta ? ' on' : ''}`}>
          <span className="ui-janela-alca" />
          <p className="ui-janela-t">Receber · Pedido #1047</p>
          <p className="fo-s">Paula Ribeiro</p>
          <div className="far-res">
            <div><span>Total do pedido</span><b>R$ 95,00</b></div>
            <div className="tt"><span>Falta receber</span><b>R$ 95,00</b></div>
          </div>
          <p className="fo-lb">Quanto você recebeu agora?</p>
          <div className="fo-in fo-in--grande"><span>R$</span><b>95,00</b></div>
          <p className="fo-lb">Forma de pagamento</p>
          <div className="fo-chips"><button type="button" tabIndex={-1} className="on">Pix</button><button type="button" tabIndex={-1}>Dinheiro</button><button type="button" tabIndex={-1}>Crédito</button></div>
          <div className="far-prev far-prev--ok"><b>O pedido fica quitado</b><small>R$ 95,00 entram no financeiro.</small></div>
          <span className={`ui-bt ui-bt--principal ui-bt--cheio${passo === 'confirma' ? ' bv-rec-toque' : ''}`}><span className="ui-bt-ic"><Wallet size={20} weight="bold" /></span><span className="ui-bt-t">Confirmar recebimento</span></span>
        </div>

        {dedo && <span className={`bv-rec-dedo${passo === 'toca' || passo === 'confirma' ? ' aperta' : ''}`} style={{ left: dedo.x, top: dedo.y }} />}
        {ja('quitado') && !ja('fim') && <span className="bv-rec-aviso"><CheckCircle size={18} weight="fill" />Pedido #1047 quitado.</span>}
      </div>
    </div>
  )
}

/* ───────── 5 · custos: o resumo da Ficha técnica, montando a conta linha por linha ───────── */
// o mesmo bolo da Camila, da tela das encomendas (2 kg a R$ 75 o quilo)
const CONTA = [
  { rotulo: 'Ingredientes', valor: 51.37, cor: 'var(--ui-rosa)' },
  { rotulo: 'Invisíveis (25%)', valor: 12.84, cor: '#F59E0B' },
  { rotulo: 'Mão de obra (2h30)', valor: 24.6, cor: 'var(--ui-vinho)' },
]
const PRECO = 150
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
        <span className="bv-luc-foto"><img src={PRODUTO.bolo} alt="" /></span>
        <div className="bv-luc-lucro">
          <p className="bv-luc-nome">Bolo de aniversário 2 kg</p>
          {/* o lucro só aparece quando a conta fecha (antes mostrava "R$ 0,00 · 0%" enquanto montava) */}
          <small>Seu lucro</small>
          {pronto ? <><b>R$ {reais(lucro)}</b><span>{margem.toFixed(0)}% de margem</span></> : <><b className="bv-luc-espera">R$ …</b><span className="bv-luc-espera">calculando</span></>}
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

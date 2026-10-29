import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, TouchEvent } from 'react'
import { ArrowLeft, ArrowSquareOut, CalendarBlank, CheckCircle, Check, CaretRight, Receipt, Wallet } from '@phosphor-icons/react'
import { Botao, BotaoIcone } from '@/components/base'
import { Mascote, NomeDoonly } from '@/components/marca/Mascote'
import { LinhaCompacta } from '@/components/pedidos/CartaoPedido'
import type { Pedido } from '@/components/pedidos/pedidoTexto'
import IconeWhatsApp from '@/components/IconeWhatsApp'
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
  ativarRef.current = async () => {
    const ok = await push.subscribe()
    if (!ok) return
    tocarSom('sucesso')
    // (29/10 · 4.67) prova na hora: um aviso de verdade chega neste aparelho, do jeito que o pedido novo vai chegar
    try {
      const reg = await navigator.serviceWorker?.ready
      await reg?.showNotification('Pronto! É assim que um pedido novo vai chegar', {
        body: 'Quando uma cliente pedir pelo cardápio, o aviso aparece aqui, mesmo com o app fechado.',
        icon: '/Sistema/icon-192.png', badge: '/Sistema/badge.png', tag: 'doonly-teste', data: { url: '/inicio' },
      })
    } catch { /* sem o aviso de teste: os avisos continuam ativados */ }
  }
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
              {/* (29/10 · 4.72) no celular só o título aparece; o texto fica quando avisa algo (ativado, iPhone ou bloqueado) */}
              <p className={`bv-p${push.isSubscribed || iphoneSemApp || push.permission === 'denied' ? ' bv-p--aviso' : ''}`}>{push.isSubscribed ? 'Pronto: os avisos estão ativados neste aparelho.'
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

/* ───────── 6 · avisos (29/10 · 4.67): a tela de bloqueio de um celular, com a hora e a data de agora, e os avisos
   chegando um por um de cima, com o som de pedido do app e vibração. Os textos são os mesmos que o app manda
   (funções notif_novo_pedido e cardapio_pix_informado do banco). ───────── */
const AVISOS_DEMO: { em: number; titulo: string; texto: string; foto?: string }[] = [
  { em: 1200, titulo: 'Novo pedido', texto: 'Camila Rocha fez um pedido de R$ 150,00. Toque para ver.', foto: PRODUTO.bolo },
  { em: 4200, titulo: 'Pix para conferir', texto: 'Camila Rocha disse que pagou R$ 75,00 de sinal no Pix do pedido #1049. Confira no banco.' },
  { em: 7200, titulo: 'Novo pedido', texto: 'Juliana Souza fez um pedido de R$ 90,00. Toque para ver.', foto: PRODUTO.salgados },
]
function DemoAviso() {
  const [chegaram, setChegaram] = useState(0)
  const [agora] = useState(() => new Date())
  useEffect(() => {
    const ts = AVISOS_DEMO.map((a, i) => window.setTimeout(() => { tocarSom('pedido'); vibrarLeve(); setChegaram(i + 1) }, a.em))
    return () => ts.forEach(t => clearTimeout(t))
  }, [])
  const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const data = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const lista = AVISOS_DEMO.slice(0, chegaram).map((a, i) => ({ ...a, i })).reverse() // o mais novo em cima
  return (
    <div className="bv-incl bv-avs" aria-hidden="true">
      <Celular>
        <div className="bv-lock">
          <div className="bv-notif-hora"><b>{hora}</b><span>{data}</span></div>
          <div className="bv-notif">
            {lista.map((a, k) => (
              <div key={a.i} className={`bv-notif-cartao${k === 0 ? ' bv-notif-novo' : ''}`}>
                <div className="bv-notif-cab"><img src="/Sistema/icon-192.png" alt="" /><span>Doonly</span><em>{k === 0 ? 'agora' : `${k * 3} min`}</em></div>
                <div className="bv-notif-corpo">
                  <div><b>{a.titulo}</b><p>{a.texto}</p></div>
                  {a.foto && <img src={a.foto} alt="" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Celular>
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
      <div className="bv-cel-tela">{children}</div>
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
const nada = () => {}

/* ───────── 3 · pedidos (29/10 · 4.71): um pedido só, contando a história do começo ao fim, com a tela de Pedidos
   do app (as abas e a linha do pedido são as mesmas do celular). Roda uma vez e é só pra ver (nada é clicável):
   1. a tela vazia ("Nenhum pedido ainda");
   2. o aviso de pedido novo desce do topo, com o som de pedido e vibração;
   3. o pedido da Camila entra em Novos e o dedo toca em Aceitar;
   4. o pedido vai pra Agendados e se abre embaixo com tudo: etapas, cliente e o bolo. Para aí. ───────── */
const ITEM_DEMO = {
  nome_produto: 'Bolo Morango e Nata', quantidade: 1, valor_unitario: 150, imagem_url: PRODUTO.bolo,
  personalizacoes: { tamanho: { nome: '2 kg', peso_kg: 2 }, massa: { nome: 'Massa branca' }, sabor: { nome: 'Nata com morango' }, cobertura: { nome: 'Chantilly' } },
}
const DIAS_ENTREGA = 3
const pedidoDemo = (status: string): Pedido => ({
  id: 'demo-1049', numero: 1049, cliente_nome: 'Camila Rocha', cliente_telefone: '11978414991', status, status_pagamento: 'parcial', prioridade: '',
  data_entrega: isoDia(DIAS_ENTREGA), horario_entrega: '14:00', valor_total: 150, valor_recebido: 75, tipo_entrega: 'retirada', forma_pagamento: 'pix',
  etiquetas: [], origem: 'cardapio', created_at: new Date(Date.now() - 60000).toISOString(), pedido_itens: [ITEM_DEMO],
} as unknown as Pedido)
const ETAPAS_DEMO = ['Novo', 'Agendado', 'Produção', 'Pronto', 'Retirado']
const PED_LARGURA = 400, PED_ALTURA = 600

function DemoPedidos() {
  const [passo, setPasso] = useState<'vazio' | 'aviso' | 'novo' | 'toca' | 'aberto'>('vazio')
  const [avisoSaiu, setAvisoSaiu] = useState(false)
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
      if (w && h) { const k = Math.min(1.15, w / PED_LARGURA, h / PED_ALTURA); escalaRef.current = k; setEscala(k) }
    }
    medir()
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    obs?.observe(el)
    return () => obs?.disconnect()
  }, [])

  useEffect(() => {
    const ts: number[] = []
    const em = (ms: number, f: () => void) => ts.push(window.setTimeout(f, ms))
    em(1200, () => { setPasso('aviso'); tocarSom('pedido'); vibrarLeve() })
    em(2700, () => setPasso('novo'))
    em(3500, () => setAvisoSaiu(true))
    em(3900, () => {
      const pc = palco.current, alvo = pc?.querySelector('.pdk-bt') as HTMLElement | null
      if (!pc || !alvo) return
      const a = alvo.getBoundingClientRect(), b = pc.getBoundingClientRect(), k = escalaRef.current || 1
      setDedo({ x: (a.left - b.left + a.width / 2) / k, y: (a.top - b.top + a.height / 2) / k })
    })
    em(4500, () => { setPasso('toca'); tocarSom('click'); vibrarLeve() })
    em(4800, () => { setDedo(null); setPasso('aberto'); tocarSom('sucesso') })
    return () => ts.forEach(t => clearTimeout(t))
  }, [])

  const aberto = passo === 'aberto'
  const temPedido = passo !== 'vazio' && passo !== 'aviso'
  const p = pedidoDemo(aberto ? 'agendado' : 'aguardando_aceite')
  const nSit = { aceitar: aberto ? 0 : 1, agenda: aberto ? 1 : 0, prontos: 0 }
  const abas: [string, string, number | null, boolean][] = [['aceitar', 'Novos', nSit.aceitar, !aberto], ['agenda', 'Agendados', nSit.agenda, aberto], ['prontos', 'Prontos', 0, false], ['concluidos', 'Concluídos', null, false]]
  const dia = (() => { const d = new Date(); d.setDate(d.getDate() + DIAS_ENTREGA); const sem = d.toLocaleDateString('pt-BR', { weekday: 'long' }).replace(/-feira/, ''); return `${sem.charAt(0).toUpperCase() + sem.slice(1)}, ${d.getDate()}/${d.getMonth() + 1}` })()
  return (
    <div className="bv-pd bv-cai" ref={caixa} aria-hidden="true">
      <div className="bv-pd-palco" ref={palco} style={{ width: PED_LARGURA, height: PED_ALTURA, transform: `translateX(-50%) scale(${escala})` }}>
        <p className="bv-pd-tit">Meus pedidos</p>
        {!temPedido ? (
          <div className="bv-pd-vazio">
            <span><Receipt size={30} /></span>
            <b>Nenhum pedido ainda</b>
            <small>Quando chegar uma encomenda, ela aparece aqui.</small>
          </div>
        ) : (<>
          <div className="pdk-abas">
            {abas.map(([k, nome, n, on]) => (
              <span key={k} className={`pdk-aba${k === 'aceitar' && n ? ' alerta' : ''}`} aria-selected={on}>
                <span className="pdk-aba-t">{nome}</span>{n === null ? <i className="pdk-aba-sem">0</i> : <i key={`${k}${n}`} className="bv-pd-n">{n}</i>}
              </span>
            ))}
          </div>
          {aberto ? <p className="pdk-t">{dia}<i>1</i></p> : <div className="pdk-topo"><span>Chegou pelo cardápio</span></div>}
          <div className={`bv-pd-cartao${aberto ? ' aberto' : ''}${passo === 'novo' || passo === 'toca' ? ' entra' : ''}${passo === 'toca' ? ' toque' : ''}`}>
            <LinhaCompacta p={p} aoAbrir={nada} aoAvancar={nada} aoMenu={nada} aoEndereco={nada} />
            <div className="bv-pd-mais">
              <div className="bv-pd-mais-in">
                <ol className="bv-pd-passos">
                  {ETAPAS_DEMO.map((n, i) => <li key={n} className={i === 0 ? 'feita' : i === 1 ? 'atual' : ''}><i>{i === 0 ? <Check size={13} weight="bold" /> : i + 1}</i><span>{n}</span></li>)}
                </ol>
                <div className="bv-pd-cli">
                  <span className="bv-pd-av">CR</span>
                  <div><b>Camila Rocha</b><small>(11) 97841-4991</small><small>Origem: <b>Cardápio digital</b></small></div>
                  <span className="bv-pd-zap"><IconeWhatsApp size={20} /></span>
                </div>
                <div className="bv-pd-it">
                  <img src={PRODUTO.bolo} alt="" />
                  <div>
                    <b>1x Bolo Morango e Nata</b>
                    <p><span>Tamanho:</span> 2 kg</p>
                    <p><span>Massa:</span> Massa branca</p>
                    <p><span>Sabor:</span> Nata com morango</p>
                    <p><span>Cobertura:</span> Chantilly</p>
                  </div>
                </div>
                <p className="bv-pd-pg"><span>Sinal de R$ 75,00 pago no Pix</span><b>falta R$ 75,00</b></p>
              </div>
            </div>
          </div>
        </>)}
        {(passo === 'aviso' || (passo !== 'vazio' && !avisoSaiu)) && (
          <div className={`bv-notif-cartao bv-pd-aviso${avisoSaiu ? ' sai' : ''}`}>
            <div className="bv-notif-cab"><img src="/Sistema/icon-192.png" alt="" /><span>Doonly</span><em>agora</em></div>
            <div className="bv-notif-corpo"><div><b>Novo pedido</b><p>Camila Rocha fez um pedido de R$ 150,00. Toque para ver.</p></div><img src={PRODUTO.bolo} alt="" /></div>
          </div>
        )}
        {dedo && <span className={`bv-rec-dedo${passo === 'toca' ? ' aperta' : ''}`} style={{ left: dedo.x, top: dedo.y }} />}
      </div>
    </div>
  )
}

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

/* ───────── 4 · dinheiro (29/10 · 4.65/4.66): a tela "A receber" de verdade (os 3 quadrinhos e os cartões, com o
   visual do app) e uma animação que roda uma vez, um pedido de cada vez:
   1. Paula paga tudo: o dedo toca em Receber, a janela do app sobe com R$ 95,00 e Pix, o dedo confirma, o cartão fica
      verde ("Quitado") e sai da lista;
   2. Carla paga só o sinal: a janela abre com o total, o valor vira R$ 90,00, aparece "Ainda vai faltar", o dedo
      confirma e a barrinha enche até a metade (o pedido continua na lista);
   3. Fernanda é devedora: não paga, a entrega já passou; o cartão dela e o quadrinho Atrasados piscam em vermelho.
   É só pra ver (sem toque). A caixa tem tamanho fixo e encolhe inteira pra caber em qualquer tela. ───────── */
type ItemDemo = { id: 'fernanda' | 'paula' | 'carla'; numero: number; cliente: string; total: number; dias: number }
const FERNANDA: ItemDemo = { id: 'fernanda', numero: 1048, cliente: 'Fernanda Lima', total: 260, dias: -3 }
const PAULA: ItemDemo = { id: 'paula', numero: 1047, cliente: 'Paula Ribeiro', total: 95, dias: 1 }
const CARLA: ItemDemo = { id: 'carla', numero: 1045, cliente: 'Carla Menezes', total: 180, dias: 2 }
const SINAL_CARLA = 90
const reais = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const brlDemo = (n: number) => `R$ ${reais(n)}`
const quandoDemo = (d: number) => d === 0 ? 'hoje' : d === 1 ? 'amanhã' : d > 1 ? `em ${d} dias` : d === -1 ? 'atrasado 1 dia' : `atrasado ${-d} dias`
const entregaDemo = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '') }
const REC_LARGURA = 400, REC_ALTURA = 610

type EstadoRec = {
  janela: ItemDemo | null; valor: string; digitando: boolean; toque: '' | 'paula' | 'carla' | 'confirma'
  paula: 'deve' | 'quitado' | 'saiu'; carla: number; devedor: boolean; semana: number; qtdSemana: number
  aviso: { t: string; k: number } | null; balao: boolean
}
const INICIO_REC: EstadoRec = { janela: null, valor: '', digitando: false, toque: '', paula: 'deve', carla: 0, devedor: false,
  semana: PAULA.total + CARLA.total, qtdSemana: 2, aviso: null, balao: false }

function DemoDinheiro() {
  const [e, setE] = useState<EstadoRec>(INICIO_REC)
  const muda = (x: Partial<EstadoRec>) => setE(a => ({ ...a, ...x }))
  const caixa = useRef<HTMLDivElement>(null)
  const palco = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)
  const escalaRef = useRef(1)
  const [dedo, setDedo] = useState<{ x: number; y: number; aperta: boolean } | null>(null)

  // encolhe a caixa inteira pra caber no espaço que sobrou (nunca passa de 1,15x)
  useLayoutEffect(() => {
    const el = caixa.current
    if (!el) return
    const medir = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (w && h) { const k = Math.min(1.15, w / REC_LARGURA, h / REC_ALTURA); escalaRef.current = k; setEscala(k) }
    }
    medir()
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    obs?.observe(el)
    return () => obs?.disconnect()
  }, [])

  // o dedo vai até um ponto da tela (medido dentro da caixa, sem a escala)
  const apontar = (seletor: string) => {
    const p = palco.current, alvo = p?.querySelector(seletor) as HTMLElement | null
    if (!p || !alvo) return
    const a = alvo.getBoundingClientRect(), b = p.getBoundingClientRect(), k = escalaRef.current || 1
    setDedo({ x: (a.left - b.left + a.width / 2) / k, y: (a.top - b.top + a.height / 2) / k, aperta: false })
  }
  const apertar = (sim: boolean) => setDedo(d => d && { ...d, aperta: sim })

  useEffect(() => {
    const ts: number[] = []
    const em = (ms: number, f: () => void) => ts.push(window.setTimeout(f, ms))
    const toque = () => { tocarSom('click'); vibrarLeve() }
    const contar = (de: number, ate: number, inicio: number) => {
      for (let k = 1; k <= 16; k++) em(inicio + k * 35, () => muda({ semana: de - (de - ate) * k / 16 }))
    }
    let aviso = 0
    // 1 · Paula paga tudo
    em(1300, () => apontar('[data-alvo="paula"]'))
    em(1900, () => { apertar(true); muda({ toque: 'paula' }); toque() })
    em(2150, () => { setDedo(null); muda({ toque: '', janela: PAULA, valor: reais(PAULA.total) }) })
    em(3300, () => apontar('.bv-rec-sh .ui-bt'))
    em(3850, () => { apertar(true); muda({ toque: 'confirma' }); toque() })
    em(4100, () => { setDedo(null); tocarSom('sucesso'); vibrarLeve(); muda({ toque: '', janela: null, paula: 'quitado', aviso: { t: `Pedido #${PAULA.numero} quitado.`, k: ++aviso } }) })
    em(5400, () => muda({ paula: 'saiu', qtdSemana: 1 }))
    contar(PAULA.total + CARLA.total, CARLA.total, 5400)
    // 2 · Carla paga só o sinal: a janela abre com o total e o valor é trocado
    em(6500, () => apontar('[data-alvo="carla"]'))
    em(7100, () => { apertar(true); muda({ toque: 'carla' }); toque() })
    em(7350, () => { setDedo(null); muda({ toque: '', janela: CARLA, valor: reais(CARLA.total) }) })
    em(8350, () => muda({ valor: '', digitando: true }))
    em(8600, () => muda({ valor: '9' }))
    em(8800, () => muda({ valor: '90' }))
    em(9050, () => muda({ valor: reais(SINAL_CARLA), digitando: false }))
    em(9800, () => apontar('.bv-rec-sh .ui-bt'))
    em(10350, () => { apertar(true); muda({ toque: 'confirma' }); toque() })
    em(10600, () => { setDedo(null); tocarSom('sucesso'); vibrarLeve(); muda({ toque: '', janela: null, carla: SINAL_CARLA, aviso: { t: `Recebido ${brlDemo(SINAL_CARLA)}. Ainda faltam ${brlDemo(CARLA.total - SINAL_CARLA)}.`, k: ++aviso } }) })
    contar(CARLA.total, CARLA.total - SINAL_CARLA, 10600)
    // 3 · Fernanda é devedora: não paga e a entrega já passou
    em(12700, () => { apontar('[data-alvo="fernanda"]'); muda({ aviso: null }) })
    em(13100, () => { muda({ devedor: true, balao: true }); vibrarLeve() })
    em(14600, () => setDedo(null))
    em(16800, () => muda({ balao: false }))
    return () => ts.forEach(t => clearTimeout(t))
  }, [])

  const cartao = (it: ItemDemo) => {
    const recebido = it.id === 'paula' ? (e.paula === 'deve' ? 0 : it.total) : it.id === 'carla' ? e.carla : 0
    const falta = it.total - recebido
    const quitado = it.id === 'paula' && e.paula !== 'deve'
    const atrasado = it.dias < 0
    return (
      <div key={it.id} data-alvo={atrasado ? it.id : undefined}
        className={`far-it${quitado ? ' bv-rec-ok' : ''}${it.id === 'paula' && e.paula === 'saiu' ? ' bv-rec-sai' : ''}${atrasado && e.devedor ? ' bv-rec-dev' : ''}`}>
        <div className="far-it-h">
          <b>Pedido #{it.numero} · {it.cliente}</b>
          {quitado ? <span className="far-tg bv-rec-tg"><Check size={12} weight="bold" />Quitado</span>
            : <span className={`far-tg${atrasado ? ' far-tg--atr' : ''}`}>{quandoDemo(it.dias)}</span>}
        </div>
        <div className="far-it-v">
          <small>{recebido > 0 ? `Pago ${brlDemo(recebido)}` : `Total ${brlDemo(it.total)}`}</small>
          {falta > 0 ? <b key={falta} className={recebido > 0 ? 'bv-rec-muda' : ''}>falta {brlDemo(falta)}</b> : <b className="bv-rec-pago">tudo pago</b>}
        </div>
        <div className="far-bar"><i style={{ width: `${Math.min(100, (recebido / it.total) * 100)}%` }} /></div>
        <div className="far-it-a">
          <span><CalendarBlank size={15} />entrega {entregaDemo(it.dias)}</span>
          <div className="far-bts">
            <span className="far-ver"><ArrowSquareOut size={16} /><span>Abrir</span></span>
            <span data-alvo={atrasado ? undefined : it.id} className={`far-rec${e.toque === it.id ? ' bv-rec-toque' : ''}`}>Receber</span>
          </div>
        </div>
        {atrasado && e.balao && <span className="bv-rec-balao">Não pagou e a entrega já passou</span>}
      </div>
    )
  }

  const j = e.janela
  const vNum = j ? Math.round((parseFloat(e.valor.replace(/\./g, '').replace(',', '.')) || 0) * 100) / 100 : 0
  const resta = j ? Math.max(0, j.total - vNum) : 0
  return (
    <div className="bv-rec bv-cai" ref={caixa} aria-hidden="true">
      <style>{CSS_A_RECEBER}</style>
      <div className="bv-rec-palco" ref={palco} style={{ width: REC_LARGURA, height: REC_ALTURA, transform: `translateX(-50%) scale(${escala})` }}>
        <div className="far-resumo" style={{ '--far-n': 9 } as CSSProperties}>
          <div className={`far-k far-k--atr${e.devedor ? ' bv-rec-dev' : ''}`}><small>Atrasados</small><b>{brlDemo(FERNANDA.total)}</b><i>1 pedido</i></div>
          <div className="far-k"><small>Em 7 dias</small><b>{brlDemo(e.semana)}</b><i>{e.qtdSemana} {e.qtdSemana === 1 ? 'pedido' : 'pedidos'}</i></div>
          <div className="far-k far-k--zero"><small>Depois</small><b>R$ 0,00</b><i>0 pedidos</i></div>
        </div>
        <p className="far-gt">Atrasados</p>
        <div className="far-lista">{cartao(FERNANDA)}</div>
        <p className="far-gt">Próximos 7 dias</p>
        <div className="far-lista">{cartao(PAULA)}{cartao(CARLA)}</div>

        {/* a janela "Receber" do app, por cima da lista */}
        <div className={`bv-rec-veu${j ? ' on' : ''}`} />
        <div className={`bv-rec-sh${j ? ' on' : ''}`}>
          <span className="ui-janela-alca" />
          <p className="ui-janela-t">Receber · Pedido #{(j || CARLA).numero}</p>
          <p className="fo-s">{(j || CARLA).cliente}</p>
          <div className="far-res">
            <div><span>Total do pedido</span><b>{brlDemo((j || CARLA).total)}</b></div>
            <div className="tt"><span>Falta receber</span><b>{brlDemo((j || CARLA).total)}</b></div>
          </div>
          <p className="fo-lb">Quanto você recebeu agora?</p>
          <div className={`fo-in fo-in--grande${e.digitando ? ' bv-rec-foco' : ''}`}><span>R$</span><b>{e.valor}</b>{e.digitando && <i className="bv-rec-cursor" />}</div>
          <p className="fo-lb">Forma de pagamento</p>
          <div className="fo-chips"><button type="button" tabIndex={-1} className="on">Pix</button><button type="button" tabIndex={-1}>Dinheiro</button><button type="button" tabIndex={-1}>Crédito</button></div>
          {vNum > 0 && (resta > 0
            ? <div key="falta" className="far-prev bv-rec-prev"><b>Ainda vai faltar: {brlDemo(resta)}</b><small>Continua em "A receber" até você registrar o restante.</small></div>
            : <div key="ok" className="far-prev far-prev--ok"><b>O pedido fica quitado</b><small>{brlDemo(vNum)} entram no financeiro.</small></div>)}
          <span className={`ui-bt ui-bt--principal ui-bt--cheio${e.toque === 'confirma' ? ' bv-rec-toque' : ''}`}><span className="ui-bt-ic"><Wallet size={20} weight="bold" /></span><span className="ui-bt-t">Confirmar recebimento</span></span>
        </div>

        {dedo && <span className={`bv-rec-dedo${dedo.aperta ? ' aperta' : ''}`} style={{ left: dedo.x, top: dedo.y }} />}
        {e.aviso && <span key={e.aviso.k} className="bv-rec-aviso"><CheckCircle size={18} weight="fill" />{e.aviso.t}</span>}
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

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, TouchEvent } from 'react'
import { ArrowLeft, Bell, CaretRight, Egg, Lightning, MagnifyingGlass, Timer, Wallet } from '@phosphor-icons/react'
import { Botao, BotaoIcone } from '@/components/base'
import { Mascote, NomeDoonly } from '@/components/marca/Mascote'
import { tocarSom } from '@/hooks/useSom'
import './boasVindas.css'

/**
 * Boas-vindas (refeita em 07/10 no desenho do login) — a apresentação que aparece logo depois de criar a conta.
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

const vibrarLeve = () => {
  try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15) } catch { /* sem vibração: segue */ }
}

// Só as imagens que as telas usam (antes baixava 16, mais de 4 MB, várias de telas que já saíram).
// As fotos pequenas (clientes e produtos) têm versão leve em public/tutorial/leve.
const IMAGENS = [
  '/tutorial/cardapio-exemplo.jpg', '/tutorial/cardapio-exemplo-nav.jpg',
  '/tutorial/leve/cliente1.webp', '/tutorial/leve/cliente2.webp',
  '/tutorial/leve/doisamores.webp', '/tutorial/leve/caixa4.webp', '/tutorial/leve/salgadinhos.webp',
]

export default function BoasVindas({ isOpen, onClose, nome }: Props) {
  const [tela, setTela] = useState(0)
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
    <div className={`bv-root${saindo ? ' bv-root--saindo' : ''}`} role="dialog" aria-modal="true" aria-label="Boas-vindas ao Doonly" onTouchStart={aoTocar} onTouchEnd={aoSoltar}>
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
              <h1 className="bv-h">{nome ? <>Que bom ter você aqui, <em>{nome}</em></> : <>Que bom ter <em>você aqui</em></>}</h1>
              <p className="bv-p">Pedidos, cardápio e dinheiro da sua confeitaria num só lugar. Veja em 1 minuto como funciona.</p>
            </>)}
            {tela === 1 && (<>
              <p className="bv-sobre">Seus produtos em destaque</p>
              <h1 className="bv-h">Seu cliente escolhe, <em>você recebe o pedido</em></h1>
              <p className="bv-p">Monte seu cardápio com sabores e adicionais e mande o link no WhatsApp.</p>
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
          {tela === 0 && <DemoMarca comNome />}
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
function DemoMarca({ comNome = false, pose = 'acenando' }: { comNome?: boolean; pose?: 'acenando' | 'comemorando' }) {
  return (
    <div className="bv-marca">
      <Mascote pose={pose} className="bv-marca-masc" />
      {comNome && <NomeDoonly cor="branco" className="bv-marca-nome" />}
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

/* ───────── 3 · pedidos: três cartões caindo, cada um numa situação ───────── */
const PEDIDOS = [
  { id: 5, cliente: 'Ana Cristina Vieira', foto: '/tutorial/leve/cliente1.webp', iniciais: '', quando: 'hoje, 11h', item: '1x Bolo Dois Amores', img: '/tutorial/leve/doisamores.webp', total: 'R$ 40,00', situacao: 'Novo pedido', tom: 'laranja' },
  { id: 6, cliente: 'Marina Silva', foto: '/tutorial/leve/cliente2.webp', iniciais: '', quando: 'hoje, 14h', item: '1x Caixa de Brigadeiro', img: '/tutorial/leve/caixa4.webp', total: 'R$ 150,00', situacao: 'Em produção', tom: 'rosa' },
  { id: 7, cliente: 'Juliana Souza', foto: '', iniciais: 'JS', quando: 'amanhã, 9h', item: '100x Salgadinhos', img: '/tutorial/leve/salgadinhos.webp', total: 'R$ 95,00', situacao: 'Pronto', tom: 'verde' },
]

function DemoPedidos() {
  return (
    <div className="bv-ped">
      <div className="bv-ped-aviso"><Bell size={14} weight="fill" aria-hidden="true" /><span><b>Novo pedido</b> pelo cardápio</span></div>
      {PEDIDOS.map((p, i) => (
        <div key={p.id} className="bv-ped-cartao" style={{ '--i': i } as CSSProperties}>
          <div className="bv-ped-topo">
            {p.foto ? <img className="bv-ped-foto" src={p.foto} alt="" /> : <span className="bv-ped-foto bv-ped-foto--ini">{p.iniciais}</span>}
            <div className="bv-ped-quem">
              <b>{p.cliente}</b>
              <span className="bv-ped-sit"><span>Situação</span><strong className={`bv-tom--${p.tom}`}>{p.situacao}</strong></span>
            </div>
            <span className="bv-ped-meta">#{p.id} · {p.quando}</span>
          </div>
          <div className="bv-ped-item">
            <img src={p.img} alt="" />
            <span>{p.item}</span>
            <b>{p.total}</b>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ───────── 4 · dinheiro: quanto cada cliente já pagou ───────── */
const RECEBER = [
  { id: 5, cliente: 'Ana Cristina Vieira', foto: '/tutorial/leve/cliente1.webp', iniciais: '', item: 'Bolo Dois Amores', total: 140, pago: 140, situacao: 'Pago', tom: 'verde' },
  { id: 6, cliente: 'Marina Silva', foto: '/tutorial/leve/cliente2.webp', iniciais: '', item: 'Caixa de Brigadeiro', total: 150, pago: 80, situacao: 'Sinal pago', tom: 'laranja' },
  { id: 7, cliente: 'Juliana Souza', foto: '', iniciais: 'JS', item: '100x Salgadinhos', total: 95, pago: 0, situacao: 'Falta pagar', tom: 'vermelho' },
]
const A_RECEBER = RECEBER.reduce((s, p) => s + p.total - p.pago, 0)

function DemoDinheiro() {
  return (
    <div className="bv-ped bv-din">
      <div className="bv-ped-aviso bv-din-aviso"><Wallet size={14} weight="fill" aria-hidden="true" /><span>A receber: <b>R$ {reais(A_RECEBER)}</b></span></div>
      {RECEBER.map((p, i) => {
        const falta = p.total - p.pago
        return (
          <div key={p.id} className="bv-ped-cartao" style={{ '--i': i } as CSSProperties}>
            <div className="bv-ped-topo">
              {p.foto ? <img className="bv-ped-foto" src={p.foto} alt="" /> : <span className="bv-ped-foto bv-ped-foto--ini">{p.iniciais}</span>}
              <div className="bv-ped-quem">
                <b>{p.cliente}</b>
                <span className="bv-ped-sit"><span>#{p.id} · {p.item}</span></span>
              </div>
              <span className="bv-din-total">R$ {reais(p.total)}</span>
            </div>
            <div className="bv-din-barra" aria-hidden="true"><i className={`bv-din-barra--${p.tom}`} style={{ '--p': `${(p.pago / p.total) * 100}%` } as CSSProperties} /></div>
            <div className="bv-din-sit">
              <strong className={`bv-tom--${p.tom}`}>{p.situacao}</strong>
              <span>{falta > 0 ? <>Falta <b>R$ {reais(falta)}</b></> : <>Recebido <b>R$ {reais(p.pago)}</b></>}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ───────── 5 · preço e lucro: soma os custos, testa dois preços e mostra a margem ───────── */
const CUSTOS: { rotulo: string; valor: number; icone: ReactNode }[] = [
  { rotulo: 'Ingredientes', valor: 34.48, icone: <Egg size={16} weight="bold" /> },
  { rotulo: 'Mão de obra', valor: 15.0, icone: <Timer size={16} weight="bold" /> },
  { rotulo: 'Custos fixos', valor: 3.5, icone: <Lightning size={16} weight="bold" /> },
  { rotulo: 'Custos invisíveis (25%)', valor: 13.25, icone: <MagnifyingGlass size={16} weight="bold" /> },
]
const CUSTO_TOTAL = 66.23 // 40 brigadeiros, com os custos invisíveis
const CUSTO_POR_CAIXA = 6.62 // caixa com 4
const PRECOS = ['8,00', '15,00']
const reais = (n: number) => n.toFixed(2).replace('.', ',')

function DemoLucro() {
  const [digitado, setDigitado] = useState('')
  const [rodada, setRodada] = useState(-1) // -1 = ainda somando os custos · 0 = R$ 8 · 1 = R$ 15
  const [resultado, setResultado] = useState(false)
  const [cursor, setCursor] = useState(false)
  const [linhas, setLinhas] = useState(0)
  const [total, setTotal] = useState(false)

  // os custos aparecem linha por linha, depois o total, depois começa o teste de preço
  useEffect(() => {
    const ts: number[] = []
    CUSTOS.forEach((_, i) => ts.push(window.setTimeout(() => setLinhas(i + 1), 800 + i * 600)))
    ts.push(window.setTimeout(() => setTotal(true), 800 + CUSTOS.length * 600 + 400))
    ts.push(window.setTimeout(() => setRodada(0), 800 + CUSTOS.length * 600 + 1200))
    return () => ts.forEach(t => clearTimeout(t))
  }, [])

  // cada rodada: digita o preço, mostra o resultado e passa pra próxima
  useEffect(() => {
    if (rodada < 0) return
    const ts: number[] = []
    const preco = PRECOS[rodada]
    setDigitado(''); setResultado(false); setCursor(true)
    preco.split('').forEach((_, i) => ts.push(window.setTimeout(() => setDigitado(preco.slice(0, i + 1)), 400 + 120 * (i + 1))))
    const fim = 400 + 120 * preco.length + 400
    ts.push(window.setTimeout(() => { setCursor(false); setResultado(true) }, fim))
    if (rodada === 0) ts.push(window.setTimeout(() => setRodada(1), fim + 3800))
    return () => ts.forEach(t => clearTimeout(t))
  }, [rodada])

  const preco = parseFloat(digitado.replace(',', '.')) || 0
  const lucro = preco - CUSTO_POR_CAIXA
  const margem = preco > 0 ? (lucro / preco) * 100 : 0
  const apertada = margem < 30

  return (
    <div className="bv-luc">
      <div className="bv-luc-produto">
        <img src="/tutorial/leve/caixa4.webp" alt="" />
        <div><b>Caixa de Brigadeiro</b><span>4 unidades · gourmet</span></div>
      </div>

      <p className="bv-luc-grupo">Custos da produção (40 un)</p>
      {CUSTOS.map((c, i) => (
        <div key={c.rotulo} className={`bv-luc-linha${i < linhas ? ' bv-luc-linha--v' : ''}`}>
          <span className="bv-luc-rot"><i aria-hidden="true">{c.icone}</i>{c.rotulo}</span>
          <span className="bv-luc-val"><small>R$</small>{reais(c.valor)}</span>
        </div>
      ))}
      <div className={`bv-luc-linha bv-luc-linha--total${total ? ' bv-luc-linha--v' : ''}`}>
        <span className="bv-luc-rot">Total</span>
        <span className="bv-luc-val"><small>R$</small>{reais(CUSTO_TOTAL)}</span>
      </div>
      <div className={`bv-luc-linha bv-luc-linha--caixa${total ? ' bv-luc-linha--v' : ''}`}>
        <span className="bv-luc-rot">Custo por caixa</span>
        <span className="bv-luc-val"><small>R$</small>{reais(CUSTO_POR_CAIXA)}</span>
      </div>

      {/* o espaço da pergunta e do resultado já fica reservado: o cartão não cresce nem empurra a tela */}
      <div className={`bv-luc-pergunta${rodada >= 0 ? ' bv-luc-pergunta--v' : ''}`}>
        <span className="bv-luc-per">Por quanto vende a caixa?</span>
        <div className={`bv-luc-campo${resultado ? (apertada ? ' bv-luc-campo--ruim' : ' bv-luc-campo--bom') : ''}`}>
          <small>R$</small><span>{digitado}</span>{cursor && <i className="bv-luc-cursor" />}
        </div>
      </div>
      <div className="bv-luc-vaga" aria-live="polite">
        {resultado && (
          <div className={`bv-luc-res ${apertada ? 'bv-luc-res--ruim' : 'bv-luc-res--bom'}`} key={rodada}>
            <span className="bv-luc-res-rot">{apertada ? 'Margem apertada' : 'Lucro por caixa'}</span>
            <div className="bv-luc-res-num"><b>R$ {reais(lucro)}</b><i /><span>{margem.toFixed(0)}% de margem</span></div>
          </div>
        )}
      </div>
    </div>
  )
}

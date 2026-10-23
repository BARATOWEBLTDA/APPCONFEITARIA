import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useTravarRolagem } from '@/hooks/useTravarRolagem'

/**
 * O que toda janela e gaveta precisa (07/10 · guia v2), num lugar só:
 *   · a tela de trás não rola (com o jeito que funciona no iPhone)
 *   · Esc fecha
 *   · o "voltar" do Android fecha a janela, e não sai da tela
 *   · o foco entra na janela, fica preso nela e volta pro botão que abriu
 * Várias abertas juntas (calendário por cima de gaveta): Esc e voltar fecham só a de cima.
 */

type Aberta = { fechar: () => void; temEntrada: boolean; abertaEm: number }
const pilha: Aberta[] = []
let popsAIgnorar = 0
let ouvindo = false
let voltarFecha = true
let esperandoToque = false
const aoAssentar: (() => void)[] = []
/** (11/10) Entradas de janelas que fecharam neste mesmo instante: se outra janela abrir junto (prévia → Editar), ela herda a entrada em vez de back + push, que o Chrome embaralhava. */
let entradasLivres = 0
function devolverLivres() {
  const n = entradasLivres
  entradasLivres = 0
  for (let k = 0; k < n; k++) {
    try { if (window.history.state?.uiJanela) { popsAIgnorar++; window.history.back() } } catch { /* nada */ }
  }
}

/** A vitrine roda dentro de outra página: lá o histórico não é nosso, então desliga. */
export function configurarSobreposicao(opcoes: { voltarFecha?: boolean }) {
  if (typeof opcoes.voltarFecha === 'boolean') voltarFecha = opcoes.voltarFecha
}

/** A entrada que a janela coloca no histórico pro "voltar" do Android. */
function empurrar(a: Aberta) {
  try { window.history.pushState({ ...(window.history.state || {}), uiJanela: true }, ''); a.temEntrada = true } catch { /* sem histórico: segue sem o voltar */ }
}

/**
 * (10/10) Janela que continuou aberta depois do voltar (perguntou "Descartar?" e a pessoa ficou, ou estava salvando)
 * ficava sem entrada no histórico, e o voltar seguinte saía da tela. A entrada é reposta no próximo toque ou tecla:
 * o Chrome pula entradas criadas logo depois de um voltar, sem a pessoa ter tocado na tela.
 */
function reporEntradas(e: Event) {
  if ((e as KeyboardEvent).key === 'Escape') return // o Esc fecha a janela de cima: não precisa repor
  window.removeEventListener('click', reporEntradas, true)
  window.removeEventListener('keydown', reporEntradas, true)
  esperandoToque = false
  if (voltarFecha) pilha.forEach(a => { if (!a.temEntrada) empurrar(a) })
}

function aoVoltar(e: Event) {
  if (popsAIgnorar > 0) {
    // era o "voltar" que uma janela pediu ao fechar: quando chega o último, avisa quem esperava pra navegar
    if (--popsAIgnorar === 0) { const fila = aoAssentar.splice(0); window.setTimeout(() => fila.forEach(f => f()), 0) }
    return
  }
  const topo = pilha[pilha.length - 1]
  if (!topo) return
  // (11/10) a janela de cima foi aberta por este mesmo voltar (a pergunta "Cancelar esta venda?"): não é ela que o voltar fecha
  if (topo.abertaEm >= e.timeStamp) return
  // o voltar já tirou do histórico a entrada de uma janela (a mais de cima que ainda tinha)
  for (let i = pilha.length - 1; i >= 0; i--) { if (pilha[i].temEntrada) { pilha[i].temEntrada = false; break } }
  topo.fechar()
  if (!esperandoToque) {
    esperandoToque = true
    window.addEventListener('click', reporEntradas, true)
    window.addEventListener('keydown', reporEntradas, true)
  }
}

/**
 * (10/10) Espera o histórico assentar. A janela que fecha pelo botão pede um "voltar" pra tirar a entrada dela,
 * e esse voltar só acontece um instante depois: quem navegava logo em seguida tinha a tela nova desfeita.
 * Resolve quando os "voltar" pedidos chegarem (ou no tempo limite, por segurança). O confirmar() e o informar() já esperam.
 */
export function historicoAssentado(limite = 500): Promise<void> {
  // janela que acabou de fechar ainda vai pedir o voltar dela (logo em seguida): espera esse pedido sair primeiro
  if (entradasLivres > 0) return Promise.resolve().then(() => historicoAssentado(limite))
  if (popsAIgnorar === 0) return Promise.resolve()
  return new Promise(resolve => {
    aoAssentar.push(resolve)
    window.setTimeout(resolve, limite)
  })
}
function aoTeclar(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  const topo = pilha[pilha.length - 1]
  if (!topo) return
  e.stopPropagation()
  topo.fechar()
}
/** Avisa o CSS que tem janela aberta (o aviso rápido sobe pro topo pra não cobrir os botões de baixo). */
function marcar() {
  if (pilha.length) document.documentElement.setAttribute('data-ui-janela', '')
  else document.documentElement.removeAttribute('data-ui-janela')
}
function ouvir() {
  if (ouvindo) return
  ouvindo = true
  window.addEventListener('popstate', aoVoltar)
  window.addEventListener('keydown', aoTeclar)
}

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useSobreposicao(aberta: boolean, aoFechar: () => void, caixa: RefObject<HTMLElement | null>) {
  const fecharRef = useRef(aoFechar)
  fecharRef.current = aoFechar

  useTravarRolagem(aberta)

  useEffect(() => {
    if (!aberta) return
    ouvir()
    const eu: Aberta = { fechar: () => fecharRef.current(), temEntrada: false, abertaEm: performance.now() }
    pilha.push(eu)
    marcar()

    // voltar do Android: a janela coloca uma entrada no histórico; o voltar tira a entrada e fecha a janela
    if (voltarFecha) {
      if (entradasLivres > 0) { entradasLivres--; eu.temEntrada = true }
      else empurrar(eu)
    }

    // foco: entra na janela, fica preso nela e depois volta pra onde estava
    const antes = document.activeElement as HTMLElement | null
    const el = caixa.current
    // (22/10) sem abrir o teclado sozinho: se o foco inicial é um campo de digitar, o foco fica na janela (o teclado só abre quando ela tocar no campo)
    const ini = el?.querySelector<HTMLElement>('[data-foco-inicial]')
    const ehCampo = !!ini && ini.matches('input, textarea, select, [contenteditable="true"]')
    if (el) ((ini && !ehCampo) ? ini : el).focus({ preventScroll: true })
    const prender = (e: KeyboardEvent) => {
      const dentro = caixa.current
      if (e.key !== 'Tab' || !dentro || pilha[pilha.length - 1] !== eu) return
      const itens = Array.from(dentro.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(x => x.getClientRects().length > 0)
      if (!itens.length) { e.preventDefault(); return }
      const primeiro = itens[0], ultimo = itens[itens.length - 1]
      const atual = document.activeElement
      if (!dentro.contains(atual)) { e.preventDefault(); primeiro.focus(); return }
      if (e.shiftKey && (atual === primeiro || atual === dentro)) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && atual === ultimo) { e.preventDefault(); primeiro.focus() }
    }
    document.addEventListener('keydown', prender)

    return () => {
      document.removeEventListener('keydown', prender)
      const i = pilha.indexOf(eu)
      if (i >= 0) pilha.splice(i, 1)
      marcar()
      // fechou pelo X, pelo fundo ou pelo Esc: tira a entrada que a janela colocou no histórico
      // (se foi o voltar que fechou, a entrada já saiu)
      if (eu.temEntrada) {
        if (entradasLivres++ === 0) queueMicrotask(devolverLivres)
      }
      if (antes && document.contains(antes)) antes.focus({ preventScroll: true })
    }
  }, [aberta, caixa])
}

/** Mantém a janela na tela enquanto ela faz o movimento de sair. */
export function useFase(aberta: boolean, saida = 200): 'fechada' | 'aberta' | 'saindo' {
  const [fase, setFase] = useState<'fechada' | 'aberta' | 'saindo'>(aberta ? 'aberta' : 'fechada')
  useEffect(() => {
    if (aberta) { setFase('aberta'); return }
    setFase(f => (f === 'aberta' ? 'saindo' : f))
    const t = window.setTimeout(() => setFase('fechada'), saida)
    return () => window.clearTimeout(t)
  }, [aberta, saida])
  return fase
}

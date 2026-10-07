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

type Aberta = { fechar: () => void; peloVoltar: boolean }
const pilha: Aberta[] = []
let popsAIgnorar = 0
let ouvindo = false
let voltarFecha = true

/** A vitrine roda dentro de outra página: lá o histórico não é nosso, então desliga. */
export function configurarSobreposicao(opcoes: { voltarFecha?: boolean }) {
  if (typeof opcoes.voltarFecha === 'boolean') voltarFecha = opcoes.voltarFecha
}

function aoVoltar() {
  if (popsAIgnorar > 0) { popsAIgnorar--; return }
  const topo = pilha[pilha.length - 1]
  if (!topo) return
  topo.peloVoltar = true
  topo.fechar()
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
    const eu: Aberta = { fechar: () => fecharRef.current(), peloVoltar: false }
    pilha.push(eu)
    marcar()

    // voltar do Android: a janela coloca uma entrada no histórico; o voltar tira a entrada e fecha a janela
    let empurrou = false
    if (voltarFecha) {
      try { window.history.pushState({ ...(window.history.state || {}), uiJanela: true }, ''); empurrou = true } catch { /* sem histórico: segue sem o voltar */ }
    }

    // foco: entra na janela, fica preso nela e depois volta pra onde estava
    const antes = document.activeElement as HTMLElement | null
    const el = caixa.current
    if (el) (el.querySelector<HTMLElement>('[data-foco-inicial]') || el).focus({ preventScroll: true })
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
      if (empurrou && !eu.peloVoltar) {
        try { if (window.history.state?.uiJanela) { popsAIgnorar++; window.history.back() } } catch { /* nada */ }
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

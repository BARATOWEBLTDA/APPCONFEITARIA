/**
 * Abertura do app (07/10) — a tela de carregamento que está no index.html (#abertura).
 * Ela aparece na hora, antes de o app carregar, e some quando a primeira tela está pronta.
 *   · não tem mais espera fixa de 3 segundos: some assim que a tela de baixo aparece
 *   · fica pelo menos MINIMO ms no ar (pra não piscar em celular rápido)
 *   · se algo travar, some sozinha em LIMITE ms (nunca prende a pessoa)
 */
const MINIMO = 1500 // 1,5 s (07/10, pedido do Bruno: testar)
const LIMITE = 8000
let fechando = false

function fechar() {
  if (fechando) return
  fechando = true
  const el = document.getElementById('abertura')
  if (!el) return
  el.classList.add('saindo')
  window.setTimeout(() => el.remove(), 300)
}

/** A primeira tela já está desenhada? (o #root tem alguma coisa com tamanho) */
function telaPronta(): boolean {
  const raiz = document.getElementById('root')
  if (!raiz) return false
  return Array.from(raiz.querySelectorAll(':scope > *, :scope > * > *')).some(e => {
    const r = e.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  })
}

export function iniciarAbertura() {
  if (typeof document === 'undefined') return
  const el = document.getElementById('abertura')
  if (!el) return
  const tentar = () => {
    if (fechando) return
    if (!telaPronta()) return
    const falta = MINIMO - performance.now()
    if (falta > 0) window.setTimeout(fechar, falta)
    else fechar()
    observador.disconnect()
  }
  const observador = new MutationObserver(tentar)
  const raiz = document.getElementById('root')
  if (raiz) observador.observe(raiz, { childList: true, subtree: true })
  window.setTimeout(() => { observador.disconnect(); fechar() }, LIMITE)
  tentar()
}

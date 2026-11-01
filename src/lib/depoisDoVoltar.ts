/** Roda `fn` depois que o "voltar" das boas-vindas terminar (a apresentação empilha telas no histórico). */
export function depoisDoVoltar(fn: () => void) {
  let foi = false
  const ir = () => { if (!foi) { foi = true; fn() } }
  if (window.history.state?.bvTela) { window.addEventListener('popstate', () => setTimeout(ir, 0), { once: true }); setTimeout(ir, 600) }
  else ir()
}

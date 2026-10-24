/**
 * (24/10) Texto dos sabores de um kit, igual em todo lugar (sacola, pedido enviado, acompanhar, pedido no painel):
 * "50 coxinhas · 50 risoles". Antes cada tela escrevia de um jeito ("50 Coxinha, 50 Risole", "50 de coxinha").
 */

/** "Brigadeiro" → "brigadeiros", "Beijinho de coco" → "beijinhos de coco", "Pão de mel" → "pães de mel" */
export function pluralSabor(nome: string, qtd: number): string {
  const n = String(nome || '').trim()
  if (!n) return ''
  const [p1, ...resto] = n.split(' ')
  let w = p1.charAt(0).toLowerCase() + p1.slice(1)
  if (qtd > 1) {
    if (/^pão$/i.test(w)) w = 'pães'
    else if (/ão$/i.test(w)) w = w.replace(/ão$/i, 'ões')
    else if (/[aeiouáéíóú]$/i.test(w)) w = w + 's'
    else if (/[rzs]$/i.test(w)) w = /s$/i.test(w) ? w : w + 'es'
    else if (/l$/i.test(w)) w = w.replace(/l$/i, 'is')
    else if (/m$/i.test(w)) w = w.replace(/m$/i, 'ns')
  }
  return [w, ...resto].join(' ')
}

/** "50 coxinhas · 50 risoles" */
export function textoSaboresKit(sabores: { nome: string; qtd: number }[] | null | undefined, sep = ' · '): string {
  return (sabores || []).filter(x => Number(x?.qtd) > 0).map(x => `${x.qtd} ${pluralSabor(x.nome, Number(x.qtd))}`).join(sep)
}

/** (24/10) Nome do complemento com a frase que o cliente escreveu: 'Escrita no bolo: "Parabéns, Ana!"' */
export function nomeExtra(x: any): string {
  const nome = String((x && (x.nome || x.name)) || '').trim()
  const frase = String((x && x.frase) || '').trim()
  return frase ? `${nome}: “${frase}”` : nome
}

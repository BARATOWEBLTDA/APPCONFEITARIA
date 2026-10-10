/**
 * Nome curto da loja pra saudação do topo (09/10 · 4.01).
 * Tira a palavra do ramo ("Confeitaria", "Doceria", "Ateliê"…) e o que vem depois de traço ou barra,
 * pra "Olá, …" e a etiqueta do plano caberem na mesma linha.
 *   "Confeitaria Doce Formiga"        → "Doce Formiga"
 *   "Doce Formiga Confeitaria"        → "Doce Formiga"
 *   "Ateliê Ana Bolos - doces finos"  → "Ana Bolos"
 *   "Doces da Ju"                     → "Doces da Ju" (sem o ramo sobraria "da Ju", então fica igual)
 *   "Confeitaria"                     → "Confeitaria" (não sobra nada, fica igual)
 */

const RAMO = new Set([
  'confeitaria', 'doceria', 'atelie', 'atelier', 'ateliê', 'padaria', 'panificadora', 'brigaderia', 'boleria',
  'bolaria', 'casa', 'cozinha', 'studio', 'estudio', 'loja', 'emporio', 'bakery', 'patisserie', 'confectionery',
  'cafeteria', 'docinhos', 'doceira', 'confeiteira', 'confeiteiro', 'ltda', 'me', 'mei', 'eireli',
])
// palavra que não pode abrir o nome depois de tirar o ramo ("da Ju")
const LIGACAO = new Set(['de', 'da', 'do', 'das', 'dos', 'e', '&', 'a', 'o', 'the', 'di', 'du'])

// palavra que sozinha não é nome ("Brigaderia Gourmet" fica igual)
const GENERICO = new Set(['gourmet', 'artesanal', 'fina', 'finos', 'fino', 'doce', 'doces', 'bolos', 'bolo', 'delicias',
  'sabor', 'sabores', 'arte', 'encanto', 'premium', 'chic', 'house', 'cake', 'cakes', 'festa', 'festas'])

const limpar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function nomeCurtoLoja(nomeLoja?: string | null): string {
  const original = String(nomeLoja || '').replace(/\s+/g, ' ').trim()
  if (!original) return ''
  // corta slogan depois de traço, barra, ponto ou parêntese: "Doce Formiga - bolos e doces"
  let p = original.split(/\s[-–—|·•]\s|\s?\(|\s\/\s/)[0].trim().split(' ')
  if (!p.length || !p[0]) return original

  // tira o ramo do começo (quantas vezes aparecer: "Casa Confeitaria Ana")
  while (p.length > 1 && RAMO.has(limpar(p[0])) && !LIGACAO.has(limpar(p[1]))) p = p.slice(1)
  // tira o ramo e a sigla da empresa do fim, se sobrar pelo menos 1 palavra
  // ("Doce Formiga Confeitaria e Doceria": tira também a ligação que fica sobrando no fim)
  const sobra = (w: string) => { const l = limpar(w.replace(/[.,]/g, '')); return RAMO.has(l) || LIGACAO.has(l) }
  while (p.length > 1 && sobra(p[p.length - 1])) p = p.slice(0, -1)

  if (p.length === 1 && GENERICO.has(limpar(p[0]))) return original
  const curto = p.join(' ').replace(/[,.;:]+$/, '').trim()
  return curto || original
}

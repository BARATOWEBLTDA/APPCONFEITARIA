/**
 * Como um item aparece na sacola, no pedido enviado e na mensagem do WhatsApp (08/10 · 3.30).
 * Antes o bolo vendido por kg COM tamanho aparecia como "1kg" e "R$ 240,00/kg" na sacola,
 * mesmo o tamanho já definindo o peso (o preço é do bolo inteiro).
 */

/** Por kg e sem tamanho/kit: a quantidade é o peso (anda de 0,5 em 0,5). */
export function kgLivre(item: any): boolean {
  return item?.saleType === 'kg' && !item?.escolhas?.tamanho && !item?.escolhas?.kit
}

const num = (n: number) => String(n).replace('.', ',')

/**
 * Peso (em kg) escrito no nome do tamanho (10/10): "0,5kg" → 0.5 · "1kg" → 1 · "1,5 kg" → 1.5 · "500g" → 0.5 · "P (2 quilos)" → 2.
 * Rede de segurança pro tamanho vendido "pelo peso" que foi cadastrado sem o peso (peso_kg vazio).
 * Devolve 0 quando o nome não tem peso (ou o número não faz sentido): aí quem chama mantém o que fazia.
 */
export function pesoDoNome(nome: unknown): number {
  const texto = String(nome ?? '')
  const achados = [...texto.matchAll(/(\d+(?:[.,]\d+)?)\s*(kgs?|quilos?|kilos?|gramas?|grs?|g)(?![a-zà-ú])/gi)]
  // Dois pesos no nome ("1kg e 500g"), fração ("1/2 kg") ou faixa ("2 a 3 kg"): não dá pra ter certeza
  if (achados.length !== 1) return 0
  const m = achados[0]
  if (/(?:\/|\d\s*(?:a|à|até|ou|e|-|–))\s*$/i.test(texto.slice(0, m.index))) return 0
  // "1 kg e meio", "1kg500": tem mais peso depois do número, não dá pra ter certeza
  if (/^\s*(e\s+mei[oa]\b|\d)/i.test(texto.slice((m.index ?? 0) + m[0].length))) return 0
  const emKg = /^[kq]/i.test(m[2])
  // em gramas, "1.500g" é mil e quinhentos (ponto de milhar)
  const n = parseFloat((emKg ? m[1] : m[1].replace(/[.,](?=\d{3}$)/, '')).replace(',', '.'))
  const kg = emKg ? n : n / 1000
  return kg >= 0.05 && kg <= 100 ? Math.round(kg * 1000) / 1000 : 0
}

/** Peso de uma opção de tamanho vendida pelo peso: o cadastrado; se faltar, o que está escrito no nome. */
export function pesoDoTamanho(op: any, porPeso: boolean): number {
  const p = Number(op?.peso_kg) || 0
  if (p > 0) return p
  return porPeso ? pesoDoNome(op?.nome) : 0
}

/** "2×" ou "1,5 kg" */
export function qtdItem(item: any): string {
  return kgLivre(item) ? `${num(item.quantity)} kg` : `${Math.floor(Number(item.quantity) || 0)}×`
}

/** Quantos itens tem na sacola (peso livre conta 1). */
export function contarItens(items: any[]): number {
  return (items || []).reduce((acc, i) => acc + (kgLivre(i) ? 1 : Math.floor(Number(i.quantity) || 0)), 0)
}

/** "M · 2 kg", "Massa chocolate", "Recheios: brigadeiro e ninho"… */
export function detalhesItem(item: any): string[] {
  const ls: string[] = []
  const e = item?.escolhas
  if (e) {
    if (e.tamanho?.nome) {
      const peso = e.tamanho.peso_kg ? `${num(e.tamanho.peso_kg)} kg` : ''
      const nomeTemPeso = peso && e.tamanho.nome.replace(/\s/g, '').toLowerCase().includes(peso.replace(/\s/g, '').toLowerCase())
      ls.push(peso && !nomeTemPeso ? `${e.tamanho.nome} · ${peso}` : e.tamanho.nome)
    }
    if (e.sabor?.nome) ls.push(`Sabor ${e.sabor.nome}`)
    if (e.massa?.nome) ls.push(`Massa ${e.massa.nome}`)
    if (e.recheios?.length) {
      const n = e.recheios.map((r: any) => r.nome)
      ls.push(`Recheio${n.length > 1 ? 's' : ''} ${n.length > 1 ? n.slice(0, -1).join(', ') + ' e ' + n[n.length - 1] : n[0]}`)
    }
    if (e.cobertura?.nome) ls.push(`Cobertura ${e.cobertura.nome}`)
  } else {
    if (item?.selectedMassa) ls.push(`Massa ${item.selectedMassa}`)
    if (item?.selectedRecheio) ls.push(`Recheio ${item.selectedRecheio}`)
    if (item?.selectedCobertura) ls.push(`Cobertura ${item.selectedCobertura}`)
  }
  if (Array.isArray(item?.extrasBiblioteca)) item.extrasBiblioteca.forEach((x: any) => ls.push(x.nome))
  return ls
}

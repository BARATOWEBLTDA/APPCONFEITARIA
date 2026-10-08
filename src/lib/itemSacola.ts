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

/**
 * (29/10 · 5.16) Bairros de uma cidade, pelo OpenStreetMap (Overpass, grátis). Não existe lista oficial de bairros
 * no IBGE; o mapa aberto tem os bairros das cidades (limites de bairro e pontos de bairro).
 * Busca uma vez por cidade e guarda no aparelho por 30 dias. Sem internet ou sem resposta: lista vazia.
 */
const UF_NOME: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo',
  GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba',
  PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
  RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
}
const DIAS30 = 30 * 24 * 60 * 60 * 1000

export async function bairrosDaCidade(cidade: string, uf: string): Promise<string[]> {
  const c = String(cidade || '').trim(), u = String(uf || '').trim().toUpperCase()
  if (!c) return []
  const chave = `doonly_bairros_${u}_${c.toLowerCase()}`
  try {
    const g = JSON.parse(localStorage.getItem(chave) || 'null')
    if (g && Array.isArray(g.l) && Date.now() - g.em < DIAS30) return g.l
  } catch { /* sem armazenamento */ }
  const esc = (x: string) => x.replace(/["\\]/g, '')
  const estado = UF_NOME[u]
  const cidadeSel = estado
    ? `rel["boundary"="administrative"]["admin_level"="4"]["name"="${esc(estado)}"];map_to_area->.uf;rel(area.uf)["boundary"="administrative"]["admin_level"="8"]["name"="${esc(c)}"];`
    : `rel["boundary"="administrative"]["admin_level"="8"]["name"="${esc(c)}"];`
  const q = `[out:json][timeout:20];${cidadeSel}map_to_area->.a;(rel["boundary"="administrative"]["admin_level"~"^(9|10)$"](area.a);node["place"~"^(suburb|neighbourhood|quarter)$"](area.a););out tags;`
  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: q }) })
    if (!r.ok) return []
    const j = await r.json()
    const nomes = new Map<string, string>()
    for (const e of j?.elements || []) {
      const n = String(e?.tags?.name || '').trim()
      if (n && n.toLowerCase() !== c.toLowerCase()) nomes.set(n.toLowerCase(), n)
    }
    const l = [...nomes.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    try { localStorage.setItem(chave, JSON.stringify({ em: Date.now(), l })) } catch { /* sem armazenamento */ }
    return l
  } catch { return [] }
}

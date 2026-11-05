/**
 * (6.115) Contorno de um bairro no mapa, pelo OpenStreetMap (Nominatim, grátis): o mesmo serviço que já acha os endereços.
 * Cidades grandes têm o limite de cada bairro no mapa; quando não tem, devolve só o ponto do bairro.
 * Guarda no aparelho por 30 dias e faz uma busca por vez, com 1 segundo entre elas (regra de uso do Nominatim).
 */
export type Area = { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] }
export type Contorno = { tipo: 'area'; geo: Area } | { tipo: 'ponto'; lat: number; lng: number }

const DIAS30 = 30 * 24 * 60 * 60 * 1000
const memoria = new Map<string, Contorno | null>()
let fila: Promise<unknown> = Promise.resolve()
const semAc = (x: string) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

type Resultado = { lat: string; lon: string; class?: string; type?: string; display_name?: string; geojson?: { type: string; coordinates: unknown } }

export function contornoDoBairro(bairro: string, cidade: string, uf: string): Promise<Contorno | null> {
  const b = String(bairro || '').trim(), c = String(cidade || '').trim(), u = String(uf || '').trim().toUpperCase()
  if (!b || !c) return Promise.resolve(null)
  const chave = `doonly_contorno_${u}_${semAc(c)}_${semAc(b)}`
  if (memoria.has(chave)) return Promise.resolve(memoria.get(chave)!)
  try {
    const g = JSON.parse(localStorage.getItem(chave) || 'null')
    if (g && Date.now() - g.em < DIAS30) { memoria.set(chave, g.c); return Promise.resolve(g.c) }
  } catch { /* sem armazenamento */ }
  const buscar = async (): Promise<Contorno | null> => {
    if (memoria.has(chave)) return memoria.get(chave)!
    const q = new URLSearchParams({ format: 'jsonv2', q: `${b}, ${c}${u ? `, ${u}` : ''}`, countrycodes: 'br', limit: '5', polygon_geojson: '1', polygon_threshold: '0.0002' })
    let l: Resultado[] = []
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, { headers: { 'Accept-Language': 'pt-BR' } })
      if (!r.ok) return null // servidor cheio: não guarda, tenta de novo na próxima vez
      l = await r.json()
    } catch { return null }
    // só vale um resultado da mesma cidade (o nome do bairro existe em várias cidades)
    const daCidade = (Array.isArray(l) ? l : []).filter(x => semAc(x.display_name || '').includes(semAc(c)))
    const area = daCidade.find(x => (x.geojson?.type === 'Polygon' || x.geojson?.type === 'MultiPolygon') && (x.class === 'boundary' || x.class === 'place'))
    const ponto = daCidade.find(x => x.class === 'place' || x.class === 'boundary') || daCidade[0]
    const res: Contorno | null = area ? { tipo: 'area', geo: area.geojson as Area }
      : ponto ? { tipo: 'ponto', lat: Number(ponto.lat), lng: Number(ponto.lon) } : null
    memoria.set(chave, res)
    try { localStorage.setItem(chave, JSON.stringify({ em: Date.now(), c: res })) } catch { /* sem espaço: só não guarda */ }
    return res
  }
  // uma busca por vez, com 1,1 s entre elas
  const p = fila.then(buscar, buscar)
  const espera = () => new Promise(ok => setTimeout(ok, 1100))
  fila = p.then(espera, espera)
  return p
}

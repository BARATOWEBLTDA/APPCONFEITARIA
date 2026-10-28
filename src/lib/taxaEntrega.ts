/**
 * (28/10 · 4.49) Taxa de entrega: única, por bairro, por raio (km) ou por cidade.
 * O ponto no mapa vem do Nominatim (busca de endereço gratuita do OpenStreetMap), o mesmo do minimapa da loja.
 * A distância é em linha reta. No cardápio, quem decide a taxa é o banco (função cardapio_taxa_entrega),
 * que não mostra o ponto da loja pra ninguém.
 */
export type ModoEntrega = 'fixa' | 'bairro' | 'raio' | 'cidade'
export type FaixaRaio = { km: number; valor: number }
export type TaxaCidade = { cidade: string; valor: number }
export type Ponto = { lat: number; lng: number }

/** O modo gravado; sem ele (lojas antigas), a lista de bairros decide */
export function modoDaLoja(cfg: { entrega_modo?: string | null; entrega_por_bairro?: any[] | null }): ModoEntrega {
  const m = cfg.entrega_modo
  if (m === 'fixa' || m === 'bairro' || m === 'raio' || m === 'cidade') return m
  return Array.isArray(cfg.entrega_por_bairro) && cfg.entrega_por_bairro.length > 0 ? 'bairro' : 'fixa'
}

/** Distância em linha reta (km, 2 casas), igual à do banco (distancia_km) */
export function distanciaKm(a: Ponto, b: Ponto): number {
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)) * 100) / 100
}

/** Faixas válidas, da menor pra maior distância */
export function faixasOrdenadas(lista: { km: number | string; valor: number | string; ativo?: boolean }[]): FaixaRaio[] {
  return (lista || [])
    .filter(f => f.ativo !== false) // (28/10) faixa desmarcada não vale
    .map(f => ({ km: Number(String(f.km).replace(',', '.')), valor: Number(String(f.valor).replace(',', '.')) }))
    .filter(f => Number.isFinite(f.km) && f.km > 0 && Number.isFinite(f.valor) && f.valor >= 0)
    .sort((a, b) => a.km - b.km)
}

/** A taxa pela distância: a primeira faixa que cobre os km; fora delas, o valor de fora (ou não entrega) */
export function taxaPorRaio(faixas: FaixaRaio[], km: number, fora: number | null): { ok: true; valor: number } | { ok: false } {
  const f = faixasOrdenadas(faixas).find(x => x.km >= km)
  if (f) return { ok: true, valor: f.valor }
  return fora != null ? { ok: true, valor: Math.max(0, fora) } : { ok: false }
}

/** A taxa da cidade (sem acento e sem diferença de maiúscula); fora da lista, o valor de fora (ou não entrega) */
export const semAcento = (s: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
export function taxaPorCidade(lista: TaxaCidade[], cidade: string, fora: number | null): { ok: true; valor: number; cidade?: string } | { ok: false } {
  const c = (lista || []).find(x => (x as any).ativo !== false && semAcento(x.cidade) === semAcento(cidade))
  if (c) return { ok: true, valor: Math.max(0, Number(c.valor) || 0), cidade: c.cidade }
  return fora != null ? { ok: true, valor: Math.max(0, fora) } : { ok: false }
}

/** "4,2 km" */
export const kmTexto = (km: number) => `${(Math.round(km * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`

const cache = new Map<string, Ponto | null>()
let fila: Promise<unknown> = Promise.resolve()
/** O Nominatim pede no máximo uma busca por segundo: as buscas entram numa fila */
function naFila<T>(f: () => Promise<T>): Promise<T> {
  const p = fila.then(f, f)
  fila = p.then(() => new Promise(r => setTimeout(r, 1100)), () => new Promise(r => setTimeout(r, 1100)))
  return p
}
async function buscar(params: Record<string, string>): Promise<Ponto | null> {
  const chave = JSON.stringify(params)
  if (cache.has(chave)) return cache.get(chave)!
  const u = new URLSearchParams({ format: 'json', limit: '1', countrycodes: 'br', ...params })
  const r = await naFila(async () => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${u}`, { headers: { 'Accept-Language': 'pt-BR' } })
      const j = await res.json()
      return j?.[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon) } : null
    } catch { return undefined }
  })
  if (r === undefined) return null // falhou a internet: não guarda no cache
  cache.set(chave, r)
  return r
}

/** Acha o ponto de um endereço: rua com número → rua → CEP. Sem cidade nem CEP, não busca. */
export async function pontoDoEndereco(e: { rua?: string; numero?: string; bairro?: string; cidade?: string; estado?: string; cep?: string }): Promise<Ponto | null> {
  const rua = (e.rua || '').trim(), num = (e.numero || '').trim(), cidade = (e.cidade || '').trim()
  const cep = (e.cep || '').replace(/\D/g, '')
  if (rua && cidade) {
    const base: Record<string, string> = { city: cidade, ...(e.estado ? { state: e.estado } : {}) }
    const p1 = await buscar({ ...base, street: num ? `${num} ${rua}` : rua })
    if (p1) return p1
    if (num) { const p2 = await buscar({ ...base, street: rua }); if (p2) return p2 }
  }
  if (cep.length === 8) { const p3 = await buscar({ postalcode: `${cep.slice(0, 5)}-${cep.slice(5)}` }); if (p3) return p3 }
  return null
}

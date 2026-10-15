import { useEffect, useRef, useState } from "react";
import type { Map as LMapa, Marker } from "leaflet";

/**
 * (15/10) Minimapa do endereço (passo 3): começa no Brasil inteiro e, quando o endereço é achado,
 * vai dando zoom até a rua com um pino. Mapa gratuito (OpenStreetMap + Leaflet), carregado só quando abre.
 * A posição vem do Nominatim (busca de endereço do OpenStreetMap), com cache e uma busca por vez.
 */
export type BuscaMapa = { rua?: string; numero?: string; cidade: string; estado?: string } | null;

const BRASIL: [number, number] = [-14.6, -52];
const cache = new Map<string, [number, number] | null>();

async function acharPonto(q: string, params: Record<string, string>): Promise<[number, number] | null> {
  if (cache.has(q)) return cache.get(q)!;
  const u = new URLSearchParams({ format: "json", limit: "1", countrycodes: "br", ...params });
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${u}`, { headers: { "Accept-Language": "pt-BR" } });
    const j = await r.json();
    const p: [number, number] | null = j?.[0] ? [Number(j[0].lat), Number(j[0].lon)] : null;
    cache.set(q, p);
    return p;
  } catch { return null; }
}

/** Da rua com número até só a cidade: o primeiro que achar */
async function localizar(b: NonNullable<BuscaMapa>, soCidade: boolean): Promise<{ p: [number, number]; rua: boolean } | null> {
  const base = { city: b.cidade, ...(b.estado ? { state: b.estado } : {}) };
  if (!soCidade && b.rua) {
    const comNum = b.numero ? `${b.numero} ${b.rua}` : b.rua;
    const p1 = await acharPonto(`r|${comNum}|${b.cidade}|${b.estado}`, { ...base, street: comNum });
    if (p1) return { p: p1, rua: true };
    if (b.numero) {
      const p2 = await acharPonto(`r|${b.rua}|${b.cidade}|${b.estado}`, { ...base, street: b.rua });
      if (p2) return { p: p2, rua: true };
    }
  }
  const p3 = await acharPonto(`c|${b.cidade}|${b.estado}`, base);
  return p3 ? { p: p3, rua: false } : null;
}

export default function MapaEndereco({ busca, soCidade, selo }: { busca: BuscaMapa; soCidade: boolean; selo: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<LMapa | null>(null);
  const pino = useRef<Marker | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const [pronto, setPronto] = useState(false);

  // carrega o Leaflet só aqui (não pesa no resto do app)
  useEffect(() => {
    let vivo = true;
    Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]).then(([mod]) => {
      if (!vivo || !caixa.current || mapa.current) return;
      const Lf = (mod as any).default || mod;
      L.current = Lf;
      const m = Lf.map(caixa.current, { center: BRASIL, zoom: 3, zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, attributionControl: true });
      m.attributionControl.setPrefix(false);
      Lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      m.fitBounds([[-33.8, -73.9], [5.3, -34.8]], { animate: false });
      mapa.current = m;
      setPronto(true);
    }).catch(() => {});
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null; };
  }, []);

  // achou o endereço: voa até ele; sem endereço: volta pro Brasil
  const chave = busca ? `${busca.rua}|${busca.numero}|${busca.cidade}|${busca.estado}|${soCidade}` : "";
  useEffect(() => {
    const m = mapa.current, Lf = L.current;
    if (!pronto || !m || !Lf) return;
    let vivo = true;
    if (!busca) {
      pino.current?.remove(); pino.current = null;
      m.flyToBounds([[-33.8, -73.9], [5.3, -34.8]], { duration: 1 });
      return;
    }
    localizar(busca, soCidade).then(r => {
      if (!vivo || !r || !mapa.current) return;
      const zoom = r.rua ? 17 : 12;
      m.flyTo(r.p, zoom, { duration: 1.2 });
      if (r.rua) {
        const icone = Lf.divIcon({ className: "mpe-pino", html: "<i></i>", iconSize: [28, 36], iconAnchor: [14, 34] });
        if (pino.current) pino.current.setLatLng(r.p); else pino.current = Lf.marker(r.p, { icon: icone, interactive: false }).addTo(m);
      } else { pino.current?.remove(); pino.current = null; }
    });
    return () => { vivo = false; };
  }, [pronto, chave]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mpe" aria-hidden="true">
      <div ref={caixa} className="mpe-mapa" />
      {selo && <span className="mpe-selo">{selo}</span>}
      <style>{`
        .mpe { position: relative; margin-top: 18px; height: 170px; border-radius: 14px; overflow: hidden; border: 1px solid var(--ui-borda); background: #DDEBF3; isolation: isolate; }
        .mpe-mapa { position: absolute; inset: 0; background: #DDEBF3; }
        .mpe .leaflet-control-attribution { font-size: 9px; padding: 0 4px; background: rgba(255,255,255,.7); }
        .mpe-selo { position: absolute; left: 10px; bottom: 10px; z-index: 500; max-width: calc(100% - 20px); padding: 5px 9px; border-radius: 8px; background: var(--ui-branco); box-shadow: 0 2px 8px rgba(0,0,0,.12); font-size: 12.5px; font-weight: 600; color: var(--ui-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mpe-pino { background: none; border: 0; }
        .mpe-pino i { display: block; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: var(--ui-rosa); box-shadow: 0 3px 8px rgba(0,0,0,.25); }
        .mpe-pino i::after { content: ""; position: absolute; left: 9px; top: 9px; width: 10px; height: 10px; border-radius: 50%; background: #fff; }
        @media (max-height: 700px) { .mpe { height: 136px; } }
      `}</style>
    </div>
  );
}

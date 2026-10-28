import { useEffect, useRef, useState } from "react";
import type { Map as LMapa, LayerGroup } from "leaflet";
import type { FaixaRaio, Ponto } from "@/lib/taxaEntrega";

/**
 * (28/10 · 4.49) Mapa dos raios de entrega: a loja no meio e um círculo por faixa de km.
 * Mapa gratuito (OpenStreetMap + Leaflet), carregado só quando abre. Os círculos mudam na hora em que
 * a confeiteira mexe nos km, e o mapa enquadra o maior deles.
 */
const CORES = ["#E85A8C", "#EE8DB0", "#F4C0D1", "#F7D3DF", "#FAE3EA"];

export default function MapaRaios({ loja, faixas, nome }: { loja: Ponto; faixas: FaixaRaio[]; nome: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<LMapa | null>(null);
  const camada = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]).then(([mod]) => {
      if (!vivo || !caixa.current || mapa.current) return;
      const Lf = (mod as any).default || mod;
      L.current = Lf;
      const m = Lf.map(caixa.current, { center: [loja.lat, loja.lng], zoom: 12, zoomControl: true, scrollWheelZoom: false, attributionControl: true });
      m.attributionControl.setPrefix(false);
      Lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      camada.current = Lf.layerGroup().addTo(m);
      mapa.current = m;
      setPronto(true);
    }).catch(() => {});
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const chave = `${loja.lat}|${loja.lng}|${faixas.map(f => f.km).join(",")}`;
  useEffect(() => {
    const m = mapa.current, Lf = L.current, g = camada.current;
    if (!pronto || !m || !Lf || !g) return;
    g.clearLayers();
    const ordem = [...faixas].sort((a, b) => b.km - a.km); // o maior primeiro, pra os menores ficarem por cima
    ordem.forEach(f => {
      const i = faixas.indexOf(f);
      Lf.circle([loja.lat, loja.lng], { radius: f.km * 1000, color: CORES[Math.min(i, CORES.length - 1)], weight: 1.5, opacity: 0.8, fillOpacity: 0.1, dashArray: i === 0 ? undefined : "5 4", interactive: false }).addTo(g);
    });
    const icone = Lf.divIcon({ className: "mpr-pino", html: "<i></i>", iconSize: [28, 36], iconAnchor: [14, 34] });
    Lf.marker([loja.lat, loja.lng], { icon: icone, interactive: false }).addTo(g);
    const maior = Math.max(1, ...faixas.map(f => f.km));
    const b = Lf.latLng(loja.lat, loja.lng).toBounds(maior * 2000 * 1.08);
    m.fitBounds(b, { animate: false });
  }, [pronto, chave]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mpr" role="img" aria-label={`Mapa com ${faixas.length} ${faixas.length === 1 ? "raio" : "raios"} de entrega em volta da loja`}>
      <div ref={caixa} className="mpr-mapa" />
      {nome && <span className="mpr-selo">{nome}</span>}
      <style>{`
        .mpr { position: relative; height: 240px; border-radius: 12px; overflow: hidden; border: 1px solid var(--ui-borda); background: #DDEBF3; isolation: isolate; }
        .mpr-mapa { position: absolute; inset: 0; background: #DDEBF3; }
        .mpr .leaflet-control-attribution { font-size: 9px; padding: 0 4px; background: rgba(255,255,255,.7); }
        .mpr-selo { position: absolute; left: 10px; bottom: 10px; z-index: 500; max-width: calc(100% - 20px); padding: 5px 9px; border-radius: 8px; background: var(--ui-branco); box-shadow: 0 2px 8px rgba(0,0,0,.12); font-size: 12.5px; font-weight: 500; color: var(--ui-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mpr-pino { background: none; border: 0; }
        .mpr-pino i { display: block; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: var(--ui-rosa); box-shadow: 0 3px 8px rgba(0,0,0,.25); }
        .mpr-pino i::after { content: ""; position: absolute; left: 9px; top: 9px; width: 10px; height: 10px; border-radius: 50%; background: #fff; }
        @media (min-width: 901px) { .mpr { height: 280px; } }
      `}</style>
    </div>
  );
}

export { CORES as CORES_RAIO };

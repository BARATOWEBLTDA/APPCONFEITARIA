import { useEffect, useRef, useState } from "react";
import type { Map as LMapa, LayerGroup, LatLngBounds } from "leaflet";
import { contornoDoBairro, type Contorno } from "@/lib/contornoBairro";

/**
 * (6.115) Mapa da entrega "Por bairro": cada bairro com taxa aparece contornado, com o valor no meio.
 * Mesmo mapa grátis do resto do app (OpenStreetMap + Leaflet). Os contornos chegam um por um (Nominatim) e o
 * mapa enquadra os bairros. Bairro sem contorno no mapa aparece como um ponto com o valor.
 */
type BairroTaxa = { bairro: string; valor: number };
const BRASIL: [number, number] = [-14.6, -52];
const brl = (v: number) => (v > 0 ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Grátis");
const semAc = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const esc = (x: string) => x.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export default function MapaBairros({ bairros, cidade, uf, altura = 320 }: { bairros: BairroTaxa[]; cidade: string; uf: string; altura?: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<LMapa | null>(null);
  const camada = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const [pronto, setPronto] = useState(false);
  const [achados, setAchados] = useState<Record<string, Contorno | null>>({});

  useEffect(() => {
    let vivo = true;
    Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]).then(([mod]) => {
      if (!vivo || !caixa.current || mapa.current) return;
      const Lf = (mod as { default?: typeof import("leaflet") }).default || mod;
      L.current = Lf;
      const m = Lf.map(caixa.current, { center: BRASIL, zoom: 4, zoomControl: true, scrollWheelZoom: false, attributionControl: true });
      m.attributionControl.setPrefix(false);
      Lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      camada.current = Lf.layerGroup().addTo(m);
      mapa.current = m;
      setPronto(true);
    }).catch(() => {});
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null; };
  }, []);

  // busca o contorno de cada bairro (um por vez; o que já está guardado no aparelho chega na hora)
  const nomes = bairros.map(b => b.bairro.trim()).filter(Boolean);
  const chaveNomes = `${cidade}|${uf}|${nomes.map(semAc).join(",")}`;
  useEffect(() => {
    let vivo = true;
    nomes.forEach(n => {
      if (semAc(n) in achados) return;
      contornoDoBairro(n, cidade, uf).then(c => { if (vivo) setAchados(a => ({ ...a, [semAc(n)]: c })); });
    });
    return () => { vivo = false; };
  }, [chaveNomes]); // eslint-disable-line react-hooks/exhaustive-deps

  const chaveDesenho = `${pronto}|${bairros.map(b => `${semAc(b.bairro)}:${b.valor}`).join(",")}|${Object.keys(achados).length}`;
  useEffect(() => {
    const m = mapa.current, Lf = L.current, g = camada.current;
    if (!pronto || !m || !Lf || !g) return;
    g.clearLayers();
    let caixaTudo: LatLngBounds | null = null;
    const somar = (b: LatLngBounds) => { caixaTudo = caixaTudo ? caixaTudo.extend(b) : Lf.latLngBounds(b.getSouthWest(), b.getNorthEast()); };
    bairros.forEach(b => {
      const c = achados[semAc(b.bairro.trim())];
      if (!c) return;
      const rotulo = `<div class="mpb-l"><b>${esc(b.bairro.trim())}</b><span>${esc(brl(b.valor))}</span></div>`;
      if (c.tipo === "area") {
        const forma = Lf.geoJSON(c.geo as GeoJSON.GeoJsonObject, { style: { color: "#E85A8C", weight: 2, opacity: 0.9, fillColor: "#E85A8C", fillOpacity: 0.16 }, interactive: false }).addTo(g);
        const lim = forma.getBounds();
        if (lim.isValid()) {
          somar(lim);
          Lf.marker(lim.getCenter(), { icon: Lf.divIcon({ className: "mpb-rot", html: rotulo, iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(g);
        }
      } else {
        Lf.circleMarker([c.lat, c.lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#E85A8C", fillOpacity: 1, interactive: false }).addTo(g);
        Lf.marker([c.lat, c.lng], { icon: Lf.divIcon({ className: "mpb-rot mpb-rot--pt", html: rotulo, iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(g);
        somar(Lf.latLng(c.lat, c.lng).toBounds(1200));
      }
    });
    if (caixaTudo) m.fitBounds(caixaTudo, { padding: [24, 24], maxZoom: 15, animate: false });
  }, [chaveDesenho]); // eslint-disable-line react-hooks/exhaustive-deps

  const buscando = nomes.some(n => !(semAc(n) in achados));
  const semMapa = nomes.filter(n => semAc(n) in achados && achados[semAc(n)] === null);
  const legenda = buscando ? "Achando os bairros no mapa…"
    : !nomes.length ? "Adicione os bairros abaixo e eles aparecem no mapa."
    : semMapa.length ? `Não achei no mapa: ${semMapa.join(", ")}`
    : "Contorno aproximado de cada bairro.";

  return (
    <div className="mpb-w">
      <div className="mpb" style={{ height: altura }} role="group" aria-label={`Mapa com ${nomes.length} ${nomes.length === 1 ? "bairro" : "bairros"} de entrega`}>
        <div ref={caixa} className="mpb-mapa" />
      </div>
      <p className="ep-mapa-leg">{legenda}</p>
      <style>{`
        .mpb-w { display: flex; flex-direction: column; gap: 6px; }
        .mpb { position: relative; border-radius: 12px; overflow: hidden; border: 1px solid var(--ui-borda); background: #EEF0EE; isolation: isolate; }
        .mpb-mapa { position: absolute; inset: 0; }
        .mpb .leaflet-control-attribution { font-size: 9px; padding: 0 4px; background: rgba(255,255,255,.7); }
        .mpb-rot { background: none; border: 0; }
        .mpb-l { position: absolute; left: 0; top: 0; transform: translate(-50%, -50%); padding: 3px 9px; border-radius: 9px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.16); text-align: center; white-space: nowrap; pointer-events: none; line-height: 1.25; }
        .mpb-rot--pt .mpb-l { transform: translate(-50%, calc(-100% - 10px)); }
        .mpb-l b { display: block; font-size: 11.5px; font-weight: 600; color: var(--ui-texto); }
        .mpb-l span { display: block; font-size: 11.5px; font-weight: 500; color: var(--ui-rosa-escuro); }
        @media (min-width: 901px) { .mpb { height: ${Math.max(altura, 320)}px !important; } }
      `}</style>
    </div>
  );
}

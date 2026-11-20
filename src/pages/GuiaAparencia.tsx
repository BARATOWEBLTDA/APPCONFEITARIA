/**
 * (20/11) Guia da Aparência nova, com cara própria (o destaque padrão do app ficou feio aqui):
 * a tela escurece, um foco de luz desliza até cada lugar e a explicação aparece escrita à mão,
 * direto em cima do cardápio, com uma setinha. Sem caixa branca. Tocar em qualquer lugar avança.
 */
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

export type PassoGuia = { alvo: string; titulo: string; texto: string; folga?: number };

type Caixa = { x: number; y: number; w: number; h: number; r: number };

export default function GuiaAparencia({ passos, aoFechar }: { passos: PassoGuia[]; aoFechar: () => void }) {
  const [i, setI] = useState(0);
  const [c, setC] = useState<Caixa | null>(null);
  const passo = passos[i];
  const ultimo = i === passos.length - 1;

  useLayoutEffect(() => {
    let vivo = true;
    const medir = () => {
      const el = document.querySelector<HTMLElement>(passo.alvo);
      if (!el || !vivo) return;
      const b = el.getBoundingClientRect();
      const f = passo.folga ?? 6;
      const raio = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 12;
      setC({ x: b.left - f, y: b.top - f, w: b.width + f * 2, h: b.height + f * 2, r: Math.min(raio + f, (Math.min(b.width, b.height) + f * 2) / 2) });
    };
    const el = document.querySelector<HTMLElement>(passo.alvo);
    if (el) {
      const b = el.getBoundingClientRect();
      // fora da área boa da tela (ou embaixo do painel de cores): rola até o meio antes de medir
      if (b.top < 90 || b.bottom > window.innerHeight - 250) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    medir();
    const t1 = window.setTimeout(medir, 220), t2 = window.setTimeout(medir, 520);
    window.addEventListener("resize", medir); window.addEventListener("scroll", medir, true);
    return () => { vivo = false; window.clearTimeout(t1); window.clearTimeout(t2); window.removeEventListener("resize", medir); window.removeEventListener("scroll", medir, true); };
  }, [passo.alvo, passo.folga]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aoFechar]);

  const seguir = () => (ultimo ? aoFechar() : setI(i + 1));
  if (!c) return null;

  const alto = window.innerHeight, largo = window.innerWidth;
  // a frase vai onde sobra mais espaço: embaixo do foco ou em cima dele (o rodapé do guia ocupa uns 96px)
  const embaixo = alto - 96 - (c.y + c.h) >= c.y - 20;
  const cx = Math.max(40, Math.min(largo - 40, c.x + c.w / 2));
  const ladoDireito = cx > largo / 2;

  return createPortal(
    <div className="gap" role="dialog" aria-modal="true" aria-label={passo.titulo} onClick={seguir}>
      <div className="gap-foco" style={{ left: c.x, top: c.y, width: c.w, height: c.h, borderRadius: c.r }} aria-hidden="true" />
      <div key={i} className={`gap-fala${embaixo ? "" : " gap-fala--cima"}${ladoDireito ? " gap-fala--dir" : ""}`}
        style={embaixo ? { top: c.y + c.h + 10 } : { bottom: alto - c.y + 10 }}>
        <svg className="gap-seta" style={{ left: cx - 22 }} width="44" height="46" viewBox="0 0 44 46" fill="none" aria-hidden="true">
          <path d={ladoDireito ? "M8 44 C 10 26, 22 16, 30 6" : "M36 44 C 34 26, 22 16, 14 6"} stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
          <path d={ladoDireito ? "M20 6 L31 4 L30 16" : "M24 6 L13 4 L14 16"} stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <b>{passo.titulo}</b>
        <p>{passo.texto}</p>
      </div>
      <div className="gap-pe" onClick={e => e.stopPropagation()}>
        <button type="button" className="gap-pular" onClick={aoFechar}>{ultimo ? "Fechar" : "Pular"}</button>
        <span className="gap-pontos" aria-label={`Passo ${i + 1} de ${passos.length}`}>{passos.map((_, n) => <i key={n} className={n === i ? "on" : ""} />)}</span>
        <button type="button" className="gap-ir" onClick={seguir}>{ultimo ? "Começar" : "Próximo"}</button>
      </div>
      <style>{CSS}</style>
    </div>,
    document.body,
  );
}

const CSS = `
@font-face { font-family: 'Caveat'; src: url('/fonts/Caveat-700.woff2') format('woff2'); font-weight: 600; font-style: normal; font-display: swap; }
.gap { position: fixed; inset: 0; z-index: 12000; overflow: hidden; font-family: var(--font-base); -webkit-tap-highlight-color: transparent; animation: gapEntra .28s ease both; }
/* o foco de luz: um recorte que desliza de um lugar para o outro; o escuro é a sombra dele */
.gap-foco { position: absolute; box-shadow: 0 0 0 9999px rgba(24, 12, 9, .86), 0 0 0 1.5px rgba(255, 255, 255, .95), 0 0 0 7px rgba(255, 255, 255, .18); transition: left .42s cubic-bezier(.3, .8, .25, 1), top .42s cubic-bezier(.3, .8, .25, 1), width .42s cubic-bezier(.3, .8, .25, 1), height .42s cubic-bezier(.3, .8, .25, 1), border-radius .42s ease; animation: gapPulsa 1.9s ease-in-out infinite; }
.gap-fala { position: absolute; left: 0; right: 0; padding: 44px 26px 0; color: #fff; text-align: left; animation: gapFala .38s .16s ease both; pointer-events: none; }
.gap-fala--dir { text-align: right; }
.gap-fala--cima { padding: 0 26px 44px; }
.gap-fala b { display: block; font: 600 31px/1.05 'Caveat', var(--font-base); letter-spacing: .2px; transform: rotate(-2deg); transform-origin: left center; white-space: nowrap; }
.gap-fala--dir b { transform-origin: right center; transform: rotate(2deg); }
.gap-fala p { margin: 8px 0 0; font-size: min(14.5px, 3.8vw); line-height: 1.4; color: rgba(255, 255, 255, .9); white-space: nowrap; }
.gap-seta { position: absolute; top: 0; }
.gap-fala--cima .gap-seta { top: auto; bottom: 0; transform: scaleY(-1); }
.gap-pe { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 34px 20px calc(18px + env(safe-area-inset-bottom, 0px)); background: linear-gradient(180deg, rgba(20, 10, 7, 0), rgba(20, 10, 7, .96) 46%); }
.gap-pular { height: 44px; margin: 0; padding: 0 6px; border: 0; background: none; color: rgba(255, 255, 255, .78); font: 400 14.5px var(--font-base); cursor: pointer; }
.gap-pontos { display: flex; gap: 6px; }
.gap-pontos i { width: 6px; height: 6px; border-radius: 3px; background: rgba(255, 255, 255, .34); transition: width .3s ease, background .3s ease; }
.gap-pontos i.on { width: 18px; background: #fff; }
.gap-ir { height: 44px; margin: 0; padding: 0 22px; border: 0; border-radius: 22px; background: #fff; color: #2C1219; font: 500 15px var(--font-base); white-space: nowrap; cursor: pointer; }
@keyframes gapEntra { from { opacity: 0; } to { opacity: 1; } }
@keyframes gapFala { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes gapPulsa { 0%, 100% { box-shadow: 0 0 0 9999px rgba(24, 12, 9, .86), 0 0 0 1.5px rgba(255, 255, 255, .95), 0 0 0 5px rgba(255, 255, 255, .20); } 50% { box-shadow: 0 0 0 9999px rgba(24, 12, 9, .86), 0 0 0 1.5px rgba(255, 255, 255, .95), 0 0 0 11px rgba(255, 255, 255, .07); } }
@media (prefers-reduced-motion: reduce) { .gap, .gap-fala, .gap-foco { animation: none; transition: none; } }
`;

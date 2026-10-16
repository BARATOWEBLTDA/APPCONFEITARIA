import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Mascote } from "@/components/marca/Mascote";

/**
 * (15/10) Destaque do "Começar" (só no celular, uma vez só, logo depois da apresentação):
 * a tela escurece, o passo da vez fica aceso com o contorno rosa e um balão embaixo explica.
 * Tocar no botão aceso abre o 1º passo; "Agora não" ou tocar fora fecha.
 */
export default function DestaqueComecar({ alvo, botao, aoComecar, aoFechar }: {
  alvo: RefObject<HTMLElement | null>; botao: RefObject<HTMLElement | null>; aoComecar: () => void; aoFechar: () => void;
}) {
  const [r, setR] = useState<DOMRect | null>(null);
  const medir = () => { const el = alvo.current; if (el) setR(el.getBoundingClientRect()); };
  useLayoutEffect(medir, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const travaAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", medir);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    document.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = travaAntes; window.removeEventListener("resize", medir); document.removeEventListener("keydown", esc); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r) return null;

  const tocou = (e: React.MouseEvent) => {
    const b = botao.current?.getBoundingClientRect();
    if (b && e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom) aoComecar();
    else aoFechar();
  };
  const m = 6; // folga em volta do bloco aceso
  return createPortal(
    <div className="dqc" role="dialog" aria-modal="true" aria-label="Comece por aqui" onClick={tocou}>
      <div className="dqc-furo" style={{ left: r.left - m, top: r.top - m, width: r.width + m * 2, height: r.height + m * 2 }} aria-hidden="true" />
      <div className="dqc-bal" style={{ top: r.bottom + m + 16 }} onClick={e => e.stopPropagation()}>
        <Mascote pose="acenando" className="dqc-masc" />
        <b>Comece por aqui</b>
        <p>Em poucos minutos seu cardápio fica pronto pra vender.</p>
        <div className="dqc-acoes">
          <button type="button" className="dqc-sim" onClick={aoComecar}>Começar</button>
          <button type="button" className="dqc-nao" onClick={aoFechar}>Agora não</button>
        </div>
      </div>
      <style>{CSS}</style>
    </div>,
    document.body
  );
}

const CSS = `
  .dqc { position: fixed; inset: 0; z-index: 10070; font-family: var(--font-base); animation: dqcEntra .25s ease-out both; }
  @keyframes dqcEntra { from { opacity: 0; } to { opacity: 1; } }
  .dqc-furo { position: fixed; border-radius: 16px; box-shadow: 0 0 0 4px #FF9DC4, 0 0 0 9999px rgba(24, 8, 14, .74); pointer-events: none; animation: dqcPulsa 1.6s ease-in-out infinite; }
  @keyframes dqcPulsa { 0%, 100% { box-shadow: 0 0 0 4px #FF9DC4, 0 0 0 9999px rgba(24, 8, 14, .74); } 50% { box-shadow: 0 0 0 8px rgba(255, 157, 196, .75), 0 0 0 9999px rgba(24, 8, 14, .74); } }
  .dqc-bal { position: fixed; left: 16px; right: 16px; padding: 14px 14px 12px 88px; border-radius: 16px; background: var(--ui-branco); box-shadow: 0 10px 30px rgba(0, 0, 0, .25); }
  .dqc-bal::before { content: ""; position: absolute; top: -8px; left: 50%; width: 16px; height: 16px; margin-left: -8px; border-radius: 3px; background: var(--ui-branco); transform: rotate(45deg); }
  .dqc-masc { position: absolute; left: 10px; bottom: 10px; width: 68px; height: auto; }
  .dqc-bal b { display: block; margin-bottom: 3px; font-size: 15px; font-weight: 700; color: var(--ui-texto); }
  .dqc-bal p { margin: 0; font-size: 13px; line-height: 1.4; color: var(--ui-texto-2); }
  .dqc-acoes { display: flex; align-items: center; gap: 4px; margin-top: 8px; }
  .dqc-sim, .dqc-nao { min-height: 40px; padding: 0 12px; border: 0; border-radius: 8px; font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
  .dqc-sim { background: var(--chocolate); color: var(--ui-branco); }
  .dqc-nao { background: none; color: var(--ui-texto-3); }
  @media (prefers-reduced-motion: reduce) { .dqc, .dqc-furo { animation: none; } }
`;

import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Mascote } from "@/components/marca/Mascote";

/**
 * (16/10) Destaque guiado, um só pro app inteiro (antes o "Começar" tinha o dele): a tela escurece, o alvo fica aceso
 * com o contorno rosa pulsando e um balão explica. O balão abre embaixo do alvo, ou em cima quando não cabe (menu de baixo).
 * Com mascote o texto fica ao lado dela; sem mascote, centralizado.
 * Tocar no alvo (ou no botão do balão) faz a ação; "Agora não", tocar fora ou Esc fecha.
 * Espera outra janela aberta (boas-vindas, conta ativa) fechar antes de aparecer.
 *
 * Pra mostrar uma vez só: `jaViuDestaque(chave)` antes e `marcarDestaque(chave)` ao mostrar.
 */
type Alvo = RefObject<HTMLElement | null> | string;
const achar = (a: Alvo) => (typeof a === "string" ? document.querySelector<HTMLElement>(a) : a.current);

export function jaViuDestaque(chave: string) { try { return localStorage.getItem(`doonly_destaque_${chave}`) === "1"; } catch { return true; } }
export function marcarDestaque(chave: string) { try { localStorage.setItem(`doonly_destaque_${chave}`, "1"); } catch {} }

export default function Destaque({ alvo, toque, titulo, texto, acao, aoAcao, aoFechar, mascote = false, raio = 16 }: {
  /** o que fica aceso (ref ou seletor) */
  alvo: Alvo;
  /** onde o toque vale como a ação (padrão: o próprio alvo) */
  toque?: Alvo;
  titulo: string; texto: string; acao: string;
  aoAcao: () => void; aoFechar: () => void;
  mascote?: boolean; raio?: number;
}) {
  const [r, setR] = useState<DOMRect | null>(null);
  const [livre, setLivre] = useState(false); // nenhuma outra janela aberta
  const medir = () => { const el = achar(alvo); if (el) setR(el.getBoundingClientRect()); };

  useEffect(() => {
    let n = 0, t = 0;
    const ver = () => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]:not(.dsq)') && n++ < 40) { t = window.setTimeout(ver, 500); return; }
      setLivre(true);
    };
    ver();
    return () => window.clearTimeout(t);
  }, []);
  useLayoutEffect(() => { if (livre) medir(); }, [livre]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!livre) return;
    const travaAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", medir);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    document.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = travaAntes; window.removeEventListener("resize", medir); document.removeEventListener("keydown", esc); };
  }, [livre]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!livre || !r) return null;

  const tocou = (e: React.MouseEvent) => {
    const b = achar(toque ?? alvo)?.getBoundingClientRect();
    if (b && e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom) aoAcao();
    else aoFechar();
  };
  const m = 6; // folga em volta do alvo
  const alto = window.innerHeight;
  const emCima = alto - r.bottom < 220 && r.top > alto - r.bottom; // não cabe embaixo: abre em cima
  const pos = emCima ? { bottom: alto - r.top + m + 16 } : { top: r.bottom + m + 16 };
  // a setinha aponta pro meio do alvo
  const seta = Math.min(Math.max(r.left + r.width / 2 - 16, 24), window.innerWidth - 40);

  return createPortal(
    <div className="dsq" role="dialog" aria-modal="true" aria-label={titulo} onClick={tocou}>
      <div className="dsq-furo" style={{ left: r.left - m, top: r.top - m, width: r.width + m * 2, height: r.height + m * 2, borderRadius: raio }} aria-hidden="true" />
      <div className={`dsq-bal${emCima ? " dsq-bal--cima" : ""}${mascote ? " dsq-bal--masc" : ""}`} style={{ ...pos, ["--dsq-seta" as string]: `${seta - 16}px` }} onClick={e => e.stopPropagation()}>
        {mascote && <Mascote pose="acenando" className="dsq-masc" />}
        <b>{titulo}</b>
        <p>{texto}</p>
        <div className="dsq-acoes">
          <button type="button" className="dsq-sim" onClick={aoAcao}>{acao}</button>
          <button type="button" className="dsq-nao" onClick={aoFechar}>Agora não</button>
        </div>
      </div>
      <style>{CSS}</style>
    </div>,
    document.body
  );
}

const CSS = `
  .dsq { position: fixed; inset: 0; z-index: 10070; font-family: var(--font-base); animation: dsqEntra .25s ease-out both; }
  @keyframes dsqEntra { from { opacity: 0; } to { opacity: 1; } }
  .dsq-furo { position: fixed; box-shadow: 0 0 0 4px #FF9DC4, 0 0 0 9999px rgba(24, 8, 14, .74); pointer-events: none; animation: dsqPulsa 1.6s ease-in-out infinite; }
  @keyframes dsqPulsa { 0%, 100% { box-shadow: 0 0 0 4px #FF9DC4, 0 0 0 9999px rgba(24, 8, 14, .74); } 50% { box-shadow: 0 0 0 8px rgba(255, 157, 196, .75), 0 0 0 9999px rgba(24, 8, 14, .74); } }
  .dsq-bal { position: fixed; left: 16px; right: 16px; padding: 16px 16px 14px; border-radius: 16px; background: var(--ui-branco); box-shadow: 0 10px 30px rgba(0, 0, 0, .25); text-align: center; }
  .dsq-bal::before { content: ""; position: absolute; top: -8px; left: var(--dsq-seta, 50%); width: 16px; height: 16px; border-radius: 3px; background: var(--ui-branco); transform: rotate(45deg); }
  .dsq-bal--cima::before { top: auto; bottom: -8px; }
  .dsq-bal--masc { padding: 14px 14px 12px 88px; text-align: left; }
  .dsq-masc { position: absolute; left: 10px; bottom: 10px; width: 68px; height: auto; }
  .dsq-bal b { display: block; margin-bottom: 3px; font-size: 15px; font-weight: 700; color: var(--ui-texto); }
  .dsq-bal p { margin: 0; font-size: 13px; line-height: 1.4; color: var(--ui-texto-2); }
  .dsq-acoes { display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 10px; }
  .dsq-bal--masc .dsq-acoes { justify-content: flex-start; margin-top: 8px; }
  .dsq-sim, .dsq-nao { min-height: 40px; padding: 0 12px; border: 0; border-radius: 8px; font-family: inherit; font-size: 14px; font-weight: 700; white-space: nowrap; cursor: pointer; }
  .dsq-sim { background: var(--chocolate); color: var(--ui-branco); }
  .dsq-nao { background: none; color: var(--ui-texto-3); }
  @media (prefers-reduced-motion: reduce) { .dsq, .dsq-furo { animation: none; } }
`;

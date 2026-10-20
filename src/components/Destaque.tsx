import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
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

export default function Destaque({ alvo, toque, titulo, texto, acao, aoAcao, aoFechar, mascote = false, raio = 16, passo, naoTexto = "Agora não", extra, sobreJanela = false, semNao = false }: {
  /** o que fica aceso (ref ou seletor) */
  alvo: Alvo;
  /** onde o toque vale como a ação (padrão: o próprio alvo) */
  toque?: Alvo;
  titulo: string; texto: string; acao: string;
  aoAcao: () => void; aoFechar: () => void;
  mascote?: boolean; raio?: number;
  /** (16/10) tour: "1 de 4" em cima do título; e o texto do botão de sair ("Sair do tour") */
  passo?: string; naoTexto?: string;
  /** (19/10) algo a mais embaixo do texto (ex.: a prévia de como fica no cardápio) */
  extra?: ReactNode;
  /** (19/10) o alvo está dentro de uma janela: aparece por cima dela, sem esperar ela fechar */
  sobreJanela?: boolean;
  /** (19/10) só o botão principal (sem o "Agora não") */
  semNao?: boolean;
}) {
  const [r, setR] = useState<DOMRect | null>(null);
  const [balH, setBalH] = useState(0); // altura do balão (medida depois de aparecer)
  const balRef = useRef<HTMLDivElement>(null);
  const [livre, setLivre] = useState(false); // nenhuma outra janela aberta
  const medir = () => { const el = achar(alvo); if (el) setR(el.getBoundingClientRect()); };

  useEffect(() => {
    let n = 0, t = 0;
    const ver = () => {
      if (!sobreJanela && document.querySelector('[role="dialog"][aria-modal="true"]:not(.dsq)') && n++ < 40) { t = window.setTimeout(ver, 500); return; }
      setLivre(true);
    };
    ver();
    return () => window.clearTimeout(t);
  }, []);
  // (16/10) alvo fora da tela (tour numa página comprida): rola até ele antes de medir
  useLayoutEffect(() => {
    if (!livre) return;
    const el = achar(alvo);
    if (!el) return;
    const b = el.getBoundingClientRect();
    const alto = window.innerHeight;
    // (16/10) cartão alto (custos com vários itens): rola na hora pro topo dele ficar logo abaixo do cabeçalho.
    // Antes rolava devagar e media no meio da rolagem: o contorno ficava fora do lugar.
    if (b.top < 70 || b.bottom > alto - 260) {
      const destino = b.height > alto - 340 ? b.top - 76 : b.top - (alto - b.height) / 2 + 60;
      window.scrollTo({ top: window.scrollY + destino, behavior: "auto" });
    }
    const raf = requestAnimationFrame(() => requestAnimationFrame(medir));
    return () => cancelAnimationFrame(raf);
  }, [livre, alvo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!livre) return;
    const travaAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, { passive: true });
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    document.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = travaAntes; window.removeEventListener("resize", medir); window.removeEventListener("scroll", medir); document.removeEventListener("keydown", esc); };
  }, [livre]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { const h = balRef.current?.offsetHeight || 0; if (h && Math.abs(h - balH) > 1) setBalH(h); });
  if (!livre || !r) return null;

  const tocou = (e: React.MouseEvent) => {
    const b = achar(toque ?? alvo)?.getBoundingClientRect();
    if (b && e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom) aoAcao();
    else aoFechar();
  };
  const m = 6; // folga em volta do alvo
  const alto = window.innerHeight;
  const H = balH || 190, gap = m + 16, borda = 12;
  // embaixo do alvo se cabe; senão em cima; senão (alvo maior que a tela) o balão fica no rodapé e o contorno
  // mostra só a parte de cima do alvo, sem o balão tampar nada
  const cabeEmbaixo = alto - (r.bottom + gap) - borda >= H;
  const cabeEmCima = r.top - gap - H >= borda;
  const modo: "baixo" | "cima" | "rodape" = cabeEmbaixo ? "baixo" : cabeEmCima ? "cima" : "rodape";
  const emCima = modo === "cima";
  const pos = modo === "baixo" ? { top: r.bottom + gap } : modo === "cima" ? { bottom: alto - r.top + gap } : { bottom: borda };
  const furoAlt = modo === "rodape" ? Math.max(40, Math.min(r.height + m * 2, alto - borda - H - gap - (r.top - m))) : r.height + m * 2;
  // (19/10) balão com no máximo 400px, centralizado no alvo (no computador ocupava a tela de ponta a ponta)
  const larg = window.innerWidth;
  const balW = Math.min(400, larg - 32);
  const balL = Math.min(Math.max(r.left + r.width / 2 - balW / 2, 16), larg - balW - 16);
  // a setinha aponta pro meio do alvo
  const seta = Math.min(Math.max(r.left + r.width / 2 - balL, 24), balW - 24);

  return createPortal(
    <div className="dsq" role="dialog" aria-modal="true" aria-label={titulo} onClick={tocou}>
      <div className="dsq-furo" style={{ left: r.left - m, top: r.top - m, width: r.width + m * 2, height: furoAlt, borderRadius: raio }} aria-hidden="true" />
      <div ref={balRef} className={`dsq-bal${emCima ? " dsq-bal--cima" : ""}${modo === "rodape" ? " dsq-bal--rodape" : ""}${mascote ? " dsq-bal--masc" : ""}`} style={{ ...pos, left: balL, right: "auto", width: balW, ["--dsq-seta" as string]: `${seta - 8}px` }} onClick={e => e.stopPropagation()}>
        {mascote && <Mascote pose="acenando" className="dsq-masc" />}
        {passo && <em className="dsq-passo">{passo}</em>}
        <b>{titulo}</b>
        <p>{texto}</p>
        {extra && <div className="dsq-extra">{extra}</div>}
        <div className="dsq-acoes">
          <button type="button" className="dsq-sim" onClick={aoAcao}>{acao}</button>
          {!semNao && <button type="button" className="dsq-nao" onClick={aoFechar}>{naoTexto}</button>}
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
  .dsq-bal--rodape { bottom: calc(12px + env(safe-area-inset-bottom, 0px)) !important; }
  .dsq-bal--rodape::before { display: none; }
  .dsq-bal--masc { padding: 14px 14px 12px 88px; text-align: left; }
  .dsq-masc { position: absolute; left: 10px; bottom: 10px; width: 68px; height: auto; }
  .dsq-bal b { display: block; margin-bottom: 3px; font-size: 15px; font-weight: 700; color: var(--ui-texto); }
  .dsq-passo { display: block; margin-bottom: 2px; font-style: normal; font-size: 12px; font-weight: 700; color: var(--ui-rosa-escuro); }
  .dsq-bal p { margin: 0; font-size: 13px; line-height: 1.4; color: var(--ui-texto-2); }
  .dsq-extra { margin-top: 10px; }
  .dsq-acoes { display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 10px; }
  .dsq-bal--masc .dsq-acoes { justify-content: flex-start; margin-top: 8px; }
  .dsq-sim, .dsq-nao { min-height: 40px; padding: 0 12px; border: 0; border-radius: 8px; font-family: inherit; font-size: 14px; font-weight: 700; white-space: nowrap; cursor: pointer; }
  .dsq-sim { background: var(--chocolate); color: var(--ui-branco); }
  .dsq-nao { background: none; color: var(--ui-texto-3); }
  @media (prefers-reduced-motion: reduce) { .dsq, .dsq-furo { animation: none; } }
`;

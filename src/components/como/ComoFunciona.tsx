import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, Info, PlayCircle, Question } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { contarPassos, fazerTour, type PassoTour } from "./tour";
import "./comoFunciona.css";

/**
 * (22/10) "Como funciona", no formato das Pendências da Dora: em cima um exemplo com números (fundo cinza),
 * o caminho em etiquetas e, embaixo, dicas curtas com ícone. Usado no Pra fazer e no (i) do topo das telas.
 * Tudo opcional menos as dicas: sem exemplo (tela que não tem conta, como o Início), só o título e as dicas.
 * (22/10) No (i): topo "Sobre esta tela" (com o ícone da tela), uma frase de resumo e, embaixo, "Fazer o tour".
 */
export type Como = {
  /** nome curto (título da gaveta do celular) e o rótulo do botão da ação (Pra fazer) */
  nome?: string; acao?: string;
  /** topo "Sobre esta tela" */
  tela?: { nome: string; Icone: Icon };
  resumo?: ReactNode;
  tit?: string;
  linhas?: [string, string][];
  total?: [string, string];
  fluxo?: string[];
  dicas: [Icon, ReactNode][];
  /** dicas com check verde (lista do que tem na tela) no lugar dos ícones */
  checks?: boolean;
};

export function ConteudoComo({ c, rotulo, className = "", tour }: { c: Como; rotulo: string; className?: string; tour?: { passos: number; fazer: () => void } }) {
  const temExemplo = !!(c.tit || c.linhas?.length || c.total || c.fluxo?.length);
  return (
    <div className={`cf ${className}`} role="group" aria-label={`Como funciona: ${rotulo}`}>
      {c.tela && (
        <div className="cf-cab">
          <span className="cf-cab-ic" aria-hidden="true"><c.tela.Icone size={22} weight="bold" /></span>
          <span><small>Sobre esta tela</small><b>{c.tela.nome}</b></span>
        </div>
      )}
      {c.resumo && <p className="cf-resumo">{c.resumo}</p>}
      {temExemplo && (
        <div className="cf-ex">
          {c.tit && <p className="cf-t">{c.tit}</p>}
          {c.linhas?.map(([l, v]) => <div key={l} className="cf-l"><span>{l}</span><span>{v}</span></div>)}
          {c.total && <div className="cf-l cf-tot"><span>{c.total[0]}</span><span>{c.total[1]}</span></div>}
          {!!c.fluxo?.length && (
            <div className="cf-fluxo">
              {c.fluxo.map((f, i) => <span key={f} className="cf-pass">{i > 0 && <ArrowRight size={12} weight="bold" aria-hidden="true" />}<em className={i === Math.floor((c.fluxo!.length - 1) / 2) ? "on" : ""}>{f}</em></span>)}
            </div>
          )}
        </div>
      )}
      <ul className={`cf-dicas${c.checks ? " cf-dicas--check" : ""}`}>
        {c.dicas.map(([Ic, t], i) => <li key={i}>{c.checks ? <Check size={16} weight="bold" aria-hidden="true" /> : <Ic size={16} aria-hidden="true" />}<span>{t}</span></li>)}
      </ul>
      {tour && (
        <button type="button" className="cf-tour" onClick={tour.fazer}>
          <PlayCircle size={22} aria-hidden="true" />
          <span><small>Tour da tela · {tour.passos} passos</small><b>Fazer o tour</b></span>
          <ArrowRight size={18} weight="bold" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/**
 * Botão (i) ou (?) com a janelinha presa embaixo dele (setinha apontando pro botão).
 * Fecha com um toque fora (rolar não fecha), no botão de novo ou com Esc. No celular encosta nas margens da tela.
 */
export function BotaoAjuda({ c, rotulo, tipo = "info", className = "", tour }: { c: Como; rotulo: string; tipo?: "info" | "pergunta"; className?: string; tour?: PassoTour[] }) {
  const [aberto, setAberto] = useState(false);
  const bt = useRef<HTMLButtonElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  // presa no botão, mas por cima de tudo (portal + fixed): não é cortada por quem tem overflow escondido
  const [pos, setPos] = useState({ top: 0, left: 12, seta: 12, max: 500 });
  useLayoutEffect(() => {
    if (!aberto) return;
    const medir = () => {
      const i = bt.current?.getBoundingClientRect();
      if (!i) return;
      const largura = Math.min(380, window.innerWidth - 24);
      const left = Math.max(12, Math.min(i.left - 12, window.innerWidth - 12 - largura));
      const top = i.bottom + 10;
      const baixo = window.matchMedia("(max-width: 900px)").matches ? 90 : 16;
      setPos({ top, left, seta: i.left + i.width / 2 - left - 6, max: window.innerHeight - top - baixo });
    };
    medir(); window.addEventListener("resize", medir); window.addEventListener("scroll", medir, true);
    return () => { window.removeEventListener("resize", medir); window.removeEventListener("scroll", medir, true); };
  }, [aberto]);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { const t = e.target as Node; if (!caixa.current?.contains(t) && !bt.current?.contains(t)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("click", fora); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);
  const Ic = tipo === "pergunta" ? Question : Info;
  const nPassos = aberto && tour ? contarPassos(tour) : 0;
  return (
    <span className={`cf-ajuda ${className}`}>
      <button type="button" ref={bt} className={`cf-ajuda-bt cf-ajuda-bt--${tipo}${aberto ? " on" : ""}`} onClick={() => setAberto(a => !a)}
        aria-label={`Como funciona: ${rotulo}`} title="Como funciona" aria-expanded={aberto}>
        <Ic size={tipo === "pergunta" ? 18 : 20} weight="bold" aria-hidden="true" />
      </button>
      {aberto && createPortal(<>
        {/* (22/10) toque fora só fecha o balão: não abre o que estiver atrás sem querer */}
        <div className="cf-pop-fundo" aria-hidden="true" onClick={e => { e.stopPropagation(); setAberto(false); }} />
        <div className="cf-pop" ref={caixa} style={{ top: pos.top, left: pos.left }}>
          <span className="cab-pop-seta" style={{ left: pos.seta }} aria-hidden="true" />
          <div className="cf-pop-rolo" style={{ maxHeight: pos.max }}>
            <ConteudoComo c={c} rotulo={rotulo} tour={tour && nPassos > 1 ? { passos: nPassos, fazer: () => { setAberto(false); window.setTimeout(() => { void fazerTour(tour); }, 150); } } : undefined} />
          </div>
        </div>
      </>,
        document.body,
      )}
    </span>
  );
}

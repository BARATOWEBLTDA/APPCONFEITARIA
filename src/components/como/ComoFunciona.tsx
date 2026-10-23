import type { ReactNode } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import "./comoFunciona.css";

/**
 * (22/10) "Como funciona", no formato das Pendências da Dora: em cima um exemplo com números (fundo cinza),
 * o caminho em etiquetas e, embaixo, dicas curtas com ícone. Usado no Pra fazer e no (i) do topo das telas.
 * Tudo opcional menos as dicas: sem exemplo (tela que não tem conta, como o Início), só o título e as dicas.
 */
export type Como = {
  /** nome curto (título da gaveta do celular) e o rótulo do botão da ação (Pra fazer) */
  nome?: string; acao?: string;
  tit?: string;
  linhas?: [string, string][];
  total?: [string, string];
  fluxo?: string[];
  dicas: [Icon, ReactNode][];
};

export function ConteudoComo({ c, rotulo, className = "" }: { c: Como; rotulo: string; className?: string }) {
  const temExemplo = !!(c.tit || c.linhas?.length || c.total || c.fluxo?.length);
  return (
    <div className={`cf ${className}`} role="group" aria-label={`Como funciona: ${rotulo}`}>
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
      <ul className="cf-dicas">
        {c.dicas.map(([Ic, t], i) => <li key={i}><Ic size={16} aria-hidden="true" /><span>{t}</span></li>)}
      </ul>
    </div>
  );
}

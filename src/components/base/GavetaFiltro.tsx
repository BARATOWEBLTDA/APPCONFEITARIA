import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSobreposicao } from "./useSobreposicao";
import "./gavetaFiltro.css";

/**
 * (24/10) Filtro padrão do app: a gaveta que sai da direita, igual à de Pedidos.
 * Grupos de escolha única (bolinha) ou várias (caixinha), com a quantidade ao lado de cada opção,
 * "Limpar" e o botão "Ver N …" embaixo. O que muda só vale ao tocar no botão (até lá é um rascunho).
 *
 *   <GavetaFiltro valor={f} padrao={PADRAO} grupos={[...]} contar={v => lista.filter(...).length}
 *     rotulo={n => `Ver ${n} lançamentos`} aoAplicar={setF} aoFechar={() => setAberto(false)} />
 */
export type OpcaoFiltro = { k: string; label: string; n?: number; cor?: string };
export type GrupoFiltro = {
  id: string;
  titulo: string;
  tipo: "radio" | "check";
  opcoes: OpcaoFiltro[];
  /** caixinhas: mostra "Marcar todas / Desmarcar todas" */
  todas?: boolean;
  /** algo embaixo de uma opção quando ela está marcada (ex.: as datas do "Escolher período") */
  depois?: (k: string, valor: Record<string, any>, mudar: (id: string, v: any) => void) => ReactNode;
};
export type ValorFiltro = Record<string, any>;

/** quantos grupos estão diferentes do padrão (o número na bolinha do botão de filtro) */
export function filtrosAtivos(valor: ValorFiltro, padrao: ValorFiltro): number {
  return Object.keys(padrao).filter(k => JSON.stringify(valor[k] ?? null) !== JSON.stringify(padrao[k] ?? null)).length;
}

export default function GavetaFiltro({ titulo = "Filtros", grupos, valor, padrao, contar, rotulo, aoAplicar, aoFechar, rodape }: {
  titulo?: string; grupos: GrupoFiltro[]; valor: ValorFiltro; padrao: ValorFiltro;
  contar?: (v: ValorFiltro) => number; rotulo: (n: number | null) => string;
  aoAplicar: (v: ValorFiltro) => void; aoFechar: () => void;
  /** algo a mais no fim da gaveta (ex.: "Baixar a planilha") */
  rodape?: ReactNode;
}) {
  const [rasc, setRasc] = useState<ValorFiltro>(() => ({ ...valor }));
  const [saindo, setSaindo] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const fechar = () => { if (saindo) return; setSaindo(true); window.setTimeout(aoFechar, 180); };
  useSobreposicao(true, fechar, caixa);
  const mudar = (id: string, v: any) => setRasc(r => ({ ...r, [id]: v }));
  const n = contar ? contar(rasc) : null;
  const aplicar = () => { aoAplicar(rasc); fechar(); };

  return createPortal(
    <div className={`gf-ov${saindo ? " saindo" : ""}`} onClick={fechar}>
      <div className="gf" ref={caixa} tabIndex={-1} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="gf-h">
          <b>{titulo}</b>
          <button type="button" className="gf-x" onClick={fechar} aria-label="Fechar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="gf-b">
          {grupos.map(g => {
            const v = rasc[g.id];
            const marcadas: string[] = Array.isArray(v) ? v : [];
            const todasOn = g.tipo === "check" && g.opcoes.every(o => marcadas.includes(o.k));
            return (
              <div key={g.id}>
                <div className="gf-sec">
                  <b>{g.titulo}</b>
                  {g.tipo === "check" && g.todas && (
                    <button type="button" className="gf-lk" onClick={() => mudar(g.id, todasOn ? [] : g.opcoes.map(o => o.k))}>{todasOn ? "Desmarcar todas" : "Marcar todas"}</button>
                  )}
                </div>
                <div className="gf-grp" role={g.tipo === "radio" ? "radiogroup" : "group"} aria-label={g.titulo}>
                  {g.opcoes.map(o => {
                    const on = g.tipo === "radio" ? v === o.k : marcadas.includes(o.k);
                    const tocar = () => g.tipo === "radio" ? mudar(g.id, o.k) : mudar(g.id, on ? marcadas.filter(x => x !== o.k) : [...marcadas, o.k]);
                    return (
                      <div key={o.k}>
                        <button type="button" role={g.tipo === "radio" ? "radio" : "checkbox"} aria-checked={on} className={`gf-ln${g.tipo === "radio" ? " rd" : ""}${on ? " on" : ""}`} onClick={tocar}>
                          {g.tipo === "radio" ? <i className="gf-rb" aria-hidden="true" /> : (
                            <i className="gf-cb" aria-hidden="true">{on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}</i>
                          )}
                          {o.cor && <em style={{ background: o.cor }} aria-hidden="true" />}
                          <span>{o.label}</span>
                          {o.n != null && <u>{o.n}</u>}
                        </button>
                        {on && g.depois?.(o.k, rasc, mudar)}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {rodape}
        </div>
        <div className="gf-f">
          <button type="button" className="gf-limpar" onClick={() => setRasc({ ...padrao })}>Limpar</button>
          <button type="button" className="gf-ver" onClick={aplicar} disabled={n === 0}>{rotulo(n)}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Botão de filtro (ao lado da busca), com a bolinha de quantos filtros estão ligados */
export function BotaoFiltro({ ativos, onClick, className = "" }: { ativos: number; onClick: () => void; className?: string }) {
  return (
    <button type="button" className={`gf-bt${ativos > 0 ? " on" : ""} ${className}`} onClick={onClick}
      aria-label={ativos > 0 ? `Filtrar (${ativos} ${ativos === 1 ? "filtro ligado" : "filtros ligados"})` : "Filtrar"}>
      <svg width="20" height="20" viewBox="0 0 256 256" aria-hidden="true"><path d="M40 72h176M72 128h112M104 184h48" stroke="currentColor" strokeWidth="22" strokeLinecap="round" fill="none" /></svg>
      {ativos > 0 && <span className="gf-bt-n" aria-hidden="true">{ativos}</span>}
    </button>
  );
}

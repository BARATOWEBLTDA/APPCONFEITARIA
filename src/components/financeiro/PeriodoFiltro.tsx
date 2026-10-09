import CampoData from '@/components/CampoData'
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

/**
 * Filtro de período do financeiro (03/10): Hoje · 7 dias · Mês (com ‹ ›) · Personalizado (de–até).
 * Devolve sempre um intervalo de datas AAAA-MM-DD. Reaproveitável (extrato e, depois, painel).
 */
export type TipoPeriodo = "hoje" | "7dias" | "mes" | "personalizado";
export type Periodo = { tipo: TipoPeriodo; ini: string; fim: string; ano: number; mes: number };

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dia = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

export function periodoInicial(): Periodo {
  const h = new Date();
  return { tipo: "mes", ano: h.getFullYear(), mes: h.getMonth(), ini: iso(new Date(h.getFullYear(), h.getMonth(), 1)), fim: iso(new Date(h.getFullYear(), h.getMonth() + 1, 0)) };
}
export function rotuloPeriodo(p: Periodo): string {
  if (p.tipo === "hoje") return "hoje";
  if (p.tipo === "7dias") return "nos últimos 7 dias";
  if (p.tipo === "mes") return `em ${MESES[p.mes].toLowerCase()}`;
  const f = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  return `de ${f(p.ini)} a ${f(p.fim)}`;
}

export default function PeriodoFiltro({ valor, onChange }: { valor: Periodo; onChange: (p: Periodo) => void }) {
  const h = new Date();
  const escolher = (tipo: TipoPeriodo) => {
    if (tipo === "hoje") onChange({ ...valor, tipo, ini: dia(), fim: dia() });
    else if (tipo === "7dias") onChange({ ...valor, tipo, ini: dia(-6), fim: dia() });
    else if (tipo === "mes") { const p = periodoInicial(); onChange(p); }
    else onChange({ ...valor, tipo, ini: valor.tipo === "personalizado" ? valor.ini : dia(-14), fim: valor.tipo === "personalizado" ? valor.fim : dia() });
  };
  const mudarMes = (d: number) => { const n = new Date(valor.ano, valor.mes + d, 1); onChange({ tipo: "mes", ano: n.getFullYear(), mes: n.getMonth(), ini: iso(n), fim: iso(new Date(n.getFullYear(), n.getMonth() + 1, 0)) }); };
  const ehMesAtual = valor.ano === h.getFullYear() && valor.mes === h.getMonth();
  return (
    <div className="pf">
      <div className="pf-seg" role="tablist" aria-label="Período">
        {([["hoje", "Hoje"], ["7dias", "7 dias"], ["mes", "Mês"], ["personalizado", "Período"]] as [TipoPeriodo, string][]).map(([k, l]) =>
          <button type="button" role="tab" aria-selected={valor.tipo === k} key={k} className={valor.tipo === k ? "on" : ""} onClick={() => escolher(k)}>{l}</button>)}
      </div>
      {valor.tipo === "mes" && (
        <div className="pf-mes">
          <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><CaretLeft size={15} weight="bold" /></button>
          <b>{MESES[valor.mes]} de {valor.ano}</b>
          <button type="button" onClick={() => mudarMes(1)} disabled={ehMesAtual} aria-label="Próximo mês"><CaretRight size={15} weight="bold" /></button>
        </div>
      )}
      {valor.tipo === "personalizado" && (
        <div className="pf-datas">
          <div className="pf-d"><span>De</span><CampoData valor={valor.ini} max={valor.fim} titulo="Início do período" curto onChange={d => onChange({ ...valor, ini: d })} /></div>
          <div className="pf-d"><span>Até</span><CampoData valor={valor.fim} min={valor.ini} max={dia()} titulo="Fim do período" curto onChange={d => onChange({ ...valor, fim: d })} /></div>
        </div>
      )}
      <style>{`
        .pf { display: flex; flex-direction: column; gap: 8px; font-family: var(--font-base); }
        .pf-seg { display: flex; background: #EFE9EC; border-radius: 12px; padding: 3px; }
        .pf-seg button { flex: 1; min-height: 44px; border: none; background: none; border-radius: 10px; padding: 9px 4px; font-family: inherit; font-size: 13.5px; font-weight: 800; color: #6B5D64; cursor: pointer; }
        .pf-seg button.on { background: #fff; color: #2C1219; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
        .pf-mes { display: flex; justify-content: space-between; align-items: center; background: #fff; border: 1px solid #F0EBED; border-radius: 12px; padding: 5px; }
        .pf-mes b { font-size: 14px; font-weight: 800; color: #2C1219; }
        .pf-mes button { width: 44px; height: 44px; border-radius: 9px; border: none; background: #FFF1F6; color: #C33A6E; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .pf-mes button:disabled { opacity: .35; cursor: default; }
        .pf-datas { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .pf-d { display: flex; flex-direction: column; gap: 4px; min-width: 0; } .pf-d > span { font-size: 12px; font-weight: 700; color: #6B5D64; }
        .pf-datas input { height: 42px; border: 1.5px solid #EDE6E9; border-radius: 10px; padding: 0 10px; font-family: inherit; font-size: 16px; color: #2C1219; background: #fff; box-sizing: border-box; width: 100%; }
      `}</style>
    </div>
  );
}

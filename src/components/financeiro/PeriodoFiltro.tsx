import CampoData from '@/components/CampoData'
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

/**
 * Filtro de período do financeiro, um só para Financeiro, Transações e Lucratividade (23/10):
 * Hoje · 7 dias · 30 dias · Mês (com ‹ mês ›) · Outro (de–até).
 * Devolve sempre um intervalo de datas AAAA-MM-DD. No mês de hoje, o fim é hoje (não conta dias que ainda não vieram).
 */
export type TipoPeriodo = "hoje" | "7dias" | "30dias" | "mes" | "personalizado";
export type Periodo = { tipo: TipoPeriodo; ini: string; fim: string; ano: number; mes: number };

export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dia = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

/** O mês escolhido: do dia 1 ao último dia (ou até hoje, no mês de hoje) */
export function periodoDoMes(ano: number, mes: number): Periodo {
  const n = new Date(ano, mes, 1);
  const fimMes = iso(new Date(n.getFullYear(), n.getMonth() + 1, 0)), hoje = dia();
  return { tipo: "mes", ano: n.getFullYear(), mes: n.getMonth(), ini: iso(n), fim: fimMes < hoje ? fimMes : hoje };
}
/** O mês de hoje */
export function periodoInicial(): Periodo { const h = new Date(); return periodoDoMes(h.getFullYear(), h.getMonth()); }
/** Só o dia de hoje */
export function periodoHoje(): Periodo { const h = new Date(); return { tipo: "hoje", ini: dia(), fim: dia(), ano: h.getFullYear(), mes: h.getMonth() }; }

/** Virou o dia com o app aberto: "Hoje", "7 dias", "30 dias" e o mês de hoje andam junto */
export function periodoDoDia(p: Periodo): Periodo {
  const hoje = dia();
  if (p.tipo === "hoje") return p.ini === hoje && p.fim === hoje ? p : { ...p, ini: hoje, fim: hoje };
  if (p.tipo === "7dias" || p.tipo === "30dias") { const ini = dia(p.tipo === "7dias" ? -6 : -29); return p.ini === ini && p.fim === hoje ? p : { ...p, ini, fim: hoje }; }
  if (p.tipo === "mes") { const n = periodoDoMes(p.ano, p.mes); return n.fim === p.fim ? p : n; }
  return p;
}

export function rotuloPeriodo(p: Periodo): string {
  if (p.tipo === "hoje") return "hoje";
  if (p.tipo === "7dias") return "nos últimos 7 dias";
  if (p.tipo === "30dias") return "nos últimos 30 dias";
  if (p.tipo === "mes") return `em ${MESES[p.mes].toLowerCase()}`;
  const f = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  return `de ${f(p.ini)} a ${f(p.fim)}`;
}

const BOTOES: [TipoPeriodo, string][] = [["hoje", "Hoje"], ["7dias", "7 dias"], ["30dias", "30 dias"], ["mes", "Mês"], ["personalizado", "Escolher"]];

export default function PeriodoFiltro({ valor, onChange }: { valor: Periodo; onChange: (p: Periodo) => void }) {
  const h = new Date();
  const escolher = (tipo: TipoPeriodo) => {
    if (tipo === "hoje") onChange({ ...valor, tipo, ini: dia(), fim: dia() });
    else if (tipo === "7dias") onChange({ ...valor, tipo, ini: dia(-6), fim: dia() });
    else if (tipo === "30dias") onChange({ ...valor, tipo, ini: dia(-29), fim: dia() });
    else if (tipo === "mes") onChange(periodoInicial());
    else onChange({ ...valor, tipo, ini: valor.tipo === "personalizado" ? valor.ini : dia(-14), fim: valor.tipo === "personalizado" ? valor.fim : dia() });
  };
  const ehMesAtual = valor.ano === h.getFullYear() && valor.mes === h.getMonth();
  return (
    <div className="pf">
      <div className="pf-seg" role="tablist" aria-label="Período">
        {BOTOES.map(([k, l]) =>
          <button type="button" role="tab" aria-selected={valor.tipo === k} key={k} className={valor.tipo === k ? "on" : ""} onClick={() => escolher(k)}>{l}</button>)}
      </div>
      {valor.tipo === "mes" && (
        <div className="pf-mes">
          <button type="button" onClick={() => onChange(periodoDoMes(valor.ano, valor.mes - 1))} aria-label="Mês anterior"><CaretLeft size={15} weight="bold" /></button>
          <b>{MESES[valor.mes]} de {valor.ano}</b>
          <button type="button" onClick={() => onChange(periodoDoMes(valor.ano, valor.mes + 1))} disabled={ehMesAtual} aria-label="Próximo mês"><CaretRight size={15} weight="bold" /></button>
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
        .pf-seg { display: flex; gap: 2px; padding: 3px; border-radius: 12px; background: rgba(42,21,32,.06); }
        .pf-seg button { flex: 1; min-width: 0; min-height: 40px; padding: 0 6px; border: 0; border-radius: 9px; background: none; font-family: inherit; font-size: 13.5px; font-weight: 500; color: var(--ui-texto-2); white-space: nowrap; cursor: pointer; }
        /* (31/10 · 5.84) os 5 períodos com a mesma largura e o "Escolher" inteiro no celular de 360 px */
        @media (max-width: 400px) { .pf-seg button { flex: 1 1 0; padding: 0 2px; font-size: 12.5px; letter-spacing: -.1px; } }
        .pf-seg button.on { background: var(--ui-branco); color: var(--ui-texto); font-weight: 600; box-shadow: 0 1px 3px rgba(42,21,32,.10); }
        .pf-seg button:focus-visible { outline: 3px solid rgba(var(--ui-rosa-rgb), .45); outline-offset: -3px; }
        .pf-mes { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 46px; background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 12px; padding: 3px; box-sizing: border-box; }
        .pf-mes b { font-size: 14px; font-weight: 600; color: var(--ui-texto); }
        .pf-mes button { width: 40px; height: 40px; border-radius: 9px; border: none; background: #FFF1F6; color: var(--ui-rosa-escuro); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .pf-mes button:disabled { opacity: .35; cursor: default; }
        .pf-datas { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 8px; border-radius: 14px; background: var(--ui-branco); border: 1px solid #F0EBED; }
        .pf-d { display: flex; flex-direction: column; gap: 4px; min-width: 0; } .pf-d > span { font-size: 12px; font-weight: 500; color: var(--ui-texto-2); }
        .pf-datas input { height: 42px; border: 1.5px solid var(--ui-borda-campo); border-radius: var(--ui-raio-p); padding: 0 10px; font-family: inherit; font-size: 16px; color: var(--ui-texto); background: var(--ui-branco); min-width: 0; width: 100%; box-sizing: border-box; }
        @media (min-width: 768px) {
          .pf { flex-direction: row; align-items: center; justify-content: space-between; }
          .pf-seg { width: 460px; }
          .pf-mes { width: 300px; }
          .pf-datas { width: 340px; }
        }
      `}</style>
    </div>
  );
}

import { useMemo, useState } from "react";
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import "./graficoRecebido.css";

/**
 * Gráfico "Recebido" do Início, num arquivo à parte: a biblioteca do gráfico (recharts, pesada)
 * só é baixada quando o gráfico aparece, e não atrasa a abertura do Início (15/10).
 *
 * (23/10) Linha ACUMULADA: a linha rosa soma, dia a dia, quanto já entrou no período (sempre sobe, sem o "pico" de
 * um dia de venda no meio de dias vazios). A tracejada cinza é o período anterior, para comparar o ritmo.
 * Em cima: o total do período e quanto mudou em relação ao anterior. Botões 7 dias / 30 dias.
 * Recebe os últimos 60 dias (do mais antigo para hoje): os do período e os do período anterior.
 */
type Ponto = { iso?: string; dia: string; valor: number };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** eixo: "R$ 750", "R$ 2,5 mil" */
const curto = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const diaLongo = (iso?: string, dia?: string) => {
  if (!iso) return dia || "";
  const d = new Date(iso + "T12:00:00");
  return `${SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
};

type Periodo = 7 | 30 | "mes";
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const isoDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function GraficoRecebido({ dados }: { dados: Ponto[] }) {
  const [periodo, setPeriodo] = useState<Periodo>(30);

  const g = useMemo(() => {
    let atual: Ponto[], antes: Ponto[];
    const hoje = new Date();
    if (periodo === "mes") {
      // (23/10) "Este mês": do dia 1 até hoje, comparado com os mesmos dias do mês passado (até o último dia dele)
      const dia = hoje.getDate();
      const iniMes = isoDe(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
      const iniAnt = isoDe(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));
      const fimAnt = isoDe(new Date(hoje.getFullYear(), hoje.getMonth() - 1, Math.min(dia, new Date(hoje.getFullYear(), hoje.getMonth(), 0).getDate())));
      atual = dados.filter(p => (p.iso || "") >= iniMes);
      antes = dados.filter(p => (p.iso || "") >= iniAnt && (p.iso || "") <= fimAnt);
    } else {
      atual = dados.slice(-periodo);
      // o período anterior: os dias logo antes
      antes = dados.slice(Math.max(0, dados.length - 2 * periodo), dados.length - periodo);
    }
    // alinha pelo fim: se faltar dia no anterior, os primeiros contam como zero
    const faltam = atual.length - antes.length;
    let a = 0, b = 0;
    const serie = atual.map((p, i) => {
      a += p.valor || 0;
      const j = i - faltam;
      b += j >= 0 ? (antes[j]?.valor || 0) : 0;
      return { ...p, acum: Math.round(a * 100) / 100, antes: Math.round(b * 100) / 100 };
    });
    const total = a, totalAntes = b;
    const pct = totalAntes > 0 ? Math.round(((total - totalAntes) / totalAntes) * 100) : null;
    const hojeValor = dados.find(p => p.iso === isoDe(hoje))?.valor ?? dados[dados.length - 1]?.valor ?? 0;
    return { serie, total, totalAntes, pct, hojeValor };
  }, [dados, periodo]);

  const mes = MESES_LONGOS[new Date().getMonth()];
  const mesAnt = MESES_LONGOS[(new Date().getMonth() + 11) % 12];
  const txt = periodo === "mes"
    ? { titulo: `Recebido em ${mes}`, compara: `em relação ao mesmo período de ${mesAnt}`, nada: `Nada recebido no mesmo período de ${mesAnt}`, legA: "Este mês", legB: "Mês passado", dica: "Mês passado" }
    : { titulo: `Recebido nos últimos ${periodo} dias`, compara: `em relação aos ${periodo} dias anteriores`, nada: `Nada recebido nos ${periodo} dias anteriores`, legA: `Últimos ${periodo} dias`, legB: `${periodo} dias anteriores`, dica: "Período anterior" };

  const Dica = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <div className="grf-dica">
        <small>{diaLongo(p.iso, p.dia)}</small>
        <b>{brl(p.acum)}</b>
        <span>{txt.dica}: {brl(p.antes)}</span>
      </div>
    );
  };

  const { serie, total, totalAntes, pct, hojeValor } = g;
  const n = serie.length;
  const intervalo = n > 10 ? Math.ceil(n / 7) - 1 : 0;
  return (
    <div className="grf">
      <div className="grf-topo">
        <div className="grf-tot">
          <small>{txt.titulo}</small>
          <b>{brl(total)}</b>
          {pct !== null ? (
            <span className={pct >= 0 ? "sobe" : "desce"}>
              {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toLocaleString("pt-BR")}% <em>{txt.compara}</em>
            </span>
          ) : (
            <span><em>{total > 0 ? txt.nada : ""}</em></span>
          )}
          <span className="grf-hoje"><em>Hoje:</em> {brl(hojeValor)}</span>
        </div>
        <div className="grf-seg" role="tablist" aria-label="Período do gráfico">
          {([[7, "7 dias"], [30, "30 dias"], ["mes", "Este mês"]] as [Periodo, string][]).map(([k, rot]) => (
            <button key={String(k)} type="button" role="tab" aria-selected={periodo === k} onClick={() => setPeriodo(k)}>{rot}</button>
          ))}
        </div>
      </div>
      <div className="grf-leg" aria-hidden="true">
        <span><i className="a" />{txt.legA}</span>
        <span><i className="b" />{txt.legB}</span>
      </div>
      <div className="grf-g" role="img" aria-label={`${txt.titulo}: ${brl(total)}. ${txt.legB}: ${brl(totalAntes)}.`}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 210 }}>
          <AreaChart key={String(periodo)} data={serie} margin={{ top: 8, right: 18, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="grfArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ui-rosa)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--ui-rosa)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--ui-linha)" vertical={false} />
            <XAxis dataKey="dia" tick={{ fontSize: 12, fill: "var(--ui-texto-3)" }} tickLine={false} axisLine={false} interval={intervalo} padding={{ left: 4, right: 4 }} />
            <YAxis width={78} tick={{ fontSize: 12, fill: "var(--ui-texto-3)" }} tickLine={false} axisLine={false} tickFormatter={curto} tickCount={4} allowDecimals={false} />
            <Tooltip content={<Dica />} cursor={{ stroke: "var(--ui-rosa)", strokeDasharray: "4 4" }} isAnimationActive={false} />
            <Line type="monotone" dataKey="antes" stroke="#B9AFB3" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey="acum" stroke="var(--ui-rosa)" strokeWidth={2.5} fill="url(#grfArea)" dot={false}
              activeDot={{ r: 5, fill: "var(--ui-rosa)", stroke: "#fff", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import "@/components/inicio/graficoRecebido.css";

/**
 * (31/10 · 5.90) Visitas do cardápio no mesmo estilo do gráfico "Recebido" do Início: a linha rosa soma as visitas
 * ao longo do período (sempre sobe) e a tracejada cinza é o período anterior, para comparar o ritmo.
 * Arquivo à parte: a biblioteca do gráfico só é baixada quando ele aparece.
 */
export type PontoVisita = { rot: string; dica: string; n: number; nAntes: number | null; futuro?: boolean };

/** Ponto do gráfico como chega na dica (com a soma e o período anterior) */
type PontoDica = PontoVisita & { acum: number | null; antes: number | null; unidade: string };
function Dica({ active, payload, rotuloAntes }: { active?: boolean; payload?: { payload: PontoDica }[]; rotuloAntes?: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  if (p.acum == null) return null;
  return (
    <div className="grf-dica">
      <small>{p.dica}</small>
      <b>{p.acum} {p.acum === 1 ? "visita" : "visitas"} até aqui</b>
      <span>Neste {p.unidade}: {p.n}</span>
      {p.antes != null && <span>{rotuloAntes}: {p.antes}</span>}
    </div>
  );
}

/** altura: (6.169) no celular o gráfico é mais baixo e com o eixo mais estreito */
export default function GraficoVisitas({ serie, legA, legB, unidade, altura = 230 }: { serie: PontoVisita[]; legA: string; legB: string | null; unidade: string; altura?: number }) {
  const compacto = altura < 200;
  let a = 0, b = 0;
  // horas que ainda não chegaram (hoje): a linha rosa para no agora; a do período anterior segue inteira
  const dados = serie.map(p => { if (!p.futuro) a += p.n; if (p.nAntes != null) b += p.nAntes; return { ...p, acum: p.futuro ? null : a, antes: legB ? b : null, unidade }; });
  return (
    <div className="grf">
      <div className="grf-leg" aria-hidden="true">
        <span><i className="a" />{legA}</span>
        {legB && <span><i className="b" />{legB}</span>}
      </div>
      <div className="grf-g" style={{ height: altura }} role="img" aria-label={`${legA}: ${a} visitas${legB ? `. ${legB}: ${b}` : ""}.`}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: compacto ? 340 : 900, height: altura }}>
          <AreaChart data={dados} margin={{ top: 8, right: compacto ? 8 : 18, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gvArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ui-rosa)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--ui-rosa)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--ui-linha)" vertical={false} />
            <XAxis dataKey="rot" tick={{ fontSize: compacto ? 11 : 12, fill: "var(--ui-texto-3)" }} tickLine={false} axisLine={false} interval={0} padding={{ left: 4, right: 4 }} />
            <YAxis width={compacto ? 28 : 44} tick={{ fontSize: compacto ? 11 : 12, fill: "var(--ui-texto-3)" }} tickLine={false} axisLine={false} tickCount={4} allowDecimals={false} />
            <Tooltip content={<Dica rotuloAntes={legB} />} cursor={{ stroke: "var(--ui-rosa)", strokeDasharray: "4 4" }} isAnimationActive={false} />
            {legB && <Line type="monotone" dataKey="antes" stroke="#B9AFB3" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} isAnimationActive={false} />}
            <Area type="monotone" dataKey="acum" stroke="var(--ui-rosa)" strokeWidth={2.5} fill="url(#gvArea)" dot={false}
              activeDot={{ r: 5, fill: "var(--ui-rosa)", stroke: "#fff", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

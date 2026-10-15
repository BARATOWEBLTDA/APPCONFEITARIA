import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

/**
 * (15/10) Gráfico "Recebido (30 dias)" do Início, num arquivo à parte: a biblioteca do gráfico (recharts, pesada)
 * só é baixada quando o gráfico aparece, e não atrasa a abertura do Início.
 */
export default function GraficoRecebido({ dados }: { dados: { dia: string; valor: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={200} initialDimension={{ width: 600, height: 220 }}>
      <LineChart data={dados} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="dia" tick={{ fontSize: 12.5, fill: "var(--ui-texto-2)" }} tickLine={false} axisLine={false} interval={4} padding={{ left: 4, right: 12 }} />
        <YAxis width={72} tick={{ fontSize: 12.5, fill: "var(--ui-texto-2)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `R$ ${Number(v).toLocaleString("pt-BR")}`} />
        <Tooltip
          contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 13.5, fontFamily: "Geist,sans-serif" }}
          formatter={(v: any) => [new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v)), "Recebido"]}
        />
        <Line type="monotone" dataKey="valor" stroke="var(--text-title)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "var(--text-title)" }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

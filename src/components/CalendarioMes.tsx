// ── CalendarioMes.tsx ────────────────────────────────────────────────────────
// (04/11 · 6.49) Calendário do mês aberto na tela (sem janela): a confeiteira vê a data escolhida,
// o dia da semana e quantos pedidos já tem em cada dia (bolinha), pra não marcar evento em dia lotado.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import "./calendarioMes.css";

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function CalendarioMes({ valor, onChange, userId }: { valor: string; onChange: (iso: string) => void; userId?: string }) {
  const base = valor || hojeIso();
  const [mes, setMes] = useState({ a: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 });
  const [pedidosDia, setPedidosDia] = useState<Record<string, number>>({});
  const iso = (d: number) => `${mes.a}-${String(mes.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const vazios = new Date(mes.a, mes.m, 1).getDay(), total = new Date(mes.a, mes.m + 1, 0).getDate();
  const hoje = hojeIso();

  // quantos pedidos já tem em cada dia do mês (os cancelados não contam)
  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    supabase.from("pedidos").select("data_entrega").eq("user_id", userId).neq("status", "cancelado")
      .gte("data_entrega", iso(1)).lte("data_entrega", iso(total))
      .then(({ data }) => {
        if (!vivo) return;
        const m: Record<string, number> = {};
        for (const p of (data as { data_entrega: string | null }[] | null) || []) if (p.data_entrega) m[p.data_entrega.slice(0, 10)] = (m[p.data_entrega.slice(0, 10)] || 0) + 1;
        setPedidosDia(m);
      });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mes.a, mes.m]);

  const mudar = (n: number) => setMes(x => { const d = new Date(x.a, x.m + n, 1); return { a: d.getFullYear(), m: d.getMonth() }; });
  const nomeMes = new Date(mes.a, mes.m, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const podeVoltar = mes.a * 12 + mes.m > Number(hoje.slice(0, 4)) * 12 + Number(hoje.slice(5, 7)) - 1;
  const escolhido = valor ? new Date(`${valor}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) : "";

  return (
    <div className="cmes">
      <div className="cmes-nav">
        <button type="button" onClick={() => mudar(-1)} disabled={!podeVoltar} aria-label="Mês anterior"><CaretLeft size={18} weight="bold" /></button>
        <b>{nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}</b>
        <button type="button" onClick={() => mudar(1)} aria-label="Próximo mês"><CaretRight size={18} weight="bold" /></button>
      </div>
      <div className="cmes-grade" role="grid" aria-label="Escolha a data do evento">
        {SEMANA.map(d => <span key={d} className="cmes-sem">{d}</span>)}
        {Array.from({ length: vazios }, (_, i) => <span key={`v${i}`} />)}
        {Array.from({ length: total }, (_, i) => {
          const d = i + 1, s = iso(d), n = pedidosDia[s] || 0, passou = s < hoje;
          return (
            <button key={s} type="button" disabled={passou} aria-pressed={valor === s}
              className={`cmes-d${valor === s ? " on" : ""}${s === hoje ? " hoje" : ""}`}
              title={n ? `${n} ${n === 1 ? "pedido" : "pedidos"} nesse dia` : undefined}
              onClick={() => onChange(s)}>
              {d}{n > 0 && <i aria-hidden="true" className={n >= 4 ? "cheio" : ""} />}
            </button>
          );
        })}
      </div>
      <div className="cmes-pe">
        {escolhido
          ? <span><b>{escolhido.charAt(0).toUpperCase() + escolhido.slice(1)}</b>{pedidosDia[valor] ? <small>{pedidosDia[valor]} {pedidosDia[valor] === 1 ? "pedido" : "pedidos"} nesse dia</small> : <small>Nenhum pedido nesse dia</small>}</span>
          : <span><small>Toque no dia do evento</small></span>}
        <span className="cmes-leg"><i aria-hidden="true" />tem pedido</span>
      </div>
    </div>
  );
}

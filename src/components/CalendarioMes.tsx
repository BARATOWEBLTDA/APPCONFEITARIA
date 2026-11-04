// ── CalendarioMes.tsx ────────────────────────────────────────────────────────
// (04/11 · 6.50) Calendário do mês aberto na tela, com a react-day-picker (a mesma do shadcn/ui),
// nas cores do Doonly. A confeiteira vê a data escolhida e o dia da semana. Dias passados ficam apagados.
// (6.51) Evento de mais de um dia: com `varios`, ela toca no primeiro e no último dia e os dias do meio
// ficam marcados. Um toque depois de escolher os dias começa de novo.
// ─────────────────────────────────────────────────────────────────────────────
import { DayPicker, type DateRange } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import "react-day-picker/style.css";
import "./calendarioMes.css";
import { dataDoEvento } from "@/lib/orcamentos";

const paraIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const deIso = (s: string) => new Date(`${s.slice(0, 10)}T12:00:00`);
const meio = (d: Date) => { const x = new Date(d); x.setHours(12, 0, 0, 0); return x; };
const DIA = 86400000;

export default function CalendarioMes({ valor, fim, varios, onChange }: {
  valor: string; fim?: string | null; varios?: boolean; onChange: (ini: string, fim: string | null) => void; userId?: string;
}) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const ini = valor ? deIso(valor) : undefined;
  const ate = varios && fim && valor && fim > valor ? deIso(fim) : undefined;
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const ano = (d: Date): "numeric" | undefined => (d.getFullYear() !== hoje.getFullYear() ? "numeric" : undefined);

  let pe = "";
  if (ini && ate) {
    const dias = Math.round((ate.getTime() - ini.getTime()) / DIA) + 1;
    pe = `${dataDoEvento({ data_evento: valor, data_evento_fim: fim })} · ${dias} dias`;
  } else if (ini) {
    pe = cap(ini.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: ano(ini) }));
  }

  const comum = { locale: ptBR, defaultMonth: ini || hoje, startMonth: hoje, disabled: { before: hoje }, showOutsideDays: true, className: "cmes-rdp" } as const;

  return (
    <div className="cmes">
      {varios ? (
        <DayPicker {...comum} mode="range" selected={ini ? { from: ini, to: ate || ini } : undefined}
          onSelect={(_r: DateRange | undefined, dia: Date) => {
            const d = meio(dia);
            // já tem os dias escolhidos (ou nenhum) → começa de novo neste dia
            if (!ini || ate || d < ini) { onChange(paraIso(d), null); return; }
            // tinha só o primeiro dia → este é o último (o mesmo dia de novo = um dia só)
            onChange(paraIso(ini), d.getTime() === ini.getTime() ? null : paraIso(d));
          }} />
      ) : (
        <DayPicker {...comum} mode="single" selected={ini} onSelect={d => { if (d) onChange(paraIso(d), null); }} />
      )}
      <div className="cmes-pe">
        {pe ? <b>{pe}</b>
          : <small>{varios ? "Toque no primeiro e no último dia" : "Toque no dia do evento"}</small>}
        {varios && ini && !ate && <small>Agora toque no último dia</small>}
      </div>
    </div>
  );
}

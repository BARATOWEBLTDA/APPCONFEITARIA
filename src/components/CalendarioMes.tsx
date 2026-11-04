// ── CalendarioMes.tsx ────────────────────────────────────────────────────────
// (04/11 · 6.50) Calendário do mês aberto na tela, com a react-day-picker (a mesma do shadcn/ui),
// nas cores do Doonly. A confeiteira vê a data escolhida e o dia da semana. Dias passados ficam apagados.
// ─────────────────────────────────────────────────────────────────────────────
import { DayPicker } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import "react-day-picker/style.css";
import "./calendarioMes.css";

const paraIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const deIso = (s: string) => new Date(`${s}T12:00:00`);

export default function CalendarioMes({ valor, onChange }: { valor: string; onChange: (iso: string) => void; userId?: string }) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const sel = valor ? deIso(valor) : undefined;
  const escolhido = sel ? sel.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: sel.getFullYear() !== hoje.getFullYear() ? "numeric" : undefined }) : "";
  return (
    <div className="cmes">
      <DayPicker
        mode="single"
        locale={ptBR}
        selected={sel}
        defaultMonth={sel || hoje}
        startMonth={hoje}
        disabled={{ before: hoje }}
        onSelect={d => { if (d) onChange(paraIso(d)); }}
        showOutsideDays
        className="cmes-rdp"
      />
      <div className="cmes-pe">
        {escolhido
          ? <b>{escolhido.charAt(0).toUpperCase() + escolhido.slice(1)}</b>
          : <small>Toque no dia do evento</small>}
      </div>
    </div>
  );
}

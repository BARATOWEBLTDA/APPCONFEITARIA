/**
 * Seletor múltiplo de dias da semana.
 * Convenção: 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb, 7=Dom.
 *
 * Substitui o antigo input "dias por semana" (que aceitava só um número e
 * dava interpretações ambíguas como "5 dias = quais?").
 *
 * @example
 * <FinDaysOfWeek value={dias} onChange={setDias} />
 */

interface FinDaysOfWeekProps {
  /** Dias selecionados, 1-7 (1=Seg, 7=Dom) */
  value: number[];
  /** Recebe novo array ordenado */
  onChange: (days: number[]) => void;
}

const DAYS: { id: number; short: string; full: string }[] = [
  { id: 1, short: "Seg", full: "Segunda" },
  { id: 2, short: "Ter", full: "Terça" },
  { id: 3, short: "Qua", full: "Quarta" },
  { id: 4, short: "Qui", full: "Quinta" },
  { id: 5, short: "Sex", full: "Sexta" },
  { id: 6, short: "Sáb", full: "Sábado" },
  { id: 7, short: "Dom", full: "Domingo" },
];

export default function FinDaysOfWeek({ value, onChange }: FinDaysOfWeekProps) {
  function toggle(id: number) {
    const next = value.includes(id)
      ? value.filter((d) => d !== id)
      : [...value, id].sort((a, b) => a - b);
    onChange(next);
  }

  return (
    <div className="fin-dow" role="group" aria-label="Dias da semana trabalhados">
      {DAYS.map((d) => {
        const selected = value.includes(d.id);
        return (
          <button
            key={d.id}
            type="button"
            aria-pressed={selected}
            aria-label={d.full}
            className={`fin-dow-chip ${selected ? "fin-dow-chip--on" : ""}`}
            onClick={() => toggle(d.id)}
          >
            <span className="fin-dow-chip-short">{d.short}</span>
          </button>
        );
      })}

      <style>{`
        .fin-dow {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
        }
        .fin-dow-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          height: 44px;
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-family: inherit;
          font-size: var(--font-helper);
          font-weight: var(--fw-bold);
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease-out),
                      border-color var(--dur-fast) var(--ease-out),
                      color var(--dur-fast) var(--ease-out),
                      transform var(--dur-fast) var(--ease-out);
        }
        .fin-dow-chip:hover:not(.fin-dow-chip--on) {
          background: var(--bg-subtle);
          border-color: var(--primary-light);
        }
        .fin-dow-chip:active { transform: scale(0.96); }
        .fin-dow-chip:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }
        .fin-dow-chip--on {
          background: #3d1a24;
          border-color: #3d1a24;
          color: #fff;
          box-shadow: 0 3px 10px rgba(61, 26, 36, 0.22);
        }
        @media (max-width: 380px) {
          .fin-dow-chip { font-size: 12px; }
        }
      `}</style>
    </div>
  );
}

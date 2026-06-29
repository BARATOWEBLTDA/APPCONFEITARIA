import type { ReactNode } from "react";

export interface FinSegmentedOption<TKey extends string = string> {
  key: TKey;
  label: ReactNode;
}

interface FinSegmentedProps<TKey extends string> {
  options: FinSegmentedOption<TKey>[];
  value: TKey;
  onChange: (key: TKey) => void;
  ariaLabel?: string;
}

/**
 * Toggle segmented control. Substitui o antigo `.cu-radio-group`.
 * Visual padronizado: pill, opção ativa em rosa-claro, transição suave.
 *
 * @example
 * <FinSegmented
 *   value={tipo}
 *   onChange={setTipo}
 *   options={[
 *     { key: "percentual", label: "% Percentual" },
 *     { key: "fixo",       label: "R$ Fixo" },
 *   ]}
 * />
 */
export default function FinSegmented<TKey extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: FinSegmentedProps<TKey>) {
  return (
    <div className="fin-seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => {
        const isActive = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={`fin-seg-opt ${isActive ? "fin-seg-opt--active" : ""}`}
            onClick={() => onChange(opt.key)}
          >
            {opt.label}
          </button>
        );
      })}

      <style>{`
        .fin-seg {
          display: flex;
          gap: var(--space-1);
          padding: 4px;
          background: var(--bg-subtle);
          border-radius: var(--radius-md);
        }
        .fin-seg-opt {
          flex: 1;
          padding: var(--space-2) var(--space-3);
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: var(--fw-semibold);
          color: var(--text-secondary);
          cursor: pointer;
          min-height: 38px;
          transition: background var(--dur-fast) var(--ease-out),
                      color var(--dur-fast) var(--ease-out),
                      box-shadow var(--dur-fast) var(--ease-out);
        }
        .fin-seg-opt:hover:not(.fin-seg-opt--active) {
          color: var(--text-title);
        }
        .fin-seg-opt:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }
        .fin-seg-opt--active {
          background: var(--bg-card);
          color: var(--text-title);
          box-shadow: var(--shadow-sm);
        }
      `}</style>
    </div>
  );
}

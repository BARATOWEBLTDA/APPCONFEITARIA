import type { ReactNode } from "react";

export interface FinTab<TKey extends string = string> {
  key: TKey;
  label: string;
  icon: ReactNode;
}

interface FinTabsProps<TKey extends string> {
  tabs: FinTab<TKey>[];
  active: TKey;
  onChange: (key: TKey) => void;
  /** Texto opcional para screen readers descrevendo o grupo */
  ariaLabel?: string;
}

/**
 * Tabs do módulo Financeiro.
 * - Mobile: grid 2 colunas, cards-pill com ícone + label, área de toque grande.
 * - Desktop (≥720px): linha única, formato segmented horizontal.
 * Elimina o scroll horizontal que existia antes.
 *
 * @example
 * <FinTabs
 *   tabs={[{ key: "resumo", label: "Resumo", icon: <House /> }, ...]}
 *   active={tab}
 *   onChange={setTab}
 * />
 */
export default function FinTabs<TKey extends string>({
  tabs,
  active,
  onChange,
  ariaLabel = "Seções",
}: FinTabsProps<TKey>) {
  return (
    <div className="fin-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`fin-tab ${isActive ? "fin-tab--active" : ""}`}
            onClick={() => onChange(t.key)}
          >
            <span className="fin-tab-icon">{t.icon}</span>
            <span className="fin-tab-label">{t.label}</span>
          </button>
        );
      })}

      <style>{`
        .fin-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-2);
        }
        .fin-tab {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-3);
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: var(--fw-semibold);
          cursor: pointer;
          min-height: 52px;
          text-align: left;
          transition:
            background var(--dur-fast) var(--ease-out),
            border-color var(--dur-fast) var(--ease-out),
            color var(--dur-fast) var(--ease-out),
            transform var(--dur-fast) var(--ease-out);
        }
        .fin-tab:hover:not(.fin-tab--active) {
          background: var(--bg-subtle);
          border-color: var(--primary-light);
        }
        .fin-tab:active {
          transform: scale(0.985);
        }
        .fin-tab:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }
        .fin-tab--active {
          background: var(--text-title);
          border-color: var(--text-title);
          color: #fff;
          box-shadow: 0 4px 14px rgba(61, 26, 36, 0.22);
        }
        .fin-tab-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: var(--radius-sm);
          background: var(--primary-light);
          color: var(--text-title);
          flex-shrink: 0;
        }
        .fin-tab--active .fin-tab-icon {
          background: rgba(255, 255, 255, 0.16);
          color: #fff;
        }
        .fin-tab-label {
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (min-width: 720px) {
          .fin-tabs {
            display: flex;
            gap: var(--space-1);
            padding: var(--space-1);
            background: var(--bg-subtle);
            border-radius: var(--radius-md);
            border: none;
          }
          .fin-tab {
            flex: 1;
            justify-content: center;
            padding: var(--space-2) var(--space-3);
            min-height: 40px;
            border: none;
            border-radius: var(--radius-sm);
            background: transparent;
            box-shadow: none;
          }
          .fin-tab--active {
            background: var(--bg-card);
            border: none;
            color: var(--text-title);
            box-shadow: var(--shadow-sm);
          }
          .fin-tab-icon {
            width: 22px;
            height: 22px;
            background: transparent;
          }
          .fin-tab--active .fin-tab-icon {
            background: var(--primary-light);
            color: var(--text-title);
          }
        }
      `}</style>
    </div>
  );
}

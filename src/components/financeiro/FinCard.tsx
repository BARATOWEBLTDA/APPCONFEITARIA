import type { ReactNode } from "react";

interface FinCardProps {
  /** Ícone principal (ex.: <Buildings />) */
  icon?: ReactNode;
  /** Título do card */
  title?: ReactNode;
  /** Descrição abaixo do título */
  description?: ReactNode;
  /** Conteúdo do card */
  children?: ReactNode;
  /** Ação opcional no header (ex.: BtnNovo) */
  headerAction?: ReactNode;
  /** Classe extra opcional */
  className?: string;
}

/**
 * Card padrão do módulo Financeiro.
 * Header (ícone + título + ação) + descrição + body.
 * Mesmo padding, mesma borda e raio em todas as telas do Financeiro.
 *
 * @example
 * <FinCard
 *   icon={<Buildings weight="duotone" size={20} />}
 *   title="Gestão de Custos Fixos"
 *   description="Custos fixos mensais (aluguel, internet, energia)..."
 *   headerAction={<BtnNovo label="Novo custo" onClick={open} />}
 * >
 *   ... lista ...
 * </FinCard>
 */
export default function FinCard({
  icon,
  title,
  description,
  children,
  headerAction,
  className = "",
}: FinCardProps) {
  const hasHeader = icon || title || headerAction;

  return (
    <section className={`fin-card ${className}`.trim()}>
      {hasHeader && (
        <header className="fin-card-header">
          <div className="fin-card-heading">
            {icon && <span className="fin-card-icon">{icon}</span>}
            {title && <h2 className="fin-card-title">{title}</h2>}
          </div>
          {headerAction && <div className="fin-card-action">{headerAction}</div>}
        </header>
      )}
      {description && <p className="fin-card-desc">{description}</p>}
      {children && <div className="fin-card-body">{children}</div>}

      <style>{`
        .fin-card {
          padding: var(--pad-card);
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .fin-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-2);
          flex-wrap: wrap;
        }
        .fin-card-heading {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--text-title);
          min-width: 0;
          flex: 1;
        }
        .fin-card-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--text-title);
          flex-shrink: 0;
        }
        .fin-card-title {
          font-size: var(--font-card-title);
          font-weight: var(--fw-bold);
          color: var(--text-title);
          margin: 0;
          letter-spacing: var(--ls-tight);
        }
        .fin-card-action {
          flex-shrink: 0;
        }
        .fin-card-desc {
          font-size: var(--font-helper);
          color: var(--text-secondary);
          line-height: var(--lh-normal);
          margin: 0;
        }
        .fin-card-body {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
      `}</style>
    </section>
  );
}

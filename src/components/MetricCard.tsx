import type { ReactNode } from "react";

// ── Mapa local de variantes — cores de analytics do sistema (não pertencem ao themes.css)
const METRIC_VARIANTS = {
  orders: {
    gradient: "linear-gradient(135deg, var(--primary, #FF6FA9), #F85A9A)",
  },
  revenue: {
    gradient: "linear-gradient(135deg, #10b981, #059669)",
  },
  customers: {
    gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  },
} as const;

type MetricVariant = keyof typeof METRIC_VARIANTS;

interface MetricCardProps {
  variant: MetricVariant;
  icon: ReactNode;
  label: string;
  value?: ReactNode;
  emptyText?: string;
  onClick?: () => void;
}

export function MetricCard({ variant, icon, label, value, emptyText, onClick }: MetricCardProps) {
  const { gradient } = METRIC_VARIANTS[variant];

  return (
    <div
      className="dash-metric-card"
      onClick={onClick}
      style={{ background: gradient, overflow: "hidden", position: "relative" }}
    >
      {/* Detalhe decorativo */}
      <svg
        style={{ position: "absolute", right: "-10px", bottom: "-10px", opacity: 0.15 }}
        width="100" height="100" viewBox="0 0 100 100"
      >
        <circle cx="80" cy="80" r="60" fill="white" />
        <circle cx="80" cy="80" r="40" fill="white" />
      </svg>

      {/* Ícone */}
      <div
        className="dash-metric-icon"
        style={{ background: "rgba(255,255,255,0.2)", zIndex: 1 }}
      >
        {icon}
      </div>

      {/* Conteúdo */}
      <div style={{ zIndex: 1 }}>
        {value !== undefined && value !== null && value !== 0
          ? <p className="dash-metric-num" style={{ color: "white" }}>{value}</p>
          : emptyText
            ? <p className="dash-metric-empty" style={{ color: "rgba(255,255,255,0.9)" }}>{emptyText}</p>
            : <p className="dash-metric-num" style={{ color: "white" }}>{value}</p>
        }
        <p className="dash-metric-label" style={{ color: "rgba(255,255,255,0.8)" }}>{label}</p>
      </div>
    </div>
  );
}

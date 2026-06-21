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
  cardapio: {
    gradient: "linear-gradient(135deg, #f97316, #ea580c)",
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
      style={{
        background: gradient,
        overflow: "hidden",
        position: "relative",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: "0.5rem",
        boxShadow: "0 8px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.12)",
      }}
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
        style={{
          background: "rgba(255,255,255,0.98)",
          zIndex: 1,
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        }}
      >
        {icon}
      </div>

      {/* Conteúdo */}
      <div style={{ zIndex: 1 }}>
        {value !== undefined && value !== null && value !== 0
          ? <p className="dash-metric-num" style={{ color: "white" }}>{value}</p>
          : null
        }
        <p className="dash-metric-label" style={{ color: "white", fontWeight: 700 }}>{label}</p>
      </div>
    </div>
  );
}

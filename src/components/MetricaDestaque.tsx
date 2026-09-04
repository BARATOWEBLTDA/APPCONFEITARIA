/**
 * MetricaDestaque.tsx
 * ─────────────────────────────────────────────
 * Card branco sobreposto ao hero (mesma vibe do Banggood).
 * Mostra a métrica que o usuário escolheu em Configurações.
 * Padrão: Faturamento do mês.
 * ─────────────────────────────────────────────
 */

import { useEffect, useState } from "react";
import {
  getMetricaEscolhida,
  fetchMetricaData,
  METRICAS_DISPONIVEIS,
  type MetricaData,
  type MetricaId,
} from "@/lib/metricas-inicio";

interface Props {
  userId: string;
}

export default function MetricaDestaque({ userId }: Props) {
  const [metricaId, setMetricaId] = useState<MetricaId>(getMetricaEscolhida());
  const [data, setData] = useState<MetricaData | null>(null);
  const [loading, setLoading] = useState(true);

  // Escuta troca de métrica (evento disparado pela tela de Configurações)
  useEffect(() => {
    const handler = (e: any) => setMetricaId(e.detail as MetricaId);
    window.addEventListener("doonly:metrica-changed", handler);
    return () => window.removeEventListener("doonly:metrica-changed", handler);
  }, []);

  // Busca os dados sempre que muda a métrica ou o userId
  useEffect(() => {
    if (!userId) return;
    let cancelado = false;
    setLoading(true);
    fetchMetricaData(metricaId, userId).then((d) => {
      if (!cancelado) {
        setData(d);
        setLoading(false);
      }
    });
    return () => { cancelado = true; };
  }, [metricaId, userId]);

  const opt = METRICAS_DISPONIVEIS.find((m) => m.id === metricaId);
  if (!opt) return null;

  return (
    <div className="md-card">
      <div className="md-icon">
        <span className="md-emoji">{opt.emoji}</span>
      </div>
      <div className="md-content">
        <p className="md-label">{data?.label || opt.titulo}</p>
        <p className={`md-value ${data && data.valor.length > 12 ? "md-value--sm" : ""}`}>
          {loading ? <span className="md-skeleton md-skeleton--val" /> : (data?.valor || "—")}
        </p>
        {!loading && data?.sub && !data.tag && <p className="md-sub">{data.sub}</p>}
        {!loading && data?.tag && (
          <span className={`md-tag ${data.tag.positivo ? "md-tag--up" : "md-tag--down"}`}>
            {data.tag.texto}
          </span>
        )}
      </div>

      <style>{`
        .md-card {
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 10px 30px rgba(45, 31, 38, 0.15);
          border: 1px solid rgba(45, 31, 38, 0.06);
          color: var(--text-title);
        }
        .md-icon {
          width: 42px; height: 42px;
          border-radius: var(--radius-md);
          background: var(--primary-light);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .md-emoji { font-size: 22px; line-height: 1; }
        .md-content { flex: 1; min-width: 0; }
        .md-label {
          margin: 0;
          font-size: 10px;
          color: var(--text-muted);
          font-weight: var(--fw-bold);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .md-value {
          margin: 2px 0 0;
          font-size: 20px;
          font-weight: var(--fw-black);
          color: var(--text-title);
          letter-spacing: -0.02em;
          line-height: 1.15;
        }
        .md-value--sm { font-size: 15px; }
        .md-sub {
          margin: 2px 0 0;
          font-size: 11px;
          color: var(--text-secondary);
          font-weight: var(--fw-medium);
        }
        .md-tag {
          display: inline-flex;
          align-items: center;
          padding: 2px 7px;
          border-radius: var(--radius-full);
          font-size: 10px;
          font-weight: var(--fw-black);
          margin-top: 3px;
        }
        .md-tag--up { background: var(--gam-success-bg); color: var(--gam-success-text); }
        .md-tag--down { background: rgba(209, 72, 72, 0.12); color: #A63030; }

        /* Skeleton loading */
        .md-skeleton {
          display: inline-block;
          background: linear-gradient(90deg, var(--bg-subtle) 25%, rgba(var(--primary-rgb), 0.08) 50%, var(--bg-subtle) 75%);
          background-size: 200% 100%;
          animation: mdShimmer 1.5s ease infinite;
          border-radius: 4px;
          height: 22px;
        }
        .md-skeleton--val { width: 100px; }
        @keyframes mdShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
      `}</style>
    </div>
  );
}

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

  // Detecta se é métrica de faturamento zerada — pra mostrar ícone de info explicando
  const isFaturamento = metricaId === "faturamento-mes" || metricaId === "faturamento-hoje";
  const valorZerado = data?.valor === "R$ 0,00" || data?.valor === "R$\u00A00,00";
  const mostrarInfo = !loading && isFaturamento && valorZerado;

  const [infoOpen, setInfoOpen] = useState(false);

  const explicacao = metricaId === "faturamento-hoje" ? (
    <>
      Nenhum pedido foi registrado <b>hoje</b> ainda.<br/><br/>
      Assim que você registrar um pedido novo (ou receber um pelo <b>cardápio digital</b>), o valor de hoje começa a aparecer aqui automaticamente.
    </>
  ) : (
    <>
      Seu faturamento aparece <b>R$ 0,00</b> porque nenhum pedido foi registrado <b>neste mês</b> ainda.<br/><br/>
      Assim que você registrar seu primeiro pedido (ou receber um pelo <b>cardápio digital</b>), o valor começa a aparecer aqui automaticamente.
    </>
  );

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

      {/* Ícone info — só aparece se faturamento está zerado */}
      {mostrarInfo && (
        <button
          type="button"
          className="md-info-btn"
          onClick={() => setInfoOpen(true)}
          aria-label="Por que está zerado?"
        >
          i
        </button>
      )}

      {/* Bottom sheet explicativo */}
      {infoOpen && (
        <div className="md-sheet-overlay" onClick={() => setInfoOpen(false)}>
          <div className="md-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="md-sheet-handle" aria-hidden="true"></div>
            <div className="md-sheet-header">
              <div className="md-sheet-icon">{opt.emoji}</div>
              <p className="md-sheet-title">Por que está zerado?</p>
              <button className="md-sheet-close" onClick={() => setInfoOpen(false)} aria-label="Fechar">✕</button>
            </div>
            <div className="md-sheet-body">{explicacao}</div>
          </div>
        </div>
      )}

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
          position: relative;
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

        /* ── Ícone info no canto (quando faturamento zerado) ── */
        .md-info-btn {
          position: absolute;
          top: 8px; right: 8px;
          width: 22px; height: 22px;
          border-radius: 50%;
          background: var(--bg-subtle, #FBF4F6);
          color: var(--text-secondary);
          border: none;
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          font-size: 12px;
          font-weight: var(--fw-bold);
          line-height: 1;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background var(--dur-fast), color var(--dur-fast);
        }
        .md-info-btn:hover {
          background: var(--primary-light);
          color: var(--primary);
        }
        .md-info-btn:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }

        /* ── Bottom sheet explicativo ── */
        .md-sheet-overlay {
          position: fixed;
          inset: 0;
          background: rgba(45, 31, 38, 0.6);
          z-index: 1000;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          animation: mdOverlayIn 0.2s ease;
        }
        @keyframes mdOverlayIn { from { opacity: 0; } to { opacity: 1; } }

        .md-sheet {
          background: var(--bg-card);
          width: 100%;
          max-width: 500px;
          border-radius: 20px 20px 0 0;
          padding: 8px 18px 24px;
          box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.2);
          animation: mdSheetIn 0.25s cubic-bezier(0.22, 1, 0.36, 1);
          padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
        }
        @keyframes mdSheetIn { from { transform: translateY(100%); } to { transform: translateY(0); } }

        .md-sheet-handle {
          width: 40px; height: 4px;
          background: var(--border);
          border-radius: 2px;
          margin: 0 auto 14px;
        }
        .md-sheet-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .md-sheet-icon {
          width: 36px; height: 36px;
          border-radius: var(--radius-md);
          background: var(--primary-light);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }
        .md-sheet-title {
          margin: 0;
          flex: 1;
          font-size: var(--text-md);
          font-weight: var(--fw-black);
          color: var(--text-title);
          letter-spacing: -0.01em;
        }
        .md-sheet-close {
          background: var(--bg-subtle, #FBF4F6);
          border: none;
          width: 30px; height: 30px;
          border-radius: 50%;
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: var(--fw-bold);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background var(--dur-fast);
        }
        .md-sheet-close:hover { background: var(--border); }
        .md-sheet-body {
          font-size: var(--text-sm);
          color: var(--text-primary);
          line-height: 1.55;
        }
        .md-sheet-body b { color: var(--text-title); }

        /* Desktop: modal centralizado em vez de bottom sheet */
        @media (min-width: 900px) {
          .md-sheet-overlay { align-items: center; }
          .md-sheet {
            max-width: 420px;
            border-radius: var(--radius-lg);
            padding: 20px 22px 22px;
            animation: mdSheetInDesk 0.2s cubic-bezier(0.22, 1, 0.36, 1);
          }
          .md-sheet-handle { display: none; }
        }
        @keyframes mdSheetInDesk {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

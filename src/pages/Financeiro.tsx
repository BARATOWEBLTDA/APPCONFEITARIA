// Financeiro — Hub-landing
// Sub-páginas: Visão Geral, Transações, Custos
import { useNavigate } from "react-router-dom";
import type { ReactElement } from "react";
import {
  ChartLineUp, ArrowsLeftRight, Calculator, CaretRight,
} from "@phosphor-icons/react";

interface Section {
  label: string;
  desc: string;
  icon: ReactElement;
  path: string;
}

export default function Financeiro() {
  const navigate = useNavigate();

  const sections: Section[] = [
    {
      label: "Visão Geral",
      desc: "Dashboard com resumo, gráficos e indicadores",
      icon: <ChartLineUp size={20} weight="duotone" />,
      path: "/financeiro/visao-geral",
    },
    {
      label: "Transações",
      desc: "Vendas, entradas e saídas — tudo num só lugar",
      icon: <ArrowsLeftRight size={20} weight="duotone" />,
      path: "/financeiro/visao-geral",
    },
    {
      label: "Custos",
      desc: "Fixos, variáveis e mão de obra",
      icon: <Calculator size={20} weight="duotone" />,
      path: "/custos",
    },
  ];

  return (
    <div className="fh-root">
      <div className="fh-header">
        <h1 className="fh-title">Financeiro</h1>
        <p className="fh-sub">Controle de entradas e saídas financeiras</p>
      </div>

      <div className="fh-block">
        <h2 className="fh-block-title">Operações</h2>
        <div className="fh-tiles">
          {sections.map((s) => (
            <button key={s.label} className="fh-tile" onClick={() => navigate(s.path)}>
              <span className="fh-tile-icon">{s.icon}</span>
              <span className="fh-tile-body">
                <span className="fh-tile-label">{s.label}</span>
                <span className="fh-tile-desc">{s.desc}</span>
              </span>
              <CaretRight size={16} weight="bold" className="fh-tile-arrow" />
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .fh-root {
          font-family: var(--font-base);
          padding: var(--space-5) var(--space-4) 6rem;
          display: flex; flex-direction: column; gap: var(--space-4);
          max-width: 980px; margin: 0 auto;
        }
        .fh-header { display: flex; flex-direction: column; gap: var(--space-1); }
        .fh-title {
          font-size: var(--font-page-title);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0;
          letter-spacing: var(--ls-tight);
        }
        .fh-sub {
          font-size: var(--font-page-subtitle);
          color: var(--text-secondary);
          margin: 0;
        }
        .fh-block { display: flex; flex-direction: column; gap: var(--space-3); }
        .fh-block-title {
          font-size: var(--font-button);
          font-weight: var(--fw-bold);
          color: var(--text-title);
          margin: 0;
          letter-spacing: var(--ls-tight);
        }
        .fh-tiles {
          display: flex; flex-direction: column;
          gap: var(--space-1);
          padding: var(--space-2);
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
        }
        .fh-tile {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          font-family: inherit;
          cursor: pointer;
          text-align: left;
          transition: background var(--dur-fast) var(--ease-out);
        }
        .fh-tile:hover { background: var(--bg-subtle); }
        .fh-tile:active { background: var(--primary-light); }
        .fh-tile-icon {
          width: 40px; height: 40px;
          border-radius: var(--radius-md);
          background: var(--primary-light);
          color: var(--text-title);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .fh-tile-body {
          flex: 1; min-width: 0;
          display: flex; flex-direction: column; gap: 2px;
        }
        .fh-tile-label {
          font-size: var(--font-card-title);
          font-weight: var(--fw-bold);
          color: var(--text-title);
        }
        .fh-tile-desc {
          font-size: var(--font-helper);
          color: var(--text-secondary);
        }
        .fh-tile-arrow { color: var(--text-muted); flex-shrink: 0; }
      `}</style>
    </div>
  );
}

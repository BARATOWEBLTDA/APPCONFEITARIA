// Build marker: 2026-09-03T15:00 — welcome checklist redesenhado (donut + minimizar)
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserCircle, Storefront, Package,
  ShoppingBag, ClipboardText, CheckCircle,
  PlayCircle, CaretRight, Minus, Plus,
} from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import Onboarding from "@/components/Onboarding";

interface Step {
  id: string;
  icon: React.ReactNode;
  title: string;
  cta: string;
  path: string;
  done: boolean;
}

const LS_MINIMIZED = "doonly_welcome_minimized";

export default function WelcomeChecklist({ userId, onAllDone }: { userId: string; onAllDone?: (done: boolean) => void }) {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [minimized, setMinimized] = useState<boolean>(() => {
    try { return localStorage.getItem(LS_MINIMIZED) === "1"; } catch { return false; }
  });
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [tutorialDone, setTutorialDone] = useState(() => {
    try { return !!localStorage.getItem("doonly_tutorial_visto"); } catch { return false; }
  });

  // Auto-abertura do tutorial no primeiro login é feita no App.tsx (PrivateRoute).
  // Aqui só cuidamos da abertura manual pelo botão "Iniciar tutorial".
  const handleTutorialClose = (slideAlcancada: number) => {
    setOnboardingOpen(false);
    if (slideAlcancada >= 5) {
      try { localStorage.setItem("doonly_tutorial_visto", "1"); } catch {}
      setTutorialDone(true);
    }
  };

  const toggleMinimized = () => {
    setMinimized((v) => {
      const novo = !v;
      try { localStorage.setItem(LS_MINIMIZED, novo ? "1" : "0"); } catch {}
      return novo;
    });
  };

  useEffect(() => {
    if (!userId) return;
    checkSteps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tutorialDone]);

  const checkSteps = async () => {
    try {
      const [profileRes, insumosRes, produtosRes, pedidosRes] = await Promise.all([
        supabase.from("profiles").select("nome, nome_loja, foto_url, telefone").eq("id", userId).single(),
        supabase.from("insumos").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("produtos").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);

      const p = profileRes.data;
      const iconSize = 20;

      setSteps([
        {
          id: "tutorial",
          icon: <PlayCircle size={iconSize} weight="duotone" />,
          title: "Complete o Tutorial",
          cta: "Iniciar tutorial",
          path: "__tutorial__",
          done: tutorialDone,
        },
        {
          id: "perfil",
          icon: <UserCircle size={iconSize} weight="duotone" />,
          title: "Complete seu perfil",
          cta: "Completar perfil",
          path: "/configuracoes",
          done: !!(p?.nome && p?.foto_url),
        },
        {
          id: "loja",
          icon: <Storefront size={iconSize} weight="duotone" />,
          title: "Configure sua confeitaria",
          cta: "Configurar loja",
          path: "/cardapio-config",
          done: !!(p?.nome_loja),
        },
        {
          id: "insumos",
          icon: <Package size={iconSize} weight="duotone" />,
          title: "Cadastre seus insumos",
          cta: "Cadastrar insumos",
          path: "/insumos",
          done: (insumosRes.count ?? 0) > 0,
        },
        {
          id: "produtos",
          icon: <ShoppingBag size={iconSize} weight="duotone" />,
          title: "Monte seu cardápio",
          cta: "Adicionar produto",
          path: "/produtos",
          done: (produtosRes.count ?? 0) > 0,
        },
        {
          id: "pedidos",
          icon: <ClipboardText size={iconSize} weight="duotone" />,
          title: "Registre seu primeiro pedido",
          cta: "Novo pedido",
          path: "/pedidos/novo",
          done: (pedidosRes.count ?? 0) > 0,
        },
      ]);
    } catch (e) {
      console.error("WelcomeChecklist:", e);
    }
    setLoading(false);
  };

  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = total > 0 && doneCount === total;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const faltam = total - doneCount;

  useEffect(() => { onAllDone?.(allDone); }, [allDone]);

  if (loading || allDone) return null;

  // Copy motivadora dinâmica
  const copyMotivadora = (() => {
    if (pct === 0) return `Bora começar? São ${total} passos rápidos ✨`;
    if (pct < 34) return `Bom começo! Continua assim 🚀`;
    if (pct < 67) return `Você tá indo bem 💪`;
    if (pct < 100) return `Falta${faltam > 1 ? "m" : ""} ${faltam} passo${faltam > 1 ? "s" : ""} pra começar a lucrar 🍰`;
    return `Perfeito! Tudo configurado ✨`;
  })();

  const executarStep = (step: Step) => {
    if (step.done) return;
    if (step.path === "__tutorial__") setOnboardingOpen(true);
    else navigate(step.path);
  };

  // Geometria do donut
  const RAIO = 44;
  const CIRCUM = 2 * Math.PI * RAIO;
  const DASH_OFFSET = CIRCUM * (1 - pct / 100);

  // Geometria do donut MINI (barra minimizada)
  const RAIO_MINI = 14;
  const CIRCUM_MINI = 2 * Math.PI * RAIO_MINI;
  const DASH_OFFSET_MINI = CIRCUM_MINI * (1 - pct / 100);

  return (
    <>
      {minimized ? (
        // ─── MODO MINIMIZADO ───
        <button className="wc-bar" onClick={toggleMinimized} type="button">
          <svg className="wc-bar-donut" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r={RAIO_MINI} className="wc-bar-donut-bg" />
            <circle
              cx="18" cy="18" r={RAIO_MINI}
              className="wc-bar-donut-fill"
              strokeDasharray={CIRCUM_MINI}
              strokeDashoffset={DASH_OFFSET_MINI}
              transform="rotate(-90 18 18)"
            />
          </svg>
          <div className="wc-bar-text">
            <span className="wc-bar-title">Configuração inicial</span>
            <span className="wc-bar-sub">{doneCount} de {total} concluídos · {pct}%</span>
          </div>
          <span className="wc-bar-expand" aria-label="Expandir">
            <Plus size={16} weight="bold" />
          </span>
        </button>
      ) : (
        // ─── MODO EXPANDIDO ───
        <div className="wc-root">
          <button
            className="wc-minimize"
            onClick={toggleMinimized}
            type="button"
            aria-label="Minimizar"
            title="Minimizar"
          >
            <Minus size={16} weight="bold" />
          </button>

          {/* Donut de progresso */}
          <div className="wc-donut-wrap">
            <svg className="wc-donut" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="wcDonutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f4c95d" />
                  <stop offset="100%" stopColor="#c8891f" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r={RAIO} className="wc-donut-bg" />
              <circle
                cx="50" cy="50" r={RAIO}
                className="wc-donut-fill"
                strokeDasharray={CIRCUM}
                strokeDashoffset={DASH_OFFSET}
                transform="rotate(-90 50 50)"
              />
              <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="wc-donut-pct">
                {pct}%
              </text>
            </svg>
          </div>

          {/* Copy motivadora */}
          <p className="wc-hype">{copyMotivadora}</p>

          {/* Steps */}
          <ul className="wc-list">
            {steps.map((step) => (
              <li key={step.id}>
                <button
                  className={`wc-item ${step.done ? "wc-item--done" : ""}`}
                  onClick={() => executarStep(step)}
                  disabled={step.done && step.id !== "tutorial"}
                  type="button"
                >
                  <span className={`wc-item-icon ${step.done ? "wc-item-icon--done" : ""}`}>
                    {step.done ? <CheckCircle size={20} weight="fill" /> : step.icon}
                  </span>
                  <span className="wc-item-title">{step.title}</span>
                  {(!step.done || step.id === "tutorial") && (
                    <CaretRight size={14} weight="bold" className="wc-item-arrow" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <style>{`
        /* ══════════════════════════════════════════
           MODO EXPANDIDO
           ══════════════════════════════════════════ */
        .wc-root {
          position: relative;
          background: linear-gradient(180deg, #faf5e8 0%, var(--bg-card) 60%);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 1.5rem 1.25rem 1.25rem;
          box-shadow: 0 4px 20px rgba(61, 26, 36, 0.08);
          overflow: hidden;
        }
        .wc-minimize {
          position: absolute;
          top: 12px; right: 12px;
          width: 30px; height: 30px;
          border-radius: 50%;
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-muted);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: transform var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast);
          z-index: 1;
        }
        .wc-minimize:hover { color: var(--text-title); border-color: var(--text-muted); transform: scale(1.05); }

        /* Donut grande */
        .wc-donut-wrap {
          display: flex; justify-content: center;
          margin-bottom: 0.75rem;
        }
        .wc-donut {
          width: 128px; height: 128px;
          filter: drop-shadow(0 4px 12px rgba(200, 137, 31, 0.25));
        }
        .wc-donut-bg {
          fill: none;
          stroke: rgba(200, 137, 31, 0.15);
          stroke-width: 8;
        }
        .wc-donut-fill {
          fill: none;
          stroke: url(#wcDonutGrad);
          stroke-width: 8;
          stroke-linecap: round;
          transition: stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .wc-donut-pct {
          font-size: 24px;
          font-weight: 800;
          fill: var(--text-title);
          letter-spacing: -0.02em;
        }

        /* Copy motivadora */
        .wc-hype {
          text-align: center;
          margin: 0 0 1.25rem;
          font-size: 0.95rem;
          font-weight: var(--fw-semibold);
          color: var(--text-title);
          line-height: 1.35;
        }

        /* Lista */
        .wc-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: var(--bg-card);
          border-radius: var(--radius-md);
          padding: 6px;
          border: 1px solid var(--border);
        }
        .wc-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.7rem 0.75rem;
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          cursor: pointer;
          text-align: left;
          transition: background var(--dur-fast);
        }
        .wc-item:not(:disabled):hover { background: var(--bg-subtle); }
        .wc-item:disabled { cursor: default; }

        .wc-item-icon {
          width: 32px; height: 32px;
          border-radius: 50%;
          background: rgba(200, 137, 31, 0.10);
          color: #c8891f;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .wc-item-icon--done {
          background: rgba(46, 160, 67, 0.12);
          color: #2ea043;
        }
        .wc-item-title {
          flex: 1;
          font-size: 0.95rem;
          font-weight: var(--fw-medium);
          color: var(--text-title);
        }
        .wc-item--done .wc-item-title {
          color: var(--text-muted);
          text-decoration: line-through;
          text-decoration-color: rgba(0,0,0,0.2);
        }
        .wc-item-arrow {
          color: var(--text-muted);
          flex-shrink: 0;
          transition: transform var(--dur-fast), color var(--dur-fast);
        }
        .wc-item:not(:disabled):hover .wc-item-arrow {
          color: #c8891f;
          transform: translateX(3px);
        }

        /* ══════════════════════════════════════════
           MODO MINIMIZADO — barra fina
           ══════════════════════════════════════════ */
        .wc-bar {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.75rem 1rem;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          text-align: left;
          transition: border-color var(--dur-fast), box-shadow var(--dur-fast);
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .wc-bar:hover { border-color: #c8891f; box-shadow: 0 4px 14px rgba(200, 137, 31, 0.15); }

        .wc-bar-donut {
          width: 36px; height: 36px;
          flex-shrink: 0;
        }
        .wc-bar-donut-bg {
          fill: none;
          stroke: rgba(200, 137, 31, 0.18);
          stroke-width: 4;
        }
        .wc-bar-donut-fill {
          fill: none;
          stroke: #c8891f;
          stroke-width: 4;
          stroke-linecap: round;
          transition: stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .wc-bar-text {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          line-height: 1.25;
        }
        .wc-bar-title {
          font-size: 0.92rem;
          font-weight: var(--fw-semibold);
          color: var(--text-title);
        }
        .wc-bar-sub {
          font-size: 0.78rem;
          color: var(--text-muted);
        }
        .wc-bar-expand {
          width: 28px; height: 28px;
          border-radius: 50%;
          background: rgba(200, 137, 31, 0.12);
          color: #c8891f;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: background var(--dur-fast), transform var(--dur-fast);
        }
        .wc-bar:hover .wc-bar-expand { background: #c8891f; color: #fff; transform: scale(1.08); }
      `}</style>

      {/* Modal de Onboarding — aberto pelo passo "Complete o Tutorial" */}
      <Onboarding isOpen={onboardingOpen} onClose={handleTutorialClose} />
    </>
  );
}

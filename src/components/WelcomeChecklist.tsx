// Build marker: 2026-09-04T10:00 — nasce expandido a cada novo login (sessionStorage)
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserCircle, Storefront, Package,
  ShoppingBag, ClipboardText,
  PlayCircle, CaretRight, CaretUp, CaretDown, Lock, Check, Crown,
} from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import Onboarding from "@/components/Onboarding";

interface Step {
  id: string;
  icon: React.ReactNode;
  title: string;
  path: string;
  done: boolean;
}

const LS_MINIMIZED = "doonly_welcome_minimized";

export default function WelcomeChecklist({ userId, onAllDone }: { userId: string; onAllDone?: (done: boolean) => void }) {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  // sessionStorage (não localStorage): a cada novo login/sessão o card nasce
  // expandido chamando atenção. Se o usuário colapsar, fica colapsado
  // enquanto navega pelo app na mesma sessão.
  const [minimized, setMinimized] = useState<boolean>(() => {
    try { return sessionStorage.getItem(LS_MINIMIZED) === "1"; } catch { return false; }
  });
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [tutorialDone, setTutorialDone] = useState(() => {
    try { return !!localStorage.getItem("doonly_tutorial_visto"); } catch { return false; }
  });

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
      try { sessionStorage.setItem(LS_MINIMIZED, novo ? "1" : "0"); } catch {}
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
      const iconSize = 18;

      setSteps([
        {
          id: "tutorial",
          icon: <PlayCircle size={iconSize} weight="duotone" />,
          title: "Fazer o tutorial",
          path: "__tutorial__",
          done: tutorialDone,
        },
        {
          id: "perfil",
          icon: <UserCircle size={iconSize} weight="duotone" />,
          title: "Preencher perfil",
          path: "/configuracoes",
          done: !!(p?.nome && p?.foto_url),
        },
        {
          id: "loja",
          icon: <Storefront size={iconSize} weight="duotone" />,
          title: "Configurar loja",
          path: "/cardapio-config",
          done: !!(p?.nome_loja),
        },
        {
          id: "insumos",
          icon: <Package size={iconSize} weight="duotone" />,
          title: "Cadastrar insumos",
          path: "/insumos",
          done: (insumosRes.count ?? 0) > 0,
        },
        {
          id: "produtos",
          icon: <ShoppingBag size={iconSize} weight="duotone" />,
          title: "Montar cardápio",
          path: "/produtos",
          done: (produtosRes.count ?? 0) > 0,
        },
        {
          id: "pedidos",
          icon: <ClipboardText size={iconSize} weight="duotone" />,
          title: "Criar primeiro pedido",
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

  // Copy motivacional dinâmica (acima do "7 dias grátis no PRO")
  const copyMotivadora = (() => {
    if (pct === 0) return `Complete as ${total} etapas e ganhe`;
    if (pct < 34) return `Bom começo! Continue e ganhe`;
    if (pct < 67) return `Você está na metade! Ganhe`;
    return `Falta${faltam > 1 ? "m" : ""} ${faltam < 1 ? "" : "pouco "}pra ganhar`;
  })();

  // Encontra a primeira missão pendente (a "atual")
  const currentStepIdx = steps.findIndex((s) => !s.done);

  const executarStep = (step: Step, idx: number) => {
    if (step.done) return;
    // Só a missão atual (primeira pendente) é executável — as próximas estão travadas
    if (idx !== currentStepIdx) return;
    if (step.path === "__tutorial__") setOnboardingOpen(true);
    else navigate(step.path);
  };

  return (
    <>
      {minimized ? (
        // ─── MODO COLAPSADO ───
        <button className="wc-collapsed" onClick={toggleMinimized} type="button" aria-label="Expandir configuração inicial">
          <span className="wc-collapsed-glow" aria-hidden="true" />
          <span className="wc-collapsed-crown">
            <Crown size={18} weight="fill" />
          </span>
          <span className="wc-collapsed-content">
            <span className="wc-collapsed-badge">
              <Crown size={10} weight="fill" />
              Recompensa
            </span>
            <span className="wc-collapsed-title">
              <span className="wc-collapsed-hl">7 dias</span> grátis no PRO
            </span>
            <span className="wc-collapsed-bar">
              <span className="wc-collapsed-bar-track">
                <span className="wc-collapsed-bar-fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="wc-collapsed-bar-txt">{doneCount}/{total} · {pct}%</span>
            </span>
          </span>
          <span className="wc-collapsed-expand" aria-hidden="true">
            <CaretDown size={14} weight="bold" />
          </span>
        </button>
      ) : (
        // ─── MODO EXPANDIDO ───
        <div className="wc-root">
          {/* Cabeçalho grafite com o prêmio */}
          <div className="wc-prize">
            <span className="wc-prize-glow" aria-hidden="true" />
            <span className="wc-prize-badge">
              <Crown size={11} weight="fill" />
              Recompensa
            </span>
            <p className="wc-prize-l1">{copyMotivadora}</p>
            <p className="wc-prize-l2">
              <span>7 dias</span> grátis no PRO
            </p>
            <div className="wc-prize-bar">
              <div className="wc-prize-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="wc-prize-progress">
              <span>{doneCount} de {total} etapas concluídas</span>
              <span>{pct}%</span>
            </div>
          </div>

          {/* Lista de etapas */}
          <ul className="wc-steps">
            {steps.map((step, idx) => {
              const isCurrent = idx === currentStepIdx;
              const isLocked = !step.done && !isCurrent;
              const stateClass = step.done ? "wc-step--done" : isCurrent ? "wc-step--current" : "wc-step--locked";
              return (
                <li key={step.id}>
                  <div
                    className={`wc-step ${stateClass}`}
                    onClick={() => executarStep(step, idx)}
                    role={isCurrent ? "button" : undefined}
                    tabIndex={isCurrent ? 0 : -1}
                    onKeyDown={(e) => { if (isCurrent && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); executarStep(step, idx); } }}
                  >
                    <span className="wc-step-icon">
                      {step.done ? <Check size={16} weight="bold" /> : isLocked ? <Lock size={14} weight="fill" /> : step.icon}
                    </span>
                    <span className="wc-step-title">{step.title}</span>
                    {isCurrent && (
                      <button className="wc-step-cta" type="button" onClick={(e) => { e.stopPropagation(); executarStep(step, idx); }}>
                        {pct === 0 ? "COMEÇAR" : "CONTINUAR"} <CaretRight size={12} weight="bold" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Rodapé — botão recolher */}
          <div className="wc-footer">
            <button className="wc-toggle" onClick={toggleMinimized} type="button">
              Ver menos <CaretUp size={13} weight="bold" />
            </button>
          </div>
        </div>
      )}

      <style>{`
        /* ══════════════════════════════════════════════
           EXPANDIDO
           ══════════════════════════════════════════════ */
        .wc-root {
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          overflow: hidden;
          border: 1px solid var(--border);
          box-shadow: 0 4px 20px rgba(45, 31, 38, 0.06);
        }

        /* ── Cabeçalho grafite com o prêmio ── */
        .wc-prize {
          background: linear-gradient(135deg, #2D1F26 0%, #4B3D46 100%);
          padding: 1rem 0.9rem;
          color: #fff;
          position: relative;
          overflow: hidden;
        }
        .wc-prize-glow {
          position: absolute;
          top: -30px; right: -30px;
          width: 120px; height: 120px;
          background: radial-gradient(circle, rgba(232, 90, 140, 0.28), transparent 70%);
          pointer-events: none;
        }
        .wc-prize-badge {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: var(--primary);
          padding: 3px 10px;
          border-radius: var(--radius-full);
          font-size: 10px;
          font-weight: var(--fw-black);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 8px;
          box-shadow: 0 2px 0 var(--primary-dark);
          color: #fff;
        }
        .wc-prize-l1 {
          position: relative;
          margin: 0;
          font-size: 12px;
          opacity: 0.75;
          font-weight: var(--fw-medium);
          line-height: 1.25;
        }
        .wc-prize-l2 {
          position: relative;
          margin: 2px 0 12px;
          font-size: 20px;
          font-weight: var(--fw-black);
          letter-spacing: -0.02em;
          line-height: 1.15;
        }
        .wc-prize-l2 span { color: #F27DA8; }
        .wc-prize-bar {
          position: relative;
          height: 10px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: var(--radius-full);
          overflow: hidden;
        }
        .wc-prize-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary), #F27DA8);
          border-radius: var(--radius-full);
          box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.2);
          transition: width 1s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .wc-prize-progress {
          position: relative;
          display: flex;
          justify-content: space-between;
          margin-top: 6px;
          font-size: 11px;
          opacity: 0.85;
          font-weight: var(--fw-bold);
        }

        /* ── Lista de etapas ── */
        .wc-steps {
          list-style: none;
          margin: 0;
          padding: 12px 8px 4px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .wc-step {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          transition: background var(--dur-fast), transform var(--dur-fast);
        }
        .wc-step--done { }
        .wc-step--locked { opacity: 0.5; }
        .wc-step--current {
          background: var(--primary-light);
          border: 2px solid var(--primary);
          padding: 8px 10px;
          box-shadow: 0 3px 0 rgba(232, 90, 140, 0.2);
          cursor: pointer;
        }
        .wc-step--current:hover { transform: translateY(-1px); }
        .wc-step--current:active { transform: translateY(1px); box-shadow: 0 1px 0 rgba(232, 90, 140, 0.2); }

        .wc-step-icon {
          width: 30px; height: 30px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .wc-step--done .wc-step-icon {
          background: var(--primary);
          color: #fff;
          box-shadow: 0 2px 0 var(--primary-dark);
        }
        .wc-step--current .wc-step-icon {
          background: #fff;
          color: var(--primary);
          border: 2px solid var(--primary);
        }
        .wc-step--locked .wc-step-icon {
          background: #E5DEE1;
          color: #9A8B93;
        }

        .wc-step-title {
          flex: 1;
          font-size: 13px;
          font-weight: var(--fw-bold);
          color: var(--text-title);
          line-height: 1.3;
        }
        .wc-step--done .wc-step-title {
          color: var(--text-muted);
          text-decoration: line-through;
          text-decoration-thickness: 1.5px;
          text-decoration-color: rgba(45, 31, 38, 0.2);
        }
        .wc-step--locked .wc-step-title { color: var(--text-muted); }

        .wc-step-cta {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          background: var(--primary);
          color: #fff;
          border: none;
          border-radius: var(--radius-sm);
          font-weight: var(--fw-black);
          font-size: 11px;
          letter-spacing: 0.03em;
          box-shadow: 0 2px 0 var(--primary-dark);
          cursor: pointer;
          text-transform: uppercase;
          transition: transform var(--dur-fast), box-shadow var(--dur-fast);
          flex-shrink: 0;
        }
        .wc-step-cta:hover { background: var(--btn-primary-hover); }
        .wc-step-cta:active { transform: translateY(2px); box-shadow: 0 0 0 var(--primary-dark); }

        /* ── Rodapé com botão recolher ── */
        .wc-footer {
          display: flex;
          justify-content: center;
          padding: 4px 14px 10px;
        }
        .wc-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          background: transparent;
          color: var(--text-muted);
          border: none;
          border-radius: var(--radius-full);
          font-size: 12px;
          font-weight: var(--fw-bold);
          cursor: pointer;
          transition: background var(--dur-fast), color var(--dur-fast);
        }
        .wc-toggle:hover { background: var(--primary-light); color: var(--primary); }

        /* ══════════════════════════════════════════════
           COLAPSADO
           ══════════════════════════════════════════════ */
        .wc-collapsed {
          width: 100%;
          background: linear-gradient(135deg, #2D1F26, #4B3D46);
          border-radius: var(--radius-md);
          padding: 12px 14px;
          color: #fff;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 3px 12px rgba(45, 31, 38, 0.15);
          transition: transform var(--dur-fast), box-shadow var(--dur-fast);
          position: relative;
          overflow: hidden;
          text-align: left;
          font-family: inherit;
        }
        .wc-collapsed:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(45, 31, 38, 0.25); }
        .wc-collapsed-glow {
          position: absolute;
          top: -20px; right: -20px;
          width: 90px; height: 90px;
          background: radial-gradient(circle, rgba(232, 90, 140, 0.35), transparent 70%);
          pointer-events: none;
        }
        .wc-collapsed-crown {
          position: relative;
          width: 34px; height: 34px;
          border-radius: var(--radius-sm);
          background: var(--primary);
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          box-shadow: 0 2px 0 var(--primary-dark);
          flex-shrink: 0;
        }
        .wc-collapsed-content {
          position: relative;
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .wc-collapsed-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: var(--primary);
          color: #fff;
          padding: 2px 8px;
          border-radius: var(--radius-full);
          font-size: 9px;
          font-weight: var(--fw-black);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          box-shadow: 0 1px 0 var(--primary-dark);
          align-self: flex-start;
          margin-bottom: 2px;
        }
        .wc-collapsed-title {
          font-size: 13px;
          font-weight: var(--fw-black);
          letter-spacing: -0.01em;
          line-height: 1.15;
        }
        .wc-collapsed-hl { color: #F27DA8; }
        .wc-collapsed-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 5px;
        }
        .wc-collapsed-bar-track {
          flex: 1;
          height: 5px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: var(--radius-full);
          overflow: hidden;
        }
        .wc-collapsed-bar-fill {
          display: block;
          height: 100%;
          background: linear-gradient(90deg, var(--primary), #F27DA8);
          border-radius: var(--radius-full);
          transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .wc-collapsed-bar-txt {
          font-size: 10px;
          font-weight: var(--fw-black);
          opacity: 0.9;
        }
        .wc-collapsed-expand {
          position: relative;
          width: 30px; height: 30px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.12);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          color: #fff;
        }
      `}</style>

      {/* Modal de Onboarding — aberto pelo passo "Fazer o tutorial" */}
      <Onboarding isOpen={onboardingOpen} onClose={handleTutorialClose} />
    </>
  );
}

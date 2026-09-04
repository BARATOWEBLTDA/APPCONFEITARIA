/**
 * TourInicio.tsx
 * ─────────────────────────────────────────────
 * Tour guiado com "spotlight" (destaca elemento por elemento) na tela Início.
 * Aparece automaticamente no primeiro login (1s após entrar em Início).
 * Persistência: localStorage "doonly_tour_inicio_visto".
 * ─────────────────────────────────────────────
 */

import { useEffect, useState, useCallback } from "react";
import { CaretRight, Check, X } from "@phosphor-icons/react";

interface Step {
  selector: string;
  title: string;
  desc: string;
  shape: "circle" | "rect";
  padding?: number;
  cardPosition?: "top" | "bottom" | "auto";
}

const STEPS: Step[] = [
  {
    selector: ".ini-profile-btn",
    title: "Sua foto de perfil",
    desc: "Toque no ícone da câmera pra adicionar ou trocar sua foto de perfil.",
    shape: "circle",
    padding: 6,
    cardPosition: "bottom",
  },
  {
    selector: ".ini-hero-bell",
    title: "Suas notificações",
    desc: "Toque no sino pra ver novidades, avisos e atualizações do app.",
    shape: "circle",
    padding: 6,
    cardPosition: "bottom",
  },
  {
    selector: ".ini-metrica-wrap",
    title: "Métrica em destaque",
    desc: "Este card mostra a métrica que você escolheu. Dá pra trocar em Gestão → Configurações → Início.",
    shape: "rect",
    padding: 8,
    cardPosition: "bottom",
  },
  {
    selector: '[data-tour="recompensa"]',
    title: "Recompensa",
    desc: "Complete as etapas de configuração e ganhe 7 dias grátis no plano PRO!",
    shape: "rect",
    padding: 8,
    cardPosition: "top",
  },
  {
    selector: ".bottom-nav",
    title: "Menu de navegação",
    desc: "Use o menu inferior pra navegar entre Início, Pedidos, Cardápio e Gestão.",
    shape: "rect",
    padding: 4,
    cardPosition: "top",
  },
];

const LS_KEY = "doonly_tour_inicio_visto";

interface Props {
  /** Força abrir mesmo se já foi visto (usado em Configurações "Ver tutorial") */
  forceOpen?: boolean;
  /** Chamado ao fechar */
  onClose?: () => void;
}

export default function TourInicio({ forceOpen = false, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Abre após 1s no primeiro login (ou quando forceOpen mudar pra true)
  useEffect(() => {
    if (forceOpen) {
      setCurrent(0);
      setVisible(true);
      return;
    }
    try {
      if (localStorage.getItem(LS_KEY) === "1") return;
    } catch {}
    const t = setTimeout(() => setVisible(true), 1000);
    return () => clearTimeout(t);
  }, [forceOpen]);

  // Calcula o rect do elemento alvo — SEM fazer scroll.
  // Usado no listener de resize/scroll pra manter a posição do card/spotlight atualizada.
  const recalcularRect = useCallback(() => {
    const step = STEPS[current];
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    setRect(el.getBoundingClientRect());
  }, [current]);

  // Quando o passo muda: rola até o elemento UMA vez, depois mede.
  useEffect(() => {
    if (!visible) return;
    const step = STEPS[current];
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    // Rola até o elemento ficar centralizado (só uma vez, no início do passo)
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    // Espera scroll terminar antes de medir e travar
    const t = setTimeout(() => {
      setRect(el.getBoundingClientRect());
    }, 400);
    return () => clearTimeout(t);
  }, [visible, current]);

  // Trava scroll do body enquanto o tour está visível + recalcula em resize
  useEffect(() => {
    if (!visible) return;
    // Scroll lock robusto (igual usamos no dropdown de notificações)
    const scrollY = window.scrollY;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyPosition = document.body.style.position;
    const prevBodyTop = document.body.style.top;
    const prevBodyWidth = document.body.style.width;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.documentElement.style.overflow = "hidden";

    const handleResize = () => recalcularRect();
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.position = prevBodyPosition;
      document.body.style.top = prevBodyTop;
      document.body.style.width = prevBodyWidth;
      document.documentElement.style.overflow = prevHtmlOverflow;
      window.scrollTo(0, scrollY);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [visible, recalcularRect]);

  const fechar = () => {
    try { localStorage.setItem(LS_KEY, "1"); } catch {}
    setVisible(false);
    onClose?.();
  };

  const proximo = () => {
    if (current < STEPS.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      fechar();
    }
  };

  if (!visible) return null;

  const step = STEPS[current];
  const isLast = current === STEPS.length - 1;
  const isFirst = current === 0;
  const padding = step.padding ?? 6;

  // Posição do spotlight (com padding)
  const spotStyle = rect
    ? {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        borderRadius: step.shape === "circle" ? "50%" : "16px",
      }
    : { display: "none" };

  // Posição do card (acima ou abaixo do elemento)
  const cardStyle: React.CSSProperties = { visibility: rect ? "visible" : "hidden" };
  if (rect) {
    const GAP = 16;
    const CARD_W = 300;
    // Vertical
    if (step.cardPosition === "top") {
      cardStyle.bottom = window.innerHeight - rect.top + GAP;
    } else {
      cardStyle.top = rect.bottom + GAP;
    }
    // Horizontal — centraliza mas evita cortar nas bordas
    const centerX = rect.left + rect.width / 2;
    let left = centerX - CARD_W / 2;
    if (left < 12) left = 12;
    if (left + CARD_W > window.innerWidth - 12) left = window.innerWidth - CARD_W - 12;
    cardStyle.left = left;
    cardStyle.width = Math.min(CARD_W, window.innerWidth - 24);
  }

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-label="Tour de boas-vindas">
      {/* Overlay escuro + spotlight (recorta a área do elemento em destaque) */}
      <div className="tour-overlay" onClick={proximo} />
      <div className="tour-spotlight" style={spotStyle} />

      {/* Card explicativo */}
      <div className="tour-card" style={cardStyle}>
        <button className="tour-close" onClick={fechar} aria-label="Fechar tour" type="button">
          <X size={14} weight="bold" />
        </button>
        <span className="tour-step-count">Passo {current + 1} de {STEPS.length}</span>
        <p className="tour-title">{step.title}</p>
        <p className="tour-desc">{step.desc}</p>

        <div className="tour-actions">
          <div className="tour-dots" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span key={i} className={`tour-dot ${i === current ? "tour-dot--active" : ""}`} />
            ))}
          </div>
          <div className="tour-btns">
            {!isFirst && (
              <button className="tour-btn-skip" onClick={fechar} type="button">Pular</button>
            )}
            <button className="tour-btn-primary" onClick={proximo} type="button">
              {isLast ? (<>Concluir <Check size={12} weight="bold" /></>) : (<>Próximo <CaretRight size={12} weight="bold" /></>)}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .tour-root {
          position: fixed; inset: 0;
          z-index: 100000;
          font-family: var(--font-base);
          pointer-events: none;
        }
        .tour-overlay {
          position: fixed; inset: 0;
          background: transparent;
          pointer-events: auto;
          touch-action: none;
        }
        .tour-spotlight {
          position: fixed;
          border: 3px solid #fff;
          background: transparent;
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.72);
          pointer-events: none;
          transition: top 0.35s cubic-bezier(0.22, 1, 0.36, 1),
                      left 0.35s cubic-bezier(0.22, 1, 0.36, 1),
                      width 0.35s cubic-bezier(0.22, 1, 0.36, 1),
                      height 0.35s cubic-bezier(0.22, 1, 0.36, 1),
                      border-radius 0.35s cubic-bezier(0.22, 1, 0.36, 1);
          animation: tourPulse 2.2s ease-in-out infinite;
        }
        @keyframes tourPulse {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.72), 0 0 0 0 rgba(255, 255, 255, 0.5); }
          50%      { box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.72), 0 0 0 14px rgba(255, 255, 255, 0); }
        }
        .tour-card {
          position: fixed;
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          padding: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          pointer-events: auto;
          animation: tourCardIn 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes tourCardIn {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .tour-close {
          position: absolute;
          top: 10px; right: 10px;
          width: 26px; height: 26px;
          border-radius: 50%;
          background: var(--bg-subtle);
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background var(--dur-fast), color var(--dur-fast);
        }
        .tour-close:hover { background: var(--primary-light); color: var(--primary); }
        .tour-step-count {
          display: inline-block;
          font-size: 10px;
          color: var(--primary);
          font-weight: var(--fw-black);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .tour-title {
          margin: 4px 0 4px;
          font-size: 15px;
          font-weight: var(--fw-black);
          color: var(--text-title);
          letter-spacing: -0.01em;
        }
        .tour-desc {
          margin: 0;
          font-size: 12.5px;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .tour-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 14px;
          gap: 10px;
        }
        .tour-dots { display: flex; gap: 4px; align-items: center; }
        .tour-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--border);
          transition: background 0.2s, width 0.2s;
        }
        .tour-dot--active { background: var(--primary); width: 16px; border-radius: var(--radius-full); }
        .tour-btns { display: flex; align-items: center; gap: 6px; }
        .tour-btn-skip {
          background: none; border: none;
          font-family: inherit;
          font-size: 11px;
          color: var(--text-muted);
          font-weight: var(--fw-semibold);
          cursor: pointer;
          padding: 6px 8px;
          border-radius: var(--radius-full);
        }
        .tour-btn-skip:hover { color: var(--text-secondary); background: var(--bg-subtle); }
        .tour-btn-primary {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 9px 14px;
          background: var(--primary);
          color: #fff;
          border: none;
          border-radius: var(--radius-full);
          font-family: inherit;
          font-size: 11px;
          font-weight: var(--fw-black);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          cursor: pointer;
          box-shadow: 0 3px 0 var(--primary-dark);
          transition: transform var(--dur-fast), background var(--dur-fast);
        }
        .tour-btn-primary:hover { background: var(--btn-primary-hover); }
        .tour-btn-primary:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--primary-dark); }
      `}</style>
    </div>
  );
}

/** Reseta o tour para que seja mostrado novamente */
export function resetTourInicio() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

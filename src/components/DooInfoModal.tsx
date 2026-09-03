import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

interface DooInfoModalProps {
  open: boolean;
  onClose: () => void;
  /** Caminho da imagem do mascote/sticker (ex: "/Sistema/precifique.png") */
  image: string;
  imageAlt?: string;
  /**
   * Título principal — geralmente personalizado com o nome da confeiteira.
   * Aceita JSX para destacar tokens com <strong> (nome, produto, etc.)
   */
  title: ReactNode;
  /**
   * Rótulo acessível para leitores de tela. Use quando `title` for JSX
   * (para evitar que o aria-label vire "[object Object]"). Padrão: "Informação".
   */
  ariaLabel?: string;
  /** Corpo explicativo. Pode ser texto simples ou JSX (para destacar valores, etc.) */
  children: ReactNode;
  /** Rótulo do botão primário. Padrão: "Entendi" */
  ctaLabel?: string;
  /** Ação opcional ao clicar no CTA. Padrão: apenas fecha o modal */
  onCta?: () => void;
}

/**
 * Modal de informação no padrão visual do Doo (mascote).
 *
 * Usado para explicar conceitos do sistema de forma acolhedora — ex:
 * "Como calculamos o custo na receita", "O que é margem", etc.
 *
 * Reaproveita o mesmo padrão visual do modal "Ainda não temos produtos!"
 * (Pedidos.tsx), mas com variante informativa: imagem + título + corpo +
 * botão único de confirmação.
 */
export default function DooInfoModal({
  open,
  onClose,
  image,
  imageAlt = "",
  title,
  ariaLabel = "Informação",
  children,
  ctaLabel = "Entendi",
  onCta,
}: DooInfoModalProps) {
  // Fecha com ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Trava scroll do body enquanto aberto.
  // iOS Safari não respeita só `overflow: hidden` no body — toques ainda
  // disparam scroll por trás do modal. O padrão robusto é colocar o body em
  // `position: fixed` com `top: -scrollY`, preservando a posição visual.
  // Ao fechar, restauramos tudo e devolvemos o scroll com `scrollTo`.
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      document.body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  if (!open) return null;

  const handleCta = () => {
    if (onCta) onCta();
    else onClose();
  };

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 9998,
          animation: "dooInfoFadeIn 0.2s ease",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(380px, calc(100vw - 2rem))",
          maxHeight: "calc(100vh - 2rem)",
          overflowY: "auto",
          background: "white",
          borderRadius: 20,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          zIndex: 9999,
          padding: "1.75rem 1.5rem 1.5rem",
          fontFamily: "inherit",
          textAlign: "center",
          animation: "dooInfoFadeIn 0.25s ease",
        }}
      >
        {/* Botão fechar */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Mascote */}
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: "28%",
            background: "var(--text-title)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1rem",
            boxShadow: "0 8px 24px rgba(61,26,36,0.25)",
          }}
        >
          <div
            style={{
              width: 74,
              height: 74,
              borderRadius: "28%",
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <img
              src={image}
              alt={imageAlt}
              style={{
                width: 96,
                height: 96,
                objectFit: "cover",
                objectPosition: "top center",
              }}
            />
          </div>
        </div>

        {/* Título */}
        <h3
          style={{
            fontSize: "1.15rem",
            fontWeight: 600,
            color: "var(--text-title)",
            margin: "0 0 20px",
            letterSpacing: "-0.01em",
            lineHeight: 1.4,
            // Balanceia as quebras de linha entre todas as linhas em vez de
            // deixar uma "órfã" no final (Chrome 114+, Safari 17.5+, Firefox 121+).
            // Cai pra wrap normal em browsers antigos sem regressão.
            textWrap: "balance",
          }}
        >
          {title}
        </h3>

        {/* Corpo */}
        <div
          style={{
            fontSize: "0.9rem",
            color: "var(--text-secondary)",
            margin: "0 0 1.5rem",
            lineHeight: 1.55,
            textAlign: "left",
            // Evita palavras órfãs (1-2 palavras sozinhas no fim do parágrafo).
            // `pretty` é otimizado pra texto corrido — diferente de `balance`
            // que serve melhor pra títulos. Herda pra todos os <p> filhos.
            // Chrome 117+, Safari 17.5+, Firefox 138+.
            textWrap: "pretty",
          }}
        >
          {children}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={handleCta}
          style={{
            width: "100%",
            background: "var(--text-title)",
            color: "white",
            border: "none",
            borderRadius: 12,
            padding: "0.85rem",
            fontSize: "0.95rem",
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 4px 12px rgba(61,26,36,0.25)",
          }}
        >
          {ctaLabel}
        </button>
      </div>

      <style>{`
        @keyframes dooInfoFadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </>,
    document.body
  );
}

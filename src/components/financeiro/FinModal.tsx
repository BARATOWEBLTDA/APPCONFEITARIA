import { useEffect, useRef, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";

interface FinModalProps {
  /** Título exibido no header do modal */
  title: ReactNode;
  /** Callback de fechamento (clique fora, X ou ESC) */
  onClose: () => void;
  /** Conteúdo principal do modal */
  children: ReactNode;
  /** Footer (geralmente botões Cancelar / Salvar via <FinModalFooter />) */
  footer?: ReactNode;
  /** Largura máxima (default 480px) */
  maxWidth?: number;
}

/**
 * Modal padrão do módulo Financeiro.
 *
 * Resolve os problemas do antigo `.cu-modal-overlay`:
 *  - sempre centralizado vertical e horizontalmente (inclusive mobile)
 *  - body com scroll bloqueado enquanto aberto
 *  - fecha com ESC
 *  - fecha clicando fora (no backdrop)
 *  - animação fade-in + scale leve
 *  - aria-modal e role="dialog" pra acessibilidade
 *
 * @example
 * <FinModal title="Novo custo fixo" onClose={close} footer={<FinModalFooter ... />}>
 *   <FinField label="Nome"><input ... /></FinField>
 * </FinModal>
 */
export default function FinModal({
  title,
  onClose,
  children,
  footer,
  maxWidth = 480,
}: FinModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Scroll-lock + ESC
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);

    // Foca o primeiro input do modal pra usabilidade
    const t = window.setTimeout(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(
        "input:not([type=hidden]), textarea, select, button"
      );
      first?.focus();
    }, 40);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [onClose]);

  return (
    <div
      className="fin-modal-overlay"
      onMouseDown={(e) => {
        // só fecha se o clique foi no overlay e não no conteúdo
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="fin-modal"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        style={{ maxWidth }}
      >
        <header className="fin-modal-header">
          <h2 className="fin-modal-title">{title}</h2>
          <button
            type="button"
            className="fin-modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={18} weight="bold" />
          </button>
        </header>

        <div className="fin-modal-body">{children}</div>

        {footer && <footer className="fin-modal-footer">{footer}</footer>}
      </div>

      <style>{`
        @keyframes fin-modal-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes fin-modal-pop {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .fin-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: var(--bg-overlay);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-4);
          animation: fin-modal-fade var(--dur-fast) var(--ease-out);
        }
        .fin-modal {
          width: 100%;
          background: var(--bg-card);
          border-radius: var(--radius-xl);
          padding: var(--pad-modal);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          max-height: calc(100vh - var(--space-4) * 2);
          overflow-y: auto;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.22);
          animation: fin-modal-pop 0.18s var(--ease-out);
        }
        .fin-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-2);
        }
        .fin-modal-title {
          font-size: var(--font-modal-title);
          font-weight: var(--fw-bold);
          color: var(--text-title);
          margin: 0;
          letter-spacing: var(--ls-tight);
        }
        .fin-modal-close {
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-subtle);
          border: none;
          border-radius: var(--radius-full);
          color: var(--text-secondary);
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease-out);
        }
        .fin-modal-close:hover {
          background: var(--border);
          color: var(--text-title);
        }
        .fin-modal-close:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }
        .fin-modal-body {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .fin-modal-footer {
          display: flex;
          gap: var(--space-2);
          margin-top: var(--space-1);
        }
        .fin-modal-footer > * {
          flex: 1;
        }
      `}</style>
    </div>
  );
}

/* ──────────────────────────────────────────
   Footer padronizado (Cancelar + Confirmar)
   ────────────────────────────────────────── */

interface FinModalFooterProps {
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  /** "primary" (padrão) ou "danger" (excluir) */
  confirmVariant?: "primary" | "danger";
  /** Desabilita o botão de confirmar */
  disabled?: boolean;
}

export function FinModalFooter({
  onCancel,
  onConfirm,
  cancelLabel = "Cancelar",
  confirmLabel = "Salvar",
  confirmVariant = "primary",
  disabled = false,
}: FinModalFooterProps) {
  return (
    <>
      <button type="button" className="fin-btn fin-btn--secondary" onClick={onCancel}>
        {cancelLabel}
      </button>
      <button
        type="button"
        className={`fin-btn ${confirmVariant === "danger" ? "fin-btn--danger" : "fin-btn--primary"}`}
        onClick={onConfirm}
        disabled={disabled}
      >
        {confirmLabel}
      </button>

      <style>{`
        .fin-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-1);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-full);
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: var(--fw-bold);
          cursor: pointer;
          border: 1px solid transparent;
          transition: background var(--dur-fast) var(--ease-out),
                      transform var(--dur-fast) var(--ease-out),
                      opacity var(--dur-fast) var(--ease-out);
        }
        .fin-btn:active:not(:disabled) { transform: scale(0.985); }
        .fin-btn:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }
        .fin-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .fin-btn--primary {
          background: var(--text-title);
          color: #fff;
        }
        .fin-btn--primary:hover:not(:disabled) { background: var(--primary-dark); }
        .fin-btn--secondary {
          background: var(--btn-secondary-bg);
          color: var(--btn-secondary-text);
          border-color: var(--btn-secondary-border);
        }
        .fin-btn--secondary:hover:not(:disabled) { background: var(--btn-secondary-hover); }
        .fin-btn--danger {
          background: var(--error);
          color: #fff;
        }
        .fin-btn--danger:hover:not(:disabled) { opacity: 0.92; }
      `}</style>
    </>
  );
}

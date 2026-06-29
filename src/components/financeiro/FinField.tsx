import type { ReactNode } from "react";

interface FinFieldProps {
  /** Label do campo, mostrado acima do input */
  label: ReactNode;
  /** Texto de ajuda abaixo do campo (cinza claro) */
  hint?: ReactNode;
  /** Mensagem de erro — quando presente, vermelha e substitui o hint */
  error?: ReactNode;
  /** O input em si (ou qualquer outro controle) */
  children: ReactNode;
  /** htmlFor opcional pra acessibilidade */
  htmlFor?: string;
}

/**
 * Wrapper de campo de formulário do Financeiro.
 * Padroniza espaçamento e estilo de label, hint e erro.
 *
 * @example
 * <FinField label="Nome" hint="Use até 40 caracteres">
 *   <input className="fin-input" ... />
 * </FinField>
 */
export default function FinField({
  label,
  hint,
  error,
  children,
  htmlFor,
}: FinFieldProps) {
  return (
    <div className="fin-field">
      <label className="fin-field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <span className="fin-field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="fin-field-hint">{hint}</span>
      ) : null}

      <style>{`
        .fin-field {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }
        .fin-field-label {
          font-size: var(--font-field-label);
          font-weight: var(--fw-semibold);
          color: var(--text-secondary);
        }
        .fin-field-hint {
          font-size: var(--font-caption);
          color: var(--text-muted);
        }
        .fin-field-error {
          font-size: var(--font-caption);
          color: var(--error);
          font-weight: var(--fw-semibold);
        }
        /* Input padrão reutilizável */
        :global(.fin-input) {
          padding: var(--pad-input);
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: var(--font-input);
          color: var(--text-primary);
          transition: border-color var(--dur-fast) var(--ease-out),
                      box-shadow var(--dur-fast) var(--ease-out);
          width: 100%;
        }
        :global(.fin-input:focus) {
          outline: none;
          border-color: var(--border-focus);
          box-shadow: var(--focus-ring);
        }
        :global(.fin-input::placeholder) {
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}

/* ──────────────────────────────────────────
   Input padrão (re-exportado como utilitário)
   ────────────────────────────────────────── */

/**
 * Style class para inputs do Financeiro.
 * Use diretamente: <input className="fin-input" ... />
 * Os estilos vêm do <FinField> via :global() ou da folha global.
 */
export const FIN_INPUT_CLASS = "fin-input";

/**
 * Folha global pra inputs `.fin-input` aparecerem com o estilo padrão
 * em qualquer lugar do app, mesmo fora de <FinField>.
 * Inclua uma única vez (já é incluída via index.ts).
 */
export function FinInputGlobalStyles() {
  return (
    <style>{`
      .fin-input {
        padding: var(--pad-input);
        background: var(--bg-input);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        font-family: inherit;
        font-size: var(--font-input);
        color: var(--text-primary);
        width: 100%;
        transition: border-color var(--dur-fast) var(--ease-out),
                    box-shadow var(--dur-fast) var(--ease-out);
      }
      .fin-input:focus {
        outline: none;
        border-color: var(--border-focus);
        box-shadow: var(--focus-ring);
      }
      .fin-input::placeholder { color: var(--text-muted); }
      .fin-input:disabled {
        background: var(--bg-subtle);
        color: var(--text-muted);
        cursor: not-allowed;
      }
    `}</style>
  );
}

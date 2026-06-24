import type { ReactNode, ButtonHTMLAttributes } from "react";

interface BtnNovoProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Texto do botão, ex: "Novo produto" */
  label: string;
  /** Ícone à esquerda do label (default: +) */
  icon?: ReactNode;
  /**
   * Se true (default), no mobile esconde o texto e mostra só o ícone (botão compacto).
   * Use false para botões que precisam sempre mostrar o label (ex: dentro de empty state).
   */
  responsive?: boolean;
}

const PlusIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

/**
 * Botão CTA primário padrão Doonly — fundo escuro #3d1a24, usado para ações de
 * criação em listas (Novo produto, Nova categoria, Novo ingrediente, etc).
 *
 * @example
 * <BtnNovo label="Novo produto" onClick={openNovo} />
 *
 * @example // Não-responsivo (sempre mostra label)
 * <BtnNovo label="Cadastrar primeiro produto" onClick={openNovo} responsive={false} />
 */
export default function BtnNovo({
  label,
  icon,
  responsive = true,
  className = "",
  type = "button",
  ...rest
}: BtnNovoProps) {
  const classes = `btn-novo-doonly${responsive ? " btn-novo-doonly--responsive" : ""} ${className}`.trim();

  return (
    <button type={type} className={classes} aria-label={label} {...rest}>
      {icon ?? PlusIcon}
      <span className="btn-novo-doonly-label">{label}</span>

      <style>{`
        .btn-novo-doonly {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: #3d1a24;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 0.65rem 1rem;
          font-family: inherit;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(61, 26, 36, 0.18);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .btn-novo-doonly:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(61, 26, 36, 0.25);
        }
        .btn-novo-doonly:active:not(:disabled) {
          transform: translateY(0);
        }
        .btn-novo-doonly:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .btn-novo-doonly:focus-visible {
          outline: 2px solid var(--primary, #FF6FA9);
          outline-offset: 2px;
        }
        .btn-novo-doonly-label {
          display: inline;
        }
        @media (max-width: 600px) {
          .btn-novo-doonly--responsive {
            padding: 0.6rem 0.8rem;
            box-shadow: 0 3px 10px rgba(61, 26, 36, 0.2);
          }
          .btn-novo-doonly--responsive .btn-novo-doonly-label {
            display: none;
          }
        }
      `}</style>
    </button>
  );
}

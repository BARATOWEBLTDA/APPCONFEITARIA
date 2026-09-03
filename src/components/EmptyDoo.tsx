import type { ReactNode } from "react";

interface EmptyDooProps {
  /** Nome do arquivo em /public/Sistema/ — ex: "produtos.png" */
  image?: string;
  /** Texto alternativo da imagem (acessibilidade) */
  imageAlt?: string;
  /** Título principal, ex: "Vamos cadastrar seu primeiro produto?" */
  title: ReactNode;
  /** Texto de apoio, abaixo do título */
  description: ReactNode;
  /** Texto do botão CTA */
  actionLabel: string;
  /** Callback do botão CTA */
  onAction: () => void;
  /** Ícone opcional dentro do botão (default: +) */
  actionIcon?: ReactNode;
  /** Classe extra opcional pro wrapper */
  className?: string;
}

const PlusIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

/**
 * Empty state padrão Doonly — avatar escuro com mascote personalizado,
 * título, descrição e CTA. Usado quando uma listagem ainda não tem itens.
 *
 * @example
 * <EmptyDoo
 *   image="produtos.png"
 *   title="Vamos cadastrar seu primeiro produto?"
 *   description="Quanto mais completo seu catálogo, mais profissional sua confeitaria fica."
 *   actionLabel="Cadastrar primeiro produto"
 *   onAction={openNovo}
 * />
 */
export default function EmptyDoo({
  image = "doo.png",
  imageAlt = "Doo",
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  className = "",
}: EmptyDooProps) {
  return (
    <div className={`empty-doo-card ${className}`}>
      <div className="empty-doo-avatar">
        <div className="empty-doo-avatar-inner">
          <img src={`/Sistema/${image}`} alt={imageAlt} />
        </div>
      </div>
      <p className="empty-doo-title">{title}</p>
      <p className="empty-doo-desc">{description}</p>
      <button type="button" onClick={onAction} className="empty-doo-btn">
        {actionIcon ?? PlusIcon}
        {actionLabel}
      </button>

      <style>{`
        .empty-doo-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2.5rem 1.5rem;
          background: var(--bg-card);
          border: 1.5px dashed var(--border);
          border-radius: var(--radius-lg);
          margin-top: 0.5rem;
          font-family: 'Geist', sans-serif;
        }
        .empty-doo-avatar {
          width: 96px;
          height: 96px;
          border-radius: 28%;
          background: var(--text-title);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.25rem;
          box-shadow: 0 8px 26px rgba(61, 26, 36, 0.26);
        }
        .empty-doo-avatar-inner {
          width: 82px;
          height: 82px;
          border-radius: 28%;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .empty-doo-avatar-inner img {
          width: 104px;
          height: 104px;
          object-fit: cover;
          object-position: top center;
        }
        .empty-doo-title {
          font-size: var(--font-modal-title);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0 0 8px;
          letter-spacing: -0.02em;
          max-width: 320px;
          line-height: 1.3;
        }
        .empty-doo-desc {
          font-size: var(--font-button);
          color: var(--text-secondary);
          margin: 0 0 1.5rem;
          line-height: 1.5;
          max-width: 360px;
          text-wrap: balance;
        }
        .empty-doo-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--text-title);
          color: #fff;
          border: none;
          border-radius: var(--radius-md);
          padding: 0.8rem 1.5rem;
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: var(--fw-bold);
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(61, 26, 36, 0.25);
          transition: all var(--dur-fast) var(--ease-out);
        }
        .empty-doo-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(61, 26, 36, 0.3);
        }
        .empty-doo-btn:active {
          transform: translateY(0);
        }
        .empty-doo-btn:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}

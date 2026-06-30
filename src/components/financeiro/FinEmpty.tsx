import type { ReactNode } from "react";

interface FinEmptyProps {
  /** Ícone temático Phosphor (ex.: <Buildings />). Usado quando não há mascote dedicado ainda. */
  icon?: ReactNode;
  /** Caminho da imagem do mascote Doonly (ex.: "/Sistema/doo.png"). Quando presente, substitui o icon. */
  image?: string;
  /** Título do empty state */
  title: ReactNode;
  /** Descrição abaixo do título */
  description: ReactNode;
  /** Texto do CTA */
  actionLabel: string;
  /** Callback do CTA */
  onAction: () => void;
}

/**
 * Empty state padronizado do Financeiro / Doonly.
 *
 * Aceita um ícone Phosphor OU uma imagem do mascote Doo (`image`). Quando
 * o Doonly tiver mascotes específicos por contexto (calculadora, sacola,
 * balança...), é só passar `image="/Sistema/<nome>.png"`.
 *
 * @example Ícone Phosphor (default, sem mascote dedicado)
 * <FinEmpty
 *   icon={<Buildings size={36} weight="duotone" />}
 *   title="Você ainda não cadastrou nenhum custo fixo"
 *   description="Cadastre aluguel, energia, internet..."
 *   actionLabel="Cadastrar primeiro custo"
 *   onAction={openModal}
 * />
 *
 * @example Avatar do Doo
 * <FinEmpty
 *   image="/Sistema/doo.png"
 *   title="Quer ver seu lucro de verdade?"
 *   description="Preencha a ficha técnica..."
 *   actionLabel="Preencher custos"
 *   onAction={() => navigate("/produtos")}
 * />
 */
export default function FinEmpty({
  icon,
  image,
  title,
  description,
  actionLabel,
  onAction,
}: FinEmptyProps) {
  return (
    <div className="fin-empty">
      <div className="fin-empty-avatar" aria-hidden="true">
        {image ? (
          <div className="fin-empty-avatar-img-wrap">
            <img src={image} alt="" className="fin-empty-avatar-img" />
          </div>
        ) : (
          <div className="fin-empty-avatar-inner">{icon}</div>
        )}
      </div>
      <p className="fin-empty-title">{title}</p>
      <p className="fin-empty-desc">{description}</p>
      <button type="button" className="fin-empty-btn" onClick={onAction}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {actionLabel}
      </button>

      <style>{`
        .fin-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2.25rem 1.5rem;
          background: var(--bg-card);
          border: 1.5px dashed var(--border);
          border-radius: var(--radius-lg);
        }
        .fin-empty-avatar {
          width: 88px;
          height: 88px;
          border-radius: 28%;
          background: #3d1a24;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.1rem;
          box-shadow: 0 8px 24px rgba(61, 26, 36, 0.24);
        }
        .fin-empty-avatar-inner {
          width: 72px;
          height: 72px;
          border-radius: 26%;
          background: var(--primary-light);
          color: #3d1a24;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .fin-empty-avatar-img-wrap {
          width: 72px;
          height: 72px;
          border-radius: 26%;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .fin-empty-avatar-img {
          width: 92px;
          height: 92px;
          object-fit: cover;
          object-position: top center;
        }
        .fin-empty-title {
          font-size: var(--font-modal-title);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0 0 8px;
          letter-spacing: -0.02em;
          max-width: 320px;
          line-height: 1.3;
        }
        .fin-empty-desc {
          font-size: var(--font-button);
          color: var(--text-secondary);
          margin: 0 0 1.4rem;
          line-height: 1.5;
          max-width: 360px;
          text-wrap: balance;
        }
        .fin-empty-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: #3d1a24;
          color: #fff;
          border: none;
          border-radius: var(--radius-md);
          padding: 0.75rem 1.4rem;
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: var(--fw-bold);
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(61, 26, 36, 0.25);
          transition: transform var(--dur-fast) var(--ease-out),
                      box-shadow 0.15s ease;
        }
        .fin-empty-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(61, 26, 36, 0.3);
        }
        .fin-empty-btn:active { transform: translateY(0); }
        .fin-empty-btn:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}

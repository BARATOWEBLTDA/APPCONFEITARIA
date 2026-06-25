/**
 * TrialCard — UI de monetização / billing
 *
 * ⚠️ As cores deste componente são intencionais e NÃO pertencem ao design system (themes.css).
 * São cores de marketing/conversão com propósito específico de chamar atenção.
 * Não mover para tokens globais.
 */

import { useNavigate } from "react-router-dom";

// ── Variantes ──────────────────────────────────────────────────────────────────

/**
 * MobileExpiring — card mobile para usuário PRO em teste prestes a expirar
 */
interface MobileExpiringProps {
  diasRestantes: number;
  loading?: boolean;
}

export function TrialCardMobileExpiring({ diasRestantes, loading }: MobileExpiringProps) {
  const navigate = useNavigate();
  if (loading) return null;

  return (
    <div className="tc-pro-mini-card">
      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", width: "100%" }}>
        <img src="/assine.png" alt="" style={{ width: "38px", height: "38px", objectFit: "contain", flexShrink: 0, borderRadius: "10px" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="tc-pro-mini-title">
            Seu acesso PRO expira em {diasRestantes} dia{diasRestantes !== 1 ? "s" : ""}.
          </p>
          <p className="tc-pro-mini-sub">
            Continue com todas as funcionalidades sem interrupção por apenas{" "}
            <strong style={{ color: "white" }}>R$ 19,90/mês</strong>.
          </p>
        </div>
      </div>
      <button className="tc-assinar-btn" style={{ marginTop: "0.65rem", width: "100%" }} onClick={() => navigate("/assinar")}>
        Assinar agora →
      </button>

      <style>{`
        .tc-pro-mini-card {
          background: linear-gradient(135deg, #1a0a12, #2d0f1e);
          border-radius: var(--radius-lg);
          padding: 1rem;
          border: 1px solid rgba(255,111,169,0.2);
          display: flex;
          flex-direction: column;
        }
        .tc-pro-mini-title {
          font-size: var(--font-helper);
          font-weight: var(--fw-bold);
          color: white;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tc-pro-mini-sub {
          font-size: var(--font-caption);
          color: rgba(255,255,255,0.65);
          margin: 0.2rem 0 0;
          line-height: 1.4;
        }
        .tc-assinar-btn {
          padding: 0.65rem;
          background: linear-gradient(135deg, #f9c74f, #f8961e);
          color: #1a1a2e;
          border: none;
          border-radius: var(--radius-md);
          font-family: 'Geist', sans-serif;
          font-size: var(--font-button);
          font-weight: var(--fw-black);
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(248,150,30,0.3);
          transition: opacity var(--dur-normal);
        }
        .tc-assinar-btn:hover { opacity: 0.92; }
        .tc-assinar-btn:active { transform: scale(0.97); }
      `}</style>
    </div>
  );
}

/**
 * MobileBanner — banner mobile de upgrade para usuários não-PRO
 */
export function TrialCardMobileBanner() {
  const navigate = useNavigate();

  return (
    <div className="tc-mob-trial" onClick={() => navigate("/assinar")}>
      <div className="tc-mob-trial-left">
        <div className="tc-mob-trial-icon">
          <img src="/assine.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        <div>
          <p className="tc-mob-trial-title">ASSINE O DOONLY PREMIUM</p>
          <p className="tc-mob-trial-sub">Apenas R$ 19,90/mês após o teste</p>
        </div>
      </div>
      <div className="tc-mob-trial-badge">Recomendado</div>

      <style>{`
        .tc-mob-trial {
          background: linear-gradient(135deg, #1a1a2e, #16213e);
          border-radius: var(--radius-lg);
          padding: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }
        .tc-mob-trial-left { display: flex; align-items: center; gap: 0.75rem; }
        .tc-mob-trial-icon {
          width: 44px; height: 44px;
          background: var(--bg-card);
          border-radius: var(--radius-md); padding: 4px;
          flex-shrink: 0; overflow: hidden;
        }
        .tc-mob-trial-title { font-size: var(--font-helper); font-weight: var(--fw-black); color: white; margin: 0 0 0.15rem; }
        .tc-mob-trial-sub { font-size: var(--font-caption); color: rgba(255,255,255,0.65); margin: 0; }
        .tc-mob-trial-badge {
          position: absolute; top: 0; right: 0;
          background: var(--primary);
          color: white; font-size: var(--font-caption); font-weight: var(--fw-bold);
          padding: 0.2rem 0.6rem;
          border-radius: 0 14px 0 8px;
        }
      `}</style>
    </div>
  );
}

/**
 * DesktopReward — card desktop "Configuração completa! Resgatar PRO"
 */
interface DesktopRewardProps {
  resgatando: boolean;
  onResgatar: () => void;
}

export function TrialCardDesktopReward({ resgatando, onResgatar }: DesktopRewardProps) {
  return (
    <div className="tc-reward-card">
      <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
        <img src="/assine.png" alt="" style={{ width: "64px", height: "64px", objectFit: "contain", marginBottom: "0.5rem" }} />
        <h3 style={{ fontWeight: 800, color: "#15803d", margin: "0 0 0.25rem" }}>Configuração completa!</h3>
        <p style={{ fontSize: "0.85rem", color: "var(--success)", margin: "0 0 1rem" }}>
          Resgate agora 3 dias de acesso PRO como recompensa.
        </p>
        <button
          className="tc-resgatar-btn"
          style={{ width: "100%" }}
          onClick={onResgatar}
          disabled={resgatando}
        >
          {resgatando ? "Ativando..." : "✨ Ativar PRO por 3 dias"}
        </button>
      </div>

      <style>{`
        .tc-reward-card {
          background: linear-gradient(135deg, #f0fdf4, #dcfce7);
          border: 1px solid #bbf7d0;
          border-radius: var(--radius-card);
          padding: 1rem 1.25rem;
          margin-bottom: 1rem;
        }
        .tc-resgatar-btn {
          padding: 0.65rem;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-family: 'Geist', sans-serif;
          font-size: var(--font-button);
          font-weight: var(--fw-black);
          cursor: pointer;
          transition: opacity var(--dur-normal);
        }
        .tc-resgatar-btn:hover { opacity: 0.92; }
        .tc-resgatar-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

import { useNavigate } from "react-router-dom";

const beneficios = [
  "Clientes ilimitados",
  "Produtos ilimitados",
  "Cardápio digital profissional",
  "Relatórios avançados",
  "Backup automático",
  "Suporte prioritário",
  "Assistente IA Doonly",
  "Acesso a mais de 10.000 receitas",
];

export default function Assinar() {
  const navigate = useNavigate();

  return (
    <div className="ass-root">
      {/* Header */}
      <div className="ass-header">
        <button className="ass-back" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 className="ass-title">⏱️ Seu período de teste expira em <span>14 dias!</span></h1>
          <p className="ass-subtitle">Não perca o acesso! Assine agora e continue usando o Doonly sem interrupções.</p>
        </div>
      </div>

      {/* Plano */}
      <div className="ass-plan-card">
        <div className="ass-plan-badge">Plano Premium</div>
        <h2 className="ass-plan-name">Doonly Premium</h2>
        <div className="ass-plan-price">
          <span className="ass-price-value">R$ 19,90</span>
          <span className="ass-price-period">/ mês</span>
        </div>
        <p className="ass-plan-desc">Tudo que você precisa para gerenciar sua confeitaria com excelência.</p>

        <div className="ass-divider" />

        <div className="ass-benefits">
          {beneficios.map(b => (
            <div key={b} className="ass-benefit-item">
              <div className="ass-check">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span>{b}</span>
            </div>
          ))}
        </div>

        <button className="ass-btn" onClick={() => alert("Em breve! Entre em contato pelo WhatsApp: 41 9 9884-3669")}>
          Assinar agora
        </button>
      </div>

      {/* Info */}
      <div className="ass-info">
        <h3 className="ass-info-title">ℹ️ Informações importantes</h3>
        <ul className="ass-info-list">
          <li>Você pode cancelar a qualquer momento sem multa.</li>
          <li>O cancelamento entra em vigor no final do período pago.</li>
          <li>Seus dados ficam salvos mesmo após o cancelamento.</li>
          <li>Pagamentos processados de forma segura.</li>
        </ul>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        .ass-root { font-family: 'Inter', sans-serif; max-width: 520px; }

        .ass-header { margin-bottom: 1.5rem; }
        .ass-back {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: 10px;
          background: white; border: 1.5px solid #e5e7eb;
          cursor: pointer; color: #374151; margin-bottom: 1rem;
          transition: background 0.15s;
        }
        .ass-back:hover { background: #f9fafb; }
        .ass-title { font-size: 1.25rem; font-weight: 700; color: #1f2937; margin: 0 0 0.4rem; line-height: 1.3; }
        .ass-title span { color: #f9007a; }
        .ass-subtitle { font-size: 0.88rem; color: #6b7280; margin: 0; line-height: 1.5; }

        .ass-plan-card {
          background: linear-gradient(135deg, #1a1a2e, #16213e);
          border-radius: 20px; padding: 1.75rem;
          position: relative; overflow: hidden;
          margin-bottom: 1rem;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }
        .ass-plan-card::before {
          content: ''; position: absolute; top: -60px; right: -60px;
          width: 200px; height: 200px; border-radius: 50%;
          background: rgba(249,0,122,0.08);
        }

        .ass-plan-badge {
          display: inline-block; background: linear-gradient(135deg, #f9007a, #ff6eb4);
          color: white; font-size: 0.72rem; font-weight: 700;
          padding: 0.3rem 0.9rem; border-radius: 20px; margin-bottom: 1rem;
          letter-spacing: 0.5px;
        }
        .ass-plan-name { font-size: 1.5rem; font-weight: 800; color: white; margin: 0 0 0.75rem; }
        .ass-plan-price { display: flex; align-items: baseline; gap: 0.3rem; margin-bottom: 0.5rem; }
        .ass-price-value { font-size: 2.5rem; font-weight: 800; color: white; line-height: 1; }
        .ass-price-period { font-size: 1rem; color: rgba(255,255,255,0.6); font-weight: 500; }
        .ass-plan-desc { font-size: 0.85rem; color: rgba(255,255,255,0.6); margin: 0; line-height: 1.5; }

        .ass-divider { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 1.25rem 0; }

        .ass-benefits { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1.5rem; }
        .ass-benefit-item { display: flex; align-items: center; gap: 0.75rem; font-size: 0.88rem; color: rgba(255,255,255,0.85); }
        .ass-check {
          width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #f9007a, #d4006a);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(249,0,122,0.4);
        }

        .ass-btn {
          width: 100%; padding: 1rem;
          background: linear-gradient(135deg, #f9c74f, #f8961e);
          color: #1a1a2e; border: none; border-radius: 12px;
          font-family: 'Inter', sans-serif; font-size: 1rem; font-weight: 800;
          cursor: pointer; letter-spacing: 0.3px;
          box-shadow: 0 4px 20px rgba(248,150,30,0.4);
          transition: opacity 0.2s, transform 0.15s;
        }
        .ass-btn:hover { opacity: 0.92; transform: translateY(-1px); }

        .ass-info { background: white; border-radius: 14px; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .ass-info-title { font-size: 0.9rem; font-weight: 700; color: #1f2937; margin: 0 0 0.75rem; }
        .ass-info-list { margin: 0; padding-left: 1rem; display: flex; flex-direction: column; gap: 0.4rem; }
        .ass-info-list li { font-size: 0.83rem; color: #6b7280; line-height: 1.5; }
      `}</style>
    </div>
  );
}

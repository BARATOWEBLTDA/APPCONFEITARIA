import { useNavigate } from "react-router-dom";

const beneficiosFree = [
  "Até 10 clientes",
  "Até 5 produtos",
  "Cardápio básico",
  "Suporte por e-mail",
  "1 categoria de produto",
  "Sem relatórios",
];

const beneficiosPremium = [
  "Clientes ilimitados",
  "Produtos ilimitados",
  "Cardápio digital profissional",
  "Relatórios avançados",
  "Backup automático",
  "Suporte prioritário",
  "Assistente IA Doonly",
  "Acesso a mais de 10.000 receitas",
  "Recursos exclusivos",
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
          <p className="ass-subtitle">Escolha seu plano e continue usando o Doonly sem interrupções.</p>
        </div>
      </div>

      {/* Cards comparação */}
      <div className="ass-plans">

        {/* Plano Grátis */}
        <div className="ass-plan-card ass-free">
          <div className="ass-plan-top">
            <span className="ass-plan-badge free">Plano Grátis</span>
            <h2 className="ass-plan-name">Free</h2>
            <div className="ass-plan-price">
              <span className="ass-price-value">R$ 0</span>
              <span className="ass-price-period">/ sempre</span>
            </div>
            <p className="ass-plan-desc">Ideal para começar a explorar a plataforma.</p>
          </div>

          <div className="ass-divider" />

          <div className="ass-benefits">
            {beneficiosFree.map(b => (
              <div key={b} className="ass-benefit-item">
                <div className="ass-check free-check">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span>{b}</span>
              </div>
            ))}
          </div>

          <button className="ass-btn-free" onClick={() => navigate(-1)}>
            Continuar no Free
          </button>
        </div>

        {/* Plano Premium */}
        <div className="ass-plan-card ass-premium">
          <div className="ass-plan-top">
            <span className="ass-plan-badge premium">⭐ Mais popular</span>
            <h2 className="ass-plan-name">Premium</h2>
            <div className="ass-plan-price">
              <span className="ass-price-value">R$ 19,90</span>
              <span className="ass-price-period">/ mês</span>
            </div>
            <p className="ass-plan-desc">Tudo que precisa para crescer sua confeitaria.</p>
          </div>

          <div className="ass-divider" />

          <div className="ass-benefits">
            {beneficiosPremium.map(b => (
              <div key={b} className="ass-benefit-item">
                <div className="ass-check premium-check">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span>{b}</span>
              </div>
            ))}
          </div>

          <button className="ass-btn-premium" onClick={() => alert("Em breve! Entre em contato: 41 9 9884-3669")}>
            Assinar agora ✨
          </button>
        </div>

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
        .ass-root { font-family: 'Inter', sans-serif; max-width: 860px; }

        .ass-header { margin-bottom: 1.5rem; }
        .ass-back { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; background: white; border: 1.5px solid #e5e7eb; cursor: pointer; color: #374151; margin-bottom: 1rem; transition: background 0.15s; }
        .ass-back:hover { background: #f9fafb; }
        .ass-title { font-size: 1.25rem; font-weight: 700; color: #1f2937; margin: 0 0 0.4rem; line-height: 1.3; }
        .ass-title span { color: #f9007a; }
        .ass-subtitle { font-size: 0.88rem; color: #6b7280; margin: 0; }

        /* Plans grid */
        .ass-plans {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
          margin-bottom: 1.25rem;
          align-items: start;
        }

        .ass-plan-card {
          border-radius: 20px; padding: 1.5rem;
          display: flex; flex-direction: column;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }

        /* Free card */
        .ass-free {
          background: white;
          border: 2px solid #e5e7eb;
        }
        .ass-free .ass-plan-name { color: #374151; }
        .ass-free .ass-price-value { color: #374151; }
        .ass-free .ass-price-period { color: #9ca3af; }
        .ass-free .ass-plan-desc { color: #9ca3af; }
        .ass-free .ass-benefit-item { color: #6b7280; }
        .ass-free .ass-divider { border-color: #f3f4f6; }

        /* Premium card */
        .ass-premium {
          background: linear-gradient(135deg, #1a1a2e, #16213e);
          border: 2px solid rgba(249,0,122,0.3);
          position: relative; overflow: hidden;
          box-shadow: 0 8px 32px rgba(249,0,122,0.15);
        }
        .ass-premium::before { content: ''; position: absolute; top: -60px; right: -60px; width: 200px; height: 200px; border-radius: 50%; background: rgba(249,0,122,0.08); }
        .ass-premium .ass-plan-name { color: white; }
        .ass-premium .ass-price-value { color: white; }
        .ass-premium .ass-price-period { color: rgba(255,255,255,0.6); }
        .ass-premium .ass-plan-desc { color: rgba(255,255,255,0.6); }
        .ass-premium .ass-benefit-item { color: rgba(255,255,255,0.85); }
        .ass-premium .ass-divider { border-color: rgba(255,255,255,0.1); }

        .ass-plan-top { margin-bottom: 0.5rem; }
        .ass-plan-badge { display: inline-block; font-size: 0.72rem; font-weight: 700; padding: 0.3rem 0.9rem; border-radius: 20px; margin-bottom: 0.75rem; letter-spacing: 0.3px; }
        .ass-plan-badge.free { background: #f3f4f6; color: #6b7280; }
        .ass-plan-badge.premium { background: linear-gradient(135deg, #f9007a, #ff6eb4); color: white; }

        .ass-plan-name { font-size: 1.5rem; font-weight: 800; margin: 0 0 0.5rem; }
        .ass-plan-price { display: flex; align-items: baseline; gap: 0.3rem; margin-bottom: 0.4rem; }
        .ass-price-value { font-size: 2rem; font-weight: 800; line-height: 1; }
        .ass-price-period { font-size: 0.9rem; font-weight: 500; }
        .ass-plan-desc { font-size: 0.82rem; margin: 0; line-height: 1.5; }

        .ass-divider { border: none; border-top: 1px solid; margin: 1.1rem 0; }

        .ass-benefits { display: flex; flex-direction: column; gap: 0.5rem; flex: 1; margin-bottom: 1.25rem; }
        .ass-benefit-item { display: flex; align-items: center; gap: 0.65rem; font-size: 0.85rem; }
        .ass-check { width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .free-check { background: #9ca3af; }
        .premium-check { background: linear-gradient(135deg, #f9007a, #d4006a); box-shadow: 0 2px 6px rgba(249,0,122,0.3); }

        .ass-btn-free { width: 100%; padding: 0.85rem; background: #f3f4f6; color: #6b7280; border: 2px solid #e5e7eb; border-radius: 12px; font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: background 0.15s; }
        .ass-btn-free:hover { background: #e5e7eb; }

        .ass-btn-premium { width: 100%; padding: 0.9rem; background: linear-gradient(135deg, #f9c74f, #f8961e); color: #1a1a2e; border: none; border-radius: 12px; font-family: 'Inter', sans-serif; font-size: 1rem; font-weight: 800; cursor: pointer; box-shadow: 0 4px 20px rgba(248,150,30,0.4); transition: opacity 0.2s, transform 0.15s; }
        .ass-btn-premium:hover { opacity: 0.92; transform: translateY(-1px); }

        .ass-info { background: white; border-radius: 14px; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .ass-info-title { font-size: 0.9rem; font-weight: 700; color: #1f2937; margin: 0 0 0.75rem; }
        .ass-info-list { margin: 0; padding-left: 1rem; display: flex; flex-direction: column; gap: 0.4rem; }
        .ass-info-list li { font-size: 0.83rem; color: #6b7280; line-height: 1.5; }

        @media (max-width: 640px) {
          .ass-plans { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlano } from "@/hooks/usePlano";

const beneficios = [
  "Clientes ilimitados",
  "Produtos ilimitados",
  "Relatórios avançados",
  "Cardápio digital profissional",
  "Suporte prioritário",
  "Temas personalizados",
  "Acesso a mais de 10.000 receitas",
  "Recursos exclusivos PRO",
];

const politicas = [
  "Cancele quando quiser",
  "Sem taxas de cancelamento",
  "Renovação automática até ser cancelada",
  "Acesso imediato após assinatura",
];

export default function Assinar() {
  const navigate = useNavigate();
  const { isPro, proExpiraEm } = usePlano();
  const [planoSel, setPlanoSel] = useState<"mensal" | "anual">("mensal");

  const diasRestantes = proExpiraEm
    ? Math.max(0, Math.ceil((proExpiraEm.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="ass-root">

      {/* Hero */}
      <div className="ass-hero">
        <button className="ass-back" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <img src="/doonytexto.png" alt="Doonly PRO" className="ass-hero-logo" />
        <p className="ass-hero-sub">Recursos premium pensados para aumentar suas vendas, organizar suas encomendas e destacar sua confeitaria.</p>
        {isPro && proExpiraEm && (
          <div className="ass-trial-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Seu PRO acaba em {diasRestantes} dia{diasRestantes !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Seletor de plano */}
      <div className="ass-planos">
        <button className={`ass-plano-btn${planoSel === "anual" ? " selected" : ""}`} onClick={() => setPlanoSel("anual")}>
          <div className="ass-plano-radio">{planoSel === "anual" && <div className="ass-plano-radio-inner" />}</div>
          <div className="ass-plano-info">
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
              <span className="ass-plano-label">Anual</span>
              <span className="ass-economia-badge">Economize 17%</span>
            </div>
            <span className="ass-plano-price">R$ 197,00<span className="ass-plano-period">/ano</span></span>
            <span className="ass-plano-equiv">Equivale a R$ 16,42/mês</span>
          </div>
        </button>

        <button className={`ass-plano-btn${planoSel === "mensal" ? " selected" : ""}`} onClick={() => setPlanoSel("mensal")}>
          <div className="ass-plano-radio">{planoSel === "mensal" && <div className="ass-plano-radio-inner" />}</div>
          <div className="ass-plano-info">
            <span className="ass-plano-label">Mensal</span>
            <span className="ass-plano-price">R$ 19,90<span className="ass-plano-period">/mês</span></span>
          </div>
        </button>
      </div>

      {/* O que está incluso */}
      <div className="ass-card">
        <p className="ass-card-title">O que está incluso:</p>
        <div className="ass-beneficios">
          {beneficios.map((b, i) => (
            <div key={i} className="ass-beneficio-item">
              <div className="ass-check-rosa">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span>{b}</span>
            </div>
          ))}
        </div>
        <button className="ass-btn-assinar" onClick={() => alert("Em breve! Entre em contato: 41 9 9884-3669")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Assinar Agora
        </button>
        <button className="ass-btn-voltar" onClick={() => navigate(-1)}>Continuar no plano grátis</button>
      </div>

      {/* Pagamento seguro */}
      <div className="ass-card ass-card-info">
        <div style={{display:"flex",alignItems:"flex-start",gap:"0.75rem"}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" style={{flexShrink:0,marginTop:"2px"}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div>
            <p className="ass-info-title">Pagamento Seguro</p>
            <p className="ass-info-text">Os pagamentos são processados de forma segura. Seus dados financeiros nunca são armazenados em nossos servidores.</p>
          </div>
        </div>
      </div>

      {/* Política */}
      <div className="ass-card">
        <p className="ass-card-title">Política de Assinatura</p>
        <div className="ass-politicas">
          {politicas.map((p, i) => (
            <div key={i} className="ass-politica-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span>{p}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Plano atual */}
      <div className="ass-card ass-card-plano-atual">
        <div style={{display:"flex",alignItems:"center",gap:"0.6rem",marginBottom:"0.25rem"}}>
          <span style={{fontSize:"1.2rem"}}>🎁</span>
          <p className="ass-plano-atual-label">Seu plano atual</p>
        </div>
        {isPro && proExpiraEm ? (
          <p className="ass-plano-atual-valor">Período de Avaliação ({diasRestantes} dias)</p>
        ) : isPro ? (
          <p className="ass-plano-atual-valor" style={{color:"var(--success)"}}>PRO Ativo ✓</p>
        ) : (
          <p className="ass-plano-atual-valor">Plano Grátis</p>
        )}
        <p className="ass-plano-atual-desc">
          {isPro && proExpiraEm
            ? "Aproveite para testar todos os recursos. Assine para continuar após o período de avaliação."
            : "Assine para desbloquear todos os recursos PRO."}
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:ital@1&display=swap');
        .ass-root { font-family:'Geist', sans-serif; max-width:480px; margin:0 auto; display:flex; flex-direction:column; gap:1rem; padding:0 0 2rem; }
        .ass-back { display:flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius: var(--radius-md); background:var(--bg-card); border:1.5px solid var(--border); cursor:pointer; color:var(--text-primary); margin-bottom:0.25rem; }
        .ass-hero { padding:0; }
        .ass-hero-logo { max-height:160px; width:100%; object-fit:contain; display:block; margin:0 auto 0.75rem; }
        .ass-hero-sub { font-size: var(--font-button); color:var(--text-secondary); margin:0 0 0.75rem; text-align:center; line-height:1.6; padding:0 1.5rem; }
        .ass-trial-badge { display:flex; align-items:center; justify-content:center; gap:0.4rem; background:var(--primary-gradient); color:var(--text-inverse); font-size: var(--font-helper); font-weight: var(--fw-bold); padding:0.45rem 1rem; border-radius: var(--radius-xl); margin:0 auto; width:fit-content; }
        .ass-planos { display:flex; flex-direction:column; gap:0.65rem; }
        .ass-plano-btn { display:flex; align-items:center; gap:1rem; padding:1rem 1.15rem; background:var(--bg-card); border:2px solid var(--border); border-radius: var(--radius-lg); cursor:pointer; font-family:'Geist', sans-serif; text-align:left; transition:border-color 0.2s; box-shadow:var(--shadow-card, 0 2px 8px rgba(0,0,0,0.05)); }
        .ass-plano-btn.selected { border-color:var(--primary); }
        .ass-plano-radio { width:20px; height:20px; border-radius:50%; border:2px solid var(--border); display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:border-color 0.2s; }
        .ass-plano-btn.selected .ass-plano-radio { border-color:var(--primary); }
        .ass-plano-radio-inner { width:10px; height:10px; border-radius:50%; background:var(--primary); }
        .ass-plano-info { display:flex; flex-direction:column; gap:0.1rem; flex:1; }
        .ass-plano-label { font-size: var(--font-button); font-weight: var(--fw-semibold); color:var(--text-title); }
        .ass-plano-price { font-size: var(--font-page-title); font-weight: var(--fw-black); color:var(--text-title); }
        .ass-plano-period { font-size: var(--font-helper); font-weight: var(--fw-medium); color:var(--text-muted); }
        .ass-plano-equiv { font-size: var(--font-caption); color:var(--text-muted); }
        .ass-economia-badge { background:#dcfce7; color:#16a34a; font-size: var(--font-caption); font-weight: var(--fw-bold); padding:0.15rem 0.5rem; border-radius: var(--radius-xl); }
        .ass-card { background:var(--bg-card); border-radius: var(--radius-lg); padding:1.25rem; box-shadow:var(--shadow-card, 0 2px 12px rgba(0,0,0,0.06)); display:flex; flex-direction:column; gap:0.75rem; }
        .ass-card-title { font-size: var(--font-button); font-weight: var(--fw-bold); color:var(--text-title); margin:0; }
        .ass-card-info { background:var(--bg-subtle); border:1px solid rgba(255,111,169,0.2); box-shadow:none; }
        .ass-beneficios { display:flex; flex-direction:column; gap:0.65rem; }
        .ass-beneficio-item { display:flex; align-items:center; gap:0.75rem; }
        .ass-check-rosa { width:20px; height:20px; border-radius:50%; background:var(--primary-gradient); display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 2px 6px rgba(255,111,169,0.4); }
        .ass-beneficio-item span { font-size: var(--font-button); color:var(--text-primary); font-weight: var(--fw-medium); }
        .ass-btn-assinar { width:100%; padding:0.95rem; background:var(--primary-gradient); border:none; border-radius: var(--radius-full); color:var(--text-inverse); font-family:'Geist', sans-serif; font-size: var(--font-input); font-weight: var(--fw-bold); cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.5rem; transition:opacity 0.2s,transform 0.1s; margin-top:0.5rem; }
        .ass-btn-assinar:hover { opacity:0.9; }
        .ass-btn-assinar:active { transform:scale(0.98); }
        .ass-btn-voltar { background:none; border:none; color:var(--text-muted); font-family:'Geist', sans-serif; font-style:italic; font-size: var(--font-button); cursor:pointer; text-decoration:underline; padding:0.25rem; text-align:center; }
        .ass-info-title { font-size: var(--font-button); font-weight: var(--fw-bold); color:var(--text-title); margin:0; }
        .ass-info-text { font-size: var(--font-helper); color:var(--text-secondary); margin:0.25rem 0 0; line-height:1.5; }
        .ass-politicas { display:flex; flex-direction:column; gap:0.6rem; }
        .ass-politica-item { display:flex; align-items:center; gap:0.65rem; font-size: var(--font-button); color:var(--text-primary); font-weight: var(--fw-medium); }
        .ass-card-plano-atual { background:var(--primary-light); border:1px solid rgba(255,111,169,0.15); box-shadow:none; }
        .ass-plano-atual-label { font-size: var(--font-button); font-weight: var(--fw-semibold); color:var(--text-secondary); margin:0; }
        .ass-plano-atual-valor { font-size: var(--font-modal-title); font-weight: var(--fw-black); color:var(--primary); margin:0; }
        .ass-plano-atual-desc { font-size: var(--font-helper); color:var(--text-muted); margin:0; line-height:1.5; }
        :root.dark .ass-economia-badge { background:rgba(34,197,94,0.15); color:#4ade80; }
        :root.dark .ass-card-plano-atual { background:rgba(255,111,169,0.05); }
        :root.dark .ass-card-info { background:rgba(255,111,169,0.05); }
      `}</style>
    </div>
  );
}

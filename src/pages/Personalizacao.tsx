import { useTheme } from "@/context/ThemeContext";
import { usePlano } from "@/hooks/usePlano";
import { useNavigate } from "react-router-dom";

export default function Personalizacao() {
  const { theme, setTheme } = useTheme();
  const { isPro } = usePlano();
  const navigate = useNavigate();

  return (
    <div className="per-root">
      <div className="per-header">
        <h1 className="per-title">🎨 Personalização</h1>
        <p className="per-sub">Customize a aparência do seu app</p>
      </div>

      <div className="per-card">
        <div className="per-card-header">
          <span className="per-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2a10 10 0 0 1 0 20"/>
              <path d="M12 2v20"/>
            </svg>
          </span>
          <div>
            <p className="per-card-title">Tema do aplicativo</p>
            <p className="per-card-sub">Escolha entre o modo claro e escuro</p>
          </div>
          {!isPro && <span className="per-pro-badge">PRO</span>}
        </div>

        {!isPro ? (
          <div className="per-locked">
            <p>🔒 Temas personalizados são exclusivos para assinantes PRO.</p>
            <button className="per-assinar-btn" onClick={() => navigate("/assinar")}>
              Assinar agora →
            </button>
          </div>
        ) : (
          <div className="per-temas">
            <button className={`per-tema-btn${theme === "light" ? " active" : ""}`} onClick={() => setTheme("light")}>
              <div className="per-tema-preview per-tema-preview--light">
                <div className="per-preview-header" />
                <div className="per-preview-card"><div /><div /><div /></div>
              </div>
              <div className="per-tema-info">
                <span className="per-tema-name">☀️ Claro</span>
                <span className="per-tema-desc">Tema padrão</span>
              </div>
              {theme === "light" && <span className="per-tema-check">✓</span>}
            </button>

            <button className={`per-tema-btn${theme === "dark" ? " active" : ""}`} onClick={() => setTheme("dark")}>
              <div className="per-tema-preview per-tema-preview--dark">
                <div className="per-preview-header per-preview-header--dark" />
                <div className="per-preview-card per-preview-card--dark"><div /><div /><div /></div>
              </div>
              <div className="per-tema-info">
                <span className="per-tema-name">🌙 Escuro</span>
                <span className="per-tema-desc">Modo noturno</span>
              </div>
              {theme === "dark" && <span className="per-tema-check">✓</span>}
            </button>
          </div>
        )}
      </div>

      <p className="per-hint">O tema é aplicado automaticamente ao selecionar.</p>

      <style>{`
        .per-root { max-width: 480px; margin: 0 auto; padding: 0.5rem 0; }
        .per-header { margin-bottom: 1.5rem; }
        .per-title { font-size: 1.4rem; font-weight: 700; color: var(--text-title, #1F2937); margin: 0 0 0.25rem; }
        .per-sub { font-size: 0.85rem; color: var(--text-muted, #9CA3AF); margin: 0; }
        .per-card { background: var(--bg-card, #FFFFFF); border-radius: 18px; padding: 1.25rem; box-shadow: var(--shadow-card, 0 2px 12px rgba(0,0,0,0.06)); margin-bottom: 0.75rem; }
        .per-card-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
        .per-card-icon { color: var(--primary, #FF6FA9); display: flex; align-items: center; flex-shrink: 0; }
        .per-card-title { font-size: 0.95rem; font-weight: 700; color: var(--text-title, #1F2937); margin: 0; }
        .per-card-sub { font-size: 0.75rem; color: var(--text-muted, #9CA3AF); margin: 0.15rem 0 0; }
        .per-pro-badge { margin-left: auto; background: var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A)); color: var(--text-inverse, #FFFFFF); font-size: 0.68rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 20px; flex-shrink: 0; }
        .per-locked { background: var(--bg-body, #F7F7F8); border-radius: 12px; padding: 1rem; text-align: center; }
        .per-locked p { font-size: 0.85rem; color: var(--text-secondary, #6B7280); margin: 0 0 0.75rem; }
        .per-assinar-btn { padding: 0.6rem 1.5rem; background: var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A)); color: var(--text-inverse, #FFFFFF); border: none; border-radius: 50px; font-family: inherit; font-size: 0.85rem; font-weight: 700; cursor: pointer; }
        .per-temas { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
        .per-tema-btn { display: flex; flex-direction: column; gap: 0.6rem; padding: 0.85rem; border: 2px solid var(--border, #E9E9EE); border-radius: 16px; background: var(--bg-body, #F7F7F8); cursor: pointer; transition: all 0.2s; position: relative; font-family: inherit; text-align: left; }
        .per-tema-btn.active { border-color: var(--primary, #FF6FA9); background: var(--primary-light, #FFF1F7); }
        .per-tema-btn:hover { border-color: var(--primary, #FF6FA9); }
        .per-tema-preview { width: 100%; height: 80px; border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; gap: 4px; padding: 6px; }
        .per-tema-preview--light { background: var(--bg-body, #F7F7F8); border: 1px solid var(--border, #E9E9EE); }
        .per-tema-preview--dark  { background: #1a1a1a; border: 1px solid #333; }
        .per-preview-header { height: 12px; border-radius: 4px; background: var(--primary, #FF6FA9); width: 60%; }
        .per-preview-header--dark { background: var(--primary, #FF6FA9); }
        .per-preview-card { flex: 1; border-radius: 6px; background: var(--bg-card, #FFFFFF); padding: 4px; display: flex; flex-direction: column; gap: 3px; }
        .per-preview-card--dark { background: #2a2a2a; }
        .per-preview-card div { height: 4px; border-radius: 2px; background: var(--border, #E9E9EE); }
        .per-preview-card--dark div { background: #444; }
        .per-preview-card div:nth-child(2) { width: 70%; }
        .per-preview-card div:nth-child(3) { width: 45%; }
        .per-tema-info { display: flex; flex-direction: column; gap: 0.1rem; }
        .per-tema-name { font-size: 0.85rem; font-weight: 700; color: var(--text-title, #1F2937); }
        .per-tema-desc { font-size: 0.72rem; color: var(--text-muted, #9CA3AF); }
        .per-tema-check { position: absolute; top: 0.6rem; right: 0.6rem; width: 20px; height: 20px; background: var(--primary, #FF6FA9); color: var(--text-inverse, #FFFFFF); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; }
        .per-hint { font-size: 0.75rem; color: var(--text-muted, #9CA3AF); text-align: center; margin-top: 0.5rem; }
      `}</style>
    </div>
  );
}

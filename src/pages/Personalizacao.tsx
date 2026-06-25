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
        .per-title { font-size: var(--font-page-title); font-weight: var(--fw-bold); color: var(--text-title); margin: 0 0 0.25rem; }
        .per-sub { font-size: var(--font-button); color: var(--text-muted); margin: 0; }
        .per-card { background: var(--bg-card); border-radius: var(--radius-lg); padding: 1.25rem; box-shadow: var(--shadow-card, 0 2px 12px rgba(0,0,0,0.06)); margin-bottom: 0.75rem; }
        .per-card-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
        .per-card-icon { color: var(--primary); display: flex; align-items: center; flex-shrink: 0; }
        .per-card-title { font-size: var(--font-input); font-weight: var(--fw-bold); color: var(--text-title); margin: 0; }
        .per-card-sub { font-size: var(--font-helper); color: var(--text-muted); margin: 0.15rem 0 0; }
        .per-pro-badge { margin-left: auto; background: var(--primary-gradient); color: var(--text-inverse); font-size: var(--font-caption); font-weight: var(--fw-bold); padding: 0.2rem 0.6rem; border-radius: var(--radius-xl); flex-shrink: 0; }
        .per-locked { background: var(--bg-body); border-radius: var(--radius-md); padding: 1rem; text-align: center; }
        .per-locked p { font-size: var(--font-button); color: var(--text-secondary); margin: 0 0 0.75rem; }
        .per-assinar-btn { padding: 0.6rem 1.5rem; background: var(--primary-gradient); color: var(--text-inverse); border: none; border-radius: var(--radius-full); font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-bold); cursor: pointer; }
        .per-temas { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
        .per-tema-btn { display: flex; flex-direction: column; gap: 0.6rem; padding: 0.85rem; border: 2px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-body); cursor: pointer; transition: all 0.2s; position: relative; font-family: inherit; text-align: left; }
        .per-tema-btn.active { border-color: var(--primary); background: var(--primary-light); }
        .per-tema-btn:hover { border-color: var(--primary); }
        .per-tema-preview { width: 100%; height: 80px; border-radius: var(--radius-md); overflow: hidden; display: flex; flex-direction: column; gap: 4px; padding: 6px; }
        .per-tema-preview--light { background: var(--bg-body); border: 1px solid var(--border); }
        .per-tema-preview--dark  { background: #1a1a1a; border: 1px solid #333; }
        .per-preview-header { height: 12px; border-radius: var(--radius-sm); background: var(--primary); width: 60%; }
        .per-preview-header--dark { background: var(--primary); }
        .per-preview-card { flex: 1; border-radius: var(--radius-sm); background: var(--bg-card); padding: 4px; display: flex; flex-direction: column; gap: 3px; }
        .per-preview-card--dark { background: #2a2a2a; }
        .per-preview-card div { height: 4px; border-radius: 2px; background: var(--border); }
        .per-preview-card--dark div { background: #444; }
        .per-preview-card div:nth-child(2) { width: 70%; }
        .per-preview-card div:nth-child(3) { width: 45%; }
        .per-tema-info { display: flex; flex-direction: column; gap: 0.1rem; }
        .per-tema-name { font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--text-title); }
        .per-tema-desc { font-size: var(--font-caption); color: var(--text-muted); }
        .per-tema-check { position: absolute; top: 0.6rem; right: 0.6rem; width: 20px; height: 20px; background: var(--primary); color: var(--text-inverse); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: var(--font-caption); font-weight: var(--fw-bold); }
        .per-hint { font-size: var(--font-helper); color: var(--text-muted); text-align: center; margin-top: 0.5rem; }
      `}</style>
    </div>
  );
}

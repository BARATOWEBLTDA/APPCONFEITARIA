import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function EsqueciSenha() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const bgRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 50, y: 50 });
  const currentRef = useRef({ x: 50, y: 50 });
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    const animate = () => {
      timeRef.current += 0.003;
      const t = timeRef.current;
      const angle = 120 + 20 * Math.sin(t);
      if (bgRef.current) {
        bgRef.current.style.background = `linear-gradient(${angle}deg, #986274 0%, #6E3548 50%, #C39EAA 100%)`;
      }
      currentRef.current.x += (mouseRef.current.x - currentRef.current.x) * 0.06;
      currentRef.current.y += (mouseRef.current.y - currentRef.current.y) * 0.06;
      if (glowRef.current) {
        glowRef.current.style.left = `${currentRef.current.x}px`;
        glowRef.current.style.top = `${currentRef.current.y}px`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;

      setSent(true);
    } catch (err: any) {
      setError("Ocorreu um erro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div ref={bgRef} className="auth-bg" />
      <div ref={glowRef} className="mouse-glow" />

      <div className="auth-card">
        {!sent ? (
          <>
            <div className="auth-text">
              <h2>Esqueci minha senha</h2>
              <p>Digite seu e-mail cadastrado e enviaremos um link para redefinir sua senha.</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="field">
                <label>E-mail</label>
                <input
                  type="email"
                  placeholder="Digite seu e-mail"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  required
                  style={{
                    backgroundColor: email ? "var(--primary-light, #FFF1F7)" : "var(--bg-card, #FFFFFF)",
                    borderColor: email ? "var(--primary-light, #FFF1F7)" : "var(--border, #E9E9EE)",
                  }}
                />
              </div>

              {error && <p className="auth-error">{error}</p>}

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><span className="spinner" /> Enviando...</span> : "Enviar link de recuperação"}
              </button>

              <button type="button" className="back-btn" onClick={() => navigate("/login")}>
                ← Voltar para o login
              </button>
            </form>
          </>
        ) : (
          <div className="sent-wrap">
            <div className="sent-icon">📧</div>
            <h2>E-mail enviado!</h2>
            <p>Se esse e-mail estiver cadastrado, você receberá um link para redefinir sua senha em instantes.</p>
            <p className="sent-tip">Verifique também sua caixa de spam.</p>
            <button className="auth-btn" onClick={() => navigate("/login")}>
              Voltar para o login
            </button>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; overflow: hidden; }
        .auth-root { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; overflow: hidden; font-family: 'Geist', sans-serif; padding: 1.5rem; }
        .auth-bg { position: fixed; inset: 0; z-index: 0; background: var(--primary-gradient, linear-gradient(135deg, #986274, #6E3548)); }
        .mouse-glow { position: fixed; z-index: 1; width: 350px; height: 350px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%); transform: translate(-50%, -50%); pointer-events: none; }
        .auth-card { position: relative; z-index: 2; background: var(--bg-card, #FFFFFF); border-radius: 16px; padding: 2.5rem 2.2rem 2rem; width: calc(100% - 2.5rem); max-width: 440px; box-shadow: 0 8px 40px rgba(0,0,0,0.12); animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .auth-text { text-align: center; margin-bottom: 1.5rem; }
        .auth-text h2 { font-size: 1.2rem; font-weight: 600; color: var(--text-title, #1F2937); margin-bottom: 0.5rem; }
        .auth-text p { font-size: 0.88rem; color: var(--text-secondary, #6B7280); line-height: 1.5; }
        .auth-form { display: flex; flex-direction: column; gap: 1rem; }
        .field { display: flex; flex-direction: column; gap: 0.35rem; }
        .field label { font-size: 0.88rem; font-weight: 500; color: var(--text-primary, #374151); }
        .field input { padding: 0.72rem 1rem; border: 1.5px solid var(--border, #E9E9EE); border-radius: 8px; font-family: 'Geist', sans-serif; font-size: 0.95rem; color: var(--text-title, #1F2937); outline: none; transition: background-color 0.2s, border-color 0.2s; width: 100%; }
        .field input::placeholder { color: var(--text-muted, #9CA3AF); }
        .auth-error { background: #fff1f2; border: 1px solid #fecdd3; color: var(--error, #EF4444); border-radius: 8px; padding: 0.6rem 0.9rem; font-size: 0.85rem; }
        .auth-btn { padding: 0.85rem; background: var(--primary-gradient, linear-gradient(135deg, #986274, #6E3548)); color: var(--text-inverse, #FFFFFF); border: none; border-radius: 8px; font-family: 'Geist', sans-serif; font-size: 1rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s, transform 0.15s; display: flex; align-items: center; justify-content: center; min-height: 48px; }
        .auth-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .auth-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .back-btn { background: none; border: none; color: var(--text-muted, #9CA3AF); font-family: 'Geist', sans-serif; font-size: 0.88rem; cursor: pointer; text-align: center; padding: 0.25rem; transition: color 0.2s; }
        .back-btn:hover { color: var(--primary, #986274); }
        .sent-wrap { text-align: center; display: flex; flex-direction: column; gap: 0.75rem; }
        .sent-icon { font-size: 3rem; }
        .sent-wrap h2 { font-size: 1.2rem; font-weight: 600; color: var(--text-title, #1F2937); }
        .sent-wrap p { font-size: 0.88rem; color: var(--text-secondary, #6B7280); line-height: 1.5; }
        .sent-tip { font-size: 0.8rem; color: var(--text-muted, #9CA3AF); }
        .sent-wrap .auth-btn { margin-top: 0.5rem; }
        .spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

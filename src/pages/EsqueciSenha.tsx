import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validarEmail = (v: string) => {
  const t = v.trim();
  if (!t) return "Informe seu e-mail";
  if (!t.includes("@")) return "Está faltando o @ no seu e-mail";
  if (!EMAIL_REGEX.test(t)) return "E-mail em formato inválido";
  return "";
};

export default function EsqueciSenha() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [touched, setTouched] = useState(false);

  const glowRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 50, y: 50 });
  const currentRef = useRef({ x: 50, y: 50 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);
    const animate = () => {
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

  const handleEmailChange = (v: string) => {
    setEmail(v);
    setError("");
    if (touched) setEmailError(validarEmail(v));
  };

  const handleEmailBlur = () => {
    setTouched(true);
    setEmailError(validarEmail(email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validarEmail(email);
    if (err) {
      setTouched(true);
      setEmailError(err);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err: any) {
      const msg = err?.message || "";
      if (/rate limit|too many/i.test(msg)) {
        setError("Muitas solicitações. Aguarde 1 minuto e tente novamente.");
      } else {
        setError("Não foi possível enviar o e-mail. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-bg" />
      <div ref={glowRef} className="mouse-glow" />

      <div className="auth-card">
        {!sent ? (
          <>
            <div className="auth-text">
              <h2>Esqueci minha senha</h2>
              <p>Digite seu e-mail cadastrado e enviaremos um link para redefinir sua senha.</p>
            </div>
            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              <div className="field">
                <label htmlFor="reset-email">E-mail</label>
                <input
                  id="reset-email"
                  type="email"
                  placeholder="Digite seu e-mail"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onBlur={handleEmailBlur}
                  required
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="send"
                  aria-invalid={!!emailError}
                  style={{
                    backgroundColor: email ? "var(--primary-light)" : "var(--bg-card)",
                    borderColor: emailError ? "var(--error)" : (email ? "var(--primary-light)" : "var(--border)"),
                  }}
                />
                {emailError && <span className="field-error">{emailError}</span>}
              </div>
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><span className="spinner" /> Enviando...</span> : "Enviar link de recuperação"}
              </button>
              <button type="button" className="back-btn" onClick={() => navigate("/login")}>← Voltar para o login</button>
            </form>
          </>
        ) : (
          <div className="sent-wrap">
            <div className="sent-icon" aria-hidden="true">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <h2>E-mail enviado!</h2>
            <p>Se esse e-mail estiver cadastrado, você receberá um link para redefinir sua senha em instantes.</p>
            <p className="sent-tip">Verifique também sua caixa de spam.</p>
            <button className="auth-btn" onClick={() => navigate("/login")}>Voltar para o login</button>
          </div>
        )}
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        #root { height: 100%; overflow-y: auto; -webkit-overflow-scrolling: touch; }
        .auth-root {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          position: relative; overflow: hidden;
          font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
          padding: max(1.5rem, env(safe-area-inset-top)) 1.5rem max(1.5rem, env(safe-area-inset-bottom));
        }
        .auth-bg {
          position: fixed; inset: 0; z-index: 0;
          background: linear-gradient(135deg, #FF9AC1 0%, #E85A8C 50%, #A8235A 100%);
        }
        .mouse-glow {
          position: fixed; z-index: 1;
          width: 350px; height: 350px; border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 70%);
          transform: translate(-50%, -50%);
          pointer-events: none;
          will-change: transform;
        }
        .auth-card {
          position: relative; z-index: 2;
          background: var(--bg-card); border-radius: var(--radius-lg);
          padding: 2.5rem 2.2rem 2rem;
          width: 100%; max-width: 440px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.12);
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
          max-height: calc(100dvh - 3rem);
          overflow-y: auto;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .auth-text { text-align: center; margin-bottom: 1.5rem; }
        .auth-text h2 { font-size: var(--font-modal-title); font-weight: var(--fw-semibold); color: var(--text-title); margin-bottom: 0.5rem; }
        .auth-text p { font-size: var(--font-button); color: var(--text-secondary); line-height: 1.5; }
        .auth-form { display: flex; flex-direction: column; gap: 1rem; }
        .field { display: flex; flex-direction: column; gap: 0.35rem; }
        .field label { font-size: var(--font-button); font-weight: var(--fw-medium); color: var(--text-primary); }
        .field input {
          padding: 0.72rem 1rem;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-sm);
          font-family: inherit;
          font-size: 16px;
          color: var(--text-title);
          outline: none;
          transition: background-color 0.2s, border-color 0.2s;
          width: 100%;
          -webkit-appearance: none;
          appearance: none;
          -webkit-tap-highlight-color: transparent;
        }
        .field input::placeholder { color: var(--text-muted); }
        .field-error { font-size: 0.75rem; color: var(--error); padding-left: 0.25rem; }
        .auth-error { background: #fff1f2; border: 1px solid #fecdd3; color: var(--error); border-radius: var(--radius-sm); padding: 0.6rem 0.9rem; font-size: var(--font-button); }
        .auth-btn {
          padding: 0.85rem;
          background: var(--primary-gradient);
          color: var(--text-inverse);
          border: none;
          border-radius: var(--radius-sm);
          font-family: inherit;
          font-size: var(--font-input);
          font-weight: var(--fw-semibold);
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
          display: flex; align-items: center; justify-content: center;
          min-height: 48px;
          -webkit-tap-highlight-color: transparent;
          -webkit-appearance: none;
          appearance: none;
        }
        .auth-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .auth-btn:active:not(:disabled) { transform: scale(0.98); }
        .auth-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .back-btn {
          background: none; border: none;
          color: var(--text-muted);
          font-family: inherit;
          font-size: var(--font-button);
          cursor: pointer; text-align: center;
          padding: 0.5rem;
          transition: color 0.2s;
          -webkit-tap-highlight-color: transparent;
        }
        .back-btn:hover { color: var(--primary); }
        .sent-wrap { text-align: center; display: flex; flex-direction: column; gap: 0.75rem; align-items: center; }
        .sent-icon { color: var(--primary); margin-bottom: 0.5rem; }
        .sent-wrap h2 { font-size: var(--font-modal-title); font-weight: var(--fw-semibold); color: var(--text-title); }
        .sent-wrap p { font-size: var(--font-button); color: var(--text-secondary); line-height: 1.5; }
        .sent-tip { font-size: var(--font-helper); color: var(--text-muted); }
        .sent-wrap .auth-btn { margin-top: 0.5rem; width: 100%; }
        .spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

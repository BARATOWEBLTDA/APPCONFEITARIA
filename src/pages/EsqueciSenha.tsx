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
        bgRef.current.style.background = `linear-gradient(${angle}deg, #f9007a 0%, #ff6eb4 45%, #ffb3d9 100%)`;
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
      // Verifica se o email existe no banco
      const { data, error: checkError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      // Tenta enviar o reset independente — Supabase não expõe se email existe por segurança
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
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
        <div className="auth-logo-wrap">
          <img src="https://www.pandamenu.com.br/imagemmenu.png" alt="Panda Menu" className="auth-logo-img" />
        </div>

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
                    backgroundColor: email ? "#fff0f6" : "white",
                    borderColor: email ? "#ffb3d9" : "#e5e7eb",
                  }}
                />
              </div>

              {error && <p className="auth-error">{error}</p>}

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? <span className="spinner" /> : "Enviar link de recuperação"}
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

      <div className="auth-footer">
        <span className="footer-title">Precisa de Ajuda?</span>
        <div className="footer-links">
          <a href="https://wa.me/5541998843669" target="_blank" rel="noreferrer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp: 41 9 9884-3669
          </a>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        html, body, #root { height: 100%; overflow: hidden; }

        .auth-root {
          height: 100vh; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          position: relative; overflow: hidden;
          font-family: 'Inter', sans-serif;
          padding: 1.5rem; padding-bottom: 5rem;
        }

        .auth-bg { position: fixed; inset: 0; z-index: 0; background: linear-gradient(120deg, #f9007a 0%, #ff6eb4 45%, #ffb3d9 100%); }

        .mouse-glow {
          position: fixed; z-index: 1; width: 350px; height: 350px; border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%);
          transform: translate(-50%, -50%); pointer-events: none;
        }

        .auth-card {
          position: relative; z-index: 2; background: #ffffff;
          border-radius: 16px; padding: 2.5rem 2.2rem 2rem;
          width: calc(100% - 2.5rem); max-width: 440px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.12);
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .auth-logo-wrap { display: flex; justify-content: center; margin-bottom: 1.5rem; }
        .auth-logo-img { height: 70px; object-fit: contain; }

        .auth-text { text-align: center; margin-bottom: 1.5rem; }
        .auth-text h2 { font-size: 1.2rem; font-weight: 600; color: #1f2937; margin-bottom: 0.5rem; }
        .auth-text p { font-size: 0.88rem; color: #6b7280; line-height: 1.5; }

        .auth-form { display: flex; flex-direction: column; gap: 1rem; }
        .field { display: flex; flex-direction: column; gap: 0.35rem; }
        .field label { font-size: 0.88rem; font-weight: 500; color: #374151; }
        .field input {
          padding: 0.72rem 1rem; border: 1.5px solid #e5e7eb; border-radius: 8px;
          font-family: 'Inter', sans-serif; font-size: 0.95rem; color: #1f2937;
          outline: none; transition: background-color 0.2s, border-color 0.2s; width: 100%;
        }
        .field input::placeholder { color: #9ca3af; }

        .auth-error {
          background: #fff1f2; border: 1px solid #fecdd3;
          color: #be123c; border-radius: 8px; padding: 0.6rem 0.9rem; font-size: 0.85rem;
        }

        .auth-btn {
          padding: 0.85rem; background: linear-gradient(135deg, #f9007a, #d4006a);
          color: white; border: none; border-radius: 8px;
          font-family: 'Inter', sans-serif; font-size: 1rem; font-weight: 600;
          cursor: pointer; transition: opacity 0.2s, transform 0.15s;
          display: flex; align-items: center; justify-content: center; min-height: 48px;
        }
        .auth-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .auth-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .back-btn {
          background: none; border: none; color: #9ca3af;
          font-family: 'Inter', sans-serif; font-size: 0.88rem;
          cursor: pointer; text-align: center; padding: 0.25rem;
          transition: color 0.2s;
        }
        .back-btn:hover { color: #f9007a; }

        .sent-wrap { text-align: center; display: flex; flex-direction: column; gap: 0.75rem; }
        .sent-icon { font-size: 3rem; }
        .sent-wrap h2 { font-size: 1.2rem; font-weight: 600; color: #1f2937; }
        .sent-wrap p { font-size: 0.88rem; color: #6b7280; line-height: 1.5; }
        .sent-tip { font-size: 0.8rem; color: #9ca3af; }
        .sent-wrap .auth-btn { margin-top: 0.5rem; }

        .spinner {
          width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .auth-footer {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 3;
          background: rgba(180, 0, 90, 0.2); backdrop-filter: blur(12px);
          padding: 0.75rem 1rem; text-align: center;
        }
        .footer-title { display: block; font-weight: 600; font-size: 0.9rem; color: #fff; margin-bottom: 0.25rem; }
        .footer-links { display: flex; justify-content: center; }
        .footer-links a { display: flex; align-items: center; gap: 0.35rem; color: #fff; text-decoration: none; font-size: 0.85rem; font-weight: 500; }
        .footer-links a:hover { opacity: 0.8; }
      `}</style>
    </div>
  );
}

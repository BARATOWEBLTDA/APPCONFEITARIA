import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepConnected, setKeepConnected] = useState(false);
  const [form, setForm] = useState({ email: "", senha: "" });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -999, y: -999 });
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    const animate = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      timeRef.current += 0.008;
      const t = timeRef.current;
      const W = canvas.width;
      const H = canvas.height;

      // --- Fundo degradê animado ---
      // Os pontos do gradiente oscilam com o tempo
      const x1 = W * (0.5 + 0.4 * Math.sin(t * 0.7));
      const y1 = H * (0.3 + 0.3 * Math.cos(t * 0.5));
      const x2 = W * (0.5 + 0.4 * Math.cos(t * 0.6));
      const y2 = H * (0.7 + 0.2 * Math.sin(t * 0.8));

      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, "#ff007a");
      grad.addColorStop(0.3, "#ff4da6");
      grad.addColorStop(0.6, "#ff80c0");
      grad.addColorStop(0.85, "#ffb3d9");
      grad.addColorStop(1, "#ffe6f2");

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // --- Efeito do mouse: luz suave ---
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      if (mx > 0) {
        // Brilho principal
        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 220);
        glow.addColorStop(0, "rgba(255, 255, 255, 0.22)");
        glow.addColorStop(0.4, "rgba(255, 220, 240, 0.12)");
        glow.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        // Ondulação ao redor do cursor
        const rippleR = 60 + 20 * Math.sin(t * 4);
        const ripple = ctx.createRadialGradient(mx, my, rippleR * 0.6, mx, my, rippleR);
        ripple.addColorStop(0, "rgba(255,255,255,0)");
        ripple.addColorStop(0.7, "rgba(255,255,255,0.08)");
        ripple.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = ripple;
        ctx.fillRect(0, 0, W, H);
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.senha,
      });
      if (error) throw error;
      navigate("/dashboard");
    } catch (err: any) {
      setError("E-mail ou senha incorretos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <canvas ref={canvasRef} className="auth-canvas" />

      <div className="auth-card">
        <div className="auth-logo-wrap">
          <img
            src="https://www.pandamenu.com.br/imagemmenu.png"
            alt="Panda Menu"
            className="auth-logo-img"
          />
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              name="email"
              placeholder="Digite seu email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="field">
            <label>Senha</label>
            <div className="password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                name="senha"
                placeholder="Digite sua senha"
                value={form.senha}
                onChange={handleChange}
                required
              />
              <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="keep-connected">
            <input type="checkbox" id="keep" checked={keepConnected} onChange={(e) => setKeepConnected(e.target.checked)} />
            <label htmlFor="keep">Manter conectado</label>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? <span className="spinner" /> : "Entrar"}
          </button>
        </form>
      </div>

      <div className="auth-footer">
        <span className="footer-title">Precisa de Ajuda?</span>
        <div className="footer-links">
          <a href="https://wa.me/5541998843669" target="_blank" rel="noreferrer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp: 41 9 9884-3669
          </a>
          <a href="mailto:suporte@pandamenu.com">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            suporte@pandamenu.com
          </a>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .auth-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          font-family: 'DM Sans', sans-serif;
        }

        .auth-canvas {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }

        .auth-card {
          position: relative;
          z-index: 1;
          background: #ffffff;
          border-radius: 16px;
          padding: 2.5rem 2.2rem 2rem;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.15);
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
          margin-bottom: 3rem;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .auth-logo-wrap {
          display: flex;
          justify-content: center;
          margin-bottom: 1.8rem;
        }

        .auth-logo-img {
          height: 80px;
          object-fit: contain;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .field { display: flex; flex-direction: column; gap: 0.35rem; }

        .field label {
          font-size: 0.88rem;
          font-weight: 500;
          color: #374151;
        }

        .field input {
          padding: 0.72rem 1rem;
          border: 1.5px solid #e5e7eb;
          border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem;
          color: #1f2937;
          background: white;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          width: 100%;
        }

        .field input:focus {
          border-color: #ff007a;
          box-shadow: 0 0 0 3px rgba(255, 0, 122, 0.1);
        }

        .field input::placeholder { color: #9ca3af; }

        .password-wrap { position: relative; }
        .password-wrap input { padding-right: 2.8rem; }

        .eye-btn {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #9ca3af;
          display: flex;
          align-items: center;
          padding: 0;
        }
        .eye-btn:hover { color: #ff007a; }

        .keep-connected { display: flex; align-items: center; gap: 0.5rem; }
        .keep-connected input[type="checkbox"] {
          accent-color: #ff007a;
          width: 16px; height: 16px;
          cursor: pointer;
        }
        .keep-connected label { font-size: 0.88rem; color: #374151; cursor: pointer; }

        .auth-error {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #be123c;
          border-radius: 8px;
          padding: 0.6rem 0.9rem;
          font-size: 0.85rem;
        }

        .auth-btn {
          padding: 0.85rem;
          background: linear-gradient(135deg, #ff007a, #e0006e);
          color: white;
          border: none;
          border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
        }
        .auth-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .auth-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .spinner {
          width: 20px; height: 20px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .auth-footer {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 2;
          background: rgba(180, 0, 90, 0.25);
          backdrop-filter: blur(12px);
          padding: 0.9rem 1rem;
          text-align: center;
        }

        .footer-title {
          display: block;
          font-weight: 600;
          font-size: 0.9rem;
          color: #fff;
          margin-bottom: 0.35rem;
        }

        .footer-links {
          display: flex;
          justify-content: center;
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .footer-links a {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          color: #fff;
          text-decoration: none;
          font-size: 0.85rem;
          font-weight: 500;
          transition: opacity 0.2s;
        }
        .footer-links a:hover { opacity: 0.8; }

        @media (max-width: 480px) {
          .auth-card { margin: 1rem; padding: 2rem 1.5rem; }
          .footer-links { gap: 1rem; }
        }
      `}</style>
    </div>
  );
}
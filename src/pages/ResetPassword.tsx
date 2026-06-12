import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [sessionOk, setSessionOk] = useState(false);

  const bgRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 50, y: 50 });
  const currentRef = useRef({ x: 50, y: 50 });
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionOk(true);
      else {
        supabase.auth.onAuthStateChange((event) => {
          if (event === "PASSWORD_RECOVERY") setSessionOk(true);
        });
      }
    });

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    const animate = () => {
      timeRef.current += 0.003;
      const t = timeRef.current;
      const angle = 120 + 20 * Math.sin(t);
      if (bgRef.current) {
        bgRef.current.style.background = `linear-gradient(${angle}deg, #FF6FA9 0%, #F85A9A 45%, #ffb3d9 100%)`;
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
    setError("");

    if (senha.length < 6) return setError("A senha deve ter pelo menos 6 caracteres.");
    if (senha !== confirmar) return setError("As senhas não coincidem.");

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);

    if (err) return setError("Erro ao redefinir senha. O link pode ter expirado.");
    setSuccess(true);
    setTimeout(() => navigate("/login"), 3000);
  };

  return (
    <div className="rp-root">
      <div ref={bgRef} className="rp-bg" />
      <div ref={glowRef} className="rp-glow" />

      <div className="rp-card">
        <div className="rp-logo-wrap">
          <img src="/assine.png" alt="Doonly" className="rp-logo" />
        </div>

        {success ? (
          <div className="rp-success">
            <div style={{ fontSize: "3rem" }}>✅</div>
            <h2>Senha redefinida!</h2>
            <p>Sua senha foi alterada com sucesso. Redirecionando para o login...</p>
          </div>
        ) : (
          <>
            <div className="rp-text">
              <h2>Redefinir senha</h2>
              <p>Digite sua nova senha abaixo.</p>
            </div>

            <form onSubmit={handleSubmit} className="rp-form">
              <div className="rp-field">
                <label>Nova senha</label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  required
                />
              </div>
              <div className="rp-field">
                <label>Confirmar senha</label>
                <input
                  type="password"
                  placeholder="Repita a senha"
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  required
                />
              </div>

              {error && <p className="rp-error">{error}</p>}

              <button type="submit" className="rp-btn" disabled={loading || !sessionOk}>
                {loading ? <span className="rp-spinner" /> : "Salvar nova senha"}
              </button>

              <button type="button" className="rp-back" onClick={() => navigate("/login")}>
                ← Voltar para o login
              </button>
            </form>
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        html, body, #root { height:100%; overflow:hidden; }
        .rp-root { height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; overflow:hidden; font-family:'Geist', sans-serif; padding:1.5rem; }
        .rp-bg { position:fixed; inset:0; z-index:0; background:var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A)); }
        .rp-glow { position:fixed; z-index:1; width:350px; height:350px; border-radius:50%; background:radial-gradient(circle,rgba(255,255,255,0.1) 0%,rgba(255,255,255,0) 70%); transform:translate(-50%,-50%); pointer-events:none; }
        .rp-card { position:relative; z-index:2; background:var(--bg-card, #FFFFFF); border-radius:16px; padding:2.5rem 2.2rem 2rem; width:calc(100% - 2.5rem); max-width:440px; box-shadow:0 8px 40px rgba(0,0,0,0.12); animation:rpSlide 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes rpSlide { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .rp-logo-wrap { display:flex; justify-content:center; margin-bottom:1.5rem; }
        .rp-logo { height:90px; object-fit:contain; }
        .rp-text { text-align:center; margin-bottom:1.5rem; }
        .rp-text h2 { font-size:1.2rem; font-weight:600; color:var(--text-title, #1F2937); margin-bottom:0.5rem; }
        .rp-text p { font-size:0.88rem; color:var(--text-secondary, #6B7280); line-height:1.5; }
        .rp-form { display:flex; flex-direction:column; gap:1rem; }
        .rp-field { display:flex; flex-direction:column; gap:0.35rem; }
        .rp-field label { font-size:0.88rem; font-weight:500; color:var(--text-primary, #374151); }
        .rp-field input { padding:0.72rem 1rem; border:1.5px solid var(--border, #E9E9EE); border-radius:8px; font-family:'Geist', sans-serif; font-size:0.95rem; color:var(--text-title, #1F2937); outline:none; transition:border-color 0.2s; width:100%; }
        .rp-field input:focus { border-color:var(--border-focus, #FF6FA9); }
        .rp-field input::placeholder { color:var(--text-muted, #9CA3AF); }
        .rp-error { background:#fff1f2; border:1px solid #fecdd3; color:var(--error, #EF4444); border-radius:8px; padding:0.6rem 0.9rem; font-size:0.85rem; }
        .rp-btn { padding:0.85rem; background:var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A)); color:var(--text-inverse, #FFFFFF); border:none; border-radius:8px; font-family:'Geist', sans-serif; font-size:1rem; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; min-height:48px; transition:opacity 0.2s; }
        .rp-btn:hover:not(:disabled) { opacity:0.9; }
        .rp-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .rp-back { background:none; border:none; color:var(--text-muted, #9CA3AF); font-family:'Geist', sans-serif; font-size:0.88rem; cursor:pointer; text-align:center; padding:0.25rem; }
        .rp-back:hover { color:var(--primary, #FF6FA9); }
        .rp-success { text-align:center; display:flex; flex-direction:column; gap:0.75rem; }
        .rp-success h2 { font-size:1.2rem; font-weight:600; color:var(--text-title, #1F2937); }
        .rp-success p { font-size:0.88rem; color:var(--text-secondary, #6B7280); line-height:1.5; }
        .rp-spinner { width:20px; height:20px; border:2px solid rgba(255,255,255,0.4); border-top-color:white; border-radius:50%; animation:rpspin 0.7s linear infinite; display:inline-block; }
        @keyframes rpspin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}

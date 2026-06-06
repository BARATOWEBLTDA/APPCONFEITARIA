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
  const [fading, setFading] = useState(false);
  const [showCadastro, setShowCadastro] = useState(false);

  const [cadastroLoading, setCadastroLoading] = useState(false);
  const [cadastroError, setCadastroError] = useState("");
  const [showCadastroSenha, setShowCadastroSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [cadastroForm, setCadastroForm] = useState({
    nome: "", telefone: "", email: "", senha: "", confirmarSenha: ""
  });

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const formatPhone = (value: string) => {
    const d = value.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.senha,
      });
      if (error) throw error;
      const userId = signInData.user?.id;
      const { data: prof } = await supabase.from("profiles").select("is_admin").eq("id", userId).single();
      const dest = prof?.is_admin === true ? "/admin" : "/inicio";
      setFading(true);
      setTimeout(() => navigate(dest), 700);
    } catch (err: any) {
      setError("E-mail ou senha incorretos. Tente novamente.");
      setLoading(false);
    }
  };

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setCadastroError("");
    if (!cadastroForm.nome.trim()) return setCadastroError("Informe seu nome.");
    if (!cadastroForm.email.trim()) return setCadastroError("Informe seu e-mail.");
    if (cadastroForm.senha.length < 6) return setCadastroError("A senha deve ter ao menos 6 caracteres.");
    if (cadastroForm.senha !== cadastroForm.confirmarSenha) return setCadastroError("As senhas não coincidem.");
    setCadastroLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cadastroForm.email,
        password: cadastroForm.senha,
        options: { data: { nome: cadastroForm.nome } }
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          nome: cadastroForm.nome,
          telefone: cadastroForm.telefone,
        }, { onConflict: "id" });
      }
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: cadastroForm.email,
        password: cadastroForm.senha,
      });
      if (loginError) throw loginError;
      setFading(true);
      setTimeout(() => navigate("/inicio"), 700);
    } catch (err: any) {
      setCadastroError(err.message || "Erro ao criar conta. Tente novamente.");
      setCadastroLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className={`fade-overlay ${fading ? "fade-in" : ""}`} />
      <div ref={bgRef} className="auth-bg" />
      <div ref={glowRef} className="mouse-glow" />

      <div className="auth-card">
        <div className="auth-logo-wrap">
          <img src="/logoapp.png" alt="Doonly" className="auth-logo-img" />
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label>E-mail</label>
            <input type="email" name="email" placeholder="Digite seu e-mail" value={form.email} onChange={handleChange} required
              style={{ backgroundColor: form.email ? "#fff0f6" : "white", borderColor: form.email ? "#ffb3d9" : "#e5e7eb" }} />
          </div>
          <div className="field">
            <label>Senha</label>
            <div className="password-wrap">
              <input type={showPassword ? "text" : "password"} name="senha" placeholder="Digite sua senha" value={form.senha} onChange={handleChange} required
                style={{ backgroundColor: form.senha ? "#fff0f6" : "white", borderColor: form.senha ? "#ffb3d9" : "#e5e7eb" }} />
              <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>
          <div className="login-bottom-row">
            <div className="keep-connected">
              <input type="checkbox" id="keep" checked={keepConnected} onChange={e => setKeepConnected(e.target.checked)} />
              <label htmlFor="keep">Manter conectado</label>
            </div>
            <a href="/esqueci-senha" className="forgot-link">Esqueci minha senha</a>
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="auth-btn" disabled={loading || fading}>
            {loading ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><span className="spinner" /> Entrando...</span> : "Entrar"}
          </button>
          <div className="cadastro-link-wrap">
            <span>Não tem conta? </span>
            <button type="button" className="cadastro-link" onClick={() => setShowCadastro(true)}>
              Cadastre-se grátis
            </button>
          </div>
        </form>
      </div>

      {showCadastro && (
        <div className="cadastro-overlay" onClick={e => e.target === e.currentTarget && setShowCadastro(false)}>
          <div className="cadastro-modal">
            <button className="cadastro-back" onClick={() => setShowCadastro(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div className="cadastro-logo-wrap">
              <img src="/logoapp.png" alt="Doonly" className="cadastro-logo" />
            </div>
            <form onSubmit={handleCadastro} className="cadastro-form">
              <div className="cad-field">
                <input type="text" placeholder="Nome" value={cadastroForm.nome} onChange={e => setCadastroForm({ ...cadastroForm, nome: e.target.value })} required />
                <svg className="cad-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div className="cad-field">
                <input type="tel" placeholder="Telefone" value={cadastroForm.telefone} onChange={e => setCadastroForm({ ...cadastroForm, telefone: formatPhone(e.target.value) })} />
                <svg className="cad-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.73a16 16 0 0 0 6.29 6.29l1.62-1.62a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </div>
              <div className="cad-field">
                <input type="email" placeholder="E-mail" value={cadastroForm.email} onChange={e => setCadastroForm({ ...cadastroForm, email: e.target.value })} required />
                <svg className="cad-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <div className="cad-field">
                <input type={showCadastroSenha ? "text" : "password"} placeholder="Senha" value={cadastroForm.senha} onChange={e => setCadastroForm({ ...cadastroForm, senha: e.target.value })} required />
                <button type="button" className="cad-eye" onClick={() => setShowCadastroSenha(!showCadastroSenha)}>
                  {showCadastroSenha
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
              <div className="cad-field">
                <input type={showConfirmarSenha ? "text" : "password"} placeholder="Confirmar Senha" value={cadastroForm.confirmarSenha} onChange={e => setCadastroForm({ ...cadastroForm, confirmarSenha: e.target.value })} required />
                <button type="button" className="cad-eye" onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}>
                  {showConfirmarSenha
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
              {cadastroError && <p className="auth-error">{cadastroError}</p>}
              <button type="submit" className="cad-btn" disabled={cadastroLoading}>
                {cadastroLoading ? <span className="spinner" /> : "Cadastrar"}
              </button>
              <div className="cadastro-link-wrap">
                <span>Já tem conta? </span>
                <button type="button" className="cadastro-link" onClick={() => setShowCadastro(false)}>Fazer login</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; }
        #root { height: 100%; }
        .auth-root { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; overflow: hidden; font-family: 'DM Sans', sans-serif; }
        .fade-overlay { position: fixed; inset: 0; z-index: 100; background: white; opacity: 0; pointer-events: none; transition: opacity 0.7s ease; }
        .fade-overlay.fade-in { opacity: 1; pointer-events: all; }
        .auth-bg { position: fixed; inset: 0; z-index: 0; background: linear-gradient(120deg, #f9007a 0%, #ff6eb4 45%, #ffb3d9 100%); }
        .mouse-glow { position: fixed; z-index: 1; width: 350px; height: 350px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%); transform: translate(-50%, -50%); pointer-events: none; }
        .auth-card { position: relative; z-index: 2; background: #ffffff; border-radius: 16px; padding: 2.5rem 2.2rem 2rem; width: calc(100% - 2.5rem); max-width: 440px; box-shadow: 0 8px 40px rgba(0,0,0,0.12); animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; margin: 0 auto; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .auth-logo-wrap { display: flex; justify-content: center; margin-bottom: 1.8rem; }
        .auth-logo-img { height: 110px; object-fit: contain; }
        .auth-form { display: flex; flex-direction: column; gap: 1rem; }
        .field { display: flex; flex-direction: column; gap: 0.35rem; }
        .field label { font-size: 0.88rem; font-weight: 500; color: #374151; }
        .field input { padding: 0.72rem 1rem; border: 1.5px solid #e5e7eb; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 0.95rem; color: #1f2937; outline: none; transition: background-color 0.2s, border-color 0.2s; width: 100%; }
        .field input:focus { border-color: #f9007a; }
        .field input::placeholder { color: #9ca3af; }
        .password-wrap { position: relative; }
        .password-wrap input { padding-right: 2.8rem; }
        .eye-btn { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #9ca3af; display: flex; align-items: center; padding: 0; }
        .eye-btn:hover { color: #f9007a; }
        .login-bottom-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: nowrap; gap: 0.5rem; }
        .keep-connected { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
        .keep-connected input[type="checkbox"] { accent-color: #f9007a; width: 15px; height: 15px; cursor: pointer; }
        .keep-connected label { font-size: 0.82rem; color: #374151; cursor: pointer; white-space: nowrap; }
        .forgot-link { font-size: 0.82rem; color: #f9007a; text-decoration: none; white-space: nowrap; font-weight: 500; }
        .forgot-link:hover { text-decoration: underline; }
        .auth-error { background: #fff1f2; border: 1px solid #fecdd3; color: #be123c; border-radius: 8px; padding: 0.6rem 0.9rem; font-size: 0.85rem; }
        .auth-btn { padding: 0.85rem; background: linear-gradient(135deg, #f9007a, #d4006a); color: white; border: none; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 1rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s, transform 0.15s; display: flex; align-items: center; justify-content: center; min-height: 48px; }
        .auth-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .auth-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .cadastro-link-wrap { text-align: center; font-size: 0.85rem; color: #6b7280; }
        .cadastro-link { background: none; border: none; color: #f9007a; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 0.85rem; text-decoration: underline; }
        .spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .cadastro-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.3); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .cadastro-modal { background: white; border-radius: 20px; width: 100%; max-width: 420px; max-height: 95vh; overflow-y: auto; padding: 2rem 2rem 2.5rem; position: relative; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
        .cadastro-back { position: absolute; top: 1.25rem; left: 1.25rem; width: 36px; height: 36px; border-radius: 50%; background: #f3f4f6; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #374151; transition: background 0.15s; }
        .cadastro-back:hover { background: #e5e7eb; }
        .cadastro-logo-wrap { display: flex; justify-content: center; margin-bottom: 1.75rem; margin-top: 0.5rem; }
        .cadastro-logo { height: 110px; object-fit: contain; }
        .cadastro-form { display: flex; flex-direction: column; gap: 0.9rem; }
        .cad-field { position: relative; display: flex; align-items: center; border: 1.5px solid #e5e7eb; border-radius: 50px; overflow: hidden; background: white; transition: border-color 0.2s; }
        .cad-field:focus-within { border-color: #f9007a; }
        .cad-field input { flex: 1; padding: 0.8rem 1.25rem; border: none; outline: none; font-family: 'DM Sans', sans-serif; font-size: 0.95rem; color: #1f2937; background: transparent; }
        .cad-field input::placeholder { color: #9ca3af; }
        .cad-icon { margin-right: 1rem; flex-shrink: 0; }
        .cad-eye { background: none; border: none; cursor: pointer; padding: 0 1rem 0 0; display: flex; align-items: center; color: #9ca3af; }
        .cad-btn { margin-top: 0.5rem; padding: 0.9rem; background: linear-gradient(135deg, #f9007a, #d4006a); color: white; border: none; border-radius: 50px; font-family: 'DM Sans', sans-serif; font-size: 1rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; min-height: 52px; letter-spacing: 0.5px; }
        .cad-btn:hover:not(:disabled) { opacity: 0.9; }
        .cad-btn:disabled { opacity: 0.7; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      const { data: prof } = await supabase.from("profiles").select("is_admin").eq("id", data.user.id).single();
      if (prof?.is_admin !== true) {
        await supabase.auth.signOut();
        setError("Acesso negado. Você não tem permissão de administrador.");
        setLoading(false);
        return;
      }
      navigate("/admin");
    } catch (err: any) {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
    }
  };

  return (
    <div className="adl-root">
      <div className="adl-card">
        <div className="adl-logo">
          <img src="/logoapp.png" alt="Doonly" style={{ height: "80px", objectFit: "contain" }} />
          <span className="adl-badge">Admin</span>
        </div>
        <h1 className="adl-title">Painel Administrativo</h1>
        <p className="adl-sub">Acesso restrito</p>

        <form onSubmit={handleSubmit} className="adl-form">
          <div className="adl-field">
            <label>E-mail</label>
            <input type="email" placeholder="admin@doonly.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="adl-field">
            <label>Senha</label>
            <input type="password" placeholder="••••••••" value={senha} onChange={e => setSenha(e.target.value)} required />
          </div>
          {error && <p className="adl-error">{error}</p>}
          <button type="submit" className="adl-btn" disabled={loading}>
            {loading ? <span className="adl-spinner" /> : "Entrar no painel"}
          </button>
        </form>

        <a href="/login" className="adl-back">← Voltar ao app</a>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .adl-root { min-height:100vh; display:flex; align-items:center; justify-content:center; background:#0f0f13; font-family:'Inter',sans-serif; padding:1rem; }
        .adl-card { background:#1a1a2e; border-radius:20px; padding:2.5rem 2rem; width:100%; max-width:400px; box-shadow:0 20px 60px rgba(0,0,0,0.4); border:1px solid rgba(249,0,122,0.15); }
        .adl-logo { display:flex; flex-direction:column; align-items:center; gap:0.5rem; margin-bottom:1.25rem; }
        .adl-badge { background:linear-gradient(135deg,#f9007a,#d4006a); color:white; font-size:0.7rem; font-weight:700; padding:0.2rem 0.8rem; border-radius:20px; letter-spacing:1px; }
        .adl-title { font-size:1.15rem; font-weight:700; color:white; margin:0 0 0.25rem; text-align:center; }
        .adl-sub { font-size:0.82rem; color:rgba(255,255,255,0.4); margin:0 0 1.75rem; text-align:center; }
        .adl-form { display:flex; flex-direction:column; gap:1rem; }
        .adl-field { display:flex; flex-direction:column; gap:0.35rem; }
        .adl-field label { font-size:0.82rem; font-weight:500; color:rgba(255,255,255,0.6); }
        .adl-field input { padding:0.75rem 1rem; background:rgba(255,255,255,0.06); border:1.5px solid rgba(255,255,255,0.1); border-radius:10px; font-family:'Inter',sans-serif; font-size:0.9rem; color:white; outline:none; transition:border-color 0.2s; }
        .adl-field input:focus { border-color:#f9007a; }
        .adl-field input::placeholder { color:rgba(255,255,255,0.25); }
        .adl-error { background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#fca5a5; border-radius:8px; padding:0.6rem 0.9rem; font-size:0.82rem; }
        .adl-btn { padding:0.9rem; background:linear-gradient(135deg,#f9007a,#d4006a); color:white; border:none; border-radius:10px; font-family:'Inter',sans-serif; font-size:0.95rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; min-height:48px; transition:opacity 0.2s; }
        .adl-btn:hover:not(:disabled) { opacity:0.9; }
        .adl-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .adl-spinner { width:20px; height:20px; border:2px solid rgba(255,255,255,0.3); border-top-color:white; border-radius:50%; animation:spin 0.7s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .adl-back { display:block; text-align:center; margin-top:1.25rem; font-size:0.82rem; color:rgba(255,255,255,0.35); text-decoration:none; transition:color 0.2s; }
        .adl-back:hover { color:rgba(255,255,255,0.6); }
      `}</style>
    </div>
  );
}

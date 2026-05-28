import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "register";

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    nome: "",
    nome_loja: "",
    email: "",
    senha: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.senha,
        });
        if (error) throw error;
        navigate("/dashboard");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.senha,
          options: {
            data: {
              nome: form.nome,
              nome_loja: form.nome_loja,
            },
          },
        });
        if (error) throw error;
        if (data.user) navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      {/* Fundo decorativo */}
      <div className="auth-bg">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="dots-pattern" />
      </div>

      {/* Card central */}
      <div className="auth-card">
        {/* Logo / Header */}
        <div className="auth-header">
          <div className="auth-logo">🐼</div>
          <h1 className="auth-title">Panda Menu</h1>
          <p className="auth-subtitle">
            {mode === "login"
              ? "Bem-vinda de volta! 🎂"
              : "Crie sua conta grátis 🎉"}
          </p>
        </div>

        {/* Toggle login / cadastro */}
        <div className="auth-toggle">
          <button
            className={`toggle-btn ${mode === "login" ? "active" : ""}`}
            onClick={() => { setMode("login"); setError(""); }}
            type="button"
          >
            Entrar
          </button>
          <button
            className={`toggle-btn ${mode === "register" ? "active" : ""}`}
            onClick={() => { setMode("register"); setError(""); }}
            type="button"
          >
            Cadastrar
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" && (
            <>
              <div className="field">
                <label>Seu nome</label>
                <input
                  type="text"
                  name="nome"
                  placeholder="Ex: Ana Paula"
                  value={form.nome}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="field">
                <label>Nome da sua confeitaria</label>
                <input
                  type="text"
                  name="nome_loja"
                  placeholder="Ex: Doces da Ana"
                  value={form.nome_loja}
                  onChange={handleChange}
                  required
                />
              </div>
            </>
          )}

          <div className="field">
            <label>E-mail</label>
            <input
              type="email"
              name="email"
              placeholder="seu@email.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="field">
            <label>Senha</label>
            <input
              type="password"
              name="senha"
              placeholder="••••••••"
              value={form.senha}
              onChange={handleChange}
              required
              minLength={6}
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? (
              <span className="spinner" />
            ) : mode === "login" ? (
              "Entrar na minha conta"
            ) : (
              "Criar minha conta"
            )}
          </button>
        </form>

        {mode === "login" && (
          <p className="auth-footer">
            Ainda não tem conta?{" "}
            <button onClick={() => setMode("register")} className="link-btn">
              Cadastre-se grátis
            </button>
          </p>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:wght@300;400;500&display=swap');

        .auth-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: #fff0f5;
          font-family: 'DM Sans', sans-serif;
          padding: 1rem;
        }

        /* Blobs decorativos */
        .auth-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; }

        .blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          opacity: 0.35;
        }
        .blob-1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, #f9a8d4, #fbcfe8);
          top: -150px; left: -100px;
          animation: float1 8s ease-in-out infinite;
        }
        .blob-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, #fda4af, #fecdd3);
          bottom: -100px; right: -80px;
          animation: float2 10s ease-in-out infinite;
        }
        .blob-3 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, #e879a0, #f9a8d4);
          top: 40%; left: 60%;
          animation: float1 12s ease-in-out infinite reverse;
        }

        .dots-pattern {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, #f9a8d4 1px, transparent 1px);
          background-size: 28px 28px;
          opacity: 0.2;
        }

        @keyframes float1 {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(20px) scale(0.97); }
        }

        /* Card */
        .auth-card {
          position: relative;
          z-index: 1;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(249, 168, 212, 0.4);
          border-radius: 28px;
          padding: 2.5rem 2rem;
          width: 100%;
          max-width: 420px;
          box-shadow:
            0 4px 24px rgba(236, 72, 153, 0.1),
            0 1px 4px rgba(236, 72, 153, 0.08);
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Header */
        .auth-header { text-align: center; margin-bottom: 1.5rem; }
        .auth-logo { font-size: 2.8rem; margin-bottom: 0.25rem; }
        .auth-title {
          font-family: 'Playfair Display', serif;
          font-size: 2rem;
          font-weight: 700;
          color: #be185d;
          margin: 0;
          letter-spacing: -0.5px;
        }
        .auth-subtitle {
          color: #9d174d;
          font-size: 0.95rem;
          margin: 0.25rem 0 0;
          font-weight: 300;
        }

        /* Toggle */
        .auth-toggle {
          display: flex;
          background: #fce7f3;
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 1.5rem;
          gap: 4px;
        }
        .toggle-btn {
          flex: 1;
          padding: 0.5rem;
          border: none;
          border-radius: 9px;
          background: transparent;
          color: #9d174d;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .toggle-btn.active {
          background: white;
          color: #be185d;
          box-shadow: 0 1px 6px rgba(190, 24, 93, 0.15);
        }

        /* Form */
        .auth-form { display: flex; flex-direction: column; gap: 1rem; }

        .field { display: flex; flex-direction: column; gap: 0.35rem; }
        .field label {
          font-size: 0.82rem;
          font-weight: 500;
          color: #9d174d;
          letter-spacing: 0.3px;
        }
        .field input {
          padding: 0.7rem 1rem;
          border: 1.5px solid #fbcfe8;
          border-radius: 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem;
          color: #1f2937;
          background: white;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }
        .field input:focus {
          border-color: #ec4899;
          box-shadow: 0 0 0 3px rgba(236, 72, 153, 0.1);
        }
        .field input::placeholder { color: #d1d5db; }

        /* Error */
        .auth-error {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #be123c;
          border-radius: 10px;
          padding: 0.6rem 0.9rem;
          font-size: 0.85rem;
          margin: 0;
        }

        /* Botão principal */
        .auth-btn {
          margin-top: 0.25rem;
          padding: 0.85rem;
          background: linear-gradient(135deg, #ec4899, #be185d);
          color: white;
          border: none;
          border-radius: 14px;
          font-family: 'DM Sans', sans-serif;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          box-shadow: 0 4px 14px rgba(236, 72, 153, 0.35);
        }
        .auth-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
        }
        .auth-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        /* Spinner */
        .spinner {
          width: 20px; height: 20px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Footer */
        .auth-footer {
          text-align: center;
          margin-top: 1.25rem;
          font-size: 0.88rem;
          color: #9ca3af;
        }
        .link-btn {
          background: none;
          border: none;
          color: #ec4899;
          font-weight: 500;
          cursor: pointer;
          font-size: inherit;
          font-family: inherit;
          padding: 0;
        }
        .link-btn:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
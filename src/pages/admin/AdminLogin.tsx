import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, WarningCircle } from "@phosphor-icons/react";
import { Botao, Campo } from "@/components/base";

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
      const ADMIN_EMAILS = ["gestao@doonly.com.br"];

      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;

      if (!ADMIN_EMAILS.includes(data.user.email || "")) {
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
    <div className="al-root">
      <div className="al-card">
        <div className="al-logo">
          <img src="/logoapp.png" alt="Doonly" />
          <span className="al-badge">Admin</span>
        </div>
        <h1 className="al-h1">Painel administrativo</h1>
        <p className="al-sub">Acesso restrito à equipe Doonly.</p>

        <form onSubmit={handleSubmit} className="al-form">
          <Campo
            rotulo="E-mail" type="email" autoComplete="email" inputMode="email"
            placeholder="admin@doonly.com" value={email} onChange={e => setEmail(e.target.value)} required
          />
          <Campo
            rotulo="Senha" type="password" autoComplete="current-password"
            placeholder="Sua senha" value={senha} onChange={e => setSenha(e.target.value)} required
          />
          {error && (
            <p className="al-erro" role="alert">
              <WarningCircle size={18} weight="bold" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
          <Botao type="submit" cheio carregando={loading}>{loading ? "Entrando…" : "Entrar no painel"}</Botao>
        </form>

        <a href="/login" className="al-voltar">
          <ArrowLeft size={16} weight="bold" aria-hidden="true" /> Voltar ao app
        </a>
      </div>

      <style>{`
        .al-root { min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 16px; background: var(--ui-vinho-escuro, #2C1219); font-family: var(--font-base); }
        .al-card { width: 100%; max-width: 400px; padding: 32px 20px 20px; background: var(--ui-branco); border-radius: var(--ui-raio-janela, 24px); box-shadow: var(--ui-sombra-janela); color: var(--ui-texto); }
        .al-logo { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 16px; }
        .al-logo img { height: 72px; max-width: 100%; object-fit: contain; }
        .al-badge { padding: 2px 10px; border-radius: 999px; background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); font-size: 13px; font-weight: 700; }
        .al-h1 { margin: 0; text-align: center; font-size: 22px; font-weight: 800; color: var(--ui-texto); }
        .al-sub { margin: 4px 0 24px; text-align: center; font-size: 15px; font-weight: 500; color: var(--ui-texto-2); }
        .al-form { display: flex; flex-direction: column; gap: 16px; }
        .al-erro { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 12px; border-radius: var(--ui-raio); background: var(--ui-vermelho-fundo); color: var(--ui-vermelho-escuro); font-size: 14px; font-weight: 500; line-height: 1.4; }
        .al-erro svg { flex: none; margin-top: 1px; }
        .al-voltar { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; margin-top: 12px; border-radius: var(--ui-raio); font-size: 14px; font-weight: 700; color: var(--ui-texto-2); text-decoration: none; }
        .al-voltar:hover { color: var(--ui-texto); background: var(--ui-cinza); }
        @media (min-width: 600px) { .al-card { padding: 40px 32px 24px; } }
      `}</style>
    </div>
  );
}

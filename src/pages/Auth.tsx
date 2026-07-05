import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { User, Phone, Envelope, Eye, EyeSlash } from "@phosphor-icons/react";

// ───────────────────────────────────────────────────────────────
// Card promocional desktop (≥1200px). Mobile NÃO renderiza.
// TODO: trocar PLAY_STORE_URL quando o app for publicado.
// Enquanto for "#", o QR aponta pra landing como fallback.
// ───────────────────────────────────────────────────────────────
const PLAY_STORE_URL = "https://google.com";
const APP_STORE_URL = "https://google.com";
const QR_TARGET = "https://google.com";
const QR_IMG_SRC = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&bgcolor=ffffff&color=3d1a24&data=${encodeURIComponent(QR_TARGET)}`;

// ───────────────────────────────────────────────────────────────
// Validadores puros — reutilizáveis, testáveis
// ───────────────────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validate = {
  nome: (v: string) => (v.trim().length < 2 ? "Informe seu nome" : ""),
  email: (v: string) => {
    const trimmed = v.trim();
    if (!trimmed) return "Informe seu e-mail";
    if (!trimmed.includes("@")) return "Está faltando o @ no seu e-mail";
    const [local, domain] = trimmed.split("@");
    if (!local) return "Digite algo antes do @";
    if (!domain || !domain.includes(".")) return "E-mail incompleto (ex: nome@gmail.com)";
    if (!EMAIL_REGEX.test(trimmed)) return "E-mail em formato inválido";
    return "";
  },
  telefone: (v: string) => {
    if (!v.trim()) return "";
    const d = v.replace(/\D/g, "");
    if (d.length !== 10 && d.length !== 11) return "Telefone incompleto";
    return "";
  },
  senha: (v: string) => {
    if (v.length < 6) return "Mínimo 6 caracteres";
    if (!/[a-zA-Z]/.test(v)) return "A senha precisa ter ao menos uma letra";
    if (!/\d/.test(v)) return "A senha precisa ter ao menos um número";
    return "";
  },
};

// Requisitos da senha: retorna quais critérios foram atendidos.
// Substitui o antigo medidor de força por uma lista de checagem — mais claro,
// sem "julgar" o usuário, e alinhado com a regra do produto (6+ chars, letra, número).
const getPasswordChecks = (senha: string) => ({
  length: senha.length >= 6,
  letter: /[a-zA-Z]/.test(senha),
  number: /\d/.test(senha),
});

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepConnected, setKeepConnected] = useState(false);
  const [form, setForm] = useState({ email: "", senha: "" });
  const [fading, setFading] = useState(false);
  const [showCadastro, setShowCadastro] = useState(false);

  // ── Login: validação inline (só email) ─────────────────────
  const [loginEmailError, setLoginEmailError] = useState("");
  const [loginEmailTouched, setLoginEmailTouched] = useState(false);

  // ── Cadastro ───────────────────────────────────────────────
  const [cadastroLoading, setCadastroLoading] = useState(false);
  const [cadastroError, setCadastroError] = useState("");
  const [showCadastroSenha, setShowCadastroSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [cadastroForm, setCadastroForm] = useState({
    nome: "", telefone: "", email: "", senha: "", confirmarSenha: ""
  });
  const [cadastroErrors, setCadastroErrors] = useState<Record<string, string>>({});
  const [cadastroTouched, setCadastroTouched] = useState<Record<string, boolean>>({});

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

  // ── LOGIN handlers ─────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
    if (e.target.name === "email" && loginEmailTouched) {
      setLoginEmailError(validate.email(e.target.value));
    }
  };

  const handleLoginEmailBlur = () => {
    setLoginEmailTouched(true);
    setLoginEmailError(validate.email(form.email));
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
    const emailErr = validate.email(form.email);
    if (emailErr) {
      setLoginEmailTouched(true);
      setLoginEmailError(emailErr);
      return;
    }
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
      // Se email não foi confirmado, oferece ação de reenviar
      const msg = err?.message || "";
      if (/email not confirmed|email_not_confirmed/i.test(msg)) {
        setError("Você ainda não confirmou seu e-mail. Verifique sua caixa de entrada ou clique em cadastrar para reenviar.");
      } else {
        setError("E-mail ou senha incorretos. Tente novamente.");
      }
      setLoading(false);
    }
  };

  // ── CADASTRO handlers ──────────────────────────────────────
  const handleCadastroChange = (field: keyof typeof cadastroForm, rawValue: string) => {
    const value = field === "telefone" ? formatPhone(rawValue) : rawValue;
    const nextForm = { ...cadastroForm, [field]: value };
    setCadastroForm(nextForm);
    setCadastroError("");

    // Se o campo já foi tocado, revalida em tempo real
    if (cadastroTouched[field]) {
      const validator = validate[field as keyof typeof validate];
      if (validator) {
        setCadastroErrors(prev => ({ ...prev, [field]: validator(value) }));
      }
    }

    // Confirmação de senha: revalida sempre que senha OU confirmação mudam
    if (field === "senha" && cadastroTouched.confirmarSenha) {
      const confErr = nextForm.confirmarSenha && nextForm.confirmarSenha !== value ? "As senhas digitadas não são iguais" : "";
      setCadastroErrors(prev => ({ ...prev, confirmarSenha: confErr }));
    }
    if (field === "confirmarSenha" && cadastroTouched.confirmarSenha) {
      const confErr = value && value !== nextForm.senha ? "As senhas digitadas não são iguais" : "";
      setCadastroErrors(prev => ({ ...prev, confirmarSenha: confErr }));
    }
  };

  const handleCadastroBlur = (field: keyof typeof cadastroForm) => {
    setCadastroTouched(prev => ({ ...prev, [field]: true }));
    if (field === "confirmarSenha") {
      const confErr = cadastroForm.confirmarSenha && cadastroForm.confirmarSenha !== cadastroForm.senha
        ? "As senhas digitadas não são iguais" : "";
      setCadastroErrors(prev => ({ ...prev, confirmarSenha: confErr }));
      return;
    }
    const validator = validate[field as keyof typeof validate];
    if (validator) {
      setCadastroErrors(prev => ({ ...prev, [field]: validator(cadastroForm[field]) }));
    }
  };

  const passwordChecks = getPasswordChecks(cadastroForm.senha);

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setCadastroError("");

    // Roda todos os validators antes de submeter
    const nextErrors: Record<string, string> = {
      nome: validate.nome(cadastroForm.nome),
      email: validate.email(cadastroForm.email),
      telefone: validate.telefone(cadastroForm.telefone),
      senha: validate.senha(cadastroForm.senha),
      confirmarSenha: cadastroForm.confirmarSenha !== cadastroForm.senha ? "As senhas digitadas não são iguais" : "",
    };
    setCadastroErrors(nextErrors);
    setCadastroTouched({ nome: true, email: true, telefone: true, senha: true, confirmarSenha: true });

    const hasError = Object.values(nextErrors).some(e => e);
    if (hasError) return;

    setCadastroLoading(true);
    try {
      // ── 1) Cria a conta ─────────────────────────────────────
      // Passa nome/telefone como user_metadata. Trigger no Postgres
      // (handle_new_user) cria row em public.profiles automaticamente.
      // Como "Confirm email" está OFF no dashboard, signUp retorna sessão imediata.
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: cadastroForm.email,
        password: cadastroForm.senha,
        options: {
          data: {
            nome: cadastroForm.nome,
            telefone: cadastroForm.telefone,
          },
        }
      });
      if (error) throw error;

      // ── 2) Garante sessão (login automático) ────────────────
      // Em raros casos o signUp retorna user mas não sessão. Fallback:
      // chama signInWithPassword para garantir que a confeiteira entra.
      if (!signUpData.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cadastroForm.email,
          password: cadastroForm.senha,
        });
        if (signInError) throw signInError;
      }

      // ── 3) Dispara e-mail de boas-vindas (fire-and-forget) ──
      // Não bloqueia a UX. Se falhar, o cadastro segue normal.
      // A Edge Function tem dedup, então chamadas duplicadas são seguras.
      supabase.functions.invoke("send-welcome-email").catch((err) => {
        // Log silencioso; não interrompe fluxo do usuário
        console.warn("welcome email failed:", err);
      });

      // ── 4) Redireciona para o app ───────────────────────────
      setFading(true);
      setTimeout(() => navigate("/inicio"), 700);
    } catch (err: any) {
      // Tradução amigável dos erros mais comuns do Supabase
      const msg = err?.message || "";
      if (/already registered|already exists|user already/i.test(msg)) {
        setCadastroError("Este e-mail já tem cadastro. Faça login.");
      } else if (/password/i.test(msg)) {
        setCadastroError("Senha inválida. Use ao menos 6 caracteres.");
      } else if (/valid email|invalid email/i.test(msg)) {
        setCadastroError("E-mail em formato inválido.");
      } else if (/rate limit|too many/i.test(msg)) {
        setCadastroError("Muitas tentativas. Aguarde 1 minuto e tente novamente.");
      } else {
        setCadastroError("Erro ao criar conta. Tente novamente.");
      }
      setCadastroLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className={`fade-overlay ${fading ? "fade-in" : ""}`} />
      <div ref={bgRef} className="auth-bg" />
      <div ref={glowRef} className="mouse-glow" />

      <div className="auth-layout">
      {!showCadastro ? (
      <div className="auth-card">
        <div className="auth-logo-wrap">
          <img src="/cadastro.png" alt="Doonly" className="auth-logo-img" />
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="field">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              type="email"
              name="email"
              placeholder="Digite seu e-mail"
              value={form.email}
              onChange={handleChange}
              onBlur={handleLoginEmailBlur}
              required
              autoComplete="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              aria-invalid={!!loginEmailError}
              style={{
                backgroundColor: form.email ? "var(--primary-light)" : "var(--bg-card)",
                borderColor: loginEmailError ? "var(--error)" : (form.email ? "var(--primary-light)" : "var(--border)")
              }}
            />
            {loginEmailError && <span className="field-error">{loginEmailError}</span>}
          </div>
          <div className="field">
            <label htmlFor="login-senha">Senha</label>
            <div className="password-wrap">
              <input
                id="login-senha"
                type={showPassword ? "text" : "password"}
                name="senha"
                placeholder="Digite sua senha"
                value={form.senha}
                onChange={handleChange}
                required
                autoComplete="current-password"
                enterKeyHint="done"
                style={{ backgroundColor: form.senha ? "var(--primary-light)" : "var(--bg-card)", borderColor: form.senha ? "var(--primary-light)" : "var(--border)" }}
              />
              <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                {showPassword ? <EyeSlash size={18} weight="regular" /> : <Eye size={18} weight="regular" />}
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

          <div className="auth-divider"><span>ou</span></div>

          <button type="button" className="google-btn" onClick={async () => {
            await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: window.location.origin + '/inicio' }
            })
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Entrar com Google
          </button>
          <div className="cadastro-link-wrap">
            <span>Não tem conta? </span>
            <button type="button" className="cadastro-link" onClick={() => setShowCadastro(true)}>
              Cadastre-se grátis
            </button>
          </div>
        </form>
      </div>
      ) : (
      <div className="auth-card">
        <div className="cad-header">
          <h1 className="cad-title">Crie sua conta grátis</h1>
          <p className="cad-subtitle">Gerencie sua confeitaria de forma profissional</p>
        </div>
        <form onSubmit={handleCadastro} className="cadastro-form" noValidate>
          {/* Nome */}
          <div className="cad-field-wrap">
            <div className={`cad-field ${cadastroTouched.nome && cadastroErrors.nome ? "has-error" : ""}`}>
              <input
                type="text"
                placeholder="Nome"
                value={cadastroForm.nome}
                onChange={e => handleCadastroChange("nome", e.target.value)}
                onBlur={() => handleCadastroBlur("nome")}
                required
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                aria-invalid={!!(cadastroTouched.nome && cadastroErrors.nome)}
              />
              <User className="cad-icon" size={20} weight="regular" />
            </div>
            {cadastroTouched.nome && cadastroErrors.nome && (
              <span className="cad-error">{cadastroErrors.nome}</span>
            )}
          </div>

          {/* Telefone */}
          <div className="cad-field-wrap">
            <div className={`cad-field ${cadastroTouched.telefone && cadastroErrors.telefone ? "has-error" : ""}`}>
              <input
                type="tel"
                placeholder="Telefone"
                value={cadastroForm.telefone}
                onChange={e => handleCadastroChange("telefone", e.target.value)}
                onBlur={() => handleCadastroBlur("telefone")}
                autoComplete="tel"
                inputMode="tel"
                enterKeyHint="next"
                aria-invalid={!!(cadastroTouched.telefone && cadastroErrors.telefone)}
              />
              <Phone className="cad-icon" size={20} weight="regular" />
            </div>
            {cadastroTouched.telefone && cadastroErrors.telefone && (
              <span className="cad-error">{cadastroErrors.telefone}</span>
            )}
          </div>

          {/* E-mail */}
          <div className="cad-field-wrap">
            <div className={`cad-field ${cadastroTouched.email && cadastroErrors.email ? "has-error" : ""}`}>
              <input
                type="email"
                placeholder="E-mail"
                value={cadastroForm.email}
                onChange={e => handleCadastroChange("email", e.target.value)}
                onBlur={() => handleCadastroBlur("email")}
                required
                autoComplete="email"
                inputMode="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                aria-invalid={!!(cadastroTouched.email && cadastroErrors.email)}
              />
              <Envelope className="cad-icon" size={20} weight="regular" />
            </div>
            {cadastroTouched.email && cadastroErrors.email && (
              <span className="cad-error">{cadastroErrors.email}</span>
            )}
          </div>

          {/* Senha */}
          <div className="cad-field-wrap">
            <div className={`cad-field ${cadastroTouched.senha && cadastroErrors.senha ? "has-error" : ""}`}>
              <input
                type={showCadastroSenha ? "text" : "password"}
                placeholder="Senha"
                value={cadastroForm.senha}
                onChange={e => handleCadastroChange("senha", e.target.value)}
                onBlur={() => handleCadastroBlur("senha")}
                required
                autoComplete="new-password"
                enterKeyHint="next"
                aria-invalid={!!(cadastroTouched.senha && cadastroErrors.senha)}
              />
              <button
                type="button"
                className="cad-eye"
                onClick={() => setShowCadastroSenha(!showCadastroSenha)}
                aria-label={showCadastroSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {showCadastroSenha ? <EyeSlash size={20} weight="regular" /> : <Eye size={20} weight="regular" />}
              </button>
            </div>
            {cadastroForm.senha && (
              passwordChecks.length && passwordChecks.letter && passwordChecks.number ? (
                <div className="pw-req-done" role="status" aria-live="polite">
                  <span className="pw-req-dot" aria-hidden="true">✓</span>
                  Senha forte
                </div>
              ) : (
                <ul className="pw-req" aria-label="Requisitos da senha">
                  <li className={passwordChecks.length ? "ok" : ""}>
                    <span className="pw-req-dot" aria-hidden="true">{passwordChecks.length ? "✓" : "•"}</span>
                    6 caracteres ou mais
                  </li>
                  <li className={passwordChecks.letter ? "ok" : ""}>
                    <span className="pw-req-dot" aria-hidden="true">{passwordChecks.letter ? "✓" : "•"}</span>
                    1 letra
                  </li>
                  <li className={passwordChecks.number ? "ok" : ""}>
                    <span className="pw-req-dot" aria-hidden="true">{passwordChecks.number ? "✓" : "•"}</span>
                    1 número
                  </li>
                </ul>
              )
            )}
            {cadastroTouched.senha && cadastroErrors.senha && !cadastroForm.senha && (
              <span className="cad-error">{cadastroErrors.senha}</span>
            )}
          </div>

          {/* Confirmar Senha */}
          <div className="cad-field-wrap">
            <div className={`cad-field ${cadastroTouched.confirmarSenha && cadastroErrors.confirmarSenha ? "has-error" : ""}`}>
              <input
                type={showConfirmarSenha ? "text" : "password"}
                placeholder="Confirmar Senha"
                value={cadastroForm.confirmarSenha}
                onChange={e => handleCadastroChange("confirmarSenha", e.target.value)}
                onBlur={() => handleCadastroBlur("confirmarSenha")}
                required
                autoComplete="new-password"
                enterKeyHint="done"
                aria-invalid={!!(cadastroTouched.confirmarSenha && cadastroErrors.confirmarSenha)}
              />
              <button
                type="button"
                className="cad-eye"
                onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                aria-label={showConfirmarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {showConfirmarSenha ? <EyeSlash size={20} weight="regular" /> : <Eye size={20} weight="regular" />}
              </button>
            </div>
            {cadastroTouched.confirmarSenha && cadastroErrors.confirmarSenha && (
              <span className="cad-error">{cadastroErrors.confirmarSenha}</span>
            )}
          </div>

          {cadastroError && (
            cadastroError.includes("já tem cadastro") ? (
              <div className="auth-alert-soft" role="alert">
                <span className="auth-alert-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </span>
                <div className="auth-alert-body">
                  <strong>Este e-mail já tem cadastro.</strong>
                  <button
                    type="button"
                    className="auth-alert-link"
                    onClick={() => {
                      setCadastroError("");
                      setForm({ email: cadastroForm.email, senha: "" });
                      setShowCadastro(false);
                    }}
                  >
                    Fazer login →
                  </button>
                </div>
              </div>
            ) : (
              <p className="auth-error">{cadastroError}</p>
            )
          )}
          <button type="submit" className="cad-btn" disabled={cadastroLoading}>
            {cadastroLoading ? <span className="spinner" /> : "Cadastrar"}
          </button>
          <div className="auth-divider"><span>ou</span></div>
          <button type="button" className="google-btn" onClick={async () => {
            await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: window.location.origin + '/inicio' }
            })
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Cadastrar com Google
          </button>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.5', margin: '0' }}>
            Ao criar sua conta, você concorda com nossos{' '}
            <a href="/termos" target="_blank" style={{ color: 'var(--primary)', fontWeight: 600 }}>Termos de Uso</a>
            {' '}e{' '}
            <a href="/privacidade" target="_blank" style={{ color: 'var(--primary)', fontWeight: 600 }}>Política de Privacidade</a>
          </p>
          <div className="cadastro-link-wrap">
            <span>Já tem conta? </span>
            <button type="button" className="cadastro-link" onClick={() => setShowCadastro(false)}>Fazer login</button>
          </div>
        </form>
      </div>
      )}

      {/* Promo card — só aparece em desktop ≥1200px (controlado por CSS) */}
      <aside className="auth-promo" aria-label="Doonly no celular">
        <div className="auth-promo-head">
          <div className="auth-promo-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2.5" />
              <line x1="12" y1="18" x2="12" y2="18" />
            </svg>
          </div>
          <h2>Doonly no seu celular</h2>
        </div>

        <p className="auth-promo-text">
          Gerencie pedidos, agenda, receitas e precificação onde você estiver.
        </p>

        <p className="auth-promo-cta">Baixe agora gratuitamente</p>

        <div className="auth-promo-stores">
          <a
            href={APP_STORE_URL}
            className="auth-promo-store"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="20" height="24" viewBox="0 0 20 24" aria-hidden="true">
              <path fill="white" d="M16.52 12.46c-.03-2.85 2.33-4.22 2.44-4.29-1.33-1.94-3.4-2.21-4.14-2.24-1.76-.18-3.43 1.04-4.33 1.04-.89 0-2.27-1.01-3.73-.99-1.92.03-3.69 1.12-4.68 2.84-2 3.46-.51 8.59 1.43 11.4.95 1.38 2.09 2.92 3.58 2.87 1.43-.06 1.98-.93 3.71-.93 1.74 0 2.23.93 3.75.9 1.55-.03 2.53-1.4 3.47-2.78 1.1-1.6 1.55-3.14 1.57-3.22-.03-.01-3.02-1.16-3.07-4.6zM13.67 3.88C14.45 2.94 14.97 1.64 14.82.32c-1.13.05-2.5.75-3.31 1.7-.73.84-1.37 2.18-1.19 3.47 1.26.1 2.54-.64 3.35-1.61z"/>
            </svg>
            <span className="auth-promo-store-labels">
              <span className="auth-promo-store-small">DISPONÍVEL NA</span>
              <span className="auth-promo-store-big">App Store</span>
            </span>
          </a>

          <a
            href={PLAY_STORE_URL}
            className="auth-promo-store"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#00D4FF"  d="M3.6 1.3C3.2 1.6 3 2.1 3 2.7v18.6c0 .6.2 1.1.6 1.4l10.7-10.7L3.6 1.3z" />
              <path fill="#FFD500" d="M17.9 8.9l-3.6 3.1 3.6 3.1 4-2.3c1.2-.7 1.2-2.5 0-3.2l-4-2.7z" />
              <path fill="#FF3D00" d="M14.3 12L3.6 1.3c.2-.1.4-.2.6-.2.3 0 .6.1.9.3l13.3 7.5L14.3 12z" />
              <path fill="#00C853" d="M14.3 12l4.1 4.1L5.1 23.6c-.3.2-.6.3-.9.3-.2 0-.4-.1-.6-.2L14.3 12z" />
            </svg>
            <span className="auth-promo-store-labels">
              <span className="auth-promo-store-small">DISPONÍVEL NO</span>
              <span className="auth-promo-store-big">Google Play</span>
            </span>
          </a>
        </div>

        <div className="auth-promo-divider">
          <span>ou aponte a câmera</span>
        </div>

        <div className="auth-promo-qr">
          <img src={QR_IMG_SRC} alt="QR Code para baixar o Doonly" loading="lazy" />
        </div>
      </aside>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; }
        #root { height: 100%; overflow-y: auto; }
        .auth-root { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; font-family: inherit; padding: 1.5rem; overflow: visible; }
        .auth-layout { position: relative; z-index: 2; width: 100%; max-width: 440px; display: flex; flex-direction: column; }
        .fade-overlay { position: fixed; inset: 0; z-index: 100; background: var(--bg-card); opacity: 0; pointer-events: none; transition: opacity 0.7s ease; }
        .fade-overlay.fade-in { opacity: 1; pointer-events: all; }
        .auth-bg { position: fixed; inset: 0; z-index: 0; background: var(--primary-gradient); }
        .mouse-glow { position: fixed; z-index: 1; width: 350px; height: 350px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%); transform: translate(-50%, -50%); pointer-events: none; }
        .auth-card { position: relative; z-index: 2; background: var(--bg-card); border-radius: var(--radius-lg); padding: 2rem 1.75rem; width: 100%; max-width: 440px; box-shadow: 0 8px 40px rgba(0,0,0,0.12); animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; margin: 1rem auto; overflow-y: auto; max-height: calc(100vh - 2rem); }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes promoFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .auth-logo-wrap { display: flex; justify-content: center; margin-bottom: 1.8rem; }
        .auth-logo-img { height: 110px; object-fit: contain; }
        .auth-form { display: flex; flex-direction: column; gap: 1rem; }
        .field { display: flex; flex-direction: column; gap: 0.35rem; }
        .field label { font-size: var(--font-button); font-weight: var(--fw-medium); color: var(--text-primary); }
        .field input { padding: 0.72rem 1rem; border: 1.5px solid var(--border); border-radius: var(--radius-sm); font-family: inherit; font-size: var(--font-input); color: var(--text-title); outline: none; transition: background-color 0.2s, border-color 0.2s; width: 100%; }
        .field input:focus { border-color: var(--border-focus); }
        .field input::placeholder { color: var(--text-muted); }
        .field-error { font-size: 0.75rem; color: var(--error); padding-left: 0.25rem; }
        .password-wrap { position: relative; }
        .password-wrap input { padding-right: 2.8rem; }
        .eye-btn { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; padding: 0; }
        .eye-btn:hover { color: var(--primary); }
        .login-bottom-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: nowrap; gap: 0.5rem; }
        .keep-connected { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
        .keep-connected input[type="checkbox"] { accent-color: var(--primary); width: 15px; height: 15px; cursor: pointer; }
        .keep-connected label { font-size: var(--font-helper); color: var(--text-primary); cursor: pointer; white-space: nowrap; }
        .forgot-link { font-size: var(--font-helper); color: var(--primary); text-decoration: none; white-space: nowrap; font-weight: var(--fw-medium); }
        .forgot-link:hover { text-decoration: underline; }
        .auth-error { background: #fff1f2; border: 1px solid #fecdd3; color: var(--error); border-radius: var(--radius-sm); padding: 0.6rem 0.9rem; font-size: var(--font-button); }
        .auth-btn { padding: 0.85rem; background: var(--primary-gradient); color: var(--text-inverse); border: none; border-radius: var(--radius-sm); font-family: inherit; font-size: var(--font-input); font-weight: var(--fw-semibold); cursor: pointer; transition: opacity 0.2s, transform 0.15s; display: flex; align-items: center; justify-content: center; min-height: 48px; }
        .auth-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .auth-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .cadastro-link-wrap { text-align: center; font-size: var(--font-button); color: var(--text-secondary); }
        .cadastro-link { background: none; border: none; color: var(--primary); font-weight: var(--fw-semibold); cursor: pointer; font-family: inherit; font-size: var(--font-button); text-decoration: underline; }
        .spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .auth-divider { display: flex; align-items: center; gap: 0.75rem; color: var(--border); font-size: var(--font-helper); }
        .auth-divider::before, .auth-divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
        .google-btn { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 0.75rem; background: var(--bg-card); color: var(--text-primary); border: 1.5px solid var(--border); border-radius: var(--radius-sm); font-family: inherit; font-size: var(--font-input); font-weight: var(--fw-medium); cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s; width: 100%; }
        .google-btn:hover { border-color: var(--text-muted); box-shadow: 0 1px 4px rgba(0,0,0,0.08); }

        /* ── Cadastro ─────────────────────────────────────── */
        .cadastro-form { display: flex; flex-direction: column; gap: 0.75rem; padding-top: 0.5rem; }
        .cad-field-wrap { display: flex; flex-direction: column; gap: 0.3rem; }
        .cad-field { position: relative; display: flex; align-items: center; border: 1.5px solid var(--border); border-radius: var(--radius-full); overflow: hidden; background: var(--bg-card); transition: border-color 0.2s; }
        .cad-field:focus-within { border-color: var(--border-focus); }
        .cad-field.has-error { border-color: var(--error); }
        .cad-field.has-error:focus-within { border-color: var(--error); }
        .cad-field input { flex: 1; min-width: 0; padding: 0.8rem 0.5rem 0.8rem 1.25rem; border: none; outline: none; font-family: inherit; font-size: var(--font-input); color: var(--text-title); background: transparent; }
        .cad-field input::placeholder { color: var(--text-muted); }
        .cad-field input:-webkit-autofill,
        .cad-field input:-webkit-autofill:hover,
        .cad-field input:-webkit-autofill:focus {
          -webkit-text-fill-color: var(--text-title);
          -webkit-box-shadow: 0 0 0px 1000px var(--primary-light) inset;
          box-shadow: 0 0 0px 1000px var(--primary-light) inset;
          transition: background-color 5000s ease-in-out 0s;
        }
        .cad-field:has(input:-webkit-autofill) { background: var(--primary-light); }
        .field input:-webkit-autofill,
        .field input:-webkit-autofill:hover,
        .field input:-webkit-autofill:focus {
          -webkit-text-fill-color: var(--text-title);
          -webkit-box-shadow: 0 0 0px 1000px var(--primary-light) inset;
          box-shadow: 0 0 0px 1000px var(--primary-light) inset;
          transition: background-color 5000s ease-in-out 0s;
        }
        .cad-icon { margin-right: 1.5rem; flex-shrink: 0; color: var(--text-muted); }
        .cad-eye { background: none; border: none; cursor: pointer; padding: 0 1.5rem 0 0.25rem; display: flex; align-items: center; color: var(--text-muted); flex-shrink: 0; }
        .cad-eye:hover { color: var(--primary); }
        .cad-error { font-size: 0.75rem; color: var(--error); padding-left: 1.25rem; }
        .cad-btn { margin-top: 0.5rem; padding: 0.9rem; background: var(--primary-gradient); color: var(--text-inverse); border: none; border-radius: var(--radius-full); font-family: inherit; font-size: var(--font-input); font-weight: var(--fw-bold); cursor: pointer; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; min-height: 52px; letter-spacing: 0.5px; }
        .cad-btn:hover:not(:disabled) { opacity: 0.9; }
        .cad-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        /* ── Cabeçalho do cadastro ────────────────────────── */
        .cad-header { text-align: center; margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 0.35rem; }
        .cad-title { font-size: 1.5rem; font-weight: 700; color: var(--text-title); margin: 0; letter-spacing: -0.01em; line-height: 1.2; }
        .cad-subtitle { font-size: 0.9rem; color: var(--text-secondary); margin: 0; line-height: 1.4; }

        /* ── Requisitos da senha (substitui medidor) ──────── */
        .pw-req { list-style: none; padding: 0.25rem 1.25rem 0; margin: 0; display: flex; flex-direction: column; gap: 0.25rem; }
        .pw-req li { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: var(--text-muted); transition: color 0.2s ease; }
        .pw-req li.ok { color: #16A34A; }
        .pw-req-dot { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; font-size: 0.8rem; font-weight: 700; flex-shrink: 0; }
        .pw-req li.ok .pw-req-dot { color: #16A34A; }
        .pw-req-done { display: flex; align-items: center; gap: 0.4rem; padding: 0.25rem 1.25rem 0; font-size: 0.75rem; font-weight: 600; color: #16A34A; animation: pwDoneIn 0.25s ease both; }
        .pw-req-done .pw-req-dot { color: #16A34A; }
        @keyframes pwDoneIn { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: translateY(0); } }

        /* ── Alerta soft (identidade Doonly) ──────────────── */
        .auth-alert-soft {
          display: flex;
          align-items: flex-start;
          gap: 0.65rem;
          padding: 0.75rem 0.9rem;
          background: var(--primary-light);
          border: 1px solid rgba(110, 53, 72, 0.18);
          border-left: 3px solid var(--primary);
          border-radius: var(--radius-sm);
          color: var(--text-title);
          font-size: var(--font-button);
          animation: slideUp 0.25s ease both;
        }
        .auth-alert-icon { color: var(--primary); flex-shrink: 0; display: flex; align-items: center; margin-top: 1px; }
        .auth-alert-body { display: flex; flex-direction: column; gap: 0.15rem; line-height: 1.35; }
        .auth-alert-body strong { font-weight: 600; color: var(--text-title); }
        .auth-alert-link {
          background: none;
          border: none;
          padding: 0;
          color: var(--primary);
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: 600;
          cursor: pointer;
          text-align: left;
          text-decoration: underline;
          text-underline-offset: 2px;
          align-self: flex-start;
        }
        .auth-alert-link:hover { opacity: 0.85; }

        /* ──────────────────────────────────────────────────────────
           Promo card (desktop only ≥1200px).
           Mobile/tablet: display: none — comportamento atual preservado.
           ────────────────────────────────────────────────────────── */
        .auth-promo { display: none; }

        @media (min-width: 1200px) {
          .auth-card {
            margin: 0;
          }
          .auth-promo {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            position: absolute;
            z-index: 2;
            top: 0;
            bottom: 0;
            margin-top: auto;
            margin-bottom: auto;
            left: calc(100% + 2rem);
            height: fit-content;
            width: 320px;
            padding: 1.75rem 1.5rem;
            border-radius: var(--radius-lg);
            background: linear-gradient(160deg, #986274 0%, #6E3548 45%, #431524 100%);
            color: white;
            box-shadow: 0 12px 48px rgba(61, 26, 36, 0.35);
            animation: promoFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
            animation-delay: 0.1s;
          }

          .auth-promo-head {
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }
          .auth-promo-badge {
            width: 44px; height: 44px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(8px);
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
          }
          .auth-promo h2 {
            font-size: 1.35rem;
            font-weight: 700;
            color: white;
            margin: 0;
            letter-spacing: -0.01em;
            line-height: 1.2;
          }

          .auth-promo-text {
            font-size: 0.95rem;
            line-height: 1.5;
            color: rgba(255, 255, 255, 0.85);
            margin: 0;
          }

          .auth-promo-cta {
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: rgba(255, 255, 255, 0.6);
            margin: 0;
          }

          .auth-promo-stores {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .auth-promo-store {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.7rem 1.1rem;
            background: rgba(0, 0, 0, 0.35);
            border: 1.5px solid rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            text-decoration: none;
            color: white;
            transition: background 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
            cursor: pointer;
          }
          .auth-promo-store:hover {
            background: rgba(0, 0, 0, 0.5);
            border-color: rgba(255, 255, 255, 0.35);
            transform: translateY(-1px);
          }
          .auth-promo-store-labels {
            display: flex;
            flex-direction: column;
            line-height: 1.1;
          }
          .auth-promo-store-small {
            font-size: 0.62rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            opacity: 0.85;
          }
          .auth-promo-store-big {
            font-size: 1.1rem;
            font-weight: 600;
            letter-spacing: -0.01em;
          }

          .auth-promo-divider {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            color: rgba(255, 255, 255, 0.5);
            font-size: 0.75rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }
          .auth-promo-divider::before,
          .auth-promo-divider::after {
            content: '';
            flex: 1;
            height: 1px;
            background: rgba(255, 255, 255, 0.2);
          }

          .auth-promo-qr {
            display: flex;
            justify-content: center;
            padding: 0.85rem;
            background: white;
            border-radius: 14px;
            margin: 0 auto;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          }
          .auth-promo-qr img {
            width: 120px;
            height: 120px;
            display: block;
          }
        }
      `}</style>
    </div>
  );
}

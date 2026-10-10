import { Mascote, NomeDoonly } from '@/components/marca/Mascote';
import { useState, useEffect, useRef } from "react";
import BotaoGoogle from "@/components/BotaoGoogle";
import { Botao } from "@/components/base";
import TermosModal from "@/components/TermosModal";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { User, Storefront, Phone, Envelope, Eye, EyeSlash, Check } from "@phosphor-icons/react";

// ───────────────────────────────────────────────────────────────
// Links de download do app (desktop ≥1200px)
// ───────────────────────────────────────────────────────────────
// iPhone/iPad (inclui iPad que se apresenta como Mac): o login com Google abre no Safari,
// fora do app instalado — por isso fica escondido nesses aparelhos (30/09)
const IS_IOS = typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1));

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
  const [keepConnected, setKeepConnected] = useState(true); // marcado = continua conectada; desmarcado = sai ao fechar o app
  const location = useLocation();
  // quem volta do "Esqueci a senha" traz o e-mail que estava digitando
  const [form, setForm] = useState(() => ({ email: String((location.state as { email?: string } | null)?.email || ""), senha: "" }));
  const [fading, setFading] = useState(false);
  // Criar conta tem endereço próprio (/cadastro); o voltar do navegador volta pro login (09/10 · 3.66)
  const showCadastro = location.pathname.startsWith("/cadastro");
  const setShowCadastro = (abrir: boolean) => {
    if (abrir === showCadastro) return;
    navigate(abrir ? `/cadastro${location.search}` : "/login", { replace: false });
  };
  // Termos e Privacidade abrem numa janela por cima (07/10): não recarrega o app nem perde o que foi digitado
  const [docLegal, setDocLegal] = useState<null | "termos" | "privacidade">(null);
  const abrirDoc = (doc: "termos" | "privacidade") => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // Ctrl+clique continua abrindo a página em outra aba
    e.preventDefault();
    setDocLegal(doc);
  };
  // ao trocar entre login e cadastro, volta pro topo (senão o cadastro abre rolado, com o mascote cortado)
  useEffect(() => { document.querySelector('.auth-root')?.scrollTo(0, 0) }, [showCadastro]);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 900px)").matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Captura código de indicação da URL (?ref=XXX) ──────────
  // Salva em localStorage pra persistir caso a visitante navegue antes de cadastrar.
  // Consumido no signup pra vincular indicador → indicada.
  // Também busca nome/foto do indicador pra mostrar banner de boas-vindas
  // e faz auto-scroll até o form de cadastro (assume que a pessoa é nova).
  const [indicadorNome, setIndicadorNome] = useState<string | null>(null);
  const [indicadorFoto, setIndicadorFoto] = useState<string | null>(null);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      // Aceita ?ref= vindo da URL OU um código já salvo em localStorage
      // (caso a pessoa saia e volte, o banner continua aparecendo)
      let refCode: string | null = null;
      let veioViaURL = false;
      if (ref && ref.trim().length >= 4 && ref.trim().length <= 12) {
        refCode = ref.trim().toUpperCase();
        localStorage.setItem("doonly_ref_code", refCode);
        veioViaURL = true;
      } else {
        refCode = localStorage.getItem("doonly_ref_code");
      }

      // Busca nome + foto do indicador (fallback silencioso se código não existe)
      if (refCode) {
        supabase
          .from("profiles")
          .select("nome, foto_url")
          .eq("codigo_indicacao", refCode)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.nome) setIndicadorNome(data.nome);
            if (data?.foto_url) setIndicadorFoto(data.foto_url);
          });
      }

      // Se veio via URL: abre a aba de CADASTRO automaticamente
      // (a pessoa entrou por convite = é nova, faz sentido cadastrar)
      // e faz scroll até o form.
      if (veioViaURL) {
        setShowCadastro(true);
        setTimeout(() => {
          const el = document.querySelector(".cadastro-form");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 400);
      }
    } catch {}
  }, []);

  // ── Login: validação inline (só email) ─────────────────────
  const [loginEmailError, setLoginEmailError] = useState("");
  const [loginEmailTouched, setLoginEmailTouched] = useState(false);

  // ── Cadastro ───────────────────────────────────────────────
  const [cadastroLoading, setCadastroLoading] = useState(false);
  const [cadastroError, setCadastroError] = useState("");
  const [showCadastroSenha, setShowCadastroSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [cadastroForm, setCadastroForm] = useState({
    nome: "", nomeLoja: "", telefone: "", email: "", senha: "", confirmarSenha: ""
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
      if (glowRef.current && glowRef.current.style.opacity !== "1") { currentRef.current = { x: e.clientX, y: e.clientY }; glowRef.current.style.opacity = "1"; }
    };
    window.addEventListener("mousemove", handleMouseMove);
    const animate = () => {
      // Fundo em cor sólida (removida animação de gradient rotativo)
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
    if (!form.senha) { setError("Digite sua senha."); return; }
    setLoading(true);
    setError("");
    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.senha,
      });
      if (error) throw error;
      // "Lembrar de mim" desmarcado: a sessão vale só enquanto o app estiver aberto (ver main.tsx)
      try {
        if (keepConnected) localStorage.removeItem("doonly_sessao_temporaria");
        else { localStorage.setItem("doonly_sessao_temporaria", "1"); sessionStorage.setItem("doonly_sessao_viva", "1"); }
      } catch { /* sem armazenamento: segue conectada */ }
      const userId = signInData.user?.id;
      const { data: prof } = await supabase.from("profiles").select("is_admin").eq("id", userId).single();
      const dest = prof?.is_admin === true ? "/admin" : "/inicio";
      setFading(true);
      setTimeout(() => navigate(dest), 700);
    } catch (err: any) {
      // Se email não foi confirmado, oferece ação de reenviar
      const msg = err?.message || "";
      // cada erro com a sua mensagem (antes, até "sem internet" virava "senha incorreta")
      const status = Number(err?.status) || 0;
      if (!navigator.onLine || /failed to fetch|networkerror|network request failed|load failed/i.test(msg)) {
        setError("Sem conexão. Confira a internet e tente de novo.");
      } else if (/invalid login credentials|invalid_credentials|invalid grant/i.test(msg) || status === 400) {
        setError("E-mail ou senha incorretos. Confira e tente de novo.");
      } else if (/email not confirmed|email_not_confirmed/i.test(msg)) {
        setError("Falta confirmar seu e-mail. Abra o link que enviamos pra você.");
      } else {
        setError("Não conseguimos entrar agora. Tente de novo em instantes.");
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
            nome_loja: cadastroForm.nomeLoja,
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

      // ── 2.1) Salva nome_loja no profile ─────────────────────
      // O trigger handle_new_user cria a row com nome/telefone, mas não com nome_loja.
      // Fazemos update explícito aqui.
      if (cadastroForm.nomeLoja.trim()) {
        try {
          const { data: userRes } = await supabase.auth.getUser();
          if (userRes?.user?.id) {
            await supabase.from("profiles").update({
              nome_loja: cadastroForm.nomeLoja.trim(),
            }).eq("id", userRes.user.id);
          }
        } catch (err) {
          console.warn("[signup] falha ao salvar nome_loja:", err);
        }
      }

      // ── 3) Vincula indicação (se veio via ?ref=CODIGO) ──────
      // Busca o profile do indicador pelo código e faz UPDATE
      // no profile novo. Se falhar, loga mas não bloqueia o cadastro.
      try {
        const refCode = localStorage.getItem("doonly_ref_code");
        console.log("[REF SIGNUP] refCode:", refCode);
        if (refCode) {
          const { data: userRes } = await supabase.auth.getUser();
          const novoId = userRes?.user?.id;
          console.log("[REF SIGNUP] novoId:", novoId);
          if (novoId) {
            const { data: indicador, error: errBuscar } = await supabase
              .from("profiles")
              .select("id")
              .eq("codigo_indicacao", refCode)
              .maybeSingle();
            console.log("[REF SIGNUP] indicador:", indicador, "erro:", errBuscar);

            if (indicador?.id && indicador.id !== novoId) {
              const { error: errUpdate } = await supabase.from("profiles").update({
                indicado_por: indicador.id,
                desconto_primeiro_mes: true,
              }).eq("id", novoId);
              console.log("[REF SIGNUP] update profile erro:", errUpdate);

              // Registra na tabela de indicações com status "cadastrou"
              const { data: insData, error: errInsert } = await supabase.from("indicacoes").insert({
                indicador_id: indicador.id,
                indicada_id: novoId,
                status: "cadastrou",
              }).select();
              console.log("[REF SIGNUP] insert indicacao:", insData, "erro:", errInsert);

              // Dispara push pra quem indicou (template configurado no admin)
              // Fire-and-forget — não bloqueia o fluxo se falhar
              if (!errInsert) {
                supabase.functions.invoke("notif-indicacao", {
                  body: {
                    evento: "indicacao_cadastro",
                    indicador_id: indicador.id,
                    nome_indicada: cadastroForm.nome,
                    codigo: refCode,
                  }
                }).catch((err) => console.warn("[notif] falha:", err));
              }
            }
          }
          // Limpa após usar (evita re-aplicar)
          localStorage.removeItem("doonly_ref_code");
        }
      } catch (err) {
        console.warn("[ref] falha ao vincular indicação:", err);
      }

      // ── 4) Dispara e-mail de boas-vindas (fire-and-forget) ──
      // Não bloqueia a UX. Se falhar, o cadastro segue normal.
      // A Edge Function tem dedup, então chamadas duplicadas são seguras.
      supabase.functions.invoke("send-welcome-email").catch((err) => {
        // Log silencioso; não interrompe fluxo do usuário
        console.warn("welcome email failed:", err);
      });

      // ── 5) Redireciona para o app ───────────────────────────
      // Limpa flags de tutorial (garante que cliente novo vê tudo, mesmo
      // se o navegador já tinha visitado o site com outra conta)
      try {
        localStorage.removeItem("doonly_tutorial_visto");
        localStorage.removeItem("doonly_tutorial_auto_aberto");
        localStorage.removeItem("doonly_tour_inicio_visto");
      } catch {}

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

      {/* Botão "Fazer login" flutuante no topo (só aparece no cadastro) */}
      {showCadastro && (
        <button type="button" className="auth-topbar-login" onClick={() => setShowCadastro(false)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Já tem conta? <b>Entrar</b></span>
        </button>
      )}

      <div className="auth-layout">

      {/* Lado da marca: só no computador e no tablet deitado (03/10) */}
      <div className="auth-marca" aria-hidden="true">
        <div className="auth-marca-in">
        <Mascote pose={showCadastro ? 'comemorando' : 'acenando'} className="auth-marca-masc" />
        <NomeDoonly cor="branco" className="auth-marca-nome" />
        <p className="auth-marca-frase">{showCadastro ? 'Vamos começar!' : 'Seus pedidos te esperam'}</p>
        <p className="auth-marca-sub">{showCadastro ? 'Leva menos de 1 minuto.' : 'Pedidos, agenda e financeiro num só lugar.'}</p>
        <ul className="auth-marca-lista">
          {['Pedidos e agenda num lugar só', 'Cardápio digital com seu link', 'Financeiro sem planilha'].map(x => (
            <li key={x}><span><Check size={14} weight="bold" /></span>{x}</li>
          ))}
        </ul>
        </div>
      </div>

      {!showCadastro ? (
      <div className="auth-card">
        {/* celular: o mascote sai do cartão, o nome vai dentro */}
        <Mascote pose="acenando" className="auth-masc" />
        <NomeDoonly className="auth-nome" />

        <div className="auth-text-hdr">
          <h2 className="auth-h2"><span className="so-cel">Seus pedidos te esperam</span><span className="so-pc">Entrar na conta</span></h2>
          <p className="auth-p so-cel-bloco">Entre na sua conta pra continuar.</p>
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
              style={{ backgroundColor: "#fff", borderColor: loginEmailError ? "var(--error)" : "var(--border)" }}
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
                style={{ backgroundColor: "#fff", borderColor: "var(--border)" }}
              />
              <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                {showPassword ? <EyeSlash size={18} weight="regular" /> : <Eye size={18} weight="regular" />}
              </button>
            </div>
          </div>
          <div className="login-bottom-row">
            <div className="keep-connected">
              <input type="checkbox" id="keep" checked={keepConnected} onChange={e => setKeepConnected(e.target.checked)} />
              <label htmlFor="keep">Lembrar de mim</label>
            </div>
            <a href="/esqueci-senha" className="forgot-link" onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); navigate("/esqueci-senha", { state: { email: form.email.trim() } }); }}>Esqueceu a senha?</a>
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {/* (07/10 · 2.91) botão padrão do guia, o mesmo do "Esqueci a senha" */}
          <Botao type="submit" cheio className="auth-btn" carregando={loading} disabled={fading}>{loading ? "Entrando…" : "Entrar"}</Botao>

          {!IS_IOS && (<>
          <div className="auth-divider"><span>ou</span></div>

          <BotaoGoogle modo="signin_with" textoReserva="Entrar com Google" desativado={loading || fading} />
          </>)}
          <div className="cadastro-link-wrap">
            <span>Não tem conta? </span>
            <button type="button" className="cadastro-link" onClick={() => setShowCadastro(true)}>
              Criar conta grátis
            </button>
          </div>
        </form>
      </div>
      ) : (
      <div className="auth-card">
        <Mascote pose="comemorando" className="auth-masc" />
        <NomeDoonly className="auth-nome" />

        <div className="auth-text-hdr">
          <h2 className="auth-h2"><span className="so-cel">Vamos começar!</span><span className="so-pc">Criar conta</span></h2>
          <p className="auth-p so-cel-bloco">Leva menos de 1 minuto.</p>
        </div>

        <form onSubmit={handleCadastro} className="cadastro-form" noValidate>
          {/* Banner de indicação — só aparece se veio via ?ref= */}
          {indicadorNome && (
            <div className="ref-banner">
              <div className="ref-banner-avatar">
                {indicadorFoto
                  ? <img src={indicadorFoto} alt={indicadorNome} />
                  : <span>{indicadorNome.trim().charAt(0).toUpperCase()}</span>}
              </div>
              <div className="ref-banner-info">
                <div className="ref-banner-title">
                  <b>{indicadorNome.split(" ")[0]}</b> indicou você para o Doonly!
                </div>
                <div className="ref-banner-desc">
                  Comece de graça em segundos
                </div>
              </div>
            </div>
          )}

          {/* Nome */}
          <div className="cad-field-wrap">
            <label className="cad-lb" htmlFor="cad-nome">Seu nome</label>
            <div className={`cad-field ${cadastroTouched.nome && cadastroErrors.nome ? "has-error" : ""}`}>
              <input
                id="cad-nome"
                type="text"
                placeholder="Ex.: Juliana Souza"
                value={cadastroForm.nome}
                onChange={e => handleCadastroChange("nome", e.target.value)}
                onBlur={() => handleCadastroBlur("nome")}
                required
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                aria-invalid={!!(cadastroTouched.nome && cadastroErrors.nome)}
              />
              
            </div>
            {cadastroTouched.nome && cadastroErrors.nome && (
              <span className="cad-error">{cadastroErrors.nome}</span>
            )}
          </div>

          {/* Nome da confeitaria */}
          <div className="cad-field-wrap">
            <label className="cad-lb" htmlFor="cad-confeitaria">Nome da confeitaria</label>
            <div className="cad-field">
              <input
                id="cad-confeitaria"
                type="text"
                placeholder="Ex.: Doces da Ju"
                value={cadastroForm.nomeLoja}
                onChange={e => handleCadastroChange("nomeLoja", e.target.value)}
                autoComplete="organization"
                autoCapitalize="words"
                enterKeyHint="next"
              />
              
            </div>
          </div>

          {/* Telefone */}
          <div className="cad-field-wrap">
            <label className="cad-lb" htmlFor="cad-whatsapp">WhatsApp</label>
            <div className={`cad-field ${cadastroTouched.telefone && cadastroErrors.telefone ? "has-error" : ""}`}>
              <input
                id="cad-whatsapp"
                type="tel"
                placeholder="(41) 9 9999-0000"
                value={cadastroForm.telefone}
                onChange={e => handleCadastroChange("telefone", e.target.value)}
                onBlur={() => handleCadastroBlur("telefone")}
                autoComplete="tel"
                inputMode="tel"
                enterKeyHint="next"
                aria-invalid={!!(cadastroTouched.telefone && cadastroErrors.telefone)}
              />
              
            </div>
            {cadastroTouched.telefone && cadastroErrors.telefone && (
              <span className="cad-error">{cadastroErrors.telefone}</span>
            )}
          </div>

          {/* E-mail */}
          <div className="cad-field-wrap">
            <label className="cad-lb" htmlFor="cad-email">E-mail</label>
            <div className={`cad-field ${cadastroTouched.email && cadastroErrors.email ? "has-error" : ""}`}>
              <input
                id="cad-email"
                type="email"
                placeholder="seu@email.com"
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
              
            </div>
            {cadastroTouched.email && cadastroErrors.email && (
              <span className="cad-error">{cadastroErrors.email}</span>
            )}
          </div>

          {/* Senha */}
          <div className="cad-field-wrap">
            <label className="cad-lb" htmlFor="cad-senha">Senha</label>
            <div className={`cad-field ${cadastroTouched.senha && cadastroErrors.senha ? "has-error" : ""}`}>
              <input
                id="cad-senha"
                type={showCadastroSenha ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
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
            <label className="cad-lb" htmlFor="cad-confirmar">Confirmar a senha</label>
            <div className={`cad-field ${cadastroTouched.confirmarSenha && cadastroErrors.confirmarSenha ? "has-error" : ""}`}>
              <input
                id="cad-confirmar"
                type={showConfirmarSenha ? "text" : "password"}
                placeholder="Repita a senha"
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
                    Entrar →
                  </button>
                </div>
              </div>
            ) : (
              <p className="auth-error" role="alert">{cadastroError}</p>
            )
          )}
          <Botao type="submit" cheio className="cad-btn" carregando={cadastroLoading}>{cadastroLoading ? "Criando conta…" : "Criar conta"}</Botao>
          {!IS_IOS && (<>
          <div className="auth-divider"><span>ou</span></div>
          <BotaoGoogle modo="signup_with" textoReserva="Criar conta com Google" desativado={cadastroLoading} />
          </>)}
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.5', margin: '0' }}>
            Ao criar sua conta, você concorda com nossos{' '}
            <a href="/termos" onClick={abrirDoc("termos")} style={{ color: '#C33A6E', fontWeight: 700, whiteSpace: 'nowrap' }}>Termos de Uso</a>
            {' '}e{' '}
            <a href="/privacidade" onClick={abrirDoc("privacidade")} style={{ color: '#C33A6E', fontWeight: 700, whiteSpace: 'nowrap' }}>Política de Privacidade</a>
          </p>
          <div className="cad-mobile-login-link">
            <span>Já tem conta? </span>
            <button type="button" className="cadastro-link" onClick={() => setShowCadastro(false)}>Entrar</button>
          </div>
        </form>
      </div>
      )}

      </div>

      {/* Rodapé (03/10): links das políticas, como no Dora */}
      <footer className="auth-rodape">
        <div><a href="/privacidade" onClick={abrirDoc("privacidade")}>Política de Privacidade</a><span aria-hidden="true">·</span><a href="/termos" onClick={abrirDoc("termos")}>Termos de Uso</a></div>
        <em>© {new Date().getFullYear()} Doonly</em>
      </footer>

      <TermosModal open={!!docLegal} initialTab={docLegal || "termos"} onClose={() => setDocLegal(null)} paginaNoComputador />

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; }
        #root { height: 100%; overflow-y: auto; -webkit-overflow-scrolling: touch; }
        .auth-root {
          /* a tela toda é a área de rolagem (03/10): em telas baixas o cartão aparece inteiro e a página rola */
          position: fixed; inset: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
          display: flex; flex-direction: column; align-items: center;
          font-family: inherit;
          padding: calc(env(safe-area-inset-top, 0px) + 24px) 1.25rem calc(env(safe-area-inset-bottom, 0px) + 24px); /* a folga SOMA com a barra do celular */
        }
        .auth-layout { position: relative; z-index: 2; width: 100%; max-width: 440px; display: flex; flex-direction: column; margin: auto 0; flex-shrink: 0; } /* não encolhe: em tela baixa a página rola */ /* margin auto: centraliza quando cabe, rola quando não */
        .auth-side { display: none; }

        /* ── Botão "Fazer login" flutuante no topo (só desktop) ── */
        .auth-topbar-login {
          display: none !important;
          position: fixed;
          top: max(1.1rem, env(safe-area-inset-top));
          left: max(1.1rem, env(safe-area-inset-left));
          z-index: 10;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0.55rem 1rem 0.55rem 0.75rem;
          background: #fff;
          border: none;
          border-radius: 999px;
          color: var(--primary);
          font-family: inherit;
          font-size: 0.82rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 14px rgba(60, 15, 40, 0.2);
          -webkit-tap-highlight-color: transparent;
          -webkit-appearance: none;
          appearance: none;
        }
        .auth-topbar-login:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(60, 15, 40, 0.28);
        }
        .auth-topbar-login:active { transform: scale(0.97); }
        .auth-topbar-login b { font-weight: 700; }
        .fade-overlay { position: fixed; inset: 0; z-index: 100; background: var(--bg-card); opacity: 0; pointer-events: none; transition: opacity 0.7s ease; }
        .fade-overlay.fade-in { opacity: 1; pointer-events: all; }
        .auth-bg {
          position: fixed; inset: 0; z-index: 0;
          background: var(--vinho-fundo, radial-gradient(1000px 640px at 50% 38%, #4B1528 0%, #2C1219 72%)); /* vinho escuro (themes.css) */
        }
        .auth-rodape { position: relative; z-index: 3; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; padding-top: 18px; color: rgba(255,255,255,.72); font-size: 12.5px; white-space: nowrap; }
        .auth-rodape div { display: flex; gap: 8px; align-items: center; }
        .auth-rodape a { display: inline-flex; align-items: center; min-height: 44px; color: inherit; font-weight: 500; text-decoration: none; padding: 0 2px; -webkit-tap-highlight-color: transparent; }
        .auth-rodape a:hover { color: #fff; text-decoration: underline; }
        .auth-rodape em { font-style: normal; font-size: 12px; opacity: .8; }
        .mouse-glow { position: fixed; z-index: 1; width: 350px; height: 350px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%); transform: translate(-50%, -50%); pointer-events: none; will-change: transform; opacity: 0; transition: opacity .4s ease; }
        @media (hover: none), (prefers-reduced-motion: reduce) { .mouse-glow { display: none; } }
        .auth-card {
          position: relative; z-index: 2; background: var(--bg-card); border-radius: 22px; padding: 56px 1.5rem 1.6rem;
          width: 100%; max-width: 440px; box-shadow: 0 14px 40px -12px rgba(60,10,30,.45);
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; margin: 108px auto 0; /* espaço pro mascote saindo do cartão (ele sobe 96px) + folga */
        }
        /* celular estreito (até 380px): um pouco menos de margem pra o título de 22px caber inteiro */
        @media (max-width: 380px) {
          .auth-root { padding-left: 12px !important; padding-right: 12px !important; }
          .auth-card { padding-left: 18px !important; padding-right: 18px !important; }
        }
        @media (max-width: 340px) { .auth-root .auth-card .auth-h2 { font-size: 20px; } } /* exceção: celulares bem antigos (320px) */
        .auth-masc { position: absolute; left: 50%; top: -96px; transform: translateX(-50%); width: 136px; height: auto; z-index: 3; filter: drop-shadow(0 0 16px rgba(255,157,196,.55)) drop-shadow(0 8px 10px rgba(0,0,0,.35)); /* brilho rosa: o contorno escuro não some no vinho */ pointer-events: none; }
        .auth-nome { display: block; width: 128px; height: auto; margin: 0 auto 6px; }
        .so-pc { display: none; }
        .auth-marca { display: none; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes promoFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .auth-logo-wrap { display: flex; justify-content: center; margin-bottom: 0.75rem; }
        .auth-logo-img { height: 84px; max-width: 100%; object-fit: contain; }
        .auth-text-hdr {
          text-align: center;
          margin-bottom: 1rem;
          display: block; /* título também no celular (03/10) */
        }
        @media (min-width: 900px) {
          .auth-text-hdr { display: block; }
        }
        .auth-h2 { font-size: 22px; font-weight: 800; color: #2C1219; margin: 0 0 2px; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } /* guia: título da tela 22px */
        .auth-p { font-size: 13.5px; color: #6B5D64; line-height: 1.45; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .auth-form { display: flex; flex-direction: column; gap: 1rem; }
        .field { display: flex; flex-direction: column; gap: 0.35rem; }
        .field label { font-size: 13px; font-weight: 700; color: #4B3A42; margin-left: 2px; }
        .field input {
          padding: 0.72rem 1rem;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-sm);
          font-family: inherit;
          font-size: 16px; /* Evita zoom automatico no iOS Safari */
          color: var(--text-title);
          outline: none;
          transition: background-color 0.2s, border-color 0.2s;
          width: 100%;
          -webkit-appearance: none;
          appearance: none;
          -webkit-tap-highlight-color: transparent;
        }
        .field input:focus { border-color: var(--border-focus) !important; } /* foco discreto: só a borda rosa, sem brilho */
        .field input[aria-invalid="true"]:focus { border-color: var(--error) !important; }
        .field input::placeholder { color: var(--text-muted); }
        .field-error { font-size: 12.5px; font-weight: 700; color: var(--error); padding-left: 2px; }
        .password-wrap { position: relative; }
        .password-wrap input { padding-right: 3rem; }
        .eye-btn { position: absolute; right: 3px; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; background: none; border: none; border-radius: 10px; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; padding: 0; -webkit-tap-highlight-color: transparent; }
        .eye-btn:focus-visible, .cad-eye:focus-visible, .cadastro-link:focus-visible, .forgot-link:focus-visible, .auth-rodape a:focus-visible { outline: 3px solid rgba(232,90,140,.45); outline-offset: 1px; border-radius: 8px; }
        .keep-connected input[type="checkbox"]:focus-visible { outline: 3px solid rgba(232,90,140,.45) !important; outline-offset: 2px; }
        .eye-btn:hover { color: var(--primary); }
        .login-bottom-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: nowrap; gap: 0.5rem; }
        .keep-connected { position: relative; display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; min-height: 44px; padding-right: 6px; }
        .keep-connected input[type="checkbox"] { accent-color: var(--primary); width: 15px; height: 15px; cursor: pointer; }
        .keep-connected label { font-size: var(--font-helper); color: var(--text-primary); cursor: pointer; white-space: nowrap; }
        .keep-connected label::before { content: ''; position: absolute; inset: 0; }
        .forgot-link { display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; color: #C33A6E; text-decoration: none; white-space: nowrap; font-weight: 700; padding: 0; -webkit-tap-highlight-color: transparent; }
        .forgot-link:hover { text-decoration: underline; }
        .auth-error { background: #fff1f2; border: 1px solid #fecdd3; color: var(--error); border-radius: var(--radius-sm); padding: 0.6rem 0.9rem; font-size: var(--font-button); }
        .cadastro-link-wrap { text-align: center; font-size: var(--font-button); color: var(--text-secondary); }
        .cadastro-link { background: none; border: none; color: var(--primary); font-weight: 700; cursor: pointer; font-family: inherit; font-size: var(--font-button); text-decoration: underline; -webkit-tap-highlight-color: transparent;  padding: 0 4px; min-height: 44px; font-weight: 700; color: #C33A6E; }
        .spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .auth-divider { display: flex; align-items: center; gap: 0.75rem; color: var(--text-muted); font-size: var(--font-helper); }
        .auth-divider::before, .auth-divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
        .google-btn { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 0.75rem; background: var(--bg-card); color: var(--text-primary); border: 1.5px solid var(--border); border-radius: var(--radius-sm); font-family: inherit; font-size: var(--font-input); font-weight: var(--fw-medium); cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s; width: 100%; min-height: 48px; -webkit-tap-highlight-color: transparent; -webkit-appearance: none; appearance: none; }
        .google-btn:hover { border-color: var(--text-muted); box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        .google-btn:active { transform: scale(0.98); }

        /* ── Cadastro ─────────────────────────────────────── */
        .cadastro-form { display: flex; flex-direction: column; gap: 0.75rem; padding-top: 0.5rem; }

        /* Banner de indicação (aparece na aba Cadastro se veio via ?ref=) */
        .ref-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: linear-gradient(135deg, #FCE0E9 0%, #F4C0D1 100%);
          border: 1.5px solid #E85A8C;
          border-radius: 12px;
          margin-bottom: 4px;
          animation: refPop 0.4s cubic-bezier(0.34, 1.4, 0.64, 1);
        }
        @keyframes refPop {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ref-banner-avatar {
          width: 44px; height: 44px;
          border-radius: 50%;
          background: #993556;
          color: #FCE0E9;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
          font-weight: 700;
          flex-shrink: 0;
          overflow: hidden;
          border: 2px solid #fff;
          box-shadow: 0 2px 8px rgba(153, 53, 86, 0.3);
        }
        .ref-banner-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .ref-banner-info { flex: 1; min-width: 0; }
        .ref-banner-title {
          font-size: 13px;
          color: #4B1528;
          line-height: 1.3;
          font-weight: 500;
        }
        .ref-banner-title b { font-weight: 800; color: #72243E; }
        .ref-banner-desc {
          font-size: 13px;
          color: #993556;
          margin-top: 2px;
          line-height: 1.35;
        }
        .ref-banner-desc b { font-weight: 700; }
        .cad-field-wrap { display: flex; flex-direction: column; gap: 0.3rem; }
        .cad-field { position: relative; display: flex; align-items: center; height: 48px; border: 1.5px solid var(--border); border-radius: 12px; overflow: hidden; background: #fff; transition: border-color 0.2s; }
        .cad-lb { display: block; cursor: pointer; font-size: 13px; font-weight: 700; color: #4B3A42; margin: 0 0 5px 2px; }
        .cad-field:focus-within { border-color: var(--border-focus); }
        .cad-field.has-error { border-color: var(--error); }
        .cad-field.has-error:focus-within { border-color: var(--error); }
        .cad-field input {
          flex: 1; min-width: 0;
          padding: 0 0.5rem 0 0.85rem;
          border: none; outline: none;
          font-family: inherit;
          font-size: 16px; /* Evita zoom no iOS */
          color: var(--text-title);
          background: transparent;
          -webkit-appearance: none;
          appearance: none;
          -webkit-tap-highlight-color: transparent;
        }
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
        .cad-eye { background: none; border: none; cursor: pointer; padding: 0 0.85rem; height: 46px; min-width: 44px; justify-content: center; display: flex; align-items: center; color: var(--text-muted); flex-shrink: 0; -webkit-tap-highlight-color: transparent; }
        .cad-eye:hover { color: var(--primary); }
        .cad-error { font-size: 12.5px; color: var(--error); padding-left: 2px; font-weight: 700; }
        .cad-btn { margin-top: 0.5rem; }

        .cad-header {
          text-align: center;
          margin-bottom: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .cad-title {
          font-family: var(--font-base);
          font-size: var(--text-2xl);
          font-weight: var(--fw-black);
          color: var(--text-title);
          letter-spacing: -0.01em;
          line-height: 1.1;
          margin: 0;
        }
        .cad-subtitle {
          font-family: var(--font-base);
          font-size: var(--font-button);
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0;
          text-wrap: balance;
          text-align: center;
        }

        /* Link "Já tem conta? Fazer login" — só mobile no fim do form */
        .cad-mobile-login-link {
          text-align: center;
          font-size: 0.9rem;
          color: var(--text-secondary);
          padding-top: 0.5rem;
        }

        /* ── Header do cadastro (só social proof pill) ─── */
        .cad-hero {
          display: flex; flex-direction: column; align-items: center;
          gap: 0.6rem;
          margin-bottom: 1rem;
        }
        .cad-proof-pill {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 4px 12px 4px 5px;
          background: #FEF4E7;
          border: 1px solid #FCD9A1;
          border-radius: var(--radius-full);
        }
        .cad-proof-avatars { display: flex; }
        .cad-proof-av {
          width: 22px; height: 22px; border-radius: 50%;
          border: 2px solid #FEF4E7;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: var(--fw-black); color: #fff;
          margin-left: -7px;
        }
        .cad-proof-av:first-child { margin-left: 0; }
        .cad-proof-pill-txt {
          font-size: var(--text-xs);
          font-weight: var(--fw-bold);
          color: #854F0B;
          white-space: nowrap;
        }
        .cad-proof-pill-txt b { color: var(--text-title); font-weight: var(--fw-black); }

        .cad-header { text-align: center; margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 0.35rem; }
        .cad-title { font-size: 1.85rem; font-weight: var(--fw-black, 900); color: var(--text-title); margin: 0; letter-spacing: -0.025em; line-height: 1.15; }
        .cad-subtitle { font-size: 0.9rem; color: var(--text-secondary); margin: 0; line-height: 1.4; }

        /* ── Requisitos da senha (substitui medidor) ──────── */
        .pw-req { list-style: none; padding: 0.25rem 1.25rem 0; margin: 0; display: flex; flex-direction: column; gap: 0.25rem; }
        .pw-req li { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: var(--text-muted); transition: color 0.2s ease; }
        .pw-req li.ok { color: #16A34A; }
        .pw-req-dot { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; font-size: 0.8rem; font-weight: 700; flex-shrink: 0; }
        .pw-req li.ok .pw-req-dot { color: #16A34A; }
        .pw-req-done { display: flex; align-items: center; gap: 0.4rem; padding: 0.25rem 1.25rem 0; font-size: 0.75rem; font-weight: 500; color: #16A34A; animation: pwDoneIn 0.25s ease both; }
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
        .auth-alert-body strong { font-weight: 700; color: var(--text-title); }
        .auth-alert-link {
          background: none;
          border: none;
          padding: 0;
          color: var(--primary);
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: 700;
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
        .auth-promo { display: none !important; }

        @media (min-width: 900px) {
          /* um cartão só, dividido: marca (rosa) | formulário (branco) — 03/10 */
          .auth-rodape { flex-direction: row; gap: 8px; } .auth-rodape em::before { content: '·'; margin-right: 8px; }
          .auth-layout { max-width: 960px !important; display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 0 !important; align-items: stretch;
            background: #fff; border-radius: 28px; box-shadow: 0 30px 70px -30px rgba(80,20,45,.45); }
          .auth-marca { display: block; text-align: center; color: #fff; padding: 0 40px; border-radius: 28px 0 0 28px;
            background: linear-gradient(160deg, #FF9DC4 0%, #E85A8C 55%, #C33A6E 100%); position: relative; }
          /* o conteúdo fica no centro da parte VISÍVEL do painel (no cadastro o cartão é mais alto que a tela) */
          .auth-marca-in { position: sticky; top: 0; height: min(100%, calc(100vh - 48px)); height: min(100%, calc(100dvh - 48px)); display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .auth-marca-masc { display: block; width: 170px; height: auto; filter: drop-shadow(0 12px 16px rgba(80,10,40,.3)); }
          .auth-marca-nome { display: block; width: 210px; max-width: 100%; height: auto; margin-top: 14px; }
          .auth-marca-frase { font-size: 24px; font-weight: 800; margin: 22px 0 6px; letter-spacing: -0.01em; } /* guia: 24px, o maior da escala */
          .auth-marca-sub { font-size: 15px; opacity: .92; margin: 0; }
          .auth-marca-lista { display: none; }
          .auth-card { margin: 0 !important; padding: 48px 44px !important; box-shadow: none !important; border-radius: 0 28px 28px 0 !important; display: flex; flex-direction: column; justify-content: center; animation: none; }
          .auth-masc, .auth-nome { display: none !important; }
          .so-cel { display: none; } .so-pc { display: inline; }
          .so-cel-bloco { display: none !important; } /* computador: o cartão tem só o título */
          .auth-card .auth-text-hdr { margin-bottom: 1.25rem; }
          .auth-topbar-login { display: none !important; } /* o cartão já tem "Já tem conta? Entrar" no fim */
          /* Grid layouts:
             - Desktop/tablet: form centralizado
             - Mobile: só o form */
          /* (grid antigo de 1 coluna removido: agora são 2 colunas, acima) */
          /* Esconde coluna esquerda antiga (mascote lado) */
          .auth-side { display: none !important; }
          .auth-card { margin: 0; }
          /* (07/10) o link "Já tem conta? Entrar" aparece também no computador: sem ele não tinha como voltar pro login */
          /* Restaura o topbar no desktop */
          /* (botão flutuante "Já tem conta?" desligado no computador: o cartão já tem o link) */
        }
      `}</style>
    </div>
  );
}

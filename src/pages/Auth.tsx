import { Mascote, NomeDoonly } from '@/components/marca/Mascote';
import { useState, useEffect, useRef } from "react";
import BotaoGoogle from "@/components/BotaoGoogle";
import { Botao } from "@/components/base";
import TermosModal from "@/components/TermosModal";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { definirSessaoTemporaria } from "@/lib/sessaoTemporaria";
import { mascaraTelefone } from "@/lib/telefone";
import { explicarErro, erroDeConexao } from "@/lib/erros";
import { Eye, EyeSlash, Check } from "@phosphor-icons/react";

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
  // (15/10) nome da confeitaria obrigatório no cadastro (sem a tag "opcional")
  nomeLoja: (v: string) => (v.trim().length < 2 ? "Coloque o nome da confeitaria" : ""),
  email: (v: string) => {
    const trimmed = v.trim();
    if (!trimmed) return "Informe seu e-mail";
    if (!trimmed.includes("@")) return "Está faltando o @ no seu e-mail";
    const [local, domain] = trimmed.split("@");
    if (!local) return "Digite algo antes do @";
    if (!domain || !domain.includes(".")) return "E-mail incompleto (Ex.: nome@gmail.com)";
    if (!EMAIL_REGEX.test(trimmed)) return "E-mail em formato inválido";
    return "";
  },
  telefone: (v: string) => {
    // (15/10) WhatsApp obrigatório no cadastro: é por onde o suporte fala com a confeiteira
    if (!v.trim()) return "Coloque seu WhatsApp";
    const d = v.replace(/\D/g, "");
    if (d.length !== 10 && d.length !== 11) return "Telefone incompleto";
    return "";
  },
  senha: (v: string) => {
    if (!v) return "Crie uma senha";
    // 13/10: só o tamanho (8+). Letra e número obrigatórios saíram: travavam o cadastro e não deixavam a senha mais segura
    if (v.length < 8) return "Mínimo 8 caracteres";
    return "";
  },
};

// Requisitos da senha: retorna quais critérios foram atendidos.
// Substitui o antigo medidor de força por uma lista de checagem — mais claro,
// sem "julgar" o usuário, e alinhado com a regra do produto (8+ caracteres, 13/10).
const getPasswordChecks = (senha: string) => ({
  length: senha.length >= 8,
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

  // (10/10) Sem ninguém conectado neste aparelho, a marca da sessão temporária acompanha a caixinha "Lembrar de mim".
  // Assim vale também pra quem entra pelo Google ou cria a conta (antes só o login por senha mexia nela,
  // e uma marca antiga derrubava a sessão de quem entrou pelo Google). Criar conta sempre continua conectada.
  useEffect(() => {
    let cancelado = false;
    supabase.auth.getSession().then(({ data, error: erro }) => {
      if (!cancelado && !erro && !data.session) definirSessaoTemporaria(!keepConnected && !showCadastro);
    }, () => { /* sem leitura da sessão: não mexe */ });
    return () => { cancelado = true; };
  }, [keepConnected, showCadastro]);

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
    // campo vazio só acusa ao tentar entrar (não ao passar pelo campo)
    if (!form.email.trim()) return;
    setLoginEmailTouched(true);
    setLoginEmailError(validate.email(form.email));
  };

  // (11/10) máscara única do app: número colado com +55 não vira mais "(55) 4 1999-9900"
  const formatPhone = mascaraTelefone;

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
      definirSessaoTemporaria(!keepConnected);
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
      const codigo = String(err?.code || "");
      // (11/10) os códigos específicos vêm antes do "status 400" (antes viravam "E-mail ou senha incorretos")
      if (!navigator.onLine || /failed to fetch|networkerror|network request failed|load failed/i.test(msg)) {
        setError("Sem conexão. Confira a internet e tente de novo.");
      } else if (codigo === "email_not_confirmed" || /email not confirmed|email_not_confirmed/i.test(msg)) {
        setError("Falta confirmar seu e-mail. Abra o link que enviamos pra você.");
      } else if (codigo === "user_banned" || /user is banned|user_banned/i.test(msg)) {
        setError("Esta conta está bloqueada. Fale com a equipe Doonly.");
      } else if (status === 429 || codigo === "over_request_rate_limit" || /rate limit|too many/i.test(msg)) {
        setError("Muitas tentativas. Espere 1 minuto e tente de novo.");
      } else if (/invalid login credentials|invalid_credentials|invalid grant/i.test(msg) || status === 400) {
        setError("E-mail ou senha incorretos. Confira e tente de novo.");
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
    // campo vazio só acusa ao clicar em "Criar conta" (não ao passar pelo campo)
    if (!String(cadastroForm[field] ?? "").trim()) return;
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
      nomeLoja: validate.nomeLoja(cadastroForm.nomeLoja),
      email: validate.email(cadastroForm.email),
      telefone: validate.telefone(cadastroForm.telefone),
      senha: validate.senha(cadastroForm.senha),
      confirmarSenha: !cadastroForm.confirmarSenha ? "Repita a senha" : cadastroForm.confirmarSenha !== cadastroForm.senha ? "As senhas digitadas não são iguais" : "",
    };
    setCadastroErrors(nextErrors);
    setCadastroTouched({ nome: true, nomeLoja: true, email: true, telefone: true, senha: true, confirmarSenha: true });

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
            const { error: erroLoja } = await supabase.from("profiles").update({
              nome_loja: cadastroForm.nomeLoja.trim(),
            }).eq("id", userRes.user.id);
            if (erroLoja) console.warn("[signup] falha ao salvar nome_loja:", erroLoja);
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
        if (refCode) {
          // (11/10) podeLimpar = o vínculo gravou, ou não tinha o que gravar (código que não existe, ou o dela mesma)
          let podeLimpar = false;
          const { data: userRes } = await supabase.auth.getUser();
          const novoId = userRes?.user?.id;
          // (4.24) o banco grava o vínculo e a indicação de uma vez (função aplicar_indicacao), sem repetir.
          // Sem a função no banco, segue o caminho de antes (abaixo).
          let viaBanco = false;
          if (novoId) {
            const r = await supabase.rpc("aplicar_indicacao", { p_codigo: refCode });
            const semFuncao = !!r.error && (r.error.code === "PGRST202" || r.error.code === "42883" || /could not find the function/i.test(String(r.error.message || "")));
            if (!semFuncao) {
              viaBanco = true;
              const res = (r.data || {}) as { status?: string; indicador_id?: string };
              podeLimpar = !r.error;
              if (res.status === "ok" && res.indicador_id) {
                supabase.functions.invoke("notif-indicacao", {
                  body: { evento: "indicacao_cadastro", indicador_id: res.indicador_id, nome_indicada: cadastroForm.nome, codigo: refCode },
                }).catch((err) => console.warn("[notif] falha:", err));
              }
            }
          }
          if (novoId && !viaBanco) {
            // (4.22) quem indicou vem da função indicador_por_codigo (o perfil das outras contas não fica mais aberto);
            // sem a função no banco, lê como antes
            let indicador: { id: string } | null = null;
            let errBuscar: any = null;
            {
              const r = await supabase.rpc("indicador_por_codigo", { p_codigo: refCode });
              const semFuncao = !!r.error && (r.error.code === "PGRST202" || r.error.code === "42883" || /could not find the function/i.test(String(r.error.message || "")));
              if (!r.error) indicador = r.data ? { id: String(r.data) } : null;
              else if (semFuncao) {
                const v = await supabase.from("profiles").select("id").eq("codigo_indicacao", refCode).maybeSingle();
                indicador = (v.data as any) || null; errBuscar = v.error;
              } else errBuscar = r.error;
            }

            if (!errBuscar && (!indicador?.id || indicador.id === novoId)) podeLimpar = true;
            if (indicador?.id && indicador.id !== novoId) {
              // cada gravação tenta de novo uma vez (falha passageira de internet não perde mais o vínculo)
              const gravarVinculo = () => supabase.from("profiles").update({
                indicado_por: indicador.id,
                desconto_primeiro_mes: true,
              }).eq("id", novoId);
              let { error: errUpdate } = await gravarVinculo();
              if (errUpdate) ({ error: errUpdate } = await gravarVinculo());

              // Registra na tabela de indicações com status "cadastrou"
              const registrar = () => supabase.from("indicacoes").insert({
                indicador_id: indicador.id,
                indicada_id: novoId,
                status: "cadastrou",
              }).select();
              let { error: errInsert } = await registrar();
              if (errInsert && erroDeConexao(errInsert)) ({ error: errInsert } = await registrar());
              // (4.24) já registrada (nova tentativa depois de a resposta se perder): vale como gravada, sem novo aviso
              const jaTinha = (errInsert as { code?: string } | null)?.code === "23505";
              if (jaTinha) errInsert = null;
              podeLimpar = !errUpdate && !errInsert;

              // Dispara push pra quem indicou (template configurado no admin)
              // Fire-and-forget — não bloqueia o fluxo se falhar
              if (!errInsert && !jaTinha) {
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
          // (11/10) o código sai do aparelho depois do cadastro, gravando ou não: nada tenta de novo depois,
          // e ficar guardado faria ele grudar na próxima conta criada neste aparelho
          if (!podeLimpar) console.error("[ref] indicação não vinculada:", refCode);
        }
      } catch (err) {
        console.error("[ref] falha ao vincular indicação:", err);
      } finally {
        try { localStorage.removeItem("doonly_ref_code"); } catch { /* sem acesso ao armazenamento */ }
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
        setCadastroError("Senha inválida. Use ao menos 8 caracteres.");
      } else if (/valid email|invalid email/i.test(msg)) {
        setCadastroError("E-mail em formato inválido.");
      } else if (/rate limit|too many/i.test(msg)) {
        setCadastroError("Muitas tentativas. Aguarde 1 minuto e tente novamente.");
      } else {
        // (11/10) sem internet diz "Sem internet" (antes era sempre "Erro ao criar conta")
        setCadastroError(explicarErro(err, "Não deu pra criar a conta. Tente de novo."));
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

      {/* Lado da marca: só no computador e no tablet deitado (03/10) */}
      <div className="auth-marca" aria-hidden="true">
        <div className="auth-marca-in">
        <Mascote pose={showCadastro ? 'comemorando' : 'acenando'} className="auth-marca-masc" />
        <NomeDoonly cor="branco" className="auth-marca-nome" />
        <p className="auth-marca-frase">{showCadastro ? 'Vamos começar!' : 'Seus pedidos te esperam'}</p>
        <p className="auth-marca-sub">{showCadastro ? 'Leva menos de 1 minuto.' : 'Pedidos, agenda e financeiro num só lugar.'}</p>
        </div>
      </div>

      {!showCadastro ? (
      <div className="auth-card">
        {/* celular: o mascote sai do cartão, o nome vai dentro */}
        <Mascote pose="acenando" className="auth-masc" />
        <NomeDoonly className="auth-nome" />

        <div className="auth-text-hdr">
          <h2 className="auth-h2"><span className="so-cel">Seus pedidos te esperam</span><span className="so-pc">Entrar na conta</span></h2>
          <p className="auth-p so-cel-bloco">Pedidos, agenda e financeiro num só lugar.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="field">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              type="email"
              name="email"
              placeholder="seu@email.com"
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
                placeholder="Sua senha"
                value={form.senha}
                onChange={handleChange}
                required
                autoComplete="off"
                enterKeyHint="done"
                style={{ backgroundColor: "#fff", borderColor: "var(--border)" }}
              />
              <button type="button" tabIndex={-1} className="eye-btn" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
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
          {/* (21/10) "grátis" no título e no botão: deixa claro que não cobra nada */}
          <h2 className="auth-h2">Crie sua conta grátis</h2>
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

          {/* (21/10) Google no topo (o caminho mais rápido), com "ou com seu e-mail" embaixo. No iPhone não aparece. */}
          {!IS_IOS && (<>
          <BotaoGoogle modo="signup_with" textoReserva="Criar conta com Google" desativado={cadastroLoading} />
          <div className="auth-divider cad-ou"><span>ou com seu e-mail</span></div>
          </>)}

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
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="next"
                aria-invalid={!!(cadastroTouched.nome && cadastroErrors.nome)}
              />
              
            </div>
            {cadastroTouched.nome && cadastroErrors.nome && (
              <span className="cad-error">{cadastroErrors.nome}</span>
            )}
          </div>

          {/* Nome da confeitaria + WhatsApp (obrigatórios): lado a lado no computador */}
          <div className="cad-par cad-par--loja">
          <div className="cad-field-wrap">
            <label className="cad-lb" htmlFor="cad-confeitaria">Nome da confeitaria</label>
            <div className={`cad-field ${cadastroTouched.nomeLoja && cadastroErrors.nomeLoja ? "has-error" : ""}`}>
              <input
                id="cad-confeitaria"
                type="text"
                placeholder="Ex.: Doce Formiga"
                value={cadastroForm.nomeLoja}
                onChange={e => handleCadastroChange("nomeLoja", e.target.value)}
                onBlur={() => handleCadastroBlur("nomeLoja")}
                aria-invalid={!!(cadastroTouched.nomeLoja && cadastroErrors.nomeLoja)}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="next"
              />
              
            </div>
            {cadastroTouched.nomeLoja && cadastroErrors.nomeLoja && (
              <span className="cad-error">{cadastroErrors.nomeLoja}</span>
            )}
          </div>

          {/* Telefone */}
          <div className="cad-field-wrap">
            <label className="cad-lb" htmlFor="cad-whatsapp">WhatsApp</label>
            <div className={`cad-field ${cadastroTouched.telefone && cadastroErrors.telefone ? "has-error" : ""}`}>
              <input
                id="cad-whatsapp"
                type="tel"
                placeholder="(41) 99999-0000"
                value={cadastroForm.telefone}
                onChange={e => handleCadastroChange("telefone", e.target.value)}
                onBlur={() => handleCadastroBlur("telefone")}
                autoComplete="off"
                inputMode="tel"
                enterKeyHint="next"
                aria-invalid={!!(cadastroTouched.telefone && cadastroErrors.telefone)}
              />
              
            </div>
            {cadastroTouched.telefone && cadastroErrors.telefone && (
              <span className="cad-error">{cadastroErrors.telefone}</span>
            )}
          </div>
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

          {/* Senha + confirmação (lado a lado no computador; as regras ficam logo abaixo da senha) */}
          <div className="cad-par cad-par--senha">
          <div className="cad-field-wrap cad-a-senha">
            <label className="cad-lb" htmlFor="cad-senha">Senha</label>
            <div className={`cad-field ${cadastroTouched.senha && cadastroErrors.senha ? "has-error" : ""}`}>
              <input
                id="cad-senha"
                type={showCadastroSenha ? "text" : "password"}
                placeholder="Crie uma senha"
                value={cadastroForm.senha}
                onChange={e => handleCadastroChange("senha", e.target.value)}
                onBlur={() => handleCadastroBlur("senha")}
                required
                autoComplete="off"
                enterKeyHint="next"
                aria-invalid={!!(cadastroTouched.senha && cadastroErrors.senha)}
              />
              <button
                type="button"
                tabIndex={-1}
                className="cad-eye"
                onClick={() => setShowCadastroSenha(!showCadastroSenha)}
                aria-label={showCadastroSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {showCadastroSenha ? <EyeSlash size={20} weight="regular" /> : <Eye size={20} weight="regular" />}
              </button>
            </div>
            {cadastroTouched.senha && cadastroErrors.senha && !cadastroForm.senha && (
              <span className="cad-error">{cadastroErrors.senha}</span>
            )}
          </div>

          {/* Regras da senha: visíveis desde o início (antes só apareciam ao digitar) */}
          <ul className={`pw-req cad-a-regras ${cadastroTouched.senha && cadastroErrors.senha && cadastroForm.senha ? "pw-req--erro" : ""}`} aria-label="A senha precisa ter" aria-live="polite">
            {([
              ["length", "8 caracteres ou mais"],
            ] as const).map(([k, txt]) => (
              <li key={k} className={passwordChecks[k] ? "ok" : ""}>
                <span className="pw-req-dot" aria-hidden="true">{passwordChecks[k] ? <Check size={12} weight="bold" /> : "•"}</span>
                {txt}
              </li>
            ))}
          </ul>

          {/* Confirmar Senha */}
          <div className="cad-field-wrap cad-a-conf">
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
                autoComplete="off"
                enterKeyHint="done"
                aria-invalid={!!(cadastroTouched.confirmarSenha && cadastroErrors.confirmarSenha)}
              />
              <button
                type="button"
                tabIndex={-1}
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
          <Botao type="submit" cheio className="cad-btn" carregando={cadastroLoading}>{cadastroLoading ? "Criando conta…" : "Criar conta grátis"}</Botao>
          <p className="cad-termos" style={{ fontSize: '12.5px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.5', margin: '0' }}>
            Ao criar sua conta, você concorda com nossos{' '}
            <a href="/termos" onClick={abrirDoc("termos")} style={{ color: '#C33A6E', fontWeight: 700, whiteSpace: 'nowrap' }}>Termos de uso</a>
            {' '}e{' '}
            <a href="/privacidade" onClick={abrirDoc("privacidade")} style={{ color: '#C33A6E', fontWeight: 700, whiteSpace: 'nowrap' }}>Política de privacidade</a>
          </p>
          <div className="cad-mobile-login-link">
            <span>Já tem conta? </span>
            <button type="button" className="cadastro-link" onClick={() => setShowCadastro(false)}>Entrar</button>
          </div>
        </form>
      </div>
      )}

      </div>

      {/* 13/10: o rodapé com Termos e Privacidade saiu (cadastro tem o "Li e concordo"; login pelo Google pede o aceite depois) */}

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
        .auth-layout { position: relative; z-index: 2; width: 100%; max-width: 440px; display: flex; flex-direction: column; margin: auto 0; flex-shrink: 0; }

        /* ── Botão "Fazer login" flutuante no topo (só desktop) ── */
        .fade-overlay { position: fixed; inset: 0; z-index: 100; background: var(--bg-card); opacity: 0; pointer-events: none; transition: opacity 0.7s ease; }
        .fade-overlay.fade-in { opacity: 1; pointer-events: all; }
        .auth-bg {
          position: fixed; inset: 0; z-index: 0;
          background: var(--vinho-fundo, radial-gradient(1000px 640px at 50% 38%, var(--ui-vinho) 0%, var(--ui-vinho-escuro) 72%)); /* vinho escuro (themes.css) */
        }
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
        .auth-masc { position: absolute; left: 50%; top: -96px; transform: translateX(-50%); width: 136px; height: auto; z-index: 3; filter: drop-shadow(0 0 12px rgba(255,157,196,.38)); /* (15/10) só o brilho rosa, mais fraco (saiu a sombra escura) */ pointer-events: none; }
        .auth-nome { display: block; width: 128px; height: auto; margin: 0 auto 6px; }
        .so-pc { display: none; }
        .auth-marca { display: none; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes promoFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .auth-text-hdr {
          text-align: center;
          margin-bottom: 1rem;
          display: block; /* título também no celular (03/10) */
        }
        @media (min-width: 900px) {
          .auth-text-hdr { display: block; }
        }
        .auth-h2 { font-size: 22px; font-weight: 700; color: var(--ui-texto); margin: 0 0 2px; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } /* guia: título da tela 22px */
        .auth-p { font-size: 13.5px; color: var(--ui-texto-2); line-height: 1.45; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .auth-form { display: flex; flex-direction: column; gap: 1rem; }
        .field { display: flex; flex-direction: column; gap: 0.35rem; }
        .field label { font-size: 13px; font-weight: 700; color: var(--ui-cinza-texto); margin-left: 2px; }
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
        .eye-btn { position: absolute; right: 3px; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; background: none; border: none; border-radius: var(--ui-raio-p); cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; padding: 0; -webkit-tap-highlight-color: transparent; }
        .eye-btn:focus-visible, .cad-eye:focus-visible, .cadastro-link:focus-visible, .forgot-link:focus-visible { outline: 3px solid rgba(232,90,140,.45); outline-offset: 1px; border-radius: 8px; }
        .keep-connected input[type="checkbox"]:focus-visible { outline: 3px solid rgba(232,90,140,.45) !important; outline-offset: 2px; }
        .eye-btn:hover { color: var(--primary); }
        .login-bottom-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: nowrap; gap: 0.5rem; }
        .keep-connected { position: relative; display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; min-height: 44px; padding-right: 6px; }
        .keep-connected input[type="checkbox"] { accent-color: var(--primary); width: 15px; height: 15px; cursor: pointer; }
        .keep-connected label { font-size: var(--font-helper); color: var(--text-primary); cursor: pointer; white-space: nowrap; }
        .keep-connected label::before { content: ''; position: absolute; inset: 0; }
        .forgot-link { display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; color: var(--ui-rosa-escuro); text-decoration: none; white-space: nowrap; font-weight: 700; padding: 0; -webkit-tap-highlight-color: transparent; }
        .forgot-link:hover { text-decoration: underline; }
        .auth-error { background: #fff1f2; border: 1px solid #fecdd3; color: var(--error); border-radius: var(--radius-sm); padding: 0.6rem 0.9rem; font-size: var(--font-button); }
        .cadastro-link-wrap { text-align: center; font-size: var(--font-button); color: var(--text-secondary); }
        .cadastro-link { background: none; border: none; color: var(--primary); font-weight: 700; cursor: pointer; font-family: inherit; font-size: var(--font-button); text-decoration: underline; -webkit-tap-highlight-color: transparent;  padding: 0 4px; min-height: 44px; font-weight: 700; color: var(--ui-rosa-escuro); }
        @keyframes spin { to { transform: rotate(360deg); } }
        .auth-divider { display: flex; align-items: center; gap: 0.75rem; color: var(--text-muted); font-size: var(--font-helper); }
        .auth-divider::before, .auth-divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
        .google-btn { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 0.75rem; background: var(--bg-card); color: var(--text-primary); border: 1.5px solid var(--border); border-radius: var(--radius-sm); font-family: inherit; font-size: var(--font-input); font-weight: var(--fw-medium); cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s; width: 100%; min-height: 48px; -webkit-tap-highlight-color: transparent; -webkit-appearance: none; appearance: none; }
        .google-btn:hover { border-color: var(--text-muted); box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        .google-btn:active { transform: scale(0.98); }

        /* ── Cadastro ─────────────────────────────────────── */
        /* (15/10) mais respiro entre os campos também no celular (era 12px) */
        .cadastro-form { display: flex; flex-direction: column; gap: 1.125rem; padding-top: 0.5rem; }

        /* Banner de indicação (aparece na aba Cadastro se veio via ?ref=) */
        .ref-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: linear-gradient(135deg, var(--primary-light) 0%, #F4C0D1 100%);
          border: 1.5px solid var(--ui-rosa);
          border-radius: var(--ui-raio);
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
          color: var(--primary-light);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
          font-weight: 700;
          flex-shrink: 0;
          overflow: hidden;
          border: 2px solid var(--ui-branco);
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
          color: var(--ui-vinho);
          line-height: 1.3;
          font-weight: 500;
        }
        .ref-banner-title b { font-weight: 700; color: var(--ui-vinho-claro); }
        .ref-banner-desc {
          font-size: 13px;
          color: #993556;
          margin-top: 2px;
          line-height: 1.35;
        }
        .ref-banner-desc b { font-weight: 700; }
        .cad-field-wrap { display: flex; flex-direction: column; gap: 0.3rem; }
        .cad-field { position: relative; display: flex; align-items: center; height: 48px; border: 1.5px solid var(--border); border-radius: var(--ui-raio); overflow: hidden; background: var(--ui-branco); transition: border-color 0.2s; }
        .cad-lb { display: block; cursor: pointer; font-size: 13px; font-weight: 700; color: var(--ui-cinza-texto); margin: 0 0 7px 2px; }
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
        .cad-eye { background: none; border: none; cursor: pointer; padding: 0 0.85rem; height: 46px; min-width: 44px; justify-content: center; display: flex; align-items: center; color: var(--text-muted); flex-shrink: 0; -webkit-tap-highlight-color: transparent; }
        .cad-eye:hover { color: var(--primary); }
        .cad-error { font-size: 12.5px; color: var(--error); padding-left: 2px; font-weight: 700; }
        .cad-btn { margin-top: 0.5rem; }
        .cad-par { display: flex; flex-direction: column; gap: 1.125rem; }
        .cad-par--senha .cad-a-regras { margin-top: calc(-1.125rem + 6px); }

        /* Link "Já tem conta? Fazer login" — só mobile no fim do form */
        .cad-mobile-login-link {
          text-align: center;
          font-size: 0.9rem;
          color: var(--text-secondary);
          padding-top: 0.5rem;
        }

        /* ── Requisitos da senha (substitui medidor) ──────── */
        .pw-req { list-style: none; padding: 0 0 0 2px; margin: 0; display: flex; flex-wrap: wrap; column-gap: 14px; row-gap: 2px; }
        .pw-req li { display: flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 500; color: var(--ui-texto-2); transition: color 0.2s ease; }
        .pw-req li.ok { color: var(--ui-verde); }
        .pw-req--erro li:not(.ok) { color: var(--error); font-weight: 700; }
        .pw-req-dot { display: inline-flex; align-items: center; justify-content: center; width: 12px; height: 12px; font-size: 14px; font-weight: 700; flex-shrink: 0; }
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

        @media (min-width: 900px) {
          /* um cartão só, dividido: marca (rosa) | formulário (branco) — 03/10 */
          .auth-layout { max-width: 960px !important; display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 0 !important; align-items: stretch;
            background: var(--ui-branco); border-radius: 28px; box-shadow: 0 30px 70px -30px rgba(80,20,45,.45); }
          .auth-marca { display: block; text-align: center; color: var(--ui-branco); padding: 0 40px; border-radius: 28px 0 0 28px;
            background: linear-gradient(160deg, #FF9DC4 0%, var(--ui-rosa) 55%, var(--ui-rosa-escuro) 100%); position: relative; }
          /* o conteúdo fica no centro da parte VISÍVEL do painel (no cadastro o cartão é mais alto que a tela) */
          .auth-marca-in { position: sticky; top: 0; height: min(100%, calc(100vh - 48px)); height: min(100%, calc(100dvh - 48px)); display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .auth-marca-masc { display: block; width: 170px; height: auto; filter: drop-shadow(0 12px 16px rgba(80,10,40,.3)); }
          .auth-marca-nome { display: block; width: 210px; max-width: 100%; height: auto; margin-top: 14px; }
          .auth-marca-frase { font-size: 24px; font-weight: 700; margin: 22px 0 6px; letter-spacing: -0.01em; } /* guia: 24px, o maior da escala */
          .auth-marca-sub { font-size: 15px; opacity: .92; margin: 0; }
          .auth-card { margin: 0 !important; padding: 48px 44px !important; box-shadow: none !important; border-radius: 0 28px 28px 0 !important; display: flex; flex-direction: column; justify-content: center; animation: none; }
          .auth-masc, .auth-nome { display: none !important; }
          .so-cel { display: none; } .so-pc { display: inline; }
          .so-cel-bloco { display: none !important; } /* computador: o cartão tem só o título */
          .auth-card .auth-text-hdr { margin-bottom: 1.25rem; } /* o cartão já tem "Já tem conta? Entrar" no fim */
          /* Cadastro no computador (10/10): cabe inteiro em 800px de altura (antes o "Criar conta com Google" ficava cortado) */
          .auth-root { padding-top: 16px; padding-bottom: 16px; }
          /* (15/10) mais respiro entre os campos (antes ficava apertado pra caber em 800px de altura) */
          .cadastro-form { gap: 16px; padding-top: 0; }
          .auth-card:has(.cadastro-form) { padding: 36px 44px !important; max-width: none; } /* 13/10: ocupa a metade toda (antes ficava em 360px e os campos lado a lado cortavam o texto) */
          .auth-card:has(.cadastro-form) .auth-text-hdr { margin-bottom: 18px; }
          .cadastro-form .cad-field { height: 46px; }
          .cadastro-form .cad-eye { height: 44px; }
          .cadastro-form .cad-lb { margin-bottom: 6px; line-height: 1.3; }
          .cadastro-form .cad-field-wrap { gap: 4px; }
          .cad-par { display: grid; column-gap: 14px; row-gap: 10px; align-items: start; }
          /* 13/10: minmax(0, …) e min-width 0: sem isso o campo da direita (WhatsApp, Confirmar a senha) passava pra fora do cartão */
          .cad-par--loja { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
          .cad-par--senha { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-areas: "senha conf" "regras regras"; }
          .cad-par > * { min-width: 0; }
          .cad-par .cad-field, .cad-par input { min-width: 0; max-width: 100%; box-sizing: border-box; }
          .cad-par input { width: 100%; }
          .cad-par--senha .cad-a-senha { grid-area: senha; }
          .cad-par--senha .cad-a-conf { grid-area: conf; }
          .cad-par--senha .cad-a-regras { grid-area: regras; margin-top: 0; }
          .cad-btn { margin-top: 6px; }
          .cad-mobile-login-link { padding-top: 0; }
          /* Grid layouts:
             - Desktop/tablet: form centralizado
             - Mobile: só o form */
          /* (grid antigo de 1 coluna removido: agora são 2 colunas, acima) */
          /* Esconde coluna esquerda antiga (mascote lado) */
          .auth-card { margin: 0; }
          /* (07/10) o link "Já tem conta? Entrar" aparece também no computador: sem ele não tinha como voltar pro login */
          /* Restaura o topbar no desktop */
          /* (botão flutuante "Já tem conta?" desligado no computador: o cartão já tem o link) */
        }
      `}</style>
    </div>
  );
}

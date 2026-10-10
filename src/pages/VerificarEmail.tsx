import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, CheckCircle, EnvelopeSimple, LinkBreak, WarningCircle } from "@phosphor-icons/react";
import { Botao, Campo } from "@/components/base";
import { TelaConta } from "@/components/conta/TelaConta";

// ─────────────────────────────────────────────────────────────
// Página de callback do link de verificação de email.
//
// Fluxo:
// 1. Confeiteira clica no link do email do Supabase.
// 2. O link redireciona para /verificar-email com um code na URL.
// 3. Trocamos o code por uma sessão via exchangeCodeForSession.
// 4. Se der certo → mostra sucesso + redireciona pra /inicio em 2.5s.
// 5. Se falhar (link expirado ou já usado) → mostra erro + reenviar o e-mail de confirmação.
//
// Também suporta o formato antigo com token_hash na query string,
// mantendo compat com links já enviados durante deploy.
//
// (10/10) Refeita no desenho das outras telas de conta (TelaConta: fundo vinho, mascote, cartão,
// Botao do base). Saiu o degradê animado e a fonte DM Sans carregada do Google.
// ─────────────────────────────────────────────────────────────

type Status = "loading" | "success" | "error";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function VerificarEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // Reenviar o e-mail de confirmação (quando o link não serve mais)
  const [emailConhecido, setEmailConhecido] = useState("");
  const [emailDigitado, setEmailDigitado] = useState("");
  const [emailErro, setEmailErro] = useState("");
  const [reenviando, setReenviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);
  const [reenvioErro, setReenvioErro] = useState("");

  // ── Processa o callback do email ────────────────────────────
  useEffect(() => {
    const verify = async () => {
      try {
        // Formato novo (PKCE): ?code=xxx
        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setStatus("success");
          setTimeout(() => navigate("/inicio"), 2500);
          return;
        }

        // Formato antigo/hash: #access_token=xxx&refresh_token=yyy&type=signup
        // O Supabase SDK v2 processa automaticamente ao carregar a página.
        // Verificamos a sessão após um pequeno delay pra dar tempo do SDK processar.
        await new Promise(r => setTimeout(r, 300));
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setStatus("success");
          setTimeout(() => navigate("/inicio"), 2500);
          return;
        }

        // Formato token_hash (fluxo OTP): ?token_hash=xxx&type=signup
        const token_hash = searchParams.get("token_hash");
        const type = searchParams.get("type");
        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as any,
          });
          if (error) throw error;
          setStatus("success");
          setTimeout(() => navigate("/inicio"), 2500);
          return;
        }

        // Nenhum parâmetro reconhecido
        throw new Error("Link inválido ou expirado.");
      } catch (err: any) {
        const msg = err?.message || "";
        if (/expired|invalid/i.test(msg)) {
          setErrorMsg("O link venceu ou já foi usado. Peça um novo e use assim que chegar.");
        } else {
          setErrorMsg("Não conseguimos confirmar seu e-mail com esse link. Peça um novo.");
        }
        // E-mail pra reenviar: o que vier no endereço (?email=) ou o da sessão, se houver
        let email = (searchParams.get("email") || "").trim();
        if (!email) {
          try {
            const { data } = await supabase.auth.getSession();
            email = data.session?.user?.email || "";
          } catch { /* sem sessão: a pessoa digita */ }
        }
        setEmailConhecido(email);
        setStatus("error");
      }
    };

    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reenviar = async (e?: FormEvent) => {
    e?.preventDefault();
    if (reenviando) return;
    const email = (emailConhecido || emailDigitado).trim();
    if (!emailConhecido) {
      if (!email) { setEmailErro("Informe seu e-mail"); return; }
      if (!EMAIL_REGEX.test(email)) { setEmailErro("E-mail incompleto (Ex.: nome@gmail.com)"); return; }
    }
    setEmailErro("");
    setReenvioErro("");
    setReenviando(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/verificar-email` },
      });
      if (error) throw error;
      setReenviado(true);
    } catch (err: any) {
      const msg = err?.message || "";
      if (/rate limit|too many|seconds/i.test(msg)) {
        setReenvioErro("Muitos pedidos seguidos. Espere 1 minuto e tente de novo.");
      } else if (!navigator.onLine || /failed to fetch|network|load failed/i.test(msg)) {
        setReenvioErro("Sem conexão. Confira a internet e tente de novo.");
      } else {
        setReenvioErro("Não conseguimos reenviar agora. Tente de novo em instantes.");
      }
    } finally {
      setReenviando(false);
    }
  };

  const voltar = <Botao variante="link" icone={<ArrowLeft size={16} weight="bold" />} onClick={() => navigate("/login")}>Voltar pro login</Botao>;

  return (
    <TelaConta
      compacto={status === "loading"}
      pose={status === "error" ? "senha" : "acenando"}
      frase={status === "success" ? "Tudo certo" : "Quase lá"}
      sub={status === "success" ? "Sua conta está pronta." : "Só falta confirmar seu e-mail."}
    >
      {status === "loading" && (
        <div className="tc-espera" role="status" aria-live="polite">
          <span className="ui-gira" aria-hidden="true" />
          <h1 className="tc-h">Confirmando seu e-mail…</h1>
        </div>
      )}

      {status === "success" && (
        <div role="status">
          <span className="tc-ic tc-ic--verde" aria-hidden="true"><CheckCircle size={32} /></span>
          <h1 className="tc-h">E-mail confirmado</h1>
          <p className="tc-p">Sua conta está pronta. Estamos te levando pro Doonly…</p>
          <div className="tc-acoes"><Botao cheio onClick={() => navigate("/inicio")}>Entrar agora</Botao></div>
        </div>
      )}

      {status === "error" && (reenviado ? (
        <div role="status">
          <span className="tc-ic" aria-hidden="true"><EnvelopeSimple size={32} /></span>
          <h1 className="tc-h">Confira seu e-mail</h1>
          <p className="tc-p">Mandamos um link novo pra <b>{(emailConhecido || emailDigitado).trim()}</b></p>
          <p className="tc-dica">Não chegou? Olhe também a caixa de spam.</p>
          <div className="tc-acoes">{voltar}</div>
        </div>
      ) : (
        <div>
          <span className="tc-ic tc-ic--laranja" aria-hidden="true"><LinkBreak size={32} /></span>
          <h1 className="tc-h">Link inválido</h1>
          <p className="tc-p">{errorMsg}</p>
          <form onSubmit={reenviar} className="tc-form" noValidate>
            {emailConhecido ? (
              <p className="tc-p" style={{ margin: 0, textAlign: "center" }}>Vamos mandar pra <b>{emailConhecido}</b></p>
            ) : (
              <Campo
                id="reenviar-email"
                rotulo="E-mail"
                type="email"
                placeholder="Digite seu e-mail"
                value={emailDigitado}
                onChange={e => { setEmailDigitado(e.target.value); setEmailErro(""); setReenvioErro(""); }}
                erro={emailErro || undefined}
                autoComplete="email"
                inputMode="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="send"
              />
            )}
            {reenvioErro && <p className="tc-erro" role="alert"><WarningCircle size={16} weight="bold" aria-hidden="true" /><span>{reenvioErro}</span></p>}
            <div className="tc-acoes">
              <Botao type="submit" cheio carregando={reenviando}>{reenviando ? "Enviando…" : "Reenviar e-mail de confirmação"}</Botao>
              {voltar}
            </div>
          </form>
        </div>
      ))}
    </TelaConta>
  );
}

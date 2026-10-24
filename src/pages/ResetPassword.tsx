import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Circle, ClockCountdown, LinkBreak, WarningCircle } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { Botao, Campo, avisar } from "@/components/base";
import { TelaConta } from "@/components/conta/TelaConta";

/**
 * Criar nova senha (refeita em 07/10 no desenho do login) — a tela que abre pelo link do e-mail.
 * (21/10) um campo só de senha (com o olho), a conta num selo embaixo do título, "Salvar e entrar" leva
 * direto pro Início (sem passar pelo login), endereço sem link mostra na hora "Esse link não funciona mais"
 * e o cartão fica sempre na altura padrão.
 */
type Status = "processing" | "ready" | "invalid" | "expired";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState<Status>("processing");
  const [senha, setSenha] = useState("");
  const [emailConta, setEmailConta] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Requisitos da senha em tempo real
  const checks = {
    length: senha.length >= 8, // 13/10: só o tamanho, igual ao cadastro
  };

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const processCallback = async () => {
      try {
        const errorCode = searchParams.get("error_code") || searchParams.get("error");
        if (errorCode) {
          if (/expired|otp_expired/i.test(errorCode)) {
            if (mounted) setStatus("expired");
          } else {
            if (mounted) setStatus("invalid");
          }
          return;
        }

        const code = searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (/expired/i.test(exchangeError.message)) {
              if (mounted) setStatus("expired");
            } else {
              if (mounted) setStatus("invalid");
            }
            return;
          }
          if (mounted) setStatus("ready");
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          if (mounted) setStatus("ready");
          return;
        }

        // (21/10) endereço sem nenhum link (sem código e sem token no #): mostra na hora, sem os 8 s de espera
        if (!/access_token|type=recovery/.test(window.location.hash || "")) {
          if (mounted) setStatus("invalid");
          return;
        }

        const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
          if (!mounted) return;
          if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
            setStatus("ready");
            if (timeoutId) clearTimeout(timeoutId);
          }
        });
        subscription = authListener.subscription;

        // Timeout aumentado para 8s (conexões mobile lentas)
        timeoutId = setTimeout(() => {
          if (mounted) setStatus(prev => prev === "processing" ? "invalid" : prev);
        }, 8000);
      } catch (err) {
        if (mounted) setStatus("invalid");
      }
    };

    processCallback();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a conta que vai ganhar a senha nova (o link já identificou)
  useEffect(() => {
    if (status !== "ready") return;
    supabase.auth.getUser().then(({ data }) => setEmailConta(data.user?.email || "")).catch(() => {});
  }, [status]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || success) return; // já está salvando
    setError("");

    if (!checks.length) return setError("A senha precisa ter pelo menos 8 caracteres.");

    setLoading(true);
    let err: { message?: string } | null = null;
    try {
      ({ error: err } = await supabase.auth.updateUser({ password: senha }));
    } catch (falha: any) {
      err = { message: falha?.message || "failed to fetch" };
    }
    setLoading(false);

    if (err) {
      const msg = err.message || "";
      if (/expired|invalid|otp/i.test(msg)) {
        setError("O link venceu. Peça um link novo.");
      } else if (/same.*password|same_password/i.test(msg)) {
        setError("A senha nova precisa ser diferente da atual.");
      } else if (!navigator.onLine || /failed to fetch|network|load failed/i.test(msg)) {
        setError("Sem conexão. Confira a internet e tente de novo.");
      } else {
        setError("Não conseguimos salvar a senha nova. Tente de novo.");
      }
      return;
    }
    // (21/10) "Salvar e entrar": já está conectada pelo link, vai direto pro Início
    setSuccess(true);
    avisar("Senha nova salva", { tipo: "ok" });
    navigate("/inicio", { replace: true });
  };

  const handlePedirNovoLink = () => navigate("/esqueci-senha");
  const handleVoltarLogin = () => navigate("/login");

  const Req = ({ ok, children }: { ok: boolean; children: string }) => (
    <li className={ok ? "ok" : ""}>{ok ? <Check size={14} weight="bold" aria-hidden="true" /> : <Circle size={14} weight="bold" aria-hidden="true" />}<span>{children}</span></li>
  );
  const voltar = <Botao variante="link" icone={<ArrowLeft size={16} weight="bold" />} onClick={handleVoltarLogin}>Voltar para o login</Botao>;

  return (
    <TelaConta
      pose={status === "invalid" || status === "expired" ? "senha" : "acenando"}
      frase={success ? "Tudo certo" : "Senha nova, vida nova"}
      sub={success ? "Sua conta está protegida de novo." : "Escolha uma senha que só você sabe."}
    >
      {status === "processing" && (
        <div className="tc-espera" role="status" aria-live="polite">
          <span className="ui-gira" aria-hidden="true" />
          <h1 className="tc-h">Conferindo seu link…</h1>
          <div className="tc-acoes" style={{ marginTop: 0 }}>{voltar}</div>
        </div>
      )}

      {status === "invalid" && (
        <div>
          <span className="tc-ic tc-ic--laranja" aria-hidden="true"><LinkBreak size={32} /></span>
          <h1 className="tc-h">Esse link não funciona mais</h1>
          <p className="tc-p">Ele já foi usado ou veio incompleto. Peça um link novo que a gente manda na hora.</p>
          <div className="tc-acoes">
            <Botao cheio onClick={handlePedirNovoLink}>Pedir link novo</Botao>
            {voltar}
          </div>
        </div>
      )}

      {status === "expired" && (
        <div>
          <span className="tc-ic tc-ic--laranja" aria-hidden="true"><ClockCountdown size={32} /></span>
          <h1 className="tc-h">Esse link venceu</h1>
          <p className="tc-p">Por segurança, o link vale por pouco tempo. Peça um novo e use assim que chegar.</p>
          <div className="tc-acoes">
            <Botao cheio onClick={handlePedirNovoLink}>Pedir link novo</Botao>
            {voltar}
          </div>
        </div>
      )}

      {status === "ready" && (
        <>
          <h1 className="tc-h">Criar nova senha</h1>
          {emailConta ? <p className="tc-selo"><span>Conta:</span> <b>{emailConta}</b></p> : <p className="tc-p">Escolha uma senha nova para sua conta.</p>}
          <form onSubmit={handleSubmit} className="tc-form" noValidate>
            <div>
              <Campo
                id="nova-senha"
                rotulo="Senha nova"
                type="password"
                placeholder="Crie uma senha"
                value={senha}
                onChange={e => { setSenha(e.target.value); setError(""); }}
                autoComplete="off"
                enterKeyHint="done"
              />
              <ul className="tc-req" aria-label="A senha precisa ter" style={{ marginTop: 8 }}>
                <Req ok={checks.length}>8 caracteres ou mais</Req>
              </ul>
            </div>
            {error && <p className="tc-erro" role="alert"><WarningCircle size={16} weight="bold" aria-hidden="true" /><span>{error}</span></p>}
            <div className="tc-acoes">
              <Botao type="submit" cheio carregando={loading}>{loading || success ? "Salvando…" : "Salvar e entrar"}</Botao>
              {voltar}
            </div>
          </form>
        </>
      )}
    </TelaConta>
  );
}

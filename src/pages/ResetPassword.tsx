import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, CheckCircle, Circle, ClockCountdown, LinkBreak, WarningCircle } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { Botao, Campo } from "@/components/base";
import { TelaConta } from "@/components/conta/TelaConta";

/**
 * Criar nova senha (refeita em 07/10 no desenho do login) — a tela que abre pelo link do e-mail.
 * A lógica é a de antes (confere o link, salva a senha, sai e leva pro login); mudaram a aparência e os textos.
 */
type Status = "processing" | "ready" | "invalid" | "expired";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState<Status>("processing");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [tentou, setTentou] = useState(false);

  // Requisitos da senha em tempo real
  const checks = {
    length: senha.length >= 6,
    letter: /[a-zA-Z]/.test(senha),
    number: /\d/.test(senha),
    match: senha === confirmar && confirmar.length > 0,
  };
  const senhaValida = checks.length && checks.letter && checks.number;

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || success) return; // já está salvando
    setError("");
    setTentou(true);

    if (!checks.length) return setError("A senha precisa ter pelo menos 6 caracteres.");
    if (!checks.letter) return setError("A senha precisa ter pelo menos 1 letra.");
    if (!checks.number) return setError("A senha precisa ter pelo menos 1 número.");
    if (senha !== confirmar) return setError("As duas senhas precisam ser iguais.");

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
    setSuccess(true);
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate("/login");
    }, 3500);
  };

  const handlePedirNovoLink = () => navigate("/esqueci-senha");
  const handleVoltarLogin = () => navigate("/login");
  const irProLoginAgora = async () => { await supabase.auth.signOut(); navigate("/login"); };

  const Req = ({ ok, children }: { ok: boolean; children: string }) => (
    <li className={ok ? "ok" : ""}>{ok ? <Check size={14} weight="bold" aria-hidden="true" /> : <Circle size={14} weight="bold" aria-hidden="true" />}<span>{children}</span></li>
  );
  const voltar = <Botao variante="link" icone={<ArrowLeft size={16} weight="bold" />} onClick={handleVoltarLogin}>Voltar pro login</Botao>;

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

      {status === "ready" && (success ? (
        <div role="status">
          <span className="tc-ic tc-ic--verde" aria-hidden="true"><CheckCircle size={32} /></span>
          <h1 className="tc-h">Senha nova salva</h1>
          <p className="tc-p">Agora é só entrar com ela. Estamos te levando pro login…</p>
          <div className="tc-acoes"><Botao cheio onClick={irProLoginAgora}>Ir pro login</Botao></div>
        </div>
      ) : (
        <>
          <h1 className="tc-h">Criar nova senha</h1>
          <p className="tc-p">Escolha uma senha nova pra sua conta.</p>
          <form onSubmit={handleSubmit} className="tc-form" noValidate>
            <div>
              <Campo
                id="nova-senha"
                rotulo="Senha nova"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={senha}
                onChange={e => { setSenha(e.target.value); setError(""); }}
                autoComplete="new-password"
                enterKeyHint="next"
              />
              <ul className="tc-req" aria-label="A senha precisa ter" style={{ marginTop: 8 }}>
                <Req ok={checks.length}>6 caracteres ou mais</Req>
                <Req ok={checks.letter}>1 letra</Req>
                <Req ok={checks.number}>1 número</Req>
              </ul>
            </div>
            <Campo
              id="confirmar-senha"
              rotulo="Confirmar a senha"
              type="password"
              placeholder="Repita a senha"
              value={confirmar}
              onChange={e => { setConfirmar(e.target.value); setError(""); }}
              erro={(confirmar || tentou) && senhaValida && !checks.match ? "As duas senhas precisam ser iguais." : undefined}
              autoComplete="new-password"
              enterKeyHint="done"
            />
            {error && !(senhaValida && !checks.match) && <p className="tc-erro" role="alert"><WarningCircle size={16} weight="bold" aria-hidden="true" /><span>{error}</span></p>}
            <div className="tc-acoes">
              <Botao type="submit" cheio carregando={loading}>{loading ? "Salvando…" : "Salvar senha nova"}</Botao>
              {voltar}
            </div>
          </form>
        </>
      ))}
    </TelaConta>
  );
}

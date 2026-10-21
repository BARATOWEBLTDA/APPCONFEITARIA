import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, EnvelopeSimple, WarningCircle } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { linkWhatsApp } from "@/lib/telefone";
import IconeWhatsApp from "@/components/IconeWhatsApp";
import { Botao, Campo } from "@/components/base";
import { TelaConta } from "@/components/conta/TelaConta";

/**
 * Esqueci a senha (refeita em 07/10 no desenho do login).
 * A pessoa digita o e-mail da conta e o Doonly manda um link pra criar uma senha nova.
 * A lógica é a de antes (supabase.auth.resetPasswordForEmail); mudaram a aparência e os textos.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// (21/10) WhatsApp da equipe Doonly (o mesmo das boas-vindas), pra quem não lembra o e-mail
const ZAP_SUPORTE = linkWhatsApp("11978414991", "Oi! Não lembro qual e-mail usei pra criar minha conta no Doonly.");
const ESPERA = 60; // segundos até poder pedir o e-mail de novo (o servidor recusa antes disso)

const validarEmail = (v: string) => {
  const t = v.trim();
  if (!t) return "Informe seu e-mail";
  if (!t.includes("@")) return "Está faltando o @ no seu e-mail";
  if (!EMAIL_REGEX.test(t)) return "E-mail incompleto (Ex.: nome@gmail.com)";
  return "";
};

export default function EsqueciSenha() {
  const navigate = useNavigate();
  const location = useLocation();
  // quem veio do login já traz o e-mail que tinha digitado lá
  const [email, setEmail] = useState(() => String((location.state as { email?: string } | null)?.email || ""));
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [touched, setTouched] = useState(false);
  const [falta, setFalta] = useState(0);

  useEffect(() => {
    if (falta <= 0) return;
    const t = window.setTimeout(() => setFalta(f => f - 1), 1000);
    return () => window.clearTimeout(t);
  }, [falta]);

  const handleEmailChange = (v: string) => {
    setEmail(v);
    setError("");
    if (touched) setEmailError(validarEmail(v));
  };

  const handleEmailBlur = () => {
    setTouched(true);
    setEmailError(validarEmail(email));
  };

  const enviar = async () => {
    if (loading) return; // já está enviando: não manda dois e-mails
    setLoading(true);
    setError("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
      setFalta(ESPERA);
    } catch (err: any) {
      const msg = err?.message || "";
      if (/rate limit|too many/i.test(msg)) {
        setError("Muitos pedidos seguidos. Espere 1 minuto e tente de novo.");
      } else if (!navigator.onLine || /failed to fetch|network|load failed/i.test(msg)) {
        setError("Sem conexão. Confira a internet e tente de novo.");
      } else {
        setError("Não conseguimos enviar o e-mail agora. Tente de novo em instantes.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const err = validarEmail(email);
    if (err) {
      setTouched(true);
      setEmailError(err);
      return;
    }
    enviar();
  };

  const voltarProLogin = () => navigate("/login", { state: { email: email.trim() } });

  return (
    <TelaConta pose={sent ? "acenando" : "senha"} frase="Acontece com todo mundo" sub="Em 1 minuto você volta pro app.">
      {!sent ? (
        <>
          <h1 className="tc-h">Recuperar a senha</h1>
          <p className="tc-p">Digite o e-mail da sua conta. A gente manda um link pra você criar uma senha nova.</p>
          <form onSubmit={handleSubmit} className="tc-form" noValidate>
            <Campo
              id="reset-email"
              rotulo="E-mail da conta"
              dica={emailError ? undefined : "O mesmo e-mail que você usou pra criar a conta"}
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => handleEmailChange(e.target.value)}
              onBlur={handleEmailBlur}
              erro={emailError || undefined}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
            />
            {error && <p className="tc-erro" role="alert"><WarningCircle size={16} weight="bold" aria-hidden="true" /><span>{error}</span></p>}
            <div className="tc-acoes">
              <Botao type="submit" cheio carregando={loading}>{loading ? "Enviando…" : "Enviar link"}</Botao>
              <Botao variante="link" icone={<ArrowLeft size={16} weight="bold" />} onClick={voltarProLogin}>Voltar pro login</Botao>
            </div>
          </form>
          {ZAP_SUPORTE && <p className="tc-ajuda">Não lembra o e-mail? <a href={ZAP_SUPORTE} target="_blank" rel="noreferrer"><IconeWhatsApp size={16} />Fale com a gente</a></p>}
        </>
      ) : (
        <div role="status">
          <span className="tc-ic" aria-hidden="true"><EnvelopeSimple size={32} /></span>
          <h1 className="tc-h">Confira seu e-mail</h1>
          {/* (21/10) uma frase só; a dica lembra da aba Promoções e de usar o link logo */}
          <p className="tc-p">Se existir uma conta com <b>{email.trim()}</b>, o link chega em instantes.</p>
          <p className="tc-dica">Não chegou? Olhe a caixa de spam e a aba Promoções do Gmail. Use o link assim que chegar: ele vale por pouco tempo.</p>
          {error && <p className="tc-erro" role="alert" style={{ marginTop: 14, textAlign: "left" }}><WarningCircle size={16} weight="bold" aria-hidden="true" /><span>{error}</span></p>}
          <div className="tc-acoes">
            <Botao cheio onClick={voltarProLogin}>Voltar pro login</Botao>
            {falta > 0
              ? <p className="tc-conta">Você pode pedir de novo em {falta}s</p>
              : <Botao variante="link" disabled={loading} onClick={enviar}>{loading ? "Enviando…" : "Enviar de novo"}</Botao>}
          </div>
        </div>
      )}
    </TelaConta>
  );
}

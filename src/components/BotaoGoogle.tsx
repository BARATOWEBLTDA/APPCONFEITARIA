import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Login com Google SEM sair do app (02/10).
 * Antes o login saía pro navegador e voltava nele: no app instalado (PWA), a pessoa ficava
 * logada no navegador e deslogada no ícone do app. Agora é o botão oficial do Google
 * ("Google Identity Services"): uma janelinha do Google abre por cima, ela escolhe a conta e o
 * Google entrega a confirmação direto pro app (supabase.auth.signInWithIdToken).
 *
 * Precisa da variável VITE_GOOGLE_CLIENT_ID (o "Client ID" do Google, o mesmo do Supabase).
 * Sem ela, ou se o Google não carregar, usa o jeito antigo (redirecionamento) como reserva.
 */
declare global { interface Window { google?: any } }

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
let scriptGoogle: Promise<void> | null = null;

function carregarGoogle(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptGoogle) {
    scriptGoogle = new Promise((ok, falhou) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true; s.defer = true;
      s.onload = () => ok(); s.onerror = () => { scriptGoogle = null; falhou(new Error("google")); };
      document.head.appendChild(s);
    });
  }
  return scriptGoogle;
}

async function gerarNonce(): Promise<[string, string]> {
  const bruto = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bruto));
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  return [bruto, hex];
}

type Props = {
  /** texto do botão: entrar, cadastrar ou continuar */
  modo?: "signin_with" | "signup_with" | "continue_with";
  /** texto do botão de reserva (o jeito antigo) */
  textoReserva: string;
  /** pra onde ir depois de entrar */
  destino?: string;
  /** trava o botão enquanto o formulário de e-mail e senha está entrando (07/10) */
  desativado?: boolean;
};

export default function BotaoGoogle({ modo = "continue_with", textoReserva, destino = "/inicio", desativado = false }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const [usarReserva, setUsarReserva] = useState(!CLIENT_ID || typeof crypto?.subtle === "undefined");
  const [entrando, setEntrando] = useState(false);

  const entrarPeloJeitoAntigo = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + destino } });
  };

  useEffect(() => {
    if (usarReserva) return;
    let cancelado = false;
    const limite = setTimeout(() => { if (!cancelado && !caixa.current?.childElementCount) setUsarReserva(true); }, 5000);
    (async () => {
      try {
        await carregarGoogle();
        const [bruto, hash] = await gerarNonce();
        if (cancelado || !caixa.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          nonce: hash,
          ux_mode: "popup",
          auto_select: false,
          itp_support: true,
          use_fedcm_for_button: true,
          callback: async (resp: { credential?: string }) => {
            if (!resp?.credential) return;
            setEntrando(true);
            const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: resp.credential, nonce: bruto });
            if (error) {
              console.error("Login Google:", error.message);
              setEntrando(false);
              // não deu pelo jeito novo: tenta pelo antigo (redirecionamento)
              entrarPeloJeitoAntigo();
              return;
            }
            window.location.replace(destino);
          },
        });
        const largura = Math.min(400, Math.max(220, Math.round(caixa.current.getBoundingClientRect().width || 320)));
        window.google.accounts.id.renderButton(caixa.current, {
          type: "standard", theme: "outline", size: "large", shape: "pill",
          text: modo, logo_alignment: "center", width: largura, locale: "pt-BR",
        });
      } catch {
        if (!cancelado) setUsarReserva(true);
      }
    })();
    return () => { cancelado = true; clearTimeout(limite); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usarReserva, modo]);

  if (usarReserva) {
    return (
      <button type="button" className="google-btn" onClick={entrarPeloJeitoAntigo} disabled={desativado} style={desativado ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        {textoReserva}
      </button>
    );
  }
  return (
    <div style={{ position: "relative", minHeight: 44, display: "flex", justifyContent: "center" }} aria-disabled={desativado || undefined}>
      <div ref={caixa} style={{ width: "100%", display: "flex", justifyContent: "center", opacity: entrando || desativado ? 0.5 : 1, pointerEvents: desativado ? "none" : undefined }} />
      {entrando && <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#6B5D64" }}>Entrando…</span>}
    </div>
  );
}

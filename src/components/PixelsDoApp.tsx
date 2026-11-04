// ── PixelsDoApp.tsx ──────────────────────────────────────────────────────────
// (04/11 · 6.21) Pixels do próprio Doonly (cadastrados no painel admin › Pixels do app).
// <VisitasDoApp/> fica no App: conta a visita de cada tela (fora do cardápio público e do admin).
// <MarcosDaAssinatura/> fica no Layout do app: quando o teste grátis começa ou a 1ª cobrança passa
// (o webhook da Hotmart muda o perfil), manda StartTrial ou Subscribe + Purchase, uma vez por conta.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { visitaDoApp, eventoUnicoDoApp } from "@/lib/pixelsApp";

export function VisitasDoApp() {
  const { pathname } = useLocation();
  useEffect(() => { visitaDoApp(pathname); }, [pathname]);
  return null;
}

export function MarcosDaAssinatura() {
  const { profile } = useProfile();
  const p = profile as { id?: string; assinatura_origem?: string | null; assinatura_status?: string | null } | null;
  const origem = p?.assinatura_origem, status = p?.assinatura_status;
  useEffect(() => {
    if (!p?.id || origem !== "hotmart") return;
    if (status === "teste") void eventoUnicoDoApp("teste");
    else if (status === "ativa") void eventoUnicoDoApp("assinatura");
  }, [p?.id, origem, status]);
  return null;
}

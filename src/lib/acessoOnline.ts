// ── acessoOnline.ts ──────────────────────────────────────────────────────────
// (03/11) Avisa o banco que a conta está com o app aberto: na hora que abre, a cada
// minuto enquanto a tela está visível e quando volta pro app. O painel admin conta
// como "online agora" quem avisou nos últimos 2 minutos e usa o último acesso nas
// métricas (ativas hoje, 7 e 30 dias). Só grava a hora: nada do que ela faz no app.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "@/lib/supabase";

const INTERVALO = 60_000;
let ligado = false;
let timer: ReturnType<typeof setInterval> | null = null;

function avisar() {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
  // falha (sem internet, sem sessão) não atrapalha nada: o próximo aviso tenta de novo
  supabase.rpc("marcar_acesso").then(() => undefined, () => undefined);
}

/** Liga uma vez só, na área logada do app. */
export function ligarAcessoOnline() {
  if (ligado || typeof window === "undefined") return;
  ligado = true;
  avisar();
  timer = setInterval(avisar, INTERVALO);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") avisar(); });
  supabase.auth.onAuthStateChange((evento) => {
    if (evento === "SIGNED_OUT" && timer) { clearInterval(timer); timer = null; ligado = false; }
  });
}

/**
 * lib/notifications.ts
 * ────────────────────────────────────────────────────────────────
 * Utilitários pra notificações push web. Feito pra funcionar tanto
 * no navegador (Chrome/Edge/Firefox/Safari) quanto no futuro
 * TWA/PWA empacotado pra Play Store — a Web Push API é o padrão
 * usado nos dois casos.
 *
 * ────────────────────────────────────────────────────────────────
 * FASE 1 (atual): permissão + registro do Service Worker
 *   → Já mostra push nativa quando o SW dispara showNotification()
 *
 * FASE 2 (quando tiver backend): push subscription + envio ao servidor
 *   → Descomentar o bloco `subscribeToPush()` abaixo
 *   → Configurar `VITE_VAPID_PUBLIC_KEY` no .env e na Vercel
 *   → Criar tabela `push_subscriptions` no Supabase e Edge Function
 *     que envia via web-push. Docs: https://web.dev/push-notifications-overview/
 * ────────────────────────────────────────────────────────────────
 */

const STORAGE_KEY = "doonly_notif_ativas";

export function isNotifSupported(): boolean {
  return typeof window !== "undefined"
    && "Notification" in window
    && "serviceWorker" in navigator
    && "PushManager" in window;
}

/** Retorna o status persistido — leitura síncrona pra usar no useState inicial */
export function getStoredNotifState(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
}

function setStoredNotifState(ativo: boolean) {
  try { localStorage.setItem(STORAGE_KEY, ativo ? "1" : "0"); } catch {}
}

/** Registra o service worker /sw.js se ainda não estiver ativo. Idempotente. */
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) return existing;
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (err) {
    console.warn("[notifications] falha ao registrar SW:", err);
    return null;
  }
}

/**
 * Pede permissão de notificação e ativa. Retorna o novo estado.
 * - Se browser não suporta → alerta e volta false
 * - Se usuário negou → alerta com instrução e volta false
 * - Se aceitou → registra SW, salva localStorage, volta true
 */
export async function enableNotifications(): Promise<boolean> {
  if (!isNotifSupported()) {
    alert("Seu navegador não suporta notificações. Tente pelo Chrome, Edge ou Firefox.");
    return false;
  }

  // Se já foi negada permanentemente, orienta o usuário
  if (Notification.permission === "denied") {
    alert(
      "As notificações estão bloqueadas para este site.\n\n" +
      "Para ativar: toque no cadeado (🔒) ao lado do endereço, " +
      "vá em Notificações e altere para “Permitir”."
    );
    return false;
  }

  // Pede permissão (se ainda for "default")
  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();

  if (permission !== "granted") {
    return false;
  }

  // Garante o service worker registrado
  const reg = await ensureServiceWorker();
  if (!reg) {
    alert("Não foi possível preparar as notificações neste dispositivo.");
    return false;
  }

  // ── FASE 2 (quando tiver VAPID + backend): descomentar bloco abaixo ──
  // await subscribeToPush(reg);

  setStoredNotifState(true);
  return true;
}

/** Desativa (apenas localmente — não revoga a permissão do browser) */
export async function disableNotifications(): Promise<boolean> {
  setStoredNotifState(false);

  // ── FASE 2: cancelar subscription e avisar backend ──
  // const reg = await navigator.serviceWorker.getRegistration("/");
  // const sub = await reg?.pushManager.getSubscription();
  // if (sub) {
  //   await sub.unsubscribe();
  //   // await removeSubscriptionFromBackend(sub.endpoint);
  // }

  return false;
}

/* ═══════════════════════════════════════════════════════════════════
 *  FASE 2 — Push subscription (Web Push API)
 *  Descomentar e configurar quando tiver VAPID key + backend prontos
 * ═══════════════════════════════════════════════════════════════════
 *
 * async function subscribeToPush(reg: ServiceWorkerRegistration) {
 *   const vapidPublic = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
 *   if (!vapidPublic) return; // sem chave configurada, ignora silenciosamente
 *
 *   let sub = await reg.pushManager.getSubscription();
 *   if (!sub) {
 *     sub = await reg.pushManager.subscribe({
 *       userVisibleOnly: true,
 *       applicationServerKey: urlBase64ToUint8Array(vapidPublic),
 *     });
 *   }
 *
 *   // Envia ao backend (ex.: Supabase tabela push_subscriptions)
 *   // await supabase.from("push_subscriptions").upsert({
 *   //   user_id: (await supabase.auth.getUser()).data.user?.id,
 *   //   endpoint: sub.endpoint,
 *   //   keys: sub.toJSON().keys,
 *   // });
 * }
 *
 * function urlBase64ToUint8Array(base64String: string) {
 *   const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
 *   const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
 *   const raw = atob(base64);
 *   const out = new Uint8Array(raw.length);
 *   for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
 *   return out;
 * }
 */

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
// ── iPhone / iPad (02/10) ──
// No iPhone as notificações só existem com o Doonly instalado na tela de início (iOS 16.4+).
export function ehIphone(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (navigator as any).maxTouchPoints > 1);
}
export function estaInstalado(): boolean {
  return !!(window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone);
}
export const precisaInstalarNoIphone = (): boolean => ehIphone() && !estaInstalado();
export const PASSOS_INSTALAR_IPHONE =
  "No iPhone, as notificações só funcionam com o Doonly instalado na tela de início:\n\n" +
  "1. No Safari, toque em Compartilhar (o quadrado com a seta para cima)\n" +
  "2. Toque em \"Adicionar à Tela de Início\"\n" +
  "3. Abra o Doonly pelo ícone novo e ative as notificações de novo.";

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
  if (precisaInstalarNoIphone()) { alert(PASSOS_INSTALAR_IPHONE); return false; }
  if (!isNotifSupported()) {
    alert(ehIphone()
      ? "Este iPhone não recebe notificações do Doonly. Atualize o iPhone (iOS 16.4 ou mais novo) e instale o app na tela de início."
      : "Seu navegador não suporta notificações. Tente pelo Chrome, Edge ou Firefox.");
    return false;
  }

  // Se já foi negada permanentemente, orienta o usuário
  if (Notification.permission === "denied") {
    alert(ehIphone()
      ? "As notificações do Doonly estão desligadas neste iPhone.\n\nPara ligar: abra Ajustes → Notificações → Doonly → Permitir Notificações."
      : "As notificações estão bloqueadas para este site.\n\n" +
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

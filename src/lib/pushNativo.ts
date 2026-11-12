/**
 * (12/11) Avisos no app da Play Store (Firebase Cloud Messaging).
 * Dentro do app o Web Push do navegador não funciona: o aparelho recebe um "token" do Firebase e ele fica salvo
 * na mesma tabela dos avisos do site (push_subscriptions), com o endereço "fcm:<token>". As funções do servidor
 * (push-pessoal, send-push) mandam pelo Firebase quando o endereço começa com "fcm:".
 * Fora do app da loja nada aqui roda.
 */
import { PushNotifications } from "@capacitor/push-notifications";
import { noAppDaLoja } from "@/lib/plataforma";

const CHAVE_TOKEN = "doonly_fcm_token";
export const PREFIXO_FCM = "fcm:";

export const pushNativoDisponivel = noAppDaLoja;

export function tokenGuardado(): string | null {
  try { return localStorage.getItem(CHAVE_TOKEN); } catch { return null; }
}

/** "granted" | "denied" | "default" (ainda não perguntou) */
export async function permissaoNativa(): Promise<NotificationPermission> {
  try {
    const r = await PushNotifications.checkPermissions();
    return r.receive === "granted" ? "granted" : r.receive === "denied" ? "denied" : "default";
  } catch { return "default"; }
}

/** Pede a permissão (só pergunta na primeira vez) */
export async function pedirPermissaoNativa(): Promise<NotificationPermission> {
  try {
    const r = await PushNotifications.requestPermissions();
    return r.receive === "granted" ? "granted" : r.receive === "denied" ? "denied" : "default";
  } catch { return "default"; }
}

/** Registra no Firebase e devolve o token deste aparelho (ou null se não deu em 15 s) */
export async function obterToken(): Promise<string | null> {
  return new Promise((resolve) => {
    let feito = false;
    const fim = (t: string | null) => { if (feito) return; feito = true; try { ok.then(h => h.remove()); erro.then(h => h.remove()); } catch { /* segue */ } resolve(t); };
    const ok = PushNotifications.addListener("registration", (t) => {
      try { localStorage.setItem(CHAVE_TOKEN, t.value); } catch { /* sem armazenamento */ }
      fim(t.value);
    });
    const erro = PushNotifications.addListener("registrationError", (e) => { console.warn("[Doonly] Firebase não registrou:", e?.error); fim(null); });
    PushNotifications.register().catch(() => fim(null));
    setTimeout(() => fim(null), 15000);
  });
}

export async function desligarNativo(): Promise<void> {
  try { await PushNotifications.unregister(); } catch { /* segue */ }
  try { localStorage.removeItem(CHAVE_TOKEN); } catch { /* segue */ }
}

let ouvindoToque = false;
/** Toque no aviso: abre a tela do aviso (ex.: o pedido novo). Chamar uma vez ao abrir o app. */
export function ouvirToqueNoAviso(): void {
  if (!noAppDaLoja || ouvindoToque) return;
  ouvindoToque = true;
  // canal de som alto para pedidos (Android 8+): o aviso aparece no topo da tela
  PushNotifications.createChannel({ id: "pedidos", name: "Pedidos", description: "Pedidos novos e avisos da loja", importance: 5, visibility: 1, sound: "default", vibration: true }).catch(() => {});
  PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
    const url = String((a?.notification?.data as Record<string, unknown> | undefined)?.url || "");
    if (url.startsWith("/") && url !== window.location.pathname) window.location.assign(url);
  }).catch(() => {});
}

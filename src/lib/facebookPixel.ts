/**
 * Pixel do Facebook da loja (19/10, Marketing › Pixel do Facebook).
 * Só no cardápio público: carrega o pixel com o ID que a confeiteira colocou e manda os eventos padrão
 * (PageView, ViewContent, AddToCart, InitiateCheckout e Purchase). Sem ID válido, nada é carregado.
 */
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[][]; push: Fbq; loaded: boolean; version: string };
declare global { interface Window { fbq?: Fbq; _fbq?: Fbq } }

export const pixelValido = (id: unknown): id is string => typeof id === "string" && /^[0-9]{10,20}$/.test(id.trim());

let iniciado: string | null = null;

export function iniciarPixel(id: unknown) {
  if (typeof window === "undefined" || !pixelValido(id) || iniciado === id.trim()) return;
  const pid = id.trim();
  if (!window.fbq) {
    // snippet oficial do Meta, sem o <noscript>
    const f = function (...args: unknown[]) { f.callMethod ? f.callMethod(...args) : f.queue.push(args); } as Fbq;
    f.push = f; f.loaded = true; f.version = "2.0"; f.queue = [];
    window.fbq = f; if (!window._fbq) window._fbq = f;
    const s = document.createElement("script");
    s.async = true; s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  }
  window.fbq("init", pid);
  window.fbq("track", "PageView");
  iniciado = pid;
}

// ── (04/11 · 6.20) Google (tag G-… do Analytics ou AW-… do Ads) e TikTok, além do Meta ──
type Gtag = (...args: unknown[]) => void;
type Ttq = { page: () => void; track: (e: string, d?: Record<string, unknown>) => void; load: (id: string) => void } & Record<string, unknown>;
declare global { interface Window { dataLayer?: unknown[]; gtag?: Gtag; ttq?: Ttq; TiktokAnalyticsObject?: string } }

export const googleValido = (id: unknown): id is string => typeof id === "string" && /^(G|AW)-[A-Z0-9]{4,20}$/i.test(id.trim());
export const tiktokValido = (id: unknown): id is string => typeof id === "string" && /^[A-Z0-9]{15,30}$/i.test(id.trim());

let googleIniciado: string | null = null;
export function iniciarGoogle(id: unknown) {
  if (typeof window === "undefined" || !googleValido(id) || googleIniciado === id.trim()) return;
  const gid = id.trim().toUpperCase();
  if (!window.gtag) {
    window.dataLayer = window.dataLayer || [];
    // o gtag.js espera "arguments" (não um array): o jeito oficial
    window.gtag = function () { // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments); } as Gtag;
    window.gtag("js", new Date());
    const s = document.createElement("script");
    s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gid)}`;
    document.head.appendChild(s);
  }
  window.gtag("config", gid);
  googleIniciado = gid;
}

let tiktokIniciado: string | null = null;
export function iniciarTikTok(id: unknown) {
  if (typeof window === "undefined" || !tiktokValido(id) || tiktokIniciado === id.trim()) return;
  const tid = id.trim().toUpperCase();
  if (!window.ttq) {
    // snippet oficial do TikTok (resumido): fila de chamadas até o script chegar
    const fila: unknown[][] = [];
    const ttq = { _fila: fila } as unknown as Ttq;
    for (const m of ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"])
      (ttq as Record<string, unknown>)[m] = (...a: unknown[]) => { fila.push([m, ...a]); };
    window.TiktokAnalyticsObject = "ttq";
    window.ttq = ttq;
    const s = document.createElement("script");
    s.async = true; s.src = `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(tid)}&lib=ttq`;
    document.head.appendChild(s);
  }
  try { window.ttq!.page(); } catch { /* bloqueador */ }
  tiktokIniciado = tid;
}

/** Evento padrão (manda pro Meta, Google e TikTok que estiverem ligados); não faz nada sem pixel. */
export function pixelEvento(nome: "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase" | "Lead", dados?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const d = { currency: "BRL", ...(dados || {}) };
  if (iniciado && window.fbq) { try { window.fbq("track", nome, d); } catch { /* bloqueador de anúncio: segue sem */ } }
  if (googleIniciado && window.gtag) {
    const g: Record<string, string> = { ViewContent: "view_item", AddToCart: "add_to_cart", InitiateCheckout: "begin_checkout", Purchase: "purchase", Lead: "generate_lead" };
    try { window.gtag("event", g[nome], d); } catch { /* bloqueador */ }
  }
  if (tiktokIniciado && window.ttq) {
    const t: Record<string, string> = { ViewContent: "ViewContent", AddToCart: "AddToCart", InitiateCheckout: "InitiateCheckout", Purchase: "CompletePayment", Lead: "SubmitForm" };
    try { window.ttq.track(t[nome], d); } catch { /* bloqueador */ }
  }
}

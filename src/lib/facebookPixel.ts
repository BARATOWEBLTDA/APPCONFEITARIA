/**
 * Pixels (Meta, Google e TikTok) com DOIS donos que nunca se misturam:
 *  - "cardapio": o pixel que a confeiteira colocou na tela Pixel. Só roda no cardápio público dela.
 *  - "app": os pixels do próprio Doonly, cadastrados no painel admin (Pixels do app). Rodam nas telas do app.
 * Cada evento vai só para os pixels do dono certo: Meta com trackSingle, Google com send_to e TikTok com
 * ttq.instance(id). Assim, se a mesma aba abrir o app e depois um cardápio, um não recebe os eventos do outro.
 * (19/10) Meta no cardápio · (04/11 · 6.20) Google e TikTok · (04/11 · 6.21) pixels do app e os dois donos.
 */
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[][]; push: Fbq; loaded: boolean; version: string };
type Gtag = (...args: unknown[]) => void;
type TtqFila = unknown[] & Record<string, unknown>;
type Ttq = TtqFila & {
  methods: string[]; _i: Record<string, TtqFila>;
  load: (id: string) => void; instance: (id: string) => { page: () => void; track: (e: string, d?: Record<string, unknown>) => void };
};
declare global { interface Window { fbq?: Fbq; _fbq?: Fbq; dataLayer?: unknown[]; gtag?: Gtag; ttq?: Ttq; TiktokAnalyticsObject?: string } }

export type Plataforma = "meta" | "google" | "tiktok";
export type DonoPixel = "cardapio" | "app";

export const pixelValido = (id: unknown): id is string => typeof id === "string" && /^[0-9]{10,20}$/.test(id.trim());
export const googleValido = (id: unknown): id is string => typeof id === "string" && /^(G|AW)-[A-Z0-9]{4,20}$/i.test(id.trim());
export const tiktokValido = (id: unknown): id is string => typeof id === "string" && /^[A-Z0-9]{15,30}$/i.test(id.trim());
export const codigoValido = (p: Plataforma, id: unknown) => (p === "meta" ? pixelValido(id) : p === "google" ? googleValido(id) : tiktokValido(id));
export const limparCodigo = (p: Plataforma, v: string) =>
  p === "meta" ? v.trim() : v.trim().toUpperCase();

const ligados: Record<DonoPixel, Record<Plataforma, Set<string>>> = {
  cardapio: { meta: new Set(), google: new Set(), tiktok: new Set() },
  app: { meta: new Set(), google: new Set(), tiktok: new Set() },
};
const iniciadosMeta = new Set<string>();
const iniciadosGoogle = new Set<string>();
const iniciadosTikTok = new Set<string>();

// ── carregar o script de cada plataforma (uma vez por aba) ──
function garantirMeta() {
  if (window.fbq) return;
  // snippet oficial do Meta, sem o <noscript>
  const f = function (...args: unknown[]) { f.callMethod ? f.callMethod(...args) : f.queue.push(args); } as Fbq;
  f.push = f; f.loaded = true; f.version = "2.0"; f.queue = [];
  window.fbq = f; if (!window._fbq) window._fbq = f;
  const s = document.createElement("script");
  s.async = true; s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
}
function garantirGoogle(primeiro: string) {
  if (window.gtag) return;
  window.dataLayer = window.dataLayer || [];
  // o gtag.js espera "arguments" (não um array): o jeito oficial
  window.gtag = function () { // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments); } as Gtag;
  window.gtag("js", new Date());
  const s = document.createElement("script");
  s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primeiro)}`;
  document.head.appendChild(s);
}
function garantirTikTok() {
  if (window.ttq) return;
  // snippet oficial do TikTok (a fila é o próprio ttq; o events.js lê ela quando chega)
  window.TiktokAnalyticsObject = "ttq";
  const ttq = [] as unknown as Ttq;
  window.ttq = ttq;
  ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
  const adiar = (alvo: TtqFila, m: string) => { alvo[m] = (...a: unknown[]) => { alvo.push([m, ...a]); }; };
  ttq.methods.forEach(m => adiar(ttq, m));
  ttq.instance = (id: string) => { const e = (ttq._i && ttq._i[id]) || ([] as unknown as TtqFila); ttq.methods.forEach(m => adiar(e, m)); return e as unknown as ReturnType<Ttq["instance"]>; };
  ttq.load = (id: string) => {
    const u = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i = ttq._i || {}; ttq._i[id] = [] as unknown as TtqFila; ttq._i[id]._u = u;
    const t = (ttq._t = (ttq._t as Record<string, number>) || {}) as Record<string, number>; t[id] = +new Date();
    const o = (ttq._o = (ttq._o as Record<string, unknown>) || {}) as Record<string, unknown>; o[id] = {};
    const s = document.createElement("script");
    s.type = "text/javascript"; s.async = true; s.src = `${u}?sdkid=${encodeURIComponent(id)}&lib=ttq`;
    document.head.appendChild(s);
  };
}

/** liga um pixel para um dono e já conta a visita da tela atual */
export function ligarPixel(p: Plataforma, codigo: unknown, dono: DonoPixel, contarVisita = true) {
  if (typeof window === "undefined" || !codigoValido(p, codigo)) return;
  const id = limparCodigo(p, codigo as string);
  if (ligados[dono][p].has(id)) return;
  try {
    if (p === "meta") {
      garantirMeta();
      if (!iniciadosMeta.has(id)) { window.fbq!("init", id); iniciadosMeta.add(id); }
    } else if (p === "google") {
      garantirGoogle(id);
      if (!iniciadosGoogle.has(id)) { window.gtag!("config", id, { send_page_view: false }); iniciadosGoogle.add(id); }
    } else {
      garantirTikTok();
      if (!iniciadosTikTok.has(id)) { window.ttq!.load(id); iniciadosTikTok.add(id); }
    }
  } catch { /* bloqueador de anúncio: segue sem */ }
  ligados[dono][p].add(id);
  if (contarVisita) visitaPara(p, id);
}

function visitaPara(p: Plataforma, id: string) {
  try {
    if (p === "meta") window.fbq?.("trackSingle", id, "PageView");
    else if (p === "google") window.gtag?.("event", "page_view", { send_to: id, page_location: location.href, page_path: location.pathname, page_title: document.title });
    else window.ttq?.instance(id).page();
  } catch { /* bloqueador */ }
}

/** conta a visita de uma tela nova (o app troca de tela sem recarregar) */
export function visitaDoDono(dono: DonoPixel) {
  (Object.keys(ligados[dono]) as Plataforma[]).forEach(p => ligados[dono][p].forEach(id => visitaPara(p, id)));
}
export const temPixel = (dono: DonoPixel) => Object.values(ligados[dono]).some(s => s.size > 0);

export type EventoPixel = "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase" | "Lead" | "CompleteRegistration" | "StartTrial" | "Subscribe";
const NO_GOOGLE: Record<EventoPixel, string> = { ViewContent: "view_item", AddToCart: "add_to_cart", InitiateCheckout: "begin_checkout", Purchase: "purchase", Lead: "generate_lead", CompleteRegistration: "sign_up", StartTrial: "start_trial", Subscribe: "subscribe" };
const NO_TIKTOK: Record<EventoPixel, string> = { ViewContent: "ViewContent", AddToCart: "AddToCart", InitiateCheckout: "InitiateCheckout", Purchase: "CompletePayment", Lead: "SubmitForm", CompleteRegistration: "CompleteRegistration", StartTrial: "StartTrial", Subscribe: "Subscribe" };

/** manda um evento só para os pixels daquele dono */
export function eventoDoDono(dono: DonoPixel, nome: EventoPixel, dados?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const d = { currency: "BRL", ...(dados || {}) };
  const l = ligados[dono];
  l.meta.forEach(id => { try { window.fbq?.("trackSingle", id, nome, d); } catch { /* bloqueador */ } });
  if (l.google.size) { try { window.gtag?.("event", NO_GOOGLE[nome], { ...d, send_to: [...l.google] }); } catch { /* bloqueador */ } }
  l.tiktok.forEach(id => { try { window.ttq?.instance(id).track(NO_TIKTOK[nome], d); } catch { /* bloqueador */ } });
}

// ── o que o cardápio público já usava (dono "cardapio") ──
export const iniciarPixel = (id: unknown) => ligarPixel("meta", id, "cardapio");
export const iniciarGoogle = (id: unknown) => ligarPixel("google", id, "cardapio");
export const iniciarTikTok = (id: unknown) => ligarPixel("tiktok", id, "cardapio");
/** Evento do cardápio (Meta, Google e TikTok da confeiteira); não faz nada sem pixel. */
export function pixelEvento(nome: "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase" | "Lead", dados?: Record<string, unknown>) {
  eventoDoDono("cardapio", nome, dados);
}

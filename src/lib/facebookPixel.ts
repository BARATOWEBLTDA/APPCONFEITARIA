/**
 * Pixel do Facebook da loja (19/10, Marketing › Pixel do Facebook).
 * Só no cardápio público: carrega o pixel com o ID que a confeiteira colocou e manda os eventos padrão
 * (PageView, ViewContent, AddToCart, InitiateCheckout e Purchase). Sem ID válido, nada é carregado.
 */
declare global { interface Window { fbq?: any; _fbq?: any } }

export const pixelValido = (id: unknown): id is string => typeof id === "string" && /^[0-9]{10,20}$/.test(id.trim());

let iniciado: string | null = null;

export function iniciarPixel(id: unknown) {
  if (typeof window === "undefined" || !pixelValido(id) || iniciado === id.trim()) return;
  const pid = id.trim();
  if (!window.fbq) {
    // snippet oficial do Meta, sem o <noscript>
    const f: any = function (...args: any[]) { f.callMethod ? f.callMethod(...args) : f.queue.push(args); };
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

/** Evento padrão do pixel; não faz nada se a loja não tem pixel. */
export function pixelEvento(nome: "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase" | "Lead", dados?: Record<string, unknown>) {
  if (!iniciado || typeof window === "undefined" || !window.fbq) return;
  try { window.fbq("track", nome, { currency: "BRL", ...(dados || {}) }); } catch { /* bloqueador de anúncio: segue sem */ }
}

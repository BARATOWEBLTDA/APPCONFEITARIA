/**
 * (12/11) Recursos do celular no app da Play Store (Capacitor). No site nada daqui roda: tudo começa com noAppDaLoja
 * e os plugins só são carregados (import dinâmico) dentro do app.
 *   · Login com Google: o Google bloqueia login dentro de app (erro 403 disallowed_useragent). Abre o login no
 *     navegador do sistema (aba do Chrome) e volta pro app por br.com.doonly.app://login#access_token=...
 *   · Links do doonly.com.br, atalhos do ícone e toque nos avisos: abrem a tela certa no app.
 *   · Splash: some quando a primeira tela do site aparece.
 *   · Número no ícone: os pedidos novos que ainda não foram vistos.
 */
import { noAppDaLoja } from "@/lib/plataforma";
import { supabase } from "@/lib/supabase";

export const ESQUEMA_APP = "br.com.doonly.app";
const RETORNO_LOGIN = `${ESQUEMA_APP}://login`;
const CHAVE_DESTINO = "doonly_login_destino";

/** Abre o login do Google no navegador do sistema. O retorno é tratado em tratarLinkAberto. */
export async function entrarComGoogleNoApp(destino: string): Promise<void> {
  try { localStorage.setItem(CHAVE_DESTINO, destino || "/inicio"); } catch { /* segue */ }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: RETORNO_LOGIN, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  if (error || !data?.url) throw error || new Error("sem endereço do Google");
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: data.url, presentationStyle: "popover", toolbarColor: "#3B1F2B" });
}

/** Caminho do site pra abrir dentro do app (só do doonly.com.br), ou null */
function caminhoDoSite(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol === "https:" && /(^|\.)doonly\.com\.br$/.test(u.hostname)) return (u.pathname || "/") + u.search + u.hash;
    if (u.protocol === `${ESQUEMA_APP}:` && u.host === "abrir") return (u.pathname || "/") + u.search;
  } catch { /* endereço estranho */ }
  return null;
}

async function tratarLinkAberto(url: string): Promise<void> {
  // volta do login com o Google
  if (url.startsWith(RETORNO_LOGIN)) {
    const { Browser } = await import("@capacitor/browser");
    Browser.close().catch(() => {});
    const frag = new URLSearchParams((url.split("#")[1] || url.split("?")[1] || ""));
    const access_token = frag.get("access_token"), refresh_token = frag.get("refresh_token");
    let destino = "/inicio";
    try { destino = localStorage.getItem(CHAVE_DESTINO) || "/inicio"; localStorage.removeItem(CHAVE_DESTINO); } catch { /* segue */ }
    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (!error) { window.location.replace(destino); return; }
    }
    window.location.replace("/login?erro=google");
    return;
  }
  const caminho = caminhoDoSite(url);
  if (caminho && caminho !== window.location.pathname + window.location.search) window.location.assign(caminho);
}

let iniciado = false;
export async function iniciarNativo(): Promise<void> {
  if (!noAppDaLoja || iniciado) return;
  iniciado = true;
  prepararCompartilharNoApp();
  prepararDownloadsNoApp();
  void iniciarDigital();
  try {
    const { App } = await import("@capacitor/app");
    App.addListener("appUrlOpen", (e) => { void tratarLinkAberto(e.url); });
    // app aberto pelo link/atalho com ele fechado
    const inicial = await App.getLaunchUrl().catch(() => undefined);
    if (inicial?.url) void tratarLinkAberto(inicial.url);
  } catch (e) { console.warn("[Doonly] app:", e); }
}

/** Esconde a splash nativa (chamar quando a primeira tela aparecer) */
export function esconderSplash(): void {
  if (!noAppDaLoja) return;
  import("@capacitor/splash-screen").then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 250 })).catch(() => {});
}

/** Número no ícone do app: os pedidos novos que ela ainda não viu (o mesmo número da bolinha do menu Pedidos) */
export function definirNumeroNoIcone(n: number): void {
  if (!noAppDaLoja) return;
  import("@capawesome/capacitor-badge").then(({ Badge }) => (n > 0 ? Badge.set({ count: n }) : Badge.clear())).catch(() => {});
}

// ── (12/11) Compartilhar e PDF no app ──
// O WebView do Android não tem navigator.share nem janela nova (window.open("") devolvia o próprio app e o
// documento era escrito por cima dele). No app: navigator.share usa a janela de compartilhar do Android e o PDF
// abre numa camada por cima do app, com o botão "Enviar PDF" (WhatsApp, Drive, Arquivos, imprimir…).
const blobParaBase64 = (b: Blob) => new Promise<string>((ok, falhou) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(",")[1] || "");
  r.onerror = () => falhou(r.error);
  r.readAsDataURL(b);
});
const nomeSeguro = (n: string) => (n || "arquivo").replace(/[\\/:*?"<>|]+/g, " ").trim() || "arquivo";

async function compartilharNoApp(d: ShareData): Promise<void> {
  // sem o plugin nativo (app antigo): o Share "da web" chamaria este mesmo navigator.share, num laço sem fim
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isPluginAvailable("Share")) throw new Error("compartilhar indisponível nesta versão do app");
  const { Share } = await import("@capacitor/share");
  const arquivos = (d.files || []) as File[];
  let files: string[] | undefined;
  if (arquivos.length) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    files = [];
    for (const f of arquivos) {
      const r = await Filesystem.writeFile({ path: `compartilhar/${Date.now()}-${nomeSeguro(f.name)}`, data: await blobParaBase64(f), directory: Directory.Cache, recursive: true });
      files.push(r.uri);
    }
  }
  try {
    await Share.share({ title: d.title, text: d.text, url: d.url, files, dialogTitle: "Enviar" });
  } catch (e) {
    // fechou a janela sem escolher: igual ao navegador (AbortError)
    const err = new Error(String((e as Error)?.message || "cancelado")); err.name = "AbortError"; throw err;
  }
}

let camada: HTMLDivElement | null = null;
function fecharCamada(): boolean {
  if (!camada) return false;
  camada.remove(); camada = null;
  document.documentElement.style.overflow = "";
  return true;
}
/** Abre o documento (PDF) numa camada por cima do app; devolve a "janela" onde o documento é escrito */
function abrirCamadaDocumento(): Window | null {
  fecharCamada();
  const c = document.createElement("div");
  c.setAttribute("role", "dialog"); c.setAttribute("aria-label", "Documento");
  c.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:#EFE9EC;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top)";
  const barra = document.createElement("div");
  barra.style.cssText = "display:flex;align-items:center;gap:8px;height:52px;padding:0 8px;background:#fff;border-bottom:1px solid #EEE5E9;flex-shrink:0";
  const voltar = document.createElement("button");
  voltar.type = "button"; voltar.textContent = "‹  Voltar";
  voltar.style.cssText = "border:0;background:none;font:600 16px Poppins,system-ui,sans-serif;color:#C33A6E;padding:10px 12px;cursor:pointer";
  voltar.onclick = () => fecharCamada();
  barra.appendChild(voltar);
  // o documento é montado na largura de uma folha (840 px, igual ao navegador) e reduzido para caber na tela:
  // assim o PDF sai igual ao do site, e não espremido na largura do celular
  const area = document.createElement("div");
  area.style.cssText = "flex:1;position:relative;overflow:hidden";
  const quadro = document.createElement("iframe");
  quadro.title = "Documento";
  const ajustar = () => {
    const esc = Math.min(1, area.clientWidth / 840 || 1);
    quadro.style.cssText = `position:absolute;top:0;left:0;width:840px;height:${Math.ceil(area.clientHeight / esc)}px;border:0;background:#EFE9EC;transform:scale(${esc});transform-origin:0 0`;
  };
  area.appendChild(quadro);
  c.appendChild(barra); c.appendChild(area);
  document.body.appendChild(c);
  ajustar();
  document.documentElement.style.overflow = "hidden";
  camada = c;
  return quadro.contentWindow;
}

/** Liga tudo acima (chamar cedo, só no app) */
export function prepararCompartilharNoApp(): void {
  if (!noAppDaLoja) return;
  const w = window as Window & { __doonlyApp?: boolean };
  w.__doonlyApp = true;
  try {
    Object.defineProperty(navigator, "share", { configurable: true, value: (d: ShareData) => compartilharNoApp(d || {}) });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
  } catch { /* segue sem */ }
  const abrirOriginal = window.open.bind(window);
  window.open = ((url?: string | URL, alvo?: string, opcoes?: string) => {
    const u = url ? String(url) : "";
    if (!u || u === "about:blank") return abrirCamadaDocumento();
    return abrirOriginal(u, alvo, opcoes);
  }) as typeof window.open;
  // botão voltar do Android: fecha o documento antes de voltar de tela
  import("@capacitor/app").then(({ App }) => App.addListener("backButton", ({ canGoBack }) => {
    if (fecharCamada()) return;
    if (canGoBack) window.history.back(); else App.minimizeApp();
  })).catch(() => {});
}

// ── (12/11) Entrar com a digital (ou o rosto / o PIN do celular) ──
// Opcional, ligado em Configurações. Com ele ligado, o app pede a digital ao abrir e ao voltar depois de 2 min fora.
const CHAVE_DIGITAL = "doonly_digital";
const FORA_MS = 2 * 60 * 1000;
export const digitalLigada = () => { try { return localStorage.getItem(CHAVE_DIGITAL) === "1"; } catch { return false; } };

export async function digitalDisponivel(): Promise<boolean> {
  if (!noAppDaLoja) return false;
  try { const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth"); const r = await BiometricAuth.checkBiometry(); return r.isAvailable || r.deviceIsSecure; } catch { return false; }
}

async function pedirDigital(): Promise<boolean> {
  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    await BiometricAuth.authenticate({ reason: "Para abrir o Doonly", androidTitle: "Abrir o Doonly", androidSubtitle: "Use a digital, o rosto ou o PIN do celular", allowDeviceCredential: true, cancelTitle: "Cancelar" });
    return true;
  } catch { return false; }
}

/** Liga/desliga (pede a digital antes de ligar, pra confirmar que funciona). Devolve o estado final. */
export async function alternarDigital(): Promise<boolean> {
  if (digitalLigada()) { try { localStorage.removeItem(CHAVE_DIGITAL); } catch { /* segue */ } return false; }
  if (!(await pedirDigital())) return false;
  try { localStorage.setItem(CHAVE_DIGITAL, "1"); } catch { /* segue */ }
  return true;
}

let travado = false;
async function travarComDigital(): Promise<void> {
  if (travado || !digitalLigada()) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  travado = true;
  const t = document.createElement("div");
  t.style.cssText = "position:fixed;inset:0;z-index:2147483600;background:#E164A0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;font-family:Poppins,system-ui,sans-serif;color:#fff";
  t.innerHTML = '<img src="/marca/acenando.png" alt="" style="width:120px;height:auto"><b style="font-size:20px;font-weight:600">Doonly travado</b>';
  const b = document.createElement("button");
  b.type = "button"; b.textContent = "Usar a digital";
  b.style.cssText = "border:0;border-radius:14px;background:#fff;color:#C33A6E;font:600 16px Poppins,system-ui,sans-serif;padding:14px 28px;min-width:200px";
  t.appendChild(b);
  document.body.appendChild(t);
  const tentar = async () => { if (await pedirDigital()) { t.remove(); travado = false; } };
  b.onclick = () => { void tentar(); };
  void tentar();
}

export async function iniciarDigital(): Promise<void> {
  if (!noAppDaLoja) return;
  let saiuEm = 0;
  try {
    const { App } = await import("@capacitor/app");
    App.addListener("pause", () => { saiuEm = Date.now(); });
    App.addListener("resume", () => { if (saiuEm && Date.now() - saiuEm > FORA_MS) void travarComDigital(); });
  } catch { /* segue */ }
  void travarComDigital();
}

// ── (12/11) Downloads no app ──
// O WebView do Android ignora <a download> (QR Code, imagem do cupom, topo de bolo, PDF da Doo): nada acontecia.
// No app, todo download vira a janela de compartilhar do Android, com "Salvar", Drive, WhatsApp…
async function baixarNoApp(href: string, nome: string): Promise<void> {
  try {
    const r = await fetch(href);
    const blob = await r.blob();
    const arquivo = new File([blob], nomeSeguro(nome || href.split("/").pop()?.split("?")[0] || "arquivo"), { type: blob.type || "application/octet-stream" });
    await compartilharNoApp({ files: [arquivo], title: arquivo.name });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
    console.warn("[Doonly] download no app:", e);
    import("@/components/base").then(({ avisar }) => avisar("Não deu para salvar o arquivo. Tente de novo.", { tipo: "erro" })).catch(() => {});
  }
}

function prepararDownloadsNoApp(): void {
  const ehDownload = (el: EventTarget | null): el is HTMLAnchorElement =>
    el instanceof HTMLAnchorElement && el.hasAttribute("download") && !!el.href;
  const proto = HTMLAnchorElement.prototype;
  const clickOriginal = proto.click;
  proto.click = function (this: HTMLAnchorElement) {
    if (ehDownload(this)) { void baixarNoApp(this.href, this.download); return; }
    return clickOriginal.call(this);
  };
  const dispatchOriginal = proto.dispatchEvent;
  proto.dispatchEvent = function (this: HTMLAnchorElement, ev: Event) {
    if (ev.type === "click" && ehDownload(this)) { void baixarNoApp(this.href, this.download); return false; }
    return dispatchOriginal.call(this, ev);
  };
  // link de download tocado pela pessoa (dentro da página)
  document.addEventListener("click", (ev) => {
    const a = (ev.target as Element | null)?.closest?.("a[download]") as HTMLAnchorElement | null;
    if (a && a.href) { ev.preventDefault(); void baixarNoApp(a.href, a.download); }
  }, true);
}

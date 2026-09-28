/**
 * Guarda o evento "beforeinstallprompt" do Chrome/Android.
 * Ele dispara uma única vez, logo que a página carrega — por isso a captura
 * precisa acontecer cedo (importado no main.tsx), antes da confeiteira
 * chegar em Configurações, onde fica o botão "Instalar app".
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // a gente mostra o próprio convite
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    notify();
  });
}

export const getInstallPrompt = () => deferred;
export const wasInstalledNow = () => installed;

export function onInstallChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Abre a janelinha do Chrome. Retorna true se a pessoa aceitou. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const ev = deferred;
  deferred = null; // o evento só pode ser usado uma vez
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  notify();
  return outcome === "accepted";
}

/** Já está rodando como app instalado? */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

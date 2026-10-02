/**
 * Atualização automática do app (02/10).
 * O app instalado (iPhone e Android) fica aberto na memória e continuava na versão antiga
 * até ser fechado de vez. Agora ele confere o /version.json (muda a cada deploy):
 *   · ao abrir, ao voltar pro app e a cada 10 minutos;
 *   · se tiver versão nova, recarrega SOZINHO — mas só num momento seguro: fora das telas
 *     de preencher (nova venda, edição de pedido, cadastro de produto…) e sem campo em uso,
 *     pra nunca perder o que ela está digitando. Se não for seguro, espera e tenta de novo.
 */
const TELAS_DE_PREENCHER = [/^\/vendas\/novo/, /^\/pedidos\/[^/]+\/editar/, /^\/ficha-tecnica/, /^\/cardapio-config/, /^\/checkout-config/,
  /^\/solicitar-recurso/, /^\/relatar-problema/, /^\/reset-password/, /^\/login/];

let temVersaoNova = false;

function momentoSeguro(): boolean {
  const path = window.location.pathname;
  if (TELAS_DE_PREENCHER.some(r => r.test(path))) return false;
  const ativo = document.activeElement as HTMLElement | null;
  if (ativo && (ativo.tagName === "INPUT" || ativo.tagName === "TEXTAREA" || ativo.isContentEditable)) return false;
  // janela aberta por cima (cadastro de produto, edição, sacola do cardápio…)
  if (document.querySelector(".prod-modal-overlay, .ep-wrap, [role='dialog']")) return false;
  return true;
}

function recarregarSePuder() {
  if (temVersaoNova && document.visibilityState === "visible" && momentoSeguro()) {
    try { sessionStorage.setItem("doonly_splash_shown", "1"); } catch {}
    window.location.reload();
  }
}

async function conferir() {
  if (temVersaoNova) { recarregarSePuder(); return; }
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return;
    const v = await r.json();
    if (v?.id && v.id !== __BUILD_ID__) { temVersaoNova = true; recarregarSePuder(); }
  } catch { /* sem internet: tenta depois */ }
}

export function iniciarAutoAtualizacao(): void {
  if (typeof window === "undefined" || import.meta.env.DEV) return;
  // o cardápio do cliente também atualiza, mas nunca com a sacola aberta (o [role=dialog] cuida disso)
  setTimeout(conferir, 4000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") conferir(); });
  window.addEventListener("focus", conferir);
  // trocou de tela: se já tem versão nova esperando, aproveita se a tela nova for segura
  window.addEventListener("popstate", () => setTimeout(recarregarSePuder, 300));
  // com versão nova esperando, tenta de novo a cada 30s (só recarrega se o momento for seguro)
  setInterval(() => { if (temVersaoNova) recarregarSePuder(); }, 30 * 1000);
  setInterval(conferir, 10 * 60 * 1000);
}

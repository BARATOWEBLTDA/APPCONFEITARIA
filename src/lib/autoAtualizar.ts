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
  /^\/solicitar-recurso/, /^\/relatar-problema/, /^\/reset-password/, /^\/login/, /^\/cadastro/,
  // (11/10) também: recuperar a senha (e os outros nomes da mesma tela), conferir o e-mail e o painel da equipe inteiro
  /^\/esqueci-senha/, /^\/verificar-email/, /^\/(redefinir|nova|alterar)-senha/, /^\/admin(\/|$)/];

let temVersaoNova = false;
/** (11/10) hora do último toque, tecla ou "voltar": logo depois deles pode ter um salvar ou excluir em andamento */
let ultimaAcao = 0;
const CALMA = 3000;

/** Dá pra recarregar (ou trocar de tela) sem perder o que ela está preenchendo? */
export function momentoSeguro(): boolean {
  const path = window.location.pathname;
  if (TELAS_DE_PREENCHER.some(r => r.test(path))) return false;
  // (11/10) sacola do cardápio com itens (o cardápio marca) e a tela "Complete seu cadastro"
  if (document.documentElement.dataset.sacola === "1") return false;
  if (document.querySelector("[data-sem-recarregar]")) return false;
  const ativo = document.activeElement as HTMLElement | null;
  if (ativo && (ativo.tagName === "INPUT" || ativo.tagName === "TEXTAREA" || ativo.isContentEditable)) return false;
  // janela aberta por cima (cadastro de produto, edição, sacola do cardápio…)
  // (10/10) as janelas de pergunta e aviso usam role="alertdialog": também seguram a atualização
  if (document.querySelector(".prod-modal-overlay, .ep-wrap, [role='dialog'], [role='alertdialog']")) return false;
  return true;
}

function recarregarSePuder() {
  // (11/10) só com uns segundos de calma: o "voltar" que uma janela de confirmar faz ao fechar chegava aqui
  // com o excluir ou o salvar ainda em andamento
  if (temVersaoNova && document.visibilityState === "visible" && Date.now() - ultimaAcao >= CALMA && momentoSeguro()) {
    try { sessionStorage.setItem("doonly_splash_shown", "1"); } catch { /* sem sessionStorage: só mostra a abertura de novo */ }
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
  // (11/10) espera a calma (antes eram 300 ms depois de QUALQUER "voltar", inclusive o de fechar uma janela)
  const agir = () => { ultimaAcao = Date.now(); };
  window.addEventListener("pointerdown", agir, { capture: true, passive: true });
  window.addEventListener("keydown", agir, { capture: true, passive: true });
  window.addEventListener("popstate", () => { agir(); setTimeout(recarregarSePuder, CALMA + 200); });
  // com versão nova esperando, tenta de novo a cada 30s (só recarrega se o momento for seguro)
  setInterval(() => { if (temVersaoNova) recarregarSePuder(); }, 30 * 1000);
  setInterval(conferir, 10 * 60 * 1000);
}

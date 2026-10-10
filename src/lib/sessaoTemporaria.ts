/**
 * "Lembrar de mim" desmarcado (03/10).
 * O login marca "doonly_sessao_temporaria" (localStorage) e "doonly_sessao_viva" (sessionStorage).
 * O sessionStorage some quando o app/navegador é fechado; o localStorage não.
 * Então: abriu o app, existe a marca temporária e NÃO existe a "viva" → o app foi fechado → apaga a sessão.
 *
 * Este arquivo é o PRIMEIRO import do main.tsx: roda antes de a conexão com o Supabase ler a sessão.
 *
 * (10/10) A marca "viva" é de cada aba. Abrir o app em outra aba (ex.: "Ver meu cardápio") apagava a sessão
 * e derrubava também a aba que estava em uso. Agora cada aba com sessão temporária grava uma "batida"
 * (a hora, no localStorage) a cada poucos segundos. A aba nova só apaga a sessão se a batida estiver velha
 * (nenhuma aba do app aberta); se estiver recente, ela herda a sessão.
 */
const TEMPORARIA = "doonly_sessao_temporaria";
const VIVA = "doonly_sessao_viva";
const BATIDA = "doonly_sessao_batida";
const BATIDA_VELHA = 90 * 1000; // o Chrome atrasa os relógios de aba escondida pra 1 por minuto
const PASSO = 5 * 1000;

// O cardápio da cliente (/c/... e /cardapio/...) é público: abrir um link dele não decide nada sobre a sessão do app
// (antes, tocar num link do próprio cardápio com o app em segundo plano derrubava a conta).
const ROTA_PUBLICA = typeof location !== "undefined" && /^\/(c|cardapio)\//.test(location.pathname);

try {
  if (!ROTA_PUBLICA && localStorage.getItem(TEMPORARIA) === "1" && !sessionStorage.getItem(VIVA)) {
    const batida = Number(localStorage.getItem(BATIDA)) || 0;
    if (Math.abs(Date.now() - batida) < BATIDA_VELHA) {
      // tem outra aba do app aberta com essa sessão: esta aba herda
      sessionStorage.setItem(VIVA, "1");
    } else {
      Object.keys(localStorage)
        .filter(k => /^sb-.*-auth-token/.test(k))
        .forEach(k => localStorage.removeItem(k));
      localStorage.removeItem(TEMPORARIA);
      localStorage.removeItem(BATIDA);
    }
  }
} catch {
  /* sem armazenamento disponível: não faz nada */
}

/** Avisa as outras abas que esta aqui está aberta com a sessão temporária. */
function bater() {
  try {
    if (localStorage.getItem(TEMPORARIA) === "1" && sessionStorage.getItem(VIVA)) localStorage.setItem(BATIDA, String(Date.now()));
  } catch { /* sem armazenamento: segue */ }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  bater();
  window.setInterval(bater, PASSO);
  document.addEventListener("visibilitychange", bater);
  window.addEventListener("focus", bater);
  window.addEventListener("pageshow", bater);
}

/**
 * Chamado na tela de entrar: "Lembrar de mim" desmarcado = a sessão vale só enquanto o app estiver aberto.
 * Vale pra qualquer jeito de entrar (senha ou Google).
 */
export function definirSessaoTemporaria(temporaria: boolean): void {
  try {
    if (temporaria) {
      localStorage.setItem(TEMPORARIA, "1");
      sessionStorage.setItem(VIVA, "1");
      bater();
    } else {
      localStorage.removeItem(TEMPORARIA);
      localStorage.removeItem(BATIDA);
    }
  } catch { /* sem armazenamento: segue conectada */ }
}

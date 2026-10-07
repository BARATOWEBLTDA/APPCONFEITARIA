/**
 * "Lembrar de mim" desmarcado (03/10).
 * O login marca "doonly_sessao_temporaria" (localStorage) e "doonly_sessao_viva" (sessionStorage).
 * O sessionStorage some quando o app/navegador é fechado; o localStorage não.
 * Então: abriu o app, existe a marca temporária e NÃO existe a "viva" → o app foi fechado → apaga a sessão.
 *
 * Este arquivo é o PRIMEIRO import do main.tsx: roda antes de a conexão com o Supabase ler a sessão.
 */
try {
  if (localStorage.getItem("doonly_sessao_temporaria") === "1" && !sessionStorage.getItem("doonly_sessao_viva")) {
    Object.keys(localStorage)
      .filter(k => /^sb-.*-auth-token/.test(k))
      .forEach(k => localStorage.removeItem(k));
    localStorage.removeItem("doonly_sessao_temporaria");
  }
} catch {
  /* sem armazenamento disponível: não faz nada */
}
export {};

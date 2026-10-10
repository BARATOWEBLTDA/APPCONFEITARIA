/**
 * Mensagens de erro do sistema, na voz do Doonly (10/10).
 * O texto cru do banco ou do navegador (em inglês) não aparece mais pra quem usa: vai só pro console.
 *
 *   avisar(explicarErro(error, "Não deu pra salvar a foto."), { tipo: "erro" })
 */
export const SEM_INTERNET = "Sem internet. Confira a conexão e tente de novo.";

/** A falha foi de conexão (celular sem sinal, Wi-Fi caiu, pedido não chegou no servidor)? */
export function erroDeConexao(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = String((err as { message?: unknown } | null)?.message ?? err ?? "");
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|timed out/i.test(msg);
}

/** A frase pra mostrar: "sem internet" quando for o caso; senão, a frase da tela (ou a padrão). */
export function explicarErro(err: unknown, padrao = "Algo não saiu como esperado. Tente de novo em instantes."): string {
  if (err) console.error("[Doonly]", err);
  return erroDeConexao(err) ? SEM_INTERNET : padrao;
}

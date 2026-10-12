/**
 * Telefone brasileiro num lugar só (10/10).
 * O "55" do começo só é o código do país quando sobram 10 ou 11 dígitos depois dele.
 * Assim o DDD 55 (Santa Maria/RS e região) não é confundido com o código do país.
 *
 *   digitosTelefone("+55 (41) 99999-8888") → "41999998888"
 *   digitosTelefone("(55) 99999-1234")     → "55999991234"   (DDD 55, continua inteiro)
 *   numeroWhatsApp("(55) 99999-1234")      → "5555999991234"
 *   linkWhatsApp("41 99999-8888", "Oi!")   → "https://wa.me/5541999998888?text=Oi!"
 */

/** Só os dígitos, com DDD e sem o código do país. */
export function digitosTelefone(t: string | null | undefined): string {
  return String(t ?? "").replace(/\D/g, "").replace(/^0+/, "").replace(/^55(?=\d{10,11}$)/, "");
}

/** Tem DDD + número (10 ou 11 dígitos)? */
export function telefoneCompleto(t: string | null | undefined): boolean {
  const d = digitosTelefone(t);
  return d.length === 10 || d.length === 11;
}

/** O número no formato que o WhatsApp espera: 55 + DDD + número. Vazio se não der pra montar. */
export function numeroWhatsApp(t: string | null | undefined): string {
  const d = digitosTelefone(t);
  return d.length >= 10 ? `55${d}` : "";
}

/** O link do WhatsApp (com a mensagem, se tiver). Vazio se o telefone não estiver completo. */
export function linkWhatsApp(t: string | null | undefined, texto?: string): string {
  const n = numeroWhatsApp(t);
  if (!n) return "";
  return `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

/**
 * Dígitos do telefone ENQUANTO a pessoa digita ou cola (10/10), no máximo 11 (DDD + número). Use nas máscaras de campo.
 * Tira o +55 de número colado ou preenchido pelo navegador ("+55 41 99999-8888", "5541999998888"),
 * que antes era cortado nos 11 primeiros dígitos e virava "(55) 41999-9988".
 * Cuidado com o DDD 55: "55999991234" mais um dígito a mais (12 dígitos, sem "+") NÃO é código do país.
 */
export function digitosAoDigitar(v: string | null | undefined): string {
  const texto = String(v ?? "");
  const cru = texto.replace(/\D/g, "");
  const duvida = cru.length === 12 && cru.startsWith("559") && !/^\s*\+/.test(texto);
  return (duvida ? cru : digitosTelefone(texto)).slice(0, 11);
}

/** Máscara padrão de campo de telefone: "(41) 99999-8888" ou "(41) 3333-4444". Aceita colar com +55. */
export function mascaraTelefone(v: string | null | undefined): string {
  const d = digitosAoDigitar(v);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

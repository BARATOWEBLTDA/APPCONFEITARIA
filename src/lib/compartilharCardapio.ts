import { avisar } from "@/components/base";

/**
 * (16/10) A mensagem que vai junto com o link do cardápio, igual em todo lugar do app
 * (Início, Cardápio, prévia, passo a passo). O link fica sozinho na linha de baixo e vai dentro do texto:
 * se for separado, cada celular junta texto e link de um jeito (e às vezes o link aparecia duas vezes).
 */
export const textoCardapio = (link: string) => `Olá! Já dá pra fazer seu pedido pelo nosso cardápio online:\n${link}`;

/**
 * (16/10) Todo "Compartilhar" do app abre a janela do próprio celular (WhatsApp, Instagram, o que ela tiver).
 * Onde essa janela não existe (computador), copia o texto. Devolve true quando compartilhou ou copiou.
 */
export async function compartilharTexto(texto: string, titulo = "Doonly"): Promise<boolean> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (nav.share) {
    try { await nav.share({ title: titulo, text: texto }); return true; }
    catch (e: any) { if (e?.name === "AbortError") return false; } // ela fechou a janela
  }
  try { await navigator.clipboard.writeText(texto); avisar("Copiado. É só colar onde quiser.", { tipo: "ok" }); return true; }
  catch { avisar("Não deu pra copiar. Tente de novo.", { tipo: "erro" }); return false; }
}

export const compartilharCardapio = (link: string, nomeLoja?: string) => compartilharTexto(textoCardapio(link), nomeLoja || "Meu cardápio");

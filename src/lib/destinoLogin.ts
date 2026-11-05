/**
 * (27/10) Link do app aberto sem estar logada (ex.: aviso de pedido novo → /pedidos/123):
 * guarda o caminho e, depois de entrar, abre ele em vez do Início.
 */
const CHAVE = "doonly:depoisDoLogin";
// (6.149) saiu da conta de propósito: a tela onde ela estava não é "link aberto sem login".
// Antes, sair em Nova venda e entrar de novo (ou em outra conta) abria direto a Nova venda.
const SAIU = "doonly:saiuDaConta";

export function marcarSaidaDaConta() {
  try { sessionStorage.setItem(SAIU, "1"); sessionStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ }
}

export function guardarDestinoDoLogin(caminho: string) {
  try { if (sessionStorage.getItem(SAIU) === "1") return; } catch { /* segue */ }
  // só caminhos do próprio app (nunca outro site) e não o próprio login
  if (!/^\/[a-z0-9]/i.test(caminho) || caminho.startsWith("//") || /^\/(login|cadastro|reset|esqueci)/i.test(caminho)) return;
  try { sessionStorage.setItem(CHAVE, caminho); } catch { /* sem armazenamento: vai pro Início */ }
}

export function destinoDepoisDoLogin(): string | null {
  try {
    const c = sessionStorage.getItem(CHAVE);
    sessionStorage.removeItem(CHAVE);
    sessionStorage.removeItem(SAIU);
    return c && /^\/[a-z0-9]/i.test(c) && !c.startsWith("//") ? c : null;
  } catch { return null; }
}

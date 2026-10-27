/**
 * (27/10) Link do app aberto sem estar logada (ex.: aviso de pedido novo → /pedidos/123):
 * guarda o caminho e, depois de entrar, abre ele em vez do Início.
 */
const CHAVE = "doonly:depoisDoLogin";

export function guardarDestinoDoLogin(caminho: string) {
  // só caminhos do próprio app (nunca outro site) e não o próprio login
  if (!/^\/[a-z0-9]/i.test(caminho) || caminho.startsWith("//") || /^\/(login|cadastro|reset|esqueci)/i.test(caminho)) return;
  try { sessionStorage.setItem(CHAVE, caminho); } catch { /* sem armazenamento: vai pro Início */ }
}

export function destinoDepoisDoLogin(): string | null {
  try {
    const c = sessionStorage.getItem(CHAVE);
    sessionStorage.removeItem(CHAVE);
    return c && /^\/[a-z0-9]/i.test(c) && !c.startsWith("//") ? c : null;
  } catch { return null; }
}

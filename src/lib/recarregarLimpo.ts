/**
 * (6.124) Recarregar "de verdade": baixa de novo a página e os arquivos do app sem usar o que ficou guardado no aparelho
 * (a função mora no index.html, para funcionar até quando o app não consegue abrir). Antes o Atualizar/Recarregar
 * repetia o erro e só o Ctrl+Shift+R (ou reinstalar o app no celular) resolvia.
 */
type JanelaDoonly = Window & { __doonlyReparar?: (extra?: string[]) => void; __doonlyMontou?: boolean };

export function recarregarLimpo(textoDoErro = ""): void {
  const w = window as JanelaDoonly;
  // o arquivo que falhou costuma vir no texto do erro ("Failed to fetch dynamically imported module: https://…/assets/x.js")
  const extra = Array.from(textoDoErro.matchAll(/\/assets\/[^\s"')]+?\.(?:js|css)/g)).map(m => m[0]);
  if (typeof w.__doonlyReparar === "function") w.__doonlyReparar(extra);
  else window.location.reload();
}

/** o app abriu: daqui em diante um arquivo que falhar não recarrega sozinho (a Tela de erro cuida, sem perder o que ela preenche) */
export function marcarAppAberto(): void { (window as JanelaDoonly).__doonlyMontou = true; }

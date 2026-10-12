import type { NavigateFunction } from "react-router-dom";

/**
 * Seta de voltar que nunca fica morta (11/10).
 * Se a pessoa chegou na tela por dentro do app, volta pra tela anterior. Se abriu direto (link, notificação,
 * app instalado abrindo nessa tela), não existe "anterior": vai pro destino (padrão: Início).
 * Antes o navigate(-1) não fazia nada no app instalado e, no navegador, saía do Doonly.
 *
 *   <AppPageHeader onBack={() => voltarOuIr(navigate)} />
 *   voltarOuIr(navigate, "/configuracoes")
 */
export function voltarOuIr(navigate: NavigateFunction, destino = "/inicio"): void {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  if (typeof idx === "number" && idx > 0) navigate(-1);
  else navigate(destino, { replace: true });
}

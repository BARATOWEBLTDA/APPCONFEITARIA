import { useProfile } from "@/hooks/useProfile";

/**
 * Plano da conta (02/10) — agora vem do MESMO perfil global do app (useProfile), que se atualiza
 * sozinho: tempo real do Supabase, ao voltar pra tela e a cada minuto.
 * Antes este hook consultava o banco uma única vez ao abrir: depois de ativar o PRO, a Doo IA
 * continuava travada e a tela de Parabéns não aparecia até sair e entrar no app.
 */
export function usePlano() {
  const { profile, loading } = useProfile();
  const expira = profile?.pro_expira_em ? new Date(profile.pro_expira_em) : null;
  // PRO ativo se: plano = 'pro' E (sem expiração OU ainda dentro do prazo)
  const ativo = profile?.plano === "pro" && (!expira || expira > new Date());
  return {
    plano: (ativo ? "pro" : "free") as "free" | "pro",
    isPro: ativo,
    isFree: !ativo,
    proExpiraEm: expira,
    loading: loading && !profile,
  };
}

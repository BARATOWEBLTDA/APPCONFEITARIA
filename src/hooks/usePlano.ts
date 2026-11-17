import { useProfile } from "@/hooks/useProfile";
import { contaTemRecurso, type RecursoChave } from "@/lib/recursos";
import { LIMITE_PRODUTOS_GRATIS } from "@/lib/limitesPlano";

/**
 * Plano da conta (02/10) — agora vem do MESMO perfil global do app (useProfile), que se atualiza
 * sozinho: tempo real do Supabase, ao voltar pra tela e a cada minuto.
 * Antes este hook consultava o banco uma única vez ao abrir: depois de ativar o PRO, a Doo
 * continuava travada e a tela de Parabéns não aparecia até sair e entrar no app.
 *
 * (17/11) temRecurso(chave): a conta tem o recurso se é PRO OU se o admin liberou avulso
 * (profiles.recursos_extras). limiteProdutos: o limite da conta (admin pode subir), padrão 10.
 */
export function usePlano() {
  const { profile, loading } = useProfile();
  const expira = profile?.pro_expira_em ? new Date(profile.pro_expira_em) : null;
  // PRO ativo se: plano = 'pro' E (sem expiração OU ainda dentro do prazo)
  const ativo = profile?.plano === "pro" && (!expira || expira > new Date());
  const recursosExtras = profile?.recursos_extras ?? null;
  const limiteProdutos = typeof profile?.limite_produtos_gratis === "number" && profile.limite_produtos_gratis > 0
    ? profile.limite_produtos_gratis : LIMITE_PRODUTOS_GRATIS;
  return {
    plano: (ativo ? "pro" : "free") as "free" | "pro",
    isPro: ativo,
    isFree: !ativo,
    proExpiraEm: expira,
    /** (17/11) a conta tem esse recurso PRO? (PRO ou liberado avulso pelo admin) */
    temRecurso: (chave: RecursoChave) => contaTemRecurso(ativo, recursosExtras, chave),
    /** (17/11) liberações avulsas da conta */
    recursosExtras,
    /** (17/11) limite de produtos no grátis desta conta (admin pode subir) */
    limiteProdutos,
    loading: loading && !profile,
  };
}

import { supabase } from "@/lib/supabase";

/**
 * Notificações da confeiteira (30/09)
 *  - as "de todas" (user_id vazio: avisos e notícias do admin) + as pessoais (pedido, PRO, conquista...)
 *  - lida / excluída ficam guardadas na conta (tabela notificacoes_estado)
 */
export interface Notif {
  id: string; titulo: string; mensagem?: string; tag?: string; imagem_url?: string; created_at: string;
  user_id?: string | null; tipo?: string | null; link?: string | null; lida: boolean;
}

export async function carregarNotificacoes(limite = 100): Promise<Notif[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const [{ data: ns }, { data: est }] = await Promise.all([
    supabase.from("notificacoes").select("*").order("created_at", { ascending: false }).limit(limite),
    supabase.from("notificacoes_estado").select("notificacao_id, lida_em, excluida").eq("user_id", user.id),
  ]);
  const mapa = new Map<string, any>((est || []).map((e: any) => [e.notificacao_id, e]));
  // Compatibilidade: o que foi visto antes desta versão (data salva no aparelho) conta como lido
  const antigo = Number(localStorage.getItem("notif_last_seen_ms") || 0) || (localStorage.getItem("notif_last_seen") ? new Date(localStorage.getItem("notif_last_seen")!).getTime() : 0);
  return (ns || [])
    .filter((n: any) => !(n.user_id && n.user_id !== user.id))
    .filter((n: any) => !mapa.get(n.id)?.excluida)
    .map((n: any) => ({ ...n, lida: !!mapa.get(n.id)?.lida_em || (antigo > 0 && new Date(n.created_at).getTime() <= antigo && !n.user_id) }));
}

async function salvarEstado(ids: string[], patch: { lida_em?: string; excluida?: boolean }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ids.length) return;
  await supabase.from("notificacoes_estado").upsert(ids.map(id => ({ user_id: user.id, notificacao_id: id, ...patch })), { onConflict: "user_id,notificacao_id" });
  window.dispatchEvent(new CustomEvent("doonly:notif-mudou"));
}
export const marcarLidas = (ids: string[]) => salvarEstado(ids, { lida_em: new Date().toISOString() });
export const excluirNotificacao = (id: string) => salvarEstado([id], { excluida: true, lida_em: new Date().toISOString() });

/** Cria uma notificação só pra esta confeiteira (não repete se a chave já existir) */
export async function criarNotificacaoPessoal(n: { tipo: string; titulo: string; mensagem: string; link?: string; chave: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: existe } = await supabase.from("notificacoes").select("id").eq("user_id", user.id).eq("chave", n.chave).maybeSingle();
  if (existe) return;
  await supabase.from("notificacoes").insert({ user_id: user.id, ...n });
  window.dispatchEvent(new CustomEvent("doonly:notif-mudou"));
}

/**
 * Qual aviso do PRO cabe agora (11/10), ou null. Conta dias de CALENDÁRIO (meia-noite daqui), não blocos de 24h:
 *   - ainda não venceu e faltam até 3 dias → "vencendo" (o texto diz a DATA; o aviso é criado uma vez só e o
 *     "em 2 dias" gravado nele ficava errado no dia seguinte)
 *   - já venceu (a hora passou), até 30 dias atrás → "atrasado"
 * Antes: dizia "vence hoje" depois de vencido e "em 1 dia" no próprio dia do vencimento.
 */
export function avisoDoPro(proExpiraEm: string, agora: Date = new Date()): { tipo: "pro_vencendo" | "pro_atrasado"; mensagem: string; chave: string } | null {
  const exp = new Date(proExpiraEm);
  if (Number.isNaN(exp.getTime())) return null;
  const meiaNoite = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((meiaNoite(exp) - meiaNoite(agora)) / 86400000);
  const ref = String(proExpiraEm).slice(0, 10);
  const venceu = exp.getTime() <= agora.getTime();
  if (!venceu && dias <= 3) {
    const dia = `${String(exp.getDate()).padStart(2, "0")}/${String(exp.getMonth() + 1).padStart(2, "0")}`;
    return { tipo: "pro_vencendo", mensagem: `Seu plano PRO vence no dia ${dia}. Renove pra não perder os recursos.`, chave: `pro-vencendo-${ref}` };
  }
  if (venceu && dias >= -30) {
    return { tipo: "pro_atrasado", mensagem: "Seu plano PRO venceu. Regularize pra voltar a usar o assistente virtual e os recursos PRO.", chave: `pro-atrasado-${ref}` };
  }
  return null;
}

/** PRO vencendo (3 dias antes) e mensalidade atrasada — conferido quando ela abre o app */
export async function verificarAvisosPro(profile: any) {
  if (!profile?.pro_expira_em) return;
  const aviso = avisoDoPro(profile.pro_expira_em);
  if (!aviso) return;
  await criarNotificacaoPessoal({ ...aviso, titulo: aviso.tipo === "pro_vencendo" ? "Seu PRO vence em breve ⏰" : "Mensalidade em atraso ⚠️", link: "/assinar" });
}

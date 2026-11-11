/**
 * (11/11) Acesso de suporte: a equipe Doonly pede, a confeiteira aprova (7 dias), tudo fica registrado.
 * Lado da confeiteira (pedidos, responder, tirar o acesso) e o modo suporte da aba aberta pela equipe.
 */
import { supabase, CHAVE_SUPORTE, emModoSuporte } from "@/lib/supabase";

export type AcessoSuporte = { id: string; status: "pendente" | "aprovado" | "recusado" | "revogado" | "cancelado"; motivo: string; pedido_em: string; respondido_em: string | null; expira_em: string | null; ultimo_acesso_em: string | null; pedido_por_nome: string | null; pedido_por_foto: string | null; pedido_por_cor: string | null };
const CAMPOS = "id, status, motivo, pedido_em, respondido_em, expira_em, ultimo_acesso_em, pedido_por_nome, pedido_por_foto, pedido_por_cor";
/** quem pediu, pelo nome (pedidos antigos, sem perfil: "Equipe Doonly") */
export const quemPediu = (a: Pick<AcessoSuporte, "pedido_por_nome"> | null | undefined) => a?.pedido_por_nome || "Equipe Doonly";
export type EventoSuporte = { id: string; acesso_id: string; evento: string; em: string };

export async function listarAcessos(): Promise<AcessoSuporte[]> {
  const { data, error } = await supabase.from("acessos_suporte").select(CAMPOS).order("pedido_em", { ascending: false }).limit(20);
  if (error) throw error;
  return (data || []) as AcessoSuporte[];
}
export async function listarHistorico(): Promise<EventoSuporte[]> {
  const { data, error } = await supabase.from("acessos_suporte_log").select("id, acesso_id, evento, em").order("em", { ascending: false }).limit(30);
  if (error) throw error;
  return (data || []) as EventoSuporte[];
}
export async function lerAcesso(id: string): Promise<AcessoSuporte | null> {
  const { data } = await supabase.from("acessos_suporte").select(CAMPOS).eq("id", id).maybeSingle();
  return (data as AcessoSuporte) || null;
}
export async function responderAcesso(id: string, permitir: boolean) {
  const { error } = await supabase.rpc("responder_acesso_suporte", { p_id: id, p_permitir: permitir });
  if (error) throw error;
  window.dispatchEvent(new Event("doonly:suporte"));
}
export async function revogarAcesso(id: string) {
  const { error } = await supabase.rpc("revogar_acesso_suporte", { p_id: id });
  if (error) throw error;
  window.dispatchEvent(new Event("doonly:suporte"));
}
/** pedido esperando resposta (para o "Pra fazer" do Início) */
export async function pedidoPendente(): Promise<AcessoSuporte | null> {
  if (emModoSuporte) return null;
  const { data } = await supabase.from("acessos_suporte").select(CAMPOS).eq("status", "pendente").order("pedido_em", { ascending: false }).limit(1).maybeSingle();
  return (data as AcessoSuporte) || null;
}
export const acessoValido = (a: AcessoSuporte) => a.status === "aprovado" && !!a.expira_em && new Date(a.expira_em).getTime() > Date.now();

/* ── modo suporte (a aba aberta pela equipe) ── */
export type SessaoSuporte = { acessoId: string; loja: string; expira: string };
export const sessaoSuporte = (): SessaoSuporte | null => {
  if (!emModoSuporte) return null;
  try { const v = sessionStorage.getItem(CHAVE_SUPORTE); return v ? JSON.parse(v) as SessaoSuporte : null; } catch { return null; }
};
export const guardarSessaoSuporte = (s: SessaoSuporte) => { try { sessionStorage.setItem(CHAVE_SUPORTE, JSON.stringify(s)); } catch { /* sem armazenamento */ } };
/** sair do modo suporte: registra a saída e desfaz o login SÓ desta aba (scope local: a confeiteira continua logada nos aparelhos dela) */
export async function sairDoSuporte() {
  const s = sessaoSuporte();
  try { if (s) await supabase.functions.invoke("suporte-acesso", { body: { action: "sair", acessoId: s.acessoId } }); } catch { /* segue saindo */ }
  try { await supabase.auth.signOut({ scope: "local" }); } catch { /* segue */ }
  try { sessionStorage.removeItem(CHAVE_SUPORTE); } catch { /* segue */ }
}
/** telas que o suporte pode abrir (tudo do Minha loja; nada de pedidos, clientes ou financeiro) */
export const ROTAS_SUPORTE = ["/cardapio-design", "/cardapio-config", "/cardapio", "/cardapio-preview", "/cardapio-metricas", "/produtos", "/categorias", "/complementos", "/configuracoes/mensagens", "/cupons", "/pixel", "/suporte/entrar"];
export const rotaPermitidaNoSuporte = (p: string) => ROTAS_SUPORTE.some(r => p === r || p.startsWith(r + "/"));

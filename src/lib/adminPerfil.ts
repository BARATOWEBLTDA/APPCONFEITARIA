// ── adminPerfil.ts ───────────────────────────────────────────────────────────
// (04/11) Os 3 admins (Anthony, Bruno e Marcos) entram com a mesma conta e escolhem
// quem está usando, estilo Netflix. O perfil escolhido vale para a aba aberta
// (sessionStorage): ao abrir o painel de novo, pergunta outra vez.
// registrar() grava no Registro o que foi feito, com o nome de quem fez.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "@/lib/supabase";

export type PerfilAdmin = { id: string; nome: string; foto_url: string | null; cor: string | null };
export type TipoRegistro = "usuario" | "pro" | "bloqueio" | "exclusao" | "banner" | "noticia" | "autor" | "ideia" | "aviso" | "outro";

const CHAVE = "doonly_admin_perfil";
const ULTIMO = "doonly_admin_perfil_ultimo";
export const EVENTO_PERFIL = "admin-perfil-mudou";
export const EVENTO_REGISTRO = "admin-registro-novo";

export function perfilAtual(): PerfilAdmin | null {
  try { const v = sessionStorage.getItem(CHAVE); return v ? (JSON.parse(v) as PerfilAdmin) : null; } catch { return null; }
}
/** o último que entrou neste aparelho (fica marcado na tela de escolher) */
export function ultimoPerfil(): string | null {
  try { return localStorage.getItem(ULTIMO); } catch { return null; }
}
export function escolherPerfil(p: PerfilAdmin | null) {
  try {
    if (p) { sessionStorage.setItem(CHAVE, JSON.stringify(p)); localStorage.setItem(ULTIMO, p.id); }
    else sessionStorage.removeItem(CHAVE);
  } catch { /* sem storage: vale só até recarregar */ }
  window.dispatchEvent(new Event(EVENTO_PERFIL));
}

/** Grava no Registro: registrar("deu o PRO de 30 dias para Doce Formiga", { tipo: "pro", alvo_id }) */
export async function registrar(acao: string, opcoes: { tipo?: TipoRegistro; alvo_id?: string | null; detalhe?: Record<string, unknown> } = {}): Promise<void> {
  const p = perfilAtual();
  try {
    const { error } = await supabase.from("admin_log").insert({
      perfil_id: p?.id ?? null, perfil_nome: p?.nome ?? "Admin", acao,
      tipo: opcoes.tipo ?? "outro", alvo_id: opcoes.alvo_id ?? null, detalhe: opcoes.detalhe ?? null,
    });
    if (!error) window.dispatchEvent(new Event(EVENTO_REGISTRO));
  } catch { /* o registro nunca atrapalha a ação que já deu certo */ }
}

/** "Doce Formiga" (ou o nome da pessoa, ou o e-mail) pra usar na frase do registro */
export const nomeConta = (u: { nome_loja?: string | null; nome?: string | null; email?: string | null } | null | undefined) =>
  (u?.nome_loja || "").trim() || (u?.nome || "").trim() || (u?.email || "").trim() || "uma conta";

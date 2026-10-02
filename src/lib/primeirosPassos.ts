/**
 * Regra ÚNICA dos primeiros passos (02/10) — usada pelo cartão "Primeiros passos" do Início
 * e pelo passo a passo do Cardápio digital. Fazer o passo num lugar marca no outro.
 *   design ......... abriu/mexeu na Aparência (profiles.design_escolhido)
 *   produto ........ tem pelo menos 1 produto disponível
 *   compartilhou ... enviou ou copiou o link (profiles.cardapio_compartilhado; antes só no aparelho)
 */
import { supabase } from "@/lib/supabase";

const chaveLocal = (uid: string) => `doonly_cardapio_compartilhado_${uid}`;

export type EstadoPassos = { design: boolean; produto: boolean; compartilhou: boolean };

export async function lerPassos(uid: string): Promise<EstadoPassos> {
  const [perfil, produtos] = await Promise.all([
    supabase.from("profiles").select("design_escolhido, cardapio_compartilhado").eq("id", uid).maybeSingle(),
    supabase.from("produtos").select("id, disponivel").eq("user_id", uid),
  ]);
  const p: any = perfil.error ? null : perfil.data;
  let local = false;
  try { local = localStorage.getItem(chaveLocal(uid)) === "1"; } catch {}
  // Compartilhou neste aparelho antes da coluna existir: leva pro banco
  if (local && p && !p.cardapio_compartilhado) {
    supabase.from("profiles").update({ cardapio_compartilhado: true }).eq("id", uid).then(() => {}, () => {});
  }
  return {
    design: !!p?.design_escolhido,
    produto: ((produtos.data as any[]) || []).some((x) => x.disponivel !== false),
    compartilhou: !!p?.cardapio_compartilhado || local,
  };
}

export function marcarCompartilhado(uid: string | null | undefined) {
  if (!uid) return;
  try { localStorage.setItem(chaveLocal(uid), "1"); } catch {}
  supabase.from("profiles").update({ cardapio_compartilhado: true }).eq("id", uid).then(() => {}, () => {});
  window.dispatchEvent(new Event("doonly:passos"));
}

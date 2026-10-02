/**
 * Regra ÚNICA dos primeiros passos (02/10) — o mesmo cartão aparece no Início (celular) e no
 * Cardápio digital. Fazer o passo num lugar marca no outro. Tudo vem do banco.
 *   descricao ...... descrição da loja preenchida
 *   logo ........... enviou um logo OU escolheu "usar minha foto de perfil" (profiles.design_escolhido)
 *   endereco ....... cidade + rua (ou CEP), igual aos Dados da loja
 *   horario ........ horário salvo com pelo menos um dia
 *   produto ........ tem pelo menos 1 produto disponível
 *   compartilhou ... enviou ou copiou o link (profiles.cardapio_compartilhado)
 */
import { supabase } from "@/lib/supabase";

const chaveLocal = (uid: string) => `doonly_cardapio_compartilhado_${uid}`;

export type EstadoPassos = {
  descricao: boolean; logo: boolean; endereco: boolean; horario: boolean; produto: boolean; compartilhou: boolean;
  /** dados atuais, pra abrir as janelinhas já preenchidas */
  perfil: any;
};

const lerJson = (v: any) => { if (!v) return null; if (typeof v === "object") return v; try { return JSON.parse(v); } catch { return null; } };

export async function lerPassos(uid: string): Promise<EstadoPassos> {
  const [perfil, produtos] = await Promise.all([
    supabase.from("profiles").select("nome_loja, descricao_loja, logo_url, foto_url, endereco, mostrar_localizacao, mostrar_apenas_cidade, horario, design_escolhido, cardapio_compartilhado").eq("id", uid).maybeSingle(),
    supabase.from("produtos").select("id, disponivel").eq("user_id", uid),
  ]);
  const p: any = perfil.error ? {} : (perfil.data || {});
  let local = false;
  try { local = localStorage.getItem(chaveLocal(uid)) === "1"; } catch {}
  if (local && p && !p.cardapio_compartilhado) {
    supabase.from("profiles").update({ cardapio_compartilhado: true }).eq("id", uid).then(() => {}, () => {});
  }
  const end = lerJson(p.endereco) || {};
  const hor = lerJson(p.horario);
  return {
    descricao: !!String(p.descricao_loja || "").trim(),
    logo: !!p.logo_url || !!p.design_escolhido,
    endereco: !!(String(end.cidade || "").trim() && (String(end.rua || "").trim() || String(end.cep || "").trim())),
    horario: !!hor && ((hor.dias?.length || 0) > 0 || !!hor.abre_sabado || !!hor.abre_domingo),
    produto: ((produtos.data as any[]) || []).some((x) => x.disponivel !== false),
    compartilhou: !!p.cardapio_compartilhado || local,
    perfil: { ...p, endereco: end, horario: hor },
  };
}

export const passosCompletos = (e: EstadoPassos | null) =>
  !!e && e.descricao && e.logo && e.endereco && e.horario && e.produto && e.compartilhou;

export function marcarCompartilhado(uid: string | null | undefined) {
  if (!uid) return;
  try { localStorage.setItem(chaveLocal(uid), "1"); } catch {}
  supabase.from("profiles").update({ cardapio_compartilhado: true }).eq("id", uid).then(() => {}, () => {});
  window.dispatchEvent(new Event("doonly:passos"));
}

export const avisarPassos = () => window.dispatchEvent(new Event("doonly:passos"));

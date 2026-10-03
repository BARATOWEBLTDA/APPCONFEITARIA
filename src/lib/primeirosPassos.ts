/**
 * Regra ÚNICA dos primeiros passos (02/10) — o mesmo cartão aparece no Início (celular) e no
 * Cardápio digital. Fazer o passo num lugar marca no outro. Tudo vem do banco.
 *   descricao ...... descrição da loja preenchida
 *   logo ........... enviou um logo OU escolheu "usar minha foto de perfil" (profiles.logo_confirmado)
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

// Campos novos (vêm de SQLs que podem ainda não ter sido rodados): lidos à parte, um por um,
// pra um campo faltando não derrubar a leitura do resto (antes o cartão mostrava tudo "não feito").
const CAMPOS_NOVOS = ["design_escolhido", "cardapio_compartilhado", "logo_confirmado"] as const;
const chaveLogo = (uid: string) => `doonly_logo_ok_${uid}`;

export async function lerPassos(uid: string): Promise<EstadoPassos> {
  const [perfil, produtos, ...extras] = await Promise.all([
    supabase.from("profiles").select("nome_loja, descricao_loja, logo_url, foto_url, endereco, mostrar_localizacao, mostrar_apenas_cidade, horario").eq("id", uid).maybeSingle(),
    supabase.from("produtos").select("id, disponivel").eq("user_id", uid),
    ...CAMPOS_NOVOS.map(c => supabase.from("profiles").select(c).eq("id", uid).maybeSingle()),
  ]);
  const p: any = { ...(perfil.error ? {} : (perfil.data || {})) };
  extras.forEach((r: any) => { if (!r.error && r.data) Object.assign(p, r.data); });
  let logoLocal = false;
  try { logoLocal = localStorage.getItem(chaveLogo(uid)) === "1"; } catch {}
  let local = false;
  try { local = localStorage.getItem(chaveLocal(uid)) === "1"; } catch {}
  if (local && p && !p.cardapio_compartilhado) {
    supabase.from("profiles").update({ cardapio_compartilhado: true }).eq("id", uid).then(() => {}, () => {});
  }
  const end = lerJson(p.endereco) || {};
  const hor = lerJson(p.horario);
  return {
    descricao: !!String(p.descricao_loja || "").trim(),
    // Só conta com logo enviado OU "usar minha foto" escolhido (a foto do Google sozinha não conta)
    logo: !!p.logo_url || !!p.logo_confirmado || logoLocal,
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

/** Marca o passo do logo também no aparelho (reserva se o campo logo_confirmado ainda não existir). */
export function marcarLogoOk(uid: string) { try { localStorage.setItem(chaveLogo(uid), "1"); } catch {} }

/**
 * Atualiza o perfil. Se o banco recusar por um campo que ainda não existe (SQL não rodado),
 * tenta de novo sem os campos "opcionais". Devolve o erro só se o principal falhar.
 */
export async function atualizarPerfil(uid: string, campos: Record<string, unknown>, opcionais: string[] = []): Promise<string | null> {
  const { error } = await supabase.from("profiles").update(campos).eq("id", uid);
  if (!error) return null;
  const semOpcionais = Object.fromEntries(Object.entries(campos).filter(([k]) => !opcionais.includes(k)));
  if (opcionais.length && Object.keys(semOpcionais).length < Object.keys(campos).length) {
    if (!Object.keys(semOpcionais).length) return null; // só tinha campos novos: fica a marca no aparelho
    const r2 = await supabase.from("profiles").update(semOpcionais).eq("id", uid);
    if (!r2.error) return null;
    return r2.error.message;
  }
  return error.message;
}

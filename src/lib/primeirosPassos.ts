import { useAoVoltar } from "@/hooks/useAoVoltar";
/**
 * Regra ÚNICA dos primeiros passos (02/10) — o mesmo cartão aparece no Início (celular) e no
 * Cardápio digital. Fazer o passo num lugar marca no outro. Tudo vem do banco.
 *   descricao ...... descrição da loja preenchida
 *   logo ........... enviou um logo, escolheu "usar minha foto de perfil" ou enviou uma foto de perfil
 *   endereco ....... cidade + rua (ou CEP), igual aos Dados da loja
 *   horario ........ horário salvo com pelo menos um dia
 *   produto ........ tem pelo menos 1 produto disponível
 *   compartilhou ... enviou ou copiou o link (profiles.cardapio_compartilhado)
 */
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { erroDeConexao } from "@/lib/erros";

/** Foto de perfil enviada pela própria confeiteira (não a que vem do login com Google). */
const fotoPropria = (url?: string | null) => !!url && !/googleusercontent\.com|gravatar\.com|graph\.facebook/i.test(url);

const chaveLocal = (uid: string) => `doonly_cardapio_compartilhado_${uid}`;

export type EstadoPassos = {
  descricao: boolean; logo: boolean; endereco: boolean; horario: boolean; produto: boolean; compartilhou: boolean;
  /** (13/10) conferiu as formas de pagamento e entrega (ou já tem produto: conta antiga não volta a ver os passos) */
  pagamento: boolean;
  /** (13/10) informou o saldo do caixa (ou já tem produto: conta antiga não volta a ver os passos) */
  caixa: boolean;
  /** dados atuais, pra abrir as janelinhas já preenchidas */
  perfil: any;
  /**
   * (10/10) A leitura falhou (sem internet, por exemplo): os passos acima NÃO valem. Quem mostra o cartão ignora
   * este resultado e mantém o que já tinha (antes aparecia tudo "não feito" e, depois, a comemoração de novo).
   */
  falhou?: boolean;
};

const lerJson = (v: any) => { if (!v) return null; if (typeof v === "object") return v; try { return JSON.parse(v); } catch { return null; } };

// Campos novos (vêm de SQLs que podem ainda não ter sido rodados): lidos à parte, um por um,
// pra um campo faltando não derrubar a leitura do resto (antes o cartão mostrava tudo "não feito").
const CAMPOS_NOVOS = ["design_escolhido", "cardapio_compartilhado", "logo_confirmado", "caixa_inicio_em"] as const;
const chaveLogo = (uid: string) => `doonly_logo_ok_${uid}`;

export async function lerPassos(uid: string): Promise<EstadoPassos> {
  const [conta, perfil, produtos, ...extras] = await Promise.all([
    supabase.auth.getUser().then(r => r, () => ({ data: { user: null } } as any)),
    supabase.from("profiles").select("nome_loja, descricao_loja, logo_url, foto_url, endereco, mostrar_localizacao, mostrar_apenas_cidade, horario").eq("id", uid).maybeSingle(),
    supabase.from("produtos").select("id, disponivel").eq("user_id", uid),
    ...CAMPOS_NOVOS.map(c => supabase.from("profiles").select(c).eq("id", uid).maybeSingle()),
  ]);
  const p: any = { ...(perfil.error ? {} : (perfil.data || {})) };
  extras.forEach((r: any) => { if (!r.error && r.data) Object.assign(p, r.data); });
  // campo novo que ainda não existe no banco dá erro e segue; queda de internet não: aí a leitura toda não vale
  const falhou = !!perfil.error || !!produtos.error || extras.some((r: any) => r.error && erroDeConexao(r.error));
  let logoLocal = false;
  try { logoLocal = localStorage.getItem(chaveLogo(uid)) === "1"; } catch {}
  let local = false;
  try { local = localStorage.getItem(chaveLocal(uid)) === "1"; } catch {}
  if (local && !falhou && !p.cardapio_compartilhado) {
    supabase.from("profiles").update({ cardapio_compartilhado: true }).eq("id", uid).then(() => {}, () => {});
  }
  const end = lerJson(p.endereco) || {};
  const hor = lerJson(p.horario);
  return {
    descricao: !!String(p.descricao_loja || "").trim(),
    // Conta com logo enviado, "usar minha foto" escolhido, ou uma foto de perfil que ela mesma enviou
    // (09/10: antes pedia o logo mesmo com foto colocada). A foto que vem do Google sozinha não conta.
    logo: !!p.logo_url || !!p.logo_confirmado || logoLocal || fotoPropria(p.foto_url),
    endereco: !!(String(end.cidade || "").trim() && (String(end.rua || "").trim() || String(end.cep || "").trim())),
    horario: !!hor && ((hor.dias?.length || 0) > 0 || !!hor.abre_sabado || !!hor.abre_domingo),
    produto: ((produtos.data as any[]) || []).some((x) => x.disponivel !== false),
    compartilhou: !!p.cardapio_compartilhado || local,
    // (13/10) salvo também na conta (user_metadata), não só no aparelho
    pagamento: pagamentoConferido(uid) || !!(conta as any)?.data?.user?.user_metadata?.pp_pagamento || ((produtos.data as any[]) || []).length > 0,
    caixa: p.caixa_inicio_em != null || !!(conta as any)?.data?.user?.user_metadata?.pp_caixa || ((produtos.data as any[]) || []).length > 0,
    perfil: { ...p, endereco: end, horario: hor },
    falhou,
  };
}

// 02/10: o "compartilhar o link" saiu dos passos — com o cardápio pronto, vai direto pra comemoração
export const passosCompletos = (e: EstadoPassos | null) =>
  !!e && e.descricao && e.logo && e.endereco && e.horario && e.pagamento && e.caixa && e.produto;

/** (13/10) Passo "Pagamento e entrega": marca quando ela salva a tela Entrega e pagamento (neste aparelho). */
const chavePagamento = (uid: string) => `doonly_pp_pagamento_${uid}`;
export function pagamentoConferido(uid: string) { try { return localStorage.getItem(chavePagamento(uid)) === "1"; } catch { return false; } }
export function marcarPagamentoConferido(uid: string | null | undefined) {
  if (!uid) return;
  try { localStorage.setItem(chavePagamento(uid), "1"); } catch {}
  supabase.auth.updateUser({ data: { pp_pagamento: true } }).then(() => {}, () => {});
  window.dispatchEvent(new Event("doonly:passos"));
}

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

/**
 * (13/10) A loja já está pronta pra receber pedidos pelo cardápio? (todos os primeiros passos feitos)
 * null enquanto lê (quem usa trata como pronta, pra conta antiga não piscar). Atualiza quando um passo muda.
 */
export function useLojaPronta(uid: string | null | undefined): boolean | null {
  const [pronta, setPronta] = useState<boolean | null>(null);
  // (15/10) ao voltar pro app, confere de novo (antes só ao abrir a tela)
  const [voltou, setVoltou] = useState(0);
  useAoVoltar(() => setVoltou(v => v + 1));
  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    const ler = () => lerPassos(uid).then(e => { if (vivo && !e.falhou) setPronta(passosCompletos(e)); }).catch(() => {});
    ler();
    window.addEventListener("doonly:passos", ler);
    return () => { vivo = false; window.removeEventListener("doonly:passos", ler); };
  }, [uid, voltou]);
  return pronta;
}

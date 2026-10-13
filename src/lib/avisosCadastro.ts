import { supabase } from "@/lib/supabase";
import { criarNotificacaoPessoal } from "@/lib/notificacoesUsuario";

/**
 * (13/10) O que falta cadastrar pro app mostrar os números certos (lucro, caixa, contas).
 * Cada item vira uma notificação (uma vez só, pela chave) e uma linha no cartão "Falta pouco" da Início.
 * Leitura que falha não vira aviso: o item só aparece quando dá pra ter certeza que falta.
 */
export type AvisoCadastro = { chave: string; titulo: string; texto: string; link: string; icone: "custos" | "maquininha" | "ficha" | "caixa" | "conta" };

const amanha = () => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export async function lerAvisosCadastro(uid: string): Promise<AvisoCadastro[]> {
  const [fixos, variaveis, perfil, produtos, contas] = await Promise.all([
    supabase.from("custos_fixos").select("id").eq("user_id", uid).limit(1),
    supabase.from("custos_variaveis").select("*").eq("user_id", uid),
    supabase.from("profiles").select("formas_pagamento, caixa_inicio_em").eq("id", uid).maybeSingle(),
    supabase.from("produtos").select("id, produto_insumos(id)").eq("user_id", uid).eq("disponivel", true),
    supabase.from("contas_pagar").select("id, descricao").eq("user_id", uid).eq("status", "pendente").eq("vencimento", amanha()),
  ]);
  const l: AvisoCadastro[] = [];
  if (!fixos.error && (fixos.data || []).length === 0)
    l.push({ chave: "falta_custos_fixos", icone: "custos", titulo: "Cadastre seus custos fixos", texto: "Aluguel, luz, internet: sem eles o lucro parece maior do que é.", link: "/custos" });
  const vendeCartao = !perfil.error && ((perfil.data as any)?.formas_pagamento || []).some((f: string) => f === "credito" || f === "debito");
  const temTaxa = ((variaveis.data as any[]) || []).some(v => v.forma || /maquin/i.test(String(v.nome || "")));
  if (vendeCartao && !variaveis.error && !temTaxa)
    l.push({ chave: "falta_taxa_maquininha", icone: "maquininha", titulo: "Cadastre a taxa da maquininha", texto: "Ela muda no débito e no crédito. Leva 1 minuto.", link: "/custos" });
  const semFicha = !produtos.error ? ((produtos.data as any[]) || []).filter(p => !(p.produto_insumos || []).length).length : 0;
  if (semFicha > 0)
    l.push({ chave: "falta_ficha_tecnica", icone: "ficha", titulo: semFicha === 1 ? "1 produto sem ficha técnica" : `${semFicha} produtos sem ficha técnica`, texto: "Sem a ficha, o app não sabe o custo nem o lucro.", link: "/ficha-tecnica" });
  if (!perfil.error && perfil.data && (perfil.data as any).caixa_inicio_em == null)
    l.push({ chave: "falta_saldo_caixa", icone: "caixa", titulo: "Informe o saldo do caixa", texto: "Assim o Financeiro mostra quanto você tem de verdade.", link: "/financeiro" });
  if (!contas.error) for (const c of (contas.data as any[]) || [])
    l.push({ chave: `conta_vence_${c.id}`, icone: "conta", titulo: `Vence amanhã: ${c.descricao}`, texto: "Pague ou marque como paga em A pagar.", link: "/financeiro/a-pagar" });
  return l;
}

/** Manda cada aviso pras notificações (uma vez só por chave) */
export function notificarAvisosCadastro(avisos: AvisoCadastro[]) {
  for (const a of avisos) criarNotificacaoPessoal({ tipo: "aviso", titulo: a.titulo, mensagem: a.texto, link: a.link, chave: a.chave }).catch(() => {});
}

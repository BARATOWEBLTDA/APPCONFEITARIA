import { supabase } from "@/lib/supabase";
import { criarNotificacaoPessoal } from "@/lib/notificacoesUsuario";

/**
 * (13/10) O que falta cadastrar pro app mostrar os números certos (lucro, caixa, contas).
 * Cada item vira uma notificação (uma vez só, pela chave) e uma linha no cartão "Falta pouco" da Início.
 * Leitura que falha não vira aviso: o item só aparece quando dá pra ter certeza que falta.
 */
export type AvisoCadastro = {
  chave: string; titulo: string; texto: string; link: string; icone: "custos" | "maquininha" | "ficha" | "caixa" | "conta";
  /** (15/10) pro cartão "Pra fazer": urgência e a linha curta (cabe numa linha no celular) */
  nivel: "urgente" | "atencao" | "normal"; curto: { t: string; s: string };
};

const diaISO = (somar = 0) => { const d = new Date(); d.setDate(d.getDate() + somar); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export async function lerAvisosCadastro(uid: string): Promise<AvisoCadastro[]> {
  const [fixos, variaveis, perfil, produtos, contas] = await Promise.all([
    supabase.from("custos_fixos").select("id").eq("user_id", uid).limit(1),
    supabase.from("custos_variaveis").select("*").eq("user_id", uid),
    supabase.from("profiles").select("formas_pagamento, caixa_inicio_em").eq("id", uid).maybeSingle(),
    supabase.from("produtos").select("id, produto_insumos(id)").eq("user_id", uid).eq("disponivel", true),
    // (15/10) também as que vencem hoje e as atrasadas (antes só as de amanhã)
    supabase.from("contas_pagar").select("id, descricao, vencimento").eq("user_id", uid).eq("status", "pendente").lte("vencimento", diaISO(1)).order("vencimento"),
  ]);
  const l: AvisoCadastro[] = [];
  // contas primeiro (são as mais urgentes): atrasada, hoje, amanhã. A chave muda com a situação, pra avisar de novo quando vira "hoje"
  if (!contas.error) for (const c of (contas.data as any[]) || []) {
    const v = String(c.vencimento || "").slice(0, 10);
    const sit = v < diaISO(0) ? "atrasada" : v === diaISO(0) ? "hoje" : "amanha";
    l.push({ chave: sit === "amanha" ? `conta_vence_${c.id}` : `conta_${sit}_${c.id}`, icone: "conta",
      titulo: `${sit === "atrasada" ? "Atrasada" : sit === "hoje" ? "Vence hoje" : "Vence amanhã"}: ${c.descricao}`,
      texto: "Pague ou marque como paga em A pagar.", link: "/financeiro/a-pagar",
      nivel: sit === "amanha" ? "atencao" : "urgente",
      curto: { t: sit === "atrasada" ? `${c.descricao} atrasado` : String(c.descricao), s: sit === "atrasada" ? "Já venceu" : sit === "hoje" ? "Vence hoje" : "Vence amanhã" } });
  }
  if (!fixos.error && (fixos.data || []).length === 0)
    l.push({ chave: "falta_custos_fixos", icone: "custos", titulo: "Cadastre seus custos fixos", texto: "Aluguel, luz, internet: sem eles o lucro parece maior do que é.", link: "/custos", nivel: "normal", curto: { t: "Custos fixos", s: "Aluguel, luz, internet" } });
  const vendeCartao = !perfil.error && ((perfil.data as any)?.formas_pagamento || []).some((f: string) => f === "credito" || f === "debito");
  const temTaxa = ((variaveis.data as any[]) || []).some(v => v.forma || /maquin/i.test(String(v.nome || "")));
  if (vendeCartao && !variaveis.error && !temTaxa)
    l.push({ chave: "falta_taxa_maquininha", icone: "maquininha", titulo: "Cadastre a taxa da maquininha", texto: "Ela muda no débito e no crédito. Leva 1 minuto.", link: "/custos", nivel: "normal", curto: { t: "Taxa da maquininha", s: "Débito e crédito" } });
  const semFicha = !produtos.error ? ((produtos.data as any[]) || []).filter(p => !(p.produto_insumos || []).length).length : 0;
  if (semFicha > 0)
    l.push({ chave: "falta_ficha_tecnica", icone: "ficha", titulo: semFicha === 1 ? "1 produto sem ficha técnica" : `${semFicha} produtos sem ficha técnica`, texto: "Sem a ficha, o app não sabe o custo nem o lucro.", link: "/ficha-tecnica", nivel: "normal", curto: { t: `${semFicha} sem ficha técnica`, s: "Pro app saber o lucro" } });
  if (!perfil.error && perfil.data && (perfil.data as any).caixa_inicio_em == null)
    l.push({ chave: "falta_saldo_caixa", icone: "caixa", titulo: "Informe o saldo do caixa", texto: "Assim o Financeiro mostra quanto você tem de verdade.", link: "/financeiro", nivel: "normal", curto: { t: "Saldo do caixa", s: "Quanto tem hoje" } });
  return l;
}

/** Manda cada aviso pras notificações (uma vez só por chave) */
export function notificarAvisosCadastro(avisos: AvisoCadastro[]) {
  // (15/10) velocidade: cada aviso vira notificação no máximo 1 vez por dia neste aparelho
  // (antes conferia no banco, aviso por aviso, toda vez que o Início abria)
  const d = new Date(), hoje = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const k = "doonly_avisos_notificados";
  let feitos: { dia: string; chaves: string[] } = { dia: hoje, chaves: [] };
  try { const v = JSON.parse(localStorage.getItem(k) || "null"); if (v?.dia === hoje && Array.isArray(v.chaves)) feitos = v; } catch {}
  const novos = avisos.filter(a => !feitos.chaves.includes(a.chave));
  if (!novos.length) return;
  for (const a of novos) criarNotificacaoPessoal({ tipo: "aviso", titulo: a.titulo, mensagem: a.texto, link: a.link, chave: a.chave }).catch(() => {});
  try { localStorage.setItem(k, JSON.stringify({ dia: hoje, chaves: [...feitos.chaves, ...novos.map(a => a.chave)] })); } catch {}
}

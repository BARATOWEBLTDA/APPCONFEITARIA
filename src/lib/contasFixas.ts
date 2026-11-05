import { supabase } from "@/lib/supabase";
import { faltaNoBanco } from "@/lib/pagamentos";

/**
 * (6.157) Contas dos custos fixos (aluguel, internet…) viram uma conta a pagar por mês (rpc contas_pagar_gerar_mes).
 * Antes só a tela A pagar gerava, e só este mês e o próximo: quem ficava 2 meses sem abrir a tela perdia os meses do meio
 * (a conta de setembro nunca aparecia). Agora gera do mês seguinte à última conta fixa gerada (no máximo 12 meses
 * pra trás) até o mês que vem. O rpc não duplica (custo_fixo_id + competência únicos) e respeita o início de cada custo,
 * então chamar pra meses passados é seguro.
 */
const MESES_PRA_TRAS = 12;

/** "AAAA-MM" do mês de hoje + n */
const competencia = (n: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
/** quantos meses "AAAA-MM" fica antes (negativo) ou depois do mês de hoje */
const mesesDeHoje = (c: string) => { const [y, m] = c.split("-").map(Number); const h = new Date(); return (y - h.getFullYear()) * 12 + (m - 1 - h.getMonth()); };
/** A função do banco ainda não existe (SQL do Passo 5 não rodado)? Aí não é falha. */
const funcaoNaoExiste = (e: unknown) => ["PGRST202", "42883"].includes(String((e as { code?: unknown } | null)?.code || "")) || faltaNoBanco(e);

/** Gera os meses que faltam. Devolve o primeiro erro de verdade (sem o "falta o SQL"); nunca lança. */
export async function gerarContasFixas(uid: string): Promise<{ error: unknown | null }> {
  try {
    // a última competência já gerada de conta fixa
    const { data, error } = await supabase.from("contas_pagar").select("competencia")
      .eq("user_id", uid).not("custo_fixo_id", "is", null).not("competencia", "is", null)
      .order("competencia", { ascending: false }).limit(1);
    if (error && !faltaNoBanco(error)) return { error };
    const ultima = String((data as { competencia?: string | null }[] | null)?.[0]?.competencia || "");
    // do mês seguinte à última (máx. 12 meses pra trás); este mês e o próximo sempre (custo fixo novo entra já)
    const desde = /^\d{4}-\d{2}$/.test(ultima) ? Math.max(-MESES_PRA_TRAS, Math.min(0, mesesDeHoje(ultima) + 1)) : 0;
    const meses: string[] = [];
    for (let n = desde; n <= 1; n++) meses.push(competencia(n));
    // juntos (no normal são 2: este mês e o próximo; o rpc não duplica, então a ordem não importa)
    const rs = await Promise.all(meses.map(c => supabase.rpc("contas_pagar_gerar_mes", { p_competencia: c })));
    // sem o SQL não é falha: a tela A pagar já avisa
    return { error: rs.map(r => r.error).find(e => e && !funcaoNaoExiste(e)) || null };
  } catch (e) {
    return { error: e };
  }
}

/** Uma vez por sessão (Início e Visão geral do Financeiro): a mesma promessa pra todo mundo; nunca rejeita. */
let daSessao: { uid: string; dia: string; promessa: Promise<void> } | null = null;
export function garantirContasFixas(uid: string): Promise<void> {
  const dia = competencia(0); // virou o mês com o app aberto: gera de novo
  if (daSessao && daSessao.uid === uid && daSessao.dia === dia) return daSessao.promessa;
  const promessa = gerarContasFixas(uid).then(r => {
    if (r.error) { console.error("[contas fixas] não gerei as contas do mês:", r.error); daSessao = null; } // tenta de novo na próxima
  });
  daSessao = { uid, dia, promessa };
  return promessa;
}

import { supabase } from "@/lib/supabase";

/**
 * (14/10) Predefinições de rendimento com nome ("Bolos de aniversário", "Pudins"…).
 * Ficam nos dados da conta (user_metadata.rend_predef): valem em qualquer aparelho, sem tabela nova.
 * Cada uma guarda a unidade e o número de cada tamanho, pelo nome do tamanho (1 kg, Pequeno…).
 */
export type PredefRend = { nome: string; un: string; itens: Record<string, string> };

export const chaveTam = (nome: string) =>
  (nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").replace(",", ".").trim();

// o que foi gravado nesta sessão vale na hora (a conta pode demorar a devolver o dado novo)
let cache: PredefRend[] | null = null;

export async function lerPredefs(): Promise<PredefRend[]> {
  if (cache) return cache;
  try {
    const { data } = await supabase.auth.getUser();
    const l = (data?.user?.user_metadata as any)?.rend_predef;
    return Array.isArray(l) ? l.filter(p => p && typeof p.nome === "string") : [];
  } catch { return []; }
}

export async function gravarPredefs(lista: PredefRend[]): Promise<boolean> {
  try {
    const { error } = await supabase.auth.updateUser({ data: { rend_predef: lista.slice(0, 30) } });
    if (!error) cache = lista.slice(0, 30);
    return !error;
  } catch { return false; }
}

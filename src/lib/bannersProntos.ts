import { supabase } from "@/lib/supabase";

/**
 * (17/10) Banners prontos pro cardápio: a equipe monta a galeria em /admin/banners-prontos e a
 * confeiteira escolhe em Aparência > Banners de promoção. Tabela banners_prontos (SQL banners_prontos).
 */
export type BannerPronto = {
  id: string;
  titulo: string;
  categoria: string;
  imagem_url: string;
  ativo: boolean;
  so_pro: boolean;
  ordem: number;
};

export const CATEGORIAS_BANNER = ["Bolos", "Doces", "Salgados", "Festas", "Datas", "Capa de Natal"] as const;
/** (18/10) imagens da capa do catálogo de Natal (não entram na galeria de banners) */
export const CATEGORIA_CAPA_NATAL = "Capa de Natal";

/** Tamanho padrão dos banners da galeria (o mesmo pra todos, pra o carrossel não pular) */
export const TAMANHO_BANNER = "1500 × 500";

/** Galeria pra confeiteira: só os ativos (a regra do banco também filtra), na ordem da equipe */
export async function lerBannersProntos(): Promise<{ ok: true; lista: BannerPronto[] } | { ok: false }> {
  const { data, error } = await supabase.from("banners_prontos").select("*").eq("ativo", true).order("ordem").order("created_at");
  if (error) return { ok: false };
  return { ok: true, lista: (data as BannerPronto[]) || [] };
}

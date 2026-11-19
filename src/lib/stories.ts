// (19/11) Stories do cardápio: vídeos curtos (ou fotos) que somem em 1 a 3 dias.
// O vídeo é convertido no aparelho e fica no Supabase (bucket "stories"), em {id da conta}/{arquivo}.mp4.
import { supabase } from "@/lib/supabase";

export const STORIES_BUCKET = "stories";
export const STORY_MAX_SEGUNDOS = 30;
export const STORY_MAX_ATIVOS = 3;
export const STORY_SEGUNDOS_FOTO = 6;

export type Story = {
  id: string; tipo: "video" | "foto"; video_id: string | null; foto_url: string | null;
  produto_id: string | null; duracao: number | null; created_at: string;
  pronto?: boolean; views?: number; expira_em?: string;
};

/** `video_id` guarda o caminho do arquivo no bucket */
export const urlVideoStory = (caminho: string) => supabase.storage.from(STORIES_BUCKET).getPublicUrl(caminho).data.publicUrl;
/** arquivos de um story de vídeo (o vídeo e a capa, que tem o mesmo nome em .jpg) */
export const arquivosDoStory = (caminho: string) => [caminho, caminho.replace(/\.[a-z0-9]+$/i, ".jpg")];

/** "há 3 h", "há 2 dias" */
export function haQuanto(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

/** "Sai do ar hoje às 14:00" / "amanhã às 14:00" / "em 2 dias" */
export function saiDoAr(iso: string): string {
  const fim = new Date(iso); const agora = new Date();
  const hora = fim.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((dia(fim) - dia(agora)) / 86400000);
  if (fim.getTime() <= agora.getTime()) return "Já saiu do ar";
  if (dias <= 0) return `Sai do ar hoje às ${hora}`;
  if (dias === 1) return `Sai do ar amanhã às ${hora}`;
  return `Sai do ar em ${dias} dias`;
}

// (19/11) Stories do cardápio: vídeos curtos (ou fotos) que somem em 1 a 3 dias. Vídeo fica no Bunny Stream.
export const STORIES_CDN = (import.meta.env.VITE_BUNNY_STREAM_CDN_HOST as string | undefined) || "vz-a30005ae-9d4.b-cdn.net";
export const STORY_MAX_SEGUNDOS = 120;
/** "45 segundos", "1 min 30 s", "2 minutos" */
export const tempoStory = (seg: number) => {
  const s = Math.round(seg);
  if (s < 60) return `${s} segundos`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m} min ${r} s` : m === 1 ? "1 minuto" : `${m} minutos`;
};
export const STORY_MAX_ATIVOS = 3;
export const STORY_SEGUNDOS_FOTO = 6;

export type Story = {
  id: string; tipo: "video" | "foto"; video_id: string | null; foto_url: string | null;
  produto_id: string | null; duracao: number | null; created_at: string;
  pronto?: boolean; views?: number; expira_em?: string;
};

export const urlVideoStory = (videoId: string) => `https://${STORIES_CDN}/${videoId}/playlist.m3u8`;
export const urlCapaStory = (videoId: string) => `https://${STORIES_CDN}/${videoId}/thumbnail.jpg`;

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

/** versão curta para caber embaixo da capa: "Sai hoje 14:00" / "Sai amanhã 11:19" / "Sai em 2 dias" */
export function saiCurto(iso: string): string {
  return saiDoAr(iso).replace("Sai do ar ", "Sai ").replace(" às ", " ").replace("Já saiu do ar", "Saiu do ar");
}

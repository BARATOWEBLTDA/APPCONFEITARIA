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

/**
 * (19/11) Adianta o primeiro story enquanto a cliente ainda está olhando o cardápio: abre a conexão com o servidor
 * de vídeo e baixa a lista do vídeo e o primeiro trecho dele (poucos segundos). Ao tocar na logo, o começo já está
 * no cache do navegador. Não baixa o vídeo inteiro, para não gastar a internet de quem não vai assistir, e não
 * baixa nada com "economia de dados" ligada ou em rede lenta.
 */
export async function aquecerStory(videoId: string): Promise<void> {
  try {
    const rede = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (rede?.saveData || /2g/.test(rede?.effectiveType || "")) return;
    const mestre = urlVideoStory(videoId);
    const linhas = (t: string) => t.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
    const t1 = await (await fetch(mestre)).text();
    const variante = linhas(t1)[0]; // a primeira qualidade da lista é a que o player pede primeiro
    if (!variante) return;
    const urlVariante = new URL(variante, mestre).href;
    const t2 = await (await fetch(urlVariante)).text();
    const trecho = linhas(t2)[0];
    if (trecho) await fetch(new URL(trecho, urlVariante).href).then(r => r.blob());
  } catch { /* é só um adianto: se falhar, o story carrega na hora do toque, como antes */ }
}

// (19/11) stories já assistidos neste aparelho: o aro da logo fica cinza quando a cliente já viu todos,
// e volta a ficar colorido quando a loja posta um novo.
const CHAVE_VISTOS = "doonly_stories_vistos";
const lerVistos = (): string[] => { try { const l = JSON.parse(localStorage.getItem(CHAVE_VISTOS) || "[]"); return Array.isArray(l) ? l.map(String) : []; } catch { return []; } };
export function marcarStoryVisto(id: string) {
  try { const l = lerVistos(); if (!l.includes(id)) localStorage.setItem(CHAVE_VISTOS, JSON.stringify([...l, id].slice(-80))); } catch { /* sem armazenamento: o aro só não muda */ }
}
export const todosStoriesVistos = (stories: { id: string }[]) => { const l = lerVistos(); return stories.length > 0 && stories.every(s => l.includes(s.id)); };

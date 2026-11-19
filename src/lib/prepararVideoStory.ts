// (19/11) Stories: o vídeo é convertido no próprio aparelho da confeiteira antes de subir (biblioteca mediabunny,
// que usa o conversor de vídeo do navegador). Sai um MP4 H.264 de até 1080p, leve e que toca em qualquer celular,
// então fica pronto na hora do envio, sem fila de conversão em servidor.
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } from "mediabunny";

const LADO_MENOR_MAX = 1080;

/** bitrate de vídeo conforme o tamanho final: 1080p ≈ 3,5 Mbps, 720p ≈ 2,2 Mbps */
const bitrateDe = (ladoMenor: number) => (ladoMenor >= 1000 ? 3_500_000 : ladoMenor >= 700 ? 2_200_000 : 1_400_000);

export async function prepararVideoStory(arq: File, aoProgresso: (pct: number) => void): Promise<Blob> {
  const input = new Input({ source: new BlobSource(arq), formats: ALL_FORMATS });
  const trilha = await input.getPrimaryVideoTrack();
  if (!trilha) throw new Error("sem_video");
  const w = trilha.displayWidth, h = trilha.displayHeight;
  const menor = Math.min(w, h);
  const final = Math.min(menor, LADO_MENOR_MAX);
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const conversao = await Conversion.init({
    input, output,
    video: {
      ...(menor > LADO_MENOR_MAX ? (w <= h ? { width: LADO_MENOR_MAX } : { height: LADO_MENOR_MAX }) : {}),
      codec: "avc", bitrate: bitrateDe(final), frameRate: 30, forceTranscode: true,
    },
    audio: { codec: "aac", bitrate: 128_000 },
  });
  if (!conversao.isValid || !conversao.utilizedTracks.some(t => t.type === "video")) throw new Error("nao_converte");
  conversao.onProgress = p => aoProgresso(Math.min(99, Math.round(p * 100)));
  await conversao.execute();
  const buf = output.target.buffer;
  if (!buf || buf.byteLength < 1000) throw new Error("vazio");
  return new Blob([buf], { type: "video/mp4" });
}

/** tira uma foto do começo do vídeo para servir de capa (JPEG leve); null se o aparelho não conseguir ler */
export const capaDoVideo = (video: Blob) => new Promise<Blob | null>(resolve => {
  const v = document.createElement("video");
  const url = URL.createObjectURL(video);
  let acabou = false;
  const fim = (b: Blob | null) => { if (acabou) return; acabou = true; window.clearTimeout(prazo); URL.revokeObjectURL(url); resolve(b); };
  const prazo = window.setTimeout(() => fim(null), 8000);
  v.muted = true; v.playsInline = true; v.preload = "auto";
  v.onloadeddata = () => { try { v.currentTime = Math.min(0.3, (v.duration || 1) / 2); } catch { fim(null); } };
  v.onseeked = () => {
    try {
      const k = Math.min(1, 480 / (v.videoWidth || 480));
      const c = document.createElement("canvas");
      c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
      if (!c.width || !c.height) return fim(null);
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      c.toBlob(b => fim(b), "image/jpeg", 0.8);
    } catch { fim(null); }
  };
  v.onerror = () => fim(null);
  v.src = url;
});

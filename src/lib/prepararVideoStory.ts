// (19/11) Stories: antes de subir, o vídeo é reduzido no próprio aparelho (biblioteca mediabunny, que usa o conversor
// de vídeo do navegador). Vídeo de câmera tem 60 a 100 MB por 30 segundos; reduzido fica com cerca de um terço, então
// o envio é bem mais rápido. Sai um MP4 H.264 de até 1080p, já com o índice no começo do arquivo (o que o Bunny pede
// para deixar o vídeo tocável na hora). A qualidade final quem faz é o Bunny, por isso aqui o bitrate é folgado.
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } from "mediabunny";

const LADO_MENOR_MAX = 1080;

/** bitrate de vídeo conforme o tamanho final: 1080p ≈ 6 Mbps, 720p ≈ 4 Mbps (acima do que o Bunny entrega) */
const bitrateDe = (ladoMenor: number) => (ladoMenor >= 1000 ? 6_000_000 : ladoMenor >= 700 ? 4_000_000 : 2_500_000);

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
    // o som não é mexido: a trilha original (AAC, em todo celular) é copiada como está
  });
  // se o aparelho não conseguir manter o som, não reduz: quem chamou sobe o vídeo original
  if (conversao.discardedTracks.some(d => d.track.type === "audio")) throw new Error("sem_som");
  if (!conversao.isValid || !conversao.utilizedTracks.some(t => t.type === "video")) throw new Error("nao_converte");
  conversao.onProgress = p => aoProgresso(Math.min(99, Math.round(p * 100)));
  await conversao.execute();
  const buf = output.target.buffer;
  if (!buf || buf.byteLength < 1000) throw new Error("vazio");
  return new Blob([buf], { type: "video/mp4" });
}

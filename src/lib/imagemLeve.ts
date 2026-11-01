/**
 * (31/10 · 5.92) Deixa a imagem leve antes de subir: redimensiona até a largura máxima e grava em WebP.
 * Um banner PNG de 2 MB vira uns 100 KB, e o cardápio e a galeria abrem muito mais rápido.
 */
export async function paraWebp(arquivo: Blob, larguraMax = 1500, qualidade = 0.86): Promise<Blob> {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, larguraMax / bmp.width);
  const w = Math.round(bmp.width * escala), h = Math.round(bmp.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sem canvas");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, "image/webp", qualidade));
  if (!blob || blob.type !== "image/webp") throw new Error("o navegador não gera WebP");
  return blob;
}

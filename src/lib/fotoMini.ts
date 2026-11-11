/**
 * (11/11) Miniatura das fotos de produto para a grade do cardápio.
 * A foto inteira (≈ 250 KB) continua para quando o cliente abre o produto; na grade vai a miniatura
 * em WebP de 640 px (≈ 40 KB). Isso corta uns 80% do que cada visita ao cardápio baixa.
 *
 * Como sabemos que a miniatura existe: o endereço da foto ganha "m=1" (…/produtos/x.jpg?t=…&m=1)
 * e a miniatura fica ao lado, com "-mini.webp" no lugar de ".jpg". Foto antiga, sem o "m=1", segue com a inteira.
 */
import { supabase } from "@/lib/supabase";
import { paraWebp } from "@/lib/imagemLeve";

const BUCKET = "products";

/** endereço da miniatura de uma foto (ou a própria foto, se ela ainda não tem miniatura) */
export function miniDaFoto(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!/[?&]m=1(&|$)/.test(url)) return url;
  return url.replace(/\.(jpe?g|png|webp)(\?|$)/i, "-mini.webp$2").replace(/([?&])m=1(&|$)/, "$1").replace(/[?&]$/, "");
}

/** caminho no armazenamento a partir do endereço público ("produtos/abc.jpg") */
function caminhoDe(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/public\/products\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** sobe a miniatura de uma foto que acabou de subir; devolve o endereço da foto já marcado com m=1 (ou o mesmo, se falhou) */
export async function subirMini(caminhoFoto: string, foto: Blob, urlFoto: string): Promise<string> {
  try {
    const mini = await paraWebp(foto, 640, 0.78);
    const caminhoMini = caminhoFoto.replace(/\.(jpe?g|png|webp)$/i, "-mini.webp");
    const { error } = await supabase.storage.from(BUCKET).upload(caminhoMini, mini, { upsert: true, contentType: "image/webp", cacheControl: "31536000" });
    if (error) return urlFoto;
    return `${urlFoto}${urlFoto.includes("?") ? "&" : "?"}m=1`;
  } catch { return urlFoto; /* sem miniatura: o cardápio usa a foto inteira */ }
}

/**
 * Fotos antigas (sem miniatura): gera a miniatura a partir da foto que já está no ar e devolve o novo endereço.
 * Só funciona para as fotos da própria confeiteira (é ela quem pode gravar na pasta). null = não deu / não precisa.
 */
export async function miniDeFotoAntiga(url: string): Promise<string | null> {
  if (/[?&]m=1(&|$)/.test(url)) return null;
  const caminho = caminhoDe(url);
  if (!caminho || !/^produtos\/.+\.(jpe?g|png|webp)$/i.test(caminho)) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const nova = await subirMini(caminho, await r.blob(), url);
    return nova !== url ? nova : null;
  } catch { return null; }
}

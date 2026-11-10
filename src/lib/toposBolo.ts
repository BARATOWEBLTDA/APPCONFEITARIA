import { supabase } from "@/lib/supabase";

/**
 * (09/11) Topos de bolo: o admin sobe topos (capa + arquivos PNG/JPG/PDF/Studio) em categorias com imagem;
 * a confeiteira vê tudo e só a PRO baixa (os arquivos ficam num bucket privado; o download é por link assinado).
 */
export type ArquivoTopo = { caminho: string; nome: string; formato: string; tamanho: number };
export type CategoriaTopo = { id: string; nome: string; imagem_url: string | null; ordem: number; ativo: boolean };
export type Topo = { id: string; categoria_id: string | null; titulo: string; capa_url: string | null; arquivos: ArquivoTopo[]; tags: string[]; ativo: boolean; ordem: number; created_at: string };

export const BUCKET_CAPAS = "topos-capas";
export const BUCKET_ARQUIVOS = "topos-arquivos";
/** o que o admin pode subir como arquivo do topo */
export const ACEITA_ARQUIVOS = ".png,.jpg,.jpeg,.jfif,.webp,.svg,.pdf,.studio,.studio3,.dxf,image/png,image/jpeg,image/webp,image/svg+xml,application/pdf";

/** "foto.PNG" → "PNG"; "corte.studio3" → "STUDIO" */
export function formatoDe(nome: string): string {
  const ext = (nome.split(".").pop() || "").toLowerCase();
  if (ext === "jpeg" || ext === "jpg" || ext === "jfif") return "JPG";
  if (ext.startsWith("studio")) return "STUDIO";
  return ext.toUpperCase() || "ARQUIVO";
}
export const ehImagem = (nome: string) => /\.(png|jpe?g|jfif|webp)$/i.test(nome);
/** imagens que dá pra escolher como capa (o .jfif é JPG com outro nome) */
export const ACEITA_IMAGEM = "image/png,image/jpeg,image/webp,.jfif,.jpg,.jpeg,.png,.webp";

export function tamanhoTexto(b: number): string {
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

/** nome seguro pro storage (sem acento, espaço nem símbolo) */
export const nomeSeguro = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-80);

export async function carregarCategorias(): Promise<CategoriaTopo[]> {
  const { data, error } = await supabase.from("topos_categorias").select("id, nome, imagem_url, ordem, ativo").order("ordem").order("nome");
  if (error) throw error;
  return (data || []) as CategoriaTopo[];
}
export async function carregarTopos(categoriaId?: string | null): Promise<Topo[]> {
  let q = supabase.from("topos").select("id, categoria_id, titulo, capa_url, arquivos, tags, ativo, ordem, created_at").order("ordem", { ascending: false }).order("created_at", { ascending: false });
  if (categoriaId) q = q.eq("categoria_id", categoriaId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data || []) as Topo[]).map(t => ({ ...t, arquivos: Array.isArray(t.arquivos) ? t.arquivos : [], tags: Array.isArray(t.tags) ? t.tags : [] }));
}

/** baixa um arquivo do topo (só funciona pra PRO e admin: o bucket é privado). Devolve false se não deu. */
export async function baixarArquivo(a: ArquivoTopo): Promise<boolean> {
  const { data, error } = await supabase.storage.from(BUCKET_ARQUIVOS).createSignedUrl(a.caminho, 120, { download: a.nome });
  if (error || !data?.signedUrl) return false;
  const link = document.createElement("a");
  link.href = data.signedUrl; link.rel = "noopener"; link.download = a.nome;
  document.body.appendChild(link); link.click(); link.remove();
  return true;
}

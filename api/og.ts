// (16/10) Prévia do link do cardápio (WhatsApp, Instagram, Facebook...). Esses robôs não rodam o app, só leem
// as etiquetas da página: sem isto a prévia mostrava "Doonly - Confeitaria Inteligente" pra todas as lojas.
// O vercel.json manda pra cá só os robôs de prévia (pelo user-agent) que abrem /c/:codigo/...; as pessoas
// continuam abrindo o cardápio normal. Título: nome da loja. Imagem: a logo (ou a foto) da loja, ou o bolinho padrão.
export const config = { runtime: "edge" };

const env = (): Record<string, string | undefined> => (globalThis as any).process?.env ?? {};
const BASE = "https://doonly.com.br";
const DESCRICAO = "Veja o cardápio e faça sua encomenda online.";
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function lerLoja(codigo: string): Promise<{ nome: string; imagem: string } | null> {
  const e = env();
  const url = e.SUPABASE_URL || e.VITE_SUPABASE_URL;
  const anon = e.SUPABASE_ANON_KEY || e.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon || !/^[a-z0-9]{2,12}$/i.test(codigo)) return null;
  const h = { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" };
  try {
    // a mesma função que o cardápio usa (só os dados públicos da loja)
    const r = await fetch(`${url}/rest/v1/rpc/cardapio_loja`, { method: "POST", headers: h, body: JSON.stringify({ p_chave: codigo }) });
    let p: any = r.ok ? await r.json() : null;
    if (Array.isArray(p)) p = p[0];
    if (!p) {
      const r2 = await fetch(`${url}/rest/v1/profiles?select=nome_loja,logo_url,foto_url&codigo_publico=eq.${encodeURIComponent(codigo)}&limit=1`, { headers: h });
      const l = r2.ok ? await r2.json() : [];
      p = Array.isArray(l) ? l[0] : null;
    }
    if (!p) return null;
    const img = String(p.logo_url || p.foto_url || "").split(",")[0].trim();
    return { nome: String(p.nome_loja || "Cardápio"), imagem: /^https:\/\//.test(img) ? img : "" };
  } catch { return null; }
}

export default async function handler(req: Request) {
  const u = new URL(req.url);
  const codigo = (u.searchParams.get("c") || "").trim();
  const caminho = (u.searchParams.get("p") || "cardapio").replace(/[^a-z0-9-]/gi, "");
  const loja = await lerLoja(codigo);
  const nome = loja?.nome || "Cardápio";
  const imagem = loja?.imagem || `${BASE}/og-bolo.png`;
  const link = `${BASE}/c/${encodeURIComponent(codigo)}/${caminho}`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(nome)}</title>
<meta name="description" content="${esc(DESCRICAO)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(nome)}">
<meta property="og:title" content="${esc(nome)}">
<meta property="og:description" content="${esc(DESCRICAO)}">
<meta property="og:image" content="${esc(imagem)}">
<meta property="og:url" content="${esc(link)}">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(nome)}">
<meta name="twitter:description" content="${esc(DESCRICAO)}">
<meta name="twitter:image" content="${esc(imagem)}">
<link rel="canonical" href="${esc(link)}">
</head><body><a href="${esc(link)}">${esc(nome)}</a></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600, s-maxage=600" } });
}

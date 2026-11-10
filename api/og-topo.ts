// (09/11) Prévia do link do topo compartilhado (/topo/:id) no WhatsApp, Instagram, Facebook…
// Os robôs de prévia não rodam o app: o vercel.json manda só eles pra cá. Título, frase e a capa do topo.
export const config = { runtime: "edge" };

const env = (): Record<string, string | undefined> => (globalThis as any).process?.env ?? {};
const BASE = "https://doonly.com.br";
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default async function handler(req: Request) {
  const id = (new URL(req.url).searchParams.get("t") || "").trim();
  let titulo = "Topo de bolo", imagem = `${BASE}/og-bolo.png`;
  const e = env();
  const url = e.SUPABASE_URL || e.VITE_SUPABASE_URL;
  const anon = e.SUPABASE_ANON_KEY || e.VITE_SUPABASE_ANON_KEY;
  if (url && anon && /^[0-9a-f-]{36}$/i.test(id)) {
    try {
      const r = await fetch(`${url}/rest/v1/rpc/topo_publico`, { method: "POST", headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_id: id }) });
      let t: any = r.ok ? await r.json() : null;
      if (Array.isArray(t)) t = t[0];
      if (t) { titulo = String(t.titulo || titulo); const img = String(t.capa_url || ""); if (/^https:\/\//.test(img)) imagem = img; }
    } catch { /* fica a prévia padrão */ }
  }
  const nome = `${titulo} · Topo de bolo`;
  const desc = "Topo de bolo pronto pra imprimir no Doonly. Teste grátis por 7 dias.";
  const link = `${BASE}/topo/${encodeURIComponent(id)}`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(nome)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Doonly">
<meta property="og:title" content="${esc(nome)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(imagem)}">
<meta property="og:url" content="${esc(link)}">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(nome)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(imagem)}">
<link rel="canonical" href="${esc(link)}">
</head><body><a href="${esc(link)}">${esc(nome)}</a></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600, s-maxage=600" } });
}

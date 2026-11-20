// (19/11) Imagem da prévia do link do cardápio (WhatsApp, Instagram, Facebook), em tamanho pequeno.
// O WhatsApp não mostra imagem de prévia acima de uns 300 KB, e a logo das lojas costuma passar disso
// (logo criada pela Doo: PNG de 1 MB). Aqui a logo vira um JPEG de 600 x 600, com fundo branco, bem leve.
// Qualquer falha manda para a imagem original (a prévia continua como era, nunca pior).
export const config = { runtime: "nodejs", maxDuration: 15 };

const BOLO = "https://doonly.com.br/og-bolo.png";

async function imagemDaLoja(codigo: string): Promise<string> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon || !/^[a-z0-9]{2,12}$/i.test(codigo)) return "";
  const h = { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" };
  const r = await fetch(`${url}/rest/v1/rpc/cardapio_loja`, { method: "POST", headers: h, body: JSON.stringify({ p_chave: codigo }) });
  let p = r.ok ? await r.json() : null;
  if (Array.isArray(p)) p = p[0];
  if (!p) {
    const r2 = await fetch(`${url}/rest/v1/profiles?select=logo_url,foto_url&codigo_publico=eq.${encodeURIComponent(codigo)}&limit=1`, { headers: h });
    const l = r2.ok ? await r2.json() : [];
    p = Array.isArray(l) ? l[0] : null;
  }
  const img = String(p?.logo_url || p?.foto_url || "").split(",")[0].trim();
  // só imagens guardadas no próprio Supabase do Doonly (não busca endereço de fora)
  return img.startsWith(`${url}/storage/v1/object/public/`) ? img : "";
}

// deno-lint-ignore no-explicit-any
export default async function handler(req: any, res: any) {
  const codigo = String(req.query?.c || "").trim();
  let original = "";
  try {
    original = await imagemDaLoja(codigo);
    if (!original) { res.redirect(302, BOLO); return; }
    const r = await fetch(original);
    if (!r.ok) throw new Error("sem imagem");
    const entrada = Buffer.from(await r.arrayBuffer());
    if (entrada.length > 12 * 1024 * 1024) throw new Error("grande demais");
    const sharp = (await import("sharp")).default;
    const saida = await sharp(entrada).rotate()
      .resize(600, 600, { fit: "contain", background: "#FFFFFF" })
      .flatten({ background: "#FFFFFF" })
      .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
    res.status(200).send(saida);
  } catch {
    res.redirect(302, original || BOLO);
  }
}

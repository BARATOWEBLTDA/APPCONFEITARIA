// (17/11) Cartão 1200×630 da prévia do cardápio (WhatsApp, Instagram, Facebook): logo + nome da loja
// num fundo rosa do Doonly, estilo marketplace. Só os robôs de prévia chegam aqui (via og.ts / vercel.json).
// Se qualquer coisa falhar (loja sem logo, imagem que não baixa), cai na imagem padrão — nunca quebra o app.
import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

const env = (): Record<string, string | undefined> => (globalThis as any).process?.env ?? {};
const BASE = "https://doonly.com.br";

// elemento no formato que o Satori entende, sem precisar de JSX
function h(type: string, props: any, ...filhos: any[]): any {
  return { type, props: { ...(props || {}), children: filhos.length === 0 ? undefined : filhos.length === 1 ? filhos[0] : filhos } };
}

async function lerLoja(codigo: string): Promise<{ nome: string; logo: string } | null> {
  const e = env();
  const url = e.SUPABASE_URL || e.VITE_SUPABASE_URL;
  const anon = e.SUPABASE_ANON_KEY || e.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon || !/^[a-z0-9]{2,12}$/i.test(codigo)) return null;
  const hd = { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" };
  try {
    const r = await fetch(`${url}/rest/v1/rpc/cardapio_loja`, { method: "POST", headers: hd, body: JSON.stringify({ p_chave: codigo }) });
    let p: any = r.ok ? await r.json() : null;
    if (Array.isArray(p)) p = p[0];
    if (!p) return null;
    return { nome: String(p.nome_loja || "Cardápio"), logo: String(p.logo_url || p.foto_url || "").split(",")[0].trim() };
  } catch { return null; }
}

// baixa a logo e devolve como data URI (só jpg/png); null se falhar
async function logoDataUri(logo: string): Promise<string | null> {
  if (!/^https:\/\//.test(logo)) return null;
  try {
    const r = await fetch(logo);
    if (!r.ok) return null;
    const ct = (r.headers.get("content-type") || "image/jpeg").toLowerCase();
    if (!/image\/(jpe?g|png)/.test(ct)) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > 3_000_000) return null; // logo gigante: deixa de fora, mostra só o nome
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return `data:${ct};base64,${btoa(bin)}`;
  } catch { return null; }
}

export default async function handler(req: Request) {
  const codigo = (new URL(req.url).searchParams.get("c") || "").trim();
  const loja = await lerLoja(codigo);
  const nome = loja?.nome || "Cardápio";
  const logoUri = loja?.logo ? await logoDataUri(loja.logo) : null;

  try {
    const cartao = h("div", { style: { width: "1200px", height: "630px", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "84px", backgroundColor: "#C62C63", backgroundImage: "linear-gradient(135deg, #E0457A 0%, #B9245A 100%)", fontFamily: "sans-serif" } },
      h("div", { style: { display: "flex", flexDirection: "column" } },
        logoUri
          ? h("div", { style: { display: "flex", width: "190px", height: "190px", borderRadius: "40px", background: "#fff", alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: "40px", boxShadow: "0 12px 40px rgba(0,0,0,.18)" } },
              h("img", { src: logoUri, width: 190, height: 190, style: { width: "190px", height: "190px", objectFit: "cover" } }))
          : h("div", { style: { display: "flex", width: "190px", height: "190px", borderRadius: "40px", background: "rgba(255,255,255,.16)", alignItems: "center", justifyContent: "center", marginBottom: "40px", fontSize: "96px", color: "#fff" } }, nome.slice(0, 1).toUpperCase()),
        h("div", { style: { display: "flex", fontSize: "68px", fontWeight: 700, color: "#ffffff", lineHeight: 1.06, maxWidth: "1020px" } }, nome),
        h("div", { style: { display: "flex", fontSize: "35px", color: "rgba(255,255,255,.92)", marginTop: "22px" } }, "Cardápio online · faça sua encomenda")
      ),
      h("div", { style: { display: "flex", alignItems: "center", fontSize: "29px", color: "rgba(255,255,255,.82)" } }, "doonly.com.br")
    );
    return new ImageResponse(cartao as any, {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=600, s-maxage=86400" },
    });
  } catch {
    return Response.redirect(`${BASE}/og-bolo.png`, 302);
  }
}

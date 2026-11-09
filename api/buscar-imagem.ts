import { usuarioDoToken, respostaNaoAutorizado, respostaJson, usarCota, respostaLimite } from "./_auth";

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Só quem está logado no Doonly pode usar (cada busca gasta crédito da SerpAPI)
  const usuario = await usuarioDoToken(req);
  if (!usuario) return respostaNaoAutorizado();

  // (4.23) limite de buscas por dia
  const cota = await usarCota(req, "buscar_imagem");
  if (!cota.ok) return respostaLimite(cota.limite);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q) return new Response("Missing query", { status: 400 });
  // (11/10) busca de imagem é um nome de produto: texto gigante não passa
  if (q.length > 200) return respostaJson({ error: "too_large", message: "O texto da busca ficou grande demais.", images: [] }, 413);

  const apiKey = (globalThis as any).process?.env?.SERP_API_KEY ?? "";

  // (08/11) pede mais fotos e escolhe as melhores: a primeira da lista é a que a Doo e o cadastro usam sozinhos
  const url = `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(q)}&api_key=${apiKey}&num=12&hl=pt&gl=br`;

  const res = await fetch(url);
  const data = await res.json();

  const semAcento = (t: string) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  // bancos de imagem com marca d'água e redes sociais (a foto some ou vem com marca)
  const RUIM = /(shutterstock|istockphoto|alamy|dreamstime|depositphotos|123rf|gettyimages|stock\.adobe|vecteezy|freepik|pinterest|facebook|instagram|tiktok|fbcdn|lookaside)/i;
  const palavras = semAcento(q).split(/[^a-z0-9]+/).filter(p => p.length > 2);

  type Achada = { original?: string; original_width?: number; original_height?: number; title?: string; source?: string; link?: string };
  const lista: { url: string; nota: number }[] = [];
  for (const img of ((data.images_results || []) as Achada[])) {
    const u = img.original;
    if (!u || !/^https:\/\//i.test(u) || /\.(gif|svg)(\?|$)/i.test(u)) continue;     // só https (o app é https) e foto de verdade
    if (RUIM.test(u) || RUIM.test(String(img.source || "")) || RUIM.test(String(img.link || ""))) continue;
    let nota = 0;
    const w = Number(img.original_width) || 0, h = Number(img.original_height) || 0;
    if (w && h) {
      if (Math.min(w, h) < 300) nota -= 3;                 // pequena demais: fica borrada no cartão
      const r = w / h;
      if (r >= 0.75 && r <= 1.4) nota += 2;                // quase quadrada: cabe bem na caixinha do ingrediente
      else if (r > 2 || r < 0.5) nota -= 3;                // banner ou tira: some o produto
    }
    const titulo = semAcento(img.title || "");
    nota += Math.min(3, palavras.filter(p => titulo.includes(p)).length);   // o título fala do que ela pediu
    lista.push({ url: u, nota });
  }
  // estável: em empate, vale a ordem do Google
  const images = lista.map((x, i) => ({ ...x, i })).sort((a, b) => b.nota - a.nota || a.i - b.i).slice(0, 6).map(x => x.url);

  return new Response(JSON.stringify({ images }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    }
  });
}

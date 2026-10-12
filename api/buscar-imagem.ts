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

  const url = `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(q)}&api_key=${apiKey}&num=6&hl=pt&gl=br`;

  const res = await fetch(url);
  const data = await res.json();

  const images = data.images_results
    ? data.images_results.slice(0, 6).map((img: any) => img.original)
    : [];

  return new Response(JSON.stringify({ images }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    }
  });
}

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q) return new Response("Missing query", { status: 400 });

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

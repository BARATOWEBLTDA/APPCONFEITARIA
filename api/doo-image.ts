import { usuarioDoToken, respostaNaoAutorizado, planoDoUsuario, usarCota, respostaLimite, respostaJson, lerCorpo, chaveOpenAI } from "./_auth";

const LIMITE_CORPO = 32 * 1024;
const MAX_PROMPT = 4000; // (11/10) o limite do próprio gerador de imagem

export const config = { runtime: "edge" };

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // Só quem está logado no Doonly pode usar (cada chamada gasta crédito da API)
  const usuario = await usuarioDoToken(req);
  if (!usuario) return respostaNaoAutorizado(CORS);

  // (11/10) a Doo é do plano PRO: antes bastava estar logada pra gastar crédito da IA
  const plano = await planoDoUsuario(req, usuario);
  if (plano === "erro") return respostaJson({ error: "api_error" }, 503, CORS);
  if (plano !== "pro") return respostaJson({ error: "pro_required" }, 403, CORS);
  // (4.23) limite de uso por dia
  const cota = await usarCota(req, "imagem");
  if (!cota.ok) return respostaLimite(cota.limite, CORS);

  const apiKey = chaveOpenAI();
  if (!apiKey) return new Response(JSON.stringify({ error: "missing_key" }), { status: 500, headers: CORS });

  const cru = await lerCorpo(req, LIMITE_CORPO);
  let prompt: unknown;
  try { prompt = cru === null ? null : JSON.parse(cru)?.prompt; } catch { return respostaJson({ error: "invalid_request_error" }, 400, CORS); }
  if (cru !== null && (typeof prompt !== "string" || !prompt.trim())) return respostaJson({ error: "invalid_request_error" }, 400, CORS);
  if (cru === null || (prompt as string).length > MAX_PROMPT) {
    return respostaJson({ error: "too_large", message: "O pedido da imagem ficou grande demais." }, 413, CORS);
  }

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return new Response(JSON.stringify({ error: data?.error?.type ?? "api_error", status: res.status }), {
      status: res.status,
      headers: CORS,
    });
  }

  return new Response(JSON.stringify(data), { headers: CORS });
}

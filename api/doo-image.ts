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
  let prompt: unknown, tipo: unknown;
  try { const j = cru === null ? null : JSON.parse(cru); prompt = j?.prompt; tipo = j?.tipo; } catch { return respostaJson({ error: "invalid_request_error" }, 400, CORS); }
  if (cru !== null && (typeof prompt !== "string" || !prompt.trim())) return respostaJson({ error: "invalid_request_error" }, 400, CORS);
  if (cru === null || (prompt as string).length > MAX_PROMPT) {
    return respostaJson({ error: "too_large", message: "O pedido da imagem ficou grande demais." }, 413, CORS);
  }
  const topo = tipo === "topo";

  // (6.85) gpt-image-1 escreve o nome certinho e faz o fundo transparente (bom pra imprimir o topo de bolo).
  // Se a conta da OpenAI não tiver acesso a ele, cai no dall-e-3 como antes.
  const gerar = async (): Promise<{ status: number; corpo: unknown }> => {
    const r1 = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-image-1", prompt, n: 1, size: "1024x1024", quality: "medium", ...(topo ? { background: "transparent", output_format: "png" } : { output_format: "jpeg" }) }),
    });
    const d1 = await r1.json().catch(() => null);
    const b64 = d1?.data?.[0]?.b64_json;
    if (r1.ok && b64) return { status: 200, corpo: { data: [{ b64, formato: topo ? "png" : "jpeg" }], modelo: "gpt-image-1" } };
    const r2 = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "dall-e-3", prompt, n: 1, size: "1024x1024", quality: "standard" }),
    });
    const d2 = await r2.json().catch(() => null);
    if (!r2.ok) return { status: r2.status, corpo: { error: d2?.error?.type ?? "api_error", status: r2.status } };
    return { status: 200, corpo: { ...d2, modelo: "dall-e-3" } };
  };

  // A imagem pode levar mais de 25 s: a resposta começa na hora e manda espaços até a imagem ficar pronta
  // (o JSON com espaços na frente continua válido)
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctl) {
      const pulso = setInterval(() => { try { ctl.enqueue(enc.encode(" ")); } catch { /* fechou */ } }, 5000);
      try {
        const r = await gerar();
        ctl.enqueue(enc.encode(JSON.stringify(r.status === 200 ? r.corpo : r.corpo)));
      } catch {
        ctl.enqueue(enc.encode(JSON.stringify({ error: "api_error", status: 502 })));
      } finally {
        clearInterval(pulso);
        ctl.close();
      }
    },
  });
  return new Response(stream, { headers: CORS });
}

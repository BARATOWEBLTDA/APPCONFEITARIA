import { usuarioDoToken, respostaNaoAutorizado, respostaJson, lerCorpo, chaveAnthropic, usarCota, respostaLimite } from "./_auth";

const LIMITE_CORPO = 64 * 1024;
const MAX_PROMPT = 8000; // (11/10) um pedido de descrição nunca chega perto disso

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Só quem está logado no Doonly pode usar (cada chamada gasta crédito da API)
  const usuario = await usuarioDoToken(req);
  if (!usuario) return respostaNaoAutorizado();

  // (17/10 · R05) limite alto por dia (100, grátis e PRO): ninguém usa isso tudo escrevendo descrição,
  // mas impede alguém de chamar sem parar e gastar a conta da IA
  const cota = await usarCota(req, "descricao");
  if (!cota.ok) return respostaLimite(cota.limite);

  const cru = await lerCorpo(req, LIMITE_CORPO);
  let prompt: unknown;
  try { prompt = cru === null ? null : JSON.parse(cru)?.prompt; } catch { return respostaJson({ error: "invalid_request_error" }, 400); }
  if (cru !== null && (typeof prompt !== "string" || !prompt.trim())) return respostaJson({ error: "invalid_request_error" }, 400);
  if (cru === null || (prompt as string).length > MAX_PROMPT) {
    return respostaJson({ error: "too_large", message: "O texto ficou grande demais." }, 413);
  }

  const apiKey = chaveAnthropic();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400, // (13/10) uma descrição usa bem menos; evita gasto se a IA se empolgar
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await response.json();

  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    }
  });
}

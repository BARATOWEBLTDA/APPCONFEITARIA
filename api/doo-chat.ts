import { usuarioDoToken, respostaNaoAutorizado, planoDoUsuario, respostaJson, lerCorpo, chaveAnthropic } from "./_auth";

// (11/10) limites do pedido: a foto já sai reduzida do app (bem menos de 1 MB)
const LIMITE_CORPO = 4 * 1024 * 1024;
const MAX_MENSAGENS = 30;
const MAX_SISTEMA = 400_000; // as instruções da Doo levam o cardápio e as clientes junto

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

  const apiKey = chaveAnthropic();
  if (!apiKey) return new Response(JSON.stringify({ error: "missing_key" }), { status: 500, headers: CORS });

  const cru = await lerCorpo(req, LIMITE_CORPO);
  if (cru === null) return respostaJson({ error: "too_large", message: "O pedido ficou grande demais." }, 413, CORS);
  let corpo: any;
  try { corpo = JSON.parse(cru); } catch { return respostaJson({ error: "invalid_request_error" }, 400, CORS); }
  const { messages, system } = corpo || {};
  if (!Array.isArray(messages) || messages.length === 0) return respostaJson({ error: "invalid_request_error" }, 400, CORS);
  if (messages.length > MAX_MENSAGENS || (typeof system === "string" && system.length > MAX_SISTEMA)) {
    return respostaJson({ error: "too_large", message: "A conversa ficou grande demais." }, 413, CORS);
  }

  // (11/10) Resposta mais longa (4000) demora mais que os 25 s que a Vercel dá pra função começar a responder.
  // Então a resposta começa na hora, com espaços em branco de tempos em tempos, e o JSON vai no fim
  // (espaço antes do JSON não atrapalha quem lê). Por isso o código é sempre 200 daqui pra frente:
  // erro da IA vai dentro do JSON, como { error, status }, e a tela confere.
  const enc = new TextEncoder();
  // (11/10) se quem pediu fecha a conexão, para o relógio e cancela a chamada da IA
  let relogio: ReturnType<typeof setInterval> | undefined;
  const controle = new AbortController();
  const fluxo = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const espaco = () => { try { ctrl.enqueue(enc.encode(" ")); } catch { /* quem pediu já foi embora */ } };
      espaco();
      relogio = setInterval(espaco, 5000);
      let saida: unknown;
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 4000,
            system,
            messages,
          }),
          signal: controle.signal,
        });
        const data = await res.json();
        // quando dá certo, o JSON da IA vai inteiro (já traz o stop_reason: "max_tokens" = resposta cortada)
        saida = res.ok ? data : { error: data?.error?.type ?? "api_error", status: res.status };
      } catch {
        saida = { error: "api_error", status: 502 };
      }
      clearInterval(relogio);
      if (controle.signal.aborted) return;
      try { ctrl.enqueue(enc.encode(JSON.stringify(saida))); ctrl.close(); } catch { /* quem pediu já foi embora */ }
    },
    cancel() {
      clearInterval(relogio);
      controle.abort();
    },
  });

  return new Response(fluxo, { headers: { ...CORS, "Cache-Control": "no-store" } });
}

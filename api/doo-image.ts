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
  const topo = tipo === "topo"; // (6.89) topo: folha em pé, como as de imprimir

  // (6.85) gpt-image-1 escreve o nome certinho e faz o fundo transparente (bom pra imprimir o topo de bolo).
  // Se a conta da OpenAI não tiver acesso a ele, cai no dall-e-3 como antes.
  // (6.96) tenta em cascata: gpt-image-1 completo → gpt-image-1 simples (se a OpenAI recusar algum parâmetro) → dall-e-3.
  // O erro de cada tentativa (código, parâmetro e mensagem) volta para a tela e para o log, para achar o motivo de verdade.
  type ErroOpenAI = { code?: string; type?: string; param?: string; message?: string };
  const pedir = async (corpo: Record<string, unknown>) => {
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(corpo),
    });
    const d = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, d, erro: (d?.error || null) as ErroOpenAI | null };
  };
  const gerar = async (): Promise<{ status: number; corpo: unknown }> => {
    const erros: ErroOpenAI[] = [];
    const t1 = await pedir({ model: "gpt-image-1", prompt, n: 1, size: topo ? "1024x1536" : "1024x1024", quality: "medium", ...(topo ? { background: "transparent", output_format: "png" } : { output_format: "jpeg" }) });
    if (t1.ok && t1.d?.data?.[0]?.b64_json) return { status: 200, corpo: { data: [{ b64: t1.d.data[0].b64_json, formato: topo ? "png" : "jpeg" }], modelo: "gpt-image-1" } };
    if (t1.erro) erros.push(t1.erro);
    if (t1.status === 400) {
      const t2 = await pedir({ model: "gpt-image-1", prompt, n: 1, size: "1024x1024" });
      if (t2.ok && t2.d?.data?.[0]?.b64_json) return { status: 200, corpo: { data: [{ b64: t2.d.data[0].b64_json, formato: "png" }], modelo: "gpt-image-1" } };
      if (t2.erro) erros.push(t2.erro);
    }
    const t3 = await pedir({ model: "dall-e-3", prompt: (prompt as string).slice(0, 3900), n: 1, size: "1024x1024", quality: "standard" });
    if (t3.ok && t3.d?.data?.[0]) return { status: 200, corpo: { ...t3.d, modelo: "dall-e-3" } };
    if (t3.erro) erros.push(t3.erro);
    console.error("[doo-image]", JSON.stringify(erros));
    const codigos = erros.flatMap(e => [e.code, e.type]).filter(Boolean).map(String);
    const motivo = codigos.find(c => /billing|quota/i.test(c)) || codigos.find(c => /content_policy|moderation|safety/i.test(c)) || codigos[0] || "api_error";
    const detalhe = erros.map(e => [e.param, (e.message || "").slice(0, 90)].filter(Boolean).join(": ")).filter(Boolean).join(" | ").slice(0, 300);
    return { status: t3.status || 500, corpo: { error: erros[erros.length - 1]?.type ?? "api_error", codigo: motivo, detalhe, status: t3.status || 500 } };
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

import { usuarioDoToken, respostaNaoAutorizado, planoDoUsuario, usarCota, respostaLimite, respostaJson, lerCorpo, chaveOpenAI } from "./_auth";

const LIMITE_CORPO = 3.5 * 1024 * 1024; // (6.100) cabe a foto de referência (já reduzida no aparelho)
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
  let prompt: unknown, tipo: unknown, referencia: unknown;
  try { const j = cru === null ? null : JSON.parse(cru); prompt = j?.prompt; tipo = j?.tipo; referencia = j?.referencia; } catch { return respostaJson({ error: "invalid_request_error" }, 400, CORS); }
  if (cru !== null && (typeof prompt !== "string" || !prompt.trim())) return respostaJson({ error: "invalid_request_error" }, 400, CORS);
  if (cru === null || (prompt as string).length > MAX_PROMPT) {
    return respostaJson({ error: "too_large", message: "O pedido da imagem ficou grande demais." }, 413, CORS);
  }
  const topo = tipo === "topo"; // (6.89) topo: folha em pé, como as de imprimir
  // (6.101) logo: quadrada, PNG com fundo · banner: deitado (o app corta em 16:9) · arte: quadrada
  const tamanho = topo ? "1024x1536" : tipo === "banner" ? "1536x1024" : "1024x1024";
  const formato = topo || tipo === "logo" ? "png" : "jpeg";

  // (6.85) gpt-image-1 escreve o nome certinho e faz o fundo transparente (bom pra imprimir o topo de bolo).
  // Se a conta da OpenAI não tiver acesso a ele, cai no dall-e-3 como antes.
  // (6.96) tenta em cascata: gpt-image-1 completo → gpt-image-1 simples (se a OpenAI recusar algum parâmetro) → dall-e-3.
  // O erro de cada tentativa (código, parâmetro e mensagem) volta para a tela e para o log, para achar o motivo de verdade.
  type ErroOpenAI = { code?: string; type?: string; param?: string; message?: string };
  // (6.100) com foto de referência ("faz uma parecida com essa"): vai pela rota de edição, com a foto junto
  const ref = typeof referencia === "string" && referencia.length > 100 ? referencia.replace(/^data:[^,]+,/, "") : "";
  const blobRef = () => { const bin = atob(ref); const b = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) b[k] = bin.charCodeAt(k); return new Blob([b], { type: "image/jpeg" }); };
  const pedir = async (corpo: Record<string, unknown>) => {
    let r: Response;
    if (ref) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(corpo)) fd.append(k, String(v));
      fd.append("image", blobRef(), "referencia.jpg");
      r = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { "Authorization": `Bearer ${apiKey}` }, body: fd });
    } else {
      r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify(corpo),
      });
    }
    const d = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, d, erro: (d?.error || null) as ErroOpenAI | null };
  };
  // (6.98) a OpenAI aposentou o dall-e-3 (maio/2026) e troca os nomes dos modelos de imagem com frequência.
  // O app tenta a lista abaixo, do mais novo para o mais antigo, e pula os que a conta não tem.
  // Para fixar um modelo sem mexer no código: variável OPENAI_IMAGE_MODEL no Vercel.
  const fixo = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.OPENAI_IMAGE_MODEL;
  const MODELOS = [...(fixo ? [fixo] : []), "gpt-image-2.5-flare", "gpt-image-2", "gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini"];
  const naoExiste = (e: ErroOpenAI | null) => !!e && (/model_not_found|not_found/i.test(String(e.code || "")) || /does not exist|not found|do not have access|deprecated|retired/i.test(String(e.message || "")));
  const imagemDe = (d: { data?: { b64_json?: string; url?: string }[] } | null) => d?.data?.[0]?.b64_json ? { b64: d.data[0].b64_json } : d?.data?.[0]?.url ? { url: d.data[0].url } : null;
  const gerar = async (): Promise<{ status: number; corpo: unknown }> => {
    const erros: (ErroOpenAI & { modelo?: string })[] = [];
    let ultimoStatus = 500;
    for (const model of [...new Set(MODELOS)]) {
      const t1 = await pedir({ model, prompt, n: 1, size: tamanho, quality: "medium", ...(topo ? { background: "transparent" } : {}), output_format: formato });
      const i1 = t1.ok ? imagemDe(t1.d) : null;
      if (i1) return { status: 200, corpo: { data: [{ ...i1, formato }], modelo: model } };
      ultimoStatus = t1.status;
      if (t1.erro) erros.push({ ...t1.erro, modelo: model });
      if (naoExiste(t1.erro)) continue; // a conta não tem esse modelo: tenta o próximo
      // recusou algum parâmetro: o mesmo modelo só com o básico
      const t2 = await pedir({ model, prompt, n: 1 });
      const i2 = t2.ok ? imagemDe(t2.d) : null;
      if (i2) return { status: 200, corpo: { data: [{ ...i2, formato: "png" }], modelo: model } };
      ultimoStatus = t2.status;
      if (t2.erro) erros.push({ ...t2.erro, modelo: model });
      if (!naoExiste(t2.erro)) break; // erro de verdade (crédito, bloqueio de conteúdo…): não adianta trocar de modelo
    }
    console.error("[doo-image]", JSON.stringify(erros));
    const codigos = erros.flatMap(e => [e.code, e.type]).filter(Boolean).map(String);
    const motivo = codigos.find(c => /billing|quota/i.test(c)) || codigos.find(c => /content_policy|moderation|safety/i.test(c)) || codigos[codigos.length - 1] || "api_error";
    const detalhe = erros.slice(-3).map(e => [e.modelo, e.param, (e.message || "").slice(0, 80)].filter(Boolean).join(": ")).join(" | ").slice(0, 300);
    return { status: ultimoStatus || 500, corpo: { error: erros[erros.length - 1]?.type ?? "api_error", codigo: motivo, detalhe, status: ultimoStatus || 500 } };
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

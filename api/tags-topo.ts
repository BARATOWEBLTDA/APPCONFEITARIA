import { usuarioDoToken, respostaNaoAutorizado, respostaJson, lerCorpo, chaveAnthropic } from "./_auth";

/**
 * (10/11) Admin · Topos de bolo: gera as tags de busca de um topo a partir do nome e da capa.
 * Antes o Bruno gerava no ChatGPT e colava. Só a conta do admin chama (cada chamada gasta crédito da IA).
 * Custo: Haiku com uma imagem pequena (512 px) ≈ US$ 0,002 por topo.
 */
export const config = { runtime: "edge" };

const ADMINS = ["gestao@doonly.com.br"];
const LIMITE_CORPO = 600 * 1024; // a capa vem reduzida (512 px, WebP/JPEG)

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const usuario = await usuarioDoToken(req);
  if (!usuario || !ADMINS.includes((usuario.email || "").toLowerCase())) return respostaNaoAutorizado();

  const cru = await lerCorpo(req, LIMITE_CORPO);
  if (cru === null) return respostaJson({ error: "too_large" }, 413);
  let corpo: { nome?: unknown; categoria?: unknown; imagem?: unknown; tipo?: unknown };
  try { corpo = JSON.parse(cru); } catch { return respostaJson({ error: "invalid_request_error" }, 400); }
  const nome = String(corpo.nome || "").trim().slice(0, 120);
  const categoria = String(corpo.categoria || "").trim().slice(0, 60);
  const imagem = typeof corpo.imagem === "string" ? corpo.imagem : "";
  const tipo = corpo.tipo === "image/jpeg" ? "image/jpeg" : corpo.tipo === "image/png" ? "image/png" : "image/webp";
  if (!nome && !imagem) return respostaJson({ error: "invalid_request_error" }, 400);

  const pedido =
    `Você cria tags de busca para um topo de bolo (arte para imprimir) num app de confeitaria brasileiro.\n` +
    `Nome do topo: "${nome || "sem nome"}"${categoria ? `\nCategoria: ${categoria}` : ""}\n\n` +
    `Gere de 12 a 20 tags que uma confeiteira digitaria para achar este topo: tema, personagens e franquia, ` +
    `ocasião (aniversário, chá revelação, batizado…), público (menino, menina, adulto, bebê), cores principais, ` +
    `estilo e sinônimos comuns. Português do Brasil, tudo minúsculo, sem acento faltando, sem repetir, sem "topo de bolo".\n` +
    `Responda APENAS com as tags separadas por vírgula.`;

  const content: unknown[] = [];
  if (imagem) content.push({ type: "image", source: { type: "base64", media_type: tipo, data: imagem } });
  content.push({ type: "text", text: pedido });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": chaveAnthropic(), "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 300, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) return respostaJson({ error: "ia_indisponivel" }, 502);
  const data = await r.json();
  const texto = String(data?.content?.[0]?.text || "");
  const tags = [...new Set(texto.split(/[,\n;]/).map(t => t.trim().toLowerCase().replace(/^[-•#\d.\s]+/, "").replace(/["“”.]/g, "")).filter(t => t && t.length <= 40))].slice(0, 20);
  return respostaJson({ tags }, 200);
}

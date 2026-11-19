import { usuarioDoToken, respostaNaoAutorizado, respostaJson, lerCorpo, planoDoUsuario } from "./_auth";

// (19/11) Stories do cardápio: conversa com o Bunny Stream (a chave fica só aqui, no servidor).
//   criar  → cria o vídeo no Bunny e devolve a assinatura para o celular enviar o arquivo direto para lá
//   status → o vídeo já terminou de converter?
//   apagar → remove o vídeo do Bunny
// O registro do story (prazo, produto, visualizações) fica no Supabase, gravado pela própria tela.

export const config = { runtime: "edge" };

const env = (): Record<string, string | undefined> => (globalThis as any).process?.env ?? {};
const MAX_ATIVOS = 3;

async function sha256Hex(texto: string): Promise<string> {
  const dados = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return respostaJson({ error: "metodo" }, 405);
  const usuario = await usuarioDoToken(req);
  if (!usuario) return respostaNaoAutorizado();

  const e = env();
  const lib = e.BUNNY_STREAM_LIBRARY_ID || "";
  const chave = e.BUNNY_STREAM_API_KEY || "";
  const cdn = e.BUNNY_STREAM_CDN_HOST || "";
  if (!lib || !chave || !cdn) return respostaJson({ error: "sem_config", message: "O serviço de vídeo ainda não está configurado." }, 503);

  const cru = await lerCorpo(req, 4000);
  let corpo: { acao?: string; videoId?: string } = {};
  try { corpo = cru ? JSON.parse(cru) : {}; } catch { return respostaJson({ error: "pedido_invalido" }, 400); }

  const base = `https://video.bunnycdn.com/library/${lib}/videos`;
  const cab = { AccessKey: chave, Accept: "application/json", "Content-Type": "application/json" };
  const prefixo = `story-${usuario.id}-`;

  // o vídeo é desta conta? (o título guarda o id de quem criou)
  const meuVideo = async (id: string): Promise<{ ok: boolean; dados?: any }> => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false };
    const r = await fetch(`${base}/${id}`, { headers: cab });
    if (!r.ok) return { ok: false };
    const d = await r.json();
    return { ok: typeof d?.title === "string" && d.title.startsWith(prefixo), dados: d };
  };

  try {
    if (corpo.acao === "criar") {
      const plano = await planoDoUsuario(req, usuario);
      if (plano === "erro") return respostaJson({ error: "tente_de_novo" }, 503);
      if (plano !== "pro") return respostaJson({ error: "so_pro", message: "Stories é um recurso do PRO." }, 403);

      // no máximo 3 no ar por loja (lido com o token da própria confeiteira)
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
      const url = e.SUPABASE_URL || e.VITE_SUPABASE_URL;
      const anon = e.SUPABASE_ANON_KEY || e.VITE_SUPABASE_ANON_KEY;
      if (url && anon) {
        const r = await fetch(`${url}/rest/v1/stories?user_id=eq.${usuario.id}&expira_em=gt.${encodeURIComponent(new Date().toISOString())}&select=id`, {
          headers: { apikey: anon, Authorization: `Bearer ${token}` },
        });
        if (r.ok) { const l = await r.json(); if (Array.isArray(l) && l.length >= MAX_ATIVOS) return respostaJson({ error: "limite", message: `Você já tem ${MAX_ATIVOS} stories no ar. Apague um para postar outro.` }, 409); }
      }

      const r = await fetch(base, { method: "POST", headers: cab, body: JSON.stringify({ title: `${prefixo}${Date.now()}` }) });
      if (!r.ok) return respostaJson({ error: "bunny", message: "Não deu para preparar o envio do vídeo." }, 502);
      const v = await r.json();
      const videoId = String(v?.guid || "");
      if (!videoId) return respostaJson({ error: "bunny" }, 502);
      const expira = Math.floor(Date.now() / 1000) + 3600; // 1 hora para terminar o envio
      const assinatura = await sha256Hex(`${lib}${chave}${expira}${videoId}`);
      return respostaJson({ videoId, libraryId: lib, expira, assinatura, cdn }, 200);
    }

    if (corpo.acao === "status") {
      const m = await meuVideo(String(corpo.videoId || ""));
      if (!m.ok) return respostaJson({ error: "nao_encontrado" }, 404);
      const st = Number(m.dados?.status);
      // 4 = terminou de converter · 5 e 6 = falhou · 7 e 8 = pronto no modo "na hora" (JIT) do Bunny
      // (19/11) também vale como pronto quando já existe ao menos uma qualidade convertida: o vídeo já toca,
      // e as qualidades maiores chegam depois. Esperar todas deixava minutos em "Convertendo".
      const resolucoes = String(m.dados?.availableResolutions || "").trim();
      const pronto = st === 4 || st === 7 || st === 8 || (st === 3 && resolucoes.length > 0) || Number(m.dados?.encodeProgress) >= 100;
      return respostaJson({ pronto, falhou: st === 5 || st === 6, duracao: Number(m.dados?.length) || 0, status: st, progresso: Number(m.dados?.encodeProgress) || 0, cdn }, 200);
    }

    if (corpo.acao === "apagar") {
      const m = await meuVideo(String(corpo.videoId || ""));
      if (!m.ok) return respostaJson({ ok: true }, 200); // já não existe (ou não é dela): nada a apagar
      await fetch(`${base}/${corpo.videoId}`, { method: "DELETE", headers: cab });
      return respostaJson({ ok: true }, 200);
    }

    return respostaJson({ error: "acao_invalida" }, 400);
  } catch {
    return respostaJson({ error: "bunny", message: "O serviço de vídeo não respondeu. Tente de novo." }, 502);
  }
}

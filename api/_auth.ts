// Helper das rotas /api/* — arquivos com "_" na frente não viram rota na Vercel.
// Confere se quem chamou está logado no Doonly (token do Supabase no header Authorization).

const env = (): Record<string, string | undefined> => (globalThis as any).process?.env ?? {};

export interface UsuarioLogado { id: string; email?: string }

export async function usuarioDoToken(req: Request): Promise<UsuarioLogado | null> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const e = env();
  const url = e.SUPABASE_URL || e.VITE_SUPABASE_URL;
  const anon = e.SUPABASE_ANON_KEY || e.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    console.error("api/_auth: SUPABASE_URL / SUPABASE_ANON_KEY não configurados");
    return null;
  }

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.id ? { id: user.id, email: user.email } : null;
  } catch {
    return null;
  }
}

/**
 * (11/10) A conta tem o PRO ativo? Lê plano e pro_expira_em do perfil COM O TOKEN DA PRÓPRIA USUÁRIA
 * (a mesma regra do app, em src/hooks/usePlano.ts). "erro" = não deu pra conferir agora (não é "grátis").
 */
export async function planoDoUsuario(req: Request, usuario: UsuarioLogado): Promise<"pro" | "gratis" | "erro"> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const e = env();
  const url = e.SUPABASE_URL || e.VITE_SUPABASE_URL;
  const anon = e.SUPABASE_ANON_KEY || e.VITE_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return "erro";
  try {
    const res = await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(usuario.id)}&select=plano,pro_expira_em`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) return "erro";
    const linhas = await res.json();
    const perfil = Array.isArray(linhas) ? linhas[0] : null;
    if (!perfil || perfil.plano !== "pro") return "gratis";
    if (!perfil.pro_expira_em) return "pro";
    return new Date(perfil.pro_expira_em) > new Date() ? "pro" : "gratis";
  } catch {
    return "erro";
  }
}

/**
 * (4.23) Conta um uso da IA no limite diário da conta (função ia_usar do banco, com o token da própria usuária).
 * "ok" = pode usar · "limite" = acabou o limite de hoje · Se a função ainda não existe no banco, deixa passar.
 */
export async function usarCota(req: Request, tipo: "chat" | "imagem" | "descricao" | "buscar_imagem"): Promise<{ ok: boolean; limite?: number; periodo?: "dia" | "mes"; ticket?: string }> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const e = env();
  const url = e.SUPABASE_URL || e.VITE_SUPABASE_URL;
  const anon = e.SUPABASE_ANON_KEY || e.VITE_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return { ok: true };
  try {
    const res = await fetch(`${url}/rest/v1/rpc/ia_usar`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ p_tipo: tipo }),
    });
    if (!res.ok) return { ok: true }; // função ainda não criada (404) ou instabilidade: não trava a IA por isso
    const r = await res.json();
    return r?.ok === false && r?.erro === "limite" ? { ok: false, limite: Number(r.limite) || 0, periodo: r.periodo === "mes" ? "mes" : "dia" } : { ok: true, ticket: typeof r?.ticket === "string" ? r.ticket : undefined };
  } catch {
    return { ok: true };
  }
}

/** (27/10) Erro da IA não gasta mensagem: devolve o uso contado (função ia_devolver do banco, com o ticket
 * que o ia_usar entregou só para o servidor; sem ticket não devolve nada). Nunca lança. */
export async function devolverCota(req: Request, ticket: string | undefined): Promise<void> {
  if (!ticket) return;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const e = env();
  const url = e.SUPABASE_URL || e.VITE_SUPABASE_URL;
  const anon = e.SUPABASE_ANON_KEY || e.VITE_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return;
  try {
    await fetch(`${url}/rest/v1/rpc/ia_devolver`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_ticket: ticket }),
    });
  } catch { /* não atrapalha a resposta */ }
}

/** Resposta de limite de uso da IA atingido (429) */
export function respostaLimite(limite: number | undefined, headers: Record<string, string> = {}, periodo: "dia" | "mes" = "dia"): Response {
  // (27/10) grátis da Doo: 10 mensagens por mês
  if (periodo === "mes") return respostaJson({ error: "limite_mensal", message: `Você usou as ${limite} mensagens do mês do plano grátis. No PRO são 150 por dia.` }, 429, headers);
  return respostaJson({ error: "limite_diario", message: limite ? `Você chegou ao limite de ${limite} usos de hoje. Amanhã libera de novo.` : "Esse recurso é do plano PRO." }, 429, headers);
}

/** Resposta em JSON com o código certo (as telas sempre leem JSON). */
export function respostaJson(corpo: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json", ...headers } });
}

/**
 * (11/10) Lê o corpo do pedido com limite de tamanho. Devolve null quando passa do limite (responda 413).
 * Obs.: a própria Vercel já corta pedidos acima de 4,5 MB antes de chegar aqui.
 */
export async function lerCorpo(req: Request, limite: number): Promise<string | null> {
  if ((Number(req.headers.get("content-length")) || 0) > limite) return null;
  const texto = await req.text();
  return texto.length > limite ? null : texto;
}

/** Chaves das IAs: o nome sem VITE_ tem prioridade (o nome antigo continua valendo até ser trocado na Vercel). */
export const chaveAnthropic = (): string => env().ANTHROPIC_API_KEY || env().VITE_ANTHROPIC_KEY || "";
export const chaveOpenAI = (): string => env().OPENAI_API_KEY || env().VITE_OPENAI_KEY || "";

export function respostaNaoAutorizado(headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

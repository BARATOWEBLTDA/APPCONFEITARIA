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

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

export function respostaNaoAutorizado(headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

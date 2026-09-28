import { supabase } from "@/lib/supabase";

/**
 * fetch para as rotas /api/* do Doonly: manda junto o token de quem está logado.
 * Sem o token, as rotas respondem 401 (protege os créditos de IA e busca).
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

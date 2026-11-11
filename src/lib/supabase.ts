import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * (11/11) Modo suporte: a aba aberta pela equipe Doonly guarda o login da loja SÓ nela (sessionStorage, chave própria).
 * As outras abas continuam com o login de sempre; fechar a aba encerra o acesso.
 */
export const CHAVE_SUPORTE = "doonly_suporte";
export const emModoSuporte = (() => {
  if (typeof window === "undefined") return false;
  try { return window.location.pathname.startsWith("/suporte/entrar") || !!window.sessionStorage.getItem(CHAVE_SUPORTE); } catch { return false; }
})();

export const supabase = emModoSuporte
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { storage: window.sessionStorage, storageKey: "sb-doonly-suporte", persistSession: true, detectSessionInUrl: false } })
  : createClient(supabaseUrl, supabaseAnonKey);

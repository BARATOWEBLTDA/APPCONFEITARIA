import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface Profile {
  id: string;
  nome: string;
  nome_loja: string;
  foto_url: string | null;
  /**
   * Código único de 4 chars usado na URL pública do cardápio.
   * Formato: /c/[codigo]/[slug]. Gerado automaticamente no cadastro (backend trigger).
   */
  codigo_publico?: string;
  /**
   * Slug personalizado usado apenas para usuários PRO.
   * NULL para free (usa "cardapio" fixo). Ex: "brunobolos".
   */
  slug_personalizado?: string | null;
  /**
   * @deprecated Substituído por codigo_publico + slug_personalizado.
   * Mantido apenas por compat de tipagem — sempre virá undefined do banco (coluna não existe).
   */
  slug?: string;
  plano?: string | null;
  pro_expira_em?: string | null;
}

// ─── Cache localStorage ────────────────────────────────────────────
// Evita layout shift na 2ª visita: o perfil é servido do cache imediatamente
// enquanto o Supabase é consultado em background pra revalidar.
const PROFILE_CACHE_KEY = "doonly_profile_cache_v1";

function loadCachedProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.id ? parsed : null;
  } catch {
    return null;
  }
}

function saveCachedProfile(profile: Profile | null) {
  if (typeof window === "undefined") return;
  try {
    if (profile) {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    }
  } catch {
    /* localStorage cheio ou desabilitado — ignora */
  }
}

// Store global para compartilhar o perfil entre componentes
// Inicializa com o cache pra 2ª visita ser instantânea
let globalProfile: Profile | null = loadCachedProfile();
const listeners: Set<(p: Profile | null) => void> = new Set();
let channelStarted = false;

function notifyListeners(profile: Profile | null) {
  globalProfile = profile;
  saveCachedProfile(profile);
  listeners.forEach(fn => fn(profile));
}

export async function refreshProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (data) notifyListeners(data);
}

// Garante que o canal realtime seja criado uma única vez em toda a aplicação
function ensureRealtimeChannel() {
  if (channelStarted) return;
  channelStarted = true;
  supabase
    .channel("profile-changes")
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "profiles",
    }, (payload) => {
      notifyListeners(payload.new as Profile);
    })
    .subscribe();
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(globalProfile);
  // Loading=false se já temos algo em cache (mostramos e revalidamos em bg)
  const [loading, setLoading] = useState(!globalProfile);

  useEffect(() => {
    // Registra listener para atualizações
    listeners.add(setProfile);

    // Sempre revalida do banco em background (mesmo com cache).
    // Se não temos cache, o loading termina aqui.
    // Se temos cache, o loading já era false — mas ainda atualizamos.
    refreshProfile().then(() => {
      if (loading) setLoading(false);
    });

    // Garante o canal realtime único (não recria a cada montagem)
    ensureRealtimeChannel();

    return () => {
      listeners.delete(setProfile);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { profile, loading, refetch: refreshProfile };
}

/** Limpa o cache do perfil — usar no logout. */
export function clearProfileCache() {
  globalProfile = null;
  saveCachedProfile(null);
  listeners.forEach(fn => fn(null));
}

/**
 * Domínio canônico do Doonly. O link público SEMPRE aponta pra cá,
 * independente de onde o app está sendo acessado (localhost, preview 
 * Vercel, domínio secundário). Isso garante que confeiteiras possam 
 * compartilhar links que funcionam pra qualquer visitante.
 *
 * Sobrescreva via VITE_PUBLIC_URL no .env local se quiser testar 
 * apontando pra outro ambiente.
 */
const CANONICAL_BASE_URL =
  (import.meta as any).env?.VITE_PUBLIC_URL || "https://doonly.com.br";

/**
 * Retorna a URL pública canônica do cardápio.
 * - Free (ou PRO sem slug personalizado): /c/[codigo]/cardapio
 * - PRO com slug: /c/[codigo]/[slug]
 */
export function getCardapioUrl(profile: Profile | null | undefined, origin?: string): string {
  if (!profile?.codigo_publico) return "";
  const base = origin ?? CANONICAL_BASE_URL;
  const slug = isPro(profile) && profile.slug_personalizado
    ? profile.slug_personalizado
    : "cardapio";
  return `${base}/c/${profile.codigo_publico}/${slug}`;
}

/**
 * Verifica se o perfil tem plano PRO ativo (não expirado).
 */
export function isPro(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.plano !== "pro") return false;
  if (!profile.pro_expira_em) return true;
  return new Date(profile.pro_expira_em) > new Date();
}

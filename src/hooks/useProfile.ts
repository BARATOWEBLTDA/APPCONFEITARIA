import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { desfazerPushDesteAparelho } from "@/hooks/usePushSubscription";

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
  pro_desde?: string | null; // (21/10) quando o PRO ligou pela primeira vez
  /** Mensagens do WhatsApp personalizadas (09/10 · 3.59). Chave → texto. Vazio = padrão. */
  mensagens_whatsapp?: Record<string, string> | null;
}

// ─── Cache localStorage ────────────────────────────────────────────
// Evita layout shift na 2ª visita: o perfil é servido do cache imediatamente
// enquanto o Supabase é consultado em background pra revalidar.
const PROFILE_CACHE_KEY = "doonly_profile_cache_v1";

/** Id da conta logada, lido da sessão guardada pelo Supabase (sem esperar a rede). */
function usuarioLogadoNoAparelho(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || "";
      if (/^sb-.*-auth-token$/.test(k)) {
        const v = JSON.parse(localStorage.getItem(k) || "null");
        return v?.user?.id || v?.currentSession?.user?.id || null;
      }
    }
  } catch { /* sem acesso ao armazenamento */ }
  return null;
}

function loadCachedProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id) return null;
    // 02/10: só usa o perfil guardado se for da conta que está logada neste aparelho
    // (senão, numa conta nova, aparecia por um instante o perfil da conta anterior — e o "Parabéns, PRO")
    const logado = usuarioLogadoNoAparelho();
    if (logado && parsed.id !== logado) { localStorage.removeItem(PROFILE_CACHE_KEY); return null; }

    // Invalida cache se detectar PRO com data expirada.
    // Motivo: user pode ter perdido o PRO (expiração) enquanto o app estava fechado.
    // Sem essa checagem, o cache seguiria dizendo "PRO ativo" até a próxima
    // revalidação do Supabase, causando flash de conteúdo PRO indevido.
    if (parsed.plano === "pro" && parsed.pro_expira_em) {
      const expira = new Date(parsed.pro_expira_em);
      if (!isNaN(expira.getTime()) && expira <= new Date()) {
        // Cache expirado — força refetch do banco (retorna null aqui)
        localStorage.removeItem(PROFILE_CACHE_KEY);
        return null;
      }
    }
    return parsed;
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

// (15/10) velocidade: cada tela/componente que usa o perfil pedia ele de novo ao abrir (umas 12 vezes no Início).
// Agora uma busca em andamento é repartida, e quem só está abrindo não busca de novo se buscou há menos de 5 s.
// Quem acabou de mudar o perfil chama refreshProfile() normal (força a busca).
let buscaPerfil: Promise<void> | null = null;
let ultimaBuscaPerfil = 0;
export function refreshProfile(forcar = true): Promise<void> {
  if (buscaPerfil) return forcar ? buscaPerfil.then(() => buscarPerfil()) : buscaPerfil;
  if (!forcar && globalProfile && Date.now() - ultimaBuscaPerfil < 5000) return Promise.resolve();
  return buscarPerfil();
}
function buscarPerfil(): Promise<void> {
  if (buscaPerfil) return buscaPerfil;
  buscaPerfil = (async () => {
    // a sessão vem do aparelho (getUser ia ao servidor toda vez); o banco confere a conta pela própria sessão
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;
    if (globalProfile?.id && globalProfile.id !== user.id) notifyListeners(null); // trocou de conta
    ligarTempoReal(user.id);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (data) notifyListeners(data);
    ultimaBuscaPerfil = Date.now();
  })().finally(() => { buscaPerfil = null; });
  return buscaPerfil;
}

// Tempo real só do perfil da conta logada (filtro no servidor) — 02/10
let canalUid: string | null = null;
let canal: any = null;
function ligarTempoReal(uid: string) {
  if (canalUid === uid) return;
  try { if (canal) supabase.removeChannel(canal); } catch { /* ignora */ }
  canalUid = uid;
  canal = supabase
    .channel(`profile-${uid}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${uid}` }, (payload) => {
      const novo = payload.new as Profile;
      if ((novo as any)?.id !== uid) return;
      notifyListeners({ ...(globalProfile?.id === uid ? globalProfile : {}), ...novo } as Profile);
    })
    .subscribe();
}

// Garante que os eventos (sair, voltar pro app) sejam ligados uma única vez em toda a aplicação
function ensureRealtimeChannel() {
  if (channelStarted) return;
  channelStarted = true;

  // Ao deslogar, limpa cache e reseta o profile global.
  // Sem isso, o próximo login abriria com dados da sessão anterior.
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      notifyListeners(null);
      try { if (canal) supabase.removeChannel(canal); } catch { /* ignora */ }
      canal = null; canalUid = null;
    }
  });

  // Ao voltar pra aba (troca de aba, volta do background),
  // revalida o profile. Isso pega mudanças de plano que
  // ocorreram enquanto o usuário estava fora e o realtime não pegou.
  if (typeof window !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        refreshProfile(false);
      }
    });
    // Reserva (02/10): se o tempo real não estiver ligado no Supabase, o app ainda percebe
    // a mudança de plano em até 1 minuto, e na hora ao voltar pra janela ou à internet.
    window.addEventListener("focus", () => refreshProfile(false));
    window.addEventListener("online", () => refreshProfile(false));
    setInterval(() => { if (document.visibilityState === "visible") refreshProfile(false); }, 60_000);
  }
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
    refreshProfile(false).then(() => {
      if (loading) setLoading(false);
    });

    // Garante o canal realtime único (não recria a cada montagem)
    ensureRealtimeChannel();

    return () => {
      listeners.delete(setProfile);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { profile, loading, refetch: () => refreshProfile() };
}

/** O perfil já carregado (sem esperar a rede). Pra funções fora de componentes. */
/** (13/10) Foto do círculo da conta: a foto de perfil, ou a logo da loja quando não tem foto. */
/** (18/10) foto do Google/Facebook (pessoal) não conta como foto da loja */
export const fotoPessoal = (url?: string | null) => !!url && /googleusercontent\.com|gravatar\.com|graph\.facebook|fbcdn\.net/i.test(url);

/**
 * (18/10) Toda foto de perfil do app é a logo do cardápio (não tem mais foto pessoal).
 * Contas antigas sem logo: usa a foto que ela mesma enviou (nunca a do Google).
 */
export function fotoDaLoja(p: any): string {
  const logo = String(p?.logo_url || "");
  if (logo) return logo;
  const foto = String(p?.foto_url || "");
  return foto && !fotoPessoal(foto) ? foto : "";
}

export function avatarDaConta(p: Profile | null | undefined): string {
  return fotoDaLoja(p);
}

export function perfilAtual(): Profile | null {
  return globalProfile;
}

/** Limpa o cache do perfil — usar no logout. */
export function clearProfileCache() {
  globalProfile = null;
  saveCachedProfile(null);
  listeners.forEach(fn => fn(null));
}

/**
 * Sai da conta NESTE aparelho, mesmo sem internet (10/10).
 * O signOut do Supabase avisa o servidor primeiro; sem internet ele devolve o erro (não lança) e deixa a sessão
 * guardada: a tela de entrar aparecia, mas a conta continuava aberta. E o signOut({ scope: "local" }) também
 * depende do servidor. Então, se o servidor não respondeu, a sessão guardada no aparelho é apagada aqui.
 * Devolve true quando não sobrou sessão neste aparelho (só aí a tela pode ir pro login).
 */
export async function sairDaConta(): Promise<boolean> {
  // (11/10) este aparelho para de receber os avisos da conta. Espera no máximo 2,5 s: nunca trava o sair.
  try { await Promise.race([desfazerPushDesteAparelho(), new Promise(r => setTimeout(r, 2500))]); } catch { /* segue */ }
  let erro: unknown;
  try { erro = (await supabase.auth.signOut()).error; } catch (e) { erro = e; }
  if (erro) {
    // primeiro pelo caminho do próprio Supabase (apaga a sessão e avisa as telas que saiu)…
    try { await (supabase.auth as any)._removeSession?.(); } catch { /* segue pro plano B */ }
    // …e, por garantia, apaga a sessão guardada (igual ao "Lembrar de mim" desmarcado)
    try {
      Object.keys(localStorage).filter(k => /^sb-.*-auth-token/.test(k)).forEach(k => localStorage.removeItem(k));
    } catch { /* sem acesso ao armazenamento */ }
  }
  const saiu = !usuarioLogadoNoAparelho();
  if (saiu) {
    clearProfileCache();
    // (11/10) as conversas com a Doo não ficam guardadas no aparelho depois de sair
    try {
      Object.keys(localStorage).filter(k => k.startsWith("doonly_doo_conversa_")).forEach(k => localStorage.removeItem(k));
    } catch { /* sem acesso ao armazenamento */ }
  }
  return saiu;
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

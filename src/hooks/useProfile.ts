import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface Profile {
  id: string;
  nome: string;
  nome_loja: string;
  foto_url: string | null;
}

// Store global para compartilhar o perfil entre componentes
let globalProfile: Profile | null = null;
const listeners: Set<(p: Profile | null) => void> = new Set();

function notifyListeners(profile: Profile | null) {
  globalProfile = profile;
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

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(globalProfile);
  const [loading, setLoading] = useState(!globalProfile);

  useEffect(() => {
    // Registra listener para atualizações
    listeners.add(setProfile);

    // Busca perfil se ainda não tiver
    if (!globalProfile) {
      refreshProfile().then(() => setLoading(false));
    } else {
      setLoading(false);
    }

    // Escuta mudanças em tempo real no Supabase
    const channel = supabase
      .channel("profile-changes")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
      }, (payload) => {
        notifyListeners(payload.new as Profile);
      })
      .subscribe();

    return () => {
      listeners.delete(setProfile);
      supabase.removeChannel(channel);
    };
  }, []);

  return { profile, loading, refetch: refreshProfile };
}

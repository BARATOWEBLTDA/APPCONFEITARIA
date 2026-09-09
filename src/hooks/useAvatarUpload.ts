/**
 * useAvatarUpload
 * ─────────────────────────────────────────────
 * Hook reutilizável para upload de foto de perfil.
 * Fluxo: openPicker() → escolhe arquivo → abre cropper → confirma → upload no Supabase.
 *
 * Usado no Inicio (avatar do hero mobile e desktop) e no Layout (avatar do sidebar).
 * Centraliza a lógica pra evitar duplicação.
 * ─────────────────────────────────────────────
 */

import { useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";

interface Options {
  /** Chamado após upload bem-sucedido (útil pra fechar menus, mostrar toast, etc). */
  onSuccess?: () => void;
}

export function useAvatarUpload(options: Options = {}) {
  const { profile, refetch } = useProfile();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  /** Abre o seletor de arquivo do sistema. */
  const openPicker = useCallback(() => {
    if (uploading) return;
    fileInputRef.current?.click();
  }, [uploading]);

  /** Handler pro input `<input type="file" onChange={handleFileSelected}>`. */
  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reseta pra permitir escolher o MESMO arquivo depois
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Escolha um arquivo de imagem.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("A imagem precisa ter no máximo 10MB.");
      return;
    }
    // Converte pra data URL e abre o cropper
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  /** Fecha o cropper sem salvar. */
  const cancelCrop = useCallback(() => setCropSrc(null), []);

  /** Handler do ImageCropper: recebe o blob JPEG e faz upload. */
  const handleCropDone = useCallback(async (blob: Blob) => {
    if (!profile?.id) return;
    setCropSrc(null);
    setUploading(true);
    try {
      const path = `avatars/${profile.id}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("profiles")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("profiles").getPublicUrl(path);
      // cache-bust pra forçar reload da imagem se já existia no mesmo path
      const publicUrl = `${pub.publicUrl}?t=${Date.now()}`;

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ foto_url: publicUrl })
        .eq("id", profile.id);
      if (dbErr) throw dbErr;

      await refetch();
      options.onSuccess?.();
    } catch (err: any) {
      console.error("[useAvatarUpload] erro no upload:", err);
      alert("Não foi possível trocar a foto. Tente novamente.");
    } finally {
      setUploading(false);
    }
  }, [profile?.id, refetch, options]);

  return {
    fileInputRef,
    uploading,
    cropSrc,
    openPicker,
    handleFileSelected,
    handleCropDone,
    cancelCrop,
  };
}

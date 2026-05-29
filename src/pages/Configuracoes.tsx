import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { refreshProfile } from "@/hooks/useProfile";

export default function Configuracoes() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", nome_loja: "", foto_url: "" });
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setForm({
          nome: data.nome || "",
          nome_loja: data.nome_loja || "",
          foto_url: data.foto_url || "",
        });
        if (data.foto_url) setPreview(data.foto_url);
      } else {
        // Cria o perfil se não existir
        await supabase.from("profiles").insert({ id: user.id });
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setUploading(true);
    setError("");

    // Preview local imediato
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `avatars/${userId}.${ext}`;

      // Upload
      const { error: uploadError } = await supabase.storage
        .from("profiles")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      // Pega URL pública
      const { data: urlData } = supabase.storage
        .from("profiles")
        .getPublicUrl(path);

      // Adiciona timestamp para forçar reload
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      setForm((f) => ({ ...f, foto_url: publicUrl }));
      setPreview(publicUrl);

      // Salva no banco imediatamente
      await supabase.from("profiles").upsert({
        id: userId,
        nome: form.nome,
        nome_loja: form.nome_loja,
        foto_url: publicUrl,
      }, { onConflict: "id" });
      await refreshProfile();

    } catch (err: any) {
      setError("Erro ao fazer upload. Tente novamente.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setSuccess(false);
    setError("");

    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      nome: form.nome,
      nome_loja: form.nome_loja,
      foto_url: form.foto_url,
    }, { onConflict: "id" });

    if (error) {
      setError("Erro ao salvar. Tente novamente.");
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
    setSaving(false);
  };

  if (loading) return <div className="cfg-loading">Carregando...</div>;

  return (
    <div className="cfg-root">
      <h1 className="cfg-title">Configurações</h1>
      <p className="cfg-subtitle">Personalize seu perfil e sua confeitaria</p>

      <div className="cfg-card">
        {/* Foto de perfil */}
        <div className="cfg-avatar-section">
          <div className="cfg-avatar" onClick={() => !uploading && fileRef.current?.click()}>
            {preview ? (
              <img src={preview} alt="Foto de perfil" />
            ) : (
              <div className="cfg-avatar-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            )}
            <div className="cfg-avatar-overlay">
              {uploading ? (
                <span className="spinner-white" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              )}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
          <p className="cfg-avatar-hint">{uploading ? "Enviando..." : "Clique para alterar a foto"}</p>
        </div>

        {/* Campos */}
        <div className="cfg-fields">
          <div className="cfg-field">
            <label>Seu nome</label>
            <input
              type="text"
              placeholder="Ex: Ana Paula"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div className="cfg-field">
            <label>Nome da confeitaria</label>
            <input
              type="text"
              placeholder="Ex: Doces da Ana"
              value={form.nome_loja}
              onChange={(e) => setForm({ ...form, nome_loja: e.target.value })}
            />
          </div>
        </div>

        {error && <p className="cfg-error">{error}</p>}
        {success && <p className="cfg-success">✓ Salvo com sucesso!</p>}

        <button className="cfg-btn" onClick={handleSave} disabled={saving || uploading}>
          {saving ? <span className="spinner" /> : "Salvar alterações"}
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }

        .cfg-root { font-family: 'Inter', sans-serif; max-width: 560px; }
        .cfg-loading { font-family: 'Inter', sans-serif; color: #9ca3af; padding: 2rem; }

        .cfg-title { font-size: 1.6rem; font-weight: 600; color: #1f2937; margin-bottom: 0.25rem; }
        .cfg-subtitle { font-size: 0.9rem; color: #9ca3af; margin-bottom: 1.5rem; }

        .cfg-card {
          background: white; border-radius: 16px;
          padding: 2rem; box-shadow: 0 2px 16px rgba(0,0,0,0.06);
        }

        .cfg-avatar-section { display: flex; flex-direction: column; align-items: center; margin-bottom: 1.5rem; }

        .cfg-avatar {
          width: 100px; height: 100px; border-radius: 50%;
          overflow: hidden; cursor: pointer; position: relative;
          border: 3px solid #fce7f3; background: #fff0f6;
        }
        .cfg-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .cfg-avatar-placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          color: #f9007a;
        }

        .cfg-avatar-overlay {
          position: absolute; inset: 0;
          background: rgba(249,0,122,0.5);
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.2s;
        }
        .cfg-avatar:hover .cfg-avatar-overlay { opacity: 1; }

        .cfg-avatar-hint { font-size: 0.8rem; color: #9ca3af; margin-top: 0.5rem; }

        .cfg-fields { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.25rem; }
        .cfg-field { display: flex; flex-direction: column; gap: 0.35rem; }
        .cfg-field label { font-size: 0.88rem; font-weight: 500; color: #374151; }
        .cfg-field input {
          padding: 0.72rem 1rem; border: 1.5px solid #e5e7eb;
          border-radius: 10px; font-family: 'Inter', sans-serif;
          font-size: 0.95rem; color: #1f2937; outline: none;
          transition: border-color 0.2s;
        }
        .cfg-field input:focus { border-color: #f9007a; }

        .cfg-error {
          background: #fff1f2; border: 1px solid #fecdd3;
          color: #be123c; border-radius: 8px;
          padding: 0.6rem 0.9rem; font-size: 0.85rem; margin-bottom: 1rem;
        }
        .cfg-success {
          background: #f0fdf4; border: 1px solid #bbf7d0;
          color: #16a34a; border-radius: 8px;
          padding: 0.6rem 0.9rem; font-size: 0.85rem; margin-bottom: 1rem;
        }

        .cfg-btn {
          width: 100%; padding: 0.85rem;
          background: linear-gradient(135deg, #f9007a, #d4006a);
          color: white; border: none; border-radius: 10px;
          font-family: 'Inter', sans-serif;
          font-size: 1rem; font-weight: 600; cursor: pointer;
          transition: opacity 0.2s;
          display: flex; align-items: center; justify-content: center; min-height: 48px;
        }
        .cfg-btn:hover:not(:disabled) { opacity: 0.9; }
        .cfg-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .spinner, .spinner-white {
          width: 20px; height: 20px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white; border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

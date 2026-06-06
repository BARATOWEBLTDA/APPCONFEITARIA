import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  step: { label: string; path: string } | null;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
  slug?: string;
}

export function QuickSetupModal({ step, userId, onClose, onSaved, slug }: Props) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!step) return null;
  const label = step.label;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (label.includes("seu nome")) {
        await supabase.from("profiles").upsert({ id: userId, nome: value }, { onConflict: "id" });
      } else if (label.includes("confeitaria")) {
        const nomeLoja = value.trim() || null;
        await supabase.from("profiles").upsert({ id: userId, nome_loja: nomeLoja }, { onConflict: "id" });
      }
      onSaved();
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setPreview(URL.createObjectURL(file));
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `avatars/${userId}.${ext}`;
    const { error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      await supabase.from("profiles").upsert({ id: userId, foto_url: url }, { onConflict: "id" });
      onSaved();
      onClose();
    }
    setSaving(false);
  };

  const isPhotoStep = label.includes("foto") || label.includes("logo");
  const isShareStep = label.includes("cardápio") || label.includes("Compartilhe");
  const cardapioUrl = slug ? `${window.location.origin}/cardapio/${slug}` : "";

  const renderContent = () => {
    if (label.includes("seu nome")) return (
      <div className="qsm-field">
        <label>Como você se chama?</label>
        <input placeholder="Ex: Ana Paula" value={value} onChange={e => setValue(e.target.value)} autoFocus />
      </div>
    );

    if (label.includes("confeitaria")) return (
      <div className="qsm-field">
        <label>Nome da sua confeitaria</label>
        <input placeholder="Ex: Doce Formiga" value={value} onChange={e => setValue(e.target.value)} autoFocus />
        <button
          onClick={() => { setValue(""); onSaved(); onClose(); }}
          style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline", marginTop: "4px", textAlign: "left" }}
        >
          Ainda não tenho nome definido
        </button>
      </div>
    );

    if (isPhotoStep) return (
      <div style={{ textAlign: "center" }}>
        <div className="qsm-avatar" onClick={() => fileRef.current?.click()}>
          {preview
            ? <img src={preview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
            : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f9007a" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          }
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
        <p className="qsm-hint">Clique na imagem para escolher uma foto ou logo</p>
        {saving && <p style={{ color: "#9ca3af", fontSize: "0.82rem" }}>Enviando...</p>}
        <button onClick={() => { onSaved(); onClose(); }} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline", marginTop: "8px" }}>
          Pular por agora
        </button>
      </div>
    );

    if (isShareStep) return (
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ fontSize: "3rem" }}>🎉</div>
        <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1f2937", margin: 0 }}>Seu cardápio está no ar!</p>
        <p style={{ fontSize: "0.82rem", color: "#6b7280", margin: 0 }}>Compartilhe o link com seus clientes</p>
        <div style={{ background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: "10px", padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#374151", wordBreak: "break-all", textAlign: "left" }}>
          {cardapioUrl || "Configure seu cardápio para gerar o link"}
        </div>
        {cardapioUrl && (
          <button
            onClick={() => { navigator.clipboard.writeText(cardapioUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            style={{ padding: "0.75rem", background: copied ? "#22c55e" : "linear-gradient(135deg, #f9007a, #d4006a)", color: "white", border: "none", borderRadius: "10px", fontFamily: "Inter, sans-serif", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", transition: "background 0.3s" }}
          >
            {copied ? "✓ Link copiado!" : "📋 Copiar link"}
          </button>
        )}
      </div>
    );

    return null;
  };

  return (
    <div className="qsm-overlay" onClick={onClose}>
      <div className="qsm-modal" onClick={e => e.stopPropagation()}>
        <div className="qsm-header">
          <h3 className="qsm-title">{label}</h3>
          <button className="qsm-close" onClick={onClose}>✕</button>
        </div>

        <div className="qsm-body">
          {renderContent()}
        </div>

        {!isPhotoStep && !isShareStep && (
          <div className="qsm-footer">
            <button className="qsm-btn-cancel" onClick={onClose}>Cancelar</button>
            <button className="qsm-btn-save" onClick={handleSave} disabled={saving || !value.trim()}>
              {saving ? <span className="qsm-spinner" /> : "Salvar"}
            </button>
          </div>
        )}

        {isShareStep && (
          <div className="qsm-footer">
            <button className="qsm-btn-save" style={{ flex: 1 }} onClick={() => { onSaved(); onClose(); }}>Concluir</button>
          </div>
        )}
      </div>

      <style>{`
        .qsm-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .qsm-modal { background: white; border-radius: 20px; width: 100%; max-width: 420px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); animation: qsmIn 0.25s cubic-bezier(0.16,1,0.3,1); }
        @keyframes qsmIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .qsm-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.25rem 0; }
        .qsm-title { font-size: 1rem; font-weight: 700; color: #1f2937; margin: 0; font-family: 'Inter', sans-serif; }
        .qsm-close { background: #f3f4f6; border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; color: #6b7280; }
        .qsm-body { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.85rem; }
        .qsm-avatar { width: 90px; height: 90px; border-radius: 50%; border: 2px dashed #fbcfe8; background: #fff0f6; display: flex; align-items: center; justify-content: center; cursor: pointer; margin: 0 auto 0.5rem; overflow: hidden; transition: border-color 0.2s; }
        .qsm-avatar:hover { border-color: #f9007a; }
        .qsm-field { display: flex; flex-direction: column; gap: 0.3rem; }
        .qsm-field label { font-size: 0.82rem; font-weight: 600; color: #374151; font-family: 'Inter', sans-serif; }
        .qsm-field input { padding: 0.7rem 0.9rem; border: 1.5px solid #e5e7eb; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 0.9rem; color: #1f2937; outline: none; transition: border-color 0.2s; }
        .qsm-field input:focus { border-color: #f9007a; }
        .qsm-hint { font-size: 0.75rem; color: #9ca3af; margin: 0; font-family: 'Inter', sans-serif; text-align: center; }
        .qsm-footer { display: flex; gap: 0.75rem; padding: 0 1.25rem 1.25rem; }
        .qsm-btn-cancel { flex: 1; padding: 0.75rem; background: #f3f4f6; color: #6b7280; border: none; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
        .qsm-btn-save { flex: 1; padding: 0.75rem; background: linear-gradient(135deg, #f9007a, #d4006a); color: white; border: none; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .qsm-btn-save:disabled { opacity: 0.7; cursor: not-allowed; }
        .qsm-spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

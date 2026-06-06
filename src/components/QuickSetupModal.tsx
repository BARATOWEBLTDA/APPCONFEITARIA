import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { ImageCropper } from "@/components/ui/ImageCropper";

interface Props {
  step: { label: string; path: string } | null;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
  profile?: any;
}

export function QuickSetupModal({ step, userId, onClose, onSaved, profile }: Props) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [trabalhaConfeitaria, setTrabalhaConfeitaria] = useState<boolean | null>(null);
  const [nomeLoja, setNomeLoja] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!step) return null;
  const label = step.label;

  // Reset value ao mudar de step
  const isNomeStep = label.includes("seu nome");
  const isTrabalhaStep = label.includes("trabalha com confeitaria");
  const isWhatsAppStep = label.includes("WhatsApp");
  const isInsumoStep = label.includes("insumo");
  const isClienteStep = label.includes("cliente");
  const isReceitaStep = label.includes("receita");

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isNomeStep && value.trim()) {
        await supabase.from("profiles").upsert({ id: userId, nome: value.trim() }, { onConflict: "id" });
      } else if (isTrabalhaStep) {
        const payload: any = { id: userId, onboarding_trabalha_confeitaria: true };
        if (trabalhaConfeitaria && nomeLoja.trim()) payload.nome_loja = nomeLoja.trim();
        await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      } else if (isWhatsAppStep && value.trim()) {
        await supabase.from("profiles").upsert({ id: userId, telefone: value.trim() }, { onConflict: "id" });
      }
      onSaved();
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleCropDone = async (blob: Blob) => {
    setSaving(true);
    const ext = "jpg";
    const path = `avatars/${userId}.${ext}`;
    const { error } = await supabase.storage.from("profiles").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (!error) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      setPreview(url);
      await supabase.from("profiles").upsert({ id: userId, foto_url: url }, { onConflict: "id" });
      onSaved();
      onClose();
    }
    setCropSrc(null);
    setSaving(false);
  };

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g,"").slice(0,11);
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`;
  };

  const renderContent = () => {
    if (isNomeStep) return (
      <div className="qsm-field">
        <label>Como você se chama?</label>
        <input placeholder="Ex: Ana Paula" value={value} onChange={e => setValue(e.target.value)} autoFocus />
      </div>
    );

    if (isTrabalhaStep) {
      if (trabalhaConfeitaria === null) return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <p style={{ fontSize: "0.88rem", color: "#6b7280", margin: 0, textAlign: "center" }}>Isso nos ajuda a personalizar sua experiência</p>
          <button onClick={() => setTrabalhaConfeitaria(true)} style={{ padding: "0.9rem", background: "#fdf2f8", border: "2px solid #fce7f3", borderRadius: "12px", fontFamily: "Inter, sans-serif", fontSize: "0.95rem", fontWeight: 600, color: "#ec4899", cursor: "pointer" }}>
            ✅ Sim, já tenho uma confeitaria
          </button>
          <button onClick={() => setTrabalhaConfeitaria(false)} style={{ padding: "0.9rem", background: "#f9fafb", border: "2px solid #e5e7eb", borderRadius: "12px", fontFamily: "Inter, sans-serif", fontSize: "0.95rem", fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>
            🌱 Não, estou começando agora
          </button>
        </div>
      );

      if (trabalhaConfeitaria) return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <div className="qsm-field">
            <label>Qual é o nome da sua confeitaria?</label>
            <input placeholder="Ex: Doce Formiga" value={nomeLoja} onChange={e => setNomeLoja(e.target.value)} autoFocus />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: "72px", height: "72px", borderRadius: "50%", border: "2px dashed #fbcfe8", background: "#fff0f6", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0 }}
              onClick={() => fileRef.current?.click()}>
              {preview
                ? <img src={preview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f9007a" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              }
            </div>
            <div>
              <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151", margin: "0 0 2px" }}>Logo da confeitaria</p>
              <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: 0, cursor: "pointer" }} onClick={() => fileRef.current?.click()}>Clique para adicionar</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) setCropSrc(URL.createObjectURL(f)); }} />
          {cropSrc && <ImageCropper src={cropSrc} onCrop={handleCropDone} onCancel={() => setCropSrc(null)} circular />}
        </div>
      );

      // Não trabalha — salva direto e fecha
      return (
        <div style={{ textAlign: "center", padding: "1rem 0" }}>
          <p style={{ fontSize: "0.95rem", color: "#374151", fontWeight: 600 }}>Tudo bem! 🌱</p>
          <p style={{ fontSize: "0.85rem", color: "#9ca3af" }}>Vamos te ajudar a construir sua confeitaria do zero.</p>
        </div>
      );
    }

    if (isWhatsAppStep) return (
      <div className="qsm-field">
        <label>WhatsApp da sua loja</label>
        <input type="tel" placeholder="(41) 9 9999-9999" value={value} onChange={e => setValue(formatPhone(e.target.value))} autoFocus />
        <p className="qsm-hint">🔒 Não vamos enviar mensagens sem sua autorização</p>
      </div>
    );

    if (isInsumoStep) return (
      <div style={{ textAlign: "center", padding: "0.5rem 0", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <span style={{ fontSize: "2.5rem" }}>🧂</span>
        <p style={{ fontSize: "0.92rem", fontWeight: 600, color: "#1f2937", margin: 0 }}>Cadastre seu primeiro insumo</p>
        <p style={{ fontSize: "0.82rem", color: "#6b7280", margin: 0 }}>Insumos são os ingredientes que você compra para suas receitas</p>
      </div>
    );

    if (isClienteStep) return (
      <div style={{ textAlign: "center", padding: "0.5rem 0", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <span style={{ fontSize: "2.5rem" }}>👥</span>
        <p style={{ fontSize: "0.92rem", fontWeight: 600, color: "#1f2937", margin: 0 }}>Cadastre seu primeiro cliente</p>
        <p style={{ fontSize: "0.82rem", color: "#6b7280", margin: 0 }}>Mantenha o histórico de pedidos e contatos dos seus clientes</p>
      </div>
    );

    if (isReceitaStep) return (
      <div style={{ textAlign: "center", padding: "0.5rem 0", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <span style={{ fontSize: "2.5rem" }}>📖</span>
        <p style={{ fontSize: "0.92rem", fontWeight: 600, color: "#1f2937", margin: 0 }}>Cadastre sua primeira receita</p>
        <p style={{ fontSize: "0.82rem", color: "#6b7280", margin: 0 }}>Calcule custos e precifique seus produtos automaticamente</p>
      </div>
    );

    return null;
  };

  const showFooter = isNomeStep || isWhatsAppStep || (isTrabalhaStep && trabalhaConfeitaria !== null);
  const canSave = isNomeStep ? value.trim().length > 0
    : isWhatsAppStep ? value.length >= 10
    : isTrabalhaStep && trabalhaConfeitaria === false ? true
    : isTrabalhaStep && trabalhaConfeitaria === true ? true
    : false;

  const getFooterLabel = () => {
    if (isInsumoStep) return "Ir para Insumos";
    if (isClienteStep) return "Ir para Clientes";
    if (isReceitaStep) return "Ir para Receitas";
    return "Salvar";
  };

  const showNavigateFooter = isInsumoStep || isClienteStep || isReceitaStep;

  return (
    <div className="qsm-overlay" onClick={onClose}>
      <div className="qsm-modal" onClick={e => e.stopPropagation()}>
        <div className="qsm-header">
          <h3 className="qsm-title">{
            isTrabalhaStep && trabalhaConfeitaria === true ? "Nome da sua confeitaria" :
            isTrabalhaStep && trabalhaConfeitaria === false ? "Bem-vinda ao Doonly! 🎉" :
            label
          }</h3>
          <button className="qsm-close" onClick={onClose}>✕</button>
        </div>

        <div className="qsm-body">
          {renderContent()}
        </div>

        {showFooter && (
          <div className="qsm-footer">
            <button className="qsm-btn-cancel" onClick={onClose}>Agora não</button>
            <button className="qsm-btn-save" onClick={handleSave} disabled={saving || !canSave}>
              {saving ? <span className="qsm-spinner" /> : "Salvar"}
            </button>
          </div>
        )}

        {showNavigateFooter && (
          <div className="qsm-footer">
            <button className="qsm-btn-cancel" onClick={onClose}>Depois</button>
            <button className="qsm-btn-save" onClick={() => { window.location.href = step.path; onClose(); }}>
              {getFooterLabel()} →
            </button>
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
        .qsm-field { display: flex; flex-direction: column; gap: 0.3rem; }
        .qsm-field label { font-size: 0.82rem; font-weight: 600; color: #374151; font-family: 'Inter', sans-serif; }
        .qsm-field input { padding: 0.7rem 0.9rem; border: 1.5px solid #e5e7eb; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 0.9rem; color: #1f2937; outline: none; transition: border-color 0.2s; }
        .qsm-field input:focus { border-color: #f9007a; }
        .qsm-hint { font-size: 0.75rem; color: #9ca3af; margin: 0; font-family: 'Inter', sans-serif; }
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

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { refreshProfile } from "@/hooks/useProfile";

interface Props {
  step: { label: string; path: string } | null;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
  profile?: any;
}

export function QuickSetupModal({ step, userId, onClose, onSaved }: Props) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [trabalhaConfeitaria, setTrabalhaConfeitaria] = useState<boolean | null>(null);
  const [nomeLoja, setNomeLoja] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!step) return null;
  const label = step.label;

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
      await refreshProfile();
      onSaved();
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  // Upload direto sem crop — igual ao Configuracoes que funciona
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
      await refreshProfile();
      onSaved();
    }
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
          <button onClick={() => setTrabalhaConfeitaria(true)} style={{ padding: "0.9rem", background: "#fdf2f8", border: "2px solid #fce7f3", borderRadius: "12px", fontFamily: "inherit", fontSize: "0.95rem", fontWeight: 600, color: "#ec4899", cursor: "pointer" }}>
            ✅ Sim, já tenho uma confeitaria
          </button>
          <button onClick={async () => {
            setSaving(true);
            await supabase.from("profiles").upsert({ id: userId, onboarding_trabalha_confeitaria: true }, { onConflict: "id" });
            await refreshProfile();
            onSaved(); onClose(); setSaving(false);
          }} style={{ padding: "0.9rem", background: "#f9fafb", border: "2px solid #e5e7eb", borderRadius: "12px", fontFamily: "inherit", fontSize: "0.95rem", fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>
            🌱 Não, estou começando agora
          </button>
        </div>
      );

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <div className="qsm-field">
            <label>Qual é o nome da sua confeitaria?</label>
            <input placeholder="Ex: Doce Formiga" value={nomeLoja} onChange={e => setNomeLoja(e.target.value)} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div className="qsm-avatar" onClick={() => fileRef.current?.click()} style={{ width: "72px", height: "72px", flexShrink: 0 }}>
              {preview
                ? <img src={preview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f9007a" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              }
            </div>
            <div>
              <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151", margin: "0 0 2px" }}>Logo da confeitaria</p>
              <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: 0, cursor: "pointer" }} onClick={() => fileRef.current?.click()}>
                {saving ? "Enviando..." : "Clique para adicionar"}
              </p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
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

  const showSaveFooter = isNomeStep || isWhatsAppStep || (isTrabalhaStep && trabalhaConfeitaria === true);
  const showNavigateFooter = isInsumoStep || isClienteStep || isReceitaStep;
  const canSave = isNomeStep ? value.trim().length > 0 : isWhatsAppStep ? value.length >= 10 : true;

  return (
    <div className="qsm-overlay" onClick={onClose}>
      <div className="qsm-modal" onClick={e => e.stopPropagation()}>
        <div className="qsm-header">
          <h3 className="qsm-title">{isTrabalhaStep && trabalhaConfeitaria === true ? "Nome da sua confeitaria" : label}</h3>
          <button className="qsm-close" onClick={onClose}>✕</button>
        </div>
        <div className="qsm-body">{renderContent()}</div>

        {showSaveFooter && (
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
              {isInsumoStep ? "Ir para Insumos →" : isClienteStep ? "Ir para Clientes →" : "Ir para Receitas →"}
            </button>
          </div>
        )}
      </div>

      <style>{`
        .qsm-overlay { position: fixed; inset: 0; z-index: 200; background: var(--bg-overlay); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: var(--space-4); }
        .qsm-modal { background: var(--bg-card); border-radius: var(--radius-xl); width: 100%; max-width: 420px; box-shadow: var(--shadow-lg); animation: qsmIn var(--dur-slow) cubic-bezier(0.16,1,0.3,1); }
        @keyframes qsmIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .qsm-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-5) var(--space-5) 0; }
        .qsm-title { font-size: var(--font-modal-title); font-weight: var(--fw-bold); line-height: var(--lh-tight); color: var(--text-title); margin: 0; font-family: inherit; }
        .qsm-close { background: var(--bg-body); border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: var(--font-caption); display: flex; align-items: center; justify-content: center; color: var(--text-muted); transition: background var(--dur-fast) var(--ease-out); }
        .qsm-body { padding: var(--space-4) var(--space-5); display: flex; flex-direction: column; gap: var(--gap-stack); }
        .qsm-avatar { border-radius: 50%; border: 2px dashed var(--primary-light); background: var(--primary-light); display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; transition: border-color var(--dur-fast) var(--ease-out); }
        .qsm-avatar:hover { border-color: var(--primary); }
        .qsm-field { display: flex; flex-direction: column; gap: var(--space-1); }
        .qsm-field label { font-size: var(--font-field-label); font-weight: var(--fw-semibold); line-height: var(--lh-normal); color: var(--text-secondary); font-family: inherit; }
        .qsm-field input { padding: var(--pad-input); border: 1.5px solid var(--border); border-radius: var(--radius-md); font-family: inherit; font-size: var(--font-input); font-weight: var(--fw-medium); line-height: var(--lh-normal); color: var(--text-title); background: var(--bg-input); outline: none; transition: border-color var(--dur-fast) var(--ease-out); }
        .qsm-field input:focus { border-color: var(--primary); }
        .qsm-hint { font-size: var(--font-helper); font-weight: var(--fw-regular); line-height: var(--lh-normal); color: var(--text-muted); margin: 0; font-family: inherit; }
        .qsm-footer { display: flex; gap: var(--gap-stack); padding: 0 var(--space-5) var(--space-5); }
        .qsm-btn-cancel { flex: 1; padding: var(--space-3); background: var(--bg-body); color: var(--text-secondary); border: none; border-radius: var(--radius-md); font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-semibold); line-height: var(--lh-normal); cursor: pointer; transition: opacity var(--dur-fast) var(--ease-out); }
        .qsm-btn-save { flex: 1; padding: var(--space-3); background: var(--primary-gradient); color: var(--text-inverse); border: none; border-radius: var(--radius-md); font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-bold); line-height: var(--lh-normal); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: opacity var(--dur-fast) var(--ease-out); }
        .qsm-btn-save:disabled { opacity: 0.7; cursor: not-allowed; }
        .qsm-spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

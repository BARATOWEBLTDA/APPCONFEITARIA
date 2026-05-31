import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  step: { label: string; path: string } | null;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function QuickSetupModal({ step, userId, onClose, onSaved }: Props) {
  const [value, setValue] = useState("");
  const [value2, setValue2] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fazEntrega, setFazEntrega] = useState(false);
  const [categoria, setCategoria] = useState("");
  const [desc, setDesc] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!step) return null;

  const label = step.label;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (label.includes("WhatsApp")) {
        await supabase.from("profiles").upsert({ id: userId, telefone: value }, { onConflict: "id" });
      } else if (label.includes("localização")) {
        const endereco = JSON.stringify({ rua: value, cidade: value2, estado: "", numero: "", cep: "" });
        await supabase.from("profiles").upsert({ id: userId, endereco }, { onConflict: "id" });
      } else if (label.includes("horário")) {
        const horario = JSON.stringify({ abertura: value, fechamento: value2, dias: ["Segunda","Terça","Quarta","Quinta","Sexta"] });
        await supabase.from("profiles").upsert({ id: userId, horario }, { onConflict: "id" });
      } else if (label.includes("descrição")) {
        await supabase.from("profiles").upsert({ id: userId, descricao_loja: desc }, { onConflict: "id" });
      } else if (label.includes("entrega")) {
        await supabase.from("profiles").upsert({ id: userId, faz_entrega: fazEntrega, taxa_entrega: parseFloat(value) || 0 }, { onConflict: "id" });
      } else if (label.includes("categoria")) {
        if (categoria.trim()) {
          await supabase.from("categorias").insert({ nome: categoria.trim(), user_id: userId });
        }
      } else if (label.includes("nome da confeitaria") || label.includes("nome")) {
        await supabase.from("profiles").upsert({ id: userId, nome_loja: value }, { onConflict: "id" });
      }
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
    }
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

  const renderContent = () => {
    if (label.includes("logo") || label.includes("foto")) {
      return (
        <div style={{ textAlign: "center" }}>
          <div className="qsm-avatar" onClick={() => fileRef.current?.click()}>
            {preview
              ? <img src={preview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f9007a" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
          <p className="qsm-hint">Clique na imagem para escolher uma foto</p>
          {saving && <p style={{ color: "#9ca3af", fontSize: "0.82rem" }}>Enviando...</p>}
        </div>
      );
    }

    if (label.includes("WhatsApp")) return (
      <div className="qsm-field">
        <label>Número do WhatsApp</label>
        <input type="tel" placeholder="(41) 9 9999-9999" value={value} onChange={e => {
          const d = e.target.value.replace(/\D/g,"").slice(0,11);
          const f = d.length <= 2 ? `(${d}` : d.length <= 6 ? `(${d.slice(0,2)}) ${d.slice(2)}` : d.length <= 10 ? `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}` : `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`;
          setValue(f);
        }} />
      </div>
    );

    if (label.includes("localização")) return (
      <>
        <div className="qsm-field"><label>Rua / Avenida</label><input placeholder="Ex: Rua das Flores, 123" value={value} onChange={e => setValue(e.target.value)} /></div>
        <div className="qsm-field"><label>Cidade</label><input placeholder="Ex: Curitiba" value={value2} onChange={e => setValue2(e.target.value)} /></div>
      </>
    );

    if (label.includes("horário")) return (
      <>
        <div className="qsm-field"><label>Horário de abertura</label><input type="time" value={value} onChange={e => setValue(e.target.value)} /></div>
        <div className="qsm-field"><label>Horário de fechamento</label><input type="time" value={value2} onChange={e => setValue2(e.target.value)} /></div>
        <p className="qsm-hint">Você pode configurar mais detalhes em Configurações</p>
      </>
    );

    if (label.includes("descrição")) return (
      <div className="qsm-field">
        <label>Descrição da sua loja</label>
        <textarea placeholder="Ex: Especializada em bolos artesanais e doces finos para eventos especiais..." value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
      </div>
    );

    if (label.includes("entrega")) return (
      <>
        <div className="qsm-toggle-row">
          <span>Você faz entrega?</span>
          <label className="qsm-toggle">
            <input type="checkbox" checked={fazEntrega} onChange={e => setFazEntrega(e.target.checked)} />
            <span className="qsm-toggle-slider" />
          </label>
        </div>
        {fazEntrega && (
          <div className="qsm-field">
            <label>Taxa de entrega (R$)</label>
            <input type="number" placeholder="Ex: 5.00" min="0" step="0.50" value={value} onChange={e => setValue(e.target.value)} />
          </div>
        )}
      </>
    );

    if (label.includes("categoria")) return (
      <div className="qsm-field">
        <label>Nome da categoria</label>
        <input placeholder="Ex: Bolos, Cupcakes, Doces..." value={categoria} onChange={e => setCategoria(e.target.value)} />
        <p className="qsm-hint">Você pode adicionar mais categorias em Configurações</p>
      </div>
    );

    return (
      <div className="qsm-field">
        <label>{label}</label>
        <input placeholder="Digite aqui..." value={value} onChange={e => setValue(e.target.value)} />
      </div>
    );
  };

  const isPhotoStep = label.includes("logo") || label.includes("foto");

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

        {!isPhotoStep && (
          <div className="qsm-footer">
            <button className="qsm-btn-cancel" onClick={onClose}>Cancelar</button>
            <button className="qsm-btn-save" onClick={handleSave} disabled={saving}>
              {saving ? <span className="qsm-spinner" /> : "Salvar"}
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

        .qsm-avatar { width: 90px; height: 90px; border-radius: 50%; border: 2px dashed #fbcfe8; background: #fff0f6; display: flex; align-items: center; justify-content: center; cursor: pointer; margin: 0 auto 0.5rem; overflow: hidden; transition: border-color 0.2s; }
        .qsm-avatar:hover { border-color: #f9007a; }

        .qsm-field { display: flex; flex-direction: column; gap: 0.3rem; }
        .qsm-field label { font-size: 0.82rem; font-weight: 600; color: #374151; font-family: 'Inter', sans-serif; }
        .qsm-field input, .qsm-field textarea { padding: 0.7rem 0.9rem; border: 1.5px solid #e5e7eb; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 0.9rem; color: #1f2937; outline: none; transition: border-color 0.2s; resize: none; }
        .qsm-field input:focus, .qsm-field textarea:focus { border-color: #f9007a; }

        .qsm-hint { font-size: 0.75rem; color: #9ca3af; margin: 0; font-family: 'Inter', sans-serif; text-align: center; }

        .qsm-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0; font-size: 0.9rem; font-weight: 500; color: #374151; font-family: 'Inter', sans-serif; }
        .qsm-toggle { position: relative; display: inline-block; width: 44px; height: 24px; }
        .qsm-toggle input { opacity: 0; width: 0; height: 0; }
        .qsm-toggle-slider { position: absolute; cursor: pointer; inset: 0; background: #e5e7eb; border-radius: 24px; transition: 0.3s; }
        .qsm-toggle-slider:before { content: ""; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
        .qsm-toggle input:checked + .qsm-toggle-slider { background: #f9007a; }
        .qsm-toggle input:checked + .qsm-toggle-slider:before { transform: translateX(20px); }

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

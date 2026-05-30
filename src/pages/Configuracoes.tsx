import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { refreshProfile } from "@/hooks/useProfile";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export default function Configuracoes() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"loja" | "horario">("loja");
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    nome: "",
    nome_loja: "",
    foto_url: "",
    telefone: "",
    endereco: "",
  });

  const [horario, setHorario] = useState({
    dias: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"] as string[],
    abertura: "08:00",
    fechamento: "18:00",
    abre_sabado: false,
    sabado_abertura: "09:00",
    sabado_fechamento: "14:00",
    abre_domingo: false,
    domingo_abertura: "09:00",
    domingo_fechamento: "14:00",
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();

      if (data) {
        setForm({
          nome: data.nome || "",
          nome_loja: data.nome_loja || "",
          foto_url: data.foto_url || "",
          telefone: data.telefone || "",
          endereco: data.endereco || "",
        });
        if (data.foto_url) setPreview(data.foto_url);

        if (data.horario) {
          try { setHorario({ ...horario, ...JSON.parse(data.horario) }); } catch {}
        }
      } else {
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
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `avatars/${userId}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!uploadError) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      setForm(f => ({ ...f, foto_url: publicUrl }));
      setPreview(publicUrl);
      await supabase.from("profiles").upsert({ id: userId, ...form, foto_url: publicUrl }, { onConflict: "id" });
      await refreshProfile();
    }
    setUploading(false);
  };

  const toggleDia = (dia: string) => {
    setHorario(h => ({
      ...h,
      dias: h.dias.includes(dia) ? h.dias.filter(d => d !== dia) : [...h.dias, dia]
    }));
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setError("");
    const { error: err } = await supabase.from("profiles").upsert({
      id: userId,
      nome: form.nome,
      nome_loja: form.nome_loja,
      foto_url: form.foto_url,
      telefone: form.telefone,
      endereco: form.endereco,
      horario: JSON.stringify(horario),
    }, { onConflict: "id" });
    if (err) setError("Erro ao salvar. Tente novamente.");
    else {
      setSuccess(true);
      await refreshProfile();
      setTimeout(() => setSuccess(false), 3000);
    }
    setSaving(false);
  };

  if (loading) return <div className="cfg-loading">Carregando...</div>;

  return (
    <div className="cfg-root">
      <h1 className="cfg-title">Configurações</h1>
      <p className="cfg-subtitle">Personalize sua loja e horários de funcionamento</p>

      {/* Tabs */}
      <div className="cfg-tabs">
        <button className={`cfg-tab ${activeTab === "loja" ? "active" : ""}`} onClick={() => setActiveTab("loja")}>
          🏪 Minha Loja
        </button>
        <button className={`cfg-tab ${activeTab === "horario" ? "active" : ""}`} onClick={() => setActiveTab("horario")}>
          🕐 Horários
        </button>
      </div>

      {activeTab === "loja" && (
        <div className="cfg-card">
          {/* Foto */}
          <div className="cfg-avatar-section">
            <div className="cfg-avatar" onClick={() => !uploading && fileRef.current?.click()}>
              {preview ? (
                <img src={preview} alt="Foto" />
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f9007a" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              )}
              <div className="cfg-avatar-overlay">{uploading ? <span className="spinner-sm" /> : "📷"}</div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
            <span className="cfg-avatar-hint">{uploading ? "Enviando..." : "Clique para alterar"}</span>
          </div>

          <div className="cfg-fields">
            <div className="cfg-field">
              <label>Seu nome</label>
              <input type="text" placeholder="Ex: Ana Paula" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="cfg-field">
              <label>Nome da confeitaria</label>
              <input type="text" placeholder="Ex: Doces da Ana" value={form.nome_loja} onChange={e => setForm({ ...form, nome_loja: e.target.value })} />
            </div>
            <div className="cfg-field">
              <label>WhatsApp</label>
              <input type="tel" placeholder="Ex: 41 9 9999-9999" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div className="cfg-field">
              <label>Localização / Endereço</label>
              <input type="text" placeholder="Ex: Curitiba - PR" value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      {activeTab === "horario" && (
        <div className="cfg-card">
          <h3 className="cfg-section-title">Dias de funcionamento</h3>
          <div className="dias-grid">
            {DIAS.slice(0, 5).map(dia => (
              <button key={dia} className={`dia-btn ${horario.dias.includes(dia) ? "active" : ""}`} onClick={() => toggleDia(dia)}>
                {dia}
              </button>
            ))}
          </div>

          <div className="cfg-row">
            <div className="cfg-field">
              <label>Abertura (seg–sex)</label>
              <input type="time" value={horario.abertura} onChange={e => setHorario({ ...horario, abertura: e.target.value })} />
            </div>
            <div className="cfg-field">
              <label>Fechamento (seg–sex)</label>
              <input type="time" value={horario.fechamento} onChange={e => setHorario({ ...horario, fechamento: e.target.value })} />
            </div>
          </div>

          <div className="cfg-divider" />

          {/* Sábado */}
          <div className="cfg-toggle-row">
            <div>
              <p className="cfg-toggle-label">Abre no Sábado</p>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={horario.abre_sabado} onChange={e => setHorario({ ...horario, abre_sabado: e.target.checked })} />
              <span className="toggle-slider" />
            </label>
          </div>
          {horario.abre_sabado && (
            <div className="cfg-row">
              <div className="cfg-field">
                <label>Abertura (sáb)</label>
                <input type="time" value={horario.sabado_abertura} onChange={e => setHorario({ ...horario, sabado_abertura: e.target.value })} />
              </div>
              <div className="cfg-field">
                <label>Fechamento (sáb)</label>
                <input type="time" value={horario.sabado_fechamento} onChange={e => setHorario({ ...horario, sabado_fechamento: e.target.value })} />
              </div>
            </div>
          )}

          <div className="cfg-divider" />

          {/* Domingo */}
          <div className="cfg-toggle-row">
            <div>
              <p className="cfg-toggle-label">Abre no Domingo</p>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={horario.abre_domingo} onChange={e => setHorario({ ...horario, abre_domingo: e.target.checked })} />
              <span className="toggle-slider" />
            </label>
          </div>
          {horario.abre_domingo && (
            <div className="cfg-row">
              <div className="cfg-field">
                <label>Abertura (dom)</label>
                <input type="time" value={horario.domingo_abertura} onChange={e => setHorario({ ...horario, domingo_abertura: e.target.value })} />
              </div>
              <div className="cfg-field">
                <label>Fechamento (dom)</label>
                <input type="time" value={horario.domingo_fechamento} onChange={e => setHorario({ ...horario, domingo_fechamento: e.target.value })} />
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="cfg-error">{error}</p>}
      {success && <p className="cfg-success">✓ Salvo com sucesso!</p>}

      <button className="cfg-btn" onClick={handleSave} disabled={saving || uploading}>
        {saving ? <span className="spinner" /> : "Salvar alterações"}
      </button>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .cfg-root { font-family: 'Inter', sans-serif; max-width: 600px; }
        .cfg-loading { font-family: 'Inter', sans-serif; color: #9ca3af; padding: 2rem; }
        .cfg-title { font-size: 1.5rem; font-weight: 700; color: #1f2937; margin-bottom: 0.25rem; }
        .cfg-subtitle { font-size: 0.88rem; color: #9ca3af; margin-bottom: 1.25rem; }

        .cfg-tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; }
        .cfg-tab {
          padding: 0.6rem 1.2rem; border-radius: 10px; border: 1.5px solid #e5e7eb;
          background: white; font-family: 'Inter', sans-serif; font-size: 0.88rem;
          font-weight: 500; color: #6b7280; cursor: pointer; transition: all 0.15s;
        }
        .cfg-tab.active { background: #fff0f6; border-color: #f9007a; color: #f9007a; font-weight: 600; }

        .cfg-card { background: white; border-radius: 16px; padding: 1.5rem; box-shadow: 0 2px 16px rgba(0,0,0,0.06); margin-bottom: 1rem; }

        .cfg-avatar-section { display: flex; flex-direction: column; align-items: center; margin-bottom: 1.5rem; gap: 0.4rem; }
        .cfg-avatar {
          width: 90px; height: 90px; border-radius: 50%;
          border: 2px dashed #fbcfe8; background: #fff0f6;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; position: relative; overflow: hidden;
        }
        .cfg-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cfg-avatar-overlay {
          position: absolute; inset: 0; background: rgba(249,0,122,0.4);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.2rem; opacity: 0; transition: opacity 0.2s;
        }
        .cfg-avatar:hover .cfg-avatar-overlay { opacity: 1; }
        .cfg-avatar-hint { font-size: 0.78rem; color: #9ca3af; }

        .cfg-fields { display: flex; flex-direction: column; gap: 1rem; }
        .cfg-field { display: flex; flex-direction: column; gap: 0.3rem; }
        .cfg-field label { font-size: 0.82rem; font-weight: 600; color: #374151; }
        .cfg-field input {
          padding: 0.68rem 1rem; border: 1.5px solid #e5e7eb; border-radius: 10px;
          font-family: 'Inter', sans-serif; font-size: 0.9rem; color: #1f2937;
          outline: none; transition: border-color 0.2s;
        }
        .cfg-field input:focus { border-color: #f9007a; }

        .cfg-section-title { font-size: 0.9rem; font-weight: 700; color: #1f2937; margin: 0 0 1rem; }

        .dias-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.25rem; }
        .dia-btn {
          padding: 0.4rem 0.8rem; border-radius: 8px; border: 1.5px solid #e5e7eb;
          background: white; font-family: 'Inter', sans-serif; font-size: 0.8rem;
          font-weight: 500; color: #6b7280; cursor: pointer; transition: all 0.15s;
        }
        .dia-btn.active { background: #fff0f6; border-color: #f9007a; color: #f9007a; font-weight: 600; }

        .cfg-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem; }
        .cfg-divider { border: none; border-top: 1px solid #f3f4f6; margin: 1rem 0; }

        .cfg-toggle-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
        .cfg-toggle-label { font-size: 0.88rem; font-weight: 600; color: #374151; margin: 0; }

        .toggle { position: relative; display: inline-block; width: 44px; height: 24px; }
        .toggle input { opacity: 0; width: 0; height: 0; }
        .toggle-slider {
          position: absolute; cursor: pointer; inset: 0;
          background: #e5e7eb; border-radius: 24px; transition: 0.3s;
        }
        .toggle-slider:before {
          content: ""; position: absolute; height: 18px; width: 18px;
          left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s;
        }
        .toggle input:checked + .toggle-slider { background: #f9007a; }
        .toggle input:checked + .toggle-slider:before { transform: translateX(20px); }

        .cfg-error { background: #fff1f2; border: 1px solid #fecdd3; color: #be123c; border-radius: 8px; padding: 0.6rem 0.9rem; font-size: 0.85rem; margin-bottom: 1rem; }
        .cfg-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; border-radius: 8px; padding: 0.6rem 0.9rem; font-size: 0.85rem; margin-bottom: 1rem; }

        .cfg-btn {
          width: 100%; padding: 0.85rem;
          background: linear-gradient(135deg, #f9007a, #d4006a);
          color: white; border: none; border-radius: 10px;
          font-family: 'Inter', sans-serif; font-size: 1rem; font-weight: 600;
          cursor: pointer; transition: opacity 0.2s;
          display: flex; align-items: center; justify-content: center; min-height: 48px;
        }
        .cfg-btn:hover:not(:disabled) { opacity: 0.9; }
        .cfg-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
        .spinner-sm { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

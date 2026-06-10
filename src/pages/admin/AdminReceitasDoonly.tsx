import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const emptyForm = { nome: "", categoria: "", ingredientes: "", modo_preparo: "", foto_url: "" };

export default function AdminReceitasDoonly() {
  const [receitas, setReceitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("receitas_doonly").select("*").order("created_at", { ascending: false });
    setReceitas(data || []);
    setLoading(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    const path = `receitas-doonly/${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      setForm(f => ({ ...f, foto_url: data.publicUrl }));
    }
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    if (editId) await supabase.from("receitas_doonly").update(form).eq("id", editId);
    else await supabase.from("receitas_doonly").insert(form);
    await load();
    setShowForm(false); setForm(emptyForm); setEditId(null); setPreview(null); setSaving(false);
  };

  const handleEdit = (r: any) => {
    setForm({ nome: r.nome, categoria: r.categoria, ingredientes: r.ingredientes, modo_preparo: r.modo_preparo, foto_url: r.foto_url || "" });
    setPreview(r.foto_url || null);
    setEditId(r.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("receitas_doonly").delete().eq("id", id);
    load();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 className="adm-page-title">🏅 Receitas Doonly</h1>
          <p className="adm-page-sub">Receitas verificadas da plataforma</p>
        </div>
        <button className="adm-btn-primary" onClick={() => { setForm(emptyForm); setPreview(null); setEditId(null); setShowForm(true); }}>
          + Nova Receita
        </button>
      </div>

      {loading ? <div className="adm-loading">Carregando...</div> : (
        <div className="adm-receitas-grid">
          {receitas.map(r => (
            <div key={r.id} className="adm-receita-card">
              <div className="adm-receita-img">
                {r.foto_url ? <img src={r.foto_url} alt={r.nome} /> : <span>🍰</span>}
              </div>
              <div className="adm-verified-badge">🏅 Verificada Doonly</div>
              <div className="adm-receita-body">
                <p className="adm-receita-nome">{r.nome}</p>
                <p className="adm-receita-autor">{r.categoria}</p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", padding: "0 0.9rem 0.9rem" }}>
                <button className="adm-act-sm edit" onClick={() => handleEdit(r)}>✏️ Editar</button>
                <button className="adm-act-sm delete" onClick={() => handleDelete(r.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="adm-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="adm-form-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1f2937", margin: 0 }}>{editId ? "Editar" : "Nova"} Receita Doonly</h2>
              <button className="adm-modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>

            <div className="adm-form-avatar" onClick={() => fileRef.current?.click()}>
              {preview ? <img src={preview} alt="" /> : <span>📷 Foto</span>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />

            <div className="adm-form-fields">
              <div className="adm-form-field"><label>Nome da receita</label><input placeholder="Ex: Brigadeiro Gourmet" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="adm-form-field"><label>Categoria</label><input placeholder="Ex: Bombons, Bolos..." value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} /></div>
              <div className="adm-form-field"><label>Ingredientes</label><textarea rows={3} placeholder="Liste os ingredientes..." value={form.ingredientes} onChange={e => setForm({ ...form, ingredientes: e.target.value })} /></div>
              <div className="adm-form-field"><label>Modo de preparo</label><textarea rows={4} placeholder="Descreva o preparo..." value={form.modo_preparo} onChange={e => setForm({ ...form, modo_preparo: e.target.value })} /></div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button className="adm-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="adm-btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
                {saving ? "Salvando..." : editId ? "Salvar" : "Publicar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .adm-page-title { font-size: 1.5rem; font-weight: 700; color: #1f2937; margin: 0 0 0.25rem; }
        .adm-page-sub { font-size: 0.88rem; color: #9ca3af; margin: 0; }
        .adm-loading { color: #9ca3af; padding: 2rem; }
        .adm-btn-primary { padding: 0.7rem 1.25rem; background: linear-gradient(135deg,#f9007a,#d4006a); color: white; border: none; border-radius: 10px; font-family:'Geist', sans-serif; font-size:0.88rem; font-weight:600; cursor:pointer; white-space:nowrap; }
        .adm-receitas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
        .adm-receita-card { background: white; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); position: relative; }
        .adm-receita-img { height: 140px; background: #f9fafb; display: flex; align-items: center; justify-content: center; font-size: 3rem; overflow: hidden; }
        .adm-receita-img img { width: 100%; height: 100%; object-fit: cover; }
        .adm-verified-badge { position: absolute; top: 0.6rem; left: 0.6rem; background: linear-gradient(135deg,#f9c74f,#f8961e); color: #1a1a2e; font-size: 0.65rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 20px; }
        .adm-receita-body { padding: 0.9rem 0.9rem 0.5rem; }
        .adm-receita-nome { font-size: 0.9rem; font-weight: 600; color: #1f2937; margin: 0 0 0.2rem; }
        .adm-receita-autor { font-size: 0.78rem; color: #9ca3af; margin: 0; }
        .adm-act-sm { padding: 0.4rem 0.75rem; border: none; border-radius: 8px; font-family:'Geist', sans-serif; font-size:0.78rem; font-weight:600; cursor:pointer; }
        .adm-act-sm.edit { background: #eff6ff; color: #3b82f6; flex:1; }
        .adm-act-sm.delete { background: #fff1f2; color: #ef4444; }
        .adm-modal-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .adm-form-modal { background: white; border-radius: 20px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 1.5rem; position: relative; }
        .adm-modal-close { background: #f3f4f6; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 0.8rem; }
        .adm-form-avatar { width: 100%; height: 140px; background: #f9fafb; border: 2px dashed #e5e7eb; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; margin-bottom: 1rem; overflow: hidden; font-size: 0.88rem; color: #9ca3af; font-family:'Geist', sans-serif; }
        .adm-form-avatar img { width:100%; height:100%; object-fit:cover; }
        .adm-form-fields { display: flex; flex-direction: column; gap: 0.75rem; }
        .adm-form-field { display: flex; flex-direction: column; gap: 0.3rem; }
        .adm-form-field label { font-size: 0.82rem; font-weight: 600; color: #374151; font-family:'Geist', sans-serif; }
        .adm-form-field input, .adm-form-field textarea { padding: 0.65rem 0.9rem; border: 1.5px solid #e5e7eb; border-radius: 8px; font-family:'Geist', sans-serif; font-size:0.88rem; color:#1f2937; outline:none; resize:none; }
        .adm-form-field input:focus, .adm-form-field textarea:focus { border-color: #f9007a; }
        .adm-btn-cancel { padding: 0.7rem 1.25rem; background: #f3f4f6; color: #6b7280; border: none; border-radius: 10px; font-family:'Geist', sans-serif; font-size:0.88rem; font-weight:600; cursor:pointer; }
      `}</style>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const emptyForm = { titulo: "", descricao: "", categoria: "", capa_url: "", pdf_url: "" };

export default function AdminPDFs() {
  const [pdfs, setPdfs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [capaPreview, setCapaPreview] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [saving, setSaving] = useState(false);
  const capaRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("biblioteca_pdf").select("*").order("created_at", { ascending: false });
    setPdfs(data || []);
    setLoading(false);
  };

  const handleCapa = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapaPreview(URL.createObjectURL(file));
    const path = `pdfs/capas/${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      setForm(f => ({ ...f, capa_url: data.publicUrl }));
    }
  };

  const handlePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfName(file.name);
    const path = `pdfs/arquivos/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      setForm(f => ({ ...f, pdf_url: data.publicUrl }));
    }
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) return;
    setSaving(true);
    if (editId) await supabase.from("biblioteca_pdf").update(form).eq("id", editId);
    else await supabase.from("biblioteca_pdf").insert(form);
    await load();
    setShowForm(false); setForm(emptyForm); setEditId(null); setCapaPreview(null); setPdfName(""); setSaving(false);
  };

  const handleEdit = (p: any) => {
    setForm({ titulo: p.titulo, descricao: p.descricao, categoria: p.categoria, capa_url: p.capa_url || "", pdf_url: p.pdf_url || "" });
    setCapaPreview(p.capa_url || null);
    setPdfName(p.pdf_url ? "Arquivo atual" : "");
    setEditId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("biblioteca_pdf").delete().eq("id", id);
    load();
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem", flexWrap:"wrap", gap:"0.75rem" }}>
        <div>
          <h1 className="adm-page-title">📄 Biblioteca PDF</h1>
          <p className="adm-page-sub">Materiais exclusivos para os usuários</p>
        </div>
        <button className="adm-btn-primary" onClick={() => { setForm(emptyForm); setCapaPreview(null); setPdfName(""); setEditId(null); setShowForm(true); }}>
          + Novo PDF
        </button>
      </div>

      {loading ? <div className="adm-loading">Carregando...</div> : (
        <div className="adm-pdf-grid">
          {pdfs.map(p => (
            <div key={p.id} className="adm-pdf-card">
              <div className="adm-pdf-capa">
                {p.capa_url ? <img src={p.capa_url} alt={p.titulo} /> : <span>📄</span>}
              </div>
              <div className="adm-pdf-body">
                <span className="adm-pdf-cat">{p.categoria || "Geral"}</span>
                <p className="adm-pdf-titulo">{p.titulo}</p>
                <p className="adm-pdf-desc">{p.descricao}</p>
              </div>
              <div style={{ display:"flex", gap:"0.5rem", padding:"0 0.9rem 0.9rem" }}>
                {p.pdf_url && <a href={p.pdf_url} target="_blank" rel="noreferrer" className="adm-act-sm view">👁️ Ver</a>}
                <button className="adm-act-sm edit" onClick={() => handleEdit(p)}>✏️</button>
                <button className="adm-act-sm delete" onClick={() => handleDelete(p.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="adm-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="adm-form-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
              <h2 style={{ fontSize:"1rem", fontWeight:700, color:"#1f2937", margin:0 }}>{editId ? "Editar" : "Novo"} PDF</h2>
              <button className="adm-modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="adm-form-capa" onClick={() => capaRef.current?.click()}>
              {capaPreview ? <img src={capaPreview} alt="" /> : <span>📷 Imagem de capa</span>}
            </div>
            <input ref={capaRef} type="file" accept="image/*" onChange={handleCapa} style={{ display:"none" }} />

            <div className="adm-form-fields">
              <div className="adm-form-field"><label>Título</label><input placeholder="Ex: Apostila de Brigadeiros" value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} /></div>
              <div className="adm-form-field"><label>Categoria</label><input placeholder="Ex: Receitas, Precificação..." value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} /></div>
              <div className="adm-form-field"><label>Descrição</label><textarea rows={2} placeholder="Breve descrição do material..." value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} /></div>

              <div className="adm-form-field">
                <label>Arquivo PDF</label>
                <button className="adm-upload-btn" onClick={() => pdfRef.current?.click()}>
                  {pdfName ? `✅ ${pdfName}` : "📎 Selecionar PDF"}
                </button>
                <input ref={pdfRef} type="file" accept="application/pdf" onChange={handlePdf} style={{ display:"none" }} />
              </div>
            </div>

            <div style={{ display:"flex", gap:"0.75rem", marginTop:"1rem" }}>
              <button className="adm-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="adm-btn-primary" onClick={handleSave} disabled={saving} style={{ flex:1 }}>
                {saving ? "Salvando..." : editId ? "Salvar" : "Publicar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .adm-page-title { font-size: var(--text-xl); font-weight: var(--fw-bold); color:#1f2937; margin:0 0 0.25rem; }
        .adm-page-sub { font-size: var(--font-button); color:#9ca3af; margin:0; }
        .adm-loading { color:#9ca3af; padding:2rem; }
        .adm-btn-primary { padding:0.7rem 1.25rem; background:linear-gradient(135deg,#f9007a,#d4006a); color:white; border:none; border-radius: var(--radius-md); font-family:'Geist', sans-serif; font-size: var(--font-button); font-weight: var(--fw-semibold); cursor:pointer; white-space:nowrap; }
        .adm-pdf-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:1rem; }
        .adm-pdf-card { background:white; border-radius: var(--radius-lg); overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
        .adm-pdf-capa { height:140px; background:#f9fafb; display:flex; align-items:center; justify-content:center; font-size:3rem; overflow:hidden; }
        .adm-pdf-capa img { width:100%; height:100%; object-fit:cover; }
        .adm-pdf-body { padding:0.9rem 0.9rem 0.5rem; }
        .adm-pdf-cat { font-size: var(--font-caption); font-weight: var(--fw-semibold); color:#f9007a; background:#fff0f6; padding:0.2rem 0.6rem; border-radius: var(--radius-xl); }
        .adm-pdf-titulo { font-size: var(--font-button); font-weight: var(--fw-semibold); color:#1f2937; margin:0.4rem 0 0.2rem; }
        .adm-pdf-desc { font-size: var(--font-helper); color:#9ca3af; margin:0; line-height:1.4; }
        .adm-act-sm { padding:0.4rem 0.75rem; border:none; border-radius: var(--radius-sm); font-family:'Geist', sans-serif; font-size: var(--font-helper); font-weight: var(--fw-semibold); cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; }
        .adm-act-sm.view { background:#eff6ff; color:#3b82f6; flex:1; justify-content:center; }
        .adm-act-sm.edit { background:#f0fdf4; color:#16a34a; }
        .adm-act-sm.delete { background:#fff1f2; color:#ef4444; }
        .adm-modal-overlay { position:fixed; inset:0; z-index:100; background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:1rem; }
        .adm-form-modal { background:white; border-radius: var(--radius-xl); width:100%; max-width:480px; max-height:90vh; overflow-y:auto; padding:1.5rem; }
        .adm-modal-close { background:#f3f4f6; border:none; width:30px; height:30px; border-radius:50%; cursor:pointer; font-size: var(--font-helper); }
        .adm-form-capa { width:100%; height:140px; background:#f9fafb; border:2px dashed #e5e7eb; border-radius: var(--radius-md); display:flex; align-items:center; justify-content:center; cursor:pointer; margin-bottom:1rem; overflow:hidden; font-size: var(--font-button); color:#9ca3af; font-family:'Geist', sans-serif; }
        .adm-form-capa img { width:100%; height:100%; object-fit:cover; }
        .adm-form-fields { display:flex; flex-direction:column; gap:0.75rem; }
        .adm-form-field { display:flex; flex-direction:column; gap:0.3rem; }
        .adm-form-field label { font-size: var(--font-helper); font-weight: var(--fw-semibold); color:#374151; font-family:'Geist', sans-serif; }
        .adm-form-field input, .adm-form-field textarea { padding:0.65rem 0.9rem; border:1.5px solid #e5e7eb; border-radius: var(--radius-sm); font-family:'Geist', sans-serif; font-size: var(--font-button); color:#1f2937; outline:none; resize:none; }
        .adm-form-field input:focus, .adm-form-field textarea:focus { border-color:#f9007a; }
        .adm-upload-btn { padding:0.65rem 0.9rem; border:1.5px dashed #e5e7eb; border-radius: var(--radius-sm); background:#f9fafb; font-family:'Geist', sans-serif; font-size: var(--font-button); color:#6b7280; cursor:pointer; text-align:left; }
        .adm-btn-cancel { padding:0.7rem 1.25rem; background:#f3f4f6; color:#6b7280; border:none; border-radius: var(--radius-md); font-family:'Geist', sans-serif; font-size: var(--font-button); font-weight: var(--fw-semibold); cursor:pointer; }
      `}</style>
    </div>
  );
}

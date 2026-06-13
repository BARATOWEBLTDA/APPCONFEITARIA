import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tag?: string;
  imagem_url?: string;
  created_at: string;
}

export default function AdminNotificacoes() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titulo: "", mensagem: "", tag: "", imagem_url: "" });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("notificacoes").select("*").order("created_at", { ascending: false });
    setNotificacoes(data || []);
    setLoading(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    const path = `notificacoes/${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      setForm(f => ({ ...f, imagem_url: data.publicUrl }));
    }
  };

  const handleSend = async () => {
    if (!form.titulo.trim()) return;
    setSaving(true);
    await supabase.from("notificacoes").insert({
      titulo: form.titulo,
      mensagem: form.mensagem,
      tag: form.tag || null,
      imagem_url: form.imagem_url || null,
    });
    await load();
    setShowForm(false);
    setForm({ titulo: "", mensagem: "", tag: "", imagem_url: "" });
    setPreview(null);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("notificacoes").delete().eq("id", id);
    setConfirmDelete(null);
    load();
  };

  const formatData = (d: string) => new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 className="adm-page-title">🔔 Notificações</h1>
          <p className="adm-page-sub">Envie comunicados para todos os membros</p>
        </div>
        <button className="adm-btn-primary" onClick={() => { setShowForm(true); setForm({ titulo: "", mensagem: "", tag: "", imagem_url: "" }); setPreview(null); }}>
          + Nova Notificação
        </button>
      </div>

      {/* Lista de notificações enviadas */}
      {loading ? <div className="adm-loading">Carregando...</div> : (
        <div className="ntf-adm-list">
          {notificacoes.length === 0 ? (
            <div className="ntf-adm-empty">
              <span>🔔</span>
              <p>Nenhuma notificação enviada ainda</p>
            </div>
          ) : notificacoes.map(n => (
            <div key={n.id} className="ntf-adm-item">
              <div className="ntf-adm-img">
                {n.imagem_url ? <img src={n.imagem_url} alt={n.titulo} /> : <span>🔔</span>}
              </div>
              <div className="ntf-adm-content">
                <p className="ntf-adm-titulo">{n.titulo}</p>
                {n.mensagem && <p className="ntf-adm-msg">{n.mensagem}</p>}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.35rem" }}>
                  {n.tag && <span className="ntf-adm-tag">{n.tag}</span>}
                  <span className="ntf-adm-time">{formatData(n.created_at)}</span>
                </div>
              </div>
              <button className="ntf-adm-delete" onClick={() => setConfirmDelete(n.id)}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* Modal nova notificação */}
      {showForm && (
        <div className="adm-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="ntf-form-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1f2937", margin: 0 }}>Nova Notificação</h2>
              <button className="adm-modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>

            {/* Preview imagem */}
            <div className="ntf-form-img" onClick={() => fileRef.current?.click()}>
              {preview ? <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "10px" }} /> : (
                <div style={{ textAlign: "center", color: "#9ca3af" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>📷</div>
                  <p style={{ fontSize: "0.78rem", margin: 0 }}>Imagem opcional</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />

            <div className="adm-form-fields">
              <div className="adm-form-field">
                <label>Título *</label>
                <input placeholder="Ex: Nova funcionalidade disponível!" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} />
              </div>
              <div className="adm-form-field">
                <label>Mensagem</label>
                <textarea rows={3} placeholder="Descreva a notificação..." value={form.mensagem} onChange={e => setForm({ ...form, mensagem: e.target.value })} style={{ padding: "0.65rem 0.9rem", border: "1.5px solid #e5e7eb", borderRadius: "8px", fontFamily: "inherit", fontSize: "0.88rem", color: "#1f2937", outline: "none", resize: "none", width: "100%" }} />
              </div>
              <div className="adm-form-field">
                <label>Tag <span style={{ fontWeight: 400, color: "#9ca3af" }}>(ex: nova receita!, atualização)</span></label>
                <input placeholder="Ex: nova receita!" value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })} />
              </div>
            </div>

            {/* Preview como vai aparecer */}
            {form.titulo && (
              <div style={{ marginTop: "1rem", background: "#f9fafb", borderRadius: "10px", padding: "0.75rem", border: "1px solid #e5e7eb" }}>
                <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: "0 0 0.5rem", fontWeight: 600, textTransform: "uppercase" }}>Preview</p>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "8px", background: "#e5e7eb", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>
                    {preview ? <img src={preview} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🔔"}
                  </div>
                  <div>
                    <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1f2937", margin: "0 0 0.2rem" }}>{form.titulo}</p>
                    {form.mensagem && <p style={{ fontSize: "0.78rem", color: "#6b7280", margin: "0 0 0.2rem" }}>{form.mensagem}</p>}
                    {form.tag && <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#f9007a" }}>{form.tag}</span>}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
              <button className="adm-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="adm-btn-primary" style={{ flex: 1 }} onClick={handleSend} disabled={saving || !form.titulo.trim()}>
                {saving ? "Enviando..." : "🚀 Enviar para todos"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar exclusão */}
      {confirmDelete && (
        <div className="adm-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()}>
            <h3>Excluir notificação?</h3>
            <p>Ela será removida para todos os membros.</p>
            <div className="adm-modal-actions">
              <button className="adm-btn-cancel" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="adm-btn-danger" onClick={() => handleDelete(confirmDelete)}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .adm-page-title { font-size: 1.5rem; font-weight: 700; color: #1f2937; margin: 0 0 0.25rem; }
        .adm-page-sub { font-size: 0.88rem; color: #9ca3af; margin: 0; }
        .adm-loading { color: #9ca3af; padding: 2rem; }
        .adm-btn-primary { padding: 0.7rem 1.25rem; background: linear-gradient(135deg,#f9007a,#d4006a); color: white; border: none; border-radius: 10px; font-family:'Geist', sans-serif; font-size:0.88rem; font-weight:600; cursor:pointer; white-space:nowrap; }
        .adm-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .adm-btn-cancel { flex: 1; padding: 0.7rem; background: #f3f4f6; color: #6b7280; border: none; border-radius: 8px; font-family:'Geist', sans-serif; font-weight:600; cursor:pointer; }
        .adm-btn-danger { flex: 1; padding: 0.7rem; background: #ef4444; color: white; border: none; border-radius: 8px; font-family:'Geist', sans-serif; font-weight:600; cursor:pointer; }

        .ntf-adm-list { display: flex; flex-direction: column; gap: 0; background: white; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .ntf-adm-empty { text-align: center; padding: 3rem; color: #9ca3af; }
        .ntf-adm-empty span { font-size: 2.5rem; display: block; margin-bottom: 0.75rem; }
        .ntf-adm-empty p { font-size: 0.88rem; margin: 0; }

        .ntf-adm-item { display: flex; align-items: flex-start; gap: 0.9rem; padding: 1rem 1.25rem; border-bottom: 1px solid #f3f4f6; }
        .ntf-adm-item:last-child { border-bottom: none; }
        .ntf-adm-img { width: 56px; height: 56px; border-radius: 8px; background: #f3f4f6; flex-shrink: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
        .ntf-adm-img img { width: 100%; height: 100%; object-fit: cover; }
        .ntf-adm-content { flex: 1; min-width: 0; }
        .ntf-adm-titulo { font-size: 0.9rem; font-weight: 700; color: #1f2937; margin: 0 0 0.2rem; }
        .ntf-adm-msg { font-size: 0.82rem; color: #6b7280; margin: 0; line-height: 1.4; }
        .ntf-adm-tag { font-size: 0.72rem; font-weight: 600; color: #f9007a; }
        .ntf-adm-time { font-size: 0.72rem; color: #9ca3af; }
        .ntf-adm-delete { background: #fff1f2; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }

        .adm-modal-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .ntf-form-modal { background: white; border-radius: 20px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 1.5rem; }
        .adm-modal-close { background: #f3f4f6; border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; }
        .ntf-form-img { width: 100%; height: 120px; background: #f9fafb; border: 2px dashed #e5e7eb; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; margin-bottom: 1rem; overflow: hidden; transition: border-color 0.2s; }
        .ntf-form-img:hover { border-color: #f9007a; }
        .adm-form-fields { display: flex; flex-direction: column; gap: 0.75rem; }
        .adm-form-field { display: flex; flex-direction: column; gap: 0.3rem; }
        .adm-form-field label { font-size: 0.82rem; font-weight: 600; color: #374151; font-family:'Geist', sans-serif; }
        .adm-form-field input { padding: 0.65rem 0.9rem; border: 1.5px solid #e5e7eb; border-radius: 8px; font-family:'Geist', sans-serif; font-size:0.88rem; color:#1f2937; outline:none; }
        .adm-form-field input:focus { border-color: #f9007a; }
        .adm-modal { background: white; border-radius: 16px; padding: 1.5rem; width: 90%; max-width: 360px; text-align: center; }
        .adm-modal h3 { font-size: 1rem; font-weight: 600; color: #1f2937; margin: 0 0 0.4rem; }
        .adm-modal p { font-size: 0.85rem; color: #9ca3af; margin: 0 0 1.25rem; }
        .adm-modal-actions { display: flex; gap: 0.75rem; }
      `}</style>
    </div>
  );
}

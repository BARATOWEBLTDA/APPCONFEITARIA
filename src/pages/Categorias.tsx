import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Categoria = {
  id?: string;
  user_id?: string;
  nome: string;
  imagem_url?: string;
  ordem?: number;
};

export default function Categorias() {
  const [userId, setUserId] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Categoria>({ nome: "", imagem_url: "", ordem: 0 });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await loadCategorias(user.id);
      setLoading(false);
    };
    load();
  }, []);

  const loadCategorias = async (uid: string) => {
    const { data } = await supabase.from("categorias").select("*").eq("user_id", uid).order("ordem").order("nome");
    if (data) setCategorias(data);
  };

  const openNova = () => { setForm({ nome: "", imagem_url: "", ordem: categorias.length }); setModal(true); };
  const openEditar = (c: Categoria) => { setForm({ ...c }); setModal(true); };
  const fecharModal = () => { setModal(false); setForm({ nome: "", imagem_url: "", ordem: 0 }); };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading("img");
    const ext = file.name.split(".").pop();
    const path = `categorias/${userId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("products").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("products").getPublicUrl(path);
      setForm(f => ({ ...f, imagem_url: data.publicUrl }));
    }
    setUploading(null);
  };

  const handleSalvar = async () => {
    if (!form.nome.trim()) return alert("Nome é obrigatório");
    setSaving(true);
    if (form.id) {
      await supabase.from("categorias").update({ nome: form.nome, imagem_url: form.imagem_url, ordem: form.ordem }).eq("id", form.id);
    } else {
      await supabase.from("categorias").insert({ nome: form.nome, imagem_url: form.imagem_url, ordem: form.ordem, user_id: userId });
    }
    await loadCategorias(userId);
    setSaving(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
    fecharModal();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("categorias").delete().eq("id", id);
    setCategorias(c => c.filter(x => x.id !== id));
    setDeleteConfirm(null);
  };

  const moverOrdem = async (id: string, dir: -1 | 1) => {
    const idx = categorias.findIndex(c => c.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= categorias.length) return;
    const updated = [...categorias];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    updated.forEach((c, i) => c.ordem = i);
    setCategorias(updated);
    await Promise.all(updated.map(c => supabase.from("categorias").update({ ordem: c.ordem }).eq("id", c.id!)));
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh" }}>
      <span className="cat-spinner" />
      <style>{`@keyframes catspin{to{transform:rotate(360deg)}} .cat-spinner{width:32px;height:32px;border:3px solid #fce7f3;border-top-color:#F583BF;border-radius:50%;animation:catspin 0.7s linear infinite;display:inline-block;}`}</style>
    </div>
  );

  return (
    <div className="cat-root">
      <div className="cat-header">
        <div>
          <h1 className="cat-title">Categorias</h1>
          <p className="cat-sub">{categorias.length} categoria{categorias.length !== 1 ? "s" : ""}</p>
        </div>
        <button className="cat-btn-novo" onClick={openNova}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nova categoria
        </button>
      </div>

      {categorias.length === 0 ? (
        <div className="cat-empty">
          <span style={{ fontSize: "3rem" }}>🏷️</span>
          <p className="cat-empty-title">Nenhuma categoria ainda</p>
          <p className="cat-empty-sub">Crie categorias para organizar seus produtos no cardápio</p>
          <button className="cat-btn-novo" onClick={openNova}>+ Criar categoria</button>
        </div>
      ) : (
        <div className="cat-list">
          {categorias.map((cat, idx) => (
            <div key={cat.id} className="cat-item">
              {/* Ícone */}
              <div className="cat-item-icon">
                {cat.imagem_url
                  ? <img src={cat.imagem_url} alt={cat.nome} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                  : <span style={{ fontSize: "1.5rem" }}>🏷️</span>
                }
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <p className="cat-item-nome">{cat.nome}</p>
                <p className="cat-item-sub">{cat.imagem_url ? "Com ícone personalizado" : "Sem ícone"}</p>
              </div>

              {/* Ações */}
              <div className="cat-item-actions">
                <button className="cat-order-btn" onClick={() => moverOrdem(cat.id!, -1)} disabled={idx === 0}>↑</button>
                <button className="cat-order-btn" onClick={() => moverOrdem(cat.id!, 1)} disabled={idx === categorias.length - 1}>↓</button>
                <button className="cat-edit-btn" onClick={() => openEditar(cat)}>Editar</button>
                <button className="cat-del-btn" onClick={() => setDeleteConfirm(cat.id!)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview de como ficará no cardápio */}
      {categorias.length > 0 && (
        <div className="cat-preview-card">
          <p className="cat-preview-title">👀 Preview no cardápio</p>
          <div style={{ display: "flex", gap: "12px", overflowX: "auto", padding: "8px 0", scrollbarWidth: "none" }}>
            {[{ nome: "Todos", imagem_url: "" }, ...categorias].map((cat, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                <div style={{ width: "56px", height: "56px", borderRadius: "50%", backgroundColor: i === 0 ? "#2E2E2E" : "#fe62a6", border: "3px solid #DBDFE4", outline: "3px solid white", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {cat.imagem_url
                    ? <img src={cat.imagem_url} alt={cat.nome} style={{ width: "70%", height: "70%", objectFit: "contain" }} />
                    : <span style={{ fontSize: "1.2rem" }}>🏷️</span>
                  }
                </div>
                <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#374151", textAlign: "center", maxWidth: "60px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.nome}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="cat-modal-overlay" onClick={fecharModal}>
          <div className="cat-modal" onClick={e => e.stopPropagation()}>
            <div className="cat-modal-header">
              <h2 className="cat-modal-title">{form.id ? "Editar Categoria" : "Nova Categoria"}</h2>
              <button className="cat-modal-close" onClick={fecharModal}>✕</button>
            </div>
            <div className="cat-modal-body">

              {/* Ícone */}
              <div className="cat-section">
                <p className="cat-section-label">🖼️ Ícone da Categoria</p>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div className="cat-icon-upload" onClick={() => !uploading && imgRef.current?.click()}>
                    {form.imagem_url ? (
                      <img src={form.imagem_url} alt="ícone" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                        {uploading ? <span className="cat-spinner-sm" /> : (
                          <>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F583BF" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            <span style={{ fontSize: "0.65rem", color: "#9ca3af" }}>Upload</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "0.82rem", color: "#374151", fontWeight: 600, margin: "0 0 4px" }}>Imagem do ícone</p>
                    <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: "0 0 8px" }}>PNG transparente recomendado</p>
                    {form.imagem_url && (
                      <button onClick={() => setForm(f => ({ ...f, imagem_url: "" }))} style={{ fontSize: "0.72rem", color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Remover imagem</button>
                    )}
                    {!form.imagem_url && (
                      <button onClick={() => imgRef.current?.click()} style={{ fontSize: "0.75rem", color: "#F583BF", background: "none", border: "1px solid #F583BF", borderRadius: "8px", padding: "4px 12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Escolher arquivo</button>
                    )}
                  </div>
                </div>
                <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />
              </div>

              {/* Nome */}
              <div className="cat-section">
                <p className="cat-section-label">✏️ Nome</p>
                <input
                  type="text"
                  placeholder="Ex: Bolos, Doces, Salgados..."
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="cat-input"
                  autoFocus
                />
              </div>

            </div>
            <div className="cat-modal-footer">
              <button className="cat-btn-cancelar" onClick={fecharModal}>Cancelar</button>
              <button className="cat-btn-salvar" onClick={handleSalvar} disabled={saving}>
                {saving ? <span className="cat-spinner-sm" /> : (form.id ? "Salvar" : "Criar categoria")}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="cat-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="cat-confirm" onClick={e => e.stopPropagation()}>
            <p className="cat-confirm-title">Excluir categoria?</p>
            <p className="cat-confirm-sub">Os produtos dessa categoria não serão excluídos, apenas a categoria.</p>
            <div className="cat-confirm-btns">
              <button onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ background: "#ef4444", color: "white" }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes catspin { to { transform:rotate(360deg); } }
        @keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
        .cat-root { font-family:'Inter',sans-serif; max-width:600px; display:flex; flex-direction:column; gap:1rem; }
        .cat-spinner { width:32px; height:32px; border:3px solid #fce7f3; border-top-color:#F583BF; border-radius:50%; animation:catspin 0.7s linear infinite; display:inline-block; }
        .cat-spinner-sm { width:18px; height:18px; border:2px solid rgba(255,255,255,0.4); border-top-color:white; border-radius:50%; animation:catspin 0.7s linear infinite; display:inline-block; }
        .cat-header { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; padding-top:1.5rem; }
        .cat-title { font-size:1.3rem; font-weight:700; color:var(--text-primary,#1f2937); margin:0 0 0.15rem; }
        .cat-sub { font-size:0.82rem; color:var(--text-muted,#9ca3af); margin:0; }
        .cat-btn-novo { display:flex; align-items:center; gap:0.4rem; padding:0.7rem 1.2rem; background:linear-gradient(135deg,#F583BF,#e060a8); color:white; border:none; border-radius:50px; font-family:'Inter',sans-serif; font-size:0.88rem; font-weight:700; cursor:pointer; white-space:nowrap; }
        .cat-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.75rem; padding:3rem 1rem; text-align:center; }
        .cat-empty-title { font-size:1rem; font-weight:700; color:var(--text-primary,#1f2937); margin:0; }
        .cat-empty-sub { font-size:0.82rem; color:var(--text-muted,#9ca3af); margin:0; }
        .cat-list { display:flex; flex-direction:column; gap:0.5rem; }
        .cat-item { background:var(--bg-card,white); border-radius:16px; padding:0.85rem 1rem; display:flex; align-items:center; gap:1rem; box-shadow:var(--shadow-card,0 2px 8px rgba(0,0,0,0.06)); }
        .cat-item-icon { width:52px; height:52px; border-radius:50%; background:#fdf2f8; border:3px solid #fce7f3; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }
        .cat-item-nome { font-size:0.92rem; font-weight:700; color:var(--text-primary,#1f2937); margin:0 0 2px; }
        .cat-item-sub { font-size:0.72rem; color:var(--text-muted,#9ca3af); margin:0; }
        .cat-item-actions { display:flex; align-items:center; gap:0.3rem; }
        .cat-order-btn { width:28px; height:28px; background:var(--bg-subtle,#f3f4f6); border:none; border-radius:8px; cursor:pointer; font-size:0.75rem; display:flex; align-items:center; justify-content:center; color:#6b7280; }
        .cat-order-btn:disabled { opacity:0.3; cursor:not-allowed; }
        .cat-edit-btn { padding:0.35rem 0.75rem; background:var(--bg-subtle,#f3f4f6); border:none; border-radius:8px; font-family:'Inter',sans-serif; font-size:0.78rem; font-weight:600; color:var(--text-secondary,#374151); cursor:pointer; }
        .cat-del-btn { width:30px; height:30px; background:#fff1f2; border:none; border-radius:8px; color:#ef4444; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .cat-preview-card { background:var(--bg-card,white); border-radius:16px; padding:1rem; box-shadow:var(--shadow-card,0 2px 8px rgba(0,0,0,0.06)); }
        .cat-preview-title { font-size:0.78rem; font-weight:700; color:#F583BF; text-transform:uppercase; letter-spacing:0.06em; margin:0 0 0.5rem; }
        .cat-modal-overlay { position:fixed; inset:0; z-index:500; background:rgba(0,0,0,0.5); display:flex; align-items:flex-end; justify-content:center; }
        .cat-modal { background:var(--bg-card,white); border-radius:24px 24px 0 0; width:100%; max-width:520px; max-height:92vh; display:flex; flex-direction:column; animation:slideUp 0.25s ease; }
        .cat-modal-header { display:flex; align-items:center; justify-content:space-between; padding:1.1rem 1.25rem 0.75rem; border-bottom:1px solid var(--border,#f3f4f6); flex-shrink:0; }
        .cat-modal-title { font-size:1rem; font-weight:700; color:var(--text-primary,#1f2937); margin:0; }
        .cat-modal-close { background:var(--bg-subtle,#f3f4f6); border:none; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text-muted,#6b7280); font-size:0.75rem; }
        .cat-modal-body { flex:1; overflow-y:auto; padding:1rem 1.25rem; display:flex; flex-direction:column; gap:1.25rem; }
        .cat-modal-footer { padding:1rem 1.25rem; border-top:1px solid var(--border,#f3f4f6); display:flex; gap:0.75rem; flex-shrink:0; }
        .cat-section { display:flex; flex-direction:column; gap:0.75rem; }
        .cat-section-label { font-size:0.78rem; font-weight:700; color:#F583BF; text-transform:uppercase; letter-spacing:0.06em; margin:0; }
        .cat-icon-upload { width:80px; height:80px; border-radius:50%; border:2px dashed #fce7f3; background:#fdf2f8; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }
        .cat-input { padding:0.75rem 1rem; border:1.5px solid var(--border,#e5e7eb); border-radius:12px; font-family:'Inter',sans-serif; font-size:0.9rem; color:var(--text-primary,#1f2937); outline:none; width:100%; box-sizing:border-box; background:var(--bg-input,white); }
        .cat-input:focus { border-color:#F583BF; }
        .cat-btn-cancelar { flex:1; padding:0.85rem; background:var(--bg-subtle,#f3f4f6); border:none; border-radius:50px; font-family:'Inter',sans-serif; font-size:0.9rem; font-weight:600; color:var(--text-secondary,#374151); cursor:pointer; }
        .cat-btn-salvar { flex:2; padding:0.85rem; background:linear-gradient(135deg,#F583BF,#e060a8); color:white; border:none; border-radius:50px; font-family:'Inter',sans-serif; font-size:0.9rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .cat-btn-salvar:disabled { opacity:0.65; cursor:not-allowed; }
        .cat-confirm { background:var(--bg-card,white); border-radius:18px; padding:1.5rem; width:90%; max-width:320px; margin:auto; }
        .cat-confirm-title { font-size:1rem; font-weight:700; color:var(--text-primary,#1f2937); margin:0 0 0.4rem; }
        .cat-confirm-sub { font-size:0.82rem; color:var(--text-muted,#9ca3af); margin:0 0 1.25rem; }
        .cat-confirm-btns { display:flex; gap:0.75rem; }
        .cat-confirm-btns button { flex:1; padding:0.75rem; border:none; border-radius:50px; font-family:'Inter',sans-serif; font-size:0.88rem; font-weight:700; cursor:pointer; background:var(--bg-subtle,#f3f4f6); color:var(--text-secondary,#374151); }
      `}</style>
    </div>
  );
}

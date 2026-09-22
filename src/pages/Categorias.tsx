import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import EmptyDoo from "@/components/EmptyDoo";
import BtnNovo from "@/components/BtnNovo";
import AppPageHeader from "@/components/AppPageHeader";
import ReqTag from "@/components/ReqTag";

type Categoria = {
  id?: string;
  user_id?: string;
  nome: string;
  imagem_url?: string;
  ordem?: number;
};

const SYSTEM_ICONS = Array.from({ length: 42 }, (_, i) => `/categoriaicones/icone (${i + 1}).png`);

// Gradientes rotativos pros cards — cada categoria pega um baseado no nome
const CAT_GRADIENTS = [
  { bg: "linear-gradient(160deg, #FDF3F7 0%, #FAE8EF 100%)", badgeBg: "#FCE0E9", badgeColor: "#993556" }, // rosa
  { bg: "linear-gradient(160deg, #FEF3C7 0%, #FDE68A 100%)", badgeBg: "#FEF3C7", badgeColor: "#78350F" }, // amarelo
  { bg: "linear-gradient(160deg, #E0F2FE 0%, #BAE6FD 100%)", badgeBg: "#DBEAFE", badgeColor: "#1E40AF" }, // azul
  { bg: "linear-gradient(160deg, #FFEDD5 0%, #FED7AA 100%)", badgeBg: "#FFEDD5", badgeColor: "#9A3412" }, // laranja
  { bg: "linear-gradient(160deg, #F3E8FF 0%, #E9D5FF 100%)", badgeBg: "#F3E8FF", badgeColor: "#6B21A8" }, // roxo
  { bg: "linear-gradient(160deg, #DCFCE7 0%, #BBF7D0 100%)", badgeBg: "#DCFCE7", badgeColor: "#166534" }, // verde
  { bg: "linear-gradient(160deg, #FFE4E6 0%, #FECDD3 100%)", badgeBg: "#FFE4E6", badgeColor: "#9F1239" }, // rose
  { bg: "linear-gradient(160deg, #FEF9C3 0%, #FEF08A 100%)", badgeBg: "#FEF9C3", badgeColor: "#854D0E" }, // dourado
];
const getGradient = (nome: string, idx: number) => CAT_GRADIENTS[idx % CAT_GRADIENTS.length];

// Toggle grid/lista
function ViewToggle({ viewMode, onChange }: { viewMode: "grid" | "lista"; onChange: (m: "grid" | "lista") => void }) {
  return (
    <div className="cat-view-toggle" role="tablist" aria-label="Modo de visualização">
      <button
        role="tab"
        aria-selected={viewMode === "grid"}
        className={`cat-view-toggle-btn ${viewMode === "grid" ? "cat-view-toggle-btn--ativo" : ""}`}
        onClick={() => onChange("grid")}
        aria-label="Visualização em grade"
        title="Grade"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
        </svg>
      </button>
      <button
        role="tab"
        aria-selected={viewMode === "lista"}
        className={`cat-view-toggle-btn ${viewMode === "lista" ? "cat-view-toggle-btn--ativo" : ""}`}
        onClick={() => onChange("lista")}
        aria-label="Visualização em lista"
        title="Lista"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none"/>
        </svg>
      </button>
    </div>
  );
}

export default function Categorias() {
  const location = useLocation();
  const isStandalone = location.pathname === "/categorias";
  const [userId, setUserId] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<{ categoria: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Categoria>({ nome: "", imagem_url: "", ordem: 0 });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showGaleria, setShowGaleria] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "lista">(() => {
    try { return (localStorage.getItem("doonly_categorias_view") as any) || "grid"; }
    catch { return "grid"; }
  });
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  // Salva preferência de visualização
  useEffect(() => {
    try { localStorage.setItem("doonly_categorias_view", viewMode); } catch {}
  }, [viewMode]);

  // Fecha menu ao clicar fora
  useEffect(() => {
    if (!menuAberto) return;
    const close = () => setMenuAberto(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuAberto]);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await Promise.all([loadCategorias(user.id), loadProdutos(user.id)]);
      setLoading(false);
    };
    load();
  }, []);

  const loadCategorias = async (uid: string) => {
    const { data } = await supabase.from("categorias").select("*").eq("user_id", uid).order("ordem").order("nome");
    if (data) setCategorias(data);
  };

  const loadProdutos = async (uid: string) => {
    const { data } = await supabase.from("produtos").select("categoria").eq("user_id", uid);
    if (data) setProdutos(data);
  };

  const contarProdutos = (nome: string) => produtos.filter(p => p.categoria === nome).length;

  const openNova = () => { setForm({ nome: "", imagem_url: "", ordem: categorias.length }); setShowGaleria(false); setModal(true); };
  const openEditar = (c: Categoria) => { setForm({ ...c }); setShowGaleria(false); setModal(true); };
  const fecharModal = () => { setModal(false); setShowGaleria(false); setForm({ nome: "", imagem_url: "", ordem: 0 }); };

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
    if (!form.imagem_url) return alert("Selecione um ícone para a categoria");
    setSaving(true);
    if (form.id) {
      await supabase.from("categorias").update({ nome: form.nome, imagem_url: form.imagem_url, ordem: form.ordem }).eq("id", form.id);
    } else {
      await supabase.from("categorias").insert({ nome: form.nome, imagem_url: form.imagem_url, ordem: form.ordem, user_id: userId });
    }
    await loadCategorias(userId);
    setSaving(false);
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
      <style>{`@keyframes catspin{to{transform:rotate(360deg)}} .cat-spinner{width:32px;height:32px;border:3px solid var(--primary-light);border-top-color:var(--primary);border-radius:50%;animation:catspin 0.7s linear infinite;display:inline-block;}`}</style>
    </div>
  );

  return (
    <>
    {isStandalone && (
      <AppPageHeader
        title="Categorias"
        subtitle="Organize seus produtos"
        infoIcon="🏷️"
        infoContent={
          <>
            <p>As <strong>categorias organizam seus produtos</strong> por tipo — bolos, cupcakes, doces, salgados, kits, e o que mais fizer sentido pro seu negócio.</p>
            <p>Isso <strong>facilita a busca</strong> no seu cardápio digital pros clientes e pra você mesma no dia a dia.</p>
          </>
        }
        infoTip={<>Crie categorias específicas do seu negócio: "Bolos de casamento", "Kit festa infantil", "Sem lactose", etc.</>}
      />
    )}
    <div className="cat-root">
      {isStandalone ? (
        <div className="cat-header-novo">
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          <BtnNovo label="Nova categoria" onClick={openNova} />
        </div>
      ) : (
        <div className="cat-header">
          <div>
            <h1 className="cat-title">Categorias</h1>
            <p className="cat-sub">{categorias.length} categoria{categorias.length !== 1 ? "s" : ""}</p>
          </div>
          <BtnNovo label="Nova categoria" onClick={openNova} />
        </div>
      )}

      {categorias.length === 0 ? (
        <EmptyDoo
          image="categorias.png"
          title="Vamos organizar seu cardápio?"
          description='Crie categorias como "Bolos", "Doces" ou "Salgados" para que sua confeitaria fique linda e organizada para os clientes!'
          actionLabel="Criar primeira categoria"
          onAction={openNova}
        />
      ) : viewMode === "grid" ? (
        <div className="cat-grid">
          {categorias.map((cat, idx) => {
            const count = contarProdutos(cat.nome);
            const grad = getGradient(cat.nome, idx);
            return (
              <button
                key={cat.id}
                className="cat-grid-card"
                onClick={() => openEditar(cat)}
              >
                {count > 0 && (
                  <div className="cat-grid-badge" style={{ background: grad.badgeBg, color: grad.badgeColor }}>
                    {count}
                  </div>
                )}
                <div className="cat-grid-icon" style={{ background: cat.imagem_url ? grad.bg : "#F5F1F3" }}>
                  {cat.imagem_url
                    ? <img src={cat.imagem_url} alt={cat.nome} />
                    : <span className="cat-grid-icon-placeholder">📦</span>
                  }
                </div>
                <div className="cat-grid-nome">{cat.nome}</div>
                <button
                  className="cat-grid-menu"
                  onClick={e => { e.stopPropagation(); setMenuAberto(menuAberto === cat.id ? null : cat.id!); }}
                  aria-label="Opções"
                >⋮</button>
                {menuAberto === cat.id && (
                  <div className="cat-menu-drop" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { openEditar(cat); setMenuAberto(null); }}>✏️ Editar</button>
                    <button onClick={() => { moverOrdem(cat.id!, -1); setMenuAberto(null); }} disabled={idx === 0}>↑ Subir</button>
                    <button onClick={() => { moverOrdem(cat.id!, 1); setMenuAberto(null); }} disabled={idx === categorias.length - 1}>↓ Descer</button>
                    <button onClick={() => { setDeleteConfirm(cat.id!); setMenuAberto(null); }} className="cat-menu-del">🗑️ Excluir</button>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="cat-list">
          {categorias.map((cat, idx) => {
            const count = contarProdutos(cat.nome);
            const grad = getGradient(cat.nome, idx);
            return (
              <div key={cat.id} className="cat-list-item" onClick={() => openEditar(cat)}>
                <div className="cat-list-icon" style={{ background: cat.imagem_url ? grad.bg : "#F5F1F3", borderStyle: cat.imagem_url ? "solid" : "dashed" }}>
                  {cat.imagem_url
                    ? <img src={cat.imagem_url} alt={cat.nome} />
                    : <span style={{ fontSize: "1.5rem", color: "#B4A9AE" }}>📦</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="cat-list-nome">{cat.nome}</p>
                  <p className="cat-list-sub">{count} produto{count !== 1 ? "s" : ""}</p>
                </div>
                <button
                  className="cat-list-menu"
                  onClick={e => { e.stopPropagation(); setMenuAberto(menuAberto === cat.id ? null : cat.id!); }}
                  aria-label="Opções"
                >⋮</button>
                {menuAberto === cat.id && (
                  <div className="cat-menu-drop cat-menu-drop--lista" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { openEditar(cat); setMenuAberto(null); }}>✏️ Editar</button>
                    <button onClick={() => { moverOrdem(cat.id!, -1); setMenuAberto(null); }} disabled={idx === 0}>↑ Subir</button>
                    <button onClick={() => { moverOrdem(cat.id!, 1); setMenuAberto(null); }} disabled={idx === categorias.length - 1}>↓ Descer</button>
                    <button onClick={() => { setDeleteConfirm(cat.id!); setMenuAberto(null); }} className="cat-menu-del">🗑️ Excluir</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="cat-modal-overlay" onClick={fecharModal}>
          <div className="cat-modal" onClick={e => e.stopPropagation()}>
            <div className="cat-modal-header">
              <h2 className="cat-modal-title">{form.id ? "Editar Categoria" : "Nova Categoria"}</h2>
              <button className="cat-modal-close" onClick={fecharModal}>✕</button>
            </div>
            <div className="cat-modal-body">

              <div className="cat-section">
                <p className="cat-section-label">🖼️ Ícone da Categoria <ReqTag /></p>

                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
                  <div className="cat-icon-preview">
                    {form.imagem_url
                      ? <img src={form.imagem_url} alt="ícone" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%" }} />
                      : <span style={{ fontSize: "2rem" }}>?</span>
                    }
                  </div>
                  <div>
                    <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px" }}>
                      {form.imagem_url ? "Ícone selecionado" : "Nenhum ícone selecionado"}
                    </p>
                    {form.imagem_url && (
                      <button onClick={() => setForm(f => ({ ...f, imagem_url: "" }))} style={{ fontSize: "0.72rem", color: "var(--error)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Remover</button>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                  <button onClick={() => setShowGaleria(false)} style={{ flex: 1, padding: "8px", borderRadius: "10px", border: "2px solid", borderColor: !showGaleria ? "var(--primary)" : "var(--border)", background: !showGaleria ? "var(--primary-light)" : "var(--bg-card)", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 600, color: !showGaleria ? "var(--primary)" : "var(--text-secondary)", cursor: "pointer" }}>
                    📁 Fazer upload
                  </button>
                  <button onClick={() => setShowGaleria(true)} style={{ flex: 1, padding: "8px", borderRadius: "10px", border: "2px solid", borderColor: showGaleria ? "var(--primary)" : "var(--border)", background: showGaleria ? "var(--primary-light)" : "var(--bg-card)", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 600, color: showGaleria ? "var(--primary)" : "var(--text-secondary)", cursor: "pointer" }}>
                    🎨 Ícones do sistema
                  </button>
                </div>

                {!showGaleria && (
                  <div className="cat-upload-area" onClick={() => !uploading && imgRef.current?.click()}>
                    {uploading ? (
                      <span className="cat-spinner-sm" />
                    ) : (
                      <>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Toque para enviar imagem</p>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>PNG transparente recomendado</span>
                      </>
                    )}
                  </div>
                )}

                {showGaleria && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "8px", maxHeight: "240px", overflowY: "auto", padding: "4px" }}>
                    {SYSTEM_ICONS.map((src, i) => (
                      <button key={i} onClick={() => setForm(f => ({ ...f, imagem_url: src }))}
                        style={{ aspectRatio: "1", borderRadius: "10px", border: `2px solid ${form.imagem_url === src ? "var(--primary)" : "var(--border)"}`, background: form.imagem_url === src ? "var(--primary-light)" : "var(--bg-card)", padding: "4px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <img src={src} alt={`ícone ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          onError={e => { e.currentTarget.parentElement!.style.display = "none" }} />
                      </button>
                    ))}
                  </div>
                )}

                <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />
              </div>

              <div className="cat-section">
                <p className="cat-section-label">✏️ Nome <ReqTag /></p>
                <input type="text" placeholder="Ex: Bolos, Doces, Salgados..." value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="cat-input" />
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
              <button onClick={() => handleDelete(deleteConfirm)} style={{ background: "var(--error)", color: "var(--text-inverse)" }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes catspin { to { transform:rotate(360deg); } }
        @keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
        .cat-root { font-family:'Geist', sans-serif; max-width:900px; margin: 0 auto; padding-top: 40px; display:flex; flex-direction:column; gap:1rem; }
        .cat-spinner { width:32px; height:32px; border:3px solid var(--primary-light); border-top-color:var(--primary); border-radius:50%; animation:catspin 0.7s linear infinite; display:inline-block; }
        .cat-spinner-sm { width:18px; height:18px; border:2px solid rgba(255,111,169,0.3); border-top-color:var(--primary); border-radius:50%; animation:catspin 0.7s linear infinite; display:inline-block; }
        .cat-header { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
        .cat-header-novo { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
        .cat-title { font-size: var(--font-page-title); font-weight: var(--fw-bold); color:var(--text-title); margin:0 0 0.15rem; }
        .cat-sub { font-size: var(--font-helper); color:var(--text-muted); margin:0; }
        .cat-btn-novo { display:none; }

        /* ── Toggle Grid/Lista ────────────────────────────── */
        .cat-view-toggle { display: inline-flex; background: #F5F1F3; border-radius: 10px; padding: 3px; gap: 2px; }
        .cat-view-toggle-btn {
          all: unset; cursor: pointer;
          width: 34px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 8px;
          color: #9A8B93;
          transition: background 0.15s, color 0.15s;
        }
        .cat-view-toggle-btn:hover { color: #6B5D64; }
        .cat-view-toggle-btn--ativo {
          background: #fff;
          color: #E85A8C;
          box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        }

        /* ── GRID VIEW ───────────────────────────────────── */
        .cat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
        }
        @media (max-width: 480px) {
          .cat-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
        }
        .cat-grid-card {
          all: unset;
          cursor: pointer;
          background: #fff;
          border-radius: 14px;
          padding: 16px 12px 14px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          transition: transform 0.12s, box-shadow 0.12s;
          box-sizing: border-box;
        }
        .cat-grid-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.1); }
        .cat-grid-card:active { transform: translateY(0); }
        .cat-grid-badge {
          position: absolute;
          top: 8px; left: 8px;
          font-size: 10px; font-weight: 900;
          padding: 3px 8px;
          border-radius: 999px;
          min-width: 20px;
          text-align: center;
          line-height: 1.2;
        }
        .cat-grid-menu {
          all: unset; cursor: pointer;
          position: absolute;
          top: 4px; right: 4px;
          width: 28px; height: 28px;
          border-radius: 8px;
          color: #9A8B93;
          font-size: 18px; font-weight: 900;
          display: flex; align-items: center; justify-content: center;
          line-height: 1;
          transition: background 0.12s, color 0.12s;
        }
        .cat-grid-menu:hover { background: #F5F1F3; color: #2D1F26; }
        .cat-grid-icon {
          width: 72px; height: 72px;
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }
        .cat-grid-icon img { width: 100%; height: 100%; object-fit: contain; }
        .cat-grid-icon-placeholder { font-size: 32px; opacity: 0.4; }
        .cat-grid-nome {
          font-size: 13px; font-weight: 800; color: #2D1F26;
          line-height: 1.25;
          overflow: hidden; text-overflow: ellipsis;
          white-space: nowrap;
          width: 100%;
        }

        /* ── LISTA VIEW ──────────────────────────────────── */
        .cat-list {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        @media (max-width: 640px) {
          .cat-list { grid-template-columns: 1fr; }
        }
        .cat-list-item {
          background: #fff;
          border-radius: 12px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.04);
          cursor: pointer;
          transition: transform 0.12s, box-shadow 0.12s;
          position: relative;
        }
        .cat-list-item:hover { transform: translateX(2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .cat-list-icon {
          width: 56px; height: 56px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
          border: 1.5px solid transparent;
        }
        .cat-list-icon img { width: 100%; height: 100%; object-fit: contain; }
        .cat-list-nome { font-size: 14.5px; font-weight: 800; color: #2D1F26; margin: 0 0 2px; }
        .cat-list-sub { font-size: 12px; color: #6B5D64; margin: 0; }
        .cat-list-menu {
          all: unset; cursor: pointer;
          width: 32px; height: 32px;
          border-radius: 8px;
          color: #6B5D64;
          font-size: 20px;
          display: flex; align-items: center; justify-content: center;
          line-height: 1;
          transition: background 0.12s;
        }
        .cat-list-menu:hover { background: #F5F1F3; color: #2D1F26; }

        /* ── Menu drop (grid + lista) ───────────────────── */
        .cat-menu-drop {
          position: absolute;
          top: 36px; right: 4px;
          background: #fff;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          padding: 4px;
          display: flex;
          flex-direction: column;
          min-width: 140px;
          z-index: 10;
          font-family: 'Geist', sans-serif;
        }
        .cat-menu-drop--lista { top: auto; right: 12px; bottom: 60px; }
        .cat-menu-drop button {
          all: unset;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 600;
          color: #2D1F26;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
          transition: background 0.1s;
        }
        .cat-menu-drop button:hover:not(:disabled) { background: #F5F1F3; }
        .cat-menu-drop button:disabled { opacity: 0.4; cursor: not-allowed; }
        .cat-menu-drop button.cat-menu-del { color: #DC2626; }
        .cat-menu-drop button.cat-menu-del:hover { background: #FEE2E2; }

        /* ── Item antigo (mantido pra compat) ── */
        .cat-item { background:var(--bg-card); border-radius: var(--radius-lg); padding:0.85rem 1rem; display:flex; align-items:center; gap:1rem; box-shadow:var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06)); }
        .cat-item-icon { width:52px; height:52px; border-radius:50%; background:var(--primary-light); border:3px solid var(--primary-light); display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }
        .cat-item-nome { font-size: var(--font-button); font-weight: var(--fw-bold); color:var(--text-title); margin:0 0 1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .cat-item-sub { font-size: var(--font-caption); color:var(--text-muted); margin:0; white-space:nowrap; }
        .cat-item-actions { display:flex; align-items:center; gap:0.25rem; flex-shrink:0; }
        .cat-order-btn { width:28px; height:28px; background:var(--bg-body); border:none; border-radius: var(--radius-sm); cursor:pointer; font-size: var(--font-helper); display:flex; align-items:center; justify-content:center; color:var(--text-secondary); }
        .cat-order-btn:disabled { opacity:0.3; cursor:not-allowed; }
        .cat-edit-btn { padding: var(--space-1) var(--space-3); background: var(--bg-body); border: none; border-radius: var(--radius-sm); font-family: inherit; font-size: var(--font-caption); font-weight: var(--fw-semibold); color: var(--text-primary); cursor: pointer; transition: background var(--dur-fast) var(--ease-out); }
        .cat-del-btn { width: 30px; height: 30px; background: #fff1f2; border: none; border-radius: var(--radius-sm); color: var(--error); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background var(--dur-fast) var(--ease-out); }

        /* ── Modal de Categoria (100% via design tokens) ── */
        .cat-modal-overlay { position: fixed; inset: 0; z-index: 500; background: var(--bg-overlay); display: flex; align-items: flex-end; justify-content: center; }
        .cat-modal { background: var(--bg-card); border-radius: var(--radius-xl) 24px 0 0; width: 100%; max-width: 520px; max-height: 92vh; display: flex; flex-direction: column; animation: slideUp var(--dur-slow) var(--ease-out); }
        @media (min-width: 768px) {
          .cat-modal-overlay { align-items: center; padding: 24px; }
          .cat-modal { border-radius: 16px; max-height: 90vh; animation: fadeInScale var(--dur-slow) var(--ease-out); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        .cat-modal-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4) var(--space-5) var(--space-3); border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .cat-modal-title { font-size: var(--font-modal-title); font-weight: var(--fw-bold); line-height: var(--lh-tight); color: var(--text-title); margin: 0; }
        .cat-modal-close { background: var(--bg-body); border: none; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-muted); font-size: var(--font-caption); transition: background var(--dur-fast) var(--ease-out); }
        .cat-modal-body { flex: 1; overflow-y: auto; padding: var(--pad-modal); display: flex; flex-direction: column; gap: var(--gap-section); }
        .cat-modal-footer { padding: var(--pad-modal); border-top: 1px solid var(--border); display: flex; gap: var(--gap-stack); flex-shrink: 0; }
        .cat-section { display: flex; flex-direction: column; gap: var(--gap-stack); }
        .cat-section-label { font-size: var(--font-section-label); font-weight: var(--fw-bold); line-height: var(--lh-normal); letter-spacing: var(--ls-wide); text-transform: uppercase; color: var(--primary); margin: 0; }
        .cat-icon-preview { width: 72px; height: 72px; border-radius: 50%; border: 3px solid var(--primary-light); background: var(--primary-light); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
        .cat-upload-area { border: 2px dashed var(--primary-light); border-radius: var(--radius-md); background: var(--primary-light); padding: var(--space-5); display: flex; flex-direction: column; align-items: center; gap: var(--space-2); cursor: pointer; transition: border-color var(--dur-fast) var(--ease-out); }
        .cat-upload-area:hover { border-color: var(--primary); }
        .cat-input { padding: var(--pad-input); border: 1.5px solid var(--border); border-radius: var(--radius-md); font-family: inherit; font-size: var(--font-input); font-weight: var(--fw-medium); line-height: var(--lh-normal); color: var(--text-title); outline: none; width: 100%; box-sizing: border-box; background: var(--bg-input); transition: border-color var(--dur-fast) var(--ease-out); }
        .cat-input:focus { border-color: var(--border-focus); }
        .cat-btn-cancelar { flex: 1; padding: var(--space-3); background: var(--bg-body); border: none; border-radius: var(--radius-full); font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-semibold); line-height: var(--lh-normal); color: var(--text-secondary); cursor: pointer; transition: opacity var(--dur-fast) var(--ease-out); }
        .cat-btn-salvar { flex: 2; padding: var(--space-3); background: var(--primary-gradient); color: var(--text-inverse); border: none; border-radius: var(--radius-full); font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-bold); line-height: var(--lh-normal); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: opacity var(--dur-fast) var(--ease-out); }
        .cat-btn-salvar:disabled { opacity: 0.65; cursor: not-allowed; }

        /* ── Modal de confirmação de exclusão ── */
        .cat-confirm { background: var(--bg-card); border-radius: var(--radius-lg); padding: var(--space-6); width: 90%; max-width: 320px; margin: auto; }
        .cat-confirm-title { font-size: var(--font-modal-title); font-weight: var(--fw-bold); line-height: var(--lh-tight); color: var(--text-title); margin: 0 0 var(--space-2); }
        .cat-confirm-sub { font-size: var(--font-helper); font-weight: var(--fw-regular); line-height: var(--lh-normal); color: var(--text-muted); margin: 0 0 var(--space-5); }
        .cat-confirm-btns { display: flex; gap: var(--gap-stack); }
        .cat-confirm-btns button { flex: 1; padding: var(--space-3); border: none; border-radius: var(--radius-full); font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-bold); line-height: var(--lh-normal); cursor: pointer; background: var(--bg-body); color: var(--text-secondary); transition: opacity var(--dur-fast) var(--ease-out); }
      `}</style>
    </div>
    </>
  );
}

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Produto = {
  id?: string;
  user_id?: string;
  nome: string;
  descricao: string;
  preco_normal: number;
  preco_promocional?: number;
  imagem_url?: string;
  categoria: string;
  forma_venda: string;
  disponivel: boolean;
  promocao: boolean;
};

const FORMAS_VENDA = [
  { value: "unidade", label: "Por Unidade" },
  { value: "fatia", label: "Por Fatia" },
  { value: "kg", label: "Por Quilo (kg)" },
  { value: "cento", label: "Por Cento" },
  { value: "tamanho-p", label: "Tamanho P" },
  { value: "tamanho-m", label: "Tamanho M" },
  { value: "tamanho-g", label: "Tamanho G" },
  { value: "tamanho-xg", label: "Tamanho XG" },
  { value: "kit-caixa", label: "Kit / Caixa" },
  { value: "sob-encomenda", label: "Sob Encomenda" },
  { value: "outros", label: "Outros" },
];

const EMPTY: Produto = {
  nome: "", descricao: "", preco_normal: 0,
  imagem_url: "", categoria: "", forma_venda: "unidade",
  disponivel: true, promocao: false,
};

export default function Produtos() {
  const [userId, setUserId] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Produto>(EMPTY);
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [novaCategoria, setNovaCategoria] = useState("");
  const [showCatInput, setShowCatInput] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await loadProdutos(user.id);
      await loadCategorias(user.id);
      setLoading(false);
    };
    load();
  }, []);

  const loadProdutos = async (uid: string) => {
    const { data } = await supabase.from("produtos").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    if (data) setProdutos(data);
  };

  const loadCategorias = async (uid: string) => {
    const { data } = await supabase.from("categorias").select("nome").eq("user_id", uid).order("nome");
    if (data) setCategorias(data.map((c: any) => c.nome));
  };

  const openNovo = () => { setForm(EMPTY); setModal(true); };
  const openEditar = (p: Produto) => { setForm(p); setModal(true); };
  const fecharModal = () => { setModal(false); setForm(EMPTY); };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `produtos/${userId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("products").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("products").getPublicUrl(path);
      setForm(f => ({ ...f, imagem_url: data.publicUrl }));
    }
    setUploading(false);
  };

  const handleSalvar = async () => {
    if (!form.nome.trim()) return alert("Nome é obrigatório");
    if (!form.categoria.trim()) return alert("Categoria é obrigatória");
    if (!form.preco_normal || form.preco_normal <= 0) return alert("Preço deve ser maior que zero");
    setSaving(true);
    if (form.id) {
      await supabase.from("produtos").update({ ...form, updated_at: new Date().toISOString() }).eq("id", form.id);
    } else {
      await supabase.from("produtos").insert({ ...form, user_id: userId });
    }
    await loadProdutos(userId);
    setSaving(false);
    fecharModal();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("produtos").delete().eq("id", id);
    setProdutos(p => p.filter(x => x.id !== id));
    setDeleteConfirm(null);
  };

  const handleAdicionarCategoria = async () => {
    if (!novaCategoria.trim() || !userId) return;
    await supabase.from("categorias").insert({ nome: novaCategoria.trim(), user_id: userId });
    setCategorias(prev => [...prev, novaCategoria.trim()].sort());
    setForm(f => ({ ...f, categoria: novaCategoria.trim() }));
    setNovaCategoria("");
    setShowCatInput(false);
  };

  const formatPreco = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parsePreco = (s: string) => (parseInt(s.replace(/\D/g, "")) || 0) / 100;

  const produtosFiltrados = filtroCategoria === "todas"
    ? produtos
    : produtos.filter(p => p.categoria === filtroCategoria);

  const todasCategorias = Array.from(new Set([...categorias, ...produtos.map(p => p.categoria).filter(Boolean)])).sort();

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh" }}>
      <span className="prod-spinner" />
    </div>
  );

  return (
    <div className="prod-root">

      {/* Header */}
      <div className="prod-header">
        <div>
          <h1 className="prod-title">Produtos</h1>
          <p className="prod-sub">{produtos.length} produto{produtos.length !== 1 ? "s" : ""} cadastrado{produtos.length !== 1 ? "s" : ""}</p>
        </div>
        <button className="prod-btn-novo" onClick={openNovo}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo produto
        </button>
      </div>

      {/* Filtros categoria */}
      {todasCategorias.length > 0 && (
        <div className="prod-filtros">
          <button className={`prod-filtro-btn${filtroCategoria === "todas" ? " active" : ""}`} onClick={() => setFiltroCategoria("todas")}>
            Todos ({produtos.length})
          </button>
          {todasCategorias.map(cat => (
            <button key={cat} className={`prod-filtro-btn${filtroCategoria === cat ? " active" : ""}`} onClick={() => setFiltroCategoria(cat)}>
              {cat} ({produtos.filter(p => p.categoria === cat).length})
            </button>
          ))}
        </div>
      )}

      {/* Lista de produtos */}
      {produtosFiltrados.length === 0 ? (
        <div className="prod-empty">
          <span style={{ fontSize: "3rem" }}>🎂</span>
          <p className="prod-empty-title">Nenhum produto ainda</p>
          <p className="prod-empty-sub">Cadastre seu primeiro produto para aparecer no cardápio</p>
          <button className="prod-btn-novo" onClick={openNovo}>+ Cadastrar produto</button>
        </div>
      ) : (
        <div className="prod-grid">
          {produtosFiltrados.map(p => (
            <div key={p.id} className="prod-card">
              <div className="prod-card-img" onClick={() => openEditar(p)}>
                {p.imagem_url
                  ? <img src={p.imagem_url} alt={p.nome} />
                  : <span style={{ fontSize: "2rem" }}>🎂</span>
                }
                {!p.disponivel && <div className="prod-card-indisponivel">Indisponível</div>}
                {p.promocao && <div className="prod-card-promo">Promoção</div>}
              </div>
              <div className="prod-card-info">
                <p className="prod-card-cat">{p.categoria}</p>
                <p className="prod-card-nome">{p.nome}</p>
                <p className="prod-card-preco">R$ {formatPreco(p.preco_normal)}</p>
                <p className="prod-card-forma">{FORMAS_VENDA.find(f => f.value === p.forma_venda)?.label || p.forma_venda}</p>
              </div>
              <div className="prod-card-actions">
                <button className="prod-card-btn-edit" onClick={() => openEditar(p)}>Editar</button>
                <button className="prod-card-btn-del" onClick={() => setDeleteConfirm(p.id!)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal novo/editar */}
      {modal && (
        <div className="prod-modal-overlay" onClick={fecharModal}>
          <div className="prod-modal" onClick={e => e.stopPropagation()}>
            <div className="prod-modal-header">
              <h2 className="prod-modal-title">{form.id ? "Editar Produto" : "Novo Produto"}</h2>
              <button className="prod-modal-close" onClick={fecharModal}>✕</button>
            </div>

            <div className="prod-modal-body">
              {/* Foto */}
              <div className="prod-section">
                <p className="prod-section-label">📸 Foto do Produto</p>
                <div className="prod-img-upload" onClick={() => !uploading && imgRef.current?.click()}>
                  {form.imagem_url ? (
                    <img src={form.imagem_url} alt="produto" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div className="prod-img-placeholder">
                      {uploading ? <span className="prod-spinner" /> : (
                        <>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F583BF" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          <p>Toque para enviar foto</p>
                          <span>JPG, PNG ou WEBP</span>
                        </>
                      )}
                    </div>
                  )}
                  {form.imagem_url && (
                    <button className="prod-img-remove" onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, imagem_url: "" })); }}>✕</button>
                  )}
                </div>
                <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />
              </div>

              {/* Informações */}
              <div className="prod-section">
                <p className="prod-section-label">✏️ Informações</p>
                <div className="prod-field">
                  <label>Nome do Produto *</label>
                  <input type="text" placeholder="Ex: Bolo de Morango" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
                </div>
                <div className="prod-field">
                  <label>Categoria *</label>
                  <select value={form.categoria} onChange={e => { if (e.target.value === "__nova__") setShowCatInput(true); else setForm(f => ({ ...f, categoria: e.target.value })); }}>
                    <option value="">Selecione...</option>
                    {todasCategorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    <option value="__nova__">+ Criar nova categoria</option>
                  </select>
                  {showCatInput && (
                    <div className="prod-nova-cat">
                      <input type="text" placeholder="Nome da categoria" value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdicionarCategoria()} autoFocus />
                      <button onClick={handleAdicionarCategoria}>Criar</button>
                      <button onClick={() => setShowCatInput(false)} style={{ background: "#f3f4f6", color: "#6b7280" }}>✕</button>
                    </div>
                  )}
                </div>
                <div className="prod-field">
                  <label>Descrição</label>
                  <textarea placeholder="Descreva os ingredientes, sabor, tamanho..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={4} />
                </div>
              </div>

              {/* Preço e Venda */}
              <div className="prod-section">
                <p className="prod-section-label">💰 Preço e Venda</p>
                <div className="prod-row-2">
                  <div className="prod-field">
                    <label>Preço *</label>
                    <div className="prod-preco-input">
                      <span>R$</span>
                      <input type="text" placeholder="0,00" value={form.preco_normal ? formatPreco(form.preco_normal) : ""} onChange={e => setForm(f => ({ ...f, preco_normal: parsePreco(e.target.value) }))} />
                    </div>
                  </div>
                  <div className="prod-field">
                    <label>Vendido por</label>
                    <select value={form.forma_venda} onChange={e => setForm(f => ({ ...f, forma_venda: e.target.value }))}>
                      {FORMAS_VENDA.map(fv => <option key={fv.value} value={fv.value}>{fv.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Toggles */}
                <div className="prod-toggles">
                  <div className={`prod-toggle-item${form.disponivel ? " active-green" : ""}`} onClick={() => setForm(f => ({ ...f, disponivel: !f.disponivel }))}>
                    <div className="prod-toggle-slider">
                      <div className="prod-toggle-thumb" style={{ transform: form.disponivel ? "translateX(20px)" : "translateX(0)" }} />
                    </div>
                    <span>Disponível</span>
                  </div>
                  <div className={`prod-toggle-item${form.promocao ? " active-pink" : ""}`} onClick={() => setForm(f => ({ ...f, promocao: !f.promocao }))}>
                    <div className="prod-toggle-slider" style={{ background: form.promocao ? "#F583BF" : "#e5e7eb" }}>
                      <div className="prod-toggle-thumb" style={{ transform: form.promocao ? "translateX(20px)" : "translateX(0)" }} />
                    </div>
                    <span>Promoção</span>
                  </div>
                </div>

                {form.promocao && (
                  <div className="prod-field">
                    <label>Preço Promocional</label>
                    <div className="prod-preco-input">
                      <span>R$</span>
                      <input type="text" placeholder="0,00" value={form.preco_promocional ? formatPreco(form.preco_promocional) : ""} onChange={e => setForm(f => ({ ...f, preco_promocional: parsePreco(e.target.value) }))} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="prod-modal-footer">
              <button className="prod-btn-cancelar" onClick={fecharModal}>Cancelar</button>
              <button className="prod-btn-salvar" onClick={handleSalvar} disabled={saving}>
                {saving ? <span className="prod-spinner-sm" /> : (form.id ? "Salvar alterações" : "Publicar produto")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {deleteConfirm && (
        <div className="prod-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="prod-confirm" onClick={e => e.stopPropagation()}>
            <p className="prod-confirm-title">Excluir produto?</p>
            <p className="prod-confirm-sub">Esta ação não pode ser desfeita.</p>
            <div className="prod-confirm-btns">
              <button onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ background: "#ef4444", color: "white" }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .prod-root { font-family:'Inter',sans-serif; max-width:800px; display:flex; flex-direction:column; gap:1rem; }
        .prod-spinner { width:32px; height:32px; border:3px solid #fce7f3; border-top-color:#F583BF; border-radius:50%; animation:pspin 0.7s linear infinite; display:inline-block; }
        .prod-spinner-sm { width:18px; height:18px; border:2px solid rgba(255,255,255,0.4); border-top-color:white; border-radius:50%; animation:pspin 0.7s linear infinite; display:inline-block; }
        @keyframes pspin { to { transform:rotate(360deg); } }

        .prod-header { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
        .prod-title { font-size:1.3rem; font-weight:700; color:var(--text-primary,#1f2937); margin:0 0 0.15rem; }
        .prod-sub { font-size:0.82rem; color:var(--text-muted,#9ca3af); margin:0; }

        .prod-btn-novo { display:flex; align-items:center; gap:0.4rem; padding:0.7rem 1.2rem; background:linear-gradient(135deg,#F583BF,#e060a8); color:white; border:none; border-radius:50px; font-family:'Inter',sans-serif; font-size:0.88rem; font-weight:700; cursor:pointer; white-space:nowrap; }

        .prod-filtros { display:flex; gap:0.5rem; flex-wrap:wrap; }
        .prod-filtro-btn { padding:0.35rem 0.85rem; border:1.5px solid var(--border,#e5e7eb); border-radius:20px; background:var(--bg-card,white); font-family:'Inter',sans-serif; font-size:0.78rem; font-weight:500; color:var(--text-secondary,#6b7280); cursor:pointer; }
        .prod-filtro-btn.active { border-color:#F583BF; color:#F583BF; background:#fdf2f8; font-weight:700; }

        .prod-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.75rem; padding:3rem 1rem; text-align:center; }
        .prod-empty-title { font-size:1rem; font-weight:700; color:var(--text-primary,#1f2937); margin:0; }
        .prod-empty-sub { font-size:0.82rem; color:var(--text-muted,#9ca3af); margin:0; }

        .prod-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:0.75rem; }
        .prod-card { background:var(--bg-card,white); border-radius:16px; overflow:hidden; box-shadow:var(--shadow-card,0 2px 8px rgba(0,0,0,0.06)); display:flex; flex-direction:column; }
        .prod-card-img { aspect-ratio:1; background:var(--bg-subtle,#f9fafb); display:flex; align-items:center; justify-content:center; cursor:pointer; position:relative; overflow:hidden; }
        .prod-card-img img { width:100%; height:100%; object-fit:cover; }
        .prod-card-indisponivel { position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; color:white; font-size:0.72rem; font-weight:700; }
        .prod-card-promo { position:absolute; top:0.4rem; left:0.4rem; background:#F583BF; color:white; font-size:0.65rem; font-weight:700; padding:0.15rem 0.45rem; border-radius:20px; }
        .prod-card-info { padding:0.65rem 0.75rem; flex:1; }
        .prod-card-cat { font-size:0.68rem; color:#F583BF; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin:0 0 0.15rem; }
        .prod-card-nome { font-size:0.85rem; font-weight:700; color:var(--text-primary,#1f2937); margin:0 0 0.25rem; line-height:1.3; }
        .prod-card-preco { font-size:0.88rem; font-weight:800; color:#22c55e; margin:0 0 0.1rem; }
        .prod-card-forma { font-size:0.7rem; color:var(--text-muted,#9ca3af); margin:0; }
        .prod-card-actions { display:flex; gap:0.4rem; padding:0.5rem 0.75rem; border-top:1px solid var(--border,#f3f4f6); }
        .prod-card-btn-edit { flex:1; padding:0.4rem; background:var(--bg-subtle,#f9fafb); border:none; border-radius:8px; font-family:'Inter',sans-serif; font-size:0.78rem; font-weight:600; color:var(--text-secondary,#374151); cursor:pointer; }
        .prod-card-btn-del { padding:0.4rem 0.6rem; background:#fff1f2; border:none; border-radius:8px; color:#ef4444; cursor:pointer; display:flex; align-items:center; }

        /* Modal */
        .prod-modal-overlay { position:fixed; inset:0; z-index:500; background:rgba(0,0,0,0.5); display:flex; align-items:flex-end; justify-content:center; }
        .prod-modal { background:var(--bg-card,white); border-radius:24px 24px 0 0; width:100%; max-width:520px; max-height:92vh; display:flex; flex-direction:column; animation:slideUp 0.25s ease; }
        @keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
        .prod-modal-header { display:flex; align-items:center; justify-content:space-between; padding:1.1rem 1.25rem 0.75rem; border-bottom:1px solid var(--border,#f3f4f6); flex-shrink:0; }
        .prod-modal-title { font-size:1rem; font-weight:700; color:var(--text-primary,#1f2937); margin:0; }
        .prod-modal-close { background:var(--bg-subtle,#f3f4f6); border:none; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text-muted,#6b7280); font-size:0.75rem; }
        .prod-modal-body { flex:1; overflow-y:auto; padding:1rem 1.25rem; display:flex; flex-direction:column; gap:1.25rem; }
        .prod-modal-footer { padding:1rem 1.25rem; border-top:1px solid var(--border,#f3f4f6); display:flex; gap:0.75rem; flex-shrink:0; }

        .prod-section { display:flex; flex-direction:column; gap:0.75rem; }
        .prod-section-label { font-size:0.78rem; font-weight:700; color:#F583BF; text-transform:uppercase; letter-spacing:0.06em; margin:0; }

        .prod-img-upload { width:120px; height:120px; border-radius:16px; border:2px dashed #fce7f3; background:#fdf2f8; cursor:pointer; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; }
        .prod-img-placeholder { display:flex; flex-direction:column; align-items:center; gap:0.35rem; padding:0.75rem; text-align:center; }
        .prod-img-placeholder p { font-size:0.78rem; font-weight:600; color:#374151; margin:0; }
        .prod-img-placeholder span { font-size:0.68rem; color:#9ca3af; }
        .prod-img-remove { position:absolute; top:0.35rem; right:0.35rem; background:rgba(0,0,0,0.5); border:none; border-radius:50%; width:22px; height:22px; color:white; font-size:0.65rem; cursor:pointer; display:flex; align-items:center; justify-content:center; }

        .prod-field { display:flex; flex-direction:column; gap:0.3rem; }
        .prod-field label { font-size:0.78rem; font-weight:600; color:var(--text-secondary,#374151); }
        .prod-field input, .prod-field select, .prod-field textarea { padding:0.65rem 0.9rem; border:1.5px solid var(--border,#e5e7eb); border-radius:12px; font-family:'Inter',sans-serif; font-size:0.88rem; color:var(--text-primary,#1f2937); background:var(--bg-input,white); outline:none; transition:border-color 0.2s; width:100%; box-sizing:border-box; }
        .prod-field input:focus, .prod-field select:focus, .prod-field textarea:focus { border-color:#F583BF; }
        .prod-field textarea { resize:none; }

        .prod-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; }
        .prod-preco-input { display:flex; align-items:center; border:1.5px solid var(--border,#e5e7eb); border-radius:12px; overflow:hidden; background:var(--bg-input,white); }
        .prod-preco-input span { padding:0 0.75rem; font-weight:700; color:#22c55e; font-size:0.88rem; flex-shrink:0; }
        .prod-preco-input input { border:none !important; border-radius:0 !important; flex:1; padding:0.65rem 0.5rem 0.65rem 0 !important; }
        .prod-preco-input:focus-within { border-color:#F583BF; }

        .prod-nova-cat { display:flex; gap:0.4rem; margin-top:0.4rem; }
        .prod-nova-cat input { flex:1; padding:0.55rem 0.8rem; border:1.5px solid #F583BF; border-radius:10px; font-family:'Inter',sans-serif; font-size:0.85rem; outline:none; }
        .prod-nova-cat button { padding:0.55rem 0.9rem; background:linear-gradient(135deg,#F583BF,#e060a8); color:white; border:none; border-radius:10px; font-family:'Inter',sans-serif; font-size:0.82rem; font-weight:700; cursor:pointer; white-space:nowrap; }

        .prod-toggles { display:flex; gap:0.75rem; flex-wrap:wrap; }
        .prod-toggle-item { display:flex; align-items:center; gap:0.6rem; padding:0.65rem 1rem; border-radius:12px; background:var(--bg-subtle,#f3f4f6); cursor:pointer; font-size:0.85rem; font-weight:600; color:var(--text-secondary,#374151); transition:all 0.2s; flex:1; min-width:120px; }
        .prod-toggle-item.active-green { background:#dcfce7; color:#15803d; }
        .prod-toggle-item.active-pink { background:#fce7f3; color:#be185d; }
        .prod-toggle-slider { width:40px; height:22px; border-radius:11px; background:#e5e7eb; position:relative; flex-shrink:0; transition:background 0.2s; }
        .prod-toggle-item.active-green .prod-toggle-slider { background:#22c55e; }
        .prod-toggle-thumb { width:18px; height:18px; border-radius:50%; background:white; position:absolute; top:2px; left:2px; transition:transform 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.2); }

        .prod-btn-ia { display:inline-flex; align-items:center; gap:0.3rem; padding:0.25rem 0.65rem; background:linear-gradient(135deg,#F583BF,#e060a8); color:white; border:none; border-radius:20px; font-family:'Inter',sans-serif; font-size:0.72rem; font-weight:700; cursor:pointer; transition:opacity 0.2s; white-space:nowrap; }
        .prod-btn-ia:disabled { opacity:0.5; cursor:not-allowed; }
        .prod-btn-ia:hover:not(:disabled) { opacity:0.9; }
        .prod-spinner-xs { width:10px; height:10px; border:2px solid rgba(255,255,255,0.4); border-top-color:white; border-radius:50%; animation:pspin 0.7s linear infinite; display:inline-block; flex-shrink:0; } flex:1; padding:0.85rem; background:var(--bg-subtle,#f3f4f6); border:none; border-radius:50px; font-family:'Inter',sans-serif; font-size:0.9rem; font-weight:600; color:var(--text-secondary,#374151); cursor:pointer; }
        .prod-btn-salvar { flex:2; padding:0.85rem; background:linear-gradient(135deg,#F583BF,#e060a8); color:white; border:none; border-radius:50px; font-family:'Inter',sans-serif; font-size:0.9rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .prod-btn-salvar:disabled { opacity:0.65; cursor:not-allowed; }

        .prod-confirm { background:var(--bg-card,white); border-radius:18px; padding:1.5rem; width:90%; max-width:320px; margin:auto; }
        .prod-confirm-title { font-size:1rem; font-weight:700; color:var(--text-primary,#1f2937); margin:0 0 0.4rem; }
        .prod-confirm-sub { font-size:0.82rem; color:var(--text-muted,#9ca3af); margin:0 0 1.25rem; }
        .prod-confirm-btns { display:flex; gap:0.75rem; }
        .prod-confirm-btns button { flex:1; padding:0.75rem; border:none; border-radius:50px; font-family:'Inter',sans-serif; font-size:0.88rem; font-weight:700; cursor:pointer; background:var(--bg-subtle,#f3f4f6); color:var(--text-secondary,#374151); }

        :root.dark .prod-toggle-item { background:rgba(255,255,255,0.05); }
        :root.dark .prod-toggle-item.active-green { background:rgba(34,197,94,0.15); color:#4ade80; }
        :root.dark .prod-toggle-item.active-pink { background:rgba(245,131,191,0.15); color:#F583BF; }
      `}</style>
    </div>
  );
}

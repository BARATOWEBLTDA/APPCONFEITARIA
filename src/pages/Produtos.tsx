import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { usePlano } from "@/hooks/usePlano";

type Tamanho = { label: string; preco: number };

type KitItem = { nome: string; quantidade: string };

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
  permite_personalizacao?: boolean;
  massas_disponiveis?: string[];
  recheios_disponiveis?: string[];
  coberturas_disponiveis?: string[];
  tamanhos_disponiveis?: Tamanho[];
  pronta_entrega?: boolean;
  kit_itens?: KitItem[];
  kit_serve_pessoas?: string;
  kit_prazo_encomenda?: string;
};

const FORMAS_VENDA = [
  { value: "unidade", label: "Por Unidade" },
  { value: "fatia", label: "Por Fatia" },
  { value: "kg", label: "Por Quilo (kg)" },
  { value: "cento", label: "Por Cento" },
  { value: "tamanho", label: "Por Tamanho (P/M/G)" },
  { value: "kit-caixa", label: "Kit / Caixa" },
  { value: "sob-encomenda", label: "Sob Encomenda" },
  { value: "outros", label: "Outros" },
];

const EMPTY: Produto = {
  nome: "", descricao: "", preco_normal: 0,
  imagem_url: "", categoria: "", forma_venda: "unidade",
  disponivel: true, promocao: false,
  permite_personalizacao: false,
  massas_disponiveis: [], recheios_disponiveis: [], coberturas_disponiveis: [],
  tamanhos_disponiveis: [], pronta_entrega: true,
  kit_itens: [], kit_serve_pessoas: "", kit_prazo_encomenda: "",
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
  const [novaOpcao, setNovaOpcao] = useState<{ massa: string; recheio: string; cobertura: string }>({ massa: "", recheio: "", cobertura: "" });
  const [novoTamanho, setNovoTamanho] = useState({ label: "", preco: "" });
  const [novoKitItem, setNovoKitItem] = useState({ nome: "", quantidade: "" });
  const imgRef = useRef<HTMLInputElement>(null);
  const img2Ref = useRef<HTMLInputElement>(null);
  const img3Ref = useRef<HTMLInputElement>(null);
  const { isPro } = usePlano();

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
  const openEditar = (p: Produto) => { setForm({ ...EMPTY, ...p }); setModal(true); };
  const fecharModal = () => { setModal(false); setForm(EMPTY); };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, slot: number = 0) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `produtos/${userId}-${Date.now()}-${slot}.${ext}`;
    const { error } = await supabase.storage.from("products").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("products").getPublicUrl(path);
      const url = data.publicUrl;
      setForm(f => {
        const imgs = (f.imagem_url || "").split(",").map(s => s.trim()).filter(Boolean);
        imgs[slot] = url;
        return { ...f, imagem_url: imgs.join(",") };
      });
    }
    setUploading(false);
  };

  const removeImage = (slot: number) => {
    setForm(f => {
      const imgs = (f.imagem_url || "").split(",").map(s => s.trim()).filter(Boolean);
      imgs[slot] = "";
      return { ...f, imagem_url: imgs.filter(Boolean).join(",") };
    });
  };

  const handleSalvar = async () => {
    if (!form.nome.trim()) return alert("Nome é obrigatório");
    if (!form.categoria.trim()) return alert("Categoria é obrigatória");
    if (!form.preco_normal || form.preco_normal <= 0) return alert("Preço deve ser maior que zero");
    setSaving(true);
    const payload = { ...form, updated_at: new Date().toISOString() };
    if (form.id) {
      await supabase.from("produtos").update(payload).eq("id", form.id);
    } else {
      await supabase.from("produtos").insert({ ...payload, user_id: userId });
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
    setNovaCategoria(""); setShowCatInput(false);
  };

  const addOpcao = (campo: "massas_disponiveis" | "recheios_disponiveis" | "coberturas_disponiveis", key: "massa" | "recheio" | "cobertura") => {
    const val = novaOpcao[key].trim();
    if (!val) return;
    setForm(f => ({ ...f, [campo]: [...(f[campo] || []), val] }));
    setNovaOpcao(o => ({ ...o, [key]: "" }));
  };

  const removeOpcao = (campo: "massas_disponiveis" | "recheios_disponiveis" | "coberturas_disponiveis", idx: number) => {
    setForm(f => ({ ...f, [campo]: (f[campo] || []).filter((_: string, i: number) => i !== idx) }));
  };

  const addTamanho = () => {
    if (!novoTamanho.label.trim() || !novoTamanho.preco) return;
    const preco = parseFloat(novoTamanho.preco.replace(",", "."));
    if (isNaN(preco)) return;
    setForm(f => ({ ...f, tamanhos_disponiveis: [...(f.tamanhos_disponiveis || []), { label: novoTamanho.label.trim(), preco }] }));
    setNovoTamanho({ label: "", preco: "" });
  };

  const removeTamanho = (idx: number) => {
    setForm(f => ({ ...f, tamanhos_disponiveis: (f.tamanhos_disponiveis || []).filter((_, i) => i !== idx) }));
  };

  const formatPreco = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parsePreco = (s: string) => (parseInt(s.replace(/\D/g, "")) || 0) / 100;

  const produtosFiltrados = filtroCategoria === "todas" ? produtos : produtos.filter(p => p.categoria === filtroCategoria);
  const todasCategorias = Array.from(new Set([...categorias, ...produtos.map(p => p.categoria).filter(Boolean)])).sort();

  const Toggle = ({ label, value, onChange, colorClass }: any) => (
    <div className={`prod-toggle-item${value ? ` ${colorClass}` : ""}`} onClick={() => onChange(!value)}>
      <div className={`prod-toggle-slider${value ? " active" : ""}`} style={{ background: value ? (colorClass === "active-green" ? "#22c55e" : "#F583BF") : "#e5e7eb" }}>
        <div className="prod-toggle-thumb" style={{ transform: value ? "translateX(20px)" : "translateX(0)" }} />
      </div>
      <span>{label}</span>
    </div>
  );

  const TagList = ({ items, onRemove }: { items: string[], onRemove: (i: number) => void }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "#fce7f3", color: "#be185d", borderRadius: "50px", fontSize: "0.8rem", fontWeight: 600 }}>
          {item}
          <button onClick={() => onRemove(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#be185d", padding: 0, lineHeight: 1, fontSize: "0.85rem" }}>×</button>
        </span>
      ))}
    </div>
  );

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh" }}><span className="prod-spinner" /></div>;

  return (
    <div className="prod-root">
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

      {/* Aviso de produtos sem categoria válida */}
      {(() => {
        const orfaos = produtos.filter(p => p.categoria && !categorias.includes(p.categoria));
        if (orfaos.length === 0) return null;
        return (
          <div style={{ background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: "14px", padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#92400e", margin: "0 0 2px" }}>
                {orfaos.length} produto{orfaos.length !== 1 ? "s" : ""} com categoria inexistente
              </p>
              <p style={{ fontSize: "0.75rem", color: "#b45309", margin: 0 }}>
                Esses produtos aparecem apenas em "Todos" no cardápio. Edite-os e selecione uma categoria válida.
              </p>
            </div>
            <button onClick={() => setFiltroCategoria("__orfaos__")} style={{ padding: "5px 12px", background: "#f59e0b", color: "white", border: "none", borderRadius: "8px", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              Ver {orfaos.length}
            </button>
          </div>
        );
      })()}

      {todasCategorias.length > 0 && (
        <div className="prod-filtros">
          <button className={`prod-filtro-btn${filtroCategoria === "todas" ? " active" : ""}`} onClick={() => setFiltroCategoria("todas")}>Todos ({produtos.length})</button>
          {todasCategorias.map(cat => (
            <button key={cat} className={`prod-filtro-btn${filtroCategoria === cat ? " active" : ""}`} onClick={() => setFiltroCategoria(cat)}>
              {cat} ({produtos.filter(p => p.categoria === cat).length})
            </button>
          ))}
        </div>
      )}

      {produtosFiltrados.length === 0 ? (
        <div className="prod-empty">
          <span style={{ fontSize: "3rem" }}>🎂</span>
          <p className="prod-empty-title">Nenhum produto ainda</p>
          <p className="prod-empty-sub">Cadastre seu primeiro produto para aparecer no cardápio</p>
        </div>
      ) : (
        <div className="prod-grid">
          {(filtroCategoria === "__orfaos__"
            ? produtos.filter(p => p.categoria && !categorias.includes(p.categoria))
            : produtosFiltrados
          ).map(p => {
            const catInvalida = p.categoria && !categorias.includes(p.categoria);
            return (
            <div key={p.id} className="prod-card" style={{ outline: catInvalida ? "2px solid #fcd34d" : "none" }}>
              <div className="prod-card-img" onClick={() => openEditar(p)}>
                {p.imagem_url ? <img src={p.imagem_url.split(",")[0]} alt={p.nome} /> : <span style={{ fontSize: "2rem" }}>🎂</span>}
                {!p.disponivel && <div className="prod-card-indisponivel">Indisponível</div>}
                {p.promocao && <div className="prod-card-promo">Promoção</div>}
                {p.pronta_entrega === false && <div className="prod-card-encomenda">Encomenda</div>}
                {catInvalida && <div style={{ position: "absolute", top: "0.4rem", left: "0.4rem", background: "#f59e0b", color: "white", fontSize: "0.6rem", fontWeight: 700, padding: "2px 6px", borderRadius: "6px" }}>⚠️ Sem categoria</div>}
              </div>
              <div className="prod-card-info">
                <p className="prod-card-cat" style={{ color: catInvalida ? "#f59e0b" : undefined }}>{catInvalida ? `⚠️ ${p.categoria}` : p.categoria}</p>
                <p className="prod-card-nome">{p.nome}</p>
                <p className="prod-card-preco">R$ {formatPreco(p.preco_normal)}</p>
              </div>
              <div className="prod-card-actions">
                <button className="prod-card-btn-edit" onClick={() => openEditar(p)}>Editar</button>
                <button className="prod-card-btn-del" onClick={() => setDeleteConfirm(p.id!)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

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
                <p className="prod-section-label">📸 Fotos do Produto</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                  {[0, 1, 2].map(slot => {
                    const imgs = (form.imagem_url || "").split(",").map(s => s.trim()).filter(Boolean);
                    const imgUrl = imgs[slot];
                    const isLocked = slot > 0 && !isPro;
                    const ref = slot === 0 ? imgRef : slot === 1 ? img2Ref : img3Ref;
                    return (
                      <div key={slot} style={{ position: "relative" }}>
                        {slot > 0 && <span style={{ fontSize: "0.65rem", color: "#9ca3af", display: "block", marginBottom: "3px", textAlign: "center" }}>Foto {slot + 1}</span>}
                        {slot === 0 && <span style={{ fontSize: "0.65rem", color: "#9ca3af", display: "block", marginBottom: "3px", textAlign: "center" }}>Principal</span>}
                        <div
                          className="prod-img-upload"
                          style={{ width: "100%", height: "90px", borderRadius: "12px", cursor: isLocked ? "default" : "pointer", position: "relative", overflow: "hidden", background: slot > 0 ? "#f0f4ff" : undefined, border: slot > 0 ? "2px dashed #c7d2fe" : undefined }}
                          onClick={() => !isLocked && !uploading && ref.current?.click()}
                        >
                          {imgUrl ? (
                            <>
                              <img src={imgUrl} alt={`foto ${slot + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              {!isLocked && <button className="prod-img-remove" onClick={e => { e.stopPropagation(); removeImage(slot); }}>✕</button>}
                            </>
                          ) : isLocked ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: "4px" }}>
                              <img src="/diamante.png" alt="PRO" style={{ width: "20px", height: "20px" }} />
                              <span style={{ fontSize: "0.6rem", color: "#9ca3af", textAlign: "center" }}>PRO</span>
                            </div>
                          ) : (
                            <div className="prod-img-placeholder">
                              {uploading ? <span className="prod-spinner" /> : (
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                              )}
                            </div>
                          )}
                          {/* Faixa PRO diagonal — sempre nos slots extras */}
                          {slot > 0 && (
                            <div style={{ position: "absolute", top: "10px", right: "-16px", background: "linear-gradient(135deg,#ec4899,#f472b6)", color: "white", fontSize: "0.55rem", fontWeight: 900, padding: "2px 20px", transform: "rotate(45deg)", zIndex: 10, width: "70px", textAlign: "center" }}>PRO</div>
                          )}
                        </div>
                        <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageUpload(e, slot)} />
                      </div>
                    );
                  })}
                </div>
                {!isPro && <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: "4px 0 0", textAlign: "center" }}>Fotos 2 e 3 disponíveis no plano PRO</p>}
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
                  <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {todasCategorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  {todasCategorias.length === 0 && (
                    <p style={{ fontSize: "0.75rem", color: "#f59e0b", margin: "4px 0 0" }}>⚠️ Nenhuma categoria cadastrada. Acesse a aba <strong>Categorias</strong> para criar.</p>
                  )}
                </div>
                <div className="prod-field">
                  <label>Descrição</label>
                  <textarea placeholder="Descreva os ingredientes, sabor, tamanho..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} />
                </div>
              </div>

              {/* Preço e Venda */}
              <div className="prod-section">
                <p className="prod-section-label">💰 Preço e Venda</p>
                <div className="prod-row-2">
                  <div className="prod-field">
                    <label>Preço base *</label>
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

                {/* Tamanhos personalizados */}
                <div className="prod-field">
                  <label>Tamanhos / Pesos disponíveis <span style={{ color: "#9ca3af", fontWeight: 400 }}>(opcional)</span></label>
                  <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: "0 0 6px" }}>Ex: 500g, 1kg, 2kg, Pequeno, Grande...</p>
                  {(form.tamanhos_disponiveis || []).map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "#fdf2f8", borderRadius: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>{t.label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "0.82rem", color: "#22c55e", fontWeight: 700 }}>R$ {t.preco.toFixed(2).replace(".", ",")}</span>
                        <button onClick={() => removeTamanho(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "1rem", padding: 0 }}>×</button>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                    <input type="text" placeholder="Ex: 1kg" value={novoTamanho.label} onChange={e => setNovoTamanho(t => ({ ...t, label: e.target.value }))} style={{ flex: 2, padding: "0.5rem 0.75rem", border: "1.5px solid #e5e7eb", borderRadius: "10px", fontSize: "0.82rem", fontFamily: "Inter, sans-serif", outline: "none" }} />
                    <input type="text" placeholder="Preço" value={novoTamanho.preco} onChange={e => setNovoTamanho(t => ({ ...t, preco: e.target.value }))} style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1.5px solid #e5e7eb", borderRadius: "10px", fontSize: "0.82rem", fontFamily: "Inter, sans-serif", outline: "none" }} />
                    <button onClick={addTamanho} style={{ padding: "0.5rem 0.85rem", background: "#F583BF", color: "white", border: "none", borderRadius: "10px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>+ Add</button>
                  </div>
                </div>

                <div className="prod-toggles">
                  <Toggle label="Disponível" value={form.disponivel} onChange={(v: boolean) => setForm(f => ({ ...f, disponivel: v }))} colorClass="active-green" />
                  <Toggle label="Promoção" value={form.promocao} onChange={(v: boolean) => setForm(f => ({ ...f, promocao: v }))} colorClass="active-pink" />
                </div>

                <div className="prod-toggles">
                  <Toggle label="Pronta entrega" value={form.pronta_entrega !== false} onChange={(v: boolean) => setForm(f => ({ ...f, pronta_entrega: v }))} colorClass="active-green" />
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

              {/* Kit Festa */}
              {form.forma_venda === "kit-caixa" && (
                <div className="prod-section">
                  <p className="prod-section-label">🎉 Itens do Kit</p>
                  <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: "0" }}>Liste o que está incluso no kit</p>

                  {(form.kit_itens || []).map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#fdf2f8", borderRadius: "10px", marginBottom: "4px" }}>
                      <div>
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>{item.nome}</span>
                        <span style={{ fontSize: "0.78rem", color: "#9ca3af", marginLeft: "8px" }}>× {item.quantidade}</span>
                      </div>
                      <button onClick={() => setForm(f => ({ ...f, kit_itens: (f.kit_itens || []).filter((_, idx) => idx !== i) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "1rem", padding: 0 }}>×</button>
                    </div>
                  ))}

                  <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                    <input type="text" placeholder="Ex: Bolo, Brigadeiros..." value={novoKitItem.nome} onChange={e => setNovoKitItem(k => ({ ...k, nome: e.target.value }))} style={{ flex: 2, padding: "0.5rem 0.75rem", border: "1.5px solid #e5e7eb", borderRadius: "10px", fontSize: "0.82rem", fontFamily: "Inter, sans-serif", outline: "none" }} />
                    <input type="text" placeholder="Qtd" value={novoKitItem.quantidade} onChange={e => setNovoKitItem(k => ({ ...k, quantidade: e.target.value }))} style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1.5px solid #e5e7eb", borderRadius: "10px", fontSize: "0.82rem", fontFamily: "Inter, sans-serif", outline: "none" }} />
                    <button onClick={() => {
                      if (!novoKitItem.nome.trim()) return;
                      setForm(f => ({ ...f, kit_itens: [...(f.kit_itens || []), { nome: novoKitItem.nome.trim(), quantidade: novoKitItem.quantidade || "1" }] }));
                      setNovoKitItem({ nome: "", quantidade: "" });
                    }} style={{ padding: "0.5rem 0.85rem", background: "#F583BF", color: "white", border: "none", borderRadius: "10px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>+ Add</button>
                  </div>

                  <div className="prod-row-2" style={{ marginTop: "8px" }}>
                    <div className="prod-field">
                      <label>Serve quantas pessoas</label>
                      <input type="text" placeholder="Ex: 20 a 30 pessoas" value={form.kit_serve_pessoas || ""} onChange={e => setForm(f => ({ ...f, kit_serve_pessoas: e.target.value }))} />
                    </div>
                    <div className="prod-field">
                      <label>Prazo de encomenda</label>
                      <input type="text" placeholder="Ex: 5 dias antes" value={form.kit_prazo_encomenda || ""} onChange={e => setForm(f => ({ ...f, kit_prazo_encomenda: e.target.value }))} />
                    </div>
                  </div>
                </div>
              )}

              {/* Personalização */}
              <div className="prod-section">
                <p className="prod-section-label">🎨 Personalização</p>
                <Toggle label="Permitir personalização" value={form.permite_personalizacao || false} onChange={(v: boolean) => setForm(f => ({ ...f, permite_personalizacao: v }))} colorClass="active-pink" />

                {form.permite_personalizacao && (
                  <>
                    {/* Massas */}
                    <div className="prod-field">
                      <label>Tipos de Massa</label>
                      <TagList items={form.massas_disponiveis || []} onRemove={i => removeOpcao("massas_disponiveis", i)} />
                      <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                        <input type="text" placeholder="Ex: Chocolate, Baunilha..." value={novaOpcao.massa} onChange={e => setNovaOpcao(o => ({ ...o, massa: e.target.value }))} onKeyDown={e => e.key === "Enter" && addOpcao("massas_disponiveis", "massa")} style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1.5px solid #e5e7eb", borderRadius: "10px", fontSize: "0.82rem", fontFamily: "Inter, sans-serif", outline: "none" }} />
                        <button onClick={() => addOpcao("massas_disponiveis", "massa")} style={{ padding: "0.5rem 0.85rem", background: "#F583BF", color: "white", border: "none", borderRadius: "10px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>+ Add</button>
                      </div>
                    </div>

                    {/* Recheios */}
                    <div className="prod-field">
                      <label>Sabores / Recheios</label>
                      <TagList items={form.recheios_disponiveis || []} onRemove={i => removeOpcao("recheios_disponiveis", i)} />
                      <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                        <input type="text" placeholder="Ex: Morango, Brigadeiro..." value={novaOpcao.recheio} onChange={e => setNovaOpcao(o => ({ ...o, recheio: e.target.value }))} onKeyDown={e => e.key === "Enter" && addOpcao("recheios_disponiveis", "recheio")} style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1.5px solid #e5e7eb", borderRadius: "10px", fontSize: "0.82rem", fontFamily: "Inter, sans-serif", outline: "none" }} />
                        <button onClick={() => addOpcao("recheios_disponiveis", "recheio")} style={{ padding: "0.5rem 0.85rem", background: "#F583BF", color: "white", border: "none", borderRadius: "10px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>+ Add</button>
                      </div>
                    </div>

                    {/* Coberturas */}
                    <div className="prod-field">
                      <label>Coberturas</label>
                      <TagList items={form.coberturas_disponiveis || []} onRemove={i => removeOpcao("coberturas_disponiveis", i)} />
                      <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                        <input type="text" placeholder="Ex: Ganache, Chantilly..." value={novaOpcao.cobertura} onChange={e => setNovaOpcao(o => ({ ...o, cobertura: e.target.value }))} onKeyDown={e => e.key === "Enter" && addOpcao("coberturas_disponiveis", "cobertura")} style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1.5px solid #e5e7eb", borderRadius: "10px", fontSize: "0.82rem", fontFamily: "Inter, sans-serif", outline: "none" }} />
                        <button onClick={() => addOpcao("coberturas_disponiveis", "cobertura")} style={{ padding: "0.5rem 0.85rem", background: "#F583BF", color: "white", border: "none", borderRadius: "10px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>+ Add</button>
                      </div>
                    </div>
                  </>
                )}
              </div>

            </div>

            <div className="prod-modal-footer">
              <button className="prod-btn-cancelar" onClick={fecharModal}>Cancelar</button>
              <button className="prod-btn-salvar" onClick={handleSalvar} disabled={saving}>
                {saving ? <span className="prod-spinner-sm" /> : (form.id ? "Salvar alterações" : "Publicar produto")}
              </button>
            </div>
          </div>
        </div>
      )}

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
        .prod-card-encomenda { position:absolute; top:0.4rem; right:0.4rem; background:#f59e0b; color:white; font-size:0.65rem; font-weight:700; padding:0.15rem 0.45rem; border-radius:20px; }
        .prod-card-info { padding:0.65rem 0.75rem; flex:1; }
        .prod-card-cat { font-size:0.68rem; color:#F583BF; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin:0 0 0.15rem; }
        .prod-card-nome { font-size:0.85rem; font-weight:700; color:var(--text-primary,#1f2937); margin:0 0 0.25rem; line-height:1.3; }
        .prod-card-preco { font-size:0.88rem; font-weight:800; color:#22c55e; margin:0; }
        .prod-card-actions { display:flex; gap:0.4rem; padding:0.5rem 0.75rem; border-top:1px solid var(--border,#f3f4f6); }
        .prod-card-btn-edit { flex:1; padding:0.4rem; background:var(--bg-subtle,#f9fafb); border:none; border-radius:8px; font-family:'Inter',sans-serif; font-size:0.78rem; font-weight:600; color:var(--text-secondary,#374151); cursor:pointer; }
        .prod-card-btn-del { padding:0.4rem 0.6rem; background:#fff1f2; border:none; border-radius:8px; color:#ef4444; cursor:pointer; display:flex; align-items:center; }
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
        .prod-toggle-thumb { width:18px; height:18px; border-radius:50%; background:white; position:absolute; top:2px; left:2px; transition:transform 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.2); }
        .prod-btn-cancelar { flex:1; padding:0.85rem; background:var(--bg-subtle,#f3f4f6); border:none; border-radius:50px; font-family:'Inter',sans-serif; font-size:0.9rem; font-weight:600; color:var(--text-secondary,#374151); cursor:pointer; }
        .prod-btn-salvar { flex:2; padding:0.85rem; background:linear-gradient(135deg,#F583BF,#e060a8); color:white; border:none; border-radius:50px; font-family:'Inter',sans-serif; font-size:0.9rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .prod-btn-salvar:disabled { opacity:0.65; cursor:not-allowed; }
        .prod-confirm { background:var(--bg-card,white); border-radius:18px; padding:1.5rem; width:90%; max-width:320px; margin:auto; }
        .prod-confirm-title { font-size:1rem; font-weight:700; color:var(--text-primary,#1f2937); margin:0 0 0.4rem; }
        .prod-confirm-sub { font-size:0.82rem; color:var(--text-muted,#9ca3af); margin:0 0 1.25rem; }
        .prod-confirm-btns { display:flex; gap:0.75rem; }
        .prod-confirm-btns button { flex:1; padding:0.75rem; border:none; border-radius:50px; font-family:'Inter',sans-serif; font-size:0.88rem; font-weight:700; cursor:pointer; background:var(--bg-subtle,#f3f4f6); color:var(--text-secondary,#374151); }
      `}</style>
    </div>
  );
}

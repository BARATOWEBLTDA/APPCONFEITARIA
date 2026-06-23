import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { usePlano } from "@/hooks/usePlano";
import { ImageCropper } from "@/components/ui/ImageCropper";
import EmptyDoo from "@/components/EmptyDoo";
import Categorias from "@/pages/Categorias";

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
  zero_acucar?: boolean;
  tem_vela?: boolean;
  valor_vela?: number;
  tem_topo?: boolean;
  valor_topo?: number;
  tem_papel_arroz?: boolean;
  valor_papel_arroz?: number;
  tem_outro?: boolean;
  titulo_outro?: string;
  valor_outro?: number;
  tipo_promocao?: 'fixo' | 'percentual';
  desconto_percentual?: number;
};

const SYSTEM_ICONS = Array.from({ length: 42 }, (_, i) => `/categoriaicones/icone (${i + 1}).png`);

const FORMAS_VENDA = [
  { value: "unidade", label: "Por Unidade" },
  { value: "fatia", label: "Por Fatia" },
  { value: "kg", label: "Por Quilo (kg)" },
  { value: "cento", label: "Por Cento" },
  { value: "tamanho", label: "Por Tamanho (P/M/G)" },
  { value: "caixa", label: "Por Caixa" },
  { value: "kit-festa", label: "Kit Festa" },
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
  zero_acucar: false,
  tem_vela: false, valor_vela: 0,
  tem_topo: false, valor_topo: 0,
  tem_papel_arroz: false, valor_papel_arroz: 0,
  tem_outro: false, titulo_outro: "", valor_outro: 0,
  tipo_promocao: 'fixo' as const, desconto_percentual: 0,
};

export default function Produtos() {
  const [activeTab, setActiveTab] = useState<"produtos"|"categorias">("produtos");
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
  const [novaCategoriaIcone, setNovaCategoriaIcone] = useState("");
  const [showCatInput, setShowCatInput] = useState(false);
  const [savingCat, setSavingCat] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [novaOpcao, setNovaOpcao] = useState<{ massa: string; recheio: string; cobertura: string }>({ massa: "", recheio: "", cobertura: "" });
  const [novoTamanho, setNovoTamanho] = useState({ label: "", preco: "" });
  const [novoKitItem, setNovoKitItem] = useState({ nome: "", quantidade: "" });
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropSlot, setCropSlot] = useState(0);
  const [viewMode, setViewMode] = useState<"grid" | "lista">(() => (localStorage.getItem("prod_viewMode") as "grid" | "lista") || "grid");
  const [buscaTexto, setBuscaTexto] = useState("");

  // Ficha técnica (CMV)
  type Insumo = { id: string; nome: string; unidade: string; custo_unitario: number; imagem_url?: string };
  type FichaItem = { insumo_id: string; quantidade: number; insumo?: Insumo };
  const [insumosCadastrados, setInsumosCadastrados] = useState<Insumo[]>([]);
  const [fichaTecnica, setFichaTecnica] = useState<FichaItem[]>([]);
  const [showInsumoPicker, setShowInsumoPicker] = useState(false);
  const [buscaInsumo, setBuscaInsumo] = useState("");

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
      await loadInsumos(user.id);
      setLoading(false);
    };
    load();
  }, []);

  const loadInsumos = async (uid: string) => {
    const { data } = await supabase.from("insumos").select("id, nome, unidade, custo_unitario, imagem_url").eq("user_id", uid).order("nome");
    if (data) setInsumosCadastrados(data as Insumo[]);
  };

  const loadProdutos = async (uid: string) => {
    const { data } = await supabase.from("produtos").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    if (data) setProdutos(data);
  };

  const loadCategorias = async (uid: string) => {
    const { data } = await supabase.from("categorias").select("nome").eq("user_id", uid).order("nome");
    if (data) setCategorias(data.map((c: any) => c.nome));
  };

  const openNovo = () => { setForm(EMPTY); setFichaTecnica([]); setModal(true); };
  const openEditar = async (p: Produto) => {
    setForm({ ...EMPTY, ...p });
    setFichaTecnica([]);
    setModal(true);
    if (p.id && userId) {
      const { data } = await supabase
        .from("produto_insumos")
        .select("insumo_id, quantidade, insumos(id, nome, unidade, custo_unitario, imagem_url)")
        .eq("produto_id", p.id);
      if (data) {
        setFichaTecnica(data.map((d: any) => ({
          insumo_id: d.insumo_id,
          quantidade: Number(d.quantidade) || 0,
          insumo: d.insumos as Insumo,
        })));
      }
    }
  };
  const fecharModal = () => { setModal(false); setForm(EMPTY); setFichaTecnica([]); setShowInsumoPicker(false); setBuscaInsumo(""); };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, slot: number = 0) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setCropSrc(reader.result as string); setCropSlot(slot); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleProductCropDone = async (blob: Blob) => {
    if (!userId) return;
    setCropSrc(null);
    setUploading(true);
    const path = `produtos/${userId}-${Date.now()}-${cropSlot}.jpg`;
    const { error } = await supabase.storage.from("products").upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (!error) {
      const { data } = supabase.storage.from("products").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      setForm(f => {
        const imgs = (f.imagem_url || "").split(",").map(s => s.trim()).filter(Boolean);
        imgs[cropSlot] = url;
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
    let produtoId = form.id;
    if (form.id) {
      await supabase.from("produtos").update(payload).eq("id", form.id);
    } else {
      const { data: novo } = await supabase.from("produtos").insert({ ...payload, user_id: userId }).select("id").single();
      produtoId = novo?.id;
    }

    // Persistir ficha técnica
    if (produtoId && userId) {
      await supabase.from("produto_insumos").delete().eq("produto_id", produtoId);
      const itens = fichaTecnica
        .filter(f => f.insumo_id && f.quantidade > 0)
        .map(f => ({ user_id: userId, produto_id: produtoId, insumo_id: f.insumo_id, quantidade: f.quantidade }));
      if (itens.length > 0) {
        await supabase.from("produto_insumos").insert(itens);
      }
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
    if (!novaCategoriaIcone) return alert("Selecione um ícone para a categoria");
    setSavingCat(true);
    await supabase.from("categorias").insert({
      nome: novaCategoria.trim(),
      imagem_url: novaCategoriaIcone,
      ordem: categorias.length,
      user_id: userId
    });
    setCategorias(prev => [...prev, novaCategoria.trim()].sort());
    setForm(f => ({ ...f, categoria: novaCategoria.trim() }));
    setNovaCategoria(""); setNovaCategoriaIcone(""); setShowCatInput(false);
    setSavingCat(false);
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

  // ── Ficha técnica ─────────────────────────────────────────
  const adicionarInsumoFicha = (ins: Insumo) => {
    if (fichaTecnica.some(f => f.insumo_id === ins.id)) {
      alert("Esse insumo já está na ficha técnica");
      return;
    }
    setFichaTecnica(prev => [...prev, { insumo_id: ins.id, quantidade: 0, insumo: ins }]);
    setShowInsumoPicker(false);
    setBuscaInsumo("");
  };
  const removerInsumoFicha = (id: string) => {
    setFichaTecnica(prev => prev.filter(f => f.insumo_id !== id));
  };
  const atualizarQtdFicha = (id: string, qtd: number) => {
    setFichaTecnica(prev => prev.map(f => f.insumo_id === id ? { ...f, quantidade: qtd } : f));
  };

  const cmvProduto = fichaTecnica.reduce(
    (s, f) => s + (f.quantidade * (f.insumo?.custo_unitario || 0)),
    0
  );
  const margemProduto = form.preco_normal > 0
    ? ((form.preco_normal - cmvProduto) / form.preco_normal) * 100
    : 0;

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

  const produtosFiltrados = (() => {
    let lista = produtos;
    if (buscaTexto.trim()) {
      const t = buscaTexto.toLowerCase();
      lista = lista.filter(p => p.nome.toLowerCase().includes(t) || p.descricao?.toLowerCase().includes(t));
    } else if (filtroCategoria !== "todas" && filtroCategoria !== "__orfaos__") {
      lista = lista.filter(p => p.categoria === filtroCategoria);
    }
    return lista;
  })();
  const todasCategorias = Array.from(new Set([...categorias, ...produtos.map(p => p.categoria).filter(Boolean)])).sort();

  const Toggle = ({ label, value, onChange, colorClass }: any) => (
    <div className={`prod-toggle-item${value ? ` ${colorClass}` : ""}`} onClick={() => onChange(!value)}>
      <div className={`prod-toggle-slider${value ? " active" : ""}`} style={{ background: value ? (colorClass === "active-green" ? "var(--success, #22C55E)" : "var(--primary, #FF6FA9)") : "var(--border, #E9E9EE)" }}>
        <div className="prod-toggle-thumb" style={{ transform: value ? "translateX(20px)" : "translateX(0)" }} />
      </div>
      <span>{label}</span>
    </div>
  );

  const TagList = ({ items, onRemove }: { items: string[], onRemove: (i: number) => void }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "var(--primary-light, #FFF1F7)", color: "var(--primary-dark, #F85A9A)", borderRadius: "50px", fontSize: "0.8rem", fontWeight: 600 }}>
          {item}
          <button onClick={() => onRemove(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary-dark, #F85A9A)", padding: 0, lineHeight: 1, fontSize: "0.85rem" }}>×</button>
        </span>
      ))}
    </div>
  );

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh" }}><span className="prod-spinner" /></div>;

  return (
    <>
    {cropSrc && (
      <ImageCropper
        imageSrc={cropSrc}
        cropShape="rect"
        aspect={1}
        onCancel={() => setCropSrc(null)}
        onCropDone={handleProductCropDone}
      />
    )}
    <div className="prod-root">

      {/* ── Tabs estilo Doonly ── */}
      <div className="prod-tabs-novo">
        <button className={`prod-tab-novo${activeTab==="produtos"?" active":""}`} onClick={()=>setActiveTab("produtos")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          Produtos
        </button>
        <button className={`prod-tab-novo${activeTab==="categorias"?" active":""}`} onClick={()=>setActiveTab("categorias")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
          Categorias
        </button>
      </div>

      {activeTab === "categorias" && <Categorias />}

      {activeTab === "produtos" && <>

      {/* Header novo: título à esquerda, botão Novo grande à direita */}
      <div className="prod-header-novo">
        <div>
          <h1 className="prod-title-novo">Produtos</h1>
          <p className="prod-sub-novo">{produtos.length} cadastrado{produtos.length !== 1 ? "s" : ""}</p>
        </div>
        <button className="prod-btn-novo-novo" onClick={openNovo}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo produto
        </button>
      </div>

      {/* Barra de pesquisa */}
      <div className="prod-busca-novo">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          type="text"
          placeholder="Buscar produto..."
          value={buscaTexto}
          onChange={e => { setBuscaTexto(e.target.value); setFiltroCategoria("todas"); }}
        />
        <div style={{ display: "flex", background: "white", borderRadius: 8, padding: 2, gap: 2, border: "1.5px solid var(--border,#ECC2D0)", flexShrink: 0 }}>
          <button onClick={() => { setViewMode("grid"); localStorage.setItem("prod_viewMode", "grid"); }} style={{ width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer", background: viewMode === "grid" ? "#3d1a24" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }} title="Grade">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={viewMode === "grid" ? "white" : "var(--text-muted,#C39EAA)"} strokeWidth="2.2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
          <button onClick={() => { setViewMode("lista"); localStorage.setItem("prod_viewMode", "lista"); }} style={{ width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer", background: viewMode === "lista" ? "#3d1a24" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }} title="Lista">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={viewMode === "lista" ? "white" : "var(--text-muted,#C39EAA)"} strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>
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
            <button onClick={() => setFiltroCategoria("__orfaos__")} style={{ padding: "5px 12px", background: "var(--warning, #F59E0B)", color: "white", border: "none", borderRadius: "8px", fontFamily: "inherit", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
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
        <EmptyDoo
          image="produtos.png"
          title="Vamos cadastrar seu primeiro produto?"
          description="Quanto mais completo seu catálogo, mais profissional sua confeitaria fica para os clientes!"
          actionLabel="Cadastrar primeiro produto"
          onAction={openNovo}
        />
      ) : (
        <div className={viewMode === "grid" ? "prod-grid" : "prod-list"}>
          {(filtroCategoria === "__orfaos__"
            ? produtos.filter(p => p.categoria && !categorias.includes(p.categoria))
            : produtosFiltrados
          ).map(p => {
            const catInvalida = p.categoria && !categorias.includes(p.categoria);
            if (viewMode === "lista") return (
              <div key={p.id} className="prod-list-item" style={{ outline: catInvalida ? "2px solid #fcd34d" : "none" }}>
                <div className="prod-list-img" onClick={() => openEditar(p)}>
                  {p.imagem_url ? <img src={p.imagem_url.split(",")[0]} alt={p.nome} /> : <span style={{ fontSize: "1.5rem" }}>🎂</span>}
                  {!p.disponivel && <div className="prod-card-indisponivel">Indisponível</div>}
                </div>
                <div className="prod-list-info">
                  <p className="prod-card-nome">{p.nome}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <p className="prod-card-preco" style={{ margin: 0 }}>R$ {formatPreco(p.preco_normal)}</p>
                    {p.promocao && <span style={{ background: "var(--primary, #FF6FA9)", color: "var(--text-inverse, #FFFFFF)", fontSize: "0.55rem", fontWeight: 700, padding: "2px 5px", borderRadius: "6px" }}>Promoção</span>}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                  <button className="prod-card-btn-edit" onClick={() => openEditar(p)}>Editar</button>
                  <button onClick={() => setDeleteConfirm(p.id!)} style={{ width: "30px", height: "30px", background: "#fff1f2", border: "none", borderRadius: "8px", color: "var(--error, #EF4444)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              </div>
            );
            return (
            <div key={p.id} className="prod-card" style={{ outline: catInvalida ? "2px solid #fcd34d" : "none" }}>
              <div className="prod-card-img" onClick={() => openEditar(p)}>
                {p.imagem_url ? <img src={p.imagem_url.split(",")[0]} alt={p.nome} /> : <span style={{ fontSize: "2rem" }}>🎂</span>}
                {!p.disponivel && <div className="prod-card-indisponivel">Indisponível</div>}
                {p.promocao && <div className="prod-card-promo">Promoção</div>}
                {p.pronta_entrega === false && <div className="prod-card-encomenda">Encomenda</div>}
                {catInvalida && <div style={{ position: "absolute", top: "0.4rem", left: "0.4rem", background: "var(--warning, #F59E0B)", color: "var(--text-inverse, #FFFFFF)", fontSize: "0.6rem", fontWeight: 700, padding: "2px 6px", borderRadius: "6px" }}>⚠️ Sem categoria</div>}
              </div>
              <div className="prod-card-info">
                <p className="prod-card-cat" style={{ color: catInvalida ? "var(--warning, #F59E0B)" : undefined }}>{catInvalida ? `⚠️ ${p.categoria}` : p.categoria}</p>
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
                        {slot > 0 && <span style={{ fontSize: "0.65rem", color: "var(--text-muted, #9CA3AF)", display: "block", marginBottom: "3px", textAlign: "center" }}>Foto {slot + 1}</span>}
                        {slot === 0 && <span style={{ fontSize: "0.65rem", color: "var(--text-muted, #9CA3AF)", display: "block", marginBottom: "3px", textAlign: "center" }}>Principal</span>}
                        <div
                          className="prod-img-upload"
                          style={{ width: "100%", height: "90px", borderRadius: "12px", cursor: isLocked ? "default" : "pointer", position: "relative", overflow: "hidden", background: isLocked ? "var(--primary-light, #FFF1F7)" : (slot > 0 ? "#f0f4ff" : undefined), border: isLocked ? "2px dashed var(--primary, #FF6FA9)" : (slot > 0 ? "2px dashed #c7d2fe" : undefined) }}
                          onClick={() => !isLocked && !uploading && ref.current?.click()}
                        >
                          {imgUrl ? (
                            <>
                              <img src={imgUrl} alt={`foto ${slot + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              {!isLocked && <button className="prod-img-remove" onClick={e => { e.stopPropagation(); removeImage(slot); }}>✕</button>}
                            </>
                          ) : isLocked ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: "5px", padding: "4px" }}>
                              <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 8px rgba(255,111,169,0.35)" }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="4" y="11" width="16" height="10" rx="2.5"/>
                                  <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                                </svg>
                              </div>
                              <span style={{ fontSize: "0.6rem", fontWeight: 800, color: "var(--primary, #FF6FA9)", textAlign: "center", letterSpacing: "0.05em" }}>PRO</span>
                            </div>
                          ) : (
                            <div className="prod-img-placeholder">
                              {uploading ? <span className="prod-spinner" /> : (
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                              )}
                            </div>
                          )}
                        </div>
                        <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageUpload(e, slot)} />
                      </div>
                    );
                  })}
                </div>
                {!isPro && <p style={{ fontSize: "0.72rem", color: "var(--text-muted, #9CA3AF)", margin: "4px 0 0", textAlign: "center" }}>Fotos 2 e 3 disponíveis no plano PRO</p>}
              </div>

              {/* Informações */}
              <div className="prod-section">
                <p className="prod-section-label">✏️ Informações</p>
                <div className="prod-field">
                  <label>Nome do Produto *</label>
                  <input type="text" placeholder="Ex: Bolo de Morango" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
                </div>
                <div className="prod-field">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <label style={{ margin: 0 }}>Categoria *</label>
                    {!showCatInput && (
                      <button
                        type="button"
                        onClick={() => setShowCatInput(true)}
                        style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "var(--primary-light, #FFF1F7)", color: "var(--primary, #FF6FA9)", border: "none", borderRadius: "20px", fontFamily: "inherit", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Nova categoria
                      </button>
                    )}
                  </div>
                  <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {todasCategorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>

                  {showCatInput && (
                    <div style={{ marginTop: "10px", padding: "12px", background: "var(--primary-light, #FFF1F7)", borderRadius: "14px", border: "1.5px dashed var(--primary, #FF6FA9)" }}>
                      <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary, #FF6FA9)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>✨ Criar nova categoria</p>

                      <input
                        type="text"
                        placeholder="Nome (ex: Bolos, Doces...)"
                        value={novaCategoria}
                        onChange={e => setNovaCategoria(e.target.value)}
                        style={{ width: "100%", padding: "0.6rem 0.85rem", border: "1.5px solid var(--border, #E9E9EE)", borderRadius: "10px", fontFamily: "inherit", fontSize: "0.85rem", outline: "none", boxSizing: "border-box", background: "var(--bg-card, #FFFFFF)", marginBottom: "10px" }}
                      />

                      <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-secondary, #6B7280)", margin: "0 0 6px" }}>Escolha um ícone:</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "6px", maxHeight: "160px", overflowY: "auto", padding: "2px", marginBottom: "10px" }}>
                        {SYSTEM_ICONS.map((src, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setNovaCategoriaIcone(src)}
                            style={{ aspectRatio: "1", borderRadius: "8px", border: `2px solid ${novaCategoriaIcone === src ? "var(--primary, #FF6FA9)" : "transparent"}`, background: novaCategoriaIcone === src ? "var(--bg-card, #FFFFFF)" : "rgba(255,255,255,0.6)", padding: "3px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <img src={src} alt={`ícone ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain" }}
                              onError={e => { e.currentTarget.parentElement!.style.display = "none" }} />
                          </button>
                        ))}
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={() => { setShowCatInput(false); setNovaCategoria(""); setNovaCategoriaIcone(""); }}
                          style={{ flex: 1, padding: "0.55rem", background: "var(--bg-card, #FFFFFF)", border: "1.5px solid var(--border, #E9E9EE)", borderRadius: "50px", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary, #6B7280)", cursor: "pointer" }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleAdicionarCategoria}
                          disabled={!novaCategoria.trim() || !novaCategoriaIcone || savingCat}
                          style={{ flex: 2, padding: "0.55rem", background: "var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A))", color: "var(--text-inverse, #FFFFFF)", border: "none", borderRadius: "50px", fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 700, cursor: (!novaCategoria.trim() || !novaCategoriaIcone) ? "not-allowed" : "pointer", opacity: (!novaCategoria.trim() || !novaCategoriaIcone || savingCat) ? 0.6 : 1 }}
                        >
                          {savingCat ? "Salvando..." : "Criar categoria"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="prod-field">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <label style={{ margin: 0 }}>Descrição</label>
                    <button
                      type="button"
                      disabled={!form.nome.trim() || !isPro}
                      onClick={async () => {
                        if (!form.nome.trim() || !isPro) return;
                        setForm(f => ({ ...f, descricao: "Gerando..." }));
                        try {
                          const res = await fetch("/api/gerar-descricao", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ prompt: `Crie uma descrição MUITO curta e atraente para um produto de confeitaria chamado "${form.nome}". MÁXIMO 2 frases curtas (até 100 caracteres no total). Português brasileiro, transmita qualidade e sabor. Retorne APENAS a descrição, sem aspas, sem emojis.` })
                          });
                          const data = await res.json();
                          const desc = data.content?.[0]?.text?.trim() || "";
                          setForm(f => ({ ...f, descricao: desc }));
                        } catch {
                          setForm(f => ({ ...f, descricao: "" }));
                        }
                      }}
                      style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: (form.nome.trim() && isPro) ? "var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A))" : "var(--border, #E9E9EE)", color: (form.nome.trim() && isPro) ? "var(--text-inverse, #FFFFFF)" : "var(--text-muted, #9CA3AF)", border: "none", borderRadius: "20px", fontFamily: "inherit", fontSize: "0.7rem", fontWeight: 700, cursor: (form.nome.trim() && isPro) ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}
                      title={!isPro ? "Disponível apenas no plano PRO" : ""}
                    >
                      ✨ {isPro ? "Gerar com IA" : "IA — PRO"}
                    </button>
                  </div>
                  <textarea placeholder="Feito com ingredientes frescos e selecionados. Conte o que torna esse produto especial..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} />
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

                {!["kit-festa", "sob-encomenda"].includes(form.forma_venda) && (() => {
                  const config: Record<string, { label: string; sub: string; placeholder: string; placeholderPreco: string; suffix?: string }> = {
                    unidade:  { label: "Opções de quantidade", sub: "Ex: 6 unidades, 12 unidades, 24 unidades", placeholder: "Ex: 6, 12, 24...", placeholderPreco: "Preço", suffix: "un" },
                    fatia:    { label: "Opções de fatias", sub: "Ex: 1 fatia, 2 fatias, 4 fatias", placeholder: "Ex: 1, 2, 4...", placeholderPreco: "Preço", suffix: "fatia(s)" },
                    kg:       { label: "Opções de peso", sub: "Digite em kg: 0.5 → 500g · 1 → 1kg · 1.5 → 1,5kg", placeholder: "Ex: 0.5, 1, 1.5...", placeholderPreco: "Preço por opção" },
                    cento:    { label: "Opções de cento", sub: "Ex: meio cento (50 un), 1 cento (100 un)", placeholder: "Ex: 0.5, 1, 2...", placeholderPreco: "Preço", suffix: "cento(s)" },
                    tamanho:  { label: "Tamanhos disponíveis", sub: "Ex: P, M, G, XG", placeholder: "Ex: P, M, G, XG...", placeholderPreco: "Preço" },
                    caixa:    { label: "Opções de caixa", sub: "Ex: Caixa 6 un, Caixa 12 un", placeholder: "Ex: Caixa 6, Caixa 12...", placeholderPreco: "Preço" },
                    outros:   { label: "Opções disponíveis", sub: "Defina as opções e preços", placeholder: "Ex: Mini, Normal, Grande...", placeholderPreco: "Preço" },
                  };
                  const cfg = config[form.forma_venda];
                  if (!cfg) return null;

                  const formatLabel = (raw: string) => {
                    if (form.forma_venda === "kg") {
                      const num = parseFloat(raw.replace(",", "."));
                      if (isNaN(num)) return raw;
                      return num < 1 ? `${Math.round(num * 1000)}g` : num === Math.floor(num) ? `${num}kg` : `${num.toString().replace(".", ",")}kg`;
                    }
                    if (form.forma_venda === "unidade" || form.forma_venda === "fatia") {
                      const num = parseInt(raw);
                      if (!isNaN(num)) return `${num} ${cfg.suffix}`;
                      return raw;
                    }
                    if (form.forma_venda === "cento") {
                      const num = parseFloat(raw.replace(",", "."));
                      if (!isNaN(num)) return num === 0.5 ? "Meio cento (50 un)" : `${num} ${cfg.suffix}`;
                      return raw;
                    }
                    return raw;
                  };

                  return (
                    <div className="prod-field">
                      <label>{cfg.label} <span style={{ color: "var(--text-muted, #9CA3AF)", fontWeight: 400 }}>(opcional)</span></label>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted, #9CA3AF)", margin: "0 0 6px" }}>{cfg.sub}</p>
                      {(form.tamanhos_disponiveis || []).map((t, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "var(--primary-light, #FFF1F7)", borderRadius: "8px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--primary, #FF6FA9)" }}>{t.label}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "0.82rem", color: "var(--success, #22C55E)", fontWeight: 700 }}>R$ {t.preco.toFixed(2).replace(".", ",")}</span>
                            <button onClick={() => removeTamanho(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error, #EF4444)", fontSize: "1rem", padding: 0 }}>×</button>
                          </div>
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                        <input type="text" placeholder={cfg.placeholder} value={novoTamanho.label} onChange={e => setNovoTamanho(t => ({ ...t, label: e.target.value }))} style={{ flex: 2, padding: "0.5rem 0.75rem", border: "1.5px solid var(--border, #E9E9EE)", borderRadius: "10px", fontSize: "0.82rem", fontFamily: "inherit", outline: "none" }} />
                        <input type="text" placeholder={cfg.placeholderPreco} value={novoTamanho.preco} onChange={e => setNovoTamanho(t => ({ ...t, preco: e.target.value }))} style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1.5px solid var(--border, #E9E9EE)", borderRadius: "10px", fontSize: "0.82rem", fontFamily: "inherit", outline: "none" }} />
                        <button onClick={() => {
                          if (!novoTamanho.label.trim()) return;
                          const preco = parseFloat(novoTamanho.preco.replace(",", "."));
                          if (isNaN(preco)) return;
                          const label = formatLabel(novoTamanho.label.trim());
                          setForm(f => ({ ...f, tamanhos_disponiveis: [...(f.tamanhos_disponiveis || []), { label, preco }] }));
                          setNovoTamanho({ label: "", preco: "" });
                        }} style={{ padding: "0.5rem 0.85rem", background: "var(--primary, #FF6FA9)", color: "var(--text-inverse, #FFFFFF)", border: "none", borderRadius: "10px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>+ Add</button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Kit Festa */}
              {form.forma_venda === "kit-festa" && (
                <div className="prod-section">
                  <p className="prod-section-label">🎉 Itens do Kit</p>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-secondary, #6B7280)", margin: "0" }}>Adicione cada item que estará incluso no kit festa</p>

                  {(form.kit_itens || []).map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--primary-light, #FFF1F7)", borderRadius: "10px", marginBottom: "6px", border: "1px solid var(--primary-light, #FFF1F7)" }}>
                      <div>
                        <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary, #374151)" }}>{item.nome}</span>
                        <span style={{ fontSize: "0.8rem", color: "var(--primary, #FF6FA9)", marginLeft: "8px", fontWeight: 600 }}>× {item.quantidade}</span>
                      </div>
                      <button onClick={() => setForm(f => ({ ...f, kit_itens: (f.kit_itens || []).filter((_, idx) => idx !== i) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error, #EF4444)", fontSize: "1.1rem", padding: 0 }}>×</button>
                    </div>
                  ))}

                  <div className="prod-field" style={{ marginTop: "4px" }}>
                    <label>Nome do item</label>
                    <input type="text" placeholder="Ex: Bolo, Brigadeiros, Cupcakes..." value={novoKitItem.nome} onChange={e => setNovoKitItem(k => ({ ...k, nome: e.target.value }))} onKeyDown={e => e.key === "Enter" && (() => { if (!novoKitItem.nome.trim()) return; setForm(f => ({ ...f, kit_itens: [...(f.kit_itens || []), { nome: novoKitItem.nome.trim(), quantidade: novoKitItem.quantidade || "1" }] })); setNovoKitItem({ nome: "", quantidade: "" }); })()} />
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                    <div className="prod-field" style={{ flex: 1 }}>
                      <label>Quantidade</label>
                      <input type="text" placeholder="Ex: 1 unidade, 30 pçs..." value={novoKitItem.quantidade} onChange={e => setNovoKitItem(k => ({ ...k, quantidade: e.target.value }))} />
                    </div>
                    <button onClick={() => {
                      if (!novoKitItem.nome.trim()) return;
                      setForm(f => ({ ...f, kit_itens: [...(f.kit_itens || []), { nome: novoKitItem.nome.trim(), quantidade: novoKitItem.quantidade || "1" }] }));
                      setNovoKitItem({ nome: "", quantidade: "" });
                    }} style={{ padding: "0.65rem 1rem", background: "var(--primary, #FF6FA9)", color: "var(--text-inverse, #FFFFFF)", border: "none", borderRadius: "10px", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", marginBottom: "1px" }}>+ Adicionar</button>
                  </div>

                  <div className="prod-field">
                    <label>Serve quantas pessoas</label>
                    <input type="text" placeholder="Ex: 20 a 30 pessoas" value={form.kit_serve_pessoas || ""} onChange={e => setForm(f => ({ ...f, kit_serve_pessoas: e.target.value }))} />
                  </div>
                  <div className="prod-field">
                    <label>Prazo mínimo de encomenda</label>
                    <input type="text" placeholder="Ex: 5 dias de antecedência" value={form.kit_prazo_encomenda || ""} onChange={e => setForm(f => ({ ...f, kit_prazo_encomenda: e.target.value }))} />
                  </div>
                </div>
              )}

              {/* Personalização */}
              <div className="prod-section">
                <p className="prod-section-label">🎨 Personalização</p>
                <Toggle label="Permitir personalização" value={form.permite_personalizacao || false} onChange={(v: boolean) => setForm(f => ({ ...f, permite_personalizacao: v }))} colorClass="active-pink" />

                {form.permite_personalizacao && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--bg-body, #F7F7F8)", borderRadius: "12px", border: "1px solid var(--border, #E9E9EE)" }}>
                      <div>
                        <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary, #374151)", margin: "0 0 2px" }}>🚫 Zero Açúcar</p>
                        <p style={{ fontSize: "0.72rem", color: "var(--text-muted, #9CA3AF)", margin: 0 }}>Disponível versão sem açúcar</p>
                      </div>
                      <button onClick={() => setForm(f => ({ ...f, zero_acucar: !f.zero_acucar }))}
                        style={{ width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer", background: form.zero_acucar ? "var(--primary, #FF6FA9)" : "var(--border, #E9E9EE)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                        <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "white", position: "absolute", top: "3px", transition: "left 0.2s", left: form.zero_acucar ? "23px" : "3px", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                      </button>
                    </div>

                    {[
                      { label: "Tipos de Massa", campo: "massas_disponiveis" as const, key: "massa" as const, placeholder: "Ex: Chocolate, Baunilha..." },
                      { label: "Sabores / Recheios", campo: "recheios_disponiveis" as const, key: "recheio" as const, placeholder: "Ex: Morango, Brigadeiro..." },
                      { label: "Coberturas", campo: "coberturas_disponiveis" as const, key: "cobertura" as const, placeholder: "Ex: Ganache, Chantilly..." },
                    ].map(({ label, campo, key, placeholder }) => (
                      <div key={campo} style={{ background: "var(--bg-body, #F7F7F8)", borderRadius: "12px", padding: "10px 12px", border: "1px solid var(--border, #E9E9EE)" }}>
                        <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary, #374151)", margin: "0 0 8px" }}>{label}</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", padding: "8px 10px", border: "1.5px solid var(--border, #E9E9EE)", borderRadius: "10px", background: "var(--bg-card, #FFFFFF)", cursor: "text" }}
                          onClick={() => (document.getElementById(`input-${key}`) as HTMLInputElement)?.focus()}>
                          {(form[campo] || []).map((item: string, i: number) => (
                            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "3px", padding: "2px 8px 2px 10px", background: "var(--primary-light, #FFF1F7)", border: "1px solid var(--primary-light, #FFF1F7)", color: "var(--primary-dark, #F85A9A)", borderRadius: "50px", fontSize: "0.78rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                              {item}
                              <button onClick={e => { e.stopPropagation(); removeOpcao(campo, i); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary-dark, #F85A9A)", padding: "0 2px", lineHeight: 1, fontSize: "0.85rem" }}>×</button>
                            </span>
                          ))}
                          <input id={`input-${key}`} type="text" placeholder={(form[campo] || []).length === 0 ? placeholder : "Adicionar..."} value={novaOpcao[key]} onChange={e => setNovaOpcao(o => ({ ...o, [key]: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addOpcao(campo, key); } }} style={{ border: "none", outline: "none", fontSize: "0.82rem", fontFamily: "inherit", flex: 1, minWidth: "100px", background: "transparent", padding: "2px 0" }} />
                        </div>
                        <p style={{ fontSize: "0.68rem", color: "var(--text-muted, #9CA3AF)", margin: "4px 0 0" }}>Pressione Enter ou clique em + Add</p>
                        <button onClick={() => addOpcao(campo, key)} style={{ marginTop: "6px", padding: "0.4rem 1rem", background: "var(--primary, #FF6FA9)", color: "var(--text-inverse, #FFFFFF)", border: "none", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}>+ Add</button>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Adicionais */}
              <div className="prod-section">
                <p className="prod-section-label">✨ Adicionais</p>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted, #9CA3AF)", margin: "0" }}>Itens extras que o cliente pode solicitar</p>

                {[
                  { label: "Velas", sub: "Cliente escolhe se quer velas", campo: "tem_vela" as const, valor: "valor_vela" as const },
                  { label: "Topo de Bolo", sub: "Cliente escolhe o topo personalizado", campo: "tem_topo" as const, valor: "valor_topo" as const },
                  { label: "Papel de Arroz", sub: "Impressão comestível personalizada", campo: "tem_papel_arroz" as const, valor: "valor_papel_arroz" as const },
                ].map(({ label, sub, campo, valor }) => (
                  <div key={campo} style={{ background: "var(--bg-body, #F7F7F8)", borderRadius: "12px", border: "1px solid var(--border, #E9E9EE)", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px" }}>
                      <div>
                        <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary, #374151)", margin: "0 0 2px" }}>{label}</p>
                        <p style={{ fontSize: "0.72rem", color: "var(--text-muted, #9CA3AF)", margin: 0 }}>{sub}</p>
                      </div>
                      <button onClick={() => setForm(f => ({ ...f, [campo]: !f[campo] }))}
                        style={{ width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer", background: form[campo] ? "var(--primary, #FF6FA9)" : "var(--border, #E9E9EE)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                        <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "white", position: "absolute", top: "3px", transition: "left 0.2s", left: form[campo] ? "23px" : "3px", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                      </button>
                    </div>
                    {form[campo] && (
                      <div style={{ padding: "0 12px 12px", borderTop: "1px solid var(--border, #E9E9EE)" }}>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary, #6B7280)", display: "block", margin: "8px 0 4px" }}>Valor adicional</label>
                        <div className="prod-preco-input" style={{ background: "var(--bg-card, #FFFFFF)" }}>
                          <span>R$</span>
                          <input type="text" placeholder="0,00" value={form[valor] ? formatPreco(form[valor] as number) : ""} onChange={e => setForm(f => ({ ...f, [valor]: parsePreco(e.target.value) }))} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div style={{ background: "var(--bg-body, #F7F7F8)", borderRadius: "12px", border: "1px solid var(--border, #E9E9EE)", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px" }}>
                    <div>
                      <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary, #374151)", margin: "0 0 2px" }}>Outro</p>
                      <p style={{ fontSize: "0.72rem", color: "var(--text-muted, #9CA3AF)", margin: 0 }}>Adicional personalizado</p>
                    </div>
                    <button onClick={() => setForm(f => ({ ...f, tem_outro: !f.tem_outro }))}
                      style={{ width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer", background: form.tem_outro ? "var(--primary, #FF6FA9)" : "var(--border, #E9E9EE)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                      <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "white", position: "absolute", top: "3px", transition: "left 0.2s", left: form.tem_outro ? "23px" : "3px", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                    </button>
                  </div>
                  {form.tem_outro && (
                    <div style={{ padding: "0 12px 12px", borderTop: "1px solid var(--border, #E9E9EE)", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary, #6B7280)", display: "block", margin: "8px 0 4px" }}>Nome do adicional</label>
                        <input type="text" placeholder="Ex: Embalagem especial, Laço..." value={form.titulo_outro || ""} onChange={e => setForm(f => ({ ...f, titulo_outro: e.target.value }))} style={{ width: "100%", padding: "0.55rem 0.85rem", border: "1.5px solid var(--border, #E9E9EE)", borderRadius: "10px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "var(--bg-card, #FFFFFF)" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary, #6B7280)", display: "block", margin: "0 0 4px" }}>Valor adicional</label>
                        <div className="prod-preco-input" style={{ background: "var(--bg-card, #FFFFFF)" }}>
                          <span>R$</span>
                          <input type="text" placeholder="0,00" value={form.valor_outro ? formatPreco(form.valor_outro) : ""} onChange={e => setForm(f => ({ ...f, valor_outro: parsePreco(e.target.value) }))} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Promoção */}
              <div className="prod-section">
                <p className="prod-section-label">🏷️ Promoção</p>
                <Toggle label="Produto em promoção" value={form.promocao} onChange={(v: boolean) => setForm(f => ({ ...f, promocao: v }))} colorClass="active-pink" />

                {form.promocao && (
                  <>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => setForm(f => ({ ...f, tipo_promocao: 'fixo' }))}
                        style={{ flex: 1, padding: "8px", borderRadius: "10px", border: `2px solid ${form.tipo_promocao !== 'percentual' ? 'var(--primary, #FF6FA9)' : 'var(--border, #E9E9EE)'}`, background: form.tipo_promocao !== 'percentual' ? 'var(--primary-light, #FFF1F7)' : 'var(--bg-card, #FFFFFF)', fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 700, color: form.tipo_promocao !== 'percentual' ? 'var(--primary, #FF6FA9)' : 'var(--text-secondary, #6B7280)', cursor: "pointer" }}
                      >
                        💰 Preço fixo
                      </button>
                      <button
                        onClick={() => setForm(f => ({ ...f, tipo_promocao: 'percentual' }))}
                        style={{ flex: 1, padding: "8px", borderRadius: "10px", border: `2px solid ${form.tipo_promocao === 'percentual' ? 'var(--primary, #FF6FA9)' : 'var(--border, #E9E9EE)'}`, background: form.tipo_promocao === 'percentual' ? 'var(--primary-light, #FFF1F7)' : 'var(--bg-card, #FFFFFF)', fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 700, color: form.tipo_promocao === 'percentual' ? 'var(--primary, #FF6FA9)' : 'var(--text-secondary, #6B7280)', cursor: "pointer" }}
                      >
                        % Desconto
                      </button>
                    </div>

                    {form.tipo_promocao === 'percentual' ? (
                      <div className="prod-field">
                        <label>Percentual de desconto</label>
                        <div className="prod-preco-input">
                          <span style={{ color: "var(--primary, #FF6FA9)" }}>%</span>
                          <input
                            type="text"
                            placeholder="Ex: 10, 20, 50..."
                            value={form.desconto_percentual || ""}
                            onChange={e => {
                              const v = e.target.value.replace(/[^0-9]/g, "");
                              const num = Math.min(100, parseInt(v) || 0);
                              setForm(f => ({ ...f, desconto_percentual: num, preco_promocional: num > 0 ? parseFloat((f.preco_normal * (1 - num / 100)).toFixed(2)) : 0 }));
                            }}
                          />
                        </div>
                        {form.desconto_percentual > 0 && form.preco_normal > 0 && (
                          <div style={{ marginTop: "6px", padding: "8px 12px", background: "#dcfce7", borderRadius: "8px" }}>
                            <p style={{ fontSize: "0.78rem", color: "var(--success, #22C55E)", fontWeight: 600, margin: 0 }}>
                              Preço base: R$ {formatPreco(form.preco_normal)} → R$ {formatPreco(form.preco_normal * (1 - (form.desconto_percentual || 0) / 100))}
                            </p>
                            {(form.tamanhos_disponiveis || []).length > 0 && (
                              <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px" }}>
                                {(form.tamanhos_disponiveis || []).map((t, i) => (
                                  <p key={i} style={{ fontSize: "0.72rem", color: "var(--success, #22C55E)", margin: 0 }}>
                                    {t.label}: R$ {formatPreco(t.preco)} → R$ {formatPreco(t.preco * (1 - (form.desconto_percentual || 0) / 100))}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="prod-field">
                        <label>Preço promocional</label>
                        <div className="prod-preco-input">
                          <span>R$</span>
                          <input type="text" placeholder="0,00" value={form.preco_promocional ? formatPreco(form.preco_promocional) : ""} onChange={e => setForm(f => ({ ...f, preco_promocional: parsePreco(e.target.value) }))} />
                        </div>
                        {form.preco_normal > 0 && form.preco_promocional > 0 && (
                          <p style={{ fontSize: "0.75rem", color: "var(--primary, #FF6FA9)", fontWeight: 600, margin: "4px 0 0" }}>
                            Desconto de {Math.round((1 - form.preco_promocional / form.preco_normal) * 100)}%
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Ficha técnica (CMV) */}
              <div className="prod-section">
                <p className="prod-section-label">🧪 Ficha técnica <span style={{ fontSize: "0.65rem", color: "var(--text-muted, #9CA3AF)", fontWeight: 500, marginLeft: 4 }}>· custo de produção</span></p>

                {fichaTecnica.length === 0 && !showInsumoPicker && (
                  <div className="ficha-empty">
                    <div className="ficha-empty-icon">🧪</div>
                    <p className="ficha-empty-text">
                      Adicione os insumos usados pra fazer <strong>1 unidade</strong> deste produto.<br />
                      Vamos calcular o custo e a margem sozinhos!
                    </p>
                  </div>
                )}

                {fichaTecnica.length > 0 && (
                  <div className="ficha-list">
                    {fichaTecnica.map(f => {
                      const ins = f.insumo;
                      if (!ins) return null;
                      const custoLinha = f.quantidade * (ins.custo_unitario || 0);
                      return (
                        <div key={f.insumo_id} className="ficha-row">
                          {ins.imagem_url
                            ? <img src={ins.imagem_url} alt={ins.nome} className="ficha-row-img" />
                            : <div className="ficha-row-img ficha-row-img--placeholder">🥣</div>}
                          <div className="ficha-row-info">
                            <p className="ficha-row-nome">{ins.nome}</p>
                            <p className="ficha-row-sub">R$ {(ins.custo_unitario || 0).toFixed(4)} / {ins.unidade}</p>
                          </div>
                          <div className="ficha-row-qtd">
                            <input
                              type="number"
                              value={f.quantidade || ""}
                              onChange={e => atualizarQtdFicha(f.insumo_id, parseFloat(e.target.value) || 0)}
                              step="any"
                              min="0"
                              placeholder="0"
                            />
                            <span>{ins.unidade}</span>
                          </div>
                          <div className="ficha-row-custo">R$ {custoLinha.toFixed(2)}</div>
                          <button className="ficha-row-del" onClick={() => removerInsumoFicha(f.insumo_id)} aria-label="Remover">✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!showInsumoPicker ? (
                  insumosCadastrados.length === 0 ? (
                    <div className="ficha-no-insumos">
                      <p>Você ainda não cadastrou insumos. <a href="/insumos" style={{ color: "var(--primary, #FF6FA9)", fontWeight: 700 }}>Cadastrar agora →</a></p>
                    </div>
                  ) : (
                    <button type="button" className="ficha-btn-add" onClick={() => setShowInsumoPicker(true)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Adicionar insumo
                    </button>
                  )
                ) : (
                  <div className="ficha-picker">
                    <input
                      type="text"
                      className="ficha-picker-search"
                      placeholder="Buscar insumo..."
                      value={buscaInsumo}
                      onChange={e => setBuscaInsumo(e.target.value)}
                      autoFocus
                    />
                    <div className="ficha-picker-list">
                      {insumosCadastrados
                        .filter(i => !fichaTecnica.some(f => f.insumo_id === i.id))
                        .filter(i => i.nome.toLowerCase().includes(buscaInsumo.toLowerCase()))
                        .map(i => (
                          <button key={i.id} type="button" className="ficha-picker-item" onClick={() => adicionarInsumoFicha(i)}>
                            {i.imagem_url
                              ? <img src={i.imagem_url} alt={i.nome} className="ficha-row-img" />
                              : <div className="ficha-row-img ficha-row-img--placeholder">🥣</div>}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p className="ficha-row-nome">{i.nome}</p>
                              <p className="ficha-row-sub">R$ {(i.custo_unitario || 0).toFixed(4)} / {i.unidade}</p>
                            </div>
                          </button>
                        ))}
                      {insumosCadastrados.filter(i => !fichaTecnica.some(f => f.insumo_id === i.id) && i.nome.toLowerCase().includes(buscaInsumo.toLowerCase())).length === 0 && (
                        <p style={{ textAlign: "center", color: "var(--text-muted, #9CA3AF)", fontSize: "0.78rem", padding: "0.85rem 0", margin: 0 }}>
                          Nenhum insumo encontrado
                        </p>
                      )}
                    </div>
                    <button type="button" className="ficha-picker-close" onClick={() => { setShowInsumoPicker(false); setBuscaInsumo(""); }}>
                      Fechar
                    </button>
                  </div>
                )}

                {fichaTecnica.length > 0 && (
                  <div className="ficha-resumo">
                    <div className="ficha-resumo-row">
                      <span>Custo de produção (CMV)</span>
                      <strong>R$ {cmvProduto.toFixed(2)}</strong>
                    </div>
                    <div className="ficha-resumo-row">
                      <span>Preço de venda</span>
                      <strong>R$ {form.preco_normal.toFixed(2)}</strong>
                    </div>
                    <div className={`ficha-resumo-margem ficha-resumo-margem--${margemProduto >= 50 ? "alto" : margemProduto >= 25 ? "medio" : "baixo"}`}>
                      <span>Margem de lucro</span>
                      <strong>{margemProduto.toFixed(0)}%</strong>
                    </div>
                    {margemProduto < 25 && form.preco_normal > 0 && (
                      <p className="ficha-alerta">
                        ⚠️ Margem baixa. Considere reajustar o preço ou revisar a ficha.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="prod-section">
                <p className="prod-section-label">📋 Status</p>
                <div className="prod-toggles" style={{ gap: "0.5rem" }}>
                  <Toggle label="Disponível" value={form.disponivel} onChange={(v: boolean) => setForm(f => ({ ...f, disponivel: v }))} colorClass="active-green" />
                  <Toggle label="Pronta entrega" value={form.pronta_entrega !== false} onChange={(v: boolean) => setForm(f => ({ ...f, pronta_entrega: v }))} colorClass="active-green" />
                </div>
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
              <button onClick={() => handleDelete(deleteConfirm)} style={{ background: "var(--error, #EF4444)", color: "var(--text-inverse, #FFFFFF)" }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      </>
      }

      <style>{`
        /* ── Tabs ── */
        .prod-tabs { display:flex; gap:0.25rem; background:var(--border, #E9E9EE); border-radius:12px; padding:4px; width:fit-content; margin-bottom:0.5rem; }
        .prod-tab { display:flex; align-items:center; gap:0.4rem; padding:0.5rem 1.1rem; border-radius:9px; border:none; background:transparent; font-family:'Geist',sans-serif; font-size:0.86rem; font-weight:600; color:var(--text-secondary, #6B7280); cursor:pointer; transition:all 0.18s; white-space:nowrap; }
        .prod-tab:hover { color:var(--text-title, #1F2937); background:rgba(255,255,255,0.6); }
        .prod-tab--active { background:var(--bg-card, #FFFFFF); color:var(--primary, #FF6FA9); box-shadow:0 1px 4px rgba(0,0,0,0.08); }
        @media(max-width:640px) { .prod-tabs { width:100%; } .prod-tab { flex:1; justify-content:center; padding:0.5rem 0.25rem; font-size:0.78rem; } }

        .prod-root { font-family:'Geist', sans-serif; max-width:800px; display:flex; flex-direction:column; gap:1rem; }
        .prod-spinner { width:32px; height:32px; border:3px solid var(--primary-light, #FFF1F7); border-top-color:var(--primary, #FF6FA9); border-radius:50%; animation:pspin 0.7s linear infinite; display:inline-block; }
        .prod-spinner-sm { width:18px; height:18px; border:2px solid rgba(255,255,255,0.4); border-top-color:white; border-radius:50%; animation:pspin 0.7s linear infinite; display:inline-block; }
        @keyframes pspin { to { transform:rotate(360deg); } }
        .prod-title { font-size:1.3rem; font-weight:700; color:var(--text-title, #1F2937); margin:0 0 0.15rem; }
        .prod-sub { font-size:0.82rem; color:var(--text-muted, #9CA3AF); margin:0; }
        .prod-btn-novo { display:flex; align-items:center; gap:0.4rem; padding:0.7rem 1.2rem; background:var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A)); color:var(--text-inverse, #FFFFFF); border:none; border-radius:50px; font-family:'Geist', sans-serif; font-size:0.88rem; font-weight:700; cursor:pointer; white-space:nowrap; }
        .prod-filtros { display:flex; gap:0.4rem; flex-wrap:wrap; }
        .prod-filtro-btn { padding:0.35rem 0.7rem; border:1.5px solid var(--border, #E9E9EE); border-radius:8px; background:var(--bg-card, #FFFFFF); font-family:'Geist', sans-serif; font-size:0.78rem; font-weight:500; color:var(--text-secondary, #6B7280); cursor:pointer; }
        .prod-filtro-btn.active { border-color:var(--primary, #FF6FA9); color:var(--primary, #FF6FA9); background:var(--primary-light, #FFF1F7); font-weight:700; }
        .prod-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.75rem; padding:3rem 1rem; text-align:center; }
        .prod-empty-title { font-size:1rem; font-weight:700; color:var(--text-title, #1F2937); margin:0; }
        .prod-empty-sub { font-size:0.82rem; color:var(--text-muted, #9CA3AF); margin:0; }
        .prod-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:0.75rem; }
        .prod-list { display:flex; flex-direction:column; gap:0.5rem; }
        .prod-list-item { background:var(--bg-card, #FFFFFF); border-radius:14px; padding:0.65rem; display:flex; align-items:center; gap:0.85rem; box-shadow:var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06)); }
        .prod-list-img { width:64px; height:64px; border-radius:10px; overflow:hidden; background:var(--primary-light, #FFF1F7); display:flex; align-items:center; justify-content:center; flex-shrink:0; position:relative; cursor:pointer; }
        .prod-list-img img { width:100%; height:100%; object-fit:cover; }
        .prod-list-info { flex:1; min-width:0; }
        .prod-card { background:var(--bg-card, #FFFFFF); border-radius:16px; overflow:hidden; box-shadow:var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06)); display:flex; flex-direction:column; }
        .prod-card-img { aspect-ratio:1; background:var(--bg-subtle, #FFF1F7); display:flex; align-items:center; justify-content:center; cursor:pointer; position:relative; overflow:hidden; }
        .prod-card-img img { width:100%; height:100%; object-fit:cover; }
        .prod-card-indisponivel { position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; color:white; font-size:0.72rem; font-weight:700; }
        .prod-card-promo { position:absolute; top:0.4rem; left:0.4rem; background:var(--primary, #FF6FA9); color:var(--text-inverse, #FFFFFF); font-size:0.65rem; font-weight:700; padding:0.15rem 0.45rem; border-radius:20px; }
        .prod-card-encomenda { position:absolute; top:0.4rem; right:0.4rem; background:var(--warning, #F59E0B); color:var(--text-inverse, #FFFFFF); font-size:0.65rem; font-weight:700; padding:0.15rem 0.45rem; border-radius:20px; }
        .prod-card-info { padding:0.65rem 0.75rem; flex:1; }
        .prod-card-cat { font-size:0.68rem; color:var(--primary, #FF6FA9); font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin:0 0 0.15rem; }
        .prod-card-nome { font-size:0.85rem; font-weight:700; color:var(--text-title, #1F2937); margin:0 0 0.25rem; line-height:1.3; }
        .prod-card-preco { font-size:0.88rem; font-weight:600; color:var(--success, #22C55E); margin:0; }
        .prod-card-actions { display:flex; gap:0.4rem; padding:0.5rem 0.75rem; border-top:1px solid var(--border, #E9E9EE); }
        .prod-card-btn-edit { flex:1; padding:0.4rem; background:var(--bg-subtle, #FFF1F7); border:none; border-radius:8px; font-family:'Geist', sans-serif; font-size:0.78rem; font-weight:600; color:var(--text-primary, #374151); cursor:pointer; }
        .prod-card-btn-del { padding:0.4rem 0.6rem; background:#fff1f2; border:none; border-radius:8px; color:var(--error, #EF4444); cursor:pointer; display:flex; align-items:center; }
        .prod-modal-overlay { position:fixed; inset:0; z-index:500; background:var(--bg-overlay); display:flex; align-items:flex-end; justify-content:center; padding:0 12px; }
        .prod-modal { background:var(--bg-card, #FFFFFF); border-radius:24px 24px 16px 16px; width:100%; max-width:520px; max-height:88vh; display:flex; flex-direction:column; animation:slideUp 0.25s ease; margin-bottom:12px; }
        @keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
        .prod-modal-header { display:flex; align-items:center; justify-content:space-between; padding:1.1rem 1.25rem 0.75rem; border-bottom:1px solid var(--border, #E9E9EE); flex-shrink:0; }
        .prod-modal-title { font-size:1rem; font-weight:700; color:var(--text-title, #1F2937); margin:0; }
        .prod-modal-close { background:var(--bg-subtle, #FFF1F7); border:none; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text-secondary, #6B7280); font-size:0.75rem; }
        .prod-modal-body { flex:1; overflow-y:auto; padding:1rem 1.25rem; display:flex; flex-direction:column; gap:1.25rem; }
        .prod-modal-footer { padding:1rem 1.25rem; border-top:1px solid var(--border, #E9E9EE); display:flex; gap:0.75rem; flex-shrink:0; }
        .prod-section { display:flex; flex-direction:column; gap:0.75rem; }
        .prod-section-label { font-size:0.78rem; font-weight:700; color:var(--primary, #FF6FA9); text-transform:uppercase; letter-spacing:0.06em; margin:0; }
        .prod-img-upload { width:120px; height:120px; border-radius:16px; border:2px dashed var(--primary-light, #FFF1F7); background:var(--primary-light, #FFF1F7); cursor:pointer; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; }
        .prod-img-placeholder { display:flex; flex-direction:column; align-items:center; gap:0.35rem; padding:0.75rem; text-align:center; }
        .prod-img-placeholder p { font-size:0.78rem; font-weight:600; color:var(--text-primary, #374151); margin:0; }
        .prod-img-placeholder span { font-size:0.68rem; color:var(--text-muted, #9CA3AF); }
        .prod-img-remove { position:absolute; top:0.35rem; right:0.35rem; background:rgba(0,0,0,0.5); border:none; border-radius:50%; width:22px; height:22px; color:white; font-size:0.65rem; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .prod-field { display:flex; flex-direction:column; gap:0.3rem; }
        .prod-field label { font-size:0.78rem; font-weight:600; color:var(--text-primary, #374151); }
        .prod-field input, .prod-field select, .prod-field textarea { padding:0.65rem 0.9rem; border:1.5px solid var(--border, #E9E9EE); border-radius:12px; font-family:'Geist', sans-serif; font-size:0.88rem; color:var(--text-title, #1F2937); background:var(--bg-input, #FFFFFF); outline:none; transition:border-color 0.2s; width:100%; box-sizing:border-box; }
        .prod-field input:focus, .prod-field select:focus, .prod-field textarea:focus { border-color:var(--border-focus, #FF6FA9); }
        .prod-field textarea { resize:none; }
        .prod-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; }
        .prod-preco-input { display:flex; align-items:center; border:1.5px solid var(--border, #E9E9EE); border-radius:12px; overflow:hidden; background:var(--bg-input, #FFFFFF); }
        .prod-preco-input span { padding:0 0.75rem; font-weight:700; color:var(--success, #22C55E); font-size:0.88rem; flex-shrink:0; }
        .prod-preco-input input { border:none !important; border-radius:0 !important; flex:1; padding:0.65rem 0.5rem 0.65rem 0 !important; outline:none !important; box-shadow:none !important; }
        .prod-preco-input:focus-within { border-color:var(--border-focus, #FF6FA9); }
        .prod-nova-cat { display:flex; gap:0.4rem; margin-top:0.4rem; }
        .prod-nova-cat input { flex:1; padding:0.55rem 0.8rem; border:1.5px solid var(--primary, #FF6FA9); border-radius:10px; font-family:'Geist', sans-serif; font-size:0.85rem; outline:none; }
        .prod-nova-cat button { padding:0.55rem 0.9rem; background:var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A)); color:var(--text-inverse, #FFFFFF); border:none; border-radius:10px; font-family:'Geist', sans-serif; font-size:0.82rem; font-weight:700; cursor:pointer; white-space:nowrap; }
        .prod-toggles { display:flex; gap:0.75rem; flex-wrap:wrap; }
        .prod-toggle-item { display:flex; align-items:center; gap:0.5rem; padding:0.5rem 0.75rem; border-radius:10px; background:var(--bg-subtle, #FFF1F7); cursor:pointer; font-size:0.8rem; font-weight:600; color:var(--text-primary, #374151); transition:all 0.2s; flex:1; min-width:100px; }
        .prod-toggle-item.active-green { background:#dcfce7; color:#15803d; }
        .prod-toggle-item.active-pink { background:var(--primary-light, #FFF1F7); color:var(--primary-dark, #F85A9A); }
        .prod-toggle-slider { width:40px; height:22px; border-radius:11px; background:var(--border, #E9E9EE); position:relative; flex-shrink:0; transition:background 0.2s; }
        .prod-toggle-thumb { width:18px; height:18px; border-radius:50%; background:white; position:absolute; top:2px; left:2px; transition:transform 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.2); }
        .prod-btn-cancelar { flex:1; padding:0.85rem; background:var(--bg-body, #F7F7F8); border:none; border-radius:50px; font-family:'Geist', sans-serif; font-size:0.9rem; font-weight:600; color:var(--text-secondary, #6B7280); cursor:pointer; }
        .prod-btn-salvar { flex:2; padding:0.85rem; background:var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A)); color:var(--text-inverse, #FFFFFF); border:none; border-radius:50px; font-family:'Geist', sans-serif; font-size:0.9rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .prod-btn-salvar:disabled { opacity:0.65; cursor:not-allowed; }
        .prod-confirm { background:var(--bg-card, #FFFFFF); border-radius:18px; padding:1.5rem; width:90%; max-width:320px; margin:auto; }
        .prod-confirm-title { font-size:1rem; font-weight:700; color:var(--text-title, #1F2937); margin:0 0 0.4rem; }
        .prod-confirm-sub { font-size:0.82rem; color:var(--text-muted, #9CA3AF); margin:0 0 1.25rem; }
        .prod-confirm-btns { display:flex; gap:0.75rem; }
        .prod-confirm-btns button { flex:1; padding:0.75rem; border:none; border-radius:50px; font-family:'Geist', sans-serif; font-size:0.88rem; font-weight:700; cursor:pointer; background:var(--bg-body, #F7F7F8); color:var(--text-secondary, #6B7280); }

        /* ════════════════════════════════════════════════════════════════ */
        /* IDENTIDADE DOONLY - PRODUTOS MOBILE                              */
        /* ════════════════════════════════════════════════════════════════ */

        .prod-root {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          padding-top: 1.25rem;
          padding-bottom: 6rem;
          font-family: 'Geist', sans-serif;
        }

        /* ── Tabs Produtos / Categorias ── */
        .prod-tabs-novo {
          display: flex;
          gap: 0.5rem;
          background: var(--bg-subtle, #F7EEF1);
          padding: 4px;
          border-radius: 12px;
        }
        .prod-tab-novo {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 0.6rem 0.75rem;
          background: transparent;
          border: none;
          border-radius: 9px;
          font-family: inherit;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary, #6E3548);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .prod-tab-novo.active {
          background: #fff;
          color: #3d1a24;
          box-shadow: 0 2px 6px rgba(61, 26, 36, 0.08);
        }

        /* ── Header título + botão ── */
        .prod-header-novo {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .prod-title-novo {
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--text-title, #431524);
          margin: 0;
          letter-spacing: -0.02em;
        }
        .prod-sub-novo {
          font-size: 0.78rem;
          color: var(--text-muted, #C39EAA);
          margin: 0.1rem 0 0;
        }
        .prod-btn-novo-novo {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: #3d1a24;
          color: white;
          border: none;
          border-radius: 10px;
          padding: 0.65rem 1rem;
          font-family: inherit;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(61, 26, 36, 0.18);
          transition: all 0.15s ease;
        }
        .prod-btn-novo-novo:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(61, 26, 36, 0.25);
        }

        /* ── Barra de busca ── */
        .prod-busca-novo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--bg-card, #fff);
          border: 1.5px solid var(--border, #ECC2D0);
          border-radius: 12px;
          padding: 0.6rem 0.9rem;
          transition: border-color 0.15s ease;
        }
        .prod-busca-novo:focus-within {
          border-color: #3d1a24;
        }
        .prod-busca-novo > svg:first-child {
          color: var(--text-muted, #C39EAA);
          flex-shrink: 0;
        }
        .prod-busca-novo input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-family: inherit;
          font-size: 0.9rem;
          color: var(--text-title, #431524);
          min-width: 0;
        }
        .prod-busca-novo input::placeholder {
          color: var(--text-muted, #C39EAA);
        }

        /* ── Filtros categoria ── */
        .prod-filtros {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 4px;
          margin: 0 -1rem;
          padding-left: 1rem;
          padding-right: 1rem;
          scrollbar-width: none;
        }
        .prod-filtros::-webkit-scrollbar { display: none; }
        .prod-filtro-btn {
          background: var(--bg-card, #fff);
          border: 1.5px solid var(--border, #ECC2D0);
          border-radius: 999px;
          padding: 0.45rem 0.95rem;
          font-family: inherit;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-secondary, #6E3548);
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition: all 0.15s ease;
        }
        .prod-filtro-btn:hover {
          border-color: #3d1a24;
          color: #3d1a24;
        }
        .prod-filtro-btn.active {
          background: #3d1a24;
          border-color: #3d1a24;
          color: white;
        }

        /* ── Lista / Grid de produtos ── */
        .prod-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }
        .prod-list {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }
        /* ── Ficha técnica (CMV) ── */
        .ficha-empty {
          display:flex; flex-direction:column; align-items:center; gap:0.5rem;
          padding:1.1rem 0.95rem; background:var(--bg-body, #F7F7F8);
          border-radius:12px; border:1.5px dashed var(--border, #E9E9EE);
          text-align:center;
        }
        .ficha-empty-icon { font-size:1.6rem; }
        .ficha-empty-text { margin:0; font-size:0.78rem; color:var(--text-secondary, #6B7280); line-height:1.45; max-width:300px; }
        .ficha-empty-text strong { color:var(--primary, #FF6FA9); font-weight:700; }

        .ficha-list { display:flex; flex-direction:column; gap:0.4rem; }
        .ficha-row {
          display:flex; align-items:center; gap:0.55rem;
          padding:0.55rem 0.65rem; background:var(--bg-card, #FFFFFF);
          border:1px solid var(--border, #E9E9EE); border-radius:12px;
        }
        .ficha-row-img {
          width:34px; height:34px; border-radius:9px;
          object-fit:cover; flex-shrink:0;
          background:var(--bg-body, #F7F7F8);
        }
        .ficha-row-img--placeholder { display:flex; align-items:center; justify-content:center; font-size:1rem; }
        .ficha-row-info { flex:1; min-width:0; }
        .ficha-row-nome {
          font-size:0.84rem; font-weight:600; color:var(--text-title, #1F2937);
          margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .ficha-row-sub { font-size:0.7rem; color:var(--text-muted, #9CA3AF); margin:1px 0 0; }
        .ficha-row-qtd {
          display:flex; align-items:center; gap:4px;
          padding:5px 8px; background:var(--bg-body, #F7F7F8);
          border-radius:8px; border:1.5px solid var(--border, #E9E9EE);
          transition:border-color 0.15s;
        }
        .ficha-row-qtd:focus-within { border-color:var(--primary, #FF6FA9); }
        .ficha-row-qtd input {
          width:54px; border:none; outline:none; background:transparent;
          font-family:inherit; font-size:0.85rem; font-weight:700;
          color:var(--text-title, #1F2937); text-align:right;
          -moz-appearance:textfield;
        }
        .ficha-row-qtd input::-webkit-outer-spin-button,
        .ficha-row-qtd input::-webkit-inner-spin-button {
          -webkit-appearance:none; margin:0;
        }
        .ficha-row-qtd span { font-size:0.72rem; color:var(--text-secondary, #6B7280); font-weight:600; }
        .ficha-row-custo {
          font-size:0.85rem; font-weight:800;
          color:var(--primary-dark, #F85A9A);
          min-width:64px; text-align:right;
          font-variant-numeric:tabular-nums;
        }
        .ficha-row-del {
          width:26px; height:26px; border-radius:50%;
          background:var(--bg-body, #F7F7F8); border:none;
          color:var(--text-muted, #9CA3AF);
          cursor:pointer; font-size:0.7rem;
          transition:all 0.15s; flex-shrink:0;
        }
        .ficha-row-del:hover { background:#fee2e2; color:var(--error, #EF4444); }

        .ficha-no-insumos {
          padding:0.85rem; background:var(--primary-light, #FFF1F7);
          border-radius:12px; text-align:center;
          font-size:0.8rem; color:var(--text-secondary, #6B7280);
        }
        .ficha-no-insumos p { margin:0; }

        .ficha-btn-add {
          display:inline-flex; align-items:center; gap:5px;
          align-self:flex-start;
          padding:0.55rem 1rem;
          background:var(--primary-light, #FFF1F7);
          color:var(--primary, #FF6FA9);
          border:1.5px dashed var(--primary, #FF6FA9);
          border-radius:50px;
          font-family:inherit; font-size:0.8rem; font-weight:700;
          cursor:pointer; transition:all 0.15s;
        }
        .ficha-btn-add:hover {
          background:var(--primary, #FF6FA9); color:#fff; border-style:solid;
          box-shadow:0 3px 10px rgba(255,111,169,0.3);
        }

        .ficha-picker {
          display:flex; flex-direction:column; gap:0.55rem;
          padding:0.85rem; background:var(--primary-light, #FFF1F7);
          border:1.5px solid var(--primary, #FF6FA9); border-radius:14px;
        }
        .ficha-picker-search {
          width:100%; padding:0.55rem 0.85rem;
          border:1.5px solid var(--border, #E9E9EE); border-radius:10px;
          font-family:inherit; font-size:0.85rem; outline:none;
          background:var(--bg-card, #FFFFFF); box-sizing:border-box;
        }
        .ficha-picker-search:focus { border-color:var(--primary, #FF6FA9); }
        .ficha-picker-list {
          display:flex; flex-direction:column; gap:4px;
          max-height:200px; overflow-y:auto;
        }
        .ficha-picker-item {
          display:flex; align-items:center; gap:0.55rem;
          padding:0.55rem 0.65rem;
          background:var(--bg-card, #FFFFFF);
          border:1.5px solid transparent; border-radius:10px;
          cursor:pointer; text-align:left;
          font-family:inherit; transition:all 0.15s;
        }
        .ficha-picker-item:hover {
          border-color:var(--primary, #FF6FA9);
          transform:translateY(-1px);
          box-shadow:0 3px 10px rgba(255,111,169,0.15);
        }
        .ficha-picker-close {
          align-self:flex-end;
          padding:0.4rem 1rem;
          background:var(--bg-card, #FFFFFF);
          border:1px solid var(--border, #E9E9EE); border-radius:50px;
          font-family:inherit; font-size:0.76rem; font-weight:600;
          color:var(--text-secondary, #6B7280); cursor:pointer;
        }

        .ficha-resumo {
          padding:0.85rem 1rem;
          background:linear-gradient(135deg, #FFE4F0 0%, #FFF1F7 100%);
          border:1px solid rgba(255,111,169,0.25);
          border-radius:14px;
          display:flex; flex-direction:column; gap:0.4rem;
        }
        .ficha-resumo-row {
          display:flex; justify-content:space-between; align-items:center;
          font-size:0.82rem; color:var(--text-primary, #374151);
        }
        .ficha-resumo-row strong {
          color:var(--text-title, #1F2937); font-weight:800;
          font-variant-numeric:tabular-nums;
        }
        .ficha-resumo-margem {
          display:flex; justify-content:space-between; align-items:center;
          padding:0.55rem 0.85rem; margin-top:0.25rem;
          border-radius:10px;
          font-size:0.9rem; font-weight:700;
        }
        .ficha-resumo-margem strong { font-size:1.05rem; font-weight:800; }
        .ficha-resumo-margem--alto { background:#dcfce7; color:#15803d; }
        .ficha-resumo-margem--medio { background:#fef3c7; color:#a16207; }
        .ficha-resumo-margem--baixo { background:#fee2e2; color:#b91c1c; }
        .ficha-alerta {
          margin:0; padding:0.55rem 0.85rem;
          background:#fef3c7; color:#92400e;
          border-radius:10px; font-size:0.76rem; font-weight:600;
        }

      `}</style>
    </div>
    </>
  );
}

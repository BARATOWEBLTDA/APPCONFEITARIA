import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { usePlano } from "@/hooks/usePlano";
import { ImageCropper } from "@/components/ui/ImageCropper";
import EmptyDoo from "@/components/EmptyDoo";
import BtnNovo from "@/components/BtnNovo";
import Categorias from "@/pages/Categorias";
import QuickAddInsumo from "@/components/QuickAddInsumo";

// ── Helpers de conversão de unidades (ficha técnica) ──
const UNIT_FAMILIES_MAP: Record<string, { family: string; base: string; toBase: number }> = {
  kg: { family: "massa", base: "kg", toBase: 1 },
  g:  { family: "massa", base: "kg", toBase: 0.001 },
  L:  { family: "volume", base: "L", toBase: 1 },
  ml: { family: "volume", base: "L", toBase: 0.001 },
  un: { family: "unidade", base: "un", toBase: 1 },
};

function getCompatibleUnitsProd(unidadeInsumo: string): string[] {
  const info = UNIT_FAMILIES_MAP[unidadeInsumo];
  if (!info) return [unidadeInsumo];
  return Object.entries(UNIT_FAMILIES_MAP).filter(([, v]) => v.family === info.family).map(([k]) => k);
}

function getDefaultRecipeUnitProd(unidadeInsumo: string): string {
  const info = UNIT_FAMILIES_MAP[unidadeInsumo];
  if (!info) return unidadeInsumo;
  if (info.family === "massa") return "g";
  if (info.family === "volume") return "ml";
  return unidadeInsumo;
}

function calcCustoProd(qtd: number, unidadeUtilizada: string, unidadeInsumo: string, custoUnitario: number): number {
  const fU = UNIT_FAMILIES_MAP[unidadeUtilizada];
  const fI = UNIT_FAMILIES_MAP[unidadeInsumo];
  if (fU && fI && fU.family === fI.family && fI.toBase > 0) {
    return (qtd * fU.toBase / fI.toBase) * custoUnitario;
  }
  return qtd * custoUnitario;
}

function toBaseProd(qtd: number, unidade: string): number {
  const info = UNIT_FAMILIES_MAP[unidade];
  return info ? qtd * info.toBase : qtd;
}

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
  tem_adicionais?: boolean;
  tipo_promocao?: 'fixo' | 'percentual';
  desconto_percentual?: number;
  created_at?: string;
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
  tem_adicionais: false,
  tipo_promocao: 'fixo' as const, desconto_percentual: 0,
};

export default function Produtos() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"produtos"|"categorias">("produtos");
  const [userId, setUserId] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modal, setModal] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardTipo, setWizardTipo] = useState<"simples" | "variacoes">("simples");
  const [wizardOpts, setWizardOpts] = useState({ complementos: false, personalizacao: false, promocao: false });
  const [form, setForm] = useState<Produto>(EMPTY);
  const [ordenarPor, setOrdenarPor] = useState<"recentes"|"alfabetica"|"categoria"|"preco">("recentes");
  const [showOrdenar, setShowOrdenar] = useState(false);
  const [filtroOrfaos, setFiltroOrfaos] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [novaCategoriaIcone, setNovaCategoriaIcone] = useState("");
  const [showCatInput, setShowCatInput] = useState(false);
  const [savingCat, setSavingCat] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [previewProduto, setPreviewProduto] = useState<Produto | null>(null);
  const [novaOpcao, setNovaOpcao] = useState<{ massa: string; recheio: string; cobertura: string }>({ massa: "", recheio: "", cobertura: "" });
  const [novoTamanho, setNovoTamanho] = useState({ label: "", preco: "" });
  const [novoKitItem, setNovoKitItem] = useState({ nome: "", quantidade: "" });
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropSlot, setCropSlot] = useState(0);
  const [viewMode, setViewMode] = useState<"grid" | "lista">(() => (localStorage.getItem("prod_viewMode") as "grid" | "lista") || "grid");
  const [buscaTexto, setBuscaTexto] = useState("");

  // Ficha técnica (CMV)
  type Insumo = { id: string; nome: string; unidade: string; custo_unitario: number; imagem_url?: string };
  type FichaItem = { insumo_id: string; quantidade: number; unidade_utilizada: string; insumo?: Insumo };
  const [insumosCadastrados, setInsumosCadastrados] = useState<Insumo[]>([]);
  const [fichaTecnica, setFichaTecnica] = useState<FichaItem[]>([]);
  const [buscaInsumo, setBuscaInsumo] = useState("");
  // Modal dedicado da ficha técnica
  const [fichaModalOpen, setFichaModalOpen] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddInitialName, setQuickAddInitialName] = useState("");

  const imgRef = useRef<HTMLInputElement>(null);
  const img2Ref = useRef<HTMLInputElement>(null);
  const img3Ref = useRef<HTMLInputElement>(null);
  const { isPro } = usePlano();

  // Auto-abre cadastro quando vem de Pedidos
  useEffect(() => {
    if (!loading && (location.state as any)?.abrirCadastro) {
      setModal(true);
      window.history.replaceState({}, "");
    }
  }, [loading, location.state]);

  // Bloqueia scroll quando modal aberto
  useEffect(() => {
    if (modal) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }
    return () => { document.documentElement.style.overflow = ""; document.body.style.overflow = ""; };
  }, [modal]);

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
    const { data } = await supabase
      .from("produtos")
      .select("*, produto_insumos(quantidade, unidade_utilizada, insumos(custo_unitario, unidade))")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (data) setProdutos(data as Produto[]);
  };

  /**
   * Calcula CMV (custo), lucro absoluto e margem % de um produto a partir
   * da ficha técnica embutida (produto_insumos).
   * Considera preço promocional quando o produto está em promoção,
   * para refletir o lucro REAL que a confeiteira terá na venda.
   */
  const calcularLucro = (p: any): {
    cmv: number;
    lucro: number;
    margem: number;
    temFicha: boolean;
    precoEfetivo: number;
  } => {
    const itens: any[] = p.produto_insumos || [];
    // Mapa de conversão para unidade base
    const toBaseFactor: Record<string, number> = { kg: 1, g: 0.001, L: 1, ml: 0.001, un: 1 };
    const cmv = itens.reduce((sum, pi) => {
      const qtd = Number(pi.quantidade) || 0;
      const custo = Number(pi.insumos?.custo_unitario) || 0;
      const unidadeUtilizada = pi.unidade_utilizada || pi.insumos?.unidade || "";
      const unidadeInsumo = pi.insumos?.unidade || "";
      const fU = toBaseFactor[unidadeUtilizada];
      const fI = toBaseFactor[unidadeInsumo];
      if (fU != null && fI != null && fI > 0) {
        return sum + (qtd * fU / fI) * custo;
      }
      return sum + qtd * custo;
    }, 0);
    const precoEfetivo = (p.promocao && p.preco_promocional && p.preco_promocional > 0)
      ? Number(p.preco_promocional)
      : Number(p.preco_normal) || 0;
    const lucro = precoEfetivo - cmv;
    const margem = precoEfetivo > 0 ? (lucro / precoEfetivo) * 100 : 0;
    return { cmv, lucro, margem, temFicha: itens.length > 0, precoEfetivo };
  };

  const loadCategorias = async (uid: string) => {
    const { data } = await supabase.from("categorias").select("nome").eq("user_id", uid).order("nome");
    if (data) setCategorias(data.map((c: any) => c.nome));
  };

  const openNovo = () => { setForm(EMPTY); setFichaTecnica([]); setWizardStep(1); setWizardTipo("simples"); setWizardOpts({ complementos: false, personalizacao: false, promocao: false }); setModal(true); };
  const openEditar = async (p: Produto) => {
    setForm({ ...EMPTY, ...p });
    setFichaTecnica([]);
    setWizardStep(2);
    setModal(true);
    if (p.id && userId) {
      const { data } = await supabase
        .from("produto_insumos")
        .select("insumo_id, quantidade, unidade_utilizada, insumos(id, nome, unidade, custo_unitario, imagem_url)")
        .eq("produto_id", p.id);
      if (data) {
        setFichaTecnica(data.map((d: any) => ({
          insumo_id: d.insumo_id,
          quantidade: Number(d.quantidade) || 0,
          unidade_utilizada: d.unidade_utilizada || (d.insumos as any)?.unidade || "",
          insumo: d.insumos as Insumo,
        })));
      }
    }
  };
  const fecharModal = () => { setModal(false); setForm(EMPTY); setFichaTecnica([]); setFichaModalOpen(false); setShowQuickAdd(false); setBuscaInsumo(""); setWizardStep(1); setWizardTipo("simples"); setWizardOpts({ complementos: false, personalizacao: false, promocao: false }); };

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
        .map(f => ({
          user_id: userId,
          produto_id: produtoId,
          insumo_id: f.insumo_id,
          quantidade: f.quantidade,
          unidade_utilizada: f.unidade_utilizada,
          quantidade_base: toBaseProd(f.quantidade, f.unidade_utilizada),
        }));
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
    setFichaTecnica(prev => [...prev, { insumo_id: ins.id, quantidade: 0, unidade_utilizada: getDefaultRecipeUnitProd(ins.unidade), insumo: ins }]);
    setBuscaInsumo("");
  };
  const removerInsumoFicha = (id: string) => {
    setFichaTecnica(prev => prev.filter(f => f.insumo_id !== id));
  };
  const atualizarQtdFicha = (id: string, qtd: number) => {
    setFichaTecnica(prev => prev.map(f => f.insumo_id === id ? { ...f, quantidade: qtd } : f));
  };
  const atualizarUnidadeFicha = (id: string, unidade: string) => {
    setFichaTecnica(prev => prev.map(f => f.insumo_id === id ? { ...f, unidade_utilizada: unidade } : f));
  };

  // Cadastro rápido de insumo (delega ao componente QuickAddInsumo)
  const abrirQuickAdd = (nomeInicial?: string) => {
    setQuickAddInitialName(nomeInicial || "");
    setShowQuickAdd(true);
  };
  const fecharQuickAdd = () => {
    setShowQuickAdd(false);
    setQuickAddInitialName("");
  };
  const handleInsumoSalvoRapido = (novoInsumo: Insumo) => {
    setInsumosCadastrados(prev => [...prev, novoInsumo]);
    setFichaTecnica(prev => [...prev, { insumo_id: novoInsumo.id, quantidade: 0, unidade_utilizada: getDefaultRecipeUnitProd(novoInsumo.unidade), insumo: novoInsumo }]);
    fecharQuickAdd();
  };

  const cmvProduto = fichaTecnica.reduce(
    (s, f) => s + calcCustoProd(f.quantidade, f.unidade_utilizada, f.insumo?.unidade || "", f.insumo?.custo_unitario || 0),
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
    let lista = [...produtos];
    if (buscaTexto.trim()) {
      const t = buscaTexto.toLowerCase();
      lista = lista.filter(p => p.nome.toLowerCase().includes(t) || p.descricao?.toLowerCase().includes(t));
    }
    switch (ordenarPor) {
      case "alfabetica":
        lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        break;
      case "categoria":
        lista.sort((a, b) => (a.categoria || "").localeCompare(b.categoria || "", "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR"));
        break;
      case "preco":
        lista.sort((a, b) => a.preco_normal - b.preco_normal);
        break;
      case "recentes":
      default:
        lista.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        break;
    }
    return lista;
  })();
  const todasCategorias = Array.from(new Set([...categorias, ...produtos.map(p => p.categoria).filter(Boolean)])).sort();

  const Toggle = ({ label, value, onChange, colorClass }: any) => (
    <div className={`prod-toggle-item${value ? ` ${colorClass}` : ""}`} onClick={() => onChange(!value)}>
      <div className={`prod-toggle-slider${value ? " active" : ""}`} style={{ background: value ? (colorClass === "active-green" ? "var(--success)" : "var(--primary)") : "var(--border)" }}>
        <div className="prod-toggle-thumb" style={{ transform: value ? "translateX(20px)" : "translateX(0)" }} />
      </div>
      <span>{label}</span>
    </div>
  );

  const TagList = ({ items, onRemove }: { items: string[], onRemove: (i: number) => void }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "var(--primary-light)", color: "var(--primary-dark)", borderRadius: "50px", fontSize: "0.8rem", fontWeight: 600 }}>
          {item}
          <button onClick={() => onRemove(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary-dark)", padding: 0, lineHeight: 1, fontSize: "0.85rem" }}>×</button>
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
        <BtnNovo label="Novo produto" onClick={openNovo} />
      </div>

      {/* Barra de pesquisa */}
      <div className="prod-busca-novo">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          type="text"
          placeholder="Buscar produto..."
          value={buscaTexto}
          onChange={e => setBuscaTexto(e.target.value)}
        />
        <div style={{ display: "flex", background: "white", borderRadius: 8, padding: 2, gap: 2, border: "1.5px solid var(--border)", flexShrink: 0 }}>
          <button onClick={() => { setViewMode("grid"); localStorage.setItem("prod_viewMode", "grid"); }} style={{ width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer", background: viewMode === "grid" ? "#3d1a24" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }} title="Grade">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={viewMode === "grid" ? "white" : "var(--text-muted)"} strokeWidth="2.2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
          <button onClick={() => { setViewMode("lista"); localStorage.setItem("prod_viewMode", "lista"); }} style={{ width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer", background: viewMode === "lista" ? "#3d1a24" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }} title="Lista">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={viewMode === "lista" ? "white" : "var(--text-muted)"} strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
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
            <button onClick={() => setFiltroOrfaos(true)} style={{ padding: "5px 12px", background: "var(--warning)", color: "white", border: "none", borderRadius: "8px", fontFamily: "inherit", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              Ver {orfaos.length}
            </button>
          </div>
        );
      })()}

      {/* Ordenar por */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setShowOrdenar(!showOrdenar)}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "0.4rem 0.75rem", border: "1.5px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--bg-card)", fontFamily: "var(--font-base)", fontSize: "var(--font-helper)", fontWeight: "var(--fw-medium)", color: "var(--text-secondary)", cursor: "pointer" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M6 12h12M9 18h6"/></svg>
          {{ recentes: "Mais recentes", alfabetica: "Alfabética", categoria: "Categoria", preco: "Preço" }[ordenarPor]}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {showOrdenar && (
          <>
            <div onClick={() => setShowOrdenar(false)} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: "var(--bg-card)", border: "1.5px solid var(--border)", borderRadius: "var(--radius-md)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100, minWidth: "180px", overflow: "hidden" }}>
              {([
                { value: "recentes", label: "Mais recentes" },
                { value: "alfabetica", label: "Alfabética" },
                { value: "categoria", label: "Categoria" },
                { value: "preco", label: "Preço" },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setOrdenarPor(opt.value); setShowOrdenar(false); setFiltroOrfaos(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "0.6rem 0.85rem",
                    border: "none", background: ordenarPor === opt.value ? "var(--primary-light)" : "transparent",
                    fontFamily: "var(--font-base)", fontSize: "0.85rem", fontWeight: ordenarPor === opt.value ? 700 : 500,
                    color: ordenarPor === opt.value ? "var(--primary)" : "var(--text-primary)", cursor: "pointer", textAlign: "left",
                  }}
                >
                  {opt.label}
                  {ordenarPor === opt.value && <svg style={{ marginLeft: "auto" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {produtosFiltrados.length === 0 ? (
        <EmptyDoo
          image="produtos.png"
          title={<>Vamos cadastrar seu<br/>primeiro produto?</>}
          description="Seu catálogo é a vitrine da sua confeitaria. Quanto mais completo, mais profissional ele será."
          actionLabel="Cadastrar primeiro produto"
          onAction={openNovo}
        />
      ) : (
        <div className={viewMode === "grid" ? "prod-grid" : "prod-list"}>
          {(filtroOrfaos
            ? produtos.filter(p => p.categoria && !categorias.includes(p.categoria))
            : produtosFiltrados
          ).map(p => {
            const catInvalida = p.categoria && !categorias.includes(p.categoria);
            if (viewMode === "lista") return (
              <div key={p.id} className="prod-list-item" style={{ outline: catInvalida ? "2px solid #fcd34d" : "none", cursor: "pointer" }} onClick={() => setPreviewProduto(p)}>
                <div className="prod-list-img">
                  {p.imagem_url ? <img src={p.imagem_url.split(",")[0]} alt={p.nome} /> : <span style={{ fontSize: "1.5rem" }}>🎂</span>}
                  {!p.disponivel && <div className="prod-card-indisponivel">Indisponível</div>}
                </div>
                <div className="prod-list-info">
                  <p className="prod-card-nome">{p.nome}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "nowrap" }}>
                    {p.promocao && p.preco_promocional && p.preco_promocional > 0 ? (
                      <>
                        <span style={{ textDecoration: "line-through", color: "var(--text-muted)", fontSize: "0.75rem" }}>R$ {formatPreco(p.preco_normal)}</span>
                        <p className="prod-card-preco" style={{ margin: 0 }}>R$ {formatPreco(p.preco_promocional)}</p>
                      </>
                    ) : (
                      <p className="prod-card-preco" style={{ margin: 0 }}>R$ {formatPreco(p.preco_normal)}</p>
                    )}
                    {p.promocao && <span style={{ background: "var(--primary)", color: "var(--text-inverse)", fontSize: "0.55rem", fontWeight: 700, padding: "2px 5px", borderRadius: "6px" }}>Promoção</span>}
                  </div>
                  {(() => {
                    const { lucro, margem, temFicha } = calcularLucro(p);
                    if (!temFicha) {
                      return (
                        <button
                          type="button"
                          className="prod-card-sem-ficha"
                          onClick={(e) => { e.stopPropagation(); navigate("/ficha-tecnica", { state: { produtoId: p.id } }); }}
                        >
                          Configure a<br/>Ficha Técnica
                        </button>
                      );
                    }
                    const tier = margem >= 50 ? "alto" : margem >= 25 ? "medio" : "baixo";
                    return (
                      <div className={`prod-card-lucro prod-card-lucro--${tier}`}>
                        <span className="prod-card-lucro-label">Lucro/venda</span>
                        <strong>R$ {formatPreco(lucro)} <span className="prod-card-lucro-pct">({margem.toFixed(0)}%)</span></strong>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
            return (
            <div key={p.id} className="prod-card" style={{ outline: catInvalida ? "2px solid #fcd34d" : "none", cursor: "pointer" }} onClick={() => setPreviewProduto(p)}>
              <div className="prod-card-img">
                {p.imagem_url ? <img src={p.imagem_url.split(",")[0]} alt={p.nome} /> : <span style={{ fontSize: "2rem" }}>🎂</span>}
                {!p.disponivel && <div className="prod-card-indisponivel">Indisponível</div>}
                {p.promocao && <div className="prod-card-promo">Promoção</div>}
                {p.pronta_entrega === false && <div className="prod-card-encomenda">Encomenda</div>}
                {catInvalida && <div style={{ position: "absolute", top: "0.4rem", left: "0.4rem", background: "var(--warning)", color: "var(--text-inverse)", fontSize: "0.6rem", fontWeight: 700, padding: "2px 6px", borderRadius: "6px" }}>Sem categoria</div>}
              </div>
              <div className="prod-card-info">
                <p className="prod-card-cat" style={{ color: catInvalida ? "var(--warning)" : undefined }}>{catInvalida ? p.categoria : p.categoria}</p>
                <p className="prod-card-nome">{p.nome}</p>
                {p.promocao && p.preco_promocional && p.preco_promocional > 0 ? (
                  <p className="prod-card-preco" style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "nowrap" }}>
                    <span style={{ textDecoration: "line-through", color: "var(--text-muted)", fontWeight: "var(--fw-medium)" as any, fontSize: "0.75rem" }}>R$ {formatPreco(p.preco_normal)}</span>
                    <span>R$ {formatPreco(p.preco_promocional)}</span>
                  </p>
                ) : (
                  <p className="prod-card-preco">R$ {formatPreco(p.preco_normal)}</p>
                )}
                <div className="prod-card-bottom">
                {(() => {
                  const { lucro, margem, temFicha } = calcularLucro(p);
                  if (!temFicha) {
                    return (
                      <button
                        type="button"
                        className="prod-card-sem-ficha"
                        onClick={(e) => { e.stopPropagation(); navigate("/ficha-tecnica", { state: { produtoId: p.id } }); }}
                        title="Adicione insumos para ver o lucro por venda"
                      >
                        Configure a<br/>Ficha Técnica
                      </button>
                    );
                  }
                  const tier = margem >= 50 ? "alto" : margem >= 25 ? "medio" : "baixo";
                  return (
                    <div className={`prod-card-lucro prod-card-lucro--${tier}`}>
                      <span className="prod-card-lucro-label">Lucro/venda</span>
                      <strong>R$ {formatPreco(lucro)} <span className="prod-card-lucro-pct">({margem.toFixed(0)}%)</span></strong>
                    </div>
                  );
                })()}
                </div>
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
              {wizardStep === 2 && !form.id && (
                <button className="prod-modal-back" onClick={() => setWizardStep(1)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                </button>
              )}
              <h2 className="prod-modal-title">{form.id ? "Editar Produto" : wizardStep === 1 ? "Criar Novo Produto" : "Novo Produto"}</h2>
              <button className="prod-modal-close" onClick={fecharModal}>✕</button>
            </div>

            {/* ══════ WIZARD STEP 1 ══════ */}
            {wizardStep === 1 && (
              <div className="prod-modal-body">
                <div>
                  <p className="wiz-subtitle">Vamos configurar seu produto para aparecer no seu catálogo.</p>
                  <p className="wiz-reassurance">Você poderá editar essas configurações quando quiser.</p>
                </div>

                {/* Barra de progresso */}
                <div>
                  <p className="wiz-step-label">Passo 1 de 2</p>
                  <div className="wiz-progress">
                    <div className="wiz-progress-bar wiz-progress-bar--active" />
                    <div className="wiz-progress-bar" />
                  </div>
                </div>

                {/* Tipo */}
                <p className="wiz-section-title">Como é o seu produto?</p>
                <div className="wiz-tipo-list">
                  {[
                    { tipo: "simples" as const, icon: "📦", title: "Produto simples", desc: "Uma única versão.", example: "Ex.: Pudim Tradicional" },
                    { tipo: "variacoes" as const, icon: "🎂", title: "Com variações", desc: "Possui tamanhos, sabores ou versões diferentes.", example: "Ex.: Bolo de Chocolate — 15cm, 20cm, 25cm" },
                  ].map(({ tipo, icon, title, desc, example }) => (
                    <button key={tipo} className={`wiz-tipo-card${wizardTipo === tipo ? " wiz-tipo-card--active" : ""}`} onClick={() => setWizardTipo(tipo)}>
                      {wizardTipo === tipo && <div className="wiz-card-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-inverse)" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>}
                      <span className="wiz-tipo-icon">{icon}</span>
                      <p className="wiz-tipo-title">{title}</p>
                      <p className="wiz-tipo-desc">{desc}</p>
                      <p className="wiz-tipo-example">{example}</p>
                    </button>
                  ))}
                </div>

                {/* Recursos extras */}
                <p className="wiz-section-title">Recursos extras</p>
                <p className="wiz-micro">Escolha apenas o necessário. Você poderá adicionar mais opções depois.</p>
                <div className="wiz-opts-list">
                  {[
                    { key: "personalizacao" as const, icon: "🎨", title: "Personalização", desc: "Permita que o cliente escolha opções do produto.", example: "Ex.: massa, recheio e cobertura." },
                    { key: "complementos" as const, icon: "🎁", title: "Complementos", desc: "Itens que podem ser adicionados ao pedido.", example: "Ex.: vela, topo de bolo e embalagem especial." },
                  ].map(({ key, icon, title, desc, example }) => (
                    <button key={key} className={`wiz-opt-card${wizardOpts[key] ? " wiz-opt-card--active" : ""}`} onClick={() => setWizardOpts(o => ({ ...o, [key]: !o[key] }))}>
                      <div className={`wiz-opt-check${wizardOpts[key] ? " wiz-opt-check--active" : ""}`}>
                        {wizardOpts[key] && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-inverse)" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <div>
                        <p className="wiz-opt-title"><span>{icon}</span> {title}</p>
                        <p className="wiz-opt-desc">{desc}</p>
                        <p className="wiz-opt-example">{example}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Footer step 1 */}
                <div className="wiz-footer">
                  <button className="prod-btn-cancelar" onClick={fecharModal}>Cancelar</button>
                  <button className="prod-btn-salvar" onClick={() => {
                    setForm(f => ({
                      ...f,
                      forma_venda: wizardTipo === "simples" ? "unidade" : f.forma_venda,
                      permite_personalizacao: wizardOpts.personalizacao,
                      tem_adicionais: wizardOpts.complementos,
                      promocao: wizardOpts.promocao,
                    }));
                    setWizardStep(2);
                  }}>
                    Continuar
                  </button>
                </div>
              </div>
            )}

            {/* ══════ WIZARD STEP 2 (FORMULÁRIO) ══════ */}
            {wizardStep === 2 && (
            <div className="prod-modal-body">

              {/* Barra de progresso */}
              {!form.id && (
                <div>
                  <p className="wiz-step-label">Passo 2 de 2</p>
                  <div className="wiz-progress">
                    <div className="wiz-progress-bar wiz-progress-bar--active" />
                    <div className="wiz-progress-bar wiz-progress-bar--active" />
                  </div>
                </div>
              )}

              {/* Foto */}
              <div className="prod-section">
                <p className="prod-section-label">Fotos do Produto</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                  {[0, 1, 2].map(slot => {
                    const imgs = (form.imagem_url || "").split(",").map(s => s.trim()).filter(Boolean);
                    const imgUrl = imgs[slot];
                    const isLocked = slot > 0 && !isPro;
                    const ref = slot === 0 ? imgRef : slot === 1 ? img2Ref : img3Ref;
                    return (
                      <div key={slot} style={{ position: "relative" }}>
                        {slot > 0 && <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", display: "block", marginBottom: "3px", textAlign: "center" }}>Foto {slot + 1}</span>}
                        {slot === 0 && <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", display: "block", marginBottom: "3px", textAlign: "center" }}>Principal</span>}
                        <div
                          className="prod-img-upload"
                          style={{ width: "100%", height: "90px", borderRadius: "12px", cursor: isLocked ? "default" : "pointer", position: "relative", overflow: "hidden", background: isLocked ? "var(--primary-light)" : (slot > 0 ? "#f0f4ff" : undefined), border: isLocked ? "2px dashed var(--primary)" : (slot > 0 ? "2px dashed #c7d2fe" : undefined) }}
                          onClick={() => !isLocked && !uploading && ref.current?.click()}
                        >
                          {imgUrl ? (
                            <>
                              <img src={imgUrl} alt={`foto ${slot + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              {!isLocked && <button className="prod-img-remove" onClick={e => { e.stopPropagation(); removeImage(slot); }}>✕</button>}
                            </>
                          ) : isLocked ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: "5px", padding: "4px" }}>
                              <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "var(--primary-gradient)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 8px rgba(255,111,169,0.35)" }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="4" y="11" width="16" height="10" rx="2.5"/>
                                  <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                                </svg>
                              </div>
                              <span style={{ fontSize: "0.6rem", fontWeight: 800, color: "var(--primary)", textAlign: "center", letterSpacing: "0.05em" }}>PRO</span>
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
                {!isPro && <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: "4px 0 0", textAlign: "center" }}>Fotos 2 e 3 disponíveis no plano PRO</p>}
              </div>

              {/* Informações */}
              <div className="prod-section">
                <p className="prod-section-label">Informações</p>
                <div className="prod-field">
                  <label>Nome do Produto <em style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 400 }}>obrigatório</em></label>
                  <input type="text" placeholder="Ex: Bolo de Morango" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
                </div>
                <div className="prod-field">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <label style={{ margin: 0 }}>Categoria <em style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 400 }}>obrigatório</em></label>
                    {!showCatInput && (
                      <button
                        type="button"
                        onClick={() => setShowCatInput(true)}
                        style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "var(--primary-light)", color: "var(--primary)", border: "none", borderRadius: "20px", fontFamily: "inherit", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
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
                    <div style={{ marginTop: "10px", padding: "12px", background: "var(--primary-light)", borderRadius: "14px", border: "1.5px dashed var(--primary)" }}>
                      <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>✨ Criar nova categoria</p>

                      <input
                        type="text"
                        placeholder="Nome (ex: Bolos, Doces...)"
                        value={novaCategoria}
                        onChange={e => setNovaCategoria(e.target.value)}
                        style={{ width: "100%", padding: "0.6rem 0.85rem", border: "1.5px solid var(--border)", borderRadius: "10px", fontFamily: "inherit", fontSize: "0.85rem", outline: "none", boxSizing: "border-box", background: "var(--bg-card)", marginBottom: "10px" }}
                      />

                      <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 6px" }}>Escolha um ícone:</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "6px", maxHeight: "160px", overflowY: "auto", padding: "2px", marginBottom: "10px" }}>
                        {SYSTEM_ICONS.map((src, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setNovaCategoriaIcone(src)}
                            style={{ aspectRatio: "1", borderRadius: "8px", border: `2px solid ${novaCategoriaIcone === src ? "var(--primary)" : "transparent"}`, background: novaCategoriaIcone === src ? "var(--bg-card)" : "rgba(255,255,255,0.6)", padding: "3px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
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
                          style={{ flex: 1, padding: "0.55rem", background: "var(--bg-card)", border: "1.5px solid var(--border)", borderRadius: "50px", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer" }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleAdicionarCategoria}
                          disabled={!novaCategoria.trim() || !novaCategoriaIcone || savingCat}
                          style={{ flex: 2, padding: "0.55rem", background: "var(--primary-gradient)", color: "var(--text-inverse)", border: "none", borderRadius: "50px", fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 700, cursor: (!novaCategoria.trim() || !novaCategoriaIcone) ? "not-allowed" : "pointer", opacity: (!novaCategoria.trim() || !novaCategoriaIcone || savingCat) ? 0.6 : 1 }}
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
                      style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: (form.nome.trim() && isPro) ? "var(--primary-gradient)" : "var(--border)", color: (form.nome.trim() && isPro) ? "var(--text-inverse)" : "var(--text-muted)", border: "none", borderRadius: "20px", fontFamily: "inherit", fontSize: "0.7rem", fontWeight: 700, cursor: (form.nome.trim() && isPro) ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}
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
                <p className="prod-section-label">Preço e Venda</p>
                <div className="prod-row-2">
                  <div className="prod-field">
                    <label>Preço base <em style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 400 }}>obrigatório</em></label>
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
                      <label>{cfg.label} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opcional)</span></label>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0 0 6px" }}>{cfg.sub}</p>
                      {(form.tamanhos_disponiveis || []).map((t, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "var(--primary-light)", borderRadius: "8px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--primary)" }}>{t.label}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "0.82rem", color: "var(--success)", fontWeight: 700 }}>R$ {t.preco.toFixed(2).replace(".", ",")}</span>
                            <button onClick={() => removeTamanho(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)", fontSize: "1rem", padding: 0 }}>×</button>
                          </div>
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                        <input type="text" placeholder={cfg.placeholder} value={novoTamanho.label} onChange={e => setNovoTamanho(t => ({ ...t, label: e.target.value }))} style={{ flex: 2, padding: "0.5rem 0.75rem", border: "1.5px solid var(--border)", borderRadius: "10px", fontSize: "0.82rem", fontFamily: "inherit", outline: "none" }} />
                        <input type="text" placeholder={cfg.placeholderPreco} value={novoTamanho.preco} onChange={e => setNovoTamanho(t => ({ ...t, preco: e.target.value }))} style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1.5px solid var(--border)", borderRadius: "10px", fontSize: "0.82rem", fontFamily: "inherit", outline: "none" }} />
                        <button onClick={() => {
                          if (!novoTamanho.label.trim()) return;
                          const preco = parseFloat(novoTamanho.preco.replace(",", "."));
                          if (isNaN(preco)) return;
                          const label = formatLabel(novoTamanho.label.trim());
                          setForm(f => ({ ...f, tamanhos_disponiveis: [...(f.tamanhos_disponiveis || []), { label, preco }] }));
                          setNovoTamanho({ label: "", preco: "" });
                        }} style={{ padding: "0.5rem 0.85rem", background: "var(--primary)", color: "var(--text-inverse)", border: "none", borderRadius: "10px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>+ Add</button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Kit Festa */}
              {form.forma_venda === "kit-festa" && (
                <div className="prod-section">
                  <p className="prod-section-label">Itens do Kit</p>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: "0" }}>Adicione cada item que estará incluso no kit festa</p>

                  {(form.kit_itens || []).map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--primary-light)", borderRadius: "10px", marginBottom: "6px", border: "1px solid var(--primary-light)" }}>
                      <div>
                        <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>{item.nome}</span>
                        <span style={{ fontSize: "0.8rem", color: "var(--primary)", marginLeft: "8px", fontWeight: 600 }}>× {item.quantidade}</span>
                      </div>
                      <button onClick={() => setForm(f => ({ ...f, kit_itens: (f.kit_itens || []).filter((_, idx) => idx !== i) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)", fontSize: "1.1rem", padding: 0 }}>×</button>
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
                    }} style={{ padding: "0.65rem 1rem", background: "var(--primary)", color: "var(--text-inverse)", border: "none", borderRadius: "10px", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", marginBottom: "1px" }}>+ Adicionar</button>
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
              {(form.id || wizardOpts.personalizacao) && (
              <div className="prod-section">
                <p className="prod-section-label">Personalização</p>
                <Toggle label="Permitir personalização" value={form.permite_personalizacao || false} onChange={(v: boolean) => setForm(f => ({ ...f, permite_personalizacao: v }))} colorClass="active-pink" />

                {form.permite_personalizacao && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--bg-body)", borderRadius: "12px", border: "1px solid var(--border)" }}>
                      <div>
                        <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 2px" }}>🚫 Zero Açúcar</p>
                        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0 }}>Disponível versão sem açúcar</p>
                      </div>
                      <button onClick={() => setForm(f => ({ ...f, zero_acucar: !f.zero_acucar }))}
                        style={{ width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer", background: form.zero_acucar ? "var(--primary)" : "var(--border)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                        <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "white", position: "absolute", top: "3px", transition: "left 0.2s", left: form.zero_acucar ? "23px" : "3px", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                      </button>
                    </div>

                    {[
                      { label: "Tipos de Massa", campo: "massas_disponiveis" as const, key: "massa" as const, placeholder: "Ex: Chocolate, Baunilha..." },
                      { label: "Sabores / Recheios", campo: "recheios_disponiveis" as const, key: "recheio" as const, placeholder: "Ex: Morango, Brigadeiro..." },
                      { label: "Coberturas", campo: "coberturas_disponiveis" as const, key: "cobertura" as const, placeholder: "Ex: Ganache, Chantilly..." },
                    ].map(({ label, campo, key, placeholder }) => (
                      <div key={campo} style={{ background: "var(--bg-body)", borderRadius: "12px", padding: "10px 12px", border: "1px solid var(--border)" }}>
                        <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>{label}</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: "10px", background: "var(--bg-card)", cursor: "text" }}
                          onClick={() => (document.getElementById(`input-${key}`) as HTMLInputElement)?.focus()}>
                          {(form[campo] || []).map((item: string, i: number) => (
                            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "3px", padding: "2px 8px 2px 10px", background: "var(--primary-light)", border: "1px solid var(--primary-light)", color: "var(--primary-dark)", borderRadius: "50px", fontSize: "0.78rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                              {item}
                              <button onClick={e => { e.stopPropagation(); removeOpcao(campo, i); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary-dark)", padding: "0 2px", lineHeight: 1, fontSize: "0.85rem" }}>×</button>
                            </span>
                          ))}
                          <input id={`input-${key}`} type="text" placeholder={(form[campo] || []).length === 0 ? placeholder : "Adicionar..."} value={novaOpcao[key]} onChange={e => setNovaOpcao(o => ({ ...o, [key]: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addOpcao(campo, key); } }} style={{ border: "none", outline: "none", fontSize: "0.82rem", fontFamily: "inherit", flex: 1, minWidth: "100px", background: "transparent", padding: "2px 0" }} />
                        </div>
                        <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: "4px 0 0" }}>Pressione Enter ou clique em + Add</p>
                        <button onClick={() => addOpcao(campo, key)} style={{ marginTop: "6px", padding: "0.4rem 1rem", background: "var(--primary)", color: "var(--text-inverse)", border: "none", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}>+ Add</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
              )}

              {/* Adicionais */}
              {(form.id || wizardOpts.complementos) && (
              <div className="prod-section">
                <p className="prod-section-label">Adicionais</p>
                <Toggle label="Oferecer adicionais" value={form.tem_adicionais || false} onChange={(v: boolean) => setForm(f => ({ ...f, tem_adicionais: v }))} colorClass="active-pink" />

                {form.tem_adicionais && (
                  <>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "0" }}>Itens extras que o cliente pode solicitar</p>

                {[
                  { label: "Velas", sub: "Cliente escolhe se quer velas", campo: "tem_vela" as const, valor: "valor_vela" as const },
                  { label: "Topo de Bolo", sub: "Cliente escolhe o topo personalizado", campo: "tem_topo" as const, valor: "valor_topo" as const },
                  { label: "Papel de Arroz", sub: "Impressão comestível personalizada", campo: "tem_papel_arroz" as const, valor: "valor_papel_arroz" as const },
                ].map(({ label, sub, campo, valor }) => (
                  <div key={campo} style={{ background: "var(--bg-body)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px" }}>
                      <div>
                        <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 2px" }}>{label}</p>
                        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0 }}>{sub}</p>
                      </div>
                      <button onClick={() => setForm(f => ({ ...f, [campo]: !f[campo] }))}
                        style={{ width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer", background: form[campo] ? "var(--primary)" : "var(--border)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                        <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "white", position: "absolute", top: "3px", transition: "left 0.2s", left: form[campo] ? "23px" : "3px", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                      </button>
                    </div>
                    {form[campo] && (
                      <div style={{ padding: "0 12px 12px", borderTop: "1px solid var(--border)" }}>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", margin: "8px 0 4px" }}>Valor adicional</label>
                        <div className="prod-preco-input" style={{ background: "var(--bg-card)" }}>
                          <span>R$</span>
                          <input type="text" placeholder="0,00" value={form[valor] ? formatPreco(form[valor] as number) : ""} onChange={e => setForm(f => ({ ...f, [valor]: parsePreco(e.target.value) }))} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div style={{ background: "var(--bg-body)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px" }}>
                    <div>
                      <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 2px" }}>Outro</p>
                      <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0 }}>Adicional personalizado</p>
                    </div>
                    <button onClick={() => setForm(f => ({ ...f, tem_outro: !f.tem_outro }))}
                      style={{ width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer", background: form.tem_outro ? "var(--primary)" : "var(--border)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                      <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "white", position: "absolute", top: "3px", transition: "left 0.2s", left: form.tem_outro ? "23px" : "3px", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                    </button>
                  </div>
                  {form.tem_outro && (
                    <div style={{ padding: "0 12px 12px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", margin: "8px 0 4px" }}>Nome do adicional</label>
                        <input type="text" placeholder="Ex: Embalagem especial, Laço..." value={form.titulo_outro || ""} onChange={e => setForm(f => ({ ...f, titulo_outro: e.target.value }))} style={{ width: "100%", padding: "0.55rem 0.85rem", border: "1.5px solid var(--border)", borderRadius: "10px", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "var(--bg-card)" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", margin: "0 0 4px" }}>Valor adicional</label>
                        <div className="prod-preco-input" style={{ background: "var(--bg-card)" }}>
                          <span>R$</span>
                          <input type="text" placeholder="0,00" value={form.valor_outro ? formatPreco(form.valor_outro) : ""} onChange={e => setForm(f => ({ ...f, valor_outro: parsePreco(e.target.value) }))} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                  </>
                )}
              </div>
              )}

              {/* Promoção */}
              <div className="prod-section">
                <p className="prod-section-label">Promoção</p>
                <Toggle label="Produto em promoção" value={form.promocao} onChange={(v: boolean) => setForm(f => ({ ...f, promocao: v }))} colorClass="active-pink" />

                {form.promocao && (
                  <>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => setForm(f => ({ ...f, tipo_promocao: 'fixo' }))}
                        style={{ flex: 1, padding: "8px", borderRadius: "10px", border: `2px solid ${form.tipo_promocao !== 'percentual' ? 'var(--primary)' : 'var(--border)'}`, background: form.tipo_promocao !== 'percentual' ? 'var(--primary-light)' : 'var(--bg-card)', fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 700, color: form.tipo_promocao !== 'percentual' ? 'var(--primary)' : 'var(--text-secondary)', cursor: "pointer" }}
                      >
                        💰 Preço fixo
                      </button>
                      <button
                        onClick={() => setForm(f => ({ ...f, tipo_promocao: 'percentual' }))}
                        style={{ flex: 1, padding: "8px", borderRadius: "10px", border: `2px solid ${form.tipo_promocao === 'percentual' ? 'var(--primary)' : 'var(--border)'}`, background: form.tipo_promocao === 'percentual' ? 'var(--primary-light)' : 'var(--bg-card)', fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 700, color: form.tipo_promocao === 'percentual' ? 'var(--primary)' : 'var(--text-secondary)', cursor: "pointer" }}
                      >
                        % Desconto
                      </button>
                    </div>

                    {form.tipo_promocao === 'percentual' ? (
                      <div className="prod-field">
                        <label>Percentual de desconto</label>
                        <div className="prod-preco-input">
                          <span style={{ color: "var(--primary)" }}>%</span>
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
                            <p style={{ fontSize: "0.78rem", color: "var(--success)", fontWeight: 600, margin: 0 }}>
                              Preço base: R$ {formatPreco(form.preco_normal)} → R$ {formatPreco(form.preco_normal * (1 - (form.desconto_percentual || 0) / 100))}
                            </p>
                            {(form.tamanhos_disponiveis || []).length > 0 && (
                              <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px" }}>
                                {(form.tamanhos_disponiveis || []).map((t, i) => (
                                  <p key={i} style={{ fontSize: "0.72rem", color: "var(--success)", margin: 0 }}>
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
                          <p style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 600, margin: "4px 0 0" }}>
                            Desconto de {Math.round((1 - form.preco_promocional / form.preco_normal) * 100)}%
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Status */}
              <div className="prod-section">
                <p className="prod-section-label">Status</p>
                <div className="prod-toggles" style={{ gap: "0.5rem" }}>
                  <Toggle label="Disponível" value={form.disponivel} onChange={(v: boolean) => setForm(f => ({ ...f, disponivel: v }))} colorClass="active-green" />
                  <Toggle label="Pronta entrega" value={form.pronta_entrega !== false} onChange={(v: boolean) => setForm(f => ({ ...f, pronta_entrega: v }))} colorClass="active-green" />
                </div>
              </div>

            </div>
            )}

            {wizardStep === 2 && (
            <div className="prod-modal-footer">
              <button className="prod-btn-cancelar" onClick={fecharModal}>Cancelar</button>
              <button className="prod-btn-salvar" onClick={handleSalvar} disabled={saving}>
                {saving ? <span className="prod-spinner-sm" /> : (form.id ? "Salvar alterações" : "Publicar produto")}
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal dedicado da Ficha Técnica (overlay duplo, fica por cima do modal do produto) ── */}
      {modal && fichaModalOpen && (
        <div className="ficha-modal-overlay">
          <div className="ficha-modal" onClick={e => e.stopPropagation()}>
            {/* Header com imagem do produto + métricas */}
            <div className="ficha-modal-header">
              <div className="ficha-modal-header-inner">
                <button className="ficha-modal-back" onClick={() => setFichaModalOpen(false)} aria-label="Voltar">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                  <span>Voltar</span>
                </button>
                <div className="ficha-modal-hero">
                  {form.imagem_url
                    ? <img src={form.imagem_url} alt={form.nome} className="ficha-modal-hero-img" />
                    : <div className="ficha-modal-hero-img ficha-modal-hero-img--placeholder">🧁</div>}
                  <div className="ficha-modal-hero-info">
                    <p className="ficha-modal-hero-label">Ficha técnica de</p>
                    <h2 className="ficha-modal-hero-nome">{form.nome || "Novo produto"}</h2>
                    <div className="ficha-modal-hero-metricas">
                      <div className="ficha-modal-metric">
                        <span>CMV</span>
                        <strong>R$ {cmvProduto.toFixed(2)}</strong>
                      </div>
                      <div className="ficha-modal-metric">
                        <span>Lucro</span>
                        <strong>R$ {(form.preco_normal - cmvProduto).toFixed(2)}</strong>
                      </div>
                      <div className={`ficha-modal-metric ficha-modal-metric--margem ficha-modal-metric--${margemProduto >= 50 ? "alto" : margemProduto >= 25 ? "medio" : "baixo"}`}>
                        <span>Margem</span>
                        <strong>{margemProduto.toFixed(0)}%</strong>
                      </div>
                    </div>
                  </div>
                </div>
                {margemProduto < 25 && form.preco_normal > 0 && fichaTecnica.length > 0 && (
                  <p className="ficha-modal-alerta">⚠️ Margem baixa. Considere reajustar o preço ou revisar a ficha.</p>
                )}
              </div>
            </div>

            {/* Corpo: lista de ingredientes + adicionar */}
            <div className="ficha-modal-body">
              {fichaTecnica.length === 0 ? (
                <div className="ficha-modal-empty">
                  <div className="ficha-modal-empty-icon">🥣</div>
                  <p className="ficha-modal-empty-title">Nenhum ingrediente ainda</p>
                  <p className="ficha-modal-empty-sub">Adicione abaixo os insumos usados pra fazer <strong>1 unidade</strong> deste produto.</p>
                </div>
              ) : (
                <div className="ficha-modal-list">
                  {fichaTecnica.map(f => {
                    const ins = f.insumo;
                    if (!ins) return null;
                    const custoLinha = calcCustoProd(f.quantidade, f.unidade_utilizada, ins.unidade, ins.custo_unitario || 0);
                    const compatibleUnits = getCompatibleUnitsProd(ins.unidade);
                    const hasUnitChoice = compatibleUnits.length > 1;
                    return (
                      <div key={f.insumo_id} className="ficha-modal-item">
                        {ins.imagem_url
                          ? <img src={ins.imagem_url} alt={ins.nome} className="ficha-modal-item-img" />
                          : <div className="ficha-modal-item-img ficha-modal-item-img--placeholder">🥣</div>}
                        <div className="ficha-modal-item-info">
                          <p className="ficha-modal-item-nome">{ins.nome}</p>
                          <p className="ficha-modal-item-sub">R$ {(ins.custo_unitario || 0).toFixed(2)} / {ins.unidade}</p>
                          <div className="ficha-modal-item-bottom">
                            <div className="ficha-modal-item-qtd">
                              <input
                                type="number"
                                value={f.quantidade || ""}
                                onChange={e => atualizarQtdFicha(f.insumo_id, parseFloat(e.target.value) || 0)}
                                step="any" min="0" placeholder="0"
                              />
                              {hasUnitChoice ? (
                                <select
                                  className="ficha-modal-unit-select"
                                  value={f.unidade_utilizada}
                                  onChange={e => atualizarUnidadeFicha(f.insumo_id, e.target.value)}
                                >
                                  {compatibleUnits.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                              ) : (
                                <span>{f.unidade_utilizada}</span>
                              )}
                            </div>
                            <div className="ficha-modal-item-custo">R$ {custoLinha.toFixed(2)}</div>
                          </div>
                        </div>
                        <button className="ficha-modal-item-del" onClick={() => removerInsumoFicha(f.insumo_id)} aria-label="Remover">✕</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Adicionar ingrediente (combobox + quick-add) */}
              {!showQuickAdd ? (
                <div className="ficha-modal-add">
                  <div className="ficha-modal-add-label">Adicionar ingrediente</div>
                  <input
                    type="text"
                    className="ficha-modal-add-input"
                    placeholder="🔍 Buscar insumo cadastrado..."
                    value={buscaInsumo}
                    onChange={e => setBuscaInsumo(e.target.value)}
                  />
                  {buscaInsumo.trim() && (
                    <div className="ficha-modal-add-results">
                      {insumosCadastrados
                        .filter(i => !fichaTecnica.some(f => f.insumo_id === i.id))
                        .filter(i => i.nome.toLowerCase().includes(buscaInsumo.toLowerCase()))
                        .slice(0, 6)
                        .map(i => (
                          <button key={i.id} type="button" className="ficha-modal-add-result" onClick={() => adicionarInsumoFicha(i)}>
                            {i.imagem_url
                              ? <img src={i.imagem_url} alt={i.nome} className="ficha-modal-add-result-img" />
                              : <div className="ficha-modal-add-result-img ficha-modal-add-result-img--placeholder">🥣</div>}
                            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                              <p className="ficha-modal-item-nome">{i.nome}</p>
                              <p className="ficha-modal-item-sub">R$ {(i.custo_unitario || 0).toFixed(2)} / {i.unidade}</p>
                            </div>
                          </button>
                        ))}
                      <button type="button" className="ficha-modal-add-novo" onClick={() => abrirQuickAdd(buscaInsumo)}>
                        ➕ Cadastrar <strong>"{buscaInsumo}"</strong> como novo insumo
                      </button>
                    </div>
                  )}
                  {!buscaInsumo.trim() && (
                    <button type="button" className="ficha-modal-add-novo ficha-modal-add-novo--solo" onClick={() => abrirQuickAdd("")}>
                      ➕ Cadastrar novo insumo
                    </button>
                  )}
                </div>
              ) : (
                <QuickAddInsumo
                  userId={userId}
                  initialName={quickAddInitialName}
                  onSaved={handleInsumoSalvoRapido}
                  onCancel={fecharQuickAdd}
                />
              )}
            </div>

            {/* Rodapé */}
            <div className="ficha-modal-footer">
              <button className="ficha-modal-concluir" onClick={() => setFichaModalOpen(false)}>Concluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewProduto && (
        <div className="prod-modal-overlay" onClick={() => setPreviewProduto(null)} style={{ background: "rgba(0,0,0,0.5)", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg) var(--radius-lg) 0 0", width: "100%", maxWidth: "480px", maxHeight: "85vh", overflow: "auto", animation: "slideUp 0.25s ease-out" }}>
            {previewProduto.imagem_url ? (
              <div style={{ width: "100%", aspectRatio: "16/10", overflow: "hidden", borderRadius: "var(--radius-lg) var(--radius-lg) 0 0" }}>
                <img src={previewProduto.imagem_url.split(",")[0]} alt={previewProduto.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ) : (
              <div style={{ width: "100%", aspectRatio: "16/10", background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-lg) var(--radius-lg) 0 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Sem imagem
              </div>
            )}
            <div style={{ padding: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                <div>
                  {previewProduto.categoria && <p style={{ fontSize: "var(--font-caption)", color: "var(--text-muted)", margin: "0 0 2px", fontWeight: "var(--fw-medium)" as any }}>{previewProduto.categoria}</p>}
                  <h3 style={{ margin: 0, fontSize: "var(--font-section-title)", fontWeight: "var(--fw-bold)" as any, color: "var(--text-title)" }}>{previewProduto.nome}</h3>
                </div>
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {previewProduto.promocao && previewProduto.preco_promocional && previewProduto.preco_promocional > 0 ? (
                    <>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", textDecoration: "line-through" }}>R$ {formatPreco(previewProduto.preco_normal)}</p>
                      <p style={{ margin: 0, fontSize: "var(--font-input)", fontWeight: "var(--fw-bold)" as any, color: "var(--primary)" }}>R$ {formatPreco(previewProduto.preco_promocional)}</p>
                    </>
                  ) : (
                    <p style={{ margin: 0, fontSize: "var(--font-input)", fontWeight: "var(--fw-bold)" as any, color: "var(--primary)" }}>R$ {formatPreco(previewProduto.preco_normal)}</p>
                  )}
                </div>
              </div>

              {previewProduto.descricao && (
                <p style={{ margin: "0.75rem 0 0", fontSize: "var(--font-body)", color: "var(--text-secondary)", lineHeight: 1.5 }}>{previewProduto.descricao}</p>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" }}>
                {previewProduto.forma_venda && (
                  <span style={{ fontSize: "var(--font-caption)", color: "var(--text-muted)", background: "var(--bg-subtle)", padding: "3px 8px", borderRadius: "var(--radius-sm)" }}>
                    {FORMAS_VENDA.find(f => f.value === previewProduto.forma_venda)?.label || previewProduto.forma_venda}
                  </span>
                )}
                {!previewProduto.disponivel && (
                  <span style={{ fontSize: "var(--font-caption)", color: "var(--error)", background: "#fff1f2", padding: "3px 8px", borderRadius: "var(--radius-sm)", fontWeight: 600 }}>Indisponível</span>
                )}
                {previewProduto.promocao && (
                  <span style={{ fontSize: "var(--font-caption)", color: "var(--primary)", background: "var(--primary-light)", padding: "3px 8px", borderRadius: "var(--radius-sm)", fontWeight: 600 }}>Promoção</span>
                )}
                {previewProduto.zero_acucar && (
                  <span style={{ fontSize: "var(--font-caption)", color: "var(--text-muted)", background: "var(--bg-subtle)", padding: "3px 8px", borderRadius: "var(--radius-sm)" }}>Zero açúcar</span>
                )}
              </div>

              {previewProduto.created_at && (
                <p style={{ margin: "0.75rem 0 0", fontSize: "var(--font-caption)", color: "var(--text-muted)" }}>
                  Cadastrado em {new Date(previewProduto.created_at).toLocaleDateString("pt-BR")}
                </p>
              )}

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
                <button
                  onClick={() => { setPreviewProduto(null); openEditar(previewProduto); }}
                  style={{ flex: 1, padding: "0.7rem", background: "var(--primary)", color: "var(--text-inverse)", border: "none", borderRadius: "var(--radius-md)", fontFamily: "var(--font-base)", fontSize: "var(--font-button)", fontWeight: "var(--fw-bold)" as any, cursor: "pointer" }}
                >
                  Editar
                </button>
                <button
                  onClick={() => { setPreviewProduto(null); setDeleteConfirm(previewProduto.id!); }}
                  style={{ padding: "0.7rem 1rem", background: "#fff1f2", color: "var(--error)", border: "none", borderRadius: "var(--radius-md)", fontFamily: "var(--font-base)", fontSize: "var(--font-button)", fontWeight: "var(--fw-semibold)" as any, cursor: "pointer" }}
                >
                  Excluir
                </button>
              </div>
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
              <button onClick={() => handleDelete(deleteConfirm)} style={{ background: "var(--error)", color: "var(--text-inverse)" }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      </>
      }

      <style>{`
        /* ── Tabs ── */
        .prod-tabs { display:flex; gap:0.25rem; background:var(--border); border-radius: var(--radius-md); padding:4px; width:fit-content; margin-bottom:0.5rem; }
        .prod-tab { display:flex; align-items:center; gap:0.4rem; padding:0.5rem 1.1rem; border-radius: var(--radius-md); border:none; background:transparent; font-family:'Geist',sans-serif; font-size: var(--font-button); font-weight: var(--fw-semibold); color:var(--text-secondary); cursor:pointer; transition:all 0.18s; white-space:nowrap; }
        .prod-tab:hover { color:var(--text-title); background:rgba(255,255,255,0.6); }
        .prod-tab--active { background:var(--bg-card); color:var(--primary); box-shadow:0 1px 4px rgba(0,0,0,0.08); }
        @media(max-width:640px) { .prod-tabs { width:100%; } .prod-tab { flex:1; justify-content:center; padding:0.5rem 0.25rem; font-size: var(--font-helper); } }

        .prod-root { font-family: var(--font-base); max-width:800px; display:flex; flex-direction:column; gap:1rem; }
        .prod-spinner { width:32px; height:32px; border:3px solid var(--primary-light); border-top-color:var(--primary); border-radius:50%; animation:pspin 0.7s linear infinite; display:inline-block; }
        .prod-spinner-sm { width:18px; height:18px; border:2px solid rgba(255,255,255,0.4); border-top-color:white; border-radius:50%; animation:pspin 0.7s linear infinite; display:inline-block; }
        @keyframes pspin { to { transform:rotate(360deg); } }
        .prod-title { font-size: var(--font-page-title); font-weight: var(--fw-bold); color:var(--text-title); margin:0 0 0.15rem; }
        .prod-sub { font-size: var(--font-helper); color:var(--text-muted); margin:0; }
        .prod-btn-novo { display:flex; align-items:center; gap:0.4rem; padding:0.7rem 1.2rem; background:var(--primary-gradient); color:var(--text-inverse); border:none; border-radius: var(--radius-full); font-family: var(--font-base); font-size: var(--font-button); font-weight: var(--fw-bold); cursor:pointer; white-space:nowrap; }
        .prod-filtros { display:flex; gap:0.4rem; flex-wrap:wrap; }
        .prod-filtro-btn { padding:0.35rem 0.7rem; border:1.5px solid var(--border); border-radius: var(--radius-sm); background:var(--bg-card); font-family: var(--font-base); font-size: var(--font-helper); font-weight: var(--fw-medium); color:var(--text-secondary); cursor:pointer; }
        .prod-filtro-btn.active { border-color:var(--primary); color:var(--primary); background:var(--primary-light); font-weight: var(--fw-bold); }
        .prod-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.75rem; padding:3rem 1rem; text-align:center; }
        .prod-empty-title { font-size: var(--font-input); font-weight: var(--fw-bold); color:var(--text-title); margin:0; }
        .prod-empty-sub { font-size: var(--font-helper); color:var(--text-muted); margin:0; }
        .prod-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:0.75rem; }
        .prod-list { display:flex; flex-direction:column; gap:0.5rem; }
        .prod-list-item { background:var(--bg-card); border-radius: var(--radius-lg); padding:0.65rem; display:flex; align-items:center; gap:0.85rem; box-shadow:var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06)); }
        .prod-list-img { width:64px; height:64px; border-radius: var(--radius-md); overflow:hidden; background:var(--primary-light); display:flex; align-items:center; justify-content:center; flex-shrink:0; position:relative; cursor:pointer; }
        .prod-list-img img { width:100%; height:100%; object-fit:cover; }
        .prod-list-info { flex:1; min-width:0; }
        .prod-card { background:var(--bg-card); border-radius: var(--radius-lg); overflow:hidden; box-shadow:var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06)); display:flex; flex-direction:column; }
        .prod-card-img { aspect-ratio:1; background:var(--bg-subtle); display:flex; align-items:center; justify-content:center; cursor:pointer; position:relative; overflow:hidden; }
        .prod-card-img img { width:100%; height:100%; object-fit:cover; }
        .prod-card-indisponivel { position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; color:white; font-size: var(--font-caption); font-weight: var(--fw-bold); }
        .prod-card-promo { position:absolute; top:0.4rem; left:0.4rem; background:var(--primary); color:var(--text-inverse); font-size: var(--font-caption); font-weight: var(--fw-bold); padding:0.15rem 0.45rem; border-radius: var(--radius-xl); }
        .prod-card-encomenda { position:absolute; top:0.4rem; right:0.4rem; background:var(--warning); color:var(--text-inverse); font-size: var(--font-caption); font-weight: var(--fw-bold); padding:0.15rem 0.45rem; border-radius: var(--radius-xl); }
        .prod-card-info { padding:0.65rem 0.75rem; flex:1; display:flex; flex-direction:column; }
        .prod-card-bottom { margin-top:auto; }
        .prod-card-cat { font-size: 0.6rem; color:var(--text-muted); font-weight: var(--fw-medium); text-transform:uppercase; letter-spacing:0.04em; margin:0 0 0.15rem; }
        .prod-card-nome { font-size: var(--font-button); font-weight: var(--fw-bold); color:var(--text-title); margin:0 0 0.25rem; line-height:1.3; }
        .prod-card-preco { font-size: var(--font-button); font-weight: var(--fw-semibold); color:var(--success); margin:0; }

        /* ── Badge de lucro/margem por venda ── */
        .prod-card-lucro {
          display: flex;
          flex-direction: column;
          gap: 1px;
          margin-top: 6px;
          padding: 5px 8px;
          border-radius: var(--radius-sm);
          font-family: var(--font-base);
          line-height: 1.2;
        }
        .prod-card-lucro-label {
          font-size: var(--font-caption);
          font-weight: var(--fw-semibold);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          opacity: 0.75;
        }
        .prod-card-lucro strong {
          font-size: var(--font-helper);
          font-weight: var(--fw-black);
        }
        .prod-card-lucro-pct {
          font-size: var(--font-caption);
          font-weight: var(--fw-bold);
          opacity: 0.8;
        }
        .prod-card-lucro--alto  { background:#dcfce7; color:#15803d; }
        .prod-card-lucro--medio { background:#fef3c7; color:#a16207; }
        .prod-card-lucro--baixo { background:#fee2e2; color:#b91c1c; }

        .prod-card-sem-ficha {
          margin-top: 6px;
          padding: 6px 8px;
          background: var(--bg-subtle);
          border: 1px dashed var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          font-family: var(--font-base);
          font-size: var(--font-caption);
          font-weight: var(--fw-medium);
          cursor: pointer;
          text-align: center;
          width: 100%;
          line-height: 1.3;
          transition: background var(--dur-fast) var(--ease-out);
        }
        .prod-card-sem-ficha:hover {
          background: var(--border);
          color: var(--text-secondary);
        }
        .prod-card-actions { display:flex; gap:0.4rem; padding:0.5rem 0.75rem; border-top:1px solid var(--border); }
        .prod-card-btn-edit { flex:1; padding:0.4rem; background:var(--bg-subtle); border:none; border-radius: var(--radius-sm); font-family: var(--font-base); font-size: var(--font-helper); font-weight: var(--fw-semibold); color:var(--text-primary); cursor:pointer; }
        .prod-card-btn-del { padding:0.4rem 0.6rem; background:#fff1f2; border:none; border-radius: var(--radius-sm); color:var(--error); cursor:pointer; display:flex; align-items:center; }
        /* ── Modal de Produto (100% via design tokens) ── */
        .prod-modal-overlay { position: fixed; inset: 0; z-index: 500; background: var(--bg-card); display: flex; flex-direction: column; }
        .prod-modal { background: var(--bg-card); width: 100%; height: 100%; max-width: none; max-height: none; display: flex; flex-direction: column; border-radius: 0; animation: none; margin: 0; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .prod-modal-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4) var(--space-5) var(--space-3); border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .prod-modal-title { font-size: var(--font-modal-title); font-weight: var(--fw-bold); line-height: var(--lh-tight); color: var(--text-title); margin: 0; }
        .prod-modal-close { background: var(--bg-subtle); border: none; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-secondary); font-size: var(--font-caption); transition: background var(--dur-fast) var(--ease-out); }
        .prod-modal-back { background: none; border: none; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; padding: 0; margin-right: -4px; transition: color 0.15s; }
        .prod-modal-back:hover { color: var(--text-title); }
        .prod-modal-body { flex: 1; overflow-y: auto; padding: var(--pad-modal); display: flex; flex-direction: column; gap: var(--gap-section); overscroll-behavior: contain; }
        .prod-modal-footer { padding: var(--pad-modal); border-top: 1px solid var(--border); display: flex; gap: var(--gap-stack); flex-shrink: 0; }
        .prod-section { display: flex; flex-direction: column; gap: var(--gap-stack); }
        .prod-section-label { font-size: var(--font-section-label); font-weight: var(--fw-bold); line-height: var(--lh-normal); letter-spacing: var(--ls-wide); text-transform: uppercase; color: var(--primary); margin: 0; }
        .prod-img-upload { width: 120px; height: 120px; border-radius: var(--radius-lg); border: 2px dashed var(--primary-light); background: var(--primary-light); cursor: pointer; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; transition: border-color var(--dur-fast) var(--ease-out); }
        .prod-img-placeholder { display: flex; flex-direction: column; align-items: center; gap: var(--space-1); padding: var(--space-3); text-align: center; }
        .prod-img-placeholder p { font-size: var(--font-helper); font-weight: var(--fw-semibold); line-height: var(--lh-normal); color: var(--text-primary); margin: 0; }
        .prod-img-placeholder span { font-size: var(--font-caption); font-weight: var(--fw-regular); color: var(--text-muted); }
        .prod-img-remove { position: absolute; top: var(--space-1); right: var(--space-1); background: rgba(0,0,0,0.5); border: none; border-radius: 50%; width: 22px; height: 22px; color: var(--text-inverse); font-size: var(--font-caption); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .prod-field { display: flex; flex-direction: column; gap: var(--space-1); }
        .prod-field label { font-size: var(--font-field-label); font-weight: var(--fw-semibold); line-height: var(--lh-normal); color: var(--text-secondary); }
        .prod-field input, .prod-field select, .prod-field textarea { padding: var(--pad-input); border: 1.5px solid var(--border); border-radius: var(--radius-md); font-family: inherit; font-size: var(--font-input); font-weight: var(--fw-medium); line-height: var(--lh-normal); color: var(--text-title); background: var(--bg-input); outline: none; transition: border-color var(--dur-fast) var(--ease-out); width: 100%; box-sizing: border-box; }
        .prod-field input:focus, .prod-field select:focus, .prod-field textarea:focus { border-color: var(--border-focus); }
        .prod-field textarea { resize: none; }
        .prod-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap-stack); }
        .prod-preco-input { display: flex; align-items: center; border: 1.5px solid var(--border); border-radius: var(--radius-md); overflow: hidden; background: var(--bg-input); transition: border-color var(--dur-fast) var(--ease-out); }
        .prod-preco-input span { padding: 0 var(--space-3); font-weight: var(--fw-bold); color: var(--success); font-size: var(--font-input); flex-shrink: 0; }
        .prod-preco-input input { border: none !important; border-radius: 0 !important; flex: 1; padding: var(--space-3) var(--space-2) var(--space-3) 0 !important; outline: none !important; box-shadow: none !important; }
        .prod-preco-input:focus-within { border-color: var(--border-focus); }
        .prod-nova-cat { display: flex; gap: var(--space-2); margin-top: var(--space-2); }
        .prod-nova-cat input { flex: 1; padding: var(--space-2) var(--space-3); border: 1.5px solid var(--primary); border-radius: var(--radius-md); font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-medium); outline: none; }
        .prod-nova-cat button { padding: var(--space-2) var(--space-3); background: var(--primary-gradient); color: var(--text-inverse); border: none; border-radius: var(--radius-md); font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-bold); cursor: pointer; white-space: nowrap; transition: opacity var(--dur-fast) var(--ease-out); }
        .prod-toggles { display: flex; gap: var(--gap-stack); flex-wrap: wrap; }
        .prod-toggle-item { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: var(--bg-subtle); cursor: pointer; font-size: var(--font-button); font-weight: var(--fw-semibold); line-height: var(--lh-normal); color: var(--text-primary); transition: all var(--dur-normal) var(--ease-out); flex: 1; min-width: 100px; }
        .prod-toggle-item.active-green { background: #dcfce7; color: #15803d; }
        .prod-toggle-item.active-pink { background: var(--primary-light); color: var(--primary-dark); }
        .prod-toggle-slider { width: 40px; height: 22px; border-radius: var(--radius-md); background: var(--border); position: relative; flex-shrink: 0; transition: background var(--dur-normal) var(--ease-out); }
        .prod-toggle-thumb { width: 18px; height: 18px; border-radius: 50%; background: var(--bg-card); position: absolute; top: 2px; left: 2px; transition: transform var(--dur-normal) var(--ease-out); box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
        .prod-btn-cancelar { flex: 1; padding: var(--space-3); background: var(--bg-body); border: none; border-radius: var(--radius-full); font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-semibold); line-height: var(--lh-normal); color: var(--text-secondary); cursor: pointer; transition: opacity var(--dur-fast) var(--ease-out); }
        .prod-btn-salvar { flex: 2; padding: var(--space-3); background: var(--primary-gradient); color: var(--text-inverse); border: none; border-radius: var(--radius-full); font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-bold); line-height: var(--lh-normal); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: opacity var(--dur-fast) var(--ease-out); }
        .prod-btn-salvar:disabled { opacity: 0.65; cursor: not-allowed; }

        /* ── Wizard ── */
        .wiz-subtitle { font-size: var(--font-button); color: var(--text-secondary); margin: 0; line-height: var(--lh-relaxed); }
        .wiz-reassurance { font-size: var(--font-helper); color: var(--text-muted); margin: var(--space-1) 0 0; font-style: italic; }
        .wiz-step-label { font-size: var(--font-caption); font-weight: var(--fw-semibold); color: var(--text-muted); margin: 0 0 var(--space-1); text-transform: uppercase; letter-spacing: var(--ls-wide); }
        .wiz-progress { display: flex; gap: var(--space-2); }
        .wiz-progress-bar { flex: 1; height: 4px; border-radius: 2px; background: var(--border); }
        .wiz-progress-bar--active { background: var(--primary); }
        .wiz-section-title { font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--text-title); margin: var(--space-2) 0 0; }
        .wiz-micro { font-size: var(--font-helper); color: var(--text-muted); margin: 0; line-height: var(--lh-normal); }
        .wiz-tipo-list { display: flex; flex-direction: column; gap: var(--gap-stack); }
        .wiz-tipo-card {
          display: flex; flex-direction: column; align-items: center; gap: var(--space-2);
          padding: var(--space-5) var(--space-4); border-radius: var(--radius-xl); cursor: pointer;
          border: 2px solid var(--border); background: var(--bg-card);
          font-family: var(--font-base); text-align: center; transition: all var(--dur-fast) var(--ease-out);
          position: relative;
        }
        .wiz-tipo-card--active { border-color: var(--primary-dark); border-width: 2.5px; background: var(--primary-dark); }
        .wiz-card-check {
          position: absolute; top: var(--space-3); right: var(--space-3);
          width: 24px; height: 24px; border-radius: 50%;
          background: rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center;
        }
        .wiz-tipo-icon { font-size: var(--text-2xl); }
        .wiz-tipo-title { font-size: var(--font-input); font-weight: var(--fw-bold); color: var(--text-title); margin: 0; }
        .wiz-tipo-desc { font-size: var(--font-helper); color: var(--text-secondary); margin: 0; line-height: var(--lh-normal); }
        .wiz-tipo-example { font-size: var(--font-caption); color: var(--text-muted); margin: var(--space-1) 0 0; font-style: italic; }
        .wiz-tipo-card--active .wiz-tipo-title { color: var(--text-inverse); }
        .wiz-tipo-card--active .wiz-tipo-desc { color: rgba(255,255,255,0.8); }
        .wiz-tipo-card--active .wiz-tipo-example { color: rgba(255,255,255,0.6); }
        .wiz-opts-list { display: flex; flex-direction: column; gap: var(--space-2); }
        .wiz-opt-card {
          display: flex; align-items: flex-start; gap: var(--gap-stack); width: 100%;
          padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); cursor: pointer;
          border: 2px solid var(--border); background: var(--bg-card);
          font-family: var(--font-base); text-align: left; transition: all var(--dur-fast) var(--ease-out);
        }
        .wiz-opt-card--active { border-color: var(--primary); border-width: 2.5px; background: var(--primary-light); }
        .wiz-opt-check {
          width: 22px; height: 22px; border-radius: var(--radius-sm); flex-shrink: 0;
          border: 2px solid var(--border); background: transparent;
          display: flex; align-items: center; justify-content: center; margin-top: 2px;
          transition: all var(--dur-fast) var(--ease-out);
        }
        .wiz-opt-check--active { border-color: var(--primary); background: var(--primary); }
        .wiz-opt-title { font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--text-primary); margin: 0 0 2px; display: flex; align-items: center; gap: var(--space-2); }
        .wiz-opt-desc { font-size: var(--font-helper); color: var(--text-secondary); margin: 0; line-height: var(--lh-normal); }
        .wiz-opt-example { font-size: var(--font-caption); color: var(--text-muted); margin: 2px 0 0; font-style: italic; }
        .wiz-footer { display: flex; gap: var(--gap-stack); padding-top: var(--space-2); }

        /* ── Confirmação de exclusão de produto ── */
        .prod-confirm { background: var(--bg-card); border-radius: var(--radius-lg); padding: var(--space-6); width: 90%; max-width: 320px; margin: auto; }
        .prod-confirm-title { font-size: var(--font-modal-title); font-weight: var(--fw-bold); line-height: var(--lh-tight); color: var(--text-title); margin: 0 0 var(--space-2); }
        .prod-confirm-sub { font-size: var(--font-helper); font-weight: var(--fw-regular); line-height: var(--lh-normal); color: var(--text-muted); margin: 0 0 var(--space-5); }
        .prod-confirm-btns { display: flex; gap: var(--gap-stack); }
        .prod-confirm-btns button { flex: 1; padding: var(--space-3); border: none; border-radius: var(--radius-full); font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-bold); line-height: var(--lh-normal); cursor: pointer; background: var(--bg-body); color: var(--text-secondary); transition: opacity var(--dur-fast) var(--ease-out); }

        /* ════════════════════════════════════════════════════════════════ */
        /* IDENTIDADE DOONLY - PRODUTOS MOBILE                              */
        /* ════════════════════════════════════════════════════════════════ */

        .prod-root {
          display: flex;
          flex-direction: column;
          gap: var(--gap-stack);
          padding: var(--space-5) var(--space-4) 6rem;
          font-family: var(--font-base);
        }

        /* ── Tabs Produtos / Categorias ── */
        .prod-tabs-novo {
          display: flex;
          gap: 0.5rem;
          background: var(--bg-subtle);
          padding: 4px;
          border-radius: var(--radius-md);
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
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: var(--fw-semibold);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--dur-fast) var(--ease-out);
        }
        .prod-tab-novo.active {
          background: var(--bg-card);
          color: var(--text-title);
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
          font-size: var(--text-2xl);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0;
          letter-spacing: -0.02em;
        }
        .prod-sub-novo {
          font-size: var(--font-helper);
          color: var(--text-muted);
          margin: 0.1rem 0 0;
        }

        /* ── Barra de busca ── */
        .prod-busca-novo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          padding: 0.6rem 0.9rem;
          transition: border-color var(--dur-fast) var(--ease-out);
        }
        .prod-busca-novo:focus-within {
          border-color: var(--text-title);
        }
        .prod-busca-novo > svg:first-child {
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .prod-busca-novo input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-family: inherit;
          font-size: var(--font-button);
          color: var(--text-title);
          min-width: 0;
        }
        .prod-busca-novo input::placeholder {
          color: var(--text-muted);
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
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-full);
          padding: 0.45rem 0.95rem;
          font-family: inherit;
          font-size: var(--font-helper);
          font-weight: var(--fw-semibold);
          color: var(--text-secondary);
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition: all var(--dur-fast) var(--ease-out);
        }
        .prod-filtro-btn:hover {
          border-color: var(--text-title);
          color: var(--text-title);
        }
        .prod-filtro-btn.active {
          background: var(--text-title);
          border-color: var(--text-title);
          color: var(--text-inverse);
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
          padding:1.1rem 0.95rem; background:var(--bg-body);
          border-radius: var(--radius-md); border:1.5px dashed var(--border);
          text-align:center;
        }
        .ficha-empty-icon { font-size: var(--text-2xl); }
        .ficha-empty-text { margin:0; font-size: var(--font-helper); color:var(--text-secondary); line-height:1.45; max-width:300px; }
        .ficha-empty-text strong { color:var(--primary); font-weight: var(--fw-bold); }

        .ficha-list { display:flex; flex-direction:column; gap:0.4rem; }
        .ficha-row {
          display:flex; align-items:center; gap:0.55rem;
          padding:0.55rem 0.65rem; background:var(--bg-card);
          border:1px solid var(--border); border-radius: var(--radius-md);
        }
        .ficha-row-img {
          width:34px; height:34px; border-radius: var(--radius-md);
          object-fit:cover; flex-shrink:0;
          background:var(--bg-body);
        }
        .ficha-row-img--placeholder { display:flex; align-items:center; justify-content:center; font-size: var(--font-input); }
        .ficha-row-info { flex:1; min-width:0; }
        .ficha-row-nome {
          font-size: var(--font-button); font-weight: var(--fw-semibold); color:var(--text-title);
          margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .ficha-row-sub { font-size: var(--font-caption); color:var(--text-muted); margin:1px 0 0; }
        .ficha-row-qtd {
          display:flex; align-items:center; gap:4px;
          padding:5px 8px; background:var(--bg-body);
          border-radius: var(--radius-sm); border:1.5px solid var(--border);
          transition:border-color 0.15s;
        }
        .ficha-row-qtd:focus-within { border-color:var(--primary); }
        .ficha-row-qtd input {
          width:54px; border:none; outline:none; background:transparent;
          font-family:inherit; font-size: var(--font-button); font-weight: var(--fw-bold);
          color:var(--text-title); text-align:right;
          -moz-appearance:textfield;
        }
        .ficha-row-qtd input::-webkit-outer-spin-button,
        .ficha-row-qtd input::-webkit-inner-spin-button {
          -webkit-appearance:none; margin:0;
        }
        .ficha-row-qtd span { font-size: var(--font-caption); color:var(--text-secondary); font-weight: var(--fw-semibold); }
        .ficha-row-custo {
          font-size: var(--font-button); font-weight: var(--fw-black);
          color:var(--primary-dark);
          min-width:64px; text-align:right;
          font-variant-numeric:tabular-nums;
        }
        .ficha-row-del {
          width:26px; height:26px; border-radius:50%;
          background:var(--bg-body); border:none;
          color:var(--text-muted);
          cursor:pointer; font-size: var(--font-caption);
          transition:all 0.15s; flex-shrink:0;
        }
        .ficha-row-del:hover { background:#fee2e2; color:var(--error); }

        .ficha-no-insumos {
          padding:0.85rem; background:var(--primary-light);
          border-radius: var(--radius-md); text-align:center;
          font-size: var(--font-helper); color:var(--text-secondary);
        }
        .ficha-no-insumos p { margin:0; }

        .ficha-btn-add {
          display:inline-flex; align-items:center; gap:5px;
          align-self:flex-start;
          padding:0.55rem 1rem;
          background:var(--primary-light);
          color:var(--primary);
          border:1.5px dashed var(--primary);
          border-radius: var(--radius-full);
          font-family:inherit; font-size: var(--font-helper); font-weight: var(--fw-bold);
          cursor:pointer; transition:all 0.15s;
        }
        .ficha-btn-add:hover {
          background:var(--primary); color:#fff; border-style:solid;
          box-shadow:0 3px 10px rgba(255,111,169,0.3);
        }

        .ficha-picker {
          display:flex; flex-direction:column; gap:0.55rem;
          padding:0.85rem; background:var(--primary-light);
          border:1.5px solid var(--primary); border-radius: var(--radius-lg);
        }
        .ficha-picker-search {
          width:100%; padding:0.55rem 0.85rem;
          border:1.5px solid var(--border); border-radius: var(--radius-md);
          font-family:inherit; font-size: var(--font-button); outline:none;
          background:var(--bg-card); box-sizing:border-box;
        }
        .ficha-picker-search:focus { border-color:var(--primary); }
        .ficha-picker-list {
          display:flex; flex-direction:column; gap:4px;
          max-height:200px; overflow-y:auto;
        }
        .ficha-picker-item {
          display:flex; align-items:center; gap:0.55rem;
          padding:0.55rem 0.65rem;
          background:var(--bg-card);
          border:1.5px solid transparent; border-radius: var(--radius-md);
          cursor:pointer; text-align:left;
          font-family:inherit; transition:all 0.15s;
        }
        .ficha-picker-item:hover {
          border-color:var(--primary);
          transform:translateY(-1px);
          box-shadow:0 3px 10px rgba(255,111,169,0.15);
        }
        .ficha-picker-close {
          align-self:flex-end;
          padding:0.4rem 1rem;
          background:var(--bg-card);
          border:1px solid var(--border); border-radius: var(--radius-full);
          font-family:inherit; font-size: var(--font-helper); font-weight: var(--fw-semibold);
          color:var(--text-secondary); cursor:pointer;
        }

        .ficha-resumo {
          padding:0.85rem 1rem;
          background:linear-gradient(135deg, #FFE4F0 0%, #FFF1F7 100%);
          border:1px solid rgba(255,111,169,0.25);
          border-radius: var(--radius-lg);
          display:flex; flex-direction:column; gap:0.4rem;
        }
        .ficha-resumo-row {
          display:flex; justify-content:space-between; align-items:center;
          font-size: var(--font-helper); color:var(--text-primary);
        }
        .ficha-resumo-row strong {
          color:var(--text-title); font-weight: var(--fw-black);
          font-variant-numeric:tabular-nums;
        }
        .ficha-resumo-margem {
          display:flex; justify-content:space-between; align-items:center;
          padding:0.55rem 0.85rem; margin-top:0.25rem;
          border-radius: var(--radius-md);
          font-size: var(--font-button); font-weight: var(--fw-bold);
        }
        .ficha-resumo-margem strong { font-size: var(--font-modal-title); font-weight: var(--fw-black); }
        .ficha-resumo-margem--alto { background:#dcfce7; color:#15803d; }
        .ficha-resumo-margem--medio { background:#fef3c7; color:#a16207; }
        .ficha-resumo-margem--baixo { background:#fee2e2; color:#b91c1c; }
        .ficha-alerta {
          margin:0; padding:0.55rem 0.85rem;
          background:#fef3c7; color:#92400e;
          border-radius: var(--radius-md); font-size: var(--font-helper); font-weight: var(--fw-semibold);
        }

        /* ── Botão-resumo (trigger do modal da ficha) ── */
        .ficha-trigger {
          width:100%; display:flex; align-items:center; gap:0.75rem;
          padding:0.85rem 1rem;
          background:var(--bg-body);
          border:1.5px solid var(--border); border-radius: var(--radius-lg);
          cursor:pointer; transition: all var(--dur-normal) var(--ease-out); text-align:left;
        }
        .ficha-trigger:hover {
          border-color:var(--primary);
          background:#FFF5F9;
          transform:translateY(-1px);
        }
        .ficha-trigger-icon {
          font-size: var(--text-xl); flex-shrink:0;
          width:42px; height:42px; display:flex; align-items:center; justify-content:center;
          background:#fff; border-radius: var(--radius-md);
        }
        .ficha-trigger-info { flex:1; min-width:0; }
        .ficha-trigger-title {
          margin:0; font-size: var(--font-button); font-weight: var(--fw-bold);
          color:var(--text-primary);
        }
        .ficha-trigger-sub {
          margin:2px 0 0; font-size: var(--font-caption);
          color:var(--text-secondary); font-weight: var(--fw-medium);
        }
        .ficha-trigger-arrow {
          font-size: var(--font-page-title); color:var(--text-muted); font-weight:300;
        }
        .ficha-trigger-badge {
          padding:0.3rem 0.65rem; border-radius: var(--radius-full);
          font-size: var(--font-helper); font-weight: var(--fw-black);
        }
        .ficha-trigger-badge--alto { background:#dcfce7; color:#15803d; }
        .ficha-trigger-badge--medio { background:#fef3c7; color:#a16207; }
        .ficha-trigger-badge--baixo { background:#fee2e2; color:#b91c1c; }

        /* ── Ficha técnica em TELA CHEIA (100% via design tokens) ── */
        .ficha-modal-overlay {
          position: fixed; inset: 0; z-index: 1100;
          background: var(--bg-card);
          display: flex; flex-direction: column;
          animation: fichaFadeIn var(--dur-normal) var(--ease-out);
        }
        @keyframes fichaFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .ficha-modal {
          width: 100%; height: 100%;
          background: var(--bg-card);
          display: flex; flex-direction: column;
          animation: fichaSlideIn var(--dur-normal) var(--ease-in-out);
        }
        @keyframes fichaSlideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

        /* Header com imagem grande do produto */
        .ficha-modal-header {
          padding: var(--space-4);
          background: linear-gradient(180deg, var(--primary-light) 0%, var(--bg-card) 100%);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        @media (min-width: 640px) {
          .ficha-modal-header { padding: var(--space-6) var(--space-7) var(--space-4); }
        }
        .ficha-modal-header-inner {
          max-width: 720px; margin: 0 auto; width: 100%;
        }
        .ficha-modal-back {
          display: inline-flex; align-items: center; gap: var(--space-2);
          background: transparent; border: none; cursor: pointer;
          padding: var(--space-1) var(--space-2) var(--space-1) 0;
          margin-bottom: var(--space-3);
          color: var(--text-secondary);
          font-size: var(--font-button); font-weight: var(--fw-semibold); line-height: var(--lh-normal);
          border-radius: var(--radius-sm);
          transition: color var(--dur-fast) var(--ease-out);
        }
        .ficha-modal-back:hover { color: var(--primary); }
        .ficha-modal-hero { display: flex; gap: var(--space-3); align-items: flex-start; }
        .ficha-modal-hero-img {
          width: 88px; height: 88px; border-radius: var(--radius-lg);
          object-fit: cover; flex-shrink: 0;
          box-shadow: var(--shadow-sm);
        }
        @media (min-width: 640px) {
          .ficha-modal-hero-img { width: 104px; height: 104px; }
        }
        .ficha-modal-hero-img--placeholder {
          background: var(--bg-card); display: flex; align-items: center; justify-content: center;
          font-size: 2.4rem;
        }
        .ficha-modal-hero-info { flex: 1; min-width: 0; }
        .ficha-modal-hero-label {
          margin: 0; font-size: var(--font-caption); text-transform: uppercase;
          letter-spacing: var(--ls-wide); color: var(--text-muted); font-weight: var(--fw-bold);
        }
        .ficha-modal-hero-nome {
          margin: 2px 0 var(--space-2);
          font-size: var(--font-card-title); font-weight: var(--fw-black);
          color: var(--text-primary); line-height: var(--lh-tight);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ficha-modal-hero-metricas { display: flex; gap: var(--space-2); }
        .ficha-modal-metric {
          flex: 1; padding: var(--space-2);
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: var(--radius-md); min-width: 0;
        }
        .ficha-modal-metric span {
          display: block; font-size: var(--font-stat-label); text-transform: uppercase;
          letter-spacing: var(--ls-wide); color: var(--text-muted); font-weight: var(--fw-bold);
        }
        .ficha-modal-metric strong {
          display: block; font-size: var(--font-button); font-weight: var(--fw-black);
          color: var(--text-primary); margin-top: 1px;
        }
        .ficha-modal-metric--margem strong { font-size: var(--font-input); }
        .ficha-modal-metric--alto { background: #dcfce7; border-color: #bbf7d0; }
        .ficha-modal-metric--alto strong { color: #15803d; }
        .ficha-modal-metric--medio { background: #fef3c7; border-color: #fde68a; }
        .ficha-modal-metric--medio strong { color: #a16207; }
        .ficha-modal-metric--baixo { background: #fee2e2; border-color: #fecaca; }
        .ficha-modal-metric--baixo strong { color: #b91c1c; }
        .ficha-modal-alerta {
          margin: var(--space-3) 0 0; padding: var(--space-2) var(--space-3);
          background: #fef3c7; color: #92400e;
          border-radius: var(--radius-md); font-size: var(--font-helper); font-weight: var(--fw-semibold); line-height: var(--lh-normal);
        }

        /* Body */
        .ficha-modal-body {
          flex: 1; overflow-y: auto;
          padding: var(--space-4);
          display: flex; flex-direction: column; gap: var(--gap-stack);
        }
        @media (min-width: 640px) {
          .ficha-modal-body { padding: var(--space-6) var(--space-7); max-width: 720px; width: 100%; margin: 0 auto; }
        }
        .ficha-modal-empty {
          padding: var(--space-6) var(--space-4); text-align: center;
          background: var(--bg-body); border-radius: var(--radius-lg);
          border: 1.5px dashed var(--border);
        }
        .ficha-modal-empty-icon { font-size: 2.2rem; }
        .ficha-modal-empty-title {
          margin: var(--space-1) 0 var(--space-1); font-size: var(--font-input); font-weight: var(--fw-bold); line-height: var(--lh-tight);
          color: var(--text-primary);
        }
        .ficha-modal-empty-sub {
          margin: 0; font-size: var(--font-helper); font-weight: var(--fw-regular); line-height: var(--lh-relaxed);
          color: var(--text-secondary);
        }
        .ficha-modal-empty-sub strong { color: var(--primary); font-weight: var(--fw-bold); }

        .ficha-modal-list { display: flex; flex-direction: column; gap: var(--gap-tight); }
        .ficha-modal-item {
          display: flex; gap: var(--space-3); padding: var(--space-3);
          background: var(--bg-card); border: 1.5px solid var(--border);
          border-radius: var(--radius-md); position: relative;
          transition: border-color var(--dur-fast) var(--ease-out);
        }
        .ficha-modal-item-img {
          width: 54px; height: 54px; border-radius: var(--radius-md);
          object-fit: cover; flex-shrink: 0; background: var(--bg-body);
        }
        .ficha-modal-item-img--placeholder {
          display: flex; align-items: center; justify-content: center; font-size: var(--font-page-title);
        }
        .ficha-modal-item-info { flex: 1; min-width: 0; padding-right: var(--space-6); }
        .ficha-modal-item-nome {
          margin: 0; font-size: var(--font-button); font-weight: var(--fw-bold); line-height: var(--lh-normal);
          color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ficha-modal-item-sub {
          margin: 2px 0 var(--space-2); font-size: var(--font-caption);
          color: var(--text-muted); font-weight: var(--fw-medium); line-height: var(--lh-normal);
        }
        .ficha-modal-item-bottom {
          display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
        }
        .ficha-modal-item-qtd {
          display: flex; align-items: center; gap: var(--space-1);
          background: var(--bg-body); border: 1.5px solid transparent;
          border-radius: var(--radius-md); padding: var(--space-1) var(--space-2); max-width: 130px;
          transition: border-color var(--dur-fast) var(--ease-out);
        }
        .ficha-modal-item-qtd:focus-within { border-color: var(--primary); background: var(--bg-card); }
        .ficha-modal-item-qtd input {
          width: 60px; border: none; background: transparent; outline: none;
          font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--text-primary);
        }
        .ficha-modal-item-qtd input::-webkit-outer-spin-button,
        .ficha-modal-item-qtd input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .ficha-modal-item-qtd span {
          font-size: var(--font-caption); font-weight: var(--fw-semibold); color: var(--text-secondary);
        }
        .ficha-modal-unit-select {
          border: 1.5px solid var(--border); border-radius: var(--radius-sm);
          background: var(--bg-card); color: var(--text-primary);
          font-family: inherit; font-size: var(--font-caption); font-weight: var(--fw-semibold);
          padding: 2px 4px; cursor: pointer; outline: none; min-width: 38px;
        }
        .ficha-modal-unit-select:focus { border-color: var(--primary); }
        .ficha-modal-item-custo {
          font-size: var(--font-button); font-weight: var(--fw-black); color: var(--primary);
        }
        .ficha-modal-item-del {
          position: absolute; top: 8px; right: 8px;
          width: 24px; height: 24px; border-radius: var(--radius-sm);
          background: transparent; border: none;
          color: var(--text-muted); cursor: pointer;
          font-size: var(--font-button);
          display: flex; align-items: center; justify-content: center;
          transition: all var(--dur-fast) var(--ease-out);
        }
        .ficha-modal-item-del:hover { background: #fee2e2; color: #b91c1c; }

        /* Adicionar ingrediente */
        .ficha-modal-add {
          background: var(--bg-body);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--space-3);
        }
        .ficha-modal-add-label {
          font-size: var(--font-section-label); font-weight: var(--fw-bold); line-height: var(--lh-normal);
          color: var(--text-secondary);
          text-transform: uppercase; letter-spacing: var(--ls-wide);
          margin-bottom: var(--space-2);
        }
        .ficha-modal-add-input {
          width: 100%; padding: var(--pad-input);
          background: var(--bg-card); border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          font-size: var(--font-input); font-weight: var(--fw-medium); line-height: var(--lh-normal);
          color: var(--text-title); outline: none;
          transition: border-color var(--dur-fast) var(--ease-out);
        }
        .ficha-modal-add-input:focus { border-color: var(--primary); }
        .ficha-modal-add-results {
          margin-top: var(--space-2); display: flex; flex-direction: column; gap: var(--space-1);
          max-height: 260px; overflow-y: auto;
        }
        .ficha-modal-add-result {
          display: flex; gap: var(--space-2); align-items: center;
          padding: var(--space-2); background: var(--bg-card); border: 1px solid var(--border);
          border-radius: var(--radius-md); cursor: pointer;
          transition: all var(--dur-fast) var(--ease-out); text-align: left;
        }
        .ficha-modal-add-result:hover { border-color: var(--primary); background: var(--primary-light); }
        .ficha-modal-add-result-img {
          width: 38px; height: 38px; border-radius: var(--radius-sm);
          object-fit: cover; flex-shrink: 0; background: var(--bg-body);
        }
        .ficha-modal-add-result-img--placeholder {
          display: flex; align-items: center; justify-content: center; font-size: var(--font-modal-title);
        }
        .ficha-modal-add-novo {
          margin-top: var(--space-1); padding: var(--space-2) var(--space-3);
          background: var(--bg-card); border: 1.5px dashed var(--primary);
          border-radius: var(--radius-md); cursor: pointer;
          font-size: var(--font-button); color: var(--primary); font-weight: var(--fw-semibold); line-height: var(--lh-normal);
          transition: all var(--dur-fast) var(--ease-out); text-align: left;
        }
        .ficha-modal-add-novo:hover { background: var(--primary-light); }
        .ficha-modal-add-novo strong { font-weight: var(--fw-black); }
        .ficha-modal-add-novo--solo { margin-top: var(--space-2); width: 100%; text-align: center; }

        /* Footer */
        .ficha-modal-footer {
          padding: var(--space-3) var(--space-4);
          border-top: 1px solid var(--border);
          background: var(--bg-card); flex-shrink: 0;
        }
        @media (min-width: 640px) {
          .ficha-modal-footer { padding: var(--space-4) var(--space-7); }
          .ficha-modal-footer > * { max-width: 720px; margin: 0 auto; display: block; }
        }
        .ficha-modal-concluir {
          width: 100%; padding: var(--space-3);
          background: var(--text-primary); color: var(--text-inverse);
          border: none; border-radius: var(--radius-md);
          font-size: var(--font-button); font-weight: var(--fw-bold); line-height: var(--lh-normal);
          cursor: pointer;
          transition: opacity var(--dur-fast) var(--ease-out);
        }
        .ficha-modal-concluir:hover { opacity: 0.88; }

      `}</style>
    </div>
    </>
  );
}

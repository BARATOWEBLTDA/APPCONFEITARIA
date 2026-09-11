import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { usePlano } from "@/hooks/usePlano";
import { ImageCropper } from "@/components/ui/ImageCropper";
import EmptyDoo from "@/components/EmptyDoo";
import BtnNovo from "@/components/BtnNovo";
import Categorias from "@/pages/Categorias";
import QuickAddInsumo from "@/components/QuickAddInsumo";
import AppPageHeader from "@/components/AppPageHeader";

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

type Tamanho = { label: string; preco: number; foto_url?: string };

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
  usar_foto_variacao?: boolean;
  oferece_pacote?: boolean;
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
  adicionais?: Adicional[];
  tipo_promocao?: 'fixo' | 'percentual';
  desconto_percentual?: number;
  created_at?: string;
};

// Um adicional (extra) de um produto: nome + valor + origem opcional na biblioteca
type Adicional = {
  nome: string;
  valor: number;
  from_biblioteca?: string; // id do extra na biblioteca_extras
};

// Extra na biblioteca do usuário (reutilizável entre produtos)
type BibliotecaExtra = {
  id: string;
  nome: string;
  valor: number;
  categorias: string[];
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
  tamanhos_disponiveis: [], usar_foto_variacao: false, oferece_pacote: false, pronta_entrega: true,
  kit_itens: [], kit_serve_pessoas: "", kit_prazo_encomenda: "",
  zero_acucar: false,
  tem_vela: false, valor_vela: 0,
  tem_topo: false, valor_topo: 0,
  tem_papel_arroz: false, valor_papel_arroz: 0,
  tem_outro: false, titulo_outro: "", valor_outro: 0,
  tem_adicionais: false,
  adicionais: [],
  tipo_promocao: 'fixo' as const, desconto_percentual: 0,
};

export default function Produtos() {
  const location = useLocation();
  const navigate = useNavigate();
  // activeTab segue a URL: /produtos/categorias → "categorias", senão "produtos"
  const activeTab: "produtos" | "categorias" = location.pathname.startsWith("/produtos/categorias") ? "categorias" : "produtos";
  const setActiveTab = (tab: "produtos" | "categorias") => {
    navigate(tab === "categorias" ? "/produtos/categorias" : "/produtos");
  };
  const [userId, setUserId] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modal, setModal] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [wizardTipo, setWizardTipo] = useState<"simples" | "variacoes">("simples");
  const [wizardOpts, setWizardOpts] = useState({ complementos: false, personalizacao: false, promocao: false });
  const [form, setForm] = useState<Produto>(EMPTY);
  const [confirmDiscardProd, setConfirmDiscardProd] = useState(false);
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

  // ═══ BIBLIOTECA DE EXTRAS ═══
  const [novoAdicional, setNovoAdicional] = useState({ nome: "", valor: "" });
  const [biblioteca, setBiblioteca] = useState<BibliotecaExtra[]>([]);
  const [salvarBibliotecaAsk, setSalvarBibliotecaAsk] = useState<{ nome: string; valor: number; index: number } | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropSlot, setCropSlot] = useState(0);
  // Foto por variação (feature PRO)
  const [cropVariacaoIdx, setCropVariacaoIdx] = useState<number | null>(null);
  const cropVariacaoRef = useRef<HTMLInputElement>(null);
  // Editar variação inline
  const [editandoVariacao, setEditandoVariacao] = useState<number | null>(null);
  const [editVariacaoValor, setEditVariacaoValor] = useState("");
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
    if (modal || previewProduto) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      return () => {
        const y = document.body.style.top;
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
        window.scrollTo(0, y ? -parseInt(y, 10) : 0);
      };
    }
  }, [modal, previewProduto]);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await loadProdutos(user.id);
      await loadCategorias(user.id);
      await loadInsumos(user.id);
      await loadBiblioteca(user.id);
      setLoading(false);
    };
    load();
  }, []);

  // ═══ BIBLIOTECA DE EXTRAS ═══
  const loadBiblioteca = async (uid: string) => {
    const { data } = await supabase.from("biblioteca_extras").select("*").eq("user_id", uid).order("nome");
    if (data) setBiblioteca(data as BibliotecaExtra[]);
  };

  // Migra campos hardcoded antigos (tem_vela/tem_topo/etc) para o array adicionais
  const migrarAdicionaisLegacy = (p: Produto): Produto => {
    if (p.adicionais && p.adicionais.length > 0) return p;
    const legacy: Adicional[] = [];
    if (p.tem_vela) legacy.push({ nome: "Vela", valor: p.valor_vela || 0 });
    if (p.tem_topo) legacy.push({ nome: "Topo de bolo", valor: p.valor_topo || 0 });
    if (p.tem_papel_arroz) legacy.push({ nome: "Papel de arroz", valor: p.valor_papel_arroz || 0 });
    if (p.tem_outro && p.titulo_outro) legacy.push({ nome: p.titulo_outro, valor: p.valor_outro || 0 });
    return { ...p, adicionais: legacy };
  };

  // Sugestões da biblioteca pra categoria atual (que não estão já no produto)
  const sugestoesBiblioteca = biblioteca.filter(b => {
    const noProdutoAtual = (form.adicionais || []).some(a => a.from_biblioteca === b.id);
    if (noProdutoAtual) return false;
    if (!form.categoria) return true;
    // Se o extra não tem categorias, mostra pra todos
    if (!b.categorias || b.categorias.length === 0) return true;
    return b.categorias.includes(form.categoria);
  });

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
    setForm(migrarAdicionaisLegacy({ ...EMPTY, ...p }));
    setFichaTecnica([]);
    // Detecta tipo baseado nos dados salvos
    const temVariacoes = (p.tamanhos_disponiveis && p.tamanhos_disponiveis.length > 0) ||
                        (p.kit_itens && p.kit_itens.length > 0);
    setWizardTipo(temVariacoes ? "variacoes" : "simples");
    setWizardOpts({
      complementos: !!p.tem_adicionais || !!(p.adicionais && p.adicionais.length > 0),
      personalizacao: !!p.permite_personalizacao,
      promocao: !!p.promocao,
    });
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
  const fecharModal = () => { setModal(false); setForm(EMPTY); setFichaTecnica([]); setFichaModalOpen(false); setShowQuickAdd(false); setBuscaInsumo(""); setWizardStep(1); setWizardTipo("simples"); setWizardOpts({ complementos: false, personalizacao: false, promocao: false }); setConfirmDiscardProd(false); };

  // Guard: verifica se o produto tem dados preenchidos (pra decidir se avisa antes de fechar)
  const hasProdData = (): boolean => {
    if (form.id) return true; // Editando → sempre confirma
    return !!(
      form.nome?.trim() ||
      form.descricao?.trim() ||
      (form.preco_normal && form.preco_normal > 0) ||
      form.categoria?.trim() ||
      form.imagem_url?.trim() ||
      (fichaTecnica && fichaTecnica.length > 0) ||
      (form.tamanhos_disponiveis && form.tamanhos_disponiveis.length > 0)
    );
  };
  const handleTryClose = () => {
    if (hasProdData()) setConfirmDiscardProd(true);
    else fecharModal();
  };

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
    const isVariacao = cropVariacaoIdx !== null;
    const idxVar = cropVariacaoIdx;
    setCropSrc(null);
    setCropVariacaoIdx(null);
    setUploading(true);
    const suffix = isVariacao ? `var-${idxVar}` : `${cropSlot}`;
    const path = `produtos/${userId}-${Date.now()}-${suffix}.jpg`;
    const { error } = await supabase.storage.from("products").upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (!error) {
      const { data } = supabase.storage.from("products").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      if (isVariacao && idxVar !== null) {
        setForm(f => {
          const arr = [...(f.tamanhos_disponiveis || [])];
          if (arr[idxVar]) arr[idxVar] = { ...arr[idxVar], foto_url: url };
          return { ...f, tamanhos_disponiveis: arr };
        });
      } else {
        setForm(f => {
          const imgs = (f.imagem_url || "").split(",").map(s => s.trim()).filter(Boolean);
          imgs[cropSlot] = url;
          return { ...f, imagem_url: imgs.join(",") };
        });
      }
    }
    setUploading(false);
  };

  const handleVariacaoFotoUpload = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setCropSrc(reader.result as string); setCropVariacaoIdx(idx); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeVariacaoFoto = (idx: number) => {
    setForm(f => {
      const arr = [...(f.tamanhos_disponiveis || [])];
      if (arr[idx]) arr[idx] = { ...arr[idx], foto_url: undefined };
      return { ...f, tamanhos_disponiveis: arr };
    });
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
    <AppPageHeader
      title="Meus Produtos"
      subtitle="Gerencie o que você vende"
      infoIcon="🎂"
      infoContent={
        <>
          <p>Aqui você <strong>cadastra e organiza tudo que vende</strong> na sua confeitaria — bolos, doces, cupcakes, kits de festa e mais.</p>
          <p>Cada produto pode ter foto, preço, descrição, sabores e variações. Você organiza por <strong>categorias</strong> pra ficar fácil de encontrar e mostrar no seu cardápio digital.</p>
        </>
      }
      infoTip={<>Clique em <strong>"+ Novo Produto"</strong> pra cadastrar. Depois é só compartilhar seu cardápio com os clientes.</>}
    />
    {cropSrc && (
      <ImageCropper
        imageSrc={cropSrc}
        cropShape="rect"
        aspect={1}
        onCancel={() => { setCropSrc(null); setCropVariacaoIdx(null); }}
        onCropDone={handleProductCropDone}
      />
    )}
    <div className="prod-root">


      {/* ── Tabs — só quando tem produtos ── */}
      {produtos.length > 0 && (
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
      )}

      {activeTab === "categorias" && <Categorias />}

      {activeTab === "produtos" && <>

      {/* Header + Busca + Ordenar — só quando tem produtos */}
      {produtos.length > 0 && (
      <>
      {/* Botão Novo Produto à direita */}
      <div className="prod-header-novo" style={{ justifyContent: 'flex-end' }}>
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
          <button onClick={() => { setViewMode("grid"); localStorage.setItem("prod_viewMode", "grid"); }} style={{ width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer", background: viewMode === "grid" ? "var(--text-title)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }} title="Grade">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={viewMode === "grid" ? "white" : "var(--text-muted)"} strokeWidth="2.2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
          <button onClick={() => { setViewMode("lista"); localStorage.setItem("prod_viewMode", "lista"); }} style={{ width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer", background: viewMode === "lista" ? "var(--text-title)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }} title="Lista">
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
      </>
      )}

      {loading ? (
        <div className="prod-loading-full">
          <span className="prod-spinner" />
        </div>
      ) : produtosFiltrados.length === 0 ? (
        <div className="prod-hero-split">
          {/* ── Lado esquerdo: texto + CTAs + dica ── */}
          <div className="prod-hero-left">
            <span className="prod-hero-eyebrow">✨ VAMOS COMEÇAR</span>
            <h1 className="prod-hero-title">Cadastre seu<br/>primeiro produto</h1>
            <p className="prod-hero-desc">
              Seu catálogo é a vitrine da sua confeitaria. Quanto mais completo,
              mais profissional ele será e mais clientes você conquista.
            </p>
            <div className="prod-hero-actions">
              <button className="prod-hero-btn-primary" onClick={openNovo}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                CADASTRAR PRODUTO
              </button>
              <button className="prod-hero-btn-ghost" onClick={() => alert("🎬 Vídeo em produção! Em breve disponível.")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                Ver tutorial
              </button>
            </div>
            <div className="prod-hero-tip">
              <div className="prod-hero-tip-icon">💡</div>
              <div>
                <p className="prod-hero-tip-t">Dica: fotos boas vendem 3x mais</p>
                <p className="prod-hero-tip-d">Use luz natural, fundo branco, e mostre o produto de ângulos diferentes.</p>
              </div>
            </div>
          </div>

          {/* ── Lado direito: vídeo grande ── */}
          <aside className="prod-hero-right" aria-label="Vídeo tutorial">
            <div className="prod-hero-video-thumb">
              <button
                type="button"
                className="prod-hero-video-play"
                onClick={() => alert("🎬 Vídeo em produção! Em breve disponível.")}
                aria-label="Assistir tutorial"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
            </div>
            <div className="prod-hero-video-footer">
              <span className="prod-hero-video-t">🎬 Tutorial completo</span>
              <span className="prod-hero-video-badge">EM BREVE</span>
            </div>
          </aside>
        </div>
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
                  {p.imagem_url
                    ? <img src={p.imagem_url.split(",")[0]} alt={p.nome} />
                    : <div className="prod-list-img-sem-foto" title="Adicione uma foto pra chamar mais atenção">
                        <span style={{fontSize: 18}}>📸</span>
                      </div>
                  }
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
                {p.imagem_url ? (
                  <img src={p.imagem_url.split(",")[0]} alt={p.nome} />
                ) : (
                  <div className="prod-card-sem-foto">
                    <div className="prod-card-sem-foto-icon">📸</div>
                    <div className="prod-card-sem-foto-title">Foto vende mais</div>
                    <div className="prod-card-sem-foto-cta">toque pra adicionar</div>
                  </div>
                )}
                {!p.disponivel && <div className="prod-card-indisponivel">Indisponível</div>}
                {p.promocao && <div className="prod-card-promo">🔥 Promoção</div>}
                {(p.tamanhos_disponiveis && p.tamanhos_disponiveis.length > 0) && (
                  <div className="prod-card-badge-var">
                    📏 {p.tamanhos_disponiveis.length === 1 ? p.tamanhos_disponiveis[0].label : `${p.tamanhos_disponiveis.length} opções`}
                  </div>
                )}
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
        <div className="prod-modal-overlay" onClick={handleTryClose}>
          <div className="prod-modal prod-modal--novo" onClick={e => e.stopPropagation()}>
            {wizardStep >= 2 && (
            <div className="prod-modal-header-novo">
              {wizardStep > 1 && !form.id ? (
                <button className="prod-modal-back-novo" onClick={() => setWizardStep(s => Math.max(1, s - 1) as 1 | 2 | 3 | 4)} aria-label="Voltar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                </button>
              ) : <div style={{width: 32}} />}
              <div className="prod-modal-title-novo">
                {form.id ? "Editar produto" : (() => {
                  if (wizardStep === 2) return "Informações";
                  if (wizardStep === 3) return "Visual e preço";
                  if (wizardStep === 4) return "Extras";
                  return "Cadastrar produto";
                })()}
              </div>
              <button className="prod-modal-close-novo" onClick={handleTryClose} aria-label="Fechar">✕</button>
            </div>
            )}

            {/* Progresso — bolinhas conectadas (só nos passos 2, 3, 4) */}
            {wizardStep >= 2 && (
              <div className="prod-progresso">
                {[2, 3, 4].map(n => (
                  <div key={n} className="prod-progresso-item">
                    <div className={`prod-progresso-dot${wizardStep === n ? " prod-progresso-dot--ativo" : ""}${wizardStep > n ? " prod-progresso-dot--feito" : ""}`}>
                      {wizardStep > n ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : n - 1}
                    </div>
                    {n < 4 && <div className={`prod-progresso-line${wizardStep > n ? " prod-progresso-line--feito" : ""}`} />}
                  </div>
                ))}
              </div>
            )}

            {/* ══════ WIZARD STEP 1 — Escolha do tipo (TELA CHEIA ROSA) ══════ */}
            {wizardStep === 1 && (
              <div className="wiz-step1-full">
                {/* Botão X translúcido */}
                <button className="wiz-step1-x" onClick={handleTryClose} aria-label="Fechar">✕</button>

                {/* Hero — pergunta grande */}
                <div className="wiz-step1-hero">
                  <h1 className="wiz-step1-title">Como é o seu produto?</h1>
                  <p className="wiz-step1-sub">Você pode mudar isso depois se precisar.</p>
                </div>

                {/* 2 cards centralizados */}
                <div className="wiz-step1-cards">
                  <button
                    type="button"
                    className="wiz-step1-card"
                    onClick={() => {
                      setWizardTipo("simples");
                      setForm(f => ({ ...f, forma_venda: "unidade" }));
                      setWizardStep(2);
                    }}
                  >
                    <img
                      src={`/categoriaicones/${encodeURIComponent("icone (29).png")}`}
                      alt=""
                      className="wiz-step1-card-icon"
                    />
                    <div className="wiz-step1-card-title">Produto simples</div>
                    <div className="wiz-step1-card-desc">Um produto, um preço</div>
                    <div className="wiz-step1-card-ex">Ex.: Brownie, cookie</div>
                  </button>

                  <button
                    type="button"
                    className="wiz-step1-card"
                    onClick={() => {
                      setWizardTipo("variacoes");
                      setWizardStep(2);
                    }}
                  >
                    <img
                      src={`/categoriaicones/${encodeURIComponent("icone (26).png")}`}
                      alt=""
                      className="wiz-step1-card-icon"
                    />
                    <div className="wiz-step1-card-title">Com variações</div>
                    <div className="wiz-step1-card-desc">Um produto com diferentes opções</div>
                    <div className="wiz-step1-card-ex">Ex.: Bolo P, M ou G</div>
                  </button>
                </div>

                <p className="wiz-step1-hint">Toque na opção que combina com o seu produto</p>
              </div>
            )}

            {/* ══════ WIZARD STEP 2 (FORMULÁRIO) ══════ */}
            {/* ══════ WIZARD STEP 2 — IDENTIDADE (nome, categoria, descrição) ══════ */}
            {wizardStep === 2 && (
            <div className="prod-modal-body">
              <div className="prod-section">
                {/* 1. Nome */}
                <div className="prod-field">
                  <label className="prod-field-label--rosa">Nome do produto <em className="prod-field-obrig">(Obrigatório)</em></label>
                  <input type="text" placeholder="Ex: Bolo de Morango" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
                </div>

                {/* 2. Categoria */}
                <div className="prod-field">
                  <label className="prod-field-label--rosa">Categoria <em className="prod-field-obrig">(Obrigatório)</em></label>
                  {!showCatInput ? (
                    <select
                      value={form.categoria}
                      onChange={e => {
                        if (e.target.value === "__nova__") {
                          setShowCatInput(true);
                          return;
                        }
                        setForm(f => ({ ...f, categoria: e.target.value }));
                      }}
                    >
                      <option value="">
                        {todasCategorias.length > 0 ? "Selecione uma categoria..." : "Nenhuma categoria cadastrada"}
                      </option>
                      {todasCategorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      {todasCategorias.length > 0 && <option disabled>─────────────</option>}
                      <option value="__nova__">
                        {todasCategorias.length > 0 ? "+ Criar nova categoria" : "+ Criar primeira categoria"}
                      </option>
                    </select>
                  ) : (
                    <div className="prod-cat-nova-form">
                      <p className="prod-cat-nova-hint">✨ Criar nova categoria</p>
                      <input
                        type="text"
                        placeholder="Ex: Bolos, Doces, Salgados..."
                        value={novaCategoria}
                        onChange={e => setNovaCategoria(e.target.value)}
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === "Enter" && novaCategoria.trim()) {
                            if (!novaCategoriaIcone) setNovaCategoriaIcone(SYSTEM_ICONS[0]);
                            handleAdicionarCategoria();
                          }
                        }}
                      />
                      <div style={{display:'flex', gap:8, marginTop: 8}}>
                        <button
                          type="button"
                          onClick={() => { setShowCatInput(false); setNovaCategoria(""); setNovaCategoriaIcone(""); }}
                          className="prod-cat-cancel-btn"
                        >Cancelar</button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!novaCategoria.trim()) return;
                            if (!novaCategoriaIcone) setNovaCategoriaIcone(SYSTEM_ICONS[0]);
                            handleAdicionarCategoria();
                          }}
                          disabled={!novaCategoria.trim() || savingCat}
                          className="prod-cat-criar-btn"
                        >
                          {savingCat ? "Criando..." : "Criar categoria"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Descrição — com CTA IA (V3) */}
                <div className="prod-field">
                  <label className="prod-field-label--rosa">Descrição</label>
                  {!form.descricao ? (
                    /* Textarea vazio → CTA IA convidativo */
                    <div className="prod-desc-empty-cta">
                      <div className="prod-desc-empty-icon">✨</div>
                      <div className="prod-desc-empty-txt">
                        Escreva a descrição ou <b>deixe a IA fazer pra você</b>
                      </div>
                      <div style={{display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap'}}>
                        <button
                          type="button"
                          className="prod-desc-btn-write"
                          onClick={() => { setForm(f => ({ ...f, descricao: " " })); setTimeout(() => setForm(f => ({...f, descricao: ""})), 0); document.getElementById("prod-desc-input")?.focus(); }}
                        >
                          Escrever eu mesma
                        </button>
                        <button
                          type="button"
                          className={`prod-desc-btn-ia ${(form.nome.trim() && isPro) ? "" : "prod-desc-btn-ia--locked"}`}
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
                          title={!form.nome.trim() ? "Preencha o nome primeiro" : !isPro ? "Disponível no plano PRO" : ""}
                        >
                          Gerar com IA
                          <img src="/coroa.png" alt="" className="prod-desc-btn-ia-crown" />
                        </button>
                      </div>
                      {!form.nome.trim() && (
                        <div className="prod-desc-empty-hint">Preencha o nome primeiro pra IA gerar</div>
                      )}
                    </div>
                  ) : (
                    <textarea
                      id="prod-desc-input"
                      placeholder="Fale sobre o produto..."
                      value={form.descricao}
                      onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                      rows={3}
                      style={{fontFamily: 'inherit', resize: 'vertical'}}
                    />
                  )}
                </div>
              </div>
            </div>
            )}

            {/* ══════ WIZARD STEP 3 — VISUAL E PREÇO (fotos, preço, variações) ══════ */}
            {wizardStep === 3 && (
            <div className="prod-modal-body">

              {/* Foto */}
              <div className="prod-section">
                <p className="prod-section-label prod-section-label--novo">Fotos do Produto</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                  {[0, 1, 2].map(slot => {
                    const imgs = (form.imagem_url || "").split(",").map(s => s.trim()).filter(Boolean);
                    const imgUrl = imgs[slot];
                    const isLocked = slot > 0 && !isPro;
                    const ref = slot === 0 ? imgRef : slot === 1 ? img2Ref : img3Ref;
                    // Foto principal: rosa. Extras (2 e 3): cinza
                    const bgExtra = "#F1EEF0";
                    const borderExtra = "2px dashed #D8D1D5";
                    return (
                      <div key={slot} style={{ position: "relative" }}>
                        {slot > 0 && <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 700, display: "block", marginBottom: "6px", textAlign: "center" }}>Foto {slot + 1}</span>}
                        {slot === 0 && <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 700, display: "block", marginBottom: "6px", textAlign: "center" }}>Principal</span>}
                        <div
                          className="prod-img-upload"
                          style={{
                            width: "100%",
                            height: "130px",
                            borderRadius: "14px",
                            cursor: isLocked ? "default" : "pointer",
                            position: "relative",
                            overflow: "hidden",
                            background: isLocked ? bgExtra : (slot > 0 ? bgExtra : undefined),
                            border: isLocked ? borderExtra : (slot > 0 ? borderExtra : undefined),
                          }}
                          onClick={() => !isLocked && !uploading && ref.current?.click()}
                        >
                          {imgUrl ? (
                            <>
                              <img src={imgUrl} alt={`foto ${slot + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              {!isLocked && <button className="prod-img-remove" onClick={e => { e.stopPropagation(); removeImage(slot); }}>✕</button>}
                            </>
                          ) : isLocked ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: "6px", padding: "4px" }}>
                              <span className="prod-pro-badge">
                                <img src="/coroa.png" alt="" />
                                PRO
                              </span>
                            </div>
                          ) : (
                            <div className="prod-img-placeholder">
                              {uploading ? <span className="prod-spinner" /> : (
                                <>
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={slot === 0 ? "#818cf8" : "#9A8B93"} strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                  {slot === 0 && <span className="prod-img-cta">Selecionar</span>}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageUpload(e, slot)} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Preço e Venda */}
              <div className="prod-section">
                <p className="prod-section-label prod-section-label--novo">Preço e Venda</p>

                {wizardTipo === "simples" ? (
                  /* MODO SIMPLES: 1 preço só */
                  <div className="prod-field">
                    <label>Preço <em style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 400 }}>obrigatório</em></label>
                    <div className="prod-preco-input prod-preco-input--big">
                      <span>R$</span>
                      <input type="text" placeholder="0,00" value={form.preco_normal ? formatPreco(form.preco_normal) : ""} onChange={e => setForm(f => ({ ...f, preco_normal: parsePreco(e.target.value) }))} />
                    </div>
                  </div>
                ) : (
                  /* MODO VARIAÇÕES: forma + tabela */
                  <>
                    <div className="prod-row-2">
                      <div className="prod-field">
                        <label>
                          {(() => {
                            const labels: Record<string, string> = {
                              unidade: "Preço por unidade",
                              fatia:   "Preço por fatia",
                              kg:      "Preço por kg",
                              cento:   "Preço por cento (100 un)",
                              caixa:   "Preço por caixa",
                              tamanho: "Preço base",
                              outros:  "Preço base",
                              "kit-festa": "Preço do kit",
                              "sob-encomenda": "Preço base",
                            };
                            return labels[form.forma_venda] || "Preço base";
                          })()}
                          <em style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 400 }}>obrigatório</em>
                        </label>
                        <div className="prod-preco-input prod-preco-input--taginline">
                          <span>R$</span>
                          <input type="text" placeholder="0,00" value={form.preco_normal ? formatPreco(form.preco_normal) : ""} onChange={e => setForm(f => ({ ...f, preco_normal: parsePreco(e.target.value) }))} />
                          {(() => {
                            const tags: Record<string, string> = {
                              unidade: "/ UNIDADE",
                              fatia:   "/ FATIA",
                              kg:      "/ KG",
                              cento:   "/ CENTO",
                              caixa:   "/ CAIXA",
                            };
                            const tag = tags[form.forma_venda];
                            return tag ? <span className="prod-preco-input-tag">{tag}</span> : null;
                          })()}
                        </div>
                      </div>
                      <div className="prod-field">
                        <label>Vendido por</label>
                        <select value={form.forma_venda} onChange={e => setForm(f => ({ ...f, forma_venda: e.target.value }))}>
                          {FORMAS_VENDA.map(fv => <option key={fv.value} value={fv.value}>{fv.label}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* ══ Toggle "Ofereço desconto por pacote?" — só pra unidade/fatia/kg/cento/caixa ══ */}
                    {["unidade", "fatia", "kg", "cento", "caixa"].includes(form.forma_venda) && (
                      <div
                        className={`prod-pacote-toggle${form.oferece_pacote ? " prod-pacote-toggle--on" : ""}`}
                        onClick={() => setForm(f => ({ ...f, oferece_pacote: !f.oferece_pacote }))}
                      >
                        <div className="prod-pacote-toggle-icon">💰</div>
                        <div className="prod-pacote-toggle-info">
                          <div className="prod-pacote-toggle-title">
                            {form.oferece_pacote ? "✓ Desconto por pacote ativo" : "Ofereço desconto por pacote?"}
                          </div>
                          <div className="prod-pacote-toggle-desc">
                            {form.oferece_pacote
                              ? "Cadastre os pacotes e o valor promocional abaixo"
                              : (() => {
                                  const exs: Record<string, string> = {
                                    unidade: "Ex: 6 unidades por R$ 25 (em vez de R$ 30)",
                                    fatia: "Ex: 4 fatias por R$ 30 (em vez de R$ 40)",
                                    kg: "Ex: 2 kg por R$ 100 (em vez de R$ 120)",
                                    cento: "Ex: 2 centos por R$ 400 (em vez de R$ 500)",
                                    caixa: "Ex: 3 caixas por R$ 250 (em vez de R$ 300)",
                                  };
                                  return exs[form.forma_venda] || "";
                                })()}
                          </div>
                        </div>
                        <div className={`prod-pacote-switch${form.oferece_pacote ? " prod-pacote-switch--on" : ""}`}>
                          <div className="prod-pacote-switch-thumb" />
                        </div>
                      </div>
                    )}

                    {/* Variações: aparece sempre pra tamanho/outros; só se toggle ON pros outros */}
                    {(
                      (!["unidade", "fatia", "kg", "cento", "caixa"].includes(form.forma_venda))
                      || form.oferece_pacote
                    ) && !["kit-festa", "sob-encomenda"].includes(form.forma_venda) && (() => {
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
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0 0 10px" }}>{cfg.sub}</p>

                      {/* ══ Toggle PRO — Foto personalizada por variação (só pra unidade/fatia/cento/caixa) ══ */}
                      {["unidade", "fatia", "cento", "caixa"].includes(form.forma_venda) && (
                        <div
                          className={`prod-var-toggle${form.usar_foto_variacao && isPro ? " prod-var-toggle--on" : ""}${!isPro ? " prod-var-toggle--locked" : ""}`}
                          onClick={() => { if (isPro) setForm(f => ({ ...f, usar_foto_variacao: !f.usar_foto_variacao })); }}
                        >
                          <div className="prod-var-toggle-icon">📷</div>
                          <div className="prod-var-toggle-info">
                            <div className="prod-var-toggle-title">
                              Foto personalizada por variação
                              {!isPro && <span className="prod-var-toggle-pro">👑 PRO</span>}
                            </div>
                            <div className="prod-var-toggle-desc">
                              Personalize cada variação do seu produto e venda muito mais
                            </div>
                          </div>
                          <div className={`prod-var-switch${form.usar_foto_variacao && isPro ? " prod-var-switch--on" : ""}${!isPro ? " prod-var-switch--locked" : ""}`}>
                            <div className="prod-var-switch-thumb" />
                          </div>
                        </div>
                      )}

                      {/* ══ Lista de variações cadastradas (ordenadas crescente) ══ */}
                      {(form.tamanhos_disponiveis || [])
                        .map((t, originalIdx) => ({ ...t, originalIdx }))
                        .sort((a, b) => {
                          // Extrai números pra ordenar (funciona pra "6 un", "12 fatias", "500g", etc)
                          const numA = parseFloat(String(a.label).replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
                          const numB = parseFloat(String(b.label).replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
                          return numA - numB;
                        })
                        .map(t => {
                          const i = t.originalIdx;
                          const numQtd = parseFloat(String(t.label).replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
                          const precoUnit = numQtd > 0 ? t.preco / numQtd : null;
                          // Cálculo de economia: quanto sairia pelo preço base × qtd
                          const precoSemDesconto = numQtd > 0 && form.preco_normal > 0 ? form.preco_normal * numQtd : null;
                          const economia = precoSemDesconto && precoSemDesconto > t.preco
                            ? Math.round(((precoSemDesconto - t.preco) / precoSemDesconto) * 100)
                            : null;
                          const isEditando = editandoVariacao === i;
                          const useFoto = form.usar_foto_variacao && isPro;

                          // Extrai só o número (ex: "6 unidades" → "6")
                          const num = String(t.label).replace(/[^\d,.-]/g, "") || t.label;
                          // Tag da unidade (ex: "6 unidades" → "UNIDADES")
                          const unLabel = String(t.label).replace(/[\d,.-]+\s*/g, "").trim().toUpperCase() || cfg.suffix?.toUpperCase() || "";

                          // Modo COM foto (V3 - avatar circular)
                          if (useFoto) {
                            return (
                              <div key={i} className="prod-var-item prod-var-item--v3">
                                <div
                                  className={`prod-var-avatar${!t.foto_url ? " prod-var-avatar--empty" : ""}`}
                                  onClick={() => { setCropVariacaoIdx(i); cropVariacaoRef.current?.click(); }}
                                  title={t.foto_url ? "Trocar foto" : "Adicionar foto"}
                                >
                                  {t.foto_url ? (
                                    <>
                                      <img src={t.foto_url} alt="" />
                                      <button
                                        type="button"
                                        className="prod-var-avatar-x"
                                        onClick={e => { e.stopPropagation(); removeVariacaoFoto(i); }}
                                        title="Remover foto"
                                      >✕</button>
                                    </>
                                  ) : (
                                    <span className="prod-var-avatar-icon">📸</span>
                                  )}
                                  <span className="prod-var-avatar-cam">📷</span>
                                </div>
                                <div className="prod-var-info">
                                  <div className="prod-var-info-top">
                                    <span className="prod-var-num-inline">{num}</span>
                                    <span className="prod-var-tag-inline">{unLabel}</span>
                                  </div>
                                  {isEditando ? (
                                    <div className="prod-var-edit-row">
                                      <span className="prod-var-edit-rs">R$</span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        autoFocus
                                        className="prod-var-edit-input"
                                        value={editVariacaoValor ? formatPreco(parsePreco(editVariacaoValor)) : editVariacaoValor}
                                        onChange={e => {
                                          const raw = e.target.value;
                                          if (!raw) { setEditVariacaoValor(""); return; }
                                          const n = parsePreco(raw);
                                          setEditVariacaoValor(n ? formatPreco(n) : raw);
                                        }}
                                        onBlur={() => {
                                          const p = parsePreco(editVariacaoValor);
                                          if (p > 0) {
                                            setForm(f => {
                                              const arr = [...(f.tamanhos_disponiveis || [])];
                                              if (arr[i]) arr[i] = { ...arr[i], preco: p };
                                              return { ...f, tamanhos_disponiveis: arr };
                                            });
                                          }
                                          setEditandoVariacao(null); setEditVariacaoValor("");
                                        }}
                                        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setEditandoVariacao(null); setEditVariacaoValor(""); } }}
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      <div className="prod-var-preco-row">
                                        <span className="prod-var-preco">R$ {formatPreco(t.preco)}</span>
                                        {economia !== null && economia > 0 && (
                                          <span className="prod-var-eco">💰 -{economia}%</span>
                                        )}
                                      </div>
                                      <div className="prod-var-preco-un-row">
                                        {precoUnit && <span className="prod-var-preco-un">R$ {formatPreco(precoUnit)}/un</span>}
                                        {precoSemDesconto && economia !== null && economia > 0 && (
                                          <span className="prod-var-preco-tachado">· sem desconto R$ {formatPreco(precoSemDesconto)}</span>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                                <div className="prod-var-actions">
                                  <button
                                    type="button"
                                    className="prod-var-btn-mini"
                                    onClick={() => { setEditandoVariacao(i); setEditVariacaoValor(formatPreco(t.preco)); }}
                                    title="Editar preço"
                                  >✏️</button>
                                  <button
                                    type="button"
                                    className="prod-var-btn-mini prod-var-btn-mini--del"
                                    onClick={() => removeTamanho(i)}
                                    title="Excluir"
                                  >🗑️</button>
                                </div>
                              </div>
                            );
                          }

                          // Modo SEM foto (Design D - etiqueta rosa)
                          return (
                            <div key={i} className="prod-var-item prod-var-item--d">
                              <div className="prod-var-tag-side">
                                <div className="prod-var-tag-num">{num}</div>
                                <div className="prod-var-tag-un">{unLabel}</div>
                              </div>
                              <div className="prod-var-body">
                                <div className="prod-var-body-info">
                                  {isEditando ? (
                                    <div className="prod-var-edit-row">
                                      <span className="prod-var-edit-rs">R$</span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        autoFocus
                                        className="prod-var-edit-input"
                                        value={editVariacaoValor ? formatPreco(parsePreco(editVariacaoValor)) : editVariacaoValor}
                                        onChange={e => {
                                          const raw = e.target.value;
                                          if (!raw) { setEditVariacaoValor(""); return; }
                                          const n = parsePreco(raw);
                                          setEditVariacaoValor(n ? formatPreco(n) : raw);
                                        }}
                                        onBlur={() => {
                                          const p = parsePreco(editVariacaoValor);
                                          if (p > 0) {
                                            setForm(f => {
                                              const arr = [...(f.tamanhos_disponiveis || [])];
                                              if (arr[i]) arr[i] = { ...arr[i], preco: p };
                                              return { ...f, tamanhos_disponiveis: arr };
                                            });
                                          }
                                          setEditandoVariacao(null); setEditVariacaoValor("");
                                        }}
                                        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setEditandoVariacao(null); setEditVariacaoValor(""); } }}
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      <div className="prod-var-preco-row">
                                        <div className="prod-var-preco-big">R$ {formatPreco(t.preco)}</div>
                                        {economia !== null && economia > 0 && (
                                          <span className="prod-var-eco">💰 -{economia}%</span>
                                        )}
                                      </div>
                                      <div className="prod-var-preco-un-row">
                                        {precoUnit && <span className="prod-var-preco-un-mini">R$ {formatPreco(precoUnit)} por {cfg.suffix?.replace(/\(|\)|s$/g, "") || "un"}</span>}
                                        {precoSemDesconto && economia !== null && economia > 0 && (
                                          <span className="prod-var-preco-tachado">· sem desconto R$ {formatPreco(precoSemDesconto)}</span>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                                <div className="prod-var-actions">
                                  <button
                                    type="button"
                                    className="prod-var-btn-mini"
                                    onClick={() => { setEditandoVariacao(i); setEditVariacaoValor(formatPreco(t.preco)); }}
                                    title="Editar preço"
                                  >✏️</button>
                                  <button
                                    type="button"
                                    className="prod-var-btn-mini prod-var-btn-mini--del"
                                    onClick={() => removeTamanho(i)}
                                    title="Excluir"
                                  >🗑️</button>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                      {/* Input file oculto pra upload de foto de variação */}
                      <input
                        ref={cropVariacaoRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={e => { if (cropVariacaoIdx !== null) handleVariacaoFotoUpload(e, cropVariacaoIdx); }}
                      />

                      {/* Form pra adicionar novo (V1 aprovado - tag "UNIDADES" colada) */}
                      <div className="prod-var-add-row">
                        <div className="prod-var-input-group">
                          <input
                            type="text"
                            inputMode={form.forma_venda === "kg" || form.forma_venda === "cento" ? "decimal" : "numeric"}
                            placeholder={cfg.placeholder}
                            value={novoTamanho.label}
                            onChange={e => setNovoTamanho(t => ({ ...t, label: e.target.value }))}
                            className="prod-var-input"
                          />
                          <span className="prod-var-input-tag">
                            {(cfg.suffix || (form.forma_venda === "kg" ? "kg" : form.forma_venda === "tamanho" ? "" : "un")).toUpperCase()}
                          </span>
                        </div>
                        <div className="prod-var-preco-input">
                          <span>R$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={novoTamanho.preco ? formatPreco(parsePreco(novoTamanho.preco)) : novoTamanho.preco}
                            onChange={e => {
                              const raw = e.target.value;
                              if (!raw) { setNovoTamanho(t => ({ ...t, preco: "" })); return; }
                              const numero = parsePreco(raw);
                              setNovoTamanho(t => ({ ...t, preco: numero ? formatPreco(numero) : raw }));
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          className="prod-var-btn-add"
                          onClick={() => {
                            if (!novoTamanho.label.trim()) return;
                            const preco = parsePreco(novoTamanho.preco);
                            if (preco <= 0) return;
                            const label = formatLabel(novoTamanho.label.trim());
                            setForm(f => ({ ...f, tamanhos_disponiveis: [...(f.tamanhos_disponiveis || []), { label, preco }] }));
                            setNovoTamanho({ label: "", preco: "" });
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          <span>Adicionar</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
                  </>
                )}

                {/* Botão "+ Adicionar variação" — só aparece no modo Simples */}
                {wizardTipo === "simples" && (
                  <button
                    className="prod-btn-add-variacao"
                    onClick={() => setWizardTipo("variacoes")}
                    type="button"
                  >
                    <span style={{fontSize: 18, marginRight: 6}}>➕</span>
                    Adicionar variações (P/M/G, sabores...)
                  </button>
                )}

                {/* Botão "Voltar pra simples" — só aparece se está em variações E sem variações cadastradas */}
                {wizardTipo === "variacoes" && (form.tamanhos_disponiveis || []).length === 0 && !form.kit_itens?.length && (
                  <button
                    className="prod-btn-back-simples"
                    onClick={() => setWizardTipo("simples")}
                    type="button"
                  >
                    ← Voltar para produto simples
                  </button>
                )}
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
                        <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: "4px 0 0" }}>Pressione Enter ou clique em Adicionar</p>
                        <button onClick={() => addOpcao(campo, key)} className="prod-btn-3d" style={{ marginTop: "8px", alignSelf: "flex-start" }}>Adicionar</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
              )}

            </div>
            )}

            {/* ══════ WIZARD STEP 4 — EXTRAS E CONFIGURAÇÕES ══════ */}
            {wizardStep === 4 && (
            <div className="prod-modal-body">

              {/* Adicionais */}
              {(form.id || wizardOpts.complementos) && (
              <div className="prod-section">
                <p className="prod-section-label prod-section-label--novo">Extras pagos</p>
                <Toggle label="Oferecer extras" value={form.tem_adicionais || false} onChange={(v: boolean) => setForm(f => ({ ...f, tem_adicionais: v }))} colorClass="active-pink" />

                {form.tem_adicionais && (
                  <>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0" }}>Itens extras que o cliente pode adicionar (vela, topo, embalagem…)</p>

                    {/* Sugestões da biblioteca */}
                    {sugestoesBiblioteca.length > 0 && (
                      <div className="prod-sugestoes">
                        <p className="prod-sugestoes-lbl">💡 Da sua biblioteca:</p>
                        <div className="prod-sugestoes-chips">
                          {sugestoesBiblioteca.map(b => (
                            <button
                              key={b.id}
                              type="button"
                              className="prod-sug-chip"
                              onClick={() => {
                                setForm(f => ({
                                  ...f,
                                  adicionais: [...(f.adicionais || []), { nome: b.nome, valor: b.valor, from_biblioteca: b.id }]
                                }));
                              }}
                            >
                              + {b.nome} · R$ {formatPreco(b.valor)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lista de adicionais deste produto */}
                    {(form.adicionais || []).length > 0 && (
                      <div className="prod-adic-lista">
                        {(form.adicionais || []).map((a, i) => (
                          <div key={i} className="prod-adic-item">
                            <div className="prod-adic-item-info">
                              <span className="prod-adic-nome">{a.nome}</span>
                              <span className="prod-adic-valor">+ R$ {formatPreco(a.valor)}</span>
                              {a.from_biblioteca && <span className="prod-adic-tag">📚</span>}
                            </div>
                            <button
                              type="button"
                              className="prod-adic-remove"
                              onClick={() => setForm(f => ({ ...f, adicionais: (f.adicionais || []).filter((_, idx) => idx !== i) }))}
                              aria-label="Remover"
                            >×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Form pra adicionar novo */}
                    <div className="prod-adic-add">
                      <input
                        type="text"
                        placeholder="Ex: Vela decorativa"
                        value={novoAdicional.nome}
                        onChange={e => setNovoAdicional(a => ({ ...a, nome: e.target.value }))}
                        className="prod-add-input"
                        style={{ flex: 1.5, minWidth: 0 }}
                      />
                      <div className="prod-preco-input" style={{ flex: 1.1, minWidth: "110px", background: "var(--bg-card)" }}>
                        <span>R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={novoAdicional.valor ? formatPreco(parsePreco(novoAdicional.valor)) : novoAdicional.valor}
                          onChange={e => {
                            const raw = e.target.value;
                            // Se está vazio, deixa vazio (permite apagar)
                            if (!raw) { setNovoAdicional(a => ({ ...a, valor: "" })); return; }
                            // Aplica a máscara: converte pra número e formata BRL
                            const numero = parsePreco(raw);
                            setNovoAdicional(a => ({ ...a, valor: numero ? formatPreco(numero) : raw }));
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="prod-btn-3d"
                        onClick={() => {
                          const nome = novoAdicional.nome.trim();
                          const valor = parsePreco(novoAdicional.valor);
                          if (!nome) return;
                          const novoIndex = (form.adicionais || []).length;
                          setForm(f => ({ ...f, adicionais: [...(f.adicionais || []), { nome, valor }] }));
                          setNovoAdicional({ nome: "", valor: "" });
                          // Pergunta se quer salvar na biblioteca
                          setSalvarBibliotecaAsk({ nome, valor, index: novoIndex });
                        }}
                        disabled={!novoAdicional.nome.trim()}
                      >Adicionar</button>
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
                <div className="prod-toggles" style={{ flexDirection: "column", gap: "0.5rem" }}>
                  <Toggle label="Disponível" value={form.disponivel} onChange={(v: boolean) => setForm(f => ({ ...f, disponivel: v }))} colorClass="active-green" />
                  <Toggle label="Pronta entrega" value={form.pronta_entrega !== false} onChange={(v: boolean) => setForm(f => ({ ...f, pronta_entrega: v }))} colorClass="active-green" />
                </div>
              </div>

            </div>
            )}


            {/* ══════ RODAPÉ (steps 2, 3, 4) ══════ */}
            {wizardStep >= 2 && (
            <div className="prod-modal-footer prod-modal-footer--novo">
              <button className="prod-btn-cancelar-novo" onClick={handleTryClose}>Cancelar</button>
              {(() => {
                // Validações por passo
                const canAdvance = (() => {
                  if (wizardStep === 2) return form.nome.trim().length > 0 && form.categoria.trim().length > 0;
                  if (wizardStep === 3) return form.preco_normal > 0;
                  return true;
                })();
                const isLast = wizardStep === 4;
                const isEdit = !!form.id;

                if (isEdit) {
                  // Modo edição: salva direto em qualquer passo
                  return (
                    <button className="prod-btn-avancar-novo" onClick={handleSalvar} disabled={saving}>
                      {saving ? <span className="prod-spinner-sm" /> : "Salvar alterações"}
                    </button>
                  );
                }

                if (isLast) {
                  return (
                    <button className="prod-btn-avancar-novo" onClick={handleSalvar} disabled={saving}>
                      {saving ? <span className="prod-spinner-sm" /> : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{marginRight: 6}}><polyline points="20 6 9 17 4 12"/></svg>
                          Publicar produto
                        </>
                      )}
                    </button>
                  );
                }

                return (
                  <button
                    className="prod-btn-avancar-novo"
                    disabled={!canAdvance}
                    onClick={() => {
                      if (!canAdvance) return;
                      setWizardStep(s => (s + 1) as 1 | 2 | 3 | 4);
                    }}
                  >
                    Avançar
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" style={{marginLeft: 6}}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                );
              })()}
            </div>
            )}
          </div>

        </div>
      )}

      {/* ── Modal: perguntar se salva extra na biblioteca ── */}
      {salvarBibliotecaAsk && (
        <div className="prod-lib-overlay" onClick={() => setSalvarBibliotecaAsk(null)}>
          <div className="prod-lib-modal" onClick={e => e.stopPropagation()}>
            <div className="prod-lib-icon">📚</div>
            <h3 className="prod-lib-title">Salvar na sua biblioteca?</h3>
            <p className="prod-lib-desc">
              Você adicionou <b>"{salvarBibliotecaAsk.nome}"</b> {salvarBibliotecaAsk.valor > 0 && <>por <b>R$ {formatPreco(salvarBibliotecaAsk.valor)}</b> </>}
              como extra. Quer usar em outros produtos {form.categoria ? <>de <b>"{form.categoria}"</b></> : null}?
            </p>
            <div className="prod-lib-actions">
              <button
                type="button"
                className="prod-lib-btn-ghost"
                onClick={() => setSalvarBibliotecaAsk(null)}
              >Só neste produto</button>
              <button
                type="button"
                className="prod-btn-3d"
                style={{ flex: 1 }}
                onClick={async () => {
                  if (!userId) return;
                  const { data, error } = await supabase.from("biblioteca_extras").insert({
                    user_id: userId,
                    nome: salvarBibliotecaAsk.nome,
                    valor: salvarBibliotecaAsk.valor,
                    categorias: form.categoria ? [form.categoria] : []
                  }).select().single();
                  if (!error && data) {
                    setBiblioteca(b => [...b, data as BibliotecaExtra]);
                    // Vincula esse adicional ao id da biblioteca
                    setForm(f => ({
                      ...f,
                      adicionais: (f.adicionais || []).map((a, i) =>
                        i === salvarBibliotecaAsk.index ? { ...a, from_biblioteca: (data as BibliotecaExtra).id } : a
                      )
                    }));
                  }
                  setSalvarBibliotecaAsk(null);
                }}
              >Salvar {form.categoria ? `em "${form.categoria}"` : "na biblioteca"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal dedicado da Ficha Técnica (overlay duplo, fica por cima do modal do produto) ── */}
      {modal && fichaModalOpen && (
        <div className="ficha-modal-overlay" onClick={() => setFichaModalOpen(false)}>
          <div className="ficha-modal" onClick={e => e.stopPropagation()}>
            <button className="ficha-modal-close-x" onClick={() => setFichaModalOpen(false)} aria-label="Fechar">✕</button>
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
        <div className="prod-preview-overlay" onClick={() => setPreviewProduto(null)}>
          <div className="prod-preview-modal" onClick={e => e.stopPropagation()}>
            <button className="prod-preview-close" onClick={() => setPreviewProduto(null)} aria-label="Fechar">✕</button>

            {/* Imagem do produto (hero) */}
            {previewProduto.imagem_url ? (
              <div className="prod-preview-img">
                <img src={previewProduto.imagem_url.split(",")[0]} alt={previewProduto.nome} />
              </div>
            ) : (
              <div className="prod-preview-img prod-preview-img--placeholder">Sem imagem</div>
            )}

            <div className="prod-preview-body">
              {/* Header: nome + preço */}
              <div className="prod-preview-head">
                <div style={{ minWidth: 0, flex: 1 }}>
                  {previewProduto.categoria && <p className="prod-preview-cat">{previewProduto.categoria}</p>}
                  <h3 className="prod-preview-nome">{previewProduto.nome}</h3>
                </div>
                <div className="prod-preview-preco-wrap">
                  {previewProduto.promocao && previewProduto.preco_promocional && previewProduto.preco_promocional > 0 ? (
                    <>
                      <p className="prod-preview-preco-old">R$ {formatPreco(previewProduto.preco_normal)}</p>
                      <p className="prod-preview-preco">R$ {formatPreco(previewProduto.preco_promocional)}</p>
                    </>
                  ) : (
                    <p className="prod-preview-preco">R$ {formatPreco(previewProduto.preco_normal)}</p>
                  )}
                </div>
              </div>

              {previewProduto.descricao && (
                <p className="prod-preview-desc">{previewProduto.descricao}</p>
              )}

              <div className="prod-preview-tags">
                {previewProduto.forma_venda && (
                  <span className="prod-preview-tag">
                    {FORMAS_VENDA.find(f => f.value === previewProduto.forma_venda)?.label || previewProduto.forma_venda}
                  </span>
                )}
                {!previewProduto.disponivel && <span className="prod-preview-tag prod-preview-tag--error">Indisponível</span>}
                {previewProduto.promocao && <span className="prod-preview-tag prod-preview-tag--promo">Promoção</span>}
                {previewProduto.zero_acucar && <span className="prod-preview-tag">Zero açúcar</span>}
              </div>

              {previewProduto.created_at && (
                <p className="prod-preview-created">
                  Cadastrado em {new Date(previewProduto.created_at).toLocaleDateString("pt-BR")}
                </p>
              )}

              <div className="prod-preview-actions">
                <button
                  className="prod-preview-btn-editar"
                  onClick={() => { setPreviewProduto(null); openEditar(previewProduto); }}
                >
                  Editar produto
                </button>
                <button
                  className="prod-preview-btn-excluir"
                  onClick={() => { setPreviewProduto(null); setDeleteConfirm(previewProduto.id!); }}
                  aria-label="Excluir"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal "Descartar cadastro?" ═══ */}
      {confirmDiscardProd && (
        <div className="prod-discard-ov" onClick={() => setConfirmDiscardProd(false)}>
          <div className="prod-discard-box" onClick={e => e.stopPropagation()}>
            <div className="prod-discard-icon">⚠️</div>
            <h3 className="prod-discard-title">{form.id ? "Descartar alterações?" : "Descartar cadastro?"}</h3>
            <p className="prod-discard-desc">Você preencheu dados que serão perdidos.</p>
            <div className="prod-discard-actions">
              <button className="prod-discard-btn prod-discard-btn--stay" onClick={() => setConfirmDiscardProd(false)}>
                Continuar preenchendo
              </button>
              <button className="prod-discard-btn prod-discard-btn--go" onClick={() => { setConfirmDiscardProd(false); fecharModal(); }}>
                Descartar
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
        @media (min-width: 900px) {
          .prod-root {
            max-width: 1400px;
            min-height: calc(100vh - 5rem); /* menos padding do layout-main (3rem + 2rem) */
          }
        }
        .prod-root, .prod-root * { font-family: var(--font-base); }
        .prod-root button, .prod-root input, .prod-root select, .prod-root textarea { font-family: var(--font-base) !important; }

        /* ── Badge PRO (coroa + PRO, fundo preto) — igual perfil ── */
        .prod-pro-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: var(--accent, #2D1F26);
          color: #fff;
          padding: 3px 9px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: var(--fw-black, 800);
          letter-spacing: 0.05em;
          text-transform: uppercase;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          line-height: 1;
          flex-shrink: 0;
        }
        .prod-pro-badge img {
          width: 12px; height: 12px;
          object-fit: contain;
        }
        .prod-pro-badge--inline {
          font-size: 9px;
          padding: 2px 6px;
        }
        .prod-pro-badge--inline img { width: 10px; height: 10px; }

        /* ── Botão IA Descrição ── */
        .prod-ia-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border: none;
          border-radius: 999px;
          font-size: 11px;
          font-weight: var(--fw-bold);
          cursor: pointer;
          white-space: nowrap;
          transition: transform var(--dur-fast), opacity var(--dur-fast);
        }
        .prod-ia-btn--active {
          background: var(--primary-gradient, linear-gradient(135deg, #E85A8C, #C33A6E));
          color: #fff;
        }
        .prod-ia-btn--active:hover { transform: translateY(-1px); }
        .prod-ia-btn--locked {
          background: var(--bg-subtle, #F0EBED);
          color: var(--text-secondary);
          cursor: not-allowed;
        }

        /* ── Botão 3D estilo Duolingo ── */
        .prod-btn-3d {
          padding: 10px 20px;
          background: var(--primary, #E85A8C);
          color: #fff;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: var(--fw-black);
          cursor: pointer;
          white-space: nowrap;
          letter-spacing: 0.02em;
          box-shadow: 0 4px 0 var(--primary-dark, #C33A6E);
          transition: transform 0.08s ease, box-shadow 0.08s ease;
          text-transform: uppercase;
          font-family: var(--font-base) !important;
        }
        .prod-btn-3d:hover {
          filter: brightness(1.05);
        }
        .prod-btn-3d:active {
          transform: translateY(4px);
          box-shadow: 0 0 0 var(--primary-dark, #C33A6E);
        }
        .prod-btn-3d:disabled {
          background: #CFC5C9;
          box-shadow: 0 4px 0 #A8A0A4;
          cursor: not-allowed;
        }

        /* ── Row com inputs + botão Adicionar (tamanhos) ── */
        .prod-add-row {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          align-items: stretch;
        }

        /* ═══ SPLIT HERO (empty state) ═══ */
        .prod-loading-full {
          min-height: calc(100vh - 5rem);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .prod-hero-split {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        /* Mobile: vídeo NO TOPO + conteúdo empilhado */
        .prod-hero-left {
          display: flex; flex-direction: column;
          gap: var(--space-3);
          order: 2;
          text-align: center;
          align-items: center;
        }
        .prod-hero-right {
          display: flex;
          flex-direction: column;
          background: linear-gradient(135deg, var(--accent), #4A3038);
          border-radius: var(--radius-lg);
          padding: var(--space-2);
          box-shadow: 0 10px 30px rgba(45, 31, 38, 0.2);
          order: 1;
        }
        .prod-hero-video-thumb {
          aspect-ratio: 16/10;
          max-height: 200px;
          background: linear-gradient(135deg, var(--primary) 0%, #7C3AED 100%);
          border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .prod-hero-video-thumb::before {
          content: "";
          position: absolute; inset: 0;
          background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.2) 100%);
        }
        .prod-hero-video-play {
          width: 50px; height: 50px;
          border-radius: var(--radius-full);
          background: rgba(255,255,255,0.95);
          border: none;
          display: flex; align-items: center; justify-content: center;
          color: var(--primary);
          cursor: pointer;
          box-shadow: 0 6px 24px rgba(0,0,0,0.35);
          transition: transform var(--dur-fast) var(--ease-out);
          position: relative;
          z-index: 2;
        }
        .prod-hero-video-play:hover { transform: scale(1.08); }
        .prod-hero-video-play svg { margin-left: 3px; }
        .prod-hero-video-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-3) var(--space-2) var(--space-1);
          color: var(--text-inverse);
        }
        .prod-hero-video-t {
          font-size: var(--text-sm);
          font-weight: var(--fw-bold);
        }
        .prod-hero-video-badge {
          background: var(--primary);
          color: var(--text-inverse);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-full);
          font-size: 0.625rem;
          font-weight: var(--fw-black);
          letter-spacing: 0.08em;
        }

        .prod-hero-eyebrow {
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          color: var(--primary);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          line-height: 1;
        }
        .prod-hero-title {
          font-size: 2rem;
          font-weight: var(--fw-black);
          letter-spacing: -0.03em;
          line-height: 1.1;
          color: var(--text-title);
          margin: var(--space-1) 0 0;
        }
        .prod-hero-desc {
          font-size: var(--text-md);
          color: var(--text-secondary);
          line-height: 1.55;
          margin: var(--space-2) 0 0;
          max-width: 480px;
        }
        .prod-hero-actions {
          display: flex; gap: var(--space-2); flex-wrap: wrap;
          margin-top: var(--space-3);
          justify-content: center;
        }
        .prod-hero-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          background: var(--primary);
          color: var(--text-inverse);
          border: none;
          padding: var(--space-4) var(--space-6);
          border-radius: var(--radius-md);
          font-size: var(--text-md);
          font-weight: var(--fw-black);
          cursor: pointer;
          font-family: var(--font-base) !important;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          box-shadow: 0 4px 0 var(--primary-dark);
          transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
        }
        .prod-hero-btn-primary:hover { filter: brightness(1.05); }
        .prod-hero-btn-primary:active {
          transform: translateY(4px);
          box-shadow: 0 0 0 var(--primary-dark);
        }
        .prod-hero-btn-ghost {
          display: none; /* Mobile: só o botão primário (já tem o card do vídeo em cima) */
        }

        .prod-hero-tip {
          display: flex;
          gap: var(--space-3);
          background: var(--primary-light);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          align-items: flex-start;
          margin-top: var(--space-4);
        }
        .prod-hero-tip-icon {
          font-size: var(--text-xl);
          line-height: 1;
          flex-shrink: 0;
        }
        .prod-hero-tip-t {
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0 0 var(--space-1);
        }
        .prod-hero-tip-d {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0;
        }

        /* ═══ Desktop: split 1fr / 1.2fr — vídeo vai pra direita ═══ */
        @media (min-width: 900px) {
          .prod-hero-split {
            min-height: calc(100vh - 5rem);
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            gap: var(--space-6);
            padding: 0 var(--space-4);
          }
          .prod-hero-left {
            order: 1;
            gap: var(--space-4);
            flex: 1.3 1 440px;
            max-width: 560px;
            min-width: 0;
          }
          .prod-hero-right {
            order: 2;
            padding: var(--space-2);
            flex: 1 1 340px;
            max-width: 460px;
            min-width: 0;
          }
          .prod-hero-eyebrow { font-size: var(--text-sm); }
          .prod-hero-title { font-size: 2.5rem; line-height: 1.05; }
          .prod-hero-desc { font-size: var(--text-lg); }
          .prod-hero-tip-t { font-size: var(--text-sm); }
          .prod-hero-tip-d { font-size: var(--text-sm); }
          .prod-hero-btn-primary { padding: var(--space-4) var(--space-6); font-size: var(--text-md); }
          /* Desktop: volta alinhamento à esquerda (texto ao lado do vídeo) */
          .prod-hero-left { text-align: left; align-items: flex-start; }
          .prod-hero-actions { justify-content: flex-start; }
          .prod-hero-btn-ghost {
            display: inline-flex;
            align-items: center;
            gap: var(--space-2);
            background: var(--bg-subtle);
            color: var(--text-secondary);
            border: none;
            padding: var(--space-3) var(--space-5);
            border-radius: var(--radius-md);
            font-size: var(--text-sm);
            font-weight: var(--fw-bold);
            cursor: pointer;
            font-family: var(--font-base) !important;
            transition: background var(--dur-fast) var(--ease-out);
          }
          .prod-hero-btn-ghost:hover { background: var(--accent-light); }
          .prod-hero-video-play { width: 60px; height: 60px; }
          .prod-hero-video-play svg { width: 28px; height: 28px; }
          .prod-hero-video-t { font-size: var(--text-sm); }
        }

        /* ═══ EXTRAS / BIBLIOTECA ═══ */
        /* Sugestões da biblioteca */
        .prod-sugestoes {
          background: linear-gradient(135deg, #FFF9E5, #FFF3D6);
          border-radius: 12px;
          padding: 12px 14px;
        }
        .prod-sugestoes-lbl {
          font-size: 11px;
          font-weight: 700;
          color: #92400E;
          margin: 0 0 8px;
          letter-spacing: 0.03em;
        }
        .prod-sugestoes-chips {
          display: flex; flex-wrap: wrap; gap: 6px;
        }
        .prod-sug-chip {
          background: #fff;
          border: 1.5px solid #FCD34D;
          color: #92400E;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          font-family: var(--font-base);
          transition: all var(--dur-fast);
        }
        .prod-sug-chip:hover {
          background: #FCD34D;
          transform: translateY(-1px);
        }

        /* Lista de adicionais */
        .prod-adic-lista {
          display: flex; flex-direction: column;
          gap: 6px;
        }
        .prod-adic-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-subtle, #FBF4F6);
          border: 1.5px solid transparent;
          border-radius: 10px;
          padding: 10px 12px;
          gap: 8px;
        }
        .prod-adic-item-info {
          display: flex; align-items: center;
          gap: 8px; flex: 1; min-width: 0;
        }
        .prod-adic-nome {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-title);
        }
        .prod-adic-valor {
          font-size: 13px;
          font-weight: 800;
          color: var(--success, #15803D);
        }
        .prod-adic-tag {
          font-size: 12px;
          opacity: 0.6;
        }
        .prod-adic-remove {
          background: transparent;
          border: none;
          color: var(--error, #DC2626);
          font-size: 20px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          width: 24px; height: 24px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          transition: background var(--dur-fast);
        }
        .prod-adic-remove:hover { background: #FEE2E2; }

        /* Row de adicionar novo extra */
        .prod-adic-add {
          display: flex;
          gap: 8px;
          align-items: stretch;
          margin-top: 4px;
        }
        @media (max-width: 480px) {
          .prod-adic-add { flex-wrap: wrap; }
          .prod-adic-add .prod-btn-3d { width: 100%; }
        }

        /* ── Modal salvar na biblioteca ── */
        .prod-lib-overlay {
          position: fixed;
          inset: 0;
          background: rgba(45, 31, 38, 0.6);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: prodLibIn 0.2s ease;
        }
        @keyframes prodLibIn { from { opacity: 0; } to { opacity: 1; } }
        .prod-lib-modal {
          background: #fff;
          border-radius: 20px;
          padding: 26px 22px 20px;
          width: 100%;
          max-width: 380px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          animation: prodLibScale 0.22s cubic-bezier(0.22, 1, 0.36, 1);
          font-family: var(--font-base);
        }
        @keyframes prodLibScale {
          from { transform: scale(0.94); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        .prod-lib-icon {
          font-size: 44px;
          margin-bottom: 8px;
        }
        .prod-lib-title {
          font-size: 17px;
          font-weight: 900;
          margin: 0 0 8px;
          letter-spacing: -0.02em;
          color: var(--text-title);
        }
        .prod-lib-desc {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0 0 20px;
          line-height: 1.5;
        }
        .prod-lib-desc b { color: var(--text-title); }
        .prod-lib-actions {
          display: flex; gap: 8px;
        }
        .prod-lib-btn-ghost {
          background: var(--bg-subtle, #F0EBED);
          border: none;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
        }
        .prod-lib-btn-ghost:hover { background: var(--border); }
        .prod-add-input {
          padding: 10px 14px !important;
          border: 1.5px solid var(--border) !important;
          border-radius: 10px !important;
          font-size: 14px !important;
          font-family: var(--font-base) !important;
          outline: none !important;
          background: var(--bg-input, #fff) !important;
          transition: border-color var(--dur-fast) !important;
        }
        .prod-add-input:focus { border-color: var(--primary) !important; }
        @media (max-width: 480px) {
          .prod-add-row { flex-wrap: wrap; }
          .prod-add-row .prod-btn-3d { width: 100%; }
        }
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
        /* Mobile: 2 colunas no grid. Desktop: auto-fill respirável */
        .prod-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.6rem;
        }
        @media (min-width: 720px) {
          .prod-grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }
        }
        @media (min-width: 1100px) {
          .prod-grid { grid-template-columns: repeat(4, 1fr); gap: 0.9rem; }
        }
        @media (min-width: 1400px) {
          .prod-grid { grid-template-columns: repeat(5, 1fr); }
        }
        .prod-list { display:flex; flex-direction:column; gap:0.5rem; }
        .prod-list-item { background:var(--bg-card); border-radius: var(--radius-lg); padding:0.65rem; display:flex; align-items:center; gap:0.85rem; box-shadow:var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06)); }
        .prod-list-img { width:64px; height:64px; border-radius: var(--radius-md); overflow:hidden; background:var(--primary-light); display:flex; align-items:center; justify-content:center; flex-shrink:0; position:relative; cursor:pointer; }
        .prod-list-img img { width:100%; height:100%; object-fit:cover; }
        .prod-list-img-sem-foto {
          width: 100%; height: 100%;
          background: linear-gradient(135deg, #FEF3C7, #FCE7F3);
          display: flex; align-items: center; justify-content: center;
        }
        .prod-list-info { flex:1; min-width:0; }
        .prod-card {
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          overflow: hidden;
          border: 1.5px solid transparent;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          display: flex; flex-direction: column;
          transition: transform 0.18s var(--ease-out), box-shadow 0.18s var(--ease-out), border-color 0.18s var(--ease-out);
        }
        @media (hover: hover) {
          .prod-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 24px rgba(232, 90, 140, 0.15);
            border-color: var(--primary);
          }
        }
        .prod-card-img {
          aspect-ratio: 4/3;
          background: var(--bg-subtle);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }
        .prod-card-img img { width: 100%; height: 100%; object-fit: cover; }
        .prod-card-indisponivel {
          position: absolute; inset: 0;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(1px);
          display: flex; align-items: center; justify-content: center;
          color: var(--text-secondary);
          font-size: 0.7rem;
          font-weight: var(--fw-black);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .prod-card-promo {
          position: absolute;
          top: 8px; right: 8px;
          background: linear-gradient(135deg, #F59E0B, #D97706);
          color: var(--text-inverse);
          font-size: 0.6rem;
          font-weight: var(--fw-black);
          padding: 3px 8px;
          border-radius: 999px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .prod-card-badge-var {
          position: absolute;
          top: 8px; left: 8px;
          background: rgba(255,255,255,0.95);
          color: #1E40AF;
          font-size: 0.6rem;
          font-weight: var(--fw-black);
          padding: 3px 7px;
          border-radius: 6px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
        /* Placeholder motivador quando não tem foto */
        .prod-card-sem-foto {
          width: 100%; height: 100%;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 4px;
          padding: 8px;
          background: linear-gradient(135deg, #FEF3C7 0%, #FCE7F3 100%);
          text-align: center;
          transition: filter 0.2s;
        }
        .prod-card-sem-foto:hover { filter: brightness(1.03); }
        .prod-card-sem-foto-icon {
          font-size: 28px;
          line-height: 1;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.08));
        }
        .prod-card-sem-foto-title {
          font-size: 0.72rem;
          font-weight: var(--fw-black);
          color: var(--primary-dark);
          line-height: 1.1;
          letter-spacing: -0.01em;
        }
        .prod-card-sem-foto-cta {
          font-size: 0.6rem;
          color: #92400E;
          font-weight: var(--fw-medium);
          line-height: 1.1;
        }
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
          padding: 8px 10px;
          background: var(--primary-light);
          border: 1.5px dashed var(--primary);
          border-radius: var(--radius-sm);
          color: var(--primary-dark);
          font-family: var(--font-base);
          font-size: var(--font-caption);
          font-weight: var(--fw-semibold);
          cursor: pointer;
          text-align: center;
          width: 100%;
          line-height: 1.3;
          transition: background var(--dur-fast) var(--ease-out), transform var(--dur-fast);
        }
        .prod-card-sem-ficha:hover {
          background: #fce5ee;
          transform: translateY(-1px);
        }
        .prod-card-actions { display:flex; gap:0.4rem; padding:0.5rem 0.75rem; border-top:1px solid var(--border); }
        .prod-card-btn-edit { flex:1; padding:0.4rem; background:var(--bg-subtle); border:none; border-radius: var(--radius-sm); font-family: var(--font-base); font-size: var(--font-helper); font-weight: var(--fw-semibold); color:var(--text-primary); cursor:pointer; }
        .prod-card-btn-del { padding:0.4rem 0.6rem; background:#fff1f2; border:none; border-radius: var(--radius-sm); color:var(--error); cursor:pointer; display:flex; align-items:center; }
        /* ── Modal de Preview do Produto (abre ao clicar no card) ── */
        .prod-preview-overlay {
          position: fixed; inset: 0; z-index: 500;
          background: rgba(45, 31, 38, 0.55);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex; flex-direction: column;
          justify-content: flex-end;
          animation: prodOverlayIn 0.2s ease;
        }
        .prod-preview-modal {
          background: var(--bg-card);
          width: 100%;
          max-height: 92vh;
          display: flex; flex-direction: column;
          border-radius: 20px 20px 0 0;
          overflow: hidden;
          box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.18);
          animation: prodModalSlideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1);
          position: relative;
        }
        .prod-preview-modal::before {
          content: '';
          display: block;
          width: 36px; height: 4px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.6);
          margin: 10px auto 0;
          flex-shrink: 0;
          position: absolute; top: 0; left: 50%;
          transform: translateX(-50%);
          z-index: 5;
        }
        @media (min-width: 720px) {
          .prod-preview-overlay { justify-content: center; align-items: center; padding: 24px; }
          .prod-preview-modal {
            max-width: 520px;
            max-height: 88vh;
            border-radius: 20px;
            animation: prodModalFadeIn 0.22s ease;
          }
          .prod-preview-modal::before { display: none; }
        }
        .prod-preview-close {
          position: absolute; top: 12px; right: 14px; z-index: 6;
          width: 34px; height: 34px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(6px);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-family: inherit;
          font-size: 16px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background var(--dur-fast), color var(--dur-fast);
        }
        .prod-preview-close:hover { background: var(--text-title); color: #fff; border-color: var(--text-title); }
        .prod-preview-img {
          width: 100%;
          aspect-ratio: 16/10;
          overflow: hidden;
          background: var(--bg-subtle);
          flex-shrink: 0;
        }
        .prod-preview-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .prod-preview-img--placeholder {
          display: flex; align-items: center; justify-content: center;
          color: var(--text-muted);
          font-family: inherit;
          font-size: var(--font-helper);
        }
        .prod-preview-body {
          padding: var(--space-4);
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          flex: 1;
        }
        .prod-preview-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: var(--space-3);
        }
        .prod-preview-cat {
          margin: 0 0 3px;
          font-size: var(--font-caption);
          color: var(--text-muted);
          font-weight: var(--fw-medium);
          font-family: inherit;
        }
        .prod-preview-nome {
          margin: 0;
          font-size: var(--font-section-title);
          font-weight: var(--fw-bold);
          color: var(--text-title);
          font-family: inherit;
          line-height: var(--lh-tight);
          letter-spacing: -0.01em;
        }
        .prod-preview-preco-wrap {
          text-align: right;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .prod-preview-preco {
          margin: 0;
          font-size: var(--font-input);
          font-weight: var(--fw-black);
          color: var(--primary);
          font-family: inherit;
          letter-spacing: -0.01em;
        }
        .prod-preview-preco-old {
          margin: 0 0 2px;
          font-size: 12px;
          color: var(--text-muted);
          text-decoration: line-through;
          font-family: inherit;
        }
        .prod-preview-desc {
          margin: var(--space-3) 0 0;
          font-size: var(--font-body);
          color: var(--text-secondary);
          line-height: 1.5;
          font-family: inherit;
        }
        .prod-preview-tags {
          display: flex; flex-wrap: wrap;
          gap: var(--space-2);
          margin-top: var(--space-3);
        }
        .prod-preview-tag {
          font-size: var(--font-caption);
          color: var(--text-secondary);
          background: var(--bg-subtle);
          padding: 4px 10px;
          border-radius: 999px;
          font-family: inherit;
          font-weight: var(--fw-medium);
        }
        .prod-preview-tag--error { color: var(--error); background: #fee2e2; font-weight: var(--fw-semibold); }
        .prod-preview-tag--promo { color: var(--primary); background: var(--primary-light); font-weight: var(--fw-semibold); }
        .prod-preview-created {
          margin: var(--space-3) 0 0;
          font-size: var(--font-caption);
          color: var(--text-muted);
          font-family: inherit;
        }
        .prod-preview-actions {
          display: flex; gap: var(--space-2);
          margin-top: var(--space-4);
        }
        .prod-preview-btn-editar {
          flex: 1;
          padding: 12px;
          background: var(--text-title);
          color: #fff;
          border: none;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: var(--fw-bold);
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .prod-preview-btn-editar:hover { opacity: 0.9; }
        .prod-preview-btn-excluir {
          width: 44px;
          background: #fff1f2;
          color: var(--error);
          border: none;
          border-radius: var(--radius-md);
          font-family: inherit;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .prod-preview-btn-excluir:hover { background: #fee2e2; }

        /* ── Modal de Produto ── */
        .prod-modal-overlay {
          position: fixed; inset: 0; z-index: 500;
          background: rgba(45, 31, 38, 0.55);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          animation: prodOverlayIn 0.2s ease;
        }
        @keyframes prodOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        .prod-modal {
          background: var(--bg-card);
          width: 100%;
          max-height: 92vh;
          display: flex;
          flex-direction: column;
          font-family: var(--font-base);
          border-radius: 20px 20px 0 0;
          animation: prodModalSlideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1);
          overflow: hidden;
          box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.18);
        }
        .prod-modal *, .prod-modal button, .prod-modal input,
        .prod-modal select, .prod-modal textarea {
          font-family: inherit;
        }
        @keyframes prodModalSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        /* Handle grip no topo (só mobile) */
        .prod-modal::before {
          content: none;
        }
        @media (min-width: 720px) {
          .prod-modal-overlay { justify-content: center; align-items: center; padding: 24px; }
          .prod-modal {
            max-width: 640px;
            max-height: 88vh;
            border-radius: 20px;
            animation: prodModalFadeIn 0.22s ease;
          }
          .prod-modal::before { display: none; }
          @keyframes prodModalFadeIn {
            from { opacity: 0; transform: scale(0.96); }
            to   { opacity: 1; transform: scale(1); }
          }
        }
        /* Desktop: overlay em row pra caber preview ao lado */
        @media (min-width: 900px) {
          .prod-modal-overlay {
            flex-direction: row !important;
            align-items: center !important;
            gap: 20px;
          }
        }
        .prod-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }

        /* ── Header v2: ícone + título + subtitle ── */
        .prod-modal-header--v2 {
          gap: 12px;
          padding: 16px 18px;
          background: linear-gradient(180deg, var(--primary-light), var(--bg-card));
        }
        .prod-modal-header-icon {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px;
          flex-shrink: 0;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(45,31,38,0.08);
        }
        .prod-modal-header-icon img {
          width: 100%; height: 100%; object-fit: cover;
        }
        .prod-modal-header-text {
          flex: 1; min-width: 0;
          display: flex; flex-direction: column; gap: 2px;
        }
        .prod-modal-header--v2 .prod-modal-title {
          font-size: 16px;
          font-weight: var(--fw-black);
          letter-spacing: -0.02em;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .prod-modal-header-sub {
          margin: 0;
          font-size: 11px;
          color: var(--text-secondary);
          line-height: 1.35;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* ── Preview lateral (só desktop) ── */
        .prod-desk-preview { display: none; }

        @media (min-width: 900px) {
          .prod-modal-overlay {
            /* precisa reservar espaço pro preview lateral */
            gap: 16px;
          }
          .prod-desk-preview {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            width: 260px;
            flex-shrink: 0;
            max-height: 88vh;
            background: transparent;
          }
          .prod-desk-preview-label {
            display: flex; align-items: center; gap: 6px;
            color: #fff;
            font-size: 11px;
            font-weight: var(--fw-bold);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            opacity: 0.9;
          }
          .prod-desk-preview-card {
            background: #fff;
            border-radius: 16px;
            width: 100%;
            overflow: hidden;
            box-shadow: 0 12px 40px rgba(0,0,0,0.25);
            display: flex; flex-direction: column;
          }
          .prod-desk-preview-img {
            aspect-ratio: 4/3;
            background: linear-gradient(135deg, var(--primary-light), var(--primary));
            display: flex; align-items: center; justify-content: center;
            overflow: hidden;
          }
          .prod-desk-preview-img img {
            width: 100%; height: 100%; object-fit: cover;
          }
          .prod-desk-preview-placeholder {
            font-size: 44px;
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15));
          }
          .prod-desk-preview-body {
            padding: 12px 14px;
            display: flex; flex-direction: column; gap: 4px;
          }
          .prod-desk-preview-nome {
            font-size: 14px;
            font-weight: var(--fw-black);
            color: var(--text-title);
            letter-spacing: -0.01em;
          }
          .prod-desk-preview-desc {
            font-size: 10px;
            color: var(--text-secondary);
            line-height: 1.4;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .prod-desk-preview-preco-row {
            display: flex; align-items: baseline; gap: 6px;
            margin-top: 4px;
          }
          .prod-desk-preview-preco {
            font-size: 16px;
            font-weight: var(--fw-black);
            color: var(--primary);
          }
          .prod-desk-preview-preco-old {
            font-size: 10px;
            color: var(--text-muted);
            text-decoration: line-through;
          }
          .prod-desk-preview-cta {
            background: var(--primary);
            color: #fff;
            text-align: center;
            padding: 8px;
            font-size: 11px;
            font-weight: var(--fw-black);
            letter-spacing: 0.03em;
          }
          .prod-desk-preview-hint {
            margin: 0;
            font-size: 10px;
            color: rgba(255,255,255,0.65);
            text-align: center;
            font-style: italic;
          }
        }
        .prod-modal-title {
          font-size: var(--font-modal-title);
          font-weight: var(--fw-bold);
          line-height: var(--lh-tight);
          color: var(--text-title);
          margin: 0;
          flex: 1;
          min-width: 0;
          font-family: inherit;
        }
        .prod-modal-close {
          background: rgba(45, 31, 38, 0.1);
          border: 1.5px solid rgba(45, 31, 38, 0.15);
          border-radius: 50%;
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          color: var(--text-title);
          font-size: 18px;
          font-weight: 900;
          font-family: inherit;
          flex-shrink: 0;
          transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
        }
        .prod-modal-close:hover {
          background: var(--accent, #2D1F26);
          color: #fff;
          border-color: var(--accent, #2D1F26);
        }
        .prod-modal-back {
          background: var(--bg-subtle);
          border: none;
          border-radius: 50%;
          width: 34px; height: 34px;
          cursor: pointer;
          color: var(--text-secondary);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
        }
        .prod-modal-back:hover { background: var(--border); color: var(--text-title); }
        .prod-modal-body {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: var(--space-4);
          display: flex; flex-direction: column;
          gap: var(--gap-section);
          overscroll-behavior: contain;
        }

        /* ═══ PROPOSTA A: Espaçamento + fontes maiores ═══ */
        .prod-modal-body {
          padding: 20px 18px !important;
          gap: 22px !important;
        }
        /* Divisores entre seções */
        .prod-section + .prod-section {
          border-top: 1px solid #F0EBED;
          padding-top: 22px;
        }
        /* Label de seção com barrinha rosa lateral */
        .prod-section-label {
          font-size: 13px !important;
          font-weight: 800 !important;
          letter-spacing: 0.06em !important;
          display: flex !important;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px !important;
        }
        .prod-section-label::before {
          content: "";
          width: 3px;
          height: 16px;
          background: var(--primary);
          border-radius: 2px;
          flex-shrink: 0;
        }
        /* Inputs maiores e mais respiráveis */
        .prod-field label {
          font-size: 14px !important;
          font-weight: 700 !important;
          color: var(--text-title);
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .prod-field label em {
          font-size: 11px !important;
          font-style: normal;
          color: var(--text-muted);
          font-weight: 500 !important;
          text-transform: lowercase;
        }
        .prod-field input,
        .prod-field select,
        .prod-field textarea {
          padding: 14px 16px !important;
          font-size: 14px !important;
          border-radius: 12px !important;
        }
        .prod-preco-input { border-radius: 12px !important; }
        .prod-preco-input span { font-size: 14px !important; }
        .prod-preco-input input { padding: 14px 8px 14px 0 !important; font-size: 14px !important; }
        /* Fotos maiores */
        .prod-img-upload {
          width: 100% !important;
          aspect-ratio: 1 !important;
          height: auto !important;
          border-radius: 14px !important;
        }
        .prod-imgs-row {
          display: grid !important;
          grid-template-columns: 1fr 1fr 1fr !important;
          gap: 10px !important;
        }
        .prod-img-placeholder p { font-size: 12px !important; font-weight: 800 !important; }
        .prod-img-placeholder span { font-size: 10px !important; }
        .prod-img-cta {
          font-size: 11px !important;
          font-weight: 800 !important;
          color: #6366F1 !important;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-top: 4px;
        }
        /* Toggle maior */
        .prod-toggle-item {
          padding: 14px 16px !important;
          font-size: 14px !important;
          font-weight: 700 !important;
          border-radius: 12px !important;
        }
        /* ═══ FIM PROPOSTA A ═══ */
        .prod-modal-footer {
          padding: var(--space-3) var(--space-4);
          padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom));
          display: flex;
          gap: var(--gap-stack);
          flex-shrink: 0;
          background: var(--bg-card);
        }
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
        .prod-btn-cancelar {
          flex: 1; padding: var(--space-3);
          background: #6B5D64;
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-base) !important;
          font-size: var(--font-button);
          font-weight: var(--fw-black);
          line-height: var(--lh-normal);
          color: #FFFFFF;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          box-shadow: 0 4px 0 #4A3E44;
          transition: transform 0.08s ease, box-shadow 0.08s ease, background 0.08s;
        }
        .prod-btn-cancelar:hover { background: #5A4E55; }
        .prod-btn-cancelar:active {
          transform: translateY(4px);
          box-shadow: 0 0 0 #4A3E44;
        }
        .prod-btn-salvar {
          flex: 2; padding: var(--space-3);
          background: var(--primary);
          color: var(--text-inverse);
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-base) !important;
          font-size: var(--font-button);
          font-weight: var(--fw-black);
          line-height: var(--lh-normal);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          box-shadow: 0 4px 0 var(--primary-dark);
          transition: transform 0.08s ease, box-shadow 0.08s ease;
        }
        .prod-btn-salvar:hover:not(:disabled) { filter: brightness(1.05); }
        .prod-btn-salvar:active:not(:disabled) {
          transform: translateY(4px);
          box-shadow: 0 0 0 var(--primary-dark);
        }
        .prod-btn-salvar:disabled {
          opacity: 0.5; cursor: not-allowed;
          box-shadow: 0 4px 0 var(--primary-dark);
        }

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
        .wiz-tipo-card--active { border-width: 2.5px; }

        /* ══════ Override: layout HORIZONTAL (mockup mobile) ══════ */
        .wiz-hero { margin: 4px 0; }
        .wiz-hero-title {
          font-size: 18px;
          font-weight: var(--fw-black);
          color: var(--text-title);
          letter-spacing: -0.02em;
          margin: 0 0 3px;
          line-height: 1.15;
        }
        .wiz-hero-sub {
          font-size: 11px;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.4;
        }
        .wiz-optional {
          display: inline-block;
          margin-left: 6px;
          font-size: 9px;
          font-weight: var(--fw-bold);
          color: #6B5D64;
          background: #F0EBED;
          padding: 2px 6px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        /* ═══ Tags marketing (Aumente Lucro / Opcional) ═══ */
        .wiz-opt-title-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 2px;
        }
        .wiz-opt-tag {
          display: inline-block;
          font-size: 9px;
          font-weight: var(--fw-black);
          padding: 3px 7px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          line-height: 1;
          white-space: nowrap;
        }
        .wiz-opt-tag--money {
          background: linear-gradient(135deg, #DCFCE7, #BBF7D0);
          color: #14532D;
          border: 1px solid #86EFAC;
        }
        .wiz-opt-tag--neutral {
          background: #F0EBED;
          color: #6B5D64;
        }
        .wiz-opt-card--active .wiz-opt-tag--money {
          background: rgba(255,255,255,0.9);
          color: #14532D;
          border-color: transparent;
        }
        .wiz-opt-card--active .wiz-opt-tag--neutral {
          background: rgba(255,255,255,0.85);
          color: #4a3b42;
        }
        /* ═══ Header seção com badge do tipo ═══ */
        .prod-section-hdr-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        .prod-tipo-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: var(--fw-black);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          line-height: 1;
        }
        .prod-tipo-badge--simples {
          background: #FEF3C7;
          color: #92400E;
        }
        .prod-tipo-badge--variacoes {
          background: #DBEAFE;
          color: #1E40AF;
        }
        /* ═══ Preço grande no modo simples ═══ */
        .prod-preco-input--big {
          padding: 8px 14px !important;
        }
        .prod-preco-input--big input {
          font-size: 22px !important;
          font-weight: var(--fw-black) !important;
          padding: 8px 4px !important;
        }
        .prod-preco-input--big span {
          font-size: 18px !important;
          font-weight: var(--fw-black) !important;
        }
        /* ═══ Botão "+ Adicionar variação" (dentro da seção simples) ═══ */
        .prod-btn-add-variacao {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 14px;
          margin-top: 12px;
          background: linear-gradient(135deg, #FCE7F3, #FBCFE8);
          color: var(--primary-dark);
          border: 2px dashed var(--primary);
          border-radius: 12px;
          font-family: var(--font-base) !important;
          font-size: 14px;
          font-weight: var(--fw-black);
          cursor: pointer;
          text-transform: none;
          letter-spacing: 0;
          transition: transform 0.08s, filter 0.08s;
        }
        .prod-btn-add-variacao:hover {
          filter: brightness(1.05);
          transform: translateY(-1px);
        }
        .prod-btn-add-variacao:active {
          transform: translateY(0);
        }
        /* ═══ Botão "← Voltar para simples" ═══ */
        .prod-btn-back-simples {
          display: block;
          margin: 10px auto 0;
          padding: 8px 14px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 12px;
          font-weight: var(--fw-bold);
          cursor: pointer;
          font-family: var(--font-base) !important;
          text-decoration: underline;
        }
        .prod-btn-back-simples:hover {
          color: var(--text-title);
        }


        /* ═══ WIZARD STEP 3 — CATEGORIA ═══ */
        .wiz-cat-hero {
          text-align: center;
          padding: var(--space-2) 0 var(--space-4);
        }
        .wiz-cat-icon {
          font-size: 44px;
          margin-bottom: 6px;
          filter: drop-shadow(0 4px 12px rgba(232, 90, 140, 0.2));
        }
        .wiz-cat-title {
          font-size: 18px;
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0 0 4px;
          letter-spacing: -0.02em;
        }
        .wiz-cat-sub {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0;
          max-width: 320px;
          margin-left: auto;
          margin-right: auto;
          line-height: 1.4;
        }
        .wiz-cat-list {
          display: grid;
          grid-template-columns: 1fr;
          gap: 6px;
          margin-bottom: 12px;
        }
        @media (min-width: 720px) {
          .wiz-cat-list { grid-template-columns: 1fr 1fr; }
        }
        .wiz-cat-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          background: #fff;
          border: 2px solid var(--border);
          border-radius: 12px;
          cursor: pointer;
          font-family: var(--font-base) !important;
          text-align: left;
          transition: all 0.15s;
        }
        .wiz-cat-item:hover {
          background: #F5F1F3;
          border-color: #D1CACD;
        }
        .wiz-cat-item--active {
          background: var(--accent, #2D1F26) !important;
          border-color: var(--accent, #2D1F26) !important;
          box-shadow: 0 4px 12px rgba(45, 31, 38, 0.25);
        }
        .wiz-cat-item--active:hover {
          background: var(--accent, #2D1F26) !important;
        }
        .wiz-cat-item-radio {
          width: 20px; height: 20px;
          border-radius: 50%;
          border: 2px solid #D1CACD;
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: #fff;
        }
        .wiz-cat-item--active .wiz-cat-item-radio {
          background: var(--primary);
          border-color: var(--primary);
        }
        .wiz-cat-item-nome {
          font-size: 14px;
          font-weight: var(--fw-black);
          color: var(--text-title);
        }
        .wiz-cat-item--active .wiz-cat-item-nome { color: #fff; }
        .wiz-cat-nova-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #FCE7F3, #FBCFE8);
          color: var(--primary-dark);
          border: 2px dashed var(--primary);
          border-radius: 12px;
          font-family: var(--font-base) !important;
          font-size: 14px;
          font-weight: var(--fw-black);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: filter 0.1s, transform 0.1s;
        }
        .wiz-cat-nova-btn:hover { filter: brightness(1.05); transform: translateY(-1px); }
        .wiz-cat-nova-form {
          padding: 16px;
          background: var(--primary-light);
          border-radius: 14px;
          border: 1.5px dashed var(--primary);
        }
        .wiz-cat-nova-label {
          font-size: 13px;
          font-weight: var(--fw-black);
          color: var(--primary);
          margin: 0 0 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .wiz-cat-nova-input {
          width: 100%;
          padding: 12px 14px;
          border: 1.5px solid var(--border);
          border-radius: 10px;
          font-family: var(--font-base) !important;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
          background: var(--bg-card);
        }
        .wiz-cat-nova-input:focus { border-color: var(--primary); }
        .wiz-cat-icones-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 6px;
          max-height: 160px;
          overflow-y: auto;
          padding: 2px;
        }
        .wiz-cat-icone-btn {
          aspect-ratio: 1;
          border-radius: 8px;
          border: 2px solid transparent;
          background: rgba(255,255,255,0.7);
          padding: 3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .wiz-cat-icone-btn img { width: 100%; height: 100%; object-fit: contain; }
        .wiz-cat-icone-btn--active {
          border-color: var(--primary);
          background: var(--bg-card);
        }
        .wiz-cat-cancel {
          flex: 1;
          padding: 12px;
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: 10px;
          font-family: var(--font-base) !important;
          font-size: 13px;
          font-weight: var(--fw-bold);
          color: var(--text-secondary);
          cursor: pointer;
        }
        .wiz-cat-criar {
          flex: 2;
          padding: 12px;
          background: var(--primary);
          color: #fff;
          border: none;
          border-radius: 10px;
          font-family: var(--font-base) !important;
          font-size: 13px;
          font-weight: var(--fw-black);
          cursor: pointer;
        }
        .wiz-cat-criar:disabled { opacity: 0.5; cursor: not-allowed; }


        /* ═══════════════════════════════════════════════════════════
           VARIAÇÕES DE QUANTIDADE — Toggle PRO + Design D/V3
           ═══════════════════════════════════════════════════════════ */

        /* ── Toggle PRO ── */
        .prod-var-toggle {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px; margin-bottom: 12px;
          background: linear-gradient(135deg, #FEF3C7 0%, #FCE7F3 100%);
          border: 1.5px solid #F59E0B;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: var(--font-base);
        }
        .prod-var-toggle:hover { transform: translateY(-1px); }
        .prod-var-toggle--on {
          background: linear-gradient(135deg, #DCFCE7 0%, #F0FDF4 100%);
          border-color: #16A34A;
        }
        .prod-var-toggle--locked {
          background: #F5F1F3;
          border-color: #E5DFE1;
          opacity: 0.95;
          cursor: default;
        }
        .prod-var-toggle--locked:hover { transform: none; }
        .prod-var-toggle-icon {
          width: 40px; height: 40px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.7);
          font-size: 20px; flex-shrink: 0;
        }
        .prod-var-toggle-info { flex: 1; min-width: 0; }
        .prod-var-toggle-title {
          font-size: 13px; font-weight: 900; color: #2D1F26;
          display: flex; align-items: center; gap: 6px;
          flex-wrap: wrap; line-height: 1.25;
        }
        .prod-var-toggle-pro {
          display: inline-flex; align-items: center;
          background: #2D1F26; color: #fff;
          padding: 2px 7px; border-radius: 6px;
          font-size: 9px; font-weight: 900;
          letter-spacing: 0.05em;
        }
        .prod-var-toggle-desc {
          font-size: 11px; color: #6B5D64;
          margin-top: 2px; line-height: 1.35;
        }
        /* Switch iOS */
        .prod-var-switch {
          position: relative;
          width: 42px; height: 24px;
          background: #D1CACD; border-radius: 999px;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .prod-var-switch--on { background: #16A34A; }
        .prod-var-switch--locked {
          opacity: 0.6;
          position: relative;
        }
        .prod-var-switch--locked::after {
          content: "🔒";
          position: absolute;
          top: -3px; right: -6px;
          font-size: 11px;
        }
        .prod-var-switch-thumb {
          position: absolute;
          top: 3px; left: 3px;
          width: 18px; height: 18px;
          background: #fff; border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          transition: left 0.2s;
        }
        .prod-var-switch--on .prod-var-switch-thumb { left: 21px; }

        /* ── Item da lista (design D) ── */
        .prod-var-item {
          display: flex; align-items: stretch;
          background: #fff; border: 1.5px solid #F0EBED;
          border-radius: 10px; margin-bottom: 6px;
          overflow: hidden;
          transition: border-color 0.15s ease;
        }
        .prod-var-item:hover { border-color: #E85A8C; }

        /* Design D — etiqueta rosa gigante */
        .prod-var-item--d .prod-var-tag-side {
          background: linear-gradient(135deg, #E85A8C, #C33A6E);
          color: #fff; padding: 10px 14px;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          min-width: 76px;
        }
        .prod-var-tag-num {
          font-size: 20px; font-weight: 900; line-height: 1;
        }
        .prod-var-tag-un {
          font-size: 8px; font-weight: 900;
          margin-top: 3px; letter-spacing: 0.08em; opacity: 0.95;
          text-align: center;
        }
        .prod-var-body {
          flex: 1; padding: 10px 12px;
          display: flex; justify-content: space-between;
          align-items: center; gap: 8px;
          min-width: 0;
        }
        .prod-var-body-info { min-width: 0; flex: 1; }
        .prod-var-preco-big {
          font-size: 16px; font-weight: 900; color: #16A34A;
          line-height: 1.1;
        }
        .prod-var-preco-un-mini {
          font-size: 10px; color: #6B5D64; font-weight: 700;
          margin-top: 2px;
        }

        /* Design V3 — avatar circular (com foto) */
        .prod-var-item--v3 {
          align-items: center; gap: 12px;
          padding: 10px 12px;
        }
        .prod-var-avatar {
          width: 52px; height: 52px; border-radius: 12px;
          background: linear-gradient(135deg, #B45309, #7C2D12);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; flex-shrink: 0;
          border: 3px solid #E85A8C;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: transform 0.12s ease;
        }
        .prod-var-avatar:hover { transform: scale(1.05); }
        .prod-var-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .prod-var-avatar--empty {
          background: #FCE7F3;
          color: #E85A8C;
          border-style: dashed;
        }
        .prod-var-avatar-icon { font-size: 20px; }
        .prod-var-avatar-cam {
          position: absolute;
          bottom: -4px; right: -4px;
          background: #E85A8C; color: #fff;
          width: 20px; height: 20px; border-radius: 50%;
          font-size: 9px;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid #fff;
        }
        .prod-var-avatar-x {
          position: absolute;
          top: 2px; right: 2px;
          background: rgba(0,0,0,0.65); color: #fff;
          border: none; width: 18px; height: 18px;
          border-radius: 50%;
          font-size: 10px; font-weight: 900;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          font-family: var(--font-base);
        }
        .prod-var-avatar-x:hover { background: #DC2626; }
        .prod-var-info { flex: 1; min-width: 0; }
        .prod-var-info-top {
          display: flex; align-items: baseline; gap: 6px;
          flex-wrap: wrap;
        }
        .prod-var-num-inline {
          font-size: 17px; font-weight: 900; color: #2D1F26;
          line-height: 1;
        }
        .prod-var-tag-inline {
          display: inline-block;
          background: #F5EEF0; color: #E85A8C;
          font-size: 9px; font-weight: 900;
          padding: 2px 7px; border-radius: 999px;
          letter-spacing: 0.05em;
        }
        .prod-var-preco-row {
          display: flex; align-items: baseline; gap: 6px;
          margin-top: 4px; flex-wrap: wrap;
        }
        .prod-var-preco {
          font-size: 14px; font-weight: 900; color: #16A34A;
        }
        .prod-var-preco-un {
          font-size: 10px; color: #6B5D64; font-weight: 600;
        }

        /* Botões editar/excluir */
        .prod-var-actions {
          display: flex; gap: 4px; flex-shrink: 0;
        }
        .prod-var-btn-mini {
          width: 30px; height: 30px; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          background: #F5EEF0; color: #6B5D64;
          border: none; cursor: pointer; font-size: 13px;
          font-family: var(--font-base);
          transition: all 0.12s;
        }
        .prod-var-btn-mini:hover { background: #FCE7F3; color: #E85A8C; }
        .prod-var-btn-mini--del:hover { background: #FEE2E2; color: #DC2626; }

        /* Edição inline do preço */
        .prod-var-edit-row {
          display: flex; align-items: center; gap: 4px;
          border: 1.5px solid #E85A8C; border-radius: 8px;
          background: #fff; padding: 4px 8px;
          max-width: 130px;
        }
        .prod-var-edit-rs {
          font-size: 12px; font-weight: 800; color: #6B5D64;
        }
        .prod-var-edit-input {
          flex: 1; min-width: 0;
          border: none; outline: none;
          font-family: var(--font-base) !important;
          font-size: 14px; font-weight: 900;
          color: #16A34A;
          background: transparent;
          padding: 2px 0;
        }

        /* ── Input V1 — Tag "UNIDADES" colada ── */
        .prod-var-add-row {
          display: flex; gap: 6px; align-items: stretch;
          margin-top: 8px;
        }
        .prod-var-input-group {
          display: flex; align-items: stretch;
          border: 1.5px solid #E5DFE1; border-radius: 10px;
          background: #fff; overflow: hidden;
          flex: 1.4; min-width: 0;
          transition: border-color 0.15s ease;
        }
        .prod-var-input-group:focus-within { border-color: #E85A8C; }
        .prod-var-input {
          flex: 1; padding: 12px 12px; border: none; outline: none;
          font-family: var(--font-base) !important;
          font-size: 15px; font-weight: 800;
          min-width: 0; color: #2D1F26;
          background: transparent;
        }
        .prod-var-input::placeholder {
          font-weight: 500; color: #9A8B93;
        }
        .prod-var-input-tag {
          background: #F5EEF0;
          color: #E85A8C;
          font-size: 10px;
          font-weight: 900;
          padding: 0 12px;
          display: flex; align-items: center;
          letter-spacing: 0.08em;
          border-left: 1px solid #E5DFE1;
          white-space: nowrap;
          font-family: var(--font-base);
        }
        .prod-var-preco-input {
          flex: 1; min-width: 100px;
          display: flex; align-items: center;
          border: 1.5px solid #E5DFE1; border-radius: 10px;
          background: #fff; padding-left: 10px;
          transition: border-color 0.15s ease;
        }
        .prod-var-preco-input:focus-within { border-color: #E85A8C; }
        .prod-var-preco-input span {
          color: #6B5D64; font-weight: 700; font-size: 13px;
          margin-right: 2px;
        }
        .prod-var-preco-input input {
          flex: 1; padding: 12px 12px 12px 0; border: none; outline: none;
          font-family: var(--font-base) !important;
          font-size: 15px; font-weight: 800;
          background: transparent; min-width: 0; color: #2D1F26;
        }
        .prod-var-preco-input input::placeholder {
          font-weight: 500; color: #9A8B93;
        }
        .prod-var-btn-add {
          padding: 12px 16px; background: #E85A8C; color: #fff;
          border: none; border-radius: 10px;
          font-family: var(--font-base) !important;
          font-size: 13px; font-weight: 900;
          box-shadow: 0 3px 0 #C33A6E;
          cursor: pointer;
          display: flex; align-items: center; gap: 6px;
          white-space: nowrap;
          transition: transform 0.08s, box-shadow 0.08s;
        }
        .prod-var-btn-add:hover { filter: brightness(1.05); }
        .prod-var-btn-add:active {
          transform: translateY(3px);
          box-shadow: 0 0 0 #C33A6E;
        }

        /* ── Responsivo: mobile ── */
        @media (max-width: 640px) {
          .prod-var-add-row {
            flex-wrap: wrap;
          }
          .prod-var-input-group {
            flex: 1 1 60%;
            min-width: 0;
          }
          .prod-var-preco-input {
            flex: 1 1 35%;
            min-width: 100px;
          }
          .prod-var-btn-add {
            flex: 1 1 100%;
            justify-content: center;
            padding: 12px;
          }
          .prod-var-toggle {
            padding: 10px 12px;
          }
          .prod-var-toggle-icon {
            width: 36px; height: 36px;
            font-size: 18px;
          }
          .prod-var-item--d .prod-var-tag-side {
            min-width: 66px;
            padding: 8px 10px;
          }
          .prod-var-tag-num { font-size: 18px; }
          .prod-var-preco-big { font-size: 14px; }
          .prod-var-item--v3 {
            padding: 8px 10px;
            gap: 10px;
          }
          .prod-var-avatar {
            width: 46px; height: 46px;
          }
        }

        /* ═══════════════════════════════════════════════════════════
           WIZARD STEP 1 — TELA CHEIA ROSA (escolha do tipo)
           ═══════════════════════════════════════════════════════════ */

        /* Modal em modo step 1: sem overlay escuro, sem cantos, tela cheia */
        .prod-modal-overlay:has(.wiz-step1-full) {
          background: transparent !important;
          padding: 0 !important;
        }
        .prod-modal:has(.wiz-step1-full) {
          border-radius: 0 !important;
          max-width: 100vw !important;
          width: 100vw !important;
          max-height: 100vh !important;
          height: 100vh !important;
          box-shadow: none !important;
        }

        .wiz-step1-full {
          background: #E85A8C;
          color: #fff;
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: var(--font-base);
          z-index: 1;
        }

        /* X translúcido no canto */
        .wiz-step1-x {
          position: absolute;
          top: 20px; right: 20px;
          top: calc(20px + env(safe-area-inset-top, 0px));
          width: 40px; height: 40px;
          border-radius: 50%;
          background: rgba(255,255,255,0.18);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          z-index: 3;
          font-family: var(--font-base);
          transition: background 0.15s;
        }
        .wiz-step1-x:hover { background: rgba(255,255,255,0.3); }

        /* Hero — pergunta grande */
        .wiz-step1-hero {
          padding: 100px 32px 40px;
          text-align: center;
          position: relative;
          z-index: 2;
        }
        .wiz-step1-title {
          font-size: 32px;
          font-weight: 900;
          color: #fff;
          letter-spacing: -0.01em;
          line-height: 1.15;
          margin-bottom: 10px;
        }
        .wiz-step1-sub {
          font-size: 15px;
          color: rgba(255,255,255,0.85);
          line-height: 1.4;
          margin: 0;
        }

        /* Cards */
        .wiz-step1-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          padding: 0 32px 20px;
          position: relative;
          z-index: 2;
          flex: 1;
          align-content: center;
          max-width: 720px;
          margin: 0 auto;
          width: 100%;
        }
        .wiz-step1-card {
          background: #fff;
          border-radius: 18px;
          padding: 32px 20px 26px;
          text-align: center;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          border: none;
          color: #2D1F26;
          font-family: var(--font-base);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          min-height: 220px;
          justify-content: center;
        }
        .wiz-step1-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 16px 32px rgba(0,0,0,0.2);
        }
        .wiz-step1-card:active {
          transform: translateY(-2px);
        }
        .wiz-step1-card-icon {
          width: 72px;
          height: 72px;
          object-fit: contain;
          margin-bottom: 8px;
        }
        .wiz-step1-card-title {
          font-size: 17px;
          font-weight: 900;
          color: #2D1F26;
          line-height: 1.2;
        }
        .wiz-step1-card-desc {
          font-size: 13px;
          color: #6B5D64;
          line-height: 1.35;
          font-weight: 600;
        }
        .wiz-step1-card-ex {
          font-size: 12px;
          color: #9A8B93;
          line-height: 1.35;
          margin-top: 4px;
          font-style: italic;
        }

        /* Hint no fim */
        .wiz-step1-hint {
          text-align: center;
          padding: 8px 32px 32px;
          padding-bottom: calc(32px + env(safe-area-inset-bottom, 0px));
          font-size: 12px;
          color: rgba(255,255,255,0.75);
          position: relative;
          z-index: 2;
          margin: 0;
        }

        /* Responsivo */
        @media (max-width: 640px) {
          .wiz-step1-hero {
            padding: 80px 20px 28px;
          }
          .wiz-step1-title { font-size: 25px; }
          .wiz-step1-sub { font-size: 13.5px; }
          .wiz-step1-cards {
            padding: 0 16px 12px;
            gap: 12px;
          }
          .wiz-step1-card {
            padding: 22px 12px 18px;
            min-height: 180px;
            border-radius: 14px;
          }
          .wiz-step1-card-icon { width: 56px; height: 56px; }
          .wiz-step1-card-title { font-size: 15px; }
          .wiz-step1-card-desc { font-size: 12px; }
          .wiz-step1-card-ex { font-size: 11px; }
        }



        /* ═══════════════════════════════════════════════════════════
           WIZARD NOVO — Design limpo com progresso, header e rodapé
           ═══════════════════════════════════════════════════════════ */

        /* Modal com cantos menos arredondados */
        .prod-modal--novo {
          border-radius: 16px !important;
        }
        @media (max-width: 640px) {
          .prod-modal--novo {
            border-radius: 12px !important;
          }
        }

        /* Header limpo */
        .prod-modal-header-novo {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #fff;
          font-family: var(--font-base);
          gap: 8px;
        }
        .prod-modal-back-novo {
          width: 32px; height: 32px;
          border-radius: 8px;
          background: transparent;
          color: #6B5D64;
          border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background 0.12s;
        }
        .prod-modal-back-novo:hover {
          background: #F5EEF0;
          color: #E85A8C;
        }
        .prod-modal-title-novo {
          flex: 1;
          text-align: center;
          font-size: 14px;
          font-weight: 900;
          color: #2D1F26;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }
        .prod-modal-close-novo {
          width: 32px; height: 32px;
          border-radius: 50%;
          background: #E85A8C;
          color: #fff;
          border: none;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 900;
          cursor: pointer;
          transition: background 0.12s;
          font-family: var(--font-base);
        }
        .prod-modal-close-novo:hover { background: #C33A6E; }

        /* Progresso — bolinhas conectadas */
        .prod-progresso {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 4px 20px 12px;
          background: #fff;
          gap: 0;
        }
        .prod-progresso-item {
          display: flex;
          align-items: center;
        }
        .prod-progresso-dot {
          width: 26px; height: 26px;
          border-radius: 999px;
          background: #F0EBED;
          color: #9A8B93;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 900;
          font-family: var(--font-base);
          transition: all 0.2s ease;
          flex-shrink: 0;
        }
        .prod-progresso-dot--ativo {
          background: #E85A8C;
          color: #fff;
          box-shadow: 0 0 0 4px #FCE7F3;
        }
        .prod-progresso-dot--feito {
          background: #16A34A;
          color: #fff;
        }
        .prod-progresso-line {
          width: 48px;
          height: 2px;
          background: #F0EBED;
          transition: background 0.2s ease;
        }
        .prod-progresso-line--feito {
          background: #16A34A;
        }
        @media (max-width: 640px) {
          .prod-progresso-line {
            width: 32px;
          }
        }

        /* Labels de seção — SEM barrinha rosa */
        .prod-section-label--novo {
          font-size: 12px !important;
          font-weight: 900 !important;
          color: #6B5D64 !important;
          letter-spacing: 0.08em !important;
          text-transform: uppercase !important;
          margin: 0 0 10px !important;
          display: block !important;
        }
        .prod-section-label--novo::before {
          display: none !important;
        }

        /* Rodapé novo */
        .prod-modal-footer--novo {
          background: #fff !important;
          padding: 12px 16px 16px !important;
          padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)) !important;
          border-top: 1px solid #F5EEF0 !important;
          display: flex !important;
          gap: 8px !important;
        }
        .prod-btn-cancelar-novo {
          flex: 1;
          padding: 12px 20px;
          background: #F5F1F3;
          color: #6B5D64;
          border: 1.5px solid #E5DFE1;
          border-radius: 8px;
          font-family: var(--font-base) !important;
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          cursor: pointer;
          transition: background 0.12s;
        }
        .prod-btn-cancelar-novo:hover { background: #EBE5E8; }
        .prod-btn-avancar-novo {
          flex: 1.5;
          padding: 12px 20px;
          background: #E85A8C;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-family: var(--font-base) !important;
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          box-shadow: 0 3px 0 #C33A6E;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.08s, filter 0.08s;
        }
        .prod-btn-avancar-novo:hover:not(:disabled) { filter: brightness(1.05); }
        .prod-btn-avancar-novo:active:not(:disabled) {
          transform: translateY(3px);
          box-shadow: 0 0 0 #C33A6E;
        }
        .prod-btn-avancar-novo:disabled {
          background: #E85A8C;
          color: #fff;
          box-shadow: 0 3px 0 #C33A6E;
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Labels rosa */
        .prod-field-label--rosa {
          color: #E85A8C !important;
          font-weight: 800 !important;
        }
        .prod-field-obrig {
          font-size: 11px !important;
          font-style: normal !important;
          color: #9A8B93 !important;
          font-weight: 500 !important;
          margin-left: 4px;
        }

        /* CTA IA no textarea vazio (V3) */
        .prod-desc-empty-cta {
          padding: 20px 16px;
          background: linear-gradient(135deg, #FDFAFF 0%, #FDF7FA 100%);
          border: 1.5px dashed #E5DBEB;
          border-radius: 10px;
          text-align: center;
          transition: all 0.15s;
        }
        .prod-desc-empty-cta:hover {
          border-color: #A855F7;
          background: linear-gradient(135deg, #FAF0FF 0%, #FDF7FA 100%);
        }
        .prod-desc-empty-icon {
          font-size: 24px;
          margin-bottom: 6px;
          line-height: 1;
        }
        .prod-desc-empty-txt {
          font-size: 12px;
          color: #6B5D64;
          margin-bottom: 12px;
          line-height: 1.4;
        }
        .prod-desc-empty-txt b {
          color: #A855F7;
          font-weight: 900;
        }
        .prod-desc-empty-hint {
          font-size: 10px;
          color: #9A8B93;
          margin-top: 8px;
          font-style: italic;
        }
        .prod-desc-btn-write {
          padding: 8px 14px;
          background: #fff;
          border: 1.5px solid #E5DFE1;
          color: #6B5D64;
          border-radius: 8px;
          font-family: var(--font-base) !important;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.12s;
        }
        .prod-desc-btn-write:hover {
          border-color: #E85A8C;
          color: #E85A8C;
        }
        .prod-desc-btn-ia {
          padding: 8px 14px;
          background: linear-gradient(135deg, #A855F7, #EC4899);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-family: var(--font-base) !important;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          box-shadow: 0 2px 8px rgba(168, 85, 247, 0.3);
          transition: transform 0.08s, filter 0.08s;
        }
        .prod-desc-btn-ia:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }
        .prod-desc-btn-ia--locked {
          background: linear-gradient(135deg, #A855F7, #EC4899) !important;
          opacity: 0.55;
          cursor: not-allowed;
        }
        .prod-desc-btn-ia-crown {
          width: 12px;
          height: 12px;
          object-fit: contain;
          filter: brightness(0) invert(1);
        }

        /* Categoria compacta */
        .prod-cat-nova-btn {
          padding: 11px 14px;
          background: #FCE7F3;
          color: #E85A8C;
          border: 1.5px dashed #E85A8C;
          border-radius: 8px;
          font-family: var(--font-base) !important;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          display: flex; align-items: center; gap: 4px;
          white-space: nowrap;
        }
        .prod-cat-nova-btn:hover { background: #FBCFE8; }
        .prod-cat-nova-form {
          padding: 12px;
          background: #FDF7FA;
          border: 1.5px dashed #E85A8C;
          border-radius: 10px;
        }
        .prod-cat-nova-hint {
          font-size: 11px;
          font-weight: 900;
          color: #E85A8C;
          margin: 0 0 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .prod-cat-nova-form input {
          width: 100%;
          padding: 11px 12px;
          border: 1.5px solid #E5DFE1;
          border-radius: 8px;
          font-family: var(--font-base) !important;
          font-size: 14px;
          outline: none;
          background: #fff;
          box-sizing: border-box;
        }
        .prod-cat-nova-form input:focus { border-color: #E85A8C; }
        .prod-cat-cancel-btn {
          flex: 1;
          padding: 10px;
          background: #fff;
          border: 1.5px solid #E5DFE1;
          color: #6B5D64;
          border-radius: 8px;
          font-family: var(--font-base) !important;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .prod-cat-criar-btn {
          flex: 2;
          padding: 10px;
          background: #E85A8C;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-family: var(--font-base) !important;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }
        .prod-cat-criar-btn:disabled { opacity: 0.5; cursor: not-allowed; }



        /* ═══════════════════════════════════════════════════════════
           TOGGLE "OFEREÇO DESCONTO POR PACOTE?" + PREÇO COM TAG
           ═══════════════════════════════════════════════════════════ */

        /* Tag "/UNIDADE" colada dentro do input R$ */
        .prod-preco-input--taginline { overflow: hidden; }
        .prod-preco-input-tag {
          background: #F5EEF0;
          color: #E85A8C;
          font-size: 10px;
          font-weight: 900;
          padding: 0 12px;
          display: flex; align-items: center;
          letter-spacing: 0.08em;
          border-left: 1px solid #E5DFE1;
          align-self: stretch;
          white-space: nowrap;
          font-family: var(--font-base);
        }

        /* Toggle desconto por pacote */
        .prod-pacote-toggle {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px; margin-bottom: 12px;
          background: linear-gradient(135deg, #FEF3C7 0%, #FCE7F3 100%);
          border: 1.5px solid #F59E0B;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: var(--font-base);
        }
        .prod-pacote-toggle:hover { transform: translateY(-1px); }
        .prod-pacote-toggle--on {
          background: linear-gradient(135deg, #DCFCE7 0%, #F0FDF4 100%);
          border-color: #16A34A;
        }
        .prod-pacote-toggle-icon {
          width: 40px; height: 40px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.7);
          font-size: 20px; flex-shrink: 0;
        }
        .prod-pacote-toggle-info { flex: 1; min-width: 0; }
        .prod-pacote-toggle-title {
          font-size: 13px; font-weight: 900; color: #2D1F26;
          line-height: 1.25;
        }
        .prod-pacote-toggle-desc {
          font-size: 11px; color: #6B5D64;
          margin-top: 2px; line-height: 1.35;
        }
        .prod-pacote-switch {
          position: relative;
          width: 42px; height: 24px;
          background: #D1CACD; border-radius: 999px;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .prod-pacote-switch--on { background: #16A34A; }
        .prod-pacote-switch-thumb {
          position: absolute;
          top: 3px; left: 3px;
          width: 18px; height: 18px;
          background: #fff; border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          transition: left 0.2s;
        }
        .prod-pacote-switch--on .prod-pacote-switch-thumb { left: 21px; }

        /* Economia % badge */
        .prod-var-eco {
          display: inline-flex; align-items: center;
          background: #DCFCE7; color: #14532D;
          font-size: 10px; font-weight: 900;
          padding: 2px 8px; border-radius: 999px;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }

        /* Linha adicional: R$/un · sem desconto R$ X */
        .prod-var-preco-un-row {
          display: flex; align-items: baseline; gap: 4px;
          flex-wrap: wrap;
          margin-top: 2px;
        }
        .prod-var-preco-tachado {
          font-size: 10px; color: #9A8B93;
          text-decoration: line-through;
          font-weight: 600;
        }

        /* Responsivo mobile pro toggle */
        @media (max-width: 640px) {
          .prod-pacote-toggle {
            padding: 10px 12px;
          }
          .prod-pacote-toggle-icon {
            width: 36px; height: 36px;
            font-size: 18px;
          }
          .prod-preco-input-tag {
            padding: 0 10px;
            font-size: 9px;
          }
        }


          background: rgba(45, 31, 38, 0.75);
          backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          padding: var(--space-4);
          animation: prodDiscOvIn 0.2s ease;
          font-family: var(--font-base);
        }
        @keyframes prodDiscOvIn { from { opacity: 0; } to { opacity: 1; } }
        .prod-discard-box {
          background: var(--bg-card);
          border-radius: var(--radius-xl);
          padding: var(--space-5) var(--space-4);
          max-width: 360px; width: 100%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          animation: prodDiscBoxIn 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes prodDiscBoxIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .prod-discard-box, .prod-discard-box * { font-family: var(--font-base) !important; }
        .prod-discard-icon {
          font-size: 32px;
          margin-bottom: var(--space-2);
          filter: drop-shadow(0 2px 8px rgba(232,90,140,0.3));
        }
        .prod-discard-title {
          font-size: var(--text-lg);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0 0 var(--space-2);
          letter-spacing: -0.01em;
        }
        .prod-discard-desc {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          margin: 0 0 var(--space-4);
          line-height: 1.5;
        }
        .prod-discard-actions {
          display: flex; flex-direction: column;
          gap: var(--space-2);
        }
        .prod-discard-btn {
          padding: 12px;
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          font-family: var(--font-base) !important;
          transition: transform 0.08s ease, box-shadow 0.08s ease;
        }
        .prod-discard-btn--stay {
          background: var(--primary);
          color: var(--text-inverse);
          box-shadow: 0 4px 0 var(--primary-dark);
        }
        .prod-discard-btn--stay:hover { filter: brightness(1.05); }
        .prod-discard-btn--stay:active {
          transform: translateY(4px);
          box-shadow: 0 0 0 var(--primary-dark);
        }
        .prod-discard-btn--go {
          background: transparent;
          color: #DC2626;
          border: 1.5px solid #FEE2E2;
        }
        .prod-discard-btn--go:hover {
          background: #FEE2E2;
          border-color: #DC2626;
        }

        .wiz-tipo-ex {
          font-size: 12px;
          color: var(--text-muted);
          font-style: italic;
          margin: 3px 0 0;
          line-height: 1.3;
        }
        .wiz-tipo-list, .wiz-opts-list { gap: 8px !important; }
        .wiz-tipo-card, .wiz-opt-card {
          flex-direction: row !important;
          align-items: center !important;
          text-align: left !important;
          gap: 14px !important;
          padding: 16px 16px !important;
          border-radius: 12px !important;
          background: #fff !important;
          border: 2px solid var(--border) !important;
          box-shadow: 0 1px 3px rgba(45,31,38,0.06);
        }
        /* Hover: cinza bem sutil, NÃO rosa */
        .wiz-tipo-card:hover, .wiz-opt-card:hover {
          background: #F5F1F3 !important;
          border-color: #D1CACD !important;
        }
        /* Hover no card JÁ SELECIONADO: mantém cinza escuro fixo (não muda) */
        .wiz-tipo-card--active:hover, .wiz-opt-card--active:hover {
          background: var(--accent, #2D1F26) !important;
          border-color: var(--accent, #2D1F26) !important;
        }
        /* No touch (mobile), remove hover pra não ficar "sticky" após tap */
        @media (hover: none) {
          .wiz-tipo-card:hover, .wiz-opt-card:hover {
            background: #fff !important;
          }
          .wiz-tipo-card--active:hover, .wiz-opt-card--active:hover {
            background: var(--accent, #2D1F26) !important;
          }
        }
        .wiz-tipo-card--active, .wiz-opt-card--active {
          background: var(--accent, #2D1F26) !important;
          border-color: var(--accent, #2D1F26) !important;
          box-shadow: 0 4px 12px rgba(45, 31, 38, 0.25);
        }
        .wiz-tipo-icon {
          font-size: 32px !important;
          line-height: 1;
          flex-shrink: 0;
        }
        .wiz-tipo-info {
          flex: 1;
          min-width: 0;
          display: flex; flex-direction: column; gap: 1px;
        }
        .wiz-tipo-title {
          font-size: 15px !important;
          font-weight: var(--fw-black) !important;
          color: var(--text-title) !important;
          margin: 0 !important;
          letter-spacing: -0.01em;
        }
        .wiz-tipo-desc {
          font-size: 12px !important;
          color: var(--text-secondary) !important;
          margin: 0 !important;
          line-height: 1.35 !important;
        }
        /* Estado ativo: texto branco no fundo cinza escuro */
        .wiz-tipo-card--active .wiz-tipo-title,
        .wiz-tipo-card--active .wiz-tipo-desc,
        .wiz-opt-card--active .wiz-tipo-title,
        .wiz-opt-card--active .wiz-tipo-desc {
          color: #FFFFFF !important;
        }
        .wiz-tipo-card--active .wiz-tipo-ex,
        .wiz-opt-card--active .wiz-tipo-ex {
          color: rgba(255,255,255,0.75) !important;
        }
        /* Radio/check no active */
        .wiz-tipo-card--active .wiz-tipo-radio,
        .wiz-opt-card--active .wiz-opt-check {
          background: var(--primary) !important;
          border-color: var(--primary) !important;
        }
        .wiz-tipo-radio {
          width: 20px; height: 20px;
          border-radius: 50%;
          border: 2px solid #D1CACD;
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: #fff;
        }
        .wiz-tipo-radio--active {
          background: var(--primary);
          border-color: var(--primary);
        }
        .wiz-opt-check {
          width: 20px; height: 20px;
          border-radius: 6px;
          border: 2px solid #D1CACD;
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: #fff;
        }
        .wiz-opt-check--active {
          background: var(--primary) !important;
          border-color: var(--primary) !important;
        }
        .wiz-section-title {
          font-size: 12px !important;
          font-weight: var(--fw-bold) !important;
          color: var(--text-title) !important;
          margin: 6px 0 0 !important;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
        }
        .wiz-step-label {
          color: var(--primary) !important;
          font-weight: var(--fw-black) !important;
          font-size: 10px !important;
        }
        .wiz-progress-bar { height: 3px !important; border-radius: 999px !important; background: #F0EBED !important; }
        .wiz-progress-bar--active { background: linear-gradient(90deg, var(--primary), var(--primary-dark)) !important; }
        .wiz-footer {
          display: flex; gap: 8px;
          padding-top: 12px;
          margin-top: 4px;
        }
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
          max-width: 800px;
        }
        @media (min-width: 900px) {
          .prod-root {
            max-width: 1400px;
            min-height: calc(100vh - 5rem);
            padding-bottom: var(--space-4);
            margin: 0 auto;
          }
          /* Quando página está em empty state (só o hero), zera padding/gap
             pra o hero ocupar tudo e centralizar de verdade */
          .prod-root:has(> .prod-hero-split) {
            padding: 0;
            gap: 0;
          }
        }

        /* ── Tabs Produtos / Categorias ── */
        .prod-tabs-novo {
          display: flex;
          gap: 0.5rem;
          background: var(--bg-subtle);
          padding: 4px;
          border-radius: var(--radius-md);
        }
        /* Desktop: tabs escondidas — navegação vem da sidebar (sub-item Categorias) */
        @media (min-width: 900px) {
          .prod-tabs-novo { display: none; }
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

        /* ── Lista / Grid de produtos (responsivo) ── */
        .prod-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.6rem;
        }
        @media (min-width: 720px) {
          .prod-grid { grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
        }
        @media (min-width: 1000px) {
          .prod-grid { grid-template-columns: repeat(4, 1fr); gap: 0.85rem; }
        }
        @media (min-width: 1300px) {
          .prod-grid { grid-template-columns: repeat(5, 1fr); }
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
          background: rgba(45, 31, 38, 0.55);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          animation: fichaFadeIn var(--dur-normal) var(--ease-out);
        }
        @keyframes fichaFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .ficha-modal {
          width: 100%;
          max-height: 92vh;
          background: var(--bg-card);
          border-radius: 20px 20px 0 0;
          display: flex; flex-direction: column;
          overflow: hidden;
          box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.18);
          animation: fichaSlideIn 0.28s cubic-bezier(0.32, 0.72, 0, 1);
          position: relative;
        }
        @keyframes fichaSlideIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .ficha-modal::before {
          content: '';
          display: block;
          width: 36px; height: 4px;
          border-radius: 2px;
          background: var(--border);
          margin: 10px auto 0;
          flex-shrink: 0;
        }
        .ficha-modal-close-x {
          position: absolute;
          top: 12px; right: 14px;
          z-index: 5;
          width: 34px; height: 34px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(6px);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-size: 16px;
          font-weight: 700;
          font-family: inherit;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background var(--dur-fast), color var(--dur-fast);
        }
        .ficha-modal-close-x:hover { background: var(--text-title); color: #fff; border-color: var(--text-title); }
        @media (min-width: 720px) {
          .ficha-modal-overlay { justify-content: center; align-items: center; padding: 24px; }
          .ficha-modal {
            max-width: 760px;
            max-height: 88vh;
            border-radius: 20px;
            animation: fichaFadeScale 0.22s ease;
          }
          .ficha-modal::before { display: none; }
          @keyframes fichaFadeScale {
            from { opacity: 0; transform: scale(0.96); }
            to   { opacity: 1; transform: scale(1); }
          }
        }

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

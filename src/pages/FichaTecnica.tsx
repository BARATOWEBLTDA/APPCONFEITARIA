import { useState, useEffect, useMemo, ReactNode } from "react";
import { parseNumBR } from "@/lib/numeroBR";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";
import EmptyDoo from "@/components/EmptyDoo";
import QuickAddInsumo, { InsumoQuick } from "@/components/QuickAddInsumo";
import DooInfoModal from "@/components/DooInfoModal";
import AppPageHeader from "@/components/AppPageHeader";

// ── Famílias de unidades e conversão ──

type UnitFamily = "massa" | "volume" | "unidade";

const UNIT_FAMILIES: Record<string, { family: UnitFamily; toBase: number }> = {
  kg:  { family: "massa",   toBase: 1     },
  g:   { family: "massa",   toBase: 0.001 },
  L:   { family: "volume",  toBase: 1     },
  ml:  { family: "volume",  toBase: 0.001 },
  un:  { family: "unidade", toBase: 1     },
};

/** Retorna as unidades disponíveis para seleção na ficha técnica.
 *  Sempre dentro da mesma família do insumo — confeiteira que cadastrou
 *  em kg pode usar g na receita, mas nunca un. */
function getCompatibleUnits(insumo: Insumo): string[] {
  const info = UNIT_FAMILIES[insumo.unidade];
  if (!info) return [insumo.unidade];
  return Object.entries(UNIT_FAMILIES)
    .filter(([, v]) => v.family === info.family)
    .map(([k]) => k);
}

/** Unidade padrão pra usar na receita, dada a unidade do insumo */
function getDefaultRecipeUnit(insumo: Insumo): string {
  const info = UNIT_FAMILIES[insumo.unidade];
  if (!info) return insumo.unidade;
  if (info.family === "massa")  return "g";
  if (info.family === "volume") return "ml";
  return "un";
}

/** Converte quantidade para a unidade base da família (kg, L, un) */
function toBase(qtd: number, unidade: string): number {
  const info = UNIT_FAMILIES[unidade];
  return info ? qtd * info.toBase : qtd;
}

/** Calcula o custo de uma linha da ficha técnica.
 *  Confia que `unidade_utilizada` está na mesma família de `insumo.unidade`
 *  (garantido pelo getCompatibleUnits no UI). */
function calcCusto(qtd: number, unidadeUtilizada: string, insumo: Insumo): number {
  const custoUnit = insumo.custo_unitario || 0;
  const infoUtilizada = UNIT_FAMILIES[unidadeUtilizada];
  const infoInsumo = UNIT_FAMILIES[insumo.unidade];

  if (infoUtilizada && infoInsumo && infoUtilizada.family === infoInsumo.family && infoInsumo.toBase > 0) {
    const qtdNaUnidadeInsumo = (qtd * infoUtilizada.toBase) / infoInsumo.toBase;
    return qtdNaUnidadeInsumo * custoUnit;
  }

  // Fallback defensivo: famílias incompatíveis não deveriam acontecer
  return qtd * custoUnit;
}

// ── Types ──

type InsumoJoin = {
  quantidade: number;
  unidade_utilizada?: string;
  quantidade_base?: number;
  insumos: {
    id: string;
    nome: string;
    unidade: string;
    embalagem_tipo?: string;
    qtd_embalagem?: number;
    valor_compra?: number;
    custo_unitario: number;
    imagem_url?: string;
  };
};

type Produto = {
  id: string;
  nome: string;
  descricao: string;
  preco_normal: number;
  preco_promocional?: number;
  promocao: boolean;
  imagem_url?: string;
  categoria: string;
  forma_venda: string;
  created_at: string;
  rendimento_qtd?: string;
  rendimento_peso?: string;
  validade_dias?: number;
  validade_tipo?: string;
  embalagem?: string;
  observacoes_ficha?: string;
  cv_percentual?: number;
  tempo_preparo_min?: number;
  salario_desejado?: number;
  horas_semanais?: number;
  produto_insumos: InsumoJoin[];
};

type Insumo = {
  id: string;
  nome: string;
  unidade: string;
  embalagem_tipo?: string;
  qtd_embalagem?: number;
  valor_compra?: number;
  custo_unitario: number;
  imagem_url?: string;
};

type FichaItem = {
  insumo_id: string;
  quantidade: number;
  unidade_utilizada: string;
  insumo: Insumo;
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v: number) => v.toFixed(1).replace(".", ",");

const fmtCusto = (v: number) => {
  const n = Number(v) || 0;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/** Formata quantidade sem casas decimais desnecessárias.
 *  Ex: 1 → "1"; 1.5 → "1,5"; 0.25 → "0,25"; 395 → "395". */
const fmtQty = (v: number): string => {
  const n = Number(v) || 0;
  if (Number.isInteger(n)) return n.toString();
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
};

/** Retorna a unidade adaptada pra prosa, com pluralização quando faz sentido.
 *  Ex: ("un", 1) → "unidade"; ("un", 5) → "unidades"; ("kg", 1) → "kg"; ("Lata", 2) → "latas". */
const fmtUnidade = (unidade: string, qtd: number): string => {
  if (!unidade) return "";
  if (unidade === "un") return Math.abs(qtd) === 1 ? "unidade" : "unidades";
  // Unidades de medida ficam como cadastradas (case-sensitive: "kg", "g", "ml", "L")
  if (["kg", "g", "ml", "L"].includes(unidade)) return unidade;
  // Embalagens (Lata, Pacote, Caixa...) — lowercase + plural quando aplicável
  const lower = unidade.toLowerCase();
  return Math.abs(qtd) !== 1 ? lower + "s" : lower;
};

/** Variações do título do modal de "como calculamos o custo" — sorteadas
 *  a cada abertura pra dar variedade e tom mais humano à conversa.
 *  Mantidas curtas para combinar bem com `text-wrap: balance`. */
const MODAL_TITLE_VARIANTS: ((nome: string) => ReactNode)[] = [
  // Formais
  (n) => <><strong style={{ fontWeight: 800 }}>{n}</strong>, veja como calculamos este custo.</>,
  (n) => <><strong style={{ fontWeight: 800 }}>{n}</strong>, confira como chegamos a este valor.</>,
  (n) => <><strong style={{ fontWeight: 800 }}>{n}</strong>, entenda como este custo foi calculado.</>,
  (n) => <><strong style={{ fontWeight: 800 }}>{n}</strong>, vamos mostrar como esse valor foi obtido.</>,
  (n) => <><strong style={{ fontWeight: 800 }}>{n}</strong>, veja o passo a passo deste cálculo.</>,
  (n) => <><strong style={{ fontWeight: 800 }}>{n}</strong>, descubra como calculamos este ingrediente.</>,
  (n) => <><strong style={{ fontWeight: 800 }}>{n}</strong>, este é o cálculo por trás deste custo.</>,
  (n) => <><strong style={{ fontWeight: 800 }}>{n}</strong>, entenda de onde vem este valor.</>,
  // Descontraídas
  (n) => <><strong style={{ fontWeight: 800 }}>{n}</strong>, sem mistério! Veja como fizemos esse cálculo.</>,
  (n) => <><strong style={{ fontWeight: 800 }}>{n}</strong>, vamos abrir a calculadora e mostrar tudo.</>,
  (n) => <><strong style={{ fontWeight: 800 }}>{n}</strong>, aqui está a conta por trás deste custo.</>,
  (n) => <><strong style={{ fontWeight: 800 }}>{n}</strong>, veja cada etapa do cálculo.</>,
];

function calcular(p: Produto) {
  const itens = p.produto_insumos || [];
  const cmv = itens.reduce((s, pi) => {
    const qtd = Number(pi.quantidade) || 0;
    const unidadeUtilizada = pi.unidade_utilizada || pi.insumos?.unidade || "";
    return s + calcCusto(qtd, unidadeUtilizada, pi.insumos as Insumo);
  }, 0);
  const preco = (p.promocao && p.preco_promocional && p.preco_promocional > 0) ? Number(p.preco_promocional) : Number(p.preco_normal) || 0;
  const lucro = preco - cmv;
  const margemCmv = preco > 0 ? (cmv / preco) * 100 : 0;
  const margemLucro = preco > 0 ? (lucro / preco) * 100 : 0;
  return { cmv, lucro, preco, margemCmv, margemLucro, temFicha: itens.length > 0 };
}

export default function FichaTecnica() {
  const { profile } = useProfile();
  const primeiroNome = (profile?.nome || "").split(" ")[0] || "Confeiteira";
  const location = useLocation();
  const [userId, setUserId] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Produto | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "com" | "sem">("todos");

  // Edicao da ficha
  const [insumosCadastrados, setInsumosCadastrados] = useState<Insumo[]>([]);
  const [ficha, setFicha] = useState<FichaItem[]>([]);
  const [buscaInsumo, setBuscaInsumo] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [fichaView, setFichaView] = useState<"grid" | "lista">("grid");
  const [moAtivo, setMoAtivo] = useState(false);
  const [infoAtivo, setInfoAtivo] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerBusca, setPickerBusca] = useState("");
  const [pickerSel, setPickerSel] = useState<string[]>([]);
  const [infoCustoAberto, setInfoCustoAberto] = useState<string | null>(null);

  // Sorteia uma variação de título a cada abertura do modal explicativo.
  // Dep é `infoCustoAberto`: muda toda vez que abre/fecha → nova escolha;
  // enquanto aberto, fica estável (sem flicker em re-renders).
  const tituloModalIndex = useMemo(
    () => Math.floor(Math.random() * MODAL_TITLE_VARIANTS.length),
    [infoCustoAberto]
  );

  // Bloqueia scroll e oculta menu quando modal está aberto
  useEffect(() => {
    if (showQuickAdd) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
      document.body.classList.add("modal-open");
    } else {
      const top = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      document.body.classList.remove("modal-open");
      if (top) window.scrollTo(0, parseInt(top || "0") * -1);
    }
    return () => {
      const top = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      document.body.classList.remove("modal-open");
      if (top) window.scrollTo(0, parseInt(top || "0") * -1);
    };
  }, [showQuickAdd]);
  const [extras, setExtras] = useState({ rendimento_qtd: "", rendimento_peso: "", validade_dias: "", validade_tipo: "refrigerado", embalagem: "", observacoes_ficha: "", cv_percentual: "25", tempo_preparo_min: "", salario_desejado: "", horas_semanais: "40" });
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const loadProdutos = async (uid: string) => {
    const { data } = await supabase
      .from("produtos")
      .select("*, produto_insumos(quantidade, unidade_utilizada, quantidade_base, insumos(id, nome, unidade, embalagem_tipo, qtd_embalagem, valor_compra, custo_unitario, imagem_url))")
      .eq("user_id", uid)
      .order("nome");
    if (data) setProdutos(data as Produto[]);
  };

  const loadInsumos = async (uid: string) => {
    const { data } = await supabase.from("insumos").select("id, nome, unidade, embalagem_tipo, qtd_embalagem, valor_compra, custo_unitario, imagem_url").eq("user_id", uid).order("nome");
    if (data) setInsumosCadastrados(data as Insumo[]);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await Promise.all([loadProdutos(user.id), loadInsumos(user.id)]);
      setLoading(false);
    })();
  }, []);

  // Abre direto a ficha de um produto quando navega de Produtos com state.produtoId
  useEffect(() => {
    const pid = (location.state as any)?.produtoId;
    if (!loading && pid && !selected) {
      const p = produtos.find(x => x.id === pid);
      // Veio de outra tela (ex.: sucesso do cadastro): abre no topo, com o cabeçalho visível
      if (p) { abrirFicha(p); window.scrollTo(0, 0); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, produtos, location.state]);

  const abrirFicha = (p: Produto) => {
    setSelected(p);
    setFicha((p.produto_insumos || []).map(pi => {
      const insumo = pi.insumos as Insumo;
      return {
        insumo_id: insumo.id,
        quantidade: Number(pi.quantidade) || 0,
        unidade_utilizada: pi.unidade_utilizada || insumo.unidade,
        insumo,
      };
    }));
    setExtras({
      rendimento_qtd: p.rendimento_qtd || "",
      rendimento_peso: p.rendimento_peso || "",
      validade_dias: p.validade_dias ? String(p.validade_dias) : "",
      validade_tipo: p.validade_tipo || "refrigerado",
      embalagem: p.embalagem || "",
      observacoes_ficha: p.observacoes_ficha || "",
      cv_percentual: p.cv_percentual != null ? String(p.cv_percentual) : "25",
      tempo_preparo_min: p.tempo_preparo_min ? String(p.tempo_preparo_min) : "",
      salario_desejado: p.salario_desejado ? String(p.salario_desejado) : "",
      horas_semanais: p.horas_semanais ? String(p.horas_semanais) : "40",
    });
    setBuscaInsumo("");
    setShowQuickAdd(false);
    // Ativa as seções automaticamente se já houver dados salvos
    setMoAtivo(!!(p.salario_desejado || p.tempo_preparo_min));
    setInfoAtivo(!!(p.rendimento_qtd || p.rendimento_peso || p.validade_dias || p.embalagem || p.observacoes_ficha));
  };

  const fecharFicha = () => {
    setSelected(null);
    setFicha([]);
    setBuscaInsumo("");
    setShowQuickAdd(false);
  };

  // -- Manipulacao da ficha --
  const removeInsumo = (id: string) => setFicha(prev => prev.filter(f => f.insumo_id !== id));
  const setQtd = (id: string, qtd: number) => setFicha(prev => prev.map(f => f.insumo_id === id ? { ...f, quantidade: qtd } : f));
  const setUnidade = (id: string, unidade: string) => setFicha(prev => prev.map(f => f.insumo_id === id ? { ...f, unidade_utilizada: unidade } : f));

  // -- Picker (adicionar insumos já cadastrados, em lote) --
  const abrirPicker = () => { setPickerSel([]); setPickerBusca(""); setShowPicker(true); };
  const fecharPicker = () => { setShowPicker(false); setPickerSel([]); setPickerBusca(""); };
  const togglePickerSel = (id: string) => {
    setPickerSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const confirmarPicker = () => {
    const novos = insumosCadastrados.filter(i => pickerSel.includes(i.id) && !ficha.some(f => f.insumo_id === i.id));
    if (novos.length > 0) {
      setFicha(prev => [...prev, ...novos.map(ins => ({
        insumo_id: ins.id,
        quantidade: 0,
        unidade_utilizada: getDefaultRecipeUnit(ins),
        insumo: ins,
      }))]);
    }
    fecharPicker();
  };

  const handleInsumoSalvo = (novo: InsumoQuick) => {
    const ins: Insumo = { id: novo.id, nome: novo.nome, unidade: novo.unidade, custo_unitario: novo.custo_unitario, imagem_url: novo.imagem_url };
    setInsumosCadastrados(prev => [...prev, ins]);
    setFicha(prev => [...prev, {
      insumo_id: ins.id,
      quantidade: 0,
      unidade_utilizada: getDefaultRecipeUnit(ins),
      insumo: ins,
    }]);
    setShowQuickAdd(false);
    setQuickAddName("");
  };

  const salvarFicha = async () => {
    if (!selected || !userId) return;
    setSaving(true);

    // 1. Persiste vinculos produto_insumos
    await supabase.from("produto_insumos").delete().eq("produto_id", selected.id);
    const itens = ficha
      .filter(f => f.insumo_id && f.quantidade > 0)
      .map(f => ({
        user_id: userId,
        produto_id: selected.id,
        insumo_id: f.insumo_id,
        quantidade: f.quantidade,
        unidade_utilizada: f.unidade_utilizada,
        quantidade_base: toBase(f.quantidade, f.unidade_utilizada),
      }));
    if (itens.length > 0) {
      const { error: errIns } = await supabase.from("produto_insumos").insert(itens);
      if (errIns) {
        // Não deixa a ficha "sumir" calada: avisa e para (os ingredientes continuam na tela pra tentar de novo)
        setSaving(false);
        alert("Não foi possível salvar os ingredientes da ficha. Confira a internet e tente de novo.");
        return;
      }
    }

    // 2. Persiste campos extras no produto (respeitando os toggles ativos)
    await supabase.from("produtos").update({
      rendimento_qtd: infoAtivo ? extras.rendimento_qtd : "",
      rendimento_peso: infoAtivo ? extras.rendimento_peso : "",
      validade_dias: infoAtivo ? (parseInt(extras.validade_dias) || 0) : 0,
      validade_tipo: infoAtivo ? extras.validade_tipo : "refrigerado",
      embalagem: infoAtivo ? extras.embalagem : "",
      observacoes_ficha: infoAtivo ? extras.observacoes_ficha : "",
      cv_percentual: parseNumBR(extras.cv_percentual) || 0,
      tempo_preparo_min: moAtivo ? (parseInt(extras.tempo_preparo_min) || 0) : 0,
      salario_desejado: moAtivo ? (parseNumBR(extras.salario_desejado) || 0) : 0,
      horas_semanais: moAtivo ? (parseNumBR(extras.horas_semanais) || 40) : 40,
      updated_at: new Date().toISOString(),
    }).eq("id", selected.id);

    // 3. Recarrega e atualiza o produto selecionado
    await loadProdutos(userId);
    const { data } = await supabase
      .from("produtos")
      .select("*, produto_insumos(quantidade, unidade_utilizada, quantidade_base, insumos(id, nome, unidade, embalagem_tipo, qtd_embalagem, valor_compra, custo_unitario, imagem_url))")
      .eq("id", selected.id)
      .single();
    if (data) setSelected(data as Produto);

    setSaving(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const filtrados = produtos.filter(p => {
    if (busca.trim() && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    if (filtro === "com") return (p.produto_insumos || []).length > 0;
    if (filtro === "sem") return (p.produto_insumos || []).length === 0;
    return true;
  });
  const totalComFicha = produtos.filter(p => (p.produto_insumos || []).length > 0).length;

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh" }}><span className="ft-spinner" /><style>{`.ft-spinner{width:32px;height:32px;border:3px solid var(--primary-light);border-top-color:var(--primary);border-radius:50%;animation:ftspin .7s linear infinite}@keyframes ftspin{to{transform:rotate(360deg)}}`}</style></div>;

  /* DETAIL / EDIT VIEW */
  if (selected) {
    const cmvLive = ficha.reduce((s, f) => s + calcCusto(f.quantidade, f.unidade_utilizada, f.insumo), 0);
    const precoLive = (selected.promocao && selected.preco_promocional && selected.preco_promocional > 0) ? Number(selected.preco_promocional) : Number(selected.preco_normal) || 0;

    // Custos invisíveis
    const cvPct = parseNumBR(extras.cv_percentual) || 0;
    const cvLive = cmvLive * (cvPct / 100);

    // Mão de obra
    const salario = parseNumBR(extras.salario_desejado) || 0;
    const horasSem = parseNumBR(extras.horas_semanais) || 40;
    const tempoMin = parseInt(extras.tempo_preparo_min) || 0;
    const custoHora = horasSem > 0 ? salario / (horasSem * 4.33) : 0;
    const moLive = moAtivo ? custoHora * (tempoMin / 60) : 0;

    // Totais
    const custoTotalLive = cmvLive + cvLive + moLive;
    const lucroLive = precoLive - custoTotalLive;
    const margemLucroLive = precoLive > 0 ? (lucroLive / precoLive) * 100 : 0;
    const temFicha = ficha.length > 0;

    return (
      <>
      {/* Computador: cabeçalho padrão do app (no celular continua o "Voltar") */}
      <div className="ft-so-desk"><AppPageHeader title={selected.nome} subtitle="Ficha técnica e precificação" onBack={fecharFicha} /></div>
      <div className="ft-root">
        <button className="ft-back" onClick={fecharFicha}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Voltar
        </button>

        {/* ═══ Computador: 2 colunas (o celular ignora esses wrappers — display: contents) ═══ */}
        <div className="ft-desk-grid"><div className="ft-desk-main">

        {/* Cabeçalho do produto: foto à esquerda, título + lucro à direita */}
        <div className="ft-tree ft-so-cel">
          <div className="ft-tree-foto">
            {selected.imagem_url
              ? <img src={selected.imagem_url.split(",")[0]} alt={selected.nome} />
              : <div className="ft-tree-foto-placeholder">Sem imagem</div>
            }
          </div>
          <div className="ft-tree-info">
            <h1 className="ft-tree-nome">{selected.nome}</h1>
            <div className="ft-tree-lucro">
              <span className="ft-lucro-hero-label">Seu lucro</span>
              <strong className={`ft-lucro-hero-value ${lucroLive >= 0 ? "" : "ft-lucro-hero-value--neg"}`}>R$ {fmt(lucroLive)}</strong>
              <span className={`ft-lucro-hero-margin ${margemLucroLive >= 30 ? "ft-lucro-hero-margin--ok" : margemLucroLive >= 0 ? "ft-lucro-hero-margin--warn" : "ft-lucro-hero-margin--neg"}`}>{fmtPct(margemLucroLive)}% de margem</span>
            </div>
          </div>
        </div>

        {/* Breakdown de precificação */}
        <div className="ft-pricing-card ft-so-cel">
          <div className="ft-pricing-row">
            <span className="ft-pricing-label">CMV (ingredientes)</span>
            <span className="ft-pricing-value">R$ {fmt(cmvLive)}</span>
          </div>
          <div className="ft-pricing-row">
            <span className="ft-pricing-label">+ Custos invisíveis ({fmtPct(cvPct)}%)</span>
            <span className="ft-pricing-value">R$ {fmt(cvLive)}</span>
          </div>
          <div className="ft-pricing-row">
            <span className="ft-pricing-label">+ Mão de obra {tempoMin > 0 ? `(${tempoMin} min)` : ""}</span>
            <span className="ft-pricing-value">R$ {fmt(moLive)}</span>
          </div>
          <div className="ft-pricing-divider" />
          <div className="ft-pricing-row ft-pricing-row--total">
            <span className="ft-pricing-label">Custo total</span>
            <span className="ft-pricing-value">R$ {fmt(custoTotalLive)}</span>
          </div>
          <div className="ft-pricing-row">
            <span className="ft-pricing-label">Preço de venda</span>
            <strong className="ft-pricing-value ft-pricing-value--preco">R$ {fmt(precoLive)}</strong>
          </div>
        </div>

        {/* Editor da Composicao */}
        <div className="ft-edit-card">
          <div className="ft-card-head">
            <h2 className="ft-card-title">Ingredientes e custos</h2>
            {temFicha && (
              <div className="ft-view-toggle" role="group" aria-label="Visualização">
                <button
                  type="button"
                  className={`ft-view-btn${fichaView === "grid" ? " active" : ""}`}
                  onClick={() => setFichaView("grid")}
                  aria-label="Visualização com imagens"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                </button>
                <button
                  type="button"
                  className={`ft-view-btn${fichaView === "lista" ? " active" : ""}`}
                  onClick={() => setFichaView("lista")}
                  aria-label="Visualização em lista"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </button>
              </div>
            )}
          </div>

          {/* Computador: estados vazios */}
          {ficha.length === 0 && (
            <div className="ft-desk-vazio">
              {insumosCadastrados.length === 0 ? (
                <>
                  <div className="ft-desk-vazio-ic" aria-hidden="true">🧂</div>
                  <b>Cadastre seus ingredientes pra calcular o custo</b>
                  <p>A ficha técnica soma o custo de cada ingrediente que vai no produto. Comece pelo que você mais usa — leite condensado, farinha, ovos, chocolate…</p>
                  <button type="button" className="ft-desk-vazio-bt" onClick={() => { setQuickAddName(""); setShowQuickAdd(true); }}>+ Cadastrar primeiro ingrediente</button>
                  <div className="ft-desk-passos">
                    <div><b>1. Cadastre</b>nome, embalagem e quanto pagou</div>
                    <div><b>2. Adicione</b>à ficha com a quantidade usada</div>
                    <div><b>3. Veja</b>o custo e o lucro na hora</div>
                  </div>
                </>
              ) : (
                <>
                  <b>Nenhum ingrediente nesta ficha ainda</b>
                  <p>Adicione o que vai no {selected.nome} pra saber quanto ele custa.</p>
                  <div className="ft-desk-vazio-acoes">
                    <button type="button" className="ft-desk-vazio-bt" onClick={abrirPicker}>+ Adicionar ingrediente</button>
                    <button type="button" className="ft-desk-vazio-bt ft-desk-vazio-bt--claro" onClick={() => { setQuickAddName(""); setShowQuickAdd(true); }}>+ Cadastrar novo ingrediente</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Computador: ingredientes em tabela (mesmas ações do celular) */}
          {ficha.length > 0 && (
            <div className="ft-desk-tabela">
              <table>
                <thead><tr><th>Ingrediente</th><th>Quantidade usada</th><th className="num">Custo</th><th aria-label="Remover" /></tr></thead>
                <tbody>
                  {ficha.map(f => {
                    const ins = f.insumo;
                    const custoLinha = calcCusto(f.quantidade, f.unidade_utilizada, ins);
                    const unidades = getCompatibleUnits(ins);
                    return (
                      <tr key={f.insumo_id}>
                        <td>
                          <div className="ft-dt-ins">
                            {ins.imagem_url
                              ? <img src={ins.imagem_url} alt="" className="ft-dt-img" />
                              : <span className="ft-dt-img ft-dt-img--ph">{ins.nome.charAt(0).toUpperCase()}</span>}
                            <b>{ins.nome}</b>
                          </div>
                        </td>
                        <td>
                          <div className="ft-dt-qtd">
                            <input type="number" value={f.quantidade || ""} step="any" min="0" placeholder="0"
                              onChange={e => setQtd(f.insumo_id, parseFloat(e.target.value) || 0)} aria-label={`Quantidade de ${ins.nome}`} />
                            {unidades.length > 1 ? (
                              <select value={f.unidade_utilizada} onChange={e => setUnidade(f.insumo_id, e.target.value)} aria-label="Unidade">
                                {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            ) : <span className="ft-dt-un">{f.unidade_utilizada}</span>}
                          </div>
                        </td>
                        <td className="num">
                          <b>R$ {fmt(custoLinha)}</b>
                          <button type="button" className={`ft-dt-info${infoCustoAberto === f.insumo_id ? " on" : ""}`}
                            onClick={() => setInfoCustoAberto(prev => prev === f.insumo_id ? null : f.insumo_id)}
                            aria-label="Como esse valor é calculado" title="Como esse valor é calculado">i</button>
                        </td>
                        <td className="ft-dt-x">
                          <button type="button" onClick={() => removeInsumo(f.insumo_id)} aria-label="Remover" title="Remover">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {ficha.length === 0 ? (
            <div className="ft-edit-empty">
              <p className="ft-edit-empty-title">Nenhum ingrediente ainda</p>
              <p className="ft-edit-empty-sub">Adicione abaixo os insumos usados para fazer 1 unidade deste produto.</p>
            </div>
          ) : fichaView === "lista" ? (
            <div className="ft-list-mode">
              {ficha.map(f => {
                const ins = f.insumo;
                const custoLinha = calcCusto(f.quantidade, f.unidade_utilizada, ins);
                return (
                  <div key={f.insumo_id} className="ft-list-row">
                    <span className="ft-list-row-nome">{ins.nome}</span>
                    <span className="ft-list-row-qtd">{f.quantidade || 0} {f.unidade_utilizada}</span>
                    <span className="ft-list-row-custo">R$ {fmt(custoLinha)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ft-edit-list">
              {ficha.map(f => {
                const ins = f.insumo;
                const custoLinha = calcCusto(f.quantidade, f.unidade_utilizada, ins);
                const compatibleUnits = getCompatibleUnits(ins);
                const hasUnitChoice = compatibleUnits.length > 1;

                return (
                  <div key={f.insumo_id} className="ft-edit-item">
                    <div className="ft-edit-item-media">
                      {ins.imagem_url
                        ? <img src={ins.imagem_url} alt={ins.nome} className="ft-edit-item-img" />
                        : <div className="ft-edit-item-img ft-edit-item-img--ph">{ins.nome.charAt(0).toUpperCase()}</div>}
                    </div>

                    <div className="ft-edit-item-body">
                      <p className="ft-edit-item-nome">{ins.nome}</p>

                      <p className="ft-edit-item-sub">
                        <span className="ft-edit-item-sub-label">Custo:</span>{" "}
                        <span className="ft-edit-item-sub-value">
                          R$ {fmt(custoLinha)}
                          <button
                            type="button"
                            className="ft-edit-item-info"
                            onClick={() => setInfoCustoAberto(prev => prev === f.insumo_id ? null : f.insumo_id)}
                            aria-label="Como esse valor é calculado"
                            title="Como esse valor é calculado"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/>
                              <line x1="12" y1="16" x2="12" y2="12"/>
                              <line x1="12" y1="8" x2="12.01" y2="8"/>
                            </svg>
                          </button>
                        </span>
                      </p>

                      <div className="ft-edit-item-row">
                        <div className="ft-edit-item-input-group">
                          <input
                            type="number" value={f.quantidade || ""} step="any" min="0" placeholder="0"
                            onChange={e => setQtd(f.insumo_id, parseFloat(e.target.value) || 0)}
                          />
                          {hasUnitChoice ? (
                            <select
                              value={f.unidade_utilizada}
                              onChange={e => setUnidade(f.insumo_id, e.target.value)}
                            >
                              {compatibleUnits.map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="ft-edit-item-unit-fixed">{f.unidade_utilizada}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button className="ft-edit-item-del" onClick={() => removeInsumo(f.insumo_id)} aria-label="Remover" title="Remover">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Ações: adicionar existente / cadastrar novo */}
          <div className={`ft-add-actions${ficha.length === 0 ? " ft-add-actions--vazio" : ""}`}>
            {insumosCadastrados.length > 0 && <button type="button" className="ft-add-existente" onClick={abrirPicker}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              Adicionar insumo
            </button>}
            <button type="button" className="ft-add-novo" onClick={() => { setQuickAddName(""); setShowQuickAdd(true); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Cadastrar novo insumo
            </button>
          </div>
        </div>

        {/* Modal: selecionar insumos cadastrados (em lote) */}
        {showPicker && createPortal(
          <div
            className="ft-modal-overlay"
            onClick={fecharPicker}
            style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "1rem",
            }}
          >
            <div className="ft-picker" onClick={e => e.stopPropagation()}>
              <div className="ft-picker-head">
                <h3 className="ft-picker-title">Adicionar insumo</h3>
                <button className="ft-picker-close" onClick={fecharPicker} aria-label="Fechar">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="ft-picker-busca">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" placeholder="Buscar insumo..." value={pickerBusca} onChange={e => setPickerBusca(e.target.value)} />
              </div>

              <div className="ft-picker-grid">
                {insumosCadastrados
                  .filter(i => !ficha.some(f => f.insumo_id === i.id))
                  .filter(i => i.nome.toLowerCase().includes(pickerBusca.toLowerCase()))
                  .map(i => {
                    const sel = pickerSel.includes(i.id);
                    return (
                      <button key={i.id} type="button" className={`ft-picker-card${sel ? " selected" : ""}`} onClick={() => togglePickerSel(i.id)}>
                        <div className="ft-picker-card-img">
                          {i.imagem_url
                            ? <img src={i.imagem_url} alt={i.nome} />
                            : <div className="ft-picker-card-ph">{i.nome.charAt(0).toUpperCase()}</div>}
                          {sel && <span className="ft-picker-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>}
                        </div>
                        <span className="ft-picker-card-nome">{i.nome}</span>
                      </button>
                    );
                  })}
                {insumosCadastrados.filter(i => !ficha.some(f => f.insumo_id === i.id) && i.nome.toLowerCase().includes(pickerBusca.toLowerCase())).length === 0 && (
                  <p className="ft-picker-vazio">Nenhum insumo disponível. Cadastre um novo insumo.</p>
                )}
              </div>

              <button className="ft-picker-confirm" onClick={confirmarPicker} disabled={pickerSel.length === 0}>
                {pickerSel.length === 0 ? "Selecione os insumos" : `Adicionar ${pickerSel.length} insumo${pickerSel.length > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>,
          document.body
        )}

        {/* Modal de cadastro de insumo */}
        {showQuickAdd && createPortal(
          <div
            className="ft-modal-overlay"
            onClick={() => { setShowQuickAdd(false); setQuickAddName(""); }}
            style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "1rem",
            }}
          >
            <div
              className="ft-modal-card"
              onClick={e => e.stopPropagation()}
              style={{
                background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
                padding: "1.25rem", width: "100%", maxWidth: "420px",
                maxHeight: "88vh", overflowY: "auto",
                boxShadow: "0 12px 48px rgba(0,0,0,0.3)",
              }}
            >
              <QuickAddInsumo
                userId={userId}
                initialName={quickAddName}
                onSaved={handleInsumoSalvo}
                onCancel={() => { setShowQuickAdd(false); setQuickAddName(""); }}
              />
            </div>
          </div>,
          document.body
        )}

        <div className="ft-desk-par">
        {/* Custos invisíveis */}
        <div className="ft-edit-card">
          <div className="ft-card-head">
            <h2 className="ft-card-title">Custos invisíveis</h2>
          </div>
          <p className="ft-edit-empty-sub" style={{ margin: 0 }}>Água, luz, gás, corantes, plástico filme e outros itens difíceis de mensurar individualmente.</p>
          <div className="ft-cv-row">
            <div className="ft-field" style={{ flex: 1 }}>
              <label>Percentual sobre o CMV</label>
              <div className="ft-input-suffix">
                <input type="number" min="0" max="100" step="1" placeholder="Ex: 25" value={extras.cv_percentual} onChange={e => setExtras(s => ({ ...s, cv_percentual: e.target.value }))} />
                <span>%</span>
              </div>
            </div>
            <div className="ft-cv-result">
              <span className="ft-cv-result-label">= R$ {fmt(cvLive)}</span>
            </div>
          </div>
          <p className="ft-cv-hint">A maioria das confeiteiras usa entre 20% e 30% (o ideal é 25%) — cobre os gastos indiretos de produção.</p>
        </div>

        {/* Mão de obra */}
        <div className="ft-edit-card">
          <div className="ft-card-head">
            <h2 className="ft-card-title">Mão de obra</h2>
            <label className="ft-switch">
              <input type="checkbox" checked={moAtivo} onChange={e => setMoAtivo(e.target.checked)} />
              <span className="ft-switch-track"><span className="ft-switch-thumb" /></span>
            </label>
          </div>
          {!moAtivo ? (
            <p className="ft-card-off-hint">Ative para incluir o custo do seu tempo de trabalho no preço final.</p>
          ) : (
            <>
              <div className="ft-extras-edit" style={{ boxShadow: "none", padding: 0 }}>
                <div className="ft-field ft-field--half">
                  <label>Quanto deseja ganhar por mês?</label>
                  <div className="ft-input-prefix">
                    <span>R$</span>
                    <input type="text" inputMode="decimal" placeholder="3.000" value={extras.salario_desejado} onChange={e => setExtras(s => ({ ...s, salario_desejado: e.target.value }))} />
                  </div>
                </div>
                <div className="ft-field ft-field--half">
                  <label>Horas trabalhadas/semana</label>
                  <div className="ft-input-suffix">
                    <input type="number" min="1" max="80" placeholder="40" value={extras.horas_semanais} onChange={e => setExtras(s => ({ ...s, horas_semanais: e.target.value }))} />
                    <span>h</span>
                  </div>
                </div>
                <div className="ft-field ft-field--half">
                  <label>Tempo de preparo</label>
                  <div className="ft-input-suffix">
                    <input type="number" min="0" placeholder="0" value={extras.tempo_preparo_min} onChange={e => setExtras(s => ({ ...s, tempo_preparo_min: e.target.value }))} />
                    <span>min</span>
                  </div>
                </div>
                <div className="ft-field ft-field--half">
                  <label>Custo/hora</label>
                  <div className="ft-mo-result">R$ {fmt(custoHora)}/h</div>
                </div>
              </div>
              {moLive > 0 && (
                <div className="ft-cv-result" style={{ alignSelf: "flex-start" }}>
                  <span className="ft-cv-result-label">Mão de obra nesta receita: R$ {fmt(moLive)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detalhes extras */}
        </div>{/* fim ft-desk-par */}

        <div className="ft-edit-card ft-info-card">
          <div className="ft-card-head">
            <h2 className="ft-card-title">Informações do produto</h2>
            <label className="ft-switch">
              <input type="checkbox" checked={infoAtivo} onChange={e => setInfoAtivo(e.target.checked)} />
              <span className="ft-switch-track"><span className="ft-switch-thumb" /></span>
            </label>
          </div>
          {!infoAtivo ? (
            <p className="ft-card-off-hint">Ative para registrar rendimento, validade, embalagem e observações.</p>
          ) : (
            <div className="ft-extras-edit" style={{ boxShadow: "none", padding: 0 }}>
              <div className="ft-field ft-field--half">
                <label>Rende (unidades)</label>
                <input type="text" placeholder="Ex: 20 brigadeiros" value={extras.rendimento_qtd} onChange={e => setExtras(s => ({ ...s, rendimento_qtd: e.target.value }))} />
              </div>
              <div className="ft-field ft-field--half">
                <label>Peso total produzido</label>
                <input type="text" placeholder="Ex: 1,2 kg" value={extras.rendimento_peso} onChange={e => setExtras(s => ({ ...s, rendimento_peso: e.target.value }))} />
              </div>
              <div className="ft-field ft-field--half">
                <label>Validade após produção</label>
                <input type="number" min="0" placeholder="Ex: 5 dias" value={extras.validade_dias} onChange={e => setExtras(s => ({ ...s, validade_dias: e.target.value }))} />
              </div>
              <div className="ft-field ft-field--half">
                <label>Conservação</label>
                <select value={extras.validade_tipo} onChange={e => setExtras(s => ({ ...s, validade_tipo: e.target.value }))}>
                  <option value="ambiente">Ambiente</option>
                  <option value="refrigerado">Refrigerado</option>
                  <option value="congelado">Congelado</option>
                </select>
              </div>
              <div className="ft-field">
                <label>Embalagem</label>
                <input type="text" placeholder="Ex: Caixa kraft 20x20" value={extras.embalagem} onChange={e => setExtras(s => ({ ...s, embalagem: e.target.value }))} />
              </div>
              <div className="ft-field">
                <label>Observações</label>
                <textarea rows={2} placeholder="Informações sobre produção, armazenamento ou venda" value={extras.observacoes_ficha} onChange={e => setExtras(s => ({ ...s, observacoes_ficha: e.target.value }))} />
              </div>
            </div>
          )}
        </div>

        

        <button className="ft-btn-salvar ft-so-cel" onClick={salvarFicha} disabled={saving}>
          {saving ? "Salvando..." : "Salvar precificação"}
        </button>

        </div>{/* fim ft-desk-main */}

        {/* Computador: resumo fixo ao lado */}
        <aside className="ft-desk-side">
          <div className="ft-sum">
            <div className="ft-sum-top">
              {/* Mesma foto (e o mesmo "Sem imagem") do topo da ficha no celular */}
              <div className="ft-tree-foto ft-sum-foto">
                {selected.imagem_url
                  ? <img src={selected.imagem_url.split(",")[0]} alt={selected.nome} />
                  : <div className="ft-tree-foto-placeholder">Sem imagem</div>}
              </div>
              <div><b>{selected.nome}</b><span>Preço de venda R$ {fmt(precoLive)}</span></div>
            </div>
            <div className={`ft-sum-lucro${lucroLive < 0 ? " neg" : ""}`}>
              <small>Seu lucro</small>
              <b>R$ {fmt(lucroLive)}</b>
              <span>{fmtPct(margemLucroLive)}% de margem</span>
              {precoLive > 0 && (() => {
                const pc = (v: number) => `${Math.max(0, Math.min(100, (v / precoLive) * 100))}%`;
                return (
                  <>
                    <div className="ft-sum-barra" aria-hidden="true">
                      <i style={{ width: pc(cmvLive), background: "#C33A6E" }} />
                      <i style={{ width: pc(cvLive), background: "#F59E0B" }} />
                      {moLive > 0 && <i style={{ width: pc(moLive), background: "#6366F1" }} />}
                      <i style={{ width: pc(Math.max(0, lucroLive)), background: "#16a34a" }} />
                    </div>
                    <div className="ft-sum-leg">
                      <span style={{ ["--c" as any]: "#C33A6E" }}>Ingredientes</span>
                      <span style={{ ["--c" as any]: "#F59E0B" }}>Invisíveis</span>
                      {moLive > 0 && <span style={{ ["--c" as any]: "#6366F1" }}>Mão de obra</span>}
                      <span style={{ ["--c" as any]: "#16a34a" }}>Lucro</span>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="ft-sum-linhas">
              <div><span>CMV (ingredientes)</span><span>R$ {fmt(cmvLive)}</span></div>
              <div><span>+ Custos invisíveis ({fmtPct(cvPct)}%)</span><span>R$ {fmt(cvLive)}</span></div>
              <div><span>+ Mão de obra {tempoMin > 0 ? `(${tempoMin} min)` : ""}</span><span>R$ {fmt(moLive)}</span></div>
              <div className="t"><span>Custo total</span><span>R$ {fmt(custoTotalLive)}</span></div>
              <div className="pv"><span>Preço de venda</span><span>R$ {fmt(precoLive)}</span></div>
              {(parseNumBR(extras.rendimento_qtd) || 0) > 0 && (
                <div><span>Custo por unidade ({extras.rendimento_qtd})</span><span>R$ {fmt(custoTotalLive / (parseNumBR(extras.rendimento_qtd) || 1))}</span></div>
              )}
            </div>
            <button type="button" className="ft-sum-salvar" onClick={salvarFicha} disabled={saving}>
              {saving ? "Salvando..." : "Salvar precificação"}
            </button>
          </div>
        </aside>
        </div>{/* fim ft-desk-grid */}

        {savedToast && <div className="ft-toast">Ficha técnica salva!</div>}

        {/* Modal explicativo do custo na receita (mascote Doo) */}
        {(() => {
          if (!infoCustoAberto) return null;
          const f = ficha.find(x => x.insumo_id === infoCustoAberto);
          if (!f) return null;
          const ins = f.insumo;
          const custoLinha = calcCusto(f.quantidade, f.unidade_utilizada, ins);
          const qtdUsada = f.quantidade || 0;
          const valorPago = ins.valor_compra || 0;
          const qtdEmb = ins.qtd_embalagem || 0;
          const tipoEmb = (ins.embalagem_tipo || "").trim();

          // Item contável (un) usa multiplicação; contínuo (g, kg, ml, L) usa fração da embalagem
          const isContavel = ins.unidade === "un";
          const temEmbalagem = qtdEmb > 1 && tipoEmb && tipoEmb.toLowerCase() !== "avulso";
          const temValorCompra = valorPago > 0;

          // "lata", "pacote", "caixa"... — minúsculo pra fluir no texto
          const tipoEmbBaixo = temEmbalagem ? tipoEmb.toLowerCase() : "embalagem";

          // Gênero gramatical do tipo de embalagem (PT-BR) para contrações "na/no", "da/do", "uma/um".
          // Das 12 embalagens disponíveis em QuickAddInsumo, as femininas são:
          // Caixa, Lata, Garrafa, Bandeja, Bisnaga. "embalagem" (genérico) também é feminino.
          const FEMININOS = new Set(["lata", "caixa", "bandeja", "garrafa", "bisnaga", "embalagem"]);
          const ehFem = FEMININOS.has(tipoEmbBaixo);
          const naNo = ehFem ? "na" : "no";
          const daDo = ehFem ? "da" : "do";
          const umaUm = ehFem ? "uma" : "um";

          // Custo por unidade derivado (pra item contável em embalagem)
          const custoPorUnidade = qtdEmb > 0 ? valorPago / qtdEmb : 0;

          // Detecta se a quantidade usada é fração, exata ou múltipla da embalagem
          // (convertendo ambas para a unidade base do insumo)
          const qtdUsadaBase = toBase(qtdUsada, f.unidade_utilizada);
          const qtdEmbBase = toBase(qtdEmb, ins.unidade);
          const eps = 0.0001;
          const ratioUsoEmbalagem = qtdEmbBase > 0 ? qtdUsadaBase / qtdEmbBase : 1;
          const ehFracao = ratioUsoEmbalagem < 1 - eps;
          const ehExato = Math.abs(ratioUsoEmbalagem - 1) < eps;

          return (
            <DooInfoModal
              open
              onClose={() => setInfoCustoAberto(null)}
              image="/Sistema/precifique.png"
              imageAlt="Precificação"
              ariaLabel={`Como calculamos o custo de ${ins.nome}`}
              title={MODAL_TITLE_VARIANTS[tituloModalIndex](primeiroNome)}
            >
              {qtdUsada <= 0 ? (
                /* Caso 1: quantidade ainda não informada */
                <>
                  {temValorCompra && temEmbalagem ? (
                    <p style={{ margin: "0 0 12px" }}>
                      Você cadastrou em <strong>Insumos</strong> que paga{" "}
                      <strong>R$ {fmt(valorPago)}</strong> {naNo} {tipoEmbBaixo} de{" "}
                      <strong>{fmtQty(qtdEmb)} {fmtUnidade(ins.unidade, qtdEmb)}</strong> de {ins.nome}.
                    </p>
                  ) : temValorCompra ? (
                    <p style={{ margin: "0 0 12px" }}>
                      Você cadastrou em <strong>Insumos</strong> que paga{" "}
                      <strong>R$ {fmt(valorPago)}</strong> por {fmtUnidade(ins.unidade, 1)} de {ins.nome}.
                    </p>
                  ) : (
                    <p style={{ margin: "0 0 12px" }}>
                      Você cadastrou {ins.nome} em <strong>Insumos</strong>.
                    </p>
                  )}
                  <p style={{ margin: "0 0 14px" }}>
                    Assim que você informar <strong>quanto de {ins.nome}</strong> essa receita usa,
                    calculamos automaticamente o custo proporcional.
                  </p>
                  <p style={{ margin: 0, padding: "10px 12px", background: "rgba(61,26,36,0.06)", borderRadius: 10, fontSize: "0.85rem" }}>
                    Esse cálculo compõe o <strong>CMV</strong> (Custo de Mercadoria Vendida) da receita — quanto os ingredientes pesam no custo total do seu produto.
                  </p>
                </>
              ) : isContavel && temEmbalagem && temValorCompra ? (
                /* Caso 2A: item contável vendido em embalagem (ex: ovo em bandeja) */
                <>
                  <p style={{ margin: "0 0 10px" }}>
                    Você paga <strong>R$ {fmt(valorPago)}</strong> {naNo} {tipoEmbBaixo} de{" "}
                    <strong>{fmtQty(qtdEmb)} {fmtUnidade(ins.unidade, qtdEmb)}</strong> de {ins.nome} (cadastrado em <strong>Insumos</strong>).
                  </p>
                  <p style={{ margin: "0 0 10px" }}>
                    Cada {ins.nome} sai por cerca de{" "}
                    <strong>R$ {fmt(custoPorUnidade)}</strong>{" "}
                    (R$ {fmt(valorPago)} ÷ {fmtQty(qtdEmb)}).
                  </p>
                  <p style={{ margin: "0 0 14px" }}>
                    Sua receita usa <strong>{fmtQty(qtdUsada)} {fmtUnidade(f.unidade_utilizada, qtdUsada)}</strong> →{" "}
                    <strong style={{ color: "var(--text-title)" }}>R$ {fmt(custoLinha)}</strong>.
                  </p>
                  <p style={{ margin: 0, padding: "10px 12px", background: "rgba(61,26,36,0.06)", borderRadius: 10, fontSize: "0.85rem" }}>
                    <strong>CMV</strong> (Custo de Mercadoria Vendida) é quanto cada ingrediente pesa no custo total da receita. Quanto menor o CMV, maior seu lucro.
                  </p>
                </>
              ) : isContavel && temValorCompra ? (
                /* Caso 2B: item contável avulso (sem embalagem) */
                <>
                  <p style={{ margin: "0 0 10px" }}>
                    Você paga <strong>R$ {fmt(valorPago)}</strong> por {fmtUnidade(ins.unidade, 1)} de {ins.nome} (cadastrado em <strong>Insumos</strong>).
                  </p>
                  <p style={{ margin: "0 0 10px" }}>
                    Sua receita usa <strong>{fmtQty(qtdUsada)} {fmtUnidade(f.unidade_utilizada, qtdUsada)}</strong>.
                  </p>
                  <p style={{ margin: "0 0 14px" }}>
                    Total:{" "}
                    <strong style={{ color: "var(--text-title)" }}>R$ {fmt(custoLinha)}</strong>{" "}
                    — esse é o custo de {ins.nome} nessa receita.
                  </p>
                  <p style={{ margin: 0, padding: "10px 12px", background: "rgba(61,26,36,0.06)", borderRadius: 10, fontSize: "0.85rem" }}>
                    <strong>CMV</strong> (Custo de Mercadoria Vendida) é quanto cada ingrediente pesa no custo total da receita. Quanto menor o CMV, maior seu lucro.
                  </p>
                </>
              ) : temEmbalagem && temValorCompra ? (
                /* Caso 3: item contínuo (g, kg, ml, L) em embalagem.
                 * Tem 3 sub-cenários conforme a relação entre quantidade usada
                 * e tamanho da embalagem, pra a linguagem fluir natural. */
                <>
                  <p style={{ margin: "0 0 12px" }}>
                    Você pagou <strong>R$ {fmt(valorPago)}</strong> por {umaUm} {tipoEmbBaixo} de{" "}
                    <strong>{fmtQty(qtdEmb)} {fmtUnidade(ins.unidade, qtdEmb)}</strong> de {ins.nome} (cadastrado em <strong>Insumos</strong>).
                  </p>

                  {ehFracao ? (
                    <p style={{ margin: "0 0 12px" }}>
                      Nesta receita, você utiliza apenas{" "}
                      <strong>{fmtQty(qtdUsada)} {fmtUnidade(f.unidade_utilizada, qtdUsada)}</strong> desse ingrediente.
                      Em vez de considerar o valor da embalagem inteira, calculamos apenas o custo da quantidade realmente utilizada.
                    </p>
                  ) : ehExato ? (
                    <p style={{ margin: "0 0 12px" }}>
                      Nesta receita, você utiliza {umaUm} {tipoEmbBaixo} inteir{ehFem ? "a" : "o"} de {ins.nome} — ou seja, exatamente o que vem na embalagem.
                    </p>
                  ) : (
                    <p style={{ margin: "0 0 12px" }}>
                      Nesta receita, você utiliza{" "}
                      <strong>{fmtQty(qtdUsada)} {fmtUnidade(f.unidade_utilizada, qtdUsada)}</strong> de {ins.nome} — mais do que cabe em {umaUm} {tipoEmbBaixo}.
                      Calculamos o custo proporcional ao que sua receita realmente consome.
                    </p>
                  )}

                  <p style={{ margin: "0 0 14px" }}>
                    Assim, o custo desse ingrediente na receita é de{" "}
                    <strong style={{ color: "var(--text-title)" }}>R$ {fmt(custoLinha)}</strong>.
                  </p>

                  <p style={{ margin: 0, padding: "10px 12px", background: "rgba(61,26,36,0.06)", borderRadius: 10, fontSize: "0.85rem" }}>
                    <strong>CMV</strong> (Custo de Mercadoria Vendida) é quanto cada ingrediente pesa no custo total da receita. Quanto menor o CMV, maior seu lucro.
                  </p>
                </>
              ) : (
                /* Caso 4: defensivo. Com `valor_compra` NOT NULL no banco e a
                 * sugestão automática no QuickAddInsumo, esse ramo só deveria
                 * ser alcançado por bug ou dado corrompido. Mensagem honesta
                 * sem fingir que está tudo bem. */
                <>
                  <p style={{ margin: "0 0 10px" }}>
                    Algo está incompleto no cadastro de <strong>{ins.nome}</strong>: o sistema não conseguiu identificar o valor total da compra ou a quantidade da embalagem.
                  </p>
                  <p style={{ margin: "0 0 14px" }}>
                    Mesmo assim, calculamos o custo proporcional pela quantidade usada na receita:{" "}
                    <strong>{fmtQty(qtdUsada)} {fmtUnidade(f.unidade_utilizada, qtdUsada)}</strong> →{" "}
                    <strong style={{ color: "var(--text-title)" }}>R$ {fmt(custoLinha)}</strong>.
                  </p>
                  <p style={{ margin: 0, padding: "10px 12px", background: "rgba(61,26,36,0.06)", borderRadius: 10, fontSize: "0.85rem" }}>
                    <strong>Dica:</strong> abra esse insumo em <strong>Insumos</strong> e refaça o cadastro pra que a explicação aqui fique completa.
                  </p>
                </>
              )}
            </DooInfoModal>
          );
        })()}

        <style>{detailStyles}</style>
      </div>
      </>
    );
  }

  /* LIST VIEW */
  return (
    <>
    <div className="ft-so-desk"><AppPageHeader title="Precificação" subtitle={`Você já precificou ${totalComFicha} de ${produtos.length} produto${produtos.length !== 1 ? "s" : ""}`} /></div>
    <div className="ft-root">
      <div className="ft-list-header">
        <div className="ft-list-header-inner">
          <h1 className="ft-list-title">Precificação Inteligente</h1>
          <p className="ft-list-sub">
            Você já precificou {totalComFicha} de {produtos.length} produto{produtos.length !== 1 ? "s" : ""}. Continue para conhecer os custos e lucros de todo o seu catálogo.
          </p>
        </div>
      </div>

      <div className="ft-list-toolbar">
        <div className="ft-list-busca">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
      </div>

      {produtos.length > 0 && (
        <div className="ft-progress-wrap">
          <div className="ft-progress-bar">
            <div className="ft-progress-fill" style={{ width: `${produtos.length > 0 ? (totalComFicha / produtos.length) * 100 : 0}%` }} />
          </div>
          <span className="ft-progress-label">{totalComFicha}/{produtos.length} precificados</span>
        </div>
      )}

      {filtrados.length === 0 ? (
        <EmptyDoo
          image="produtos.png"
          title="Nenhum produto encontrado"
          description={filtro === "sem" ? "Todos os produtos já foram precificados." : "Cadastre produtos para precificar."}
          actionLabel={filtro !== "todos" ? "Ver todos" : undefined}
          onAction={filtro !== "todos" ? () => { setFiltro("todos"); setBusca(""); } : undefined}
        />
      ) : (
        <div className="ft-list-grid">
          {filtrados.map(p => {
            const { cmv, lucro, margemLucro, temFicha } = calcular(p);
            return (
              <div key={p.id} className="ft-list-card" onClick={() => abrirFicha(p)}>
                <div className="ft-list-card-img">
                  {p.imagem_url
                    ? <img src={p.imagem_url.split(",")[0]} alt={p.nome} />
                    : <span className="ft-list-card-noimg">Sem foto</span>
                  }
                  {temFicha && (
                    <div className={`ft-list-card-badge ft-list-card-badge--${margemLucro >= 50 ? "alto" : margemLucro >= 25 ? "medio" : "baixo"}`}>
                      {fmtPct(margemLucro)}%
                    </div>
                  )}
                </div>
                <div className="ft-list-card-info">
                  <p className="ft-list-card-nome">{p.nome}</p>
                  <p className="ft-list-card-preco">R$ {fmt(p.preco_normal)}</p>
                  {temFicha ? (
                    <div className="ft-list-card-cmv">
                      <span>CMV R$ {fmt(cmv)}</span>
                      <span className="ft-list-card-lucro-val">Lucro R$ {fmt(lucro)}</span>
                    </div>
                  ) : (
                    <span className="ft-list-card-sem">Sem preço técnica</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{listStyles}</style>
    </div>
    </>
  );
}

const listStyles = `
  /* Cabeçalho do app no celular e no computador (30/09) */
  .ft-so-desk { display: block; }
  .ft-back, .ft-list-header { display: none !important; }
  @media (min-width: 901px) {
  }

  @media (min-width: 1100px) {
    .ft-root { max-width: 1180px !important; margin-left: auto; margin-right: auto; }
    .ft-list-grid { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)) !important; gap: 1rem !important; }
  }

  .ft-root {
    font-family: var(--font-base); max-width: 800px;
    display: flex; flex-direction: column;
    gap: var(--space-5);
    padding-top: var(--space-7); padding-bottom: var(--space-7);
  }

  .ft-list-header { display: flex; align-items: center; justify-content: center; text-align: center; }
  .ft-list-header-inner { display: flex; flex-direction: column; align-items: center; gap: 4px; max-width: 560px; }
  .ft-list-title { font-size: var(--font-page-title); font-weight: var(--fw-bold); color: var(--text-title); margin: 0; text-align: center; }
  .ft-list-sub { font-size: var(--font-helper); color: var(--text-muted); margin: 0; text-align: center; line-height: 1.4; }

  .ft-list-toolbar { display: flex; flex-direction: column; gap: 0.5rem; }
  .ft-list-busca {
    display: flex; align-items: center; gap: 8px; padding: 0.55rem 0.75rem;
    background: var(--bg-card); border: 1.5px solid var(--border); border-radius: var(--radius-md);
    color: var(--text-muted);
  }
  .ft-list-busca input {
    flex: 1; border: none; outline: none; background: transparent;
    font-family: var(--font-base); font-size: var(--font-body); color: var(--text-primary);
  }
  .ft-list-filtros { display: flex; gap: 0.3rem; }
  .ft-filtro-btn {
    padding: 0.3rem 0.65rem; border: 1.5px solid var(--border); border-radius: var(--radius-md);
    background: var(--bg-card); font-family: var(--font-base); font-size: var(--font-caption);
    font-weight: var(--fw-medium); color: var(--text-secondary); cursor: pointer;
  }
  .ft-filtro-btn.active {
    border-color: var(--primary); color: var(--primary); background: var(--primary-light); font-weight: var(--fw-bold);
  }

  .ft-progress-wrap { display: flex; align-items: center; gap: 0.6rem; }
  .ft-progress-bar { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
  .ft-progress-fill { height: 100%; background: var(--primary); border-radius: 3px; transition: width 0.4s ease; }
  .ft-progress-label { font-size: var(--font-caption); color: var(--text-muted); white-space: nowrap; }

  .ft-list-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.75rem; }

  .ft-list-card {
    background: var(--bg-card); border-radius: var(--radius-lg); overflow: hidden;
    box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06)); cursor: pointer;
    transition: transform 0.15s ease;
  }
  .ft-list-card:active { transform: scale(0.98); }

  .ft-list-card-img {
    aspect-ratio: 1; background: var(--bg-subtle); display: flex;
    align-items: center; justify-content: center; position: relative; overflow: hidden;
  }
  .ft-list-card-img img { width: 100%; height: 100%; object-fit: cover; }
  .ft-list-card-noimg { font-size: var(--font-caption); color: var(--text-muted); }
  .ft-list-card-badge {
    position: absolute; top: 0.4rem; right: 0.4rem;
    padding: 2px 7px; border-radius: var(--radius-full);
    font-size: var(--font-caption); font-weight: var(--fw-bold); color: white;
  }
  .ft-list-card-badge--alto { background: var(--success); }
  .ft-list-card-badge--medio { background: var(--warning); }
  .ft-list-card-badge--baixo { background: var(--error); }

  .ft-list-card-info { padding: 0.6rem 0.7rem; }
  .ft-list-card-nome {
    font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--text-title);
    margin: 0 0 2px; line-height: 1.3;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .ft-list-card-preco { font-size: var(--font-caption); font-weight: var(--fw-semibold); color: var(--success); margin: 0 0 4px; }
  .ft-list-card-cmv { display: flex; flex-direction: column; gap: 1px; font-size: var(--font-caption); color: var(--text-muted); }
  .ft-list-card-lucro-val { color: var(--success); font-weight: var(--fw-semibold); }
  .ft-list-card-sem { font-size: var(--font-caption); color: var(--text-muted); font-style: italic; }
`;

const detailStyles = `
  /* Cabeçalho do app no celular e no computador (30/09) */
  .ft-so-desk { display: block; }
  .ft-back, .ft-list-header { display: none !important; }
  @media (min-width: 901px) {
  }

  .ft-root {
    font-family: var(--font-base); max-width: 600px;
    display: flex; flex-direction: column;
    gap: var(--space-4);
    padding-top: var(--space-7); padding-bottom: var(--space-7);
    --ft-line: var(--border);
  }

  .ft-back {
    display: inline-flex; align-items: center; gap: 6px; padding: 0;
    background: none; border: none; font-family: var(--font-base);
    font-size: var(--font-body); font-weight: var(--fw-medium);
    color: var(--text-secondary); cursor: pointer;
  }

  .ft-tree {
    display: flex; flex-direction: row; align-items: center; gap: 1rem;
    background: var(--bg-card); border-radius: var(--radius-lg);
    padding: 1rem;
    box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06));
  }
  .ft-tree-foto {
    width: 110px; height: 110px; border-radius: var(--radius-lg); overflow: hidden;
    background: var(--bg-subtle); flex-shrink: 0;
    border: 3px solid var(--bg-card);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16), 0 4px 10px rgba(0, 0, 0, 0.08);
  }
  .ft-tree-foto img { width: 100%; height: 100%; object-fit: cover; }
  .ft-tree-foto-placeholder {
    width: 100%; height: 100%; display: flex; align-items: center;
    justify-content: center; font-size: var(--font-caption); color: var(--text-muted);
    text-align: center;
  }
  .ft-tree-info {
    flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.5rem;
  }
  .ft-tree-nome {
    font-size: var(--font-section-title); font-weight: var(--fw-bold);
    color: var(--text-title); margin: 0; line-height: 1.25;
  }
  .ft-tree-lucro {
    display: flex; flex-direction: column; gap: 1px;
  }
  .ft-tree-sub {
    font-size: var(--font-caption); color: var(--text-muted); margin: 4px 0 0;
  }

  /* Lucro (dentro do cabeçalho) */
  .ft-lucro-hero-label { font-size: var(--font-caption); color: var(--text-muted); text-transform: uppercase; letter-spacing: var(--ls-wide); font-weight: var(--fw-semibold); }
  .ft-lucro-hero-value { font-size: var(--font-stat-value); font-weight: var(--fw-bold); color: var(--success); line-height: 1.15; }
  .ft-lucro-hero-value--neg { color: var(--error); }
  .ft-lucro-hero-margin { font-size: var(--font-button); font-weight: var(--fw-semibold); margin-top: 2px; }
  .ft-lucro-hero-margin--ok { color: var(--success); }
  .ft-lucro-hero-margin--warn { color: var(--warning); }
  .ft-lucro-hero-margin--neg { color: var(--error); }

  /* Pricing breakdown card */
  .ft-pricing-card {
    background: var(--bg-card); border-radius: var(--radius-lg);
    padding: 1rem 1.1rem; display: flex; flex-direction: column; gap: 0.45rem;
    box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06));
  }
  .ft-pricing-row { display: flex; justify-content: space-between; align-items: center; }
  .ft-pricing-label { font-size: var(--font-button); color: var(--text-muted); }
  .ft-pricing-value { font-size: var(--font-button); font-weight: var(--fw-semibold); color: var(--text-title); }
  .ft-pricing-row--total .ft-pricing-label { font-weight: var(--fw-bold); color: var(--text-title); font-size: var(--font-body); }
  .ft-pricing-row--total .ft-pricing-value { font-weight: var(--fw-bold); font-size: var(--font-body); }
  .ft-pricing-divider { height: 1px; background: var(--border); margin: 0.2rem 0; }
  .ft-pricing-spacer { height: 0.35rem; }
  .ft-pricing-value--preco { color: var(--primary); }
  .ft-pricing-value--lucro { color: var(--success); }
  .ft-pricing-value--warn { color: var(--warning); }
  .ft-pricing-value--neg { color: var(--error); }

  /* CV / MO helpers */
  .ft-cv-row { display: flex; align-items: flex-end; gap: 0.75rem; }
  .ft-cv-result {
    padding: 0.45rem 0.7rem; background: var(--primary-light);
    border-radius: var(--radius-md); white-space: nowrap;
  }
  .ft-cv-result-label { font-size: var(--font-caption); font-weight: var(--fw-bold); color: var(--primary); }
  .ft-cv-hint { font-size: var(--font-helper); color: var(--text-muted); font-style: italic; margin: 0; }

  .ft-input-suffix {
    display: flex; align-items: center;
    border: 1.5px solid var(--border); border-radius: var(--radius-md);
    overflow: hidden; background: var(--bg-card);
    transition: border-color var(--dur-fast) var(--ease-out);
  }
  .ft-input-suffix:focus-within { border-color: var(--primary); }
  .ft-input-suffix input {
    flex: 1; min-width: 0; border: none; outline: none; background: transparent;
    padding: var(--pad-input); font-family: var(--font-base);
    font-size: var(--font-input); color: var(--text-primary);
  }
  .ft-input-suffix input::-webkit-outer-spin-button,
  .ft-input-suffix input::-webkit-inner-spin-button { -webkit-appearance: none; }
  .ft-input-suffix input[type=number] { -moz-appearance: textfield; }
  .ft-input-suffix span {
    padding: 0.75rem 0.85rem; font-size: var(--font-button); font-weight: var(--fw-semibold);
    color: var(--text-muted);
  }

  .ft-input-prefix {
    display: flex; align-items: center;
    border: 1.5px solid var(--border); border-radius: var(--radius-md);
    overflow: hidden; background: var(--bg-card);
    transition: border-color var(--dur-fast) var(--ease-out);
  }
  .ft-input-prefix:focus-within { border-color: var(--primary); }
  .ft-input-prefix span {
    padding: 0.75rem 0 0.75rem 0.85rem; font-size: var(--font-button); font-weight: var(--fw-semibold);
    color: var(--text-muted);
  }
  .ft-input-prefix input {
    flex: 1; min-width: 0; border: none; outline: none; background: transparent;
    padding: var(--pad-input); padding-left: var(--space-2); font-family: var(--font-base);
    font-size: var(--font-input); color: var(--text-primary);
  }

  .ft-mo-result {
    padding: var(--pad-input); background: var(--primary-dark);
    border: none; border-radius: var(--radius-md);
    font-size: var(--font-input); font-weight: var(--fw-bold); color: var(--text-inverse);
  }

  /* Cabeçalho dentro do card */
  .ft-card-head {
    display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
  }
  .ft-card-title {
    font-size: var(--font-section-label); font-weight: var(--fw-bold);
    color: var(--text-title); margin: 0;
    text-transform: uppercase; letter-spacing: var(--ls-wide);
  }
  .ft-card-off-hint {
    font-size: var(--font-caption); color: var(--text-muted); margin: 0; line-height: 1.4;
  }

  /* Switch (ativar seção) */
  .ft-switch { display: inline-flex; align-items: center; cursor: pointer; flex-shrink: 0; }
  .ft-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
  .ft-switch-track {
    position: relative; width: 40px; height: 22px;
    background: var(--border); border-radius: var(--radius-full);
    transition: background var(--dur-fast, 0.15s) var(--ease-out, ease);
  }
  .ft-switch-thumb {
    position: absolute; top: 2px; left: 2px;
    width: 18px; height: 18px; background: var(--bg-card);
    border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    transition: transform var(--dur-fast, 0.15s) var(--ease-out, ease);
  }
  .ft-switch input:checked + .ft-switch-track { background: var(--primary); }
  .ft-switch input:checked + .ft-switch-track .ft-switch-thumb { transform: translateX(18px); }
  /* Toggle de visualização (grid / lista) */
  .ft-view-toggle {
    display: flex; gap: 2px; padding: 2px;
    background: var(--bg-subtle); border-radius: var(--radius-md);
  }
  .ft-view-btn {
    display: flex; align-items: center; justify-content: center;
    width: 30px; height: 28px; border: none; background: transparent;
    border-radius: var(--radius-sm); color: var(--text-muted); cursor: pointer;
    transition: background var(--dur-fast, 0.15s) var(--ease-out, ease), color var(--dur-fast, 0.15s) var(--ease-out, ease);
  }
  .ft-view-btn.active {
    background: var(--bg-card); color: var(--primary);
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }

  /* Modo lista (somente leitura, estilo receita/planilha) */
  .ft-list-mode {
    display: flex; flex-direction: column;
    border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden;
  }
  .ft-list-row {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.6rem 0.7rem; border-bottom: 1px solid var(--border);
  }
  .ft-list-row:nth-child(even) { background: var(--bg-subtle); }
  .ft-list-row:last-child { border-bottom: none; }
  .ft-list-row-nome {
    flex: 1; min-width: 0; font-size: var(--font-body); font-weight: var(--fw-semibold);
    color: var(--text-title); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .ft-list-row-qtd {
    flex-shrink: 0; font-size: var(--font-caption); font-weight: var(--fw-semibold);
    color: var(--text-secondary); white-space: nowrap; text-align: right; min-width: 64px;
  }
  .ft-list-row-custo {
    flex-shrink: 0; font-size: var(--font-body); font-weight: var(--fw-bold);
    color: var(--text-title); white-space: nowrap; text-align: right; min-width: 72px;
  }

  .ft-edit-card {
    background: var(--bg-card); border-radius: var(--radius-lg);
    padding: var(--pad-card); box-shadow: var(--shadow-card);
    display: flex; flex-direction: column; gap: var(--gap-stack);
  }
  .ft-edit-empty { text-align: center; padding: 1rem 0.5rem; }
  .ft-edit-empty-title { font-size: var(--font-body); font-weight: var(--fw-bold); color: var(--text-title); margin: 0 0 2px; }
  .ft-edit-empty-sub { font-size: var(--font-caption); color: var(--text-muted); margin: 0; line-height: 1.4; }

  .ft-edit-list { display: flex; flex-direction: column; gap: 0.6rem; }
  .ft-edit-item {
    position: relative;
    display: flex; flex-direction: row; align-items: center; gap: var(--space-3);
    padding: var(--pad-card);
    padding-left: 0;
    background: #F4F4F5; border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .ft-edit-item-media {
    flex-shrink: 0;
  }
  .ft-edit-item-img {
    width: 76px; height: 76px;
    object-fit: cover;
    background: transparent;
    mix-blend-mode: multiply;
    display: block;
  }
  .ft-edit-item-img--ph {
    display: flex; align-items: center; justify-content: center;
    background: var(--primary-light); color: var(--primary);
    font-weight: var(--fw-bold); font-size: var(--text-3xl);
    mix-blend-mode: normal;
  }
  .ft-edit-item-del {
    position: absolute;
    top: var(--space-2); right: var(--space-2);
    width: 28px; height: 28px;
    display: inline-flex; align-items: center; justify-content: center;
    background: transparent;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    cursor: pointer;
    transition: all var(--dur-fast) var(--ease-out);
  }
  .ft-edit-item-del:hover {
    border-color: var(--error); color: var(--error); background: var(--bg-card);
  }

  .ft-edit-item-body {
    flex: 1; min-width: 0; display: flex; flex-direction: column;
    gap: 2px;
    padding-right: calc(28px + var(--space-2));
  }
  .ft-edit-item-nome {
    font-size: var(--font-body); font-weight: var(--fw-bold); color: var(--text-title);
    margin: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .ft-edit-item-sub {
    font-size: var(--font-body); color: var(--text-title); margin: 0;
    font-weight: var(--fw-semibold);
    line-height: 1.4;
  }
  .ft-edit-item-sub-label { color: var(--text-secondary); font-weight: var(--fw-medium); }
  .ft-edit-item-sub-value { white-space: nowrap; font-weight: var(--fw-bold); color: var(--text-title); }

  .ft-edit-item-info {
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px;
    margin-left: 4px;
    padding: 0; background: transparent; border: none;
    color: var(--primary-dark); cursor: pointer; vertical-align: -3px;
    transition: color var(--dur-fast) var(--ease-out);
  }
  .ft-edit-item-info:hover { color: var(--primary); }

  .ft-edit-item-info-pop {
    display: flex; flex-direction: column; gap: 2px;
    margin-top: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-md);
  }
  .ft-edit-item-info-pop-title {
    font-size: var(--font-caption); font-weight: var(--fw-bold);
    color: var(--text-title); margin-bottom: 2px;
  }
  .ft-edit-item-info-pop-line {
    font-size: var(--font-caption); color: var(--text-muted);
    font-weight: var(--fw-medium);
  }
  .ft-edit-item-info-pop-result {
    font-size: var(--font-caption); font-weight: var(--fw-bold);
    color: var(--primary); margin-top: 4px;
    padding-top: 4px; border-top: 1px solid var(--border);
  }

  .ft-edit-item-row { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-2); }
  .ft-edit-item-input-group {
    flex: 1; width: 100%; display: flex; align-items: stretch;
    border: 1.5px solid var(--border); border-radius: var(--radius-md);
    overflow: hidden; background: var(--bg-card);
    transition: border-color 0.15s ease;
  }
  .ft-edit-item-input-group:focus-within { border-color: var(--primary-dark); }
  .ft-edit-item-input-group input {
    flex: 1; min-width: 0; border: none; outline: none; background: transparent;
    padding: 0.5rem 0.6rem; font-family: var(--font-base);
    font-size: var(--font-body); font-weight: var(--fw-semibold);
    color: var(--text-primary); text-align: left;
  }
  .ft-edit-item-input-group input::-webkit-outer-spin-button,
  .ft-edit-item-input-group input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .ft-edit-item-input-group input[type=number] { -moz-appearance: textfield; }
  .ft-edit-item-input-group select {
    border: none; outline: none;
    padding: 0 0.7rem; font-family: var(--font-base);
    font-size: var(--font-caption); font-weight: var(--fw-semibold);
    color: var(--text-secondary); background: var(--bg-subtle, #EAEAEC);
    border-left: 1px solid var(--border);
    cursor: pointer; -webkit-appearance: none; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 8px center;
    padding-right: 1.6rem;
  }
  .ft-edit-item-unit-fixed {
    padding: 0 0.7rem; font-size: var(--font-caption); font-weight: var(--fw-semibold);
    color: var(--text-secondary); background: var(--bg-subtle, #EAEAEC);
    border-left: 1px solid var(--border);
    white-space: nowrap; display: flex; align-items: center;
  }
  .ft-edit-item-custo { display: flex; align-items: center; gap: 4px; flex-shrink: 0; min-width: 90px; justify-content: flex-end; }
  .ft-edit-item-custo-eq { font-size: var(--font-caption); color: var(--text-muted); }
  .ft-edit-item-custo-val { font-size: var(--font-body); font-weight: var(--fw-bold); color: var(--text-title); white-space: nowrap; text-align: right; }

  .ft-add-novo {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 0.85rem 0.75rem; background: var(--primary); border: none;
    border-radius: var(--radius-md); color: var(--text-inverse); font-family: var(--font-base);
    font-size: var(--font-body); font-weight: var(--fw-bold); cursor: pointer; text-align: center;
    box-shadow: 0 2px 8px rgba(var(--primary-rgb, 61, 26, 36), 0.25);
    transition: filter var(--dur-fast, 0.15s) var(--ease-out, ease);
  }
  .ft-add-novo:hover { filter: brightness(1.08); }
  .ft-add-novo svg { stroke: var(--text-inverse); flex-shrink: 0; }
  .ft-add-novo--solo { background: var(--primary); }

  /* Linha de ações: adicionar existente + cadastrar novo */
  .ft-add-actions { display: flex; flex-direction: column; gap: 0.5rem; }
  .ft-add-existente {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 0.85rem 0.75rem; background: var(--bg-card); border: 1.5px solid var(--primary);
    border-radius: var(--radius-md); color: var(--primary); font-family: var(--font-base);
    font-size: var(--font-body); font-weight: var(--fw-bold); cursor: pointer; text-align: center;
    transition: background var(--dur-fast, 0.15s) var(--ease-out, ease);
  }
  .ft-add-existente:hover { background: var(--primary-light); }
  .ft-add-existente svg { stroke: var(--primary); flex-shrink: 0; }

  /* Modal picker de insumos */
  .ft-picker {
    background: var(--bg-card); border-radius: var(--radius-lg);
    width: 100%; max-width: 560px; max-height: 85vh;
    display: flex; flex-direction: column;
    box-shadow: 0 12px 48px rgba(0,0,0,0.3);
  }
  .ft-picker-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 1.1rem 0.75rem; flex-shrink: 0;
  }
  .ft-picker-title {
    font-size: var(--font-section-title); font-weight: var(--fw-bold); color: var(--text-title); margin: 0;
  }
  .ft-picker-close {
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; flex-shrink: 0;
    background: var(--bg-subtle); border: none; border-radius: var(--radius-full);
    cursor: pointer; color: var(--text-muted);
  }
  .ft-picker-close:hover { background: var(--border); color: var(--text-secondary); }
  .ft-picker-busca {
    display: flex; align-items: center; gap: 8px; margin: 0 1.1rem 0.75rem;
    padding: 0.55rem 0.75rem; background: var(--bg-subtle); border: 1.5px solid var(--border);
    border-radius: var(--radius-md); color: var(--text-muted); flex-shrink: 0;
  }
  .ft-picker-busca input {
    flex: 1; border: none; outline: none; background: transparent;
    font-family: var(--font-base); font-size: var(--font-body); color: var(--text-primary);
  }
  .ft-picker-grid {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.6rem;
    align-content: start;
    padding: 0 1.1rem 1rem; overflow-y: auto; flex: 1;
  }
  .ft-picker-card {
    display: flex; flex-direction: column; gap: 5px; padding: 0;
    background: transparent; border: none; cursor: pointer;
  }
  .ft-picker-card-img {
    position: relative; aspect-ratio: 1; width: 100%;
    border-radius: var(--radius-md); overflow: hidden;
    background: var(--bg-subtle);
    border: 2px solid var(--border);
    transition: border-color var(--dur-fast, 0.15s) var(--ease-out, ease);
  }
  .ft-picker-card.selected .ft-picker-card-img {
    border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-light);
  }
  .ft-picker-card-img img { width: 100%; height: 100%; object-fit: cover; }
  .ft-picker-card-ph {
    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    background: var(--primary-light); color: var(--primary); font-weight: var(--fw-bold); font-size: var(--font-section-title);
  }
  .ft-picker-check {
    position: absolute; top: 5px; right: 5px;
    width: 24px; height: 24px; background: var(--primary);
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  }
  .ft-picker-card-nome {
    font-size: var(--font-caption); font-weight: var(--fw-semibold); color: var(--text-title);
    text-align: center; line-height: 1.25;
    overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
    -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }
  .ft-picker-vazio {
    grid-column: 1 / -1; text-align: center; padding: 2rem 1rem;
    font-size: var(--font-caption); color: var(--text-muted);
  }
  .ft-picker-confirm {
    margin: 0 1.1rem 1.1rem; padding: 0.85rem; flex-shrink: 0;
    background: var(--primary); color: var(--text-inverse); border: none;
    border-radius: var(--radius-md); font-family: var(--font-base);
    font-size: var(--font-button); font-weight: var(--fw-bold); cursor: pointer;
  }
  .ft-picker-confirm:disabled { opacity: 0.5; cursor: default; }

  .ft-extras-edit {
    background: var(--bg-card); border-radius: var(--radius-md); padding: 0.85rem;
    box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06));
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.65rem;
  }
  .ft-field { display: flex; flex-direction: column; gap: var(--space-1); grid-column: 1 / -1; min-width: 0; justify-content: flex-end; }
  .ft-field--half { grid-column: span 1; }
  .ft-field label { font-size: var(--font-field-label); color: var(--text-secondary); font-weight: var(--fw-semibold); }

  /* ═══ Ficha técnica no computador (aprovado 30/09) — celular intocado ═══ */
  .ft-desk-grid, .ft-desk-main, .ft-desk-par { display: contents; }
  .ft-desk-side, .ft-desk-tabela, .ft-desk-vazio { display: none; }
  @media (min-width: 1100px) {
    .ft-root { max-width: 1180px !important; margin-left: auto; margin-right: auto; }
    .ft-list-grid { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 1rem; }
    .ft-desk-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
    .ft-desk-main { display: block; min-width: 0; }
    .ft-desk-par { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
    .ft-desk-par > .ft-edit-card { margin-top: 0; margin-bottom: 0; }
    .ft-desk-par { margin: 16px 0; }
    .ft-desk-main > .ft-edit-card { margin-top: 0; margin-bottom: 0; }
    .ft-add-actions { flex-direction: row !important; }
    .ft-add-actions > button { flex: 1; }
    .ft-so-cel, .ft-view-toggle, .ft-edit-list, .ft-list-mode, .ft-edit-empty, .ft-add-actions--vazio { display: none !important; }
    .ft-info-card, .ft-info-card * { font-family: var(--font-base) !important; }
    .ft-info-card .ft-extras-edit { display: grid !important; grid-template-columns: repeat(3, 1fr); gap: 10px 14px; }
    .ft-info-card .ft-extras-edit .ft-field { width: auto !important; min-width: 0; }
    .ft-info-card .ft-extras-edit .ft-field:not(.ft-field--half) { grid-column: 1 / -1; }

    .ft-desk-tabela { display: block; overflow-x: auto; }
    .ft-desk-tabela table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .ft-desk-tabela th { text-align: left; font-size: 10.5px; font-weight: 700; color: #888780; letter-spacing: .04em; text-transform: uppercase; padding: 8px 10px; background: #FAF7F8; white-space: nowrap; }
    .ft-desk-tabela th.num, .ft-desk-tabela td.num { text-align: right; white-space: nowrap; }
    .ft-desk-tabela td { padding: 8px 10px; border-bottom: 1px solid #F5F0F2; vertical-align: middle; }
    .ft-dt-ins { display: flex; align-items: center; gap: 10px; }
    .ft-dt-ins b { font-size: 13.5px; color: var(--text-title); }
    .ft-dt-img { width: 32px; height: 32px; border-radius: 7px; object-fit: cover; flex-shrink: 0; }
    .ft-dt-img--ph { display: flex; align-items: center; justify-content: center; background: #FCE7F3; color: #C33A6E; font-weight: 800; font-size: 13px; }
    .ft-dt-qtd { display: inline-flex; align-items: stretch; border: 1px solid #EAE3E6; border-radius: 8px; overflow: hidden; background: #fff; }
    .ft-dt-qtd:focus-within { border-color: #2C1219; }
    .ft-dt-qtd input { width: 84px; border: none; outline: none; padding: 7px 10px; font-family: inherit; font-size: 13.5px; font-weight: 700; color: var(--text-title); background: none; }
    .ft-dt-qtd select, .ft-dt-un { border: none; outline: none; background: #F5F0F2; padding: 0 8px; font-family: inherit; font-size: 12px; color: #6B5D64; display: flex; align-items: center; }
    .ft-dt-info { display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; margin-left: 6px; border-radius: 50%; border: 1.5px solid #C33A6E; background: none; color: #C33A6E; font-family: inherit; font-size: 10px; font-weight: 800; cursor: pointer; vertical-align: 1px; padding: 0; }
    .ft-dt-info.on { background: #C33A6E; color: #fff; }
    .ft-dt-x { width: 34px; text-align: center; }
    .ft-dt-x button { border: none; background: none; color: #C4B8BE; cursor: pointer; padding: 4px; }
    .ft-dt-x button:hover { color: #DC2626; }

    .ft-desk-vazio { display: block; text-align: center; padding: 26px 16px; }
    .ft-desk-vazio-ic { width: 64px; height: 64px; border-radius: 16px; background: #FCE7F3; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; font-size: 30px; }
    .ft-desk-vazio b { display: block; font-size: 17px; font-weight: 800; color: var(--text-title); }
    .ft-desk-vazio p { font-size: 13px; color: #6B5D64; line-height: 1.5; max-width: 440px; margin: 6px auto 16px; }
    .ft-desk-vazio-acoes { display: flex; gap: 8px; justify-content: center; }
    .ft-desk-vazio-bt { height: 42px; padding: 0 18px; border: none; border-radius: 10px; background: #2C1219; color: #fff; font-family: inherit; font-size: 13.5px; font-weight: 800; cursor: pointer; }
    .ft-desk-vazio-bt--claro { background: #F5F0F2; color: #2C1219; }
    .ft-desk-passos { display: flex; gap: 10px; justify-content: center; margin-top: 18px; }
    .ft-desk-passos div { width: 160px; background: #FAF7F8; border-radius: 10px; padding: 10px; font-size: 11.5px; color: #4B3A42; line-height: 1.4; text-align: left; }
    .ft-desk-passos b { font-size: 12px; margin-bottom: 2px; }

    .ft-desk-side { display: block; position: sticky; top: 20px; }
    .ft-sum { background: var(--bg-card); border: 1px solid #F0EBED; border-radius: 14px; overflow: hidden; }
    .ft-sum-top { display: flex; gap: 12px; align-items: center; padding: 14px; border-bottom: 1px solid #F3ECEE; }
    .ft-sum-foto { width: 84px !important; height: 84px !important; border: none !important; }
    .ft-sum-top b { display: block; font-size: 15px; color: var(--text-title); }
    .ft-sum-top span { font-size: 12px; color: #888780; }
    .ft-sum-lucro { padding: 14px; background: #F0FDF4; color: #15803D; }
    .ft-sum-lucro.neg { background: #FEF2F2; color: #B91C1C; }
    .ft-sum-lucro small { font-size: 10.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
    .ft-sum-lucro b { display: block; font-size: 28px; font-weight: 800; line-height: 1.15; }
    .ft-sum-lucro > span { font-size: 12.5px; font-weight: 700; }
    .ft-sum-barra { height: 8px; border-radius: 4px; background: #E5DDE0; margin: 10px 0 5px; display: flex; overflow: hidden; }
    .ft-sum-barra i { display: block; height: 100%; }
    .ft-sum-leg { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 10.5px; color: #6B5D64; }
    .ft-sum-leg span::before { content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; background: var(--c); }
    .ft-sum-linhas { padding: 12px 14px; }
    .ft-sum-linhas > div { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; padding: 5px 0; color: #4B3A42; }
    .ft-sum-linhas > div.t { border-top: 1px solid #F0EBED; margin-top: 4px; padding-top: 9px; font-weight: 800; color: var(--text-title); }
    .ft-sum-linhas > div.pv { font-weight: 800; color: #C33A6E; }
    .ft-sum-salvar { display: block; width: calc(100% - 28px); margin: 0 14px 14px; height: 46px; border: none; border-radius: 12px; background: var(--primary); color: #fff; font-family: inherit; font-size: 14.5px; font-weight: 800; cursor: pointer; }
    .ft-sum-salvar:disabled { opacity: .6; cursor: default; }
  }
  .ft-field input, .ft-field select, .ft-field textarea {
    width: 100%; box-sizing: border-box; min-width: 0; max-width: 100%;
    padding: var(--pad-input); border: 1.5px solid var(--border); border-radius: var(--radius-md);
    font-family: var(--font-base); font-size: var(--font-input); background: var(--bg-card);
    color: var(--text-primary); outline: none; resize: none;
  }
  .ft-field input:focus, .ft-field select:focus, .ft-field textarea:focus { border-color: var(--primary); }
  .ft-field .ft-input-suffix input,
  .ft-field .ft-input-prefix input {
    border: none; border-radius: 0; padding: var(--pad-input);
    width: auto;
  }

  .ft-disclaimer { font-size: var(--font-helper); color: var(--text-muted); text-align: center; margin: 0; font-style: italic; }

  .ft-btn-salvar {
    width: 100%; padding: 0.8rem; background: var(--primary);
    color: var(--text-inverse); border: none; border-radius: var(--radius-md);
    font-family: var(--font-base); font-size: var(--font-button);
    font-weight: var(--fw-bold); cursor: pointer;
  }
  .ft-btn-salvar:disabled { opacity: 0.6; cursor: default; }

  .ft-modal-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: var(--bg-overlay); display: flex;
    align-items: center; justify-content: center;
    padding: var(--pad-page);
    animation: ftFadeIn var(--dur-slow) var(--ease-out);
  }
  .ft-modal-card {
    background: var(--bg-card); border-radius: var(--radius-lg);
    padding: var(--pad-modal); width: 100%; max-width: 420px;
    max-height: 85vh; overflow-y: auto;
    box-shadow: var(--shadow-lg);
    animation: ftSlideUp var(--dur-slow) var(--ease-out);
  }
  @keyframes ftFadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ftSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

  .ft-toast {
    position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);
    background: var(--success); color: white; padding: 0.6rem 1.2rem;
    border-radius: var(--radius-full); font-size: var(--font-caption); font-weight: var(--fw-bold);
    box-shadow: 0 4px 16px rgba(0,0,0,0.2); z-index: 999;
  }

  body.modal-open .bottom-nav { display: none !important; }
`;

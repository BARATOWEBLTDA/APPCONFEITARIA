import { useState, useEffect, useMemo, ReactNode } from "react";
import CampoNumero from "@/components/ui/CampoNumero";
import { parseNumBR } from "@/lib/numeroBR";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";
import QuickAddInsumo, { InsumoQuick } from "@/components/QuickAddInsumo";
import DooInfoModal from "@/components/DooInfoModal";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, BotaoIcone, Campo, CampoArea, Janela, TelaVazia, Titulo, avisar } from "@/components/base";
import { Camera, CaretRight, Check, Egg, Info, MagnifyingGlass, Plus, Receipt, TrendDown, X } from "@phosphor-icons/react";
import "./clientes.css";
import "./fichaLista.css";
import "./fichaDetalhe.css";

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
  (n) => <><strong style={{ fontWeight: 700 }}>{n}</strong>, veja como calculamos este custo.</>,
  (n) => <><strong style={{ fontWeight: 700 }}>{n}</strong>, confira como chegamos a este valor.</>,
  (n) => <><strong style={{ fontWeight: 700 }}>{n}</strong>, entenda como este custo foi calculado.</>,
  (n) => <><strong style={{ fontWeight: 700 }}>{n}</strong>, vamos mostrar como esse valor foi obtido.</>,
  (n) => <><strong style={{ fontWeight: 700 }}>{n}</strong>, veja o passo a passo deste cálculo.</>,
  (n) => <><strong style={{ fontWeight: 700 }}>{n}</strong>, descubra como calculamos este ingrediente.</>,
  (n) => <><strong style={{ fontWeight: 700 }}>{n}</strong>, este é o cálculo por trás deste custo.</>,
  (n) => <><strong style={{ fontWeight: 700 }}>{n}</strong>, entenda de onde vem este valor.</>,
  // Descontraídas
  (n) => <><strong style={{ fontWeight: 700 }}>{n}</strong>, sem mistério! Veja como fizemos esse cálculo.</>,
  (n) => <><strong style={{ fontWeight: 700 }}>{n}</strong>, vamos abrir a calculadora e mostrar tudo.</>,
  (n) => <><strong style={{ fontWeight: 700 }}>{n}</strong>, aqui está a conta por trás deste custo.</>,
  (n) => <><strong style={{ fontWeight: 700 }}>{n}</strong>, veja cada etapa do cálculo.</>,
];

/**
 * Custo e lucro de um produto (lista).
 * Usa a MESMA conta da tela da ficha: ingredientes + custos invisíveis + mão de obra.
 * (Antes a lista só tirava os ingredientes e mostrava um lucro maior que o real.)
 */
/** Mão de obra salva na conta (Custos → Mão de obra): vale pra todos os produtos (09/10) */
type MaoConta = { salario: number; horasSemana: number; diasSemana: number } | null;

function calcular(p: Produto, conta: MaoConta = null, cvConta: number | null = null) {
  const itens = p.produto_insumos || [];
  const cmv = itens.reduce((s, pi) => {
    const qtd = Number(pi.quantidade) || 0;
    const unidadeUtilizada = pi.unidade_utilizada || pi.insumos?.unidade || "";
    return s + calcCusto(qtd, unidadeUtilizada, pi.insumos as Insumo);
  }, 0);
  // Custos invisíveis: % sobre os ingredientes (25% quando nunca foi mudado, igual à tela da ficha)
  const cvPct = cvConta != null ? cvConta : (p.cv_percentual != null ? parseNumBR(p.cv_percentual) : 25);
  const cv = cmv * (cvPct / 100);
  // Mão de obra: liga quando a ficha tem salário ou tempo salvos (igual à tela da ficha)
  const moAtivo = !!(p.salario_desejado || p.tempo_preparo_min);
  const salario = conta ? conta.salario : (parseNumBR(p.salario_desejado) || 0);
  const horasSem = conta ? conta.horasSemana : (parseNumBR(p.horas_semanais) || 40);
  const tempoMin = parseInt(String(p.tempo_preparo_min || 0)) || 0;
  const custoHora = horasSem > 0 ? salario / (horasSem * 4.33) : 0;
  const mo = moAtivo ? custoHora * (tempoMin / 60) : 0;
  const custoTotal = cmv + cv + mo;
  const preco = (p.promocao && p.preco_promocional && p.preco_promocional > 0) ? Number(p.preco_promocional) : Number(p.preco_normal) || 0;
  const lucro = preco - custoTotal;
  const margemCmv = preco > 0 ? (cmv / preco) * 100 : 0;
  const margemLucro = preco > 0 ? (lucro / preco) * 100 : 0;
  return { cmv, custoTotal, lucro, preco, margemCmv, margemLucro, temFicha: itens.length > 0 };
}

export default function FichaTecnica() {
  const { profile } = useProfile();
  const primeiroNome = (profile?.nome || "").split(" ")[0] || "Confeiteira";
  const location = useLocation();
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Produto | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "com" | "sem" | "prejuizo">("todos");

  // Edicao da ficha
  const [insumosCadastrados, setInsumosCadastrados] = useState<Insumo[]>([]);
  const [ficha, setFicha] = useState<FichaItem[]>([]);
  const [buscaInsumo, setBuscaInsumo] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
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

  const [maoConta, setMaoConta] = useState<MaoConta>(null);
  const [editarMao, setEditarMao] = useState(false);
  const [salvandoMao, setSalvandoMao] = useState(false);
  const [cvConta, setCvConta] = useState<number | null>(null);
  const [editarCv, setEditarCv] = useState(false);
  const [salvandoCv, setSalvandoCv] = useState(false);
  // Custos invisíveis salvos na conta (09/10): coluna nova, lida à parte pra não quebrar se o SQL ainda não rodou
  const loadCvConta = async (uid: string) => {
    const { data, error } = await supabase.from("profiles").select("custos_invisiveis_pct").eq("id", uid).maybeSingle();
    const v = (data as any)?.custos_invisiveis_pct;
    setCvConta(!error && v != null ? Number(v) : null);
  };
  const salvarCvConta = async () => {
    if (!userId) return;
    const v = parseNumBR(extras.cv_percentual);
    if (!(v >= 0)) return;
    setSalvandoCv(true);
    const { error } = await supabase.from("profiles").update({ custos_invisiveis_pct: v }).eq("id", userId);
    setSalvandoCv(false);
    if (error) { avisar("Não deu pra salvar agora. Tente de novo.", { tipo: "erro" }); console.error(error); return; }
    setCvConta(v); setEditarCv(false);
    avisar("Salvo na sua conta: vale pra todos os produtos", { tipo: "ok" });
  };
  const loadMaoConta = async (uid: string) => {
    const { data } = await supabase.from("config_mao_obra").select("salario_mensal, horas_dia, dias_semana").eq("user_id", uid).maybeSingle();
    const sal = Number((data as any)?.salario_mensal) || 0;
    if (data && sal > 0) {
      const dias = Number((data as any).dias_semana) || 5;
      setMaoConta({ salario: sal, horasSemana: (Number((data as any).horas_dia) || 8) * dias, diasSemana: dias });
    } else setMaoConta(null);
  };
  /** Salva salário e horas na conta: passa a valer em todos os produtos */
  const salvarMaoConta = async () => {
    if (!userId) return;
    const sal = parseNumBR(extras.salario_desejado) || 0;
    const hs = parseNumBR(extras.horas_semanais) || 40;
    if (sal <= 0) { avisar("Coloque quanto você quer ganhar por mês", { tipo: "erro" }); return; }
    const dias = maoConta?.diasSemana || 5;
    setSalvandoMao(true);
    const { error } = await supabase.from("config_mao_obra").upsert({ user_id: userId, salario_mensal: sal, horas_dia: Math.round((hs / dias) * 100) / 100, dias_semana: dias, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setSalvandoMao(false);
    if (error) { avisar("Não deu pra salvar agora. Tente de novo.", { tipo: "erro" }); return; }
    setMaoConta({ salario: sal, horasSemana: hs, diasSemana: dias });
    setEditarMao(false); setEditarCv(false);
    avisar("Salvo na sua conta: vale pra todos os produtos", { tipo: "ok" });
  };
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
      await Promise.all([loadProdutos(user.id), loadInsumos(user.id), loadMaoConta(user.id), loadCvConta(user.id)]);
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
      cv_percentual: cvConta != null ? String(cvConta) : (p.cv_percentual != null ? String(p.cv_percentual) : "25"),
      tempo_preparo_min: p.tempo_preparo_min ? String(p.tempo_preparo_min) : "",
      salario_desejado: maoConta ? String(maoConta.salario) : (p.salario_desejado ? String(p.salario_desejado) : ""),
      horas_semanais: maoConta ? String(maoConta.horasSemana) : (p.horas_semanais ? String(p.horas_semanais) : "40"),
    });
    setEditarMao(false);
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
        avisar("Não deu pra salvar os ingredientes. Confira a internet e tente de novo.", { tipo: "erro" });
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
    avisar("Ficha técnica salva", { tipo: "ok" });
  };

  const filtrados = produtos.filter(p => {
    if (busca.trim() && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    if (filtro === "com") return (p.produto_insumos || []).length > 0;
    if (filtro === "sem") return (p.produto_insumos || []).length === 0;
    if (filtro === "prejuizo") { const c = calcular(p, maoConta, cvConta); return c.temFicha && c.lucro < 0; }
    return true;
  });
  const totalComFicha = produtos.filter(p => (p.produto_insumos || []).length > 0).length;

  if (loading) return <><AppPageHeader title="Ficha técnica" subtitle="O custo e o lucro de cada produto" /><div className="cl9"><div className="cl9-esq" aria-label="Carregando">{[0, 1, 2, 3].map(k => <span key={k} />)}</div></div></>;

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

    const foto = (selected.imagem_url || "").split(",")[0];
        const tom = margemLucroLive >= 30 ? "ok" : margemLucroLive >= 0 ? "atencao" : "neg";
    const rendeUn = parseNumBR(extras.rendimento_qtd) || 0;
    const disponiveis = insumosCadastrados.filter(i => !ficha.some(f => f.insumo_id === i.id));
    const pickerLista = disponiveis.filter(i => i.nome.toLowerCase().includes(pickerBusca.trim().toLowerCase()));
    const abrirCadastro = () => { setQuickAddName(""); setShowQuickAdd(true); };

    // Conta do lucro (a mesma no resumo do celular e na coluna do computador)
    const Conta = () => (
      <div className="fd-conta">
        <div><span>Ingredientes</span><span>R$ {fmt(cmvLive)}</span></div>
        <div><span>Custos invisíveis ({fmtPct(cvPct)}%)</span><span>R$ {fmt(cvLive)}</span></div>
        <div><span>Mão de obra{tempoMin > 0 && moAtivo ? ` (${tempoMin} min)` : ""}</span><span>R$ {fmt(moLive)}</span></div>
        <div className="fd-t"><span>Custo total</span><span>R$ {fmt(custoTotalLive)}</span></div>
        <div className="fd-pv"><span>Preço de venda</span><span>R$ {fmt(precoLive)}</span></div>
        {infoAtivo && rendeUn > 0 && <div><span>Custo de cada unidade (rende {extras.rendimento_qtd})</span><span>R$ {fmt(custoTotalLive / rendeUn)}</span></div>}
      </div>
    );
    const Barra = () => precoLive > 0 ? (() => {
      const pc = (v: number) => `${Math.max(0, Math.min(100, (v / precoLive) * 100))}%`;
      return (
        <>
          <div className="fd-barra" aria-hidden="true">
            <i style={{ width: pc(cmvLive), background: "var(--ui-rosa)" }} />
            <i style={{ width: pc(cvLive), background: "#F59E0B" }} />
            {moLive > 0 && <i style={{ width: pc(moLive), background: "var(--ui-vinho)" }} />}
            <i style={{ width: pc(Math.max(0, lucroLive)), background: "var(--ui-verde)" }} />
          </div>
          <div className="fd-leg">
            <span style={{ ["--c" as any]: "var(--ui-rosa)" }}>Ingredientes</span>
            <span style={{ ["--c" as any]: "#F59E0B" }}>Invisíveis</span>
            {moLive > 0 && <span style={{ ["--c" as any]: "var(--ui-vinho)" }}>Mão de obra</span>}
            <span style={{ ["--c" as any]: "var(--ui-verde)" }}>Lucro</span>
          </div>
        </>
      );
    })() : null;
    const Chave = ({ ligado, aoMudar, rotulo }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string }) => (
      <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} className="fd-chave" onClick={() => aoMudar(!ligado)}><span /></button>
    );

    return (
      <>
      <AppPageHeader title={selected.nome} subtitle="Ficha técnica" onBack={fecharFicha} />
      <div className="cl9 fd">
        <div className="fd-grade">
        <div className="fd-principal">

          {/* Resumo do lucro (celular e tablet) */}
          <section className="cl9-card fd-resumo fd-so-cel">
            <div className="fd-topo">
              <span className="fd-foto">{foto ? <img src={foto} alt="" /> : <Camera size={24} weight="bold" aria-label="Sem foto" />}</span>
              <div className={`fd-lucro fd-lucro--${tom}`}>
                <small>{lucroLive < 0 ? "Prejuízo" : "Seu lucro"}</small>
                <b>R$ {fmt(Math.abs(lucroLive))}</b>
                <span>{fmtPct(margemLucroLive)}% de margem</span>
              </div>
            </div>
            <Barra />
            <Conta />
          </section>

          {/* Ingredientes */}
          <section className="cl9-card">
            <Titulo contagem={ficha.length || undefined}>Ingredientes</Titulo>
            {ficha.length === 0 ? (
              <TelaVazia compacta icone={<Egg size={28} />}
                titulo={insumosCadastrados.length === 0 ? "Cadastre seus ingredientes" : "Nenhum ingrediente nesta ficha"}
                texto={insumosCadastrados.length === 0
                  ? "A ficha soma o custo de cada ingrediente que vai no produto. Comece pelo que você mais usa: leite condensado, farinha, ovos…"
                  : `Adicione o que vai no ${selected.nome} pra saber quanto ele custa.`}
                acao={insumosCadastrados.length === 0
                  ? <Botao tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={abrirCadastro}>Cadastrar ingrediente</Botao>
                  : <Botao tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={abrirPicker}>Adicionar ingrediente</Botao>} />
            ) : (<>
              <div className="fd-ing-cab" aria-hidden="true"><span>Ingrediente</span><span>Quanto vai</span><span>Custo</span><span /></div>
              {ficha.map(f => {
                const ins = f.insumo;
                const custoLinha = calcCusto(f.quantidade, f.unidade_utilizada, ins);
                const unidades = getCompatibleUnits(ins);
                const semQtd = !(f.quantidade > 0);
                return (
                  <div key={f.insumo_id} className="fd-ing">
                    <span className="fd-ing-th">{ins.imagem_url ? <img src={ins.imagem_url} alt="" /> : ins.nome.charAt(0).toUpperCase()}</span>
                    <span className="fd-ing-nome"><b>{ins.nome}</b>{semQtd && <small>Falta a quantidade</small>}</span>
                    <span className="fd-ing-qtd">
                      <CampoNumero value={f.quantidade} placeholder="0" onValor={n => setQtd(f.insumo_id, n)} aria-label={`Quanto vai de ${ins.nome}`} />
                      {unidades.length > 1 ? (
                        <select value={f.unidade_utilizada} onChange={e => setUnidade(f.insumo_id, e.target.value)} aria-label={`Medida de ${ins.nome}`}>
                          {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      ) : <i>{f.unidade_utilizada}</i>}
                    </span>
                    <button type="button" className="fd-ing-custo" onClick={() => setInfoCustoAberto(f.insumo_id)} aria-label={`Custo de ${ins.nome}: R$ ${fmt(custoLinha)}. Ver a conta`}>
                      R$ {fmt(custoLinha)}<Info size={16} weight="bold" aria-hidden="true" />
                    </button>
                    <BotaoIcone rotulo={`Tirar ${ins.nome} da ficha`} variante="limpo" onClick={() => removeInsumo(f.insumo_id)}><X size={18} weight="bold" /></BotaoIcone>
                  </div>
                );
              })}
              <div className="fd-ing-acoes">
                {insumosCadastrados.length > 0 && <Botao variante="secundario" tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={abrirPicker}>Adicionar ingrediente</Botao>}
                <Botao variante="link" tamanho="m" onClick={abrirCadastro}>Cadastrar novo</Botao>
              </div>
            </>)}
          </section>

          <div className="fd-par">
            {/* Custos invisíveis */}
            <section className="cl9-card fd-sec">
              <Titulo>Custos invisíveis</Titulo>
              <p className="fd-dica">Gás, luz, água, plástico filme e outros gastos difíceis de medir em cada receita.</p>
              {cvConta != null && !editarCv ? (
                <div className="fd-mo-conta">
                  <span><small>Salvo na sua conta</small><b>{fmtPct(cvConta)}% sobre os ingredientes</b></span>
                  <Botao variante="link" tamanho="m" onClick={() => setEditarCv(true)}>Alterar</Botao>
                </div>
              ) : (<>
                <Campo rotulo="% sobre os ingredientes" inputMode="decimal" placeholder="25" value={extras.cv_percentual}
                  onChange={e => setExtras(s => ({ ...s, cv_percentual: e.target.value }))} depois={<span className="cl9-f-uf">%</span>} />
                <div className="fd-mo-acoes">
                  <Botao variante="secundario" tamanho="m" carregando={salvandoCv} onClick={salvarCvConta}>Salvar pra todos os produtos</Botao>
                  {cvConta != null && <Botao variante="link" tamanho="m" onClick={() => { setEditarCv(false); setExtras(s => ({ ...s, cv_percentual: String(cvConta) })); }}>Cancelar</Botao>}
                </div>
              </>)}
              <p className="fd-mo">Nesta receita: <b>R$ {fmt(cvLive)}</b></p>
              <p className="fd-dica">A maioria das confeiteiras usa entre 20% e 30%. Se não souber, deixe 25%.</p>
            </section>

            {/* Mão de obra */}
            <section className="cl9-card fd-sec">
              <div className="fd-sec-cab">
                <Titulo>Mão de obra</Titulo>
                <Chave ligado={moAtivo} aoMudar={setMoAtivo} rotulo="Somar a mão de obra" />
              </div>
              {!moAtivo ? (
                <p className="fd-dica">Ligue pra colocar o valor do seu tempo no custo do produto.</p>
              ) : (<>
                {maoConta && !editarMao ? (
                  <div className="fd-mo-conta">
                    <span><small>Salvo na sua conta</small><b>R$ {fmt(maoConta.salario)} por mês · {fmtQty(maoConta.horasSemana)} h por semana</b></span>
                    <Botao variante="link" tamanho="m" onClick={() => setEditarMao(true)}>Alterar</Botao>
                  </div>
                ) : (<>
                  <div className="cl9-f-2">
                    <Campo rotulo="Quer ganhar por mês" inputMode="decimal" prefixo="R$" placeholder="3.000" value={extras.salario_desejado}
                      onChange={e => setExtras(s => ({ ...s, salario_desejado: e.target.value }))} />
                    <Campo rotulo="Horas por semana" inputMode="numeric" placeholder="40" value={extras.horas_semanais}
                      onChange={e => setExtras(s => ({ ...s, horas_semanais: e.target.value }))} depois={<span className="cl9-f-uf">h</span>} />
                  </div>
                  <div className="fd-mo-acoes">
                    <Botao variante="secundario" tamanho="m" carregando={salvandoMao} onClick={salvarMaoConta}>Salvar pra todos os produtos</Botao>
                    {maoConta && <Botao variante="link" tamanho="m" onClick={() => { setEditarMao(false); setExtras(s => ({ ...s, salario_desejado: String(maoConta.salario), horas_semanais: String(maoConta.horasSemana) })); }}>Cancelar</Botao>}
                  </div>
                  {!maoConta && <p className="fd-dica">Salve uma vez e todos os produtos usam esse valor. Você também muda em Custos.</p>}
                </>)}
                <Campo rotulo="Tempo pra fazer esta receita" inputMode="numeric" placeholder="0" value={extras.tempo_preparo_min}
                  onChange={e => setExtras(s => ({ ...s, tempo_preparo_min: e.target.value }))} depois={<span className="cl9-f-uf">min</span>} />
                <p className="fd-mo">Sua hora vale <b>R$ {fmt(custoHora)}</b>{moLive > 0 && <> · nesta receita: <b>R$ {fmt(moLive)}</b></>}</p>
              </>)}
            </section>
          </div>

          {/* Informações do produto */}
          <section className="cl9-card fd-sec">
            <div className="fd-sec-cab">
              <Titulo>Informações do produto</Titulo>
              <Chave ligado={infoAtivo} aoMudar={setInfoAtivo} rotulo="Mostrar informações do produto" />
            </div>
            {!infoAtivo ? (
              <p className="fd-dica">Ligue pra anotar rendimento, validade, embalagem e observações.</p>
            ) : (<>
              <div className="cl9-f-2">
                <Campo rotulo="Rende" opcional placeholder="Ex.: 20 brigadeiros" value={extras.rendimento_qtd} onChange={e => setExtras(s => ({ ...s, rendimento_qtd: e.target.value }))} />
                <Campo rotulo="Peso total" opcional placeholder="Ex.: 1,2 kg" value={extras.rendimento_peso} onChange={e => setExtras(s => ({ ...s, rendimento_peso: e.target.value }))} />
                <Campo rotulo="Validade" opcional inputMode="numeric" placeholder="5" value={extras.validade_dias} onChange={e => setExtras(s => ({ ...s, validade_dias: e.target.value }))} depois={<span className="cl9-f-uf">dias</span>} />
              </div>
              <div>
                  <p className="fd-rot">Guardar</p>
                  <div className="cl9-f-chips">
                    {([["ambiente", "Ambiente"], ["refrigerado", "Geladeira"], ["congelado", "Freezer"]] as const).map(([v, t]) => (
                      <button key={v} type="button" aria-pressed={extras.validade_tipo === v} onClick={() => setExtras(s => ({ ...s, validade_tipo: v }))}>{t}</button>
                    ))}
                  </div>
                </div>
              <Campo rotulo="Embalagem" opcional placeholder="Ex.: caixa kraft 20x20" value={extras.embalagem} onChange={e => setExtras(s => ({ ...s, embalagem: e.target.value }))} />
              <CampoArea rotulo="Observações" opcional rows={2} placeholder="Produção, armazenamento ou venda" value={extras.observacoes_ficha} onChange={e => setExtras(s => ({ ...s, observacoes_ficha: e.target.value }))} />
            </>)}
          </section>
        </div>

        {/* Computador: resumo fixo ao lado */}
        <aside className="fd-lado">
          <section className="cl9-card fd-resumo">
            <div className="fd-topo">
              <span className="fd-foto">{foto ? <img src={foto} alt="" /> : <Camera size={24} weight="bold" aria-label="Sem foto" />}</span>
              <div className={`fd-lucro fd-lucro--${tom}`}>
                <small>{lucroLive < 0 ? "Prejuízo" : "Seu lucro"}</small>
                <b>R$ {fmt(Math.abs(lucroLive))}</b>
                <span>{fmtPct(margemLucroLive)}% de margem</span>
              </div>
            </div>
            <Barra />
            <Conta />
            <Botao cheio carregando={saving} onClick={salvarFicha}>Salvar ficha</Botao>
          </section>
        </aside>
        </div>
      </div>

      {/* Celular: lucro fixo embaixo com o salvar */}
      <div className="fd-fixo">
        <div className={`fd-fixo-lucro fd-lucro--${tom}`}>
          <small>{lucroLive < 0 ? "Prejuízo" : "Lucro"} · {fmtPct(margemLucroLive)}%</small>
          <b>R$ {fmt(Math.abs(lucroLive))}</b>
        </div>
        <Botao carregando={saving} onClick={salvarFicha}>Salvar ficha</Botao>
      </div>

      {/* Escolher ingredientes já cadastrados (vários de uma vez) */}
      <Janela aberta={showPicker} aoFechar={fecharPicker} tipo="conteudo" titulo="Adicionar ingrediente"
        acoes={<><Botao variante="secundario" onClick={fecharPicker}>Cancelar</Botao><Botao disabled={pickerSel.length === 0} onClick={confirmarPicker}>{pickerSel.length > 1 ? `Adicionar ${pickerSel.length}` : "Adicionar"}</Botao></>}>
        <div className="fd-pick">
          <label className="cl9-busca">
            <MagnifyingGlass size={20} weight="bold" />
            <input type="search" placeholder="Buscar ingrediente" value={pickerBusca} onChange={e => setPickerBusca(e.target.value)} aria-label="Buscar ingrediente" autoComplete="off" />
          </label>
          {pickerLista.length === 0 ? (
            <p className="cl9-semres">{disponiveis.length === 0 ? "Todos os seus ingredientes já estão nesta ficha." : "Nenhum ingrediente com esse nome."}</p>
          ) : pickerLista.map(i => {
            const sel = pickerSel.includes(i.id);
            return (
              <button key={i.id} type="button" className="fd-pick-l" aria-pressed={sel} onClick={() => togglePickerSel(i.id)}>
                <span className="fd-ing-th">{i.imagem_url ? <img src={i.imagem_url} alt="" /> : i.nome.charAt(0).toUpperCase()}</span>
                <b>{i.nome}</b>
                <span className="fd-pick-v">{sel && <Check size={16} weight="bold" />}</span>
              </button>
            );
          })}
          <button type="button" className="fd-pick-novo" onClick={() => { fecharPicker(); abrirCadastro(); }}><Plus size={18} weight="bold" />Cadastrar ingrediente novo</button>
        </div>
      </Janela>

      {/* Cadastro de ingrediente novo (o mesmo da tela Ingredientes) */}
      {showQuickAdd && (
        <QuickAddInsumo janela aberta userId={userId} initialName={quickAddName} onSaved={handleInsumoSalvo}
          onCancel={() => { setShowQuickAdd(false); setQuickAddName(""); }} />
      )}

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
                      Você cadastrou em <strong>Ingredientes</strong> que paga{" "}
                      <strong>R$ {fmt(valorPago)}</strong> {naNo} {tipoEmbBaixo} de{" "}
                      <strong>{fmtQty(qtdEmb)} {fmtUnidade(ins.unidade, qtdEmb)}</strong> de {ins.nome}.
                    </p>
                  ) : temValorCompra ? (
                    <p style={{ margin: "0 0 12px" }}>
                      Você cadastrou em <strong>Ingredientes</strong> que paga{" "}
                      <strong>R$ {fmt(valorPago)}</strong> por {fmtUnidade(ins.unidade, 1)} de {ins.nome}.
                    </p>
                  ) : (
                    <p style={{ margin: "0 0 12px" }}>
                      Você cadastrou {ins.nome} em <strong>Ingredientes</strong>.
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
                    <strong>{fmtQty(qtdEmb)} {fmtUnidade(ins.unidade, qtdEmb)}</strong> de {ins.nome} (cadastrado em <strong>Ingredientes</strong>).
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
                    Você paga <strong>R$ {fmt(valorPago)}</strong> por {fmtUnidade(ins.unidade, 1)} de {ins.nome} (cadastrado em <strong>Ingredientes</strong>).
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
                    <strong>{fmtQty(qtdEmb)} {fmtUnidade(ins.unidade, qtdEmb)}</strong> de {ins.nome} (cadastrado em <strong>Ingredientes</strong>).
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
                    <strong>Dica:</strong> abra esse ingrediente em <strong>Ingredientes</strong> e refaça o cadastro pra que a explicação aqui fique completa.
                  </p>
                </>
              )}
            </DooInfoModal>
          );
        })()}
      </>
    );
  }

  /* LIST VIEW (10.2: lista no padrão do app, com o lucro certo) */
  const nPrejuizo = produtos.filter(p => { const c = calcular(p, maoConta, cvConta); return c.temFicha && c.lucro < 0; }).length;
  const reais = (v: number) => v < 0 ? `−R$ ${fmt(-v)}` : `R$ ${fmt(v)}`;
  const tomMargem = (m: number) => m >= 30 ? "ok" : m >= 0 ? "atencao" : "neg";
  const chipsFiltro = ([
    ["todos", "Todos", produtos.length],
    ["com", "Com ficha", totalComFicha],
    ["sem", "Sem ficha", produtos.length - totalComFicha],
    ["prejuizo", "Dando prejuízo", nPrejuizo],
  ] as const).filter(([k, , n]) => k === "todos" || n > 0 || filtro === k);
  return (
    <>
    <AppPageHeader
      title="Ficha técnica"
      subtitle={produtos.length === 0 ? "O custo e o lucro de cada produto" : `${totalComFicha} de ${produtos.length} com ficha técnica`}
      infoContent={
        <>
          <p>A ficha técnica mostra quanto custa fazer cada produto e quanto sobra de lucro no preço que você cobra.</p>
          <p>O custo soma os ingredientes, os custos invisíveis (gás, luz, água) e a sua mão de obra, quando você coloca.</p>
        </>
      }
      infoTip={<>Escolha um produto pra montar ou ajustar a ficha.</>}
    />
    <div className="cl9 fl">
      {produtos.length === 0 ? (
        <TelaVazia caixa icone={<Receipt size={30} />} titulo="Nenhum produto ainda"
          texto="Cadastre seus produtos primeiro. Depois, aqui você monta a ficha técnica de cada um e vê quanto lucra."
          acao={<Botao icone={<Plus size={20} weight="bold" />} onClick={() => navigate("/produtos")}>Cadastrar produto</Botao>} />
      ) : (<>
        {nPrejuizo > 0 && filtro !== "prejuizo" && (
          <button type="button" className="fl-alerta" onClick={() => setFiltro("prejuizo")}>
            <span className="fl-alerta-ic"><TrendDown size={24} weight="bold" /></span>
            <span>
              <b>{nPrejuizo === 1 ? "1 produto está" : `${nPrejuizo} produtos estão`} dando prejuízo</b>
              <small>O preço de venda não cobre o custo. Veja qual e ajuste.</small>
            </span>
            <CaretRight size={20} weight="bold" />
          </button>
        )}
        <section className="cl9-card">
          <div className="cl9-barra">
            <label className="cl9-busca">
              <MagnifyingGlass size={20} weight="bold" />
              <input type="search" placeholder="Buscar produto" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar produto" autoComplete="off" />
              {busca && <button type="button" aria-label="Limpar a busca" onClick={() => setBusca("")}><X size={18} weight="bold" /></button>}
            </label>
          </div>
          {chipsFiltro.length > 1 && (
            <div className="cl9-chips" role="tablist" aria-label="Filtrar produtos">
              {chipsFiltro.map(([k, t, n]) => (
                <button key={k} type="button" role="tab" aria-selected={filtro === k} onClick={() => setFiltro(k)}>{t}<i>{n}</i></button>
              ))}
            </div>
          )}
          {filtrados.length === 0 ? (
            <p className="cl9-semres">{busca.trim() ? "Nenhum produto com esse nome. Confira a busca." : "Nenhum produto nesse filtro."}</p>
          ) : (<>
            <div className="fl-cab" aria-hidden="true"><span>Produto</span><span>Custo</span><span>Lucro</span><span>Margem</span><span /></div>
            {filtrados.map(p => {
              const c = calcular(p, maoConta, cvConta);
              const foto = (p.imagem_url || "").split(",")[0];
              return (
                <button key={p.id} type="button" className={`fl-l${c.temFicha ? "" : " fl-l--sem"}`} onClick={() => abrirFicha(p)}>
                  <span className="fl-th">{foto ? <img src={foto} alt="" /> : <Camera size={20} weight="bold" aria-label="Sem foto" />}</span>
                  <span className="fl-tx">
                    <b>{p.nome}</b>
                    <small className="fl-cel">
                      {c.temFicha ? `Margem de ${fmtPct(c.margemLucro)}%` : "Sem ficha técnica"}
                    </small>
                  </span>
                  <span className="fl-pc fl-col">{c.temFicha ? reais(c.custoTotal) : "—"}</span>
                  {c.temFicha ? (<>
                    <span className={`fl-lucro fl-lucro--${tomMargem(c.margemLucro)}`}>
                      <b><span className="fl-cel">R$ {fmt(Math.abs(c.lucro))}</span><span className="fl-pci">{reais(c.lucro)}</span></b>
                      <small className="fl-cel">{c.lucro < 0 ? "de prejuízo" : "de lucro"}</small>
                    </span>
                    <span className="fl-pc"><i className={`fl-pill fl-pill--${tomMargem(c.margemLucro)}`}>{fmtPct(c.margemLucro)}%</i></span>
                  </>) : (<>
                    <span className="fl-montar">Montar ficha</span>
                    <span className="fl-pc" />
                  </>)}
                  <CaretRight size={18} weight="bold" />
                </button>
              );
            })}
          </>)}
        </section>
      </>)}
    </div>
    </>
  );
}



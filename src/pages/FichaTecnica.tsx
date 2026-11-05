import { useState, useEffect, useMemo, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAbrirPedido } from "@/hooks/useAbrirPedido";
import CampoNumero from "@/components/ui/CampoNumero";
import { parseNumBR } from "@/lib/numeroBR";
import { explicarErro } from "@/lib/erros";
import { calcularCustoLucro, custoDaHora, lerMaoObraConta, precoQueClientePaga, type CustoDaVenda, type MaoObraConta } from "@/lib/produto-precificacao";
import { taxaPctDaForma, fixoPorPedido } from "@/lib/painelFinanceiro";
import { qtdBaseDoKit } from "@/lib/kitQuantidade";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { gravarInsumosDoProduto } from "@/lib/insumosDoo";
import { useProfile } from "@/hooks/useProfile";
import QuickAddInsumo, { InsumoQuick } from "@/components/QuickAddInsumo";
import DooInfoModal from "@/components/DooInfoModal";
import AppPageHeader from "@/components/AppPageHeader";
import { COMO_FICHA, TOUR_FICHA } from "@/lib/comoTelas";
import { Botao, BotaoIcone, Campo, Janela, TelaVazia, Titulo, avisar, confirmar } from "@/components/base";
import GavetaFiltro, { BotaoFiltro } from "@/components/base/GavetaFiltro";
import { Camera, CaretDown, CaretRight, Check, Egg, Info, MagnifyingGlass, Plus, Receipt, Trash, TrendDown, WarningCircle, X, ListBullets, SquaresFour } from "@phosphor-icons/react";
import { Mascote } from "@/components/marca/Mascote";
import "./clientes.css";
import "./fichaLista.css";
import AbasFicha from "@/components/ficha/AbasFicha";
import "./fichaDetalhe.css";
import { usePlano } from "@/hooks/usePlano";
import { abrirDooIA } from "@/components/MenuContaItens";

// ── Famílias de unidades e conversão ──

type UnitFamily = "massa" | "volume" | "unidade" | "comprimento";

const UNIT_FAMILIES: Record<string, { family: UnitFamily; toBase: number }> = {
  kg:  { family: "massa",   toBase: 1     },
  g:   { family: "massa",   toBase: 0.001 },
  L:   { family: "volume",  toBase: 1     },
  ml:  { family: "volume",  toBase: 0.001 },
  un:  { family: "unidade", toBase: 1     },
  m:   { family: "comprimento", toBase: 1 },    // (6.31) fita, renda: comprado em metro
  cm:  { family: "comprimento", toBase: 0.01 }, // e usado em cm na receita
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
  if (info.family === "comprimento") return "cm";
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

/** (6.164) preço de compra na unidade cheia (kg, L, un, m), pra coluna "Preço" da tabela */
function precoCheio(insumo: Insumo): { valor: number; un: string } {
  const fam = UNIT_FAMILIES[insumo.unidade]?.family;
  const un = fam === "massa" ? "kg" : fam === "volume" ? "L" : fam === "comprimento" ? "m" : insumo.unidade || "un";
  return { valor: calcCusto(1, un, insumo), un };
}

const NOME_MEDIDA: Record<string, string> = { g: "gramas", kg: "quilos", ml: "mililitros", L: "litros", cm: "centímetros", m: "metros", un: "unidades" };

/** (6.166) medida do ingrediente: menu do app (antes a lista do sistema, azul e quadrada) */
function MenuMedida({ valor, opcoes, rotulo, aoMudar }: { valor: string; opcoes: string[]; rotulo: string; aoMudar: (u: string) => void }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pos) return;
    const fechar = (e: Event) => { if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setPos(null); };
    const rolou = (e: Event) => { if (!menu.current?.contains(e.target as Node)) setPos(null); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setPos(null); };
    document.addEventListener("pointerdown", fechar); window.addEventListener("scroll", rolou, true); window.addEventListener("resize", rolou); document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("pointerdown", fechar); window.removeEventListener("scroll", rolou, true); window.removeEventListener("resize", rolou); document.removeEventListener("keydown", tecla); };
  }, [pos]);
  const abrir = () => {
    if (pos) { setPos(null); return; }
    const r = btn.current?.getBoundingClientRect(); if (!r) return;
    const largura = 180, altura = opcoes.length * 48 + 10;
    const top = r.bottom + 6 + altura > window.innerHeight - 8 ? r.top - 6 - altura : r.bottom + 6;
    setPos({ top, left: Math.max(8, Math.min(r.right - largura, window.innerWidth - largura - 8)) });
  };
  return (
    <>
      <button ref={btn} type="button" className="fd-med" aria-haspopup="menu" aria-expanded={!!pos} aria-label={rotulo} onClick={abrir}>
        {valor}<CaretDown size={12} weight="bold" aria-hidden="true" />
      </button>
      {pos && createPortal(
        <div ref={menu} className="fd-med-menu" role="menu" style={{ top: pos.top, left: pos.left }}>
          {opcoes.map(u => (
            <button key={u} type="button" role="menuitemradio" aria-checked={u === valor} onClick={() => { aoMudar(u); setPos(null); }}>
              <span><b>{u}</b><small>{NOME_MEDIDA[u] || u}</small></span>{u === valor && <Check size={16} weight="bold" />}
            </button>
          ))}
        </div>, document.body)}
    </>
  );
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
  kit_qtd?: unknown;
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
  if (["kg", "g", "ml", "L", "m", "cm"].includes(unidade)) return unidade;
  // Embalagens (Lata, Pacote, Caixa...) — lowercase + plural quando aplicável
  const lower = unidade.toLowerCase();
  return Math.abs(qtd) !== 1 ? lower + "s" : lower;
};

/** Variações do título do modal de "como calculamos o custo" — sorteadas
 *  a cada abertura pra dar variedade e tom mais humano à conversa.
 *  Mantidas curtas para combinar bem com `text-wrap: balance`. */
const MODAL_TITLE_VARIANTS: ((nome: string) => ReactNode)[] = [
  // Formais
  (n) => <><strong style={{ fontWeight: 600 }}>{n}</strong>, veja como calculamos este custo.</>,
  (n) => <><strong style={{ fontWeight: 600 }}>{n}</strong>, confira como chegamos a este valor.</>,
  (n) => <><strong style={{ fontWeight: 600 }}>{n}</strong>, entenda como este custo foi calculado.</>,
  (n) => <><strong style={{ fontWeight: 600 }}>{n}</strong>, vamos mostrar como esse valor foi obtido.</>,
  (n) => <><strong style={{ fontWeight: 600 }}>{n}</strong>, veja o passo a passo deste cálculo.</>,
  (n) => <><strong style={{ fontWeight: 600 }}>{n}</strong>, descubra como calculamos este ingrediente.</>,
  (n) => <><strong style={{ fontWeight: 600 }}>{n}</strong>, este é o cálculo por trás deste custo.</>,
  (n) => <><strong style={{ fontWeight: 600 }}>{n}</strong>, entenda de onde vem este valor.</>,
  // Descontraídas
  (n) => <><strong style={{ fontWeight: 600 }}>{n}</strong>, sem mistério! Veja como fizemos esse cálculo.</>,
  (n) => <><strong style={{ fontWeight: 600 }}>{n}</strong>, vamos abrir a calculadora e mostrar tudo.</>,
  (n) => <><strong style={{ fontWeight: 600 }}>{n}</strong>, aqui está a conta por trás deste custo.</>,
  (n) => <><strong style={{ fontWeight: 600 }}>{n}</strong>, veja cada etapa do cálculo.</>,
];

/**
 * Custo e lucro de um produto (lista).
 * Usa a MESMA conta da tela da ficha: ingredientes + custos invisíveis + mão de obra.
 * (Antes a lista só tirava os ingredientes e mostrava um lucro maior que o real.)
 */
/** Mão de obra salva na conta (Custos → Mão de obra): vale pra todos os produtos (09/10) */
type MaoConta = MaoObraConta;

// 10/10: a conta agora mora em produto-precificacao (a mesma em Produtos, aqui e no PDF) e considera promoção em %
// 13/10: + a taxa da maquininha no crédito (pior caso) e o custo fixo por pedido (Custos → Custos variáveis)
let VENDA: CustoDaVenda | null = null;
function calcular(p: Produto, conta: MaoConta = null, cvConta: number | null = null) {
  return calcularCustoLucro(p, conta, cvConta, VENDA);
}


export default function FichaTecnica() {
  const { profile } = useProfile();
  const primeiroNome = (profile?.nome || "").split(" ")[0] || "Confeiteira";
  const location = useLocation();
  const { isPro: isProFicha } = usePlano();
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Produto | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "com" | "sem" | "prejuizo">("todos");
  const [filtroAberto, setFiltroAberto] = useState(false);

  // Edicao da ficha
  const [insumosCadastrados, setInsumosCadastrados] = useState<Insumo[]>([]);
  const [ficha, setFicha] = useState<FichaItem[]>([]);
  const [, setBuscaInsumo] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [moAtivo, setMoAtivo] = useState(false);
  const ajeitarTempo = () => { const tot = (parseInt(tempoH) || 0) * 60 + (parseInt(tempoM) || 0); if ((parseInt(tempoM) || 0) >= 60) { setTempoH(String(Math.floor(tot / 60))); setTempoM(tot % 60 ? String(tot % 60) : ""); } };
  // (04/11 · 6.23) modo quadro (cartões com foto) ou lista; no PC abre em quadro; o app lembra a escolha
  const [modo, setModoBruto] = useState<"lista" | "quadro">(() => {
    try { const v = localStorage.getItem("doonly_ficha_modo"); if (v === "lista" || v === "quadro") return v; } catch { /* sem storage */ }
    return window.matchMedia("(min-width: 900px)").matches ? "quadro" : "lista";
  });
  const setModo = (m: "lista" | "quadro") => { setModoBruto(m); try { localStorage.setItem("doonly_ficha_modo", m); } catch { /* sem storage */ } };
  const [recemSalva, setRecemSalva] = useState<string | null>(null); // (04/11) a ficha que acabou de salvar, destacada na lista
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
  // (6.163) tempo de preparo em horas + minutos (antes só minutos: "2h30" virava conta de cabeça). Guarda em minutos, como antes.
  const [tempoH, setTempoH] = useState("");
  const [tempoM, setTempoM] = useState("");
  useEffect(() => {
    const t = parseInt(extras.tempo_preparo_min) || 0;
    if (t === (parseInt(tempoH) || 0) * 60 + (parseInt(tempoM) || 0)) return;
    setTempoH(t >= 60 ? String(Math.floor(t / 60)) : ""); setTempoM(t % 60 ? String(t % 60) : "");
  }, [extras.tempo_preparo_min]); // eslint-disable-line react-hooks/exhaustive-deps
  const mudarTempo = (h: string, m: string) => {
    setTempoH(h); setTempoM(m);
    const tot = Math.min(9999, (parseInt(h) || 0) * 60 + (parseInt(m) || 0));
    setExtras(s => ({ ...s, tempo_preparo_min: tot > 0 ? String(tot) : "" })); setMoAtivo(tot > 0);
  };
  /** 90 min vira 1 h 30 min quando sai do campo */
  const [saving, setSaving] = useState(false);

  const [maoConta, setMaoConta] = useState<MaoConta>(null);
  const [cvConta, setCvConta] = useState<number | null>(null);
  // (13/10) custos da venda: taxa do crédito, taxa do Pix (impostos etc.) e o fixo por pedido
  const [venda, setVenda] = useState<{ credito: number; pix: number; fixo: number }>({ credito: 0, pix: 0, fixo: 0 });
  VENDA = { pct: venda.credito, fixo: venda.fixo };
  const loadVenda = async (uid: string) => {
    const { data, error } = await supabase.from("custos_variaveis").select("*").eq("user_id", uid);
    if (error) return;
    const vars = (data as Parameters<typeof taxaPctDaForma>[1]) || [];
    setVenda({ credito: taxaPctDaForma("credito", vars), pix: taxaPctDaForma("pix", vars), fixo: fixoPorPedido(vars) });
  };
  // Custos invisíveis salvos na conta (09/10): coluna nova, lida à parte pra não quebrar se o SQL ainda não rodou
  const loadCvConta = async (uid: string) => {
    const { data, error } = await supabase.from("profiles").select("custos_invisiveis_pct").eq("id", uid).maybeSingle();
    const v = (data as { custos_invisiveis_pct?: number | null } | null)?.custos_invisiveis_pct;
    setCvConta(!error && v != null ? Number(v) : null);
  };
  // (16/10) salário, jornada e custos fixos vêm da tela Custos (a mesma hora lá e aqui)
  const loadMaoConta = async (uid: string) => { setMaoConta(await lerMaoObraConta(uid).catch(() => null)); };
  // (24/10) quanto cada produto vendeu nos últimos 30 dias: o "Montar a próxima" abre o mais vendido sem ficha
  const [vendidos, setVendidos] = useState<Record<string, number>>({});
  const loadVendidos = async (uid: string) => {
    try {
      const desde = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await supabase.from("pedidos").select("status, created_at, pedido_itens(produto_id, quantidade)").eq("user_id", uid).gte("created_at", desde);
      const m: Record<string, number> = {};
      for (const p of (data as { status: string; pedido_itens?: { produto_id?: string | null; quantidade?: number }[] | null }[]) || []) {
        if (p.status === "cancelado") continue;
        for (const it of p.pedido_itens || []) if (it.produto_id) m[it.produto_id] = (m[it.produto_id] || 0) + 1;
      }
      setVendidos(m);
    } catch { /* sem a contagem: segue pela ordem da lista */ }
  };
  // Devolve o erro da leitura (null = leu). Se falhar, a lista que está na tela continua como estava.
  const loadProdutos = async (uid: string): Promise<unknown> => {
    const { data, error } = await supabase
      .from("produtos")
      .select("*, produto_insumos(quantidade, unidade_utilizada, quantidade_base, insumos(id, nome, unidade, embalagem_tipo, qtd_embalagem, valor_compra, custo_unitario, imagem_url))")
      .eq("user_id", uid)
      .order("nome");
    if (data && !error) setProdutos(data as Produto[]);
    return error || (data ? null : new Error("sem dados"));
  };

  const loadInsumos = async (uid: string) => {
    const { data } = await supabase.from("insumos").select("id, nome, unidade, embalagem_tipo, qtd_embalagem, valor_compra, custo_unitario, imagem_url").eq("user_id", uid).order("nome");
    if (data) setInsumosCadastrados(data as Insumo[]);
  };

  // (11/10) a lista não carregou: mostra o erro com "Tentar de novo" em vez de "Nenhum produto ainda"
  const [erroCarga, setErroCarga] = useState("");
  const carregar = async () => {
    setLoading(true); setErroCarga("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErroCarga("Tente de novo em instantes."); setLoading(false); return; }
      setUserId(user.id);
      const [erroProdutos] = await Promise.all([loadProdutos(user.id), loadInsumos(user.id), loadMaoConta(user.id), loadCvConta(user.id), loadVenda(user.id), loadVendidos(user.id)]);
      if (erroProdutos) setErroCarga(explicarErro(erroProdutos, "Tente de novo em instantes."));
    } catch (e) {
      setErroCarga(explicarErro(e, "Tente de novo em instantes."));
    }
    setLoading(false);
  };
  useEffect(() => { void carregar(); }, []);

  // Abre direto a ficha de um produto quando navega de Produtos com state.produtoId
  useEffect(() => {
    const pid = (location.state as { produtoId?: string } | null)?.produtoId;
    if (!loading && pid && !selected) {
      const p = produtos.find(x => x.id === pid);
      // Veio de outra tela (ex.: sucesso do cadastro): abre no topo, com o cabeçalho visível
      if (p) { abrirFicha(p); window.scrollTo(0, 0); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, produtos, location.state]);

  // (22/10) veio do "Fazer" do Pra fazer (ou dos próximos passos): abre a lista já no filtro "Sem ficha".
  // Antes abria direto a ficha do primeiro produto, e ela não via quais eram os outros.
  useAbrirPedido(!loading && produtos.length > 0, p => {
    if (p !== "sem-ficha") return;
    setFiltro("sem"); window.scrollTo(0, 0);
  });

  // (11/10) Retrato da ficha como foi aberta (ou salva pela última vez): a seta de voltar pergunta antes de descartar mudanças.
  const retrato = useRef<{ ficha: string; extras: typeof extras; mo: boolean; info: boolean } | null>(null);
  const assinarFicha = (f: FichaItem[]) => JSON.stringify(f.map(x => [x.insumo_id, Number(x.quantidade) || 0, x.unidade_utilizada]));
  const mudouFicha = () => {
    const r = retrato.current;
    if (!r) return false;
    return r.ficha !== assinarFicha(ficha) || r.mo !== moAtivo || r.info !== infoAtivo
      || (Object.keys(r.extras) as (keyof typeof extras)[]).some(k => r.extras[k] !== extras[k]);
  };

  const abrirFicha = (p: Produto) => {
    setSelected(p);
    const fichaAberta: FichaItem[] = (p.produto_insumos || []).map(pi => {
      const insumo = pi.insumos as Insumo;
      return {
        insumo_id: insumo.id,
        quantidade: Number(pi.quantidade) || 0,
        unidade_utilizada: pi.unidade_utilizada || insumo.unidade,
        insumo,
      };
    });
    setFicha(fichaAberta);
    const extrasAbertos = {
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
    };
    setExtras(extrasAbertos);
    setBuscaInsumo("");
    setShowQuickAdd(false);
    // Ativa as seções automaticamente se já houver dados salvos
    const moAberto = !!(p.salario_desejado || p.tempo_preparo_min);
    const infoAberto = !!(p.rendimento_qtd || p.rendimento_peso || p.validade_dias || p.embalagem || p.observacoes_ficha);
    setMoAtivo(moAberto);
    setInfoAtivo(infoAberto);
    retrato.current = { ficha: assinarFicha(fichaAberta), extras: extrasAbertos, mo: moAberto, info: infoAberto };
  };

  const fecharFicha = async () => {
    if (saving) return;
    // 11/10: com mudanças sem salvar, pergunta antes (a seta de voltar fechava e perdia tudo calada)
    if (mudouFicha()) {
      const ok = await confirmar({ titulo: "Descartar as alterações?", texto: "O que você mudou na ficha técnica não foi salvo.", rotulo: "Descartar", rotuloVoltar: "Continuar", perigo: true, icone: "alerta" });
      if (!ok) return;
    }
    retrato.current = null;
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

    // 1. Persiste vinculos produto_insumos (10/10: confere o erro antes de seguir)
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
    // (28/10) grava os novos antes de tirar os antigos: falhou no meio, a ficha antiga continua no banco
    const { error: errIns } = await gravarInsumosDoProduto(selected.id, itens);
    if (errIns) {
      // Não deixa a ficha "sumir" calada: avisa e para (os ingredientes continuam na tela pra tentar de novo)
      setSaving(false);
      avisar(explicarErro(errIns, "Não deu para salvar os ingredientes. Tente de novo."), { tipo: "erro" });
      return;
    }

    // 2. Persiste campos extras no produto (respeitando os toggles ativos)
    const { error: errProd } = await supabase.from("produtos").update({
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
    if (errProd) {
      // Os ingredientes já foram gravados; o que não entrou foram os outros campos da ficha
      setSaving(false);
      avisar(explicarErro(errProd, "Os ingredientes foram salvos, mas o resto da ficha não. Tente salvar de novo."), { tipo: "erro" });
      return;
    }

    // 3. Recarrega e atualiza o produto selecionado
    await loadProdutos(userId);
    const { data } = await supabase
      .from("produtos")
      .select("*, produto_insumos(quantidade, unidade_utilizada, quantidade_base, insumos(id, nome, unidade, embalagem_tipo, qtd_embalagem, valor_compra, custo_unitario, imagem_url))")
      .eq("id", selected.id)
      .single();
    if (data) setSelected(data as Produto);

    // salvou: o que está na tela passa a ser o ponto de partida (a seta de voltar não pergunta mais)
    retrato.current = { ficha: assinarFicha(ficha), extras: { ...extras }, mo: moAtivo, info: infoAtivo };
    setSaving(false);
    avisar("Ficha técnica salva", { tipo: "ok" });
    // (04/11 · 6.20) salvou: volta pra lista da Ficha técnica, com a ficha salva destacada
    const salvaId = selected.id;
    retrato.current = null;
    setSelected(null); setFicha([]); setBuscaInsumo(""); setShowQuickAdd(false);
    setRecemSalva(salvaId);
    window.setTimeout(() => document.querySelector(`[data-ficha="${salvaId}"]`)?.scrollIntoView({ block: "center" }), 120);
    window.setTimeout(() => setRecemSalva(r => (r === salvaId ? null : r)), 3200);
  };

  const filtrados = produtos.filter(p => {
    if (busca.trim() && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    if (filtro === "com") return (p.produto_insumos || []).length > 0;
    if (filtro === "sem") return (p.produto_insumos || []).length === 0;
    if (filtro === "prejuizo") { const c = calcular(p, maoConta, cvConta); return c.temFicha && c.lucro < 0; }
    return true;
  });
  const totalComFicha = produtos.filter(p => (p.produto_insumos || []).length > 0).length;
  // (24/10) o próximo a montar: o mais vendido sem ficha (empate: a ordem da lista)
  const proximo = produtos.filter(p => (p.produto_insumos || []).length === 0).sort((a, b) => (vendidos[b.id] || 0) - (vendidos[a.id] || 0))[0];

  if (loading) return <><AppPageHeader title="Ficha técnica" subtitle="O custo e o lucro de cada produto" voltar="/cadastros" /><div className="cl9"><div className="cl9-esq" aria-label="Carregando">{[0, 1, 2, 3].map(k => <span key={k} />)}</div></div></>;

  /* DETAIL / EDIT VIEW */
  if (selected) {
    const cmvLive = ficha.reduce((s, f) => s + calcCusto(f.quantidade, f.unidade_utilizada, f.insumo), 0);
    // 10/10: preço que o cliente paga, com promoção em valor ou em %
    const precoLive = precoQueClientePaga(selected);

    // Custos invisíveis
    const cvPct = parseNumBR(extras.cv_percentual) || 0;
    const cvLive = cmvLive * (cvPct / 100);

    // Mão de obra
    const salario = parseNumBR(extras.salario_desejado) || 0;
    const horasSem = parseNumBR(extras.horas_semanais) || 40;
    const tempoMin = parseInt(extras.tempo_preparo_min) || 0;
    const custoHora = custoDaHora(maoConta ?? { salario, horasSemana: horasSem });
    const moLive = moAtivo ? custoHora * (tempoMin / 60) : 0;

    // (13/10) taxa da maquininha no crédito (pior caso) + embalagem por pedido
    const taxaLive = precoLive * (venda.credito / 100);
    const fixoLive = venda.fixo;
    const ganhoPix = precoLive * (Math.max(0, venda.credito - venda.pix) / 100);

    // Totais
    const custoTotalLive = cmvLive + cvLive + moLive + taxaLive + fixoLive;
    const lucroLive = precoLive - custoTotalLive;
    const margemLucroLive = precoLive > 0 ? (lucroLive / precoLive) * 100 : 0;

    const foto = (selected.imagem_url || "").split(",")[0];
        const tom = margemLucroLive >= 30 ? "ok" : margemLucroLive >= 0 ? "atencao" : "neg";
    const rendeUn = parseNumBR(extras.rendimento_qtd) || 0;
    // (6.165) a lista mostra todos (os que já estão na ficha aparecem marcados, sem dar pra escolher de novo)
    const pickerLista = insumosCadastrados.filter(i => i.nome.toLowerCase().includes(pickerBusca.trim().toLowerCase()));
    const buscaPicker = pickerBusca.trim();
    const temExato = insumosCadastrados.some(i => i.nome.trim().toLowerCase() === buscaPicker.toLowerCase());
    const abrirCadastro = (nome = "") => { setQuickAddName(nome); setShowQuickAdd(true); };

    // Conta do lucro (a mesma no resumo do celular e na coluna do computador)
    // (31/10 · 5.84) pedaços prontos (não componentes criados a cada desenho)
    const conta = (
      <div className="fd-conta">
        <div><span>Ingredientes</span><span>R$ {fmt(cmvLive)}</span></div>
        <div><span>Custos invisíveis ({fmtPct(cvPct)}%)</span><span>R$ {fmt(cvLive)}</span></div>
        <div><span>Mão de obra{tempoMin > 0 && moAtivo ? ` (${tempoMin >= 60 ? `${Math.floor(tempoMin / 60)}h${tempoMin % 60 ? String(tempoMin % 60).padStart(2, "0") : ""}` : `${tempoMin} min`})` : ""}</span><span>R$ {fmt(moLive)}</span></div>
        {venda.credito > 0 && <div><span>Taxa no crédito ({fmtPct(venda.credito)}%)</span><span>R$ {fmt(taxaLive)}</span></div>}
        {fixoLive > 0 && <div><span>Por pedido (embalagem)</span><span>R$ {fmt(fixoLive)}</span></div>}
        <div className="fd-t"><span>Custo total</span><span>R$ {fmt(custoTotalLive)}</span></div>
        <div className="fd-pv"><span>Preço de venda</span><span>R$ {fmt(precoLive)}</span></div>
        {ganhoPix >= 0.01 && <div className="fd-pix"><span>No Pix ou dinheiro, você ganha R$ {fmt(ganhoPix)} a mais</span></div>}
        {infoAtivo && rendeUn > 0 && <div><span>Por unidade ({extras.rendimento_qtd})</span><span>R$ {fmt(custoTotalLive / rendeUn)}</span></div>}
      </div>
    );
    const barra = precoLive > 0 ? (() => {
      const pc = (v: number) => `${Math.max(0, Math.min(100, (v / precoLive) * 100))}%`;
      return (
        <>
          <div className="fd-barra" aria-hidden="true">
            <i style={{ width: pc(cmvLive), background: "var(--ui-rosa)" }} />
            <i style={{ width: pc(cvLive), background: "#F59E0B" }} />
            {moLive > 0 && <i style={{ width: pc(moLive), background: "var(--ui-vinho)" }} />}
            {taxaLive + fixoLive > 0 && <i style={{ width: pc(taxaLive + fixoLive), background: "#94A3B8" }} />}
            <i style={{ width: pc(Math.max(0, lucroLive)), background: "var(--ui-verde)" }} />
          </div>
          <div className="fd-leg">
            <span style={{ ["--c" as string]: "var(--ui-rosa)" }}>Ingredientes</span>
            <span style={{ ["--c" as string]: "#F59E0B" }}>Invisíveis</span>
            {moLive > 0 && <span style={{ ["--c" as string]: "var(--ui-vinho)" }}>Mão de obra</span>}
            {taxaLive + fixoLive > 0 && <span style={{ ["--c" as string]: "#94A3B8" }}>Taxas</span>}
            <span style={{ ["--c" as string]: "var(--ui-verde)" }}>Lucro</span>
          </div>
        </>
      );
    })() : null;

    return (
      <>
      <AppPageHeader title={selected.nome} subtitle="Ficha técnica" onBack={fecharFicha} />
      <div className="cl9 fd">
        {(!maoConta || cvConta == null) && (
          <div className="fd-aviso-custos" role="note">
            <WarningCircle size={20} weight="bold" aria-hidden="true" />
            <span><b>Para o custo sair certo</b><small>Cadastre {!maoConta && cvConta == null ? "sua mão de obra e os custos invisíveis (gás, luz e perdas)" : !maoConta ? "sua mão de obra" : "os custos invisíveis (gás, luz e perdas)"} em Custos.</small></span>
            <span className="fd-aviso-bts">
              {/* (6.102) PRO: a Doo pergunta e configura pela conversa */}
              {isProFicha && <Botao variante="secundario" tamanho="m" onClick={() => abrirDooIA("Quero configurar minha mão de obra e os custos invisíveis")}>Pedir à Doo</Botao>}
              <Botao variante="secundario" tamanho="m" onClick={() => navigate("/custos", { state: { abrir: !maoConta ? "mao" : "invisiveis" } })}>Cadastrar</Botao>
            </span>
          </div>
        )}
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
            {barra}
            {conta}
          </section>

          {/* Ingredientes */}
          <section className="cl9-card">
            <Titulo contagem={ficha.length || undefined}>Ingredientes</Titulo>
            {/* (6.03) pra que quantidade é a receita: o custo de cada pedido parte daqui (kit pela quantidade, bolo pelo peso) */}
            {(() => { const base = qtdBaseDoKit(selected.kit_qtd); return base > 0 ? <p className="fd-dica">Monte a receita para {base} unidades. Num pedido maior, o custo acompanha a quantidade.</p>
              : selected.forma_venda === "kg" ? <p className="fd-dica">Monte a receita para 1 kg. Num bolo maior, o custo acompanha o peso.</p> : null; })()}
            {ficha.length === 0 ? (
              <TelaVazia compacta icone={<Egg size={28} />}
                titulo={insumosCadastrados.length === 0 ? "Cadastre seus ingredientes" : "Nenhum ingrediente nesta ficha"}
                texto={insumosCadastrados.length === 0
                  ? "A ficha soma o custo de cada ingrediente que vai no produto. Comece pelo que você mais usa: leite condensado, farinha, ovos…"
                  : `Adicione o que vai no ${selected.nome} para saber quanto ele custa.`}
                acao={insumosCadastrados.length === 0
                  ? <Botao tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={() => abrirCadastro()}>Cadastrar ingrediente</Botao>
                  : <Botao tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={abrirPicker}>Adicionar ingrediente</Botao>} />
            ) : (<>
              <div className="fd-tab">
              <div className="fd-ing-cab" aria-hidden="true"><span>Ingrediente</span><span><em className="fd-so-pc-t">Quanto vai</em><em className="fd-so-cel-t">Qtd.</em></span><span className="fd-dir fd-so-pc">Preço</span><span className="fd-dir">Custo</span><span className="fd-so-pc" /></div>
              {ficha.map(f => {
                const ins = f.insumo;
                const custoLinha = calcCusto(f.quantidade, f.unidade_utilizada, ins);
                const unidades = getCompatibleUnits(ins);
                const semQtd = !(f.quantidade > 0);
                return (
                  <div key={f.insumo_id} className="fd-ing">
                    <button type="button" className="fd-c fd-c-nome" onClick={() => setInfoCustoAberto(f.insumo_id)} aria-label={`${ins.nome}: ver a conta do custo`}>
                    <span className="fd-ing-th">{ins.imagem_url ? <img src={ins.imagem_url} alt="" /> : ins.nome.charAt(0).toUpperCase()}</span>
                    <span className="fd-ing-nome"><b>{ins.nome}</b>{semQtd ? <small className="falta">Falta a quantidade</small> : <small>R$ {fmt(precoCheio(ins).valor)}/{precoCheio(ins).un}</small>}</span>
                    </button>
                    <span className="fd-c fd-c-qtd">
                    <span className="fd-ing-qtd">
                      <CampoNumero value={f.quantidade} placeholder="0" onValor={n => setQtd(f.insumo_id, n)} aria-label={`Quanto vai de ${ins.nome}`} />
                      {unidades.length > 1 ? (
                        <MenuMedida valor={f.unidade_utilizada} opcoes={unidades} rotulo={`Medida de ${ins.nome}: ${f.unidade_utilizada}`} aoMudar={u => setUnidade(f.insumo_id, u)} />
                      ) : <i>{f.unidade_utilizada}</i>}
                    </span>
                    </span>
                    {(() => { const pc = precoCheio(ins); return <span className="fd-c fd-c-preco">R$ {fmt(pc.valor)}/{pc.un}</span>; })()}
                    <span className="fd-c fd-c-custo">
                    <button type="button" className="fd-ing-custo" onClick={() => setInfoCustoAberto(f.insumo_id)} aria-label={`Custo de ${ins.nome}: R$ ${fmt(custoLinha)}. Ver a conta`}>
                      R$ {fmt(custoLinha)}<Info size={16} weight="bold" aria-hidden="true" />
                    </button>
                    </span>
                    <span className="fd-c fd-c-x">
                    <BotaoIcone rotulo={`Tirar ${ins.nome} da ficha`} variante="limpo" onClick={() => removeInsumo(f.insumo_id)}><X size={18} weight="bold" /></BotaoIcone>
                    </span>
                  </div>
                );
              })}
              {/* (6.165) adicionar é a última linha da tabela (cadastrar um novo fica dentro da lista) */}
              <button type="button" className="fd-ing-mais" onClick={abrirPicker}><Plus size={18} weight="bold" />Adicionar ingrediente</button>
              <div className="fd-ing-tot" aria-hidden="true"><span>Total</span><b>R$ {fmt(cmvLive)}</b><span className="fd-so-pc" /></div>
              </div>
            </>)}
          </section>

          {/* (04/11 · 6.20) mão de obra e custos invisíveis saíram da ficha (ficam em Custos e entram sozinhos no custo).
              Aqui fica só o tempo da receita, que é o que a mão de obra precisa. */}
          <section className="cl9-card fd-sec">
            <Titulo>Tempo de preparo</Titulo>
            <p className="fd-dica">Do começo ao fim da receita.</p>
            <div className="fd-tempo">
              <Campo rotulo="Horas" inputMode="numeric" placeholder="0" value={tempoH}
                onChange={e => mudarTempo(e.target.value.replace(/\D/g, "").slice(0, 2), tempoM)}
                depois={<span className="cl9-f-uf">h</span>} />
              <Campo rotulo="Minutos" inputMode="numeric" placeholder="0" value={tempoM} onBlur={ajeitarTempo}
                onChange={e => mudarTempo(tempoH, e.target.value.replace(/\D/g, "").slice(0, 3))}
                depois={<span className="cl9-f-uf">min</span>} />
            </div>
            <p className="ui-campo-msg fd-tempo-d">{!maoConta ? "Entra no custo quando você cadastrar a sua mão de obra em Custos." : Number(extras.tempo_preparo_min) > 0 ? `Sua mão de obra nesta receita: R$ ${fmt(moLive)}` : "Com o tempo, o valor do seu trabalho entra no custo."}</p>
          </section>

          {/* (6.102) "Informações do produto" saiu da ficha: não entra no custo (o que já foi salvo continua guardado) */}
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
            {barra}
            {conta}
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
            <p className="cl9-semres">{insumosCadastrados.length === 0 ? "Você ainda não tem ingredientes cadastrados." : "Nenhum ingrediente com esse nome."}</p>
          ) : pickerLista.map(i => {
            const naFicha = ficha.some(f => f.insumo_id === i.id);
            const sel = naFicha || pickerSel.includes(i.id);
            return (
              <button key={i.id} type="button" className="fd-pick-l" aria-pressed={sel} disabled={naFicha} onClick={() => togglePickerSel(i.id)}>
                <span className="fd-pick-v">{sel && <Check size={16} weight="bold" />}</span>
                <span className="fd-ing-th">{i.imagem_url ? <img src={i.imagem_url} alt="" /> : i.nome.charAt(0).toUpperCase()}</span>
                <span><b>{i.nome}</b>{naFicha && <small>Já está na ficha</small>}</span>
              </button>
            );
          })}
          <button type="button" className="fd-pick-novo" onClick={() => { fecharPicker(); abrirCadastro(buscaPicker && !temExato ? buscaPicker : ""); }}><Plus size={18} weight="bold" />{buscaPicker && !temExato ? `Cadastrar "${buscaPicker}"` : "Cadastrar ingrediente novo"}</button>
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
              image="/Sistema/precifique.webp"
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
                    <strong>Dica:</strong> abra esse ingrediente em <strong>Ingredientes</strong> e refaça o cadastro para que a explicação aqui fique completa.
                  </p>
                </>
              )}
              {/* (6.165) no celular o "x" saiu da tabela: tirar da ficha fica aqui */}
              <button type="button" className="fd-info-tirar" onClick={() => { removeInsumo(f.insumo_id); setInfoCustoAberto(null); }}><Trash size={18} weight="bold" />Tirar {ins.nome} da ficha</button>
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
    <AppPageHeader voltar="/cadastros"
      title="Ficha técnica" infoComo={COMO_FICHA} infoTour={TOUR_FICHA}
      subtitle={produtos.length === 0 ? "O custo e o lucro de cada produto" : `${totalComFicha} de ${produtos.length} com ficha técnica`}
      infoContent={
        <>
          <p>A ficha técnica mostra quanto custa fazer cada produto e quanto sobra de lucro no preço que você cobra.</p>
          <p>O custo soma os ingredientes, os custos invisíveis (gás do forno, perdas, descartáveis) e a sua mão de obra, que já inclui uma parte dos custos fixos.</p>
        </>
      }
      infoTip={<>Escolha um produto para montar ou ajustar a ficha.</>}
    />
    <div className="cl9 fl">
      <AbasFicha ativa="receitas" />
      {erroCarga ? (
        <TelaVazia caixa icone={<WarningCircle size={30} />} titulo="Não deu para carregar as fichas técnicas" texto={erroCarga}
          acao={<Botao onClick={() => void carregar()}>Tentar de novo</Botao>} />
      ) : produtos.length === 0 ? (
        <TelaVazia caixa icone={<Receipt size={30} />} titulo="Nenhum produto ainda"
          texto="Cadastre seus produtos primeiro. Depois, aqui você monta a ficha técnica de cada um e vê quanto lucra."
          acao={<Botao icone={<Plus size={20} weight="bold" />} onClick={() => navigate("/produtos")}>Cadastrar produto</Botao>} />
      ) : (<>
        {nPrejuizo > 0 && filtro !== "prejuizo" && (
          <button type="button" className="fl-alerta" onClick={() => setFiltro("prejuizo")}>
            <span className="fl-alerta-ic"><TrendDown size={24} weight="bold" /></span>
            <span>
              <b>{nPrejuizo === 1 ? "1 produto com prejuízo" : `${nPrejuizo} produtos com prejuízo`}</b>{/* (6.118) cabe numa linha no celular */}
              <small>O preço de venda não cobre o custo. Veja qual e ajuste.</small>
            </span>
            <CaretRight size={20} weight="bold" />
          </button>
        )}
        {/* (24/10) progresso: quantos têm ficha e o botão que abre o próximo (o mais vendido sem ficha) */}
        {proximo && (
          <section className="fl-prog">
            <div className="fl-prog-tx">
              <b>{totalComFicha} de {produtos.length} produtos com ficha técnica</b>
              <span className="fl-prog-bar" aria-hidden="true"><i style={{ width: `${Math.max(3, (totalComFicha / produtos.length) * 100)}%` }} /></span>
              <small>Sem ficha, o lucro aparece maior do que é.{vendidos[proximo.id] ? ` Comece pelo ${proximo.nome}: ${vendidos[proximo.id]} ${vendidos[proximo.id] === 1 ? "pedido" : "pedidos"} no mês.` : ""}</small>
            </div>
            <Botao icone={<Plus size={20} weight="bold" />} onClick={() => abrirFicha(proximo)}>Montar a próxima</Botao>
          </section>
        )}
        <section className="cl9-card">
          <div className="cl9-barra">
            <label className="cl9-busca">
              <MagnifyingGlass size={20} weight="bold" />
              <input type="search" placeholder="Buscar produto" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar produto" autoComplete="off" />
              {busca && <button type="button" aria-label="Limpar a busca" onClick={() => setBusca("")}><X size={18} weight="bold" /></button>}
            </label>
            {/* (24/10) filtro padrão do app: abre na lateral */}
            <BotaoFiltro className="fl-filtro" ativos={filtro === "todos" ? 0 : 1} onClick={() => setFiltroAberto(true)} />
            <div className="fq-modo" role="radiogroup" aria-label="Ver como">
              <button type="button" role="radio" aria-checked={modo === "lista"} aria-label="Lista" title="Lista" onClick={() => setModo("lista")}><ListBullets size={20} weight="bold" /></button>
              <button type="button" role="radio" aria-checked={modo === "quadro"} aria-label="Quadro" title="Quadro" onClick={() => setModo("quadro")}><SquaresFour size={20} weight="bold" /></button>
            </div>
          </div>
          {filtroAberto && <GavetaFiltro valor={{ mostrar: filtro }} padrao={{ mostrar: "todos" }}
            grupos={[{ id: "mostrar", titulo: "Mostrar", tipo: "radio", opcoes: chipsFiltro.map(([k, t, n]) => ({ k, label: k === "todos" ? "Todos os produtos" : t, n })) }]}
            contar={v => (chipsFiltro.find(([k]) => k === v.mostrar)?.[2] as number) ?? 0}
            rotulo={n => n === 0 ? "Nenhum produto" : `Ver ${n} ${n === 1 ? "produto" : "produtos"}`}
            aoAplicar={v => setFiltro(v.mostrar)} aoFechar={() => setFiltroAberto(false)} />}
          {filtrados.length === 0 ? (
            <p className="cl9-semres">{busca.trim() ? "Nenhum produto com esse nome. Confira a busca." : "Nenhum produto nesse filtro."}</p>
          ) : modo === "quadro" ? (
            <div className={`fq-grade${recemSalva ? " fq-grade--salva" : ""}`}>
              {filtrados.map(p => {
                const c = calcular(p, maoConta, cvConta);
                const foto = (p.imagem_url || "").split(",")[0];
                return (
                  <button key={p.id} type="button" data-ficha={p.id} className={`fq-c${recemSalva === p.id ? " fl-l--salva" : ""}`} onClick={() => abrirFicha(p)}>
                    <span className={`fq-foto${foto ? "" : " fq-foto--sem"}`}>{foto ? <img src={foto} alt="" loading="lazy" /> : <Mascote pose="acenando" className="fq-masc" />}</span>
                    <span className="fq-in">
                      <b className="fq-n" title={p.nome}>{p.nome}</b>
                      {c.temFicha ? (<>
                        <span className="fq-l"><small>Custo</small><em>{reais(c.custoTotal)}</em></span>
                        <span className="fq-l"><small>Lucro</small><em className={`fq-lucro fl-lucro--${tomMargem(c.margemLucro)}`}>{reais(c.lucro)}</em></span>
                        <span className="fq-l"><small>Margem</small><i className={`fl-pill fl-pill--${tomMargem(c.margemLucro)}`}>{fmtPct(c.margemLucro)}%</i></span>
                      </>) : <span className="fq-montar"><Plus size={16} weight="bold" aria-hidden="true" />Montar ficha</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (<>
            <div className="fl-cab" aria-hidden="true"><span>Produto</span><span>Custo</span><span>Lucro</span><span>Margem</span><span /></div>
            {filtrados.map(p => {
              const c = calcular(p, maoConta, cvConta);
              const foto = (p.imagem_url || "").split(",")[0];
              return (
                <button key={p.id} type="button" data-ficha={p.id} className={`fl-l${c.temFicha ? "" : " fl-l--sem"}${recemSalva === p.id ? " fl-l--salva" : ""}`} onClick={() => abrirFicha(p)}>
                  <span className="fl-th">{foto ? <img src={foto} alt="" /> : <Camera size={20} weight="bold" aria-label="Sem foto" />}</span>
                  <span className="fl-tx">
                    <b>{p.nome}</b>
                    <small className="fl-cel">
                      {c.temFicha ? `Margem ${fmtPct(c.margemLucro)}%` : "Sem ficha técnica"}
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



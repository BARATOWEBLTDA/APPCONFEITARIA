import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import EmptyDoo from "@/components/EmptyDoo";
import QuickAddInsumo, { InsumoQuick } from "@/components/QuickAddInsumo";

// ── Famílias de unidades e conversão ──

type UnitFamily = "massa" | "volume" | "unidade" | "discrete";

const UNIT_FAMILIES: Record<string, { family: UnitFamily; base: string; toBase: number }> = {
  kg:  { family: "massa",   base: "kg", toBase: 1 },
  g:   { family: "massa",   base: "kg", toBase: 0.001 },
  L:   { family: "volume",  base: "L",  toBase: 1 },
  ml:  { family: "volume",  base: "L",  toBase: 0.001 },
  un:  { family: "unidade", base: "un", toBase: 1 },
};

/** Unidades que são embalagem (não são medida real) */
const PACKAGING_UNITS = ["pct", "cx", "Lata", "Garrafa", "Pote", "Bandeja", "Saco", "Bisnaga", "Rolo"];

/** Retorna as unidades disponíveis para seleção na ficha técnica */
function getCompatibleUnits(insumo: Insumo): string[] {
  const unidade = insumo.unidade;
  const isPkg = PACKAGING_UNITS.includes(unidade);
  const effective = isPkg ? "un" : unidade;

  const info = UNIT_FAMILIES[effective];
  const units = info
    ? Object.entries(UNIT_FAMILIES).filter(([, v]) => v.family === info.family).map(([k]) => k)
    : [effective];

  // Adiciona a embalagem como opção (ex: "Bandeja" além de "un")
  if (isPkg && !units.includes(unidade)) {
    units.push(unidade);
  }
  if (insumo.embalagem_tipo && insumo.embalagem_tipo !== "Avulso" && !units.includes(insumo.embalagem_tipo)) {
    units.push(insumo.embalagem_tipo);
  }

  return units;
}

/** Retorna a unidade padrão mais prática para a ficha */
function getDefaultRecipeUnit(insumo: Insumo): string {
  const isPkg = PACKAGING_UNITS.includes(insumo.unidade);
  const effective = isPkg ? "un" : insumo.unidade;
  const info = UNIT_FAMILIES[effective];
  if (!info) return effective;
  if (info.family === "massa") return "g";
  if (info.family === "volume") return "ml";
  return effective;
}

/** Converte quantidade para a unidade base (kg, L, un) */
function toBase(qtd: number, unidade: string): number {
  if (PACKAGING_UNITS.includes(unidade)) return qtd;
  const info = UNIT_FAMILIES[unidade];
  return info ? qtd * info.toBase : qtd;
}

/** Calcula o custo dado qtd, unidade utilizada e o insumo completo */
function calcCusto(qtd: number, unidadeUtilizada: string, insumo: Insumo): number {
  const custoUnit = insumo.custo_unitario || 0;

  // Se a unidade utilizada é uma embalagem (Bandeja, Caixa, etc.)
  // 1 embalagem = qtd_embalagem unidades → custo = qty × qtd_embalagem × custo_unitario
  if (PACKAGING_UNITS.includes(unidadeUtilizada)) {
    const qtdEmb = insumo.qtd_embalagem || 1;
    return qtd * qtdEmb * custoUnit;
  }

  // Conversão normal entre unidades de medida (g↔kg, ml↔L)
  const effectiveInsumo = PACKAGING_UNITS.includes(insumo.unidade) ? "un" : insumo.unidade;
  const infoUtilizada = UNIT_FAMILIES[unidadeUtilizada];
  const infoInsumo = UNIT_FAMILIES[effectiveInsumo];

  if (infoUtilizada && infoInsumo && infoUtilizada.family === infoInsumo.family && infoInsumo.toBase > 0) {
    const qtdNaUnidadeInsumo = (qtd * infoUtilizada.toBase) / infoInsumo.toBase;
    return qtdNaUnidadeInsumo * custoUnit;
  }

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
    unidade_base?: string;
    embalagem_tipo?: string;
    qtd_embalagem?: number;
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
  unidade_base?: string;
  embalagem_tipo?: string;
  qtd_embalagem?: number;
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
      .select("*, produto_insumos(quantidade, unidade_utilizada, quantidade_base, insumos(id, nome, unidade, unidade_base, embalagem_tipo, qtd_embalagem, custo_unitario, imagem_url))")
      .eq("user_id", uid)
      .order("nome");
    if (data) setProdutos(data as Produto[]);
  };

  const loadInsumos = async (uid: string) => {
    const { data } = await supabase.from("insumos").select("id, nome, unidade, unidade_base, embalagem_tipo, qtd_embalagem, custo_unitario, imagem_url").eq("user_id", uid).order("nome");
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
      if (p) abrirFicha(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, produtos, location.state]);

  const abrirFicha = (p: Produto) => {
    setSelected(p);
    setFicha((p.produto_insumos || []).map(pi => ({
      insumo_id: pi.insumos.id,
      quantidade: Number(pi.quantidade) || 0,
      unidade_utilizada: pi.unidade_utilizada || pi.insumos.unidade,
      insumo: pi.insumos,
    })));
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
  };

  const fecharFicha = () => {
    setSelected(null);
    setFicha([]);
    setBuscaInsumo("");
    setShowQuickAdd(false);
  };

  // -- Manipulacao da ficha --
  const addInsumo = (ins: Insumo) => {
    if (ficha.some(f => f.insumo_id === ins.id)) return;
    setFicha(prev => [...prev, {
      insumo_id: ins.id,
      quantidade: 0,
      unidade_utilizada: getDefaultRecipeUnit(ins),
      insumo: ins,
    }]);
    setBuscaInsumo("");
  };
  const removeInsumo = (id: string) => setFicha(prev => prev.filter(f => f.insumo_id !== id));
  const setQtd = (id: string, qtd: number) => setFicha(prev => prev.map(f => f.insumo_id === id ? { ...f, quantidade: qtd } : f));
  const setUnidade = (id: string, unidade: string) => setFicha(prev => prev.map(f => f.insumo_id === id ? { ...f, unidade_utilizada: unidade } : f));

  const handleInsumoSalvo = (novo: InsumoQuick) => {
    const ins: Insumo = { id: novo.id, nome: novo.nome, unidade: novo.unidade, unidade_base: novo.unidade_base, custo_unitario: novo.custo_unitario, imagem_url: novo.imagem_url };
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
      await supabase.from("produto_insumos").insert(itens);
    }

    // 2. Persiste campos extras no produto
    await supabase.from("produtos").update({
      rendimento_qtd: extras.rendimento_qtd,
      rendimento_peso: extras.rendimento_peso,
      validade_dias: parseInt(extras.validade_dias) || 0,
      validade_tipo: extras.validade_tipo,
      embalagem: extras.embalagem,
      observacoes_ficha: extras.observacoes_ficha,
      cv_percentual: parseFloat(extras.cv_percentual) || 0,
      tempo_preparo_min: parseInt(extras.tempo_preparo_min) || 0,
      salario_desejado: parseFloat(extras.salario_desejado) || 0,
      horas_semanais: parseFloat(extras.horas_semanais) || 40,
      updated_at: new Date().toISOString(),
    }).eq("id", selected.id);

    // 3. Recarrega e atualiza o produto selecionado
    await loadProdutos(userId);
    const { data } = await supabase
      .from("produtos")
      .select("*, produto_insumos(quantidade, unidade_utilizada, quantidade_base, insumos(id, nome, unidade, unidade_base, embalagem_tipo, qtd_embalagem, custo_unitario, imagem_url))")
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
    const cvPct = parseFloat(extras.cv_percentual) || 0;
    const cvLive = cmvLive * (cvPct / 100);

    // Mão de obra
    const salario = parseFloat(extras.salario_desejado) || 0;
    const horasSem = parseFloat(extras.horas_semanais) || 40;
    const tempoMin = parseInt(extras.tempo_preparo_min) || 0;
    const custoHora = horasSem > 0 ? salario / (horasSem * 4.33) : 0;
    const moLive = custoHora * (tempoMin / 60);

    // Totais
    const custoTotalLive = cmvLive + cvLive + moLive;
    const lucroLive = precoLive - custoTotalLive;
    const margemLucroLive = precoLive > 0 ? (lucroLive / precoLive) * 100 : 0;
    const temFicha = ficha.length > 0;

    return (
      <div className="ft-root">
        <button className="ft-back" onClick={fecharFicha}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Voltar
        </button>

        {/* Cabeçalho do produto */}
        <div className="ft-tree">
          <div className="ft-tree-foto">
            {selected.imagem_url
              ? <img src={selected.imagem_url.split(",")[0]} alt={selected.nome} />
              : <div className="ft-tree-foto-placeholder">Sem imagem</div>
            }
          </div>
          <div className="ft-tree-titulo">
            <h1 className="ft-tree-nome">{selected.nome}</h1>
          </div>
        </div>

        {/* Lucro em destaque */}
        <div className="ft-lucro-hero">
          <span className="ft-lucro-hero-label">Seu lucro</span>
          <strong className={`ft-lucro-hero-value ${lucroLive >= 0 ? "" : "ft-lucro-hero-value--neg"}`}>R$ {fmt(lucroLive)}</strong>
          <span className={`ft-lucro-hero-margin ${margemLucroLive >= 30 ? "ft-lucro-hero-margin--ok" : margemLucroLive >= 0 ? "ft-lucro-hero-margin--warn" : "ft-lucro-hero-margin--neg"}`}>{fmtPct(margemLucroLive)}% de margem</span>
        </div>

        {/* Breakdown de precificação */}
        <div className="ft-pricing-card">
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
        <div className="ft-section-header">
          <h2 className="ft-section-title">Ingredientes e custos</h2>
          {temFicha && <span className="ft-section-cmv">Total ingredientes R$ {fmt(cmvLive)}</span>}
        </div>

        <div className="ft-edit-card">
          {ficha.length === 0 ? (
            <div className="ft-edit-empty">
              <p className="ft-edit-empty-title">Nenhum ingrediente ainda</p>
              <p className="ft-edit-empty-sub">Adicione abaixo os insumos usados para fazer 1 unidade deste produto.</p>
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
                    {/* Topo: imagem + nome + botão remover */}
                    <div className="ft-edit-item-top">
                      {ins.imagem_url
                        ? <img src={ins.imagem_url} alt={ins.nome} className="ft-edit-item-img" />
                        : <div className="ft-edit-item-img ft-edit-item-img--ph">{ins.nome.charAt(0).toUpperCase()}</div>}
                      <div className="ft-edit-item-info">
                        <p className="ft-edit-item-nome">{ins.nome}</p>
                        <p className="ft-edit-item-sub">R$ {fmtCusto(ins.custo_unitario || 0)} / {ins.unidade}</p>
                      </div>
                      <button className="ft-edit-item-del" onClick={() => removeInsumo(f.insumo_id)} aria-label="Remover">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>

                    {/* Rodapé: qtd usada + custo calculado */}
                    <div className="ft-edit-item-bottom">
                      <label className="ft-edit-item-label">Quantidade utilizada</label>
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
                        <div className="ft-edit-item-custo">
                          <span className="ft-edit-item-custo-eq">=</span>
                          <span className="ft-edit-item-custo-val">R$ {fmt(custoLinha)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Adicionar ingrediente */}
            <div className="ft-add">
              <div className="ft-add-label">Adicionar ingrediente</div>
              <input
                type="text" className="ft-add-input" placeholder="Buscar insumo cadastrado..."
                value={buscaInsumo} onChange={e => setBuscaInsumo(e.target.value)}
              />
              {buscaInsumo.trim() && (
                <div className="ft-add-results">
                  {insumosCadastrados
                    .filter(i => !ficha.some(f => f.insumo_id === i.id))
                    .filter(i => i.nome.toLowerCase().includes(buscaInsumo.toLowerCase()))
                    .slice(0, 6)
                    .map(i => (
                      <button key={i.id} type="button" className="ft-add-result" onClick={() => addInsumo(i)}>
                        {i.imagem_url
                          ? <img src={i.imagem_url} alt={i.nome} className="ft-add-result-img" />
                          : <div className="ft-add-result-img ft-add-result-img--ph">{i.nome.charAt(0).toUpperCase()}</div>}
                        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                          <p className="ft-edit-item-nome">{i.nome}</p>
                          <p className="ft-edit-item-sub">R$ {fmtCusto(i.custo_unitario || 0)} / {i.unidade}</p>
                        </div>
                      </button>
                    ))}
                  <button type="button" className="ft-add-novo" onClick={() => { setQuickAddName(buscaInsumo); setShowQuickAdd(true); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                    Cadastrar "{buscaInsumo}" como novo insumo
                  </button>
                </div>
              )}
              {!buscaInsumo.trim() && (
                <button type="button" className="ft-add-novo ft-add-novo--solo" onClick={() => { setQuickAddName(""); setShowQuickAdd(true); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                  Cadastrar novo insumo
                </button>
              )}
            </div>
        </div>

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

        {/* Custos invisíveis */}
        <div className="ft-section-header">
          <h2 className="ft-section-title">Custos invisíveis</h2>
        </div>
        <div className="ft-edit-card">
          <p className="ft-edit-empty-sub" style={{ margin: 0 }}>Água, luz, gás, corantes, plástico filme e outros itens difíceis de mensurar individualmente.</p>
          <div className="ft-cv-row">
            <div className="ft-field" style={{ flex: 1 }}>
              <label>Percentual sobre o CMV</label>
              <div className="ft-input-suffix">
                <input type="number" min="0" max="100" step="1" placeholder="25" value={extras.cv_percentual} onChange={e => setExtras(s => ({ ...s, cv_percentual: e.target.value }))} />
                <span>%</span>
              </div>
            </div>
            <div className="ft-cv-result">
              <span className="ft-cv-result-label">= R$ {fmt(cvLive)}</span>
            </div>
          </div>
          <p className="ft-cv-hint">Ideal: 25% — cobre gastos indiretos de produção</p>
        </div>

        {/* Mão de obra */}
        <div className="ft-section-header">
          <h2 className="ft-section-title">Mão de obra</h2>
        </div>
        <div className="ft-edit-card">
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
        </div>

        {/* Detalhes extras */}
        <div className="ft-section-header">
          <h2 className="ft-section-title">Informações do produto</h2>
        </div>
        <div className="ft-extras-edit">
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

        

        <button className="ft-btn-salvar" onClick={salvarFicha} disabled={saving}>
          {saving ? "Salvando..." : "Salvar precificação"}
        </button>

        {savedToast && <div className="ft-toast">Ficha técnica salva!</div>}

        <style>{detailStyles}</style>
      </div>
    );
  }

  /* LIST VIEW */
  return (
    <div className="ft-root">
      <div className="ft-list-header">
        <div>
          <h1 className="ft-list-title">Precificação Inteligente</h1>
          <p className="ft-list-sub">{totalComFicha} de {produtos.length} produto{produtos.length !== 1 ? "s" : ""} precificado{totalComFicha !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="ft-list-toolbar">
        <div className="ft-list-busca">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div className="ft-list-filtros">
          {(["todos", "com", "sem"] as const).map(f => (
            <button key={f} className={`ft-filtro-btn${filtro === f ? " active" : ""}`} onClick={() => setFiltro(f)}>
              {{ todos: "Todos", com: "Precificados", sem: "Sem preço" }[f]}
            </button>
          ))}
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
  );
}

const listStyles = `
  .ft-root { font-family: var(--font-base); max-width: 800px; display: flex; flex-direction: column; gap: 1rem; }

  .ft-list-header { display: flex; align-items: center; justify-content: space-between; }
  .ft-list-title { font-size: var(--font-page-title); font-weight: var(--fw-bold); color: var(--text-title); margin: 0 0 2px; }
  .ft-list-sub { font-size: var(--font-helper); color: var(--text-muted); margin: 0; }

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
  .ft-root {
    font-family: var(--font-base); max-width: 600px;
    display: flex; flex-direction: column; gap: 1rem;
    --ft-line: var(--border);
  }

  .ft-back {
    display: inline-flex; align-items: center; gap: 6px; padding: 0;
    background: none; border: none; font-family: var(--font-base);
    font-size: var(--font-body); font-weight: var(--fw-medium);
    color: var(--text-secondary); cursor: pointer;
  }

  .ft-tree {
    display: flex; flex-direction: column; align-items: center;
    background: var(--bg-card); border-radius: var(--radius-lg);
    padding: 1.25rem 1rem 1.5rem;
    box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06));
  }
  .ft-tree-foto {
    width: 170px; height: 170px; border-radius: 50%; overflow: hidden;
    background: var(--bg-subtle); flex-shrink: 0;
    border: 4px solid var(--primary);
    box-shadow: 0 0 0 4px var(--primary-light);
  }
  .ft-tree-foto img { width: 100%; height: 100%; object-fit: cover; }
  .ft-tree-foto-placeholder {
    width: 100%; height: 100%; display: flex; align-items: center;
    justify-content: center; font-size: var(--font-caption); color: var(--text-muted);
  }
  .ft-tree-titulo { text-align: center; margin-top: 0.85rem; }
  .ft-tree-nome {
    font-size: var(--font-section-title); font-weight: var(--fw-bold);
    color: var(--text-title); margin: 0; line-height: 1.2;
  }
  .ft-tree-sub {
    font-size: var(--font-caption); color: var(--text-muted); margin: 4px 0 0;
  }

  /* Lucro hero */
  .ft-lucro-hero {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    background: var(--bg-card); border-radius: var(--radius-lg);
    padding: 1.25rem 1rem; box-shadow: var(--shadow-card);
  }
  .ft-lucro-hero-label { font-size: var(--font-caption); color: var(--text-muted); text-transform: uppercase; letter-spacing: var(--ls-wide); font-weight: var(--fw-semibold); }
  .ft-lucro-hero-value { font-size: var(--font-stat-value); font-weight: var(--fw-bold); color: var(--success); line-height: 1.2; }
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

  .ft-section-header { display: flex; align-items: center; justify-content: space-between; }
  .ft-section-title {
    font-size: var(--font-section-label); font-weight: var(--fw-bold);
    color: var(--text-title); margin: 0;
    text-transform: uppercase; letter-spacing: var(--ls-wide);
  }
  .ft-section-cmv {
    font-size: var(--font-caption); color: var(--primary); font-weight: var(--fw-bold);
    background: var(--primary-light); padding: 3px 10px; border-radius: var(--radius-full);
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
    display: flex; flex-direction: column; gap: 0.6rem;
    padding: 0.85rem; background: var(--bg-subtle); border-radius: var(--radius-lg);
  }

  .ft-edit-item-top { display: flex; align-items: center; gap: 0.6rem; }
  .ft-edit-item-img {
    width: 44px; height: 44px; border-radius: var(--radius-md); object-fit: cover; flex-shrink: 0;
  }
  .ft-edit-item-img--ph {
    display: flex; align-items: center; justify-content: center;
    background: var(--primary-light); color: var(--primary);
    font-weight: var(--fw-bold); font-size: var(--font-body);
  }
  .ft-edit-item-info { flex: 1; min-width: 0; }
  .ft-edit-item-nome { font-size: var(--font-body); font-weight: var(--fw-semibold); color: var(--text-title); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ft-edit-item-sub { font-size: var(--font-caption); color: var(--text-muted); margin: 2px 0 0; }
  .ft-edit-item-del {
    width: 24px; height: 24px; flex-shrink: 0; background: transparent; border: none;
    border-radius: var(--radius-md); color: var(--text-muted); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    opacity: 0.4; transition: all var(--dur-fast) var(--ease-out);
  }
  .ft-edit-item-del:active { opacity: 1; color: var(--error); }

  .ft-edit-item-bottom { display: flex; flex-direction: column; gap: 5px; }
  .ft-edit-item-label {
    font-size: var(--font-caption); text-transform: uppercase; letter-spacing: var(--ls-wide);
    color: var(--text-secondary); font-weight: var(--fw-semibold); margin: 0;
  }
  .ft-edit-item-row { display: flex; align-items: center; gap: 8px; }
  .ft-edit-item-input-group {
    flex: 1; display: flex; align-items: stretch;
    border: 1.5px solid var(--primary-dark); border-radius: var(--radius-md);
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
    font-size: var(--font-caption); font-weight: var(--fw-bold);
    color: var(--text-inverse); background: var(--primary-dark);
    cursor: pointer; -webkit-appearance: none; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 8px center;
    padding-right: 1.6rem;
  }
  .ft-edit-item-unit-fixed {
    padding: 0 0.7rem; font-size: var(--font-caption); font-weight: var(--fw-bold);
    color: var(--text-inverse); background: var(--primary-dark);
    white-space: nowrap; display: flex; align-items: center;
  }
  .ft-edit-item-custo { display: flex; align-items: center; gap: 4px; flex-shrink: 0; min-width: 90px; justify-content: flex-end; }
  .ft-edit-item-custo-eq { font-size: var(--font-caption); color: var(--text-muted); }
  .ft-edit-item-custo-val { font-size: var(--font-body); font-weight: var(--fw-bold); color: var(--text-title); white-space: nowrap; text-align: right; }

  .ft-add { display: flex; flex-direction: column; gap: 0.4rem; }
  .ft-add-label { font-size: var(--font-field-label); color: var(--text-secondary); font-weight: var(--fw-semibold); }
  .ft-add-input {
    padding: 0.55rem 0.7rem; border: 1.5px solid var(--border); border-radius: var(--radius-md);
    font-family: var(--font-base); font-size: var(--font-body); background: var(--bg-card); color: var(--text-primary); outline: none;
  }
  .ft-add-input:focus { border-color: var(--primary); }
  .ft-add-results { display: flex; flex-direction: column; gap: 0.3rem; }
  .ft-add-result {
    display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem;
    background: var(--bg-card); border: 1.5px solid var(--border); border-radius: var(--radius-md); cursor: pointer;
    transition: border-color var(--dur-fast, 0.15s) var(--ease-out, ease);
  }
  .ft-add-result:hover { border-color: var(--primary); }
  .ft-add-result-img { width: 32px; height: 32px; border-radius: var(--radius-md); object-fit: cover; flex-shrink: 0; }
  .ft-add-result-img--ph {
    display: flex; align-items: center; justify-content: center;
    background: var(--primary-light); color: var(--primary); font-weight: var(--fw-bold); font-size: var(--font-caption);
  }
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

  .ft-extras-edit {
    background: var(--bg-card); border-radius: var(--radius-md); padding: 0.85rem;
    box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06));
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.65rem;
  }
  .ft-field { display: flex; flex-direction: column; gap: var(--space-1); grid-column: 1 / -1; min-width: 0; justify-content: flex-end; }
  .ft-field--half { grid-column: span 1; }
  .ft-field label { font-size: var(--font-field-label); color: var(--text-secondary); font-weight: var(--fw-semibold); }
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

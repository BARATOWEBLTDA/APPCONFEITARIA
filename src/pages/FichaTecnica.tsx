import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import EmptyDoo from "@/components/EmptyDoo";
import QuickAddInsumo, { InsumoQuick } from "@/components/QuickAddInsumo";

type InsumoJoin = {
  quantidade: number;
  insumos: {
    id: string;
    nome: string;
    unidade: string;
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
  produto_insumos: InsumoJoin[];
};

type Insumo = {
  id: string;
  nome: string;
  unidade: string;
  custo_unitario: number;
  imagem_url?: string;
};

type FichaItem = { insumo_id: string; quantidade: number; insumo: Insumo };

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v: number) => v.toFixed(1).replace(".", ",");

function calcular(p: Produto) {
  const itens = p.produto_insumos || [];
  const cmv = itens.reduce((s, pi) => s + (Number(pi.quantidade) || 0) * (Number(pi.insumos?.custo_unitario) || 0), 0);
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
  const [extras, setExtras] = useState({ rendimento_qtd: "", rendimento_peso: "", validade_dias: "", validade_tipo: "refrigerado", embalagem: "", observacoes_ficha: "" });
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const loadProdutos = async (uid: string) => {
    const { data } = await supabase
      .from("produtos")
      .select("*, produto_insumos(quantidade, insumos(id, nome, unidade, custo_unitario, imagem_url))")
      .eq("user_id", uid)
      .order("nome");
    if (data) setProdutos(data as Produto[]);
  };

  const loadInsumos = async (uid: string) => {
    const { data } = await supabase.from("insumos").select("id, nome, unidade, custo_unitario, imagem_url").eq("user_id", uid).order("nome");
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
      insumo: pi.insumos,
    })));
    setExtras({
      rendimento_qtd: p.rendimento_qtd || "",
      rendimento_peso: p.rendimento_peso || "",
      validade_dias: p.validade_dias ? String(p.validade_dias) : "",
      validade_tipo: p.validade_tipo || "refrigerado",
      embalagem: p.embalagem || "",
      observacoes_ficha: p.observacoes_ficha || "",
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
    setFicha(prev => [...prev, { insumo_id: ins.id, quantidade: 0, insumo: ins }]);
    setBuscaInsumo("");
  };
  const removeInsumo = (id: string) => setFicha(prev => prev.filter(f => f.insumo_id !== id));
  const setQtd = (id: string, qtd: number) => setFicha(prev => prev.map(f => f.insumo_id === id ? { ...f, quantidade: qtd } : f));

  const handleInsumoSalvo = (novo: InsumoQuick) => {
    const ins: Insumo = { id: novo.id, nome: novo.nome, unidade: novo.unidade, custo_unitario: novo.custo_unitario, imagem_url: novo.imagem_url };
    setInsumosCadastrados(prev => [...prev, ins]);
    setFicha(prev => [...prev, { insumo_id: ins.id, quantidade: 0, insumo: ins }]);
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
      .map(f => ({ user_id: userId, produto_id: selected.id, insumo_id: f.insumo_id, quantidade: f.quantidade }));
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
      updated_at: new Date().toISOString(),
    }).eq("id", selected.id);

    // 3. Recarrega e atualiza o produto selecionado
    await loadProdutos(userId);
    const { data } = await supabase
      .from("produtos")
      .select("*, produto_insumos(quantidade, insumos(id, nome, unidade, custo_unitario, imagem_url))")
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
    const cmvLive = ficha.reduce((s, f) => s + f.quantidade * (f.insumo?.custo_unitario || 0), 0);
    const precoLive = (selected.promocao && selected.preco_promocional && selected.preco_promocional > 0) ? Number(selected.preco_promocional) : Number(selected.preco_normal) || 0;
    const lucroLive = precoLive - cmvLive;
    const margemCmvLive = precoLive > 0 ? (cmvLive / precoLive) * 100 : 0;
    const margemLucroLive = precoLive > 0 ? (lucroLive / precoLive) * 100 : 0;
    const temFicha = ficha.length > 0;

    return (
      <div className="ft-root">
        <button className="ft-back" onClick={fecharFicha}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Voltar
        </button>

        {/* Arvore */}
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

          <svg className="ft-conector ft-conector--top" viewBox="0 0 300 48" preserveAspectRatio="none" aria-hidden="true">
            <path d="M150 0 L150 14 Q150 24 140 24 L85 24 Q75 24 75 34 L75 48 M150 14 Q150 24 160 24 L215 24 Q225 24 225 34 L225 48"
              fill="none" stroke="var(--ft-line)" strokeWidth="2" />
          </svg>

          <div className="ft-tree-duo">
            <div className="ft-node ft-node--cmv">
              <div className="ft-node-icon ft-node-icon--cmv">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              </div>
              <span className="ft-node-label">CMV</span>
              <strong className="ft-node-valor">R$ {fmt(cmvLive)}</strong>
              <span className="ft-node-sub">{temFicha ? `${fmtPct(margemCmvLive)}% do preço de venda` : "Sem ingredientes"}</span>
            </div>
            <div className="ft-node ft-node--lucro">
              <div className="ft-node-icon ft-node-icon--lucro">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              </div>
              <span className="ft-node-label">Lucro</span>
              <strong className="ft-node-valor">R$ {fmt(lucroLive)}</strong>
              <span className="ft-node-sub">{temFicha ? `${fmtPct(margemLucroLive)}% do preço de venda` : "Estimado sem custos"}</span>
            </div>
          </div>

          <svg className="ft-conector ft-conector--bottom" viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true">
            <path d="M75 0 L75 10 Q75 20 85 20 L140 20 Q150 20 150 30 L150 40 M225 0 L225 10 Q225 20 215 20 L160 20 Q150 20 150 30 L150 40"
              fill="none" stroke="var(--ft-line)" strokeWidth="2" />
          </svg>

          <div className="ft-node ft-node--preco">
            <div className="ft-node-icon ft-node-icon--preco">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
            </div>
            <div className="ft-node-preco-text">
              <span className="ft-node-label">Preço de venda sugerido</span>
              <strong className="ft-node-valor ft-node-valor--lg">R$ {fmt(precoLive)}</strong>
            </div>
          </div>
        </div>

        {/* Editor da Composicao */}
        <div className="ft-section-header">
          <h2 className="ft-section-title">Composição do produto</h2>
          {temFicha && <span className="ft-section-cmv">CMV R$ {fmt(cmvLive)}</span>}
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
                const custoLinha = f.quantidade * (ins.custo_unitario || 0);
                return (
                  <div key={f.insumo_id} className="ft-edit-item">
                    {ins.imagem_url
                      ? <img src={ins.imagem_url} alt={ins.nome} className="ft-edit-item-img" />
                      : <div className="ft-edit-item-img ft-edit-item-img--ph">{ins.nome.charAt(0).toUpperCase()}</div>}
                    <div className="ft-edit-item-info">
                      <p className="ft-edit-item-nome">{ins.nome}</p>
                      <p className="ft-edit-item-sub">R$ {(ins.custo_unitario || 0).toFixed(4)} / {ins.unidade}</p>
                    </div>
                    <div className="ft-edit-item-qtd">
                      <input
                        type="number" value={f.quantidade || ""} step="any" min="0" placeholder="0"
                        onChange={e => setQtd(f.insumo_id, parseFloat(e.target.value) || 0)}
                      />
                      <span>{ins.unidade}</span>
                    </div>
                    <div className="ft-edit-item-custo">R$ {custoLinha.toFixed(2)}</div>
                    <button className="ft-edit-item-del" onClick={() => removeInsumo(f.insumo_id)} aria-label="Remover">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Adicionar ingrediente */}
          {!showQuickAdd ? (
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
                          <p className="ft-edit-item-sub">R$ {(i.custo_unitario || 0).toFixed(4)} / {i.unidade}</p>
                        </div>
                      </button>
                    ))}
                  <button type="button" className="ft-add-novo" onClick={() => { setQuickAddName(buscaInsumo); setShowQuickAdd(true); }}>
                    Cadastrar "{buscaInsumo}" como novo insumo
                  </button>
                </div>
              )}
              {!buscaInsumo.trim() && (
                <button type="button" className="ft-add-novo ft-add-novo--solo" onClick={() => { setQuickAddName(""); setShowQuickAdd(true); }}>
                  Cadastrar novo insumo
                </button>
              )}
            </div>
          ) : (
            <QuickAddInsumo
              userId={userId}
              initialName={quickAddName}
              onSaved={handleInsumoSalvo}
              onCancel={() => { setShowQuickAdd(false); setQuickAddName(""); }}
            />
          )}
        </div>

        {/* Detalhes extras */}
        <div className="ft-section-header">
          <h2 className="ft-section-title">Detalhes</h2>
        </div>
        <div className="ft-extras-edit">
          <div className="ft-field ft-field--half">
            <label>Rendimento (qtd)</label>
            <input type="text" placeholder="Ex: 1 unidade" value={extras.rendimento_qtd} onChange={e => setExtras(s => ({ ...s, rendimento_qtd: e.target.value }))} />
          </div>
          <div className="ft-field ft-field--half">
            <label>Rendimento (peso)</label>
            <input type="text" placeholder="Ex: 1,2 kg" value={extras.rendimento_peso} onChange={e => setExtras(s => ({ ...s, rendimento_peso: e.target.value }))} />
          </div>
          <div className="ft-field ft-field--half">
            <label>Validade (dias)</label>
            <input type="number" min="0" placeholder="Ex: 5" value={extras.validade_dias} onChange={e => setExtras(s => ({ ...s, validade_dias: e.target.value }))} />
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
            <input type="text" placeholder="Ex: Caixa plástica redonda" value={extras.embalagem} onChange={e => setExtras(s => ({ ...s, embalagem: e.target.value }))} />
          </div>
          <div className="ft-field">
            <label>Observações</label>
            <textarea rows={2} placeholder="Ex: Manter refrigerado. Produto artesanal." value={extras.observacoes_ficha} onChange={e => setExtras(s => ({ ...s, observacoes_ficha: e.target.value }))} />
          </div>
        </div>

        <p className="ft-disclaimer">Os custos unitários podem variar conforme fornecedor e região.</p>

        <button className="ft-btn-salvar" onClick={salvarFicha} disabled={saving}>
          {saving ? "Salvando..." : "Salvar ficha técnica"}
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
          <h1 className="ft-list-title">Fichas Técnicas</h1>
          <p className="ft-list-sub">{totalComFicha} de {produtos.length} produto{produtos.length !== 1 ? "s" : ""} com ficha</p>
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
              {{ todos: "Todos", com: "Com ficha", sem: "Sem ficha" }[f]}
            </button>
          ))}
        </div>
      </div>

      {produtos.length > 0 && (
        <div className="ft-progress-wrap">
          <div className="ft-progress-bar">
            <div className="ft-progress-fill" style={{ width: `${produtos.length > 0 ? (totalComFicha / produtos.length) * 100 : 0}%` }} />
          </div>
          <span className="ft-progress-label">{totalComFicha}/{produtos.length} fichas completas</span>
        </div>
      )}

      {filtrados.length === 0 ? (
        <EmptyDoo
          image="produtos.png"
          title="Nenhum produto encontrado"
          description={filtro === "sem" ? "Todos os produtos já possuem ficha técnica." : "Cadastre produtos para criar fichas técnicas."}
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
                    <span className="ft-list-card-sem">Sem ficha técnica</span>
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
    padding: 0.3rem 0.65rem; border: 1.5px solid var(--border); border-radius: var(--radius-sm);
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
    font-size: 0.65rem; font-weight: var(--fw-bold); color: white;
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
  .ft-list-card-cmv { display: flex; flex-direction: column; gap: 1px; font-size: 0.65rem; color: var(--text-muted); }
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
    width: 190px; height: 190px; border-radius: 50%; overflow: hidden;
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

  .ft-conector { width: 100%; max-width: 340px; display: block; }
  .ft-conector--top { height: 44px; margin-top: 0.85rem; }
  .ft-conector--bottom { height: 36px; }

  .ft-tree-duo { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; width: 100%; max-width: 340px; }

  .ft-node {
    position: relative; background: var(--bg-card);
    border: 1.5px solid var(--ft-line); border-radius: var(--radius-md);
    padding: 0.85rem 0.75rem; display: flex; flex-direction: column;
    align-items: center; text-align: center; gap: 2px;
  }
  .ft-node-icon {
    width: 38px; height: 38px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 4px; flex-shrink: 0;
  }
  .ft-node-icon--cmv { background: #8a5a2b; }
  .ft-node-icon--lucro { background: var(--success); }
  .ft-node-icon--preco { background: var(--primary); }
  .ft-node-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); font-weight: var(--fw-bold); }
  .ft-node-valor { font-size: var(--font-input); font-weight: var(--fw-bold); color: var(--text-title); }
  .ft-node-valor--lg { font-size: var(--font-section-title); }
  .ft-node-sub { font-size: 0.65rem; color: var(--text-muted); line-height: 1.3; }
  .ft-node--cmv { border-color: #d9b78e; }
  .ft-node--lucro { border-color: #b6d6b8; }

  .ft-node--preco {
    flex-direction: row; align-items: center; gap: 0.75rem;
    width: 100%; max-width: 300px; border-color: var(--primary);
    background: var(--primary-light);
  }
  .ft-node--preco .ft-node-icon { margin-bottom: 0; }
  .ft-node-preco-text { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; }
  .ft-node--preco .ft-node-label { color: var(--primary); }
  .ft-node--preco .ft-node-valor { color: var(--primary); }

  .ft-section-header { display: flex; align-items: center; justify-content: space-between; }
  .ft-section-title {
    font-weight: var(--fw-bold); color: var(--text-title); margin: 0;
    text-transform: uppercase; letter-spacing: 0.03em; font-size: 0.75rem;
  }
  .ft-section-cmv { font-size: var(--font-caption); color: var(--text-muted); font-weight: var(--fw-semibold); }

  .ft-edit-card {
    background: var(--bg-card); border-radius: var(--radius-md);
    padding: 0.85rem; box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06));
    display: flex; flex-direction: column; gap: 0.75rem;
  }
  .ft-edit-empty { text-align: center; padding: 1rem 0.5rem; }
  .ft-edit-empty-title { font-size: var(--font-body); font-weight: var(--fw-bold); color: var(--text-title); margin: 0 0 2px; }
  .ft-edit-empty-sub { font-size: var(--font-caption); color: var(--text-muted); margin: 0; line-height: 1.4; }

  .ft-edit-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .ft-edit-item {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.5rem; background: var(--bg-subtle); border-radius: var(--radius-sm);
  }
  .ft-edit-item-img {
    width: 38px; height: 38px; border-radius: var(--radius-sm); object-fit: cover; flex-shrink: 0;
  }
  .ft-edit-item-img--ph {
    display: flex; align-items: center; justify-content: center;
    background: var(--primary-light); color: var(--primary);
    font-weight: var(--fw-bold); font-size: var(--font-body);
  }
  .ft-edit-item-info { flex: 1; min-width: 0; }
  .ft-edit-item-nome { font-size: var(--font-caption); font-weight: var(--fw-semibold); color: var(--text-title); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ft-edit-item-sub { font-size: 0.65rem; color: var(--text-muted); margin: 0; }
  .ft-edit-item-qtd { display: flex; align-items: center; gap: 3px; flex-shrink: 0; }
  .ft-edit-item-qtd input {
    width: 52px; padding: 0.3rem 0.4rem; border: 1.5px solid var(--border); border-radius: var(--radius-sm);
    font-family: var(--font-base); font-size: var(--font-caption); text-align: right; background: var(--bg-card); color: var(--text-primary);
  }
  .ft-edit-item-qtd span { font-size: 0.65rem; color: var(--text-muted); }
  .ft-edit-item-custo { font-size: var(--font-caption); font-weight: var(--fw-bold); color: var(--text-title); min-width: 56px; text-align: right; }
  .ft-edit-item-del {
    width: 26px; height: 26px; flex-shrink: 0; background: #fff1f2; border: none;
    border-radius: var(--radius-sm); color: var(--error); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }

  .ft-add { display: flex; flex-direction: column; gap: 0.4rem; }
  .ft-add-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); font-weight: var(--fw-semibold); }
  .ft-add-input {
    padding: 0.55rem 0.7rem; border: 1.5px solid var(--border); border-radius: var(--radius-sm);
    font-family: var(--font-base); font-size: var(--font-body); background: var(--bg-card); color: var(--text-primary); outline: none;
  }
  .ft-add-input:focus { border-color: var(--primary); }
  .ft-add-results { display: flex; flex-direction: column; gap: 0.3rem; }
  .ft-add-result {
    display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem;
    background: var(--bg-subtle); border: none; border-radius: var(--radius-sm); cursor: pointer;
  }
  .ft-add-result-img { width: 32px; height: 32px; border-radius: var(--radius-sm); object-fit: cover; flex-shrink: 0; }
  .ft-add-result-img--ph {
    display: flex; align-items: center; justify-content: center;
    background: var(--primary-light); color: var(--primary); font-weight: var(--fw-bold); font-size: var(--font-caption);
  }
  .ft-add-novo {
    padding: 0.5rem; background: var(--primary-light); border: 1px dashed var(--primary);
    border-radius: var(--radius-sm); color: var(--primary); font-family: var(--font-base);
    font-size: var(--font-caption); font-weight: var(--fw-semibold); cursor: pointer; text-align: center;
  }
  .ft-add-novo--solo { background: transparent; }

  .ft-extras-edit {
    background: var(--bg-card); border-radius: var(--radius-md); padding: 0.85rem;
    box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06));
    display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem;
  }
  .ft-field { display: flex; flex-direction: column; gap: 0.25rem; grid-column: 1 / -1; }
  .ft-field--half { grid-column: span 1; }
  .ft-field label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); font-weight: var(--fw-semibold); }
  .ft-field input, .ft-field select, .ft-field textarea {
    padding: 0.5rem 0.6rem; border: 1.5px solid var(--border); border-radius: var(--radius-sm);
    font-family: var(--font-base); font-size: var(--font-caption); background: var(--bg-card);
    color: var(--text-primary); outline: none; resize: none;
  }
  .ft-field input:focus, .ft-field select:focus, .ft-field textarea:focus { border-color: var(--primary); }

  .ft-disclaimer { font-size: 0.65rem; color: var(--text-muted); text-align: center; margin: 0; font-style: italic; }

  .ft-btn-salvar {
    width: 100%; padding: 0.8rem; background: var(--primary);
    color: var(--text-inverse); border: none; border-radius: var(--radius-md);
    font-family: var(--font-base); font-size: var(--font-button);
    font-weight: var(--fw-bold); cursor: pointer;
  }
  .ft-btn-salvar:disabled { opacity: 0.6; cursor: default; }

  .ft-toast {
    position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);
    background: var(--success); color: white; padding: 0.6rem 1.2rem;
    border-radius: var(--radius-full); font-size: var(--font-caption); font-weight: var(--fw-bold);
    box-shadow: 0 4px 16px rgba(0,0,0,0.2); z-index: 999;
  }
`;

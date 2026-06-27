import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import EmptyDoo from "@/components/EmptyDoo";
import BtnNovo from "@/components/BtnNovo";
import QuickAddInsumo, { InsumoQuick } from "@/components/QuickAddInsumo";

interface Insumo {
  id: string;
  nome: string;
  marca: string;
  categoria: string;
  unidade: string;
  embalagem_tipo: string;
  valor_compra: number;
  qtd_embalagem: number;
  custo_unitario: number;
  imagem_url: string;
}

const CATEGORIAS_DEFAULT = ["Ingredientes", "Embalagens", "Decorações", "Bebidas", "Limpeza", "Descartáveis", "Outros"];

export default function Insumos() {
  const [userId, setUserId] = useState<string | null>(null);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_DEFAULT);
  const [showCatDropdown, setShowCatDropdown] = useState(false);

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Insumo | null>(null);

  // ── Carrega usuário, insumos e categorias ──
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (cancel) return;
      setUserId(user.id);
      await loadInsumos(user.id);
      const { data: cats } = await supabase.from("insumo_categorias").select("nome").or(`is_default.eq.true,user_id.eq.${user.id}`).order("nome");
      if (!cancel && cats && cats.length > 0) {
        setCategorias([...new Set([...CATEGORIAS_DEFAULT, ...cats.map((c: any) => c.nome)])]);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const loadInsumos = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase.from("insumos").select("*").eq("user_id", uid).order("nome");
    setInsumos((data as Insumo[]) || []);
    setLoading(false);
  };

  // ── Filtros aplicados ──
  const filtrados = insumos.filter(i => {
    const matchBusca = !busca.trim() || (
      i.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (i.marca || "").toLowerCase().includes(busca.toLowerCase())
    );
    const matchCat = filtroCategoria === "Todas" || i.categoria === filtroCategoria;
    return matchBusca && matchCat;
  });

  // ── Handlers ──
  const abrirNovo = () => {
    setEditingInsumo(null);
    setShowQuickAdd(true);
  };
  const abrirEditar = (insumo: Insumo) => {
    setEditingInsumo(insumo);
    setShowQuickAdd(true);
  };
  const fecharForm = () => {
    setShowQuickAdd(false);
    setEditingInsumo(null);
  };
  const onInsumoSalvo = async (_insumo: InsumoQuick) => {
    if (userId) await loadInsumos(userId);
    fecharForm();
  };
  const confirmarDelete = async () => {
    if (!deleteConfirm || !userId) return;
    await supabase.from("insumos").delete().eq("id", deleteConfirm.id);
    setDeleteConfirm(null);
    await loadInsumos(userId);
  };

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const formatCustoUnit = (v: number) => {
    // 2 casas no caso comum; mais precisão só quando o valor é muito pequeno
    // (insumos a granel onde custo/unidade fica abaixo de 1 centavo)
    const casas = v >= 0.1 ? 2 : v >= 0.01 ? 3 : 4;
    return `R$ ${v.toFixed(casas).replace(".", ",")}`;
  };
  /**
   * Calcula o valor de exibição numa escala que se adapta ao tamanho da embalagem,
   * para evitar números muito pequenos (R$ 0,005 por g).
   *
   *  Peso:    kg/g  → escala em g  (100g se total ≥ 1kg, 10g se ≥ 100g, 1g se < 100g)
   *  Volume:  L/ml  → escala em ml (mesma lógica)
   *  Outros:  un, etc. → sempre 1 unidade
   */
  const custoExibicao = (
    custo_unitario: number,
    unidade: string,
    qtd_embalagem: number
  ): { quantidade: number; valor: number; unidade: string } => {
    // Normaliza pra unidade base (g, ml ou própria)
    let custoBase = custo_unitario;
    let unidadeBase = unidade;
    let totalBase = qtd_embalagem || 1;

    if (unidade === "kg") {
      custoBase = custo_unitario / 1000;
      unidadeBase = "g";
      totalBase = (qtd_embalagem || 1) * 1000;
    } else if (unidade === "L") {
      custoBase = custo_unitario / 1000;
      unidadeBase = "ml";
      totalBase = (qtd_embalagem || 1) * 1000;
    }

    // Pra un, pct, cx, Lata etc. não tem escala
    if (unidadeBase !== "g" && unidadeBase !== "ml") {
      return { quantidade: 1, valor: custoBase, unidade: unidadeBase };
    }

    // Escala adaptativa em potências de 10
    let escala = 1;
    if (totalBase >= 1000) escala = 100;
    else if (totalBase >= 100) escala = 10;

    return { quantidade: escala, valor: custoBase * escala, unidade: unidadeBase };
  };

  // ── Empty state ──
  if (!loading && insumos.length === 0) {
    return (
      <div className="ins-root">
        <div className="ins-header">
          <div className="ins-header-text">
            <h1 className="ins-title">Insumos</h1>
            <p className="ins-sub">0 insumos cadastrados</p>
          </div>
        </div>

        <EmptyDoo
          image="ingredientes.png"
          title="Vamos cadastrar seu primeiro insumo?"
          description="Cadastre ingredientes, embalagens e tudo mais que você usa pra produzir. Vamos calcular o custo automaticamente."
          actionLabel="Cadastrar insumo"
          onAction={abrirNovo}
        />

        {showQuickAdd && userId && (
          <div className="ins-overlay" onClick={fecharForm}>
            <div className="ins-form-modal" onClick={e => e.stopPropagation()}>
              <QuickAddInsumo
                userId={userId}
                onSaved={onInsumoSalvo}
                onCancel={fecharForm}
              />
            </div>
          </div>
        )}

        <Styles />
      </div>
    );
  }

  return (
    <div className="ins-root">
      {/* Header */}
      <div className="ins-header">
        <div className="ins-header-text">
          <h1 className="ins-title">Insumos</h1>
          <p className="ins-sub">{insumos.length} {insumos.length === 1 ? "insumo cadastrado" : "insumos cadastrados"}</p>
        </div>
        <BtnNovo label="Cadastrar insumo" onClick={abrirNovo} responsive={false} />
      </div>

      {/* Busca */}
      <div className="ins-toolbar">
        <div className="ins-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            type="text"
            placeholder="Buscar por nome ou marca..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
      </div>

      {/* Filtros por categoria — chips no desktop, dropdown no mobile */}
      <div className="ins-filtros ins-filtros--desktop">
        {["Todas", ...categorias].map(cat => (
          <button key={cat} className={"ins-filtro-btn" + (filtroCategoria === cat ? " active" : "")} onClick={() => setFiltroCategoria(cat)}>{cat}</button>
        ))}
      </div>

      <div className="ins-cat-dropdown">
        <button
          className="ins-cat-dropdown-trigger"
          onClick={() => setShowCatDropdown(s => !s)}
          aria-expanded={showCatDropdown}
        >
          <span className="ins-cat-dropdown-label">
            <span className="ins-cat-dropdown-tag">Categoria</span>
            <span className="ins-cat-dropdown-value">{filtroCategoria}</span>
          </span>
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: showCatDropdown ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        {showCatDropdown && (
          <>
            <div className="ins-cat-dropdown-backdrop" onClick={() => setShowCatDropdown(false)} />
            <div className="ins-cat-dropdown-list" role="listbox">
              {["Todas", ...categorias].map(cat => (
                <button
                  key={cat}
                  className={"ins-cat-dropdown-item" + (filtroCategoria === cat ? " is-active" : "")}
                  onClick={() => { setFiltroCategoria(cat); setShowCatDropdown(false); }}
                >
                  {cat}
                  {filtroCategoria === cat && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="ins-loading">
          <div className="ins-spinner" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="ins-no-results">
          <p>Nenhum insumo encontrado.</p>
          {(busca || filtroCategoria !== "Todas") && (
            <button onClick={() => { setBusca(""); setFiltroCategoria("Todas"); }}>Limpar filtros</button>
          )}
        </div>
      ) : (
        <div className="ins-list">
          {filtrados.map(i => {
            const exib = custoExibicao(i.custo_unitario || 0, i.unidade, i.qtd_embalagem || 1);
            const labelQtd = exib.quantidade === 1 ? exib.unidade : `${exib.quantidade}${exib.unidade}`;
            return (
            <div key={i.id} className="ins-item">
              <div className="ins-item-media">
                {i.imagem_url
                  ? <img src={i.imagem_url} alt={i.nome} className="ins-item-img" />
                  : <div className="ins-item-img ins-item-img--placeholder">🥣</div>}
                <button className="ins-item-edit" onClick={() => abrirEditar(i)} aria-label="Editar" title="Editar">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Editar
                </button>
              </div>

              <div className="ins-item-info">
                <p className="ins-item-nome">{i.nome}</p>
                {i.marca && <p className="ins-item-line">Marca: {i.marca}</p>}
                <p className="ins-item-line">
                  Preço médio: {formatCurrency(i.valor_compra || 0)} / {i.qtd_embalagem || 1} {i.unidade}{i.embalagem_tipo && i.embalagem_tipo !== "Avulso" ? ` (${i.embalagem_tipo})` : ""}
                </p>
                <p className="ins-item-custo">Valor por {labelQtd}: {formatCustoUnit(exib.valor)}</p>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Modal do form (criar/editar) */}
      {showQuickAdd && userId && (
        <div className="ins-overlay" onClick={fecharForm}>
          <div className="ins-form-modal" onClick={e => e.stopPropagation()}>
            <QuickAddInsumo
              userId={userId}
              editing={editingInsumo ? {
                id: editingInsumo.id,
                nome: editingInsumo.nome,
                marca: editingInsumo.marca,
                categoria: editingInsumo.categoria,
                unidade: editingInsumo.unidade,
                embalagem_tipo: editingInsumo.embalagem_tipo,
                custo_unitario: editingInsumo.custo_unitario,
                imagem_url: editingInsumo.imagem_url,
                valor_compra: editingInsumo.valor_compra,
                qtd_embalagem: editingInsumo.qtd_embalagem,
              } : undefined}
              onSaved={onInsumoSalvo}
              onCancel={fecharForm}
            />
          </div>
        </div>
      )}

      {/* Modal de confirmação de delete */}
      {deleteConfirm && (
        <div className="ins-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="ins-confirm" onClick={e => e.stopPropagation()}>
            <p className="ins-confirm-title">Excluir insumo?</p>
            <p className="ins-confirm-sub">"{deleteConfirm.nome}" será removido permanentemente. Esta ação não pode ser desfeita.</p>
            <div className="ins-confirm-btns">
              <button className="ins-btn-cancel" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className="ins-btn-del-confirm" onClick={confirmarDelete}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      <Styles />
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      .ins-root {
        font-family: var(--font-base);
        display: flex; flex-direction: column;
        gap: var(--space-5);
        padding-top: var(--space-7); padding-bottom: var(--space-7);
      }
      .ins-header {
        display: flex; align-items: center; justify-content: space-between;
        gap: var(--space-4);
      }
      .ins-header-text { min-width: 0; flex: 1; }
      .ins-title {
        font-size: var(--text-2xl); font-weight: var(--fw-black);
        color: var(--text-title);
        margin: 0;
      }
      .ins-sub {
        font-size: var(--font-helper); color: var(--text-muted);
        margin: var(--space-1) 0 0;
      }

      .ins-toolbar { display: flex; gap: var(--space-2); }
      .ins-search {
        flex: 1; position: relative;
        display: flex; align-items: center; gap: var(--space-2);
        padding: 0 var(--space-3);
        background: var(--bg-card);
        border: 1.5px solid var(--border);
        border-radius: var(--radius-md);
        color: var(--text-muted);
        transition: border-color var(--dur-fast) var(--ease-out);
      }
      .ins-search input {
        flex: 1; padding: var(--space-3) 0;
        border: none; background: transparent; outline: none;
        font-family: inherit; font-size: var(--font-button);
        color: var(--text-title);
      }
      .ins-search:focus-within { border-color: var(--primary); }

      .ins-filtros { display: flex; gap: var(--space-2); flex-wrap: wrap; }
      .ins-filtro-btn {
        padding: var(--space-2) var(--space-4);
        border: 1.5px solid var(--border);
        border-radius: var(--radius-full);
        background: var(--bg-card);
        font-family: var(--font-base);
        font-size: var(--font-helper); font-weight: var(--fw-medium);
        color: var(--text-secondary);
        cursor: pointer; white-space: nowrap;
        transition: all var(--dur-fast) var(--ease-out);
      }
      .ins-filtro-btn.active {
        border-color: var(--primary);
        color: var(--primary);
        background: var(--primary-light);
        font-weight: var(--fw-bold);
      }

      .ins-cat-dropdown { display: none; position: relative; }
      .ins-cat-dropdown-trigger {
        width: 100%; display: flex; align-items: center; justify-content: space-between;
        gap: var(--space-2); padding: var(--pad-input);
        background: var(--bg-card);
        border: 1.5px solid var(--border);
        border-radius: var(--radius-md);
        font-family: var(--font-base); cursor: pointer;
        color: var(--text-title);
        transition: border-color var(--dur-fast) var(--ease-out);
      }
      .ins-cat-dropdown-trigger:hover { border-color: var(--primary); }
      .ins-cat-dropdown-label { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
      .ins-cat-dropdown-tag {
        font-size: var(--font-caption); font-weight: var(--fw-bold); text-transform: uppercase;
        letter-spacing: var(--ls-wide);
        color: var(--text-muted);
        background: var(--bg-body); padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm);
      }
      .ins-cat-dropdown-value { font-size: var(--font-button); font-weight: var(--fw-bold); }
      .ins-cat-dropdown-backdrop { position: fixed; inset: 0; z-index: 90; background: transparent; }
      .ins-cat-dropdown-list {
        position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 91;
        background: var(--bg-card);
        border: 1.5px solid var(--border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-md);
        max-height: 300px; overflow-y: auto;
        padding: var(--space-1);
      }
      .ins-cat-dropdown-item {
        width: 100%; display: flex; align-items: center; justify-content: space-between;
        padding: var(--space-2) var(--space-3);
        background: transparent; border: none; cursor: pointer;
        font-family: var(--font-base); font-size: var(--font-button); font-weight: var(--fw-medium);
        color: var(--text-title);
        border-radius: var(--radius-sm); text-align: left;
        transition: background var(--dur-fast) var(--ease-out);
      }
      .ins-cat-dropdown-item:hover { background: var(--bg-body); }
      .ins-cat-dropdown-item.is-active {
        background: var(--primary-light);
        color: var(--primary); font-weight: var(--fw-bold);
      }

      /* Lista */
      .ins-list { display: flex; flex-direction: column; gap: var(--space-2); }
      .ins-item {
        display: flex; gap: var(--space-4); align-items: stretch;
        padding: var(--pad-card);
        background: var(--bg-card);
        border: 1.5px solid var(--border);
        border-radius: var(--radius-md);
        transition: border-color var(--dur-fast) var(--ease-out);
      }
      .ins-item:hover { border-color: var(--primary); }
      .ins-item-media {
        display: flex; flex-direction: column; align-items: center;
        gap: var(--space-2);
        flex-shrink: 0;
      }
      .ins-item-img {
        width: 110px; height: 110px;
        border-radius: var(--radius-md); object-fit: cover;
        background: var(--bg-subtle);
      }
      .ins-item-img--placeholder {
        display: flex; align-items: center; justify-content: center; font-size: var(--text-3xl);
      }
      .ins-item-edit {
        display: inline-flex; align-items: center; justify-content: center;
        gap: 4px;
        padding: var(--space-1) var(--space-2);
        background: transparent;
        border: 1.5px solid var(--border);
        border-radius: var(--radius-sm);
        color: var(--text-secondary);
        font-family: var(--font-base);
        font-size: var(--font-caption); font-weight: var(--fw-semibold);
        cursor: pointer;
        transition: all var(--dur-fast) var(--ease-out);
      }
      .ins-item-edit:hover {
        border-color: var(--primary); color: var(--primary); background: var(--primary-light);
      }
      .ins-item-info {
        flex: 1; min-width: 0;
        display: flex; flex-direction: column; gap: 2px;
        padding-top: var(--space-1);
      }
      .ins-item-nome {
        margin: 0; font-size: var(--font-body); font-weight: var(--fw-bold);
        color: var(--text-title);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .ins-item-line {
        margin: 0;
        font-size: var(--font-caption); font-weight: var(--fw-medium);
        font-family: var(--font-base);
        color: var(--text-muted);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .ins-item-custo {
        margin: var(--space-1) 0 0;
        font-size: var(--font-helper); font-weight: var(--fw-bold);
        color: var(--primary);
      }

      .ins-loading {
        display: flex; justify-content: center; padding: var(--space-9) 0;
      }
      .ins-spinner {
        width: 32px; height: 32px;
        border: 3px solid var(--border);
        border-top-color: var(--primary);
        border-radius: var(--radius-full);
        animation: insSpin 0.7s linear infinite;
      }
      @keyframes insSpin { to { transform: rotate(360deg); } }

      .ins-no-results {
        text-align: center; padding: var(--space-7) var(--space-4);
        color: var(--text-muted);
      }
      .ins-no-results p { margin: 0 0 var(--space-3); font-size: var(--font-button); }
      .ins-no-results button {
        background: var(--primary); color: var(--text-inverse);
        border: none; border-radius: var(--radius-sm);
        padding: var(--space-2) var(--space-4);
        font-family: var(--font-base);
        font-size: var(--font-helper); font-weight: var(--fw-semibold);
        cursor: pointer;
        transition: filter var(--dur-fast) var(--ease-out);
      }
      .ins-no-results button:hover { filter: brightness(1.08); }

      /* Overlays */
      .ins-overlay {
        position: fixed; inset: 0; z-index: 200;
        background: var(--bg-overlay);
        backdrop-filter: blur(3px);
        display: flex; align-items: center; justify-content: center;
        padding: var(--space-4);
      }
      .ins-form-modal {
        background: var(--bg-card);
        border-radius: var(--radius-lg); padding: var(--pad-modal);
        width: 100%; max-width: 520px;
        max-height: 92vh; overflow-y: auto;
        box-shadow: var(--shadow-lg);
      }
      .ins-confirm {
        background: var(--bg-card);
        border-radius: var(--radius-lg); padding: var(--space-6);
        width: 100%; max-width: 360px;
        text-align: center;
        box-shadow: var(--shadow-lg);
      }
      .ins-confirm-title {
        margin: 0 0 var(--space-2);
        font-size: var(--font-modal-title); font-weight: var(--fw-black);
        color: var(--text-title);
      }
      .ins-confirm-sub {
        margin: 0 0 var(--space-5);
        font-size: var(--font-button);
        color: var(--text-secondary);
        line-height: var(--lh-normal);
      }
      .ins-confirm-btns { display: flex; gap: var(--space-2); }
      .ins-btn-cancel, .ins-btn-del-confirm {
        flex: 1; padding: var(--space-3);
        border-radius: var(--radius-md);
        font-family: var(--font-base);
        font-size: var(--font-button); font-weight: var(--fw-bold);
        cursor: pointer;
        border: none;
        transition: filter var(--dur-fast) var(--ease-out);
      }
      .ins-btn-cancel {
        background: var(--bg-body);
        color: var(--text-title);
      }
      .ins-btn-del-confirm {
        background: var(--error); color: var(--text-inverse);
      }
      .ins-btn-cancel:hover, .ins-btn-del-confirm:hover { filter: brightness(0.95); }

      @media (max-width: 640px) {
        .ins-root { padding-bottom: 6rem; gap: var(--space-4); }
        .ins-title { font-size: var(--font-page-title); }
        .ins-filtros--desktop { display: none; }
        .ins-cat-dropdown { display: block; }
        .ins-item-img { width: 88px; height: 88px; }
        .ins-item-nome { font-size: var(--font-button); }
      }
    `}</style>
  );
}

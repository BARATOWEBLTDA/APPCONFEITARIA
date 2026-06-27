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
  const formatCustoUnit = (v: number) => `R$ ${v.toFixed(4).replace(".", ",")}`;

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
          {filtrados.map(i => (
            <div key={i.id} className="ins-item">
              {i.imagem_url
                ? <img src={i.imagem_url} alt={i.nome} className="ins-item-img" />
                : <div className="ins-item-img ins-item-img--placeholder">🥣</div>}

              <div className="ins-item-info">
                <p className="ins-item-nome">{i.nome}</p>
                {i.marca && <p className="ins-item-line">Marca: {i.marca}</p>}
                <p className="ins-item-line">
                  {formatCurrency(i.valor_compra || 0)} / {i.qtd_embalagem || 1} {i.unidade}{i.embalagem_tipo && i.embalagem_tipo !== "Avulso" ? ` (${i.embalagem_tipo})` : ""}
                </p>
                <p className="ins-item-custo">{formatCustoUnit(i.custo_unitario || 0)} / {i.unidade}</p>
              </div>

              <div className="ins-item-actions">
                <button className="ins-act-btn" onClick={() => abrirEditar(i)} aria-label="Editar" title="Editar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button className="ins-act-btn ins-act-del" onClick={() => setDeleteConfirm(i)} aria-label="Excluir" title="Excluir">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                </button>
              </div>
            </div>
          ))}
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
        font-family: 'Geist', sans-serif;
        display: flex; flex-direction: column;
        gap: 1.25rem;
        padding-top: 2rem; padding-bottom: 2rem;
      }
      .ins-header {
        display: flex; align-items: center; justify-content: space-between;
        gap: 1rem;
      }
      .ins-header-text { min-width: 0; flex: 1; }
      .ins-title {
        font-size: var(--text-2xl); font-weight: var(--fw-black);
        color: var(--text-title);
        margin: 0;
      }
      .ins-sub {
        font-size: var(--font-helper); color: var(--text-muted);
        margin: 4px 0 0;
      }

      .ins-toolbar { display: flex; gap: 0.55rem; }
      .ins-search {
        flex: 1; position: relative;
        display: flex; align-items: center; gap: 0.55rem;
        padding: 0 0.85rem;
        background: var(--bg-card);
        border: 1.5px solid var(--border);
        border-radius: var(--radius-md);
        color: var(--text-muted);
      }
      .ins-search input {
        flex: 1; padding: 0.7rem 0;
        border: none; background: transparent; outline: none;
        font-family: inherit; font-size: var(--font-button);
        color: var(--text-title);
      }
      .ins-search:focus-within { border-color: var(--primary); }

      .ins-filtros { display: flex; gap: 0.4rem; flex-wrap: wrap; }
      .ins-filtro-btn {
        padding: 0.4rem 0.95rem;
        border: 1.5px solid var(--border);
        border-radius: var(--radius-full);
        background: var(--bg-card);
        font-family: 'Geist', sans-serif;
        font-size: var(--font-helper); font-weight: var(--fw-medium);
        color: var(--text-secondary);
        cursor: pointer; white-space: nowrap;
        transition: all 0.15s;
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
        gap: 0.6rem; padding: 0.7rem 0.9rem;
        background: var(--bg-card);
        border: 1.5px solid var(--border);
        border-radius: var(--radius-md);
        font-family: 'Geist', sans-serif; cursor: pointer;
        color: var(--text-title);
      }
      .ins-cat-dropdown-trigger:hover { border-color: var(--primary); }
      .ins-cat-dropdown-label { display: flex; align-items: center; gap: 0.55rem; min-width: 0; }
      .ins-cat-dropdown-tag {
        font-size: var(--font-caption); font-weight: var(--fw-bold); text-transform: uppercase; letter-spacing: 0.4px;
        color: var(--text-muted);
        background: var(--bg-body); padding: 3px 7px; border-radius: var(--radius-sm);
      }
      .ins-cat-dropdown-value { font-size: var(--font-button); font-weight: var(--fw-bold); }
      .ins-cat-dropdown-backdrop { position: fixed; inset: 0; z-index: 90; background: transparent; }
      .ins-cat-dropdown-list {
        position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 91;
        background: var(--bg-card);
        border: 1.5px solid var(--border);
        border-radius: var(--radius-md);
        box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        max-height: 300px; overflow-y: auto;
        padding: 4px;
      }
      .ins-cat-dropdown-item {
        width: 100%; display: flex; align-items: center; justify-content: space-between;
        padding: 0.65rem 0.8rem;
        background: transparent; border: none; cursor: pointer;
        font-family: 'Geist', sans-serif; font-size: var(--font-button); font-weight: var(--fw-medium);
        color: var(--text-title);
        border-radius: var(--radius-sm); text-align: left;
      }
      .ins-cat-dropdown-item:hover { background: var(--bg-body); }
      .ins-cat-dropdown-item.is-active {
        background: var(--primary-light);
        color: var(--primary); font-weight: var(--fw-bold);
      }

      /* Lista */
      .ins-list { display: flex; flex-direction: column; gap: 0.55rem; }
      .ins-item {
        display: flex; gap: 0.85rem; align-items: flex-start;
        padding: 0.75rem;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        transition: border-color var(--dur-fast) var(--ease-out);
      }
      .ins-item:hover { border-color: var(--primary); }
      .ins-item-img {
        width: 56px; height: 56px;
        border-radius: var(--radius-md); object-fit: cover;
        flex-shrink: 0; background: #F3F4F6;
      }
      .ins-item-img--placeholder {
        display: flex; align-items: center; justify-content: center; font-size: var(--text-xl);
      }
      .ins-item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .ins-item-nome {
        margin: 0; font-size: var(--font-button); font-weight: var(--fw-bold);
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
        margin: 4px 0 0;
        font-size: var(--font-helper); font-weight: var(--fw-bold);
        color: var(--primary);
      }
      .ins-item-actions {
        display: flex; gap: 4px; flex-shrink: 0;
      }
      .ins-act-btn {
        width: 32px; height: 32px;
        background: transparent; border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        display: flex; align-items: center; justify-content: center;
        color: var(--text-secondary);
        cursor: pointer; transition: all var(--dur-fast) var(--ease-out);
      }
      .ins-act-btn:hover { background: var(--bg-body); color: var(--text-title); }
      .ins-act-del:hover { background: #FEE2E2; color: #B91C1C; border-color: #FECACA; }

      .ins-loading {
        display: flex; justify-content: center; padding: 3rem 0;
      }
      .ins-spinner {
        width: 32px; height: 32px;
        border: 3px solid var(--border);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: insSpin 0.7s linear infinite;
      }
      @keyframes insSpin { to { transform: rotate(360deg); } }

      .ins-no-results {
        text-align: center; padding: 2rem 1rem;
        color: var(--text-muted);
      }
      .ins-no-results p { margin: 0 0 0.8rem; font-size: var(--font-button); }
      .ins-no-results button {
        background: var(--primary); color: #fff;
        border: none; border-radius: var(--radius-sm);
        padding: 0.5rem 1rem; font-size: var(--font-helper); font-weight: var(--fw-semibold);
        cursor: pointer; font-family: inherit;
      }

      /* Overlays */
      .ins-overlay {
        position: fixed; inset: 0; z-index: 200;
        background: rgba(17, 24, 39, 0.55);
        backdrop-filter: blur(3px);
        display: flex; align-items: center; justify-content: center;
        padding: 1rem;
      }
      .ins-form-modal {
        background: #fff;
        border-radius: var(--radius-lg); padding: 1.25rem;
        width: 100%; max-width: 520px;
        max-height: 92vh; overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.25);
      }
      .ins-confirm {
        background: #fff;
        border-radius: var(--radius-lg); padding: 1.5rem;
        width: 100%; max-width: 360px;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0,0,0,0.25);
      }
      .ins-confirm-title {
        margin: 0 0 0.5rem;
        font-size: var(--font-modal-title); font-weight: var(--fw-black);
        color: var(--text-title);
      }
      .ins-confirm-sub {
        margin: 0 0 1.25rem;
        font-size: var(--font-button);
        color: var(--text-secondary);
        line-height: 1.45;
      }
      .ins-confirm-btns { display: flex; gap: 0.5rem; }
      .ins-btn-cancel, .ins-btn-del-confirm {
        flex: 1; padding: 0.75rem;
        border-radius: var(--radius-md); font-size: var(--font-button); font-weight: var(--fw-bold);
        cursor: pointer; font-family: inherit;
        border: none;
      }
      .ins-btn-cancel {
        background: var(--bg-body);
        color: var(--text-title);
      }
      .ins-btn-del-confirm {
        background: #DC2626; color: #fff;
      }

      @media (max-width: 640px) {
        .ins-root { padding-bottom: 6rem; gap: 1rem; }
        .ins-title { font-size: var(--font-page-title); }
        .ins-filtros--desktop { display: none; }
        .ins-cat-dropdown { display: block; }
        .ins-item-img { width: 48px; height: 48px; }
        .ins-item-nome { font-size: var(--font-button); }
      }
    `}</style>
  );
}

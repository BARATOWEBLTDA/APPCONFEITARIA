import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import EmptyDoo from "@/components/EmptyDoo";

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
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Produto | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "com" | "sem">("todos");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("produtos")
        .select("*, produto_insumos(quantidade, insumos(id, nome, unidade, custo_unitario, imagem_url))")
        .eq("user_id", user.id)
        .order("nome");
      if (data) setProdutos(data as Produto[]);
      setLoading(false);
    })();
  }, []);

  const filtrados = produtos.filter(p => {
    if (busca.trim()) {
      const t = busca.toLowerCase();
      if (!p.nome.toLowerCase().includes(t)) return false;
    }
    if (filtro === "com") return (p.produto_insumos || []).length > 0;
    if (filtro === "sem") return (p.produto_insumos || []).length === 0;
    return true;
  });

  const totalComFicha = produtos.filter(p => (p.produto_insumos || []).length > 0).length;

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh" }}><span className="ft-spinner" /><style>{`.ft-spinner{width:32px;height:32px;border:3px solid var(--primary-light);border-top-color:var(--primary);border-radius:50%;animation:ftspin .7s linear infinite}@keyframes ftspin{to{transform:rotate(360deg)}}`}</style></div>;

  /* ═══════ DETAIL VIEW ═══════ */
  if (selected) {
    const { cmv, lucro, preco, margemCmv, margemLucro, temFicha } = calcular(selected);
    const itens = selected.produto_insumos || [];
    return (
      <div className="ft-root">
        {/* Back */}
        <button className="ft-back" onClick={() => setSelected(null)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Voltar
        </button>

        {/* Hero */}
        <div className="ft-hero">
          <div className="ft-hero-img">
            {selected.imagem_url
              ? <img src={selected.imagem_url.split(",")[0]} alt={selected.nome} />
              : <div className="ft-hero-placeholder">Sem imagem</div>
            }
          </div>
          <div className="ft-hero-info">
            {selected.categoria && <span className="ft-hero-cat">{selected.categoria}</span>}
            <h1 className="ft-hero-nome">{selected.nome}</h1>
            {selected.descricao && <p className="ft-hero-desc">{selected.descricao}</p>}
          </div>
        </div>

        {/* Métricas */}
        {temFicha ? (
          <div className="ft-metricas">
            <div className="ft-metrica ft-metrica--cmv">
              <span className="ft-metrica-label">CMV</span>
              <strong className="ft-metrica-valor">R$ {fmt(cmv)}</strong>
              <span className="ft-metrica-sub">{fmtPct(margemCmv)}% do preço de venda</span>
            </div>
            <div className="ft-metrica ft-metrica--lucro">
              <span className="ft-metrica-label">Lucro</span>
              <strong className="ft-metrica-valor">R$ {fmt(lucro)}</strong>
              <span className="ft-metrica-sub">{fmtPct(margemLucro)}% do preço de venda</span>
            </div>
            <div className="ft-metrica ft-metrica--preco">
              <span className="ft-metrica-label">Preço de venda</span>
              <strong className="ft-metrica-valor">R$ {fmt(preco)}</strong>
              <span className="ft-metrica-sub">Preço {selected.promocao ? "promocional" : "normal"}</span>
            </div>
          </div>
        ) : (
          <div className="ft-sem-ficha-aviso">
            <p className="ft-sem-ficha-title">Nenhum ingrediente cadastrado</p>
            <p className="ft-sem-ficha-sub">Adicione ingredientes na ficha técnica deste produto para ver o CMV, lucro e margem.</p>
            <button className="ft-btn-editar" onClick={() => navigate("/produtos", { state: { editarId: selected.id } })}>
              Cadastrar ingredientes
            </button>
          </div>
        )}

        {/* Composição */}
        {temFicha && (
          <>
            <div className="ft-section-header">
              <h2 className="ft-section-title">Composição do produto</h2>
            </div>
            <div className="ft-tabela-wrap">
              <table className="ft-tabela">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Ingrediente</th>
                    <th>Qtd</th>
                    <th>Un.</th>
                    <th>Custo un.</th>
                    <th>Total</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((pi, i) => {
                    const custoTotal = (Number(pi.quantidade) || 0) * (Number(pi.insumos?.custo_unitario) || 0);
                    const pctCmv = cmv > 0 ? (custoTotal / cmv) * 100 : 0;
                    return (
                      <tr key={i}>
                        <td className="ft-tabela-nome">
                          {pi.insumos?.imagem_url && <img src={pi.insumos.imagem_url} alt="" className="ft-tabela-thumb" />}
                          {pi.insumos?.nome || "—"}
                        </td>
                        <td style={{ textAlign: "center" }}>{Number(pi.quantidade)}</td>
                        <td style={{ textAlign: "center" }}>{pi.insumos?.unidade || ""}</td>
                        <td style={{ textAlign: "right" }}>{fmt(Number(pi.insumos?.custo_unitario) || 0)}</td>
                        <td style={{ textAlign: "right" }}>{fmt(custoTotal)}</td>
                        <td style={{ textAlign: "right" }}>{fmtPct(pctCmv)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ textAlign: "right", fontWeight: 700 }}>Total CMV</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>R$ {fmt(cmv)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {/* Info extra */}
        {(selected.rendimento_qtd || selected.rendimento_peso || (selected.validade_dias && selected.validade_dias > 0) || selected.embalagem || selected.observacoes_ficha) && (
          <div className="ft-extras">
            {(selected.rendimento_qtd || selected.rendimento_peso) && (
              <div className="ft-extra-item">
                <span className="ft-extra-label">Rendimento</span>
                <span className="ft-extra-value">
                  {[selected.rendimento_qtd, selected.rendimento_peso].filter(Boolean).join(" · ")}
                </span>
              </div>
            )}
            {selected.validade_dias && selected.validade_dias > 0 ? (
              <div className="ft-extra-item">
                <span className="ft-extra-label">Validade</span>
                <span className="ft-extra-value">
                  {selected.validade_dias} dia{selected.validade_dias !== 1 ? "s" : ""}
                  {selected.validade_tipo ? ` (${selected.validade_tipo})` : ""}
                </span>
              </div>
            ) : null}
            {selected.embalagem && (
              <div className="ft-extra-item">
                <span className="ft-extra-label">Embalagem</span>
                <span className="ft-extra-value">{selected.embalagem}</span>
              </div>
            )}
            {selected.observacoes_ficha && (
              <div className="ft-extra-item">
                <span className="ft-extra-label">Observações</span>
                <span className="ft-extra-value">{selected.observacoes_ficha}</span>
              </div>
            )}
          </div>
        )}

        <p className="ft-disclaimer">Os custos unitários podem variar conforme fornecedor e região.</p>

        <button className="ft-btn-editar" onClick={() => navigate("/produtos", { state: { editarId: selected.id } })}>
          Editar produto
        </button>

        <style>{detailStyles}</style>
      </div>
    );
  }

  /* ═══════ LIST VIEW ═══════ */
  return (
    <div className="ft-root">
      <div className="ft-list-header">
        <div>
          <h1 className="ft-list-title">Fichas Técnicas</h1>
          <p className="ft-list-sub">{totalComFicha} de {produtos.length} produto{produtos.length !== 1 ? "s" : ""} com ficha</p>
        </div>
      </div>

      {/* Busca + filtro */}
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

      {/* Progress */}
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
              <div key={p.id} className="ft-list-card" onClick={() => setSelected(p)}>
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

/* ═══════════════════════════════════════════════════════ */
/*  STYLES                                                 */
/* ═══════════════════════════════════════════════════════ */

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
  .ft-progress-bar {
    flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;
  }
  .ft-progress-fill {
    height: 100%; background: var(--primary); border-radius: 3px; transition: width 0.4s ease;
  }
  .ft-progress-label { font-size: var(--font-caption); color: var(--text-muted); white-space: nowrap; }

  .ft-list-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.75rem; }

  .ft-list-card {
    background: var(--bg-card); border-radius: var(--radius-lg); overflow: hidden;
    box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06)); cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
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
  .ft-list-card-cmv {
    display: flex; flex-direction: column; gap: 1px;
    font-size: 0.65rem; color: var(--text-muted);
  }
  .ft-list-card-lucro-val { color: var(--success); font-weight: var(--fw-semibold); }
  .ft-list-card-sem {
    font-size: var(--font-caption); color: var(--text-muted); font-style: italic;
  }
`;

const detailStyles = `
  .ft-root { font-family: var(--font-base); max-width: 600px; display: flex; flex-direction: column; gap: 1rem; }

  .ft-back {
    display: inline-flex; align-items: center; gap: 6px; padding: 0;
    background: none; border: none; font-family: var(--font-base);
    font-size: var(--font-body); font-weight: var(--fw-medium);
    color: var(--text-secondary); cursor: pointer;
  }

  .ft-hero {
    background: var(--bg-card); border-radius: var(--radius-lg); overflow: hidden;
    box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06));
  }
  .ft-hero-img {
    width: 100%; aspect-ratio: 16/10; overflow: hidden; background: var(--bg-subtle);
  }
  .ft-hero-img img { width: 100%; height: 100%; object-fit: cover; }
  .ft-hero-placeholder {
    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    font-size: var(--font-body); color: var(--text-muted);
  }
  .ft-hero-info { padding: 1rem 1.1rem; }
  .ft-hero-cat {
    font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;
    letter-spacing: 0.04em; font-weight: var(--fw-medium);
  }
  .ft-hero-nome {
    font-size: var(--font-section-title); font-weight: var(--fw-bold);
    color: var(--text-title); margin: 2px 0 0;
  }
  .ft-hero-desc {
    font-size: var(--font-body); color: var(--text-secondary);
    margin: 6px 0 0; line-height: 1.45;
  }

  /* Métricas */
  .ft-metricas { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
  .ft-metrica {
    background: var(--bg-card); border-radius: var(--radius-md);
    padding: 0.75rem 0.85rem; display: flex; flex-direction: column; gap: 2px;
    border-left: 3px solid transparent;
  }
  .ft-metrica--cmv { border-left-color: var(--error); }
  .ft-metrica--lucro { border-left-color: var(--success); }
  .ft-metrica--preco { grid-column: 1 / -1; border-left-color: var(--primary); }
  .ft-metrica-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); font-weight: var(--fw-semibold); }
  .ft-metrica-valor { font-size: var(--font-input); font-weight: var(--fw-bold); color: var(--text-title); }
  .ft-metrica-sub { font-size: var(--font-caption); color: var(--text-muted); }

  .ft-sem-ficha-aviso {
    background: var(--bg-card); border-radius: var(--radius-md);
    padding: 1.25rem; text-align: center; border: 1px dashed var(--border);
  }
  .ft-sem-ficha-title { font-size: var(--font-body); font-weight: var(--fw-bold); color: var(--text-title); margin: 0 0 4px; }
  .ft-sem-ficha-sub { font-size: var(--font-caption); color: var(--text-muted); margin: 0 0 0.75rem; line-height: 1.4; }

  /* Composição */
  .ft-section-header { display: flex; align-items: center; justify-content: space-between; }
  .ft-section-title {
    font-size: var(--font-body); font-weight: var(--fw-bold);
    color: var(--text-title); margin: 0; text-transform: uppercase;
    letter-spacing: 0.03em; font-size: 0.75rem;
  }

  .ft-tabela-wrap {
    background: var(--bg-card); border-radius: var(--radius-md); overflow-x: auto;
    box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06));
  }
  .ft-tabela {
    width: 100%; border-collapse: collapse; font-size: var(--font-caption);
  }
  .ft-tabela thead { background: var(--bg-subtle); }
  .ft-tabela th {
    padding: 0.5rem 0.6rem; font-size: 0.6rem; text-transform: uppercase;
    letter-spacing: 0.04em; color: var(--text-muted); font-weight: var(--fw-semibold);
    white-space: nowrap; text-align: right;
  }
  .ft-tabela th:first-child { text-align: left; }
  .ft-tabela td {
    padding: 0.5rem 0.6rem; border-top: 1px solid var(--border);
    color: var(--text-primary); white-space: nowrap;
  }
  .ft-tabela-nome {
    display: flex; align-items: center; gap: 6px; font-weight: var(--fw-medium);
  }
  .ft-tabela-thumb {
    width: 22px; height: 22px; border-radius: var(--radius-sm);
    object-fit: cover; flex-shrink: 0;
  }
  .ft-tabela tfoot td {
    border-top: 2px solid var(--border); background: var(--bg-subtle);
  }

  /* Extras */
  .ft-extras {
    display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;
  }
  .ft-extra-item {
    background: var(--bg-card); border-radius: var(--radius-md);
    padding: 0.65rem 0.75rem; display: flex; flex-direction: column; gap: 2px;
  }
  .ft-extra-label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); font-weight: var(--fw-semibold); }
  .ft-extra-value { font-size: var(--font-caption); color: var(--text-primary); font-weight: var(--fw-medium); line-height: 1.35; }

  .ft-disclaimer {
    font-size: 0.65rem; color: var(--text-muted); text-align: center;
    margin: 0; font-style: italic;
  }

  .ft-btn-editar {
    width: 100%; padding: 0.7rem; background: var(--primary);
    color: var(--text-inverse); border: none; border-radius: var(--radius-md);
    font-family: var(--font-base); font-size: var(--font-button);
    font-weight: var(--fw-bold); cursor: pointer;
  }
`;

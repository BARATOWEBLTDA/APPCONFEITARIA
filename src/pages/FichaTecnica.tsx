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

        {/* Árvore: foto → linhas → CMV/Lucro → linha → Preço */}
        <div className="ft-tree">
          {/* Foto do produto */}
          <div className="ft-tree-foto">
            {selected.imagem_url
              ? <img src={selected.imagem_url.split(",")[0]} alt={selected.nome} />
              : <div className="ft-tree-foto-placeholder">Sem imagem</div>
            }
          </div>
          <div className="ft-tree-titulo">
            {selected.categoria && <span className="ft-tree-cat">{selected.categoria}</span>}
            <h1 className="ft-tree-nome">{selected.nome}</h1>
          </div>

          {/* Conector: foto → 2 cards */}
          <svg className="ft-conector ft-conector--top" viewBox="0 0 300 48" preserveAspectRatio="none" aria-hidden="true">
            <path d="M150 0 L150 14 Q150 24 140 24 L85 24 Q75 24 75 34 L75 48 M150 14 Q150 24 160 24 L215 24 Q225 24 225 34 L225 48"
              fill="none" stroke="var(--ft-line)" strokeWidth="2" />
          </svg>

          {/* CMV + Lucro */}
          <div className="ft-tree-duo">
            <div className="ft-node ft-node--cmv">
              <div className="ft-node-icon ft-node-icon--cmv">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              </div>
              <span className="ft-node-label">CMV</span>
              <strong className="ft-node-valor">R$ {fmt(cmv)}</strong>
              <span className="ft-node-sub">{temFicha ? `${fmtPct(margemCmv)}% do preço de venda` : "Sem ingredientes"}</span>
            </div>
            <div className="ft-node ft-node--lucro">
              <div className="ft-node-icon ft-node-icon--lucro">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              </div>
              <span className="ft-node-label">Lucro</span>
              <strong className="ft-node-valor">R$ {fmt(lucro)}</strong>
              <span className="ft-node-sub">{temFicha ? `${fmtPct(margemLucro)}% do preço de venda` : "Estimado sem custos"}</span>
            </div>
          </div>

          {/* Conector: 2 cards → preço central */}
          <svg className="ft-conector ft-conector--bottom" viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true">
            <path d="M75 0 L75 10 Q75 20 85 20 L140 20 Q150 20 150 30 L150 40 M225 0 L225 10 Q225 20 215 20 L160 20 Q150 20 150 30 L150 40"
              fill="none" stroke="var(--ft-line)" strokeWidth="2" />
          </svg>

          {/* Preço de venda sugerido */}
          <div className="ft-node ft-node--preco">
            <div className="ft-node-icon ft-node-icon--preco">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
            </div>
            <div className="ft-node-preco-text">
              <span className="ft-node-label">Preço de venda sugerido</span>
              <strong className="ft-node-valor ft-node-valor--lg">R$ {fmt(preco)}</strong>
            </div>
          </div>

          {/* Banner quando ainda não há ingredientes */}
          {!temFicha && (
            <div className="ft-sem-ficha-aviso">
              <p className="ft-sem-ficha-title">Ficha técnica vazia</p>
              <p className="ft-sem-ficha-sub">Cadastre os ingredientes para calcular o CMV real e o lucro deste produto.</p>
              <button className="ft-btn-cadastrar" onClick={() => navigate("/produtos", { state: { editarId: selected.id } })}>
                Cadastrar ingredientes
              </button>
            </div>
          )}
        </div>

        {selected.descricao && <p className="ft-tree-desc">{selected.descricao}</p>}

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

  /* ═══ Árvore conectada ═══ */
  .ft-tree {
    display: flex; flex-direction: column; align-items: center;
    background: var(--bg-card); border-radius: var(--radius-lg);
    padding: 1.25rem 1rem 1.5rem;
    box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06));
  }

  .ft-tree-foto {
    width: 190px; height: 190px; border-radius: 50%; overflow: hidden;
    background: var(--bg-subtle); box-shadow: 0 6px 20px rgba(0,0,0,0.12);
    flex-shrink: 0;
  }
  .ft-tree-foto img { width: 100%; height: 100%; object-fit: cover; }
  .ft-tree-foto-placeholder {
    width: 100%; height: 100%; display: flex; align-items: center;
    justify-content: center; font-size: var(--font-caption); color: var(--text-muted);
  }

  .ft-tree-titulo { text-align: center; margin-top: 0.85rem; }
  .ft-tree-cat {
    display: block; font-size: 0.65rem; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: 0.06em; font-weight: var(--fw-medium);
  }
  .ft-tree-nome {
    font-size: var(--font-section-title); font-weight: var(--fw-bold);
    color: var(--text-title); margin: 2px 0 0; line-height: 1.2;
  }

  /* Conectores SVG */
  .ft-conector { width: 100%; max-width: 340px; display: block; }
  .ft-conector--top { height: 44px; margin-top: 0.5rem; }
  .ft-conector--bottom { height: 36px; }

  /* Duo CMV + Lucro */
  .ft-tree-duo {
    display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;
    width: 100%; max-width: 340px;
  }

  /* Node base */
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
  .ft-node-label {
    font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em;
    color: var(--text-muted); font-weight: var(--fw-bold);
  }
  .ft-node-valor { font-size: var(--font-input); font-weight: var(--fw-bold); color: var(--text-title); }
  .ft-node-valor--lg { font-size: var(--font-section-title); }
  .ft-node-sub { font-size: 0.65rem; color: var(--text-muted); line-height: 1.3; }

  .ft-node--cmv { border-color: #d9b78e; }
  .ft-node--lucro { border-color: #b6d6b8; }

  /* Preço sugerido — horizontal, destaque */
  .ft-node--preco {
    flex-direction: row; align-items: center; gap: 0.75rem;
    width: 100%; max-width: 300px; border-color: var(--primary);
    background: var(--primary-light);
  }
  .ft-node--preco .ft-node-icon { margin-bottom: 0; }
  .ft-node-preco-text { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; }
  .ft-node--preco .ft-node-label { color: var(--primary); }
  .ft-node--preco .ft-node-valor { color: var(--primary); }

  .ft-tree-desc {
    font-size: var(--font-body); color: var(--text-secondary);
    margin: 0; line-height: 1.5; text-align: center;
    padding: 0 0.5rem;
  }

  .ft-sem-ficha-aviso {
    background: var(--bg-subtle); border-radius: var(--radius-md);
    padding: 1rem; text-align: center; border: 1px dashed var(--border);
    margin-top: 1.25rem; width: 100%; max-width: 340px;
  }
  .ft-sem-ficha-title { font-size: var(--font-body); font-weight: var(--fw-bold); color: var(--text-title); margin: 0 0 4px; }
  .ft-sem-ficha-sub { font-size: var(--font-caption); color: var(--text-muted); margin: 0 0 0.75rem; line-height: 1.4; }
  .ft-btn-cadastrar {
    width: 100%; padding: 0.6rem; background: var(--primary);
    color: var(--text-inverse); border: none; border-radius: var(--radius-md);
    font-family: var(--font-base); font-size: var(--font-button);
    font-weight: var(--fw-bold); cursor: pointer;
  }

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

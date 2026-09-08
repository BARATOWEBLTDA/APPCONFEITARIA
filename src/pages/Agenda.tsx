import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/* ── Config de status (alinhada com o resto do app) ───────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  novo:         { label: "Novo",         color: "#534AB7", bg: "#EEEDFE", dot: "#7F77DD" },
  confirmado:   { label: "Confirmado",   color: "#0e7490", bg: "#cffafe", dot: "#0891b2" },
  em_producao:  { label: "Em produção",  color: "#854F0B", bg: "#FAEEDA", dot: "#EF9F27" },
  pronto:       { label: "Pronto",       color: "#14532d", bg: "#dcfce7", dot: "#22c55e" },
  a_caminho:    { label: "A caminho",    color: "#0369a1", bg: "#e0f2fe", dot: "#0ea5e9" },
  concluido:    { label: "Concluído",    color: "#374151", bg: "#f3f4f6", dot: "#9ca3af" },
  cancelado:    { label: "Cancelado",    color: "#791F1F", bg: "#FCEBEB", dot: "#E24B4A" },
};
const getStatusConfig = (s: string) => STATUS_CONFIG[s] || STATUS_CONFIG.novo;

const FILTROS = [
  { key: "todos",       label: "Todos" },
  { key: "novo",        label: "Novos" },
  { key: "em_producao", label: "Produção" },
  { key: "pronto",      label: "Prontos" },
  { key: "concluido",   label: "Feitos" },
];

const formatMoney = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Agenda() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [calMes, setCalMes] = useState(new Date());
  const [calDiaSelecionado, setCalDiaSelecionado] = useState<string | null>(null);
  const [pedidosDia, setPedidosDia] = useState<any[]>([]);
  const [pedidosFiltro, setPedidosFiltro] = useState("todos");
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [pedidosMes, setPedidosMes] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const hoje = new Date().toISOString().slice(0, 10);
      setCalDiaSelecionado(hoje);
      await buscarPedidosMes(user.id, calMes);
      await buscarPedidosDia(user.id, hoje);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId) return;
    buscarPedidosMes(userId, calMes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calMes]);

  const buscarPedidosMes = async (uid: string, mes: Date) => {
    const ano = mes.getFullYear();
    const m = mes.getMonth();
    const inicio = new Date(ano, m, 1).toISOString().split("T")[0];
    const fim = new Date(ano, m + 1, 0).toISOString().split("T")[0];
    const { data } = await supabase.from("pedidos").select("data_entrega,status")
      .eq("user_id", uid).gte("data_entrega", inicio).lte("data_entrega", fim);
    if (data) {
      const map: Record<string, number> = {};
      data.forEach((p: any) => {
        if (p.data_entrega && p.status !== "cancelado") {
          map[p.data_entrega] = (map[p.data_entrega] || 0) + 1;
        }
      });
      setPedidosMes(map);
    }
  };

  const buscarPedidosDia = async (uid: string, dia: string) => {
    if (!uid) return;
    setLoadingPedidos(true);
    const { data } = await supabase.from("pedidos")
      .select("*, pedido_itens(nome_produto, quantidade, imagem_url, produtos(imagem_url))")
      .eq("user_id", uid)
      .eq("data_entrega", dia)
      .order("horario_entrega", { ascending: true, nullsFirst: false });
    setPedidosDia(data || []);
    setLoadingPedidos(false);
  };

  const handleDiaClick = (dia: string) => {
    setCalDiaSelecionado(dia);
    setPedidosFiltro("todos");
    buscarPedidosDia(userId, dia);
  };

  const irParaHoje = () => {
    const hoje = new Date();
    setCalMes(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    handleDiaClick(hoje.toISOString().slice(0, 10));
  };

  const calCells = () => {
    const ano = calMes.getFullYear();
    const mes = calMes.getMonth();
    const primeiroDia = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const hoje = new Date().toISOString().split("T")[0];
    const cells = [];
    for (let i = 0; i < primeiroDia; i++) cells.push(<div key={"e" + i} className="ag-day-empty" />);
    for (let d = 1; d <= totalDias; d++) {
      const iso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const qtd = pedidosMes[iso] || 0;
      const isHoje = iso === hoje;
      const isSelecionado = iso === calDiaSelecionado;
      cells.push(
        <button
          key={d}
          onClick={() => handleDiaClick(iso)}
          className={
            "ag-day" +
            (isHoje ? " ag-day--hoje" : "") +
            (isSelecionado ? " ag-day--sel" : "") +
            (qtd ? " ag-day--com" : "")
          }
        >
          <span className="ag-day-num">{d}</span>
          {qtd > 0 && <span className="ag-day-dot" aria-label={`${qtd} pedidos`} />}
        </button>
      );
    }
    return cells;
  };

  const filtrados = pedidosDia.filter(p => pedidosFiltro === "todos" || p.status === pedidosFiltro);

  // Contadores por status pra badges nos filtros
  const countByStatus = pedidosDia.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const dataFormatada = calDiaSelecionado
    ? new Date(calDiaSelecionado + "T12:00:00").toLocaleDateString("pt-BR", {
        weekday: "long", day: "2-digit", month: "long"
      })
    : "";

  return (
    <div className="ag-root">
      <div className="ag-header">
        <h1 className="ag-title">Agenda</h1>
        <p className="ag-sub">Seus pedidos por data de entrega</p>
      </div>

      <div className="ag-body">
        {/* Calendário */}
        <div className="ag-cal-card">
          <div className="ag-cal-nav">
            <button onClick={() => setCalMes(new Date(calMes.getFullYear(), calMes.getMonth() - 1, 1))} className="ag-nav-btn" aria-label="Mês anterior">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div className="ag-mes-wrap">
              <span className="ag-mes-label">
                {calMes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </span>
              <button className="ag-btn-hoje" onClick={irParaHoje}>Hoje</button>
            </div>
            <button onClick={() => setCalMes(new Date(calMes.getFullYear(), calMes.getMonth() + 1, 1))} className="ag-nav-btn" aria-label="Próximo mês">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <div className="ag-dow-grid">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <div key={i} className="ag-dow">{d}</div>
            ))}
          </div>
          <div className="ag-day-grid">{calCells()}</div>

          <div className="ag-legenda">
            <span className="ag-legenda-item"><span className="ag-legenda-dot" /> com pedidos</span>
            <span className="ag-legenda-item"><span className="ag-legenda-hoje" /> hoje</span>
          </div>
        </div>

        {/* Painel de pedidos do dia */}
        <div className="ag-pedidos-card">
          {!calDiaSelecionado ? (
            <div className="ag-empty-state">
              <p className="ag-empty-title">Selecione um dia</p>
              <p className="ag-empty-sub">Toque em qualquer data no calendário para ver os pedidos daquele dia</p>
            </div>
          ) : (
            <>
              <div className="ag-pedidos-header">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 className="ag-pedidos-title">{dataFormatada}</h2>
                  <p className="ag-pedidos-sub">
                    {pedidosDia.length === 0 ? "Nenhum pedido" : `${pedidosDia.length} pedido${pedidosDia.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <button className="ag-btn-novo" onClick={() => navigate("/pedidos/novo")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Novo
                </button>
              </div>

              {pedidosDia.length > 0 && (
                <div className="ag-filtros">
                  {FILTROS.map(f => {
                    const cnt = f.key === "todos" ? pedidosDia.length : (countByStatus[f.key] || 0);
                    if (f.key !== "todos" && cnt === 0) return null;
                    return (
                      <button
                        key={f.key}
                        onClick={() => setPedidosFiltro(f.key)}
                        className={"ag-filtro" + (pedidosFiltro === f.key ? " ag-filtro--on" : "")}
                      >
                        {f.label}
                        <span className="ag-filtro-cnt">{cnt}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {loadingPedidos ? (
                <div className="ag-loading">Carregando…</div>
              ) : filtrados.length === 0 ? (
                <div className="ag-empty-state">
                  <p className="ag-empty-title">
                    {pedidosDia.length === 0 ? "Nada agendado" : "Nenhum pedido com esse filtro"}
                  </p>
                  <p className="ag-empty-sub">
                    {pedidosDia.length === 0
                      ? "Não há pedidos com entrega nesta data"
                      : "Tente outro filtro pra ver mais pedidos"}
                  </p>
                </div>
              ) : (
                <div className="ag-lista">
                  {filtrados.map(p => {
                    const primeiroItem = p.pedido_itens?.[0];
                    const outrosItens = Math.max(0, (p.pedido_itens?.length || 0) - 1);
                    const st = getStatusConfig(p.status);
                    const nomeProduto = primeiroItem
                      ? `${primeiroItem.nome_produto}${outrosItens > 0 ? ` + ${outrosItens} item${outrosItens > 1 ? "s" : ""}` : ""}`
                      : "Sem produtos";
                    return (
                      <div key={p.id} className="ag-item" onClick={() => navigate(`/pedidos/${p.id}`)}>
                        <div className="ag-item-img">
                          {(primeiroItem?.imagem_url || primeiroItem?.produtos?.imagem_url) ? (
                            <img
                              src={primeiroItem.imagem_url || primeiroItem.produtos?.imagem_url || ""}
                              alt={primeiroItem.nome_produto}
                            />
                          ) : (
                            <span className="ag-item-emoji">🎂</span>
                          )}
                        </div>
                        <div className="ag-item-info">
                          <div className="ag-item-top">
                            <p className="ag-item-cliente">{p.cliente_nome || "Cliente não informado"}</p>
                            {p.horario_entrega && (
                              <span className="ag-item-hora">{p.horario_entrega.slice(0, 5)}</span>
                            )}
                          </div>
                          <p className="ag-item-produto">{nomeProduto}</p>
                          <div className="ag-item-tags">
                            <span
                              className="ag-item-tag"
                              style={{ color: st.color, background: st.bg }}
                            >
                              <span className="ag-item-tag-dot" style={{ background: st.dot }} />
                              {st.label}
                            </span>
                            {p.tipo_entrega === "entrega" && (
                              <span className="ag-item-tag ag-item-tag--neutral">Entrega</span>
                            )}
                            {p.tipo_entrega === "retirada" && (
                              <span className="ag-item-tag ag-item-tag--neutral">Retirada</span>
                            )}
                          </div>
                        </div>
                        <span className="ag-item-valor">{formatMoney(p.valor_total)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        .ag-root {
          padding: 0 0 6rem;
          display: flex; flex-direction: column;
          gap: var(--space-4);
        }

        /* Header */
        .ag-header { display: flex; flex-direction: column; gap: var(--space-1); }
        .ag-title {
          font-size: var(--font-page-title);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0;
          letter-spacing: -0.02em;
        }
        .ag-sub {
          font-size: var(--font-button);
          color: var(--text-muted);
          margin: 0;
        }

        /* Body layout */
        .ag-body {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--space-3);
          align-items: start;
        }
        @media (min-width: 900px) {
          .ag-body { grid-template-columns: 360px 1fr; gap: var(--space-4); }
        }
        @media (min-width: 1200px) { .ag-body { grid-template-columns: 400px 1fr; } }

        /* ── Calendário ── */
        .ag-cal-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          box-shadow: 0 2px 8px rgba(45, 31, 38, 0.04);
        }
        .ag-cal-nav {
          display: flex; align-items: center; justify-content: space-between;
          gap: var(--space-2);
          margin-bottom: var(--space-4);
        }
        .ag-mes-wrap {
          display: flex; align-items: center; gap: var(--space-2);
          flex: 1;
          justify-content: center;
        }
        .ag-mes-label {
          font-size: var(--font-input);
          font-weight: var(--fw-bold);
          color: var(--text-title);
          text-transform: capitalize;
          letter-spacing: -0.01em;
        }
        .ag-btn-hoje {
          background: var(--bg-subtle);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          border-radius: 999px;
          padding: 3px 10px;
          font-family: inherit;
          font-size: var(--font-caption);
          font-weight: var(--fw-bold);
          cursor: pointer;
          transition: all var(--dur-fast);
        }
        .ag-btn-hoje:hover {
          background: var(--text-title); color: #fff; border-color: var(--text-title);
        }
        .ag-nav-btn {
          width: 34px; height: 34px; border-radius: 50%;
          border: 1px solid var(--border);
          background: var(--bg-card);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--text-secondary);
          font-family: inherit;
          transition: all var(--dur-fast);
          flex-shrink: 0;
        }
        .ag-nav-btn:hover {
          background: var(--text-title); color: #fff; border-color: var(--text-title);
        }
        .ag-dow-grid {
          display: grid; grid-template-columns: repeat(7, 1fr);
          margin-bottom: var(--space-1);
        }
        .ag-dow {
          text-align: center;
          font-size: var(--font-caption);
          font-weight: var(--fw-bold);
          color: var(--text-muted);
          text-transform: uppercase;
          padding: var(--space-1) 0;
          letter-spacing: 0.04em;
        }
        .ag-day-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }
        .ag-day-empty { aspect-ratio: 1; }
        .ag-day {
          position: relative;
          aspect-ratio: 1;
          border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          cursor: pointer;
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: var(--fw-medium);
          color: var(--text-primary);
          display: flex; align-items: center; justify-content: center;
          transition: background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast);
        }
        .ag-day:hover { background: var(--bg-subtle); }
        .ag-day--hoje {
          border-color: var(--primary);
          color: var(--primary);
          font-weight: var(--fw-bold);
        }
        .ag-day--sel {
          background: var(--text-title) !important;
          color: #fff !important;
          border-color: var(--text-title) !important;
          font-weight: var(--fw-bold);
        }
        .ag-day--com { font-weight: var(--fw-bold); }
        .ag-day-num { line-height: 1; }
        .ag-day-dot {
          position: absolute;
          bottom: 5px; left: 50%;
          transform: translateX(-50%);
          width: 5px; height: 5px;
          border-radius: 50%;
          background: var(--primary);
        }
        .ag-day--sel .ag-day-dot { background: #fff; }

        .ag-legenda {
          display: flex; gap: var(--space-4);
          margin-top: var(--space-3);
          padding-top: var(--space-3);
          border-top: 1px solid var(--border);
          justify-content: center;
        }
        .ag-legenda-item {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: var(--font-caption);
          color: var(--text-muted);
        }
        .ag-legenda-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--primary);
        }
        .ag-legenda-hoje {
          width: 10px; height: 10px; border-radius: 3px;
          border: 1.5px solid var(--primary);
        }

        /* ── Painel de pedidos ── */
        .ag-pedidos-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          box-shadow: 0 2px 8px rgba(45, 31, 38, 0.04);
          min-height: 360px;
          display: flex; flex-direction: column;
        }
        .ag-empty-state {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center;
          gap: var(--space-1);
          flex: 1;
          min-height: 280px;
          padding: var(--space-4);
        }
        .ag-empty-title {
          font-size: var(--font-input);
          font-weight: var(--fw-bold);
          color: var(--text-title);
          margin: 0;
        }
        .ag-empty-sub {
          font-size: var(--font-helper);
          color: var(--text-muted);
          margin: 0;
          max-width: 260px;
          line-height: 1.5;
        }

        .ag-pedidos-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-3);
          margin-bottom: var(--space-3);
        }
        .ag-pedidos-title {
          font-size: var(--font-modal-title);
          font-weight: var(--fw-bold);
          color: var(--text-title);
          margin: 0 0 3px;
          text-transform: capitalize;
          letter-spacing: -0.01em;
          line-height: var(--lh-tight);
        }
        .ag-pedidos-sub {
          font-size: var(--font-helper);
          color: var(--text-muted);
          margin: 0;
        }
        .ag-btn-novo {
          display: inline-flex; align-items: center; gap: 5px;
          background: var(--text-title);
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 8px 14px;
          font-family: inherit;
          font-size: var(--font-helper);
          font-weight: var(--fw-bold);
          cursor: pointer;
          flex-shrink: 0;
          transition: opacity var(--dur-fast);
        }
        .ag-btn-novo:hover { opacity: 0.9; }

        /* Filtros */
        .ag-filtros {
          display: flex; gap: 6px;
          flex-wrap: wrap;
          margin-bottom: var(--space-3);
        }
        .ag-filtro {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 11px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-secondary);
          font-family: inherit;
          font-size: var(--font-caption);
          font-weight: var(--fw-semibold);
          cursor: pointer;
          transition: all var(--dur-fast);
        }
        .ag-filtro:hover { background: var(--bg-subtle); color: var(--text-title); }
        .ag-filtro--on {
          background: var(--text-title);
          color: #fff;
          border-color: var(--text-title);
        }
        .ag-filtro-cnt {
          font-weight: var(--fw-bold);
          font-size: 10px;
          background: var(--bg-subtle);
          color: var(--text-muted);
          padding: 1px 6px;
          border-radius: 999px;
          font-variant-numeric: tabular-nums;
        }
        .ag-filtro--on .ag-filtro-cnt {
          background: rgba(255,255,255,0.2);
          color: #fff;
        }

        /* Loading */
        .ag-loading {
          text-align: center;
          color: var(--text-muted);
          font-size: var(--font-helper);
          padding: var(--space-6) 0;
        }

        /* Lista */
        .ag-lista {
          display: flex; flex-direction: column;
          margin: 0 calc(var(--space-4) * -1);
          border-top: 1px solid var(--border);
        }
        .ag-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px var(--space-4);
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          font-family: inherit;
          transition: background var(--dur-fast);
        }
        .ag-item:hover { background: var(--bg-subtle); }
        .ag-item:last-child { border-bottom: none; }
        .ag-item-img {
          width: 48px; height: 48px;
          border-radius: 12px;
          background: var(--bg-subtle);
          flex-shrink: 0;
          overflow: hidden;
          display: flex; align-items: center; justify-content: center;
        }
        .ag-item-img img { width: 100%; height: 100%; object-fit: cover; }
        .ag-item-emoji { font-size: 22px; }
        .ag-item-info { flex: 1; min-width: 0; }
        .ag-item-top {
          display: flex; align-items: baseline; justify-content: space-between;
          gap: 8px;
        }
        .ag-item-cliente {
          margin: 0;
          font-size: 14px;
          font-weight: var(--fw-bold);
          color: var(--text-title);
          letter-spacing: -0.01em;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ag-item-hora {
          font-size: 11px;
          font-weight: var(--fw-semibold);
          color: var(--primary);
          font-variant-numeric: tabular-nums;
          flex-shrink: 0;
        }
        .ag-item-produto {
          margin: 2px 0 5px;
          font-size: 12px;
          color: var(--text-secondary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ag-item-tags {
          display: flex; gap: 4px;
          flex-wrap: wrap;
        }
        .ag-item-tag {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 2px 7px;
          border-radius: 999px;
          font-size: 9.5px;
          font-weight: var(--fw-black);
          letter-spacing: 0.03em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .ag-item-tag-dot {
          width: 5px; height: 5px; border-radius: 50%;
        }
        .ag-item-tag--neutral {
          background: var(--bg-subtle);
          color: var(--text-secondary);
          font-weight: var(--fw-bold);
        }
        .ag-item-valor {
          font-size: 13px;
          font-weight: var(--fw-black);
          color: var(--primary);
          flex-shrink: 0;
          letter-spacing: -0.01em;
        }
      `}</style>
    </div>
  );
}

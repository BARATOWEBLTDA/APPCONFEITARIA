import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

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
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await buscarPedidosMes(user.id, calMes);
    };
    init();
  }, []);

  useEffect(() => {
    if (!userId) return;
    buscarPedidosMes(userId, calMes);
    setCalDiaSelecionado(null);
    setPedidosDia([]);
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
      data.forEach((p: any) => { if (p.data_entrega) map[p.data_entrega] = (map[p.data_entrega] || 0) + 1; });
      setPedidosMes(map);
    }
  };

  const buscarPedidosDia = async (dia: string) => {
    if (!userId) return;
    setLoadingPedidos(true);
    const { data } = await supabase.from("pedidos").select("*")
      .eq("user_id", userId).eq("data_entrega", dia).order("created_at", { ascending: false });
    setPedidosDia(data || []);
    setLoadingPedidos(false);
  };

  const handleDiaClick = (dia: string) => {
    setCalDiaSelecionado(dia);
    setPedidosFiltro("todos");
    buscarPedidosDia(dia);
  };

  const calCells = () => {
    const ano = calMes.getFullYear();
    const mes = calMes.getMonth();
    const primeiroDia = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const hoje = new Date().toISOString().split("T")[0];
    const cells = [];
    for (let i = 0; i < primeiroDia; i++) cells.push(<div key={"e" + i} />);
    for (let d = 1; d <= totalDias; d++) {
      const iso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const temPedido = pedidosMes[iso] || 0;
      const isHoje = iso === hoje;
      const isSelecionado = iso === calDiaSelecionado;
      cells.push(
        <button key={d} onClick={() => handleDiaClick(iso)}
          className={"ag-day" + (isHoje ? " hoje" : "") + (isSelecionado ? " selecionado" : "") + (temPedido ? " tem-pedido" : "")}>
          <span>{d}</span>
          {temPedido > 0 && <span className="ag-dot">{temPedido}</span>}
        </button>
      );
    }
    return cells;
  };

  const filtrados = pedidosDia.filter(p => pedidosFiltro === "todos" || p.status === pedidosFiltro);

  return (
    <div className="ag-root">
      <div className="ag-header">
        <h1 className="ag-title">Agenda</h1>
        <p className="ag-sub">Visualize seus pedidos por data de entrega</p>
      </div>

      <div className="ag-body">
        {/* Calendário */}
        <div className="ag-cal-card">
          <div className="ag-cal-nav">
            <button onClick={() => setCalMes(new Date(calMes.getFullYear(), calMes.getMonth() - 1, 1))} className="ag-nav-btn">‹</button>
            <span className="ag-mes-label">
              {calMes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </span>
            <button onClick={() => setCalMes(new Date(calMes.getFullYear(), calMes.getMonth() + 1, 1))} className="ag-nav-btn">›</button>
          </div>

          <div className="ag-dow-grid">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
              <div key={d} className="ag-dow">{d}</div>
            ))}
          </div>
          <div className="ag-day-grid">{calCells()}</div>
        </div>

        {/* Painel de pedidos do dia */}
        <div className="ag-pedidos-card">
          {!calDiaSelecionado ? (
            <div className="ag-empty-state">
              <div className="ag-empty-icon">📅</div>
              <p className="ag-empty-title">Selecione um dia</p>
              <p className="ag-empty-sub">Clique em qualquer data para ver os pedidos</p>
            </div>
          ) : (
            <>
              <div className="ag-pedidos-header">
                <div>
                  <h2 className="ag-pedidos-title">
                    {new Date(calDiaSelecionado + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                  </h2>
                  <p className="ag-pedidos-sub">{pedidosDia.length} pedido{pedidosDia.length !== 1 ? "s" : ""} neste dia</p>
                </div>
                <button className="ag-btn-novo" onClick={() => navigate("/pedidos")}>+ Novo pedido</button>
              </div>

              <div className="ag-filtros">
                {["todos", "pendente", "em_producao", "finalizado", "cancelado"].map(f => (
                  <button key={f} onClick={() => setPedidosFiltro(f)}
                    className={"ag-filtro" + (pedidosFiltro === f ? " ativo" : "")}>
                    {f === "todos" ? "Todos" : f === "pendente" ? "Pendente" : f === "em_producao" ? "Produção" : f === "finalizado" ? "Feito" : "Cancelado"}
                  </button>
                ))}
              </div>

              {loadingPedidos ? (
                <div className="ag-loading">Carregando...</div>
              ) : filtrados.length === 0 ? (
                <div className="ag-empty-state" style={{ padding: "2rem 0" }}>
                  <div className="ag-empty-icon">🎂</div>
                  <p className="ag-empty-title">Nenhum pedido</p>
                  <p className="ag-empty-sub">Não há pedidos com esse status neste dia</p>
                </div>
              ) : (
                <div className="ag-lista">
                  {filtrados.map(p => (
                    <div key={p.id} className="ag-pedido-item">
                      <div className="ag-pedido-info">
                        <p className="ag-pedido-cliente">{p.cliente_nome || "Cliente"}</p>
                        <p className="ag-pedido-desc">{p.descricao || "Sem descrição"}</p>
                      </div>
                      <div className="ag-pedido-right">
                        <span className="ag-pedido-valor">R$ {(p.valor || 0).toFixed(2)}</span>
                        <span className={"ag-pedido-status " + p.status}>
                          {p.status === "finalizado" ? "✓ Feito" : p.status === "em_producao" ? "⚙ Produção" : p.status === "cancelado" ? "✕ Cancelado" : "● Pendente"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        .ag-root { font-family: 'Inter', sans-serif; padding: 0; }
        .ag-header { margin-bottom: 1.5rem; }
        .ag-title { font-size: 1.5rem; font-weight: 800; color: #1f2937; margin: 0 0 0.25rem; }
        .ag-sub { font-size: 0.85rem; color: #9ca3af; margin: 0; }
        .ag-body { display: grid; grid-template-columns: 420px 1fr; gap: 1.5rem; align-items: start; }
        @media (max-width: 768px) { .ag-body { grid-template-columns: 1fr; } }

        /* Calendário */
        .ag-cal-card { background: white; border-radius: 20px; padding: 1.5rem; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
        .ag-cal-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
        .ag-mes-label { font-size: 1rem; font-weight: 700; color: #1f2937; text-transform: capitalize; }
        .ag-nav-btn { width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid #e5e7eb; background: white; cursor: pointer; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; color: #6b7280; transition: all 0.15s; }
        .ag-nav-btn:hover { background: #fdf2f8; color: #FF4FA3; border-color: #FF4FA3; }
        .ag-dow-grid { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 0.5rem; }
        .ag-dow { text-align: center; font-size: 0.72rem; font-weight: 700; color: #9ca3af; text-transform: uppercase; padding: 0.35rem 0; }
        .ag-day-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .ag-day { position: relative; aspect-ratio: 1; border-radius: 12px; border: none; background: transparent; cursor: pointer; font-size: 0.9rem; font-weight: 500; color: #374151; font-family: 'Inter', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; transition: all 0.15s; }
        .ag-day:hover { background: #fdf2f8; color: #FF4FA3; }
        .ag-day.hoje { background: #fdf2f8; color: #FF4FA3; font-weight: 800; }
        .ag-day.selecionado { background: linear-gradient(135deg,#FF4FA3,#FF6BB5) !important; color: white !important; font-weight: 800; box-shadow: 0 4px 12px rgba(255,79,163,0.4); }
        .ag-day.tem-pedido { font-weight: 700; }
        .ag-dot { font-size: 0.6rem; background: #FF4FA3; color: white; border-radius: 8px; padding: 0 5px; line-height: 1.5; }
        .ag-day.selecionado .ag-dot { background: rgba(255,255,255,0.35); }

        /* Pedidos */
        .ag-pedidos-card { background: white; border-radius: 20px; padding: 1.5rem; box-shadow: 0 2px 12px rgba(0,0,0,0.06); min-height: 400px; }
        .ag-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; gap: 0.5rem; text-align: center; }
        .ag-empty-icon { font-size: 2.5rem; }
        .ag-empty-title { font-size: 1rem; font-weight: 700; color: #374151; margin: 0; }
        .ag-empty-sub { font-size: 0.82rem; color: #9ca3af; margin: 0; }
        .ag-pedidos-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
        .ag-pedidos-title { font-size: 1.05rem; font-weight: 700; color: #1f2937; margin: 0 0 0.2rem; text-transform: capitalize; }
        .ag-pedidos-sub { font-size: 0.78rem; color: #9ca3af; margin: 0; }
        .ag-btn-novo { background: linear-gradient(135deg,#FF4FA3,#FF6BB5); color: white; border: none; border-radius: 10px; padding: 0.55rem 1rem; font-family: 'Inter',sans-serif; font-size: 0.82rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .ag-filtros { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .ag-filtro { padding: 0.35rem 0.85rem; border-radius: 8px; border: 1.5px solid #e5e7eb; background: white; color: #9ca3af; font-size: 0.78rem; font-weight: 600; cursor: pointer; font-family: 'Inter',sans-serif; transition: all 0.15s; }
        .ag-filtro:hover { border-color: #FF4FA3; color: #FF4FA3; }
        .ag-filtro.ativo { background: #FF4FA3; border-color: #FF4FA3; color: white; }
        .ag-loading { text-align: center; color: #9ca3af; font-size: 0.85rem; padding: 2rem 0; }
        .ag-lista { display: flex; flex-direction: column; gap: 0.75rem; }
        .ag-pedido-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #f9fafb; border-radius: 14px; border: 1px solid #f3f4f6; transition: box-shadow 0.15s; }
        .ag-pedido-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .ag-pedido-info { flex: 1; }
        .ag-pedido-cliente { font-size: 0.9rem; font-weight: 600; color: #1f2937; margin: 0 0 0.2rem; }
        .ag-pedido-desc { font-size: 0.78rem; color: #9ca3af; margin: 0; }
        .ag-pedido-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.35rem; }
        .ag-pedido-valor { font-size: 0.95rem; font-weight: 700; color: #16a34a; }
        .ag-pedido-status { font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 6px; }
        .ag-pedido-status.finalizado { background: #dcfce7; color: #16a34a; }
        .ag-pedido-status.em_producao { background: #fef9c3; color: #ca8a04; }
        .ag-pedido-status.cancelado { background: #fee2e2; color: #ef4444; }
        .ag-pedido-status.pendente { background: #fdf2f8; color: #FF4FA3; }
      `}</style>
    </div>
  );
}

import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/* ═══════════════════════════════════════════════════════════════════════════
 * Config
 * ═══════════════════════════════════════════════════════════════════════════ */

type ViewMode = "lista" | "calendario";
const VIEW_KEY = "agenda_view_mode";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; group: "agendado" | "producao" | "concluido" }> = {
  novo:         { label: "Novo",         color: "#534AB7", bg: "#EEEDFE", dot: "#7F77DD", group: "agendado" },
  confirmado:   { label: "Confirmado",   color: "#0e7490", bg: "#cffafe", dot: "#0891b2", group: "agendado" },
  em_producao:  { label: "Em produção",  color: "#854F0B", bg: "#FAEEDA", dot: "#EF9F27", group: "producao" },
  pronto:       { label: "Pronto",       color: "#14532d", bg: "#dcfce7", dot: "#22c55e", group: "concluido" },
  a_caminho:    { label: "A caminho",    color: "#0369a1", bg: "#e0f2fe", dot: "#0ea5e9", group: "concluido" },
  concluido:    { label: "Concluído",    color: "#374151", bg: "#f3f4f6", dot: "#9ca3af", group: "concluido" },
  cancelado:    { label: "Cancelado",    color: "#791F1F", bg: "#FCEBEB", dot: "#E24B4A", group: "concluido" },
};
const getStatusConfig = (s: string) => STATUS_CONFIG[s] || STATUS_CONFIG.novo;

/* Cores das bolinhas na agenda (grupo agendado/produção/concluído) */
const GROUP_DOT_COLORS = {
  agendado:  "#7F77DD", // roxo (mesmo do status "novo")
  producao:  "#EF9F27", // laranja
  concluido: "#22c55e", // verde
};
const GROUP_LABELS = {
  agendado:  "Agendado",
  producao:  "Em produção",
  concluido: "Concluído",
};

const DOW_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DOW_MINI  = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const DOW_FULL  = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const isoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseISO = (iso: string) => new Date(iso + "T12:00:00");

const formatMoney = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "BOLO DE CHOCOLATE" → "Bolo de chocolate" */
const capitalizePrimeira = (s: string) => {
  if (!s) return "";
  const lower = s.toLowerCase().trim();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

/** Trunca com "..." mantendo palavra inteira quando possível, respeitando limite */
const truncar = (s: string, max: number) => {
  if (!s || s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
};

const diffDias = (isoAlvo: string) => {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const alvo = parseISO(isoAlvo); alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
};

const relativoLabel = (isoAlvo: string): string => {
  const dif = diffDias(isoAlvo);
  if (dif === 0) return "Hoje";
  if (dif === 1) return "Amanhã";
  if (dif === -1) return "Ontem";
  if (dif > 1 && dif < 7) return `Em ${dif} dias`;
  if (dif < 0 && dif > -7) return `${Math.abs(dif)} dias atrás`;
  return "";
};

/* ═══════════════════════════════════════════════════════════════════════════
 * Componente principal
 * ═══════════════════════════════════════════════════════════════════════════ */

export default function Agenda() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "lista";
    const saved = localStorage.getItem(VIEW_KEY) as ViewMode | null;
    return saved && ["lista", "calendario"].includes(saved) ? saved : "lista";
  });

  const [refDate, setRefDate] = useState(new Date());
  const [diaSel, setDiaSel] = useState(isoDate(new Date()));

  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const STATUS_FILTRAVEIS = ["novo", "confirmado", "em_producao", "pronto", "a_caminho", "concluido"];
  const [statusSelecionados, setStatusSelecionados] = useState<string[]>(STATUS_FILTRAVEIS);
  const [filtroDrawerOpen, setFiltroDrawerOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      // Traz TODOS os pedidos do usuário — não filtra por data (garante que nenhum "some")
      const { data } = await supabase.from("pedidos")
        .select("*, pedido_itens(nome_produto, quantidade, valor_unitario, imagem_url, produtos(imagem_url))")
        .eq("user_id", userId)
        .order("data_entrega", { ascending: true, nullsFirst: false })
        .order("horario_entrega", { ascending: true, nullsFirst: false });

      // Se pedido não tem data_entrega, usa created_at como fallback (agrupa pela data que foi criado)
      const pedidosNormalizados = (data || []).map((p: any) => ({
        ...p,
        data_entrega: p.data_entrega || (p.created_at ? p.created_at.slice(0, 10) : null),
      }));

      setPedidos(pedidosNormalizados);
      setLoading(false);
    })();
  }, [userId]);

  /* Mapa de contagens por dia com grupos de status */
  const dayStats = useMemo(() => {
    const m: Record<string, { total: number; agendado: number; producao: number; concluido: number }> = {};
    pedidos.forEach(p => {
      if (!p.data_entrega || p.status === "cancelado") return;
      if (!m[p.data_entrega]) m[p.data_entrega] = { total: 0, agendado: 0, producao: 0, concluido: 0 };
      m[p.data_entrega].total++;
      const g = getStatusConfig(p.status).group;
      m[p.data_entrega][g]++;
    });
    return m;
  }, [pedidos]);

  const pedidosDoDia = useMemo(
    () => pedidos.filter(p => p.data_entrega === diaSel),
    [pedidos, diaSel]
  );

  const pedidosDiaFiltrados = useMemo(
    () => pedidosDoDia.filter((p: any) => statusSelecionados.includes(p.status)),
    [pedidosDoDia, statusSelecionados]
  );

  const countStatusDia = useMemo(() => {
    const m: Record<string, number> = {};
    pedidosDoDia.forEach(p => { m[p.status] = (m[p.status] || 0) + 1; });
    return m;
  }, [pedidosDoDia]);

  const irParaHoje = () => {
    const h = new Date();
    setRefDate(h);
    setDiaSel(isoDate(h));
  };

  const handleExcluirPedido = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este pedido? Essa ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("pedidos").delete().eq("id", id);
    if (error) {
      alert("Erro ao excluir pedido: " + error.message);
      return;
    }
    setPedidos((prev) => prev.filter(p => p.id !== id));
  };

  /* ═══ RENDER ═══ */
  return (
    <div className="ag-root">
      <div className="ag-header">
        <h1 className="ag-title">Agenda</h1>
        <p className="ag-sub">Seus pedidos por data de entrega</p>
      </div>

      {/* Toggle Lista / Calendário */}
      <div className="ag-toggle" role="tablist" aria-label="Modo de visualização">
        <button
          role="tab"
          aria-selected={viewMode === "lista"}
          className={"ag-toggle-btn" + (viewMode === "lista" ? " ag-toggle-btn--on" : "")}
          onClick={() => setViewMode("lista")}
        >
          <IcLista />
          <span>Lista</span>
        </button>
        <button
          role="tab"
          aria-selected={viewMode === "calendario"}
          className={"ag-toggle-btn" + (viewMode === "calendario" ? " ag-toggle-btn--on" : "")}
          onClick={() => setViewMode("calendario")}
        >
          <IcCalendario />
          <span>Calendário</span>
        </button>
      </div>

      {viewMode === "lista" ? (
        <VistaLista
          refDate={refDate}
          setRefDate={setRefDate}
          diaSel={diaSel}
          setDiaSel={setDiaSel}
          dayStats={dayStats}
          irParaHoje={irParaHoje}
          pedidosDoDia={pedidosDoDia}
          pedidosFiltrados={pedidosDiaFiltrados}
          countStatus={countStatusDia}
          statusSelecionados={statusSelecionados}
          setStatusSelecionados={setStatusSelecionados}
          filtroDrawerOpen={filtroDrawerOpen}
          setFiltroDrawerOpen={setFiltroDrawerOpen}
          statusFiltraveis={STATUS_FILTRAVEIS}
          
          loading={loading}
          onOpenPedido={(id: string) => navigate(`/pedidos/${id}`)}
          onNovoPedido={() => navigate("/pedidos/novo")}
          onExcluirPedido={handleExcluirPedido}
        />
      ) : (
        <VistaCalendario
          refDate={refDate}
          setRefDate={setRefDate}
          diaSel={diaSel}
          setDiaSel={setDiaSel}
          dayStats={dayStats}
          irParaHoje={irParaHoje}
          pedidosDoDia={pedidosDoDia}
          pedidosFiltrados={pedidosDiaFiltrados}
          countStatus={countStatusDia}
          statusSelecionados={statusSelecionados}
          setStatusSelecionados={setStatusSelecionados}
          filtroDrawerOpen={filtroDrawerOpen}
          setFiltroDrawerOpen={setFiltroDrawerOpen}
          statusFiltraveis={STATUS_FILTRAVEIS}
          
          loading={loading}
          onOpenPedido={(id: string) => navigate(`/pedidos/${id}`)}
          onNovoPedido={() => navigate("/pedidos/novo")}
          onExcluirPedido={handleExcluirPedido}
        />
      )}

      <AgendaStyles />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * VISTA LISTA — carrossel horizontal de cards + resumo do dia + lista
 * ═══════════════════════════════════════════════════════════════════════════ */

function VistaLista(props: any) {
  const {
    refDate, setRefDate, diaSel, setDiaSel, dayStats, irParaHoje,
    pedidosDoDia, pedidosFiltrados, countStatus, statusSelecionados, setStatusSelecionados, filtroDrawerOpen, setFiltroDrawerOpen, statusFiltraveis,
    loading, onOpenPedido, onNovoPedido, onExcluirPedido,
  } = props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const hojeISO = isoDate(new Date());

  // Gera 60 dias começando de "hoje - 3" pra ver contexto (anteontem, ontem, hoje...)
  const dias = useMemo(() => {
    const list: Date[] = [];
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 3);
    for (let i = 0; i < 60; i++) {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      list.push(d);
    }
    return list;
  }, []);

  // Auto-scroll pro dia selecionado quando entra ou muda
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>(`[data-day="${diaSel}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [diaSel]);

  // Estatísticas do dia selecionado
  const stats = dayStats[diaSel] || { total: 0, agendado: 0, producao: 0, concluido: 0 };
  const valorTotalDia = useMemo(
    () => pedidosDoDia.reduce((s: number, p: any) => s + (Number(p.valor_total) || 0), 0),
    [pedidosDoDia]
  );
  const progressoPct = stats.total > 0 ? Math.round((stats.concluido / stats.total) * 100) : 0;

  return (
    <>
      {/* Card resumo do dia selecionado */}
      <div className="ag-hoje-card">
        <div className="ag-hoje-top">
          <div>
            <div className="ag-hoje-lbl">
              {diaSel === hojeISO ? "Hoje" : parseISO(diaSel).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })}
            </div>
            <div className="ag-hoje-pedidos">
              {stats.total === 0 ? "Nenhum pedido" : `${stats.total} pedido${stats.total !== 1 ? "s" : ""}`}
            </div>
          </div>
          <div className="ag-hoje-valor">{formatMoney(valorTotalDia)}</div>
        </div>

        {stats.total > 0 && (
          <>
            <div className="ag-hoje-prog-row">
              <span className="ag-hoje-prog-lbl">Progresso</span>
              <span className="ag-hoje-prog-pct">{progressoPct}%</span>
            </div>
            <div className="ag-hoje-bar">
              <div className="ag-hoje-bar-fill" style={{ width: `${progressoPct}%` }} />
            </div>

            <div className="ag-hoje-stats">
              <span className="ag-hoje-stat">
                <span className="ag-hoje-stat-dot" style={{ background: GROUP_DOT_COLORS.agendado }} />
                {stats.agendado} agendado{stats.agendado !== 1 ? "s" : ""}
              </span>
              <span className="ag-hoje-stat">
                <span className="ag-hoje-stat-dot" style={{ background: GROUP_DOT_COLORS.producao }} />
                {stats.producao} em produção
              </span>
              <span className="ag-hoje-stat">
                <span className="ag-hoje-stat-dot" style={{ background: GROUP_DOT_COLORS.concluido }} />
                {stats.concluido} pronto{stats.concluido !== 1 ? "s" : ""}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Carrossel de cards dos dias */}
      <div className="ag-strip-wrap">
        <div className="ag-strip-nav">
          <button className="ag-strip-hoje" onClick={irParaHoje}>Hoje</button>
        </div>
        <div className="ag-strip" ref={scrollRef}>
          {dias.map(d => {
            const iso = isoDate(d);
            const st = dayStats[iso];
            const cnt = st?.total || 0;
            const isSel = iso === diaSel;
            const isHoje = iso === hojeISO;
            return (
              <button
                key={iso}
                data-day={iso}
                className={"ag-day-card" + (isSel ? " ag-day-card--sel" : "") + (isHoje ? " ag-day-card--hoje" : "")}
                onClick={() => setDiaSel(iso)}
              >
                <span className="ag-day-mes">{MESES_SHORT[d.getMonth()]}</span>
                <span className="ag-day-num">{d.getDate()}</span>
                <span className="ag-day-dow">{DOW_FULL[d.getDay()]}</span>
                {cnt > 0 && <span className="ag-day-badge">{cnt}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de pedidos */}
      <PedidosDoDia
        diaSel={diaSel}
        loading={loading}
        pedidosDoDia={pedidosDoDia}
        pedidosFiltrados={pedidosFiltrados}
        countStatus={countStatus}
        statusSelecionados={statusSelecionados}
        setStatusSelecionados={setStatusSelecionados}
        filtroDrawerOpen={filtroDrawerOpen}
        setFiltroDrawerOpen={setFiltroDrawerOpen}
        statusFiltraveis={statusFiltraveis}
        
        onOpenPedido={onOpenPedido}
        onNovoPedido={onNovoPedido}
        onExcluirPedido={onExcluirPedido}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * VISTA CALENDÁRIO — mês completo com bolinhas coloridas
 * ═══════════════════════════════════════════════════════════════════════════ */

function VistaCalendario(props: any) {
  const {
    refDate, setRefDate, diaSel, setDiaSel, dayStats, irParaHoje,
    pedidosDoDia, pedidosFiltrados, countStatus, statusSelecionados, setStatusSelecionados, filtroDrawerOpen, setFiltroDrawerOpen, statusFiltraveis,
    loading, onOpenPedido, onNovoPedido, onExcluirPedido,
  } = props;

  // Gera células do mês visível — incluindo dias do mês anterior/próximo pra fechar semanas
  const cells = useMemo(() => {
    const ano = refDate.getFullYear();
    const mes = refDate.getMonth();
    const primeiroDia = new Date(ano, mes, 1).getDay(); // 0 = domingo
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const list: Array<{ date: Date; iso: string; outroMes: boolean }> = [];

    // Dias do mês anterior
    for (let i = primeiroDia - 1; i >= 0; i--) {
      const d = new Date(ano, mes, -i);
      list.push({ date: d, iso: isoDate(d), outroMes: true });
    }
    // Dias do mês atual
    for (let d = 1; d <= totalDias; d++) {
      const date = new Date(ano, mes, d);
      list.push({ date, iso: isoDate(date), outroMes: false });
    }
    // Dias do próximo mês pra fechar as semanas (múltiplo de 7)
    let extra = 1;
    while (list.length % 7 !== 0) {
      const d = new Date(ano, mes + 1, extra);
      list.push({ date: d, iso: isoDate(d), outroMes: true });
      extra++;
    }
    return list;
  }, [refDate]);

  const hojeISO = isoDate(new Date());
  const diaSelDate = parseISO(diaSel);
  const totalDiaSel = dayStats[diaSel]?.total || 0;
  const valorTotalDia = useMemo(
    () => pedidosDoDia.reduce((s: number, p: any) => s + (Number(p.valor_total) || 0), 0),
    [pedidosDoDia]
  );

  return (
    <>
      {/* Data grande + metadados */}
      <div className="ag-data-hdr">
        <svg className="ag-data-hdr-ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span className="ag-data-hdr-txt">
          {diaSelDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
        </span>
        {totalDiaSel > 0 && (
          <>
            <span className="ag-data-hdr-meta ag-data-hdr-meta--qtd">
              {totalDiaSel} pedido{totalDiaSel !== 1 ? "s" : ""}
            </span>
            <span className="ag-data-hdr-meta ag-data-hdr-meta--valor">
              {formatMoney(valorTotalDia)}
            </span>
          </>
        )}
      </div>

      {/* Calendário */}
      <div className="ag-cal-card">
        <div className="ag-cal-nav">
          <button
            className="ag-cal-nav-btn"
            onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft />
          </button>
          <div className="ag-cal-titulo-wrap">
            <span className="ag-cal-titulo">
              {refDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </span>
            <button className="ag-cal-hoje" onClick={irParaHoje}>Hoje</button>
          </div>
          <button
            className="ag-cal-nav-btn"
            onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight />
          </button>
        </div>

        <div className="ag-cal-dow-hdr">
          {DOW_MINI.map((d, i) => (
            <div key={i} className="ag-cal-dow">{d}</div>
          ))}
        </div>

        <div className="ag-cal-grid">
          {cells.map(c => {
            const st = dayStats[c.iso];
            const isSel = c.iso === diaSel;
            const isHoje = c.iso === hojeISO && !c.outroMes;
            return (
              <button
                key={c.iso + (c.outroMes ? "-o" : "")}
                className={
                  "ag-cal-day" +
                  (c.outroMes ? " ag-cal-day--outro" : "") +
                  (isSel ? " ag-cal-day--sel" : "") +
                  (isHoje ? " ag-cal-day--hoje" : "")
                }
                onClick={() => setDiaSel(c.iso)}
              >
                <span className="ag-cal-num">{c.date.getDate()}</span>
                {st && st.total > 0 && (
                  <span className="ag-cal-dots">
                    {st.agendado > 0 && <span className="ag-cal-dot" style={{ background: GROUP_DOT_COLORS.agendado }} />}
                    {st.producao > 0 && <span className="ag-cal-dot" style={{ background: GROUP_DOT_COLORS.producao }} />}
                    {st.concluido > 0 && <span className="ag-cal-dot" style={{ background: GROUP_DOT_COLORS.concluido }} />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legenda */}
      <div className="ag-legenda">
        <span className="ag-legenda-item">
          <span className="ag-legenda-dot" style={{ background: GROUP_DOT_COLORS.agendado }} />
          {GROUP_LABELS.agendado}
        </span>
        <span className="ag-legenda-item">
          <span className="ag-legenda-dot" style={{ background: GROUP_DOT_COLORS.producao }} />
          {GROUP_LABELS.producao}
        </span>
        <span className="ag-legenda-item">
          <span className="ag-legenda-dot" style={{ background: GROUP_DOT_COLORS.concluido }} />
          {GROUP_LABELS.concluido}
        </span>
      </div>

      {/* Lista de pedidos do dia clicado */}
      <PedidosDoDia
        diaSel={diaSel}
        loading={loading}
        pedidosDoDia={pedidosDoDia}
        pedidosFiltrados={pedidosFiltrados}
        countStatus={countStatus}
        statusSelecionados={statusSelecionados}
        setStatusSelecionados={setStatusSelecionados}
        filtroDrawerOpen={filtroDrawerOpen}
        setFiltroDrawerOpen={setFiltroDrawerOpen}
        statusFiltraveis={statusFiltraveis}
        
        onOpenPedido={onOpenPedido}
        onNovoPedido={onNovoPedido}
        onExcluirPedido={onExcluirPedido}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PEDIDOS DO DIA (compartilhado entre Lista e Calendário)
 * ═══════════════════════════════════════════════════════════════════════════ */

function PedidosDoDia({
  diaSel, loading, pedidosDoDia, pedidosFiltrados, countStatus,
  statusSelecionados, setStatusSelecionados, filtroDrawerOpen, setFiltroDrawerOpen,
  statusFiltraveis, onOpenPedido, onNovoPedido, onExcluirPedido,
}: any) {
  const d = parseISO(diaSel);
  const rel = relativoLabel(diaSel);
  const diaSemanaFmt = d.toLocaleDateString("pt-BR", { weekday: "long" });
  const dataFmt = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

  const FILTROS_LABELS: Record<string, string> = {
    novo: "Novos",
    confirmado: "Confirmados",
    em_producao: "Em produção",
    pronto: "Prontos",
    concluido: "Concluídos",
  };

  const toggleStatus = (s: string) => {
    if (statusSelecionados.includes(s)) {
      setStatusSelecionados(statusSelecionados.filter((x: string) => x !== s));
    } else {
      setStatusSelecionados([...statusSelecionados, s]);
    }
  };

  const selecionarTodos = () => setStatusSelecionados(statusFiltraveis);
  const limparFiltros = () => setStatusSelecionados([]);

  const filtroResumo = statusSelecionados.length === statusFiltraveis.length
    ? "Todos"
    : statusSelecionados.length === 0
      ? "Nenhum selecionado"
      : `${statusSelecionados.length} status selecionado${statusSelecionados.length !== 1 ? "s" : ""}`;

  return (
    <div className="ag-pedidos-card">
      <div className="ag-pedidos-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ag-pedidos-title-stack">
            <span className="ag-pedidos-dow">{diaSemanaFmt}</span>
            <span className="ag-pedidos-data">{dataFmt}</span>
          </div>
          <p className="ag-pedidos-sub">
            {rel && <span className="ag-rel-pill">{rel}</span>}
            {pedidosDoDia.length === 0 ? "Nenhum pedido" : `${pedidosDoDia.length} pedido${pedidosDoDia.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button className="ag-btn-primary" onClick={onNovoPedido}>
          <PlusIcon />
          <span>Novo</span>
        </button>
      </div>

      {/* Card de filtro (estilo referência) */}
      {pedidosDoDia.length > 0 && (
        <button className="ag-filtro-card" onClick={() => setFiltroDrawerOpen(true)}>
          <span className="ag-filtro-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="7" y1="12" x2="17" y2="12"/>
              <line x1="10" y1="18" x2="14" y2="18"/>
            </svg>
          </span>
          <span className="ag-filtro-card-label">Filtro de Status</span>
          <span className="ag-filtro-card-valor">{filtroResumo}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      )}

      {/* Drawer do filtro */}
      {filtroDrawerOpen && (
        <div className="ag-filtro-drawer-overlay" onClick={() => setFiltroDrawerOpen(false)}>
          <div className="ag-filtro-drawer" onClick={e => e.stopPropagation()}>
            <div className="ag-filtro-drawer-handle" />
            <div className="ag-filtro-drawer-head">
              <h3 className="ag-filtro-drawer-title">Filtro de Status</h3>
              <button className="ag-filtro-drawer-close" onClick={() => setFiltroDrawerOpen(false)} aria-label="Fechar">✕</button>
            </div>
            <div className="ag-filtro-drawer-body">
              {statusFiltraveis.map((s: string) => {
                const cfg = getStatusConfig(s);
                const marcado = statusSelecionados.includes(s);
                const qtd = countStatus[s] || 0;
                return (
                  <label key={s} className={"ag-filtro-opcao" + (marcado ? " ag-filtro-opcao--on" : "")}>
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => toggleStatus(s)}
                      className="ag-filtro-opcao-check"
                    />
                    <span className="ag-filtro-opcao-dot" style={{ background: cfg.dot }} />
                    <span className="ag-filtro-opcao-label">{FILTROS_LABELS[s] || cfg.label}</span>
                    <span className="ag-filtro-opcao-cnt">{qtd}</span>
                  </label>
                );
              })}
            </div>
            <div className="ag-filtro-drawer-acoes">
              <button className="ag-filtro-drawer-btn-limpar" onClick={limparFiltros}>Limpar</button>
              <button className="ag-filtro-drawer-btn-todos" onClick={selecionarTodos}>Selecionar todos</button>
              <button className="ag-filtro-drawer-btn-aplicar" onClick={() => setFiltroDrawerOpen(false)}>Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="ag-loading">Carregando…</div>
      ) : pedidosFiltrados.length === 0 ? (
        <EmptyState
          titulo={pedidosDoDia.length === 0 ? "Nada agendado" : "Nenhum pedido com esse filtro"}
          sub={
            pedidosDoDia.length === 0
              ? "Não há pedidos com entrega nesta data"
              : "Tente outro filtro pra ver mais pedidos"
          }
        />
      ) : (
        <>
          <div className="ag-pedidos-secao-lbl">Pedidos pendentes</div>
          <div className="ag-pedidos-lista-rica">
            {pedidosFiltrados.map((p: any) => (
              <PedidoCard
                key={p.id}
                p={p}
                onEditar={() => onOpenPedido(p.id)}
                onExcluir={() => onExcluirPedido(p.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Componentes reutilizáveis
 * ═══════════════════════════════════════════════════════════════════════════ */

function PedidoCard({ p, onEditar, onExcluir }: any) {
  const st = getStatusConfig(p.status);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const dataEntregaFmt = () => {
    if (!p.data_entrega) return null;
    const rel = relativoLabel(p.data_entrega);
    return rel || parseISO(p.data_entrega).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };
  const entregaLabel = dataEntregaFmt();

  const criadoFmt = p.created_at
    ? new Date(p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }) +
      " às " +
      new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

  const subtotal = Number(p.valor_produtos) || 0;
  const desconto = Number(p.desconto) || 0;
  const total = Number(p.valor_total) || 0;
  const adiantamento = Number(p.valor_pago) || Number(p.entrada) || 0;
  const restante = total - adiantamento;

  const pagamentoStatus = p.status_pagamento || "pendente";
  const pagamentoLabelPartes = pagamentoStatus === "pago"
    ? { label: "Pago", valor: formatMoney(total) }
    : pagamentoStatus === "parcial"
      ? { label: "Restam", valor: formatMoney(restante) }
      : { label: "A pagar", valor: formatMoney(total) };

  return (
    <div className="ag-pc">
      {/* Header */}
      <div className="ag-pc-head">
        <div className="ag-pc-avatar">
          {(() => {
            const primeiro = p.pedido_itens?.[0];
            const src = primeiro?.imagem_url || primeiro?.produtos?.imagem_url;
            const extras = Math.max(0, (p.pedido_itens?.length || 0) - 1);
            return (
              <>
                {src ? (
                  <img src={src} alt={primeiro.nome_produto} className="ag-pc-avatar-img" />
                ) : (
                  <span className="ag-pc-avatar-emoji">🎂</span>
                )}
                {extras > 0 && <span className="ag-pc-avatar-badge">+{extras}</span>}
              </>
            );
          })()}
        </div>
        <div className="ag-pc-head-info">
          <p className="ag-pc-nome">
            {p.cliente_nome || "Cliente não informado"}
            {p.numero && <span className="ag-pc-numero"> #{p.numero}</span>}
          </p>
          {criadoFmt && (
            <span className="ag-pc-pedido-em">Pedido em {criadoFmt}</span>
          )}
        </div>
        <div className="ag-pc-actions">
          <div className="ag-pc-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="ag-pc-menu-btn"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Ações do pedido"
              aria-expanded={menuOpen}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.8"/>
                <circle cx="12" cy="12" r="1.8"/>
                <circle cx="12" cy="19" r="1.8"/>
              </svg>
            </button>
            {menuOpen && (
              <div className="ag-pc-menu" role="menu">
                <button className="ag-pc-menu-item" onClick={() => { setMenuOpen(false); onEditar?.(); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Editar pedido
                </button>
                <button className="ag-pc-menu-item" onClick={() => { setMenuOpen(false); alert("Em breve: exportar/imprimir pedido"); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"/>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                    <rect x="6" y="14" width="12" height="8"/>
                  </svg>
                  Exportar / Imprimir
                </button>
                <div className="ag-pc-menu-divider" />
                <button className="ag-pc-menu-item ag-pc-menu-item--danger" onClick={() => { setMenuOpen(false); onExcluir?.(); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/>
                    <path d="M14 11v6"/>
                  </svg>
                  Excluir pedido
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="ag-pc-divider" />

      {/* Info linhas */}
      <div className="ag-pc-info-lines">
        <div className="ag-pc-info-line ag-pc-info-line--status">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
          <span className="ag-pc-info-label">Status</span>
          <span className="ag-pc-status-tag" style={{ background: st.dot, color: "#fff" }}>{st.label}</span>
        </div>
        {entregaLabel && (
          <div className={"ag-pc-info-line ag-pc-info-line--entrega" + (entregaLabel === "Hoje" ? " ag-pc-info-line--hoje" : "")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Entrega {entregaLabel}
            {p.horario_entrega && ` às ${p.horario_entrega.slice(0, 5)}`}
          </div>
        )}
        <div className={"ag-pc-info-line ag-pc-info-line--pag ag-pc-info-line--pag-" + pagamentoStatus}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="2"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
          {pagamentoStatus === "pago"
            ? "Pagamento realizado"
            : pagamentoStatus === "parcial"
              ? "Pagamento parcial (sinal)"
              : "Pagamento pendente"}
        </div>
      </div>

      {/* Bloco de itens + totais */}
      <div className="ag-pc-itens">
        {p.pedido_itens && p.pedido_itens.length > 0 && p.pedido_itens.map((item: any, idx: number) => {
          const nomeFmt = truncar(capitalizePrimeira(item.nome_produto || ""), 20);
          const subtotalItem = (Number(item.valor_unitario) || 0) * (Number(item.quantidade) || 0);
          return (
            <div key={idx} className="ag-pc-item-linha">
              <span className="ag-pc-item-nome">
                <b>{item.quantidade}x</b> {nomeFmt}
              </span>
              <span className="ag-pc-item-val">{formatMoney(subtotalItem)}</span>
            </div>
          );
        })}

        <div className="ag-pc-item-linha ag-pc-item-linha--subtotal">
          <span className="ag-pc-item-nome">Subtotal</span>
          <span className="ag-pc-item-val">{formatMoney(subtotal || total)}</span>
        </div>

        {desconto > 0 && (
          <div className="ag-pc-item-linha">
            <span className="ag-pc-item-nome ag-pc-item-desconto">Desconto</span>
            <span className="ag-pc-item-val ag-pc-item-desconto">- {formatMoney(desconto)}</span>
          </div>
        )}

        {adiantamento > 0 && (
          <>
            <div className="ag-pc-item-linha">
              <span className="ag-pc-item-nome ag-pc-item-pago">Sinal</span>
              <span className="ag-pc-item-val ag-pc-item-pago">- {formatMoney(adiantamento)}</span>
            </div>
            <div className="ag-pc-item-linha ag-pc-item-linha--restante">
              <span className="ag-pc-item-nome">Falta</span>
              <span className="ag-pc-item-val">{formatMoney(restante)}</span>
            </div>
          </>
        )}

        {adiantamento === 0 && (
          <div className="ag-pc-item-linha ag-pc-item-linha--total">
            <span className="ag-pc-item-nome">Total</span>
            <span className="ag-pc-item-val">{formatMoney(total)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ titulo, sub, cta }: any) {
  return (
    <div className="ag-empty">
      <div className="ag-empty-icon">
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>
      <p className="ag-empty-title">{titulo}</p>
      <p className="ag-empty-sub">{sub}</p>
      {cta}
    </div>
  );
}

/* Ícones */
const ChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IcLista = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>
  </svg>
);
const IcCalendario = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════════════════
 * Styles
 * ═══════════════════════════════════════════════════════════════════════════ */

function AgendaStyles() {
  return (
    <style>{`
      .ag-root {
        padding: var(--space-4) var(--space-4) 6rem;
        display: flex; flex-direction: column;
        gap: var(--space-3);
        font-family: var(--font-base);
      }

      /* ── Header ── */
      .ag-header { display: flex; flex-direction: column; gap: var(--space-1); }
      .ag-title {
        font-size: var(--font-page-title);
        font-weight: var(--fw-black);
        color: var(--text-title);
        margin: 0;
        letter-spacing: -0.02em;
      }
      .ag-sub {
        font-size: var(--font-page-subtitle);
        color: var(--text-muted);
        margin: 0;
      }

      /* ── Toggle ── */
      .ag-toggle {
        display: flex;
        background: #F0EBED;
        padding: 3px;
        border-radius: var(--radius-sm);
        gap: 2px;
      }
      .ag-toggle-btn {
        flex: 1;
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        padding: 10px 6px;
        background: transparent;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-family: inherit;
        font-size: var(--font-caption);
        font-weight: var(--fw-bold);
        color: var(--text-secondary);
        transition: background var(--dur-fast), color var(--dur-fast), box-shadow var(--dur-fast);
      }
      .ag-toggle-btn:hover { color: var(--text-title); }
      .ag-toggle-btn--on {
        background: var(--bg-card);
        color: var(--text-title);
        box-shadow: var(--shadow-sm);
      }

      /* ─────────────────────────────────────────────────
         VISTA LISTA
         ───────────────────────────────────────────────── */

      /* Card de resumo do dia */
      .ag-hoje-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: var(--space-4);
        box-shadow: var(--shadow-sm);
      }
      .ag-hoje-top {
        display: flex; justify-content: space-between; align-items: flex-start;
        gap: var(--space-2);
      }
      .ag-hoje-lbl {
        font-size: var(--font-modal-title);
        font-weight: var(--fw-black);
        color: var(--text-title);
        letter-spacing: var(--ls-tight);
        text-transform: capitalize;
      }
      .ag-hoje-pedidos {
        font-size: var(--font-helper);
        color: var(--text-muted);
        margin-top: 2px;
      }
      .ag-hoje-valor {
        font-size: var(--text-xl);
        font-weight: var(--fw-black);
        color: var(--text-title);
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;
      }
      .ag-hoje-prog-row {
        display: flex; justify-content: space-between; align-items: center;
        margin: var(--space-3) 0 6px;
      }
      .ag-hoje-prog-lbl {
        font-size: var(--font-helper);
        color: var(--text-secondary);
      }
      .ag-hoje-prog-pct {
        font-size: var(--text-xs);
        font-weight: var(--fw-black);
        color: #B8860B;
        background: #FFF3D1;
        padding: 2px 8px;
        border-radius: 6px;
      }
      .ag-hoje-bar {
        height: 8px;
        background: var(--border);
        border-radius: var(--radius-full);
        overflow: hidden;
      }
      .ag-hoje-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #22C55E, #16A34A);
        border-radius: var(--radius-full);
        transition: width var(--dur-normal) var(--ease-out);
      }
      .ag-hoje-stats {
        display: flex; justify-content: space-between; gap: var(--space-2);
        padding-top: var(--space-3);
        margin-top: var(--space-3);
        border-top: 1px solid var(--border);
        flex-wrap: wrap;
      }
      .ag-hoje-stat {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: var(--font-helper);
        color: var(--text-secondary);
        font-weight: var(--fw-medium);
      }
      .ag-hoje-stat-dot { width: 8px; height: 8px; border-radius: 50%; }

      /* Carrossel de dias */
      .ag-strip-wrap {
        position: relative;
        margin: 0 calc(var(--space-4) * -1);
      }
      .ag-strip-nav {
        display: flex; justify-content: flex-end;
        margin-bottom: 4px;
        padding: 0 var(--space-4);
      }
      .ag-strip-hoje {
        background: var(--bg-subtle);
        border: 1px solid var(--border);
        color: var(--text-secondary);
        border-radius: var(--radius-full);
        padding: 4px 12px;
        font-family: inherit;
        font-size: var(--font-caption);
        font-weight: var(--fw-bold);
        cursor: pointer;
        transition: all var(--dur-fast);
      }
      .ag-strip-hoje:hover {
        background: var(--text-title); color: var(--text-inverse); border-color: var(--text-title);
      }
      .ag-strip {
        display: flex; gap: 8px;
        overflow-x: auto;
        overscroll-behavior-x: contain;
        padding: 6px var(--space-4) 10px;
        scrollbar-width: none;
        scroll-snap-type: x proximity;
      }
      .ag-strip::-webkit-scrollbar { display: none; }
      .ag-day-card {
        flex-shrink: 0;
        scroll-snap-align: center;
        background: var(--bg-card);
        border: 2px solid transparent;
        border-radius: var(--radius-md);
        padding: 10px 14px;
        min-width: 76px;
        display: flex; flex-direction: column; align-items: center; gap: 2px;
        cursor: pointer;
        font-family: inherit;
        box-shadow: var(--shadow-sm);
        position: relative;
        transition: all var(--dur-fast);
      }
      .ag-day-card:hover { transform: translateY(-1px); }
      .ag-day-mes {
        font-size: var(--text-xs);
        color: var(--text-secondary);
        font-weight: var(--fw-semibold);
        letter-spacing: 0.02em;
      }
      .ag-day-num {
        font-size: var(--text-2xl);
        font-weight: var(--fw-black);
        color: var(--text-title);
        letter-spacing: -0.02em;
        line-height: 1.1;
      }
      .ag-day-dow {
        font-size: var(--text-xs);
        color: var(--text-secondary);
        font-weight: var(--fw-medium);
      }
      .ag-day-badge {
        position: absolute;
        top: -6px; right: -6px;
        min-width: 22px; height: 22px;
        border-radius: 50%;
        background: var(--primary);
        color: var(--text-inverse);
        font-size: var(--text-xs);
        font-weight: var(--fw-black);
        display: flex; align-items: center; justify-content: center;
        padding: 0 5px;
        box-shadow: 0 2px 4px rgba(232, 90, 140, 0.35);
      }
      .ag-day-card--hoje {
        border-color: var(--border);
      }
      .ag-day-card--hoje .ag-day-num { color: var(--primary); }
      .ag-day-card--sel {
        background: var(--bg-subtle);
        border-color: var(--primary);
      }
      .ag-day-card--sel .ag-day-mes,
      .ag-day-card--sel .ag-day-num,
      .ag-day-card--sel .ag-day-dow { color: var(--primary-dark); }

      /* ─────────────────────────────────────────────────
         VISTA CALENDÁRIO
         ───────────────────────────────────────────────── */

      /* Data header */
      .ag-data-hdr {
        display: flex; align-items: center; gap: 8px;
        flex-wrap: wrap;
        padding: 4px 2px 0;
      }
      .ag-data-hdr-ic { color: var(--text-secondary); flex-shrink: 0; }
      .ag-data-hdr-txt {
        font-size: var(--text-lg);
        font-weight: var(--fw-black);
        color: var(--text-title);
        letter-spacing: -0.02em;
      }
      .ag-data-hdr-meta {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: var(--text-xs); font-weight: var(--fw-bold);
        padding: 3px 8px;
        border-radius: 6px;
      }
      .ag-data-hdr-meta--qtd {
        color: var(--primary-dark);
        background: var(--bg-subtle);
      }
      .ag-data-hdr-meta--valor {
        color: #14532d;
        background: #dcfce7;
        font-variant-numeric: tabular-nums;
      }

      /* Card do calendário */
      .ag-cal-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: var(--space-4) var(--space-3);
        box-shadow: var(--shadow-sm);
      }
      .ag-cal-nav {
        display: flex; align-items: center; justify-content: space-between;
        gap: var(--space-2);
        margin-bottom: var(--space-3);
        padding: 0 4px;
      }
      .ag-cal-nav-btn {
        width: 32px; height: 32px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--bg-card);
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        color: var(--text-secondary);
        font-family: inherit;
        transition: all var(--dur-fast);
      }
      .ag-cal-nav-btn:hover {
        background: var(--text-title); color: var(--text-inverse); border-color: var(--text-title);
      }
      .ag-cal-titulo-wrap {
        display: flex; align-items: center; gap: var(--space-2);
      }
      .ag-cal-titulo {
        font-size: var(--font-button);
        font-weight: var(--fw-bold);
        color: var(--text-title);
        text-transform: capitalize;
        letter-spacing: var(--ls-tight);
      }
      .ag-cal-hoje {
        background: var(--bg-subtle);
        border: 1px solid var(--border);
        color: var(--text-secondary);
        border-radius: var(--radius-full);
        padding: 3px 10px;
        font-family: inherit;
        font-size: var(--font-caption);
        font-weight: var(--fw-bold);
        cursor: pointer;
        transition: all var(--dur-fast);
      }
      .ag-cal-hoje:hover {
        background: var(--text-title); color: var(--text-inverse); border-color: var(--text-title);
      }
      .ag-cal-dow-hdr {
        display: grid; grid-template-columns: repeat(7, 1fr);
        padding: 0 2px 6px;
      }
      .ag-cal-dow {
        text-align: center;
        font-size: var(--text-xs);
        font-weight: var(--fw-semibold);
        color: var(--text-secondary);
      }
      .ag-cal-grid {
        display: grid; grid-template-columns: repeat(7, 1fr);
        row-gap: 4px;
      }
      .ag-cal-day {
        aspect-ratio: 1;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        font-family: inherit;
        background: transparent;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        position: relative;
        gap: 3px;
        transition: background var(--dur-fast);
      }
      .ag-cal-day:hover { background: var(--bg-subtle); }
      .ag-cal-num {
        font-size: var(--text-sm);
        font-weight: var(--fw-medium);
        color: var(--text-title);
        line-height: 1;
      }
      .ag-cal-day--outro .ag-cal-num { color: var(--text-disabled); }
      .ag-cal-dots {
        display: flex; gap: 2px;
        min-height: 5px;
      }
      .ag-cal-dot {
        width: 4px; height: 4px;
        border-radius: 50%;
      }
      .ag-cal-day--hoje .ag-cal-num {
        color: var(--primary);
        font-weight: var(--fw-black);
      }
      .ag-cal-day--sel {
        background: var(--primary) !important;
        box-shadow: 0 0 0 5px var(--bg-subtle);
      }
      .ag-cal-day--sel .ag-cal-num {
        color: var(--text-inverse);
        font-weight: var(--fw-black);
      }
      .ag-cal-day--sel .ag-cal-dot {
        box-shadow: 0 0 0 1px rgba(255,255,255,0.5);
      }

      /* Legenda */
      .ag-legenda {
        display: flex; justify-content: center; gap: var(--space-4);
        padding: var(--space-2) 0;
        flex-wrap: wrap;
      }
      .ag-legenda-item {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: var(--font-caption);
        color: var(--text-secondary);
        font-weight: var(--fw-medium);
      }
      .ag-legenda-dot { width: 7px; height: 7px; border-radius: 50%; }

      /* ─────────────────────────────────────────────────
         PAINEL DE PEDIDOS (compartilhado)
         ───────────────────────────────────────────────── */
      .ag-pedidos-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: var(--space-4);
        box-shadow: var(--shadow-sm);
        min-height: 200px;
        display: flex; flex-direction: column;
      }
      .ag-pedidos-head {
        display: flex; justify-content: space-between; align-items: flex-start;
        gap: var(--space-3);
        margin-bottom: var(--space-3);
      }
      .ag-pedidos-title-stack {
        display: flex; flex-direction: column;
        gap: 2px;
        margin-bottom: var(--space-1);
      }
      .ag-pedidos-dow {
        font-size: var(--font-modal-title);
        font-weight: var(--fw-black);
        color: var(--text-title);
        text-transform: capitalize;
        letter-spacing: -0.02em;
        line-height: var(--lh-tight);
      }
      .ag-pedidos-data {
        font-size: var(--font-helper);
        color: var(--text-secondary);
        font-weight: var(--fw-semibold);
        text-transform: capitalize;
      }
      .ag-pedidos-title {
        font-size: var(--font-modal-title);
        font-weight: var(--fw-bold);
        color: var(--text-title);
        margin: 0 0 4px;
        text-transform: capitalize;
        letter-spacing: var(--ls-tight);
        line-height: var(--lh-tight);
      }
      .ag-pedidos-sub {
        display: inline-flex; align-items: center; gap: var(--space-2);
        font-size: var(--font-helper);
        color: var(--text-muted);
        margin: 0;
      }
      .ag-rel-pill {
        display: inline-block;
        padding: 2px 8px;
        background: var(--bg-subtle);
        color: var(--primary-dark);
        border-radius: var(--radius-full);
        font-size: var(--text-xs);
        font-weight: var(--fw-black);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .ag-btn-primary {
        display: inline-flex; align-items: center; gap: 5px;
        background: var(--text-title);
        color: var(--text-inverse);
        border: none;
        border-radius: var(--radius-sm);
        padding: 8px 14px;
        font-family: inherit;
        font-size: var(--font-helper);
        font-weight: var(--fw-bold);
        cursor: pointer;
        flex-shrink: 0;
        transition: opacity var(--dur-fast);
      }
      .ag-btn-primary:hover { opacity: 0.9; }

      /* Card de filtro (estilo referência) */
      .ag-filtro-card {
        width: 100%;
        display: flex; align-items: center; gap: var(--space-3);
        padding: 14px 16px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        cursor: pointer;
        font-family: inherit;
        margin-bottom: var(--space-3);
        transition: background var(--dur-fast), border-color var(--dur-fast);
      }
      .ag-filtro-card:hover { background: #F5F1F3; border-color: #D8CDD1; }
      .ag-filtro-card-icon {
        width: 32px; height: 32px;
        border-radius: 8px;
        background: #F0EBED;
        color: var(--text-title);
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .ag-filtro-card-label {
        font-size: var(--text-sm);
        font-weight: var(--fw-bold);
        color: var(--text-title);
      }
      .ag-filtro-card-valor {
        flex: 1;
        text-align: right;
        font-size: var(--text-sm);
        color: var(--text-muted);
        font-weight: var(--fw-medium);
      }

      /* Drawer do filtro */
      .ag-filtro-drawer-overlay {
        position: fixed; inset: 0;
        background: rgba(45, 31, 38, 0.55);
        backdrop-filter: blur(4px);
        display: flex; flex-direction: column;
        justify-content: flex-end;
        z-index: 500;
        animation: agFadeIn 0.2s ease;
      }
      @keyframes agFadeIn { from { opacity: 0; } to { opacity: 1; } }
      .ag-filtro-drawer {
        background: var(--bg-card);
        border-radius: 20px 20px 0 0;
        padding: 12px 16px 20px;
        max-height: 80vh;
        display: flex; flex-direction: column;
        box-shadow: 0 -8px 32px rgba(0,0,0,0.18);
        animation: agSlideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1);
      }
      @keyframes agSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      .ag-filtro-drawer-handle {
        width: 36px; height: 4px;
        border-radius: 2px;
        background: var(--border);
        margin: 0 auto 12px;
      }
      .ag-filtro-drawer-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 4px 4px 12px;
        border-bottom: 1px solid var(--border);
        margin-bottom: var(--space-3);
      }
      .ag-filtro-drawer-title {
        font-size: var(--text-lg);
        font-weight: var(--fw-black);
        color: var(--text-title);
        margin: 0;
        letter-spacing: var(--ls-tight);
      }
      .ag-filtro-drawer-close {
        width: 32px; height: 32px;
        border-radius: 50%;
        background: var(--bg-subtle);
        border: none;
        color: var(--text-secondary);
        font-family: inherit;
        font-size: var(--text-md); font-weight: var(--fw-bold);
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
      }
      .ag-filtro-drawer-body {
        display: flex; flex-direction: column;
        gap: 4px;
        overflow-y: auto;
      }
      .ag-filtro-opcao {
        display: flex; align-items: center; gap: var(--space-3);
        padding: 14px 12px;
        border-radius: 12px;
        cursor: pointer;
        transition: background var(--dur-fast);
        font-family: inherit;
      }
      .ag-filtro-opcao:hover { background: #F5F1F3; }
      .ag-filtro-opcao--on { background: #F5F1F3; }
      .ag-filtro-opcao-check {
        width: 20px; height: 20px;
        accent-color: var(--primary);
        cursor: pointer;
        flex-shrink: 0;
      }
      .ag-filtro-opcao-dot {
        width: 10px; height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .ag-filtro-opcao-label {
        flex: 1;
        font-size: var(--text-sm);
        font-weight: var(--fw-semibold);
        color: var(--text-title);
      }
      .ag-filtro-opcao-cnt {
        font-size: var(--text-xs);
        font-weight: var(--fw-black);
        color: var(--text-muted);
        background: var(--bg-card);
        border: 1px solid var(--border);
        padding: 2px 10px;
        border-radius: var(--radius-full);
        font-variant-numeric: tabular-nums;
      }
      .ag-filtro-drawer-acoes {
        display: flex; align-items: center; gap: var(--space-2);
        margin-top: var(--space-4);
        padding-top: var(--space-3);
        border-top: 1px solid var(--border);
      }
      .ag-filtro-drawer-btn-limpar,
      .ag-filtro-drawer-btn-todos,
      .ag-filtro-drawer-btn-aplicar {
        font-family: inherit;
        font-size: var(--text-xs);
        font-weight: var(--fw-bold);
        cursor: pointer;
        border: none;
        transition: opacity var(--dur-fast), background var(--dur-fast);
      }
      .ag-filtro-drawer-btn-limpar {
        background: transparent;
        color: var(--text-muted);
        padding: 8px 4px;
        text-decoration: underline;
      }
      .ag-filtro-drawer-btn-todos {
        background: transparent;
        color: var(--text-secondary);
        padding: 8px 12px;
        border: 1px solid var(--border);
        border-radius: 8px;
      }
      .ag-filtro-drawer-btn-todos:hover { background: #F5F1F3; }
      .ag-filtro-drawer-btn-aplicar {
        background: var(--text-title);
        color: var(--text-inverse);
        padding: 10px 20px;
        border-radius: 8px;
        margin-left: auto;
      }
      .ag-filtro-drawer-btn-aplicar:hover { opacity: 0.9; }

      /* Label da seção "Pedidos pendentes" */
      .ag-pedidos-secao-lbl {
        text-align: center;
        font-size: var(--text-xs);
        color: var(--text-muted);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        margin: var(--space-2) 0 var(--space-3);
        font-weight: var(--fw-bold);
      }
      .ag-pedidos-lista-rica {
        display: flex; flex-direction: column;
        gap: var(--space-3);
        margin: 0 calc(var(--space-4) * -1);
      }

      /* ── Pedido Card (rico, estilo referência) ── */
      .ag-pc {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: var(--space-4);
        margin: 0 var(--space-4);
        font-family: inherit;
        text-align: left;
      }
      .ag-pc-head {
        display: flex; align-items: flex-start; justify-content: space-between;
        gap: 10px;
        margin-bottom: var(--space-3);
      }
      .ag-pc-avatar {
        position: relative;
        width: 44px; height: 44px;
        border-radius: 12px;
        background: var(--bg-subtle);
        flex-shrink: 0;
        overflow: visible;
        display: flex; align-items: center; justify-content: center;
      }
      .ag-pc-avatar-img {
        width: 100%; height: 100%;
        object-fit: cover;
        border-radius: 12px;
      }
      .ag-pc-avatar-emoji {
        font-size: var(--text-xl);
        line-height: 1;
      }
      .ag-pc-avatar-badge {
        position: absolute;
        bottom: -4px; right: -4px;
        min-width: 20px; height: 20px;
        border-radius: var(--radius-full);
        background: var(--text-title);
        color: var(--text-inverse);
        font-size: 10px;
        font-weight: var(--fw-black);
        display: flex; align-items: center; justify-content: center;
        padding: 0 5px;
        border: 2px solid var(--bg-card);
        font-variant-numeric: tabular-nums;
        line-height: 1;
      }
      .ag-pc-head-info {
        flex: 1; min-width: 0;
        display: flex; flex-direction: column;
        gap: 6px;
        align-items: flex-start;
      }

      .ag-pc-actions {
        display: flex; align-items: center; gap: 4px;
        flex-shrink: 0;
      }

      .ag-pc-menu-wrap {
        position: relative;
      }
      .ag-pc-menu-btn {
        width: 36px; height: 36px;
        border-radius: 8px;
        border: 1px solid #E8E2E4;
        background: #FAFAFA;
        color: #2D1F26;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        font-family: inherit;
        flex-shrink: 0;
        transition: background var(--dur-fast), border-color var(--dur-fast);
      }
      .ag-pc-menu-btn:hover {
        background: #F5F1F3;
        border-color: #D8CDD1;
      }
      .ag-pc-menu-btn[aria-expanded="true"] {
        background: #F0EBED;
        border-color: #D8CDD1;
      }
      .ag-pc-menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        background: var(--bg-card);
        border: 1px solid #E8E2E4;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(45, 31, 38, 0.14);
        min-width: 200px;
        padding: 6px;
        z-index: 20;
        animation: agMenuIn 0.15s ease;
      }
      @keyframes agMenuIn {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .ag-pc-menu-item {
        display: flex; align-items: center; gap: 10px;
        width: 100%;
        padding: 10px 12px;
        border-radius: 8px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-family: inherit;
        font-size: var(--text-sm);
        color: var(--text-title);
        font-weight: var(--fw-semibold);
        text-align: left;
        transition: background var(--dur-fast);
      }
      .ag-pc-menu-item:hover { background: #F5F1F3; }
      .ag-pc-menu-item svg {
        flex-shrink: 0;
        opacity: 0.7;
      }
      .ag-pc-menu-item--danger { color: #D14848; }
      .ag-pc-menu-item--danger:hover { background: #FEF2F2; }
      .ag-pc-menu-divider {
        height: 1px;
        background: #E8E2E4;
        margin: 4px -6px;
      }
      .ag-pc-nome {
        font-size: var(--text-md);
        font-weight: var(--fw-black);
        color: var(--text-title);
        letter-spacing: var(--ls-tight);
        line-height: var(--lh-tight);
        margin: 0;
      }
      .ag-pc-numero {
        font-size: var(--text-sm);
        color: var(--text-muted);
        font-weight: var(--fw-medium);
      }
      .ag-pc-pedido-em {
        font-size: var(--text-xs);
        color: var(--text-muted);
        font-weight: var(--fw-regular);
      }
      .ag-pc-info-label {
        font-weight: var(--fw-regular);
        opacity: 0.9;
      }
      .ag-pc-status-tag {
        display: inline-flex; align-items: center;
        padding: 2px 8px;
        border-radius: var(--radius-full);
        font-size: 10px;
        font-weight: var(--fw-black);
        letter-spacing: 0.02em;
        text-transform: uppercase;
        margin-left: 4px;
      }
      .ag-pc-item-linha--subtotal {
        padding-top: 8px;
        margin-top: 4px;
        border-top: 1px solid var(--border);
      }
      .ag-pc-item-nome {
        color: var(--text-title);
        font-weight: var(--fw-medium);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
        min-width: 0;
      }
      .ag-pc-status {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 3px 9px;
        border-radius: var(--radius-full);
        font-size: 10px;
        font-weight: var(--fw-black);
        letter-spacing: 0.02em;
        text-transform: uppercase;
        white-space: nowrap;
        max-width: 100%;
      }

      .ag-pc-divider {
        height: 1px;
        background: var(--border);
        margin: 0 -16px 12px;
      }

      .ag-pc-info-lines {
        display: flex; flex-direction: column;
        gap: 6px;
      }
      .ag-pc-info-line {
        display: flex; align-items: center; gap: 8px;
        font-size: var(--text-sm);
        font-weight: var(--fw-medium);
      }
      .ag-pc-info-line--entrega { color: #EA580C; font-weight: var(--fw-semibold); }
      .ag-pc-info-line--hoje { color: #EA580C; font-weight: var(--fw-bold); }
      .ag-pc-info-line--pag { font-weight: var(--fw-medium); }
      .ag-pc-info-line--pag-pendente { color: #B8860B; }
      .ag-pc-info-line--pag-parcial { color: #B8860B; }
      .ag-pc-info-line--pag-pago { color: #14532d; }
      .ag-pc-info-line--criado { color: var(--text-muted); font-weight: var(--fw-regular); }
      .ag-pc-pag-label { font-weight: var(--fw-regular); opacity: 0.9; }
      .ag-pc-pag-valor { font-weight: var(--fw-bold); font-variant-numeric: tabular-nums; }

      /* Bloco de itens */
      .ag-pc-itens {
        margin: 14px -16px -16px;
        padding: 14px 16px;
        background: #FAFAFA;
        border-radius: 0 0 16px 16px;
        border-top: 1px solid var(--border);
        display: flex; flex-direction: column;
        gap: 6px;
      }
      .ag-pc-item-linha {
        display: flex; justify-content: space-between; align-items: center;
        font-size: var(--text-sm);
      }
      .ag-pc-item-nome b {
        font-weight: var(--fw-black);
      }
      .ag-pc-item-val {
        color: var(--text-title);
        font-weight: var(--fw-bold);
        font-variant-numeric: tabular-nums;
      }
      .ag-pc-item-desconto { color: #EA580C !important; }
      .ag-pc-item-pago { color: #16A34A !important; }
      .ag-pc-item-linha--total {
        padding-top: 8px;
        margin-top: 4px;
        border-top: 1px solid var(--border);
      }
      .ag-pc-item-linha--total .ag-pc-item-nome,
      .ag-pc-item-linha--total .ag-pc-item-val {
        font-size: var(--text-sm);
        font-weight: var(--fw-black);
      }
      .ag-pc-item-linha--restante {
        padding-top: 8px;
        border-top: 1px solid var(--border);
      }
      .ag-pc-item-linha--restante .ag-pc-item-nome,
      .ag-pc-item-linha--restante .ag-pc-item-val {
        color: var(--primary) !important;
        font-weight: var(--fw-black);
      }


      .ag-loading {
        text-align: center;
        color: var(--text-muted);
        font-size: var(--font-helper);
        padding: var(--space-6) 0;
      }

      /* Empty */
      .ag-empty {
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        text-align: center;
        gap: var(--space-1);
        flex: 1;
        min-height: 200px;
        padding: var(--space-4);
      }
      .ag-empty-icon {
        width: 56px; height: 56px;
        border-radius: 50%;
        background: var(--bg-subtle);
        color: var(--primary);
        display: flex; align-items: center; justify-content: center;
        margin-bottom: var(--space-2);
      }
      .ag-empty-title {
        font-size: var(--font-button);
        font-weight: var(--fw-bold);
        color: var(--text-title);
        margin: 0;
        letter-spacing: var(--ls-tight);
      }
      .ag-empty-sub {
        font-size: var(--font-helper);
        color: var(--text-muted);
        margin: 0;
        max-width: 260px;
        line-height: var(--lh-normal);
      }

      /* Lista de pedidos */
      .ag-pedidos-lista {
        display: flex; flex-direction: column;
        margin: 0 calc(var(--space-4) * -1);
        border-top: 1px solid var(--border);
      }
      .ag-row {
        display: flex; align-items: center; gap: var(--space-3);
        padding: 12px var(--space-4);
        border-bottom: 1px solid var(--border);
        cursor: pointer;
        background: var(--bg-card);
        border-left: none; border-right: none; border-top: none;
        font-family: inherit;
        width: 100%;
        text-align: left;
        transition: background var(--dur-fast);
      }
      .ag-row:hover { background: var(--bg-subtle); }
      .ag-row:last-child { border-bottom: none; }
      .ag-row-img {
        width: 48px; height: 48px;
        border-radius: 12px;
        background: var(--bg-subtle);
        flex-shrink: 0;
        overflow: hidden;
        display: flex; align-items: center; justify-content: center;
      }
      .ag-row-img img { width: 100%; height: 100%; object-fit: cover; }
      .ag-row-emoji { font-size: var(--text-xl); }
      .ag-row-info { flex: 1; min-width: 0; }
      .ag-row-top {
        display: flex; align-items: baseline; justify-content: space-between;
        gap: 8px;
      }
      .ag-row-cliente {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--fw-bold);
        color: var(--text-title);
        letter-spacing: var(--ls-tight);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .ag-row-hora {
        font-size: var(--text-xs);
        font-weight: var(--fw-bold);
        color: var(--primary);
        font-variant-numeric: tabular-nums;
        flex-shrink: 0;
      }
      .ag-row-produto {
        margin: 2px 0 5px;
        font-size: var(--text-xs);
        color: var(--text-secondary);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .ag-row-tags {
        display: flex; gap: 4px;
        flex-wrap: wrap;
      }
      .ag-row-tag {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 2px 7px;
        border-radius: var(--radius-full);
        font-size: 9.5px;
        font-weight: var(--fw-black);
        letter-spacing: 0.03em;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .ag-row-tag-dot { width: 5px; height: 5px; border-radius: 50%; }
      .ag-row-tag--neutral {
        background: var(--bg-subtle);
        color: var(--text-secondary);
        font-weight: var(--fw-bold);
      }
      .ag-row-valor {
        font-size: var(--text-sm);
        font-weight: var(--fw-black);
        color: var(--primary);
        flex-shrink: 0;
        letter-spacing: var(--ls-tight);
      }
    `}</style>
  );
}

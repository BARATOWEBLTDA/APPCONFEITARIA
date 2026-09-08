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
  const [pedidosFiltro, setPedidosFiltro] = useState("todos");

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
      const ini = new Date(refDate); ini.setDate(refDate.getDate() - 30);
      const fim = new Date(refDate); fim.setDate(refDate.getDate() + 60);
      const { data } = await supabase.from("pedidos")
        .select("*, pedido_itens(nome_produto, quantidade, imagem_url, produtos(imagem_url))")
        .eq("user_id", userId)
        .gte("data_entrega", isoDate(ini))
        .lte("data_entrega", isoDate(fim))
        .order("data_entrega", { ascending: true })
        .order("horario_entrega", { ascending: true, nullsFirst: false });
      setPedidos(data || []);
      setLoading(false);
    })();
  }, [userId, refDate]);

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
    () => pedidosDoDia.filter(p => pedidosFiltro === "todos" || p.status === pedidosFiltro),
    [pedidosDoDia, pedidosFiltro]
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
          filtro={pedidosFiltro}
          setFiltro={setPedidosFiltro}
          loading={loading}
          onOpenPedido={(id: string) => navigate(`/pedidos/${id}`)}
          onNovoPedido={() => navigate("/pedidos/novo")}
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
          filtro={pedidosFiltro}
          setFiltro={setPedidosFiltro}
          loading={loading}
          onOpenPedido={(id: string) => navigate(`/pedidos/${id}`)}
          onNovoPedido={() => navigate("/pedidos/novo")}
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
    pedidosDoDia, pedidosFiltrados, countStatus, filtro, setFiltro,
    loading, onOpenPedido, onNovoPedido,
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
        filtro={filtro}
        setFiltro={setFiltro}
        onOpenPedido={onOpenPedido}
        onNovoPedido={onNovoPedido}
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
    pedidosDoDia, pedidosFiltrados, countStatus, filtro, setFiltro,
    loading, onOpenPedido, onNovoPedido,
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
        filtro={filtro}
        setFiltro={setFiltro}
        onOpenPedido={onOpenPedido}
        onNovoPedido={onNovoPedido}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PEDIDOS DO DIA (compartilhado entre Lista e Calendário)
 * ═══════════════════════════════════════════════════════════════════════════ */

function PedidosDoDia({
  diaSel, loading, pedidosDoDia, pedidosFiltrados, countStatus,
  filtro, setFiltro, onOpenPedido, onNovoPedido,
}: any) {
  const d = parseISO(diaSel);
  const rel = relativoLabel(diaSel);
  const dataFmt = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  const FILTROS = [
    { key: "todos",       label: "Todos" },
    { key: "novo",        label: "Novos" },
    { key: "confirmado",  label: "Confirmados" },
    { key: "em_producao", label: "Produção" },
    { key: "pronto",      label: "Prontos" },
    { key: "concluido",   label: "Feitos" },
  ];

  return (
    <div className="ag-pedidos-card">
      <div className="ag-pedidos-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="ag-pedidos-title">{dataFmt}</h2>
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

      {pedidosDoDia.length > 0 && (
        <div className="ag-filtros">
          {FILTROS.map(f => {
            const cnt = f.key === "todos" ? pedidosDoDia.length : (countStatus[f.key] || 0);
            if (f.key !== "todos" && cnt === 0) return null;
            return (
              <button
                key={f.key}
                onClick={() => setFiltro(f.key)}
                className={"ag-filtro" + (filtro === f.key ? " ag-filtro--on" : "")}
              >
                {f.label}
                <span className="ag-filtro-cnt">{cnt}</span>
              </button>
            );
          })}
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
        <div className="ag-pedidos-lista">
          {pedidosFiltrados.map((p: any) => (
            <PedidoRow key={p.id} p={p} onClick={() => onOpenPedido(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Componentes reutilizáveis
 * ═══════════════════════════════════════════════════════════════════════════ */

function PedidoRow({ p, onClick }: any) {
  const primeiroItem = p.pedido_itens?.[0];
  const outrosItens = Math.max(0, (p.pedido_itens?.length || 0) - 1);
  const st = getStatusConfig(p.status);
  const nomeProduto = primeiroItem
    ? `${primeiroItem.nome_produto}${outrosItens > 0 ? ` + ${outrosItens}` : ""}`
    : "Sem produtos";

  return (
    <button className="ag-row" onClick={onClick}>
      <div className="ag-row-img">
        {(primeiroItem?.imagem_url || primeiroItem?.produtos?.imagem_url) ? (
          <img
            src={primeiroItem.imagem_url || primeiroItem.produtos?.imagem_url || ""}
            alt={primeiroItem.nome_produto}
          />
        ) : (
          <span className="ag-row-emoji">🎂</span>
        )}
      </div>
      <div className="ag-row-info">
        <div className="ag-row-top">
          <p className="ag-row-cliente">{p.cliente_nome || "Cliente não informado"}</p>
          {p.horario_entrega && (
            <span className="ag-row-hora">{p.horario_entrega.slice(0, 5)}</span>
          )}
        </div>
        <p className="ag-row-produto">{nomeProduto}</p>
        <div className="ag-row-tags">
          <span className="ag-row-tag" style={{ color: st.color, background: st.bg }}>
            <span className="ag-row-tag-dot" style={{ background: st.dot }} />
            {st.label}
          </span>
          {p.tipo_entrega === "entrega" && <span className="ag-row-tag ag-row-tag--neutral">Entrega</span>}
          {p.tipo_entrega === "retirada" && <span className="ag-row-tag ag-row-tag--neutral">Retirada</span>}
        </div>
      </div>
      <span className="ag-row-valor">{formatMoney(p.valor_total)}</span>
    </button>
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
        padding: 0 0 6rem;
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
        background: var(--bg-subtle);
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
        letter-spacing: -0.01em;
        text-transform: capitalize;
      }
      .ag-hoje-pedidos {
        font-size: var(--font-helper);
        color: var(--text-muted);
        margin-top: 2px;
      }
      .ag-hoje-valor {
        font-size: 22px;
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
        font-size: 11px;
        font-weight: var(--fw-black);
        color: #B8860B;
        background: #FFF3D1;
        padding: 2px 8px;
        border-radius: 6px;
      }
      .ag-hoje-bar {
        height: 8px;
        background: var(--border);
        border-radius: 999px;
        overflow: hidden;
      }
      .ag-hoje-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #22C55E, #16A34A);
        border-radius: 999px;
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
        border-radius: 999px;
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
        border-radius: 14px;
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
        font-size: 11px;
        color: var(--text-secondary);
        font-weight: var(--fw-semibold);
        letter-spacing: 0.02em;
      }
      .ag-day-num {
        font-size: 24px;
        font-weight: var(--fw-black);
        color: var(--text-title);
        letter-spacing: -0.02em;
        line-height: 1.1;
      }
      .ag-day-dow {
        font-size: 11px;
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
        font-size: 11px;
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
        font-size: 17px;
        font-weight: var(--fw-black);
        color: var(--text-title);
        letter-spacing: -0.02em;
      }
      .ag-data-hdr-meta {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 12px; font-weight: var(--fw-bold);
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
        letter-spacing: -0.01em;
      }
      .ag-cal-hoje {
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
      .ag-cal-hoje:hover {
        background: var(--text-title); color: var(--text-inverse); border-color: var(--text-title);
      }
      .ag-cal-dow-hdr {
        display: grid; grid-template-columns: repeat(7, 1fr);
        padding: 0 2px 6px;
      }
      .ag-cal-dow {
        text-align: center;
        font-size: 11px;
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
        font-size: 14px;
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
      .ag-pedidos-title {
        font-size: var(--font-modal-title);
        font-weight: var(--fw-bold);
        color: var(--text-title);
        margin: 0 0 4px;
        text-transform: capitalize;
        letter-spacing: -0.01em;
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
        border-radius: 999px;
        font-size: 10px;
        font-weight: var(--fw-black);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .ag-btn-primary {
        display: inline-flex; align-items: center; gap: 5px;
        background: var(--text-title);
        color: var(--text-inverse);
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
      .ag-btn-primary:hover { opacity: 0.9; }

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
        color: var(--text-inverse);
        border-color: var(--text-title);
      }
      .ag-filtro-cnt {
        font-weight: var(--fw-black);
        font-size: 10px;
        background: var(--bg-subtle);
        color: var(--text-muted);
        padding: 1px 6px;
        border-radius: 999px;
        font-variant-numeric: tabular-nums;
      }
      .ag-filtro--on .ag-filtro-cnt {
        background: rgba(255,255,255,0.2);
        color: var(--text-inverse);
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
        letter-spacing: -0.01em;
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
        display: flex; align-items: center; gap: 12px;
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
      .ag-row-emoji { font-size: 22px; }
      .ag-row-info { flex: 1; min-width: 0; }
      .ag-row-top {
        display: flex; align-items: baseline; justify-content: space-between;
        gap: 8px;
      }
      .ag-row-cliente {
        margin: 0;
        font-size: 14px;
        font-weight: var(--fw-bold);
        color: var(--text-title);
        letter-spacing: -0.01em;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .ag-row-hora {
        font-size: 11px;
        font-weight: var(--fw-bold);
        color: var(--primary);
        font-variant-numeric: tabular-nums;
        flex-shrink: 0;
      }
      .ag-row-produto {
        margin: 2px 0 5px;
        font-size: 12px;
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
        border-radius: 999px;
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
        font-size: 13px;
        font-weight: var(--fw-black);
        color: var(--primary);
        flex-shrink: 0;
        letter-spacing: -0.01em;
      }
    `}</style>
  );
}

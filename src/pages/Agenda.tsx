import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/* ═══════════════════════════════════════════════════════════════════════════
 * Config
 * ═══════════════════════════════════════════════════════════════════════════ */

type ViewMode = "dia" | "semana" | "lista";
const VIEW_KEY = "agenda_view_mode";

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

const DOW_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DOW_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
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

/* Retorna diferença em dias de forma humana */
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

  // Modo de visualização (persistido em localStorage)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "dia";
    const saved = localStorage.getItem(VIEW_KEY) as ViewMode | null;
    return saved && ["dia", "semana", "lista"].includes(saved) ? saved : "dia";
  });

  // Estado do calendário / navegação
  const [refDate, setRefDate] = useState(new Date()); // data de referência (mês/semana visível)
  const [diaSel, setDiaSel] = useState(isoDate(new Date())); // dia selecionado (para vistas dia/semana)

  // Dados
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

  // Persiste modo de visualização
  useEffect(() => {
    localStorage.setItem(VIEW_KEY, viewMode);
  }, [viewMode]);

  /* ─── Busca pedidos do range visível ─── */
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      // Buscamos sempre 90 dias em torno da refDate — cobre navegação sem refetch a cada clique
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

  /* ─── Deriva mapa de contagem por dia ─── */
  const countByDay = useMemo(() => {
    const m: Record<string, number> = {};
    pedidos.forEach(p => {
      if (p.data_entrega && p.status !== "cancelado") {
        m[p.data_entrega] = (m[p.data_entrega] || 0) + 1;
      }
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

  /* ═════════════════════════════════════════════════════════════════════════
   * RENDER
   * ═════════════════════════════════════════════════════════════════════════ */

  return (
    <div className="ag-root">
      <div className="ag-header">
        <h1 className="ag-title">Agenda</h1>
        <p className="ag-sub">Seus pedidos por data de entrega</p>
      </div>

      {/* Toggle de modo de visualização */}
      <div className="ag-toggle" role="tablist" aria-label="Modo de visualização">
        {([
          { key: "dia" as ViewMode, label: "Dia", icon: <IcDia /> },
          { key: "semana" as ViewMode, label: "Semana", icon: <IcSemana /> },
          { key: "lista" as ViewMode, label: "Lista", icon: <IcLista /> },
        ]).map(o => (
          <button
            key={o.key}
            role="tab"
            aria-selected={viewMode === o.key}
            className={"ag-toggle-btn" + (viewMode === o.key ? " ag-toggle-btn--on" : "")}
            onClick={() => setViewMode(o.key)}
          >
            {o.icon}
            <span>{o.label}</span>
          </button>
        ))}
      </div>

      {/* Painel de navegação (Dia ou Semana) */}
      {viewMode === "dia" && (
        <VistaDia
          refDate={refDate}
          setRefDate={setRefDate}
          diaSel={diaSel}
          setDiaSel={setDiaSel}
          countByDay={countByDay}
          irParaHoje={irParaHoje}
        />
      )}

      {viewMode === "semana" && (
        <VistaSemana
          refDate={refDate}
          setRefDate={setRefDate}
          diaSel={diaSel}
          setDiaSel={setDiaSel}
          countByDay={countByDay}
          irParaHoje={irParaHoje}
        />
      )}

      {/* Painel de pedidos */}
      {viewMode === "lista" ? (
        <VistaLista
          pedidos={pedidos}
          countByDay={countByDay}
          onOpenPedido={(id) => navigate(`/pedidos/${id}`)}
          navigate={navigate}
        />
      ) : (
        <PedidosDoDia
          diaSel={diaSel}
          loading={loading}
          pedidosDoDia={pedidosDoDia}
          pedidosFiltrados={pedidosDiaFiltrados}
          countStatus={countStatusDia}
          filtro={pedidosFiltro}
          setFiltro={setPedidosFiltro}
          onOpenPedido={(id) => navigate(`/pedidos/${id}`)}
          onNovoPedido={() => navigate("/pedidos/novo")}
        />
      )}

      <AgendaStyles />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * VISTA DIA — timeline horizontal
 * ═══════════════════════════════════════════════════════════════════════════ */

function VistaDia({ refDate, setRefDate, diaSel, setDiaSel, countByDay, irParaHoje }: any) {
  // Gera dias do mês visível + preenche o início/fim pra completar semanas
  const cells = useMemo(() => {
    const ano = refDate.getFullYear();
    const mes = refDate.getMonth();
    const total = new Date(ano, mes + 1, 0).getDate();
    const primeiroDia = new Date(ano, mes, 1).getDay(); // 0 = domingo
    const list: Array<{ date: Date | null; iso: string | null }> = [];

    // Espaços vazios antes do dia 1
    for (let i = 0; i < primeiroDia; i++) list.push({ date: null, iso: null });
    // Dias do mês
    for (let d = 1; d <= total; d++) {
      const date = new Date(ano, mes, d);
      list.push({ date, iso: isoDate(date) });
    }
    // Espaços vazios pra fechar a última semana
    while (list.length % 7 !== 0) list.push({ date: null, iso: null });
    return list;
  }, [refDate]);

  const hojeISO = isoDate(new Date());

  return (
    <div className="ag-panel">
      <div className="ag-panel-nav">
        <button
          className="ag-nav-btn"
          onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1))}
          aria-label="Mês anterior"
        >
          <ChevronLeft />
        </button>
        <div className="ag-panel-title-wrap">
          <span className="ag-panel-title">
            {refDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </span>
          <button className="ag-btn-hoje" onClick={irParaHoje}>Hoje</button>
        </div>
        <button
          className="ag-nav-btn"
          onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1))}
          aria-label="Próximo mês"
        >
          <ChevronRight />
        </button>
      </div>

      {/* Header dos dias da semana */}
      <div className="ag-dow-header">
        {DOW_SHORT.map((d, i) => (
          <div key={i} className="ag-dow-lbl">{d}</div>
        ))}
      </div>

      {/* Grid multi-linha (mês inteiro sem scroll) */}
      <div className="ag-mes-grid">
        {cells.map((c, i) => {
          if (!c.date || !c.iso) {
            return <div key={"e" + i} className="ag-mes-empty" />;
          }
          const cnt = countByDay[c.iso] || 0;
          const isHoje = c.iso === hojeISO;
          const isSel = c.iso === diaSel;
          return (
            <button
              key={c.iso}
              className={
                "ag-mes-day" +
                (isSel ? " ag-mes-day--sel" : "") +
                (isHoje ? " ag-mes-day--hoje" : "")
              }
              onClick={() => setDiaSel(c.iso!)}
            >
              <span className="ag-mes-num">{c.date.getDate()}</span>
              <span className={"ag-mes-pill" + (cnt === 0 ? " ag-mes-pill--empty" : "")}>
                {cnt > 0 ? cnt : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * VISTA SEMANA — grade de 7 dias
 * ═══════════════════════════════════════════════════════════════════════════ */

function VistaSemana({ refDate, setRefDate, diaSel, setDiaSel, countByDay, irParaHoje }: any) {
  // Começo da semana (domingo)
  const inicioSemana = useMemo(() => {
    const d = new Date(refDate);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, [refDate]);

  const diasSemana = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicioSemana);
      d.setDate(inicioSemana.getDate() + i);
      return d;
    });
  }, [inicioSemana]);

  const fimSemana = diasSemana[6];
  const hojeISO = isoDate(new Date());

  const semanaLabel = useMemo(() => {
    const mesmoMes = inicioSemana.getMonth() === fimSemana.getMonth();
    if (mesmoMes) {
      return `${inicioSemana.getDate()} – ${fimSemana.getDate()} ${MESES_SHORT[inicioSemana.getMonth()].toLowerCase()}`;
    }
    return `${inicioSemana.getDate()} ${MESES_SHORT[inicioSemana.getMonth()].toLowerCase()} – ${fimSemana.getDate()} ${MESES_SHORT[fimSemana.getMonth()].toLowerCase()}`;
  }, [inicioSemana, fimSemana]);

  const navegarSemana = (dir: -1 | 1) => {
    const nova = new Date(refDate);
    nova.setDate(refDate.getDate() + dir * 7);
    setRefDate(nova);
  };

  return (
    <div className="ag-panel">
      <div className="ag-panel-nav">
        <button className="ag-nav-btn" onClick={() => navegarSemana(-1)} aria-label="Semana anterior">
          <ChevronLeft />
        </button>
        <div className="ag-panel-title-wrap">
          <div style={{ textAlign: "center" }}>
            <div className="ag-panel-title">{semanaLabel}</div>
            <div className="ag-panel-subtitle">
              {refDate.toLocaleDateString("pt-BR", { year: "numeric" })}
            </div>
          </div>
          <button className="ag-btn-hoje" onClick={irParaHoje}>Hoje</button>
        </div>
        <button className="ag-nav-btn" onClick={() => navegarSemana(1)} aria-label="Próxima semana">
          <ChevronRight />
        </button>
      </div>

      <div className="ag-semana-grid">
        {diasSemana.map(d => {
          const iso = isoDate(d);
          const cnt = countByDay[iso] || 0;
          const isHoje = iso === hojeISO;
          const isSel = iso === diaSel;
          const dots = Math.min(cnt, 3);
          return (
            <button
              key={iso}
              className={
                "ag-semana-cell" +
                (isSel ? " ag-semana-cell--sel" : "") +
                (isHoje ? " ag-semana-cell--hoje" : "")
              }
              onClick={() => setDiaSel(iso)}
            >
              <span className="ag-semana-dow">{DOW_SHORT[d.getDay()]}</span>
              <span className="ag-semana-num">{d.getDate()}</span>
              <span className="ag-semana-dots">
                {Array.from({ length: dots }).map((_, i) => (
                  <span key={i} className="ag-semana-dot" />
                ))}
                {cnt > 3 && <span className="ag-semana-plus">+{cnt - 3}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * VISTA LISTA — cronograma vertical agrupado por dia (só dias com pedidos)
 * ═══════════════════════════════════════════════════════════════════════════ */

function VistaLista({ pedidos, countByDay, onOpenPedido, navigate }: any) {
  const grupos = useMemo(() => {
    // Agrupa pedidos por data_entrega (só dias >= hoje, ignora cancelados)
    const hojeISO = isoDate(new Date());
    const g: Record<string, any[]> = {};
    pedidos.forEach((p: any) => {
      if (!p.data_entrega || p.status === "cancelado") return;
      if (p.data_entrega < hojeISO) return; // só futuros
      if (!g[p.data_entrega]) g[p.data_entrega] = [];
      g[p.data_entrega].push(p);
    });
    return Object.keys(g)
      .sort()
      .map(dia => ({ dia, itens: g[dia] }));
  }, [pedidos]);

  if (grupos.length === 0) {
    return (
      <div className="ag-panel ag-panel--lista">
        <EmptyState
          titulo="Sem entregas agendadas"
          sub="Você não tem pedidos com data de entrega nos próximos dias"
          cta={<button className="ag-btn-primary" onClick={() => navigate("/pedidos/novo")}>+ Novo pedido</button>}
        />
      </div>
    );
  }

  return (
    <div className="ag-lista-wrap">
      {grupos.map(({ dia, itens }) => {
        const d = parseISO(dia);
        const dif = diffDias(dia);
        const rel = relativoLabel(dia);
        return (
          <section key={dia} className={"ag-grupo" + (dif === 0 ? " ag-grupo--hoje" : "") + (dif === 1 ? " ag-grupo--amanha" : "")}>
            <header className="ag-grupo-head">
              <span className="ag-grupo-num">{d.getDate()}</span>
              <div className="ag-grupo-info">
                <span className="ag-grupo-mes">
                  {MESES_SHORT[d.getMonth()]}{rel ? ` · ${rel}` : ""}
                </span>
                <span className="ag-grupo-dow">{DOW_FULL[d.getDay()]}</span>
              </div>
              <span className="ag-grupo-cnt">
                {itens.length} {itens.length === 1 ? "pedido" : "pedidos"}
              </span>
            </header>
            <div className="ag-grupo-lista">
              {itens.map((p: any) => (
                <PedidoRow key={p.id} p={p} onClick={() => onOpenPedido(p.id)} compact />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PEDIDOS DO DIA (usado nos modos Dia e Semana)
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

function PedidoRow({ p, onClick, compact }: any) {
  const primeiroItem = p.pedido_itens?.[0];
  const outrosItens = Math.max(0, (p.pedido_itens?.length || 0) - 1);
  const st = getStatusConfig(p.status);
  const nomeProduto = primeiroItem
    ? `${primeiroItem.nome_produto}${outrosItens > 0 ? ` + ${outrosItens}` : ""}`
    : "Sem produtos";

  return (
    <button className={"ag-row" + (compact ? " ag-row--compact" : "")} onClick={onClick}>
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
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
const IcDia = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
  </svg>
);
const IcSemana = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="4" x2="9" y2="22"/><line x1="15" y1="4" x2="15" y2="22"/>
  </svg>
);
const IcLista = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>
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

      /* Header da página */
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

      /* Toggle de modo */
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
        padding: 9px 6px;
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

      /* Painel de navegação (Dia/Semana) */
      .ag-panel {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: var(--space-3) var(--space-3) var(--space-2);
        box-shadow: var(--shadow-sm);
      }
      .ag-panel-nav {
        display: flex; align-items: center; justify-content: space-between;
        gap: var(--space-2);
        margin-bottom: var(--space-3);
      }
      .ag-panel-title-wrap {
        display: flex; align-items: center; gap: var(--space-2);
        flex: 1; justify-content: center;
      }
      .ag-panel-title {
        font-size: var(--font-button);
        font-weight: var(--fw-bold);
        color: var(--text-title);
        text-transform: capitalize;
        letter-spacing: -0.01em;
      }
      .ag-panel-subtitle {
        font-size: var(--font-caption);
        color: var(--text-muted);
        font-weight: var(--fw-medium);
        margin-top: 2px;
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
        transition: background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast);
      }
      .ag-btn-hoje:hover {
        background: var(--text-title); color: var(--text-inverse); border-color: var(--text-title);
      }
      .ag-nav-btn {
        width: 34px; height: 34px;
        border-radius: 50%;
        border: 1px solid var(--border);
        background: var(--bg-card);
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        color: var(--text-secondary);
        font-family: inherit;
        transition: background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast);
        flex-shrink: 0;
      }
      .ag-nav-btn:hover {
        background: var(--text-title); color: var(--text-inverse); border-color: var(--text-title);
      }

      /* ── Vista DIA — mês em grid multi-linha ── */
      .ag-dow-header {
        display: grid; grid-template-columns: repeat(7, 1fr);
        gap: 5px;
        margin-bottom: 4px;
        padding: 0 2px;
      }
      .ag-dow-lbl {
        text-align: center;
        font-size: 9px;
        font-weight: var(--fw-black);
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 4px 0;
      }
      .ag-mes-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 5px;
      }
      .ag-mes-empty {
        aspect-ratio: 1;
      }
      .ag-mes-day {
        position: relative;
        aspect-ratio: 1;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 10px;
        cursor: pointer;
        font-family: inherit;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 2px;
        padding: 4px 2px;
        transition: background var(--dur-fast), border-color var(--dur-fast), color var(--dur-fast);
      }
      .ag-mes-day:hover { background: var(--bg-subtle); }
      .ag-mes-num {
        font-size: 15px;
        font-weight: var(--fw-black);
        color: var(--text-title);
        letter-spacing: -0.02em;
        line-height: 1;
      }
      .ag-mes-pill {
        font-size: 9px;
        font-weight: var(--fw-black);
        padding: 1px 6px;
        background: var(--text-title);
        color: var(--text-inverse);
        border-radius: 999px;
        line-height: 1.3;
        min-height: 13px;
        display: inline-flex; align-items: center;
      }
      .ag-mes-pill--empty {
        background: transparent;
        color: transparent;
      }

      /* Hoje = borda rosa + fundo bem sutil + número rosa */
      .ag-mes-day--hoje {
        border-color: var(--primary);
        background: linear-gradient(180deg, var(--primary-light) 0%, var(--bg-card) 60%);
      }
      .ag-mes-day--hoje .ag-mes-num { color: var(--primary); }

      /* Selecionado = grafite forte */
      .ag-mes-day--sel {
        background: var(--text-title);
        border-color: var(--text-title);
      }
      .ag-mes-day--sel .ag-mes-num { color: var(--text-inverse); }
      .ag-mes-day--sel .ag-mes-pill {
        background: var(--text-inverse);
        color: var(--text-title);
      }
      .ag-mes-day--sel .ag-mes-pill--empty { background: transparent; color: transparent; }

      /* Hoje E selecionado ao mesmo tempo */
      .ag-mes-day--sel.ag-mes-day--hoje {
        background: var(--text-title);
        border-color: var(--primary);
        border-width: 2px;
      }
      .ag-mes-day--sel.ag-mes-day--hoje .ag-mes-num { color: var(--text-inverse); }

      /* ── Vista SEMANA — grade de 7 dias ── */
      .ag-semana-grid {
        display: grid; grid-template-columns: repeat(7, 1fr);
        gap: 5px;
      }
      .ag-semana-cell {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 8px 3px 9px;
        display: flex; flex-direction: column; align-items: center;
        gap: 4px;
        cursor: pointer;
        font-family: inherit;
        min-height: 68px;
        transition: background var(--dur-fast), border-color var(--dur-fast), color var(--dur-fast);
      }
      .ag-semana-cell:hover { background: var(--bg-subtle); }
      .ag-semana-dow {
        font-size: 9px;
        font-weight: var(--fw-bold);
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        line-height: 1;
      }
      .ag-semana-num {
        font-size: 15px;
        font-weight: var(--fw-black);
        color: var(--text-title);
        letter-spacing: -0.02em;
        line-height: 1;
      }
      .ag-semana-dots {
        display: flex; align-items: center; justify-content: center;
        gap: 2px;
        margin-top: auto;
        min-height: 6px;
      }
      .ag-semana-dot {
        width: 4px; height: 4px;
        border-radius: 50%;
        background: var(--text-title);
      }
      .ag-semana-plus {
        font-size: 8px;
        font-weight: var(--fw-black);
        color: var(--text-title);
        margin-left: 2px;
      }
      /* Hoje = borda rosa + fundo bem sutil + número rosa */
      .ag-semana-cell--hoje {
        border-color: var(--primary);
        background: linear-gradient(180deg, var(--primary-light) 0%, var(--bg-card) 60%);
      }
      .ag-semana-cell--hoje .ag-semana-num { color: var(--primary); }
      /* Selecionado = grafite */
      .ag-semana-cell--sel {
        background: var(--text-title);
        border-color: var(--text-title);
      }
      .ag-semana-cell--sel .ag-semana-dow,
      .ag-semana-cell--sel .ag-semana-num { color: var(--text-inverse); }
      .ag-semana-cell--sel .ag-semana-dot { background: var(--text-inverse); }
      .ag-semana-cell--sel .ag-semana-plus { color: var(--text-inverse); }
      /* Hoje E selecionado */
      .ag-semana-cell--sel.ag-semana-cell--hoje {
        background: var(--text-title);
        border-color: var(--primary);
        border-width: 2px;
      }
      .ag-semana-cell--sel.ag-semana-cell--hoje .ag-semana-num { color: var(--text-inverse); }

      /* ── Painel de PEDIDOS DO DIA ── */
      .ag-pedidos-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: var(--space-4);
        box-shadow: var(--shadow-sm);
        min-height: 240px;
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
        background: var(--primary-light);
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
        transition: background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast);
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

      /* Empty state */
      .ag-empty {
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        text-align: center;
        gap: var(--space-1);
        flex: 1;
        min-height: 240px;
        padding: var(--space-4);
      }
      .ag-empty-icon {
        width: 62px; height: 62px;
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
        max-width: 280px;
        line-height: var(--lh-normal);
      }

      /* ── Lista de pedidos ── */
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
      .ag-row--compact .ag-row-img { width: 42px; height: 42px; border-radius: 10px; }
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

      /* ── Vista LISTA — cronograma ── */
      .ag-lista-wrap {
        display: flex; flex-direction: column;
        gap: var(--space-4);
      }
      .ag-grupo {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: var(--space-3) var(--space-2) var(--space-2);
        box-shadow: var(--shadow-sm);
      }
      .ag-grupo--hoje { border-color: var(--primary); }
      .ag-grupo--amanha { border-color: var(--warning); }
      .ag-grupo-head {
        display: flex; align-items: center; gap: var(--space-3);
        padding: 0 var(--space-2) var(--space-2);
      }
      .ag-grupo-num {
        font-size: 26px;
        font-weight: var(--fw-black);
        color: var(--text-title);
        line-height: 1;
        letter-spacing: -0.02em;
        flex-shrink: 0;
      }
      .ag-grupo--hoje .ag-grupo-num { color: var(--primary); }
      .ag-grupo--amanha .ag-grupo-num { color: var(--warning); }
      .ag-grupo-info {
        display: flex; flex-direction: column; gap: 2px;
        flex: 1; min-width: 0;
      }
      .ag-grupo-mes {
        font-size: 10px;
        font-weight: var(--fw-black);
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        line-height: 1;
      }
      .ag-grupo-dow {
        font-size: var(--font-helper);
        color: var(--text-title);
        font-weight: var(--fw-semibold);
      }
      .ag-grupo-cnt {
        font-size: 11px;
        font-weight: var(--fw-bold);
        color: var(--text-muted);
        background: var(--bg-subtle);
        padding: 3px 9px;
        border-radius: 999px;
        flex-shrink: 0;
      }
      .ag-grupo-lista {
        display: flex; flex-direction: column;
        border-top: 1px solid var(--border);
        margin: 0 calc(var(--space-2) * -1);
      }
      .ag-grupo-lista .ag-row {
        padding-left: var(--space-3);
        padding-right: var(--space-3);
      }
    `}</style>
  );
}

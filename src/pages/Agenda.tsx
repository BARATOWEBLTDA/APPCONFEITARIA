import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/* ═══════════════════════════════════════════════════════════════════════════
 * CONFIG
 * ═══════════════════════════════════════════════════════════════════════════ */

type ViewMode = "lista" | "calendario";
const VIEW_KEY = "agenda_view_mode";

type StatusGroup = "agendado" | "producao" | "concluido" | "cancelado";

const STATUS_CONFIG: Record<string, { label: string; dot: string; group: StatusGroup }> = {
  novo:         { label: "Novo",         dot: "#7F77DD", group: "agendado" },
  confirmado:   { label: "Confirmado",   dot: "#0891b2", group: "agendado" },
  em_producao:  { label: "Em produção",  dot: "#EF9F27", group: "producao" },
  pronto:       { label: "Pronto",       dot: "#22c55e", group: "concluido" },
  a_caminho:    { label: "A caminho",    dot: "#0ea5e9", group: "concluido" },
  concluido:    { label: "Concluído",    dot: "#9ca3af", group: "concluido" },
  cancelado:    { label: "Cancelado",    dot: "#E24B4A", group: "cancelado" },
};
const getStatusConfig = (s: string) => STATUS_CONFIG[s] || STATUS_CONFIG.novo;

const GROUP_COLORS = {
  agendado: "#7F77DD",
  producao: "#EF9F27",
  concluido: "#22c55e",
  atrasado: "#E24B4A",
};
const GROUP_LABELS = {
  agendado: "Agendados",
  producao: "Em produção",
  concluido: "Prontos",
  atrasado: "Atrasados",
};

const DOW_MINI  = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const DOW_FULL  = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const STATUS_FILTRAVEIS = ["novo", "confirmado", "em_producao", "pronto", "a_caminho", "concluido", "cancelado"];

/* ═══════════════════════════════════════════════════════════════════════════
 * HELPERS
 * ═══════════════════════════════════════════════════════════════════════════ */

const isoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseISO = (iso: string) => new Date(iso + "T12:00:00");

const formatMoney = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const capitalizePrimeira = (s: string) => {
  if (!s) return "";
  const lower = s.toLowerCase().trim();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const truncar = (s: string, max: number) => {
  if (!s || s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
};

/** Retorna as iniciais do nome do cliente (ex: "Ana Silva" → "AS"). */
const getIniciaisCliente = (nome?: string | null): string => {
  if (!nome) return "?";
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
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

const isPedidoAtrasado = (p: any) => {
  if (!p.data_entrega) return false;
  if (p.status === "cancelado" || p.status === "concluido") return false;
  return diffDias(p.data_entrega) < 0;
};

const normalizarTelefone = (tel: string) => (tel || "").replace(/\D/g, "");

const criadoFmt = (created_at: string) => {
  if (!created_at) return "";
  const d = new Date(created_at);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) +
    " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

/* ═══════════════════════════════════════════════════════════════════════════
 * ÍCONES
 * ═══════════════════════════════════════════════════════════════════════════ */

const IconChevLeft = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
const IconChevRight = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
const IconChevDown = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
const IconSearch = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IconFilter = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/></svg>;
const IconPlus = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconDots = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>;
const IconClose = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconTruck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const IconCard = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>;
const IconCheck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>;
const IconEdit = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IconPrint = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>;
const IconTrash = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>;
const IconWhatsApp = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>;
const IconCopy = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
const IconAlerta = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IconImage = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;

/* ═══════════════════════════════════════════════════════════════════════════
 * COMPONENTE PRINCIPAL
 * ═══════════════════════════════════════════════════════════════════════════ */

export default function Agenda() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "calendario";
    const saved = localStorage.getItem(VIEW_KEY) as ViewMode | null;
    return saved && ["lista", "calendario"].includes(saved) ? saved : "calendario";
  });

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 900px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  // Sempre modo calendário (toggle Lista/Calendário foi removido)
  const modoAtual: ViewMode = "calendario";

  const [refDate, setRefDate] = useState(new Date());
  const [diaSel, setDiaSel] = useState(isoDate(new Date()));
  const [busca, setBusca] = useState("");

  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusSelecionados, setStatusSelecionados] = useState<string[]>(STATUS_FILTRAVEIS);
  const [filtroDrawerOpen, setFiltroDrawerOpen] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{ open: boolean; titulo: string; mensagem: string; onConfirm: () => void } | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: "sucesso" | "erro" | "info" } | null>(null);

  const [pedidoIdReagendando, setPedidoIdReagendando] = useState<string | null>(null);

  /* Autenticação */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
  }, []);

  /* Persistência de view */
  useEffect(() => { localStorage.setItem(VIEW_KEY, viewMode); }, [viewMode]);

  /* Busca de pedidos */
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("pedidos")
        .select("*, pedido_itens(nome_produto, quantidade, valor_unitario, imagem_url, produtos(imagem_url)), clientes(foto_url)")
        .eq("user_id", userId)
        .order("data_entrega", { ascending: true, nullsFirst: false })
        .order("horario_entrega", { ascending: true, nullsFirst: false });

      const pedidosNormalizados = (data || []).map((p: any) => ({
        ...p,
        data_entrega: p.data_entrega || (p.created_at ? p.created_at.slice(0, 10) : null),
      }));
      setPedidos(pedidosNormalizados);
      setLoading(false);
    })();
  }, [userId]);

  /* Toast auto-dismiss */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  /* Pedidos filtrados por busca (aplicado antes de qualquer outra coisa) */
  const pedidosBuscados = useMemo(() => {
    if (!busca.trim()) return pedidos;
    const q = busca.toLowerCase().trim();
    return pedidos.filter(p =>
      (p.cliente_nome || "").toLowerCase().includes(q) ||
      (p.numero != null && String(p.numero).includes(q))
    );
  }, [pedidos, busca]);

  /* Mapa por dia com contagens por grupo + atrasado */
  const dayStats = useMemo(() => {
    const m: Record<string, { total: number; agendado: number; producao: number; concluido: number; atrasado: number }> = {};
    pedidosBuscados.forEach(p => {
      if (!p.data_entrega || p.status === "cancelado") return;
      if (!m[p.data_entrega]) m[p.data_entrega] = { total: 0, agendado: 0, producao: 0, concluido: 0, atrasado: 0 };
      m[p.data_entrega].total++;
      const g = getStatusConfig(p.status).group;
      if (g === "agendado") m[p.data_entrega].agendado++;
      else if (g === "producao") m[p.data_entrega].producao++;
      else if (g === "concluido") m[p.data_entrega].concluido++;
      if (isPedidoAtrasado(p)) m[p.data_entrega].atrasado++;
    });
    return m;
  }, [pedidosBuscados]);

  const pedidosDoDia = useMemo(() =>
    pedidosBuscados
      .filter(p => p.data_entrega === diaSel && p.status !== "cancelado")
      .sort((a, b) => (a.horario_entrega || "99").localeCompare(b.horario_entrega || "99")),
    [pedidosBuscados, diaSel]
  );

  const pedidosDiaFiltrados = useMemo(
    () => pedidosDoDia.filter((p: any) => statusSelecionados.includes(p.status)),
    [pedidosDoDia, statusSelecionados]
  );

  const countStatusDia = useMemo(() => {
    const m: Record<string, number> = {};
    pedidosBuscados.filter(p => p.data_entrega === diaSel).forEach(p => {
      m[p.status] = (m[p.status] || 0) + 1;
    });
    return m;
  }, [pedidosBuscados, diaSel]);

  const irParaHoje = useCallback(() => {
    const h = new Date();
    setRefDate(h);
    setDiaSel(isoDate(h));
  }, []);

  /* ── Ações ── */
  const abrirEditar = (id: string) => navigate(`/pedidos/${id}`);

  const marcarComoPronto = async (id: string) => {
    const { error } = await supabase.from("pedidos").update({ status: "pronto" }).eq("id", id);
    if (error) {
      setToast({ msg: "Erro ao atualizar status", tipo: "erro" });
      return;
    }
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, status: "pronto" } : p));
    setToast({ msg: "Pedido marcado como pronto ✓", tipo: "sucesso" });
  };

  const abrirWhatsApp = (p: any) => {
    const tel = normalizarTelefone(p.cliente_whatsapp || p.cliente_telefone || "");
    if (!tel) {
      setToast({ msg: "Cliente sem telefone/WhatsApp cadastrado", tipo: "erro" });
      return;
    }
    const numero = tel.startsWith("55") ? tel : `55${tel}`;
    const msg = encodeURIComponent(`Olá, ${p.cliente_nome || ""}! Sobre seu pedido #${p.numero || ""}...`);
    window.open(`https://wa.me/${numero}?text=${msg}`, "_blank");
  };

  const duplicarPedido = (id: string) => {
    navigate(`/pedidos/novo?duplicar=${id}`);
  };

  const excluirPedido = (id: string) => {
    setConfirmModal({
      open: true,
      titulo: "Excluir pedido?",
      mensagem: "Essa ação não pode ser desfeita. O pedido e seus itens serão removidos permanentemente.",
      onConfirm: async () => {
        setConfirmModal(null);
        const { error } = await supabase.from("pedidos").delete().eq("id", id);
        if (error) {
          setToast({ msg: "Erro ao excluir: " + error.message, tipo: "erro" });
          return;
        }
        setPedidos(prev => prev.filter(p => p.id !== id));
        setToast({ msg: "Pedido excluído com sucesso", tipo: "sucesso" });
      },
    });
  };

  const reagendarPedido = (id: string) => setPedidoIdReagendando(id);

  const confirmarReagendamento = async (novaData: string) => {
    if (!pedidoIdReagendando) return;
    const { error } = await supabase.from("pedidos").update({ data_entrega: novaData }).eq("id", pedidoIdReagendando);
    if (error) {
      setToast({ msg: "Erro ao reagendar", tipo: "erro" });
      return;
    }
    setPedidos(prev => prev.map(p => p.id === pedidoIdReagendando ? { ...p, data_entrega: novaData } : p));
    setToast({ msg: "Pedido reagendado ✓", tipo: "sucesso" });
    setPedidoIdReagendando(null);
  };

  const acoes = {
    editar: abrirEditar,
    marcarPronto: marcarComoPronto,
    whatsapp: abrirWhatsApp,
    duplicar: duplicarPedido,
    reagendar: reagendarPedido,
    excluir: excluirPedido,
    imprimir: () => setToast({ msg: "Exportar / imprimir: em breve", tipo: "info" }),
  };

  /* ═══ Render ═══ */
  return (
    <div className="ag-root">
      {/* Header */}
      <div className="ag-header">
        <h1 className="ag-title">Agenda</h1>
        <p className="ag-sub">Seus pedidos por data de entrega</p>
      </div>

      {/* Busca + Filtro (topo) */}
      <div className="ag-search-row">
        <div className="ag-search">
          <IconSearch />
          <input
            type="text"
            placeholder="Buscar cliente ou número do pedido..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="ag-search-input"
            aria-label="Buscar pedidos"
          />
          {busca && (
            <button className="ag-search-clear" onClick={() => setBusca("")} aria-label="Limpar busca">
              <IconClose />
            </button>
          )}
        </div>
        <FiltroCard
          statusSelecionados={statusSelecionados}
          countStatusDia={countStatusDia}
          onOpen={() => setFiltroDrawerOpen(true)}
        />
      </div>

      {/* Vista (sempre calendário) */}
      <div className="ag-desk-grid">
        <VistaCalendario
          refDate={refDate}
          setRefDate={setRefDate}
          diaSel={diaSel}
          setDiaSel={setDiaSel}
          dayStats={dayStats}
          irParaHoje={irParaHoje}
        />

      {/* Coluna direita (desktop) / abaixo (mobile calendário) */}
      <div className="ag-desk-side">
      {/* Card de resumo do dia (sempre, em ambas as abas) */}
      <ResumoDoDia diaSel={diaSel} pedidosDoDia={pedidosDoDia} dayStats={dayStats} />

      {/* Lista de pedidos do dia */}
      <PedidosDoDia
        loading={loading}
        pedidosDoDia={pedidosDoDia}
        pedidosFiltrados={pedidosDiaFiltrados}
        acoes={acoes}
      />
      </div>
      </div>

      {/* Drawer de filtro */}
      {filtroDrawerOpen && (
        <FiltroDrawer
          statusSelecionados={statusSelecionados}
          setStatusSelecionados={setStatusSelecionados}
          countStatusDia={countStatusDia}
          onClose={() => setFiltroDrawerOpen(false)}
        />
      )}

      {/* Modal de confirmação */}
      {confirmModal?.open && (
        <ConfirmModal
          titulo={confirmModal.titulo}
          mensagem={confirmModal.mensagem}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {/* Modal reagendar */}
      {pedidoIdReagendando && (
        <ReagendarModal
          onConfirm={confirmarReagendamento}
          onCancel={() => setPedidoIdReagendando(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast.msg} tipo={toast.tipo} />}

      {/* FAB */}
      <button
        className="ag-fab"
        onClick={() => navigate("/pedidos/novo")}
        aria-label="Novo pedido"
      >
        <IconPlus />
      </button>

      <AgendaStyles />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * VISTA LISTA — carrossel horizontal de dias
 * ═══════════════════════════════════════════════════════════════════════════ */

function VistaLista({ diaSel, setDiaSel, dayStats }: any) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const primeiraCarga = useRef(true);
  const [hojeISO, setHojeISO] = useState(() => isoDate(new Date()));

  // Detecta virada de dia
  useEffect(() => {
    const interval = setInterval(() => {
      const novo = isoDate(new Date());
      if (novo !== hojeISO) setHojeISO(novo);
    }, 60000);
    return () => clearInterval(interval);
  }, [hojeISO]);

  // Gera 60 dias: hoje - 7 até hoje + 52
  const dias = useMemo(() => {
    const list: Date[] = [];
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 7);
    for (let i = 0; i < 60; i++) {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      list.push(d);
    }
    return list;
  }, [hojeISO]);

  // Auto-scroll pro dia selecionado só na primeira renderização
  useEffect(() => {
    if (!scrollRef.current) return;
    if (!primeiraCarga.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>(`[data-day="${diaSel}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
      primeiraCarga.current = false;
    }
  }, [diaSel]);

  const irParaHojeCarrossel = () => {
    setDiaSel(hojeISO);
    setTimeout(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>(`[data-day="${hojeISO}"]`);
      el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }, 50);
  };

  return (
    <div className="ag-strip-wrap">
      <div className="ag-strip-nav">
        <span className="ag-strip-lbl">Navegar por dia</span>
        <button className="ag-strip-hoje" onClick={irParaHojeCarrossel}>Hoje</button>
      </div>
      <div className="ag-strip" ref={scrollRef}>
        {dias.map(d => {
          const iso = isoDate(d);
          const st = dayStats[iso];
          const cnt = st?.total || 0;
          const atrasadoCnt = st?.atrasado || 0;
          const isSel = iso === diaSel;
          const isHoje = iso === hojeISO;
          return (
            <button
              key={iso}
              data-day={iso}
              className={
                "ag-day-card" +
                (isSel ? " ag-day-card--sel" : "") +
                (isHoje ? " ag-day-card--hoje" : "") +
                (atrasadoCnt > 0 && !isSel ? " ag-day-card--atrasado" : "")
              }
              onClick={() => setDiaSel(iso)}
              aria-label={`Selecionar ${d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}`}
            >
              <span className="ag-day-mes">{MESES_SHORT[d.getMonth()]}</span>
              <span className="ag-day-num">{d.getDate()}</span>
              <span className="ag-day-dow">{DOW_FULL[d.getDay()].slice(0, 3)}</span>
              {cnt > 0 && <span className="ag-day-badge">{cnt}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * VISTA CALENDÁRIO — mês completo
 * ═══════════════════════════════════════════════════════════════════════════ */

function VistaCalendario({ refDate, setRefDate, diaSel, setDiaSel, dayStats, irParaHoje }: any) {
  const cells = useMemo(() => {
    const ano = refDate.getFullYear();
    const mes = refDate.getMonth();
    const primeiroDia = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const list: Array<{ date: Date; iso: string; outroMes: boolean }> = [];

    for (let i = primeiroDia - 1; i >= 0; i--) {
      const d = new Date(ano, mes, -i);
      list.push({ date: d, iso: isoDate(d), outroMes: true });
    }
    for (let d = 1; d <= totalDias; d++) {
      const date = new Date(ano, mes, d);
      list.push({ date, iso: isoDate(date), outroMes: false });
    }
    let extra = 1;
    while (list.length % 7 !== 0) {
      const d = new Date(ano, mes + 1, extra);
      list.push({ date: d, iso: isoDate(d), outroMes: true });
      extra++;
    }
    return list;
  }, [refDate]);

  const hojeISO = isoDate(new Date());

  return (
    <div className="ag-cal-card">
      <div className="ag-cal-nav">
        <button
          className="ag-cal-nav-btn"
          onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1))}
          aria-label="Mês anterior"
        ><IconChevLeft /></button>
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
        ><IconChevRight /></button>
      </div>

      <div className="ag-cal-dow-hdr">
        {DOW_MINI.map((d, i) => <div key={i} className="ag-cal-dow">{d}</div>)}
      </div>

      <div className="ag-cal-grid">
        {cells.map(c => {
          const st = dayStats[c.iso];
          const isSel = c.iso === diaSel;
          const isHoje = c.iso === hojeISO && !c.outroMes;
          const atrasadoCnt = st?.atrasado || 0;
          return (
            <button
              key={c.iso + (c.outroMes ? "-o" : "")}
              className={
                "ag-cal-day" +
                (c.outroMes ? " ag-cal-day--outro" : "") +
                (isSel ? " ag-cal-day--sel" : "") +
                (isHoje ? " ag-cal-day--hoje" : "") +
                (atrasadoCnt > 0 && !isSel ? " ag-cal-day--atrasado" : "")
              }
              onClick={() => setDiaSel(c.iso)}
              aria-label={`${c.date.getDate()} de ${MESES_SHORT[c.date.getMonth()]}${st ? `, ${st.total} pedidos` : ""}`}
            >
              <span className="ag-cal-num">{c.date.getDate()}</span>
              {st && st.total > 0 && (
                <span className="ag-cal-dots">
                  {atrasadoCnt > 0 && <span className="ag-cal-dot" style={{ background: GROUP_COLORS.atrasado }} />}
                  {st.agendado > 0 && <span className="ag-cal-dot" style={{ background: GROUP_COLORS.agendado }} />}
                  {st.producao > 0 && <span className="ag-cal-dot" style={{ background: GROUP_COLORS.producao }} />}
                  {st.concluido > 0 && <span className="ag-cal-dot" style={{ background: GROUP_COLORS.concluido }} />}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="ag-legenda">
        <span className="ag-legenda-item"><span className="ag-legenda-dot" style={{ background: GROUP_COLORS.agendado }} />Agendado</span>
        <span className="ag-legenda-item"><span className="ag-legenda-dot" style={{ background: GROUP_COLORS.producao }} />Produção</span>
        <span className="ag-legenda-item"><span className="ag-legenda-dot" style={{ background: GROUP_COLORS.concluido }} />Pronto</span>
        <span className="ag-legenda-item"><span className="ag-legenda-dot" style={{ background: GROUP_COLORS.atrasado }} />Atrasado</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * RESUMO DO DIA — card com stats coloridos
 * ═══════════════════════════════════════════════════════════════════════════ */

function ResumoDoDia({ diaSel, pedidosDoDia, dayStats }: any) {
  const d = parseISO(diaSel);
  const rel = relativoLabel(diaSel);
  const diaLabel = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" });
  const valorTotal = useMemo(
    () => pedidosDoDia.reduce((s: number, p: any) => s + (Number(p.valor_total) || 0), 0),
    [pedidosDoDia]
  );
  const st = dayStats[diaSel] || { total: 0, agendado: 0, producao: 0, concluido: 0, atrasado: 0 };

  return (
    <div className="ag-resumo">
      <div className="ag-resumo-top">
        <div className="ag-resumo-info">
          <div className="ag-resumo-dia">{diaLabel}</div>
          <div className="ag-resumo-meta">
            {rel && <span className="ag-resumo-rel">{rel}</span>}
            <span>{st.total === 0 ? "Nenhum pedido" : `${st.total} pedido${st.total !== 1 ? "s" : ""}`}</span>
          </div>
        </div>
        <div className="ag-resumo-valor">{formatMoney(valorTotal)}</div>
      </div>

      {st.total > 0 && (
        <div className="ag-resumo-stats">
          <StatMini num={st.agendado} label="Agendado" cor="roxo" />
          <StatMini num={st.producao} label="Produção" cor="laranja" />
          <StatMini num={st.concluido} label="Pronto" cor="verde" />
          <StatMini num={st.atrasado} label="Atrasado" cor="vermelho" />
        </div>
      )}
    </div>
  );
}

function StatMini({ num, label, cor }: any) {
  return (
    <div className={"ag-stat-mini ag-stat-mini--" + cor}>
      <span className="ag-stat-num">{num}</span>
      <span className="ag-stat-lbl">{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * FILTRO CARD (botão que abre o drawer)
 * ═══════════════════════════════════════════════════════════════════════════ */

function FiltroCard({ statusSelecionados, countStatusDia, onOpen }: any) {
  const totalFiltros = STATUS_FILTRAVEIS.length;
  const ativos = statusSelecionados.length;
  const totalPedidosDia = Object.values(countStatusDia).reduce((s: number, n: any) => s + (Number(n) || 0), 0) as number;

  const dotsAtivos = statusSelecionados
    .filter((s: string) => countStatusDia[s] > 0)
    .slice(0, 5)
    .map((s: string) => getStatusConfig(s).dot);

  return (
    <button className="ag-filtro-card" onClick={onOpen} aria-label="Abrir filtros">
      <span className="ag-filtro-card-icon"><IconFilter /></span>
      <span className="ag-filtro-card-label">Filtros</span>
      {dotsAtivos.length > 0 ? (
        <span className="ag-filtro-card-dots">
          {dotsAtivos.map((d: string, i: number) => (
            <span key={i} className="ag-filtro-card-dot" style={{ background: d }} />
          ))}
        </span>
      ) : (
        <span className="ag-filtro-card-empty">Nenhum</span>
      )}
      <span className="ag-filtro-card-info">{ativos} de {totalFiltros}{totalPedidosDia > 0 ? ` · ${totalPedidosDia}` : ""}</span>
      <IconChevDown />
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * FILTRO DRAWER
 * ═══════════════════════════════════════════════════════════════════════════ */

function FiltroDrawer({ statusSelecionados, setStatusSelecionados, countStatusDia, onClose }: any) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const toggleStatus = (s: string) => {
    if (statusSelecionados.includes(s)) {
      setStatusSelecionados(statusSelecionados.filter((x: string) => x !== s));
    } else {
      setStatusSelecionados([...statusSelecionados, s]);
    }
  };

  return (
    <div className="ag-drawer-overlay" onClick={onClose}>
      <div className="ag-drawer" onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="filtro-titulo">
        <div className="ag-drawer-handle" />
        <div className="ag-drawer-head">
          <h3 className="ag-drawer-title" id="filtro-titulo">Filtros de status</h3>
          <button className="ag-drawer-close" onClick={onClose} aria-label="Fechar"><IconClose /></button>
        </div>
        <div className="ag-drawer-body">
          {STATUS_FILTRAVEIS.map(s => {
            const cfg = getStatusConfig(s);
            const marcado = statusSelecionados.includes(s);
            const qtd = countStatusDia[s] || 0;
            return (
              <label key={s} className={"ag-opcao" + (marcado ? " ag-opcao--on" : "")}>
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => toggleStatus(s)}
                  className="ag-opcao-check"
                />
                <span className="ag-opcao-dot" style={{ background: cfg.dot }} />
                <span className="ag-opcao-label">{cfg.label}</span>
                <span className="ag-opcao-cnt">{qtd}</span>
              </label>
            );
          })}
        </div>
        <div className="ag-drawer-acoes">
          <button className="ag-drawer-btn-limpar" onClick={() => setStatusSelecionados([])}>Limpar</button>
          <button className="ag-drawer-btn-todos" onClick={() => setStatusSelecionados(STATUS_FILTRAVEIS)}>Selecionar todos</button>
          <button className="ag-drawer-btn-aplicar" onClick={onClose}>Aplicar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * LISTA DE PEDIDOS DO DIA
 * ═══════════════════════════════════════════════════════════════════════════ */

function PedidosDoDia({ loading, pedidosDoDia, pedidosFiltrados, acoes }: any) {
  if (loading) {
    return <div className="ag-loading">Carregando pedidos…</div>;
  }
  if (pedidosDoDia.length === 0) {
    return <EmptyState titulo="Nada agendado" sub="Não há pedidos para essa data" />;
  }
  if (pedidosFiltrados.length === 0) {
    return <EmptyState titulo="Nenhum pedido nesse filtro" sub="Ajuste os filtros para ver mais pedidos" />;
  }

  return (
    <div className="ag-lista">
      <div className="ag-secao-lbl">Pedidos do dia</div>
      {pedidosFiltrados.map((p: any) => (
        <PedidoCard key={p.id} p={p} acoes={acoes} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PEDIDO CARD
 * ═══════════════════════════════════════════════════════════════════════════ */

function PedidoCard({ p, acoes }: any) {
  const st = getStatusConfig(p.status);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const atrasado = isPedidoAtrasado(p);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [menuOpen]);

  // Cálculos financeiros (baseados nos itens, seguros)
  const itens = p.pedido_itens || [];
  const subtotalItens = itens.reduce((s: number, it: any) => s + (Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 0), 0);
  const subtotal = subtotalItens > 0 ? subtotalItens : Number(p.valor_produtos) || 0;
  const desconto = Number(p.desconto) || 0;
  const total = Number(p.valor_total) || subtotal - desconto;
  const adiantamento = Number(p.valor_sinal) || Number(p.valor_recebido) || 0;
  const restante = total - adiantamento;

  // Info de entrega
  const entregaRel = p.data_entrega ? (relativoLabel(p.data_entrega) || parseISO(p.data_entrega).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })) : "";
  const primeiro = itens[0];
  const src = primeiro?.imagem_url || primeiro?.produtos?.imagem_url;
  const extras = Math.max(0, itens.length - 1);

  // Status de pagamento
  const pagamentoStatus = p.status_pagamento || (adiantamento >= total && total > 0 ? "pago" : adiantamento > 0 ? "parcial" : "pendente");
  const pagamentoLabel = pagamentoStatus === "pago" ? "Pagamento realizado"
    : pagamentoStatus === "parcial" ? "Pagamento parcial (sinal)"
    : "Pagamento pendente";

  return (
    <article className={"ag-pc" + (atrasado ? " ag-pc--atrasado" : "")}>
      {atrasado && (
        <div className="ag-pc-alerta"><IconAlerta /> Pedido atrasado</div>
      )}

      {/* Header */}
      <div className="ag-pc-head">
        <div className="ag-pc-avatar">
          {src ? (
            <img src={src} alt={primeiro?.nome_produto || ""} className="ag-pc-avatar-img" />
          ) : (
            <span className="ag-pc-avatar-icon"><IconImage /></span>
          )}
          {extras > 0 && <span className="ag-pc-avatar-badge">+{extras}</span>}
        </div>
        <div className="ag-pc-head-info">
          <p className="ag-pc-nome">
            <span className="ag-cli-avatar" aria-hidden="true">
              {p.clientes?.foto_url ? (
                <img src={p.clientes.foto_url} alt="" />
              ) : (
                <span className="ag-cli-avatar-iniciais">{getIniciaisCliente(p.cliente_nome)}</span>
              )}
            </span>
            <span className="ag-pc-nome-texto">
              {p.cliente_nome || "Cliente não informado"}
              {p.numero != null && <span className="ag-pc-numero"> #{p.numero}</span>}
            </span>
          </p>
          {p.created_at && (
            <span className="ag-pc-pedido-em">Pedido em {criadoFmt(p.created_at)}</span>
          )}
        </div>
        <div className="ag-pc-menu-wrap" ref={menuRef}>
          <button
            className="ag-pc-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Ações do pedido"
            aria-expanded={menuOpen}
          ><IconDots /></button>
          {menuOpen && (
            <div className="ag-pc-menu" role="menu">
              <button className="ag-pc-menu-item" onClick={() => { setMenuOpen(false); acoes.editar(p.id); }}>
                <IconEdit /> Editar pedido
              </button>
              {p.status !== "pronto" && p.status !== "concluido" && (
                <button className="ag-pc-menu-item" onClick={() => { setMenuOpen(false); acoes.marcarPronto(p.id); }}>
                  <IconCheck /> Marcar como pronto
                </button>
              )}
              <button className="ag-pc-menu-item" onClick={() => { setMenuOpen(false); acoes.reagendar(p.id); }}>
                <IconTruck /> Reagendar entrega
              </button>
              <button className="ag-pc-menu-item" onClick={() => { setMenuOpen(false); acoes.duplicar(p.id); }}>
                <IconCopy /> Duplicar pedido
              </button>
              <button className="ag-pc-menu-item" onClick={() => { setMenuOpen(false); acoes.imprimir(); }}>
                <IconPrint /> Exportar / Imprimir
              </button>
              <div className="ag-pc-menu-divider" />
              <button className="ag-pc-menu-item ag-pc-menu-item--danger" onClick={() => { setMenuOpen(false); acoes.excluir(p.id); }}>
                <IconTrash /> Excluir pedido
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="ag-pc-quick">
        {p.status !== "pronto" && p.status !== "concluido" && (
          <button className="ag-pc-quick-btn ag-pc-quick-btn--pronto" onClick={() => acoes.marcarPronto(p.id)}>
            <IconCheck /> Marcar pronto
          </button>
        )}
        <button className="ag-pc-quick-btn ag-pc-quick-btn--wpp" onClick={() => acoes.whatsapp(p)}>
          <IconWhatsApp /> WhatsApp
        </button>
      </div>

      <div className="ag-pc-divider" />

      {/* Info-lines */}
      <div className="ag-pc-info-lines">
        <div className="ag-pc-info-line">
          <span className="ag-pc-info-ic"><IconCheck /></span>
          <span className="ag-pc-info-label">Status</span>
          <span className="ag-pc-status-tag" style={{ background: st.dot }}>{st.label}</span>
        </div>
        {entregaRel && (
          <div className={"ag-pc-info-line ag-pc-info-line--entrega" + (atrasado ? " ag-pc-info-line--atraso" : "")}>
            <span className="ag-pc-info-ic"><IconTruck /></span>
            <span>
              Entrega {entregaRel}
              {p.horario_entrega && ` às ${p.horario_entrega.slice(0, 5)}`}
              {atrasado && <b> (atrasado)</b>}
            </span>
          </div>
        )}
        <div className={"ag-pc-info-line ag-pc-info-line--pag ag-pc-info-line--pag-" + pagamentoStatus}>
          <span className="ag-pc-info-ic"><IconCard /></span>
          <span>{pagamentoLabel}</span>
        </div>
      </div>

      {/* Bloco itens + totais */}
      <div className="ag-pc-itens">
        {itens.length > 0 ? itens.map((item: any, idx: number) => {
          const nome = truncar(capitalizePrimeira(item.nome_produto || ""), 20);
          const valItem = (Number(item.valor_unitario) || 0) * (Number(item.quantidade) || 0);
          return (
            <div key={idx} className="ag-pc-item">
              <span className="ag-pc-item-nome"><b>{item.quantidade}x</b> {nome}</span>
              <span className="ag-pc-item-val">{formatMoney(valItem)}</span>
            </div>
          );
        }) : (
          <div className="ag-pc-item ag-pc-item--vazio">Sem itens</div>
        )}

        <div className="ag-pc-tot ag-pc-tot--subtotal">
          <span>Subtotal</span>
          <span>{formatMoney(subtotal)}</span>
        </div>

        {desconto > 0 && (
          <div className="ag-pc-tot ag-pc-tot--desconto">
            <span>Desconto</span>
            <span>- {formatMoney(desconto)}</span>
          </div>
        )}

        {adiantamento > 0 ? (
          <>
            <div className="ag-pc-tot ag-pc-tot--sinal">
              <span>Sinal recebido</span>
              <span>- {formatMoney(adiantamento)}</span>
            </div>
            <div className="ag-pc-tot ag-pc-tot--falta">
              <span>Falta receber</span>
              <span>{formatMoney(restante)}</span>
            </div>
          </>
        ) : (
          <div className="ag-pc-tot ag-pc-tot--total">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>
        )}
      </div>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * CONFIRM MODAL
 * ═══════════════════════════════════════════════════════════════════════════ */

function ConfirmModal({ titulo, mensagem, onConfirm, onCancel }: any) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onCancel]);

  return (
    <div className="ag-modal-overlay" onClick={onCancel}>
      <div className="ag-modal" onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="confirm-titulo">
        <div className="ag-modal-icon"><IconAlerta /></div>
        <h3 className="ag-modal-title" id="confirm-titulo">{titulo}</h3>
        <p className="ag-modal-msg">{mensagem}</p>
        <div className="ag-modal-acoes">
          <button className="ag-modal-btn ag-modal-btn--cancel" onClick={onCancel}>Cancelar</button>
          <button className="ag-modal-btn ag-modal-btn--confirm" onClick={onConfirm}>Sim, excluir</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * REAGENDAR MODAL
 * ═══════════════════════════════════════════════════════════════════════════ */

function ReagendarModal({ onConfirm, onCancel }: any) {
  const [novaData, setNovaData] = useState(isoDate(new Date()));

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onCancel]);

  return (
    <div className="ag-modal-overlay" onClick={onCancel}>
      <div className="ag-modal" onClick={e => e.stopPropagation()} role="dialog">
        <div className="ag-modal-icon ag-modal-icon--info"><IconTruck /></div>
        <h3 className="ag-modal-title">Reagendar entrega</h3>
        <p className="ag-modal-msg">Escolha a nova data de entrega:</p>
        <input
          type="date"
          value={novaData}
          onChange={e => setNovaData(e.target.value)}
          className="ag-modal-input"
          min={isoDate(new Date())}
        />
        <div className="ag-modal-acoes">
          <button className="ag-modal-btn ag-modal-btn--cancel" onClick={onCancel}>Cancelar</button>
          <button className="ag-modal-btn ag-modal-btn--primary" onClick={() => onConfirm(novaData)}>Reagendar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * TOAST
 * ═══════════════════════════════════════════════════════════════════════════ */

function Toast({ msg, tipo }: any) {
  return (
    <div className={"ag-toast ag-toast--" + tipo} role="status">{msg}</div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * EMPTY STATE
 * ═══════════════════════════════════════════════════════════════════════════ */

function EmptyState({ titulo, sub }: any) {
  return (
    <div className="ag-empty">
      <div className="ag-empty-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>
      <p className="ag-empty-title">{titulo}</p>
      <p className="ag-empty-sub">{sub}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ESTILOS
 * ═══════════════════════════════════════════════════════════════════════════ */

function AgendaStyles() {
  return (
    <style>{`
      /* ── Tokens locais ── */
      .ag-root {
        --ag-gray-50:  #FAFAFA;
        --ag-gray-100: #F5F1F3;
        --ag-gray-200: #F0EBED;
        --ag-gray-300: #E8E2E4;
        --ag-gray-400: #D8CDD1;
        --ag-warning:  #B8860B;
        --ag-warning-bg: #FFF3D1;
        --ag-success:  #16A34A;
        --ag-success-bg: #dcfce7;
        --ag-success-dark: #14532d;
        --ag-info:     #EA580C;
        --ag-info-bg:  #FFF4E7;
        --ag-danger:   #D14848;
        --ag-danger-bg: #FEEBEB;
        --ag-danger-dark: #791F1F;
        --ag-agendado: #7F77DD;
        --ag-agendado-bg: #F5F4FE;
        --ag-producao: #EF9F27;
        --ag-producao-bg: #FEF4E7;

        padding: var(--space-4) var(--space-4) 7rem;
        display: flex; flex-direction: column;
        gap: var(--space-3);
        font-family: var(--font-base);
        position: relative;
      }

      /* ── Header ── */
      .ag-header { display: flex; flex-direction: column; gap: var(--space-1); margin-bottom: var(--space-1); }
      .ag-title {
        font-size: var(--font-page-title);
        font-weight: var(--fw-black);
        color: var(--text-title);
        margin: 0;
        letter-spacing: var(--ls-tight);
      }
      .ag-sub {
        font-size: var(--font-page-subtitle);
        color: var(--text-muted);
        margin: 0;
      }

      /* ── Toggle ── */
      .ag-toggle {
        display: flex;
        background: var(--ag-gray-200);
        padding: 3px;
        border-radius: var(--radius-sm);
        gap: 2px;
      }
      .ag-toggle-btn {
        flex: 1;
        display: inline-flex; align-items: center; justify-content: center;
        padding: 10px;
        background: transparent;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-family: inherit;
        font-size: var(--font-button);
        font-weight: var(--fw-bold);
        color: var(--text-secondary);
        transition: background var(--dur-fast), color var(--dur-fast);
      }
      .ag-toggle-btn:hover { color: var(--text-title); }
      .ag-toggle-btn--on {
        background: var(--bg-card);
        color: var(--text-title);
        box-shadow: var(--shadow-sm);
      }
      .ag-toggle-btn:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
      }

      /* ── Busca ── */
      .ag-search {
        display: flex; align-items: center; gap: var(--space-2);
        padding: 12px 14px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        color: var(--text-muted);
        transition: border-color var(--dur-fast);
      }
      .ag-search:focus-within { border-color: var(--primary); }
      .ag-search-input {
        flex: 1;
        border: none; outline: none; background: transparent;
        font-family: inherit;
        font-size: var(--text-sm);
        color: var(--text-title);
      }
      .ag-search-input::placeholder { color: var(--text-muted); }
      .ag-search-clear {
        width: 22px; height: 22px;
        border-radius: 50%;
        background: var(--ag-gray-200);
        color: var(--text-secondary);
        border: none;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
      }

      /* ── Carrossel (Lista) ── */
      .ag-strip-wrap { display: flex; flex-direction: column; gap: var(--space-2); }
      .ag-strip-nav {
        display: flex; justify-content: space-between; align-items: center;
        padding: 0 var(--space-1);
      }
      .ag-strip-lbl {
        font-size: var(--text-xs);
        font-weight: var(--fw-bold);
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: var(--ls-wide);
      }
      .ag-strip-hoje {
        background: var(--bg-card);
        border: 1px solid var(--border);
        color: var(--text-title);
        padding: 4px 12px;
        border-radius: var(--radius-full);
        font-family: inherit;
        font-size: var(--text-xs);
        font-weight: var(--fw-bold);
        cursor: pointer;
        transition: background var(--dur-fast);
      }
      .ag-strip-hoje:hover { background: var(--ag-gray-100); }
      .ag-strip {
        display: flex; gap: 6px;
        overflow-x: auto;
        padding: 8px var(--space-4) 10px;
        margin: 0 calc(var(--space-4) * -1);
        scrollbar-width: none;
      }
      .ag-strip::-webkit-scrollbar { display: none; }
      .ag-day-card {
        flex-shrink: 0;
        min-width: 58px;
        display: flex; flex-direction: column; align-items: center; gap: 2px;
        padding: 8px 10px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        cursor: pointer;
        font-family: inherit;
        position: relative;
        transition: transform var(--dur-fast), border-color var(--dur-fast);
      }
      .ag-day-card:hover { border-color: var(--ag-gray-400); }
      .ag-day-mes {
        font-size: var(--text-xs);
        color: var(--text-muted);
        font-weight: var(--fw-bold);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .ag-day-num {
        font-size: var(--text-xl);
        font-weight: var(--fw-black);
        color: var(--text-title);
        letter-spacing: var(--ls-tight);
        line-height: 1;
      }
      .ag-day-dow {
        font-size: var(--text-xs);
        color: var(--text-secondary);
        font-weight: var(--fw-semibold);
      }
      .ag-day-card--hoje { border-color: var(--primary); border-width: 1.5px; }
      .ag-day-card--hoje .ag-day-num { color: var(--primary); }
      .ag-day-card--sel {
        background: var(--primary);
        border-color: var(--primary);
      }
      .ag-day-card--sel .ag-day-mes,
      .ag-day-card--sel .ag-day-num,
      .ag-day-card--sel .ag-day-dow { color: var(--text-inverse); }
      .ag-day-card--atrasado { border-color: var(--ag-danger); background: var(--ag-danger-bg); }
      .ag-day-card--atrasado .ag-day-num { color: var(--ag-danger); }
      .ag-day-card:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
      }
      .ag-day-badge {
        position: absolute; top: -6px; right: -6px;
        min-width: 20px; height: 20px;
        border-radius: var(--radius-full);
        background: var(--primary);
        color: var(--text-inverse);
        font-size: 10px;
        font-weight: var(--fw-black);
        display: flex; align-items: center; justify-content: center;
        padding: 0 5px;
        border: 2px solid var(--bg-card);
        font-variant-numeric: tabular-nums;
        line-height: 1;
      }

      /* ── Calendário mês ── */
      .ag-cal-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: var(--space-4) var(--space-3);
      }
      .ag-cal-nav {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: var(--space-3);
      }
      .ag-cal-nav-btn {
        width: 34px; height: 34px;
        border-radius: 8px;
        background: transparent;
        border: 1px solid var(--border);
        color: var(--text-secondary);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        transition: background var(--dur-fast);
      }
      .ag-cal-nav-btn:hover { background: var(--ag-gray-100); color: var(--text-title); }
      .ag-cal-titulo-wrap { display: flex; align-items: center; gap: var(--space-2); }
      .ag-cal-titulo {
        font-size: var(--text-md);
        font-weight: var(--fw-black);
        color: var(--text-title);
        text-transform: capitalize;
        letter-spacing: var(--ls-tight);
      }
      .ag-cal-hoje {
        background: var(--ag-gray-200);
        border: 1px solid var(--ag-gray-300);
        color: var(--text-secondary);
        padding: 3px 10px;
        border-radius: var(--radius-full);
        font-family: inherit;
        font-size: var(--text-xs);
        font-weight: var(--fw-bold);
        cursor: pointer;
      }
      .ag-cal-dow-hdr {
        display: grid; grid-template-columns: repeat(7, 1fr);
        margin-bottom: 6px;
      }
      .ag-cal-dow {
        text-align: center;
        font-size: var(--text-xs);
        font-weight: var(--fw-semibold);
        color: var(--text-muted);
      }
      .ag-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); row-gap: 4px; }
      .ag-cal-day {
        aspect-ratio: 1;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 3px;
        background: transparent;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        font-family: inherit;
        color: var(--text-title);
        position: relative;
        transition: background var(--dur-fast);
      }
      .ag-cal-day:hover { background: var(--ag-gray-100); }
      .ag-cal-day--outro .ag-cal-num { color: var(--ag-gray-400); }
      .ag-cal-num {
        font-size: var(--text-sm);
        font-weight: var(--fw-medium);
      }
      .ag-cal-day--hoje .ag-cal-num { color: var(--primary); font-weight: var(--fw-black); }
      .ag-cal-day--sel {
        background: var(--primary);
        box-shadow: 0 0 0 4px var(--primary-light);
      }
      .ag-cal-day--sel .ag-cal-num { color: var(--text-inverse); font-weight: var(--fw-bold); }
      .ag-cal-day--atrasado .ag-cal-num {
        color: var(--ag-danger);
        font-weight: var(--fw-bold);
      }
      .ag-cal-day--atrasado:not(.ag-cal-day--sel) {
        box-shadow: inset 0 -2px 0 var(--ag-danger);
      }
      .ag-cal-day:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: -2px;
      }
      .ag-cal-dots {
        display: flex; gap: 2px;
        min-height: 5px;
      }
      .ag-cal-dot {
        width: 4px; height: 4px;
        border-radius: 50%;
      }

      .ag-legenda {
        display: flex; flex-wrap: wrap; justify-content: center;
        gap: var(--space-3);
        margin-top: var(--space-3);
        padding-top: var(--space-3);
        border-top: 1px solid var(--border);
      }
      .ag-legenda-item {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: var(--text-xs);
        color: var(--text-secondary);
        font-weight: var(--fw-medium);
      }
      .ag-legenda-dot { width: 8px; height: 8px; border-radius: 50%; }

      /* ── Resumo do dia ── */
      .ag-resumo {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: var(--space-4);
        box-shadow: var(--shadow-card);
      }
      .ag-resumo-top {
        display: flex; justify-content: space-between; align-items: flex-start;
        margin-bottom: var(--space-3);
      }
      .ag-resumo-info { flex: 1; min-width: 0; }
      .ag-resumo-dia {
        font-size: var(--text-md);
        font-weight: var(--fw-black);
        color: var(--text-title);
        text-transform: capitalize;
        letter-spacing: var(--ls-tight);
        line-height: var(--lh-tight);
      }
      .ag-resumo-meta {
        display: flex; align-items: center; gap: var(--space-2);
        margin-top: 4px;
        font-size: var(--text-xs);
        color: var(--text-muted);
      }
      .ag-resumo-rel {
        display: inline-block;
        padding: 2px 8px;
        background: var(--primary-light);
        color: var(--primary);
        border-radius: var(--radius-full);
        font-size: 10px;
        font-weight: var(--fw-black);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .ag-resumo-valor {
        font-size: var(--text-xl);
        font-weight: var(--fw-black);
        color: var(--text-title);
        letter-spacing: var(--ls-tight);
        font-variant-numeric: tabular-nums;
      }
      .ag-resumo-stats { display: flex; gap: 5px; }
      .ag-stat-mini {
        flex: 1;
        display: flex; flex-direction: column; align-items: center; gap: 2px;
        padding: 8px 4px;
        border-radius: var(--radius-sm);
      }
      .ag-stat-num {
        font-size: var(--text-md);
        font-weight: var(--fw-black);
        letter-spacing: var(--ls-tight);
        line-height: 1;
      }
      .ag-stat-lbl {
        font-size: 9px;
        font-weight: var(--fw-bold);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .ag-stat-mini--roxo     { background: var(--ag-agendado-bg); color: var(--ag-agendado); }
      .ag-stat-mini--laranja  { background: var(--ag-producao-bg); color: var(--ag-producao); }
      .ag-stat-mini--verde    { background: var(--ag-success-bg); color: var(--ag-success-dark); }
      .ag-stat-mini--vermelho { background: var(--ag-danger-bg); color: var(--ag-danger-dark); }

      /* ── Filtro card ── */
      .ag-filtro-card {
        width: 100%;
        display: flex; align-items: center; gap: var(--space-2);
        padding: 12px 14px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        cursor: pointer;
        font-family: inherit;
        color: var(--text-secondary);
        transition: background var(--dur-fast), border-color var(--dur-fast);
      }
      .ag-filtro-card:hover { background: var(--ag-gray-100); border-color: var(--ag-gray-400); }
      .ag-filtro-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
      .ag-filtro-card-icon {
        width: 30px; height: 30px;
        border-radius: 8px;
        background: var(--ag-gray-200);
        color: var(--text-title);
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .ag-filtro-card-label {
        font-size: var(--text-sm);
        font-weight: var(--fw-bold);
        color: var(--text-title);
      }
      .ag-filtro-card-dots { display: flex; gap: 3px; }
      .ag-filtro-card-dot { width: 9px; height: 9px; border-radius: 50%; }
      .ag-filtro-card-empty {
        font-size: var(--text-xs);
        color: var(--text-muted);
        font-style: italic;
      }
      .ag-filtro-card-info {
        flex: 1;
        text-align: right;
        font-size: var(--text-xs);
        color: var(--text-muted);
        font-weight: var(--fw-semibold);
        font-variant-numeric: tabular-nums;
      }

      /* ── Drawer ── */
      .ag-drawer-overlay {
        position: fixed; inset: 0;
        background: rgba(45, 31, 38, 0.55);
        backdrop-filter: blur(4px);
        display: flex; flex-direction: column; justify-content: flex-end;
        z-index: 500;
        animation: agFadeIn var(--dur-normal) ease;
      }
      @keyframes agFadeIn { from { opacity: 0; } to { opacity: 1; } }
      .ag-drawer {
        background: var(--bg-card);
        border-radius: 20px 20px 0 0;
        padding: 12px var(--space-4) var(--space-4);
        max-height: 82vh;
        display: flex; flex-direction: column;
        box-shadow: 0 -8px 32px rgba(0,0,0,0.18);
        animation: agSlideUp var(--dur-slow) var(--ease-out);
      }
      @keyframes agSlideUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
      .ag-drawer-handle {
        width: 36px; height: 4px;
        border-radius: 2px;
        background: var(--border);
        margin: 0 auto 12px;
      }
      .ag-drawer-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 4px 4px 12px;
        border-bottom: 1px solid var(--border);
        margin-bottom: var(--space-3);
      }
      .ag-drawer-title {
        font-size: var(--text-lg);
        font-weight: var(--fw-black);
        color: var(--text-title);
        margin: 0;
        letter-spacing: var(--ls-tight);
      }
      .ag-drawer-close {
        width: 32px; height: 32px;
        border-radius: 50%;
        background: var(--ag-gray-200);
        color: var(--text-secondary);
        border: none;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
      }
      .ag-drawer-body {
        display: flex; flex-direction: column; gap: 4px;
        overflow-y: auto;
      }
      .ag-opcao {
        display: flex; align-items: center; gap: 12px;
        padding: 12px;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: background var(--dur-fast);
        font-family: inherit;
      }
      .ag-opcao:hover { background: var(--ag-gray-100); }
      .ag-opcao--on { background: var(--ag-gray-100); }
      .ag-opcao-check {
        width: 20px; height: 20px;
        accent-color: var(--primary);
        cursor: pointer;
        flex-shrink: 0;
      }
      .ag-opcao-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
      .ag-opcao-label {
        flex: 1;
        font-size: var(--text-sm);
        font-weight: var(--fw-semibold);
        color: var(--text-title);
      }
      .ag-opcao-cnt {
        font-size: var(--text-xs);
        font-weight: var(--fw-black);
        color: var(--text-muted);
        background: var(--bg-card);
        border: 1px solid var(--border);
        padding: 2px 10px;
        border-radius: var(--radius-full);
        font-variant-numeric: tabular-nums;
      }
      .ag-drawer-acoes {
        display: flex; align-items: center; gap: var(--space-2);
        margin-top: var(--space-4);
        padding-top: var(--space-3);
        border-top: 1px solid var(--border);
      }
      .ag-drawer-btn-limpar,
      .ag-drawer-btn-todos,
      .ag-drawer-btn-aplicar {
        font-family: inherit;
        font-size: var(--text-xs);
        font-weight: var(--fw-bold);
        cursor: pointer;
        border: none;
      }
      .ag-drawer-btn-limpar {
        background: transparent;
        color: var(--text-muted);
        padding: 8px 4px;
        text-decoration: underline;
      }
      .ag-drawer-btn-todos {
        background: transparent;
        color: var(--text-secondary);
        padding: 8px 12px;
        border: 1px solid var(--border);
        border-radius: 8px;
      }
      .ag-drawer-btn-todos:hover { background: var(--ag-gray-100); }
      .ag-drawer-btn-aplicar {
        background: var(--text-title);
        color: var(--text-inverse);
        padding: 10px 20px;
        border-radius: 8px;
        margin-left: auto;
      }
      .ag-drawer-btn-aplicar:hover { opacity: 0.9; }

      /* ── Lista de pedidos ── */
      .ag-loading {
        padding: var(--space-6);
        text-align: center;
        color: var(--text-muted);
        font-size: var(--text-sm);
      }
      .ag-secao-lbl {
        text-align: center;
        font-size: var(--text-xs);
        font-weight: var(--fw-black);
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: var(--ls-wide);
        margin: var(--space-2) 0 var(--space-2);
      }
      .ag-lista {
        display: flex; flex-direction: column;
        gap: var(--space-3);
        margin: 0 calc(var(--space-4) * -1);
      }

      /* ── Pedido Card ── */
      .ag-pc {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: var(--space-4);
        margin: 0 var(--space-4);
        font-family: inherit;
        position: relative;
        display: flex; flex-direction: column;
      }
      .ag-pc--atrasado {
        border-left: 3px solid var(--ag-danger);
      }
      .ag-pc-alerta {
        display: inline-flex; align-items: center; gap: 5px;
        background: var(--ag-danger-bg);
        color: var(--ag-danger-dark);
        padding: 4px 10px;
        border-radius: var(--radius-full);
        font-size: 10px;
        font-weight: var(--fw-black);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        align-self: flex-start;
        margin-bottom: var(--space-2);
      }

      .ag-pc-head {
        display: flex; align-items: flex-start; gap: 10px;
        margin-bottom: var(--space-3);
      }
      .ag-pc-avatar {
        position: relative;
        width: 44px; height: 44px;
        border-radius: 12px;
        background: var(--ag-gray-100);
        flex-shrink: 0;
        overflow: visible;
        display: flex; align-items: center; justify-content: center;
      }
      .ag-pc-avatar-img {
        width: 100%; height: 100%;
        object-fit: cover;
        border-radius: 12px;
      }
      .ag-pc-avatar-icon {
        color: var(--ag-gray-400);
        display: flex; align-items: center; justify-content: center;
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
      .ag-pc-head-info { flex: 1; min-width: 0; }
      .ag-pc-nome {
        font-size: var(--text-md);
        font-weight: var(--fw-black);
        color: var(--text-title);
        letter-spacing: var(--ls-tight);
        line-height: var(--lh-tight);
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ag-pc-nome-texto {
        min-width: 0;
        flex: 1;
      }
      /* ── Avatar do cliente (foto ou iniciais) ── */
      .ag-cli-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        overflow: hidden;
        flex-shrink: 0;
        background: var(--primary-light, #FCE0E9);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #fff;
        box-shadow: 0 0 0 1px rgba(232, 90, 140, 0.25);
      }
      .ag-cli-avatar img {
        width: 100%; height: 100%;
        object-fit: cover;
      }
      .ag-cli-avatar-iniciais {
        font-size: var(--text-xs);
        font-weight: var(--fw-black, 800);
        color: var(--primary-dark, #C33A6E);
        letter-spacing: 0.02em;
      }
      /* Grid 2 colunas — desktop apenas.
         Mobile: display: contents = wrapper "some", filhos ficam no fluxo normal */
      .ag-desk-grid { display: contents; }

      /* Linha topo: busca + filtro */
      .ag-search-row {
        display: flex;
        gap: 8px;
        align-items: stretch;
        margin-bottom: 12px;
      }
      .ag-search-row .ag-search { flex: 1; margin-bottom: 0; }
      .ag-search-row .ag-filtro-card {
        flex-shrink: 0;
        margin-bottom: 0;
        width: auto;
      }
      /* Mobile: filtro em cima, busca embaixo */
      @media (max-width: 899px) {
        .ag-search-row {
          flex-direction: column-reverse;
        }
        .ag-search-row .ag-filtro-card {
          align-self: flex-end;
          width: auto;
        }
      }

      /* Barra de pesquisa: SEM decoração ao focar */
      .ag-search, .ag-search:focus, .ag-search:focus-within, .ag-search:hover {
        border: 1px solid var(--border) !important;
        box-shadow: none !important;
        outline: none !important;
      }
      .ag-search-input, .ag-search-input:focus, .ag-search-input:hover, .ag-search-input:active {
        outline: none !important;
        border: none !important;
        box-shadow: none !important;
      }
      /* Fix: hover no dia do calendário — arredondado (não oval) */
      .ag-cal-day { border-radius: 12px !important; }
      .ag-cal-day--sel {
        border-radius: 12px !important;
        box-shadow: none !important;
      }

      @media (min-width: 900px) {
        .ag-cli-avatar { width: 34px; height: 34px; }
        .ag-cli-avatar-iniciais { font-size: var(--text-sm); }
        /* Esconde toggle Lista/Calendário no desktop (só calendário) */
        .ag-toggle { display: none; }
        /* Grid 2 colunas: calendário à esquerda, lista à direita */
        .ag-desk-grid {
          display: grid !important;
          grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
          gap: var(--space-5, 1.25rem);
          align-items: start;
          margin-top: var(--space-4, 1rem);
        }
        .ag-desk-side {
          display: flex;
          flex-direction: column;
          gap: var(--space-3, 0.75rem);
          position: sticky;
          top: var(--space-4, 1rem);
          min-width: 0;
        }
        /* Calendário compacto: dias com altura controlada no desktop */
        .ag-desk-grid .ag-cal-day {
          aspect-ratio: auto;
          height: 60px;
        }
        .ag-desk-grid .ag-cal-grid {
          row-gap: 6px;
          column-gap: 4px;
        }
        .ag-desk-grid .ag-cal-num {
          font-size: var(--text-sm);
        }
        .ag-desk-grid .ag-cal-day--sel {
          border-radius: 12px;
          box-shadow: 0 0 0 2px var(--primary-light);
        }
        /* Card do calendário: não expande ilimitadamente */
        .ag-desk-grid .ag-cal-card {
          padding: 16px;
        }
      }
      .ag-pc-numero {
        font-size: var(--text-sm);
        color: var(--text-muted);
        font-weight: var(--fw-medium);
      }
      .ag-pc-pedido-em {
        display: inline-block;
        margin-top: 2px;
        font-size: var(--text-xs);
        color: var(--text-muted);
        font-weight: var(--fw-regular);
      }

      .ag-pc-menu-wrap { position: relative; flex-shrink: 0; }
      .ag-pc-menu-btn {
        width: 36px; height: 36px;
        border-radius: 8px;
        border: 1px solid var(--ag-gray-300);
        background: var(--ag-gray-50);
        color: var(--text-title);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        font-family: inherit;
        transition: background var(--dur-fast), border-color var(--dur-fast);
      }
      .ag-pc-menu-btn:hover { background: var(--ag-gray-100); border-color: var(--ag-gray-400); }
      .ag-pc-menu-btn[aria-expanded="true"] { background: var(--ag-gray-200); border-color: var(--ag-gray-400); }
      .ag-pc-menu-btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
      .ag-pc-menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        background: var(--bg-card);
        border: 1px solid var(--ag-gray-300);
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(45, 31, 38, 0.14);
        min-width: 210px;
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
      .ag-pc-menu-item:hover { background: var(--ag-gray-100); }
      .ag-pc-menu-item svg { flex-shrink: 0; opacity: 0.7; }
      .ag-pc-menu-item--danger { color: var(--ag-danger); }
      .ag-pc-menu-item--danger:hover { background: var(--ag-danger-bg); }
      .ag-pc-menu-divider {
        height: 1px;
        background: var(--ag-gray-300);
        margin: 4px -6px;
      }

      /* ── Ações rápidas ── */
      .ag-pc-quick {
        display: flex; gap: 6px;
        margin-bottom: var(--space-3);
      }
      .ag-pc-quick-btn {
        flex: 1;
        padding: 8px;
        border-radius: 8px;
        display: inline-flex; align-items: center; justify-content: center; gap: 5px;
        font-family: inherit;
        font-size: var(--text-xs);
        font-weight: var(--fw-bold);
        cursor: pointer;
        transition: background var(--dur-fast);
      }
      .ag-pc-quick-btn--pronto {
        background: var(--ag-agendado-bg);
        color: var(--ag-agendado);
        border: 1px solid #D6D2FA;
      }
      .ag-pc-quick-btn--pronto:hover { background: #EAE7FC; }
      .ag-pc-quick-btn--wpp {
        background: var(--ag-success-bg);
        color: var(--ag-success-dark);
        border: 1px solid #B8E5C6;
      }
      .ag-pc-quick-btn--wpp:hover { background: #D0F0DA; }

      .ag-pc-divider {
        height: 1px;
        background: var(--border);
        margin: 0 0 var(--space-3);
      }

      /* ── Info lines ── */
      .ag-pc-info-lines { display: flex; flex-direction: column; gap: 6px; }
      .ag-pc-info-line {
        display: flex; align-items: center; gap: 8px;
        font-size: var(--text-sm);
        font-weight: var(--fw-medium);
        color: var(--text-title);
      }
      .ag-pc-info-ic {
        display: flex; align-items: center; justify-content: center;
        color: currentColor;
        opacity: 0.7;
        flex-shrink: 0;
      }
      .ag-pc-info-label {
        color: var(--text-muted);
        font-weight: var(--fw-regular);
        margin-right: auto;
      }
      .ag-pc-status-tag {
        display: inline-flex; align-items: center;
        padding: 3px 10px;
        border-radius: var(--radius-full);
        font-size: 10px;
        font-weight: var(--fw-black);
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: var(--text-inverse);
      }
      .ag-pc-info-line--entrega { color: var(--ag-info); font-weight: var(--fw-semibold); }
      .ag-pc-info-line--atraso  { color: var(--ag-danger); font-weight: var(--fw-bold); }
      .ag-pc-info-line--pag-pendente { color: var(--ag-warning); }
      .ag-pc-info-line--pag-parcial  { color: var(--ag-warning); }
      .ag-pc-info-line--pag-pago     { color: var(--ag-success-dark); }

      /* ── Bloco itens ── */
      .ag-pc-itens {
        margin: var(--space-3) calc(var(--space-4) * -1) calc(var(--space-4) * -1);
        padding: var(--space-3) var(--space-4);
        background: var(--ag-gray-50);
        border-radius: 0 0 var(--radius-lg) var(--radius-lg);
        border-top: 1px solid var(--border);
        display: flex; flex-direction: column;
        gap: 6px;
      }
      .ag-pc-item {
        display: flex; justify-content: space-between; align-items: center;
        gap: 8px;
        font-size: var(--text-sm);
      }
      .ag-pc-item-nome {
        color: var(--text-title);
        font-weight: var(--fw-medium);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1; min-width: 0;
      }
      .ag-pc-item-nome b { font-weight: var(--fw-black); }
      .ag-pc-item-val {
        color: var(--text-title);
        font-weight: var(--fw-bold);
        font-variant-numeric: tabular-nums;
        flex-shrink: 0;
      }
      .ag-pc-item--vazio {
        color: var(--text-muted);
        font-style: italic;
        justify-content: center;
      }
      .ag-pc-tot {
        display: flex; justify-content: space-between; align-items: center;
        font-size: var(--text-sm);
        font-weight: var(--fw-semibold);
        color: var(--text-title);
        font-variant-numeric: tabular-nums;
      }
      .ag-pc-tot span:last-child { font-weight: var(--fw-bold); }
      .ag-pc-tot--subtotal {
        padding-top: 8px;
        margin-top: 4px;
        border-top: 1px solid var(--border);
      }
      .ag-pc-tot--total {
        padding-top: 8px;
        border-top: 1px solid var(--border);
        font-size: var(--text-md);
      }
      .ag-pc-tot--total span:last-child { font-weight: var(--fw-black); }
      .ag-pc-tot--desconto { color: var(--ag-info); }
      .ag-pc-tot--desconto span:last-child { color: var(--ag-info); }
      .ag-pc-tot--sinal { color: var(--ag-success); }
      .ag-pc-tot--sinal span:last-child { color: var(--ag-success); }
      .ag-pc-tot--falta {
        padding-top: 8px;
        border-top: 1px solid var(--border);
        color: var(--primary);
        font-size: var(--text-md);
      }
      .ag-pc-tot--falta span { color: var(--primary); font-weight: var(--fw-black); }

      /* ── FAB ── */
      .ag-fab {
        position: fixed;
        bottom: 88px; right: 20px;
        width: 56px; height: 56px;
        border-radius: var(--radius-full);
        background: var(--primary);
        color: var(--text-inverse);
        display: flex; align-items: center; justify-content: center;
        border: none;
        box-shadow: var(--shadow-pink);
        cursor: pointer;
        z-index: 100;
        transition: transform var(--dur-fast), background var(--dur-fast);
      }
      .ag-fab:hover { transform: scale(1.05); background: var(--primary-hover, var(--primary)); }
      .ag-fab:active { transform: scale(0.95); }
      .ag-fab:focus-visible { outline: 3px solid var(--primary-light); outline-offset: 3px; }

      /* ── Modal ── */
      .ag-modal-overlay {
        position: fixed; inset: 0;
        background: rgba(45, 31, 38, 0.55);
        backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        z-index: 600;
        padding: var(--space-4);
        animation: agFadeIn var(--dur-normal) ease;
      }
      .ag-modal {
        background: var(--bg-card);
        border-radius: var(--radius-lg);
        padding: var(--space-5);
        max-width: 360px;
        width: 100%;
        display: flex; flex-direction: column; align-items: center;
        gap: var(--space-3);
        text-align: center;
        box-shadow: var(--shadow-lg);
        animation: agModalIn var(--dur-slow) var(--ease-bounce);
      }
      @keyframes agModalIn {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
      }
      .ag-modal-icon {
        width: 48px; height: 48px;
        border-radius: 50%;
        background: var(--ag-danger-bg);
        color: var(--ag-danger);
        display: flex; align-items: center; justify-content: center;
      }
      .ag-modal-icon--info {
        background: var(--ag-info-bg);
        color: var(--ag-info);
      }
      .ag-modal-title {
        font-size: var(--text-lg);
        font-weight: var(--fw-black);
        color: var(--text-title);
        margin: 0;
        letter-spacing: var(--ls-tight);
      }
      .ag-modal-msg {
        font-size: var(--text-sm);
        color: var(--text-secondary);
        line-height: var(--lh-normal);
        margin: 0;
      }
      .ag-modal-input {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        font-family: inherit;
        font-size: var(--text-md);
        color: var(--text-title);
      }
      .ag-modal-acoes {
        display: flex; gap: var(--space-2);
        width: 100%;
        margin-top: var(--space-2);
      }
      .ag-modal-btn {
        flex: 1;
        padding: 12px;
        border-radius: var(--radius-sm);
        font-family: inherit;
        font-size: var(--text-sm);
        font-weight: var(--fw-bold);
        cursor: pointer;
        border: none;
        transition: opacity var(--dur-fast);
      }
      .ag-modal-btn--cancel {
        background: var(--ag-gray-200);
        color: var(--text-title);
      }
      .ag-modal-btn--confirm {
        background: var(--ag-danger);
        color: var(--text-inverse);
      }
      .ag-modal-btn--primary {
        background: var(--primary);
        color: var(--text-inverse);
      }
      .ag-modal-btn:hover { opacity: 0.9; }

      /* ── Toast ── */
      .ag-toast {
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 20px;
        border-radius: var(--radius-full);
        font-size: var(--text-sm);
        font-weight: var(--fw-bold);
        box-shadow: var(--shadow-lg);
        z-index: 700;
        animation: agToastIn var(--dur-normal) var(--ease-out);
      }
      @keyframes agToastIn {
        from { opacity: 0; transform: translate(-50%, 12px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
      .ag-toast--sucesso { background: var(--ag-success); color: var(--text-inverse); }
      .ag-toast--erro    { background: var(--ag-danger);  color: var(--text-inverse); }
      .ag-toast--info    { background: var(--text-title); color: var(--text-inverse); }

      /* ── Empty state ── */
      .ag-empty {
        display: flex; flex-direction: column; align-items: center; gap: var(--space-2);
        padding: var(--space-7) var(--space-4);
        text-align: center;
      }
      .ag-empty-icon { color: var(--text-muted); opacity: 0.5; }
      .ag-empty-title {
        font-size: var(--text-md);
        font-weight: var(--fw-bold);
        color: var(--text-title);
        margin: 0;
      }
      .ag-empty-sub {
        font-size: var(--text-sm);
        color: var(--text-muted);
        margin: 0;
      }

      /* ── Focus visible geral ── */
      .ag-root button:focus-visible,
      .ag-root input:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
      }
    `}</style>
  );
}

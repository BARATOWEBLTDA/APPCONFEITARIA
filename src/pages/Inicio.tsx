import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Users, Package, ClipboardList, DollarSign, UtensilsCrossed, BookOpen } from "lucide-react";
import { Bell, User } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { usePlano } from "@/hooks/usePlano";
import { useNotifications } from "@/context/NotificationContext";
import { MetricCard } from "@/components/MetricCard";
import { TrialCardMobileBanner } from "@/components/billing/TrialCard";

const STATUS_CONFIG: Record<string, {label: string; color: string; bg: string}> = {
  confirmado:          { label: 'Confirmado',          color: '#5b21b6', bg: '#ede9fe' },
  em_producao:         { label: 'Em produção',         color: '#9a3412', bg: '#ffedd5' },
  pronto:              { label: 'Pronto',              color: '#14532d', bg: '#dcfce7' },
  aguardando_retirada: { label: 'Aguard. retirada',   color: '#0369a1', bg: '#e0f2fe' },
  aguardando_entrega:  { label: 'Aguard. entrega',    color: '#3730a3', bg: '#eef2ff' },
  entregue:            { label: 'Entregue',            color: '#374151', bg: '#f3f4f6' },
  cancelado:           { label: 'Cancelado',           color: '#991b1b', bg: '#fee2e2' },
  novo:                { label: 'Novo',                color: '#1d4ed8', bg: '#dbeafe' },
};


// ── Gráfico de faturamento (dados mock — substituir pelos reais futuramente) ──
const FaturamentoChart = () => {
  const hoje = new Date();
  const mockData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - (29 - i));
    return {
      dia: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      valor: Math.floor(Math.random() * 800 + 100),
    };
  });
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={mockData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#ECC2D0)" vertical={false} />
        <XAxis dataKey="dia" tick={{ fontSize: 10, fill: 'var(--text-muted,#C39EAA)' }} tickLine={false} axisLine={false} interval={4} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted,#C39EAA)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `R$${v}`} />
        <Tooltip
          contentStyle={{ background: 'var(--bg-card,#fff)', border: '1px solid var(--border,#ECC2D0)', borderRadius: 10, fontSize: 12, fontFamily: 'Geist,sans-serif' }}
          formatter={(v: any) => [`R$ ${v}`, 'Faturamento']}
        />
        <Line type="monotone" dataKey="valor" stroke="var(--primary,#986274)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'var(--primary,#986274)' }} />
      </LineChart>
    </ResponsiveContainer>
  );
};


export default function Inicio() {
  const navigate = useNavigate();
  const { isPro } = usePlano();
  const { notifCount, openNotif } = useNotifications();

  const [profile, setProfile] = useState<any>(null);
  const [produtos, setProdutos] = useState(0);
  const [clientes, setClientes] = useState(0);
  const [insumos, setInsumos] = useState(0);
  const [receitas, setReceitas] = useState(0);
  const [categorias, setCategorias] = useState(0);
  const [pedidos, setPedidos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openGroup, setOpenGroup] = useState<number | null>(0);
  const [profileUserId, setProfileUserId] = useState<string>("");
  const [ultimosClientes, setUltimosClientes] = useState<any[]>([]);
  const [calMes, setCalMes] = useState(new Date());
  const [calDiaSelecionado, setCalDiaSelecionado] = useState<string | null>(null);
  const [pedidosDia, setPedidosDia] = useState<any[]>([]);
  const [pedidosFiltro, setPedidosFiltro] = useState<string>("todos");
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [pedidosMes, setPedidosMes] = useState<Record<string, number>>({});
  const [ultimosPedidos, setUltimosPedidos] = useState<any[]>([]);
  const [produtosMaisPedidos, setProdutosMaisPedidos] = useState<any[]>([]);

  const calCells = () => {
    const ano = calMes.getFullYear();
    const mes = calMes.getMonth();
    const primeiroDia = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const hoje = new Date().toISOString().split("T")[0];
    const cells = [];
    for (let i = 0; i < primeiroDia; i++) cells.push(<div key={`e${i}`} />);
    for (let d = 1; d <= totalDias; d++) {
      const iso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const temPedido = pedidosMes[iso] || 0;
      const isHoje = iso === hoje;
      const isSelecionado = iso === calDiaSelecionado;
      cells.push(
        <button
          key={d}
          onClick={() => handleDiaClick(iso)}
          className={"cal-day" + (isHoje ? " hoje" : "") + (isSelecionado ? " selecionado" : "") + (temPedido ? " tem-pedido" : "")}
        >
          {d}
          {temPedido > 0 && <span className="cal-dot">{temPedido}</span>}
        </button>
      );
    }
    return cells;
  };

  const buscarPedidosDia = async (dia: string) => {
    if (!profileUserId) return;
    setLoadingPedidos(true);
    const { data } = await supabase
      .from("pedidos")
      .select("*")
      .eq("user_id", profileUserId)
      .eq("data_entrega", dia)
      .order("created_at", { ascending: false });
    setPedidosDia(data || []);
    setLoadingPedidos(false);
  };

  const handleDiaClick = (dia: string) => {
    setCalDiaSelecionado(dia);
    setPedidosFiltro("todos");
    buscarPedidosDia(dia);
  };

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setProfileUserId(user.id);

      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const fimMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString();

      // Todas as queries independentes em paralelo — de ~800ms para ~200ms
      const [
        { data: prof },
        { count: pc },
        { count: cc },
        { count: ic },
        { count: rc },
        { count: catc },
        { data: uc },
        { data: pedMes },
        { data: ultPedidos },
        { data: pedItens },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("produtos").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("clientes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("insumos").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("receitas_minhas").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("categorias").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase
          .from("clientes")
          .select("id,nome,foto_url,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("pedidos")
          .select("data_entrega,status")
          .eq("user_id", user.id)
          .gte("data_entrega", inicioMes)
          .lte("data_entrega", fimMes),
        supabase
          .from("pedidos")
          .select("id,numero,cliente_nome,status,valor_total,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("pedido_itens")
          .select("nome_produto")
          .eq("user_id", user.id)
          .limit(200),
      ]);

      setProfile(prof);
      setProdutos(pc || 0);
      setClientes(cc || 0);
      setInsumos(ic || 0);
      setReceitas(rc || 0);
      setCategorias(catc || 0);
      if (uc) setUltimosClientes(uc);

      if (ultPedidos) setUltimosPedidos(ultPedidos);
      if (pedItens) {
        const count: Record<string, number> = {};
        pedItens.forEach((i: any) => { if (i.nome_produto) count[i.nome_produto] = (count[i.nome_produto] || 0) + 1; });
        const sorted = Object.entries(count).sort((a,b) => b[1]-a[1]).slice(0,5).map(([nome,total]) => ({ nome, total }));
        setProdutosMaisPedidos(sorted);
      }
      if (pedMes) {
        const map: Record<string, number> = {};
        pedMes.forEach((p: any) => {
          if (p.data_entrega) map[p.data_entrega] = (map[p.data_entrega] || 0) + 1;
        });
        setPedidosMes(map);
      }

      setLoading(false);
    };
    load();
  }, []);

  const nome = profile?.nome?.split(" ")[0] || "";

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Bom dia";
    if (h >= 12 && h < 18) return "Boa tarde";
    return "Boa noite";
  };

  const atalhos = [
    { label: "Clientes", icon: <Users size={28} color="var(--primary, #FF6FA9)" />, path: "/clientes" },
    { label: "Produtos", icon: <Package size={28} color="var(--primary, #FF6FA9)" />, path: "/produtos" },
    { label: "Pedidos", icon: <ClipboardList size={28} color="var(--primary, #FF6FA9)" />, path: "/pedidos" },
    { label: "Financeiro", icon: <DollarSign size={28} color="var(--primary, #FF6FA9)" />, path: "/financeiro" },
    { label: "Cardápio", icon: <UtensilsCrossed size={28} color="var(--primary, #FF6FA9)" />, path: "/cardapio-config" },
    { label: "Receitas", icon: <BookOpen size={28} color="var(--primary, #FF6FA9)" />, path: "/receitas" },
  ];


  if (loading) return <div style={{ padding: "2rem", fontFamily: "inherit", color: "var(--text-muted, #9CA3AF)" }}>Carregando...</div>;

  return (
    <div className="ini-root">

      {/* ===== MOBILE ===== */}
      <div className="ini-mobile">

        {/* Hero */}
        <div className="mob-hero">
          <div className="mob-hero-row">
            <span className="mob-hero-brand">Doonly</span>
            <div style={{ flex: 1 }} />
            <button
              className={`mob-hero-bell${notifCount > 0 ? " has-notif" : ""}`}
              onClick={openNotif}
              style={{ position: "relative" }}
            >
              <Bell size={26} weight="duotone" color="rgba(255,255,255,0.9)" />
              {notifCount > 0 && <span className="mob-hero-notif-badge">{notifCount > 9 ? "9+" : notifCount}</span>}
            </button>
            <button className="mob-hero-profile" onClick={() => navigate("/configuracoes")}>
              {profile?.foto_url
                ? <img src={profile.foto_url} alt="perfil" style={{ width: "26px", height: "26px", borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.7)" }} />
                : <User size={26} weight="duotone" color="rgba(255,255,255,0.9)" />
              }
            </button>
          </div>
        </div>

        {/* MetricCards flutuando sobre o hero */}
        <div className="mob-metrics">
          <MetricCard
            variant="orders"
            label="Pedidos do mês"
            value={pedidos !== 0 ? pedidos : undefined}
            emptyText="Nenhum ainda"
            onClick={() => navigate("/pedidos")}
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>}
          />
          <MetricCard
            variant="revenue"
            label="Faturamento"
            value={undefined}
            emptyText="Sem vendas ainda"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
          />
          <MetricCard
            variant="customers"
            label="Clientes"
            value={clientes !== 0 ? clientes : undefined}
            emptyText="Sem clientes ainda"
            onClick={() => navigate("/clientes")}
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
          />
        </div>

        {/* Acesso rápido */}
        <p className="mob-section-title">Acesso rápido</p>
        <div className="mob-atalhos">
          {atalhos.map(a => (
            <button key={a.path} className="mob-atalho" onClick={() => navigate(a.path)}>
              <div className="mob-atalho-icon">{a.icon}</div>
              <span className="mob-atalho-label">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Banner premium */}
        {!isPro && <TrialCardMobileBanner />}
      </div>


      {/* ===== DESKTOP ===== */}
      <div className="ini-desktop">

        {/* Header */}
        <div className="dash-header">
          <div>
            <h1 className="dash-title">Dashboard</h1>
            <p className="dash-subtitle">{getGreeting()}, {nome || 'bem-vinda'} 👋</p>
          </div>
          <button
            onClick={() => navigate('/pedidos/novo')}
            style={{ background: 'var(--primary,#986274)', color: 'white', border: 'none', borderRadius: 10, padding: '0.65rem 1.25rem', fontFamily: 'inherit', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo pedido
          </button>
        </div>

        {/* 4 Métricas */}
        <div className="dash-metrics-4">
          {[
            { label: 'Pedidos hoje', value: pedidosDia.length, icon: '📋', color: '#986274', bg: '#F7EEF1', path: '/pedidos' },
            { label: 'Faturamento', value: 'R$ 0,00', icon: '💰', color: '#16a34a', bg: '#f0fdf4', path: '/financeiro' },
            { label: 'Pedidos em aberto', value: pedidos, icon: '⏳', color: '#d97706', bg: '#fef3c7', path: '/pedidos' },
            { label: 'Entregas hoje', value: pedidosDia.filter((p: any) => p.tipo_entrega === 'entrega').length, icon: '🚚', color: '#3b82f6', bg: '#eff6ff', path: '/pedidos' },
          ].map((m, i) => (
            <div key={i} className="dash-metric-4" onClick={() => navigate(m.path)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary,#6E3548)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</span>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>{m.icon}</div>
              </div>
              <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-title,#431524)', lineHeight: 1 }}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Grid principal */}
        <div className="dash-main-grid">

          {/* Coluna esquerda */}
          <div className="dash-col-main">

            {/* Pedidos recentes */}
            <div className="dash-card-d">
              <div className="dash-card-hdr">
                <h3 className="dash-card-ttl">Pedidos recentes</h3>
                <button className="dash-ver-td" onClick={() => navigate('/pedidos')}>Ver todos →</button>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                {ultimosPedidos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted,#C39EAA)', fontSize: '0.85rem' }}>
                    Nenhum pedido ainda —{' '}
                    <button onClick={() => navigate('/pedidos/novo')} style={{ background: 'none', border: 'none', color: 'var(--primary,#986274)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>criar primeiro</button>
                  </div>
                ) : ultimosPedidos.map((p: any) => (
                  <div key={p.id} onClick={() => navigate(`/pedidos/${p.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 0', borderBottom: '1px solid var(--border,#ECC2D0)', cursor: 'pointer' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-subtle,#F7EEF1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary,#986274)" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-title,#431524)' }}>{p.cliente_nome || 'Cliente'}</p>
                      <p style={{ margin: '1px 0 0', fontSize: '0.75rem', color: 'var(--text-muted,#C39EAA)' }}>Pedido #{p.numero}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: STATUS_CONFIG[p.status]?.bg || '#f3f4f6', color: STATUS_CONFIG[p.status]?.color || '#374151' }}>
                        {STATUS_CONFIG[p.status]?.label || p.status}
                      </span>
                      <p style={{ margin: '3px 0 0', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-title,#431524)' }}>{(p.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfico de faturamento */}
            <div className="dash-card-d">
              <div className="dash-card-hdr">
                <h3 className="dash-card-ttl">Faturamento</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted,#C39EAA)', fontWeight: 500 }}>Últimos 30 dias · dados reais em breve</span>
              </div>
              <div style={{ marginTop: '1rem', height: 180 }}>
                <FaturamentoChart />
              </div>
            </div>

          </div>

          {/* Coluna direita */}
          <div className="dash-col-side">

            {/* Calendário */}
            <div className="dash-card-d">
              <div className="dash-card-hdr" style={{ marginBottom: '0.75rem' }}>
                <h3 className="dash-card-ttl">Calendário</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <button className="cal-nav-btn" onClick={() => setCalMes(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</button>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-title,#431524)' }}>
                  {calMes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
                <button className="cal-nav-btn" onClick={() => setCalMes(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</button>
              </div>
              <div className="cal-grid-header">
                {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => <div key={d} className="cal-dow">{d}</div>)}
              </div>
              <div className="cal-grid">{calCells()}</div>
              {calDiaSelecionado && (
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border,#ECC2D0)', paddingTop: '0.75rem' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary,#6E3548)' }}>
                    {new Date(calDiaSelecionado + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                  </p>
                  {loadingPedidos ? (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted,#C39EAA)' }}>Carregando...</p>
                  ) : pedidosDia.length === 0 ? (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted,#C39EAA)' }}>Nenhum pedido neste dia</p>
                  ) : pedidosDia.map((p: any) => (
                    <div key={p.id} onClick={() => navigate(`/pedidos/${p.id}`)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border,#ECC2D0)', cursor: 'pointer' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-title,#431524)' }}>{p.cliente_nome}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--primary,#986274)' }}>{p.horario_entrega?.slice(0,5) || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Produtos mais pedidos */}
            <div className="dash-card-d">
              <div className="dash-card-hdr">
                <h3 className="dash-card-ttl">Produtos mais pedidos</h3>
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {produtosMaisPedidos.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted,#C39EAA)', textAlign: 'center', padding: '1rem 0' }}>Nenhum dado ainda</p>
                ) : produtosMaisPedidos.map((p: any, i: number) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-title,#431524)' }}>{p.nome}</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary,#6E3548)' }}>{p.total}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-subtle,#F7EEF1)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(p.total / produtosMaisPedidos[0].total) * 100}%`, background: 'var(--primary,#986274)', borderRadius: 99, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                ))}
                {produtosMaisPedidos.length === 0 && (
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted,#C39EAA)', textAlign: 'center' }}>Aparecerá conforme pedidos forem registrados</p>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');
        .ini-root { font-family: 'Geist', sans-serif; }
        .ini-mobile { display: flex; flex-direction: column; gap: 0.85rem; }
        .ini-desktop { display: none; }
        @media (min-width: 768px) { .ini-mobile { display: none; } .ini-desktop { display: block; } }

        /* MOBILE styles preserved */
        .mob-hero { background: var(--primary-gradient); border-radius: 0 0 28px 28px; padding: 2.5rem 1.25rem 4.5rem; margin: -0.75rem -0.75rem 0; }
        .mob-hero-row { display: flex; align-items: center; gap: 0.7rem; }
        .mob-hero-profile { background: rgba(255,255,255,0.15); border: none; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; padding: 0; overflow: hidden; }
        .mob-hero-bell { background: none; border: none; padding: 0.3rem; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 50%; }
        .mob-hero-bell.has-notif { background: rgba(255,255,255,0.15); animation: bell-pulse 1.8s ease-in-out infinite; }
        .mob-hero-notif-badge { position: absolute; top: -2px; right: -2px; width: 16px; height: 16px; border-radius: 50%; background: var(--error); color: #fff; font-size: 0.6rem; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 2px solid transparent; }
        @keyframes bell-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.4); } 50% { box-shadow: 0 0 0 6px rgba(255,255,255,0); } }
        .mob-hero-title { font-size: 0.95rem; font-weight: 700; color: #fff; margin: 0; line-height: 1.2; }
        .mob-hero-brand { font-family: 'Dancing Script', cursive; font-weight: 700; font-size: 1.6rem; color: #ffffff; text-shadow: 0 0 6px rgba(255,255,255,0.5); line-height: 1; }
        .mob-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-top: -52px; padding: 0 0.25rem; }
        .mob-metrics .dash-metric-card { padding: 0.75rem; border-radius: 14px; }
        .mob-section-title { font-size: 0.88rem; font-weight: 700; color: var(--text-title, #1F2937); }
        .mob-atalhos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
        .mob-atalho { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; background: var(--bg-card, #FFFFFF); border: 1.5px solid var(--border, #E9E9EE); border-radius: 12px; padding: 0.7rem 0.4rem; cursor: pointer; font-family: 'Geist', sans-serif; transition: border-color 0.15s; }
        .mob-atalho:hover { border-color: var(--primary, #FF6FA9); }
        .mob-atalho-icon { display: flex; align-items: center; justify-content: center; }
        .mob-atalho-label { font-size: 0.68rem; font-weight: 500; color: var(--text-primary, #374151); }

        /* DESKTOP */
        .dash-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
        .dash-title { font-size: 1.5rem; font-weight: 800; color: var(--text-title,#431524); margin: 0 0 0.2rem; }
        .dash-subtitle { font-size: 0.85rem; color: var(--text-muted,#C39EAA); margin: 0; }
        .dash-metrics-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 1rem; margin-bottom: 1.25rem; }
        .dash-metric-4 { background: var(--bg-card,#fff); border-radius: 14px; padding: 1.1rem 1.25rem; border: 1px solid var(--border,#ECC2D0); transition: box-shadow 0.2s, transform 0.2s; }
        .dash-metric-4:hover { box-shadow: 0 6px 20px rgba(152,98,116,0.12); transform: translateY(-2px); }
        .dash-main-grid { display: grid; grid-template-columns: 1fr 340px; gap: 1.25rem; align-items: start; }
        .dash-col-main { display: flex; flex-direction: column; gap: 1.25rem; }
        .dash-col-side { display: flex; flex-direction: column; gap: 1.25rem; }
        .dash-card-d { background: var(--bg-card,#fff); border-radius: 14px; padding: 1.25rem; border: 1px solid var(--border,#ECC2D0); }
        .dash-card-hdr { display: flex; justify-content: space-between; align-items: center; }
        .dash-card-ttl { font-size: 0.95rem; font-weight: 700; color: var(--text-title,#431524); margin: 0; }
        .dash-ver-td { background: none; border: none; color: var(--primary,#986274); font-size: 0.8rem; font-weight: 600; cursor: pointer; font-family: 'Geist',sans-serif; }

        /* Calendário */
        .cal-nav-btn { width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid var(--border,#ECC2D0); background: var(--bg-card,#fff); cursor: pointer; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; color: var(--text-secondary,#6E3548); transition: background 0.15s; }
        .cal-nav-btn:hover { background: var(--primary-light,#F7EEF1); color: var(--primary,#986274); border-color: var(--primary,#986274); }
        .cal-grid-header { display: grid; grid-template-columns: repeat(7,1fr); margin-bottom: 0.35rem; }
        .cal-dow { text-align: center; font-size: 0.72rem; font-weight: 700; color: var(--text-muted,#C39EAA); text-transform: uppercase; padding: 0.3rem 0; }
        .cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 3px; }
        .cal-day { position: relative; aspect-ratio: 1; border-radius: 8px; border: none; background: transparent; cursor: pointer; font-size: 0.82rem; font-weight: 500; color: var(--text-primary,#431524); font-family: 'Geist',sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: background 0.15s; gap: 2px; }
        .cal-day:hover { background: var(--primary-light,#F7EEF1); color: var(--primary,#986274); }
        .cal-day.hoje { background: var(--primary-light,#F7EEF1); color: var(--primary,#986274); font-weight: 800; }
        .cal-day.selecionado { background: var(--primary,#986274) !important; color: white !important; font-weight: 800; }
        .cal-day.tem-pedido { font-weight: 700; }
        .cal-dot { font-size: 0.55rem; background: var(--primary,#986274); color: white; border-radius: 10px; padding: 0 4px; line-height: 1.4; }
        .cal-day.selecionado .cal-dot { background: rgba(255,255,255,0.4); }

        /* MetricCard mobile compat */
        .dash-metric-card { background: var(--bg-card,#FFFFFF); border-radius: 16px; padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem; box-shadow: 0 4px 16px rgba(0,0,0,0.1); cursor: pointer; transition: box-shadow 0.2s, transform 0.2s; }
        .dash-metric-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .dash-metric-num { font-size: 1.8rem; font-weight: 800; color: var(--text-title,#1F2937); margin: 0; line-height: 1; }
        .dash-metric-label { font-size: 0.75rem; color: var(--text-muted,#9CA3AF); margin: 0.25rem 0 0; font-weight: 500; }
      `}</style>
    </div>
  );
}

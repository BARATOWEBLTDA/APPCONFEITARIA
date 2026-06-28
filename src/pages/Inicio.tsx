import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Share, Plus, ClipboardText, CalendarDots,
  TrendUp, TrendDown, CurrencyDollar, ShoppingBag,
  Bell, User, Storefront, SignOut,
  Package, CookingPot, Users, ChartLineUp, ForkKnife, CaretRight,
} from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";
import WelcomeChecklist from "@/components/WelcomeChecklist";
import UpdatesFeed from "@/components/UpdatesFeed";

interface AlertaCard {
  tipo: "pedido" | "entrega" | "aniversario";
  count: number;
  texto: string;
  detalhe?: string;
  cta: string;
  onClick: () => void;
}

interface ChartPoint { dia: string; valor: number; }

const STATUS_PENDENTES = ["pendente", "novo"];
const STATUS_ATIVOS = ["pendente", "novo", "confirmado", "em_producao", "pronto", "aguardando_retirada", "aguardando_entrega"];

/**
 * Página Início — Central de comando do dia (Entrega 3 da Proposta D).
 *
 * Substitui a antiga dashboard com gráfico mock + calendário, por uma tela
 * focada em "o que eu preciso fazer agora?":
 *  - Hero com degradê (preservado) + indicadores principais flutuando
 *  - Ações rápidas (compartilhar cardápio, novo pedido)
 *  - Atenção hoje (4 alertas acionáveis)
 *  - Resumo da semana (vendas, pedidos, variação %)
 *  - Gráfico de faturamento real dos últimos 30 dias
 */
export default function Inicio() {
  const navigate = useNavigate();
  const { profile } = useProfile();

  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    pedidosPendentes: 0,
    entregasHoje: 0,
    aniversariantes: 0,
    faturamentoMes: 0,
  });
  const [aniversariantesDetalhe, setAniversariantesDetalhe] = useState<{ nome: string; dias: number } | null>(null);
  const [resumoSemana, setResumoSemana] = useState({ vendas: 0, pedidos: 0 });
  const [resumoAnterior, setResumoAnterior] = useState({ vendas: 0, pedidos: 0 });
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [checklistDone, setChecklistDone] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // Pega email do auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  // Click outside fecha o menu
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const nome = profile?.nome || "";
  const slug = profile?.slug || "";
  const linkCardapio = slug ? `${window.location.origin}/cardapio/${slug}` : "";
  const publicado = !!slug;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  const hojeFormatado = () => {
    const d = new Date();
    const s = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  // ─── Carregar dados ───
  useEffect(() => {
    if (!profile?.id) return;
    carregarTudo();
  }, [profile?.id]);

  const carregarTudo = async () => {
    setLoading(true);
    try {
      const userId = profile!.id;
      const hoje = new Date();
      const hojeISO = hoje.toISOString().slice(0, 10);

      const inicio7d = new Date(hoje); inicio7d.setDate(hoje.getDate() - 7);
      const inicio14d = new Date(hoje); inicio14d.setDate(hoje.getDate() - 14);
      const inicio30d = new Date(hoje); inicio30d.setDate(hoje.getDate() - 30);
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

      const [
        pedidosPendentesRes,
        entregasHojeRes,
        clientesRes,
        pedidosSemanaRes,
        pedidosSemanaAntRes,
        pedidos30dRes,
        pedidosMesRes,
      ] = await Promise.all([
        // Pedidos pendentes (aguardando confirmação)
        supabase
          .from("pedidos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .in("status", STATUS_PENDENTES),
        // Entregas de hoje (qualquer status ativo)
        supabase
          .from("pedidos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("data_entrega", hojeISO)
          .in("status", STATUS_ATIVOS),
        // Clientes com data de nascimento — pra calcular aniversariantes
        supabase
          .from("clientes")
          .select("nome, data_nascimento")
          .eq("user_id", userId)
          .not("data_nascimento", "is", null),
        // Vendas dos últimos 7 dias
        supabase
          .from("pedidos")
          .select("id, valor_total")
          .eq("user_id", userId)
          .gte("created_at", inicio7d.toISOString())
          .neq("status", "cancelado"),
        // Vendas dos 7 dias anteriores (pra variação)
        supabase
          .from("pedidos")
          .select("id, valor_total")
          .eq("user_id", userId)
          .gte("created_at", inicio14d.toISOString())
          .lt("created_at", inicio7d.toISOString())
          .neq("status", "cancelado"),
        // Pedidos dos últimos 30 dias — pro gráfico
        supabase
          .from("pedidos")
          .select("created_at, valor_total")
          .eq("user_id", userId)
          .gte("created_at", inicio30d.toISOString())
          .neq("status", "cancelado"),
        // Faturamento do mês atual
        supabase
          .from("pedidos")
          .select("valor_total")
          .eq("user_id", userId)
          .gte("created_at", inicioMes.toISOString())
          .neq("status", "cancelado"),
      ]);

      // Aniversariantes nos próximos 7 dias
      const aniversariantes = calcularAniversariantes(clientesRes.data || []);
      const proxAniv = aniversariantes[0] || null;

      // Resumo semana
      const vendasSemana = (pedidosSemanaRes.data || [])
        .reduce((s: number, p: any) => s + (Number(p.valor_total) || 0), 0);
      const vendasAnt = (pedidosSemanaAntRes.data || [])
        .reduce((s: number, p: any) => s + (Number(p.valor_total) || 0), 0);

      // Gráfico 30 dias — agrupado por dia
      const chart = construirChart30d(pedidos30dRes.data || []);

      // Faturamento do mês atual
      const faturamentoMes = (pedidosMesRes.data || [])
        .reduce((s: number, p: any) => s + (Number(p.valor_total) || 0), 0);

      setCounts({
        pedidosPendentes: pedidosPendentesRes.count || 0,
        entregasHoje: entregasHojeRes.count || 0,
        aniversariantes: aniversariantes.length,
        faturamentoMes,
      });
      setAniversariantesDetalhe(proxAniv);
      setResumoSemana({ vendas: vendasSemana, pedidos: pedidosSemanaRes.data?.length || 0 });
      setResumoAnterior({ vendas: vendasAnt, pedidos: pedidosSemanaAntRes.data?.length || 0 });
      setChartData(chart);
    } catch (err) {
      console.error("Erro ao carregar dados do início:", err);
    }
    setLoading(false);
  };

  /** Calcula aniversariantes nos próximos 7 dias (ignora ano). */
  const calcularAniversariantes = (clientes: any[]): Array<{ nome: string; dias: number }> => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return clientes
      .map((c: any) => {
        if (!c.data_nascimento) return null;
        const [, mes, dia] = c.data_nascimento.split("-").map(Number);
        const proximoAniv = new Date(hoje.getFullYear(), mes - 1, dia);
        if (proximoAniv < hoje) proximoAniv.setFullYear(hoje.getFullYear() + 1);
        const dias = Math.ceil((proximoAniv.getTime() - hoje.getTime()) / 86400000);
        return { nome: c.nome, dias };
      })
      .filter((c): c is { nome: string; dias: number } => c !== null && c.dias >= 0 && c.dias <= 7)
      .sort((a, b) => a.dias - b.dias);
  };

  /** Constrói série diária dos últimos 30 dias somando valor_total dos pedidos. */
  const construirChart30d = (pedidos: any[]): ChartPoint[] => {
    const hoje = new Date();
    const mapa: Record<string, number> = {};
    pedidos.forEach((p: any) => {
      if (!p.created_at) return;
      const dia = p.created_at.slice(0, 10);
      mapa[dia] = (mapa[dia] || 0) + (Number(p.valor_total) || 0);
    });
    const result: ChartPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(hoje.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      result.push({
        dia: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        valor: mapa[iso] || 0,
      });
    }
    return result;
  };

  // ─── Ações ───
  const handleCompartilhar = async () => {
    if (!publicado) {
      navigate("/cardapio");
      return;
    }
    const texto = `Confira o cardápio da minha confeitaria: ${linkCardapio}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Meu Cardápio", text: texto, url: linkCardapio });
      } catch { /* cancelado */ }
    } else {
      navigator.clipboard.writeText(linkCardapio);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  // ─── Helpers de render ───
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  /** Formato compacto pra cards pequenos: R$ 1,2K | R$ 12,5K | R$ 1,3M */
  const formatCurrencyCompact = (v: number): string => {
    if (v < 1000) return formatCurrency(v);
    if (v < 1_000_000) return `R$ ${(v / 1000).toFixed(v < 10_000 ? 1 : 0).replace(".", ",")}K`;
    return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  };

  const variacao = (atual: number, ant: number): { pct: number; tipo: "up" | "down" } | null => {
    // Sem baseline (conta nova / período anterior sem dados) → não mostra variação
    if (ant === 0) return null;
    const pct = ((atual - ant) / ant) * 100;
    if (pct === 0) return null;
    return { pct: Math.abs(pct), tipo: pct > 0 ? "up" : "down" };
  };

  // ─── Cards de alerta (bloco Atenção) ───
  const alertCards: AlertaCard[] = [
    {
      tipo: "pedido",
      count: counts.pedidosPendentes,
      texto: counts.pedidosPendentes === 1 ? "pedido aguardando confirmação" : "pedidos aguardando confirmação",
      cta: "Ver pedidos",
      onClick: () => navigate("/pedidos"),
    },
    {
      tipo: "entrega",
      count: counts.entregasHoje,
      texto: counts.entregasHoje === 1 ? "entrega para hoje" : "entregas para hoje",
      cta: "Ver agenda",
      onClick: () => navigate("/agenda"),
    },
    {
      tipo: "aniversario",
      count: counts.aniversariantes,
      texto: (() => {
        if (!aniversariantesDetalhe) {
          return counts.aniversariantes === 1 ? "aniversariante em 7 dias" : "aniversariantes em 7 dias";
        }
        const primeiroNome = aniversariantesDetalhe.nome.split(" ")[0];
        const quando = aniversariantesDetalhe.dias === 0 ? "hoje" : aniversariantesDetalhe.dias === 1 ? "amanhã" : `em ${aniversariantesDetalhe.dias} dias`;
        if (counts.aniversariantes === 1) {
          return `${primeiroNome} faz aniversário ${quando}`;
        }
        const restantes = counts.aniversariantes - 1;
        return `${primeiroNome} e +${restantes} fazem aniversário em 7 dias`;
      })(),
      cta: "Ver clientes",
      onClick: () => navigate("/clientes"),
    },
  ];

  const alertasVisiveis = alertCards.filter((a) => a.count > 0);
  const varVendas = variacao(resumoSemana.vendas, resumoAnterior.vendas);
  const varPedidos = variacao(resumoSemana.pedidos, resumoAnterior.pedidos);

  return (
    <div className="ini-root">
      {/* ── Hero degradê animado ── */}
      <div className="ini-hero">
        <div className="ini-hero-greeting">
          <p>{hojeFormatado()}</p>
          <h1>{getGreeting()}, {(nome || "bem-vinda").split(" ")[0]}</h1>
        </div>

        {/* Foto de perfil no canto superior direito */}
        <div className="ini-profile-wrapper" ref={menuRef}>
          <button className="ini-profile-btn" onClick={() => setMenuOpen(o => !o)}>
            {profile?.foto_url
              ? <img src={profile.foto_url} alt="Perfil" className="ini-profile-img" />
              : <div className="ini-profile-placeholder"><User size={22} weight="bold" color="#fff" /></div>
            }
          </button>

          {menuOpen && (
            <div className="ini-profile-menu">
              <div className="ini-pm-header">
                <p className="ini-pm-name">{profile?.nome_loja || nome}</p>
                <p className="ini-pm-email">{email}</p>
                <p className="ini-pm-version">Versão 1.5.8</p>
              </div>
              <div className="ini-pm-divider" />
              <button className="ini-pm-item" onClick={() => { setMenuOpen(false); navigate("/notificacoes"); }}>
                <Bell size={18} weight="regular" /> Notificações
              </button>
              <button className="ini-pm-item" onClick={() => { setMenuOpen(false); navigate("/configuracoes"); }}>
                <User size={18} weight="regular" /> Minha Conta
              </button>
              <button className="ini-pm-item" onClick={() => { setMenuOpen(false); navigate("/cardapio-config"); }}>
                <Storefront size={18} weight="regular" /> Minha Loja
              </button>
              <div className="ini-pm-divider" />
              <button className="ini-pm-item ini-pm-item--sair" onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}>
                <SignOut size={18} weight="regular" /> Sair
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="ini-content">
        {/* ── Coluna principal ── */}
        <div className="ini-main">

      {/* ── Navegação rápida ── */}
      <section className="ini-section ini-section--nav">
        <h2 className="ini-section-title">Navegação rápida</h2>
        <p className="ini-section-sub">Acesso direto às áreas principais</p>
        <div className="ini-nav-grid">
          {[
            { icon: <Plus size={20} weight="bold" />, label: "Novo pedido", sub: "Registrar encomenda", path: "/pedidos/novo", color: "#3d1a24", bg: "#FFF1F7" },
            { icon: <ClipboardText size={20} weight="duotone" />, label: "Pedidos", sub: "Ver e gerenciar", path: "/pedidos", color: "#1D4ED8", bg: "#DBEAFE" },
            { icon: <Package size={20} weight="duotone" />, label: "Insumos", sub: "Ingredientes e embalagens", path: "/insumos", color: "#15803D", bg: "#DCFCE7" },
            { icon: <CookingPot size={20} weight="duotone" />, label: "Receitas", sub: "Fichas técnicas", path: "/receitas", color: "#D97706", bg: "#FEF3C7" },
            { icon: <Users size={20} weight="duotone" />, label: "Clientes", sub: "Base de clientes", path: "/clientes", color: "#7C3AED", bg: "#F5F3FF" },
            { icon: <ChartLineUp size={20} weight="duotone" />, label: "Financeiro", sub: "Contas e controle", path: "/financeiro", color: "#0891B2", bg: "#ECFEFF" },
          ].map((item) => (
            <button key={item.path} className="ini-nav-card" onClick={() => navigate(item.path)}>
              <div className="ini-nav-icon" style={{ background: item.bg, color: item.color }}>{item.icon}</div>
              <div className="ini-nav-meta">
                <span className="ini-nav-label">{item.label}</span>
                <span className="ini-nav-sub">{item.sub}</span>
              </div>
              <CaretRight size={14} weight="bold" className="ini-nav-arrow" />
            </button>
          ))}
        </div>
      </section>

      {/* ── Atenção hoje ── */}
      {alertasVisiveis.length > 0 && (
        <section className="ini-section ini-section--alertas">
          <h2 className="ini-section-title">Atenção hoje</h2>
          <div className="ini-alertas">
            {alertasVisiveis.map((a) => (
              <button key={a.tipo} className={`ini-alerta ini-alerta--${a.tipo}`} onClick={a.onClick}>
                <span className="ini-alerta-icon">
                  {a.tipo === "pedido"     && <ClipboardText size={18} weight="fill" />}
                  {a.tipo === "entrega"    && <CalendarDots  size={18} weight="fill" />}
                  {a.tipo === "aniversario"&& <img src="/Sistema/aniversario.png" alt="" width={28} height={28} style={{ objectFit: "contain" }} />}
                </span>
                <div className="ini-alerta-body">
                  <span className="ini-alerta-texto">
                    {a.tipo === "aniversario" && aniversariantesDetalhe
                      ? a.texto
                      : <><strong>{a.count}</strong> {a.texto}</>
                    }
                  </span>
                </div>
                <span className="ini-alerta-cta">{a.cta} ›</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {alertasVisiveis.length === 0 && !loading && (
        <section className="ini-section ini-section--alertas">
          <div className="ini-tudo-ok">
            <span className="ini-tudo-ok-emoji">✨</span>
            <div>
              <p className="ini-tudo-ok-title">Tudo em ordem!</p>
              <p className="ini-tudo-ok-sub">Sem alertas hoje. Bom trabalho!</p>
            </div>
          </div>
        </section>
      )}

      {/* ── Resumo da semana ── */}
      <section className="ini-section ini-section--resumo">
        <h2 className="ini-section-title">Resumo da semana</h2>
        <div className="ini-resumo">
          <div className="ini-resumo-card">
            <div className="ini-resumo-icon" style={{ background: "#DCFCE7", color: "#15803D" }}>
              <CurrencyDollar size={20} weight="duotone" />
            </div>
            <div>
              <p className="ini-resumo-val">{formatCurrency(resumoSemana.vendas)}</p>
              <p className="ini-resumo-label">em vendas</p>
              {varVendas && (
                <p className={`ini-resumo-var ${varVendas.tipo}`}>
                  {varVendas.tipo === "up" ? <TrendUp size={11} weight="bold" /> : <TrendDown size={11} weight="bold" />}
                  {varVendas.pct.toFixed(0)}%
                </p>
              )}
            </div>
          </div>

          <div className="ini-resumo-card">
            <div className="ini-resumo-icon" style={{ background: "#FFF1F7", color: "#3d1a24" }}>
              <ShoppingBag size={20} weight="duotone" />
            </div>
            <div>
              <p className="ini-resumo-val">{resumoSemana.pedidos}</p>
              <p className="ini-resumo-label">{resumoSemana.pedidos === 1 ? "pedido" : "pedidos"}</p>
              {varPedidos && (
                <p className={`ini-resumo-var ${varPedidos.tipo}`}>
                  {varPedidos.tipo === "up" ? <TrendUp size={11} weight="bold" /> : <TrendDown size={11} weight="bold" />}
                  {varPedidos.pct.toFixed(0)}%
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Agenda de Entregas (mock visual) ── */}
      <section className="ini-section ini-section--agenda">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 className="ini-section-title">Agenda de entregas</h2>
            <p className="ini-section-sub">Encomendas agendadas por data</p>
          </div>
          <button className="ini-agenda-link" onClick={() => navigate("/agenda")}>Ver todas ›</button>
        </div>
        <div className="ini-agenda-stats">
          <span><CalendarDots size={14} weight="fill" /> 0 encomendas no mês</span>
          <span><ClipboardText size={14} weight="fill" /> 0 dias com entrega</span>
        </div>
        <div className="ini-agenda-cal">
          <div className="ini-agenda-nav">
            <button>‹</button>
            <span>{new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase())}</span>
            <button>›</button>
          </div>
          <div className="ini-agenda-grid">
            {["dom","seg","ter","qua","qui","sex","sáb"].map(d => (
              <span key={d} className="ini-agenda-day-label">{d}</span>
            ))}
            {(() => {
              const now = new Date();
              const first = new Date(now.getFullYear(), now.getMonth(), 1);
              const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
              const startPad = first.getDay();
              const cells = [];
              for (let i = 0; i < startPad; i++) cells.push(<span key={`p${i}`} className="ini-agenda-day ini-agenda-day--pad" />);
              for (let d = 1; d <= lastDay; d++) {
                const isToday = d === now.getDate();
                cells.push(
                  <span key={d} className={`ini-agenda-day ${isToday ? "ini-agenda-day--today" : ""}`}>{d}</span>
                );
              }
              return cells;
            })()}
          </div>
        </div>
      </section>

      {/* ── Faturamento 30 dias (dados REAIS) ── */}
      <section className="ini-section ini-section--chart">
        <div className="ini-chart-header">
          <h2 className="ini-section-title">Faturamento (30 dias)</h2>
        </div>
        <div className="ini-chart-card">
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `R$${v}`} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, fontFamily: "Geist,sans-serif" }}
                  formatter={(v: any) => [formatCurrency(Number(v)), "Faturamento"]}
                />
                <Line type="monotone" dataKey="valor" stroke="#3d1a24" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#3d1a24" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
        </div>

        {/* ── Checklist lateral (desktop) / abaixo (mobile) ── */}
        <aside className="ini-aside">
          {profile?.id && !checklistDone && (
            <WelcomeChecklist userId={profile.id} onAllDone={setChecklistDone} />
          )}
          {checklistDone && <UpdatesFeed />}
        </aside>
      </div>

      <style>{`
        .ini-root {
          font-family: var(--font-base);
          padding: 0 var(--space-3) 6rem;
          display: flex; flex-direction: column;
          max-width: 980px; margin: 0 auto;
        }

        /* ── Layout 2 colunas ── */
        .ini-content {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          margin-top: var(--space-2);
        }
        .ini-main {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
        }
        .ini-aside {
          width: 100%;
        }

        /* ── Hero degradê animado (preservado) ── */
        .ini-hero {
          background: linear-gradient(135deg, var(--primary-dark), var(--text-title), #1f0a12, var(--text-title), var(--primary-dark));
          background-size: 300% 300%;
          animation: heroGradientMove 10s ease infinite;
          border-radius: 0;
          padding: 2rem 1.25rem 2rem;
          /* Full-bleed: estende até a borda da viewport ignorando padding dos pais */
          width: 100vw;
          margin-left: calc(50% - 50vw);
          margin-right: calc(50% - 50vw);
          margin-top: calc(-1 * (var(--pad-page-top) + env(safe-area-inset-top, 0px)));
          padding-top: calc(1.25rem + env(safe-area-inset-top, 0px));
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          z-index: 0;
        }
        @keyframes heroGradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .ini-hero-greeting p {
          font-size: var(--font-helper); color: rgba(255,255,255,0.6);
          margin: 0; line-height: 1.3;
        }
        .ini-hero-greeting h1 {
          font-size: var(--font-input); font-weight: var(--fw-semibold); color: rgba(255,255,255,0.95);
          margin: var(--space-1) 0 0; line-height: 1.3;
          letter-spacing: 0;
        }

        /* ── Profile button + dropdown menu ── */
        .ini-profile-wrapper { position: relative; }
        .ini-profile-btn {
          width: 42px; height: 42px; border-radius: var(--radius-full);
          border: 2.5px solid rgba(255,255,255,0.6);
          background: rgba(255,255,255,0.15);
          cursor: pointer; padding: 0; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          transition: border-color var(--dur-fast), transform var(--dur-fast);
        }
        .ini-profile-btn:hover { border-color: var(--text-inverse); transform: scale(1.05); }
        .ini-profile-img { width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-full); }
        .ini-profile-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }

        .ini-profile-menu {
          position: absolute; top: calc(100% + 10px); right: 0;
          width: 260px;
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          border: 1px solid var(--border);
          z-index: 100;
          overflow: hidden;
          animation: iniMenuIn var(--dur-fast) var(--ease-out);
        }
        @keyframes iniMenuIn { from { opacity: 0; transform: translateY(-6px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }

        .ini-pm-header { padding: var(--space-4) var(--space-4) var(--space-3); }
        .ini-pm-name { margin: 0; font-size: var(--font-input); font-weight: var(--fw-bold); color: var(--text-title); }
        .ini-pm-email { margin: 2px 0 0; font-size: var(--font-helper); color: var(--text-muted); }
        .ini-pm-version { margin: 4px 0 0; font-size: var(--font-caption); color: var(--text-disabled); font-style: italic; }
        .ini-pm-divider { height: 1px; background: var(--border); margin: 0; }
        .ini-pm-item {
          display: flex; align-items: center; gap: var(--space-3);
          width: 100%; padding: var(--space-3) var(--space-4);
          background: none; border: none; cursor: pointer;
          font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-medium);
          color: var(--text-primary); text-align: left;
          transition: background var(--dur-fast);
        }
        .ini-pm-item:hover { background: var(--bg-subtle); }
        .ini-pm-item--sair { color: var(--primary); }

        /* ── Sections ── */
        .ini-section {
          margin-top: var(--gap-section);
          display: flex; flex-direction: column; gap: var(--gap-stack);
        }
        .ini-section-title {
          font-size: var(--font-button); font-weight: var(--fw-bold);
          color: var(--text-title);
          margin: 0;
        }

        /* ── Ações rápidas ── */
        .ini-actions {
          display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap-tight);
        }
        .ini-action {
          display: flex; align-items: center; justify-content: center; gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-lg);
          font-family: inherit;
          font-size: var(--font-button); font-weight: var(--fw-bold);
          color: var(--text-title);
          cursor: pointer;
          transition: all var(--dur-fast) var(--ease-out);
        }
        .ini-action:hover { border-color: var(--primary-dark); transform: translateY(-1px); }
        .ini-action--primary {
          background: var(--primary); color: var(--text-inverse);
          border-color: var(--primary);
          box-shadow: var(--shadow-md);
        }
        .ini-action--primary:hover { background: var(--btn-primary-hover); border-color: var(--btn-primary-hover); }

        /* ── Section subtitle ── */
        .ini-section-sub {
          margin: -0.3rem 0 0;
          font-size: var(--font-caption);
          color: var(--text-muted);
        }

        /* ── Navegação rápida ── */
        .ini-nav-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--gap-tight);
        }
        .ini-nav-card {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          transition: all var(--dur-fast);
        }
        .ini-nav-card:hover { border-color: var(--primary); transform: translateX(2px); }
        .ini-nav-icon {
          width: 36px; height: 36px;
          border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ini-nav-meta { flex: 1; min-width: 0; }
        .ini-nav-label {
          display: block;
          font-size: var(--font-button);
          font-weight: var(--fw-semibold);
          color: var(--text-title);
          line-height: 1.3;
        }
        .ini-nav-sub {
          display: block;
          font-size: var(--font-caption);
          color: var(--text-muted);
          margin-top: 1px;
        }
        .ini-nav-arrow { color: var(--text-disabled); flex-shrink: 0; }

        /* ── Agenda de Entregas ── */
        .ini-agenda-link {
          background: none; border: none; cursor: pointer;
          font-family: inherit; font-size: var(--font-caption);
          font-weight: var(--fw-semibold); color: var(--primary);
          padding: 0;
        }
        .ini-agenda-link:hover { text-decoration: underline; }
        .ini-agenda-stats {
          display: flex; gap: var(--space-5);
          font-size: var(--font-caption);
          color: var(--text-muted);
          padding: var(--space-2) var(--space-3);
          background: var(--bg-body);
          border-radius: var(--radius-md);
        }
        .ini-agenda-stats span {
          display: flex; align-items: center; gap: var(--space-1);
        }
        .ini-agenda-cal {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-3);
        }
        .ini-agenda-nav {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0 var(--space-1) var(--space-2);
          font-size: var(--font-button); font-weight: var(--fw-semibold);
          color: var(--text-title);
        }
        .ini-agenda-nav button {
          background: none; border: none; cursor: pointer;
          font-size: var(--text-lg); color: var(--text-secondary);
          padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm);
        }
        .ini-agenda-nav button:hover { background: var(--bg-body); }
        .ini-agenda-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          text-align: center;
          gap: 1px;
        }
        .ini-agenda-day-label {
          font-size: var(--font-caption);
          font-weight: var(--fw-semibold);
          color: var(--text-muted);
          text-transform: lowercase;
          padding: var(--space-1) 0;
        }
        .ini-agenda-day {
          font-size: var(--font-caption);
          color: var(--text-secondary);
          padding: var(--space-2) 0;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: background var(--dur-fast);
        }
        .ini-agenda-day:hover { background: var(--bg-body); }
        .ini-agenda-day--pad { cursor: default; }
        .ini-agenda-day--pad:hover { background: none; }
        .ini-agenda-day--today {
          background: var(--primary);
          color: var(--text-inverse);
          font-weight: var(--fw-bold);
          border-radius: var(--radius-md);
        }
        .ini-agenda-day--today:hover { background: var(--primary); }

        /* ── Alertas ── */
        .ini-alertas {
          display: flex; flex-direction: column; gap: var(--gap-tight);
        }
        .ini-alerta {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-left-width: 4px;
          border-radius: var(--radius-md);
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          transition: transform var(--dur-fast) var(--ease-out);
        }
        .ini-alerta:hover { transform: translateX(2px); }
        .ini-alerta--pedido      { border-left-color: var(--error); }
        .ini-alerta--entrega     { border-left-color: var(--info); }
        .ini-alerta--aniversario { border-left-color: var(--primary); }

        .ini-alerta-icon {
          width: 32px; height: 32px; border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ini-alerta--pedido      .ini-alerta-icon { background: #FEE2E2; color: var(--error); }
        .ini-alerta--entrega     .ini-alerta-icon { background: #DBEAFE; color: #1D4ED8; }
        .ini-alerta--aniversario .ini-alerta-icon { background: transparent; color: var(--primary); }

        .ini-alerta-body { flex: 1; min-width: 0; }
        .ini-alerta-texto {
          font-size: var(--font-button); font-weight: var(--fw-medium);
          color: var(--text-primary);
          line-height: 1.3;
        }
        .ini-alerta-texto strong { color: var(--text-title); font-weight: var(--fw-black); }
        .ini-alerta-cta {
          font-size: var(--font-helper); font-weight: var(--fw-bold);
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .ini-tudo-ok {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-4);
          background: linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%);
          border-radius: var(--radius-lg);
        }
        .ini-tudo-ok-emoji { font-size: var(--text-xl); }
        .ini-tudo-ok-title { margin: 0; font-weight: var(--fw-bold); color: var(--text-title); font-size: var(--font-body); }
        .ini-tudo-ok-sub { margin: var(--space-1) 0 0; font-size: var(--font-helper); color: var(--text-muted); }

        /* ── Resumo da semana ── */
        .ini-resumo {
          display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap-tight);
        }
        .ini-resumo-card {
          display: flex; align-items: flex-start; gap: var(--space-3);
          padding: var(--pad-card);
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
        }
        .ini-resumo-icon {
          width: 38px; height: 38px; border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ini-resumo-val {
          font-size: var(--font-modal-title); font-weight: var(--fw-bold);
          color: var(--text-title);
          margin: 0; line-height: 1.1;
          word-break: break-word;
          letter-spacing: -0.01em;
        }
        .ini-resumo-label {
          font-size: var(--font-caption); font-weight: var(--fw-medium);
          color: var(--text-muted);
          margin: var(--space-1) 0 0;
        }
        .ini-resumo-var {
          display: inline-flex; align-items: center; gap: 3px;
          margin: var(--space-2) 0 0;
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm);
          font-size: var(--font-caption); font-weight: var(--fw-semibold);
          line-height: 1.4;
        }
        .ini-resumo-var.up   { color: var(--success); background: #DCFCE7; }
        .ini-resumo-var.down { color: var(--error); background: #FEE2E2; }

        /* ── Gráfico ── */
        .ini-chart-header { display: flex; justify-content: space-between; align-items: center; }
        .ini-chart-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-3) var(--space-2) var(--space-2);
        }

        /* ── Mobile: ordem e visibilidade ── */
        .ini-aside { order: -1; }
        .ini-main { display: flex; flex-direction: column; }
        .ini-section--resumo  { order: 1; }
        .ini-section--nav     { order: 2; }
        .ini-section--agenda  { order: 3; }
        .ini-section--alertas { order: 4; }
        .ini-section--chart   { display: none; }

        /* ── Desktop ajustes ── */
        @media (min-width: 768px) {
          .ini-root { padding: 0 1.5rem 2rem; }
          .ini-hero {
            width: auto;
            margin-left: -1.5rem;
            margin-right: -1.5rem;
            margin-top: -2rem;
            padding: 2rem 2rem;
            border-radius: 0;
          }
          .ini-hero-greeting h1 { font-size: var(--text-2xl); }
          .ini-hero-greeting p { font-size: var(--font-input); }
          .ini-actions { grid-template-columns: 1fr 1fr; max-width: 720px; margin-left: auto; margin-right: auto; }
          .ini-resumo { grid-template-columns: 1fr 1fr; max-width: 720px; margin-left: auto; margin-right: auto; }
          .ini-alertas, .ini-tudo-ok, .ini-chart-card { max-width: 720px; margin-left: auto; margin-right: auto; }
          .ini-section { width: 100%; }
          .ini-profile-btn { width: 48px; height: 48px; }
        }

        /* ── 2 colunas: checklist + dashboard ── */
        @media (min-width: 1100px) {
          .ini-root { max-width: 1200px; }

          /* Hero escondido no desktop — saudação vai pro sidebar */
          .ini-hero {
            display: none;
          }

          /* Grid 2 colunas */
          .ini-content {
            display: grid;
            grid-template-columns: 380px 1fr;
            gap: 1.5rem;
            align-items: start;
          }
          .ini-aside { order: -1; position: sticky; top: 1.5rem; }

          /* Seções compactas */
          .ini-main .ini-section { margin-top: 1rem; order: 0; }
          .ini-main .ini-section:first-child { margin-top: 0; }
          .ini-main .ini-section--chart { display: flex; }

          /* Remove max-width centralizados */
          .ini-main .ini-actions,
          .ini-main .ini-resumo,
          .ini-main .ini-alertas,
          .ini-main .ini-tudo-ok,
          .ini-main .ini-chart-card { max-width: none; margin-left: 0; margin-right: 0; }

          /* Seções em cards */
          .ini-main .ini-section {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius-xl);
            padding: 1.25rem;
          }
          .ini-main .ini-section .ini-actions { grid-template-columns: 1fr 1fr; }
          .ini-main .ini-section .ini-resumo { grid-template-columns: 1fr 1fr; }
          .ini-main .ini-section .ini-nav-grid { grid-template-columns: 1fr 1fr 1fr; }

          /* Cards internos sem borda dupla */
          .ini-main .ini-section .ini-resumo-card { border: 1px solid var(--border); }
          .ini-main .ini-section .ini-chart-card { border: none; padding: 0; }
          .ini-main .ini-section .ini-tudo-ok { border: none; }
          .ini-main .ini-section .ini-alerta { border: 1px solid var(--border); border-left-width: 4px; }
          .ini-main .ini-section .ini-agenda-cal { border: none; padding: 0.75rem 0 0; }
          .ini-main .ini-section .ini-agenda-stats { margin: 0; }

          /* Chart: força dimensões corretas */
          .ini-main .ini-chart-card > div { width: 100% !important; min-width: 0; }
        }
      `}</style>
    </div>
  );
}

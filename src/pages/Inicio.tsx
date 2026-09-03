// Build marker: 2026-09-03T14:15 — badge de câmera + placeholder destacado + toggle notificações
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Share, Plus, ClipboardText, CalendarDots,
  TrendUp, TrendDown, CurrencyDollar, ShoppingBag,
  Bell, User, Storefront, SignOut, Camera,
  Package, CookingPot, Users, ChartLineUp, ForkKnife, CaretRight,
  InstagramLogo, Crown, DotsThreeOutline, Clock,
} from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { enableNotifications, disableNotifications, getStoredNotifState } from "@/lib/notifications";
import { useProfile } from "@/hooks/useProfile";
import WelcomeChecklist from "@/components/WelcomeChecklist";
import UpdatesFeed from "@/components/UpdatesFeed";
import DooIAPanel from "@/components/DooIAPanel";
import { FinModal } from "@/components/financeiro";

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
  const { profile, refetch: refetchProfile } = useProfile();

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
  const [proximasEntregas, setProximasEntregas] = useState<Array<{ id: string; cliente: string; data: string; valor: number }>>([]);
  const [checklistDone, setChecklistDone] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // Upload rápido de foto de perfil pelo ícone de câmera no header.
  // Reaproveita o mesmo bucket/path usado pela página Configurações.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reseta pra permitir escolher o MESMO arquivo depois
    if (!file || !profile?.id) return;

    if (!file.type.startsWith("image/")) {
      alert("Escolha um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("A imagem precisa ter no máximo 5MB.");
      return;
    }

    setUploadingFoto(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `avatars/${profile.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("profiles")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("profiles").getPublicUrl(path);
      // cache-bust pra forçar reload da imagem se já existia no mesmo path
      const publicUrl = `${pub.publicUrl}?t=${Date.now()}`;

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ foto_url: publicUrl })
        .eq("id", profile.id);
      if (dbErr) throw dbErr;

      await refetchProfile();
    } catch (err: any) {
      console.error("[foto] erro no upload:", err);
      alert("Não foi possível trocar a foto. Tente novamente.");
    } finally {
      setUploadingFoto(false);
    }
  };

  // Toggle "Ativar notificações" — pede permissão real do navegador.
  // Persistência + registro do SW ficam em lib/notifications.ts.
  const [notifAtivas, setNotifAtivas] = useState<boolean>(() => getStoredNotifState());
  const [notifLoading, setNotifLoading] = useState(false);
  const toggleNotif = async () => {
    if (notifLoading) return;
    setNotifLoading(true);
    try {
      const novoEstado = notifAtivas
        ? await disableNotifications()
        : await enableNotifications();
      setNotifAtivas(novoEstado);
    } finally {
      setNotifLoading(false);
    }
  };

  // Modal "Ver todos os alertas" + snooze ("Lembrar amanhã")
  const ALERT_LIMIT_VISIBLE = 3;
  const SNOOZE_STORAGE_KEY = "doonly_alertas_snoozed_until";
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SNOOZE_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const isSnoozed = !!snoozedUntil && new Date(snoozedUntil) > new Date();

  function snoozeAlerts() {
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const iso = tomorrow.toISOString();
    try {
      localStorage.setItem(SNOOZE_STORAGE_KEY, iso);
    } catch {
      // silencioso — se localStorage falhar (incógnito/cota), só não persiste
    }
    setSnoozedUntil(iso);
  }

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

  // Frases rotativas — uma por dia, determinística (mesmo dia sempre mostra a mesma)
  const DAILY_MESSAGES = [
    "Vamos gerenciar sua confeitaria?",
    "Por onde quer começar hoje?",
    "Bora deixar tudo redondo hoje?",
    "Como está sua confeitaria hoje?",
    "Pronta pra um dia produtivo?",
    "Algum pedido especial pra hoje?",
    "Um dia doce começa aqui",
    "Vamos doçar esse dia?",
    "Que tal organizar a semana?",
    "__date__", // marcador: substituído pela data formatada
  ];
  const getDailyMessage = () => {
    const today = new Date();
    const key = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    let h = 0;
    for (let i = 0; i < key.length; i++) {
      h = ((h << 5) - h) + key.charCodeAt(i);
      h |= 0;
    }
    const idx = Math.abs(h) % DAILY_MESSAGES.length;
    const msg = DAILY_MESSAGES[idx];
    return msg === "__date__" ? hojeFormatado() : msg;
  };

  // Detecta plano PRO ativo (mostra a coroinha)
  const isPro = (() => {
    if (profile?.plano !== "pro") return false;
    if (!profile.pro_expira_em) return true;
    return new Date(profile.pro_expira_em) > new Date();
  })();

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
        proximasEntregasRes,
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
        // Próximas entregas (a partir de hoje, ordenadas por data)
        supabase
          .from("pedidos")
          .select("id, cliente_nome, data_entrega, valor_total")
          .eq("user_id", userId)
          .gte("data_entrega", hojeISO)
          .in("status", STATUS_ATIVOS)
          .order("data_entrega", { ascending: true })
          .limit(4),
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
      setProximasEntregas(
        (proximasEntregasRes.data || []).map((p: any) => ({
          id: p.id,
          cliente: p.cliente_nome || "Cliente",
          data: p.data_entrega,
          valor: Number(p.valor_total) || 0,
        }))
      );
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
      {/* ── Hero wine com foto da confeiteira, coroinha (PRO) e sparkles ── */}
      <div className="ini-hero">
        {/* Decoração: sparkles dourados */}
        <svg className="ini-hero-sparkles" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true">
          <g fill="#F4D03F" opacity="0.65">
            <path d="M18 12 L18.4 13.3 L19.7 13.7 L18.4 14.1 L18 15.4 L17.6 14.1 L16.3 13.7 L17.6 13.3 Z"/>
            <path d="M88 8 L88.5 9.6 L90.1 10.1 L88.5 10.6 L88 12.2 L87.5 10.6 L85.9 10.1 L87.5 9.6 Z"/>
            <path d="M62 22 L62.3 22.9 L63.2 23.2 L62.3 23.5 L62 24.4 L61.7 23.5 L60.8 23.2 L61.7 22.9 Z"/>
            <path d="M40 6 L40.3 6.9 L41.2 7.2 L40.3 7.5 L40 8.4 L39.7 7.5 L38.8 7.2 L39.7 6.9 Z"/>
            <path d="M75 30 L75.3 30.9 L76.2 31.2 L75.3 31.5 L75 32.4 L74.7 31.5 L73.8 31.2 L74.7 30.9 Z"/>
            <path d="M95 38 L95.3 38.9 L96.2 39.2 L95.3 39.5 L95 40.4 L94.7 39.5 L93.8 39.2 L94.7 38.9 Z"/>
          </g>
        </svg>

        {/* Foto da confeiteira (esquerda) — agora é também o trigger do menu */}
        <div className="ini-profile-wrapper" ref={menuRef}>
          <button className="ini-profile-btn" onClick={() => setMenuOpen(o => !o)}>
            {profile?.foto_url
              ? <img src={profile.foto_url} alt="Perfil" className="ini-profile-img" />
              : <div className="ini-profile-placeholder"><User size={30} weight="bold" color="#3d1a24" /></div>
            }
          </button>

          {/* Badge de câmera — atalho pra trocar a foto */}
          <button
            type="button"
            className="ini-profile-cam"
            onClick={() => !uploadingFoto && fileInputRef.current?.click()}
            aria-label={profile?.foto_url ? "Trocar foto de perfil" : "Adicionar foto de perfil"}
            title={profile?.foto_url ? "Trocar foto" : "Adicionar foto"}
            disabled={uploadingFoto}
          >
            {uploadingFoto
              ? <span className="ini-profile-cam-spinner" />
              : <Camera size={14} weight="fill" color="#fff" />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFotoUpload}
            style={{ display: "none" }}
          />

          {menuOpen && (
            <div className="ini-profile-menu">
              <div className="ini-pm-header">
                <p className="ini-pm-name">{profile?.nome_loja || nome}</p>
                <p className="ini-pm-email">{email}</p>
              </div>
              <div className="ini-pm-divider" />
              <div
                className="ini-pm-item ini-pm-item--toggle"
                onClick={toggleNotif}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleNotif(); } }}
                aria-pressed={notifAtivas}
              >
                <span className="ini-pm-item-label">
                  <Bell
                    size={18}
                    weight={notifAtivas ? "fill" : "regular"}
                    color={notifAtivas ? "#F4D03F" : undefined}
                  />
                  Ativar notificações
                </span>
                <span className={`ini-pm-toggle ${notifAtivas ? "ini-pm-toggle--on" : ""}`}>
                  <span className="ini-pm-toggle-thumb" />
                </span>
              </div>
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

        {/* Texto da saudação */}
        <div className="ini-hero-greeting">
          <h1>
            <span>{getGreeting()}, {(nome || "bem-vinda").split(" ")[0]}</span>
            {isPro && (
              <Crown size={18} weight="fill" className="ini-hero-crown" aria-label="Plano PRO" />
            )}
          </h1>
          <p>{getDailyMessage()}</p>
        </div>
      </div>

      <div className={`ini-content ${checklistDone ? "ini-content--done" : ""}`}>
        {/* ── Coluna principal ── */}
        <div className="ini-main">

      {/* ── Métricas (desktop only — dados reais) ── */}
      <section className="ini-section ini-section--metrics">
        <div className="ini-metrics-grid">
          {/* Card hero — Faturamento do mês (destaque) */}
          <div className="ini-metric-card ini-metric-card--hero">
            <div className="ini-metric-top">
              <div className="ini-metric-icon">
                <CurrencyDollar size={20} weight="duotone" />
              </div>
              <span className="ini-metric-label">Faturamento do mês</span>
            </div>
            <p className="ini-metric-val">{loading ? <span className="ini-skeleton ini-skeleton--val" /> : formatCurrency(counts.faturamentoMes)}</p>
            {!loading && varVendas && (
              <p className={`ini-metric-trend ${varVendas.tipo}`}>
                {varVendas.tipo === "up" ? <TrendUp size={13} weight="bold" /> : <TrendDown size={13} weight="bold" />}
                {varVendas.pct.toFixed(0)}% vs. semana anterior
              </p>
            )}
            {!loading && !varVendas && (
              <p className="ini-metric-trend neutral">Acompanhe sua evolução aqui</p>
            )}
          </div>

          {/* Card — Pedidos da semana */}
          <div className="ini-metric-card">
            <div className="ini-metric-top">
              <div className="ini-metric-icon">
                <ClipboardText size={18} weight="duotone" />
              </div>
              <span className="ini-metric-label">Pedidos na semana</span>
            </div>
            <p className="ini-metric-val">{loading ? <span className="ini-skeleton ini-skeleton--val" /> : resumoSemana.pedidos}</p>
            {!loading && varPedidos && (
              <p className={`ini-metric-trend ${varPedidos.tipo}`}>
                {varPedidos.tipo === "up" ? <TrendUp size={12} weight="bold" /> : <TrendDown size={12} weight="bold" />}
                {varPedidos.pct.toFixed(0)}%
              </p>
            )}
            {!loading && !varPedidos && <p className="ini-metric-trend neutral">últimos 7 dias</p>}
          </div>

          {/* Card — Entregas hoje */}
          <div className="ini-metric-card">
            <div className="ini-metric-top">
              <div className="ini-metric-icon">
                <CalendarDots size={18} weight="duotone" />
              </div>
              <span className="ini-metric-label">Entregas hoje</span>
            </div>
            <p className="ini-metric-val">{loading ? <span className="ini-skeleton ini-skeleton--val" /> : counts.entregasHoje}</p>
            <p className="ini-metric-trend neutral">
              {loading ? "" : counts.entregasHoje === 0 ? "nenhuma agendada" : counts.entregasHoje === 1 ? "para entregar" : "para entregar"}
            </p>
          </div>

          {/* Card — Ticket médio (derivado) */}
          <div className="ini-metric-card">
            <div className="ini-metric-top">
              <div className="ini-metric-icon">
                <TrendUp size={18} weight="duotone" />
              </div>
              <span className="ini-metric-label">Ticket médio</span>
            </div>
            <p className="ini-metric-val">
              {loading
                ? <span className="ini-skeleton ini-skeleton--val" />
                : formatCurrency(resumoSemana.pedidos > 0 ? resumoSemana.vendas / resumoSemana.pedidos : 0)}
            </p>
            <p className="ini-metric-trend neutral">por pedido na semana</p>
          </div>
        </div>
      </section>
      <section className="ini-section ini-section--nav">
        <h2 className="ini-section-title">Acesso rápido</h2>
        <div className="ini-nav-grid">
          {[
            { icon: <Plus size={20} weight="bold" />, label: "Novo pedido", sub: "Registrar encomenda", path: "/pedidos/novo", color: "#3d1a24", bg: "#FFF1F7", key: "novo" },
            { icon: <ClipboardText size={20} weight="duotone" />, label: "Pedidos", sub: "Ver e gerenciar", path: "/pedidos", color: "#1D4ED8", bg: "#DBEAFE", key: "pedidos" },
            { icon: <Package size={20} weight="duotone" />, label: "Insumos", sub: "Ingredientes e embalagens", path: "/insumos", color: "#15803D", bg: "#DCFCE7", key: "insumos" },
            { icon: <CookingPot size={20} weight="duotone" />, label: "Receitas", sub: "Fichas técnicas", path: "/receitas", color: "#D97706", bg: "#FEF3C7", key: "receitas" },
            { icon: <Users size={20} weight="duotone" />, label: "Clientes", sub: "Base de clientes", path: "/clientes", color: "#7C3AED", bg: "#F5F3FF", key: "clientes" },
            { icon: <ChartLineUp size={20} weight="duotone" />, label: "Financeiro", sub: "Contas e controle", path: "/financeiro", color: "#0891B2", bg: "#ECFEFF", key: "financeiro" },
          ].map((item) => (
            <button key={item.path} className="ini-nav-card" data-nav={item.key} onClick={() => navigate(item.path)}>
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
      {alertasVisiveis.length > 0 && !isSnoozed && (
        <section className="ini-section ini-section--alertas">
          <div className="ini-alertas-head">
            <h2 className="ini-section-title">Atenção hoje</h2>
            <button
              className="ini-alertas-snooze"
              onClick={snoozeAlerts}
              title="Esconde os alertas até amanhã"
            >
              <Clock size={14} weight="bold" />
              Lembrar amanhã
            </button>
          </div>
          <div className="ini-alertas">
            {alertasVisiveis.slice(0, ALERT_LIMIT_VISIBLE).map((a) => (
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

            {alertasVisiveis.length > ALERT_LIMIT_VISIBLE && (
              <button className="ini-alerta ini-alerta--more" onClick={() => setShowAllAlerts(true)}>
                <span className="ini-alerta-icon ini-alerta-icon--neutral">
                  <DotsThreeOutline size={18} weight="fill" />
                </span>
                <div className="ini-alerta-body">
                  <span className="ini-alerta-texto">
                    + {alertasVisiveis.length - ALERT_LIMIT_VISIBLE} {alertasVisiveis.length - ALERT_LIMIT_VISIBLE === 1 ? "outro alerta" : "outros alertas"} pra hoje
                  </span>
                </div>
                <span className="ini-alerta-cta">Ver todos ›</span>
              </button>
            )}
          </div>
        </section>
      )}

      {alertasVisiveis.length === 0 && !loading && !isSnoozed && (
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

      {/* Modal: todos os alertas */}
      {showAllAlerts && (
        <FinModal title="Atenção hoje" onClose={() => setShowAllAlerts(false)}>
          <div className="ini-alertas">
            {alertasVisiveis.map((a) => (
              <button
                key={a.tipo}
                className={`ini-alerta ini-alerta--${a.tipo}`}
                onClick={() => { setShowAllAlerts(false); a.onClick(); }}
              >
                <span className="ini-alerta-icon">
                  {a.tipo === "pedido"      && <ClipboardText size={18} weight="fill" />}
                  {a.tipo === "entrega"     && <CalendarDots  size={18} weight="fill" />}
                  {a.tipo === "aniversario" && <img src="/Sistema/aniversario.png" alt="" width={28} height={28} style={{ objectFit: "contain" }} />}
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
        </FinModal>
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

      {/* ── Agenda de Entregas ── */}
      <section className="ini-section ini-section--agenda">
        <div className="ini-agenda-card">
        <div className="ini-agenda-header">
          <div>
            <h2 className="ini-agenda-title"><CalendarDots size={20} weight="fill" /> Agenda</h2>
          </div>
          <button className="ini-agenda-link" onClick={() => navigate("/agenda")}>Ver agenda completa ›</button>
        </div>

        {/* Desktop: lista compacta do dia */}
        <div className="ini-agenda-today">
          <p className="ini-agenda-today-label">Hoje</p>
          <div className="ini-agenda-today-content">
            {loading ? (
              <p className="ini-agenda-today-empty">Carregando...</p>
            ) : counts.entregasHoje > 0 ? (
              <button className="ini-agenda-today-count" onClick={() => navigate("/agenda")}>
                <span className="ini-agenda-today-num">{counts.entregasHoje}</span>
                <span className="ini-agenda-today-txt">
                  {counts.entregasHoje === 1 ? "entrega agendada para hoje" : "entregas agendadas para hoje"}
                </span>
                <CaretRight size={16} weight="bold" />
              </button>
            ) : (
              <p className="ini-agenda-today-empty">Nenhuma entrega agendada para hoje</p>
            )}
          </div>
        </div>

        {/* Mobile: próximas entregas (substitui o calendário vazio) */}
        <div className="ini-agenda-full">
          {proximasEntregas.length > 0 ? (
            <div className="ini-prox-list">
              {proximasEntregas.map((e) => {
                const d = new Date(e.data + "T00:00:00");
                const diaNum = d.getDate();
                const mesAbrev = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
                return (
                  <button key={e.id} className="ini-prox-item" onClick={() => navigate("/agenda")}>
                    <div className="ini-prox-date">
                      <span className="ini-prox-day">{diaNum}</span>
                      <span className="ini-prox-mon">{mesAbrev}</span>
                    </div>
                    <div className="ini-prox-info">
                      <span className="ini-prox-cliente">{e.cliente}</span>
                      <span className="ini-prox-valor">{formatCurrency(e.valor)}</span>
                    </div>
                    <CaretRight size={16} weight="bold" className="ini-prox-arrow" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="ini-prox-empty">
              <CalendarDots size={32} weight="duotone" />
              <p>Nenhuma entrega agendada</p>
            </div>
          )}
        </div>
        </div>
      </section>

      {/* ── Faturamento 30 dias (dados REAIS) ── */}
      <section className="ini-section ini-section--chart">
        <div className="ini-chart-header">
          <h2 className="ini-section-title">Faturamento (30 dias)</h2>
        </div>
        <div className="ini-chart-card">
          <div className="ini-chart-inner" style={{ width: "100%", height: 180 }}>
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
          {checklistDone && (
            <div className="ini-aside-desktop"><DooIAPanel /></div>
          )}
        </aside>

        {/* ── Últimas atualizações (mobile, fim) — só após onboarding ── */}
        {checklistDone && (
          <div className="ini-mobile-updates"><UpdatesFeed /></div>
        )}

        {/* ── Engajamento (mobile, rodapé) — só após onboarding ── */}
        {checklistDone && (
          <section className="ini-engaja">
            <a href="https://www.google.com" target="_blank" rel="noopener noreferrer" className="ini-engaja-card ini-engaja-card--play">
              <div className="ini-engaja-icon ini-engaja-icon--play">
                {/* Google Play Store official logo */}
                <svg viewBox="0 0 512 512" width="26" height="26" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path fill="#00C1FF" d="M61.85 32.05c-9.27 5.42-14.85 15.42-14.85 28.06v391.78c0 12.64 5.58 22.64 14.85 28.06l225.9-223.95L61.85 32.05z"/>
                  <path fill="#FFD400" d="M361.92 331.48l-74.17-73.48 74.17-73.48 89.66 51.16c25.6 14.6 25.6 47.04 0 61.64l-89.66 34.16z"/>
                  <path fill="#FF3A44" d="M361.92 331.48L287.75 258 61.85 479.95c8.62 5.05 19.92 4.7 32.4-2.43l267.67-146.04z"/>
                  <path fill="#00E36A" d="M361.92 184.52L94.25 38.48c-12.48-7.13-23.78-7.48-32.4-2.43L287.75 258l74.17-73.48z"/>
                </svg>
              </div>
              <div className="ini-engaja-text">
                <span className="ini-engaja-title">Avalie na Play Store</span>
                <span className="ini-engaja-sub">Sua nota ajuda muito!</span>
              </div>
              <CaretRight size={16} weight="bold" className="ini-engaja-arrow" />
            </a>
            <a href="https://www.google.com" target="_blank" rel="noopener noreferrer" className="ini-engaja-card ini-engaja-card--insta">
              <div className="ini-engaja-icon ini-engaja-icon--insta">
                <InstagramLogo size={26} weight="fill" />
              </div>
              <div className="ini-engaja-text">
                <span className="ini-engaja-title">Siga no Instagram</span>
                <span className="ini-engaja-sub">Dicas e novidades</span>
              </div>
              <CaretRight size={16} weight="bold" className="ini-engaja-arrow" />
            </a>
          </section>
        )}
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
          margin-top: 2.5rem; /* 40px fixo — respiro após o hero (mobile) */
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
        .ini-aside-desktop { display: none; }
        .ini-aside-mobile { display: block; }

        /* ── Hero wine com foto da confeiteira, sparkles e coroinha ── */
        .ini-hero {
          background: linear-gradient(135deg, #2a1019, #3d1a24 35%, #4d1f2c 60%, #3d1a24 85%, #2a1019);
          background-size: 300% 300%;
          animation: heroGradientMove 14s ease infinite;
          border-radius: 0 0 28px 28px;
          padding: 2rem 1.25rem 2rem;
          /* Full-bleed: estende até a borda da viewport ignorando padding dos pais */
          width: 100vw;
          margin-left: calc(50% - 50vw);
          margin-right: calc(50% - 50vw);
          margin-top: calc(-1 * (var(--pad-page-top) + env(safe-area-inset-top, 0px)));
          padding-top: calc(1.5rem + env(safe-area-inset-top, 0px));
          display: flex;
          align-items: center;
          gap: 0.85rem;
          position: relative;
          z-index: 10;
          /* overflow: visible — o dropdown de perfil precisa vazar pra baixo do hero.
             Os sparkles decorativos ficam contidos via .ini-hero-sparkles. */
        }
        @keyframes heroGradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        /* Sparkles dourados estáticos */
        .ini-hero-sparkles {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }

        /* Texto da saudação */
        .ini-hero-greeting {
          flex: 1;
          min-width: 0;
          position: relative;
          z-index: 2;
        }
        .ini-hero-greeting h1 {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 1.5rem; font-weight: var(--fw-black);
          color: #fff;
          margin: 0; line-height: 1.2;
          letter-spacing: -0.02em;
        }
        .ini-hero-greeting h1 span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .ini-hero-crown {
          color: #F4D03F;
          flex-shrink: 0;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
        }
        .ini-hero-greeting p {
          font-size: var(--font-helper);
          color: rgba(255,255,255,0.78);
          margin: 4px 0 0;
          line-height: 1.35;
        }

        /* ── Foto de perfil grande à esquerda + dropdown ── */
        .ini-profile-wrapper { position: relative; flex-shrink: 0; z-index: 2; }
        .ini-profile-btn {
          width: 64px; height: 64px; border-radius: var(--radius-full);
          border: 3px solid #c8891f;
          background: #faf5e8;
          cursor: pointer; padding: 0; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          transition: border-color var(--dur-fast), transform var(--dur-fast), box-shadow var(--dur-fast);
          box-shadow: 0 6px 20px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.15);
        }
        .ini-profile-btn:hover { transform: scale(1.04); box-shadow: 0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.2); }
        .ini-profile-img { width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-full); }
        .ini-profile-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }

        /* Badge de câmera — atalho pra trocar/adicionar foto */
        .ini-profile-cam {
          position: absolute;
          bottom: -2px; right: -2px;
          width: 24px; height: 24px;
          border-radius: var(--radius-full);
          background: #c8891f;
          border: 2px solid #faf5e8;
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          padding: 0;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          transition: transform var(--dur-fast), background var(--dur-fast);
          z-index: 2;
        }
        .ini-profile-cam:hover:not(:disabled) { transform: scale(1.12); background: #b47a1c; }
        .ini-profile-cam:disabled { cursor: default; opacity: 0.7; }
        .ini-profile-cam-spinner {
          width: 12px; height: 12px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: iniSpin 0.7s linear infinite;
        }
        @keyframes iniSpin { to { transform: rotate(360deg); } }

        .ini-profile-menu {
          position: absolute; top: calc(100% + 10px); left: 0;
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

        /* Toggle "Ativar notificações" — barra estilo iOS */
        .ini-pm-item--toggle {
          display: flex; align-items: center; justify-content: space-between;
          gap: var(--space-3);
          user-select: none;
        }
        .ini-pm-item-label {
          display: flex; align-items: center; gap: var(--space-3);
          flex: 1; min-width: 0;
        }
        .ini-pm-toggle {
          width: 38px; height: 22px;
          border-radius: 999px;
          background: var(--border);
          position: relative;
          flex-shrink: 0;
          transition: background 0.22s ease;
        }
        .ini-pm-toggle-thumb {
          position: absolute; top: 2px; left: 2px;
          width: 18px; height: 18px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          transition: transform 0.22s ease;
        }
        .ini-pm-toggle--on { background: #F4D03F; }
        .ini-pm-toggle--on .ini-pm-toggle-thumb { transform: translateX(16px); }

        /* ── Sections ── */
        .ini-section {
          margin-top: var(--gap-section);
          display: flex; flex-direction: column; gap: var(--gap-stack);
        }

        /* ── Greeting (desktop only) ── */
        .ini-section--greeting { display: none; }
        .ini-greeting-title {
          margin: 0;
          font-size: var(--text-xl);
          font-weight: var(--fw-bold);
          color: var(--text-title);
        }
        .ini-greeting-stats {
          display: flex;
          gap: var(--space-5);
          margin-top: var(--space-3);
        }
        .ini-greeting-stat {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--font-button);
          color: var(--text-secondary);
        }
        .ini-greeting-stat strong {
          color: var(--text-title);
          font-weight: var(--fw-bold);
        }

        /* ── Agenda today (desktop) / full (mobile) ── */
        .ini-agenda-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--pad-card);
          display: flex; flex-direction: column; gap: var(--gap-stack);
        }
        .ini-agenda-today { display: none; }
        .ini-agenda-full { display: flex; flex-direction: column; gap: var(--gap-stack); }

        /* ── Próximas entregas (mobile) ── */
        .ini-prox-list { display: flex; flex-direction: column; gap: var(--space-2); }
        .ini-prox-item {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3);
          background: var(--bg-subtle);
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          width: 100%;
          transition: background var(--dur-fast) var(--ease-out);
        }
        .ini-prox-item:active { background: var(--primary-light); }
        .ini-prox-date {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center;
          width: 44px; height: 44px;
          background: var(--bg-card);
          border-radius: 8px;
          flex-shrink: 0;
        }
        .ini-prox-day { font-size: var(--font-body); font-weight: var(--fw-black); color: var(--primary-dark); line-height: 1; }
        .ini-prox-mon { font-size: 0.65rem; font-weight: var(--fw-semibold); color: var(--text-muted); text-transform: uppercase; }
        .ini-prox-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .ini-prox-cliente { font-size: var(--font-button); font-weight: var(--fw-semibold); color: var(--text-title); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ini-prox-valor { font-size: var(--font-caption); font-weight: var(--fw-bold); color: var(--primary); }
        .ini-prox-arrow { color: var(--text-muted); flex-shrink: 0; }
        .ini-prox-empty {
          display: flex; flex-direction: column; align-items: center; gap: var(--space-2);
          padding: var(--space-6) var(--space-4);
          color: var(--text-muted);
          text-align: center;
        }
        .ini-prox-empty p { margin: 0; font-size: var(--font-button); }
        .ini-prox-empty-btn {
          margin-top: var(--space-2);
          padding: var(--space-2) var(--space-5);
          background: var(--primary-dark);
          color: #FFFFFF;
          border: none;
          border-radius: var(--radius-full);
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: var(--fw-bold);
          cursor: pointer;
        }

        /* ── Engajamento (mobile, rodapé) ── */
        .ini-engaja {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .ini-engaja-card {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-4);
          border-radius: 14px;
          text-decoration: none;
          transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
        }
        .ini-engaja-card:active { transform: scale(0.98); }
        .ini-engaja-card--play {
          background: var(--bg-card);
          border: 1px solid var(--border);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .ini-engaja-card--play:hover {
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        .ini-engaja-card--insta {
          background: linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%);
          box-shadow: 0 4px 14px rgba(221, 42, 123, 0.25), 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        .ini-engaja-card--insta:hover {
          box-shadow: 0 6px 22px rgba(221, 42, 123, 0.35), 0 2px 4px rgba(0, 0, 0, 0.06);
        }
        .ini-engaja-icon {
          width: 44px; height: 44px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ini-engaja-icon--play {
          background: #FFFFFF;
          border: 1px solid var(--border);
        }
        .ini-engaja-icon--insta {
          background: rgba(255,255,255,0.22);
          color: #FFFFFF;
          backdrop-filter: blur(4px);
        }
        .ini-engaja-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
        .ini-engaja-title { font-size: var(--font-button); font-weight: var(--fw-bold); line-height: 1.25; }
        .ini-engaja-sub { font-size: var(--font-caption); line-height: 1.3; }
        .ini-engaja-card--play .ini-engaja-title { color: var(--text-title); }
        .ini-engaja-card--play .ini-engaja-sub { color: var(--text-muted); }
        .ini-engaja-card--insta .ini-engaja-title,
        .ini-engaja-card--insta .ini-engaja-sub { color: #FFFFFF; }
        .ini-engaja-card--insta .ini-engaja-sub { opacity: 0.9; }
        .ini-engaja-arrow { flex-shrink: 0; }
        .ini-engaja-card--play .ini-engaja-arrow { color: var(--text-muted); }
        .ini-engaja-card--insta .ini-engaja-arrow { color: rgba(255,255,255,0.85); }

        .ini-agenda-today-label {
          font-size: var(--font-caption);
          font-weight: var(--fw-bold);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          margin: 0;
          padding-bottom: var(--space-2);
          border-bottom: 1px solid var(--border);
        }
        .ini-agenda-today-content {
          padding: var(--space-3) 0;
        }
        .ini-agenda-today-empty {
          margin: 0;
          font-size: var(--font-body);
          color: var(--text-disabled);
          font-style: italic;
        }
        .ini-agenda-today-count {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          width: 100%;
          padding: var(--space-3);
          background: var(--bg-subtle);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          color: var(--primary-dark);
          transition: border-color var(--dur-fast) var(--ease-out);
        }
        .ini-agenda-today-count:hover { border-color: var(--primary); }
        .ini-agenda-today-num {
          font-size: var(--text-2xl);
          font-weight: var(--fw-black);
          color: var(--text-title);
          line-height: 1;
        }
        .ini-agenda-today-txt {
          flex: 1;
          font-size: var(--font-button);
          font-weight: var(--fw-medium);
          color: var(--text-secondary);
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
          background: var(--bg-subtle);
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          transition: background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
        }
        .ini-nav-card:active { background: var(--primary-light); transform: scale(0.99); }
        .ini-nav-icon {
          width: 38px; height: 38px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          background: var(--bg-card) !important;
          color: var(--primary-dark) !important;
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
        .ini-nav-arrow { color: var(--text-muted); flex-shrink: 0; }
        /* "Novo pedido" destacado vinho no mobile também */
        .ini-nav-card[data-nav="novo"] { background: var(--primary-dark); }
        .ini-nav-card[data-nav="novo"]:active { background: var(--text-title); }
        .ini-nav-card[data-nav="novo"] .ini-nav-icon { background: rgba(255,255,255,0.16) !important; color: #FFFFFF !important; }
        .ini-nav-card[data-nav="novo"] .ini-nav-label { color: #FFFFFF; }
        .ini-nav-card[data-nav="novo"] .ini-nav-sub { color: rgba(255,255,255,0.7); }
        .ini-nav-card[data-nav="novo"] .ini-nav-arrow { color: rgba(255,255,255,0.7); }

        /* ── Agenda de Entregas ── */
        .ini-agenda-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .ini-agenda-title {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--font-card-title);
          font-weight: var(--fw-bold);
          color: var(--primary-dark);
          margin: 0;
        }
        .ini-agenda-link {
          background: none; border: none; cursor: pointer;
          font-family: inherit; font-size: var(--font-caption);
          font-weight: var(--fw-semibold); color: var(--primary);
          padding: 0;
        }
        .ini-agenda-link:hover { text-decoration: underline; }
        .ini-agenda-stats {
          display: flex; gap: var(--space-3);
        }
        .ini-agenda-stat {
          display: flex;
          align-items: baseline;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          background: var(--bg-subtle);
          border-radius: var(--radius-md);
          flex: 1;
        }
        .ini-agenda-stat-val {
          font-size: var(--text-lg);
          font-weight: var(--fw-bold);
          color: var(--primary-dark);
        }
        .ini-agenda-stat-label {
          font-size: var(--font-caption);
          color: var(--text-muted);
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

        /* ── Métricas (desktop only) ── */
        .ini-metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: var(--gap-stack);
        }
        .ini-metric-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--pad-card);
        }
        .ini-metric-top {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-3);
        }
        .ini-metric-icon {
          width: 32px; height: 32px;
          border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ini-metric-label {
          font-size: var(--font-caption);
          color: var(--text-secondary);
        }
        .ini-metric-val {
          font-size: var(--text-2xl);
          font-weight: var(--fw-bold);
          color: var(--text-title);
          margin: 0;
          line-height: var(--lh-tight);
        }
        .ini-metric-sub {
          font-size: var(--font-caption);
          color: var(--text-muted);
          margin: var(--space-1) 0 0;
        }
        .ini-metric-hint {
          font-size: var(--font-caption);
          color: var(--text-disabled);
          font-style: italic;
          margin: var(--space-2) 0 0;
          line-height: var(--lh-relaxed);
        }

        /* ── Métricas: trend, skeleton, hero (desktop) ── */
        .ini-metric-trend {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: var(--font-caption);
          font-weight: var(--fw-semibold);
          margin: var(--space-2) 0 0;
        }
        .ini-metric-trend.up      { color: var(--success); }
        .ini-metric-trend.down    { color: var(--error); }
        .ini-metric-trend.neutral { color: var(--text-muted); font-weight: var(--fw-medium); }

        .ini-skeleton {
          display: inline-block;
          background: linear-gradient(90deg, var(--bg-subtle) 25%, rgba(var(--primary-rgb), 0.08) 50%, var(--bg-subtle) 75%);
          background-size: 200% 100%;
          border-radius: var(--radius-sm);
          animation: iniShimmer 1.4s ease-in-out infinite;
        }
        .ini-skeleton--val { width: 80px; height: 26px; vertical-align: middle; }
        @keyframes iniShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ── Alertas ── */
        .ini-alertas {
          display: flex; flex-direction: column; gap: var(--gap-tight);
        }
        .ini-alertas-head {
          display: flex; align-items: center; justify-content: space-between;
          gap: var(--space-2);
          margin-bottom: var(--space-2);
        }
        .ini-alertas-head .ini-section-title { margin: 0; }
        .ini-alertas-snooze {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 10px;
          background: var(--bg-subtle);
          border: 1px solid var(--border);
          border-radius: var(--radius-full);
          font-family: inherit;
          font-size: var(--font-caption);
          font-weight: var(--fw-semibold);
          color: var(--text-secondary);
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
        }
        .ini-alertas-snooze:hover {
          background: var(--border);
          color: var(--text-title);
        }
        .ini-alertas-snooze:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
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
        .ini-alerta--more        { border-left-color: var(--text-muted); }
        .ini-alerta-icon--neutral {
          background: var(--bg-subtle);
          color: var(--text-secondary);
        }

        .ini-alerta-icon {
          width: 32px; height: 32px; border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ini-alerta--pedido      .ini-alerta-icon { background: #FEE2E2; color: var(--error); }
        .ini-alerta--entrega     .ini-alerta-icon { background: #DBEAFE; color: var(--info); }
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
        /* Nível 1: filhos diretos de .ini-content */
        .ini-aside          { order: 1; }
        .ini-main           { order: 2; display: flex; flex-direction: column; }
        .ini-mobile-updates { order: 3; }
        .ini-engaja         { order: 4; }
        /* Nível 2: seções dentro de .ini-main */
        .ini-section--alertas { order: 1; }
        .ini-section--nav     { order: 2; }
        .ini-section--resumo  { display: none; }
        .ini-section--agenda  { display: none; }
        .ini-section--metrics { display: none; }
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
          .ini-hero-sparkles { display: none; }
          .ini-actions { grid-template-columns: 1fr 1fr; max-width: 720px; margin-left: auto; margin-right: auto; }
          .ini-resumo { grid-template-columns: 1fr 1fr; max-width: 720px; margin-left: auto; margin-right: auto; }
          .ini-alertas, .ini-tudo-ok, .ini-chart-card { max-width: 720px; margin-left: auto; margin-right: auto; }
          .ini-section { width: 100%; }
          .ini-profile-btn { width: 48px; height: 48px; }
        }

        /* ── 2 colunas: checklist + dashboard ── */
        @media (min-width: 1100px) {
          .ini-root { max-width: none; padding-right: var(--space-7); }

          /* Hero escondido no desktop — saudação fica na sidebar */
          .ini-hero { display: none; }

          /* ── Grid principal: dashboard + aside ── */
          .ini-content {
            display: grid;
            grid-template-columns: 360px 1fr;
            grid-template-areas: "aside main";
            gap: var(--space-6);
            align-items: start;
            margin-top: 0; /* hero oculto no desktop, sem margem extra */
          }
          .ini-main  { grid-area: main; }
          .ini-aside { grid-area: aside; position: sticky; top: var(--space-6); }
          .ini-aside-desktop { display: block; }
          .ini-aside-mobile { display: none; }
          /* Updates e engajamento são exclusivos do mobile */
          .ini-mobile-updates { display: none; }
          .ini-engaja { display: none; }

          /* Seções: o que mostra/esconde no desktop */
          .ini-main .ini-section--chart    { display: block; }
          .ini-main .ini-section--alertas  { display: none; }
          .ini-main .ini-section--resumo   { display: none; }
          .ini-main .ini-section--metrics  { display: block; }
          .ini-main .ini-section--greeting { display: none; }
          .ini-main .ini-section--agenda   { display: none; }

          /* Respiro vertical entre seções */
          .ini-main .ini-section { margin-top: var(--space-6); order: 0; }
          .ini-main .ini-section:first-child { margin-top: 0; }

          /* ────────────────────────────────────────────
             MÉTRICAS — grid 4 colunas, card hero destacado
             ──────────────────────────────────────────── */
          .ini-main .ini-section--metrics {
            background: none; border: none; padding: 0;
          }
          .ini-main .ini-metrics-grid {
            display: grid;
            grid-template-columns: 1.4fr 1fr 1fr 1fr;
            gap: var(--space-4);
          }
          .ini-main .ini-metric-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: var(--space-5);
            box-shadow: var(--shadow-sm);
            transition: box-shadow var(--dur-fast) var(--ease-out);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 130px;
          }
          .ini-main .ini-metric-card:hover { box-shadow: var(--shadow-md); }

          /* Card hero — faturamento em destaque, fundo vinho */
          .ini-main .ini-metric-card--hero {
            background: linear-gradient(150deg, var(--primary) 0%, var(--primary-dark) 55%, var(--text-title) 130%);
            border: none;
            box-shadow: var(--shadow-md);
          }
          .ini-main .ini-metric-card--hero .ini-metric-label,
          .ini-main .ini-metric-card--hero .ini-metric-val { color: #FFFFFF; }
          .ini-main .ini-metric-card--hero .ini-metric-icon {
            background: rgba(255,255,255,0.16);
            color: #FFFFFF;
          }
          .ini-main .ini-metric-card--hero .ini-metric-val { font-size: var(--text-3xl, 2rem); }
          .ini-main .ini-metric-card--hero .ini-metric-trend.up   { color: #A7F3C4; }
          .ini-main .ini-metric-card--hero .ini-metric-trend.down { color: #FCA5A5; }
          .ini-main .ini-metric-card--hero .ini-metric-trend.neutral { color: rgba(255,255,255,0.7); }
          .ini-main .ini-metric-card--hero .ini-skeleton {
            background: linear-gradient(90deg, rgba(255,255,255,0.15) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.15) 75%);
            background-size: 200% 100%;
          }

          /* Cards secundários — ícone sóbrio rosa-claro */
          .ini-main .ini-metric-card:not(.ini-metric-card--hero) .ini-metric-icon {
            background: var(--bg-subtle);
            color: var(--primary-dark);
          }
          .ini-main .ini-metric-val { font-size: var(--text-2xl); }

          /* ────────────────────────────────────────────
             ACESSO RÁPIDO — cards sem borda, fundo sutil (abordagem A)
             ──────────────────────────────────────────── */
          .ini-main .ini-section--nav {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: var(--space-5);
          }
          .ini-main .ini-section--nav .ini-nav-grid {
            grid-template-columns: 1fr 1fr 1fr;
            gap: var(--space-3);
          }
          .ini-main .ini-section--nav .ini-nav-card {
            display: flex;
            align-items: center;
            gap: var(--space-3);
            padding: var(--space-3) var(--space-4);
            background: var(--bg-subtle);
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-family: inherit;
            text-align: left;
            transition: background var(--dur-fast) var(--ease-out),
                        transform var(--dur-fast) var(--ease-out);
          }
          .ini-main .ini-section--nav .ini-nav-card:hover {
            background: var(--primary-light);
            transform: translateY(-1px);
          }
          .ini-main .ini-section--nav .ini-nav-icon {
            width: 40px; height: 40px;
            border-radius: 8px;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
            background: var(--bg-card) !important;
            color: var(--primary-dark) !important;
          }
          .ini-main .ini-section--nav .ini-nav-arrow {
            color: var(--text-muted);
            flex-shrink: 0;
            transition: transform var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
          }
          .ini-main .ini-section--nav .ini-nav-card:hover .ini-nav-arrow {
            color: var(--primary);
            transform: translateX(2px);
          }
          /* "Novo pedido" vira card de destaque vinho no desktop */
          .ini-main .ini-section--nav .ini-nav-card[data-nav="novo"] {
            background: var(--primary-dark);
          }
          .ini-main .ini-section--nav .ini-nav-card[data-nav="novo"]:hover {
            background: var(--text-title);
          }
          .ini-main .ini-section--nav .ini-nav-card[data-nav="novo"] .ini-nav-icon {
            background: rgba(255,255,255,0.16) !important;
            color: #FFFFFF !important;
          }
          .ini-main .ini-section--nav .ini-nav-card[data-nav="novo"] .ini-nav-label { color: #FFFFFF; }
          .ini-main .ini-section--nav .ini-nav-card[data-nav="novo"] .ini-nav-sub { color: rgba(255,255,255,0.7); }
          .ini-main .ini-section--nav .ini-nav-card[data-nav="novo"] .ini-nav-arrow { color: rgba(255,255,255,0.7); }
          .ini-main .ini-section--nav .ini-nav-card[data-nav="novo"]:hover .ini-nav-arrow { color: #FFFFFF; }

          /* ────────────────────────────────────────────
             GRÁFICO — faturamento 30 dias, largura total
             ──────────────────────────────────────────── */
          .ini-main .ini-section--chart {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: var(--space-5);
            box-sizing: border-box;
          }
          .ini-main .ini-chart-card { max-width: none; margin: 0; border: none; padding: 0; }
          .ini-main .ini-chart-card > div { width: 100% !important; min-width: 0; }
          .ini-main .ini-chart-inner { height: 240px !important; }

          /* ────────────────────────────────────────────
             ESTADO "CHECKLIST COMPLETO"
             ──────────────────────────────────────────── */
          .ini-content--done {
            grid-template-columns: 1fr 420px;
            grid-template-areas: "main aside";
          }
        }

        /* Telas largas: aside um pouco maior, métricas respiram */
        @media (min-width: 1500px) {
          .ini-content { grid-template-columns: 400px 1fr; }
          .ini-content--done { grid-template-columns: 1fr 460px; }
        }
      `}</style>
    </div>
  );
}

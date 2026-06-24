import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Share, Plus, ClipboardText, CalendarDots,
  Cake, TrendUp, TrendDown, CurrencyDollar, ShoppingBag,
} from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";

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
  const [copiado, setCopiado] = useState(false);

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

  const variacao = (atual: number, ant: number): { pct: number; tipo: "up" | "down" | "flat" } => {
    if (ant === 0 && atual === 0) return { pct: 0, tipo: "flat" };
    if (ant === 0) return { pct: 100, tipo: "up" };
    const pct = ((atual - ant) / ant) * 100;
    return { pct: Math.abs(pct), tipo: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
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
      texto: aniversariantesDetalhe
        ? `${aniversariantesDetalhe.nome} faz aniversário ${aniversariantesDetalhe.dias === 0 ? "hoje" : aniversariantesDetalhe.dias === 1 ? "amanhã" : `em ${aniversariantesDetalhe.dias} dias`}`
        : counts.aniversariantes === 1 ? "aniversariante na próxima semana" : "aniversariantes na próxima semana",
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
          <h1>{getGreeting()}, {nome || "bem-vinda"}</h1>
          <p>{hojeFormatado()}</p>
        </div>
      </div>

      {/* ── 3 indicadores flutuando sobre o hero ── */}
      <div className="ini-indicadores">
        <button
          className="ini-ind-card ini-ind-card--pedidos"
          onClick={() => navigate("/agenda")}
        >
          <div className="ini-ind-bg" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=400&q=80')` }} />
          <div className="ini-ind-content">
            <span className="ini-ind-label">{counts.entregasHoje === 1 ? "Pedido hoje" : "Pedidos hoje"}</span>
            <span className="ini-ind-val">{counts.entregasHoje}</span>
          </div>
        </button>

        <button
          className="ini-ind-card ini-ind-card--faturamento"
          onClick={() => navigate("/financeiro")}
        >
          <div className="ini-ind-bg" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&q=80')` }} />
          <div className="ini-ind-content">
            <span className="ini-ind-label">Faturamento</span>
            <span className="ini-ind-val ini-ind-val--currency">{formatCurrencyCompact(counts.faturamentoMes)}</span>
          </div>
        </button>

        <button
          className="ini-ind-card ini-ind-card--aniversarios"
          onClick={() => navigate("/clientes")}
        >
          <div className="ini-ind-bg" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1558636508-e0db3814bd1d?w=400&q=80')` }} />
          <div className="ini-ind-content">
            <span className="ini-ind-label">{counts.aniversariantes === 1 ? "Aniversário" : "Aniversários"}</span>
            <span className="ini-ind-val">{counts.aniversariantes}</span>
          </div>
        </button>
      </div>

      {/* ── Ações rápidas ── */}
      <section className="ini-section">
        <h2 className="ini-section-title">Ações rápidas</h2>
        <div className="ini-actions">
          <button className="ini-action ini-action--primary" onClick={handleCompartilhar}>
            <Share size={18} weight="bold" />
            <span>{copiado ? "Link copiado!" : "Compartilhar cardápio"}</span>
          </button>
          <button className="ini-action" onClick={() => navigate("/pedidos/novo")}>
            <Plus size={18} weight="bold" />
            <span>Novo pedido</span>
          </button>
        </div>
      </section>

      {/* ── Atenção hoje ── */}
      {alertasVisiveis.length > 0 && (
        <section className="ini-section">
          <h2 className="ini-section-title">Atenção hoje</h2>
          <div className="ini-alertas">
            {alertasVisiveis.map((a) => (
              <button key={a.tipo} className={`ini-alerta ini-alerta--${a.tipo}`} onClick={a.onClick}>
                <span className="ini-alerta-icon">
                  {a.tipo === "pedido"     && <ClipboardText size={18} weight="fill" />}
                  {a.tipo === "entrega"    && <CalendarDots  size={18} weight="fill" />}
                  {a.tipo === "aniversario"&& <Cake          size={18} weight="fill" />}
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
        <section className="ini-section">
          <div className="ini-tudo-ok">
            <span style={{ fontSize: "1.5rem" }}>✨</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: "var(--text-title, #431524)" }}>Tudo em ordem!</p>
              <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--text-muted, #C39EAA)" }}>Sem alertas hoje. Bom trabalho!</p>
            </div>
          </div>
        </section>
      )}

      {/* ── Resumo da semana ── */}
      <section className="ini-section">
        <h2 className="ini-section-title">Resumo da semana</h2>
        <div className="ini-resumo">
          <div className="ini-resumo-card">
            <div className="ini-resumo-icon" style={{ background: "#DCFCE7", color: "#15803D" }}>
              <CurrencyDollar size={20} weight="duotone" />
            </div>
            <div>
              <p className="ini-resumo-val">{formatCurrency(resumoSemana.vendas)}</p>
              <p className="ini-resumo-label">em vendas</p>
              {varVendas.tipo !== "flat" && (
                <p className={`ini-resumo-var ${varVendas.tipo}`}>
                  {varVendas.tipo === "up" ? <TrendUp size={11} weight="bold" /> : <TrendDown size={11} weight="bold" />}
                  {varVendas.pct.toFixed(0)}% vs anterior
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
              {varPedidos.tipo !== "flat" && (
                <p className={`ini-resumo-var ${varPedidos.tipo}`}>
                  {varPedidos.tipo === "up" ? <TrendUp size={11} weight="bold" /> : <TrendDown size={11} weight="bold" />}
                  {varPedidos.pct.toFixed(0)}% vs anterior
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Faturamento 30 dias (dados REAIS) ── */}
      <section className="ini-section">
        <div className="ini-chart-header">
          <h2 className="ini-section-title">Faturamento (30 dias)</h2>
        </div>
        <div className="ini-chart-card">
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#ECC2D0)" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "var(--text-muted,#C39EAA)" }} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted,#C39EAA)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `R$${v}`} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-card,#fff)", border: "1px solid var(--border,#ECC2D0)", borderRadius: 10, fontSize: 12, fontFamily: "Geist,sans-serif" }}
                  formatter={(v: any) => [formatCurrency(Number(v)), "Faturamento"]}
                />
                <Line type="monotone" dataKey="valor" stroke="#3d1a24" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#3d1a24" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <style>{`
        .ini-root {
          font-family: 'Geist', sans-serif;
          padding: 0 0.75rem 6rem;
          display: flex; flex-direction: column;
          max-width: 980px; margin: 0 auto;
        }

        /* ── Hero degradê animado (preservado) ── */
        .ini-hero {
          background: linear-gradient(135deg, #986274, #6E3548, #431524, #6E3548, #986274);
          background-size: 300% 300%;
          animation: heroGradientMove 10s ease infinite;
          border-radius: 0 0 28px 28px;
          padding: 2rem 1.25rem 6.5rem;
          /* Full-bleed: estende até a borda da viewport ignorando padding dos pais */
          width: 100vw;
          margin-left: calc(50% - 50vw);
          margin-right: calc(50% - 50vw);
          margin-top: -0.75rem;
          display: flex; flex-direction: column;
          position: relative;
          z-index: 0;
        }
        @keyframes heroGradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .ini-hero-greeting h1 {
          font-size: 1rem; font-weight: 600; color: rgba(255,255,255,0.95);
          margin: 0; line-height: 1.3;
          letter-spacing: 0;
        }
        .ini-hero-greeting p {
          font-size: 0.78rem; color: rgba(255,255,255,0.7);
          margin: 2px 0 0;
        }

        /* ── 3 indicadores estilo "sticker card" ── */
        .ini-indicadores {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.55rem;
          margin-top: -80px;
          padding: 0 0.25rem;
          position: relative;
          z-index: 2;
        }
        .ini-ind-card {
          position: relative;
          background: var(--bg-card, #fff);
          border: none;
          border-radius: 20px;
          padding: 0.6rem 0.9rem 0.9rem 0.9rem;
          min-height: 125px;
          display: flex; flex-direction: column;
          justify-content: flex-end;
          align-items: flex-start;
          box-shadow: 0 8px 22px rgba(0,0,0,0.10);
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          overflow: hidden;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }

        /* Camada de imagem de fundo (wallpaper) */
        .ini-ind-bg {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          opacity: 0.55;
          z-index: 0;
          pointer-events: none;
        }
        /* Overlay escurecido pra garantir legibilidade do texto branco */
        .ini-ind-card::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%);
          z-index: 1;
          pointer-events: none;
        }
        .ini-ind-content { position: relative; z-index: 2; }
        .ini-ind-card:active { transform: scale(0.97); }
        .ini-ind-card:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(0,0,0,0.14); }

        /* Variantes coloridas (cor base — imagem aparece por cima) */
        .ini-ind-card--pedidos {
          background: linear-gradient(135deg, #60A5FA 0%, #2563EB 100%);
        }
        .ini-ind-card--faturamento {
          background: linear-gradient(135deg, #4ADE80 0%, #16A34A 100%);
        }
        .ini-ind-card--aniversarios {
          background: linear-gradient(135deg, #F472B6 0%, #BE185D 100%);
        }

        .ini-ind-content {
          display: flex; flex-direction: column;
          gap: 3px;
          width: 100%;
        }
        .ini-ind-label {
          font-size: 0.7rem; font-weight: 600;
          color: rgba(255,255,255,0.92);
          line-height: 1.15;
          letter-spacing: 0.01em;
        }
        .ini-ind-val {
          font-size: 1.5rem; font-weight: 800;
          color: #fff; line-height: 1;
          letter-spacing: -0.02em;
        }
        .ini-ind-val--currency {
          font-size: 1.1rem;
        }

        /* ── Sections ── */
        .ini-section {
          margin-top: 1.5rem;
          display: flex; flex-direction: column; gap: 0.65rem;
        }
        .ini-section-title {
          font-size: 0.88rem; font-weight: 700;
          color: var(--text-title, #431524);
          margin: 0;
        }

        /* ── Ações rápidas ── */
        .ini-actions {
          display: grid; grid-template-columns: 1fr 1fr; gap: 0.55rem;
        }
        .ini-action {
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          padding: 0.85rem 0.9rem;
          background: var(--bg-card, #fff);
          border: 1.5px solid var(--border, #E9E9EE);
          border-radius: 13px;
          font-family: inherit;
          font-size: 0.86rem; font-weight: 700;
          color: var(--text-title, #1F2937);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .ini-action:hover { border-color: #3d1a24; transform: translateY(-1px); }
        .ini-action--primary {
          background: #3d1a24; color: #fff;
          border-color: #3d1a24;
          box-shadow: 0 4px 12px rgba(61,26,36,0.2);
        }
        .ini-action--primary:hover { background: #6E3548; }

        /* ── Alertas ── */
        .ini-alertas {
          display: flex; flex-direction: column; gap: 0.45rem;
        }
        .ini-alerta {
          display: flex; align-items: center; gap: 0.7rem;
          padding: 0.8rem 0.95rem;
          background: var(--bg-card, #fff);
          border: 1px solid var(--border, #E9E9EE);
          border-left-width: 4px;
          border-radius: 12px;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          transition: transform 0.12s ease;
        }
        .ini-alerta:hover { transform: translateX(2px); }
        .ini-alerta--pedido      { border-left-color: #B91C1C; }
        .ini-alerta--entrega     { border-left-color: #1D4ED8; }
        .ini-alerta--aniversario { border-left-color: #EC4899; }

        .ini-alerta-icon {
          width: 32px; height: 32px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ini-alerta--pedido      .ini-alerta-icon { background: #FEE2E2; color: #B91C1C; }
        .ini-alerta--entrega     .ini-alerta-icon { background: #DBEAFE; color: #1D4ED8; }
        .ini-alerta--aniversario .ini-alerta-icon { background: #FCE7F3; color: #EC4899; }

        .ini-alerta-body { flex: 1; min-width: 0; }
        .ini-alerta-texto {
          font-size: 0.85rem; font-weight: 500;
          color: var(--text-primary, #374151);
          line-height: 1.3;
        }
        .ini-alerta-texto strong { color: var(--text-title, #1F2937); font-weight: 800; }
        .ini-alerta-cta {
          font-size: 0.74rem; font-weight: 700;
          color: var(--text-muted, #9CA3AF);
          flex-shrink: 0;
        }

        .ini-tudo-ok {
          display: flex; align-items: center; gap: 0.8rem;
          padding: 1rem 1.1rem;
          background: linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%);
          border-radius: 13px;
        }

        /* ── Resumo da semana ── */
        .ini-resumo {
          display: grid; grid-template-columns: 1fr 1fr; gap: 0.55rem;
        }
        .ini-resumo-card {
          display: flex; align-items: flex-start; gap: 0.7rem;
          padding: 0.95rem;
          background: var(--bg-card, #fff);
          border: 1px solid var(--border, #E9E9EE);
          border-radius: 13px;
        }
        .ini-resumo-icon {
          width: 38px; height: 38px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ini-resumo-val {
          font-size: 1.2rem; font-weight: 800;
          color: var(--text-title, #1F2937);
          margin: 0; line-height: 1;
          word-break: break-word;
        }
        .ini-resumo-label {
          font-size: 0.74rem; font-weight: 600;
          color: var(--text-muted, #9CA3AF);
          margin: 4px 0 0;
        }
        .ini-resumo-var {
          display: inline-flex; align-items: center; gap: 3px;
          margin: 6px 0 0;
          font-size: 0.7rem; font-weight: 700;
        }
        .ini-resumo-var.up   { color: #15803D; }
        .ini-resumo-var.down { color: #B91C1C; }

        /* ── Gráfico ── */
        .ini-chart-header { display: flex; justify-content: space-between; align-items: center; }
        .ini-chart-card {
          background: var(--bg-card, #fff);
          border: 1px solid var(--border, #E9E9EE);
          border-radius: 13px;
          padding: 0.8rem 0.5rem 0.5rem;
        }

        /* ── Desktop ajustes ── */
        @media (min-width: 768px) {
          .ini-root { padding: 0 1.5rem 2rem; }
          .ini-hero {
            /* Desktop: respeita o layout (não usa full-bleed que iria sob a sidebar) */
            width: auto;
            margin-left: -1.5rem;
            margin-right: -1.5rem;
            margin-top: -0.75rem;
            padding: 3rem 2rem 5rem;
            border-radius: 0 0 32px 32px;
          }
          .ini-hero-greeting h1 { font-size: 1.6rem; }
          .ini-hero-greeting p { font-size: 0.95rem; }
          .ini-indicadores {
            grid-template-columns: repeat(3, 1fr);
            max-width: 720px;
            margin-top: -90px;
            margin-left: auto;
            margin-right: auto;
            gap: 1rem;
          }
          .ini-ind-card { padding: 1.25rem 1rem; }
          .ini-ind-val { font-size: 1.8rem; }
          .ini-ind-label { font-size: 0.78rem; }
          .ini-actions { grid-template-columns: 1fr 1fr; max-width: 720px; margin-left: auto; margin-right: auto; }
          .ini-resumo { grid-template-columns: 1fr 1fr; max-width: 720px; margin-left: auto; margin-right: auto; }
          .ini-alertas, .ini-tudo-ok, .ini-chart-card { max-width: 720px; margin-left: auto; margin-right: auto; }
          .ini-section { width: 100%; }
        }
      `}</style>
    </div>
  );
}

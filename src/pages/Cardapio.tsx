import { useState, useEffect, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChartBar, Eye, Storefront, Sliders, PaintBrush, Tag,
  Share, Percent, ForkKnife, Copy, CheckCircle, Warning, Lightbulb,
  TrendUp, TrendDown, ShoppingBag, Users as UsersIcon, CurrencyDollar,
} from "@phosphor-icons/react";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabase";

type Periodo = "hoje" | "7d" | "30d" | "tudo";

interface MetricasData {
  visitas: number;
  pedidosCardapio: number;
  receita: number;
  topProdutos: Array<{ nome: string; qtd: number; imagem?: string }>;
}

interface Alerta {
  tipo: "warning" | "info";
  texto: string;
  cta: string;
  onClick: () => void;
}

/**
 * Hub da seção Cardápio — versão completa (Entrega 2 da Proposta D).
 *
 * Reúne em uma única tela:
 * - Status do cardápio digital (link + compartilhamento)
 * - Métricas de performance (visitas, pedidos, receita, conversão)
 * - Top 3 produtos vendidos no cardápio
 * - Alertas que ajudam a melhorar o cardápio (gamificação leve)
 * - Atalhos para configurações detalhadas
 *
 * Substitui o antigo CardapioResumo.tsx (agora apenas redireciona pra cá).
 */
export default function Cardapio() {
  const navigate = useNavigate();
  const { profile } = useProfile();

  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const [metricas, setMetricas] = useState<MetricasData>({
    visitas: 0,
    pedidosCardapio: 0,
    receita: 0,
    topProdutos: [],
  });
  const [metricasAnterior, setMetricasAnterior] = useState({ visitas: 0, pedidos: 0, receita: 0 });
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState(false);

  const slug = profile?.slug || "";
  const linkCardapio = slug ? `${window.location.origin}/cardapio/${slug}` : "";
  const linkDisplay = slug ? `${window.location.host}/cardapio/${slug}` : "Configure seu cardápio";
  const publicado = !!slug;

  // ─── Carregar métricas + alertas ───
  useEffect(() => {
    if (!profile?.id) return;
    carregarTudo();
  }, [profile?.id, periodo]);

  const calcularDataLimite = (p: Periodo): Date => {
    const d = new Date();
    if (p === "hoje") d.setHours(0, 0, 0, 0);
    else if (p === "7d") d.setDate(d.getDate() - 7);
    else if (p === "30d") d.setDate(d.getDate() - 30);
    else d.setFullYear(2000);
    return d;
  };

  /** Período anterior pra comparar (mesma duração antes do início do atual). */
  const calcularDataAnterior = (p: Periodo): { inicio: Date; fim: Date } | null => {
    if (p === "tudo") return null;
    const fim = calcularDataLimite(p);
    const inicio = new Date(fim);
    if (p === "hoje") inicio.setDate(inicio.getDate() - 1);
    else if (p === "7d") inicio.setDate(inicio.getDate() - 7);
    else if (p === "30d") inicio.setDate(inicio.getDate() - 30);
    return { inicio, fim };
  };

  const carregarTudo = async () => {
    setLoading(true);
    try {
      const userId = profile!.id;
      const dataLimite = calcularDataLimite(periodo);
      const dataAnterior = calcularDataAnterior(periodo);

      // Queries em paralelo
      const [
        visitasRes,
        pedidosRes,
        produtosRes,
        visitasAntRes,
        pedidosAntRes,
      ] = await Promise.all([
        // Visitas no período
        supabase
          .from("cardapio_visitas")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", dataLimite.toISOString()),
        // Pedidos vindos do cardápio
        supabase
          .from("pedidos")
          .select("id, valor_total, pedido_itens(nome_produto, quantidade, produtos(imagem_url))")
          .eq("user_id", userId)
          .eq("origem", "cardapio")
          .gte("created_at", dataLimite.toISOString()),
        // Todos os produtos disponíveis (pra alertas)
        supabase
          .from("produtos")
          .select("id, nome, imagem_url, preco_normal, disponivel")
          .eq("user_id", userId),
        // Comparação: visitas no período anterior
        dataAnterior
          ? supabase
              .from("cardapio_visitas")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId)
              .gte("created_at", dataAnterior.inicio.toISOString())
              .lt("created_at", dataAnterior.fim.toISOString())
          : Promise.resolve({ count: 0, data: null }),
        // Comparação: pedidos no período anterior
        dataAnterior
          ? supabase
              .from("pedidos")
              .select("id, valor_total")
              .eq("user_id", userId)
              .eq("origem", "cardapio")
              .gte("created_at", dataAnterior.inicio.toISOString())
              .lt("created_at", dataAnterior.fim.toISOString())
          : Promise.resolve({ count: 0, data: [] }),
      ]);

      const visitas = visitasRes.count || 0;
      const pedidosLista = pedidosRes.data || [];
      const pedidosCount = pedidosLista.length;
      const receita = pedidosLista.reduce((s: number, p: any) => s + (Number(p.valor_total) || 0), 0);

      // Top 3 produtos
      const contagem: Record<string, { qtd: number; imagem?: string }> = {};
      pedidosLista.forEach((p: any) => {
        p.pedido_itens?.forEach((item: any) => {
          if (!contagem[item.nome_produto]) {
            contagem[item.nome_produto] = { qtd: 0, imagem: item.produtos?.imagem_url };
          }
          contagem[item.nome_produto].qtd += Number(item.quantidade) || 0;
        });
      });
      const topProdutos = Object.entries(contagem)
        .sort((a, b) => b[1].qtd - a[1].qtd)
        .slice(0, 3)
        .map(([nome, info]) => ({ nome, qtd: info.qtd, imagem: info.imagem }));

      setMetricas({ visitas, pedidosCardapio: pedidosCount, receita, topProdutos });
      setMetricasAnterior({
        visitas: visitasAntRes.count || 0,
        pedidos: (pedidosAntRes.data?.length) || 0,
        receita: (pedidosAntRes.data || []).reduce((s: number, p: any) => s + (Number(p.valor_total) || 0), 0),
      });

      // ─── Alertas ───
      const novosAlertas: Alerta[] = [];
      const produtos = produtosRes.data || [];
      const disponiveis = produtos.filter((p: any) => p.disponivel !== false);

      if (disponiveis.length === 0) {
        novosAlertas.push({
          tipo: "warning",
          texto: "Nenhum produto disponível no cardápio",
          cta: "Cadastrar produto",
          onClick: () => navigate("/produtos"),
        });
      }
      const semFoto = disponiveis.filter((p: any) => !p.imagem_url).length;
      if (semFoto > 0) {
        novosAlertas.push({
          tipo: "warning",
          texto: `${semFoto} produto${semFoto === 1 ? "" : "s"} sem foto`,
          cta: "Revisar",
          onClick: () => navigate("/produtos"),
        });
      }
      const semPreco = disponiveis.filter((p: any) => !p.preco_normal || Number(p.preco_normal) <= 0).length;
      if (semPreco > 0) {
        novosAlertas.push({
          tipo: "warning",
          texto: `${semPreco} produto${semPreco === 1 ? "" : "s"} sem preço`,
          cta: "Revisar",
          onClick: () => navigate("/produtos"),
        });
      }
      const desc = (profile as any)?.descricao_loja;
      if (!desc || desc.trim().length === 0) {
        novosAlertas.push({
          tipo: "info",
          texto: "Descrição da loja está vazia",
          cta: "Preencher",
          onClick: () => navigate("/cardapio-config"),
        });
      }
      const logo = (profile as any)?.logo_url;
      if (!logo) {
        novosAlertas.push({
          tipo: "info",
          texto: "Logo da loja não foi adicionada",
          cta: "Adicionar",
          onClick: () => navigate("/cardapio-design"),
        });
      }

      setAlertas(novosAlertas);
    } catch (err) {
      console.error("Erro ao carregar dados do cardápio:", err);
    }
    setLoading(false);
  };

  // ─── Ações ───
  const handleShare = async () => {
    if (!publicado) {
      navigate("/cardapio-config");
      return;
    }
    const texto = `Confira o cardápio da minha confeitaria: ${linkCardapio}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Meu Cardápio", text: texto, url: linkCardapio });
      } catch {
        // usuário cancelou - sem ação
      }
    } else {
      handleCopiar();
    }
  };

  const handleCopiar = () => {
    if (!linkCardapio) return;
    navigator.clipboard.writeText(linkCardapio);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleVerComoCliente = () => {
    if (!publicado) {
      navigate("/cardapio-config");
      return;
    }
    window.open(linkCardapio, "_blank", "noopener,noreferrer");
  };

  // ─── Helpers ───
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const variacao = (atual: number, anterior: number): { pct: number; tipo: "up" | "down" | "flat" } => {
    if (anterior === 0 && atual === 0) return { pct: 0, tipo: "flat" };
    if (anterior === 0) return { pct: 100, tipo: "up" };
    const pct = ((atual - anterior) / anterior) * 100;
    return { pct: Math.abs(pct), tipo: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
  };

  const conversao = metricas.visitas > 0
    ? Math.min((metricas.pedidosCardapio / metricas.visitas) * 100, 100)
    : 0;

  const sections: Array<{ label: string; icon: ReactElement; path: string }> = [
    { label: "Produtos",     icon: <Storefront size={18} weight="duotone" />, path: "/produtos" },
    { label: "Categorias",   icon: <ForkKnife  size={18} weight="duotone" />, path: "/categorias" },
    { label: "Promoções",    icon: <Percent    size={18} weight="duotone" />, path: "/promocoes" },
    { label: "Aparência",    icon: <PaintBrush size={18} weight="duotone" />, path: "/cardapio-design" },
    { label: "Configurações",icon: <Sliders    size={18} weight="duotone" />, path: "/cardapio-config" },
    { label: "Entrega/Pgto", icon: <Tag        size={18} weight="duotone" />, path: "/checkout-config" },
  ];

  // ─── Render ───
  return (
    <div className="cardapio-hub">
      <div className="ch-header">
        <h1 className="ch-title">Cardápio</h1>
        <p className="ch-sub">Sua vitrine online</p>
      </div>

      {/* Status + link + ações */}
      <div className="ch-status-card">
        <div className="ch-status-row">
          <div className={`ch-status-badge ${publicado ? "publicado" : "rascunho"}`}>
            {publicado ? <CheckCircle size={14} weight="fill" /> : <Warning size={14} weight="fill" />}
            <span>{publicado ? "Publicado" : "Não publicado"}</span>
          </div>
        </div>
        <p className="ch-link-url">{linkDisplay}</p>

        <div className="ch-actions">
          <button className="ch-btn-primary" onClick={handleShare} disabled={!publicado}>
            <Share size={16} weight="bold" />
            Compartilhar
          </button>
          <button className="ch-btn-ghost" onClick={handleVerComoCliente} disabled={!publicado} aria-label="Visualizar">
            <Eye size={16} weight="bold" />
          </button>
          <button className="ch-btn-ghost" onClick={handleCopiar} disabled={!publicado} aria-label="Copiar link">
            {copiado ? <CheckCircle size={16} weight="bold" /> : <Copy size={16} weight="bold" />}
          </button>
        </div>
      </div>

      {/* Seletor de período */}
      <div className="ch-periodo-tabs" role="tablist">
        {([
          { v: "hoje", l: "Hoje" },
          { v: "7d",   l: "7 dias" },
          { v: "30d",  l: "30 dias" },
          { v: "tudo", l: "Tudo" },
        ] as { v: Periodo; l: string }[]).map((opt) => (
          <button
            key={opt.v}
            role="tab"
            aria-selected={periodo === opt.v}
            className={`ch-periodo-tab ${periodo === opt.v ? "active" : ""}`}
            onClick={() => setPeriodo(opt.v)}
          >
            {opt.l}
          </button>
        ))}
      </div>

      {/* Métricas */}
      <div className="ch-metricas-grid">
        {[
          {
            label: "Visitas",
            value: metricas.visitas,
            icon: <UsersIcon size={18} weight="duotone" />,
            color: "#6366F1",
            bg: "#EEF2FF",
            varAtual: metricas.visitas,
            varAnt: metricasAnterior.visitas,
          },
          {
            label: "Pedidos online",
            value: metricas.pedidosCardapio,
            icon: <ShoppingBag size={18} weight="duotone" />,
            color: "#3d1a24",
            bg: "#FFF1F7",
            varAtual: metricas.pedidosCardapio,
            varAnt: metricasAnterior.pedidos,
          },
          {
            label: "Receita online",
            value: formatCurrency(metricas.receita),
            icon: <CurrencyDollar size={18} weight="duotone" />,
            color: "#15803D",
            bg: "#DCFCE7",
            varAtual: metricas.receita,
            varAnt: metricasAnterior.receita,
            isCurrency: true,
          },
          {
            label: "Conversão",
            value: `${conversao.toFixed(1)}%`,
            icon: <ChartBar size={18} weight="duotone" />,
            color: "#A16207",
            bg: "#FEF3C7",
            noVar: true,
          },
        ].map((m, i) => {
          const v = !m.noVar && periodo !== "tudo"
            ? variacao(m.varAtual ?? 0, m.varAnt ?? 0)
            : null;
          return (
            <div key={i} className="ch-metric-card">
              <div className="ch-metric-icon" style={{ background: m.bg, color: m.color }}>
                {m.icon}
              </div>
              <div className="ch-metric-body">
                <p className="ch-metric-label">{m.label}</p>
                <p className="ch-metric-value">{m.value}</p>
                {v && v.tipo !== "flat" && (
                  <p className={`ch-metric-var ${v.tipo}`}>
                    {v.tipo === "up" ? <TrendUp size={11} weight="bold" /> : <TrendDown size={11} weight="bold" />}
                    {v.pct.toFixed(0)}%
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Top 3 produtos */}
      {metricas.topProdutos.length > 0 && (
        <div className="ch-block">
          <h2 className="ch-block-title">Mais vendidos no cardápio</h2>
          <div className="ch-top-list">
            {metricas.topProdutos.map((p, idx) => (
              <div key={p.nome} className="ch-top-item">
                <span className="ch-top-rank">#{idx + 1}</span>
                <div className="ch-top-img">
                  {p.imagem ? <img src={p.imagem} alt={p.nome} /> : <span>🍰</span>}
                </div>
                <div className="ch-top-info">
                  <p className="ch-top-nome">{p.nome}</p>
                  <p className="ch-top-qtd">{p.qtd} {p.qtd === 1 ? "venda" : "vendas"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="ch-block">
          <h2 className="ch-block-title">Atenção</h2>
          <div className="ch-alertas">
            {alertas.map((a, idx) => (
              <button key={idx} className={`ch-alerta ch-alerta--${a.tipo}`} onClick={a.onClick}>
                <span className="ch-alerta-icon">
                  {a.tipo === "warning"
                    ? <Warning size={16} weight="fill" />
                    : <Lightbulb size={16} weight="fill" />}
                </span>
                <span className="ch-alerta-texto">{a.texto}</span>
                <span className="ch-alerta-cta">{a.cta} ›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Atalhos de gerenciamento */}
      <div className="ch-block">
        <h2 className="ch-block-title">Gerenciar</h2>
        <div className="ch-tiles">
          {sections.map((s) => (
            <button key={s.path} className="ch-tile-compact" onClick={() => navigate(s.path)}>
              <span className="ch-tile-icon">{s.icon}</span>
              <span className="ch-tile-label">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="ch-loading">Carregando…</div>}

      <style>{`
        .cardapio-hub {
          font-family: 'Geist', sans-serif;
          padding: 1.25rem 1rem 6rem;
          display: flex; flex-direction: column; gap: 1.1rem;
          max-width: 980px; margin: 0 auto;
        }
        .ch-header { display: flex; flex-direction: column; gap: 4px; }
        .ch-title { font-size: var(--text-2xl); font-weight: var(--fw-black); color: var(--text-title); margin: 0; letter-spacing: -0.02em; }
        .ch-sub { font-size: var(--font-button); color: var(--text-secondary); margin: 0; }

        /* ── Status card ── */
        .ch-status-card {
          padding: 1.1rem 1.15rem;
          background: linear-gradient(135deg, #3d1a24 0%, #6E3548 100%);
          border-radius: var(--radius-lg);
          box-shadow: 0 8px 24px rgba(61,26,36,0.25);
          color: #fff;
          display: flex; flex-direction: column; gap: 0.7rem;
        }
        .ch-status-row { display: flex; align-items: center; gap: 0.5rem; }
        .ch-status-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: var(--radius-full);
          font-size: var(--font-caption); font-weight: var(--fw-bold);
          letter-spacing: 0.02em;
        }
        .ch-status-badge.publicado { background: rgba(34,197,94,0.25); color: #BBF7D0; }
        .ch-status-badge.rascunho  { background: rgba(245,158,11,0.25); color: #FDE68A; }
        .ch-link-url {
          font-size: var(--font-input); font-weight: var(--fw-bold);
          margin: 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          opacity: 0.95;
        }
        .ch-actions { display: flex; gap: 0.5rem; }
        .ch-btn-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
          flex: 1;
          background: #fff; color: #3d1a24;
          border: none; border-radius: var(--radius-md);
          padding: 0.7rem 1rem;
          font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-bold);
          cursor: pointer;
          box-shadow: 0 3px 10px rgba(0,0,0,0.15);
          transition: transform var(--dur-fast) var(--ease-out);
        }
        .ch-btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
        .ch-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .ch-btn-ghost {
          width: 42px; height: 42px;
          display: inline-flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.15); color: #fff;
          border: none; border-radius: var(--radius-md);
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease-out);
        }
        .ch-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.25); }
        .ch-btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Seletor de período ── */
        .ch-periodo-tabs {
          display: flex; gap: 4px;
          padding: 4px;
          background: var(--bg-subtle);
          border-radius: var(--radius-md);
          width: fit-content;
        }
        .ch-periodo-tab {
          padding: 0.45rem 0.85rem;
          border: none; border-radius: var(--radius-sm);
          background: transparent; color: var(--text-secondary);
          font-family: inherit; font-size: var(--font-helper); font-weight: var(--fw-semibold);
          cursor: pointer;
          transition: all var(--dur-fast) var(--ease-out);
        }
        .ch-periodo-tab.active {
          background: #fff;
          color: #3d1a24;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }

        /* ── Métricas ── */
        .ch-metricas-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.7rem;
        }
        @media (min-width: 720px) {
          .ch-metricas-grid { grid-template-columns: repeat(4, 1fr); }
        }
        .ch-metric-card {
          display: flex; align-items: flex-start; gap: 0.6rem;
          padding: 0.9rem;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
        }
        .ch-metric-icon {
          width: 36px; height: 36px;
          border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ch-metric-body { min-width: 0; flex: 1; }
        .ch-metric-label {
          font-size: var(--font-caption); font-weight: var(--fw-semibold);
          color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.04em;
          margin: 0 0 4px;
        }
        .ch-metric-value {
          font-size: var(--font-modal-title); font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0;
          line-height: 1;
          word-break: break-word;
        }
        .ch-metric-var {
          display: inline-flex; align-items: center; gap: 2px;
          margin: 5px 0 0;
          font-size: var(--font-caption); font-weight: var(--fw-bold);
        }
        .ch-metric-var.up   { color: #15803D; }
        .ch-metric-var.down { color: #B91C1C; }

        /* ── Blocos ── */
        .ch-block {
          display: flex; flex-direction: column; gap: 0.6rem;
        }
        .ch-block-title {
          font-size: var(--font-button); font-weight: var(--fw-bold);
          color: var(--text-title);
          margin: 0;
          letter-spacing: -0.01em;
        }

        /* ── Top produtos ── */
        .ch-top-list {
          display: flex; flex-direction: column; gap: 0.45rem;
        }
        .ch-top-item {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.65rem 0.85rem;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }
        .ch-top-rank {
          font-size: var(--font-button); font-weight: var(--fw-black);
          color: #3d1a24;
          width: 22px;
        }
        .ch-top-img {
          width: 38px; height: 38px;
          border-radius: var(--radius-md);
          background: var(--bg-subtle);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
          font-size: var(--font-modal-title);
        }
        .ch-top-img img { width: 100%; height: 100%; object-fit: cover; }
        .ch-top-info { min-width: 0; flex: 1; }
        .ch-top-nome {
          font-size: var(--font-button); font-weight: var(--fw-bold);
          color: var(--text-title);
          margin: 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ch-top-qtd {
          font-size: var(--font-helper);
          color: var(--text-muted);
          margin: 2px 0 0;
        }

        /* ── Alertas ── */
        .ch-alertas { display: flex; flex-direction: column; gap: 0.4rem; }
        .ch-alerta {
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.7rem 0.85rem;
          border-radius: var(--radius-md);
          border: 1px solid transparent;
          font-family: inherit;
          cursor: pointer;
          text-align: left;
          transition: transform var(--dur-fast) var(--ease-out);
        }
        .ch-alerta:hover { transform: translateX(2px); }
        .ch-alerta--warning {
          background: #FEF3C7;
          border-color: #FCD34D;
          color: #92400E;
        }
        .ch-alerta--info {
          background: #EEF2FF;
          border-color: #C7D2FE;
          color: #3730A3;
        }
        .ch-alerta-icon { display: inline-flex; flex-shrink: 0; }
        .ch-alerta-texto {
          flex: 1; min-width: 0;
          font-size: var(--font-button); font-weight: var(--fw-semibold);
        }
        .ch-alerta-cta {
          font-size: var(--font-helper); font-weight: var(--fw-bold);
          opacity: 0.85;
          flex-shrink: 0;
        }

        /* ── Tiles compactos (Gerenciar) ── */
        .ch-tiles {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }
        @media (min-width: 600px) {
          .ch-tiles { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 900px) {
          .ch-tiles { grid-template-columns: repeat(6, 1fr); }
        }
        .ch-tile-compact {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.7rem 0.8rem;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          font-family: inherit;
          cursor: pointer;
          text-align: left;
          transition: all var(--dur-fast) var(--ease-out);
        }
        .ch-tile-compact:hover {
          border-color: #3d1a24;
          transform: translateY(-1px);
        }
        .ch-tile-icon {
          width: 30px; height: 30px;
          border-radius: var(--radius-sm);
          background: var(--primary-light);
          color: #3d1a24;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ch-tile-label {
          font-size: var(--font-helper); font-weight: var(--fw-semibold);
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ch-loading {
          text-align: center;
          padding: 1rem;
          color: var(--text-muted);
          font-size: var(--font-button);
        }
      `}</style>
    </div>
  );
}

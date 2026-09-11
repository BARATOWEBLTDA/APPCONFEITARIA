import { useState, useEffect, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChartBar, Eye, Storefront, Sliders, PaintBrush, Tag,
  Share, Percent, ForkKnife, Copy, CheckCircle, Warning, Lightbulb,
  TrendUp, TrendDown, ShoppingBag, Users as UsersIcon, CurrencyDollar,
  CaretRight,
} from "@phosphor-icons/react";
import { useProfile, getCardapioUrl, isPro } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabase";
import AppPageHeader from "@/components/AppPageHeader";

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
  const [contadores, setContadores] = useState({ produtos: 0, produtosAtivos: 0, categorias: 0, promocoes: 0 });
  const [visitasPop, setVisitasPop] = useState<number | null>(null); // +N flutuante quando chega visita nova

  // Nova arquitetura: cardápio publicado quando profile.codigo_publico existe.
  // URL final: /c/[codigo]/[slug] — slug é "cardapio" (free) ou personalizado (PRO).
  const codigo = profile?.codigo_publico || "";
  const linkCardapio = getCardapioUrl(profile);
  const slugCanonico = isPro(profile) && profile?.slug_personalizado ? profile.slug_personalizado : "cardapio";
  // Display: mostra sem "https://" para ficar mais limpo
  const linkDisplay = linkCardapio ? linkCardapio.replace(/^https?:\/\//, "") : "Configure seu cardápio";
  const publicado = !!codigo;

  // ─── Carregar métricas + alertas ───
  useEffect(() => {
    if (!profile?.id) return;
    carregarTudo();
  }, [profile?.id, periodo]);

  // Contadores de catálogo (produtos ativos, categorias, promoções) — recarrega ao voltar pra tela
  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const uid = profile.id;
      const [prod, cat, promo] = await Promise.all([
        supabase.from("produtos").select("id, disponivel", { count: "exact" }).eq("user_id", uid),
        supabase.from("categorias").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("promocoes").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("ativo", true),
      ]);
      setContadores({
        produtos: prod.count ?? 0,
        produtosAtivos: (prod.data || []).filter((p: any) => p.disponivel !== false).length,
        categorias: cat.count ?? 0,
        promocoes: promo.count ?? 0,
      });
    })();
  }, [profile?.id]);

  // Visitas em tempo real — subscribe a novos inserts na tabela cardapio_visitas
  useEffect(() => {
    if (!profile?.id) return;
    const canal = supabase
      .channel(`visitas-live-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cardapio_visitas", filter: `user_id=eq.${profile.id}` },
        () => {
          // Incrementa visitas do período atual + dispara pop "+1"
          setMetricas((m) => ({ ...m, visitas: m.visitas + 1 }));
          setVisitasPop(1);
          window.setTimeout(() => setVisitasPop(null), 1200);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [profile?.id]);

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
    <>
    <AppPageHeader
      title="Meu Cardápio"
      subtitle="Personalize sua loja online"
      infoIcon="🛍️"
      infoContent={
        <>
          <p>Este é o <strong>cardápio digital</strong> que seus clientes acessam. Personalize as cores, adicione produtos, configure entrega e pagamento.</p>
          <p>Depois é só <strong>compartilhar o link</strong> no WhatsApp, Instagram, bio, ou onde preferir. Seus clientes fazem pedidos direto por lá.</p>
        </>
      }
      infoTip={<>Copie o link do seu cardápio e coloque na <strong>bio do Instagram</strong> ou envie no WhatsApp.</>}
    />
    <div className="cardapio-hub">
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

      {/* Meu Catálogo — ações do dia-a-dia */}
      <p className="ch-list-section-title">Meu Catálogo</p>
      <div className="ch-list-group">
        <button className="ch-list-row" onClick={() => navigate("/produtos")}>
          <span className="ch-list-icon ch-list-icon--primary">
            <Storefront size={18} weight="duotone" />
          </span>
          <span className="ch-list-lbl">Produtos</span>
          <span className="ch-list-badge">
            {contadores.produtosAtivos}
            {contadores.produtos !== contadores.produtosAtivos && (
              <span className="ch-list-badge-sub"> / {contadores.produtos}</span>
            )}
          </span>
          <CaretRight size={14} weight="bold" className="ch-list-chev" />
        </button>
        <button className="ch-list-row" onClick={() => navigate("/categorias")}>
          <span className="ch-list-icon ch-list-icon--accent">
            <ForkKnife size={18} weight="duotone" />
          </span>
          <span className="ch-list-lbl">Categorias</span>
          <span className="ch-list-badge">{contadores.categorias}</span>
          <CaretRight size={14} weight="bold" className="ch-list-chev" />
        </button>
        <button className="ch-list-row" onClick={() => navigate("/promocoes")}>
          <span className="ch-list-icon ch-list-icon--warning">
            <Percent size={18} weight="duotone" />
          </span>
          <span className="ch-list-lbl">Promoções</span>
          <span className="ch-list-badge">{contadores.promocoes}</span>
          <CaretRight size={14} weight="bold" className="ch-list-chev" />
        </button>
      </div>

      {/* Configuração da Loja — setup inicial, raramente muda */}
      <p className="ch-list-section-title">Configuração da Loja</p>
      <div className="ch-list-group">
        <button className="ch-list-row" onClick={() => navigate("/cardapio-design")}>
          <span className="ch-list-icon ch-list-icon--muted">
            <PaintBrush size={18} weight="duotone" />
          </span>
          <span className="ch-list-lbl">Aparência</span>
          <CaretRight size={14} weight="bold" className="ch-list-chev" />
        </button>
        <button className="ch-list-row" onClick={() => navigate("/cardapio-config")}>
          <span className="ch-list-icon ch-list-icon--muted">
            <Sliders size={18} weight="duotone" />
          </span>
          <span className="ch-list-lbl">Configurações da loja</span>
          <CaretRight size={14} weight="bold" className="ch-list-chev" />
        </button>
        <button className="ch-list-row" onClick={() => navigate("/checkout-config")}>
          <span className="ch-list-icon ch-list-icon--muted">
            <Tag size={18} weight="duotone" />
          </span>
          <span className="ch-list-lbl">Entrega e Pagamento</span>
          <CaretRight size={14} weight="bold" className="ch-list-chev" />
        </button>
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
            color: "var(--text-title)",
            bg: "var(--primary-light)",
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
                {m.label === "Visitas" ? (
                  <span className="ch-metric-value-wrap">
                    <span className="ch-metric-value">{m.value}</span>
                    {visitasPop !== null && <span className="ch-metric-pop">+{visitasPop}</span>}
                  </span>
                ) : (
                  <p className="ch-metric-value">{m.value}</p>
                )}
                {v && v.tipo !== "flat" && (
                  <p className={`ch-metric-var ${v.tipo}`}>
                    {v.tipo === "up" ? <TrendUp size={11} weight="bold" /> : <TrendDown size={11} weight="bold" />}
                    {v.pct.toFixed(0)}%
                  </p>
                )}
              </div>
              {m.label === "Visitas" && (
                <span className="ch-live-badge">
                  <span className="ch-live-dot" />
                  Ao vivo
                </span>
              )}
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

      {loading && <div className="ch-loading">Carregando…</div>}

      <style>{`
        .cardapio-hub {
          font-family: var(--font-base);
          padding: var(--space-5) var(--space-4) 6rem;
          display: flex; flex-direction: column; gap: var(--space-4);
          max-width: 980px; margin: 0 auto;
        }
        .ch-header { display: flex; flex-direction: column; gap: var(--space-1); }
        .ch-title {
          font-size: var(--font-page-title);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0;
          letter-spacing: var(--ls-tight);
        }
        .ch-sub {
          font-size: var(--font-page-subtitle);
          color: var(--text-secondary);
          margin: 0;
        }

        /* ── Status card (superfície vinho escura, mesma identidade nos dois temas) ── */
        .ch-status-card {
          padding: var(--space-4) var(--space-5);
          background: linear-gradient(135deg, var(--text-title) 0%, var(--primary-dark) 100%);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
          color: #FFFFFF;
          display: flex; flex-direction: column; gap: var(--space-3);
        }
        .ch-status-row { display: flex; align-items: center; gap: var(--space-2); }
        .ch-status-badge {
          display: inline-flex; align-items: center; gap: var(--space-1);
          padding: var(--space-1) var(--space-3);
          border-radius: var(--radius-full);
          font-size: var(--font-caption); font-weight: var(--fw-bold);
          letter-spacing: var(--ls-wide);
        }
        .ch-status-badge.publicado { background: rgba(34,197,94,0.25); color: #BBF7D0; }
        .ch-status-badge.rascunho  { background: rgba(245,158,11,0.25); color: #FDE68A; }
        .ch-link-url {
          font-size: var(--font-input); font-weight: var(--fw-bold);
          margin: 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          opacity: 0.95;
        }
        .ch-actions { display: flex; gap: var(--space-2); }
        .ch-btn-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
          flex: 1;
          background: #FFFFFF; color: var(--text-title);
          border: none; border-radius: var(--radius-md);
          padding: var(--space-3) var(--space-4);
          font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-bold);
          cursor: pointer;
          box-shadow: var(--shadow-sm);
          transition: transform var(--dur-fast) var(--ease-out);
        }
        .ch-btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
        .ch-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .ch-btn-ghost {
          width: 42px; height: 42px;
          display: inline-flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.15); color: #FFFFFF;
          border: none; border-radius: var(--radius-md);
          font-family: inherit;
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease-out);
        }
        .ch-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.25); }
        .ch-btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Seletor de período ── */
        .ch-periodo-tabs {
          display: flex;
          width: 100%;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow: hidden;
        }
        .ch-periodo-tab {
          flex: 1;
          padding: var(--space-2) var(--space-2);
          text-align: center;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          border-right: 1px solid var(--border);
          font-family: inherit; font-size: var(--font-helper); font-weight: var(--fw-semibold);
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease-out),
                      color var(--dur-fast) var(--ease-out);
        }
        .ch-periodo-tab:last-child { border-right: none; }
        .ch-periodo-tab:hover:not(.active) { background: var(--bg-subtle); color: var(--text-title); }
        .ch-periodo-tab.active {
          background: var(--text-title);
          color: #fff;
        }

        /* ── Métricas ── */
        .ch-metricas-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-3);
        }
        @media (min-width: 720px) {
          .ch-metricas-grid { grid-template-columns: repeat(4, 1fr); }
        }
        .ch-metric-card {
          display: flex; align-items: flex-start; gap: var(--space-3);
          padding: var(--pad-card);
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
          font-size: 10px; font-weight: var(--fw-bold);
          color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.04em;
          margin: 0 0 var(--space-1);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        }
        .ch-metric-value {
          font-size: var(--font-card-title);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0;
          line-height: var(--lh-tight);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: var(--ls-tight);
          display: inline-block;
        }
        @media (min-width: 720px) {
          .ch-metric-value { font-size: var(--font-modal-title); }
        }
        .ch-metric-var {
          display: inline-flex; align-items: center; gap: var(--space-1);
          margin: var(--space-1) 0 0;
          font-size: var(--font-caption); font-weight: var(--fw-bold);
        }
        .ch-metric-var.up   { color: var(--success); }
        .ch-metric-var.down { color: var(--error); }

        /* ── Badge "Ao vivo" + animação de +N incrementando ── */
        .ch-metric-card { position: relative; }
        .ch-live-badge {
          position: absolute; top: 8px; right: 8px;
          display: inline-flex; align-items: center; gap: 4px;
          padding: 2px 8px 2px 6px;
          background: #DCFCE7; color: #14532d;
          border-radius: 999px;
          font-family: inherit;
          font-size: 9px; font-weight: var(--fw-black);
          letter-spacing: 0.05em; text-transform: uppercase;
          line-height: 1;
        }
        .ch-live-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5);
          animation: chLiveDot 1.6s ease-in-out infinite;
        }
        @keyframes chLiveDot {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
          50%      { box-shadow: 0 0 0 5px rgba(34, 197, 94, 0); }
        }
        .ch-metric-value-wrap { position: relative; display: inline-block; }
        .ch-metric-pop {
          position: absolute; top: -6px; right: -26px;
          background: #22c55e; color: #fff;
          padding: 1px 7px; border-radius: 999px;
          font-family: inherit;
          font-size: 9px; font-weight: var(--fw-black);
          line-height: 1.4;
          pointer-events: none;
          animation: chPopIn 1.2s ease-out forwards;
        }
        @keyframes chPopIn {
          0%   { transform: translateY(6px) scale(0.6); opacity: 0; }
          30%  { transform: translateY(-2px) scale(1.1); opacity: 1; }
          70%  { transform: translateY(-4px) scale(1); opacity: 1; }
          100% { transform: translateY(-12px) scale(0.9); opacity: 0; }
        }

        /* ── Blocos ── */
        .ch-block {
          display: flex; flex-direction: column; gap: var(--space-3);
        }
        .ch-block-title {
          font-size: var(--font-button); font-weight: var(--fw-bold);
          color: var(--text-title);
          margin: 0;
          letter-spacing: var(--ls-tight);
        }

        /* ── Lista tipo iOS Settings — 2 grupos temáticos ── */
        .ch-list-section-title {
          margin: var(--space-4) var(--space-2) var(--space-2);
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
        }
        .ch-list-section-title:first-of-type { margin-top: var(--space-2); }
        .ch-list-group {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        .ch-list-row {
          display: flex; align-items: center; gap: 12px;
          width: 100%;
          padding: 12px 14px;
          background: none;
          border: none;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: background 0.15s;
        }
        .ch-list-row:last-child { border-bottom: none; }
        .ch-list-row:hover, .ch-list-row:active { background: var(--bg-subtle); }
        .ch-list-icon {
          width: 32px; height: 32px;
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ch-list-icon--primary { background: var(--primary-light); color: var(--primary); }
        .ch-list-icon--accent  { background: #EEEDFE; color: #534AB7; }
        .ch-list-icon--warning { background: #FEF3C7; color: #92400E; }
        .ch-list-icon--muted   { background: var(--bg-subtle); color: var(--text-secondary); }
        .ch-list-lbl {
          flex: 1;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-title);
          letter-spacing: -0.01em;
        }
        .ch-list-badge {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
          margin-right: 2px;
        }
        .ch-list-badge-sub {
          font-weight: 500;
          opacity: 0.7;
        }
        .ch-list-chev {
          color: var(--border);
          flex-shrink: 0;
        }

        /* ── Top produtos ── */
        .ch-top-list {
          display: flex; flex-direction: column; gap: var(--space-2);
        }
        .ch-top-item {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3);
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }
        .ch-top-rank {
          font-size: var(--font-button); font-weight: var(--fw-black);
          color: var(--text-title);
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
          margin: var(--space-1) 0 0;
        }

        /* ── Alertas ── */
        .ch-alertas { display: flex; flex-direction: column; gap: var(--space-2); }
        .ch-alerta {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3);
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
          gap: var(--space-1);
          padding: var(--space-2);
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
        }
        @media (min-width: 600px) {
          .ch-tiles { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 900px) {
          .ch-tiles { grid-template-columns: repeat(6, 1fr); }
        }
        .ch-tile-compact {
          display: flex; align-items: center; gap: var(--space-2);
          padding: var(--space-3);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          font-family: inherit;
          cursor: pointer;
          text-align: left;
          transition: background var(--dur-fast) var(--ease-out);
        }
        .ch-tile-compact:hover {
          background: var(--bg-subtle);
        }
        .ch-tile-compact:active {
          background: var(--primary-light);
        }
        .ch-tile-icon {
          width: 30px; height: 30px;
          border-radius: var(--radius-sm);
          background: var(--primary-light);
          color: var(--text-title);
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
          padding: var(--space-4);
          color: var(--text-muted);
          font-size: var(--font-button);
        }
      `}</style>
    </div>
    </>
  );
}

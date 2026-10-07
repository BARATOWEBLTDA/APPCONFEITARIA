// Build marker: 2026-09-05T11:00 — mobile hero: fonte menor, PRO achatado, texto centralizado
import PrimeirosPassos from "@/components/PrimeirosPassos";
import { STATUS_AINDA_NAO_PRONTO } from "@/lib/pedidoStatus";
import ConquistasCard from "@/components/ConquistasCard";
import MenuConta from "@/components/MenuConta";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Share, Plus, ClipboardText, CalendarDots,
  TrendUp, TrendDown, CurrencyDollar, ShoppingBag,
  Bell, Storefront, SignOut, Camera,
  Package, CookingPot, Users, ChartLineUp, ForkKnife, CaretRight,
  InstagramLogo, DotsThreeOutline, Clock, Heart,
  Cake, Percent, Receipt, SealPercent, BookOpen, Gear, ChartBar, Cube,
  Calculator,
} from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { enableNotifications, disableNotifications, getStoredNotifState } from "@/lib/notifications";
import { useProfile } from "@/hooks/useProfile";
import { useIsMobile } from "@/hooks/use-mobile";
import AppPageHeader from "@/components/AppPageHeader";

import WelcomeChecklist from "@/components/WelcomeChecklist";
import UpdatesFeed from "@/components/UpdatesFeed";
import MinhasAtualizacoes from "@/components/MinhasAtualizacoes";
import AdminBannerMobile from "@/components/AdminBannerMobile";
import DooIAPanel from "@/components/DooIAPanel";
import { FinModal } from "@/components/financeiro";
import { ImageCropper } from "@/components/ui/ImageCropper";

interface AlertaCard {
  tipo: "pedido" | "entrega" | "aniversario";
  count: number;
  texto: string;
  detalhe?: string;
  cta: string;
  onClick: () => void;
}

interface ChartPoint { dia: string; valor: number; }

// Status atuais do app (+ os antigos, pra pedidos velhos). Antes faltavam "agendado", "aguardando_aceite",
// "finalizado"… e os pedidos sumiam de "Entregas hoje", "Próximas entregas" e "Atrasados" (30/09)
const STATUS_PENDENTES = ["aguardando_aceite", "aguardando_pagamento", "novo", "pendente"];
const STATUS_ATIVOS = ["aguardando_pagamento", "aguardando_aceite", "novo", "pendente", "agendado", "confirmado", "em_producao", "em_preparo", "finalizado", "pronto", "aguardando_retirada", "aguardando_entrega", "em_entrega", "a_caminho"];

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
  const isMobile = useIsMobile();
  const { profile, refetch: refetchProfile } = useProfile();

  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    pedidosPendentes: 0,
    entregasHoje: 0,
    aniversariantes: 0,
    faturamentoMes: 0,
    pedidosAtrasados: 0,
  });
  const [proximaEntregaHoje, setProximaEntregaHoje] = useState<{ cliente: string; hora: string; produto: string | null } | null>(null);
  const [aniversariantesDetalhe, setAniversariantesDetalhe] = useState<{ nome: string; dias: number } | null>(null);
  const [resumoSemana, setResumoSemana] = useState({ vendas: 0, pedidos: 0 });
  const [resumoAnterior, setResumoAnterior] = useState({ vendas: 0, pedidos: 0 });
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [proximasEntregas, setProximasEntregas] = useState<Array<{ id: string; cliente: string; data: string; valor: number; hora?: string | null }>>([]);
  // Onboarding: se cliente novo, o card destaque muda pra empty state contextual
  const [onboarding, setOnboarding] = useState({
    produtosCount: 0,
    clientesCount: 0,
    cardapioPublicado: false,
    loading: true,
  });
  const [checklistDone, setChecklistDone] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fotoRef = useRef<HTMLButtonElement>(null); // o menu da conta abre embaixo da foto
  const [email, setEmail] = useState("");

  // Upload rápido de foto de perfil pelo ícone de câmera no header.
  // Fluxo: escolhe arquivo → abre cropper (círculo, com zoom) → confirma → upload.
  // Reaproveita o mesmo bucket/path usado pela página Configurações.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reseta pra permitir escolher o MESMO arquivo depois
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Escolha um arquivo de imagem.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("A imagem precisa ter no máximo 10MB.");
      return;
    }
    // Converte pra data URL e abre o cropper
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCropDone = async (blob: Blob) => {
    if (!profile?.id) return;
    setCropSrc(null);
    setUploadingFoto(true);
    try {
      const path = `avatars/${profile.id}.jpg`; // cropper devolve JPEG
      const { error: upErr } = await supabase.storage
        .from("profiles")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
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
      const msg = err?.message || err?.error_description || "erro desconhecido";
      alert(`Não foi possível trocar a foto:\n\n${msg}\n\nAbra o console (F12) pra ver detalhes.`);
    } finally {
      setUploadingFoto(false);
    }
  };

  // Toggle "Ativar notificações" — pede permissão real do navegador.
  // Persistência + registro do SW ficam em lib/notifications.ts.
  const [notifAtivas, setNotifAtivas] = useState<boolean>(() => getStoredNotifState());
  const [notifLoading, setNotifLoading] = useState(false);
  const toggleAtivarNotif = async () => {
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

  // Sino do header agora abre o menu de opções (não notificações).
  // O hook useNotifications não é mais necessário aqui — o dropdown fica no Layout.

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


  const nome = profile?.nome || "";
  const slug = profile?.slug || "";
  const linkCardapio = slug ? `${window.location.origin}/cardapio/${slug}` : "";
  const publicado = !!slug;

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

  /**
   * Mensagem inteligente contextual — retorna a mais relevante do momento.
   * Ordem de prioridade:
   *  1. Pedidos atrasados (urgente)
   *  2. Próxima entrega hoje (com horário)
   *  3. Entregas de hoje (contagem)
   *  4. Aniversariante próximo
   *  5. Comparativo semanal (vendas subiram)
   *  6. Meta bateu (faturamento alto)
   *  7. Início de semana (segunda)
   *  8. Sexta-feira
   *  9. Fallback motivacional
   * Retorna { icon, prefix, highlight, suffix, tone } — tone define cor.
   */
  const getSmartMessage = (): { icon: string; prefix: string; highlight?: string; suffix?: string; tone: "danger" | "info" | "success" | "warning" | "neutral" } => {
    // 1. Pedidos atrasados
    if (counts.pedidosAtrasados > 0) {
      return {
        icon: "⚠️",
        prefix: "",
        highlight: `${counts.pedidosAtrasados} ${counts.pedidosAtrasados === 1 ? "pedido atrasado" : "pedidos atrasados"}`,
        suffix: " — precisa de atenção",
        tone: "danger",
      };
    }
    // 2. Próxima entrega hoje com horário
    if (proximaEntregaHoje) {
      const [hh, mm] = proximaEntregaHoje.hora.split(":").map(Number);
      const agora = new Date();
      const alvo = new Date();
      alvo.setHours(hh, mm || 0, 0, 0);
      const diffMs = alvo.getTime() - agora.getTime();
      const diffMin = Math.max(0, Math.floor(diffMs / 60000));
      if (diffMin > 0 && diffMin < 6 * 60) {
        const tempo = diffMin < 60 ? `${diffMin}min` : `${Math.floor(diffMin / 60)}h${diffMin % 60 > 0 ? ` ${diffMin % 60}min` : ""}`;
        return {
          icon: "⏰",
          prefix: "Próxima entrega em ",
          highlight: tempo,
          suffix: ` — ${proximaEntregaHoje.cliente}`,
          tone: "info",
        };
      }
    }
    // 3. Entregas de hoje
    if (counts.entregasHoje > 0) {
      return {
        icon: "📦",
        prefix: "Você tem ",
        highlight: `${counts.entregasHoje} ${counts.entregasHoje === 1 ? "entrega" : "entregas"}`,
        suffix: " hoje",
        tone: "info",
      };
    }
    // 4. Aniversariante próximo
    if (aniversariantesDetalhe) {
      const primeiroNome = aniversariantesDetalhe.nome.split(" ")[0];
      const quando = aniversariantesDetalhe.dias === 0 ? "hoje" : aniversariantesDetalhe.dias === 1 ? "amanhã" : `em ${aniversariantesDetalhe.dias} dias`;
      return {
        icon: "🎂",
        prefix: "",
        highlight: `${primeiroNome} faz aniversário`,
        suffix: ` ${quando}`,
        tone: "warning",
      };
    }
    // 5. Comparativo semanal (subiu)
    if (resumoAnterior.vendas > 0 && resumoSemana.vendas > resumoAnterior.vendas) {
      const pct = Math.round(((resumoSemana.vendas - resumoAnterior.vendas) / resumoAnterior.vendas) * 100);
      if (pct >= 5) {
        return {
          icon: "📈",
          prefix: "",
          highlight: `+${pct}%`,
          suffix: " em vendas vs semana passada",
          tone: "success",
        };
      }
    }
    // 6. Meta bateu (faturamento alto)
    if (resumoSemana.vendas >= 1000) {
      return {
        icon: "🎉",
        prefix: "Você faturou ",
        highlight: formatCurrency(resumoSemana.vendas),
        suffix: " essa semana!",
        tone: "success",
      };
    }
    // 7. Segunda-feira
    const diaSemana = new Date().getDay();
    if (diaSemana === 1 && counts.entregasHoje === 0 && proximasEntregas.length > 0) {
      return {
        icon: "🚀",
        prefix: "Nova semana, ",
        highlight: `${proximasEntregas.length} ${proximasEntregas.length === 1 ? "pedido agendado" : "pedidos agendados"}`,
        tone: "info",
      };
    }
    // 8. Sexta-feira
    if (diaSemana === 5) {
      return {
        icon: "🎊",
        prefix: "Sextouu! ",
        highlight: "Bora fechar a semana",
        tone: "warning",
      };
    }
    // 9. Fallback — mensagem motivacional (rotativa por dia)
    return {
      icon: "✨",
      prefix: getDailyMessage(),
      tone: "neutral",
    };
  };

  // Detecta plano PRO ativo (mostra a coroinha)
  const isPro = (() => {
    if (profile?.plano !== "pro") return false;
    if (!profile.pro_expira_em) return true;
    return new Date(profile.pro_expira_em) > new Date();
  })();

  const hojeFormatado = () => {
    const d = new Date();
    const s = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  // ─── Carregar dados ───
  useEffect(() => {
    if (!profile?.id) return;
    carregarTudo();
  }, [profile?.id]);

  // Onboarding: verifica se cliente é novo (sem produtos/clientes/cardápio publicado)
  // pra mostrar empty state contextual em vez do "Novo pedido" como destaque
  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const [prodRes, cliRes] = await Promise.all([
        supabase.from("produtos").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
      ]);
      setOnboarding({
        produtosCount: prodRes.count || 0,
        clientesCount: cliRes.count || 0,
        // Cardápio "publicado" = tem código público (gerado no cadastro) + nome_loja preenchido
        cardapioPublicado: !!(profile.codigo_publico && profile.nome_loja),
        loading: false,
      });
    })();
  }, [profile?.id, profile?.codigo_publico, profile?.nome_loja]);

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
        pedidosAtrasadosRes,
        proximaEntregaHojeRes,
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
          .select("id, cliente_nome, data_entrega, valor_total, horario_entrega")
          .eq("user_id", userId)
          .gte("data_entrega", hojeISO)
          .in("status", STATUS_ATIVOS)
          .order("data_entrega", { ascending: true })
          .limit(4),
        // Pedidos atrasados: data passou e ainda não ficou pronto (regra única em lib/pedidoStatus)
        supabase
          .from("pedidos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .lt("data_entrega", hojeISO)
          .in("status", STATUS_AINDA_NAO_PRONTO),
        // Próxima entrega HOJE com horário (pra "próxima em Xh")
        supabase
          .from("pedidos")
          .select("cliente_nome, horario_entrega, data_entrega")
          .eq("user_id", userId)
          .eq("data_entrega", hojeISO)
          .in("status", STATUS_ATIVOS)
          .not("horario_entrega", "is", null)
          .order("horario_entrega", { ascending: true })
          .limit(1),
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
        pedidosAtrasados: pedidosAtrasadosRes.count || 0,
      });
      const proxHoje = proximaEntregaHojeRes.data?.[0];
      setProximaEntregaHoje(proxHoje ? {
        cliente: proxHoje.cliente_nome || "Cliente",
        hora: proxHoje.horario_entrega,
        produto: null,
      } : null);
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
          hora: p.horario_entrega || null,
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
      onClick: () => navigate("/pedidos?filtro=aguardando"),
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
    <>
    {/* AppPageHeader removido — hero rosa já é suficiente como saudação */}
    <div className="ini-root">
      {/* ── Hero wine com foto da confeiteira, coroinha (PRO) e sparkles ── */}
      <div className="ini-hero">
        {/* Fundo mobile: ondas vinho (fica recortado pelo border-radius do hero) */}
        <div className="ini-hero-bg" aria-hidden="true">
          <svg className="ini-hero-waves" viewBox="0 0 390 125" preserveAspectRatio="none">
            <path d="M84 125 C 140 116, 196 101, 232 84 S 300 64, 390 58 L 390 125 Z" fill="#4F1E2C" />
            <path d="M232 125 C 250 112, 268 90, 292 76 S 350 58, 390 54 L 390 125 Z" fill="#5B2533" />
          </svg>
        </div>
        {/* Decoração: sparkles brancos sutis sobre o hero rosa */}
        <svg className="ini-hero-sparkles" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true">
          <g fill="#FFFFFF" opacity="0.5">
            <path d="M18 12 L18.4 13.3 L19.7 13.7 L18.4 14.1 L18 15.4 L17.6 14.1 L16.3 13.7 L17.6 13.3 Z"/>
            <path d="M88 8 L88.5 9.6 L90.1 10.1 L88.5 10.6 L88 12.2 L87.5 10.6 L85.9 10.1 L87.5 9.6 Z"/>
            <path d="M62 22 L62.3 22.9 L63.2 23.2 L62.3 23.5 L62 24.4 L61.7 23.5 L60.8 23.2 L61.7 22.9 Z"/>
            <path d="M40 6 L40.3 6.9 L41.2 7.2 L40.3 7.5 L40 8.4 L39.7 7.5 L38.8 7.2 L39.7 6.9 Z"/>
            <path d="M75 30 L75.3 30.9 L76.2 31.2 L75.3 31.5 L75 32.4 L74.7 31.5 L73.8 31.2 L74.7 30.9 Z"/>
            <path d="M95 38 L95.3 38.9 L96.2 39.2 L95.3 39.5 L95 40.4 L94.7 39.5 L93.8 39.2 L94.7 38.9 Z"/>
          </g>
        </svg>

        {/* Foto da confeiteira — no mobile abre menu, no desktop abre seletor de foto */}
        <div className="ini-profile-wrapper" data-has-photo={profile?.foto_url ? "true" : "false"}>
          <button
            ref={fotoRef}
            className="ini-profile-btn"
            onClick={() => {
              if (window.innerWidth < 768) {
                setMenuOpen(o => !o);
              } else if (!uploadingFoto) {
                fileInputRef.current?.click();
              }
            }}
            aria-label={window.innerWidth < 768 ? "Abrir o menu da conta" : (profile?.foto_url ? "Trocar a foto" : "Colocar uma foto")}
            title={window.innerWidth < 768 ? "Menu da conta" : (profile?.foto_url ? "Trocar a foto" : "Colocar uma foto")}
            disabled={uploadingFoto}
          >
            {profile?.foto_url
              ? <img src={profile.foto_url} alt="" className="ini-profile-img" />
              : <div className="ini-profile-placeholder"><span className="ini-profile-inicial">{(nome || "?").trim().charAt(0).toUpperCase()}</span></div>
            }
          </button>

          {/* Badge de câmera — só quando NÃO tem foto (ou durante upload) */}
          {(!profile?.foto_url || uploadingFoto) && (
          <button
            type="button"
            className="ini-profile-cam"
            onClick={(e) => {
              e.stopPropagation();
              if (!uploadingFoto) fileInputRef.current?.click();
            }}
            aria-label="Colocar uma foto"
            title="Colocar uma foto"
            disabled={uploadingFoto}
            tabIndex={-1}
          >
            {uploadingFoto
              ? <span className="ini-profile-cam-spinner" />
              : <Camera size={16} weight="bold" />}
          </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelected}
            style={{ display: "none" }}
          />
        </div>

        {/* Texto da saudação */}
        <div className="ini-hero-greeting">
          <h1>
            <span>
              Olá,{" "}
              {profile ? (
                // 02/10: o nome da confeitaria (o pessoal só se a loja ainda não tiver nome)
                ((profile as any).nome_loja?.trim() || (nome ? nome.split(" ")[0] : "!"))
              ) : (
                <span className="ini-hero-name-skel" aria-hidden="true" />
              )}
            </span>
            {profile && (
              isPro ? (
                <span className="ini-plan-tag ini-plan-tag--pro" aria-label="Plano PRO">
                  <img src="/coroa.png" alt="" />
                  <span>PRO</span>
                </span>
              ) : (
                <button
                  type="button"
                  className="ini-plan-tag ini-plan-tag--upgrade"
                  onClick={() => navigate("/assinar")}
                  aria-label="Assinar o plano PRO"
                >
                  <img src="/coroa.png" alt="" />
                  <span>Seja PRO</span>
                </button>
              )
            )}
          </h1>
          {/* Data — só mobile (embaixo do nome) */}
          <p className="ini-hero-data-mobile">{hojeFormatado()}</p>
          {(() => {
            const msg = getSmartMessage();
            return (
              <p className={`ini-hero-msg ini-hero-msg--${msg.tone}`}>
                <span className="ini-hero-msg-icon" aria-hidden="true">{msg.icon}</span>
                {msg.prefix && <span>{msg.prefix}</span>}
                {msg.highlight && <span className="ini-hero-msg-hl">{msg.highlight}</span>}
                {msg.suffix && <span>{msg.suffix}</span>}
              </p>
            );
          })()}
        </div>

        {/* Menu da foto: o mesmo de todas as telas (07/10 · 2.98) */}
        <MenuConta aberto={menuOpen} aoFechar={() => setMenuOpen(false)} ancora={fotoRef} />
      </div>

      {/* ══ Computador (≥1100px): topo rosa com o resumo do dia + números (30/09) ══ */}
      {(() => {
        const hojeISO = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
        const aReceberHoje = proximasEntregas.filter(e => e.data === hojeISO).reduce((s, e) => s + e.valor, 0);
        const proxHora = proximasEntregas.find(e => e.data === hojeISO && e.hora)?.hora;
        const partes: string[] = [];
        if (counts.entregasHoje > 0) partes.push(`${counts.entregasHoje} ${counts.entregasHoje === 1 ? "entrega" : "entregas"} hoje`);
        if (counts.pedidosAtrasados > 0) partes.push(`${counts.pedidosAtrasados} ${counts.pedidosAtrasados === 1 ? "pedido atrasado" : "pedidos atrasados"}`);
        if (aReceberHoje > 0) partes.push(`${formatCurrency(aReceberHoje)} em entregas hoje`);
        return (
          <div className="ini-dk">
            <div className="ini-dk-top">
              <div className="ini-dk-txt">
                <h1>Seu dia hoje</h1>
                <p>{loading ? "Carregando…" : partes.length ? partes.join(" · ") : "Nenhuma entrega hoje · aproveite pra divulgar seu cardápio"}</p>
              </div>
              <div className="ini-dk-bts">
                <button type="button" className="ini-dk-bt ini-dk-bt--1" onClick={() => navigate("/vendas/novo")}><Plus size={16} weight="bold" /> Nova venda</button>
                <button type="button" className="ini-dk-bt ini-dk-bt--2" onClick={() => navigate("/agenda")}><CalendarDots size={16} weight="bold" /> Ver agenda</button>
              </div>
            </div>
            <div className="ini-dk-kpis">
              <div className="ini-dk-kpi ini-dk-kpi--dest">
                <div className="ini-dk-kh"><span><CurrencyDollar size={17} weight="duotone" /></span>Faturamento do mês</div>
                <b>{loading ? "—" : formatCurrency(counts.faturamentoMes)}</b><small>Acompanhe sua evolução</small>
              </div>
              <div className="ini-dk-kpi">
                <div className="ini-dk-kh"><span><Receipt size={17} weight="duotone" /></span>Pedidos na semana</div>
                <b>{loading ? "—" : resumoSemana.pedidos}</b><small>últimos 7 dias</small>
              </div>
              <div className="ini-dk-kpi">
                <div className="ini-dk-kh"><span><CalendarDots size={17} weight="duotone" /></span>Entregas hoje</div>
                <b>{loading ? "—" : counts.entregasHoje}</b><small>{proxHora ? `próxima às ${String(proxHora).slice(0, 5)}` : "para entregar"}</small>
              </div>
              <div className="ini-dk-kpi">
                <div className="ini-dk-kh"><span><ChartLineUp size={17} weight="duotone" /></span>Ticket médio</div>
                <b>{loading ? "—" : formatCurrency(resumoSemana.pedidos ? resumoSemana.vendas / resumoSemana.pedidos : 0)}</b><small>por pedido na semana</small>
              </div>
            </div>
          </div>
        );
      })()}

      <div className={`ini-content ${checklistDone ? "ini-content--done" : ""}`}>
        {/* ── Coluna principal ── */}
        <div className="ini-main">

      {/* ── Primeiros passos (02/10) — some quando ela termina.
             (07/10 · 2.94) Passou a aparecer em todos os aparelhos: é o único guia depois das boas-vindas (o tour saiu). ── */}
      <section className="ini-section ini-section--checklist-top ini-pp">
        <PrimeirosPassos />
      </section>

      {/* ── WelcomeChecklist (temporariamente oculto — reservado pra futuro prêmio) ── */}
      {false && profile?.id && !checklistDone && (
        <section className="ini-section ini-section--checklist-top">
          <WelcomeChecklist userId={profile.id} onAllDone={setChecklistDone} />
        </section>
      )}

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
        {/* Título da grade — muda de "Acesso rápido" pra "Explorar" durante onboarding */}
        <h2 className="ini-section-title">
          {!onboarding.loading && onboarding.produtosCount === 0 ? "Explorar" : "Acesso rápido"}
        </h2>

        {/* Hero Nova Venda — destaque principal */}
        <button className="ini-hero-cta" onClick={() => navigate("/vendas/novo")}>
          <div className="ini-hero-cta-ic">
            {isMobile
              ? <span className="ini-hero-cta-plus"><Plus size={14} weight="bold" /></span>
              : <ShoppingBag size={22} weight="fill" />}
          </div>
          <div className="ini-hero-cta-txt">
            <div className="ini-hero-cta-t">Nova Venda</div>
            <div className="ini-hero-cta-d">Comece um pedido em segundos</div>
          </div>
          {isMobile && <img src="/nova-venda-sacola.svg" alt="" aria-hidden="true" className="ini-hero-cta-bag" />}
          <CaretRight size={18} weight="bold" className="ini-hero-cta-arr" />
        </button>

        <div className="ini-nav-grid">
          {[
            { icon: <Receipt        size={22} weight="bold" />, iconM: <ClipboardText size={26} weight="bold" />, label: "Pedidos",    sub: "Gerencie seus pedidos.",                     subM: "Gerencie seus pedidos.",                     path: "/pedidos",       key: "pedidos" },
            { icon: <CalendarDots   size={22} weight="bold" />, iconM: <CalendarDots  size={26} weight="bold" />, label: "Agenda",     sub: "Seus agendamentos.",                         subM: "Seus agendamentos.",                         path: "/agenda",        key: "agenda" },
            { icon: <BookOpen       size={22} weight="bold" />, iconM: <Cake          size={26} weight="fill" />, label: "Cardápio",   sub: "Acesse seu cardápio e produtos.",            subM: "Ajuste seu cardápio e preços.",              path: "/cardapio",      key: "cardapio" },
            { icon: <Users          size={22} weight="bold" />, iconM: <Users         size={26} weight="fill" />, label: "Clientes",   sub: "Gerencie seus clientes.",                    subM: "Gerencie seus clientes.",                    path: "/clientes",      key: "clientes" },
            { icon: <CurrencyDollar size={22} weight="bold" />, iconM: <ChartBar      size={26} weight="fill" />, label: "Financeiro", sub: "Controle suas entradas, saídas e lucros.",   subM: "Controle suas entradas, saídas e lucros.",   path: "/financeiro",    key: "financeiro" },
            { icon: <Cake           size={22} weight="bold" />, iconM: <Cube          size={26} weight="fill" />, label: "Produtos",   sub: "Cadastre e edite seus produtos e receitas.", subM: "Cadastre e edite seus produtos e receitas.", path: "/produtos",      key: "produtos" },
            { icon: <Calculator     size={22} weight="bold" />, iconM: <Calculator    size={26} weight="fill" />, label: "Ficha técnica", sub: "Calcule o custo real.",   subM: "Calcule o custo e o lucro de cada produto.", path: "/ficha-tecnica", key: "ficha" },
            { icon: <Gear           size={22} weight="bold" />, iconM: <Gear          size={26} weight="fill" />, label: "Ajustes",    sub: "Personalize o app e suas preferências.",     subM: "Personalize o app e suas preferências.",     path: "/configuracoes", key: "configuracoes" },
          ].map((item) => (
            <button key={item.path} className="ini-nav-card" data-nav={item.key} onClick={() => navigate(item.path)}>
              <div className="ini-nav-icon">{isMobile ? item.iconM : item.icon}</div>
              <div className="ini-nav-meta">
                <span className="ini-nav-label">{item.label}</span>
                <span className="ini-nav-sub">{isMobile ? item.subM : item.sub}</span>
              </div>
              <CaretRight size={14} weight="bold" className="ini-nav-arrow" />
            </button>
          ))}
        </div>
      </section>

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
            <div className="ini-resumo-icon" style={{ background: "#FFF1F7", color: "var(--text-title)" }}>
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
          {(() => {
            const temDados = chartData.some(d => (d.valor || 0) > 0);
            return (
              <div className="ini-chart-inner" style={{ width: "100%", height: 220, position: "relative" }}>
                <div style={{ width: "100%", height: "100%", filter: temDados ? "none" : "blur(6px)", opacity: temDados ? 1 : 0.4, pointerEvents: temDados ? "auto" : "none", transition: "filter 0.3s ease" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={temDados ? chartData : chartData.map((d, i) => ({ ...d, valor: 100 + Math.sin(i / 3) * 40 + i * 4 }))} margin={{ top: 8, right: 10, bottom: 0, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval={4} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `R$${v}`} />
                      {temDados && (
                        <Tooltip
                          contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, fontFamily: "Geist,sans-serif" }}
                          formatter={(v: any) => [formatCurrency(Number(v)), "Faturamento"]}
                        />
                      )}
                      <Line type="monotone" dataKey="valor" stroke="var(--text-title)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "var(--text-title)" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {!temDados && (
                  <div className="ini-chart-overlay">
                    <img src="/financeiro.png" alt="" className="ini-chart-overlay-icon" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <p className="ini-chart-overlay-text">
                      Seu faturamento vai aparecer aqui quando sair o <strong>primeiro pedido</strong>
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </section>
        </div>

        {/* ── Sidebar (desktop): DooIA sempre ── */}
        <aside className="ini-aside">
          <div className="ini-aside-desktop"><DooIAPanel /></div>
          {/* Computador: conquistas, próximas entregas e atualizações (30/09) */}
          <div className="ini-dk-side">
            <ConquistasCard />
            <div className="ini-dk-card">
              <div className="ini-dk-ct"><span>Próximas entregas</span><button type="button" onClick={() => navigate("/agenda")}>Ver agenda ›</button></div>
              {proximasEntregas.length === 0 ? (
                <p className="ini-dk-vazio">Nenhuma entrega marcada. Os próximos pedidos aparecem aqui.</p>
              ) : proximasEntregas.map(e => {
                const d = new Date(e.data + "T12:00:00");
                const mes = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
                const quando = d.toLocaleDateString("pt-BR", { weekday: "long" });
                return (
                  <button type="button" key={e.id} className="ini-dk-en" onClick={() => navigate(`/pedidos/${e.id}`)}>
                    <span className="ini-dk-dt"><b>{String(d.getDate()).padStart(2, "0")}</b><small>{mes}</small></span>
                    <span className="ini-dk-ei"><b>{e.cliente}</b><small>{quando.charAt(0).toUpperCase() + quando.slice(1)}{e.hora ? ` às ${String(e.hora).slice(0, 5)}` : ""}</small></span>
                    <span className="ini-dk-ev">{formatCurrency(e.valor)}</span>
                  </button>
                );
              })}
            </div>
            <MinhasAtualizacoes />
          </div>
        </aside>

        {/* ── Banner promocional (admin configura) ── */}
        <div className="ini-mobile-banner"><AdminBannerMobile /></div>

        {/* ── Últimas atualizações (mobile) — sempre visível ── */}
        <div className="ini-mobile-updates"><MinhasAtualizacoes /></div>
        <div className="ini-mobile-updates"><UpdatesFeed /></div>
        {/* Conquistas por último (02/10) */}
        <div className="ini-mobile-updates ini-mobile-conquistas"><ConquistasCard /></div>

        {/* ── Engajamento (Play Store + Instagram) — temporariamente removido ── */}
        {false && (
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
          position: relative;
        }

        /* ── Layout 2 colunas ── */
        .ini-content {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          margin-top: var(--space-4);
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

        /* ── Hero rosa chapado com foto da confeiteira e sparkles ── */
        .ini-hero {
          background: var(--primary);
          border-radius: 0 0 24px 24px;
          padding: 1.25rem 1.25rem 1.25rem 1.75rem;
          /* Full-bleed: estende até a borda da viewport ignorando padding dos pais */
          width: 100vw;
          margin-left: calc(50% - 50vw);
          margin-right: calc(50% - 50vw);
          margin-top: calc(-1 * (var(--pad-page-top) + env(safe-area-inset-top, 0px)));
          padding-top: calc(1.3rem + env(safe-area-inset-top, 0px));
          display: flex;
          flex-direction: row-reverse;
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
          display: flex; align-items: center; gap: 8px;
          font-size: 1.25rem; font-weight: var(--fw-black);
          color: #fff;
          margin: 0; line-height: 1.2;
          letter-spacing: -0.02em;
          min-height: 1.5rem; /* reserva espaço antes do nome carregar */
          min-width: 0; /* permite encolher pra fazer ellipsis */
        }
        .ini-hero-greeting h1 > span:first-child {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
          flex: 0 1 auto;
        }
        .ini-hero-greeting h1 > .ini-hero-pro-badge {
          flex-shrink: 0;
        }
        .ini-hero-pro-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: var(--accent);
          color: #fff;
          padding: 3px 10px;
          border-radius: 6px;
          font-size: 10.5px;
          font-weight: var(--fw-black, 800);
          letter-spacing: 0.05em;
          text-transform: uppercase;
          box-shadow: 0 2px 6px rgba(0,0,0,0.28);
          flex-shrink: 0;
          line-height: 1;
        }
        .ini-hero-pro-coroa {
          width: 13px;
          height: 13px;
          object-fit: contain;
        }



        .ini-hero-data-mobile {
          font-size: 0.78rem;
          color: rgba(255, 255, 255, 0.85);
          margin: 4px 0 0;
          font-weight: 500;
          line-height: 1.3;
          letter-spacing: 0.01em;
        }
        @media (min-width: 768px) {
          .ini-hero-data-mobile { display: none; }
        }

        /* ── Mensagem contextual embaixo do nome (hero mobile) ── */
        .ini-hero-msg {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.85rem;
          line-height: 1.35;
          color: rgba(255, 255, 255, 0.9);
          flex-wrap: wrap;
        }
        /* Esconder mensagem no mobile (desktop mantém) */
        @media (max-width: 767.98px) {
          .ini-hero-msg { display: none !important; }
        }
        .ini-hero-msg-icon {
          font-size: 0.95rem;
          line-height: 1;
        }
        .ini-hero-msg-hl {
          font-weight: 800;
          color: #FFFFFF;
        }
        .ini-hero-msg--danger .ini-hero-msg-hl { color: #FDA5A5; }
        .ini-hero-msg--success .ini-hero-msg-hl { color: #A7F3C4; }
        .ini-hero-msg--warning .ini-hero-msg-hl { color: #FFE58C; }
        .ini-hero-msg--info .ini-hero-msg-hl { color: #FFFFFF; }
        .ini-hero-msg--neutral { color: rgba(255, 255, 255, 0.85); }

        /* Skeleton do nome enquanto carrega — evita flash de "bem-vinda" grande */
        .ini-hero-name-skel {
          display: inline-block;
          width: 100px;
          height: 0.9em;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          animation: iniHeroSkelPulse 1.4s ease-in-out infinite;
          vertical-align: -0.05em;
        }
        @keyframes iniHeroSkelPulse {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 0.65; }
        }

        /* ── Sino de notificações no hero ── */
        /* ── Wrap da métrica sobreposta ao hero ── */
        .ini-metrica-wrap {
          padding: 0 8px;
          margin-top: -20px;
          position: relative;
          z-index: 20;
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
          width: 56px; height: 56px; border-radius: var(--radius-full);
          border: 3px solid #FFFFFF;
          background: #FFFFFF;
          cursor: pointer; padding: 0; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          transition: border-color var(--dur-fast), transform var(--dur-fast), box-shadow var(--dur-fast);
          box-shadow: 0 6px 20px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.15);
        }
        /* Quando NÃO tem foto, o botão inteiro vira rosa vinho */
        .ini-profile-wrapper[data-has-photo="false"] .ini-profile-btn {
          background: #993556;
        }
        .ini-profile-btn:hover { transform: scale(1.04); box-shadow: 0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.2); }
        .ini-profile-img { width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-full); }
        .ini-profile-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
        .ini-profile-inicial {
          font-family: var(--font-base);
          font-size: 26px;
          font-weight: 900;
          color: #FCE0E9;
          letter-spacing: -0.02em;
          line-height: 1;
          text-transform: uppercase;
        }

        /* Badge de câmera — atalho pra trocar/adicionar foto */
        .ini-profile-cam {
          position: absolute;
          bottom: -2px; right: -2px;
          width: 24px; height: 24px;
          border-radius: var(--radius-full);
          background: var(--primary);
          border: 2px solid #FFFFFF;
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          padding: 0;
          box-shadow: 0 2px 6px rgba(45,31,38,0.35);
          transition: transform var(--dur-fast), background var(--dur-fast);
          z-index: 2;
        }
        /* Câmera some COMPLETAMENTE quando já tem foto (mobile + desktop) */
        .ini-profile-wrapper[data-has-photo="true"] .ini-profile-cam {
          display: none !important;
          visibility: hidden !important;
        }
        /* Câmera some no desktop mesmo sem foto (avatar é grande, não precisa) */
        @media (min-width: 768px) {
          .ini-profile-cam {
            display: none !important;
            visibility: hidden !important;
          }
        }

        /* Tags PRO / Upgrade — ao lado do nome (mobile + desktop) */
        .ini-plan-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          border-radius: 6px;
          font-family: var(--font-base);
          font-size: 10.5px;
          font-weight: 900;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-left: 4px;
          vertical-align: middle;
          white-space: nowrap;
          border: none;
          line-height: 1;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(0,0,0,0.28);
        }
        .ini-plan-tag img {
          width: 13px;
          height: 13px;
          object-fit: contain;
          display: block;
        }
        /* Variante PRO (não clicável) — preta/accent, coroa colorida original */
        .ini-plan-tag--pro {
          background: var(--accent);
          color: #fff;
          cursor: default;
        }
        /* Variante Upgrade (clicável) — grafite com coroa dourada (premium) */
        .ini-plan-tag--upgrade {
          background: #2C1219;
          color: #fff;
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.15s ease;
          font-family: var(--font-base);
          font-size: 9.5px;
          padding: 3px 9px;
          gap: 3px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        }
        .ini-plan-tag--upgrade img {
          width: 11px;
          height: 11px;
        }
        .ini-plan-tag--upgrade:hover {
          transform: translateY(-1px);
          background: #3D1A24;
          box-shadow: 0 4px 10px rgba(0,0,0,0.4);
        }
        .ini-plan-tag--upgrade:active {
          transform: translateY(0);
        }
        /* Desktop: mais respiro entre nome e tag */
        @media (min-width: 768px) {
          .ini-plan-tag {
            margin-left: 12px;
            font-size: 11.5px;
            padding: 4px 11px;
          }
          .ini-plan-tag img { width: 14px; height: 14px; }
          .ini-plan-tag--upgrade {
            font-size: 10.5px;
            padding: 3px 10px;
          }
          .ini-plan-tag--upgrade img { width: 12px; height: 12px; }
        }

        .ini-profile-cam:hover:not(:disabled) { transform: scale(1.12); background: var(--primary-dark); }
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
          z-index: 200;
          overflow: hidden;
          animation: iniMenuIn var(--dur-fast) var(--ease-out);
        }

        /* Variante à direita — quando o menu abre a partir do sino.
           Usa position:fixed pra escapar do stacking context do hero,
           garantindo que fica acima de qualquer card sobreposto. */
        .ini-profile-menu--right {
          position: fixed;
          top: calc(env(safe-area-inset-top, 0px) + 68px);
          right: 12px;
          left: auto;
          z-index: 9999;
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
        .ini-pm-toggle--on { background: var(--primary); }
        .ini-pm-toggle--on .ini-pm-toggle-thumb { transform: translateX(16px); }

        /* ── Sections ── */
        .ini-section {
          margin-top: var(--gap-section);
          display: flex; flex-direction: column; gap: var(--gap-stack);
        }

        /* ── Empty state hero: aparece só no mobile quando produtosCount = 0 ── */
        .ini-empty-hero {
          width: 100%;
          background: linear-gradient(135deg, #FFF1F7, #FCE7F3);
          border: 2px dashed #F9A8D4;
          border-radius: var(--radius-lg);
          padding: 22px 16px 20px;
          text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          cursor: pointer;
          font-family: var(--font-base);
          transition: transform var(--dur-fast), box-shadow var(--dur-fast);
        }
        .ini-empty-hero:active {
          transform: scale(0.98);
        }
        .ini-empty-hero-label {
          font-size: var(--text-xs);
          font-weight: var(--fw-black);
          color: var(--primary-dark);
          letter-spacing: 0.06em;
        }
        .ini-empty-hero-icon {
          font-size: 40px;
          line-height: 1;
          margin: 4px 0;
        }
        .ini-empty-hero-title {
          font-size: var(--text-lg);
          font-weight: var(--fw-black);
          color: var(--text-title);
          letter-spacing: -0.01em;
        }
        .ini-empty-hero-sub {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          line-height: 1.4;
          padding: 0 8px;
          margin-bottom: 6px;
        }
        .ini-empty-hero-btn {
          background: var(--primary);
          color: #fff;
          padding: 10px 22px;
          border-radius: 999px;
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          box-shadow: 0 4px 12px rgba(232,90,140,0.3);
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
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .ini-nav-card {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 0;
          padding: 14px 26px 12px 12px;
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          min-height: 84px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          transition: transform var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out);
          overflow: hidden;
        }
        .ini-nav-card:active { transform: scale(0.98); background: #FAF7F8; }
        .ini-nav-icon {
          position: absolute;
          left: 0; top: 0;
          width: 26px; height: 26px;
          border-radius: 0 0 8px 0;
          background: #F5F0F2 !important;
          color: #2C1219 !important;
          display: flex !important;
          align-items: center;
          justify-content: center;
          filter: none;
          margin-top: 0;
        }
        .ini-nav-icon svg { width: 13px; height: 13px; }
        .ini-nav-meta {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .ini-nav-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: #2C1219;
          line-height: 1.2;
          margin-top: 20px;
        }
        .ini-nav-sub {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 10.5px;
          color: #9CA3AF;
          line-height: 1.4;
        }
        .ini-nav-arrow {
          position: absolute;
          top: 8px;
          right: 10px;
          color: #C0B3B8;
          font-weight: 700;
          font-size: 12px;
          margin: 0;
        }
        /* Remove destaque Nova Venda — todos iguais */
        .ini-nav-card[data-nav="nova-venda"] {
          background: #fff;
          border-color: #F0EBED;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }
        .ini-nav-card[data-nav="nova-venda"]:active {
          background: #FAF7F8;
          transform: scale(0.98);
        }
        .ini-nav-card[data-nav="nova-venda"] .ini-nav-icon {
          background: #F5F0F2 !important;
          color: #2C1219 !important;
          filter: none;
        }
        .ini-nav-card[data-nav="nova-venda"] .ini-nav-label { color: #2C1219; }
        .ini-nav-card[data-nav="nova-venda"] .ini-nav-sub { color: #9CA3AF; }
        .ini-nav-card[data-nav="nova-venda"] .ini-nav-arrow { color: #C0B3B8; }

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
          background: var(--primary-light);
          border: 1.5px solid #F8C4D5;
          border-radius: var(--radius-lg);
        }
        .ini-tudo-ok-icon {
          width: 40px; height: 40px;
          border-radius: 50%;
          background: var(--primary);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 3px 0 var(--primary-dark);
          flex-shrink: 0;
        }
        .ini-tudo-ok-title { margin: 0; font-weight: var(--fw-bold); color: var(--text-title); font-size: var(--font-body); }
        .ini-tudo-ok-sub { margin: var(--space-1) 0 0; font-size: var(--font-helper); color: var(--text-secondary); }

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
        /* Esconde wrappers vazios (quando componente retorna null) — evita gap fantasma */
        .ini-mobile-banner:empty,
        .ini-mobile-updates:empty { display: none; }
        /* Nível 1: filhos diretos de .ini-content */
        .ini-aside          { order: 99; }
        .ini-main           { order: 2; display: flex; flex-direction: column; }
        .ini-mobile-banner  { order: 3; }
        .ini-mobile-updates { order: 4; }
        .ini-engaja         { order: 5; }
        /* Nível 2: seções dentro de .ini-main */
        .ini-section--checklist-top { order: 0; margin-top: var(--space-3); }
        .ini-pp:empty { display: none; }
        .ini-section--alertas { order: 1; }
        .ini-section--nav     { order: 2; }

        /* ═════ Hero Nova Venda (CTA de destaque) ═════ */
        .ini-hero-cta {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: linear-gradient(135deg, #E85A8C 0%, #C33A6E 100%);
          border-radius: 14px;
          color: #fff;
          margin-bottom: 10px;
          box-shadow: 0 8px 20px rgba(232,90,140,0.32);
          position: relative;
          overflow: hidden;
          border: none;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          width: 100%;
          transition: transform 0.15s ease;
        }
        .ini-hero-cta:active { transform: scale(0.98); }
        .ini-hero-cta::before {
          content: '🛍️';
          position: absolute;
          right: -14px;
          bottom: -22px;
          font-size: 100px;
          opacity: 0.14;
          line-height: 1;
          pointer-events: none;
        }
        .ini-hero-cta-ic {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: rgba(255,255,255,0.22);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
          z-index: 1;
          color: #fff;
        }
        .ini-hero-cta-txt { flex: 1; z-index: 1; }
        .ini-hero-cta-t { font-size: 16px; font-weight: 900; line-height: 1.15; }
        .ini-hero-cta-d { font-size: 11.5px; opacity: 0.9; margin-top: 2px; }
        .ini-hero-cta-arr { color: #fff; opacity: 0.9; z-index: 1; flex-shrink: 0; }

        .ini-section--resumo  { display: none; }
        .ini-section--agenda  { display: none; }
        .ini-section--metrics { display: none; }
        .ini-section--chart   { display: none; }
        /* Menos espaço vazio entre MetricaDestaque e Acesso rápido no mobile */
        .ini-content { margin-top: var(--space-2); gap: var(--space-6); }
        .ini-main > .ini-section:first-child { margin-top: var(--space-3); }

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
          .ini-root {
            max-width: none;
            padding-left: 36px;
            padding-right: 80px;
            padding-top: var(--space-6);
          }

          /* Hero rosa escondido no desktop — layout limpo sem faixa colorida */
          .ini-hero { display: none; }

          /* ── Card de métrica em destaque: escondido no desktop
             (os 4 cards de métrica abaixo já mostram Faturamento — evita redundância) ── */
          .ini-metrica-wrap {
            display: none;
          }

          /* ── Hover consistente nos cards de "Acesso rápido" ── */
          .ini-nav-card:hover {
            background: var(--primary-light);
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(232, 90, 140, 0.18);
            border: 1.5px solid var(--primary);
          }
          .ini-nav-card {
            border: 1.5px solid transparent;
            transition: background var(--dur-fast) var(--ease-out),
                        transform var(--dur-fast) var(--ease-out),
                        box-shadow var(--dur-fast) var(--ease-out),
                        border-color var(--dur-fast) var(--ease-out) !important;
          }
          .ini-nav-card:hover .ini-nav-icon {
            transform: scale(1.05);
            transition: transform var(--dur-fast) var(--ease-out);
          }
          .ini-nav-card:hover .ini-nav-arrow {
            color: var(--primary) !important;
            transform: translateX(3px);
          }
          .ini-nav-card:active { transform: translateY(0); }

          /* ═══ Overlay do gráfico (sem dados ainda) ═══ */
          .ini-chart-card {
            position: relative;
            overflow: hidden;
          }
          .ini-chart-overlay {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: var(--space-3);
            padding: var(--space-4);
            text-align: center;
            background: linear-gradient(180deg, rgba(255,255,255,0.7), rgba(252,224,233,0.5));
            backdrop-filter: blur(2px);
            pointer-events: none;
            z-index: 2;
          }
          .ini-chart-overlay-icon {
            width: 88px;
            height: 88px;
            object-fit: contain;
            opacity: 0.95;
            filter: drop-shadow(0 6px 16px rgba(232, 90, 140, 0.35));
          }
          .ini-chart-overlay-text {
            font-size: var(--text-md);
            color: var(--text-title);
            font-weight: var(--fw-semibold);
            line-height: 1.5;
            max-width: 420px;
            margin: 0;
          }
          .ini-chart-overlay-text strong {
            color: var(--primary);
            font-weight: var(--fw-black);
          }
          /* Desktop: sem empty state hero (confeiteira que sabe usar PC não precisa) */
          .ini-empty-hero { display: none !important; }

          /* Card "Novo pedido" (rosa escuro) — mesmo movimento + escurecido */
          .ini-nav-card[data-nav="nova-venda"]:hover {
            background: var(--primary-dark);
            filter: brightness(0.9);
            transform: translateY(-2px);
            box-shadow: 0 6px 18px rgba(232, 90, 140, 0.35);
          }

          /* ── Remove outline preto ao clicar no gráfico ── */
          .ini-chart-card,
          .ini-chart-card *,
          .ini-chart-inner,
          .ini-chart-inner *,
          .recharts-wrapper,
          .recharts-surface {
            outline: none !important;
          }

          /* ── Grid principal: SÓ main no desktop (aside removido) ── */
          .ini-content {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            grid-template-areas: "main";
            gap: var(--space-6);
            align-items: start;
            margin-top: 0;
            width: 100%;
          }
          .ini-main  { grid-area: main; min-width: 0; width: 100%; }
          .ini-aside { display: none; }
          .ini-aside-desktop { display: none; }
          .ini-aside-mobile { display: none; }

          /* Empurra o conteúdo pra baixo */
          .ini-main .ini-section--metrics {
            margin-top: 0;
          }
          /* Updates e engajamento são exclusivos do mobile */
          .ini-mobile-updates { display: none; }
          .ini-mobile-banner { display: none; }
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
            grid-template-columns: 1fr 1fr 1fr 1fr;
            gap: var(--space-3);
          }
          .ini-main .ini-section--nav .ini-nav-card {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: var(--space-3) var(--space-4);
            background: #F5F0F2;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-family: inherit;
            text-align: left;
            transition: background var(--dur-fast) var(--ease-out),
                        transform var(--dur-fast) var(--ease-out);
          }
          .ini-main .ini-section--nav .ini-nav-card:hover {
            background: #EDE6E8;
            transform: none;
            box-shadow: none;
          }
          .ini-main .ini-section--nav .ini-nav-icon {
            width: 24px; height: 24px;
            border-radius: 4px;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
            background: transparent !important;
            color: #2C1219 !important;
          }
          /* Desktop também sem subtítulo/seta (igual mobile, mais simples) */
          .ini-main .ini-section--nav .ini-nav-sub { display: none; }
          .ini-main .ini-section--nav .ini-nav-arrow { display: none; }
          /* Nova Venda: card cinza escurinho (mesmo padrão do mobile) */
          .ini-main .ini-section--nav .ini-nav-card[data-nav="nova-venda"] {
            grid-column: auto;
            background: #E5DDE0;
          }
          .ini-main .ini-section--nav .ini-nav-card[data-nav="nova-venda"]:hover {
            background: #D8CFD1;
          }
          .ini-main .ini-section--nav .ini-nav-card[data-nav="nova-venda"] .ini-nav-icon {
            background: transparent !important;
            color: #2C1219 !important;
          }
          .ini-main .ini-section--nav .ini-nav-card[data-nav="nova-venda"] .ini-nav-label { color: #2C1219; }

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
             (aside removido — checklist não aparece mais no desktop)
             ──────────────────────────────────────────── */
          .ini-content--done {
            grid-template-columns: minmax(0, 1fr);
            grid-template-areas: "main";
          }
        }

        /* Telas largas: main continua ocupando tudo */
        @media (min-width: 1500px) {
          .ini-content { grid-template-columns: minmax(0, 1fr); }
          .ini-content--done { grid-template-columns: minmax(0, 1fr); }
        }

        /* Desktop (qualquer largura ≥ 768px): atalhos com fundo rosa clarinho uniforme */
        @media (min-width: 768px) {
          .ini-nav-icon {
            background: #FFF5F9 !important;
            color: #2C1219 !important;
          }
          /* "Nova Venda" continua branco por dentro (card é vinho) */
          .ini-nav-card[data-nav="nova-venda"] .ini-nav-icon {
            background: rgba(255,255,255,0.16) !important;
            color: #FFFFFF !important;
          }
        }

        /* ═══════════════════════════════════════════════════════════
           INÍCIO MOBILE — layout novo (mockup aprovado 28/09)
           Só < 768px. Desktop não é afetado.
           ═══════════════════════════════════════════════════════════ */
        .ini-hero-bg, .ini-hero-cta-bag, .ini-hero-cta-plus { display: none; }
        /* (07/10 · 3.00) de 768 a 900px a página ainda tem a margem do celular: a faixa vai de ponta a ponta e não corta em cima */
        @media (min-width: 768px) and (max-width: 900px) {
          .ini-root .ini-hero {
            width: 100vw;
            margin: calc(-1 * (var(--pad-page-top) + env(safe-area-inset-top, 0px))) calc(50% - 50vw) 0;
            padding: calc(1.5rem + env(safe-area-inset-top, 0px)) max(24px, env(safe-area-inset-right, 0px)) 1.5rem max(24px, env(safe-area-inset-left, 0px));
          }
        }
        @media (max-width: 767.98px) {
          /* Topo (07/10 · 3.00, guia A1/A2/A14): vinho pelo nome do themes.css, nome da loja inteiro (até 2 linhas),
             etiqueta e câmera com área de toque de 44px, título 22px peso 900 */
          .ini-root .ini-hero {
            background: var(--vinho-escuro) !important;
            border-radius: 0 0 24px 24px;
            padding: calc(max(env(safe-area-inset-top, 0px), 12px) + 4px) max(16px, env(safe-area-inset-right, 0px)) 12px max(16px, env(safe-area-inset-left, 0px));
            gap: 8px;
            min-height: calc(88px + max(env(safe-area-inset-top, 0px), 12px) - 12px);
            box-sizing: border-box;
          }
          .ini-root .ini-profile-wrapper { margin-left: 0; }
          .ini-root .ini-hero-bg {
            display: block;
            position: absolute; inset: 0;
            border-radius: inherit;
            overflow: hidden;
            pointer-events: none;
            z-index: 0;
          }
          .ini-root .ini-hero-waves { display: block; width: 100%; height: 100%; }
          .ini-root .ini-hero-waves path { fill: var(--vinho); }
          .ini-root .ini-hero-waves path:first-child { opacity: .55; }
          .ini-root .ini-hero-sparkles { display: none; }
          .ini-root .ini-hero-greeting h1 {
            flex-wrap: wrap; /* se o nome e a etiqueta não cabem lado a lado, a etiqueta desce: o nome não é cortado */
            gap: 4px 8px;
            font-size: 22px; font-weight: 900;
            letter-spacing: -.02em; line-height: 1.2;
            min-height: 26px;
          }
          .ini-root .ini-hero-greeting h1 > span:first-child {
            display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
            white-space: normal; overflow-wrap: anywhere; text-wrap: balance;
          }
          .ini-root .ini-hero-data-mobile {
            font-size: 12.5px; font-weight: 500;
            color: rgba(255, 255, 255, .85);
            margin-top: 4px;
            letter-spacing: 0;
          }
          .ini-root .ini-plan-tag {
            position: relative;
            height: 24px;
            padding: 0 8px 0 6px;
            margin-left: 0;
            border-radius: 12px;
            box-shadow: none;
            font-size: 12.5px; font-weight: 800;
            letter-spacing: 0;
            gap: 4px;
            color: var(--ui-branco);
          }
          .ini-root .ini-plan-tag img { width: 14px; height: 14px; }
          .ini-root .ini-plan-tag--pro { background: rgba(var(--primary-rgb), .16); border: 1px solid rgba(var(--primary-rgb), .7); }
          .ini-root .ini-plan-tag--upgrade { background: rgba(255, 255, 255, .12); border: 1px solid rgba(255, 255, 255, .3); -webkit-tap-highlight-color: transparent; touch-action: manipulation; transition: background-color var(--dur-fast) linear, transform var(--dur-fast) var(--ease-out); }
          .ini-root .ini-plan-tag--upgrade::after { content: ""; position: absolute; inset: -10px -6px; } /* área de toque de 44px */
          .ini-root .ini-plan-tag--upgrade:hover { transform: none; background: rgba(255, 255, 255, .18); box-shadow: none; }
          .ini-root .ini-plan-tag--upgrade:active { transform: scale(.96); background: rgba(255, 255, 255, .2); }
          .ini-root .ini-plan-tag--upgrade:focus-visible, .ini-root .ini-profile-btn:focus-visible, .ini-root .ini-profile-cam:focus-visible { outline: 3px solid rgba(255, 255, 255, .75); outline-offset: 2px; }
          .ini-root .ini-profile-btn {
            width: 64px; height: 64px;
            border: 2px solid rgba(255, 255, 255, .9);
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            -webkit-tap-highlight-color: transparent; touch-action: manipulation;
          }
          .ini-root .ini-profile-wrapper[data-has-photo="false"] .ini-profile-btn { background: var(--vinho-claro); }
          .ini-root .ini-profile-inicial { font-size: 24px; color: var(--ui-rosa-claro); }
          .ini-root .ini-profile-btn:hover { transform: none; box-shadow: 0 2px 8px rgba(0,0,0,0.25); }
          .ini-root .ini-profile-btn:active { transform: scale(.96); }
          .ini-root .ini-profile-cam { width: 24px; height: 24px; border: 0; background: var(--ui-branco); color: var(--ui-rosa-escuro); box-shadow: 0 1px 3px rgba(44, 18, 25, .35); -webkit-tap-highlight-color: transparent; }
          .ini-root .ini-profile-cam::after { content: ""; position: absolute; inset: -10px; } /* área de toque de 44px */
          .ini-root .ini-profile-cam:hover:not(:disabled) { transform: none; background: var(--ui-branco); }
          @media (max-width: 389px) { .ini-root .ini-profile-btn { width: 56px; height: 56px; } .ini-root .ini-profile-inicial { font-size: 22px; } }

          /* Espaçamentos gerais */
          .ini-root { padding-left: 5px; padding-right: 5px; }
          .ini-root .ini-content { gap: 10px; }
          .ini-root .ini-main > .ini-section--nav { margin-top: 6px; gap: 0; }
          .ini-root .ini-section--nav .ini-section-title {
            font-size: 16px; font-weight: 800;
            letter-spacing: -0.2px;
            color: #2C1219;
            margin: 0 5px 10px;
          }

          /* Nova Venda */
          .ini-root .ini-hero-cta {
            height: 71px;
            padding: 0 16px;
            gap: 13px;
            border-radius: 13px;
            margin-bottom: 0;
            background: linear-gradient(100deg, #E95B8D 0%, #DD5082 45%, #C94271 75%, #B23560 100%);
            box-shadow: 0 6px 16px rgba(200,60,110,0.22);
          }
          .ini-root .ini-hero-cta::before { content: none; }
          .ini-root .ini-hero-cta-ic {
            width: 44px; height: 44px;
            border-radius: 11px;
            background: rgba(255,255,255,0.22);
            box-shadow: none;
            z-index: 2;
          }
          .ini-root .ini-hero-cta-plus {
            display: flex; align-items: center; justify-content: center;
            width: 23px; height: 23px;
            border-radius: 6px;
            background: #fff;
            color: #E85A8C;
          }
          .ini-root .ini-hero-cta-txt { position: relative; z-index: 2; }
          .ini-root .ini-hero-cta-t { font-size: 17px; font-weight: 800; letter-spacing: -0.2px; line-height: 1.2; }
          .ini-root .ini-hero-cta-d { font-size: 11.5px; opacity: 0.95; margin-top: 2px; }
          .ini-root .ini-hero-cta-bag {
            display: block;
            position: absolute;
            right: 4px; top: -4px;
            width: 104px; height: calc(100% + 4px);
            object-fit: cover;
            pointer-events: none;
            z-index: 1;
          }
          .ini-root .ini-hero-cta-arr { display: none; }

          /* Grade do Acesso rápido */
          .ini-root .ini-nav-grid { gap: 8px; margin-top: 12px; }
          .ini-root .ini-nav-card,
          .ini-root .ini-nav-card[data-nav] {
            align-items: center;
            min-height: 64px;
            padding: 8px 17px 8px 7px;
            border: none;
            border-radius: 13px;
            background: #fff;
            box-shadow: 0 1px 2px rgba(60,20,35,0.04), 0 4px 14px rgba(60,20,35,0.05);
          }
          .ini-root .ini-nav-card:active { background: #fff; transform: scale(0.98); }
          .ini-root .ini-nav-card .ini-nav-icon,
          .ini-root .ini-nav-card[data-nav] .ini-nav-icon {
            position: static;
            flex-shrink: 0;
            width: 41px; height: 41px;
            border-radius: 11px;
            background: #FFEEF3 !important;
            color: #C2416D !important;
          }
          .ini-root .ini-nav-icon svg { width: 26px; height: 26px; }
          .ini-root .ini-nav-meta { margin-left: 10px; gap: 0; }
          .ini-root .ini-nav-card .ini-nav-label {
            margin-top: 0;
            font-size: 13.5px; font-weight: 700;
            letter-spacing: -0.25px;
            color: #2C1219;
          }
          .ini-root .ini-nav-card .ini-nav-sub {
            margin-top: 2px;
            font-size: 10px;
            letter-spacing: -0.15px;
            line-height: 1.35;
            color: #7C7A8E;
          }
          .ini-root .ini-nav-card .ini-nav-arrow {
            top: 13px; right: 12px;
            width: 12px; height: 12px;
            color: #5A3A46;
          }
        }

        /* ══════ Início no computador (≥1100px) — redesenho 30/09 ══════ */
        .ini-dk, .ini-dk-side { display: none; }
        @media (min-width: 1100px) {
          .ini-dk { display: block; margin: 0 0 4px; }
          /* rosa encostado no topo e nas laterais da área do app (sem mexer nos cartões) */
          .ini-dk-top { background: linear-gradient(120deg, #E85A8C 0%, #C33A6E 60%, #8E2350 100%); color: #fff; border-radius: 0; margin: -72px -112px 0 -68px; padding: 48px 140px 74px 96px; display: flex; align-items: center; justify-content: space-between; gap: 20px; position: relative; overflow: hidden; }
          .ini-dk-top::after { content: ""; position: absolute; right: -70px; top: -80px; width: 260px; height: 260px; border-radius: 50%; background: rgba(255,255,255,.08); pointer-events: none; }
          .ini-dk-txt h1 { font-size: 26px; font-weight: 900; margin: 0; color: #fff; }
          .ini-dk-txt p { font-size: 14.5px; margin: 6px 0 0; color: rgba(255,255,255,.92); }
          .ini-dk-bts { display: flex; gap: 10px; position: relative; z-index: 1; }
          .ini-dk-bt { display: inline-flex; align-items: center; gap: 8px; height: 42px; padding: 0 18px; border-radius: 10px; font-family: inherit; font-size: 14px; font-weight: 800; cursor: pointer; white-space: nowrap; }
          .ini-dk-bt--1 { border: none; background: #fff; color: #C33A6E; box-shadow: 0 4px 12px rgba(0,0,0,.12); }
          .ini-dk-bt--2 { border: 1.5px solid rgba(255,255,255,.7); background: transparent; color: #fff; }
          .ini-dk-bt:hover { transform: translateY(-1px); }
          .ini-dk-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: -50px 20px 0; position: relative; z-index: 2; }
          .ini-dk-kpi { background: #fff; border-radius: 16px; padding: 16px; box-shadow: 0 8px 22px rgba(60,20,35,.08); border: 1px solid #F3ECEF; }
          .ini-dk-kpi--dest { background: linear-gradient(150deg, #3B1620, #6B2340); border-color: transparent; }
          .ini-dk-kh { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 700; color: #6B5D64; }
          .ini-dk-kh span { width: 30px; height: 30px; border-radius: 9px; background: #FCE7F3; color: #C33A6E; display: flex; align-items: center; justify-content: center; }
          .ini-dk-kpi--dest .ini-dk-kh { color: rgba(255,255,255,.8); } .ini-dk-kpi--dest .ini-dk-kh span { background: rgba(255,255,255,.15); color: #fff; }
          .ini-dk-kpi b { display: block; font-size: 26px; font-weight: 900; margin-top: 10px; color: #2C1219; }
          .ini-dk-kpi--dest b { color: #fff; }
          .ini-dk-kpi small { font-size: 12px; color: #9A8E94; } .ini-dk-kpi--dest small { color: rgba(255,255,255,.7); }
          /* o bloco antigo de números sai (agora fica no topo) */
          .ini-section--metrics { display: none !important; }
          /* duas colunas: conteúdo + lateral */
          .ini-content { grid-template-columns: minmax(0, 1fr) 340px !important; grid-template-areas: "main aside" !important; margin-top: 18px !important; }
          .ini-aside { display: block !important; grid-area: aside; }
          .ini-aside-desktop { display: none !important; }
          .ini-dk-side { display: flex; flex-direction: column; gap: 16px; }
          .ini-dk-side .cqc { margin-top: 0; }
          .ini-dk-card { background: #fff; border: 1px solid #F0EBED; border-radius: 16px; padding: 16px; }
          .ini-dk-ct { display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-weight: 800; color: #2C1219; margin-bottom: 10px; }
          .ini-dk-ct button { border: none; background: none; font-family: inherit; font-size: 12.5px; font-weight: 700; color: #C33A6E; cursor: pointer; }
          .ini-dk-vazio { font-size: 13px; color: #9A8E94; margin: 0; line-height: 1.45; }
          .ini-dk-en { display: flex; align-items: center; gap: 12px; width: 100%; padding: 9px 0; border: none; border-top: 1px solid #F5F0F2; background: none; font-family: inherit; text-align: left; cursor: pointer; }
          .ini-dk-ct + .ini-dk-en { border-top: none; padding-top: 0; }
          .ini-dk-dt { width: 44px; height: 44px; border-radius: 10px; background: #FAF7F8; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
          .ini-dk-dt b { font-size: 16px; line-height: 1; color: #2C1219; } .ini-dk-dt small { font-size: 9.5px; font-weight: 800; color: #C33A6E; }
          .ini-dk-ei { flex: 1; min-width: 0; display: flex; flex-direction: column; }
          .ini-dk-ei b { font-size: 13.5px; color: #2C1219; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .ini-dk-ei small { font-size: 12px; color: #9A8E94; }
          .ini-dk-ev { font-weight: 800; font-size: 13.5px; color: #15803D; white-space: nowrap; }
          .ini-dk-side .mu-root { margin: 0; }
          /* acesso rápido no estilo do celular: cartão branco, ícone rosa, nome + descrição, 4 por linha */
          .ini-section--nav { background: #fff; border: 1px solid #F0EBED; border-radius: 16px; padding: 18px; }
          .ini-nav-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 10px !important; }
          .ini-root .ini-section--nav .ini-nav-card { display: flex !important; flex-direction: row !important; align-items: center !important; gap: 10px !important; background: #fff !important; border: 1px solid #F0EBED !important; border-radius: 12px !important; padding: 12px !important; min-height: 0 !important; box-shadow: none !important; opacity: 1 !important; text-align: left !important; }
          .ini-root .ini-section--nav .ini-nav-card:hover { border-color: #F3D6E2 !important; background: #FFFAFC !important; }
          .ini-root .ini-section--nav .ini-nav-icon { width: 38px !important; position: static !important; height: 38px !important; border-radius: 10px !important; background: #FCE7F3 !important; color: #C33A6E !important; display: flex !important; align-items: center !important; justify-content: center !important; flex-shrink: 0 !important; margin: 0 !important; }
          .ini-root .ini-section--nav .ini-nav-meta { display: flex !important; padding: 0 !important; margin: 0 !important; justify-content: center !important; align-self: center !important; gap: 1px; flex-direction: column !important; min-width: 0; flex: 1; }
          .ini-root .ini-section--nav .ini-nav-label { font-size: 13.5px !important; margin: 0 !important; padding: 0 !important; font-weight: 700 !important; color: #2C1219 !important; }
          .ini-root .ini-section--nav .ini-nav-sub { display: block !important; font-size: 11.5px !important; color: #9A8E94 !important; line-height: 1.3 !important; }
          .ini-root .ini-section--nav .ini-nav-arrow { display: block !important; position: static !important; color: #C4B8BE !important; margin-left: auto; flex-shrink: 0; }

          /* textos numa linha (o cartão não cresce); seta só em telas bem largas */
          .ini-root .ini-section--nav .ini-nav-label, .ini-root .ini-section--nav .ini-nav-sub { white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
          .ini-root .ini-section--nav .ini-nav-card { min-height: 64px !important; height: auto !important; }
          .ini-root .ini-section--nav .ini-nav-icon svg { width: 20px !important; height: 20px !important; }
        }
        @media (min-width: 1100px) and (max-width: 1499px) {
          .ini-root .ini-section--nav .ini-nav-arrow { display: none !important; }
          /* nessa largura a descrição não cabe: fica só o nome, sem cortar */
          .ini-root .ini-section--nav .ini-nav-sub { display: none !important; }
          .ini-root .ini-section--nav .ini-nav-label { white-space: normal !important; line-height: 1.2 !important; }
        }
      
        /* ── Espaço entre os cartões do Início no celular (02/10): eram 6–10px, agora 20px ── */
        @media (max-width: 767px) {
          .ini-content { gap: 24px !important; }
          .ini-main { gap: 20px; }
          .ini-main > .ini-section { margin-top: 0 !important; margin-bottom: 0 !important; }
          .ini-mobile-conquistas { order: 5; }
        }
`}</style>

      {/* Modal de crop da foto de perfil (aberto pelo ícone de câmera) */}
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          aspect={1}
          cropShape="round"
          onCancel={() => setCropSrc(null)}
          onCropDone={handleCropDone}
        />
      )}

    </div>
    </>
  );
}

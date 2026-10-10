// Build marker: 2026-09-05T11:00 — mobile hero: fonte menor, PRO achatado, texto centralizado
import { resumoItens } from "@/components/pedidos/pedidoTexto";
import { nomeCurtoLoja } from "@/lib/nomeCurtoLoja";
import PrimeirosPassos from "@/components/PrimeirosPassos";
import { STATUS_AINDA_NAO_PRONTO, dataISO } from "@/lib/pedidoStatus";
import { entradasNoPeriodo } from "@/lib/painelFinanceiro";
import ConquistasCard from "@/components/ConquistasCard";
import SeuDia from "@/components/inicio/SeuDia";
import { TelaVazia, informar } from "@/components/base";
import MenuConta from "@/components/MenuConta";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Plus, CalendarDots, CurrencyDollar, ShoppingBag, Camera, Users, ChartLineUp,
  CaretRight, Cake, Receipt, Gear, ClipboardText,
  WarningCircle, Clock, Package, TrendUp, Confetti, RocketLaunch, Sparkle, Crown,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";
import { useIsMobile } from "@/hooks/use-mobile";
import UpdatesFeed from "@/components/UpdatesFeed";
import MinhasAtualizacoes from "@/components/MinhasAtualizacoes";
import AdminBannerMobile from "@/components/AdminBannerMobile";
import { ImageCropper } from "@/components/ui/ImageCropper";

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
 *  - Gráfico do que entrou no caixa nos últimos 30 dias
 */
export default function Inicio() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  // de 901px pra cima é o layout de computador (o mesmo corte do menu lateral)
  const [computador, setComputador] = useState(() => window.matchMedia("(min-width: 901px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 901px)");
    const ouvir = () => setComputador(mq.matches);
    ouvir();
    mq.addEventListener("change", ouvir);
    return () => mq.removeEventListener("change", ouvir);
  }, []);
  const { profile, refetch: refetchProfile } = useProfile();

  const [loading, setLoading] = useState(true);
  const [erroCarga, setErroCarga] = useState(false); // a busca do dia falhou (sem internet, por exemplo)
  const [counts, setCounts] = useState({
    pedidosPendentes: 0,
    entregasHoje: 0,
    aniversariantes: 0,
    recebidoMes: 0,
    pedidosAtrasados: 0,
  });
  const [proximaEntregaHoje, setProximaEntregaHoje] = useState<{ cliente: string; hora: string; produto: string | null } | null>(null);
  const [aniversariantesDetalhe, setAniversariantesDetalhe] = useState<{ nome: string; dias: number } | null>(null);
  const [resumoSemana, setResumoSemana] = useState({ vendas: 0, pedidos: 0 });
  const [resumoAnterior, setResumoAnterior] = useState({ vendas: 0, pedidos: 0 });
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [proximasEntregas, setProximasEntregas] = useState<Array<{ id: string; cliente: string; data: string; valor: number; hora?: string | null; produto?: string | null; tipo?: string | null }>>([]);
  // Onboarding: se cliente novo, o card destaque muda pra empty state contextual
  const [onboarding, setOnboarding] = useState({
    produtosCount: 0,
    clientesCount: 0,
    cardapioPublicado: false,
    loading: true,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const fotoRef = useRef<HTMLButtonElement>(null); // o menu da conta abre embaixo da foto

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
      informar({ titulo: "Esse arquivo não é uma foto", texto: "Escolha uma imagem em JPG ou PNG.", icone: "alerta" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      informar({ titulo: "Foto grande demais", texto: "Escolha uma foto de até 10 MB.", icone: "alerta" });
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
      informar({ titulo: "Não deu pra trocar a foto", texto: "Confira a internet e tente de novo.", icone: "erro" });
    } finally {
      setUploadingFoto(false);
    }
  };



  const nome = profile?.nome || "";

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
  const getSmartMessage = (): { Icone: Icon; prefix: string; highlight?: string; suffix?: string; tone: "danger" | "info" | "success" | "warning" | "neutral" } => {
    // 1. Pedidos atrasados
    if (counts.pedidosAtrasados > 0) {
      return {
        Icone: WarningCircle,
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
          Icone: Clock,
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
        Icone: Package,
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
        Icone: Cake,
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
          Icone: TrendUp,
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
        Icone: Confetti,
        prefix: "Você faturou ",
        highlight: formatCurrency(resumoSemana.vendas),
        suffix: " nesta semana!",
        tone: "success",
      };
    }
    // 7. Segunda-feira
    const diaSemana = new Date().getDay();
    if (diaSemana === 1 && counts.entregasHoje === 0 && proximasEntregas.length > 0) {
      return {
        Icone: RocketLaunch,
        prefix: "Nova semana, ",
        highlight: `${proximasEntregas.length} ${proximasEntregas.length === 1 ? "pedido agendado" : "pedidos agendados"}`,
        tone: "info",
      };
    }
    // 8. Sexta-feira
    if (diaSemana === 5) {
      return {
        Icone: Confetti,
        prefix: "Sextou! ",
        highlight: "Bora fechar a semana",
        tone: "warning",
      };
    }
    // 9. Fallback — mensagem motivacional (rotativa por dia)
    return {
      Icone: Sparkle,
      prefix: getDailyMessage(),
      tone: "neutral",
    };
  };

  // 4.01: a etiqueta do plano fica ao lado do nome quando cabe; se não cabe, desce pra linha da data (o topo não cresce)
  const saudacaoRef = useRef<HTMLDivElement>(null);
  const [tagEmbaixo, setTagEmbaixo] = useState(false);
  useLayoutEffect(() => {
    const el = saudacaoRef.current;
    if (!el) return;
    const medir = () => {
      const nomeEl = el.querySelector("h1 > span:first-child") as HTMLElement | null;
      const tagEl = el.querySelector(".ini-plan-tag--pc, .ini-plan-tag--mob") as HTMLElement | null;
      const tags = Array.from(el.querySelectorAll(".ini-plan-tag")) as HTMLElement[];
      const larguraTag = Math.max(0, ...tags.map(t => t.offsetWidth));
      if (!nomeEl || !tagEl || !larguraTag) return;
      // largura do nome inteiro, sem a reticência (mede um instante sem encolher)
      const antes = nomeEl.style.flex;
      nomeEl.style.flex = "none";
      const larguraNome = nomeEl.getBoundingClientRect().width;
      nomeEl.style.flex = antes;
      setTagEmbaixo(larguraNome + 8 + larguraTag > el.clientWidth);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    document.fonts?.ready.then(medir);
    return () => ro.disconnect();
  }, [profile]);

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
    setErroCarga(false);
    try {
      const userId = profile!.id;
      const hoje = new Date();
      // (07/10 · 3.02) "hoje" no horário do Brasil: antes vinha no horário de Londres e, depois das 21h, já era amanhã
      const hojeISO = dataISO(hoje);

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
        entradasRes,
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
        // O que entrou no caixa (07/10 · 3.08): a mesma regra do "Recebido no mês" do Financeiro. Uma busca só serve
        // o número do mês e o gráfico de 30 dias; por isso começa no dia mais antigo dos dois.
        entradasNoPeriodo(userId, dataISO(inicio30d < inicioMes ? inicio30d : inicioMes), hojeISO),
        // Próximas entregas (a partir de hoje, ordenadas por data)
        supabase
          .from("pedidos")
          .select("id, cliente_nome, data_entrega, valor_total, horario_entrega, tipo_entrega, pedido_itens(nome_produto, quantidade, valor_unitario, produtos(forma_venda))")
          .eq("user_id", userId)
          .gte("data_entrega", hojeISO)
          .in("status", STATUS_ATIVOS)
          .order("data_entrega", { ascending: true })
          .order("horario_entrega", { ascending: true, nullsFirst: false })
          .limit(5),
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

      // Gráfico 30 dias — o que entrou em cada dia
      const chart = construirChart30d(entradasRes.itens);

      // Recebido no mês: do dia 1 até hoje (igual ao Financeiro)
      const inicioMesISO = dataISO(inicioMes);
      const recebidoMes = Math.round(entradasRes.itens.filter(e => e.data >= inicioMesISO).reduce((s, e) => s + e.valor, 0) * 100) / 100;

      setCounts({
        pedidosPendentes: pedidosPendentesRes.count || 0,
        entregasHoje: entregasHojeRes.count || 0,
        aniversariantes: aniversariantes.length,
        recebidoMes,
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
          // 4.06: o que vai e se é retirada, pro destaque e pra lista do "Seu dia"
          produto: p.pedido_itens?.length ? resumoItens(p) : null,
          tipo: p.tipo_entrega || null,
        }))
      );
      // o Supabase não lança erro: ele devolve. Sem isso a tela ficava zerada, como se não houvesse pedido nenhum
      if (entregasHojeRes.error || proximasEntregasRes.error || pedidosAtrasadosRes.error || entradasRes.erro) setErroCarga(true);
    } catch (err) {
      console.error("Erro ao carregar dados do início:", err);
      setErroCarga(true);
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

  /** Série diária dos últimos 30 dias: quanto entrou no caixa em cada dia. */
  const construirChart30d = (entradas: { valor: number; data: string }[]): ChartPoint[] => {
    const hoje = new Date();
    const mapa: Record<string, number> = {};
    entradas.forEach(e => { mapa[e.data] = (mapa[e.data] || 0) + e.valor; });
    const result: ChartPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(hoje.getDate() - i);
      const iso = dataISO(d);
      result.push({
        dia: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        valor: mapa[iso] || 0,
      });
    }
    return result;
  };

  // ─── Helpers de render ───
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);


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

        {/* Foto da confeiteira — abre o menu da conta (celular e tablet). A câmera, quando não tem foto, abre a escolha da foto. */}
        <div className="ini-profile-wrapper" data-has-photo={profile?.foto_url ? "true" : "false"}>
          <button
            ref={fotoRef}
            className="ini-profile-btn"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Abrir o menu da conta" aria-haspopup="dialog" aria-expanded={menuOpen}
            title="Menu da conta"
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
        <div ref={saudacaoRef} className={`ini-hero-greeting${tagEmbaixo ? " ini-hero-greeting--apertado" : ""}`}>
          <h1>
            <span>
              Olá,{" "}
              {profile ? (
                // 02/10: o nome da confeitaria (o pessoal só se a loja ainda não tiver nome)
                // 09/10 · 4.01: só o nome da loja, sem "Confeitaria", "Doceria" etc., pra caber com a etiqueta do plano
                (nomeCurtoLoja((profile as any).nome_loja) || (nome ? nome.split(" ")[0] : "!"))
              ) : (
                <span className="ini-hero-name-skel" aria-hidden="true" />
              )}
            </span>
            {profile && (
              isPro ? (
                <span className="ini-plan-tag ini-plan-tag--pc ini-plan-tag--pro" aria-label="Plano PRO">
                  <Crown size={14} weight="fill" aria-hidden="true" />
                  <span>PRO</span>
                </span>
              ) : (
                <button
                  type="button"
                  className="ini-plan-tag ini-plan-tag--pc ini-plan-tag--upgrade"
                  onClick={() => navigate("/assinar")}
                  aria-label="Assinar o plano PRO"
                >
                  <Crown size={14} weight="fill" aria-hidden="true" />
                  <span>Seja PRO</span>
                </button>
              )
            )}
          </h1>
          {/* Data — só mobile (embaixo do nome) */}
          {/* 4.01: no celular a etiqueta do plano fica ao lado da data, e o nome da loja ganha a linha inteira */}
          <div className="ini-hero-sub">
            <p className="ini-hero-data-mobile">{hojeFormatado()}</p>
              {profile && (
                isPro ? (
                  <span className="ini-plan-tag ini-plan-tag--mob ini-plan-tag--pro" aria-label="Plano PRO">
                    <Crown size={14} weight="fill" aria-hidden="true" />
                    <span>PRO</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="ini-plan-tag ini-plan-tag--mob ini-plan-tag--upgrade"
                    onClick={() => navigate("/assinar")}
                    aria-label="Assinar o plano PRO"
                  >
                    <Crown size={14} weight="fill" aria-hidden="true" />
                    <span>Seja PRO</span>
                  </button>
                )
              )}
          </div>
          {(() => {
            const msg = getSmartMessage();
            return (
              <p className={`ini-hero-msg ini-hero-msg--${msg.tone}`}>
                <span className="ini-hero-msg-icon" aria-hidden="true"><msg.Icone size={20} weight="bold" /></span>
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
        const hojeISO = dataISO(new Date());
        const aReceberHoje = proximasEntregas.filter(e => e.data === hojeISO).reduce((s, e) => s + e.valor, 0);
        const proxHora = proximasEntregas.find(e => e.data === hojeISO && e.hora)?.hora;
        const partes: string[] = [];
        if (counts.entregasHoje > 0) partes.push(`${counts.entregasHoje} ${counts.entregasHoje === 1 ? "entrega" : "entregas"} hoje`);
        const txtAtrasados = counts.pedidosAtrasados > 0 ? `${counts.pedidosAtrasados} ${counts.pedidosAtrasados === 1 ? "pedido atrasado" : "pedidos atrasados"}` : "";
        if (txtAtrasados) partes.push(txtAtrasados);
        if (aReceberHoje > 0) partes.push(`${formatCurrency(aReceberHoje)} em entregas hoje`);
        return (
          <div className="ini-dk">
            <div className="ini-dk-top">
              <div className="ini-dk-txt">
                <h1>Seu dia hoje</h1>
                <p>
                  {loading ? "Carregando…" : erroCarga ? "Não deu pra carregar o seu dia. Confira a internet e atualize a página." : !partes.length ? "Nenhuma entrega hoje · aproveite pra divulgar seu cardápio"
                    : partes.map((t, i) => (
                      <span key={t}>
                        {i > 0 && " · "}
                        {t === txtAtrasados
                          ? <button type="button" className="ini-dk-atr" onClick={() => navigate("/pedidos?filtro=atrasados")}>{t}</button>
                          : t}
                      </span>
                    ))}
                </p>
              </div>
              <div className="ini-dk-bts">
                <button type="button" className="ini-dk-bt ini-dk-bt--1" onClick={() => navigate("/vendas/novo")}><Plus size={16} weight="bold" /> Nova venda</button>
                <button type="button" className="ini-dk-bt ini-dk-bt--2" onClick={() => navigate("/agenda")}><CalendarDots size={16} weight="bold" /> Ver agenda</button>
              </div>
            </div>
            <div className="ini-dk-kpis">
              <div className="ini-dk-kpi ini-dk-kpi--dest">
                <div className="ini-dk-kh"><span><CurrencyDollar size={20} weight="bold" /></span>Recebido no mês</div>
                {/* sem centavos, igual ao Financeiro mostra: os dois lugares têm que exibir o mesmo número */}
                <b>{loading ? "—" : counts.recebidoMes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b><small>dinheiro que entrou</small>
              </div>
              <div className="ini-dk-kpi">
                <div className="ini-dk-kh"><span><Receipt size={20} weight="bold" /></span>Pedidos na semana</div>
                <b>{loading ? "—" : resumoSemana.pedidos}</b><small>últimos 7 dias</small>
              </div>
              <div className="ini-dk-kpi">
                <div className="ini-dk-kh"><span><CalendarDots size={20} weight="bold" /></span>Entregas hoje</div>
                <b>{loading ? "—" : counts.entregasHoje}</b><small>{proxHora ? `próxima às ${String(proxHora).slice(0, 5)}` : "para entregar"}</small>
              </div>
              <div className="ini-dk-kpi">
                <div className="ini-dk-kh"><span><ChartLineUp size={20} weight="bold" /></span>Ticket médio</div>
                <b>{loading ? "—" : formatCurrency(resumoSemana.pedidos ? resumoSemana.vendas / resumoSemana.pedidos : 0)}</b><small>por pedido na semana</small>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="ini-content">
        {/* ── Coluna principal ── */}
        <div className="ini-main">

      {/* ── Seu dia (07/10 · 3.04): o resumo do dia no celular e no tablet. No computador ele já está no topo rosa. ── */}
      <section className="ini-section ini-section--dia">
        <SeuDia
          carregando={loading} erro={erroCarga} aoTentar={carregarTudo}
          entregasHoje={counts.entregasHoje} atrasados={counts.pedidosAtrasados} novos={counts.pedidosPendentes}
          proximas={proximasEntregas} hoje={dataISO(new Date())}
        />
      </section>

      {/* ── Primeiros passos (02/10) — some quando ela termina.
             (07/10 · 2.94) Passou a aparecer em todos os aparelhos: é o único guia depois das boas-vindas (o tour saiu). ── */}
      <section className="ini-section ini-section--checklist-top ini-pp">
        <PrimeirosPassos />
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
              ? <span className="ini-hero-cta-plus"><Plus size={16} weight="bold" /></span>
              : <Plus size={24} weight="bold" />}
          </div>
          <div className="ini-hero-cta-txt">
            <div className="ini-hero-cta-t">Nova venda</div>
            <div className="ini-hero-cta-d">Comece um pedido em segundos</div>
          </div>
          {isMobile && <img src="/nova-venda-sacola.svg" alt="" aria-hidden="true" className="ini-hero-cta-bag" />}
          <CaretRight size={20} weight="bold" className="ini-hero-cta-arr" />
        </button>

        <div className="ini-nav-grid">
          {[
            { Icone: Receipt,        label: "Pedidos",       sub: "Suas encomendas",       path: "/pedidos",       key: "pedidos" },
            { Icone: CalendarDots,   label: "Agenda",        sub: "Entregas por dia",      path: "/agenda",        key: "agenda" },
            { Icone: ShoppingBag,    label: "Cardápio",      sub: "Sua loja online",       path: "/cardapio",      key: "cardapio" },
            { Icone: Users,          label: "Clientes",      sub: "Quem compra de você",   path: "/clientes",      key: "clientes" },
            { Icone: CurrencyDollar, label: "Financeiro",    sub: "Entradas e saídas",     path: "/financeiro",    key: "financeiro" },
            { Icone: Cake,           label: "Produtos",      sub: "O que você vende",      path: "/produtos",      key: "produtos" },
            { Icone: ClipboardText,  label: "Ficha técnica", sub: "Custo e lucro",         path: "/ficha-tecnica", key: "ficha" },
            { Icone: Gear,           label: "Configurações", sub: "Conta e preferências",  path: "/configuracoes", key: "configuracoes" },
          ].map((item) => (
            <button key={item.path} className="ini-nav-card" data-nav={item.key} onClick={() => navigate(item.path)}>
              <div className="ini-nav-icon"><item.Icone size={isMobile ? 24 : 20} weight="bold" /></div>
              <div className="ini-nav-meta">
                <span className="ini-nav-label">{item.label}</span>
                <span className="ini-nav-sub">{item.sub}</span>
              </div>
              <CaretRight size={16} weight="bold" className="ini-nav-arrow" />
            </button>
          ))}
        </div>
      </section>

      {/* ── Recebido nos últimos 30 dias (o que entrou no caixa, igual ao Financeiro) ── */}
      <section className="ini-section ini-section--chart">
        <div className="ini-chart-header">
          <h2 className="ini-section-title">Recebido (30 dias)</h2>
        </div>
        <div className="ini-chart-card">
          {(() => {
            const temDados = chartData.some(d => (d.valor || 0) > 0);
            return temDados ? (
              <div className="ini-chart-inner" style={{ width: "100%", height: 220, minWidth: 0, minHeight: 200 }}>
                {/* initialDimension: evita o aviso "width(-1) and height(-1)" no primeiro desenho, antes de medir o espaço */}
                <ResponsiveContainer width="100%" height="100%" minHeight={200} initialDimension={{ width: 600, height: 220 }}>
                  <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fontSize: 12.5, fill: "var(--ui-texto-2)" }} tickLine={false} axisLine={false} interval={4} padding={{ left: 4, right: 12 }} />
                    <YAxis width={72} tick={{ fontSize: 12.5, fill: "var(--ui-texto-2)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `R$ ${Number(v).toLocaleString("pt-BR")}`} />
                    <Tooltip
                      contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 13.5, fontFamily: "Geist,sans-serif" }}
                      formatter={(v: any) => [formatCurrency(Number(v)), "Recebido"]}
                    />
                    <Line type="monotone" dataKey="valor" stroke="var(--text-title)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "var(--text-title)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <TelaVazia compacta icone={<ChartLineUp size={30} />} titulo="Nada recebido ainda" texto="O gráfico aparece aqui quando entrar o primeiro pagamento." />
            );
          })()}
        </div>
      </section>
        </div>

        {/* ── Lateral (computador) ──
            (07/10 · 3.09) Conquistas e Suas atualizações eram montadas duas vezes (uma pro computador, outra pro celular) e só
            uma aparecia. As duas buscavam os dados, e o aviso de conquista nova abria dobrado. Agora monta só a do aparelho. */}
        {computador && (
        <aside className="ini-aside">
          {/* Computador: conquistas, próximas entregas e atualizações (30/09) */}
          <div className="ini-dk-side">
            <ConquistasCard />
            <div className="ini-dk-card">
              <div className="ini-dk-ct"><span>Próximas entregas</span><button type="button" onClick={() => navigate("/agenda")}>Ver agenda <CaretRight size={16} weight="bold" aria-hidden="true" /></button></div>
              {proximasEntregas.length === 0 ? (
                <p className="ini-dk-vazio">Nenhuma entrega marcada. Os próximos pedidos aparecem aqui.</p>
              ) : proximasEntregas.map(e => {
                const d = new Date(e.data + "T12:00:00");
                const mes = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
                // mesmo formato do celular: "Hoje às 23:30", "Amanhã às 10:00", "Terça às 10:00" (o dia já está no quadradinho)
                const dias = Math.round((d.getTime() - new Date(dataISO(new Date()) + "T12:00:00").getTime()) / 86400000);
                const semana = d.toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
                const quando = dias === 0 ? "Hoje" : dias === 1 ? "Amanhã" : semana.charAt(0).toUpperCase() + semana.slice(1);
                return (
                  <button type="button" key={e.id} className="ini-dk-en" onClick={() => navigate(`/pedidos/${e.id}`)}>
                    <span className="ini-dk-dt"><b>{String(d.getDate()).padStart(2, "0")}</b><small>{mes}</small></span>
                    <span className="ini-dk-ei"><b>{e.cliente}</b><small>{quando}{e.hora ? ` às ${String(e.hora).slice(0, 5)}` : ""}</small></span>
                    <span className="ini-dk-ev">{formatCurrency(e.valor)}</span>
                  </button>
                );
              })}
            </div>
            <MinhasAtualizacoes />
          </div>
        </aside>
        )}

        {!computador && (
          <>
            {/* ── Banner promocional (admin configura) ── */}
            <div className="ini-mobile-banner"><AdminBannerMobile /></div>

            {/* ── Suas atualizações e Notícias (celular e tablet) ── */}
            <div className="ini-mobile-updates"><MinhasAtualizacoes /></div>
            <div className="ini-mobile-updates"><UpdatesFeed /></div>
            {/* Conquistas por último (02/10) */}
            <div className="ini-mobile-updates ini-mobile-conquistas"><ConquistasCard /></div>
          </>
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
          min-width: 0;}
        .ini-hero-greeting h1 > span:first-child {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
          flex: 0 1 auto;
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
          .ini-plan-tag--mob { display: none !important; }
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
        .ini-hero-msg-icon { display: inline-flex; flex: none; }
        .ini-hero-msg-hl {
          font-weight: 700;
          color: #FFFFFF;
        }
        /* sobre o rosa, só o branco dá leitura (o rosa claro, o verde e o amarelo sumiam): o destaque vem do peso da letra */
        .ini-hero-msg .ini-hero-msg-hl { color: var(--ui-branco); font-weight: 700; }
        .ini-hero-msg--neutral { color: rgba(255, 255, 255, 0.92); }

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
          font-weight: 700;
          color: #FCE0E9;
          letter-spacing: -0.02em;
          line-height: 1;
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
        /* A câmera aparece onde este topo aparece (até 900px); no computador a foto fica no menu lateral */
        @media (min-width: 901px) {
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
          font-size: 12.5px;
          font-weight: 700;
          margin-left: 4px;
          vertical-align: middle;
          white-space: nowrap;
          border: none;
          line-height: 1;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(0,0,0,0.28);
        }
        .ini-plan-tag svg { display: block; flex-shrink: 0; color: #FF9DC4; }
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
          font-size: 12.5px;
          position: relative;
          padding: 3px 9px;
          gap: 3px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        }
        .ini-plan-tag--upgrade::after { content: ""; position: absolute; inset: -13px -6px; } /* área de toque de 44px */
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
            font-size: 12.5px;
            padding: 4px 11px;
          }
          .ini-plan-tag--upgrade {
            font-size: 12.5px;
            padding: 3px 10px;
          }
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

        /* Variante à direita — quando o menu abre a partir do sino.
           Usa position:fixed pra escapar do stacking context do hero,
           garantindo que fica acima de qualquer card sobreposto. */

        /* Toggle "Ativar notificações" — barra estilo iOS */

        /* ── Sections ── */
        .ini-section {
          margin-top: var(--gap-section);
          display: flex; flex-direction: column; gap: var(--gap-stack);
        }

        /* ── Empty state hero: aparece só no mobile quando produtosCount = 0 ── */

        /* ── Greeting (desktop only) ── */

        /* ── Agenda today (desktop) / full (mobile) ── */

        /* ── Próximas entregas (mobile) ── */

        /* ── Engajamento (mobile, rodapé) ── */

        .ini-section-title {
          font-size: 16px; font-weight: 700;
          color: var(--text-title);
          margin: 0;
        }

        /* ── Ações rápidas ── */

        /* ── Section subtitle ── */

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
          font-size: 12.5px;
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

        /* ── Agenda de Entregas ── */

        /* ── Métricas (desktop only) ── */

        /* ── Métricas: trend, skeleton, hero (desktop) ── */

        /* ── Alertas ── */

        /* ── Resumo da semana ── */

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

        /* Nível 2: seções dentro de .ini-main */
        .ini-section--dia { order: -1; }
        .ini-root .ini-section.ini-section--dia { margin-top: 16px !important; }
        @media (min-width: 901px) { .ini-section--dia { display: none; } }
        .ini-section--checklist-top { order: 0; margin-top: var(--space-3); }
        .ini-pp:empty { display: none; }

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
        .ini-hero-cta-t { font-size: 16px; font-weight: 700; line-height: 1.15; }
        .ini-hero-cta-d { font-size: 12.5px; opacity: 0.9; margin-top: 2px; }
        .ini-hero-cta-arr { color: #fff; opacity: 0.9; z-index: 1; flex-shrink: 0; }

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

           .ini-chart-card { max-width: 720px; margin-left: auto; margin-right: auto; }
          .ini-section { width: 100%; }
          .ini-profile-btn { width: 48px; height: 48px; }
        }

        /* ── 2 colunas: checklist + dashboard ── */
        @media (min-width: 901px) {
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

          /* Desktop: sem empty state hero (confeiteira que sabe usar PC não precisa) */

          /* Card "Novo pedido" (rosa escuro) — mesmo movimento + escurecido */

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

          /* Empurra o conteúdo pra baixo */

          /* Updates e engajamento são exclusivos do mobile */
          .ini-mobile-updates { display: none; }
          .ini-mobile-banner { display: none; }

          /* Seções: o que mostra/esconde no desktop */
          .ini-main .ini-section--chart    { display: block; }

          /* Respiro vertical entre seções */
          .ini-main .ini-section { margin-top: var(--space-6); order: 0; }
          .ini-main .ini-section:first-child { margin-top: 0; }

          /* ────────────────────────────────────────────
             MÉTRICAS — grid 4 colunas, card hero destacado
             ──────────────────────────────────────────── */

          /* Card hero — faturamento em destaque, fundo vinho */

          /* Cards secundários — ícone sóbrio rosa-claro */

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

}

        /* Telas largas: main continua ocupando tudo */
        @media (min-width: 1500px) {
          .ini-content { grid-template-columns: minmax(0, 1fr); }

        }

        /* Desktop (qualquer largura ≥ 768px): atalhos com fundo rosa clarinho uniforme */
        @media (min-width: 768px) {
          .ini-nav-icon {
            background: #FFF5F9 !important;
            color: #2C1219 !important;
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
            flex-wrap: nowrap; /* 4.01: nome e etiqueta sempre na mesma linha; nome muito longo ganha reticências */
            gap: 4px 8px;
            font-size: 22px; font-weight: 700;
            letter-spacing: -.02em; line-height: 1.2;
            min-height: 26px;
          }
          /* 09/10: o nome não ocupa mais a linha toda — se o nome e o "Seja PRO" cabem, ficam na mesma linha; se não, a etiqueta desce */
          .ini-root .ini-hero-greeting h1 > span:first-child {
            display: block; flex: 0 1 auto; min-width: 0;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          .ini-root .ini-hero-greeting .ini-plan-tag { flex-shrink: 0; }
          .ini-root .ini-hero-greeting--apertado .ini-plan-tag--pc { display: none !important; }
          .ini-root .ini-hero-greeting:not(.ini-hero-greeting--apertado) .ini-plan-tag--mob { display: none !important; }
          .ini-root .ini-hero-sub { display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
          .ini-root .ini-hero-sub .ini-hero-data-mobile { margin-top: 0; }
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
            font-size: 12.5px; font-weight: 700;
            letter-spacing: 0;
            gap: 4px;
            color: var(--ui-branco);
          }
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
            font-size: 16px; font-weight: 700;
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
          .ini-root .ini-hero-cta-t { font-size: 17px; font-weight: 700; letter-spacing: -0.2px; line-height: 1.2; }
          .ini-root .ini-hero-cta-d { font-size: 12.5px; opacity: 0.95; margin-top: 2px; }
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
          .ini-root .ini-nav-icon svg { width: 24px; height: 24px; }
          /* celular pequeno: sem a setinha, pra "Configurações" caber inteiro */
          @media (max-width: 389px) { .ini-root .ini-nav-card, .ini-root .ini-nav-card[data-nav] { padding-right: 8px; } .ini-root .ini-nav-arrow { display: none; } }
          .ini-root .ini-nav-meta { margin-left: 10px; gap: 0; }
          .ini-root .ini-nav-card .ini-nav-label {
            margin-top: 0;
            font-size: 13.5px; font-weight: 700;
            letter-spacing: -0.25px;
            color: #2C1219;
          }
          .ini-root .ini-nav-card .ini-nav-sub {
            margin-top: 2px;
            font-size: 12.5px;
            line-height: 1.35;
            color: #7C7A8E;
          }
          .ini-root .ini-nav-card .ini-nav-arrow {
            top: 13px; right: 12px;
            width: 12px; height: 12px;
            color: #5A3A46;
          }
        }

        /* ══════ Início no computador (de 901px pra cima) — redesenho 30/09 ══════ */
        .ini-dk, .ini-dk-side { display: none; }
        @media (min-width: 901px) {
          .ini-dk { display: block; margin: 0 0 4px; }
          /* rosa encostado no topo e nas laterais da área do app (sem mexer nos cartões) */
          .ini-dk-top { background: linear-gradient(120deg, #E85A8C 0%, #C33A6E 60%, #8E2350 100%); color: #fff; border-radius: 0; margin: -72px -112px 0 -68px; padding: 48px 140px 74px 96px; display: flex; align-items: center; justify-content: space-between; gap: 20px; position: relative; overflow: hidden; }
          .ini-dk-top::after { content: ""; position: absolute; right: -70px; top: -80px; width: 260px; height: 260px; border-radius: 50%; background: rgba(255,255,255,.08); pointer-events: none; }
          .ini-dk-txt h1 { font-size: 22px; font-weight: 700; letter-spacing: -.02em; margin: 0; color: #fff; }
          .ini-dk-txt p { font-size: 14.5px; margin: 6px 0 0; color: rgba(255,255,255,.92); }
          .ini-dk-atr { position: relative; z-index: 1; margin: 0; padding: 0; border: 0; background: none; color: inherit; font: inherit; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
          .ini-dk-atr::after { content: ""; position: absolute; inset: -12px -4px; } /* área de toque de 44px */
          .ini-dk-atr:focus-visible { outline: 3px solid rgba(255, 255, 255, .75); outline-offset: 2px; border-radius: 4px; }
          .ini-dk-bts { display: flex; gap: 10px; position: relative; z-index: 1; }
          .ini-dk-bt { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: 12px; font-family: inherit; font-size: 14.5px; font-weight: 700; cursor: pointer; white-space: nowrap; }
          .ini-dk-bt--1 { border: none; background: #fff; color: #C33A6E; box-shadow: 0 4px 12px rgba(0,0,0,.12); }
          .ini-dk-bt--2 { border: 1.5px solid rgba(255,255,255,.7); background: transparent; color: #fff; }
          .ini-dk-bt:hover { transform: translateY(-1px); }
          .ini-dk-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: -50px 20px 0; position: relative; z-index: 2; }
          .ini-dk-kpi { background: #fff; border-radius: 16px; padding: 16px; box-shadow: 0 8px 22px rgba(60,20,35,.08); border: 1px solid #F3ECEF; }
          .ini-dk-kpi--dest { background: linear-gradient(150deg, #3B1620, #6B2340); border-color: transparent; }
          .ini-dk-kh { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
          .ini-dk-kh span { width: 30px; height: 30px; border-radius: 9px; background: #FCE7F3; color: #C33A6E; display: flex; align-items: center; justify-content: center; }
          .ini-dk-kpi--dest .ini-dk-kh { color: rgba(255,255,255,.8); } .ini-dk-kpi--dest .ini-dk-kh span { background: rgba(255,255,255,.15); color: #fff; }
          .ini-dk-kpi b { display: block; font-size: 26px; font-weight: 700; margin-top: 10px; color: #2C1219; }
          .ini-dk-kpi--dest b { color: #fff; }
          .ini-dk-kpi small { font-size: 12.5px; color: #9A8E94; } .ini-dk-kpi--dest small { color: rgba(255,255,255,.7); }
          /* o bloco antigo de números sai (agora fica no topo) */

          /* duas colunas: conteúdo + lateral */
          .ini-content { grid-template-columns: minmax(0, 1fr) 340px !important; grid-template-areas: "main aside" !important; margin-top: 18px !important; }
          .ini-aside { display: block !important; grid-area: aside; }

          .ini-dk-side { display: flex; flex-direction: column; gap: 16px; }
          .ini-dk-side .cqc { margin-top: 0; }
          .ini-dk-card { background: #fff; border: 1px solid #F0EBED; border-radius: 16px; padding: 16px; }
          .ini-dk-ct { display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-weight: 700; color: #2C1219; margin-bottom: 10px; }
          .ini-dk-ct button { display: inline-flex; align-items: center; gap: 4px; min-height: 44px; margin: -12px -8px -12px 0; padding: 0 8px; border: none; border-radius: 12px; background: none; font-family: inherit; font-size: 13.5px; font-weight: 700; color: var(--ui-rosa-escuro); cursor: pointer; }
          .ini-dk-vazio { font-size: 13.5px; color: #9A8E94; margin: 0; line-height: 1.45; }
          .ini-dk-en { display: flex; align-items: center; gap: 12px; width: 100%; padding: 9px 0; border: none; border-top: 1px solid #F5F0F2; background: none; font-family: inherit; text-align: left; cursor: pointer; }
          .ini-dk-ct + .ini-dk-en { border-top: none; padding-top: 0; }
          .ini-dk-dt { width: 48px; height: 48px; border-radius: 10px; background: #FAF7F8; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
          .ini-dk-dt b { font-size: 16px; line-height: 1; color: #2C1219; } .ini-dk-dt small { font-size: 12.5px; font-weight: 700; color: #C33A6E; }
          .ini-dk-ei { flex: 1; min-width: 0; display: flex; flex-direction: column; }
          .ini-dk-ei b { font-size: 15px; color: #2C1219; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .ini-dk-ei small { font-size: 12.5px; color: #9A8E94; }
          .ini-dk-ev { font-weight: 700; font-size: 13.5px; color: #15803D; white-space: nowrap; }
          .ini-dk-side .mu-root { margin: 0; }
          /* acesso rápido no estilo do celular: cartão branco, ícone rosa, nome + descrição, 4 por linha */
          .ini-section--nav { background: #fff; border: 1px solid #F0EBED; border-radius: 16px; padding: 18px; }
          .ini-nav-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 10px !important; }
          .ini-root .ini-section--nav .ini-nav-card { display: flex !important; flex-direction: row !important; align-items: center !important; gap: 10px !important; background: #fff !important; border: 1px solid #F0EBED !important; border-radius: 12px !important; padding: 12px !important; min-height: 0 !important; box-shadow: none !important; opacity: 1 !important; text-align: left !important; }
          .ini-root .ini-section--nav .ini-nav-card:hover { border-color: #F3D6E2 !important; background: #FFFAFC !important; }
          .ini-root .ini-section--nav .ini-nav-icon { width: 38px !important; position: static !important; height: 38px !important; border-radius: 10px !important; background: #FCE7F3 !important; color: #C33A6E !important; display: flex !important; align-items: center !important; justify-content: center !important; flex-shrink: 0 !important; margin: 0 !important; }
          .ini-root .ini-section--nav .ini-nav-meta { display: flex !important; padding: 0 !important; margin: 0 !important; justify-content: center !important; align-self: center !important; gap: 1px; flex-direction: column !important; min-width: 0; flex: 1; }
          .ini-root .ini-section--nav .ini-nav-label { font-size: 13.5px !important; margin: 0 !important; padding: 0 !important; font-weight: 700 !important; color: #2C1219 !important; }
          .ini-root .ini-section--nav .ini-nav-sub { display: block !important; font-size: 12.5px !important; color: #9A8E94 !important; line-height: 1.3 !important; }
          .ini-root .ini-section--nav .ini-nav-arrow { display: block !important; position: static !important; color: #C4B8BE !important; margin-left: auto; flex-shrink: 0; }

          /* textos numa linha (o cartão não cresce); seta só em telas bem largas */
          .ini-root .ini-section--nav .ini-nav-label, .ini-root .ini-section--nav .ini-nav-sub { white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
          .ini-root .ini-section--nav .ini-nav-card { min-height: 64px !important; height: auto !important; }
          .ini-root .ini-section--nav .ini-nav-icon svg { width: 20px !important; height: 20px !important; }
        }
        /* (07/10 · 3.06) O layout de computador do Início começava em 1100px, mas o menu lateral aparece em 901px:
           nesse meio ficava uma faixa rosa solta e a saudação repetida. Agora o computador começa em 901px;
           de 901 a 1279px ele vai numa coluna só, com os quatro números em duas linhas. As duas colunas ficam pra 1280px em diante
           (em 1100px a coluna do meio tinha 300px e os cartões quebravam uma palavra por linha). */
        @media (min-width: 901px) and (max-width: 1279px) {
          .ini-root { padding-left: 0; padding-right: 0; }
          .ini-dk-top { margin: -72px -32px 0; padding: 40px 32px 74px; }
          .ini-dk-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); margin: -50px 0 0; }
          .ini-content { grid-template-columns: minmax(0, 1fr) !important; grid-template-areas: "main" "aside" !important; }
        }
        /* (10/10) Acesso rápido no computador: todos os cartões iguais em qualquer largura — ícone em cima, nome embaixo,
           centralizados na altura, mesma altura, nome numa linha só e sem reticências (a descrição e a seta não cabiam e cortavam) */
        @media (min-width: 901px) {
          .ini-root .ini-section--nav .ini-nav-grid { grid-auto-rows: 1fr; }
          .ini-root .ini-section--nav .ini-nav-arrow { display: none !important; }
          .ini-root .ini-section--nav .ini-nav-sub { display: none !important; }
          .ini-root .ini-section--nav .ini-nav-label { white-space: nowrap !important; overflow: visible !important; text-overflow: clip !important; line-height: 1.2 !important; }
          .ini-root .ini-section--nav .ini-nav-card { flex-direction: column !important; align-items: flex-start !important; justify-content: center !important; gap: 8px !important; min-height: 88px !important; height: 100% !important; padding: 12px 10px 12px 12px !important; }
          .ini-root .ini-section--nav .ini-nav-meta { align-self: stretch !important; flex: none !important; }
        }
        /* (10/10) Acesso rápido no celular e tablet: mesma altura em todos, texto e seta centralizados na altura */
        @media (max-width: 900px) {
          .ini-root .ini-nav-grid { grid-auto-rows: 1fr; }
          .ini-root .ini-nav-card, .ini-root .ini-nav-card[data-nav] { align-items: center; min-height: 64px; height: 100%; padding: 8px 10px 8px 8px; }
          .ini-root .ini-nav-card .ini-nav-icon { position: static; flex-shrink: 0; width: 41px; height: 41px; border-radius: 11px; }
          .ini-root .ini-nav-card .ini-nav-icon svg { width: 24px; height: 24px; }
          .ini-root .ini-nav-meta { margin-left: 10px; justify-content: center; }
          .ini-root .ini-nav-card .ini-nav-label { margin-top: 0; }
          .ini-root .ini-nav-card .ini-nav-arrow { position: static; align-self: center; flex-shrink: 0; margin-left: 6px; width: 16px; height: 16px; }
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

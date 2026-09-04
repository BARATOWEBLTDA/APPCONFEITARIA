/**
 * lib/metricas-inicio.ts
 * ─────────────────────────────────────────────────────────
 * Gerencia qual "métrica em destaque" o usuário escolheu
 * pra aparecer no topo da tela Início (card sobreposto ao hero).
 *
 * A escolha é persistida em localStorage (rápido, offline).
 * Cada métrica sabe como buscar seus dados no Supabase e como
 * se apresentar (formato, ícone).
 * ─────────────────────────────────────────────────────────
 */

import { supabase } from "@/lib/supabase";

export type MetricaId =
  | "faturamento-mes"
  | "faturamento-hoje"
  | "pedidos-producao"
  | "proxima-entrega"
  | "aniversariantes-semana"
  | "estoque-baixo";

export interface MetricaOption {
  id: MetricaId;
  emoji: string;
  titulo: string;
  descricao: string;
}

export interface MetricaData {
  label: string;
  valor: string;
  sub?: string;
  tag?: { texto: string; positivo: boolean };
}

export const METRICAS_DISPONIVEIS: MetricaOption[] = [
  {
    id: "faturamento-mes",
    emoji: "💰",
    titulo: "Faturamento do mês",
    descricao: "Total ganho no mês atual",
  },
  {
    id: "faturamento-hoje",
    emoji: "📅",
    titulo: "Faturamento de hoje",
    descricao: "Vendas do dia",
  },
  {
    id: "pedidos-producao",
    emoji: "📦",
    titulo: "Pedidos em produção",
    descricao: "Aguardando finalização",
  },
  {
    id: "proxima-entrega",
    emoji: "🚚",
    titulo: "Próxima entrega",
    descricao: "Data e cliente do próximo pedido",
  },
  {
    id: "aniversariantes-semana",
    emoji: "🎂",
    titulo: "Aniversariantes da semana",
    descricao: "Clientes com aniversário próximo",
  },
  {
    id: "estoque-baixo",
    emoji: "⚠️",
    titulo: "Estoque baixo",
    descricao: "Insumos que precisam de reposição",
  },
];

const LS_KEY = "doonly_metrica_inicio";
const DEFAULT_METRICA: MetricaId = "faturamento-mes";

export function getMetricaEscolhida(): MetricaId {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored && METRICAS_DISPONIVEIS.some((m) => m.id === stored)) {
      return stored as MetricaId;
    }
  } catch {}
  return DEFAULT_METRICA;
}

export function setMetricaEscolhida(id: MetricaId) {
  try {
    localStorage.setItem(LS_KEY, id);
    // Dispara evento pra outras abas/componentes reagirem
    window.dispatchEvent(new CustomEvent("doonly:metrica-changed", { detail: id }));
  } catch {}
}

function formatCurrency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function primeiroNome(nome: string): string {
  return (nome || "").split(" ")[0] || nome || "";
}

function labelDia(data: Date): string {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
  const alvo = new Date(data); alvo.setHours(0,0,0,0);
  if (alvo.getTime() === hoje.getTime()) return "Hoje";
  if (alvo.getTime() === amanha.getTime()) return "Amanhã";
  return alvo.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/**
 * Busca os dados de uma métrica específica. Retorna null se não houver dados
 * (ex.: nenhum pedido ainda). O componente decide como exibir vazio.
 */
export async function fetchMetricaData(id: MetricaId, userId: string): Promise<MetricaData | null> {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();
  const inicioMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString();
  const fimMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0, 23, 59, 59).toISOString();

  try {
    switch (id) {
      case "faturamento-mes": {
        const [{ data: atual }, { data: anterior }] = await Promise.all([
          supabase.from("pedidos").select("valor_total").eq("user_id", userId).gte("created_at", inicioMes),
          supabase.from("pedidos").select("valor_total").eq("user_id", userId).gte("created_at", inicioMesAnterior).lte("created_at", fimMesAnterior),
        ]);
        const totalAtual = (atual || []).reduce((s, p: any) => s + (Number(p.valor_total) || 0), 0);
        const totalAnterior = (anterior || []).reduce((s, p: any) => s + (Number(p.valor_total) || 0), 0);
        let tag;
        if (totalAnterior > 0) {
          const diff = ((totalAtual - totalAnterior) / totalAnterior) * 100;
          tag = { texto: `${diff >= 0 ? "↑" : "↓"} ${Math.abs(Math.round(diff))}% vs mês anterior`, positivo: diff >= 0 };
        }
        return { label: "Faturamento do mês", valor: formatCurrency(totalAtual), tag };
      }

      case "faturamento-hoje": {
        const { data } = await supabase.from("pedidos").select("valor_total").eq("user_id", userId).gte("created_at", inicioHoje);
        const total = (data || []).reduce((s, p: any) => s + (Number(p.valor_total) || 0), 0);
        return { label: "Faturamento de hoje", valor: formatCurrency(total), sub: (data?.length || 0) + " pedido" + ((data?.length || 0) === 1 ? "" : "s") };
      }

      case "pedidos-producao": {
        const { count } = await supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ["em_producao", "producao", "produzindo"]);
        const n = count || 0;
        return { label: "Pedidos em produção", valor: String(n), sub: n === 0 ? "Nenhum pedido em andamento" : n === 1 ? "aguardando finalização" : "aguardando finalização" };
      }

      case "proxima-entrega": {
        const { data } = await supabase
          .from("pedidos")
          .select("cliente_nome, data_entrega, hora_entrega, valor_total, produto_nome")
          .eq("user_id", userId)
          .gte("data_entrega", inicioHoje.substring(0, 10))
          .order("data_entrega", { ascending: true })
          .limit(1);
        const p: any = data?.[0];
        if (!p) return { label: "Próxima entrega", valor: "Sem pedidos", sub: "Nenhuma entrega agendada" };
        const dia = labelDia(new Date(p.data_entrega));
        const hora = p.hora_entrega ? ` · ${String(p.hora_entrega).substring(0, 5)}` : "";
        return {
          label: "Próxima entrega",
          valor: `${primeiroNome(p.cliente_nome)} · ${dia}${hora}`,
          sub: p.produto_nome ? `${p.produto_nome}${p.valor_total ? ` · ${formatCurrency(Number(p.valor_total))}` : ""}` : undefined,
        };
      }

      case "aniversariantes-semana": {
        // Estratégia: buscar todos e filtrar client-side (Postgres não facilita "mês/dia" em coluna DATE)
        const { data } = await supabase.from("clientes").select("nome, aniversario").eq("user_id", userId).not("aniversario", "is", null);
        const hoje0 = new Date(); hoje0.setHours(0,0,0,0);
        const em7 = new Date(hoje0); em7.setDate(em7.getDate() + 7);
        const proximos = (data || []).filter((c: any) => {
          if (!c.aniversario) return false;
          const [_, m, d] = c.aniversario.split("-").map(Number);
          if (!m || !d) return false;
          const ano = hoje0.getFullYear();
          let alvo = new Date(ano, m - 1, d);
          if (alvo < hoje0) alvo = new Date(ano + 1, m - 1, d);
          return alvo >= hoje0 && alvo <= em7;
        });
        const n = proximos.length;
        if (n === 0) return { label: "Aniversariantes da semana", valor: "0", sub: "Nenhum aniversário próximo" };
        const primeiro: any = proximos[0];
        return {
          label: n === 1 ? "Aniversariante da semana" : "Aniversariantes da semana",
          valor: n === 1 ? primeiroNome(primeiro.nome) : `${n} clientes`,
          sub: n === 1 ? "Mande uma mensagem" : `${primeiroNome(primeiro.nome)} e mais ${n - 1}`,
        };
      }

      case "estoque-baixo": {
        const { data } = await supabase.from("insumos").select("nome, quantidade, quantidade_minima").eq("user_id", userId);
        const baixos = (data || []).filter((i: any) => i.quantidade_minima != null && Number(i.quantidade) <= Number(i.quantidade_minima));
        const n = baixos.length;
        if (n === 0) return { label: "Estoque baixo", valor: "Tudo em ordem", sub: "Nenhum insumo precisa de reposição" };
        const primeiro: any = baixos[0];
        return {
          label: n === 1 ? "Estoque baixo" : "Estoque baixo",
          valor: n === 1 ? primeiro.nome : `${n} insumos`,
          sub: n === 1 ? "Precisa de reposição" : `${primeiro.nome} e mais ${n - 1}`,
        };
      }

      default:
        return null;
    }
  } catch (err) {
    console.error("[metricas-inicio] erro:", err);
    return null;
  }
}

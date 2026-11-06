import { buscarTudo } from "@/lib/buscarTudo";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * (6.169) Desempenho do cardápio: a mesma conta no computador (VisaoGeralDesktop) e no celular (DesempenhoCelular).
 * Busca 60 dias de visitas e pedidos do cardápio (dá pra comparar até "30 dias" com o período anterior).
 */

/** Pedido do cardápio como vem da busca */
export type PedidoResumo = {
  id: string; numero?: number | null; cliente_nome?: string | null; valor_total?: number | string | null; status: string;
  tipo_entrega?: string | null; created_at: string; pedido_itens?: { nome_produto?: string | null; quantidade?: number | string | null }[] | null;
};
export type ProdutoResumo = { id: string; imagem_url?: string | null; descricao?: string | null; disponivel?: boolean | null };
export type DadosCardapio = { visitas: string[]; pedidos: PedidoResumo[]; produtos: ProdutoResumo[]; temCupom: boolean };
export type Periodo = "hoje" | "7d" | "30d" | "tudo";
export type Variacao = { txt: string; up: boolean; neutro?: boolean } | null;

export function inicioPeriodo(p: Periodo): Date | null {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (p === "hoje") return d;
  if (p === "7d") { d.setDate(d.getDate() - 6); return d; }
  if (p === "30d") { d.setDate(d.getDate() - 29); return d; }
  return null;
}

/** Lê os dados (nunca lança: se falhar, `falhou` fica true e `tentar` busca de novo) */
export function useDadosCardapio(uid?: string | null) {
  const [dados, setDados] = useState<DadosCardapio | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    setFalhou(false);
    const desde = new Date(); desde.setDate(desde.getDate() - 60);
    Promise.all([
      // (6.175) de 1.000 em 1.000: o banco corta em 1.000 linhas sem avisar (loja com muita visita via menos)
      buscarTudo<{ created_at: string }>((de, ate) => supabase.from("cardapio_visitas").select("created_at").eq("user_id", uid).gte("created_at", desde.toISOString()).order("created_at").order("id").range(de, ate)),
      buscarTudo<Record<string, unknown>>((de, ate) => supabase.from("pedidos").select("id, numero, cliente_nome, valor_total, status, tipo_entrega, created_at, pedido_itens(nome_produto, quantidade)")
        .eq("user_id", uid).eq("origem", "cardapio").gte("created_at", desde.toISOString()).order("created_at", { ascending: false }).order("id").range(de, ate)),
      supabase.from("produtos").select("id, imagem_url, descricao, disponivel").eq("user_id", uid),
      supabase.from("loja_cupons").select("cupons").eq("user_id", uid).maybeSingle(),
    ]).then(([v, p, pr, c]) => {
      if (!vivo) return;
      if (v.error || p.error || pr.error) { setFalhou(true); return; }
      setDados({
        visitas: ((v.data as { created_at: string }[]) || []).map(x => x.created_at),
        pedidos: (p.data as unknown as PedidoResumo[]) || [],
        produtos: ((pr.data as ProdutoResumo[]) || []).filter(x => x.disponivel !== false),
        temCupom: Array.isArray((c.data as { cupons?: unknown } | null)?.cupons) && (c.data as { cupons: { ativo?: boolean }[] }).cupons.some((x) => x?.ativo),
      });
    }).catch(() => { if (vivo) setFalhou(true); });
    return () => { vivo = false; };
  }, [uid, tentativa]);
  return { dados, falhou, tentar: () => setTentativa(t => t + 1) };
}

/** Os números do período: visitas, pedidos, vendido, conversão, o período anterior, a série do gráfico e os mais pedidos */
export function useMetricasCardapio(dados: DadosCardapio | null, periodo: Periodo) {
  return useMemo(() => {
    if (!dados) return null;
    const ini = inicioPeriodo(periodo);
    const dentro = (iso: string, a: Date | null, b?: Date) => { const t = new Date(iso).getTime(); return (!a || t >= a.getTime()) && (!b || t < b.getTime()); };
    // (6.182) venda é pedido que valeu: recusado, não aceito e Pix não pago não contam
    const ativos = dados.pedidos.filter(p => !["cancelado", "recusado", "aguardando_aceite", "aguardando_pagamento"].includes(p.status));
    const vis = dados.visitas.filter(x => dentro(x, ini)).length;
    const ped = ativos.filter(p => dentro(p.created_at, ini));
    const rec = ped.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
    let ant: { vis: number; ped: number; rec: number } | null = null;
    if (ini) {
      const dur = Date.now() - ini.getTime(); const a0 = new Date(ini.getTime() - dur);
      const pa = ativos.filter(p => dentro(p.created_at, a0, ini));
      ant = { vis: dados.visitas.filter(x => dentro(x, a0, ini)).length, ped: pa.length, rec: pa.reduce((s, p) => s + (Number(p.valor_total) || 0), 0) };
    }
    // (31/10 · 5.89) o gráfico em todos os períodos: hoje por hora, 7 e 30 dias por dia, "tudo" por semana (8 semanas)
    type Barra = { ini: Date; fim: Date; rot: string; dica: string };
    let barras: Barra[] = [];
    if (periodo === "hoje") {
      const h0 = new Date(); h0.setHours(0, 0, 0, 0);
      barras = Array.from({ length: 24 }, (_, h) => { const i = new Date(h0); i.setHours(h); const f = new Date(i); f.setHours(h + 1); return { ini: i, fim: f, rot: h % 3 === 0 ? `${h}h` : "", dica: `${h}h às ${h + 1}h` }; });
    } else if (periodo === "tudo") {
      const fimSem = new Date(); fimSem.setHours(24, 0, 0, 0);
      barras = Array.from({ length: 8 }, (_, k) => { const f = new Date(fimSem); f.setDate(f.getDate() - 7 * (7 - k)); const i = new Date(f); i.setDate(i.getDate() - 7); const ult = new Date(f); ult.setDate(ult.getDate() - 1);
        return { ini: i, fim: f, rot: k === 7 ? "esta" : i.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), dica: `${i.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} a ${ult.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` }; });
    } else {
      const nDias = periodo === "30d" ? 30 : 7;
      barras = Array.from({ length: nDias }, (_, k) => { const i = new Date(); i.setHours(0, 0, 0, 0); i.setDate(i.getDate() - (nDias - 1 - k)); const f = new Date(i); f.setDate(f.getDate() + 1);
        const rot = nDias === 7 ? (k === nDias - 1 ? "hoje" : i.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")) : (k === nDias - 1 ? "hoje" : k % 5 === 0 ? String(i.getDate()) : "");
        return { ini: i, fim: f, rot, dica: i.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }) }; });
    }
    // período anterior: a mesma janela, deslocada para trás (no "tudo" não há com o que comparar)
    const passo = periodo === "hoje" ? 86400000 : periodo === "7d" ? 7 * 86400000 : 30 * 86400000;
    const serie = barras.map(b => ({ ...b, futuro: b.ini.getTime() > Date.now(), n: dados.visitas.filter(x => dentro(x, b.ini, b.fim)).length,
      nAntes: periodo === "tudo" ? null : dados.visitas.filter(x => dentro(x, new Date(b.ini.getTime() - passo), new Date(b.fim.getTime() - passo))).length }));
    // mais pedidos pelo cardápio no período (pela quantidade)
    const conta = new Map<string, number>();
    for (const p of ped) for (const it of p.pedido_itens || []) { const nm = String(it.nome_produto || "Produto"); conta.set(nm, (conta.get(nm) || 0) + (Number(it.quantidade) || 1)); }
    const top = [...conta].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { vis, ped: ped.length, rec, conv: vis > 0 ? (ped.length / vis) * 100 : 0, ant, serie, top };
  }, [dados, periodo]);
}

/** "▲ 20% vs 7 dias antes" (13/10: diz com o que comparou) */
export function variacaoCardapio(periodo: Periodo, atual: number, antes?: number): Variacao {
  if (antes == null || periodo === "tudo") return null;
  if (antes === 0) return atual > 0 ? { txt: "▲ novo no período", up: true } : null;
  const pct = Math.round(((atual - antes) / antes) * 100);
  const comQue = periodo === "hoje" ? "ontem" : periodo === "7d" ? "7 dias antes" : "30 dias antes";
  return { txt: `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs ${comQue}`, up: pct >= 0 };
}

/** "nos últimos 7 dias" (pra completar as frases da tela) */
export const quandoCardapio = (periodo: Periodo) => periodo === "hoje" ? "hoje" : periodo === "7d" ? "nos últimos 7 dias" : periodo === "30d" ? "nos últimos 30 dias" : "nas últimas 8 semanas";

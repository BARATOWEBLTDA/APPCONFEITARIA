import { supabase } from "@/lib/supabase";

/**
 * Financeiro · Passo 4 (03/10) — Saldo em caixa.
 *   saldo = saldo inicial + recebimentos (tabela pagamentos, não estornados)
 *         + entradas manuais − saídas manuais  (tabela financeiro)
 * contando o que foi REGISTRADO depois do momento em que ela informou o saldo inicial (caixa_inicio_em)
 * — o que já estava na gaveta quando ela contou não é somado de novo. Pedido criado ou finalizado NÃO entra:
 * só o recebimento registrado. (No Passo 5, saídas "a pagar" deixam de contar até serem pagas.)
 */
export type MovCaixa = { id: string; tipo: "entrada" | "saida"; valor: number; titulo: string; detalhe: string; data: string; ordem: string };
export type EstadoCaixa = {
  precisaSql: boolean;          // colunas do saldo inicial ainda não existem
  configurado: boolean;         // ela já informou o saldo inicial
  semPagamentos: boolean;       // tabela de pagamentos ainda não existe (Passo 1 não rodado)
  saldoInicial: number; inicio: string | null; // data e hora em que ela informou o saldo
  saldo: number; entrouHoje: number; saiuHoje: number;
  movimentos: MovCaixa[];
};

export const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const FORMA: Record<string, string> = { pix: "Pix", dinheiro: "Dinheiro", credito: "Crédito", debito: "Débito" };
const TIPO: Record<string, string> = { sinal: "Sinal", parcial: "Parcial", restante: "Restante", total: "Pagamento", pagamento: "Pagamento", migracao: "Pagamento" };

export async function carregarCaixa(uid: string): Promise<EstadoCaixa> {
  const vazio: EstadoCaixa = { precisaSql: false, configurado: false, semPagamentos: false, saldoInicial: 0, inicio: null, saldo: 0, entrouHoje: 0, saiuHoje: 0, movimentos: [] };
  const { data: perfil, error: ePerfil } = await supabase.from("profiles").select("caixa_saldo_inicial, caixa_inicio_em").eq("id", uid).maybeSingle();
  if (ePerfil) return { ...vazio, precisaSql: true };
  const p: any = perfil || {};
  if (p.caixa_inicio_em == null || p.caixa_saldo_inicial == null) return vazio;

  const inicio: string = p.caixa_inicio_em;
  const hoje = hojeISO();
  const saldoInicial = r2(p.caixa_saldo_inicial);

  const [pag, fin] = await Promise.all([
    supabase.from("pagamentos").select("id, valor, forma, tipo, recebido_em, pedido_id, created_at")
      .eq("user_id", uid).is("estornado_em", null).gte("created_at", inicio).lte("recebido_em", hoje),
    // lançamento com data no futuro ainda não saiu do caixa
    supabase.from("financeiro").select("id, tipo, categoria, descricao, valor, data, created_at")
      .eq("user_id", uid).gte("created_at", inicio).lte("data", hoje),
  ]);
  const semPagamentos = !!pag.error;
  const pagamentos: any[] = pag.error ? [] : (pag.data as any[]) || [];
  const lancamentos: any[] = (fin.data as any[]) || [];

  // nome do pedido em cada recebimento (número e cliente)
  const ids = [...new Set(pagamentos.map(g => g.pedido_id).filter(Boolean))];
  const nomes: Record<string, { numero: any; cliente: string }> = {};
  if (ids.length) {
    const { data: peds } = await supabase.from("pedidos").select("id, numero, cliente_nome").in("id", ids);
    for (const x of (peds as any[]) || []) nomes[x.id] = { numero: x.numero, cliente: x.cliente_nome || "" };
  }

  let saldo = saldoInicial, entrouHoje = 0, saiuHoje = 0;
  const movimentos: MovCaixa[] = [];
  for (const g of pagamentos) {
    const v = r2(g.valor); saldo += v; if (g.recebido_em === hoje) entrouHoje += v;
    const n = g.pedido_id ? nomes[g.pedido_id] : null;
    movimentos.push({
      id: "g" + g.id, tipo: "entrada", valor: v, data: g.recebido_em, ordem: `${g.recebido_em} ${g.created_at || ""}`,
      titulo: `${TIPO[g.tipo] || "Pagamento"}${n ? ` · Pedido #${n.numero ?? "—"}` : ""}`,
      detalhe: [n?.cliente, FORMA[g.forma] || g.forma].filter(Boolean).join(" · "),
    });
  }
  for (const l of lancamentos) {
    const v = r2(l.valor); const entrada = l.tipo === "entrada";
    if (entrada) { saldo += v; if (l.data === hoje) entrouHoje += v; } else { saldo -= v; if (l.data === hoje) saiuHoje += v; }
    movimentos.push({
      id: "f" + l.id, tipo: entrada ? "entrada" : "saida", valor: v, data: l.data, ordem: `${l.data} ${l.created_at || ""}`,
      titulo: l.descricao || l.categoria || (entrada ? "Entrada" : "Despesa"),
      detalhe: entrada ? (l.categoria || "Entrada avulsa") : `Despesa${l.categoria ? ` · ${l.categoria}` : ""}`,
    });
  }
  movimentos.sort((a, b) => b.ordem.localeCompare(a.ordem));
  return { precisaSql: false, configurado: true, semPagamentos, saldoInicial, inicio, saldo: r2(saldo), entrouHoje: r2(entrouHoje), saiuHoje: r2(saiuHoje), movimentos };
}

/** Define (ou acerta) o saldo inicial. O caixa recomeça agora: conta o que for registrado daqui pra frente. */
export async function definirSaldoInicial(uid: string, valor: number): Promise<{ ok: boolean; erro?: string }> {
  const { error } = await supabase.from("profiles").update({ caixa_saldo_inicial: r2(valor), caixa_inicio_em: new Date().toISOString() }).eq("id", uid);
  return error ? { ok: false, erro: error.message } : { ok: true };
}

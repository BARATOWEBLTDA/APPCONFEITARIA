import { supabase } from "@/lib/supabase";
import { buscarTudo } from "@/lib/buscarTudo";
import { faltaNoBanco } from "@/lib/pagamentos";
import { entradasNoPeriodo } from "@/lib/painelFinanceiro";
import { ehDinheiroDaDona } from "@/lib/categoriasFinanceiro";

/**
 * Financeiro por período (4.29) · os números do painel para qualquer intervalo de dias (AAAA-MM-DD, os dois inclusos).
 * Regras iguais às do painel do mês (painelFinanceiro.carregarMes):
 *   Recebido ...... pagamentos pela data do recebimento (sem estornados) + entradas avulsas (sem estornadas)
 *   Despesas ...... saídas do financeiro pela data (sem estornadas)
 *   Resultado ..... recebido − despesas (o que entrou menos o que saiu, no período)
 *   Formas ........ pagamentos de pedidos + entradas avulsas pela forma escolhida (sem forma: "Outras")
 *   Aporte e retirada da dona (4.29) ficam fora do recebido e das despesas (só mexem no saldo em caixa)
 *   Mais vendidos . itens dos pedidos com entrega no período, sem cancelados, pelo valor (preço × quantidade)
 * Nunca lança: se algo falhar, devolve erro: true e a tela mostra "—".
 */
export type DiaFluxo = { data: string; entradas: number; saidas: number };
export type FormaPagamento = { chave: "pix" | "cartao" | "dinheiro" | "outras"; nome: string; valor: number };
export type Vendido = { nome: string; valor: number; pedidos: number };
export type Recebimento = { id: string; quem: string; tipo: string; valor: number; data: string };
export type Periodo = {
  recebido: number; qtdRecebimentos: number;
  despesas: number; qtdDespesas: number;
  resultado: number;
  dias: DiaFluxo[];
  formas: FormaPagamento[];
  maisVendidos: Vendido[];
  ultimos: Recebimento[];
  erro?: boolean;
};

const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
export const isoDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const deIso = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

/** Todos os dias de ini até ate. */
export function diasEntre(ini: string, ate: string): string[] {
  const out: string[] = [];
  for (let d = deIso(ini); isoDe(d) <= ate && out.length < 400; d.setDate(d.getDate() + 1)) out.push(isoDe(d));
  return out;
}

function formaDe(f?: string | null): FormaPagamento["chave"] {
  const s = String(f || "").toLowerCase();
  if (s.includes("pix")) return "pix";
  if (/cr[eé]dito|d[eé]bito|cart|link|mercado/.test(s)) return "cartao";
  if (s.includes("dinheiro")) return "dinheiro";
  return "outras";
}
const NOME_FORMA: Record<FormaPagamento["chave"], string> = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro", outras: "Outras" };
const NOME_TIPO: Record<string, string> = { sinal: "Sinal", parcial: "Parte", restante: "Restante", total: "Pago", pagamento: "Pago", migracao: "Pago" };

async function saidasNoPeriodo(uid: string, ini: string, ate: string) {
  const buscar = (colunas: string) => buscarTudo<any>((de, a) => supabase.from("financeiro")
    .select(colunas).eq("user_id", uid).gte("data", ini).lte("data", ate).order("id").range(de, a));
  let r = await buscar("tipo, categoria, valor, data, estornado_em");
  if (r.error && faltaNoBanco(r.error)) r = await buscar("tipo, categoria, valor, data");
  if (r.error) return { itens: [] as { valor: number; data: string }[], erro: true };
  return { itens: r.data.filter(l => !l.estornado_em && l.tipo !== "entrada" && !ehDinheiroDaDona(l.categoria)).map(l => ({ valor: r2(l.valor), data: String(l.data).slice(0, 10) })), erro: false };
}

/** Só os totais (pra comparar com o período anterior). */
export async function totaisDoPeriodo(uid: string, ini: string, ate: string): Promise<{ recebido: number; despesas: number; erro: boolean }> {
  try {
    const [e, s] = await Promise.all([entradasNoPeriodo(uid, ini, ate), saidasNoPeriodo(uid, ini, ate)]);
    const recebido = r2(e.itens.reduce((t, x) => t + x.valor, 0));
    const despesas = r2(s.itens.reduce((t, x) => t + x.valor, 0));
    return { recebido, despesas, erro: e.erro || s.erro };
  } catch { return { recebido: 0, despesas: 0, erro: true }; }
}

export async function carregarPeriodo(uid: string, ini: string, ate: string): Promise<Periodo> {
  const vazio: Periodo = { recebido: 0, qtdRecebimentos: 0, despesas: 0, qtdDespesas: 0, resultado: 0, dias: [], formas: [], maisVendidos: [], ultimos: [], erro: true };
  try {
    const [entradas, saidas, pag, vend] = await Promise.all([
      entradasNoPeriodo(uid, ini, ate),
      saidasNoPeriodo(uid, ini, ate),
      buscarTudo<any>((de, a) => supabase.from("pagamentos")
        .select("id, valor, forma, tipo, recebido_em, created_at, pedidos(cliente_nome)")
        .eq("user_id", uid).is("estornado_em", null).gte("recebido_em", ini).lte("recebido_em", ate).order("id").range(de, a)),
      buscarTudo<any>((de, a) => supabase.from("pedidos").select("id, status, data_entrega, pedido_itens(nome_produto, quantidade, valor_unitario)")
        .eq("user_id", uid).neq("status", "cancelado").gte("data_entrega", ini).lte("data_entrega", ate).order("id").range(de, a)),
    ]);
    if (entradas.erro || saidas.erro || vend.error) return vazio;
    const temPagamentos = !pag.error;
    if (pag.error && !faltaNoBanco(pag.error)) return vazio;

    const recebido = r2(entradas.itens.reduce((t, x) => t + x.valor, 0));
    const despesas = r2(saidas.itens.reduce((t, x) => t + x.valor, 0));

    // por dia
    const mapa = new Map<string, DiaFluxo>(diasEntre(ini, ate).map(d => [d, { data: d, entradas: 0, saidas: 0 }]));
    for (const x of entradas.itens) { const d = mapa.get(x.data); if (d) d.entradas = r2(d.entradas + x.valor); }
    for (const x of saidas.itens) { const d = mapa.get(x.data); if (d) d.saidas = r2(d.saidas + x.valor); }

    // formas de pagamento (pagamentos de pedidos; o resto do recebido é "Outras entradas")
    const somaForma: Record<FormaPagamento["chave"], number> = { pix: 0, cartao: 0, dinheiro: 0, outras: 0 };
    let somaPagamentos = 0;
    if (temPagamentos) for (const g of pag.data) { const v = r2(g.valor); somaForma[formaDe(g.forma)] += v; somaPagamentos += v; }
    // (4.29) entrada avulsa com forma vai pra forma dela; o resto (sem forma, regra antiga) fica em "Outras"
    for (const x of entradas.itens) if (x.avulsa && x.forma) { somaForma[formaDe(x.forma)] += x.valor; somaPagamentos += x.valor; }
    somaForma.outras += Math.max(0, r2(recebido - somaPagamentos));
    const formas = (Object.keys(somaForma) as FormaPagamento["chave"][])
      .map(k => ({ chave: k, nome: NOME_FORMA[k], valor: r2(somaForma[k]) }))
      .filter(f => f.valor > 0 || f.chave !== "outras");

    // mais vendidos
    const porProduto = new Map<string, { valor: number; pedidos: Set<string> }>();
    for (const p of vend.data) for (const it of p.pedido_itens || []) {
      const nome = String(it.nome_produto || "").trim() || "Produto";
      const v = (Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 0);
      const atual = porProduto.get(nome) || { valor: 0, pedidos: new Set<string>() };
      atual.valor += v; atual.pedidos.add(p.id); porProduto.set(nome, atual);
    }
    const maisVendidos = [...porProduto.entries()].map(([nome, x]) => ({ nome, valor: r2(x.valor), pedidos: x.pedidos.size }))
      .filter(x => x.valor > 0).sort((a, b) => b.valor - a.valor).slice(0, 5);

    // últimos recebimentos
    const ultimos = temPagamentos ? [...pag.data]
      .sort((a, b) => `${b.recebido_em} ${b.created_at}`.localeCompare(`${a.recebido_em} ${a.created_at}`)).slice(0, 5)
      .map(g => {
        const ped = Array.isArray(g.pedidos) ? g.pedidos[0] : g.pedidos;
        return { id: String(g.id), quem: String(ped?.cliente_nome || "").trim() || "Venda sem cliente", tipo: NOME_TIPO[g.tipo] || "Pago", valor: r2(g.valor), data: String(g.recebido_em).slice(0, 10) };
      }) : [];

    return {
      recebido, qtdRecebimentos: entradas.itens.length, despesas, qtdDespesas: saidas.itens.length, resultado: r2(recebido - despesas),
      dias: [...mapa.values()], formas, maisVendidos, ultimos,
    };
  } catch (e) {
    console.error("[financeiro] não consegui carregar o período:", e);
    return vazio;
  }
}

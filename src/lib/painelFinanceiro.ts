import { ehDinheiroDaDona } from "@/lib/categoriasFinanceiro";
import { supabase } from "@/lib/supabase";
import { valorRecebidoPedido } from "@/lib/financeiroPedido";
import { buscarTudo } from "@/lib/buscarTudo";
import { contaComoRecebido, faltaNoBanco, normalizarForma } from "@/lib/pagamentos";
import { pesoDoTamanho } from "@/lib/itemSacola";
import type { OpcaoGrupoJson } from "@/lib/precoCardapio";
import { qtdBaseDoKit } from "@/lib/kitQuantidade";

type LinhaPagamento = { valor: number; recebido_em: string; estornado_em?: string | null; observacao?: string | null; pedido_id?: string | null };
type LinhaLancamento = { tipo: string | null; categoria: string | null; valor: number; data: string; estornado_em?: string | null; forma?: string | null };
type PedidoRecebidoAntigo = { valor_total: number | null; valor_recebido: number | null; status: string | null; status_pagamento: string | null; data_entrega: string };
type LinhaFicha = { produto_id: string; quantidade: number | null; unidade_utilizada: string | null; insumos: { custo_unitario: number | null; unidade: string | null } | null };
type ProdutoDoItem = { id: string; forma_venda?: string | null; kit_qtd?: unknown };
/** Item de pedido lido com CAMPOS_ITEM_CUSTO */
export type ItemCusto = { quantidade?: number | string | null; personalizacoes?: unknown; produtos?: ProdutoDoItem | ProdutoDoItem[] | null };
/** As escolhas gravadas no item (os dois formatos: com e sem "escolhas") */
type PersCusto = { escolhas?: PersCusto | null; tamanho?: OpcaoGrupoJson | null; kit?: { total?: number | string | null } | null };
type PedidoVendido = { id: string; valor_total: number | null; status: string; data_entrega: string; forma_pagamento: string | null; pedido_itens: ItemCusto[] | null };
type PagamentoDoPedido = { pedido_id: string; valor: number | null; forma: string | null; taxa_pct?: number | null };
type ContaPendente = { valor: number | null; vencimento: string | null; custo_fixo_id: string | null };

/**
 * Financeiro · Passo 7 (03/10) — os números do mês do painel, com UMA regra cada:
 *   Recebido ....... pagamentos com data de recebimento no mês + entradas avulsas (caixa: o que entrou)
 *   Despesas pagas . saídas do financeiro com data no mês, até hoje
 *   Vendido ........ pedidos ENTREGUES no mês (data de entrega), sem cancelados — o valor final
 *   Custos variáveis (13/10) taxa da maquininha de cada pedido entregue (pela forma em que foi pago: crédito, débito;
 *                    Pix e dinheiro não pagam) + os custos "R$ por pedido" (embalagem). A taxa usada é a do dia
 *                    do pagamento (pagamentos.taxa_pct, SQL 4.34); sem ela, a taxa cadastrada hoje.
 *   Lucro .......... vendido − custo dos ingredientes (ficha técnica) − custos variáveis − despesas pagas do mês,
 *                    SEM as despesas de insumos (o ingrediente já está no custo da ficha; senão contaria 2x)
 *                    (6.157) e SEM as despesas de Embalagens quando há custo "R$ por pedido" ativo (a embalagem já
 *                    entra por pedido nos custos variáveis; senão contaria 2x). O fluxo de caixa não muda: só o lucro.
 * Sem a tabela de pagamentos (SQL do Passo 1 não rodado), o recebido usa a regra antiga (pelo mês da entrega).
 * 10/10: a regra antiga só vale quando a tabela ou a coluna não existe MESMO. Queda de internet ou outro erro
 * devolve { erro: true } e a tela avisa "Não deu pra carregar" (antes virava R$ 0,00 ou um número pela regra antiga).
 * As buscas vão de 1.000 em 1.000 (o Supabase corta em 1.000 linhas sem avisar).
 */
export type Semana = { label: string; entradas: number; saidas: number; acumulado: number };
export type MesFinanceiro = {
  recebido: number; recebidoPedidos: number; entradasAvulsas: number; qtdRecebimentos: number;
  despesasPagas: number; despesasInsumos: number;
  /** (6.157) despesas de Embalagens que ficaram fora do lucro (há custo "R$ por pedido" ativo); 0 quando entram */
  despesasEmbalagens: number;
  /** (6.157) as despesas pagas que entram no lucro: despesasPagas − despesasInsumos − despesasEmbalagens */
  despesasNoLucro: number;
  vendido: number; qtdVendidos: number; cmv: number; semFicha: number;
  /** (13/10) taxas da maquininha (pela forma de pagamento de cada pedido) e custos por pedido (embalagem) */
  custosVariaveis: number;
  lucro: number; margem: number;
  semanas: Semana[]; fonteRecebido: "pagamentos" | "pedidos";
  /** não deu pra carregar: os números acima vêm zerados e NÃO devem ser mostrados (10/10) */
  erro?: boolean;
};
const MES_COM_ERRO: MesFinanceiro = {
  recebido: 0, recebidoPedidos: 0, entradasAvulsas: 0, qtdRecebimentos: 0, despesasPagas: 0, despesasInsumos: 0, despesasEmbalagens: 0, despesasNoLucro: 0,
  vendido: 0, qtdVendidos: 0, cmv: 0, semFicha: 0, custosVariaveis: 0, lucro: 0, margem: 0, semanas: [], fonteRecebido: "pagamentos", erro: true,
};

const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const ehInsumo = (cat?: string | null) => /insumo|ingrediente|mat[eé]ria/i.test(cat || "");
/** (6.157) categoria "Embalagens" (e parecidas) */
export const ehEmbalagem = (cat?: string | null) => /embalag/i.test(cat || "");

/** Recebimentos de pedidos (sem os estornados) entre dois dias, pela data do recebimento.
 *  (6.157) com a regra do caixa (contaComoRecebido): o estornado só porque o pedido foi excluído continua contando
 *  (o dinheiro ficou na gaveta). Antes o caixa contava e o Entrou e o Recebido do mês não. */
async function buscarPagamentos(uid: string, ini: string, ate: string) {
  const r = await buscarTudo<LinhaPagamento>((de, a) => supabase.from("pagamentos")
    .select("valor, recebido_em, estornado_em, observacao, pedido_id").eq("user_id", uid).gte("recebido_em", ini).lte("recebido_em", ate).order("id").range(de, a));
  return r.error ? r : { ...r, data: r.data.filter(contaComoRecebido) };
}

/** Lançamentos manuais entre dois dias. Sem a coluna de estorno (SQL não rodado), busca sem ela; outro erro volta como erro. */
async function buscarLancamentos(uid: string, ini: string, ate: string) {
  const buscar = (colunas: string) => buscarTudo<LinhaLancamento>((de, a) => supabase.from("financeiro")
    .select<string, LinhaLancamento>(colunas).eq("user_id", uid).gte("data", ini).lte("data", ate).order("id").range(de, a));
  // (4.29) forma: como a entrada avulsa foi recebida (coluna do SQL 4.31; sem ela, busca sem)
  const r = await buscar("tipo, categoria, valor, data, estornado_em, forma");
  if (!r.error || !faltaNoBanco(r.error)) return r;
  const r2 = await buscar("tipo, categoria, valor, data, estornado_em");
  return r2.error && faltaNoBanco(r2.error) ? buscar("tipo, categoria, valor, data") : r2;
}

/** Regra antiga do recebido (sem a tabela de pagamentos): pedidos pelo dia da entrega. */
const buscarRecebidoAntigo = (uid: string, ini: string, ate: string) => buscarTudo<PedidoRecebidoAntigo>((de, a) => supabase.from("pedidos")
  .select("valor_total, valor_recebido, status, status_pagamento, data_entrega").eq("user_id", uid).gte("data_entrega", ini).lte("data_entrega", ate).order("id").range(de, a));

/**
 * O que entrou no caixa entre dois dias (AAAA-MM-DD), com a MESMA regra do "Recebido no mês" do painel (carregarMes, logo abaixo):
 * pagamentos pela data do recebimento (sem os estornados) + entradas avulsas do financeiro (sem as estornadas).
 * Devolve cada entrada com o seu dia, pra somar um total ou montar um gráfico por dia.
 * (07/10 · 3.08) Feita pro Início: lá o "Faturamento do mês" somava os pedidos CRIADOS no mês e não batia com o Financeiro.
 * Se mudar a regra do recebido em carregarMes, mude aqui também.
 */
export type EntradaPeriodo = { valor: number; data: string; avulsa?: boolean; forma?: string | null };
export async function entradasNoPeriodo(uid: string, ini: string, ate: string): Promise<{ itens: EntradaPeriodo[]; erro: boolean }> {
  const [pag, fin] = await Promise.all([buscarPagamentos(uid, ini, ate), buscarLancamentos(uid, ini, ate)]);
  let itens: EntradaPeriodo[] = [];
  let erro = false;
  if (!pag.error) {
    itens = pag.data.map(g => ({ valor: r2(g.valor), data: String(g.recebido_em).slice(0, 10) }));
  } else if (faltaNoBanco(pag.error)) {
    // sem a tabela de pagamentos: regra antiga, pelo dia da entrega (igual ao painel)
    const peds = await buscarRecebidoAntigo(uid, ini, ate);
    if (peds.error) erro = true;
    itens = peds.data.map(p => ({ valor: r2(valorRecebidoPedido(p)), data: String(p.data_entrega).slice(0, 10) })).filter(x => x.valor > 0);
  } else erro = true; // 10/10: internet ou servidor não é "sem a tabela": avisa em vez de usar a regra antiga
  if (fin.error) erro = true;
  // (4.29) aporte da dona entra no caixa, mas não é venda: fica fora do recebido
  const avulsas = fin.data.filter(l => !l.estornado_em && l.tipo === "entrada" && !ehDinheiroDaDona(l.categoria))
    .map(l => ({ valor: r2(l.valor), data: String(l.data).slice(0, 10), avulsa: true, forma: l.forma || null }));
  return { itens: [...itens, ...avulsas], erro };
}

/**
 * Custo dos ingredientes de 1 unidade de cada produto, pela ficha técnica (com conversão de unidades).
 * 10/10: busca em blocos de 30 produtos e de 1.000 em 1.000 linhas (muitos produtos com ficha passam de 1.000 linhas
 * e o custo ficava cortado). Se a busca falhar, lança erro: custo zerado viraria lucro maior do que é.
 */
export async function custoPorProduto(produtoIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!produtoIds.length) return out;
  const blocos: string[][] = [];
  for (let i = 0; i < produtoIds.length; i += 30) blocos.push(produtoIds.slice(i, i + 30));
  const partes = await Promise.all(blocos.map(bloco => buscarTudo<LinhaFicha>((de, ate) => supabase.from("produto_insumos")
    .select<string, LinhaFicha>("produto_id, quantidade, unidade_utilizada, insumos(custo_unitario, unidade)").in("produto_id", bloco)
    .order("produto_id").order("insumo_id").range(de, ate))));
  const falha = partes.find(p => p.error);
  if (falha) throw falha.error;
  const linhas = partes.flatMap(p => p.data);
  const fator: Record<string, number> = { kg: 1, g: 0.001, L: 1, l: 1, ml: 0.001, un: 1, m: 1, cm: 0.01 };
  for (const f of linhas) {
    const qtd = Number(f.quantidade) || 0, custo = Number(f.insumos?.custo_unitario) || 0;
    const uUsada = f.unidade_utilizada || f.insumos?.unidade || "", uInsumo = f.insumos?.unidade || "";
    const fu = fator[uUsada], fi = fator[uInsumo];
    const c = fu != null && fi != null && fi > 0 ? ((qtd * fu) / fi) * custo : qtd * custo;
    out[f.produto_id] = (out[f.produto_id] || 0) + c;
  }
  return out;
}

/** O que a busca dos itens precisa trazer pra conta do custo (use dentro de pedido_itens(...)). */
export const CAMPOS_ITEM_CUSTO = "quantidade, personalizacoes, produtos(id, forma_venda, kit_qtd)";

const produtoDoItem = (it: ItemCusto) => (Array.isArray(it?.produtos) ? it.produtos[0] : it?.produtos) || null;
/** Tamanho e kit escolhidos no item (os dois formatos que o app grava). */
function escolhasDoItem(it: ItemCusto): { tamanho: OpcaoGrupoJson | null; totalKit: number } {
  let pers = it?.personalizacoes;
  if (typeof pers === "string") { try { pers = JSON.parse(pers); } catch { pers = null; } }
  const esc = (pers as PersCusto)?.escolhas ?? (pers as PersCusto);
  return { tamanho: esc?.tamanho ?? (pers as PersCusto)?.tamanho ?? null, totalKit: Number(esc?.kit?.total ?? (pers as PersCusto)?.kit?.total) || 0 };
}

/**
 * Dos produtos vendidos COM tamanho, quais têm os tamanhos "pelo peso" (preço do kg × peso do tamanho). (11/10)
 * Só busca os produtos que precisam (item com tamanho e produto que não é "por kg"). Se a busca falhar, lança erro.
 */
export async function produtosPeloPeso(itens: ItemCusto[]): Promise<Set<string>> {
  const ids = [...new Set(itens.filter(it => escolhasDoItem(it).tamanho && produtoDoItem(it)?.id && produtoDoItem(it)?.forma_venda !== "kg")
    .map(it => produtoDoItem(it).id as string))];
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += 30) {
    const { data, error } = await supabase.from("produtos").select("id, grupo_tamanhos").in("id", ids.slice(i, i + 30));
    if (error) throw error;
    for (const p of (data as { id: string; grupo_tamanhos: { modo_preco_tamanho?: string } | null }[]) || []) if (p.grupo_tamanhos?.modo_preco_tamanho === "por_peso") out.add(p.id);
  }
  return out;
}

/**
 * Quantas "fichas" tem em 1 unidade do item vendido (11/10). O custo do item = ficha × este número × quantidade.
 * PREMISSA: a ficha técnica é de 1 kg (produto vendido por kg ou com tamanhos "pelo peso") ou de 1 unidade (os outros).
 *   - Tamanho com peso ("M · 2 kg") em produto por kg: a quantidade do item é 1, mas vão 2 kg → 2.
 *   - Kit (50 docinhos): 1. A Ficha técnica mede o custo contra o preço do kit, então a ficha é do kit inteiro.
 *   - Item simples (unidade, ou kg com o peso na quantidade): 1, como sempre foi.
 * Tamanho de preço fixo (cada tamanho com o seu preço) fica em 1: não dá pra saber de que tamanho é a ficha.
 */
export function multiplicadorDoItem(it: ItemCusto, peloPeso: Set<string>): number {
  const { tamanho, totalKit } = escolhasDoItem(it);
  const prod = produtoDoItem(it);
  // (6.03) kit: a ficha vale pela quantidade do preço base (ex.: 1 cento); 500 salgados custam 5 fichas, não 1
  if (totalKit > 0) { const base = qtdBaseDoKit(prod?.kit_qtd); return base > 0 ? totalKit / base : 1; }
  if (tamanho && prod && (prod.forma_venda === "kg" || peloPeso.has(prod.id))) {
    const peso = pesoDoTamanho(tamanho, true); // o peso gravado; se faltar, o que está no nome do tamanho
    if (peso > 0) return peso;
  }
  return 1;
}

/** Os números do mês. Nunca lança: se algo falhar, devolve tudo zerado com erro: true (confira antes de mostrar). */
export async function carregarMes(uid: string, ano: number, mes0: number): Promise<MesFinanceiro> {
  return carregarIntervalo(uid, iso(new Date(ano, mes0, 1)), iso(new Date(ano, mes0 + 1, 0)));
}
/** (23/10) Os mesmos números para qualquer período (Hoje, 7 dias, 30 dias, um mês ou de–até). Nunca lança. */
export async function carregarIntervalo(uid: string, ini: string, fim: string): Promise<MesFinanceiro> {
  try { return await calcularIntervalo(uid, ini, fim); }
  catch (e) { console.error("[financeiro] não consegui carregar o período:", e); return MES_COM_ERRO; }
}

async function calcularIntervalo(uid: string, ini: string, fim: string): Promise<MesFinanceiro> {
  const hoje = iso(new Date());
  const ate = fim < hoje ? fim : hoje;

  const [pag, fin, vend] = await Promise.all([
    buscarPagamentos(uid, ini, ate),
    buscarLancamentos(uid, ini, ate),
    buscarTudo<PedidoVendido>((de, a) => supabase.from("pedidos").select(`id, valor_total, status, data_entrega, forma_pagamento, pedido_itens(${CAMPOS_ITEM_CUSTO})`)
      .eq("user_id", uid).eq("status", "entregue").gte("data_entrega", ini).lte("data_entrega", fim).order("id").range(de, a)),
  ]);
  if (fin.error || vend.error) return MES_COM_ERRO;

  // ── Recebido ──
  let fonteRecebido: MesFinanceiro["fonteRecebido"] = "pagamentos";
  let recebimentos: { valor: number; data: string }[] = [];
  if (!pag.error) {
    recebimentos = pag.data.map(g => ({ valor: r2(g.valor), data: g.recebido_em }));
  } else if (faltaNoBanco(pag.error)) {
    fonteRecebido = "pedidos";
    const peds = await buscarRecebidoAntigo(uid, ini, ate);
    if (peds.error) return MES_COM_ERRO;
    recebimentos = peds.data.map(p => ({ valor: r2(valorRecebidoPedido(p)), data: p.data_entrega })).filter(x => x.valor > 0);
  } else return MES_COM_ERRO;
  // estornado não conta; (4.29) aporte e retirada da dona também não (não são venda nem despesa do negócio)
  const lanc = fin.data.filter(l => !l.estornado_em && !ehDinheiroDaDona(l.categoria));
  const entradasAv = lanc.filter(l => l.tipo === "entrada");
  const saidas = lanc.filter(l => l.tipo !== "entrada");
  const recebidoPedidos = r2(recebimentos.reduce((s, x) => s + x.valor, 0));
  const entradasAvulsas = r2(entradasAv.reduce((s, l) => s + (Number(l.valor) || 0), 0));
  const despesasPagas = r2(saidas.reduce((s, l) => s + (Number(l.valor) || 0), 0));
  const despesasInsumos = r2(saidas.filter(l => ehInsumo(l.categoria)).reduce((s, l) => s + (Number(l.valor) || 0), 0));

  // ── Vendido e custo dos ingredientes ──
  const vendidos = vend.data.filter(p => p.status !== "cancelado");
  const vendido = r2(vendidos.reduce((s, p) => s + (Number(p.valor_total) || 0), 0));
  const ids = [...new Set(vendidos.flatMap(p => (p.pedido_itens || []).map((it) => (it.produtos as ProdutoDoItem)?.id).filter(Boolean)))] as string[];
  // se uma das duas falhar, lança: carregarMes devolve erro (custo zerado inflaria o lucro)
  const [custo, peloPeso] = await Promise.all([custoPorProduto(ids), produtosPeloPeso(vendidos.flatMap(p => p.pedido_itens || []))]);
  let cmv = 0, semFicha = 0;
  for (const p of vendidos) {
    let faltou = false;
    for (const it of p.pedido_itens || []) {
      const c = custo[(it.produtos as ProdutoDoItem)?.id];
      if (!c) { faltou = true; continue; }
      cmv += c * multiplicadorDoItem(it, peloPeso) * (Number(it.quantidade) || 0); // 11/10: tamanho pelo peso e kit contam inteiros
    }
    if (faltou) semFicha++;
  }
  cmv = r2(cmv);
  const { total: custosVariaveis, temFixoPorPedido } = await custosVariaveisDosPedidos(uid, vendidos);
  // (6.157) com custo "R$ por pedido" ativo (embalagem), a compra de embalagem fica fora do lucro, igual aos ingredientes:
  // o custo dela já entrou em cada pedido. Os números do caixa (despesasPagas, semanas) continuam com tudo o que saiu.
  const despesasEmbalagens = temFixoPorPedido ? r2(saidas.filter(l => !ehInsumo(l.categoria) && ehEmbalagem(l.categoria)).reduce((s, l) => s + (Number(l.valor) || 0), 0)) : 0;
  const despesasNoLucro = r2(despesasPagas - despesasInsumos - despesasEmbalagens);
  const lucro = r2(vendido - cmv - custosVariaveis - despesasNoLucro);
  const margem = vendido > 0 ? Math.round((lucro / vendido) * 100) : 0;

  // ── Fluxo por semana: de 7 em 7 dias a partir do início (no mês: 1–7, 8–14, 15–21, 22–28, 29–fim) ──
  const [ya, ma, da] = ini.split("-").map(Number), [yb, mb, db] = fim.split("-").map(Number);
  const faixas: [string, string][] = [];
  for (let d = new Date(ya, ma - 1, da), f = new Date(yb, mb - 1, db); d <= f; d.setDate(d.getDate() + 7)) {
    const b7 = new Date(d); b7.setDate(b7.getDate() + 6);
    faixas.push([iso(d), iso(b7 < f ? b7 : f)]);
  }
  const dd = (x: string) => String(Number(x.slice(8, 10)));
  const dentro = (x: string, a: string, b: string) => x.slice(0, 10) >= a && x.slice(0, 10) <= b;
  let acumulado = 0;
  const semanas: Semana[] = faixas.map(([a, b]) => {
    const e = recebimentos.filter(x => dentro(x.data, a, b)).reduce((s, x) => s + x.valor, 0)
            + entradasAv.filter(l => dentro(l.data, a, b)).reduce((s, l) => s + (Number(l.valor) || 0), 0);
    const sa = saidas.filter(l => dentro(l.data, a, b)).reduce((s, l) => s + (Number(l.valor) || 0), 0);
    acumulado += e - sa;
    return { label: a === b ? dd(a) : `${dd(a)}–${dd(b)}`, entradas: r2(e), saidas: r2(sa), acumulado: r2(acumulado) };
  });

  return {
    recebido: r2(recebidoPedidos + entradasAvulsas), recebidoPedidos, entradasAvulsas, qtdRecebimentos: recebimentos.length,
    despesasPagas, despesasInsumos, despesasEmbalagens, despesasNoLucro, vendido, qtdVendidos: vendidos.length, cmv, semFicha, custosVariaveis, lucro, margem, semanas, fonteRecebido,
  };
}

/* ── Custos variáveis (13/10) ── */
type Variavel = { nome: string; tipo: string; valor: number; ativo: boolean; forma?: string | null };
/** % que incide num valor pago desta forma, pelos custos cadastrados HOJE (a mesma regra do gatilho do SQL 4.34).
 *  Taxa antiga sem forma com "maquininha" no nome vale só no cartão (crédito e débito). */
export function taxaPctDaForma(forma: string | null | undefined, vars: Variavel[]): number {
  const f = forma || "";
  const cartao = f === "credito" || f === "debito";
  return vars.filter(v => v.ativo !== false && v.tipo === "percentual")
    .filter(v => v.forma ? v.forma === f : (!/maquin/i.test(v.nome || "") || cartao))
    .reduce((s, v) => s + (Number(v.valor) || 0), 0);
}
/** Valor fixo por pedido (embalagem etc.) */
export const fixoPorPedido = (vars: Variavel[]) => vars.filter(v => v.ativo !== false && v.tipo === "fixo").reduce((s, v) => s + (Number(v.valor) || 0), 0);

/** Taxas e custos por pedido dos pedidos entregues. Leitura que falha lança (o mês todo vira erro, sem lucro inflado).
 *  (6.157) diz também se há custo "R$ por pedido" ativo (lido mesmo sem pedido entregue: decide se a Embalagem entra no lucro). */
async function custosVariaveisDosPedidos(uid: string, pedidos: PedidoVendido[]): Promise<{ total: number; temFixoPorPedido: boolean }> {
  const vr = await supabase.from("custos_variaveis").select("*").eq("user_id", uid);
  if (vr.error) { if (faltaNoBanco(vr.error)) return { total: 0, temFixoPorPedido: false }; throw vr.error; }
  const vars = (vr.data as Variavel[]) || [];
  const temFixoPorPedido = fixoPorPedido(vars) > 0;
  if (!vars.length || !pedidos.length) return { total: 0, temFixoPorPedido };
  const ids = pedidos.map(p => p.id);
  const pags: PagamentoDoPedido[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const fatia = ids.slice(i, i + 100);
    let r = await supabase.from("pagamentos").select("pedido_id, valor, forma, taxa_pct").in("pedido_id", fatia).is("estornado_em", null);
    if (r.error && faltaNoBanco(r.error)) r = await supabase.from("pagamentos").select("pedido_id, valor, forma").in("pedido_id", fatia).is("estornado_em", null) as typeof r;
    if (r.error) { if (faltaNoBanco(r.error)) break; throw r.error; }
    pags.push(...((r.data as PagamentoDoPedido[]) || []));
  }
  const porPedido = new Map<string, PagamentoDoPedido[]>();
  for (const g of pags) { const l = porPedido.get(g.pedido_id) || []; l.push(g); porPedido.set(g.pedido_id, l); }
  let total = 0;
  for (const p of pedidos) {
    const gs = porPedido.get(p.id);
    if (gs?.length) for (const g of gs) total += (Number(g.valor) || 0) * ((g.taxa_pct != null ? Number(g.taxa_pct) : taxaPctDaForma(g.forma, vars)) / 100);
    else total += (Number(p.valor_total) || 0) * (taxaPctDaForma(normalizarForma(p.forma_pagamento), vars) / 100);
  }
  total += fixoPorPedido(vars) * pedidos.length;
  return { total: r2(total), temFixoPorPedido };
}

/**
 * Resumo das contas a pagar pendentes (null se a tabela ainda não existir).
 * 10/10: filtra pela dona da conta (antes dependia só da regra de segurança do banco) e, se a busca falhar
 * por outro motivo (internet, servidor), devolve { erro: true } em vez de "falta o SQL".
 * 11/10: `vencidas` = quantas já venceram (vencimento antes de hoje) e `proxima` = a próxima A VENCER (de hoje em diante).
 * Antes `proxima` era o menor vencimento pendente: o cartão dizia "vence dia 28" pra conta que venceu no mês passado.
 */
/** (27/10) conta fixa conta uma vez só: a próxima que vence (a mesma regra da tela A pagar). Antes o aluguel de
 *  outubro em aberto + o de novembro já gerado davam "R$ 3.000 · 2 contas" no Financeiro. A lista vem por vencimento. */
/** (6.156) as VENCIDAS ficam todas (aluguel de outubro e de novembro em aberto = R$ 3.000, 2 vencidas); das que ainda vão
 *  vencer, só a primeira de cada conta fixa. Antes a vencida do mês passado escondia a deste mês e a dívida sumia. */
export function umaPorContaFixa<T extends { custo_fixo_id?: string | null; vencimento?: string | null }>(lista: T[], hoje: string = iso(new Date())): T[] {
  const vistas = new Set<string>();
  return lista.filter(c => {
    if (!c.custo_fixo_id) return true;
    if (String(c.vencimento || "").slice(0, 10) < hoje) return true;
    if (vistas.has(c.custo_fixo_id)) return false;
    vistas.add(c.custo_fixo_id); return true;
  });
}
export type ResumoAPagar = { total: number; qtd: number; vencidas: number; proxima: string | null; erro?: boolean };
export async function resumoAPagar(uid: string, hoje: string = iso(new Date())): Promise<ResumoAPagar | null> {
  const { data, error } = await supabase.from("contas_pagar").select("valor, vencimento, custo_fixo_id").eq("user_id", uid).eq("status", "pendente").order("vencimento", { ascending: true });
  if (error) return faltaNoBanco(error) ? null : { total: 0, qtd: 0, vencidas: 0, proxima: null, erro: true };
  const l = umaPorContaFixa((data as ContaPendente[]) || [], hoje);
  const dia = (c: ContaPendente) => String(c.vencimento || "").slice(0, 10);
  return {
    total: r2(l.reduce((s, c) => s + (Number(c.valor) || 0), 0)), qtd: l.length,
    vencidas: l.filter(c => dia(c) && dia(c) < hoje).length,
    proxima: l.map(dia).find(d => d >= hoje) || null,
  };
}

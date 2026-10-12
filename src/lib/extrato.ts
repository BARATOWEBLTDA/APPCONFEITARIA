import { supabase } from "@/lib/supabase";
import { buscarTudo } from "@/lib/buscarTudo";
import { faltaNoBanco } from "@/lib/pagamentos";

/**
 * Extrato (Transações, 03/10): recebimentos de pedidos (tabela pagamentos) + lançamentos manuais
 * (tabela financeiro: entradas avulsas, despesas e contas pagas), num intervalo de datas.
 * Nada se apaga: estornar marca estornado_em e o item sai das contas (fica riscado no extrato).
 */
export type MovExtrato = {
  id: string; origem: "pagamento" | "manual"; ref: string; tipo: "entrada" | "saida";
  valor: number; data: string;
  /** título da linha: "Pedido #12 · Ana" ou a descrição (ou a categoria, sem descrição) */
  titulo: string;
  /** tipo do lançamento: "Sinal", "Pagamento", "Entrada", "Saída" */
  subtipo: string;
  /** a informação que sobra, sem repetir o título: forma de pagamento (pedido) ou categoria (manual) */
  detalhe: string;
  forma: string | null; categoria: string | null; pedidoId: string | null; estornado: boolean; ordem: string;
};

const FORMA: Record<string, string> = { pix: "Pix", dinheiro: "Dinheiro", credito: "Crédito", debito: "Débito", boleto: "Boleto" };
const TIPO: Record<string, string> = { sinal: "Sinal", parcial: "Parcial", restante: "Restante", total: "Pagamento", pagamento: "Pagamento", migracao: "Pagamento" };
export const nomeForma = (f?: string | null) => (f ? FORMA[f] || f : "");

/**
 * 10/10: as buscas vão de 1.000 em 1.000 (o Supabase corta em 1.000 linhas sem avisar: num período longo o extrato
 * e os totais ficavam pela metade). E o plano B "sem a coluna de estorno" só vale quando a coluna não existe MESMO:
 * com queda de internet ou outro erro, devolve erro: true e a tela avisa (antes os estornados voltavam a contar
 * ou os recebimentos sumiam).
 */
export async function carregarExtrato(uid: string, ini: string, fim: string): Promise<{ itens: MovExtrato[]; semEstornoManual: boolean; erro: boolean }> {
  const lancamentos = (colunas: string) => buscarTudo<any>((de, ate) => supabase.from("financeiro").select(colunas)
    .eq("user_id", uid).gte("data", ini).lte("data", fim).order("id").range(de, ate));
  const [pag, fin1] = await Promise.all([
    buscarTudo<any>((de, ate) => supabase.from("pagamentos").select("id, valor, forma, tipo, recebido_em, pedido_id, created_at, estornado_em")
      .eq("user_id", uid).gte("recebido_em", ini).lte("recebido_em", fim).order("id").range(de, ate)),
    lancamentos("id, tipo, categoria, descricao, valor, data, created_at, estornado_em"),
  ]);
  // sem a coluna de estorno (SQL não rodado), busca sem ela
  let fin = fin1, semEstornoManual = false;
  if (fin1.error && faltaNoBanco(fin1.error)) {
    semEstornoManual = true;
    fin = await lancamentos("id, tipo, categoria, descricao, valor, data");
  }
  // sem a tabela de pagamentos (Passo 1 não rodado) o extrato mostra só os lançamentos manuais, como antes
  if (fin.error || (pag.error && !faltaNoBanco(pag.error))) {
    console.error("[extrato] não consegui carregar:", fin.error || pag.error);
    return { itens: [], semEstornoManual, erro: true };
  }
  const pagamentos: any[] = pag.error ? [] : pag.data;
  const ids = [...new Set(pagamentos.map(g => g.pedido_id).filter(Boolean))] as string[];
  const nomes: Record<string, { numero: any; cliente: string }> = {};
  // em blocos de 100 pedidos: com muitos recebimentos, a lista de ids pode passar do tamanho que o servidor aceita (10/10)
  for (let i = 0; i < ids.length; i += 100) {
    const bloco = ids.slice(i, i + 100);
    // 09/10: o nome vem também do cadastro do cliente (pedido feito só com o cliente escolhido não tinha cliente_nome)
    const r1: any = await supabase.from("pedidos").select("id, numero, cliente_nome, clientes(nome)").in("id", bloco);
    const data: any[] = (r1.error ? (await supabase.from("pedidos").select("id, numero, cliente_nome").in("id", bloco)).data : r1.data) || [];
    for (const x of data) {
      const cad = Array.isArray(x.clientes) ? x.clientes[0]?.nome : x.clientes?.nome;
      nomes[x.id] = { numero: x.numero, cliente: String(x.cliente_nome || cad || "").trim() };
    }
  }
  const itens: MovExtrato[] = [];
  for (const g of pagamentos) {
    const n = g.pedido_id ? nomes[g.pedido_id] : null;
    itens.push({
      id: "g" + g.id, origem: "pagamento", ref: g.id, tipo: "entrada", valor: Number(g.valor) || 0, data: g.recebido_em,
      // 10/10: "Pedido #N · Nome do cliente" (antes "Pagamento de pedido", sem dizer qual)
      titulo: n ? [n.numero != null ? `Pedido #${n.numero}` : "Pedido", n.cliente].filter(Boolean).join(" · ") : "Pagamento de pedido",
      subtipo: TIPO[g.tipo] || "Pagamento",
      detalhe: nomeForma(g.forma),
      forma: g.forma || null, categoria: "Pedidos", pedidoId: g.pedido_id || null, estornado: !!g.estornado_em, ordem: `${g.recebido_em} ${g.created_at || ""}`,
    });
  }
  for (const l of fin.data) {
    const entrada = l.tipo === "entrada";
    // 10/10: cada informação uma vez (antes "Luz / Despesa · Luz / Luz")
    const titulo = String(l.descricao || l.categoria || (entrada ? "Entrada" : "Saída")).trim();
    const cat = String(l.categoria || "").trim();
    itens.push({
      id: "f" + l.id, origem: "manual", ref: l.id, tipo: entrada ? "entrada" : "saida", valor: Number(l.valor) || 0, data: l.data,
      titulo,
      subtipo: entrada ? "Entrada" : "Saída",
      detalhe: cat && cat.toLowerCase() !== titulo.toLowerCase() ? (cat === "Insumos" ? "Ingredientes" : cat) : "",
      forma: null, categoria: l.categoria || null, pedidoId: null, estornado: !!l.estornado_em, ordem: `${l.data} ${l.created_at || ""}`,
    });
  }
  itens.sort((a, b) => b.ordem.localeCompare(a.ordem));
  return { itens, semEstornoManual, erro: false };
}

/** Estorna um item do extrato. Recebimento: o pedido volta a ter saldo. Conta paga: a conta volta pra "A pagar". */
export async function estornar(m: MovExtrato): Promise<{ ok: boolean; erro?: string }> {
  const agora = new Date().toISOString();
  if (m.origem === "pagamento") {
    const { error } = await supabase.from("pagamentos").update({ estornado_em: agora }).eq("id", m.ref);
    return error ? { ok: false, erro: "Não foi possível estornar agora." } : { ok: true };
  }
  const { error } = await supabase.from("financeiro").update({ estornado_em: agora }).eq("id", m.ref);
  if (error) return { ok: false, erro: /estornado_em/i.test(error.message) ? "Pra estornar lançamentos, rode o SQL do estorno no Supabase." : "Não foi possível estornar agora." };
  // se era o pagamento de uma conta, ela volta pra "A pagar"
  // 11/10: confere se voltou mesmo. Antes o erro era engolido: o dinheiro voltava pro caixa e a conta seguia "paga".
  let erroConta: unknown;
  try {
    const r = await supabase.from("contas_pagar").update({ status: "pendente", pago_em: null, valor_pago: null, forma: null, financeiro_id: null }).eq("financeiro_id", m.ref);
    erroConta = r.error;
  } catch (e) { erroConta = e; }
  // sem a tabela de contas (SQL não rodado) não existe conta pra voltar: o estorno do lançamento vale
  if (erroConta && !faltaNoBanco(erroConta)) {
    console.error("[extrato] a conta não voltou pra A pagar:", erroConta);
    const { error: eDesfaz } = await supabase.from("financeiro").update({ estornado_em: null }).eq("id", m.ref);
    return { ok: false, erro: eDesfaz
      ? "O lançamento foi estornado, mas a conta continua como paga. Confira em A pagar e tente de novo."
      : "Não deu pra estornar: a conta não voltou pra A pagar. Tente de novo." };
  }
  return { ok: true };
}

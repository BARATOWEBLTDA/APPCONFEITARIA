import { supabase } from "@/lib/supabase";
import { buscarTudo } from "@/lib/buscarTudo";
import { faltaNoBanco, ESTORNO_POR_EXCLUSAO } from "@/lib/pagamentos";

/**
 * Financeiro · Passo 4 (03/10) — Saldo em caixa.
 *   saldo = saldo inicial + recebimentos (tabela pagamentos, não estornados)
 *         + entradas manuais − saídas manuais  (tabela financeiro)
 * contando o que foi REGISTRADO depois do momento em que ela informou o saldo inicial (caixa_inicio_em)
 * — o que já estava na gaveta quando ela contou não é somado de novo. Pedido criado ou finalizado NÃO entra:
 * só o recebimento registrado. (No Passo 5, saídas "a pagar" deixam de contar até serem pagas.)
 * 10/10: o que já estava no saldo informado e foi estornado depois também mexe no saldo, ao contrário (ver carregarCaixa).
 */
export type MovCaixa = { id: string; tipo: "entrada" | "saida"; valor: number; titulo: string; detalhe: string; data: string; ordem: string };
export type EstadoCaixa = {
  precisaSql: boolean;          // colunas do saldo inicial ainda não existem
  configurado: boolean;         // ela já informou o saldo inicial
  semPagamentos: boolean;       // tabela de pagamentos ainda não existe (Passo 1 não rodado)
  erro?: boolean;               // não deu pra carregar (internet, servidor): a tela avisa em vez de mostrar saldo errado (10/10)
  saldoInicial: number; inicio: string | null; // data e hora em que ela informou o saldo
  saldo: number; entrouHoje: number; saiuHoje: number;
  movimentos: MovCaixa[];
};

export const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
/** O dia (AAAA-MM-DD, no horário do aparelho) de uma data e hora do banco. */
const diaLocal = (dataHora: string) => { const d = new Date(dataHora); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const FORMA: Record<string, string> = { pix: "Pix", dinheiro: "Dinheiro", credito: "Crédito", debito: "Débito" };
const TIPO: Record<string, string> = { sinal: "Sinal", parcial: "Parcial", restante: "Restante", total: "Pagamento", pagamento: "Pagamento", migracao: "Pagamento" };

export async function carregarCaixa(uid: string): Promise<EstadoCaixa> {
  const vazio: EstadoCaixa = { precisaSql: false, configurado: false, semPagamentos: false, saldoInicial: 0, inicio: null, saldo: 0, entrouHoje: 0, saiuHoje: 0, movimentos: [] };
  const { data: perfil, error: ePerfil } = await supabase.from("profiles").select("caixa_saldo_inicial, caixa_inicio_em").eq("id", uid).maybeSingle();
  // 10/10: só é "falta o SQL" quando a coluna não existe; queda de internet vira erro (a tela oferece "Tentar de novo")
  if (ePerfil) return faltaNoBanco(ePerfil) ? { ...vazio, precisaSql: true } : { ...vazio, erro: true };
  const p: any = perfil || {};
  if (p.caixa_inicio_em == null || p.caixa_saldo_inicial == null) return vazio;

  const inicio: string = p.caixa_inicio_em;
  const hoje = hojeISO();
  const diaInicio = diaLocal(inicio);
  const saldoInicial = r2(p.caixa_saldo_inicial);

  // 10/10: tudo de 1.000 em 1.000 (o Supabase corta em 1.000 linhas sem avisar e o saldo ficava errado)
  const finDesde = (colunas: string) => buscarTudo<any>((de, ate) => supabase.from("financeiro").select(colunas)
    .eq("user_id", uid).gte("created_at", inicio).lte("data", hoje).order("id").range(de, ate)); // lançamento com data no futuro ainda não saiu do caixa
  const [pag, fin0, pagEst, finEst] = await Promise.all([
    buscarTudo<any>((de, ate) => supabase.from("pagamentos").select("id, valor, forma, tipo, recebido_em, pedido_id, created_at")
      .eq("user_id", uid).is("estornado_em", null).gte("created_at", inicio).lte("recebido_em", hoje).order("id").range(de, ate)),
    finDesde("id, tipo, categoria, descricao, valor, data, created_at, estornado_em"),
    // registrado ANTES do início do caixa e estornado DEPOIS (a conta está mais abaixo)
    buscarTudo<any>((de, ate) => supabase.from("pagamentos").select("id, valor, forma, pedido_id, estornado_em, observacao")
      .eq("user_id", uid).lt("created_at", inicio).gte("estornado_em", inicio).order("id").range(de, ate)),
    buscarTudo<any>((de, ate) => supabase.from("financeiro").select("id, tipo, categoria, descricao, valor, estornado_em")
      .eq("user_id", uid).lt("created_at", inicio).gte("estornado_em", inicio).lte("data", diaInicio).order("id").range(de, ate)),
  ]);
  // sem a coluna de estorno (SQL não rodado), busca sem ela. 10/10: só quando o erro é mesmo de coluna
  const fin = fin0.error && faltaNoBanco(fin0.error) ? await finDesde("id, tipo, categoria, descricao, valor, data, created_at") : fin0;
  const semPagamentos = !!pag.error && faltaNoBanco(pag.error);
  // 10/10: outro erro (internet, servidor) não vira saldo: antes os recebimentos sumiam ou os estornados voltavam a contar
  if ((pag.error && !semPagamentos) || fin.error
    || (pagEst.error && !faltaNoBanco(pagEst.error)) || (finEst.error && !faltaNoBanco(finEst.error))) return { ...vazio, erro: true };
  const pagamentos: any[] = semPagamentos ? [] : pag.data;
  const lancamentos: any[] = fin.data.filter(l => !l.estornado_em); // estornado não conta
  // estorno feito porque o pedido foi excluído não é devolução: o dinheiro contado no saldo informado continua lá
  const pagDesfeitos: any[] = pagEst.error ? [] : pagEst.data.filter((g: any) => g.observacao !== ESTORNO_POR_EXCLUSAO);
  const finDesfeitos: any[] = finEst.error ? [] : finEst.data;

  // nome do pedido (número e cliente) só dos recebimentos mais recentes, os que aparecem em "Últimas movimentações"
  // (10/10: com todos os recebimentos, a lista de ids pode passar do tamanho que o servidor aceita)
  const ordemPag = (g: any) => `${g.recebido_em} ${g.created_at || ""}`;
  const recentes = [...pagamentos].sort((a, b) => ordemPag(b).localeCompare(ordemPag(a))).slice(0, 40);
  const estornosRecentes = [...pagDesfeitos].sort((a, b) => String(b.estornado_em).localeCompare(String(a.estornado_em))).slice(0, 20);
  const ids = [...new Set([...recentes, ...estornosRecentes].map(g => g.pedido_id).filter(Boolean))];
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
      id: "g" + g.id, tipo: "entrada", valor: v, data: g.recebido_em, ordem: ordemPag(g),
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
  // 10/10 · Estorno, DEPOIS do início do caixa, de algo registrado ANTES dele. Esse valor já estava dentro do saldo
  // que ela informou (o recebimento estava na gaveta; a despesa já tinha saído). Ao estornar, o dinheiro anda agora,
  // no sentido contrário:
  //   recebimento ou entrada antiga estornada → saldo − valor (o dinheiro saiu)
  //   saída antiga estornada ................ → saldo + valor (o dinheiro voltou)
  // Antes o saldo não mexia. O que foi registrado e estornado depois do início continua fora da conta (soma zero),
  // e o que foi estornado antes do início já estava no saldo informado. Entra no dia do estorno.
  for (const g of pagDesfeitos) {
    const v = r2(g.valor); const dia = diaLocal(g.estornado_em);
    saldo -= v; if (dia === hoje) saiuHoje += v;
    const n = g.pedido_id ? nomes[g.pedido_id] : null;
    movimentos.push({
      id: "eg" + g.id, tipo: "saida", valor: v, data: dia, ordem: `${dia} ${g.estornado_em}`,
      titulo: `Estorno${n ? ` · Pedido #${n.numero ?? "—"}` : " de recebimento"}`,
      detalhe: [n?.cliente, FORMA[g.forma] || g.forma].filter(Boolean).join(" · "),
    });
  }
  for (const l of finDesfeitos) {
    const v = r2(l.valor); const eraEntrada = l.tipo === "entrada"; const dia = diaLocal(l.estornado_em);
    if (eraEntrada) { saldo -= v; if (dia === hoje) saiuHoje += v; } else { saldo += v; if (dia === hoje) entrouHoje += v; }
    movimentos.push({
      id: "ef" + l.id, tipo: eraEntrada ? "saida" : "entrada", valor: v, data: dia, ordem: `${dia} ${l.estornado_em}`,
      titulo: `Estorno · ${l.descricao || l.categoria || (eraEntrada ? "Entrada" : "Despesa")}`,
      detalhe: eraEntrada ? "Entrada estornada" : "Despesa estornada",
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

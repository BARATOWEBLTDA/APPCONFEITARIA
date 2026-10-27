import { supabase } from "@/lib/supabase";
import { recebidoPedido, saldoPedido } from "@/components/pedidos/pedidoTexto";

/**
 * (21/10) Resumo do negócio que vai junto com cada pergunta pra Doo IA.
 * Antes ela não via nenhum número e respondia "não tenho acesso ao seu histórico de vendas".
 * "Vendas" = pedidos registrados (sem os cancelados). Se a leitura falhar, a Doo segue sem os números.
 */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const real = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

export async function resumoDoNegocio(uid: string): Promise<string> {
  const agora = new Date();
  const hoje = iso(agora);
  const iniMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const em7 = new Date(agora); em7.setDate(em7.getDate() + 7);
  const CAMPOS = "numero, cliente_nome, valor_total, status, status_pagamento, valor_recebido, data_entrega, horario_entrega, created_at, origem";
  const [mes, prox] = await Promise.all([
    // (27/10) "Quanto vendi" não conta pedido ainda não aceito
    supabase.from("pedidos").select(CAMPOS).eq("user_id", uid).gte("created_at", iniMes.toISOString()).not("status", "in", "(cancelado,recusado,aguardando_aceite,novo,pendente)").limit(2000),
    supabase.from("pedidos").select(CAMPOS).eq("user_id", uid).gte("data_entrega", hoje).lte("data_entrega", iso(em7)).neq("status", "cancelado")
      .order("data_entrega", { ascending: true }).order("horario_entrega", { ascending: true, nullsFirst: false }).limit(40),
  ]);
  if (mes.error || prox.error) return "";
  const doMes = (mes.data || []) as any[];
  const deHoje = doMes.filter(p => iso(new Date(p.created_at)) === hoje);
  const soma = (l: any[], f: (p: any) => number) => Math.round(l.reduce((s, p) => s + f(p), 0) * 100) / 100;
  const total = (p: any) => Number(p.valor_total) || 0;
  const entregas = ((prox.data || []) as any[]);
  const entregasHoje = entregas.filter(p => String(p.data_entrega).slice(0, 10) === hoje);
  const linha = (p: any) => `- #${p.numero ?? "?"} · ${p.cliente_nome || "Venda avulsa"} · ${dm(String(p.data_entrega).slice(0, 10))}${p.horario_entrega ? ` ${String(p.horario_entrega).slice(0, 5)}` : ""} · ${real(total(p))} · ${p.status}`;
  return `

# DADOS DO NEGÓCIO DELA (do app, agora)
Use estes números quando ela perguntar das vendas, do faturamento, do que falta receber ou das entregas. Valores sempre com centavos. Não invente números que não estão aqui; se perguntar algo que não está aqui, diga em que tela do app ela encontra (Financeiro, Pedidos ou Agenda).
"Vendas" = pedidos registrados no app (sem os cancelados), pela data em que o pedido foi feito.
- Vendas de hoje (${dm(hoje)}): ${deHoje.length} pedido(s), ${real(soma(deHoje, total))}; já recebido ${real(soma(deHoje, recebidoPedido))}.
- Vendas do mês (desde ${dm(iso(iniMes))}): ${doMes.length} pedido(s), ${real(soma(doMes, total))}; já recebido ${real(soma(doMes, recebidoPedido))}; falta receber ${real(soma(doMes, saldoPedido))}.
- Entregas de hoje: ${entregasHoje.length}${entregasHoje.length ? "\n" + entregasHoje.slice(0, 15).map(linha).join("\n") : ""}
- Entregas dos próximos 7 dias: ${entregas.length}${entregas.length ? "\n" + entregas.slice(0, 25).map(linha).join("\n") : ""}
`;
}

import { supabase } from "@/lib/supabase";
import { grupoDoStatus, recebidoPedido, saldoPedido } from "@/components/pedidos/pedidoTexto";
import { pedidoAtrasado } from "@/lib/pedidoStatus";

/**
 * (21/10) Resumo do negócio que vai junto com cada pergunta pra Doo IA.
 * Antes ela não via nenhum número e respondia "não tenho acesso ao seu histórico de vendas".
 * "Vendas" = pedidos registrados (sem os cancelados). Se a leitura falhar, a Doo segue sem os números.
 */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const real = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
/** Os campos lidos do pedido (CAMPOS abaixo) */
type PedidoResumo = {
  numero: number | null; cliente_nome: string | null; valor_total: number | null; status: string | null; status_pagamento: string | null;
  valor_recebido: number | null; data_entrega: string | null; horario_entrega: string | null; created_at: string; origem: string | null;
};

export async function resumoDoNegocio(uid: string): Promise<string> {
  const agora = new Date();
  const hoje = iso(agora);
  const iniMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const em7 = new Date(agora); em7.setDate(em7.getDate() + 7);
  const CAMPOS = "numero, cliente_nome, valor_total, status, status_pagamento, valor_recebido, data_entrega, horario_entrega, created_at, origem";
  const [mes, prox, abertos, contas, orcs, clis, avisos] = await Promise.all([
    // (27/10) "Quanto vendi" não conta pedido ainda não aceito
    supabase.from("pedidos").select(CAMPOS).eq("user_id", uid).gte("created_at", iniMes.toISOString()).not("status", "in", "(cancelado,recusado,aguardando_aceite,novo,pendente)").limit(2000),
    supabase.from("pedidos").select(CAMPOS).eq("user_id", uid).gte("data_entrega", hoje).lte("data_entrega", iso(em7)).neq("status", "cancelado")
      .order("data_entrega", { ascending: true }).order("horario_entrega", { ascending: true, nullsFirst: false }).limit(40),
    // (6.97) atrasados, novos para aceitar e o que ainda falta receber (antes a Doo dizia que não via os atrasados)
    supabase.from("pedidos").select(CAMPOS).eq("user_id", uid).not("status", "in", "(cancelado,recusado)")
      .or(`data_entrega.lt.${hoje},status.in.(aguardando_aceite,novo,pendente,aguardando_pagamento),status_pagamento.neq.pago`)
      .order("data_entrega", { ascending: true }).limit(300),
    // (6.97) contas a pagar (vencidas e dos próximos 7 dias), orçamentos abertos e aniversários da semana
    supabase.from("contas_pagar").select("descricao, valor, vencimento").eq("user_id", uid).eq("status", "pendente").lte("vencimento", iso(em7)).order("vencimento").limit(30),
    supabase.from("orcamentos").select("numero, cliente_nome, status, data_evento, enviado_em").eq("user_id", uid).in("status", ["novo", "rascunho", "enviado"]).order("created_at", { ascending: false }).limit(20),
    supabase.from("clientes").select("nome, data_nascimento").eq("user_id", uid).not("data_nascimento", "is", null).limit(2000),
    // (6.101) avisos da equipe Doonly e novidades dos últimos 15 dias
    supabase.from("notificacoes").select("tipo, titulo, mensagem, created_at").eq("user_id", uid).in("tipo", ["aviso", "noticia", "pro", "sugestao", "conquista"]).gte("created_at", new Date(Date.now() - 15 * 86400000).toISOString()).order("created_at", { ascending: false }).limit(8),
  ]);
  if (mes.error || prox.error) return "";
  const lAbertos = ((abertos.data || []) as PedidoResumo[]);
  const atrasados = lAbertos.filter(p => pedidoAtrasado(p, hoje));
  const novos = lAbertos.filter(p => grupoDoStatus(String(p.status)) === "aguardando_aceite" || p.status === "aguardando_pagamento");
  const aReceber = lAbertos.filter(p => saldoPedido(p) > 0.009);
  const lContas = ((contas.data || []) as { descricao: string; valor: number; vencimento: string }[]);
  const lOrcs = ((orcs.data || []) as { numero: number; cliente_nome: string | null; status: string; data_evento: string | null }[]);
  const md = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const proxDias = Array.from({ length: 8 }, (_, k) => { const d = new Date(agora); d.setDate(d.getDate() + k); return md(d); });
  const nivers = ((clis.data || []) as { nome: string; data_nascimento: string }[]).filter(c => proxDias.includes(String(c.data_nascimento).slice(5, 10)))
    .sort((a, b) => proxDias.indexOf(String(a.data_nascimento).slice(5, 10)) - proxDias.indexOf(String(b.data_nascimento).slice(5, 10)));
  const doMes = (mes.data || []) as PedidoResumo[];
  const deHoje = doMes.filter(p => iso(new Date(p.created_at)) === hoje);
  const soma = (l: PedidoResumo[], f: (p: PedidoResumo) => number) => Math.round(l.reduce((s, p) => s + f(p), 0) * 100) / 100;
  const total = (p: PedidoResumo) => Number(p.valor_total) || 0;
  const entregas = ((prox.data || []) as PedidoResumo[]);
  const entregasHoje = entregas.filter(p => String(p.data_entrega).slice(0, 10) === hoje);
  const linha = (p: PedidoResumo) => `- #${p.numero ?? "?"} · ${p.cliente_nome || "Venda avulsa"} · ${dm(String(p.data_entrega).slice(0, 10))}${p.horario_entrega ? ` ${String(p.horario_entrega).slice(0, 5)}` : ""} · ${real(total(p))} · ${p.status}`;
  return `

# DADOS DO NEGÓCIO DELA (do app, agora)
Use estes números quando ela perguntar das vendas, do faturamento, do que falta receber ou das entregas. Valores sempre com centavos. Não invente números que não estão aqui; se perguntar algo que não está aqui, diga em que tela do app ela encontra (Financeiro, Pedidos ou Agenda).
"Vendas" = pedidos registrados no app (sem os cancelados), pela data em que o pedido foi feito.
- Vendas de hoje (${dm(hoje)}): ${deHoje.length} pedido(s), ${real(soma(deHoje, total))}; já recebido ${real(soma(deHoje, recebidoPedido))}.
- Vendas do mês (desde ${dm(iso(iniMes))}): ${doMes.length} pedido(s), ${real(soma(doMes, total))}; já recebido ${real(soma(doMes, recebidoPedido))}; falta receber ${real(soma(doMes, saldoPedido))}.
- Entregas de hoje: ${entregasHoje.length}${entregasHoje.length ? "\n" + entregasHoje.slice(0, 15).map(linha).join("\n") : ""}
- Entregas dos próximos 7 dias: ${entregas.length}${entregas.length ? "\n" + entregas.slice(0, 25).map(linha).join("\n") : ""}
- Pedidos ATRASADOS (a data de entrega já passou e ainda não ficaram prontos): ${atrasados.length}${atrasados.length ? "\n" + atrasados.slice(0, 25).map(linha).join("\n") : ""}
- Pedidos novos esperando ela aceitar (ou o Pix do cliente): ${novos.length}${novos.length ? "\n" + novos.slice(0, 15).map(linha).join("\n") : ""}
- Pedidos com valor a receber: ${aReceber.length}, total ${real(soma(aReceber, saldoPedido))}${aReceber.length ? "\n" + aReceber.slice(0, 20).map(p => `${linha(p)} · falta ${real(saldoPedido(p))}`).join("\n") : ""}
- Contas a pagar vencidas ou até ${dm(iso(em7))}: ${lContas.length}${lContas.length ? "\n" + lContas.map(c => `- ${c.descricao} · ${real(Number(c.valor) || 0)} · vence ${dm(c.vencimento)}${c.vencimento < hoje ? " (VENCIDA)" : ""}`).join("\n") : ""}
- Orçamentos em aberto (novos, rascunho ou enviados esperando o cliente): ${lOrcs.length}${lOrcs.length ? "\n" + lOrcs.map(o => `- Orçamento #${o.numero} · ${o.cliente_nome || "sem nome"} · ${o.status}${o.data_evento ? ` · evento ${dm(o.data_evento)}` : ""}`).join("\n") : ""}
- Clientes que fazem aniversário nos próximos 7 dias: ${nivers.length}${nivers.length ? "\n" + nivers.map(c => `- ${c.nome} · ${String(c.data_nascimento).slice(8, 10)}/${String(c.data_nascimento).slice(5, 7)}`).join("\n") : ""}
- Avisos e novidades da equipe Doonly para ela (últimos 15 dias): ${((avisos.data || []) as { titulo: string; mensagem: string; created_at: string }[]).length}${((avisos.data || []) as { titulo: string; mensagem: string; created_at: string }[]).map(a => `\n- ${dm(a.created_at.slice(0, 10))} · ${a.titulo}: ${(a.mensagem || '').slice(0, 160)}`).join('')}
Status: aguardando_aceite = novo, agendado = aceito, em_producao = produzindo, finalizado/aguardando_retirada = pronto, em_entrega = saiu, entregue = concluído.
`;
}

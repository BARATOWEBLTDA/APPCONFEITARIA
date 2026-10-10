import { supabase } from "@/lib/supabase";
import { valorRecebidoPedido } from "@/lib/financeiroPedido";
import { buscarTudo } from "@/lib/buscarTudo";

/**
 * Contas a receber (Passo 2) e recebimentos previstos (Passo 6) — a MESMA regra pros dois.
 * Pedido entra se: não está cancelado nem estornado, e tem saldo (total − recebido > 0).
 * A data de referência é a combinada pro pagamento ou, sem ela, a da entrega.
 * Recebimentos previstos são só projeção: NÃO somam no saldo em caixa.
 */
export type ItemReceber = {
  id: string; numero: number | null; cliente_nome: string | null;
  valor_total: number | null; valor_recebido: number | null;
  status: string | null; status_pagamento: string | null; forma_pagamento: string | null;
  data_entrega: string | null; horario_entrega: string | null; data_prevista_pagamento: string | null;
  total: number; recebido: number; falta: number; dataRef: string | null; dias: number | null;
};

export const isoDia = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const diasAte = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); const h = new Date(); return Math.round((new Date(y, m - 1, d).getTime() - new Date(h.getFullYear(), h.getMonth(), h.getDate()).getTime()) / 86400000); };

/**
 * 10/10: devolve { itens, erro }. Com erro (internet, servidor) a tela avisa "Não deu pra carregar":
 * antes a lista vinha vazia e aparecia "Nada a receber".
 * A busca vai de 1.000 em 1.000 (o Supabase corta em 1.000 linhas sem avisar) e já deixa de fora, no banco,
 * os pedidos pagos e os estornados: eles nunca têm saldo, então o resultado é o mesmo.
 */
export async function carregarAReceber(uid: string): Promise<{ itens: ItemReceber[]; erro: boolean }> {
  const { data, error } = await buscarTudo<any>((de, ate) => supabase.from("pedidos")
    .select("id, numero, cliente_nome, valor_total, valor_recebido, status, status_pagamento, forma_pagamento, data_entrega, horario_entrega, data_prevista_pagamento")
    .eq("user_id", uid).neq("status", "cancelado")
    .or("status_pagamento.is.null,status_pagamento.not.in.(pago,estornado)")
    .order("id").range(de, ate));
  if (error) { console.error("[a receber] não consegui carregar:", error); return { itens: [], erro: true }; }
  const itens = data
    .filter(p => p.status_pagamento !== "estornado")
    .map(p => {
      const total = Number(p.valor_total) || 0;
      const recebido = valorRecebidoPedido(p);
      const dataRef = p.data_prevista_pagamento || p.data_entrega || null;
      return { ...p, total, recebido, falta: Math.round((total - recebido) * 100) / 100, dataRef, dias: dataRef ? diasAte(dataRef) : null } as ItemReceber;
    })
    .filter(p => p.falta > 0.009)
    .sort((a, b) => (a.dataRef || "9999").localeCompare(b.dataRef || "9999"));
  return { itens, erro: false };
}

export type Previstos = { d7: number; d15: number; d30: number; atrasados: number; semData: number; qtd30: number };

/**
 * Quanto deve entrar em FAIXAS que não se repetem (03/10): próximos 7 dias (hoje até o 7º dia),
 * do 8º ao 15º e do 16º ao 30º. Cada pedido aparece numa faixa só (antes era acumulado e o mesmo
 * pedido aparecia nos três números). Mais o que já está atrasado.
 */
export function calcularPrevistos(itens: ItemReceber[]): Previstos {
  const r = { d7: 0, d15: 0, d30: 0, atrasados: 0, semData: 0, qtd30: 0 };
  for (const it of itens) {
    if (it.dias === null) { r.semData += it.falta; continue; }
    if (it.dias < 0) { r.atrasados += it.falta; continue; }
    if (it.dias <= 6) r.d7 += it.falta;
    else if (it.dias <= 14) r.d15 += it.falta;
    else if (it.dias <= 29) r.d30 += it.falta;
    if (it.dias <= 29) r.qtd30++;
  }
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return { d7: r2(r.d7), d15: r2(r.d15), d30: r2(r.d30), atrasados: r2(r.atrasados), semData: r2(r.semData), qtd30: r.qtd30 };
}

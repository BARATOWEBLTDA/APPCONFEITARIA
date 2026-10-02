// ── duplicarPedido.ts ────────────────────────────────────────────────────────
// Cópia completa de um pedido (02/10): cliente, entrega, endereço, itens com todas
// as escolhas e valores. A cópia nasce "agendada" e "a receber" (sem sinal, sem
// cupom), com o mesmo dia/horário — quem duplicou ajusta a data na edição.
// Antes o "Duplicar" abria a Nova venda vazia (o pedido não era copiado).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "@/lib/supabase";

const FORA_DO_PEDIDO = new Set([
  "id", "numero", "created_at", "updated_at", "status", "status_pagamento", "valor_recebido",
  "cupom_codigo", "data_prevista_pagamento", "pedido_itens", "clientes", "origem",
]);
const FORA_DO_ITEM = new Set(["id", "pedido_id", "created_at", "updated_at", "produtos"]);

export async function duplicarPedido(id: string): Promise<{ id: string } | { erro: string }> {
  const { data: orig, error } = await supabase.from("pedidos").select("*, pedido_itens(*)").eq("id", id).maybeSingle();
  if (error || !orig) return { erro: "Não foi possível carregar o pedido pra duplicar." };

  const novo: any = {};
  Object.entries(orig).forEach(([k, v]) => { if (!FORA_DO_PEDIDO.has(k)) novo[k] = v; });
  Object.assign(novo, { status: "agendado", status_pagamento: "pendente", valor_recebido: 0, origem: "manual" });
  // Sem o cupom, o desconto do cupom também não vale na cópia
  if (orig.cupom_codigo && Number(orig.desconto) > 0) {
    novo.valor_total = Math.max(0, (Number(orig.valor_total) || 0) + (Number(orig.desconto) || 0));
    novo.desconto = 0;
  }

  const { data: criado, error: e2 } = await supabase.from("pedidos").insert(novo).select("id").single();
  if (e2 || !criado?.id) return { erro: "Não foi possível criar a cópia: " + (e2?.message || "tente de novo.") };

  const itens = (orig.pedido_itens || []).map((it: any) => {
    const n: any = {};
    Object.entries(it).forEach(([k, v]) => { if (!FORA_DO_ITEM.has(k)) n[k] = v; });
    n.pedido_id = criado.id;
    return n;
  });
  if (itens.length) {
    const { error: e3 } = await supabase.from("pedido_itens").insert(itens);
    if (e3) {
      await supabase.from("pedidos").delete().eq("id", criado.id); // não deixa cópia pela metade
      return { erro: "Não foi possível copiar os itens: " + e3.message };
    }
  }
  return { id: criado.id };
}

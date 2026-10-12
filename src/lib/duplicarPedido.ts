// ── duplicarPedido.ts ────────────────────────────────────────────────────────
// Cópia completa de um pedido (02/10): cliente, entrega, endereço, itens com todas
// as escolhas e valores. A cópia nasce "agendada" e "a receber" (sem sinal, sem
// cupom), com o mesmo dia/horário — quem duplicou ajusta a data na edição.
// Antes o "Duplicar" abria a Nova venda vazia (o pedido não era copiado).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "@/lib/supabase";
import { explicarErro } from "@/lib/erros";
import { r2, somarReais } from "@/lib/moeda";

const FORA_DO_PEDIDO = new Set([
  "id", "numero", "created_at", "updated_at", "status", "status_pagamento", "valor_recebido",
  "cupom_codigo", "data_prevista_pagamento", "pedido_itens", "clientes", "origem",
]);
const FORA_DO_ITEM = new Set(["id", "pedido_id", "created_at", "updated_at", "produtos"]);
const ERRO_DUPLICAR = "Não deu pra duplicar o pedido. Tente de novo.";

/**
 * (11/10) A cópia nasce SEM cupom e SEM desconto nem acréscimo (os ajustes eram daquele pedido, daquela entrega):
 * o total volta a ser produtos + taxa de entrega. Antes ela levava o desconto dado na entrega e, com cupom,
 * perdia o desconto todo mas guardava o valor do cupom solto.
 * "aviso" é a frase pra mostrar depois de duplicar (diz quando a cópia veio sem os descontos do original).
 */
export async function duplicarPedido(id: string): Promise<{ id: string; aviso: string } | { erro: string }> {
  const { data: orig, error } = await supabase.from("pedidos").select("*, pedido_itens(*)").eq("id", id).maybeSingle();
  if (error || !orig) return { erro: explicarErro(error, "Não deu pra carregar o pedido pra duplicar. Tente de novo.") };

  const novo: any = {};
  Object.entries(orig).forEach(([k, v]) => { if (!FORA_DO_PEDIDO.has(k)) novo[k] = v; });
  Object.assign(novo, { status: "agendado", status_pagamento: "pendente", valor_recebido: 0, origem: "manual" });
  const itensOrig: any[] = orig.pedido_itens || [];
  const tinhaDesconto = !!orig.cupom_codigo || Number(orig.desconto) > 0 || Number(orig.cupom_desconto) > 0;
  const tinhaAcrescimo = Number(orig.acrescimo) > 0;
  // só mexe nas colunas que o pedido original tem (a conta pode não ter "acrescimo" nem "cupom_desconto")
  if ("desconto" in orig) novo.desconto = 0;
  if ("acrescimo" in orig) novo.acrescimo = 0;
  if ("cupom_desconto" in orig) novo.cupom_desconto = 0;
  const produtos = itensOrig.length
    ? somarReais(itensOrig.map(it => r2((Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 0))))
    : r2(Number(orig.valor_produtos) || Math.max(0, (Number(orig.valor_total) || 0) + (Number(orig.desconto) || 0) - (Number(orig.acrescimo) || 0) - (Number(orig.taxa_entrega) || 0)));
  if ("valor_produtos" in orig && itensOrig.length) novo.valor_produtos = produtos;
  // (11/10) taxa de entrega só conta quando o pedido é de entrega (retirada com taxa velha somava errado)
  const taxa = orig.tipo_entrega === "entrega" ? Number(orig.taxa_entrega) || 0 : 0;
  if ("taxa_entrega" in orig) novo.taxa_entrega = taxa;
  novo.valor_total = somarReais([produtos, taxa]);

  const { data: criado, error: e2 } = await supabase.from("pedidos").insert(novo).select("id, numero").single();
  if (e2 || !criado?.id) return { erro: explicarErro(e2, ERRO_DUPLICAR) };

  const itens = itensOrig.map((it: any) => {
    const n: any = {};
    Object.entries(it).forEach(([k, v]) => { if (!FORA_DO_ITEM.has(k)) n[k] = v; });
    n.pedido_id = criado.id;
    return n;
  });
  if (itens.length) {
    const { error: e3 } = await supabase.from("pedido_itens").insert(itens);
    if (e3) {
      const falha = explicarErro(e3, ERRO_DUPLICAR);
      // não deixa cópia pela metade (11/10: se nem apagar der, avisa qual pedido ficou sem produtos)
      const { data: apagada, error: e4 } = await supabase.from("pedidos").delete().eq("id", criado.id).select("id");
      if (e4 || !(apagada as any[] | null)?.length) {
        if (e4) console.error("[Doonly] cópia sem produtos que não deu pra apagar:", e4);
        return { erro: `A cópia${(criado as any).numero ? ` (pedido #${(criado as any).numero})` : ""} ficou salva sem os produtos. Abra a lista de pedidos e exclua essa cópia.` };
      }
      return { erro: falha };
    }
  }
  const semO = tinhaDesconto && tinhaAcrescimo ? " A cópia veio sem os descontos e o acréscimo do pedido original."
    : tinhaDesconto ? " A cópia veio sem os descontos do pedido original."
    : tinhaAcrescimo ? " A cópia veio sem o acréscimo do pedido original." : "";
  return { id: criado.id, aviso: `Pedido duplicado.${semO}` };
}

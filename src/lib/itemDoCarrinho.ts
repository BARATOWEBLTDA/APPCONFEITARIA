import { criarBreakdownV1, criarPersonalizacoesV1, SNAPSHOT_VERSION_ATUAL } from '@/lib/pedido-snapshot'

/**
 * Item do carrinho (janela de produto do cardápio) → item de pedido (03/10).
 * Uma regra só: usada pelo cardápio (ao enviar o pedido) e pelo Editar pedido (ao adicionar um item com opções).
 * Guarda tudo o que foi escolhido: tamanho, massa, recheios, cobertura, sabor, kit, adicionais e foto de referência.
 */
export function itemDoCarrinhoParaPedido(item: any) {
  const escolhas = item.escolhas || {}
  const personalizacoes = escolhas.massa || escolhas.recheios || escolhas.cobertura || escolhas.sabor || escolhas.tamanho || escolhas.kit
    ? {
        massa: escolhas.massa || null,
        recheios: escolhas.recheios || undefined,
        cobertura: escolhas.cobertura || null,
        sabor: escolhas.sabor || null,
        tamanho: escolhas.tamanho || null,
        ...(escolhas.kit ? { kit: escolhas.kit } : {}),
      }
    : criarPersonalizacoesV1({
        massa: item.selectedMassa || null,
        recheio: item.selectedRecheio || null,
        cobertura: item.selectedCobertura || null,
      })
  const breakdown = item.precoBreakdown ? item.precoBreakdown : criarBreakdownV1({ final: item.price })
  const temExtras = Array.isArray(item.extrasBiblioteca) && item.extrasBiblioteca.length > 0
  const personalizacoesFinal = (temExtras || item.fotoReferencia)
    ? {
        ...(personalizacoes || {}),
        ...(temExtras ? { extras: item.extrasBiblioteca.map((x: any) => ({ nome: x.nome, valor: Number(x.valor) || 0 })) } : {}),
        ...(item.fotoReferencia ? { foto_referencia: item.fotoReferencia } : {}),
      }
    : personalizacoes
  return {
    produto_id: item.id,
    nome_produto: item.name,
    quantidade: item.quantity,
    valor_unitario: item.price,
    observacoes: item.observations || null,
    personalizacoes: personalizacoesFinal,
    preco_breakdown: breakdown,
    snapshot_version: SNAPSHOT_VERSION_ATUAL,
  }
}

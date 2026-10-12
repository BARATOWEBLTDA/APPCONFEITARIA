/**
 * Item de pedido vendido por PESO LIVRE (11/10): produto por kg em que a quantidade É o peso (1,5 kg de bolo).
 * Não é peso livre quando o item tem tamanho escolhido ("M · 2 kg") ou é um kit: aí a quantidade é 1, 2, 3… unidades
 * daquele tamanho/kit, e o preço unitário já é o do tamanho inteiro.
 *
 * Antes cada tela olhava só `forma_venda === 'kg'`: o bolo "M · 2 kg" aparecia como "1 kg" e o "+" somava meio quilo.
 * A sacola do cardápio já usava essa regra (kgLivre, em lib/itemSacola); esta é a mesma, pro item gravado no pedido.
 *
 *   pesoLivre({ quantidade: 1.5, personalizacoes: null }, 'kg')                      → true
 *   pesoLivre({ quantidade: 1, personalizacoes: { tamanho: { nome: 'M' } } }, 'kg')   → false
 *   pesoLivre({ quantidade: 2 }, 'unidade')                                           → false
 */
export function pesoLivre(item: { personalizacoes?: any; forma_venda?: string | null } | null | undefined, formaVendaDoProduto?: string | null): boolean {
  const forma = formaVendaDoProduto ?? item?.forma_venda ?? null;
  if (forma !== "kg") return false;
  let pers = item?.personalizacoes;
  if (typeof pers === "string") { try { pers = JSON.parse(pers); } catch { pers = null; } }
  const escolhas = pers?.escolhas ?? pers; // os dois formatos que o app grava
  if (escolhas?.tamanho || pers?.tamanho) return false;
  if (escolhas?.kit || pers?.kit) return false;
  return true;
}

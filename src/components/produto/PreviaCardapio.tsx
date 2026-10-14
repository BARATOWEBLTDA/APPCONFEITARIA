import { ProductCard } from "@/components/cardapio/ProductCard";
import { CartaoPromo } from "@/components/cardapio/ItensCardapio";
import { descontoCardapio } from "@/lib/precoCardapio";
import type { Produto } from "@/types/database";
import { CartProvider } from "@/context/CartContext";

/**
 * (14/10) Prévia real: o produto como ele aparece no cardápio, no modelo de cartão (foto em cima, textos embaixo),
 * com o MESMO componente do cardápio. Muda na hora em que ela digita. (14/10) Só pra ver: tocar não abre nada.
 */
export default function PreviaCardapio({ form, cor = "#E85A8C" }: { form: any; cor?: string }) {
  const produto = { ...form, id: form.id || "previa", disponivel: true } as unknown as Produto;
  return (
    <div className="prev-cardapio">
      <p className="prod-section-label prev-cardapio-t">Assim aparece no cardápio</p>
      {/* sacola de mentira só pra prévia (o produto aberto pede uma): não mistura com a sacola de verdade */}
      <CartProvider>
        {/* (14/10) o cartão de Promoções não tem fundo próprio: a caixa fica branca, como a página do cardápio */}
        <div className={`prev-cardapio-box${descontoCardapio(produto) > 0 ? " prev-cardapio-box--promo" : ""}`}>
          <div className="prev-cardapio-card" aria-hidden="true" onClickCapture={e => { e.preventDefault(); e.stopPropagation(); }} onKeyDownCapture={e => { e.preventDefault(); e.stopPropagation(); }}>
            {/* (14/10) em promoção usa o mesmo cartão da seção Promoções do cardápio (com o % e o -10%) */}
            {descontoCardapio(produto) > 0
              ? <CartaoPromo produto={produto} cor={cor} />
              : <ProductCard product={produto} isFavorite={false} onToggleFavorite={() => {}} backgroundColor="#fff" corBotao={cor} />}
          </div>
        </div>
      </CartProvider>
    </div>
  );
}

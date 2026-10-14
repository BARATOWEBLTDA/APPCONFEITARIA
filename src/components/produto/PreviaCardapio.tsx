import { ProductCard } from "@/components/cardapio/ProductCard";
import type { Produto } from "@/types/database";
import { CartProvider } from "@/context/CartContext";

/**
 * (14/10) Prévia real: o produto como ele aparece no cardápio, no modelo de cartão (foto em cima, textos embaixo),
 * com o MESMO componente do cardápio. Muda na hora em que ela digita; tocar abre o produto como o cliente vê.
 */
export default function PreviaCardapio({ form, cor = "#E85A8C" }: { form: any; cor?: string }) {
  const produto = { ...form, id: form.id || "previa", disponivel: true } as unknown as Produto;
  return (
    <div className="prev-cardapio">
      <p className="prev-cardapio-t">Assim aparece no cardápio</p>
      {/* sacola de mentira só pra prévia (o produto aberto pede uma): não mistura com a sacola de verdade */}
      <CartProvider>
        <div className="prev-cardapio-box">
          <div className="prev-cardapio-card">
            <ProductCard product={produto} isFavorite={false} onToggleFavorite={() => {}} backgroundColor="#fff" corBotao={cor} />
          </div>
        </div>
      </CartProvider>
    </div>
  );
}

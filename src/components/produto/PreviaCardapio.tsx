import { LinhaProduto } from "@/components/cardapio/ItensCardapio";
import type { Produto } from "@/types/database";
import { CartProvider } from "@/context/CartContext";

/**
 * (14/10) Prévia real: o produto como ele aparece no cardápio do celular, com o MESMO componente do cardápio
 * (foto, nome, descrição, preço, promoção e "Pedir X antes"). Muda na hora em que ela digita.
 * Tocar abre o produto como o cliente vê.
 */
export default function PreviaCardapio({ form, cor = "#E85A8C" }: { form: any; cor?: string }) {
  const produto = { ...form, id: form.id || "previa", disponivel: true } as unknown as Produto;
  return (
    <div className="prev-cardapio">
      <p className="prev-cardapio-t">Assim aparece no cardápio <span>toque pra abrir</span></p>
      {/* sacola de mentira só pra prévia (o produto aberto pede uma): não mistura com a sacola de verdade */}
      <CartProvider><div className="prev-cardapio-box"><LinhaProduto produto={produto} cor={cor} /></div></CartProvider>
    </div>
  );
}

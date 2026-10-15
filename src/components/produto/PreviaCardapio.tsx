import { useState } from "react";
import { Eye } from "@phosphor-icons/react";
import { CartaoPromo, LinhaProduto } from "@/components/cardapio/ItensCardapio";
import { ProductModal } from "@/components/cart/ProductModal";
import { descontoCardapio } from "@/lib/precoCardapio";
import type { Produto } from "@/types/database";
import { CartProvider } from "@/context/CartContext";

/**
 * (14/10) Prévia real, com os MESMOS componentes do cardápio. Muda na hora em que ela digita.
 * - Sempre: a linha da categoria (é como o cliente mais vê o produto; ocupa a largura toda).
 * - Em promoção: também o cartão da grade "Promoções", e ao lado um cartão "Ver por dentro".
 * - Sem promoção: botão "Ver o produto aberto".
 * Os cartões são só pra ver (tocar neles não abre nada); o "Ver por dentro" abre o produto em modo prévia.
 */
export default function PreviaCardapio({ form, cor = "#E85A8C" }: { form: any; cor?: string }) {
  const [aberto, setAberto] = useState(false);
  const produto = { ...form, id: form.id || "previa", disponivel: true } as unknown as Produto;
  const promo = descontoCardapio(produto) > 0;
  const travar = { onClickCapture: (e: any) => { e.preventDefault(); e.stopPropagation(); }, onKeyDownCapture: (e: any) => { e.preventDefault(); e.stopPropagation(); } };
  return (
    <div className="prev-cardapio prev-cardapio--v2">
      <p className="prod-section-label prev-cardapio-t">Assim aparece no cardápio</p>
      {/* sacola de mentira só pra prévia (o produto aberto pede uma): não mistura com a sacola de verdade */}
      <CartProvider>
        <div className="prev-cardapio-box">
          <div className="prev-linha" aria-hidden="true" {...travar}><LinhaProduto produto={produto} cor={cor} /></div>
          {promo ? (<>
            <p className="prev-sub">Também aparece em Promoções</p>
            <div className="prev-grade">
              <div className="prev-cartao" aria-hidden="true" {...travar}><CartaoPromo produto={produto} cor={cor} /></div>
              <button type="button" className="prev-ver" onClick={() => setAberto(true)}>
                <span className="prev-ver-ic" aria-hidden="true"><Eye size={24} weight="bold" /></span>
                <b>Ver por dentro</b><small>Toque pra ver o produto aberto</small>
              </button>
            </div>
          </>) : (
            <button type="button" className="prev-ver-bt" onClick={() => setAberto(true)}><Eye size={18} weight="bold" aria-hidden="true" />Ver o produto aberto</button>
          )}
        </div>
        <ProductModal isOpen={aberto} previa onClose={() => setAberto(false)} onAdicionar={() => setAberto(false)} product={produto} corBotao={cor} />
      </CartProvider>
    </div>
  );
}

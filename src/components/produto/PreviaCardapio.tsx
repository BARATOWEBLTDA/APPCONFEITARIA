import { useState } from "react";
import { Eye } from "@phosphor-icons/react";
import { CartaoPromo } from "@/components/cardapio/ItensCardapio";
import { ProductModal } from "@/components/cart/ProductModal";
import type { Produto } from "@/types/database";
import { CartProvider } from "@/context/CartContext";

/**
 * (15/10) Prévia real, com os MESMOS componentes do cardápio. Muda na hora em que ela digita.
 * O cartão do produto (com promoção mostra o preço riscado e o selo) e, ao lado, "Ver por dentro",
 * que abre o produto em modo prévia. O cartão é só pra ver (tocar nele não abre nada).
 */
export default function PreviaCardapio({ form, cor = "#E85A8C", fotosExtras = false }: { form: Record<string, unknown> & { id?: string }; cor?: string; fotosExtras?: boolean }) {
  // (6.161) Revisão no computador: as outras fotos (2 a 4) embaixo do cartão
  const extras = fotosExtras ? String(form.imagem_url || "").split(",").map(x => x.trim()).filter(Boolean).slice(1, 4) : [];
  const [aberto, setAberto] = useState(false);
  const produto = { ...form, id: form.id || "previa", disponivel: true } as unknown as Produto;
  const travar = { onClickCapture: (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); }, onKeyDownCapture: (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); } };
  return (
    <div className="prev-cardapio prev-cardapio--v2">
      <p className="prod-section-label prev-cardapio-t">Assim aparece no cardápio</p>
      {/* sacola de mentira só pra prévia (o produto aberto pede uma): não mistura com a sacola de verdade */}
      <CartProvider>
        <div className="prev-cardapio-box">
          <div className="prev-grade">
            <div className="prev-cartao" aria-hidden="true" {...travar}><CartaoPromo produto={produto} cor={cor} /></div>
            <button type="button" className="prev-ver" onClick={() => setAberto(true)}>
              <span className="prev-ver-ic" aria-hidden="true"><Eye size={24} weight="bold" /></span>
              <b>Ver por dentro</b><small>Como o cliente vê</small>
            </button>
          </div>
          {extras.length > 0 && <div className="prev-fotos" aria-label="Outras fotos">{extras.map(u => <img key={u} src={u} alt="" />)}</div>}
        </div>
        <ProductModal isOpen={aberto} previa onClose={() => setAberto(false)} onAdicionar={() => setAberto(false)} product={produto} corBotao={cor} />
      </CartProvider>
    </div>
  );
}

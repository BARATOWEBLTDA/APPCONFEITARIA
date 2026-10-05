import { useEffect } from "react";

/**
 * Trava a rolagem da página enquanto uma janela está aberta (03/10).
 * No iPhone, "overflow: hidden" no body não basta: a página é fixada na posição em que estava
 * e, ao fechar, volta exatamente pro mesmo ponto. Várias janelas abertas juntas: só destrava na última.
 */
let abertas = 0;
let posicao = 0;

export function useTravarRolagem(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    const b = document.body;
    if (abertas === 0) {
      posicao = window.scrollY;
      b.style.position = "fixed";
      b.style.top = `-${posicao}px`;
      b.style.left = "0";
      b.style.right = "0";
      b.style.width = "100%";
      b.style.overflow = "hidden";
    }
    abertas++;
    return () => {
      abertas = Math.max(0, abertas - 1);
      if (abertas === 0) {
        b.style.position = ""; b.style.top = ""; b.style.left = ""; b.style.right = ""; b.style.width = ""; b.style.overflow = "";
        window.scrollTo(0, posicao);
      }
    };
  }, [ativo]);
}

import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fazerTour } from "./tour";
import { informar } from "@/components/base";

/**
 * (27/10) "Mostrar na tela" da Central de Ajuda: a tela abre com a parte explicada acesa (o mesmo balão do tour).
 * Quem chama passa { acender: { el, titulo, texto } } no state da navegação. Espera a parte aparecer (até 5 s),
 * acende e limpa o state, para não acender de novo ao voltar.
 */
export type Acender = { el: string; titulo: string; texto: string };

const achar = (sel: string) => sel.split("||").some(s => [...document.querySelectorAll<HTMLElement>(s.trim())].some(e => e.getClientRects().length > 0));

export default function AcenderDaAjuda() {
  const location = useLocation();
  const navigate = useNavigate();
  const acender = (location.state as { acender?: Acender } | null)?.acender;
  useEffect(() => {
    if (!acender?.el) return;
    let vivo = true;
    const inicio = Date.now();
    const tentar = () => {
      if (!vivo) return;
      if (achar(acender.el)) {
        navigate(location.pathname + location.search, { replace: true, state: null });
        window.setTimeout(() => { void fazerTour([{ el: acender.el, titulo: acender.titulo, texto: acender.texto }], true); }, 350);
      } else if (Date.now() - inicio < 5000) window.setTimeout(tentar, 250);
      else {
        navigate(location.pathname + location.search, { replace: true, state: null });
        // (31/10 · 5.83) antes desistia calado: a parte pode aparecer só no celular ou só com pedido
        void informar({ titulo: "Essa parte não aparece agora", texto: "Ela aparece só no celular, ou quando houver algo para mostrar (como um pedido novo).", rotulo: "Entendi" });
      }
    };
    const t = window.setTimeout(tentar, 600);
    return () => { vivo = false; window.clearTimeout(t); };
  }, [acender]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { BotaoIcone, Titulo } from "@/components/base";
import { useSobreposicao } from "@/components/base/useSobreposicao";
import "@/components/base/base.css";
import "./folha.css";

/**
 * Janela de formulário curto (financeiro, ajuste do pedido, primeiros passos).
 * 09/10 (3.56): agora é a Janela do app (mesmo véu, cantos, título com X, Esc e "voltar" do Android).
 *   titulo / sub: em cima · children: os campos (classes fo-*) · acoes: os botões fixos embaixo (opcional; umaAcao = um botão na largura toda)
 */
export default function Folha({ titulo, sub, onClose, children, acoes, umaAcao = false }: { titulo: string; sub?: ReactNode; onClose: () => void; children: ReactNode; acoes?: ReactNode; umaAcao?: boolean }) {
  const caixa = useRef<HTMLDivElement>(null);
  const id = useId();
  useSobreposicao(true, onClose, caixa);
  return createPortal(
    <div className="ui-veu ui-veu--centro" onClick={onClose}>
      <div ref={caixa} tabIndex={-1} className="ui-janela ui-janela--conteudo fo" role="dialog" aria-modal="true" aria-labelledby={id} onClick={e => e.stopPropagation()}>
        <span className="ui-janela-alca" aria-hidden="true" />
        <div className="ui-janela-cab">
          <Titulo nivel="janela" id={id}>{titulo}</Titulo>
          <BotaoIcone rotulo="Fechar" variante="limpo" onClick={onClose}><X size={20} weight="bold" /></BotaoIcone>
        </div>
        <div className="ui-janela-corpo">
          {sub && <p className="fo-s">{sub}</p>}
          {children}
        </div>
        {acoes ? <div className={`ui-janela-pe${umaAcao ? " ui-janela-pe--um" : ""}`}>{acoes}</div> : <div className="ui-janela-fim" />}
      </div>
    </div>,
    document.body,
  );
}

/** Os estilos agora ficam em folha.css (importado acima). Mantido pra quem ainda injeta <style>{FOLHA_CSS}</style>. */
export const FOLHA_CSS = "";

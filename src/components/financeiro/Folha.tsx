import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { BotaoIcone, Titulo, confirmar } from "@/components/base";
import { useSobreposicao } from "@/components/base/useSobreposicao";
import "@/components/base/base.css";
import "./folha.css";

/**
 * Janela de formulário curto (financeiro, ajuste do pedido, primeiros passos).
 * 09/10 (3.56): agora é a Janela do app (mesmo véu, cantos, título com X, Esc e "voltar" do Android).
 *   titulo / sub: em cima · children: os campos (classes fo-*) · acoes: os botões fixos embaixo (opcional; umaAcao = um botão na largura toda)
 */
/** foco: fundo escuro e desfocado (o app por trás não aparece), usado no passo a passo da conta nova */
export default function Folha({ titulo, sub, onClose, children, acoes, umaAcao = false, foco = false }: { titulo: string; sub?: ReactNode; onClose: () => void; children: ReactNode; acoes?: ReactNode; umaAcao?: boolean; foco?: boolean }) {
  const caixa = useRef<HTMLDivElement>(null);
  const id = useId();
  // 11/10: tocar fora, Esc e o "voltar" do Android perguntam antes de jogar fora o que foi digitado (o X fecha direto).
  // "Digitado" = a pessoa mexeu num campo E ele está diferente de como a janela abriu (digitou e apagou não conta).
  const mexeu = useRef(false);
  const comoAbriu = useRef<string | null>(null);
  const perguntando = useRef(false);
  const lerCampos = () => Array.from(caixa.current?.querySelectorAll<HTMLInputElement>("input, textarea, select") || [])
    .map(c => (c.type === "checkbox" || c.type === "radio" ? String(c.checked) : c.value)).join("\u0001");
  // enquanto ninguém mexeu, o retrato acompanha a tela (campo que chega preenchido depois não conta como digitado)
  useEffect(() => { if (!mexeu.current) comoAbriu.current = lerCampos(); });
  const fecharComCuidado = async () => {
    if (perguntando.current) return;
    if (mexeu.current && comoAbriu.current !== null && lerCampos() !== comoAbriu.current) {
      perguntando.current = true;
      const ok = await confirmar({ titulo: "Descartar o que você digitou?", texto: "O que você preencheu vai se perder.", rotulo: "Descartar", rotuloVoltar: "Continuar", perigo: true, icone: "alerta" });
      perguntando.current = false;
      if (!ok) return;
    }
    onClose();
  };
  useSobreposicao(true, fecharComCuidado, caixa);
  return createPortal(
    <div className={`ui-veu ui-veu--centro${foco ? " ui-veu--foco" : ""}`} onClick={fecharComCuidado}>
      <div ref={caixa} tabIndex={-1} className="ui-janela ui-janela--conteudo fo" role="dialog" aria-modal="true" aria-labelledby={id} onClick={e => e.stopPropagation()}
        onInput={() => { mexeu.current = true; }} onChange={() => { mexeu.current = true; }}>
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

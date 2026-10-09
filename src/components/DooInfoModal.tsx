import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { Botao, BotaoIcone } from "@/components/base";
import { useSobreposicao } from "@/components/base/useSobreposicao";
import "@/components/base/base.css";

interface DooInfoModalProps {
  open: boolean;
  onClose: () => void;
  /** Caminho da imagem do mascote (ex: "/Sistema/precifique.png") */
  image: string;
  imageAlt?: string;
  /** Título (aceita JSX pra destacar o nome, o produto…) */
  title: ReactNode;
  /** Rótulo pros leitores de tela quando o título é JSX */
  ariaLabel?: string;
  /** Explicação */
  children: ReactNode;
  /** Texto do botão. Padrão: "Entendi" */
  ctaLabel?: string;
  /** Ação do botão. Padrão: fecha */
  onCta?: () => void;
}

/**
 * Explicação com o mascote (ex.: "Como calculamos o custo na receita").
 * 09/10 (3.57): na Janela do app (aviso): mascote, título, texto e um botão. Fecha no X, tocando fora, no Esc e no voltar do Android.
 */
export default function DooInfoModal({ open, onClose, image, imageAlt = "", title, ariaLabel = "Informação", children, ctaLabel = "Entendi", onCta }: DooInfoModalProps) {
  const caixa = useRef<HTMLDivElement>(null);
  const id = useId();
  useSobreposicao(open, onClose, caixa);
  if (!open) return null;
  return createPortal(
    <div className="ui-veu ui-veu--centro" onClick={onClose}>
      <div ref={caixa} tabIndex={-1} className="ui-janela ui-janela--aviso dim" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? undefined : ariaLabel} aria-labelledby={typeof title === "string" ? id : undefined} onClick={e => e.stopPropagation()}>
        <span className="ui-janela-alca" aria-hidden="true" />
        <BotaoIcone rotulo="Fechar" variante="limpo" className="dim-x" onClick={onClose}><X size={20} weight="bold" /></BotaoIcone>
        <div className="ui-janela-corpo">
          <img className="dim-img" src={image} alt={imageAlt} onError={e => { e.currentTarget.style.display = "none"; }} />
          <h2 className="ui-janela-t" id={id}>{title}</h2>
          <div className="dim-tx">{children}</div>
        </div>
        <div className="ui-janela-pe ui-janela-pe--um"><Botao onClick={() => (onCta ? onCta() : onClose())} data-foco-inicial>{ctaLabel}</Botao></div>
      </div>
      <style>{`
        .dim { position: relative; }
        .dim .dim-x { position: absolute; top: 10px; right: 10px; z-index: 1; }
        .dim-img { display: block; width: 96px; height: 96px; margin: 0 auto 12px; object-fit: contain; }
        .dim-tx { margin-top: 10px; font-size: 14px; line-height: 1.55; color: var(--ui-texto-2); text-align: left; }
        .dim-tx strong, .dim-tx b { color: var(--ui-texto); font-weight: 700; }
        .dim-tx p { margin: 0 0 10px; }
      `}</style>
    </div>,
    document.body,
  );
}

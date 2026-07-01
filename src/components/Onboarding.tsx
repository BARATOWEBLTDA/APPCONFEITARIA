import { useState, useEffect } from "react";
import { CaretRight } from "@phosphor-icons/react";

/**
 * Onboarding — Tela cheia, controlado pelo pai (isOpen + onClose).
 *
 * Estrutura:
 *  Tela 1 — Boas-vindas
 *  Tela 2 — Organize seus pedidos
 *  Tela 3 — Cadastre ingredientes em segundos
 *  Tela 4 — Nunca esqueça suas clientes
 *  Tela 5 — Desafio da precificação (ponto alto)
 *  Tela 6 — Sua receita já calcula tudo
 *  Tela 7 — Dashboard completo
 *  Tela 8 — Final ("Pronta?")
 *
 * Aberto pelo botão "Complete o Tutorial" no WelcomeChecklist.
 * Na Etapa 1 (atual) as telas 2-7 são placeholders. Etapas seguintes
 * trocam cada placeholder pela animação real.
 */

interface OnboardingProps {
  isOpen: boolean;
  onClose: (slideAlcancada: number) => void;
}

const TOTAL_SLIDES = 8;

export default function Onboarding({ isOpen, onClose }: OnboardingProps) {
  const [slideIdx, setSlideIdx] = useState(0);

  if (!isOpen) return null;

  const next = () => {
    if (slideIdx < TOTAL_SLIDES - 1) {
      setSlideIdx((i) => i + 1);
    } else {
      finish();
    }
  };

  const finish = () => {
    const alcancada = slideIdx;
    setSlideIdx(0); // reset pra próxima vez
    onClose(alcancada);
  };

  return (
    <div className="ob-root" role="dialog" aria-modal="true" aria-label="Boas-vindas ao Doonly">
      {/* Indicador de progresso (bolinhas) */}
      <div className="ob-dots" role="tablist" aria-label="Progresso do onboarding">
        {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
          <span
            key={i}
            className={`ob-dot ${i === slideIdx ? "ob-dot--active" : ""} ${i < slideIdx ? "ob-dot--done" : ""}`}
            role="tab"
            aria-selected={i === slideIdx}
          />
        ))}
      </div>

      {/* Conteúdo da slide */}
      <div className="ob-content" key={slideIdx}>
        {slideIdx === 0 && <Slide1Welcome />}
        {slideIdx === 1 && <Slide2Pedidos />}
        {slideIdx === 2 && <Slide3Ingredientes />}
        {slideIdx === 3 && <SlidePlaceholder title="Nunca esqueça uma cliente" subtitle="Cadastre clientes e envie promoções na época do aniversário." emoji="🎂" />}
        {slideIdx === 4 && <SlidePlaceholder title="Descubra o preço certo" subtitle="O Doonly calcula tudo — custo, lucro e margem ideal." emoji="💰" />}
        {slideIdx === 5 && <SlidePlaceholder title="Sua receita já calcula tudo" subtitle="Ingredientes, embalagem, energia, lucro. Tudo preenchendo sozinho." emoji="📝" />}
        {slideIdx === 6 && <SlidePlaceholder title="Seu negócio organizado" subtitle="Enquanto você faz bolos, o Doonly cuida da gestão." emoji="📊" />}
        {slideIdx === 7 && <SlideFinal onStart={finish} />}
      </div>

      {/* Navegação inferior — esconde os botões na última (CTA está na slide) */}
      {slideIdx < TOTAL_SLIDES - 1 && (
        <div className="ob-nav">
          <button className="ob-nav-btn ob-nav-btn--next" onClick={next}>
            {slideIdx === 0 ? "Começar" : "Próximo"}
            <CaretRight size={18} weight="bold" />
          </button>
        </div>
      )}

      <style>{`
        .ob-root {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: linear-gradient(160deg, #2a1019 0%, #3d1a24 40%, #4d1f2c 70%, #3d1a24 100%);
          background-size: 200% 200%;
          animation: obBgMove 18s ease infinite;
          color: #fff;
          font-family: var(--font-base);
          display: flex;
          flex-direction: column;
          padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px);
          overflow: hidden;
          /* Garante que cobre TUDO, incluindo bottom-nav e topbar */
          width: 100vw;
          height: 100vh;
          height: 100dvh; /* mobile dynamic viewport */
        }
        @keyframes obBgMove {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        /* ── Botão pular (X canto direito) ── */
        /* (ob-skip removido) */

        /* ── Dots de progresso ── */
        .ob-dots {
          display: flex;
          justify-content: center;
          gap: 6px;
          padding: 1.25rem 0 0.5rem;
          margin-top: env(safe-area-inset-top, 0px);
        }
        .ob-dot {
          width: 7px; height: 7px;
          border-radius: 999px;
          background: rgba(255,255,255,0.25);
          transition: background 0.3s ease;
        }
        .ob-dot--done {
          background: rgba(244, 208, 63, 0.55);
        }
        .ob-dot--active {
          background: #F4D03F;
        }

        /* ── Conteúdo principal (a tela em si) ── */
        .ob-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 1.5rem 1.75rem;
          text-align: center;
          animation: obFade 0.5s ease;
          overflow-y: auto;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge antigo */
        }
        .ob-content::-webkit-scrollbar {
          display: none; /* Chrome/Safari/Opera */
        }
        @keyframes obFade {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Navegação inferior ── */
        .ob-nav {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.5rem calc(1.5rem + env(safe-area-inset-bottom, 0px));
        }
        .ob-nav-btn {
          font-family: inherit;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: transform 0.15s;
        }
        .ob-nav-btn:active { transform: scale(0.97); }
        .ob-nav-btn--next {
          flex: 1;
          height: 52px;
          padding: 0 1.5rem;
          color: #2a1019;
          border-radius: 14px;
          background: linear-gradient(110deg, #F4D03F 0%, #fce785 25%, #F4D03F 50%, #e6b800 75%, #F4D03F 100%);
          background-size: 250% 100%;
          animation: obBtnShine 4s linear infinite;
          box-shadow: 0 6px 20px rgba(244, 208, 63, 0.35), inset 0 1px 0 rgba(255,255,255,0.4);
          letter-spacing: 0.01em;
        }
        @keyframes obBtnShine {
          0%   { background-position: 0% 50%; }
          100% { background-position: 250% 50%; }
        }
        .ob-nav-btn--next:hover {
          box-shadow: 0 8px 28px rgba(244, 208, 63, 0.5), inset 0 1px 0 rgba(255,255,255,0.4);
        }

        /* ── Slides: títulos e textos comuns ── */
        .ob-slide-eyebrow {
          font-size: 0.85rem;
          font-weight: 600;
          color: #F4D03F;
          letter-spacing: 0.04em;
          margin-bottom: 0.4rem;
          opacity: 0;
          animation: obFadeUp 0.5s ease 0.1s both;
        }

        /* ── Textos abaixo dos cards (aparecem depois deles caírem) ── */
        .ob-slide-textbelow {
          margin-top: 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .ob-slide-textbelow .ob-slide-eyebrow {
          animation: obFadeUp 0.5s ease 2.2s both;
        }
        .ob-slide-textbelow .ob-slide-title {
          animation: obFadeUp 0.6s ease 2.4s both;
          opacity: 0;
        }
        .ob-slide-title {
          font-size: 1.6rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin: 0 0 0.75rem;
          line-height: 1.2;
          max-width: 22ch;
        }
        .ob-slide-text {
          font-size: 1rem;
          line-height: 1.5;
          color: rgba(255,255,255,0.8);
          margin: 0;
          max-width: 32ch;
        }

        /* ── Slide 1 (boas-vindas) — coroa pulsando + headline grande ── */
        .ob-welcome-coroa {
          width: 130px;
          height: auto;
          margin-bottom: 2rem;
          opacity: 0;
          transform: scale(0.6);
          filter: drop-shadow(0 0 0 rgba(244,208,63,0));
          animation:
            obCoroaEntrada 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s forwards,
            obCoroaPulse 2.4s ease-in-out 0.9s infinite;
        }
        @keyframes obCoroaEntrada {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes obCoroaPulse {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 12px rgba(244,208,63,0.4)) drop-shadow(0 0 0 rgba(244,208,63,0));
          }
          50% {
            transform: scale(1.06);
            filter: drop-shadow(0 0 28px rgba(244,208,63,0.85)) drop-shadow(0 0 60px rgba(244,208,63,0.4));
          }
        }

        .ob-welcome-headline {
          font-size: 1.9rem;
          font-weight: 800;
          line-height: 1.2;
          letter-spacing: -0.02em;
          color: #fff;
          margin: 0;
          text-align: center;
          opacity: 0;
          animation: obFadeUp 0.7s ease 0.7s both;
          text-shadow: 0 2px 24px rgba(0,0,0,0.3);
        }

        /* ── Placeholder visual (etapa 1) ── */
        .ob-placeholder-emoji {
          font-size: 5rem;
          margin-bottom: 1.5rem;
          opacity: 0.85;
          filter: drop-shadow(0 4px 16px rgba(0,0,0,0.3));
        }
        .ob-placeholder-note {
          margin-top: 1.5rem;
          padding: 0.5rem 0.9rem;
          background: rgba(255,255,255,0.08);
          border: 1px dashed rgba(255,255,255,0.2);
          border-radius: 999px;
          font-size: 0.7rem;
          color: rgba(255,255,255,0.55);
          font-weight: 500;
        }

        /* ── Slide final ── */
        .ob-final-sparkle {
          font-size: 3rem;
          margin-bottom: 1rem;
          animation: obFloat 3s ease-in-out infinite;
        }
        @keyframes obFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        .ob-final-title {
          font-size: 2rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin: 0 0 0.75rem;
          line-height: 1.15;
        }
        .ob-final-sub {
          font-size: 1.05rem;
          color: rgba(255,255,255,0.85);
          margin: 0 0 2.5rem;
          line-height: 1.5;
          max-width: 28ch;
        }
        .ob-final-cta {
          font-family: inherit;
          font-size: 1.05rem;
          font-weight: 800;
          padding: 1rem 2.5rem;
          background: #F4D03F;
          color: #2a1019;
          border: none;
          border-radius: 999px;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(244,208,63,0.3);
          transition: transform 0.15s, box-shadow 0.2s;
        }
        .ob-final-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(244,208,63,0.4);
        }
        .ob-final-cta:active { transform: translateY(0); }

        /* ── Slide 2: Pedidos cards (replica do .ped-card do app) ── */
        .ob-pedidos-stack {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          width: 100%;
          max-width: 360px;
          margin-top: 1.5rem;
          perspective: 800px;
        }
        .ob-ped-card {
          background: #fff;
          color: #431524;
          border-radius: 14px;
          border: 1.5px solid #ECC2D0;
          position: relative;
          overflow: hidden;
          font-family: inherit;
          text-align: left;
          box-shadow: 0 12px 30px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2);
          opacity: 0;
          transform: translateY(-60px) rotateX(35deg) scale(0.9);
          animation: obPedidoDrop 0.65s cubic-bezier(0.22, 1.2, 0.36, 1) both;
          transform-origin: center top;
        }
        @keyframes obPedidoDrop {
          0% {
            opacity: 0;
            transform: translateY(-60px) rotateX(35deg) scale(0.9);
          }
          60% {
            opacity: 1;
            transform: translateY(6px) rotateX(-3deg) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateY(0) rotateX(0) scale(1);
          }
        }

        /* Card "espião" — só o topo aparece, resto some num gradiente */
        .ob-ped-card--peek {
          max-height: 78px;
          overflow: hidden;
          position: relative;
          padding-bottom: 0;
        }
        .ob-ped-card-peek-fade {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          height: 50px;
          background: linear-gradient(
            to bottom,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.85) 60%,
            rgba(255,255,255,1) 100%
          );
          pointer-events: none;
        }

        /* Estrutura interna — espelha .mob-card-* do app */
        .ob-mob-card-topo {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 0.65rem 0.9rem 0;
        }
        .ob-ped-card-head-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }
        .ob-ped-card-numero {
          font-size: 0.7rem;
          font-weight: 600;
          color: #C39EAA;
        }
        .ob-ped-card-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 6px;
          flex-shrink: 0;
        }
        .ob-ped-card-status-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .ob-mob-card-cliente {
          font-size: 0.88rem;
          font-weight: 700;
          color: #431524;
          margin: 2px 0 0;
        }
        .ob-mob-card-datetime {
          font-size: 0.7rem;
          color: #C39EAA;
        }
        .ob-mob-card-divider {
          height: 1px;
          border-top: 1px dashed #ECC2D0;
          margin: 0.4rem 0.9rem;
        }
        .ob-mob-card-produto {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 0.9rem;
        }
        .ob-mob-card-produto-img {
          width: 34px; height: 34px;
          border-radius: 6px;
          flex-shrink: 0;
          background: #F7EEF1;
          border: 1px solid #ECC2D0;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
        }
        .ob-mob-card-produto-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .ob-mob-card-produto-nome {
          font-size: 0.78rem;
          font-weight: 600;
          color: #431524;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 160px;
        }
        .ob-mob-card-produto-qtd {
          font-size: 0.68rem;
          color: #6E3548;
          margin: 1px 0 0;
        }
        .ob-mob-card-valor {
          font-size: 1rem;
          font-weight: 800;
          color: #431524;
          margin: 0;
          letter-spacing: -0.02em;
          white-space: nowrap;
        }
        .ob-mob-card-rodape {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          padding: 0 0.9rem 0.65rem;
        }
        .ob-mob-card-info-label {
          font-weight: 600;
          color: #431524;
          font-size: 0.75rem;
        }
        @keyframes obFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Slide 3: Cadastro de ingredientes ── */
        .ob-ing-wrap {
          width: 100%;
          max-width: 360px;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          position: relative;
        }
        /* Fade suave nas bordas quando muitos cards se acumulam */
        .ob-ing-wrap::after {
          content: "";
          position: absolute;
          left: 0; right: 0; bottom: 0;
          height: 30px;
          background: linear-gradient(to bottom, transparent, rgba(42,16,25,0.95));
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.5s;
        }
        .ob-ing-wrap.ob-ing-wrap--full::after {
          opacity: 1;
        }

        /* Card já cadastrado (compacto, verde de check) */
        .ob-ing-cad-card {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.55rem 0.7rem;
          background: #fff;
          border-radius: 12px;
          border: 1.5px solid #ECC2D0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          animation: obIngCadEnter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes obIngCadEnter {
          from { opacity: 0; transform: translateY(-20px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .ob-ing-cad-img {
          width: 32px; height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          flex-shrink: 0;
          overflow: hidden;
        }
        .ob-ing-cad-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .ob-ing-cad-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          text-align: left;
        }
        .ob-ing-cad-nome {
          font-size: 0.78rem;
          font-weight: 700;
          color: #431524;
          line-height: 1.2;
        }
        .ob-ing-cad-marca {
          font-size: 0.68rem;
          color: #6E3548;
        }
        .ob-ing-cad-preco {
          font-size: 0.85rem;
          font-weight: 800;
          color: #431524;
        }
        .ob-ing-cad-check {
          width: 22px; height: 22px;
          border-radius: 50%;
          background: #15803d;
          color: #fff;
          font-size: 0.7rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          animation: obIngCheckPop 0.4s cubic-bezier(0.34, 1.8, 0.64, 1);
        }
        @keyframes obIngCheckPop {
          0%   { transform: scale(0); }
          70%  { transform: scale(1.3); }
          100% { transform: scale(1); }
        }

        /* Form em animação */
        .ob-ing-form {
          background: #fff;
          border-radius: 16px;
          padding: 0.85rem 0.9rem 0.9rem;
          border: 1.5px solid #ECC2D0;
          box-shadow: 0 12px 30px rgba(0,0,0,0.35);
          color: #431524;
          text-align: left;
          animation: obFadeUp 0.4s ease both;
        }
        .ob-ing-form-header {
          margin-bottom: 0.65rem;
        }
        .ob-ing-form-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: #431524;
        }
        .ob-ing-field {
          margin-bottom: 0.55rem;
          opacity: 0.4;
          transition: opacity 0.3s;
        }
        .ob-ing-field--active {
          opacity: 1;
        }
        .ob-ing-field--half {
          flex: 1;
          margin-bottom: 0;
        }
        .ob-ing-row {
          display: flex;
          gap: 0.55rem;
          margin-bottom: 0.65rem;
        }
        .ob-ing-label {
          display: block;
          font-size: 0.65rem;
          font-weight: 600;
          color: #6E3548;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 3px;
        }
        .ob-ing-input {
          background: #F7EEF1;
          border: 1px solid #ECC2D0;
          border-radius: 8px;
          padding: 0.4rem 0.55rem;
          min-height: 30px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #431524;
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .ob-ing-cursor {
          width: 2px;
          height: 14px;
          background: #6E3548;
          animation: obCursor 0.6s infinite;
        }
        @keyframes obCursor {
          0%, 50%  { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        /* Botão buscar imagem + preview */
        .ob-ing-imgrow {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          margin-bottom: 0.65rem;
          opacity: 0.4;
          transition: opacity 0.3s;
        }
        .ob-ing-imgrow.ob-ing-field--active {
          opacity: 1;
        }
        .ob-ing-btn-buscar {
          flex: 1;
          background: #F7EEF1;
          border: 1px dashed #ECC2D0;
          border-radius: 8px;
          padding: 0.5rem;
          font-family: inherit;
          font-size: 0.75rem;
          font-weight: 600;
          color: #6E3548;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          transition: all 0.3s;
        }
        .ob-ing-btn-buscar--loading {
          background: #FAEEDA;
          border-style: solid;
          border-color: #d97706;
          color: #d97706;
        }
        .ob-ing-btn-buscar:has(*) {
          /* garante fallback */
        }
        .ob-ing-preview {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.4rem;
          flex-shrink: 0;
          opacity: 0;
          transform: scale(0.3) rotate(-180deg);
          transition: all 0.5s cubic-bezier(0.34, 1.6, 0.64, 1);
          border: 2px solid transparent;
          overflow: hidden;
        }
        .ob-ing-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .ob-ing-preview--visible {
          opacity: 1;
          transform: scale(1) rotate(0);
          border-color: #15803d;
          box-shadow: 0 0 0 3px rgba(21, 128, 61, 0.2);
        }

        /* Spinner */
        .ob-ing-spinner {
          display: inline-block;
          width: 10px;
          height: 10px;
          border: 2px solid currentColor;
          border-right-color: transparent;
          border-radius: 50%;
          animation: obSpin 0.6s linear infinite;
        }
        @keyframes obSpin {
          to { transform: rotate(360deg); }
        }

        /* Botão salvar */
        .ob-ing-btn-salvar {
          width: 100%;
          background: #ECC2D0;
          border: none;
          border-radius: 10px;
          padding: 0.65rem;
          font-family: inherit;
          font-size: 0.85rem;
          font-weight: 700;
          color: rgba(67, 21, 36, 0.5);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.3s;
        }
        .ob-ing-btn-salvar--active {
          background: #431524;
          color: #fff;
        }
        .ob-ing-btn-salvar--loading {
          animation: obPulseBtn 0.6s ease infinite alternate;
        }
        @keyframes obPulseBtn {
          from { transform: scale(1); }
          to   { transform: scale(1.02); }
        }

        /* ── Desktop: aumenta tipografia e centraliza melhor ── */
        @media (min-width: 768px) {
          .ob-content { padding: 2rem; }
          .ob-slide-title { font-size: 2.2rem; }
          .ob-slide-eyebrow { font-size: 1rem; }
          .ob-slide-text { font-size: 1.1rem; }
          .ob-welcome-coroa { width: 170px; margin-bottom: 2.5rem; }
          .ob-welcome-headline { font-size: 2.6rem; }
          .ob-final-title { font-size: 2.6rem; }
          .ob-final-sub { font-size: 1.2rem; }
          .ob-placeholder-emoji { font-size: 6rem; }
          .ob-nav {
            max-width: 480px;
            margin: 0 auto;
            width: 100%;
            box-sizing: border-box;
          }
        }
      `}</style>
    </div>
  );
}

/* ─── Slide 1: Boas-vindas ──────────────────────── */
function Slide1Welcome() {
  return (
    <>
      <img
        src="/Sistema/TUTORIAL.png"
        alt=""
        className="ob-welcome-coroa"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <h1 className="ob-welcome-headline">
        ORGANIZE SEUS<br/>
        PEDIDOS, CALCULE<br/>
        SEUS PREÇOS<br/>
        E VENDA MAIS.
      </h1>
    </>
  );
}

/* ─── Slide Placeholder (será substituído nas próximas etapas) ─── */
function SlidePlaceholder({ title, subtitle, emoji }: { title: string; subtitle: string; emoji: string }) {
  return (
    <>
      <div className="ob-placeholder-emoji">{emoji}</div>
      <h2 className="ob-slide-title">{title}</h2>
      <p className="ob-slide-text">{subtitle}</p>
      <span className="ob-placeholder-note">animação chegando em breve</span>
    </>
  );
}

/* ─── Slide 2: Pedidos organizados ─────────────────
   Replica o card real mobile (.ped-card / .mob-card-*) do app,
   com 3 pedidos caindo em sequência.   */
const PEDIDOS_DEMO = [
  {
    id: 1,
    numero: "127",
    statusLabel: "Em produção",
    statusColor: "#d97706",
    statusBg: "#FAEEDA",
    statusDot: "#d97706",
    cliente: "Ana Carolina",
    datetime: "Hoje · 14:32",
    produto: "Bolo Dois Amores",
    qtd: "2kg · Retangular",
    valor: "R$ 119,00",
    imagem: "/tutorial/bolo.jpg",
    emoji: "🎂",
    pagamento: "Sinal",
    pagamentoStatus: "Parcial",
    pagamentoColor: "#d97706",
    pagamentoBg: "#FAEEDA",
    entregaIcon: "📍",
    entregaLabel: "Entrega",
    dataLabel: "Sábado",
  },
  {
    id: 2,
    numero: "128",
    statusLabel: "Entregue",
    statusColor: "#15803d",
    statusBg: "#dcfce7",
    statusDot: "#15803d",
    cliente: "Mariana Lima",
    datetime: "Ontem · 15:57",
    produto: "Cento de Salgados",
    qtd: "100 unidades · misto",
    valor: "R$ 70,00",
    imagem: "/tutorial/salgadinhos.jpg",
    emoji: "🥟",
    pagamento: "PIX",
    pagamentoStatus: "Pago",
    pagamentoColor: "#16a34a",
    pagamentoBg: "#dcfce7",
    entregaIcon: "📌",
    entregaLabel: "Retirada",
    dataLabel: "Ontem",
  },
];

function Slide2Pedidos() {
  return (
    <>
      <div className="ob-pedidos-stack">
        {PEDIDOS_DEMO.map((p, idx) => (
          <div
            key={p.id}
            className="ob-ped-card"
            style={{ animationDelay: `${0.2 + idx * 0.6}s` }}
          >
            {/* Topo: número + status + cliente + datetime */}
            <div className="ob-mob-card-topo">
              <div className="ob-ped-card-head-row">
                <span className="ob-ped-card-numero">Pedido #{p.numero}</span>
                <span className="ob-ped-card-status" style={{ color: p.statusColor, background: p.statusBg }}>
                  <span className="ob-ped-card-status-dot" style={{ background: p.statusDot }} />
                  {p.statusLabel}
                </span>
              </div>
              <p className="ob-mob-card-cliente">{p.cliente}</p>
              <span className="ob-mob-card-datetime">{p.datetime}</span>
            </div>

            <div className="ob-mob-card-divider" />

            {/* Produto + valor */}
            <div className="ob-mob-card-produto">
              <div className="ob-mob-card-produto-img">
                {p.imagem
                  ? <img src={p.imagem} alt={p.produto} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : <span>{p.emoji}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="ob-mob-card-produto-nome">{p.produto}</p>
                <p className="ob-mob-card-produto-qtd">{p.qtd}</p>
              </div>
              <p className="ob-mob-card-valor">{p.valor}</p>
            </div>

            <div className="ob-mob-card-divider" />

            {/* Rodapé: pagamento + entrega */}
            <div className="ob-mob-card-rodape">
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span className="ob-mob-card-info-label">Pagamento:</span>
                <span style={{ fontSize: "0.7rem", color: p.pagamentoColor, fontWeight: 600 }}>{p.pagamento}</span>
                <span className="ob-ped-card-status" style={{ color: p.pagamentoColor, background: p.pagamentoBg, fontSize: "0.6rem", padding: "2px 6px" }}>
                  {p.pagamentoStatus}
                </span>
              </div>
              <span style={{ fontSize: "0.7rem", color: "#6E3548", display: "flex", alignItems: "center", gap: 4 }}>
                {p.entregaIcon} {p.entregaLabel}
                <span style={{ color: "#431524", fontWeight: 600 }}>· {p.dataLabel}</span>
              </span>
            </div>
          </div>
        ))}

        {/* Card "espião" — só o topo, sumindo num fade pra sugerir mais pedidos */}
        <div className="ob-ped-card ob-ped-card--peek" style={{ animationDelay: "1.9s" }}>
          <div className="ob-mob-card-topo">
            <div className="ob-ped-card-head-row">
              <span className="ob-ped-card-numero">Pedido #129</span>
              <span className="ob-ped-card-status" style={{ color: "#15803d", background: "#dcfce7" }}>
                <span className="ob-ped-card-status-dot" style={{ background: "#15803d" }} />
                Entregue
              </span>
            </div>
            <p className="ob-mob-card-cliente">Camila Ribeiro</p>
            <span className="ob-mob-card-datetime">Hoje · 17:12</span>
          </div>
          <div className="ob-ped-card-peek-fade" />
        </div>
      </div>

      <div className="ob-slide-textbelow">
        <span className="ob-slide-eyebrow">Com o Doonly...</span>
        <h2 className="ob-slide-title">SEUS PEDIDOS<br/>FICAM ORGANIZADOS</h2>
      </div>
    </>
  );
}

/* ─── Slide 3: Cadastro rápido de ingredientes ─────
   Anima o preenchimento de 2 ingredientes em sequência:
   - Digitação de nome + marca
   - Busca de imagem
   - Preenchimento de preço e peso
   - "Salva" e mostra card cadastrado
   Depois repete pro segundo. */

interface Ingrediente {
  nome: string;
  marca: string;
  preco: string;
  peso: string;
  emoji: string;
  bg: string;
  imagem?: string;
}

const INGREDIENTES_DEMO: Ingrediente[] = [
  {
    nome: "Leite Condensado",
    marca: "Moça",
    preco: "7,89",
    peso: "395g",
    emoji: "🥛",
    bg: "#fff8e1",
    imagem: "/tutorial/moça.webp",
  },
  {
    nome: "Leite em Pó",
    marca: "Ninho Forti+",
    preco: "20,99",
    peso: "380g",
    emoji: "🥛",
    bg: "#fffbe6",
  },
  {
    nome: "Creme de Leite",
    marca: "Nestlé",
    preco: "3,48",
    peso: "200g",
    emoji: "🥛",
    bg: "#f5f5f5",
  },
  {
    nome: "Creme de Avelã",
    marca: "Nutella",
    preco: "192,99",
    peso: "3kg",
    emoji: "🍫",
    bg: "#efebe9",
  },
  {
    nome: "Forminha Brigadeiro",
    marca: "100 unidades",
    preco: "4,14",
    peso: "100un",
    emoji: "🧁",
    bg: "#fce4ec",
  },
];

// (Extras removidos — agora usamos só os 5 ingredientes reais da receita)
const INGREDIENTES_EXTRAS: Ingrediente[] = [];

function Slide3Ingredientes() {
  const [ingredienteIdx, setIngredienteIdx] = useState(0);
  const [step, setStep] = useState(0);
  // step: 0=vazio, 1=digitando nome, 2=nome ok, 3=digitando marca, 4=marca ok,
  //       5=buscando imagem, 6=imagem apareceu, 7=digitando preço, 8=preço ok,
  //       9=peso ok, 10=salvando, 11=cadastrado (card verde)
  const [nomeTyped, setNomeTyped] = useState("");
  const [marcaTyped, setMarcaTyped] = useState("");
  const [precoTyped, setPrecoTyped] = useState("");
  const [cadastrados, setCadastrados] = useState<Ingrediente[]>([]);

  const atual = INGREDIENTES_DEMO[ingredienteIdx];

  // Timeline: efeito único que orquestra tudo
  useEffect(() => {
    if (!atual) return;
    const timers: number[] = [];

    // Reset ao entrar num novo ingrediente
    setStep(0);
    setNomeTyped("");
    setMarcaTyped("");
    setPrecoTyped("");

    // Timing adaptativo: 1º normal (didático), 2º em diante bem mais rápido
    const isPrimeiro = ingredienteIdx === 0;
    const typeSpeed = isPrimeiro ? 80 : 30; // velocidade de digitação (ms/letra)
    const baseDelay = isPrimeiro ? 500 : 200;
    const gap = isPrimeiro ? 300 : 120; // pausa entre campos
    const searchTime = isPrimeiro ? 900 : 400; // tempo do "buscando"
    const saveTime = isPrimeiro ? 700 : 300;
    const finishTime = isPrimeiro ? 1200 : 600;

    // Etapa 1: digitar nome (letra por letra)
    timers.push(window.setTimeout(() => setStep(1), baseDelay));
    atual.nome.split("").forEach((_, i) => {
      timers.push(
        window.setTimeout(() => {
          setNomeTyped(atual.nome.slice(0, i + 1));
        }, baseDelay + typeSpeed * (i + 1))
      );
    });
    const nomeEndTime = baseDelay + typeSpeed * atual.nome.length + 150;
    timers.push(window.setTimeout(() => setStep(2), nomeEndTime));

    // Etapa 2: digitar marca
    timers.push(window.setTimeout(() => setStep(3), nomeEndTime + gap));
    atual.marca.split("").forEach((_, i) => {
      timers.push(
        window.setTimeout(() => {
          setMarcaTyped(atual.marca.slice(0, i + 1));
        }, nomeEndTime + gap + 100 + typeSpeed * (i + 1))
      );
    });
    const marcaEndTime = nomeEndTime + gap + 100 + typeSpeed * atual.marca.length + 150;
    timers.push(window.setTimeout(() => setStep(4), marcaEndTime));

    // Etapa 3: buscando imagem
    timers.push(window.setTimeout(() => setStep(5), marcaEndTime + gap));
    timers.push(window.setTimeout(() => setStep(6), marcaEndTime + gap + searchTime));

    // Etapa 4: digitar preço
    const precoStart = marcaEndTime + gap + searchTime + 200;
    timers.push(window.setTimeout(() => setStep(7), precoStart));
    atual.preco.split("").forEach((_, i) => {
      timers.push(
        window.setTimeout(() => {
          setPrecoTyped(atual.preco.slice(0, i + 1));
        }, precoStart + 100 + typeSpeed * (i + 1))
      );
    });
    const precoEndTime = precoStart + 100 + typeSpeed * atual.preco.length + 150;
    timers.push(window.setTimeout(() => setStep(8), precoEndTime));

    // Etapa 5: peso aparece
    timers.push(window.setTimeout(() => setStep(9), precoEndTime + gap));

    // Etapa 6: salvando
    timers.push(window.setTimeout(() => setStep(10), precoEndTime + gap + 300));

    // Etapa 7: cadastrado! (mostra card verde e adiciona à lista)
    timers.push(
      window.setTimeout(() => {
        setStep(11);
        setCadastrados((prev) => [...prev, atual]);
      }, precoEndTime + gap + 300 + saveTime)
    );

    // Etapa 8: próximo ingrediente
    if (ingredienteIdx < INGREDIENTES_DEMO.length - 1) {
      timers.push(
        window.setTimeout(() => setIngredienteIdx((i) => i + 1), precoEndTime + gap + 300 + saveTime + finishTime)
      );
    }

    return () => timers.forEach((t) => clearTimeout(t));
  }, [ingredienteIdx]);

  const showCursor = (n: number) => step === n;
  const wrapFull = cadastrados.length >= 4;

  return (
    <>
      <div className={`ob-ing-wrap ${wrapFull ? "ob-ing-wrap--full" : ""}`}>
        {/* Cards já cadastrados (aparecem em cima, empilhando) */}
        {cadastrados.map((c, i) => (
          <div key={i} className="ob-ing-cad-card">
            <div className="ob-ing-cad-img" style={{ background: c.bg }}>
              {c.imagem
                ? <img src={c.imagem} alt={c.nome} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                : <span>{c.emoji}</span>}
            </div>
            <div className="ob-ing-cad-info">
              <span className="ob-ing-cad-nome">{c.nome}</span>
              <span className="ob-ing-cad-marca">{c.marca} · {c.peso}</span>
            </div>
            <span className="ob-ing-cad-preco">R$ {c.preco}</span>
            <span className="ob-ing-cad-check">✓</span>
          </div>
        ))}

        {/* Form em animação (só aparece se ainda não terminou) */}
        {step < 11 && (
          <div className="ob-ing-form">
            {/* Cabeçalho */}
            <div className="ob-ing-form-header">
              <span className="ob-ing-form-title">Novo ingrediente</span>
            </div>

            {/* Nome */}
            <div className={`ob-ing-field ${step >= 1 ? "ob-ing-field--active" : ""}`}>
              <label className="ob-ing-label">Nome</label>
              <div className="ob-ing-input">
                <span>{nomeTyped}</span>
                {showCursor(1) && <span className="ob-ing-cursor" />}
              </div>
            </div>

            {/* Marca */}
            <div className={`ob-ing-field ${step >= 3 ? "ob-ing-field--active" : ""}`}>
              <label className="ob-ing-label">Marca</label>
              <div className="ob-ing-input">
                <span>{marcaTyped}</span>
                {showCursor(3) && <span className="ob-ing-cursor" />}
              </div>
            </div>

            {/* Botão buscar imagem + imagem preview */}
            <div className={`ob-ing-imgrow ${step >= 4 ? "ob-ing-field--active" : ""}`}>
              <button className={`ob-ing-btn-buscar ${step === 5 ? "ob-ing-btn-buscar--loading" : ""}`}>
                {step < 5 && <>🔍 Buscar imagem</>}
                {step === 5 && <><span className="ob-ing-spinner" /> Buscando...</>}
                {step >= 6 && <>✓ Encontrada</>}
              </button>
              <div className={`ob-ing-preview ${step >= 6 ? "ob-ing-preview--visible" : ""}`} style={{ background: atual.bg }}>
                {atual.imagem
                  ? <img src={atual.imagem} alt={atual.nome} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : <span>{atual.emoji}</span>}
              </div>
            </div>

            {/* Preço + Peso */}
            <div className="ob-ing-row">
              <div className={`ob-ing-field ob-ing-field--half ${step >= 7 ? "ob-ing-field--active" : ""}`}>
                <label className="ob-ing-label">Preço</label>
                <div className="ob-ing-input">
                  <span>{precoTyped && `R$ ${precoTyped}`}</span>
                  {showCursor(7) && <span className="ob-ing-cursor" />}
                </div>
              </div>
              <div className={`ob-ing-field ob-ing-field--half ${step >= 9 ? "ob-ing-field--active" : ""}`}>
                <label className="ob-ing-label">Peso</label>
                <div className="ob-ing-input">
                  <span>{step >= 9 ? atual.peso : ""}</span>
                </div>
              </div>
            </div>

            {/* Botão salvar */}
            <button className={`ob-ing-btn-salvar ${step === 10 ? "ob-ing-btn-salvar--loading" : ""} ${step >= 10 ? "ob-ing-btn-salvar--active" : ""}`}>
              {step < 10 && "Salvar"}
              {step === 10 && <><span className="ob-ing-spinner" /> Salvando...</>}
            </button>
          </div>
        )}
      </div>

      <div className="ob-slide-textbelow">
        <span className="ob-slide-eyebrow">Com o Doonly...</span>
        <h2 className="ob-slide-title">TODOS OS INGREDIENTES<br/>DA SUA RECEITA</h2>
      </div>
    </>
  );
}

/* ─── Slide Final ────────────────────────────────── */
function SlideFinal({ onStart }: { onStart: () => void }) {
  return (
    <>
      <div className="ob-final-sparkle">🚀</div>
      <h2 className="ob-final-title">Pronta?</h2>
      <p className="ob-final-sub">Vamos configurar seu negócio.</p>
      <button className="ob-final-cta" onClick={onStart}>
        Começar agora
      </button>
    </>
  );
}

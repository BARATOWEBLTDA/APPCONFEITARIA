import { useState, useEffect, useCallback, useMemo } from "react";
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

const TOTAL_SLIDES = 9; // v2

export default function Onboarding({ isOpen, onClose }: OnboardingProps) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [slideReady, setSlideReady] = useState(false);

  const handleSlideReady = useCallback(() => setSlideReady(true), []);

  if (!isOpen) return null;

  const next = () => {
    if (slideIdx < TOTAL_SLIDES - 1) {
      setSlideReady(false);
      setSlideIdx((i) => i + 1);
    } else {
      finish();
    }
  };

  const finish = () => {
    const alcancada = slideIdx;
    setSlideIdx(0); // reset pra próxima vez
    setSlideReady(false);
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
        {slideIdx === 0 && <Slide1Welcome onReady={handleSlideReady} />}
        {slideIdx === 1 && <SlideClientes onReady={handleSlideReady} />}
        {slideIdx === 2 && <Slide2Pedidos onReady={handleSlideReady} />}
        {slideIdx === 3 && <Slide3Ingredientes onReady={handleSlideReady} />}
        {slideIdx === 4 && <Slide4Precificacao onReady={handleSlideReady} />}
        {slideIdx === 5 && <SlidePlaceholder title="Descubra o preço certo" subtitle="O Doonly calcula tudo — custo, lucro e margem ideal." emoji="💰" onReady={handleSlideReady} />}
        {slideIdx === 6 && <SlidePlaceholder title="Sua receita já calcula tudo" subtitle="Ingredientes, embalagem, energia, lucro. Tudo preenchendo sozinho." emoji="📝" onReady={handleSlideReady} />}
        {slideIdx === 7 && <SlidePlaceholder title="Seu negócio organizado" subtitle="Enquanto você faz bolos, o Doonly cuida da gestão." emoji="📊" onReady={handleSlideReady} />}
        {slideIdx === 8 && <SlideFinal onStart={finish} />}
      </div>

      {/* Navegação inferior — esconde os botões na última (CTA está na slide) */}
      {slideIdx < TOTAL_SLIDES - 1 && slideReady && (
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
        /* Quando tem textabove (telas com título fixo em cima), remove o centering
           e fixa o texto no topo — evita oscilação com conteúdo dinâmico */
        .ob-content:has(.ob-slide-textabove) {
          justify-content: flex-start;
          padding-top: 1rem;
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

        /* ── Texto no topo, fixo (não muda de lugar conforme cards surgem) ── */
        .ob-slide-textabove {
          margin-bottom: 0.65rem;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .ob-slide-textabove .ob-slide-eyebrow {
          animation: obFadeUp 0.5s ease 0.1s both;
        }
        .ob-slide-textabove .ob-slide-title {
          animation: obFadeUp 0.6s ease 0.3s both;
          opacity: 0;
        }

        /* Subtitle no topo (complemento do título, hierarquia menor) */
        .ob-slide-subtitle-top {
          margin: -0.35rem 0 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: rgba(255,255,255,0.75);
          letter-spacing: 0.01em;
          animation: obFadeUp 0.5s ease 0.5s both;
        }

        /* ── Subtitle (embaixo dos cards) — complemento do título ── */
        .ob-slide-subtitle {
          margin: 1.1rem 0 0;
          font-size: 1.15rem;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.01em;
          line-height: 1.2;
          max-width: 22ch;
          animation: obFadeUp 0.6s ease both;
        }
        .ob-slide-title {
          font-size: 1.45rem;
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
        .ob-coroa-wrap {
          opacity: 1;
          transform: scale(1);
          transition: opacity 0.55s ease, transform 0.55s ease;
        }
        .ob-coroa-wrap--gone {
          opacity: 0;
          transform: scale(0.7);
          pointer-events: none;
        }
        .ob-welcome-coroa {
          width: 130px;
          height: auto;
          margin-bottom: 2rem;
          opacity: 0;
          transform: scale(0.6);
          filter: hue-rotate(-25deg) saturate(0.7);
          animation:
            obCoroaEntrada 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s forwards,
            obCoroaPulse 4.5s ease-in-out 0.9s infinite;
        }
        @keyframes obCoroaEntrada {
          from { opacity: 0; transform: scale(0.6); filter: hue-rotate(-25deg) saturate(0.7); }
          to   { opacity: 1; transform: scale(1); filter: hue-rotate(-25deg) saturate(0.7); }
        }
        @keyframes obCoroaPulse {
          0%, 100% {
            transform: scale(1);
            filter: hue-rotate(-25deg) saturate(0.7) drop-shadow(0 0 14px rgba(244,196,160,0.4));
          }
          50% {
            transform: scale(1.05);
            filter: hue-rotate(-25deg) saturate(0.7) drop-shadow(0 0 32px rgba(244,196,160,0.9)) drop-shadow(0 0 70px rgba(244,196,160,0.5));
          }
        }

        .ob-welcome-anchor {
          margin: 0;
          padding: 0 1.25rem;
          max-width: 620px;
          display: flex;
          flex-direction: column;
          gap: 1.4rem;
          color: #fff;
          text-align: center;
          text-shadow: 0 2px 24px rgba(0,0,0,0.35);
        }
        .ob-welcome-block {
          font-size: 1.55rem;
          font-weight: 800;
          line-height: 1.18;
          letter-spacing: 0.005em;
          opacity: 0;
          transform: translateY(14px);
          animation: obFadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .ob-welcome-anchor .ob-fill {
          font-weight: 900;
          text-shadow: none;
          /* Gradiente metálico: metade esquerda = rose gold com brilho central,
             metade direita = branco. A varredura desloca o gradiente pra revelar. */
          background: linear-gradient(
            100deg,
            #B8724B 0%,
            #E8A886 12%,
            #F8D3B0 25%,
            #FFF0DE 34%,
            #F8D3B0 42%,
            #E8A886 50%,
            #ffffff 50.01%,
            #ffffff 100%
          );
          background-size: 200% 100%;
          background-position: 100% 0;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          filter: drop-shadow(0 0 0 rgba(248,216,184,0));
          animation: obFillSweep 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes obFillSweep {
          0% {
            background-position: 100% 0;
            filter: drop-shadow(0 0 0 rgba(248,216,184,0));
          }
          100% {
            background-position: 0% 0;
            filter: drop-shadow(0 0 10px rgba(248,216,184,0.55)) drop-shadow(0 0 24px rgba(232,168,134,0.35));
          }
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
        /* Novo modo "flow": novos pedidos entram por cima, empurram os antigos */
        .ob-ped-card--flow {
          animation: obPedidoFlowIn 0.6s cubic-bezier(0.22, 1.2, 0.36, 1) both;
          transform-origin: center top;
        }
        @keyframes obPedidoFlowIn {
          0% {
            opacity: 0;
            transform: translateY(-30px) scale(0.85);
            max-height: 0;
            margin-top: 0;
            margin-bottom: 0;
          }
          50% {
            opacity: 1;
            max-height: 200px;
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            max-height: 200px;
          }
        }

        /* === Cards de CLIENTES === */
        .ob-clientes-stack {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          width: 100%;
          max-width: 360px;
          margin-top: 1.5rem;
        }
        .ob-cli-card {
          background: #fff;
          color: #431524;
          border-radius: 14px;
          border: 1.5px solid #ECC2D0;
          padding: 0.85rem;
          box-shadow: 0 12px 30px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2);
          animation: obClienteFlowIn 0.6s cubic-bezier(0.22, 1.2, 0.36, 1) both;
          transform-origin: center top;
        }
        @keyframes obClienteFlowIn {
          0% {
            opacity: 0;
            transform: translateY(-30px) scale(0.85);
            max-height: 0;
            margin-top: 0;
            margin-bottom: 0;
            padding-top: 0;
            padding-bottom: 0;
          }
          50% {
            opacity: 1;
            max-height: 300px;
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            max-height: 300px;
          }
        }
        .ob-cli-header {
          display: flex;
          align-items: center;
          gap: 0.65rem;
        }
        .ob-cli-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 700;
          font-size: 0.95rem;
          flex-shrink: 0;
          overflow: hidden;
        }
        .ob-cli-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .ob-cli-nome-bloco {
          flex: 1 1 auto;
          min-width: 0;
        }
        .ob-cli-nome {
          font-size: 0.9rem;
          font-weight: 700;
          color: #431524;
          line-height: 1.2;
        }
        .ob-cli-sub {
          font-size: 0.7rem;
          color: #6E3548;
          margin-top: 2px;
        }
        .ob-cli-badge-aniv {
          background: #FEF3C7;
          color: #B45309;
          border: 1px solid #FCD34D;
          font-size: 0.62rem;
          font-weight: 600;
          padding: 3px 7px;
          border-radius: 999px;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 3px;
          flex-shrink: 0;
        }
        .ob-cli-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, #ECC2D0, transparent);
          margin: 0.65rem 0;
        }
        .ob-cli-metricas {
          display: flex;
          gap: 0.55rem;
          font-size: 0.72rem;
        }
        .ob-cli-metrica {
          flex: 1;
          background: #FBF6F3;
          border-radius: 8px;
          padding: 0.5rem 0.6rem;
          min-width: 0;
        }
        .ob-cli-metrica-label {
          color: #6E3548;
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          white-space: nowrap;
        }
        .ob-cli-metrica-valor {
          color: #431524;
          font-weight: 700;
          font-size: 0.88rem;
          margin-top: 3px;
          white-space: nowrap;
        }
        .ob-cli-inline {
          margin-top: 0.5rem;
          font-size: 0.72rem;
          color: #6E3548;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 6px;
        }
        .ob-cli-inline strong {
          color: #431524;
          font-weight: 700;
        }
        .ob-cli-aniv {
          margin-top: 0.6rem;
          background: #FEF3C7;
          border: 1px solid #FCD34D;
          color: #92400E;
          border-radius: 8px;
          padding: 0.45rem 0.6rem;
          font-size: 0.72rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: wrap;
        }
        .ob-cli-acao {
          color: #B45309;
          text-decoration: underline;
          font-weight: 700;
          cursor: pointer;
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
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum";
          white-space: nowrap;
          display: inline-flex;
          align-items: baseline;
          gap: 3px;
          min-width: 78px;
        }
        .ob-ing-cad-preco-symbol {
          flex-shrink: 0;
        }
        .ob-ing-cad-preco-value {
          flex: 1;
          text-align: left;
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

        /* ── Slide 4: Precificação ── */
        .ob-prec-card {
          background: #fff;
          border-radius: 14px;
          padding: 0.75rem 0.85rem;
          border: 1.5px solid #ECC2D0;
          box-shadow: 0 12px 30px rgba(0,0,0,0.35);
          color: #431524;
          text-align: left;
          width: 100%;
          max-width: 360px;
          animation: obFadeUp 0.5s ease both;
        }
        .ob-prec-produto {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px dashed #ECC2D0;
        }
        .ob-prec-produto-img {
          width: 36px; height: 36px;
          border-radius: 8px;
          background: #efebe9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          flex-shrink: 0;
          overflow: hidden;
        }
        .ob-prec-produto-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .ob-prec-produto-nome {
          font-size: 0.85rem;
          font-weight: 700;
          color: #431524;
          margin: 0;
        }
        .ob-prec-produto-info {
          font-size: 0.68rem;
          color: #6E3548;
          margin: 1px 0 0;
        }
        .ob-prec-produto-custo {
          font-size: 0.95rem;
          font-weight: 800;
          color: #6E3548;
          margin: 0;
          white-space: nowrap;
        }

        /* Detalhamento de custos */
        .ob-prec-detalhes {
          margin-top: 0.55rem;
          padding-top: 0.55rem;
          border-top: 1px dashed #ECC2D0;
        }
        .ob-prec-detalhes-titulo {
          display: block;
          font-size: 0.62rem;
          font-weight: 700;
          color: #6E3548;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.35rem;
          text-align: left;
        }
        .ob-prec-linha {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.2rem 0;
          font-size: 0.78rem;
          opacity: 0;
          transform: translateX(-8px);
          transition: opacity 0.35s ease, transform 0.35s ease;
        }
        .ob-prec-linha--visible {
          opacity: 1;
          transform: translateX(0);
        }
        .ob-prec-linha-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #431524;
          font-weight: 500;
        }
        .ob-prec-linha-icone {
          font-size: 1rem;
        }
        .ob-prec-linha-valor {
          font-weight: 700;
          color: #431524;
          font-variant-numeric: tabular-nums;
          display: inline-flex;
          align-items: baseline;
          gap: 3px;
          min-width: 82px;
        }
        .ob-prec-preco-symbol {
          font-size: 0.7rem;
          color: #6E3548;
          flex-shrink: 0;
        }
        .ob-prec-preco-value {
          text-align: left;
          flex: 1;
        }
        .ob-prec-divider {
          height: 1px;
          background: #ECC2D0;
          margin: 0.35rem 0;
          transform-origin: left;
          transform: scaleX(0);
          transition: transform 0.4s ease;
        }
        .ob-prec-divider--visible { transform: scaleX(1); }
        .ob-prec-linha--total {
          font-weight: 700;
        }
        .ob-prec-linha--total .ob-prec-linha-label,
        .ob-prec-linha--total .ob-prec-linha-valor {
          font-weight: 800;
        }
        .ob-prec-linha--destaque {
          background: linear-gradient(90deg, #f7eef1, #fce4ec);
          margin: 0.4rem -0.3rem 0;
          padding: 0.55rem 0.7rem;
          border-radius: 8px;
          border: 1px dashed #ECC2D0;
        }
        .ob-prec-linha--destaque .ob-prec-linha-label {
          color: #6E3548;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .ob-prec-linha--destaque .ob-prec-linha-valor {
          color: #431524;
          font-size: 1.05rem;
        }
        .ob-prec-linha--destaque .ob-prec-preco-value {
          font-size: 1.05rem;
        }

        .ob-prec-pergunta {
          padding: 0.65rem 0 0.4rem;
        }
        .ob-prec-label {
          display: block;
          font-size: 0.72rem;
          font-weight: 600;
          color: #6E3548;
          margin-bottom: 5px;
          text-align: center;
        }
        .ob-prec-input {
          background: #F7EEF1;
          border: 2px solid #ECC2D0;
          border-radius: 10px;
          padding: 0.55rem 1rem;
          font-size: 1.3rem;
          font-weight: 800;
          color: #431524;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.4s;
          font-variant-numeric: tabular-nums;
        }
        .ob-prec-input-symbol {
          font-size: 0.9rem;
          color: #6E3548;
        }
        .ob-prec-input-value {
          font-size: 1.3rem;
          min-width: 22px;
        }
        .ob-prec-input--prejuizo {
          border-color: #dc2626;
          background: #fef2f2;
          color: #dc2626;
          animation: obShake 0.5s ease;
        }
        .ob-prec-input--lucro {
          border-color: #15803d;
          background: #f0fdf4;
          color: #15803d;
          animation: obPulseGreen 0.6s ease;
        }
        @keyframes obShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        @keyframes obPulseGreen {
          0% { transform: scale(1); box-shadow: 0 0 0 rgba(21,128,61,0); }
          50% { transform: scale(1.03); box-shadow: 0 0 30px rgba(21,128,61,0.4); }
          100% { transform: scale(1); box-shadow: 0 0 0 rgba(21,128,61,0); }
        }
        .ob-prec-cursor {
          width: 3px;
          height: 24px;
          background: currentColor;
          animation: obCursor 0.6s infinite;
        }

        /* Resultado */
        .ob-prec-resultado {
          margin-top: 0.55rem;
          padding: 0.65rem 0.75rem;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0.3rem;
          animation: obResultadoIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes obResultadoIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .ob-prec-resultado--prejuizo {
          background: #fef2f2;
          border: 1.5px solid #dc2626;
        }
        .ob-prec-resultado--lucro {
          background: #f0fdf4;
          border: 1.5px solid #15803d;
        }
        .ob-prec-resultado-label {
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .ob-prec-resultado--prejuizo .ob-prec-resultado-label { color: #dc2626; }
        .ob-prec-resultado--lucro .ob-prec-resultado-label { color: #15803d; }

        .ob-prec-resultado-linha {
          display: flex;
          align-items: center;
          gap: 0.7rem;
        }
        .ob-prec-resultado-valor {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
          line-height: 1.1;
        }
        .ob-prec-resultado--prejuizo .ob-prec-resultado-valor { color: #dc2626; }
        .ob-prec-resultado--lucro .ob-prec-resultado-valor { color: #15803d; }
        .ob-prec-resultado-divider {
          width: 1px;
          height: 24px;
          background: currentColor;
          opacity: 0.35;
        }
        .ob-prec-resultado--prejuizo .ob-prec-resultado-divider { color: #dc2626; }
        .ob-prec-resultado--lucro .ob-prec-resultado-divider { color: #15803d; }
        .ob-prec-resultado-margem {
          font-size: 1rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .ob-prec-resultado--prejuizo .ob-prec-resultado-margem { color: #dc2626; }
        .ob-prec-resultado--lucro .ob-prec-resultado-margem { color: #15803d; }
        .ob-prec-resultado-ideal {
          font-size: 0.7rem;
          font-weight: 600;
          color: #6E3548;
          margin-top: 1px;
        }

        /* ── Desktop: aumenta tipografia e centraliza melhor ── */
        @media (min-width: 768px) {
          .ob-content { padding: 2rem; }
          .ob-slide-title { font-size: 2rem; }
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
function Slide1Welcome({ onReady }: { onReady: () => void }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers: number[] = [];
    // Fase 0: coroa + "DESCUBRA COMO O DOONLY VAI..." (~3.4s)
    timers.push(window.setTimeout(() => setPhase(1), 3400));
    // Fase 1: "DEIXAR SUA CONFEITARIA...." (~2.2s)
    timers.push(window.setTimeout(() => setPhase(2), 5600));
    // Fase 2: "ORGANIZADA DO CARDÁPIO AO LUCRO" — 3 sweeps, botão ao final
    timers.push(window.setTimeout(onReady, 8700));
    return () => timers.forEach((t) => clearTimeout(t));
  }, [onReady]);

  return (
    <>
      <div className={`ob-coroa-wrap ${phase !== 0 ? "ob-coroa-wrap--gone" : ""}`}>
        <img
          src="/Sistema/TUTORIAL.png"
          alt=""
          className="ob-welcome-coroa"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      {phase === 0 && (
        <div className="ob-welcome-anchor" key="p0">
          <div className="ob-welcome-block" style={{ animationDelay: "0.3s" }}>
            DESCUBRA COMO<br/>
            O <span className="ob-fill" style={{ animationDelay: "1.4s" }}>DOONLY</span> VAI...
          </div>
        </div>
      )}

      {phase === 1 && (
        <div className="ob-welcome-anchor" key="p1">
          <div className="ob-welcome-block" style={{ animationDelay: "0.15s" }}>
            DEIXAR SUA<br/>
            CONFEITARIA....
          </div>
        </div>
      )}

      {phase === 2 && (
        <div className="ob-welcome-anchor" key="p2">
          <div className="ob-welcome-block" style={{ animationDelay: "0.15s" }}>
            <span className="ob-fill" style={{ animationDelay: "0.8s" }}>ORGANIZADA</span> DO<br/>
            <span className="ob-fill" style={{ animationDelay: "1.5s" }}>CARDÁPIO</span> AO <span className="ob-fill" style={{ animationDelay: "2.2s" }}>LUCRO</span>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Slide Placeholder (será substituído nas próximas etapas) ─── */
function SlidePlaceholder({ title, subtitle, emoji, onReady }: { title: string; subtitle: string; emoji: string; onReady: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onReady, 500);
    return () => clearTimeout(t);
  }, [onReady]);
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
   Fluxo animado: pedidos entram no topo, empurram os antigos pra cima,
   os mais antigos somem. No final para com 2 fixos + peek. */
const PEDIDOS_DEMO = [
  {
    id: 2,
    numero: "126",
    statusLabel: "Novo",
    statusColor: "#1d4ed8",
    statusBg: "#dbeafe",
    statusDot: "#1d4ed8",
    cliente: "Juliana Santos",
    datetime: "Hoje · 13:20",
    produto: "Torta de Morango",
    qtd: "1 unidade · média",
    valor: "R$ 95,00",
    emoji: "🍰",
    pagamento: "PIX",
    pagamentoStatus: "Pago",
    pagamentoColor: "#16a34a",
    pagamentoBg: "#dcfce7",
    entregaIcon: "📍",
    entregaLabel: "Entrega",
    dataLabel: "Domingo",
  },
  {
    id: 3,
    numero: "125",
    statusLabel: "Confirmado",
    statusColor: "#7c3aed",
    statusBg: "#ede9fe",
    statusDot: "#7c3aed",
    cliente: "Fernanda Alves",
    datetime: "Hoje · 12:05",
    produto: "Caixa de Brigadeiros",
    qtd: "24 unidades · gourmet",
    valor: "R$ 48,00",
    emoji: "🍫",
    pagamento: "PIX",
    pagamentoStatus: "Pago",
    pagamentoColor: "#16a34a",
    pagamentoBg: "#dcfce7",
    entregaIcon: "📌",
    entregaLabel: "Retirada",
    dataLabel: "Hoje",
  },
  {
    id: 4,
    numero: "124",
    statusLabel: "Finalizado",
    statusColor: "#15803d",
    statusBg: "#dcfce7",
    statusDot: "#15803d",
    cliente: "Patrícia Rocha",
    datetime: "Hoje · 10:48",
    produto: "Bolo Piscina",
    qtd: "3kg · redondo",
    valor: "R$ 210,00",
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
    id: 5,
    numero: "123",
    statusLabel: "Entregue",
    statusColor: "#15803d",
    statusBg: "#dcfce7",
    statusDot: "#15803d",
    cliente: "Larissa Mendes",
    datetime: "Ontem · 18:32",
    produto: "Cupcakes Decorados",
    qtd: "12 unidades · sortidos",
    valor: "R$ 84,00",
    emoji: "🧁",
    pagamento: "PIX",
    pagamentoStatus: "Pago",
    pagamentoColor: "#16a34a",
    pagamentoBg: "#dcfce7",
    entregaIcon: "📌",
    entregaLabel: "Retirada",
    dataLabel: "Ontem",
  },
  {
    id: 6,
    numero: "122",
    statusLabel: "Retirada",
    statusColor: "#15803d",
    statusBg: "#dcfce7",
    statusDot: "#15803d",
    cliente: "Camila Ribeiro",
    datetime: "Ontem · 16:10",
    produto: "1 Cento de Salgadinhos",
    qtd: "Misto",
    valor: "R$ 67,90",
    imagem: "/tutorial/salgadinhos.jpg",
    emoji: "🥟",
    pagamento: "PIX",
    pagamentoStatus: "Pago",
    pagamentoColor: "#16a34a",
    pagamentoBg: "#dcfce7",
    entregaIcon: "📌",
    entregaLabel: "Retirada",
    dataLabel: "", // preenchido em runtime (1 dia antes)
  },
  {
    id: 1,
    numero: "97",
    statusLabel: "Em Produção",
    statusColor: "#d97706",
    statusBg: "#FAEEDA",
    statusDot: "#d97706",
    cliente: "Larissa Ferreira",
    datetime: "", // preenchido em runtime (é o pedido mais novo)
    produto: "Bolo Dois Amores",
    qtd: "2kg · Retangular",
    valor: "R$ 119,90",
    imagem: "/tutorial/doisamores.jpg",
    emoji: "",
    pagamento: "Pix",
    pagamentoStatus: "Pago Parcial",
    pagamentoColor: "#d97706",
    pagamentoBg: "#FAEEDA",
    entregaIcon: "/google-maps.png",
    entregaLabel: "Entrega",
    dataLabel: "", // preenchido em runtime (2 dias depois)
  },
  {
    id: 7,
    numero: "121",
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
  {
    id: 8,
    numero: "120",
    statusLabel: "Entregue",
    statusColor: "#15803d",
    statusBg: "#dcfce7",
    statusDot: "#15803d",
    cliente: "Beatriz Costa",
    datetime: "Ontem · 14:22",
    produto: "Bolo de Aniversário",
    qtd: "2kg · com pasta",
    valor: "R$ 180,00",
    emoji: "🎂",
    pagamento: "PIX",
    pagamentoStatus: "Pago",
    pagamentoColor: "#16a34a",
    pagamentoBg: "#dcfce7",
    entregaIcon: "📍",
    entregaLabel: "Entrega",
    dataLabel: "Ontem",
  },
];

// ============================================================
//  SLIDE CLIENTES — "Você nunca mais esquece uma cliente"
// ============================================================
const CLIENTES_DEMO = [
  {
    id: 1,
    nome: "Ana Cristina Vieira",
    initials: "AC",
    avatarBg: "#F97316", // laranja
    imagem: "/tutorial/cliente1.jpeg",
    tempo: "8 meses",
    totalPedidos: 3,
    totalGasto: "R$ 279,90",
    ticketMedio: "R$ 93,30",
    ultimaCompra: "há 1 mês",
    aniversario: "em 7 dias",
  },
  {
    id: 2,
    nome: "Débora Almeida",
    initials: "DA",
    avatarBg: "#7c3aed", // roxo
    imagem: "/tutorial/cliente2.jpeg",
    tempo: "1 ano e 2 meses",
    totalPedidos: 9,
    totalGasto: "R$ 1.093,59",
    ticketMedio: "R$ 121,51",
    ultimaCompra: "há 6 dias",
    aniversario: null,
  },
];

function SlideClientes({ onReady }: { onReady: () => void }) {
  const [visiveis, setVisiveis] = useState<typeof CLIENTES_DEMO>([]);

  useEffect(() => {
    const timers: number[] = [];

    // Pré-carrega as fotos das clientes antes de animar
    const imagensPraCarregar = CLIENTES_DEMO.map((c) => c.imagem).filter((s): s is string => !!s);
    const preload = Promise.all(
      imagensPraCarregar.map(
        (src) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = src;
          })
      )
    );

    let cancelado = false;
    preload.then(() => {
      if (cancelado) return;

      // Primeira cliente entra
      timers.push(window.setTimeout(() => {
        setVisiveis([CLIENTES_DEMO[0]]);
      }, 300));

      // Segunda entra depois
      timers.push(window.setTimeout(() => {
        setVisiveis([CLIENTES_DEMO[1], CLIENTES_DEMO[0]]);
      }, 1700));

      // Libera botão
      timers.push(window.setTimeout(onReady, 3000));
    });

    return () => {
      cancelado = true;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [onReady]);

  return (
    <div className="ob-slide-textabove">
      <p className="ob-slide-eyebrow">Com o Doonly...</p>
      <h2 className="ob-slide-title">
        VOCÊ NUNCA MAIS
        <br />
        ESQUECE UMA CLIENTE
      </h2>
      <p className="ob-slide-subtitle-top">Tudo sobre elas, num só lugar</p>

      <div className="ob-clientes-stack">
        {visiveis.map((c) => (
          <div key={c.id} className="ob-cli-card">
            <div className="ob-cli-header">
              <div className="ob-cli-avatar" style={{ background: c.avatarBg }}>
                {c.imagem
                  ? <img src={c.imagem} alt={c.nome} onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                      const parent = img.parentElement;
                      if (parent) parent.textContent = c.initials;
                    }} />
                  : c.initials}
              </div>
              <div className="ob-cli-nome-bloco">
                <div className="ob-cli-nome">{c.nome}</div>
                <div className="ob-cli-sub">Cliente há {c.tempo}</div>
              </div>
            </div>

            <div className="ob-cli-divider" />

            <div className="ob-cli-metricas">
              <div className="ob-cli-metrica">
                <div className="ob-cli-metrica-label">Pedidos</div>
                <div className="ob-cli-metrica-valor">{c.totalPedidos}</div>
              </div>
              <div className="ob-cli-metrica">
                <div className="ob-cli-metrica-label">Total gasto</div>
                <div className="ob-cli-metrica-valor">{c.totalGasto}</div>
              </div>
            </div>

            <div className="ob-cli-inline">
              <span>Ticket médio:</span>
              <strong>{c.ticketMedio}</strong>
            </div>
            <div className="ob-cli-inline">
              <span>⏱ Última compra:</span>
              <strong>{c.ultimaCompra}</strong>
            </div>
            {c.aniversario && (
              <div className="ob-cli-aniv">
                🎂 Aniversário {c.aniversario} — <span className="ob-cli-acao">Enviar Cardápio</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Slide2Pedidos({ onReady }: { onReady: () => void }) {
  // Índice do "próximo pedido a entrar" — começa em 0 e vai até 8 (para no final)
  const [proximoIdx, setProximoIdx] = useState(0);
  // Lista visível na tela (máx 2 cards principais + 1 peek)
  const [visiveis, setVisiveis] = useState<typeof PEDIDOS_DEMO>([]);

  // Trio de pedidos para a animação. Larissa é o mais novo, entra por último e fica no topo.
  const pedidos = useMemo(() => {
    const now = new Date();
    const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    // Larissa: hora aleatória entre 08h e 19h
    const randomHour = 8 + Math.floor(Math.random() * 12); // 8..19
    const randomMin = Math.floor(Math.random() * 60);
    const hh = String(randomHour).padStart(2, "0");
    const mm = String(randomMin).padStart(2, "0");

    // Entrega Larissa: 2 dias depois de hoje
    const entregaLarissa = new Date(now);
    entregaLarissa.setDate(entregaLarissa.getDate() + 2);
    const diaEntregaLarissa = diasSemana[entregaLarissa.getDay()];

    // Retirada Camila: 1 dia antes de hoje
    const retiradaCamila = new Date(now);
    retiradaCamila.setDate(retiradaCamila.getDate() - 1);
    const diaRetiradaCamila = diasSemana[retiradaCamila.getDay()];

    return [
      PEDIDOS_DEMO[2], // Patrícia — Finalizado
      { ...PEDIDOS_DEMO[4], dataLabel: diaRetiradaCamila }, // Camila — Retirada (ontem)
      { ...PEDIDOS_DEMO[5], datetime: `Hoje · ${hh}:${mm}`, dataLabel: diaEntregaLarissa }, // Larissa — Em Produção (hoje + 2)
    ];
  }, []);

  useEffect(() => {
    const timers: number[] = [];

    // Pré-carrega imagens antes de iniciar a animação (evita que a foto apareça
    // depois do card)
    const imagensPraCarregar = pedidos.map((p) => p.imagem).filter((s): s is string => !!s);

    const preload = Promise.all(
      imagensPraCarregar.map(
        (src) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve(); // resolve mesmo em erro pra não travar
            img.src = src;
          })
      )
    );

    let cancelado = false;
    preload.then(() => {
      if (cancelado) return;

      // Primeiro pedido entra rápido
      timers.push(window.setTimeout(() => {
        setVisiveis([pedidos[0]]);
        setProximoIdx(1);
      }, 300));

      // Depois entra a cada 1.4s até o último
      for (let i = 1; i < 3; i++) {
        timers.push(window.setTimeout(() => {
          setVisiveis((prev) => {
            const next = [pedidos[i], ...prev];
            return next.slice(0, 3);
          });
          setProximoIdx(i + 1);
        }, 300 + i * 1400));
      }

      // Marca pronto depois do último
      timers.push(window.setTimeout(onReady, 300 + 3 * 1400 + 500));
    });

    return () => {
      cancelado = true;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [onReady, pedidos]);

  return (
    <>
      <div className="ob-slide-textabove">
        <span className="ob-slide-eyebrow">Com o Doonly...</span>
        <h2 className="ob-slide-title">SEUS PEDIDOS<br/>FICAM ORGANIZADOS</h2>
        <p className="ob-slide-subtitle-top">E na palma da sua mão!</p>
      </div>

      <div className="ob-pedidos-stack">
        {visiveis.map((p, idx) => {
          const isPeek = idx === 2; // 3º card é o peek
          const isOldest = idx === visiveis.length - 1 && visiveis.length === 3;
          return (
            <div
              key={p.id}
              className={`ob-ped-card ob-ped-card--flow ${isPeek ? "ob-ped-card--peek" : ""}`}
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

              {!isPeek && (
                <>
                  <div className="ob-mob-card-divider" />

                  {/* Produto + valor */}
                  <div className="ob-mob-card-produto">
                    <div className="ob-mob-card-produto-img">
                      {p.imagem
                        ? <img src={p.imagem} alt={p.produto} onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.style.display = 'none';
                            const parent = img.parentElement;
                            if (parent) parent.textContent = p.emoji || "🎂";
                          }} />
                        : <span>{p.emoji || "🎂"}</span>}
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
                      {p.entregaIcon.startsWith("/")
                        ? <img src={p.entregaIcon} alt="" style={{ width: 12, height: 12, objectFit: "contain" }} />
                        : p.entregaIcon}
                      {p.entregaLabel}
                      <span style={{ color: "#431524", fontWeight: 600 }}>· {p.dataLabel}</span>
                    </span>
                  </div>
                </>
              )}

              {isPeek && <div className="ob-ped-card-peek-fade" />}
            </div>
          );
        })}
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
    imagem: "/tutorial/moca.webp",
  },
  {
    nome: "Leite em Pó",
    marca: "Ninho Forti+",
    preco: "20,99",
    peso: "380g",
    emoji: "🥛",
    bg: "#fffbe6",
    imagem: "/tutorial/ninho.webp",
  },
  {
    nome: "Creme de Leite",
    marca: "Nestlé",
    preco: "3,48",
    peso: "200g",
    emoji: "🥛",
    bg: "#f5f5f5",
    imagem: "/tutorial/cremedeleite.webp",
  },
  {
    nome: "Creme de Avelã",
    marca: "Nutella",
    preco: "192,99",
    peso: "3kg",
    emoji: "🍫",
    bg: "#efebe9",
    imagem: "/tutorial/nutella.webp",
  },
  {
    nome: "Granulado de Chocolate",
    marca: "Sicão",
    preco: "23,90",
    peso: "300g",
    emoji: "🍫",
    bg: "#efebe9",
    imagem: "/tutorial/sicao.png",
  },
  {
    nome: "Forminhas para Brigadeiro",
    marca: "Flopel",
    preco: "4,14",
    peso: "100un",
    emoji: "🧁",
    bg: "#fce4ec",
    imagem: "/tutorial/forminha.webp",
  },
];

// (Extras removidos — agora usamos só os 5 ingredientes reais da receita)
const INGREDIENTES_EXTRAS: Ingrediente[] = [];

function Slide3Ingredientes({ onReady }: { onReady: () => void }) {
  const [ingredienteIdx, setIngredienteIdx] = useState(0);
  const [step, setStep] = useState(0);
  // step: 0=vazio, 1=digitando nome, 2=nome ok, 3=digitando marca, 4=marca ok,
  //       5=buscando imagem, 6=imagem apareceu, 7=digitando preço, 8=preço ok,
  //       9=peso ok, 10=salvando, 11=cadastrado (card verde)
  const [nomeTyped, setNomeTyped] = useState("");
  const [marcaTyped, setMarcaTyped] = useState("");
  const [precoTyped, setPrecoTyped] = useState("");
  const [cadastrados, setCadastrados] = useState<Ingrediente[]>([]);
  const [terminou, setTerminou] = useState(false);

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
    const isUltimoAnimado = ingredienteIdx === 2; // só 3 primeiros animam
    timers.push(
      window.setTimeout(() => {
        setStep(11);
        setCadastrados((prev) => [...prev, atual]);
        if (isUltimoAnimado) {
          // Depois do 3º, "chove" os demais rapidinho
          INGREDIENTES_DEMO.slice(3).forEach((extra, i) => {
            window.setTimeout(() => {
              setCadastrados((prev) => [...prev, extra]);
              if (i === INGREDIENTES_DEMO.slice(3).length - 1) {
                window.setTimeout(() => {
                  setTerminou(true);
                  onReady();
                }, 600);
              }
            }, 300 + i * 350);
          });
        }
      }, precoEndTime + gap + 300 + saveTime)
    );

    // Etapa 8: próximo ingrediente (só até o 3º animado)
    if (ingredienteIdx < 2) {
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
      <div className="ob-slide-textabove">
        <span className="ob-slide-eyebrow">Com o Doonly...</span>
        <h2 className="ob-slide-title">TODOS OS INGREDIENTES<br/>DAS SUAS RECEITAS</h2>
      </div>

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
            <span className="ob-ing-cad-preco">
              <span className="ob-ing-cad-preco-symbol">R$</span>
              <span className="ob-ing-cad-preco-value">{c.preco}</span>
            </span>
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
      {terminou && (
        <p className="ob-slide-subtitle">SEMPRE ORGANIZADOS<br/>E PRONTOS PARA USAR</p>
      )}
    </>
  );
}

/* ─── Slide 4: O desafio da precificação ───────────
   Momento "wow" do tutorial:
   1. Mostra o brigadeiro e detalha custos linha por linha
   2. Auto-digita R$ 6,00 → mostra prejuízo em vermelho
   3. Limpa, auto-digita R$ 12,00 → mostra lucro em verde */

const CUSTOS_DETALHE = [
  { label: "Ingredientes", valor: 34.48, icone: "🥄" },
  { label: "Mão de obra", valor: 15.00, icone: "👩‍🍳" },
  { label: "Custos fixos", valor: 3.50, icone: "💡" },
  { label: "Custos invisíveis (25%)", valor: 13.25, icone: "🔍" },
];
const CUSTO_TOTAL = 66.23; // 40 brigadeiros com custos invisíveis
const CUSTO_POR_CAIXA = 6.62; // caixa com 4un
const PRECOS_TESTE = ["8,00", "15,00"];

function Slide4Precificacao({ onReady }: { onReady: () => void }) {
  const [precoTyped, setPrecoTyped] = useState("");
  const [rodadaIdx, setRodadaIdx] = useState(-1); // -1 = ainda mostrando custos, 0 = R$ 6, 1 = R$ 12
  const [mostrandoResultado, setMostrandoResultado] = useState(false);
  const [cursorAtivo, setCursorAtivo] = useState(false);
  const [linhasCustos, setLinhasCustos] = useState(0); // quantas linhas de custos apareceram
  const [mostraTotal, setMostraTotal] = useState(false);

  // Timeline inicial: revela custos linha por linha, depois começa desafio
  useEffect(() => {
    const timers: number[] = [];

    // Linhas de custo aparecem em sequência
    CUSTOS_DETALHE.forEach((_, i) => {
      timers.push(window.setTimeout(() => setLinhasCustos(i + 1), 800 + i * 600));
    });

    // Total aparece depois
    timers.push(window.setTimeout(() => setMostraTotal(true), 800 + CUSTOS_DETALHE.length * 600 + 400));

    // Começa o desafio de precificação
    timers.push(window.setTimeout(() => setRodadaIdx(0), 800 + CUSTOS_DETALHE.length * 600 + 1200));

    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  // Timeline do desafio: digita, mostra resultado, muda de rodada
  useEffect(() => {
    if (rodadaIdx < 0) return;
    const timers: number[] = [];
    const preco = PRECOS_TESTE[rodadaIdx];

    setPrecoTyped("");
    setMostrandoResultado(false);
    setCursorAtivo(true);

    // Auto-digita o preço
    preco.split("").forEach((_, i) => {
      timers.push(
        window.setTimeout(() => {
          setPrecoTyped(preco.slice(0, i + 1));
        }, 400 + 120 * (i + 1))
      );
    });

    // Depois de digitar, "clica" e mostra resultado
    const digitEndTime = 400 + 120 * preco.length + 400;
    timers.push(window.setTimeout(() => {
      setCursorAtivo(false);
      setMostrandoResultado(true);
    }, digitEndTime));

    // Se é primeira rodada, avança pra segunda
    if (rodadaIdx === 0) {
      timers.push(window.setTimeout(() => {
        setRodadaIdx(1);
      }, digitEndTime + 3800));
    } else {
      // Rodada 2 (lucro) — libera botão depois do resultado
      timers.push(window.setTimeout(onReady, digitEndTime + 1500));
    }

    return () => timers.forEach((t) => clearTimeout(t));
  }, [rodadaIdx, onReady]);

  // Cálculos
  const precoNum = parseFloat(precoTyped.replace(",", ".")) || 0;
  const lucro = precoNum - CUSTO_POR_CAIXA;
  const margem = precoNum > 0 ? (lucro / precoNum) * 100 : 0;
  const isPrejuizo = margem < 30; // menos de 30% margem = "apertado"

  return (
    <>
      <div className="ob-slide-textabove">
        <span className="ob-slide-eyebrow">Com o Doonly...</span>
        <h2 className="ob-slide-title">DESCUBRA O<br/>PREÇO CERTO</h2>
      </div>

      <div className="ob-prec-card">
        {/* Cabeçalho do produto */}
        <div className="ob-prec-produto">
          <div className="ob-prec-produto-img">
            <img src="/tutorial/caixa4.jpg" alt="Caixa de Brigadeiro" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <p className="ob-prec-produto-nome">Caixa de Brigadeiro</p>
            <p className="ob-prec-produto-info">4 unidades · gourmet</p>
          </div>
        </div>

        {/* Detalhamento de custos — aparece linha por linha */}
        <div className="ob-prec-detalhes">
          <span className="ob-prec-detalhes-titulo">Custos da produção (40 un)</span>

          {CUSTOS_DETALHE.map((c, i) => (
            <div key={c.label} className={`ob-prec-linha ${i < linhasCustos ? "ob-prec-linha--visible" : ""}`}>
              <span className="ob-prec-linha-label">
                <span className="ob-prec-linha-icone">{c.icone}</span>
                {c.label}
              </span>
              <span className="ob-prec-linha-valor">
                <span className="ob-prec-preco-symbol">R$</span>
                <span className="ob-prec-preco-value">{c.valor.toFixed(2).replace(".", ",")}</span>
              </span>
            </div>
          ))}

          {/* Divisor */}
          <div className={`ob-prec-divider ${mostraTotal ? "ob-prec-divider--visible" : ""}`} />

          {/* Total */}
          <div className={`ob-prec-linha ob-prec-linha--total ${mostraTotal ? "ob-prec-linha--visible" : ""}`}>
            <span className="ob-prec-linha-label">Total</span>
            <span className="ob-prec-linha-valor">
              <span className="ob-prec-preco-symbol">R$</span>
              <span className="ob-prec-preco-value">{CUSTO_TOTAL.toFixed(2).replace(".", ",")}</span>
            </span>
          </div>

          {/* Custo por caixa (destaque) */}
          <div className={`ob-prec-linha ob-prec-linha--destaque ${mostraTotal ? "ob-prec-linha--visible" : ""}`}>
            <span className="ob-prec-linha-label">Custo por caixa</span>
            <span className="ob-prec-linha-valor">
              <span className="ob-prec-preco-symbol">R$</span>
              <span className="ob-prec-preco-value">{CUSTO_POR_CAIXA.toFixed(2).replace(".", ",")}</span>
            </span>
          </div>
        </div>

        {/* Pergunta + input (aparece só depois dos custos) */}
        {rodadaIdx >= 0 && (
          <div className="ob-prec-pergunta">
            <label className="ob-prec-label">Por quanto vende a caixa?</label>
            <div className={`ob-prec-input ${mostrandoResultado ? (isPrejuizo ? "ob-prec-input--prejuizo" : "ob-prec-input--lucro") : ""}`}>
              <span className="ob-prec-input-symbol">R$</span>
              <span className="ob-prec-input-value">{precoTyped}</span>
              {cursorAtivo && <span className="ob-prec-cursor" />}
            </div>
          </div>
        )}

        {/* Resultado */}
        {mostrandoResultado && (
          <div className={`ob-prec-resultado ${isPrejuizo ? "ob-prec-resultado--prejuizo" : "ob-prec-resultado--lucro"}`} key={rodadaIdx}>
            <span className="ob-prec-resultado-label">
              {isPrejuizo ? "Margem apertada" : "Lucro por caixa"}
            </span>
            <div className="ob-prec-resultado-linha">
              <span className="ob-prec-resultado-valor">
                R$ {lucro.toFixed(2).replace(".", ",")}
              </span>
              <span className="ob-prec-resultado-divider" />
              <span className="ob-prec-resultado-margem">
                {margem.toFixed(0)}% margem
              </span>
            </div>
            {!isPrejuizo && <span className="ob-prec-resultado-ideal">Margem ideal!</span>}
          </div>
        )}
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

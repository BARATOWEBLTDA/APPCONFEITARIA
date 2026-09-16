import { useState, useEffect, useCallback, useMemo } from "react";
import { CaretRight } from "@phosphor-icons/react";
import { tocarSom } from "@/hooks/useSom";

// Vibração leve (só mobile, ignora silenciosamente onde não tem suporte)
const vibrarLeve = () => {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
  } catch {}
};

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

  // Pré-carrega TODAS as imagens do tutorial assim que ele abre.
  // Enquanto o usuário lê o Welcome, o browser baixa tudo em background,
  // então quando ele chega em Clientes/Pedidos/Cardápio, imagens já estão em cache.
  useEffect(() => {
    if (!isOpen) return;
    const urls = [
      "/Sistema/TUTORIAL.png",
      "/google-maps.png",
      "/tutorial/cliente1.jpeg",
      "/tutorial/cliente2.jpeg",
      "/tutorial/doisamores.jpg",
      "/tutorial/salgadinhos.jpg",
      "/tutorial/caixa4.jpg",
      "/tutorial/moca.webp",
      "/tutorial/ninho.webp",
      "/tutorial/cremedeleite.webp",
      "/tutorial/nutella.webp",
      "/tutorial/sicao.png",
      "/tutorial/forminha.webp",
    ];
    urls.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const next = () => {
    if (slideIdx < TOTAL_SLIDES - 1) {
      tocarSom('click');
      vibrarLeve();
      setSlideReady(false);
      setSlideIdx((i) => i + 1);
    } else {
      finish();
    }
  };

  const finish = () => {
    tocarSom('sucesso');
    vibrarLeve();
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
        {slideIdx === 5 && <SlideCardapio onReady={handleSlideReady} />}
        {slideIdx === 6 && <SlidePlaceholder eyebrow="Receitas que fazem as contas" title="MONTE A RECEITA. O DOONLY CALCULA." subtitle="Ingredientes, embalagem, custos e lucro reunidos automaticamente." emoji="📝" onReady={handleSlideReady} />}
        {slideIdx === 7 && <SlidePlaceholder eyebrow="Tudo trabalhando junto" title="VOCÊ FAZ OS DOCES. O DOONLY ORGANIZA." subtitle="Sua rotina, seus números e seu negócio mais fáceis de acompanhar." emoji="📊" onReady={handleSlideReady} />}
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
          background: linear-gradient(160deg, #FF9AC1 0%, #E85A8C 40%, #A8235A 70%, #E85A8C 100%);
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
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
          touch-action: pan-y;
          overscroll-behavior: contain;
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
          background: rgba(255, 255, 255, 0.6);
        }
        .ob-dot--active {
          background: #FFFFFF;
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
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
          animation: obSlideIn 0.55s cubic-bezier(0.22, 1, 0.36, 1);
          overflow-y: auto;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge antigo */
          -webkit-overflow-scrolling: touch;
        }
        /* Quando tem textabove (telas com título fixo em cima), remove o centering
           e fixa o texto no topo — evita oscilação com conteúdo dinâmico */
        .ob-content:has(.ob-slide-textabove) {
          justify-content: flex-start;
          padding-top: 1.85rem;
        }
        .ob-content::-webkit-scrollbar {
          display: none; /* Chrome/Safari/Opera */
        }
        @keyframes obSlideIn {
          from {
            opacity: 0;
            transform: translateY(24px) scale(0.98);
          }
          60% {
            opacity: 1;
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        /* Respeita usuário que pediu menos animação */
        @media (prefers-reduced-motion: reduce) {
          .ob-content { animation: obFadeSimple 0.2s ease; }
        }
        @keyframes obFadeSimple {
          from { opacity: 0; }
          to { opacity: 1; }
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
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          -webkit-user-select: none;
        }
        .ob-nav-btn:active { transform: scale(0.97); }
        .ob-nav-btn--next {
          flex: 1;
          height: 52px;
          padding: 0 1.5rem;
          color: var(--primary-dark, #A8235A);
          border-radius: 14px;
          background: #FFFFFF;
          box-shadow: 0 8px 24px rgba(60, 15, 40, 0.3), inset 0 1px 0 rgba(255,255,255,0.9);
          letter-spacing: 0.01em;
          font-weight: 800;
        }
        .ob-nav-btn--next:hover {
          box-shadow: 0 10px 32px rgba(60, 15, 40, 0.4), inset 0 1px 0 rgba(255,255,255,0.9);
          transform: translateY(-1px);
        }

        /* ── Slides: títulos e textos comuns ── */
        .ob-slide-eyebrow {
          font-size: 0.85rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
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
          margin: 1.1rem 0 0.5rem;
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
          width: clamp(200px, 55vw, 280px);
          height: auto;
          margin-bottom: 1.5rem;
          opacity: 0;
          transform: scale(0.6);
          animation:
            obCoroaEntrada 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s forwards,
            obCoroaPulse 4.5s ease-in-out 0.9s infinite;
        }
        @keyframes obCoroaEntrada {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes obCoroaPulse {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 14px rgba(255,255,255,0.35));
          }
          50% {
            transform: scale(1.04);
            filter: drop-shadow(0 0 32px rgba(255,255,255,0.65)) drop-shadow(0 0 70px rgba(255,220,235,0.4));
          }
        }

        .ob-welcome-anchor {
          margin: 0;
          padding: 0 1.25rem;
          max-width: 620px;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          color: #fff;
          text-align: center;
          text-shadow: 0 2px 24px rgba(0,0,0,0.35);
        }
        .ob-welcome-eyebrow {
          font-size: 0.85rem;
          font-weight: 600;
          letter-spacing: 0.28em;
          color: rgba(255,255,255,0.72);
          opacity: 0;
          transform: translateY(10px);
          animation: obFadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .ob-welcome-block {
          font-size: clamp(1.25rem, 6.5vw, 1.7rem);
          font-weight: 800;
          line-height: 1.22;
          letter-spacing: 0.005em;
          opacity: 0;
          transform: translateY(14px);
          animation: obFadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .ob-welcome-anchor .ob-fill {
          display: inline-block;
          font-weight: 900;
          text-shadow: none;
          color: #FFF8F0;
          background: rgba(255, 255, 255, 0.14);
          padding: 0.02em 0.35em;
          border-radius: 0.35em;
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
        }

        /* ── Slide 1: layout split (mobile = fluxo normal, desktop = 2 colunas) ── */
        .ob-slide1-split {
          display: contents;
        }
        .ob-slide1-left, .ob-slide1-right {
          display: contents;
        }
        .ob-slide1-orb { display: none; }

        @media (min-width: 900px) {
          .ob-slide1-split {
            display: grid;
            grid-template-columns: auto auto;
            gap: 3rem;
            max-width: 900px;
            width: 100%;
            align-items: center;
            justify-content: center;
            padding: 0 2rem;
          }
          .ob-slide1-left {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            order: 1;
          }
          .ob-slide1-right {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            position: relative;
            order: 2;
          }
          .ob-slide1-right .ob-coroa-wrap {
            position: relative;
            z-index: 2;
          }
          .ob-slide1-right .ob-welcome-coroa {
            width: 280px;
            margin-bottom: 0;
          }
          .ob-slide1-left .ob-welcome-anchor {
            text-align: left;
            padding: 0;
            max-width: none;
          }
          .ob-slide1-left .ob-welcome-block {
            font-size: 2.6rem;
            line-height: 1.15;
          }
          .ob-slide1-left .ob-welcome-eyebrow {
            font-size: 0.95rem;
          }
          /* Orbs decorativos atrás do mascote */
          .ob-slide1-orb {
            display: block;
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.18);
            filter: blur(40px);
            -webkit-filter: blur(40px);
            pointer-events: none;
            z-index: 1;
          }
          .ob-slide1-orb--a {
            width: 220px; height: 220px;
            top: 10%; right: 5%;
            animation: ob1Float 12s ease-in-out infinite;
          }
          .ob-slide1-orb--b {
            width: 160px; height: 160px;
            bottom: 15%; left: 10%;
            animation: ob1Float 14s ease-in-out 2s infinite reverse;
          }
          @keyframes ob1Float {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.55; }
            50% { transform: translate(30px, -20px) scale(1.15); opacity: 0.75; }
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
          background: #FFFFFF;
          color: var(--primary-dark, #A8235A);
          border: none;
          border-radius: 999px;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(60, 15, 40, 0.3);
          transition: transform 0.15s, box-shadow 0.2s;
        }
        .ob-final-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(60, 15, 40, 0.4);
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
        @media (min-width: 900px) {
          .ob-pedidos-stack {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
            max-width: 1100px;
            perspective: none;
          }
          .ob-ped-kanban-col {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            min-width: 0;
          }
          .ob-ped-kanban-header {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.5rem 0.85rem;
            border-radius: 10px;
            font-size: 0.8rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }
          .ob-ped-kanban-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
          }
          .ob-ped-kanban-count {
            margin-left: auto;
            background: rgba(255,255,255,0.55);
            padding: 1px 8px;
            border-radius: 999px;
            font-size: 0.7rem;
          }
          .ob-ped-kanban-list {
            display: flex;
            flex-direction: column;
            gap: 0.6rem;
          }
          .ob-ped-card--kanban {
            padding: 0;
            opacity: 1;
            transform: none;
            animation: obPedidoFadeIn 0.4s ease both;
            box-shadow: 0 6px 18px rgba(0,0,0,0.2), 0 2px 6px rgba(0,0,0,0.12);
          }
          @keyframes obPedidoFadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
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
          margin-top: 0.75rem;
        }
        @media (min-width: 900px) {
          .ob-clientes-stack {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
            max-width: 900px;
            margin-top: 1.25rem;
          }
        }
        .ob-cli-card {
          background: #fff;
          color: #2C2C2A;
          border-radius: 14px;
          border: 1px solid #F0EBED;
          padding: 18px 16px;
          text-align: left;
          animation: obClienteFlowIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
          transform-origin: center top;
        }
        @keyframes obClienteFlowIn {
          from {
            opacity: 0;
            transform: translateY(-14px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .ob-cli-header {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .ob-cli-avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 20px;
          letter-spacing: -0.02em;
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
          font-size: 17px;
          font-weight: 800;
          color: #2C2C2A;
          line-height: 1.15;
          letter-spacing: -0.015em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ob-cli-sub {
          font-size: 13px;
          color: #888780;
          margin-top: 3px;
          font-weight: 500;
        }
        .ob-cli-divider {
          height: 1px;
          background: #F0EBED;
          margin: 14px 0;
        }
        .ob-cli-stats {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 6px;
          margin-bottom: 12px;
        }
        .ob-cli-stat {
          background: #F8F5F1;
          border-radius: 10px;
          padding: 10px 8px;
          text-align: center;
          min-width: 0;
        }
        .ob-cli-stat-label {
          font-size: 9.5px;
          color: #888780;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .ob-cli-stat-valor {
          font-size: 18px;
          font-weight: 800;
          color: #2C2C2A;
          margin-top: 3px;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }
        .ob-cli-stat-valor--money {
          font-size: 15px;
        }
        .ob-cli-end-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: #FAF8F5;
          border-radius: 10px;
          margin-bottom: 8px;
        }
        .ob-cli-end-info {
          min-width: 0;
          flex: 1;
        }
        .ob-cli-end-label {
          font-size: 10px;
          color: #888780;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 3px;
        }
        .ob-cli-end-rua {
          font-size: 13px;
          font-weight: 700;
          color: #2C2C2A;
          letter-spacing: -0.01em;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ob-cli-end-sec {
          font-size: 11.5px;
          color: #888780;
          margin-top: 2px;
          font-weight: 500;
        }
        .ob-cli-mapa {
          width: 54px;
          height: 54px;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid #E0E5DC;
          flex-shrink: 0;
        }
        .ob-cli-mapa svg { display: block; }
        .ob-cli-inline {
          font-size: 12px;
          color: #5F5E5A;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 6px;
          padding: 4px 2px;
        }
        .ob-cli-inline strong {
          color: #2C2C2A;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .ob-cli-inline-l {
          color: #888780;
          font-weight: 500;
        }
        .ob-cli-aniv-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          margin-top: 8px;
          background: #FEF0DF;
          border-radius: 10px;
          font-size: 12px;
          color: #854F0B;
        }
        .ob-cli-aniv-row strong {
          color: #854F0B;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }
        .ob-cli-aniv-row .ob-cli-inline-l {
          color: #854F0B;
          font-weight: 600;
        }
        .ob-cli-aniv-cta {
          font-size: 11.5px;
          font-weight: 700;
          color: #E85A8C;
          text-decoration: underline;
          text-decoration-thickness: 1.5px;
          text-underline-offset: 2px;
          white-space: nowrap;
        }

        /* === CARDÁPIO — mockup fiel ao app === */
        .ob-cardapio-phone {
          position: relative;
          width: 275px;
          max-width: 82vw;
          background: #0e0509;
          border-radius: 34px;
          padding: 8px;
          margin-top: 0.4rem;
          box-shadow:
            0 24px 60px rgba(0,0,0,0.55),
            0 0 0 2px rgba(255,255,255,0.06) inset,
            0 0 0 1px rgba(0,0,0,0.9);
          opacity: 0;
          transform: translateY(20px) scale(0.94);
          animation: obPhoneIn 0.7s cubic-bezier(0.22, 1.1, 0.36, 1) 0.25s both;
        }
        /* Nesta slide, zera o gap padrão embaixo do bloco de texto — assim
           eyebrow → título → mockup ficam com o MESMO espaçamento (~0.4rem) */
        .ob-content:has(.ob-cardapio-phone) .ob-slide-textabove {
          margin-bottom: 0;
        }
        @keyframes obPhoneIn {
          from { opacity: 0; transform: translateY(20px) scale(0.94); }
          to   { opacity: 1; transform: scale(1); }
        }
        .ob-cardapio-notch {
          position: absolute;
          top: 14px;
          left: 50%;
          transform: translateX(-50%);
          width: 82px;
          height: 22px;
          background: #000;
          border-radius: 14px;
          z-index: 2;
        }
        .ob-cardapio-screen {
          background: #f8f8f8;
          border-radius: 26px;
          overflow: hidden;
          color: #111;
          min-height: 420px;
          padding-top: 30px;
          position: relative;
        }
        /* Faixa colorida rosa no topo */
        .ob-cardapio-faixa {
          height: 52px;
          background: linear-gradient(180deg, #ec4899 0%, #db2777 100%);
        }
        /* Logo circular sobreposta */
        .ob-cardapio-logo-wrap {
          position: relative;
          height: 0;
          display: flex;
          justify-content: center;
        }
        .ob-cardapio-logo {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: #fff;
          border: 3px solid #ec4899;
          color: #ec4899;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 1.35rem;
          margin-top: -26px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        /* Info da loja */
        .ob-cardapio-info {
          padding: 30px 12px 8px;
          text-align: center;
        }
        .ob-cardapio-nome {
          font-size: 0.9rem;
          font-weight: 800;
          color: #111;
          line-height: 1.15;
        }
        .ob-cardapio-sub {
          font-size: 0.65rem;
          color: #666;
          margin-top: 3px;
        }
        /* Chips de categoria */
        .ob-cardapio-chips {
          display: flex;
          gap: 6px;
          padding: 8px 10px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .ob-cardapio-chips::-webkit-scrollbar { display: none; }
        .ob-cardapio-chip {
          font-size: 0.6rem;
          font-weight: 600;
          padding: 5px 10px;
          border-radius: 999px;
          background: #fff;
          color: #666;
          border: 1px solid #e5e7eb;
          white-space: nowrap;
        }
        .ob-cardapio-chip--active {
          background: #ec4899;
          color: #fff;
          border-color: #ec4899;
        }
        /* Lista de produtos */
        .ob-cardapio-lista {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 4px 10px 12px;
        }
        .ob-cardapio-item {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fff;
          border-radius: 12px;
          border: 1px solid #f3f4f6;
          padding: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          animation: obCardapioItemIn 0.5s cubic-bezier(0.22, 1.1, 0.36, 1) both;
        }
        @keyframes obCardapioItemIn {
          0% {
            opacity: 0;
            transform: translateY(-10px) scale(0.92);
            max-height: 0;
            padding-top: 0;
            padding-bottom: 0;
            margin-bottom: -8px;
          }
          60% {
            opacity: 1;
            max-height: 90px;
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            max-height: 90px;
            padding-top: 8px;
            padding-bottom: 8px;
            margin-bottom: 0;
          }
        }
        .ob-cardapio-item-img {
          width: 54px;
          height: 54px;
          border-radius: 8px;
          overflow: hidden;
          background: #fdf2f8;
          flex-shrink: 0;
        }
        .ob-cardapio-item-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .ob-cardapio-item-info {
          flex: 1;
          min-width: 0;
        }
        .ob-cardapio-item-nome {
          font-size: 0.72rem;
          font-weight: 700;
          color: #111;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ob-cardapio-item-desc {
          font-size: 0.58rem;
          color: #999;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ob-cardapio-item-preco {
          font-size: 0.75rem;
          font-weight: 800;
          color: #22c55e;
          margin-top: 3px;
        }
        .ob-cardapio-item-btn {
          background: #ec4899;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 6px 8px;
          font-size: 0.6rem;
          font-weight: 700;
          white-space: nowrap;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(236,72,153,0.35);
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
            padding: 1rem 1.5rem 4rem;
          }
        }

        /* ── Slide 2: Card de pedido novo (mesmo do Pedidos.tsx real) ── */
        .ob-newped-lista {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 0;
        }
        .ob-newped-lista-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: rgba(255,255,255,0.72);
          text-align: center;
          margin: 0 0 6px;
          text-transform: uppercase;
        }
        @keyframes obNewPedIn {
          from { opacity: 0; transform: translateY(-14px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .ob-newped-card {
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 14px;
          padding: 14px 16px;
          font-family: var(--font-base), -apple-system, sans-serif;
          color: #2C2C2A;
          text-align: left;
        }
        .ob-newped-header {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .ob-newped-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: -0.01em;
          flex-shrink: 0;
        }
        .ob-newped-header-info { flex: 1; min-width: 0; }
        .ob-newped-cliente-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .ob-newped-cliente {
          font-size: 14px;
          font-weight: 700;
          color: #2C2C2A;
          letter-spacing: -0.01em;
        }
        .ob-newped-num {
          font-size: 12px;
          font-weight: 600;
          color: #B4B2A9;
        }
        .ob-newped-tel {
          font-size: 12px;
          color: #888780;
          margin-top: 2px;
        }
        .ob-newped-menu {
          padding: 2px 4px;
          color: #888780;
          display: flex;
          align-items: center;
        }
        .ob-newped-tags {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
          margin: 10px 0 12px;
        }
        .ob-newped-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 999px;
          letter-spacing: -0.005em;
          white-space: nowrap;
        }
        .ob-newped-tag--origem {
          background: #F1EFE8;
          color: #5F5E5A;
        }
        .ob-newped-datas {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .ob-newped-data-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #5F5E5A;
          line-height: 1.5;
        }
        .ob-newped-data-ic {
          color: #888780;
          display: inline-flex;
          align-items: center;
        }
        .ob-newped-data-label { color: #5F5E5A; }
        .ob-newped-data-val { color: #2C2C2A; font-weight: 500; }
        .ob-newped-divisor {
          height: 1px;
          background: #E8E5DC;
          margin: 12px 0 10px;
        }
        .ob-newped-itens {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .ob-newped-item-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 12px;
          color: #2C2C2A;
        }
        .ob-newped-item-nome {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ob-newped-item-qtd {
          color: #888780;
          font-weight: 700;
          margin-right: 6px;
        }
        .ob-newped-item-val {
          flex-shrink: 0;
          font-variant-numeric: tabular-nums;
          color: #5F5E5A;
        }
        .ob-newped-total-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          font-weight: 700;
          color: #2C2C2A;
          margin-top: 10px;
          letter-spacing: -0.01em;
        }
        .ob-newped-total-row span:last-child {
          font-variant-numeric: tabular-nums;
        }
        .ob-newped-cta {
          text-align: center;
          margin-top: 12px;
          background: #E85A8C;
          color: #fff;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
      `}</style>
    </div>
  );
}

/* ─── Slide 1: Boas-vindas ──────────────────────── */
function Slide1Welcome({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    // Fade-in mais curto: eyebrow entra ~150ms, bloco ~350ms, ambos completam em ~1000ms.
    // Damos uma folga curta e liberamos o botão "Começar".
    const t = window.setTimeout(onReady, 900);
    return () => clearTimeout(t);
  }, [onReady]);

  return (
    <div className="ob-slide1-split">
      <div className="ob-slide1-right">
        <div className="ob-slide1-orb ob-slide1-orb--a" aria-hidden="true" />
        <div className="ob-slide1-orb ob-slide1-orb--b" aria-hidden="true" />
        <div className="ob-coroa-wrap">
          <img
            src="/log.png"
            alt=""
            className="ob-welcome-coroa"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      </div>

      <div className="ob-slide1-left">
        <div className="ob-welcome-anchor">
          <div className="ob-welcome-block" style={{ animationDelay: "0.15s" }}>
            SUA CONFEITARIA<br/>
            <span className="ob-fill">ORGANIZADA</span><br/>
            DO PEDIDO AO <span className="ob-fill">LUCRO</span>
          </div>
          <div className="ob-welcome-eyebrow" style={{ animationDelay: "0.35s", marginTop: "1.1rem", textTransform: "none", letterSpacing: "0", opacity: 0.9, fontSize: "1.05rem", fontWeight: 500, lineHeight: 1.45 }}>
            Tudo o que você precisa para cuidar do seu negócio em um só lugar.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Slide Placeholder (será substituído nas próximas etapas) ─── */
function SlidePlaceholder({ eyebrow, title, subtitle, emoji, onReady }: { eyebrow?: string; title: string; subtitle: string; emoji: string; onReady: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onReady, 500);
    return () => clearTimeout(t);
  }, [onReady]);
  return (
    <>
      <div className="ob-placeholder-emoji">{emoji}</div>
      {eyebrow && <p className="ob-slide-eyebrow" style={{ marginBottom: "0.35rem" }}>{eyebrow}</p>}
      <h2 className="ob-slide-title">{title}</h2>
      <p className="ob-slide-text">{subtitle}</p>
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
    telefone: "(41) 99530-5803",
    initials: "AC",
    avatarBg: "#FCE0E9",
    avatarColor: "#993556",
    imagem: "/tutorial/cliente1.jpeg",
    tempo: "8 meses",
    totalPedidos: 12,
    totalGasto: "R$ 1.800",
    ticketMedio: "R$ 150",
    ultimaCompra: "há 3 dias",
    aniversario: "em 7 dias",
    dataAniversario: "15/03",
    endereco: "Rua das Palmeiras, 342",
    enderecoSec: "Batel · Curitiba/PR",
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
  {
    id: 3,
    nome: "Larissa Ferreira",
    initials: "LF",
    avatarBg: "#22c55e", // verde
    imagem: null,
    tempo: "6 meses",
    totalPedidos: 5,
    totalGasto: "R$ 487,50",
    ticketMedio: "R$ 97,50",
    ultimaCompra: "há 3 dias",
    aniversario: null,
  },
  {
    id: 4,
    nome: "Camila Ribeiro",
    initials: "CR",
    avatarBg: "#E85A8C", // rosa
    imagem: null,
    tempo: "2 anos",
    totalPedidos: 18,
    totalGasto: "R$ 2.340,00",
    ticketMedio: "R$ 130,00",
    ultimaCompra: "há 2 dias",
    aniversario: "em 20 dias",
  },
  {
    id: 5,
    nome: "Patrícia Rocha",
    initials: "PR",
    avatarBg: "#0891b2", // ciano
    imagem: null,
    tempo: "4 meses",
    totalPedidos: 2,
    totalGasto: "R$ 158,00",
    ticketMedio: "R$ 79,00",
    ultimaCompra: "há 2 semanas",
    aniversario: null,
  },
  {
    id: 6,
    nome: "Juliana Souza",
    initials: "JS",
    avatarBg: "#eab308", // amarelo
    imagem: null,
    tempo: "1 ano",
    totalPedidos: 7,
    totalGasto: "R$ 692,00",
    ticketMedio: "R$ 98,86",
    ultimaCompra: "há 10 dias",
    aniversario: null,
  },
];

function SlideClientes({ onReady }: { onReady: () => void }) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const timers: number[] = [];

    // Pré-carrega a imagem do primeiro cliente
    const primeiroImg = CLIENTES_DEMO[0]?.imagem;
    const preload = primeiroImg
      ? new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = primeiroImg;
        })
      : Promise.resolve();

    let cancelado = false;
    preload.then(() => {
      if (cancelado) return;
      timers.push(window.setTimeout(() => setVisivel(true), 300));
      timers.push(window.setTimeout(onReady, 900));
    });

    return () => {
      cancelado = true;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [onReady]);

  const visiveis = visivel ? [CLIENTES_DEMO[0]] : [];

  return (
    <div className="ob-slide-textabove">
      <p className="ob-slide-eyebrow">Seus clientes, mais perto</p>
      <h2 className="ob-slide-title">
        LEMBRE DE CADA CLIENTE
        <br />
        E DE CADA DETALHE
      </h2>

      <div className="ob-clientes-stack">
        {visiveis.map((c) => (
          <div key={c.id} className="ob-cli-card">
            <div className="ob-cli-header">
              <div className="ob-cli-avatar" style={{ background: c.avatarBg, color: (c as any).avatarColor || '#993556' }}>
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
                <div className="ob-cli-sub">{(c as any).telefone || `Cliente há ${c.tempo}`}</div>
              </div>
            </div>

            <div className="ob-cli-divider" />

            <div className="ob-cli-stats">
              <div className="ob-cli-stat">
                <div className="ob-cli-stat-label">Pedidos</div>
                <div className="ob-cli-stat-valor">{c.totalPedidos}</div>
              </div>
              <div className="ob-cli-stat">
                <div className="ob-cli-stat-label">Total</div>
                <div className="ob-cli-stat-valor ob-cli-stat-valor--money">{c.totalGasto}</div>
              </div>
              <div className="ob-cli-stat">
                <div className="ob-cli-stat-label">Ticket</div>
                <div className="ob-cli-stat-valor ob-cli-stat-valor--money">{c.ticketMedio}</div>
              </div>
            </div>

            {(c as any).endereco && (
              <div className="ob-cli-end-row">
                <div className="ob-cli-end-info">
                  <div className="ob-cli-end-label">Endereço</div>
                  <div className="ob-cli-end-rua">{(c as any).endereco}</div>
                  <div className="ob-cli-end-sec">{(c as any).enderecoSec}</div>
                </div>
                <div className="ob-cli-mapa" aria-hidden="true">
                  <svg width="54" height="54" viewBox="0 0 54 54" xmlns="http://www.w3.org/2000/svg">
                    <rect width="54" height="54" fill="#EDEBE0"/>
                    <path d="M0 18 L54 22" stroke="#CFD3C0" strokeWidth="4" fill="none"/>
                    <path d="M0 36 L54 40" stroke="#CFD3C0" strokeWidth="3" fill="none"/>
                    <path d="M18 0 L22 54" stroke="#D8DCC9" strokeWidth="2.5" fill="none"/>
                    <path d="M38 0 L40 54" stroke="#D8DCC9" strokeWidth="2" fill="none"/>
                    <path d="M0 8 L54 6" stroke="#DCE0CD" strokeWidth="1.5" fill="none" opacity="0.7"/>
                    <circle cx="28" cy="26" r="8" fill="#E85A8C" opacity="0.95"/>
                    <circle cx="28" cy="26" r="3" fill="#fff"/>
                  </svg>
                </div>
              </div>
            )}

            <div className="ob-cli-inline">
              <span className="ob-cli-inline-l">⏱ Última compra:</span>
              <strong>{c.ultimaCompra}</strong>
            </div>
            {(c as any).dataAniversario && (
              <div className="ob-cli-aniv-row">
                <span className="ob-cli-inline-l">🎂 Aniversário: <strong>{(c as any).dataAniversario}</strong></span>
                <span className="ob-cli-aniv-cta">Enviar cardápio</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="ob-slide-subtitle-top" style={{ marginTop: "1rem" }}>Histórico, pedidos e informações importantes sempre à mão.</p>
    </div>
  );
}

// ============================================================
//  SLIDE CARDÁPIO — "Seu cardápio na mão das clientes"
//  Mockup de celular mostrando o cardápio da confeitaria
// ============================================================
const CARDAPIO_ITEMS = [
  {
    id: 1,
    nome: "Bolo Dois Amores",
    desc: "Chocolate com brigadeiro",
    preco: "R$ 119,90",
    imagem: "/tutorial/doisamores.jpg",
  },
  {
    id: 2,
    nome: "Caixa de Brigadeiro",
    desc: "16 unidades gourmet",
    preco: "R$ 45,00",
    imagem: "/tutorial/caixa4.jpg",
  },
  {
    id: 3,
    nome: "Cento de Salgadinhos",
    desc: "Misto sortido",
    preco: "R$ 67,90",
    imagem: "/tutorial/salgadinhos.jpg",
  },
];

function SlideCardapio({ onReady }: { onReady: () => void }) {
  const [visiveis, setVisiveis] = useState<typeof CARDAPIO_ITEMS>([]);

  useEffect(() => {
    const timers: number[] = [];

    // Pré-carrega imagens
    const imgs = CARDAPIO_ITEMS.map((i) => i.imagem);
    const preload = Promise.all(
      imgs.map(
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
      // Itens entram um por um
      CARDAPIO_ITEMS.forEach((item, i) => {
        timers.push(window.setTimeout(() => {
          setVisiveis((prev) => [...prev, item]);
        }, 800 + i * 500));
      });
      // Libera botão depois do último
      timers.push(window.setTimeout(onReady, 800 + CARDAPIO_ITEMS.length * 500 + 800));
    });

    return () => {
      cancelado = true;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [onReady]);

  return (
    <>
      <div className="ob-slide-textabove">
        <span className="ob-slide-eyebrow">Sua vitrine online</span>
        <h2 className="ob-slide-title">UM CARDÁPIO BONITO<br/>E PRONTO PARA VENDER</h2>
        <p className="ob-slide-subtitle-top">Mostre seus produtos e facilite o pedido das suas clientes.</p>
      </div>

      <div className="ob-cardapio-phone">
        <div className="ob-cardapio-notch" />
        <div className="ob-cardapio-screen">
          {/* Faixa colorida rosa (identity) */}
          <div className="ob-cardapio-faixa" />
          {/* Logo circular sobreposta */}
          <div className="ob-cardapio-logo-wrap">
            <div className="ob-cardapio-logo">L</div>
          </div>
          {/* Info da loja */}
          <div className="ob-cardapio-info">
            <div className="ob-cardapio-nome">Confeitaria da Larissa</div>
            <div className="ob-cardapio-sub">⭐ 4.9 · Delícias artesanais</div>
          </div>
          {/* Chips de categoria */}
          <div className="ob-cardapio-chips">
            <span className="ob-cardapio-chip ob-cardapio-chip--active">Todos</span>
            <span className="ob-cardapio-chip">Bolos</span>
            <span className="ob-cardapio-chip">Doces</span>
            <span className="ob-cardapio-chip">Salgados</span>
          </div>
          {/* Lista de produtos (modo lista) */}
          <div className="ob-cardapio-lista">
            {visiveis.map((item) => (
              <div key={item.id} className="ob-cardapio-item">
                <div className="ob-cardapio-item-img">
                  <img
                    src={item.imagem}
                    alt={item.nome}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <div className="ob-cardapio-item-info">
                  <div className="ob-cardapio-item-nome">{item.nome}</div>
                  <div className="ob-cardapio-item-desc">{item.desc}</div>
                  <div className="ob-cardapio-item-preco">{item.preco}</div>
                </div>
                <button className="ob-cardapio-item-btn">+ Adicionar</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Renderiza a imagem do pedido com fallback para emoji.
 * Enquanto a imagem não carrega (ou se falhar), mostra o emoji —
 * NUNCA um quadrado vazio. Quando a img dispara onLoad, faz um
 * cross-fade suave para a foto real.
 */
function PedidoImg({ src, alt, emoji }: { src?: string; alt: string; emoji: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src || failed) return <span>{emoji}</span>;

  return (
    <>
      {!loaded && <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{emoji}</span>}
      <img
        src={src}
        alt={alt}
        loading="eager"
        decoding="async"
        // @ts-ignore — fetchpriority é atributo HTML válido, tipos do React ainda não o incluem em todas as versões
        fetchpriority="high"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        style={{
          opacity: loaded ? 1 : 0,
          transition: "opacity 180ms ease-out",
        }}
      />
    </>
  );
}

// ── Slide 2: PEDIDOS (design novo, mesmo do Pedidos.tsx real) ──
// 2 cards com status diferentes, entrando com fade+slide

const ONBOARDING_PEDIDOS = [
  {
    id: 1,
    numero: "5",
    cliente: "Alanis Nunes",
    telefone: "(41) 99530-5803",
    initials: "AN",
    avatarBg: "#FCE0E9",
    avatarColor: "#993556",
    origem: "manual" as const,
    statusKey: "aguardando_aceite",
    statusLabel: "Aguardando aprovação",
    statusBg: "#FEF0DF",
    statusColor: "#854F0B",
    statusIcon: "clock",
    tipoEntrega: "retirada" as const,
    dataPedido: "15 de setembro às 09:45",
    dataEntrega: "15 de setembro às 11:00",
    itens: [{ qtd: 1, nome: "Bolo de Chocolate", valor: "R$ 40,00" }],
    total: "R$ 40,00",
    ctaLabel: "Aceitar pedido",
  },
  {
    id: 2,
    numero: "6",
    cliente: "Marina Silva",
    telefone: "(41) 98812-4471",
    initials: "MS",
    avatarBg: "#E6F1FB",
    avatarColor: "#185FA5",
    origem: "manual" as const,
    statusKey: "em_producao",
    statusLabel: "Em produção",
    statusBg: "#FCE0E9",
    statusColor: "#993556",
    statusIcon: "chef",
    tipoEntrega: "entrega" as const,
    dataPedido: "14 de setembro às 18:30",
    dataEntrega: "15 de setembro às 14:00",
    itens: [
      { qtd: 2, nome: "Brigadeiro gourmet", valor: "R$ 60,00" },
      { qtd: 1, nome: "Bolo Red Velvet", valor: "R$ 90,00" },
    ],
    total: "R$ 150,00",
    ctaLabel: "Finalizar produção",
  },
];

// SVGs inline pequenos para as tags e datas
function IconeNewPed({ nome }: { nome: string }) {
  const c = "currentColor";
  switch (nome) {
    case "clock":    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case "chef":     return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" y1="17" x2="18" y2="17"/></svg>;
    case "hand":     return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 17V5a1.5 1.5 0 0 1 3 0v6"/><path d="M14 11a1.5 1.5 0 0 1 3 0v3"/><path d="M17 12a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-2c-2 0-2.5-.4-4-2l-3.5-3.5C4 15.6 4.5 14 6 14h1"/><path d="M11 11V6a1.5 1.5 0 0 0-3 0v9"/></svg>;
    case "calendar": return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    case "home":     return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
    case "truck":    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
    case "dots":     return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>;
    default:         return null;
  }
}

function CardPedidoNovo({ p }: { p: typeof ONBOARDING_PEDIDOS[0] }) {
  const iconeEntrega = p.tipoEntrega === "entrega" ? "truck" : "home";
  const labelEntrega = p.tipoEntrega === "entrega" ? "Entrega" : "Retirada";
  return (
    <div className="ob-newped-card">
      <div className="ob-newped-header">
        <div className="ob-newped-avatar" style={{ background: p.avatarBg, color: p.avatarColor }}>
          {p.initials}
        </div>
        <div className="ob-newped-header-info">
          <div className="ob-newped-cliente-row">
            <span className="ob-newped-cliente">{p.cliente}</span>
            <span className="ob-newped-num">#{p.numero}</span>
          </div>
          <div className="ob-newped-tel">{p.telefone}</div>
        </div>
        <div className="ob-newped-menu"><IconeNewPed nome="dots" /></div>
      </div>

      <div className="ob-newped-tags">
        <span className="ob-newped-tag ob-newped-tag--origem">
          <IconeNewPed nome="hand" />
          Manual
        </span>
        <span className="ob-newped-tag" style={{ background: p.statusBg, color: p.statusColor }}>
          <IconeNewPed nome={p.statusIcon} />
          {p.statusLabel}
        </span>
      </div>

      <div className="ob-newped-datas">
        <div className="ob-newped-data-row">
          <span className="ob-newped-data-ic"><IconeNewPed nome="calendar" /></span>
          <span className="ob-newped-data-label">Pedido:</span>
          <span className="ob-newped-data-val">{p.dataPedido}</span>
        </div>
        <div className="ob-newped-data-row">
          <span className="ob-newped-data-ic"><IconeNewPed nome={iconeEntrega} /></span>
          <span className="ob-newped-data-label">{labelEntrega}:</span>
          <span className="ob-newped-data-val">{p.dataEntrega}</span>
        </div>
      </div>

      <div className="ob-newped-divisor" />

      <div className="ob-newped-itens">
        {p.itens.map((it, i) => (
          <div key={i} className="ob-newped-item-row">
            <span className="ob-newped-item-nome">
              <span className="ob-newped-item-qtd">{it.qtd}x</span>
              {it.nome}
            </span>
            <span className="ob-newped-item-val">{it.valor}</span>
          </div>
        ))}
      </div>

      <div className="ob-newped-total-row">
        <span>Total</span>
        <span>{p.total}</span>
      </div>

      <div className="ob-newped-cta">{p.ctaLabel}</div>
    </div>
  );
}

function Slide2Pedidos({ onReady }: { onReady: () => void }) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const timers: number[] = [];
    // Card entra rápido
    timers.push(window.setTimeout(() => setVisivel(true), 350));
    // Libera o botão "Próximo"
    timers.push(window.setTimeout(onReady, 900));
    return () => timers.forEach((t) => clearTimeout(t));
  }, [onReady]);

  return (
    <>
      <div className="ob-slide-textabove">
        <span className="ob-slide-eyebrow">Sua rotina mais leve</span>
        <h2 className="ob-slide-title">TODOS OS PEDIDOS<br/>NO LUGAR CERTO</h2>
        <p className="ob-slide-subtitle-top">Acompanhe cada encomenda sem depender de papel ou planilha.</p>
      </div>

      <div className="ob-newped-lista">
        <p className="ob-newped-lista-label">PEDIDOS PENDENTES</p>
        {visivel && (
          <div
            className="ob-newped-wrap"
            style={{ animation: "obNewPedIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both" }}
          >
            <CardPedidoNovo p={ONBOARDING_PEDIDOS[0]} />
          </div>
        )}
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
        <span className="ob-slide-eyebrow">Cadastre uma vez</span>
        <h2 className="ob-slide-title">SEUS INGREDIENTES<br/>SEMPRE ATUALIZADOS</h2>
        <p className="ob-slide-subtitle-top">Informe preço e quantidade para o Doonly usar nas suas receitas.</p>
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
        <p className="ob-slide-subtitle">O PREÇO CERTO<br/>EM CADA RECEITA</p>
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
        <span className="ob-slide-eyebrow">Seu trabalho tem valor</span>
        <h2 className="ob-slide-title" style={{ fontSize: "clamp(1.05rem, 4.6vw, 1.45rem)" }}>
          PARE DE VENDER,<br/>
          SEM SABER SE LUCROU
        </h2>
        <p className="ob-slide-subtitle-top">O Doonly mostra quanto custa produzir e quanto sobra para você.</p>
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
      <p className="ob-slide-eyebrow" style={{ marginBottom: "0.35rem" }}>Tudo pronto para começar</p>
      <h2 className="ob-final-title">AGORA É A SUA VEZ</h2>
      <p className="ob-final-sub">Vamos deixar o Doonly com a cara da sua confeitaria.</p>
      <button className="ob-final-cta" onClick={onStart}>
        Configurar minha confeitaria
      </button>
    </>
  );
}

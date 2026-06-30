import { useState } from "react";
import { CaretRight, CaretLeft, X } from "@phosphor-icons/react";

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
  onClose: () => void;
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

  const prev = () => {
    if (slideIdx > 0) setSlideIdx((i) => i - 1);
  };

  const skip = () => finish();

  const finish = () => {
    setSlideIdx(0); // reset pra próxima vez
    onClose();
  };

  return (
    <div className="ob-root" role="dialog" aria-modal="true" aria-label="Boas-vindas ao Doonly">
      {/* Botão pular (canto sup. direito) — não aparece na última */}
      {slideIdx < TOTAL_SLIDES - 1 && (
        <button className="ob-skip" onClick={skip} aria-label="Pular introdução">
          <X size={18} weight="bold" />
        </button>
      )}

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
        {slideIdx === 2 && <SlidePlaceholder title="Cadastre ingredientes em segundos" subtitle="Cadastre ingredientes rapidamente sem perder tempo." emoji="🥚" />}
        {slideIdx === 3 && <SlidePlaceholder title="Nunca esqueça uma cliente" subtitle="Cadastre clientes e envie promoções na época do aniversário." emoji="🎂" />}
        {slideIdx === 4 && <SlidePlaceholder title="Descubra o preço certo" subtitle="O Doonly calcula tudo — custo, lucro e margem ideal." emoji="💰" />}
        {slideIdx === 5 && <SlidePlaceholder title="Sua receita já calcula tudo" subtitle="Ingredientes, embalagem, energia, lucro. Tudo preenchendo sozinho." emoji="📝" />}
        {slideIdx === 6 && <SlidePlaceholder title="Seu negócio organizado" subtitle="Enquanto você faz bolos, o Doonly cuida da gestão." emoji="📊" />}
        {slideIdx === 7 && <SlideFinal onStart={finish} />}
      </div>

      {/* Navegação inferior — esconde os botões na última (CTA está na slide) */}
      {slideIdx < TOTAL_SLIDES - 1 && (
        <div className="ob-nav">
          <button
            className="ob-nav-btn ob-nav-btn--back"
            onClick={prev}
            disabled={slideIdx === 0}
            aria-label="Voltar"
          >
            <CaretLeft size={18} weight="bold" />
          </button>
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
        .ob-skip {
          position: absolute;
          top: calc(1rem + env(safe-area-inset-top, 0px));
          right: 1rem;
          width: 36px; height: 36px;
          border-radius: 999px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.8);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(8px);
          transition: background 0.2s, color 0.2s;
          z-index: 2;
        }
        .ob-skip:hover, .ob-skip:active {
          background: rgba(255,255,255,0.2);
          color: #fff;
        }

        /* ── Dots de progresso ── */
        .ob-dots {
          display: flex;
          justify-content: center;
          gap: 6px;
          padding: 1.25rem 0 0.5rem;
          margin-top: env(safe-area-inset-top, 0px);
        }
        .ob-dot {
          width: 6px; height: 6px;
          border-radius: 999px;
          background: rgba(255,255,255,0.25);
          transition: all 0.3s ease;
        }
        .ob-dot--done {
          background: rgba(244, 208, 63, 0.6);
        }
        .ob-dot--active {
          width: 24px;
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
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: opacity 0.2s, transform 0.15s, background 0.2s;
        }
        .ob-nav-btn:active { transform: scale(0.97); }
        .ob-nav-btn--back {
          width: 48px; height: 48px;
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.85);
          border: 1px solid rgba(255,255,255,0.15);
          flex-shrink: 0;
        }
        .ob-nav-btn--back:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .ob-nav-btn--next {
          flex: 1;
          height: 48px;
          padding: 0 1.5rem;
          background: #F4D03F;
          color: #2a1019;
        }
        .ob-nav-btn--next:hover { background: #f8dc6c; }

        /* ── Slides: títulos e textos comuns ── */
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

        /* ── Slide 1 (boas-vindas) — visual especial ── */
        .ob-welcome-logo {
          font-size: 4rem;
          margin-bottom: 1.5rem;
          filter: drop-shadow(0 4px 16px rgba(244,208,63,0.3));
          animation: obFloat 3s ease-in-out infinite;
        }
        @keyframes obFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        .ob-welcome-brand {
          font-size: 2.2rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin: 0 0 1rem;
          background: linear-gradient(135deg, #fff 0%, #F4D03F 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
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

        /* ── Slide 2: Pedidos cards animados ── */
        .ob-pedidos-stack {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          width: 100%;
          max-width: 360px;
          margin-top: 1.5rem;
          perspective: 800px;
        }
        .ob-pedido-card {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.9rem 1rem;
          background: #fff;
          color: #2a1019;
          border-radius: 14px;
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
        .ob-pedido-emoji {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #fff1f7, #ecc2d0);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.5rem;
          flex-shrink: 0;
        }
        .ob-pedido-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
          text-align: left;
        }
        .ob-pedido-badge {
          font-size: 0.62rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #15803d;
          background: #dcfce7;
          padding: 2px 8px;
          border-radius: 999px;
          align-self: flex-start;
          margin-bottom: 2px;
        }
        .ob-pedido-titulo {
          font-size: 0.95rem;
          font-weight: 700;
          color: #2a1019;
          line-height: 1.2;
        }
        .ob-pedido-detalhe {
          font-size: 0.75rem;
          color: #6E3548;
          line-height: 1.3;
        }
        .ob-pedido-valor {
          font-size: 1rem;
          font-weight: 800;
          color: #6E3548;
          flex-shrink: 0;
          letter-spacing: -0.01em;
        }
        @keyframes obFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Desktop: aumenta tipografia e centraliza melhor ── */
        @media (min-width: 768px) {
          .ob-content { padding: 2rem; }
          .ob-slide-title { font-size: 2.2rem; }
          .ob-slide-text { font-size: 1.1rem; }
          .ob-welcome-brand { font-size: 3rem; }
          .ob-welcome-logo { font-size: 5rem; }
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
      <div className="ob-welcome-logo">✨</div>
      <h1 className="ob-welcome-brand">Doonly</h1>
      <p className="ob-slide-text" style={{ fontSize: "1.05rem" }}>
        Em menos de 1 minuto você vai descobrir como milhares de confeiteiras organizam seus pedidos e calculam seus preços.
      </p>
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
   3 cards de pedido caem em sequência, com badge "Novo".
   Cada card animado com delay escalonado. */
const PEDIDOS_DEMO = [
  {
    id: 1,
    badge: "Novo",
    titulo: "Bolo Red Velvet",
    detalhe: "Entrega sábado",
    valor: "R$ 280",
    emoji: "🎂",
  },
  {
    id: 2,
    badge: "Novo",
    titulo: "Brigadeiro Gourmet",
    detalhe: "50 unidades",
    valor: "R$ 90",
    emoji: "🍫",
  },
  {
    id: 3,
    badge: "Novo",
    titulo: "Naked Cake",
    detalhe: "Sexta-feira",
    valor: "R$ 450",
    emoji: "🍰",
  },
];

function Slide2Pedidos() {
  return (
    <>
      <h2 className="ob-slide-title">Seus pedidos<br/>ficam organizados</h2>

      <div className="ob-pedidos-stack">
        {PEDIDOS_DEMO.map((p, idx) => (
          <div
            key={p.id}
            className="ob-pedido-card"
            style={{ animationDelay: `${0.4 + idx * 0.7}s` }}
          >
            <div className="ob-pedido-emoji">{p.emoji}</div>
            <div className="ob-pedido-info">
              <span className="ob-pedido-badge">{p.badge}</span>
              <span className="ob-pedido-titulo">{p.titulo}</span>
              <span className="ob-pedido-detalhe">{p.detalhe}</span>
            </div>
            <span className="ob-pedido-valor">{p.valor}</span>
          </div>
        ))}
      </div>

      <p className="ob-slide-text" style={{ marginTop: "1.5rem", animation: "obFadeUp 0.6s ease 2.6s both" }}>
        Todos os seus pedidos ficam organizados em um único lugar.
      </p>
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

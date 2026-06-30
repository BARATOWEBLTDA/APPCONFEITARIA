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
          <button className={`ob-nav-btn ob-nav-btn--next ${slideIdx === 0 ? "ob-nav-btn--awaiting" : ""}`} onClick={next}>
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

        /* ── Slide 1 (boas-vindas) — coroa cinematográfica + botão ── */
        .ob-welcome-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          position: relative;
        }

        /* Coroa "performática" — cai do topo, toca o botão e some */
        .ob-welcome-coroa-anim {
          width: 110px;
          height: auto;
          position: absolute;
          top: -40%;
          left: 50%;
          transform: translateX(-50%) translateY(-200px) rotate(-20deg) scale(0.4);
          opacity: 0;
          filter: drop-shadow(0 8px 24px rgba(244,208,63,0.55));
          animation: obCoroaJornada 3.2s cubic-bezier(0.34, 1.2, 0.64, 1) 0.3s forwards;
          pointer-events: none;
          z-index: 5;
        }
        @keyframes obCoroaJornada {
          /* Entrada: cai do topo com bounce */
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(-200px) rotate(-20deg) scale(0.4);
          }
          15% {
            opacity: 1;
            transform: translateX(-50%) translateY(8px) rotate(10deg) scale(1.05);
          }
          25% {
            opacity: 1;
            transform: translateX(-50%) translateY(-4px) rotate(-3deg) scale(0.98);
          }
          /* Pausa: coroa "pousa" acima do logo */
          30%, 45% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) rotate(0) scale(1);
          }
          /* Voo: coroa "voa" pra baixo em direção ao botão */
          60% {
            opacity: 1;
            transform: translateX(-50%) translateY(180px) rotate(15deg) scale(0.85);
          }
          /* Toque: coroa toca o botão */
          72% {
            opacity: 1;
            transform: translateX(-50%) translateY(280px) rotate(0deg) scale(0.7);
          }
          /* Some no toque */
          80%, 100% {
            opacity: 0;
            transform: translateX(-50%) translateY(290px) rotate(0deg) scale(0);
          }
        }

        /* Coroa "em repouso" — aparece quando a animada some, fica flutuando */
        .ob-welcome-coroa-rest {
          width: 110px;
          height: auto;
          margin-bottom: 1.5rem;
          opacity: 0;
          filter: drop-shadow(0 8px 24px rgba(244,208,63,0.45));
          animation:
            obCoroaAparece 0.5s ease 2.7s forwards,
            obCoroaFloat 4s ease-in-out 3.2s infinite;
        }
        @keyframes obCoroaAparece {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes obCoroaFloat {
          0%, 100% { transform: translateY(0) rotate(0); }
          50%      { transform: translateY(-8px) rotate(2deg); }
        }

        .ob-welcome-logo-img {
          width: 200px;
          max-width: 70vw;
          height: auto;
          margin-bottom: 1.25rem;
          opacity: 0;
          transform: translateY(15px);
          animation: obLogoFadeIn 0.7s ease 1s both;
          filter: drop-shadow(0 4px 16px rgba(0,0,0,0.3));
        }
        @keyframes obLogoFadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ob-welcome-text {
          font-size: 1.05rem;
          line-height: 1.55;
          color: rgba(255,255,255,0.88);
          margin: 0;
          max-width: 30ch;
          opacity: 0;
          animation: obFadeUp 0.7s ease 1.5s both;
        }

        /* ── Botão "Começar" — desativado até a coroa tocar ── */
        .ob-nav-btn--awaiting {
          opacity: 0.3;
          background: rgba(244, 208, 63, 0.35) !important;
          color: rgba(42, 16, 25, 0.5) !important;
          pointer-events: none;
          animation: obBtnAtiva 0.6s cubic-bezier(0.34, 1.6, 0.64, 1) 3s forwards;
        }
        @keyframes obBtnAtiva {
          0% {
            opacity: 0.3;
            background: rgba(244, 208, 63, 0.35);
            color: rgba(42, 16, 25, 0.5);
            transform: scale(1);
            box-shadow: 0 0 0 rgba(244, 208, 63, 0);
          }
          50% {
            opacity: 1;
            background: #fff5b8;
            color: #2a1019;
            transform: scale(1.08);
            box-shadow: 0 0 40px rgba(244, 208, 63, 0.9), 0 0 80px rgba(244, 208, 63, 0.5);
          }
          100% {
            opacity: 1;
            background: #F4D03F;
            color: #2a1019;
            transform: scale(1);
            box-shadow: 0 0 20px rgba(244, 208, 63, 0.4);
            pointer-events: auto;
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

        /* ── Desktop: aumenta tipografia e centraliza melhor ── */
        @media (min-width: 768px) {
          .ob-content { padding: 2rem; }
          .ob-slide-title { font-size: 2.2rem; }
          .ob-slide-text { font-size: 1.1rem; }
          .ob-welcome-coroa-anim { width: 150px; }
          .ob-welcome-coroa-rest { width: 150px; }
          .ob-welcome-logo-img { width: 260px; }
          .ob-welcome-text { font-size: 1.2rem; max-width: 36ch; }
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
    <div className="ob-welcome-wrap">
      {/* Coroa principal (a que cai e ativa o botão) */}
      <img
        src="/tuturial/coroa.png"
        alt=""
        className="ob-welcome-coroa-anim"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />

      {/* Coroa final (a que fica flutuando no topo depois) */}
      <img
        src="/tuturial/coroa.png"
        alt=""
        className="ob-welcome-coroa-rest"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />

      <img
        src="/tuturial/logotutorial.png"
        alt="Doonly"
        className="ob-welcome-logo-img"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <p className="ob-welcome-text">
        Organize seus pedidos, calcule seus preços e acompanhe sua confeitaria com facilidade.
      </p>
    </div>
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
    statusLabel: "Novo",
    statusColor: "#15803d",
    statusBg: "#dcfce7",
    statusDot: "#15803d",
    cliente: "Ana Carolina",
    datetime: "Hoje · 14:32",
    produto: "Bolo Dois Amores",
    qtd: "1 unidade · 2kg",
    valor: "R$ 119,00",
    imagem: "/tuturial/bolo.jpg",
    emoji: "🎂",
    pagamento: "PIX",
    pagamentoStatus: "Pago",
    pagamentoColor: "#16a34a",
    pagamentoBg: "#dcfce7",
    entregaIcon: "🛵",
    entregaLabel: "Entrega",
    dataLabel: "Sábado",
  },
  {
    id: 2,
    numero: "128",
    statusLabel: "Confirmado",
    statusColor: "#1d4ed8",
    statusBg: "#dbeafe",
    statusDot: "#1d4ed8",
    cliente: "Mariana Lima",
    datetime: "Hoje · 16:48",
    produto: "Cento de Salgados",
    qtd: "100 unidades · misto",
    valor: "R$ 70,00",
    imagem: "/tuturial/salgadinhos.jpg",
    emoji: "🥟",
    pagamento: "Dinheiro",
    pagamentoStatus: "Pendente",
    pagamentoColor: "#dc2626",
    pagamentoBg: "#fee2e2",
    entregaIcon: "🛵",
    entregaLabel: "Entrega",
    dataLabel: "Sexta",
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
            className="ob-ped-card"
            style={{ animationDelay: `${0.4 + idx * 0.7}s` }}
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
                <span className="ob-mob-card-info-label">Pgto:</span>
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
      </div>

      <p className="ob-slide-text" style={{ marginTop: "1.5rem", animation: "obFadeUp 0.6s ease 1.9s both" }}>
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

import { useEffect, useRef } from "react";

export function SplashScreen({ onDone: _onDone }: { onDone?: () => void }) {
  const bgRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    // Remove a splash HTML inline assim que o React assumir
    const el = document.getElementById("html-splash");
    if (el) el.remove();

    const animate = () => {
      timeRef.current += 0.0025;
      const t = timeRef.current;
      const angle = 135 + 25 * Math.sin(t);
      if (bgRef.current) {
        // Gradient 100% rosa — do rosa claro pigmentado ao rosa escuro
        bgRef.current.style.background = `linear-gradient(${angle}deg, #FF9AC1 0%, #E85A8C 50%, #A8235A 100%)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="splash-root">
      <div ref={bgRef} className="splash-bg" />

      {/* Camadas decorativas */}
      <div className="splash-orb splash-orb--1" />
      <div className="splash-orb splash-orb--2" />
      <div className="splash-orb splash-orb--3" />
      <div className="splash-noise" />
      <div className="splash-vignette" />
      <div className="splash-glow" />

      <div className="splash-content">
        <img src="/logoapp.png" alt="Doonly" className="splash-logo" />
        <div className="splash-loader">
          <span className="splash-dot" style={{ animationDelay: "0s" }} />
          <span className="splash-dot" style={{ animationDelay: "0.15s" }} />
          <span className="splash-dot" style={{ animationDelay: "0.3s" }} />
        </div>
      </div>

      <p className="splash-tag">Gestão para Confeitarias</p>

      <style>{`
        .splash-root {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }

        /* ── Fundo gradient rosa ── */
        .splash-bg {
          position: absolute; inset: 0;
          background: linear-gradient(135deg, #FF9AC1 0%, #E85A8C 50%, #A8235A 100%);
        }

        /* ── Ruído sutil (tira sensação de "flat digital") ── */
        .splash-noise {
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.4'/></svg>");
          opacity: 0.08;
          mix-blend-mode: overlay;
          pointer-events: none;
        }

        /* ── Vignette (escurece as bordas) ── */
        .splash-vignette {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at center, transparent 40%, rgba(75, 20, 45, 0.35) 100%);
          pointer-events: none;
        }

        /* ── Orbs decorativos (bolhas coloridas flutuando) ── */
        .splash-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(40px);
          -webkit-filter: blur(40px);
          opacity: 0.55;
          pointer-events: none;
          will-change: transform;
          transform: translate3d(0, 0, 0);
          -webkit-transform: translate3d(0, 0, 0);
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .splash-orb--1 {
          width: 340px; height: 340px;
          background: radial-gradient(circle, #FFCBDD 0%, transparent 70%);
          top: -80px; left: -80px;
          animation: splashOrbFloat1 14s ease-in-out infinite;
        }
        .splash-orb--2 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, #FFD1E1 0%, transparent 70%);
          bottom: -90px; right: -70px;
          animation: splashOrbFloat2 16s ease-in-out infinite;
        }
        .splash-orb--3 {
          width: 220px; height: 220px;
          background: radial-gradient(circle, #FDB3CC 0%, transparent 65%);
          top: 40%; right: 15%;
          opacity: 0.35;
          animation: splashOrbFloat3 18s ease-in-out infinite;
        }
        @keyframes splashOrbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(60px, 40px) scale(1.12); }
        }
        @keyframes splashOrbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-50px, -35px) scale(1.08); }
        }
        @keyframes splashOrbFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.35; }
          50% { transform: translate(-40px, 30px) scale(1.15); opacity: 0.5; }
        }

        /* ── Glow central ── */
        .splash-glow {
          position: absolute;
          width: 380px; height: 380px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.08) 45%, rgba(255, 255, 255, 0) 70%);
          animation: splashGlowPulse 2.4s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes splashGlowPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }

        /* ── Container do logo ── */
        .splash-content {
          position: relative;
          z-index: 2;
          display: flex; flex-direction: column; align-items: center; gap: 32px;
          animation: splashContentIn 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes splashContentIn {
          from { opacity: 0; transform: translateY(20px) scale(0.92); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Logo ── */
        .splash-logo {
          width: clamp(120px, 26vw, 170px);
          height: auto;
          object-fit: contain;
          filter: drop-shadow(0 12px 32px rgba(60, 15, 40, 0.35)) drop-shadow(0 0 20px rgba(255, 220, 235, 0.4));
          -webkit-filter: drop-shadow(0 12px 32px rgba(60, 15, 40, 0.35)) drop-shadow(0 0 20px rgba(255, 220, 235, 0.4));
          animation: splashLogoPulse 1.8s ease-in-out infinite;
          will-change: transform;
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
        }
        @keyframes splashLogoPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }

        /* ── Loader (3 pontinhos) ── */
        .splash-loader {
          display: flex;
          gap: 8px;
          justify-content: center;
        }
        .splash-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.85);
          animation: splashDotBounce 1.1s ease-in-out infinite;
        }
        @keyframes splashDotBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }

        /* ── Tagline ── */
        .splash-tag {
          position: absolute;
          bottom: calc(2.8rem + env(safe-area-inset-bottom, 0px));
          font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: clamp(10px, 2.6vw, 12px);
          font-weight: 500;
          color: rgba(255, 255, 255, 0.82);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
          z-index: 2;
          animation: splashTagIn 1.2s ease 0.4s both;
          -webkit-tap-highlight-color: transparent;
        }
        @keyframes splashTagIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Ajustes tablet (portrait/landscape médio) ── */
        @media (min-width: 640px) and (max-width: 1023px) {
          .splash-orb--1 { width: 400px; height: 400px; }
          .splash-orb--2 { width: 360px; height: 360px; }
          .splash-orb--3 { width: 260px; height: 260px; }
          .splash-glow { width: 440px; height: 440px; }
          .splash-content { gap: 36px; }
          .splash-logo { width: clamp(150px, 22vw, 190px); }
          .splash-tag { font-size: 12px; bottom: 3.2rem; }
        }

        /* ── Ajustes desktop (telas grandes ≥1024px) ── */
        @media (min-width: 1024px) {
          .splash-orb--1 { width: 480px; height: 480px; }
          .splash-orb--2 { width: 420px; height: 420px; }
          .splash-orb--3 { width: 300px; height: 300px; }
          .splash-glow { width: 520px; height: 520px; }
          .splash-content { gap: 40px; }
          .splash-logo { width: clamp(170px, 12vw, 210px); }
          .splash-tag { font-size: 13px; bottom: 3.5rem; }
        }

        /* ── Landscape em telas curtas (celular deitado) ── */
        @media (max-height: 500px) and (orientation: landscape) {
          .splash-content { gap: 20px; }
          .splash-logo { width: 90px; }
          .splash-tag { bottom: 1rem; font-size: 10px; }
          .splash-orb--1, .splash-orb--2, .splash-orb--3 { transform: scale(0.6); }
        }

        /* ── Respeitar preferência de menos animação ── */
        @media (prefers-reduced-motion: reduce) {
          .splash-orb,
          .splash-logo,
          .splash-glow,
          .splash-dot,
          .splash-content,
          .splash-tag {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

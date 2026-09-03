import { useEffect, useRef } from "react";

export function SplashScreen({ onDone }: { onDone?: () => void }) {
  const bgRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    // Remove a splash HTML inline assim que o React assumir
    const el = document.getElementById("html-splash");
    if (el) el.remove();

    const animate = () => {
      timeRef.current += 0.003;
      const t = timeRef.current;
      const angle = 120 + 20 * Math.sin(t);
      if (bgRef.current) {
        bgRef.current.style.background = `linear-gradient(${angle}deg, var(--primary) 0%, var(--primary-dark) 50%, var(--text-muted) 100%)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="splash-root">
      <div ref={bgRef} className="splash-bg" />
      <div className="splash-glow" />
      <img src="/logoapp.png" alt="Doonly" className="splash-logo" />
      <p className="splash-tag">Gestão para Confeitarias</p>

      <style>{`
        .splash-root {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }
        .splash-bg {
          position: absolute; inset: 0;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 50%, var(--text-muted) 100%);
        }
        .splash-glow {
          position: absolute;
          width: 320px; height: 320px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0) 70%);
          animation: splashGlowPulse 2.2s ease-in-out infinite;
        }
        .splash-logo {
          position: relative;
          width: 150px; object-fit: contain;
          filter: drop-shadow(0 8px 24px rgba(0,0,0,0.25));
          animation: splashLogoPulse 1.6s ease-in-out infinite;
        }
        @keyframes splashLogoPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes splashGlowPulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.12); }
        }
        .splash-tag {
          position: absolute; bottom: 2.5rem;
          font-family: 'Geist', sans-serif;
          font-size: var(--font-helper); font-weight: var(--fw-medium);
          color: rgba(255,255,255,0.75);
          letter-spacing: 0.1em; text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}

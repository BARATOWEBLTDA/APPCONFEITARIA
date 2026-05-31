export function SplashScreen() {
  return (
    <div className="splash-root">
      <div className="splash-content">
        <img src="/logoapp.png" alt="Doonly" className="splash-logo" />
        <div className="splash-dots">
          <span />
          <span />
          <span />
        </div>
      </div>

      <p className="splash-tag">Gestão para Confeitarias</p>

      <style>{`
        .splash-root {
          position: fixed; inset: 0; z-index: 9999;
          background: linear-gradient(135deg, #f9007a 0%, #ff6eb4 60%, #ffb3d9 100%);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          animation: splashFade 0.4s ease forwards;
          animation-delay: 2s;
        }
        @keyframes splashFade {
          to { opacity: 0; pointer-events: none; }
        }

        .splash-content {
          display: flex; flex-direction: column;
          align-items: center; gap: 2rem;
        }

        .splash-logo {
          width: 200px; object-fit: contain;
          animation: splashPop 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes splashPop {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }

        .splash-dots {
          display: flex; gap: 0.5rem;
        }
        .splash-dots span {
          width: 8px; height: 8px; border-radius: 50%;
          background: rgba(255,255,255,0.8);
          animation: dotPulse 1.2s ease-in-out infinite;
        }
        .splash-dots span:nth-child(2) { animation-delay: 0.2s; }
        .splash-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }

        .splash-tag {
          position: absolute; bottom: 2rem;
          font-family: 'Inter', sans-serif;
          font-size: 0.82rem; font-weight: 500;
          color: rgba(255,255,255,0.7);
          letter-spacing: 0.08em;
        }
      `}</style>
    </div>
  );
}

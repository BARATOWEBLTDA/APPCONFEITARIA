export function SplashScreen({ onDone }: { onDone?: () => void }) {
  return (
    <div className="splash-root">
      <div className="splash-content">
        <img src="/logoapp.png" alt="Doonly" className="splash-logo" />
        <div className="splash-dots">
          <span /><span /><span />
        </div>
      </div>
      <p className="splash-tag">Gestão para Confeitarias</p>

      <style>{`
        .splash-root {
          position: fixed; inset: 0; z-index: 9999;
          background: linear-gradient(135deg, #f9007a 0%, #ff6eb4 60%, #ffb3d9 100%);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
        }
        .splash-content {
          display: flex; flex-direction: column;
          align-items: center; gap: 2.5rem;
        }
        .splash-logo {
          width: 220px; object-fit: contain;
          animation: splashPop 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes splashPop {
          from { opacity: 0; transform: scale(0.75); }
          to { opacity: 1; transform: scale(1); }
        }
        .splash-dots { display: flex; gap: 0.6rem; }
        .splash-dots span {
          width: 10px; height: 10px; border-radius: 50%;
          background: rgba(255,255,255,0.9);
          animation: dotPulse 1.2s ease-in-out infinite;
        }
        .splash-dots span:nth-child(2) { animation-delay: 0.2s; }
        .splash-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
        .splash-tag {
          position: absolute; bottom: 2.5rem;
          font-family: 'Inter', sans-serif;
          font-size: 0.82rem; font-weight: 500;
          color: rgba(255,255,255,0.75);
          letter-spacing: 0.1em; text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}

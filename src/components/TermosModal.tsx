/**
 * TermosModal — modal centralizado com abas Termos / Privacidade.
 *
 * Padrão visual do app (rosa Doonly), backdrop escuro com blur,
 * bloqueio de scroll do body iOS-safe, ESC fecha.
 *
 * O conteúdo dos termos/privacidade vem dos componentes de página
 * (Termos.tsx e Privacidade.tsx). Se um dia editar aqueles arquivos,
 * o modal reflete automaticamente.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import Termos from "@/pages/Termos";
import Privacidade from "@/pages/Privacidade";

interface Props {
  open: boolean;
  onClose: () => void;
  initialTab?: "termos" | "privacidade";
}

export default function TermosModal({ open, onClose, initialTab = "termos" }: Props) {
  const [tab, setTab] = useState<"termos" | "privacidade">(initialTab);

  // Reset da aba quando abre
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  // Bloqueia scroll do body (iOS-safe)
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const bodyStyle = document.body.style;
    const prev = {
      overflow: bodyStyle.overflow,
      position: bodyStyle.position,
      top: bodyStyle.top,
      width: bodyStyle.width,
    };
    bodyStyle.overflow = "hidden";
    bodyStyle.position = "fixed";
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.width = "100%";
    return () => {
      bodyStyle.overflow = prev.overflow;
      bodyStyle.position = prev.position;
      bodyStyle.top = prev.top;
      bodyStyle.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  // ESC pra fechar
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="trm-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="trm-card" role="dialog" aria-modal="true" aria-labelledby="trm-title">
        {/* Header rosa */}
        <div className="trm-header">
          <h2 id="trm-title" className="trm-title">Termos e privacidade</h2>
          <button className="trm-close" onClick={onClose} aria-label="Fechar"><X size={20} weight="bold" /></button>
        </div>

        {/* Tabs */}
        <div className="trm-tabs">
          <button
            className={`trm-tab ${tab === "termos" ? "trm-tab--active" : ""}`}
            onClick={() => setTab("termos")}
          >
            Termos de Uso
          </button>
          <button
            className={`trm-tab ${tab === "privacidade" ? "trm-tab--active" : ""}`}
            onClick={() => setTab("privacidade")}
          >
            Privacidade
          </button>
        </div>

        {/* Corpo scrollable com conteúdo */}
        <div className="trm-body">
          <div className="trm-content">
            {tab === "termos" ? <Termos /> : <Privacidade />}
          </div>
        </div>

        {/* Footer com botão fechar */}
        <div className="trm-footer">
          <button className="trm-btn-close" onClick={onClose}>Fechar</button>
        </div>
      </div>

      <style>{`
        .trm-backdrop {
          position: fixed; inset: 0;
          background: rgba(20, 12, 18, 0.55);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          z-index: 100000;
          animation: trmFade 0.2s ease;
        }
        @keyframes trmFade { from { opacity: 0; } to { opacity: 1; } }

        .trm-card {
          position: fixed;
          left: 50%; top: 50%;
          transform: translate(-50%, -50%);
          background: #fff;
          border-radius: 20px;
          z-index: 100001;
          width: calc(100vw - 24px);
          max-width: 560px;
          max-height: calc(100vh - 40px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 30px 80px rgba(20, 12, 18, 0.4);
          animation: trmPop 0.25s cubic-bezier(0.34, 1.4, 0.64, 1);
          font-family: var(--font-base), -apple-system, sans-serif;
        }
        @keyframes trmPop {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.92); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }

        /* Header rosa Doonly */
        .trm-header {
          background: linear-gradient(135deg, #E85A8C 0%, #C33A6E 100%);
          color: #fff;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-shrink: 0;
        }
        .trm-title {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.015em;
          margin: 0;
        }
        .trm-close {
          all: unset;
          cursor: pointer;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.18);
          transition: background 0.15s ease;
          color: #fff;
        }
        .trm-close:hover { background: rgba(255, 255, 255, 0.28); }

        /* Tabs */
        .trm-tabs {
          display: flex;
          gap: 4px;
          padding: 12px 16px 0;
          border-bottom: 1px solid #F0EBED;
          flex-shrink: 0;
        }
        .trm-tab {
          all: unset;
          cursor: pointer;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 700;
          color: #888780;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: color 0.15s ease, border-color 0.15s ease;
        }
        .trm-tab:hover { color: #2C2C2A; }
        .trm-tab--active {
          color: #E85A8C;
          border-bottom-color: #E85A8C;
        }

        /* Body scrollable com conteúdo */
        .trm-body {
          flex: 1;
          overflow-y: auto;
          overscroll-behavior: contain;
          background: #FAF8F5;
        }
        .trm-content {
          padding: 4px 20px 20px;
        }
        /* Override do padding/margem interno dos componentes Termos/Privacidade
           pra caber bonito dentro do modal */
        .trm-content > div {
          padding: 20px 0 !important;
          margin: 0 !important;
          max-width: none !important;
        }
        .trm-content h1 {
          font-size: 1.35rem !important;
          font-weight: 800 !important;
          color: #2C2C2A !important;
          margin: 0 0 4px !important;
          letter-spacing: -0.01em;
        }
        .trm-content h2 {
          font-size: 1rem !important;
          font-weight: 700 !important;
          color: #2C2C2A !important;
          margin: 18px 0 6px !important;
          letter-spacing: -0.005em;
        }
        .trm-content h3 {
          font-size: 0.9rem !important;
          font-weight: 700 !important;
          color: #2C2C2A !important;
          margin: 14px 0 6px !important;
        }
        .trm-content p, .trm-content li {
          font-size: 13.5px !important;
          color: #5F5E5A !important;
          line-height: 1.6 !important;
          margin: 6px 0 !important;
        }
        .trm-content strong {
          color: #2C2C2A !important;
          font-weight: 700 !important;
        }
        .trm-content ul, .trm-content ol {
          padding-left: 20px !important;
          margin: 6px 0 !important;
        }
        .trm-content a {
          color: #E85A8C !important;
          text-decoration: underline;
        }

        /* Footer */
        .trm-footer {
          padding: 14px 20px;
          border-top: 1px solid #F0EBED;
          background: #fff;
          flex-shrink: 0;
        }
        .trm-btn-close {
          all: unset;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 13px;
          background: #E85A8C;
          color: #fff;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .trm-btn-close:hover { background: #C33A6E; }

        /* Mobile: modal quase full-height */
        @media (max-width: 600px) {
          .trm-card {
            width: calc(100vw - 16px);
            max-height: calc(100vh - 32px);
          }
        }
      `}</style>
    </>,
    document.body
  );
}

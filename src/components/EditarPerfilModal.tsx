/**
 * EditarPerfilModal — modal centralizado pra editar dados pessoais.
 *
 * Campos:
 *   - Foto (upload)
 *   - Nome
 *   - Telefone
 *   - E-mail (read-only)
 *   - Alterar senha (accordion embutido com reautenticação)
 *
 * Reusa handlers passados por props (do Configuracoes.tsx).
 * Padrão visual: rosa Doonly, fonte Geist, botões 3D, backdrop escuro com blur.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, PencilSimple } from "@phosphor-icons/react";

interface Props {
  open: boolean;
  onClose: () => void;
  // Dados
  nome: string;
  telefone: string;
  email: string;
  fotoPreview: string;
  inicial: string;
  // Handlers
  onNomeChange: (v: string) => void;
  onTelefoneChange: (v: string) => void;
  onFotoClick: () => void;
  onSave: () => Promise<void> | void;
  saving: boolean;
  uploading: boolean;
  // Alterar senha
  senhaAtual: string;
  novaSenha: string;
  confirmSenha: string;
  senhaMsg: string;
  savingSenha: boolean;
  onSenhaAtualChange: (v: string) => void;
  onNovaSenhaChange: (v: string) => void;
  onConfirmSenhaChange: (v: string) => void;
  onAlterarSenha: () => Promise<void> | void;
  // Feedback do salvar
  saveError?: string;
  saveSuccess?: boolean;
}

export default function EditarPerfilModal({
  open, onClose,
  nome, telefone, email, fotoPreview, inicial,
  onNomeChange, onTelefoneChange, onFotoClick, onSave, saving, uploading,
  senhaAtual, novaSenha, confirmSenha, senhaMsg, savingSenha,
  onSenhaAtualChange, onNovaSenhaChange, onConfirmSenhaChange, onAlterarSenha,
  saveError, saveSuccess,
}: Props) {
  const [showSenha, setShowSenha] = useState(false);

  // Reset ao fechar
  useEffect(() => {
    if (!open) setTimeout(() => setShowSenha(false), 200);
  }, [open]);

  // Bloqueia scroll body iOS-safe
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const bs = document.body.style;
    const prev = { overflow: bs.overflow, position: bs.position, top: bs.top, width: bs.width };
    bs.overflow = "hidden";
    bs.position = "fixed";
    bs.top = `-${scrollY}px`;
    bs.width = "100%";
    return () => {
      bs.overflow = prev.overflow; bs.position = prev.position; bs.top = prev.top; bs.width = prev.width;
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
      <div className="epm-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="epm-card" role="dialog" aria-modal="true" aria-labelledby="epm-title">
        <div className="epm-header">
          <h2 id="epm-title" className="epm-title">Editar perfil</h2>
          <button className="epm-close" onClick={onClose} aria-label="Fechar"><X size={20} weight="bold" /></button>
        </div>

        <div className="epm-body">
          {/* Foto */}
          <div className="epm-avatar-wrap">
            <div className="epm-avatar" onClick={() => !uploading && onFotoClick()}>
              <div className="epm-avatar-inner">
                {fotoPreview
                  ? <img src={fotoPreview} alt="Perfil" />
                  : <span className="epm-avatar-inicial">{inicial}</span>}
              </div>
              <div className="epm-avatar-cam">
                {uploading
                  ? <span className="epm-spin" />
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}
              </div>
            </div>
            <p className="epm-avatar-hint">Toque na foto pra trocar</p>
          </div>

          {/* Campos */}
          <div className="epm-fields">
            <div className="epm-field">
              <label className="epm-label">Nome</label>
              <input
                className="epm-input"
                type="text"
                placeholder="Seu nome"
                value={nome}
                onChange={e => onNomeChange(e.target.value)}
              />
            </div>

            <div className="epm-field">
              <label className="epm-label">WhatsApp</label>
              <input
                className="epm-input"
                type="tel"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={e => onTelefoneChange(e.target.value)}
              />
            </div>

            <div className="epm-field">
              <label className="epm-label">E-mail</label>
              <input
                className="epm-input epm-input--disabled"
                type="email"
                value={email}
                disabled
              />
              <p className="epm-hint">Para alterar seu e-mail, entre em contato com o suporte.</p>
            </div>

            {saveError && <div className="epm-msg epm-msg--error">{saveError}</div>}
            {saveSuccess && <div className="epm-msg epm-msg--success">✓ Alterações salvas!</div>}

            <button className="epm-btn-primary" onClick={onSave} disabled={saving || uploading}>
              {saving ? <span className="epm-spin epm-spin--btn" /> : "Salvar alterações"}
            </button>
          </div>

          {/* Divisor */}
          <div className="epm-divider" />

          {/* Alterar senha (accordion) */}
          <div className="epm-senha">
            <button
              className="epm-senha-toggle"
              onClick={() => setShowSenha(s => !s)}
              type="button"
            >
              <span className="epm-senha-toggle-l">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Alterar senha
              </span>
              <svg className={showSenha ? "epm-senha-chev open" : "epm-senha-chev"} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            {showSenha && (
              <div className="epm-senha-body">
                <div className="epm-field">
                  <label className="epm-label">Senha atual</label>
                  <input
                    className="epm-input"
                    type="password"
                    placeholder="Sua senha atual"
                    value={senhaAtual}
                    onChange={e => onSenhaAtualChange(e.target.value)}
                  />
                </div>
                <div className="epm-field">
                  <label className="epm-label">Nova senha</label>
                  <input
                    className="epm-input"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={novaSenha}
                    onChange={e => onNovaSenhaChange(e.target.value)}
                  />
                </div>
                <div className="epm-field">
                  <label className="epm-label">Confirmar nova senha</label>
                  <input
                    className="epm-input"
                    type="password"
                    placeholder="Repita a nova senha"
                    value={confirmSenha}
                    onChange={e => onConfirmSenhaChange(e.target.value)}
                  />
                </div>
                {senhaMsg && (
                  <div className={`epm-msg ${senhaMsg.includes("sucesso") ? "epm-msg--success" : "epm-msg--error"}`}>{senhaMsg}</div>
                )}
                <button className="epm-btn-primary" onClick={onAlterarSenha} disabled={savingSenha}>
                  {savingSenha ? <span className="epm-spin epm-spin--btn" /> : "Alterar senha"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .epm-backdrop {
          position: fixed; inset: 0;
          background: rgba(20, 12, 18, 0.55);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          z-index: 100000;
          animation: epmFade 0.2s ease;
        }
        @keyframes epmFade { from { opacity: 0; } to { opacity: 1; } }

        .epm-card {
          position: fixed;
          left: 50%; top: 50%;
          transform: translate(-50%, -50%);
          background: #fff;
          border-radius: 20px;
          z-index: 100001;
          width: calc(100vw - 24px);
          max-width: 480px;
          max-height: calc(100vh - 40px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 30px 80px rgba(20, 12, 18, 0.4);
          animation: epmPop 0.25s cubic-bezier(0.34, 1.4, 0.64, 1);
          font-family: var(--font-base) !important;
        }
        .epm-card * { font-family: var(--font-base) !important; }
        @keyframes epmPop {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.92); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }

        .epm-header {
          background: linear-gradient(135deg, #E85A8C 0%, #C33A6E 100%);
          color: #fff;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-shrink: 0;
        }
        .epm-title {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.015em;
          margin: 0;
        }
        .epm-close {
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
        .epm-close:hover { background: rgba(255, 255, 255, 0.28); }

        .epm-body {
          flex: 1;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 20px;
        }

        /* Avatar */
        .epm-avatar-wrap { text-align: center; margin-bottom: 20px; }
        .epm-avatar {
          width: 90px; height: 90px;
          border-radius: 50%;
          margin: 0 auto;
          cursor: pointer;
          position: relative;
        }
        .epm-avatar-inner {
          width: 100%; height: 100%;
          border-radius: 50%;
          background: #993556;
          border: 3px solid #FCE0E9;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }
        .epm-avatar-inner img { width: 100%; height: 100%; object-fit: cover; }
        .epm-avatar-inicial { color: #FCE0E9; font-size: 34px; font-weight: 900; letter-spacing: -0.02em; }
        .epm-avatar-cam {
          position: absolute; bottom: 0; right: 0;
          width: 30px; height: 30px;
          border-radius: 50%;
          background: #E85A8C;
          border: 3px solid #fff;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(232, 90, 140, 0.35);
        }
        .epm-avatar-hint { font-size: 12px; color: #888780; margin: 10px 0 0; }

        /* Campos */
        .epm-fields { display: flex; flex-direction: column; gap: 12px; }
        .epm-field { display: flex; flex-direction: column; gap: 5px; }
        .epm-label {
          font-size: 11px;
          font-weight: 700;
          color: #888780;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding-left: 2px;
        }
        .epm-input {
          box-sizing: border-box;
          width: 100%;
          padding: 12px 14px;
          background: #FAF8F5;
          border: 1.5px solid #E8E5DC;
          border-radius: 10px;
          font-size: 14px;
          color: #2C2C2A;
          outline: none;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .epm-input:focus { border-color: #E85A8C; background: #fff; }
        .epm-input::placeholder { color: #B4B2A9; }
        .epm-input--disabled { background: #F0EBED; color: #888780; cursor: not-allowed; }
        .epm-hint {
          font-size: 11px;
          color: #888780;
          margin: 4px 0 0;
          font-style: italic;
          padding-left: 2px;
        }

        /* Mensagens */
        .epm-msg {
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 12.5px;
          font-weight: 500;
          margin-top: 2px;
        }
        .epm-msg--error { background: #FEE2E2; color: #B91C1C; }
        .epm-msg--success { background: #DCFCE7; color: #166534; }

        /* Botão primário 3D */
        .epm-btn-primary {
          all: unset;
          box-sizing: border-box;
          display: flex; align-items: center; justify-content: center;
          gap: 6px;
          width: 100%;
          padding: 13px;
          background: #E85A8C;
          color: #fff;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.01em;
          cursor: pointer;
          margin-top: 6px;
          box-shadow: 0 4px 14px rgba(232, 90, 140, 0.28), inset 0 -2px 0 rgba(0,0,0,0.08);
          transition: transform 0.12s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .epm-btn-primary:hover:not(:disabled) { background: #C33A6E; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(232, 90, 140, 0.35), inset 0 -2px 0 rgba(0,0,0,0.08); }
        .epm-btn-primary:active:not(:disabled) { transform: translateY(1px); box-shadow: 0 2px 6px rgba(232, 90, 140, 0.25); }
        .epm-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; box-shadow: none; }

        /* Divisor */
        .epm-divider {
          height: 1px;
          background: #F0EBED;
          margin: 24px 0 12px;
        }

        /* Senha accordion */
        .epm-senha { display: flex; flex-direction: column; gap: 12px; }
        .epm-senha-toggle {
          all: unset;
          cursor: pointer;
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 4px;
          transition: color 0.15s ease;
        }
        .epm-senha-toggle:hover { color: #E85A8C; }
        .epm-senha-toggle-l {
          display: flex; align-items: center; gap: 10px;
          font-size: 14px;
          font-weight: 700;
          color: #2C2C2A;
        }
        .epm-senha-toggle-l svg { color: #5F5E5A; }
        .epm-senha-chev { color: #B4B2A9; transition: transform 0.2s ease; }
        .epm-senha-chev.open { transform: rotate(90deg); }
        .epm-senha-body { display: flex; flex-direction: column; gap: 12px; animation: epmSlide 0.2s ease; }
        @keyframes epmSlide { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

        /* Spinner */
        .epm-spin {
          display: inline-block;
          width: 12px; height: 12px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: epmSpin 0.7s linear infinite;
        }
        .epm-spin--btn { width: 16px; height: 16px; }
        @keyframes epmSpin { to { transform: rotate(360deg); } }
      `}</style>
    </>,
    document.body
  );
}

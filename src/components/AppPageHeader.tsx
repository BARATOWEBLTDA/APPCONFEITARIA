import { useState, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Camera, User } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'

interface AppPageHeaderProps {
  title: string
  subtitle: string
  infoTitle?: string
  infoIcon?: string
  infoContent: ReactNode
  infoTip?: ReactNode
}

export default function AppPageHeader({
  title,
  subtitle,
  infoTitle = 'Sobre esta tela',
  infoIcon = '📦',
  infoContent,
  infoTip,
}: AppPageHeaderProps) {
  const navigate = useNavigate()
  const [showInfo, setShowInfo] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmSair, setConfirmSair] = useState(false)
  const { profile } = useProfile()
  const { fileInputRef, uploading: uploadingFoto, handleFileSelected } = useAvatarUpload()

  return (
    <>
      {/* ══════════════ HEADER FIXO ══════════════ */}
      <div className="app-header-novo">
        <div className="app-header-info">
          <div className="app-header-title-row">
            <h1 className="app-header-title">{title}</h1>
            <button
              className="app-header-info-icon"
              onClick={() => setShowInfo(true)}
              aria-label="Sobre esta tela"
              type="button"
            >i</button>
          </div>
          <p className="app-header-sub">{subtitle}</p>
        </div>
        <div className="app-header-foto-wrap" data-has-photo={profile?.foto_url ? "true" : "false"}>
          <button
            className="app-header-foto-btn"
            onClick={() => {
              if (window.innerWidth < 768) {
                setMenuOpen(o => !o)
              } else if (!uploadingFoto) {
                fileInputRef.current?.click()
              }
            }}
            aria-label={window.innerWidth < 768 ? "Abrir menu" : (profile?.foto_url ? "Trocar foto" : "Adicionar foto")}
            disabled={uploadingFoto}
          >
            {profile?.foto_url
              ? <img src={profile.foto_url} alt="Perfil" className="app-header-foto-img" />
              : <div className="app-header-foto-placeholder"><User size={22} weight="bold" color="#E85A8C" /></div>
            }
          </button>
          {!profile?.foto_url && (
            <span className="app-header-foto-cam" aria-hidden="true">
              <Camera size={12} weight="fill" color="#fff" />
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelected}
            style={{ display: "none" }}
          />
        </div>
      </div>

      {/* MODAL: Sobre esta tela */}
      {showInfo && createPortal(
        <div className="app-info-overlay" onClick={() => setShowInfo(false)}>
          <div className="app-info-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <button className="app-info-close" onClick={() => setShowInfo(false)} aria-label="Fechar">✕</button>
            <div className="app-info-icon">{infoIcon}</div>
            <h3 className="app-info-title">{infoTitle}</h3>
            <div className="app-info-body">{infoContent}</div>
            {infoTip && (
              <div className="app-info-tip">
                <span className="app-info-tip-emoji">💡</span>
                <span>{infoTip}</span>
              </div>
            )}
            <button className="app-info-ok" onClick={() => setShowInfo(false)}>Entendi</button>
          </div>
        </div>,
        document.body
      )}

      {/* MENU PERFIL */}
      {menuOpen && createPortal(
        <>
          <div className="app-menu-overlay" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="app-menu-novo" role="dialog" aria-modal="true">
            <div className="app-menu-novo-hdr">
              <p className="app-menu-novo-hdr-name">Doonly Gestão Inteligente</p>
              <p className="app-menu-novo-hdr-ver">Versão 1.0.0</p>
            </div>
            <div className="app-menu-novo-body">
              <button className="app-menu-novo-item" onClick={() => { setMenuOpen(false); navigate("/notificacoes") }}>
                <span className="app-menu-novo-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span>
                <span>Notificações</span>
              </button>
              <button className="app-menu-novo-item" onClick={() => { setMenuOpen(false); alert("🚀 Em breve! Estamos preparando essa página.") }}>
                <span className="app-menu-novo-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span>
                <span>Solicitar recursos</span>
              </button>
              <button className="app-menu-novo-item" onClick={() => { setMenuOpen(false); navigate("/configuracoes") }}>
                <span className="app-menu-novo-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
                <span>Minha conta</span>
              </button>
              <button className="app-menu-novo-item" onClick={() => { setMenuOpen(false); navigate("/cardapio-config") }}>
                <span className="app-menu-novo-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
                <span>Minha loja</span>
              </button>
              <button className="app-menu-novo-item" onClick={() => { setMenuOpen(false); alert("🤖 Assistente virtual em breve!") }}>
                <span className="app-menu-novo-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="10" r="1.2" fill="currentColor"/><circle cx="15" cy="10" r="1.2" fill="currentColor"/><path d="M8 15c1 1.2 2.5 2 4 2s3-.8 4-2"/></svg></span>
                <span>Assistente virtual</span>
              </button>
              <button className="app-menu-novo-item" onClick={() => { setMenuOpen(false); alert("📝 Em breve você poderá relatar problemas por aqui!") }}>
                <span className="app-menu-novo-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></span>
                <span>Relatar um problema</span>
              </button>
              <button className="app-menu-novo-item app-menu-novo-sair" onClick={() => { setMenuOpen(false); setConfirmSair(true) }}>
                <span className="app-menu-novo-icon app-menu-novo-icon--sair"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span>
                <span>Sair</span>
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* MODAL confirmar sair */}
      {confirmSair && createPortal(
        <div className="app-sair-overlay" onClick={() => setConfirmSair(false)}>
          <div className="app-sair-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="app-sair-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <h3 className="app-sair-title">Sair do Doonly?</h3>
            <p className="app-sair-sub">Você precisará entrar novamente na próxima vez. Até já! 👋</p>
            <div className="app-sair-actions">
              <button className="app-sair-btn-cancel" onClick={() => setConfirmSair(false)}>Cancelar</button>
              <button className="app-sair-btn-ok" onClick={async () => { setConfirmSair(false); await supabase.auth.signOut(); navigate("/login") }}>Sim, sair</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        /* ═══ Header rosa fixo ═══ */
        .app-header-novo {
          position: sticky;
          top: 0;
          z-index: 100;
          background: #E85A8C;
          padding: calc(20px + env(safe-area-inset-top, 0px)) 20px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: #fff;
          font-family: var(--font-base) !important;
          /* Mobile: cancela padding do layout-main + escapa lateral */
          margin-top: calc(-1 * (var(--pad-page-top, 1.5rem) + env(safe-area-inset-top, 0px)));
          margin-left: calc(50% - 50vw);
          margin-right: calc(50% - 50vw);
          width: 100vw;
          box-sizing: border-box;
        }
        @media (min-width: 768px) {
          .app-header-novo {
            /* Desktop: cancela o padding do layout-main (2rem lados, 3rem topo) */
            margin-top: -3rem;
            margin-left: -2rem;
            margin-right: -2rem;
            width: auto;
            padding: 28px 2rem 22px;
          }
          .app-header-title { font-size: 24px; }
          .app-header-sub { font-size: 13.5px; }
        }
        @media (min-width: 1100px) {
          .app-header-novo {
            padding: 32px 3rem 26px;
          }
          .app-header-title { font-size: 28px; }
        }
        .app-header-info { flex: 1; min-width: 0; }
        .app-header-title-row { display: flex; align-items: center; gap: 8px; }
        .app-header-title { font-size: 22px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.15; color: #fff; margin: 0; font-family: var(--font-base) !important; }
        .app-header-info-icon {
          all: unset;
          width: 20px; height: 20px; border-radius: 50%;
          background: rgba(255,255,255,0.22); color: #fff;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 900; font-style: italic;
          cursor: pointer; border: 1.5px solid rgba(255,255,255,0.5);
          flex-shrink: 0; font-family: var(--font-base) !important;
          transition: background 0.15s;
        }
        .app-header-info-icon:hover { background: rgba(255,255,255,0.35); }
        .app-header-sub { font-size: 12.5px; color: rgba(255,255,255,0.85); line-height: 1.35; margin: 4px 0 0; font-family: var(--font-base) !important; }
        .app-header-foto-wrap { position: relative; flex-shrink: 0; }
        .app-header-foto-btn {
          all: unset;
          width: 48px; height: 48px;
          border-radius: 50%;
          background: #FCE0E9;
          overflow: hidden;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid rgba(255,255,255,0.4);
          box-shadow: 0 0 0 3px rgba(255,255,255,0.2);
          transition: transform 0.12s;
        }
        .app-header-foto-btn:hover { transform: scale(1.03); }
        .app-header-foto-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .app-header-foto-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
        .app-header-foto-cam {
          position: absolute; bottom: -1px; right: -1px;
          width: 20px; height: 20px; border-radius: 50%;
          background: #E85A8C; border: 2px solid #fff;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none;
        }
        .app-header-foto-wrap[data-has-photo="true"] .app-header-foto-cam { display: none; }
        @media (min-width: 768px) { .app-header-foto-cam { display: none; } }
        @media (min-width: 901px) { .app-header-foto-wrap { display: none; } }

        /* ═══ Modal info ═══ */
        .app-info-overlay {
          position: fixed; inset: 0;
          background: rgba(45, 31, 38, 0.55);
          backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; z-index: 10001;
          font-family: var(--font-base) !important;
          animation: appInfoIn 0.18s ease-out;
        }
        @keyframes appInfoIn { from { opacity: 0; } to { opacity: 1; } }
        .app-info-modal {
          background: #fff; border-radius: 16px;
          padding: 28px 24px 20px;
          max-width: 380px; width: 100%;
          text-align: center;
          box-shadow: 0 24px 60px rgba(0,0,0,0.35);
          position: relative;
          animation: appInfoModalIn 0.2s ease-out;
        }
        @keyframes appInfoModalIn {
          from { opacity: 0; transform: scale(0.94); }
          to { opacity: 1; transform: scale(1); }
        }
        .app-info-close {
          all: unset;
          position: absolute; top: 12px; right: 12px;
          width: 28px; height: 28px; border-radius: 50%;
          background: #F5F1F3; color: #6B5D64;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; font-size: 12px; font-weight: 900;
          transition: background 0.12s;
        }
        .app-info-close:hover { background: #EBE5E8; color: #2D1F26; }
        .app-info-icon { font-size: 42px; margin-bottom: 6px; line-height: 1; }
        .app-info-title { font-size: 20px; font-weight: 900; color: #2D1F26; margin: 0 0 12px; letter-spacing: -0.01em; font-family: var(--font-base) !important; }
        .app-info-body p, .app-info-body { font-size: 13.5px; color: #4A3540; line-height: 1.55; margin: 0 0 12px; text-align: left; font-family: var(--font-base) !important; }
        .app-info-body strong { color: #2D1F26; font-weight: 800; }
        .app-info-tip {
          display: flex; gap: 8px; align-items: flex-start;
          background: #FEF3C7; border-radius: 10px;
          padding: 12px 14px; text-align: left; margin: 4px 0 18px;
          font-size: 12.5px; color: #4A3540; line-height: 1.5;
          font-family: var(--font-base) !important;
        }
        .app-info-tip strong { color: #2D1F26; font-weight: 800; }
        .app-info-tip-emoji { font-size: 14px; flex-shrink: 0; }
        .app-info-ok {
          all: unset; display: block; width: 100%;
          padding: 12px;
          background: #E85A8C; color: #fff; border-radius: 10px;
          font-size: 13.5px; font-weight: 800; letter-spacing: 0.01em;
          cursor: pointer;
          box-shadow: 0 3px 0 #C33A6E;
          text-align: center; box-sizing: border-box;
          transition: filter 0.12s, transform 0.08s;
          font-family: var(--font-base) !important;
        }
        .app-info-ok:hover { filter: brightness(1.05); }
        .app-info-ok:active { transform: translateY(3px); box-shadow: 0 0 0 #C33A6E; }

        /* ═══ Menu perfil ═══ */
        .app-menu-novo {
          position: fixed;
          top: calc(96px + env(safe-area-inset-top, 0px));
          right: 12px;
          background: #fff; border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 12px 40px rgba(0,0,0,0.28);
          max-width: 260px; width: calc(100vw - 32px);
          z-index: 10000;
          font-family: var(--font-base) !important;
          animation: appMenuIn 0.16s ease-out;
          transform-origin: top right;
        }
        @keyframes appMenuIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (min-width: 768px) { .app-menu-novo { top: 96px; right: 24px; } }
        .app-menu-novo-hdr { background: #F5F1F3; padding: 12px 16px 10px; }
        .app-menu-novo-hdr-name { font-size: 13px; font-weight: 900; color: #2D1F26; letter-spacing: -0.01em; line-height: 1.2; margin: 0; font-family: var(--font-base) !important; }
        .app-menu-novo-hdr-ver { font-size: 10.5px; color: #9A8B93; font-weight: 500; margin: 2px 0 0; letter-spacing: 0.03em; font-family: var(--font-base) !important; }
        .app-menu-novo-body { padding: 4px 0; background: #fff; }
        .app-menu-novo-body .app-menu-novo-item {
          all: unset;
          display: flex; align-items: center; gap: 10px;
          padding: 8px 16px; cursor: pointer;
          font-size: 13.5px; color: #2D1F26; font-weight: 600;
          width: 100%; box-sizing: border-box;
          transition: background 0.12s;
          font-family: var(--font-base) !important;
          border: 0 !important; outline: 0 !important; box-shadow: none !important;
          background: transparent;
        }
        .app-menu-novo-body .app-menu-novo-item:hover,
        .app-menu-novo-body .app-menu-novo-item:focus-visible {
          background: #FDFAFB; outline: 0 !important;
        }
        .app-menu-novo-icon {
          width: 26px; height: 26px; border-radius: 7px;
          background: #F5EEF0;
          display: flex; align-items: center; justify-content: center;
          color: #E85A8C; flex-shrink: 0;
        }
        .app-menu-novo-body .app-menu-novo-sair {
          color: #DC2626 !important;
          font-weight: 700 !important;
          border-top: 1px solid #F0EBED !important;
          margin-top: 4px !important;
          padding-top: 10px !important;
        }
        .app-menu-novo-body .app-menu-novo-sair:hover { background: #FEF2F2 !important; }
        .app-menu-novo-icon--sair { background: #FEE2E2 !important; color: #DC2626 !important; }
        .app-menu-overlay {
          position: fixed; inset: 0;
          background: rgba(45, 31, 38, 0.15);
          z-index: 9999;
          animation: appInfoIn 0.16s ease-out;
        }

        /* ═══ Sair modal ═══ */
        .app-sair-overlay {
          position: fixed; inset: 0;
          background: rgba(45, 31, 38, 0.55);
          backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; z-index: 10002;
          animation: appInfoIn 0.18s ease-out;
          font-family: var(--font-base) !important;
        }
        .app-sair-modal {
          background: #fff; border-radius: 16px;
          padding: 28px 24px 20px;
          max-width: 340px; width: 100%;
          text-align: center;
          box-shadow: 0 24px 60px rgba(0,0,0,0.35);
          animation: appInfoModalIn 0.2s ease-out;
        }
        .app-sair-icon {
          width: 64px; height: 64px; border-radius: 50%;
          background: #FEE2E2; color: #DC2626;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 14px;
        }
        .app-sair-title { font-size: 18px; font-weight: 900; color: #2D1F26; margin: 0 0 6px; letter-spacing: -0.01em; font-family: var(--font-base) !important; }
        .app-sair-sub { font-size: 13px; color: #6B5D64; line-height: 1.5; margin: 0 0 20px; font-family: var(--font-base) !important; }
        .app-sair-actions { display: flex; gap: 8px; }
        .app-sair-btn-cancel, .app-sair-btn-ok {
          all: unset;
          flex: 1; padding: 12px; border-radius: 10px;
          font-size: 13.5px; font-weight: 800; letter-spacing: 0.01em;
          cursor: pointer; text-align: center;
          box-sizing: border-box;
          font-family: var(--font-base) !important;
          transition: filter 0.12s, transform 0.08s;
        }
        .app-sair-btn-cancel { background: #F5F1F3; color: #6B5D64; }
        .app-sair-btn-cancel:hover { background: #EBE5E8; }
        .app-sair-btn-ok {
          background: #DC2626; color: #fff;
          box-shadow: 0 3px 0 #991B1B;
        }
        .app-sair-btn-ok:hover { filter: brightness(1.05); }
        .app-sair-btn-ok:active { transform: translateY(3px); box-shadow: 0 0 0 #991B1B; }
      `}</style>
    </>
  )
}

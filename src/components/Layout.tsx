import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
// deploy: Proposta D - nova arquitetura de navegação (Entrega 1)
import DooIA from "@/components/DooIA";
import MaisDrawer from "@/components/MaisDrawer";
import { useState, useEffect, type ReactNode } from "react";
import {
  House, CalendarDots, ShoppingBag, ClipboardText, Users, BookOpen,
  Package, CurrencyDollar, Gear, CaretDown, ForkKnife, List,
  User, SquaresFour, Camera, Cake,
} from "@phosphor-icons/react";
import { useProfile } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { useNotifications } from "@/context/NotificationContext";
import { supabase } from "@/lib/supabase";

function SidebarGroup({ label, icon, paths, location, children }: { label: string; icon?: ReactNode; paths: string[]; location: any; children: ReactNode }) {
  const isAnyActive = paths.some(p => location.pathname.startsWith(p));
  const [open, setOpen] = useState(isAnyActive);
  return (
    <div className="nav-group">
      <button className={`nav-group-btn ${isAnyActive ? "active" : ""}`} onClick={() => setOpen(o => !o)}>
        {icon && <span className="nav-icon">{icon}</span>}
        <span style={{ flex: 1 }}>{label}</span>
        <CaretDown size={13} style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", opacity: 0.5 }} />
      </button>
      {open && <div className="nav-subitems">{children}</div>}
    </div>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { isPro } = usePlano();
  const { notifCount, notifOpen, notificacoes, notifRef, toggleNotif, closeNotif } = useNotifications();
  const {
    fileInputRef, uploading: uploadingFoto, cropSrc,
    openPicker: abrirSeletorFoto,
    handleFileSelected, handleCropDone, cancelCrop,
  } = useAvatarUpload();
  const [maisOpen, setMaisOpen] = useState(false);
  const [dooOpen, setDooOpen] = useState(false);
  const location = useLocation();
  const isReceitas = location.pathname === "/receitas";
  const isAssinar = location.pathname === "/assinar";
  const isPrevia = location.pathname === "/cardapio-preview";

  // Bloqueia scroll do body/html quando o dropdown de notificações está aberto.
  // No iOS Safari, só body.overflow=hidden não segura — precisa travar html também
  // e preservar a posição de scroll (senão a página "salta" pro topo).
  useEffect(() => {
    if (notifOpen) {
      const scrollY = window.scrollY;
      const prevBodyOverflow = document.body.style.overflow;
      const prevBodyPosition = document.body.style.position;
      const prevBodyTop = document.body.style.top;
      const prevBodyWidth = document.body.style.width;
      const prevHtmlOverflow = document.documentElement.style.overflow;

      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.documentElement.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.body.style.position = prevBodyPosition;
        document.body.style.top = prevBodyTop;
        document.body.style.width = prevBodyWidth;
        document.documentElement.style.overflow = prevHtmlOverflow;
        window.scrollTo(0, scrollY);
      };
    }
  }, [notifOpen]);

  // Scroll pro topo ao mudar de rota (fix: antes ficava na posição anterior)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <div className="layout-root">
      {/* ── Sidebar Desktop ── */}
      <aside className="sidebar">
        <div className="sidebar-profile">
          <div className="sidebar-avatar-container">
          <button
            type="button"
            className="sidebar-avatar-btn"
            onClick={abrirSeletorFoto}
            disabled={uploadingFoto}
            aria-label={profile?.foto_url ? "Trocar foto de perfil" : "Adicionar foto de perfil"}
          >
            <div className="sidebar-avatar-ring">
              <div className="sidebar-avatar">
                {profile?.foto_url
                  ? <img src={profile.foto_url} alt="Foto de perfil" />
                  : <div className="sidebar-avatar-placeholder"><User size={36} weight="duotone" color="var(--primary)" /></div>
                }
              </div>
            </div>
            {!profile?.foto_url && (
              <span className="sidebar-avatar-cam" aria-hidden="true">
                <Camera size={14} weight="fill" />
              </span>
            )}
          </button>
          {isPro ? (
            <div className="sidebar-badge sidebar-badge--pro">
              <img src="/coroa.png" alt="" className="sidebar-badge-coroa" />
              PRO
            </div>
          ) : (
            <button
              type="button"
              className="sidebar-badge sidebar-badge--upgrade"
              onClick={() => navigate("/assinar")}
              aria-label="Fazer upgrade para PRO"
            >
              <img src="/coroa.png" alt="" className="sidebar-badge-coroa" />
              Upgrade
            </button>
          )}
          </div>
          {/* Input file escondido — disparado pelo botão do avatar */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileSelected}
          />
        </div>

        <div className="sidebar-greeting">
          <p className="sidebar-greeting-name">
            {profile?.nome
              ? <>Olá, {profile.nome.split(" ")[0]}</>
              : <span className="sidebar-greeting-skel" aria-hidden="true" />}
          </p>
          <p className="sidebar-greeting-date">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }).replace(/^\w/, c => c.toUpperCase())}</p>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/inicio" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-icon"><House size={18} weight="duotone" /></span>Início
          </NavLink>

          <NavLink to="/produtos" end className={({ isActive }) => `nav-item ${(isActive || location.pathname === "/produtos") ? "active" : ""}`}>
            <span className="nav-icon"><Cake size={18} weight="duotone" /></span>Produtos
          </NavLink>
          {/* Sub-item Categorias — aparece quando está em produtos */}
          {(location.pathname === "/produtos" || location.pathname.startsWith("/produtos/categorias")) && (
            <NavLink to="/produtos/categorias" className={({ isActive }) => `nav-subitem ${isActive ? "active" : ""}`}>
              <span className="nav-subicon" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
              </span>
              Categorias
            </NavLink>
          )}

          <NavLink to="/cardapio-config" className={({ isActive }) => `nav-item ${(isActive || location.pathname.startsWith("/cardapio")) ? "active" : ""}`}>
            <span className="nav-icon"><ShoppingBag size={18} weight="duotone" /></span>Cardápio Digital
          </NavLink>

          <NavLink to="/pedidos" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-icon"><ClipboardText size={18} weight="duotone" /></span>Pedidos
          </NavLink>

          <NavLink to="/agenda" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-icon"><CalendarDots size={18} weight="duotone" /></span>Agenda
          </NavLink>

          <NavLink to="/clientes" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-icon"><Users size={18} weight="duotone" /></span>Clientes
          </NavLink>

          <NavLink to="/receitas" className={({ isActive }) => `nav-item ${(isActive || location.pathname.startsWith("/comunidade")) ? "active" : ""}`}>
            <span className="nav-icon"><BookOpen size={18} weight="duotone" /></span>Receitas
          </NavLink>

          <NavLink to="/insumos" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-icon"><Package size={18} weight="duotone" /></span>Ingredientes
          </NavLink>

          <NavLink to="/financeiro" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-icon"><CurrencyDollar size={18} weight="duotone" /></span>Financeiro
          </NavLink>

          <NavLink to="/configuracoes" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-icon"><Gear size={18} weight="duotone" /></span>Configurações
          </NavLink>
        </nav>

        <a href="/completar-cadastro" className="sidebar-cad-complete">
          <span className="sidebar-cad-complete-icon" aria-hidden="true">🎁</span>
          <span className="sidebar-cad-complete-text">COMPLETAR CADASTRO</span>
        </a>
      </aside>

      <main className={`layout-main${isAssinar ? " layout-main--no-header" : ""}`}>
        {/* Topbar desktop */}
        <div className="desk-topbar">
          <button className="topbar-btn" onClick={() => navigate("/assinar")}>
            <img src="/Sistema/premium.png" alt="Premium" style={{ width: "20px", height: "20px", objectFit: "contain" }} />
          </button>
          <div style={{ position: "relative" }} ref={notifRef}>
            <button className="topbar-btn" onClick={toggleNotif}>
              <img src="/Sistema/sino.png" alt="Notificações" style={{ width: "20px", height: "20px", objectFit: "contain" }} />
              {notifCount > 0 && <span className="topbar-badge">{notifCount > 9 ? "9+" : notifCount}</span>}
            </button>
          </div>
        </div>



        {/* Dropdown de notificações — fixo, funciona em mobile e desktop */}
        {notifOpen && (
          <div className="notif-overlay" onClick={closeNotif}>
            <div className="notif-dropdown" ref={notifRef} onClick={e => e.stopPropagation()}>
              <div className="notif-header">
                <span>Notificações</span>
                <button onClick={closeNotif}>✕</button>
              </div>
              <div className="notif-body">
                {notificacoes.length === 0
                  ? <p className="notif-empty">Nenhuma notificação</p>
                  : notificacoes.map((n: any) => (
                    <div key={n.id} className="notif-item">
                      {n.imagem_url && <img src={n.imagem_url} alt="" style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="notif-title">{n.titulo || n.title}</p>
                        <p className="notif-msg">{n.mensagem || n.body}</p>
                        <p className="notif-time">{new Date(n.created_at).toLocaleDateString("pt-BR")}</p>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        <Outlet />
      </main>

      {/* ── Drawer "Mais" (Proposta D) ── */}
      <MaisDrawer open={maisOpen} onClose={() => setMaisOpen(false)} />

      {/* Modal de crop da foto de perfil (aberto pelo ícone câmera do sidebar) */}
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          aspect={1}
          cropShape="round"
          onCancel={cancelCrop}
          onCropDone={handleCropDone}
        />
      )}

      {/* ── Bottom nav Mobile ── */}
      {!isReceitas && !isPrevia && (
        <nav className="bottom-nav">
          <div className="bottom-nav-pill">
            {[
              { to: "/inicio",   icon: <House          size={20} weight="fill" />, label: "Início"   },
              { to: "/cardapio", icon: <Cake           size={20} weight="fill" />, label: "Cardápio" },
              { to: "/pedidos",  icon: <ClipboardText  size={20} weight="fill" />, label: "Pedidos"  },
            ].map((item) => {
              const isActive =
                location.pathname === item.to ||
                location.pathname.startsWith(item.to + "/");
              return (
                <button
                  key={item.to}
                  className={`bn-item${isActive ? " bn-item--active" : ""}`}
                  onClick={() => navigate(item.to)}
                >
                  <span className="bn-icon">{item.icon}</span>
                  <span className="bn-label">{item.label}</span>
                </button>
              );
            })}
            <button
              className={`bn-item${maisOpen ? " bn-item--active" : ""}`}
              onClick={() => setMaisOpen(!maisOpen)}
              aria-label="Gestão"
            >
              <span className="bn-icon"><SquaresFour size={20} weight="fill" /></span>
              <span className="bn-label">Gestão</span>
            </button>
            <button
              className={`bn-item bn-doo${dooOpen ? " bn-doo--active" : ""}`}
              onClick={() => setDooOpen(true)}
              aria-label="Abrir Doo IA"
            >
              <img src="/Sistema/doo.png" alt="Doo" className="bn-doo-img" />
            </button>
          </div>
        </nav>
      )}

      <DooIA forceOpen={dooOpen} onClose={() => setDooOpen(false)} />

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .layout-root { display: flex; min-height: 100vh; font-family: var(--font-base); background: var(--bg-body); position: relative; }
        .bottom-nav { display: none; }

        /* ── Sidebar ── */
        .sidebar {
          width: 220px; min-height: 100vh;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--sidebar-border);
          display: flex; flex-direction: column;
          padding: 1.5rem 1rem;
          position: fixed; top: 0; left: 0; bottom: 0; z-index: 10;
          box-shadow: var(--shadow-card);
        }

        .sidebar-profile { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; margin-top: 2rem; margin-bottom: 1rem; padding-bottom: 0; }

        .sidebar-avatar-btn {
          background: none; border: none; padding: 0; cursor: pointer;
          position: relative; display: inline-block;
          border-radius: 50%;
          transition: transform var(--dur-fast, 150ms);
        }
        .sidebar-avatar-btn:hover { transform: scale(1.03); }
        .sidebar-avatar-btn:focus-visible { outline: 3px solid var(--primary); outline-offset: 4px; border-radius: 50%; }
        .sidebar-avatar-cam {
          position: absolute;
          bottom: 4px; right: 4px;
          width: 26px; height: 26px;
          border-radius: 50%;
          background: var(--primary);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35);
          transition: transform var(--dur-fast, 150ms), background var(--dur-fast, 150ms);
          pointer-events: none;
          z-index: 2;
        }
        .sidebar-avatar-btn:hover .sidebar-avatar-cam {
          background: var(--primary-dark);
          transform: scale(1.1);
        }
        .sidebar-avatar-ring { width: 100px; height: 100px; border-radius: 50%; padding: 3px; background: var(--primary-gradient); background-size: 300% 300%; animation: gradientRing 3s ease infinite; flex-shrink: 0; }
        @keyframes gradientRing { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

        .sidebar-avatar { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; border: 3px solid var(--text-inverse); background: rgba(var(--primary-rgb), 0.1); }
        .sidebar-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .sidebar-avatar-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }

        .sidebar-avatar-container {
          position: relative;
          display: inline-block;
        }

        .sidebar-badge {
          position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%);
          font-size: var(--font-caption);
          font-weight: var(--fw-bold);
          padding: 4px 12px 4px 10px;
          white-space: nowrap;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #fff;
          background: #2D1F26;
          border-radius: 8px;
          box-shadow: 0 3px 8px rgba(0,0,0,0.35);
          display: inline-flex; align-items: center; gap: 4px;
          border: none;
          font-family: inherit;
        }
        /* Variante PRO — preta */
        .sidebar-badge--pro { cursor: default; }
        /* Variante Upgrade — branca clicável */
        .sidebar-badge--upgrade {
          background: #fff;
          color: var(--primary);
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .sidebar-badge--upgrade:hover {
          transform: translateX(-50%) translateY(-1px);
          box-shadow: 0 5px 12px rgba(0,0,0,0.4);
        }
        .sidebar-badge--upgrade:active {
          transform: translateX(-50%) translateY(0);
        }
        .sidebar-badge-coroa { width: 14px; height: 14px; object-fit: contain; }

        .sidebar-greeting { text-align: center; padding: 0 1rem; margin-bottom: 1rem; min-height: 3.4rem; }
        .sidebar-greeting-name { margin: 0; font-size: 0.95rem; font-weight: var(--fw-semibold); color: var(--sidebar-text); line-height: 1.3; min-height: 1.25rem; display: flex; align-items: center; justify-content: center; }
        .sidebar-greeting-skel {
          display: inline-block;
          width: 120px; height: 12px;
          background: rgba(255,255,255,0.12);
          border-radius: 4px;
          animation: sbSkelPulse 1.4s ease-in-out infinite;
        }
        @keyframes sbSkelPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.9; }
        }
        .sidebar-greeting-date { margin: 3px 0 0; font-size: var(--font-caption); color: var(--sidebar-text-muted); line-height: 1.3; }

        .sidebar-nav { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; overflow-y: auto; }
        .nav-icon { display: flex; align-items: center; flex-shrink: 0; opacity: 0.7; }

        .nav-item { padding: 0.7rem 1rem; border-radius: var(--radius-md); font-size: var(--font-button); font-weight: var(--fw-medium); color: var(--sidebar-text); text-decoration: none; transition: background var(--dur-fast), color 0.15s; outline: none; display: flex; align-items: center; gap: 0.6rem; }
        .nav-item:hover { background: var(--sidebar-hover-bg); color: var(--sidebar-text); }
        .nav-item:hover .nav-icon { opacity: 1; }
        .nav-item:focus { background: var(--sidebar-hover-bg); color: var(--sidebar-text); outline: none; }
        .nav-item.active { background: var(--sidebar-active-bg); color: var(--sidebar-active-text); font-weight: var(--fw-semibold); }        .nav-item.active .nav-icon { opacity: 1; }

        .nav-group-btn { width: 100%; text-align: left; cursor: pointer; background: none; border: none; font-family: var(--font-base); padding: 0.7rem 1rem; border-radius: var(--radius-md); font-size: var(--font-button); font-weight: var(--fw-medium); color: var(--sidebar-text); transition: background var(--dur-fast), color 0.15s; display: flex; align-items: center; gap: 0.6rem; box-sizing: border-box; margin: 0; }
        .nav-group-btn:hover { background: var(--sidebar-hover-bg); color: var(--sidebar-text); }
        .nav-group-btn.active { color: var(--primary); }

        .nav-subitems { display: flex; flex-direction: column; padding: 0 0 0.25rem 0; }
        .nav-subitem { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.85rem 0.5rem 2.25rem; border-radius: var(--radius-sm); font-size: var(--font-button); color: var(--sidebar-text-muted); text-decoration: none; transition: all var(--dur-fast); position: relative; }
        .nav-subitem::before {
          content: "";
          position: absolute;
          left: 1.5rem;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--sidebar-text-muted);
          opacity: 0.5;
        }
        .nav-subitem .nav-subicon { display: inline-flex; align-items: center; justify-content: center; width: 16px; opacity: 0.75; }
        .nav-subitem:hover { color: var(--sidebar-text); background: var(--sidebar-hover-bg); }
        .nav-subitem:hover::before { opacity: 1; }
        .nav-subitem.active { color: var(--sidebar-active-text); background: var(--sidebar-active-bg); font-weight: var(--fw-semibold); }
        .nav-subitem.active::before { background: var(--sidebar-active-text); opacity: 1; }
        .nav-subitem.active .nav-subicon { opacity: 1; }

        .sidebar-cad-complete {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin: 0 0.25rem 1rem;
          padding: 0.75rem 0.5rem;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
          color: #fff;
          border: none;
          border-radius: var(--radius-md);
          text-decoration: none;
          text-align: center;
          font-family: var(--font-base);
          font-size: 0.68rem;
          font-weight: var(--fw-black);
          letter-spacing: 0.03em;
          box-shadow: 0 6px 18px rgba(var(--primary-rgb), 0.35);
          position: relative;
          overflow: hidden;
          transition: transform 0.15s, box-shadow 0.2s;
          cursor: pointer;
          white-space: nowrap;
        }
        .sidebar-cad-complete:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 22px rgba(var(--primary-rgb), 0.45);
        }
        .sidebar-cad-complete:active { transform: scale(0.98); }
        .sidebar-cad-complete-icon {
          font-size: 1rem;
          line-height: 1;
        }
        .sidebar-cad-complete-text {
          flex-shrink: 0;
        }
        .sidebar-cad-complete::after {
          content: "";
          position: absolute;
          top: 0; bottom: 0; left: -60%;
          width: 40px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
          animation: sbCadShimmer 3.5s linear infinite;
        }
        @keyframes sbCadShimmer { to { left: 160%; } }

        /* ── Layout main ── */
        /* Desktop: margem lateral (esquerda vem do sidebar 220px) + respiro no topo.
           Aplica em TODAS as páginas: Início, Agenda, Pedidos, Clientes, Cardápio, etc. */
        .layout-main { margin-left: 220px; flex: 1; padding: 3rem 2rem 2rem; min-height: 100vh; }
        .desk-topbar { display: none; }

        @media (min-width: 900px) {
          .desk-topbar { display: none; }
        }



        .topbar-btn { width: 34px; height: 34px; border-radius: 50%; background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.07); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); transition: background var(--dur-normal); position: relative; flex-shrink: 0; }
        .topbar-btn:hover { background: rgba(0,0,0,0.08); }
        .topbar-badge { position: absolute; top: 2px; right: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--primary); color: var(--text-inverse); font-size: var(--font-caption); font-weight: var(--fw-bold); display: flex; align-items: center; justify-content: center; }

        /* ── Overlay + Dropdown de notificações (global, funciona em todas as páginas) ── */
        .notif-overlay {
          position: fixed; inset: 0;
          background: rgba(45, 31, 38, 0.55);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          z-index: 9998;
          animation: notifOverlayIn 0.2s ease-out;
          touch-action: none;
        }
        @keyframes notifOverlayIn { from { opacity: 0; } to { opacity: 1; } }

        .notif-dropdown {
          position: fixed;
          top: calc(env(safe-area-inset-top, 0px) + 12px);
          right: 12px;
          left: 12px;
          max-width: 420px;
          margin-left: auto;
          max-height: calc(100vh - env(safe-area-inset-top, 0px) - 24px);
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          box-shadow: 0 20px 60px rgba(45,31,38,0.35);
          border: 1px solid var(--border);
          overflow: hidden;
          z-index: 9999;
          display: flex; flex-direction: column;
          animation: notifDropIn 0.22s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes notifDropIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .notif-header {
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          display: flex; justify-content: space-between; align-items: center;
          font-weight: var(--fw-black); font-size: 15px;
          color: var(--text-title);
          flex-shrink: 0;
        }
        .notif-header button {
          width: 30px; height: 30px;
          border-radius: 50%;
          background: var(--bg-subtle);
          border: none;
          cursor: pointer;
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: var(--fw-bold);
          padding: 0;
          display: flex; align-items: center; justify-content: center;
          transition: background var(--dur-fast), color var(--dur-fast);
        }
        .notif-header button:hover { background: var(--primary-light); color: var(--primary); }
        .notif-body {
          flex: 1; min-height: 0;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }
        .notif-empty { padding: 40px 20px; text-align: center; color: var(--text-muted); font-size: 13px; margin: 0; }
        .notif-item { padding: 12px 14px; border-bottom: 1px solid var(--border); display: flex; gap: 10px; align-items: flex-start; }
        .notif-item:last-child { border-bottom: none; }
        .notif-title { font-size: 13px; font-weight: var(--fw-bold); color: var(--text-title); margin: 0 0 2px; line-height: 1.3; }
        .notif-msg { font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.4; }
        .notif-time { font-size: 10px; color: var(--text-muted); margin: 4px 0 0; }

        /* ── Mobile ── */
        @media (max-width: 900px) {
          .sidebar { display: none; }

          .mob-notif-badge {
            position: absolute; top: -4px; right: -4px;
            background: var(--error); color: var(--text-inverse);
            font-size: var(--font-caption); font-weight: var(--fw-bold);
            width: 16px; height: 16px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            border: 2px solid var(--primary-dark); line-height: 1;
          }

          .layout-main {
            margin-left: 0;
            padding: var(--space-2);
            padding-top: calc(var(--pad-page-top) + env(safe-area-inset-top, 0px));
            padding-bottom: 6.5rem;
            background: var(--bg-body);
            min-height: 100vh;
            width: 100%;
            box-sizing: border-box;
          }
          .layout-main--no-header { background: var(--bg-body); }

          /* ── Bottom Nav Mobile ── */
          .bottom-nav {
            display: flex !important;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            z-index: 50;
            padding: 0;
            padding-bottom: env(safe-area-inset-bottom, 0px);
            background: transparent;
            pointer-events: none;
          }
          .bottom-nav-pill {
            display: flex;
            align-items: stretch;
            justify-content: space-between;
            width: 100%;
            background: var(--text-title);
            border-radius: 0;
            padding: 6px 6px;
            height: 56px;
            box-shadow: 0 -2px 16px rgba(61, 26, 36, 0.25);
            pointer-events: all;
            margin-bottom: 0;
          }
          .bn-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            padding: 7px 10px;
            border: none;
            background: none;
            cursor: pointer;
            border-radius: 10px;
            font-family: var(--font-base);
            text-decoration: none;
            transition: background var(--dur-fast), transform 0.1s;
            min-width: 56px;
            color: #ffffff;
          }
          .bn-item:hover {
            background: rgba(255, 255, 255, 0.12);
            border-radius: 10px;
          }
          .bn-item--active {
            background: #ffffff;
            color: var(--text-title);
          }
          .bn-item--active:hover {
            background: #ffffff;
          }
          .bn-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            color: inherit;
          }
          .bn-label {
            font-size: var(--font-caption);
            font-weight: var(--fw-regular);
            color: inherit;
            white-space: nowrap;
            letter-spacing: 0.01em;
            line-height: 1;
          }
          .bn-item--active .bn-label {
            font-weight: var(--fw-semibold);
          }
          .bn-item:active {
            transform: scale(0.94);
          }

          /* ── Doo highlight button ── */
          .bn-doo {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            border: none;
            background: transparent;
            cursor: pointer;
            border-radius: 0;
            align-self: stretch;
            min-width: 52px;
            margin: -6px -6px -6px 0;
            overflow: hidden;
            transition: transform 0.15s;
          }
          .bn-doo:hover { opacity: 0.9; }
          .bn-doo:active { transform: scale(0.95); }
          .bn-doo-img {
            height: 100%;
            width: 100%;
            object-fit: cover;
            object-position: top center;
          }
          .bottom-nav { animation: fadeInUp 0.2s ease; }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

          /* ── Gestão Drawer ── */
          .gestao-overlay { position: fixed; inset: 0; z-index: 100; background: var(--drawer-overlay); backdrop-filter: blur(6px); }
          .gestao-drawer { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-card); border-radius: var(--radius-xl) 24px 0 0; padding: 0.75rem 1.25rem 2rem; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); max-height: 80vh; overflow-y: auto; z-index: 101; box-shadow: 0 -8px 40px rgba(0,0,0,0.2); }
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          .gestao-handle { width: 40px; height: 4px; background: var(--border); border-radius: 2px; margin: 0 auto 1rem; }
          .gestao-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
          .gestao-title { font-size: var(--font-modal-title); font-weight: var(--fw-black); color: var(--text-title); margin: 0; font-family: var(--font-base); }
          .gestao-close { background: var(--bg-subtle); border: none; color: var(--text-secondary); width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: var(--font-helper); display: flex; align-items: center; justify-content: center; }
          .gestao-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.7rem; }
          .gestao-item { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; background: var(--bg-subtle); border-radius: var(--radius-lg); padding: 1.1rem 0.4rem; text-decoration: none; transition: transform var(--dur-fast), background 0.15s; border: 1.5px solid transparent; min-height: 88px; }
          .gestao-item:active { transform: scale(0.95); }
          .gestao-item.active { background: var(--primary); border-color: var(--primary); }
          .gestao-icon { color: var(--primary); display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: var(--radius-md); background: rgba(152,98,116,0.12); }
          .gestao-item.active .gestao-icon { color: #FFFFFF; background: rgba(255,255,255,0.2); }
          .gestao-label { font-size: var(--font-caption); font-weight: var(--fw-semibold); color: var(--text-title); text-align: center; font-family: var(--font-base); line-height: 1.25; white-space: normal; word-break: break-word; }
          .gestao-item.active .gestao-label { color: #FFFFFF; }
        }
      `}</style>
    </div>
  );
}
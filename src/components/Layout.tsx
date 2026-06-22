import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import DooIA from "@/components/DooIA";
import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  House, CalendarDots, ShoppingBag, ClipboardText, Users, BookOpen,
  Package, CurrencyDollar, Gear, SignOut, CaretDown, ForkKnife, List,
  Eye, Storefront, Rows, PaintBrush, Sliders, Tag, QrCode,
  ChartBar, Files, Percent, User, ArrowLeft, Bell
} from "@phosphor-icons/react";
import { useProfile } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";
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
  const [now, setNow] = useState(new Date());
  const [gestaoOpen, setGestaoOpen] = useState(false);
  const location = useLocation();
  const isReceitas = location.pathname === "/receitas";
  const isAssinar = location.pathname === "/assinar";
  const isPrevia = location.pathname === "/cardapio-preview";
  const isPedidoForm = location.pathname.startsWith("/pedidos/") || location.pathname === "/pedidos/novo";
  const isCardapioMode = ["/cardapio-config", "/produtos"].includes(location.pathname);
  const [cardapioNav, setCardapioNav] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  const formatTime = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const gestaoItems = [
    { label: "Dashboard", path: "/dashboard",     icon: <ChartBar    size={22} weight="duotone" /> },
    { label: "Pedidos",   path: "/pedidos",        icon: <ClipboardText size={22} weight="duotone" /> },
    { label: "Produtos",  path: "/produtos",       icon: <Storefront  size={22} weight="duotone" /> },
    { label: "Estoque",   path: "/estoque",        icon: <Package     size={22} weight="duotone" /> },
    { label: "Financeiro",path: "/financeiro",     icon: <CurrencyDollar size={22} weight="duotone" /> },
    { label: "Promoções", path: "/promocoes",      icon: <Percent     size={22} weight="duotone" /> },
    { label: "Arquivos",  path: "/arquivos",       icon: <Files       size={22} weight="duotone" /> },
    { label: "Config.",   path: "/configuracoes",  icon: <Gear        size={22} weight="duotone" /> },
  ];

  return (
    <div className="layout-root">
      {/* ── Sidebar Desktop ── */}
      <aside className="sidebar">
        <div className="sidebar-profile">
          <div style={{ position: "relative", display: "inline-block" }}>
            <div className="sidebar-avatar-ring">
              <div className="sidebar-avatar">
                {profile?.foto_url
                  ? <img src={profile.foto_url} alt="Foto de perfil" />
                  : <div className="sidebar-avatar-placeholder"><User size={36} weight="duotone" color="var(--primary)" /></div>
                }
              </div>
            </div>
            <div className={`sidebar-badge ${isPro ? "sidebar-badge--pro" : "sidebar-badge--free"}`}>
              {isPro ? "❤️ Premium" : "Free"}
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/inicio" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-icon"><House size={18} weight="duotone" /></span>Início
          </NavLink>
          <NavLink to="/agenda" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-icon"><CalendarDots size={18} weight="duotone" /></span>Agenda
          </NavLink>

          <SidebarGroup label="Cardápio" icon={<ShoppingBag size={18} weight="duotone" />} paths={["/cardapio-config","/cardapio-preview","/produtos"]} location={location}>
            <NavLink to="/cardapio-config" className={({ isActive }) => `nav-subitem ${isActive ? "active" : ""}`}>Configuração</NavLink>
            <NavLink to="/produtos" className={({ isActive }) => `nav-subitem ${isActive ? "active" : ""}`}>Produtos</NavLink>
            <NavLink to="/cardapio-preview" className={({ isActive }) => `nav-subitem ${isActive ? "active" : ""}`}>Prévia</NavLink>
          </SidebarGroup>

          <NavLink to="/pedidos" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-icon"><ClipboardText size={18} weight="duotone" /></span>Pedidos
          </NavLink>
          <NavLink to="/clientes" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-icon"><Users size={18} weight="duotone" /></span>Clientes
          </NavLink>

          <SidebarGroup label="Receitas" icon={<BookOpen size={18} weight="duotone" />} paths={["/receitas","/comunidade"]} location={location}>
            <NavLink to="/receitas" className={({ isActive }) => `nav-subitem ${isActive ? "active" : ""}`}>Minhas receitas</NavLink>
            <NavLink to="/receitas?tipo=app" className={({ isActive }) => `nav-subitem ${isActive ? "active" : ""}`}>Receitas do app</NavLink>
            <NavLink to="/comunidade" className={({ isActive }) => `nav-subitem ${isActive ? "active" : ""}`}>Comunidade</NavLink>
          </SidebarGroup>

          <SidebarGroup label="Estoque" icon={<Package size={18} weight="duotone" />} paths={["/insumos","/estoque"]} location={location}>
            <NavLink to="/insumos" className={({ isActive }) => `nav-subitem ${isActive ? "active" : ""}`}>Ingredientes</NavLink>
          </SidebarGroup>

          <NavLink to="/financeiro" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-icon"><CurrencyDollar size={18} weight="duotone" /></span>Financeiro
          </NavLink>
          <NavLink to="/configuracoes" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-icon"><Gear size={18} weight="duotone" /></span>Configurações
          </NavLink>
        </nav>

        {!isPro && (
          <a href="/assinar" className="sidebar-upgrade">
            <span className="sidebar-upgrade-text">✨ Fazer upgrade</span>
          </a>
        )}

        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
          className="sidebar-logout"
        >
          <SignOut size={16} weight="duotone" />
          Sair
        </button>
      </aside>

      <main className={`layout-main${isAssinar ? " layout-main--no-header" : ""}`}>
        {/* Topbar desktop */}
        <div className="desk-topbar">
          {/* Notificações com dropdown */}
          <div style={{ position: "relative" }} ref={notifRef}>
            <button className="topbar-btn" onClick={toggleNotif}>
              <img src="/notifica.png" alt="Notificações" style={{ width: "20px", height: "20px", objectFit: "contain" }} />
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

      {/* ── Gestão Drawer ── */}
      {gestaoOpen && (
        <div className="gestao-overlay" onClick={() => setGestaoOpen(false)}>
          <div className="gestao-drawer" onClick={e => e.stopPropagation()}>
            <div className="gestao-handle" />
            <div className="gestao-header">
              <h3 className="gestao-title">Gestão</h3>
              <button className="gestao-close" onClick={() => setGestaoOpen(false)}>✕</button>
            </div>
            <div className="gestao-grid">
              {gestaoItems.map((item) => (
                <NavLink key={item.path} to={item.path} className="gestao-item" onClick={() => setGestaoOpen(false)}>
                  <span className="gestao-icon">{item.icon}</span>
                  <span className="gestao-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom nav Mobile ── */}
      {!isReceitas && !isPrevia && (
        <nav className="bottom-nav">
          <div className="bottom-nav-pill">
            {(cardapioNav || isCardapioMode) ? (
              <>
                {(() => {
                  const cardapioNavItems = [
                    { path: "/cardapio-resumo", icon: <ChartBar size={20} weight="fill" />, label: "Visão Geral" },
                    { path: "/cardapio-preview", icon: <Eye size={20} weight="fill" />, label: "Prévia" },
                    { path: "/produtos", icon: <Storefront size={20} weight="fill" />, label: "Produtos" },
                    { path: "/cardapio-config", icon: <Sliders size={20} weight="fill" />, label: "Config" },
                  ];
                  return (
                    <>
                      {cardapioNavItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                          <button
                            key={item.path}
                            className={`bn-item${isActive ? " bn-item--active" : ""}`}
                            onClick={() => navigate(item.path)}
                          >
                            <span className="bn-icon">{item.icon}</span>
                            <span className="bn-label">{item.label}</span>
                          </button>
                        );
                      })}
                      <button
                        className="bn-item"
                        onClick={() => { setCardapioNav(false); navigate("/inicio"); }}
                      >
                        <span className="bn-icon"><ArrowLeft size={20} weight="fill" /></span>
                        <span className="bn-label">Voltar</span>
                      </button>
                    </>
                  );
                })()}
              </>
            ) : (
              <>
                {[
                  { to: "/inicio",      icon: <House size={20} weight="fill" />,         label: "Início"     },
                  { to: "/pedidos",     icon: <ClipboardText size={20} weight="fill" />, label: "Pedidos"    },
                  { to: "/cardapio-config", icon: <ForkKnife size={20} weight="fill" />, label: "Cardápio", isCardapio: true },
                  { to: "/financeiro",  icon: <CurrencyDollar size={20} weight="fill" />,label: "Gestão" },
                ].map((item) => {
                  const isActive = item.isCardapio
                    ? (cardapioNav || isCardapioMode)
                    : location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                  return (
                    <button
                      key={item.to}
                      className={`bn-item${isActive ? " bn-item--active" : ""}`}
                      onClick={() => {
                        if (item.isCardapio) { setCardapioNav(true); }
                        navigate(item.to);
                      }}
                    >
                      <span className="bn-icon">{item.icon}</span>
                      <span className="bn-label">{item.label}</span>
                    </button>
                  );
                })}
                <button
                  className={`bn-item${gestaoOpen ? " bn-item--active" : ""}`}
                  onClick={() => setGestaoOpen(!gestaoOpen)}
                >
                  <span className="bn-icon"><List size={20} weight="fill" /></span>
                  <span className="bn-label">Menu</span>
                </button>
              </>
            )}
          </div>
        </nav>
      )}

      {location.pathname === "/inicio" && <DooIA />}

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

        .sidebar-profile { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; margin-top: 2rem; margin-bottom: 1.5rem; padding-bottom: 1.25rem; }

        .sidebar-avatar-ring { width: 100px; height: 100px; border-radius: 50%; padding: 3px; background: var(--primary-gradient); background-size: 300% 300%; animation: gradientRing 3s ease infinite; flex-shrink: 0; }
        @keyframes gradientRing { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

        .sidebar-avatar { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; border: 3px solid var(--text-inverse); background: rgba(var(--primary-rgb), 0.1); }
        .sidebar-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .sidebar-avatar-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }

        .sidebar-badge { position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); font-size: 0.65rem; font-weight: 700; padding: 3px 10px; white-space: nowrap; letter-spacing: 0.05em; color: var(--text-inverse); }
        .sidebar-badge--pro { background: var(--primary-gradient); border-radius: 20px; }
        .sidebar-badge--free { background: #111111; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; }

        .sidebar-nav { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; overflow-y: auto; }
        .nav-icon { display: flex; align-items: center; flex-shrink: 0; opacity: 0.7; }

        .nav-item { padding: 0.7rem 1rem; border-radius: 10px; font-size: 0.88rem; font-weight: 500; color: var(--sidebar-text); text-decoration: none; transition: background 0.15s, color 0.15s; outline: none; display: flex; align-items: center; gap: 0.6rem; }
        .nav-item:hover { background: var(--sidebar-hover-bg); color: var(--sidebar-text); }
        .nav-item:hover .nav-icon { opacity: 1; }
        .nav-item:focus { background: var(--sidebar-hover-bg); color: var(--sidebar-text); outline: none; }
        .nav-item.active { background: var(--sidebar-active-bg); color: var(--sidebar-active-text); font-weight: 600; }        .nav-item.active .nav-icon { opacity: 1; }

        .nav-group-btn { width: 100%; text-align: left; cursor: pointer; background: none; border: none; font-family: var(--font-base); padding: 0.7rem 1rem; border-radius: 10px; font-size: 0.88rem; font-weight: 500; color: var(--sidebar-text); transition: background 0.15s, color 0.15s; display: flex; align-items: center; gap: 0.6rem; box-sizing: border-box; margin: 0; }
        .nav-group-btn:hover { background: var(--sidebar-hover-bg); color: var(--sidebar-text); }
        .nav-group-btn.active { color: var(--primary); }

        .nav-subitems { display: flex; flex-direction: column; padding: 0 0 0.25rem 0; }
        .nav-subitem { display: flex; align-items: center; padding: 0.5rem 0.85rem 0.5rem 1.75rem; border-radius: 8px; font-size: 0.85rem; color: var(--sidebar-text-muted); text-decoration: none; transition: all 0.15s; }
        .nav-subitem:hover { color: var(--sidebar-text); background: var(--sidebar-hover-bg); }
        .nav-subitem.active { color: var(--sidebar-active-text); background: var(--sidebar-active-bg); font-weight: 600; }

        .sidebar-upgrade { display: block; margin: 0 0.25rem 0.5rem; background: rgba(var(--primary-rgb), 0.12); border: 1px solid rgba(var(--primary-rgb), 0.2); border-radius: 14px; padding: 0.75rem 1rem; text-decoration: none; text-align: center; }
        .sidebar-upgrade-text { font-size: 0.78rem; font-weight: 700; color: var(--primary); }

        .sidebar-logout { display: flex; align-items: center; gap: 0.6rem; width: calc(100% - 0.5rem); margin: 0 0.25rem 1rem; background: none; border: none; cursor: pointer; padding: 0.6rem 1rem; border-radius: 10px; color: var(--sidebar-text-muted); font-size: 0.82rem; font-weight: 500; font-family: var(--font-base); transition: color 0.15s; }
        .sidebar-logout:hover { color: var(--sidebar-text); }

        /* ── Layout main ── */
        .layout-main { margin-left: 220px; flex: 1; padding: 2rem; min-height: 100vh; }
        .desk-topbar { display: none; }

        @media (min-width: 900px) {
          .desk-topbar { display: flex; align-items: center; justify-content: flex-end; gap: 0.6rem; padding: 0.5rem 2rem; margin: -2rem -2rem 0.5rem -2rem; position: sticky; top: 0; z-index: 9; }
        }



        .topbar-btn { width: 34px; height: 34px; border-radius: 50%; background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.07); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); transition: background 0.2s; position: relative; flex-shrink: 0; }
        .topbar-btn:hover { background: rgba(0,0,0,0.08); }
        .topbar-badge { position: absolute; top: 2px; right: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--primary); color: var(--text-inverse); font-size: 0.6rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }

        .notif-overlay { position: fixed; inset: 0; z-index: 9998; }
        .notif-dropdown { position: fixed; right: 1rem; top: 4rem; width: 320px; background: var(--bg-card); border-radius: 16px; box-shadow: var(--shadow-md); border: 1px solid var(--border); z-index: 9999; overflow: hidden; }
        .notif-header { padding: 0.85rem 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 0.9rem; color: var(--text-title); }
        .notif-header button { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 1rem; }
        .notif-body { max-height: 360px; overflow-y: auto; }
        .notif-empty { padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem; margin: 0; }
        .notif-item { padding: 0.85rem 1rem; border-bottom: 1px solid var(--border); display: flex; gap: 0.75rem; align-items: flex-start; }
        .notif-item:last-child { border-bottom: none; }
        .notif-title { font-size: 0.85rem; font-weight: 600; color: var(--text-title); margin: 0 0 2px; }
        .notif-msg { font-size: 0.78rem; color: var(--text-secondary); margin: 0; }
        .notif-time { font-size: 0.7rem; color: var(--text-muted); margin: 4px 0 0; }

        /* ── Mobile ── */
        @media (max-width: 900px) {
          .sidebar { display: none; }

          .mob-notif-badge {
            position: absolute; top: -4px; right: -4px;
            background: var(--error); color: var(--text-inverse);
            font-size: 0.6rem; font-weight: 700;
            width: 16px; height: 16px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            border: 2px solid var(--primary-dark); line-height: 1;
          }

          .layout-main { margin-left: 0; padding: 0.75rem; padding-top: 0.75rem; padding-bottom: 6.5rem; background: var(--bg-body); min-height: 100vh; width: 100%; box-sizing: border-box; }
          .layout-main--no-header { padding-top: 1rem; background: var(--bg-body); }

          /* ── Bottom Nav Mobile ── */
          .bottom-nav {
            display: flex !important;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            z-index: 50;
            padding: 0 1rem 0;
            padding-bottom: max(env(safe-area-inset-bottom, 0px), 4px);
            background: transparent;
            pointer-events: none;
          }
          .bottom-nav-pill {
            display: flex;
            align-items: center;
            justify-content: space-around;
            width: 100%;
            background: #ffffff;
            border-radius: 999px;
            padding: 6px 6px;
            box-shadow: 0 4px 24px rgba(61, 26, 36, 0.15), 0 1px 4px rgba(61, 26, 36, 0.08);
            pointer-events: all;
            margin-bottom: 4px;
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
            border-radius: 14px;
            font-family: var(--font-base);
            text-decoration: none;
            transition: background 0.15s, transform 0.1s;
            min-width: 56px;
            color: #b08a96;
          }
          .bn-item:hover {
            background: rgba(61, 26, 36, 0.07);
            border-radius: 14px;
          }
          .bn-item--active {
            background: #3d1a24;
            color: #ffffff;
          }
          .bn-item--active:hover {
            background: #3d1a24;
          }
          .bn-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            color: inherit;
          }
          .bn-label {
            font-size: 0.62rem;
            font-weight: 400;
            color: inherit;
            white-space: nowrap;
            letter-spacing: 0.01em;
            line-height: 1;
          }
          .bn-item--active .bn-label {
            font-weight: 600;
          }
          .bn-item:active {
            transform: scale(0.94);
          }
          .bottom-nav { animation: fadeInUp 0.2s ease; }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

          /* ── Gestão Drawer ── */
          .gestao-overlay { position: fixed; inset: 0; z-index: 100; background: var(--drawer-overlay); backdrop-filter: blur(6px); }
          .gestao-drawer { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-card, #FFFFFF); border-radius: 24px 24px 0 0; padding: 0.75rem 1.25rem 2rem; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); max-height: 80vh; overflow-y: auto; z-index: 101; box-shadow: 0 -8px 40px rgba(0,0,0,0.2); }
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          .gestao-handle { width: 40px; height: 4px; background: var(--border, #ECC2D0); border-radius: 2px; margin: 0 auto 1rem; }
          .gestao-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
          .gestao-title { font-size: 1.05rem; font-weight: 800; color: var(--text-title, #431524); margin: 0; font-family: var(--font-base); }
          .gestao-close { background: var(--bg-subtle, #F7EEF1); border: none; color: var(--text-secondary, #6E3548); width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; }
          .gestao-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.7rem; }
          .gestao-item { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; background: var(--bg-subtle, #F7EEF1); border-radius: 16px; padding: 1.1rem 0.4rem; text-decoration: none; transition: transform 0.15s, background 0.15s; border: 1.5px solid transparent; min-height: 88px; }
          .gestao-item:active { transform: scale(0.95); }
          .gestao-item.active { background: var(--primary, #986274); border-color: var(--primary, #986274); }
          .gestao-icon { color: var(--primary, #986274); display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; background: rgba(152,98,116,0.12); }
          .gestao-item.active .gestao-icon { color: #FFFFFF; background: rgba(255,255,255,0.2); }
          .gestao-label { font-size: 0.72rem; font-weight: 600; color: var(--text-title, #431524); text-align: center; font-family: var(--font-base); line-height: 1.25; white-space: normal; word-break: break-word; }
          .gestao-item.active .gestao-label { color: #FFFFFF; }
        }
      `}</style>
    </div>
  );
}
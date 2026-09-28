import { useState, useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  ChartLine, UsersThree, Newspaper, PenNib, Image as ImageIcon,
  Cake, Medal, FilePdf, Bell, ChartBar, Lightbulb,
  ArrowLeft, SignOut, DotsThreeOutline, CaretRight, X,
} from "@phosphor-icons/react";

interface MenuItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

interface MenuSection {
  title?: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    items: [
      { path: "/admin", label: "Dashboard", icon: <ChartLine size={16} weight="fill" /> },
      { path: "/admin/usuarios", label: "Usuários", icon: <UsersThree size={16} weight="bold" /> },
    ],
  },
  {
    title: "Conteúdo",
    items: [
      { path: "/admin/noticias", label: "Notícias", icon: <Newspaper size={16} weight="bold" /> },
      { path: "/admin/autores", label: "Autores", icon: <PenNib size={16} weight="bold" /> },
      { path: "/admin/banner", label: "Banner mobile", icon: <ImageIcon size={16} weight="bold" /> },
    ],
  },
  {
    title: "Biblioteca",
    items: [
      { path: "/admin/receitas", label: "Receitas Comunidade", icon: <Cake size={16} weight="bold" /> },
      { path: "/admin/receitas-doonly", label: "Receitas Doonly", icon: <Medal size={16} weight="bold" /> },
      { path: "/admin/pdfs", label: "Biblioteca PDF", icon: <FilePdf size={16} weight="bold" /> },
    ],
  },
  {
    title: "Comunicação",
    items: [
      { path: "/admin/notificacoes", label: "Notificações", icon: <Bell size={16} weight="bold" /> },
      { path: "/admin/ideias", label: "Ideias", icon: <Lightbulb size={16} weight="bold" /> },
    ],
  },
  {
    title: "Análise",
    items: [
      { path: "/admin/relatorios", label: "Relatórios", icon: <ChartBar size={16} weight="bold" /> },
    ],
  },
];

// Barra de navegação mobile: 4 telas fixas + "Mais" (resto do menu)
const BOTTOM_NAV: { path: string; label: string; icon: React.ReactNode }[] = [
  { path: "/admin", label: "Painel", icon: <ChartLine size={22} weight="bold" /> },
  { path: "/admin/ideias", label: "Ideias", icon: <Lightbulb size={22} weight="bold" /> },
  { path: "/admin/noticias", label: "Notícias", icon: <Newspaper size={22} weight="bold" /> },
  { path: "/admin/notificacoes", label: "Avisos", icon: <Bell size={22} weight="bold" /> },
];
const BOTTOM_PATHS = BOTTOM_NAV.map(i => i.path);
const MAIS_ITEMS = menuSections.flatMap(s => s.items).filter(i => !BOTTOM_PATHS.includes(i.path));

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("Admin");
  const [ideiasNovas, setIdeiasNovas] = useState(0);

  // Contador de ideias novas na sidebar (recebida ou sem status)
  useEffect(() => {
    if (!authorized) return;
    const contar = async () => {
      const { count } = await supabase
        .from("sugestoes")
        .select("id", { count: "exact", head: true })
        .or("status.is.null,status.eq.recebida");
      setIdeiasNovas(count || 0);
    };
    contar();
    window.addEventListener("admin-ideias-changed", contar);
    return () => window.removeEventListener("admin-ideias-changed", contar);
  }, [authorized]);

  useEffect(() => {
    const check = async () => {
      const ADMIN_EMAILS = ["gestao@doonly.com.br"];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/admin/login"); setLoading(false); return; }
      if (ADMIN_EMAILS.includes(session.user.email || "")) {
        setAuthorized(true);
        setUserEmail(session.user.email || "");
        setUserName((session.user.email || "A").split("@")[0]);
      } else {
        navigate("/admin/login");
      }
      setLoading(false);
    };
    check();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  if (loading) return null;
  if (!authorized) return null;

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname === path;
  };

  const renderNav = () => (
    <nav className="adm-nav">
      {menuSections.map((sec, idx) => (
        <div key={idx} className="adm-nav-section">
          {sec.title && <p className="adm-nav-sec-title">{sec.title}</p>}
          {sec.items.map(item => (
            <button
              key={item.path}
              className={`adm-nav-item ${isActive(item.path) ? "on" : ""}`}
              onClick={() => { navigate(item.path); setMenuOpen(false); }}
            >
              <span className="adm-nav-icon">{item.icon}</span>
              <span className="adm-nav-label">{item.label}</span>
              {item.path === "/admin/ideias" && ideiasNovas > 0 && (
                <span className="adm-nav-badge">{ideiasNovas > 99 ? "99+" : ideiasNovas}</span>
              )}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );

  const renderBottom = () => (
    <div className="adm-sidebar-bottom">
      <div className="adm-user">
        <div className="adm-user-avt">{userName.charAt(0).toUpperCase()}</div>
        <div className="adm-user-info">
          <div className="adm-user-name">{userName}</div>
          <div className="adm-user-mail">{userEmail}</div>
        </div>
      </div>
      <button className="adm-side-btn" onClick={() => navigate("/inicio")}>
        <ArrowLeft size={14} weight="bold" />
        <span>Voltar ao app</span>
      </button>
      <button className="adm-side-btn danger" onClick={handleLogout}>
        <SignOut size={14} weight="bold" />
        <span>Sair</span>
      </button>
    </div>
  );

  return (
    <div className="adm-root">
      {/* Sidebar desktop */}
      <aside className="adm-sidebar">
        <div className="adm-sidebar-top">
          <div className="adm-logo-square">
            <img src="/logoapp.png" alt="Doonly" />
          </div>
          <div className="adm-brand">
            <span className="adm-brand-name">Doonly</span>
            <span className="adm-brand-role">Painel Admin</span>
          </div>
        </div>
        {renderNav()}
        {renderBottom()}
      </aside>

      {/* Mobile header — só a marca; navegação fica na barra de baixo */}
      <div className="adm-mobile-header">
        <div className="adm-logo-square adm-logo-square--sm">
          <img src="/logoapp.png" alt="Doonly" />
        </div>
        <div className="adm-brand">
          <span className="adm-brand-name">Doonly</span>
          <span className="adm-brand-role">Admin</span>
        </div>
      </div>

      {/* Mobile: barra de navegação inferior */}
      <nav className="adm-bnav" aria-label="Navegação do admin">
        {BOTTOM_NAV.map(item => (
          <button
            key={item.path}
            className={`adm-bnav-it${!menuOpen && isActive(item.path) ? " on" : ""}`}
            onClick={() => { navigate(item.path); setMenuOpen(false); }}
          >
            <span className="adm-bnav-ic">
              {item.icon}
              {item.path === "/admin/ideias" && ideiasNovas > 0 && (
                <span className="adm-bnav-badge">{ideiasNovas > 99 ? "99+" : ideiasNovas}</span>
              )}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
        <button
          className={`adm-bnav-it${menuOpen || !BOTTOM_PATHS.some(p => isActive(p)) ? " on" : ""}`}
          onClick={() => setMenuOpen(o => !o)}
          aria-expanded={menuOpen}
        >
          <span className="adm-bnav-ic"><DotsThreeOutline size={22} weight="fill" /></span>
          <span>Mais</span>
        </button>
      </nav>

      {/* Mobile: folha "Mais" */}
      {menuOpen && (
        <div className="adm-sheet-ov" onClick={() => setMenuOpen(false)}>
          <div className="adm-sheet" role="dialog" aria-modal="true" aria-label="Mais opções" onClick={e => e.stopPropagation()}>
            <div className="adm-sheet-grab" />
            <div className="adm-sheet-hdr">
              <b>Mais</b>
              <button className="adm-sheet-x" onClick={() => setMenuOpen(false)} aria-label="Fechar"><X size={14} weight="bold" /></button>
            </div>
            {MAIS_ITEMS.map(item => (
              <button
                key={item.path}
                className={`adm-sheet-it${isActive(item.path) ? " on" : ""}`}
                onClick={() => { navigate(item.path); setMenuOpen(false); }}
              >
                <span className="adm-sheet-ic">{item.icon}</span>
                <span className="adm-sheet-l">{item.label}</span>
                <CaretRight size={13} weight="bold" />
              </button>
            ))}
            <div className="adm-sheet-sep" />
            <div className="adm-sheet-foot">
              <button onClick={() => navigate("/inicio")}><ArrowLeft size={14} weight="bold" /> Voltar ao app</button>
              <button className="danger" onClick={handleLogout}><SignOut size={14} weight="bold" /> Sair</button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="adm-main">
        <Outlet />
      </main>

      <style>{`
        * { box-sizing: border-box; }
        .adm-root { display: flex; min-height: 100vh; font-family: 'Geist', sans-serif; background: #F8F5F6; }

        /* ═══════════ Sidebar desktop ═══════════ */
        .adm-sidebar {
          width: 260px;
          min-height: 100vh;
          background: #1A1418;
          display: flex; flex-direction: column;
          position: fixed;
          left: 0; top: 0; bottom: 0;
          z-index: 30;
        }
        .adm-sidebar-top {
          padding: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          display: flex; align-items: center; gap: 12px;
        }
        .adm-logo-square {
          width: 40px; height: 40px;
          border-radius: 10px;
          background: linear-gradient(135deg, #E85A8C, #C33A6E);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(232,90,140,0.25);
          overflow: hidden;
          flex-shrink: 0;
        }
        .adm-logo-square img { width: 26px; height: 26px; object-fit: contain; filter: brightness(0) invert(1); }
        .adm-logo-square--sm { width: 34px; height: 34px; }
        .adm-logo-square--sm img { width: 22px; height: 22px; }

        .adm-brand { display: flex; flex-direction: column; min-width: 0; }
        .adm-brand-name { font-size: 15px; font-weight: 900; color: #fff; line-height: 1.1; }
        .adm-brand-role { font-size: 10px; color: #9CA3AF; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; }

        .adm-nav {
          flex: 1;
          padding: 12px 12px 20px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.15) transparent;
        }
        .adm-nav::-webkit-scrollbar { width: 4px; }
        .adm-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }

        .adm-nav-section { margin-bottom: 4px; }
        .adm-nav-sec-title {
          font-size: 10px;
          font-weight: 800;
          color: #6B7280;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 14px 12px 6px;
          margin: 0;
        }

        .adm-nav-item {
          display: flex; align-items: center; gap: 10px;
          width: 100%;
          padding: 9px 12px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #C9B4BB;
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          text-align: left;
          transition: all 0.15s;
          margin-bottom: 2px;
        }
        .adm-nav-icon { display: flex; align-items: center; justify-content: center; width: 18px; }
        .adm-nav-item:hover {
          background: rgba(255,255,255,0.06);
          color: #fff;
        }
        .adm-nav-item.on {
          background: linear-gradient(135deg, #E85A8C, #C33A6E);
          color: #fff;
          font-weight: 700;
          box-shadow: 0 4px 12px rgba(232,90,140,0.25);
        }
        .adm-nav-label { flex: 1; }
        .adm-nav-badge {
          min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px;
          background: #fff; color: #C33A6E; font-size: 11px; font-weight: 900;
          display: inline-flex; align-items: center; justify-content: center;
        }

        /* Bottom sidebar */
        .adm-sidebar-bottom {
          padding: 12px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .adm-user {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          background: rgba(255,255,255,0.04);
          margin-bottom: 8px;
        }
        .adm-user-avt {
          width: 32px; height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #FCE0E9, #E85A8C);
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          font-size: 13px;
          font-weight: 900;
          flex-shrink: 0;
        }
        .adm-user-info { flex: 1; min-width: 0; }
        .adm-user-name { font-size: 12px; font-weight: 800; color: #fff; text-transform: capitalize; }
        .adm-user-mail { font-size: 10px; color: #9CA3AF; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .adm-side-btn {
          display: flex; align-items: center; gap: 8px;
          width: 100%;
          padding: 8px 12px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: #9CA3AF;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          text-align: left;
          margin-top: 2px;
          transition: all 0.15s;
        }
        .adm-side-btn:hover { background: rgba(255,255,255,0.06); color: #fff; }
        .adm-side-btn.danger { color: #F87171; }
        .adm-side-btn.danger:hover { background: rgba(248,113,113,0.1); color: #FCA5A5; }

        /* ═══════════ Main ═══════════ */
        .adm-main {
          margin-left: 260px;
          flex: 1;
          min-width: 0;
          min-height: 100vh;
          padding: 28px 32px 48px;
        }
        /* Páginas que já tinham padding próprio passam a usar o do layout */
        .adm-main .an-root, .adm-main .ab-root, .adm-main .aa-root, .adm-main .ai-root { padding: 0; }

        /* ═══════════ Mobile ═══════════ */
        .adm-mobile-header {
          display: none;
          position: fixed; top: 0; left: 0; right: 0;
          z-index: 30;
          background: #1A1418;
          padding: 12px 16px;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        /* Barra inferior + folha "Mais" (só mobile) */
        .adm-bnav { display: none; }
        .adm-bnav-it {
          flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
          background: none; border: none; cursor: pointer; padding: 0;
          font-family: inherit; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.62);
        }
        .adm-bnav-it.on { color: #F28AB0; font-weight: 800; }
        .adm-bnav-ic { position: relative; display: flex; }
        .adm-bnav-badge {
          position: absolute; top: -5px; right: -10px;
          min-width: 17px; height: 17px; padding: 0 4px; border-radius: 9px;
          background: #E85A8C; color: #fff; font-size: 10px; font-weight: 900;
          display: flex; align-items: center; justify-content: center; border: 2px solid #1A1418;
        }
        .adm-sheet-ov { position: fixed; top: 0; left: 0; right: 0; bottom: calc(64px + env(safe-area-inset-bottom, 0px)); z-index: 40; background: rgba(20,10,15,0.45); }
        .adm-sheet {
          position: fixed; left: 0; right: 0;
          bottom: calc(64px + env(safe-area-inset-bottom, 0px));
          max-height: 75vh; overflow-y: auto;
          background: #fff; border-radius: 20px 20px 0 0; padding: 10px 12px 12px;
          animation: admSheetIn 0.2s ease-out;
        }
        @keyframes admSheetIn { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
        .adm-sheet-grab { width: 38px; height: 4px; border-radius: 2px; background: #E5DDE0; margin: 0 auto 10px; }
        .adm-sheet-hdr { display: flex; align-items: center; justify-content: space-between; padding: 0 6px 8px; }
        .adm-sheet-hdr b { font-size: 16px; font-weight: 800; color: #2C1219; }
        .adm-sheet-x { width: 32px; height: 32px; border-radius: 8px; border: none; background: #F5F0F2; color: #2C1219; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .adm-sheet-it {
          display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 8px;
          border: none; border-radius: 10px; background: none; cursor: pointer; text-align: left;
          font-family: inherit; color: #9CA3AF;
        }
        .adm-sheet-it:active, .adm-sheet-it.on { background: #FAF7F8; }
        .adm-sheet-ic { width: 36px; height: 36px; border-radius: 10px; background: #F5F0F2; color: #2C1219; display: flex; align-items: center; justify-content: center; }
        .adm-sheet-it.on .adm-sheet-ic { background: #FCE0E9; color: #C33A6E; }
        .adm-sheet-l { flex: 1; font-size: 14px; font-weight: 700; color: #2C1219; }
        .adm-sheet-sep { height: 1px; background: #F3ECEE; margin: 8px 6px; }
        .adm-sheet-foot { display: flex; gap: 8px; padding: 4px 6px 2px; }
        .adm-sheet-foot button {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; height: 42px;
          border: none; border-radius: 10px; background: #F5F0F2; color: #2C1219; cursor: pointer;
          font-family: inherit; font-size: 13px; font-weight: 700;
        }
        .adm-sheet-foot button.danger { color: #DC2626; background: #FEF2F2; }

        @media (max-width: 768px) {
          .adm-sidebar { display: none; }
          .adm-mobile-header { display: flex; padding-top: calc(12px + env(safe-area-inset-top, 0px)); }
          .adm-main {
            margin-left: 0;
            padding: calc(62px + 20px + env(safe-area-inset-top, 0px)) 16px calc(64px + 24px + env(safe-area-inset-bottom, 0px));
          }
          .adm-bnav {
            display: flex; justify-content: space-around; align-items: flex-start;
            position: fixed; left: 0; right: 0; bottom: 0; z-index: 35;
            height: calc(64px + env(safe-area-inset-bottom, 0px));
            padding: 9px 4px env(safe-area-inset-bottom, 0px);
            background: #1A1418;
          }
        }
      `}</style>
    </div>
  );
}

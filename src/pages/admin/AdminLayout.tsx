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
      { path: "/admin", label: "Dashboard", icon: <ChartLine size={20} weight="bold" /> },
      { path: "/admin/usuarios", label: "Usuários", icon: <UsersThree size={20} weight="bold" /> },
    ],
  },
  {
    title: "Conteúdo",
    items: [
      { path: "/admin/noticias", label: "Notícias", icon: <Newspaper size={20} weight="bold" /> },
      { path: "/admin/autores", label: "Autores", icon: <PenNib size={20} weight="bold" /> },
      { path: "/admin/banner", label: "Banner do celular", icon: <ImageIcon size={20} weight="bold" /> },
    ],
  },
  {
    title: "Biblioteca",
    items: [
      { path: "/admin/receitas", label: "Receitas da comunidade", icon: <Cake size={20} weight="bold" /> },
      { path: "/admin/receitas-doonly", label: "Receitas Doonly", icon: <Medal size={20} weight="bold" /> },
      { path: "/admin/pdfs", label: "Biblioteca de PDFs", icon: <FilePdf size={20} weight="bold" /> },
    ],
  },
  {
    title: "Comunicação",
    items: [
      { path: "/admin/notificacoes", label: "Notificações", icon: <Bell size={20} weight="bold" /> },
      { path: "/admin/ideias", label: "Ideias", icon: <Lightbulb size={20} weight="bold" /> },
    ],
  },
  {
    title: "Análise",
    items: [
      { path: "/admin/relatorios", label: "Relatórios", icon: <ChartBar size={20} weight="bold" /> },
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
        <ArrowLeft size={20} weight="bold" />
        <span>Voltar ao app</span>
      </button>
      <button className="adm-side-btn danger" onClick={handleLogout}>
        <SignOut size={20} weight="bold" />
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
            <span className="adm-brand-role">Painel administrativo</span>
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
              <button onClick={() => navigate("/inicio")}><ArrowLeft size={20} weight="bold" /> Voltar ao app</button>
              <button className="danger" onClick={handleLogout}><SignOut size={20} weight="bold" /> Sair</button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="adm-main">
        <Outlet />
      </main>

      <style>{`
        /* Painel admin (09/10 · 3.62): mesmas cores e medidas do app (menu vinho escuro, tokens --ui-*) */
        .adm-root, .adm-root * { box-sizing: border-box; }
        .adm-root { display: flex; min-height: 100vh; font-family: var(--font-base); background: var(--ui-fundo); color: var(--ui-texto); }

        /* Menu do computador */
        .adm-sidebar { position: fixed; top: 0; bottom: 0; left: 0; z-index: 30; display: flex; flex-direction: column; width: 260px; background: #1F0711; }
        .adm-sidebar-top { display: flex; align-items: center; gap: 12px; padding: 20px; border-bottom: 1px solid rgba(255,255,255,.08); }
        .adm-logo-square { flex: none; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; overflow: hidden; border-radius: 12px; background: var(--ui-rosa); }
        .adm-logo-square img { width: 26px; height: 26px; object-fit: contain; filter: brightness(0) invert(1); }
        .adm-logo-square--sm { width: 36px; height: 36px; }
        .adm-logo-square--sm img { width: 22px; height: 22px; }
        .adm-brand { display: flex; flex-direction: column; min-width: 0; }
        .adm-brand-name { font-size: 16px; font-weight: 800; line-height: 1.15; color: #fff; }
        .adm-brand-role { font-size: 12px; font-weight: 500; color: rgba(255,255,255,.6); }
        .adm-nav { flex: 1; padding: 8px 12px 20px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.15) transparent; }
        .adm-nav-section { margin-bottom: 4px; }
        .adm-nav-sec-title { margin: 0; padding: 16px 12px 6px; font-size: 12px; font-weight: 700; color: rgba(255,255,255,.5); }
        .adm-nav-item { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px; margin-bottom: 2px; padding: 0 12px; border: 0; border-radius: var(--ui-raio); background: none; color: rgba(255,255,255,.75); font-family: inherit; font-size: 14px; font-weight: 500; text-align: left; cursor: pointer; transition: background .15s, color .15s; }
        .adm-nav-icon { display: flex; align-items: center; justify-content: center; width: 20px; }
        .adm-nav-icon svg { width: 20px; height: 20px; }
        .adm-nav-item:hover { background: rgba(255,255,255,.07); color: #fff; }
        .adm-nav-item.on { background: rgba(255,255,255,.12); color: #fff; font-weight: 700; }
        .adm-nav-item.on .adm-nav-icon { color: #F28AB0; }
        .adm-nav-label { flex: 1; }
        .adm-nav-badge { min-width: 22px; height: 22px; padding: 0 6px; border-radius: 99px; background: var(--ui-rosa); color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
        .adm-sidebar-bottom { padding: 12px; border-top: 1px solid rgba(255,255,255,.08); }
        .adm-user { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; padding: 10px; border-radius: var(--ui-raio); background: rgba(255,255,255,.06); }
        .adm-user-avt { flex: none; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: var(--ui-rosa); color: #fff; font-size: 15px; font-weight: 700; }
        .adm-user-info { min-width: 0; flex: 1; }
        .adm-user-name { font-size: 14px; font-weight: 700; color: #fff; text-transform: capitalize; }
        .adm-user-mail { font-size: 12px; color: rgba(255,255,255,.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .adm-side-btn { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; padding: 0 12px; border: 0; border-radius: var(--ui-raio); background: none; color: rgba(255,255,255,.75); font-family: inherit; font-size: 14px; font-weight: 500; cursor: pointer; }
        .adm-side-btn:hover { background: rgba(255,255,255,.07); color: #fff; }
        .adm-side-btn.danger { color: #FCA5A5; }

        /* Conteúdo */
        .adm-main { flex: 1; min-width: 0; min-height: 100vh; margin-left: 260px; padding: 28px 32px 48px; }
        .adm-main > * { max-width: 1200px; }
        .adm-main .an-root, .adm-main .ab-root, .adm-main .aa-root, .adm-main .ai-root { padding: 0; }

        /* Celular: topo, barra de baixo e folha "Mais" */
        .adm-mobile-header { display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 30; align-items: center; gap: 12px; padding: 12px 16px; background: #1F0711; }
        .adm-bnav { display: none; }
        .adm-bnav-it { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 56px; padding: 0; border: 0; background: none; color: rgba(255,255,255,.62); font-family: inherit; font-size: 12px; font-weight: 500; cursor: pointer; }
        .adm-bnav-it.on { color: #fff; font-weight: 700; }
        .adm-bnav-it.on .adm-bnav-ic { color: #F28AB0; }
        .adm-bnav-ic { position: relative; display: flex; }
        .adm-bnav-badge { position: absolute; top: -6px; right: -12px; min-width: 20px; height: 20px; padding: 0 5px; border: 2px solid #1F0711; border-radius: 99px; background: var(--ui-rosa); color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
        .adm-sheet-ov { position: fixed; top: 0; left: 0; right: 0; bottom: calc(60px + env(safe-area-inset-bottom, 0px)); z-index: 40; background: var(--ui-veu); }
        .adm-sheet { position: fixed; left: 0; right: 0; bottom: calc(60px + env(safe-area-inset-bottom, 0px)); max-height: 75vh; overflow-y: auto; padding: 10px 12px 12px; border-radius: 24px 24px 0 0; background: var(--ui-branco); animation: admSheetIn .2s ease-out; }
        @keyframes admSheetIn { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
        .adm-sheet-grab { width: 40px; height: 4px; margin: 0 auto 10px; border-radius: 9px; background: #E5DDE1; }
        .adm-sheet-hdr { display: flex; align-items: center; justify-content: space-between; padding: 0 6px 8px; }
        .adm-sheet-hdr b { font-size: 18px; font-weight: 800; }
        .adm-sheet-x { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border: 0; border-radius: var(--ui-raio); background: none; color: var(--ui-texto-2); cursor: pointer; }
        .adm-sheet-x svg { width: 20px; height: 20px; }
        .adm-sheet-it { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 8px; border: 0; border-radius: var(--ui-raio); background: none; color: var(--ui-texto-3); font-family: inherit; text-align: left; cursor: pointer; }
        .adm-sheet-it:active, .adm-sheet-it.on { background: var(--ui-linha); }
        .adm-sheet-ic { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--ui-raio); background: var(--ui-cinza); color: var(--ui-texto-2); }
        .adm-sheet-it.on .adm-sheet-ic { background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); }
        .adm-sheet-l { flex: 1; font-size: 15px; font-weight: 700; color: var(--ui-texto); }
        .adm-sheet-sep { height: 1px; margin: 8px 6px; background: var(--ui-linha); }
        .adm-sheet-foot { display: flex; gap: 8px; padding: 4px 6px 2px; }
        .adm-sheet-foot button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 48px; border: 0; border-radius: var(--ui-raio-botao); background: var(--ui-cinza); color: var(--ui-texto); font-family: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
        .adm-sheet-foot button.danger { background: var(--ui-vermelho-fundo); color: var(--ui-vermelho-escuro); }

        @media (max-width: 768px) {
          .adm-sidebar { display: none; }
          .adm-mobile-header { display: flex; padding-top: calc(12px + env(safe-area-inset-top, 0px)); }
          .adm-main { margin-left: 0; padding: calc(60px + 20px + env(safe-area-inset-top, 0px)) 16px calc(60px + 24px + env(safe-area-inset-bottom, 0px)); }
          .adm-bnav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 35; display: flex; justify-content: space-around; align-items: stretch; height: calc(60px + env(safe-area-inset-bottom, 0px)); padding: 2px 4px env(safe-area-inset-bottom, 0px); background: #1F0711; }
        }
      `}</style>
    </div>
  );
}

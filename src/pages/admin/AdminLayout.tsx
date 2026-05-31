import { useState, useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const menuItems = [
  { path: "/admin", label: "Dashboard", emoji: "📊" },
  { path: "/admin/usuarios", label: "Usuários", emoji: "👥" },
  { path: "/admin/receitas", label: "Receitas Comunidade", emoji: "👩‍🍳" },
  { path: "/admin/receitas-doonly", label: "Receitas Doonly", emoji: "🏅" },
  { path: "/admin/pdfs", label: "Biblioteca PDF", emoji: "📄" },
  { path: "/admin/notificacoes", label: "Notificações", emoji: "🔔" },
  { path: "/admin/relatorios", label: "Relatórios", emoji: "📈" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const check = async () => {
      const ADMIN_EMAILS = ["gestao@doonly.com.br"];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/admin/login"); setLoading(false); return; }
      if (ADMIN_EMAILS.includes(session.user.email || "")) {
        setAuthorized(true);
      } else {
        navigate("/admin/login");
      }
      setLoading(false);
    };
    check();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "Inter, sans-serif", color: "#9ca3af" }}>
      Verificando acesso...
    </div>
  );

  if (!authorized) return null;

  return (
    <div className="adm-root">
      {/* Sidebar desktop */}
      <aside className="adm-sidebar">
        <div className="adm-sidebar-logo">
          <img src="/logoapp.png" alt="Doonly" style={{ height: "48px", objectFit: "contain" }} />
          <span className="adm-admin-badge">Admin</span>
        </div>

        <nav className="adm-nav">
          {menuItems.map(item => (
            <button key={item.path} className={`adm-nav-item ${location.pathname === item.path ? "active" : ""}`}
              onClick={() => navigate(item.path)}>
              <span className="adm-nav-emoji">{item.emoji}</span>
              <span className="adm-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="adm-sidebar-bottom">
          <button className="adm-app-btn" onClick={() => navigate("/inicio")}>
            ← Voltar ao app
          </button>
          <button className="adm-logout-btn" onClick={handleLogout}>Sair</button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="adm-mobile-header">
        <img src="/logoapp.png" alt="Doonly" style={{ height: "36px", objectFit: "contain" }} />
        <span className="adm-admin-badge">Admin</span>
        <button className="adm-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="adm-drawer-overlay" onClick={() => setMenuOpen(false)}>
          <div className="adm-drawer" onClick={e => e.stopPropagation()}>
            {menuItems.map(item => (
              <button key={item.path} className={`adm-nav-item ${location.pathname === item.path ? "active" : ""}`}
                onClick={() => { navigate(item.path); setMenuOpen(false); }}>
                <span className="adm-nav-emoji">{item.emoji}</span>
                <span className="adm-nav-label">{item.label}</span>
              </button>
            ))}
            <button className="adm-app-btn" style={{ marginTop: "1rem" }} onClick={() => navigate("/inicio")}>← Voltar ao app</button>
            <button className="adm-logout-btn" onClick={handleLogout}>Sair</button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="adm-main">
        <Outlet />
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .adm-root { display: flex; min-height: 100vh; font-family: 'Inter', sans-serif; background: #f9fafb; }

        /* Sidebar */
        .adm-sidebar { width: 240px; min-height: 100vh; background: #181419; display: flex; flex-direction: column; position: fixed; left: 0; top: 0; z-index: 30; }
        .adm-sidebar-logo { display: flex; align-items: center; gap: 0.75rem; padding: 1.25rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .adm-admin-badge { background: linear-gradient(135deg, #f9007a, #d4006a); color: white; font-size: 0.65rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 20px; letter-spacing: 0.5px; }

        .adm-nav { flex: 1; padding: 1rem 0.75rem; display: flex; flex-direction: column; gap: 0.25rem; }
        .adm-nav-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.7rem 0.9rem; border-radius: 10px; border: none; background: none; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 0.85rem; font-weight: 500; color: rgba(255,255,255,0.6); width: 100%; text-align: left; transition: all 0.15s; }
        .adm-nav-item:hover { background: rgba(255,255,255,0.06); color: white; }
        .adm-nav-item.active { background: rgba(249,0,122,0.15); color: #f9007a; border-left: 3px solid #f9007a; padding-left: calc(0.9rem - 3px); }
        .adm-nav-emoji { font-size: 1rem; }
        .adm-nav-label { font-size: 0.83rem; }

        .adm-sidebar-bottom { padding: 1rem 0.75rem; border-top: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 0.5rem; }
        .adm-app-btn { padding: 0.6rem 0.9rem; background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); border: none; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 0.8rem; font-weight: 500; cursor: pointer; text-align: left; transition: background 0.15s; }
        .adm-app-btn:hover { background: rgba(255,255,255,0.12); }
        .adm-logout-btn { padding: 0.6rem 0.9rem; background: rgba(239,68,68,0.1); color: #ef4444; border: none; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 0.8rem; font-weight: 600; cursor: pointer; text-align: left; }

        .adm-main { margin-left: 240px; flex: 1; padding: 2rem; min-height: 100vh; }

        /* Mobile */
        .adm-mobile-header { display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 30; background: #181419; padding: 0.75rem 1rem; align-items: center; gap: 0.75rem; }
        .adm-menu-btn { margin-left: auto; background: none; border: none; cursor: pointer; }
        .adm-drawer-overlay { position: fixed; inset: 0; z-index: 40; background: rgba(0,0,0,0.5); }
        .adm-drawer { position: fixed; left: 0; top: 0; bottom: 0; width: 260px; background: #181419; padding: 1.5rem 0.75rem; display: flex; flex-direction: column; gap: 0.25rem; overflow-y: auto; }

        @media (max-width: 768px) {
          .adm-sidebar { display: none; }
          .adm-mobile-header { display: flex; }
          .adm-main { margin-left: 0; padding: 1rem; padding-top: 4.5rem; }
        }
      `}</style>
    </div>
  );
}

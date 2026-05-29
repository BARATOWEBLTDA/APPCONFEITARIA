import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabase";

const menuItems = [
  { label: "Dashboard", path: "/dashboard", emoji: "📊" },
  { label: "Cardápio / Loja", path: "/cardapio-config", emoji: "🛍️" },
  { label: "Pedidos", path: "/pedidos", emoji: "📋" },
  { label: "Clientes", path: "/clientes", emoji: "👥" },
  { label: "Produtos", path: "/produtos", emoji: "🎂" },
  { label: "Estoque", path: "/estoque", emoji: "📦" },
  { label: "Financeiro", path: "/financeiro", emoji: "💰" },
  { label: "Receitas", path: "/receitas", emoji: "📄" },
  { label: "Arquivos", path: "/arquivos", emoji: "🗂️" },
  { label: "Promoções", path: "/promocoes", emoji: "🏷️" },
  { label: "Configurações", path: "/configuracoes", emoji: "⚙️" },
];

export default function Layout() {
  const navigate = useNavigate();
  const { profile } = useProfile();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="layout-root">
      {/* Sidebar Desktop */}
      <aside className="sidebar">
        <div className="sidebar-profile">
          <div className="sidebar-avatar">
            {profile?.foto_url ? (
              <img src={profile.foto_url} alt="Foto de perfil" />
            ) : (
              <div className="sidebar-avatar-placeholder">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            )}
          </div>
          <div className="sidebar-profile-info">
            <span className="sidebar-name">{profile?.nome || "Minha Conta"}</span>
            <span className="sidebar-loja">{profile?.nome_loja || "Minha Confeitaria"}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              <span className="nav-emoji">{item.emoji}</span> {item.label}
            </NavLink>
          ))}
        </nav>

        <button className="logout-btn" onClick={handleLogout}>
          Sair
        </button>
      </aside>

      {/* Conteúdo principal */}
      <main className="layout-main">
        <Outlet />
      </main>

      {/* Bottom nav Mobile */}
      <nav className="bottom-nav">
        {menuItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `bottom-item ${isActive ? "active" : ""}`}
          >
            {item.label}
          </NavLink>
        ))}
        <button className="bottom-item bottom-more" onClick={() => {}}>
          ···
        </button>
      </nav>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .layout-root {
          display: flex;
          min-height: 100vh;
          font-family: 'DM Sans', sans-serif;
          background: #fafafa;
        }

        /* ── SIDEBAR DESKTOP ── */
        .sidebar {
          width: 220px;
          min-height: 100vh;
          background: #181419;
          border-right: none;
          display: flex;
          flex-direction: column;
          padding: 1.5rem 1rem;
          position: fixed;
          top: 0; left: 0; bottom: 0;
          z-index: 10;
          box-shadow: 4px 0 20px rgba(0,0,0,0.15);
        }

        .sidebar-profile {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid rgba(249,0,122,0.2);
        }

        .sidebar-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid rgba(249,0,122,0.4);
          background: rgba(249,0,122,0.1);
          flex-shrink: 0;
        }

        .sidebar-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .sidebar-avatar-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f9007a;
        }

        .sidebar-profile-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .sidebar-name {
          font-size: 0.88rem;
          font-weight: 600;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sidebar-loja {
          font-size: 0.75rem;
          color: #9ca3af;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          flex: 1;
        }

        .nav-emoji { font-size: 0.95rem; margin-right: 0.1rem; }

        .nav-item {
          padding: 0.7rem 1rem;
          border-radius: 10px;
          font-size: 0.92rem;
          font-weight: 500;
          color: #9ca3af;
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
        }

        .nav-item:hover {
          background: #f9007a;
          color: #ffffff;
        }

        .nav-item.active {
          background: #f9007a;
          color: #ffffff;
          font-weight: 600;
          border-left: 3px solid #ff6eb4;
        }

        .logout-btn {
          margin-top: 1rem;
          padding: 0.7rem 1rem;
          border-radius: 10px;
          border: 1px solid rgba(249,0,122,0.3);
          background: transparent;
          color: #f9007a;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.92rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
          text-align: left;
        }

        .logout-btn:hover {
          background: rgba(249,0,122,0.12);
        }

        /* ── MAIN CONTENT ── */
        .layout-main {
          margin-left: 220px;
          flex: 1;
          padding: 2rem;
          min-height: 100vh;
        }

        /* ── BOTTOM NAV MOBILE ── */
        .bottom-nav {
          display: none;
        }

        @media (max-width: 768px) {
          .sidebar { display: none; }

          .layout-main {
            margin-left: 0;
            padding: 1rem;
            padding-bottom: 5rem;
          }

          .bottom-nav {
            display: flex;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            z-index: 10;
            background: #181419;
            border-top: 1px solid rgba(249,0,122,0.2);
            padding: 0.5rem 0.25rem;
            justify-content: space-around;
            align-items: center;
            box-shadow: 0 -2px 12px rgba(249, 0, 122, 0.08);
          }

          .bottom-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex: 1;
            padding: 0.4rem 0.2rem;
            font-size: 0.72rem;
            font-weight: 500;
            color: #6b7280;
            text-decoration: none;
            border-radius: 8px;
            transition: color 0.15s;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            background: none;
            border: none;
            cursor: pointer;
            font-family: 'DM Sans', sans-serif;
          }

          .bottom-item.active {
            color: #f9007a;
            font-weight: 600;
          }

          .bottom-item:hover {
            color: #f9007a;
          }

          .bottom-more {
            letter-spacing: 2px;
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
}

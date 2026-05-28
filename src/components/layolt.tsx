import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const menuItems = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Pedidos", path: "/pedidos" },
  { label: "Produtos", path: "/produtos" },
  { label: "Clientes", path: "/clientes" },
  { label: "Financeiro", path: "/financeiro" },
  { label: "Promoções", path: "/promocoes" },
  { label: "Cardápio", path: "/cardapio-config" },
  { label: "Configurações", path: "/configuracoes" },
];

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="layout-root">
      {/* Sidebar Desktop */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="https://www.pandamenu.com.br/imagemmenu.png" alt="Panda Menu" />
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              {item.label}
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
          background: #ffffff;
          border-right: 1px solid #fce7f3;
          display: flex;
          flex-direction: column;
          padding: 1.5rem 1rem;
          position: fixed;
          top: 0; left: 0; bottom: 0;
          z-index: 10;
        }

        .sidebar-logo {
          display: flex;
          justify-content: center;
          margin-bottom: 2rem;
        }

        .sidebar-logo img {
          height: 55px;
          object-fit: contain;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          flex: 1;
        }

        .nav-item {
          padding: 0.7rem 1rem;
          border-radius: 10px;
          font-size: 0.92rem;
          font-weight: 500;
          color: #6b7280;
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
        }

        .nav-item:hover {
          background: #fff0f6;
          color: #f9007a;
        }

        .nav-item.active {
          background: #fff0f6;
          color: #f9007a;
          font-weight: 600;
          border-left: 3px solid #f9007a;
        }

        .logout-btn {
          margin-top: 1rem;
          padding: 0.7rem 1rem;
          border-radius: 10px;
          border: 1.5px solid #fce7f3;
          background: white;
          color: #f9007a;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.92rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
          text-align: left;
        }

        .logout-btn:hover {
          background: #fff0f6;
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
            background: #ffffff;
            border-top: 1px solid #fce7f3;
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
            color: #9ca3af;
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
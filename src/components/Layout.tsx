import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
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
  const [now, setNow] = useState(new Date());
  const [gestaoOpen, setGestaoOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  const formatTime = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="layout-root">
      {/* Sidebar Desktop */}
      <aside className="sidebar">
        <div className="sidebar-profile">
          <div className="sidebar-avatar-ring">
            <div className="sidebar-avatar">
              {profile?.foto_url ? (
                <img src={profile.foto_url} alt="Foto de perfil" />
              ) : (
                <div className="sidebar-avatar-placeholder">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
              )}
            </div>
          </div>
          <div className="sidebar-profile-info">
            <span className="sidebar-ola">Olá, {profile?.nome ? profile.nome.split(" ")[0] : "bem-vinda"} 👋</span>
            <span className="sidebar-datetime">{formatDate(now)}</span>
            <span className="sidebar-datetime">{formatTime(now)}</span>
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

      {/* Gestão Drawer */}
      {gestaoOpen && (
        <div className="gestao-overlay" onClick={() => setGestaoOpen(false)}>
          <div className="gestao-drawer" onClick={e => e.stopPropagation()}>
            <div className="gestao-handle" />
            <h3 className="gestao-title">Gestão</h3>
            <div className="gestao-grid">
              {[
                { label: "Pedidos", path: "/pedidos", icon: "📋" },
                { label: "Clientes", path: "/clientes", icon: "👥" },
                { label: "Estoque", path: "/estoque", icon: "📦" },
                { label: "Produtos", path: "/produtos", icon: "🎂" },
                { label: "Financeiro", path: "/financeiro", icon: "💰" },
                { label: "Promoções", path: "/promocoes", icon: "🏷️" },
              ].map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className="gestao-item"
                  onClick={() => setGestaoOpen(false)}
                >
                  <span className="gestao-icon">{item.icon}</span>
                  <span className="gestao-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav Mobile */}
      <nav className="bottom-nav">
        <NavLink to="/dashboard" className={({ isActive }) => `bottom-item ${isActive ? "active" : ""}`}>
          <span className="bottom-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </span>
          <span>Início</span>
        </NavLink>

        <button className={`bottom-item ${gestaoOpen ? "active" : ""}`} onClick={() => setGestaoOpen(!gestaoOpen)}>
          <span className="bottom-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
          </span>
          <span>Gestão</span>
        </button>

        <NavLink to="/cardapio-config" className={({ isActive }) => `bottom-item ${isActive ? "active" : ""}`}>
          <span className="bottom-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </span>
          <span>Cardápio</span>
        </NavLink>

        <NavLink to="/receitas" className={({ isActive }) => `bottom-item ${isActive ? "active" : ""}`}>
          <span className="bottom-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </span>
          <span>Receitas</span>
        </NavLink>
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
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          margin-top: 2rem;
          margin-bottom: 1.5rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid rgba(249,0,122,0.2);
        }

        /* Anel externo com degradê animado */
        .sidebar-avatar-ring {
          width: 88px;
          height: 88px;
          border-radius: 50%;
          padding: 3px;
          background: linear-gradient(135deg, #f9007a, #ff6eb4, #ffb3d9, #f9007a);
          background-size: 300% 300%;
          animation: gradientRing 3s ease infinite;
          flex-shrink: 0;
        }

        @keyframes gradientRing {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        /* Borda branca interna */
        .sidebar-avatar {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          overflow: hidden;
          border: 3px solid #ffffff;
          background: rgba(249,0,122,0.1);
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
          align-items: center;
          text-align: center;
          overflow: hidden;
          width: 100%;
        }

        .sidebar-ola {
          font-size: 0.92rem;
          font-weight: 600;
          color: #ffffff;
          text-align: center;
          width: 100%;
        }

        .sidebar-datetime {
          font-size: 0.75rem;
          color: #9ca3af;
          text-align: center;
          width: 100%;
          letter-spacing: 0.3px;
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
            z-index: 20;
            background: #181419;
            border-top: 1px solid rgba(249,0,122,0.15);
            padding: 0.4rem 0.5rem 1rem;
            justify-content: space-around;
            align-items: flex-end;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
          }

          .bottom-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex: 1;
            gap: 0.2rem;
            font-size: 0.68rem;
            font-weight: 500;
            color: #6b7280;
            text-decoration: none;
            padding: 0.5rem 0.25rem 0.2rem;
            transition: color 0.3s;
            background: none;
            border: none;
            cursor: pointer;
            font-family: 'DM Sans', sans-serif;
            position: relative;
          }

          .bottom-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 48px; height: 48px;
            border-radius: 50%;
            background: transparent;
            transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
            position: relative;
            z-index: 1;
          }

          /* Item ativo: bolha sobe para fora da barra */
          .bottom-item.active {
            color: #ffffff;
            font-weight: 600;
          }

          .bottom-item.active .bottom-icon {
            background: #181419;
            border: 3px solid #181419;
            box-shadow:
              0 0 0 3px #f9007a,
              0 -8px 24px rgba(249,0,122,0.4);
            transform: translateY(-22px);
          }

          .bottom-item.active svg { stroke: #f9007a; }

          /* Curva na barra atrás do ícone ativo */
          .bottom-item.active::before {
            content: '';
            position: absolute;
            top: -2px;
            left: 50%;
            transform: translateX(-50%);
            width: 64px;
            height: 32px;
            background: #181419;
            border-radius: 0 0 40px 40px;
            z-index: 0;
          }

          .bottom-item:not(.active) svg { stroke: #6b7280; }
          .bottom-item:not(.active):hover { color: #f9007a; }
          .bottom-item:not(.active):hover svg { stroke: #f9007a; }

          /* Gestão Drawer */
          .gestao-overlay {
            position: fixed; inset: 0; z-index: 30;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
            animation: fadeIn 0.2s ease;
          }

          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

          .gestao-drawer {
            position: absolute;
            bottom: 0; left: 0; right: 0;
            background: #1e1a1f;
            border-radius: 24px 24px 0 0;
            padding: 1rem 1.25rem 2rem;
            animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            border-top: 1px solid rgba(249,0,122,0.2);
          }

          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }

          .gestao-handle {
            width: 40px; height: 4px;
            background: rgba(255,255,255,0.2);
            border-radius: 2px;
            margin: 0 auto 1rem;
          }

          .gestao-title {
            font-size: 1rem; font-weight: 600;
            color: #ffffff; margin-bottom: 1rem;
            font-family: 'DM Sans', sans-serif;
          }

          .gestao-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0.75rem;
          }

          .gestao-item {
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 0.4rem;
            background: rgba(255,255,255,0.06);
            border-radius: 16px;
            padding: 1rem 0.5rem;
            text-decoration: none;
            transition: background 0.15s, transform 0.15s;
            border: 1px solid rgba(255,255,255,0.06);
          }

          .gestao-item:hover, .gestao-item:active {
            background: rgba(249,0,122,0.15);
            border-color: rgba(249,0,122,0.3);
            transform: scale(0.97);
          }

          .gestao-icon { font-size: 1.6rem; }

          .gestao-label {
            font-size: 0.75rem; font-weight: 500;
            color: #ffffff; text-align: center;
            font-family: 'DM Sans', sans-serif;
          }
        }
      `}</style>
    </div>
  );
}

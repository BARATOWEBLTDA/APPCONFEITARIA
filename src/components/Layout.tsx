import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Home, BookOpen, Users, UtensilsCrossed, Menu } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabase";

const menuItems = [
  { label: "Início", path: "/inicio", emoji: "🏠" },
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
  const [notifCount, setNotifCount] = useState(0);
  const location = useLocation();
  const isReceitas = location.pathname === "/receitas";

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadNotifCount = async () => {
      const { data } = await supabase.from("notificacoes").select("created_at").order("created_at", { ascending: false });
      if (!data || data.length === 0) return;
      const lastSeen = localStorage.getItem("notif_last_seen");
      if (!lastSeen) {
        setNotifCount(data.length);
      } else {
        const unseen = data.filter(n => new Date(n.created_at) > new Date(lastSeen));
        setNotifCount(unseen.length);
      }
    };
    loadNotifCount();
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
            <span className="sidebar-ola">Olá, {profile?.nome ? profile.nome.split(" ")[0] : "bem-vinda"}</span>
            <span className="sidebar-datetime">{formatDate(now)} · {formatTime(now)}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <span className="nav-emoji">{item.emoji}</span> {item.label}
            </NavLink>
          ))}
        </nav>

        <a href="/assinar" style={{display:"block",margin:"0 0.6rem 0.8rem",background:"linear-gradient(135deg,#F471B6,#f9007a)",borderRadius:"14px",padding:"0.9rem 1rem",textDecoration:"none",boxShadow:"0 4px 16px rgba(249,0,122,0.35)"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.35rem"}}>
            <span style={{fontSize:"0.85rem"}}>⏱️</span>
            <span style={{fontSize:"0.75rem",fontWeight:700,color:"white",letterSpacing:"0.02em"}}>Período de teste</span>
          </div>
          <p style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.8)",margin:"0 0 0.6rem"}}>14 dias restantes</p>
          <div style={{background:"rgba(255,255,255,0.25)",borderRadius:"8px",padding:"0.45rem",textAlign:"center",fontSize:"0.78rem",fontWeight:700,color:"white"}}>
            Fazer upgrade ✨
          </div>
        </a>
      </aside>

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
                { label: "Dashboard", path: "/dashboard", icon: "📊" },
                { label: "Pedidos", path: "/pedidos", icon: "📋" },
                { label: "Produtos", path: "/produtos", icon: "🎂" },
                { label: "Estoque", path: "/estoque", icon: "📦" },
                { label: "Financeiro", path: "/financeiro", icon: "💰" },
                { label: "Promoções", path: "/promocoes", icon: "🏷️" },
                { label: "Arquivos", path: "/arquivos", icon: "🗂️" },
                { label: "Configurações", path: "/configuracoes", icon: "⚙️" },
              ].map((item) => (
                <NavLink key={item.path} to={item.path} className="gestao-item" onClick={() => setGestaoOpen(false)}>
                  <span className="gestao-icon">{item.icon}</span>
                  <span className="gestao-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile top header */}
      <div className="mob-top-header">
        <img src="/logoheader.png" alt="Doonly" className="mob-top-logo" />
        <div className="mob-top-icons">
          <button className="mob-top-icon" onClick={() => navigate("/configuracoes")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <button className="mob-top-icon" onClick={() => {
              localStorage.setItem("notif_last_seen", new Date().toISOString());
              setNotifCount(0);
              navigate("/notificacoes");
            }} style={{position:"relative"}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            {notifCount > 0 && (
              <span style={{
                position:"absolute", top:"-4px", right:"-4px",
                background:"#ef4444", color:"white",
                fontSize:"0.6rem", fontWeight:700,
                width:"16px", height:"16px", borderRadius:"50%",
                display:"flex", alignItems:"center", justifyContent:"center",
                border:"2px solid #f9007a", lineHeight:1
              }}>{notifCount > 9 ? "9+" : notifCount}</span>
            )}
          </button>
          <button className="mob-top-icon" onClick={() => navigate("/configuracoes")}>
            {profile?.foto_url
              ? <img src={profile.foto_url} alt="perfil" style={{width:"28px",height:"28px",borderRadius:"50%",objectFit:"cover",border:"2px solid white"}} />
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }
          </button>
        </div>
      </div>

      {/* Bottom nav Mobile */}
      {!isReceitas && (
        <nav className="bottom-nav">
          <NavLink to="/inicio" className={({ isActive }) => `bottom-item ${isActive ? "active" : ""}`}>
            <Home size={22} />
            <span className="nav-label">Início</span>
          </NavLink>
          <NavLink to="/receitas" className={({ isActive }) => `bottom-item ${isActive ? "active" : ""}`}>
            <BookOpen size={22} />
            <span className="nav-label">Receitas</span>
          </NavLink>
          <NavLink to="/clientes" className={({ isActive }) => `bottom-item ${isActive ? "active" : ""}`}>
            <Users size={22} />
            <span className="nav-label">Clientes</span>
          </NavLink>
          <NavLink to="/cardapio-config" className={({ isActive }) => `bottom-item ${isActive ? "active" : ""}`}>
            <UtensilsCrossed size={22} />
            <span className="nav-label">Cardápio</span>
          </NavLink>
          <button className={`bottom-item ${gestaoOpen ? "active" : ""}`} onClick={() => setGestaoOpen(!gestaoOpen)}>
            <Menu size={22} />
            <span className="nav-label">Outros</span>
          </button>
        </nav>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .layout-root { display: flex; min-height: 100vh; font-family: 'Inter', sans-serif; background: #fafafa; position: relative; }
        .mob-top-header { display: none; }
        .bottom-nav { display: none; }

        .sidebar { width: 220px; min-height: 100vh; background: #181419; display: flex; flex-direction: column; padding: 1.5rem 1rem; position: fixed; top: 0; left: 0; bottom: 0; z-index: 10; box-shadow: 4px 0 20px rgba(0,0,0,0.15); }

        .sidebar-profile { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; margin-top: 2rem; margin-bottom: 1.5rem; padding-bottom: 1.25rem; border-bottom: 1px solid rgba(249,0,122,0.2); }

        .sidebar-avatar-ring { width: 88px; height: 88px; border-radius: 50%; padding: 3px; background: linear-gradient(135deg, #f9007a, #ff6eb4, #ffb3d9, #f9007a); background-size: 300% 300%; animation: gradientRing 3s ease infinite; flex-shrink: 0; }
        @keyframes gradientRing { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

        .sidebar-avatar { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; border: 3px solid #ffffff; background: rgba(249,0,122,0.1); }
        .sidebar-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .sidebar-avatar-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #f9007a; }

        .sidebar-profile-info { display: flex; flex-direction: column; align-items: center; text-align: center; width: 100%; }
        .sidebar-ola { font-size: 0.92rem; font-weight: 600; color: #ffffff; }
        .sidebar-datetime { font-size: 0.72rem; color: #9ca3af; white-space: nowrap; }

        .sidebar-nav { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; }
        .nav-emoji { font-size: 0.95rem; margin-right: 0.1rem; }
        .nav-item { padding: 0.7rem 1rem; border-radius: 10px; font-size: 0.92rem; font-weight: 500; color: #9ca3af; text-decoration: none; transition: background 0.15s, color 0.15s; }
        .nav-item:hover { background: rgba(249,0,122,0.15); color: #f9007a; }
        .nav-item.active { background: rgba(249,0,122,0.15); color: #f9007a; font-weight: 600; border-left: 3px solid #f9007a; padding-left: calc(1rem - 3px); }

        .layout-main { margin-left: 220px; flex: 1; padding: 2rem; min-height: 100vh; }

        @media (max-width: 900px) {
          .sidebar { display: none; }
          .layout-main { margin-left: 0; padding: 1rem; padding-top: 5rem; padding-bottom: 7rem; overflow-x: clip; }

          .mob-top-header {
            display: flex !important;
            position: fixed;
            top: 0; left: 0; right: 0;
            z-index: 9999;
            background: #331512;
            padding: 0.65rem 1.25rem;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            transform: translateZ(0);
            -webkit-transform: translateZ(0);
          }
          .mob-top-logo { height: 42px; object-fit: contain; }
          .mob-top-icons { display: flex; align-items: center; gap: 0.6rem; }
          .mob-top-icon { background: none; border: none; cursor: pointer; display: flex; align-items: center; padding: 0.2rem; }

          .layout-main { margin-left: 0; padding: 1rem; padding-top: 5rem; padding-bottom: 5.5rem;  }

          .bottom-nav {
            display: flex !important;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            z-index: 50;
            background: #ffffff;
            padding: 0.5rem 0 1rem;
            justify-content: space-around;
            align-items: center;
            box-shadow: 0 -2px 12px rgba(0,0,0,0.12);
          }

          .bottom-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex: 1;
            gap: 0.2rem;
            padding: 0.35rem 0.1rem;
            color: #9ca3af;
            text-decoration: none;
            background: none;
            border: none;
            cursor: pointer;
            font-family: 'Inter', sans-serif;
            transition: color 0.15s;
          }

          .nav-label {
            font-size: 0.6rem;
            font-weight: 600;
            color: inherit;
            white-space: nowrap;
          }

          .bottom-item svg { color: inherit; }
          .bottom-item.active { color: #f9007a; }
          .bottom-item:hover { color: #f9007a; }

          .gestao-overlay { position: fixed; inset: 0; z-index: 30; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); }
          .gestao-drawer { position: absolute; bottom: 0; left: 0; right: 0; background: #1e1a1f; border-radius: 24px 24px 0 0; padding: 1rem 1.25rem 2rem; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); border-top: 1px solid rgba(249,0,122,0.2); }
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          .gestao-handle { width: 40px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; margin: 0 auto 1rem; }
          .gestao-title { font-size: 1rem; font-weight: 600; color: #ffffff; margin-bottom: 1rem; font-family: 'Inter', sans-serif; }
          .gestao-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
          .gestao-item { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.4rem; background: rgba(255,255,255,0.06); border-radius: 16px; padding: 1rem 0.5rem; text-decoration: none; transition: background 0.15s; border: 1px solid rgba(255,255,255,0.06); }
          .gestao-item:hover { background: rgba(249,0,122,0.15); }
          .gestao-icon { font-size: 1.6rem; }
          .gestao-label { font-size: 0.75rem; font-weight: 500; color: #ffffff; text-align: center; font-family: 'Inter', sans-serif; }
        }
            `}</style>
    </div>
  );
}

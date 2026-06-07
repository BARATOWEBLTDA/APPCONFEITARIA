import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Home, BookOpen, Users, UtensilsCrossed, Menu } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";
import { supabase } from "@/lib/supabase";

const menuItems = [
  { label: "Início", path: "/inicio", emoji: "🏠" },
  { label: "Cardápio / Loja", path: "/cardapio-config", emoji: "🛍️" },
  { label: "Produtos", path: "/produtos", emoji: "🎂" },
  { label: "Categorias", path: "/categorias", emoji: "🏷️" },
  { label: "Design", path: "/cardapio-design", emoji: "🎨" },
  { label: "Pedidos", path: "/pedidos", emoji: "📋" },
  { label: "Clientes", path: "/clientes", emoji: "👥" },
  { label: "Estoque", path: "/estoque", emoji: "📦" },
  { label: "Financeiro", path: "/financeiro", emoji: "💰" },
  { label: "Insumos", path: "/insumos", emoji: "🧂" },
  { label: "Receitas", path: "/receitas", emoji: "📄" },
  { label: "Arquivos", path: "/arquivos", emoji: "🗂️" },
  { label: "Promoções", path: "/promocoes", emoji: "🏷️" },
  { label: "Configurações", path: "/configuracoes", emoji: "⚙️" },
];

export default function Layout() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { isPro } = usePlano();
  const [now, setNow] = useState(new Date());
  const [gestaoOpen, setGestaoOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const location = useLocation();
  const isReceitas = location.pathname === "/receitas";
  const isAssinar = location.pathname === "/assinar";
  const isPrevia = location.pathname === "/cardapio-preview";
  const isCardapioMode = ["/cardapio-config", "/produtos", "/categorias", "/cardapio-design"].includes(location.pathname);
  const [cardapioNav, setCardapioNav] = useState(false);

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

      <main className={`layout-main${isAssinar ? " layout-main--no-header" : ""}`}>
        <Outlet />
      </main>

      {/* Gestão Drawer */}
      {gestaoOpen && (
        <div className="gestao-overlay" onClick={() => setGestaoOpen(false)}>
          <div className="gestao-drawer" onClick={e => e.stopPropagation()}>
            <div className="gestao-handle" />
            <div className="gestao-header">
              <h3 className="gestao-title">Outros</h3>
              <button className="gestao-close" onClick={() => setGestaoOpen(false)}>✕</button>
            </div>
            <div className="gestao-grid">
              {[
                { label: "Dashboard", path: "/dashboard", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
                { label: "Pedidos", path: "/pedidos", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
                { label: "Produtos", path: "/produtos", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
                { label: "Estoque", path: "/estoque", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
                { label: "Financeiro", path: "/financeiro", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
                { label: "Promoções", path: "/promocoes", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> },
                { label: "Arquivos", path: "/arquivos", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> },
                { label: "Configurações", path: "/configuracoes", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
                { label: "Personalização", path: "/personalizacao", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20"/><path d="M2 12h20"/></svg> },
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
      {!isAssinar && !isPrevia && (
      <div className="mob-top-header">
        <img src="/logoheader.png" alt="Doonly" className="mob-top-logo" />
        <div className="mob-top-icons">
          {!isPro && (
          <button className="mob-top-icon" onClick={() => navigate("/assinar")}>
            <img src="/diamante.png" alt="Assinar" style={{width:"24px",height:"24px",objectFit:"contain"}} />
          </button>
          )}
          <button className="mob-top-icon" onClick={() => {
              localStorage.setItem("notif_last_seen", new Date().toISOString());
              setNotifCount(0);
              navigate("/notificacoes");
            }} style={{position:"relative"}}>
            <img src="/notifica.png" alt="Notificações" style={{width:"24px",height:"24px",objectFit:"contain"}} />
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
              ? <img src={profile.foto_url} alt="perfil" style={{width:"24px",height:"24px",borderRadius:"50%",objectFit:"cover",border:"2px solid white"}} />
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }
          </button>
        </div>
      </div>
      )}

      {/* Bottom nav Mobile */}
      {!isReceitas && !isPrevia && (
        <nav className="bottom-nav">
          {(cardapioNav || isCardapioMode) ? (
            <>
              <button className={`bottom-item${location.pathname === "/cardapio-preview" ? " active" : ""}`} onClick={() => navigate("/cardapio-preview")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <span className={`nav-label${location.pathname === "/cardapio-preview" ? " nav-label-active" : ""}`}>Prévia</span>
              </button>
              <button className={`bottom-item${location.pathname === "/produtos" ? " active" : ""}`} onClick={() => navigate("/produtos")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                <span className={`nav-label${location.pathname === "/produtos" ? " nav-label-active" : ""}`}>Produtos</span>
              </button>
              <button className={`bottom-item${location.pathname === "/categorias" ? " active" : ""}`} onClick={() => navigate("/categorias")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                <span className={`nav-label${location.pathname === "/categorias" ? " nav-label-active" : ""}`}>Categorias</span>
              </button>
              <button className={`bottom-item${location.pathname === "/cardapio-design" ? " active" : ""}`} onClick={() => navigate("/cardapio-design")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20"/><path d="M2 12h20"/></svg>
                <span className={`nav-label${location.pathname === "/cardapio-design" ? " nav-label-active" : ""}`}>Design</span>
              </button>
              <button className={`bottom-item${location.pathname === "/cardapio-config" ? " active" : ""}`} onClick={() => navigate("/cardapio-config")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                <span className={`nav-label${location.pathname === "/cardapio-config" ? " nav-label-active" : ""}`}>Config</span>
              </button>
              <button className="bottom-item" onClick={() => { setCardapioNav(false); navigate("/inicio"); }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                <span className="nav-label">Voltar</span>
              </button>
            </>
          ) : (
            <>
              <NavLink to="/inicio" className={({ isActive }) => `bottom-item ${isActive ? "active" : ""}`}>
                <Home size={22} />
                <span className={`nav-label${location.pathname === "/inicio" ? " nav-label-active" : ""}`}>Início</span>
              </NavLink>
              <NavLink to="/receitas" className={({ isActive }) => `bottom-item ${isActive ? "active" : ""}`}>
                <BookOpen size={22} />
                <span className={`nav-label${location.pathname === "/receitas" ? " nav-label-active" : ""}`}>Receitas</span>
              </NavLink>
              <NavLink to="/clientes" className={({ isActive }) => `bottom-item ${isActive ? "active" : ""}`}>
                <Users size={22} />
                <span className={`nav-label${location.pathname === "/clientes" ? " nav-label-active" : ""}`}>Clientes</span>
              </NavLink>
              <button className={`bottom-item${cardapioNav ? " active" : ""}`} onClick={() => { setCardapioNav(true); navigate("/cardapio-config"); }}>
                <UtensilsCrossed size={22} />
                <span className="nav-label">Cardápio</span>
              </button>
              <button className={`bottom-item ${gestaoOpen ? "active" : ""}`} onClick={() => setGestaoOpen(!gestaoOpen)}>
                <Menu size={22} />
                <span className={`nav-label${gestaoOpen ? " nav-label-active" : ""}`}>Outros</span>
              </button>
            </>
          )}
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

          .mob-top-header {
            display: flex !important;
            position: fixed;
            top: 0; left: 0; right: 0;
            z-index: 9999;
            background: #120706;
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

          .layout-main { margin-left: 0; padding: 0.75rem; padding-top: 5rem; padding-bottom: 5.5rem; background: var(--bg-body, #f5f5f5); min-height: 100vh; width: 100%; box-sizing: border-box; }
          .layout-main--no-header { padding-top: 1rem; background: #f8f8f8; }

          .bottom-nav {
            display: flex !important;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            z-index: 50;
            background: var(--bg-card, #ffffff);
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
            color: var(--text-muted, #9ca3af);
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
          .nav-label-active { font-size: 0.6rem; font-weight: 800; color: #F583BF; }

          .bottom-nav { animation: fadeInUp 0.2s ease; }
          @keyframes fadeInUp { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
          .bottom-item.active { color: #F583BF; font-weight: 700; }
          .bottom-item.active .nav-label { font-weight: 800 !important; }
          .bottom-item:hover { color: #F583BF; }

          :root.dark .mob-top-header { background: #000000; }
          .gestao-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.6); backdrop-filter: blur(6px); }
          .gestao-drawer {
            position: fixed; bottom: 0; left: 0; right: 0;
            background: #120706;
            border-radius: 24px 24px 0 0;
            padding: 0.75rem 1.25rem 2rem;
            animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            border-top: 1px solid rgba(245,131,191,0.2);
            max-height: 80vh;
            overflow-y: auto;
            z-index: 101;
          }
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          .gestao-handle { width: 40px; height: 4px; background: rgba(255,255,255,0.15); border-radius: 2px; margin: 0 auto 1rem; }
          .gestao-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
          .gestao-title { font-size: 1rem; font-weight: 700; color: #ffffff; margin: 0; font-family: 'Inter', sans-serif; }
          .gestao-close { background: rgba(255,255,255,0.08); border: none; color: rgba(255,255,255,0.6); width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; }
          .gestao-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.65rem; }
          .gestao-item {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 0.45rem; background: rgba(255,255,255,0.05);
            border-radius: 16px; padding: 0.9rem 0.5rem;
            text-decoration: none; transition: background 0.15s;
            border: 1px solid rgba(255,255,255,0.07);
          }
          .gestao-item:hover { background: rgba(245,131,191,0.15); border-color: rgba(245,131,191,0.3); }
          .gestao-item.active { background: rgba(245,131,191,0.2); border-color: rgba(245,131,191,0.4); }
          .gestao-icon { color: #F583BF; display: flex; align-items: center; }
          .gestao-label { font-size: 0.72rem; font-weight: 600; color: #ffffff; text-align: center; font-family: 'Inter', sans-serif; line-height: 1.2; }
        }
            `}</style>
    </div>
  );
}

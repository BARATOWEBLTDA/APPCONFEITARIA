import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  House, CalendarDots, ShoppingBag, ClipboardText, Users, BookOpen,
  Package, CurrencyDollar, Gear, SignOut, CaretDown, ForkKnife, List,
  Eye, Storefront, Rows, PaintBrush, Sliders, Tag, QrCode,
  ChartBar, Files, Percent, User, ArrowLeft, Bell
} from "@phosphor-icons/react";
import { useProfile } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";
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
  const [now, setNow] = useState(new Date());
  const [gestaoOpen, setGestaoOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notificacoes, setNotificacoes] = useState<any[]>([]);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));
  const notifRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const isReceitas = location.pathname === "/receitas";
  const isAssinar = location.pathname === "/assinar";
  const isPrevia = location.pathname === "/cardapio-preview";
  const isCardapioMode = ["/cardapio-config", "/produtos", "/categorias", "/cardapio-design", "/checkout-config"].includes(location.pathname);
  const [cardapioNav, setCardapioNav] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadNotifCount = async () => {
      const { data } = await supabase.from("notificacoes").select("*").order("created_at", { ascending: false }).limit(10);
      if (!data || data.length === 0) return;
      setNotificacoes(data);
      const lastSeen = localStorage.getItem("notif_last_seen");
      if (!lastSeen) { setNotifCount(data.length); }
      else { const unseen = data.filter((n: any) => new Date(n.created_at) > new Date(lastSeen)); setNotifCount(unseen.length); }
    };
    loadNotifCount();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleDark = () => {
    const html = document.documentElement;
    if (html.classList.contains("dark")) { html.classList.remove("dark"); setDarkMode(false); localStorage.setItem("tema", "light"); }
    else { html.classList.add("dark"); setDarkMode(true); localStorage.setItem("tema", "dark"); }
  };
  const formatDate = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  const formatTime = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // ── Itens do drawer Gestão ──
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
                  : <div className="sidebar-avatar-placeholder"><User size={36} weight="duotone" color="#FF4FA3" /></div>
                }
              </div>
            </div>
            <div style={{ position: "absolute", bottom: "-8px", left: "50%", transform: "translateX(-50%)", background: isPro ? "linear-gradient(90deg,#FF4FA3,#FF6BB5)" : "#111111", border: isPro ? "none" : "1px solid rgba(255,255,255,0.2)", color: "white", fontSize: "0.65rem", fontWeight: 700, padding: "3px 10px", borderRadius: isPro ? "20px" : "6px", whiteSpace: "nowrap", letterSpacing: "0.05em" }}>
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

          <SidebarGroup label="Cardápio" icon={<ShoppingBag size={18} weight="duotone" />} paths={["/cardapio-config","/cardapio-design","/cardapio-preview","/categorias","/produtos","/checkout-config"]} location={location}>
            <NavLink to="/cardapio-config" className={({ isActive }) => `nav-subitem ${isActive ? "active" : ""}`}>Configuração</NavLink>
            <NavLink to="/cardapio-design" className={({ isActive }) => `nav-subitem ${isActive ? "active" : ""}`}>Design</NavLink>
            <NavLink to="/cardapio-preview" className={({ isActive }) => `nav-subitem ${isActive ? "active" : ""}`}>Prévia</NavLink>
            <NavLink to="/categorias" className={({ isActive }) => `nav-subitem ${isActive ? "active" : ""}`}>Categorias</NavLink>
            <NavLink to="/produtos" className={({ isActive }) => `nav-subitem ${isActive ? "active" : ""}`}>Produtos</NavLink>
            <NavLink to="/checkout-config" className={({ isActive }) => `nav-subitem ${isActive ? "active" : ""}`}>Checkout</NavLink>
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
          <a href="/assinar" style={{display:"block",margin:"0 0.25rem 0.5rem",background:"rgba(255,79,163,0.12)",border:"1px solid rgba(255,79,163,0.2)",borderRadius:"14px",padding:"0.75rem 1rem",textDecoration:"none",textAlign:"center"}}>
            <span style={{fontSize:"0.78rem",fontWeight:700,color:"#FF4FA3"}}>✨ Fazer upgrade</span>
          </a>
        )}

        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
          style={{display:"flex",alignItems:"center",gap:"0.6rem",width:"calc(100% - 0.5rem)",margin:"0 0.25rem 1rem",background:"none",border:"none",cursor:"pointer",padding:"0.6rem 1rem",borderRadius:"10px",color:"rgba(255,255,255,0.4)",fontSize:"0.82rem",fontWeight:500,fontFamily:"Geist,sans-serif",transition:"all 0.15s"}}
          onMouseEnter={e => (e.currentTarget.style.color="rgba(255,255,255,0.7)")}
          onMouseLeave={e => (e.currentTarget.style.color="rgba(255,255,255,0.4)")}>
          <SignOut size={16} weight="duotone" />
          Sair
        </button>
      </aside>

      <main className={`layout-main${isAssinar ? " layout-main--no-header" : ""}`}>
        {/* Topbar desktop */}
        <div className="desk-topbar">
          <div style={{flex:1, display:"flex", flexDirection:"column", justifyContent:"center"}}>
            <span style={{fontSize:"1rem", fontWeight:800, color:"#1f2937", lineHeight:1.2}}>
              {(() => { const h = now.getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; })()}, <span style={{color:"#FF4FA3"}}>{profile?.nome ? profile.nome.split(" ")[0] : "bem-vinda"}</span>!
            </span>
            <span style={{fontSize:"0.78rem", color:"#6b7280", marginTop:"2px"}}>
              {(() => {
                const feriados: Record<string, string> = {
                  "01-01": "Ano Novo 🎆", "21-04": "Tiradentes ⚖️", "01-05": "Dia do Trabalho 👷",
                  "07-09": "Independência do Brasil 🇧🇷", "12-10": "Nossa Senhora Aparecida 🙏",
                  "02-11": "Finados 🕯️", "15-11": "Proclamação da República 🏛️", "25-12": "Natal 🎄",
                };
                const dias = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
                const d = now;
                const dd = String(d.getDate()).padStart(2,"0");
                const mm = String(d.getMonth()+1).padStart(2,"0");
                const chave = `${dd}-${mm}`;
                const feriado = feriados[chave];
                const diaSemana = dias[d.getDay()];
                const dataStr = `${dd}/${mm}/${d.getFullYear()}`;
                if (feriado) return `Hoje é feriado — ${feriado}`;
                return `Hoje é ${diaSemana}, ${dataStr}`;
              })()}
            </span>
          </div>
          {/* Notificações com dropdown */}
          <div style={{ position: "relative" }} ref={notifRef}>
            <button className="topbar-btn" onClick={() => { setNotifOpen(o => !o); if (!notifOpen) { localStorage.setItem("notif_last_seen", new Date().toISOString()); setNotifCount(0); } }}>
              <img src="/notifica.png" alt="Notificações" style={{width:"20px",height:"20px",objectFit:"contain"}} />
              {notifCount > 0 && <span style={{ position: "absolute", top: "2px", right: "2px", width: "16px", height: "16px", borderRadius: "50%", background: "#FF4FA3", color: "white", fontSize: "0.6rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{notifCount > 9 ? "9+" : notifCount}</span>}
            </button>
            {notifOpen && (
              <div className="notif-dropdown">
                <div className="notif-header">
                  <span>Notificações</span>
                  <button onClick={() => setNotifOpen(false)}>✕</button>
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
            )}
          </div>
        </div>
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

      {/* ── Mobile top header ── */}
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
              <Bell size={24} weight="duotone" color="white" />
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
                : <User size={24} weight="duotone" color="white" />
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom nav Mobile ── */}
      {!isReceitas && !isPrevia && (
        <nav className="bottom-nav">
          {(cardapioNav || isCardapioMode) ? (
            <>
              <button className={`bottom-item${location.pathname === "/cardapio-preview" ? " active" : ""}`} onClick={() => navigate("/cardapio-preview")}>
                <Eye size={22} weight="duotone" />
                <span className={`nav-label${location.pathname === "/cardapio-preview" ? " nav-label-active" : ""}`}>Prévia</span>
              </button>
              <button className={`bottom-item${location.pathname === "/produtos" ? " active" : ""}`} onClick={() => navigate("/produtos")}>
                <Storefront size={22} weight="duotone" />
                <span className={`nav-label${location.pathname === "/produtos" ? " nav-label-active" : ""}`}>Produtos</span>
              </button>
              <button className={`bottom-item${location.pathname === "/categorias" ? " active" : ""}`} onClick={() => navigate("/categorias")}>
                <Rows size={22} weight="duotone" />
                <span className={`nav-label${location.pathname === "/categorias" ? " nav-label-active" : ""}`}>Categorias</span>
              </button>
              <button className={`bottom-item${location.pathname === "/cardapio-design" ? " active" : ""}`} onClick={() => navigate("/cardapio-design")}>
                <PaintBrush size={22} weight="duotone" />
                <span className={`nav-label${location.pathname === "/cardapio-design" ? " nav-label-active" : ""}`}>Design</span>
              </button>
              <button className={`bottom-item${location.pathname === "/cardapio-config" ? " active" : ""}`} onClick={() => navigate("/cardapio-config")}>
                <Sliders size={22} weight="duotone" />
                <span className={`nav-label${location.pathname === "/cardapio-config" ? " nav-label-active" : ""}`}>Config</span>
              </button>
              <button className="bottom-item" onClick={() => { setCardapioNav(false); navigate("/inicio"); }}>
                <ArrowLeft size={22} weight="duotone" />
                <span className="nav-label">Voltar</span>
              </button>
            </>
          ) : (
            <>
              <NavLink to="/inicio" className={({ isActive }) => `bottom-item ${isActive ? "active" : ""}`}>
                <House size={22} weight="duotone" />
                <span className={`nav-label${location.pathname === "/inicio" ? " nav-label-active" : ""}`}>Início</span>
              </NavLink>
              <button className={`bottom-item${cardapioNav ? " active" : ""}`} onClick={() => { setCardapioNav(true); navigate("/cardapio-config"); }}>
                <ForkKnife size={22} weight="duotone" />
                <span className="nav-label">Cardápio</span>
              </button>
              <NavLink to="/clientes" className={({ isActive }) => `bottom-item ${isActive ? "active" : ""}`}>
                <Users size={22} weight="duotone" />
                <span className={`nav-label${location.pathname === "/clientes" ? " nav-label-active" : ""}`}>Clientes</span>
              </NavLink>
              <NavLink to="/receitas" className={({ isActive }) => `bottom-item ${isActive ? "active" : ""}`}>
                <BookOpen size={22} weight="duotone" />
                <span className={`nav-label${location.pathname === "/receitas" ? " nav-label-active" : ""}`}>Receitas</span>
              </NavLink>
              <button className={`bottom-item ${gestaoOpen ? "active" : ""}`} onClick={() => setGestaoOpen(!gestaoOpen)}>
                <List size={22} weight="duotone" />
                <span className={`nav-label${gestaoOpen ? " nav-label-active" : ""}`}>Gestão</span>
              </button>
            </>
          )}
        </nav>
      )}

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .layout-root { display: flex; min-height: 100vh; font-family: 'Geist', sans-serif; background: var(--bg-body, #f5f5f5); position: relative; }
        .mob-top-header { display: none; }
        .bottom-nav { display: none; }

        .sidebar { width: 220px; min-height: 100vh; background: #10111A; display: flex; flex-direction: column; padding: 1.5rem 1rem; position: fixed; top: 0; left: 0; bottom: 0; z-index: 10; box-shadow: 4px 0 20px rgba(0,0,0,0.25); }

        .sidebar-profile { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; margin-top: 2rem; margin-bottom: 1.5rem; padding-bottom: 1.25rem; }

        .sidebar-avatar-ring { width: 100px; height: 100px; border-radius: 50%; padding: 3px; background: linear-gradient(135deg,#FF4FA3,#FF6BB5,#FF4FA3); background-size: 300% 300%; animation: gradientRing 3s ease infinite; flex-shrink: 0; }
        @keyframes gradientRing { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

        .sidebar-avatar { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; border: 3px solid #ffffff; background: rgba(255,79,163,0.1); }
        .sidebar-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .sidebar-avatar-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }

        .sidebar-nav { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; overflow-y: auto; }
        .nav-icon { display:flex; align-items:center; flex-shrink:0; opacity:0.7; }
        .nav-item { padding: 0.7rem 1rem; border-radius: 10px; font-size: 0.88rem; font-weight: 500; color: #D0D8F0; text-decoration: none; transition: background 0.15s, color 0.15s; outline: none; display: flex; align-items: center; gap: 0.6rem; }
        .nav-item:hover { background: #1D2550; color: #FFFFFF; }
        .nav-item:hover .nav-icon { opacity:1; }
        .nav-item:focus { background: #1D2550; color: #FFFFFF; outline: none; }
        .nav-item.active { background: linear-gradient(90deg,#FF4FA3,#FF6BB5); color: #FFFFFF; font-weight: 600; }
        .nav-item.active .nav-icon { opacity:1; }
        .nav-group-btn { width: 100%; text-align: left; cursor: pointer; background: none; border: none; font-family: 'Geist', sans-serif; padding: 0.7rem 1rem; border-radius: 10px; font-size: 0.88rem; font-weight: 500; color: #D0D8F0; transition: background 0.15s, color 0.15s; display: flex; align-items: center; gap: 0.6rem; box-sizing: border-box; margin: 0; }
        .nav-group-btn:hover { background: #1D2550; color: #FFFFFF; }
        .nav-group-btn.active { color: #FF4FA3; }
        .nav-subitems { display: flex; flex-direction: column; padding: 0 0 0.25rem 0; }
        .nav-subitem { display: flex; align-items: center; padding: 0.5rem 0.85rem 0.5rem 1.75rem; border-radius: 8px; font-size: 0.85rem; color: #8E99C2; text-decoration: none; transition: all 0.15s; }
        .nav-subitem:hover { color: #FFFFFF; background: #1D2550; }
        .nav-subitem.active { color: #FFFFFF; background: linear-gradient(90deg,#FF4FA3,#FF6BB5); font-weight: 600; }

        .layout-main { margin-left: 220px; flex: 1; padding: 2rem; min-height: 100vh; }
        .desk-topbar { display: none; }
        @media (min-width: 900px) {
          .desk-topbar { display: flex; align-items: center; gap: 0.6rem; padding: 0.75rem 2rem; border-bottom: 1px solid #f3f4f6; background: white; margin: -2rem -2rem 1.5rem -2rem; position: sticky; top: 0; z-index: 9; }
        }
        .topbar-btn { width: 34px; height: 34px; border-radius: 50%; background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.07); cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; transition: background 0.2s; position: relative; flex-shrink: 0; }
        .topbar-btn:hover { background: rgba(0,0,0,0.08); }
        .notif-dropdown { position: absolute; right: 0; top: calc(100% + 8px); width: 320px; background: white; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); border: 1px solid #f3f4f6; z-index: 100; overflow: hidden; }
        .notif-header { padding: 0.85rem 1rem; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 0.9rem; color: #1f2937; }
        .notif-header button { background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 1rem; }
        .notif-body { max-height: 360px; overflow-y: auto; }
        .notif-empty { padding: 1.5rem; text-align: center; color: #9ca3af; font-size: 0.85rem; margin: 0; }
        .notif-item { padding: 0.85rem 1rem; border-bottom: 1px solid #f9fafb; display: flex; gap: 0.75rem; align-items: flex-start; }
        .notif-item:last-child { border-bottom: none; }
        .notif-title { font-size: 0.85rem; font-weight: 600; color: #1f2937; margin: 0 0 2px; }
        .notif-msg { font-size: 0.78rem; color: #6b7280; margin: 0; }
        .notif-time { font-size: 0.7rem; color: #9ca3af; margin: 4px 0 0; }

        @media (max-width: 900px) {
          .sidebar { display: none; }

          .mob-top-header {
            display: flex !important;
            position: fixed;
            top: 0; left: 0; right: 0;
            z-index: 9999;
            background: #10111A;
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
          .layout-main--no-header { padding-top: 1rem; background: var(--bg-body, #f5f5f5); }

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
            font-family: 'Geist', sans-serif;
            transition: color 0.15s;
          }

          .nav-label { font-size: 0.6rem; font-weight: 600; color: inherit; white-space: nowrap; }
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
          .gestao-title { font-size: 1rem; font-weight: 700; color: #ffffff; margin: 0; font-family: 'Geist', sans-serif; }
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
          .gestao-label { font-size: 0.72rem; font-weight: 600; color: #ffffff; text-align: center; font-family: 'Geist', sans-serif; line-height: 1.2; }
        }
      `}</style>
    </div>
  );
}

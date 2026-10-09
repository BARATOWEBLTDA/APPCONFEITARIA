import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
// deploy: Proposta D - nova arquitetura de navegação (Entrega 1)
import CardapioSubnav, { ROTAS_CARDAPIO } from "@/components/CardapioSubnav";
import ParabensPro from "@/components/pro/ParabensPro";
import DooIA from "@/components/DooIA";
import MaisDrawer from "@/components/MaisDrawer";
import { useState, useEffect, type ReactNode } from "react";
import {
  House, CalendarDots, ShoppingBag, Users, BookOpen,
  Package, CurrencyDollar, Gear, CaretDown,
  SquaresFour, Camera, Cake, FolderSimple, PuzzlePiece, Plus,
  Receipt, Sparkle,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useProfile } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { ImageCropper } from "@/components/ui/ImageCropper";
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

/**
 * Item do menu lateral (07/10 · 2.95, guia A14): ícone de 20px, em traço grosso;
 * quando é a tela atual, o ícone fica cheio e rosa. "ativoSe" marca o item também em telas "filhas".
 */
function ItemMenu({ to, icone: Icone, children, ativoSe, tour }: { to: string; icone: Icon; children: ReactNode; ativoSe?: (caminho: string) => boolean; tour?: string }) {
  const { pathname } = useLocation();
  const extra = !!ativoSe?.(pathname);
  return (
    <NavLink to={to} data-tour={tour} className={({ isActive }) => `nav-item ${(isActive || extra) ? "active" : ""}`}>
      {({ isActive }) => (<>
        <span className="nav-icon"><Icone size={20} weight={(isActive || extra) ? "fill" : "bold"} /></span>
        <span className="nav-rotulo">{children}</span>
      </>)}
    </NavLink>
  );
}
function SubitemMenu({ to, icone: Icone, children, end }: { to: string; icone: Icon; children: ReactNode; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-subitem ${isActive ? "active" : ""}`}>
      {({ isActive }) => (<>
        <span className="nav-subicon" aria-hidden="true"><Icone size={16} weight={isActive ? "fill" : "bold"} /></span>
        {children}
      </>)}
    </NavLink>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { isPro, loading: loadingPlano } = usePlano();
  const {
    fileInputRef, uploading: uploadingFoto, cropSrc,
    openPicker: abrirSeletorFoto,
    handleFileSelected, handleCropDone, cancelCrop,
  } = useAvatarUpload();
  const [maisOpen, setMaisOpen] = useState(false);
  const [dooOpen, setDooOpen] = useState(false);
  // Menu da foto → "Assistente virtual" abre o mesmo chat do menu de baixo
  useEffect(() => {
    const abrir = () => setDooOpen(true);
    window.addEventListener("doonly:abrir-doo", abrir);
    return () => window.removeEventListener("doonly:abrir-doo", abrir);
  }, []);
  const location = useLocation();
  // Telas do Cardápio digital: no computador ganham o menu lateral pra trocar de tela sem voltar
  const comCdnav = ROTAS_CARDAPIO.includes(location.pathname);
  const isPrevia = location.pathname === "/cardapio-preview";
  // Cadastros: expande automaticamente quando estiver em uma das rotas filhas
  const isInCadastros = ["/produtos", "/clientes", "/insumos", "/categorias", "/complementos"].some(p => location.pathname.startsWith(p));
  const [cadastrosOpen, setCadastrosOpen] = useState(isInCadastros);
  useEffect(() => { if (isInCadastros) setCadastrosOpen(true); }, [isInCadastros]);

  // Scroll pro topo ao mudar de rota (fix: antes ficava na posição anterior)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <div className={`layout-root${comCdnav ? " com-cdnav" : ""}`}>
      {comCdnav && <CardapioSubnav />}
      {/* ── Sidebar Desktop ── */}
      <aside className="sidebar">
        <div className="sidebar-profile">
          <div className="sidebar-avatar-container">
          <button
            type="button"
            className="sidebar-avatar-btn"
            onClick={abrirSeletorFoto}
            disabled={uploadingFoto}
            aria-label={profile?.foto_url ? "Trocar foto de perfil" : "Adicionar foto de perfil"}
          >
            <div className="sidebar-avatar-ring">
              <div className="sidebar-avatar">
                {profile?.foto_url
                  ? <img src={profile.foto_url} alt="Foto de perfil" />
                  : <div className="sidebar-avatar-placeholder"><span className="sidebar-avatar-inicial">{(profile?.nome || "?").trim().charAt(0).toUpperCase()}</span></div>
                }
              </div>
            </div>
            {!profile?.foto_url && (
              <span className="sidebar-avatar-cam" aria-hidden="true">
                <Camera size={14} weight="fill" />
              </span>
            )}
          </button>
          {loadingPlano ? (
            <div className="sidebar-badge sidebar-badge--skel" aria-hidden="true" />
          ) : isPro ? (
            <div className="sidebar-badge sidebar-badge--pro">
              <img src="/coroa.png" alt="" className="sidebar-badge-coroa" />
              PRO
            </div>
          ) : (
            <button
              type="button"
              className="sidebar-badge sidebar-badge--upgrade"
              onClick={() => navigate("/assinar")}
              aria-label="Assinar o plano PRO"
            >
              <img src="/coroa.png" alt="" className="sidebar-badge-coroa" />
              Seja PRO
            </button>
          )}
          </div>
          {/* Input file escondido — disparado pelo botão do avatar */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileSelected}
          />
        </div>

        <div className="sidebar-greeting">
          <p className="sidebar-greeting-name">
            {profile?.nome || (profile as any)?.nome_loja
              ? <>Olá, {(profile as any)?.nome_loja?.trim() || profile?.nome?.split(" ")[0]}</>
              : <span className="sidebar-greeting-skel" aria-hidden="true" />}
          </p>
          <p className="sidebar-greeting-date">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }).replace(/^\w/, c => c.toUpperCase())}</p>
        </div>

        <nav className="sidebar-nav" aria-label="Menu principal">
          <ItemMenu to="/inicio" icone={House}>Início</ItemMenu>
          <ItemMenu to="/vendas/novo" icone={Plus}>Nova Venda</ItemMenu>

          {/* ═══ CADASTROS (abre e fecha) ═══ */}
          <button
            type="button"
            className={`nav-item nav-item--group ${isInCadastros ? "active-parent" : ""}`}
            onClick={() => setCadastrosOpen(o => !o)}
            aria-expanded={cadastrosOpen}
          >
            <span className="nav-icon"><FolderSimple size={20} weight={isInCadastros ? "fill" : "bold"} /></span>
            <span className="nav-rotulo">Cadastros</span>
            <CaretDown size={16} weight="bold" className="nav-seta" style={{ transform: cadastrosOpen ? "rotate(180deg)" : "rotate(0)" }} />
          </button>
          {cadastrosOpen && (
            <div className="nav-group-body">
              <SubitemMenu to="/produtos" end icone={Cake}>Produtos</SubitemMenu>
              <SubitemMenu to="/categorias" icone={SquaresFour}>Categorias</SubitemMenu>
              <SubitemMenu to="/insumos" icone={Package}>Ingredientes</SubitemMenu>
              <SubitemMenu to="/complementos" icone={PuzzlePiece}>Personalização</SubitemMenu>
              <SubitemMenu to="/clientes" icone={Users}>Clientes</SubitemMenu>
            </div>
          )}

          <ItemMenu to="/cardapio" icone={ShoppingBag} tour="cardapio" ativoSe={c => c.startsWith("/cardapio") || c.startsWith("/checkout-config")}>Cardápio Digital</ItemMenu>
          <ItemMenu to="/pedidos" icone={Receipt}>Pedidos</ItemMenu>
          <ItemMenu to="/agenda" icone={CalendarDots}>Agenda</ItemMenu>
          <ItemMenu to="/receitas" icone={BookOpen} ativoSe={c => c.startsWith("/comunidade")}>Receitas</ItemMenu>
          <ItemMenu to="/financeiro" icone={CurrencyDollar} ativoSe={c => c === "/custos" || c === "/lucratividade"}>Financeiro</ItemMenu>
          <ItemMenu to="/configuracoes" icone={Gear}>Configurações</ItemMenu>
        </nav>
      </aside>

      <main className="layout-main">
        {/* (07/10 · 2.99) O sininho e a janelinha de avisos saíram: o botão ficava escondido em todos os tamanhos de tela.
            As notificações continuam na tela "Notificações", pelo menu da foto. */}
        <Outlet />
      </main>

      {/* ── Drawer "Mais" (Proposta D) ── */}
      <MaisDrawer open={maisOpen} onClose={() => setMaisOpen(false)} />

      {/* Modal de crop da foto de perfil (aberto pelo ícone câmera do sidebar) */}
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          aspect={1}
          cropShape="round"
          onCancel={cancelCrop}
          onCropDone={handleCropDone}
        />
      )}

      {/* ── Bottom nav Mobile ── */}
      {!isPrevia && (
        <nav className="bottom-nav" aria-label="Menu principal">
          <div className="bottom-nav-pill">
            {([
              { to: "/inicio",   Icone: House,       label: "Início",   tour: undefined },
              { to: "/cardapio", Icone: ShoppingBag, label: "Cardápio", tour: "cardapio" },
              { to: "/pedidos",  Icone: Receipt,     label: "Pedidos",  tour: undefined },
            ] as { to: string; Icone: Icon; label: string; tour?: string }[]).map((item) => {
              const isActive =
                location.pathname === item.to ||
                location.pathname.startsWith(item.to + "/");
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`bn-item${isActive ? " bn-item--active" : ""}`}
                  data-tour={item.tour}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="bn-icon"><item.Icone size={24} weight={isActive ? "fill" : "bold"} /></span>
                  <span className="bn-label">{item.label}</span>
                </NavLink>
              );
            })}
            <button
              type="button"
              className={`bn-item${maisOpen ? " bn-item--active" : ""}`}
              onClick={() => setMaisOpen(!maisOpen)}
              aria-expanded={maisOpen}
              aria-haspopup="dialog"
            >
              <span className="bn-icon"><SquaresFour size={24} weight={maisOpen ? "fill" : "bold"} /></span>
              <span className="bn-label">Mais</span>
            </button>
            <button
              type="button"
              className={`bn-item${dooOpen ? " bn-item--active" : ""}`}
              data-tour="doo"
              onClick={() => setDooOpen(true)}
              aria-haspopup="dialog"
            >
              <span className="bn-icon"><Sparkle size={24} weight={dooOpen ? "fill" : "bold"} /></span>
              <span className="bn-label">Doo IA</span>
            </button>
          </div>
        </nav>
      )}

      <DooIA forceOpen={dooOpen} onClose={() => setDooOpen(false)} />
      <ParabensPro />

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
          padding: 1rem 1rem 1.25rem;
          position: fixed; top: 0; left: 0; bottom: 0; z-index: 10;
          box-shadow: var(--shadow-card);
        }

        .sidebar-profile { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; margin-top: 0.75rem; margin-bottom: 0.5rem; padding-bottom: 0; }

        .sidebar-avatar-btn {
          background: none; border: none; padding: 0; cursor: pointer;
          position: relative; display: inline-block;
          border-radius: 50%;
          transition: transform var(--dur-fast, 150ms);
        }
        .sidebar-avatar-btn:hover { transform: scale(1.03); }
        .sidebar-avatar-btn:focus-visible { outline: 3px solid var(--primary); outline-offset: 4px; border-radius: 50%; }
        .sidebar-avatar-cam {
          position: absolute;
          bottom: 4px; right: 4px;
          width: 26px; height: 26px;
          border-radius: 50%;
          background: var(--primary);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35);
          transition: transform var(--dur-fast, 150ms), background var(--dur-fast, 150ms);
          pointer-events: none;
          z-index: 2;
        }
        .sidebar-avatar-btn:hover .sidebar-avatar-cam {
          background: var(--primary-dark);
          transform: scale(1.1);
        }
        .sidebar-avatar-ring { width: 100px; height: 100px; border-radius: 50%; padding: 0; background: transparent; flex-shrink: 0; }

        .sidebar-avatar { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; border: 3px solid #fff; background: #F8F5F6; box-shadow: 0 8px 24px rgba(153,53,86,0.15), 0 2px 6px rgba(0,0,0,0.06); }
        .sidebar-avatar:has(.sidebar-avatar-placeholder) { background: #993556; }
        .sidebar-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .sidebar-avatar-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
        .sidebar-avatar-inicial { font-family: var(--font-base); font-size: 40px; font-weight: 700; color: #FCE0E9; letter-spacing: -0.02em; line-height: 1; }

        .sidebar-avatar-container {
          position: relative;
          display: inline-block;
        }

        .sidebar-badge {
          position: absolute; bottom: -7px; left: 50%; transform: translateX(-50%);
          font-size: 12px;
          font-weight: var(--fw-bold);
          padding: 4px 8px;
          white-space: nowrap;
          color: #fff;
          background: #2D1F26;
          border-radius: 6px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: inline-flex;
          align-items: center;
          gap: 4px;
          line-height: 1;
          border: none;
          font-family: inherit;
        }
        /* Variante PRO — preta */
        .sidebar-badge--pro { cursor: default; }
        /* Variante Upgrade — branca clicável */
        .sidebar-badge--upgrade {
          background: #fff;
          color: var(--primary);
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .sidebar-badge--upgrade:hover {
          transform: translateX(-50%) translateY(-1px);
          box-shadow: 0 4px 9px rgba(0,0,0,0.35);
        }
        .sidebar-badge--upgrade:active {
          transform: translateX(-50%) translateY(0);
        }
        .sidebar-badge-coroa {
          width: 10px;
          height: 10px;
          object-fit: contain;
          display: block;
          flex-shrink: 0;
        }
        /* Skeleton enquanto carrega o plano (evita flash Upgrade→PRO) */
        .sidebar-badge--skel {
          width: 68px;
          height: 24px;
          background: linear-gradient(90deg, rgba(255,255,255,0.15) 25%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0.15) 75%);
          background-size: 200% 100%;
          animation: sidebarBadgeShimmer 1.2s ease-in-out infinite;
          box-shadow: none;
          padding: 0;
        }
        @keyframes sidebarBadgeShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .sidebar-greeting {
          text-align: center;
          padding: 0 1rem;
          margin: 0.5rem 0 0.75rem;
          min-height: 2.6rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .sidebar-greeting-name { margin: 0; font-size: 0.95rem; font-weight: var(--fw-semibold); color: var(--sidebar-text); line-height: 1.3; min-height: 1.25rem; display: flex; align-items: center; justify-content: center; }
        .sidebar-greeting-skel {
          display: inline-block;
          width: 120px; height: 12px;
          background: rgba(255,255,255,0.12);
          border-radius: 4px;
          animation: sbSkelPulse 1.4s ease-in-out infinite;
        }
        @keyframes sbSkelPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.9; }
        }
        .sidebar-greeting-date { margin: 3px 0 0; font-size: var(--font-caption); color: var(--sidebar-text-muted); line-height: 1.3; }

        /* (07/10 · 2.95) Menu lateral no padrão do guia: itens de 44px, ícone de 20px (cheio e rosa na tela atual),
           foco visível pelo teclado e fundo vinho (o grafite antigo saiu). */
        .sidebar-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; min-height: 0; overflow-y: auto; margin-right: -8px; padding-right: 8px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.22) transparent; }
        .nav-icon { display: flex; align-items: center; flex-shrink: 0; }
        .nav-rotulo { flex: 1; min-width: 0; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .nav-seta { flex-shrink: 0; opacity: 0.6; transition: transform var(--dur-normal) var(--ease-out); }

        .nav-item, .nav-item--group {
          all: unset; box-sizing: border-box;
          display: flex; align-items: center; gap: 10px;
          min-height: 44px; padding: 0 12px; border-radius: 12px;
          font-family: var(--font-base); font-size: 14.5px; font-weight: var(--fw-semibold); line-height: 1.2;
          color: rgba(255,255,255,0.82); text-decoration: none; cursor: pointer;
          transition: background-color var(--dur-fast) linear, color var(--dur-fast) linear;
          -webkit-tap-highlight-color: transparent;
        }
        .nav-item:hover, .nav-item--group:hover { background: rgba(255,255,255,0.07); color: #fff; }
        .nav-item:focus-visible, .nav-item--group:focus-visible, .nav-subitem:focus-visible { outline: 3px solid rgba(255,255,255,0.7); outline-offset: -3px; }
        .nav-item.active { background: rgba(255,255,255,0.10); color: #fff; font-weight: var(--fw-bold); }
        .nav-item.active .nav-icon, .nav-item--group.active-parent .nav-icon { color: #FF9DC4; }
        .nav-item--group.active-parent { color: #fff; font-weight: var(--fw-bold); }

        .nav-group-body { display: flex; flex-direction: column; gap: 2px; margin: 2px 0 6px 21px; padding-left: 9px; border-left: 1px solid rgba(255,255,255,0.14); }
        .nav-subitem { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 10px; border-radius: 10px; font-size: 13.5px; font-weight: var(--fw-medium); color: rgba(255,255,255,0.78); text-decoration: none; transition: background-color var(--dur-fast) linear, color var(--dur-fast) linear; }
        .nav-subitem .nav-subicon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .nav-subitem:hover { color: #fff; background: rgba(255,255,255,0.07); }
        .nav-subitem.active { color: #fff; background: rgba(255,255,255,0.10); font-weight: var(--fw-bold); }
        .nav-subitem.active .nav-subicon { color: #FF9DC4; }

        .sidebar-cad-complete {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin: 0 0.25rem 1rem;
          padding: 0.75rem 0.5rem;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
          color: #fff;
          border: none;
          border-radius: var(--radius-md);
          text-decoration: none;
          text-align: center;
          font-family: var(--font-base);
          font-size: 0.75rem;
          font-weight: var(--fw-black);
          letter-spacing: 0.03em;
          box-shadow: 0 6px 18px rgba(var(--primary-rgb), 0.35);
          position: relative;
          overflow: hidden;
          transition: transform 0.15s, box-shadow 0.2s;
          cursor: pointer;
          white-space: nowrap;
        }
        .sidebar-cad-complete:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 22px rgba(var(--primary-rgb), 0.45);
        }
        .sidebar-cad-complete:active { transform: scale(0.98); }
        .sidebar-cad-complete-icon {
          font-size: 1rem;
          line-height: 1;
        }
        .sidebar-cad-complete-text {
          flex-shrink: 0;
        }
        .sidebar-cad-complete::after {
          content: "";
          position: absolute;
          top: 0; bottom: 0; left: -60%;
          width: 40px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
          animation: sbCadShimmer 3.5s linear infinite;
        }
        @keyframes sbCadShimmer { to { left: 160%; } }

        /* ── Layout main ── */
        /* Desktop: margem lateral (esquerda vem do sidebar 220px) + respiro no topo.
           Aplica em TODAS as páginas: Início, Agenda, Pedidos, Clientes, Cardápio, etc. */
        .layout-main { margin-left: 220px; flex: 1; padding: 3rem 2rem 2rem; min-height: 100vh; min-width: 0; }
        /* ── Mobile ── */
        @media (max-width: 900px) {
          .sidebar { display: none; }

          .layout-main {
            margin-left: 0;
            padding: var(--space-2);
            padding-top: calc(var(--pad-page-top) + env(safe-area-inset-top, 0px));
            padding-bottom: 6.5rem;
            background: var(--bg-body);
            min-height: 100vh;
            width: 100%;
            box-sizing: border-box;
          }
          .layout-main--no-header { background: var(--bg-body); }

          /* ── Menu de baixo (07/10 · 2.95, guia A14) ──
             Ícone de 24px (cheio e rosa na tela atual), a barra pinta também a faixa de baixo do iPhone
             e o risquinho da tela atual voltou a aparecer (antes ficava cortado). Altura: os mesmos 56px. */
          .bottom-nav {
            display: block !important;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            z-index: 50;
            padding: 0 0 env(safe-area-inset-bottom, 0px);
            background: var(--vinho-profundo);
            box-shadow: 0 -2px 16px rgba(31, 7, 17, 0.3);
          }
          .bottom-nav-pill {
            display: flex;
            align-items: stretch;
            width: 100%;
            max-width: 600px;
            height: 56px;
            margin: 0 auto;
            padding: 0 4px;
          }
          .bn-item {
            position: relative;
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            padding: 0;
            border: none;
            background: none;
            cursor: pointer;
            font-family: var(--font-base);
            text-decoration: none;
            color: rgba(255, 255, 255, 0.72);
            transition: color var(--dur-fast) linear;
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
          }
          @media (hover: hover) { .bn-item:hover { color: #fff; } .bn-item--active:hover { color: #FF9DC4; } }
          .bn-item--active { color: #FF9DC4; }
          .bn-item--active::before {
            content: "";
            position: absolute;
            top: 0; left: 50%;
            width: 28px; height: 3px; margin-left: -14px;
            background: currentColor;
            border-radius: 0 0 3px 3px;
          }
          .bn-item:focus-visible { outline: 3px solid rgba(255, 255, 255, 0.7); outline-offset: -4px; border-radius: 12px; }
          .bn-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            color: inherit;
            transition: transform var(--dur-fast) var(--ease-out);
          }
          .bn-item:active .bn-icon { transform: scale(0.9); }
          .bn-label {
            font-size: 12px;
            font-weight: var(--fw-semibold);
            color: inherit;
            white-space: nowrap;
            letter-spacing: 0.01em;
            line-height: 1;
          }
          .bn-item--active .bn-label { font-weight: 700; }


          /* ── Gestão Drawer ── */
          .gestao-overlay { position: fixed; inset: 0; z-index: 100; background: var(--drawer-overlay); backdrop-filter: blur(6px); }
          .gestao-drawer { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-card); border-radius: var(--radius-xl) 24px 0 0; padding: 0.75rem 1.25rem 2rem; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); max-height: 80vh; overflow-y: auto; z-index: 101; box-shadow: 0 -8px 40px rgba(0,0,0,0.2); }
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          .gestao-handle { width: 40px; height: 4px; background: var(--border); border-radius: 2px; margin: 0 auto 1rem; }
          .gestao-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
          .gestao-title { font-size: var(--font-modal-title); font-weight: var(--fw-black); color: var(--text-title); margin: 0; font-family: var(--font-base); }
          .gestao-close { background: var(--bg-subtle); border: none; color: var(--text-secondary); width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: var(--font-helper); display: flex; align-items: center; justify-content: center; }
          .gestao-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.7rem; }
          .gestao-item { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; background: var(--bg-subtle); border-radius: var(--radius-lg); padding: 1.1rem 0.4rem; text-decoration: none; transition: transform var(--dur-fast), background 0.15s; border: 1.5px solid transparent; min-height: 88px; }
          .gestao-item:active { transform: scale(0.95); }
          .gestao-item.active { background: var(--primary); border-color: var(--primary); }
          .gestao-icon { color: var(--primary); display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: var(--radius-md); background: rgba(152,98,116,0.12); }
          .gestao-item.active .gestao-icon { color: #FFFFFF; background: rgba(255,255,255,0.2); }
          .gestao-label { font-size: var(--font-caption); font-weight: var(--fw-semibold); color: var(--text-title); text-align: center; font-family: var(--font-base); line-height: 1.25; white-space: normal; word-break: break-word; }
          .gestao-item.active .gestao-label { color: #FFFFFF; }
        }
      `}</style>
    </div>
  );
}
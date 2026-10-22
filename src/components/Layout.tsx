import { useNotifications } from "@/context/NotificationContext";
import { ROTAS_CARDAPIO } from "@/components/CardapioSubnav";
const ROTAS_CATALOGO = ["/produtos", "/produtos/categorias", "/categorias", "/complementos"];
import { PausarPedidos } from "@/components/loja/PausarPedidos";
import { NavLink, Outlet, useNavigate, useLocation, useNavigationType } from "react-router-dom";
// deploy: Proposta D - nova arquitetura de navegação (Entrega 1)
import { nomeCurtoLoja } from "@/lib/nomeCurtoLoja";

import ParabensPro from "@/components/pro/ParabensPro";
import DooIA from "@/components/DooIA";
import MaisDrawer from "@/components/MaisDrawer";
import PerguntaSons from "@/components/PerguntaSons";
import { useState, useEffect, type ReactNode } from "react";
import { ClipboardText, ChartBar, Stack, Palette, Truck, Storefront, ArrowSquareOut, ArrowsDownUp, CalendarCheck, Tag, ChartLineUp, Megaphone, HandCoins, CaretDoubleLeft, CaretDoubleRight,
  House, CalendarDots, ShoppingBag, Users, BookOpen,
  Package, CurrencyDollar, Gear, CaretDown, Cake,
  SquaresFour, Camera, Plus,
  Receipt, Sparkle, Crown, Bell,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useProfile, avatarDaConta, getCardapioUrl } from "@/hooks/useProfile";
import { reativarPushSeSaiu } from "@/hooks/usePushSubscription";
import { usePlano } from "@/hooks/usePlano";
import { usePedidosParaAceitar } from "@/hooks/usePedidosParaAceitar";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { supabase } from "@/lib/supabase";
import { VERSAO_APP } from "@/lib/versao";
import { Mascote, NomeDoonly } from "@/components/marca/Mascote";

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
/** (4.27) Sininho do menu da esquerda (computador): número de notificações novas e atalho pra lista */
function SinoMenu() {
  const { notifCount } = useNotifications();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const n = notifCount > 9 ? "9+" : String(notifCount);
  return (
    <button type="button" className={`sidebar-sino${pathname === "/notificacoes" ? " ativo" : ""}${notifCount > 0 ? " sidebar-sino--novo" : ""}`} onClick={() => navigate("/notificacoes")}
      aria-label={notifCount > 0 ? `Notificações, ${notifCount} nova${notifCount > 1 ? "s" : ""}` : "Notificações"}>
      <Bell size={20} weight={pathname === "/notificacoes" || notifCount > 0 ? "fill" : "bold"} />
      {notifCount > 0 && <span className="sidebar-sino-n" aria-hidden="true">{n}</span>}
    </button>
  );
}
/** só monta no computador (no celular o menu da esquerda fica escondido e não precisa buscar nada) */
function useComputador() {
  const [sim, setSim] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 901px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 901px)");
    const f = () => setSim(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return sim;
}

function ItemMenu({ to, icone: Icone, children, ativoSe, tour }: { to: string; icone: Icon; children: ReactNode; ativoSe?: (caminho: string) => boolean; tour?: string }) {
  const { pathname } = useLocation();
  const extra = !!ativoSe?.(pathname);
  return (
    <NavLink to={to} data-tour={tour} title={typeof children === "string" ? children : undefined} className={({ isActive }) => `nav-item ${(isActive || extra) ? "active" : ""}`}>
      {({ isActive }) => (<>
        <span className="nav-icon"><Icone size={20} weight={(isActive || extra) ? "fill" : "bold"} /></span>
        <span className="nav-rotulo">{children}</span>
      </>)}
    </NavLink>
  );
}
function SubitemMenu({ to, icone: Icone, children, end, tambem }: { to: string; icone: Icon; children: ReactNode; end?: boolean; tambem?: string[] }) {
  const { pathname } = useLocation();
  const extra = !!tambem?.includes(pathname);
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-subitem ${isActive || extra ? "active" : ""}`}>
      {({ isActive }) => (<>
        <span className="nav-subicon" aria-hidden="true"><Icone size={16} weight={isActive || extra ? "fill" : "bold"} /></span>
        {children}
      </>)}
    </NavLink>
  );
}

/** (13/10) Grupo do menu (Cadastros, Financeiro, Minha conta): abre e fecha, fica aberto quando a tela é dele.
 *  Recolhido (só ícones): o ícone leva pra primeira tela do grupo. */
function GrupoMenu({ id, rotulo, icone: Icone, rotas, recolhido, children, tour }: { id: string; rotulo: string; icone: Icon; rotas: string[]; recolhido: boolean; children: ReactNode; tour?: string }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const dentro = rotas.some(r => pathname === r || pathname.startsWith(r + "/"));
  // (19/10) ao abrir ou recarregar (F5) os grupos começam fechados; só abre o grupo da tela em que você está.
  // Abrir e fechar vale enquanto usa, sem ficar lembrado (antes voltava aberto depois do F5).
  const [aberto, setAberto] = useState<boolean>(dentro);
  useEffect(() => { if (dentro) setAberto(true); }, [dentro]);
  useEffect(() => { try { localStorage.removeItem(`doonly_menu_grupo_${id}`); } catch {} }, [id]);
  const alternar = () => setAberto(a => !a);
  if (recolhido) {
    return (
      <button type="button" className={`nav-item${dentro ? " active" : ""}`} data-tour={tour} onClick={() => navigate(rotas[0])} title={rotulo} aria-label={rotulo}>
        <span className="nav-icon"><Icone size={20} weight={dentro ? "fill" : "bold"} /></span>
        <span className="nav-rotulo">{rotulo}</span>
      </button>
    );
  }
  return (
    <div className="nav-grupo">
      <button type="button" className={`nav-item nav-item--grupo${dentro ? " active-parent" : ""}`} data-tour={tour} onClick={alternar} aria-expanded={aberto}>
        <span className="nav-icon"><Icone size={20} weight={dentro ? "fill" : "bold"} /></span>
        <span className="nav-rotulo">{rotulo}</span>
        <CaretDown size={14} weight="bold" className={`nav-seta${aberto ? " aberta" : ""}`} aria-hidden="true" />
      </button>
      {aberto && <div className="nav-group-body">{children}</div>}
    </div>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const paraAceitar = usePedidosParaAceitar(profile?.id);
  const { isPro, loading: loadingPlano } = usePlano();
  // (11/10) saiu e entrou de novo neste aparelho: os avisos de pedido voltam a ligar sozinhos
  useEffect(() => { void reativarPushSeSaiu(); }, []);
  const {
    fileInputRef, uploading: uploadingFoto, cropSrc,
    openPicker: abrirSeletorFoto,
    handleFileSelected, handleCropDone, cancelCrop,
  } = useAvatarUpload();
  const [maisOpen, setMaisOpen] = useState(false);
  const [dooOpen, setDooOpen] = useState(false);
  const computador = useComputador();
  const linkCardapio = profile ? getCardapioUrl(profile) : "";
  // (13/10) menu recolhido (só os ícones): fica lembrado neste aparelho. A largura vai na variável --sidebar-w,
  // que as barras fixas de baixo (Nova venda, Dados da loja, Editar pedido) também usam.
  const [recolhido, setRecolhido] = useState(() => { try { return localStorage.getItem("doonly_menu_recolhido") === "1"; } catch { return false; } });
  const alternarRecolhido = () => setRecolhido(r => { const n = !r; try { localStorage.setItem("doonly_menu_recolhido", n ? "1" : "0"); } catch {} return n; });
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", recolhido ? "72px" : "236px");
  }, [recolhido]);
  // Menu da foto → "Assistente virtual" abre o mesmo chat do menu de baixo
  useEffect(() => {
    const abrir = () => setDooOpen(true);
    window.addEventListener("doonly:abrir-doo", abrir);
    return () => window.removeEventListener("doonly:abrir-doo", abrir);
  }, []);
  const location = useLocation();
  const isPrevia = location.pathname === "/cardapio-preview";

  // Scroll pro topo ao mudar de rota (fix: antes ficava na posição anterior)
  // (11/10) menos ao VOLTAR ("POP"): a lista volta no ponto em que ela estava, em vez de pular pro topo
  const tipoNavegacao = useNavigationType();
  useEffect(() => {
    if (tipoNavegacao === "POP") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div className={`layout-root${recolhido ? " menu-recolhido" : ""}`}>
      {/* (13/10) as telas do Cardápio digital agora têm abas na faixa rosa (AppPageHeader), não um 2º menu lateral */}
      {/* ── Sidebar Desktop ── */}
      <aside className="sidebar">
        {/* (13/10) topo do menu: a marca Doonly (branca) e o sino. A logo da loja fica no canto direito da faixa rosa. */}
        <div className="sb-topo">
          <button type="button" className="sb-marca" onClick={() => navigate("/inicio")} aria-label="Doonly, ir pro início">
            {recolhido ? <Mascote pose="acenando" className="sb-marca-masc" /> : <NomeDoonly cor="branco" className="sb-marca-nome" />}
          </button>
          {computador && <SinoMenu />}
        </div>

        <nav className="sidebar-nav" aria-label="Menu principal">
          <ItemMenu to="/inicio" icone={House}>Início</ItemMenu>
          <ItemMenu to="/vendas/novo" icone={Plus}>Nova venda</ItemMenu>
          <ItemMenu to="/pedidos" icone={Receipt}>Pedidos</ItemMenu>
          <ItemMenu to="/agenda" icone={CalendarDots}>Agenda</ItemMenu>
          {/* (13/10) as telas do Cardápio digital viraram um grupo do menu (antes eram abas na faixa rosa) */}
          {/* (14/10) Produtos, Categorias e Personalização foram pra Cadastros: aqui fica só o que é da loja online */}
          <GrupoMenu id="cardapio" rotulo="Cardápio digital" icone={ShoppingBag} tour="cardapio" rotas={[...ROTAS_CARDAPIO.filter(r => !ROTAS_CATALOGO.includes(r)), "/cardapio-preview"]} recolhido={recolhido}>
            <SubitemMenu to="/cardapio" end icone={ChartBar}>Visão geral</SubitemMenu>
            <SubitemMenu to="/cardapio-design" icone={Palette}>Aparência</SubitemMenu>
            <SubitemMenu to="/cardapio-config" icone={Storefront}>Dados da loja</SubitemMenu>
            {linkCardapio && <a className="nav-subitem" href={linkCardapio} target="_blank" rel="noopener noreferrer"><span className="nav-subicon" aria-hidden="true"><ArrowSquareOut size={16} weight="bold" /></span>Ver meu cardápio</a>}
          </GrupoMenu>
          {/* (13/10) grupos que abrem e fecham (ficam abertos quando a tela é deles; o que ela abrir ou fechar fica lembrado) */}
          <GrupoMenu id="cadastros" rotulo="Cadastros" icone={Users} rotas={[...ROTAS_CATALOGO, "/clientes", "/insumos", "/ficha-tecnica"]} recolhido={recolhido}>
            <SubitemMenu to="/produtos" end icone={Cake}>Produtos</SubitemMenu>
            <SubitemMenu to="/categorias" icone={SquaresFour} tambem={["/produtos/categorias"]}>Categorias</SubitemMenu>
            <SubitemMenu to="/complementos" icone={Stack}>Complementos</SubitemMenu>
            <SubitemMenu to="/clientes" icone={Users}>Clientes</SubitemMenu>
            <SubitemMenu to="/insumos" icone={Package}>Ingredientes</SubitemMenu>
            <SubitemMenu to="/ficha-tecnica" icone={ClipboardText}>Ficha técnica</SubitemMenu>
          </GrupoMenu>
          <GrupoMenu id="financeiro" rotulo="Financeiro" icone={CurrencyDollar} rotas={["/financeiro", "/custos", "/lucratividade"]} recolhido={recolhido}>
            <SubitemMenu to="/financeiro" end icone={SquaresFour}>Visão geral</SubitemMenu>
            <SubitemMenu to="/financeiro/transacoes" icone={ArrowsDownUp}>Transações</SubitemMenu>
            <SubitemMenu to="/financeiro/a-receber" icone={HandCoins}>A receber</SubitemMenu>
            <SubitemMenu to="/financeiro/a-pagar" icone={CalendarCheck}>A pagar</SubitemMenu>
            <SubitemMenu to="/custos" icone={Tag}>Custos</SubitemMenu>
            <SubitemMenu to="/lucratividade" icone={ChartLineUp}>Lucratividade</SubitemMenu>
          </GrupoMenu>
          <ItemMenu to="/marketing" icone={Megaphone}>Marketing</ItemMenu>
          {/* (4.27) Doo IA no computador: abre o painel do lado direito */}
          <button type="button" className={`nav-item${dooOpen ? " active" : ""}`} data-tour="doo-pc" onClick={() => setDooOpen(true)} aria-haspopup="dialog" title="Doo IA">
            <span className="nav-icon"><Sparkle size={20} weight={dooOpen ? "fill" : "bold"} /></span>
            <span className="nav-rotulo">Doo IA</span>
          </button>
          <GrupoMenu id="conta" rotulo="Minha conta" icone={Gear} rotas={["/configuracoes", "/minha-assinatura", "/assinar", "/conquistas"]} recolhido={recolhido}>
            <SubitemMenu to="/configuracoes" end icone={Gear}>Configurações</SubitemMenu>
            <SubitemMenu to={isPro ? "/minha-assinatura" : "/assinar"} icone={Crown} tambem={["/assinar", "/minha-assinatura"]}>Minha assinatura</SubitemMenu>
          </GrupoMenu>
          {/* (19/10) Notificações (já está em Configurações) e Conquistas (escondida nas Configurações) saíram do menu.
              "Loja em montagem" (abrir e pausar os pedidos) por último, dentro do menu: rola junto e não come o espaço dos grupos */}
          {!recolhido && <div className="sb-pausar"><PausarPedidos escuro /></div>}
        </nav>
        <div className="sb-pe">
          {!recolhido && <span className="sb-versao">v{VERSAO_APP}</span>}
          <button type="button" className="sb-recolher" onClick={alternarRecolhido} aria-label={recolhido ? "Abrir o menu" : "Recolher o menu"} title={recolhido ? "Abrir o menu" : "Recolher o menu"}>
            {recolhido ? <CaretDoubleRight size={16} weight="bold" /> : <CaretDoubleLeft size={16} weight="bold" />}
          </button>
        </div>
      </aside>

      <main className="layout-main">
        {/* (07/10 · 2.99) O sininho e a janelinha de avisos saíram: o botão ficava escondido em todos os tamanhos de tela.
            As notificações continuam na tela "Notificações", pelo menu da foto. */}
        <Outlet />
      </main>

      {/* ── Drawer "Mais" (Proposta D) ── */}
      <MaisDrawer open={maisOpen} onClose={() => setMaisOpen(false)} />
      <PerguntaSons />

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
            {/* (16/10) Início · Cardápio · [+ Nova venda] · Pedidos · Mais. O Doo IA foi pro topo do Início e pro menu da foto */}
            {([
              { to: "/inicio",   Icone: House,       label: "Início",   tour: undefined },
              // (21/10) Início · Financeiro · [+] · Pedidos · Mais. Cadastros (com o cardápio digital dentro) fica no Mais
              { to: "/financeiro", Icone: CurrencyDollar, label: "Financeiro", tour: undefined },
              { to: "/vendas/novo", Icone: Plus, label: "Nova venda", tour: undefined, mais: true },
              { to: "/pedidos",  Icone: Receipt,     label: "Pedidos",  tour: undefined },
            ] as { to: string; Icone: Icon; label: string; tour?: string; mais?: boolean }[]).map((item) => {
              const irPara = (e: React.MouseEvent) => {
                // (15/10) com o Mais aberto (o menu continua aparecendo), troca de tela e fecha o Mais.
                // A tela nova entra no lugar da entrada do Mais no histórico, igual a escolher um item dentro dele.
                if (!maisOpen) return;
                e.preventDefault();
                navigate(item.to, { replace: !!(window.history.state as { uiJanela?: boolean } | null)?.uiJanela });
                setMaisOpen(false);
              };
              if (item.mais) return (
                <NavLink key={item.to} to={item.to} className="bn-item bn-novo" aria-label="Nova venda" title="Nova venda" onClick={irPara}>
                  <span className="bn-novo-c"><Plus size={26} weight="bold" /></span>
                </NavLink>
              );
              // com o Mais aberto, só ele fica aceso
              const isActive = !maisOpen && (
                location.pathname === item.to ||
                location.pathname.startsWith(item.to + "/") ||
                (item.to === "/financeiro" && ["/lucratividade", "/custos"].some(r => location.pathname.startsWith(r))));
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`bn-item${isActive ? " bn-item--active" : ""}`}
                  data-tour={item.tour}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.to === "/pedidos" && paraAceitar > 0 ? `Pedidos, ${paraAceitar} para aceitar` : undefined}
                  onClick={irPara}
                >
                  <span className="bn-icon"><item.Icone size={24} weight={isActive ? "fill" : "bold"} />
                    {/* (21/10) bolinha com os pedidos esperando aceite */}
                    {item.to === "/pedidos" && paraAceitar > 0 && <span className="bn-bolinha">{paraAceitar > 9 ? "9+" : paraAceitar}</span>}
                  </span>
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
          width: var(--sidebar-w, 220px); min-height: 100vh;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--sidebar-border);
          display: flex; flex-direction: column;
          padding: 1rem 1rem 1.25rem;
          position: fixed; top: 0; left: 0; bottom: 0; z-index: 10;
          box-shadow: var(--shadow-card);
        }

        .sidebar-sino { position: absolute; top: 0.75rem; right: 0.75rem; z-index: 2; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border: 0; border-radius: 12px; background: rgba(255, 255, 255, .08); color: rgba(255, 255, 255, .86); cursor: pointer; }
        .sidebar-sino:hover, .sidebar-sino.ativo { background: rgba(255, 255, 255, .16); color: #fff; }
        .sidebar-sino:focus-visible { outline: 3px solid rgba(255, 255, 255, .6); outline-offset: 1px; }
        /* (13/10) notificação nova: o sino fica amarelo e balança de tempos em tempos, até ela ler */
        .sidebar-sino--novo { color: #FACC15; background: rgba(250, 204, 21, .14); }
        .sidebar-sino--novo:hover { color: #FDE047; background: rgba(250, 204, 21, .22); }
        .sidebar-sino--novo svg { transform-origin: 50% 2px; animation: sinoBalanca 3s ease-in-out infinite; }
        @keyframes sinoBalanca { 0%, 30%, 100% { transform: rotate(0); } 4% { transform: rotate(16deg); } 9% { transform: rotate(-14deg); } 14% { transform: rotate(10deg); } 19% { transform: rotate(-7deg); } 24% { transform: rotate(3deg); } }
        @media (prefers-reduced-motion: reduce) { .sidebar-sino--novo svg { animation: none; } }
        .sidebar-sino-n { position: absolute; top: 4px; right: 3px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: #E85A8C; color: #fff; font-size: 11px; font-weight: 600; line-height: 18px; text-align: center; box-shadow: 0 0 0 2px var(--sidebar-bg, #2C1219); }
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
          color: var(--ui-branco);
          display: flex; align-items: center; justify-content: center;
          border: 2px solid var(--ui-branco);
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

        .sidebar-avatar { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; border: 3px solid var(--ui-branco); background: #F8F5F6; box-shadow: 0 8px 24px rgba(153,53,86,0.15), 0 2px 6px rgba(0,0,0,0.06); }
        .sidebar-avatar:has(.sidebar-avatar-placeholder) { background: #993556; }
        .sidebar-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .sidebar-avatar-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
        .sidebar-avatar-inicial { font-family: var(--font-base); font-size: 40px; font-weight: 700; color: var(--primary-light); letter-spacing: -0.02em; line-height: 1; }

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
          color: var(--ui-branco);
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
          background: var(--ui-branco);
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
        .sidebar-badge-coroa { display: block; flex-shrink: 0; color: var(--primary); }
        .sidebar-badge--pro .sidebar-badge-coroa { color: #FF9DC4; }
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
        .sidebar-greeting-name { margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--sidebar-text); line-height: 1.3; min-height: 1.25rem; display: flex; align-items: center; justify-content: center; }
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
        /* (10/10) Sombra no fim do menu: avisa que tem mais itens pra baixo quando a tela é baixa */
        .sidebar-nav::after { content: ""; position: sticky; bottom: 0; flex-shrink: 0; min-height: 28px; margin-top: -28px; background: linear-gradient(to bottom, transparent, var(--sidebar-bg)); pointer-events: none; }
        @media (max-height: 820px) {
          .sidebar { padding-top: 0.5rem; padding-bottom: 0.75rem; }
          .sidebar-profile { margin-top: 0.25rem; }
          .sidebar-avatar-ring { width: 72px; height: 72px; }
          .sidebar-avatar-inicial { font-size: 30px; }
          .sidebar-greeting { margin: 0.4rem 0 0.4rem; min-height: 0; }
          .sidebar-nav { gap: 0; }
        }
        .nav-icon { display: flex; align-items: center; flex-shrink: 0; }
        .nav-rotulo { flex: 1; min-width: 0; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .nav-seta { flex-shrink: 0; opacity: 0.6; transition: transform var(--dur-normal) var(--ease-out); }

        .nav-item, .nav-item--group {
          all: unset; box-sizing: border-box;
          display: flex; align-items: center; gap: 10px;
          min-height: 44px; padding: 0 12px; border-radius: var(--ui-raio);
          font-family: var(--font-base); font-size: 14.5px; font-weight: 500; line-height: 1.2;
          color: rgba(255,255,255,0.82); text-decoration: none; cursor: pointer;
          transition: background-color var(--dur-fast) linear, color var(--dur-fast) linear;
          -webkit-tap-highlight-color: transparent;
        }
        .nav-item:hover, .nav-item--group:hover { background: rgba(255,255,255,0.07); color: var(--ui-branco); }
        .nav-item:focus-visible, .nav-item--group:focus-visible, .nav-subitem:focus-visible { outline: 3px solid rgba(255,255,255,0.7); outline-offset: -3px; }
        .nav-item.active { background: rgba(255,255,255,0.10); color: var(--ui-branco); font-weight: var(--fw-bold); }
        .nav-item.active .nav-icon, .nav-item--group.active-parent .nav-icon { color: #FF9DC4; }
        .nav-item--group.active-parent { color: var(--ui-branco); font-weight: var(--fw-bold); }

        /* (13/10) topo numa linha: logo, saudação + plano, sino */
        .sb-topo { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 52px; padding: 2px 0 12px 4px; margin: 0 0 8px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .sb-marca { display: flex; align-items: center; padding: 0; border: 0; background: none; cursor: pointer; }
        .sb-marca:focus-visible { outline: 3px solid rgba(255,255,255,0.7); outline-offset: 3px; border-radius: 6px; }
        .sb-marca-nome { display: block; height: 34px; width: auto; }
        .sb-marca-masc { display: block; width: 40px; height: 40px; object-fit: contain; }
        .sb-logo { position: relative; flex: none; width: 42px; height: 42px; padding: 0; border: 2px solid var(--ui-branco); border-radius: 50%; background: #993556; overflow: visible; cursor: pointer; }
        .sb-logo img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; background: #F8F5F6; display: block; }
        .sb-logo-letra { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 18px; font-weight: 700; color: var(--primary-light); }
        .sb-logo-cam { position: absolute; right: -4px; bottom: -4px; display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border: 2px solid var(--sidebar-bg); border-radius: 50%; background: var(--primary); color: var(--ui-branco); }
        .sb-logo:focus-visible { outline: 3px solid rgba(255,255,255,0.7); outline-offset: 2px; }
        .sb-quem { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
        .sb-ola { display: block; max-width: 100%; font-size: 14px; font-weight: 700; color: var(--ui-branco); line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb-plano { display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border: 0; border-radius: 6px; font-family: inherit; font-size: 11px; font-weight: 700; line-height: 1; white-space: nowrap; }
        .sb-plano--pro { background: rgba(255,255,255,0.10); color: var(--ui-branco); } .sb-plano--pro svg { color: #FF9DC4; }
        .sb-plano--seja { background: var(--ui-branco); color: var(--primary); cursor: pointer; } .sb-plano--seja:hover { transform: translateY(-1px); }
        .sb-plano--skel { width: 56px; height: 17px; background: rgba(255,255,255,0.12); }
        .sb-linha2 { display: flex; align-items: center; justify-content: space-between; gap: 6px; width: 100%; }
        .sb-pausar { margin: 12px 0 28px; flex-shrink: 0; } /* o 28px é o espaço da sombra do fim do menu, que não pode apagar o cartão */
        /* (19/10) a linha embaixo do logo fecha na mesma altura da faixa de cima (60px) */
        .sidebar:not(.x) .sb-topo { box-sizing: border-box; height: 60px; min-height: 60px; margin: -1rem -1rem 8px; padding: 0 1rem 0 calc(1rem + 4px); }
        @media (max-height: 820px) { .sidebar:not(.x) .sb-topo { margin-top: -0.5rem; } }
        .menu-recolhido .sidebar:not(.x) .sb-topo { height: auto; min-height: 52px; margin: 0 0 8px; padding: 2px 0 12px; }
        .sb-topo .sidebar-sino { position: relative; top: auto; right: auto; flex: none; width: 36px; height: 36px; border-radius: 10px; }
        .sb-topo .sidebar-sino .sidebar-sino-n { top: -4px; right: -5px; }
        .nav-item--grupo .nav-seta { margin-left: auto; transition: transform var(--dur-fast) linear; }
        .nav-item--grupo .nav-seta.aberta { transform: rotate(180deg); }
        .nav-grupo .nav-group-body { margin-left: 12px; padding-left: 8px; }
        .nav-grupo .nav-group-body .nav-subitem { min-height: 36px; padding: 0 8px; gap: 7px; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .nav-sec { margin: 8px 0 2px 10px; font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,0.4); }
        .sb-pe { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; }
        .sb-versao { padding-left: 6px; font-size: 11.5px; color: rgba(255,255,255,0.45); }
        .sb-recolher { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 0; border-radius: 8px; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7); cursor: pointer; }
        .sb-recolher:hover { background: rgba(255,255,255,0.12); color: var(--ui-branco); }
        /* recolhido: só os ícones */
        .menu-recolhido .sidebar { padding-left: 0.6rem; padding-right: 0.6rem; }
        .menu-recolhido .sb-topo { flex-direction: column; gap: 10px; }
        .menu-recolhido .sb-quem, .menu-recolhido .nav-rotulo, .menu-recolhido .nav-seta { display: none; }
        .menu-recolhido .nav-item { justify-content: center; padding: 0; }
        .menu-recolhido .sb-pe { justify-content: center; }
        .menu-recolhido .sidebar-nav { margin-right: 0; padding-right: 0; }
        .nav-group-body--fin .nav-subitem { min-height: 34px; font-size: 13px; }
        .nav-group-body { display: flex; flex-direction: column; gap: 2px; margin: 2px 0 6px 21px; padding-left: 9px; border-left: 1px solid rgba(255,255,255,0.14); }
        .nav-subitem { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 10px; border-radius: var(--ui-raio-p); font-size: 13.5px; font-weight: var(--fw-medium); color: rgba(255,255,255,0.78); text-decoration: none; transition: background-color var(--dur-fast) linear, color var(--dur-fast) linear; }
        .nav-subitem .nav-subicon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .nav-subitem:hover { color: var(--ui-branco); background: rgba(255,255,255,0.07); }
        .nav-subitem.active { color: var(--ui-branco); background: rgba(255,255,255,0.10); font-weight: var(--fw-bold); }
        .nav-subitem.active .nav-subicon { color: #FF9DC4; }

        .sidebar-cad-complete {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin: 0 0.25rem 1rem;
          padding: 0.75rem 0.5rem;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
          color: var(--ui-branco);
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
        .layout-main { margin-left: var(--sidebar-w, 220px); flex: 1; padding: 3rem 2rem 2rem; min-height: 100vh; min-width: 0; }
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
          @media (hover: hover) { .bn-item:hover { color: var(--ui-branco); } .bn-item--active:hover { color: #FF9DC4; } }
          .bn-item--active { color: #FF9DC4; }
          .bn-item--active::before {
            content: "";
            position: absolute;
            top: 0; left: 50%;
            width: 28px; height: 3px; margin-left: -14px;
            background: currentColor;
            border-radius: 0 0 3px 3px;
          }
          .bn-item:focus-visible { outline: 3px solid rgba(255, 255, 255, 0.7); outline-offset: -4px; border-radius: var(--ui-raio); }
          .bn-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            color: inherit;
            transition: transform var(--dur-fast) var(--ease-out);
          }
          .bn-item:active .bn-icon { transform: scale(0.9); }
          .bn-icon { position: relative; }
          .bn-bolinha { position: absolute; top: -6px; left: 14px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--primary, #E8578E); color: #fff; font-size: 11px; font-weight: 700; line-height: 18px; text-align: center; box-shadow: 0 0 0 2px var(--vinho-profundo); }
          .bn-label {
            font-size: 12px;
            font-weight: 500; /* (09/10 · 3.97) era 600: o guia usa 500 no texto de apoio e 700 no que está marcado */
            color: inherit;
            white-space: nowrap;
            line-height: 1;
          }
          .bn-item--active .bn-label { font-weight: 700; }
          /* (16/10) Nova venda no meio do menu: o círculo rosa sobe um pouco acima da barra */
          .bn-novo { overflow: visible; }
          .bn-novo-c { display: flex; align-items: center; justify-content: center; width: 52px; height: 52px; margin-top: -18px; border-radius: 50%; background: var(--ui-rosa); color: var(--ui-branco); box-shadow: 0 6px 16px rgba(31, 7, 17, .45), 0 0 0 4px var(--vinho-profundo); transition: transform var(--dur-fast) var(--ease-out); }
          .bn-novo:active .bn-novo-c { transform: scale(.92); }


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
          .gestao-item.active .gestao-icon { color: var(--ui-branco); background: rgba(255,255,255,0.2); }
          .gestao-label { font-size: var(--font-caption); font-weight: 700; color: var(--text-title); text-align: center; font-family: var(--font-base); line-height: 1.25; white-space: normal; word-break: break-word; }
          .gestao-item.active .gestao-label { color: var(--ui-branco); }
        }
      `}</style>
    </div>
  );
}
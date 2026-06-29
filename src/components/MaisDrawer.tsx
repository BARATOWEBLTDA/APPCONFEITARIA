import { useEffect, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChartBar, CurrencyDollar, ChartLineUp, Percent,
  Users, Kanban,
  Package, BookOpen, Files, Bell, ClipboardText,
  Gear, PaintBrush, Crown,
  X,
} from "@phosphor-icons/react";
import { useProfile } from "@/hooks/useProfile";

interface MaisDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface DrawerItem {
  label: string;
  path: string;
  icon: ReactElement;
}

interface DrawerGroup {
  label: string;
  items: DrawerItem[];
}

const GROUPS: DrawerGroup[] = [
  {
    label: "Negócio",
    items: [
      { label: "Dashboard",      path: "/dashboard",      icon: <ChartBar      size={20} weight="duotone" /> },
      { label: "Financeiro",     path: "/financeiro",     icon: <CurrencyDollar size={20} weight="duotone" /> },
      { label: "Lucratividade",  path: "/lucratividade",  icon: <ChartLineUp   size={20} weight="duotone" /> },
      { label: "Promoções",      path: "/promocoes",      icon: <Percent       size={20} weight="duotone" /> },
    ],
  },
  {
    label: "Clientes",
    items: [
      { label: "Clientes",          path: "/clientes",       icon: <Users  size={20} weight="duotone" /> },
      { label: "Kanban de pedidos", path: "/pedidos-kanban", icon: <Kanban size={20} weight="duotone" /> },
    ],
  },
  {
    label: "Operação",
    items: [
      { label: "Ingredientes",    path: "/insumos",        icon: <Package        size={20} weight="duotone" /> },
      { label: "Precificação", path: "/ficha-tecnica",  icon: <ClipboardText  size={20} weight="duotone" /> },
      { label: "Estoque",      path: "/estoque",       icon: <Package  size={20} weight="duotone" /> },
      { label: "Receitas",     path: "/receitas",      icon: <BookOpen size={20} weight="duotone" /> },
      { label: "Arquivos",     path: "/arquivos",      icon: <Files    size={20} weight="duotone" /> },
      { label: "Notificações", path: "/notificacoes",  icon: <Bell     size={20} weight="duotone" /> },
    ],
  },
  {
    label: "Conta",
    items: [
      { label: "Personalização", path: "/personalizacao", icon: <PaintBrush size={20} weight="duotone" /> },
      { label: "Configurações",  path: "/configuracoes",  icon: <Gear       size={20} weight="duotone" /> },
      { label: "Assinatura",     path: "/assinar",        icon: <Crown      size={20} weight="duotone" /> },
    ],
  },
];

/** Retorna "Bom dia" (5h–11h), "Boa tarde" (12h–17h) ou "Boa noite" (18h–4h). */
function saudacao(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function MaisDrawer({ open, onClose }: MaisDrawerProps) {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const primeiroNome = profile?.nome ? profile.nome.trim().split(/\s+/)[0] : "";

  // Bloqueia scroll do body quando aberto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Fecha com ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const go = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`mais-overlay ${open ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`mais-drawer ${open ? "open" : ""}`}
        role="dialog"
        aria-label="Menu Mais"
        aria-modal="true"
      >
        <div className="mais-handle" />

        <div className="mais-head">
          <div className="mais-greeting">
            <div className="mais-avatar">
              <div className="mais-avatar-inner">
                <img src="/Sistema/doo.png" alt="" aria-hidden="true" />
              </div>
            </div>
            <div className="mais-greeting-text">
              <p className="mais-greeting-line1">
                {saudacao()}{primeiroNome ? `, ${primeiroNome}` : ""}
              </p>
              <p className="mais-greeting-line2">Vamos gerenciar sua confeitaria?</p>
            </div>
          </div>
          <button className="mais-close" onClick={onClose} aria-label="Fechar">
            <X size={20} weight="bold" />
          </button>
        </div>

        <div className="mais-body">
          {GROUPS.map((group) => (
            <section key={group.label} className="mais-group">
              <h3 className="mais-group-label">{group.label}</h3>
              <div className="mais-items">
                {group.items.map((item) => (
                  <button
                    key={item.path}
                    className="mais-item"
                    onClick={() => go(item.path)}
                  >
                    <span className="mais-item-icon">{item.icon}</span>
                    <span className="mais-item-label">{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </aside>

      <style>{`
        .mais-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0);
          z-index: 1000;
          pointer-events: none;
          transition: background var(--dur-normal) var(--ease-out);
        }
        .mais-overlay.open {
          background: rgba(0,0,0,0.45);
          pointer-events: all;
        }

        .mais-drawer {
          position: fixed;
          left: 0; right: 0; bottom: 0;
          z-index: 1001;
          background: #fff;
          border-radius: var(--radius-xl) 24px 0 0;
          padding: 0.5rem 0 1rem;
          max-height: 88vh;
          display: flex; flex-direction: column;
          transform: translateY(100%);
          transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
          box-shadow: 0 -8px 32px rgba(0,0,0,0.18);
          font-family: 'Geist', sans-serif;
        }
        .mais-drawer.open {
          transform: translateY(0);
        }

        .mais-handle {
          width: 36px; height: 4px;
          background: #E9E9EE;
          border-radius: var(--radius-full);
          margin: 0.5rem auto 0.25rem;
        }

        .mais-head {
          display: flex; align-items: center; justify-content: space-between;
          gap: 0.75rem;
          padding: 0.5rem 1.1rem 0.85rem;
        }
        .mais-greeting {
          display: flex; align-items: center; gap: 0.7rem;
          min-width: 0; flex: 1;
        }
        .mais-avatar {
          width: 44px; height: 44px;
          border-radius: 28%;
          background: #3d1a24;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(61, 26, 36, 0.22);
        }
        .mais-avatar-inner {
          width: 36px; height: 36px;
          border-radius: 26%;
          background: #fff;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }
        .mais-avatar-inner img {
          width: 46px; height: 46px;
          object-fit: cover;
          object-position: top center;
        }
        .mais-greeting-text {
          display: flex; flex-direction: column;
          min-width: 0;
        }
        .mais-greeting-line1 {
          font-size: var(--font-modal-title); font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0;
          letter-spacing: -0.01em;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mais-greeting-line2 {
          font-size: var(--font-helper);
          color: var(--text-secondary);
          margin: 3px 0 0;
          line-height: 1.3;
        }
        .mais-close {
          width: 34px; height: 34px;
          border: none; border-radius: var(--radius-md);
          background: #F4F4F6; color: #6B7280;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .mais-close:hover { background: #E9E9EE; }

        .mais-body {
          overflow-y: auto;
          padding: 0.5rem 1rem 1rem;
          display: flex; flex-direction: column;
          gap: 1.1rem;
        }

        .mais-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .mais-group-label {
          font-size: var(--font-caption);
          font-weight: var(--fw-bold);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: #9CA3AF;
          margin: 0 0 0 0.3rem;
        }
        .mais-items {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 0.45rem;
        }
        .mais-item {
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.7rem 0.85rem;
          background: #F7F7F8;
          border: 1px solid transparent;
          border-radius: var(--radius-md);
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          transition: all var(--dur-fast) var(--ease-out);
        }
        .mais-item:hover {
          background: #FFF1F7;
          border-color: #3d1a24;
        }
        .mais-item-icon {
          width: 30px; height: 30px;
          display: flex; align-items: center; justify-content: center;
          color: #3d1a24;
          flex-shrink: 0;
        }
        .mais-item-label {
          font-size: var(--font-button); font-weight: var(--fw-semibold);
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Desktop: drawer não aparece (sidebar já cobre tudo) */
        @media (min-width: 768px) {
          .mais-drawer, .mais-overlay { display: none; }
        }
      `}</style>
    </>
  );
}

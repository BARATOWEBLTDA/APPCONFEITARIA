import { useEffect, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import {
  CurrencyDollar, ChartLineUp,
  Package, BookOpen, Files, ClipboardText,
  Gear, PaintBrush, Crown,
  SquaresFour, UserPlus, Storefront,
  X, CaretRight,
  Trophy,
} from "@phosphor-icons/react";
import { useProfile } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";

interface MaisDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface DrawerItem {
  label: string;
  desc: string;
  path: string;
  icon: ReactElement;
}

interface DrawerGroup {
  label: string;
  items: DrawerItem[];
}

const GROUPS: DrawerGroup[] = [
  {
    label: "Cadastros",
    items: [
      { label: "Categorias",    desc: "Organize seus produtos",   path: "/categorias",    icon: <SquaresFour   size={16} weight="bold" /> },
      { label: "Ingredientes",  desc: "Insumos e custos",         path: "/insumos",       icon: <Package       size={16} weight="bold" /> },
      { label: "Receitas",      desc: "Suas receitas",            path: "/receitas",      icon: <BookOpen      size={16} weight="bold" /> },
      { label: "Ficha técnica", desc: "Calcule o custo real",     path: "/ficha-tecnica", icon: <ClipboardText size={16} weight="bold" /> },
    ],
  },
  {
    label: "Análises",
    items: [
      { label: "Lucratividade", desc: "Análise de margem",       path: "/lucratividade",         icon: <ChartLineUp    size={16} weight="bold" /> },
      { label: "Transações",    desc: "Histórico detalhado",     path: "/financeiro/transacoes", icon: <CurrencyDollar size={16} weight="bold" /> },
    ],
  },
  {
    label: "Configuração",
    items: [
      { label: "Cardápio Design", desc: "Personalize o cardápio", path: "/cardapio-design", icon: <PaintBrush size={16} weight="bold" /> },
      { label: "Checkout",        desc: "Configure o pagamento",   path: "/checkout-config", icon: <Storefront size={16} weight="bold" /> },
      { label: "Configurações",   desc: "Ajustes gerais do app",   path: "/configuracoes",   icon: <Gear       size={16} weight="bold" /> },
    ],
  },
  {
    label: "Meu plano",
    items: [
      { label: "Minhas conquistas", desc: "Suas medalhas",      path: "/conquistas", icon: <Trophy size={16} weight="bold" /> },
      { label: "Assinatura",    desc: "Gerencie seu PRO",         path: "/assinar",  icon: <Crown    size={16} weight="bold" /> },
      { label: "Indicar amigo", desc: "Ganhe indicando",          path: "/indicar",  icon: <UserPlus size={16} weight="bold" /> },
      { label: "Meus arquivos", desc: "PDFs e materiais",         path: "/arquivos", icon: <Files    size={16} weight="bold" /> },
    ],
  },
];

function saudacao(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function MaisDrawer({ open, onClose }: MaisDrawerProps) {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { isPro } = usePlano();
  const primeiroNome = profile?.nome ? profile.nome.trim().split(/\s+/)[0] : "";
  const inicial = (profile?.nome || "?").trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const go = (path: string) => { navigate(path); onClose(); };

  return (
    <>
      <div className={`mais-overlay ${open ? "open" : ""}`} onClick={onClose} aria-hidden="true" />

      <aside className={`mais-drawer ${open ? "open" : ""}`} role="dialog" aria-label="Menu" aria-modal="true">
        <div className="mais-handle" />

        <div className="mais-head">
          <div className="mais-greeting">
            {profile?.foto_url ? (
              <div className="mais-avt"><img src={profile.foto_url} alt="" /></div>
            ) : (
              <div className="mais-avt mais-avt--letter">{inicial}</div>
            )}
            <div className="mais-greeting-text">
              <p className="mais-greeting-line1">
                {saudacao()}{primeiroNome ? `, ${primeiroNome}` : ""}
                {isPro && (
                  <span className="mais-pro">
                    <img src="/coroa.png" alt="" />
                    PRO
                  </span>
                )}
              </p>
              <p className="mais-greeting-line2">O que quer fazer hoje?</p>
            </div>
          </div>
          <button className="mais-close" onClick={onClose} aria-label="Fechar">
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="mais-body">
          {GROUPS.map((group) => (
            <div key={group.label} className="mais-card">
              <p className="mais-sec-lbl">{group.label}</p>
              {group.items.map((item) => (
                <button key={item.path} className="mais-it" onClick={() => go(item.path === "/assinar" && isPro ? "/minha-assinatura" : item.path)}>
                  <span className="mais-it-ic">{item.icon}</span>
                  <div className="mais-it-txt">
                    <div className="mais-it-t">{item.label}</div>
                    <div className="mais-it-d">{item.desc}</div>
                  </div>
                  <CaretRight size={14} weight="bold" className="mais-it-arr" />
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <style>{`
        .mais-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0);
          z-index: 1000;
          pointer-events: none;
          transition: background 0.3s;
        }
        .mais-overlay.open { background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); pointer-events: all; }

        .mais-drawer {
          position: fixed;
          left: 0; right: 0; bottom: 0;
          z-index: 1001;
          background: #F8F5F6;
          border-radius: 20px 20px 0 0;
          max-height: 88vh;
          display: flex; flex-direction: column;
          transform: translateY(100%);
          transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
          box-shadow: 0 -8px 32px rgba(0,0,0,0.18);
          font-family: 'Geist', sans-serif;
          overflow: hidden;
        }
        .mais-drawer.open { transform: translateY(0); }

        .mais-handle { width: 36px; height: 4px; background: #E9E9EE; border-radius: 2px; margin: 8px auto 4px; }

        .mais-head {
          padding: 8px 18px 14px;
          display: flex; align-items: center; gap: 10px;
          background: linear-gradient(180deg, #FFF5F9 0%, #F8F5F6 100%);
        }
        .mais-greeting { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
        .mais-avt {
          width: 44px; height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #FCE0E9, #E85A8C);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }
        .mais-avt img { width: 100%; height: 100%; object-fit: cover; }
        .mais-avt--letter { color: #fff; font-weight: 900; font-size: 16px; }
        .mais-greeting-text { flex: 1; min-width: 0; }
        .mais-greeting-line1 {
          font-size: 15px; font-weight: 900;
          color: #2C1219;
          margin: 0;
          display: flex; align-items: center; gap: 6px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .mais-greeting-line2 {
          font-size: 11.5px;
          color: #6B7280;
          margin: 2px 0 0;
        }
        .mais-pro {
          background: #2D1F26;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 6px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          line-height: 1;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        .mais-pro img { width: 10px; height: 10px; object-fit: contain; display: block; flex-shrink: 0; }
        .mais-close {
          width: 34px; height: 34px;
          border: none; border-radius: 8px;
          background: #F4F4F6; color: #6B7280;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .mais-close:hover { background: #E9E9EE; }

        .mais-body {
          overflow-y: auto;
          padding: 8px 12px 24px;
        }

        .mais-card {
          background: #fff;
          border-radius: 12px;
          border: 1px solid #F0EBED;
          padding: 4px;
          margin-bottom: 10px;
        }
        .mais-sec-lbl {
          font-size: 10px; font-weight: 800;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: #9CA3AF;
          margin: 8px 10px 4px;
          padding-top: 4px;
        }
        .mais-it {
          display: flex; align-items: center; gap: 12px;
          width: 100%;
          padding: 11px 10px;
          background: transparent;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          transition: background 0.15s;
        }
        .mais-it + .mais-it { border-top: 1px solid #F5F0F2; border-radius: 0; }
        .mais-it:first-of-type { border-radius: 8px 8px 0 0; }
        .mais-it:last-of-type { border-radius: 0 0 8px 8px; }
        .mais-it:only-of-type { border-radius: 8px; }
        .mais-it:hover, .mais-it:active { background: #FAFAFA; }
        .mais-it-ic {
          width: 32px; height: 32px;
          background: #F5F0F2;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          color: #2C1219;
          flex-shrink: 0;
        }
        .mais-it-txt { flex: 1; min-width: 0; }
        .mais-it-t {
          font-size: 13px; font-weight: 700;
          color: #2C1219;
          line-height: 1.2;
        }
        .mais-it-d {
          font-size: 10.5px;
          color: #9CA3AF;
          margin-top: 1px;
          line-height: 1.3;
        }
        .mais-it-arr {
          color: #C0B3B8;
          flex-shrink: 0;
        }

        @media (min-width: 768px) {
          .mais-drawer, .mais-overlay { display: none; }
        }
      `}</style>
    </>
  );
}

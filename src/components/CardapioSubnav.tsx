import { useNavigate, useLocation } from "react-router-dom";
import { useProfile, getCardapioUrl } from "@/hooks/useProfile";

/**
 * Menu lateral do Cardápio digital — SÓ NO COMPUTADOR (02/10).
 * Fica ao lado do menu do app em todas as telas do cardápio, pra trocar de tela sem voltar.
 * No celular ele não aparece (lá continua o voltar de cada tela).
 */
export const ROTAS_CARDAPIO = ["/cardapio", "/cardapio-config", "/cardapio-design", "/checkout-config", "/produtos", "/produtos/categorias", "/categorias", "/complementos"];

const GRUPOS: { titulo: string; itens: { label: string; ico: string; path: string; tambem?: string[] }[] }[] = [
  { titulo: "Cardápio digital", itens: [{ label: "Visão geral", ico: "📊", path: "/cardapio" }] },
  { titulo: "Configuração da loja", itens: [
    { label: "Dados da loja", ico: "🏪", path: "/cardapio-config" },
    { label: "Aparência", ico: "🎨", path: "/cardapio-design" },
    { label: "Entrega e pagamento", ico: "🚚", path: "/checkout-config" },
  ] },
  { titulo: "Catálogo", itens: [
    { label: "Produtos", ico: "🧁", path: "/produtos" },
    { label: "Categorias", ico: "🗂️", path: "/categorias", tambem: ["/produtos/categorias"] },
    { label: "Personalização", ico: "✨", path: "/complementos" },
  ] },
];

export default function CardapioSubnav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile } = useProfile();
  const link = profile ? getCardapioUrl(profile) : "";

  return (
    <aside className="cdnav" aria-label="Telas do cardápio digital">
      {GRUPOS.map((g, gi) => (
        <div key={g.titulo}>
          {gi > 0 && <div className="cdnav-sep" />}
          <p className="cdnav-t">{g.titulo}</p>
          {g.itens.map(it => {
            const ativo = pathname === it.path || (it.tambem || []).includes(pathname);
            return (
              <button key={it.path} type="button" className={`cdnav-i${ativo ? " on" : ""}`} onClick={() => navigate(it.path)} aria-current={ativo ? "page" : undefined}>
                <i aria-hidden="true">{it.ico}</i>{it.label}
              </button>
            );
          })}
        </div>
      ))}
      {link && (
        <a className="cdnav-ver" href={link} target="_blank" rel="noopener noreferrer">👁️ Ver meu cardápio ↗</a>
      )}
      <style>{`
        .cdnav { display: none; }
        @media (min-width: 1024px) {
          .cdnav { display: block; position: fixed; top: 0; bottom: 0; left: 220px; width: 236px; z-index: 9; overflow-y: auto;
            background: #fff; border-right: 1px solid #F0EBED; padding: 22px 12px; font-family: var(--font-base); }
          .layout-root.com-cdnav .layout-main { margin-left: calc(220px + 236px) !important; }
        }
        .cdnav-t { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #9A8E94; padding: 8px 10px 6px; margin: 0; }
        .cdnav-i { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border: none; border-radius: 10px; background: none;
          font-family: inherit; font-size: 13.5px; font-weight: 600; color: #4B3A42; cursor: pointer; text-align: left; transition: background .15s; }
        .cdnav-i:hover { background: #FAF5F7; }
        .cdnav-i i { width: 30px; height: 30px; border-radius: 9px; background: #F5F0F2; display: flex; align-items: center; justify-content: center; font-style: normal; font-size: 15px; flex-shrink: 0; }
        .cdnav-i.on { background: #FFF1F6; color: #C33A6E; font-weight: 800; }
        .cdnav-i.on i { background: #FCE7F3; }
        .cdnav-sep { height: 1px; background: #F3ECEF; margin: 8px 4px; }
        .cdnav-ver { display: flex; justify-content: center; gap: 6px; margin-top: 12px; padding: 10px; border-radius: 10px; border: 1.5px dashed #F3C9DA;
          color: #C33A6E; font-size: 13px; font-weight: 700; text-decoration: none; }
        .cdnav-ver:hover { background: #FFF6F9; }
      `}</style>
    </aside>
  );
}

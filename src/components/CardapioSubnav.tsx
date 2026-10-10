import { useNavigate, useLocation } from "react-router-dom";
import { ArrowSquareOut, ChartBar, Package, Palette, SquaresFour, Stack, Storefront, Truck } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useProfile, getCardapioUrl } from "@/hooks/useProfile";

/**
 * Menu lateral do Cardápio digital — SÓ NO COMPUTADOR (02/10).
 * Fica ao lado do menu do app em todas as telas do cardápio, pra trocar de tela sem voltar.
 * No celular ele não aparece (lá continua o voltar de cada tela).
 * (08/10 · 3.21) Ícones do app no lugar dos emojis, títulos sem caixa alta, itens de 44px
 * e o Catálogo antes da Configuração da loja (é o que se usa mais).
 */
export const ROTAS_CARDAPIO = ["/cardapio", "/cardapio-config", "/cardapio-design", "/checkout-config", "/produtos", "/produtos/categorias", "/categorias", "/complementos"];

const GRUPOS: { titulo: string; itens: { label: string; Ic: Icon; path: string; tambem?: string[] }[] }[] = [
  { titulo: "Cardápio digital", itens: [{ label: "Visão geral", Ic: ChartBar, path: "/cardapio" }] },
  { titulo: "Catálogo", itens: [
    { label: "Produtos", Ic: Package, path: "/produtos" },
    { label: "Categorias", Ic: SquaresFour, path: "/categorias", tambem: ["/produtos/categorias"] },
    { label: "Personalização", Ic: Stack, path: "/complementos" },
  ] },
  { titulo: "Configuração da loja", itens: [
    { label: "Dados da loja", Ic: Storefront, path: "/cardapio-config" },
    { label: "Aparência", Ic: Palette, path: "/cardapio-design" },
    { label: "Entrega e pagamento", Ic: Truck, path: "/checkout-config" },
  ] },
];

export default function CardapioSubnav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile } = useProfile();
  const link = profile ? getCardapioUrl(profile) : "";

  return (
    <aside className="cdnav" aria-label="Telas do cardápio digital">
      {GRUPOS.map(g => (
        <div key={g.titulo} className="cdnav-g">
          <p className="cdnav-t">{g.titulo}</p>
          {g.itens.map(({ label, Ic, path, tambem }) => {
            const ativo = pathname === path || (tambem || []).includes(pathname);
            return (
              <button key={path} type="button" className={`cdnav-i${ativo ? " on" : ""}`} onClick={() => navigate(path)} aria-current={ativo ? "page" : undefined}>
                <Ic size={20} weight={ativo ? "fill" : "bold"} aria-hidden="true" />{label}
              </button>
            );
          })}
        </div>
      ))}
      {link && (
        <a className="cdnav-ver" href={link} target="_blank" rel="noopener noreferrer">
          <ArrowSquareOut size={20} weight="bold" aria-hidden="true" />Ver meu cardápio
        </a>
      )}
      <style>{`
        .cdnav { display: none; }
        @media (min-width: 1024px) {
          /* 02/10: o menu começa embaixo do cabeçalho rosa (que agora vai até o menu escuro) e tem o cinza da página */
          .cdnav { display: block; position: fixed; top: 96px; bottom: 0; left: 220px; width: 236px; z-index: 9; overflow-y: auto;
            background: #F6F3F4; border-right: none; padding: 16px 12px; font-family: var(--font-base); }
          .layout-root.com-cdnav .layout-main { margin-left: calc(220px + 236px) !important; background: #F6F3F4; min-height: 100vh; }
          .layout-root.com-cdnav .cab { margin-left: calc(-236px - 2rem) !important; padding-left: calc(236px + 2rem) !important; }
        }
        .cdnav-g + .cdnav-g { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--ui-borda); }
        .cdnav-t { margin: 0; padding: 4px 12px 6px; font-size: 12.5px; font-weight: 700; color: var(--ui-texto-3); }
        .cdnav-i { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; margin: 0; padding: 0 10px; white-space: nowrap; border: 0; border-radius: var(--ui-raio);
          background: none; color: var(--ui-texto); font-family: inherit; font-size: 15px; font-weight: 500; text-align: left; cursor: pointer; transition: background-color var(--dur-fast) linear; }
        .cdnav-i svg { flex: none; color: var(--ui-texto-2); }
        .cdnav-i:hover { background: #EFE9EC; }
        .cdnav-i:focus-visible, .cdnav-ver:focus-visible { outline: 3px solid rgba(var(--ui-rosa-rgb), .45); outline-offset: 2px; }
        .cdnav-i.on { background: var(--ui-branco); color: var(--ui-rosa-escuro); font-weight: 700; box-shadow: var(--ui-sombra-cartao); }
        .cdnav-i.on svg { color: var(--ui-rosa-escuro); }
        .cdnav-ver { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; margin-top: 16px; border-radius: var(--ui-raio);
          background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); font-size: 15px; font-weight: 700; text-decoration: none; }
        .cdnav-ver:hover { filter: brightness(.97); }
      `}</style>
    </aside>
  );
}

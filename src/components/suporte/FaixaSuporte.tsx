/**
 * (11/11) Modo suporte: a faixa no topo da aba aberta pela equipe Doonly. Mostra em qual loja está,
 * os atalhos das telas liberadas (cardápio e produtos) e o "Sair". Confere o prazo a cada 5 min:
 * se ela tirou o acesso ou venceu, sai sozinho.
 */
import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { ShieldCheck, SignOut } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { sessaoSuporte, sairDoSuporte, acessoValido, type AcessoSuporte } from "@/lib/acessoSuporte";

const ABAS = [
  { to: "/cardapio-design", t: "Aparência" },
  { to: "/cardapio-config", t: "Dados da loja" },
  { to: "/produtos", t: "Produtos" },
  { to: "/categorias", t: "Categorias" },
  { to: "/complementos", t: "Adicionais" },
];

export default function FaixaSuporte() {
  const s = sessaoSuporte();
  useEffect(() => {
    if (!s?.acessoId) return;
    const conferir = async () => {
      const { data } = await supabase.from("acessos_suporte").select("id, status, expira_em").eq("id", s.acessoId).maybeSingle();
      if (!data || !acessoValido(data as AcessoSuporte)) { await sairDoSuporte(); window.location.reload(); }
    };
    void conferir();
    const t = window.setInterval(conferir, 5 * 60 * 1000);
    return () => window.clearInterval(t);
  }, [s?.acessoId]);
  const sair = async () => { await sairDoSuporte(); window.close(); window.location.reload(); };
  const ate = s?.expira ? new Date(s.expira).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
  return (
    <div className="fsup" role="region" aria-label="Modo suporte">
      <div className="fsup-l">
        <span className="fsup-ic" aria-hidden="true"><ShieldCheck size={18} weight="bold" /></span>
        <span className="fsup-tx"><b>Modo suporte</b><small>{s?.loja || "Loja"}{ate ? ` · até ${ate}` : ""}</small></span>
      </div>
      <nav className="fsup-abas" aria-label="Telas liberadas">
        {ABAS.map(a => <NavLink key={a.to} to={a.to} className={({ isActive }) => `fsup-aba${isActive ? " on" : ""}`}>{a.t}</NavLink>)}
      </nav>
      <button type="button" className="fsup-sair" onClick={sair}><SignOut size={16} weight="bold" aria-hidden="true" />Sair</button>
      <style>{`
        .fsup { position: sticky; top: 0; z-index: 1200; display: flex; align-items: center; gap: 16px; min-height: 56px; padding: 8px max(16px, env(safe-area-inset-right, 0px)) 8px max(16px, env(safe-area-inset-left, 0px)); background: #2C1219; color: #fff; font-family: var(--font-base); }
        .fsup-l { display: flex; align-items: center; gap: 10px; flex: none; }
        .fsup-ic { display: flex; color: #5EE09A; }
        .fsup-tx b { display: block; font-size: 14px; font-weight: 500; }
        .fsup-tx small { display: block; font-size: 12px; color: rgba(255,255,255,.66); white-space: nowrap; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
        .fsup-abas { flex: 1; min-width: 0; display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; }
        .fsup-abas::-webkit-scrollbar { display: none; }
        .fsup-aba { flex: none; padding: 8px 12px; border-radius: 10px; color: rgba(255,255,255,.75); font-size: 13.5px; font-weight: 500; text-decoration: none; white-space: nowrap; }
        .fsup-aba:hover { background: rgba(255,255,255,.08); color: #fff; }
        .fsup-aba.on { background: rgba(255,255,255,.14); color: #fff; }
        .fsup-sair { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border: 1px solid rgba(255,255,255,.25); border-radius: 10px; background: none; color: #fff; font: inherit; font-size: 13.5px; font-weight: 500; cursor: pointer; }
        .fsup-sair:hover { background: rgba(255,255,255,.08); }
        /* sem o menu da confeiteira: a faixa é a navegação */
        .layout-root[data-suporte] .sidebar, .layout-root[data-suporte] .bottom-nav { display: none !important; }
        .layout-root[data-suporte] .layout-main { margin-left: 0 !important; }
        /* sino, PRO e foto são da confeiteira: no suporte, só a busca e o "Ver cardápio" ficam */
        .layout-root[data-suporte] .cab-sino-caixa, .layout-root[data-suporte] .cab-foto-caixa, .layout-root[data-suporte] .cab-seja-pro, .layout-root[data-suporte] .cab-cel-acoes, .layout-root[data-suporte] .cab-busca, .layout-root[data-suporte] .doo-fab { display: none !important; }
        .layout-root[data-suporte] { flex-direction: column; }
        @media (max-width: 760px) { .fsup { flex-wrap: wrap; gap: 8px 12px; } .fsup-abas { order: 3; flex-basis: 100%; } .fsup-l { flex: 1; } }
      `}</style>
    </div>
  );
}

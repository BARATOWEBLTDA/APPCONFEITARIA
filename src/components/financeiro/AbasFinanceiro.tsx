import { NavLink } from "react-router-dom";
import { Crown } from "@phosphor-icons/react";
import { usePlano } from "@/hooks/usePlano";

/**
 * (10/11) Celular: o Menu tem um item só ("Financeiro") e as partes ficam em abas no topo de cada tela
 * (como em app de banco). Passa de lado. No computador não aparece (o menu da esquerda já mostra as partes).
 */
const ABAS = [
  { to: "/financeiro", nome: "Resumo", end: true },
  { to: "/financeiro/transacoes", nome: "Transações" },
  { to: "/financeiro/a-receber", nome: "A receber" },
  { to: "/financeiro/a-pagar", nome: "A pagar" },
  { to: "/lucratividade", nome: "Lucro", pro: true },
];

export default function AbasFinanceiro() {
  const { isPro } = usePlano();
  return (
    <nav className="abf" aria-label="Partes do financeiro">
      {ABAS.map(a => (
        <NavLink key={a.to} to={a.to} end={a.end} replace className={({ isActive }) => `abf-it${isActive ? " on" : ""}`}>
          {a.nome}{a.pro && !isPro && <Crown size={12} weight="fill" aria-label="PRO" />}
        </NavLink>
      ))}
      <style>{`
        .abf { display: none; }
        @media (max-width: 900px) {
          .abf { display: flex; gap: 8px; margin: 0 0 12px; padding: 2px 16px 4px; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
          .abf::-webkit-scrollbar { display: none; }
          .abf-it { display: inline-flex; align-items: center; gap: 4px; flex: none; height: 36px; padding: 0 14px; border: 1px solid #E4DCDD; border-radius: 999px; background: #fff; font-family: var(--font-base); font-size: 13.5px; font-weight: 500; color: #5E5357; text-decoration: none; white-space: nowrap; -webkit-tap-highlight-color: transparent; }
          .abf-it svg { color: #C99A2E; }
          .abf-it.on { border-color: #3B3236; background: #3B3236; color: #fff; }
          .abf-it.on svg { color: #F5D27A; }
        }
      `}</style>
    </nav>
  );
}

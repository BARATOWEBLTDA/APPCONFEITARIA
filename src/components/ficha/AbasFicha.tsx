// (04/11 · 6.20) Ficha técnica e Ingredientes juntos: as duas abas no topo das duas telas
import { useNavigate } from "react-router-dom";
import { Egg, Receipt } from "@phosphor-icons/react";

export default function AbasFicha({ ativa }: { ativa: "receitas" | "ingredientes" }) {
  const navigate = useNavigate();
  return (
    <div className="abf" role="tablist" aria-label="Ficha técnica">
      <button type="button" role="tab" aria-selected={ativa === "receitas"} className={ativa === "receitas" ? "on" : ""} onClick={() => ativa !== "receitas" && navigate("/ficha-tecnica", { replace: true })}>
        <Receipt size={18} weight="bold" aria-hidden="true" />Receitas
      </button>
      <button type="button" role="tab" aria-selected={ativa === "ingredientes"} className={ativa === "ingredientes" ? "on" : ""} onClick={() => ativa !== "ingredientes" && navigate("/insumos", { replace: true })}>
        <Egg size={18} weight="bold" aria-hidden="true" />Ingredientes
      </button>
      <style>{`
        .abf { display: flex; gap: 4px; margin: 0 0 12px; padding: 4px; border-radius: 14px; background: #EFE9EC; }
        .abf button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 0 12px; border: 0; border-radius: 10px; background: none; font-family: inherit; font-size: 14.5px; font-weight: 500; color: var(--ui-texto-2); cursor: pointer; white-space: nowrap; }
        .abf button.on { background: var(--ui-branco); color: var(--ui-texto); font-weight: 600; box-shadow: 0 1px 3px rgba(44,18,25,.1); }
        @media (min-width: 900px) { .abf { display: inline-flex; } .abf button { flex: none; padding: 0 20px; } }
      `}</style>
    </div>
  );
}

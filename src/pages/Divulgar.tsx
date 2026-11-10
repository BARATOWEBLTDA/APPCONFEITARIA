import { useNavigate } from "react-router-dom";
import { CaretRight, Target, Ticket } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { usePlano } from "@/hooks/usePlano";
import "./divulgar.css";

/** (10/11) Divulgar: Cupons e Pixel numa tela só (no Menu do celular viraram um item) */
const OPCOES = [
  { to: "/cupons", nome: "Cupons", desc: "Descontos pra vender", Icone: Ticket },
  { to: "/pixel", nome: "Pixel", desc: "Meta, Google e TikTok", Icone: Target },
];

export default function Divulgar() {
  const navigate = useNavigate();
  const { isPro } = usePlano();
  return (
    <>
      <AppPageHeader title="Divulgar" subtitle="Traga mais clientes pro seu cardápio" voltar="/inicio" />
      <div className="dv">
        <div className="dv-lista">
          {OPCOES.map(o => (
            <button key={o.to} type="button" className="dv-it" onClick={() => navigate(o.to)}>
              <span className="dv-ic" aria-hidden="true"><o.Icone size={20} weight="bold" /></span>
              <span className="dv-tx"><b>{o.nome}</b><small>{o.desc}</small></span>
              {!isPro && <em className="dv-pro">PRO</em>}
              <CaretRight size={16} weight="bold" className="dv-seta" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

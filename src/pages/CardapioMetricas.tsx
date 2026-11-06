import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import DesempenhoCelular from "@/components/cardapio/DesempenhoCelular";
import { useProfile } from "@/hooks/useProfile";

/**
 * (6.170) Métricas do cardápio (celular): visitas em 7 ou 30 dias, comparação com o período anterior,
 * pedidos, vendido, conversão, o gráfico e os mais pedidos. Abre pela linha "Métricas" de Minha loja.
 * No computador essas métricas já estão na Visão geral do Cardápio digital: vai pra lá.
 */
export default function CardapioMetricas() {
  const { profile } = useProfile();
  const [ehComputador, setEhComputador] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const f = () => setEhComputador(mq.matches);
    mq.addEventListener?.("change", f);
    return () => mq.removeEventListener?.("change", f);
  }, []);
  if (ehComputador) return <Navigate to="/cardapio" replace />;

  return (
    <>
      <AppPageHeader title="Métricas" subtitle="Visitas e pedidos do cardápio" voltar="/cardapio" />
      <div className="cmet">
        <DesempenhoCelular uid={profile?.id} semTitulo />
        <style>{`.cmet { font-family: var(--font-base); max-width: 980px; margin: 0 auto; padding: 16px 8px 112px; }`}</style>
      </div>
    </>
  );
}

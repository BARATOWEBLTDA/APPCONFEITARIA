import AbasCel from "@/components/base/AbasCel";
import { usePlano } from "@/hooks/usePlano";

/** (10/11) Celular: as partes do Financeiro em abas no topo de cada tela (o Menu tem um item só) */
export default function AbasFinanceiro() {
  const { isPro } = usePlano();
  return <AbasCel rotulo="Partes do financeiro" abas={[
    { to: "/financeiro", nome: "Resumo", end: true },
    { to: "/financeiro/transacoes", nome: "Transações" },
    { to: "/financeiro/a-receber", nome: "A receber" },
    { to: "/financeiro/a-pagar", nome: "A pagar" },
    { to: "/lucratividade", nome: "Lucro", coroa: !isPro },
  ]} />;
}

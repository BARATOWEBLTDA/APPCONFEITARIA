import { ConvitePro } from "@/components/billing/RecursoPro";

/**
 * Janela "Você chegou ao limite do plano grátis" (produtos ou clientes).
 * 09/10 (3.57): na Janela do app (aviso), sem emojis.
 */
export default function LimitePlano({ tipo, limite, onClose }: { tipo: "produtos" | "clientes"; limite: number; onClose: () => void }) {
  const txt = tipo === "produtos"
    ? { t: "Mostre todo o seu cardápio", s: `No grátis, até ${limite} produtos ficam no cardápio ao mesmo tempo. No PRO, todos aparecem. Os que estão fora continuam salvos.` }
    : { t: "Toda a sua clientela num lugar só", s: `O grátis guarda até ${limite} clientes. No PRO, todas as clientes e o histórico de compras, sem limite. O que já cadastrou continua salvo.` };
  return <ConvitePro titulo={txt.t} texto={txt.s} onClose={onClose} />;
}

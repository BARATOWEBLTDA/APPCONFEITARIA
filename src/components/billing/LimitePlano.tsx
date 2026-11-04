import { ConvitePro } from "@/components/billing/RecursoPro";

/**
 * Janela "Você chegou ao limite do plano grátis" (produtos ou clientes).
 * 09/10 (3.57): na Janela do app (aviso), sem emojis.
 */
export default function LimitePlano({ tipo, limite, onClose }: { tipo: "produtos" | "clientes"; limite: number; onClose: () => void }) {
  // (04/11) no padrão dos convites do PRO (o de Orçamentos), dizendo o limite do grátis
  const texto = tipo === "produtos"
    ? `No grátis, até ${limite} produtos ficam no cardápio ao mesmo tempo. No PRO, todos aparecem. Os que estão fora continuam salvos.`
    : `O grátis guarda até ${limite} clientes. No PRO, todas as clientes e o que cada uma comprou. O que já cadastrou continua salvo.`;
  return <ConvitePro recurso={tipo} texto={texto} onClose={onClose} />;
}

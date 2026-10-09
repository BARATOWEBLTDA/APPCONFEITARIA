import { useNavigate } from "react-router-dom";
import { Crown } from "@phosphor-icons/react";
import { Botao, Janela } from "@/components/base";

/**
 * Janela "Você chegou ao limite do plano grátis" (produtos ou clientes).
 * 09/10 (3.57): na Janela do app (aviso), sem emojis.
 */
export default function LimitePlano({ tipo, limite, onClose }: { tipo: "produtos" | "clientes"; limite: number; onClose: () => void }) {
  const navigate = useNavigate();
  const txt = tipo === "produtos"
    ? { t: `Você chegou a ${limite} produtos`, s: `O plano grátis tem até ${limite} produtos no cardápio. No PRO, você cadastra todo o seu cardápio, sem limite. O que você já cadastrou continua salvo.` }
    : { t: `Você chegou a ${limite} clientes`, s: `O plano grátis guarda até ${limite} clientes. No PRO, toda a sua clientela e o histórico de compras ficam num lugar só, sem limite. O que você já cadastrou continua salvo.` };
  return (
    <Janela aberta aoFechar={onClose} titulo={txt.t} texto={txt.s} icone={<Crown size={32} weight="fill" />} tom="laranja"
      acoes={<><Botao variante="secundario" onClick={onClose}>Agora não</Botao><Botao variante="vinho" onClick={() => navigate("/assinar")} data-foco-inicial>Conhecer o PRO</Botao></>} />
  );
}

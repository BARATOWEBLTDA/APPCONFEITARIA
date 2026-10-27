import { useNavigate } from "react-router-dom";
import { Crown } from "@phosphor-icons/react";
import { Botao, Janela } from "@/components/base";

/**
 * (27/10) Recurso do PRO tocado numa conta grátis: explica o recurso e oferece "Conhecer o PRO"
 * (não leva direto para a página do PRO).
 */
export default function RecursoPro({ titulo, texto, onClose }: { titulo: string; texto: string; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <Janela aberta aoFechar={onClose} titulo={titulo} texto={texto} icone={<Crown size={32} weight="fill" />} tom="laranja"
      acoes={<><Botao variante="secundario" onClick={onClose}>Agora não</Botao><Botao variante="vinho" onClick={() => navigate("/assinar")} data-foco-inicial>Conhecer o PRO</Botao></>} />
  );
}

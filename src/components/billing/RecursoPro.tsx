import { useNavigate } from "react-router-dom";
import { SELO_TESTE } from "@/lib/beneficiosPro";
import { Crown } from "@phosphor-icons/react";
import { Botao, Janela } from "@/components/base";

/**
 * (27/10) Recurso do PRO tocado numa conta grátis: explica o recurso e oferece o teste grátis do PRO ("Testar grátis": o nome longo não cabe ao lado do "Agora não" no celular)
 * (não leva direto para a página do PRO).
 */
export default function RecursoPro({ titulo, texto, onClose }: { titulo: string; texto: string; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <Janela aberta aoFechar={onClose} titulo={titulo} texto={`${texto} Teste o PRO com ${SELO_TESTE}.`} icone={<Crown size={32} weight="fill" />} tom="laranja"
      acoes={<><Botao variante="secundario" onClick={onClose}>Agora não</Botao><Botao variante="vinho" onClick={() => navigate("/assinar")} data-foco-inicial>Testar grátis</Botao></>} />
  );
}

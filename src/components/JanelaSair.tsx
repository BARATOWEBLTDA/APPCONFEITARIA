import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Botao, Janela, avisar } from "@/components/base";
import { Mascote } from "@/components/marca/Mascote";
import { perfilAtual, sairDaConta } from "@/hooks/useProfile";
import "./menuConta.css";

/**
 * (09/11) A pergunta antes de sair da conta — a MESMA no menu da foto e em Configurações.
 * O Doo acenando, o primeiro nome da confeiteira e "Ficar" em destaque (sair não apaga nada).
 */
export default function JanelaSair({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const navigate = useNavigate();
  const [saindo, setSaindo] = useState(false);
  const primeiroNome = (perfilAtual()?.nome || "").trim().split(/\s+/)[0] || "";

  const sair = async () => {
    if (saindo) return;
    setSaindo(true);
    // (10/10) sai neste aparelho mesmo sem internet; só vai pro login quando a sessão daqui foi mesmo encerrada
    const saiu = await sairDaConta();
    setSaindo(false); aoFechar();
    if (!saiu) { avisar("Não deu para sair agora. Tente de novo.", { tipo: "erro" }); return; }
    navigate("/login");
  };

  return (
    <Janela
      aberta={aberta} aoFechar={() => { if (!saindo) aoFechar(); }}
      titulo={primeiroNome ? `Já vai, ${primeiroNome}?` : "Já vai?"}
      texto="Seus pedidos e o cardápio continuam funcionando. Quando voltar, é só entrar."
      icone={<Mascote pose="acenando" className="mc-sair-masc" />} tom="rosa"
      acoes={<>
        <Botao variante="secundario" onClick={sair} carregando={saindo}>Sair</Botao>
        <Botao onClick={aoFechar} disabled={saindo} data-foco-inicial>Ficar</Botao>
      </>}
    />
  );
}

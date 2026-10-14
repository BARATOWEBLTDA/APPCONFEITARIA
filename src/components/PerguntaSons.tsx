import { useEffect, useState } from "react";
import { SpeakerHigh } from "@phosphor-icons/react";
import { Botao, Janela } from "@/components/base";
import { sonsHabilitados, setSonsHabilitados, somPedidoHabilitado, setSomPedidoHabilitado, tocarSom } from "@/hooks/useSom";

/**
 * (14/10) Ao entrar no app: se os sons estão desligados, pergunta UMA vez se ela quer ligar.
 * Respondeu (sim ou não) ou fechou: não pergunta mais. Depois, só em Configurações › Notificações e sons.
 */
const CHAVE = "doonly_sons_perguntou";

export default function PerguntaSons() {
  const [aberta, setAberta] = useState(false);
  useEffect(() => {
    let jaPerguntou = true;
    try { jaPerguntou = localStorage.getItem(CHAVE) === "1"; } catch { /* sem armazenamento: não pergunta */ }
    if (jaPerguntou || (sonsHabilitados() && somPedidoHabilitado())) return;
    // espera a tela assentar e não aparece por cima de outra janela (boas-vindas, avisos…)
    const t = window.setTimeout(() => { if (!document.querySelector('[role="dialog"]')) setAberta(true); }, 2500);
    return () => window.clearTimeout(t);
  }, []);
  const responder = (ligar: boolean) => {
    try { localStorage.setItem(CHAVE, "1"); } catch { /* ok */ }
    if (ligar) { setSonsHabilitados(true); setSomPedidoHabilitado(true); tocarSom("sucesso"); }
    setAberta(false);
  };
  return (
    <Janela aberta={aberta} aoFechar={() => responder(false)} tipo="aviso" titulo="Ligar os sons do app?"
      icone={<SpeakerHigh size={32} />} texto="Com o som ligado, você ouve na hora quando chega um pedido novo."
      acoes={<><Botao variante="secundario" onClick={() => responder(false)}>Agora não</Botao><Botao onClick={() => responder(true)}>Ligar sons</Botao></>} />
  );
}

import { COMO_CARDAPIO, COMO_MINHA_LOJA, TOUR_CARDAPIO } from "@/lib/comoTelas";
import { compartilharCardapio } from "@/lib/compartilharCardapio";
import { useState, useEffect } from "react";
import VisaoGeralDesktop from "@/components/cardapio/VisaoGeralDesktop";
import { useNavigate } from "react-router-dom";
import { useProfile, getCardapioUrl, isPro } from "@/hooks/useProfile";
import AppPageHeader from "@/components/AppPageHeader";
import PassoAPassoCardapio from "@/components/PassoAPassoCardapio";
import CartaoLojaCelular from "@/components/cardapio/CartaoLojaCelular";
import MinhaLoja from "@/components/cardapio/MinhaLoja";

/**
 * Tela Cardápio.
 * Computador: Visão geral (VisaoGeralDesktop), com desempenho, visitas por dia e últimos pedidos.
 * Celular (23/10): "Minha loja", no estilo do Dora: o cartão da loja, a loja para o cliente, como você vende,
 * e o que você vende.
 */

export default function Cardapio() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const pro = isPro(profile);

  // Computador (com o menu lateral do cardápio): Visão geral nova, sem as listas de atalhos (02/10)
  const [ehComputador, setEhComputador] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const f = () => setEhComputador(mq.matches);
    mq.addEventListener?.("change", f);
    return () => mq.removeEventListener?.("change", f);
  }, []);

  // Nova arquitetura: cardápio publicado quando profile.codigo_publico existe.
  const linkCardapio = getCardapioUrl(profile);
  const publicado = !!profile?.codigo_publico;

  // ─── Ações ───
  const handleShare = async () => {
    if (!publicado) {
      navigate("/cardapio-config");
      return;
    }
    await compartilharCardapio(linkCardapio, profile?.nome_loja); // (16/10) nativo; no computador copia
  };

  // ─── Render ───
  return (
    <>
    <AppPageHeader
      title={ehComputador ? "Cardápio digital" : "Minha loja"}
      subtitle={ehComputador ? "A loja online da sua confeitaria" : "Cardápio, horário e entrega"}
      infoIcon="🛍️" infoComo={ehComputador ? COMO_CARDAPIO : COMO_MINHA_LOJA} infoTour={TOUR_CARDAPIO}
      infoContent={
        <>
          <p>Este é o <strong>cardápio digital</strong> que seus clientes acessam. Personalize as cores, adicione produtos, configure entrega e pagamento.</p>
          <p>Depois é só <strong>compartilhar o link</strong> no WhatsApp, Instagram, bio, ou onde preferir. Seus clientes fazem pedidos direto por lá.</p>
        </>
      }
      infoTip={<>Copie o link do seu cardápio e coloque na <strong>bio do Instagram</strong> ou envie no WhatsApp.</>}
    />
    {ehComputador ? (
      <VisaoGeralDesktop profile={profile} linkCardapio={linkCardapio} publicado={publicado} onShare={handleShare} />
    ) : (
    <div className="cardapio-hub">
      {/* (23/10) sem o cartão de Primeiros passos (ele fica no Início): o que falta aparece como "Falta" em cada linha.
          No topo, o cartão da loja: situação, chave de pausar, Compartilhar, Ver e QR Code */}
      {publicado && linkCardapio ? <CartaoLojaCelular link={linkCardapio} /> : (
        <PassoAPassoCardapio userId={profile?.id} publicado={publicado} linkCardapio={linkCardapio} onShareClick={handleShare} />
      )}
      {/* (23/10) "Minha loja", no estilo do Dora: a loja para o cliente, como você vende e o que você vende, cada linha com o valor atual */}
      <MinhaLoja uid={profile?.id} pro={pro} />

      {/* (6.107) sem os mais vendidos no celular: ficam no Financeiro */}

      <style>{`
        /* (23/10) Minha loja: os blocos usam as linhas de Dados da loja (dadosLoja.css); aqui só o espaço da tela */
        .cardapio-hub { font-family: var(--font-base); display: flex; flex-direction: column; gap: 12px; max-width: 980px; margin: 0 auto; padding: 16px 8px 112px; }
      `}</style>
    </div>
    )}
    </>
  );
}

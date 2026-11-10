import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Crown, Gear, SignOut, Storefront, User } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useFase, useSobreposicao } from "@/components/base/useSobreposicao";
import JanelaSair from "@/components/JanelaSair";
import { VERSAO_APP } from "@/lib/versao";
import { useProfile } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";
import "./menuConta.css";

/**
 * Menu da foto (celular) — o mesmo no Início, em Pedidos e no cabeçalho de todas as telas.
 * (07/10 · 2.98) Antes eram três cópias, cada uma com o seu estilo. Agora é uma peça só:
 * abre embaixo da foto, fecha tocando fora, no Esc e no "voltar" do Android, e a tela de trás não rola.
 * Os itens, a ordem (aprovada em 30/09) e os destinos são os mesmos. O "Sair" pergunta antes, na janela padrão.
 */
interface Props {
  aberto: boolean;
  aoFechar: () => void;
  /** o botão da foto: o menu abre logo embaixo dele */
  ancora: RefObject<HTMLElement | null>;
}

export default function MenuConta({ aberto, aoFechar, ancora }: Props) {
  const navigate = useNavigate();
  const caixa = useRef<HTMLDivElement>(null);
  const fase = useFase(aberto);
  const [lugar, setLugar] = useState({ topo: 88, direita: 12 });
  const [perguntando, setPerguntando] = useState(false);
  useSobreposicao(aberto, aoFechar, caixa);

  // mede onde está a foto antes de a tela travar a rolagem
  useLayoutEffect(() => {
    if (!aberto) return;
    const medir = () => {
      const r = ancora.current?.getBoundingClientRect();
      if (!r || !r.width) return;
      setLugar({ topo: Math.max(12, Math.round(r.bottom + 8)), direita: Math.max(12, Math.round(window.innerWidth - r.right)) });
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [aberto, ancora]);

  const ir = (para: string, state?: Record<string, unknown>) => {
    // o menu guarda uma entrada no histórico pro "voltar" do Android; a tela nova entra no lugar dela
    const substituir = !!(window.history.state as { uiJanela?: boolean } | null)?.uiJanela;
    navigate(para, { replace: substituir, state });
    aoFechar();
  };
  const { profile } = useProfile();
  const { isPro } = usePlano();

  // (09/11) os itens do menu da foto, no modelo dos apps de gestão: a conta, a loja, o plano, as configurações e a ajuda.
  // Novidades ficam no sino do topo e a Doo IA no balão do canto; sugerir e relatar ficam na Central de ajuda.
  const itens: { nome: string; Icone: Icon; acao: () => void }[] = [
    { nome: "Minha conta", Icone: User, acao: () => ir("/configuracoes", { abrirConta: true }) },
    { nome: "Minha loja", Icone: Storefront, acao: () => ir("/cardapio") },
    { nome: isPro ? "Minha assinatura" : "Assinatura", Icone: Crown, acao: () => ir(isPro ? "/minha-assinatura" : "/assinar") },
    { nome: "Configurações", Icone: Gear, acao: () => ir("/configuracoes") },
  ];


  return (
    <>
      {(aberto || fase !== "fechada") && createPortal(
        <div className={`mc-veu${aberto ? "" : " mc-veu--saindo"}`} onClick={aoFechar}>
          <div
            ref={caixa} tabIndex={-1} className="mc" role="dialog" aria-modal="true" aria-label="Menu da conta"
            style={{ top: lugar.topo, right: lugar.direita, maxHeight: `calc(100dvh - ${lugar.topo + 12}px)` }} onClick={e => e.stopPropagation()}
          >
            <div className="mc-cab">
              <p className="mc-cab-n">{profile?.nome || "Minha conta"}</p>
              <p className="mc-cab-v">{[profile?.nome_loja, isPro ? "Plano PRO" : "Plano grátis"].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="mc-lista">
              {itens.map(({ nome, Icone, acao }) => (
                <button key={nome} type="button" className="mc-it" onClick={acao}>
                  <span className="mc-it-ic" aria-hidden="true"><Icone size={20} weight="bold" /></span>
                  <span className="mc-it-t">{nome}</span>
                </button>
              ))}
              <button type="button" className="mc-it mc-it--sair" onClick={() => { aoFechar(); setPerguntando(true); }}>
                <span className="mc-it-ic" aria-hidden="true"><SignOut size={20} weight="bold" /></span>
                <span className="mc-it-t">Sair</span>
              </button>
            </div>
            <p className="mc-versao">Doonly · versão {VERSAO_APP}</p>
          </div>
        </div>,
        document.body,
      )}

      <JanelaSair aberta={perguntando} aoFechar={() => setPerguntando(false)} />
    </>
  );
}

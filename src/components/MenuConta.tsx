import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Bell, Gear, Lightbulb, SignOut, Sparkle, Storefront, WarningCircle } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Botao, Janela } from "@/components/base";
import { useFase, useSobreposicao } from "@/components/base/useSobreposicao";
import { abrirDooIA } from "@/components/MenuContaItens";
import { usePlano } from "@/hooks/usePlano";
import { supabase } from "@/lib/supabase";
import { VERSAO_APP } from "@/lib/versao";
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
  const { isPro } = usePlano();
  const caixa = useRef<HTMLDivElement>(null);
  const fase = useFase(aberto);
  const [lugar, setLugar] = useState({ topo: 88, direita: 12 });
  const [perguntando, setPerguntando] = useState(false);
  const [saindo, setSaindo] = useState(false);
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

  const ir = (para: string) => {
    // o menu guarda uma entrada no histórico pro "voltar" do Android; a tela nova entra no lugar dela
    const substituir = !!(window.history.state as { uiJanela?: boolean } | null)?.uiJanela;
    navigate(para, { replace: substituir });
    aoFechar();
  };

  const itens: { nome: string; Icone: Icon; acao: () => void }[] = [
    { nome: "Notificações", Icone: Bell, acao: () => ir("/notificacoes") },
    { nome: "Minha conta", Icone: Gear, acao: () => ir("/configuracoes") },
    { nome: "Minha loja", Icone: Storefront, acao: () => ir("/cardapio-config") },
    { nome: "Assistente virtual", Icone: Sparkle, acao: () => { if (isPro) { aoFechar(); abrirDooIA(); } else ir("/assistente-virtual"); } },
    { nome: "Sugerir uma melhoria", Icone: Lightbulb, acao: () => ir("/solicitar-recurso") },
    { nome: "Relatar um problema", Icone: WarningCircle, acao: () => ir("/relatar-problema") },
  ];

  const sair = async () => {
    if (saindo) return;
    setSaindo(true);
    try { await supabase.auth.signOut(); } finally { setSaindo(false); setPerguntando(false); }
    navigate("/login");
  };

  return (
    <>
      {(aberto || fase !== "fechada") && createPortal(
        <div className={`mc-veu${aberto ? "" : " mc-veu--saindo"}`} onClick={aoFechar}>
          <div
            ref={caixa} tabIndex={-1} className="mc" role="dialog" aria-modal="true" aria-label="Menu da conta"
            style={{ top: lugar.topo, right: lugar.direita }} onClick={e => e.stopPropagation()}
          >
            <div className="mc-cab">
              <p className="mc-cab-n">Doonly Gestão Inteligente</p>
              <p className="mc-cab-v">Versão {VERSAO_APP}</p>
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
          </div>
        </div>,
        document.body,
      )}

      <Janela
        aberta={perguntando} aoFechar={() => { if (!saindo) setPerguntando(false); }}
        titulo="Sair do Doonly?" texto="Você vai precisar entrar de novo na próxima vez."
        icone={<SignOut size={32} />} tom="vermelho"
        acoes={<>
          <Botao variante="secundario" onClick={() => setPerguntando(false)} disabled={saindo}>Voltar</Botao>
          <Botao variante="perigo" onClick={sair} carregando={saindo} data-foco-inicial>Sair</Botao>
        </>}
      />
    </>
  );
}

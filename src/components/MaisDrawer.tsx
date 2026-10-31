import { useId, useRef, useState } from "react";
import { abrirDooIA } from "@/components/MenuContaItens";
import { INDICACAO_ATIVA } from "@/lib/recursos";
import { createPortal } from "react-dom";
import { NavLink, useNavigate } from "react-router-dom";
import {
  ChartLineUp, ClipboardText, Gear, PaintBrush, Crown, SquaresFour, UserPlus, X, CaretRight,
  Megaphone, CalendarDots, Users, Stack, Truck, Basket, ArrowsDownUp, CurrencyDollar,
  HandCoins, CalendarCheck, Tag, Cake, ChatCircleText, Newspaper, Sparkle, Bell, ChartPieSlice, Shapes, Notebook, PaperPlaneRight, FileText,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { BotaoIcone } from "@/components/base";
import { useFase, useSobreposicao } from "@/components/base/useSobreposicao";
import { usePlano } from "@/hooks/usePlano";
import "./maisDrawer.css";

/**
 * Gaveta "Mais" — abre pelo menu de baixo e reúne as telas que não cabem nele.
 * (07/10 · 2.96) Refeita em cima da janela padrão do guia: sobe de baixo no celular e aparece no centro
 * a partir de 768px. Fecha no X, tocando fora, no Esc e no "voltar" do Android; o foco fica preso nela
 * e a tela de trás não rola. Os itens, os nomes e os destinos são os mesmos de antes.
 * Antes ela ficava escondida de 768px pra cima, mas o menu de baixo vai até 900px: no tablet em pé e no
 * celular deitado, tocar em "Mais" não abria nada e ainda travava a rolagem da tela.
 */
interface MaisDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface Item { label: string; desc: string; path: string; Icone: Icon }
interface Grupo { label: string; items: Item[] }

// (13/10) TODAS as telas da confeiteira (as mesmas do menu do computador, na mesma ordem),
// inclusive as que também abrem pelo Início. Só ficam fora as que já estão no menu de baixo (Início, Pedidos, Cardápio, Doo IA).
// (18/10) reorganizado pela prioridade do dia a dia: o que ela usa todo dia primeiro, o que mexe pouco no fim
const GRUPOS: Grupo[] = [
  // (21/10) os cadastros (produtos, clientes, mensagens) moram em Cadastros; (23/10) a Minha loja está no menu de baixo:
  // aqui fica só o que não está em outro lugar, sem repetir
  {
    label: "Dia a dia",
    items: [
      // (23/10) a Minha loja foi para o menu de baixo e o Financeiro veio para cá, em primeiro
      { label: "Financeiro",   desc: "Entradas, saídas e lucro",          path: "/financeiro", Icone: CurrencyDollar },
      { label: "Agenda",       desc: "Entregas por dia",                  path: "/agenda",    Icone: CalendarDots },
      { label: "Orçamentos",   desc: "Propostas que a cliente aprova",    path: "/orcamentos", Icone: FileText },
      { label: "Cadastros",    desc: "Clientes, ingredientes e produtos", path: "/cadastros", Icone: Notebook },
    ],
  },
  {
    label: "Outros",
    items: [
      { label: "Marketing", desc: "Divulgue e venda mais", path: "/marketing", Icone: Megaphone },
      ...(INDICACAO_ATIVA ? [{ label: "Indicar amigo", desc: "Ganhe indicando", path: "/indicar", Icone: UserPlus }] : []),
      // (30/10 · 5.67) Novidades e Assinatura saíram do destaque do topo e entraram na lista, como as outras
      { label: "Novidades", desc: "O que mudou no app", path: "/noticias", Icone: Newspaper },
      { label: "Assinatura", desc: "Seu plano", path: "/assinar", Icone: Crown },
      { label: "Configurações", desc: "Conta, loja e app", path: "/configuracoes", Icone: Gear },
    ],
  },
];


export default function MaisDrawer({ open, onClose }: MaisDrawerProps) {
  const navigate = useNavigate();
  const { isPro } = usePlano();
  const [pergunta, setPergunta] = useState("");
  const perguntarDoo = (texto: string) => { const t = texto.trim(); if (!t) return; setPergunta(""); onClose(); abrirDooIA(t); };
  const caixa = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const fase = useFase(open);
  useSobreposicao(open, onClose, caixa);

  if (!open && fase === "fechada") return null;


  const ir = (path: string) => {
    // A gaveta guarda uma entrada no histórico pro "voltar" do Android. Ao escolher um item, a tela nova
    // entra no lugar dessa entrada: assim o voltar da tela nova cai direto de onde a pessoa veio.
    const substituir = !!(window.history.state as { uiJanela?: boolean } | null)?.uiJanela;
    navigate(path, { replace: substituir });
    onClose();
  };

  return createPortal(
    <div className={`ui-veu ui-veu--centro mais-veu${open ? "" : " ui-veu--saindo"}`} onClick={onClose}>
      <div
        ref={caixa} tabIndex={-1} className="ui-janela ui-janela--conteudo mais"
        role="dialog" aria-modal="true" aria-labelledby={idTitulo}
        onClick={e => e.stopPropagation()}
      >
        <span className="ui-janela-alca" aria-hidden="true" />

        {/* (30/10 · 5.67) no padrão das outras janelas: só o título e o fechar (saíram a foto, a saudação e a tag PRO) */}
        <div className="mais-cab">
          <h2 className="mais-ola-t" id={idTitulo}>Menu</h2>
          <BotaoIcone rotulo="Fechar" variante="limpo" onClick={onClose}><X size={20} weight="bold" /></BotaoIcone>
        </div>

        <div className="mais-corpo">
          {/* (16/10) o Doo IA saiu do menu de baixo (lá entrou o "+ Nova venda"): fica no topo do Mais */}
          {/* (21/10) a Doo já vem como campo de pergunta (jeito busca do Google) · (27/10) para todos os planos */}
            <div className="mais-doo-bx">
              <form className="mais-doo-q" role="search" onSubmit={e => { e.preventDefault(); perguntarDoo(pergunta); }}>
                <Sparkle size={20} weight="fill" className="mais-doo-q-ic" aria-hidden="true" />
                <input type="text" enterKeyHint="send" autoComplete="off" aria-label="Pergunte ou peça algo à Doo IA" placeholder="Pergunte à Doo IA…" value={pergunta} onChange={e => setPergunta(e.target.value)} />
                <button type="submit" className="mais-doo-q-env" aria-label="Enviar para a Doo IA" disabled={!pergunta.trim()}><PaperPlaneRight size={18} weight="fill" /></button>
              </form>
              <div className="mais-doo-ch">
                {["Registrar pedido", "Quanto vendi hoje?"].map(t => <button key={t} type="button" onClick={() => perguntarDoo(t)}>{t}</button>)}
              </div>
            </div>
          {/* (21/10) uma lista só, sem título de grupo (sobraram poucos itens) */}
          {[{ label: "Telas", items: GRUPOS.flatMap(g => g.items) }].map(grupo => (
            <section key={grupo.label} className="mais-grupo" aria-label="Telas do app">
              <div className="mais-lista">
                {grupo.items.map(item => {
                  const destino = item.path === "/assinar" && isPro ? "/minha-assinatura" : item.path;
                  return (
                    <NavLink
                      key={item.path} to={destino} end
                      className={({ isActive }) => `mais-it${isActive ? " mais-it--atual" : ""}`}
                      onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); ir(destino); }}
                    >
                      {({ isActive }) => (<>
                        <span className="mais-it-ic" aria-hidden="true"><item.Icone size={20} weight={isActive ? "fill" : "bold"} /></span>
                        <span className="mais-it-txt"><b>{item.label}</b><small>{item.desc}</small></span>
                        <CaretRight size={16} weight="bold" className="mais-it-seta" aria-hidden="true" />
                      </>)}
                    </NavLink>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

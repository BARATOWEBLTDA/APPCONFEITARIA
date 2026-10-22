import { useId, useRef, useState } from "react";
import { abrirDooIA } from "@/components/MenuContaItens";
import { INDICACAO_ATIVA } from "@/lib/recursos";
import { createPortal } from "react-dom";
import { NavLink, useNavigate } from "react-router-dom";
import {
  ChartLineUp, ClipboardText, Gear, PaintBrush, Crown, SquaresFour, UserPlus, X, CaretRight,
  Megaphone, CalendarDots, Users, Stack, Truck, Storefront, Eye, Basket, ArrowsDownUp,
  HandCoins, CalendarCheck, Tag, Cake, ChatCircleText, Newspaper, Sparkle, Bell, ChartPieSlice, Shapes, Notebook, PaperPlaneRight,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { BotaoIcone } from "@/components/base";
import { useFase, useSobreposicao } from "@/components/base/useSobreposicao";
import { useProfile, avatarDaConta } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";
import { useNotifications } from "@/context/NotificationContext";
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
  // (21/10) o Financeiro foi pro menu de baixo e os cadastros (produtos, clientes, mensagens, cardápio digital) moram em Cadastros:
  // aqui fica só o que não está em outro lugar, sem repetir
  {
    label: "Dia a dia",
    items: [
      { label: "Agenda",       desc: "Entregas por dia",              path: "/agenda",           Icone: CalendarDots },
      { label: "Cadastros",    desc: "Produtos, clientes e cardápio", path: "/cadastros",        Icone: Notebook },
      { label: "Ver cardápio", desc: "Como o cliente vê",             path: "/cardapio-preview", Icone: Eye },
    ],
  },
  {
    label: "Outros",
    items: [
      { label: "Marketing", desc: "Divulgue e venda mais", path: "/marketing", Icone: Megaphone },
      ...(INDICACAO_ATIVA ? [{ label: "Indicar amigo", desc: "Ganhe indicando", path: "/indicar", Icone: UserPlus }] : []),
      { label: "Configurações", desc: "Conta, loja e app", path: "/configuracoes", Icone: Gear },
    ],
  },
];

function saudacao(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function MaisDrawer({ open, onClose }: MaisDrawerProps) {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { isPro } = usePlano();
  const [pergunta, setPergunta] = useState("");
  const perguntarDoo = (texto: string) => { const t = texto.trim(); if (!t) return; setPergunta(""); onClose(); abrirDooIA(t); };
  const { notifCount } = useNotifications();
  const caixa = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const fase = useFase(open);
  useSobreposicao(open, onClose, caixa);

  if (!open && fase === "fechada") return null;

  const primeiroNome = profile?.nome ? profile.nome.trim().split(/\s+/)[0] : "";
  const inicial = (profile?.nome || "?").trim().charAt(0).toUpperCase();

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

        <div className="mais-cab">
          <span className={`mais-foto${avatarDaConta(profile) ? "" : " mais-foto--letra"}`} aria-hidden="true">
            {avatarDaConta(profile) ? <img src={avatarDaConta(profile)} alt="" /> : inicial}
          </span>
          <div className="mais-ola">
            <h2 className="mais-ola-t" id={idTitulo}>
              <span>{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ""}</span>
              {isPro && <span className="mais-pro"><Crown size={12} weight="fill" aria-hidden="true" />PRO</span>}
            </h2>
            {(profile as any)?.nome_loja && <p className="mais-ola-s">{(profile as any).nome_loja}</p>}
          </div>
          <BotaoIcone rotulo="Fechar" variante="limpo" onClick={onClose}><X size={20} weight="bold" /></BotaoIcone>
        </div>

        <div className="mais-corpo">
          {/* (21/10) atalhos: avisos (com os não lidos), novidades e assinatura */}
          <div className="mais-at">
            <button type="button" onClick={() => ir("/notificacoes")} aria-label={notifCount > 0 ? `Avisos, ${notifCount} não lidos` : "Avisos"}>
              <Bell size={20} weight="fill" aria-hidden="true" />Avisos{notifCount > 0 && <i>{notifCount > 9 ? "9+" : notifCount}</i>}
            </button>
            <button type="button" onClick={() => ir("/noticias")}><Newspaper size={20} weight="fill" aria-hidden="true" />Novidades</button>
            <button type="button" onClick={() => ir(isPro ? "/minha-assinatura" : "/assinar")}><Crown size={20} weight="fill" aria-hidden="true" />Assinatura</button>
          </div>
          {/* (16/10) o Doo IA saiu do menu de baixo (lá entrou o "+ Nova venda"): fica no topo do Mais */}
          {/* (21/10) PRO: a Doo já vem como campo de pergunta (jeito busca do Google); sem PRO, o cartão que leva pra ela */}
          {isPro ? (
            <div className="mais-doo-bx">
              <form className="mais-doo-q" role="search" onSubmit={e => { e.preventDefault(); perguntarDoo(pergunta); }}>
                <Sparkle size={20} weight="fill" className="mais-doo-q-ic" aria-hidden="true" />
                <input type="text" enterKeyHint="send" autoComplete="off" aria-label="Pergunte ou peça algo à Doo IA" placeholder="Pergunte à Doo IA…" value={pergunta} onChange={e => setPergunta(e.target.value)} />
                <button type="submit" className="mais-doo-q-env" aria-label="Enviar pra Doo IA" disabled={!pergunta.trim()}><PaperPlaneRight size={18} weight="fill" /></button>
              </form>
              <div className="mais-doo-ch">
                {["Registrar pedido", "Quanto vendi hoje?"].map(t => <button key={t} type="button" onClick={() => perguntarDoo(t)}>{t}</button>)}
              </div>
            </div>
          ) : (
            <button type="button" className="mais-doo" onClick={() => { onClose(); abrirDooIA(); }}>
              <span className="mais-doo-ic" aria-hidden="true"><Sparkle size={20} weight="fill" /></span>
              <span className="mais-it-txt"><b>Doo IA</b><small>Sua assistente de confeitaria</small></span>
              <CaretRight size={16} weight="bold" className="mais-it-seta" aria-hidden="true" />
            </button>
          )}
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

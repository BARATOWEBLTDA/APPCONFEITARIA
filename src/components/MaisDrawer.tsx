import { useId, useRef } from "react";
import { abrirDooIA } from "@/components/MenuContaItens";
import { INDICACAO_ATIVA } from "@/lib/recursos";
import { createPortal } from "react-dom";
import { NavLink, useNavigate } from "react-router-dom";
import {
  ChartLineUp, ClipboardText, Gear, PaintBrush, Crown, SquaresFour, UserPlus, X, CaretRight,
  Megaphone, CalendarDots, Users, Stack, Truck, Storefront, Eye, Basket, ArrowsDownUp,
  HandCoins, CalendarCheck, Tag, Cake, ChatCircleText, Newspaper, Bug, Lightbulb, Sparkle,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { BotaoIcone } from "@/components/base";
import { useFase, useSobreposicao } from "@/components/base/useSobreposicao";
import { useProfile, avatarDaConta } from "@/hooks/useProfile";
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
  {
    label: "Dia a dia",
    items: [
      { label: "Agenda",     desc: "Entregas por dia",            path: "/agenda",      Icone: CalendarDots },
      { label: "Clientes",   desc: "Quem compra e o que compra",  path: "/clientes",    Icone: Users },
      { label: "Mensagens do WhatsApp", desc: "Textos prontos",   path: "/configuracoes/mensagens", Icone: ChatCircleText },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { label: "Visão geral",   desc: "Entradas, saídas e saldo", path: "/financeiro",            Icone: SquaresFour },
      { label: "A receber",     desc: "O que os clientes devem",  path: "/financeiro/a-receber",  Icone: HandCoins },
      { label: "A pagar",       desc: "Contas e vencimentos",     path: "/financeiro/a-pagar",    Icone: CalendarCheck },
      { label: "Transações",    desc: "Histórico detalhado",      path: "/financeiro/transacoes", Icone: ArrowsDownUp },
      { label: "Lucratividade", desc: "Quanto você lucra",        path: "/lucratividade",         Icone: ChartLineUp },
      { label: "Custos",        desc: "Fixos, taxas e embalagem", path: "/custos",                Icone: Tag },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { label: "Produtos",      desc: "O que aparece no cardápio",      path: "/produtos",      Icone: Cake },
      { label: "Complementos",  desc: "Sabores, recheios e adicionais", path: "/complementos",  Icone: Stack },
      { label: "Categorias",    desc: "Organize seus produtos",         path: "/categorias",    Icone: SquaresFour },
      { label: "Ficha técnica", desc: "Calcule o custo real",           path: "/ficha-tecnica", Icone: ClipboardText },
      { label: "Ingredientes",  desc: "O que você compra",              path: "/insumos",       Icone: Basket },
      // 13/10: Receitas escondida até as fotos ficarem prontas
    ],
  },
  {
    label: "Cardápio digital",
    items: [
      { label: "Ver meu cardápio", desc: "Como o cliente vê",         path: "/cardapio-preview", Icone: Eye },
      { label: "Dados da loja",    desc: "Loja, entrega e pagamento", path: "/cardapio-config",  Icone: Storefront },
      { label: "Aparência",        desc: "Logo, banners e modelo",    path: "/cardapio-design",  Icone: PaintBrush },
    ],
  },
  {
    label: "Divulgar",
    items: [
      { label: "Marketing", desc: "Divulgue e venda mais", path: "/marketing", Icone: Megaphone },
      ...(INDICACAO_ATIVA ? [{ label: "Indicar amigo", desc: "Ganhe indicando", path: "/indicar", Icone: UserPlus }] : []),
    ],
  },
  // (16/10) mais curto: Nova venda foi pro menu de baixo; assinatura, notificações e conquistas ficam em
  // Configurações (e na foto do perfil). Aqui fica só a entrada de Configurações, junto com a ajuda.
  {
    label: "Conta e ajuda",
    items: [
      { label: "Configurações",     desc: "Conta, loja e app",     path: "/configuracoes",     Icone: Gear },
      { label: "Novidades",         desc: "O que mudou no Doonly", path: "/noticias",          Icone: Newspaper },
      { label: "Relatar problema",  desc: "Algo não funcionou",    path: "/relatar-problema",  Icone: Bug },
      { label: "Pedir um recurso",  desc: "Sugira uma ideia",      path: "/solicitar-recurso", Icone: Lightbulb },
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
            <p className="mais-ola-s">O que quer fazer hoje?</p>
          </div>
          <BotaoIcone rotulo="Fechar" variante="limpo" onClick={onClose}><X size={20} weight="bold" /></BotaoIcone>
        </div>

        <div className="mais-corpo">
          {/* (16/10) o Doo IA saiu do menu de baixo (lá entrou o "+ Nova venda"): fica no topo do Mais */}
          <button type="button" className="mais-doo" onClick={() => { onClose(); abrirDooIA(); }}>
            <span className="mais-doo-ic" aria-hidden="true"><Sparkle size={20} weight="fill" /></span>
            <span className="mais-it-txt"><b>Doo IA</b><small>Sua assistente de confeitaria</small></span>
            <CaretRight size={16} weight="bold" className="mais-it-seta" aria-hidden="true" />
          </button>
          {GRUPOS.map(grupo => (
            <section key={grupo.label} className="mais-grupo" aria-label={grupo.label}>
              <p className="mais-grupo-t">{grupo.label}</p>
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

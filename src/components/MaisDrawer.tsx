import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Gear, Crown, CaretRight,
  CalendarDots, CurrencyDollar,
  Newspaper, FileText, Users, ChatCircleText, Cake, Package, ClipboardText,
  Calculator, Sliders, ChartPieSlice, Lifebuoy, MagnifyingGlass,
} from "@phosphor-icons/react";
import { abrirBuscaRapida } from "@/components/BuscaRapida";
import type { Icon } from "@phosphor-icons/react";
import { Ticket, Target, ShareNetwork, Scales, ArrowsDownUp, HandCoins, CalendarCheck } from "@phosphor-icons/react";
import { indicarDoonly } from "@/lib/indicarDoonly";
import { useFase, useSobreposicao } from "@/components/base/useSobreposicao";
import { usePlano } from "@/hooks/usePlano";
import { abrirDooIA } from "@/components/MenuContaItens";
import { CaretRight as SetaDoo } from "@phosphor-icons/react";
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

interface Item { label: string; desc: string; path: string; Icone: Icon; pro?: boolean }
interface Grupo { label: string; items: Item[] }

// (13/10) TODAS as telas da confeiteira (as mesmas do menu do computador, na mesma ordem),
// inclusive as que também abrem pelo Início. Só ficam fora as que já estão no menu de baixo (Início, Pedidos, Cardápio, Doo IA).
// (18/10) reorganizado pela prioridade do dia a dia: o que ela usa todo dia primeiro, o que mexe pouco no fim
// (6.59) sem o "Cadastros" no meio do caminho: cada tela aparece direto, em grupos pelo uso do dia a dia
// (6.109) ordem pelo uso: o que se abre todo dia em cima. Custos, Lucratividade e Ajuda entraram (antes só por dentro de outras telas).
//         Recurso do PRO leva a etiqueta "PRO" para quem é grátis (sabe antes de tocar).
const GRUPOS: Grupo[] = [
  {
    label: "Dia a dia",
    items: [
      { label: "Agenda",       desc: "Entregas por dia",               path: "/agenda",     Icone: CalendarDots },
      { label: "Clientes",     desc: "Quem já comprou com você",       path: "/clientes",   Icone: Users },
      { label: "Orçamentos",   desc: "Propostas para aprovar", path: "/orcamentos", Icone: FileText, pro: true },
      { label: "Mensagens do WhatsApp", desc: "Textos prontos para o cliente", path: "/configuracoes/mensagens", Icone: ChatCircleText },
    ],
  },
  {
    label: "Produção e preço",
    items: [
      { label: "Produtos",      desc: "Preço, foto e esgotado",        path: "/produtos",      Icone: Cake },
      { label: "Ficha técnica", desc: "Custo e lucro de cada produto", path: "/ficha-tecnica", Icone: ClipboardText },
      { label: "Ingredientes",  desc: "O que você compra",             path: "/insumos",       Icone: Package },
      { label: "Custos",        desc: "Mão de obra, contas fixas e taxas", path: "/custos",    Icone: Calculator },
    ],
  },
  {
    label: "Dinheiro",
    items: [
      // (6.154) as partes do Financeiro direto do Menu (igual ao menu do computador), sem passar pela Visão geral
      { label: "Financeiro",    desc: "Visão geral do mês",        path: "/financeiro", Icone: CurrencyDollar },
      { label: "Transações",    desc: "Tudo o que entrou e saiu",  path: "/financeiro/transacoes", Icone: ArrowsDownUp },
      { label: "A receber",     desc: "O que os clientes devem",   path: "/financeiro/a-receber", Icone: HandCoins },
      { label: "A pagar",       desc: "Contas e boletos",          path: "/financeiro/a-pagar", Icone: CalendarCheck },
      { label: "Lucratividade", desc: "Lucro de cada produto", path: "/lucratividade", Icone: ChartPieSlice, pro: true },
    ],
  },
  {
    label: "Divulgar",
    items: [
      { label: "Cupons", desc: "Descontos para vender", path: "/cupons", Icone: Ticket, pro: true },
      { label: "Pixel",  desc: "Meta, Google e TikTok",        path: "/pixel",  Icone: Target, pro: true },
    ],
  },
  {
    // (6.152) ferramentas de cozinha: conversor de medidas (e as próximas)
    label: "Ferramentas",
    items: [
      { label: "Conversor de medidas", desc: "Xícaras e colheres em gramas", path: "/ferramentas/medidas", Icone: Scales },
      { label: "Simulador de preço", desc: "Teste preços e veja o lucro", path: "/ferramentas/simulador", Icone: Sliders },
    ],
  },
  {
    label: "Conta",
    items: [
      { label: "Assinatura",      desc: "Seu plano",                      path: "/assinar",       Icone: Crown },
      { label: "Ajuda e suporte", desc: "Tutoriais e WhatsApp do suporte", path: "/ajuda",        Icone: Lifebuoy },
      { label: "Novidades",       desc: "O que mudou no app",             path: "/noticias",      Icone: Newspaper },
      { label: "Indique o Doonly", desc: "Mande para outra confeiteira", path: "#indicar",   Icone: ShareNetwork },
      { label: "Configurações",   desc: "Conta, notificações e app",      path: "/configuracoes", Icone: Gear },
    ],
  },
];



export default function MaisDrawer({ open, onClose }: MaisDrawerProps) {
  const navigate = useNavigate();
  const { isPro } = usePlano();
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

        {/* (30/10 · 5.67) só o título (saíram a foto, a saudação e a tag PRO). (5.70) sem o X: fecha pela aba Menu, outra aba ou o voltar */}
        <div className="mais-cab">
          <h2 className="mais-ola-t" id={idTitulo}>Menu</h2>
        </div>

        <div className="mais-corpo">
          {/* (6.109) a busca do app no topo do Menu: acha qualquer tela ou ajuste pelo nome ("pix", "taxa", "senha"…) */}
          <button type="button" className="mais-busca" onClick={() => { onClose(); setTimeout(abrirBuscaRapida, 60); }}>
            <MagnifyingGlass size={20} weight="bold" aria-hidden="true" /><span>Buscar no app</span>
          </button>
          {/* (6.87) a Doo IA volta ao Menu do celular, em destaque no topo (no computador ela é o balão do canto) */}
          <button type="button" className="mais-doo" onClick={() => { onClose(); abrirDooIA(); }}>
            <img src="/Sistema/doo.webp" alt="" />
            <span className="mais-doo-tx"><b>Doo IA</b><small>Faz o trabalho pela conversa</small></span>
            <SetaDoo size={18} weight="bold" aria-hidden="true" />
          </button>
          {GRUPOS.map(grupo => (
            <section key={grupo.label} className="mais-grupo" aria-label={grupo.label}>
              <h3 className="mais-grupo-t">{grupo.label}</h3>
              <div className="mais-lista">
                {grupo.items.map(item => {
                  const destino = item.path === "/assinar" && isPro ? "/minha-assinatura" : item.path;
                  // (6.119) Indique o Doonly: não abre tela, abre o compartilhar
                  if (item.path === "#indicar") return (
                    <button key={item.path} type="button" className="mais-it" onClick={() => { onClose(); void indicarDoonly(); }}>
                      <span className="mais-it-ic" aria-hidden="true"><item.Icone size={20} weight="bold" /></span>
                      <span className="mais-it-txt"><b>{item.label}</b><small>{item.desc}</small></span>
                      <CaretRight size={16} weight="bold" className="mais-it-seta" aria-hidden="true" />
                    </button>
                  );
                  return (
                    <NavLink
                      key={item.path} to={destino} end
                      className={({ isActive }) => `mais-it${isActive ? " mais-it--atual" : ""}${item.path === "/assinar" ? " mais-it--pro" : ""}`}
                      onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); ir(destino); }}
                    >
                      {({ isActive }) => (<>
                        <span className="mais-it-ic" aria-hidden="true"><item.Icone size={20} weight={isActive || item.path === "/assinar" ? "fill" : "bold"} /></span>
                        <span className="mais-it-txt"><b>{item.label}</b><small>{item.path === "/assinar" && !isPro ? "7 dias grátis para testar" : item.desc}</small></span>
                        {item.pro && !isPro && <em className="mais-it-pro">PRO</em>}
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

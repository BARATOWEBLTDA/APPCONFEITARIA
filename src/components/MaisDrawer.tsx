import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { NavLink, useNavigate } from "react-router-dom";
import {
  CurrencyDollar, ChartLineUp,
  Package, BookOpen, ClipboardText,
  Gear, PaintBrush, Crown,
  SquaresFour, UserPlus, CreditCard,
  X, CaretRight,
  Trophy,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { BotaoIcone } from "@/components/base";
import { useFase, useSobreposicao } from "@/components/base/useSobreposicao";
import { useProfile } from "@/hooks/useProfile";
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

const GRUPOS: Grupo[] = [
  {
    label: "Cadastros",
    items: [
      { label: "Categorias",    desc: "Organize seus produtos", path: "/categorias",    Icone: SquaresFour },
      { label: "Ingredientes",  desc: "O que você compra",      path: "/insumos",       Icone: Package },
      { label: "Receitas",      desc: "Suas receitas",          path: "/receitas",      Icone: BookOpen },
      { label: "Ficha técnica", desc: "Calcule o custo real",   path: "/ficha-tecnica", Icone: ClipboardText },
    ],
  },
  {
    label: "Análises",
    items: [
      { label: "Lucratividade", desc: "Análise de margem",   path: "/lucratividade",         Icone: ChartLineUp },
      { label: "Transações",    desc: "Histórico detalhado", path: "/financeiro/transacoes", Icone: CurrencyDollar },
    ],
  },
  {
    label: "Configuração",
    items: [
      { label: "Cardápio Design", desc: "Personalize o cardápio", path: "/cardapio-design", Icone: PaintBrush },
      { label: "Checkout",        desc: "Configure o pagamento",  path: "/checkout-config", Icone: CreditCard },
      { label: "Configurações",   desc: "Ajustes gerais do app",  path: "/configuracoes",   Icone: Gear },
    ],
  },
  {
    label: "Meu plano",
    items: [
      { label: "Minhas conquistas", desc: "Suas medalhas",     path: "/conquistas", Icone: Trophy },
      { label: "Assinatura",        desc: "Gerencie seu PRO",  path: "/assinar",    Icone: Crown },
      { label: "Indicar amigo",     desc: "Ganhe indicando",   path: "/indicar",    Icone: UserPlus },
      // "Meus arquivos" escondido até ficar pronto (02/10): { label: "Meus arquivos", desc: "PDFs e materiais", path: "/arquivos", Icone: Files },
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
    <div className={`ui-veu ui-veu--centro${open ? "" : " ui-veu--saindo"}`} onClick={onClose}>
      <div
        ref={caixa} tabIndex={-1} className="ui-janela ui-janela--conteudo mais"
        role="dialog" aria-modal="true" aria-labelledby={idTitulo}
        onClick={e => e.stopPropagation()}
      >
        <span className="ui-janela-alca" aria-hidden="true" />

        <div className="mais-cab">
          <span className={`mais-foto${profile?.foto_url ? "" : " mais-foto--letra"}`} aria-hidden="true">
            {profile?.foto_url ? <img src={profile.foto_url} alt="" /> : inicial}
          </span>
          <div className="mais-ola">
            <h2 className="mais-ola-t" id={idTitulo}>
              <span>{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ""}</span>
              {isPro && <span className="mais-pro"><img src="/coroa.png" alt="" />PRO</span>}
            </h2>
            <p className="mais-ola-s">O que quer fazer hoje?</p>
          </div>
          <BotaoIcone rotulo="Fechar" variante="limpo" onClick={onClose}><X size={20} weight="bold" /></BotaoIcone>
        </div>

        <div className="mais-corpo">
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

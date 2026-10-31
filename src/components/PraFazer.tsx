import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Basket, Bell, BellSlash, Crown, Buildings, CalendarCheck, CaretDown, ChartLineUp, Check, ClipboardText, Clock, Coins, CreditCard, ImageSquare, Info, ListChecks, MapPin, Storefront, TextAlignLeft, Truck, WarningCircle } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useProfile } from "@/hooks/useProfile";
import { useLojaPronta } from "@/lib/primeirosPassos";
import { useAoVoltar } from "@/hooks/useAoVoltar";
import { precisaInstalarNoIphone } from "@/lib/notifications";
import { lerAvisosCadastro, notificarAvisosCadastro, type AvisoCadastro } from "@/lib/avisosCadastro";
import { avisoDoPro } from "@/lib/notificacoesUsuario";
import { supabase } from "@/lib/supabase";
import { useAtualizacoes } from "@/components/MinhasAtualizacoes";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { Botao, Janela, avisar } from "@/components/base";
import { ConteudoComo, type Como } from "@/components/como/ComoFunciona";

/**
 * (15/10) "Pra fazer": um cartão só no Início, no lugar do "Complete seu app" e do "Suas atualizações".
 * O mais urgente em cima: contas atrasadas ou vencendo hoje (vermelho), atenção (amarelo: conta de amanhã,
 * aniversário, faturamento caiu) e o resto (o que falta cadastrar e as boas notícias).
 * (16/10) Virou "Seus próximos passos": mostra 3, cada um com "Agora não" (amanhã, 7 dias ou não mostrar mais)
 * e o botão da ação embaixo do texto (antes um X no canto). Conta a pagar não tem "Agora não".
 * O que falta cadastrar só aparece depois dos primeiros passos. Conta nova (sem nada) não vê o cartão.
 * (18/10) Lista compacta (estava com texto demais): ícone, título e uma linha curta; a linha toda abre;
 * o "Agora não" virou um × pequeno no canto (abre as mesmas opções).
 * (21/10) Voltou a se chamar "Pra fazer" (era quase igual a "Primeiros passos"). Cada linha tem um botão curto que
 * já diz a ação (Pagar, Liberar, Definir…) no lugar da seta e do ×; a conta mostra o valor ("Vence hoje · R$ 380,00").
 */
type Item = { chave: string; nivel: "urgente" | "atencao" | "normal"; Ic: Icon; t: string; s: string; acao: string; link: string; estado?: { abrir: string }; fechar?: boolean; ordem: number; aoTocar?: () => void;
  /** (22/10) frase do porquê (até 2 linhas) e, na conta, o vencimento em vermelho em cima dela */
  txt?: string; alerta?: string; comoFunciona?: Como; revisar?: { abrir: string } };

/** (21/10) o botão de cada linha diz o que fazer */
const ACAO: Record<AvisoCadastro["icone"], string> = { custos: "Definir", maquininha: "Definir", ficha: "Fazer", caixa: "Informar", conta: "Pagar", entrega: "Definir", descricao: "Escrever", banner: "Colocar" };
const ACAO_NOVIDADE: Record<string, string> = { "aniversarios": "Ver", "produtos-sem-foto": "Pôr foto", "clientes-sumidos": "Chamar" };
const ICONE: Record<AvisoCadastro["icone"], Icon> = { custos: Buildings, maquininha: CreditCard, ficha: ClipboardText, caixa: Coins, conta: CalendarCheck, entrega: Truck, descricao: TextAlignLeft, banner: ImageSquare };
const DIA = 86400000;
const PESO = { urgente: 0, atencao: 1, normal: 2 };
const VISIVEIS = 3;
/** (22/10) "Como funciona": janelinha com um exemplo em números, o caminho e as dicas (igual às Pendências da Dora) */
const COMO: Record<string, Como> = {
  entrega: {
    nome: "Taxa de entrega", acao: "Definir a taxa de entrega",
    tit: "Exemplo · entrega de 5 km",
    linhas: [["Gasolina da entrega", "R$ 12,00"], ["Cliente paga de taxa", "R$ 10,00"]],
    total: ["Sai do seu bolso", "R$ 2,00"],
    fluxo: ["Você define", "Cardápio", "Cliente paga"],
    dicas: [
      [Truck, <><b>Taxa fixa:</b> um valor só para toda entrega.</>],
      [MapPin, <><b>Por bairro:</b> um valor para cada bairro.</>],
      [Storefront, <>Retirada no local continua <b>sem taxa</b>.</>],
      [WarningCircle, <>Sem taxa, o cardápio mostra <b>entrega grátis</b> e os R$ 12,00 saem do seu lucro.</>],
    ],
  },
  ficha: {
    nome: "Ficha técnica", acao: "Montar as fichas",
    tit: "Exemplo · bolo de R$ 120,00",
    linhas: [["Ingredientes", "R$ 38,00"], ["Embalagem", "R$ 4,00"], ["Gás e perdas (25%)", "R$ 9,50"]],
    total: ["Seu lucro", "R$ 68,50 (57%)"],
    fluxo: ["Ingredientes", "Ficha", "Lucro real"],
    dicas: [
      [Basket, <>Cadastre os ingredientes com o <b>preço que você paga</b>.</>],
      [ListChecks, <>Monte a receita: <b>quanto vai de cada um</b>.</>],
      [ChartLineUp, <>O app calcula <b>custo, lucro e margem</b> sozinho.</>],
      [WarningCircle, <>Sem ficha, o custo fica zerado e o lucro parece <b>100%</b>.</>],
    ],
  },
  custos: {
    nome: "Custos e taxas", acao: "Cadastrar os custos",
    tit: "Exemplo · mês com 100 bolos",
    linhas: [["Aluguel", "R$ 800,00"], ["Luz e gás", "R$ 200,00"]],
    total: ["Cada bolo carrega", "R$ 10,00"],
    fluxo: ["Custos", "Por venda", "Preço certo"],
    dicas: [
      [Buildings, <><b>Fixos:</b> aluguel, luz e internet, que vêm todo mês.</>],
      [CreditCard, <><b>Maquininha:</b> a taxa muda no débito e no crédito.</>],
      [Coins, <>Seu <b>salário</b> também entra como custo.</>],
      [Check, <>Com eles, a Lucratividade mostra o <b>lucro real</b>.</>],
    ],
  },
};
/** (16/10) texto de cada novidade aqui: do tamanho de 2 linhas cheias no celular (sem 1 palavra sobrando embaixo) */
const TEXTO_NOVIDADE: Record<string, string> = {
  "aniversarios": "Mande uma mensagem de parabéns e ofereça um bolo especial para o dia.",
  "faturamento-up": "Você vendeu mais que nos mesmos dias do mês passado. Continue assim!",
  "faturamento-down": "Vendeu menos que nos mesmos dias do mês passado. Que tal uma promoção?",
  "produtos-sem-foto": "Produto com foto vende mais. Adicione para chamar atenção no cardápio.",
  "clientes-sumidos": "Sem comprar há mais de 60 dias. Mande uma mensagem para chamar de volta.",
};

export default function PraFazer() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const uid = profile?.id as string | undefined;
  const pronta = useLojaPronta(uid);
  const { updates } = useAtualizacoes();
  const [avisos, setAvisos] = useState<AvisoCadastro[]>([]);
  const [aberto, setAberto] = useState(false);
  const [, setMexeu] = useState(0);
  // (22/10) "Agora não" (menu com as opções) e "Como funciona" (exemplo) abertos
  const [menu, setMenu] = useState<string | null>(null);
  const [como, setComo] = useState<string | null>(null);
  const raiz = useRef<HTMLElement>(null);
  // (22/10) no celular o "Como funciona" abre numa gaveta de baixo (fundo escurecido); no computador, a janelinha na lista
  const [cel, setCel] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const f = () => setCel(mq.matches);
    mq.addEventListener("change", f); return () => mq.removeEventListener("change", f);
  }, []);
  useEffect(() => {
    if (!como || cel) return;
    // (22/10) fecha só com um toque fora (click), não ao rolar a tela: antes o toque de rolar fechava antes de dar pra ler
    const fora = (e: MouseEvent) => { const t = e.target as HTMLElement; if (!t?.closest?.(".pf-cf") && !t?.closest?.(".pf-como")) setComo(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setComo(null); };
    // e rola até a janelinha aparecer inteira (sem ficar atrás do menu de baixo)
    const t = window.setTimeout(() => raiz.current?.querySelector(".pf-cf")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
    document.addEventListener("click", fora); document.addEventListener("keydown", esc);
    return () => { window.clearTimeout(t); document.removeEventListener("click", fora); document.removeEventListener("keydown", esc); };
  }, [como, cel]);
  useEffect(() => {
    if (!menu) return;
    const fora = (e: MouseEvent) => { if (!(e.target as HTMLElement)?.closest?.(".pf-nao-w")) setMenu(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    const t = window.setTimeout(() => raiz.current?.querySelector(".pf-menu")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
    document.addEventListener("click", fora); document.addEventListener("keydown", esc);
    return () => { window.clearTimeout(t); document.removeEventListener("click", fora); document.removeEventListener("keydown", esc); };
  }, [menu]);
  const kAte = (chave: string) => `doonly_aviso_ate_${uid}_${chave}`;
  const kOff = (chave: string) => `doonly_aviso_off_${uid}_${chave}`; // o X antigo (escondia por 7 dias)
  const escondido = (chave: string) => {
    try {
      const v = localStorage.getItem(kAte(chave));
      if (v === "nunca" || (v && Date.now() < Number(v))) return true;
      return Date.now() - Number(localStorage.getItem(kOff(chave)) || 0) < 7 * DIA;
    } catch { return false; }
  };

  // ao voltar pro app, relê o que falta cadastrar
  const [voltou, setVoltou] = useState(0);
  useAoVoltar(() => setVoltou(v => v + 1));
  useEffect(() => {
    if (!uid || pronta !== true) return;
    let vivo = true;
    lerAvisosCadastro(uid).then(l => { if (!vivo) return; setAvisos(l); notificarAvisosCadastro(l); }).catch(() => {});
    return () => { vivo = false; };
  }, [uid, pronta, voltou]);

  // (18/10) notificações: enquanto não estiverem ligadas neste aparelho, é o primeiro passo (toque já pede a permissão)
  const push = usePushSubscription();
  const ativarNotif = async () => {
    if (push.permission === "denied") { navigate("/configuracoes/notificacoes"); return; }
    const ok = await push.subscribe();
    // (31/10 · 5.82) ligou: já manda um aviso de teste de verdade (antes só prometia) e abre Notificações e sons
    if (ok) {
      setMexeu(n => n + 1);
      void supabase.functions.invoke("push-pessoal", { body: { teste: true } }).catch(() => {});
      avisar("Notificações ligadas. Um aviso de teste chega em alguns segundos.", { tipo: "ok", duracao: 6000 });
      navigate("/configuracoes/notificacoes");
    }
    else if (Notification.permission === "denied") navigate("/configuracoes/notificacoes");
  };
  // (23/10) sem "Agora não": enquanto os avisos não estiverem ligados, o pedido continua aqui (é o que garante que a novidade chega)
  const itemNotif: Item[] = uid && precisaInstalarNoIphone() ? [{
    chave: "instalar_iphone", nivel: "atencao", Ic: Bell, ordem: -100, acao: "Ver como", link: "/configuracoes/notificacoes", fechar: false,
    t: "Instale o Doonly no iPhone", s: "Para receber os avisos de pedido",
    txt: "No iPhone, os avisos só chegam com o Doonly instalado na tela de início.",
  }] : uid && push.isSupported && !push.isSubscribed ? [{
    chave: "ativar_notificacoes", nivel: "atencao", Ic: Bell, ordem: -100, acao: push.permission === "denied" ? "Liberar" : "Ativar", link: "/configuracoes/notificacoes", fechar: false,
    t: push.permission === "denied" ? "Notificações bloqueadas" : "Ativar notificações",
    s: push.permission === "denied" ? "Libere para ver pedido novo" : "Para não perder nenhum pedido",
    txt: "Libere para o celular tocar quando chegar pedido, mesmo com o app fechado.",
    aoTocar: () => { void ativarNotif(); },
  }] : [];

  // (23/10) plano PRO vencendo ou em atraso: antes só aparecia na tela Notificações (que saiu)
  const avisoPro = (profile as any)?.pro_expira_em ? avisoDoPro((profile as any).pro_expira_em) : null;
  const itemPro: Item[] = avisoPro ? [{
    chave: `${avisoPro.chave}`, nivel: avisoPro.tipo === "pro_atrasado" ? "urgente" : "atencao", Ic: Crown, ordem: -90, acao: "Renovar", link: "/assinar", fechar: false,
    t: avisoPro.tipo === "pro_atrasado" ? "Mensalidade do PRO em atraso" : "Seu PRO vence em breve",
    s: avisoPro.tipo === "pro_atrasado" ? "Regularize para voltar ao PRO" : `Vence no dia ${/dia (\d\d\/\d\d)/.exec(avisoPro.mensagem)?.[1] || ""}`.trim(),
    txt: avisoPro.mensagem,
  }] : [];

  const itens: Item[] = [
    ...itemNotif,
    ...itemPro,
    ...avisos.map((a, i): Item => ({
      chave: a.chave, nivel: a.nivel, Ic: ICONE[a.icone], t: a.curto.t, s: a.curto.s, link: a.link, estado: a.estado, ordem: i,
      acao: ACAO[a.icone] || "Ver", fechar: a.icone !== "conta",
      // conta: o vencimento em vermelho e, no lugar do "Agora não", o "Revisar" (digitou errado ou a conta não existe)
      txt: a.icone === "conta" ? "Pague ou marque como paga." : a.texto,
      alerta: a.icone === "conta" ? a.curto.s : undefined,
      comoFunciona: COMO[a.icone],
      revisar: a.icone === "conta" && a.estado?.abrir?.startsWith("pagar:") ? { abrir: `revisar:${a.estado.abrir.slice(6)}` } : undefined,
    })),
    ...updates.map((u): Item => ({
      chave: u.key, nivel: u.key === "faturamento-down" || u.key === "aniversarios" ? "atencao" : "normal",
      Ic: u.Icone, t: u.curto.t, s: u.curto.s || TEXTO_NOVIDADE[u.key] || u.descricao, link: u.path, ordem: 100 - u.prioridade, acao: ACAO_NOVIDADE[u.key] || "Ver", fechar: true,
      txt: TEXTO_NOVIDADE[u.key] || u.descricao,
    })),
  ].filter(x => !x.fechar || !escondido(x.chave))
   .sort((a, b) => PESO[a.nivel] - PESO[b.nivel] || a.ordem - b.ordem);

  if (!itens.length) return null;
  const mostrar = aberto ? itens : itens.slice(0, VISIVEIS);
  const resto = itens.length - VISIVEIS;
  const ir = (x: Item) => x.aoTocar ? x.aoTocar() : navigate(x.link, x.estado ? { state: x.estado } : undefined);
  const adiar = (x: Item, dias: number | "nunca") => {
    try {
      if (dias === "nunca") localStorage.setItem(kAte(x.chave), "nunca");
      else { const d = new Date(); d.setDate(d.getDate() + dias); d.setHours(5, 0, 0, 0); localStorage.setItem(kAte(x.chave), String(d.getTime())); }
    } catch { /* sem armazenamento */ }
    setMenu(null); setMexeu(n => n + 1);
    avisar(dias === "nunca" ? "Pronto, não aparece mais neste aparelho." : dias === 1 ? "Volta amanhã." : "Volta daqui a uma semana.", { tipo: "ok" });
  };
  return (
    <section className="pf" aria-label="Seus próximos passos" ref={raiz}>
      <div className="pf-cab">
        <b className="pf-t">Seus próximos passos</b>
        <span className="pf-n" aria-label={`${itens.length} ${itens.length === 1 ? "item" : "itens"}`}>{itens.length}</span>
      </div>
      <ul className="pf-lista">
        {mostrar.map(x => (
          <li key={x.chave} className={`pf-it pf-it--${x.nivel}`}>
            <span className="pf-ic" aria-hidden="true"><x.Ic size={20} weight="bold" /></span>
            <div className="pf-tx">
              <b>{x.t}</b>
              {x.alerta && <span className="pf-alerta">{x.alerta}</span>}
              <p>{x.txt || x.s}{x.comoFunciona && <> <button type="button" className="pf-como" aria-expanded={como === x.chave} onClick={() => setComo(c => c === x.chave ? null : x.chave)}>Como funciona <Info size={14} weight="bold" aria-hidden="true" /></button></>}</p>
              {!cel && como === x.chave && x.comoFunciona && <ConteudoComo c={x.comoFunciona} rotulo={x.t} className="pf-cf" />}
              <div className="pf-bts">
                {x.revisar ? (
                  <button type="button" className="pf-nao" onClick={() => navigate(x.link, { state: x.revisar })}>Revisar</button>
                ) : x.fechar ? (
                  <div className="pf-nao-w">
                    <button type="button" className="pf-nao" aria-haspopup="menu" aria-expanded={menu === x.chave} onClick={() => setMenu(m => m === x.chave ? null : x.chave)}>Agora não <CaretDown size={14} weight="bold" aria-hidden="true" /></button>
                    {menu === x.chave && (
                      <div className="pf-menu" role="menu">
                        <button type="button" role="menuitem" onClick={() => adiar(x, 7)}><Clock size={20} aria-hidden="true" /><span><b>Lembrar em 7 dias</b><small>Volta daqui a uma semana</small></span></button>
                        <button type="button" role="menuitem" onClick={() => adiar(x, 1)}><Clock size={20} aria-hidden="true" /><span><b>Lembrar amanhã</b><small>Volta amanhã cedo</small></span></button>
                        <button type="button" role="menuitem" onClick={() => adiar(x, "nunca")}><BellSlash size={20} aria-hidden="true" /><span><b>Não lembrar mais</b><small>Some deste aparelho</small></span></button>
                      </div>
                    )}
                  </div>
                ) : null}
                <button type="button" className="pf-bt" disabled={x.aoTocar ? push.loading : false} onClick={() => ir(x)}>{x.acao}</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {cel && (() => {
        const x = itens.find(i => i.chave === como);
        const c = x?.comoFunciona;
        return (
          <Janela aberta={!!(x && c)} aoFechar={() => setComo(null)} titulo={c?.nome || ""} tipo="conteudo" umaAcao
            acoes={x && c ? <Botao cheio onClick={() => { setComo(null); ir(x); }}>{c.acao || x.acao}</Botao> : undefined}>
            {c && <div className="pf-cf-folha"><ConteudoComo c={c} rotulo={c.nome || ""} className="pf-cf" /></div>}
          </Janela>
        );
      })()}
      {resto > 0 && (
        <button type="button" className="pf-ver" onClick={() => setAberto(a => !a)} aria-expanded={aberto}>
          {aberto ? "Ver menos" : `Ver mais ${resto}`}
        </button>
      )}
      <style>{CSS}</style>
    </section>
  );
}

const CSS = `
  /* (22/10) como as Pendências da Dora: cada item explica o porquê e tem "Agora não" (ou "Revisar", na conta) + a ação */
  .pf { padding: 16px 16px 4px; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); font-family: var(--font-base); text-align: left; }
  .pf-cab { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
  .pf-t { font-size: 16px; font-weight: 600; line-height: 1.3; color: var(--ui-texto); }
  .pf-n { flex: none; display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0 7px; border-radius: 999px; background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); font-size: 12px; font-weight: 600; }
  .pf-lista { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
  .pf-it { display: flex; align-items: flex-start; gap: 12px; padding: 14px 0; border-top: 1px solid var(--ui-linha, #F3ECEF); }
  .pf-it:first-child { border-top: 0; }
  .pf-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: #F0EEEF; color: #8F8589; }
  .pf-it--urgente .pf-ic { background: #FEF2F2; color: #B42318; }
  .pf-tx { flex: 1; min-width: 0; }
  .pf-tx > b { display: block; font-size: 14.5px; font-weight: 600; line-height: 1.3; color: var(--ui-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pf-alerta { display: block; margin-top: 1px; font-size: 13px; font-weight: 600; color: #B42318; }
  .pf-it--atencao .pf-alerta { color: #B45309; }
  .pf-tx > p { margin: 2px 0 0; font-size: 13px; line-height: 1.4; color: var(--ui-texto-2); }
  .pf-como { display: inline-flex; align-items: center; gap: 3px; margin: 0; padding: 0; border: 0; background: none; font: inherit; font-weight: 600; color: var(--ui-texto); text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
  /* "Como funciona": janelinha por cima, com o exemplo em cima (fundo cinza) e as dicas embaixo, igual à Dora */
  .pf-tx { position: relative; }
  /* na gaveta do celular: o mesmo conteúdo, sem sombra (a gaveta já é a caixa) */
  .pf-cf-folha .pf-cf { margin: 0; box-shadow: none; }
  .pf-cf, .pf-menu { scroll-margin-bottom: calc(96px + env(safe-area-inset-bottom, 0px)); scroll-margin-top: 80px; }
  /* dentro do fluxo (empurra o resto para baixo): perto do fim da tela, absoluta ficava atrás do menu de baixo sem dar para rolar */
  .pf-cf { position: relative; z-index: 2; margin: 10px 0 0 -48px; overflow: hidden; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: 14px; box-shadow: 0 16px 40px rgba(20, 10, 7, .18); }
  .pf-bts { position: relative; display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 10px; }
  .pf-nao-w { position: static; }
  .pf-nao { display: inline-flex; align-items: center; gap: 4px; min-height: 40px; margin: 0; padding: 0 10px; border: 0; border-radius: 10px; background: none; font-family: inherit; font-size: 13.5px; font-weight: 500; color: var(--ui-texto-2); cursor: pointer; }
  .pf-nao:hover { background: #F6F3F4; }
  .pf-menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 20; width: min(260px, 100%); padding: 6px; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: 14px; box-shadow: 0 12px 30px rgba(20, 10, 7, .16); }
  .pf-menu button { display: flex; align-items: flex-start; gap: 10px; width: 100%; margin: 0; padding: 10px; border: 0; border-radius: 10px; background: none; font-family: inherit; text-align: left; color: var(--ui-texto); cursor: pointer; }
  .pf-menu button:hover { background: #F6F3F4; }
  .pf-menu svg { flex: none; margin-top: 1px; color: var(--ui-texto-2); }
  .pf-menu b { display: block; font-size: 14px; font-weight: 600; }
  .pf-menu small { display: block; margin-top: 1px; font-size: 12.5px; color: var(--ui-texto-2); }
  .pf-bt { flex: none; min-height: 40px; margin: 0; padding: 0 16px; border-radius: 10px; background: var(--ui-branco); border: 1.5px solid var(--ui-rosa); color: var(--ui-rosa-escuro); font-family: inherit; font-size: 13.5px; font-weight: 600; white-space: nowrap; cursor: pointer; }
  .pf-bt--pagar { border-color: transparent; background: #FEF2F2; color: #B42318; }
  .pf-ver { display: block; width: 100%; min-height: 44px; margin: 0; border: 0; border-top: 1px solid var(--ui-linha, #F3ECEF); background: none; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--ui-rosa-escuro); cursor: pointer; }
`;

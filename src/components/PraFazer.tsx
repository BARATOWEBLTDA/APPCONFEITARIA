import { avisoDeTesteNaLista } from "@/lib/notifConfeiteira";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Basket, Bell, DeviceMobile, BellSlash, Crown, Buildings, CalendarCheck, CaretDown, ChartLineUp, Check, ClipboardText, Clock, Coins, CreditCard, ImageSquare, Info, ListChecks, MapPin, Storefront, TextAlignLeft, Truck, WarningCircle, Ticket, Stack, UserPlus, WhatsappLogo, PauseCircle, ShareNetwork, QrCode, SquaresFour, CalendarX, Island } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useProfile } from "@/hooks/useProfile";
import { useLojaPronta } from "@/lib/primeirosPassos";
import { useAoVoltar } from "@/hooks/useAoVoltar";
import { precisaInstalarNoIphone, ehIphone } from "@/lib/notifications";
import { getInstallPrompt, isStandalone, onInstallChange, promptInstall } from "@/lib/installPrompt";
import { lerAvisosCadastro, notificarAvisosCadastro, type AvisoCadastro } from "@/lib/avisosCadastro";
import { avisoDoPro } from "@/lib/notificacoesUsuario";
import { supabase } from "@/lib/supabase";
import { linkWhatsApp } from "@/lib/telefone";
import { salvarFechados } from "@/lib/diasFechados";
import { registrarPagamento } from "@/lib/pagamentos";
import { useAtualizacoes } from "@/components/MinhasAtualizacoes";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { Botao, Janela, avisar, confirmar, informar } from "@/components/base";
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
type Item = { chave: string; nivel: "urgente" | "atencao" | "normal"; Ic: Icon; t: string; s: string; acao: string; link: string; estado?: AvisoCadastro["estado"]; fechar?: boolean; ordem: number; aoTocar?: () => void;
  /** (22/10) frase do porquê (até 2 linhas) e, na conta, o vencimento em vermelho em cima dela */
  txt?: string; alerta?: string; comoFunciona?: Como; revisar?: AvisoCadastro["estado"]; rotuloRevisar?: string;
  /** (6.178) botão de baixo com ação própria (ex.: "Cobrar" no WhatsApp) e o "Não quero" que some de vez */
  aoRevisar?: () => void; naoQuero?: boolean };

/** (21/10) o botão de cada linha diz o que fazer */
const ACAO: Record<AvisoCadastro["icone"], string> = { custos: "Definir", maquininha: "Definir", ficha: "Fazer", caixa: "Informar", conta: "Pagar", entrega: "Definir", descricao: "Escrever", banner: "Colocar", cupom: "Criar", complemento: "Criar", cliente: "Cadastrar", whatsapp: "Está certo",
  receber: "Já recebi", pausa: "Ver loja", orcamento: "Abrir", divulgar: "Divulgar", pix: "Ligar", categoria: "Criar", feriado: "Vou fechar", ferias: "Ver" };
const ACAO_NOVIDADE: Record<string, string> = { "aniversarios": "Ver", "produtos-sem-foto": "Pôr foto", "clientes-sumidos": "Chamar" };
const ICONE: Record<AvisoCadastro["icone"], Icon> = { custos: Buildings, maquininha: CreditCard, ficha: ClipboardText, caixa: Coins, conta: CalendarCheck, entrega: Truck, descricao: TextAlignLeft, banner: ImageSquare, cupom: Ticket, complemento: Stack, cliente: UserPlus, whatsapp: WhatsappLogo,
  receber: Coins, pausa: PauseCircle, orcamento: ClipboardText, divulgar: ShareNetwork, pix: QrCode, categoria: SquaresFour, feriado: CalendarX, ferias: Island };
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
      [WarningCircle, <>Sem taxa, o cardápio mostra <b>a combinar</b> e você acerta o valor em cada pedido.</>],
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
  "faturamento-up": "Você vendeu mais que nos mesmos dias do mês passado.",
  "faturamento-down": "Vendeu menos que nos mesmos dias do mês passado. Que tal uma promoção?",
  "produtos-sem-foto": "Produto com foto vende mais. Adicione para chamar atenção no cardápio.",
  "clientes-sumidos": "Sem comprar há mais de 60 dias. Mande uma mensagem para chamar de volta.",
};

/**
 * (11/11) "Seu próximo passo": a trilha de crescer a loja, um passo por vez. Cada passo é o aviso que já existia;
 * feito = o aviso não aparece mais. Nomes curtos (cabem numa linha no celular).
 */
const TRILHA: { k: string; nome: string; txt: string }[] = [
  { k: "divulgar_cardapio", nome: "Divulgar o link do cardápio", txt: "Mande o link no WhatsApp e no Instagram." },
  { k: "produtos-sem-foto", nome: "Foto em todos os produtos", txt: "Produto com foto vende mais no cardápio." },
  { k: "falta_descricao", nome: "Descrição dos produtos", txt: "Conte o sabor e o tamanho. Ajuda a decidir." },
  { k: "falta_ficha_tecnica", nome: "Ficha técnica dos produtos", txt: "Mostra o custo e o lucro de cada produto." },
  { k: "falta_custos", nome: "Custos e taxa da maquininha", txt: "Com eles, o app mostra o seu lucro real." },
  { k: "ligar_pix_cardapio", nome: "Pix pelo cardápio", txt: "A cliente paga ao pedir e você recebe antes." },
];
/** passos a mais (não contam no "X de 6"): aparecem depois dos principais */
const EXTRAS = ["falta_banner", "criar_categorias", "falta_complemento", "falta_cupom", "falta_cliente"];
/** qual passo da trilha um aviso representa (a mão de obra entra junto com os custos) */
const passoDe = (chave: string): string | null =>
  chave === "falta_mao_obra" ? "falta_custos" : TRILHA.some(t => t.k === chave) || EXTRAS.includes(chave) ? chave : null;

export default function PraFazer() {
  const navigate = useNavigate();
  const { profile, refetch } = useProfile();
  const uid = profile?.id as string | undefined;
  const pronta = useLojaPronta(uid);
  const { updates } = useAtualizacoes();
  const [avisos, setAvisos] = useState<AvisoCadastro[]>([]);
  const [aberto, setAberto] = useState(false);
  const [, setMexeu] = useState(0);
  // (22/10) "Agora não" (menu com as opções) e "Como funciona" (exemplo) abertos
  const [menu, setMenu] = useState<string | null>(null);
  const [como, setComo] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
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
    if (!uid) return;
    let vivo = true;
    // (6.177) conta atrasada e o WhatsApp dos pedidos aparecem sempre; os passos de cadastro só com a loja pronta
    lerAvisosCadastro(uid).then(l0 => {
      if (!vivo) return;
      const l = pronta === true ? l0 : l0.filter(a => a.chave.startsWith("conta_") || a.chave.startsWith("conferir_whatsapp"));
      setAvisos(l); notificarAvisosCadastro(l);
    }).catch(() => {});
    return () => { vivo = false; };
  }, [uid, pronta, voltou]);

  // (11/11) cardápio que nunca teve visita: o "Divulgar" já entra na trilha (o aviso de sempre só vem depois de 7 dias)
  const [semVisita, setSemVisita] = useState(false);
  useEffect(() => {
    if (!uid || pronta !== true) return;
    let vivo = true;
    void supabase.from("cardapio_visitas").select("id", { count: "exact", head: true }).eq("user_id", uid)
      .then(r => { if (vivo && !r.error) setSemVisita(r.count === 0); });
    return () => { vivo = false; };
  }, [uid, pronta, voltou]);

  // (18/10) notificações: enquanto não estiverem ligadas neste aparelho, é o primeiro passo (toque já pede a permissão)
  const push = usePushSubscription();
  // (6.66) ativa ali mesmo, sem abrir a tela de Notificações: ligou → aviso de teste; bloqueado → explica como liberar
  const comoLiberar = () => informar({ titulo: "Notificações bloqueadas", icone: "alerta", texto: ehIphone()
    ? "Para ligar: abra Ajustes, depois Notificações, Doonly e Permitir Notificações."
    : "Para ativar: toque no cadeado ao lado do endereço do site, vá em Notificações e escolha “Permitir”. Depois toque em Ativar de novo." });
  const ativarNotif = async () => {
    if (push.permission === "denied") { comoLiberar(); return; }
    const ok = await push.subscribe();
    if (ok) {
      setMexeu(n => n + 1);
      void supabase.functions.invoke("push-pessoal", { body: { teste: true } }).catch(() => {});
      void avisoDeTesteNaLista();
      avisar("Notificações ligadas. Um aviso de teste chega em alguns segundos.", { tipo: "ok", duracao: 6000 });
    }
    else if (Notification.permission === "denied") comoLiberar();
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

  // (6.88) Android pelo navegador: o convite de instalar (um toque abre a janela do próprio Chrome). Some depois de instalado.
  const [podeInstalar, setPodeInstalar] = useState(() => !!getInstallPrompt())
  useEffect(() => onInstallChange(() => setPodeInstalar(!!getInstallPrompt())), [])
  const celularAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent || "")
  const itemInstalar: Item[] = uid && celularAndroid && podeInstalar && !isStandalone() ? [{
    chave: "instalar_android", nivel: "atencao", Ic: DeviceMobile, ordem: -95, acao: "Instalar", link: "/configuracoes", fechar: true,
    t: "Instale o Doonly no celular", s: "Abre direto, como um app",
    txt: "Abre direto, como um app, e fica na tela inicial do celular.",
    aoTocar: () => { void promptInstall().then(ok => { setPodeInstalar(!!getInstallPrompt()); if (ok) avisar("Pronto! O Doonly está na tela inicial do celular.", { tipo: "ok" }) }) },
  }] : [];

  // (23/10) plano PRO vencendo ou em atraso: antes só aparecia na tela Notificações (que saiu)
  const avisoPro = profile?.pro_expira_em ? avisoDoPro(profile.pro_expira_em) : null;
  const itemPro: Item[] = avisoPro ? [{
    chave: `${avisoPro.chave}`, nivel: avisoPro.tipo === "pro_atrasado" ? "urgente" : "atencao", Ic: Crown, ordem: -90, acao: "Renovar", link: "/assinar", fechar: false,
    t: avisoPro.tipo === "pro_atrasado" ? "Mensalidade do PRO em atraso" : "Seu PRO vence em breve",
    s: avisoPro.tipo === "pro_atrasado" ? "Regularize para voltar ao PRO" : `Vence no dia ${/dia (\d\d\/\d\d)/.exec(avisoPro.mensagem)?.[1] || ""}`.trim(),
    txt: avisoPro.mensagem,
  }] : [];

  // (11/11) "Divulgue seu cardápio" entra na trilha desde o começo (o aviso só aparecia depois de uma semana sem visitas)
  const itemDivulgar: Item[] = uid && pronta === true && semVisita && !avisos.some(a => a.chave === "divulgar_cardapio") ? [{
    chave: "divulgar_cardapio", nivel: "normal", Ic: ShareNetwork, ordem: 50, acao: "Divulgar", link: "/divulgar", fechar: true,
    t: "Divulgue seu cardápio", s: "Mande o link para as clientes",
    txt: "Mande o link no WhatsApp e no Instagram. É assim que chegam os primeiros pedidos.",
  }] : [];

  const brutos: Item[] = [
    ...itemNotif,
    ...itemInstalar,
    ...itemPro,
    ...avisos.map((a, i): Item => ({
      chave: a.chave, nivel: a.nivel, Ic: ICONE[a.icone], t: a.curto.t, s: a.curto.s, link: a.link, estado: a.estado, ordem: i,
      acao: ACAO[a.icone] || "Ver", fechar: a.icone !== "conta" && a.icone !== "whatsapp" && !a.cobrar, naoQuero: a.naoQuero,
      aoRevisar: a.feriado ? () => {
        // (6.179) "Abre normal": some de vez (é só deste feriado)
        try { localStorage.setItem(kAte(a.chave), "nunca"); } catch { /* sem armazenamento */ }
        setMexeu(n => n + 1); avisar("Combinado, o cardápio segue aceitando pedidos nesse dia.", { tipo: "ok" });
      } : a.cobrar ? () => { const c = a.cobrar!; window.open(linkWhatsApp(c.telefone, c.texto) || `https://wa.me/?text=${encodeURIComponent(c.texto)}`, "_blank", "noopener"); } : undefined,
      // (04/11 · 6.20) WhatsApp: "Está certo" confirma aqui mesmo; "Corrigir" leva pro campo com o balão
      aoTocar: a.receber ? async () => {
        // (6.182) "Já recebi" registra de verdade (antes só abria o pedido): pergunta, lança no caixa e some
        const r0 = a.receber!;
        const valor = r0.falta.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const ok = await confirmar({ titulo: `Recebeu ${valor}?`, texto: `${r0.rotulo}. O valor entra no caixa.`, rotulo: "Recebi", rotuloVoltar: "Voltar" });
        if (!ok) return;
        const r = await registrarPagamento({ pedidoId: r0.pedidoId, userId: uid, valor: r0.falta, forma: r0.forma, tipo: r0.parcial ? "restante" : "total" });
        if (!r.ok) { avisar(r.erro || "Não deu para registrar agora. Tente de novo.", { tipo: "erro" }); return; }
        setAvisos(l => l.filter(x => x.chave !== a.chave)); avisar(`Pronto, ${valor} no caixa.`, { tipo: "ok" });
      } : a.feriado && uid ? () => {
        const f = a.feriado!;
        salvarFechados(uid, l => [...l, { inicio: f.data, fim: f.data, tipo: "feriado", nome: f.nome }]).then(r => {
          if (!r.ok) { avisar("Não deu para fechar o dia agora. Tente de novo.", { tipo: "erro" }); return; }
          setAvisos(l => l.filter(x => x.chave !== a.chave)); void refetch();
          avisar(`Pronto, dia ${f.data.slice(8, 10)}/${f.data.slice(5, 7)} fechado no cardápio.`, { tipo: "ok" });
        }, () => avisar("Não deu para fechar o dia agora. Tente de novo.", { tipo: "erro" }));
      } : a.confirmarWhats ? () => { const tel = a.confirmarWhats!; supabase.auth.updateUser({ data: { whatsapp_ok: tel } }).then(() => { setAvisos(l => l.filter(x => x.chave !== a.chave)); avisar("Pronto, número confirmado.", { tipo: "ok" }); }, () => avisar("Não deu para confirmar agora. Tente de novo.", { tipo: "erro" })); } : undefined,
      rotuloRevisar: a.icone === "whatsapp" ? "Corrigir" : a.cobrar ? "Cobrar" : a.feriado ? "Abre normal" : undefined,
      // conta: o vencimento em vermelho e, no lugar do "Agora não", o "Revisar" (digitou errado ou a conta não existe)
      txt: a.icone === "conta" ? "Pague ou marque como paga." : a.texto,
      alerta: a.icone === "conta" ? a.curto.s : undefined,
      comoFunciona: COMO[a.icone],
      revisar: a.icone === "conta" && a.estado?.abrir?.startsWith("pagar:") ? { abrir: `revisar:${a.estado.abrir.slice(6)}` } : a.icone === "whatsapp" ? a.estado : undefined,
    })),
    ...updates.map((u): Item => ({
      chave: u.key, nivel: u.key === "faturamento-down" || u.key === "aniversarios" ? "atencao" : "normal",
      Ic: u.Icone, t: u.curto.t, s: u.curto.s || TEXTO_NOVIDADE[u.key] || u.descricao, link: u.path, ordem: 100 - u.prioridade, acao: ACAO_NOVIDADE[u.key] || "Ver", fechar: true,
      txt: TEXTO_NOVIDADE[u.key] || u.descricao,
    })),
    ...itemDivulgar,
  ];
  const itens: Item[] = brutos.filter(x => !x.fechar || !escondido(x.chave))
   .sort((a, b) => PESO[a.nivel] - PESO[b.nivel] || a.ordem - b.ordem);

  // (11/11) "Seu próximo passo": o que é de crescer a loja sai do "Pra fazer" e vira uma trilha, um passo por vez,
  // com o progresso e o que já foi feito. O "Pra fazer" fica com o urgente e o rápido (conta, WhatsApp, avisos...).
  // o perfil vem com select("*"): as formas de pagamento estão nele, só não no tipo
  const formas = (profile as { formas_pagamento?: unknown } | null)?.formas_pagamento;
  const aceitaPix = Array.isArray(formas) && formas.some(f => String(f).toLowerCase().includes("pix"));
  const core = TRILHA.filter(t => t.k !== "ligar_pix_cardapio" || aceitaPix);
  const nunca = (chave: string) => { try { return localStorage.getItem(kAte(chave)) === "nunca"; } catch { return false; } };
  const pendentes = new Set(brutos.filter(x => !nunca(x.chave)).map(x => passoDe(x.chave)).filter(Boolean) as string[]);
  const feitos = core.filter(t => !pendentes.has(t.k));
  const daTrilha = (x: Item) => !!passoDe(x.chave);
  const ordemTrilha = (x: Item) => { const k = passoDe(x.chave)!; const i = core.findIndex(t => t.k === k); return i >= 0 ? i : 100 + EXTRAS.indexOf(k); };
  const trilha = pronta === true ? itens.filter(daTrilha).sort((a, b) => ordemTrilha(a) - ordemTrilha(b)) : [];
  const passo = trilha[0];
  const lista = itens.filter(x => !daTrilha(x));

  // comemora quando um passo da trilha fica pronto (só os que ela fez agora, não os de antes)
  const kFeitos = `doonly_trilha_feitos_${uid}`;
  const feitosChave = feitos.map(t => t.k).join(",");
  useEffect(() => {
    if (!uid || pronta !== true) return;
    try {
      const antes = localStorage.getItem(kFeitos);
      localStorage.setItem(kFeitos, feitosChave);
      if (antes === null) return;
      const novos = feitos.filter(t => !antes.split(",").includes(t.k));
      if (!novos.length) return;
      avisar(feitos.length === core.length ? "Você completou todos os passos. Sua loja está pronta para crescer! 🎉" : `Passo concluído: ${novos[0].nome}. Boa! 🎉`, { tipo: "ok", duracao: 5000 });
    } catch { /* sem armazenamento: sem comemoração */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, pronta, feitosChave]);

  if (!lista.length && !passo) return null;
  const mostrar = aberto ? lista : lista.slice(0, VISIVEIS);
  const resto = lista.length - VISIVEIS;
  const ir = (x: Item) => x.aoTocar ? x.aoTocar() : navigate(x.link, x.estado ? { state: x.estado } : undefined);
  const adiar = (x: Item, dias: number | "nunca") => {
    try {
      if (dias === "nunca") localStorage.setItem(kAte(x.chave), "nunca");
      else { const d = new Date(); d.setDate(d.getDate() + dias); d.setHours(5, 0, 0, 0); localStorage.setItem(kAte(x.chave), String(d.getTime())); }
    } catch { /* sem armazenamento */ }
    setMenu(null); setMexeu(n => n + 1);
    avisar(dias === "nunca" ? "Pronto, não aparece mais neste aparelho." : dias === 1 ? "Volta amanhã." : "Volta daqui a uma semana.", { tipo: "ok" });
  };
  // o "Agora não" (7 dias, amanhã, não lembrar mais): o mesmo menu na lista e no passo da trilha
  const agoraNao = (x: Item) => (
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
  );
  const kPasso = passo ? passoDe(passo.chave)! : "";
  const nomePasso = (k: string) => TRILHA.find(t => t.k === k)?.nome;
  // a lista embaixo do passo: os feitos (✓) e os que faltam, sem repetir o passo de agora
  const proximos = core.filter(t => t.k !== kPasso);
  return (
    <div className="pf-grupo" ref={raiz}>
    {lista.length > 0 && (
    <section className="pf" aria-label="Pra fazer">
      <div className="pf-cab">
        <b className="pf-t">Pra fazer</b>
        <span className="pf-n" aria-label={`${lista.length} ${lista.length === 1 ? "item" : "itens"}`}>{lista.length}</span>
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
                {x.aoRevisar ? (
                  <button type="button" className="pf-nao" onClick={x.aoRevisar}>{x.rotuloRevisar || "Revisar"}</button>
                ) : x.naoQuero ? (
                  <button type="button" className="pf-nao" onClick={() => adiar(x, "nunca")}>Não quero</button>
                ) : x.revisar ? (
                  <button type="button" className="pf-nao" onClick={() => navigate(x.link, { state: x.revisar })}>{x.rotuloRevisar || "Revisar"}</button>
                ) : x.fechar ? agoraNao(x) : null}
                <button type="button" className="pf-bt" disabled={x.aoTocar && x.chave === "ativar_notificacoes" ? push.loading : false} onClick={() => ir(x)}>{x.acao}</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {cel && (() => {
        const x = [...lista, ...(passo ? [passo] : [])].find(i => i.chave === como);
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
    </section>
    )}
    {passo && (
    <section className="pf pf-trilha" aria-label="Seu próximo passo">
      <div className="pf-cab">
        <b className="pf-t">Seu próximo passo</b>
        <span className="pf-prog">Vender mais · {feitos.length} de {core.length}</span>
      </div>
      <div className="pf-barra" role="progressbar" aria-valuemin={0} aria-valuemax={core.length} aria-valuenow={feitos.length} aria-label={`${feitos.length} de ${core.length} passos feitos`}>
        <i style={{ width: `${Math.round((feitos.length / Math.max(core.length, 1)) * 100)}%` }} />
      </div>
      <div className="pf-passo">
        <span className="pf-ic" aria-hidden="true"><passo.Ic size={22} weight="bold" /></span>
        <div className="pf-tx">
          <b>{nomePasso(kPasso) || passo.t}</b>
          <p>{TRILHA.find(t => t.k === kPasso)?.txt || passo.s}{passo.comoFunciona && <> <button type="button" className="pf-como" aria-expanded={como === passo.chave} onClick={() => setComo(c => c === passo.chave ? null : passo.chave)}>Como funciona <Info size={14} weight="bold" aria-hidden="true" /></button></>}</p>
          {!cel && como === passo.chave && passo.comoFunciona && <ConteudoComo c={passo.comoFunciona} rotulo={passo.t} className="pf-cf" />}
          <div className="pf-bts pf-bts--passo">
            <button type="button" className="pf-bt pf-bt--cheio" onClick={() => ir(passo)}>{passo.acao}</button>
            {passo.naoQuero ? <button type="button" className="pf-nao" onClick={() => adiar(passo, "nunca")}>Não quero</button> : agoraNao(passo)}
          </div>
        </div>
      </div>
      {proximos.length > 0 && (
        <ul className="pf-proximos">
          {proximos.map(t => {
            const ok = feitos.some(f => f.k === t.k);
            return <li key={t.k} className={ok ? "ok" : undefined}><span aria-hidden="true">{ok ? <Check size={14} weight="bold" /> : <i />}</span>{t.nome}<em className="pf-sr">{ok ? " (feito)" : " (falta)"}</em></li>;
          })}
        </ul>
      )}
    </section>
    )}
    <style>{CSS}</style>
    </div>
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
  /* (11/11) os dois cartões juntos: "Pra fazer" (urgente e rápido) e "Seu próximo passo" (a trilha) */
  .pf-grupo { display: flex; flex-direction: column; gap: 12px; }
  .pf-cab { min-width: 0; }
  .pf-prog { margin-left: auto; flex: none; font-size: 12.5px; font-weight: 500; color: var(--ui-texto-2); white-space: nowrap; }
  .pf-trilha { padding-bottom: 12px; }
  .pf-trilha .pf-t { white-space: nowrap; }
  .pf-barra { height: 6px; margin: 10px 0 12px; border-radius: 6px; background: #F1ECEE; overflow: hidden; }
  .pf-barra i { display: block; height: 100%; border-radius: 6px; background: var(--ui-rosa); transition: width .4s ease; }
  .pf-passo { display: flex; align-items: flex-start; gap: 12px; padding: 12px; border: 1px solid var(--ui-borda); border-radius: 14px; background: #FCFAFB; }
  .pf-passo .pf-ic { width: 40px; height: 40px; border-radius: 12px; background: var(--ui-branco); border: 1px solid var(--ui-borda); color: var(--ui-rosa-escuro); }
  .pf-passo .pf-cf { margin-left: -52px; }
  .pf-bts--passo { justify-content: flex-start; }
  .pf-bt--cheio { background: var(--ui-rosa); border-color: var(--ui-rosa); color: #fff; }
  .pf-proximos { margin: 10px 0 0; padding: 0 2px; list-style: none; }
  .pf-proximos li { display: flex; align-items: center; gap: 10px; min-height: 30px; font-size: 13.5px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pf-proximos li.ok { color: var(--ui-texto); }
  .pf-proximos li > span { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; color: #1F8A4C; }
  .pf-proximos li > span i { width: 12px; height: 12px; border: 1.5px solid #CFC5C9; border-radius: 50%; }
  .pf-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .pf-ver { display: block; width: 100%; min-height: 44px; margin: 0; border: 0; border-top: 1px solid var(--ui-linha, #F3ECEF); background: none; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--ui-rosa-escuro); cursor: pointer; }
`;

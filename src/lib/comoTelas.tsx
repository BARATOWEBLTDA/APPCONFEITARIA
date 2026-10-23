import {
  ArrowDown, ArrowUp, Bell, CalendarBlank, ChartLineUp, Coins, Funnel, HandCoins, ListChecks, MagnifyingGlass, Palette,
  PauseCircle, ShareNetwork, Storefront, WarningCircle, ArrowRight, Circle, House, ClipboardText, CurrencyDollar, ShoppingBag,
} from "@phosphor-icons/react";
import type { Como } from "@/components/como/ComoFunciona";
import type { PassoTour } from "@/components/como/tour";

/** (22/10) o (i) do topo das telas no formato da Dora: exemplo com números, o caminho e dicas curtas */

const RESUMO_INICIO = "O resumo do seu dia: o que precisa de você, as próximas entregas e atalhos pro resto do app.";

/** Início no celular: o (?) do "Olá" */
export const COMO_INICIO_CEL: Como = {
  tela: { nome: "Início", Icone: House }, resumo: RESUMO_INICIO, checks: true,
  dicas: [
    [Bell, <><b>Avisos:</b> o que está atrasado e o que precisa de você aparece primeiro.</>],
    [MagnifyingGlass, <><b>Buscar:</b> acha qualquer tela ou ação, como pix, cupom ou horário.</>],
    [ListChecks, <><b>Acesso rápido:</b> as telas que você mais usa, a um toque.</>],
    [CalendarBlank, <><b>Próximas entregas:</b> toque num dia pra ver só os pedidos dele.</>],
    [ListChecks, <><b>Pra fazer:</b> o que falta resolver, com o botão pra fazer na hora.</>],
  ],
};

/** Início no computador: o (i) do topo */
export const COMO_INICIO: Como = {
  tela: { nome: "Início", Icone: House }, resumo: RESUMO_INICIO, checks: true,
  dicas: [
    [ChartLineUp, <><b>Números do topo:</b> o que entrou no mês, os pedidos da semana e quanto vale cada pedido.</>],
    [CalendarBlank, <><b>Próximas entregas:</b> os pedidos dos próximos dias, com a hora e o valor.</>],
    [ListChecks, <><b>Pra fazer:</b> o que precisa da sua atenção, com o botão pra resolver.</>],
    [MagnifyingGlass, <><b>Buscar</b> (Ctrl K): acha qualquer tela ou ação, como pix, cupom ou horário.</>],
  ],
};

/** tour do Início no celular (só entram os passos que estão na tela) */
export const TOUR_INICIO_CEL: PassoTour[] = [
  { el: ".ini-section--novos", titulo: "Avisos", texto: "Pedido novo pra aceitar e pedido atrasado aparecem aqui, antes de tudo." },
  { el: ".ini-busca", titulo: "Buscar", texto: "Digite o que você procura, como \"pix\", \"cupom\" ou \"horário\", e vá direto pra tela certa." },
  { el: ".ini-section--nav", titulo: "Acesso rápido", texto: "As telas que você mais usa. O resto do app está no Menu, aqui embaixo." },
  { el: ".ini-section--dia", titulo: "Próximas entregas", texto: "Os pedidos dos próximos dias. Toque num dia pra ver só os pedidos dele." },
  { el: ".ini-falta .pf", titulo: "Pra fazer", texto: "O que falta resolver, com o botão pra fazer na hora. Não dá agora? Toque em Agora não." },
  { el: ".bn-novo", titulo: "Nova venda", texto: "O + registra uma venda de qualquer tela do app." },
];

/** tour do Início no computador */
export const TOUR_INICIO_PC: PassoTour[] = [
  { el: ".ini-dk-kpis", titulo: "Seus números", texto: "O que entrou no mês, os pedidos da semana, as entregas de hoje e quanto vale cada pedido." },
  { el: ".dkg-entregas", titulo: "Próximas entregas", texto: "Os pedidos dos próximos dias. Clique num pedido pra abrir." },
  { el: ".dkg-fazer .pf", titulo: "Pra fazer", texto: "O que falta resolver, com o botão pra fazer na hora." },
  { el: ".cab-busca", titulo: "Buscar", texto: "Ache qualquer tela ou ação. Atalho: Ctrl K." },
  { el: ".sb-pausar", titulo: "Sua loja", texto: "Mostra se a loja está aberta e liga ou desliga os pedidos pelo cardápio." },
];

export const COMO_PEDIDOS: Como = {
  tela: { nome: "Pedidos", Icone: ClipboardText },
  tit: "Exemplo · pedido do cardápio",
  linhas: [["Bolo brigadeiro 1 kg", "R$ 47,61"], ["Sinal pago no Pix", "R$ 23,81"]],
  total: ["Falta receber", "R$ 23,80"],
  fluxo: ["Aceitar", "Agendado", "Pronto", "Entregue"],
  dicas: [
    [Bell, <>Pedido novo do cardápio chega em <b>Pra aceitar</b>. Aceite pra ele ir pra agenda.</>],
    [ArrowRight, <>O botão de cada pedido leva pra <b>próxima etapa</b>: Produzir, Pronto, Entregue.</>],
    [HandCoins, <>O que <b>falta receber</b> fica em laranja até você registrar o pagamento.</>],
    [Funnel, <>O <b>filtro</b> escolhe a situação e a data da entrega.</>],
  ],
};

export const COMO_AGENDA: Como = {
  tela: { nome: "Agenda", Icone: CalendarBlank },
  tit: "Exemplo · sexta-feira",
  linhas: [["Bolo de aniversário · 14:00", "R$ 120,00"], ["Kit festa · 16:30", "R$ 650,00"]],
  total: ["Total do dia", "R$ 770,00"],
  fluxo: ["Pedido aceito", "Na agenda", "Entrega"],
  dicas: [
    [CalendarBlank, <>Cada dia mostra o <b>nome de quem vai receber</b>. Toque no dia pra ver os pedidos dele.</>],
    [Circle, <><b>Cores:</b> vermelho atrasado, laranja pra aceitar, azul na agenda, verde concluído.</>],
    [WarningCircle, <><b>Precisa de atenção</b> fica em cima: atrasados e pedidos pra aceitar.</>],
    [MagnifyingGlass, <>Busque pelo <b>nome do cliente</b> ou pelo número do pedido.</>],
  ],
};

export const COMO_FINANCEIRO: Como = {
  tela: { nome: "Financeiro", Icone: CurrencyDollar },
  tit: "Exemplo · um dia de vendas",
  linhas: [["Entrou (pedidos pagos)", "R$ 300,00"], ["Saiu (contas e compras)", "R$ 80,00"]],
  total: ["Sobrou hoje", "R$ 220,00"],
  fluxo: ["Cliente paga", "Entra no caixa", "Sobrou"],
  dicas: [
    [ArrowUp, <><b>Entrou:</b> o que você recebeu de pedidos e vendas.</>],
    [ArrowDown, <><b>Saiu:</b> contas pagas e compras do dia.</>],
    [HandCoins, <><b>A receber</b> e <b>A pagar</b> mostram o que ainda vai entrar e sair.</>],
    [Coins, <>Informe o <b>saldo do caixa</b> uma vez pra tudo bater certinho.</>],
  ],
};

export const COMO_CARDAPIO: Como = {
  tela: { nome: "Cardápio digital", Icone: ShoppingBag },
  tit: "Exemplo · últimos 7 dias",
  linhas: [["Visitas no cardápio", "200"], ["Pedidos pelo cardápio", "14"]],
  total: ["Conversão", "7%"],
  fluxo: ["Seu link", "Cliente pede", "Chega em Pedidos"],
  dicas: [
    [ShareNetwork, <>Mande o <b>link</b> no WhatsApp e no Instagram. O <b>QR Code</b> é pra imprimir.</>],
    [PauseCircle, <><b>Pausar pedidos</b> fecha o cardápio na hora, sem mudar o horário.</>],
    [Palette, <><b>Aparência:</b> cores, logo e banners de promoção.</>],
    [Storefront, <><b>Dados da loja:</b> horário, entrega, Pix e endereço.</>],
  ],
};

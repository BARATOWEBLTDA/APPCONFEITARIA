import {
  ArrowDown, ArrowUp, Bell, CalendarBlank, ChartLineUp, Coins, Funnel, HandCoins, ListChecks, MagnifyingGlass, Palette,
  PauseCircle, ShareNetwork, Storefront, WarningCircle, ArrowRight, Circle, House, ClipboardText, CurrencyDollar, ShoppingBag, CheckCircle,
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
  { el: ".ini-section--novos", titulo: "Avisos", texto: "Pedidos novos para aceitar e pedidos atrasados aparecem aqui primeiro." },
  { el: ".ini-busca", titulo: "Buscar", texto: "Digite o que procura, como \"pix\", \"cupom\" ou \"horário\", e vá direto para a tela certa." },
  { el: ".ini-section--nav", titulo: "Acesso rápido", texto: "Atalhos para as telas mais usadas. As demais ficam no Menu, na barra inferior." },
  { el: ".ini-section--dia", titulo: "Próximas entregas", texto: "Pedidos dos próximos dias. Toque em um dia para ver apenas os pedidos dele." },
  { el: ".ini-falta .pf", titulo: "Pra fazer", texto: "Pendências da sua loja, com o botão para resolver na hora. Se preferir deixar para depois, toque em Agora não." },
  { el: ".bn-novo-c", titulo: "Nova venda", texto: "Registre uma venda ou encomenda a qualquer momento. O botão aparece em todas as telas.", redondo: true },
];

/** tour do Início no computador */
export const TOUR_INICIO_PC: PassoTour[] = [
  { el: ".ini-dk-kpis", titulo: "Seus números", texto: "Recebido no mês, pedidos dos últimos 7 dias, entregas de hoje e ticket médio." },
  { el: ".dkg-entregas", titulo: "Próximas entregas", texto: "Pedidos dos próximos dias. Clique em um pedido para ver os detalhes." },
  { el: ".dkg-fazer .pf", titulo: "Pra fazer", texto: "Pendências da sua loja, com o botão para resolver na hora." },
  { el: ".cab-busca", titulo: "Buscar", texto: "Encontre qualquer tela ou ação do sistema. Atalho: Ctrl + K." },
  { el: ".sb-pausar", titulo: "Sua loja", texto: "Mostra se a loja está aberta e permite pausar ou retomar os pedidos pelo cardápio." },
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

/** (22/10) tour da Agenda, no (i) do topo (celular e computador; só entram os passos que estão na tela) */
export const TOUR_AGENDA: PassoTour[] = [
  { el: ".ag3-busca", titulo: "Buscar", texto: "Encontre um pedido pelo nome do cliente ou pelo número." },
  { el: ".ag3-filtro", titulo: "Filtro", texto: "Escolha quais situações aparecem na agenda. Por exemplo, oculte os pedidos concluídos." },
  { el: ".ag3-cal", titulo: "Calendário", texto: "Cada pedido aparece no dia da entrega, na cor da sua situação. Vermelho indica atraso. Selecione um dia para ver os pedidos dele." },
  { el: ".ag3-dia", titulo: "Dia escolhido", texto: "Mostra o dia selecionado e quanto ainda falta receber dos pedidos desse dia." },
  { el: ".ag3-at--atr", titulo: "Precisa de atenção", texto: "Pedidos com entrega atrasada. Use o botão ao lado para avançar cada um para a próxima etapa." },
  { el: ".ag3-at--prox", titulo: "Próximos dias", texto: "Quando o dia selecionado não tem pedidos, aqui aparecem as próximas entregas." },
  { el: ".ag3-lista", titulo: "Pedidos do dia", texto: "Selecione um pedido para ver os detalhes. Marcar como pronto e chamar o cliente no WhatsApp ficam no próprio cartão." },
];

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

/** (23/10) A receber: o (i) do topo e o tour */
export const COMO_A_RECEBER: Como = {
  tela: { nome: "A receber", Icone: HandCoins },
  resumo: "Pedidos que ainda têm valor a receber: o total menos o que o cliente já pagou.",
  tit: "Exemplo · bolo de aniversário",
  linhas: [["Total do pedido", "R$ 200,00"], ["Sinal pago", "R$ 100,00"]],
  total: ["Falta receber", "R$ 100,00"],
  fluxo: ["Sinal pago", "Receber o resto", "Quitado"],
  dicas: [
    [WarningCircle, <><b>Atrasados</b> aparecem primeiro: a data combinada para o pagamento já passou.</>],
    [CalendarBlank, <>A data usada é a combinada para o pagamento ou, sem ela, a da entrega.</>],
    [Coins, <>Toque em <b>Receber</b> quando o cliente pagar. O valor entra no Financeiro na data escolhida.</>],
    [CheckCircle, <>Quando o pedido é <b>quitado</b>, ele sai desta lista automaticamente.</>],
  ],
};

export const TOUR_A_RECEBER: PassoTour[] = [
  { el: ".far-resumo", titulo: "Resumo", texto: "Quanto falta receber, separado em atrasados, próximos 7 dias e depois." },
  { el: ".far-grupo", titulo: "Pedidos com saldo", texto: "Cada pedido mostra o total, quanto já foi pago e quanto falta. Os atrasados aparecem primeiro." },
  { el: ".far-rec", titulo: "Receber", texto: "Registre o pagamento quando o cliente pagar. Dá para receber o valor total ou só uma parte." },
  { el: ".far-ver", titulo: "Abrir pedido", texto: "Abre o pedido completo, com os itens, a entrega e os pagamentos já feitos." },
];

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

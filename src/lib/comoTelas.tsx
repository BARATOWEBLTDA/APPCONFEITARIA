import {
  ArrowDown, ArrowUp, Bell, CalendarBlank, ChartLineUp, Coins, Funnel, HandCoins, ListChecks, MagnifyingGlass, Palette,
  PauseCircle, ShareNetwork, Storefront, WarningCircle, ArrowRight, Circle, House, ClipboardText, CurrencyDollar, ShoppingBag, CheckCircle,
  Users, UserPlus, Cake, ClockCounterClockwise, Camera, ToggleRight, Tag, Basket, TrendDown, ArrowsClockwise, CreditCard, Scales, ShoppingBagOpen,
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
  resumo: "Pedidos com valor pendente: o total do pedido menos o que o cliente já pagou.",
  tit: "Exemplo · bolo de aniversário",
  linhas: [["Total do pedido", "R$ 200,00"], ["Sinal pago", "R$ 100,00"]],
  total: ["Falta receber", "R$ 100,00"],
  fluxo: ["Sinal pago", "Receber saldo", "Quitado"],
  dicas: [
    [WarningCircle, <>Os pedidos <b>atrasados</b> aparecem primeiro, quando a data de pagamento já passou.</>],
    [CalendarBlank, <>A data considerada é a combinada para o pagamento ou, se não houver, a da entrega.</>],
    [Coins, <>Use <b>Receber</b> quando o cliente pagar. O valor entra no Financeiro na data informada.</>],
    [CheckCircle, <>Pedidos <b>quitados</b> saem desta lista automaticamente.</>],
  ],
};

export const TOUR_A_RECEBER: PassoTour[] = [
  { el: ".far-resumo", titulo: "Resumo", texto: "Total pendente, separado em atrasados, próximos 7 dias e depois." },
  { el: ".far-grupo", titulo: "Pedidos com saldo", texto: "Cada pedido mostra o valor total, o que já foi pago e o que falta. Os atrasados aparecem primeiro." },
  { el: ".far-rec", titulo: "Receber", texto: "Registre o pagamento quando o cliente pagar. É possível receber o valor total ou apenas uma parte." },
  { el: ".far-ver", titulo: "Abrir pedido", texto: "Abre o pedido completo, com os itens, a entrega e o histórico de pagamentos." },
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

/* ══════ (23/10) Atalhos do Início: Clientes, Produtos, Ficha técnica e Lucratividade ══════ */

export const COMO_CLIENTES: Como = {
  tela: { nome: "Clientes", Icone: Users },
  resumo: "Quem compra de você, com contato, aniversário e histórico de pedidos.",
  tit: "Exemplo · uma cliente frequente",
  linhas: [["Pedidos feitos", "8"], ["Total gasto", "R$ 960,00"]],
  total: ["Ticket médio", "R$ 120,00"],
  fluxo: ["Pedido", "Cadastro", "Histórico"],
  dicas: [
    [Storefront, <>Quem pede pelo <b>cardápio</b> é cadastrado automaticamente.</>],
    [UserPlus, <>Cadastre quem compra pelo <b>WhatsApp</b> ou no <b>balcão</b> em Novo cliente.</>],
    [Cake, <><b>Aniversários</b> dos próximos 30 dias aparecem em destaque, com o botão para enviar os parabéns.</>],
    [ClockCounterClockwise, <>O filtro <b>Sem comprar há 60 dias</b> mostra quem vale a pena chamar de volta.</>],
  ],
};

export const TOUR_CLIENTES: PassoTour[] = [
  { el: ".cl9-faixa", titulo: "Seus números", texto: "Total de clientes, quem comprou nos últimos 30 dias e os aniversários dos próximos 30 dias." },
  { el: ".cl9-nums", titulo: "Seus números", texto: "Total de clientes, quem comprou nos últimos 30 dias, os aniversários dos próximos 30 dias e o ticket médio." },
  { el: ".cl9-niver", titulo: "Aniversários", texto: "Clientes que fazem aniversário nos próximos 30 dias. Envie os parabéns pelo WhatsApp." },
  { el: ".cl9-busca", titulo: "Buscar", texto: "Encontre um cliente pelo nome, telefone ou e-mail." },
  { el: ".cl9-acoes", titulo: "Novo cliente", texto: "Cadastre quem compra pelo WhatsApp ou no balcão. Quem pede pelo cardápio é cadastrado automaticamente." },
  { el: ".cl9-chips", titulo: "Filtros", texto: "Veja aniversariantes, novos cadastros e clientes sem comprar há 60 dias." },
  { el: ".cl9-lista, .cl9-tab", titulo: "Lista de clientes", texto: "Selecione um cliente para ver o histórico de pedidos e o total gasto. O ícone do WhatsApp abre a conversa." },
];

export const COMO_PRODUTOS: Como = {
  tela: { nome: "Produtos", Icone: Cake },
  resumo: "Tudo o que você vende, com foto, preço e opções. Os produtos ativos aparecem no seu cardápio digital.",
  tit: "Exemplo · bolo de chocolate",
  linhas: [["Preço de venda", "R$ 120,00"], ["Custo pela ficha técnica", "R$ 48,00"]],
  total: ["Lucro por unidade", "R$ 72,00"],
  fluxo: ["Cadastrar", "Ficha técnica", "No cardápio"],
  dicas: [
    [Camera, <><b>Fotos</b> boas vendem mais: use luz natural e um fundo limpo.</>],
    [ToggleRight, <>A <b>chave</b> mostra ou oculta o produto no cardápio, sem precisar excluí-lo.</>],
    [ListChecks, <>Monte a <b>ficha técnica</b> para ver o custo e o lucro de cada produto.</>],
    [Tag, <>Organize por <b>categorias</b> para o cliente encontrar tudo com facilidade.</>],
  ],
};

export const TOUR_PRODUTOS: PassoTour[] = [
  { el: ".pl-busca", titulo: "Buscar", texto: "Encontre um produto pelo nome." },
  { el: ".pl-novo", titulo: "Novo produto", texto: "Cadastre um produto com foto, preço, descrição e opções, como sabores e tamanhos." },
  { el: ".pl-ord .ui-tit-acao", titulo: "Ordenar", texto: "Organize a lista por mais recentes, ordem alfabética, categoria ou preço." },
  { el: ".prod-card", titulo: "Produto", texto: "Selecione um produto para editar as informações, as fotos e as opções." },
  { el: ".pl-lin-chave, .pl-ficha-on", titulo: "Mostrar no cardápio", texto: "Ative ou desative para mostrar ou ocultar o produto no cardápio, sem precisar excluí-lo." },
  { el: ".pl-lin-ficha, .pl-sem-ficha", titulo: "Ficha técnica", texto: "Monte a ficha técnica para descobrir o custo e o lucro de cada produto." },
];

export const COMO_FICHA: Como = {
  tela: { nome: "Ficha técnica", Icone: ListChecks },
  resumo: "Quanto custa fazer cada produto e quanto sobra de lucro no preço que você cobra.",
  tit: "Exemplo · bolo de 1 kg",
  linhas: [["Preço de venda", "R$ 120,00"], ["Custo total", "R$ 50,00"]],
  total: ["Lucro · margem de 58%", "R$ 70,00"],
  fluxo: ["Ingredientes", "Custo", "Lucro"],
  dicas: [
    [Basket, <>O custo soma os <b>ingredientes</b>, os custos invisíveis (gás, perdas e descartáveis) e a sua <b>mão de obra</b>.</>],
    [Circle, <><b>Margem:</b> verde a partir de 30%, laranja abaixo disso e vermelho quando há prejuízo.</>],
    [TrendDown, <>Produtos <b>dando prejuízo</b> aparecem em destaque no topo, para você ajustar o preço.</>],
    [ArrowsClockwise, <>Quando o preço de um <b>ingrediente</b> muda, o custo das fichas é atualizado automaticamente.</>],
  ],
};

export const TOUR_FICHA: PassoTour[] = [
  { el: ".fl-alerta", titulo: "Prejuízo", texto: "Produtos com preço de venda abaixo do custo. Selecione para ver quais são e ajustar o preço." },
  { el: ".cl9-busca", titulo: "Buscar", texto: "Encontre um produto pelo nome." },
  { el: ".cl9-chips", titulo: "Filtros", texto: "Separe os produtos com ficha, sem ficha e os que estão dando prejuízo." },
  { el: ".fl-l", titulo: "Produto", texto: "Mostra o custo, o lucro e a margem de cada produto. Selecione para montar ou ajustar a ficha técnica." },
];

export const COMO_LUCRATIVIDADE: Como = {
  tela: { nome: "Lucratividade", Icone: ChartLineUp },
  resumo: "Onde está o seu lucro de verdade: o que você vendeu menos todos os custos do mês.",
  tit: "Exemplo · um mês",
  linhas: [["Vendido", "R$ 5.000,00"], ["Ingredientes, taxas e despesas", "R$ 3.200,00"]],
  total: ["Lucro do mês", "R$ 1.800,00"],
  fluxo: ["Vendido", "Custos", "Lucro"],
  dicas: [
    [ShoppingBagOpen, <><b>Vendido</b> considera os pedidos entregues no mês.</>],
    [CreditCard, <>A <b>taxa da maquininha</b> entra só nos pedidos pagos no cartão. Pix e dinheiro não têm taxa.</>],
    [ListChecks, <>Produtos sem <b>ficha técnica</b> deixam o lucro maior do que é, porque o custo dos ingredientes não entra.</>],
    [Scales, <>O <b>ponto de equilíbrio</b> mostra quanto vender no mês para pagar os custos fixos e o seu salário.</>],
  ],
};

export const TOUR_LUCRATIVIDADE: PassoTour[] = [
  { el: ".lu-mes", titulo: "Mês", texto: "Escolha o mês que deseja analisar." },
  { el: ".lu-conta", titulo: "A conta do mês", texto: "O valor vendido menos o custo dos ingredientes, as taxas e embalagens e as despesas pagas." },
  { el: ".lu-k--lucro", titulo: "Lucro do mês", texto: "O que sobrou de fato, com a margem sobre o valor vendido." },
  { el: ".lu-aviso", titulo: "Sem ficha técnica", texto: "Produtos vendidos sem ficha técnica. Sem ela, o custo dos ingredientes não entra na conta e o lucro aparece maior do que é." },
  { el: ".lu-pc", titulo: "Lucro por produto", texto: "Cada produto vendido no mês, com a quantidade, o valor vendido e o lucro pela ficha técnica." },
  { el: ".lu-a-eq", titulo: "Ponto de equilíbrio", texto: "Quanto você precisa vender no mês para pagar os custos fixos e o seu salário." },
];

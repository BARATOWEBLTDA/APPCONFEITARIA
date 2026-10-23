import {
  ArrowDown, ArrowUp, Bell, CalendarBlank, ChartLineUp, Coins, Funnel, HandCoins, ListChecks, MagnifyingGlass, Palette,
  PauseCircle, ShareNetwork, Storefront, WarningCircle, ArrowRight, Circle, House, ClipboardText, CurrencyDollar, ShoppingBag, CheckCircle,
  Users, UserPlus, Cake, ClockCounterClockwise, Camera, ToggleRight, Tag, Basket, TrendDown, ArrowsClockwise, CreditCard, Scales, ShoppingBagOpen,
  SquaresFour, ArrowsDownUp, Info, PuzzlePiece, ArrowCounterClockwise, DownloadSimple, CalendarCheck, Buildings, X, Clock, Flame, Sparkle, Images,
  Eye, Ticket, FacebookLogo, Megaphone, Checks, SpeakerHigh, PushPin, Lightbulb, QrCode, Truck, CalendarDots, PencilSimple, ChatCircleText, Hash, Gear, Newspaper,
} from "@phosphor-icons/react";
import type { Como } from "@/components/como/ComoFunciona";
import type { PassoTour } from "@/components/como/tour";

/** (22/10) o (i) do topo das telas no formato da Dora: exemplo com números, o caminho e dicas curtas */

const RESUMO_INICIO = "O resumo do seu dia: o que precisa da sua atenção, as próximas entregas e atalhos para o restante do app.";

/** Início no celular: o (?) do "Olá" */
export const COMO_INICIO_CEL: Como = {
  tela: { nome: "Início", Icone: House }, resumo: RESUMO_INICIO, checks: true,
  dicas: [
    [Bell, <><b>Avisos:</b> pedidos atrasados e pedidos para aceitar aparecem primeiro.</>],
    [MagnifyingGlass, <><b>Buscar:</b> encontre qualquer tela ou ação, como pix, cupom ou horário.</>],
    [ListChecks, <><b>Acesso rápido:</b> as telas mais usadas, a um toque.</>],
    [CalendarBlank, <><b>Próximas entregas:</b> toque em um dia para ver apenas os pedidos dele.</>],
    [ListChecks, <><b>Pra fazer:</b> pendências da loja, com o botão para resolver na hora.</>],
  ],
};

/** Início no computador: o (i) do topo */
export const COMO_INICIO: Como = {
  tela: { nome: "Início", Icone: House }, resumo: RESUMO_INICIO, checks: true,
  dicas: [
    [ChartLineUp, <><b>Números do topo:</b> recebido no mês, pedidos dos últimos 7 dias, entregas de hoje e ticket médio.</>],
    [CalendarBlank, <><b>Próximas entregas:</b> pedidos dos próximos dias, com horário e valor.</>],
    [ListChecks, <><b>Pra fazer:</b> pendências da loja, com o botão para resolver na hora.</>],
    [MagnifyingGlass, <><b>Buscar</b> (Ctrl + K): encontre qualquer tela ou ação, como pix, cupom ou horário.</>],
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
  resumo: "Todos os pedidos da loja, do momento em que chegam até a entrega.",
  tit: "Exemplo · pedido do cardápio",
  linhas: [["Bolo brigadeiro 1 kg", "R$ 47,61"], ["Sinal pago no Pix", "R$ 23,81"]],
  total: ["Falta receber", "R$ 23,80"],
  fluxo: ["Aceitar", "Agendado", "Pronto", "Entregue"],
  dicas: [
    [Bell, <>Pedidos novos do cardápio chegam em <b>Pra aceitar</b>. Ao aceitar, eles vão para a agenda.</>],
    [ArrowRight, <>O botão de cada pedido avança para a <b>próxima etapa</b>: Produzir, Pronto e Entregue.</>],
    [HandCoins, <>O valor que <b>falta receber</b> fica em destaque até você registrar o pagamento.</>],
    [Funnel, <>Use o <b>filtro</b> para escolher a situação e a data da entrega.</>],
  ],
};

export const COMO_AGENDA: Como = {
  tela: { nome: "Agenda", Icone: CalendarBlank },
  resumo: "Seus pedidos organizados pela data de entrega, para planejar a produção.",
  tit: "Exemplo · sexta-feira",
  linhas: [["Bolo de aniversário · 14:00", "R$ 120,00"], ["Kit festa · 16:30", "R$ 650,00"]],
  total: ["Total do dia", "R$ 770,00"],
  fluxo: ["Pedido aceito", "Na agenda", "Entrega"],
  dicas: [
    [CalendarBlank, <>Cada dia mostra os pedidos com entrega marcada. Selecione um dia para ver a lista.</>],
    [Circle, <><b>Cores:</b> vermelho para atrasado, laranja para aceitar, azul na agenda e verde para concluído.</>],
    [WarningCircle, <><b>Precisa de atenção</b> reúne os pedidos atrasados e os que aguardam aceite.</>],
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
  { el: ".ag3-lista", titulo: "Pedidos do dia", texto: "Selecione um pedido para ver os detalhes. Marcar como pronto e chamar o cliente no WhatsApp ficam no próprio cartão.",
    vazio: { el: ".ag3-lado > .ui-vazia", texto: "Não há pedidos para mostrar neste dia. Selecione outro dia no calendário para ver os pedidos dele." } },
];

export const COMO_FINANCEIRO: Como = {
  tela: { nome: "Financeiro", Icone: CurrencyDollar },
  resumo: "O dinheiro que entrou e saiu da loja, o saldo do caixa e o que ainda vai entrar e sair.",
  tit: "Exemplo · um dia de vendas",
  linhas: [["Entrou (pedidos pagos)", "R$ 300,00"], ["Saiu (contas e compras)", "R$ 80,00"]],
  total: ["Sobrou no dia", "R$ 220,00"],
  fluxo: ["Cliente paga", "Entra no caixa", "Sobrou"],
  dicas: [
    [ArrowUp, <><b>Entrou:</b> pagamentos de pedidos e outras entradas.</>],
    [ArrowDown, <><b>Saiu:</b> contas pagas e compras.</>],
    [HandCoins, <><b>A receber</b> e <b>A pagar</b> mostram o que ainda vai entrar e sair.</>],
    [Coins, <>Informe o <b>saldo do caixa</b> uma vez. Depois, ele é atualizado a cada lançamento.</>],
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
  { el: ".far-resumo", titulo: "Resumo", texto: "Total pendente, separado em atrasados, próximos 7 dias e depois.",
    vazio: { el: ".far-vazio", titulo: "Nada a receber", texto: "Não há valores a receber no momento. Quando um pedido tiver sinal ou ficar para pagar depois, o valor que falta aparece aqui." } },
  { el: ".far-grupo", titulo: "Pedidos com saldo", texto: "Cada pedido mostra o valor total, o que já foi pago e o que falta. Os atrasados aparecem primeiro." },
  { el: ".far-rec", titulo: "Receber", texto: "Registre o pagamento quando o cliente pagar. É possível receber o valor total ou apenas uma parte." },
  { el: ".far-ver", titulo: "Abrir pedido", texto: "Abre o pedido completo, com os itens, a entrega e o histórico de pagamentos." },
];

export const COMO_CARDAPIO: Como = {
  tela: { nome: "Cardápio digital", Icone: ShoppingBag },
  resumo: "Sua loja online: o link para os clientes pedirem e o desempenho do cardápio.",
  tit: "Exemplo · últimos 7 dias",
  linhas: [["Visitas no cardápio", "200"], ["Pedidos pelo cardápio", "14"]],
  total: ["Conversão", "7%"],
  fluxo: ["Seu link", "Cliente pede", "Pedidos"],
  dicas: [
    [ShareNetwork, <>Envie o <b>link</b> pelo WhatsApp e pelo Instagram. O <b>QR Code</b> é para imprimir.</>],
    [PauseCircle, <><b>Pausar pedidos</b> fecha o cardápio na hora, sem alterar o horário.</>],
    [Palette, <><b>Aparência:</b> cores, logo e banners de promoção.</>],
    [Storefront, <><b>Dados da loja:</b> horário, entrega, Pix e endereço.</>],
  ],
};

/** (23/10) a mesma tela no celular, como "Minha loja": tudo da loja em um lugar só */
export const COMO_MINHA_LOJA: Como = {
  tela: { nome: "Minha loja", Icone: Storefront },
  resumo: "Tudo da sua loja em uma tela: o link, o que o cliente vê, como você vende e o que você vende.",
  tit: "Exemplo · últimos 7 dias",
  linhas: [["Visitas no cardápio", "200"], ["Pedidos pelo cardápio", "14"]],
  total: ["Conversão", "7%"],
  fluxo: ["Seu link", "Cliente pede", "Pedidos"],
  dicas: [
    [ShareNetwork, <>Envie o <b>link</b> pelo WhatsApp e pelo Instagram. O <b>QR Code</b> é para imprimir.</>],
    [PauseCircle, <><b>Pausar pedidos</b> fecha o cardápio na hora, sem alterar o horário.</>],
    [Palette, <>Cada linha mostra como está agora. Toque para alterar; o que falta aparece em <b>Falta</b>.</>],
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
  { el: ".cl9-chips", titulo: "Filtros", texto: "Filtre a lista por aniversário, novos cadastros ou clientes sem comprar há 60 dias. Cada filtro aparece quando há clientes nele." },
  { el: ".cl9-lista, .cl9-tab", titulo: "Lista de clientes", texto: "Selecione um cliente para ver o histórico de pedidos e o total gasto. O ícone do WhatsApp abre a conversa.",
    vazio: [
      { el: ".cl9-semres", texto: "Nenhum cliente com esta busca ou filtro. Confira o que foi digitado ou volte para Todos." },
      { el: ".cli-root .ui-vazia", texto: "Ainda não há clientes. Quem pede pelo cardápio é cadastrado automaticamente, e os demais você cadastra manualmente." },
    ] },
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
  { el: ".prod-card", titulo: "Produto", texto: "Selecione um produto para editar as informações, as fotos e as opções.",
    vazio: [
      { el: ".prod-root .ui-vazia", texto: "Nenhum produto com esta busca. Confira o nome digitado." },
      { el: ".prod-hero-left", texto: "Ainda não há produtos. Cadastre o primeiro em Novo produto para ele aparecer na lista e no cardápio." },
    ] },
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
  { el: ".fl-l", titulo: "Produto", texto: "Mostra o custo, o lucro e a margem de cada produto. Selecione para montar ou ajustar a ficha técnica.",
    vazio: [
      { el: ".cl9.fl .cl9-semres", texto: "Nenhum produto com esta busca ou filtro. Confira o nome digitado ou volte para Todos." },
      { el: ".cl9.fl .ui-vazia", texto: "Ainda não há produtos. Os produtos cadastrados aparecem nesta lista para você montar a ficha técnica." },
    ] },
];

export const COMO_LUCRATIVIDADE: Como = {
  tela: { nome: "Lucratividade", Icone: ChartLineUp },
  resumo: "Onde está o seu lucro de verdade: o que você vendeu menos todos os custos do período.",
  tit: "Exemplo · um mês",
  linhas: [["Vendido", "R$ 5.000,00"], ["Ingredientes, taxas e despesas", "R$ 3.200,00"]],
  total: ["Lucro do mês", "R$ 1.800,00"],
  fluxo: ["Vendido", "Custos", "Lucro"],
  dicas: [
    [ShoppingBagOpen, <><b>Vendido</b> considera os pedidos entregues no período escolhido.</>],
    [CreditCard, <>A <b>taxa da maquininha</b> entra só nos pedidos pagos no cartão. Pix e dinheiro não têm taxa.</>],
    [ListChecks, <>Produtos sem <b>ficha técnica</b> deixam o lucro maior do que é, porque o custo dos ingredientes não entra.</>],
    [Scales, <>O <b>ponto de equilíbrio</b> mostra quanto vender no mês para pagar os custos fixos e o seu salário.</>],
  ],
};

export const TOUR_LUCRATIVIDADE: PassoTour[] = [
  { el: ".lu-per", titulo: "Período", texto: "Escolha o período: hoje, últimos 7 ou 30 dias, um mês ou outro intervalo." },
  { el: ".lu-conta", titulo: "A conta do período", texto: "O valor vendido menos o custo dos ingredientes, as taxas e embalagens e as despesas pagas.",
    vazio: { el: ".lu-vazio", titulo: "Sem pedidos entregues", texto: "Ainda não há pedidos entregues neste período. A conta aparece assim que você marcar pedidos como entregues." } },
  { el: ".lu-k--lucro", titulo: "Lucro", texto: "O que sobrou de fato no período, com a margem sobre o valor vendido." },
  { el: ".lu-aviso", titulo: "Sem ficha técnica", texto: "Produtos vendidos sem ficha técnica. Sem ela, o custo dos ingredientes não entra na conta e o lucro aparece maior do que é." },
  { el: ".lu-pc", titulo: "Lucro por produto", texto: "Cada produto vendido no período, com a quantidade, o valor vendido e o lucro pela ficha técnica." },
  { el: ".lu-a-eq", titulo: "Ponto de equilíbrio", texto: "Quanto você precisa vender no mês para pagar os custos fixos e o seu salário. Aparece quando um mês está escolhido." },
];

/* ══════ (23/10) Tours de Pedidos, Financeiro e Cardápio digital ══════ */

export const TOUR_PEDIDOS: PassoTour[] = [
  { el: ".pd-abas", titulo: "Tipo de venda", texto: "Alterne entre encomendas e pronta entrega." },
  { el: ".pd-busca", titulo: "Buscar", texto: "Encontre um pedido pelo nome do cliente ou pelo número." },
  { el: ".pd-filtro", titulo: "Filtros", texto: "Filtre os pedidos por situação e por data de entrega." },
  { el: ".pdk-abas", titulo: "Situações", texto: "Pra aceitar, Agendados, Prontos e Concluídos. O número mostra quantos pedidos há em cada uma." },
  { el: ".pd-modo", titulo: "Lista ou quadro", texto: "Veja os pedidos em lista ou em quadro, com uma coluna para cada situação." },
  { el: ".pd-novo", titulo: "Nova venda", texto: "Registre uma venda ou encomenda feita pelo WhatsApp ou no balcão." },
  { el: ".pd-grupo", titulo: "Pedidos", texto: "Agrupados pelo dia da entrega, com os atrasados no topo. O botão de cada pedido avança para a próxima etapa.",
    vazio: { el: ".pd .ui-vazia", texto: "Não há pedidos para mostrar aqui. Quando houver, eles aparecem agrupados pelo dia da entrega." } },
];

export const TOUR_FINANCEIRO: PassoTour[] = [
  { el: ".fd-hd, .fdp-barra", titulo: "Lançamentos", texto: "Registre uma entrada ou uma saída de dinheiro, ou receba o pagamento de um pedido." },
  { el: ".fd-hero .pf", titulo: "Período", texto: "Escolha o período: hoje, últimos 7 ou 30 dias, um mês ou outro intervalo." },
  { el: ".fd-res", titulo: "Sobrou", texto: "O que entrou menos o que saiu no período. Aportes e retiradas ficam de fora, porque são dinheiro seu, não do negócio." },
  { el: ".fd-tres > .fd-t.esc", titulo: "Saldo em caixa", texto: "Informe uma vez quanto há no caixa. Depois, o saldo é atualizado a cada entrada e saída." },
  { el: ".fd-tres > .fd-t:nth-child(2)", titulo: "A receber", texto: "Total pendente dos pedidos. Selecione para ver a lista e registrar os pagamentos." },
  { el: ".fd-tres > .fd-t:nth-child(3)", titulo: "A pagar", texto: "Contas a pagar, com as vencidas em destaque. Selecione para ver a lista." },
  { el: ".fd-listas", titulo: "Próximos valores", texto: "Os próximos valores a receber e a pagar, com o botão para resolver na hora." },
  { el: ".fd-mais", titulo: "Mais", texto: "Atalhos para Transações, Custos e Lucratividade." },
];

export const TOUR_CARDAPIO: PassoTour[] = [
  { el: ".clc", titulo: "Situação da loja", texto: "Mostra se a loja está aberta. A chave pausa ou retoma os pedidos na hora, sem alterar o horário." },
  { el: ".clc-bts", titulo: "Divulgar", texto: "Compartilhe o link, copie, veja o cardápio como cliente ou baixe o QR Code para imprimir." },
  { el: ".vgd-hero", titulo: "Seu cardápio", texto: "A situação da loja, o link do cardápio e os botões para enviar pelo WhatsApp, copiar o link ou ver como cliente." },
  { el: ".vgd-qr", titulo: "QR Code", texto: "Baixe e imprima para os clientes abrirem o cardápio pelo celular." },
  { el: ".ml-cliente", titulo: "A loja para o cliente", texto: "Logo, nome e WhatsApp, aparência e redes sociais: o que o cliente vê no cardápio. Cada linha mostra como está agora." },
  { el: ".ml-vende", titulo: "Como você vende", texto: "Horário, entrega, pagamento, Pix e endereço. O que ainda falta configurar aparece marcado como Falta." },
  { el: ".ml-produtos", titulo: "O que você vende", texto: "Produtos, categorias e complementos que aparecem no cardápio." },
  { el: ".ch-metricas-grid, .vgd-kp", titulo: "Desempenho", texto: "Visitas, pedidos, valor vendido e conversão do cardápio no período escolhido." },
  { el: ".vgd-gr", titulo: "Visitas por dia", texto: "Quantas pessoas abriram o cardápio em cada dia do período." },
  { el: ".ch-block--vendidos", titulo: "Mais vendidos", texto: "Os produtos mais pedidos pelo cardápio no período." },
  { el: ".vgd-g2", titulo: "Últimos pedidos", texto: "Os pedidos mais recentes que chegaram pelo link do cardápio." },
];

/* ══════ (23/10) Demais telas: Cadastros, Categorias, Complementos, Ingredientes, Transações, A pagar, Custos,
   Aparência, Marketing, Notificações, Novidades, Dados da loja, Nova venda, Configurações e Mensagens ══════ */

export const COMO_CADASTROS: Como = {
  tela: { nome: "Cadastros", Icone: SquaresFour },
  resumo: "Tudo o que forma a sua loja: produtos, ingredientes, clientes e os dados do cardápio.",
  fluxo: ["Ingredientes", "Produtos", "Cardápio"],
  dicas: [
    [Basket, <>Comece pelos <b>ingredientes</b>: com eles, a ficha técnica calcula o custo de cada produto.</>],
    [Cake, <>Os <b>produtos</b> ativos aparecem no cardápio, organizados por categorias.</>],
    [WarningCircle, <><b>Precisa de atenção</b> mostra o que ainda falta completar, como fichas técnicas.</>],
    [Hash, <>O número ao lado de cada item mostra quantos cadastros existem.</>],
  ],
};
export const TOUR_CADASTROS: PassoTour[] = [
  { el: ".cad-at", titulo: "Precisa de atenção", texto: "Pendências dos cadastros, como produtos sem ficha técnica. Selecione para resolver." },
  { el: ".cad-c--vende", titulo: "O que você vende", texto: "Produtos, categorias, complementos e a sua loja (o cardápio digital)." },
  { el: ".cad-c--feito", titulo: "Do que é feito", texto: "Ingredientes e fichas técnicas, que calculam o custo e o lucro de cada produto." },
  { el: ".cad-c--compra", titulo: "Quem compra", texto: "Seus clientes e as mensagens prontas do WhatsApp." },
];

export const COMO_CATEGORIAS: Como = {
  tela: { nome: "Categorias", Icone: SquaresFour },
  resumo: "Grupos que organizam os produtos no cardápio, como Bolos, Doces e Salgados.",
  fluxo: ["Categoria", "Produtos", "Cardápio"],
  dicas: [
    [SquaresFour, <>O cardápio mostra as categorias na <b>ordem desta lista</b>.</>],
    [ArrowsDownUp, <>No menu de cada categoria, você pode <b>subir ou descer</b> na ordem, editar ou excluir.</>],
    [Cake, <>A categoria de cada produto é escolhida no <b>cadastro do produto</b>.</>],
    [Info, <>Produtos <b>sem categoria</b> aparecem apenas em Todos, no cardápio.</>],
  ],
};
export const TOUR_CATEGORIAS: PassoTour[] = [
  { el: ".ct .ui-tit-acao", titulo: "Nova categoria", texto: "Crie categorias como Bolos, Doces e Salgados para organizar o cardápio.",
    vazio: { el: ".ct .ui-vazia", titulo: "Categorias", texto: "Ainda não há categorias. Use Criar categoria para cadastrar a primeira." } },
  { el: ".ct-row-b", titulo: "Categoria", texto: "Mostra quantos produtos a categoria tem. Selecione para editar o nome e a foto." },
  { el: ".ct-row .ui-bti", titulo: "Opções", texto: "Suba ou desça a categoria na ordem do cardápio, edite ou exclua." },
  { el: ".ct-dica", titulo: "Produtos sem categoria", texto: "Eles aparecem apenas em Todos, no cardápio. Escolha uma categoria no cadastro do produto." },
];

export const COMO_COMPLEMENTOS: Como = {
  tela: { nome: "Complementos", Icone: PuzzlePiece },
  resumo: "Opções extras que o cliente escolhe ao pedir, como topo de bolo, escrita e papel de arroz.",
  tit: "Exemplo · bolo com extra",
  linhas: [["Bolo de chocolate", "R$ 120,00"], ["Topo de bolo", "+ R$ 15,00"]],
  total: ["Total do pedido", "R$ 135,00"],
  fluxo: ["Cadastrar", "Escolher produtos", "No pedido"],
  dicas: [
    [PuzzlePiece, <>Cadastre uma vez e escolha em <b>quais produtos</b> o complemento aparece.</>],
    [Coins, <>Pode ser <b>cobrado</b> ou <b>grátis</b>. O valor é somado ao total do pedido.</>],
    [Camera, <>Marque <b>Pedir foto de referência</b> para o cliente anexar uma imagem, como no topo de bolo.</>],
    [ArrowsClockwise, <>Ao alterar o preço aqui, ele muda em <b>todos os produtos</b>.</>],
  ],
};
export const TOUR_COMPLEMENTOS: PassoTour[] = [
  { el: ".ct .ui-tit-acao", titulo: "Novo complemento", texto: "Cadastre um extra com nome, preço e os produtos em que ele aparece.",
    vazio: { el: ".ct .ui-vazia", titulo: "Complementos", texto: "Ainda não há complementos. Siga a orientação deste aviso para cadastrar o primeiro." } },
  { el: ".pz-busca", titulo: "Buscar", texto: "Encontre um complemento pelo nome." },
  { el: ".ct-row-b", titulo: "Complemento", texto: "Mostra em quais produtos aparece e o valor. Selecione para editar." },
  { el: ".ct-row .ui-bti", titulo: "Opções", texto: "Edite, escolha os produtos em que aparece ou exclua." },
  { el: ".pz-sg", titulo: "Sugestões", texto: "Selecione uma sugestão para abrir o cadastro já preenchido." },
];

export const COMO_INGREDIENTES: Como = {
  tela: { nome: "Ingredientes", Icone: Basket },
  resumo: "Tudo o que você compra para produzir, com o preço pago. A ficha técnica usa esses valores para calcular o custo.",
  tit: "Exemplo · leite condensado",
  linhas: [["Embalagem de 395 g", "R$ 7,90"], ["Custo por grama", "R$ 0,02"]],
  total: ["100 g na receita", "R$ 2,00"],
  fluxo: ["Compra", "Custo por grama", "Ficha técnica"],
  dicas: [
    [Basket, <>Informe <b>quanto vem</b> na embalagem e <b>quanto pagou</b>. O custo por grama é calculado automaticamente.</>],
    [ArrowsClockwise, <>Quando o preço mudar, atualize aqui: o custo das <b>fichas técnicas</b> acompanha.</>],
    [Tag, <>Organize por <b>categoria</b>: ingredientes, embalagens, decorações, descartáveis e outros.</>],
    [MagnifyingGlass, <>Busque pelo <b>nome</b> ou pela <b>marca</b>.</>],
  ],
};
export const TOUR_INGREDIENTES: PassoTour[] = [
  { el: ".cl9-busca", titulo: "Buscar", texto: "Encontre um ingrediente pelo nome ou pela marca.",
    vazio: { el: ".cl9 > .ui-vazia", titulo: "Ingredientes", texto: "Ainda não há ingredientes. Use Cadastrar ingrediente para adicionar o primeiro." } },
  { el: ".cl9-acoes", titulo: "Novo ingrediente", texto: "Cadastre um item com a quantidade da embalagem e o preço pago." },
  { el: ".cl9-chips", titulo: "Categorias", texto: "Filtre a lista por categoria, como ingredientes, embalagens e decorações." },
  { el: ".ig-l", titulo: "Ingrediente", texto: "Mostra o preço da compra e o custo na receita. Selecione para editar ou atualizar o preço.",
    vazio: { el: ".cl9-card .cl9-semres", texto: "Nenhum ingrediente com este filtro. Confira a busca ou escolha outra categoria." } },
];

export const COMO_TRANSACOES: Como = {
  tela: { nome: "Transações", Icone: ArrowsDownUp },
  resumo: "O extrato de todo o dinheiro que entrou e saiu, dia a dia.",
  tit: "Exemplo · uma semana",
  linhas: [["Entradas", "R$ 1.200,00"], ["Saídas", "R$ 450,00"]],
  total: ["Diferença", "R$ 750,00"],
  fluxo: ["Lançamento", "Extrato", "Planilha"],
  dicas: [
    [ArrowUp, <>Os recebimentos de pedidos entram na <b>data em que foram recebidos</b>.</>],
    [ArrowCounterClockwise, <>Lançou errado? Abra o item e use <b>Estornar</b>. Ele sai das contas, mas continua no histórico.</>],
    [Info, <>Aqui também entram <b>aportes e retiradas</b>, por isso a diferença pode não bater com o Sobrou do Financeiro.</>],
    [DownloadSimple, <><b>Exportar</b> gera uma planilha com as transações da lista, já com os filtros.</>],
  ],
};
export const TOUR_TRANSACOES: PassoTour[] = [
  { el: ".tx-hd, .tx-bts", titulo: "Lançamentos", texto: "Registre uma entrada ou uma saída e exporte o extrato em planilha." },
  { el: ".tx-per", titulo: "Período", texto: "Escolha o período: hoje, últimos 7 ou 30 dias, um mês ou outro intervalo." },
  { el: ".tx-res", titulo: "Totais", texto: "Entradas, saídas e a diferença do período." },
  { el: ".tx-seg", titulo: "Tipo", texto: "Veja todas as transações, apenas as entradas ou apenas as saídas." },
  { el: ".tx-busca", titulo: "Buscar", texto: "Encontre uma transação pelo cliente, pelo pedido ou pela despesa." },
  { el: ".tx-chips", titulo: "Forma de pagamento", texto: "Filtre as entradas por Pix, dinheiro, crédito ou débito." },
  { el: ".tx-dia", titulo: "Extrato", texto: "As transações agrupadas por dia. Selecione uma para ver os detalhes ou estornar.",
    vazio: { el: ".tx-vazio", texto: "Não há transações neste período. Recebimentos, entradas e saídas aparecem aqui." } },
];

export const COMO_A_PAGAR: Como = {
  tela: { nome: "A pagar", Icone: CalendarCheck },
  resumo: "Contas que você ainda vai pagar, com o vencimento. Elas só saem do caixa quando você registra o pagamento.",
  tit: "Exemplo · contas do mês",
  linhas: [["Aluguel · vence dia 10", "R$ 1.200,00"], ["Fornecedor · vence dia 15", "R$ 350,00"]],
  total: ["Total a pagar", "R$ 1.550,00"],
  fluxo: ["Nova conta", "Vencimento", "Pagar"],
  dicas: [
    [CalendarCheck, <>As contas ficam aqui até você usar <b>Pagar</b>. Só então o valor sai do caixa.</>],
    [Buildings, <><b>Custos fixos</b> com dia de vencimento viram uma conta aqui todo mês, automaticamente.</>],
    [WarningCircle, <>Contas <b>vencidas</b> aparecem em destaque, no topo da lista.</>],
    [X, <>Use o <b>X</b> para cancelar uma conta lançada por engano.</>],
  ],
};
export const TOUR_A_PAGAR: PassoTour[] = [
  { el: ".fap-seg", titulo: "Período", texto: "Veja as contas atrasadas, as da semana, as do mês ou todas." },
  { el: ".fap-nova-bt", titulo: "Nova conta", texto: "Lance uma conta com descrição, valor e vencimento." },
  { el: ".fap-it", titulo: "Conta", texto: "Mostra o vencimento, a descrição e o valor de cada conta.",
    vazio: { el: ".fap-vazio", texto: "Não há contas a pagar neste período. Use Nova conta para lançar uma." } },
  { el: ".fap-bts", titulo: "Pagar ou cancelar", texto: "Pagar registra a saída no caixa. O X cancela a conta." },
];

export const COMO_CUSTOS: Como = {
  tela: { nome: "Custos", Icone: Coins },
  resumo: "Tudo o que a confeitaria gasta: custos fixos, variáveis, invisíveis e a sua mão de obra.",
  tit: "Exemplo · 8 h por dia, de segunda a sexta",
  linhas: [["Custos fixos do mês", "R$ 1.500,00"], ["Seu salário", "R$ 3.000,00"]],
  total: ["Custo da sua hora", "R$ 25,89"],
  fluxo: ["Seus custos", "Custo da hora", "Ficha técnica"],
  dicas: [
    [Buildings, <><b>Custos fixos</b> vêm todo mês, como aluguel e internet. Com o dia de vencimento, viram uma conta em A pagar.</>],
    [Clock, <><b>Mão de obra:</b> com o seu salário e a jornada, o app calcula o custo de cada hora sua.</>],
    [CreditCard, <><b>Custos variáveis</b> acompanham cada venda, como a taxa da maquininha e a embalagem.</>],
    [Flame, <><b>Custos invisíveis</b> são uma porcentagem sobre os ingredientes (gás, perdas e descartáveis), aplicada em todas as fichas.</>],
  ],
};
export const TOUR_CUSTOS: PassoTour[] = [
  { el: ".cu-resumo", titulo: "Resumo", texto: "Custos fixos do mês, seu salário, o custo da sua hora e os custos variáveis por pedido." },
  { el: ".cu-a-fixos", titulo: "Custos fixos", texto: "Aluguel, internet, luz e outros gastos mensais. Com o dia de vencimento, viram uma conta em A pagar." },
  { el: ".cu-a-mo", titulo: "Mão de obra", texto: "Seu salário e sua jornada. Com eles, o app calcula o valor da sua hora de trabalho." },
  { el: ".cu-a-var", titulo: "Custos variáveis", texto: "Custos que acompanham cada venda, como a taxa da maquininha e a embalagem por pedido." },
  { el: ".cu-a-cv", titulo: "Custos invisíveis", texto: "Uma porcentagem sobre os ingredientes para cobrir gás, perdas e descartáveis. Entra em todas as fichas técnicas." },
];

export const COMO_APARENCIA: Como = {
  tela: { nome: "Aparência", Icone: Palette },
  resumo: "Deixe o cardápio com a cara da sua confeitaria: tema, topo, banners, modelo e cores.",
  fluxo: ["Personalizar", "Salvo na hora", "No cardápio"],
  dicas: [
    [Sparkle, <><b>Tema:</b> enfeita o cardápio em datas especiais, como o Natal.</>],
    [Images, <><b>Banners</b> divulgam promoções no cardápio. Use imagens deitadas, de 1200 × 675.</>],
    [Palette, <><b>Modelo e cores</b> definem como o cliente vê a sua loja. Alguns recursos são do plano PRO.</>],
    [Eye, <>Tudo é salvo na hora. Use <b>Ver meu cardápio</b> para conferir como ficou.</>],
  ],
};
export const TOUR_APARENCIA: PassoTour[] = [
  { el: ".ap-sec-tema", titulo: "Tema do cardápio", texto: "Escolha o visual do cardápio. O tema de Natal enfeita a loja na época das festas." },
  { el: ".ap-sec-topo", titulo: "Topo do cardápio", texto: "A foto do topo e a logo, do jeito que o cliente vê." },
  { el: ".ap-sec-banners", titulo: "Banners de promoção", texto: "Imagens que divulgam promoções no cardápio. No plano PRO, até quatro banners em carrossel." },
  { el: ".ap-sec-modelo", titulo: "Modelo do cardápio", texto: "Escolha entre o modelo Clássico, gratuito, e o Premium, do plano PRO." },
  { el: ".ap-sec-cores", titulo: "Cores do topo", texto: "Defina as cores do topo do cardápio. Os números mostram onde cada cor é aplicada." },
];

export const COMO_MARKETING: Como = {
  tela: { nome: "Marketing", Icone: Megaphone },
  resumo: "Ferramentas para divulgar a confeitaria e vender mais.",
  tit: "Exemplo · cupom de 10%",
  linhas: [["Pedido", "R$ 100,00"], ["Cupom BEMVINDO10", "- R$ 10,00"]],
  total: ["Cliente paga", "R$ 90,00"],
  fluxo: ["Criar cupom", "Divulgar", "Cliente usa"],
  dicas: [
    [Ticket, <>Até <b>dois cupons</b> ficam ativos por vez e aparecem no topo do cardápio.</>],
    [Users, <>O cliente usa <b>um cupom por pedido</b>. Dá para limitar ao primeiro pedido.</>],
    [FacebookLogo, <>O <b>Pixel do Facebook</b> informa ao Facebook e ao Instagram quem visitou o cardápio e quem fez pedido.</>],
    [Megaphone, <>Com o Pixel, os <b>anúncios</b> chegam a quem tem mais chance de comprar.</>],
  ],
};
export const TOUR_MARKETING: PassoTour[] = [
  { el: ".mk-abas", titulo: "Ferramentas", texto: "Alterne entre os cupons de desconto e o Pixel do Facebook." },
  { el: ".ep-cupons", titulo: "Seus cupons", texto: "Cada cupom mostra o código, o desconto e se está ativo. Até dois ficam ativos por vez. Selecione um cupom para editar.",
    vazio: { el: ".mk-cupons .ep-vazio, .mk-cupons .ep-pro", texto: "Ainda não há cupons para mostrar. Siga a orientação deste aviso para criar o primeiro." } },
  { el: ".ep-cupons-pe", titulo: "Novo cupom", texto: "Crie um cupom e use Salvar cupons para aplicar as alterações." },
  { el: ".mk-card", titulo: "Pixel do Facebook", texto: "Informe o código do Pixel para os anúncios do Facebook e do Instagram chegarem a quem visitou o cardápio." },
];

export const COMO_NOVIDADES: Como = {
  tela: { nome: "Novidades", Icone: Newspaper },
  resumo: "Dicas para vender mais, novidades do app, tutoriais e avisos importantes do Doonly.",
  fluxo: ["Publicada", "Aviso no celular", "Leitura"],
  dicas: [
    [Bell, <>Cada novidade nova chega como <b>aviso no celular</b>. O toque abre o texto completo.</>],
    [Circle, <>As <b>não lidas</b> ficam em branco. Depois de abertas, ficam em cinza.</>],
    [PushPin, <>A novidade <b>fixada</b> fica sempre no topo.</>],
    [Lightbulb, <>Tem uma ideia? Use <b>Sugerir uma melhoria</b>, no Menu.</>],
  ],
};
export const TOUR_NOVIDADES: PassoTour[] = [
  { el: ".nl-lista > li:first-child", titulo: "Novidade", texto: "Imagem, título, resumo e quando foi publicada. Toque para ler o texto completo." },
  { el: ".nl-it--lida", titulo: "Já lida", texto: "Depois de aberta, a novidade fica em cinza. As não lidas ficam em branco." },
  { el: ".cab-cel-ac:not(.cab-cel-ac--pro), .sidebar-sino", titulo: "Sino", texto: "O número no sino mostra quantas novidades você ainda não leu." },
];

export const COMO_DADOS_LOJA: Como = {
  tela: { nome: "Dados da loja", Icone: Storefront },
  resumo: "As informações que o cliente vê no cardápio: loja, endereço, horário, pagamento e entrega. Tudo é salvo automaticamente.",
  fluxo: ["Preencher", "Salvo na hora", "No cardápio"],
  dicas: [
    [CheckCircle, <>O <b>visto verde</b> indica a parte pronta. <b>Falta</b> mostra o que ainda precisa ser preenchido.</>],
    [Clock, <>O <b>horário</b> define quando o cardápio aceita pedidos.</>],
    [QrCode, <>Com o <b>Pix pelo cardápio</b>, o cliente paga o sinal ou o total ao fazer o pedido.</>],
    [Truck, <>Em <b>Entrega</b>, escolha retirada, entrega própria e a taxa.</>],
  ],
};
export const TOUR_DADOS_LOJA: PassoTour[] = [
  { el: ".dl-lista-c", titulo: "Partes", texto: "Cada parte mostra o que já foi preenchido. O visto verde indica a parte pronta." },
  { el: ".dl-li-st.falta", titulo: "O que falta", texto: "Complete esta parte para o cardápio funcionar por completo." },
  { el: ".dl-painel", titulo: "Edição", texto: "A parte selecionada abre aqui. As alterações são salvas automaticamente." },
  { el: ".dl-lista-salva", titulo: "Salvamento automático", texto: "Tudo é salvo sozinho, sem precisar de um botão de salvar." },
];

export const COMO_NOVA_VENDA: Como = {
  tela: { nome: "Nova venda", Icone: ClipboardText },
  resumo: "Registre uma venda ou encomenda feita pelo WhatsApp ou no balcão, em cinco etapas.",
  tit: "Exemplo · encomenda de aniversário",
  linhas: [["Bolo de chocolate 2 kg", "R$ 180,00"], ["Taxa de entrega", "R$ 15,00"]],
  total: ["Total da venda", "R$ 195,00"],
  fluxo: ["Venda", "Cliente", "Entrega", "Pagamento"],
  dicas: [
    [CalendarDots, <><b>Encomenda</b> é para entregar ou retirar em outro dia. <b>Pronta entrega</b> é para o que já está pronto.</>],
    [Users, <>Escolha um <b>cliente</b> cadastrado ou registre como venda avulsa, sem cliente.</>],
    [HandCoins, <>No <b>pagamento</b>, informe se o cliente pagou o total, um sinal, se vai pagar depois ou na entrega.</>],
    [ClipboardText, <>Ao registrar, a venda aparece em <b>Pedidos</b> e, se houver valor pendente, em A receber.</>],
  ],
};
export const TOUR_NOVA_VENDA: PassoTour[] = [
  { el: ".nv3-passos", titulo: "Etapas", texto: "A venda é registrada em cinco etapas: venda, cliente, entrega, pagamento e revisão." },
  { el: ".nv3-tipos", titulo: "Tipo de venda", texto: "Encomenda é para entregar ou retirar em outro dia. Pronta entrega é para o que já está pronto." },
  { el: ".nv3-card--produtos", titulo: "Produtos", texto: "Adicione os produtos que o cliente pediu, com quantidade e opções." },
  { el: ".nv3-lado", titulo: "Resumo da venda", texto: "Os itens, o total e o que ainda falta preencher, sempre à vista." },
  { el: ".nv3-pe", titulo: "Total e avanço", texto: "O total fica sempre à vista. Use Continuar para seguir para a próxima etapa." },
];

export const COMO_CONFIGURACOES: Como = {
  tela: { nome: "Configurações", Icone: Gear },
  resumo: "Sua conta, o plano, os avisos do app e a ajuda.",
  dicas: [
    [MagnifyingGlass, <>Use a <b>busca</b> para encontrar um ajuste pelo nome, como senha, pix ou horário.</>],
    [Bell, <><b>Notificações e sons</b> definem como o app avisa sobre pedidos novos.</>],
    [DownloadSimple, <><b>Instalar o app</b> adiciona o Doonly à tela inicial do celular ou do computador.</>],
    [ChatCircleText, <><b>Fale com o suporte</b> pelo WhatsApp quando precisar de ajuda.</>],
  ],
};
export const TOUR_CONFIGURACOES: PassoTour[] = [
  { el: ".cf9-busca", titulo: "Buscar", texto: "Encontre um ajuste pelo nome, como senha, pix, horário ou custos." },
  { el: ".cf9-item", titulo: "Ajustes", texto: "Os ajustes ficam organizados em Conta, App e Ajuda. Selecione um item para abrir." },
  { el: ".cf9 > .ui-bt--secundario", titulo: "Sair da conta", texto: "Encerra a sessão neste aparelho." },
];

export const COMO_MENSAGENS: Como = {
  tela: { nome: "Mensagens do WhatsApp", Icone: ChatCircleText },
  resumo: "Os textos que o app escreve por você ao abrir o WhatsApp.",
  dicas: [
    [ChatCircleText, <>O app abre o WhatsApp com a <b>mensagem pronta</b>. Você só confere e envia.</>],
    [PencilSimple, <>Troque o texto do seu jeito e use <b>Colocar informação</b> para incluir nome, pedido e valores automaticamente.</>],
    [Eye, <>A prévia mostra <b>como a mensagem fica</b> no WhatsApp.</>],
    [ArrowCounterClockwise, <><b>Voltar ao padrão</b> restaura o texto original a qualquer momento.</>],
  ],
};
export const TOUR_MENSAGENS: PassoTour[] = [
  { el: ".mz-intro", titulo: "Como funciona", texto: "O app abre o WhatsApp com a mensagem pronta. Aqui você personaliza cada texto." },
  { el: ".mz-item", titulo: "Mensagem", texto: "Mostra quando o texto é usado e se está no padrão ou personalizado. Selecione para editar." },
];

import {
  ArrowDown, ArrowUp, Bell, CalendarBlank, ChartLineUp, Coins, Funnel, HandCoins, ListChecks, MagnifyingGlass, Palette,
  PauseCircle, ShareNetwork, Storefront, WarningCircle, ArrowRight, Circle,
} from "@phosphor-icons/react";
import type { Como } from "@/components/como/ComoFunciona";

/** (22/10) o (i) do topo das telas no formato da Dora: exemplo com números, o caminho e dicas curtas */

export const COMO_INICIO: Como = {
  tit: "O que tem aqui",
  dicas: [
    [ChartLineUp, <><b>Números do topo:</b> o que entrou no mês, os pedidos da semana e quanto vale cada pedido.</>],
    [CalendarBlank, <><b>Próximas entregas:</b> os pedidos dos próximos dias, com a hora e o valor.</>],
    [ListChecks, <><b>Pra fazer:</b> o que precisa da sua atenção, com o botão pra resolver.</>],
    [MagnifyingGlass, <><b>Buscar</b> (Ctrl K): acha qualquer tela ou ação, como pix, cupom ou horário.</>],
  ],
};

export const COMO_PEDIDOS: Como = {
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

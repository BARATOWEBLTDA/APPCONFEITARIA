import {
  AddressBook, ChartLineUp, ChatCircleText, Crown, Eye, FilePdf, FileText, ImageSquare, Infinity as Infinito, Palette,
  Robot, SealCheck, Stack, Tag, type Icon,
} from "@phosphor-icons/react";

/** (31/10 · 5.84) A lista do PRO saiu da página Assinar: a Minha assinatura conta os recursos por ela
 *  ("Ver os N recursos"), sem número escrito à mão. Orçamentos, Complementos e Mensagens/Pixel entraram. */
/** Benefício: ícone, título longo (venda), explicação longa, título curto, linha curta e pra onde leva (quem já é PRO).
 *  (21/10) quem já é PRO vê a lista compacta (título curto + uma linha); com tela própria ganha a seta, sem ela o visto verde. */
export type Beneficio = [Icon, string, string, string, string, string | null];
export const BENEFICIOS: Beneficio[] = [
  [ChartLineUp, "Saiba quanto você lucra de verdade", "Relatórios de lucratividade por produto e por mês, para decidir com segurança.", "Lucro de verdade", "Lucratividade de cada produto", "/lucratividade"],
  [Robot, "A Doo IA sem aperto", "No PRO a Doo IA responde até 150 mensagens por dia e cria imagens. No grátis são 10 mensagens por mês.", "Doo IA 150 por dia", "E cria imagens", "doo"],
  [Eye, "Veja quem visita e quem compra", "Visitas, pedidos pelo cardápio e conversão, de hoje e do mês.", "Quem visita e compra", "Visitas e pedidos do cardápio", "/cardapio"],
  [FileText, "Orçamentos que o cliente aprova", "Monte a proposta, mande o link e o cliente aprova pelo celular. Aprovou, vira pedido.", "Orçamentos", "Proposta com link para aprovar", "/orcamentos"],
  [Stack, "Complementos no cardápio", "Topo de bolo, velas e outros extras que o cliente marca no produto, com foto ou frase.", "Complementos", "Extras que o cliente marca", "/complementos"],
  [Tag, "Cupons sem limite", "No grátis, 1 cupom ativo. No PRO, quantos quiser, e os 2 mais novos aparecem no topo do cardápio.", "Cupons sem limite", "E os 2 mais novos no topo", "/marketing"],
  [ChatCircleText, "Mensagens do seu jeito", "Troque os textos prontos do WhatsApp e anuncie com o Pixel do Facebook.", "Mensagens e Pixel", "Textos do seu jeito e anúncios", "/configuracoes/mensagens"],
  [Palette, "Cardápio com a cara da sua marca", "Qualquer cor no topo da loja, até 4 fotos por produto e um link com o nome da sua loja.", "Cardápio com a sua marca", "Qualquer cor e até 4 fotos", "/cardapio-design"],
  [ImageSquare, "Banners que vendem", "Até 4 banners em carrossel para destacar promoções e lançamentos.", "Banners que vendem", "Até 4 em carrossel", "/cardapio-design"],
  [SealCheck, "Selo de loja verificada", "Mais confiança na hora em que o cliente decide comprar.", "Selo de loja verificada", "Mais confiança para o cliente", null],
  [Crown, "Sem marca d'água", "O cardápio só com a sua marca, sem o \"Feito com Doonly\".", "Sem marca d'água", "Só a sua marca no cardápio", null],
  [Infinito, "Todo o cardápio no ar", "No grátis, até 10 produtos no cardápio ao mesmo tempo. No PRO, todos.", "Produtos sem limite", "Todo o cardápio no ar", null],
  [AddressBook, "Importe clientes dos contatos", "Traga os contatos direto da agenda do celular (Android).", "Importar contatos", "Traga da agenda do celular", "/clientes"],
  [FilePdf, "Relatórios em PDF", "Agenda do dia, pedidos e fichas técnicas prontos para mandar ou imprimir.", "Relatórios em PDF", "Agenda, pedidos e fichas", null],
];

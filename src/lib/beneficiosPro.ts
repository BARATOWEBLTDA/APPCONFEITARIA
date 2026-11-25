import { noAppDaLoja } from "@/lib/plataforma";
import { lojaPagamentoPronto } from "@/lib/lojaPagamento";
import {
  AddressBook, Cake, ChartLineUp, ChatCircleText, Crown, FilePdf, FileText, Infinity as Infinito, Palette,
  HandHeart, Robot, SealCheck, Stack, Tag, type Icon,
} from "@phosphor-icons/react";

/** (31/10 · 5.84) A lista do PRO saiu da página Assinar: a Minha assinatura conta os recursos por ela
 *  ("Ver os N recursos"), sem número escrito à mão. Orçamentos, Complementos e Mensagens/Pixel entraram. */
/** Benefício: ícone, título longo (venda), explicação longa, título curto, linha curta e pra onde leva (quem já é PRO).
 *  (21/10) quem já é PRO vê a lista compacta (título curto + uma linha); com tela própria ganha a seta, sem ela o visto verde. */
export type Beneficio = [Icon, string, string, string, string, string | null];
export const BENEFICIOS: Beneficio[] = [
  // (6.108) ordem de venda: o que mais pesa para a confeiteira grátis vem primeiro (cardápio todo no ar, Doo, topos, orçamentos)
  [Infinito, "Todo o cardápio no ar", "No grátis, até 10 produtos no cardápio ao mesmo tempo. No PRO, todos.", "Produtos sem limite", "Todo o cardápio no ar", null],
  [Robot, "A Doo, sua assistente", "Cadastra clientes, produtos, pedidos e cupons e configura sua loja pela conversa, calcula preço e avisa o que está atrasado. Até 500 mensagens por dia.", "Doo, sua assistente", "Faz o trabalho pela conversa", "doo"],
  // (6.101) imagens com IA
  [Cake, "Topos de bolo, logo e banners com IA", "A Doo cria o topo com o nome e o tema da festa, pronto para imprimir em PDF. Também faz a sua logo e os banners e já coloca no cardápio.", "Topos, logo e banners", "Criados pela Doo", "doo"],
  [FileText, "Orçamentos que o cliente aprova", "Monte a proposta, mande o link e o cliente aprova pelo celular. Aprovou, vira pedido.", "Orçamentos", "Proposta com link para aprovar", "/orcamentos"],
  // (6.81) a equipe Doonly monta o cardápio (produtos, logo e banners)
  [HandHeart, "A equipe Doonly monta seu cardápio", "Cadastramos seus produtos e criamos a logo e os banners da sua loja. Você só manda as fotos e os preços.", "Montamos seu cardápio", "Produtos, logo e banners", "equipe"],
  [ChartLineUp, "Seu lucro de verdade", "Relatórios de lucratividade por produto e por mês, para decidir com segurança.", "Lucro de verdade", "Lucratividade de cada produto", "/lucratividade"],
  [Tag, "Cupons de desconto", "Crie quantos cupons quiser para trazer cliente nova. Os 2 mais novos aparecem no topo do cardápio.", "Cupons de desconto", "E os 2 mais novos no topo", "/cupons"],
  // (6.29) adicionais são do PRO (a página e o cardápio só mostram no PRO). (6.10) PDFs (com o "Feito com Doonly"): o texto diz o que o PRO muda de verdade
  [Stack, "Adicionais", "Topo de bolo, velas e outros extras que o cliente marca no produto. Cada pedido vale mais.", "Adicionais", "Extras que o cliente marca", "/complementos"],
  [Palette, "Cardápio com a sua cara", "Qualquer cor no topo da loja, até 4 fotos por produto e um link com o nome da sua loja.", "Cardápio com a sua marca", "Qualquer cor e até 4 fotos", "/cardapio-design"],
  [ChatCircleText, "Mensagens do seu jeito", "Troque os textos prontos do WhatsApp e anuncie com o Pixel do Meta, Google e TikTok.", "Mensagens e Pixel", "Textos do seu jeito e anúncios", "/configuracoes/mensagens"],
  [SealCheck, "Selo de loja verificada", "Mais confiança na hora em que o cliente decide comprar.", "Selo de loja verificada", "Mais confiança para o cliente", null],
  [Crown, "Sem marca d'água", "O cardápio só com a sua marca, sem o \"Feito com Doonly\".", "Sem marca d'água", "Só a sua marca no cardápio", null],
  [FilePdf, "PDFs só com a sua marca", "Pedidos, orçamentos, agenda do dia e fichas técnicas sem o \"Feito com Doonly\" no rodapé.", "PDFs com a sua marca", "Sem o \"Feito com Doonly\"", null],
  [AddressBook, "Importe clientes dos contatos", "Traga os contatos direto da agenda do celular (Android).", "Importar contatos", "Traga da agenda do celular", "/clientes"],
];

/** (31/10 · 5.97) O PRO começa com 7 dias grátis na Hotmart (pede o cartão e só cobra no 8º dia).
 *  Um texto só para o botão em todo o app, e o selo curto onde o botão não cabe. */
export const DIAS_TESTE = 7;

/**
 * (19/11) Oferta do PRO dentro do app (a página de vendas tem a dela): Black Friday, primeiro mês por R$ 1,
 * para todo mundo que é grátis. "teste7" (7 dias grátis) continua existindo para o app da loja (Google Play),
 * onde o pagamento é do Google, e para voltar a ela depois da Black: é só trocar o valor aqui.
 */
export type OfertaPro = "teste7" | "real1";
// (25/11) Black Friday acabou: todo mundo volta pra 7 dias grátis. Pra ligar de novo é só trocar "teste7" por "real1".
export const OFERTA_PRO: OfertaPro = "teste7";
const BLACK = (OFERTA_PRO as OfertaPro) === "real1";
/** Checkout do Doonly PRO na Hotmart; o sck só marca de qual oferta do app veio a venda (relatório da Hotmart) */
export const CHECKOUT_HOTMART = BLACK
  ? "https://pay.hotmart.com/M107866310B?off=8ba1tara&checkoutMode=10&sck=app-r1"
  : "https://pay.hotmart.com/M107866310B?off=elyrqwi7&checkoutMode=10&sck=app-7d";
/** texto do botão do PRO em todo o app */
export const CTA_PRO = noAppDaLoja && !lojaPagamentoPronto ? "Conhecer o PRO" : BLACK ? "Primeiro mês por R$ 1" : `Testar grátis por ${DIAS_TESTE} dias`;
/** botão curto (barra fixa da tela do PRO no celular) */
export const CTA_PRO_CURTO = BLACK ? "Virar PRO" : "Testar grátis";
/** etiqueta pequena do topo (Início e cabeçalho): na Black ela é preta, com a classe abaixo */
/** (20/11) no app da loja (Android) a etiqueta da Black aparece igual à da web, só que parada: sem toque e sem link de compra
 *  (o pagamento do Google está desligado e a venda pela Hotmart não entra no app). Decisão do Bruno, com o app em teste fechado. */
export const ETIQUETA_BLACK = BLACK || noAppDaLoja;
export const ETIQUETA_SEM_TOQUE = noAppDaLoja;
export const SELO_TESTE = ETIQUETA_BLACK ? "Black Friday" : `${DIAS_TESTE} dias grátis`;
export const CLASSE_SELO = ETIQUETA_BLACK ? " selo-black" : "";
/** a oferta escrita na tela do PRO */
export const SELO_OFERTA = BLACK ? "1º mês apenas R$ 1,00" : `${DIAS_TESTE} dias grátis`;
/** frase para avisos (Doo, limites) */
export const CHAMADA_PRO = BLACK ? "Na Black Friday o primeiro mês do PRO sai por R$ 1." : `Teste o PRO grátis por ${DIAS_TESTE} dias.`;
export const PRECO_PRO = "R$ 29,90";

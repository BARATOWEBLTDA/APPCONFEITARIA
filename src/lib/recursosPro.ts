import { PlayCircle, FileText, Ticket, Stack, ChartLineUp, ChatCircleText, Megaphone, AddressBook, Cake, Camera, SealCheck, Images, MicrosoftExcelLogo, Printer, FilePdf, HandHeart, type Icon } from "@phosphor-icons/react";

/** (19/11) O que o PRO libera, num lugar só: a página do PRO (venda) e a Minha assinatura (quem já é PRO) usam as mesmas listas */
/** (19/11) Limites do grátis que o PRO tira: nome, como é hoje e como fica no PRO (o de produtos usa o limite da conta) */
export const LIMITES: [string, string, string][] = [
  ["Fotos por produto", "1", "Até 4"],
  ["Cores da loja", "4", "Todas"],
  ["Doo IA", "10 por mês", "150 por dia"],
  ["Link da loja", "Um código", "Seu nome"],
  ["Cardápio", "Com marca", "Sem marca"],
  ["PDFs", "Com marca", "Sem marca"],
];
/** (19/11) O que só existe no PRO (varredura das travas do app): ícone, nome e a frase do benefício */
export const SO_PRO: [Icon, string, string][] = [
  [PlayCircle, "Stories", "Mostre o bolo do dia em vídeo"],
  [FileText, "Orçamentos", "Feche festas com proposta pronta"],
  [Ticket, "Cupons de desconto", "Traga a cliente de volta"],
  [Stack, "Adicionais", "Venda topo, vela e extras"],
  [ChartLineUp, "Lucro por produto", "Saiba o que mais dá dinheiro"],
  [ChatCircleText, "Mensagens do WhatsApp", "Troque os textos pelo seu jeito"],
  [Megaphone, "Pixel", "Anuncie no Meta, Google e TikTok"],
  [AddressBook, "Importar contatos", "Traga as clientes da agenda"],
  [Cake, "Topos, logo e banners com IA", "A Doo cria para você"],
  [Camera, "Doo com fotos", "Mande a foto e ela cadastra"],
  [SealCheck, "Selo de loja verificada", "Mais confiança para comprar"],
  [Images, "Banners prontos do PRO", "Escolha e coloque no cardápio"],
  [MicrosoftExcelLogo, "Planilha do financeiro", "Baixe tudo em Excel"],
  [Printer, "Imprimir a agenda do dia", "As entregas no papel"],
  [FilePdf, "Ficha técnica em PDF", "Custo e receita para guardar"],
  [HandHeart, "Montamos seu cardápio", "A equipe Doonly faz para você"],
];
/** (19/11) quem já é PRO: para onde cada recurso leva ("doo" abre a Doo, "equipe" chama a equipe no WhatsApp) */
export const DESTINO: Record<string, string> = {
  "Stories": "/stories", "Orçamentos": "/orcamentos", "Cupons de desconto": "/cupons", "Adicionais": "/complementos", "Lucro por produto": "/lucratividade",
  "Mensagens do WhatsApp": "/configuracoes/mensagens", "Pixel": "/pixel", "Importar contatos": "/clientes", "Topos, logo e banners com IA": "doo", "Doo com fotos": "doo",
  "Selo de loja verificada": "/cardapio-design", "Banners prontos do PRO": "/cardapio-design", "Planilha do financeiro": "/financeiro/transacoes", "Imprimir a agenda do dia": "/agenda",
  "Ficha técnica em PDF": "/ficha-tecnica", "Montamos seu cardápio": "equipe",
};

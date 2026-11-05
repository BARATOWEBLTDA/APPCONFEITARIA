// ── RecursoPro.tsx ───────────────────────────────────────────────────────────
// (04/11 · 6.20) Convite do PRO no PADRÃO DO APP (o da tela de Orçamentos, aprovado pelo Bruno):
// faixa rosa com as ondas, o mascote de coroa e uma frase escrita à mão; "X é um recurso do PRO";
// uma frase do que faz; 3 benefícios com ícone rosa; botão "Testar grátis por 7 dias".
// Todo lugar onde a conta grátis esbarra num recurso do PRO usa este convite:
//   <ConvitePro recurso="importarContatos" onClose={…} />
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  AddressBook, Robot, Lightning, Users, ChatCircleText, Receipt, Cake, Target, ChartLineUp, Storefront, FileXls, CalendarBlank, Briefcase,
  Stack, CurrencyCircleDollar, ShoppingBag, Palette, Ticket, ClockCounterClockwise, Gift, Images, Megaphone, Sparkle, Printer,
  ListChecks, Truck, FilePdf, Crown, ArrowRight, Percent, ShareNetwork,
  LinkSimple, Package, FileText, Eye, ArrowsClockwise, HandHeart, WhatsappLogo,
} from "@phosphor-icons/react";
import { Botao, Janela } from "@/components/base";
import { CTA_PRO } from "@/lib/beneficiosPro";
import mascoteCoroa from "@/assets/mascote-coroa.webp";
import "./recursoPro.css";

type Beneficio = [typeof Users, string, string];
export type RecursoInfo = { nome: string; texto: string; frase: [string, string]; beneficios: Beneficio[] };

/** cada recurso do PRO: o nome (vira "X é um recurso do PRO"), uma frase, a frase escrita à mão e os 3 benefícios */
export const RECURSOS_PRO = {
  importarContatos: { nome: "Importar contatos", texto: "Traga as clientes da agenda do celular de uma vez, sem digitar uma por uma.", frase: ["Clientes", "num toque!"],
    beneficios: [[AddressBook, "Da agenda do celular", "Você escolhe quem entra"], [Lightning, "Em segundos", "Nome e WhatsApp já preenchidos"], [Users, "Clientes sem limite", "Com o histórico de compras"]] },
  mensagens: { nome: "Mensagem do seu jeito", texto: "Troque os textos prontos do WhatsApp pelos seus, com o seu jeito de falar com a cliente.", frase: ["Do seu", "jeitinho!"],
    beneficios: [[ChatCircleText, "Seu jeito de falar", "Em cada mensagem"], [Receipt, "Pedido, sinal e entrega", "Com os dados já preenchidos"], [Cake, "Parabéns de aniversário", "Pra cliente voltar a comprar"]] },
  pixel: { nome: "Pixel", texto: "Facebook, Instagram, Google e TikTok ficam sabendo quem visitou e quem comprou no seu cardápio.", frase: ["Anúncio", "que vende!"],
    beneficios: [[Target, "Anúncios mais certeiros", "Pra quem já se interessou"], [ChartLineUp, "Veja o que dá resultado", "Visitas, carrinhos e compras"], [Storefront, "Meta, Google e TikTok", "É só colar o código"]] },
  planilha: { nome: "Extrato em planilha", texto: "Baixe o extrato do período pronto pra abrir no Excel ou mandar pro contador.", frase: ["Contas", "em dia!"],
    beneficios: [[FileXls, "Planilha pronta", "Abre no Excel e no Google"], [CalendarBlank, "Do período que quiser", "Mês, semana ou dia"], [Briefcase, "Pronto pro contador", "Entradas e saídas separadas"]] },
  // (6.110) os textos batem com a página de Adicionais
  complementos: { nome: "Adicionais", texto: "Topo de bolo, velas e escrita que o cliente marca no produto. O valor soma sozinho no pedido.", frase: ["Cada pedido", "vale mais!"],
    beneficios: [[CurrencyCircleDollar, "O valor soma sozinho", "Cada extra com o seu preço"], [Storefront, "Você escolhe onde aparece", "Em quais produtos"], [Images, "O cliente manda a foto", "Ou a frase do topo"]] },
  produtos: { nome: "Cardápio completo", texto: "Mostre todos os seus produtos no cardápio ao mesmo tempo. Os que estão fora continuam salvos.", frase: ["Vitrine", "completa!"],
    beneficios: [[Storefront, "Todos no cardápio", "Sem limite de produtos"], [ClockCounterClockwise, "Nada se perde", "Os de fora continuam salvos"], [Lightning, "Liga e desliga à vontade", "Sem contar limite"]] },
  clientes: { nome: "Clientes sem limite", texto: "Guarde todas as suas clientes e o que cada uma já comprou. O que já cadastrou continua salvo.", frase: ["Clientela", "fiel!"],
    beneficios: [[Users, "Todas as clientes", "Sem limite"], [ClockCounterClockwise, "Histórico de compras", "De cada cliente"], [Gift, "Aniversários", "Lembrete pra mandar parabéns"]] },
  banners: { nome: "Banner pronto exclusivo", texto: "Use qualquer banner da galeria no topo do cardápio, feitos pela equipe Doonly para datas e promoções.", frase: ["Pronto pra", "divulgar!"],
    beneficios: [[Sparkle, "Toda a galeria liberada", "Bolos, doces, festas e datas"], [Megaphone, "Promoção em destaque", "A cliente vê primeiro"], [Lightning, "Em um toque", "Sem precisar editar nada"]] },
  cores: { nome: "Cores do cardápio", texto: "Use as cores da sua marca no topo do cardápio: na faixa, na borda da logo e no nome da loja.", frase: ["Com a sua", "cara!"],
    beneficios: [[Palette, "Qualquer cor", "Igual à da sua marca"], [Storefront, "Faixa, logo e nome", "O topo com a sua cara"], [Sparkle, "Mais 4 cores prontas", "Para escolher num toque"]] },
  agenda: { nome: "Imprimir a agenda", texto: "Leve pra cozinha a folha do dia com os pedidos, os horários e o que produzir.", frase: ["Dia", "organizado!"],
    beneficios: [[Printer, "Folha do dia", "Pedidos em ordem de hora"], [ListChecks, "O que produzir", "Somado por produto"], [Truck, "Entregas e retiradas", "Endereço e quanto receber"]] },
  fichaPdf: { nome: "Ficha técnica em PDF", texto: "Baixe a ficha do produto com ingredientes, custo e preço pra imprimir ou guardar.", frase: ["Receita", "no papel!"],
    beneficios: [[FilePdf, "PDF pronto", "Pra imprimir ou mandar"], [Receipt, "Custo detalhado", "Ingrediente por ingrediente"], [CurrencyCircleDollar, "Preço sugerido", "Com o seu lucro"]] },
  doo: { nome: "A Doo IA", texto: "A sua assistente: calcula preço, monta pedido, cria legenda e responde dúvidas da confeitaria.", frase: ["Ajuda", "na hora!"],
    beneficios: [[Robot, "150 mensagens por dia", "Pergunte o que precisar"], [CurrencyCircleDollar, "Preço e pedido", "Ela calcula e monta pra você"], [Sparkle, "Cria imagens", "Legendas e artes pra divulgar"]] },
  cupons: { nome: "Cupom de desconto", texto: "Crie cupons pra trazer cliente nova e fazer quem já comprou voltar.", frase: ["Desconto", "que vende!"],
    beneficios: [[Ticket, "Cupom com seu código", "Ex.: NATAL10"], [Percent, "Em % ou em reais", "Com validade e mínimo"], [ShareNetwork, "Divulgue no WhatsApp", "A cliente usa no cardápio"]] },
  // (6.110) convites que faltavam (antes eram aviso solto ou iam direto para a página do PRO)
  lucratividade: { nome: "Lucratividade", texto: "Veja quanto sobra de cada produto e do mês, já tirando ingredientes, taxas e despesas.", frase: ["Lucro de", "verdade!"],
    beneficios: [[ChartLineUp, "Lucro por produto", "O que sobra de cada um"], [CalendarBlank, "Lucro do mês", "Com a sua margem em %"], [Receipt, "Tudo descontado", "Ingredientes, taxas e despesas"]] },
  orcamentos: { nome: "Orçamentos", texto: "O cliente conta a ideia pelo seu link, você monta a proposta e ele aprova pelo celular. Aprovou, vira pedido.", frase: ["Mais propostas,", "mais vendas!"],
    beneficios: [[LinkSimple, "Link para pedir orçamento", "Os pedidos chegam organizados"], [Package, "Proposta com seus produtos", "Ou itens com foto e valor"], [FileText, "O cliente aprova pelo link", "E baixa a proposta em PDF"]] },
  fotosProduto: { nome: "Mais fotos", texto: "Mostre o produto de vários jeitos: até 4 fotos que a cliente passa no cardápio, e uma foto para cada sabor ou tamanho.", frase: ["Foto que", "dá vontade!"],
    beneficios: [[Images, "Até 4 fotos por produto", "A cliente passa com o dedo"], [Cake, "Mostre o recheio", "Fatia, lado e detalhe"], [Eye, "Foto de cada opção", "Troca quando a cliente escolhe"]] },
  link: { nome: "Link com o nome da loja", texto: "O link do cardápio leva o nome da sua loja, e o link antigo continua abrindo.", frase: ["Fácil de", "lembrar!"],
    beneficios: [[LinkSimple, "Com o nome da sua loja", "Do jeito que você escolher"], [ShareNetwork, "Mais confiança", "No Instagram e no WhatsApp"], [ArrowsClockwise, "O antigo continua valendo", "Nenhum cliente se perde"]] },
  equipe: { nome: "Montagem do cardápio", texto: "A equipe Doonly cadastra seus produtos e cria a logo e os banners da loja. Você só manda as fotos e os preços.", frase: ["A gente", "monta!"],
    beneficios: [[HandHeart, "Produtos cadastrados", "Com preço e foto"], [Palette, "Logo e banners", "Feitos pela equipe"], [WhatsappLogo, "Pelo WhatsApp", "Direto com a equipe"]] },
} satisfies Record<string, RecursoInfo>;
export type RecursoPro = keyof typeof RECURSOS_PRO;

/** a faixa rosa: ondas, mascote de coroa e a frase escrita à mão */
export function FaixaPro({ frase }: { frase: [string, string] }) {
  return (
    <span className="rp-faixa" aria-hidden="true">
      <span className="rp-frase">{frase[0]}<br />{frase[1]}</span>
      <svg className="rp-onda" viewBox="0 0 600 260" preserveAspectRatio="none">
        <path d="M0 70 C 140 10, 260 120, 400 70 S 560 20, 600 40 L600 260 L0 260 Z" fill="#F3A3C6" opacity=".55" />
        <path d="M0 120 C 120 70, 240 150, 380 120 S 540 80, 600 100 L600 260 L0 260 Z" fill="#EF8FB9" opacity=".35" />
        <path d="M0 175 C 90 140, 220 150, 330 190 S 520 250, 600 230 L600 260 L0 260 Z" fill="#FFF5F9" />
      </svg>
      <img className="rp-masc" src={mascoteCoroa} alt="" />
    </span>
  );
}

/** os 3 benefícios com o ícone rosa */
export function BeneficiosPro({ itens }: { itens: Beneficio[] }) {
  return (
    <ul className="rp-lista">
      {itens.map(([Ic, t, s]) => (
        <li key={t}><span className="rp-li-ic" aria-hidden="true"><Ic size={20} weight="bold" /></span><span className="rp-li-tx"><b>{t}</b><small>{s}</small></span></li>
      ))}
    </ul>
  );
}

/** o título "X é um recurso do PRO" com o PRO em rosa */
export const tituloPro = (nome: string): ReactNode => <>{nome} é um recurso do <em className="rp-pro">PRO</em></>;

/** O convite do PRO (janela no PC, folha de baixo no celular) */
export function ConvitePro({ recurso, aberto = true, onClose, texto }: { recurso: RecursoPro; aberto?: boolean; onClose: () => void; texto?: string }) {
  const navigate = useNavigate();
  const r: RecursoInfo = RECURSOS_PRO[recurso];
  return (
    <Janela aberta={aberto} aoFechar={onClose} titulo={tituloPro(r.nome)} texto={texto ?? r.texto} className="rp-janela" umaAcao
      icone={<FaixaPro frase={r.frase} />}
      acoes={<div className="rp-acoes">
        <Botao cheio icone={<Crown size={20} weight="fill" />} iconeDepois={<ArrowRight size={18} weight="bold" />} onClick={() => { onClose(); navigate("/assinar"); }} data-foco-inicial>{CTA_PRO}</Botao>
        <button type="button" className="rp-nao" onClick={onClose}>Agora não</button>
      </div>}>
      <BeneficiosPro itens={r.beneficios} />
    </Janela>
  );
}

/** (6.81) O mesmo convite, dentro da tela (como em Orçamentos): no PC o texto à esquerda e a faixa rosa à direita */
export function CartaoPro({ recurso }: { recurso: RecursoPro }) {
  const navigate = useNavigate();
  const r: RecursoInfo = RECURSOS_PRO[recurso];
  return (
    <section className="rp-cartao">
      <FaixaPro frase={r.frase} />
      <div className="rp-cartao-tx">
        <h2>{tituloPro(r.nome)}</h2>
        <p>{r.texto}</p>
        <BeneficiosPro itens={r.beneficios} />
        <Botao icone={<Crown size={20} weight="fill" />} iconeDepois={<ArrowRight size={18} weight="bold" />} onClick={() => navigate("/assinar")}>{CTA_PRO}</Botao>
      </div>
    </section>
  );
}

/** compatível com o jeito antigo (RecursoPro com título e texto soltos) — prefira <ConvitePro recurso=…> */
export default function RecursoProAntigo({ recurso, onClose }: { recurso: RecursoPro; onClose: () => void }) {
  return <ConvitePro recurso={recurso} onClose={onClose} />;
}

/** (04/11) abrir o convite de qualquer lugar (ex.: dentro de um onClick sem estado): abrirConvitePro("agenda") */
export function abrirConvitePro(recurso: RecursoPro) {
  window.dispatchEvent(new CustomEvent("doonly-convite-pro", { detail: recurso }));
}
/** fica montado no Layout do app: mostra o convite pedido por abrirConvitePro() */
export function ConviteProGlobal() {
  const [aberto, setAberto] = useState<RecursoPro | null>(null);
  useEffect(() => {
    const abrir = (e: Event) => { const r = (e as CustomEvent<RecursoPro>).detail; if (r && r in RECURSOS_PRO) setAberto(r); };
    window.addEventListener("doonly-convite-pro", abrir);
    return () => window.removeEventListener("doonly-convite-pro", abrir);
  }, []);
  return aberto ? <ConvitePro recurso={aberto} onClose={() => setAberto(null)} /> : null;
}

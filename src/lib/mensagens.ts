/**
 * Mensagens do WhatsApp (09/10 · 3.59). Os textos ficam em profiles.mensagens_whatsapp (chave → texto).
 * Sem texto salvo, vale o padrão daqui. As informações entram pelas etiquetas {nome}, {pedido}…
 * Tela de editar: pages/MensagensWhatsApp.tsx.
 */
import { perfilAtual } from "@/hooks/useProfile";

export type ChaveMensagem = "pedido_cardapio" | "sobre_pedido" | "aniversario";

export type Etiqueta = { k: string; rotulo: string; exemplo: string };

export type Modelo = {
  chave: ChaveMensagem;
  titulo: string;
  quando: string;
  padrao: string;
  etiquetas: Etiqueta[];
  /** etiqueta que não pode faltar (se apagar, o app coloca no fim) */
  obrigatoria?: string;
  aviso?: string;
};

const PEDIDO_EXEMPLO = "*PEDIDO #214*\n\n*1 Bolo de aniversário* — R$ 140,00\n_Tamanho 1,5 kg · Recheio: Brigadeiro_\n\n*Total: R$ 140,00*\n\n*Pagamento:* Pix\n*Retirada:* sábado, 17/10 às 15:00\n\n*Cliente:* Ana Souza · (41) 99999-8888";

export const MODELOS: Modelo[] = [
  {
    chave: "pedido_cardapio",
    titulo: "Pedido feito pelo cardápio",
    quando: "O cliente manda pro seu WhatsApp quando termina o pedido no cardápio",
    padrao: "Oi, *{loja}*! Acabei de fazer um pedido pelo cardápio.\n\n{pedido}",
    etiquetas: [
      { k: "pedido", rotulo: "Itens do pedido", exemplo: PEDIDO_EXEMPLO },
      { k: "loja", rotulo: "Nome da loja", exemplo: "Doce Formiga" },
      { k: "nome", rotulo: "Nome do cliente", exemplo: "Ana" },
      { k: "numero", rotulo: "Nº do pedido", exemplo: "214" },
    ],
    obrigatoria: "pedido",
    aviso: "Os itens, o total, o pagamento e a entrega entram sozinhos onde está {pedido}.",
  },
  {
    chave: "sobre_pedido",
    titulo: "Falar com o cliente sobre o pedido",
    quando: "Você manda pelo botão de WhatsApp na Agenda e em Pedidos",
    padrao: "Olá {nome}! Sobre o seu pedido #{numero}, tudo certo?",
    etiquetas: [
      { k: "nome", rotulo: "Nome do cliente", exemplo: "Ana" },
      { k: "numero", rotulo: "Nº do pedido", exemplo: "214" },
      { k: "data", rotulo: "Data da entrega", exemplo: "sábado, 17/10" },
      { k: "horario", rotulo: "Horário", exemplo: "15:00" },
      { k: "total", rotulo: "Total", exemplo: "R$ 140,00" },
      { k: "falta", rotulo: "Falta pagar", exemplo: "R$ 70,00" },
      { k: "loja", rotulo: "Nome da loja", exemplo: "Doce Formiga" },
    ],
  },
  {
    chave: "aniversario",
    titulo: "Parabéns de aniversário",
    quando: "Você manda pelo botão de parabéns em Clientes",
    padrao: "Feliz aniversário, {nome}! Que o seu dia seja muito doce.",
    etiquetas: [
      { k: "nome", rotulo: "Nome do cliente", exemplo: "Ana" },
      { k: "loja", rotulo: "Nome da loja", exemplo: "Doce Formiga" },
    ],
  },
];

export const modeloPorChave = (k: ChaveMensagem) => MODELOS.find(m => m.chave === k)!;

/** Troca as etiquetas pelos dados. Etiqueta sem dado some (e o espaço que sobrar antes de pontuação também). */
export function preencher(texto: string, dados: Record<string, string | number | null | undefined>): string {
  return texto
    .replace(/\{(\w+)\}/g, (inteiro, k) => (k in dados ? String(dados[k] ?? "") : inteiro))
    .replace(/ +([!?.,])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/**
 * Monta a mensagem com o texto da loja (ou o padrão).
 * textoSalvo: passe quando o texto vem de outro lugar (no cardápio público, vem da loja, não da conta logada).
 */
export function montarMensagem(chave: ChaveMensagem, dados: Record<string, string | number | null | undefined>, textoSalvo?: string | null): string {
  const m = modeloPorChave(chave);
  const salvo = textoSalvo !== undefined ? textoSalvo : perfilAtual()?.mensagens_whatsapp?.[chave];
  let texto = (salvo && salvo.trim()) ? salvo : m.padrao;
  if (m.obrigatoria && !texto.includes(`{${m.obrigatoria}}`)) texto = `${texto.trim()}\n\n{${m.obrigatoria}}`;
  return preencher(texto, dados);
}

/** Dados de exemplo pra prévia */
export function exemplo(m: Modelo): Record<string, string> {
  return Object.fromEntries(m.etiquetas.map(e => [e.k, e.exemplo]));
}

const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Dados de um pedido pras etiquetas de "Falar com o cliente sobre o pedido" */
export function dadosDoPedido(p: any, primeiroNome: string): Record<string, string> {
  let data = "";
  if (p?.data_entrega) {
    const d = new Date(String(p.data_entrega).slice(0, 10) + "T12:00:00");
    if (!isNaN(d.getTime())) data = `${DIAS_SEMANA[d.getDay()]}, ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  }
  const total = Number(p?.valor_total) || 0;
  const falta = Math.max(0, total - (Number(p?.valor_recebido) || 0));
  return {
    nome: primeiroNome || "",
    numero: p?.numero ? String(p.numero) : "",
    data,
    horario: p?.horario_entrega ? String(p.horario_entrega).slice(0, 5) : "",
    total: total ? reais(total) : "",
    falta: reais(falta),
    loja: perfilAtual()?.nome_loja || "",
  };
}

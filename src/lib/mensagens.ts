/**
 * Mensagens do WhatsApp (09/10 · 3.59). Os textos ficam em profiles.mensagens_whatsapp (chave → texto).
 * Sem texto salvo, vale o padrão daqui. As informações entram pelas etiquetas {nome}, {pedido}…
 * Tela de editar: pages/MensagensWhatsApp.tsx.
 */
import { perfilAtual } from "@/hooks/useProfile";
import { saldoPedido } from "@/components/pedidos/pedidoTexto";

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
    quando: "O cliente manda para o seu WhatsApp quando termina o pedido no cardápio",
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

// palavrinhas que ficam soltas quando a etiqueta logo depois delas vem vazia ("às {horario}", "no dia {data}")
const CONECTORES = "às|as|em|no|na|de|do|da|para|pra|pro|até|com|por|e|a|o";
const SOBRA_ANTES = new RegExp(`(^|[ \\t\\n])(?:${CONECTORES})[ \\t]+\\uE000`, "gi");
// "dia {data}" também sobra ("no dia {data}"), mas só quando a etiqueta vazia é a da data ou do horário (\uE002):
// "Bom dia {nome}" e "Feliz dia {nome}" continuam inteiros
const SOBRA_DIA = /(^|[ \t\n])(?:dia|data)[ \t]+\uE002/gi;

/**
 * Troca as etiquetas pelos dados.
 * (11/10) Aceita a etiqueta com maiúscula ({Nome}, {NOME}): antes ia crua pra cliente.
 * Etiqueta sem dado some, e some junto o que sobraria em volta dela: o conector ("fica pronto 10/10 às." → "fica pronto 10/10."),
 * o "#" do número, o negrito vazio, a vírgula e o espaço dobrado. Os dados entram por último: nada disso mexe neles.
 *
 *   preencher("Fica pronto {data} às {horario}.", { data: "10/10", horario: "" })  → "Fica pronto 10/10."
 *   preencher("Feliz aniversário, {Nome}!", { nome: "" })                         → "Feliz aniversário!"
 */
export function preencher(texto: string, dados: Record<string, string | number | null | undefined>): string {
  const porChave = new Map(Object.keys(dados).map(k => [k.toLowerCase(), k]));
  const valores: string[] = [];
  // 1) etiqueta com dado vira uma marca; etiqueta vazia vira outra (uma própria pra data e horário); a desconhecida fica como está.
  //    As marcas são letras de uso privado (U+E000 a U+E002): não aparecem em texto de verdade.
  let t = texto.replace(/\{(\w+)\}/g, (inteiro, k: string) => {
    const chave = porChave.get(k.toLowerCase());
    if (chave === undefined) return inteiro;
    const v = String(dados[chave] ?? "").trim() ? String(dados[chave]) : "";
    if (!v) return /^(data|horario)$/i.test(chave) ? "\uE002" : "\uE000";
    valores.push(v);
    return `\uE001${valores.length - 1}\uE001`;
  });
  // 2) limpa o que sobrou em volta das etiquetas vazias
  if (t.includes("\uE000") || t.includes("\uE002")) {
    t = t.replace(SOBRA_DIA, "$1\uE000").replace(/\uE002/g, "\uE000"); // "no dia {data}" → "no {data}" (o "no" sai logo abaixo)
    let antes = "";
    while (antes !== t) {
      antes = t;
      t = t
        .replace(/([*_~])\uE000\1/g, "\uE000")        // negrito ou itálico vazio: "*{loja}*"
        .replace(/#\uE000|\(\uE000\)/g, "\uE000")      // "#{numero}" e "({data})"
        .replace(SOBRA_ANTES, "$1\uE000");             // "às {horario}", "de {total}"
    }
    t = t
      .replace(/,[ \t]*\uE000[ \t]*,/g, ",")                              // "Oi, {nome}, tudo bem?" → "Oi, tudo bem?"
      .replace(/,[ \t]*\uE000(?=[ \t]*(?:[!?.;:]|\n|$))/g, "")           // "aniversário, {nome}!" → "aniversário!"
      .replace(/(^|\n)[ \t]*\uE000[ \t]*,[ \t]*(\S)/g, (_m, ini: string, letra: string) => ini + letra.toUpperCase()) // "{nome}, seu pedido" → "Seu pedido"
      .replace(/(^|\n)[ \t]*\uE000[ \t]*/g, "$1")                         // etiqueta vazia no começo da linha
      .replace(/([ \t]*)\uE000([ \t]*)/g, (_m, a: string, b: string) => (a || b ? " " : "")) // no meio: fica um espaço só
      // (11/10) sobras de espaço: "Oi  tudo" → "Oi tudo" e "pedido :" → "pedido:" (só na linha; os dados entram depois)
      .replace(/(\S)[ \t]{2,}/g, "$1 ")
      .replace(/[ \t]+([:;.,])/g, "$1");
  }
  // 3) espaço antes de pontuação e no fim da linha
  t = t
    .replace(/ +([!?.,])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  // 4) por último, os dados
  return t.replace(/\uE001(\d+)\uE001/g, (_m, i: string) => valores[Number(i)]);
}

/**
 * Monta a mensagem com o texto da loja (ou o padrão).
 * textoSalvo: passe quando o texto vem de outro lugar (no cardápio público, vem da loja, não da conta logada).
 */
export function montarMensagem(chave: ChaveMensagem, dados: Record<string, string | number | null | undefined>, textoSalvo?: string | null): string {
  const m = modeloPorChave(chave);
  const salvo = textoSalvo !== undefined ? textoSalvo : perfilAtual()?.mensagens_whatsapp?.[chave];
  let texto = (salvo && salvo.trim()) ? salvo : m.padrao;
  // (11/10) {Pedido} com maiúscula também vale: antes o app achava que faltava e colocava os itens duas vezes
  if (m.obrigatoria && !texto.toLowerCase().includes(`{${m.obrigatoria}}`)) texto = `${texto.trim()}\n\n{${m.obrigatoria}}`;
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
  // (11/10) a mesma conta da lista: pedido cancelado não tem nada a cobrar, e o recebido segue a situação do pagamento
  const falta = saldoPedido(p);
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

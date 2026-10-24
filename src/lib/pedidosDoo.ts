/**
 * Pedidos: regra ÚNICA (02/10) — usada pela Nova venda E pela Doo IA.
 * Assim um pedido feito pela Doo fica idêntico ao manual: mesma situação, mesmo cálculo de
 * pagamento, mesmo cadastro de cliente novo, mesmos itens (com tamanho/kit) e mesmo histórico.
 */
import { ajustarRecebido, ESTORNO_POR_EXCLUSAO, faltaNoBanco, registrarPagamento } from "@/lib/pagamentos";
import { explicarErro } from "@/lib/erros";
import { pesoDoTamanho } from "@/lib/itemSacola";
import { supabase } from "@/lib/supabase";
import { criarPersonalizacoesV1, criarBreakdownV1, SNAPSHOT_VERSION_ATUAL } from "@/lib/pedido-snapshot";
import { r2, somarReais } from "@/lib/moeda";
import { comDesconto, descontoCardapio, precosDosSabores } from "@/lib/precoCardapio";
import { precoLivre } from "@/lib/kitQuantidade";

export const FORMAS_PAGAMENTO = ["PIX", "Dinheiro", "Crédito", "Débito"] as const;
export type SituacaoPag = "total" | "parcial" | "fiado" | "na_entrega";

export type ItemPedido = {
  produto_id?: string; nome_produto: string; quantidade: number; valor_unitario: number;
  imagem_url?: string; forma_venda?: string; observacoes: string; opcaoLabel?: string; personalizacoes?: any;
};

/** Quantas quantidades o kit livre oferece na Nova venda (mínimo, mínimo + passo…). Mais que isso, ela aumenta a quantidade do item. */
const MAX_OPCOES_KIT_LIVRE = 8;

/**
 * Tamanhos (P/M/G, pelo peso) ou kits do produto — igual à escolha da Nova venda.
 * (11/10) O preço já sai com a promoção, pela mesma regra do cardápio (lib/precoCardapio):
 * em % vale pra tudo; em valor não vale pra tamanho de preço fixo nem pra kit.
 */
/** (14/10) kit "ele escolhe": a opção de uma quantidade qualquer (válida pelo mínimo, máximo e passo) */
export function opcaoKitLivre(p: any, q: number): { label: string; valor: number; pers: any } | null {
  const kq = p?.kit_qtd;
  if (!kq?.ativo || kq.modo !== "livre") return null;
  const min = Number(kq.livre?.min) || 0, max = Number(kq.livre?.max) || 0;
  if (!(q >= min) || (max > 0 && q > max)) return null;
  const valor = comDesconto(precoLivre(kq, q), descontoCardapio(p));
  return valor > 0 ? { label: `${q} unidades`, valor, pers: { kit: { modo: "livre", total: q, sabores: [] } } } : null;
}

/** (14/10) quantidades redondas que costumam vender (10, 25, 50, cento…), só as que o kit aceita */
export function quantidadesSugeridas(p: any): number[] {
  const kq = p?.kit_qtd;
  if (!kq?.ativo || kq.modo !== "livre") return [];
  const min = Number(kq.livre?.min) || 0, max = Number(kq.livre?.max) || 0, passo = Number(kq.livre?.passo) || 1;
  const ok = (q: number) => q >= min && (!max || q <= max) && (q - min) % passo === 0;
  return Array.from(new Set([min, 10, 25, 50, 100, 150, 200, 300, 500, 1000].filter(ok))).sort((a, b) => a - b).slice(0, 6);
}

export function opcoesDoProduto(p: any): { label: string; valor: number; pers: any }[] {
  const desc = descontoCardapio(p);
  const gt = p?.grupo_tamanhos;
  if (gt?.ativo && Array.isArray(gt.opcoes)) {
    const porPeso = gt.modo_preco_tamanho === "por_peso";
    const ops = gt.opcoes.filter((o: any) => o?.nome?.trim()).map((o: any) => {
      const peso = pesoDoTamanho(o, porPeso); // (10/10) sem peso_kg, lê o peso do nome ("1,5kg")
      const valor = comDesconto(porPeso ? (Number(p.preco_normal) || 0) * peso : Number(o.preco) || 0, desc);
      return { label: o.nome, valor, pers: { tamanho: { nome: o.nome, preco: valor, peso_kg: peso || null } } };
    }).filter((o: any) => o.valor > 0);
    if (ops.length) return ops;
  }
  const kq = p?.kit_qtd;
  if (kq?.ativo && kq.modo === "livre") {
    // (11/10) kit que virou "livre": não oferece mais os kits fechados antigos (que continuam guardados no cadastro).
    // Oferece do mínimo pra cima, de passo em passo, pelo preço por cento, como o cardápio.
    const min = Number(kq.livre?.min) || 0, passo = Number(kq.livre?.passo) || 0, max = Number(kq.livre?.max) || 0;
    const qtds: number[] = min > 0 ? [min] : [];
    if (min > 0 && passo > 0) for (let q = min + passo; q <= max && qtds.length < MAX_OPCOES_KIT_LIVRE; q += passo) qtds.push(q);
    if (min > 0 && max > qtds[qtds.length - 1] && qtds.length < MAX_OPCOES_KIT_LIVRE) qtds.push(max); // o máximo, como o cardápio
    return qtds.map(q => ({ label: `${q} unidades`, valor: comDesconto(precoLivre(kq, q), desc), pers: { kit: { modo: "livre", total: q, sabores: [] } } }))
      .filter(o => o.valor > 0);
  }
  if (kq?.ativo && Array.isArray(kq.kits) && kq.kits.length) {
    return kq.kits.filter((k: any) => (k.qtd || 0) > 0 && (k.preco || 0) > 0).map((k: any) => ({
      label: `${k.qtd} unidades`, valor: comDesconto(Number(k.preco), desc), pers: { kit: { modo: "fechado", total: k.qtd, sabores: [] } },
    }));
  }
  // (24/10) "cada sabor tem o seu preço": o sabor é a escolha (antes entrava o preço do mais barato sem perguntar)
  if (precosDosSabores(p)) {
    return (p.grupo_sabores.opcoes || []).filter((o: any) => !o?.esgotado && (Number(o?.preco) || 0) > 0 && String(o?.nome || "").trim()).map((o: any) => {
      const valor = comDesconto(Number(o.preco), desc);
      return { label: o.nome, valor, pers: { sabor: { id: o.id, nome: o.nome, adicional: 0, preco_proprio: Number(o.preco) } } };
    });
  }
  return [];
}

/** Preço do produto sem tamanho nem kit, já com a promoção (11/10: antes a Nova venda e a Doo cobravam o preço cheio). */
export const precoDeVenda = (p: any): number => comDesconto(Number(p?.preco_normal) || 0, descontoCardapio(p)); // a mesma conta do cardápio

export const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** (17/10 · R07) id novo pra uma tentativa de salvar pedido (o mesmo é reaproveitado se ela tocar de novo) */
export const novoIdTentativa = (): string => (typeof crypto !== "undefined" && "randomUUID" in crypto)
  ? crypto.randomUUID()
  : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16); });

export type DadosPedido = {
  /** (17/10 · R07) id fixo da tentativa: tocar de novo depois de a internet cair não cria um segundo pedido */
  idTentativa?: string;
  tipo: "encomenda" | "pronta_entrega";
  itens: ItemPedido[];
  semCliente: boolean;
  clienteId: string | null;
  clienteNome: string;
  clienteTelefone: string;
  /** cliente digitado que ainda não existe: cadastra em Clientes antes do pedido */
  clienteNovo: boolean;
  tipoEntrega: "retirada" | "entrega";
  /** (16/10) pronta entrega com retirada em que o cliente ainda vem buscar (já pagou pelo WhatsApp, por exemplo) */
  vemBuscar?: boolean;
  dataEntrega: string;
  horarioEntrega: string;
  endereco: { rua: string; numero: string; bairro: string; cidade: string; complemento: string };
  taxaEntrega: number;
  desconto: number;
  acrescimo: number;
  formaPagamento: string;
  situacaoPag: SituacaoPag;
  valorParcial: number;
  dataPrevistaPagamento: string;
  statusPedido: string;
  observacoes: string;
  origem?: string;
};

// (11/10) Cada linha e o total em centavos certos: 6×4,35 + 2×12 + 3×149,99 dava 500,07000000000005,
// o sinal igual ao total passava na conferência e o pedido nascia "pago" com recebimento do tipo "sinal".
export const subtotalDe = (itens: ItemPedido[]) => somarReais(itens.map(i => r2((Number(i.valor_unitario) || 0) * (Number(i.quantidade) || 0))));
export const totalDe = (d: Pick<DadosPedido, "itens" | "tipoEntrega" | "taxaEntrega" | "desconto" | "acrescimo">) =>
  Math.max(0, somarReais([subtotalDe(d.itens), d.tipoEntrega === "entrega" ? d.taxaEntrega : 0, d.acrescimo, -r2(d.desconto)]));

/** O que ainda falta — as mesmas exigências das etapas da Nova venda. */
export function pendenciasPedido(d: DadosPedido): string[] {
  const p: string[] = [];
  if (!d.itens.length) p.push("Escolha pelo menos um produto");
  if (d.tipo === "encomenda" && !d.dataEntrega) p.push("Falta a data da entrega");
  // (11/10) a Nova venda não aceita dia que já passou; o pedido da Doo também não
  else if (d.tipo === "encomenda" && d.dataEntrega < hojeISO()) p.push("A data da entrega já passou. Toque em Editar e escolha outra");
  if (d.tipoEntrega === "entrega" && !d.endereco.rua.trim()) p.push("Falta o endereço da entrega");
  if (d.situacaoPag === "parcial") {
    const total = totalDe(d), sinal = r2(d.valorParcial);
    if (!(sinal > 0 && sinal < total)) p.push("O valor do sinal precisa ser maior que zero e menor que o total");
  }
  return p;
}

/**
 * Salva o pedido — o corpo do "Finalizar venda" da Nova venda, agora num lugar só.
 * (11/10) "clienteId" volta nas duas respostas: é a cliente usada no pedido (a nova, quando foi cadastrada agora).
 * Se o pedido falhar, quem chamou guarda esse id e manda de volta em d.clienteId na próxima tentativa
 * (antes cada tentativa cadastrava a mesma cliente de novo).
 */
export async function criarPedido(userId: string, d: DadosPedido): Promise<{ ok: true; pedido: any; aviso?: string; clienteId: string | null } | { ok: false; erro: string; clienteId: string | null }> {
  const total = totalDe(d);
  const subtotal = subtotalDe(d.itens);
  const desconto = r2(d.desconto), acrescimo = r2(d.acrescimo);
  let status: string = d.statusPedido || "agendado";
  let statusPag = "pago";
  let valorRecebido = total;
  // pronta entrega com retirada: o cliente já levou (entregue), a não ser que ele ainda venha buscar (pronto pra retirar)
  if (d.tipo === "pronta_entrega" && d.tipoEntrega === "retirada") status = d.vemBuscar ? (status === "entregue" || status === "aguardando_aceite" ? "aguardando_retirada" : status) : "entregue";
  if (d.situacaoPag === "fiado" || d.situacaoPag === "na_entrega") { statusPag = "pendente"; valorRecebido = 0; }
  else if (d.situacaoPag === "parcial") { statusPag = "parcial"; valorRecebido = r2(d.valorParcial); }

  const avisos: string[] = [];
  let clienteIdFinal = d.clienteId;
  if (!d.semCliente && !d.clienteId && d.clienteNovo && d.clienteNome.trim()) {
    const end: any = d.tipoEntrega === "entrega" ? { rua: d.endereco.rua || null, numero: d.endereco.numero || null, bairro: d.endereco.bairro || null, cidade: d.endereco.cidade || null, complemento: d.endereco.complemento || null } : {};
    const { data: cliNovo, error: errCli } = await supabase.from("clientes")
      .insert({ user_id: userId, nome: d.clienteNome.trim(), whatsapp: d.clienteTelefone.trim() || null, ...end })
      .select("id").single();
    if (!errCli && (cliNovo as any)?.id) clienteIdFinal = (cliNovo as any).id;
    else {
      // (11/10) antes só ia pro console: o pedido saía sem cliente ligada e ninguém ficava sabendo
      console.error("[Doonly] não deu para cadastrar o cliente novo:", errCli);
      avisos.push("Pedido salvo, mas a cliente não foi cadastrada.");
    }
  }

  const linhaPedido: any = {
    user_id: userId,
    cliente_id: clienteIdFinal,
    cliente_nome: d.semCliente ? "" : d.clienteNome,
    cliente_telefone: d.semCliente ? "" : d.clienteTelefone,
    status,
    status_pagamento: statusPag,
    valor_recebido: valorRecebido,
    valor_total: total,
    valor_produtos: subtotal,
    desconto,
    acrescimo, // (10/10) antes só entrava no total: ao editar o pedido, o acréscimo sumia
    taxa_entrega: d.tipoEntrega === "entrega" ? r2(d.taxaEntrega) : 0,
    forma_pagamento: d.formaPagamento,
    tipo_entrega: d.tipoEntrega,
    data_entrega: d.tipo === "encomenda" || d.vemBuscar ? (d.dataEntrega || hojeISO()) : hojeISO(),
    horario_entrega: d.tipo === "encomenda" || d.vemBuscar ? (d.horarioEntrega || null) : null,
    endereco_rua: d.endereco.rua,
    endereco_numero: d.endereco.numero,
    endereco_bairro: d.endereco.bairro,
    endereco_cidade: d.endereco.cidade,
    endereco_complemento: d.endereco.complemento,
    origem: d.origem || "manual",
    tipo_venda: d.tipo,
    observacoes: d.observacoes,
    // (11/10) "Paga na entrega" não grava mais a data da entrega aqui: com o campo vazio, o A receber já usa
    // a data da entrega, e acompanha quando a entrega muda de dia (antes ficava preso na data antiga).
    data_prevista_pagamento: d.situacaoPag === "fiado" ? (d.dataPrevistaPagamento || null) : null,
  };
  if (d.idTentativa) linhaPedido.id = d.idTentativa;
  let { data: novoPedido, error } = await supabase.from("pedidos").insert(linhaPedido).select().single();
  if (error && /acrescimo/i.test(error.message || "")) {
    // a coluna "acrescimo" não existe nessa conta: grava sem ela (mesmo plano B do Editar pedido)
    const { acrescimo: _semColuna, ...semAcrescimo } = linhaPedido;
    ({ data: novoPedido, error } = await supabase.from("pedidos").insert(semAcrescimo).select().single());
  }
  // (17/10 · R07) "esse id já existe": a tentativa anterior tinha gravado e só a resposta se perdeu no caminho
  if (error && d.idTentativa && (error as any).code === "23505" && /pkey/i.test(String(error.message || ""))) {
    const { data: jaGravado } = await supabase.from("pedidos").select("*, pedido_itens(id)").eq("id", d.idTentativa).maybeSingle();
    if (jaGravado) {
      const { pedido_itens: itensGravados, ...pedidoGravado } = jaGravado as any;
      if (Array.isArray(itensGravados) && itensGravados.length > 0) return { ok: true, pedido: pedidoGravado, clienteId: clienteIdFinal };
      novoPedido = pedidoGravado; error = null; // gravou sem os produtos: segue e grava os produtos agora
    }
  }
  if (error || !novoPedido) return { ok: false, clienteId: clienteIdFinal, erro: explicarErro(error, "Não deu para registrar a venda. Tente de novo.") };
  const pid = (novoPedido as any).id;

  const itensInsert = d.itens.map(it => ({
    pedido_id: pid,
    produto_id: it.produto_id,
    nome_produto: it.nome_produto,
    quantidade: it.quantidade,
    valor_unitario: it.valor_unitario,
    observacoes: it.observacoes || "",
    imagem_url: it.imagem_url || null,
    personalizacoes: it.personalizacoes ? { ...criarPersonalizacoesV1({}), ...it.personalizacoes } : criarPersonalizacoesV1({}),
    preco_breakdown: criarBreakdownV1({ final: it.valor_unitario }),
    snapshot_version: SNAPSHOT_VERSION_ATUAL,
  }));
  const { error: errItens } = await supabase.from("pedido_itens").insert(itensInsert);
  if (errItens) {
    // (11/10) Sem os produtos o pedido não vale: antes ficava gravado vazio, com tela de sucesso e o dinheiro lançado.
    // Apaga o pedido recém-criado (ainda sem histórico nem recebimento) e devolve o erro, pra ela tentar de novo.
    const falha = explicarErro(errItens, "Não deu para salvar os produtos do pedido, então a venda não foi registrada. Tente de novo.");
    const { data: apagado, error: errApagar } = await supabase.from("pedidos").delete().eq("id", pid).select("id");
    if (errApagar || !(apagado as any[] | null)?.length) {
      if (errApagar) console.error("[Doonly] pedido sem produtos que não deu para apagar:", errApagar);
      const n = (novoPedido as any).numero ? ` #${(novoPedido as any).numero}` : "";
      return { ok: false, clienteId: clienteIdFinal, erro: `O pedido${n} ficou salvo sem os produtos. Abra a lista de pedidos e confira esse pedido antes de registrar de novo.` };
    }
    return { ok: false, clienteId: clienteIdFinal, erro: falha };
  }

  supabase.from("pedido_historico").insert({
    pedido_id: pid, user_id: userId, evento: "Pedido criado",
    descricao: `Pedido ${d.tipo === "pronta_entrega" ? "de pronta entrega" : "de encomenda"} registrado ${d.origem === "doo" ? "pela Doo IA" : "manualmente"}`,
  }).then(() => {}, () => {});

  // Financeiro · Passo 1: o recebido do pedido vira uma linha em "pagamentos" (com forma e data).
  // O pedido já nasceu com o valor certo, então sem a tabela (SQL não rodado) não grava nada a mais.
  if (valorRecebido > 0) {
    const pg = await registrarPagamento({
      pedidoId: pid, userId, valor: valorRecebido, forma: d.formaPagamento,
      tipo: statusPag === "pago" ? "total" : "sinal", origem: d.origem === "doo" ? "doo" : "app", pedidoJaTemOValor: true,
    });
    if (!pg.ok) {
      // (10/10) o recebimento não gravou: o pedido não pode ficar "pago" sem dinheiro no caixa.
      // O pedido passa a mostrar o que está gravado de verdade (a soma dos recebimentos dele, em geral zero)
      // e a tela avisa; o pedido não se perde.
      const { data: linhas, error: errLer } = await supabase.from("pagamentos").select("valor").eq("pedido_id", pid).is("estornado_em", null);
      const gravado = errLer ? 0 : Math.round(((linhas as any[]) || []).reduce((s, l) => s + (Number(l.valor) || 0), 0) * 100) / 100;
      if (gravado < valorRecebido - 0.009) { // (se a soma bate, o pagamento entrou e só a resposta se perdeu: nada a corrigir)
        const real = gravado > 0 ? (gravado >= total - 0.009 ? "pago" : "parcial") : "pendente";
        const { error: errVolta } = await supabase.from("pedidos").update({ status_pagamento: real, valor_recebido: gravado }).eq("id", pid);
        if (errVolta) {
          console.error("[pedidos] não consegui corrigir o pagamento do pedido:", errVolta);
          avisos.push("O pedido foi salvo, mas o recebimento não entrou no financeiro. Abra o pedido e confira o pagamento.");
        } else {
          (novoPedido as any).status_pagamento = real;
          (novoPedido as any).valor_recebido = gravado;
          avisos.push("O pedido foi salvo, mas o recebimento não foi registrado. Abra o pedido e registre o recebimento.");
        }
      }
    }
  }
  return { ok: true, pedido: novoPedido, clienteId: clienteIdFinal, ...(avisos.length ? { aviso: avisos.join(" ") } : {}) };
}

/**
 * Excluir pedido (10/10): um lugar só, usado pela lista e pela tela do pedido.
 * A confirmação promete que ele some do financeiro, então os recebimentos ativos são estornados antes
 * (sem isso continuavam somando no caixa: o pagamento fica sem pedido, mas não some).
 * Qualquer passo que falhar para tudo: o pedido não é apagado e a tela avisa.
 * "estornou" diz se os recebimentos já tinham sido estornados quando parou (a tela precisa reler o pedido).
 */
export async function excluirPedido(pedidoId: string): Promise<{ ok: true } | { ok: false; erro: string; estornou: boolean }> {
  // 1) recebimentos ativos do pedido (sem a tabela de pagamentos não há o que estornar)
  const { data: ativos, error: errPag } = await supabase.from("pagamentos")
    .select("id").eq("pedido_id", pedidoId).is("estornado_em", null);
  if (errPag && !faltaNoBanco(errPag)) {
    return { ok: false, estornou: false, erro: explicarErro(errPag, "Não deu para conferir os recebimentos deste pedido, então ele não foi excluído. Tente de novo.") };
  }
  let estornou = false;
  if (!errPag && (ativos || []).length > 0) {
    const r = await ajustarRecebido({ pedidoId, alvo: 0 }); // alvo zero = estorna todos os ativos (nada é apagado)
    if (!r.ok) return { ok: false, estornou: true, erro: "Não deu para estornar os recebimentos deste pedido, então ele não foi excluído. Confira os pagamentos do pedido e tente de novo." };
    estornou = true;
    // marca que o estorno veio da exclusão (não é devolução de dinheiro): o saldo em caixa informado antes não mexe por isso
    const { error: errMarca } = await supabase.from("pagamentos").update({ observacao: ESTORNO_POR_EXCLUSAO }).in("id", (ativos as any[]).map(a => a.id));
    if (errMarca) console.error("[Doonly] marca do estorno por exclusão:", errMarca);
  }
  const depoisDoEstorno = estornou ? " Os recebimentos dele já foram estornados." : "";
  // 2) itens (antes o erro daqui era ignorado)
  const { error: errItens } = await supabase.from("pedido_itens").delete().eq("pedido_id", pedidoId);
  if (errItens) return { ok: false, estornou, erro: explicarErro(errItens, "Não deu para excluir o pedido. Tente de novo.") + depoisDoEstorno };
  // 3) o pedido
  const { error } = await supabase.from("pedidos").delete().eq("id", pedidoId);
  if (error) return { ok: false, estornou, erro: explicarErro(error, "Não deu para excluir o pedido. Tente de novo.") + depoisDoEstorno };
  return { ok: true };
}

/* ── Doo IA: catálogo, clientes e o rascunho que ela prepara ─────────────── */
export type ProdutoCat = {
  id: string; nome: string; preco_normal: number; forma_venda?: string; imagem_url?: string; categoria?: string; grupo_tamanhos?: any; kit_qtd?: any;
  promocao?: boolean | null; tipo_promocao?: string | null; desconto_percentual?: number | null; preco_promocional?: number | null;
};
export type ClienteCat = { id: string; nome: string; telefone?: string; whatsapp?: string; rua?: string; numero?: string; bairro?: string; cidade?: string; complemento?: string };

// (11/10) Quanto a Doo recebe do cardápio e das clientes (antes 120 e 300: conta maior ficava com produto e cliente de fora).
// Cliente que passar do teto ainda é achada pelo nome na hora de montar o cartão (procurarClientesPorNome).
const TETO_PRODUTOS_DOO = 400;
const TETO_CLIENTES_DOO = 1000;
const CAMPOS_PRODUTO = "id,nome,preco_normal,forma_venda,imagem_url,categoria,grupo_tamanhos,kit_qtd";
/** Campos da promoção (11/10): sem eles a Nova venda e a Doo cobravam o preço cheio. */
const CAMPOS_PROMOCAO = "promocao,tipo_promocao,desconto_percentual,preco_promocional";
const CAMPOS_CLIENTE = "id,nome,telefone,whatsapp,rua,numero,bairro,cidade,complemento";

/**
 * Produtos pra vender (Nova venda e Doo), com os campos da promoção.
 * Se a leitura com a promoção falhar por causa do banco (coluna que a conta não tem), lê sem ela: a venda não trava.
 */
export async function lerProdutosDeVenda(uid: string, extra = ""): Promise<{ data: any[] | null; error: any }> {
  const ler = (campos: string) => supabase.from("produtos").select(campos + extra).eq("user_id", uid).order("nome");
  let r: { data: any; error: any } = await ler(`${CAMPOS_PRODUTO},${CAMPOS_PROMOCAO}`);
  if (r.error && /^(42703|PGRST204)$/.test(String(r.error.code || ""))) r = await ler(CAMPOS_PRODUTO);
  return { data: (r.data as any[]) || null, error: r.error };
}

export async function listarCatalogo(uid: string): Promise<{ produtos: ProdutoCat[]; clientes: ClienteCat[]; taxaPadrao: number }> {
  const [p, c] = await Promise.all([
    lerProdutosDeVenda(uid, ",disponivel"),
    supabase.from("clientes").select(CAMPOS_CLIENTE).eq("user_id", uid).order("nome").limit(TETO_CLIENTES_DOO),
  ]);
  return { produtos: ((p.data as any[]) || []).filter(x => x.disponivel !== false), clientes: (c.data as any[]) || [], taxaPadrao: 0 };
}

/** Sem acento, sem maiúscula e com um espaço só: "  José  da SILVA" → "jose da silva". */
const nomeLimpo = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Padrão de busca "ilike" que não liga pra acento (11/10): vogal, c e n viram "_" (uma letra qualquer),
 * então "Jose" acha "José" e "Conceicao" acha "Conceição". Quem chama confere o nome exato depois (nomeLimpo).
 */
export function padraoSemAcento(nome: string): string {
  return nomeLimpo(nome).replace(/[^a-z0-9 ]/gu, "_").replace(/[aeioucn]/g, "_").replace(/ /g, "%");
}

/**
 * Clientes com esse nome (sem diferenciar acento nem maiúscula), direto do banco (11/10).
 * A Doo só recebe as primeiras clientes da lista: sem isso, cliente antiga virava "cliente nova" e era cadastrada de novo.
 */
export async function procurarClientesPorNome(uid: string, nome: string): Promise<ClienteCat[]> {
  const alvo = nomeLimpo(nome);
  if (!alvo) return [];
  const { data, error } = await supabase.from("clientes").select(CAMPOS_CLIENTE).eq("user_id", uid)
    .ilike("nome", `${padraoSemAcento(nome)}%`).order("nome").limit(300); // o padrão é largo (nome curto acha muita gente): o nome exato é conferido abaixo
  if (error) { console.error("[Doonly] busca de cliente pelo nome:", error); return []; }
  return ((data as any[]) || []).filter(c => nomeLimpo(c.nome) === alvo);
}

export type RascunhoPedido = {
  acao: "pedido";
  tipo?: "encomenda" | "pronta_entrega";
  itens: { produto_id: string; opcao?: string | null; quantidade?: number; observacoes?: string }[];
  cliente?: { id?: string | null; nome?: string; telefone?: string } | null;
  tipo_entrega?: "retirada" | "entrega";
  data_entrega?: string | null;
  horario_entrega?: string | null;
  endereco?: { rua?: string; numero?: string; bairro?: string; cidade?: string; complemento?: string } | null;
  taxa_entrega?: number;
  desconto?: number;
  forma_pagamento?: string;
  situacao?: SituacaoPag;
  valor_recebido?: number;
  data_prevista_pagamento?: string | null;
  observacoes?: string;
};

/** Transforma o rascunho da Doo em dados de pedido, com os PREÇOS DO CATÁLOGO (nunca os que a IA escreveu). */
export function montarPedido(r: RascunhoPedido, cat: { produtos: ProdutoCat[]; clientes: ClienteCat[] }): { dados: DadosPedido; problemas: string[] } {
  const problemas: string[] = [];
  const itens: ItemPedido[] = [];
  for (const it of r.itens || []) {
    const p = cat.produtos.find(x => x.id === it.produto_id);
    if (!p) { problemas.push("Um dos produtos não está no seu cardápio"); continue; }
    const ops = opcoesDoProduto(p);
    let escolha = ops.length === 1 ? ops[0] : undefined;
    if (ops.length > 1) {
      escolha = ops.find(o => o.label.toLowerCase() === String(it.opcao || "").toLowerCase().trim())
        || ops.find(o => o.label.toLowerCase().startsWith(String(it.opcao || "").toLowerCase().trim()) && it.opcao);
      if (!escolha) problemas.push(`Escolha o tamanho de ${p.nome}: ${ops.map(o => o.label).join(", ")}`);
    }
    itens.push({
      ...(escolha ? { opcaoLabel: escolha.label, personalizacoes: escolha.pers } : {}),
      produto_id: p.id, nome_produto: p.nome, quantidade: Math.max(1, Math.round(Number(it.quantidade) || 1)),
      valor_unitario: escolha ? escolha.valor : precoDeVenda(p), // (11/10) com a promoção
      imagem_url: p.imagem_url, forma_venda: p.forma_venda, observacoes: String(it.observacoes || "").trim(),
    });
  }
  const c = r.cliente || null;
  let existente = c?.id ? cat.clientes.find(x => x.id === c.id) : null;
  // (11/10) Veio só o nome: antes de tratar como "cliente nova", procura uma cliente com esse nome
  // (sem diferenciar acento nem maiúscula). O cartão ainda completa a lista com a busca no banco.
  const nomeDito = nomeLimpo(c?.nome);
  let ambigua = false;
  if (!existente && nomeDito) {
    const iguais = cat.clientes.filter(x => nomeLimpo(x.nome) === nomeDito);
    if (iguais.length === 1) existente = iguais[0];
    else if (iguais.length > 1) ambigua = true, problemas.push(`Você tem mais de uma cliente chamada ${String(c?.nome).trim()}. Toque em Editar e escolha qual é`);
  }
  const nome = existente?.nome || String(c?.nome || "").trim();
  const e = r.endereco || {};
  const usarEndCliente = r.tipo_entrega === "entrega" && !e.rua && existente?.rua;
  const dados: DadosPedido = {
    tipo: r.tipo === "pronta_entrega" ? "pronta_entrega" : "encomenda",
    itens,
    semCliente: !nome,
    clienteId: existente?.id || null,
    clienteNome: nome,
    clienteTelefone: existente?.whatsapp || existente?.telefone || String(c?.telefone || ""),
    clienteNovo: !existente && !!nome && !ambigua, // várias com esse nome: ela escolhe no Editar, não nasce outra
    tipoEntrega: r.tipo_entrega === "entrega" ? "entrega" : "retirada",
    dataEntrega: /^\d{4}-\d{2}-\d{2}$/.test(String(r.data_entrega || "")) ? String(r.data_entrega) : "", // data fora do formato conta como "falta a data"
    horarioEntrega: r.horario_entrega || "",
    endereco: usarEndCliente
      ? { rua: existente!.rua || "", numero: existente!.numero || "", bairro: existente!.bairro || "", cidade: existente!.cidade || "", complemento: existente!.complemento || "" }
      : { rua: e.rua || "", numero: e.numero || "", bairro: e.bairro || "", cidade: e.cidade || "", complemento: e.complemento || "" },
    taxaEntrega: r2(Math.max(0, Number(r.taxa_entrega) || 0)),
    desconto: r2(Math.max(0, Number(r.desconto) || 0)),
    acrescimo: 0,
    formaPagamento: (FORMAS_PAGAMENTO as readonly string[]).includes(String(r.forma_pagamento)) ? String(r.forma_pagamento) : "PIX",
    situacaoPag: r.situacao === "parcial" || r.situacao === "fiado" || r.situacao === "na_entrega" ? r.situacao : "total",
    valorParcial: r2(Math.max(0, Number(r.valor_recebido) || 0)),
    dataPrevistaPagamento: r.data_prevista_pagamento || "",
    statusPedido: "agendado",
    observacoes: String(r.observacoes || "").trim(),
    origem: "doo",
  };
  return { dados, problemas: [...problemas, ...pendenciasPedido(dados)] };
}

/** Resumo do catálogo pras instruções da Doo (sem telefone nem endereço de cliente). */
export function catalogoParaDoo(cat: { produtos: ProdutoCat[]; clientes: ClienteCat[] }): string {
  const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const prods = cat.produtos.slice(0, TETO_PRODUTOS_DOO).map(p => {
    const ops = opcoesDoProduto(p);
    return `- ${p.id} · ${p.nome}${p.categoria ? ` (${p.categoria})` : ""} · ${ops.length ? "opções: " + ops.map(o => `${o.label} ${brl(o.valor)}`).join(" | ") : brl(precoDeVenda(p))}`;
  }).join("\n") || "- (nenhum produto cadastrado)";
  const clis = cat.clientes.slice(0, TETO_CLIENTES_DOO).map(c => `- ${c.id} · ${c.nome}`).join("\n") || "- (nenhuma cliente cadastrada)";
  return `Produtos do cardápio (id · nome · preço ou opções):\n${prods}\n\nClientes cadastradas (id · nome):\n${clis}`;
}

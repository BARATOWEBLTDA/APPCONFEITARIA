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

export const FORMAS_PAGAMENTO = ["PIX", "Dinheiro", "Crédito", "Débito"] as const;
export type SituacaoPag = "total" | "parcial" | "fiado" | "na_entrega";

export type ItemPedido = {
  produto_id?: string; nome_produto: string; quantidade: number; valor_unitario: number;
  imagem_url?: string; forma_venda?: string; observacoes: string; opcaoLabel?: string; personalizacoes?: any;
};

/** Tamanhos (P/M/G, pelo peso) ou kits do produto — igual à escolha da Nova venda. */
export function opcoesDoProduto(p: any): { label: string; valor: number; pers: any }[] {
  const gt = p?.grupo_tamanhos;
  if (gt?.ativo && Array.isArray(gt.opcoes)) {
    const porPeso = gt.modo_preco_tamanho === "por_peso";
    const ops = gt.opcoes.filter((o: any) => o?.nome?.trim()).map((o: any) => {
      const peso = pesoDoTamanho(o, porPeso); // (10/10) sem peso_kg, lê o peso do nome ("1,5kg")
      const valor = porPeso ? Math.round((p.preco_normal || 0) * peso * 100) / 100 : Number(o.preco) || 0;
      return { label: o.nome, valor, pers: { tamanho: { nome: o.nome, preco: valor, peso_kg: peso || null } } };
    }).filter((o: any) => o.valor > 0);
    if (ops.length) return ops;
  }
  const kq = p?.kit_qtd;
  if (kq?.ativo && Array.isArray(kq.kits) && kq.kits.length) {
    return kq.kits.filter((k: any) => (k.qtd || 0) > 0 && (k.preco || 0) > 0).map((k: any) => ({
      label: `${k.qtd} unidades`, valor: Number(k.preco), pers: { kit: { modo: "fechado", total: k.qtd, sabores: [] } },
    }));
  }
  return [];
}

export const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export type DadosPedido = {
  tipo: "encomenda" | "pronta_entrega";
  itens: ItemPedido[];
  semCliente: boolean;
  clienteId: string | null;
  clienteNome: string;
  clienteTelefone: string;
  /** cliente digitado que ainda não existe: cadastra em Clientes antes do pedido */
  clienteNovo: boolean;
  tipoEntrega: "retirada" | "entrega";
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

export const subtotalDe = (itens: ItemPedido[]) => itens.reduce((s, i) => s + (Number(i.valor_unitario) || 0) * (Number(i.quantidade) || 0), 0);
export const totalDe = (d: Pick<DadosPedido, "itens" | "tipoEntrega" | "taxaEntrega" | "desconto" | "acrescimo">) =>
  Math.max(0, subtotalDe(d.itens) + (d.tipoEntrega === "entrega" ? d.taxaEntrega : 0) - d.desconto + d.acrescimo);

/** O que ainda falta — as mesmas exigências das etapas da Nova venda. */
export function pendenciasPedido(d: DadosPedido): string[] {
  const p: string[] = [];
  if (!d.itens.length) p.push("Escolha pelo menos um produto");
  if (d.tipo === "encomenda" && !d.dataEntrega) p.push("Falta a data da entrega");
  if (d.tipoEntrega === "entrega" && !d.endereco.rua.trim()) p.push("Falta o endereço da entrega");
  if (d.situacaoPag === "parcial") {
    const total = totalDe(d);
    if (!(d.valorParcial > 0 && d.valorParcial < total)) p.push("O valor do sinal precisa ser maior que zero e menor que o total");
  }
  return p;
}

/** Salva o pedido — o corpo do "Finalizar venda" da Nova venda, agora num lugar só. */
export async function criarPedido(userId: string, d: DadosPedido): Promise<{ ok: true; pedido: any; aviso?: string } | { ok: false; erro: string }> {
  const total = totalDe(d);
  const subtotal = subtotalDe(d.itens);
  let status: string = d.statusPedido || "agendado";
  let statusPag = "pago";
  let valorRecebido = total;
  if (d.tipo === "pronta_entrega" && d.tipoEntrega === "retirada") status = "entregue";
  if (d.situacaoPag === "fiado" || d.situacaoPag === "na_entrega") { statusPag = "pendente"; valorRecebido = 0; }
  else if (d.situacaoPag === "parcial") { statusPag = "parcial"; valorRecebido = d.valorParcial; }

  let clienteIdFinal = d.clienteId;
  if (!d.semCliente && !d.clienteId && d.clienteNovo && d.clienteNome.trim()) {
    const end: any = d.tipoEntrega === "entrega" ? { rua: d.endereco.rua || null, numero: d.endereco.numero || null, bairro: d.endereco.bairro || null, cidade: d.endereco.cidade || null, complemento: d.endereco.complemento || null } : {};
    const { data: cliNovo, error: errCli } = await supabase.from("clientes")
      .insert({ user_id: userId, nome: d.clienteNome.trim(), whatsapp: d.clienteTelefone.trim() || null, ...end })
      .select("id").single();
    if (!errCli && (cliNovo as any)?.id) clienteIdFinal = (cliNovo as any).id;
    else console.error("Não deu pra cadastrar o cliente novo:", errCli);
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
    desconto: d.desconto,
    acrescimo: d.acrescimo, // (10/10) antes só entrava no total: ao editar o pedido, o acréscimo sumia
    taxa_entrega: d.tipoEntrega === "entrega" ? d.taxaEntrega : 0,
    forma_pagamento: d.formaPagamento,
    tipo_entrega: d.tipoEntrega,
    data_entrega: d.tipo === "encomenda" ? d.dataEntrega : hojeISO(),
    horario_entrega: d.tipo === "encomenda" ? d.horarioEntrega : null,
    endereco_rua: d.endereco.rua,
    endereco_numero: d.endereco.numero,
    endereco_bairro: d.endereco.bairro,
    endereco_cidade: d.endereco.cidade,
    endereco_complemento: d.endereco.complemento,
    origem: d.origem || "manual",
    tipo_venda: d.tipo,
    observacoes: d.observacoes,
    data_prevista_pagamento: d.situacaoPag === "fiado" ? (d.dataPrevistaPagamento || null)
      : d.situacaoPag === "na_entrega" ? (d.tipo === "encomenda" ? d.dataEntrega || null : hojeISO()) : null,
  };
  let { data: novoPedido, error } = await supabase.from("pedidos").insert(linhaPedido).select().single();
  if (error && /acrescimo/i.test(error.message || "")) {
    // a coluna "acrescimo" não existe nessa conta: grava sem ela (mesmo plano B do Editar pedido)
    const { acrescimo: _semColuna, ...semAcrescimo } = linhaPedido;
    ({ data: novoPedido, error } = await supabase.from("pedidos").insert(semAcrescimo).select().single());
  }
  if (error || !novoPedido) return { ok: false, erro: error?.message || "desconhecido" };

  const itensInsert = d.itens.map(it => ({
    pedido_id: (novoPedido as any).id,
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
  if (errItens) console.error("Erro ao inserir itens:", errItens);

  supabase.from("pedido_historico").insert({
    pedido_id: (novoPedido as any).id, user_id: userId, evento: "Pedido criado",
    descricao: `Pedido ${d.tipo === "pronta_entrega" ? "de pronta entrega" : "de encomenda"} registrado ${d.origem === "doo" ? "pela Doo IA" : "manualmente"}`,
  }).then(() => {}, () => {});

  // Financeiro · Passo 1: o recebido do pedido vira uma linha em "pagamentos" (com forma e data).
  // O pedido já nasceu com o valor certo, então sem a tabela (SQL não rodado) não grava nada a mais.
  const avisos: string[] = [];
  if (errItens) avisos.push("Pedido salvo, mas os produtos falharam: " + errItens.message);
  if (valorRecebido > 0) {
    const pg = await registrarPagamento({
      pedidoId: (novoPedido as any).id, userId, valor: valorRecebido, forma: d.formaPagamento,
      tipo: statusPag === "pago" ? "total" : "sinal", origem: d.origem === "doo" ? "doo" : "app", pedidoJaTemOValor: true,
    });
    if (!pg.ok) {
      // (10/10) o recebimento não gravou: o pedido não pode ficar "pago" sem dinheiro no caixa.
      // O pedido passa a mostrar o que está gravado de verdade (a soma dos recebimentos dele, em geral zero)
      // e a tela avisa; o pedido não se perde.
      const pid = (novoPedido as any).id;
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
  return { ok: true, pedido: novoPedido, ...(avisos.length ? { aviso: avisos.join(" ") } : {}) };
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
    return { ok: false, estornou: false, erro: explicarErro(errPag, "Não deu pra conferir os recebimentos deste pedido, então ele não foi excluído. Tente de novo.") };
  }
  let estornou = false;
  if (!errPag && (ativos || []).length > 0) {
    const r = await ajustarRecebido({ pedidoId, alvo: 0 }); // alvo zero = estorna todos os ativos (nada é apagado)
    if (!r.ok) return { ok: false, estornou: true, erro: "Não deu pra estornar os recebimentos deste pedido, então ele não foi excluído. Confira os pagamentos do pedido e tente de novo." };
    estornou = true;
    // marca que o estorno veio da exclusão (não é devolução de dinheiro): o saldo em caixa informado antes não mexe por isso
    const { error: errMarca } = await supabase.from("pagamentos").update({ observacao: ESTORNO_POR_EXCLUSAO }).in("id", (ativos as any[]).map(a => a.id));
    if (errMarca) console.error("[Doonly] marca do estorno por exclusão:", errMarca);
  }
  const depoisDoEstorno = estornou ? " Os recebimentos dele já foram estornados." : "";
  // 2) itens (antes o erro daqui era ignorado)
  const { error: errItens } = await supabase.from("pedido_itens").delete().eq("pedido_id", pedidoId);
  if (errItens) return { ok: false, estornou, erro: explicarErro(errItens, "Não deu pra excluir o pedido. Tente de novo.") + depoisDoEstorno };
  // 3) o pedido
  const { error } = await supabase.from("pedidos").delete().eq("id", pedidoId);
  if (error) return { ok: false, estornou, erro: explicarErro(error, "Não deu pra excluir o pedido. Tente de novo.") + depoisDoEstorno };
  return { ok: true };
}

/* ── Doo IA: catálogo, clientes e o rascunho que ela prepara ─────────────── */
export type ProdutoCat = { id: string; nome: string; preco_normal: number; forma_venda?: string; imagem_url?: string; categoria?: string; grupo_tamanhos?: any; kit_qtd?: any };
export type ClienteCat = { id: string; nome: string; telefone?: string; whatsapp?: string; rua?: string; numero?: string; bairro?: string; cidade?: string; complemento?: string };

export async function listarCatalogo(uid: string): Promise<{ produtos: ProdutoCat[]; clientes: ClienteCat[]; taxaPadrao: number }> {
  const [p, c] = await Promise.all([
    supabase.from("produtos").select("id,nome,preco_normal,forma_venda,imagem_url,categoria,grupo_tamanhos,kit_qtd,disponivel").eq("user_id", uid).order("nome"),
    supabase.from("clientes").select("id,nome,telefone,whatsapp,rua,numero,bairro,cidade,complemento").eq("user_id", uid).order("nome").limit(300),
  ]);
  return { produtos: ((p.data as any[]) || []).filter(x => x.disponivel !== false), clientes: (c.data as any[]) || [], taxaPadrao: 0 };
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
      valor_unitario: escolha ? escolha.valor : Number(p.preco_normal) || 0,
      imagem_url: p.imagem_url, forma_venda: p.forma_venda, observacoes: String(it.observacoes || "").trim(),
    });
  }
  const c = r.cliente || null;
  const existente = c?.id ? cat.clientes.find(x => x.id === c.id) : null;
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
    clienteNovo: !existente && !!nome,
    tipoEntrega: r.tipo_entrega === "entrega" ? "entrega" : "retirada",
    dataEntrega: r.data_entrega || "",
    horarioEntrega: r.horario_entrega || "",
    endereco: usarEndCliente
      ? { rua: existente!.rua || "", numero: existente!.numero || "", bairro: existente!.bairro || "", cidade: existente!.cidade || "", complemento: existente!.complemento || "" }
      : { rua: e.rua || "", numero: e.numero || "", bairro: e.bairro || "", cidade: e.cidade || "", complemento: e.complemento || "" },
    taxaEntrega: Math.max(0, Number(r.taxa_entrega) || 0),
    desconto: Math.max(0, Number(r.desconto) || 0),
    acrescimo: 0,
    formaPagamento: (FORMAS_PAGAMENTO as readonly string[]).includes(String(r.forma_pagamento)) ? String(r.forma_pagamento) : "PIX",
    situacaoPag: r.situacao === "parcial" || r.situacao === "fiado" || r.situacao === "na_entrega" ? r.situacao : "total",
    valorParcial: Math.max(0, Number(r.valor_recebido) || 0),
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
  const prods = cat.produtos.slice(0, 120).map(p => {
    const ops = opcoesDoProduto(p);
    return `- ${p.id} · ${p.nome}${p.categoria ? ` (${p.categoria})` : ""} · ${ops.length ? "opções: " + ops.map(o => `${o.label} ${brl(o.valor)}`).join(" | ") : brl(Number(p.preco_normal) || 0)}`;
  }).join("\n") || "- (nenhum produto cadastrado)";
  const clis = cat.clientes.slice(0, 300).map(c => `- ${c.id} · ${c.nome}`).join("\n") || "- (nenhuma cliente cadastrada)";
  return `Produtos do cardápio (id · nome · preço ou opções):\n${prods}\n\nClientes cadastradas (id · nome):\n${clis}`;
}

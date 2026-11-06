// ── gerarPedidoPDF.ts ────────────────────────────────────────────────────────
// Comprovante do pedido / da venda no modelo padrão de PDF do Doonly (03/11: estilo de sistema).
// Usado em Pedidos, Editar pedido e Nova venda. Grátis pra todos.
// ─────────────────────────────────────────────────────────────────────────────
import { gerarDocumento, abrirJanela, esc, brl, dataBR, card, kv, telBR, diaLongo } from "@/lib/pdfDoonly";
import { nomeExtra } from "@/lib/kitTexto";
import { formaDoItem, qtdCurta, recebidoPedido, saldoPedido, tamanhoDoItem } from "@/components/pedidos/pedidoTexto";
import { r2, somarReais } from "@/lib/moeda";
import type { ExtraEscolhido } from "@/lib/kitTexto";

/** Opção escolhida: o nome (formato antigo) ou a opção com nome */
type NomeOuOpcao = string | { nome?: string } | null | undefined;
/** As escolhas gravadas no item (os dois formatos que o app grava) */
type PersonalizacoesPDF = {
  sabor?: NomeOuOpcao; massa?: NomeOuOpcao; recheios?: NomeOuOpcao[]; recheio?: NomeOuOpcao; cobertura?: NomeOuOpcao;
  tamanho?: { nome?: string; peso_kg?: number | null } | null;
  kit?: { sabores?: { nome: string; qtd: number }[] } | null;
  extras?: ExtraEscolhido[];
};

type PedidoItemPDF = {
  nome_produto?: string;
  quantidade?: number;
  valor_unitario?: number;
  observacoes?: string | null;
  personalizacoes?: PersonalizacoesPDF | null;
  forma_venda?: string | null;
  produtos?: { forma_venda?: string | null } | null;
};

export type PedidoPDF = {
  id: string;
  numero?: number | null;
  retirado_por?: string | null;
  cliente_nome?: string | null;
  cliente_telefone?: string | null;
  status?: string | null;
  status_pagamento?: string | null;
  tipo_entrega?: string | null;
  tipo_venda?: string | null;
  data_entrega?: string | null;
  horario_entrega?: string | null;
  endereco_rua?: string | null;
  endereco_numero?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  endereco_complemento?: string | null;
  valor_total?: number | null;
  valor_produtos?: number | null;
  valor_recebido?: number | null;
  desconto?: number | null;
  acrescimo?: number | null;
  taxa_entrega?: number | null;
  forma_pagamento?: string | null;
  observacoes?: string | null;
  data_prevista_pagamento?: string | null;
  origem?: string | null;
  cupom_codigo?: string | null;
  cupom_desconto?: number | null;
  created_at?: string | null;
  pedido_itens?: PedidoItemPDF[];
};

const PAGAMENTO: Record<string, string> = { pix: "Pix", PIX: "Pix", dinheiro: "Dinheiro", credito: "Cartão de crédito", debito: "Cartão de débito", cartao: "Cartão", link_pagamento: "Link de pagamento", mercado_pago: "Mercado Pago", pagamento_retirada: "Na retirada", boleto: "Boleto" };

/** Escolhas do item (tamanho, massa, recheios, cobertura, kit, adicionais) numa linha. */
export function escolhas(pz: PersonalizacoesPDF | null | undefined): string {
  if (!pz || typeof pz !== "object") return "";
  const nome = (v: NomeOuOpcao) => (!v ? "" : typeof v === "string" ? v : v.nome || "");
  const p: string[] = [];
  // (11/10) mesmo texto do resto do app: pelo peso sai "M (2 kg)"
  const tam = tamanhoDoItem({ personalizacoes: pz });
  if (tam) p.push(`Tamanho ${tam}`);
  if (nome(pz.sabor)) p.push(`Sabor ${nome(pz.sabor)}`);
  if (nome(pz.massa)) p.push(`Massa ${nome(pz.massa)}`);
  const rec = Array.isArray(pz.recheios) ? pz.recheios.map(nome).filter(Boolean).join(" e ") : nome(pz.recheio);
  if (rec) p.push(`Recheio ${rec}`);
  if (nome(pz.cobertura)) p.push(`Cobertura ${nome(pz.cobertura)}`);
  if (pz.kit?.sabores?.length) p.push(pz.kit.sabores.map((x) => `${x.nome} × ${x.qtd}`).join(" · "));
  if (Array.isArray(pz.extras) && pz.extras.length) p.push(`Adicionais: ${pz.extras.map((x) => nomeExtra(x)).filter(Boolean).join(", ")}`);
  return p.join(" · ");
}

export async function gerarPedidoPDF(pedido: PedidoPDF, janelaAberta?: Window | null): Promise<void> {
  const janela = janelaAberta ?? abrirJanela(); // abre já no clique (senão o navegador bloqueia)
  await gerarDocumento(() => {
    const prontaEntrega = pedido.tipo_venda === "pronta_entrega";
    const entrega = pedido.tipo_entrega === "entrega";
    const itens = pedido.pedido_itens || [];
    // (11/10) cada linha arredondada pra centavos antes de somar (1,5 kg × R$ 44,91 não vira 67,365)
    const subtotal = pedido.valor_produtos ?? somarReais(itens.map(it => (Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 1)));
    const total = Number(pedido.valor_total) || 0;
    // (11/10) pedido cancelado não cobra: o que entrou e o que falta saem da mesma conta da lista
    const cancelado = pedido.status === "cancelado";
    const recebido = recebidoPedido(pedido);
    const falta = saldoPedido(pedido);
    const sep = "<i>·</i>";

    // ── Cliente e entrega (03/11: cada dado numa linha, na largura toda) ──
    const tel = telBR(pedido.cliente_telefone);
    const nomeCli = (pedido.cliente_nome || "").trim();
    const linhaCliente = nomeCli || tel ? [esc(nomeCli || "Sem nome"), tel ? esc(tel) : ""].filter(Boolean).join(sep) : "";
    const endereco = [[pedido.endereco_rua, pedido.endereco_numero].filter(Boolean).join(", "), pedido.endereco_complemento, [pedido.endereco_bairro, pedido.endereco_cidade].filter(Boolean).join(", ")]
      .map(x => String(x || "").trim()).filter(Boolean);
    // (10/10) cada parte passa pelo esc(): o endereço é digitado pela cliente no cardápio
    const linhaEndereco = endereco.length ? [esc(endereco.slice(0, 2).join(", ")), endereco[2] ? esc(endereco[2]) : ""].filter(Boolean).join(sep) : "";
    const quando = diaLongo(pedido.data_entrega, pedido.horario_entrega);
    // (6.175) pronta entrega levada até a cliente: mostra o endereço como na encomenda
    const blocoCliente = prontaEntrega && !entrega
      ? (linhaCliente ? card("Cliente", kv([["Cliente", linhaCliente]])) : "")
      : card(entrega ? "Cliente e entrega" : "Cliente e retirada", kv([
          ["Cliente", linhaCliente || "Sem cliente"],
          [entrega ? "Entrega" : "Retirada", [esc(quando || "Data a combinar"), entrega ? "Entregar no endereço" : "Retirar na loja"].join(sep)],
          ["Endereço", entrega ? (linhaEndereco || "Não informado") : ""],
          ["Retirado por", !entrega && pedido.retirado_por ? esc(pedido.retirado_por) : ""],
        ]));
    const obsPedido = (pedido.observacoes || "").trim();
    const blocoObs = obsPedido ? card("Observações", `<p class="ob">${esc(obsPedido)}</p>`) : "";

    // ── Itens: nº, nome com as escolhas embaixo e o recado do item em destaque ──
    const linhas = itens.map((it, i) => {
      const q = Number(it.quantidade) || 1, u = Number(it.valor_unitario) || 0;
      // (11/10) kg só no peso livre; bolo com tamanho ou kit conta em unidades (formaDoItem já decide)
      const forma = formaDoItem(it);
      const det = escolhas(it.personalizacoes);
      const rec = (it.observacoes || "").trim();
      return `<tr><td class="n">${i + 1}</td><td><b>${esc(it.nome_produto || "Item")}</b>${det ? `<small>${esc(det)}</small>` : ""}${rec ? `<small class="rc"><b>Recado:</b> ${esc(rec)}</small>` : ""}</td>`
        + `<td class="c">${esc(qtdCurta(q, forma).replace(/x$/, ""))}</td><td class="r">${brl(u)}${forma === "kg" ? "/kg" : ""}</td><td class="r">${brl(r2(q * u))}</td></tr>`;
    });
    // os 2 últimos itens descem junto com os totais (o total nunca fica sozinho numa página)
    const tabela = `<table class="tb"><thead><tr><th>#</th><th>Item</th><th class="c qt">Quantidade</th><th class="r">Unit.</th><th class="r">Total</th></tr></thead><tbody>`
      + (linhas.length ? linhas.map((l, i) => i >= linhas.length - 2 && i > 0 ? l.replace("<tr>", '<tr class="fim">') : l).join("") : `<tr><td colspan="5" class="vazio">Sem itens</td></tr>`)
      + `</tbody></table>`;

    // ── Pagamento: forma, quanto entrou e quanto falta (e quando) ──
    const forma = PAGAMENTO[pedido.forma_pagamento || ""] || pedido.forma_pagamento || "";
    const quandoPaga = pedido.data_prevista_pagamento ? `até ${dataBR(pedido.data_prevista_pagamento)}` : prontaEntrega && !entrega ? "" : entrega ? "na entrega" : "na retirada";
    const linhasPag: [string, string][] = ([
      ["Forma", esc(forma)],
      ["Situação", cancelado ? `<span class="neg">Pedido cancelado</span>` : ""],
      ["Recebido", !cancelado && recebido > 0.009 ? brl(recebido) : ""],
      [recebido > 0.009 ? "Restante" : "A receber", !cancelado && falta > 0.009 ? `${brl(falta)}${quandoPaga ? ` ${quandoPaga}` : ""}` : ""],
    ] as [string, string][]).filter(([, v]) => v);
    const pagamento = card("Pagamento", linhasPag.length ? kv(linhasPag) : `<p class="vazio">Sem pagamento registrado.</p>`);

    const taxa = entrega ? Number(pedido.taxa_entrega) || 0 : 0;
    const desc = Number(pedido.desconto) || 0, acr = Number(pedido.acrescimo) || 0;
    const totais = `<div class="tot">
      <div><span>Subtotal</span><b>${brl(subtotal)}</b></div>
      ${taxa ? `<div><span>Taxa de entrega</span><b>${brl(taxa)}</b></div>` : ""}
      ${acr ? `<div><span>Acréscimo</span><b>${brl(acr)}</b></div>` : ""}
      ${(() => {
        // (6.175) cupom e desconto manual em linhas separadas (o banco guarda os dois somados em "desconto")
        const cup = pedido.cupom_codigo ? Math.min(Number((pedido as { cupom_desconto?: number | null }).cupom_desconto) || desc, desc) : 0;
        const man = r2(desc - cup);
        return (cup > 0.009 ? `<div><span>Cupom ${esc(pedido.cupom_codigo)}</span><b class="neg">− ${brl(cup)}</b></div>` : "")
          + (man > 0.009 ? `<div><span>Desconto</span><b class="neg">− ${brl(man)}</b></div>` : "");
      })()}
      <div class="tt"><span>Total</span><b>${brl(total)}</b></div>
      ${!cancelado && falta > 0.009 ? `<div class="rest"><span>Falta receber</span><b>${brl(falta)}</b></div>` : ""}
    </div>`;

    const corpo = `${blocoCliente}${blocoObs}${tabela}<div class="g2 lado fim">${pagamento}${totais}</div>${prontaEntrega ? `<p class="thx">Agradecemos a preferência!</p>` : ""}`;
    const feito = pedido.created_at ? new Date(pedido.created_at) : new Date();
    const tipo = prontaEntrega ? "Venda" : "Pedido";
    const numero = pedido.numero != null ? `#${pedido.numero}` : "";
    return {
      // (03/11) é o nome do arquivo ao salvar: "Pedido #148"
      titulo: numero ? `${tipo} ${numero}` : tipo,
      tipo,
      numero: numero || "#—",
      sub: prontaEntrega ? feito.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", " às") : `Feito em ${feito.toLocaleDateString("pt-BR")}`,
      corpo,
    };
  }, janela);
}

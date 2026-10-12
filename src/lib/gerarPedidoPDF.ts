// ── gerarPedidoPDF.ts ────────────────────────────────────────────────────────
// Comprovante do pedido / da venda no modelo padrão de PDF do Doonly (02/10).
// Usado em Pedidos, Editar pedido e Nova venda. Grátis pra todos.
// ─────────────────────────────────────────────────────────────────────────────
import { gerarDocumento, abrirJanela, esc, brl, dataBR, card, kv, pill } from "@/lib/pdfDoonly";
import { formaDoItem, qtdCurta, saldoPedido, tamanhoDoItem } from "@/components/pedidos/pedidoTexto";
import { r2, somarReais } from "@/lib/moeda";

type PedidoItemPDF = {
  nome_produto?: string;
  quantidade?: number;
  valor_unitario?: number;
  observacoes?: string | null;
  personalizacoes?: any;
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
  created_at?: string | null;
  pedido_itens?: PedidoItemPDF[];
};

const STATUS: Record<string, string> = {
  aguardando_pagamento: "Aguardando pagamento", aguardando_aceite: "Aguardando aceite", novo: "Aguardando aceite", pendente: "Aguardando aceite",
  agendado: "Agendado", confirmado: "Agendado", em_producao: "Em produção", em_preparo: "Em produção", finalizado: "Pronto", pronto: "Pronto",
  aguardando_retirada: "Pronto pra retirar", em_entrega: "Saiu pra entrega", a_caminho: "Saiu pra entrega", entregue: "Entregue", concluido: "Entregue", cancelado: "Cancelado",
};
const PAGAMENTO: Record<string, string> = { pix: "Pix", PIX: "Pix", dinheiro: "Dinheiro", credito: "Cartão de crédito", debito: "Cartão de débito", cartao: "Cartão", link_pagamento: "Link de pagamento", mercado_pago: "Mercado Pago", pagamento_retirada: "Na retirada", boleto: "Boleto" };

/** Escolhas do item (tamanho, massa, recheios, cobertura, kit, adicionais) numa linha. */
function escolhas(pz: any): string {
  if (!pz || typeof pz !== "object") return "";
  const nome = (v: any) => (!v ? "" : typeof v === "string" ? v : v.nome || "");
  const p: string[] = [];
  // (11/10) mesmo texto do resto do app: pelo peso sai "M (2 kg)"
  const tam = tamanhoDoItem({ personalizacoes: pz });
  if (tam) p.push(`Tamanho ${tam}`);
  if (nome(pz.sabor)) p.push(`Sabor ${nome(pz.sabor)}`);
  if (nome(pz.massa)) p.push(`Massa ${nome(pz.massa)}`);
  const rec = Array.isArray(pz.recheios) ? pz.recheios.map(nome).filter(Boolean).join(" e ") : nome(pz.recheio);
  if (rec) p.push(`Recheio ${rec}`);
  if (nome(pz.cobertura)) p.push(`Cobertura ${nome(pz.cobertura)}`);
  if (pz.kit?.sabores?.length) p.push(pz.kit.sabores.map((x: any) => `${x.nome} × ${x.qtd}`).join(" · "));
  if (Array.isArray(pz.extras) && pz.extras.length) p.push(`Adicionais: ${pz.extras.map(nome).filter(Boolean).join(", ")}`);
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
    const recebido = Number(pedido.valor_recebido) || 0;
    const sp = pedido.status_pagamento || "pendente";
    // (11/10) pedido cancelado não cobra: o que falta sai da mesma conta da lista (saldoPedido)
    const cancelado = pedido.status === "cancelado";
    const falta = saldoPedido(pedido);
    const situacao = cancelado ? pill("Cancelado", "rd") : sp === "pago" ? pill("Pago", "ok") : sp === "parcial" ? pill("Sinal pago", "am") : pill("A receber", "rd");

    const cliente = card("Cliente", kv([
      ["Nome", esc(pedido.cliente_nome || "Venda avulsa")],
      ["WhatsApp", esc(pedido.cliente_telefone || "")],
    ]));
    // (10/10) cada parte passa pelo esc(): o endereço é digitado pela cliente no cardápio e entrava cru no HTML do PDF
    const endereco = [[pedido.endereco_rua, pedido.endereco_numero].filter(Boolean).join(", "), pedido.endereco_complemento, [pedido.endereco_bairro, pedido.endereco_cidade].filter(Boolean).join(" · ")].filter(Boolean).map(x => esc(String(x))).join("<br>");
    const quando = [pedido.data_entrega ? new Date(pedido.data_entrega + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }) : "", pedido.horario_entrega ? String(pedido.horario_entrega).slice(0, 5) : ""].filter(Boolean).join(" · ");
    const blocoEntrega = card(prontaEntrega ? "Pagamento" : "Entrega", prontaEntrega
      ? kv([["Forma", esc(PAGAMENTO[pedido.forma_pagamento || ""] || pedido.forma_pagamento || "")], ["Situação", situacao]])
      : kv([["Quando", esc(quando)], ["Como", entrega ? "Entrega" : "Retirada"], ["Endereço", entrega ? endereco : ""], ["Retirado por", !entrega && pedido.retirado_por ? esc(pedido.retirado_por) : ""]]));

    const linhas = itens.length
      ? itens.map(it => {
          const q = Number(it.quantidade) || 1, u = Number(it.valor_unitario) || 0;
          // (11/10) kg só no peso livre; bolo com tamanho ou kit conta em unidades (formaDoItem já decide)
          const forma = formaDoItem(it);
          const det = [escolhas(it.personalizacoes), it.observacoes ? `Obs.: ${it.observacoes}` : ""].filter(Boolean).join(" · ");
          return `<tr><td><b>${esc(it.nome_produto)}</b>${det ? `<small>${esc(det)}</small>` : ""}</td><td class="c">${esc(qtdCurta(q, forma).replace(/x$/, ""))}</td><td class="r">${brl(u)}${forma === "kg" ? " /kg" : ""}</td><td class="r">${brl(r2(q * u))}</td></tr>`;
        }).join("")
      : `<tr><td colspan="4" class="vazio">Sem itens</td></tr>`;
    const tabela = card(prontaEntrega ? "Itens" : "Itens do pedido", `<table class="tb"><tr><th>Item</th><th class="c">Qtd</th><th class="r">Unit.</th><th class="r">Total</th></tr>${linhas}</table>`);

    const taxa = entrega ? Number(pedido.taxa_entrega) || 0 : 0;
    const desc = Number(pedido.desconto) || 0, acr = Number(pedido.acrescimo) || 0;
    const totais = `<div class="tot">
      <div><span>Subtotal</span><b>${brl(subtotal)}</b></div>
      ${taxa ? `<div><span>Frete</span><b>${brl(taxa)}</b></div>` : ""}
      ${acr ? `<div><span>Acréscimo</span><b>${brl(acr)}</b></div>` : ""}
      ${desc ? `<div><span>${pedido.cupom_codigo ? `Cupom ${esc(pedido.cupom_codigo)}` : "Desconto"}</span><b class="neg">− ${brl(desc)}</b></div>` : ""}
      <div class="tt"><span>Total</span><b>${brl(total)}</b></div>
      ${cancelado ? `<div class="rest"><span>Situação</span><b>Cancelado</b></div>` : falta > 0.009 ? `<div class="rest"><span>Falta receber</span><b>${brl(falta)}</b></div>` : ""}
    </div>`;
    const pagamento = prontaEntrega ? "<div></div>" : card("Pagamento", kv([
      ["Forma", esc(PAGAMENTO[pedido.forma_pagamento || ""] || pedido.forma_pagamento || "")],
      ["Situação", situacao],
      ["Recebido", sp === "parcial" ? brl(recebido) : ""],
      ["Pagar até", !cancelado && falta > 0.009 && pedido.data_prevista_pagamento ? esc(dataBR(pedido.data_prevista_pagamento)) : ""],
    ]) + (pedido.observacoes ? `<p class="obs">Obs.: ${esc(pedido.observacoes)}</p>` : ""));

    const corpo = `<div class="g2">${cliente}${blocoEntrega}</div>${tabela}<div class="g2">${pagamento}${totais}</div>${prontaEntrega ? `<p class="thx">Obrigada pela preferência!</p>` : ""}`;
    const feito = pedido.created_at ? new Date(pedido.created_at) : new Date();
    return {
      titulo: `${prontaEntrega ? "Venda" : "Pedido"} #${pedido.numero ?? ""}`,
      tipo: prontaEntrega ? "Venda" : "Pedido",
      numero: `#${pedido.numero ?? "—"}`,
      sub: prontaEntrega ? feito.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", " ·") : `Feito em ${feito.toLocaleDateString("pt-BR")}`,
      tag: prontaEntrega ? "Pronta entrega" : ((STATUS[pedido.status || ""] === "Entregue" && pedido.tipo_entrega !== "entrega") ? "Retirado" : (STATUS[pedido.status || ""] || "")),
      corpo,
    };
  }, janela);
}

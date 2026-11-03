// ── gerarOrcamentoPDF.ts ─────────────────────────────────────────────────────
// Orçamento em PDF no modelo padrão do Doonly (03/11: estilo de sistema, o mesmo do
// pedido). Usado no Baixar PDF do orçamento (OrcamentoEditar). Recurso do PRO.
// ─────────────────────────────────────────────────────────────────────────────
import { gerarDocumento, abrirJanela, esc, brl, dataBR, card, kv, telBR, diaLongo, type Loja } from "@/lib/pdfDoonly";
import { FORMA_ORC, hojeISO, somarItens, totalOrcamento, valorSinal, type Orcamento } from "@/lib/orcamentos";

const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const qtdBR = (q: number) => String(Math.round((Number(q) || 0) * 1000) / 1000).replace(".", ",");

/** `o` já com os extras que valem agora (desconto, acréscimo e entrega ligados ou não). */
/** `loja`: só na página pública do link (sem login); no app ela é lida do perfil. */
export async function gerarOrcamentoPDF(o: Orcamento, janelaAberta?: Window | null, loja?: Loja): Promise<void> {
  const janela = janelaAberta ?? abrirJanela(); // abre já no clique (senão o navegador bloqueia)
  await gerarDocumento((lj) => {
    const entrega = o.tipo_entrega === "entrega";
    const itens = o.itens || [];
    const subtotal = somarItens(itens);
    const total = totalOrcamento(o);
    const sinal = valorSinal(o, total);
    const sep = "<i>·</i>";

    // ── Mensagem e cliente/evento ──
    const msg = (o.mensagem || "").trim();
    const blocoMsg = msg ? card("Mensagem", `<p class="ob">${esc(msg)}</p>`) : "";
    const tel = telBR(o.cliente_telefone);
    const cli = [esc((o.cliente_nome || "").trim()), tel ? esc(tel) : ""].filter(Boolean).join(sep);
    const pessoas = Number(o.pessoas) || 0;
    const blocoCli = card("Cliente e evento", kv([
      ["Cliente", cli],
      ["Evento", esc((o.nome_evento || "").trim() || (o.ocasiao || "").trim())],
      ["Data", esc(diaLongo(o.data_evento))],
      ["Pessoas", pessoas ? `${pessoas} pessoa${pessoas > 1 ? "s" : ""}` : ""],
      ["Local", esc((o.local_evento || "").trim())],
      [entrega ? "Entrega" : "Retirada", entrega ? "Entregar no local" : "Retirar na loja"],
    ]));

    // ── Itens: nº, nome com o detalhe embaixo, quantidade, unitário e total ──
    const linhas = itens.map((it, i) => {
      const q = Number(it.quantidade) || 0, u = Number(it.valor_unitario) || 0;
      const det = (it.detalhe || "").trim();
      return `<tr><td class="n">${i + 1}</td><td><b>${esc(it.nome || "Item")}</b>${det ? `<small>${esc(det)}</small>` : ""}</td><td class="c">${qtdBR(q)}</td><td class="r">${brl(u)}</td><td class="r">${brl(r2(q * u))}</td></tr>`;
    });
    // os 2 últimos itens descem junto com os totais (o total nunca fica sozinho numa página)
    const tabela = `<table class="tb"><thead><tr><th>#</th><th>Item</th><th class="c qt">Quantidade</th><th class="r">Unit.</th><th class="r">Total</th></tr></thead><tbody>`
      + (linhas.length ? linhas.map((l, i) => i >= linhas.length - 2 && i > 0 ? l.replace("<tr>", '<tr class="fim">') : l).join("") : `<tr><td colspan="5" class="vazio">Sem itens</td></tr>`)
      + `</tbody></table>`;

    // ── Condições: forma, sinal para reservar, restante e validade ──
    const forma = FORMA_ORC[o.forma_pagamento || ""] || "";
    const quando = entrega ? "na entrega" : "na retirada";
    const pares: [string, string][] = [["Forma", esc(forma)]];
    if (o.sinal_tipo === "total" && total > 0) pares.push(["Pagamento", `${brl(total)} para reservar a data`]);
    else if (sinal > 0.009) {
      pares.push(["Sinal", `${brl(sinal)}${o.sinal_tipo === "50" ? " (50%)" : ""} para reservar a data`]);
      if (total - sinal > 0.009) pares.push(["Restante", `${brl(r2(total - sinal))} ${quando}`]);
    } else if (total > 0) pares.push(["Pagamento", o.forma_pagamento === "combinar" ? "Combinado com a loja" : `${brl(total)} ${quando}`]);
    const condicoes = card("Condições", kv(pares.filter(([, v]) => v)));

    const desc = Number(o.desconto) || 0, acr = Number(o.acrescimo) || 0, taxa = entrega ? Number(o.taxa_entrega) || 0 : 0;
    const totais = `<div class="tot">
      <div><span>Subtotal</span><b>${brl(subtotal)}</b></div>
      ${entrega ? `<div><span>Entrega</span><b>${taxa > 0 ? brl(taxa) : "Grátis"}</b></div>` : ""}
      ${acr ? `<div><span>Acréscimo</span><b>${brl(acr)}</b></div>` : ""}
      ${desc ? `<div><span>Desconto</span><b class="neg">− ${brl(desc)}</b></div>` : ""}
      <div class="tt"><span>Total</span><b>${brl(total)}</b></div>
    </div>`;

    // (03/11) espaço pra carimbo e assinatura da loja e o "de acordo" da cliente (orçamento impresso e assinado)
    const assinaturas = `<div class="ass fim"><div><span></span><b>${esc(lj.nome)}</b><small>Carimbo e assinatura</small></div>`
      + `<div><span></span><b>${esc((o.cliente_nome || "").trim() || "Cliente")}</b><small>De acordo · Data: ____/____/______</small></div></div>`;
    const feito = o.created_at ? new Date(o.created_at) : new Date();
    const numero = o.numero ? `#${o.numero}` : "";
    return {
      // é o nome do arquivo ao salvar: "Orçamento #27"
      titulo: numero ? `Orçamento ${numero}` : "Orçamento",
      tipo: "Orçamento",
      numero: numero || "#—",
      // (03/11) a validade em destaque no topo, embaixo de quando foi feito
      sub: `Feito em ${feito.toLocaleDateString("pt-BR")}`,
      // vencido: avisa em vez de prometer uma validade que já passou
      destaque: !o.validade ? "" : String(o.validade).slice(0, 10) < hojeISO() ? `Venceu em ${dataBR(o.validade)}` : `Válido até ${dataBR(o.validade)}`,
      alerta: !!o.validade && String(o.validade).slice(0, 10) < hojeISO(),
      corpo: `${blocoMsg}${blocoCli}${tabela}<div class="g2 lado fim">${condicoes}${totais}</div>${assinaturas}`,
    };
  }, janela, loja);
}

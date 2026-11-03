// ── gerarAgendaPDF.ts ────────────────────────────────────────────────────────
// Agenda do dia em PDF (03/11: folha de trabalho no padrão novo). Recurso do PRO.
// Lê os pedidos de novo, completos (escolhas e recado de cada item), porque a
// lista da Agenda não traz o recado. Duas partes: os pedidos em ordem de hora
// (quem, onde, o que levar e quanto receber) e o que produzir no dia.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "@/lib/supabase";
import { gerarDocumento, abrirJanela, esc, brl, card, telBR, diaLongo } from "@/lib/pdfDoonly";
import { escolhas, type PedidoPDF } from "@/lib/gerarPedidoPDF";
import { formaDoItem, itemComQtd, precisaAceitar, qtdCurta, saldoPedido, type Pedido } from "@/components/pedidos/pedidoTexto";
import { pesoLivre } from "@/lib/itemPedido";

type ItemAg = NonNullable<PedidoPDF["pedido_itens"]>[number];
const nomeOp = (v: unknown) => (!v ? "" : typeof v === "string" ? v : (v as { nome?: string }).nome || "");
/** bolo com tamanho não é "1 kg": conta em unidades (a mesma regra da tela da Agenda) */
const formaNaAgenda = (it: ItemAg): string | null => {
  const forma = formaDoItem(it as Parameters<typeof formaDoItem>[0]);
  return forma === "kg" && !pesoLivre(it as Parameters<typeof pesoLivre>[0], "kg") ? null : forma;
};

export async function gerarAgendaPDF(diaISO: string, ids: string[], janelaAberta?: Window | null): Promise<void> {
  const janela = janelaAberta ?? abrirJanela(); // abre já no clique (senão o navegador bloqueia)
  await gerarDocumento(async () => {
    let lista: PedidoPDF[] = [];
    if (ids.length) {
      // de 100 em 100 (dia cheio não estoura o tamanho do endereço da busca)
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await supabase.from("pedidos").select("*, pedido_itens(*, produtos(forma_venda))").in("id", ids.slice(i, i + 100));
        if (error) throw error;
        lista.push(...((data as PedidoPDF[]) || []));
      }
    }
    lista = lista.filter(p => p.status !== "cancelado")
      .sort((a, b) => String(a.horario_entrega || "99").localeCompare(String(b.horario_entrega || "99")) || (Number(a.numero) || 0) - (Number(b.numero) || 0));

    const produzir = new Map<string, { qtd: number; forma: string | null; extra: Map<string, number> }>();
    const linhas = lista.map(p => {
      const ent = p.tipo_entrega === "entrega";
      const end = [[p.endereco_rua, p.endereco_numero].filter(Boolean).join(", "), p.endereco_complemento, p.endereco_bairro].map(x => String(x || "").trim()).filter(Boolean).join(" · ");
      const tel = telBR(p.cliente_telefone);
      const falta = saldoPedido(p);
      const quem = `<b>${p.numero != null ? `#${p.numero} · ` : ""}${esc((p.cliente_nome || "").trim() || "Venda avulsa")}</b>`
        + (tel ? `<small>${esc(tel)}</small>` : "")
        + `<small>${ent ? `Entrega${end ? ` · ${esc(end)}` : ""}` : "Retirada na loja"}</small>`
        + (falta > 0.009 ? `<small class="rc"><b>Receber:</b> ${brl(falta)}</small>` : "")
        + (precisaAceitar(p as Pedido) ? `<small class="al">Novo pedido: ainda não aceito</small>` : "")
        + (p.status === "aguardando_pagamento" ? `<small class="al">Pagamento online ainda não confirmado</small>` : "");
      const itens = (p.pedido_itens || []).map(it => {
        const q = Number(it.quantidade) || 1;
        const forma = formaNaAgenda(it);
        // conta pro "Para produzir": nome + tamanho, e os sabores dos kits
        const chave = [it.nome_produto, nomeOp(it.personalizacoes?.tamanho)].filter(Boolean).join(" ");
        const atual = produzir.get(chave) || { qtd: 0, forma, extra: new Map<string, number>() };
        atual.qtd += q;
        (it.personalizacoes?.kit?.sabores || []).forEach(x => atual.extra.set(x.nome, (atual.extra.get(x.nome) || 0) + (Number(x.qtd) || 0) * q));
        produzir.set(chave, atual);
        const det = escolhas(it.personalizacoes);
        const rec = (it.observacoes || "").trim();
        return `<div class="it"><b>${esc(itemComQtd(it.nome_produto || "Item", q, forma, true))}</b>${det ? `<small>${esc(det)}</small>` : ""}${rec ? `<small class="rc"><b>Recado:</b> ${esc(rec)}</small>` : ""}</div>`;
      }).join("") || `<small>Sem itens</small>`;
      const obs = (p.observacoes || "").trim();
      return `<tr><td class="hr">${p.horario_entrega ? String(p.horario_entrega).slice(0, 5) : "—"}</td><td class="ag-q">${quem}</td>`
        + `<td>${itens}${obs ? `<small class="ag-ob"><b>Obs.:</b> ${esc(obs)}</small>` : ""}</td><td class="ck">☐</td></tr>`;
    }).join("");

    const prod = [...produzir.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
    const tabProd = prod.map(([nome, v], i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(nome)}</b>${v.extra.size ? `<small>${esc([...v.extra.entries()].map(([n, q]) => `${n} × ${q}`).join(" · "))}</small>` : ""}</td><td class="c">${esc(qtdCurta(v.qtd, v.forma).replace(/x$/, ""))}</td><td class="ck">☐</td></tr>`).join("");

    const entregas = lista.filter(p => p.tipo_entrega === "entrega").length;
    const n = lista.length;
    const dia = diaLongo(diaISO);
    return {
      titulo: `Agenda do dia ${diaISO.split("-").reverse().join("-")}`,
      tipo: "Agenda do dia",
      numero: dia,
      sub: n ? `${n} pedido${n > 1 ? "s" : ""} · ${entregas} entrega${entregas !== 1 ? "s" : ""} · ${n - entregas} retirada${n - entregas !== 1 ? "s" : ""}` : "Nenhum pedido",
      corpo: n
        ? card("Pedidos do dia", `<table class="tb ag"><thead><tr><th>Hora</th><th>Pedido</th><th>Itens</th><th class="c">Feito</th></tr></thead><tbody>${linhas}</tbody></table>`)
          + (prod.length ? card("Para produzir", `<table class="tb"><thead><tr><th>#</th><th>Produto</th><th class="c qt">Quantidade</th><th class="c">Feito</th></tr></thead><tbody>${tabProd}</tbody></table>`) : "")
        : `<p class="vazio">Nenhum pedido neste dia.</p>`,
    };
  }, janela);
}

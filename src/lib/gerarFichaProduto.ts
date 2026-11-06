// ── gerarFichaProduto.ts ─────────────────────────────────────────────────────
// Ficha técnica do produto no modelo padrão de PDF do Doonly (03/11: estilo de sistema). Recurso PRO.
// As contas seguem a tela de Ficha técnica (mesma conversão de unidades).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "@/lib/supabase";
import { gerarDocumento, abrirJanela, esc, brl, card, kv } from "@/lib/pdfDoonly";
import { calcularCustoLucro, custoIngrediente, lerMaoObraConta } from "@/lib/produto-precificacao";
import { taxaPctDaForma, fixoPorPedido } from "@/lib/painelFinanceiro";
import { parseNumBR } from "@/lib/numeroBR";
import type { ProdutoCustoJson } from "@/lib/produto-precificacao";

type InsumoFicha = { id?: string; nome?: string; unidade?: string; custo_unitario?: number };
/** O produto como a ficha lê (com produto_insumos(quantidade, unidade_utilizada, insumos(...))) */
type ProdutoFicha = Omit<ProdutoCustoJson, "produto_insumos"> & {
  id?: string; user_id?: string; nome?: string | null; categoria?: string | null; validade_dias?: number | string | null; validade_tipo?: string | null;
  imagem_url?: string | null; rendimento_qtd?: number | string | null; rendimento_peso?: number | string | null; embalagem?: string | null; observacoes_ficha?: string | null; updated_at?: string | null;
  produto_insumos?: { quantidade?: number | string | null; unidade_utilizada?: string | null; insumos?: InsumoFicha | null }[] | null;
};

const VALIDADE: Record<string, string> = { refrigerado: "geladeira", congelado: "congelador", ambiente: "temperatura ambiente" };

/** (6.168) compartilhar: abre pronto pra enviar (WhatsApp e outros); antes: grava a ficha da tela antes de ler (devolve se gravou) */
export async function gerarFichaProduto(produto: ProdutoFicha | null | undefined, _userId?: string, opcoes: { compartilhar?: boolean; antes?: () => Promise<boolean> } = {}): Promise<void> {
  const janela = abrirJanela();
  await gerarDocumento(async () => {
    if (opcoes.antes && !(await opcoes.antes())) throw new Error("a ficha não foi salva");
    // Busca o produto completo com os ingredientes (a prévia da lista pode vir sem)
    let p: ProdutoFicha = produto;
    if (produto?.id) {
      const { data } = await supabase.from("produtos")
        .select("*, produto_insumos(quantidade, unidade_utilizada, insumos(id, nome, unidade, custo_unitario))")
        .eq("id", produto.id).maybeSingle();
      if (data) p = data;
    }
    const itens = (p.produto_insumos || []).filter((x) => x?.insumos);
    const linhas = itens.map((x) => {
      const q = Number(x.quantidade) || 0, un = x.unidade_utilizada || x.insumos.unidade || "";
      const cu = Number(x.insumos.custo_unitario) || 0;
      // (6.168) preço na unidade cheia (R$/kg, R$/L), igual à tabela da tela (antes "R$ 0,02/g")
      const iu = x.insumos.unidade || "un";
      const cheia = iu === "g" ? "kg" : iu === "ml" ? "L" : iu === "cm" ? "m" : iu;
      const fator = iu === "g" || iu === "ml" ? 1000 : iu === "cm" ? 100 : 1;
      return { nome: x.insumos.nome, qtd: `${String(q).replace(".", ",")} ${un}`, custo: custoIngrediente(q, un, x.insumos), preco: `${brl(cu * fator)}/${esc(cheia)}` };
    });
    // Mesma conta da tela da ficha: custos invisíveis e mão de obra salvos na conta valem pra todos os produtos (09/10)
    const uid = p.user_id || _userId;
    const [{ data: perfilCv }, maoConta, { data: variaveis }] = uid ? await Promise.all([
      supabase.from("profiles").select("custos_invisiveis_pct").eq("id", uid).maybeSingle().then(r => r, () => ({ data: null } as { data: null })),
      lerMaoObraConta(uid).catch(() => null),
      // (03/11) taxa do crédito e o fixo por pedido: a mesma conta da tela da Ficha técnica (antes o PDF dava lucro maior)
      supabase.from("custos_variaveis").select("*").eq("user_id", uid).then(r => r, () => ({ data: null } as { data: null })),
    ]) : [{ data: null }, null, { data: null }] as [{ data: null }, null, { data: null }];
    const vars = ((variaveis || []) as Parameters<typeof taxaPctDaForma>[1]);
    const venda = { pct: taxaPctDaForma("credito", vars), fixo: fixoPorPedido(vars) };
    const cvConta = (perfilCv as { custos_invisiveis_pct?: number | null } | null)?.custos_invisiveis_pct;
    // 10/10: a conta é a mesma função da tela de Produtos e da Ficha técnica (promoção em % incluída)
    const conta = calcularCustoLucro(
      { ...p, produto_insumos: itens },
      maoConta,
      cvConta != null ? Number(cvConta) : null,
      venda,
    );
    const { cmv, cvPct, cv, mo, preco, lucro } = conta;
    const taxaCredito = preco * ((Number(venda.pct) || 0) / 100);
    const fixoPedido = Number(venda.fixo) || 0;
    const rendeUn = parseNumBR(/\d+(?:[.,]\d+)?/.exec(String(p.rendimento_qtd ?? ""))?.[0] || "") || 0; // (6.182) o primeiro número, como na tela
    const min = conta.tempoMin;
    const custo = conta.custoTotal;
    const margem = conta.margemLucro;

    // (03/11) estilo de sistema: nome do produto em destaque, tabela com o preço de cada insumo e a formação do preço num quadro só
    const linhasTab = linhas.map((l, i) => `<tr><td class="n">${i + 1}</td><td class="um">${esc(l.nome)}</td><td class="c">${esc(l.qtd)}</td><td class="r">${l.preco}</td><td class="r">${brl(l.custo)}</td></tr>`).join("");
    const tabela = linhas.length
      ? `<table class="tb"><thead><tr><th>#</th><th>Ingrediente</th><th class="c qt">Quantidade</th><th class="r">Preço do insumo</th><th class="r">Custo</th></tr></thead><tbody>${linhasTab}<tr class="sub fim"><td></td><td>Total dos ingredientes</td><td></td><td></td><td class="r">${brl(cmv)}</td></tr></tbody></table>`
      : `<p class="vazio">Nenhum ingrediente na ficha técnica ainda.</p>`;
    const tempo = mo ? (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}` : `${min} min`) : "";
    // (03/11) rendimento, validade e embalagem num quadro embaixo dos ingredientes; embaixo do nome só a categoria
    const validade = Number(p.validade_dias) > 0 ? `${p.validade_dias} dia${Number(p.validade_dias) > 1 ? "s" : ""} (${VALIDADE[p.validade_tipo] || "geladeira"})` : "";
    const rende = [p.rendimento_qtd, p.rendimento_peso].filter(Boolean).join(" · ");
    const dados = esc(p.categoria || "");
    const infoPares: [string, string][] = ([["Rendimento", esc(rende)], ["Validade", esc(validade)], ["Embalagem", esc(p.embalagem || "")]] as [string, string][]).filter(([, v]) => v);
    // (03/11) foto pequena ao lado do nome, quando o produto tem foto
    const foto = typeof p.imagem_url === "string" && p.imagem_url.trim() ? `<img src="${esc(p.imagem_url.trim())}" alt="">` : "";
    const tituloProduto = `<div class="prod">${foto}<div><b>${esc(p.nome || "Produto")}</b>${dados ? `<span>${dados}</span>` : ""}</div></div>`;
    const formacao = `<div class="tot">
      <div><span>Ingredientes</span><b>${brl(cmv)}</b></div>
      ${cvPct && cv > 0.004 ? `<div><span>Custos invisíveis (${String(cvPct).replace(".", ",")}%)</span><b>${brl(cv)}</b></div>` : ""}
      ${mo ? `<div><span>Mão de obra (${tempo})</span><b>${brl(mo)}</b></div>` : ""}
      ${taxaCredito > 0.004 ? `<div><span>Taxa no crédito (${String(Math.round(venda.pct * 100) / 100).replace(".", ",")}%)</span><b>${brl(taxaCredito)}</b></div>` : ""}
      ${fixoPedido > 0.004 ? `<div><span>Por pedido (embalagem)</span><b>${brl(fixoPedido)}</b></div>` : ""}
      <div class="tt"><span>Custo total</span><b>${brl(custo)}</b></div>
${rendeUn > 0 ? `<div><span>Custo por unidade</span><b>${brl(custo / rendeUn)}</b></div>` : ""}
            <div><span>Preço de venda</span><b>${brl(preco)}</b></div>
      <div class="rest"><span>Lucro (${margem.toFixed(1).replace(".", ",")}%)</span><b class="${lucro < 0 ? "neg" : ""}">${brl(lucro)}</b></div>
    </div>`;
    const obs = (p.observacoes_ficha || "").trim();
    const atualizado = p.updated_at ? new Date(p.updated_at).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR");
    return {
      titulo: `Ficha técnica · ${p.nome || ""}`,
      marcaDagua: true, compartilhar: !!opcoes.compartilhar,
      tipo: "Ficha técnica",
      numero: "",
      sub: `Atualizada em ${atualizado}`,
      corpo: tituloProduto + tabela + `<div class="g2 lado"><div>${infoPares.length ? card("Informações", kv(infoPares)) : ""}${obs ? card("Modo de preparo e observações", `<p class="ob">${esc(obs)}</p>`) : ""}</div>${formacao}</div>`,
    };
  }, janela);
}

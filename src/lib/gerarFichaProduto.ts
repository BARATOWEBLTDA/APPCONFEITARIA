// ── gerarFichaProduto.ts ─────────────────────────────────────────────────────
// Ficha técnica do produto no modelo padrão de PDF do Doonly (02/10). Recurso PRO.
// As contas seguem a tela de Ficha técnica (mesma conversão de unidades).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "@/lib/supabase";
import { gerarDocumento, abrirJanela, esc, brl, card, kv, kpis } from "@/lib/pdfDoonly";
import { calcularCustoLucro, lerMaoObraConta } from "@/lib/produto-precificacao";
import type { ProdutoCustoJson } from "@/lib/produto-precificacao";

type InsumoFicha = { id?: string; nome?: string; unidade?: string; custo_unitario?: number };
/** O produto como a ficha lê (com produto_insumos(quantidade, unidade_utilizada, insumos(...))) */
type ProdutoFicha = Omit<ProdutoCustoJson, "produto_insumos"> & {
  id?: string; user_id?: string; nome?: string | null; categoria?: string | null; validade_dias?: number | string | null; validade_tipo?: string | null;
  rendimento_qtd?: number | string | null; rendimento_peso?: number | string | null; embalagem?: string | null; observacoes_ficha?: string | null; updated_at?: string | null;
  produto_insumos?: { quantidade?: number | string | null; unidade_utilizada?: string | null; insumos?: InsumoFicha | null }[] | null;
};

const UNIT: Record<string, { family: string; toBase: number }> = {
  kg: { family: "massa", toBase: 1 }, g: { family: "massa", toBase: 0.001 },
  L: { family: "volume", toBase: 1 }, ml: { family: "volume", toBase: 0.001 }, un: { family: "unidade", toBase: 1 },
};
function custoLinha(qtd: number, unidadeUsada: string, insumo: InsumoFicha | null | undefined): number {
  const cu = Number(insumo?.custo_unitario) || 0;
  const a = UNIT[unidadeUsada], b = UNIT[insumo?.unidade];
  if (a && b && a.family === b.family && b.toBase > 0) return ((qtd * a.toBase) / b.toBase) * cu;
  return qtd * cu;
}
const VALIDADE: Record<string, string> = { refrigerado: "geladeira", congelado: "congelador", ambiente: "temperatura ambiente" };

export async function gerarFichaProduto(produto: ProdutoFicha | null | undefined, _userId?: string): Promise<void> {
  const janela = abrirJanela();
  await gerarDocumento(async () => {
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
      return { nome: x.insumos.nome, qtd: `${String(q).replace(".", ",")} ${un}`, custo: custoLinha(q, un, x.insumos) };
    });
    const cmv = linhas.reduce((s: number, l) => s + l.custo, 0);
    // Mesma conta da tela da ficha: custos invisíveis e mão de obra salvos na conta valem pra todos os produtos (09/10)
    const uid = p.user_id || _userId;
    const [{ data: perfilCv }, maoConta] = uid ? await Promise.all([
      supabase.from("profiles").select("custos_invisiveis_pct").eq("id", uid).maybeSingle().then(r => r, () => ({ data: null } as { data: null })),
      lerMaoObraConta(uid).catch(() => null),
    ]) : [{ data: null }, null] as [{ data: null }, null];
    const cvConta = (perfilCv as { custos_invisiveis_pct?: number | null } | null)?.custos_invisiveis_pct;
    // 10/10: a conta é a mesma função da tela de Produtos e da Ficha técnica (promoção em % incluída)
    const conta = calcularCustoLucro(
      { ...p, produto_insumos: itens },
      maoConta,
      cvConta != null ? Number(cvConta) : null,
    );
    const { cvPct, cv, mo, preco, lucro } = conta;
    const min = conta.tempoMin;
    const custo = conta.custoTotal;
    const margem = conta.margemLucro;

    const tabela = linhas.length
      ? `<table class="tb"><tr><th>Ingrediente</th><th class="c">Quantidade</th><th class="r">Custo</th></tr>${linhas.map((l) => `<tr><td>${esc(l.nome)}</td><td class="c">${esc(l.qtd)}</td><td class="r">${brl(l.custo)}</td></tr>`).join("")}<tr class="sub"><td>CMV (ingredientes)</td><td></td><td class="r">${brl(cmv)}</td></tr></table>`
      : `<p class="vazio">Nenhum ingrediente na ficha técnica ainda.</p>`;
    const outros = card("Outros custos", kv([
      ["Custos invisíveis", cvPct ? `${String(cvPct).replace(".", ",")}% · ${brl(cv)}` : ""],
      ["Mão de obra", mo ? `${min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}` : `${min} min`} · ${brl(mo)}` : ""],
      ["Custo total", `<b>${brl(custo)}</b>`],
    ]));
    const validade = Number(p.validade_dias) > 0 ? `${p.validade_dias} dia${Number(p.validade_dias) > 1 ? "s" : ""} (${VALIDADE[p.validade_tipo] || "geladeira"})` : "";
    const info = card("Informações", kv([
      ["Categoria", esc(p.categoria || "")],
      ["Rendimento", esc([p.rendimento_qtd, p.rendimento_peso].filter(Boolean).join(" · "))],
      ["Validade", esc(validade)],
      ["Embalagem", esc(p.embalagem || "")],
    ]) + (p.observacoes_ficha ? `<p class="obs">📝 ${esc(p.observacoes_ficha)}</p>` : ""));

    const atualizado = p.updated_at ? new Date(p.updated_at).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR");
    return {
      titulo: `Ficha técnica · ${p.nome || ""}`,
      tipo: "Ficha técnica",
      numero: p.nome || "Produto",
      sub: `Atualizada em ${atualizado}`,
      corpo: kpis([["Custo total", brl(custo)], ["Preço de venda", brl(preco)], ["Lucro", brl(lucro), true], ["Margem", `${margem.toFixed(1).replace(".", ",")}%`]])
        + card("Ingredientes", tabela) + `<div class="g2">${outros}${info}</div>`,
    };
  }, janela);
}

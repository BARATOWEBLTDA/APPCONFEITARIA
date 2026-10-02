// ── gerarFichaProduto.ts ─────────────────────────────────────────────────────
// Ficha técnica do produto no modelo padrão de PDF do Doonly (02/10). Recurso PRO.
// As contas seguem a tela de Ficha técnica (mesma conversão de unidades).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "@/lib/supabase";
import { gerarDocumento, abrirJanela, esc, brl, card, kv, kpis } from "@/lib/pdfDoonly";

const UNIT: Record<string, { family: string; toBase: number }> = {
  kg: { family: "massa", toBase: 1 }, g: { family: "massa", toBase: 0.001 },
  L: { family: "volume", toBase: 1 }, ml: { family: "volume", toBase: 0.001 }, un: { family: "unidade", toBase: 1 },
};
function custoLinha(qtd: number, unidadeUsada: string, insumo: any): number {
  const cu = Number(insumo?.custo_unitario) || 0;
  const a = UNIT[unidadeUsada], b = UNIT[insumo?.unidade];
  if (a && b && a.family === b.family && b.toBase > 0) return ((qtd * a.toBase) / b.toBase) * cu;
  return qtd * cu;
}
const VALIDADE: Record<string, string> = { refrigerado: "geladeira", congelado: "congelador", ambiente: "temperatura ambiente" };

export async function gerarFichaProduto(produto: any, _userId?: string): Promise<void> {
  const janela = abrirJanela();
  await gerarDocumento(async () => {
    // Busca o produto completo com os ingredientes (a prévia da lista pode vir sem)
    let p: any = produto;
    if (produto?.id) {
      const { data } = await supabase.from("produtos")
        .select("*, produto_insumos(quantidade, unidade_utilizada, insumos(id, nome, unidade, custo_unitario))")
        .eq("id", produto.id).maybeSingle();
      if (data) p = data;
    }
    const itens = (p.produto_insumos || []).filter((x: any) => x?.insumos);
    const linhas = itens.map((x: any) => {
      const q = Number(x.quantidade) || 0, un = x.unidade_utilizada || x.insumos.unidade || "";
      return { nome: x.insumos.nome, qtd: `${String(q).replace(".", ",")} ${un}`, custo: custoLinha(q, un, x.insumos) };
    });
    const cmv = linhas.reduce((s: number, l: any) => s + l.custo, 0);
    const cvPct = Number(p.cv_percentual) || 0;
    const cv = cmv * (cvPct / 100);
    const sal = Number(p.salario_desejado) || 0, horas = Number(p.horas_semanais) || 40, min = Number(p.tempo_preparo_min) || 0;
    const mo = sal > 0 && min > 0 ? (sal / (horas * 4.33)) * (min / 60) : 0;
    const custo = cmv + cv + mo;
    const preco = p.promocao && Number(p.preco_promocional) > 0 ? Number(p.preco_promocional) : Number(p.preco_normal) || 0;
    const lucro = preco - custo;
    const margem = preco > 0 ? (lucro / preco) * 100 : 0;

    const tabela = linhas.length
      ? `<table class="tb"><tr><th>Ingrediente</th><th class="c">Quantidade</th><th class="r">Custo</th></tr>${linhas.map((l: any) => `<tr><td>${esc(l.nome)}</td><td class="c">${esc(l.qtd)}</td><td class="r">${brl(l.custo)}</td></tr>`).join("")}<tr class="sub"><td>CMV (ingredientes)</td><td></td><td class="r">${brl(cmv)}</td></tr></table>`
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

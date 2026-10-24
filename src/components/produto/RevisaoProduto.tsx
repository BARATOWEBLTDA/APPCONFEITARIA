import { rotuloAntecedencia } from "@/lib/entregaProduto";
import { precosDosSabores } from "@/lib/precoCardapio";
import { CheckCircle, Warning } from "@phosphor-icons/react";
import { kitAtivo, kitsValidos, precoMinKit, precoLivre, type KitQtdConfig } from "@/lib/kitQuantidade";
import { textoBRL } from "@/lib/moeda";
import "./escolhas.css";

/**
 * (13/10) Revisão no fim do cadastro: como o cliente vê, um pedido de exemplo e o que vale arrumar antes de publicar.
 * Só lê o form (não muda nada).
 */
type Op = { id: string; nome: string; adicional?: number; preco?: number; peso_kg?: number | null };
type G = { ativo?: boolean; min?: number; max?: number; opcoes?: Op[]; modo_preco_tamanho?: string; sabor_tem_preco_proprio?: boolean };

const GRUPOS: [string, string, string][] = [
  ["grupo_massas", "massa", "massas"], ["grupo_recheios", "recheio", "recheios"],
  ["grupo_coberturas", "cobertura", "coberturas"], ["grupo_sabores", "sabor", "sabores"],
];
const rs = (v: number) => `R$ ${textoBRL(v) || "0,00"}`;
const pesoDe = (o: Op) => Number(o.peso_kg) || Number(String(o.nome).replace(",", ".").match(/(\d+(?:\.\d+)?)/)?.[1]) || 0;

// (15/10) promoção só vale ligada; em % aplica o desconto (antes usava o preço promocional mesmo com a promoção desligada)
function precoBase(form: any): number {
  const cheio = Number(form.preco_normal) || 0;
  if (!form.promocao) return cheio;
  const pct = Number(form.desconto_percentual) || 0;
  if (form.tipo_promocao === "percentual") return pct > 0 && pct < 100 ? Math.round(cheio * (100 - pct)) / 100 : cheio;
  const promo = Number(form.preco_promocional) || 0;
  return promo > 0 && promo < cheio ? promo : cheio;
}

export function resumoRevisao(form: any) {
  const kit = form.kit_qtd as KitQtdConfig | null;
  const tam = form.grupo_tamanhos as G | undefined;
  const temTam = !!tam?.ativo && (tam.opcoes?.length || 0) > 0;
  const porPeso = temTam && tam!.modo_preco_tamanho === "por_peso";
  // (14/10) Tamanho + "só o sabor": o tamanho é só o nome, o preço vem dos sabores
  const gsR = form.grupo_sabores as G & { regra_conflito_tamanho?: string } | undefined;
  const soSabor = temTam && !porPeso && !!gsR?.ativo && !!gsR?.sabor_tem_preco_proprio && gsR?.regra_conflito_tamanho === "preco_sabor";
  const precosSab = soSabor ? (gsR!.opcoes || []).map(o => Number(o.preco) || 0).filter(v => v > 0) : [];
  const base = precoBase(form);

  // "a partir de"
  let aPartir = base;
  if (kitAtivo(kit)) aPartir = precoMinKit(kit!);
  else if (porPeso) aPartir = Math.min(...tam!.opcoes!.map(o => pesoDe(o) * base).filter(v => v > 0), Infinity);
  else if (soSabor) aPartir = Math.min(...precosSab, Infinity);
  else if (temTam) {
    aPartir = Math.min(...tam!.opcoes!.map(o => Number(o.preco) || 0).filter(v => v > 0), Infinity);
    // (14/10) "tamanho + sabor": soma o sabor mais barato
    const sabMin = gsR?.ativo && gsR?.sabor_tem_preco_proprio && gsR?.regra_conflito_tamanho === "tamanho_base_sabor_adicional" ? Math.min(...(gsR.opcoes || []).map(o => Number(o.preco) || 0).filter(v => v > 0), Infinity) : Infinity;
    if (isFinite(aPartir) && isFinite(sabMin)) aPartir += sabMin;
  }
  else if (precosDosSabores(form)) aPartir = Math.min(...precosDosSabores(form)!, Infinity); // (14/10) preço pelo sabor
  if (!isFinite(aPartir)) aPartir = 0;

  // o que o cliente escolhe
  const escolhas: string[] = [];
  if (kitAtivo(kit)) escolhas.push("quantidade", `até ${kit!.max_sabores} ${kit!.max_sabores === 1 ? "sabor" : "sabores"}`);
  if (temTam) escolhas.push("tamanho");
  GRUPOS.forEach(([campo, um, varios]) => {
    const g = form[campo] as G | undefined;
    if (!g?.ativo || !(g.opcoes?.length)) return;
    const max = Number(g.max) || 1;
    escolhas.push(max >= 99 ? varios : max === 1 ? um : `até ${max} ${varios}`);
  });

  // pedido de exemplo: o primeiro de cada escolha
  const linhas: { nome: string; valor: number }[] = [];
  if (kitAtivo(kit)) {
    if (kit!.modo === "livre") { const q = kit!.livre.min || 0; linhas.push({ nome: `${q} unidades`, valor: precoLivre(kit!, q) }); }
    else { const k = kitsValidos(kit!)[0]; if (k) linhas.push({ nome: `Kit de ${k.qtd} un.`, valor: k.preco }); }
  } else if (temTam) {
    const o = tam!.opcoes![0];
    linhas.push({ nome: o.nome, valor: soSabor ? 0 : porPeso ? pesoDe(o) * base : Number(o.preco) || 0 });
  } else if (!precosDosSabores(form)) { // (14/10) no preço pelo sabor, a linha do sabor já é o preço
    linhas.push({ nome: String(form.nome || "Produto"), valor: base });
  }
  GRUPOS.forEach(([campo]) => {
    const g = form[campo] as G | undefined;
    if (!g?.ativo || !(g.opcoes?.length)) return;
    const o = g.opcoes![0];
    // (14/10) com tamanho e "só o tamanho", o sabor não muda o preço
    const v = g.sabor_tem_preco_proprio ? (temTam && !porPeso && (g as any).regra_conflito_tamanho !== "preco_sabor" && (g as any).regra_conflito_tamanho !== "tamanho_base_sabor_adicional" ? 0 : Number(o.preco) || 0) : Number(o.adicional) || 0;
    linhas.push({ nome: o.nome, valor: v });
  });
  const total = linhas.reduce((s, l) => s + l.valor, 0);

  // antes de publicar
  const avisos: string[] = [];
  if (!form.imagem_url) avisos.push("Sem foto: produto com foto vende mais");
  if (!String(form.descricao || "").trim()) avisos.push("Sem descrição: conte o que vem no produto");
  // (14/10) um aviso só, dizendo o que falta (antes vinham "Tem tamanho sem preço" e "O produto está sem preço" juntos)
  const semPreco = temTam && !porPeso && !soSabor ? tam!.opcoes!.filter(o => !(Number(o.preco) > 0)) : [];
  if (semPreco.length === 1) avisos.push(`Falta o preço do ${semPreco[0].nome}`);
  else if (semPreco.length > 1) avisos.push(semPreco.length === tam!.opcoes!.length ? "Falta o preço dos tamanhos" : `Falta o preço de ${semPreco.length} tamanhos`);
  else if (porPeso && !(Number(form.preco_normal) > 0)) avisos.push("Falta o preço do kg");
  else if (precosDosSabores(form)) {
    const gs = form.grupo_sabores as G;
    const sem = (gs.opcoes || []).filter(o => !(Number(o.preco) > 0));
    if (sem.length === 1) avisos.push(`Falta o preço do sabor ${sem[0].nome}`);
    else if (sem.length > 1) avisos.push(`Falta o preço de ${sem.length} sabores`);
  }
  else if (!(aPartir > 0)) avisos.push("Falta o preço do produto");

  return { aPartir, escolhas, linhas, total, avisos };
}

export default function RevisaoProduto({ form }: { form: any }) {
  const r = resumoRevisao(form);
  return (
    <div className="rev">
      {r.linhas.length > 1 && (
        <>
          <p className="prod-section-label rev-tit">Um pedido de exemplo</p>
          <ul className="rev-ped">
            {r.linhas.map((l, i) => (
              <li key={i}><span>{l.nome}</span><b>{i === 0 ? rs(l.valor) : l.valor > 0 ? `+ ${rs(l.valor)}` : "incluso"}</b></li>
            ))}
            <li className="rev-total"><span>Total</span><b>{rs(r.total)}</b></li>
          </ul>
        </>
      )}

      <p className="prod-section-label rev-tit">Antes de publicar</p>
      {r.avisos.length === 0
        ? <p className="rev-ok"><CheckCircle size={18} weight="fill" aria-hidden="true" />Tudo certo para ir para o cardápio</p>
        : <ul className="rev-avisos">{r.avisos.map(a => <li key={a}><Warning size={16} weight="fill" aria-hidden="true" /><span>{a}</span></li>)}</ul>}
    </div>
  );
}

/**
 * (14/10) Revisão: todas as informações do produto numa tabelinha (rótulo | valor), antes de publicar.
 */
export function ResumoProduto({ form }: { form: any }) {
  const r = resumoRevisao(form);
  const kit = form.kit_qtd as KitQtdConfig | null;
  const tam = form.grupo_tamanhos as G | undefined;
  const temTam = !!tam?.ativo && (tam.opcoes?.length || 0) > 0;
  const porPeso = temTam && tam!.modo_preco_tamanho === "por_peso";
  const pct = Number(form.desconto_percentual) || 0;
  const promoPct = !!form.promocao && form.tipo_promocao === "percentual" && pct > 0;
  const promoValor = Number(form.preco_promocional) || 0;
  const preco = kitAtivo(kit) ? `A partir de ${rs(r.aPartir)}`
    : porPeso ? `${rs(Number(form.preco_normal) || 0)} o kg`
    : temTam ? (r.aPartir > 0 ? `A partir de ${rs(r.aPartir)}` : "Falta o preço")
    : precosDosSabores(form) ? (r.aPartir > 0 ? `A partir de ${rs(r.aPartir)}` : "Falta o preço dos sabores")
    : `${rs(Number(form.preco_normal) || 0)}${form.forma_venda === "kg" ? " o kg" : ""}`; // (14/10) vendido por kg: diz
  const promo = !form.promocao ? "Sem promoção" : promoPct ? `${pct}% de desconto` : promoValor > 0 && promoValor < (Number(form.preco_normal) || 0) ? `${rs(promoValor)}${porPeso ? " o kg" : ""}` : "Sem promoção";
  const entrega = form.pronta_entrega === true ? "Pronta entrega" : form.antecedencia ? `Pedir ${rotuloAntecedencia(form.antecedencia)} antes` : "Falta escolher";
  const linhas: [string, string][] = [
    ["Nome", String(form.nome || "").trim() || "Sem nome"],
    ["Categoria", String(form.categoria || "").trim() || "Sem categoria"],
    ["Descrição", String(form.descricao || "").trim() || "Sem descrição"],
    ...(String(form.sku || "").trim() ? [["SKU", String(form.sku).trim()] as [string, string]] : []),
    ["Escolhas", r.escolhas.length ? (r.escolhas.join(", ").charAt(0).toUpperCase() + r.escolhas.join(", ").slice(1)) : "Nenhuma"],
    ...(temTam ? [["Tamanhos", tam!.opcoes!.map(o => o.nome).join(", ")] as [string, string]] : []),
    ["Preço", preco],
    ["Promoção", promo],
    ["No cardápio", form.disponivel !== false ? "Aparece" : "Guardado só para você"],
    ["Entrega", entrega],
  ];
  return (
    <div className="rev-resumo">
      <p className="prod-section-label rev-tit">Informações do produto</p>
      <div className="prod-dtab rev-tab" role="table" aria-label="Informações do produto">
        {linhas.map(([k, v]) => (
          <div className="prod-dtab-l rev-tab-l" role="row" key={k}>
            <span role="rowheader">{k}</span>
            <span role="cell" className={/^(Falta|Sem nome|Sem categoria)/.test(v) ? "rev-falta" : undefined}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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

function precoBase(form: any): number {
  const promo = Number(form.preco_promocional) || 0;
  const cheio = Number(form.preco_normal) || 0;
  return promo > 0 && promo < cheio ? promo : cheio;
}

export function resumoRevisao(form: any) {
  const kit = form.kit_qtd as KitQtdConfig | null;
  const tam = form.grupo_tamanhos as G | undefined;
  const temTam = !!tam?.ativo && (tam.opcoes?.length || 0) > 0;
  const porPeso = temTam && tam!.modo_preco_tamanho === "por_peso";
  const base = precoBase(form);

  // "a partir de"
  let aPartir = base;
  if (kitAtivo(kit)) aPartir = precoMinKit(kit!);
  else if (porPeso) aPartir = Math.min(...tam!.opcoes!.map(o => pesoDe(o) * base).filter(v => v > 0), Infinity);
  else if (temTam) aPartir = Math.min(...tam!.opcoes!.map(o => Number(o.preco) || 0).filter(v => v > 0), Infinity);
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
    linhas.push({ nome: o.nome, valor: porPeso ? pesoDe(o) * base : Number(o.preco) || 0 });
  } else {
    linhas.push({ nome: String(form.nome || "Produto"), valor: base });
  }
  GRUPOS.forEach(([campo]) => {
    const g = form[campo] as G | undefined;
    if (!g?.ativo || !(g.opcoes?.length)) return;
    const o = g.opcoes![0];
    const v = g.sabor_tem_preco_proprio ? Number(o.preco) || 0 : Number(o.adicional) || 0;
    linhas.push({ nome: o.nome, valor: v });
  });
  const total = linhas.reduce((s, l) => s + l.valor, 0);

  // antes de publicar
  const avisos: string[] = [];
  if (!form.imagem_url) avisos.push("Sem foto: produto com foto vende mais");
  if (!String(form.descricao || "").trim()) avisos.push("Sem descrição: conte o que vem no produto");
  // (14/10) um aviso só, dizendo o que falta (antes vinham "Tem tamanho sem preço" e "O produto está sem preço" juntos)
  const semPreco = temTam && !porPeso ? tam!.opcoes!.filter(o => !(Number(o.preco) > 0)) : [];
  if (semPreco.length === 1) avisos.push(`Falta o preço do ${semPreco[0].nome}`);
  else if (semPreco.length > 1) avisos.push(semPreco.length === tam!.opcoes!.length ? "Falta o preço dos tamanhos" : `Falta o preço de ${semPreco.length} tamanhos`);
  else if (porPeso && !(Number(form.preco_normal) > 0)) avisos.push("Falta o preço do kg");
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
        ? <p className="rev-ok"><CheckCircle size={18} weight="fill" aria-hidden="true" />Tudo certo pra ir pro cardápio</p>
        : <ul className="rev-avisos">{r.avisos.map(a => <li key={a}><Warning size={16} weight="fill" aria-hidden="true" /><span>{a}</span></li>)}</ul>}
    </div>
  );
}

import type { ReactNode } from "react";
import { Cake, CurrencyCircleDollar, Image as ImageIc, ListChecks, PencilSimple, Storefront } from "@phosphor-icons/react";
import { precoCardapioComPromocao } from "@/lib/precoCardapio";
import { textoBRL } from "@/lib/moeda";
import { escolhasAtivas } from "@/components/produto/EscolhasProduto";
import { resumoRevisao } from "@/components/produto/RevisaoProduto";
import "./escolhas.css";

/**
 * (14/10) Editar produto: abre num resumo. No topo, o produto como aparece no cardápio;
 * embaixo, cada parte com o que já está cadastrado e um "Editar" que abre só aquela parte.
 */
type Parte = "info" | "opcoes" | "fotos" | "preco" | "entrega";
const ROT: Record<string, string> = { tamanho: "Tamanho", massa: "Massa", recheio: "Recheio", cobertura: "Cobertura", sabor: "Sabor", quantidade: "Quantidade" };
const rs = (v: number) => `R$ ${textoBRL(v) || "0,00"}`;

export default function ResumoEdicao({ form, onEditar }: { form: any; onEditar: (p: Parte) => void }) {
  const fotos = String(form.imagem_url || "").split(",").map((x: string) => x.trim()).filter(Boolean);
  const pc = precoCardapioComPromocao(form);
  const r = resumoRevisao(form);
  const ativas = escolhasAtivas(form);
  const gt = form.grupo_tamanhos;

  const escolhas = !ativas.length ? "Nenhuma"
    : ativas.length === 1 && ativas[0] === "tamanho" && gt?.opcoes?.length ? `Tamanho: ${gt.opcoes.map((o: any) => o.nome).join(" · ")}`
    : ativas.map(c => ROT[c]).join(", ");
  const faltaPreco = r.avisos.find(a => /^Falta o preço/.test(a));
  const promo = !!form.promocao && (form.tipo_promocao === "percentual" ? Number(form.desconto_percentual) > 0 : Number(form.preco_promocional) > 0);
  const preco = faltaPreco || `${pc.aPartir ? "a partir de " : ""}${rs(pc.final)}${promo ? " · em promoção" : ""}`;
  const semEntrega = !(form.pronta_entrega === true || form.antecedencia);
  const entrega = `${form.disponivel !== false ? "Aparece" : "Oculto"} · ${form.pronta_entrega === true ? "Pronta entrega" : form.antecedencia ? "Encomenda" : "Falta a entrega"}`;

  const linha = (parte: Parte, icone: ReactNode, nome: string, apoio: string, falta = false) => (
    <li className="red-it">
      <button type="button" className="red-bt" onClick={() => onEditar(parte)}>
        <span className="red-ic" aria-hidden="true">{icone}</span>
        <span className="red-tx"><b>{nome}</b><small className={falta ? "red-falta" : undefined}>{apoio}</small></span>
        <span className="red-ed">Editar</span>
      </button>
    </li>
  );

  return (
    <div className="red">
      <div className="red-prev">
        <span className="red-ft">{fotos[0] ? <img src={fotos[0]} alt="" /> : <Cake size={28} aria-hidden="true" />}</span>
        <div className="red-prev-tx">
          <b>{form.nome || "Produto"}</b>
          <span className={`red-tag${form.disponivel !== false ? "" : " off"}`}>{form.disponivel !== false ? "No cardápio" : "Fora do cardápio"}</span>
          {form.descricao && <small>{form.descricao}</small>}
          <em>{pc.aPartir && <i>a partir de </i>}{pc.de > 0 && <s>{rs(pc.de)}</s>}{rs(pc.final)}</em>
        </div>
      </div>

      <p className="prod-section-label red-t">O que você quer mudar?</p>
      <ul className="red-lista">
        {linha("info", <PencilSimple size={18} weight="bold" />, "Nome e descrição", `${form.categoria || "Sem categoria"} · ${String(form.descricao || "").trim() ? "com descrição" : "sem descrição"}`, !form.categoria)}
        {linha("opcoes", <ListChecks size={18} weight="bold" />, "Escolhas", escolhas)}
        {linha("fotos", <ImageIc size={18} weight="bold" />, "Fotos", fotos.length ? (fotos.length === 1 ? "1 foto" : `${fotos.length} fotos`) : "Sem foto", !fotos.length)}
        {linha("preco", <CurrencyCircleDollar size={18} weight="bold" />, "Preço e promoção", preco, !!faltaPreco)}
        {linha("entrega", <Storefront size={18} weight="bold" />, "Cardápio e entrega", entrega, semEntrega)}
      </ul>
    </div>
  );
}

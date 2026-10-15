import type { ReactNode } from "react";
import { Cake, CurrencyCircleDollar, Image as ImageIc, ListChecks, PencilSimple, Storefront } from "@phosphor-icons/react";
import { precoCardapioComPromocao, tamanhosEsgotados } from "@/lib/precoCardapio";
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
// (14/10) singular / plural pra "3 tamanhos cadastrados"
const NOME: Record<string, [string, string]> = { tamanho: ["tamanho", "tamanhos"], massa: ["massa", "massas"], recheio: ["recheio", "recheios"], cobertura: ["cobertura", "coberturas"], sabor: ["sabor", "sabores"], quantidade: ["quantidade", "quantidades"] };
const GRUPO: Record<string, string> = { tamanho: "grupo_tamanhos", massa: "grupo_massas", recheio: "grupo_recheios", cobertura: "grupo_coberturas", sabor: "grupo_sabores" };
const ANTES: Record<string, string> = { "24h": "1 dia antes", "48h": "2 dias antes", "3d": "3 dias antes", "5d": "5 dias antes", "7d": "1 semana antes", "15d": "15 dias antes" };
const rs = (v: number) => `R$ ${textoBRL(v) || "0,00"}`;

export default function ResumoEdicao({ form, isPro = false, onEditar }: { form: any; isPro?: boolean; onEditar: (p: Parte) => void }) {
  const fotos = String(form.imagem_url || "").split(",").map((x: string) => x.trim()).filter(Boolean);
  const pc = precoCardapioComPromocao(form);
  const r = resumoRevisao(form);
  const ativas = escolhasAtivas(form);
  const gt = form.grupo_tamanhos;

  // (14/10) textos que explicam, em vez de "1 foto" / "Aparece · Pronta entrega"
  const qtdDe = (c: string) => c === "quantidade" ? 0 : (form[GRUPO[c]]?.opcoes?.length || 0);
  const escolhas = !ativas.length ? "Sem escolhas, preço único"
    : ativas.length === 1 && qtdDe(ativas[0]) > 0
      ? (() => { const c = ativas[0], n = qtdDe(c), fem = c === "massa" || c === "cobertura"; return `${n} ${NOME[c][n === 1 ? 0 : 1]} ${fem ? "cadastrada" : "cadastrado"}${n === 1 ? "" : "s"}`; })()
      : ativas.length === 1 ? (ativas[0] === "quantidade" ? "Vende por quantidade" : `${ROT[ativas[0]]}, sem opções ainda`)
      : `${ativas.length} escolhas: ${ativas.map(c => ROT[c].toLowerCase()).join(", ")}`;
  const faltaPreco = r.avisos.find(a => /^Falta o preço/.test(a));
  const promo = !!form.promocao && (form.tipo_promocao === "percentual" ? Number(form.desconto_percentual) > 0 : Number(form.preco_promocional) > 0);
  const preco = faltaPreco || (promo ? (pc.aPartir ? `Promoção desde ${rs(pc.final)}` : `Em promoção por ${rs(pc.final)}`) : `${pc.aPartir ? "A partir de" : "Custa"} ${rs(pc.final)}${form.forma_venda === "kg" && !(gt?.ativo && gt?.opcoes?.length) ? " o kg" : ""}`);
  const nFotos = fotos.length;
  const textoFotos = !nFotos ? "Sem foto, adicione uma"
    : isPro ? `${nFotos} de 3 fotos cadastradas`
    : nFotos === 1 ? "1 foto cadastrada" : `${nFotos} fotos cadastradas`;
  const semEntrega = !(form.pronta_entrega === true || form.antecedencia);
  const comoRecebe = form.pronta_entrega === true ? "É pronta entrega"
    : form.antecedencia ? `Encomendar ${ANTES[form.antecedencia] || "antes"}`
    : "Falta a forma de entrega";
  const entrega = form.disponivel !== false ? comoRecebe : "Fora do cardápio";
  const textoInfo = !form.categoria ? "Falta escolher a categoria"
    : !String(form.descricao || "").trim() ? "Falta a descrição" : `Em ${form.categoria}, com descrição`;

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
        {linha("info", <PencilSimple size={18} weight="bold" />, "Nome e descrição", textoInfo, !form.categoria)}
        {linha("opcoes", <ListChecks size={18} weight="bold" />, "Escolhas", tamanhosEsgotados(form) ? "Tudo esgotado no momento" : escolhas, tamanhosEsgotados(form))}
        {linha("fotos", <ImageIc size={18} weight="bold" />, "Fotos", textoFotos, !fotos.length)}
        {linha("preco", <CurrencyCircleDollar size={18} weight="bold" />, "Preço e promoção", preco, !!faltaPreco)}
        {linha("entrega", <Storefront size={18} weight="bold" />, "Cardápio e entrega", entrega, semEntrega)}
      </ul>
    </div>
  );
}

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Basket, Cake, CaretRight, ChatCircleText, ClipboardText, ShoppingBag, SquaresFour, Stack, Storefront, Users, WarningCircle } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { COMO_CADASTROS, TOUR_CADASTROS } from "@/lib/comoTelas";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabase";
import { situacaoLoja } from "@/lib/agendaCardapio";
import "./cadastros.css";

/**
 * (21/10) Cadastros: um lugar só pra cadastrar tudo (no celular, é a aba do menu de baixo no lugar de "Cardápio").
 * Em cima, o que precisa de atenção; embaixo, três grupos: o que você vende, do que é feito, quem compra.
 * O cardápio digital é uma linha daqui (abre a tela dele, com link, aparência e compartilhar).
 */
type Contas = { produtos: number; semFicha: number; categorias: number; complementos: number; ingredientes: number; clientes: number };

export default function Cadastros() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [n, setN] = useState<Contas | null>(null);
  // (23/10) celular: o cardápio digital virou "Minha loja" (com os dados da loja dentro). No computador continua igual
  const [cel, setCel] = useState(() => typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const f = () => setCel(!mq.matches);
    mq.addEventListener("change", f); return () => mq.removeEventListener("change", f);
  }, []);

  useEffect(() => {
    const uid = profile?.id;
    if (!uid) return;
    let vivo = true;
    const conta = (tabela: string) => supabase.from(tabela).select("id", { count: "exact", head: true }).eq("user_id", uid)
      .then(r => (r.error ? null : r.count ?? 0), () => null);
    (async () => {
      const [prods, categorias, complementos, ingredientes, clientes] = await Promise.all([
        supabase.from("produtos").select("id, produto_insumos(id)").eq("user_id", uid).then(r => (r.error ? null : r.data || []), () => null),
        conta("categorias"), conta("biblioteca_extras"), conta("insumos"), conta("clientes"),
      ]);
      if (!vivo) return;
      const lista = (prods || []) as any[];
      setN({
        produtos: prods ? lista.length : -1,
        semFicha: prods ? lista.filter(p => !(p.produto_insumos || []).length).length : 0,
        categorias: categorias ?? -1, complementos: complementos ?? -1, ingredientes: ingredientes ?? -1, clientes: clientes ?? -1,
      });
    })();
    return () => { vivo = false; };
  }, [profile?.id]);

  const loja = useMemo(() => {
    const resto = cel ? "cardápio e entrega" : "link e aparência";
    if ((profile as any)?.loja_pausada === true) return { txt: `Pausado · ${resto}`, tom: "lar" };
    const s = situacaoLoja((profile as any)?.horario);
    if (!s) return { txt: cel ? "Cardápio, horário e entrega" : "Link, aparência e compartilhar", tom: "" };
    return s.aberto ? { txt: `Aberto agora · ${resto}`, tom: "ok" } : { txt: `Fechado agora · ${resto}`, tom: "lar" };
  }, [profile, cel]);

  const comFicha = n && n.produtos >= 0 ? n.produtos - n.semFicha : -1;
  // (22/10) no computador o número vem com o nome ("7 produtos"): a página vira uma grade de cartões
  const linha = (Ic: any, titulo: string, sub: ReactNode, ir: () => void, qtd?: number, tom = "", un?: [string, string]) => (
    <button type="button" className="cad-it" onClick={ir}>
      <span className="cad-ic" aria-hidden="true"><Ic size={20} weight="bold" /></span>
      <span className="cad-tx"><b>{titulo}</b><small className={tom}>{sub}</small></span>
      {qtd != null && qtd >= 0 && <span className="cad-n">{qtd}{un && <small className="cad-un">{qtd === 1 ? un[0] : un[1]}</small>}</span>}
      <CaretRight size={16} weight="bold" className="cad-seta" aria-hidden="true" />
    </button>
  );

  return (
    <>
      <AppPageHeader title="Cadastros" voltar="/inicio" subtitle="Produtos, clientes e cardápio" infoComo={COMO_CADASTROS} infoTour={TOUR_CADASTROS} />
      <div className="cad">
        {n && n.semFicha > 0 && (
          <button type="button" className="cad-at" onClick={() => navigate("/ficha-tecnica")}>
            <span className="cad-at-ic" aria-hidden="true"><WarningCircle size={22} weight="bold" /></span>
            <span className="cad-tx"><b>Precisa de atenção</b><small>{n.semFicha === 1 ? "1 produto sem ficha técnica" : `${n.semFicha} produtos sem ficha técnica`}</small></span>
            <CaretRight size={16} weight="bold" className="cad-seta" aria-hidden="true" />
          </button>
        )}

        <p className="cad-t">O que você vende</p>
        <div className="cad-c cad-c--vende">
          {linha(Cake, "Produtos", n && n.semFicha > 0 ? `${n.semFicha} sem ficha técnica` : "Cadastre e gerencie seus produtos", () => navigate("/produtos"), n?.produtos, n && n.semFicha > 0 ? "lar" : "", ["produto", "produtos"])}
          {linha(SquaresFour, "Categorias", "Organize seus produtos", () => navigate("/categorias"), n?.categorias, "", ["categoria", "categorias"])}
          {linha(Stack, "Complementos", "Topo, velas e outros extras", () => navigate("/complementos"), n?.complementos, "", ["complemento", "complementos"])}
          {linha(cel ? Storefront : ShoppingBag, cel ? "Minha loja" : "Cardápio digital", loja.txt, () => navigate("/cardapio"), undefined, loja.tom)}
        </div>

        <p className="cad-t">Do que é feito</p>
        <div className="cad-c cad-c--feito">
          {linha(Basket, "Ingredientes", "O que você compra", () => navigate("/insumos"), n?.ingredientes, "", ["ingrediente", "ingredientes"])}
          {linha(ClipboardText, "Ficha técnica", "Custo e lucro de cada produto", () => navigate("/ficha-tecnica"), comFicha, "", ["com ficha", "com ficha"])}
        </div>

        <p className="cad-t">{cel ? "Quem compra" : "Quem compra e como paga"}</p>
        <div className="cad-c cad-c--compra">
          {linha(Users, "Clientes", "Quem já comprou com você", () => navigate("/clientes"), n?.clientes, "", ["cliente", "clientes"])}
          {!cel && linha(Storefront, "Dados da loja", "Entrega, pagamento e Pix", () => navigate("/cardapio-config"))}
          {linha(ChatCircleText, "Mensagens do WhatsApp", "Textos prontos para o cliente", () => navigate("/configuracoes/mensagens", { state: { de: "/cadastros" } }))}
        </div>
      </div>
    </>
  );
}

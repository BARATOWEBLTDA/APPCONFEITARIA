import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator, CaretDown, Check, Info } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, Gaveta, TelaVazia, avisar, confirmar } from "@/components/base";
import { supabase } from "@/lib/supabase";
import { calcularCustoLucro, lerMaoObraConta, type MaoObraConta, type ProdutoCustoJson } from "@/lib/produto-precificacao";
import { taxaPctDaForma, fixoPorPedido } from "@/lib/painelFinanceiro";
import { explicarErro } from "@/lib/erros";
import { precoCardapioComPromocao, precosDosSabores, type ProdutoPrecoJson } from "@/lib/precoCardapio";
import { kitAtivo } from "@/lib/kitQuantidade";
import "./ferramentas.css";

/**
 * (6.170) Simulador de preço: escolhe um produto com ficha técnica, mexe no preço e vê na hora o lucro e a margem.
 * A conta é a mesma da Ficha técnica (ingredientes + invisíveis + mão de obra + taxa do crédito + embalagem por pedido).
 * Só a taxa da maquininha muda com o preço (é % da venda); o resto do custo é fixo.
 */
type Prod = ProdutoCustoJson & ProdutoPrecoJson & { id: string; nome: string; imagem_url?: string | null; promocao?: boolean | null; preco_normal?: number | null };

/** (6.174) o preço do cardápio vem dos tamanhos de preço fixo, do kit ou do sabor: "Usar esse preço" não mudaria nada */
const precoPorOpcao = (p: Prod) => {
  const gt = p.grupo_tamanhos;
  const tamFixo = !!gt?.ativo && (gt.opcoes || []).length > 0 && gt.modo_preco_tamanho !== "por_peso";
  return kitAtivo(p.kit_qtd) ? "Preço do kit: mude em Produtos" : tamFixo ? "Tem tamanhos: mude o preço em Produtos"
    : (precosDosSabores(p) || []).length ? "Preço pelo sabor: mude em Produtos" : "";
};
/** tamanhos pelo peso: o preço do produto é o do kg */
const porKg = (p: Prod) => !!p.grupo_tamanhos?.ativo && (p.grupo_tamanhos.opcoes || []).length > 0 && p.grupo_tamanhos.modo_preco_tamanho === "por_peso";

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${(Math.round(v * 10) / 10).toLocaleString("pt-BR")}%`;
const lerReais = (t: string) => { const n = Number(String(t).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const reaisTxt = (v: number) => (Math.round(v * 100) / 100).toFixed(2).replace(".", ",");
const fotoDe = (p: Prod) => String(p.imagem_url || "").split(",")[0].trim();
const MARGENS = [30, 40, 50];

export default function SimuladorPreco() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [produtos, setProdutos] = useState<Prod[]>([]);
  const [mao, setMao] = useState<MaoObraConta>(null);
  const [cvConta, setCvConta] = useState<number | null>(null);
  const [venda, setVenda] = useState({ pct: 0, fixo: 0 });
  const [selId, setSelId] = useState("");
  const [lista, setLista] = useState(false);
  const [precoTxt, setPrecoTxt] = useState("");
  const [vendasTxt, setVendasTxt] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setCarregando(true); setErro("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      const [prods, maoC, perfil, vars] = await Promise.all([
        supabase.from("produtos").select("id, nome, imagem_url, preco_normal, preco_promocional, promocao, tipo_promocao, desconto_percentual, cv_percentual, salario_desejado, tempo_preparo_min, horas_semanais, grupo_tamanhos, grupo_sabores, kit_qtd, produto_insumos(quantidade, unidade_utilizada, insumos(unidade, custo_unitario))")
          .eq("user_id", user.id).order("nome"),
        lerMaoObraConta(user.id).catch(() => null),
        supabase.from("profiles").select("custos_invisiveis_pct").eq("id", user.id).maybeSingle(),
        supabase.from("custos_variaveis").select("*").eq("user_id", user.id),
      ]);
      if (prods.error) throw prods.error;
      const comFicha = ((prods.data || []) as Prod[]).filter(p => (p.produto_insumos || []).some(x => x?.insumos));
      setProdutos(comFicha);
      setMao(maoC);
      const cv = (perfil.data as { custos_invisiveis_pct?: number | null } | null)?.custos_invisiveis_pct;
      setCvConta(cv != null ? Number(cv) : null);
      const v = ((vars.data || []) as Parameters<typeof taxaPctDaForma>[1]);
      setVenda({ pct: taxaPctDaForma("credito", v), fixo: fixoPorPedido(v) });
      if (comFicha.length && !selId) escolher(comFicha[0], maoC, cv != null ? Number(cv) : null);
    } catch (e) {
      setErro(explicarErro(e, "Tente de novo em instantes."));
    }
    setCarregando(false);
  };
  useEffect(() => { void carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = produtos.find(p => p.id === selId) || null;
  // custo que não muda com o preço (a taxa da maquininha muda: é % da venda)
  const base = useMemo(() => {
    if (!sel) return null;
    const c = calcularCustoLucro(sel, mao, cvConta, null);
    // (6.174) "Hoje" é o preço que o cardápio mostra (tamanho, kit ou sabor mais barato, já com a promoção)
    const pc = precoCardapioComPromocao(sel);
    return { cmv: c.cmv, cvPct: c.cvPct, cv: c.cv, mo: c.mo, tempoMin: c.tempoMin, fixo: c.cmv + c.cv + c.mo + venda.fixo, precoAtual: porKg(sel) ? c.preco : pc.final || c.preco, aPartir: !porKg(sel) && pc.aPartir };
  }, [sel, mao, cvConta, venda.fixo]);

  function escolher(p: Prod, m = mao, cv = cvConta) {
    setSelId(p.id);
    const c = calcularCustoLucro(p, m, cv, null);
    setPrecoTxt(reaisTxt(porKg(p) ? c.preco : precoCardapioComPromocao(p).final || c.preco));
  }

  const taxa = (Number(venda.pct) || 0) / 100;
  const preco = lerReais(precoTxt);
  const taxaValor = preco * taxa;
  const custo = base ? base.fixo + taxaValor : 0;
  const lucro = preco - custo;
  const margem = preco > 0 ? (lucro / preco) * 100 : 0;
  const tom = preco <= 0 ? "neutro" : lucro < 0 ? "neg" : margem < 30 ? "atencao" : "ok";
  const precoPara = (m: number) => base && 1 - taxa - m / 100 > 0 ? Math.ceil((base.fixo / (1 - taxa - m / 100)) * 10) / 10 : 0;
  const empate = base ? precoPara(0) : 0;
  // régua: do preço que empata até 3× ele
  const min = Math.max(1, Math.floor(empate * 0.8));
  const max = Math.max(min + 10, Math.ceil(Math.max(empate * 3, (base?.precoAtual || 0) * 1.5, preco * 1.2)));
  const vendas = Math.max(0, Math.floor(lerReais(vendasTxt)));
  const tempo = base && base.tempoMin > 0 ? (base.tempoMin >= 60 ? `${Math.floor(base.tempoMin / 60)}h${base.tempoMin % 60 ? String(base.tempoMin % 60).padStart(2, "0") : ""}` : `${base.tempoMin} min`) : "";
  const mudou = !!base && preco > 0 && Math.abs(preco - base.precoAtual) >= 0.005;
  const porOpcao = sel ? precoPorOpcao(sel) : "";
  const doKg = !!sel && porKg(sel);

  const usarPreco = async () => {
    if (!sel || !(preco > 0)) return;
    const emPromo = !!sel.promocao;
    const ok = await confirmar({
      titulo: `Usar ${brl(preco)}?`,
      texto: emPromo ? `${sel.nome} está em promoção. A promoção sai e o preço no cardápio passa a ser ${brl(preco)}.` : `O preço de ${sel.nome} no cardápio passa a ser ${brl(preco)}.`,
      rotulo: "Usar esse preço",
    });
    if (!ok) return;
    setSalvando(true);
    const { error } = await supabase.from("produtos").update({ preco_normal: Math.round(preco * 100) / 100, ...(emPromo ? { promocao: false } : {}), updated_at: new Date().toISOString() }).eq("id", sel.id);
    setSalvando(false);
    if (error) { avisar(explicarErro(error, "Não deu para salvar o preço. Tente de novo."), { tipo: "erro" }); return; }
    setProdutos(ps => ps.map(p => p.id === sel.id ? { ...p, preco_normal: Math.round(preco * 100) / 100, ...(emPromo ? { promocao: false } : {}) } : p));
    avisar("Preço salvo.", { tipo: "ok" });
  };

  return (
    <>
      <AppPageHeader title="Simulador de preço" subtitle="Teste preços e veja o lucro" voltar="/inicio" />
      <div className="fm sp">
        {carregando ? <div className="fm-card sp-ph" aria-label="Carregando" /> : erro ? (
          <TelaVazia icone={<Info size={28} />} titulo="Não deu pra carregar" texto={erro} acao={<Botao variante="suave" onClick={() => void carregar()}>Tentar de novo</Botao>} />
        ) : !produtos.length || !sel || !base ? (
          <TelaVazia icone={<Calculator size={28} />} titulo="Nenhum produto com ficha técnica"
            texto="O simulador usa o custo da ficha técnica. Monte a ficha de um produto e volte aqui."
            acao={<Botao onClick={() => navigate("/ficha-tecnica")}>Montar ficha técnica</Botao>} />
        ) : (
          <div className="sp-grade">
            <section className="fm-card sp-esq">
              <span className="fm-rot">Produto</span>
              <button type="button" className="fm-ing" onClick={() => setLista(true)}>
                {fotoDe(sel) ? <img className="sp-foto" src={fotoDe(sel)} alt="" /> : <span className="sp-foto sp-foto--l">{sel.nome.charAt(0).toUpperCase()}</span>}
                <span className="fm-ing-tx"><b>{sel.nome}</b><small>Hoje: {base.aPartir ? "a partir de " : ""}{brl(base.precoAtual)}{doKg ? " o kg" : ""}</small></span>
                <CaretDown size={18} weight="bold" aria-hidden="true" />
              </button>

              <label className="fm-campo sp-preco">
                <span className="fm-rot">{doKg ? "Preço do kg" : "Preço de venda"}</span>
                <span className="sp-preco-c"><i>R$</i><input inputMode="decimal" value={precoTxt} onChange={e => setPrecoTxt(e.target.value.replace(/[^\d,]/g, ""))} placeholder="0,00" aria-label="Preço de venda em reais" /></span>
              </label>
              <input type="range" className="sp-regua" min={min} max={max} step={0.5} value={Math.min(max, Math.max(min, preco || min))}
                onChange={e => setPrecoTxt(reaisTxt(Number(e.target.value)))} aria-label="Arraste para mudar o preço" />
              <div className="sp-regua-l" aria-hidden="true"><span>{brl(min)}</span><span>{brl(max)}</span></div>

              <span className="fm-rot sp-rot2">Margem que você quer</span>
              <div className="fm-rap" role="group" aria-label="Margem que você quer">
                {MARGENS.map(m => { const v = precoPara(m); return (
                  <button type="button" key={m} disabled={!v} className={v && Math.abs(v - preco) < 0.05 ? "on" : ""} onClick={() => setPrecoTxt(reaisTxt(v))}>{m}%</button>
                ); })}
              </div>

              <label className="fm-campo sp-vendas">
                <span className="fm-rot">Quantas vende por mês <em>opcional</em></span>
                <input inputMode="numeric" value={vendasTxt} onChange={e => setVendasTxt(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="Ex.: 20" />
              </label>
            </section>

            <section className={`sp-res sp-res--${tom}`} aria-live="polite">
              <small>{lucro < 0 ? "Prejuízo em cada venda" : "Lucro em cada venda"}</small>
              <strong>{brl(Math.abs(lucro))}</strong>
              <span className="sp-margem">{preco > 0 ? `${pct(margem)} de margem` : "Digite um preço"}</span>
              <div className="sp-barra" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, preco > 0 ? (custo / preco) * 100 : 0))}%` }} /></div>
              <p className="sp-frase">{preco <= 0 ? "" : lucro < 0 ? `Abaixo de ${brl(empate)} dá prejuízo.` : margem < 30 ? "Margem baixa: o ideal é passar de 30%." : "Boa margem: paga tudo e sobra lucro."}</p>
              {vendas > 0 && preco > 0 && <div className="sp-mes"><span>{vendas} vendas no mês</span><b>{lucro < 0 ? "− " : ""}{brl(Math.abs(lucro * vendas))}</b></div>}
              {porOpcao ? <p className="sp-opcao">{porOpcao}</p> : mudou && lucro >= 0 && <Botao cheio carregando={salvando} icone={<Check size={20} weight="bold" />} onClick={() => void usarPreco()}>Usar esse preço</Botao>}
            </section>

            <section className="fm-card sp-conta">
              <h2 className="fm-tit">De onde vem o custo</h2>
              <div className="sp-l"><span>Ingredientes</span><b>{brl(base.cmv)}</b></div>
              <div className="sp-l"><span>Custos invisíveis ({pct(base.cvPct)})</span><b>{brl(base.cv)}</b></div>
              <div className="sp-l"><span>Mão de obra{tempo ? ` (${tempo})` : ""}</span><b>{brl(base.mo)}</b></div>
              {venda.pct > 0 && <div className="sp-l"><span>Taxa no crédito ({pct(venda.pct)})</span><b>{brl(taxaValor)}</b></div>}
              {venda.fixo > 0 && <div className="sp-l"><span>Por pedido (embalagem)</span><b>{brl(venda.fixo)}</b></div>}
              <div className="sp-l sp-t"><span>Custo total</span><b>{brl(custo)}</b></div>
              <div className="sp-l"><span>Preço que empata</span><b>{brl(empate)}</b></div>
            </section>

            <p className="fm-nota"><Info size={16} weight="bold" aria-hidden="true" />O custo vem da ficha técnica e de Custos.</p>
          </div>
        )}
      </div>

      <Gaveta aberta={lista} aoFechar={() => setLista(false)} titulo="Escolher produto">
        <div className="fm-lista">
          {produtos.map(p => { const c = calcularCustoLucro(p, mao, cvConta, venda); return (
            <button type="button" key={p.id} className={`fm-li${p.id === selId ? " on" : ""}`} onClick={() => { escolher(p); setLista(false); }}>
              {fotoDe(p) ? <img className="sp-foto sp-foto--p" src={fotoDe(p)} alt="" /> : <span className="sp-foto sp-foto--p sp-foto--l">{p.nome.charAt(0).toUpperCase()}</span>}
              <span>{p.nome}</span><b className={c.lucro < 0 ? "sp-neg" : ""}>{brl(c.preco)}</b>
            </button>
          ); })}
        </div>
      </Gaveta>
    </>
  );
}

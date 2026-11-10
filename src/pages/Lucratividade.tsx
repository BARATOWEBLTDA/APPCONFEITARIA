// Lucratividade — refeita no padrão novo (03/10), com a MESMA regra do painel do Financeiro:
// lucro = vendido (pedidos entregues no mês) − custo dos ingredientes (ficha técnica) − despesas pagas
// (sem as de insumos, que já estão no custo da ficha). Mais: ponto de equilíbrio e lucro por produto.
import EstiloFinanceiro from "@/components/financeiro/EstiloFinanceiro";
import { useEffect, useRef, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";
import { useNavigate } from "react-router-dom";
import { ChartLineUp, Equals, Minus, ShoppingBagOpen, Warning, WarningCircle } from "@phosphor-icons/react";
import PeriodoFiltro, { iso as isoDia, periodoDoDia, periodoDoMes, periodoInicial, rotuloPeriodo, type Periodo } from "@/components/financeiro/PeriodoFiltro";
import { useDiaAtual } from "@/hooks/useAoVoltar";
import AppPageHeader from "@/components/AppPageHeader";
import { COMO_LUCRATIVIDADE, TOUR_LUCRATIVIDADE } from "@/lib/comoTelas";
import { Botao, TelaVazia } from "@/components/base";
import { CartaoPro } from "@/components/billing/RecursoPro";
import { supabase } from "@/lib/supabase";
import { buscarTudo } from "@/lib/buscarTudo";
import { calcularCustoLucro, lerMaoObraConta, rendeDaFicha, type ProdutoCustoJson } from "@/lib/produto-precificacao";
import { carregarIntervalo, custoPorProduto, multiplicadorDoItem, produtosPeloPeso, taxaPctDaForma, fixoPorPedido, type MesFinanceiro } from "@/lib/painelFinanceiro";

/** Item vendido (com o produto, que vem como objeto) */
type ItemLucro = {
  nome_produto?: string | null; quantidade?: number | string | null; valor_unitario?: number | string | null
  personalizacoes?: { tamanho?: unknown } | null
  produtos?: { id: string; nome?: string | null; forma_venda?: string | null; imagem_url?: string | null; kit_qtd?: unknown } | null
};
type PedidoLucro = { status: string; forma_pagamento?: string | null; pedido_itens?: ItemLucro[] | null };
type Produto = { chave: string; nome: string; foto: string; qtd: number; vendido: number; custo: number; lucro: number; margem: number; semFicha: boolean; kg?: boolean };
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });


const CSS_AMOSTRA = `
  .lu-amostra { filter: blur(6px); opacity: .7; pointer-events: none; user-select: none; max-height: calc(100dvh - 140px); overflow: hidden; }
  .lu-gratis { position: relative; }
  .lu-pro { padding: 16px 16px 0; max-width: 1100px; margin: 0 auto; box-sizing: border-box; }
  .lu-ex-t { margin: 20px 16px 0; font-size: 12.5px; font-weight: 500; color: var(--ui-texto-2); text-align: center; }
  .lu-convite { position: absolute; left: 0; right: 0; top: 140px; z-index: 2; width: calc(100% - 40px); max-width: 380px; margin: 0 auto; padding: 26px 22px; box-sizing: border-box; border-radius: 20px; background: var(--ui-branco); box-shadow: 0 12px 40px rgba(45, 31, 38, .18); text-align: center; }
  .lu-convite-ic { display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; margin: 0 auto 12px; border-radius: 50%; background: var(--ui-branco); color: var(--ui-rosa-escuro); border: 1px solid #ECE7E9; box-sizing: border-box; }
  .lu-convite b { display: block; font-size: 18px; font-weight: 600; color: var(--ui-texto); }
  .lu-convite p { margin: 8px 0 16px; font-size: 14px; line-height: 1.5; color: var(--ui-texto-2); }
`;

/** (27/10) Lucratividade é do PRO: a conta grátis vê o convite em cima de um relatório de exemplo borrado */
export default function Lucratividade() {
  const { isPro, loading } = usePlano();
  const navigate = useNavigate();
  if (loading) return null;
  if (isPro) return <LucratividadeTela />;
  return (
    <>
      <AppPageHeader title="Lucratividade" subtitle="Onde está o seu lucro de verdade" onBack={() => navigate("/financeiro")} />
      <EstiloFinanceiro />
      {/* (27/10) atrás do convite, um relatório de EXEMPLO borrado (números inventados, nada da conta dela): mostra o que o PRO entrega */}
      {/* (6.110) o convite no padrão do app (faixa rosa, mascote e 3 benefícios) e, embaixo, o exemplo borrado do relatório */}
      <div className="lu-gratis">
      <div className="lu-pro"><CartaoPro recurso="lucratividade" /></div>
      <p className="lu-ex-t">Exemplo do relatório</p>
      <div className="lu lu-amostra" aria-hidden="true">
        <div className="lu-conta">
          {([["Vendido", "R$ 4.850,00", "n", "18 entregues"], ["Ingredientes", "R$ 1.620,00", "s", "pela ficha técnica"], ["Taxas", "R$ 96,00", "s", "cobradas por pedido"], ["Despesas", "R$ 980,00", "s", "sem os ingredientes"]] as const).map(([t, v, c, i]) => (
            <div key={t} className="lu-k"><span className={`lu-ki ${c}`}>{c === "n" ? <ShoppingBagOpen size={15} weight="bold" /> : <Minus size={15} weight="bold" />}</span><small>{t}</small><b className={c === "s" ? "s" : ""}>{v}</b><i>{i}</i></div>
          ))}
          <div className="lu-k lu-k--lucro"><span className="lu-ki l"><Equals size={15} weight="bold" /></span><small>Lucro do mês</small><b>R$ 2.154,00</b>
            <div className="lu-margem"><div className="lu-bar"><i style={{ width: "44%" }} /></div><span>margem de <b>44%</b></span></div></div>
        </div>
        <section className="lu-card"><p className="lu-ct">Lucro por produto <small>A mesma conta da ficha técnica</small></p>
          <ul className="lu-pg">{[["Bolo de brigadeiro", "6 vendidos · R$ 720,00", "R$ 412,00", 57], ["Caixa de doces", "9 vendidos · R$ 405,00", "R$ 230,00", 57], ["Torta de morango", "3 vendidos · R$ 390,00", "R$ 168,00", 43]].map(([n, q, l, m]) => (
            <li key={n as string} className="lu-pc"><span className="lu-pc-foto"><ShoppingBagOpen size={28} /></span><span className="lu-pc-tx"><b className="lu-pc-nm">{n}</b><small>{q}</small><span className="lu-pc-l">Lucro</span><strong>{l}</strong><span className="lu-pc-m"><span className="lu-p-bar"><i style={{ width: `${m}%` }} /></span>margem {m}%</span></span></li>
          ))}</ul>
        </section>
      </div>
      </div>
      <style>{CSS}{CSS_AMOSTRA}</style>
    </>
  );
}

function LucratividadeTela() {
  const navigate = useNavigate();
  // (23/10) o mesmo filtro de período do Financeiro e de Transações (abre no mês de hoje)
  // (01/11 · 5.99) nos 5 primeiros dias o mês novo ainda está quase vazio: abre no mês que acabou de fechar
  const [periodo, setPeriodo] = useState<Periodo>(() => { const h = new Date(); return h.getDate() <= 5 ? periodoDoMes(h.getFullYear(), h.getMonth() - 1) : periodoInicial(); });
  const diaAtual = useDiaAtual();
  useEffect(() => { setPeriodo(p => periodoDoDia(p)); }, [diaAtual]);
  const ehMes = periodo.tipo === "mes";
  const [dados, setDados] = useState<MesFinanceiro | null>(null);
  const [produtos, setProdutos] = useState<Produto[] | null>(null);
  const [fixos, setFixos] = useState<{ custos: number; salario: number } | null>(null);
  const [erro, setErro] = useState(false); // não deu pra carregar (10/10)
  const [tentativa, setTentativa] = useState(0);
  const [verTodosProd, setVerTodosProd] = useState(false);
  // (19/10) o id da conta que já está na memória: trocar de mês não pede o usuário de novo ao Supabase
  // (duas buscas seguidas do usuário podiam travar e a tela ficava em branco pra sempre)
  const { profile } = useProfile();
  const uidRef = useRef<string | null>(null);
  uidRef.current = profile?.id || uidRef.current;

  useEffect(() => {
    // 10/10: ao trocar de mês rápido, só vale a resposta da última busca (a atrasada era aplicada por cima da nova).
    // E se alguma busca falhar, a tela avisa em vez de mostrar "nenhum pedido entregue" ou um lucro errado.
    let cancelado = false;
    // (19/10) se nada voltar em 20 s, a tela mostra "Tentar de novo" em vez de ficar em branco
    const relogio = setTimeout(() => { if (!cancelado) setErro(true); }, 20000);
    (async () => {
      setDados(null); setProdutos(null); setErro(false);
      let uid = uidRef.current;
      if (!uid) {
        const { data: { user }, error: eUser } = await supabase.auth.getUser();
        if (cancelado) return;
        if (!user) { setErro(true); void eUser; return; }
        uid = user.id;
      }
      const user = { id: uid };
      // no Mês, o mês inteiro (como sempre foi: pedido do mês já entregue conta, mesmo com a data de entrega mais pra frente)
      const ini = periodo.ini <= periodo.fim ? periodo.ini : periodo.fim;
      const fim = periodo.tipo === "mes" ? isoDia(new Date(periodo.ano, periodo.mes + 1, 0)) : (periodo.ini <= periodo.fim ? periodo.fim : periodo.ini);
      const [d, peds, cf, mo] = await Promise.all([
        carregarIntervalo(user.id, ini, fim),
        // de 1.000 em 1.000, igual ao painel (o Supabase corta em 1.000 linhas sem avisar)
        buscarTudo<PedidoLucro>((de, ate) => supabase.from("pedidos").select("status, forma_pagamento, pedido_itens(nome_produto, quantidade, valor_unitario, personalizacoes, produtos(id, nome, forma_venda, imagem_url, kit_qtd))")
          .eq("user_id", user.id).eq("status", "entregue").gte("data_entrega", ini).lte("data_entrega", fim).order("id").range(de, ate) as PromiseLike<{ data: PedidoLucro[] | null; error: unknown }>),
        supabase.from("custos_fixos").select("valor, ativo").eq("user_id", user.id),
        supabase.from("config_mao_obra").select("salario_mensal, horas_dia, dias_semana").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelado) return;
      if (d.erro || peds.error || cf.error || mo.error) { clearTimeout(relogio); setErro(true); return; }
      setDados(d);
      setFixos({ custos: ((cf.data as { valor: number | string; ativo?: boolean | null }[]) || []).filter(x => x.ativo !== false).reduce((s, x) => s + (Number(x.valor) || 0), 0), salario: Number((mo.data as { salario_mensal?: number | string | null } | null)?.salario_mensal) || 0 });
      // lucro por produto
      const pedsOk = peds.data.filter(p => p.status !== "cancelado");
      const itens = pedsOk.flatMap(p => p.pedido_itens || []);
      // (6.182) a forma de pagamento e a parte da embalagem de cada item (a embalagem é por pedido, dividida entre os itens)
      const formaDoIt = new Map<ItemLucro, string | null>(), parteDoIt = new Map<ItemLucro, number>();
      for (const p of pedsOk) { const l = p.pedido_itens || []; for (const it of l) { formaDoIt.set(it, p.forma_pagamento ?? null); parteDoIt.set(it, l.length ? 1 / l.length : 0); } }
      const ids = [...new Set(itens.map((it: ItemLucro) => it.produtos?.id).filter(Boolean))] as string[];
      // (6.08) a mesma régua do Lucro do mês: o produto tira só os ingredientes (a sua hora entra no Ponto de equilíbrio)
      // (6.173) o lucro de cada produto usa a MESMA conta da Ficha técnica: ingredientes + invisíveis + mão de obra + taxa do crédito e embalagem
      const [custo, peloPeso, extras, maoC, perfilCv, vars] = await Promise.all([
        custoPorProduto(ids), produtosPeloPeso(itens),
        // (6.182) em grupos de 30 (lista grande estourava o tamanho do endereço)
        Promise.all(Array.from({ length: Math.ceil(ids.length / 30) }, (_, k) => supabase.from("produtos").select("id, cv_percentual, salario_desejado, tempo_preparo_min, horas_semanais, ficha_rende").in("id", ids.slice(k * 30, k * 30 + 30))))
          .then(rs => ({ data: rs.flatMap(r => (r.data || []) as unknown[]), error: rs.find(r => r.error)?.error || null })),
        lerMaoObraConta(user.id).catch(() => null),
        supabase.from("profiles").select("custos_invisiveis_pct").eq("id", user.id).maybeSingle(),
        supabase.from("custos_variaveis").select("*").eq("user_id", user.id),
      ]);
      if (cancelado) return;
      if (extras.error || vars.error) { clearTimeout(relogio); setErro(true); return; } // (6.182) sem isso a mão de obra e as taxas zeravam sem aviso
      const cvC = (perfilCv.data as { custos_invisiveis_pct?: number | null } | null)?.custos_invisiveis_pct;
      const vv = ((vars.data || []) as Parameters<typeof taxaPctDaForma>[1]);
      const fixoPed = fixoPorPedido(vv);
      const extraDe: Record<string, ProdutoCustoJson> = {};
      for (const e of ((extras.data || []) as (ProdutoCustoJson & { id: string })[])) extraDe[e.id] = e;
      // custo da unidade como na ficha (a conta é a mesma função: o custo dos ingredientes entra como uma linha só)
      const unidadeFicha = (id: string) => {
        const c = calcularCustoLucro({ ...(extraDe[id] || {}), produto_insumos: [{ quantidade: (custo[id] || 0) * rendeDaFicha(extraDe[id]), /* custo[id] já é de 1 unidade; a conta divide de novo */ unidade_utilizada: "un", insumos: { unidade: "un", custo_unitario: 1 } }] }, maoC, cvC != null ? Number(cvC) : null, null);
        return c.cmv + c.cv + c.mo;
      };
      const mapa: Record<string, Produto> = {};
      for (const it of itens) {
        const id = it.produtos?.id; const chave = id || `nome:${it.nome_produto}`;
        const p = mapa[chave] || (mapa[chave] = { chave, nome: it.produtos?.nome || it.nome_produto || "Produto", foto: String(it.produtos?.imagem_url || "").split(",")[0].trim(), qtd: 0, vendido: 0, custo: 0, lucro: 0, margem: 0, semFicha: false, kg: it.produtos?.forma_venda === "kg" && !it.personalizacoes?.tamanho } as Produto);
        const q = Number(it.quantidade) || 0;
        p.qtd += q; p.vendido += (Number(it.valor_unitario) || 0) * q;
        const c = id ? custo[id] : 0;
        // 11/10: tamanho pelo peso ("M · 2 kg") e kit (50 un) custam o tamanho/kit inteiro, não 1 kg ou 1 unidade
        if (c && id) p.custo += unidadeFicha(id) * multiplicadorDoItem(it, peloPeso) * q + (Number(it.valor_unitario) || 0) * q * (taxaPctDaForma(formaDoIt.get(it), vv) / 100) + fixoPed * (parteDoIt.get(it) ?? 0); else p.semFicha = true;
      }
      const lista = Object.values(mapa).map(p => ({ ...p, lucro: p.vendido - p.custo, margem: p.vendido > 0 ? Math.round(((p.vendido - p.custo) / p.vendido) * 100) : 0 }))
        .sort((a, b) => b.lucro - a.lucro);
      setProdutos(lista);
      clearTimeout(relogio);
    })().catch(e => {
      console.error("[lucratividade] não consegui carregar:", e);
      if (!cancelado) { setDados(null); setErro(true); }
    });
    return () => { cancelado = true; clearTimeout(relogio); };
  }, [periodo.tipo, periodo.ini, periodo.fim, tentativa]); // eslint-disable-line react-hooks/exhaustive-deps

  // (6.157) as despesas que entram no lucro: sem ingredientes e, com custo "R$ por pedido", sem embalagem (a mesma conta do painel)
  const despesasSemInsumos = dados ? dados.despesasNoLucro : 0;
  // (13/10) o que sobra de cada venda já tira as taxas da maquininha e a embalagem
  const margemBruta = dados && dados.vendido > 0 ? (dados.vendido - dados.cmv - dados.custosVariaveis) / dados.vendido : 0;
  const metaEquilibrio = fixos && margemBruta > 0 ? (fixos.custos + fixos.salario) / margemBruta : 0;
  const semFicha = (produtos || []).filter(p => p.semFicha);
  // (6.07) uma lista só: prejuízo primeiro (o pior em cima), depois lucro, depois sem ficha; mostra 10 e "Ver todos"
  const emPrejuizo = (produtos || []).filter(p => !p.semFicha && p.lucro < 0).sort((a, b) => a.lucro - b.lucro);
  const listaProd = [...emPrejuizo, ...(produtos || []).filter(p => !p.semFicha && p.lucro >= 0), ...semFicha];
  const LIMITE_PROD = 10;
  const prodVisiveis = verTodosProd ? listaProd : listaProd.slice(0, LIMITE_PROD);
  // 10/10: produto vendido sem ficha (ou custo de ingredientes zerado) = lucro e margem maiores do que são: avisa
  const qtdSemFicha = produtos && produtos.length ? semFicha.length : (dados?.semFicha || 0);
  const faltaFicha = !!dados && dados.qtdVendidos > 0 && (dados.cmv === 0 || qtdSemFicha > 0);

  return (
    <>
      <AppPageHeader
        title="Lucratividade"
        subtitle="Onde está o seu lucro de verdade"
        onBack={() => navigate("/financeiro")} infoComo={COMO_LUCRATIVIDADE} infoTour={TOUR_LUCRATIVIDADE}
        infoIcon="📈"
        infoContent={<>
          <p>O lucro aqui é <strong>o mesmo do painel do Financeiro</strong>: o que você vendeu (pedidos entregues) menos o custo dos ingredientes (ficha técnica), as taxas da maquininha e a embalagem de cada pedido, e as despesas pagas do mês.</p>
          <p>A taxa da maquininha entra só nos pedidos pagos no cartão, a do crédito ou a do débito. Pix e dinheiro não pagam taxa.</p>
          <p>As despesas de <strong>ingredientes</strong> não entram de novo, porque o custo deles já está na ficha técnica de cada produto.</p>
          {/* (6.157) embalagem também não conta 2x */}
          <p>Se você cadastrou um custo <strong>por pedido</strong> (como a embalagem), as compras de <strong>Embalagens</strong> também não entram de novo: o custo já está em cada pedido.</p>
        </>}
      />
      <EstiloFinanceiro />
      {/* (23/10) igual às outras telas do Financeiro: fundo cinza, sem a faixa rosa embaixo do topo */}
      <div className="lu">
        <div className="lu-per"><PeriodoFiltro valor={periodo} onChange={setPeriodo} /></div>

        {erro ? (
          <TelaVazia caixa icone={<WarningCircle size={30} />} titulo="Não deu para carregar a lucratividade" texto="Confira a internet e tente de novo."
            acao={<Botao variante="suave" tamanho="m" onClick={() => setTentativa(t => t + 1)}>Tentar de novo</Botao>} />
        ) : !dados ? <div className="lu-ph" /> : dados.qtdVendidos === 0 ? (
          <div className="lu-vazio">
            <span className="lu-vazio-ic"><ChartLineUp size={30} weight="duotone" /></span>
            <b>Nada entregue {rotuloPeriodo(periodo)}</b>
            <p>A lucratividade aparece quando você marca pedidos como <strong>entregues</strong>. Ela usa o valor do pedido e o custo da ficha técnica de cada produto.</p>
            <button type="button" className="lu-cta" onClick={() => navigate("/pedidos")}>Ver meus pedidos</button>
          </div>
        ) : (<>
          {/* a conta do período, da esquerda pra direita: vendido − ingredientes − despesas = lucro */}
          <div className="lu-conta">
            <div className="lu-k"><span className="lu-ki n" aria-hidden="true"><ShoppingBagOpen size={15} weight="bold" /></span><small>Vendido</small><b>{brl(dados.vendido)}</b>
              <i>{dados.qtdVendidos} {dados.qtdVendidos === 1 ? "entregue" : "entregues"}</i></div>
            <div className="lu-k"><span className="lu-ki s" aria-hidden="true"><Minus size={15} weight="bold" /></span><small>Ingredientes</small><b className="s">{brl(dados.cmv)}</b>
              <i>pela ficha técnica</i></div>
            <div className="lu-k"><span className="lu-ki s" aria-hidden="true"><Minus size={15} weight="bold" /></span><small>Taxas</small><b className="s">{brl(dados.custosVariaveis)}</b>
              <i>{dados.custosVariaveis > 0 ? "cobradas por pedido" : <button type="button" className="lu-link" onClick={() => navigate("/custos")}>Cadastrar taxas</button>}</i></div>
            <div className="lu-k"><span className="lu-ki s" aria-hidden="true"><Minus size={15} weight="bold" /></span><small>Despesas</small><b className="s">{brl(despesasSemInsumos)}</b>
              <i>{dados.despesasEmbalagens > 0 ? "sem ingredientes e embalagem" : "sem os ingredientes"}</i></div>
            <div className={`lu-k lu-k--lucro${dados.lucro < 0 ? " ruim" : ""}`}><span className="lu-ki l" aria-hidden="true"><Equals size={15} weight="bold" /></span><small>{ehMes ? "Lucro do mês" : "Lucro do período"}</small><b>{brl(dados.lucro)}</b>
              <div className="lu-margem"><div className="lu-bar"><i style={{ width: `${Math.max(0, Math.min(100, dados.margem))}%` }} /></div><span>margem de <b>{dados.margem}%</b></span></div></div>
          </div>

          {faltaFicha && (
            <div className="lu-aviso" role="note">
              <Warning size={16} weight="bold" />
              <span>
                {qtdSemFicha > 0
                  ? `${qtdSemFicha} ${qtdSemFicha === 1 ? "produto vendido está" : "produtos vendidos estão"} sem ficha técnica: o custo dos ingredientes deles não entrou na conta, então o lucro aparece maior do que é.`
                  : "Os produtos vendidos estão sem ficha técnica: o custo dos ingredientes não entrou na conta, então o lucro aparece maior do que é."}
              </span>
              <button type="button" className="lu-aviso-bt" onClick={() => navigate("/ficha-tecnica")}>Montar ficha técnica</button>
            </div>
          )}

          <div className="lu-grid">
            <section className="lu-card lu-a-prod">
              <p className="lu-ct">Lucro por produto <small>A mesma conta da ficha técnica</small></p>
              {!produtos ? <div className="lu-ph" style={{ height: 120 }} /> : produtos.length === 0 ? (
                <p className="lu-vz">Monte a <button type="button" className="lu-link" onClick={() => navigate("/ficha-tecnica")}>ficha técnica dos produtos</button> para ver o lucro de cada um.</p>
              ) : (
                <>
                {emPrejuizo.length > 0 && <p className="lu-prej"><i aria-hidden="true" />{emPrejuizo.length === 1 ? "1 produto está dando prejuízo" : `${emPrejuizo.length} produtos estão dando prejuízo`}</p>}
                <div className="lu-pg lu-tab">
                  <div className="lu-th" aria-hidden="true"><span /><span>Produto</span><span>Vendidos</span><span>Faturou</span><span>Lucro</span><span>Margem</span></div>
                  {prodVisiveis.map(p => {
                    const semId = p.chave.startsWith("nome:");
                    const qtd = p.kg ? `${p.qtd.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg` : `${p.qtd.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${p.qtd === 1 ? "vendido" : "vendidos"}`;
                    const ruim = !p.semFicha && p.lucro < 0;
                    const lucro = p.semFicha
                      ? <strong className={`sf${semId ? " sem-id" : ""}`}>{semId ? "Sem ficha" : "Montar ficha"}</strong>
                      : <strong className={ruim ? "ruim" : ""}>{brl(p.lucro)}</strong>;
                    const margem = p.semFicha ? "—" : `${p.margem}%`;
                    return (
                    <div key={p.chave} className={`lu-pc${semId ? "" : " lu-pc--bt"}`}
                      {...(semId ? {} : { role: "button", tabIndex: 0, "aria-label": `${p.nome}: ${p.semFicha ? "montar a ficha técnica" : "ver a ficha técnica"}`,
                        onClick: () => navigate("/ficha-tecnica", { state: { produtoId: p.chave } }),
                        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/ficha-tecnica", { state: { produtoId: p.chave } }); } } })}>
                      <span className="lu-pc-foto">{p.foto ? <img src={p.foto} alt="" loading="lazy" /> : <ShoppingBagOpen size={24} aria-hidden="true" />}</span>
                      {/* celular: nome e "x vendidos · R$" à esquerda, lucro e margem à direita */}
                      <span className="lu-pc-tx">
                        <b className="lu-pc-nm">{p.nome}</b>
                        <small>{qtd} · {brl(p.vendido)}</small>
                        {lucro}
                        {!p.semFicha && <span className={`lu-pc-m${ruim ? " ruim" : ""}`}>margem {p.margem}%</span>}
                      </span>
                      {/* computador: uma coluna por número, alinhadas */}
                      <span className="lu-col lu-col-q">{qtd}</span>
                      <span className="lu-col lu-col-f">{brl(p.vendido)}</span>
                      <span className="lu-col lu-col-l">{lucro}</span>
                      <span className={`lu-col lu-col-m${ruim ? " ruim" : ""}`}>{margem}</span>
                    </div>
                  ); })}
                </div>
                {listaProd.length > LIMITE_PROD && (
                  <button type="button" className="lu-mais" onClick={() => setVerTodosProd(v => !v)}>{verTodosProd ? "Ver menos" : `Ver todos (${listaProd.length})`}</button>
                )}
                </>
              )}
            </section>

            <section className="lu-card lu-a-eq">
              <p className="lu-ct">Ponto de equilíbrio <small>Quanto vender no mês para pagar tudo</small></p>
              {!ehMes ? (<>
                <p className="lu-eq-t">O ponto de equilíbrio é uma meta mensal. Escolha um mês para ver quanto precisa vender.</p>
                <button type="button" className="lu-sec" onClick={() => setPeriodo(periodoInicial())}>Ver o mês atual</button>
              </>) : fixos && (fixos.custos + fixos.salario) > 0 && margemBruta > 0 ? (<>
                <b className="lu-eq-v">{brl(metaEquilibrio)} <small>no mês</small></b>
                <p className="lu-eq-t">custos fixos + salário ({brl(fixos.custos + fixos.salario)})</p>
                <div className="lu-bar grande"><i className={dados.vendido >= metaEquilibrio ? "ok" : ""} style={{ width: `${Math.min(100, (dados.vendido / metaEquilibrio) * 100)}%` }} /></div>
                <p className="lu-eq-s">{dados.vendido >= metaEquilibrio ? `Bateu! ${brl(dados.vendido - metaEquilibrio)} acima do necessário.` : `Faltam ${brl(metaEquilibrio - dados.vendido)} · ${Math.round((dados.vendido / metaEquilibrio) * 100)}% do caminho`}</p>
                <p className="lu-nota">Com a sua margem de ingredientes de {Math.round(margemBruta * 100)}%.</p>
              </>) : fixos && (fixos.custos + fixos.salario) > 0 ? (
                <p className="lu-eq-t">{dados.vendido > 0
                  ? `Neste mês, os ingredientes custaram ${dados.cmv > dados.vendido ? "mais do que" : "o mesmo que"} você vendeu. Assim não sobra para pagar os custos fixos e o seu salário, e não existe ponto de equilíbrio.`
                  : "Os pedidos entregues neste mês estão sem valor, então não dá para calcular o ponto de equilíbrio."}</p>
              ) : (<>
                <p className="lu-eq-t">Cadastre seus custos fixos e o seu salário para saber quanto precisa vender no mês para fechar no azul.</p>
                <button type="button" className="lu-sec" onClick={() => navigate("/custos")}>Cadastrar custos</button>
              </>)}
            </section>
          </div>
        </>)}
      </div>
      <style>{CSS}</style>
    </>
  );
}

const CSS = `
  .lu { position: relative; margin: 0 auto; max-width: 1160px; padding: 14px 0 96px; font-family: var(--font-base); color: var(--ui-texto); display: flex; flex-direction: column; gap: 14px; }
  .lu-ph { height: 260px; background: #FAF7F8; border-radius: var(--ui-raio-cartao); }
  .lu-vazio { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 18px; padding: 30px 20px; text-align: center; }
  .lu-vazio-ic { width: 60px; height: 60px; border-radius: 18px; background: var(--ui-branco); color: var(--ui-rosa-escuro); display: inline-flex; align-items: center; justify-content: center; border: 1px solid #ECE7E9; box-sizing: border-box; }
  .lu-vazio b { display: block; font-size: 17px; font-weight: 600; margin-top: 12px; }
  .lu-vazio p { font-size: 13.5px; color: var(--ui-texto-2); line-height: 1.45; margin: 6px auto 0; max-width: 400px; text-wrap: balance; }
  .lu-cta { margin-top: 14px; border: none; border-radius: var(--ui-raio); padding: 12px 18px; background: var(--ui-rosa-botao, #CC2E66); color: var(--ui-branco); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
  /* a conta em 4 cartões */
  .lu-conta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .lu-conta > .lu-k--lucro { grid-column: 1 / -1; }
  @media (min-width: 1024px) { .lu-conta { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; } .lu-conta > .lu-k--lucro { grid-column: auto; } }
  .lu-k { position: relative; background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 16px; padding: 14px; min-width: 0; }
  .lu-k small { display: block; padding-right: 32px; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lu-k > b { display: block; margin: 6px 0 4px; font-size: clamp(17px, 4.6vw, 26px); font-weight: 600; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lu-k > b.s { color: var(--ui-texto); } /* (6.06) gasto normal do mês não é alarme: número escuro, o "−" já diz que é gasto */
  .lu-k i { display: block; font-style: normal; font-size: 12.5px; color: var(--ui-texto-2); line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lu-ki { position: absolute; top: 12px; right: 12px; width: 28px; height: 28px; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
  .lu-ki.n { background: var(--ui-cinza); color: var(--ui-texto-2); } .lu-ki.s { background: var(--ui-cinza); color: var(--ui-texto-2); } .lu-ki.l { background: #DCFCE7; color: #15803D; } .lu-k--lucro.ruim .lu-ki.l { background: var(--ui-vermelho-fundo); color: var(--ui-vermelho); }
  /* (6.06) lucro: verde quando sobra, vermelho só no prejuízo */
  .lu-k--lucro { border-color: #BBF7D0; background: #F0FDF4; } .lu-k--lucro > b { color: #15803D; }
  .lu-k--lucro.ruim { border-color: #FECACA; background: #FEF2F2; } .lu-k--lucro.ruim > b { color: var(--ui-vermelho); }
  .lu-margem .lu-bar i { background: #22C55E; }
  .lu-margem { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--ui-texto-2); } .lu-margem .lu-bar { flex: 1; }
  .lu-margem b { font-weight: 600; color: var(--ui-texto); }
  .lu-bar { height: 8px; border-radius: 9px; background: var(--ui-linha); overflow: hidden; } .lu-bar i { display: block; height: 100%; background: var(--ui-rosa); border-radius: 9px; }
  .lu-bar.grande { height: 12px; margin: 14px 0 8px; } .lu-bar i.ok { background: #15803D; }
  /* aviso de ficha técnica: uma faixa só */
  .lu-aviso { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; border-radius: 14px; padding: 10px 12px; font-size: 13.5px; font-weight: 500; line-height: 1.45; }
  .lu-aviso > span { flex: 1 1 260px; text-wrap: balance; } .lu-aviso svg { flex-shrink: 0; } /* (24/10) balance: as duas linhas do mesmo tamanho (antes sobrava "é." sozinho na 2ª linha) */
  .lu-aviso-bt { flex: none; min-height: 40px; padding: 0 14px; border: 0; border-radius: 10px; background: var(--ui-rosa-botao, #CC2E66); color: var(--ui-branco); font-family: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; }
  /* produto + equilíbrio */
  .lu-grid { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); grid-template-areas: "prod" "eq"; }
  @media (min-width: 1024px) { .lu-grid { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); grid-template-areas: "prod eq"; align-items: start; gap: 16px; } }
  .lu-a-eq { grid-area: eq; } .lu-a-prod { grid-area: prod; }
  .lu-card { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 16px; padding: 16px 18px; }
  .lu-ct { margin: 0 0 10px; font-size: 15.5px; font-weight: 600; } .lu-ct small { display: block; margin-top: 2px; font-size: 12.5px; font-weight: 400; color: var(--ui-texto-2); }
  .lu-vz { margin: 4px 0 0; font-size: 14px; line-height: 1.5; color: var(--ui-texto-2); }
  /* (6.06) uma lista compacta em todas as larguras: foto pequena, nome, vendidos, lucro e margem (cartões grandes viravam um mar de quadrados) */
  .lu-pg { margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; }
  .lu-pc { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--ui-linha); background: var(--ui-branco); }
  .lu-pc:last-child { border-bottom: 0; }
  /* computador: duas colunas (uma lista comprida de 37 linhas cansava) */
  .lu-th, .lu-col { display: none; }
  .lu-pc-m.ruim { color: var(--ui-vermelho); }
  /* (6.08) computador: uma tabela (Produto · Vendidos · Faturou · Lucro · Margem), o nome inteiro e a ordem clara */
  @media (min-width: 1024px) {
    .lu-tab .lu-th, .lu-tab .lu-pc { display: grid; grid-template-columns: 40px minmax(0, 1fr) 96px 108px 108px 64px; column-gap: 12px; align-items: center; }
    .lu-tab .lu-th { padding: 0 0 8px; border-bottom: 1px solid var(--ui-linha); font-size: 12.5px; font-weight: 500; color: var(--ui-texto-2); }
    .lu-tab .lu-th span:nth-child(n+3) { text-align: right; }
    .lu-tab .lu-pc { padding: 8px 0; }
    .lu-tab .lu-pc-foto { width: 40px; height: 40px; border-radius: 10px; }
    .lu-tab .lu-pc-tx { display: block; min-width: 0; overflow: hidden; } /* (6.172) nome longo não passa por cima de "Vendidos" */
    .lu-tab .lu-pc-nm { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; white-space: normal; overflow: hidden; line-height: 1.3; }
    .lu-tab .lu-pc-tx > :not(.lu-pc-nm) { display: none; }
    .lu-tab .lu-col { display: block; text-align: right; font-size: 14px; color: var(--ui-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .lu-tab .lu-col-q, .lu-tab .lu-col-m { color: var(--ui-texto-2); }
    .lu-tab .lu-col-m.ruim { color: var(--ui-vermelho); }
    .lu-tab .lu-col strong { font-size: 14px; font-weight: 600; color: var(--ui-verde); } .lu-tab .lu-col strong.ruim { color: var(--ui-vermelho); }
    .lu-tab .lu-col strong.sf { color: var(--ui-rosa-escuro); } .lu-tab .lu-col strong.sf.sem-id { color: var(--ui-texto-2); font-weight: 500; }
  }
  .lu-prej { display: flex; align-items: center; gap: 8px; margin: 2px 0 4px; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
  .lu-prej i { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--ui-vermelho); }
  .lu-mais { display: block; width: 100%; min-height: 44px; margin-top: 6px; border: 0; border-top: 1px solid var(--ui-linha); background: none; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--ui-rosa-escuro); cursor: pointer; }
  .lu-pc-foto { position: relative; flex: none; width: 52px; height: 52px; border-radius: 12px; overflow: hidden; background: #F8F3F5; color: #C9B8BF; display: flex; align-items: center; justify-content: center; }
  .lu-pc-foto img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
  .lu-pc-tx { flex: 1; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "nm v" "sub m"; column-gap: 10px; row-gap: 2px; align-items: center; }
  .lu-pc-nm { grid-area: nm; font-size: 14.5px; font-weight: 500; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lu-pc-tx small { grid-area: sub; font-size: 12.5px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lu-pc-l { display: none; }
  .lu-pc-tx strong { grid-area: v; justify-self: end; font-size: 15px; font-weight: 600; color: var(--ui-verde); white-space: nowrap; }
  .lu-pc-tx strong.ruim { color: var(--ui-vermelho); } .lu-pc-tx strong.sf { font-size: 14px; color: var(--ui-rosa-escuro); } .lu-pc-tx strong.sf.sem-id { color: var(--ui-texto-2); font-weight: 500; }
  .lu-pc-m { grid-area: m; justify-self: end; display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--ui-texto-2); white-space: nowrap; }
  .lu-p-bar { display: none; width: 64px; height: 5px; border-radius: 9px; background: var(--ui-linha); overflow: hidden; } .lu-p-bar i { display: block; height: 100%; background: #22C55E; border-radius: 9px; } .lu-p-bar i.ruim { background: #F87171; }
  @media (min-width: 640px) and (max-width: 1023px) { .lu-p-bar { display: block; } } /* nas 2 colunas do computador a barra apertava o nome */
  .lu-sf { grid-column: 1 / -1; justify-self: start; color: var(--ui-laranja); font-weight: 600; display: flex; align-items: center; gap: 3px; font-size: 12px; white-space: nowrap; }
  .lu-sf-bt { display: none; }
  .lu-pc--bt { cursor: pointer; } .lu-pc--bt:hover .lu-pc-nm { color: var(--ui-rosa-escuro); }
  .lu-pc--bt:focus-visible { outline: 3px solid rgba(236, 72, 153, .4); outline-offset: 2px; border-radius: 8px; }

  .lu-eq-v { display: block; white-space: nowrap; font-size: clamp(22px, 7vw, 26px); font-weight: 600; letter-spacing: -.02em; } .lu-eq-v small { font-size: 13px; font-weight: 400; color: var(--ui-texto-2); }
  .lu-eq-t { margin: 4px 0 0; font-size: 13.5px; color: var(--ui-texto-2); line-height: 1.45; }
  .lu-eq-s { margin: 0; font-size: 13.5px; font-weight: 500; color: var(--ui-texto); } .lu-nota { margin: 6px 0 0; font-size: 12px; color: var(--ui-texto-3); }
  .lu-sec { margin-top: 12px; min-height: 44px; padding: 0 16px; border: 1px solid #EADFE3; border-radius: 12px; background: var(--ui-branco); color: var(--ui-rosa-escuro); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
  .lu-link { position: relative; border: none; background: none; padding: 0; font: inherit; color: var(--ui-rosa-escuro); font-weight: 600; text-decoration: underline; cursor: pointer; }
  .lu-link::after { content: ""; position: absolute; inset: -13px -6px; }
`;

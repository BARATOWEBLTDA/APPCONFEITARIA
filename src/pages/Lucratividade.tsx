// Lucratividade — refeita no padrão novo (03/10), com a MESMA regra do painel do Financeiro:
// lucro = vendido (pedidos entregues no mês) − custo dos ingredientes (ficha técnica) − despesas pagas
// (sem as de insumos, que já estão no custo da ficha). Mais: ponto de equilíbrio e lucro por produto.
import EstiloFinanceiro from "@/components/financeiro/EstiloFinanceiro";
import { useEffect, useRef, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";
import { useNavigate } from "react-router-dom";
import { CaretRight, ChartLineUp, Equals, Minus, ShoppingBagOpen, Warning, WarningCircle } from "@phosphor-icons/react";
import PeriodoFiltro, { iso as isoDia, periodoDoDia, periodoInicial, rotuloPeriodo, type Periodo } from "@/components/financeiro/PeriodoFiltro";
import { useDiaAtual } from "@/hooks/useAoVoltar";
import AppPageHeader from "@/components/AppPageHeader";
import { COMO_LUCRATIVIDADE, TOUR_LUCRATIVIDADE } from "@/lib/comoTelas";
import { Botao, TelaVazia } from "@/components/base";
import { supabase } from "@/lib/supabase";
import { buscarTudo } from "@/lib/buscarTudo";
import { calcularCustoLucro, lerMaoObraConta } from "@/lib/produto-precificacao";
import { carregarIntervalo, custoPorProduto, multiplicadorDoItem, produtosPeloPeso, type MesFinanceiro } from "@/lib/painelFinanceiro";

type Produto = { chave: string; nome: string; foto: string; qtd: number; vendido: number; custo: number; lucro: number; margem: number; semFicha: boolean; kg?: boolean };
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Quanto o custo total da ficha é maior que só os ingredientes, por produto (13/10).
 * Ex.: ingredientes R$ 14,60 e custo total R$ 18,25 → 1,25. Assim o lucro por produto bate com a ficha técnica.
 * Se a busca falhar, fica 1 (só ingredientes, como era antes).
 */
async function fatorDaFicha(uid: string, ids: string[], mao: any): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!ids.length) return out;
  const [{ data: prods, error }, { data: perfil }] = await Promise.all([
    supabase.from("produtos").select("id, cv_percentual, salario_desejado, tempo_preparo_min, horas_semanais, produto_insumos(quantidade, unidade_utilizada, insumos(*))").in("id", ids),
    supabase.from("profiles").select("custos_invisiveis_pct").eq("id", uid).maybeSingle().then(r => r, () => ({ data: null } as any)),
  ]);
  if (error || !prods) return out;
  void mao;
  const conta = await lerMaoObraConta(uid).catch(() => null); // (16/10) a mesma hora da Ficha técnica: fixos + salário
  const cvConta = (perfil as any)?.custos_invisiveis_pct;
  for (const p of prods as any[]) {
    const r = calcularCustoLucro(p, conta, cvConta != null ? Number(cvConta) : null);
    if (r.cmv > 0) out[p.id] = r.custoTotal / r.cmv;
  }
  return out;
}

const CSS_AMOSTRA = `
  .lu-amostra { filter: blur(6px); opacity: .7; pointer-events: none; user-select: none; max-height: calc(100dvh - 140px); overflow: hidden; }
  .lu-gratis { position: relative; }
  .lu-convite { position: absolute; left: 0; right: 0; top: 140px; z-index: 2; width: calc(100% - 40px); max-width: 380px; margin: 0 auto; padding: 26px 22px; box-sizing: border-box; border-radius: 20px; background: var(--ui-branco); box-shadow: 0 12px 40px rgba(45, 31, 38, .18); text-align: center; }
  .lu-convite-ic { display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; margin: 0 auto 12px; border-radius: 50%; background: var(--primary-light); color: var(--ui-rosa-escuro); }
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
      <div className="lu-gratis">
      <div className="lu lu-amostra" aria-hidden="true">
        <div className="lu-conta">
          {([["Vendido", "R$ 4.850,00", "n", "18 entregues"], ["Ingredientes", "R$ 1.620,00", "s", "pela ficha técnica"], ["Taxas", "R$ 96,00", "s", "cobradas por pedido"], ["Despesas", "R$ 980,00", "s", "sem os ingredientes"]] as const).map(([t, v, c, i]) => (
            <div key={t} className="lu-k"><span className={`lu-ki ${c}`}>{c === "n" ? <ShoppingBagOpen size={15} weight="bold" /> : <Minus size={15} weight="bold" />}</span><small>{t}</small><b className={c === "s" ? "s" : ""}>{v}</b><i>{i}</i></div>
          ))}
          <div className="lu-k lu-k--lucro"><span className="lu-ki l"><Equals size={15} weight="bold" /></span><small>Lucro do mês</small><b>R$ 2.154,00</b>
            <div className="lu-margem"><div className="lu-bar"><i style={{ width: "44%" }} /></div><span>margem de <b>44%</b></span></div></div>
        </div>
        <section className="lu-card"><p className="lu-ct">Lucro por produto <small>Pela ficha técnica, sem despesas</small></p>
          <ul className="lu-pg">{[["Bolo de brigadeiro", "6 vendidos · R$ 720,00", "R$ 412,00", 57], ["Caixa de doces", "9 vendidos · R$ 405,00", "R$ 230,00", 57], ["Torta de morango", "3 vendidos · R$ 390,00", "R$ 168,00", 43]].map(([n, q, l, m]) => (
            <li key={n as string} className="lu-pc"><span className="lu-pc-foto"><ShoppingBagOpen size={28} /></span><span className="lu-pc-tx"><b className="lu-pc-nm">{n}</b><small>{q}</small><span className="lu-pc-l">Lucro</span><strong>{l}</strong><span className="lu-pc-m"><span className="lu-p-bar"><i style={{ width: `${m}%` }} /></span>margem {m}%</span></span></li>
          ))}</ul>
        </section>
      </div>
      <div className="lu-convite" role="region" aria-label="Lucratividade é do PRO">
        <span className="lu-convite-ic" aria-hidden="true"><ChartLineUp size={28} weight="duotone" /></span>
        <b>Seu lucro de verdade está aqui</b>
        <p>Quanto sobra de cada produto e do mês, já tirando ingredientes, taxas e despesas.</p>
        <Botao tamanho="m" onClick={() => navigate("/assinar")}>Conhecer o PRO</Botao>
      </div>
      </div>
      <style>{CSS}{CSS_AMOSTRA}</style>
    </>
  );
}

function LucratividadeTela() {
  const navigate = useNavigate();
  // (23/10) o mesmo filtro de período do Financeiro e de Transações (abre no mês de hoje)
  const [periodo, setPeriodo] = useState<Periodo>(periodoInicial);
  const diaAtual = useDiaAtual();
  useEffect(() => { setPeriodo(p => periodoDoDia(p)); }, [diaAtual]);
  const ehMes = periodo.tipo === "mes";
  const [dados, setDados] = useState<MesFinanceiro | null>(null);
  const [produtos, setProdutos] = useState<Produto[] | null>(null);
  const [fixos, setFixos] = useState<{ custos: number; salario: number } | null>(null);
  const [erro, setErro] = useState(false); // não deu pra carregar (10/10)
  const [tentativa, setTentativa] = useState(0);
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
        buscarTudo<any>((de, ate) => supabase.from("pedidos").select("status, pedido_itens(nome_produto, quantidade, valor_unitario, personalizacoes, produtos(id, nome, forma_venda, imagem_url))")
          .eq("user_id", user.id).eq("status", "entregue").gte("data_entrega", ini).lte("data_entrega", fim).order("id").range(de, ate)),
        supabase.from("custos_fixos").select("valor, ativo").eq("user_id", user.id),
        supabase.from("config_mao_obra").select("salario_mensal, horas_dia, dias_semana").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelado) return;
      if (d.erro || peds.error || cf.error || mo.error) { clearTimeout(relogio); setErro(true); return; }
      setDados(d);
      setFixos({ custos: ((cf.data as any[]) || []).filter(x => x.ativo !== false).reduce((s, x) => s + (Number(x.valor) || 0), 0), salario: Number((mo.data as any)?.salario_mensal) || 0 });
      // lucro por produto
      const itens = peds.data.filter(p => p.status !== "cancelado").flatMap(p => p.pedido_itens || []);
      const ids = [...new Set(itens.map((it: any) => it.produtos?.id).filter(Boolean))] as string[];
      const [custo, peloPeso, fator] = await Promise.all([custoPorProduto(ids), produtosPeloPeso(itens), fatorDaFicha(user.id, ids, mo.data)]);
      if (cancelado) return;
      const mapa: Record<string, Produto> = {};
      for (const it of itens) {
        const id = it.produtos?.id; const chave = id || `nome:${it.nome_produto}`;
        const p = mapa[chave] || (mapa[chave] = { chave, nome: it.produtos?.nome || it.nome_produto || "Produto", foto: String(it.produtos?.imagem_url || "").split(",")[0].trim(), qtd: 0, vendido: 0, custo: 0, lucro: 0, margem: 0, semFicha: false, kg: it.produtos?.forma_venda === "kg" && !it.personalizacoes?.tamanho } as Produto);
        const q = Number(it.quantidade) || 0;
        p.qtd += q; p.vendido += (Number(it.valor_unitario) || 0) * q;
        const c = id ? custo[id] : 0;
        // 11/10: tamanho pelo peso ("M · 2 kg") e kit (50 un) custam o tamanho/kit inteiro, não 1 kg ou 1 unidade
        // 13/10: custo total da ficha (ingredientes + custos invisíveis + mão de obra), igual à tela da ficha técnica
        if (c) p.custo += c * (fator[id] || 1) * multiplicadorDoItem(it, peloPeso) * q; else p.semFicha = true;
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

  const despesasSemInsumos = dados ? dados.despesasPagas - dados.despesasInsumos : 0;
  // (13/10) o que sobra de cada venda já tira as taxas da maquininha e a embalagem
  const margemBruta = dados && dados.vendido > 0 ? (dados.vendido - dados.cmv - dados.custosVariaveis) / dados.vendido : 0;
  const metaEquilibrio = fixos && margemBruta > 0 ? (fixos.custos + fixos.salario) / margemBruta : 0;
  const semFicha = (produtos || []).filter(p => p.semFicha);
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
              <i>sem os ingredientes</i></div>
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
              <p className="lu-ct">Lucro por produto <small>Pela ficha técnica, sem despesas</small></p>
              {!produtos ? <div className="lu-ph" style={{ height: 120 }} /> : produtos.length === 0 ? (
                <p className="lu-vz">Monte a <button type="button" className="lu-link" onClick={() => navigate("/ficha-tecnica")}>ficha técnica dos produtos</button> para ver o lucro de cada um.</p>
              ) : (
                // (4.29) em cartões, como no cardápio: foto, nome e o lucro embaixo
                <ul className="lu-pg">
                  {produtos.map(p => (
                    <li key={p.chave} className={`lu-pc${p.chave.startsWith("nome:") ? "" : " lu-pc--bt"}`}
                      {...(p.chave.startsWith("nome:") ? {} : { role: "button", tabIndex: 0, "aria-label": `${p.nome}: ${p.semFicha ? "montar a ficha técnica" : "ver a ficha técnica"}`,
                        onClick: () => navigate("/ficha-tecnica", { state: { produtoId: p.chave } }),
                        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/ficha-tecnica", { state: { produtoId: p.chave } }); } } })}>
                      <span className="lu-pc-foto">{p.foto ? <img src={p.foto} alt="" loading="lazy" /> : <ShoppingBagOpen size={28} aria-hidden="true" />}</span>
                      <span className="lu-pc-tx">
                        <b className="lu-pc-nm">{p.nome}</b>
                        <small>{(p as any).kg ? `${p.qtd.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg vendidos` : `${p.qtd.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${p.qtd === 1 ? "vendido" : "vendidos"}`} · {brl(p.vendido)}</small>
                        <span className="lu-pc-l">Lucro</span>
                        {/* sem ficha o custo é zero: mostrar "lucro = preço" engana, então fica um traço */}
                        <strong className={p.semFicha ? "sf" : p.lucro < 0 ? "ruim" : ""}>{p.semFicha ? "—" : brl(p.lucro)}</strong>
                        {p.semFicha
                          ? <span className="lu-sf"><Warning size={12} weight="bold" /> sem ficha técnica{!p.chave.startsWith("nome:") && <b className="lu-sf-bt">Montar ficha <CaretRight size={12} weight="bold" /></b>}</span>
                          : <span className="lu-pc-m"><span className="lu-p-bar"><i className={p.lucro < 0 ? "ruim" : ""} style={{ width: `${Math.max(2, Math.min(100, p.margem))}%` }} /></span>margem {p.margem}%</span>}
                      </span>
                    </li>
                  ))}
                </ul>
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
                <p className="lu-eq-s">{dados.vendido >= metaEquilibrio ? `Bateu! ${brl(dados.vendido - metaEquilibrio)} acima do necessário.` : `Faltam ${brl(metaEquilibrio - dados.vendido)} em vendas (${Math.round((dados.vendido / metaEquilibrio) * 100)}% do caminho).`}</p>
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
  .lu-vazio-ic { width: 60px; height: 60px; border-radius: 18px; background: #FFF1F6; color: var(--ui-rosa-escuro); display: inline-flex; align-items: center; justify-content: center; }
  .lu-vazio b { display: block; font-size: 17px; font-weight: 600; margin-top: 12px; }
  .lu-vazio p { font-size: 13.5px; color: var(--ui-texto-2); line-height: 1.45; margin: 6px auto 0; max-width: 400px; text-wrap: balance; }
  .lu-cta { margin-top: 14px; border: none; border-radius: var(--ui-raio); padding: 12px 18px; background: var(--ui-rosa); color: var(--ui-branco); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
  /* a conta em 4 cartões */
  .lu-conta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .lu-conta > .lu-k--lucro { grid-column: 1 / -1; }
  @media (min-width: 1024px) { .lu-conta { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; } .lu-conta > .lu-k--lucro { grid-column: auto; } }
  .lu-k { position: relative; background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 16px; padding: 14px; min-width: 0; }
  .lu-k small { display: block; padding-right: 32px; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lu-k > b { display: block; margin: 6px 0 4px; font-size: clamp(17px, 4.6vw, 26px); font-weight: 600; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lu-k > b.s { color: var(--ui-vermelho); }
  .lu-k i { display: block; font-style: normal; font-size: 12.5px; color: var(--ui-texto-2); line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lu-ki { position: absolute; top: 12px; right: 12px; width: 28px; height: 28px; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
  .lu-ki.n { background: var(--ui-cinza); color: var(--ui-texto-2); } .lu-ki.s { background: var(--ui-vermelho-fundo); color: var(--ui-vermelho); } .lu-ki.l { background: #FCE7F3; color: var(--ui-rosa-escuro); }
  .lu-k--lucro { border-color: #F7C9DA; background: #FFF8FB; } .lu-k--lucro > b { color: var(--ui-rosa-escuro); } .lu-k--lucro.ruim > b { color: var(--ui-vermelho); }
  .lu-margem { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--ui-texto-2); } .lu-margem .lu-bar { flex: 1; }
  .lu-margem b { font-weight: 600; color: var(--ui-texto); }
  .lu-bar { height: 8px; border-radius: 9px; background: var(--ui-linha); overflow: hidden; } .lu-bar i { display: block; height: 100%; background: var(--ui-rosa); border-radius: 9px; }
  .lu-bar.grande { height: 12px; margin: 14px 0 8px; } .lu-bar i.ok { background: #16A34A; }
  /* aviso de ficha técnica: uma faixa só */
  .lu-aviso { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; border-radius: 14px; padding: 10px 12px; font-size: 13.5px; font-weight: 500; line-height: 1.45; }
  .lu-aviso > span { flex: 1 1 260px; text-wrap: balance; } .lu-aviso svg { flex-shrink: 0; } /* (24/10) balance: as duas linhas do mesmo tamanho (antes sobrava "é." sozinho na 2ª linha) */
  .lu-aviso-bt { flex: none; min-height: 40px; padding: 0 14px; border: 0; border-radius: 10px; background: var(--ui-rosa); color: var(--ui-branco); font-family: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; }
  /* produto + equilíbrio */
  .lu-grid { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); grid-template-areas: "prod" "eq"; }
  @media (min-width: 1024px) { .lu-grid { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); grid-template-areas: "prod eq"; align-items: start; gap: 16px; } }
  .lu-a-eq { grid-area: eq; } .lu-a-prod { grid-area: prod; }
  .lu-card { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 16px; padding: 16px 18px; }
  .lu-ct { margin: 0 0 10px; font-size: 15.5px; font-weight: 600; } .lu-ct small { display: block; margin-top: 2px; font-size: 12.5px; font-weight: 400; color: var(--ui-texto-2); }
  .lu-vz { margin: 4px 0 0; font-size: 14px; line-height: 1.5; color: var(--ui-texto-2); }
  .lu-pg { list-style: none; margin: 4px 0 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  @media (min-width: 640px) { .lu-pg { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; } }
  /* (24/10) computador: cartões de pelo menos 200 px (com 4 colunas no notebook o nome e "16 vendidos · R$ 10.400,00" quebravam) */
  @media (min-width: 1024px) { .lu-pg { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); } }
  .lu-pc { overflow: hidden; border: 1px solid #F0EBED; border-radius: 14px; background: var(--ui-branco); display: flex; flex-direction: column; }
  .lu-pc-foto { aspect-ratio: 4 / 3; background: #F8F3F5; color: #C9B8BF; display: flex; align-items: center; justify-content: center; }
  .lu-pc-foto img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .lu-pc-tx { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 10px 12px 12px; min-width: 0; }
  .lu-pc-nm { font-size: 14px; font-weight: 500; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .lu-pc-tx small { font-size: 12px; color: var(--ui-texto-2); }
  .lu-pc-l { margin-top: auto; padding-top: 6px; font-size: 12px; color: var(--ui-texto-2); }
  .lu-pc-tx strong { font-size: 18px; font-weight: 600; color: var(--ui-verde); letter-spacing: -.01em; }
  .lu-pc-tx strong.ruim { color: var(--ui-vermelho); } .lu-pc-tx strong.sf { color: var(--ui-texto); }
  .lu-pc-m { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ui-texto-2); }
  .lu-pc-m .lu-p-bar { flex: 1; margin: 0; }
  .lu-p-bar { display: block; height: 5px; border-radius: 9px; background: var(--ui-linha); overflow: hidden; } .lu-p-bar i { display: block; height: 100%; background: #22C55E; border-radius: 9px; } .lu-p-bar i.ruim { background: #F87171; }
  .lu-sf { color: var(--ui-laranja); font-weight: 600; display: flex; flex-wrap: wrap; align-items: center; gap: 3px; font-size: 12px; }
  .lu-sf-bt { display: inline-flex; align-items: center; gap: 2px; width: 100%; margin-top: 6px; color: var(--ui-rosa-escuro); font-size: 13px; font-weight: 600; white-space: nowrap; }
  .lu-pc--bt { cursor: pointer; transition: border-color .15s; } .lu-pc--bt:hover { border-color: #F7C9DA; }
  .lu-pc--bt:focus-visible { outline: 3px solid rgba(236, 72, 153, .4); outline-offset: 2px; }
  @media (max-width: 639px) {
    .lu-pg { grid-template-columns: minmax(0, 1fr); gap: 0; }
    .lu-pc { flex-direction: row; align-items: center; gap: 12px; border: 0; border-bottom: 1px solid var(--ui-linha); border-radius: 0; padding: 10px 0; }
    .lu-pc:last-child { border-bottom: 0; }
    .lu-pc-foto { flex: none; width: 52px; height: 52px; aspect-ratio: auto; border-radius: 12px; overflow: hidden; }
    .lu-pc-tx { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "nm v" "sub m"; column-gap: 10px; row-gap: 2px; align-items: center; padding: 0; }
    .lu-pc-nm { grid-area: nm; -webkit-line-clamp: 1; }
    .lu-pc-tx small { grid-area: sub; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lu-pc-l { display: none; }
    .lu-pc-tx strong { grid-area: v; justify-self: end; font-size: 15px; }
    .lu-pc-m { grid-area: m; justify-self: end; white-space: nowrap; }
    .lu-sf { grid-column: 1 / -1; justify-self: start; white-space: nowrap; }
    .lu-pc-m .lu-p-bar, .lu-sf-bt { display: none; }
  }
  .lu-eq-v { display: block; font-size: 26px; font-weight: 600; letter-spacing: -.02em; } .lu-eq-v small { font-size: 13px; font-weight: 400; color: var(--ui-texto-2); }
  .lu-eq-t { margin: 4px 0 0; font-size: 13.5px; color: var(--ui-texto-2); line-height: 1.45; }
  .lu-eq-s { margin: 0; font-size: 13.5px; font-weight: 600; color: var(--ui-texto); } .lu-nota { margin: 6px 0 0; font-size: 12px; color: var(--ui-texto-3); }
  .lu-sec { margin-top: 12px; min-height: 44px; padding: 0 16px; border: 1px solid #EADFE3; border-radius: 12px; background: var(--ui-branco); color: var(--ui-rosa-escuro); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
  .lu-link { border: none; background: none; padding: 0; font: inherit; color: var(--ui-rosa-escuro); font-weight: 600; text-decoration: underline; cursor: pointer; }
`;

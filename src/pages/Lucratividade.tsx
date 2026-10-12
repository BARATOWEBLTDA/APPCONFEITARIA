// Lucratividade — refeita no padrão novo (03/10), com a MESMA regra do painel do Financeiro:
// lucro = vendido (pedidos entregues no mês) − custo dos ingredientes (ficha técnica) − despesas pagas
// (sem as de insumos, que já estão no custo da ficha). Mais: ponto de equilíbrio e lucro por produto.
import EstiloFinanceiro from "@/components/financeiro/EstiloFinanceiro";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarBlank, CaretLeft, CaretRight, ChartLineUp, Equals, Minus, ShoppingBagOpen, Warning, WarningCircle } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, TelaVazia } from "@/components/base";
import { supabase } from "@/lib/supabase";
import { buscarTudo } from "@/lib/buscarTudo";
import { erroDeConexao } from "@/lib/erros";
import { carregarMes, custoPorProduto, multiplicadorDoItem, produtosPeloPeso, type MesFinanceiro } from "@/lib/painelFinanceiro";

type Produto = { chave: string; nome: string; foto: string; qtd: number; vendido: number; custo: number; lucro: number; margem: number; semFicha: boolean };
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function Lucratividade() {
  const navigate = useNavigate();
  const h = new Date();
  const [mes, setMes] = useState({ ano: h.getFullYear(), m: h.getMonth() });
  const [dados, setDados] = useState<MesFinanceiro | null>(null);
  const [produtos, setProdutos] = useState<Produto[] | null>(null);
  const [fixos, setFixos] = useState<{ custos: number; salario: number } | null>(null);
  const [erro, setErro] = useState(false); // não deu pra carregar (10/10)
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    // 10/10: ao trocar de mês rápido, só vale a resposta da última busca (a atrasada era aplicada por cima da nova).
    // E se alguma busca falhar, a tela avisa em vez de mostrar "nenhum pedido entregue" ou um lucro errado.
    let cancelado = false;
    (async () => {
      setDados(null); setProdutos(null); setErro(false);
      const { data: { user }, error: eUser } = await supabase.auth.getUser();
      if (cancelado) return;
      if (!user) { if (erroDeConexao(eUser)) setErro(true); return; }
      const ini = iso(new Date(mes.ano, mes.m, 1)), fim = iso(new Date(mes.ano, mes.m + 1, 0));
      const [d, peds, cf, mo] = await Promise.all([
        carregarMes(user.id, mes.ano, mes.m),
        // de 1.000 em 1.000, igual ao painel (o Supabase corta em 1.000 linhas sem avisar)
        buscarTudo<any>((de, ate) => supabase.from("pedidos").select("status, pedido_itens(nome_produto, quantidade, valor_unitario, personalizacoes, produtos(id, nome, forma_venda, imagem_url))")
          .eq("user_id", user.id).eq("status", "entregue").gte("data_entrega", ini).lte("data_entrega", fim).order("id").range(de, ate)),
        supabase.from("custos_fixos").select("valor, ativo").eq("user_id", user.id),
        supabase.from("config_mao_obra").select("salario_mensal").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelado) return;
      if (d.erro || peds.error || cf.error || mo.error) { setErro(true); return; }
      setDados(d);
      setFixos({ custos: ((cf.data as any[]) || []).filter(x => x.ativo !== false).reduce((s, x) => s + (Number(x.valor) || 0), 0), salario: Number((mo.data as any)?.salario_mensal) || 0 });
      // lucro por produto
      const itens = peds.data.filter(p => p.status !== "cancelado").flatMap(p => p.pedido_itens || []);
      const ids = [...new Set(itens.map((it: any) => it.produtos?.id).filter(Boolean))] as string[];
      const [custo, peloPeso] = await Promise.all([custoPorProduto(ids), produtosPeloPeso(itens)]);
      if (cancelado) return;
      const mapa: Record<string, Produto> = {};
      for (const it of itens) {
        const id = it.produtos?.id; const chave = id || `nome:${it.nome_produto}`;
        const p = mapa[chave] || (mapa[chave] = { chave, nome: it.produtos?.nome || it.nome_produto || "Produto", foto: String(it.produtos?.imagem_url || "").split(",")[0].trim(), qtd: 0, vendido: 0, custo: 0, lucro: 0, margem: 0, semFicha: false });
        const q = Number(it.quantidade) || 0;
        p.qtd += q; p.vendido += (Number(it.valor_unitario) || 0) * q;
        const c = id ? custo[id] : 0;
        // 11/10: tamanho pelo peso ("M · 2 kg") e kit (50 un) custam o tamanho/kit inteiro, não 1 kg ou 1 unidade
        if (c) p.custo += c * multiplicadorDoItem(it, peloPeso) * q; else p.semFicha = true;
      }
      const lista = Object.values(mapa).map(p => ({ ...p, lucro: p.vendido - p.custo, margem: p.vendido > 0 ? Math.round(((p.vendido - p.custo) / p.vendido) * 100) : 0 }))
        .sort((a, b) => b.lucro - a.lucro);
      setProdutos(lista);
    })().catch(e => {
      console.error("[lucratividade] não consegui carregar:", e);
      if (!cancelado) { setDados(null); setErro(true); }
    });
    return () => { cancelado = true; };
  }, [mes, tentativa]);

  const ehMesAtual = mes.ano === h.getFullYear() && mes.m === h.getMonth();
  const mudar = (d: number) => setMes(x => { const n = new Date(x.ano, x.m + d, 1); return { ano: n.getFullYear(), m: n.getMonth() }; });
  const despesasSemInsumos = dados ? dados.despesasPagas - dados.despesasInsumos : 0;
  const margemBruta = dados && dados.vendido > 0 ? (dados.vendido - dados.cmv) / dados.vendido : 0;
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
        onBack={() => navigate("/financeiro")}
        infoIcon="📈"
        infoContent={<>
          <p>O lucro aqui é <strong>o mesmo do painel do Financeiro</strong>: o que você vendeu (pedidos entregues) menos o custo dos ingredientes (ficha técnica) e as despesas pagas do mês.</p>
          <p>As despesas de <strong>ingredientes</strong> não entram de novo, porque o custo deles já está na ficha técnica de cada produto.</p>
        </>}
      />
      <EstiloFinanceiro />
      {/* (4.29) mesmo desenho do Financeiro: o mês pousado na faixa rosa, a conta em 4 cartões e o lucro por produto em tabela */}
      <div className="lu-faixa" aria-hidden="true" />
      <div className="lu">
        <div className="lu-per">
          <div className="lu-per-tx"><span className="lu-per-ic" aria-hidden="true"><CalendarBlank size={20} /></span><span><b>Mês</b><small>Pedidos entregues e despesas pagas no mês</small></span></div>
          <div className="lu-mes">
            <button type="button" onClick={() => mudar(-1)} aria-label="Mês anterior"><CaretLeft size={16} weight="bold" /></button>
            <b>{MESES[mes.m]} de {mes.ano}</b>
            <button type="button" onClick={() => mudar(1)} disabled={ehMesAtual} aria-label="Próximo mês"><CaretRight size={16} weight="bold" /></button>
          </div>
        </div>

        {erro ? (
          <TelaVazia caixa icone={<WarningCircle size={30} />} titulo="Não deu pra carregar a lucratividade" texto="Confira a internet e tente de novo."
            acao={<Botao variante="suave" tamanho="m" onClick={() => setTentativa(t => t + 1)}>Tentar de novo</Botao>} />
        ) : !dados ? <div className="lu-ph" /> : dados.qtdVendidos === 0 ? (
          <div className="lu-vazio">
            <span className="lu-vazio-ic"><ChartLineUp size={30} weight="duotone" /></span>
            <b>Nenhum pedido entregue em {MESES[mes.m].toLowerCase()}</b>
            <p>A lucratividade aparece quando você marca pedidos como <strong>entregues</strong>. Ela usa o valor do pedido e o custo da ficha técnica de cada produto.</p>
            <button type="button" className="lu-cta" onClick={() => navigate("/pedidos")}>Ver meus pedidos</button>
          </div>
        ) : (<>
          {/* a conta do mês, da esquerda pra direita: vendido − ingredientes − despesas = lucro */}
          <div className="lu-conta">
            <div className="lu-k"><span className="lu-ki n" aria-hidden="true"><ShoppingBagOpen size={15} weight="bold" /></span><small>Vendido</small><b>{brl(dados.vendido)}</b>
              <i>{dados.qtdVendidos} {dados.qtdVendidos === 1 ? "pedido entregue" : "pedidos entregues"}</i></div>
            <div className="lu-k"><span className="lu-ki s" aria-hidden="true"><Minus size={15} weight="bold" /></span><small>Custo dos ingredientes</small><b className="s">{brl(dados.cmv)}</b>
              <i>pela ficha técnica</i></div>
            <div className="lu-k"><span className="lu-ki s" aria-hidden="true"><Minus size={15} weight="bold" /></span><small>Despesas pagas</small><b className="s">{brl(despesasSemInsumos)}</b>
              <i>sem os ingredientes (já estão na ficha)</i></div>
            <div className={`lu-k lu-k--lucro${dados.lucro < 0 ? " ruim" : ""}`}><span className="lu-ki l" aria-hidden="true"><Equals size={15} weight="bold" /></span><small>Lucro do mês</small><b>{brl(dados.lucro)}</b>
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
              <p className="lu-ct">Lucro por produto <small>Antes das despesas, taxas e descontos do pedido</small></p>
              {!produtos ? <div className="lu-ph" style={{ height: 120 }} /> : produtos.length === 0 ? (
                <p className="lu-vz">Monte a <button type="button" className="lu-link" onClick={() => navigate("/ficha-tecnica")}>ficha técnica dos produtos</button> pra ver o lucro de cada um.</p>
              ) : (
                // (4.29) em cartões, como no cardápio: foto, nome e o lucro embaixo
                <ul className="lu-pg">
                  {produtos.map(p => (
                    <li key={p.chave} className="lu-pc">
                      <span className="lu-pc-foto">{p.foto ? <img src={p.foto} alt="" loading="lazy" /> : <ShoppingBagOpen size={28} aria-hidden="true" />}</span>
                      <span className="lu-pc-tx">
                        <b className="lu-pc-nm">{p.nome}</b>
                        <small>{p.qtd} {p.qtd === 1 ? "vendido" : "vendidos"} · {brl(p.vendido)}</small>
                        <span className="lu-pc-l">Lucro</span>
                        <strong className={p.lucro < 0 ? "ruim" : p.semFicha ? "sf" : ""}>{brl(p.lucro)}</strong>
                        {p.semFicha
                          ? <span className="lu-sf"><Warning size={12} weight="bold" /> sem ficha técnica</span>
                          : <span className="lu-pc-m"><span className="lu-p-bar"><i className={p.lucro < 0 ? "ruim" : ""} style={{ width: `${Math.max(2, Math.min(100, p.margem))}%` }} /></span>margem {p.margem}%</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="lu-card lu-a-eq">
              <p className="lu-ct">Ponto de equilíbrio <small>Quanto vender no mês pra pagar tudo</small></p>
              {fixos && (fixos.custos + fixos.salario) > 0 && margemBruta > 0 ? (<>
                <b className="lu-eq-v">{brl(metaEquilibrio)} <small>no mês</small></b>
                <p className="lu-eq-t">pra pagar os custos fixos e o seu salário ({brl(fixos.custos + fixos.salario)})</p>
                <div className="lu-bar grande"><i className={dados.vendido >= metaEquilibrio ? "ok" : ""} style={{ width: `${Math.min(100, (dados.vendido / metaEquilibrio) * 100)}%` }} /></div>
                <p className="lu-eq-s">{dados.vendido >= metaEquilibrio ? `Bateu! ${brl(dados.vendido - metaEquilibrio)} acima do necessário.` : `Faltam ${brl(metaEquilibrio - dados.vendido)} em vendas (${Math.round((dados.vendido / metaEquilibrio) * 100)}% do caminho).`}</p>
                <p className="lu-nota">Com a sua margem de ingredientes de {Math.round(margemBruta * 100)}%.</p>
              </>) : fixos && (fixos.custos + fixos.salario) > 0 ? (
                <p className="lu-eq-t">{dados.vendido > 0
                  ? `Neste mês, os ingredientes custaram ${dados.cmv > dados.vendido ? "mais do que" : "o mesmo que"} você vendeu. Assim não sobra pra pagar os custos fixos e o seu salário, e não existe ponto de equilíbrio.`
                  : "Os pedidos entregues neste mês estão sem valor, então não dá pra calcular o ponto de equilíbrio."}</p>
              ) : (<>
                <p className="lu-eq-t">Cadastre seus custos fixos e o seu salário pra saber quanto precisa vender no mês pra fechar no azul.</p>
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
  .lu-faixa { height: 58px; background: var(--ui-rosa); width: 100vw; margin: 0 calc(50% - 50vw); }
  .lu { position: relative; margin: -58px auto 0; max-width: 1160px; padding: 22px 0 96px; font-family: var(--font-base); color: var(--ui-texto); display: flex; flex-direction: column; gap: 14px; }
  @media (min-width: 901px) { .lu-faixa { width: auto; margin: 0 -2rem; } }
  .lu-per { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 16px; padding: 10px 12px; }
  .lu-per-tx { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .lu-per-ic { flex: none; width: 38px; height: 38px; border-radius: 11px; background: #FFF1F6; color: var(--ui-rosa-escuro); display: flex; align-items: center; justify-content: center; }
  .lu-per-tx b { display: block; font-size: 14.5px; font-weight: 600; } .lu-per-tx small { display: block; font-size: 13px; color: var(--ui-texto-2); }
  .lu-mes { display: flex; align-items: center; gap: 6px; background: #F4EEF1; border-radius: 12px; padding: 3px; }
  .lu-mes b { min-width: 150px; text-align: center; font-size: 14px; font-weight: 600; }
  .lu-mes button { width: 40px; height: 40px; border-radius: 9px; border: none; background: var(--ui-branco); color: var(--ui-rosa-escuro); display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .lu-mes button:disabled { opacity: .35; cursor: default; }
  @media (max-width: 767px) { .lu-per-tx { display: none; } .lu-per { padding: 6px; } .lu-mes { width: 100%; justify-content: space-between; } }
  .lu-ph { height: 260px; background: #FAF7F8; border-radius: var(--ui-raio-cartao); }
  .lu-vazio { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 18px; padding: 30px 20px; text-align: center; }
  .lu-vazio-ic { width: 60px; height: 60px; border-radius: 18px; background: #FFF1F6; color: var(--ui-rosa-escuro); display: inline-flex; align-items: center; justify-content: center; }
  .lu-vazio b { display: block; font-size: 17px; font-weight: 600; margin-top: 12px; }
  .lu-vazio p { font-size: 13.5px; color: var(--ui-texto-2); line-height: 1.45; margin: 6px auto 0; max-width: 400px; text-wrap: balance; }
  .lu-cta { margin-top: 14px; border: none; border-radius: var(--ui-raio); padding: 12px 18px; background: var(--ui-vinho-escuro); color: var(--ui-branco); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
  /* a conta em 4 cartões */
  .lu-conta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (min-width: 1024px) { .lu-conta { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; } }
  .lu-k { position: relative; background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 16px; padding: 14px; min-width: 0; }
  .lu-k small { display: block; padding-right: 32px; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
  .lu-k > b { display: block; margin: 6px 0 4px; font-size: clamp(17px, 4.6vw, 26px); font-weight: 600; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lu-k > b.s { color: var(--ui-vermelho); }
  .lu-k i { display: block; font-style: normal; font-size: 12.5px; color: var(--ui-texto-2); line-height: 1.35; }
  .lu-ki { position: absolute; top: 12px; right: 12px; width: 28px; height: 28px; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
  .lu-ki.n { background: var(--ui-cinza); color: var(--ui-texto-2); } .lu-ki.s { background: var(--ui-vermelho-fundo); color: var(--ui-vermelho); } .lu-ki.l { background: #FCE7F3; color: var(--ui-rosa-escuro); }
  .lu-k--lucro { border-color: #F7C9DA; background: #FFF8FB; } .lu-k--lucro > b { color: var(--ui-rosa-escuro); } .lu-k--lucro.ruim > b { color: var(--ui-vermelho); }
  .lu-margem { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--ui-texto-2); } .lu-margem .lu-bar { flex: 1; }
  .lu-margem b { font-weight: 600; color: var(--ui-texto); }
  .lu-bar { height: 8px; border-radius: 9px; background: var(--ui-linha); overflow: hidden; } .lu-bar i { display: block; height: 100%; background: var(--ui-rosa); border-radius: 9px; }
  .lu-bar.grande { height: 12px; margin: 14px 0 8px; } .lu-bar i.ok { background: #16A34A; }
  /* aviso de ficha técnica: uma faixa só */
  .lu-aviso { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; border-radius: 14px; padding: 10px 12px; font-size: 13.5px; font-weight: 500; line-height: 1.45; }
  .lu-aviso > span { flex: 1 1 260px; } .lu-aviso svg { flex-shrink: 0; }
  .lu-aviso-bt { flex: none; min-height: 40px; padding: 0 14px; border: 0; border-radius: 10px; background: #92400E; color: #fff; font-family: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; }
  /* produto + equilíbrio */
  .lu-grid { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); grid-template-areas: "prod" "eq"; }
  @media (min-width: 1024px) { .lu-grid { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); grid-template-areas: "prod eq"; align-items: start; gap: 16px; } }
  .lu-a-eq { grid-area: eq; } .lu-a-prod { grid-area: prod; }
  .lu-card { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 16px; padding: 16px 18px; }
  .lu-ct { margin: 0 0 10px; font-size: 15.5px; font-weight: 600; } .lu-ct small { display: block; margin-top: 2px; font-size: 12.5px; font-weight: 400; color: var(--ui-texto-2); }
  .lu-vz { margin: 4px 0 0; font-size: 14px; line-height: 1.5; color: var(--ui-texto-2); }
  .lu-pg { list-style: none; margin: 4px 0 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  @media (min-width: 640px) { .lu-pg { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; } }
  @media (min-width: 1280px) { .lu-pg { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
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
  .lu-sf { color: var(--ui-laranja); font-weight: 600; display: inline-flex; align-items: center; gap: 3px; font-size: 12px; }
  .lu-eq-v { display: block; font-size: 26px; font-weight: 600; letter-spacing: -.02em; } .lu-eq-v small { font-size: 13px; font-weight: 400; color: var(--ui-texto-2); }
  .lu-eq-t { margin: 4px 0 0; font-size: 13.5px; color: var(--ui-texto-2); line-height: 1.45; }
  .lu-eq-s { margin: 0; font-size: 13.5px; font-weight: 600; color: var(--ui-texto); } .lu-nota { margin: 6px 0 0; font-size: 12px; color: var(--ui-texto-3); }
  .lu-sec { margin-top: 12px; min-height: 44px; padding: 0 16px; border: 1px solid #EADFE3; border-radius: 12px; background: var(--ui-branco); color: var(--ui-rosa-escuro); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
  .lu-link { border: none; background: none; padding: 0; font: inherit; color: var(--ui-rosa-escuro); font-weight: 600; text-decoration: underline; cursor: pointer; }
`;

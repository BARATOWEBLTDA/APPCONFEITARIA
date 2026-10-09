// Lucratividade — refeita no padrão novo (03/10), com a MESMA regra do painel do Financeiro:
// lucro = vendido (pedidos entregues no mês) − custo dos ingredientes (ficha técnica) − despesas pagas
// (sem as de insumos, que já estão no custo da ficha). Mais: ponto de equilíbrio e lucro por produto.
import EstiloFinanceiro from "@/components/financeiro/EstiloFinanceiro";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CaretLeft, CaretRight, ChartLineUp, Warning } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { supabase } from "@/lib/supabase";
import { carregarMes, custoPorProduto, type MesFinanceiro } from "@/lib/painelFinanceiro";

type Produto = { chave: string; nome: string; qtd: number; vendido: number; custo: number; lucro: number; margem: number; semFicha: boolean };
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brlInt = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function Lucratividade() {
  const navigate = useNavigate();
  const h = new Date();
  const [mes, setMes] = useState({ ano: h.getFullYear(), m: h.getMonth() });
  const [dados, setDados] = useState<MesFinanceiro | null>(null);
  const [produtos, setProdutos] = useState<Produto[] | null>(null);
  const [fixos, setFixos] = useState<{ custos: number; salario: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setDados(null); setProdutos(null);
      const ini = iso(new Date(mes.ano, mes.m, 1)), fim = iso(new Date(mes.ano, mes.m + 1, 0));
      const [d, peds, cf, mo] = await Promise.all([
        carregarMes(user.id, mes.ano, mes.m),
        supabase.from("pedidos").select("status, pedido_itens(nome_produto, quantidade, valor_unitario, produtos(id, nome))")
          .eq("user_id", user.id).eq("status", "entregue").gte("data_entrega", ini).lte("data_entrega", fim),
        supabase.from("custos_fixos").select("valor, ativo").eq("user_id", user.id),
        supabase.from("config_mao_obra").select("salario_mensal").eq("user_id", user.id).maybeSingle(),
      ]);
      setDados(d);
      setFixos({ custos: ((cf.data as any[]) || []).filter(x => x.ativo !== false).reduce((s, x) => s + (Number(x.valor) || 0), 0), salario: Number((mo.data as any)?.salario_mensal) || 0 });
      // lucro por produto
      const itens = ((peds.data as any[]) || []).filter(p => p.status !== "cancelado").flatMap(p => p.pedido_itens || []);
      const ids = [...new Set(itens.map((it: any) => it.produtos?.id).filter(Boolean))] as string[];
      const custo = await custoPorProduto(ids);
      const mapa: Record<string, Produto> = {};
      for (const it of itens) {
        const id = it.produtos?.id; const chave = id || `nome:${it.nome_produto}`;
        const p = mapa[chave] || (mapa[chave] = { chave, nome: it.produtos?.nome || it.nome_produto || "Produto", qtd: 0, vendido: 0, custo: 0, lucro: 0, margem: 0, semFicha: false });
        const q = Number(it.quantidade) || 0;
        p.qtd += q; p.vendido += (Number(it.valor_unitario) || 0) * q;
        const c = id ? custo[id] : 0;
        if (c) p.custo += c * q; else p.semFicha = true;
      }
      const lista = Object.values(mapa).map(p => ({ ...p, lucro: p.vendido - p.custo, margem: p.vendido > 0 ? Math.round(((p.vendido - p.custo) / p.vendido) * 100) : 0 }))
        .sort((a, b) => b.lucro - a.lucro);
      setProdutos(lista);
    })();
  }, [mes]);

  const ehMesAtual = mes.ano === h.getFullYear() && mes.m === h.getMonth();
  const mudar = (d: number) => setMes(x => { const n = new Date(x.ano, x.m + d, 1); return { ano: n.getFullYear(), m: n.getMonth() }; });
  const despesasSemInsumos = dados ? dados.despesasPagas - dados.despesasInsumos : 0;
  const margemBruta = dados && dados.vendido > 0 ? (dados.vendido - dados.cmv) / dados.vendido : 0;
  const metaEquilibrio = fixos && margemBruta > 0 ? (fixos.custos + fixos.salario) / margemBruta : 0;
  const maxLucro = useMemo(() => Math.max(1, ...(produtos || []).map(p => Math.abs(p.lucro))), [produtos]);
  const semFicha = (produtos || []).filter(p => p.semFicha);

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
      <div className="lu">
        <div className="lu-mes">
          <button type="button" onClick={() => mudar(-1)} aria-label="Mês anterior"><CaretLeft size={16} weight="bold" /></button>
          <b>{MESES[mes.m]} de {mes.ano}</b>
          <button type="button" onClick={() => mudar(1)} disabled={ehMesAtual} aria-label="Próximo mês"><CaretRight size={16} weight="bold" /></button>
        </div>

        {!dados ? <div className="lu-ph" /> : dados.qtdVendidos === 0 ? (
          <div className="lu-vazio">
            <span className="lu-vazio-ic"><ChartLineUp size={30} weight="duotone" /></span>
            <b>Nenhum pedido entregue em {MESES[mes.m].toLowerCase()}</b>
            <p>A lucratividade aparece quando você marca pedidos como <strong>entregues</strong>. Ela usa o valor do pedido e o custo da ficha técnica de cada produto.</p>
            <button type="button" className="lu-cta" onClick={() => navigate("/pedidos")}>Ver meus pedidos</button>
          </div>
        ) : (<>
          <div className="lu-grid">
            <section className="lu-card lu-a-conta">
              <p className="lu-ct">A conta do mês</p>
              <div className="lu-l"><span>Vendido <small>{dados.qtdVendidos} {dados.qtdVendidos === 1 ? "pedido entregue" : "pedidos entregues"}</small></span><b>{brl(dados.vendido)}</b></div>
              <div className="lu-l neg"><span>Custo dos ingredientes <small>pela ficha técnica</small></span><b>− {brl(dados.cmv)}</b></div>
              <div className="lu-l neg"><span>Despesas pagas <small>sem ingredientes ({brl(dados.despesasInsumos)} já estão na ficha)</small></span><b>− {brl(despesasSemInsumos)}</b></div>
              <div className={`lu-l tt ${dados.lucro < 0 ? "ruim" : ""}`}><span>Lucro do mês</span><b>{brl(dados.lucro)}</b></div>
              <div className="lu-margem"><div className="lu-bar"><i style={{ width: `${Math.max(0, Math.min(100, dados.margem))}%` }} /></div><span>Margem de <b>{dados.margem}%</b></span></div>
            </section>

            <section className="lu-card lu-a-eq">
              <p className="lu-ct">Ponto de equilíbrio</p>
              {fixos && (fixos.custos + fixos.salario) > 0 && margemBruta > 0 ? (<>
                <p className="lu-eq-t">Pra pagar seus custos fixos e o seu salário ({brlInt(fixos.custos + fixos.salario)}), você precisa vender</p>
                <b className="lu-eq-v">{brlInt(metaEquilibrio)} <small>no mês</small></b>
                <div className="lu-bar grande"><i className={dados.vendido >= metaEquilibrio ? "ok" : ""} style={{ width: `${Math.min(100, (dados.vendido / metaEquilibrio) * 100)}%` }} /></div>
                <p className="lu-eq-s">{dados.vendido >= metaEquilibrio ? `Bateu! ${brlInt(dados.vendido - metaEquilibrio)} acima do necessário.` : `Faltam ${brlInt(metaEquilibrio - dados.vendido)} em vendas (${Math.round((dados.vendido / metaEquilibrio) * 100)}% do caminho).`}</p>
                <p className="lu-nota">Com a sua margem de ingredientes de {Math.round(margemBruta * 100)}%.</p>
              </>) : (
                <p className="lu-eq-t">Cadastre seus <button type="button" className="lu-link" onClick={() => navigate("/custos")}>custos fixos e o seu salário</button> pra saber quanto precisa vender no mês pra fechar no azul.</p>
              )}
            </section>

            <section className="lu-card lu-a-prod">
              <p className="lu-ct">Lucro por produto <small>antes das despesas, taxas e descontos do pedido</small></p>
              {!produtos ? <div className="lu-ph" style={{ height: 120 }} /> : produtos.map(p => (
                <div key={p.chave} className="lu-p">
                  <div className="lu-p-h"><b>{p.nome}</b><span className={p.lucro < 0 ? "ruim" : ""}>{brl(p.lucro)}</span></div>
                  <div className="lu-p-bar"><i className={p.lucro < 0 ? "ruim" : ""} style={{ width: `${Math.max(2, (Math.abs(p.lucro) / maxLucro) * 100)}%` }} /></div>
                  <small>{p.qtd} {p.qtd === 1 ? "vendido" : "vendidos"} · {brl(p.vendido)} · {p.semFicha ? <span className="lu-sf"><Warning size={12} weight="bold" /> sem ficha técnica (custo não descontado)</span> : `custo ${brl(p.custo)} · margem ${p.margem}%`}</small>
                </div>
              ))}
              {semFicha.length > 0 && <button type="button" className="lu-aviso" onClick={() => navigate("/ficha-tecnica")}><Warning size={15} weight="bold" />{semFicha.length} {semFicha.length === 1 ? "produto está" : "produtos estão"} sem ficha técnica: o lucro deles aparece maior do que é. Cadastrar a ficha</button>}
            </section>
          </div>
        </>)}
      </div>
      <style>{CSS}</style>
    </>
  );
}

const CSS = `
  .lu { max-width: 1060px; margin: 0 auto; padding: 22px 0 96px; font-family: var(--font-base); color: #2C1219; display: flex; flex-direction: column; gap: 14px; }
  .lu-mes { display: flex; justify-content: space-between; align-items: center; background: #fff; border: 1px solid #F0EBED; border-radius: 12px; padding: 6px; max-width: 420px; width: 100%; align-self: center; box-sizing: border-box; }
  .lu-mes b { font-size: 14.5px; font-weight: 800; }
  .lu-mes button { width: 44px; height: 44px; border-radius: 10px; border: none; background: #FFF1F6; color: #C33A6E; display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .lu-mes button:disabled { opacity: .35; cursor: default; }
  .lu-ph { height: 260px; background: #FAF7F8; border-radius: 16px; }
  .lu-vazio { background: #fff; border: 1px solid #F0EBED; border-radius: 18px; padding: 30px 20px; text-align: center; }
  .lu-vazio-ic { width: 60px; height: 60px; border-radius: 18px; background: #FFF1F6; color: #C33A6E; display: inline-flex; align-items: center; justify-content: center; }
  .lu-vazio b { display: block; font-size: 17px; font-weight: 900; margin-top: 12px; }
  .lu-vazio p { font-size: 13.5px; color: #6B5D64; line-height: 1.45; margin: 6px auto 0; max-width: 400px; text-wrap: balance; }
  .lu-cta { margin-top: 14px; border: none; border-radius: 12px; padding: 12px 18px; background: #2C1219; color: #fff; font-family: inherit; font-size: 14px; font-weight: 800; cursor: pointer; }
  .lu-grid { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); grid-template-areas: "conta" "eq" "prod"; }
  @media (min-width: 900px) { .lu-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-areas: "conta eq" "prod prod"; } }
  .lu-a-conta { grid-area: conta; } .lu-a-eq { grid-area: eq; } .lu-a-prod { grid-area: prod; }
  .lu-card { background: #fff; border: 1px solid #F0EBED; border-radius: 16px; padding: 14px 16px; }
  .lu-ct { margin: 0 0 8px; font-size: 15px; font-weight: 900; } .lu-ct small { font-size: 12px; font-weight: 600; color: #9A8E94; margin-left: 4px; }
  .lu-l { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 9px 0; border-bottom: 1px solid #F5F0F2; font-size: 14px; }
  .lu-l span { color: #4B3A42; } .lu-l small { display: block; font-size: 13px; color: #9A8E94; margin-top: 1px; }
  .lu-l b { font-weight: 800; white-space: nowrap; } .lu-l.neg b { color: #DC2626; }
  .lu-l.tt { border-bottom: none; padding-top: 12px; font-size: 16px; } .lu-l.tt span { font-weight: 800; color: #2C1219; } .lu-l.tt b { font-size: 21px; font-weight: 900; color: #C33A6E; }
  .lu-l.tt.ruim b { color: #DC2626; }
  .lu-margem { display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: #6B5D64; } .lu-margem .lu-bar { flex: 1; }
  .lu-bar { height: 8px; border-radius: 9px; background: #F5F0F2; overflow: hidden; } .lu-bar i { display: block; height: 100%; background: #E85A8C; border-radius: 9px; }
  .lu-bar.grande { height: 12px; margin: 10px 0 8px; } .lu-bar i.ok { background: #16A34A; }
  .lu-eq-t { margin: 0; font-size: 13.5px; color: #4B3A42; line-height: 1.45; }
  .lu-eq-v { display: block; font-size: 26px; font-weight: 900; letter-spacing: -.02em; margin-top: 4px; } .lu-eq-v small { font-size: 13px; font-weight: 700; color: #9A8E94; }
  .lu-eq-s { margin: 0; font-size: 13.5px; font-weight: 800; color: #2C1219; } .lu-nota { margin: 6px 0 0; font-size: 12px; color: #9A8E94; }
  .lu-link { border: none; background: none; padding: 0; font: inherit; color: #C33A6E; font-weight: 800; text-decoration: underline; cursor: pointer; }
  .lu-p { padding: 10px 0; border-top: 1px solid #F5F0F2; } .lu-p:first-of-type { border-top: none; }
  .lu-p-h { display: flex; justify-content: space-between; gap: 10px; font-size: 14px; } .lu-p-h b { font-weight: 800; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lu-p-h span { font-weight: 900; color: #15803D; white-space: nowrap; } .lu-p-h span.ruim { color: #DC2626; }
  .lu-p-bar { height: 6px; border-radius: 9px; background: #F5F0F2; margin: 6px 0 5px; overflow: hidden; } .lu-p-bar i { display: block; height: 100%; background: #22C55E; border-radius: 9px; } .lu-p-bar i.ruim { background: #F87171; }
  .lu-p small { font-size: 12px; color: #888780; } .lu-sf { color: #B45309; font-weight: 700; display: inline-flex; align-items: center; gap: 3px; }
  .lu-aviso { display: flex; align-items: flex-start; gap: 8px; width: 100%; text-align: left; margin-top: 10px; background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; border-radius: 12px; padding: 10px 12px; font-family: inherit; font-size: 13px; font-weight: 700; line-height: 1.4; cursor: pointer; }
  .lu-aviso svg { flex-shrink: 0; margin-top: 2px; }
`;

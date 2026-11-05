import { lazy, Suspense, useState } from "react";
import { useDadosCardapio, useMetricasCardapio, variacaoCardapio, quandoCardapio, type Periodo } from "@/components/cardapio/desempenhoCardapio";
import "@/components/inicio/graficoRecebido.css";
const GraficoVisitas = lazy(() => import("@/components/cardapio/GraficoVisitas"));

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * (6.169) Desempenho do cardápio no CELULAR: quantas pessoas abriram o cardápio (7 ou 30 dias, comparando com o
 * período anterior), pedidos, vendido e conversão, o gráfico das visitas e os mais pedidos pelo cardápio.
 * A mesma conta da Visão geral do computador (desempenhoCardapio).
 */
export default function DesempenhoCelular({ uid }: { uid?: string | null }) {
  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const { dados, falhou, tentar } = useDadosCardapio(uid);
  const metr = useMetricasCardapio(dados, periodo);
  const quando = quandoCardapio(periodo);
  const dias = periodo === "7d" ? 7 : 30;
  const varVis = metr ? variacaoCardapio(periodo, metr.vis, metr.ant?.vis) : null;

  return (
    <section className="dl-emb dsc" aria-label="Desempenho do cardápio">
      <h2 className="dl-emb-t">Desempenho do cardápio</h2>
      <div className="dsc-card">
        <div className="dsc-topo">
          <small>Visitas</small>
          <div className="grf-seg" role="tablist" aria-label="Período">
            {([["7d", "7 dias"], ["30d", "30 dias"]] as [Periodo, string][]).map(([v, l]) => (
              <button key={v} type="button" role="tab" aria-selected={periodo === v} onClick={() => setPeriodo(v)}>{l}</button>
            ))}
          </div>
        </div>
        {!metr ? (
          falhou
            ? <p className="dsc-vazio">Não deu para carregar. <button type="button" className="dsc-tentar" onClick={tentar}>Tentar de novo</button></p>
            : <div className="dsc-ph" aria-label="Carregando" />
        ) : (
          <>
            <div className="dsc-num">
              <b>{metr.vis.toLocaleString("pt-BR")}</b>
              {varVis && <span className={varVis.up ? "sobe" : "desce"}>{varVis.txt}</span>}
            </div>
            <div className="dsc-mini">
              <div><small>Pedidos</small><b>{metr.ped}</b></div>
              <div><small>Vendido</small><b>{brl(metr.rec)}</b></div>
              <div><small>Conversão</small><b>{metr.conv.toFixed(1).replace(".", ",")}%</b></div>
            </div>
            {metr.serie.every(x => x.n === 0) ? (
              <p className="dsc-vazio">Ninguém abriu o cardápio {quando}. Mande o link para os seus clientes.</p>
            ) : (
              <Suspense fallback={<div style={{ height: 176 }} />}>
                <GraficoVisitas serie={metr.serie} unidade="dia" altura={150}
                  legA={`Últimos ${dias} dias`} legB={`${dias} dias anteriores`} />
              </Suspense>
            )}
            <p className="dsc-sub">Mais pedidos pelo cardápio</p>
            {metr.top.length === 0 ? (
              <p className="dsc-vazio">Aparecem aqui quando chegarem pedidos {quando}.</p>
            ) : (
              <ol className="dsc-top">
                {metr.top.slice(0, 3).map(([nm, qt], i) => (
                  <li key={nm}><span className="dsc-top-n">{i + 1}</span><span className="dsc-top-t">{nm}</span><b>{qt.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</b>
                    <i style={{ width: `${Math.round((qt / metr.top[0][1]) * 100)}%` }} aria-hidden="true" /></li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
      <style>{`
        .dsc-card { padding: 16px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); background: var(--ui-branco); box-shadow: var(--ui-sombra-cartao); }
        .dsc-topo { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .dsc-topo small { min-width: 0; font-size: 13px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dsc .grf-seg button { padding: 0 10px; }
        .dsc-num { display: flex; align-items: baseline; gap: 10px; min-width: 0; margin-top: 2px; }
        .dsc-num b { flex: none; font-size: 28px; font-weight: 600; line-height: 1.2; color: var(--ui-texto); font-variant-numeric: tabular-nums; }
        .dsc-num span { min-width: 0; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dsc-num .sobe { color: var(--ui-verde); } .dsc-num .desce { color: var(--ui-vermelho); }
        .dsc-mini { display: grid; grid-template-columns: minmax(0, .75fr) minmax(0, 1.3fr) minmax(0, 1fr); gap: 6px; margin: 12px 0 2px; }
        .dsc-mini div { min-width: 0; padding: 8px; border-radius: var(--ui-raio); background: var(--ui-cinza); }
        .dsc-mini small { display: block; font-size: 11.5px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dsc-mini b { display: block; font-size: 15px; font-weight: 600; color: var(--ui-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
        .dsc-sub { margin: 14px 0 0; padding-top: 12px; border-top: 1px solid var(--ui-linha); font-size: 14px; font-weight: 600; color: var(--ui-texto); }
        .dsc-vazio { margin: 12px 0 0; font-size: 13.5px; line-height: 1.45; color: var(--ui-texto-2); }
        .dsc-tentar { margin: 0; padding: 0; border: 0; background: none; color: var(--ui-rosa-escuro); font: inherit; font-weight: 600; cursor: pointer; }
        .dsc-ph { height: 120px; margin-top: 10px; border-radius: var(--ui-raio); background: var(--ui-cinza); }
        .dsc-top { margin: 4px 0 0; padding: 0; list-style: none; }
        .dsc-top li { position: relative; display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 6px 0 10px; font-size: 14px; color: var(--ui-texto); }
        .dsc-top li + li { border-top: 1px solid var(--ui-linha); }
        .dsc-top-n { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; flex: none; border-radius: 50%; background: var(--ui-cinza); font-size: 12px; font-weight: 600; color: var(--ui-texto-2); }
        .dsc-top-t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dsc-top li b { flex: none; font-weight: 600; }
        .dsc-top li i { position: absolute; left: 34px; bottom: 4px; height: 3px; max-width: calc(100% - 34px); border-radius: 2px; background: #F9A8C9; }
      `}</style>
    </section>
  );
}

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { useDadosCardapio, useMetricasCardapio, variacaoCardapio, quandoCardapio, type Periodo, type Variacao } from "@/components/cardapio/desempenhoCardapio";
import PrimeirosPassos from "@/components/PrimeirosPassos";
import { ArrowSquareOut, CaretRight, ChartLineUp, Check, Copy, CurrencyCircleDollar, DownloadSimple, Eye, LinkSimple, Receipt } from "@phosphor-icons/react";
import IconeWhatsApp from "@/components/IconeWhatsApp";
const GraficoVisitas = lazy(() => import("@/components/cardapio/GraficoVisitas"));
import { Botao } from "@/components/base";
import { situacaoLoja } from "@/lib/agendaCardapio";
import type { Profile } from "@/hooks/useProfile";
import { horarioComFechados } from '@/lib/diasFechados'

/**
 * Visão geral do Cardápio digital — COMPUTADOR (aprovada 02/10).
 * Sem as listas de atalhos (agora estão no menu lateral). Quatro blocos:
 * cartão do link (situação da loja + compartilhar + QR Code), desempenho,
 * últimos pedidos do cardápio e "Pra vender mais".
 * (08/10 · 3.21) Ícones do app no lugar dos emojis, situação com as cores da lista de Pedidos,
 * número do pedido aparecendo, botões de 44px e o PRO no cartão vinho.
 */
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// (11/10) a situação vem de UMA conta só (lib/agendaCardapio), a mesma do topo do cardápio

const STATUS: Record<string, [string, string]> = {
  novo: ["Novo pedido", "am"], aguardando_aceite: ["Novo pedido", "am"], aguardando_pagamento: ["Aguardando pagamento", "am"],
  agendado: ["Agendado", "bl"], confirmado: ["Agendado", "bl"], em_producao: ["Em produção", "rs"], finalizado: ["Pronto", "ok"],
  aguardando_retirada: ["Pronto", "ok"], em_entrega: ["Saiu para entrega", "bl"], entregue: ["Entregue", "ok"], concluido: ["Entregue", "ok"], cancelado: ["Cancelado", "cz"],
};

export default function VisaoGeralDesktop({ profile, linkCardapio, publicado: _publicado, onShare }: { profile: (Profile & { horario?: unknown; dias_fechados?: unknown }) | null; linkCardapio: string; publicado: boolean; onShare: () => void }) {
  const navigate = useNavigate();
  const [completo, setCompleto] = useState<boolean | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const { dados, falhou, tentar } = useDadosCardapio(profile?.id); // (6.169) a mesma busca do celular
  const [qr, setQr] = useState("");
  const [copiado, setCopiado] = useState(false);
  const situacao = useMemo(() => situacaoLoja(horarioComFechados(profile?.horario, (profile as { dias_fechados?: unknown } | null)?.dias_fechados)), [profile?.horario, (profile as { dias_fechados?: unknown } | null)?.dias_fechados]);

  const carregando = falhou
    ? <p className="vgd-vazio">Não deu para carregar. <button type="button" className="vgd-tentar" onClick={tentar}>Tentar de novo</button></p>
    : <p className="vgd-vazio">Carregando…</p>;

  useEffect(() => {
    if (!linkCardapio) return;
    QRCode.toDataURL(linkCardapio, { width: 480, margin: 1, color: { dark: "#2C1219", light: "#FFFFFF" } }).then(setQr).catch(() => setQr(""));
  }, [linkCardapio]);

  const metr = useMetricasCardapio(dados, periodo);
  const variacao = (atual: number, antes?: number) => variacaoCardapio(periodo, atual, antes);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(linkCardapio); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* navegador sem permissão de copiar: só não mostra "copiado" */ }
  };
  const baixarQr = () => {
    if (!qr) return;
    const a = document.createElement("a"); a.href = qr; a.download = `qrcode-cardapio-${profile?.codigo_publico || "doonly"}.png`; a.click();
  };
  const tituloGrafico = periodo === "hoje" ? "Visitas ao longo de hoje" : periodo === "tudo" ? "Visitas nas últimas 8 semanas" : `Visitas nos últimos ${periodo === "7d" ? 7 : 30} dias`;
  const quandoTxt = quandoCardapio(periodo);
  const ultimos = (dados?.pedidos || []).slice(0, 5);

  return (
    <div className="vgd">
      {/* Enquanto não está pronto: passo a passo no lugar do cartão do link */}
      <PrimeirosPassos local="cardapio" onEstado={setCompleto} />

      {completo && (
        <section className="vgd-hero" aria-label="Seu link">
          <div className="vgd-hero-tx">
            {situacao && <span className={`vgd-st${situacao.aberto ? "" : " off"}`}><i />{situacao.txt}</span>}
            <h2>Seu cardápio está no ar</h2>
            <p>Mande o link para os seus clientes. Eles escolhem, pagam e o pedido chega aqui.</p>
            <div className="vgd-lk">
              <LinkSimple size={18} weight="bold" aria-hidden="true" />
              <span>{linkCardapio.replace(/^https?:\/\//, "")}</span>
              <button type="button" onClick={copiar}>{copiado ? <><Check size={16} weight="bold" aria-hidden="true" />Copiado</> : <><Copy size={16} weight="bold" aria-hidden="true" />Copiar</>}</button>
            </div>
            <div className="vgd-btns">
              <button type="button" className="vgd-b vgd-bw" onClick={onShare}><IconeWhatsApp size={18} />Enviar no WhatsApp</button>
              <a className="vgd-b vgd-bs" href={linkCardapio} target="_blank" rel="noopener noreferrer"><ArrowSquareOut size={16} weight="bold" aria-hidden="true" />Ver como cliente</a>
            </div>
          </div>
          {qr && (
            <div className="vgd-qr">
              <img src={qr} alt="QR Code do cardápio" />
              <b>QR Code</b>
              <small>Para imprimir</small>
              <button type="button" onClick={baixarQr}><DownloadSimple size={16} weight="bold" aria-hidden="true" />Baixar</button>
            </div>
          )}
        </section>
      )}

      <section className="vgd-card" aria-label="Desempenho do cardápio">
        <div className="vgd-rowh">
          <div><p className="vgd-ct">Desempenho do cardápio</p><p className="vgd-cs">Quem visitou e quem comprou {quandoTxt}</p></div>
          <div className="vgd-tabs" role="tablist">
            {([["hoje", "Hoje"], ["7d", "7 dias"], ["30d", "30 dias"], ["tudo", "Tudo"]] as [Periodo, string][]).map(([v, l]) => (
              <button key={v} type="button" role="tab" aria-selected={periodo === v} className={periodo === v ? "on" : ""} onClick={() => setPeriodo(v)}>{l}</button>
            ))}
          </div>
        </div>
        {!metr ? carregando : (
          <>
            <div className="vgd-kp">
              {([[Eye, "Visitas", String(metr.vis), variacao(metr.vis, metr.ant?.vis)],
                [Receipt, "Pedidos pelo cardápio", String(metr.ped), variacao(metr.ped, metr.ant?.ped)],
                [CurrencyCircleDollar, "Vendido pelo cardápio", brl(metr.rec), variacao(metr.rec, metr.ant?.rec)],
                [ChartLineUp, "Conversão", metr.vis ? `${metr.conv.toFixed(1).replace(".", ",")}%` : "—", metr.vis ? { txt: `${Math.round(metr.conv)} de cada 100 visitas compram`, up: true, neutro: true } : { txt: "sem visitas ainda", up: true, neutro: true }],
              ] as [typeof Eye, string, string, Variacao][]).map(([Ic, l, v, d]) => (
                <div className="vgd-k" key={l}>
                  <span className="vgd-k-ic" aria-hidden="true"><Ic size={18} weight="bold" /></span>
                  <small>{l}</small><b>{v}</b>
                  <em className={!d ? "n" : d.neutro ? "n" : d.up ? "" : "down"}>{d ? d.txt : "—"}</em>
                </div>
              ))}
            </div>
            <div className="vgd-gr">
              <div className="vgd-gr-h"><p className="vgd-gt">{tituloGrafico}</p></div>
              {metr.serie.every(x => x.n === 0) ? (
                <div className="vgd-gv">
                  <span>Ninguém abriu o cardápio {quandoTxt}. Mande o link para os seus clientes.</span>
                  <button type="button" className="vgd-b vgd-bw" onClick={onShare}><IconeWhatsApp size={18} />Enviar no WhatsApp</button>
                </div>
              ) : (
                <Suspense fallback={<div style={{ height: 262 }} />}>
                  <GraficoVisitas serie={metr.serie} unidade={periodo === "hoje" ? "horário" : periodo === "tudo" ? "semana" : "dia"}
                    legA={periodo === "hoje" ? "Hoje" : periodo === "tudo" ? "Últimas 8 semanas" : `Últimos ${periodo === "7d" ? 7 : 30} dias`}
                    legB={periodo === "hoje" ? "Ontem" : periodo === "tudo" ? null : `${periodo === "7d" ? 7 : 30} dias anteriores`} />
                </Suspense>
              )}
            </div>
          </>
        )}
      </section>

      <div className="vgd-g2">
        <div className="vgd-card">
          <div className="vgd-rowh">
            <div><p className="vgd-ct">Últimos pedidos do cardápio</p><p className="vgd-cs">Os que chegaram pelo seu link</p></div>
            {ultimos.length > 0 && <Botao variante="link" iconeDepois={<CaretRight size={16} weight="bold" />} onClick={() => navigate("/pedidos")}>Ver todos</Botao>}
          </div>
          {!dados ? carregando : ultimos.length === 0 ? (
            <p className="vgd-vazio">Nenhum pedido pelo cardápio ainda. Compartilhe o link para receber o primeiro.</p>
          ) : ultimos.map(p => {
            const [st0, cor] = STATUS[p.status] || ["Agendado", "bl"];
            const st = st0 === "Entregue" && p.tipo_entrega !== "entrega" ? "Retirado" : st0;
            // (24/10) o mesmo produto em várias linhas vira um só, com a quantidade somada (antes "Kit festa + Kit festa + Kit festa × 2")
            const somados = new Map<string, number>();
            for (const i of p.pedido_itens || []) { const n = String(i.nome_produto || "Produto"); somados.set(n, (somados.get(n) || 0) + (Number(i.quantidade) || 1)); }
            const itens = [...somados].map(([n, qt]) => `${n}${qt > 1 ? ` × ${qt.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}` : ""}`).join(" + ");
            // (24/10) a data é de quando o pedido chegou: agora diz isso ("feito em 07/11")
            const quando = new Date(p.created_at); const hoje = new Date();
            const q = quando.toDateString() === hoje.toDateString() ? `feito hoje às ${quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : `feito em ${quando.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
            return (
              <button type="button" className="vgd-pe" key={p.id} onClick={() => navigate(`/pedidos/${p.id}/editar`)}>
                <span className="vgd-pa">{String(p.cliente_nome || "C").trim().charAt(0).toUpperCase()}</span>
                <span className="vgd-pt"><b>{p.cliente_nome || "Cliente"}</b><small>{[p.numero ? `#${p.numero}` : "", itens].filter(Boolean).join(" · ") || "Pedido"} · {q}</small></span>
                <span className="vgd-pv"><b>{brl(Number(p.valor_total) || 0)}</b><small className={`vgd-sit ${cor}`}>{st}</small></span>
              </button>
            );
          })}
        </div>

        <div className="vgd-card">
          <div className="vgd-rowh"><div><p className="vgd-ct">Mais pedidos pelo cardápio</p><p className="vgd-cs">{quandoTxt.charAt(0).toUpperCase() + quandoTxt.slice(1)}</p></div></div>
          {!metr ? carregando : metr.top.length === 0 ? (
            <p className="vgd-vazio">Os produtos aparecem aqui quando chegarem pedidos {quandoTxt}.</p>
          ) : (
            <ol className="vgd-top">
              {metr.top.map(([nm, qt], i) => (
                <li key={nm}><span className="vgd-top-n">{i + 1}</span><span className="vgd-top-t">{nm}</span><b>{qt.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</b>
                  <i style={{ width: `${Math.round((qt / metr.top[0][1]) * 100)}%` }} aria-hidden="true" /></li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <style>{`
        /* (31/10 · 5.89) Visão geral refeita: cartão do link claro (sem o marrom), números com ícone,
           gráfico em todos os períodos e "Mais pedidos" ao lado dos últimos pedidos */
        .vgd { display: flex; flex-direction: column; gap: 16px; margin-top: 20px; font-family: var(--font-base); color: var(--ui-texto); }
        .vgd-card { background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); padding: 20px 22px; }
        .vgd-ct { margin: 0; font-size: 16px; font-weight: 600; } .vgd-cs { margin: 2px 0 0; font-size: 13px; color: var(--ui-texto-2); }
        .vgd-rowh { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }

        .vgd-hero { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 28px; align-items: center; padding: 22px 24px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); background: var(--ui-branco); box-shadow: var(--ui-sombra-cartao); position: relative; overflow: hidden; }
        .vgd-hero::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 4px; background: linear-gradient(90deg, var(--ui-rosa), #F9A8C9); }
        .vgd-st { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 600; color: #157A3C; background: #E7F6EC; }
        .vgd-st i { width: 7px; height: 7px; border-radius: 50%; background: #22A559; }
        .vgd-st.off { color: #9A4A06; background: #FDF1E1; } .vgd-st.off i { background: #F59E0B; }
        .vgd-hero h2 { margin: 10px 0 0; font-size: 21px; font-weight: 600; color: var(--ui-texto); }
        .vgd-hero-tx > p { margin: 4px 0 0; font-size: 14px; color: var(--ui-texto-2); }
        .vgd-lk { display: flex; align-items: center; gap: 10px; max-width: 620px; margin-top: 16px; padding: 4px 4px 4px 14px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio); background: #FBF9FA; font-size: 14px; color: var(--ui-texto-2); }
        .vgd-lk svg { flex: none; color: var(--ui-rosa-escuro); }
        .vgd-lk span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-texto); }
        .vgd-lk button { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border: 0; border-radius: 9px; background: var(--ui-branco); box-shadow: 0 1px 3px rgba(42,21,32,.10); font: 600 13.5px var(--font-base); color: var(--ui-texto); cursor: pointer; }
        .vgd-lk button:hover { color: var(--ui-rosa-escuro); }
        .vgd-btns { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
        .vgd-b { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 18px; border: none; border-radius: var(--ui-raio-botao); font: 600 14px var(--font-base); text-decoration: none; cursor: pointer; white-space: nowrap; }
        .vgd-bw { background: #15803D; color: var(--ui-branco); } .vgd-bw:hover { background: #166534; }
        .vgd-bs { background: #F1ECEE; color: var(--ui-texto); } .vgd-bs:hover { background: #E9E1E5; }
        .vgd-qr { display: flex; flex-direction: column; align-items: center; width: 168px; padding: 14px 12px 10px; border: 1px solid var(--ui-borda); border-radius: 16px; background: #FBF9FA; text-align: center; }
        .vgd-qr img { width: 112px; height: 112px; padding: 6px; border-radius: 10px; background: var(--ui-branco); }
        .vgd-qr b { margin-top: 8px; font-size: 13.5px; font-weight: 600; } .vgd-qr small { font-size: 12px; line-height: 1.35; color: var(--ui-texto-2); }
        .vgd-qr button { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; margin-top: 4px; padding: 0 10px; border: 0; background: none; font: 600 13px var(--font-base); color: var(--ui-rosa-escuro); cursor: pointer; }

        .vgd-tabs { display: flex; gap: 2px; padding: 3px; border-radius: 12px; background: rgba(42,21,32,.06); }
        .vgd-tabs button { min-height: 38px; padding: 0 14px; border: none; border-radius: 9px; background: none; font: 500 13.5px var(--font-base); color: var(--ui-texto-2); cursor: pointer; }
        .vgd-tabs button.on { background: var(--ui-branco); color: var(--ui-texto); font-weight: 600; box-shadow: 0 1px 3px rgba(42,21,32,.10); }
        .vgd-kp { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
        .vgd-k { position: relative; padding: 14px 16px; border: 1px solid var(--ui-borda); border-radius: 14px; background: var(--ui-branco); }
        .vgd-k-ic { position: absolute; top: 12px; right: 12px; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 10px; background: var(--ui-rosa-claro, #FCE7F1); color: var(--ui-rosa-escuro); }
        .vgd-k small { display: block; padding-right: 36px; font-size: 13px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .vgd-k b { display: block; margin-top: 6px; font-size: 24px; font-weight: 600; white-space: nowrap; }
        .vgd-k em { display: block; margin-top: 2px; font-style: normal; font-size: 12.5px; font-weight: 500; color: var(--ui-verde); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .vgd-k em.down { color: #B91C1C; } .vgd-k em.n { color: var(--ui-texto-3); }
        .vgd-gr { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--ui-linha); }
        .vgd-gr-h { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
        .vgd-gt { margin: 0; font-size: 14px; font-weight: 600; color: var(--ui-texto); } .vgd-gr-max { font-size: 12.5px; color: var(--ui-texto-3); }
        .vgd-gv { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 12px; padding: 14px 16px; border-radius: var(--ui-raio); background: #FBF9FA; font-size: 14px; color: var(--ui-texto-2); }
        .vgd-gv span { min-width: 0; }

        .vgd-g2 { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 16px; align-items: start; }
        @media (max-width: 1180px) { .vgd-g2 { grid-template-columns: 1fr; } .vgd-hero { grid-template-columns: 1fr; } .vgd-qr { flex-direction: row; width: auto; gap: 12px; text-align: left; } .vgd-kp { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .vgd-pe { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 60px; padding: 8px 0; border: none; border-top: 1px solid var(--ui-linha); background: none; font-family: inherit; text-align: left; cursor: pointer; color: inherit; }
        .vgd-card > .vgd-pe:first-of-type { margin-top: 10px; }
        .vgd-pa { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; background: #FCE7F3; color: var(--ui-rosa-escuro); font-weight: 600; }
        .vgd-pt { flex: 1; min-width: 0; } .vgd-pt b { display: block; font-size: 15px; font-weight: 500; }
        .vgd-pt small { display: block; font-size: 13px; color: var(--ui-texto-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .vgd-pe .vgd-pv { display: flex; flex-direction: column; align-items: flex-end; flex: none; } .vgd-pe .vgd-pv b { font-size: 14.5px; font-weight: 600; } .vgd-pe .vgd-pv small { font-size: 12.5px; }
        .vgd-pe:hover .vgd-pt b { color: var(--ui-rosa-escuro); }
        .vgd-sit.ok { color: var(--ui-verde); } .vgd-sit.am { color: var(--ui-laranja); } .vgd-sit.bl { color: var(--ui-azul); } .vgd-sit.rs { color: var(--ui-rosa-escuro); } .vgd-sit.cz { color: var(--ui-texto-3); } .vgd-sit.rd { color: var(--ui-vermelho); }
        .vgd-vazio { margin: 14px 0 4px; font-size: 13.5px; color: var(--ui-texto-2); }
        .vgd-tentar { position: relative; margin: 0; padding: 0; border: 0; background: none; color: var(--ui-rosa-escuro); font: inherit; font-weight: 600; cursor: pointer; }
        .vgd-tentar::after { content: ""; position: absolute; inset: -12px -6px; }
        .vgd-top { margin: 10px 0 0; padding: 0; list-style: none; }
        .vgd-top li { position: relative; display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 6px 0 10px; border-top: 1px solid var(--ui-linha); font-size: 14px; }
        .vgd-top-n { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; flex: none; border-radius: 50%; background: #F1ECEE; font-size: 12px; font-weight: 600; color: var(--ui-texto-2); }
        .vgd-top-t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .vgd-top li b { flex: none; font-weight: 600; }
        .vgd-top li i { position: absolute; left: 34px; bottom: 4px; height: 3px; max-width: calc(100% - 34px); border-radius: 2px; background: #F9A8C9; }
      `}</style>
    </div>
  );
}

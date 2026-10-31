import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";
import PrimeirosPassos from "@/components/PrimeirosPassos";
import { ArrowSquareOut, CaretRight, ChartLineUp, Check, Copy, CurrencyCircleDollar, DownloadSimple, Eye, LinkSimple, Receipt } from "@phosphor-icons/react";
import IconeWhatsApp from "@/components/IconeWhatsApp";
import { Botao } from "@/components/base";
import { situacaoLoja } from "@/lib/agendaCardapio";

/**
 * Visão geral do Cardápio digital — COMPUTADOR (aprovada 02/10).
 * Sem as listas de atalhos (agora estão no menu lateral). Quatro blocos:
 * cartão do link (situação da loja + compartilhar + QR Code), desempenho,
 * últimos pedidos do cardápio e "Pra vender mais".
 * (08/10 · 3.21) Ícones do app no lugar dos emojis, situação com as cores da lista de Pedidos,
 * número do pedido aparecendo, botões de 44px e o PRO no cartão vinho.
 */
type Periodo = "hoje" | "7d" | "30d" | "tudo";
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// (11/10) a situação vem de UMA conta só (lib/agendaCardapio), a mesma do topo do cardápio

function inicioPeriodo(p: Periodo): Date | null {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (p === "hoje") return d;
  if (p === "7d") { d.setDate(d.getDate() - 6); return d; }
  if (p === "30d") { d.setDate(d.getDate() - 29); return d; }
  return null;
}

const STATUS: Record<string, [string, string]> = {
  novo: ["Novo pedido", "am"], aguardando_aceite: ["Novo pedido", "am"], aguardando_pagamento: ["Aguardando pagamento", "am"],
  agendado: ["Agendado", "bl"], confirmado: ["Agendado", "bl"], em_producao: ["Em produção", "rs"], finalizado: ["Pronto", "ok"],
  aguardando_retirada: ["Pronto", "ok"], em_entrega: ["Saiu para entrega", "bl"], entregue: ["Entregue", "ok"], concluido: ["Entregue", "ok"], cancelado: ["Cancelado", "cz"],
};

export default function VisaoGeralDesktop({ profile, linkCardapio, publicado: _publicado, onShare }: { profile: any; linkCardapio: string; publicado: boolean; onShare: () => void }) {
  const navigate = useNavigate();
  const [completo, setCompleto] = useState<boolean | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const [dados, setDados] = useState<{ visitas: string[]; pedidos: any[]; produtos: any[]; temCupom: boolean } | null>(null);
  const [qr, setQr] = useState("");
  const [copiado, setCopiado] = useState(false);
  const situacao = useMemo(() => situacaoLoja(profile?.horario), [profile?.horario]);

  // Busca 60 dias de visitas/pedidos (dá pra comparar até "30 dias" com o período anterior)
  useEffect(() => {
    if (!profile?.id) return;
    const desde = new Date(); desde.setDate(desde.getDate() - 60);
    Promise.all([
      supabase.from("cardapio_visitas").select("created_at").eq("user_id", profile.id).gte("created_at", desde.toISOString()),
      supabase.from("pedidos").select("id, numero, cliente_nome, valor_total, status, tipo_entrega, created_at, pedido_itens(nome_produto, quantidade)")
        .eq("user_id", profile.id).eq("origem", "cardapio").order("created_at", { ascending: false }).limit(500),
      supabase.from("produtos").select("id, imagem_url, descricao, disponivel").eq("user_id", profile.id),
      supabase.from("loja_cupons").select("cupons").eq("user_id", profile.id).maybeSingle(),
    ]).then(([v, p, pr, c]) => setDados({
      visitas: ((v.data as any[]) || []).map(x => x.created_at),
      pedidos: (p.data as any[]) || [],
      produtos: ((pr.data as any[]) || []).filter(x => x.disponivel !== false),
      temCupom: Array.isArray((c.data as any)?.cupons) && (c.data as any).cupons.some((x: any) => x?.ativo),
    }));
  }, [profile?.id]);

  useEffect(() => {
    if (!linkCardapio) return;
    QRCode.toDataURL(linkCardapio, { width: 480, margin: 1, color: { dark: "#2C1219", light: "#FFFFFF" } }).then(setQr).catch(() => setQr(""));
  }, [linkCardapio]);

  const metr = useMemo(() => {
    if (!dados) return null;
    const ini = inicioPeriodo(periodo);
    const dentro = (iso: string, a: Date | null, b?: Date) => { const t = new Date(iso).getTime(); return (!a || t >= a.getTime()) && (!b || t < b.getTime()); };
    const ativos = dados.pedidos.filter(p => p.status !== "cancelado");
    const vis = dados.visitas.filter(x => dentro(x, ini)).length;
    const ped = ativos.filter(p => dentro(p.created_at, ini));
    const rec = ped.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
    let ant: { vis: number; ped: number; rec: number } | null = null;
    if (ini) {
      const dur = Date.now() - ini.getTime(); const a0 = new Date(ini.getTime() - dur);
      const pa = ativos.filter(p => dentro(p.created_at, a0, ini));
      ant = { vis: dados.visitas.filter(x => dentro(x, a0, ini)).length, ped: pa.length, rec: pa.reduce((s, p) => s + (Number(p.valor_total) || 0), 0) };
    }
    // (31/10 · 5.89) o gráfico em todos os períodos: hoje por hora, 7 e 30 dias por dia, "tudo" por semana (8 semanas)
    type Barra = { ini: Date; fim: Date; rot: string; dica: string };
    let barras: Barra[] = [];
    if (periodo === "hoje") {
      const h0 = new Date(); h0.setHours(0, 0, 0, 0);
      barras = Array.from({ length: 24 }, (_, h) => { const i = new Date(h0); i.setHours(h); const f = new Date(i); f.setHours(h + 1); return { ini: i, fim: f, rot: h % 3 === 0 ? `${h}h` : "", dica: `${h}h às ${h + 1}h` }; });
    } else if (periodo === "tudo") {
      const fimSem = new Date(); fimSem.setHours(24, 0, 0, 0);
      barras = Array.from({ length: 8 }, (_, k) => { const f = new Date(fimSem); f.setDate(f.getDate() - 7 * (7 - k)); const i = new Date(f); i.setDate(i.getDate() - 7); const ult = new Date(f); ult.setDate(ult.getDate() - 1);
        return { ini: i, fim: f, rot: k === 7 ? "esta" : i.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), dica: `${i.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} a ${ult.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` }; });
    } else {
      const nDias = periodo === "30d" ? 30 : 7;
      barras = Array.from({ length: nDias }, (_, k) => { const i = new Date(); i.setHours(0, 0, 0, 0); i.setDate(i.getDate() - (nDias - 1 - k)); const f = new Date(i); f.setDate(f.getDate() + 1);
        const rot = nDias === 7 ? (k === nDias - 1 ? "hoje" : i.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")) : (k === nDias - 1 ? "hoje" : k % 5 === 0 ? String(i.getDate()) : "");
        return { ini: i, fim: f, rot, dica: i.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }) }; });
    }
    const serie = barras.map(b => ({ ...b, n: dados.visitas.filter(x => dentro(x, b.ini, b.fim)).length }));
    // mais pedidos pelo cardápio no período (pela quantidade)
    const conta = new Map<string, number>();
    for (const p of ped) for (const it of p.pedido_itens || []) { const nm = String(it.nome_produto || "Produto"); conta.set(nm, (conta.get(nm) || 0) + (Number(it.quantidade) || 1)); }
    const top = [...conta].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { vis, ped: ped.length, rec, conv: vis > 0 ? (ped.length / vis) * 100 : 0, ant, serie, top };
  }, [dados, periodo]);

  const variacao = (atual: number, antes?: number) => {
    if (antes == null || periodo === "tudo") return null;
    if (antes === 0) return atual > 0 ? { txt: "▲ novo no período", up: true } : null;
    const pct = Math.round(((atual - antes) / antes) * 100);
    // 13/10: diz com o que comparou ("vs ontem", "vs 7 dias antes") em vez de "vs período anterior"
    const comQue = periodo === "hoje" ? "ontem" : periodo === "7d" ? "7 dias antes" : "30 dias antes";
    return { txt: `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs ${comQue}`, up: pct >= 0 };
  };


  const copiar = async () => {
    try { await navigator.clipboard.writeText(linkCardapio); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* navegador sem permissão de copiar: só não mostra "copiado" */ }
  };
  const baixarQr = () => {
    if (!qr) return;
    const a = document.createElement("a"); a.href = qr; a.download = `qrcode-cardapio-${profile?.codigo_publico || "doonly"}.png`; a.click();
  };
  const maxBarra = Math.max(1, ...(metr?.serie || []).map(d => d.n));
  const tituloGrafico = periodo === "hoje" ? "Visitas por hora, hoje" : periodo === "tudo" ? "Visitas por semana" : `Visitas por dia, últimos ${periodo === "7d" ? 7 : 30} dias`;
  const quandoTxt = periodo === "hoje" ? "hoje" : periodo === "7d" ? "nos últimos 7 dias" : periodo === "30d" ? "nos últimos 30 dias" : "nas últimas 8 semanas";
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
        {!metr ? <p className="vgd-vazio">Carregando…</p> : (
          <>
            <div className="vgd-kp">
              {([[Eye, "Visitas", String(metr.vis), variacao(metr.vis, metr.ant?.vis)],
                [Receipt, "Pedidos pelo cardápio", String(metr.ped), variacao(metr.ped, metr.ant?.ped)],
                [CurrencyCircleDollar, "Vendido pelo cardápio", brl(metr.rec), variacao(metr.rec, metr.ant?.rec)],
                [ChartLineUp, "Conversão", `${metr.conv.toFixed(1).replace(".", ",")}%`, metr.vis ? { txt: `${Math.round(metr.conv)} de cada 100 visitas compram`, up: true, neutro: true } : { txt: "sem visitas ainda", up: true, neutro: true }],
              ] as [typeof Eye, string, string, any][]).map(([Ic, l, v, d]) => (
                <div className="vgd-k" key={l}>
                  <span className="vgd-k-ic" aria-hidden="true"><Ic size={18} weight="bold" /></span>
                  <small>{l}</small><b>{v}</b>
                  <em className={!d ? "n" : d.neutro ? "n" : d.up ? "" : "down"}>{d ? d.txt : "—"}</em>
                </div>
              ))}
            </div>
            <div className="vgd-gr">
              <div className="vgd-gr-h"><p className="vgd-gt">{tituloGrafico}</p>{metr.vis > 0 && <span className="vgd-gr-max">maior: {maxBarra} {maxBarra === 1 ? "visita" : "visitas"}</span>}</div>
              {metr.serie.every(x => x.n === 0) ? (
                <div className="vgd-gv">
                  <span>Ninguém abriu o cardápio {quandoTxt}. Mande o link para os seus clientes.</span>
                  <button type="button" className="vgd-b vgd-bw" onClick={onShare}><IconeWhatsApp size={18} />Enviar no WhatsApp</button>
                </div>
              ) : (
                <div className={`vgd-bars${metr.serie.length > 8 ? " vgd-bars--fino" : ""}`}>
                  {metr.serie.map((b, i) => (
                    <div className={`vgd-bar${b.n === 0 ? " zero" : ""}`} key={i} title={`${b.dica}: ${b.n} visita${b.n !== 1 ? "s" : ""}`}>
                      {metr.serie.length <= 8 && <em>{b.n > 0 ? b.n : ""}</em>}
                      <i style={{ height: b.n > 0 ? `${Math.max(6, Math.round((b.n / maxBarra) * 100))}%` : undefined }} />
                      <span>{b.rot}</span>
                    </div>
                  ))}
                </div>
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
          {!dados ? <p className="vgd-vazio">Carregando…</p> : ultimos.length === 0 ? (
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
          {!metr ? <p className="vgd-vazio">Carregando…</p> : metr.top.length === 0 ? (
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
        .vgd-bw { background: #25D366; color: var(--ui-branco); } .vgd-bw:hover { background: #1FBE5B; }
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
        .vgd-bars { display: flex; align-items: flex-end; gap: 12px; height: 160px; margin-top: 12px; padding-top: 4px;
          background: repeating-linear-gradient(to top, transparent 0, transparent calc(25% - 1px), var(--ui-linha) calc(25% - 1px), var(--ui-linha) 25%); background-size: 100% calc(100% - 19px); background-repeat: no-repeat; }
        .vgd-bars--fino { gap: 4px; }
        .vgd-bar { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 5px; height: 100%; min-width: 0; }
        .vgd-bar i { width: 100%; max-width: 44px; border-radius: 6px 6px 2px 2px; background: linear-gradient(180deg, #F472B6, var(--ui-rosa-escuro)); transition: filter .15s; }
        .vgd-bar:hover i { filter: brightness(1.08); }
        .vgd-bar.zero i { height: 3px; border-radius: 2px; background: var(--ui-linha); }
        .vgd-bars--fino .vgd-bar i { border-radius: 3px 3px 1px 1px; }
        .vgd-bar span { height: 14px; font-size: 12px; color: var(--ui-texto-3); white-space: nowrap; } .vgd-bar em { font-style: normal; font-size: 12px; font-weight: 500; color: var(--ui-texto-2); }

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

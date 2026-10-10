// Financeiro — painel (Passo 7, 03/10). Junta o que antes ficava na Visão Geral e no menu:
// saldo em caixa, os números do mês, a receber, a pagar, previstos, fluxo e últimas movimentações.
import EstiloFinanceiro from "@/components/financeiro/EstiloFinanceiro";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp, ArrowDown, CaretLeft, CaretRight, ArrowsLeftRight, Calculator, ChartPieSlice, ShoppingBagOpen, TrendUp } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { useCaixa, SaldoCaixa, MovimentosCaixa, SaldoSheet, CaixaEstilos } from "@/components/financeiro/CaixaCard";
import PrevistosCard from "@/components/financeiro/PrevistosCard";
import DespesaSheet from "@/components/financeiro/DespesaSheet";
import { carregarMes, resumoAPagar, type MesFinanceiro } from "@/lib/painelFinanceiro";
import { carregarAReceber, isoDia } from "@/lib/contasReceber";

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// 10/10: dinheiro sempre com centavos (antes os cards do mês mostravam "R$ 801" ao lado de "R$ 1.835,40")
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function Financeiro() {
  const navigate = useNavigate();
  const { uid, cx, recarregar } = useCaixa();
  const [definir, setDefinir] = useState(false);
  const [nova, setNova] = useState<"entrada" | "saida" | null>(null);
  const hoje = new Date();
  const [mes, setMes] = useState({ ano: hoje.getFullYear(), m: hoje.getMonth() });
  const [dados, setDados] = useState<MesFinanceiro | null>(null);
  const [rec, setRec] = useState<{ total: number; qtd: number; semana: number } | null>(null);
  const [pag, setPag] = useState<{ total: number; qtd: number; proxima: string | null } | null | undefined>(undefined);
  const [versao, setVersao] = useState(0); // recarrega tudo depois de uma mudança
  // Sem saldo informado: o resto do painel fica levemente apagado pra guiar o olho pro convite
  // (continua tocável — os números do mês já valem sem o saldo). "Agora não" tira o efeito.
  const chaveDepois = uid ? `doonly_saldo_depois_${uid}` : "";
  const [depois, setDepois] = useState(false);
  useEffect(() => { if (chaveDepois) { try { setDepois(!!localStorage.getItem(chaveDepois)); } catch { /* sem acesso */ } } }, [chaveDepois]);
  const foco = !!cx && !cx.precisaSql && !cx.configurado && !depois;

  useEffect(() => { if (uid) { setDados(null); carregarMes(uid, mes.ano, mes.m).then(setDados); } }, [uid, mes, versao]);
  useEffect(() => {
    if (!uid) return;
    carregarAReceber(uid).then(l => {
      const em7 = isoDia(6);
      setRec({ total: l.reduce((s, x) => s + x.falta, 0), qtd: l.length, semana: l.filter(x => x.dataRef && x.dataRef <= em7).length });
    });
    resumoAPagar().then(setPag);
  }, [uid, versao]);

  const ehMesAtual = mes.ano === hoje.getFullYear() && mes.m === hoje.getMonth();
  const mudarMes = (d: number) => setMes(x => { const n = new Date(x.ano, x.m + d, 1); return { ano: n.getFullYear(), m: n.getMonth() }; });
  const depoisDeMudar = async () => { await recarregar(); setVersao(v => v + 1); };

  return (
    <>
      <AppPageHeader
        title="Financeiro"
        subtitle="Seu dinheiro, sem mistério"
        infoIcon="💰"
        rightActions={
          <div className="fd-hd">
            <div className="fd-hd-mes">
              <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><CaretLeft size={14} weight="bold" /></button>
              <b>{MESES[mes.m]} de {mes.ano}</b>
              <button type="button" onClick={() => mudarMes(1)} disabled={ehMesAtual} aria-label="Próximo mês"><CaretRight size={14} weight="bold" /></button>
            </div>
            <button type="button" className="fd-hd-bt e" onClick={() => setNova("entrada")}><ArrowUp size={15} weight="bold" />Nova entrada</button>
            <button type="button" className="fd-hd-bt s" onClick={() => setNova("saida")}><ArrowDown size={15} weight="bold" />Nova saída</button>
          </div>
        }
        infoContent={<>
          <p><strong>Saldo em caixa</strong>: o dinheiro que você tem agora (o saldo que você informou + o que recebeu − o que pagou).</p>
          <p><strong>Recebido</strong> é o dinheiro que entrou no mês. <strong>Vendido</strong> são os pedidos entregues no mês. <strong>Lucro</strong> é o vendido menos o custo dos ingredientes (ficha técnica) e as despesas do mês.</p>
          <p>Pedido criado ou entregue <strong>não entra no caixa sozinho</strong>: só quando você registra o recebimento.</p>
        </>}
      />
      <EstiloFinanceiro />
      <CaixaEstilos />
      <div className={`fd${foco ? " fd--foco" : ""}${cx && !cx.configurado ? " fd--sem-caixa" : ""}`}>
        <div className="fd-a-saldo">
          <SaldoCaixa cx={cx} onAcertar={() => setDefinir(true)} destaque={foco}
            onDepois={foco ? () => { setDepois(true); try { localStorage.setItem(chaveDepois, "1"); } catch { /* sem acesso */ } } : undefined} />
          <div className="fd-acoes">
            <button type="button" className="fd-bt e" onClick={() => setNova("entrada")}><ArrowUp size={17} weight="bold" />Nova entrada</button>
            <button type="button" className="fd-bt s" onClick={() => setNova("saida")}><ArrowDown size={17} weight="bold" />Nova saída</button>
          </div>
        </div>

        <div className="fd-a-mes fd-mes">
          <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><CaretLeft size={16} weight="bold" /></button>
          <b>{MESES[mes.m]} de {mes.ano}</b>
          <button type="button" onClick={() => mudarMes(1)} disabled={ehMesAtual} aria-label="Próximo mês"><CaretRight size={16} weight="bold" /></button>
        </div>

        <div className="fd-a-kpis fd-kpis">
          <div className="fd-k"><span className="fd-ki e" aria-hidden="true"><ArrowUp size={14} weight="bold" /></span><small>Recebido no mês</small><b className="e">{dados ? brl(dados.recebido) : "…"}</b><i>dinheiro que entrou</i></div>
          <div className="fd-k"><span className="fd-ki s" aria-hidden="true"><ArrowDown size={14} weight="bold" /></span><small>Despesas pagas</small><b className="s">{dados ? brl(dados.despesasPagas) : "…"}</b><i>dinheiro que saiu</i></div>
          <div className="fd-k fd-k--vendido"><span className="fd-ki n" aria-hidden="true"><ShoppingBagOpen size={14} weight="bold" /></span><small>Vendido no mês</small><b>{dados ? brl(dados.vendido) : "…"}</b><i>{dados ? `${dados.qtdVendidos} ${dados.qtdVendidos === 1 ? "pedido entregue" : "pedidos entregues"}` : ""}</i></div>
          <div className="fd-k"><span className="fd-ki l" aria-hidden="true"><TrendUp size={14} weight="bold" /></span><small>Lucro do mês</small><b className={dados && dados.lucro < 0 ? "s" : "l"}>{dados ? brl(dados.lucro) : "…"}</b>
            <i className="fd-so-cel">{dados ? (dados.vendido > 0 ? `margem de ${dados.margem}%` : "sem vendas entregues") : ""}{dados && dados.semFicha > 0 ? ` · ${dados.semFicha} sem ficha` : ""}</i>
            <i className="fd-so-desk">{dados ? `vendido ${brl(dados.vendido)}${dados.vendido > 0 ? ` · margem ${dados.margem}%` : ""}` : ""}{dados && dados.semFicha > 0 ? ` · ${dados.semFicha} sem ficha` : ""}</i></div>
        </div>

        <div className="fd-a-contas fd-contas">
          <button type="button" className="fd-k2 rec" onClick={() => navigate("/financeiro/a-receber")}>
            <small>A receber</small><b>{rec ? brl(rec.total) : "…"}</b>
            <i>{rec ? `${rec.qtd} ${rec.qtd === 1 ? "pedido" : "pedidos"}${rec.semana ? ` · ${rec.semana} nesta semana` : ""}` : ""}<CaretRight size={13} weight="bold" /></i>
          </button>
          <button type="button" className="fd-k2 pag" onClick={() => navigate("/financeiro/a-pagar")}>
            <small>A pagar</small><b>{pag === undefined ? "…" : pag ? brl(pag.total) : "—"}</b>
            <i>{pag === null ? "falta o SQL do Passo 5" : pag ? `${pag.qtd} ${pag.qtd === 1 ? "conta" : "contas"}${pag.proxima ? ` · vence dia ${pag.proxima.slice(8, 10)}` : ""}` : ""}<CaretRight size={13} weight="bold" /></i>
          </button>
        </div>

        <div className="fd-a-prev"><PrevistosCard key={versao} /></div>

        <div className="fd-a-fluxo fd-card">
          <div className="fd-ct"><b>Fluxo de caixa · {MESES[mes.m].toLowerCase()}</b>
            <span className="fd-lg"><i className="e" />Entradas <i className="s" />Saídas <i className="l" />Resultado</span></div>
          {dados ? <Fluxo dados={dados} diaHoje={ehMesAtual ? hoje.getDate() : null} /> : <div className="fd-ph" />}
          {dados && dados.fonteRecebido === "pedidos" && <p className="fd-nota">Os recebimentos estão pelo mês da entrega: rode o SQL do Passo 1 pra usar a data real de cada pagamento.</p>}
        </div>

        <div className="fd-a-movs"><MovimentosCaixa cx={cx} limite={6} /></div>

        <div className="fd-a-mais fd-mais">
          <p className="fd-mais-t">Mais</p>
          <div className="fd-mais-g">
            <button type="button" onClick={() => navigate("/financeiro/transacoes")}><span><ArrowsLeftRight size={19} weight="duotone" /></span><b>Transações</b><small>Extrato de entradas e saídas</small></button>
            <button type="button" onClick={() => navigate("/custos")}><span><Calculator size={19} weight="duotone" /></span><b>Custos</b><small>Fixos, variáveis e mão de obra</small></button>
            <button type="button" onClick={() => navigate("/lucratividade")}><span><ChartPieSlice size={19} weight="duotone" /></span><b>Lucratividade</b><small>Lucro por produto</small></button>
          </div>
        </div>
      </div>

      {definir && uid && cx && <SaldoSheet atual={cx.configurado ? cx.saldo : null} uid={uid} onClose={() => setDefinir(false)} onSalvo={async () => { setDefinir(false); await depoisDeMudar(); }} />}
      {nova && <DespesaSheet tipo={nova} onClose={() => setNova(null)} onSalvo={async () => { setNova(null); await depoisDeMudar(); }}
        onContaAPagar={() => navigate("/financeiro/a-pagar")} onReceberPedido={() => navigate("/financeiro/a-receber")} />}
      <style>{CSS}</style>
    </>
  );
}

/** Barras de entradas e saídas por semana, com a linha do resultado acumulado.
 *  10/10: a largura do desenho acompanha o cartão (no PC o gráfico ocupa a largura toda) e,
 *  no mês atual, a linha do resultado para na semana de hoje (semanas futuras não têm ponto). */
function Fluxo({ dados, diaHoje }: { dados: MesFinanceiro; diaHoje: number | null }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(340);
  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => { const w = Math.round(e.contentRect.width); if (w > 0) setW(Math.max(280, w)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 150, base = 120, topo = 14;
  const sem = dados.semanas;
  const max = Math.max(1, ...sem.map(s => Math.max(s.entradas, s.saidas)), ...sem.map(s => Math.abs(s.acumulado)));
  const larg = W / sem.length, bw = Math.min(22, larg / 4);
  const y = (v: number) => base - (v / max) * (base - topo);
  // semana futura (começa depois de hoje) não tem resultado ainda
  const passou = (label: string) => diaHoje == null || (parseInt(label, 10) || 1) <= diaHoje;
  const linha = sem.map((s, i) => ({ s, i })).filter(({ s }) => passou(s.label));
  const pts = linha.map(({ s, i }) => `${i * larg + larg / 2},${y(Math.max(0, s.acumulado))}`).join(" ");
  const vazio = sem.every(s => !s.entradas && !s.saidas);
  return (
    <div className="fd-fluxo" ref={caixa}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Entradas e saídas por semana">
        <line x1="0" x2={W} y1={base} y2={base} stroke="#F0EBED" />
        {sem.map((s, i) => { const cx0 = i * larg + larg / 2; return (
          <g key={i}>
            <rect x={cx0 - bw - 1} y={y(s.entradas)} width={bw} height={Math.max(0, base - y(s.entradas))} rx="3" fill="#22C55E" />
            <rect x={cx0 + 1} y={y(s.saidas)} width={bw} height={Math.max(0, base - y(s.saidas))} rx="3" fill="#F87171" />
            <text x={cx0} y={H - 10} textAnchor="middle" fontSize="12" fill="#6B5D64">{s.label}</text>
          </g>); })}
        {!vazio && linha.length > 1 && <polyline points={pts} fill="none" stroke="#2C1219" strokeWidth="2" />}
        {!vazio && linha.map(({ s, i }) => <circle key={i} cx={i * larg + larg / 2} cy={y(Math.max(0, s.acumulado))} r="3" fill="#2C1219" />)}
      </svg>
      <div className="fd-fl-res">
        <span>Entrou <b className="e">{brl(dados.recebido)}</b></span>
        <span>Saiu <b className="s">{brl(dados.despesasPagas)}</b></span>
        <span>Resultado <b>{brl(dados.recebido - dados.despesasPagas)}</b></span>
      </div>
      {vazio && <p className="fd-nota">Nenhuma entrada ou saída neste mês ainda.</p>}
    </div>
  );
}

const CSS = `
  .fd { max-width: 1120px; margin: 0 auto; padding: 22px 0 96px; display: grid; gap: 14px; font-family: var(--font-base);
    grid-template-columns: minmax(0, 1fr); grid-template-areas: "saldo" "mes" "kpis" "contas" "prev" "fluxo" "movs" "mais"; }
  .fd > * { min-width: 0; }
  .fd-a-saldo { grid-area: saldo; display: flex; flex-direction: column; gap: 10px; } .fd-a-mes { grid-area: mes; } .fd-a-kpis { grid-area: kpis; }
  .fd-a-contas { grid-area: contas; } .fd-a-prev { grid-area: prev; } .fd-a-fluxo { grid-area: fluxo; } .fd-a-movs { grid-area: movs; } .fd-a-mais { grid-area: mais; }
  /* computador: mês e botões no cabeçalho (como no mockup) */
  .fd-so-desk { display: none !important; }
  @media (min-width: 768px) { .fd-a-mes, .fd-acoes { display: none !important; } }
  @media (min-width: 1024px) {
    /* grade do mockup: 4 colunas */
    .fd { grid-template-columns: minmax(0, 1.25fr) repeat(3, minmax(0, 1fr)); gap: 16px;
      grid-template-areas: "saldo kpis kpis kpis" "contas contas prev prev" "fluxo fluxo movs movs" "mais mais mais mais"; align-items: start; }
    .fd .fd-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .fd .fd-kpis .fd-k { display: flex; flex-direction: column; justify-content: center; }
    .fd .fd-k--vendido { display: none !important; }
    .fd .fd-so-cel { display: none !important; } .fd .fd-so-desk { display: flex !important; }
    .fd .fd-a-saldo .cxc { height: 100%; box-sizing: border-box; }
    .fd .fd-k2 { display: flex; flex-direction: column; justify-content: center; }
    /* 10/10: sem caixa informado (convite alto e sem "Últimas movimentações") a grade deixava buracos:
       o convite vira uma faixa compacta em largura total e o fluxo de caixa ocupa a linha inteira */
    .fd.fd--sem-caixa { grid-template-areas: "saldo saldo saldo saldo" "kpis kpis kpis kpis" "contas contas prev prev" "fluxo fluxo fluxo fluxo" "mais mais mais mais"; }
    .fd.fd--sem-caixa .fd-a-movs { display: none; }
    .fd.fd--sem-caixa .cxc-convite { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-rows: auto auto; column-gap: 16px; align-items: center; text-align: left; padding: 16px 20px; }
    .fd.fd--sem-caixa .cxc-convite-ic { grid-row: span 2; }
    .fd.fd--sem-caixa .cxc-convite b { margin-top: 0; grid-column: 2; }
    .fd.fd--sem-caixa .cxc-convite p { margin: 4px 0 0; max-width: none; grid-column: 2; text-wrap: pretty; }
    .fd.fd--sem-caixa .cxc-convite .cxc-cta { grid-column: 3; grid-row: 1; margin-top: 0; white-space: nowrap; }
    .fd.fd--sem-caixa .cxc-convite .cxc-depois { grid-column: 3; grid-row: 2; margin: 0 auto; }
  }
  .fd-hd { display: flex; align-items: center; gap: 8px; }
  .fd-hd-mes { display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,.18); border-radius: 10px; padding: 4px; }
  .fd-hd-mes b { font-size: 14px; font-weight: 700; color: var(--ui-branco); padding: 0 6px; white-space: nowrap; }
  .fd-hd-mes button { position: relative; width: 36px; height: 36px; border: none; border-radius: 8px; background: rgba(255,255,255,.18); color: var(--ui-branco); display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .fd-hd-mes button::after { content: ""; position: absolute; inset: -4px; }
  .fd-hd-mes button:disabled { opacity: .35; cursor: default; }
  .fd-hd-bt { display: flex; align-items: center; gap: 6px; min-height: 44px; border: none; border-radius: var(--ui-raio-botao); padding: 0 14px; font-family: var(--font-base); font-size: 14px; font-weight: 700; color: var(--ui-branco); cursor: pointer; white-space: nowrap; }
  .fd-hd-bt.e { background: #16A34A; } .fd-hd-bt.s { background: var(--ui-vinho-escuro); }
  /* foco no convite do saldo: o resto fica levemente apagado (sem bloquear) */
  .fd > * { transition: opacity .3s ease, filter .3s ease; }
  .fd-acoes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .fd-bt { display: flex; align-items: center; justify-content: center; gap: 6px; border: none; border-radius: 12px; padding: 12px; font-family: inherit; font-size: 14px; font-weight: 700; color: var(--ui-branco); cursor: pointer; }
  .fd-bt.e { background: #16A34A; } .fd-bt.s { background: var(--ui-vinho-escuro); }
  .fd-mes { display: flex; justify-content: space-between; align-items: center; background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 12px; padding: 6px; }
  .fd-mes b { font-size: 14.5px; font-weight: 700; color: var(--ui-texto); }
  .fd-mes button { width: 44px; height: 44px; border-radius: 10px; border: none; background: #FFF1F6; color: var(--ui-rosa-escuro); display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .fd-mes button:disabled { opacity: .35; cursor: default; }
  .fd-kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .fd-k, .fd-k2 { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 14px; padding: 12px; min-width: 0; text-align: left; font-family: inherit; color: var(--ui-texto); }
  .fd-k { position: relative; }
  .fd-ki { position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
  .fd-ki.e { background: var(--ui-verde-fundo); color: var(--ui-verde); } .fd-ki.s { background: var(--ui-vermelho-fundo); color: var(--ui-vermelho); } .fd-ki.n { background: var(--ui-cinza); color: var(--ui-texto-2); } .fd-ki.l { background: #FCE7F3; color: var(--ui-rosa-escuro); }
  .fd-k small { padding-right: 30px; }
  .fd-k small, .fd-k2 small { display: block; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
  .fd-k b, .fd-k2 b { display: block; font-size: clamp(14px, 4.2vw, 20px); font-weight: 700; letter-spacing: -.02em; margin: 3px 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ui-texto); }
  .fd-k i, .fd-k2 i { display: flex; align-items: center; gap: 3px; font-style: normal; font-size: 13px; color: #888780; line-height: 1.35; }
  .fd-k b.e { color: var(--ui-verde); } .fd-k b.s { color: var(--ui-vermelho); } .fd-k b.l { color: var(--ui-rosa-escuro); }
  .fd-contas { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .fd-k2 { cursor: pointer; } .fd-k2.rec { border-left: 4px solid #F59E0B; } .fd-k2.pag { border-left: 4px solid #EF4444; }
  .fd-card { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 16px; padding: 14px; }
  .fd-ct { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
  .fd-ct b { font-size: 14.5px; font-weight: 700; color: var(--ui-texto); }
  .fd-lg { display: flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
  .fd-lg i { display: inline-block; width: 8px; height: 8px; border-radius: 3px; } .fd-lg i.e { background: #22C55E; } .fd-lg i.s { background: #F87171; } .fd-lg i.l { background: var(--ui-vinho-escuro); border-radius: 50%; }
  .fd-ph { height: 150px; background: #FAF7F8; border-radius: 10px; }
  .fd-fl-res { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-top: 4px; font-size: 12.5px; color: var(--ui-texto-2); }
  .fd-fl-res b { font-weight: 700; color: var(--ui-texto); } .fd-fl-res b.e { color: var(--ui-verde); } .fd-fl-res b.s { color: var(--ui-vermelho); }
  .fd-nota { margin: 8px 0 0; font-size: 12px; color: var(--ui-texto-3); line-height: 1.4; }
  .fd-mais-t { margin: 4px 0 8px; font-size: 13px; font-weight: 700; color: var(--ui-texto-3); }
  .fd-mais-g { display: grid; grid-template-columns: 1fr; gap: 8px; }
  @media (min-width: 640px) { .fd-mais-g { grid-template-columns: repeat(3, 1fr); } }
  .fd-mais-g button { display: grid; grid-template-columns: 38px 1fr; column-gap: 10px; align-items: center; text-align: left; background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 14px; padding: 12px; font-family: inherit; color: var(--ui-texto); cursor: pointer; }
  .fd-mais-g span { grid-row: span 2; width: 38px; height: 38px; border-radius: 11px; background: #FFF1F6; color: var(--ui-rosa-escuro); display: flex; align-items: center; justify-content: center; }
  .fd-mais-g b { font-size: 14px; font-weight: 700; } .fd-mais-g small { font-size: 13px; color: var(--ui-texto-2); }
`;

// Financeiro — painel (Passo 7, 03/10; 4.29: por período, com comparação, formas de pagamento e mais vendidos). Junta o que antes ficava na Visão Geral e no menu:
// saldo em caixa, os números do mês, a receber, a pagar, previstos, fluxo e últimas movimentações.
import EstiloFinanceiro from "@/components/financeiro/EstiloFinanceiro";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp, ArrowDown, CaretRight, ArrowsLeftRight, Calculator, CalendarBlank, ChartPieSlice, CurrencyCircleDollar, Plus, Receipt } from "@phosphor-icons/react";
import CampoData from "@/components/CampoData";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, avisar } from "@/components/base";
import { useCaixa, SaldoSheet, CaixaEstilos } from "@/components/financeiro/CaixaCard";
import ReceberPedidoSheet from "@/components/financeiro/ReceberPedidoSheet";
import { PagarSheet, type Conta } from "@/pages/FinanceiroAPagar";
import { supabase } from "@/lib/supabase";
import { nomeCategoriaFin } from "@/lib/categoriasFinanceiro";
import { carregarExtrato, type MovExtrato } from "@/lib/extrato";
import DespesaSheet from "@/components/financeiro/DespesaSheet";
import { resumoAPagar, type ResumoAPagar } from "@/lib/painelFinanceiro";
import { carregarPeriodo, totaisDoPeriodo, diasEntre, isoDe, type DiaFluxo, type Periodo as PeriodoDados } from "@/lib/painelPeriodo";
import { useAoVoltar, useDiaAtual } from "@/hooks/useAoVoltar";
import { carregarAReceber, isoDia, type ItemReceber } from "@/lib/contasReceber";

const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// 10/10: dinheiro sempre com centavos (antes os cards do mês mostravam "R$ 801" ao lado de "R$ 1.835,40")
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

type TipoPer = "hoje" | "7" | "30" | "mes" | "pers";
type Per = { ini: string; ate: string; antIni: string; antAte: string; rotuloAnt: string; texto: string };
const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const deIso = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const somar = (s: string, n: number) => { const d = deIso(s); d.setDate(d.getDate() + n); return isoDe(d); };
const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const extenso = (ini: string, ate: string) => {
  const a = deIso(ini), b = deIso(ate);
  if (ini === ate) return `${a.getDate()} de ${MESES[a.getMonth()].toLowerCase()}`;
  return a.getMonth() === b.getMonth() ? `${a.getDate()} a ${b.getDate()} de ${MESES[b.getMonth()].toLowerCase()}` : `${a.getDate()} de ${MES_CURTO[a.getMonth()]} a ${b.getDate()} de ${MES_CURTO[b.getMonth()]}`;
};
/** (4.29) O período escolhido e o período anterior do mesmo tamanho, pra comparar */
function montarPeriodo(tipo: TipoPer, pIni: string, pAte: string): Per {
  const hoje = isoDe(new Date());
  let ini = hoje, ate = hoje, antIni = somar(hoje, -1), antAte = somar(hoje, -1), rotuloAnt = "que ontem";
  if (tipo === "7" || tipo === "30") {
    const n = Number(tipo);
    ini = somar(hoje, -(n - 1)); antAte = somar(ini, -1); antIni = somar(antAte, -(n - 1)); rotuloAnt = `que nos ${n} dias anteriores`;
  } else if (tipo === "mes") {
    const h = new Date(); ini = isoDe(new Date(h.getFullYear(), h.getMonth(), 1));
    const ultAnt = new Date(h.getFullYear(), h.getMonth(), 0).getDate();
    antIni = isoDe(new Date(h.getFullYear(), h.getMonth() - 1, 1)); antAte = isoDe(new Date(h.getFullYear(), h.getMonth() - 1, Math.min(h.getDate(), ultAnt)));
    rotuloAnt = "que no mesmo período do mês passado";
  } else if (tipo === "pers") {
    ini = pIni <= pAte ? pIni : pAte; ate = pIni <= pAte ? pAte : pIni;
    const n = diasEntre(ini, ate).length;
    antAte = somar(ini, -1); antIni = somar(antAte, -(n - 1)); rotuloAnt = "que no período anterior";
  }
  return { ini, ate, antIni, antAte, rotuloAnt, texto: `${extenso(ini, ate)} · comparado com ${antIni === antAte ? dm(antIni) : `${dm(antIni)} a ${dm(antAte)}`}` };
}

/** "+18% que nos 7 dias anteriores" (verde quando é bom, vermelho quando é ruim) */
function Variacao({ atual, anterior, rotulo, bomSubir = true }: { atual: number; anterior: number | null; rotulo: string; bomSubir?: boolean }) {
  // (4.29) texto completo no computador; no celular uma versão curta que cabe numa linha e se entende sozinha
  const dois = (pc: string, cel: string) => <><span className="fd-so-pc">{pc}</span><span className="fd-so-cel">{cel}</span></>;
  const antes = rotulo.replace(/^que /, "");
  if (anterior == null) return <span className="fd-var neu">&nbsp;</span>;
  if (!anterior && !atual) return <span className="fd-var neu">{dois(`Sem movimento ${antes}`, "Sem movimento")}</span>;
  if (!anterior) return <span className="fd-var neu">{dois(`Nada ${antes}`, "Antes: R$ 0,00")}</span>;
  const pct = Math.round(((atual - anterior) / Math.abs(anterior)) * 100);
  if (pct === 0) return <span className="fd-var neu">{dois(`Igual ${rotulo.replace(/^que nos /, "aos ").replace(/^que no /, "ao ").replace(/^que /, "a ")}`, "Igual ao anterior")}</span>;
  const bom = pct > 0 === bomSubir;
  const n = `${pct > 0 ? "+" : ""}${pct}%`;
  return <span className={`fd-var ${bom ? "up" : "dn"}`}>{dois(`${n} ${rotulo}`, `${n} que antes`)}</span>;
}

export default function Financeiro() {
  const navigate = useNavigate();
  const { uid, cx, recarregar } = useCaixa();
  const [definir, setDefinir] = useState(false);
  const [nova, setNova] = useState<"entrada" | "saida" | "apagar" | null>(null);
  // (4.29) receber e pagar direto do painel
  const [receber, setReceber] = useState<{ item: ItemReceber | null } | null>(null);
  const [pagar, setPagar] = useState<Conta | null>(null);
  const [recItens, setRecItens] = useState<ItemReceber[] | null>(null);
  const [contas, setContas] = useState<Conta[] | null>(null);
  const [movs, setMovs] = useState<MovExtrato[] | null>(null);
  // (4.29) período: Hoje · 7 dias · 30 dias · Este mês · Personalizado (lembra a última escolha neste aparelho)
  const [tipo, setTipo] = useState<TipoPer>(() => { try { const t = localStorage.getItem("doonly_fin_periodo"); return (["hoje", "7", "30", "mes"].includes(t || "") ? t : "mes") as TipoPer; } catch { return "mes"; } });
  const [pIni, setPIni] = useState(() => somar(isoDe(new Date()), -14));
  const [pAte, setPAte] = useState(() => isoDe(new Date()));
  const [dados, setDados] = useState<PeriodoDados | null>(null);
  const [ant, setAnt] = useState<{ recebido: number; despesas: number } | null>(null);
  const [rec, setRec] = useState<{ total: number; qtd: number; semana: number; erro?: boolean } | null>(null);
  const [pag, setPag] = useState<ResumoAPagar | null | undefined>(undefined);
  const [versao, setVersao] = useState(0); // recarrega tudo depois de uma mudança

  const dia = useDiaAtual();
  const per = montarPeriodo(tipo, pIni, pAte);
  const chavePer = `${per.ini}|${per.ate}`;
  const escolher = (t: TipoPer) => { setTipo(t); if (t !== "pers") { try { localStorage.setItem("doonly_fin_periodo", t); } catch { /* sem acesso */ } } };

  const perDosDados = useRef("");
  // só vale a resposta da última busca (trocar de período rápido não mistura os números)
  useEffect(() => {
    if (!uid) return;
    let cancelado = false;
    if (perDosDados.current !== chavePer) { setDados(null); setAnt(null); }
    carregarPeriodo(uid, per.ini, per.ate).then(d => { if (!cancelado) { perDosDados.current = chavePer; setDados(d); } });
    totaisDoPeriodo(uid, per.antIni, per.antAte).then(t => { if (!cancelado) setAnt(t.erro ? null : t); });
    carregarExtrato(uid, per.ini, per.ate).then(r => { if (!cancelado) setMovs(r.erro ? [] : r.itens.filter(i => !i.estornado).slice(0, 4)); }, () => { if (!cancelado) setMovs([]); });
    return () => { cancelado = true; };
  }, [uid, chavePer, versao, dia]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!uid) return;
    let cancelado = false;
    const dia0 = isoDia(0), em7 = isoDia(6);
    carregarAReceber(uid).then(({ itens: l, erro }) => {
      if (cancelado) return;
      // 10/10: "nesta semana" é de hoje até o 7º dia, igual à tela A receber (antes contava também os atrasados)
      setRec({ total: l.reduce((s, x) => s + x.falta, 0), qtd: l.length, semana: l.filter(x => x.dataRef && x.dataRef >= dia0 && x.dataRef <= em7).length, erro });
      setRecItens(erro ? null : l);
    }, () => { if (!cancelado) setRec({ total: 0, qtd: 0, semana: 0, erro: true }); });
    resumoAPagar(uid, dia0).then(r => { if (!cancelado) setPag(r); }, () => { if (!cancelado) setPag({ total: 0, qtd: 0, vencidas: 0, proxima: null, erro: true }); });
    // as 3 próximas contas (lista do computador)
    supabase.from("contas_pagar").select("id, descricao, categoria, valor, vencimento, status, pago_em, valor_pago, custo_fixo_id")
      .eq("user_id", uid).eq("status", "pendente").order("vencimento", { ascending: true }).order("id").range(0, 2)
      .then(({ data, error }) => { if (!cancelado) setContas(error ? null : (data as Conta[]) || []); });
    return () => { cancelado = true; };
  }, [uid, versao, dia]);

  const depoisDeMudar = async () => { await recarregar(); setVersao(v => v + 1); };
  // voltou pro app: busca tudo de novo
  useAoVoltar(() => { depoisDeMudar(); });
  // se alguma busca falhou, a tela avisa e mostra "—" no lugar do número
  const ok = dados && !dados.erro ? dados : null;
  const esp = dados?.erro ? "—" : "…";
  const algumErro = !!(dados?.erro || rec?.erro || pag?.erro || cx?.erro);
  const totalFormas = ok ? ok.formas.reduce((s, f) => s + f.valor, 0) : 0;
  const formas = ok ? ok.formas.filter(f => f.valor > 0) : []; // (4.29) só as formas que tiveram dinheiro
  const qtdReceber = rec && !rec.erro ? rec.qtd : 0;
  const aposLancar = async (aviso: string, continuar?: boolean) => { if (!continuar) setNova(null); avisar(aviso, { tipo: "ok" }); await depoisDeMudar(); };
  const abrirReceber = (item: ItemReceber | null = null) => setReceber({ item });

  const tituloPer = tipo === "hoje" ? "Hoje" : tipo === "7" ? "Últimos 7 dias" : tipo === "30" ? "Últimos 30 dias"
    : tipo === "mes" ? `${MESES[new Date().getMonth()]} até hoje` : extenso(per.ini, per.ate);
  const maxRes = ok ? Math.max(ok.recebido, ok.despesas, 0.01) : 1;
  const pct = (v: number) => `${Math.max(v > 0 ? 3 : 0, Math.round((v / maxRes) * 100))}%`;
  const caixaOk = !!cx && !cx.erro && !cx.precisaSql && cx.configurado;

  return (
    <>
      <AppPageHeader
        title="Financeiro"
        subtitle="Seu dinheiro, sem mistério"
        infoIcon="💰"
        rightActions={
          <div className="fd-hd">
            <button type="button" className="fd-hd-bt r" onClick={() => abrirReceber()}><CurrencyCircleDollar size={17} weight="bold" />Receber pedido{qtdReceber > 0 && <em>{qtdReceber}</em>}</button>
            <button type="button" className="fd-hd-bt e" onClick={() => setNova("entrada")}><ArrowUp size={15} weight="bold" />Entrada</button>
            <button type="button" className="fd-hd-bt s" onClick={() => setNova("saida")}><ArrowDown size={15} weight="bold" />Saída</button>
          </div>
        }
        infoContent={<>
          <p><strong>Saldo em caixa</strong>: o dinheiro que você tem agora (o saldo que você informou + o que recebeu − o que pagou).</p>
          <p><strong>Recebido</strong> é o dinheiro que entrou no período. <strong>Despesas</strong> é o que você pagou. <strong>Resultado</strong> é o recebido menos as despesas. Aporte e retirada ficam de fora (são dinheiro seu, não do negócio).</p>
          <p>Pedido criado ou entregue <strong>não entra no caixa sozinho</strong>: só quando você registra o recebimento.</p>
        </>}
      />
      <EstiloFinanceiro />
      <CaixaEstilos />

      {/* (4.29 · jeito de app de banco) saldo grande no rosa + atalhos redondos */}
      <div className="fd-hero">
        <div className="fd-hero-in">
          <div className="fd-hero-saldo">
            <small>Saldo em caixa</small>
            {!cx ? <b className="fd-hero-v">…</b>
              : cx.erro ? <><b className="fd-hero-v">—</b><span className="fd-hero-hoje">Não deu pra carregar · <button type="button" onClick={depoisDeMudar}>Tentar de novo</button></span></>
              : cx.precisaSql ? <span className="fd-hero-hoje">Falta um ajuste no banco pra ativar o caixa</span>
              : !cx.configurado ? <>
                  <b className="fd-hero-v fd-hero-v--p">Quanto você tem hoje?</b>
                  <button type="button" className="fd-hero-cta" onClick={() => setDefinir(true)}>Informar meu saldo</button>
                </>
              : <>
                  <b className="fd-hero-v">{brl(cx.saldo)}</b>
                  <span className="fd-hero-hoje">Hoje + {brl(cx.entrouHoje)} · − {brl(cx.saiuHoje)} · <button type="button" onClick={() => setDefinir(true)}>Acertar</button></span>
                </>}
          </div>
          <div className="fd-hero-dir">
            <div className="fd-hero-per fd-per-chips" role="tablist" aria-label="Período">
              {([["hoje", "Hoje"], ["7", "7 dias"], ["30", "30 dias"], ["mes", "Este mês"], ["pers", "Outro"]] as [TipoPer, string][]).map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={tipo === k} className={tipo === k ? "on" : ""} onClick={() => escolher(k)}>{l}</button>
              ))}
            </div>
            {tipo === "pers" && <div className="fd-hero-datas"><div className="fd-per-datas">
            <div><span>De</span><CampoData valor={pIni} max={pAte} titulo="Início do período" curto onChange={d => setPIni(d)} /></div>
            <div><span>Até</span><CampoData valor={pAte} min={pIni} max={isoDe(new Date())} titulo="Fim do período" curto onChange={d => setPAte(d)} /></div>
          </div></div>}
          </div>
        </div>
        <div className="fd-hero-acoes">
          <button type="button" onClick={() => setNova("entrada")}><i><ArrowUp size={20} weight="bold" /></i>Entrou</button>
          <button type="button" onClick={() => setNova("saida")}><i><ArrowDown size={20} weight="bold" /></i>Saiu</button>
          <button type="button" onClick={() => abrirReceber()}><i><CurrencyCircleDollar size={22} weight="bold" />{qtdReceber > 0 && <em>{qtdReceber}</em>}</i>Receber</button>
          <button type="button" onClick={() => navigate("/financeiro/a-pagar")}><i><Receipt size={20} weight="bold" />{pag && !pag.erro && pag.vencidas > 0 && <em className="v">{pag.vencidas}</em>}</i>A pagar</button>
        </div>
      </div>

      {algumErro && (
        <div className="fd-erro" role="alert">
          <span>Não deu pra carregar tudo. Confira a internet e tente de novo.</span>
          <Botao variante="secundario" tamanho="m" onClick={depoisDeMudar}>Tentar de novo</Botao>
        </div>
      )}
      <div className="fd">
        <div className="fd-a-per fd-per">
          <div className="fd-per-chips" role="tablist" aria-label="Período">
            {([["hoje", "Hoje"], ["7", "7 dias"], ["30", "30 dias"], ["mes", "Mês"], ["pers", "Outro"]] as [TipoPer, string][]).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tipo === k} className={tipo === k ? "on" : ""} onClick={() => escolher(k)}>{l}</button>
            ))}
          </div>
          {tipo === "pers" && <div className="fd-per-datas">
            <div><span>De</span><CampoData valor={pIni} max={pAte} titulo="Início do período" curto onChange={d => setPIni(d)} /></div>
            <div><span>Até</span><CampoData valor={pAte} min={pIni} max={isoDe(new Date())} titulo="Fim do período" curto onChange={d => setPAte(d)} /></div>
          </div>}
        </div>

        {/* um cartão só com os números do período */}
        <div className="fd-a-res fd-card fd-res">
          <div className="fd-ct"><span><b>{tituloPer}</b></span>
            <button type="button" className="fd-ct-lk" onClick={() => navigate("/financeiro/transacoes")}>Extrato<CaretRight size={13} weight="bold" /></button></div>
          <div className="fd-res-l"><span>Recebido</span><b className="e">{ok ? brl(ok.recebido) : esp}</b><span className="fd-res-b"><i className="e" style={{ width: ok ? pct(ok.recebido) : 0 }} /></span></div>
          <div className="fd-res-l"><span>Despesas</span><b className="s">{ok ? brl(ok.despesas) : esp}</b><span className="fd-res-b"><i className="s" style={{ width: ok ? pct(ok.despesas) : 0 }} /></span></div>
          <div className="fd-res-t"><span>Resultado</span><b className={ok && ok.resultado < 0 ? "s" : ""}>{ok ? brl(ok.resultado) : esp}</b></div>
          {ok && <p className="fd-res-c"><Variacao atual={ok.resultado} anterior={ant ? r2(ant.recebido - ant.despesas) : null} rotulo={per.rotuloAnt} /></p>}
        </div>

        {/* celular: a receber e a pagar em 2 cartões */}
        <div className="fd-a-contas fd-contas">
          <button type="button" className="fd-k2" onClick={() => navigate("/financeiro/a-receber")}>
            <span><small>A receber</small><b>{!rec ? "…" : rec.erro ? "—" : brl(rec.total)}</b></span><CaretRight size={16} weight="bold" />
          </button>
          <button type="button" className="fd-k2" onClick={() => navigate("/financeiro/a-pagar")}>
            <span><small>A pagar</small><b className={pag && !pag.erro && pag.total > 0 ? "s" : ""}>{pag === undefined ? "…" : pag && !pag.erro ? brl(pag.total) : "—"}</b></span><CaretRight size={16} weight="bold" />
          </button>
        </div>

        <div className="fd-a-fluxo fd-card">
          <div className="fd-ct"><span><b>Entradas e saídas por dia</b><small className="fd-ct-sub">{extenso(per.ini, per.ate)}</small></span>
            <span className="fd-lg"><i className="e" />Entradas <i className="s" />Saídas</span></div>
          {ok ? <BarrasPorDia dias={ok.dias} /> : <div className="fd-ph" />}
        </div>

        {/* computador: listas com o botão em cada linha */}
        <div className="fd-a-listas fd-listas">
          <div className="fd-card fd-lst">
            <div className="fd-ct"><span><b>Pra receber</b><small className="fd-ct-sub">{!rec ? "…" : rec.erro ? "Não deu pra carregar" : rec.qtd ? `${brl(rec.total)} em ${rec.qtd} ${rec.qtd === 1 ? "pedido" : "pedidos"}` : "Tudo recebido"}</small></span>
              <button type="button" className="fd-ct-lk" onClick={() => navigate("/financeiro/a-receber")}>Ver todos<CaretRight size={13} weight="bold" /></button></div>
            {recItens && recItens.length === 0 && <p className="fd-vazio">Nenhum pedido com valor a receber.</p>}
            {(recItens || []).slice(0, 3).map(it => (
              <div key={it.id} className="fd-lst-it">
                <span className="fd-lst-tx"><b>{it.cliente_nome || "Cliente sem nome"}{it.dataRef && <em className={it.dias !== null && it.dias < 0 ? "atr" : ""}>{dataTag(it.dataRef, it.dias)}</em>}</b>
                  <small>{[it.numero != null ? `#${it.numero}` : "", it.recebido > 0 ? "sinal pago" : "falta tudo"].filter(Boolean).join(" · ")}</small></span>
                <span className="fd-lst-v">{brl(it.falta)}{it.recebido > 0 && <small>de {brl(it.total)}</small>}</span>
                <button type="button" className="fd-lst-bt v" onClick={() => abrirReceber(it)}>Receber</button>
              </div>
            ))}
          </div>
          <div className="fd-card fd-lst">
            <div className="fd-ct"><span><b>Pra pagar</b><small className="fd-ct-sub">{pag === undefined ? "…" : pag === null ? "Falta o SQL das contas a pagar" : pag.erro ? "Não deu pra carregar" : pag.qtd ? `${brl(pag.total)} em ${pag.qtd} ${pag.qtd === 1 ? "conta" : "contas"}` : "Nenhuma conta pendente"}</small></span>
              <button type="button" className="fd-ct-lk" onClick={() => navigate("/financeiro/a-pagar")}>Ver todas<CaretRight size={13} weight="bold" /></button></div>
            {(contas || []).map(c => {
              const venceu = c.vencimento < isoDia(0);
              return (
                <div key={c.id} className="fd-lst-it">
                  <span className="fd-lst-tx"><b>{c.descricao}<em className={venceu ? "atr" : ""}>{venceu ? "venceu" : "vence"} {dm(c.vencimento)}</em></b><small>{nomeCategoriaFin(c.categoria) || "Conta"}</small></span>
                  <span className={`fd-lst-v${venceu ? " s" : ""}`}>{brl(c.valor)}</span>
                  <button type="button" className="fd-lst-bt p" onClick={() => setPagar(c)}>Pagar</button>
                </div>
              );
            })}
            {pag !== null && <button type="button" className="fd-lst-nova" onClick={() => setNova("apagar")}><Plus size={15} weight="bold" />Nova conta a pagar</button>}
          </div>
        </div>

        {/* últimas movimentações, do jeito de um extrato */}
        <div className="fd-a-movs fd-card">
          <div className="fd-ct"><span><b>Últimas movimentações</b></span>
            <button type="button" className="fd-ct-lk" onClick={() => navigate("/financeiro/transacoes")}>Ver tudo<CaretRight size={13} weight="bold" /></button></div>
          {movs === null ? <div className="fd-ph fd-ph--p" /> : movs.length === 0 ? <p className="fd-vazio">Nada entrou nem saiu neste período.</p> : (
            <ul className="fd-mov">
              {movs.map((m, i) => (
                <li key={`${m.id}-${i}`}>
                  <span className={`fd-mov-ic ${m.tipo === "entrada" ? "e" : "s"}`}>{m.tipo === "entrada" ? <ArrowUp size={15} weight="bold" /> : <ArrowDown size={15} weight="bold" />}</span>
                  <span className="fd-mov-tx"><b>{m.titulo}</b><small>{[rotuloDiaCurto(m.data), m.subtipo, m.detalhe].filter(Boolean).join(" · ")}</small></span>
                  <span className={`fd-mov-v ${m.tipo === "entrada" ? "e" : "s"}`}>{m.tipo === "entrada" ? "+" : "−"} {brl(m.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="fd-a-formas fd-card">
          <div className="fd-ct"><span><b>Formas de pagamento</b><small className="fd-ct-sub">O que entrou no período</small></span></div>
          {!ok ? <div className="fd-ph fd-ph--p" /> : totalFormas <= 0 ? <p className="fd-vazio">Nenhum recebimento no período.</p> : (<>
            <ul className="fd-fp">
              {formas.map(f => (
                <li key={f.chave}><span className="fd-fp-n">{f.nome}</span><span className="fd-fp-b"><i style={{ width: `${Math.round((f.valor / totalFormas) * 100)}%` }} /></span>
                  <span className="fd-fp-v">{brl(f.valor)}</span><span className="fd-fp-p">{Math.round((f.valor / totalFormas) * 100)}%</span></li>
              ))}
            </ul>
            <p className="fd-fp-t"><span>Total</span><b>{brl(totalFormas)}</b></p>
          </>)}
        </div>

        <div className="fd-a-vend fd-card">
          <div className="fd-ct"><span><b>Mais vendidos</b><small className="fd-ct-sub">Pedidos com entrega no período, pelo valor</small></span></div>
          {!ok ? <div className="fd-ph fd-ph--p" /> : ok.maisVendidos.length === 0 ? <p className="fd-vazio">Nenhum pedido com entrega no período.</p> : (
            <ol className="fd-mv">
              {ok.maisVendidos.map((v, i) => (
                <li key={v.nome}><span className="fd-mv-n">{i + 1}</span><span className="fd-mv-nm">{v.nome}</span>
                  <span className="fd-mv-q">{v.pedidos} {v.pedidos === 1 ? "pedido" : "pedidos"}</span><b>{brl(v.valor)}</b></li>
              ))}
            </ol>
          )}
        </div>

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
      {nova && <DespesaSheet tipo={nova === "entrada" ? "entrada" : "saida"} inicialAPagar={nova === "apagar"} inicioCaixa={caixaOk && cx?.inicio ? isoDe(new Date(cx.inicio)) : null}
        onClose={() => setNova(null)} onSalvo={aposLancar} onReceberPedido={() => { setNova(null); abrirReceber(); }} />}
      {receber && <ReceberPedidoSheet itens={recItens} inicial={receber.item} onClose={() => setReceber(null)}
        onFeito={async msg => { setReceber(null); avisar(msg, { tipo: "ok" }); await depoisDeMudar(); }} />}
      {pagar && <PagarSheet conta={pagar} onClose={() => setPagar(null)} onFeito={async () => { setPagar(null); avisar("Conta paga.", { tipo: "ok" }); await depoisDeMudar(); }} />}
      <style>{CSS}</style>
    </>
  );
}

/** "Hoje" · "Ontem" · "08/10" */
function rotuloDiaCurto(iso: string) {
  if (iso === isoDia(0)) return "Hoje";
  if (iso === isoDia(-1)) return "Ontem";
  return dm(iso);
}

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
/** "hoje" · "amanhã" · "atrasado" · "qui, 23/10" */
function dataTag(iso: string, dias: number | null) {
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias !== null && dias < 0) return "atrasado";
  return `${SEMANA[deIso(iso).getDay()]}, ${dm(iso)}`;
}
/** (4.29) Barras de entradas e saídas por dia. Mais de 45 dias: junta de 7 em 7 dias. */
function BarrasPorDia({ dias }: { dias: DiaFluxo[] }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(340);
  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => { const w = Math.round(e.contentRect.width); if (w > 0) setW(Math.max(260, w)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const porSemana = dias.length > 45;
  const grupos: { label: string; entradas: number; saidas: number }[] = [];
  if (porSemana) {
    for (let i = 0; i < dias.length; i += 7) {
      const g = dias.slice(i, i + 7);
      grupos.push({ label: dm(g[0].data), entradas: g.reduce((s, d) => s + d.entradas, 0), saidas: g.reduce((s, d) => s + d.saidas, 0) });
    }
  } else for (const d of dias) {
    const dt = deIso(d.data);
    grupos.push({ label: dias.length <= 7 ? `${SEMANA[dt.getDay()]} ${String(dt.getDate()).padStart(2, "0")}` : String(dt.getDate()), entradas: d.entradas, saidas: d.saidas });
  }
  const H = 170, base = 138, topo = 10, esq = 4;
  const max = Math.max(1, ...grupos.map(g => Math.max(g.entradas, g.saidas)));
  const larg = (W - esq) / Math.max(1, grupos.length);
  const bw = Math.max(3, Math.min(26, larg * 0.42));
  const sw = Math.max(2, Math.min(14, larg * 0.22));
  const y = (v: number) => base - (v / max) * (base - topo);
  // muitos dias: mostra o rótulo de alguns (pra não encavalar)
  const passo = Math.max(1, Math.ceil(grupos.length / Math.max(1, Math.floor(W / 46))));
  const vazio = grupos.every(g => !g.entradas && !g.saidas);
  const total = grupos.reduce((s, g) => ({ e: s.e + g.entradas, s: s.s + g.saidas }), { e: 0, s: 0 });
  return (
    <div className="fd-fluxo" ref={caixa}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`Entradas e saídas ${porSemana ? "por semana" : "por dia"}`}>
        {[0.33, 0.66, 1].map(f => <line key={f} x1="0" x2={W} y1={base - f * (base - topo)} y2={base - f * (base - topo)} stroke="#F6F1F3" />)}
        <line x1="0" x2={W} y1={base} y2={base} stroke="#EDE6E9" />
        {grupos.map((g, i) => {
          const cx0 = esq + i * larg + larg / 2;
          return (
            <g key={i}>
              {g.entradas > 0 && <rect x={cx0 - bw / 2 - (g.saidas > 0 ? sw / 2 : 0)} y={y(g.entradas)} width={bw} height={Math.max(2, base - y(g.entradas))} rx={Math.min(5, bw / 3)} fill="#22C55E"><title>{`${g.label}: entrou ${brl(g.entradas)}`}</title></rect>}
              {g.saidas > 0 && <rect x={cx0 + bw / 2 - sw / 2 + (g.entradas > 0 ? 2 : -bw / 2)} y={y(g.saidas)} width={sw} height={Math.max(2, base - y(g.saidas))} rx={Math.min(3, sw / 3)} fill="#F87171"><title>{`${g.label}: saiu ${brl(g.saidas)}`}</title></rect>}
              {i % passo === 0 && <text x={cx0} y={H - 12} textAnchor="middle" fontSize="11.5" fill="#6B5D64">{g.label}</text>}
            </g>
          );
        })}
      </svg>
      <div className="fd-fl-res">
        <span>Entrou <b className="e">{brl(total.e)}</b></span>
        <span>Saiu <b className="s">{brl(total.s)}</b></span>
        <span>Resultado <b>{brl(total.e - total.s)}</b></span>
      </div>
      {vazio && <p className="fd-nota">Nenhuma entrada ou saída neste período.</p>}
    </div>
  );
}

const CSS = `
  .fd { max-width: 1160px; margin: 0 auto; padding: 22px 0 96px; display: grid; gap: 14px; font-family: var(--font-base);
    grid-template-columns: minmax(0, 1fr); grid-template-areas: "saldo" "acoes" "per" "kpis" "contas" "listas" "fluxo" "formas" "vend" "ult" "mais"; position: relative; margin-top: -58px; }
  .fd-faixa { height: 58px; background: var(--ui-rosa); width: 100vw; margin: 0 calc(50% - 50vw); }
  .fd-faixa + .fd-erro { position: relative; margin-top: -40px; }
  .fd-faixa + .fd-erro + .fd { margin-top: 0; }
  .fd-a-acoes { grid-area: acoes; }
  .fd > * { min-width: 0; }
  .fd-erro { max-width: 1160px; margin: 22px auto 0; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 10px 12px; flex-wrap: wrap; background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; border-radius: var(--ui-raio); padding: 10px 12px; font-family: var(--font-base); font-size: 13.5px; font-weight: 600; line-height: 1.45; }
  .fd-erro + .fd { padding-top: 14px; }
  .fd-a-per { grid-area: per; } .fd-a-saldo { grid-area: saldo; } .fd-a-kpis { grid-area: kpis; }
  .fd-a-fluxo { grid-area: fluxo; } .fd-a-formas { grid-area: formas; } .fd-a-contas { grid-area: contas; } .fd-a-listas { grid-area: listas; }
  .fd-a-vend { grid-area: vend; } .fd-a-ult { grid-area: ult; } .fd-a-mais { grid-area: mais; }
  @media (min-width: 768px) { .fd-acoes { display: none !important; } .fd-a-contas { display: none !important; } }
  @media (max-width: 767px) { .fd-a-listas { display: none !important; } }
  @media (min-width: 901px) { .fd-faixa { width: auto; margin: 0 -2rem; } }
  @media (min-width: 1024px) {
    .fd { grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 16px; align-items: stretch;
      grid-template-areas: "saldo saldo saldo kpis kpis kpis kpis kpis kpis kpis kpis kpis" "per per per per per per per per per per per per" "listas listas listas listas listas listas listas listas listas listas listas listas" "fluxo fluxo fluxo fluxo fluxo fluxo fluxo fluxo formas formas formas formas" "vend vend vend vend vend vend ult ult ult ult ult ult" "mais mais mais mais mais mais mais mais mais mais mais mais"; }
    .fd.fd--sem-caixa { grid-template-areas: "saldo saldo saldo saldo saldo saldo saldo saldo saldo saldo saldo saldo" "kpis kpis kpis kpis kpis kpis kpis kpis kpis kpis kpis kpis" "per per per per per per per per per per per per" "listas listas listas listas listas listas listas listas listas listas listas listas" "fluxo fluxo fluxo fluxo fluxo fluxo fluxo fluxo formas formas formas formas" "vend vend vend vend vend vend ult ult ult ult ult ult" "mais mais mais mais mais mais mais mais mais mais mais mais"; }
    .fd .fd-a-saldo .cxc { height: 100%; box-sizing: border-box; }
    .fd .fd-a-per, .fd .fd-a-mais { align-self: start; }
    .fd .fd-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); height: 100%; }
    .fd .fd-kpis .fd-k { display: flex; flex-direction: column; justify-content: center; grid-column: auto; }
    .fd .fd-k2 { display: flex; flex-direction: column; justify-content: center; }
    .fd .fd-a-fluxo, .fd .fd-a-formas, .fd .fd-a-vend, .fd .fd-a-ult { height: 100%; box-sizing: border-box; }
    /* sem caixa informado: o convite vira uma faixa compacta em largura total */
    .fd .fd-a-saldo .cxc { height: auto; }
    .fd.fd--sem-caixa .cxc-convite { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-rows: auto auto; column-gap: 16px; align-items: center; text-align: left; padding: 16px 20px; }
    .fd.fd--sem-caixa .cxc-convite-ic { grid-row: span 2; }
    .fd.fd--sem-caixa .cxc-convite b { margin-top: 0; grid-column: 2; }
    .fd.fd--sem-caixa .cxc-convite p { margin: 4px 0 0; max-width: none; grid-column: 2; text-wrap: pretty; }
    .fd.fd--sem-caixa .cxc-convite .cxc-cta { grid-column: 3; grid-row: 1; margin-top: 0; white-space: nowrap; }
    .fd.fd--sem-caixa .cxc-convite .cxc-depois { grid-column: 3; grid-row: 2; margin: 0 auto; }
  }
  /* período */
  .fd-per { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 16px; padding: 10px 12px; }
  .fd-per-tx { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .fd-per-ic { flex: none; width: 38px; height: 38px; border-radius: 11px; background: #FFF1F6; color: var(--ui-rosa-escuro); display: flex; align-items: center; justify-content: center; }
  .fd-per-tx b { display: block; font-size: 14.5px; font-weight: 600; color: var(--ui-texto); }
  .fd-per-tx small { display: block; font-size: 13px; color: var(--ui-texto-2); }
  .fd-per-chips { display: flex; gap: 2px; background: #F4EEF1; border-radius: 12px; padding: 3px; overflow-x: auto; scrollbar-width: none; max-width: 100%; }
  .fd-per-chips::-webkit-scrollbar { display: none; }
  .fd-per-chips button { flex: none; min-height: 40px; padding: 0 13px; border: 0; border-radius: 9px; background: none; font-family: inherit; font-size: 13.5px; font-weight: 500; color: var(--ui-texto-2); cursor: pointer; white-space: nowrap; }
  .fd-per-chips button.on { background: var(--ui-branco); color: var(--ui-rosa-escuro); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .fd-per-datas { flex-basis: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .fd-per-datas > div { display: flex; flex-direction: column; gap: 4px; min-width: 0; } .fd-per-datas span { font-size: 12px; font-weight: 500; color: var(--ui-texto-2); }
  .fd-per-chips .fd-so-cel { display: none; }
  @media (max-width: 767px) { .fd-per-chips .fd-so-pc { display: none; } .fd-per-chips .fd-so-cel { display: inline; } .fd-per-chips button { flex: 1; } .fd-per-tx { display: none; } .fd-per { padding: 6px; } .fd-per-chips { width: 100%; justify-content: space-between; } .fd-per-chips button { padding: 0 10px; } }
  @media (min-width: 1024px) { .fd-per-datas { flex-basis: auto; width: 340px; margin-left: auto; } }
  /* comparação */
  .fd-var { display: block; font-size: 12.5px; font-weight: 500; margin: 2px 0 1px; } .fd-var.up { color: var(--ui-verde); } .fd-var.dn { color: var(--ui-vermelho); } .fd-var.neu { color: var(--ui-texto-2); }
  /* formas de pagamento */
  .fd-fp { list-style: none; margin: 4px 0 0; padding: 0; }
  .fd-fp li { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid #F6F1F3; font-size: 14px; color: var(--ui-texto); }
  .fd-fp-n { width: 74px; flex: none; } .fd-fp-b { flex: 1; height: 8px; border-radius: 4px; background: #F3ECEF; overflow: hidden; } .fd-fp-b i { display: block; height: 100%; border-radius: 4px; background: var(--ui-rosa); }
  .fd-fp-v { width: 96px; text-align: right; font-weight: 600; } .fd-fp-p { width: 38px; text-align: right; font-size: 12.5px; color: var(--ui-texto-2); }
  .fd-fp-t { display: flex; justify-content: space-between; margin: 10px 0 0; font-size: 14.5px; font-weight: 600; color: var(--ui-texto); }
  /* mais vendidos e últimos recebimentos */
  .fd-mv, .fd-ul { list-style: none; margin: 4px 0 0; padding: 0; }
  .fd-mv li, .fd-ul li { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid #F6F1F3; font-size: 14px; color: var(--ui-texto); }
  .fd-mv li:last-child, .fd-ul li:last-child, .fd-fp li:last-child { border-bottom: 0; }
  .fd-mv-n { flex: none; width: 24px; height: 24px; border-radius: 8px; background: #FFF1F6; color: var(--ui-rosa-escuro); font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
  .fd-mv-nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fd-mv-q { flex: none; font-size: 12.5px; color: var(--ui-texto-2); } .fd-mv b, .fd-ul b { flex: none; min-width: 92px; text-align: right; font-weight: 600; }
  .fd-ul-q { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .fd-ul-q small { margin-left: 8px; font-size: 12.5px; color: var(--ui-texto-2); }
  .fd-ul-t { flex: none; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 500; background: #E8F7EE; color: var(--ui-verde); } .fd-ul-t.p { background: #FFF4E5; color: #B45309; }
  .fd-ct-sub { display: block; font-size: 12.5px; font-weight: 400; color: var(--ui-texto-2); margin-top: 1px; }
  .fd-ct-lk { display: inline-flex; align-items: center; gap: 3px; min-height: 36px; border: 0; background: none; padding: 0; font-family: inherit; font-size: 13px; font-weight: 600; color: var(--ui-rosa-escuro); cursor: pointer; }
  .fd-vazio { margin: 12px 0 4px; font-size: 13.5px; color: var(--ui-texto-2); }
  .fd-ph--p { height: 120px; }
  .fd-hd { display: flex; align-items: center; gap: 8px; }
  .fd-hd-mes { display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,.18); border-radius: var(--ui-raio-p); padding: 4px; }
  .fd-hd-mes b { font-size: 14px; font-weight: 700; color: var(--ui-branco); padding: 0 6px; white-space: nowrap; }
  .fd-hd-mes button { position: relative; width: 36px; height: 36px; border: none; border-radius: 8px; background: rgba(255,255,255,.18); color: var(--ui-branco); display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .fd-hd-mes button::after { content: ""; position: absolute; inset: -4px; }
  .fd-hd-mes button:disabled { opacity: .35; cursor: default; }
  .fd-hd-bt { display: flex; align-items: center; gap: 6px; min-height: 44px; border: none; border-radius: var(--ui-raio-botao); padding: 0 14px; font-family: var(--font-base); font-size: 14px; font-weight: 700; color: var(--ui-branco); cursor: pointer; white-space: nowrap; }
  .fd-hd-bt { font-weight: 600; }
  .fd-hd-bt.e { background: #16A34A; } .fd-hd-bt.s { background: var(--ui-vinho-escuro); }
  .fd-hd-bt.r { background: var(--ui-branco); color: #B45309; }
  .fd-hd-bt.r em { font-style: normal; min-width: 22px; padding: 1px 7px; border-radius: 11px; background: #B45309; color: var(--ui-branco); font-size: 12px; font-weight: 600; text-align: center; }
  /* foco no convite do saldo: o resto fica levemente apagado (sem bloquear) */
  .fd > * { transition: opacity .3s ease, filter .3s ease; }
  /* (4.29) 3 botões grandes no celular: Entrou · Saiu · Receber pedido */
  .fd-acoes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .fd-bt { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-width: 0; min-height: 84px; border: none; border-radius: 16px; padding: 10px 4px; font-family: inherit; font-size: clamp(11.5px, 3.4vw, 14px); font-weight: 600; white-space: nowrap; cursor: pointer; }
  .fd-bt i { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; color: var(--ui-branco); font-style: normal; }
  .fd-bt.e { background: #ECFDF3; color: var(--ui-verde); } .fd-bt.e i { background: #16A34A; }
  .fd-bt.s { background: #FEF2F2; color: var(--ui-vermelho); } .fd-bt.s i { background: var(--ui-vermelho); }
  .fd-bt.r { background: #FFFBEB; color: #B45309; } .fd-bt.r i { background: #B45309; }
  .fd-bt em { position: absolute; top: 8px; right: 8px; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; background: #B45309; color: var(--ui-branco); font-style: normal; font-size: 11.5px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
  /* (4.29) textos curtos no celular, completos no computador */
  .fd .fd-so-cel { display: none; }
  @media (max-width: 767px) { .fd .fd-so-pc { display: none; } .fd .fd-so-cel { display: inline; } }
  .fd-var { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fd-k i, .fd-k2 i { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fd-k2 i span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  /* (4.29) listas Pra receber / Pra pagar (computador) */
  .fd-listas { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
  .fd-lst { display: flex; flex-direction: column; }
  .fd-lst-it { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 14px; align-items: center; padding: 10px 0; border-top: 1px solid #F6F1F3; }
  .fd-lst .fd-ct + .fd-lst-it { border-top: 0; }
  .fd-lst-tx { min-width: 0; }
  .fd-lst-tx b, .fd-lst-tx small { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fd-lst-tx b { font-size: 14px; font-weight: 600; color: var(--ui-texto); }
  .fd-lst-tx b em { margin-left: 8px; padding: 2px 7px; border-radius: 6px; background: #FFFBEB; color: #B45309; font-style: normal; font-size: 11.5px; font-weight: 500; }
  .fd-lst-tx b em.atr { background: #FEF2F2; color: var(--ui-vermelho); }
  .fd-lst-tx small { margin-top: 2px; font-size: 12.5px; color: var(--ui-texto-2); }
  .fd-lst-v { text-align: right; font-size: 14px; font-weight: 600; color: var(--ui-texto); white-space: nowrap; }
  .fd-lst-v.s { color: var(--ui-vermelho); }
  .fd-lst-v small { display: block; font-size: 12px; font-weight: 400; color: var(--ui-texto-3); }
  .fd-lst-bt { min-height: 36px; padding: 0 14px; border: 0; border-radius: 10px; font-family: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .fd-lst-bt.v { background: #ECFDF3; color: var(--ui-verde); } .fd-lst-bt.v:hover { background: #DCFCE7; }
  .fd-lst-bt.p { background: #FEF2F2; color: var(--ui-vermelho); } .fd-lst-bt.p:hover { background: #FEE2E2; }
  .fd-lst-nova { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; min-height: 40px; margin-top: 4px; padding: 0; border: 0; background: none; font-family: inherit; font-size: 13.5px; font-weight: 500; color: var(--ui-rosa-escuro); cursor: pointer; }
  @media (max-width: 1023px) { .fd-listas { grid-template-columns: minmax(0, 1fr); } }
  .fd-mes { display: flex; justify-content: space-between; align-items: center; background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: var(--ui-raio); padding: 6px; }
  .fd-mes b { font-size: 14.5px; font-weight: 700; color: var(--ui-texto); }
  .fd-mes button { width: 44px; height: 44px; border-radius: var(--ui-raio-p); border: none; background: #FFF1F6; color: var(--ui-rosa-escuro); display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .fd-mes button:disabled { opacity: .35; cursor: default; }
  .fd-kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .fd-k--rec { grid-column: 1 / -1; }
  .fd-k, .fd-k2 { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 14px; padding: 12px; min-width: 0; text-align: left; font-family: inherit; color: var(--ui-texto); }
  .fd-k { position: relative; }
  .fd-ki { position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
  .fd-ki.e { background: var(--ui-verde-fundo); color: var(--ui-verde); } .fd-ki.s { background: var(--ui-vermelho-fundo); color: var(--ui-vermelho); } .fd-ki.n { background: var(--ui-cinza); color: var(--ui-texto-2); } .fd-ki.l { background: #FCE7F3; color: var(--ui-rosa-escuro); }
  .fd-k small { padding-right: 30px; }
  .fd-k small, .fd-k2 small { display: block; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
  .fd-k b, .fd-k2 b { display: block; font-size: clamp(16px, 4.6vw, 24px); font-weight: 600; letter-spacing: -.02em; margin: 3px 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ui-texto); }
  .fd-k i, .fd-k2 i { display: flex; align-items: center; gap: 3px; font-style: normal; font-size: 13px; color: #888780; line-height: 1.35; }
  .fd-k b.e { color: var(--ui-verde); } .fd-k b.s { color: var(--ui-vermelho); } .fd-k b.l { color: var(--ui-rosa-escuro); }
  .fd-venc { font-style: normal; font-weight: 700; color: var(--ui-vermelho); } /* 11/10: conta já vencida */
  .fd-contas { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .fd-k2 { cursor: pointer; } .fd-k2.rec { border-left: 4px solid #F59E0B; } .fd-k2.pag { border-left: 4px solid #EF4444; }
  .fd-card { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: var(--ui-raio-cartao); padding: 14px; }
  .fd-ct { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
  .fd-ct b { font-size: 15px; font-weight: 600; color: var(--ui-texto); }
  .fd-lg { display: flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
  .fd-lg i { display: inline-block; width: 8px; height: 8px; border-radius: 3px; } .fd-lg i.e { background: #22C55E; } .fd-lg i.s { background: #F87171; } .fd-lg i.l { background: var(--ui-vinho-escuro); border-radius: 50%; }
  .fd-ph { height: 150px; background: #FAF7F8; border-radius: var(--ui-raio-p); }
  .fd-fl-res { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-top: 4px; font-size: 12.5px; color: var(--ui-texto-2); }
  .fd-fl-res b { font-weight: 700; color: var(--ui-texto); } .fd-fl-res b.e { color: var(--ui-verde); } .fd-fl-res b.s { color: var(--ui-vermelho); }
  .fd-nota { margin: 8px 0 0; font-size: 12px; color: var(--ui-texto-3); line-height: 1.4; }
  .fd-mais-t { margin: 4px 0 8px; font-size: 13px; font-weight: 500; color: var(--ui-texto-3); }
  .fd-mais-g { display: grid; grid-template-columns: 1fr; gap: 8px; }
  @media (min-width: 640px) { .fd-mais-g { grid-template-columns: repeat(3, 1fr); } }
  .fd-mais-g button { display: grid; grid-template-columns: 38px 1fr; column-gap: 10px; align-items: center; text-align: left; background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: var(--ui-raio-botao); padding: 12px; font-family: inherit; color: var(--ui-texto); cursor: pointer; }
  .fd-mais-g span { grid-row: span 2; width: 38px; height: 38px; border-radius: 11px; background: #FFF1F6; color: var(--ui-rosa-escuro); display: flex; align-items: center; justify-content: center; }
  .fd-mais-g b { font-size: 14px; font-weight: 700; } .fd-mais-g small { font-size: 13px; color: var(--ui-texto-2); }

  /* ═══ (4.29 · jeito de app de banco) ═══ */
  .fd { margin-top: 0; padding-top: 12px; grid-template-areas: "per" "res" "contas" "movs" "fluxo" "formas" "vend" "mais"; }
  .fd-hero-dir { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
  .fd-hero-datas { display: none; width: 340px; padding: 8px; border-radius: 14px; background: var(--ui-branco); color: var(--ui-texto); }
  .fd-a-per .fd-per-datas { margin-top: 6px; }
  .fd-hero-datas .fd-per-datas { width: auto; margin: 0; }
  @media (max-width: 767px) { .fd-fl-res span:last-child { display: none; } .fd-hero-dir { display: none; } }
  .fd-a-res { grid-area: res; } .fd-a-movs { grid-area: movs; } .fd-a-datas { grid-area: datas; }
  .fd-hero { background: var(--ui-rosa); color: var(--ui-branco); width: 100vw; margin: 0 calc(50% - 50vw); padding: 2px 16px 18px; box-sizing: border-box; font-family: var(--font-base); }
  .fd-hero-in { max-width: 1160px; margin: 0 auto; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
  .fd-hero-saldo { min-width: 0; }
  .fd-hero-saldo small { display: block; font-size: 13px; opacity: .88; }
  .fd-hero-v { display: block; margin: 2px 0 4px; font-size: clamp(28px, 8.6vw, 38px); font-weight: 600; letter-spacing: -.02em; white-space: nowrap; }
  .fd-hero-v--p { font-size: clamp(20px, 6vw, 26px); }
  .fd-hero-hoje { display: block; font-size: 13px; opacity: .94; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fd-hero-hoje button { margin: 0; padding: 0; border: 0; background: none; font-family: inherit; font-size: inherit; font-weight: 600; color: var(--ui-branco); text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
  .fd-hero-cta { margin-top: 8px; min-height: 42px; padding: 0 18px; border: 0; border-radius: 12px; background: var(--ui-branco); font-family: inherit; font-size: 14.5px; font-weight: 600; color: var(--ui-rosa-escuro); cursor: pointer; white-space: nowrap; }
  .fd-hero-acoes { max-width: 1160px; margin: 18px auto 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
  .fd-hero-acoes button { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; margin: 0; padding: 0; border: 0; background: none; font-family: inherit; font-size: 12.5px; font-weight: 500; color: var(--ui-branco); white-space: nowrap; cursor: pointer; }
  .fd-hero-acoes i { position: relative; display: flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 50%; background: rgba(255,255,255,.22); font-style: normal; transition: background .15s; }
  .fd-hero-acoes button:active i, .fd-hero-acoes button:hover i { background: rgba(255,255,255,.32); }
  .fd-hero-acoes em { position: absolute; top: -3px; right: -3px; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 10px; background: var(--ui-branco); color: var(--ui-rosa-escuro); font-style: normal; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
  .fd-hero-acoes em.v { background: #FEE2E2; color: var(--ui-vermelho); }
  .fd-hero-per { display: none !important; }
  .fd-a-per.fd-per { padding: 4px; }
  /* cartão do período */
  .fd-res .fd-ct { margin-bottom: 2px; }
  .fd-res-l { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 10px; align-items: center; padding: 9px 0; border-top: 1px solid #F6F1F3; font-size: 14px; color: var(--ui-texto); }
  .fd-res .fd-ct + .fd-res-l { border-top: 0; padding-top: 6px; }
  .fd-res-l b { font-weight: 600; white-space: nowrap; } .fd-res-l b.e { color: var(--ui-verde); } .fd-res-l b.s { color: var(--ui-vermelho); }
  .fd-res-b { grid-column: 1 / -1; height: 6px; border-radius: 3px; background: #F3ECEF; overflow: hidden; }
  .fd-res-b i { display: block; height: 100%; border-radius: 3px; transition: width .4s ease; } .fd-res-b i.e { background: #22C55E; } .fd-res-b i.s { background: #F87171; }
  .fd-res-t { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-top: 2px; padding-top: 10px; border-top: 1px dashed #EADFE4; font-size: 14px; color: var(--ui-texto); }
  .fd-res-t b { font-size: 22px; font-weight: 600; letter-spacing: -.01em; white-space: nowrap; } .fd-res-t b.s { color: var(--ui-vermelho); }
  .fd-res-c { margin: 4px 0 0; text-align: right; font-size: 12.5px; }
  .fd-res-c .fd-var { display: block; margin: 0; }
  .fd .fd-res-c .fd-so-pc { display: inline !important; } .fd .fd-res-c .fd-so-cel { display: none !important; }
  /* a receber / a pagar (celular) */
  .fd-contas .fd-k2 { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--ui-texto-3); }
  .fd-contas .fd-k2 > span { min-width: 0; }
  .fd-contas .fd-k2 b { font-size: clamp(15px, 4.4vw, 18px); } .fd-contas .fd-k2 b.s { color: var(--ui-vermelho); }
  /* últimas movimentações */
  .fd-mov { list-style: none; margin: 2px 0 0; padding: 0; }
  .fd-mov li { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid #F6F1F3; }
  .fd-mov li:first-child { border-top: 0; }
  .fd-mov-ic { flex: none; width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
  .fd-mov-ic.e { background: #ECFDF3; color: var(--ui-verde); } .fd-mov-ic.s { background: #FEF2F2; color: var(--ui-vermelho); }
  .fd-mov-tx { flex: 1; min-width: 0; }
  .fd-mov-tx b, .fd-mov-tx small { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fd-mov-tx b { font-size: 14px; font-weight: 500; color: var(--ui-texto); } .fd-mov-tx small { margin-top: 1px; font-size: 12px; color: var(--ui-texto-2); }
  .fd-mov-v { flex: none; font-size: 14px; font-weight: 600; white-space: nowrap; } .fd-mov-v.e { color: var(--ui-verde); } .fd-mov-v.s { color: var(--ui-vermelho); }
  @media (min-width: 768px) {
    .fd-hero-acoes { display: none; }
    .fd-hero-per { display: flex !important; background: var(--ui-branco); border-radius: 14px; padding: 4px; flex: none; }
    .fd-a-per { display: none !important; }
    .fd { grid-template-areas: "res" "fluxo" "listas" "movs" "formas" "vend" "mais"; }
    .fd-hero-datas { display: block; }
  }
  @media (min-width: 901px) { .fd-hero { width: auto; margin: 0 -2rem; padding: 4px 2rem 88px; } .fd { margin-top: -64px; padding-top: 0; } }
  @media (min-width: 1024px) {
    .fd, .fd.fd--sem-caixa { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: stretch;
      grid-template-areas: "res fluxo" "listas listas" "movs formas" "vend vend" "mais mais"; }
    .fd .fd-a-res, .fd .fd-a-movs { height: 100%; box-sizing: border-box; }
  }
`;

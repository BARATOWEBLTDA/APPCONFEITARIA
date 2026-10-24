// Transações — o extrato do financeiro, refeito no padrão novo (03/10).
// Período (hoje, 7 dias, mês ou datas), filtros, busca, exportar e ESTORNO em vez de apagar.
import EstiloFinanceiro from "@/components/financeiro/EstiloFinanceiro";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { ArrowUp, ArrowDown, MagnifyingGlass, DownloadSimple, ArrowSquareOut, ArrowCounterClockwise, WarningCircle, CaretLeft, CaretRight } from "@phosphor-icons/react";
import CampoData from "@/components/CampoData";
import GavetaFiltro, { BotaoFiltro, filtrosAtivos } from "@/components/base/GavetaFiltro";
import AppPageHeader from "@/components/AppPageHeader";
import { COMO_TRANSACOES, TOUR_TRANSACOES } from "@/lib/comoTelas";
import { Botao, TelaVazia, avisar as avisarBase } from "@/components/base";
import { erroDeConexao } from "@/lib/erros";
import { MESES, iso as isoData, periodoDoDia, periodoDoMes, periodoHoje, periodoInicial, rotuloPeriodo, type Periodo } from "@/components/financeiro/PeriodoFiltro";
import { useAoVoltar, useDiaAtual } from "@/hooks/useAoVoltar";
import DespesaSheet from "@/components/financeiro/DespesaSheet";
import Folha, { FOLHA_CSS } from "@/components/financeiro/Folha";
import { supabase } from "@/lib/supabase";
import { carregarExtrato, estornar, type MovExtrato } from "@/lib/extrato";

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const FORMAS = [{ k: "pix", l: "Pix" }, { k: "dinheiro", l: "Dinheiro" }, { k: "credito", l: "Crédito" }, { k: "debito", l: "Débito" }];
const SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MES_MIN = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const diaIso = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return isoData(d); };
/** (24/10) "Hoje, 23 de outubro" · "Ontem, 22 de outubro" · "Terça, 13 de outubro" */
const rotuloDia = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  const dt = new Date(y, m - 1, dd);
  const ini = d === diaIso() ? "Hoje" : d === diaIso(-1) ? "Ontem" : SEMANA[dt.getDay()];
  return `${ini}, ${dd} de ${MES_MIN[m - 1]}${y !== new Date().getFullYear() ? ` de ${y}` : ""}`;
};
/** valor com sinal: + R$ 220,00 · − R$ 60,00 */
const comSinal = (v: number) => `${v < 0 ? "−" : "+"} ${brl(Math.abs(v))}`;
/** título do período (no cartão do saldo) */
const tituloPeriodo = (p: Periodo) => p.tipo === "mes" ? `${MESES[p.mes]} de ${p.ano}` : p.tipo === "hoje" ? "Hoje" : p.tipo === "7dias" ? "Últimos 7 dias" : p.tipo === "30dias" ? "Últimos 30 dias" : `${p.ini.split("-").reverse().slice(0, 2).join("/")} a ${p.fim.split("-").reverse().slice(0, 2).join("/")}`;
const saldoDoPeriodo = (p: Periodo) => p.tipo === "mes" ? "Saldo do mês" : p.tipo === "hoje" ? "Saldo de hoje" : "Saldo do período";

const PADRAO = { periodo: "mes", tipo: "todas", formas: FORMAS.map(f => f.k) };
/** do que a gaveta guarda para o período de verdade (datas) */
function periodoDaGaveta(k: string, atual: Periodo, ini?: string, fim?: string): Periodo {
  const h = new Date();
  if (k === "hoje") return periodoHoje();
  if (k === "7dias") return { tipo: "7dias", ini: diaIso(-6), fim: diaIso(), ano: h.getFullYear(), mes: h.getMonth() };
  if (k === "30dias") return { tipo: "30dias", ini: diaIso(-29), fim: diaIso(), ano: h.getFullYear(), mes: h.getMonth() };
  if (k === "personalizado") return { tipo: "personalizado", ini: ini || diaIso(-14), fim: fim || diaIso(), ano: h.getFullYear(), mes: h.getMonth() };
  return atual.tipo === "mes" ? atual : periodoInicial();
}

export default function FinanceiroTransacoes() {
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>(periodoInicial());
  const [itens, setItens] = useState<MovExtrato[]>([]);
  const [semEstorno, setSemEstorno] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false); // não deu pra carregar (10/10)
  const [tipo, setTipo] = useState<"todas" | "entrada" | "saida">("todas");
  const [formas, setFormas] = useState<string[]>(PADRAO.formas);
  const [busca, setBusca] = useState("");
  const [verEstornados, setVerEstornados] = useState(false);
  const [aberto, setAberto] = useState<MovExtrato | null>(null);
  const [nova, setNova] = useState<"entrada" | "saida" | null>(null);
  const [filtroAberto, setFiltroAberto] = useState(false);

  // 10/10: ao trocar de período rápido, só vale a resposta da última busca (a atrasada era aplicada por cima da nova)
  const numBusca = useRef(0);
  const carregouBem = useRef(false);
  const carregar = useCallback(async (semPiscar?: unknown) => {
    const n = ++numBusca.current;
    // (11/10) atualização por trás que falha mantém o extrato que já está na tela
    const quieto = semPiscar === true && carregouBem.current;
    if (semPiscar !== true) setCarregando(true); // 11/10: ao voltar pro app, atualiza por trás, sem trocar a lista por "Carregando…"
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (n !== numBusca.current) return;
      if (!user) { if (erroDeConexao(error) && !quieto) { setErro(true); setCarregando(false); } return; }
      setUid(user.id);
      const r = await carregarExtrato(user.id, periodo.ini, periodo.fim);
      if (n !== numBusca.current) return;
      if (r.erro && quieto) return;
      if (!r.erro) carregouBem.current = true;
      // 10/10: com erro, a tela avisa (antes mostrava o extrato vazio ou com os estornados contando)
      setItens(r.itens); setSemEstorno(r.semEstornoManual); setErro(r.erro); setCarregando(false);
    } catch (e) {
      console.error("[extrato] não consegui carregar:", e);
      if (n === numBusca.current && !quieto) { setItens([]); setErro(true); setCarregando(false); }
    }
  }, [periodo]);
  useEffect(() => { carregar(); }, [carregar]);
  // 11/10: app aberto de um dia pro outro. Voltou pro app: busca de novo. Virou o dia: "Hoje" e "7 dias" passam a ser
  // os de agora (antes continuavam no dia em que o filtro foi tocado) e os títulos "Hoje / Ontem" da lista se refazem.
  useAoVoltar(() => { carregar(true); });
  const hoje = useDiaAtual();
  useEffect(() => {
    setPeriodo(p => periodoDoDia(p)); // (23/10) Hoje, 7 e 30 dias e o mês de hoje andam com o dia
  }, [hoje]);

  const somar = (l: MovExtrato[], t: "entrada" | "saida") => l.filter(i => !i.estornado && i.tipo === t).reduce((s, i) => s + i.valor, 0);
  const entradas = somar(itens, "entrada");
  const saidas = somar(itens, "saida");
  const qEstornados = itens.filter(i => i.estornado).length;
  const todasFormas = formas.length === FORMAS.length;

  // (24/10) a forma de pagamento só filtra as entradas de pedido (as saídas e os lançamentos sem forma continuam)
  const passa = (i: MovExtrato, t: string, fs: string[]) => (t === "todas" || i.tipo === t) && (fs.length === FORMAS.length || (!!i.forma && fs.includes(i.forma)));
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter(i => (verEstornados || !i.estornado) && passa(i, tipo, formas)
      && (!q || `${i.titulo} ${i.subtipo} ${i.detalhe}`.toLowerCase().includes(q)));
  }, [itens, tipo, formas, busca, verEstornados]); // eslint-disable-line react-hooks/exhaustive-deps
  const porDia = useMemo(() => {
    const g: { dia: string; itens: MovExtrato[] }[] = [];
    for (const i of lista) { const u = g[g.length - 1]; if (u && u.dia === i.data) u.itens.push(i); else g.push({ dia: i.data, itens: [i] }); }
    return g;
  }, [lista]);

  const avisar = (m: string) => avisarBase(m, { tipo: /^Não /.test(m) ? "erro" : "ok" });
  const exportar = () => {
    if (carregando) return;
    if (erro) { avisar("Não deu para carregar o extrato. Tente de novo."); return; }
    // 10/10: os totais do cabeçalho saem das MESMAS linhas da planilha (a lista da tela, com os filtros) e não contam
    // as estornadas, que ficam marcadas na coluna Situação. Antes o cabeçalho era do período inteiro e não batia.
    const num = (v: number) => v.toFixed(2).replace(".", ",");
    // texto com ponto e vírgula, aspas ou quebra de linha vai entre aspas (e as aspas dobram), como o CSV pede
    const txt = (s: string) => { const t = String(s ?? "").replace(/\s*[\r\n]+\s*/g, " "); return /[;"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const ent = somar(lista, "entrada"), sai = somar(lista, "saida");
    const nEst = lista.filter(i => i.estornado).length;
    const filtrado = tipo !== "todas" || !todasFormas || !!busca.trim();
    const linhas = [txt(`Extrato ${rotuloPeriodo(periodo)}`), ...(filtrado ? ["Só os lançamentos filtrados na tela"] : []), "",
      `Entradas;${num(ent)}`, `Saídas;${num(sai)}`, `Resultado (entradas − saídas);${num(ent - sai)}`,
      ...(nEst ? [`Estornados (não entram nos totais);${nEst}`] : []), "",
      "Data;Tipo;Descrição;Detalhe;Valor;Situação",
      ...lista.map(i => [i.data.split("-").reverse().join("/"), i.tipo === "entrada" ? "Entrada" : "Saída", txt(i.titulo), txt([i.subtipo, i.detalhe].filter(Boolean).join(" · ")),
        num(i.tipo === "entrada" ? i.valor : -i.valor), i.estornado ? "Estornado (não entra nos totais)" : ""].join(";"))];
    const blob = new Blob(["﻿" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `extrato-${periodo.ini}-a-${periodo.fim}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  // filtro na gaveta da direita (24/10), igual ao de Pedidos
  const valorFiltro = { periodo: periodo.tipo, ini: periodo.ini, fim: periodo.fim, tipo, formas };
  const ativos = filtrosAtivos(valorFiltro, PADRAO);
  const vivos = itens.filter(i => !i.estornado);
  const nTipo = (t: string) => vivos.filter(i => passa(i, t, formas)).length;
  const nForma = (f: string) => vivos.filter(i => i.forma === f && (tipo === "todas" || i.tipo === tipo)).length;
  const aplicarFiltro = (v: Record<string, any>) => {
    setTipo(v.tipo); setFormas(v.formas);
    if (v.periodo !== periodo.tipo || (v.periodo === "personalizado" && (v.ini !== periodo.ini || v.fim !== periodo.fim))) setPeriodo(periodoDaGaveta(v.periodo, periodo, v.ini, v.fim));
  };
  const mudarMes = (d: number) => setPeriodo(periodoDoMes(periodo.ano, periodo.mes + d));
  const ehMesAtual = periodo.ano === new Date().getFullYear() && periodo.mes === new Date().getMonth();
  const saldo = entradas - saidas;

  return (
    <>
      <AppPageHeader
        title="Transações"
        subtitle="Extrato de entradas e saídas" infoComo={COMO_TRANSACOES} infoTour={TOUR_TRANSACOES}
        onBack={() => navigate("/financeiro")}
        infoIcon="📑"
        infoContent={<>
          <p>Aqui aparece <strong>todo o dinheiro que entrou e saiu</strong>: os recebimentos de pedidos (na data em que você recebeu), as entradas avulsas e as despesas pagas.</p>
          <p>Lançou errado? Abra o item e use <strong>Estornar</strong>: ele sai das contas, mas continua no histórico, riscado.</p>
          <p>Aqui entra <strong>todo</strong> o dinheiro, inclusive aporte e retirada. Por isso o <strong>saldo</strong> pode não bater com o Resultado do painel, que deixa esses dois de fora.</p>
        </>}
        rightActions={
          <div className="tx-hd">
            <button type="button" className="tx-hd-bt e" onClick={() => setNova("entrada")}><ArrowUp size={15} weight="bold" />Entrada</button>
            <button type="button" className="tx-hd-bt s" onClick={() => setNova("saida")}><ArrowDown size={15} weight="bold" />Saída</button>
            <button type="button" className="tx-hd-bt n" onClick={exportar}><DownloadSimple size={16} weight="bold" />Exportar</button>
          </div>
        }
      />
      <EstiloFinanceiro />
      <div className="tx">
        {/* (24/10) extrato de banco: o mês em cima, o saldo em destaque, entradas e saídas embaixo */}
        <div className="tx-saldo">
          <div className="tx-mes">
            {periodo.tipo === "mes" ? <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><CaretLeft size={15} weight="bold" /></button> : <i />}
            <b>{tituloPeriodo(periodo)}</b>
            {periodo.tipo === "mes" ? <button type="button" onClick={() => mudarMes(1)} disabled={ehMesAtual} aria-label="Próximo mês"><CaretRight size={15} weight="bold" /></button> : <i />}
          </div>
          <small>{saldoDoPeriodo(periodo)}</small>
          <strong className={saldo < 0 ? "neg" : ""}>{erro ? "—" : carregando ? "…" : `${saldo < 0 ? "− " : ""}${brl(Math.abs(saldo))}`}</strong>
          <div className="tx-es">
            <span className="e"><i><ArrowUp size={11} weight="bold" /></i>{erro ? "—" : brl(entradas)}</span>
            <span className="s"><i><ArrowDown size={11} weight="bold" /></i>{erro ? "—" : brl(saidas)}</span>
          </div>
        </div>

        <div className="tx-bb">
          <label className="tx-busca"><MagnifyingGlass size={18} /><input type="search" aria-label="Buscar no extrato" placeholder="Buscar no extrato" value={busca} onChange={e => setBusca(e.target.value)} /></label>
          <BotaoFiltro ativos={ativos} onClick={() => setFiltroAberto(true)} />
        </div>

        {carregando ? <div className="tx-ph" /> : erro ? (
          <TelaVazia caixa icone={<WarningCircle size={30} />} titulo="Não deu para carregar o extrato" texto="Confira a internet e tente de novo."
            acao={<Botao variante="suave" tamanho="m" onClick={carregar}>Tentar de novo</Botao>} />
        ) : lista.length === 0 ? (
          <div className="tx-vazio"><b>Nada por aqui {rotuloPeriodo(periodo)}</b><p>{itens.length ? "Nenhum lançamento com esses filtros." : "Quando você receber um pedido ou lançar uma entrada ou saída, aparece aqui."}</p></div>
        ) : porDia.map((g, gi) => {
          const sd = g.itens.filter(i => !i.estornado).reduce((s, i) => s + (i.tipo === "entrada" ? i.valor : -i.valor), 0);
          return (
            <section key={`${g.dia}-${gi}`} className="tx-dia">
              <p className="tx-dia-t"><b>{rotuloDia(g.dia)}</b><span>Saldo do dia <em>{comSinal(sd)}</em></span></p>
              <div className="tx-lista">
                {g.itens.map((i, ii) => {
                  const sub = i.origem === "pagamento"
                    ? [i.pedidoNumero != null ? `Pedido #${i.pedidoNumero}` : "Pedido", i.detalhe, i.hora].filter(Boolean)
                    : [i.detalhe || i.subtipo, i.hora].filter(Boolean);
                  return (
                    <button type="button" key={`${i.id}-${ii}`} className={`tx-it ${i.estornado ? "est" : ""}`} onClick={() => setAberto(i)}>
                      <span className={`tx-ic ${i.tipo === "entrada" ? "e" : "s"}`}>{i.tipo === "entrada" ? <ArrowUp size={16} weight="bold" /> : <ArrowDown size={16} weight="bold" />}</span>
                      <span className="tx-it-t"><b>{(i.origem === "pagamento" ? i.quem : "") || i.titulo}</b><small>{i.estornado ? "Estornado · " : ""}{sub.join(" · ")}</small></span>
                      <span className={`tx-it-v ${i.tipo === "entrada" ? "e" : "s"}`}>{i.tipo === "entrada" ? "+" : "−"} {brl(i.valor)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        {qEstornados > 0 && <button type="button" className="tx-ver-est" onClick={() => setVerEstornados(v => !v)}>{verEstornados ? "Esconder estornados" : `Mostrar ${qEstornados} ${qEstornados === 1 ? "estornado" : "estornados"}`}</button>}
      </div>

      {/* celular: Entrou e Saiu presos no rodapé, como no Financeiro */}
      {createPortal(<div className="txp-barra">
        <button type="button" className="e" onClick={() => setNova("entrada")}><ArrowUp size={16} weight="bold" />Entrou</button>
        <button type="button" className="s" onClick={() => setNova("saida")}><ArrowDown size={16} weight="bold" />Saiu</button>
      </div>, document.body)}

      {filtroAberto && <GavetaFiltro valor={valorFiltro} padrao={{ ...PADRAO, ini: valorFiltro.ini, fim: valorFiltro.fim }}
        grupos={[
          { id: "periodo", titulo: "Período", tipo: "radio", opcoes: [{ k: "hoje", label: "Hoje" }, { k: "7dias", label: "Últimos 7 dias" }, { k: "30dias", label: "Últimos 30 dias" }, { k: "mes", label: "Este mês" }, { k: "personalizado", label: "Escolher período" }],
            depois: (k, v, mudar) => k === "personalizado" ? (
              <div className="gf-extra">
                <div><small>De</small><CampoData valor={v.ini} max={v.fim} titulo="Início do período" curto onChange={d => mudar("ini", d)} /></div>
                <div><small>Até</small><CampoData valor={v.fim} min={v.ini} max={diaIso()} titulo="Fim do período" curto onChange={d => mudar("fim", d)} /></div>
              </div>
            ) : null },
          { id: "tipo", titulo: "Tipo", tipo: "radio", opcoes: [{ k: "todas", label: "Entradas e saídas" }, { k: "entrada", label: "Só entradas", n: nTipo("entrada") }, { k: "saida", label: "Só saídas", n: nTipo("saida") }] },
          { id: "formas", titulo: "Forma de pagamento", tipo: "check", todas: true, opcoes: FORMAS.map(f => ({ k: f.k, label: f.l, n: nForma(f.k) })) },
        ]}
        contar={v => v.periodo !== periodo.tipo || v.ini !== periodo.ini || v.fim !== periodo.fim ? NaN : vivos.filter(i => passa(i, v.tipo, v.formas)).length}
        rotulo={n => n == null || isNaN(n) ? "Ver lançamentos" : n === 0 ? "Nenhum lançamento" : `Ver ${n} ${n === 1 ? "lançamento" : "lançamentos"}`}
        aoAplicar={aplicarFiltro} aoFechar={() => setFiltroAberto(false)}
        rodape={<button type="button" className="gf-link" onClick={exportar}><DownloadSimple size={18} weight="bold" />Baixar a planilha</button>}
      />}

      {aberto && <DetalheSheet m={aberto} semEstorno={semEstorno} onClose={() => setAberto(null)} onAbrirPedido={id => navigate(`/pedidos/${id}/editar`)}
        onEstornado={msg => { setAberto(null); avisar(msg); carregar(); }} />}
      {nova && uid && <DespesaSheet tipo={nova} onClose={() => setNova(null)} onSalvo={(aviso, continuar) => { if (!continuar) setNova(null); avisar(aviso); carregar(); }} onReceberPedido={() => navigate("/financeiro/a-receber")} />}
      <style>{CSS}{FOLHA_CSS}</style>
    </>
  );
}

function DetalheSheet({ m, semEstorno, onClose, onAbrirPedido, onEstornado }: { m: MovExtrato; semEstorno: boolean; onClose: () => void; onAbrirPedido: (id: string) => void; onEstornado: (msg: string) => void }) {
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [y, mm, d] = m.data.split("-");
  const fazer = async () => {
    setOcupado(true); const r = await estornar(m); setOcupado(false);
    if (!r.ok) { setErro(r.erro || "Não foi possível estornar."); return; }
    onEstornado(m.origem === "pagamento" ? "Estornado. O pedido voltou a ter valor a receber." : "Estornado. Ele saiu das contas e ficou no histórico.");
  };
  return (
    <Folha titulo={m.titulo} sub={m.estornado ? "Este lançamento foi estornado" : m.subtipo} onClose={onClose}>
      <div className="fo-dica" style={{ marginTop: 12 }}>
        <div className="tx-dl"><span>Valor</span><b className={m.tipo === "entrada" ? "e" : "s"}>{m.tipo === "entrada" ? "+" : "−"} {brl(m.valor)}</b></div>
        <div className="tx-dl"><span>Data</span><b>{d}/{mm}/{y}</b></div>
        {m.detalhe && <div className="tx-dl"><span>{m.origem === "pagamento" ? "Forma de pagamento" : "Categoria"}</span><b>{m.detalhe}</b></div>}
      </div>
      {m.pedidoId && <button type="button" className="fo-cta escuro" onClick={() => onAbrirPedido(m.pedidoId!)}><ArrowSquareOut size={16} weight="bold" style={{ verticalAlign: "-3px", marginRight: 6 }} />Abrir o pedido</button>}
      {!m.estornado && (confirmar ? (
        <div className="fo-dica" style={{ background: "#FEF2F2" }}>
          <b>Estornar este lançamento?</b> {m.origem === "pagamento" ? "O valor sai do caixa e o pedido volta a ter esse valor a receber." : "O valor sai das contas do caixa e do mês. Se for o pagamento de uma conta, ela volta para A pagar."} Nada é apagado: ele continua no extrato, riscado.
          <div className="fo-row" style={{ marginTop: 10 }}>
            <button type="button" className="fo-cta" style={{ marginTop: 0, background: "#fff", color: "#2C1219", border: "1.5px solid #EDE6E9", boxShadow: "none" }} onClick={() => setConfirmar(false)}>Voltar</button>
            <button type="button" className="fo-cta vermelho" style={{ marginTop: 0 }} onClick={fazer} disabled={ocupado}>{ocupado ? "Estornando…" : "Estornar"}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="fo-sec" onClick={() => setConfirmar(true)} disabled={m.origem === "manual" && semEstorno}>
          <ArrowCounterClockwise size={15} weight="bold" style={{ verticalAlign: "-3px", marginRight: 6 }} />{m.origem === "manual" && semEstorno ? "Estorno disponível depois do SQL do estorno" : "Estornar (lançado errado)"}
        </button>
      ))}
      {erro && <p className="fo-erro">{erro}</p>}
    </Folha>
  );
}

const CSS = `
  .tx-hd { display: flex; align-items: center; gap: 8px; }
  .tx-hd-bt { display: flex; align-items: center; gap: 6px; min-height: 44px; border: none; border-radius: var(--ui-raio-botao); padding: 0 14px; font-family: var(--font-base); font-size: 14px; font-weight: 600; color: var(--ui-branco); cursor: pointer; white-space: nowrap; }
  .tx-hd-bt.e { background: #16A34A; } .tx-hd-bt.s { background: var(--ui-vinho-escuro); } .tx-hd-bt.n { background: var(--ui-branco); color: var(--ui-texto); }
  .tx { position: relative; max-width: 980px; margin: 0 auto; padding: 14px 0 150px; font-family: var(--font-base); color: var(--ui-texto); display: flex; flex-direction: column; gap: 14px; }
  @media (min-width: 768px) { .tx { padding-bottom: 96px; } }
  /* (24/10) cartão do saldo, como extrato de banco */
  .tx-saldo { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: var(--ui-raio-cartao); padding: 10px 14px 14px; }
  .tx-mes { display: grid; grid-template-columns: 36px 1fr 36px; align-items: center; margin-bottom: 8px; }
  .tx-mes b { text-align: center; font-size: 15.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tx-mes button { width: 36px; height: 36px; border: none; border-radius: 10px; background: #F6F1F3; color: var(--ui-texto-2); display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .tx-mes button:disabled { opacity: .35; cursor: default; }
  .tx-saldo > small { display: block; font-size: 13px; color: var(--ui-texto-2); }
  .tx-saldo > strong { display: block; margin-top: 2px; font-size: clamp(26px, 8vw, 32px); font-weight: 700; letter-spacing: -.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tx-saldo > strong.neg { color: var(--ui-vermelho); }
  .tx-es { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 8px; }
  .tx-es span { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; white-space: nowrap; }
  .tx-es i { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
  .tx-es .e { color: var(--ui-verde); } .tx-es .e i { background: var(--ui-verde-fundo, #ECFDF3); }
  .tx-es .s { color: var(--ui-vermelho); } .tx-es .s i { background: var(--ui-vermelho-fundo, #FEF2F2); }
  .tx-bb { display: flex; gap: 8px; align-items: center; }
  .tx-busca { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; height: 48px; background: var(--ui-branco); border: 1px solid var(--ui-borda-campo); border-radius: var(--ui-raio); padding: 0 12px; color: var(--ui-texto-3); box-sizing: border-box; }
  .tx-busca input { flex: 1; min-width: 0; border: none; outline: none; font-family: inherit; font-size: 16px; color: var(--ui-texto); background: none; }
  .tx-ph { height: 220px; background: #FAF7F8; border-radius: var(--ui-raio-cartao); }
  .tx-vazio { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: var(--ui-raio-cartao); padding: 26px 18px; text-align: center; }
  .tx-vazio b { display: block; font-size: 15.5px; font-weight: 700; } .tx-vazio p { margin: 6px auto 0; font-size: 13.5px; color: var(--ui-texto-2); max-width: 360px; line-height: 1.45; }
  .tx-dia-t { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin: 0 2px 6px; }
  .tx-dia-t b { font-size: 14px; font-weight: 600; color: var(--ui-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .tx-dia-t span { flex: none; font-size: 12.5px; color: var(--ui-texto-3); white-space: nowrap; } .tx-dia-t em { font-style: normal; font-weight: 600; color: var(--ui-texto); }
  .tx-lista { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: var(--ui-raio-cartao); padding: 2px 14px; }
  .tx-it { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: center; gap: 12px; width: 100%; text-align: left; background: none; border: none; border-top: 1px solid var(--ui-linha); padding: 12px 0; font-family: inherit; color: var(--ui-texto); cursor: pointer; }
  .tx-it:first-child { border-top: none; }
  .tx-ic { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
  .tx-ic.e { background: var(--ui-verde-fundo); color: var(--ui-verde); } .tx-ic.s { background: var(--ui-vermelho-fundo); color: var(--ui-vermelho); }
  .tx-it-t { min-width: 0; } .tx-it-t b { display: block; font-size: 14.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tx-it-t small { display: block; font-size: 12.5px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
  .tx-it-v { font-size: 14.5px; font-weight: 700; white-space: nowrap; text-align: right; } .tx-it-v.e { color: var(--ui-verde); } .tx-it-v.s { color: var(--ui-texto); }
  .tx-it.est { opacity: .5; } .tx-it.est .tx-it-v, .tx-it.est .tx-it-t b { text-decoration: line-through; }
  .tx-ver-est { align-self: center; border: none; background: none; font-family: inherit; font-size: 13px; font-weight: 700; color: var(--ui-texto-3); cursor: pointer; padding: 8px;  min-height: 44px; }
  .tx-dl { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; font-size: 13.5px; } .tx-dl span { color: var(--ui-texto-2); } .tx-dl b { text-align: right; }
  .tx-dl b.e { color: var(--ui-verde); } .tx-dl b.s { color: var(--ui-vermelho); }
  /* Entrou e Saiu presos no rodapé (celular), iguais aos do Financeiro */
  .txp-barra { position: fixed; left: 0; right: 0; bottom: calc(56px + env(safe-area-inset-bottom, 0px)); z-index: 51; display: flex; gap: 6px; padding: 14px 12px 10px; box-sizing: border-box; background: linear-gradient(rgba(244,238,241,0), var(--ui-fundo, #F4EEF1) 35%); font-family: var(--font-base); }
  .txp-barra button { flex: 1 1 0; display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 0; height: 48px; border: 0; border-radius: 14px; font-family: inherit; font-size: 14.5px; font-weight: 600; white-space: nowrap; cursor: pointer; box-shadow: 0 4px 14px rgba(42,21,32,.14); color: var(--ui-branco); }
  .txp-barra .e { background: #16A34A; } .txp-barra .s { background: var(--ui-vinho-escuro, #1F1117); }
  @media (min-width: 768px) { .txp-barra { display: none; } }
`;

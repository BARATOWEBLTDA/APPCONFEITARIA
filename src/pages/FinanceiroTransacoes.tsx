// Transações — o extrato do financeiro, refeito no padrão novo (03/10).
// Período (hoje, 7 dias, mês ou datas), filtros, busca, exportar e ESTORNO em vez de apagar.
import EstiloFinanceiro from "@/components/financeiro/EstiloFinanceiro";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp, ArrowDown, MagnifyingGlass, DownloadSimple, ArrowSquareOut, ArrowCounterClockwise, WarningCircle } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, TelaVazia, avisar as avisarBase } from "@/components/base";
import { erroDeConexao } from "@/lib/erros";
import PeriodoFiltro, { iso as isoPeriodo, periodoInicial, rotuloPeriodo, type Periodo } from "@/components/financeiro/PeriodoFiltro";
import { useAoVoltar, useDiaAtual } from "@/hooks/useAoVoltar";
import DespesaSheet from "@/components/financeiro/DespesaSheet";
import Folha, { FOLHA_CSS } from "@/components/financeiro/Folha";
import { supabase } from "@/lib/supabase";
import { carregarExtrato, estornar, type MovExtrato } from "@/lib/extrato";

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const FORMAS = [{ k: "pix", l: "Pix" }, { k: "dinheiro", l: "Dinheiro" }, { k: "credito", l: "Crédito" }, { k: "debito", l: "Débito" }];
const rotuloDia = (d: string) => {
  const h = new Date(); const hoje = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
  const o = new Date(); o.setDate(o.getDate() - 1); const ontem = `${o.getFullYear()}-${String(o.getMonth() + 1).padStart(2, "0")}-${String(o.getDate()).padStart(2, "0")}`;
  if (d === hoje) return "Hoje"; if (d === ontem) return "Ontem";
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
};

export default function FinanceiroTransacoes() {
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>(periodoInicial());
  const [itens, setItens] = useState<MovExtrato[]>([]);
  const [semEstorno, setSemEstorno] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false); // não deu pra carregar (10/10)
  const [tipo, setTipo] = useState<"todas" | "entrada" | "saida">("todas");
  const [forma, setForma] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [verEstornados, setVerEstornados] = useState(false);
  const [aberto, setAberto] = useState<MovExtrato | null>(null);
  const [nova, setNova] = useState<"entrada" | "saida" | null>(null);

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
    setPeriodo(p => {
      if (p.tipo !== "hoje" && p.tipo !== "7dias") return p;
      const d = new Date(); d.setDate(d.getDate() - (p.tipo === "7dias" ? 6 : 0));
      const ini = isoPeriodo(d);
      return p.fim === hoje && p.ini === ini ? p : { ...p, ini, fim: hoje };
    });
  }, [hoje]);

  const somar = (l: MovExtrato[], t: "entrada" | "saida") => l.filter(i => !i.estornado && i.tipo === t).reduce((s, i) => s + i.valor, 0);
  const entradas = somar(itens, "entrada");
  const saidas = somar(itens, "saida");
  const qEstornados = itens.filter(i => i.estornado).length;

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter(i => (verEstornados || !i.estornado)
      && (tipo === "todas" || i.tipo === tipo)
      && (!forma || i.forma === forma)
      && (!q || `${i.titulo} ${i.subtipo} ${i.detalhe}`.toLowerCase().includes(q)));
  }, [itens, tipo, forma, busca, verEstornados]);
  const porDia = useMemo(() => {
    const g: { dia: string; itens: MovExtrato[] }[] = [];
    for (const i of lista) { const u = g[g.length - 1]; if (u && u.dia === i.data) u.itens.push(i); else g.push({ dia: i.data, itens: [i] }); }
    return g;
  }, [lista]);

  const avisar = (m: string) => avisarBase(m, { tipo: /^Não /.test(m) ? "erro" : "ok" });
  const exportar = () => {
    if (carregando) return;
    if (erro) { avisar("Não deu pra carregar o extrato. Tente de novo."); return; }
    // 10/10: os totais do cabeçalho saem das MESMAS linhas da planilha (a lista da tela, com os filtros) e não contam
    // as estornadas, que ficam marcadas na coluna Situação. Antes o cabeçalho era do período inteiro e não batia.
    const num = (v: number) => v.toFixed(2).replace(".", ",");
    // texto com ponto e vírgula, aspas ou quebra de linha vai entre aspas (e as aspas dobram), como o CSV pede
    const txt = (s: string) => { const t = String(s ?? "").replace(/\s*[\r\n]+\s*/g, " "); return /[;"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const ent = somar(lista, "entrada"), sai = somar(lista, "saida");
    const nEst = lista.filter(i => i.estornado).length;
    const filtrado = tipo !== "todas" || !!forma || !!busca.trim();
    const linhas = [txt(`Extrato ${rotuloPeriodo(periodo)}`), ...(filtrado ? ["Só os lançamentos filtrados na tela"] : []), "",
      `Entradas;${num(ent)}`, `Saídas;${num(sai)}`, `Resultado (entradas − saídas);${num(ent - sai)}`,
      ...(nEst ? [`Estornados (não entram nos totais);${nEst}`] : []), "",
      "Data;Tipo;Descrição;Detalhe;Valor;Situação",
      ...lista.map(i => [i.data.split("-").reverse().join("/"), i.tipo === "entrada" ? "Entrada" : "Saída", txt(i.titulo), txt([i.subtipo, i.detalhe].filter(Boolean).join(" · ")),
        num(i.tipo === "entrada" ? i.valor : -i.valor), i.estornado ? "Estornado (não entra nos totais)" : ""].join(";"))];
    const blob = new Blob(["\ufeff" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `extrato-${periodo.ini}-a-${periodo.fim}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <AppPageHeader
        title="Transações"
        subtitle="Extrato de entradas e saídas"
        onBack={() => navigate("/financeiro")}
        infoIcon="📑"
        infoContent={<>
          <p>Aqui aparece <strong>todo o dinheiro que entrou e saiu</strong>: os recebimentos de pedidos (na data em que você recebeu), as entradas avulsas e as despesas pagas.</p>
          <p>Lançou errado? Abra o item e use <strong>Estornar</strong>: ele sai das contas, mas continua no histórico, riscado.</p>
          <p>Aqui entra <strong>todo</strong> o dinheiro, inclusive aporte e retirada. Por isso a <strong>diferença</strong> pode não bater com o Resultado do painel, que deixa esses dois de fora.</p>
        </>}
        rightActions={
          <div className="tx-hd">
            <button type="button" className="tx-hd-bt e" onClick={() => setNova("entrada")}><ArrowUp size={15} weight="bold" />Entrada</button>
            <button type="button" className="tx-hd-bt s" onClick={() => setNova("saida")}><ArrowDown size={15} weight="bold" />Saída</button>
            <button type="button" className="tx-hd-bt n" onClick={exportar}><DownloadSimple size={16} weight="bold" />Exportar</button>
          </div>
        }
      />
      {/* (4.29) mesma faixa rosa do painel: o período fica "pousado" nela */}
      <div className="tx-faixa" aria-hidden="true" />
      <EstiloFinanceiro />
      <div className="tx">
        <div className="tx-topo">
          <div className="tx-per"><PeriodoFiltro valor={periodo} onChange={setPeriodo} /></div>
          <div className="tx-bts">
            <button type="button" className="tx-bt e" onClick={() => setNova("entrada")}><i><ArrowUp size={16} weight="bold" /></i>Entrou</button>
            <button type="button" className="tx-bt s" onClick={() => setNova("saida")}><i><ArrowDown size={16} weight="bold" /></i>Saiu</button>
            <button type="button" className="tx-bt n" onClick={exportar} aria-label="Exportar planilha"><DownloadSimple size={16} weight="bold" /><span>Exportar</span></button>
          </div>
        </div>

        <div className="tx-res" style={{ ["--tx-n" as any]: Math.max(brl(entradas).length, brl(saidas).length, brl(entradas - saidas).length) }}>
          <div className="tx-k"><small>Entradas</small><b className="e">{erro ? "—" : brl(entradas)}</b></div>
          <div className="tx-k"><small>Saídas</small><b className="s">{erro ? "—" : brl(saidas)}</b></div>
          <div className="tx-k"><small>Diferença</small><b>{erro ? "—" : brl(entradas - saidas)}</b></div>
        </div>

        <div className="tx-filtros">
          <div className="tx-seg">{([["todas", "Todas"], ["entrada", "Entradas"], ["saida", "Saídas"]] as const).map(([k, l]) =>
            <button type="button" key={k} className={tipo === k ? "on" : ""} onClick={() => { setTipo(k); if (k === "saida") setForma(null); }}>{l}</button>)}</div>
          <label className="tx-busca"><MagnifyingGlass size={16} /><input type="search" aria-label="Buscar nas transações" placeholder="Buscar cliente, pedido ou despesa" value={busca} onChange={e => setBusca(e.target.value)} /></label>
          {tipo !== "saida" && <div className="tx-chips">{FORMAS.map(f => <button type="button" key={f.k} className={forma === f.k ? "on" : ""} onClick={() => setForma(x => x === f.k ? null : f.k)}>{f.l}</button>)}</div>}
        </div>

        {carregando ? <div className="tx-ph" /> : erro ? (
          <TelaVazia caixa icone={<WarningCircle size={30} />} titulo="Não deu pra carregar o extrato" texto="Confira a internet e tente de novo."
            acao={<Botao variante="suave" tamanho="m" onClick={carregar}>Tentar de novo</Botao>} />
        ) : lista.length === 0 ? (
          <div className="tx-vazio"><b>Nada por aqui {rotuloPeriodo(periodo)}</b><p>{itens.length ? "Nenhum item com esses filtros." : "Quando você receber um pedido ou lançar uma entrada ou saída, aparece aqui."}</p></div>
        ) : porDia.map((g, gi) => (
          <section key={`${g.dia}-${gi}`} className="tx-dia">
            <p className="tx-dia-t">{rotuloDia(g.dia)} <span>· {brl(g.itens.filter(i => !i.estornado).reduce((s, i) => s + (i.tipo === "entrada" ? i.valor : -i.valor), 0))}</span></p>
            <div className="tx-lista">
              {g.itens.map((i, ii) => (
                <button type="button" key={`${i.id}-${ii}`} className={`tx-it ${i.estornado ? "est" : ""}`} onClick={() => setAberto(i)}>
                  <span className={`tx-ic ${i.tipo === "entrada" ? "e" : "s"}`}>{i.tipo === "entrada" ? <ArrowUp size={15} weight="bold" /> : <ArrowDown size={15} weight="bold" />}</span>
                  <div className="tx-it-t"><b>{i.titulo}</b><small>{i.estornado ? "Estornado · " : ""}{i.subtipo}{i.detalhe && <span className="tx-so-cel"> · {i.detalhe}</span>}</small></div>
                  <span className="tx-it-c">{i.detalhe}</span>
                  <span className={`tx-it-v ${i.tipo === "entrada" ? "e" : "s"}`}>{i.tipo === "entrada" ? "+" : "−"} {brl(i.valor)}</span>
                </button>
              ))}
            </div>
          </section>
        ))}

        {qEstornados > 0 && <button type="button" className="tx-ver-est" onClick={() => setVerEstornados(v => !v)}>{verEstornados ? "Esconder estornados" : `Mostrar ${qEstornados} ${qEstornados === 1 ? "estornado" : "estornados"}`}</button>}
      </div>

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
          <b>Estornar este lançamento?</b> {m.origem === "pagamento" ? "O valor sai do caixa e o pedido volta a ter esse valor a receber." : "O valor sai das contas do caixa e do mês. Se for o pagamento de uma conta, ela volta pra A pagar."} Nada é apagado: ele continua no extrato, riscado.
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
  .tx-faixa { height: 58px; background: var(--ui-rosa); width: 100vw; margin: 0 calc(50% - 50vw); }
  @media (min-width: 901px) { .tx-faixa { width: auto; margin: 0 -2rem; } }
  .tx-per { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 16px; padding: 6px; box-shadow: 0 1px 3px rgba(42,21,32,.05); }
  .tx-per .pf-seg { background: #F4EEF1; border-radius: 12px; }
  .tx-per .pf-seg button { font-weight: 500; white-space: nowrap; }
  .tx-per .pf-seg button.on { color: var(--ui-rosa-escuro); font-weight: 600; }
  .tx-per .pf-mes { border: 0; padding: 2px; }
  .tx-per .pf-mes b { font-weight: 600; }
  .tx-hd { display: flex; align-items: center; gap: 8px; }
  .tx-hd-bt { display: flex; align-items: center; gap: 6px; min-height: 44px; border: none; border-radius: var(--ui-raio-botao); padding: 0 14px; font-family: var(--font-base); font-size: 14px; font-weight: 600; color: var(--ui-branco); cursor: pointer; white-space: nowrap; }
  .tx-hd-bt.e { background: #16A34A; } .tx-hd-bt.s { background: var(--ui-vinho-escuro); } .tx-hd-bt.n { background: var(--ui-branco); color: var(--ui-texto); }
  @media (min-width: 768px) { .tx-bts { display: none !important; } }
  @media (min-width: 900px) {
    .tx-topo .tx-per { flex: 1; }
    .tx-topo .tx-per .pf { max-width: none; }
    .tx-per .pf { flex-direction: row; align-items: center; justify-content: space-between; flex-wrap: wrap; }
    .tx-per .pf-seg { width: 420px; }
    .tx-per .pf-mes { width: 300px; }
    .tx-per .pf-datas { width: 360px; }
  }
  .tx { position: relative; max-width: 980px; margin: -58px auto 0; padding: 22px 0 96px; font-family: var(--font-base); color: var(--ui-texto); display: flex; flex-direction: column; gap: 14px; }
  .tx-topo { display: flex; flex-direction: column; gap: 10px; }
  @media (min-width: 900px) { .tx-topo { flex-direction: row; align-items: flex-start; justify-content: space-between; } .tx-topo .pf { flex: 1; max-width: 520px; } }
  .tx-bts { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; }
  /* (4.29) mesmo jeito dos botões do painel no celular */
  .tx-bt { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; border: none; border-radius: 14px; padding: 0 12px; font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .tx-bt i { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; color: var(--ui-branco); }
  .tx-bt.e { background: #ECFDF3; color: var(--ui-verde); } .tx-bt.e i { background: #16A34A; }
  .tx-bt.s { background: #FEF2F2; color: var(--ui-vermelho); } .tx-bt.s i { background: var(--ui-vermelho); }
  .tx-bt.n { background: var(--ui-branco); color: var(--ui-texto); border: 1px solid #F0EBED; width: 52px; padding: 0; }
  .tx-bt.n span { display: none; }
  .tx-res { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .tx-k { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 14px; padding: 12px 10px; min-width: 0; container-type: inline-size; }
  .tx-k small { display: block; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
  .tx-k b { display: block; font-size: clamp(13.5px, 3.9vw, 19px); font-weight: 600; letter-spacing: -.02em; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* (4.29) o valor cabe inteiro: a letra encolhe até caber (--tx-n = letras do maior valor), como em A receber */
  .tx-k b { font-size: max(10px, min(clamp(13.5px, 3.9vw, 19px), calc(100cqi / (var(--tx-n, 11) * .57)))); text-overflow: clip; }
  .tx-k b.e { color: var(--ui-verde); } .tx-k b.s { color: var(--ui-vermelho); }
  .tx-filtros { display: flex; flex-direction: column; gap: 8px; }
  @media (min-width: 900px) { .tx-filtros { flex-direction: row; align-items: center; flex-wrap: wrap; } .tx-busca { flex: 1; min-width: 240px; } }
  .tx-seg { display: flex; background: #EFE9EC; border-radius: var(--ui-raio); padding: 3px; }
  .tx-seg button { flex: 1; min-height: 44px; border: none; background: none; border-radius: var(--ui-raio-p); padding: 8px 12px; font-family: inherit; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); cursor: pointer; white-space: nowrap; }
  .tx-seg button.on { background: var(--ui-branco); color: var(--ui-texto); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .tx-busca { display: flex; align-items: center; gap: 8px; height: 48px; background: var(--ui-branco); border: 1.5px solid var(--ui-borda-campo); border-radius: var(--ui-raio); padding: 0 12px; color: var(--ui-texto-3); }
  .tx-busca input { flex: 1; min-width: 0; border: none; outline: none; font-family: inherit; font-size: 16px; color: var(--ui-texto); background: none; }
  .tx-chips { display: flex; gap: 6px; overflow-x: auto; }
  .tx-chips button { flex-shrink: 0; min-height: 42px; border: 1px solid var(--ui-borda-campo); background: var(--ui-branco); border-radius: 10px; padding: 0 14px; font-family: inherit; font-size: 13.5px; font-weight: 500; color: var(--ui-texto-2); cursor: pointer; white-space: nowrap; }
  .tx-chips button.on { border-color: var(--ui-rosa); background: #FFF1F6; color: var(--ui-rosa-escuro); font-weight: 600; }
  .tx-ph { height: 220px; background: #FAF7F8; border-radius: var(--ui-raio-cartao); }
  .tx-vazio { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: var(--ui-raio-cartao); padding: 26px 18px; text-align: center; }
  .tx-vazio b { display: block; font-size: 15.5px; font-weight: 700; } .tx-vazio p { margin: 6px auto 0; font-size: 13.5px; color: var(--ui-texto-2); max-width: 360px; line-height: 1.45; }
  .tx-dia-t { margin: 0 0 6px; font-size: 13px; font-weight: 500; color: var(--ui-texto-3); } .tx-dia-t span { color: var(--ui-texto-2); }
  .tx-lista { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: var(--ui-raio-cartao); padding: 2px 14px; }
  .tx-it { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: center; gap: 10px; width: 100%; text-align: left; background: none; border: none; border-top: 1px solid var(--ui-linha); padding: 11px 0; font-family: inherit; color: var(--ui-texto); cursor: pointer; }
  .tx-it:first-child { border-top: none; }
  @media (min-width: 900px) { .tx-it { grid-template-columns: 34px minmax(0, 1fr) 140px 130px; } }
  .tx-ic { width: 34px; height: 34px; border-radius: var(--ui-raio-p); display: flex; align-items: center; justify-content: center; }
  .tx-ic.e { background: var(--ui-verde-fundo); color: var(--ui-verde); } .tx-ic.s { background: var(--ui-vermelho-fundo); color: var(--ui-vermelho); }
  .tx-it-t b { display: block; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tx-it-t small { display: block; font-size: 12px; color: #888780; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
  .tx-it-c { display: none; font-size: 12.5px; color: var(--ui-texto-2); }
  @media (min-width: 900px) { .tx-it-c { display: block; } .tx-so-cel { display: none; } }
  .tx-it-v { font-size: 14px; font-weight: 700; white-space: nowrap; text-align: right; } .tx-it-v.e { color: var(--ui-verde); } .tx-it-v.s { color: var(--ui-vermelho); }
  .tx-it.est { opacity: .5; } .tx-it.est .tx-it-v, .tx-it.est .tx-it-t b { text-decoration: line-through; }
  .tx-ver-est { align-self: center; border: none; background: none; font-family: inherit; font-size: 13px; font-weight: 700; color: var(--ui-texto-3); cursor: pointer; padding: 8px;  min-height: 44px; }
  .tx-dl { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; font-size: 13.5px; } .tx-dl span { color: var(--ui-texto-2); } .tx-dl b { text-align: right; }
  .tx-dl b.e { color: var(--ui-verde); } .tx-dl b.s { color: var(--ui-vermelho); }
  .tx-toast { position: fixed; left: 50%; bottom: calc(90px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 1400; background: var(--ui-vinho-escuro); color: var(--ui-branco); padding: 12px 16px; border-radius: var(--ui-raio); font-size: 13.5px; font-weight: 700; box-shadow: 0 10px 26px rgba(0,0,0,.25); max-width: calc(100vw - 32px); }
`;

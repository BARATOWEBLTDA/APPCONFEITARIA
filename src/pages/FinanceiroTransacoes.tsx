// Transações — o extrato do financeiro, refeito no padrão novo (03/10).
// Período (hoje, 7 dias, mês ou datas), filtros, busca, exportar e ESTORNO em vez de apagar.
import EstiloFinanceiro from "@/components/financeiro/EstiloFinanceiro";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp, ArrowDown, MagnifyingGlass, DownloadSimple, ArrowSquareOut, ArrowCounterClockwise } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { avisar as avisarBase } from "@/components/base";
import PeriodoFiltro, { periodoInicial, rotuloPeriodo, type Periodo } from "@/components/financeiro/PeriodoFiltro";
import DespesaSheet from "@/components/financeiro/DespesaSheet";
import Folha, { FOLHA_CSS } from "@/components/financeiro/Folha";
import { supabase } from "@/lib/supabase";
import { carregarExtrato, estornar, nomeForma, type MovExtrato } from "@/lib/extrato";

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
  const [tipo, setTipo] = useState<"todas" | "entrada" | "saida">("todas");
  const [forma, setForma] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [verEstornados, setVerEstornados] = useState(false);
  const [aberto, setAberto] = useState<MovExtrato | null>(null);
  const [nova, setNova] = useState<"entrada" | "saida" | null>(null);

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUid(user.id); setCarregando(true);
    const r = await carregarExtrato(user.id, periodo.ini, periodo.fim);
    setItens(r.itens); setSemEstorno(r.semEstornoManual); setCarregando(false);
  }, [periodo]);
  useEffect(() => { carregar(); }, [carregar]);

  const ativos = itens.filter(i => !i.estornado);
  const entradas = ativos.filter(i => i.tipo === "entrada").reduce((s, i) => s + i.valor, 0);
  const saidas = ativos.filter(i => i.tipo === "saida").reduce((s, i) => s + i.valor, 0);
  const qEstornados = itens.length - ativos.length;

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter(i => (verEstornados || !i.estornado)
      && (tipo === "todas" || i.tipo === tipo)
      && (!forma || i.forma === forma)
      && (!q || `${i.titulo} ${i.detalhe}`.toLowerCase().includes(q)));
  }, [itens, tipo, forma, busca, verEstornados]);
  const porDia = useMemo(() => {
    const g: { dia: string; itens: MovExtrato[] }[] = [];
    for (const i of lista) { const u = g[g.length - 1]; if (u && u.dia === i.data) u.itens.push(i); else g.push({ dia: i.data, itens: [i] }); }
    return g;
  }, [lista]);

  const avisar = (m: string) => avisarBase(m, { tipo: /^Não /.test(m) ? "erro" : "ok" });
  const exportar = () => {
    const linhas = [`Extrato ${rotuloPeriodo(periodo)}`, "", `Entradas;${entradas.toFixed(2).replace(".", ",")}`, `Saídas;${saidas.toFixed(2).replace(".", ",")}`, `Resultado (entradas − saídas);${(entradas - saidas).toFixed(2).replace(".", ",")}`, "",
      "Data;Tipo;Descrição;Detalhe;Valor;Situação",
      ...lista.map(i => `${i.data.split("-").reverse().join("/")};${i.tipo === "entrada" ? "Entrada" : "Saída"};${i.titulo.replace(/;/g, ",")};${i.detalhe.replace(/;/g, ",")};${(i.tipo === "entrada" ? i.valor : -i.valor).toFixed(2).replace(".", ",")};${i.estornado ? "Estornado" : ""}`)];
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
          <p>Lançou errado? Toque no item e use <strong>Estornar</strong>: ele sai das contas, mas continua no histórico, riscado.</p>
        </>}
      />
      <EstiloFinanceiro />
      <div className="tx">
        <div className="tx-topo">
          <PeriodoFiltro valor={periodo} onChange={setPeriodo} />
          <div className="tx-bts">
            <button type="button" className="tx-bt e" onClick={() => setNova("entrada")}><ArrowUp size={15} weight="bold" />Entrada</button>
            <button type="button" className="tx-bt s" onClick={() => setNova("saida")}><ArrowDown size={15} weight="bold" />Despesa</button>
            <button type="button" className="tx-bt n" onClick={exportar} aria-label="Exportar planilha"><DownloadSimple size={16} weight="bold" /><span>Exportar</span></button>
          </div>
        </div>

        <div className="tx-res">
          <div className="tx-k"><small>Entradas</small><b className="e">{brl(entradas)}</b></div>
          <div className="tx-k"><small>Saídas</small><b className="s">{brl(saidas)}</b></div>
          <div className="tx-k"><small>Resultado</small><b>{brl(entradas - saidas)}</b></div>
        </div>

        <div className="tx-filtros">
          <div className="tx-seg">{([["todas", "Todas"], ["entrada", "Entradas"], ["saida", "Saídas"]] as const).map(([k, l]) =>
            <button type="button" key={k} className={tipo === k ? "on" : ""} onClick={() => { setTipo(k); if (k === "saida") setForma(null); }}>{l}</button>)}</div>
          <label className="tx-busca"><MagnifyingGlass size={16} /><input type="search" aria-label="Buscar nas transações" placeholder="Buscar cliente, pedido ou despesa" value={busca} onChange={e => setBusca(e.target.value)} /></label>
          {tipo !== "saida" && <div className="tx-chips">{FORMAS.map(f => <button type="button" key={f.k} className={forma === f.k ? "on" : ""} onClick={() => setForma(x => x === f.k ? null : f.k)}>{f.l}</button>)}</div>}
        </div>

        {carregando ? <div className="tx-ph" /> : lista.length === 0 ? (
          <div className="tx-vazio"><b>Nada por aqui {rotuloPeriodo(periodo)}</b><p>{itens.length ? "Nenhum item com esses filtros." : "Quando você receber um pedido ou lançar uma entrada ou despesa, aparece aqui."}</p></div>
        ) : porDia.map(g => (
          <section key={g.dia} className="tx-dia">
            <p className="tx-dia-t">{rotuloDia(g.dia)} <span>· {brl(g.itens.filter(i => !i.estornado).reduce((s, i) => s + (i.tipo === "entrada" ? i.valor : -i.valor), 0))}</span></p>
            <div className="tx-lista">
              {g.itens.map(i => (
                <button type="button" key={i.id} className={`tx-it ${i.estornado ? "est" : ""}`} onClick={() => setAberto(i)}>
                  <span className={`tx-ic ${i.tipo === "entrada" ? "e" : "s"}`}>{i.tipo === "entrada" ? <ArrowUp size={15} weight="bold" /> : <ArrowDown size={15} weight="bold" />}</span>
                  <div className="tx-it-t"><b>{i.titulo}</b><small>{i.estornado ? "Estornado · " : ""}{i.detalhe}</small></div>
                  <span className="tx-it-c">{i.origem === "pagamento" ? nomeForma(i.forma) : (i.categoria || "")}</span>
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
      {nova && uid && <DespesaSheet tipo={nova} onClose={() => setNova(null)} onSalvo={() => { setNova(null); avisar(nova === "entrada" ? "Entrada lançada." : "Despesa lançada."); carregar(); }} onContaAPagar={() => navigate("/financeiro/a-pagar")} />}
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
    <Folha titulo={m.titulo} sub={m.estornado ? "Este lançamento foi estornado" : (m.tipo === "entrada" ? "Entrada" : "Saída")} onClose={onClose}>
      <div className="fo-dica" style={{ marginTop: 12 }}>
        <div className="tx-dl"><span>Valor</span><b className={m.tipo === "entrada" ? "e" : "s"}>{m.tipo === "entrada" ? "+" : "−"} {brl(m.valor)}</b></div>
        <div className="tx-dl"><span>Data</span><b>{d}/{mm}/{y}</b></div>
        {m.detalhe && <div className="tx-dl"><span>{m.origem === "pagamento" ? "Cliente e forma" : "Categoria"}</span><b>{m.detalhe}</b></div>}
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
  .tx { max-width: 980px; margin: 0 auto; padding: 22px 0 96px; font-family: var(--font-base); color: #2C1219; display: flex; flex-direction: column; gap: 14px; }
  .tx-topo { display: flex; flex-direction: column; gap: 10px; }
  @media (min-width: 900px) { .tx-topo { flex-direction: row; align-items: flex-start; justify-content: space-between; } .tx-topo .pf { flex: 1; max-width: 520px; } }
  .tx-bts { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; }
  .tx-bt { display: flex; align-items: center; justify-content: center; gap: 6px; border: none; border-radius: 12px; padding: 11px 14px; font-family: inherit; font-size: 13.5px; font-weight: 800; cursor: pointer; white-space: nowrap; }
  .tx-bt.e { background: #16A34A; color: #fff; } .tx-bt.s { background: #2C1219; color: #fff; } .tx-bt.n { background: #fff; color: #2C1219; border: 1.5px solid #EDE6E9; }
  @media (max-width: 420px) { .tx-bt.n span { display: none; } }
  .tx-res { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .tx-k { background: #fff; border: 1px solid #F0EBED; border-radius: 14px; padding: 12px 10px; min-width: 0; }
  .tx-k small { display: block; font-size: 13px; font-weight: 700; color: #9A8E94; }
  .tx-k b { display: block; font-size: clamp(13.5px, 3.9vw, 19px); font-weight: 900; letter-spacing: -.02em; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tx-k b.e { color: #15803D; } .tx-k b.s { color: #DC2626; }
  .tx-filtros { display: flex; flex-direction: column; gap: 8px; }
  @media (min-width: 900px) { .tx-filtros { flex-direction: row; align-items: center; flex-wrap: wrap; } .tx-busca { flex: 1; min-width: 240px; } }
  .tx-seg { display: flex; background: #EFE9EC; border-radius: 12px; padding: 3px; }
  .tx-seg button { flex: 1; min-height: 44px; border: none; background: none; border-radius: 10px; padding: 8px 12px; font-family: inherit; font-size: 13px; font-weight: 800; color: #6B5D64; cursor: pointer; }
  .tx-seg button.on { background: #fff; color: #2C1219; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .tx-busca { display: flex; align-items: center; gap: 8px; height: 48px; background: #fff; border: 1.5px solid #EDE6E9; border-radius: 12px; padding: 0 12px; color: #9A8E94; }
  .tx-busca input { flex: 1; min-width: 0; border: none; outline: none; font-family: inherit; font-size: 16px; color: #2C1219; background: none; }
  .tx-chips { display: flex; gap: 6px; overflow-x: auto; }
  .tx-chips button { flex-shrink: 0; min-height: 44px; border: 1.5px solid #EDE6E9; background: #fff; border-radius: 99px; padding: 7px 14px; font-family: inherit; font-size: 14px; font-weight: 700; color: #4B3A42; cursor: pointer; }
  .tx-chips button.on { border-color: #E85A8C; background: #FFF1F6; color: #C33A6E; }
  .tx-ph { height: 220px; background: #FAF7F8; border-radius: 16px; }
  .tx-vazio { background: #fff; border: 1px solid #F0EBED; border-radius: 16px; padding: 26px 18px; text-align: center; }
  .tx-vazio b { display: block; font-size: 15.5px; font-weight: 900; } .tx-vazio p { margin: 6px auto 0; font-size: 13.5px; color: #6B5D64; max-width: 360px; line-height: 1.45; }
  .tx-dia-t { margin: 0 0 6px; font-size: 13px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: #9A8E94; } .tx-dia-t span { color: #6B5D64; }
  .tx-lista { background: #fff; border: 1px solid #F0EBED; border-radius: 16px; padding: 2px 14px; }
  .tx-it { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: center; gap: 10px; width: 100%; text-align: left; background: none; border: none; border-top: 1px solid #F5F0F2; padding: 11px 0; font-family: inherit; color: #2C1219; cursor: pointer; }
  .tx-it:first-child { border-top: none; }
  @media (min-width: 900px) { .tx-it { grid-template-columns: 34px minmax(0, 1fr) 140px 130px; } }
  .tx-ic { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
  .tx-ic.e { background: #DCFCE7; color: #15803D; } .tx-ic.s { background: #FEE2E2; color: #DC2626; }
  .tx-it-t b { display: block; font-size: 14px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tx-it-t small { display: block; font-size: 12px; color: #888780; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
  .tx-it-c { display: none; font-size: 12.5px; color: #6B5D64; }
  @media (min-width: 900px) { .tx-it-c { display: block; } }
  .tx-it-v { font-size: 14px; font-weight: 900; white-space: nowrap; text-align: right; } .tx-it-v.e { color: #15803D; } .tx-it-v.s { color: #DC2626; }
  .tx-it.est { opacity: .5; } .tx-it.est .tx-it-v, .tx-it.est .tx-it-t b { text-decoration: line-through; }
  .tx-ver-est { align-self: center; border: none; background: none; font-family: inherit; font-size: 13px; font-weight: 800; color: #9A8E94; cursor: pointer; padding: 8px;  min-height: 44px; }
  .tx-dl { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; font-size: 13.5px; } .tx-dl span { color: #6B5D64; } .tx-dl b { text-align: right; }
  .tx-dl b.e { color: #15803D; } .tx-dl b.s { color: #DC2626; }
  .tx-toast { position: fixed; left: 50%; bottom: calc(90px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 1400; background: #2C1219; color: #fff; padding: 12px 16px; border-radius: 12px; font-size: 13.5px; font-weight: 700; box-shadow: 0 10px 26px rgba(0,0,0,.25); max-width: calc(100vw - 32px); }
`;

import CampoData from '@/components/CampoData'
import { useTravarRolagem } from "@/hooks/useTravarRolagem";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useAoVoltar, useDiaAtual } from "@/hooks/useAoVoltar";
import EstiloFinanceiro from "@/components/financeiro/EstiloFinanceiro";
import { mascaraBRL, textoBRL } from "@/lib/moeda";
import Folha from "@/components/financeiro/Folha";
import { useNavigate } from "react-router-dom";
import { CalendarBlank, CheckCircle, ArrowSquareOut, MagnifyingGlass, Wallet, WarningCircle, X } from "@phosphor-icons/react";
import GavetaFiltro, { BotaoFiltro } from "@/components/base/GavetaFiltro";
import AppPageHeader from "@/components/AppPageHeader";
import { COMO_A_RECEBER, TOUR_A_RECEBER } from "@/lib/comoTelas";
import { Botao, TelaVazia, avisar as avisarBase } from "@/components/base";
import { erroDeConexao } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import { carregarAReceber, isoDia, type ItemReceber } from "@/lib/contasReceber";
import { CSS_A_RECEBER as CSS } from "@/components/financeiro/aReceberCss";
import { registrarPagamento, normalizarForma } from "@/lib/pagamentos";

/**
 * Financeiro · Passo 2 (03/10) — Contas a receber.
 * Pedidos não cancelados com saldo (total − recebido). Derivado dos pedidos (sem tabela própria);
 * o "Receber" registra um pagamento (Passo 1), e o banco atualiza o recebido do pedido.
 * A data usada pra agrupar é a combinada pro pagamento ou, sem ela, a da entrega.
 */
type Item = ItemReceber;

// 10/10: dinheiro sempre com centavos (antes "Total R$ 245" ao lado de "falta R$ 245,00")
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const isoHoje = () => isoDia(0);
const isoMais = (n: number) => isoDia(n);
const dataCurta = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", ""); };
const quando = (dias: number | null) => dias === null ? "sem data" : dias === 0 ? "hoje" : dias === 1 ? "amanhã" : dias > 1 ? `em ${dias} dias` : dias === -1 ? "atrasado 1 dia" : `atrasado ${-dias} dias`;
const FORMAS = [{ k: "pix", l: "Pix" }, { k: "dinheiro", l: "Dinheiro" }, { k: "credito", l: "Crédito" }, { k: "debito", l: "Débito" }];

export default function FinanceiroAReceber() {
  const navigate = useNavigate();
  const [itens, setItens] = useState<Item[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false); // não deu pra carregar (10/10)
  const [receber, setReceber] = useState<Item | null>(null);

  // 10/10: se a busca falhar, a tela avisa (antes aparecia "Nada a receber agora"); e só vale a resposta da última busca
  const numBusca = useRef(0);
  const carregouBem = useRef(false);
  const carregar = useCallback(async (semPiscar?: unknown) => {
    const n = ++numBusca.current;
    // (11/10) atualização por trás (ao voltar pro app) que falha mantém a lista que já está na tela
    const quieto = semPiscar === true && carregouBem.current;
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (n !== numBusca.current) return;
      if (!user) { if (erroDeConexao(error) && !quieto) { setErro(true); setCarregando(false); } return; }
      const r = await carregarAReceber(user.id); // regra única (Passos 2 e 6)
      if (n !== numBusca.current) return;
      if (r.erro && quieto) return;
      setItens(r.itens); setErro(r.erro);
      if (!r.erro) carregouBem.current = true;
    } catch (e) {
      console.error("[a receber] não consegui carregar:", e);
      if (n !== numBusca.current || quieto) return;
      setItens([]); setErro(true);
    }
    setCarregando(false);
  }, []);
  // 11/10: app aberto de um dia pro outro. Virou o dia ou a pessoa voltou pro app: busca de novo
  // (o "atrasado 2 dias" de cada pedido é calculado na busca) e refaz os grupos com o dia de agora.
  const hoje = useDiaAtual();
  useEffect(() => { carregar(); }, [carregar, hoje]);
  useAoVoltar(() => { carregar(true); });
  const tentarDeNovo = () => { setCarregando(true); carregar(); };

  // (24/10) busca (cliente ou número do pedido) e o filtro padrão da lateral
  const [busca, setBusca] = useState("");
  const [mostrar, setMostrar] = useState<"todos" | "atrasados" | "semana" | "depois">("todos");
  const [filtroAberto, setFiltroAberto] = useState(false);
  const buscados = useMemo(() => {
    const q = busca.trim().toLowerCase().replace(/^#/, "");
    return q ? itens.filter(it => `${it.cliente_nome || ""} ${it.numero ?? ""}`.toLowerCase().includes(q)) : itens;
  }, [itens, busca]);
  const grupos = useMemo(() => {
    const em7 = isoMais(6);
    const g = { atrasados: [] as Item[], semana: [] as Item[], depois: [] as Item[], semData: [] as Item[] };
    for (const it of buscados) {
      if (!it.dataRef) g.semData.push(it);
      else if (it.dataRef < hoje) g.atrasados.push(it);
      else if (it.dataRef <= em7) g.semana.push(it);
      else g.depois.push(it);
    }
    return g;
  }, [buscados, hoje]);
  const soma = (l: Item[]) => l.reduce((s, x) => s + x.falta, 0);
  const total = soma(itens);
  // 11/10: os 3 valores do resumo usam a mesma letra, do tamanho em que o MAIOR cabe inteiro (em 360 px "R$ 105.302,13" virava "R$ 105.30…")
  const resumo = [brl(soma(grupos.atrasados)), brl(soma(grupos.semana)), brl(soma(grupos.depois) + soma(grupos.semData))];
  const letrasDoMaior = Math.max(...resumo.map(v => v.length));

  return (
    <div className="far-root">
      <AppPageHeader
        title="A receber"
        subtitle={carregando ? "Carregando…" : erro ? "Não deu para carregar" : itens.length ? `${brl(total)} em ${itens.length} ${itens.length === 1 ? "pedido" : "pedidos"}` : "Tudo recebido por aqui"}
        onBack={() => navigate("/financeiro")}
        infoIcon="💰" infoComo={COMO_A_RECEBER} infoTour={TOUR_A_RECEBER}
        infoContent={<>
          <p>Aqui ficam os <strong>pedidos que ainda têm valor a receber</strong>: o total menos o que já entrou (sinal, parcelas…).</p>
          <p>Use <strong>Receber</strong> quando o cliente pagar. O valor entra no financeiro na data que você escolher, e o pedido sai daqui quando estiver quitado.</p>
        </>}
      />
      <EstiloFinanceiro />

      <div className="far-wrap">
        {!carregando && itens.length > 0 && (
          <div className="far-resumo" style={{ "--far-n": letrasDoMaior } as CSSProperties}>
            {/* 10/10: valor zerado fica neutro (cinza), não no laranja de alerta */}
            <div className={`far-k ${soma(grupos.atrasados) > 0 ? "far-k--atr" : "far-k--zero"}`}><small>Atrasados</small><b>{resumo[0]}</b><i>{grupos.atrasados.length} {grupos.atrasados.length === 1 ? "pedido" : "pedidos"}</i></div>
            <div className={`far-k ${soma(grupos.semana) > 0 ? "" : "far-k--zero"}`}><small>Em 7 dias</small><b>{resumo[1]}</b><i>{grupos.semana.length} {grupos.semana.length === 1 ? "pedido" : "pedidos"}</i></div>
            <div className={`far-k ${soma(grupos.depois) + soma(grupos.semData) > 0 ? "" : "far-k--zero"}`}><small>Depois</small><b>{resumo[2]}</b><i>{grupos.depois.length + grupos.semData.length} {grupos.depois.length + grupos.semData.length === 1 ? "pedido" : "pedidos"}</i></div>
          </div>
        )}

        {!carregando && itens.length > 0 && (
          <div className="far-bb">
            <label className="far-busca"><MagnifyingGlass size={18} /><input type="search" aria-label="Buscar cliente ou número do pedido" placeholder="Buscar cliente ou número" value={busca} onChange={e => setBusca(e.target.value)} />
              {busca && <button type="button" aria-label="Limpar a busca" onClick={() => setBusca("")}><X size={16} weight="bold" /></button>}</label>
            <BotaoFiltro className="far-filtro" ativos={mostrar === "todos" ? 0 : 1} onClick={() => setFiltroAberto(true)} />
          </div>
        )}
        {filtroAberto && <GavetaFiltro valor={{ mostrar }} padrao={{ mostrar: "todos" }}
          grupos={[{ id: "mostrar", titulo: "Mostrar", tipo: "radio", opcoes: [
            { k: "todos", label: "Todos", n: buscados.length },
            { k: "atrasados", label: "Atrasados", n: grupos.atrasados.length, cor: "var(--ui-vermelho)" },
            { k: "semana", label: "Próximos 7 dias", n: grupos.semana.length },
            { k: "depois", label: "Depois", n: grupos.depois.length + grupos.semData.length },
          ] }]}
          contar={v => v.mostrar === "todos" ? buscados.length : v.mostrar === "depois" ? grupos.depois.length + grupos.semData.length : grupos[v.mostrar as "atrasados" | "semana"].length}
          rotulo={n => n === 0 ? "Nenhum pedido" : `Ver ${n} ${n === 1 ? "pedido" : "pedidos"}`}
          aoAplicar={v => setMostrar(v.mostrar)} aoFechar={() => setFiltroAberto(false)} />}
        {!carregando && itens.length > 0 && buscados.length === 0 && <p className="far-semres">Nenhum pedido com essa busca.</p>}

        {carregando && <p className="far-carregando">Carregando…</p>}

        {!carregando && erro && (
          <TelaVazia caixa icone={<WarningCircle size={30} />} titulo="Não deu para carregar o que falta receber" texto="Confira a internet e tente de novo."
            acao={<Botao variante="suave" tamanho="m" onClick={tentarDeNovo}>Tentar de novo</Botao>} />
        )}

        {!carregando && !erro && itens.length === 0 && (
          <div className="far-vazio">
            <span className="far-vazio-ic"><CheckCircle size={34} weight="duotone" /></span>
            <b>Nada a receber agora</b>
            <p>Todos os pedidos estão pagos. Quando um pedido tiver sinal ou ficar para pagar depois, o valor que falta aparece aqui.</p>
          </div>
        )}

        {([["Atrasados", grupos.atrasados, "atrasados"], ["Próximos 7 dias", grupos.semana, "semana"], ["Depois", grupos.depois, "depois"], ["Sem data combinada", grupos.semData, "depois"]] as [string, Item[], string][])
          .filter(([, l, k]) => l.length > 0 && (mostrar === "todos" || mostrar === k))
          .map(([titulo, lista]) => (
            <section key={titulo} className="far-grupo">
              {/* "Atrasados" e "Próximos 7 dias" já têm o valor no card de cima: não repete */}
              <p className="far-gt">{titulo}{titulo === "Atrasados" || titulo === "Próximos 7 dias" ? null : <span> · {brl(soma(lista))}</span>}</p>
              <div className="far-lista">
                {lista.map(it => (
                  <div key={it.id} className="far-it">
                    <div className="far-it-h">
                      <b>{it.numero ? `Pedido #${it.numero} · ` : ""}{it.cliente_nome || "Cliente"}</b>
                      <span className={`far-tg ${it.dias !== null && it.dias < 0 ? "far-tg--atr" : ""}`}>{quando(it.dias)}</span>
                    </div>
                    <div className="far-it-v">
                      <small>{it.recebido > 0 ? `Pago ${brl(it.recebido)}` : `Total ${brl(it.total)}`}</small>
                      <b>falta {brl(it.falta)}</b>
                    </div>
                    <div className="far-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (it.recebido / (it.total || 1)) * 100)}%` }} /></div>
                    <div className="far-it-a">
                      <span><CalendarBlank size={15} />{it.data_entrega ? `entrega ${dataCurta(it.data_entrega)}` : "sem data"}</span>
                      <div className="far-bts">
                        <button type="button" className="far-ver" onClick={() => navigate(`/pedidos/${it.id}/editar`)} aria-label={`Abrir o pedido${it.numero ? ` #${it.numero}` : ""}`}><ArrowSquareOut size={16} aria-hidden="true" /><span>Abrir</span></button>
                        <button type="button" className="far-rec" onClick={() => setReceber(it)}>Receber</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* (22/10) computador: tabela (como em Pedidos), cabe tudo numa tela. O celular continua com os cartões */}
              <div className="far-tab" role="table" aria-label={titulo}>
                <div className="far-tr far-th" role="row"><span role="columnheader">Pedido</span><span role="columnheader">Entrega</span><span role="columnheader">Total</span><span role="columnheader">Pago</span><span role="columnheader">Falta</span><span role="columnheader" aria-label="Ações" /></div>
                {lista.map(it => (
                  <div key={it.id} className="far-tr" role="row">
                    <span role="cell" className="far-td-p"><b>{it.cliente_nome || "Cliente"}</b>{it.numero ? <em>#{it.numero}</em> : null}<span className={`far-tg ${it.dias !== null && it.dias < 0 ? "far-tg--atr" : ""}`}>{quando(it.dias)}</span></span>
                    <span role="cell">{it.data_entrega ? (d => d.charAt(0).toUpperCase() + d.slice(1))(dataCurta(it.data_entrega)) : "Sem data"}</span>
                    <span role="cell">{brl(it.total)}</span>
                    <span role="cell" className="far-td-pg">{brl(it.recebido)}<i className="far-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (it.recebido / (it.total || 1)) * 100)}%` }} /></i></span>
                    <span role="cell" className="far-td-f">{brl(it.falta)}</span>
                    <span role="cell" className="far-bts">
                      <button type="button" className="far-ver" onClick={() => navigate(`/pedidos/${it.id}/editar`)} aria-label={`Abrir o pedido${it.numero ? ` #${it.numero}` : ""}`}><span>Abrir</span></button>
                      <button type="button" className="far-rec" onClick={() => setReceber(it)}>Receber</button>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
      </div>

      {receber && <ReceberSheet item={receber} onClose={() => setReceber(null)}
        onFeito={async (msg) => { setReceber(null); avisarBase(msg, { tipo: "ok" }); await carregar(); }} />}

      <style>{CSS}</style>
    </div>
  );
}

/** Janela "Quanto você recebeu agora?" — registra um pagamento (Passo 1). */
export function ReceberSheet({ item, onClose, onFeito }: { item: Item; onClose: () => void; onFeito: (msg: string) => void }) {
  const [valor, setValor] = useState(textoBRL(item.falta));
  const [forma, setForma] = useState(normalizarForma(item.forma_pagamento) || "pix");
  const [quandoRec, setQuandoRec] = useState<"hoje" | "ontem" | "outra">("hoje");
  const [outraData, setOutraData] = useState(isoHoje());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const v = Math.round((parseFloat(valor.replace(/\./g, "").replace(",", ".")) || 0) * 100) / 100;
  const resta = Math.max(0, Math.round((item.falta - v) * 100) / 100);
  const confirmar = async () => {
    if (v <= 0) { setErro("Digite quanto você recebeu"); return; }
    if (v > item.falta + 0.009) { setErro(`O valor passa do que falta (${brl(item.falta)})`); return; }
    const data = quandoRec === "hoje" ? isoHoje() : quandoRec === "ontem" ? isoMais(-1) : outraData;
    if (!data || data > isoHoje()) { setErro("Escolha uma data até hoje"); return; }
    setSalvando(true); setErro("");
    const r = await registrarPagamento({
      pedidoId: item.id, valor: v, forma, recebidoEm: data,
      tipo: v >= item.falta - 0.009 ? (item.recebido > 0 ? "restante" : "total") : (item.recebido > 0 ? "parcial" : "sinal"), // o 1º valor antes de quitar é o sinal
    });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro || "Não foi possível registrar agora. Confira a internet e tente de novo."); return; }
    onFeito(resta > 0 ? `Recebido ${brl(v)}. Ainda faltam ${brl(resta)}.` : item.numero ? `Pedido #${item.numero} quitado.` : "Pedido quitado.");
  };

  return (
    <Folha titulo={`Receber${item.numero ? ` · Pedido #${item.numero}` : ""}`} sub={item.cliente_nome || "Cliente"} onClose={onClose} umaAcao
      acoes={<Botao cheio icone={<Wallet size={20} weight="bold" />} carregando={salvando} onClick={confirmar}>Confirmar recebimento</Botao>}>
      <div className="far-res">
        <div><span>Total do pedido</span><b>{brl(item.total)}</b></div>
        {item.recebido > 0 && <div><span>Já recebido</span><b className="ok">{brl(item.recebido)}</b></div>}
        <div className="tt"><span>Falta receber</span><b>{brl(item.falta)}</b></div>
      </div>
      <label className="fo-lb" htmlFor="far-valor">Quanto você recebeu agora?</label>
      <div className="fo-in"><span>R$</span><input id="far-valor" inputMode="numeric" value={valor} onChange={e => { setValor(mascaraBRL(e.target.value)); setErro(""); }} /></div>
      <p className="fo-lb">Forma de pagamento</p>
      <div className="fo-chips">{FORMAS.map(f => <button type="button" key={f.k} className={forma === f.k ? "on" : ""} onClick={() => setForma(f.k)}>{f.l}</button>)}</div>
      <p className="fo-lb">Quando recebeu?</p>
      <div className="fo-chips">
        {(["hoje", "ontem", "outra"] as const).map(q => <button type="button" key={q} className={quandoRec === q ? "on" : ""} onClick={() => setQuandoRec(q)}>{q === "hoje" ? "Hoje" : q === "ontem" ? "Ontem" : "Outra data"}</button>)}
      </div>
      {quandoRec === "outra" && <div style={{ marginTop: 8 }}><CampoData valor={outraData} onChange={setOutraData} max={isoHoje()} titulo="Data do recebimento" /></div>}
      {v > 0 && v <= item.falta + 0.009 && (
        <div className={`far-prev ${resta > 0 ? "" : "far-prev--ok"}`}>
          {resta > 0 ? <><b>Ainda vai faltar: {brl(resta)}</b><small>Continua em "A receber" até você registrar o restante.</small></>
                     : <><b>O pedido fica quitado</b><small>{brl(v)} entram no financeiro.</small></>}
        </div>
      )}
      {erro && <p className="fo-erro">{erro}</p>}
      <style>{CSS}</style>
    </Folha>
  );
}


import CampoData from '@/components/CampoData'
import { useTravarRolagem } from "@/hooks/useTravarRolagem";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useAoVoltar, useDiaAtual } from "@/hooks/useAoVoltar";
import EstiloFinanceiro from "@/components/financeiro/EstiloFinanceiro";
import { mascaraBRL, textoBRL } from "@/lib/moeda";
import Folha from "@/components/financeiro/Folha";
import { useNavigate } from "react-router-dom";
import { CalendarBlank, CheckCircle, ArrowSquareOut, Wallet, WarningCircle } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { COMO_A_RECEBER, TOUR_A_RECEBER } from "@/lib/comoTelas";
import { Botao, TelaVazia, avisar as avisarBase } from "@/components/base";
import { erroDeConexao } from "@/lib/erros";
import { supabase } from "@/lib/supabase";
import { carregarAReceber, isoDia, type ItemReceber } from "@/lib/contasReceber";
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

  const grupos = useMemo(() => {
    const em7 = isoMais(6);
    const g = { atrasados: [] as Item[], semana: [] as Item[], depois: [] as Item[], semData: [] as Item[] };
    for (const it of itens) {
      if (!it.dataRef) g.semData.push(it);
      else if (it.dataRef < hoje) g.atrasados.push(it);
      else if (it.dataRef <= em7) g.semana.push(it);
      else g.depois.push(it);
    }
    return g;
  }, [itens, hoje]);
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

        {([["Atrasados", grupos.atrasados], ["Próximos 7 dias", grupos.semana], ["Depois", grupos.depois], ["Sem data combinada", grupos.semData]] as [string, Item[]][])
          .filter(([, l]) => l.length > 0)
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
                      <span><CalendarBlank size={15} />{it.data_entrega ? `entrega ${dataCurta(it.data_entrega)}` : "sem data de entrega"}</span>
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

const CSS = `
  .far-root { font-family: var(--font-base); }
  /* 10/10: mesma largura de conteúdo de Transações (antes 760px, em uma coluna estreita no PC) */
  .far-wrap { max-width: 980px; margin: 0 auto; padding: 22px 0 96px; display: flex; flex-direction: column; gap: 20px; }
  .far-resumo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .far-k { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 14px; padding: 12px 10px; min-width: 0; container-type: inline-size; }
  .far-k small { display: block; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
  .far-k b { display: block; font-size: clamp(13.5px, 3.9vw, 17px); letter-spacing: -.02em; font-weight: 700; color: var(--ui-laranja); margin: 3px 0 1px; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* 11/10: o valor cabe inteiro. A letra encolhe até caber na largura do cartão (--far-n = letras do maior valor;
     0,57 = largura média de cada letra de um valor em reais na Geist Bold). Nunca passa do tamanho de antes nem fica menor que 10px. */
  .far-k b { font-size: max(10px, min(clamp(13.5px, 3.9vw, 17px), calc(100cqi / (var(--far-n, 11) * .57)))); }
  .far-k i { font-style: normal; font-size: 13px; color: #888780; }
  .far-k--atr { border-color: #FECACA; background: #FFF7F7; } .far-k--atr b { color: var(--ui-vermelho); }
  .far-k--zero b { color: var(--ui-texto-3); }
  .far-carregando { text-align: center; color: var(--ui-texto-3); font-size: 14px; padding: 30px 0; }
  .far-vazio { background: var(--ui-branco); border-radius: var(--ui-raio-cartao); padding: 30px 20px; text-align: center; border: 1px solid #F0EBED; }
  .far-vazio-ic { width: 64px; height: 64px; border-radius: 20px; background: #F0FDF4; color: #16A34A; display: inline-flex; align-items: center; justify-content: center; }
  .far-vazio b { display: block; font-size: 17px; font-weight: 700; margin-top: 12px; color: var(--ui-texto); }
  .far-vazio p { font-size: 13.5px; color: var(--ui-texto-2); line-height: 1.45; margin: 6px auto 0; max-width: 360px; text-wrap: balance; }
  .far-gt { margin: 0 0 8px; font-size: 13px; font-weight: 500; color: var(--ui-texto-3); }
  .far-gt span { color: var(--ui-texto-2); }
  .far-lista { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .far-tab { display: none; }
  @media (min-width: 901px) {
    .far-grupo .far-lista { display: none; }
    .far-tab { display: block; overflow: hidden; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: 16px; box-shadow: var(--ui-sombra-cartao); }
    .far-tr { display: grid; grid-template-columns: minmax(0, 2.3fr) minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr) 168px; align-items: center; gap: 12px; min-height: 56px; padding: 0 16px; font-size: 13.5px; color: var(--ui-texto); }
    .far-tr + .far-tr { border-top: 1px solid var(--ui-linha); }
    .far-th { min-height: 38px; background: #FAFAFA; font-size: 12px; font-weight: 500; color: var(--ui-texto-2); }
    .far-td-p { display: flex; align-items: center; gap: 6px; min-width: 0; white-space: nowrap; }
    .far-td-p b { overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
    .far-td-p em { flex: none; font-style: normal; font-size: 12.5px; color: var(--ui-texto-2); }
    .far-td-p .far-tg { flex: none; margin-left: 4px; }
    .far-td-pg { display: flex; flex-direction: column; gap: 4px; }
    .far-td-pg .far-bar { display: block; width: 90px; margin: 0; }
    .far-td-f { font-weight: 700; color: var(--ui-laranja); white-space: nowrap; }
    .far-tr .far-bts { justify-content: flex-end; }
  }
  @media (min-width: 900px) { .far-lista { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .far-it { min-width: 0; background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 14px; padding: 14px; }
  .far-it-h { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .far-it-h b { font-size: 14.5px; font-weight: 700; color: var(--ui-texto); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .far-tg { flex-shrink: 0; font-size: 12px; font-weight: 700; color: #92400E; background: var(--ui-laranja-fundo); padding: 3px 8px; border-radius: 7px; }
  .far-tg--atr { color: var(--ui-vermelho-escuro); background: var(--ui-vermelho-fundo); }
  .far-it-v { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-top: 6px; }
  .far-it-v small { font-size: 12.5px; color: #888780; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; } /* em uma linha só */
  .far-it-v b { font-size: 15.5px; font-weight: 700; color: var(--ui-laranja); white-space: nowrap; }
  .far-bar { height: 6px; border-radius: 9px; background: var(--ui-linha); margin-top: 9px; overflow: hidden; }
  .far-bar i { display: block; height: 100%; background: #22C55E; border-radius: 9px; }
  .far-it-a { display: flex; justify-content: space-between; align-items: center; margin-top: 11px; gap: 8px; }
  @media (max-width: 360px) { .far-ver span { display: none; } .far-ver { padding: 0; } }
  .far-it-a > span { display: flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--ui-texto-2); }
  .far-bts { display: flex; gap: 6px; }
  .far-ver { min-width: 44px; height: 44px; padding: 0 12px; gap: 6px; font-family: inherit; font-size: 13.5px; font-weight: 700; flex-shrink: 0; border-radius: var(--ui-raio-p); border: 1.5px solid var(--ui-borda-campo); background: var(--ui-branco); color: var(--ui-texto-2); display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .far-rec { border: none; border-radius: var(--ui-raio-p); padding: 0 16px; height: 44px; background: #16A34A; color: var(--ui-branco); font-family: inherit; font-weight: 700; font-size: 13.5px; cursor: pointer; }
  .far-ov { position: fixed; inset: 0; z-index: 1300; background: rgba(45,31,38,.5); display: flex; align-items: flex-end; justify-content: center; font-family: var(--font-base); }
  @media (min-width: 768px) { .far-ov { align-items: center; } }
  .far-sh { width: 100%; max-width: 460px; background: var(--ui-branco); border-radius: var(--ui-raio-janela) var(--ui-raio-janela) 0 0; padding: 10px 18px calc(20px + env(safe-area-inset-bottom, 0px)); max-height: 92dvh; overflow-y: auto; color: var(--ui-texto); animation: farSobe .22s ease; }
  @media (min-width: 768px) { .far-sh { border-radius: 22px; } }
  @keyframes farSobe { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
  .far-alca { display: block; width: 40px; height: 4px; border-radius: 9px; background: #E5DDE1; margin: 0 auto 12px; }
  .far-sh-t { display: block; font-size: 19px; font-weight: 700; }
  .far-sh-s { display: block; font-size: 13px; color: var(--ui-texto-2); margin: 2px 0 12px; }
  .far-res { background: #FAF7F8; border-radius: var(--ui-raio); padding: 8px 12px; }
  .far-res div { display: flex; justify-content: space-between; font-size: 14px; padding: 4px 0; color: var(--ui-cinza-texto); }
  .far-res b { font-weight: 700; color: var(--ui-texto); } .far-res b.ok { color: var(--ui-verde); }
  .far-res .tt { border-top: 1px solid #F0EBED; margin-top: 4px; padding-top: 8px; font-size: 15px; }
  .far-lb { display: block; font-size: 13px; font-weight: 700; color: var(--ui-cinza-texto); margin: 14px 0 6px; }
  .far-in { display: flex; align-items: center; gap: 6px; border: 1.5px solid var(--ui-rosa); border-radius: var(--ui-raio); padding: 0 12px; height: 52px; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .far-in span { font-size: 18px; color: var(--ui-texto-2); font-weight: 700; }
  .far-in input { flex: 1; min-width: 0; border: none; outline: none; font-family: inherit; font-size: 22px; font-weight: 700; color: var(--ui-texto); background: none; }
  .far-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .far-chips button { border: 1.5px solid var(--ui-borda-campo); background: var(--ui-branco); border-radius: var(--ui-raio-p); padding: 9px 13px; font-family: inherit; font-size: 13.5px; font-weight: 700; color: var(--ui-texto); cursor: pointer; }
  .far-chips button.on { border-color: var(--ui-rosa); background: #FFF1F6; color: var(--ui-rosa-escuro); }
  .far-data { margin-top: 8px; width: 100%; min-width: 0; max-width: 100%; -webkit-appearance: none; appearance: none; background: var(--ui-branco); height: 46px; border: 1.5px solid var(--ui-borda-campo); border-radius: var(--ui-raio); padding: 0 12px; font-family: inherit; font-size: 16px; }
  .far-prev { margin-top: 14px; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: var(--ui-raio); padding: 10px 12px; }
  .far-prev b { display: block; font-size: 14px; color: #92400E; } .far-prev small { font-size: 13px; color: #92400E; }
  .far-prev--ok { background: #F0FDF4; border-color: #BBF7D0; } .far-prev--ok b, .far-prev--ok small { color: #166534; }
  .far-erro { margin: 10px 0 0; font-size: 13px; font-weight: 700; color: var(--ui-vermelho); }
  .far-cta { margin-top: 16px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; border: none; border-radius: var(--ui-raio-botao); padding: 15px; background: #16A34A; color: var(--ui-branco); font-family: inherit; font-size: 15.5px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(22,163,74,.3); }
  .far-cta:disabled { opacity: .6; cursor: default; }
  .far-toast { position: fixed; left: 50%; bottom: calc(90px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 1400; background: var(--ui-vinho-escuro); color: var(--ui-branco); padding: 12px 16px; border-radius: var(--ui-raio); font-size: 13.5px; font-weight: 700; box-shadow: 0 10px 26px rgba(0,0,0,.25); max-width: calc(100vw - 32px); }
`;

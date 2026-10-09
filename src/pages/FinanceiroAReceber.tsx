import CampoData from '@/components/CampoData'
import { useTravarRolagem } from "@/hooks/useTravarRolagem";
import { useCallback, useEffect, useMemo, useState } from "react";
import EstiloFinanceiro from "@/components/financeiro/EstiloFinanceiro";
import { mascaraBRL, textoBRL } from "@/lib/moeda";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { CalendarBlank, CheckCircle, ArrowSquareOut, Wallet } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { avisar as avisarBase } from "@/components/base";
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

const brlInt = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
/** Sem centavos só quando o valor é redondo (R$ 100); com centavos, mostra (R$ 244,80) — nunca arredonda */
const brlExato = (v: number) => { const n = Math.round((Number(v) || 0) * 100) / 100; return Number.isInteger(n) ? brlInt(n) : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) };
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
  const [receber, setReceber] = useState<Item | null>(null);

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const lista = await carregarAReceber(user.id); // regra única (Passos 2 e 6)
    setItens(lista);
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const grupos = useMemo(() => {
    const hoje = isoHoje(), em7 = isoMais(6);
    const g = { atrasados: [] as Item[], semana: [] as Item[], depois: [] as Item[], semData: [] as Item[] };
    for (const it of itens) {
      if (!it.dataRef) g.semData.push(it);
      else if (it.dataRef < hoje) g.atrasados.push(it);
      else if (it.dataRef <= em7) g.semana.push(it);
      else g.depois.push(it);
    }
    return g;
  }, [itens]);
  const soma = (l: Item[]) => l.reduce((s, x) => s + x.falta, 0);
  const total = soma(itens);

  return (
    <div className="far-root">
      <AppPageHeader
        title="A receber"
        subtitle={carregando ? "Carregando…" : itens.length ? `${brl(total)} em ${itens.length} ${itens.length === 1 ? "pedido" : "pedidos"}` : "Tudo recebido por aqui"}
        onBack={() => navigate("/financeiro")}
        infoIcon="💰"
        infoContent={<>
          <p>Aqui ficam os <strong>pedidos que ainda têm valor a receber</strong>: o total menos o que já entrou (sinal, parcelas…).</p>
          <p>Toque em <strong>Receber</strong> quando o cliente pagar. O valor entra no financeiro na data que você escolher, e o pedido sai daqui quando estiver quitado.</p>
        </>}
      />
      <EstiloFinanceiro />

      <div className="far-wrap">
        {!carregando && itens.length > 0 && (
          <div className="far-resumo">
            <div className={`far-k ${soma(grupos.atrasados) > 0 ? "far-k--atr" : ""}`}><small>Atrasados</small><b>{brl(soma(grupos.atrasados))}</b><i>{grupos.atrasados.length} {grupos.atrasados.length === 1 ? "pedido" : "pedidos"}</i></div>
            <div className="far-k"><small>Em 7 dias</small><b>{brl(soma(grupos.semana))}</b><i>{grupos.semana.length} {grupos.semana.length === 1 ? "pedido" : "pedidos"}</i></div>
            <div className="far-k"><small>Depois</small><b>{brl(soma(grupos.depois) + soma(grupos.semData))}</b><i>{grupos.depois.length + grupos.semData.length} {grupos.depois.length + grupos.semData.length === 1 ? "pedido" : "pedidos"}</i></div>
          </div>
        )}

        {carregando && <p className="far-carregando">Carregando…</p>}

        {!carregando && itens.length === 0 && (
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
              <p className="far-gt">{titulo} <span>· {brl(soma(lista))}</span></p>
              <div className="far-lista">
                {lista.map(it => (
                  <div key={it.id} className="far-it">
                    <div className="far-it-h">
                      <b>{it.numero ? `Pedido #${it.numero} · ` : ""}{it.cliente_nome || "Cliente"}</b>
                      <span className={`far-tg ${it.dias !== null && it.dias < 0 ? "far-tg--atr" : ""}`}>{quando(it.dias)}</span>
                    </div>
                    <div className="far-it-v">
                      <small>Total {brlExato(it.total)}{it.recebido > 0 ? ` · recebido ${brlExato(it.recebido)}` : ""}</small>
                      <b>falta {brl(it.falta)}</b>
                    </div>
                    <div className="far-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (it.recebido / (it.total || 1)) * 100)}%` }} /></div>
                    <div className="far-it-a">
                      <span><CalendarBlank size={15} />{it.data_entrega ? `entrega ${dataCurta(it.data_entrega)}` : "sem data de entrega"}</span>
                      <div className="far-bts">
                        <button type="button" className="far-ver" onClick={() => navigate(`/pedidos/${it.id}/editar`)} aria-label="Abrir o pedido"><ArrowSquareOut size={16} /></button>
                        <button type="button" className="far-rec" onClick={() => setReceber(it)}>Receber</button>
                      </div>
                    </div>
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
  useTravarRolagem(true)
  const [valor, setValor] = useState(textoBRL(item.falta));
  const [forma, setForma] = useState(normalizarForma(item.forma_pagamento) || "pix");
  const [quandoRec, setQuandoRec] = useState<"hoje" | "ontem" | "outra">("hoje");
  const [outraData, setOutraData] = useState(isoHoje());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const v = Math.round((parseFloat(valor.replace(/\./g, "").replace(",", ".")) || 0) * 100) / 100;
  const resta = Math.max(0, Math.round((item.falta - v) * 100) / 100);
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [onClose]);

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
    if (!r.ok) { setErro("Não foi possível registrar agora. Confira a internet e tente de novo."); return; }
    onFeito(resta > 0 ? `Recebido ${brl(v)}. Ainda faltam ${brl(resta)}.` : item.numero ? `Pedido #${item.numero} quitado.` : "Pedido quitado.");
  };

  return createPortal(
    <div className="far-ov" onClick={onClose} role="dialog" aria-modal="true" aria-label="Registrar recebimento">
      <div className="far-sh" onClick={e => e.stopPropagation()}>
        <span className="far-alca" aria-hidden="true" />
        <b className="far-sh-t">Receber{item.numero ? ` · Pedido #${item.numero}` : ` · ${item.cliente_nome || "Cliente"}`}</b>
        <small className="far-sh-s">{item.cliente_nome || "Cliente"}</small>
        <div className="far-res">
          <div><span>Total do pedido</span><b>{brl(item.total)}</b></div>
          {item.recebido > 0 && <div><span>Já recebido</span><b className="ok">{brl(item.recebido)}</b></div>}
          <div className="tt"><span>Falta receber</span><b>{brl(item.falta)}</b></div>
        </div>
        <label className="far-lb" htmlFor="far-valor">Quanto você recebeu agora?</label>
        <div className="far-in"><span>R$</span><input id="far-valor" inputMode="numeric" value={valor} onChange={e => { setValor(mascaraBRL(e.target.value)); setErro(""); }} /></div>
        <p className="far-lb">Forma de pagamento</p>
        <div className="far-chips">{FORMAS.map(f => <button type="button" key={f.k} className={forma === f.k ? "on" : ""} onClick={() => setForma(f.k)}>{f.l}</button>)}</div>
        <p className="far-lb">Quando recebeu?</p>
        <div className="far-chips">
          {(["hoje", "ontem", "outra"] as const).map(q => <button type="button" key={q} className={quandoRec === q ? "on" : ""} onClick={() => setQuandoRec(q)}>{q === "hoje" ? "Hoje" : q === "ontem" ? "Ontem" : "Outra data"}</button>)}
        </div>
        {quandoRec === "outra" && <div style={{ marginTop: 8 }}><CampoData valor={outraData} onChange={setOutraData} max={isoHoje()} titulo="Data do recebimento" /></div>}
        {v > 0 && v <= item.falta + 0.009 && (
          <div className={`far-prev ${resta > 0 ? "" : "far-prev--ok"}`}>
            {resta > 0 ? <><b>Ainda vai faltar: {brl(resta)}</b><small>Continua em "A receber" até você registrar o restante.</small></>
                       : <><b>O pedido fica quitado</b><small>{brl(v)} entram no financeiro.</small></>}
          </div>
        )}
        {erro && <p className="far-erro">{erro}</p>}
        <button type="button" className="far-cta" onClick={confirmar} disabled={salvando}><Wallet size={18} weight="bold" />{salvando ? "Registrando…" : "Confirmar recebimento"}</button>
      </div>
      <style>{CSS}</style>
    </div>,
    document.body
  );
}

const CSS = `
  .far-root { font-family: var(--font-base); }
  .far-wrap { max-width: 760px; margin: 0 auto; padding: 22px 0 96px; display: flex; flex-direction: column; gap: 20px; }
  .far-resumo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .far-k { background: #fff; border: 1px solid #F0EBED; border-radius: 14px; padding: 12px 10px; min-width: 0; }
  .far-k small { display: block; font-size: 13px; font-weight: 700; color: #9A8E94; }
  .far-k b { display: block; font-size: clamp(13.5px, 3.9vw, 17px); letter-spacing: -.02em; font-weight: 800; color: #B45309; margin: 3px 0 1px; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .far-k i { font-style: normal; font-size: 13px; color: #888780; }
  .far-k--atr { border-color: #FECACA; background: #FFF7F7; } .far-k--atr b { color: #DC2626; }
  .far-carregando { text-align: center; color: #9A8E94; font-size: 14px; padding: 30px 0; }
  .far-vazio { background: #fff; border-radius: 16px; padding: 30px 20px; text-align: center; border: 1px solid #F0EBED; }
  .far-vazio-ic { width: 64px; height: 64px; border-radius: 20px; background: #F0FDF4; color: #16A34A; display: inline-flex; align-items: center; justify-content: center; }
  .far-vazio b { display: block; font-size: 17px; font-weight: 700; margin-top: 12px; color: #2C1219; }
  .far-vazio p { font-size: 13.5px; color: #6B5D64; line-height: 1.45; margin: 6px auto 0; max-width: 360px; text-wrap: balance; }
  .far-gt { margin: 0 0 8px; font-size: 13px; font-weight: 700; letter-spacing: .06em; color: #9A8E94; }
  .far-gt span { color: #6B5D64; }
  .far-lista { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .far-it { min-width: 0; background: #fff; border: 1px solid #F0EBED; border-radius: 14px; padding: 14px; }
  .far-it-h { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .far-it-h b { font-size: 14.5px; font-weight: 800; color: #2C1219; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .far-tg { flex-shrink: 0; font-size: 12px; font-weight: 700; color: #92400E; background: #FEF3C7; padding: 3px 8px; border-radius: 7px; }
  .far-tg--atr { color: #991B1B; background: #FEE2E2; }
  .far-it-v { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-top: 6px; }
  .far-it-v small { font-size: 12.5px; color: #888780; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; } /* numa linha só */
  .far-it-v b { font-size: 15.5px; font-weight: 700; color: #B45309; white-space: nowrap; }
  .far-bar { height: 6px; border-radius: 9px; background: #F5F0F2; margin-top: 9px; overflow: hidden; }
  .far-bar i { display: block; height: 100%; background: #22C55E; border-radius: 9px; }
  .far-it-a { display: flex; justify-content: space-between; align-items: center; margin-top: 11px; gap: 8px; }
  .far-it-a > span { display: flex; align-items: center; gap: 5px; font-size: 12.5px; color: #6B5D64; }
  .far-bts { display: flex; gap: 6px; }
  .far-ver { width: 44px; height: 44px; flex-shrink: 0; border-radius: 10px; border: 1.5px solid #EDE6E9; background: #fff; color: #6B5D64; display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .far-rec { border: none; border-radius: 10px; padding: 0 16px; height: 44px; background: #16A34A; color: #fff; font-family: inherit; font-weight: 700; font-size: 13.5px; cursor: pointer; }
  .far-ov { position: fixed; inset: 0; z-index: 1300; background: rgba(45,31,38,.5); display: flex; align-items: flex-end; justify-content: center; font-family: var(--font-base); }
  @media (min-width: 768px) { .far-ov { align-items: center; } }
  .far-sh { width: 100%; max-width: 460px; background: #fff; border-radius: 22px 22px 0 0; padding: 10px 18px calc(20px + env(safe-area-inset-bottom, 0px)); max-height: 92dvh; overflow-y: auto; color: #2C1219; animation: farSobe .22s ease; }
  @media (min-width: 768px) { .far-sh { border-radius: 22px; } }
  @keyframes farSobe { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
  .far-alca { display: block; width: 40px; height: 4px; border-radius: 9px; background: #E5DDE1; margin: 0 auto 12px; }
  .far-sh-t { display: block; font-size: 19px; font-weight: 800; }
  .far-sh-s { display: block; font-size: 13px; color: #6B5D64; margin: 2px 0 12px; }
  .far-res { background: #FAF7F8; border-radius: 12px; padding: 8px 12px; }
  .far-res div { display: flex; justify-content: space-between; font-size: 13.5px; padding: 4px 0; color: #4B3A42; }
  .far-res b { font-weight: 700; color: #2C1219; } .far-res b.ok { color: #15803D; }
  .far-res .tt { border-top: 1px solid #F0EBED; margin-top: 4px; padding-top: 8px; font-size: 15px; }
  .far-lb { display: block; font-size: 13px; font-weight: 700; color: #4B3A42; margin: 14px 0 6px; }
  .far-in { display: flex; align-items: center; gap: 6px; border: 1.5px solid #E85A8C; border-radius: 12px; padding: 0 12px; height: 52px; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .far-in span { font-size: 18px; color: #6B5D64; font-weight: 700; }
  .far-in input { flex: 1; min-width: 0; border: none; outline: none; font-family: inherit; font-size: 22px; font-weight: 700; color: #2C1219; background: none; }
  .far-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .far-chips button { border: 1.5px solid #EDE6E9; background: #fff; border-radius: 10px; padding: 9px 13px; font-family: inherit; font-size: 13.5px; font-weight: 700; color: #2C1219; cursor: pointer; }
  .far-chips button.on { border-color: #E85A8C; background: #FFF1F6; color: #C33A6E; }
  .far-data { margin-top: 8px; width: 100%; min-width: 0; max-width: 100%; -webkit-appearance: none; appearance: none; background: #fff; height: 46px; border: 1.5px solid #EDE6E9; border-radius: 12px; padding: 0 12px; font-family: inherit; font-size: 16px; }
  .far-prev { margin-top: 14px; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 12px; padding: 10px 12px; }
  .far-prev b { display: block; font-size: 13.5px; color: #92400E; } .far-prev small { font-size: 12px; color: #92400E; }
  .far-prev--ok { background: #F0FDF4; border-color: #BBF7D0; } .far-prev--ok b, .far-prev--ok small { color: #166534; }
  .far-erro { margin: 10px 0 0; font-size: 13px; font-weight: 700; color: #DC2626; }
  .far-cta { margin-top: 16px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; border: none; border-radius: 14px; padding: 15px; background: #16A34A; color: #fff; font-family: inherit; font-size: 15.5px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(22,163,74,.3); }
  .far-cta:disabled { opacity: .6; cursor: default; }
  .far-toast { position: fixed; left: 50%; bottom: calc(90px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 1400; background: #2C1219; color: #fff; padding: 12px 16px; border-radius: 12px; font-size: 13.5px; font-weight: 700; box-shadow: 0 10px 26px rgba(0,0,0,.25); max-width: calc(100vw - 32px); }
`;

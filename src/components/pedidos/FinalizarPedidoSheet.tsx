import CampoData from '@/components/CampoData'
import { useTravarRolagem } from "@/hooks/useTravarRolagem";
import { useEffect, useState } from "react";
import { mascaraBRL, textoBRL } from "@/lib/moeda";
import { createPortal } from "react-dom";
import { Wallet, PencilSimple, X } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { registrarEtapa } from "@/lib/historicoPedido";
import { registrarPagamento, normalizarForma } from "@/lib/pagamentos";
import { ajustarValorPedido, type TipoAjuste } from "@/lib/ajustesPedido";

/**
 * Financeiro · Passo 3 (03/10) — "Finalizar pedido".
 * Abre ao marcar um pedido como entregue com saldo, ou ao tirá-lo de "Aguardando pagamento".
 * Mostra total, já recebido e saldo; pergunta quanto entrou AGORA (já preenchido com o saldo),
 * a forma e a data; e permite ajustar o valor (desconto/acréscimo com motivo).
 * Só o que entrou de verdade vira pagamento — o resto continua em "A receber".
 */
export type PedidoFinalizar = {
  id: string; numero?: number | null; cliente_nome?: string | null; status?: string | null;
  valor_total?: number | null; valor_recebido?: number | null; status_pagamento?: string | null; forma_pagamento?: string | null;
};
export type ResultadoFinalizar = { status: string; valor_total: number; valor_recebido: number; status_pagamento: string };

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const num = (s: string) => r2(parseFloat(String(s).replace(/\./g, "").replace(",", ".")) || 0);
const txt = (v: number) => textoBRL(r2(v)) || "0,00";
const isoDia = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const FORMAS = [{ k: "pix", l: "Pix" }, { k: "dinheiro", l: "Dinheiro" }, { k: "credito", l: "Crédito" }, { k: "debito", l: "Débito" }];
const MOTIVOS: Record<TipoAjuste, string[]> = {
  desconto: ["Combinado com o cliente", "Atraso", "Arredondamento"],
  acrescimo: ["Taxa de entrega", "Item a mais", "Embalagem especial"],
};

function recebidoDe(p: PedidoFinalizar) {
  const total = Number(p.valor_total) || 0;
  if (p.status_pagamento === "pago") return total;
  if (p.status_pagamento === "parcial") return Math.min(total, Number(p.valor_recebido) || 0);
  return 0;
}

export default function FinalizarPedidoSheet({ pedido, novoStatus, novoStatusLabel, aguardandoPagamento, onCancelar, onConcluido }: {
  pedido: PedidoFinalizar; novoStatus: string; novoStatusLabel: string; aguardandoPagamento?: boolean;
  onCancelar: () => void; onConcluido: (r: ResultadoFinalizar) => void;
}) {
  const totalOriginal = r2(Number(pedido.valor_total) || 0);
  const jaRecebido = r2(recebidoDe(pedido));
  const [ajusteAberto, setAjusteAberto] = useState(false);
  const [tipoAjuste, setTipoAjuste] = useState<TipoAjuste>("desconto");
  const [valorAjusteTxt, setValorAjusteTxt] = useState("");
  const [motivo, setMotivo] = useState("");
  const valorAjuste = ajusteAberto ? num(valorAjusteTxt) : 0;
  const novoTotal = r2(totalOriginal + (tipoAjuste === "acrescimo" ? valorAjuste : -valorAjuste));
  const saldo = Math.max(0, r2(novoTotal - jaRecebido));

  const [recebeTxt, setRecebeTxt] = useState(txt(saldo));
  const [recebeEditado, setRecebeEditado] = useState(false);
  useEffect(() => { if (!recebeEditado) setRecebeTxt(txt(saldo)); }, [saldo, recebeEditado]);
  const recebe = num(recebeTxt);
  const resta = Math.max(0, r2(saldo - recebe));

  const [forma, setForma] = useState(normalizarForma(pedido.forma_pagamento) || "pix");
  const [quando, setQuando] = useState<"hoje" | "ontem" | "outra">("hoje");
  const [outraData, setOutraData] = useState(isoDia());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  useTravarRolagem(true)

  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !salvando) onCancelar(); }; window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [onCancelar, salvando]);

  const concluir = async (comRecebimento: boolean) => {
    setErro("");
    if (ajusteAberto && valorAjuste > 0 && novoTotal < 0) { setErro("O desconto passa do valor do pedido"); return; }
    if (comRecebimento) {
      if (recebe < 0) { setErro("Valor inválido"); return; }
      if (recebe > saldo + 0.009) { setErro(`O valor passa do saldo (${brl(saldo)})`); return; }
    }
    const data = quando === "hoje" ? isoDia() : quando === "ontem" ? isoDia(-1) : outraData;
    if (comRecebimento && recebe > 0 && (!data || data > isoDia())) { setErro("Escolha uma data até hoje"); return; }
    setSalvando(true);
    let total = totalOriginal;
    // 1) ajuste de valor (se houver)
    if (ajusteAberto && valorAjuste > 0) {
      const a = await ajustarValorPedido({ pedidoId: pedido.id, totalAtual: totalOriginal, tipo: tipoAjuste, valor: valorAjuste, motivo: motivo.trim() || null });
      if (!a.ok) { setSalvando(false); setErro(a.erro || "Não foi possível ajustar o valor"); return; }
      total = a.novoTotal;
    }
    // 2) status
    const { error } = await supabase.from("pedidos").update({ status: novoStatus }).eq("id", pedido.id);
    if (error) { setSalvando(false); setErro("Não foi possível salvar agora. Confira a internet e tente de novo."); return; }
    if (novoStatus !== pedido.status) registrarEtapa(pedido.id, novoStatus);
    // 3) o que entrou agora vira pagamento
    let recebido = jaRecebido;
    let statusPag = pedido.status_pagamento || (recebido > 0 ? "parcial" : "pendente");
    if (comRecebimento && recebe > 0) {
      const r = await registrarPagamento({
        pedidoId: pedido.id, valor: recebe, forma, recebidoEm: data,
        tipo: recebe >= saldo - 0.009 ? (jaRecebido > 0 ? "restante" : "total") : "parcial",
      });
      if (!r.ok) { setSalvando(false); setErro("O pedido foi atualizado, mas o recebimento não foi registrado. Registre em Financeiro → A receber."); return; }
      recebido = r.valor_recebido ?? r2(jaRecebido + recebe);
      statusPag = r.status_pagamento ?? (recebido >= total - 0.009 ? "pago" : "parcial");
    } else {
      statusPag = recebido > 0 && recebido >= total - 0.009 ? "pago" : recebido > 0 ? "parcial" : "pendente";
    }
    setSalvando(false);
    onConcluido({ status: novoStatus, valor_total: total, valor_recebido: recebido, status_pagamento: statusPag });
  };

  return createPortal(
    <div className="fps-ov" onClick={() => !salvando && onCancelar()} role="dialog" aria-modal="true" aria-label="Finalizar pedido">
      <div className="fps" onClick={e => e.stopPropagation()}>
        <span className="fps-alca" aria-hidden="true" />
        <div className="fps-hd">
          <div>
            <b className="fps-t">{aguardandoPagamento ? "O cliente pagou?" : "Finalizar pedido"}</b>
            <small className="fps-s">Pedido #{pedido.numero ?? "—"}{pedido.cliente_nome ? ` · ${pedido.cliente_nome}` : ""} · {novoStatusLabel}</small>
          </div>
          <button type="button" className="fps-x" onClick={onCancelar} aria-label="Fechar" disabled={salvando}><X size={18} weight="bold" /></button>
        </div>

        <div className="fps-res">
          <div><span>Total do pedido</span><b>{valorAjuste > 0 ? <><s>{brl(totalOriginal)}</s> {brl(novoTotal)}</> : brl(totalOriginal)}</b></div>
          {valorAjuste > 0 && <div className="aj"><span>{tipoAjuste === "desconto" ? "Desconto" : "Acréscimo"}{motivo ? ` · ${motivo}` : ""}</span><b>{tipoAjuste === "desconto" ? "−" : "+"} {brl(valorAjuste)}</b></div>}
          {jaRecebido > 0 && <div><span>Já recebido</span><b className="ok">{brl(jaRecebido)}</b></div>}
          <div className="tt"><span>Saldo restante</span><b>{brl(saldo)}</b></div>
        </div>

        {!ajusteAberto ? (
          <button type="button" className="fps-aj-link" onClick={() => setAjusteAberto(true)}><PencilSimple size={15} weight="bold" />Ajustar valor do pedido</button>
        ) : (
          <div className="fps-aj">
            <div className="fps-aj-h"><b>Ajustar valor</b><button type="button" onClick={() => { setAjusteAberto(false); setValorAjusteTxt(""); setMotivo(""); }}>Cancelar ajuste</button></div>
            <div className="fps-seg">
              {(["desconto", "acrescimo"] as TipoAjuste[]).map(t => <button type="button" key={t} className={tipoAjuste === t ? "on" : ""} onClick={() => setTipoAjuste(t)}>{t === "desconto" ? "Desconto" : "Acréscimo"}</button>)}
            </div>
            <div className="fps-in sm"><span>R$</span><input inputMode="numeric" placeholder="0,00" value={valorAjusteTxt} onChange={e => setValorAjusteTxt(mascaraBRL(e.target.value))} aria-label="Valor do ajuste" /></div>
            <p className="fps-lb">Motivo</p>
            <div className="fps-chips">{MOTIVOS[tipoAjuste].map(m => <button type="button" key={m} className={motivo === m ? "on" : ""} onClick={() => setMotivo(m)}>{m}</button>)}</div>
            <input className="fps-motivo" placeholder="Ou escreva o motivo" value={MOTIVOS[tipoAjuste].includes(motivo) ? "" : motivo} onChange={e => setMotivo(e.target.value)} />
          </div>
        )}

        {saldo > 0.009 && (<>
          <label className="fps-lb" htmlFor="fps-recebe">Quanto você recebeu agora?</label>
          <div className="fps-in"><span>R$</span><input id="fps-recebe" inputMode="numeric" value={recebeTxt} onChange={e => { setRecebeTxt(mascaraBRL(e.target.value)); setRecebeEditado(true); setErro(""); }} /></div>
          <p className="fps-lb">Forma de pagamento</p>
          <div className="fps-chips">{FORMAS.map(f => <button type="button" key={f.k} className={forma === f.k ? "on" : ""} onClick={() => setForma(f.k)}>{f.l}</button>)}</div>
          <p className="fps-lb">Data do recebimento</p>
          <div className="fps-chips">{(["hoje", "ontem", "outra"] as const).map(q => <button type="button" key={q} className={quando === q ? "on" : ""} onClick={() => setQuando(q)}>{q === "hoje" ? "Hoje" : q === "ontem" ? "Ontem" : "Outra data"}</button>)}</div>
          {quando === "outra" && <div className="fps-data-w"><CampoData valor={outraData} onChange={setOutraData} max={isoDia()} titulo="Data do recebimento" /></div>}
        </>)}

        {saldo > 0.009 && recebe <= saldo + 0.009 && (
          <div className={`fps-prev ${resta > 0.009 ? "" : "fps-prev--ok"}`}>
            {resta > 0.009 ? <><b>Ainda a receber: {brl(resta)}</b><small>Fica em "A receber" até você registrar o restante.</small></>
                           : <><b>O pedido fica quitado</b><small>{brl(recebe)} entram no financeiro.</small></>}
          </div>
        )}
        {saldo <= 0.009 && <div className="fps-prev fps-prev--ok"><b>Pedido já está pago</b><small>Nada a receber agora.</small></div>}
        {erro && <p className="fps-erro">{erro}</p>}

        <button type="button" className="fps-cta" onClick={() => concluir(true)} disabled={salvando}>
          <Wallet size={18} weight="bold" />{salvando ? "Salvando…" : saldo > 0.009 && recebe > 0 ? "Confirmar e lançar no financeiro" : "Confirmar"}
        </button>
        {saldo > 0.009 && <button type="button" className="fps-sec" onClick={() => concluir(false)} disabled={salvando}>Ainda não recebi</button>}
      </div>
      <style>{`
        .fps-ov { position: fixed; inset: 0; z-index: 1300; background: rgba(45,31,38,.5); display: flex; align-items: flex-end; justify-content: center; font-family: var(--font-base); }
        @media (min-width: 768px) { .fps-ov { align-items: center; } }
        .fps { width: 100%; max-width: 460px; background: var(--ui-branco); border-radius: 22px 22px 0 0; padding: 10px 18px calc(18px + env(safe-area-inset-bottom, 0px)); max-height: 94dvh; overflow-y: auto; color: var(--ui-texto); animation: fpsSobe .22s ease; }
        @media (min-width: 768px) { .fps { border-radius: 22px; } }
        @keyframes fpsSobe { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
        .fps-alca { display: block; width: 40px; height: 4px; border-radius: 9px; background: #E5DDE1; margin: 0 auto 10px; }
        .fps-hd { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
        .fps-t { display: block; font-size: 19px; font-weight: 700; }
        .fps-s { display: block; font-size: 13px; color: var(--ui-texto-2); margin-top: 2px; }
        .fps-x { width: 34px; height: 34px; border-radius: 50%; border: none; background: var(--ui-linha); color: var(--ui-texto-2); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .fps-res { background: #FAF7F8; border-radius: 12px; padding: 8px 12px; }
        .fps-res div { display: flex; justify-content: space-between; gap: 10px; font-size: 13.5px; padding: 4px 0; color: var(--ui-cinza-texto); }
        .fps-res b { font-weight: 700; color: var(--ui-texto); white-space: nowrap; } .fps-res s { color: var(--ui-texto-3); font-weight: 500; margin-right: 4px; }
        .fps-res .ok { color: var(--ui-verde); } .fps-res .aj span, .fps-res .aj b { color: var(--ui-rosa-escuro); }
        .fps-res .tt { border-top: 1px solid #F0EBED; margin-top: 4px; padding-top: 8px; font-size: 15px; }
        .fps-aj-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; border: none; background: none; padding: 4px 0; font-family: inherit; font-size: 13.5px; font-weight: 700; color: var(--ui-rosa-escuro); cursor: pointer; }
        .fps-aj { margin-top: 12px; border: 1.5px solid #F3C9DA; border-radius: 14px; padding: 12px; background: #FFF9FB; }
        .fps-aj-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .fps-aj-h b { font-size: 14px; } .fps-aj-h button { border: none; background: none; font-family: inherit; font-size: 12.5px; font-weight: 700; color: var(--ui-texto-3); cursor: pointer; }
        .fps-seg { display: flex; background: var(--ui-linha); border-radius: 10px; padding: 3px; margin-bottom: 8px; }
        .fps-seg button { flex: 1; border: none; background: none; border-radius: 8px; padding: 8px; font-family: inherit; font-size: 13.5px; font-weight: 700; color: var(--ui-texto-2); cursor: pointer; }
        .fps-seg button.on { background: var(--ui-branco); color: var(--ui-texto); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
        .fps-lb { display: block; font-size: 13px; font-weight: 700; color: var(--ui-cinza-texto); margin: 14px 0 6px; }
        .fps-aj .fps-lb { margin-top: 10px; }
        .fps-in { display: flex; align-items: center; gap: 6px; border: 1.5px solid var(--ui-rosa); border-radius: 12px; padding: 0 12px; height: 52px; box-shadow: 0 0 0 3px rgba(232,90,140,.12); background: var(--ui-branco); }
        .fps-in.sm { height: 46px; border-color: var(--ui-borda-campo); box-shadow: none; }
        .fps-in span { font-size: 17px; color: var(--ui-texto-2); font-weight: 700; }
        .fps-in input { flex: 1; min-width: 0; border: none; outline: none; font-family: inherit; font-size: 21px; font-weight: 700; color: var(--ui-texto); background: none; }
        .fps-in.sm input { font-size: 17px; }
        .fps-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .fps-chips button { border: 1.5px solid var(--ui-borda-campo); background: var(--ui-branco); border-radius: 10px; padding: 8px 12px; font-family: inherit; font-size: 13px; font-weight: 700; color: var(--ui-texto); cursor: pointer; }
        .fps-chips button.on { border-color: var(--ui-rosa); background: #FFF1F6; color: var(--ui-rosa-escuro); }
        .fps-motivo { margin-top: 8px; width: 100%; height: 42px; border: 1.5px solid var(--ui-borda-campo); border-radius: 10px; padding: 0 12px; font-family: inherit; font-size: 15px; box-sizing: border-box; }
        .fps-data { margin-top: 8px; width: 100%; min-width: 0; max-width: 100%; -webkit-appearance: none; appearance: none; background: var(--ui-branco); height: 46px; border: 1.5px solid var(--ui-borda-campo); border-radius: 12px; padding: 0 12px; font-family: inherit; font-size: 16px; box-sizing: border-box; }
        .fps-prev { margin-top: 14px; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 12px; padding: 10px 12px; }
        .fps-prev b { display: block; font-size: 13.5px; color: #92400E; } .fps-prev small { font-size: 12px; color: #92400E; }
        .fps-prev--ok { background: #F0FDF4; border-color: #BBF7D0; } .fps-prev--ok b, .fps-prev--ok small { color: #166534; }
        .fps-erro { margin: 10px 0 0; font-size: 13px; font-weight: 700; color: var(--ui-vermelho); }
        .fps-cta { margin-top: 14px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; border: none; border-radius: 14px; padding: 15px; background: #16A34A; color: var(--ui-branco); font-family: inherit; font-size: 15.5px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(22,163,74,.3); }
        .fps-sec { margin-top: 6px; width: 100%; border: none; background: none; padding: 12px; font-family: inherit; font-size: 14px; font-weight: 700; color: var(--ui-texto-2); cursor: pointer; }
        .fps-cta:disabled, .fps-sec:disabled { opacity: .6; cursor: default; }
      `}</style>
    </div>,
    document.body
  );
}

import { useTravarRolagem } from "@/hooks/useTravarRolagem";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { mascaraBRL, textoBRL } from "@/lib/moeda";
import { createPortal } from "react-dom";
import { ArrowUp, ArrowDown, Wallet, PencilSimple } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { carregarCaixa, definirSaldoInicial, type EstadoCaixa } from "@/lib/caixa";

/**
 * Financeiro · Passo 4 (03/10) — cartão "Saldo em caixa" + últimas movimentações.
 * Primeira vez: pede o saldo inicial. Depois: soma recebimentos e entradas, tira as saídas.
 */
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataCurta = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); };

/** Carrega o caixa (Passo 4) e permite recarregar depois de uma mudança. */
export function useCaixa() {
  const [uid, setUid] = useState<string | null>(null);
  const [cx, setCx] = useState<EstadoCaixa | null>(null);
  const recarregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUid(user.id);
    setCx(await carregarCaixa(user.id));
  }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { uid, cx, recarregar };
}

/** O cartão escuro "Saldo em caixa" (ou o convite pra informar o saldo inicial). */
export function SaldoCaixa({ cx, onAcertar, onDepois, destaque }: { cx: EstadoCaixa | null; onAcertar: () => void; onDepois?: () => void; destaque?: boolean }) {
  if (!cx) return <div className="cxc cxc--carregando" aria-busy="true" />;
  if (cx.precisaSql) return (
    <div className="cxc-convite"><b>Saldo em caixa</b><p>Falta um ajuste no banco de dados pra ativar o caixa (o SQL do Passo 4).</p></div>
  );
  if (!cx.configurado) return (
    <div className={`cxc-convite${destaque ? " cxc-convite--foco" : ""}`}>
      <span className="cxc-convite-ic"><Wallet size={26} weight="duotone" /></span>
      <b>Quanto você tem em caixa hoje?</b>
      <p>Conte o dinheiro da gaveta e o que está na conta da confeitaria. A partir daí, o app soma o que você recebe e tira o que você paga.</p>
      <button type="button" className="cxc-cta" onClick={onAcertar}>Informar meu saldo</button>
      {onDepois && <button type="button" className="cxc-depois" onClick={onDepois}>Agora não</button>}
    </div>
  );
  return (
    <div className="cxc">
      <div className="cxc-top">
        <p>Saldo em caixa <i>agora</i></p>
        <button type="button" className="cxc-acertar" onClick={onAcertar}><PencilSimple size={13} weight="bold" />Acertar</button>
      </div>
      <b className="cxc-v">{brl(cx.saldo)}</b>
      <div className="cxc-hoje">
        <span><ArrowUp size={14} weight="bold" />Entrou hoje <em>{brl(cx.entrouHoje)}</em></span>
        <span><ArrowDown size={14} weight="bold" />Saiu hoje <em>{brl(cx.saiuHoje)}</em></span>
      </div>
      <small>Só conta o que já foi recebido ou pago{cx.semPagamentos ? " · os recebimentos de pedidos entram quando o SQL do Passo 1 for rodado" : ""}</small>
    </div>
  );
}

/** As últimas movimentações do caixa. */
export function MovimentosCaixa({ cx, limite = 6 }: { cx: EstadoCaixa | null; limite?: number }) {
  if (!cx || !cx.configurado) return null;
  return (
    <div className="cxc-movs">
      <p className="cxc-movs-t">Últimas movimentações</p>
      {cx.movimentos.length === 0 ? (
        <p className="cxc-movs-vazio">Nenhuma movimentação desde que você informou o saldo. Quando receber um pedido ou lançar uma despesa, aparece aqui.</p>
      ) : cx.movimentos.slice(0, limite).map(m => (
        <div key={m.id} className="cxc-mv">
          <span className={`cxc-mv-ic ${m.tipo === "entrada" ? "e" : "s"}`}>{m.tipo === "entrada" ? <ArrowUp size={15} weight="bold" /> : <ArrowDown size={15} weight="bold" />}</span>
          <div className="cxc-mv-t"><b>{m.titulo}</b><small>{[m.detalhe, dataCurta(m.data)].filter(Boolean).join(" · ")}</small></div>
          <span className={`cxc-mv-v ${m.tipo === "entrada" ? "e" : "s"}`}>{m.tipo === "entrada" ? "+" : "−"} {brl(m.valor)}</span>
        </div>
      ))}
    </div>
  );
}

/** Estilos do caixa (uma vez por tela). */
export const CaixaEstilos = () => <style>{CSS}</style>;

/** Composição simples: saldo, um conteúdo no meio e as movimentações. */
export default function CaixaCard({ mostrarMovimentos = true, meio }: { mostrarMovimentos?: boolean; meio?: ReactNode }) {
  const { uid, cx, recarregar } = useCaixa();
  const [definir, setDefinir] = useState(false);
  return (
    <>
      <SaldoCaixa cx={cx} onAcertar={() => setDefinir(true)} />
      {meio}
      {mostrarMovimentos && <MovimentosCaixa cx={cx} />}
      {definir && uid && cx && <SaldoSheet atual={cx.configurado ? cx.saldo : null} uid={uid} onClose={() => setDefinir(false)} onSalvo={async () => { setDefinir(false); await recarregar(); }} />}
      <CaixaEstilos />
    </>
  );
}

export function SaldoSheet({ atual, uid, onClose, onSalvo }: { atual: number | null; uid: string; onClose: () => void; onSalvo: () => void }) {
  const [txt, setTxt] = useState(atual != null ? (textoBRL(atual) || "0,00") : "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  useTravarRolagem(true)
  const v = Math.round((parseFloat(txt.replace(/\./g, "").replace(",", ".")) || 0) * 100) / 100;
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [onClose]);
  const salvar = async () => {
    if (!txt.trim()) { setErro("Digite o valor (pode ser 0)"); return; }
    setSalvando(true);
    const r = await definirSaldoInicial(uid, v);
    setSalvando(false);
    if (!r.ok) { setErro("Não foi possível salvar agora. Confira a internet e tente de novo."); return; }
    onSalvo();
  };
  return createPortal(
    <div className="cxs-ov" onClick={onClose} role="dialog" aria-modal="true" aria-label="Saldo em caixa">
      <div className="cxs" onClick={e => e.stopPropagation()}>
        <span className="cxs-alca" aria-hidden="true" />
        <b className="cxs-t">{atual == null ? "Quanto você tem em caixa?" : "Acertar o saldo"}</b>
        <p className="cxs-s">{atual == null
          ? "Some o dinheiro da gaveta e o que está na conta da confeitaria agora. Daqui pra frente, o app atualiza sozinho."
          : `O app calcula ${brl(atual)}. Se você contou e deu diferente, informe o valor certo: o caixa recomeça a partir de agora.`}</p>
        <label className="cxs-lb" htmlFor="cxs-v">Saldo agora</label>
        <div className="cxs-in"><span>R$</span><input id="cxs-v" inputMode="numeric" placeholder="0,00" value={txt} onChange={e => { setTxt(mascaraBRL(e.target.value)); setErro(""); }} autoFocus /></div>
        {erro && <p className="cxs-erro">{erro}</p>}
        <button type="button" className="cxs-cta" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar saldo"}</button>
      </div>
    </div>,
    document.body
  );
}

const CSS = `
  .cxc { background: radial-gradient(130% 160% at 0 0, #6B2340, #2C1219 70%); color: #fff; border-radius: 18px; padding: 16px 18px; font-family: var(--font-base); }
  .cxc--carregando { height: 132px; background: #EFE9EC; border-radius: 18px; }
  .cxc-top { display: flex; justify-content: space-between; align-items: center; }
  .cxc-top p { margin: 0; font-size: 12.5px; opacity: .82; } .cxc-top i { font-style: normal; background: rgba(255,255,255,.15); border-radius: 6px; padding: 1px 6px; margin-left: 4px; font-size: 12px; }
  .cxc-acertar { display: inline-flex; align-items: center; gap: 4px; border: none; background: rgba(255,255,255,.14); color: #fff; border-radius: 8px; padding: 5px 9px; font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
  .cxc-v { display: block; font-size: 31px; font-weight: 900; letter-spacing: -.02em; margin: 4px 0 10px; }
  .cxc-hoje { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12.5px; opacity: .92; }
  .cxc-hoje span { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; } .cxc-hoje em { font-style: normal; font-weight: 800; }
  .cxc small { display: block; font-size: 13px; opacity: .6; margin-top: 9px; line-height: 1.4; }
  .cxc-convite { background: #fff; border: 1.5px dashed #F3C9DA; border-radius: 18px; padding: 18px; text-align: center; font-family: var(--font-base); }
  .cxc-convite-ic { width: 52px; height: 52px; border-radius: 16px; background: #FFF1F6; color: #C33A6E; display: inline-flex; align-items: center; justify-content: center; }
  .cxc-convite b { display: block; font-size: 17px; font-weight: 900; color: #2C1219; margin-top: 8px; }
  .cxc-convite p { font-size: 13.5px; color: #6B5D64; line-height: 1.45; margin: 6px auto 0; max-width: 380px; text-wrap: balance; }
  .cxc-convite--foco { border: 2px solid #F3A9C6; box-shadow: 0 0 0 6px rgba(232,90,140,.12), 0 14px 30px -10px rgba(195,58,110,.45) !important; position: relative; z-index: 2; }
  .cxc-depois { display: block; min-height: 44px; margin: 4px auto 0; border: none; background: none; padding: 8px 16px; font-family: inherit; font-size: 13.5px; font-weight: 700; color: #9A8E94; cursor: pointer; }
  .cxc-cta { margin-top: 14px; border: none; border-radius: 12px; padding: 12px 18px; background: #E85A8C; color: #fff; font-family: inherit; font-size: 14.5px; font-weight: 800; cursor: pointer; box-shadow: 0 3px 0 #C33A6E; }
  .cxc-movs { background: #fff; border: 1px solid #F0EBED; border-radius: 16px; padding: 12px 14px; font-family: var(--font-base); }
  .cxc-movs-t { margin: 0 0 4px; font-size: 14.5px; font-weight: 900; color: #2C1219; }
  .cxc-movs-vazio { margin: 6px 0 2px; font-size: 13px; color: #888780; line-height: 1.45; }
  .cxc-mv { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid #F5F0F2; }
  .cxc-mv:first-of-type { border-top: none; }
  .cxc-mv-ic { width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .cxc-mv-ic.e { background: #DCFCE7; color: #15803D; } .cxc-mv-ic.s { background: #FEE2E2; color: #DC2626; }
  .cxc-mv-t { flex: 1; min-width: 0; } .cxc-mv-t b { display: block; font-size: 13.5px; color: #2C1219; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cxc-mv-t small { font-size: 12px; color: #888780; }
  .cxc-mv-v { font-size: 13.5px; font-weight: 800; white-space: nowrap; } .cxc-mv-v.e { color: #15803D; } .cxc-mv-v.s { color: #DC2626; }
  .cxs-ov { position: fixed; inset: 0; z-index: 1300; background: rgba(45,31,38,.5); display: flex; align-items: flex-end; justify-content: center; font-family: var(--font-base); }
  @media (min-width: 768px) { .cxs-ov { align-items: center; } }
  .cxs { width: 100%; max-width: 440px; background: #fff; border-radius: 22px 22px 0 0; padding: 10px 18px calc(20px + env(safe-area-inset-bottom, 0px)); color: #2C1219; }
  @media (min-width: 768px) { .cxs { border-radius: 22px; } }
  .cxs-alca { display: block; width: 40px; height: 4px; border-radius: 9px; background: #E5DDE1; margin: 0 auto 12px; }
  .cxs-t { display: block; font-size: 19px; font-weight: 900; }
  .cxs-s { font-size: 13.5px; color: #6B5D64; line-height: 1.45; margin: 4px 0 0; }
  .cxs-lb { display: block; font-size: 13px; font-weight: 700; color: #4B3A42; margin: 16px 0 6px; }
  .cxs-in { display: flex; align-items: center; gap: 6px; border: 1.5px solid #E85A8C; border-radius: 12px; padding: 0 12px; height: 54px; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .cxs-in span { font-size: 18px; color: #6B5D64; font-weight: 700; }
  .cxs-in input { flex: 1; min-width: 0; border: none; outline: none; font-family: inherit; font-size: 23px; font-weight: 700; color: #2C1219; background: none; }
  .cxs-erro { margin: 10px 0 0; font-size: 13px; font-weight: 800; color: #DC2626; }
  .cxs-cta { margin-top: 16px; width: 100%; border: none; border-radius: 14px; padding: 15px; background: #E85A8C; color: #fff; font-family: inherit; font-size: 15.5px; font-weight: 800; cursor: pointer; box-shadow: 0 3px 0 #C33A6E; }
  .cxs-cta:disabled { opacity: .6; cursor: default; }
`;

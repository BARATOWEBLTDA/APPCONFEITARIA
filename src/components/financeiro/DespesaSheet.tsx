import { useTravarRolagem } from "@/hooks/useTravarRolagem";
import { useEffect, useState } from "react";
import { mascaraBRL, textoBRL } from "@/lib/moeda";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";

/**
 * Financeiro · Passo 7 (03/10) — "Nova despesa": uma saída JÁ PAGA (sai do caixa na data escolhida).
 * Conta pra pagar depois vai em "A pagar" (Passo 5), que só sai do caixa quando for paga.
 */
const CATEGORIAS = ["Insumos", "Embalagens", "Aluguel", "Energia e água", "Internet", "Gás", "Transporte", "Marketing", "Equipamentos", "Outros"];
const CATEGORIAS_ENTRADA = ["Venda fora do app", "Venda no balcão", "Aporte (dinheiro seu)", "Outros"];
const isoDia = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const num = (s: string) => Math.round((parseFloat(String(s).replace(/\./g, "").replace(",", ".")) || 0) * 100) / 100;

export default function DespesaSheet({ onClose, onSalvo, onContaAPagar, tipo = "saida" }: { onClose: () => void; onSalvo: () => void; onContaAPagar?: () => void; tipo?: "entrada" | "saida" }) {
  const ehEntrada = tipo === "entrada";
  const cats = ehEntrada ? CATEGORIAS_ENTRADA : CATEGORIAS;
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState(cats[0]);
  const [valor, setValor] = useState("");
  const [quando, setQuando] = useState<"hoje" | "ontem" | "outra">("hoje");
  const [outra, setOutra] = useState(isoDia());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  useTravarRolagem(true)
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [onClose]);

  const salvar = async () => {
    const v = num(valor);
    if (v <= 0) { setErro(ehEntrada ? "Digite quanto entrou" : "Digite quanto você pagou"); return; }
    const data = quando === "hoje" ? isoDia() : quando === "ontem" ? isoDia(-1) : outra;
    if (!data || data > isoDia()) { setErro(ehEntrada ? "Escolha uma data até hoje" : "Escolha uma data até hoje (conta futura vai em A pagar)"); return; }
    setSalvando(true); setErro("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("financeiro").insert({ user_id: user?.id, tipo: ehEntrada ? "entrada" : "saida", categoria, descricao: descricao.trim() || categoria, valor: v, data });
    setSalvando(false);
    if (error) { setErro("Não foi possível salvar agora. Confira a internet e tente de novo."); return; }
    onSalvo();
  };

  return createPortal(
    <div className="dsp-ov" onClick={onClose} role="dialog" aria-modal="true" aria-label={ehEntrada ? "Nova entrada" : "Nova despesa"}>
      <div className="dsp" onClick={e => e.stopPropagation()}>
        <span className="dsp-alca" aria-hidden="true" />
        <b className="dsp-t">{ehEntrada ? "Nova entrada" : "Nova despesa"}</b>
        <small className="dsp-s">{ehEntrada ? "Dinheiro que entrou fora dos pedidos do app. Entra no caixa na data escolhida." : "Algo que você já pagou. Sai do caixa na data escolhida."}</small>
        <label className="dsp-lb" htmlFor="dsp-v">{ehEntrada ? "Quanto entrou?" : "Quanto pagou?"}</label>
        <div className="dsp-in"><span>R$</span><input id="dsp-v" inputMode="numeric" placeholder="0,00" value={valor} onChange={e => { setValor(mascaraBRL(e.target.value)); setErro(""); }} autoFocus /></div>
        <p className="dsp-lb">Categoria</p>
        <div className="dsp-chips">{cats.map(c => <button type="button" key={c} className={categoria === c ? "on" : ""} onClick={() => setCategoria(c)}>{c}</button>)}</div>
        <label className="dsp-lb" htmlFor="dsp-d">Descrição <em>(opcional)</em></label>
        <input id="dsp-d" className="dsp-txt" placeholder={ehEntrada ? "Ex.: 30 brigadeiros pra vizinha" : "Ex.: Leite condensado e creme de leite"} value={descricao} onChange={e => setDescricao(e.target.value)} />
        <p className="dsp-lb">{ehEntrada ? "Quando entrou?" : "Quando pagou?"}</p>
        <div className="dsp-chips">{(["hoje", "ontem", "outra"] as const).map(q => <button type="button" key={q} className={quando === q ? "on" : ""} onClick={() => setQuando(q)}>{q === "hoje" ? "Hoje" : q === "ontem" ? "Ontem" : "Outra data"}</button>)}</div>
        {quando === "outra" && <input type="date" className="dsp-data" value={outra} max={isoDia()} onChange={e => setOutra(e.target.value)} />}
        {erro && <p className="dsp-erro">{erro}</p>}
        <button type="button" className="dsp-cta" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : ehEntrada ? "Lançar entrada" : "Lançar despesa"}</button>
        {!ehEntrada && onContaAPagar && <button type="button" className="dsp-link" onClick={onContaAPagar}>É uma conta pra pagar depois? Cadastre em A pagar</button>}
      </div>
      <style>{`
        .dsp-ov { position: fixed; inset: 0; z-index: 1300; background: rgba(45,31,38,.5); display: flex; align-items: flex-end; justify-content: center; font-family: var(--font-base); }
        @media (min-width: 768px) { .dsp-ov { align-items: center; } }
        .dsp { width: 100%; max-width: 460px; background: #fff; border-radius: 22px 22px 0 0; padding: 10px 18px calc(18px + env(safe-area-inset-bottom, 0px)); max-height: 92dvh; overflow-y: auto; color: #2C1219; }
        @media (min-width: 768px) { .dsp { border-radius: 22px; } }
        .dsp-alca { display: block; width: 40px; height: 4px; border-radius: 9px; background: #E5DDE1; margin: 0 auto 12px; }
        .dsp-t { display: block; font-size: 19px; font-weight: 900; } .dsp-s { display: block; font-size: 13px; color: #6B5D64; margin-top: 2px; }
        .dsp-lb { display: block; font-size: 13px; font-weight: 700; color: #4B3A42; margin: 14px 0 6px; } .dsp-lb em { font-style: normal; font-weight: 500; color: #9A8E94; }
        .dsp-in { display: flex; align-items: center; gap: 6px; border: 1.5px solid #E85A8C; border-radius: 12px; padding: 0 12px; height: 52px; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
        .dsp-in span { font-size: 17px; color: #6B5D64; font-weight: 700; }
        .dsp-in input { flex: 1; min-width: 0; border: none; outline: none; font-family: inherit; font-size: 21px; font-weight: 700; color: #2C1219; background: none; }
        .dsp-txt { width: 100%; box-sizing: border-box; height: 46px; border: 1.5px solid #EDE6E9; border-radius: 12px; padding: 0 12px; font-family: inherit; font-size: 16px; }
        .dsp-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .dsp-chips button { border: 1.5px solid #EDE6E9; background: #fff; border-radius: 10px; padding: 8px 12px; font-family: inherit; font-size: 13px; font-weight: 700; color: #2C1219; cursor: pointer; }
        .dsp-chips button.on { border-color: #E85A8C; background: #FFF1F6; color: #C33A6E; }
        .dsp-data { margin-top: 8px; width: 100%; min-width: 0; max-width: 100%; -webkit-appearance: none; appearance: none; background: #fff; height: 46px; border: 1.5px solid #EDE6E9; border-radius: 12px; padding: 0 10px; font-family: inherit; font-size: 15px; box-sizing: border-box; }
        .dsp-erro { margin: 10px 0 0; font-size: 13px; font-weight: 800; color: #DC2626; }
        .dsp-cta { margin-top: 16px; width: 100%; border: none; border-radius: 14px; padding: 15px; background: ${ehEntrada ? "#16A34A" : "#2C1219"}; color: #fff; font-family: inherit; font-size: 15.5px; font-weight: 800; cursor: pointer; }
        .dsp-cta:disabled { opacity: .6; cursor: default; }
        .dsp-link { display: block; width: 100%; margin-top: 8px; border: none; background: none; padding: 10px; font-family: inherit; font-size: 13px; font-weight: 700; color: #C33A6E; cursor: pointer; }
      `}</style>
    </div>,
    document.body
  );
}

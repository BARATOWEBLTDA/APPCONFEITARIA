import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CaretRight } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { carregarAReceber, calcularPrevistos, type Previstos } from "@/lib/contasReceber";

/**
 * Financeiro · Passo 6 (03/10) — Recebimentos previstos, em faixas: próximos 7 dias, 8 a 15 e 16 a 30.
 * Projeção a partir dos pedidos com saldo. NÃO soma no saldo em caixa.
 */
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PrevistosCard({ versao = 0 }: { versao?: number }) {
  const navigate = useNavigate();
  const [p, setP] = useState<Previstos | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const r = await carregarAReceber(user.id);
        if (cancelado) return;
        // 10/10: com erro, avisa (antes mostrava R$ 0,00 e "Nenhum recebimento previsto")
        if (r.erro) setErro(true); else { setErro(false); setP(calcularPrevistos(r.itens)); }
      } catch { if (!cancelado) setErro(true); }
    })();
    return () => { cancelado = true; };
  }, [tentativa, versao]); // 11/10: `versao` muda quando o painel recarrega (sem desmontar o cartão, pra não piscar)
  if (erro) return (
    <div className="pvc pvc--erro" role="alert">
      <div className="pvc-h"><b>Recebimentos previstos</b></div>
      <p>Não deu pra carregar. Tente de novo.</p>
      <button type="button" onClick={() => { setErro(false); setTentativa(t => t + 1); }}>Tentar de novo</button>
      <style>{CSS}</style>
    </div>
  );
  if (!p) return <div className="pvc pvc--carregando" aria-busy="true" />;

  return (
    <button type="button" className="pvc" onClick={() => navigate("/financeiro/a-receber")} aria-label="Ver o que falta receber">
      <div className="pvc-h"><b>Recebimentos previstos</b><em>não somam no caixa</em></div>
      <div className="pvc-g">
        <span><small>Próximos 7 dias</small><b>{brl(p.d7)}</b></span>
        <span><small>8 a 15 dias</small><b>{brl(p.d15)}</b></span>
        <span><small>16 a 30 dias</small><b>{brl(p.d30)}</b></span>
      </div>
      <div className="pvc-f">
        {p.atrasados > 0
          ? <span className="pvc-atr">+ {brl(p.atrasados)} atrasados</span>
          : <span>{p.qtd30 > 0 ? `${p.qtd30} ${p.qtd30 === 1 ? "pedido" : "pedidos"} nos próximos 30 dias` : "Nenhum recebimento previsto nos próximos 30 dias"}</span>}
        <i>Ver o que falta receber <CaretRight size={13} weight="bold" /></i>
      </div>
      <style>{CSS}</style>
    </button>
  );
}

const CSS = `
        .pvc { display: block; width: 100%; text-align: left; background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: var(--ui-raio-cartao); padding: 14px; font-family: var(--font-base); color: var(--ui-texto); cursor: pointer; }
        .pvc--carregando { height: 128px; background: var(--ui-linha); border: none; }
        .pvc-h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 10px; }
        .pvc-h b { font-size: 14.5px; font-weight: 700; } .pvc-h em { font-style: normal; font-size: 13px; font-weight: 500; color: var(--ui-texto-3); white-space: nowrap; }
        .pvc-g { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .pvc-g span { background: #FFFBEB; border-radius: var(--ui-raio-p); padding: 9px 6px; text-align: center; min-width: 0; }
        .pvc-g small { display: block; font-size: 12px; font-weight: 700; color: #92400E; }
        .pvc-g b { display: block; font-size: clamp(13px, 3.7vw, 15.5px); font-weight: 700; color: #92400E; letter-spacing: -.02em; white-space: nowrap; }
        .pvc-f { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 10px; font-size: 12.5px; color: var(--ui-texto-2); }
        .pvc-atr { color: var(--ui-vermelho); font-weight: 700; }
        .pvc-f i { font-style: normal; display: inline-flex; align-items: center; gap: 3px; color: var(--ui-rosa-escuro); font-weight: 700; white-space: nowrap; }
        .pvc--erro { cursor: default; box-sizing: border-box; }
        .pvc--erro p { margin: 0 0 10px; font-size: 13.5px; color: var(--ui-texto-2); line-height: 1.45; }
        .pvc--erro button { min-height: 44px; border: 1.5px solid var(--ui-borda-campo); background: var(--ui-branco); border-radius: var(--ui-raio-p); padding: 0 14px; font-family: inherit; font-size: 13.5px; font-weight: 700; color: var(--ui-texto); cursor: pointer; }
`;

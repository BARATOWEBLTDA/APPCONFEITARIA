import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";
import { verificarAvisosPro } from "@/lib/notificacoesUsuario";
import { CONQUISTAS, marcarConquista, proximaConquista, sincronizarConquistas, type ResultadoConquistas } from "@/lib/conquistas";

/** Cartão "🏆 Suas conquistas" do Início + comemoração da conquista nova (aprovado 30/09, vinho) */
export default function ConquistasCard() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { isPro } = usePlano();
  const [r, setR] = useState<ResultadoConquistas | null>(null);
  const [celebrar, setCelebrar] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    verificarAvisosPro(profile); // PRO vencendo / mensalidade atrasada
    sincronizarConquistas(profile, isPro).then(res => {
      if (!res) return;
      setR(res);
      const pend = CONQUISTAS.filter(q => res.feitas[q.codigo] && !res.feitas[q.codigo].celebrada);
      if (pend.length) setCelebrar(pend[pend.length - 1].codigo);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, isPro]);

  if (!r) return null;
  const nova = [...CONQUISTAS].reverse().find(q => r.feitas[q.codigo] && !r.feitas[q.codigo].vista);
  const prox = proximaConquista(r);
  const qCel = celebrar ? CONQUISTAS.find(q => q.codigo === celebrar) : null;
  const nome = (profile?.nome || "").split(" ")[0];

  // ✕ tira do cartão todas as conquistas novas de uma vez
  const fecharNova = () => {
    const pend = CONQUISTAS.filter(q => r.feitas[q.codigo] && !r.feitas[q.codigo].vista);
    pend.forEach(q => marcarConquista(q.codigo, { vista: true }));
    setR({ ...r, feitas: Object.fromEntries(Object.entries(r.feitas).map(([k, v]) => [k, { ...v, vista: true }])) });
  };
  const fecharCel = () => {
    if (!celebrar) return;
    const pend = CONQUISTAS.filter(q => r.feitas[q.codigo] && !r.feitas[q.codigo].celebrada);
    pend.forEach(q => marcarConquista(q.codigo, { celebrada: true }));
    setR({ ...r, feitas: Object.fromEntries(Object.entries(r.feitas).map(([k, v]) => [k, { ...v, celebrada: true }])) });
    setCelebrar(null);
  };

  return (
    <>
      <div className="cqc">
        <div className="cqc-h"><span>🏆 Suas conquistas</span><button type="button" onClick={() => navigate("/conquistas")}>Ver todas ›</button></div>
        {nova && (
          <div className="cqc-nova">
            <div className="cqc-medal" aria-hidden="true">{nova.emoji}</div>
            <div className="cqc-tx"><small>NOVA CONQUISTA</small><b>{nova.nome}!</b><p>{nova.descricao}</p></div>
            <button type="button" className="cqc-x" onClick={fecharNova} aria-label="Fechar">✕</button>
          </div>
        )}
        {prox && (
          <div className="cqc-prox">
            <div className="cqc-pl"><span>Próxima: <b>{prox.nome}</b></span><span>{Math.min(r.valores[prox.metrica], prox.alvo)} de {prox.alvo}</span></div>
            <div className="cqc-bar"><i style={{ width: `${Math.min(100, (r.valores[prox.metrica] / prox.alvo) * 100)}%` }} /></div>
          </div>
        )}
      </div>

      {qCel && createPortal(
        <div className="cqc-ov" onClick={fecharCel}>
          <div className="cqc-pop" onClick={e => e.stopPropagation()} role="dialog" aria-label="Nova conquista">
            <div className="cqc-conf" aria-hidden="true">{[[10, 20, "#E85A8C", 20], [25, 6, "#FCD34D", -30], [42, 30, "#86EFAC", 45], [60, 8, "#93C5FD", -15], [78, 26, "#F5B8CD", 60], [90, 10, "#C4B5FD", -40]].map(([l, t, cor, rot], i) =>
              <i key={i} style={{ left: `${l}%`, top: Number(t), background: String(cor), transform: `rotate(${rot}deg)` }} />)}</div>
            <div className="cqc-medal cqc-medal--big" aria-hidden="true">{qCel.emoji}</div>
            <small className="cqc-pk">NOVA CONQUISTA</small>
            <h3>{qCel.nome}!</h3>
            <p>{nome ? `Parabéns, ${nome}! ` : "Parabéns! "}{qCel.descricao}</p>
            <button type="button" className="cqc-b1" onClick={() => { fecharCel(); navigate("/conquistas"); }}>Ver minhas conquistas</button>
            <button type="button" className="cqc-b2" onClick={fecharCel}>Fechar</button>
          </div>
        </div>, document.body)}

      <style>{CSS_CONQ}</style>
    </>
  );
}

export const CSS_CONQ = `
  .cqc { margin: 16px 0 0; border-radius: 16px; padding: 14px; background: linear-gradient(150deg, #3B1620 0%, #5A1F36 55%, #7A2A4A 100%); position: relative; box-shadow: 0 10px 24px rgba(59,22,32,.28); font-family: var(--font-base); }
  .cqc::before { content: ""; position: absolute; inset: 0; border-radius: 16px; padding: 1.5px; background: linear-gradient(120deg, #F9A8D4, #C4B5FD, #93C5FD, #F9A8D4); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; opacity: .75; pointer-events: none; }
  .cqc-h { display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 800; color: #fff; }
  .cqc-h button { border: none; background: none; font-family: inherit; font-size: 12.5px; font-weight: 700; color: #F9A8D4; cursor: pointer; padding: 2px; }
  .cqc-nova { display: flex; gap: 12px; align-items: center; background: #fff; border-radius: 12px; padding: 12px 30px 12px 12px; margin-top: 10px; position: relative; }
  .cqc-medal { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; background: radial-gradient(circle at 30% 30%, #FFF1F6, #F5B8CD 55%, #E85A8C); box-shadow: 0 0 0 3px #FCE7F3, 0 4px 12px rgba(195,58,110,.35); }
  .cqc-medal--big { width: 84px; height: 84px; font-size: 40px; margin: 6px auto 10px; }
  .cqc-tx small, .cqc-pk { font-size: 10px; font-weight: 800; letter-spacing: .08em; background: linear-gradient(90deg, #E85A8C, #8B5CF6, #3B82F6); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .cqc-tx b { display: block; font-size: 15px; color: #2C1219; } .cqc-tx p { font-size: 12.5px; color: #6B5D64; margin: 2px 0 0; line-height: 1.4; }
  .cqc-x { position: absolute; top: 6px; right: 6px; border: none; background: none; color: #C4B8BE; font-size: 12px; cursor: pointer; padding: 4px; }
  .cqc-prox { margin-top: 12px; }
  .cqc-pl { display: flex; justify-content: space-between; font-size: 12.5px; color: rgba(255,255,255,.85); } .cqc-pl b { color: #fff; }
  .cqc-bar { height: 7px; border-radius: 4px; background: rgba(255,255,255,.15); margin-top: 6px; overflow: hidden; }
  .cqc-bar i { display: block; height: 100%; background: linear-gradient(90deg, #E85A8C, #C4B5FD); border-radius: 4px; }
  .cqc-ov { position: fixed; inset: 0; z-index: 900; background: rgba(45,31,38,.55); display: flex; align-items: center; justify-content: center; padding: 20px; font-family: var(--font-base); }
  .cqc-pop { width: 100%; max-width: 340px; background: linear-gradient(180deg, #FFF6F9, #fff 45%); border-radius: 22px; padding: 22px 20px 14px; text-align: center; position: relative; overflow: hidden; animation: cqcPop .4s cubic-bezier(.2,1.4,.4,1) both; }
  @keyframes cqcPop { from { transform: scale(.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .cqc-conf { position: absolute; left: 0; right: 0; top: 0; height: 60px; } .cqc-conf i { position: absolute; width: 7px; height: 12px; border-radius: 2px; }
  .cqc-pop h3 { font-size: 21px; font-weight: 900; margin: 4px 0 6px; color: #2C1219; } .cqc-pop p { font-size: 13.5px; color: #6B5D64; line-height: 1.5; margin: 0; }
  .cqc-b1 { width: 100%; margin-top: 16px; border: none; background: #E85A8C; color: #fff; font-family: inherit; font-size: 14.5px; font-weight: 800; border-radius: 10px; padding: 13px; box-shadow: 0 3px 0 #C33A6E; cursor: pointer; }
  .cqc-b2 { width: 100%; margin-top: 4px; border: none; background: none; font-family: inherit; font-size: 13.5px; font-weight: 700; color: #6B5D64; padding: 10px; cursor: pointer; }
`;

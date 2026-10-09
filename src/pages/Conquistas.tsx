import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { useProfile } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";
import { CONQUISTAS, GRUPOS, sincronizarConquistas, type ResultadoConquistas } from "@/lib/conquistas";

/** "Minhas conquistas" — todas as medalhas (aprovado 30/09) */
export default function Conquistas() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { isPro } = usePlano();
  const [r, setR] = useState<ResultadoConquistas | null>(null);
  useEffect(() => { if (profile) sincronizarConquistas(profile, isPro).then(setR); }, [profile?.id, isPro]);

  const feitas = r ? CONQUISTAS.filter(q => r.feitas[q.codigo]).length : 0;
  const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const frase = feitas === 0 ? "Sua primeira conquista está logo ali!" : feitas < 6 ? "Você está começando bem!" : feitas < 15 ? "Você está voando!" : "Você é uma lenda da confeitaria!";

  return (
    <div className="cqp">
      <AppPageHeader title="Minhas conquistas" subtitle={r ? `${feitas} de ${CONQUISTAS.length} conquistadas` : "Carregando…"} onBack={() => navigate(-1)} />
      <div className="cqp-wrap">
        <div className="cqp-sum">
          <div className="cqp-ring" style={{ background: `conic-gradient(#E85A8C ${(feitas / CONQUISTAS.length) * 360}deg, #F5E1EA 0)` }}>
            <div><b>{feitas}</b><small>/{CONQUISTAS.length}</small></div>
          </div>
          <div><b>{frase}</b><p>Continue vendendo e cadastrando pra desbloquear as próximas medalhas.</p></div>
        </div>
        {r && GRUPOS.map(g => (
          <div key={g}>
            <p className="cqp-sec">{g}</p>
            <div className="cqp-grid">
              {CONQUISTAS.filter(q => q.grupo === g).map(q => {
                const f = r.feitas[q.codigo];
                const v = Math.min(r.valores[q.metrica], q.alvo);
                return (
                  <div key={q.codigo} className={`cqp-bd${f ? "" : " off"}`}>
                    <div className={`cqp-medal${f ? "" : " off"}`} aria-hidden="true">{q.emoji}</div>
                    <b>{q.nome}</b>
                    <small>{f ? `Conquistado ${data(f.conquistada_em)}` : q.metrica === "pro" ? "Ative o PRO" : `${v} de ${q.alvo}`}</small>
                    {!f && q.alvo > 1 && <div className="cqp-mini"><i style={{ width: `${(v / q.alvo) * 100}%` }} /></div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .cqp { font-family: var(--font-base); color: #2C1219; }
        .cqp-wrap { max-width: 760px; margin: 0 auto; padding: 14px 14px 40px; }
        .cqp-sum { display: flex; gap: 14px; align-items: center; background: #fff; border: 1px solid #F0EBED; border-radius: 14px; padding: 14px; }
        .cqp-ring { width: 68px; height: 68px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cqp-ring > div { width: 54px; height: 54px; border-radius: 50%; background: #fff; display: flex; align-items: baseline; justify-content: center; padding-top: 14px; }
        .cqp-ring b { font-size: 20px; font-weight: 900; color: #3B1620; } .cqp-ring small { font-size: 12px; color: #C33A6E; font-weight: 700; }
        .cqp-sum > div:last-child b { font-size: 14.5px; } .cqp-sum p { font-size: 12.5px; color: #6B5D64; margin: 2px 0 0; line-height: 1.4; }
        .cqp-sec { margin: 18px 2px 8px; font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #9A8E94; }
        .cqp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        @media (min-width: 700px) { .cqp-grid { grid-template-columns: repeat(5, 1fr); } }
        .cqp-bd { background: #fff; border: 1px solid #F0EBED; border-radius: 12px; padding: 12px 6px 10px; text-align: center; display: flex; flex-direction: column; align-items: center; }
        .cqp-bd b { font-size: 12px; margin-top: 8px; line-height: 1.2; } .cqp-bd small { font-size: 12px; color: #9A8E94; margin-top: 3px; }
        .cqp-bd.off b { color: #9A8E94; }
        .cqp-medal { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; background: radial-gradient(circle at 30% 30%, #FFF1F6, #F5B8CD 55%, #E85A8C); box-shadow: 0 0 0 3px #FCE7F3, 0 4px 12px rgba(195,58,110,.3); }
        .cqp-medal.off { background: #EFEAEC; filter: grayscale(1); opacity: .55; box-shadow: 0 0 0 3px #F5F0F2; }
        .cqp-mini { width: 70%; height: 4px; border-radius: 2px; background: #F0EBED; margin-top: 6px; overflow: hidden; } .cqp-mini i { display: block; height: 100%; background: #E85A8C; }
      `}</style>
    </div>
  );
}

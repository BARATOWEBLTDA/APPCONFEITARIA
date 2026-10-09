import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { usePlano } from "@/hooks/usePlano";
import { useProfile } from "@/hooks/useProfile";
import { abrirDooIA } from "@/components/MenuContaItens";

/**
 * "Parabéns, agora você é PRO" (aprovado 01/10): aparece UMA vez, na hora em que o plano vira PRO
 * (o app escuta o perfil em tempo real e relê ao voltar pro app). Fica no Layout, então vale em qualquer tela.
 */
const CONFETE: [number, number, string, number, number][] = [
  [8, -10, "#E85A8C", 20, 2.6], [22, -40, "#FCD34D", -30, 3.2], [38, -20, "#86EFAC", 45, 2.4], [58, -55, "#93C5FD", -15, 3.0],
  [74, -15, "#F5B8CD", 60, 2.8], [90, -45, "#C4B5FD", -40, 3.4], [14, -70, "#FCD34D", 10, 2.2], [84, -80, "#E85A8C", -60, 2.9],
  [48, -90, "#F9A8D4", 30, 3.1], [30, -110, "#86EFAC", -20, 2.7],
];

export default function ParabensPro() {
  const navigate = useNavigate();
  const { isPro, loading } = usePlano();
  const { profile } = useProfile();
  const [aberto, setAberto] = useState(false);
  const chave = profile?.id ? `doonly_pro_celebrado_${profile.id}` : "";

  useEffect(() => {
    if (loading || !chave) return;
    let celebrado = true;
    try { celebrado = !!localStorage.getItem(chave); } catch {}
    if (!isPro && celebrado) { try { localStorage.removeItem(chave); } catch {} }
    if (!isPro || celebrado) return;
    // 02/10: só abre depois de confirmar no banco que a conta LOGADA é PRO
    // (numa conta nova, um "PRO" de passagem abria a tela e ela ficava aberta)
    let vivo = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== profile?.id) return;
      const { data } = await supabase.from("profiles").select("plano, pro_expira_em").eq("id", user.id).maybeSingle();
      const exp = data?.pro_expira_em ? new Date(data.pro_expira_em) : null;
      const proDeVerdade = data?.plano === "pro" && (!exp || exp > new Date());
      if (vivo && proDeVerdade) setAberto(true);
    })().catch(() => {});
    return () => { vivo = false; };
  }, [isPro, loading, chave]); // eslint-disable-line react-hooks/exhaustive-deps
  // Deixou de ser PRO (ou trocou de conta) com a tela aberta: fecha
  useEffect(() => { if (!isPro) setAberto(false); }, [isPro]);

  if (!aberto) return null;
  const fechar = () => { try { localStorage.setItem(chave, new Date().toISOString()); } catch {} setAberto(false); };
  const nome = String(profile?.nome || "").trim().split(" ")[0];

  return createPortal(
    <div className="ppr-ov" role="dialog" aria-label="Parabéns, você agora é PRO" onClick={fechar}>
      <div className="ppr" onClick={e => e.stopPropagation()}>
        <div className="ppr-conf" aria-hidden="true">
          {CONFETE.map(([l, t, c, r, d], i) => <i key={i} style={{ left: `${l}%`, top: t, background: c, transform: `rotate(${r}deg)`, animationDuration: `${d}s`, animationDelay: `${(i % 4) * 0.25}s` }} />)}
        </div>
        <div className="ppr-cr"><img src="/coroa.png" alt="" /></div>
        <p className="ppr-k">BEM-VINDA AO DOONLY PRO</p>
        <h2>{nome ? `Parabéns, ${nome}!` : "Parabéns!"}<br />Agora você é <span>PRO</span></h2>
        <p className="ppr-s">Todos os recursos PRO já estão liberados.</p>
        <button type="button" className="ppr-ia" onClick={() => { fechar(); abrirDooIA(); }}>
          <img src="/ia.png" alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          Falar com o Doo IA
        </button>
        <button type="button" className="ppr-b1" onClick={fechar}>Começar a usar</button>
        <button type="button" className="ppr-b2" onClick={() => { fechar(); navigate("/minha-assinatura"); }}>Ver minha assinatura</button>
      </div>
      <style>{`
        .ppr-ov { position: fixed; inset: 0; z-index: 3000; background: rgba(26,11,16,.62); display: flex; align-items: center; justify-content: center; padding: 18px; font-family: var(--font-base); }
        .ppr { position: relative; width: 100%; max-width: 360px; border-radius: 24px; padding: 22px 20px 14px; text-align: center; color: #fff; overflow: hidden;
          background: radial-gradient(130% 80% at 50% 0%, #6B2340, #2C1219 60%, #1A0B10); box-shadow: 0 30px 60px rgba(0,0,0,.45); animation: pprIn .45s cubic-bezier(.2,1.3,.4,1) both; }
        @keyframes pprIn { from { transform: scale(.88); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .ppr-conf { position: absolute; inset: 0; pointer-events: none; }
        .ppr-conf i { position: absolute; width: 8px; height: 14px; border-radius: 2px; animation-name: pprCai; animation-timing-function: linear; animation-iteration-count: infinite; }
        @keyframes pprCai { 0% { translate: 0 -30px; rotate: 0deg; opacity: 1; } 100% { translate: 0 640px; rotate: 540deg; opacity: .9; } }
        .ppr-cr { position: relative; width: 76px; height: 76px; border-radius: 22px; margin: 14px auto 12px; display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, rgba(249,168,212,.28), rgba(196,181,253,.22)); border: 1px solid rgba(249,168,212,.4); box-shadow: 0 0 40px rgba(232,90,140,.45); }
        .ppr-cr img { width: 46px; height: 46px; object-fit: contain; }
        .ppr-k, .ppr h2 span { background: linear-gradient(90deg, #F9A8D4, #C4B5FD, #93C5FD); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .ppr-k { position: relative; font-size: 12px; font-weight: 700; letter-spacing: .16em; margin: 0; }
        .ppr h2 { position: relative; font-size: 23px; font-weight: 800; line-height: 1.2; margin: 6px 0 0; color: #fff; }
        .ppr-s { position: relative; font-size: 13.5px; color: rgba(255,255,255,.75); margin: 8px auto 0; max-width: 290px; text-wrap: balance; }
        .ppr h2 { text-wrap: balance; }
        .ppr-ia { position: relative; width: 100%; margin-top: 14px; display: flex; align-items: center; justify-content: center; gap: 10px; border: none; border-radius: 12px; padding: 11px 12px;
          background: rgba(255,255,255,.09); color: #fff; font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
        .ppr-ia img { width: 28px; height: 28px; object-fit: contain; }
        .ppr-b1 { position: relative; width: 100%; margin-top: 12px; border: none; border-radius: 12px; padding: 14px; font-family: inherit; font-size: 15px; font-weight: 700; color: #fff; cursor: pointer;
          background: linear-gradient(90deg, #E85A8C, #C33A6E); box-shadow: 0 8px 24px rgba(232,90,140,.45); }
        .ppr-b2 { position: relative; width: 100%; margin-top: 4px; border: none; background: none; font-family: inherit; font-size: 13px; color: rgba(255,255,255,.72); padding: 10px; cursor: pointer; }
      `}</style>
    </div>,
    document.body
  );
}

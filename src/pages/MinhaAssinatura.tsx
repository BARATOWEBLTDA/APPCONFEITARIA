import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { CaretRight, ChatCircleDots } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { usePlano } from "@/hooks/usePlano";
import { useProfile } from "@/hooks/useProfile";

/** "Minha assinatura" (aprovado 01/10): pra quem já é PRO. Quem não é PRO vai pra página de assinar. */
const WHATSAPP_EQUIPE = "5541998843669";
const VALOR = "R$ 29,90/mês";
const dataBR = (d?: Date | null) => (d ? d.toLocaleDateString("pt-BR") : "—");

export default function MinhaAssinatura() {
  const navigate = useNavigate();
  const { isPro, proExpiraEm, loading } = usePlano();
  const { profile } = useProfile();
  const [desde, setDesde] = useState<Date | null>(null);

  useEffect(() => { if (!loading && !isPro) navigate("/assinar", { replace: true }); }, [loading, isPro, navigate]);

  // "Assinante desde": a data em que ganhou a conquista "Virou PRO" (guardada quando o PRO foi ativado)
  useEffect(() => {
    if (!profile?.id) return;
    supabase.from("conquistas_usuario").select("conquistada_em").eq("user_id", profile.id).eq("codigo", "pro").maybeSingle()
      .then(({ data }) => { if ((data as any)?.conquistada_em) setDesde(new Date((data as any).conquistada_em)); });
  }, [profile?.id]);

  const dias = proExpiraEm ? Math.max(0, Math.ceil((proExpiraEm.getTime() - Date.now()) / 86400000)) : null;
  const whats = (assunto: string) => {
    const quem = [profile?.nome, (profile as any)?.nome_loja].filter(Boolean).join(" · ");
    const msg = `Olá! ${assunto}${quem ? `\nNome: ${quem}` : ""}${(profile as any)?.email ? `\nE-mail da conta: ${(profile as any).email}` : ""}`;
    window.open(`https://wa.me/${WHATSAPP_EQUIPE}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="mas-root">
      <AppPageHeader title="Minha assinatura" subtitle="Seu plano PRO" onBack={() => navigate(-1)} />
      <div className="mas-wrap">
        <div className="mas-card">
          <div className="mas-top">
            <div className="mas-cr"><img src="/coroa.png" alt="" /></div>
            <div className="mas-tt"><p className="mas-k">DOONLY PRO</p><b>Plano PRO ativo</b></div>
            <span className="mas-at">● Ativo</span>
          </div>
          <div className="mas-g">
            <div><small>Assinante desde</small><b>{dataBR(desde)}</b></div>
            <div><small>Próxima renovação</small><b>{dataBR(proExpiraEm)}</b></div>
            <div><small>Valor</small><b>{VALOR}</b></div>
            <div><small>Faltam</small><b>{dias == null ? "—" : `${dias} dia${dias !== 1 ? "s" : ""}`}</b></div>
          </div>
        </div>

        <p className="mas-sec">Precisa de algo?</p>
        <button type="button" className="mas-op" onClick={() => whats("Preciso de ajuda com a minha assinatura do Doonly PRO.")}>
          <span><ChatCircleDots size={20} weight="bold" /> Falar com a equipe</span><CaretRight size={18} weight="bold" aria-hidden="true" />
        </button>
        <p className="mas-cancel">Quer mudar ou cancelar o plano? <button type="button" onClick={() => whats("Quero mudar ou cancelar meu plano do Doonly PRO.")}>Fale com a gente</button></p>
      </div>
      <style>{`
        .mas-root { font-family: var(--font-base); color: #2C1219; }
        .mas-wrap { max-width: 560px; margin: 0 auto; padding: 14px 14px 40px; }
        .mas-card { border-radius: 18px; padding: 16px; color: #fff; background: radial-gradient(130% 90% at 50% 0%, #6B2340, #2C1219 65%, #1A0B10); box-shadow: 0 10px 30px rgba(44,18,25,.3); }
        .mas-top { display: flex; gap: 12px; align-items: center; }
        .mas-cr { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; background: rgba(249,168,212,.2); border: 1px solid rgba(249,168,212,.35); flex-shrink: 0; }
        .mas-cr img { width: 30px; height: 30px; object-fit: contain; }
        .mas-tt { min-width: 0; } .mas-tt b { font-size: 17px; }
        .mas-k { font-size: 12px; font-weight: 900; letter-spacing: .16em; margin: 0; background: linear-gradient(90deg, #F9A8D4, #C4B5FD, #93C5FD); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .mas-at { margin-left: auto; font-size: 12px; font-weight: 800; color: #86EFAC; background: rgba(134,239,172,.12); padding: 4px 8px; border-radius: 999px; white-space: nowrap; }
        .mas-g { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
        .mas-g div { background: rgba(255,255,255,.07); border-radius: 12px; padding: 10px; }
        .mas-g small { display: block; font-size: 12px; color: rgba(255,255,255,.6); } .mas-g b { font-size: 14px; }
        .mas-sec { margin: 18px 4px 8px; font-size: 12px; font-weight: 800; letter-spacing: .06em; color: #9A8E94; }
        .mas-op { width: 100%; display: flex; justify-content: space-between; align-items: center; background: #fff; border: 1px solid #F0EBED; border-radius: 14px; padding: 14px; font-family: inherit; font-size: 14px; font-weight: 700; color: #2C1219; cursor: pointer; }
        .mas-op i { font-style: normal; color: #C4B8BE; font-size: 18px; }
        .mas-cancel { text-align: center; font-size: 12px; color: #B5AAB0; margin: 20px 0 0; }
        .mas-cancel button { border: none; background: none; padding: 0; font-family: inherit; font-size: 12px; color: #9A8E94; text-decoration: underline; cursor: pointer; }
      `}</style>
    </div>
  );
}

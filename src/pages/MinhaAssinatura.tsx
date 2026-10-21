import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { CaretRight, Check, Crown, Receipt } from "@phosphor-icons/react";
import IconeWhatsApp from "@/components/IconeWhatsApp";
import { supabase } from "@/lib/supabase";
import { usePlano } from "@/hooks/usePlano";
import { useProfile, refreshProfile } from "@/hooks/useProfile";
import { voltarOuIr } from "@/lib/voltar"; // 11/10: seta de voltar que funciona com a tela aberta direto

/**
 * "Minha assinatura" (aprovado 01/10; refeita 21/10): pra quem já é PRO. Quem não é PRO vai pra página de assinar.
 * (21/10) O valor em destaque e só linhas com informação (sem "—"); o que está liberado; duas ajudas claras
 * (WhatsApp da equipe e a área de compras da Hotmart, com os recibos). Computador em duas colunas.
 */
const WHATSAPP_EQUIPE = "5511978414991";
const VALOR = "R$ 29,90";
/** Área do comprador da Hotmart: compras, assinaturas e recibos */
const HOTMART_COMPRAS = "https://consumer.hotmart.com/purchase";
const LIBERADO = ["Doo IA, sua assistente", "Lucro de cada produto", "Cupons e banners no cardápio"];
const dataBR = (d: Date) => d.toLocaleDateString("pt-BR");
const diaMes = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

export default function MinhaAssinatura() {
  const navigate = useNavigate();
  const { isPro, proExpiraEm } = usePlano();
  const { profile } = useProfile();
  const [desde, setDesde] = useState<Date | null>(null);
  const [computador, setComputador] = useState(() => window.matchMedia("(min-width: 901px)").matches);
  useEffect(() => { const mq = window.matchMedia("(min-width: 901px)"); const f = () => setComputador(mq.matches); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);

  // (21/10) só manda pra "Assinar" depois de conferir o perfil no banco: com o perfil antigo guardado no aparelho
  // (de antes de virar PRO), a tela mandava a confeiteira PRO pra página de assinar
  const [conferido, setConferido] = useState(false);
  useEffect(() => { let vivo = true; refreshProfile().finally(() => { if (vivo) setConferido(true); }); return () => { vivo = false; }; }, []);
  useEffect(() => { if (conferido && !isPro) navigate("/assinar", { replace: true }); }, [conferido, isPro, navigate]);

  // (21/10) "Assinante desde": a data gravada quando o PRO ligou (profiles.pro_desde); a conquista fica só de reserva
  const proDesde = (profile as any)?.pro_desde ? new Date((profile as any).pro_desde) : null;
  useEffect(() => {
    if (!profile?.id || proDesde) return;
    supabase.from("conquistas_usuario").select("conquistada_em").eq("user_id", profile.id).eq("codigo", "pro").maybeSingle()
      .then(({ data }) => { if ((data as any)?.conquistada_em) setDesde(new Date((data as any).conquistada_em)); });
  }, [profile?.id, !!proDesde]); // eslint-disable-line react-hooks/exhaustive-deps
  const assinanteDesde = proDesde || desde;

  const dias = proExpiraEm ? Math.max(0, Math.ceil((proExpiraEm.getTime() - Date.now()) / 86400000)) : null;
  const whats = () => {
    const quem = [profile?.nome, (profile as any)?.nome_loja].filter(Boolean).join(" · ");
    const msg = `Olá! Tenho uma dúvida sobre a minha assinatura do Doonly PRO.${quem ? `\nNome: ${quem}` : ""}${(profile as any)?.email ? `\nE-mail da conta: ${(profile as any).email}` : ""}`;
    window.open(`https://wa.me/${WHATSAPP_EQUIPE}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (!isPro) return <div className="mas-root"><AppPageHeader title="Minha assinatura" subtitle="Seu plano PRO" /></div>;

  return (
    <div className="mas-root">
      <AppPageHeader title="Minha assinatura" subtitle="Seu plano PRO" onBack={computador ? undefined : () => voltarOuIr(navigate, "/configuracoes")} />
      <div className="mas-wrap">
        <div className="mas-col">
          <section className="mas-c">
            <div className="mas-top">
              <span className="mas-cr"><Crown size={24} weight="fill" aria-hidden="true" /></span>
              <b>Doonly PRO</b>
              <span className="mas-at">Ativo</span>
            </div>
            <p className="mas-v">{VALOR} <small>por mês</small></p>
            {assinanteDesde && <div className="mas-l">Assinante desde<b>{dataBR(assinanteDesde)}</b></div>}
            <div className="mas-l">Pagamento<b>Hotmart, todo mês</b></div>
            <div className="mas-l">Próxima cobrança<b>{proExpiraEm ? `${diaMes(proExpiraEm)} · ${dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`}` : "Veja na Hotmart"}</b></div>
          </section>

          <section className="mas-c">
            <p className="mas-h">O que está liberado</p>
            {LIBERADO.map(t => <div key={t} className="mas-li"><i aria-hidden="true"><Check size={12} weight="bold" /></i>{t}</div>)}
            <button type="button" className="mas-lk" onClick={() => navigate("/assinar")}>Ver os 13 recursos <CaretRight size={14} weight="bold" aria-hidden="true" /></button>
          </section>
        </div>

        <section className="mas-c">
          <p className="mas-h">Precisa de algo?</p>
          <button type="button" className="mas-op" onClick={whats}>
            <span className="mas-op-ic"><IconeWhatsApp size={20} /></span>
            <span className="mas-op-tx"><b>Dúvidas ou cancelamento</b><small>WhatsApp da equipe Doonly</small></span>
            <CaretRight size={18} weight="bold" className="mas-op-s" aria-hidden="true" />
          </button>
          <a className="mas-op" href={HOTMART_COMPRAS} target="_blank" rel="noopener noreferrer">
            <span className="mas-op-ic"><Receipt size={20} weight="fill" /></span>
            <span className="mas-op-tx"><b>Pagamentos e recibos</b><small>Área de compras da Hotmart</small></span>
            <CaretRight size={18} weight="bold" className="mas-op-s" aria-hidden="true" />
          </a>
        </section>
      </div>
      <style>{`
        .mas-root { font-family: var(--font-base); color: var(--ui-texto); }
        .mas-wrap { display: flex; flex-direction: column; gap: 14px; max-width: 560px; margin: 0 auto; padding: 16px 16px 100px; }
        .mas-col { display: flex; flex-direction: column; gap: 14px; }
        .mas-c { padding: 16px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); background: var(--ui-branco); }
        .mas-top { display: flex; align-items: center; gap: 12px; }
        .mas-cr { flex: none; display: flex; align-items: center; justify-content: center; width: 46px; height: 46px; border-radius: 14px; background: var(--chocolate); color: #F5C76B; }
        .mas-top b { flex: 1; font-size: 17px; font-weight: 700; }
        .mas-at { padding: 4px 10px; border-radius: 999px; background: #E7F6EC; color: #15803D; font-size: 13px; font-weight: 700; }
        .mas-v { margin: 14px 0 6px; font-size: 28px; font-weight: 700; color: var(--ui-texto); }
        .mas-v small { font-size: 15px; font-weight: 500; color: var(--ui-texto-2); }
        .mas-l { display: flex; justify-content: space-between; gap: 10px; padding: 11px 0; border-top: 1px solid var(--ui-linha); font-size: 14.5px; color: var(--ui-texto-2); }
        .mas-l b { font-weight: 600; color: var(--ui-texto); white-space: nowrap; }
        .mas-h { margin: 0 0 8px; font-size: 15px; font-weight: 700; color: var(--ui-texto); }
        .mas-li { display: flex; align-items: center; gap: 10px; padding: 8px 0; font-size: 14.5px; }
        .mas-li i { flex: none; display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #E7F6EC; color: #15803D; }
        .mas-lk { display: inline-flex; align-items: center; gap: 2px; min-height: 40px; margin: 2px 0 -8px; padding: 0; border: 0; background: none; font-family: inherit; font-size: 14px; font-weight: 700; color: var(--ui-rosa-escuro); cursor: pointer; }
        .mas-op { display: flex; align-items: center; gap: 12px; width: 100%; margin: 0; padding: 12px 0; border: 0; border-top: 1px solid var(--ui-linha); background: none; font-family: inherit; text-align: left; color: var(--ui-texto); text-decoration: none; cursor: pointer; }
        .mas-h + .mas-op { border-top: 0; }
        .mas-op-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 10px; background: var(--ui-ic-fundo); color: var(--ui-ic-cor); }
        .mas-op-tx { flex: 1; min-width: 0; }
        .mas-op-tx b, .mas-op-tx small { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .mas-op-tx b { font-size: 15px; font-weight: 700; }
        .mas-op-tx small { margin-top: 2px; font-size: 13px; color: var(--ui-texto-2); }
        .mas-op-s { flex: none; color: var(--ui-texto-3); }
        @media (min-width: 901px) {
          .mas-wrap { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); align-items: start; gap: 20px; max-width: 1066px; padding: 24px 0 40px; }
          .mas-col { gap: 20px; }
        }
      `}</style>
    </div>
  );
}

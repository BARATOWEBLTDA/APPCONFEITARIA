import { COMO_ASSINATURA, TOUR_ASSINATURA } from "@/lib/comoTelas";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { CaretRight, Check, Crown, HandHeart, Receipt } from "@phosphor-icons/react";
import { pedirMontagem } from "@/components/billing/EquipeMonta";
import IconeWhatsApp from "@/components/IconeWhatsApp";
import { supabase } from "@/lib/supabase";
import { usePlano } from "@/hooks/usePlano";
import { useProfile, refreshProfile, type Profile } from "@/hooks/useProfile";

/** O perfil com os dados da assinatura (Hotmart) */
type PerfilAssinatura = (Profile & { assinatura_status?: string | null; assinatura_origem?: string | null; email?: string | null; hotmart_transacao?: string | null; hotmart_assinante?: string | null }) | null;
import { BENEFICIOS } from "@/lib/beneficiosPro";
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
const LIBERADO = ["Doo, sua assistente", "Lucro de cada produto", "Cupons e banners no cardápio", "A equipe Doonly monta seu cardápio"];
const dataBR = (d: Date) => d.toLocaleDateString("pt-BR");
// (31/10 · 5.84) com o ano quando não é o deste ano (antes "27/09" podia ser de qualquer ano)
const diaMes = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}${d.getFullYear() !== new Date().getFullYear() ? "/" + d.getFullYear() : ""}`;

export default function MinhaAssinatura() {
  const navigate = useNavigate();
  const { isPro, proExpiraEm, loading: carregandoPlano } = usePlano();
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
  const proDesde = profile?.pro_desde ? new Date(profile.pro_desde) : null;
  useEffect(() => {
    if (!profile?.id || proDesde) return;
    supabase.from("conquistas_usuario").select("conquistada_em").eq("user_id", profile.id).eq("codigo", "pro").maybeSingle()
      .then(({ data }) => { if ((data as { conquistada_em?: string | null } | null)?.conquistada_em) setDesde(new Date((data as { conquistada_em: string }).conquistada_em)); });
  }, [profile?.id, !!proDesde]); // eslint-disable-line react-hooks/exhaustive-deps
  const assinanteDesde = proDesde || desde;

  // (31/10 · 5.97) nos 7 dias grátis: selo "Teste grátis" e a 1ª cobrança no lugar da próxima (o webhook grava "teste")
  const emTeste = (profile as PerfilAssinatura)?.assinatura_status === "teste";
  // o webhook guarda o PRO até a cobrança + uma folga (3 dias; 1 no teste): a data da cobrança é sem a folga
  const folga = (profile as PerfilAssinatura)?.assinatura_origem === "hotmart" ? (emTeste ? 1 : 3) : 0;
  const cobranca = proExpiraEm ? new Date(proExpiraEm.getTime() - folga * 86400000) : null;
  const dias = cobranca ? Math.max(0, Math.ceil((cobranca.getTime() - Date.now()) / 86400000)) : null;
  // (6.174) o que diz a assinatura de verdade: cancelada (PRO até o fim do pago), pagamento atrasado ou PRO dado pela equipe
  const pa = profile as PerfilAssinatura;
  const status = pa?.assinatura_status || "";
  const daHotmart = pa?.assinatura_origem === "hotmart";
  const cancelada = daHotmart && status === "cancelada";
  const atrasada = daHotmart && status === "atrasada";
  const pelaEquipe = !emTeste && (pa?.assinatura_origem === "admin" || (!pa?.assinatura_origem && !pa?.hotmart_transacao && !pa?.hotmart_assinante));
  const ate = proExpiraEm ? diaMes(proExpiraEm) : "";
  const semFim = dias != null && dias > 400;
  const [emailConta, setEmailConta] = useState("");
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setEmailConta(data.user?.email || "")).catch(() => {}); }, []);
  const whats = () => {
    const quem = [profile?.nome, profile?.nome_loja].filter(Boolean).join(" · ");
    const msg = `Olá! Tenho uma dúvida sobre a minha assinatura do Doonly PRO.${quem ? `\nNome: ${quem}` : ""}${emailConta ? `\nE-mail da conta: ${emailConta}` : ""}`;
    window.open(`https://wa.me/${WHATSAPP_EQUIPE}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // (27/10) conta grátis ou PRO vencido: vai para a página do PRO (antes a tela ficava em branco)
  if (!isPro) return carregandoPlano ? <div className="mas-root"><AppPageHeader title="Minha assinatura" subtitle="Seu plano PRO" /></div> : <Navigate to="/assinar" replace />;

  return (
    <div className="mas-root">
      <AppPageHeader title="Minha assinatura" subtitle="Seu plano PRO" onBack={computador ? undefined : () => voltarOuIr(navigate, "/minha-conta")} infoComo={COMO_ASSINATURA} infoTour={TOUR_ASSINATURA} />
      <div className="mas-wrap">
        <div className="mas-col">
          <section className="mas-c">
            <div className="mas-top">
              <span className="mas-cr"><Crown size={24} weight="fill" aria-hidden="true" /></span>
              <b>Doonly PRO</b>
              <span className={`mas-at${emTeste || cancelada || atrasada ? " mas-at--teste" : ""}`}>{emTeste ? "Teste grátis" : cancelada ? "Cancelada" : atrasada ? "Pagamento atrasado" : "Ativo"}</span>
            </div>
            <p className="mas-v">{emTeste ? <>Grátis <small>até {cobranca ? diaMes(new Date(cobranca.getTime() - 86400000)) : "o 7º dia"}</small></> : pelaEquipe ? <>PRO <small>liberado pela equipe</small></> : <>{VALOR} <small>por mês</small></>}</p>
            {assinanteDesde && <div className="mas-l">Assinante desde<b>{dataBR(assinanteDesde)}</b></div>}
            {pelaEquipe ? (
              <div className="mas-l">PRO até<b>{semFim || !ate ? "Sem vencimento" : ate}</b></div>
            ) : cancelada ? (<>
              <div className="mas-l">Pagamento<b>Cancelado na Hotmart</b></div>
              <div className="mas-l">PRO até<b>{ate || "o fim do mês pago"}</b></div>
            </>) : (<>
              <div className="mas-l">Pagamento<b>{atrasada ? "Atrasado na Hotmart" : emTeste ? `Hotmart, ${VALOR} por mês` : "Hotmart, todo mês"}</b></div>
              <div className="mas-l">{emTeste ? "Primeira cobrança" : atrasada ? "PRO até" : "Próxima cobrança"}<b>{atrasada ? (ate || "Veja na Hotmart") : cobranca && semFim ? "Sem vencimento" : cobranca ? `${diaMes(cobranca)} · ${dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`}` : "Veja na Hotmart"}</b></div>
            </>)}
          </section>

          <section className="mas-c">
            <p className="mas-h">O que está liberado</p>
            {LIBERADO.map(t => <div key={t} className="mas-li"><i aria-hidden="true"><Check size={12} weight="bold" /></i>{t}</div>)}
            <button type="button" className="mas-lk" onClick={() => navigate("/assinar")}>Ver os {BENEFICIOS.length} recursos <CaretRight size={14} weight="bold" aria-hidden="true" /></button>
          </section>
        </div>

        <section className="mas-c">
          <p className="mas-h">Precisa de algo?</p>
          {/* (6.81) a equipe Doonly monta o cardápio (produtos, logo e banners) */}
          <button type="button" className="mas-op" onClick={() => pedirMontagem(profile?.nome as string | undefined, profile?.nome_loja as string | undefined)}>
            <span className="mas-op-ic"><HandHeart size={20} weight="fill" /></span>
            <span className="mas-op-tx"><b>Montar meu cardápio</b><small>A equipe cadastra produtos, logo e banners</small></span>
            <CaretRight size={18} weight="bold" className="mas-op-s" aria-hidden="true" />
          </button>
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
        .mas-top b { flex: 1; font-size: 17px; font-weight: 600; }
        .mas-at--teste { background: #FDF2E2 !important; color: #A15C07 !important; }
        .mas-at { padding: 4px 10px; border-radius: 6px; background: #E7F6EC; color: #166534; font-size: 13px; font-weight: 600; }
        .mas-v { margin: 14px 0 6px; font-size: 28px; font-weight: 600; color: var(--ui-texto); }
        .mas-v small { font-size: 15px; font-weight: 500; color: var(--ui-texto-2); }
        .mas-l { display: flex; justify-content: space-between; gap: 10px; padding: 11px 0; border-top: 1px solid var(--ui-linha); font-size: 14.5px; color: var(--ui-texto-2); }
        .mas-l b { font-weight: 600; color: var(--ui-texto); white-space: nowrap; }
        .mas-h { margin: 0 0 8px; font-size: 15px; font-weight: 600; color: var(--ui-texto); }
        .mas-li { display: flex; align-items: center; gap: 10px; padding: 8px 0; font-size: 14.5px; }
        .mas-li i { flex: none; display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #E7F6EC; color: #15803D; }
        .mas-lk { display: inline-flex; align-items: center; gap: 2px; min-height: 40px; margin: 2px 0 -8px; padding: 0; border: 0; background: none; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--ui-rosa-escuro); cursor: pointer; }
        .mas-op { display: flex; align-items: center; gap: 12px; width: 100%; margin: 0; padding: 12px 0; border: 0; border-top: 1px solid var(--ui-linha); background: none; font-family: inherit; text-align: left; color: var(--ui-texto); text-decoration: none; cursor: pointer; }
        .mas-h + .mas-op { border-top: 0; }
        .mas-op-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 10px; background: var(--ui-ic-fundo); color: var(--ui-ic-cor); }
        .mas-op-tx { flex: 1; min-width: 0; }
        .mas-op-tx b, .mas-op-tx small { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .mas-op-tx b { font-size: 15px; font-weight: 600; }
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

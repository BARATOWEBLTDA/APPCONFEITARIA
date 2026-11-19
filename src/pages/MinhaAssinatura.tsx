import { noAppDaLoja } from "@/lib/plataforma";
import { LINK_ASSINATURAS_GOOGLE } from "@/lib/lojaPagamento";
import { COMO_ASSINATURA, TOUR_ASSINATURA } from "@/lib/comoTelas";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { CaretLeft, CaretRight, Check, HandHeart, Receipt } from "@phosphor-icons/react";
import { LIMITES, SO_PRO, DESTINO } from "@/lib/recursosPro";
import { abrirDooIA } from "@/components/MenuContaItens";
import { pedirMontagem } from "@/components/billing/EquipeMonta";
import IconeWhatsApp from "@/components/IconeWhatsApp";
import { supabase } from "@/lib/supabase";
import { usePlano } from "@/hooks/usePlano";
import { useProfile, refreshProfile, fotoDaLoja, type Profile } from "@/hooks/useProfile";
import "./assinar.css";

/** O perfil com os dados da assinatura (Hotmart) */
type PerfilAssinatura = (Profile & { assinatura_status?: string | null; assinatura_origem?: string | null; email?: string | null; hotmart_transacao?: string | null; hotmart_assinante?: string | null }) | null;
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

  // (19/11) tela refeita no estilo da página do PRO: topo simples com a logo e a coroa, cartão preto e dourado e linhas limpas
  const logo = fotoDaLoja(profile);
  const nomeLoja = String(profile?.nome_loja || "").trim();
  // primeiro mês (ainda sem renovação): a oferta de entrada já foi paga; o valor cheio só vale a partir da próxima cobrança
  const primeiroMes = !emTeste && !pelaEquipe && !cancelada && !atrasada && !!assinanteDesde && !!cobranca && cobranca.getTime() - assinanteDesde.getTime() < 35 * 86400000;
  const quando = (d: Date) => `${dataBR(d)} · ${dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`}`;
  // os atalhos dos recursos: "doo" abre a Doo, "equipe" chama a equipe no WhatsApp, o resto é uma tela do app
  const ir = (d?: string) => { if (!d) return; if (d === "doo") abrirDooIA(); else if (d === "equipe") pedirMontagem(profile?.nome as string | undefined, profile?.nome_loja as string | undefined); else navigate(d); };
  const selo = emTeste ? "Teste grátis" : cancelada ? "Cancelada" : atrasada ? "Pagamento atrasado" : "Ativo";

  return (
    <div className="mas-root">
      {computador && <AppPageHeader title="Minha assinatura" subtitle="Seu plano PRO" infoComo={COMO_ASSINATURA} infoTour={TOUR_ASSINATURA} />}
      <div className="pro10 pro14">
      <section className="pro10-topo pro14-topo">
        {!computador && (
          <div className="pro10-barra">
            <button type="button" className="pro10-voltar" aria-label="Voltar" onClick={() => voltarOuIr(navigate, "/minha-conta")}><CaretLeft size={22} weight="bold" /></button>
            <span>Minha assinatura</span>
          </div>
        )}
        <div className="pro14-logo"><img src={logo || "/pro-logo-padrao.webp"} alt="" />{logo && <img className="pro14-coroa" src="/pro-coroa.webp" alt="" width={60} height={30} />}</div>
        <h1 className="pro10-t pro14-t">{nomeLoja ? `${nomeLoja} é PRO` : "Você é PRO"}</h1>
        {assinanteDesde && <p className="pro10-s pro14-s">Assinante desde {dataBR(assinanteDesde)}</p>}
      </section>
      <div className="pro10-corpo pro11-corpo pro14-corpo">
        <section className="pro14-cartao">
          <small>Doonly PRO</small>
          <b>{emTeste ? <>Grátis <span>até {cobranca ? dataBR(new Date(cobranca.getTime() - 86400000)) : "o 7º dia"}</span></> : pelaEquipe ? <>PRO <span>liberado pela equipe</span></> : primeiroMes ? <>1º mês <span>depois {VALOR} por mês</span></> : <>{VALOR} <span>por mês</span></>}</b>
          <em className={`pro14-st${emTeste || cancelada || atrasada ? " pro14-st--aviso" : ""}`}>{selo}</em>
        </section>
        <section className="pro14-linhas">
          {pelaEquipe ? (
            <div>PRO até<b>{semFim || !proExpiraEm ? "Sem vencimento" : dataBR(proExpiraEm)}</b></div>
          ) : cancelada ? (<>
            <div>Pagamento<b>Cancelado na Hotmart</b></div>
            <div>PRO até<b>{proExpiraEm ? dataBR(proExpiraEm) : "o fim do mês pago"}</b></div>
          </>) : (<>
            <div>{emTeste ? "Primeira cobrança" : atrasada ? "PRO até" : "Próxima cobrança"}<b>{atrasada ? (proExpiraEm ? dataBR(proExpiraEm) : "Veja na Hotmart") : cobranca && semFim ? "Sem vencimento" : cobranca ? quando(cobranca) : "Veja na Hotmart"}</b></div>
            <div>Pagamento<b>{atrasada ? "Atrasado na Hotmart" : emTeste || primeiroMes ? `Hotmart, ${VALOR} por mês` : "Hotmart, todo mês"}</b></div>
          </>)}
        </section>
        <section className="pro11-sec">
          <h2>Seus recursos do PRO</h2>
          <div className="pro11-recs">
            {SO_PRO.map(([Ic, nome, frase]) => (
              <button type="button" className="pro11-r pro14-r" key={nome} onClick={() => ir(DESTINO[nome])}>
                <span className="pro11-r-ic" aria-hidden="true"><Ic size={22} weight="bold" /></span>
                <span className="pro11-r-tx"><b>{nome}</b><small>{frase}</small></span>
                <CaretRight size={16} weight="bold" className="pro14-seta" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
        <section className="pro11-sec">
          <h2>Seus limites agora</h2>
          <div className="pro11-recs">
            {([["Produtos", "", "Sem limite"], ...LIMITES] as [string, string, string][]).map(([nome, , pro]) => (
              <div className="pro14-lm" key={nome}><span>{nome}</span><b><Check size={14} weight="bold" aria-hidden="true" />{pro}</b></div>
            ))}
          </div>
        </section>
        <section className="pro11-sec">
          <h2>Precisa de algo?</h2>
          <div className="pro11-recs">
            {/* (6.81) a equipe Doonly monta o cardápio: abre o WhatsApp do suporte com a mensagem pronta */}
            <button type="button" className="pro11-r pro14-r" onClick={() => pedirMontagem(profile?.nome as string | undefined, profile?.nome_loja as string | undefined)}>
              <span className="pro11-r-ic" aria-hidden="true"><HandHeart size={20} weight="bold" /></span>
              <span className="pro11-r-tx"><b>Montar meu cardápio</b><small>A equipe cadastra produtos, logo e banners</small></span>
              <CaretRight size={16} weight="bold" className="pro14-seta" aria-hidden="true" />
            </button>
            <button type="button" className="pro11-r pro14-r" onClick={whats}>
              <span className="pro11-r-ic" aria-hidden="true"><IconeWhatsApp size={20} /></span>
              <span className="pro11-r-tx"><b>Falar com a equipe</b><small>WhatsApp do Doonly</small></span>
              <CaretRight size={16} weight="bold" className="pro14-seta" aria-hidden="true" />
            </button>
            <a className="pro11-r pro14-r" href={noAppDaLoja ? LINK_ASSINATURAS_GOOGLE : HOTMART_COMPRAS} target="_blank" rel="noopener noreferrer">
              <span className="pro11-r-ic" aria-hidden="true"><Receipt size={20} weight="bold" /></span>
              <span className="pro11-r-tx"><b>{noAppDaLoja ? "Assinatura no Google Play" : "Pagamentos e recibos"}</b><small>{noAppDaLoja ? "Pagamentos e recibos" : "Área de compras da Hotmart"}</small></span>
              <CaretRight size={16} weight="bold" className="pro14-seta" aria-hidden="true" />
            </a>
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}

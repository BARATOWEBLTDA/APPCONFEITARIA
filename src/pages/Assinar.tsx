import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Crown, Lock, CaretDown, CaretRight, Check } from "@phosphor-icons/react";
import { BENEFICIOS, CTA_PRO, DIAS_TESTE, PRECO_PRO, SELO_TESTE } from "@/lib/beneficiosPro";
import { noAppDaLoja } from "@/lib/plataforma";
import { lojaPagamentoPronto, iniciarLoja, ofertaPro, assinarPelaLoja, restaurarCompra, cancelouCompra, type OfertaLoja } from "@/lib/lojaPagamento";
import { refreshProfile } from "@/hooks/useProfile";
import { avisar } from "@/components/base";
import { useNavigate } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, Titulo } from "@/components/base";
import { usePlano } from "@/hooks/usePlano";
import { useProfile, type Profile } from "@/hooks/useProfile";

/** O perfil com os dados da assinatura (Hotmart) */
type PerfilAssinatura = (Profile & { assinatura_status?: string | null; assinatura_origem?: string | null; email?: string | null }) | null;
import { voltarOuIr } from "@/lib/voltar";
import { eventoDoApp, VALOR_PRO } from "@/lib/pixelsApp";
import { abrirDooIA } from "@/components/MenuContaItens";
import EquipeMonta, { pedirMontagem } from "@/components/billing/EquipeMonta"; // 11/10: seta de voltar que funciona com a tela aberta direto (link de notificação)
import "./clientes.css";
import "./assinar.css";

/**
 * Página do PRO (09/10: refeita no padrão do app — cabeçalho, cartões, ícones e botão fixo no celular).
 * Mantém: vantagens primeiro, ordenadas pelo que mais pesa pra confeiteira, e o checkout da Hotmart
 * com o e-mail e o nome da conta preenchidos.
 */
// (31/10 · 5.97) o PRO começa com 7 dias grátis (a Hotmart pede o cartão e só cobra no 8º dia); saiu o desconto do 1º mês
const PRECO_CHEIO = PRECO_PRO;

const DUVIDAS: [string, string][] = [
  ["Quando sou cobrada?", `Só no ${DIAS_TESTE + 1}º dia. A Hotmart pede o cartão, mas cancelando antes você não paga nada.`],
  ["Posso cancelar?", "Sim, quando quiser, sem multa."],
  ["E os meus dados?", "Continuam salvos, mesmo se você voltar para o plano grátis."],
  ["Como pago?", "Pela Hotmart, um site seguro de pagamentos. Use o mesmo e-mail da sua conta: assim o PRO liga sozinho."],
];
const dataBR = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Checkout do Doonly PRO na Hotmart (com os 7 dias grátis) */
const CHECKOUT_HOTMART = "https://pay.hotmart.com/M107866310B?off=elyrqwi7&checkoutMode=10"; // (6.80) oferta com 7 dias grátis

export default function Assinar() {
  const navigate = useNavigate();
  const { isPro, proExpiraEm } = usePlano();
  const { profile } = useProfile();
  // (21/10) computador: sem o voltar no topo (o menu da esquerda já leva de volta)
  const [computador, setComputador] = useState(() => window.matchMedia("(min-width: 901px)").matches);
  useEffect(() => { const mq = window.matchMedia("(min-width: 901px)"); const f = () => setComputador(mq.matches); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);
  const emTeste = (profile as PerfilAssinatura)?.assinatura_status === "teste";
  const folga = (profile as PerfilAssinatura)?.assinatura_origem === "hotmart" ? (emTeste ? 1 : 3) : 0;
  const cobranca = proExpiraEm ? new Date(proExpiraEm.getTime() - folga * 86400000) : null;
  const [aberta, setAberta] = useState<number | null>(null);
  const ir = (destino: string | null) => { if (!destino) return; if (destino === "doo") abrirDooIA(); else if (destino === "equipe") pedirMontagem(profile?.nome as string | undefined, profile?.nome_loja as string | undefined); else navigate(destino); };

  // Checkout da Hotmart (02/10). O e-mail e o nome da conta já vão preenchidos: o e-mail da compra
  // precisa ser o mesmo da conta, porque é por ele que o webhook liga o PRO sozinho.
  const [emailConta, setEmailConta] = useState("");
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setEmailConta(data.user?.email || "")).catch(() => {}); }, []);
  // (12/11) app da loja: assinatura pelo Google (tela nativa do Google Play), via RevenueCat
  const [oferta, setOferta] = useState<OfertaLoja | null>(null);
  const [comprando, setComprando] = useState(false);
  useEffect(() => {
    if (!lojaPagamentoPronto) return;
    supabase.auth.getUser().then(async ({ data }) => { if (!data.user) return; await iniciarLoja(data.user.id); setOferta(await ofertaPro()); }).catch(() => {});
  }, []);
  const esperarPro = async () => { for (let i = 0; i < 10; i++) { await refreshProfile(); await new Promise(r => setTimeout(r, 2000)); } };
  const assinarPeloGoogle = async () => {
    if (comprando) return;
    setComprando(true);
    try {
      const ok = await assinarPelaLoja();
      if (ok) { avisar("Pronto! Seu PRO está ativo", { tipo: "ok" }); void esperarPro(); }
    } catch (e) {
      if (!cancelouCompra(e)) avisar("Não deu para assinar agora", { tipo: "erro", detalhe: "Confira a internet e tente de novo" });
    }
    setComprando(false);
  };
  const restaurar = async () => {
    try { const ok = await restaurarCompra(); avisar(ok ? "Assinatura encontrada. Seu PRO está ativo" : "Nenhuma assinatura encontrada nesta conta do Google", { tipo: ok ? "ok" : "erro" }); if (ok) void esperarPro(); }
    catch { avisar("Não deu para conferir agora", { tipo: "erro" }); }
  };
  const assinarNaHotmart = () => {
    void eventoDoApp("InitiateCheckout", { value: VALOR_PRO, content_name: "Doonly PRO" }); // (6.21) pixels do app
    const u = new URL(CHECKOUT_HOTMART);
    const email = emailConta || (profile as PerfilAssinatura)?.email || "";
    if (email) u.searchParams.set("email", email);
    if (profile?.nome) u.searchParams.set("name", String(profile.nome));
    window.open(u.toString(), "_blank");
  };

  const duvidas = (
    <section className="cl9-card pro9-faq">
      <Titulo>Dúvidas</Titulo>
      {/* (21/10) celular: fechadas, abre ao tocar · computador: as 3 lado a lado, abertas */}
      {DUVIDAS.map(([q, r], i) => (
        <div key={q} className={`pro9-q${aberta === i ? " on" : ""}`}>
          <button type="button" aria-expanded={aberta === i} onClick={() => setAberta(a => a === i ? null : i)}><b>{q}</b><CaretDown size={18} weight="bold" aria-hidden="true" /></button>
          <p>{r}</p>
        </div>
      ))}
    </section>
  );

  return (
    <>
      <AppPageHeader title="Doonly PRO" subtitle={isPro ? "Você já é PRO" : "Tudo para sua confeitaria vender mais"} onBack={computador ? undefined : () => voltarOuIr(navigate)} />
      {isPro ? (
        /* ══ (21/10) Quem já é PRO: o status primeiro, a lista compacta e as dúvidas ══ */
        <div className="cl9 pro9 pro9--pro">
          <section className="pro9-st">
            <span className="pro9-st-ic" aria-hidden="true"><Crown size={24} weight="fill" /></span>
            <span className="pro9-st-tx">
              <b>Você é PRO</b>
              <small>
                {/* (31/10 · 5.97) nos 7 dias grátis: "Teste grátis" e a 1ª cobrança (sem a folga que o webhook dá) */}
                <span className="pro9-pc">{emTeste ? "Teste grátis · " : "Ativo · "}</span>{cobranca ? `${emTeste ? "1ª cobrança" : "Renova"} em ${dataBR(cobranca)} · ` : ""}{PRECO_CHEIO}<span className="pro9-pc"> por mês</span>
              </small>
            </span>
            <button type="button" className="pro9-st-bt" onClick={() => navigate("/minha-assinatura")}>Ver minha assinatura</button>
          </section>
          <button type="button" className="pro9-st-bt2" onClick={() => navigate("/minha-assinatura")}>Ver minha assinatura</button>
          <EquipeMonta />

          <section className="cl9-card pro9-lista2">
            <Titulo>O que o PRO te dá</Titulo>
            <div className="pro9-l2">
              {BENEFICIOS.map(([Ic, , , t, d, para]) => {
                const conteudo = (<>
                  <span className="pro9-ic"><Ic size={20} weight="duotone" /></span>
                  <span className="pro9-l2-tx"><b>{t}</b><small>{d}</small></span>
                  {para ? <CaretRight size={16} weight="bold" className="pro9-seta" aria-hidden="true" /> : <span className="pro9-visto" role="img" aria-label="Incluso"><Check size={12} weight="bold" /></span>}
                </>);
                return para
                  ? <button key={t} type="button" className="pro9-l2-i" onClick={() => ir(para)}>{conteudo}</button>
                  : <div key={t} className="pro9-l2-i">{conteudo}</div>;
              })}
            </div>
          </section>
          {duvidas}
        </div>
      ) : (
      <div className="cl9 pro9">
        <section className="pro9-hero">
          <img src="/pro.webp" alt="" />
          <div>
            <h1>Sua confeitaria mais lucrativa e organizada</h1>
            <p>Ferramentas que vendem, calculam e organizam por você.</p>
            {(!noAppDaLoja || lojaPagamentoPronto) && <span className="pro9-selo">{SELO_TESTE} para testar</span>}
          </div>
        </section>

        <EquipeMonta className="pro9-eqm" semBotao />
        <div className="pro9-grade">
          {/* (21/10) celular: a oferta (preço) sobe pra logo depois do topo, antes da lista */}
          <aside className="pro9-lado">
            {noAppDaLoja && !lojaPagamentoPronto ? (
              <section className="cl9-card pro9-oferta">
                <b className="pro9-oferta-t">Plano PRO</b>
                <p className="pro9-oferta-s">A assinatura do PRO não está disponível pelo app. Se você já é PRO, tudo fica liberado aqui automaticamente.</p>
              </section>
            ) : (
            <section className="cl9-card pro9-oferta">
              <span className="pro9-desc">Hoje você não paga nada</span>
              <b className="pro9-oferta-t">Plano PRO mensal</b>
              <div className="pro9-preco"><b>Grátis</b><small>por {DIAS_TESTE} dias</small></div>
              <p className="pro9-oferta-s">Depois, {lojaPagamentoPronto && oferta ? oferta.preco : PRECO_CHEIO} por mês (menos de R$ 1 por dia). Cancele antes do {DIAS_TESTE + 1}º dia e não paga nada.</p>
              <Botao cheio carregando={comprando} disabled={comprando} icone={<Crown size={20} weight="fill" />} onClick={lojaPagamentoPronto ? assinarPeloGoogle : assinarNaHotmart}>{CTA_PRO}</Botao>
              <p className="pro9-seg"><Lock size={14} weight="bold" /> {lojaPagamentoPronto ? "Pagamento seguro pelo Google Play" : "Pagamento seguro pela Hotmart"}</p>
              {lojaPagamentoPronto && <button type="button" className="pro9-restaurar" onClick={restaurar}>Já assinei: restaurar compra</button>}
            </section>
            )}
            {computador && !noAppDaLoja && duvidas}
          </aside>

          <section className="cl9-card pro9-lista">
            <Titulo>O que o PRO libera</Titulo>
            {/* (6.108) a equipe que monta já está no cartão de cima; no celular, o título curto (o longo quebrava em 2 linhas) */}
            {BENEFICIOS.filter(b => b[5] !== "equipe").map(([Ic, t, d, curto]) => (
              <div className="pro9-li" key={t}>
                <span className="pro9-ic"><Ic size={22} weight="duotone" /></span>
                <span><b>{computador ? t : curto}</b><small>{d}</small></span>
              </div>
            ))}
          </section>
          {!computador && !noAppDaLoja && duvidas}
        </div>
      </div>
      )}

      {/* Celular: botão fixo pra assinar sem rolar até o fim */}
      {!isPro && (!noAppDaLoja || lojaPagamentoPronto) && (
        <div className="pro9-fixo">
          <span><small>Depois, {PRECO_CHEIO}/mês</small><b>{SELO_TESTE}</b></span>
          <Botao carregando={comprando} onClick={lojaPagamentoPronto ? assinarPeloGoogle : assinarNaHotmart}>Testar grátis</Botao>
        </div>
      )}
    </>
  );
}

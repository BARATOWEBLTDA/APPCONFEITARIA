import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Crown, Lock, CaretDown, CaretLeft, CaretRight, Check, X } from "@phosphor-icons/react";
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
  ["Quando sou cobrada?", `Só no ${DIAS_TESTE + 1}º dia. Nos ${DIAS_TESTE} primeiros dias você não paga nada.`],
  ["E os meus dados?", "Continuam salvos, mesmo se você voltar para o plano grátis."],
  ["Como pago?", "Pela Hotmart, um site seguro de pagamentos. Use o mesmo e-mail da sua conta: assim o PRO liga sozinho."],
];
/** (19/11) Comparação Grátis × PRO: nome, o que o grátis tem (null = X), o que o PRO tem (null = visto) e a linha pequena de cada um */
const COMPARA: [string, string | null, string | null, string?, string?][] = [
  ["Produtos no cardápio", "10", "Sem limite"],
  ["Doo IA", "Só texto", "Texto e fotos", "limitado", "ilimitado"],
  ["Orçamentos dinâmicos", null, null],
  ["Montamos seu cardápio", null, null],
  ["Lucro por produto", null, null],
  ["Cupons de desconto", null, "Sem limite"],
  ["Adicionais", null, null],
  ["Modelo do cardápio", "Clássico", "Premium"],
  ["Mensagens personalizadas", null, null],
  ["Pixel", null, null],
  ["Selo de loja verificada", null, null],
  ["Marca d'água", "Com marca", "Sem marca"],
  ["Importar contatos", null, null],
  ["Banners no cardápio", "1", "Até 4"],
  ["Fotos por produto", "1", "Até 4"],
  ["Link personalizado", null, null],
  ["Planilha e PDFs", null, null],
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
      {(isPro || computador) && <AppPageHeader title="Doonly PRO" subtitle={isPro ? "Você já é PRO" : "Tudo para sua confeitaria vender mais"} onBack={computador ? undefined : () => voltarOuIr(navigate)} />}
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
      <div className="pro10">
        {/* (19/11) tela nova do PRO: topo chocolate de ponta a ponta (cobre o cabeçalho no celular), comparação Grátis × PRO e o cartão do plano */}
        <section className="pro10-topo">
          {!computador && (
            <div className="pro10-barra">
              <button type="button" className="pro10-voltar" aria-label="Voltar" onClick={() => voltarOuIr(navigate)}><CaretLeft size={22} weight="bold" /></button>
              <span>Doonly PRO</span>
            </div>
          )}
          <img className="pro10-coroa" src="/pro-coroa.webp" alt="" width={104} height={52} />
          <h1 className="pro10-t">Libere tudo <br className="pro10-br" />do Doonly</h1>
          <p className="pro10-s">O Doonly grátis já é bom.<br />O PRO é muito melhor.</p>
        </section>
        <div className="pro10-some" aria-hidden="true" />

        <div className="pro10-corpo">
          <section className="pro10-tab" aria-label="Grátis e PRO lado a lado">
            <div className="pro10-l pro10-cab" aria-hidden="true">
              <span />
              <span className="pro10-g">Grátis</span>
              <span className="pro10-p"><b className="pro10-rgb">PRO</b></span>
            </div>
            {COMPARA.map(([nome, gratis, pro, gSub, pSub]) => (
              <div className="pro10-l" key={nome}>
                <span className="pro10-n">{nome}</span>
                <span className="pro10-g">
                  {gratis === null ? <X size={16} weight="bold" className="pro10-x" role="img" aria-label="Não tem no grátis" /> : <>{gratis}{gSub && <small>{gSub}</small>}</>}
                </span>
                <span className="pro10-p">
                  {pro === null ? <Check size={17} weight="bold" className="pro10-v" role="img" aria-label="Incluso no PRO" /> : <>{pro}{pSub && <small>{pSub}</small>}</>}
                </span>
              </div>
            ))}
          </section>

          {noAppDaLoja && !lojaPagamentoPronto ? (
            <section className="pro10-plano">
              <b className="pro10-plano-t">Plano PRO</b>
              <p className="pro10-plano-s">A assinatura do PRO não está disponível pelo app. Se você já é PRO, tudo fica liberado aqui automaticamente.</p>
            </section>
          ) : (
            <section className="pro10-plano">
              <b className="pro10-plano-t">{SELO_TESTE}</b>
              <p className="pro10-plano-s">depois {lojaPagamentoPronto && oferta ? oferta.preco : PRECO_CHEIO} por mês</p>
              <Botao cheio carregando={comprando} disabled={comprando} icone={<Crown size={20} weight="fill" />} onClick={lojaPagamentoPronto ? assinarPeloGoogle : assinarNaHotmart}>{CTA_PRO}</Botao>
              <p className="pro10-seg"><Lock size={14} weight="bold" /> {lojaPagamentoPronto ? "Pagamento seguro pelo Google Play" : "Pagamento seguro pela Hotmart"}</p>
              {lojaPagamentoPronto && <button type="button" className="pro10-restaurar" onClick={restaurar}>Já assinei: restaurar compra</button>}
            </section>
          )}
          {!noAppDaLoja && <div className="pro9">{duvidas}</div>}
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

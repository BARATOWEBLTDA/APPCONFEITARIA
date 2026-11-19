import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Crown, Lock, CaretLeft, CaretRight, Check, PlayCircle, FileText, Ticket, Stack, ChartLineUp, ChatCircleText, Megaphone, AddressBook, Cake, Camera, SealCheck, Images, MicrosoftExcelLogo, Printer, FilePdf, HandHeart, type Icon } from "@phosphor-icons/react";
import { BENEFICIOS, CHECKOUT_HOTMART, CTA_PRO, CTA_PRO_CURTO, OFERTA_PRO, PRECO_PRO, SELO_OFERTA } from "@/lib/beneficiosPro";
import { noAppDaLoja } from "@/lib/plataforma";
import { lojaPagamentoPronto, iniciarLoja, ofertaPro, assinarPelaLoja, restaurarCompra, cancelouCompra, type OfertaLoja } from "@/lib/lojaPagamento";
import { refreshProfile } from "@/hooks/useProfile";
import { avisar } from "@/components/base";
import { useNavigate } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, Titulo } from "@/components/base";
import { usePlano } from "@/hooks/usePlano";
import { useProfile, fotoDaLoja, type Profile } from "@/hooks/useProfile";

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

/** (19/11) Limites do grátis que o PRO tira: nome, como é hoje e como fica no PRO (o de produtos usa o limite da conta) */
const LIMITES: [string, string, string][] = [
  ["Fotos por produto", "1", "Até 4"],
  ["Mensagens da Doo", "10 por mês", "150 por dia"],
  ["Cores da loja", "4 prontas", "Qualquer cor"],
  ["Link da loja", "Um código", "Seu nome"],
  ["Cardápio", "Com marca", "Sem marca"],
  ["PDFs", "Com marca", "Sem marca"],
];
/** (19/11) O que só existe no PRO (varredura das travas do app): ícone, nome e a frase do benefício */
const SO_PRO: [Icon, string, string][] = [
  [PlayCircle, "Stories", "Mostre o bolo do dia em vídeo"],
  [FileText, "Orçamentos", "Feche festas com proposta pronta"],
  [Ticket, "Cupons de desconto", "Traga a cliente de volta"],
  [Stack, "Adicionais", "Venda topo, vela e extras"],
  [ChartLineUp, "Lucro por produto", "Saiba o que mais dá dinheiro"],
  [ChatCircleText, "Mensagens do WhatsApp", "Troque os textos pelo seu jeito"],
  [Megaphone, "Pixel", "Anuncie no Meta, Google e TikTok"],
  [AddressBook, "Importar contatos", "Traga as clientes da agenda"],
  [Cake, "Topos, logo e banners com IA", "A Doo cria para você"],
  [Camera, "Doo com fotos", "Mande a foto e ela cadastra"],
  [SealCheck, "Selo de loja verificada", "Mais confiança para comprar"],
  [Images, "Banners prontos do PRO", "Escolha e coloque no cardápio"],
  [MicrosoftExcelLogo, "Planilha do financeiro", "Baixe tudo em Excel"],
  [Printer, "Imprimir a agenda do dia", "As entregas no papel"],
  [FilePdf, "Ficha técnica em PDF", "Custo e receita para guardar"],
  [HandHeart, "Montamos seu cardápio", "A equipe Doonly faz para você"],
];
const VALOR_MES = 29.9;
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** confete dourado saindo do botão (some sozinho; nada com "reduzir movimento") */
function confete(de: HTMLElement | null) {
  if (!de || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = de.getBoundingClientRect();
  const caixa = document.createElement("div"); caixa.className = "pro11-conf"; caixa.style.left = `${r.left + r.width / 2}px`; caixa.style.top = `${r.top}px`;
  for (let i = 0; i < 26; i++) {
    const c = document.createElement("i"); const ang = Math.PI * (0.15 + Math.random() * 0.7); const dist = 90 + Math.random() * 150;
    c.style.setProperty("--x", `${Math.cos(ang) * dist * (Math.random() < 0.5 ? -1 : 1)}px`); c.style.setProperty("--y", `${-Math.sin(ang) * dist}px`);
    c.style.setProperty("--g", `${Math.random() * 540 - 270}deg`); c.style.background = ["#F5C76B", "#FFE3A6", "#E0A93B", "#FF8FB8"][i % 4]; c.style.animationDelay = `${Math.random() * 80}ms`;
    caixa.appendChild(c);
  }
  document.body.appendChild(caixa); setTimeout(() => caixa.remove(), 1500);
}
const dataBR = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

// (19/11) o link do checkout vem de beneficiosPro (são duas ofertas em teste: 7 dias grátis e Black Friday por R$ 1)

export default function Assinar() {
  const navigate = useNavigate();
  const { isPro, proExpiraEm, limiteProdutos } = usePlano();
  const { profile } = useProfile();
  // (21/10) computador: sem o voltar no topo (o menu da esquerda já leva de volta)
  const [computador, setComputador] = useState(() => window.matchMedia("(min-width: 901px)").matches);
  useEffect(() => { const mq = window.matchMedia("(min-width: 901px)"); const f = () => setComputador(mq.matches); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);
  const emTeste = (profile as PerfilAssinatura)?.assinatura_status === "teste";
  const folga = (profile as PerfilAssinatura)?.assinatura_origem === "hotmart" ? (emTeste ? 1 : 3) : 0;
  const cobranca = proExpiraEm ? new Date(proExpiraEm.getTime() - folga * 86400000) : null;
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
  // (19/11) "Um pedido paga o PRO": o pedido médio dos últimos 90 dias (só aparece com 3 pedidos ou mais e se pagar a mensalidade)
  const [pedidoMedio, setPedidoMedio] = useState<number | null>(null);
  useEffect(() => {
    if (isPro || !profile?.id) return;
    const desde = new Date(Date.now() - 90 * 86400000).toISOString();
    supabase.from("pedidos").select("valor_total").eq("user_id", profile.id).neq("status", "cancelado").gte("created_at", desde).limit(500)
      .then(({ data }) => {
        const v = (data || []).map(p => Number(p.valor_total) || 0).filter(n => n > 0);
        if (v.length >= 3) { const m = v.reduce((a, b) => a + b, 0) / v.length; if (m >= VALOR_MES) setPedidoMedio(m); }
      }, () => {});
  }, [isPro, profile?.id]);
  // o cartão de sócia inclina com o celular (onde o aparelho deixa sem pedir permissão)
  const cartao = useRef<HTMLElement>(null);
  useEffect(() => {
    if (isPro || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const f = (e: DeviceOrientationEvent) => {
      const el = cartao.current; if (!el || e.gamma == null || e.beta == null) return;
      const x = Math.max(-12, Math.min(12, e.gamma / 3)); const y = Math.max(-8, Math.min(8, (e.beta - 45) / 5));
      el.style.transform = `perspective(700px) rotateY(${x}deg) rotateX(${-y}deg)`; el.style.setProperty("--brilho", `${50 + x * 4}%`);
    };
    window.addEventListener("deviceorientation", f);
    return () => window.removeEventListener("deviceorientation", f);
  }, [isPro]);
  const botaoFixo = useRef<HTMLDivElement>(null);
  const logo = fotoDaLoja(profile);
  const nomeLoja = String(profile?.nome_loja || "").trim();
  const iniciais = nomeLoja.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase() || "D";
  const assinarNaHotmart = () => {
    confete(botaoFixo.current);
    void eventoDoApp("InitiateCheckout", { value: VALOR_PRO, content_name: "Doonly PRO" }); // (6.21) pixels do app
    const u = new URL(CHECKOUT_HOTMART);
    const email = emailConta || (profile as PerfilAssinatura)?.email || "";
    if (email) u.searchParams.set("email", email);
    if (profile?.nome) u.searchParams.set("name", String(profile.nome));
    window.open(u.toString(), "_blank");
  };


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
          <div className="pro11-logo">
            <img className="pro11-coroa" src="/pro-coroa.webp" alt="" width={78} height={39} />
            {logo ? <img className="pro11-foto" src={logo} alt="" /> : <span>{iniciais}</span>}
          </div>
          <h1 className="pro10-t">Libere tudo <br className="pro10-br" />do Doonly</h1>
          <p className="pro10-s">O Doonly grátis já é bom.<br />O PRO é muito melhor.</p>
        </section>

        <div className="pro10-corpo pro11-corpo">
          <section className="pro11-socio" ref={cartao}>
            <span className="pro11-socio-c" aria-hidden="true"><Crown size={22} weight="fill" /></span>
            <b>{nomeLoja || "Sua confeitaria"}</b>
            <small>Confeitaria PRO</small>
            <em>PRO</em>
          </section>

          {(!noAppDaLoja || lojaPagamentoPronto) && (
            <section className="pro11-oferta">
              {OFERTA_PRO === "real1" && <small>Black Friday</small>}
              <b>{SELO_OFERTA}</b>
              <p>Depois, {lojaPagamentoPronto && oferta ? oferta.preco : PRECO_CHEIO} por mês</p>
            </section>
          )}

          {pedidoMedio !== null && (
            <section className="pro11-conta">
              <h2>Um pedido paga o PRO</h2>
              <div><span><small>Seu pedido médio</small><b>{reais(pedidoMedio)}</b></span><span><small>PRO por mês</small><b>{PRECO_CHEIO}</b></span></div>
              <p>Um pedido a mais no mês já paga.</p>
            </section>
          )}

          <section className="pro11-sec">
            <h2>Limites que o PRO tira</h2>
            <div className="pro11-lim">
              {([["Produtos no cardápio", String(limiteProdutos), "Sem limite"], ...LIMITES] as [string, string, string][]).map(([nome, hoje, pro], i) => (
                <div className={`pro11-q${i === 0 ? " pro11-q--larga" : ""}`} key={nome}>
                  <b>{nome}</b>
                  <p><span>Hoje</span><i>{hoje}</i></p>
                  <p className="pro11-q-pro"><span><Crown size={13} weight="fill" aria-hidden="true" />No PRO</span><i>{pro}</i></p>
                </div>
              ))}
            </div>
          </section>

          <section className="pro11-sec">
            <h2>Recursos só do PRO</h2>
            <div className="pro11-recs">
              {SO_PRO.map(([Ic, nome, frase]) => (
                <div className="pro11-r" key={nome}>
                  <span className="pro11-r-ic" aria-hidden="true"><Ic size={22} weight="bold" /></span>
                  <span className="pro11-r-tx"><b>{nome}</b><small>{frase}</small></span>
                  <Crown size={16} weight="fill" className="pro11-r-cr" aria-hidden="true" />
                </div>
              ))}
            </div>
          </section>

          {noAppDaLoja && !lojaPagamentoPronto ? (
            <section className="pro10-plano">
              <b className="pro10-plano-t">Plano PRO</b>
              <p className="pro10-plano-s">A assinatura do PRO não está disponível pelo app. Se você já é PRO, tudo fica liberado aqui automaticamente.</p>
            </section>
          ) : (
            <section className="pro10-plano pro10-plano--teste">
              <b className="pro10-plano-t">{SELO_OFERTA}</b>
              <p className="pro10-plano-s">depois {lojaPagamentoPronto && oferta ? oferta.preco : PRECO_CHEIO} por mês</p>
              <Botao cheio carregando={comprando} disabled={comprando} icone={<Crown size={20} weight="fill" />} onClick={lojaPagamentoPronto ? assinarPeloGoogle : assinarNaHotmart}>{CTA_PRO}</Botao>
              <p className="pro10-seg"><Lock size={14} weight="bold" /> {lojaPagamentoPronto ? "Pagamento seguro pelo Google Play" : "Pagamento seguro pela Hotmart"}</p>
              {lojaPagamentoPronto && <button type="button" className="pro10-restaurar" onClick={restaurar}>Já assinei: restaurar compra</button>}
            </section>
          )}
          {/* (19/11) no celular o cartão do plano não aparece: o "restaurar compra" do app fica aqui */}
          {lojaPagamentoPronto && <button type="button" className="pro10-restaurar pro10-restaurar--cel" onClick={restaurar}>Já assinei: restaurar compra</button>}
        </div>
      </div>
      )}

      {/* Celular: botão fixo pra assinar sem rolar até o fim */}
      {!isPro && (!noAppDaLoja || lojaPagamentoPronto) && (
        <div className="pro9-fixo" ref={botaoFixo}>
          <span><small>Depois, {PRECO_CHEIO}/mês</small><b>{SELO_OFERTA}</b></span>
          <Botao className="pro9-fixo-bt" carregando={comprando} onClick={lojaPagamentoPronto ? assinarPeloGoogle : assinarNaHotmart}>{CTA_PRO_CURTO}</Botao>
        </div>
      )}
    </>
  );
}

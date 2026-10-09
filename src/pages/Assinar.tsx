import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Lock } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { usePlano } from "@/hooks/usePlano";
import { useProfile } from "@/hooks/useProfile";

/**
 * Página do PRO (aprovada 01/10): modo escuro, vantagens primeiro (em lista, ordenadas pelo que mais
 * pesa pra confeiteira) e o preço só no fim. O botão abre o checkout da Hotmart (02/10),
 * com o e-mail e o nome da conta preenchidos.
 */
const PRECO_CHEIO = "R$ 29,90";
const PRECO_1O_MES = "R$ 8,97"; // 70% OFF no 1º mês (30% de R$ 29,90)

const BENEFICIOS: [string, string][] = [
  ["Preço certo em tudo que você vende", "Bolos, doces ou salgados: a precificação inteligente calcula custo, margem e lucro. Chega de vender no prejuízo."],
  ["Saiba quanto você lucra de verdade", "Relatórios de lucratividade por produto e por mês, pra decidir com segurança."],
  ["Um assistente que trabalha por você", "O Doo IA calcula preços, sugere receitas e escreve legendas, respostas e a descrição dos seus produtos."],
  ["Nunca mais perca um pedido", "O celular avisa na hora que chega um pedido, mesmo com o app fechado."],
  ["Veja quem visita e quem compra", "Visitas, pedidos online e conversão do seu cardápio, de hoje e do mês."],
  ["Cupons que trazem cliente de volta", "Crie cupons de desconto pra atrair novos clientes e fidelizar os antigos."],
  ["Cardápio com a cara da sua marca", "Suas cores, até 3 fotos por produto e um link com o nome da sua loja."],
  ["Layout exclusivo de cardápio", "Um modelo de cardápio só de quem é PRO, com mais destaque pra sua marca e seus produtos."],
  ["Banners que vendem", "Até 4 banners em carrossel pra destacar promoções e lançamentos."],
  ["Selo de loja verificada", "Mais confiança na hora em que o cliente decide comprar."],
  ["Sem marca d'água", "Seu cardápio só com a sua marca, sem o \"Criado com Doonly\"."],
  ["Produtos ilimitados", "Cadastre todo o seu cardápio, sem limite."],
  ["Clientes ilimitados", "Toda a sua clientela e o histórico de compras num lugar só."],
  ["Importe seus clientes em um toque", "Traga os contatos direto da agenda do celular."],
  ["Relatórios em PDF", "Pedidos e relatórios prontos pra mandar ou imprimir."],
];

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
);


/** Checkout do Doonly PRO na Hotmart (com o cupom do 1º mês) */
const CHECKOUT_HOTMART = "https://pay.hotmart.com/M107866310B?checkoutMode=10";
export default function Assinar() {
  const navigate = useNavigate();
  const { isPro, proExpiraEm } = usePlano();
  const { profile } = useProfile();
  const diasRestantes = proExpiraEm ? Math.max(0, Math.ceil((proExpiraEm.getTime() - Date.now()) / 86400000)) : 0;

  // Enquanto a página está aberta: o fundo de trás fica vinho (no iPhone, ao rolar, a barra do Safari
  // encolhe e aparecia uma faixa branca embaixo do menu) e a página de trás não rola.
  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const antes = { hb: html.style.background, bb: body.style.background, ho: html.style.overflow, bo: body.style.overflow };
    html.style.background = "#1A0B10"; body.style.background = "#1A0B10";
    html.style.overflow = "hidden"; body.style.overflow = "hidden";
    const meta = document.querySelector('meta[name="theme-color"]'); const corAntes = meta?.getAttribute("content") || null;
    meta?.setAttribute("content", "#1A0B10");
    return () => {
      html.style.background = antes.hb; body.style.background = antes.bb; html.style.overflow = antes.ho; body.style.overflow = antes.bo;
      if (meta && corAntes) meta.setAttribute("content", corAntes);
    };
  }, []);

  // Checkout da Hotmart (02/10). O e-mail e o nome da conta já vão preenchidos: o e-mail da compra
  // precisa ser o mesmo da conta, porque é por ele que o webhook liga o PRO sozinho.
  const [emailConta, setEmailConta] = useState("");
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setEmailConta(data.user?.email || "")).catch(() => {}); }, []);
  const assinarNaHotmart = () => {
    const u = new URL(CHECKOUT_HOTMART);
    const email = emailConta || (profile as any)?.email || "";
    if (email) u.searchParams.set("email", email);
    if (profile?.nome) u.searchParams.set("name", String(profile.nome));
    window.open(u.toString(), "_blank");
  };

  return (
    <div className="pro-root">
      <div className="pro-glow" aria-hidden="true" />
      <div className="pro-in">
        <button type="button" className="pro-back" onClick={() => navigate(-1)} aria-label="Voltar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
        </button>

        <div className="pro-hero">
          <img className="pro-boneca" src="/pro.png" alt="Confeiteira Doonly PRO" />
          <p className="pro-k">DOONLY PRO</p>
          <h1>Sua confeitaria <span>mais lucrativa</span> e organizada</h1>
          <p className="pro-sub">Ferramentas que vendem, calculam e organizam por você.</p>
        </div>

        <div className="pro-lista">
          {BENEFICIOS.map(([t, d]) => (
            <div className="pro-li" key={t}>
              <span className="pro-ic"><Check /></span>
              <div><b>{t}</b><small>{d}</small></div>
            </div>
          ))}
        </div>

        <div className="pro-of">
          {isPro ? (
            <>
              <p className="pro-of-t">Seu plano</p>
              <p className="pro-ja">Você já é PRO</p>
              {proExpiraEm && <p className="pro-of-s">Renova em <b>{diasRestantes} dia{diasRestantes !== 1 ? "s" : ""}</b></p>}
              <button type="button" className="pro-btn pro-btn--sec" onClick={() => navigate("/minha-assinatura")}>Ver minha assinatura</button>
            </>
          ) : (
            <>
              <span className="pro-off">70% OFF no 1º mês</span>
              <p className="pro-of-t">Plano PRO mensal</p>
              <div className="pro-of-p"><s>{PRECO_CHEIO}</s><b>{PRECO_1O_MES}</b><small>no 1º mês</small></div>
              <p className="pro-of-s">Depois, <b>{PRECO_CHEIO}/mês</b> · sem fidelidade, cancele quando quiser</p>
              <button type="button" className="pro-btn" onClick={assinarNaHotmart}>Assinar o PRO</button>
            </>
          )}
        </div>

        <div className="pro-faq">
          <p><b>Posso cancelar?</b> Sim, quando quiser, sem multa.</p>
          <p><b>E meus dados?</b> Continuam salvos, mesmo se voltar pro grátis.</p>
        </div>
        <p className="pro-gar"><Lock size={14} weight="bold" /> Pagamento seguro · seus dados continuam salvos</p>
      </div>

      <style>{`
        .pro-root { position: relative; min-height: 100vh; overflow: hidden; color: #fff; font-family: var(--font-base);
          background: radial-gradient(130% 40% at 50% 0%, #6B2340 0%, #2C1219 45%, #1A0B10 100%); }
        .pro-glow { position: absolute; width: 280px; height: 280px; border-radius: 50%; top: -80px; right: -90px; pointer-events: none;
          background: radial-gradient(circle, rgba(232,90,140,.35), transparent 70%); }
        .pro-in { position: relative; max-width: 560px; margin: 0 auto; padding: calc(16px + env(safe-area-inset-top, 0px)) 16px calc(110px + env(safe-area-inset-bottom, 0px)); }
        .pro-back { width: 44px; height: 44px; border-radius: 50%; border: none; background: rgba(255,255,255,.12); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .pro-hero { text-align: center; padding: 6px 8px 4px; }
        .pro-crown { width: 60px; height: 60px; border-radius: 18px; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, rgba(249,168,212,.25), rgba(196,181,253,.2)); border: 1px solid rgba(249,168,212,.35); }
        .pro-crown img { width: 36px; height: 36px; object-fit: contain; }
        /* Boneca confeiteira do PRO no topo (02/10) */
        .pro-boneca { display: block; width: auto; height: 150px; max-width: 70%; margin: 0 auto 6px; object-fit: contain; filter: drop-shadow(0 12px 28px rgba(232,90,140,.35)); }
        .pro-k { font-size: 12px; font-weight: 900; letter-spacing: .18em; margin: 0; background: linear-gradient(90deg, #F9A8D4, #C4B5FD, #93C5FD); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .pro-hero h1 { font-size: 26px; font-weight: 900; line-height: 1.15; margin: 8px auto 0; max-width: 320px; text-wrap: balance; color: #fff; }
        .pro-hero h1 span { color: #F9A8D4; }
        .pro-sub { font-size: 14px; color: rgba(255,255,255,.72); margin: 10px auto 6px; max-width: 300px; line-height: 1.45; }
        .pro-lista { margin-top: 14px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 18px; padding: 4px 14px; }
        .pro-li { display: flex; gap: 12px; align-items: flex-start; padding: 11px 0; border-top: 1px solid rgba(255,255,255,.08); }
        .pro-li:first-child { border-top: none; }
        .pro-ic { width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, #F472B6, #C33A6E); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; box-shadow: 0 2px 8px rgba(232,90,140,.4); }
        .pro-li b { display: block; font-size: 14.5px; color: #fff; }
        .pro-li small { display: block; font-size: 12.5px; color: rgba(255,255,255,.65); margin-top: 2px; line-height: 1.35; }
        .pro-of { position: relative; margin-top: 22px; background: rgba(255,255,255,.07); border: 1px solid rgba(249,168,212,.4); border-radius: 18px; padding: 20px 18px 18px; text-align: center; box-shadow: 0 10px 40px rgba(232,90,140,.15); }
        .pro-off { position: absolute; top: -11px; left: 50%; transform: translateX(-50%); white-space: nowrap; background: linear-gradient(90deg, #16A34A, #15803D); color: #fff; font-size: 12px; font-weight: 900; letter-spacing: .06em; padding: 4px 10px; border-radius: 999px; box-shadow: 0 4px 12px rgba(22,163,74,.35); }
        .pro-of-t { font-size: 12px; font-weight: 800; letter-spacing: .08em; color: #F9A8D4; text-transform: uppercase; margin: 0; }
        .pro-of-p { display: flex; align-items: baseline; justify-content: center; gap: 8px; margin-top: 6px; }
        .pro-of-p s { color: rgba(255,255,255,.45); font-size: 14px; }
        .pro-of-p b { font-size: 36px; font-weight: 900; color: #fff; }
        .pro-of-p small { color: rgba(255,255,255,.7); }
        .pro-of-s { font-size: 12.5px; color: rgba(255,255,255,.78); margin: 2px 0 0; }
        .pro-of-s b { color: #fff; }
        .pro-ja { font-size: 22px; font-weight: 900; margin: 6px 0 2px; }
        .pro-btn { width: 100%; margin-top: 14px; border: none; border-radius: 12px; padding: 15px; font-family: inherit; font-size: 16px; font-weight: 800; color: #fff; cursor: pointer;
          background: linear-gradient(90deg, #E85A8C, #C33A6E); box-shadow: 0 8px 24px rgba(232,90,140,.45); }
        .pro-btn:active { transform: translateY(1px); }
        .pro-btn--sec { background: rgba(255,255,255,.12); box-shadow: none; }
        .pro-faq { margin: 18px 6px 0; display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: rgba(255,255,255,.72); }
        .pro-faq p { margin: 0; } .pro-faq b { color: #fff; }
        .pro-gar { text-align: center; font-size: 12px; color: rgba(255,255,255,.55); margin: 16px 0 0; }
        /* Ocupa a área inteira do app, de ponta a ponta (antes sobravam bordas brancas do espaçamento da página) */
        .pro-root { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 45; overflow-y: auto; min-height: 0; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
        @media (min-width: 768px) {
          .pro-root { left: 220px; z-index: 5; }
          .pro-in { padding-top: 32px; padding-bottom: 48px; }
        }
      `}</style>
    </div>
  );
}

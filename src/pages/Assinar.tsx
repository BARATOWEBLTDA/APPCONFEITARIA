import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Bell, ChartLineUp, CheckCircle, Crown, Eye, FilePdf, ImageSquare, Infinity as Infinito, Lock, Palette,
  Robot, SealCheck, Sparkle, Tag, Calculator, AddressBook, type Icon,
} from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, Titulo } from "@/components/base";
import { usePlano } from "@/hooks/usePlano";
import { useProfile } from "@/hooks/useProfile";
import "./clientes.css";
import "./assinar.css";

/**
 * Página do PRO (09/10: refeita no padrão do app — cabeçalho, cartões, ícones e botão fixo no celular).
 * Mantém: vantagens primeiro, ordenadas pelo que mais pesa pra confeiteira, e o checkout da Hotmart
 * com o e-mail e o nome da conta preenchidos.
 */
const PRECO_CHEIO = "R$ 29,90";
const PRECO_1O_MES = "R$ 8,97"; // 70% de desconto no 1º mês (30% de R$ 29,90)

const BENEFICIOS: [Icon, string, string][] = [
  [Calculator, "Preço certo em tudo que você vende", "Bolos, doces ou salgados: a precificação calcula custo, margem e lucro. Chega de vender no prejuízo."],
  [ChartLineUp, "Saiba quanto você lucra de verdade", "Relatórios de lucratividade por produto e por mês, pra decidir com segurança."],
  [Robot, "Uma assistente que trabalha por você", "A Doo IA calcula preços, sugere receitas e escreve legendas, respostas e a descrição dos produtos."],
  [Bell, "Avisos no celular", "Receba os avisos do Doonly no celular, mesmo com o app fechado."],
  [Eye, "Veja quem visita e quem compra", "Visitas, pedidos pelo cardápio e conversão, de hoje e do mês."],
  [Tag, "Cupons que trazem cliente de volta", "Crie cupons de desconto pra atrair novos clientes e fazer os antigos voltarem."],
  [Palette, "Cardápio com a cara da sua marca", "Suas cores, até 3 fotos por produto e um link com o nome da sua loja."],
  [Sparkle, "Modelo de cardápio “Premium”", "Um modelo só de quem é PRO, com mais destaque pra sua marca e seus produtos."],
  [ImageSquare, "Banners que vendem", "Até 4 banners em carrossel pra destacar promoções e lançamentos."],
  [SealCheck, "Selo de loja verificada", "Mais confiança na hora em que o cliente decide comprar."],
  [Crown, "Sem marca d'água", "O cardápio só com a sua marca, sem o \"Feito com Doonly\"."],
  [Infinito, "Produtos e clientes sem limite", "Cadastre todo o cardápio e guarde toda a clientela com o histórico de compras."],
  [AddressBook, "Importe clientes dos contatos", "Traga os contatos direto da agenda do celular (Android)."],
  [FilePdf, "Relatórios em PDF", "Agenda do dia, pedidos e fichas técnicas prontos pra mandar ou imprimir."],
];

/** Checkout do Doonly PRO na Hotmart (com o cupom do 1º mês) */
const CHECKOUT_HOTMART = "https://pay.hotmart.com/M107866310B?checkoutMode=10";

export default function Assinar() {
  const navigate = useNavigate();
  const { isPro, proExpiraEm } = usePlano();
  const { profile } = useProfile();
  const diasRestantes = proExpiraEm ? Math.max(0, Math.ceil((proExpiraEm.getTime() - Date.now()) / 86400000)) : 0;

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
    <>
      <AppPageHeader title="Doonly PRO" subtitle={isPro ? "Você já é PRO" : "Tudo pra sua confeitaria vender mais"} onBack={() => navigate(-1)} />
      <div className="cl9 pro9">
        <section className="pro9-hero">
          <img src="/pro.png" alt="" />
          <div>
            <h1>Sua confeitaria mais lucrativa e organizada</h1>
            <p>Ferramentas que vendem, calculam e organizam por você.</p>
            {!isPro && <span className="pro9-selo">1º mês por {PRECO_1O_MES}</span>}
          </div>
        </section>

        <div className="pro9-grade">
          <section className="cl9-card pro9-lista">
            <Titulo>O que o PRO libera</Titulo>
            {BENEFICIOS.map(([Ic, t, d]) => (
              <div className="pro9-li" key={t}>
                <span className="pro9-ic"><Ic size={22} weight="duotone" /></span>
                <span><b>{t}</b><small>{d}</small></span>
              </div>
            ))}
          </section>

          <aside className="pro9-lado">
            <section className="cl9-card pro9-oferta">
              {isPro ? (<>
                <span className="pro9-ok"><CheckCircle size={30} weight="fill" /></span>
                <b className="pro9-oferta-t">Você já é PRO</b>
                {proExpiraEm && <p className="pro9-oferta-s">Renova em {diasRestantes} {diasRestantes === 1 ? "dia" : "dias"}</p>}
                <Botao variante="secundario" cheio onClick={() => navigate("/minha-assinatura")}>Ver minha assinatura</Botao>
              </>) : (<>
                <span className="pro9-desc">70% de desconto no 1º mês</span>
                <b className="pro9-oferta-t">Plano PRO mensal</b>
                <div className="pro9-preco"><s>{PRECO_CHEIO}</s><b>{PRECO_1O_MES}</b><small>no 1º mês</small></div>
                <p className="pro9-oferta-s">Depois, {PRECO_CHEIO} por mês. Sem fidelidade: cancele quando quiser.</p>
                <Botao cheio icone={<Crown size={20} weight="fill" />} onClick={assinarNaHotmart}>Assinar o PRO</Botao>
                <p className="pro9-seg"><Lock size={14} weight="bold" /> Pagamento seguro pela Hotmart</p>
              </>)}
            </section>

            <section className="cl9-card pro9-faq">
              <Titulo>Dúvidas</Titulo>
              <div><b>Posso cancelar?</b><p>Sim, quando quiser, sem multa.</p></div>
              <div><b>E os meus dados?</b><p>Continuam salvos, mesmo se você voltar pro plano grátis.</p></div>
              <div><b>Como pago?</b><p>Pela Hotmart, um site seguro de pagamentos. Use o mesmo e-mail da sua conta: assim o PRO liga sozinho.</p></div>
            </section>
          </aside>
        </div>
      </div>

      {/* Celular: botão fixo pra assinar sem rolar até o fim */}
      {!isPro && (
        <div className="pro9-fixo">
          <span><small>1º mês</small><b>{PRECO_1O_MES}</b></span>
          <Botao onClick={assinarNaHotmart}>Assinar o PRO</Botao>
        </div>
      )}
    </>
  );
}

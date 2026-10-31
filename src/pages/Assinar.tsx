import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Crown, Lock, CaretDown, CaretRight, Check } from "@phosphor-icons/react";
import { BENEFICIOS } from "@/lib/beneficiosPro";
import { useNavigate } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, Titulo } from "@/components/base";
import { usePlano } from "@/hooks/usePlano";
import { useProfile } from "@/hooks/useProfile";
import { voltarOuIr } from "@/lib/voltar";
import { abrirDooIA } from "@/components/MenuContaItens"; // 11/10: seta de voltar que funciona com a tela aberta direto (link de notificação)
import "./clientes.css";
import "./assinar.css";

/**
 * Página do PRO (09/10: refeita no padrão do app — cabeçalho, cartões, ícones e botão fixo no celular).
 * Mantém: vantagens primeiro, ordenadas pelo que mais pesa pra confeiteira, e o checkout da Hotmart
 * com o e-mail e o nome da conta preenchidos.
 */
const PRECO_CHEIO = "R$ 29,90";
const PRECO_1O_MES = "R$ 8,97"; // 70% de desconto no 1º mês (30% de R$ 29,90)

const DUVIDAS: [string, string][] = [
  ["Posso cancelar?", "Sim, quando quiser, sem multa."],
  ["E os meus dados?", "Continuam salvos, mesmo se você voltar para o plano grátis."],
  ["Como pago?", "Pela Hotmart, um site seguro de pagamentos. Use o mesmo e-mail da sua conta: assim o PRO liga sozinho."],
];
const dataBR = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Checkout do Doonly PRO na Hotmart (com o cupom do 1º mês) */
const CHECKOUT_HOTMART = "https://pay.hotmart.com/M107866310B?checkoutMode=10";

export default function Assinar() {
  const navigate = useNavigate();
  const { isPro, proExpiraEm } = usePlano();
  const { profile } = useProfile();
  // (21/10) computador: sem o voltar no topo (o menu da esquerda já leva de volta)
  const [computador, setComputador] = useState(() => window.matchMedia("(min-width: 901px)").matches);
  useEffect(() => { const mq = window.matchMedia("(min-width: 901px)"); const f = () => setComputador(mq.matches); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);
  const [aberta, setAberta] = useState<number | null>(null);
  const ir = (destino: string | null) => { if (!destino) return; if (destino === "doo") abrirDooIA(); else navigate(destino); };

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
                <span className="pro9-pc">Ativo · </span>{proExpiraEm ? `Renova em ${dataBR(proExpiraEm)} · ` : ""}{PRECO_CHEIO}<span className="pro9-pc"> por mês</span>
              </small>
            </span>
            <button type="button" className="pro9-st-bt" onClick={() => navigate("/minha-assinatura")}>Ver minha assinatura</button>
          </section>
          <button type="button" className="pro9-st-bt2" onClick={() => navigate("/minha-assinatura")}>Ver minha assinatura</button>

          <section className="cl9-card pro9-lista2">
            <Titulo>O que o PRO te dá</Titulo>
            <div className="pro9-l2">
              {BENEFICIOS.map(([Ic, , , t, d, para]) => {
                const conteudo = (<>
                  <span className="pro9-ic"><Ic size={20} weight="duotone" /></span>
                  <span className="pro9-l2-tx"><b>{t}</b><small>{d}</small></span>
                  {para ? <CaretRight size={16} weight="bold" className="pro9-seta" aria-hidden="true" /> : <span className="pro9-visto" aria-label="Incluso"><Check size={12} weight="bold" /></span>}
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
          <img src="/pro.png" alt="" />
          <div>
            <h1>Sua confeitaria mais lucrativa e organizada</h1>
            <p>Ferramentas que vendem, calculam e organizam por você.</p>
            <span className="pro9-selo">1º mês por {PRECO_1O_MES}</span>
          </div>
        </section>

        <div className="pro9-grade">
          {/* (21/10) celular: a oferta (preço) sobe pra logo depois do topo, antes da lista */}
          <aside className="pro9-lado">
            <section className="cl9-card pro9-oferta">
              <span className="pro9-desc">70% de desconto no 1º mês</span>
              <b className="pro9-oferta-t">Plano PRO mensal</b>
              <div className="pro9-preco"><s>{PRECO_CHEIO}</s><b>{PRECO_1O_MES}</b><small>no 1º mês</small></div>
              <p className="pro9-oferta-s">Depois, {PRECO_CHEIO} por mês. Sem fidelidade: cancele quando quiser.</p>
              <Botao cheio icone={<Crown size={20} weight="fill" />} onClick={assinarNaHotmart}>Assinar o PRO</Botao>
              <p className="pro9-seg"><Lock size={14} weight="bold" /> Pagamento seguro pela Hotmart</p>
            </section>
            {computador && duvidas}
          </aside>

          <section className="cl9-card pro9-lista">
            <Titulo>O que o PRO libera</Titulo>
            {BENEFICIOS.map(([Ic, t, d]) => (
              <div className="pro9-li" key={t}>
                <span className="pro9-ic"><Ic size={22} weight="duotone" /></span>
                <span><b>{t}</b><small>{d}</small></span>
              </div>
            ))}
          </section>
          {!computador && duvidas}
        </div>
      </div>
      )}

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

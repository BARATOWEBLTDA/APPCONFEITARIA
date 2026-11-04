// ── Cupons.tsx ───────────────────────────────────────────────────────────────
// (04/11 · 6.20) Cupons de desconto numa tela própria (saiu do Marketing, que foi escondido).
// A lista e o cadastro são os mesmos de antes (CheckoutConfigPage parte="cupons").
// ─────────────────────────────────────────────────────────────────────────────
import AppPageHeader from "@/components/AppPageHeader";
import CheckoutConfigPage from "./CheckoutConfigPage";
import "./marketing.css";

export default function Cupons() {
  return (
    <>
      <AppPageHeader title="Cupons" voltar="/inicio" subtitle="Descontos para trazer cliente nova e fazer quem já comprou voltar"
        infoContent={<><p>Crie um código de desconto (ex.: <strong>BEMVINDA10</strong>) e divulgue no WhatsApp e no Instagram.</p><p>A cliente digita o código no cardápio e o desconto entra sozinho no pedido.</p></>} />
      <div className="mk"><div className="mk-cupons"><CheckoutConfigPage embutido parte="cupons" /></div></div>
    </>
  );
}

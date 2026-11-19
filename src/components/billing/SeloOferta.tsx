// ── SeloOferta.tsx ───────────────────────────────────────────────────────────
// (19/11) Etiqueta da oferta do PRO no topo do celular (Início e cabeçalho das telas), para quem é grátis.
// Na Black Friday ela tem dois lados: um brilho dourado percorre "Black Friday", a etiqueta gira (flip) e do
// outro lado, em dourado, aparece "1º mês por R$ 1". Fora da Black é a etiqueta de sempre ("7 dias grátis").
// ─────────────────────────────────────────────────────────────────────────────
import { Crown } from "@phosphor-icons/react";
import { CTA_PRO, OFERTA_PRO, SELO_TESTE } from "@/lib/beneficiosPro";

export default function SeloOferta({ aoTocar }: { aoTocar: () => void }) {
  if (OFERTA_PRO !== "real1") return (
    <button type="button" className="selo-teste-cel" onClick={aoTocar} aria-label={CTA_PRO}>
      <Crown size={13} weight="fill" aria-hidden="true" />{SELO_TESTE}
    </button>
  );
  return (
    <button type="button" className="selo-vira" onClick={aoTocar} aria-label={`Black Friday: ${CTA_PRO}`}>
      <span className="selo-vira-in" aria-hidden="true">
        <span className="selo-face selo-face--a"><Crown size={13} weight="fill" /><span>Black Friday</span></span>
        <span className="selo-face selo-face--b"><Crown size={13} weight="fill" />1º mês por R$ 1</span>
      </span>
    </button>
  );
}

// ── SeloOferta.tsx ───────────────────────────────────────────────────────────
// (19/11) Etiqueta da oferta do PRO no topo do celular (Início e cabeçalho das telas), para quem é grátis.
// Na Black Friday ela tem dois lados: um brilho dourado percorre "Black Friday", a etiqueta gira (flip) e do
// outro lado, em dourado, aparece "1º mês por R$ 1". Fora da Black é a etiqueta de sempre ("7 dias grátis").
// ─────────────────────────────────────────────────────────────────────────────
import { Crown } from "@phosphor-icons/react";
import { CTA_PRO, ETIQUETA_BLACK, ETIQUETA_SEM_TOQUE, SELO_TESTE } from "@/lib/beneficiosPro";

/** pc: a mesma etiqueta nos lugares do computador (cabeçalho das telas e saudação do Início) */
export default function SeloOferta({ aoTocar, pc = false }: { aoTocar: () => void; pc?: boolean }) {
  if (!ETIQUETA_BLACK) return (
    <button type="button" className="selo-teste-cel" onClick={aoTocar} aria-label={CTA_PRO}>
      <Crown size={13} weight="fill" aria-hidden="true" />{SELO_TESTE}
    </button>
  );
  return (
    <button type="button" className={`selo-vira${pc ? " selo-vira--pc" : ""}`} onClick={ETIQUETA_SEM_TOQUE ? undefined : aoTocar} tabIndex={ETIQUETA_SEM_TOQUE ? -1 : undefined} style={ETIQUETA_SEM_TOQUE ? { cursor: "default" } : undefined} aria-label={ETIQUETA_SEM_TOQUE ? "Black Friday: 1º mês por R$ 1" : `Black Friday: ${CTA_PRO}`}>
      <span className="selo-vira-in" aria-hidden="true">
        <span className="selo-face selo-face--a"><Crown size={13} weight="fill" /><span>Black Friday</span></span>
        <span className="selo-face selo-face--b"><Crown size={13} weight="fill" />1º mês por R$ 1</span>
      </span>
    </button>
  );
}

/**
 * Selo de modo de entrega do produto no cardápio público.
 * Vem do cadastro (Produtos → Modo de entrega):
 *  - pronta_entrega = true  → "Pronta entrega" (só selo na foto)
 *  - antecedencia = "3d"... → "Pedir 3 dias antes" (selo na foto + aviso no detalhe)
 * Sem nada marcado → nenhum selo (produto aparece como sempre).
 */

const ANTECEDENCIA: Record<string, string> = {
  "24h": "1 dia",
  "48h": "2 dias",
  "3d": "3 dias",
  "5d": "5 dias",
  "7d": "1 semana",
  "15d": "15 dias",
};

export type SeloEntrega =
  | { tipo: "pronta" }
  | { tipo: "encomenda"; prazo: string };

export function seloEntrega(produto: any): SeloEntrega | null {
  const ant = produto?.antecedencia as string | undefined;
  if (ant && ANTECEDENCIA[ant]) return { tipo: "encomenda", prazo: ANTECEDENCIA[ant] };
  if (produto?.pronta_entrega === true) return { tipo: "pronta" };
  return null;
}

const IconeRaio = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ display: "inline-block", flexShrink: 0 }}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
  </svg>
);
const IconeCalendario = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline-block", flexShrink: 0 }}>
    <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" />
  </svg>
);

/** Selo pequeno no canto de baixo da foto do card (o card precisa ter position: relative na foto) */
export function SeloEntregaFoto({ produto }: { produto: any }) {
  const s = seloEntrega(produto);
  if (!s) return null;
  const pronta = s.tipo === "pronta";
  return (
    <span
      style={{
        position: "absolute", left: 6, bottom: 6, zIndex: 5,
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "4px 8px", borderRadius: 999,
        background: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
        fontSize: 10, fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap",
        color: pronta ? "#15803D" : "#2C1219",
        maxWidth: "calc(100% - 12px)", overflow: "hidden", textOverflow: "ellipsis",
      }}
    >
      {pronta ? <IconeRaio /> : <IconeCalendario />}
      {pronta ? "Pronta entrega" : `Pedir ${s.prazo} antes`}
    </span>
  );
}

/** Aviso no detalhe do produto — só pra encomenda */
export function AvisoAntecedencia({ produto }: { produto: any }) {
  const s = seloEntrega(produto);
  if (!s || s.tipo !== "encomenda") return null;
  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "flex-start",
      background: "#F5F0F2", color: "#2C1219", borderRadius: 12, padding: "12px 14px",
    }}>
      <span style={{ marginTop: 1 }}><IconeCalendario size={16} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: 13.5, fontWeight: 800, lineHeight: 1.3, textWrap: "balance" } as any}>Encomende com {s.prazo} de antecedência</strong>
        {/* 02/10: bloco (antes ficava solto na linha e ignorava a altura de linha) e um texto que ajuda */}
        <span style={{ display: "block", marginTop: 3, fontSize: 12.5, color: "#6B5D64", lineHeight: 1.4, textWrap: "balance" } as any}>Você escolhe o dia ao finalizar o pedido.</span>
      </div>
    </div>
  );
}

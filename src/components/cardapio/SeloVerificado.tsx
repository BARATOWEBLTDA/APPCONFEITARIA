/** Selo "Loja verificada" — ao lado do nome das lojas PRO no cardápio (01/10).
 *  08/10: no estilo do verificado do Instagram (azul, com o check branco). */
const ROSETA = "M10.22 2.20 Q12.00 1.00 13.78 2.20 Q15.56 3.41 17.67 3.81 Q19.78 4.22 20.19 6.33 Q20.59 8.44 21.80 10.22 Q23.00 12.00 21.80 13.78 Q20.59 15.56 20.19 17.67 Q19.78 19.78 17.67 20.19 Q15.56 20.59 13.78 21.80 Q12.00 23.00 10.22 21.80 Q8.44 20.59 6.33 20.19 Q4.22 19.78 3.81 17.67 Q3.41 15.56 2.20 13.78 Q1.00 12.00 2.20 10.22 Q3.41 8.44 3.81 6.33 Q4.22 4.22 6.33 3.81 Q8.44 3.41 10.22 2.20 Z";

export function SeloVerificado({ tamanho = 18 }: { tamanho?: number }) {
  return (
    <span className="selo-verif" title="Loja verificada pelo Doonly" aria-label="Loja verificada" role="img"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: tamanho, height: tamanho, verticalAlign: "-3px", marginLeft: 6, flexShrink: 0 }}>
      <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.08))" }}>
        <path fill="#0095F6" d={ROSETA} />
        <path d="M7.6 12.3l3 3 5.8-6.1" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

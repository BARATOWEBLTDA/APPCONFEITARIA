/** Selo "Loja verificada" — aparece ao lado do nome das lojas PRO no cardápio (01/10). */
export function SeloVerificado({ tamanho = 18 }: { tamanho?: number }) {
  return (
    <span className="selo-verif" title="Loja verificada pelo Doonly" aria-label="Loja verificada" role="img"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: tamanho, height: tamanho, verticalAlign: "-3px", marginLeft: 6, flexShrink: 0 }}>
      <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true">
        <defs><linearGradient id="seloVerifG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F472B6" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient></defs>
        <path fill="url(#seloVerifG)" d="M12 1.5l2.6 1.9 3.2-.1 1 3.1 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3.1-3.2-.1L12 22.5l-2.6-1.9-3.2.1-1-3.1-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3.1 3.2.1z" />
        <path d="M8 12.2l2.6 2.6L16.2 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

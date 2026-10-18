import { useId } from "react";

/**
 * (17/10) Logos coloridas do Instagram (degradê) e do Facebook (azul), nas cores das marcas.
 * Usadas em Dados da loja e no "Sobre a loja" do cardápio público.
 */
export function LogoInstagram({ tamanho = 22 }: { tamanho?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none" }}>
      <defs>
        <radialGradient id={`ig${id}`} cx="30%" cy="107%" r="150%">
          <stop offset="0" stopColor="#FDF497" /><stop offset=".05" stopColor="#FDF497" />
          <stop offset=".45" stopColor="#FD5949" /><stop offset=".6" stopColor="#D6249F" /><stop offset=".9" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="6.5" fill={`url(#ig${id})`} />
      <rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="16.3" cy="7.7" r="1" fill="#fff" />
    </svg>
  );
}

export function LogoFacebook({ tamanho = 22 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none" }}>
      <circle cx="12" cy="12" r="11" fill="#1877F2" />
      <path d="M13.4 23v-8.2h2.7l.4-3.2h-3.1V9.6c0-.9.3-1.6 1.6-1.6h1.7V5.2c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.4H7.6v3.2h2.7V23z" fill="#fff" />
    </svg>
  );
}

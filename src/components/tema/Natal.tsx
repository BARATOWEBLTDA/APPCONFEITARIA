import { useEffect, useId, useState } from "react";
import "./temaNatal.css";

/**
 * (19/10) Touquinha clássica tombada, em 3D: o gorro (com a ponta e o pompom) fica ATRÁS da logo
 * e só a aba de pelúcia passa NA FRENTE da borda de cima, com uma sombrinha na logo.
 * Uso: <Touquinha parte="tras" /> antes da logo e <Touquinha parte="frente" /> depois (a logo com z-index 2).
 * "toda" desenha tudo junto (pra lugares sem logo de verdade, como o círculo do Pedido enviado).
 * A caixa tem o tamanho da logo; o desenho é feito num círculo de raio 64 (centro 0,0).
 */
export function Touquinha({ className = "", parte = "toda" }: { className?: string; parte?: "tras" | "frente" | "toda"; tamanho?: number }) {
  const id = useId().replace(/:/g, "");
  const tras = parte !== "frente", frente = parte !== "tras";
  return (
    <span className={`tn-touca-box tn-touca--${parte} ${className}`} aria-hidden="true">
      <svg className="tn-touca" viewBox="-80 -135 200 165">
        <defs>
          <radialGradient id={`v${id}`} cx="35%" cy="30%" r="80%"><stop offset="0" stopColor="#F0423E" /><stop offset=".55" stopColor="#C8191C" /><stop offset="1" stopColor="#7E0D12" /></radialGradient>
          <linearGradient id={`d${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9E1217" /><stop offset="1" stopColor="#6A0A0E" /></linearGradient>
          <radialGradient id={`p${id}`} cx="50%" cy="20%" r="90%"><stop offset="0" stopColor="#FFFFFF" /><stop offset=".7" stopColor="#F3EEEA" /><stop offset="1" stopColor="#D9D0CA" /></radialGradient>
          <radialGradient id={`m${id}`} cx="38%" cy="35%" r="70%"><stop offset="0" stopColor="#FFFFFF" /><stop offset=".75" stopColor="#EEE7E2" /><stop offset="1" stopColor="#CFC4BD" /></radialGradient>
          <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3A1A10" stopOpacity=".38" /><stop offset="1" stopColor="#3A1A10" stopOpacity="0" /></linearGradient>
          <clipPath id={`c${id}`}><circle r="62" /></clipPath>
        </defs>
        {tras && (
          <g transform="translate(0,-64) scale(.74) translate(0,64) rotate(-12)">
            <path d="M-58 -40 C-56 -96 -14 -126 30 -118 C62 -112 86 -86 96 -50 C102 -30 100 -10 92 4 C88 -14 80 -28 68 -36 C70 -44 70 -48 66 -50 Z" fill={`url(#v${id})`} />
            <path d="M30 -118 C62 -112 86 -86 96 -50 C102 -30 100 -10 92 4 C88 -14 80 -28 68 -36 C64 -66 52 -96 30 -118 Z" fill={`url(#d${id})`} />
            <path d="M-36 -72 C-24 -98 0 -110 22 -110" fill="none" stroke="#FF8A80" strokeWidth="6" strokeLinecap="round" opacity=".45" />
            <path d="M6 -60 C20 -78 40 -90 58 -92" fill="none" stroke="#8C1015" strokeWidth="3" strokeLinecap="round" opacity=".6" />
            <g transform="translate(94,10)"><circle r="15" fill={`url(#m${id})`} /><circle cx="-7" cy="-6" r="6" fill="#FFFFFF" opacity=".9" /><circle cx="7" cy="5" r="5" fill="#E6DED8" opacity=".8" /></g>
          </g>
        )}
        {frente && (
          <g clipPath={`url(#c${id})`}><g transform="translate(0,-64) scale(.74) translate(0,64) rotate(-12)">
            <path d="M-62 -20 C-30 -38 30 -38 62 -20 L62 4 C30 -14 -30 -14 -62 4Z" fill={`url(#s${id})`} />
          </g></g>
        )}
        {frente && (
          <g transform="translate(0,-64) scale(.74) translate(0,64) rotate(-12)">
            <path d="M-72 -30 C-72 -42 -64 -50 -55 -51 C-52 -61 -40 -64 -32 -59 C-26 -68 -12 -69 -5 -62 C2 -70 16 -70 22 -62 C30 -68 44 -64 47 -56 C56 -58 66 -50 66 -41 C74 -38 76 -26 70 -20 C64 -14 56 -16 50 -19 C26 -30 -26 -30 -52 -18 C-60 -15 -70 -18 -72 -30Z" fill={`url(#p${id})`} />
            <path d="M-60 -36 C-56 -40 -50 -42 -46 -40 M-30 -46 C-26 -50 -20 -50 -16 -47 M2 -50 C6 -53 12 -53 16 -50 M30 -46 C34 -49 40 -48 44 -45" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".9" />
            <path d="M-62 -24 C-34 -34 34 -34 64 -22" stroke="#D9D0CA" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        )}
      </svg>
    </span>
  );
}

/** Raminho de azevinho (enfeite dos produtos). */
export function Azevinho({ tamanho = 26 }: { tamanho?: number }) {
  return (
    <svg className="tn-azev" width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 17 C10 8 3 10 3 10 C6 12 5 15 7 16 C5 18 7 21 9 20 C10 23 14 21 16 17Z" fill="#15803D" />
      <path d="M16 17 C22 8 29 10 29 10 C26 12 27 15 25 16 C27 18 25 21 23 20 C22 23 18 21 16 17Z" fill="#166534" />
      <circle cx="13.5" cy="19" r="3" fill="#DC2626" /><circle cx="18.5" cy="19" r="3" fill="#B91C1C" /><circle cx="16" cy="22.5" r="3" fill="#DC2626" />
    </svg>
  );
}

/** Estrelas e flocos caindo por alguns segundos (Pedido enviado). Não roda pra quem pede menos movimento. */
export function NeveNatal({ duracao = 5000 }: { duracao?: number }) {
  const [vivo, setVivo] = useState(true);
  useEffect(() => { const t = setTimeout(() => setVivo(false), duracao); return () => clearTimeout(t); }, [duracao]);
  if (!vivo) return null;
  const itens = Array.from({ length: 26 }, (_, i) => ({
    l: (i * 37) % 100, d: (i % 7) * 0.35, t: 2.6 + (i % 5) * 0.5, s: 10 + (i % 4) * 4, estrela: i % 3 === 0,
  }));
  return (
    <div className="tn-neve" aria-hidden="true">
      {itens.map((it, i) => (
        <span key={i} style={{ left: `${it.l}%`, animationDelay: `${it.d}s`, animationDuration: `${it.t}s`, fontSize: it.s }}>
          {it.estrela
            ? <svg width={it.s} height={it.s} viewBox="0 0 24 24"><path d="M12 2l2.6 6 6.4.5-4.9 4.2 1.5 6.3L12 15.6 6.4 19l1.5-6.3L3 8.5l6.4-.5z" fill="#E7C46A" /></svg>
            : <svg width={it.s} height={it.s} viewBox="0 0 24 24"><g stroke="#9CC3E6" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" /></g></svg>}
        </span>
      ))}
    </div>
  );
}

/** Liga a classe do tema na página (os enfeites de CSS dependem dela). */
export function useClasseTema(tema: string | undefined) {
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("tema-natal", tema === "natal");
    return () => el.classList.remove("tema-natal");
  }, [tema]);
}
export const temaNatalLigado = () => typeof document !== "undefined" && document.documentElement.classList.contains("tema-natal");

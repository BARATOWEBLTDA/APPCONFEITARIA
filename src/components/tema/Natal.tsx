import { useEffect, useState } from "react";
import "./temaNatal.css";

/**
 * (19/10) Touca de Natal: imagem PNG transparente (public/temas/touca-natal.png), pequena e inclinada pra esquerda,
 * apoiada na borda de cima da logo. Vai numa caixa do tamanho da logo (posição absoluta); a logo não muda.
 * "tras" não desenha nada (ficou só pra compatibilidade com quem ainda passa as duas partes).
 */
export const TOUCA_NATAL_URL = "/temas/touca-natal.png";
export function Touquinha({ className = "", parte = "toda" }: { className?: string; parte?: "tras" | "frente" | "toda"; tamanho?: number }) {
  if (parte === "tras") return null;
  return (
    <span className={`tn-touca-box ${className}`} aria-hidden="true">
      <img className="tn-touca-img" src={TOUCA_NATAL_URL} alt="" decoding="async" />
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

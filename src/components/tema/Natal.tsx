import { useEffect, useState } from "react";
import "./temaNatal.css";

/**
 * (18/10) Touquinha de Papai Noel "vestida" na logo: a aba branca acompanha a curva de cima da logo,
 * o gorro tomba pro lado e o pompom cai do lado direito.
 * Vai numa caixa do MESMO tamanho e posição da logo (a classe de quem usa cuida disso; o padrão é cobrir o pai).
 * Desenho num círculo de 100 de diâmetro (centro 50,100): a caixa = a logo, o svg passa um pouco pra cima e pros lados.
 */
export function Touquinha({ className = "" }: { className?: string; tamanho?: number }) {
  return (
    <span className={`tn-touca-box ${className}`} aria-hidden="true">
      <svg className="tn-touca" viewBox="0 18 100 58">
        <g transform="rotate(-10 50 100)">
          <path d="M14 55 C18 36 34 24 54 24 C74 24 90 32 96 44 C90 40 84 39 79 41 C82 46 85 51 86 55 A58 58 0 0 0 14 55 Z" fill="#DC2626" />
          <path d="M54 24 C74 24 90 32 96 44 C90 40 84 39 79 41 C72 33 64 28 54 24 Z" fill="#B91C1C" />
          <path d="M23 49 C28 38 38 31 50 28" fill="none" stroke="#F87171" strokeWidth="2.5" strokeLinecap="round" opacity=".55" />
          <path d="M12.7 55.6 A58 58 0 0 1 87.3 55.6 L79.6 64.8 A46 46 0 0 0 20.4 64.8 Z" fill="#FFFFFF" stroke="#E5E1E3" strokeWidth="1.2" strokeLinejoin="round" />
          <circle cx="97" cy="45" r="6.5" fill="#FFFFFF" stroke="#E5E1E3" strokeWidth="1.2" />
        </g>
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

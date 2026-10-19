import { useEffect, useState } from "react";
import "./temaNatal.css";

/** (18/10) Touquinha de Papai Noel: vai pendurada no canto da logo. */
export function Touquinha({ className = "", tamanho = 64 }: { className?: string; tamanho?: number }) {
  return (
    <svg className={`tn-touca ${className}`} width={tamanho} height={Math.round(tamanho * 46 / 56)} viewBox="0 0 56 46" aria-hidden="true">
      <path d="M6 36 C14 10 34 2 46 12 C40 14 36 22 36 34 Z" fill="#DC2626" />
      <path d="M12 33 C18 16 30 9 40 12" fill="none" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round" opacity=".6" />
      <rect x="2" y="31" width="38" height="12" rx="6" fill="#FFFFFF" stroke="#E5E1E3" />
      <circle cx="47" cy="12" r="6.5" fill="#FFFFFF" stroke="#E5E1E3" />
    </svg>
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

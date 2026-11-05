import { useEffect, useRef, useState } from "react";

/**
 * (6.116) Texto de exemplo "vivo" no campo da Doo: de vez em quando apaga o texto normal, digita um exemplo do que dá
 * para pedir, espera um pouco e volta. Sutil: uma vez a cada 45 s, só com o campo vazio, sem foco e com a tela à vista.
 * Quem pediu menos movimento no celular (acessibilidade) vê só o texto normal.
 */
export function usePlaceholderVivo(padrao: string, exemplos: string[], { parado = false, intervalo = 45000, primeiro = 8000 } = {}) {
  const [texto, setTexto] = useState(padrao);
  const paradoRef = useRef(parado); paradoRef.current = parado;
  useEffect(() => {
    if (typeof window === "undefined" || !exemplos.length) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let vivo = true, timer = 0, k = 0;
    const esperar = (ms: number) => new Promise<void>(ok => { timer = window.setTimeout(ok, ms); });
    const podeAnimar = () => vivo && !paradoRef.current && document.visibilityState === "visible";
    const apagar = async (de: string) => { for (let i = de.length; i >= 0; i--) { if (!vivo) return; setTexto(de.slice(0, i)); await esperar(28); } };
    const digitar = async (p: string) => { for (let i = 1; i <= p.length; i++) { if (!vivo) return; setTexto(p.slice(0, i)); await esperar(i === 1 ? 120 : 55 + Math.random() * 45); } };
    const ciclo = async () => {
      await esperar(primeiro);
      while (vivo) {
        if (podeAnimar()) {
          const ex = exemplos[k++ % exemplos.length];
          await apagar(padrao); await digitar(ex); await esperar(3200);
          await apagar(ex); await digitar(padrao);
        }
        if (vivo) setTexto(padrao);
        await esperar(intervalo);
      }
    };
    void ciclo();
    return () => { vivo = false; window.clearTimeout(timer); };
  }, [padrao, intervalo, primeiro, exemplos.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  // focou ou começou a escrever no meio da animação: volta na hora para o texto normal
  return parado ? padrao : texto;
}

import { useEffect, useRef, useState } from "react";

const hojeLocal = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Roda `aoVoltar` quando a pessoa VOLTA pro app (11/10): a aba ficou visível, ganhou foco ou a internet voltou.
 * O app instalado no celular fica aberto dias; sem isso o Início, os Pedidos e a Agenda mostravam os dados de ontem.
 * No máximo uma vez a cada `intervaloMin` (padrão 30 s), e nunca com a aba escondida.
 *
 *   useAoVoltar(() => carregar());
 */
export function useAoVoltar(aoVoltar: () => void, intervaloMin = 30_000): void {
  const fn = useRef(aoVoltar);
  useEffect(() => { fn.current = aoVoltar; });
  useEffect(() => {
    let ultima = Date.now();
    const talvez = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ultima < intervaloMin) return;
      ultima = Date.now();
      fn.current();
    };
    // (11/10) internet voltou: recarrega na hora, sem esperar o intervalo
    const voltouInternet = () => {
      if (document.visibilityState !== "visible") return;
      ultima = Date.now();
      fn.current();
    };
    document.addEventListener("visibilitychange", talvez);
    window.addEventListener("focus", talvez);
    window.addEventListener("online", voltouInternet);
    return () => {
      document.removeEventListener("visibilitychange", talvez);
      window.removeEventListener("focus", talvez);
      window.removeEventListener("online", voltouInternet);
    };
  }, [intervaloMin]);
}

/**
 * O dia de hoje ("AAAA-MM-DD", no horário do aparelho) que MUDA sozinho quando vira o dia (11/10).
 * Use como dependência de efeitos e de useMemo que falam em "hoje", "amanhã" e "atrasado":
 *
 *   const hoje = useDiaAtual();
 *   useEffect(() => { carregar(); }, [hoje]);
 *   const grupos = useMemo(() => agrupar(pedidos, hoje), [pedidos, hoje]);
 */
export function useDiaAtual(): string {
  const [dia, setDia] = useState(hojeLocal);
  useEffect(() => {
    const conferir = () => setDia(d => { const agora = hojeLocal(); return agora === d ? d : agora; });
    const relogio = window.setInterval(conferir, 60_000);
    document.addEventListener("visibilitychange", conferir);
    window.addEventListener("focus", conferir);
    return () => { window.clearInterval(relogio); document.removeEventListener("visibilitychange", conferir); window.removeEventListener("focus", conferir); };
  }, []);
  return dia;
}

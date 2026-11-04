// ── DestaqueDaNavegacao.tsx ──────────────────────────────────────────────────
// (04/11 · 6.20) Avisos que levam pra outra tela mostram o balão em cima do lugar exato de tocar.
// Quem navega manda: navigate("/cardapio-design", { state: { destacar: { alvo: ".ap-slot", titulo, texto, acao } } })
// Fica montado no Layout: espera o alvo aparecer (até 4 s), rola até ele e mostra o Destaque.
// "acao" toca no próprio alvo (ex.: abre o envio do banner).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Destaque from "@/components/Destaque";

export type PedidoDestaque = { alvo: string; titulo: string; texto: string; acao?: string };

export default function DestaqueDaNavegacao() {
  const location = useLocation();
  const [d, setD] = useState<PedidoDestaque | null>(null);
  useEffect(() => {
    const pedido = (location.state as { destacar?: PedidoDestaque } | null)?.destacar;
    if (!pedido?.alvo) return;
    let vivo = true, n = 0;
    const t = window.setInterval(() => {
      n++;
      // o primeiro que está na tela (o mesmo botão pode existir escondido no PC/celular)
      const el = Array.from(document.querySelectorAll<HTMLElement>(pedido.alvo)).find(x => x.offsetParent !== null);
      if (el) {
        window.clearInterval(t);
        document.querySelectorAll("[data-guia-alvo]").forEach(x => x.removeAttribute("data-guia-alvo"));
        el.setAttribute("data-guia-alvo", "1");
        el.scrollIntoView({ block: "center" });
        window.setTimeout(() => { if (vivo) setD({ ...pedido, alvo: '[data-guia-alvo="1"]' }); }, 350);
      } else if (n > 40) window.clearInterval(t);
    }, 100);
    return () => { vivo = false; window.clearInterval(t); };
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  return (
    <Destaque alvo={d.alvo} mascote titulo={d.titulo} texto={d.texto} acao={d.acao || "Entendi"}
      aoAcao={() => { setD(null); if (d.acao) (document.querySelector(d.alvo) as HTMLElement | null)?.click(); }}
      aoFechar={() => setD(null)} />
  );
}

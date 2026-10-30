/**
 * (30/10 · 5.45) Som de pedido novo com o app aberto (como no Dora): enquanto tiver pedido esperando aceitar ou recusar,
 * o toque escolhido em Notificações e sons repete (a cada 2 a 5 s, conforme o toque). Para sozinho quando não tiver mais nenhum.
 * Confere os pedidos a cada 15 s (5 s enquanto toca) e quando a tela volta a aparecer. Só toca com o app na frente (aba visível).
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { TOQUES, alertaPedidoHabilitado, toqueEscolhido, tocarToque } from "@/hooks/useSom";

export default function AlertaPedidoNovo({ uid }: { uid?: string | null }) {
  const [pendentes, setPendentes] = useState(0);
  const vivo = useRef(true);
  const ultimo = useRef(0);

  useEffect(() => {
    vivo.current = true;
    if (!uid) return;
    const conferir = async () => {
      if (document.visibilityState !== "visible") return;
      const { count, error } = await supabase.from("pedidos").select("id", { count: "exact", head: true })
        .eq("user_id", uid).in("status", ["aguardando_aceite", "novo", "pendente"]);
      if (vivo.current && !error) { ultimo.current = count || 0; setPendentes(count || 0); }
    };
    // tocando: confere a cada 5 s (para logo depois de aceitar); sem pedido esperando, a cada 15 s
    let t = 0;
    const ciclo = async () => { await conferir(); if (vivo.current) t = window.setTimeout(ciclo, ultimo.current > 0 ? 5000 : 15000); };
    void ciclo();
    const aoVoltar = () => { if (document.visibilityState === "visible") void conferir(); };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    window.addEventListener("doonly:pedidos-mudaram", aoVoltar);
    return () => { vivo.current = false; window.clearTimeout(t); document.removeEventListener("visibilitychange", aoVoltar); window.removeEventListener("focus", aoVoltar); window.removeEventListener("doonly:pedidos-mudaram", aoVoltar); };
  }, [uid]);

  useEffect(() => {
    if (!pendentes) return;
    let parar = false;
    let t = 0;
    const tocar = () => {
      if (parar) return;
      const id = toqueEscolhido();
      if (alertaPedidoHabilitado() && document.visibilityState === "visible") tocarToque(id);
      t = window.setTimeout(tocar, (TOQUES.find(x => x.id === id)?.cada || 3) * 1000);
    };
    tocar();
    return () => { parar = true; window.clearTimeout(t); };
  }, [pendentes]);

  return null;
}

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/**
 * (21/10) Quantos pedidos estão esperando a loja aceitar: vira a bolinha no "Pedidos" do menu de baixo.
 * Mesma regra do Início: novo/aguardando aceite/pendente, ou do cardápio esperando o Pix.
 * Conta de novo ao trocar de tela, ao voltar pro app e a cada 1 minuto com o app aberto (só a contagem, leve).
 */
export function usePedidosParaAceitar(userId?: string | null): number {
  const { pathname } = useLocation();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!userId) { setN(0); return; }
    let vivo = true;
    const contar = async () => {
      if (document.visibilityState !== "visible") return;
      const { count, error } = await supabase
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .or("status.in.(aguardando_aceite,novo,pendente),and(status.eq.aguardando_pagamento,origem.eq.cardapio)");
      if (vivo && !error) setN(count || 0);
    };
    contar();
    const t = window.setInterval(contar, 60000);
    document.addEventListener("visibilitychange", contar);
    return () => { vivo = false; window.clearInterval(t); document.removeEventListener("visibilitychange", contar); };
  }, [userId, pathname]);

  return n;
}

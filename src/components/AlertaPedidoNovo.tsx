/**
 * (30/10 · 5.45) Som de pedido novo com o app aberto (como no Dora).
 * (6.71) Não toca mais sem parar:
 *  - chegou pedido novo que ela ainda não viu: toca o toque escolhido 4 vezes e para;
 *  - continua sem ver: um toque de lembrete a cada 5 minutos;
 *  - abriu a tela Pedidos: para de tocar e some a bolinha.
 * Enquanto houver pedido novo não visto, o "Pedidos" do menu (lateral e de baixo) ganha uma bolinha piscando
 * (atributo data-pedido-novo no <html>, o CSS desenha a bolinha).
 * Confere os pedidos a cada 15 s e quando a tela volta a aparecer. Só toca com o app na frente (aba visível).
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { definirNumeroNoIcone } from "@/lib/nativoApp";
import { TOQUES, alertaPedidoHabilitado, toqueEscolhido, tocarToque } from "@/hooks/useSom";

const CHAVE_VISTO = "doonly_pedidos_visto_em";
const lerVisto = () => { try { return localStorage.getItem(CHAVE_VISTO) || ""; } catch { return ""; } };
/** (6.174) "visto" = o pedido mais novo que o servidor tem (antes era o relógio do celular: adiantado, escondia pedidos novos) */
const marcarVisto = async (uid?: string | null) => {
  if (!uid) return;
  try {
    const { data, error } = await supabase.from("pedidos").select("created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(1);
    const ultimo = !error && data && data[0] ? String((data[0] as { created_at: string }).created_at) : "";
    if (ultimo && ultimo > lerVisto()) localStorage.setItem(CHAVE_VISTO, ultimo);
  } catch { /* sem internet ou sem armazenamento: fica o visto anterior */ }
};
const VEZES = 4;
const LEMBRETE_MS = 5 * 60 * 1000;

export default function AlertaPedidoNovo({ uid }: { uid?: string | null }) {
  const { pathname } = useLocation();
  const naTelaPedidos = pathname === "/pedidos" || pathname.startsWith("/pedidos/");
  const [naoVistos, setNaoVistos] = useState(0);
  const vivo = useRef(true);
  const ultimoNaoVistos = useRef(0);

  // (12/11) app da Play Store: o mesmo número aparece no ícone do app
  useEffect(() => { definirNumeroNoIcone(naoVistos); }, [naoVistos]);

  // abriu Pedidos: tudo o que chegou até agora conta como visto
  useEffect(() => { if (naTelaPedidos) { void marcarVisto(uid); setNaoVistos(0); } }, [naTelaPedidos, pathname, uid]);

  useEffect(() => {
    vivo.current = true;
    if (!uid) return;
    const conferir = async () => {
      if (document.visibilityState !== "visible") return;
      if (window.location.pathname.startsWith("/pedidos")) { void marcarVisto(uid); if (vivo.current) setNaoVistos(0); return; }
      let q = supabase.from("pedidos").select("id", { count: "exact", head: true })
        .eq("user_id", uid).in("status", ["aguardando_aceite", "novo", "pendente"]);
      const visto = lerVisto();
      if (visto) q = q.gt("created_at", visto);
      const { count, error } = await q;
      if (vivo.current && !error) {
        // (6.71) chegou pedido novo: avisa as telas abertas (o Início recarrega e mostra o pedido no topo)
        if ((count || 0) > ultimoNaoVistos.current) window.dispatchEvent(new Event("doonly:pedido-chegou"));
        ultimoNaoVistos.current = count || 0;
        setNaoVistos(count || 0);
      }
    };
    let t = 0;
    const ciclo = async () => { await conferir(); if (vivo.current) t = window.setTimeout(ciclo, 15000); };
    void ciclo();
    const aoVoltar = () => { if (document.visibilityState === "visible") void conferir(); };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    window.addEventListener("doonly:pedidos-mudaram", aoVoltar);
    return () => { vivo.current = false; window.clearTimeout(t); document.removeEventListener("visibilitychange", aoVoltar); window.removeEventListener("focus", aoVoltar); window.removeEventListener("doonly:pedidos-mudaram", aoVoltar); };
  }, [uid]);

  // bolinha no "Pedidos" do menu
  useEffect(() => {
    const h = document.documentElement;
    if (naoVistos > 0) h.dataset.pedidoNovo = "1"; else delete h.dataset.pedidoNovo;
    return () => { delete h.dataset.pedidoNovo; };
  }, [naoVistos]);

  // som: 4 toques quando chega (ou aumenta), depois um lembrete a cada 5 minutos
  useEffect(() => {
    if (!naoVistos) return;
    let parar = false;
    let t = 0;
    let vez = 0;
    const tocar = () => {
      if (parar) return;
      const id = toqueEscolhido();
      if (alertaPedidoHabilitado() && document.visibilityState === "visible") tocarToque(id);
      vez++;
      t = window.setTimeout(tocar, vez < VEZES ? (TOQUES.find(x => x.id === id)?.cada || 3) * 1000 : LEMBRETE_MS);
    };
    tocar();
    return () => { parar = true; window.clearTimeout(t); };
  }, [naoVistos]);

  return null;
}

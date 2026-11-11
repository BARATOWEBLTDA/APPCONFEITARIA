/**
 * (11/11) O pedido de acesso do suporte em tela cheia: abre sozinho quando ela entra no app (ou na hora, se já estiver
 * usando), com um toque curto. O X é "ver depois": o pedido segue no Início e a tela volta na próxima vez que ela abrir o app.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { emModoSuporte } from "@/lib/supabase";
import { pedidoPendente } from "@/lib/acessoSuporte";
import { tocarSomSuporte } from "@/hooks/useSom";
import JanelaAcessoSuporte from "./JanelaAcessoSuporte";

const DEPOIS = "doonly_suporte_depois_"; // por pedido, nesta abertura do app (sessionStorage)
const adiado = (id: string) => { try { return sessionStorage.getItem(DEPOIS + id) === "1"; } catch { return false; } };

export default function ConviteSuporte() {
  const [id, setId] = useState<string | null>(null);
  const { pathname } = useLocation();
  const tocou = useRef<string | null>(null); // toca uma vez por pedido
  useEffect(() => {
    if (emModoSuporte) return;
    let vivo = true;
    const ler = () => {
      void pedidoPendente().then(p => {
        if (!vivo) return;
        if (p && !adiado(p.id)) {
          if (tocou.current !== p.id) { tocou.current = p.id; tocarSomSuporte(); }
          setId(p.id);
        } else setId(null);
      }).catch(() => {});
    };
    ler();
    // chegou notificação nova (o pedido cria uma): confere na hora
    window.addEventListener("doonly:notif-nova", ler);
    window.addEventListener("doonly:suporte", ler);
    // (11/11) com o app em segundo plano o celular pausa o tempo real (e o aviso que chegou nesse meio-tempo se perde):
    // ao voltar pro app confere de novo; e, com o app aberto, uma conferência leve a cada 30 s como reserva
    const aoVoltar = () => { if (document.visibilityState === "visible") ler(); };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    const t = window.setInterval(aoVoltar, 30000);
    return () => {
      vivo = false;
      window.removeEventListener("doonly:notif-nova", ler); window.removeEventListener("doonly:suporte", ler);
      document.removeEventListener("visibilitychange", aoVoltar); window.removeEventListener("focus", aoVoltar); window.clearInterval(t);
    };
  }, []);
  // na própria tela de Acessos de suporte a janela de lá já cuida do pedido
  if (emModoSuporte || !id || pathname.startsWith("/acessos-suporte")) return null;
  return (
    <JanelaAcessoSuporte id={id} aberta telaCheia
      aoFechar={(respondeu) => {
        if (!respondeu) { try { sessionStorage.setItem(DEPOIS + id, "1"); } catch { /* sem armazenamento: some só agora */ } }
        setId(null);
      }} />
  );
}

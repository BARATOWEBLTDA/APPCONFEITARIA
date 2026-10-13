import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Botao, Janela } from "@/components/base";
import { useNavigate } from "react-router-dom";
import { usePlano } from "@/hooks/usePlano";
import { useProfile } from "@/hooks/useProfile";

/**
 * "Parabéns, agora você é PRO" (aprovado 01/10): aparece UMA vez, na hora em que o plano vira PRO
 * (o app escuta o perfil em tempo real e relê ao voltar pro app). Fica no Layout, então vale em qualquer tela.
 * 09/10 (3.57): na Janela do app (aviso), sem degradês nem letras maiúsculas.
 * 13/10: texto neutro ("Boas-vindas", não "Bem-vinda") e aparece uma vez só de verdade:
 *   · a marca fica também na conta (user_metadata), então não volta em outro aparelho ou navegador
 *   · a marca não é mais apagada quando o plano pisca como "não PRO" enquanto o perfil recarrega
 */

export default function ParabensPro() {
  const navigate = useNavigate();
  const { isPro, loading } = usePlano();
  const { profile } = useProfile();
  const [aberto, setAberto] = useState(false);
  const chave = profile?.id ? `doonly_pro_celebrado_${profile.id}` : "";

  useEffect(() => {
    if (loading || !chave) return;
    let celebrado = true;
    try { celebrado = !!localStorage.getItem(chave); } catch {}
    if (!isPro || celebrado) return;
    // 02/10: só abre depois de confirmar no banco que a conta LOGADA é PRO
    // (numa conta nova, um "PRO" de passagem abria a tela e ela ficava aberta)
    let vivo = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== profile?.id) return;
      // já viu em outro aparelho: guarda aqui também e não abre
      if (user.user_metadata?.pro_celebrado) { try { localStorage.setItem(chave, String(user.user_metadata.pro_celebrado)); } catch {} return; }
      const { data } = await supabase.from("profiles").select("plano, pro_expira_em").eq("id", user.id).maybeSingle();
      const exp = data?.pro_expira_em ? new Date(data.pro_expira_em) : null;
      const proDeVerdade = data?.plano === "pro" && (!exp || exp > new Date());
      if (vivo && proDeVerdade) setAberto(true);
    })().catch(() => {});
    return () => { vivo = false; };
  }, [isPro, loading, chave]); // eslint-disable-line react-hooks/exhaustive-deps
  // Deixou de ser PRO (ou trocou de conta) com a tela aberta: fecha
  useEffect(() => { if (!isPro) setAberto(false); }, [isPro]);

  if (!aberto) return null;
  const fechar = () => {
    const agora = new Date().toISOString();
    try { localStorage.setItem(chave, agora); } catch {}
    supabase.auth.updateUser({ data: { pro_celebrado: agora } }).then(() => {}, () => {});
    setAberto(false); setTimeout(() => window.dispatchEvent(new Event("doonly:parabens-pro-fechou")), 350);
  };
  const nome = String(profile?.nome || "").trim().split(" ")[0];

  return (
    <Janela aberta aoFechar={fechar} titulo={nome ? `Boas-vindas ao PRO, ${nome}!` : "Boas-vindas ao PRO!"}
      texto="Sua assinatura está ativa e tudo já está liberado: cardápio Premium, cupons de desconto, Doo IA e o lucro de cada produto. Agradecemos por confiar no Doonly." icone={<img src="/coroa.png" alt="" className="ppr-coroa" />} tom="laranja"
      acoes={<><Botao variante="secundario" onClick={() => { fechar(); navigate("/minha-assinatura"); }}>Ver assinatura</Botao><Botao onClick={fechar} data-foco-inicial>Começar a usar</Botao></>}>
      <style>{`.ppr-coroa { width: 46px; height: auto; display: block; }`}</style>
    </Janela>
  );
}

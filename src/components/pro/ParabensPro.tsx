import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Crown, Sparkle } from "@phosphor-icons/react";
import { Botao, Janela } from "@/components/base";
import { useNavigate } from "react-router-dom";
import { usePlano } from "@/hooks/usePlano";
import { useProfile } from "@/hooks/useProfile";
import { abrirDooIA } from "@/components/MenuContaItens";

/**
 * "Parabéns, agora você é PRO" (aprovado 01/10): aparece UMA vez, na hora em que o plano vira PRO
 * (o app escuta o perfil em tempo real e relê ao voltar pro app). Fica no Layout, então vale em qualquer tela.
 * 09/10 (3.57): na Janela do app (aviso), sem degradês nem letras maiúsculas.
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
    if (!isPro && celebrado) { try { localStorage.removeItem(chave); } catch {} }
    if (!isPro || celebrado) return;
    // 02/10: só abre depois de confirmar no banco que a conta LOGADA é PRO
    // (numa conta nova, um "PRO" de passagem abria a tela e ela ficava aberta)
    let vivo = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== profile?.id) return;
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
  const fechar = () => { try { localStorage.setItem(chave, new Date().toISOString()); } catch {} setAberto(false); };
  const nome = String(profile?.nome || "").trim().split(" ")[0];

  return (
    <Janela aberta aoFechar={fechar} titulo={nome ? `Parabéns, ${nome}! Agora você é PRO` : "Parabéns! Agora você é PRO"}
      texto="Todos os recursos PRO já estão liberados. Obrigada por apoiar o Doonly." icone={<Crown size={32} weight="fill" />} tom="laranja"
      acoes={<><Botao variante="secundario" onClick={() => { fechar(); navigate("/minha-assinatura"); }}>Ver assinatura</Botao><Botao onClick={fechar} data-foco-inicial>Começar a usar</Botao></>}>
      <Botao variante="link" icone={<Sparkle size={20} weight="fill" />} onClick={() => { fechar(); abrirDooIA(); }} className="ppr-ia">Falar com o Doo IA</Botao>
      <style>{`.ppr-ia { margin-top: 12px; }`}</style>
    </Janela>
  );
}

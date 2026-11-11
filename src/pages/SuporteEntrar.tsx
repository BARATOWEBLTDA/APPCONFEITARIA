/**
 * (11/11) Modo suporte: a aba que a equipe Doonly abre pelo Admin. Recebe o login de uso único (no # do endereço,
 * que não vai para o servidor), entra na loja só nesta aba e leva para a Aparência do cardápio.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { guardarSessaoSuporte } from "@/lib/acessoSuporte";
import { Botao } from "@/components/base";
import { Mascote } from "@/components/marca/Mascote";

export default function SuporteEntrar() {
  const navigate = useNavigate();
  const [erro, setErro] = useState("");
  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    const th = p.get("th"), acessoId = p.get("a") || "", loja = p.get("l") || "Loja", expira = p.get("e") || "";
    history.replaceState(null, "", window.location.pathname); // tira o token do endereço
    if (!th) { setErro("O link de acesso não veio completo. Abra de novo pelo painel Admin."); return; }
    guardarSessaoSuporte({ acessoId, loja, expira });
    supabase.auth.verifyOtp({ token_hash: th, type: "magiclink" }).then(({ error }) => {
      if (error) { setErro("Este link já foi usado ou venceu. Abra de novo pelo painel Admin."); return; }
      navigate("/cardapio-design", { replace: true });
    });
  }, [navigate]);
  return <SuporteAviso titulo={erro ? "Não deu para entrar" : "Entrando na loja…"} texto={erro || "Só um instante."} />;
}

export function SuporteAviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--ui-fundo, #F1F1F0)", fontFamily: "var(--font-base)" }}>
      <div style={{ maxWidth: 360, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <span style={{ width: 96, display: "block" }}><Mascote pose="prancheta" /></span>
        <b style={{ fontSize: 18, fontWeight: 500 }}>{titulo}</b>
        <p style={{ margin: 0, color: "var(--ui-texto-2)", fontSize: 14.5, lineHeight: 1.5 }}>{texto}</p>
        <Botao variante="secundario" tamanho="m" onClick={() => window.close()}>Fechar esta aba</Botao>
      </div>
    </div>
  );
}

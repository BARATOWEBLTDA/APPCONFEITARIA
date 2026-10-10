import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { House } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { Botao } from "@/components/base";
import { Mascote, NomeDoonly } from "@/components/marca/Mascote";
import "./naoEncontrada.css";

/**
 * Página não encontrada (10/10): endereço que não existe.
 * Antes o "*" mandava pro login, e quem já estava logado caía na tela de entrar.
 * O botão leva pro Início (logado) ou pro login (sem conta aberta).
 */
export default function NaoEncontrada() {
  const navegar = useNavigate();
  const [logado, setLogado] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession()
      .then(({ data }) => { if (vivo) setLogado(!!data.session); })
      .catch(() => { if (vivo) setLogado(false); });
    const antes = document.title;
    document.title = "Página não encontrada · Doonly";
    return () => { vivo = false; document.title = antes; };
  }, []);

  return (
    <div className="ne-root">
      <div className="ne-fundo" />
      <main className="ne-cartao">
        <Mascote pose="senha" className="ne-masc" />
        <NomeDoonly className="ne-nome" />
        <h1 className="ne-h">Essa página não existe</h1>
        <p className="ne-p">O link pode estar errado ou a página mudou de lugar.</p>
        <Botao
          cheio
          icone={<House size={20} weight="bold" />}
          disabled={logado === null}
          onClick={() => navegar(logado ? "/inicio" : "/login", { replace: true })}
        >
          Voltar pro início
        </Botao>
      </main>
    </div>
  );
}

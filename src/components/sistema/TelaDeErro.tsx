import { Component, type ErrorInfo, type ReactNode } from "react";
import { ArrowClockwise, Sparkle } from "@phosphor-icons/react";
import { haVersaoNova } from "@/lib/autoAtualizar";
import { Botao } from "@/components/base";
import { Mascote, NomeDoonly } from "@/components/marca/Mascote";
import "@/pages/naoEncontrada.css";
import "./sistema.css";

/**
 * Tela de erro do Doonly (10/10): quando uma tela quebra, aparece esta página
 * (o mesmo desenho da "página não encontrada") no lugar da tela em branco.
 * "Recarregar" abre o app de novo na mesma tela; "Voltar pro início" sai da tela que quebrou.
 */
type Estado = { quebrou: boolean; atualizacao?: boolean };

/** (6.91) parte do app que mudou numa atualização (o arquivo antigo não existe mais) */
export const ehErroDeAtualizacao = (msg: string) => /dynamically imported module|Importing a module script failed|Failed to load module script|error loading dynamically|preload CSS|Loading chunk|Loading CSS chunk|MIME type/i.test(msg);

export default class TelaDeErro extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { quebrou: false, atualizacao: false };

  static getDerivedStateFromError(erro: unknown): Estado { return { quebrou: true, atualizacao: ehErroDeAtualizacao(String((erro as Error)?.message || "")) || haVersaoNova() }; }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error("[Doonly] a tela quebrou:", erro, info.componentStack);
    // (19/10) parte do app que sumiu numa atualização: recarrega uma vez (no máximo a cada 30 s) pra pegar a versão nova
    if (ehErroDeAtualizacao(String(erro?.message || ""))) {
      try {
        const ult = Number(sessionStorage.getItem("doonly_recarga_arquivo") || 0);
        if (Date.now() - ult < 30000) return;
        sessionStorage.setItem("doonly_recarga_arquivo", String(Date.now()));
      } catch { /* sem sessionStorage: recarrega mesmo assim */ }
      window.location.reload();
    }
  }

  render() {
    if (!this.state.quebrou) return this.props.children;
    const noInicio = /^\/(inicio)?$/.test(window.location.pathname);
    // (6.91) não é erro: o Doonly foi atualizado enquanto ela usava. Aviso amigável, um toque e segue de onde parou
    if (this.state.atualizacao) return (
      <div className="ne-root">
        <div className="ne-fundo" />
        <main className="ne-cartao" role="alert">
          <Mascote pose="comemorando" className="ne-masc" />
          <NomeDoonly className="ne-nome" />
          <h1 className="ne-h">Tem uma versão nova do Doonly!</h1>
          <p className="ne-p">Atualizamos o app enquanto você usava. Toque em Atualizar para continuar de onde parou.</p>
          <div className="sis-erro-acoes">
            <Botao cheio icone={<Sparkle size={20} weight="fill" />} onClick={() => window.location.reload()}>Atualizar agora</Botao>
          </div>
        </main>
      </div>
    );
    return (
      <div className="ne-root">
        <div className="ne-fundo" />
        <main className="ne-cartao" role="alert">
          <Mascote pose="senha" className="ne-masc" />
          <NomeDoonly className="ne-nome" />
          <h1 className="ne-h">Algo deu errado por aqui</h1>
          <p className="ne-p">Não foi nada que você fez. Recarregue o app para continuar de onde parou.</p>
          <div className="sis-erro-acoes">
            <Botao cheio icone={<ArrowClockwise size={20} weight="bold" />} onClick={() => window.location.reload()}>Recarregar</Botao>
            {!noInicio && <Botao cheio variante="secundario" onClick={() => { window.location.href = "/inicio"; }}>Voltar para o início</Botao>}
          </div>
        </main>
      </div>
    );
  }
}

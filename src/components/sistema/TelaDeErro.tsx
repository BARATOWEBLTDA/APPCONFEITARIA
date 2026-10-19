import { Component, type ErrorInfo, type ReactNode } from "react";
import { ArrowClockwise } from "@phosphor-icons/react";
import { Botao } from "@/components/base";
import { Mascote, NomeDoonly } from "@/components/marca/Mascote";
import "@/pages/naoEncontrada.css";
import "./sistema.css";

/**
 * Tela de erro do Doonly (10/10): quando uma tela quebra, aparece esta página
 * (o mesmo desenho da "página não encontrada") no lugar da tela em branco.
 * "Recarregar" abre o app de novo na mesma tela; "Voltar pro início" sai da tela que quebrou.
 */
type Estado = { quebrou: boolean };

export default class TelaDeErro extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { quebrou: false };

  static getDerivedStateFromError(): Estado { return { quebrou: true }; }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error("[Doonly] a tela quebrou:", erro, info.componentStack);
    // (19/10) parte do app que sumiu numa atualização: recarrega uma vez (no máximo a cada 30 s) pra pegar a versão nova
    if (/dynamically imported module|Importing a module script failed|Failed to load module script|error loading dynamically/i.test(String(erro?.message || ""))) {
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
    return (
      <div className="ne-root">
        <div className="ne-fundo" />
        <main className="ne-cartao" role="alert">
          <Mascote pose="senha" className="ne-masc" />
          <NomeDoonly className="ne-nome" />
          <h1 className="ne-h">Algo deu errado por aqui</h1>
          <p className="ne-p">Não foi nada que você fez. Recarregue o app pra continuar de onde parou.</p>
          <div className="sis-erro-acoes">
            <Botao cheio icone={<ArrowClockwise size={20} weight="bold" />} onClick={() => window.location.reload()}>Recarregar</Botao>
            {!noInicio && <Botao cheio variante="secundario" onClick={() => { window.location.href = "/inicio"; }}>Voltar pro início</Botao>}
          </div>
        </main>
      </div>
    );
  }
}

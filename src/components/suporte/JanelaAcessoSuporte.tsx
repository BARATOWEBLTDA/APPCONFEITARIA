/**
 * (11/11) A janela que explica o pedido de acesso do suporte antes de a confeiteira decidir (Permitir por 7 dias / Recusar).
 */
import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import { Botao, Janela, avisar } from "@/components/base";
import { responderAcesso } from "@/lib/acessoSuporte";

export default function JanelaAcessoSuporte({ id, aberta, aoFechar }: { id: string | null; aberta: boolean; aoFechar: (respondeu?: boolean) => void }) {
  const [salvando, setSalvando] = useState<"sim" | "nao" | null>(null);
  const responder = async (permitir: boolean) => {
    if (!id) return;
    setSalvando(permitir ? "sim" : "nao");
    try {
      await responderAcesso(id, permitir);
      avisar(permitir ? "Acesso liberado por 7 dias" : "Pedido recusado", { tipo: "ok" });
      aoFechar(true);
    } catch { avisar("Não deu para responder agora", { tipo: "erro", detalhe: "Confira a internet e tente de novo" }); }
    setSalvando(null);
  };
  return (
    <Janela aberta={aberta} aoFechar={() => aoFechar()} tipo="conteudo" titulo="Permitir acesso ao suporte?"
      acoes={<><Botao variante="secundario" carregando={salvando === "nao"} disabled={!!salvando} onClick={() => responder(false)}>Recusar</Botao>
        <Botao carregando={salvando === "sim"} disabled={!!salvando} onClick={() => responder(true)}>Permitir por 7 dias</Botao></>}>
      <div className="jas">
        <p>A equipe Doonly vai personalizar o seu cardápio.</p>
        <ul>
          <li><Check size={16} weight="bold" aria-hidden="true" />Mexe só no cardápio e nos produtos</li>
          <li><Check size={16} weight="bold" aria-hidden="true" />Não vê seu financeiro, pedidos nem clientes</li>
          <li><Check size={16} weight="bold" aria-hidden="true" />Acaba em 7 dias, ou quando você quiser</li>
        </ul>
        <small>Ninguém pede a sua senha. Tudo fica registrado em Minha conta › Acessos de suporte.</small>
      </div>
      <style>{`
        .jas p { margin: 0 0 12px; font-size: 15px; color: var(--ui-texto); }
        .jas ul { margin: 0 0 14px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .jas li { display: flex; align-items: center; gap: 10px; font-size: 14.5px; color: var(--ui-texto); }
        .jas li svg { flex: none; color: var(--ui-verde); }
        .jas small { display: block; font-size: 13px; color: var(--ui-texto-2); line-height: 1.45; }
      `}</style>
    </Janela>
  );
}

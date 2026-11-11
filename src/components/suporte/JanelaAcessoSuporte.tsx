/**
 * (11/11) O convite do suporte: quem pediu (foto e nome do perfil do painel admin), o que vai poder fazer no cardápio,
 * o que fica fechado, e a decisão (Agora não / Permitir por 7 dias).
 */
import { useEffect, useState } from "react";
import { Cake, ChatCircleText, LockSimple, PaintBrush, Storefront, Ticket } from "@phosphor-icons/react";
import { Botao, Janela, avisar } from "@/components/base";
import { lerAcesso, quemPediu, responderAcesso, type AcessoSuporte } from "@/lib/acessoSuporte";

/** a foto de quem pediu (sem foto: a inicial na cor do perfil), com o selo da Doonly no canto */
export function AvatarSuporte({ acesso, tamanho = 40 }: { acesso: Pick<AcessoSuporte, "pedido_por_nome" | "pedido_por_foto" | "pedido_por_cor"> | null; tamanho?: number }) {
  const nome = quemPediu(acesso);
  const semPerfil = !acesso?.pedido_por_nome;
  return (
    <span className="avsup" aria-hidden="true" style={{ width: tamanho, height: tamanho }}>
      <span className="avsup-f" style={{ fontSize: Math.round(tamanho * 0.42), background: acesso?.pedido_por_foto ? "transparent" : semPerfil ? "var(--ui-branco)" : (acesso?.pedido_por_cor || "var(--ui-rosa)") }}>
        {acesso?.pedido_por_foto ? <img src={acesso.pedido_por_foto} alt="" />
          : semPerfil ? <img src="/Sistema/icon-maskable-192.png" alt="" /> : nome.charAt(0).toUpperCase()}
      </span>
      {!semPerfil && <img className="avsup-selo" src="/Sistema/icon-maskable-192.png" alt="" />}
      <style>{`
        .avsup { position: relative; flex: none; display: inline-flex; }
        .avsup-f { display: inline-flex; align-items: center; justify-content: center; width: 100%; height: 100%; overflow: hidden; border-radius: 50%; border: 1px solid var(--ui-borda); color: #fff; font-weight: 500; line-height: 1; }
        .avsup-f img { width: 100%; height: 100%; object-fit: cover; }
        .avsup-selo { position: absolute; right: -2px; bottom: -2px; width: 38%; height: 38%; min-width: 16px; min-height: 16px; border-radius: 50%; border: 2px solid var(--ui-branco); object-fit: cover; }
      `}</style>
    </span>
  );
}

const PODE = [
  { Ic: PaintBrush, t: "Aparência", s: "Logo, foto do topo e cores" },
  { Ic: Cake, t: "Produtos e categorias", s: "Fotos, preços e adicionais" },
  { Ic: Storefront, t: "Dados da loja", s: "Horário, entrega e pagamento" },
  { Ic: ChatCircleText, t: "Mensagens", s: "Textos prontos do WhatsApp" },
  { Ic: Ticket, t: "Cupons e Pixel", s: "Descontos e anúncios" },
];

export default function JanelaAcessoSuporte({ id, aberta, aoFechar }: { id: string | null; aberta: boolean; aoFechar: (respondeu?: boolean) => void }) {
  const [salvando, setSalvando] = useState<"sim" | "nao" | null>(null);
  const [acesso, setAcesso] = useState<AcessoSuporte | null>(null);
  useEffect(() => {
    if (!id || !aberta) return;
    let vivo = true;
    void lerAcesso(id).then(a => { if (vivo) setAcesso(a); }).catch(() => {});
    return () => { vivo = false; };
  }, [id, aberta]);
  const nome = quemPediu(acesso);
  const pessoa = !!acesso?.pedido_por_nome;
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
    <Janela aberta={aberta} aoFechar={() => aoFechar()} className="jas-janela"
      icone={<AvatarSuporte acesso={acesso} tamanho={72} />}
      titulo={nome}
      texto={pessoa ? "Da equipe Doonly · pediu acesso de suporte" : "Pediu acesso de suporte à sua loja"}
      acoes={<><Botao variante="secundario" carregando={salvando === "nao"} disabled={!!salvando} onClick={() => responder(false)}>Agora não</Botao>
        <Botao carregando={salvando === "sim"} disabled={!!salvando} onClick={() => responder(true)} data-foco-inicial>Permitir por 7 dias</Botao></>}>
      <div className="jas">
        <p className="jas-t">O que {pessoa ? `o ${nome}` : "a equipe"} pode fazer no cardápio</p>
        <ul className="jas-l">
          {PODE.map(({ Ic, t, s }) => (
            <li key={t}>
              <span className="jas-ic"><Ic size={18} weight="bold" aria-hidden="true" /></span>
              <span className="jas-tx"><b>{t}</b><small>{s}</small></span>
            </li>
          ))}
        </ul>
        <p className="jas-fecha"><LockSimple size={16} weight="bold" aria-hidden="true" />Não vê financeiro, pedidos nem clientes</p>
        <small className="jas-rod">Acaba em 7 dias, ou quando você quiser. Ninguém pede a sua senha.</small>
      </div>
      <style>{`
        .jas-janela .ui-janela-pe { grid-template-columns: auto 1fr; }
        .jas-janela .ui-janela-pe .ui-bt:first-child { padding-inline: 18px; }
        .jas-janela .ui-janela-ic { width: auto; height: auto; background: none; margin-bottom: 10px; }
        .jas { margin-top: 18px; text-align: left; }
        .jas-t { margin: 0 0 8px; font-size: 14px; font-weight: 500; color: var(--ui-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .jas-l { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
        .jas-l li { display: flex; align-items: center; gap: 12px; padding: 7px 0; }
        .jas-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio); background: var(--ui-branco); color: var(--ui-texto-2); }
        .jas-tx { min-width: 0; flex: 1; }
        .jas-tx b, .jas-tx small { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .jas-tx b { font-size: 14.5px; font-weight: 500; color: var(--ui-texto); }
        .jas-tx small { font-size: 13px; color: var(--ui-texto-2); }
        .jas-fecha { display: flex; align-items: center; gap: 8px; margin: 12px 0 0; padding-top: 12px; border-top: 1px solid var(--ui-linha); font-size: 13.5px; font-weight: 500; color: var(--ui-texto); white-space: nowrap; }
        .jas-fecha svg { flex: none; color: var(--ui-texto-2); }
        .jas-rod { display: block; margin-top: 6px; font-size: 12.5px; color: var(--ui-texto-2); line-height: 1.45; }
      `}</style>
    </Janela>
  );
}

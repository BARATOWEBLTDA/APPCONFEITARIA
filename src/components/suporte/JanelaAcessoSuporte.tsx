/**
 * (11/11) O convite do suporte: quem pediu (foto e nome do perfil do painel admin), o que vai poder fazer no cardápio,
 * o que fica fechado, e a decisão (Agora não / Permitir por 7 dias).
 */
import { useEffect, useState } from "react";
import { Cake, ChatCircleText, LockSimple, PaintBrush, Storefront, Ticket } from "@phosphor-icons/react";
import { Botao, Janela, avisar } from "@/components/base";
import { BotaoFechar } from "@/components/base/BotoesX";
import { SeloVerificado } from "@/components/cardapio/SeloVerificado";
import { lerAcesso, quemPediu, responderAcesso, type AcessoSuporte } from "@/lib/acessoSuporte";

/** a foto de quem pediu (sem foto: a inicial na cor do perfil), com o selo da Doonly no canto */
export function AvatarSuporte({ acesso, tamanho = 40, selo = true }: { acesso: Pick<AcessoSuporte, "pedido_por_nome" | "pedido_por_foto" | "pedido_por_cor"> | null; tamanho?: number; selo?: boolean }) {
  const nome = quemPediu(acesso);
  const semPerfil = !acesso?.pedido_por_nome;
  return (
    <span className="avsup" aria-hidden="true" style={{ width: tamanho, height: tamanho }}>
      <span className="avsup-f" style={{ fontSize: Math.round(tamanho * 0.42), background: acesso?.pedido_por_foto ? "transparent" : semPerfil ? "var(--ui-branco)" : (acesso?.pedido_por_cor || "var(--ui-rosa)") }}>
        {acesso?.pedido_por_foto ? <img src={acesso.pedido_por_foto} alt="" />
          : semPerfil ? <img src="/Sistema/icon-maskable-192.png" alt="" /> : nome.charAt(0).toUpperCase()}
      </span>
      {selo && !semPerfil && <img className="avsup-selo" src="/Sistema/icon-maskable-192.png" alt="" />}
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

/** telaCheia: o convite que abre sozinho ao entrar no app (no celular cobre a tela; o X é "ver depois") */
export default function JanelaAcessoSuporte({ id, aberta, aoFechar, telaCheia = false }: { id: string | null; aberta: boolean; aoFechar: (respondeu?: boolean) => void; telaCheia?: boolean }) {
  const [salvando, setSalvando] = useState<"sim" | "nao" | null>(null);
  // (11/11) só abre depois de saber quem pediu (antes aparecia a logo do Doonly no lugar da foto, um instante)
  const [acesso, setAcesso] = useState<{ id: string; a: AcessoSuporte | null } | null>(null);
  useEffect(() => {
    if (!id || !aberta) return;
    let vivo = true;
    void lerAcesso(id).then(a => { if (vivo) setAcesso({ id, a }); }).catch(() => { if (vivo) setAcesso({ id, a: null }); });
    return () => { vivo = false; };
  }, [id, aberta]);
  const pronto = !!acesso && acesso.id === id;
  const a = pronto ? acesso.a : null;
  const nome = quemPediu(a);
  const pessoa = !!a?.pedido_por_nome;
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
    <Janela aberta={aberta && pronto} aoFechar={() => aoFechar()} className={`jas-janela${telaCheia ? " jas-cheia" : ""}`} travada={telaCheia}
      icone={<span className="jas-faixa"><span className="jas-foto"><AvatarSuporte acesso={a} tamanho={84} selo={false} /></span></span>}
      titulo={<span className="jas-nome">{nome}<SeloVerificado tamanho={20} /></span>}
      texto={pessoa ? "Da equipe Doonly · pediu acesso de suporte" : "Pediu acesso de suporte à sua loja"}
      acoes={<><Botao variante="secundario" carregando={salvando === "nao"} disabled={!!salvando} onClick={() => responder(false)}>Agora não</Botao>
        <Botao carregando={salvando === "sim"} disabled={!!salvando} onClick={() => responder(true)} data-foco-inicial>Permitir por 7 dias</Botao></>}>
      {telaCheia && <BotaoFechar rotulo="Ver depois" className="jas-x" onClick={() => aoFechar()} />}
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
        <div className="jas-fecha">
          <LockSimple size={20} weight="bold" aria-hidden="true" />
          <span><b>Não vê financeiro, pedidos nem clientes</b><small>Acaba em 7 dias. Ninguém pede a sua senha.</small></span>
        </div>
      </div>
      <style>{`
        .ui-janela.jas-janela { position: relative; overflow: hidden; }
        @media (min-width: 768px) { .ui-veu--centro .ui-janela.jas-janela { max-height: min(96dvh, 820px); } }
        .jas-janela .ui-janela-pe { grid-template-columns: auto 1fr; }
        .jas-janela .ui-janela-pe .ui-bt { padding-inline: 16px; }
        .jas-janela .ui-janela-alca { display: none; }
        .jas-x { position: absolute; top: 8px; right: 8px; z-index: 2; color: #fff !important; }
        /* topo: faixa rosa e a foto saindo entre a faixa e o branco */
        .jas-janela .ui-janela-ic { display: block; width: auto; height: auto; margin: -22px -22px 0; background: none; border-radius: 0; }
        .jas-faixa { position: relative; display: block; height: 84px; background: linear-gradient(120deg, var(--ui-rosa), var(--ui-rosa-escuro)); }
        .jas-foto { position: absolute; left: 50%; bottom: -44px; transform: translateX(-50%); display: flex; padding: 4px; border-radius: 50%; background: var(--ui-branco); }
        .jas-foto .avsup-f { border: 0; }
        .jas-janela .ui-janela-t { margin-top: 50px; font-size: 21px; font-weight: 600; }
        .jas-nome { display: inline-flex; align-items: center; }
        .jas-nome .selo-verif { vertical-align: 0 !important; }
        .jas { margin-top: 14px; text-align: left; }
        .jas-t { margin: 0 0 6px; font-size: 14px; font-weight: 500; color: var(--ui-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        /* tabelinha: linha em cima, embaixo e entre as opções */
        .jas-l { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--ui-linha); border-bottom: 1px solid var(--ui-linha); }
        .jas-l li { display: flex; align-items: center; gap: 12px; padding: 7px 0; }
        .jas-l li + li { border-top: 1px solid var(--ui-linha); }
        .jas-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio); background: var(--ui-branco); color: var(--ui-texto-2); }
        .jas-tx { min-width: 0; flex: 1; }
        .jas-tx b, .jas-tx small { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .jas-tx b { font-size: 14.5px; font-weight: 500; color: var(--ui-texto); }
        .jas-tx small { font-size: 13px; color: var(--ui-texto-2); }
        /* o que fica fechado: em verde, para tranquilizar */
        .jas-fecha { display: flex; align-items: flex-start; gap: 10px; margin-top: 12px; padding: 10px 14px; border-radius: var(--ui-raio); background: var(--ui-verde-fundo); color: var(--ui-verde); }
        .jas-fecha svg { flex: none; margin-top: 1px; }
        .jas-fecha span { min-width: 0; }
        .jas-fecha b { display: block; font-size: 14px; font-weight: 500; white-space: nowrap; }
        .jas-fecha small { display: block; margin-top: 1px; font-size: 12.5px; line-height: 1.4; color: var(--ui-texto-2); white-space: nowrap; }
        @media (max-width: 767px) {
          .ui-janela.jas-cheia { max-width: none; height: 100dvh; max-height: 100dvh; border-radius: 0; }
          .jas-cheia .jas-faixa { height: calc(76px + env(safe-area-inset-top, 0px)); }
          .jas-cheia .ui-janela-corpo { padding-bottom: 0; }
          .jas-fecha b, .jas-fecha small { white-space: normal; text-wrap: balance; }
          .jas-cheia .jas-x { top: calc(8px + env(safe-area-inset-top, 0px)); }
        }
        @media (max-height: 700px) { .jas-l li { padding: 5px 0; } .jas-janela .ui-janela-x { margin-top: 4px; } .jas { margin-top: 10px; } }
      `}</style>
    </Janela>
  );
}

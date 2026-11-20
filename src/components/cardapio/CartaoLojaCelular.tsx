import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { ArrowRight, Copy, LockSimple, Eye, QrCode, ShareNetwork } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { useProfile, fotoDaLoja, type Profile } from "@/hooks/useProfile";

/** Campos da loja que vêm junto do perfil (fora do tipo Profile) */
type PerfilLoja = Profile & { loja_pausada?: boolean | null; horario?: unknown; dias_fechados?: unknown };
import { avisar } from "@/components/base";
import { explicarErro } from "@/lib/erros";
import { situacaoLoja } from "@/lib/agendaCardapio";
import { compartilharCardapio } from "@/lib/compartilharCardapio";
import { marcarCompartilhado, lerPassos, passosCompletos, type EstadoPassos } from "@/lib/primeirosPassos";
import { horarioComFechados } from '@/lib/diasFechados'

/**
 * (16/10) Cardápio digital no CELULAR: um cartão só no lugar do verde "Recebendo pedidos" + "Seu cardápio tá no ar".
 * Em cima a situação (aberto até tal hora / fechado, abre tal hora / pausado) e a chave pra pausar;
 * no meio o link; embaixo Compartilhar (o do celular), Ver cardápio e Baixar QR Code.
 * (17/10) Mais enxuto: sem o título e sem a caixa do link. Embaixo, 4 botões quadradinhos:
 * Compartilhar, Copiar link, Ver e QR Code.
 * (6.118) Desenho novo (aprovado): a loja aparece (logo, nome e link), a situação com o horário e a chave numa caixa,
 * "Enviar meu cardápio" grande e Copiar, Ver e QR Code numa linha embaixo.
 */
// (10/11) mesma ordem dos Primeiros passos; o rótulo vai no botão "Próximo: …" (cabe numa linha no celular)
const ORDEM_PASSOS = ["logo", "descricao", "endereco", "horario", "pagamento", "entrega", "caixa", "produto"] as const;

// (10/11) o último estado lido fica guardado: ao voltar pra Minha loja o cartão certo aparece na hora
// (antes o cartão escuro "Sua loja está ativa" piscava até os passos chegarem)
let ultimo: { uid: string; liberado: boolean; passos: EstadoPassos } | null = null;

export default function CartaoLojaCelular({ link }: { link: string }) {
  const { profile, refetch } = useProfile();
  const navigate = useNavigate();
  const [local, setLocal] = useState<boolean | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [qr, setQr] = useState("");
  const pausada = local ?? ((profile as PerfilLoja)?.loja_pausada === true);
  const sit = useMemo(() => situacaoLoja(horarioComFechados((profile as PerfilLoja)?.horario, (profile as PerfilLoja)?.dias_fechados)), [(profile as PerfilLoja)?.horario, (profile as PerfilLoja)?.dias_fechados]); // eslint-disable-line react-hooks/exhaustive-deps

  // (6.146) conta nova: o cardápio só libera quando os Primeiros passos acabam (antes já aparecia "Recebendo pedidos" sem nada pronto)
  const doCache = ultimo && ultimo.uid === profile?.id ? ultimo : null;
  const [liberado, setLiberado] = useState<boolean | null>(doCache ? doCache.liberado : null);
  // (10/11) com o cardápio bloqueado, o cartão mostra quanto falta e abre direto o próximo passo
  const [passos, setPassos] = useState<EstadoPassos | null>(doCache ? doCache.passos : null);
  useEffect(() => {
    if (!profile?.id) return;
    let vivo = true;
    const ler = () => { lerPassos(profile.id).then(e => { if (vivo && !e.falhou) { const lib = passosCompletos(e); ultimo = { uid: profile.id, liberado: lib, passos: e }; setLiberado(lib); setPassos(e); } }, () => {}); };
    ler();
    window.addEventListener("doonly:passos", ler);
    return () => { vivo = false; window.removeEventListener("doonly:passos", ler); };
  }, [profile?.id]);

  useEffect(() => {
    if (!link) return;
    QRCode.toDataURL(link, { width: 480, margin: 1, color: { dark: "#2C1219", light: "#FFFFFF" } }).then(setQr, () => setQr(""));
  }, [link]);

  if (!profile?.id) return null;

  const alternar = async () => {
    if (salvando) return;
    const novo = !pausada;
    setSalvando(true); setLocal(novo);
    const { error } = await supabase.from("profiles").update({ loja_pausada: novo }).eq("id", profile.id);
    setSalvando(false);
    if (error) {
      setLocal(null);
      const semColuna = /loja_pausada/i.test(String(error.message || "")) || error.code === "PGRST204" || error.code === "42703";
      avisar(semColuna ? "Falta um ajuste no banco para pausar os pedidos (SQL 4.27)." : explicarErro(error, "Não deu para mudar agora. Tente de novo."), { tipo: "erro" });
      return;
    }
    await refetch();
    setLocal(null);
    avisar(novo ? "Pedidos pausados. O cardápio avisa os clientes." : "Loja aberta. O cardápio voltou a receber pedidos.", { tipo: "ok" });
  };

  const compartilhar = async () => {
    const ok = await compartilharCardapio(link, profile?.nome_loja);
    if (ok) marcarCompartilhado(profile.id);
  };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); avisar("Link copiado", { tipo: "ok" }); }
    catch { avisar("Não deu para copiar. Use o Compartilhar.", { tipo: "erro" }); }
  };
  const baixarQr = () => {
    if (!qr) return;
    const a = document.createElement("a"); a.href = qr; a.download = `qrcode-cardapio-${profile?.codigo_publico || "doonly"}.png`; a.click();
  };

  const tom = pausada ? "pausa" : sit && !sit.aberto ? "fechado" : "aberto";
  const linha = pausada ? "Pedidos pausados" : sit ? sit.txt.replace(/^Aberto agora · fecha às /, "Aberto · fecha ").replace(" hoje às ", " ").replace(" às ", " ") : "Recebendo pedidos";
  const nome = (profile.nome_loja || "Minha loja").trim();
  const iniciais = nome.split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join("");
  const foto = fotoDaLoja(profile as PerfilLoja);

  const travado = liberado === false;
  // enquanto não sabe se está liberado, não mostra nenhum dos dois cartões
  if (liberado === null) return null;
  const faltando = passos ? ORDEM_PASSOS.filter(k => !passos[k]) : [];
  const feitos = ORDEM_PASSOS.length - faltando.length;
  // o produto abre a tela de Produtos; os outros abrem a janelinha do passo no Início
  // (10/11) vai pro Início e mostra o balão em volta do passo da vez (o checklist de verdade fica lá)
  const irPara = () => {
    try { sessionStorage.setItem("doonly_pp_balao", "1"); } catch { /* sem sessionStorage: só abre o Início */ }
    navigate("/inicio");
  };
  // (10/11) cardápio bloqueado: o checklist completo já está no Início; aqui fica só um atalho (no estilo do atalho da Doo no Menu)
  if (travado) return (
    <button type="button" className="clc-atalho clc-atalho--viva" onClick={irPara}>
      {/* (19/11) o anel em volta do cadeado enche conforme os passos feitos (125,66 = a volta inteira do círculo de raio 20) */}
      <span className="clc-atalho-ic clc-atalho-ic--anel" aria-hidden="true">
        <svg className="clc-anel" width="44" height="44" viewBox="0 0 44 44">
          <defs><linearGradient id="clc-anel-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F5C76B" /><stop offset="1" stopColor="#CC2E66" /></linearGradient></defs>
          <circle cx="22" cy="22" r="20" fill="none" stroke="#F1E8EC" strokeWidth="3" />
          {feitos > 0 && <circle cx="22" cy="22" r="20" fill="none" stroke="url(#clc-anel-g)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(125.66 * feitos / ORDEM_PASSOS.length).toFixed(1)} 125.66`} />}
        </svg>
        <LockSimple size={18} weight="bold" />
      </span>
      <span className="clc-atalho-tx">
        <b>Liberar meu cardápio</b>
        <small>{passos ? `${faltando.length === 1 ? "Falta 1 passo" : `Faltam ${faltando.length} passos`} · ${feitos} de ${ORDEM_PASSOS.length} feitos` : "Termine a configuração da loja"}</small>
      </span>
      <ArrowRight size={18} weight="bold" aria-hidden="true" />
      <style>{CSS}</style>
    </button>
  );
  // (20/11) cartão branco e mais baixo: a situação fica embaixo do nome e a chave virou um botão com nome
  return (
    <section className="clc" aria-label="Seu cardápio">
      <div className="clc-topo">
        <span className="clc-logo" aria-hidden="true">{foto ? <img src={foto} alt="" /> : iniciais}</span>
        <span className="clc-nome"><b>{nome}</b><small className={`clc-st clc-st--${tom}`}><i aria-hidden="true" /><span>{linha}</span></small></span>
        <button type="button" className="clc-pausa" disabled={salvando} onClick={alternar} aria-label={pausada ? "Voltar a receber pedidos" : "Pausar os pedidos"}>
          {pausada ? <><span className="clc-l">Voltar a receber</span><span className="clc-c">Reabrir</span></> : <><span className="clc-l">Pausar pedidos</span><span className="clc-c">Pausar</span></>}
        </button>
      </div>
      <button type="button" className="clc-enviar" onClick={compartilhar}><ShareNetwork size={19} weight="bold" aria-hidden="true" />Divulgar meu cardápio</button>
      <div className="clc-bts">
        <button type="button" className="clc-b" onClick={copiar}><Copy size={16} aria-hidden="true" /><span className="clc-l2">Copiar link</span><span className="clc-c2">Copiar</span></button>
        <button type="button" className="clc-b" onClick={() => navigate("/cardapio-preview")}><Eye size={16} aria-hidden="true" /><span>Ver</span></button>
        <button type="button" className="clc-b" onClick={baixarQr} disabled={!qr}><QrCode size={16} aria-hidden="true" /><span>QR Code</span></button>
      </div>
      <style>{CSS}</style>
    </section>
  );
}

const CSS = `
  .clc { display: flex; flex-direction: column; gap: 12px; padding: 14px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao, 16px); background: var(--ui-branco); color: var(--ui-texto); font-family: var(--font-base); text-align: left; }
  .clc-topo { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .clc-logo { flex: none; width: 40px; height: 40px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--ui-cinza); color: var(--ui-cinza-texto); font-size: 14px; font-weight: 500; }
  .clc-logo img { width: 100%; height: 100%; object-fit: cover; }
  .clc-nome { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .clc-nome b { font-size: 15.5px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .clc-st { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 13px; white-space: nowrap; }
  .clc-st span { overflow: hidden; text-overflow: ellipsis; }
  .clc-st i { flex: none; width: 7px; height: 7px; border-radius: 50%; }
  .clc-st--aberto { color: #15803D; } .clc-st--aberto i { background: #22C55E; animation: clcPisca 1.6s ease-in-out infinite; }
  .clc-st--fechado { color: #B45309; } .clc-st--fechado i { background: #F59E0B; }
  .clc-st--pausa { color: #B91C1C; } .clc-st--pausa i { background: #EF4444; }
  @keyframes clcPisca { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
  .clc-pausa { position: relative; flex: none; height: 34px; margin: 0; padding: 0 12px; border: 1px solid var(--ui-borda); border-radius: 10px; background: var(--ui-branco); color: var(--ui-cinza-texto); font: 500 13px var(--font-base); white-space: nowrap; cursor: pointer; }
  .clc-pausa::after { content: ""; position: absolute; inset: -5px 0; }
  .clc-pausa:disabled { opacity: .6; }
  .clc-c, .clc-c2 { display: none; }
  @media (max-width: 430px) { .clc-l { display: none; } .clc-c { display: inline; } }
  /* (20/11) o único botão da tela que traz venda: degradê rosa com um brilho que passa devagar */
  .clc-enviar { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; gap: 8px; height: 44px; margin: 0; border: 0; border-radius: var(--ui-raio-botao, 13px); background: linear-gradient(100deg, var(--ui-rosa-botao, #CC2E66), #E4558B 55%, var(--ui-rosa-botao, #CC2E66)); color: #fff; font: 500 15px var(--font-base); white-space: nowrap; cursor: pointer; }
  .clc-enviar::after { content: ""; position: absolute; top: 0; bottom: 0; left: -45%; width: 30%; background: linear-gradient(100deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, .26), rgba(255, 255, 255, 0)); transform: skewX(-18deg); animation: clcBrilho 5s ease-in-out infinite; pointer-events: none; }
  @keyframes clcBrilho { 0%, 72% { left: -45%; } 100% { left: 120%; } }
  .clc-bts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: -4px; }
  .clc-b { position: relative; display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 0; height: 36px; margin: 0; padding: 0 4px; border: 1px solid var(--ui-borda); border-radius: 10px; background: var(--ui-branco); color: var(--ui-cinza-texto); font: 500 13px var(--font-base); white-space: nowrap; cursor: pointer; }
  .clc-b::after { content: ""; position: absolute; inset: -4px 0; }
  .clc-b span { overflow: hidden; text-overflow: ellipsis; }
  .clc-b:disabled { opacity: .5; }
  @media (max-width: 380px) { .clc-l2 { display: none; } .clc-c2 { display: inline; } .clc-bts { gap: 6px; } .clc-b { gap: 4px; font-size: 12.5px; } }
  @media (prefers-reduced-motion: reduce) { .clc-st--aberto i, .clc-enviar::after { animation: none; } .clc-enviar::after { display: none; } }
  .clc-atalho { display: flex; align-items: center; gap: 12px; width: 100%; margin: 0; padding: 10px 14px 10px 10px; border: 1px solid #ECE7E9; border-radius: 16px; background: var(--ui-branco, #fff); font-family: inherit; text-align: left; color: var(--ui-texto); cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .clc-atalho-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: var(--ui-branco); color: var(--ui-rosa-botao, #CC2E66); box-shadow: inset 0 0 0 1px #ECE7E9; }
  /* (19/11) borda em degradê que anda devagar: é o que mais importa na tela enquanto a loja não abre */
  .clc-atalho--viva { border: 2px solid transparent; padding: 9px 13px 9px 9px; background: linear-gradient(var(--ui-branco, #fff), var(--ui-branco, #fff)) padding-box, linear-gradient(90deg, #CC2E66, #F5C76B, #E85A8C, #CC2E66) border-box; background-size: 100% 100%, 200% 100%; animation: clc-corre 5s linear infinite; }
  @keyframes clc-corre { to { background-position: 0 0, 200% 0; } }
  @media (prefers-reduced-motion: reduce) { .clc-atalho--viva { animation: none; } }
  .clc-atalho-ic--anel { position: relative; box-shadow: none; }
  .clc-anel { position: absolute; inset: 0; transform: rotate(-90deg); }
  .clc-atalho-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .clc-atalho-tx b { font-size: 15px; font-weight: 500; }
  .clc-atalho-tx small { font-size: 12.5px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .clc-atalho > svg { flex: none; color: var(--ui-rosa-botao, #CC2E66); }
`;

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { ArrowRight, Copy, Eye, QrCode, ShareNetwork } from "@phosphor-icons/react";
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
const ROTULO_PASSO: Record<typeof ORDEM_PASSOS[number], string> = {
  logo: "colocar a logo", descricao: "falar da sua loja", endereco: "pôr o endereço", horario: "definir o horário",
  pagamento: "formas de pagamento", entrega: "configurar a entrega", caixa: "saldo do caixa", produto: "cadastrar 1º produto",
};

export default function CartaoLojaCelular({ link }: { link: string }) {
  const { profile, refetch } = useProfile();
  const navigate = useNavigate();
  const [local, setLocal] = useState<boolean | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [qr, setQr] = useState("");
  const pausada = local ?? ((profile as PerfilLoja)?.loja_pausada === true);
  const sit = useMemo(() => situacaoLoja(horarioComFechados((profile as PerfilLoja)?.horario, (profile as PerfilLoja)?.dias_fechados)), [(profile as PerfilLoja)?.horario, (profile as PerfilLoja)?.dias_fechados]); // eslint-disable-line react-hooks/exhaustive-deps

  // (6.146) conta nova: o cardápio só libera quando os Primeiros passos acabam (antes já aparecia "Recebendo pedidos" sem nada pronto)
  const [liberado, setLiberado] = useState<boolean | null>(null);
  // (10/11) com o cardápio bloqueado, o cartão mostra quanto falta e abre direto o próximo passo
  const [passos, setPassos] = useState<EstadoPassos | null>(null);
  useEffect(() => {
    if (!profile?.id) return;
    let vivo = true;
    const ler = () => { lerPassos(profile.id).then(e => { if (vivo && !e.falhou) { setLiberado(passosCompletos(e)); setPassos(e); } }, () => {}); };
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
  const titulo = pausada ? "Pedidos pausados" : sit && !sit.aberto ? "Fechado agora" : "Recebendo pedidos";
  const sub = pausada ? "O cardápio avisa os clientes" : sit ? sit.txt.replace(/^Aberto agora · /, "Aberto · ").replace(/^Fechado · /, "").replace(/^./, c => c.toUpperCase()) : "Toque na chave para pausar";
  const nome = (profile.nome_loja || "Minha loja").trim();
  const iniciais = nome.split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join("");
  const foto = fotoDaLoja(profile as PerfilLoja);
  const linkCurto = link.replace(/^https?:\/\/(www\.)?/, "");

  const travado = liberado === false;
  const faltando = passos ? ORDEM_PASSOS.filter(k => !passos[k]) : [];
  const proximo = faltando[0];
  const feitos = ORDEM_PASSOS.length - faltando.length;
  // o produto abre a tela de Produtos; os outros abrem a janelinha do passo no Início
  const irPara = (k: typeof ORDEM_PASSOS[number]) => {
    if (k === "produto") { navigate("/produtos"); return; }
    try { sessionStorage.setItem("doonly_pp_abrir", k); } catch { /* sem sessionStorage: só abre o Início */ }
    navigate("/inicio");
  };
  return (
    <section className={`clc${travado ? " clc--travado" : ""}`} aria-label="Seu cardápio">
      <div className="clc-loja">
        <span className="clc-logo" aria-hidden="true">{foto ? <img src={foto} alt="" /> : iniciais}</span>
        <span className="clc-nome"><b>{nome}</b><small>{linkCurto}</small></span>
      </div>
      {travado ? (
        <>
          <div className="clc-prog">
            <div className="clc-prog-l1">
              <b>{faltando.length === 1 ? "Falta 1 passo pra liberar" : `Faltam ${faltando.length || ""} passos pra liberar`.replace("  ", " ")}</b>
              {passos && <span>{feitos} de {ORDEM_PASSOS.length}</span>}
            </div>
            <div className="clc-barra" role="progressbar" aria-valuemin={0} aria-valuemax={ORDEM_PASSOS.length} aria-valuenow={feitos} aria-label={`${feitos} de ${ORDEM_PASSOS.length} passos feitos`}><i style={{ width: `${(feitos / ORDEM_PASSOS.length) * 100}%` }} /></div>
            <small>Depois disso o cardápio já recebe pedidos</small>
          </div>
          <button type="button" className="clc-enviar" onClick={() => proximo ? irPara(proximo) : navigate("/inicio")}>
            {proximo ? `Próximo: ${ROTULO_PASSO[proximo]}` : "Configurar a loja"}<ArrowRight size={17} weight="bold" aria-hidden="true" />
          </button>
        </>
      ) : (<>
      <div className="clc-sit">
        <span className={`clc-st clc-st--${tom}`}><b><i aria-hidden="true" />{titulo}</b><small>{sub}</small></span>
        <button type="button" role="switch" aria-checked={!pausada} aria-label={pausada ? "Abrir a loja" : "Pausar os pedidos"}
          className="clc-chave" disabled={salvando} onClick={alternar}><span /></button>
      </div>
      <button type="button" className="clc-enviar" onClick={compartilhar}><ShareNetwork size={20} weight="bold" aria-hidden="true" />Enviar meu cardápio</button>
      </>)}
      {!travado && <div className="clc-bts">
        <button type="button" className="clc-b" onClick={copiar}><Copy size={17} weight="bold" aria-hidden="true" /><span>Copiar</span></button>
        <button type="button" className="clc-b" onClick={() => navigate("/cardapio-preview")}><Eye size={17} weight="bold" aria-hidden="true" /><span>Ver</span></button>
        <button type="button" className="clc-b" onClick={baixarQr} disabled={!qr}><QrCode size={17} weight="bold" aria-hidden="true" /><span>QR Code</span></button>
      </div>}
      <style>{CSS}</style>
    </section>
  );
}

const CSS = `
  .clc { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: var(--ui-raio-cartao, 18px); color: var(--ui-branco);
    background: radial-gradient(120% 90% at 100% 0%, rgba(122, 38, 64, .75), rgba(122, 38, 64, 0) 60%), linear-gradient(160deg, #3A2219, var(--ui-vinho-escuro, #22130E));
    box-shadow: 0 12px 26px -14px rgba(34, 19, 14, .8); font-family: var(--font-base); text-align: left; }
  .clc-loja { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .clc-logo { flex: none; width: 52px; height: 52px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #fff; box-shadow: 0 0 0 2px #F7C6D9; color: #8A3A2E; font-size: 17px; font-weight: 600; }
  .clc-logo img { width: 100%; height: 100%; object-fit: cover; }
  .clc-nome { min-width: 0; display: flex; flex-direction: column; }
  .clc-nome b { font-size: 17px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .clc-nome small { font-size: 12.5px; color: rgba(255, 255, 255, .7); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .clc-sit { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border-radius: 14px; background: rgba(255, 255, 255, .06); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .1); }
  .clc-st { min-width: 0; display: flex; flex-direction: column; }
  .clc-st b { display: flex; align-items: center; gap: 7px; font-size: 14.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .clc-st small { padding-left: 15px; font-size: 12.5px; color: rgba(255, 255, 255, .72); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .clc-st i { flex: none; width: 8px; height: 8px; border-radius: 50%; }
  .clc-st--aberto b { color: #86EFAC; } .clc-st--aberto i { background: #4ADE80; animation: clcPisca 1.6s ease-in-out infinite; }
  .clc-st--fechado b { color: #FCD34D; } .clc-st--fechado i { background: #FBBF24; }
  .clc-st--pausa b { color: #FCA5A5; } .clc-st--pausa i { background: #F87171; }
  /* (10/11) cardápio bloqueado: quanto falta (barra) e o botão do próximo passo */
  .clc-prog { padding: 12px; border-radius: 14px; background: rgba(255, 255, 255, .06); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .1); }
  .clc-prog-l1 { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .clc-prog-l1 b { min-width: 0; font-size: 14.5px; font-weight: 500; color: #FCD34D; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .clc-prog-l1 span { flex: none; font-size: 12.5px; color: rgba(255, 255, 255, .72); }
  .clc-barra { height: 6px; margin: 9px 0 7px; overflow: hidden; border-radius: 999px; background: rgba(255, 255, 255, .14); }
  .clc-barra i { display: block; height: 100%; border-radius: inherit; background: #FCD34D; transition: width .3s ease-out; }
  .clc-prog small { display: block; font-size: 12.5px; color: rgba(255, 255, 255, .72); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .clc--travado .clc-enviar { font-weight: 500; font-size: 15px; }
  @keyframes clcPisca { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
  .clc-chave { flex: none; position: relative; width: 48px; height: 28px; margin: 0; padding: 0; border: 0; border-radius: 999px; background: rgba(255, 255, 255, .22); cursor: pointer; transition: background-color .15s linear; }
  .clc-chave span { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .25); transition: transform .15s ease-out; }
  .clc-chave[aria-checked="true"] { background: #15803D; }
  .clc-chave[aria-checked="true"] span { transform: translateX(20px); }
  .clc-chave:disabled { opacity: .6; }
  .clc-chave:focus-visible { outline: 3px solid rgba(255, 255, 255, .6); outline-offset: 2px; }
  .clc-enviar { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 50px; margin: 0; border: 0; border-radius: 14px; background: var(--ui-branco); color: var(--ui-texto); font: 600 15.5px var(--font-base); white-space: nowrap; cursor: pointer; }
  .clc-enviar svg { color: var(--ui-rosa, #E85A8C); }
  .clc-bts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .clc-b { display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 0; min-height: 44px; padding: 0 6px; border: 0; border-radius: 12px; background: rgba(255, 255, 255, .1); color: var(--ui-branco); font: 500 13.5px var(--font-base); white-space: nowrap; cursor: pointer; }
  .clc-b span { overflow: hidden; text-overflow: ellipsis; }
  .clc-b:disabled { opacity: .5; }
  @media (max-width: 380px) { .clc { padding: 14px; } .clc-bts { gap: 6px; } .clc-b { gap: 4px; padding: 0 2px; font-size: 13px; } }
  @media (prefers-reduced-motion: reduce) { .clc-st--aberto i { animation: none; } }
`;

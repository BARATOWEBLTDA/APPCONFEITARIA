import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { Copy, Eye, QrCode, ShareNetwork } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";
import { avisar } from "@/components/base";
import { explicarErro } from "@/lib/erros";
import { situacaoLoja } from "@/lib/agendaCardapio";
import { compartilharCardapio } from "@/lib/compartilharCardapio";
import { marcarCompartilhado } from "@/lib/primeirosPassos";

/**
 * (16/10) Cardápio digital no CELULAR: um cartão só no lugar do verde "Recebendo pedidos" + "Seu cardápio tá no ar".
 * Em cima a situação (aberto até tal hora / fechado, abre tal hora / pausado) e a chave pra pausar;
 * no meio o link; embaixo Compartilhar (o do celular), Ver cardápio e Baixar QR Code.
 * (17/10) Mais enxuto: sem o título e sem a caixa do link. Embaixo, 4 botões quadradinhos:
 * Compartilhar, Copiar link, Ver e QR Code.
 */
export default function CartaoLojaCelular({ link }: { link: string }) {
  const { profile, refetch } = useProfile();
  const navigate = useNavigate();
  const [local, setLocal] = useState<boolean | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [qr, setQr] = useState("");
  const pausada = local ?? ((profile as any)?.loja_pausada === true);
  const sit = useMemo(() => situacaoLoja((profile as any)?.horario), [(profile as any)?.horario]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const a = document.createElement("a"); a.href = qr; a.download = `qrcode-cardapio-${(profile as any)?.codigo_publico || "doonly"}.png`; a.click();
  };

  const tom = pausada ? "pausa" : sit && !sit.aberto ? "fechado" : "aberto";
  const pilula = pausada ? "Pausado · não recebe pedidos" : sit ? sit.txt : "Recebendo pedidos";

  return (
    <section className="clc" aria-label="Seu cardápio">
      <div className="clc-top">
        <span className={`clc-st clc-st--${tom}`}><i aria-hidden="true" />{pilula}</span>
        <button type="button" role="switch" aria-checked={!pausada} aria-label={pausada ? "Abrir a loja" : "Pausar os pedidos"}
          className="clc-chave" disabled={salvando} onClick={alternar}><span /></button>
      </div>
      <div className="clc-bts">
        <button type="button" className="clc-b clc-b--pri" onClick={compartilhar}><ShareNetwork size={20} weight="bold" aria-hidden="true" /><span>Compartilhar</span></button>
        <button type="button" className="clc-b" onClick={copiar}><Copy size={20} weight="bold" aria-hidden="true" /><span>Copiar link</span></button>
        <button type="button" className="clc-b" onClick={() => navigate("/cardapio-preview")}><Eye size={20} weight="bold" aria-hidden="true" /><span>Ver</span></button>
        <button type="button" className="clc-b" onClick={baixarQr} disabled={!qr}><QrCode size={20} weight="bold" aria-hidden="true" /><span>QR Code</span></button>
      </div>
      <style>{CSS}</style>
    </section>
  );
}

const CSS = `
  .clc { position: relative; overflow: hidden; padding: 14px; border-radius: var(--ui-raio-cartao, 18px); color: var(--ui-branco); background: linear-gradient(135deg, var(--ui-vinho-escuro, #22130E), #5A3626); box-shadow: 0 10px 24px -12px rgba(34, 19, 14, .7); font-family: var(--font-base); text-align: left; }
  .clc::after { content: ""; position: absolute; right: -40px; top: -50px; width: 150px; height: 150px; border-radius: 50%; background: rgba(255, 255, 255, .06); pointer-events: none; }
  .clc-top { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .clc-st { min-width: 0; display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 999px; font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .clc-st i { flex: none; width: 7px; height: 7px; border-radius: 50%; }
  .clc-st--aberto { color: #86EFAC; background: rgba(134, 239, 172, .12); } .clc-st--aberto i { background: #4ADE80; animation: clcPisca 1.6s ease-in-out infinite; }
  .clc-st--fechado { color: #FCD34D; background: rgba(252, 211, 77, .12); } .clc-st--fechado i { background: #FBBF24; }
  .clc-st--pausa { color: #FCA5A5; background: rgba(252, 165, 165, .14); } .clc-st--pausa i { background: #F87171; }
  @keyframes clcPisca { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
  .clc-chave { flex: none; position: relative; width: 48px; height: 28px; margin: 0; padding: 0; border: 0; border-radius: 999px; background: rgba(255, 255, 255, .22); cursor: pointer; transition: background-color .15s linear; }
  .clc-chave span { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .25); transition: transform .15s ease-out; }
  .clc-chave[aria-checked="true"] { background: #16A34A; }
  .clc-chave[aria-checked="true"] span { transform: translateX(20px); }
  .clc-chave:disabled { opacity: .6; }
  .clc-chave:focus-visible { outline: 3px solid rgba(255, 255, 255, .6); outline-offset: 2px; }
  .clc-bts { position: relative; z-index: 1; display: grid; grid-template-columns: 1.2fr 1fr 1fr 1fr; gap: 6px; margin-top: 12px; }
  .clc-b { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-width: 0; min-height: 60px; padding: 0 2px; border: 0; border-radius: 12px; background: rgba(255, 255, 255, .14); color: var(--ui-branco); font: 700 11.5px var(--font-base); white-space: nowrap; cursor: pointer; }
  .clc-b span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
  .clc-b:disabled { opacity: .5; }
  .clc-b--pri { background: var(--ui-branco); color: var(--ui-texto); }
  @media (prefers-reduced-motion: reduce) { .clc-st--aberto i { animation: none; } }
`;

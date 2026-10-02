import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile, getCardapioUrl } from "@/hooks/useProfile";
import { lerPassos, marcarCompartilhado, type EstadoPassos } from "@/lib/primeirosPassos";

/**
 * "Primeiros passos" no topo do Início — SÓ NO CELULAR (aprovado 02/10).
 * Ordem: conta ✓ → cardápio com a sua cara → primeiro produto → compartilhar o link.
 * Sincronizado com o passo a passo do Cardápio digital (lib/primeirosPassos).
 * Some de vez quando ela termina e toca em "Fechar". Quem já usa o app (tudo feito) não vê.
 */
export default function PrimeirosPassos() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const uid = profile?.id as string | undefined;
  const [estado, setEstado] = useState<EstadoPassos | null>(null);
  const [fechado, setFechado] = useState(false);
  const [jaViuIncompleto, setJaViuIncompleto] = useState(false);

  const kFechado = uid ? `doonly_pp_fechado_${uid}` : "";
  const kIncompleto = uid ? `doonly_pp_incompleto_${uid}` : "";

  const atualizar = useCallback(() => { if (uid) lerPassos(uid).then(setEstado).catch(() => {}); }, [uid]);

  useEffect(() => {
    if (!uid) return;
    try { setFechado(localStorage.getItem(kFechado) === "1"); setJaViuIncompleto(localStorage.getItem(kIncompleto) === "1"); } catch {}
    atualizar();
    // voltou de outra tela / do WhatsApp: confere de novo
    const f = () => { if (document.visibilityState === "visible") atualizar(); };
    document.addEventListener("visibilitychange", f);
    window.addEventListener("focus", atualizar);
    window.addEventListener("doonly:passos", atualizar);
    return () => { document.removeEventListener("visibilitychange", f); window.removeEventListener("focus", atualizar); window.removeEventListener("doonly:passos", atualizar); };
  }, [uid, atualizar, kFechado, kIncompleto]);

  const tudoFeito = !!estado && estado.design && estado.produto && estado.compartilhou;

  // Mostrou incompleto pelo menos uma vez: no fim ela ganha a comemoração
  useEffect(() => {
    if (uid && estado && !tudoFeito && !jaViuIncompleto) {
      try { localStorage.setItem(kIncompleto, "1"); } catch {}
      setJaViuIncompleto(true);
    }
  }, [uid, estado, tudoFeito, jaViuIncompleto, kIncompleto]);

  if (!uid || !estado || fechado) return null;
  if (tudoFeito && !jaViuIncompleto) return null; // conta antiga, já com tudo pronto

  const link = getCardapioUrl(profile);
  const fechar = () => { try { localStorage.setItem(kFechado, "1"); } catch {} setFechado(true); };

  const compartilhar = async () => {
    const texto = `Confira o cardápio da minha confeitaria: ${link}`;
    if (navigator.share) {
      try { await navigator.share({ title: profile?.nome_loja || "Meu cardápio", text: texto, url: link }); marcarCompartilhado(uid); return; }
      catch { return; } // cancelou o compartilhamento
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
    marcarCompartilhado(uid);
  };

  if (tudoFeito) {
    return (
      <div className="pp pp--fim">
        <div className="pp-conf" aria-hidden="true">🎉</div>
        <b className="pp-ft">Sua confeitaria está pronta pra vender!</b>
        <p className="pp-fs">Você concluiu os primeiros passos. Agora é só esperar os pedidos chegarem 💗</p>
        <a className="pp-fbt" href={link} target="_blank" rel="noopener noreferrer">Ver meu cardápio</a>
        <button type="button" className="pp-ffx" onClick={fechar}>Fechar</button>
        <style>{CSS}</style>
      </div>
    );
  }

  const passos = [
    { feito: true, ic: "✓", t: "Criar sua conta", s: "Pronto! Bem-vinda ao Doonly", go: () => {} },
    { feito: estado.design, ic: "🎨", t: "Deixar o cardápio com a sua cara", s: "Seu logo e suas cores. Sem logo? Tudo bem, usamos sua foto de perfil.", go: () => navigate("/cardapio-design") },
    { feito: estado.produto, ic: "🧁", t: "Cadastrar seu primeiro produto", s: "Com foto e preço, do jeito que o cliente vai ver", go: () => navigate("/produtos", { state: { abrirCadastro: true } }) },
    { feito: estado.compartilhou, ic: "📲", t: "Compartilhar o link do cardápio", s: "No WhatsApp, no Instagram e na bio", go: compartilhar },
  ];
  const feitos = passos.filter(p => p.feito).length;
  const atual = passos.findIndex(p => !p.feito);

  return (
    <div className="pp">
      <div className="pp-top">
        <div><p className="pp-k">PRIMEIROS PASSOS</p><b className="pp-t">Deixe sua confeitaria pronta pra vender</b></div>
        <span className="pp-cnt">{feitos} de 4</span>
      </div>
      <div className="pp-bar"><i style={{ width: `${(feitos / 4) * 100}%` }} /></div>
      {passos.map((p, i) => i === atual ? (
        <button type="button" key={p.t} className="pp-ps pp-ps--at" onClick={p.go}>
          <span className="pp-ic">{p.ic}</span>
          <span className="pp-tx"><b>{p.t}</b><small>{p.s}</small></span>
          <span className="pp-go">Fazer agora ›</span>
        </button>
      ) : (
        <button type="button" key={p.t} className={`pp-ps${p.feito ? " pp-ps--ok" : ""}`} onClick={p.feito ? undefined : p.go} disabled={p.feito}>
          <span className="pp-ic">{p.feito ? "✓" : p.ic}</span>
          <span className="pp-tx"><b>{p.t}</b></span>
        </button>
      ))}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .pp { background: #fff; border: 1px solid #F0EBED; border-radius: 18px; padding: 16px; box-shadow: 0 10px 26px rgba(44,18,25,.10); font-family: var(--font-base); color: #2C1219; }
  .pp-top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
  .pp-k { margin: 0; font-size: 10.5px; font-weight: 900; letter-spacing: .12em; color: #E85A8C; }
  .pp-t { display: block; font-size: 15.5px; font-weight: 800; margin-top: 3px; line-height: 1.25; }
  .pp-cnt { font-size: 12px; font-weight: 800; color: #C33A6E; background: #FFF1F6; padding: 4px 9px; border-radius: 999px; white-space: nowrap; }
  .pp-bar { height: 7px; border-radius: 99px; background: #F5F0F2; margin: 12px 0 8px; overflow: hidden; }
  .pp-bar i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #F472B6, #E85A8C); transition: width .5s ease; }
  .pp-ps { display: flex; align-items: center; gap: 11px; width: 100%; padding: 9px 4px; border: none; border-top: 1px solid #F7F2F4; background: none; font-family: inherit; text-align: left; color: inherit; cursor: pointer; }
  .pp-ps:first-of-type { border-top: none; }
  .pp-ps:disabled { cursor: default; }
  .pp-ic { width: 32px; height: 32px; border-radius: 10px; background: #F5F0F2; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; color: #B5AAB0; }
  .pp-tx { flex: 1; min-width: 0; }
  .pp-tx b { display: block; font-size: 13.5px; font-weight: 600; color: #9A8E94; }
  .pp-tx small { display: block; font-size: 12px; color: #9A8E94; margin-top: 2px; line-height: 1.35; }
  .pp-ps--ok .pp-ic { background: #DCFCE7; color: #15803D; font-weight: 900; }
  .pp-ps--ok .pp-tx b { text-decoration: line-through; text-decoration-color: #D6CBD0; }
  .pp-ps--at { background: #FFF6F9; border: 1.5px solid #F7C6D9 !important; border-radius: 14px; padding: 11px 10px; margin: 4px 0; }
  .pp-ps--at + .pp-ps { border-top: none; }
  .pp-ps--at .pp-ic { background: #E85A8C; color: #fff; }
  .pp-ps--at .pp-tx b { color: #2C1219; font-weight: 800; }
  .pp-go { font-size: 12px; font-weight: 800; color: #fff; background: #E85A8C; padding: 7px 10px; border-radius: 9px; white-space: nowrap; }
  .pp--fim { text-align: center; background: linear-gradient(180deg, #FFF1F6, #fff 70%); }
  .pp-conf { font-size: 40px; line-height: 1; }
  .pp-ft { display: block; font-size: 17px; font-weight: 900; margin-top: 6px; }
  .pp-fs { font-size: 13px; color: #6B5D64; margin: 6px 6px 14px; line-height: 1.45; }
  .pp-fbt { display: block; background: #E85A8C; color: #fff; font-weight: 800; font-size: 14px; border-radius: 12px; padding: 12px; text-decoration: none; }
  .pp-ffx { display: block; width: 100%; margin-top: 6px; padding: 8px; border: none; background: none; font-family: inherit; font-size: 12.5px; color: #9A8E94; font-weight: 600; cursor: pointer; }
`;

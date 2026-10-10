import { useEffect, useState } from "react";
import {
  getInstallPrompt, onInstallChange, promptInstall, isStandalone, wasInstalledNow,
} from "@/lib/installPrompt";

/**
 * Convite pra instalar o Doonly (PWA). Fica em Configurações. O visual (ia-*) está em pages/configuracoes.css.
 * - Some se o app já está instalado / aberto como app.
 * - Android com prompt disponível: botão "Instalar app".
 * - iPhone: passo a passo (a Apple não permite botão).
 * - iPhone dentro do Instagram/Facebook: pede pra abrir no Safari.
 * - Outros (sem prompt): instrução pelo menu do navegador.
 */

type Modo = "android" | "ios" | "inapp" | "menu" | "pc";

/** Computador: sem toque e sem "Mobi/Android" no navegador */
function ehComputador(): boolean {
  const ua = navigator.userAgent || "";
  if (/Android|Mobi|iPad|iPhone|iPod/i.test(ua)) return false;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return false;
  return true;
}

function detectarModo(temPrompt: boolean): Modo {
  const ua = navigator.userAgent || "";
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|Line\//i.test(ua);
  if (ios && inApp) return "inapp";
  if (ios) return "ios";
  if (temPrompt) return "android";
  if (ehComputador()) return "pc";
  return "menu";
}

const IconeCompartilhar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);
const IconeAdicionar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2C2C2A" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="4" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

export default function InstalarAppCard() {
  const [instalado, setInstalado] = useState(() => isStandalone() || wasInstalledNow());
  const [temPrompt, setTemPrompt] = useState(() => !!getInstallPrompt());
  const [copiado, setCopiado] = useState(false);

  useEffect(() => onInstallChange(() => {
    setTemPrompt(!!getInstallPrompt());
    if (wasInstalledNow()) setInstalado(true);
  }), []);

  if (instalado) return null;

  const modo = detectarModo(temPrompt);
  const pc = ehComputador();

  const instalar = async () => {
    const aceitou = await promptInstall();
    if (aceitou) setInstalado(true);
  };

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch { /* sem permissão de clipboard: ignora */ }
  };

  return (
    <div className="ia-card">
      <div className="ia-top">
        <img src="/Sistema/icon-192.png" alt="" />
        <div>
          <p className="ia-t">{pc ? "Instale o Doonly no computador" : "Instale o Doonly no celular"}</p>
          <p className="ia-d">{pc
            ? "Abra o app direto da área de trabalho, numa janela só dele."
            : "Acesse com um toque direto da tela inicial e receba as novidades na hora."}</p>
        </div>
      </div>

      {modo === "android" && (
        <button className="ia-btn" onClick={instalar}>Instalar app</button>
      )}

      {modo === "ios" && (
        <ol className="ia-steps">
          <li><i>1</i><span>Toque em <b>Compartilhar</b> <IconeCompartilhar /> na barra do navegador</span></li>
          <li><i>2</i><span>Escolha <b>Adicionar à Tela de Início</b> <IconeAdicionar /></span></li>
          <li><i>3</i><span>Toque em <b>Adicionar</b></span></li>
        </ol>
      )}

      {modo === "inapp" && (
        <>
          <p className="ia-warn">
            Pra instalar no iPhone, abra o Doonly no <b>Safari</b>. Aberto por dentro do Instagram ou do WhatsApp, a Apple não deixa instalar.
          </p>
          <button className="ia-btn ia-btn--ghost" onClick={copiarLink}>
            {copiado ? "Link copiado!" : "Copiar link pra colar no Safari"}
          </button>
        </>
      )}

      {modo === "pc" && (
        <p className="ia-warn">
          No Chrome ou no Edge, clique no ícone de instalar na barra de endereço (à direita) e escolha <b>Instalar</b>.
        </p>
      )}

      {modo === "menu" && (
        <p className="ia-warn">
          Toque no menu <b>⋮</b> do navegador e escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.
        </p>
      )}

    </div>
  );
}

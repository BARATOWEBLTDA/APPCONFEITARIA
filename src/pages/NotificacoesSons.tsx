import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { DeviceMobile, SpeakerHigh, CashRegister } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { precisaInstalarNoIphone, ehIphone } from "@/lib/notifications";
import {
  sonsHabilitados, setSonsHabilitados,
  somPedidoHabilitado, setSomPedidoHabilitado,
  tocarSom,
} from "@/hooks/useSom";

/**
 * Configurações → Ações rápidas → Notificações e sons.
 * Tudo aqui vale só para o aparelho atual:
 *  - Push: inscrição do navegador salva em push_subscriptions
 *  - Sons: preferências em localStorage (useSom)
 */
export default function NotificacoesSons() {
  const navigate = useNavigate();
  const { isSupported, isSubscribed, permission, loading, error, subscribe, unsubscribe } = usePushSubscription();

  const [somGeral, setSomGeral] = useState(sonsHabilitados());
  const [somVenda, setSomVenda] = useState(somPedidoHabilitado());

  const toggleSomGeral = () => {
    const novo = !somGeral;
    setSomGeral(novo);
    setSonsHabilitados(novo);
    if (novo) setTimeout(() => tocarSom("sucesso"), 100); // prévia
  };

  const toggleSomVenda = () => {
    const novo = !somVenda;
    setSomVenda(novo);
    setSomPedidoHabilitado(novo);
    if (novo) setTimeout(() => tocarSom("pedido"), 100); // prévia
  };

  // ── Linha de push: 3 estados (sem suporte / bloqueado / normal) ──
  let pushDesc: ReactNode;
  let pushDescClass = "ns-desc";
  let pushToggle: ReactNode = null;

  const instalarIphone = precisaInstalarNoIphone();
  if (instalarIphone) {
    // iPhone no Safari: só funciona com o app instalado (antes dizia "use o Chrome", que não serve no iPhone)
    pushDesc = (
      <>
        No iPhone, as notificações só funcionam com o Doonly <b>instalado na tela de início</b>:
        <ol className="ns-passos">
          <li>No Safari, toque em <b>Compartilhar</b> (o quadrado com a seta pra cima)</li>
          <li>Toque em <b>"Adicionar à Tela de Início"</b></li>
          <li>Abra o Doonly pelo ícone novo e ative aqui</li>
        </ol>
      </>
    );
    pushDescClass = "ns-desc ns-desc--warn";
  } else if (!isSupported) {
    pushDesc = ehIphone()
      ? "Este iPhone não recebe notificações. Atualize pro iOS 16.4 ou mais novo."
      : "Este navegador não recebe notificações. Use o Chrome ou instale o app.";
    pushDescClass = "ns-desc ns-desc--warn";
  } else if (permission === "denied") {
    pushDesc = ehIphone()
      ? "Notificações desligadas. Ligue em Ajustes → Notificações → Doonly."
      : "Notificações bloqueadas. Libere nas configurações do navegador.";
    pushDescClass = "ns-desc ns-desc--warn";
  } else {
    pushDesc = loading
      ? (isSubscribed ? "Desativando..." : "Ativando...")
      : (isSubscribed ? "Ativadas neste aparelho" : "Desativadas neste aparelho");
    if (isSubscribed && !loading) pushDescClass = "ns-desc ns-desc--on";
    pushToggle = (
      <label className="ns-toggle">
        <input
          type="checkbox"
          checked={isSubscribed}
          disabled={loading}
          onChange={() => (isSubscribed ? unsubscribe() : subscribe())}
          aria-label="Notificações no celular"
        />
        <span className="ns-toggle-s" />
      </label>
    );
  }

  return (
    <>
      <AppPageHeader
        title="Notificações e sons"
        subtitle="Preferências deste aparelho"
        onBack={() => navigate("/configuracoes")}
      />

      <div className="ns-root">
        <p className="ns-sec">Notificações</p>
        <div className="ns-card">
          <div className="ns-row">
            <span className="ns-ico"><DeviceMobile size={20} /></span>
            <div className="ns-txt">
              <div className="ns-name">Notificações no celular</div>
              <div className={pushDescClass}>{pushDesc}</div>
              {error && <div className="ns-desc ns-desc--warn">{error}</div>}
            </div>
            {pushToggle}
          </div>
          <p className="ns-note">
            Vale só para este aparelho. Se você usa o Doonly em outro celular ou no computador, ative lá também.
            No iPhone, o app precisa estar instalado na tela inicial.
          </p>
        </div>

        <p className="ns-sec">Sons</p>
        <div className="ns-card">
          <div className="ns-row">
            <span className="ns-ico"><SpeakerHigh size={20} /></span>
            <div className="ns-txt">
              <div className="ns-name">Sons do app</div>
              <div className="ns-desc">Efeitos sonoros enquanto você usa o app</div>
            </div>
            <label className="ns-toggle">
              <input type="checkbox" checked={somGeral} onChange={toggleSomGeral} aria-label="Sons do app" />
              <span className="ns-toggle-s" />
            </label>
          </div>
          <div className={`ns-row${somGeral ? "" : " ns-row--off"}`}>
            <span className="ns-ico"><CashRegister size={20} /></span>
            <div className="ns-txt">
              <div className="ns-name">Som ao registrar venda</div>
              <div className="ns-desc">
                {somGeral ? "Toca quando você finaliza uma venda" : "Ligue \"Sons do app\" primeiro"}
              </div>
            </div>
            <label className="ns-toggle">
              <input
                type="checkbox"
                checked={somVenda && somGeral}
                disabled={!somGeral}
                onChange={toggleSomVenda}
                aria-label="Som ao registrar venda"
              />
              <span className="ns-toggle-s" />
            </label>
          </div>
        </div>
      </div>

      <style>{`
        .ns-root { font-family: var(--font-base); padding: 16px 4px 100px; max-width: 640px; margin: 0 auto; }
        .ns-sec {
          font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
          color: #888780; margin: 6px 6px 8px;
        }
        .ns-card {
          background: #fff; border: 1px solid #F0EBED; border-radius: 14px;
          overflow: hidden; margin-bottom: 14px;
        }
        .ns-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
        .ns-row + .ns-row { border-top: 1px solid #F5F0F2; }
        .ns-ico {
          width: 38px; height: 38px; flex-shrink: 0; border-radius: 10px;
          background: #F0EBED; color: #5F5E5A;
          display: flex; align-items: center; justify-content: center;
        }
        .ns-txt { flex: 1; min-width: 0; }
        .ns-name { font-size: 14px; font-weight: 700; color: #2C2C2A; }
        .ns-desc { font-size: 12px; color: #888780; margin-top: 2px; line-height: 1.4; }
        .ns-desc--on { color: #16a34a; }
        .ns-desc--warn { color: #DC2626; }
        .ns-row--off .ns-name, .ns-row--off .ns-ico { opacity: 0.45; }
        .ns-note {
          margin: 0 16px 14px; padding: 10px 12px; border-radius: 10px;
          background: #FAF7F8; font-size: 13px; color: #6E5A66; line-height: 1.45;
        }
        .ns-toggle { position: relative; display: inline-block; width: 46px; height: 26px; flex-shrink: 0; }
        .ns-toggle input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; z-index: 1; }
        .ns-toggle input:disabled { cursor: not-allowed; }
        .ns-toggle-s { position: absolute; inset: 0; background: #E5DDE0; border-radius: 26px; transition: 0.25s; }
        .ns-toggle-s::before {
          content: ""; position: absolute; width: 20px; height: 20px; left: 3px; top: 3px;
          background: #fff; border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.15); transition: 0.25s;
        }
        .ns-toggle input:checked + .ns-toggle-s { background: #E85A8C; }
        .ns-toggle input:checked + .ns-toggle-s::before { transform: translateX(20px); }
        .ns-toggle input:disabled + .ns-toggle-s { opacity: 0.4; }
        .ns-toggle input:focus-visible + .ns-toggle-s { outline: 2px solid #E85A8C; outline-offset: 2px; }
      
        .ns-passos { margin: 8px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
        .ns-passos li { line-height: 1.4; }
`}</style>
    </>
  );
}

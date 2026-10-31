import { COMO_NOTIFICACOES, TOUR_NOTIFICACOES } from "@/lib/comoTelas";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { DeviceMobile, SpeakerHigh, CashRegister, PaperPlaneTilt, BellRinging, Check, Play } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { Botao, avisar } from "@/components/base";
import AppPageHeader from "@/components/AppPageHeader";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { precisaInstalarNoIphone, ehIphone } from "@/lib/notifications";
import {
  sonsHabilitados, setSonsHabilitados,
  somPedidoHabilitado, setSomPedidoHabilitado,
  tocarSom,
  TOQUES, type ToqueId, alertaPedidoHabilitado, setAlertaPedidoHabilitado, toqueEscolhido, setToqueEscolhido, tocarToque, volumeApp, setVolumeApp,
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

  // (23/10) manda um aviso de teste pros aparelhos desta conta e diz o que aconteceu
  const [testando, setTestando] = useState(false);
  const testar = async () => {
    setTestando(true);
    try {
      const { data, error } = await supabase.functions.invoke("push-pessoal", { body: { teste: true } });
      if (error) throw error;
      // (31/10 · 5.82) sem a contagem: aparelho antigo (outro navegador, app reinstalado) também entrava na conta
      if (data?.sent > 0) avisar("Aviso de teste enviado. Ele chega em alguns segundos.", { tipo: "ok", duracao: 6000 });
      else avisar(data?.motivo || "Nenhum aparelho recebeu o aviso. Ative as notificações neste aparelho e tente de novo.", { tipo: "info", duracao: 7000 });
    } catch {
      avisar("Não deu para enviar o aviso de teste. Confira a internet e tente de novo.", { tipo: "erro" });
    } finally { setTestando(false); }
  };

  // (30/10 · 5.45) som de pedido novo: 4 toques, volume e testar (como no Dora)
  const [alerta, setAlerta] = useState(alertaPedidoHabilitado());
  const [toque, setToque] = useState<ToqueId>(toqueEscolhido());
  const [volume, setVolume] = useState(volumeApp());
  const escolherToque = (id: ToqueId) => { setToque(id); setToqueEscolhido(id); tocarToque(id); };
  const mudarVolume = (v: number) => { setVolume(v); setVolumeApp(v); };
  const trocarAlerta = () => { const novo = !alerta; setAlerta(novo); setAlertaPedidoHabilitado(novo); if (novo) tocarToque(toque); };

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
          <li>No Safari, toque em <b>Compartilhar</b> (o quadrado com a seta para cima)</li>
          <li>Toque em <b>"Adicionar à Tela de Início"</b></li>
          <li>Abra o Doonly pelo ícone novo e ative aqui</li>
        </ol>
      </>
    );
    pushDescClass = "ns-desc ns-desc--warn";
  } else if (!isSupported) {
    pushDesc = ehIphone()
      ? "Este iPhone não recebe notificações. Atualize para o iOS 16.4 ou mais novo."
      : "Este navegador não recebe notificações. Use o Chrome ou instale o app.";
    pushDescClass = "ns-desc ns-desc--warn";
  } else if (permission === "denied") {
    // (22/10) B7: no celular (Android) não existe "cadeado da barra de endereço": passos certos e em laranja (atenção, não erro)
    const celular = !ehIphone() && typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
    pushDesc = ehIphone()
      ? "Notificações desligadas. Ligue em Ajustes → Notificações → Doonly."
      : celular ? (
        <>
          Bloqueadas neste celular.
          <ol className="ns-passos">
            <li>1. Abra as <b>Configurações</b> do celular</li>
            <li>2. <b>Apps</b> › <b>Doonly</b> (ou <b>Chrome</b>)</li>
            <li>3. <b>Notificações</b> › ligue a chave</li>
          </ol>
        </>
      ) : (
        <>
          Notificações bloqueadas no navegador.
          <br />Para liberar: clique no cadeado da barra de endereço, depois em Notificações e escolha Permitir.
        </>
      );
    pushDescClass = celular ? "ns-desc ns-desc--atencao" : "ns-desc ns-desc--warn";
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
          aria-label="Notificações"
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
        infoComo={COMO_NOTIFICACOES} infoTour={TOUR_NOTIFICACOES}
      />

      <div className="ns-root">
        <p className="ns-sec">Com o app aberto</p>
        <div className="ns-card">
          <div className="ns-row">
            <span className="ns-ico"><BellRinging size={20} /></span>
            <div className="ns-txt">
              <div className="ns-name">Som de pedido novo</div>
              <div className="ns-desc">Toca até aceitar ou recusar</div>
            </div>
            <label className="ns-toggle">
              <input type="checkbox" checked={alerta} onChange={trocarAlerta} aria-label="Som de pedido novo" />
              <span className="ns-toggle-s" />
            </label>
          </div>
          <div className={`ns-toques-w${alerta ? "" : " ns-off"}`}>
            <p className="ns-toques-t">Escolha o toque</p>
            <div className="ns-toques" role="radiogroup" aria-label="Toque de pedido novo">
              {TOQUES.map(t => (
                <button key={t.id} type="button" role="radio" aria-checked={toque === t.id} className={`ns-toque${toque === t.id ? " on" : ""}`} disabled={!alerta} onClick={() => escolherToque(t.id)}>
                  <i className="ns-chk" aria-hidden="true">{toque === t.id && <Check size={14} weight="bold" />}</i>
                  <span><b>{t.nome}</b><small>Repete a cada {t.cada}s</small></span>
                </button>
              ))}
            </div>
            <div className="ns-vol">
              <div className="ns-vol-l"><span>Volume</span><b>{volume}%</b></div>
              <input type="range" min={0} max={100} step={5} value={volume} disabled={!alerta} aria-label="Volume dos sons"
                onChange={e => mudarVolume(Number(e.target.value))} style={{ ["--v" as any]: `${volume}%` }} />
              <div className="ns-vol-p"><small>Sem som</small><Botao variante="secundario" tamanho="m" icone={<Play size={16} weight="fill" />} disabled={!alerta || volume === 0} onClick={() => tocarToque(toque)}>Testar som</Botao></div>
            </div>
          </div>
        </div>

        <p className="ns-sec">Com o app fechado</p>
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
          {isSubscribed && (
            <div className="ns-row">
              <span className="ns-ico"><PaperPlaneTilt size={20} /></span>
              <div className="ns-txt">
                <div className="ns-name">Testar os avisos</div>
                <div className="ns-desc">Manda um aviso de teste agora</div>
              </div>
              <Botao variante="secundario" tamanho="m" carregando={testando} onClick={testar}>Testar</Botao>
            </div>
          )}
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
              <div className="ns-desc">Efeitos ao usar o app</div>
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
          font-size: 13px; font-weight: 500;
          color: #888780; margin: 6px 6px 8px;
        }
        .ns-card {
          background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: var(--ui-raio-cartao);
          overflow: hidden; margin-bottom: 14px;
        }
        .ns-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
        .ns-row + .ns-row { border-top: 1px solid var(--ui-linha); }
        .ns-ico {
          width: 38px; height: 38px; flex-shrink: 0; border-radius: var(--ui-raio-p);
          background: #F0EBED; color: #5F5E5A;
          display: flex; align-items: center; justify-content: center;
        }
        .ns-txt { flex: 1; min-width: 0; }
        .ns-name { font-size: 14px; font-weight: 600; color: #2C2C2A; }
        .ns-desc { font-size: 12px; color: #888780; margin-top: 2px; line-height: 1.4; }
        .ns-desc--on { color: #16a34a; }
        .ns-desc--warn { color: var(--ui-vermelho); }
        .ns-desc--atencao { color: #B45309; font-weight: 600; }
        .ns-passos { list-style: none; margin: 10px 0 0; padding: 10px 12px; border: 1px solid #F5C99B; border-radius: 12px; background: #FFF8EF; font-weight: 400; font-size: 13.5px; line-height: 1.6; color: var(--ui-texto); }
        .ns-passos li { white-space: nowrap; }
        /* (27/10) a caixa dos passos usa a largura do cartão inteiro (passava da borda no celular pequeno) */
        .ns-txt .ns-passos { margin-left: -52px; font-size: 13px; }
        .ns-row:has(.ns-passos) { align-items: flex-start; }
        @media (max-width: 340px) { .ns-passos li { white-space: normal; } }
        .ns-row--off .ns-name, .ns-row--off .ns-ico { opacity: 0.45; }
        /* (30/10 · 5.45) toques de pedido novo */
        .ns-toques-w { padding: 0 16px 16px; border-top: 1px solid var(--ui-linha); }
        .ns-off { opacity: .5; }
        .ns-toques-t { margin: 14px 0 8px; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
        .ns-toques { display: grid; grid-template-columns: 1fr; gap: 8px; }
        @media (min-width: 560px) { .ns-toques { grid-template-columns: 1fr 1fr; } }
        .ns-toque { display: flex; align-items: center; gap: 12px; min-width: 0; min-height: 56px; margin: 0; padding: 8px 14px; border: 1.5px solid var(--ui-borda); border-radius: var(--ui-raio); background: var(--ui-branco); font-family: inherit; text-align: left; color: var(--ui-texto); cursor: pointer; }
        .ns-toque:disabled { cursor: default; }
        .ns-toque.on { border-color: var(--ui-escolha); }
        .ns-toque > span { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .ns-toque b { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ns-toque small { font-size: 12.5px; color: var(--ui-texto-2); white-space: nowrap; }
        .ns-chk { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; box-sizing: border-box; border: 2px solid #D6CBD0; border-radius: 6px; background: var(--ui-branco); color: #fff; }
        .ns-toque.on .ns-chk { border-color: var(--ui-rosa); background: var(--ui-rosa); }
        .ns-vol { margin-top: 12px; padding: 12px 14px; border-radius: var(--ui-raio); background: #F7F4F5; }
        .ns-vol-l { display: flex; align-items: baseline; justify-content: space-between; font-size: 13.5px; color: var(--ui-texto); }
        .ns-vol-l b { font-size: 16px; font-weight: 600; }
        .ns-vol input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; margin: 12px 0 6px; border-radius: 99px; background: linear-gradient(to right, var(--ui-rosa) var(--v), #E5DDE0 var(--v)); outline: none; cursor: pointer; }
        .ns-vol input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 2px solid var(--ui-rosa); box-shadow: 0 1px 4px rgba(0,0,0,.15); }
        .ns-vol input[type=range]::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #fff; border: 2px solid var(--ui-rosa); }
        .ns-vol input[type=range]:disabled { cursor: default; }
        .ns-vol-p { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .ns-vol-p small { font-size: 12px; color: var(--ui-texto-3); }
        .ns-vol-p .ui-bt { width: auto; }
        .ns-note {
          margin: 0 16px 14px; padding: 10px 12px; border-radius: var(--ui-raio-p);
          background: #FAF7F8; font-size: 13px; color: #6E5A66; line-height: 1.45;
        }
        .ns-toggle { position: relative; display: inline-block; width: 46px; height: 26px; flex-shrink: 0; }
        .ns-toggle input { position: absolute; inset: -9px -4px; width: calc(100% + 8px); height: calc(100% + 18px); margin: 0; opacity: 0; cursor: pointer; z-index: 1; }
        .ns-toggle input:disabled { cursor: not-allowed; }
        .ns-toggle-s { position: absolute; inset: 0; background: #E5DDE0; border-radius: 26px; transition: 0.25s; }
        .ns-toggle-s::before {
          content: ""; position: absolute; width: 20px; height: 20px; left: 3px; top: 3px;
          background: var(--ui-branco); border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.15); transition: 0.25s;
        }
        .ns-toggle input:checked + .ns-toggle-s { background: var(--ui-rosa); }
        .ns-toggle input:checked + .ns-toggle-s::before { transform: translateX(20px); }
        .ns-toggle input:disabled + .ns-toggle-s { opacity: 0.4; }
        .ns-toggle input:focus-visible + .ns-toggle-s { outline: 2px solid var(--ui-rosa); outline-offset: 2px; }
      
        .ns-passos { margin: 8px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
        .ns-passos li { line-height: 1.4; }
`}</style>
    </>
  );
}

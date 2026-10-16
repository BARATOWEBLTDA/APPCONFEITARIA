import { useEffect, useState } from "react";
import { Sparkle } from "@phosphor-icons/react";
import Destaque, { jaViuDestaque, marcarDestaque } from "@/components/Destaque";
import { useProfile } from "@/hooks/useProfile";

/**
 * (16/10) Primeira vez numa tela importante: um cartão pequeno pergunta "Primeira vez em Custos?" com
 * "Mostrar" e "Agora não" (ideia vista no Dora: o tour não abre sozinho). "Mostrar" passa pelos pontos
 * da tela com o mesmo destaque do "Começar". Aparece uma vez só por conta, neste aparelho.
 * Um ponto que não está na tela (lista vazia, por exemplo) é pulado.
 */
export type PassoTour = { alvo: string; titulo: string; texto: string };

export default function TourPrimeiraVez({ chave, tela, passos, atraso = 1200 }: { chave: string; tela: string; passos: PassoTour[]; atraso?: number }) {
  const { profile } = useProfile();
  const k = profile?.id ? `tour_${chave}_${profile.id}` : "";
  const [fase, setFase] = useState<"nada" | "convite" | "tour">("nada");
  const [lista, setLista] = useState<PassoTour[]>([]);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!k || jaViuDestaque(k)) return;
    // espera a tela carregar (e outra janela fechar) antes de convidar
    let n = 0;
    const t = { id: 0 };
    const ver = () => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]') && n++ < 30) { t.id = window.setTimeout(ver, 800); return; }
      if (passos.some(p => document.querySelector(p.alvo))) setFase("convite");
    };
    t.id = window.setTimeout(ver, atraso);
    return () => window.clearTimeout(t.id);
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps

  if (fase === "nada") return null;
  const fechar = () => { marcarDestaque(k); setFase("nada"); };

  if (fase === "convite") return (
    <div className="tpv" role="region" aria-label={`Primeira vez em ${tela}`}>
      <span className="tpv-ic" aria-hidden="true"><Sparkle size={20} weight="fill" /></span>
      <div className="tpv-tx">
        <b>Primeira vez em {tela}?</b>
        <p>Veja o que tem aqui em {passos.length} {passos.length === 1 ? "passo" : "passos"}.</p>
        <div className="tpv-bts">
          <button type="button" className="tpv-sim" onClick={() => {
            const ok = passos.filter(p => document.querySelector(p.alvo));
            marcarDestaque(k);
            if (!ok.length) { setFase("nada"); return; }
            setLista(ok); setI(0); setFase("tour");
          }}>Mostrar</button>
          <button type="button" className="tpv-nao" onClick={fechar}>Agora não</button>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );

  const p = lista[i];
  if (!p) return null;
  const ultimo = i === lista.length - 1;
  return (
    <Destaque key={i} alvo={p.alvo} raio={14} passo={`${i + 1} de ${lista.length}`} titulo={p.titulo} texto={p.texto}
      acao={ultimo ? "Entendi" : "Próximo"} naoTexto="Sair"
      aoAcao={() => { if (ultimo) setFase("nada"); else setI(x => x + 1); }} aoFechar={() => setFase("nada")} />
  );
}

const CSS = `
  .tpv { position: fixed; left: 16px; right: 16px; bottom: calc(56px + env(safe-area-inset-bottom, 0px) + 12px); z-index: 900; display: flex; gap: 12px; max-width: 420px; margin: 0 auto; padding: 14px; border: 1px solid var(--ui-borda); border-radius: 16px; background: var(--ui-branco); box-shadow: 0 12px 32px rgba(44, 18, 25, .18); font-family: var(--font-base); text-align: left; animation: tpvSobe .3s ease-out both; }
  @media (min-width: 901px) { .tpv { left: auto; right: 24px; bottom: 24px; width: 380px; } }
  @keyframes tpvSobe { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  .tpv-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 10px; background: var(--primary-light, #FCE0E9); color: var(--ui-rosa-escuro); }
  .tpv-tx { flex: 1; min-width: 0; }
  .tpv-tx b { display: block; font-size: 15px; font-weight: 700; color: var(--ui-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tpv-tx p { margin: 2px 0 0; font-size: 13px; line-height: 1.4; color: var(--ui-texto-2); }
  .tpv-bts { display: flex; align-items: center; gap: 4px; margin-top: 10px; }
  .tpv-sim, .tpv-nao { min-height: 40px; padding: 0 14px; border: 0; border-radius: 8px; font-family: inherit; font-size: 14px; font-weight: 700; white-space: nowrap; cursor: pointer; }
  .tpv-sim { background: var(--chocolate); color: var(--ui-branco); }
  .tpv-nao { background: none; color: var(--ui-texto-3); }
  @media (prefers-reduced-motion: reduce) { .tpv { animation: none; } }
`;

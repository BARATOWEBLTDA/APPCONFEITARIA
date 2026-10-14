import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Buildings, CalendarCheck, ClipboardText, Coins, CreditCard, X } from "@phosphor-icons/react";
import { useProfile } from "@/hooks/useProfile";
import { useLojaPronta } from "@/lib/primeirosPassos";
import { lerAvisosCadastro, notificarAvisosCadastro, type AvisoCadastro } from "@/lib/avisosCadastro";

/**
 * (13/10) Depois dos primeiros passos: o que ainda falta cadastrar pro lucro, o caixa e as contas ficarem certos.
 * Aparece na Início (até 3 por vez) e cada item também vira uma notificação. O X esconde o item por 7 dias.
 */
const ICONE = { custos: Buildings, maquininha: CreditCard, ficha: ClipboardText, caixa: Coins, conta: CalendarCheck };
const SETE_DIAS = 7 * 86400000;

export default function FaltaPouco() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const uid = profile?.id as string | undefined;
  const pronta = useLojaPronta(uid);
  const [avisos, setAvisos] = useState<AvisoCadastro[]>([]);
  const kOff = (chave: string) => `doonly_aviso_off_${uid}_${chave}`;
  const escondido = (chave: string) => { try { return Date.now() - Number(localStorage.getItem(kOff(chave)) || 0) < SETE_DIAS; } catch { return false; } };

  useEffect(() => {
    if (!uid || pronta !== true) return;
    let vivo = true;
    lerAvisosCadastro(uid).then(l => { if (!vivo) return; setAvisos(l); notificarAvisosCadastro(l); }).catch(() => {});
    return () => { vivo = false; };
  }, [uid, pronta]);

  const lista = avisos.filter(a => !escondido(a.chave)).slice(0, 3);
  if (!lista.length) return null;
  const esconder = (chave: string) => { try { localStorage.setItem(kOff(chave), String(Date.now())); } catch {} setAvisos(l => [...l]); };

  // (14/10) redesenhado: título menor, contagem do que falta e textos que quebram a linha certinho (sem cortar com "…")
  const n = lista.length;
  return (
    <section className="fp" aria-label="Complete seu app">
      <div className="fp-cab">
        <b className="fp-t">Complete seu app</b>
        <span className="fp-n">{n === 1 ? "Falta 1" : `Faltam ${n}`}</span>
      </div>
      <p className="fp-s">Assim o lucro e o caixa ficam certos.</p>
      <ul className="fp-lista">
        {lista.map(a => {
          const Ic = ICONE[a.icone];
          return (
            <li key={a.chave} className="fp-it">
              <button type="button" className="fp-bt" onClick={() => navigate(a.link)}>
                <span className="fp-ic" aria-hidden="true"><Ic size={20} /></span>
                <span className="fp-tx"><b>{a.titulo}</b><small>{a.texto}</small><span className="fp-ver" aria-hidden="true">Ver</span></span>
              </button>
              <button type="button" className="fp-x" aria-label={`Agora não: ${a.titulo}`} title="Agora não" onClick={() => esconder(a.chave)}><X size={14} weight="bold" /></button>
            </li>
          );
        })}
      </ul>
      <style>{CSS}</style>
    </section>
  );
}

const CSS = `
  .fp { padding: 16px 16px 8px; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); font-family: var(--font-base); text-align: left; }
  .fp-cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .fp-t { font-size: 16px; font-weight: 700; line-height: 1.3; color: var(--ui-texto); }
  .fp-n { flex: none; padding: 3px 8px; border-radius: 6px; background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); font-size: 12px; font-weight: 700; }
  .fp-s { margin: 4px 0 8px; font-size: 13px; line-height: 1.45; color: var(--ui-texto-2); text-wrap: pretty; }
  .fp-lista { margin: 0; padding: 0; list-style: none; }
  .fp-it { position: relative; }
  .fp-it + .fp-it { border-top: 1px solid var(--ui-linha); }
  .fp-bt { display: flex; align-items: flex-start; gap: 12px; width: 100%; margin: 0; padding: 12px 36px 12px 0; border: 0; background: none; font-family: inherit; text-align: left; cursor: pointer; color: var(--ui-texto); }
  .fp-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: var(--ui-raio); background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); }
  .fp-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .fp-tx b { font-size: 14.5px; font-weight: 600; line-height: 1.3; text-wrap: pretty; }
  .fp-tx small { font-size: 13px; line-height: 1.4; color: var(--ui-texto-2); text-wrap: pretty; }
  /* (14/10) "Ver" com cara de botão (antes só a linha era clicável, sem dica) */
  .fp-ver { align-self: flex-start; display: inline-flex; align-items: center; height: 32px; margin-top: 8px; padding: 0 18px; border-radius: 8px; background: var(--ui-rosa); color: #fff; font-size: 13.5px; font-weight: 700; box-shadow: 0 2px 0 var(--ui-rosa-escuro); }

  .fp-x { position: absolute; right: -6px; top: 10px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: none; color: var(--ui-texto-3); cursor: pointer; }
  .fp-x::after { content: ""; position: absolute; inset: -6px; }
  @media (hover: hover) { .fp-x:hover { background: var(--ui-cinza); } .fp-bt:hover b { color: var(--ui-rosa-escuro); } }
  /* (14/10) respiro do header no celular */
  @media (max-width: 767px) { .ini-falta { padding-top: 8px; } }
`;

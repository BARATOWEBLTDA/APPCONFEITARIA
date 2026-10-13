import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Buildings, CalendarCheck, CaretRight, ClipboardText, Coins, CreditCard, X } from "@phosphor-icons/react";
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

  return (
    <section className="fp" aria-label="Falta pouco">
      <b className="fp-t">Falta pouco pro app ficar completo</b>
      <p className="fp-s">Com isso, o lucro e o caixa mostram os números de verdade.</p>
      {lista.map(a => {
        const Ic = ICONE[a.icone];
        return (
          <div key={a.chave} className="fp-it">
            <button type="button" className="fp-bt" onClick={() => navigate(a.link)}>
              <span className="fp-ic" aria-hidden="true"><Ic size={20} /></span>
              <span className="fp-tx"><b>{a.titulo}</b><small>{a.texto}</small></span>
              <CaretRight size={16} weight="bold" className="fp-seta" aria-hidden="true" />
            </button>
            <button type="button" className="fp-x" aria-label="Agora não" title="Agora não" onClick={() => esconder(a.chave)}><X size={14} weight="bold" /></button>
          </div>
        );
      })}
      <style>{CSS}</style>
    </section>
  );
}

const CSS = `
  .fp { padding: 16px; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); font-family: var(--font-base); text-align: left; }
  .fp-t { display: block; font-size: 17px; font-weight: 700; color: var(--ui-texto); }
  .fp-s { margin: 2px 0 10px; font-size: 13px; color: var(--ui-texto-2); }
  .fp-it { position: relative; display: flex; align-items: center; }
  .fp-it + .fp-it { box-shadow: 0 -1px 0 var(--ui-linha); }
  .fp-bt { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; min-height: 64px; margin: 0; padding: 8px 40px 8px 4px; border: 0; border-radius: var(--ui-raio); background: none; font-family: inherit; text-align: left; cursor: pointer; color: var(--ui-texto); }
  @media (hover: hover) { .fp-bt:hover { background: var(--ui-linha); } }
  .fp-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--ui-raio); background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); }
  .fp-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .fp-tx b { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fp-tx small { font-size: 13px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fp-seta { flex: none; color: var(--ui-texto-3); }
  .fp-x { position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 0; border-radius: 50%; background: none; color: var(--ui-texto-3); cursor: pointer; }
  .fp-x::after { content: ""; position: absolute; inset: -6px; }
  @media (hover: hover) { .fp-x:hover { background: var(--ui-cinza); } }
`;

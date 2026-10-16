import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Buildings, CalendarCheck, ClipboardText, Coins, CreditCard, X } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useProfile } from "@/hooks/useProfile";
import { useLojaPronta } from "@/lib/primeirosPassos";
import { useAoVoltar } from "@/hooks/useAoVoltar";
import { lerAvisosCadastro, notificarAvisosCadastro, type AvisoCadastro } from "@/lib/avisosCadastro";
import { useAtualizacoes } from "@/components/MinhasAtualizacoes";

/**
 * (15/10) "Pra fazer": um cartão só no Início, no lugar do "Complete seu app" e do "Suas atualizações".
 * O mais urgente em cima: contas atrasadas ou vencendo hoje (vermelho), atenção (amarelo: conta de amanhã,
 * aniversário, faturamento caiu) e o resto (o que falta cadastrar e as boas notícias).
 * Mostra 4; "Ver os outros" abre o resto no próprio cartão. O que falta cadastrar só aparece depois dos
 * primeiros passos e tem o X (esconde por 7 dias). Conta nova (sem nada) não vê o cartão.
 */
type Item = { chave: string; nivel: "urgente" | "atencao" | "normal"; Ic: Icon; t: string; s: string; acao: string; link: string; fechar?: boolean; ordem: number };

const ICONE: Record<AvisoCadastro["icone"], Icon> = { custos: Buildings, maquininha: CreditCard, ficha: ClipboardText, caixa: Coins, conta: CalendarCheck };
const SETE_DIAS = 7 * 86400000;
const PESO = { urgente: 0, atencao: 1, normal: 2 };
const VISIVEIS = 4;

export default function PraFazer() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const uid = profile?.id as string | undefined;
  const pronta = useLojaPronta(uid);
  const { updates } = useAtualizacoes();
  const [avisos, setAvisos] = useState<AvisoCadastro[]>([]);
  const [aberto, setAberto] = useState(false);
  const [, setMexeu] = useState(0);
  const kOff = (chave: string) => `doonly_aviso_off_${uid}_${chave}`;
  const escondido = (chave: string) => { try { return Date.now() - Number(localStorage.getItem(kOff(chave)) || 0) < SETE_DIAS; } catch { return false; } };

  // ao voltar pro app, relê o que falta cadastrar
  const [voltou, setVoltou] = useState(0);
  useAoVoltar(() => setVoltou(v => v + 1));
  useEffect(() => {
    if (!uid || pronta !== true) return;
    let vivo = true;
    lerAvisosCadastro(uid).then(l => { if (!vivo) return; setAvisos(l); notificarAvisosCadastro(l); }).catch(() => {});
    return () => { vivo = false; };
  }, [uid, pronta, voltou]);

  const itens: Item[] = [
    ...avisos.map((a, i): Item => ({
      chave: a.chave, nivel: a.nivel, Ic: ICONE[a.icone], t: a.curto.t, s: a.curto.s, link: a.link, ordem: i,
      acao: a.icone === "conta" ? "Pagar" : "Ver", fechar: a.icone !== "conta",
    })),
    ...updates.map((u): Item => ({
      chave: u.key, nivel: u.key === "faturamento-down" || u.key === "aniversarios" ? "atencao" : "normal",
      Ic: u.Icone, t: u.curto.t, s: u.curto.s, link: u.path, ordem: 100 - u.prioridade, acao: "Ver",
    })),
  ].filter(x => !x.fechar || !escondido(x.chave))
   .sort((a, b) => PESO[a.nivel] - PESO[b.nivel] || a.ordem - b.ordem);

  if (!itens.length) return null;
  const mostrar = aberto ? itens : itens.slice(0, VISIVEIS);
  const resto = itens.length - VISIVEIS;
  const esconder = (chave: string) => { try { localStorage.setItem(kOff(chave), String(Date.now())); } catch {} setMexeu(n => n + 1); };

  return (
    <section className="pf" aria-label="Pra fazer">
      <div className="pf-cab">
        <b className="pf-t">Pra fazer</b>
        <span className="pf-n">{itens.length === 1 ? "1 item" : `${itens.length} itens`}</span>
      </div>
      <p className="pf-s">O mais urgente primeiro.</p>
      <ul className="pf-lista">
        {mostrar.map(x => (
          <li key={x.chave} className={`pf-it pf-it--${x.nivel}`}>
            <button type="button" className="pf-bt" onClick={() => navigate(x.link)}>
              <span className="pf-ic" aria-hidden="true"><x.Ic size={20} weight="bold" /></span>
              <span className="pf-tx"><b>{x.t}</b><small>{x.s}</small></span>
              <span className="pf-acao" aria-hidden="true">{x.acao}</span>
            </button>
            {x.fechar && <button type="button" className="pf-x" aria-label={`Agora não: ${x.t}`} title="Agora não" onClick={() => esconder(x.chave)}><X size={12} weight="bold" /></button>}
          </li>
        ))}
      </ul>
      {resto > 0 && (
        <button type="button" className="pf-ver" onClick={() => setAberto(a => !a)} aria-expanded={aberto}>
          {aberto ? "Ver menos" : resto === 1 ? "Ver o outro" : `Ver os outros ${resto}`}
        </button>
      )}
      <style>{CSS}</style>
    </section>
  );
}

const CSS = `
  .pf { padding: 16px; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); font-family: var(--font-base); text-align: left; }
  .pf-cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .pf-t { font-size: 16px; font-weight: 700; line-height: 1.3; color: var(--ui-texto); }
  .pf-n { flex: none; padding: 3px 8px; border-radius: 6px; background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); font-size: 12px; font-weight: 700; }
  .pf-s { margin: 4px 0 12px; font-size: 13px; line-height: 1.4; color: var(--ui-texto-2); }
  .pf-lista { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .pf-it { position: relative; border-radius: var(--ui-raio); }
  .pf-bt { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 64px; margin: 0; padding: 12px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio); background: var(--ui-branco); font-family: inherit; text-align: left; color: var(--ui-texto); cursor: pointer; }
  .pf-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--ui-raio); background: var(--ui-rosa); color: var(--ui-branco); }
  .pf-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .pf-tx b { font-size: 14.5px; font-weight: 700; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pf-tx small { font-size: 12.5px; line-height: 1.4; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pf-acao { flex: none; padding: 7px 12px; border: 1.5px solid #F3C9DA; border-radius: 8px; background: var(--ui-branco); color: var(--ui-rosa-escuro); font-size: 13px; font-weight: 700; }
  /* urgente: fundo vermelho-claro e botão vermelho cheio */
  .pf-it--urgente .pf-bt { border-color: transparent; background: #FDECEC; }
  .pf-it--urgente .pf-ic { background: var(--ui-branco); color: #B42318; }
  .pf-it--urgente small { color: #9A3A32; }
  .pf-it--urgente .pf-acao { border-color: #D92D20; background: #D92D20; color: var(--ui-branco); box-shadow: 0 2px 0 #9B1C14; }
  /* atenção: fundo amarelo-claro */
  .pf-it--atencao .pf-bt { border-color: transparent; background: #FFF7E0; }
  .pf-it--atencao .pf-ic { background: var(--ui-branco); color: #8A5A00; }
  .pf-it--atencao small { color: #7A5A10; }
  .pf-it--atencao .pf-acao { border-color: #F0C75E; color: #8A5A00; }
  .pf-x { position: absolute; top: -6px; right: -6px; display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 0; border: 1px solid var(--ui-borda); border-radius: 50%; background: var(--ui-branco); color: var(--ui-texto-3); cursor: pointer; }
  .pf-x::after { content: ""; position: absolute; inset: -11px; } /* área de toque de 44px */
  .pf-ver { display: block; width: 100%; min-height: 44px; margin: 4px 0 -6px; border: 0; background: none; font-family: inherit; font-size: 14px; font-weight: 700; color: var(--ui-rosa-escuro); cursor: pointer; }
  @media (hover: hover) { .pf-bt:hover { filter: brightness(.98); } }
`;

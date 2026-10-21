import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Buildings, CalendarCheck, ClipboardText, Coins, CreditCard, ImageSquare, TextAlignLeft, Truck } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useProfile } from "@/hooks/useProfile";
import { useLojaPronta } from "@/lib/primeirosPassos";
import { useAoVoltar } from "@/hooks/useAoVoltar";
import { lerAvisosCadastro, notificarAvisosCadastro, type AvisoCadastro } from "@/lib/avisosCadastro";
import { useAtualizacoes } from "@/components/MinhasAtualizacoes";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { avisar } from "@/components/base";

/**
 * (15/10) "Pra fazer": um cartão só no Início, no lugar do "Complete seu app" e do "Suas atualizações".
 * O mais urgente em cima: contas atrasadas ou vencendo hoje (vermelho), atenção (amarelo: conta de amanhã,
 * aniversário, faturamento caiu) e o resto (o que falta cadastrar e as boas notícias).
 * (16/10) Virou "Seus próximos passos": mostra 3, cada um com "Agora não" (amanhã, 7 dias ou não mostrar mais)
 * e o botão da ação embaixo do texto (antes um X no canto). Conta a pagar não tem "Agora não".
 * O que falta cadastrar só aparece depois dos primeiros passos. Conta nova (sem nada) não vê o cartão.
 * (18/10) Lista compacta (estava com texto demais): ícone, título e uma linha curta; a linha toda abre;
 * o "Agora não" virou um × pequeno no canto (abre as mesmas opções).
 * (21/10) Voltou a se chamar "Pra fazer" (era quase igual a "Primeiros passos"). Cada linha tem um botão curto que
 * já diz a ação (Pagar, Liberar, Definir…) no lugar da seta e do ×; a conta mostra o valor ("Vence hoje · R$ 380,00").
 */
type Item = { chave: string; nivel: "urgente" | "atencao" | "normal"; Ic: Icon; t: string; s: string; acao: string; link: string; estado?: { abrir: string }; fechar?: boolean; ordem: number; aoTocar?: () => void };

/** (21/10) o botão de cada linha diz o que fazer */
const ACAO: Record<AvisoCadastro["icone"], string> = { custos: "Definir", maquininha: "Definir", ficha: "Fazer", caixa: "Informar", conta: "Pagar", entrega: "Definir", descricao: "Escrever", banner: "Colocar" };
const ACAO_NOVIDADE: Record<string, string> = { "aniversarios": "Ver", "produtos-sem-foto": "Pôr foto", "clientes-sumidos": "Chamar" };
const ICONE: Record<AvisoCadastro["icone"], Icon> = { custos: Buildings, maquininha: CreditCard, ficha: ClipboardText, caixa: Coins, conta: CalendarCheck, entrega: Truck, descricao: TextAlignLeft, banner: ImageSquare };
const DIA = 86400000;
const PESO = { urgente: 0, atencao: 1, normal: 2 };
const VISIVEIS = 3;
/** (16/10) texto de cada novidade aqui: do tamanho de 2 linhas cheias no celular (sem 1 palavra sobrando embaixo) */
const TEXTO_NOVIDADE: Record<string, string> = {
  "aniversarios": "Mande uma mensagem de parabéns e ofereça um bolo especial pro dia.",
  "faturamento-up": "Você vendeu mais que nos mesmos dias do mês passado. Continue assim!",
  "faturamento-down": "Vendeu menos que nos mesmos dias do mês passado. Que tal uma promoção?",
  "produtos-sem-foto": "Produto com foto vende mais. Adicione pra chamar atenção no cardápio.",
  "clientes-sumidos": "Sem comprar há mais de 60 dias. Mande uma mensagem pra chamar de volta.",
};

export default function PraFazer() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const uid = profile?.id as string | undefined;
  const pronta = useLojaPronta(uid);
  const { updates } = useAtualizacoes();
  const [avisos, setAvisos] = useState<AvisoCadastro[]>([]);
  const [aberto, setAberto] = useState(false);
  const [, setMexeu] = useState(0);
  const kAte = (chave: string) => `doonly_aviso_ate_${uid}_${chave}`;
  const kOff = (chave: string) => `doonly_aviso_off_${uid}_${chave}`; // o X antigo (escondia por 7 dias)
  const escondido = (chave: string) => {
    try {
      const v = localStorage.getItem(kAte(chave));
      if (v === "nunca" || (v && Date.now() < Number(v))) return true;
      return Date.now() - Number(localStorage.getItem(kOff(chave)) || 0) < 7 * DIA;
    } catch { return false; }
  };

  // ao voltar pro app, relê o que falta cadastrar
  const [voltou, setVoltou] = useState(0);
  useAoVoltar(() => setVoltou(v => v + 1));
  useEffect(() => {
    if (!uid || pronta !== true) return;
    let vivo = true;
    lerAvisosCadastro(uid).then(l => { if (!vivo) return; setAvisos(l); notificarAvisosCadastro(l); }).catch(() => {});
    return () => { vivo = false; };
  }, [uid, pronta, voltou]);

  // (18/10) notificações: enquanto não estiverem ligadas neste aparelho, é o primeiro passo (toque já pede a permissão)
  const push = usePushSubscription();
  const ativarNotif = async () => {
    if (push.permission === "denied") { navigate("/configuracoes/notificacoes"); return; }
    const ok = await push.subscribe();
    if (ok) { avisar("Notificações ligadas. Você vai saber na hora quando chegar pedido.", { tipo: "ok" }); setMexeu(n => n + 1); }
    else if (Notification.permission === "denied") navigate("/configuracoes/notificacoes");
  };
  const itemNotif: Item[] = uid && push.isSupported && !push.isSubscribed ? [{
    chave: "ativar_notificacoes", nivel: "atencao", Ic: Bell, ordem: -100, acao: push.permission === "denied" ? "Liberar" : "Ativar", link: "/configuracoes/notificacoes", fechar: true,
    t: push.permission === "denied" ? "Notificações bloqueadas" : "Ativar notificações",
    s: push.permission === "denied" ? "Libere pra ver pedido novo" : "Pra não perder nenhum pedido",
    aoTocar: () => { void ativarNotif(); },
  }] : [];

  const itens: Item[] = [
    ...itemNotif,
    ...avisos.map((a, i): Item => ({
      chave: a.chave, nivel: a.nivel, Ic: ICONE[a.icone], t: a.curto.t, s: a.curto.s, link: a.link, estado: a.estado, ordem: i,
      acao: ACAO[a.icone] || "Ver", fechar: a.icone !== "conta",
    })),
    ...updates.map((u): Item => ({
      chave: u.key, nivel: u.key === "faturamento-down" || u.key === "aniversarios" ? "atencao" : "normal",
      Ic: u.Icone, t: u.curto.t, s: u.curto.s || TEXTO_NOVIDADE[u.key] || u.descricao, link: u.path, ordem: 100 - u.prioridade, acao: ACAO_NOVIDADE[u.key] || "Ver", fechar: true,
    })),
  ].filter(x => !x.fechar || !escondido(x.chave))
   .sort((a, b) => PESO[a.nivel] - PESO[b.nivel] || a.ordem - b.ordem);

  if (!itens.length) return null;
  const mostrar = aberto ? itens : itens.slice(0, VISIVEIS);
  const resto = itens.length - VISIVEIS;
  return (
    <section className="pf" aria-label="Pra fazer">
      <div className="pf-cab">
        <b className="pf-t">Pra fazer</b>
        <span className="pf-n">{itens.length === 1 ? "1 item" : `${itens.length} itens`}</span>
      </div>
      <ul className="pf-lista">
        {mostrar.map(x => (
          <li key={x.chave} className={`pf-it pf-it--${x.nivel}`}>
            <button type="button" className="pf-linha" disabled={x.aoTocar ? push.loading : false} onClick={() => x.aoTocar ? x.aoTocar() : navigate(x.link, x.estado ? { state: x.estado } : undefined)}>
              <span className="pf-ic" aria-hidden="true"><x.Ic size={20} weight="bold" /></span>
              <span className="pf-tx"><b>{x.t}</b><small>{x.s}</small></span>
              <span className={x.acao === "Pagar" ? "pf-bt pf-bt--pagar" : "pf-bt"}>{x.acao}</span>
            </button>
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
  .pf-cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
  .pf-t { font-size: 16px; font-weight: 700; line-height: 1.3; color: var(--ui-texto); }
  .pf-n { flex: none; padding: 3px 8px; border-radius: 6px; background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); font-size: 12px; font-weight: 700; }
  .pf-lista { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
  .pf-it { display: flex; align-items: center; gap: 4px; border-top: 1px solid var(--ui-linha, #F3ECEF); }
  .pf-it:first-child { border-top: 0; }
  .pf-linha { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; min-height: 60px; margin: 0; padding: 8px 0; border: 0; background: none; font-family: inherit; text-align: left; cursor: pointer; }
  .pf-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: var(--ui-raio); background: #F3F0F1; color: #8F8589; } /* (19/10) cinza claro (antes rosinha) */
  .pf-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .pf-tx b { font-size: 14.5px; font-weight: 700; line-height: 1.3; color: var(--ui-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pf-tx small { font-size: 13px; line-height: 1.35; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pf-seta { flex: none; color: var(--ui-texto-3); }
  .pf-bt { flex: none; padding: 7px 10px; border-radius: 8px; background: var(--ui-branco, #fff); border: 1px solid #E4DCDD; color: #3D2420; font-size: 13px; font-weight: 700; text-align: center; white-space: nowrap; }
  .pf-bt--pagar { background: #D92D20; border-color: #D92D20; color: var(--ui-branco); }
  /* urgente: vermelho; atenção: amarelo */
  .pf-it--urgente small { color: #9A3A32; }
  /* (18/10) ícones numa cor só (rosinha); o urgente continua com o texto e o "Pagar" em vermelho */
  .pf-ver { display: block; width: 100%; min-height: 44px; margin: 0 0 -6px; border: 0; border-top: 1px solid var(--ui-linha, #F3ECEF); background: none; font-family: inherit; font-size: 14px; font-weight: 700; color: var(--ui-rosa-escuro); cursor: pointer; }
`;

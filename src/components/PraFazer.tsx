import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Buildings, CalendarCheck, CaretRight, ClipboardText, Coins, CreditCard, ImageSquare, TextAlignLeft, Truck, X } from "@phosphor-icons/react";
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
 * (16/10) Virou "Seus próximos passos": mostra 3, cada um com "Agora não" (amanhã, 7 dias ou não mostrar mais)
 * e o botão da ação embaixo do texto (antes um X no canto). Conta a pagar não tem "Agora não".
 * O que falta cadastrar só aparece depois dos primeiros passos. Conta nova (sem nada) não vê o cartão.
 * (18/10) Lista compacta (estava com texto demais): ícone, título e uma linha curta; a linha toda abre;
 * o "Agora não" virou um × pequeno no canto (abre as mesmas opções).
 */
type Item = { chave: string; nivel: "urgente" | "atencao" | "normal"; Ic: Icon; t: string; s: string; acao: string; link: string; estado?: { abrir: string }; fechar?: boolean; ordem: number };

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
/** (16/10) "Agora não": em vez do X, ela escolhe até quando o item some */
const ADIAR: [string, number | "nunca"][] = [["Lembrar amanhã", 1], ["Lembrar em 7 dias", 7], ["Não mostrar mais", "nunca"]];

export default function PraFazer() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const uid = profile?.id as string | undefined;
  const pronta = useLojaPronta(uid);
  const { updates } = useAtualizacoes();
  const [avisos, setAvisos] = useState<AvisoCadastro[]>([]);
  const [aberto, setAberto] = useState(false);
  const [menu, setMenu] = useState<string | null>(null); // item com o "Agora não" aberto
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

  // fecha o menu do "Agora não" ao tocar fora
  useEffect(() => {
    if (!menu) return;
    const fora = (e: PointerEvent) => { if (!(e.target as HTMLElement)?.closest?.(".pf-adiar")) setMenu(null); };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [menu]);

  const itens: Item[] = [
    ...avisos.map((a, i): Item => ({
      chave: a.chave, nivel: a.nivel, Ic: ICONE[a.icone], t: a.curto.t, s: a.curto.s, link: a.link, estado: a.estado, ordem: i,
      acao: a.icone === "conta" ? "Pagar" : "Ver", fechar: a.icone !== "conta",
    })),
    ...updates.map((u): Item => ({
      chave: u.key, nivel: u.key === "faturamento-down" || u.key === "aniversarios" ? "atencao" : "normal",
      Ic: u.Icone, t: u.curto.t, s: u.curto.s || TEXTO_NOVIDADE[u.key] || u.descricao, link: u.path, ordem: 100 - u.prioridade, acao: "Ver", fechar: true,
    })),
  ].filter(x => !x.fechar || !escondido(x.chave))
   .sort((a, b) => PESO[a.nivel] - PESO[b.nivel] || a.ordem - b.ordem);

  if (!itens.length) return null;
  const mostrar = aberto ? itens : itens.slice(0, VISIVEIS);
  const resto = itens.length - VISIVEIS;
  const adiar = (chave: string, d: number | "nunca") => {
    try { localStorage.setItem(kAte(chave), d === "nunca" ? "nunca" : String(Date.now() + d * DIA)); } catch {}
    setMenu(null); setMexeu(n => n + 1);
  };

  return (
    <section className="pf" aria-label="Seus próximos passos">
      <div className="pf-cab">
        <b className="pf-t">Seus próximos passos</b>
        <span className="pf-n">{itens.length === 1 ? "1 item" : `${itens.length} itens`}</span>
      </div>
      <ul className="pf-lista">
        {mostrar.map(x => (
          <li key={x.chave} className={`pf-it pf-it--${x.nivel}`}>
            <button type="button" className="pf-linha" onClick={() => navigate(x.link, x.estado ? { state: x.estado } : undefined)}>
              <span className="pf-ic" aria-hidden="true"><x.Ic size={20} weight="bold" /></span>
              <span className="pf-tx"><b>{x.t}</b><small>{x.s}</small></span>
              {x.acao === "Pagar" ? <span className="pf-pagar">Pagar</span> : <CaretRight size={16} weight="bold" className="pf-seta" aria-hidden="true" />}
            </button>
            {x.fechar && (
              <div className="pf-adiar">
                <button type="button" className="pf-x" aria-label={`Agora não: ${x.t}`} aria-haspopup="menu" aria-expanded={menu === x.chave} onClick={() => setMenu(m => m === x.chave ? null : x.chave)}>
                  <X size={14} weight="bold" aria-hidden="true" />
                </button>
                {menu === x.chave && (
                  <div className="pf-menu" role="menu">
                    {ADIAR.map(([t, d]) => <button type="button" role="menuitem" key={t} onClick={() => adiar(x.chave, d)}>{t}</button>)}
                  </div>
                )}
              </div>
            )}
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
  .pf-linha { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; min-height: 60px; margin: 0; padding: 8px 0; border: 0; background: none; font-family: inherit; text-align: left; cursor: pointer; }
  .pf-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--ui-raio); background: var(--primary-light, #FCE0E9); color: var(--ui-rosa-escuro); }
  .pf-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .pf-tx b { font-size: 14.5px; font-weight: 700; line-height: 1.3; color: var(--ui-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pf-tx small { font-size: 13px; line-height: 1.35; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pf-seta { flex: none; color: var(--ui-texto-3); }
  .pf-pagar { flex: none; padding: 6px 12px; border-radius: 8px; background: #D92D20; color: var(--ui-branco); font-size: 13px; font-weight: 700; }
  .pf-adiar { position: relative; flex: none; }
  .pf-x { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; margin: 0; padding: 0; border: 0; border-radius: 50%; background: #F5F0F2; color: var(--ui-texto-3); cursor: pointer; }
  .pf-x::after { content: ""; position: absolute; inset: -6px; }
  .pf-menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 30; min-width: 190px; padding: 6px; border: 1px solid var(--ui-borda); border-radius: 10px; background: var(--ui-branco); box-shadow: 0 10px 28px rgba(44, 18, 25, .16); }
  .pf-menu button { display: block; width: 100%; min-height: 40px; padding: 0 10px; border: 0; border-radius: 6px; background: none; font-family: inherit; font-size: 14px; text-align: left; color: var(--ui-texto); white-space: nowrap; cursor: pointer; }
  .pf-menu button:last-child { color: var(--ui-texto-2); }
  @media (hover: hover) { .pf-menu button:hover, .pf-x:hover { background: #F0E9EC; } }
  /* urgente: vermelho; atenção: amarelo */
  .pf-it--urgente .pf-ic { background: #FDECEC; color: #B42318; }
  .pf-it--urgente small { color: #9A3A32; }
  .pf-it--atencao .pf-ic { background: #FFF4D6; color: #8A5A00; }
  .pf-ver { display: block; width: 100%; min-height: 44px; margin: 0 0 -6px; border: 0; border-top: 1px solid var(--ui-linha, #F3ECEF); background: none; font-family: inherit; font-size: 14px; font-weight: 700; color: var(--ui-rosa-escuro); cursor: pointer; }
`;

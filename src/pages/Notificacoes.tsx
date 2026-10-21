import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { carregarNotificacoes, marcarLidas, type Notif } from "@/lib/notificacoesUsuario";
import { Bell, Buildings, CalendarCheck, Camera, Checks, ChartLineUp, ClipboardText, Clock, Coins, Crown, Gift, HandCoins, Newspaper, ShoppingBag, Storefront, Trophy, Users, WarningCircle } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { quandoFoi } from "@/lib/noticias";
import { supabase } from "@/lib/supabase";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { avisar } from "@/components/base";

/**
 * Quando o aviso chegou (11/10). De hoje: "agora", "12 min", "3h". De outros dias: "ontem", "há 3 dias"…, contando
 * dias do calendário (quandoFoi). Antes contava blocos de 24h: o aviso de ontem à noite aparecia como "9h" de manhã,
 * "ontem" era o de anteontem, e saía "0 meses" (28 e 29 dias) e "1 anos".
 */
function tempoRelativo(iso: string): string {
  const d = new Date(iso), agora = new Date();
  if (Number.isNaN(d.getTime())) return "";
  const mesmoDia = d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth() && d.getDate() === agora.getDate();
  if (!mesmoDia) return quandoFoi(iso, agora);
  const mins = Math.floor((agora.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "agora"; // inclui relógio do aparelho um pouco atrasado (aviso "no futuro")
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h`;
}

type Filtro = "todas" | "novas";
type Grupo = "pedido" | "loja" | "plano" | "conquista" | "novidade";
const GRUPO: Record<string, Grupo> = { pedido: "pedido", aviso: "loja", pro: "plano", pro_vencendo: "plano", pro_atrasado: "plano", conquista: "conquista", noticia: "novidade" };
const grupoDe = (n: Notif): Grupo => GRUPO[n.tipo || ""] || (n.user_id ? "plano" : "novidade");
const ICONE: Record<Grupo, typeof Bell> = { pedido: ShoppingBag, loja: Storefront, plano: Crown, conquista: Trophy, novidade: Newspaper };
const ICONE_TIPO: Record<string, typeof Bell> = { pro_vencendo: Clock, pro_atrasado: WarningCircle };
/** (16/10) o ícone diz o assunto: o mesmo do "Seus próximos passos" (antes todo aviso da loja era uma lojinha) */
const ICONE_LINK: [RegExp, typeof Bell][] = [
  [/^\/financeiro\/a-pagar/, CalendarCheck], [/^\/financeiro\/a-receber/, HandCoins], [/^\/custos/, Buildings], [/^\/ficha-tecnica/, ClipboardText],
  [/^\/financeiro/, Coins], [/^\/lucratividade/, ChartLineUp], [/^\/(pedidos|vendas)/, ShoppingBag], [/^\/clientes/, Users],
  [/^\/produtos/, Camera], [/^\/indicar/, Gift],
];
function iconeDe(n: Notif, g: Grupo): typeof Bell {
  if (n.tipo && ICONE_TIPO[n.tipo]) return ICONE_TIPO[n.tipo];
  if (g === "conquista" || g === "plano" || g === "novidade") return ICONE[g];
  const l = String(n.link || "");
  return ICONE_LINK.find(([re]) => re.test(l))?.[1] || ICONE[g] || Bell;
}
/** (16/10) sem emoji no app: avisos antigos vinham com troféu e afins no título */
const semEmoji = (t?: string | null) => String(t || "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\s{2,}/g, " ").trim();

/** (21/10) A conta a pagar do aviso (chave conta_<situação>_<id>) */
const idDaConta = (n: Notif) => /^conta_(?:vence|hoje|atrasada)_(.+)$/.exec(String(n.chave || ""))?.[1] || null;
type Conta = { id: string; descricao: string; valor: number; vencimento: string; status: string };
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function situacaoConta(c: Conta): string {
  const [y, m, d] = String(c.vencimento).slice(0, 10).split("-").map(Number); const h = new Date();
  const dias = Math.round((new Date(y, m - 1, d).getTime() - new Date(h.getFullYear(), h.getMonth(), h.getDate()).getTime()) / 86400000);
  const q = dias === 0 ? "Vence hoje" : dias === 1 ? "Vence amanhã" : dias > 1 ? `Vence em ${dias} dias` : dias === -1 ? "Venceu ontem" : `Venceu há ${-dias} dias`;
  return Number(c.valor) > 0 ? `${q} · ${brl(c.valor)}` : q;
}
/** (21/10) botão curto de cada aviso no computador (o mesmo do "Pra fazer" do Início) */
const ACAO: [RegExp, string][] = [[/^\/financeiro\/a-pagar/, "Pagar agora"], [/^\/custos/, "Definir"], [/^\/checkout-config/, "Definir"], [/^\/ficha-tecnica/, "Fazer"], [/^\/financeiro\/?$/, "Informar"], [/^\/produtos/, "Ver produtos"]];
const acaoDe = (n: Notif) => { const l = String(n.link || ""); return ACAO.find(([re]) => re.test(l))?.[1] || null; };
type FiltroGrupo = "todos" | "loja" | "pedido" | "plano" | "novidade";
const FILTROS: [FiltroGrupo, string][] = [["todos", "Todos os avisos"], ["loja", "Sua loja"], ["pedido", "Pedidos"], ["plano", "Plano"], ["novidade", "Novidades"]];

/** Separa por dia: Hoje, Ontem, Esta semana, Antes (13/10) */
function blocoDoDia(iso: string): string {
  const d = new Date(iso); const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dia = new Date(d); dia.setHours(0, 0, 0, 0);
  const dias = Math.round((hoje.getTime() - dia.getTime()) / 86400000);
  return dias <= 0 ? "Hoje" : dias === 1 ? "Ontem" : dias < 7 ? "Esta semana" : "Antes";
}

/**
 * Notificações (13/10): refeita. Filtros por tipo, separadas por dia, numa lista só (antes eram cartões soltos
 * e estreitos no meio da tela do computador). Cada tipo com sua cor; o "Marcar todas como lidas" sobe pro cabeçalho.
 */
export default function Notificacoes() {
  const navigate = useNavigate();
  const [notificacoes, setNotificacoes] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const recarregar = async () => { setNotificacoes(await carregarNotificacoes()); setLoading(false); };
  useEffect(() => { recarregar(); }, []);

  // (21/10) computador: filtro por assunto na coluna da direita
  const [grupo, setGrupo] = useState<FiltroGrupo>("todos");
  const doGrupo = grupo === "todos" ? notificacoes : notificacoes.filter(n => grupoDe(n) === grupo);
  const naoLidas = notificacoes.filter(n => !n.lida);
  const visiveis = filtro === "novas" ? doGrupo.filter(n => !n.lida) : doGrupo;
  // (21/10) conta a pagar: o aviso mostra a conta de verdade (nome, quando vence e o valor) e o "Pagar agora"
  const [contas, setContas] = useState<Record<string, Conta>>({});
  const idsConta = useMemo(() => [...new Set(notificacoes.map(idDaConta).filter(Boolean) as string[])], [notificacoes]);
  useEffect(() => {
    if (!idsConta.length) return;
    let vivo = true;
    void supabase.from("contas_pagar").select("id, descricao, valor, vencimento, status").in("id", idsConta).then(({ data }) => {
      if (vivo && data) setContas(Object.fromEntries((data as Conta[]).map(c => [c.id, c])));
    });
    return () => { vivo = false; };
  }, [idsConta.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  // (21/10) avisos bloqueados neste aparelho: cartão na direita (computador) pra liberar
  const push = usePushSubscription();
  const bloqueado = push.isSupported && !push.isSubscribed;
  const liberar = async () => {
    if (push.permission === "denied") { navigate("/configuracoes/notificacoes"); return; }
    const ok = await push.subscribe();
    if (ok) avisar("Avisos ligados. Você vai saber na hora quando chegar pedido.", { tipo: "ok" });
    else if (Notification.permission === "denied") navigate("/configuracoes/notificacoes");
  };
  const blocos: [string, Notif[]][] = [];
  for (const n of visiveis) {
    const b = blocoDoDia(n.created_at);
    const ult = blocos[blocos.length - 1];
    if (ult && ult[0] === b) ult[1].push(n); else blocos.push([b, [n]]);
  }

  const abrir = async (n: Notif) => {
    if (!n.lida) { setNotificacoes(l => l.map(x => x.id === n.id ? { ...x, lida: true } : x)); marcarLidas([n.id]); }
    // conta a pagar ainda em aberto: já abre a janela de pagar dela
    const conta = idDaConta(n); const c = conta ? contas[conta] : null;
    if (n.link) navigate(n.link, c && c.status === "pendente" ? { state: { abrir: `pagar:${c.id}` } } : undefined);
  };
  const todas = () => { const ids = naoLidas.map(n => n.id); setNotificacoes(l => l.map(x => ({ ...x, lida: true }))); marcarLidas(ids); };

  return (
    <>
      <AppPageHeader
        title="Notificações"
        subtitle={naoLidas.length > 0 ? `${naoLidas.length} nova${naoLidas.length > 1 ? "s" : ""}` : (notificacoes.length ? "Tudo lido" : "Avisos do Doonly")}
        infoIcon="🔔"
        infoContent="Aqui ficam seus pedidos novos, avisos da sua loja e do seu plano, conquistas e as novidades do Doonly."
      />

      {/* (16/10) refeita: duas abas (Todas e Não lidas), "Ler todas" na mesma linha, avisos em cartões com o tipo,
          o tempo no canto e a bolinha das não lidas; sem emoji e sem fundo rosa em tudo */}
      <div className="ntf-root">
        <div className="ntf-grade">
        <div className="ntf-main">
        {loading ? (
          <div className="ntf-loading"><span className="ntf-spinner" /></div>
        ) : notificacoes.length === 0 ? (
          <div className="ntf-card ntf-empty">
            <div className="ntf-empty-ic"><Bell size={30} weight="regular" /></div>
            <p className="ntf-empty-t">Nenhuma notificação ainda</p>
            <p className="ntf-empty-d">Pedidos novos, avisos da sua loja, conquistas e novidades do Doonly aparecem aqui.</p>
          </div>
        ) : (<>
          <div className="ntf-barra">
            <div className="ntf-seg" role="tablist" aria-label="Mostrar">
              <button type="button" role="tab" aria-selected={filtro === "todas"} className={filtro === "todas" ? "on" : ""} onClick={() => setFiltro("todas")}>Todas</button>
              <button type="button" role="tab" aria-selected={filtro === "novas"} className={filtro === "novas" ? "on" : ""} onClick={() => setFiltro("novas")}>
                Não lidas{naoLidas.length > 0 && <i>{naoLidas.length}</i>}
              </button>
            </div>
            {naoLidas.length > 0 && <button type="button" className="ntf-todas" onClick={todas}><Checks size={16} weight="bold" aria-hidden="true" />Marcar todas como lidas</button>}
          </div>

          {visiveis.length === 0 ? (
            <div className="ntf-card ntf-empty ntf-empty--p">
              <div className="ntf-empty-ic ntf-empty-ic--ok"><Checks size={28} weight="bold" /></div>
              <p className="ntf-empty-t">Tudo lido por aqui</p>
              <button type="button" className="ntf-lnk" onClick={() => setFiltro("todas")}>Ver todas</button>
            </div>
          ) : blocos.map(([titulo, lista], bi) => (
            <section key={titulo} className="ntf-bloco">
              <div className="ntf-dia-l">
                <p className="ntf-dia">{titulo}</p>
                {/* (21/10) celular: "Marcar todas como lidas" desce pra linha do primeiro dia (ao lado das abas não cabia) */}
                {bi === 0 && naoLidas.length > 0 && <button type="button" className="ntf-todas ntf-todas--cel" onClick={todas}><Checks size={16} weight="bold" aria-hidden="true" />Marcar todas como lidas</button>}
              </div>
              {/* (21/10) lista compacta: uma linha de título e uma de explicação; sem o "SUA LOJA" e o "Ver" (a linha toda abre).
                  Não lida em negrito com a bolinha; lida em letra normal. Computador: o botão curto de ação à direita. */}
              <div className="ntf-lista">
                {lista.map(n => {
                  const g = grupoDe(n);
                  const Ic = iconeDe(n, g);
                  const conta = idDaConta(n); const c = conta ? contas[conta] : null;
                  const aberta = !!c && c.status === "pendente";
                  const alerta = n.tipo === "pro_atrasado" || (aberta && /^(Atrasada|Vence hoje)/.test(String(n.titulo)));
                  const titulo = c ? c.descricao : semEmoji(n.titulo), msg = c ? (aberta ? situacaoConta(c) : "Conta paga") : semEmoji(n.mensagem);
                  const acao = n.link && (!conta || aberta) ? acaoDe(n) : null;
                  return (
                    <div key={n.id} className={`ntf-item${!n.lida ? " ntf-item--nova" : ""}${n.link ? " ntf-item--link" : ""}${alerta ? " ntf-item--urg" : ""}`}
                      onClick={() => abrir(n)} role={n.link ? "button" : undefined} tabIndex={n.link ? 0 : undefined}
                      onKeyDown={e => { if (n.link && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrir(n); } }}>
                      <div className={`ntf-img ntf-img--${alerta ? "alerta" : g}`}>
                        {n.imagem_url ? <img src={n.imagem_url} alt="" /> : <Ic size={20} weight="fill" />}
                      </div>
                      <div className="ntf-content">
                        <div className="ntf-l1">
                          <p className="ntf-t">{titulo}</p>
                          <span className="ntf-time ntf-time--pc">{tempoRelativo(n.created_at)}</span>
                          {!n.lida && <i className="ntf-pt" aria-label="Não lida" />}
                        </div>
                        <div className="ntf-l2">
                          {msg && <p className="ntf-msg">{msg}</p>}
                          <span className="ntf-time ntf-time--cel">{tempoRelativo(n.created_at)}</span>
                        </div>
                      </div>
                      {acao && <span className={`ntf-acao${acao === "Pagar agora" ? " ntf-acao--pagar" : ""}`}>{acao}</span>}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </>)}
        </div>
        {/* (21/10) computador: filtro por assunto e, com os avisos bloqueados, o atalho pra liberar */}
        {!loading && notificacoes.length > 0 && (
          <aside className="ntf-lado">
            <div className="ntf-cartao">
              <h3>Mostrar</h3>
              {FILTROS.map(([k, rot]) => {
                const qtd = k === "todos" ? notificacoes.length : notificacoes.filter(n => grupoDe(n) === k).length;
                return <button key={k} type="button" className={grupo === k ? "on" : ""} aria-pressed={grupo === k} onClick={() => setGrupo(k)}>{rot}<span>{qtd}</span></button>;
              })}
            </div>
            {bloqueado && (
              <div className="ntf-cartao ntf-blq">
                <h3>{push.permission === "denied" ? "Avisos bloqueados" : "Avisos desligados"}</h3>
                <p>{push.permission === "denied" ? "Seu navegador está bloqueando os avisos. Libere pra saber na hora quando chegar pedido novo." : "Ligue os avisos pra saber na hora quando chegar pedido novo."}</p>
                <button type="button" onClick={() => void liberar()}>{push.permission === "denied" ? "Liberar avisos" : "Ligar avisos"}</button>
                <button type="button" className="ntf-blq-l" onClick={() => navigate("/configuracoes/notificacoes")}>Ajustar avisos e sons</button>
              </div>
            )}
          </aside>
        )}
        </div>
      </div>

      <style>{`
        .ntf-root { font-family: var(--font-base); padding: 16px 16px 100px; max-width: 760px; margin: 0 auto; color: var(--ui-texto); }
        .ntf-barra { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .ntf-seg { display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: #F3EEF0; }
        .ntf-seg button { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border: 0; border-radius: 8px; background: none; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--ui-texto-2); white-space: nowrap; cursor: pointer; }
        .ntf-seg button.on { background: var(--ui-branco); color: var(--ui-texto); box-shadow: 0 1px 3px rgba(44, 18, 25, .12); }
        .ntf-seg i { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 6px; background: var(--ui-rosa); color: var(--ui-branco); font-style: normal; font-size: 11.5px; font-weight: 700; line-height: 20px; text-align: center; }
        .ntf-todas { display: inline-flex; align-items: center; gap: 5px; min-height: 40px; margin-right: -8px; padding: 0 8px; border: 0; border-radius: 8px; background: none; font-family: inherit; font-size: 14px; font-weight: 700; color: var(--ui-rosa-escuro); white-space: nowrap; cursor: pointer; }
        @media (hover: hover) { .ntf-todas:hover { background: #FFF1F6; } }
        /* (21/10) "Ler todas" virou "Marcar todas como lidas": no celular fica na linha do primeiro dia (ao lado das abas não cabia) */
        .ntf-dia-l { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
        .ntf-dia-l .ntf-dia { margin-bottom: 0; }
        .ntf-todas--cel { display: none; min-height: 32px; }
        @media (max-width: 599px) { .ntf-barra .ntf-todas { display: none; } .ntf-todas--cel { display: inline-flex; } }
        .ntf-bloco { margin-top: 20px; }
        .ntf-dia { margin: 0 0 8px 2px; font-size: 13px; font-weight: 700; color: var(--ui-texto-2); }
        /* (21/10) lista compacta num cartão só, com linhas */
        .ntf-lista { display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--ui-borda); border-radius: 16px; background: var(--ui-branco); }
        .ntf-item { position: relative; display: flex; align-items: center; gap: 12px; min-height: 70px; box-sizing: border-box; padding: 12px 14px; border-top: 1px solid #F3ECEF; background: var(--ui-branco); }
        .ntf-item:first-child { border-top: 0; }
        .ntf-item--link { cursor: pointer; }
        @media (hover: hover) { .ntf-item--link:hover { background: #FCF8F9; } }
        .ntf-item--link:focus-visible { outline: 3px solid rgba(var(--ui-rosa-rgb), .4); outline-offset: -3px; }
        .ntf-img { flex: none; width: 40px; height: 40px; border-radius: 10px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--ui-ic-fundo); color: var(--ui-ic-cor); }
        .ntf-img img { width: 100%; height: 100%; object-fit: cover; }
        .ntf-img--plano { background: #F6E9EE; color: var(--ui-vinho, #6B2340); }
        .ntf-img--conquista { background: #FFF4D6; color: #A86B00; }
        .ntf-img--alerta { background: #FDECEC; color: #B42318; }
        .ntf-content { flex: 1; min-width: 0; }
        .ntf-l1, .ntf-l2 { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .ntf-l2 { margin-top: 2px; }
        .ntf-t { flex: 1; min-width: 0; margin: 0; overflow: hidden; font-size: 15px; font-weight: 500; line-height: 1.35; color: var(--ui-texto); white-space: nowrap; text-overflow: ellipsis; }
        .ntf-item--nova .ntf-t { font-weight: 700; }
        .ntf-msg { flex: 1; min-width: 0; margin: 0; overflow: hidden; font-size: 13.5px; line-height: 1.4; color: var(--ui-texto-2); white-space: nowrap; text-overflow: ellipsis; }
        .ntf-item:not(.ntf-item--nova) .ntf-msg { color: var(--ui-texto-3); }
        .ntf-time { flex: none; font-size: 12.5px; color: var(--ui-texto-3); white-space: nowrap; }
        .ntf-time--pc { display: none; }
        .ntf-pt { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--ui-rosa); }
        .ntf-acao { display: none; }
        @media (min-width: 901px) {
          .ntf-time--pc { display: inline; } .ntf-time--cel { display: none; }
          .ntf-item--urg { background: #FFF7F6; }
          .ntf-acao { flex: none; display: inline-flex; align-items: center; padding: 8px 12px; border: 1px solid #E4DCDD; border-radius: 8px; background: var(--ui-branco); font-size: 13.5px; font-weight: 700; color: #3D2420; white-space: nowrap; }
          .ntf-acao--pagar { border-color: #D92D20; background: #D92D20; color: var(--ui-branco); }
        }
        .ntf-loading { display: flex; justify-content: center; padding: 60px; }
        .ntf-spinner { width: 28px; height: 28px; border: 3px solid var(--primary-light); border-top-color: var(--ui-rosa); border-radius: 50%; animation: ntfSpin 0.7s linear infinite; }
        @keyframes ntfSpin { to { transform: rotate(360deg); } }
        .ntf-card { background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); }
        .ntf-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 56px 24px; }
        .ntf-empty--p { padding: 32px 24px; margin-top: 20px; }
        .ntf-empty-ic { width: 64px; height: 64px; border-radius: 50%; background: var(--ui-rosa-claro); color: var(--ui-rosa); display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
        .ntf-empty-ic--ok { background: #EAF7EF; color: #2E9E5B; }
        .ntf-empty-t { font-size: 15px; font-weight: 700; margin: 0 0 4px; }
        .ntf-empty-d { font-size: 13.5px; color: var(--ui-texto-2); margin: 0; line-height: 1.5; max-width: 320px; }
        .ntf-lnk { border: 0; background: none; font-family: inherit; font-size: 14px; font-weight: 700; color: var(--ui-rosa-escuro); cursor: pointer; min-height: 40px; }
        /* (21/10) computador: a lista e, à direita, o filtro e os avisos bloqueados */
        .ntf-lado { display: none; }
        @media (min-width: 901px) {
          .ntf-root { max-width: 1066px; padding: 24px 0 48px; }
          .ntf-grade { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 24px; align-items: start; }
          .ntf-item { padding: 12px 16px; gap: 14px; }
          .ntf-lado { display: flex; flex-direction: column; gap: 16px; }
          .ntf-cartao { padding: 16px; border: 1px solid var(--ui-borda); border-radius: 16px; background: var(--ui-branco); }
          .ntf-cartao h3 { margin: 0 0 10px; font-size: 15px; font-weight: 700; color: var(--ui-texto); }
          .ntf-cartao > button:not(.ntf-blq-l) { display: flex; justify-content: space-between; align-items: center; width: 100%; min-height: 40px; margin: 0; padding: 0 12px; border: 0; border-radius: 10px; background: none; font-family: inherit; font-size: 14.5px; color: var(--ui-texto); text-align: left; cursor: pointer; }
          .ntf-cartao > button span { font-size: 13px; color: var(--ui-texto-3); }
          .ntf-cartao > button.on { background: #FFF1F6; font-weight: 700; color: var(--ui-rosa-escuro); }
          @media (hover: hover) { .ntf-cartao > button:not(.on):not(.ntf-blq-l):hover { background: #FAF6F7; } }
          .ntf-blq p { margin: 0 0 12px; font-size: 13.5px; line-height: 1.5; color: var(--ui-texto-2); }
          .ntf-blq > button:not(.ntf-blq-l) { justify-content: center; min-height: 42px; background: var(--ui-rosa); color: var(--ui-branco); font-weight: 700; }
          .ntf-blq-l { display: block; width: 100%; min-height: 40px; margin-top: 6px; border: 0; background: none; font-family: inherit; font-size: 13.5px; font-weight: 700; color: var(--ui-rosa-escuro); cursor: pointer; }
        }
      `}</style>
    </>
  );
}

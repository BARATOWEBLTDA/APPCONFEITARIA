import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { carregarNotificacoes, marcarLidas, type Notif } from "@/lib/notificacoesUsuario";
import { Bell, CaretRight, Checks, Clock, Crown, Newspaper, ShoppingBag, Storefront, Trophy, WarningCircle } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { quandoFoi } from "@/lib/noticias";

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
const ROTULO: Record<Grupo, string> = { pedido: "Pedido", loja: "Sua loja", plano: "Plano", conquista: "Conquista", novidade: "Novidade" };
/** (16/10) sem emoji no app: avisos antigos vinham com troféu e afins no título */
const semEmoji = (t?: string | null) => String(t || "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\s{2,}/g, " ").trim();

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

  const naoLidas = notificacoes.filter(n => !n.lida);
  const visiveis = filtro === "novas" ? naoLidas : notificacoes;
  const blocos: [string, Notif[]][] = [];
  for (const n of visiveis) {
    const b = blocoDoDia(n.created_at);
    const ult = blocos[blocos.length - 1];
    if (ult && ult[0] === b) ult[1].push(n); else blocos.push([b, [n]]);
  }

  const abrir = async (n: Notif) => {
    if (!n.lida) { setNotificacoes(l => l.map(x => x.id === n.id ? { ...x, lida: true } : x)); marcarLidas([n.id]); }
    if (n.link) navigate(n.link);
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
            {naoLidas.length > 0 && <button type="button" className="ntf-todas" onClick={todas}><Checks size={16} weight="bold" aria-hidden="true" />Ler todas</button>}
          </div>

          {visiveis.length === 0 ? (
            <div className="ntf-card ntf-empty ntf-empty--p">
              <div className="ntf-empty-ic ntf-empty-ic--ok"><Checks size={28} weight="bold" /></div>
              <p className="ntf-empty-t">Tudo lido por aqui</p>
              <button type="button" className="ntf-lnk" onClick={() => setFiltro("todas")}>Ver todas</button>
            </div>
          ) : blocos.map(([titulo, lista]) => (
            <section key={titulo} className="ntf-bloco">
              <p className="ntf-dia">{titulo}</p>
              <div className="ntf-lista">
                {lista.map(n => {
                  const g = grupoDe(n);
                  const Ic = (n.tipo && ICONE_TIPO[n.tipo]) || ICONE[g] || Bell;
                  const alerta = n.tipo === "pro_atrasado";
                  const titulo = semEmoji(n.titulo), msg = semEmoji(n.mensagem);
                  return (
                    <div key={n.id} className={`ntf-item${!n.lida ? " ntf-item--nova" : ""}${n.link ? " ntf-item--link" : ""}`}
                      onClick={() => abrir(n)} role={n.link ? "button" : undefined} tabIndex={n.link ? 0 : undefined}
                      onKeyDown={e => { if (n.link && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrir(n); } }}>
                      <div className={`ntf-img ntf-img--${alerta ? "alerta" : g}`}>
                        {n.imagem_url ? <img src={n.imagem_url} alt="" /> : <Ic size={20} weight="fill" />}
                      </div>
                      <div className="ntf-content">
                        <div className="ntf-l1">
                          <span className="ntf-tipo">{alerta ? "Atenção" : ROTULO[g]}</span>
                          <span className="ntf-time">{tempoRelativo(n.created_at)}</span>
                          {!n.lida && <i className="ntf-pt" aria-label="Não lida" />}
                        </div>
                        <p className="ntf-t">{titulo}</p>
                        {msg && <p className="ntf-msg">{msg}</p>}
                        {n.link && <span className="ntf-ver">Ver <CaretRight size={13} weight="bold" aria-hidden="true" /></span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </>)}
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
        .ntf-bloco { margin-top: 20px; }
        .ntf-dia { margin: 0 0 8px 2px; font-size: 13px; font-weight: 700; color: var(--ui-texto-2); }
        .ntf-lista { display: flex; flex-direction: column; gap: 8px; }
        .ntf-item { position: relative; display: flex; align-items: flex-start; gap: 12px; padding: 14px; border: 1px solid var(--ui-borda); border-radius: 14px; background: var(--ui-branco); transition: border-color .12s linear; }
        .ntf-item--nova { border-color: #F3C9DA; box-shadow: 0 2px 10px rgba(232, 90, 140, .08); }
        .ntf-item--link { cursor: pointer; }
        @media (hover: hover) { .ntf-item--link:hover { border-color: #EBB8CD; } }
        .ntf-item--link:focus-visible { outline: 3px solid rgba(var(--ui-rosa-rgb), .4); outline-offset: 2px; }
        .ntf-img { flex: none; width: 40px; height: 40px; border-radius: 10px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--primary-light, #FCE0E9); color: var(--ui-rosa-escuro); }
        .ntf-img img { width: 100%; height: 100%; object-fit: cover; }
        .ntf-img--plano { background: #F6E9EE; color: var(--ui-vinho, #6B2340); }
        .ntf-img--conquista { background: #FFF4D6; color: #A86B00; }
        .ntf-img--alerta { background: #FDECEC; color: #B42318; }
        .ntf-content { flex: 1; min-width: 0; }
        .ntf-l1 { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
        .ntf-tipo { font-size: 12px; font-weight: 700; color: var(--ui-texto-3); text-transform: uppercase; letter-spacing: .04em; }
        .ntf-time { margin-left: auto; font-size: 12.5px; color: var(--ui-texto-3); white-space: nowrap; }
        .ntf-pt { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--ui-rosa); }
        .ntf-t { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.35; color: var(--ui-texto); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-wrap: balance; }
        .ntf-item--nova .ntf-t { font-weight: 700; }
        .ntf-msg { margin: 3px 0 0; font-size: 13.5px; color: var(--ui-texto-2); line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-wrap: pretty; }
        .ntf-ver { display: inline-flex; align-items: center; gap: 2px; margin-top: 6px; font-size: 13.5px; font-weight: 700; color: var(--ui-rosa-escuro); }
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
        @media (min-width: 901px) { .ntf-root { padding: 24px 0 48px; } .ntf-item { padding: 16px; gap: 14px; } .ntf-img { width: 44px; height: 44px; } }
      `}</style>
    </>
  );
}

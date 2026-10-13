import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { carregarNotificacoes, marcarLidas, type Notif } from "@/lib/notificacoesUsuario";
import { Bell, CaretRight, Checks, Clock, Crown, Newspaper, ShoppingBag, Trophy, WarningCircle } from "@phosphor-icons/react";
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

type Filtro = "todas" | "novas" | "pedido" | "plano" | "conquista" | "novidade";
const GRUPO: Record<string, Exclude<Filtro, "todas" | "novas">> = { pedido: "pedido", pro: "plano", pro_vencendo: "plano", pro_atrasado: "plano", conquista: "conquista", noticia: "novidade" };
const grupoDe = (n: Notif) => GRUPO[n.tipo || ""] || (n.user_id ? "plano" : "novidade");
const ICONE: Record<string, typeof Bell> = { pedido: ShoppingBag, plano: Crown, conquista: Trophy, novidade: Newspaper };
const ICONE_TIPO: Record<string, typeof Bell> = { pro_vencendo: Clock, pro_atrasado: WarningCircle };
const FILTROS: [Filtro, string][] = [["todas", "Todas"], ["novas", "Não lidas"], ["pedido", "Pedidos"], ["plano", "Plano"], ["conquista", "Conquistas"], ["novidade", "Novidades"]];

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
  const conta = (f: Filtro) => f === "todas" ? notificacoes.length : f === "novas" ? naoLidas.length : notificacoes.filter(n => grupoDe(n) === f).length;
  const visiveis = notificacoes.filter(n => filtro === "todas" || (filtro === "novas" ? !n.lida : grupoDe(n) === filtro));
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
  const botaoTodas = naoLidas.length > 0
    ? <button type="button" className="ntf-todas" onClick={todas}><Checks size={18} weight="bold" /> Marcar todas como lidas</button>
    : null;

  return (
    <>
      <AppPageHeader
        title="Notificações"
        subtitle={naoLidas.length > 0 ? `${naoLidas.length} nova${naoLidas.length > 1 ? "s" : ""}` : (notificacoes.length ? "Todas lidas" : "Avisos do Doonly")}
        infoIcon="🔔"
        infoContent="Aqui ficam seus pedidos novos, avisos do seu plano, conquistas e as novidades do Doonly."
        rightActions={botaoTodas}
      />

      <div className="ntf-root">
        {loading ? (
          <div className="ntf-loading"><span className="ntf-spinner" /></div>
        ) : notificacoes.length === 0 ? (
          <div className="ntf-card ntf-empty">
            <div className="ntf-empty-ic"><Bell size={30} weight="regular" /></div>
            <p className="ntf-empty-t">Nenhuma notificação ainda</p>
            <p className="ntf-empty-d">Pedidos novos, avisos do seu plano, conquistas e novidades do Doonly aparecem aqui.</p>
          </div>
        ) : (<>
          <div className="ntf-barra">
            <div className="ntf-filtros" role="tablist" aria-label="Filtrar notificações">
              {FILTROS.filter(([f]) => f === "todas" || conta(f) > 0).map(([f, nome]) => (
                <button key={f} type="button" role="tab" aria-selected={filtro === f} className={filtro === f ? "on" : ""} onClick={() => setFiltro(f)}>
                  {nome}<span>{conta(f)}</span>
                </button>
              ))}
            </div>
            {botaoTodas && <div className="ntf-so-cel">{botaoTodas}</div>}
          </div>

          {visiveis.length === 0 ? (
            <div className="ntf-card ntf-empty ntf-empty--p">
              <p className="ntf-empty-t">{filtro === "novas" ? "Tudo lido por aqui" : "Nada aqui por enquanto"}</p>
              <button type="button" className="ntf-lnk" onClick={() => setFiltro("todas")}>Ver todas</button>
            </div>
          ) : blocos.map(([titulo, lista]) => (
            <section key={titulo} className="ntf-bloco">
              <p className="ntf-dia">{titulo}</p>
              <div className="ntf-card">
                {lista.map(n => {
                  const g = grupoDe(n);
                  const Ic = (n.tipo && ICONE_TIPO[n.tipo]) || ICONE[g] || Bell;
                  const alerta = n.tipo === "pro_atrasado";
                  return (
                    <div key={n.id} className={`ntf-item${!n.lida ? " ntf-item--nova" : ""}${n.link ? " ntf-item--link" : ""}`}
                      onClick={() => abrir(n)} role={n.link ? "button" : undefined} tabIndex={n.link ? 0 : undefined}
                      onKeyDown={e => { if (n.link && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrir(n); } }}>
                      <span className="ntf-pt" aria-label={!n.lida ? "Não lida" : undefined}>{!n.lida && <i />}</span>
                      <div className={`ntf-img ntf-img--${alerta ? "alerta" : g}`}>
                        {n.imagem_url ? <img src={n.imagem_url} alt="" /> : <Ic size={20} weight="fill" />}
                      </div>
                      <div className="ntf-content">
                        <p className="ntf-t">{n.titulo}</p>
                        {n.mensagem && <p className="ntf-msg">{n.mensagem}</p>}
                        <span className="ntf-time ntf-time--cel">{tempoRelativo(n.created_at)}</span>
                      </div>
                      <span className="ntf-time">{tempoRelativo(n.created_at)}</span>
                      {n.link && <CaretRight size={16} weight="bold" className="ntf-seta" aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </>)}
      </div>

      <style>{`
        .ntf-root { font-family: var(--font-base); padding: 16px 16px 100px; max-width: 920px; margin: 0 auto; color: var(--ui-texto); }
        .ntf-barra { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
        .ntf-filtros { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; flex: 1; min-width: 0; padding-bottom: 2px; }
        .ntf-filtros::-webkit-scrollbar { display: none; }
        .ntf-filtros button { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border: 1px solid var(--ui-borda); border-radius: 10px; background: var(--ui-branco);
          font-family: inherit; font-size: 13.5px; font-weight: 600; color: var(--ui-texto-2); white-space: nowrap; cursor: pointer; }
        .ntf-filtros button span { font-size: 12px; font-weight: 600; color: var(--ui-texto-3); }
        .ntf-filtros button.on { background: var(--ui-vinho, #2C1219); border-color: var(--ui-vinho, #2C1219); color: var(--ui-branco); }
        .ntf-filtros button.on span { color: rgba(255,255,255,.7); }
        .ntf-todas { display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 14px; border: 1px solid var(--ui-borda); border-radius: 10px; background: var(--ui-branco);
          font-family: inherit; font-size: 13.5px; font-weight: 600; color: var(--ui-texto); white-space: nowrap; cursor: pointer; }
        .ntf-todas:hover { border-color: var(--ui-rosa); color: var(--ui-rosa-escuro); }
        .ntf-so-cel { display: none; }
        .ntf-bloco { margin-top: 18px; }
        .ntf-dia { margin: 0 0 8px 4px; font-size: 13px; font-weight: 600; color: var(--ui-texto-2); }
        .ntf-card { background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); overflow: hidden; }
        .ntf-item { display: flex; align-items: center; gap: 12px; min-height: 68px; padding: 12px 16px 12px 8px; transition: background-color .12s linear; }
        .ntf-item + .ntf-item { border-top: 1px solid var(--ui-linha); }
        .ntf-item--link { cursor: pointer; }
        .ntf-item--link:hover { background: #FBF8F9; }
        .ntf-item--link:focus-visible { outline: 3px solid rgba(var(--ui-rosa-rgb), .4); outline-offset: -3px; }
        .ntf-item--nova { background: #FFF8FB; }
        .ntf-pt { flex: none; width: 8px; display: flex; justify-content: center; }
        .ntf-pt i { width: 8px; height: 8px; border-radius: 50%; background: var(--ui-rosa); }
        .ntf-img { flex: none; width: 40px; height: 40px; border-radius: 12px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .ntf-img img { width: 100%; height: 100%; object-fit: cover; }
        .ntf-img--pedido { background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); }
        .ntf-img--plano { background: #FFF4E0; color: #B45309; }
        .ntf-img--conquista { background: var(--ui-verde-fundo); color: var(--ui-verde); }
        .ntf-img--novidade { background: #EAF1FF; color: #2F5BD3; }
        .ntf-img--alerta { background: var(--ui-vermelho-fundo); color: var(--ui-vermelho); }
        .ntf-content { flex: 1; min-width: 0; }
        .ntf-t { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ntf-item--nova .ntf-t { font-weight: 700; }
        .ntf-msg { margin: 2px 0 0; font-size: 13.5px; color: var(--ui-texto-2); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .ntf-time { flex: none; align-self: flex-start; margin-top: 2px; font-size: 12.5px; color: var(--ui-texto-3); white-space: nowrap; }
        .ntf-seta { flex: none; color: var(--ui-texto-3); }
        .ntf-time--cel { display: none; }
        .ntf-loading { display: flex; justify-content: center; padding: 60px; }
        .ntf-spinner { width: 28px; height: 28px; border: 3px solid var(--primary-light); border-top-color: var(--ui-rosa); border-radius: 50%; animation: ntfSpin 0.7s linear infinite; }
        @keyframes ntfSpin { to { transform: rotate(360deg); } }
        .ntf-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 56px 24px; }
        .ntf-empty--p { padding: 32px 24px; margin-top: 18px; }
        .ntf-empty-ic { width: 64px; height: 64px; border-radius: 50%; background: var(--ui-rosa-claro); color: var(--ui-rosa); display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
        .ntf-empty-t { font-size: 15px; font-weight: 700; margin: 0 0 4px; }
        .ntf-empty-d { font-size: 13.5px; color: var(--ui-texto-2); margin: 0; line-height: 1.5; max-width: 320px; }
        .ntf-lnk { border: 0; background: none; font-family: inherit; font-size: 14px; font-weight: 700; color: var(--ui-rosa-escuro); cursor: pointer; min-height: 40px; }
        /* computador: mais respiro e a mensagem numa linha só */
        @media (min-width: 901px) {
          .ntf-root { padding: 20px 0 48px; }
          .ntf-item { padding: 14px 20px 14px 10px; gap: 14px; }
          .ntf-img { width: 44px; height: 44px; }
          .ntf-msg { -webkit-line-clamp: 1; }
          .ntf-time { align-self: center; margin-top: 0; min-width: 64px; text-align: right; }
        }
        /* celular: o "Marcar todas" fica abaixo dos filtros (no cabeçalho só aparece de 768px pra cima) */
        @media (max-width: 767px) {
          .ntf-barra { flex-direction: column; align-items: stretch; }
          .ntf-so-cel { display: flex; justify-content: flex-end; }
          .ntf-item { padding: 12px 12px 12px 6px; gap: 10px; }
          .ntf-seta { display: none; }
          /* o tempo desce pra baixo da mensagem: o título fica com a largura toda */
          .ntf-item > .ntf-time { display: none; }
          .ntf-time--cel { display: block; margin-top: 3px; }
          .ntf-item { align-items: flex-start; }
          .ntf-pt { align-self: center; }
        }
      `}</style>
    </>
  );
}

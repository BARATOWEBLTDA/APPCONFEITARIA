import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { carregarNotificacoes, marcarLidas, type Notif } from "@/lib/notificacoesUsuario";
import { Bell, Checks, Clock, Crown, Newspaper, ShoppingBag, Trophy, WarningCircle } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tag?: string;
  imagem_url?: string;
  created_at: string;
}

const LS_KEY = "notif_last_seen";

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  if (hrs < 24) return `${hrs}h`;
  if (days === 1) return "ontem";
  if (days < 7) return `${days}d`;
  const semanas = Math.floor(days / 7);
  if (semanas < 4) return `${semanas} sem`;
  const meses = Math.floor(days / 30);
  if (meses < 12) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  return `${Math.floor(days / 365)} anos`;
}

export default function Notificacoes() {
  const navigate = useNavigate();
  const [notificacoes, setNotificacoes] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const recarregar = async () => { setNotificacoes(await carregarNotificacoes()); setLoading(false); };
  useEffect(() => { recarregar(); }, []);

  const naoLidas = notificacoes.filter(n => !n.lida);
  const ICONE: Record<string, typeof Bell> = { pedido: ShoppingBag, pro: Crown, pro_vencendo: Clock, pro_atrasado: WarningCircle, conquista: Trophy, noticia: Newspaper };

  const abrir = async (n: Notif) => {
    if (!n.lida) { setNotificacoes(l => l.map(x => x.id === n.id ? { ...x, lida: true } : x)); marcarLidas([n.id]); }
    if (n.link) navigate(n.link);
  };
  const todas = () => { const ids = naoLidas.map(n => n.id); setNotificacoes(l => l.map(x => ({ ...x, lida: true }))); marcarLidas(ids); };

  return (
    <>
      <AppPageHeader
        title="Notificações"
        subtitle={naoLidas.length > 0 ? `${naoLidas.length} nova${naoLidas.length > 1 ? "s" : ""}` : "Todas lidas"}
        infoIcon="🔔"
        infoContent="Aqui ficam seus pedidos novos, avisos do seu plano, conquistas e as novidades do Doonly."
      />

      <div className="ntf-root">
        {naoLidas.length > 0 && (
          <div className="ntf-topo"><button type="button" className="ntf-todas" onClick={todas}><Checks size={18} weight="bold" /> Marcar todas como lidas</button></div>
        )}
        {loading ? (
          <div className="ntf-loading"><span className="ntf-spinner" /></div>
        ) : notificacoes.length === 0 ? (
          <div className="ntf-empty">
            <div className="ntf-empty-ic"><Bell size={30} weight="regular" /></div>
            <p className="ntf-empty-t">Nenhuma notificação ainda</p>
            <p className="ntf-empty-d">Pedidos novos, avisos do seu plano, conquistas e novidades do Doonly aparecem aqui.</p>
          </div>
        ) : (
          <div className="ntf-list">
            {notificacoes.map(n => (
              <div key={n.id} className={`ntf-item ${!n.lida ? "ntf-item--nova" : ""}${n.link ? " ntf-item--link" : ""}`} onClick={() => abrir(n)} role={n.link ? "button" : undefined}>
                <div className="ntf-img">
                  {n.imagem_url ? <img src={n.imagem_url} alt="" /> : (n.tipo && ICONE[n.tipo]) ? <span className="ntf-emo">{(() => { const Ic = ICONE[n.tipo!]; return <Ic size={22} weight="fill" />; })()}</span> : <Bell size={22} weight="fill" />}
                </div>
                <div className="ntf-content">
                  <p className="ntf-t">{!n.lida && <span className="ntf-dot" aria-label="Não lida" />}{n.titulo}</p>
                  {n.mensagem && <p className="ntf-msg">{n.mensagem}</p>}
                  <span className="ntf-time"><Clock size={11} weight="regular" /> {tempoRelativo(n.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .ntf-topo { display: flex; justify-content: flex-end; margin-bottom: 10px; }
        .ntf-todas { border: 1px solid #EAE3E6; background: #fff; border-radius: 8px; padding: 8px 12px; font-family: inherit; font-size: 12.5px; font-weight: 700; color: #4B3A42; cursor: pointer; }
        .ntf-item--link { cursor: pointer; }
        .ntf-emo { font-size: 22px; }
        .ntf-acoes { margin-left: auto; display: flex; align-items: center; gap: 4px; }
        .ntf-ac { border: none; background: none; font-family: inherit; font-size: 13px; font-weight: 700; color: #C33A6E; cursor: pointer; padding: 4px 6px; border-radius: 6px; }
        .ntf-ac--x { color: #B5AAB0; display: flex; align-items: center; } .ntf-ac--x:hover { color: #DC2626; background: #FEF2F2; }
        .ntf-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .ntf-t { display: flex !important; align-items: center; gap: 7px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 14px !important; margin: 0 !important; }
        .ntf-t { display: block !important; }
        .ntf-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #E85A8C; margin-right: 7px; vertical-align: 1px; }
        .ntf-msg { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin: 0 !important; font-size: 13px !important; }
        .ntf-time { margin-top: 2px; }
        .ntf-root { font-family: 'Geist', sans-serif; padding: 16px 16px 100px; max-width: 800px; margin: 0 auto; }
        .ntf-list { display: flex; flex-direction: column; gap: 10px; }
        .ntf-item {
          display: flex; gap: 12px; align-items: flex-start;
          padding: 14px;
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 10px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          position: relative;
          transition: all 0.15s;
        }
        .ntf-item--nova {
          background: linear-gradient(to right, #FFF5F9, #fff 60%);
          border-color: #FCE0E9;
        }
        .ntf-img {
          width: 44px; height: 44px;
          border-radius: 8px;
          background: #F5F0F2;
          color: #E85A8C;
          flex-shrink: 0;
          overflow: hidden;
          display: flex; align-items: center; justify-content: center;
        }
        .ntf-img img { width: 100%; height: 100%; object-fit: cover; }
        .ntf-content { flex: 1; min-width: 0; }
        .ntf-row { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
        .ntf-t { font-size: 13.5px; font-weight: 800; color: #2C1219; margin: 0; line-height: 1.3; flex: 1; min-width: 0; }
        .ntf-badge {
          background: #E85A8C; color: #fff;
          font-size: 12px; font-weight: 900; letter-spacing: 0.05em;
          padding: 2px 7px; border-radius: 4px;
          text-transform: uppercase; flex-shrink: 0;
        }
        .ntf-msg { font-size: 12.5px; color: #6B7280; margin: 0 0 6px; line-height: 1.45; }
        .ntf-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .ntf-tag { font-size: 12px; font-weight: 700; padding: 2px 8px; background: #F5F0F2; color: #4B5563; border-radius: 3px; text-transform: capitalize; }
        .ntf-time { font-size: 12px; color: #9CA3AF; display: flex; align-items: center; gap: 3px; }
        .ntf-loading { display: flex; justify-content: center; padding: 60px; }
        .ntf-spinner { width: 28px; height: 28px; border: 3px solid #FCE0E9; border-top-color: #E85A8C; border-radius: 50%; animation: ntfSpin 0.7s linear infinite; }
        @keyframes ntfSpin { to { transform: rotate(360deg); } }
        .ntf-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60px 24px; }
        .ntf-empty-ic { width: 64px; height: 64px; border-radius: 50%; background: #FFF5F9; color: #E85A8C; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
        .ntf-empty-t { font-size: 14.5px; font-weight: 800; color: #2C1219; margin: 0 0 4px; }
        .ntf-empty-d { font-size: 12.5px; color: #6B7280; margin: 0; line-height: 1.5; max-width: 280px; }
      `}</style>
    </>
  );
}

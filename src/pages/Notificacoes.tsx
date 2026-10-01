import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { carregarNotificacoes, marcarLidas, excluirNotificacao, type Notif } from "@/lib/notificacoesUsuario";
import { Bell, Clock } from "@phosphor-icons/react";
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
  const ICONE: Record<string, string> = { pedido: "🛍️", pro: "👑", pro_vencendo: "⏰", pro_atrasado: "⚠️", conquista: "🏆", noticia: "📰" };

  const abrir = async (n: Notif) => {
    if (!n.lida) { setNotificacoes(l => l.map(x => x.id === n.id ? { ...x, lida: true } : x)); marcarLidas([n.id]); }
    if (n.link) navigate(n.link);
  };
  const lida = (n: Notif) => { setNotificacoes(l => l.map(x => x.id === n.id ? { ...x, lida: true } : x)); marcarLidas([n.id]); };
  const excluir = (n: Notif) => { setNotificacoes(l => l.filter(x => x.id !== n.id)); excluirNotificacao(n.id); };
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
          <div className="ntf-topo"><button type="button" className="ntf-todas" onClick={todas}>✓ Marcar todas como lidas</button></div>
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
                  {n.imagem_url ? <img src={n.imagem_url} alt="" /> : (n.tipo && ICONE[n.tipo]) ? <span className="ntf-emo">{ICONE[n.tipo!]}</span> : <Bell size={22} weight="fill" />}
                </div>
                <div className="ntf-content">
                  <div className="ntf-row">
                    <p className="ntf-t">{n.titulo}</p>
                    {!n.lida && <span className="ntf-badge">Novo</span>}
                  </div>
                  {n.mensagem && <p className="ntf-msg">{n.mensagem}</p>}
                  <div className="ntf-meta">
                    {n.tag && <span className="ntf-tag">{n.tag}</span>}
                    <span className="ntf-time"><Clock size={11} weight="regular" /> {tempoRelativo(n.created_at)}</span>
                    <span className="ntf-acoes" onClick={e => e.stopPropagation()}>
                      {!n.lida && <button type="button" className="ntf-ac" onClick={() => lida(n)}>Marcar como lida</button>}
                      <button type="button" className="ntf-ac ntf-ac--x" onClick={() => excluir(n)} aria-label="Excluir notificação">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                      </button>
                    </span>
                  </div>
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
        .ntf-ac { border: none; background: none; font-family: inherit; font-size: 11.5px; font-weight: 700; color: #C33A6E; cursor: pointer; padding: 4px 6px; border-radius: 6px; }
        .ntf-ac--x { color: #B5AAB0; display: flex; align-items: center; } .ntf-ac--x:hover { color: #DC2626; background: #FEF2F2; }
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
          font-size: 9.5px; font-weight: 900; letter-spacing: 0.05em;
          padding: 2px 7px; border-radius: 4px;
          text-transform: uppercase; flex-shrink: 0;
        }
        .ntf-msg { font-size: 12.5px; color: #6B7280; margin: 0 0 6px; line-height: 1.45; }
        .ntf-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .ntf-tag { font-size: 10px; font-weight: 700; padding: 2px 8px; background: #F5F0F2; color: #4B5563; border-radius: 3px; text-transform: capitalize; }
        .ntf-time { font-size: 11px; color: #9CA3AF; display: flex; align-items: center; gap: 3px; }
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

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
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
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSeen, setLastSeen] = useState<number>(() => {
    const v = localStorage.getItem(LS_KEY);
    return v ? parseInt(v, 10) : 0;
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("notificacoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setNotificacoes((data as Notificacao[]) || []);
      setLoading(false);
      const now = Date.now();
      localStorage.setItem(LS_KEY, String(now));
      setTimeout(() => setLastSeen(now), 3000);
    })();
  }, []);

  const naoLidasCount = notificacoes.filter(n => new Date(n.created_at).getTime() > lastSeen).length;

  return (
    <>
      <AppPageHeader
        title="Notificações"
        subtitle={naoLidasCount > 0 ? `${naoLidasCount} nova${naoLidasCount > 1 ? "s" : ""}` : "Todas atualizadas"}
        infoIcon="🔔"
        infoContent="Aqui você vê todas as notificações enviadas pelo Doonly — dicas, novidades, atualizações e avisos importantes."
      />

      <div className="ntf-root">
        {loading ? (
          <div className="ntf-loading"><span className="ntf-spinner" /></div>
        ) : notificacoes.length === 0 ? (
          <div className="ntf-empty">
            <div className="ntf-empty-ic"><Bell size={30} weight="regular" /></div>
            <p className="ntf-empty-t">Nenhuma notificação ainda</p>
            <p className="ntf-empty-d">As novidades, avisos e atualizações do Doonly aparecerão aqui assim que forem enviadas.</p>
          </div>
        ) : (
          <div className="ntf-list">
            {notificacoes.map(n => {
              const isNova = new Date(n.created_at).getTime() > lastSeen;
              return (
                <div key={n.id} className={`ntf-item ${isNova ? "ntf-item--nova" : ""}`}>
                  <div className="ntf-img">
                    {n.imagem_url ? (
                      <img src={n.imagem_url} alt="" />
                    ) : (
                      <Bell size={22} weight="fill" />
                    )}
                  </div>
                  <div className="ntf-content">
                    <div className="ntf-row">
                      <p className="ntf-t">{n.titulo}</p>
                      {isNova && <span className="ntf-badge">Novo</span>}
                    </div>
                    {n.mensagem && <p className="ntf-msg">{n.mensagem}</p>}
                    <div className="ntf-meta">
                      {n.tag && <span className="ntf-tag">{n.tag}</span>}
                      <span className="ntf-time"><Clock size={11} weight="regular" /> {tempoRelativo(n.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
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

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tag?: string;
  imagem_url?: string;
  created_at: string;
}

export default function Notificacoes() {
  const navigate = useNavigate();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("notificacoes")
        .select("*")
        .order("created_at", { ascending: false });
      setNotificacoes(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const formatData = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 60) return `${mins}min atrás`;
    if (hrs < 24) return `${hrs}h atrás`;
    return `${days}d atrás`;
  };

  return (
    <div className="ntf-root">


      {/* Lista */}
      <div className="ntf-list">
        {loading ? (
          <div className="ntf-loading"><span className="ntf-spinner" /></div>
        ) : notificacoes.length === 0 ? (
          <div className="ntf-empty">
            <div className="ntf-empty-icon">🔔</div>
            <p>Nenhuma notificação ainda</p>
            <span>As novidades aparecerão aqui</span>
          </div>
        ) : notificacoes.map(n => (
          <div key={n.id} className="ntf-item">
            <div className="ntf-img">
              {n.imagem_url ? <img src={n.imagem_url} alt={n.titulo} /> : <span>🔔</span>}
            </div>
            <div className="ntf-content">
              <p className="ntf-item-title">{n.titulo}</p>
              {n.mensagem && <p className="ntf-item-msg">{n.mensagem}</p>}
              <div className="ntf-item-footer">
                {n.tag && <span className="ntf-tag">{n.tag}</span>}
                <span className="ntf-time">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {formatData(n.created_at)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .ntf-root { font-family: 'Geist', sans-serif; min-height: 100vh; background: #f9fafb; }



        .ntf-list { display: flex; flex-direction: column; gap: 0.75rem; padding: 0.75rem; }

        .ntf-item {
          display: flex; gap: 0.9rem; align-items: flex-start;
          padding: 1rem;
          background: white;
          border-radius: 14px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.07);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .ntf-item:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.1); }

        .ntf-img {
          width: 68px; height: 68px; border-radius: 10px;
          background: #f3f4f6; flex-shrink: 0;
          overflow: hidden; display: flex; align-items: center;
          justify-content: center; font-size: 1.8rem;
        }
        .ntf-img img { width: 100%; height: 100%; object-fit: cover; }

        .ntf-content { flex: 1; min-width: 0; }
        .ntf-item-title { font-size: 0.88rem; font-weight: 700; color: #1f2937; margin: 0 0 0.2rem; line-height: 1.4; }
        .ntf-item-msg { font-size: 0.8rem; color: #6b7280; margin: 0 0 0.3rem; line-height: 1.4; }
        .ntf-item-footer { display: flex; align-items: center; gap: 0.5rem; }
        .ntf-tag { font-size: 0.75rem; font-weight: 600; color: #f9007a; }
        .ntf-time { font-size: 0.72rem; color: #9ca3af; display: flex; align-items: center; gap: 0.2rem; }

        .ntf-loading { display: flex; justify-content: center; padding: 4rem; }
        .ntf-spinner { width: 28px; height: 28px; border: 3px solid #fce7f3; border-top-color: #f9007a; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .ntf-empty { text-align: center; padding: 4rem 2rem; }
        .ntf-empty-icon { font-size: 3rem; margin-bottom: 1rem; }
        .ntf-empty p { font-size: 1rem; font-weight: 600; color: #1f2937; margin: 0 0 0.4rem; }
        .ntf-empty span { font-size: 0.85rem; color: #9ca3af; }
      `}</style>
    </div>
  );
}

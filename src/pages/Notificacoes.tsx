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
      {/* Título da página */}
      <div className="ntf-page-header">
        <button className="ntf-back" onClick={() => navigate(-1)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="ntf-title">Notificações</h1>
        <div style={{width: "32px"}} />
      </div>

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
                <span className="ntf-time">{formatData(n.created_at)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .ntf-root { font-family: 'Inter', sans-serif; min-height: 100vh; background: #f9fafb; }

        .ntf-page-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.75rem 1rem;
          background: white;
          border-bottom: 1px solid #f3f4f6;
          margin-bottom: 0.5rem;
        }
        .ntf-back {
          background: none; border: none; cursor: pointer;
          display: flex; align-items: center; color: #1f2937;
          padding: 0.25rem;
        }
        .ntf-title { font-size: 1rem; font-weight: 700; color: #1f2937; margin: 0; }

        .ntf-list { display: flex; flex-direction: column; }

        .ntf-item {
          display: flex; gap: 0.9rem; align-items: flex-start;
          padding: 1rem 1.25rem;
          background: white;
          border-bottom: 1px solid #f3f4f6;
        }
        .ntf-item:hover { background: #fff0f6; }

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
        .ntf-time { font-size: 0.72rem; color: #9ca3af; }

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

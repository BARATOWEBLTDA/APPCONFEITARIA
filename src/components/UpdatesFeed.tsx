import { useEffect, useState } from "react";
import { Newspaper } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";

interface Noticia {
  id: string;
  emoji: string;
  titulo: string;
  descricao: string;
  categoria: string | null;
  created_at: string;
}

// Formata data em "há X dias / horas / min"
function tempoRelativo(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffDias = Math.floor(diffH / 24);
  const diffSem = Math.floor(diffDias / 7);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffH < 24) return `há ${diffH}h`;
  if (diffDias === 1) return "ontem";
  if (diffDias < 7) return `há ${diffDias} dias`;
  if (diffSem === 1) return "há 1 semana";
  if (diffSem < 4) return `há ${diffSem} semanas`;
  const meses = Math.floor(diffDias / 30);
  if (meses < 12) return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(diffDias / 365);
  return `há ${anos} ${anos === 1 ? "ano" : "anos"}`;
}

export default function UpdatesFeed() {
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("admin_noticias")
        .select("id, emoji, titulo, descricao, categoria, created_at")
        .eq("ativo", true)
        .order("ordem", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(3);
      if (data) setNoticias(data as Noticia[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return null;
  if (noticias.length === 0) return null;

  return (
    <div className="uf-root">
      <div className="uf-header">
        <Newspaper size={18} weight="fill" />
        <h2>Notícias</h2>
      </div>

      <div className="uf-list">
        {noticias.map((n) => (
          <div key={n.id} className="uf-item">
            <div className="uf-emoji">{n.emoji}</div>
            <div className="uf-body">
              {n.categoria && <span className="uf-cat">{n.categoria}</span>}
              <p className="uf-title">{n.titulo}</p>
              <p className="uf-desc">{n.descricao}</p>
              <span className="uf-time">{tempoRelativo(n.created_at)}</span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .uf-root {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .uf-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1.15rem 1.25rem;
          color: var(--text-title);
        }
        .uf-header h2 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: var(--fw-bold);
        }
        .uf-list { display: flex; flex-direction: column; }
        .uf-item {
          display: flex;
          gap: 0.75rem;
          padding: 0.9rem 1.25rem;
          transition: background var(--dur-fast);
          border-top: 1px solid var(--border);
        }
        .uf-item:hover { background: var(--bg-body); }
        .uf-emoji {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          background: #FFF5F9;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 20px;
        }
        .uf-body { flex: 1; min-width: 0; }
        .uf-cat {
          display: inline-block;
          font-size: 9.5px;
          font-weight: 800;
          padding: 2px 6px;
          background: #FCE7F3;
          color: #C33A6E;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }
        .uf-title {
          margin: 0;
          font-size: 0.82rem;
          font-weight: var(--fw-semibold);
          color: var(--text-title);
          line-height: 1.3;
        }
        .uf-desc {
          margin: 3px 0 0;
          font-size: 0.78rem;
          color: var(--text-secondary);
          line-height: 1.45;
        }
        .uf-time {
          font-size: 0.7rem;
          color: var(--text-muted);
          margin-top: 4px;
          display: block;
        }
      `}</style>
    </div>
  );
}

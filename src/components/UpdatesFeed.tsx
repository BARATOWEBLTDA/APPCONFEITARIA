import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Newspaper, CaretRight, PushPin } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";

interface Noticia {
  id: string;
  emoji: string;
  titulo: string;
  descricao: string;
  imagem_capa: string | null;
  slug: string;
  categoria: string | null;
  tempo_leitura: number | null;
  publicado_em: string;
  fixada: boolean;
}

function tempoRelativo(iso: string): string {
  const d = new Date(iso);
  const diffDias = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDias === 0) return "hoje";
  if (diffDias === 1) return "ontem";
  if (diffDias < 7) return `há ${diffDias} dias`;
  const semanas = Math.floor(diffDias / 7);
  if (semanas < 4) return `há ${semanas} sem`;
  const meses = Math.floor(diffDias / 30);
  if (meses < 12) return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
  return `há ${Math.floor(diffDias / 365)} anos`;
}

export default function UpdatesFeed() {
  const navigate = useNavigate();
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // 1) Busca a notícia fixada (se houver — limite 1 no banco)
      const { data: fixadaData } = await supabase
        .from("admin_noticias")
        .select("id, emoji, titulo, descricao, imagem_capa, slug, categoria, tempo_leitura, publicado_em, fixada")
        .eq("ativo", true)
        .eq("fixada", true)
        .limit(1);

      const fixada = (fixadaData?.[0] as Noticia | undefined) || null;

      // 2) Busca as recentes NÃO fixadas (até 2 se tem fixada, até 3 se não tem)
      const limiteRecentes = fixada ? 2 : 3;
      const { data: recentesData } = await supabase
        .from("admin_noticias")
        .select("id, emoji, titulo, descricao, imagem_capa, slug, categoria, tempo_leitura, publicado_em, fixada")
        .eq("ativo", true)
        .eq("fixada", false)
        .order("ordem", { ascending: false })
        .order("publicado_em", { ascending: false })
        .limit(limiteRecentes);

      const recentes = (recentesData || []) as Noticia[];
      const lista = fixada ? [fixada, ...recentes] : recentes;

      setNoticias(lista);
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
          <button key={n.id} className={`uf-item ${n.fixada ? "uf-item--fix" : ""}`} onClick={() => navigate(`/noticias/${n.slug}`)}>
            <div className="uf-capa" style={n.imagem_capa ? { backgroundImage: `url(${n.imagem_capa})` } : undefined}>
              {!n.imagem_capa && <span className="uf-capa-emoji">{n.emoji}</span>}
              {n.fixada && (
                <span className="uf-pin" title="Fixada">
                  <PushPin size={10} weight="fill" />
                </span>
              )}
            </div>
            <div className="uf-body">
              <div className="uf-tags">
                {n.fixada && <span className="uf-fix-tag">📌 Fixada</span>}
                {n.categoria && <span className="uf-cat">{n.categoria}</span>}
              </div>
              <p className="uf-title">{n.titulo}</p>
              <p className="uf-meta">
                {tempoRelativo(n.publicado_em)}
                {n.tempo_leitura && ` · ${n.tempo_leitura} min`}
              </p>
            </div>
            <CaretRight size={14} weight="bold" className="uf-arr" />
          </button>
        ))}
      </div>
      <button className="uf-ver-todas" onClick={() => navigate("/noticias")}>
        Ver todas as notícias <CaretRight size={12} weight="bold" />
      </button>
      <style>{`
        .uf-root {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .uf-header {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 1.15rem 1.25rem;
          color: var(--text-title);
        }
        .uf-header h2 { margin: 0; font-size: 0.95rem; font-weight: var(--fw-bold); }
        .uf-list { display: flex; flex-direction: column; }
        .uf-item {
          display: flex; gap: 12px;
          padding: 0.9rem 1.25rem;
          background: transparent;
          border: none;
          border-top: 1px solid var(--border);
          font-family: inherit;
          text-align: left;
          cursor: pointer;
          transition: background var(--dur-fast);
          width: 100%;
          position: relative;
        }
        .uf-item:hover { background: var(--bg-body); }
        .uf-item--fix { background: linear-gradient(to right, #FEF9E7, transparent 60%); }
        .uf-item--fix:hover { background: linear-gradient(to right, #FEF3C7, var(--bg-body) 60%); }
        .uf-capa {
          position: relative;
          width: 62px; height: 62px;
          flex-shrink: 0;
          background: linear-gradient(135deg, #FCE0E9, #E85A8C);
          background-size: cover; background-position: center;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
        }
        .uf-capa-emoji { font-size: 26px; }
        .uf-pin {
          position: absolute;
          top: -6px; right: -6px;
          width: 20px; height: 20px;
          background: #F59E0B;
          color: #fff;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid var(--bg-card);
          box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        }
        .uf-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .uf-tags { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
        .uf-cat {
          font-size: 9px; font-weight: 800;
          padding: 2px 6px;
          background: #FCE7F3; color: #C33A6E;
          border-radius: 4px;
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        .uf-fix-tag {
          font-size: 9px; font-weight: 800;
          padding: 2px 6px;
          background: #FEF3C7; color: #B45309;
          border-radius: 4px;
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        .uf-title {
          margin: 0;
          font-size: 0.82rem;
          font-weight: var(--fw-semibold);
          color: var(--text-title);
          line-height: 1.3;
          overflow: hidden; text-overflow: ellipsis;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }
        .uf-meta {
          margin: auto 0 0;
          font-size: 10.5px;
          color: var(--text-muted);
        }
        .uf-arr {
          align-self: center;
          color: #C0B3B8;
          flex-shrink: 0;
        }
        .uf-ver-todas {
          display: flex; align-items: center; justify-content: center; gap: 4px;
          width: 100%;
          padding: 12px;
          background: transparent;
          border: none;
          border-top: 1px solid var(--border);
          color: #C33A6E;
          font-size: 12px; font-weight: 800;
          cursor: pointer;
          font-family: inherit;
        }
        .uf-ver-todas:hover { background: #FFF5F9; }
      `}</style>
    </div>
  );
}

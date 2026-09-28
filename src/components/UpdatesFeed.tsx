import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Newspaper, CaretRight, Megaphone } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";

interface Noticia {
  id: string;
  emoji: string;
  titulo: string;
  descricao: string;
  imagem_capa: string | null;
  icone_url: string | null;
  slug: string;
  categoria: string | null;
  tempo_leitura: number | null;
  publicado_em: string;
  fixada: boolean;
}

export default function UpdatesFeed() {
  const navigate = useNavigate();
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: fixadaData } = await supabase
        .from("admin_noticias")
        .select("id, emoji, titulo, descricao, imagem_capa, icone_url, slug, categoria, tempo_leitura, publicado_em, fixada")
        .eq("ativo", true)
        .eq("fixada", true)
        .limit(1);

      const fixada = (fixadaData?.[0] as Noticia | undefined) || null;

      const limiteRecentes = fixada ? 2 : 3;
      const { data: recentesData } = await supabase
        .from("admin_noticias")
        .select("id, emoji, titulo, descricao, imagem_capa, icone_url, slug, categoria, tempo_leitura, publicado_em, fixada")
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

  const header = (
    <div className="uf-header">
      <Megaphone size={20} weight="fill" className="uf-header-ic" />
      <h2>Notícias</h2>
      <button className="uf-ver-todas" onClick={() => navigate("/noticias")}>
        Ver todas <CaretRight size={11} weight="bold" />
      </button>
    </div>
  );

  return (
    <div className="uf-root">
      {header}
      {noticias.length === 0 ? (
        <div className="uf-empty">
          <div className="uf-empty-ic"><Newspaper size={26} weight="regular" /></div>
          <p className="uf-empty-t">Sem notícias por aqui ainda</p>
          <p className="uf-empty-d">Em breve traremos dicas, novidades e tutoriais pra te ajudar a vender mais.</p>
        </div>
      ) : (
        <div className="uf-list">
          {noticias.map((n) => (
            <button key={n.id} className="uf-item" onClick={() => navigate(`/noticias/${n.slug}`)}>
              <div className="uf-capa" style={n.icone_url ? { backgroundImage: `url(${n.icone_url})` } : undefined}>
                {!n.icone_url && <span className="uf-capa-emoji">{n.emoji}</span>}
              </div>
              <div className="uf-body">
                {n.categoria && <span className="uf-cat">{n.categoria}</span>}
                <p className="uf-title">{n.titulo}</p>
                {n.descricao && <p className="uf-desc">{n.descricao}</p>}
              </div>
              <CaretRight size={13} weight="bold" className="uf-arr" />
            </button>
          ))}
        </div>
      )}
      <style>{`
        .uf-root {
          background: #fff;
          border: 1px solid #F4E9EC;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 4px 14px rgba(60,20,35,0.04);
        }
        .uf-header {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px 11px 18px;
          border-bottom: 1px solid #F3ECEE;
        }
        .uf-header-ic { color: #8C132F; flex-shrink: 0; }
        .uf-header h2 {
          flex: 1; margin: 0;
          font-size: 14.5px; font-weight: 800;
          color: #2C1219;
        }
        .uf-ver-todas {
          display: flex; align-items: center; gap: 6px;
          padding: 0; background: none; border: none;
          font-family: inherit; font-size: 12.5px; font-weight: 400;
          color: #6E5A66;
          cursor: pointer;
        }
        .uf-list { display: flex; flex-direction: column; }
        .uf-item {
          display: flex; align-items: center; gap: 10px;
          width: 100%;
          padding: 12px 14px 14px 13px;
          background: transparent;
          border: none;
          font-family: inherit;
          text-align: left;
          cursor: pointer;
        }
        .uf-item + .uf-item { border-top: 1px solid #F3ECEE; }
        .uf-item:active { background: #FFF9FB; }
        .uf-capa {
          width: 58px; height: 58px;
          flex-shrink: 0;
          background: linear-gradient(135deg, #FCE0E9, #E85A8C);
          background-size: cover; background-position: center;
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
        }
        .uf-capa-emoji { font-size: 26px; }
        .uf-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .uf-cat {
          align-self: flex-start;
          padding: 2px 9px;
          border-radius: 9px;
          background: #FEE8EE;
          color: #E0578A;
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }
        .uf-title {
          margin: 4px 0 0;
          font-size: 13px; font-weight: 800;
          color: #2C1219;
          line-height: 1.3;
          overflow: hidden; text-overflow: ellipsis;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }
        .uf-desc {
          margin: 3px 0 0;
          font-size: 10.8px;
          color: #7C7A8E;
          line-height: 1.4;
          overflow: hidden; text-overflow: ellipsis;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }
        .uf-arr { color: #5A3A46; flex-shrink: 0; }
        .uf-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 20px 24px 24px; }
        .uf-empty-ic { width: 52px; height: 52px; border-radius: 50%; background: #FFF5F9; color: #E85A8C; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
        .uf-empty-t { font-size: 13.5px; font-weight: 800; color: #2C1219; margin: 0 0 4px; }
        .uf-empty-d { font-size: 12px; color: #6B7280; margin: 0; line-height: 1.45; max-width: 240px; }
      `}</style>
    </div>
  );
}

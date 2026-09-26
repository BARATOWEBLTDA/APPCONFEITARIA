import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { MagnifyingGlass } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";

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

export default function Noticias() {
  const navigate = useNavigate();
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoria, setCategoria] = useState<string>("todas");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("admin_noticias")
        .select("id, emoji, titulo, descricao, imagem_capa, slug, categoria, tempo_leitura, publicado_em, fixada")
        .eq("ativo", true)
        .order("fixada", { ascending: false })
        .order("publicado_em", { ascending: false });
      if (data) setNoticias(data as Noticia[]);
      setLoading(false);
    })();
  }, []);

  const categorias = ["todas", ...Array.from(new Set(noticias.map(n => n.categoria).filter(Boolean))) as string[]];

  const filtradas = noticias.filter(n => {
    const okCat = categoria === "todas" || n.categoria === categoria;
    const okBusca = !busca.trim() || n.titulo.toLowerCase().includes(busca.toLowerCase().trim()) || (n.descricao || "").toLowerCase().includes(busca.toLowerCase().trim());
    return okCat && okBusca;
  });

  return (
    <>
      <AppPageHeader
        title="Notícias"
        subtitle="Dicas, novidades e tutoriais do Doonly"
        infoIcon="📰"
        infoContent={
          <>
            <p>Aqui você encontra <strong>todas as notícias</strong> do Doonly: dicas pra vender mais, novidades do sistema, tutoriais passo a passo e avisos importantes.</p>
            <p>Notícias <strong>fixadas</strong> aparecem sempre no topo, mesmo quando publicarmos novidades. As demais rolam pelo mais recente.</p>
          </>
        }
        infoTip={<>Use as <strong>abas de categoria</strong> pra filtrar entre Dicas, Novidades, Tutoriais e mais.</>}
      />
      <div className="nl-root">

      <div className="nl-search">
        <MagnifyingGlass size={16} weight="bold" />
        <input
          type="text"
          placeholder="Buscar notícia..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {categorias.length > 1 && (
        <div className="nl-tabs">
          {categorias.map(c => (
            <button
              key={c}
              className={`nl-tab ${categoria === c ? "on" : ""}`}
              onClick={() => setCategoria(c)}
            >
              {c === "todas" ? "Todas" : c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="nl-empty">Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div className="nl-empty">
          {busca ? "Nenhuma notícia encontrada" : "Nenhuma notícia por aqui ainda"}
        </div>
      ) : (
        <div className="nl-list">
          {filtradas.map((n) => (
            <button key={n.id} className={`nl-item ${n.fixada ? "nl-item--fix" : ""}`} onClick={() => navigate(`/noticias/${n.slug}`)}>
              <div className="nl-capa" style={n.imagem_capa ? { backgroundImage: `url(${n.imagem_capa})` } : undefined}>
                {!n.imagem_capa && <span className="nl-capa-emoji">{n.emoji}</span>}
              </div>
              <div className="nl-body">
                <div className="nl-tags">
                  {n.fixada && <span className="nl-fix-tag">📌 Fixada</span>}
                  {n.categoria && <span className="nl-cat">{n.categoria}</span>}
                </div>
                <p className="nl-t">{n.titulo}</p>
                {n.descricao && <p className="nl-d">{n.descricao}</p>}
                <p className="nl-meta">
                  {tempoRelativo(n.publicado_em)}
                  {n.tempo_leitura && ` · ${n.tempo_leitura} min`}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <style>{`
        .nl-root {
          font-family: 'Geist', sans-serif;
          max-width: 720px;
          margin: 0 auto;
          padding: 16px 16px 100px;
        }

        .nl-search {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px;
          background: #F5F0F2;
          border-radius: 10px;
          margin-bottom: 14px;
          color: #6B7280;
        }
        .nl-search input {
          flex: 1;
          border: none;
          background: transparent;
          outline: none;
          font-size: 13px;
          font-family: inherit;
          color: #2C1219;
        }
        .nl-search input::placeholder { color: #9CA3AF; }

        .nl-tabs {
          display: flex; gap: 6px;
          overflow-x: auto;
          padding-bottom: 4px;
          margin-bottom: 16px;
          scrollbar-width: none;
        }
        .nl-tabs::-webkit-scrollbar { display: none; }
        .nl-tab {
          padding: 7px 14px;
          background: #F5F0F2;
          border: none;
          border-radius: 20px;
          font-size: 12px; font-weight: 700;
          color: #6B7280;
          cursor: pointer;
          white-space: nowrap;
          font-family: inherit;
          text-transform: capitalize;
        }
        .nl-tab.on {
          background: #2C1219;
          color: #fff;
        }

        .nl-empty {
          text-align: center;
          padding: 60px 20px;
          color: #6B7280;
          font-size: 13px;
        }

        .nl-list {
          display: flex; flex-direction: column; gap: 10px;
        }
        .nl-item {
          display: flex; gap: 12px;
          padding: 12px;
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 12px;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .nl-item:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .nl-item:active { transform: scale(0.99); }
        .nl-item--fix {
          background: linear-gradient(to right, #FEF9E7, #fff 60%);
          border-color: #FDE68A;
        }
        .nl-tags { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; align-self: flex-start; }
        .nl-fix-tag {
          font-size: 9.5px; font-weight: 800;
          padding: 2px 6px;
          background: #FEF3C7; color: #B45309;
          border-radius: 4px;
          text-transform: uppercase; letter-spacing: 0.06em;
        }
        .nl-capa {
          width: 90px; height: 90px;
          flex-shrink: 0;
          background: linear-gradient(135deg, #FCE0E9, #E85A8C);
          background-size: cover;
          background-position: center;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
        }
        .nl-capa-emoji { font-size: 32px; }
        .nl-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .nl-cat {
          font-size: 9.5px; font-weight: 800;
          padding: 2px 6px;
          background: #FCE7F3; color: #C33A6E;
          border-radius: 4px;
          text-transform: uppercase; letter-spacing: 0.06em;
          align-self: flex-start;
        }
        .nl-t {
          font-size: 13.5px; font-weight: 800;
          color: #2C1219;
          margin: 0;
          line-height: 1.25;
          overflow: hidden; text-overflow: ellipsis;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }
        .nl-d {
          font-size: 11.5px;
          color: #6B7280;
          margin: 0;
          line-height: 1.4;
          overflow: hidden; text-overflow: ellipsis;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }
        .nl-meta {
          font-size: 10.5px;
          color: #9CA3AF;
          margin: auto 0 0;
        }
      `}</style>
    </div>
    </>
  );
}

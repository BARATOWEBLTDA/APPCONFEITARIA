import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { CaretLeft, ShareNetwork, Clock } from "@phosphor-icons/react";
import { RichContent } from "@/components/RichEditor";

interface Noticia {
  id: string;
  emoji: string;
  titulo: string;
  descricao: string;
  conteudo: any;
  imagem_capa: string | null;
  slug: string;
  autor: string;
  categoria: string | null;
  tempo_leitura: number | null;
  cta_texto: string | null;
  cta_url: string | null;
  publicado_em: string;
  views: number;
}

function tempoRelativo(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffDias = Math.floor(diffH / 24);
  if (diffH < 24) return `há ${diffH}h`;
  if (diffDias === 1) return "ontem";
  if (diffDias < 7) return `há ${diffDias} dias`;
  const semanas = Math.floor(diffDias / 7);
  if (semanas < 4) return `há ${semanas} ${semanas === 1 ? "semana" : "semanas"}`;
  const meses = Math.floor(diffDias / 30);
  if (meses < 12) return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
  return `há ${Math.floor(diffDias / 365)} anos`;
}

export default function NoticiaDetalhe() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [noticia, setNoticia] = useState<Noticia | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from("admin_noticias")
        .select("*")
        .eq("slug", slug)
        .eq("ativo", true)
        .single();
      if (error || !data) {
        navigate("/noticias", { replace: true });
        return;
      }
      setNoticia(data as Noticia);
      // Incrementa view (fire-and-forget)
      supabase.rpc("incrementar_view_noticia", { noticia_slug: slug }).then(() => {});
      setLoading(false);
      // Scroll pro topo
      window.scrollTo(0, 0);
    })();
  }, [slug, navigate]);

  const handleShare = async () => {
    if (!noticia) return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: noticia.titulo, text: noticia.descricao, url });
      } catch { /* usuário cancelou */ }
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copiado!");
    }
  };

  if (loading) {
    return (
      <div className="nd-loading">
        <div className="nd-spinner" />
        <style>{`
          .nd-loading { display: flex; justify-content: center; padding: 60px 20px; }
          .nd-spinner { width: 32px; height: 32px; border: 3px solid #F0EBED; border-top-color: #E85A8C; border-radius: 50%; animation: ndspin 0.7s linear infinite; }
          @keyframes ndspin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (!noticia) return null;

  return (
    <div className="nd-root">
      {/* Hero */}
      <div className="nd-hero" style={noticia.imagem_capa ? { backgroundImage: `url(${noticia.imagem_capa})` } : undefined}>
        {!noticia.imagem_capa && (
          <div className="nd-hero-emoji">{noticia.emoji}</div>
        )}
        <button className="nd-hero-btn nd-hero-btn--back" onClick={() => navigate(-1)}>
          <CaretLeft size={18} weight="bold" />
        </button>
        <button className="nd-hero-btn nd-hero-btn--share" onClick={handleShare}>
          <ShareNetwork size={16} weight="bold" />
        </button>
      </div>

      <article className="nd-article">
        <div className="nd-meta">
          {noticia.categoria && <span className="nd-cat">{noticia.categoria}</span>}
          <span className="nd-time">{tempoRelativo(noticia.publicado_em)}</span>
          {noticia.tempo_leitura && (
            <span className="nd-read"><Clock size={12} weight="bold" /> {noticia.tempo_leitura} min</span>
          )}
        </div>

        <h1 className="nd-title">
          {!noticia.imagem_capa && noticia.emoji && <span style={{ marginRight: 8 }}>{noticia.emoji}</span>}
          {noticia.titulo}
        </h1>

        <div className="nd-autor">
          <div className="nd-avatar">{(noticia.autor || "D").charAt(0).toUpperCase()}</div>
          <div className="nd-autor-info">
            <span className="nd-autor-nome">{noticia.autor || "Equipe Doonly"}</span>
            <span className="nd-autor-cargo">Time de conteúdo</span>
          </div>
        </div>

        {noticia.descricao && (
          <p className="nd-descricao">{noticia.descricao}</p>
        )}

        <div className="nd-content">
          <RichContent content={noticia.conteudo} />
        </div>

        {noticia.cta_texto && noticia.cta_url && (
          <a
            href={noticia.cta_url}
            className="nd-cta"
            onClick={(e) => {
              if (noticia.cta_url && noticia.cta_url.startsWith("/")) {
                e.preventDefault();
                navigate(noticia.cta_url);
              }
            }}
          >
            {noticia.cta_texto} →
          </a>
        )}

        <div className="nd-footer">
          <button className="nd-voltar" onClick={() => navigate("/noticias")}>
            <CaretLeft size={14} weight="bold" /> Ver todas as notícias
          </button>
        </div>
      </article>

      <style>{`
        .nd-root {
          font-family: 'Geist', sans-serif;
          max-width: 720px;
          margin: 0 auto;
          padding: 0 0 100px;
        }
        .nd-hero {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: linear-gradient(135deg, #FCE0E9 0%, #E85A8C 100%);
          background-size: cover;
          background-position: center;
          display: flex; align-items: center; justify-content: center;
        }
        .nd-hero-emoji {
          font-size: 80px;
        }
        .nd-hero-btn {
          position: absolute;
          width: 36px; height: 36px;
          background: rgba(0,0,0,0.5);
          color: #fff;
          border: none;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          backdrop-filter: blur(8px);
        }
        .nd-hero-btn--back { top: 16px; left: 16px; }
        .nd-hero-btn--share { top: 16px; right: 16px; }
        .nd-hero-btn:hover { background: rgba(0,0,0,0.7); }

        .nd-article {
          padding: 24px 20px 32px;
        }
        .nd-meta {
          display: flex; align-items: center; gap: 10px;
          font-size: 12px; color: #6B7280;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }
        .nd-cat {
          font-size: 11px; font-weight: 700;
          padding: 4px 10px;
          background: #F5F0F2; color: #4B5563;
          border-radius: 2px;
          letter-spacing: 0.02em;
        }
        .nd-time, .nd-read {
          display: inline-flex; align-items: center; gap: 4px;
        }
        .nd-title {
          font-family: 'Geist', sans-serif;
          font-size: 26px; font-weight: 900;
          line-height: 1.2;
          color: #2C1219;
          margin: 0 0 16px;
          letter-spacing: -0.02em;
        }
        @media (min-width: 720px) {
          .nd-title { font-size: 34px; }
        }

        .nd-autor {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 0;
          border-top: 1px solid #F5F0F2;
          border-bottom: 1px solid #F5F0F2;
          margin: 0 0 20px;
        }
        .nd-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, #E85A8C, #C33A6E);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 14px;
        }
        .nd-autor-info { display: flex; flex-direction: column; }
        .nd-autor-nome { font-size: 13px; font-weight: 700; color: #2C1219; }
        .nd-autor-cargo { font-size: 11px; color: #6B7280; }

        .nd-descricao {
          font-size: 16px;
          line-height: 1.55;
          color: #4A3439;
          margin: 0 0 24px;
          font-weight: 500;
        }
        .nd-content {
          font-size: 15px;
          line-height: 1.7;
          color: #2C1219;
        }

        .nd-cta {
          display: block;
          padding: 16px;
          background: linear-gradient(135deg, #E85A8C, #C33A6E);
          color: #fff;
          border-radius: 12px;
          text-align: center;
          text-decoration: none;
          font-weight: 800;
          font-size: 14px;
          margin: 24px 0 0;
          box-shadow: 0 4px 16px rgba(232,90,140,0.28);
          transition: transform 0.15s;
        }
        .nd-cta:active { transform: scale(0.98); }

        .nd-footer {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid #F5F0F2;
        }
        .nd-voltar {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 8px 14px;
          background: transparent;
          color: #6B7280;
          border: 1px solid #F0EBED;
          border-radius: 8px;
          font-size: 12.5px; font-weight: 700;
          cursor: pointer;
          font-family: inherit;
        }
        .nd-voltar:hover { background: #F5F0F2; color: #2C1219; }
      `}</style>
    </div>
  );
}

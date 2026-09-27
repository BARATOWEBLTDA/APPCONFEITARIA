import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { CaretLeft, Clock, Heart } from "@phosphor-icons/react";
import { RichContent } from "@/components/RichEditor";

interface AutorInfo {
  id: string;
  nome: string;
  cargo: string | null;
  foto_url: string | null;
}

interface Noticia {
  id: string;
  emoji: string;
  titulo: string;
  descricao: string;
  conteudo: any;
  imagem_capa: string | null;
  slug: string;
  autor: string;
  autor_id: string | null;
  categoria: string | null;
  tempo_leitura: number | null;
  cta_texto: string | null;
  cta_url: string | null;
  publicado_em: string;
  views: number;
  likes_base: number;
  likes_count: number;
  autor_info?: AutorInfo | null;
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
  const [liked, setLiked] = useState(false);
  const [likesTotal, setLikesTotal] = useState(0);
  const [likeAnimating, setLikeAnimating] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from("admin_noticias")
        .select("*, autor_info:autor_id (id, nome, cargo, foto_url)")
        .eq("slug", slug)
        .eq("ativo", true)
        .single();
      if (error || !data) {
        navigate("/noticias", { replace: true });
        return;
      }
      const n = data as Noticia;
      setNoticia(n);
      setLikesTotal((n.likes_base || 0) + (n.likes_count || 0));
      // Ver se usuário já curtiu
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: myLike } = await supabase.from("admin_noticias_likes").select("id").eq("noticia_id", n.id).eq("user_id", user.id).maybeSingle();
        setLiked(!!myLike);
      }
      // Incrementa view (fire-and-forget)
      supabase.rpc("incrementar_view_noticia", { noticia_slug: slug }).then(() => {});
      setLoading(false);
      window.scrollTo(0, 0);
    })();
  }, [slug, navigate]);

  const toggleLike = async () => {
    if (!noticia) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 400);
    if (liked) {
      setLiked(false);
      setLikesTotal(t => Math.max(0, t - 1));
      await supabase.from("admin_noticias_likes").delete().eq("noticia_id", noticia.id).eq("user_id", user.id);
    } else {
      setLiked(true);
      setLikesTotal(t => t + 1);
      await supabase.from("admin_noticias_likes").insert({ noticia_id: noticia.id, user_id: user.id });
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
      {/* Botão voltar flutuante */}
      <button className="nd-back-fab" onClick={() => navigate(-1)}>
        <CaretLeft size={18} weight="bold" />
      </button>

      {/* Hero em container com padding lateral igual ao body */}
      <div className="nd-hero-wrap">
        <div className="nd-hero" style={noticia.imagem_capa ? { backgroundImage: `url(${noticia.imagem_capa})` } : undefined}>
          {!noticia.imagem_capa && (
            <div className="nd-hero-emoji">{noticia.emoji}</div>
          )}
        </div>
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
          <div className="nd-avatar">
            {noticia.autor_info?.foto_url ? (
              <img src={noticia.autor_info.foto_url} alt="" />
            ) : (
              (noticia.autor_info?.nome || noticia.autor || "D").charAt(0).toUpperCase()
            )}
          </div>
          <div className="nd-autor-info">
            <span className="nd-autor-nome">{noticia.autor_info?.nome || noticia.autor || "Equipe Doonly"}</span>
            <span className="nd-autor-cargo">{noticia.autor_info?.cargo || "Time de conteúdo"}</span>
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

        <div className="nd-like-box">
          <button
            className={`nd-like-btn ${liked ? "nd-like-btn--on" : ""} ${likeAnimating ? "nd-like-btn--anim" : ""}`}
            onClick={toggleLike}
          >
            <Heart size={20} weight={liked ? "fill" : "regular"} />
            <span className="nd-like-txt">{liked ? "Você gostou" : "Gostei"}</span>
          </button>
          <p className="nd-like-count">
            {likesTotal === 0
              ? "Seja o primeiro a curtir"
              : likesTotal === 1
                ? "1 pessoa curtiu"
                : `${likesTotal.toLocaleString("pt-BR")} pessoas curtiram`}
          </p>
        </div>

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
          padding: 16px 20px 100px;
          position: relative;
        }
        .nd-back-fab {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px; height: 36px;
          background: #F5F0F2;
          color: #2C1219;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          margin-bottom: 16px;
          transition: background 0.15s;
        }
        .nd-back-fab:hover { background: #E5DDE0; }
        .nd-hero-wrap {
          margin-bottom: 20px;
        }
        .nd-hero {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: linear-gradient(135deg, #FCE0E9 0%, #E85A8C 100%);
          background-size: contain;
          background-position: center;
          background-repeat: no-repeat;
          background-color: #F5F0F2;
          border-radius: 12px;
          overflow: hidden;
          display: flex; align-items: center; justify-content: center;
        }
        .nd-hero-emoji {
          font-size: 80px;
        }

        .nd-article {
          padding: 0;
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
          overflow: hidden;
          flex-shrink: 0;
        }
        .nd-avatar img { width: 100%; height: 100%; object-fit: cover; }
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

        /* Like button */
        .nd-like-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 24px 0;
          margin-top: 24px;
          border-top: 1px solid #F5F0F2;
        }
        .nd-like-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 22px;
          background: #fff;
          border: 1.5px solid #F5D0DD;
          border-radius: 999px;
          color: #E85A8C;
          font-size: 13.5px;
          font-weight: 800;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .nd-like-btn:hover { background: #FFF5F9; border-color: #E85A8C; }
        .nd-like-btn--on { background: #FFF5F9; border-color: #E85A8C; }
        .nd-like-btn--anim { animation: ndLikePop 0.4s cubic-bezier(.5,1.5,.5,1); }
        @keyframes ndLikePop {
          0% { transform: scale(1); }
          40% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        .nd-like-txt { line-height: 1; }
        .nd-like-count {
          font-size: 12px;
          color: #6B7280;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

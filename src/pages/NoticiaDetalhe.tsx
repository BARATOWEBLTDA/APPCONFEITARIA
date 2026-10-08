import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CaretLeft, Heart, Newspaper, WarningCircle } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, TelaVazia, avisar } from "@/components/base";
import { RichContent } from "@/components/RichEditor";
import { supabase } from "@/lib/supabase";
import { linhaDeTempo } from "@/lib/noticias";
import "./noticias.css";

/**
 * Notícia aberta (07/10 · 3.10, no padrão do guia).
 * Ganhou o cabeçalho do app (com o voltar de 44px), cartão branco, título de 22px e botões padrão.
 * Sem emoji no topo nem no título. O "Gostei" desfaz sozinho se a internet falhar.
 * Notícia que não existe mais e erro de internet têm a própria tela (antes voltava pra lista sem avisar).
 */
interface AutorInfo {
  id: string;
  nome: string;
  cargo: string | null;
  foto_url: string | null;
}

interface Noticia {
  id: string;
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
  likes_base: number;
  likes_count: number;
  autor_info?: AutorInfo | null;
}

export default function NoticiaDetalhe() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [noticia, setNoticia] = useState<Noticia | null>(null);
  const [estado, setEstado] = useState<"carregando" | "erro" | "sumiu" | "pronto">("carregando");
  const [demorou, setDemorou] = useState(false);
  const [gostou, setGostou] = useState(false);
  const [total, setTotal] = useState(0);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!slug) return;
    setEstado("carregando");
    try {
      const { data, error } = await supabase
        .from("admin_noticias")
        .select("*, autor_info:autor_id (id, nome, cargo, foto_url)")
        .eq("slug", slug)
        .eq("ativo", true)
        .single();
      if ((error && (error as { code?: string }).code === "PGRST116") || (!error && !data)) { setEstado("sumiu"); return; }
      if (error) throw error;
      const n = data as Noticia;
      setNoticia(n);
      setTotal((n.likes_base || 0) + (n.likes_count || 0));
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: meu } = await supabase.from("admin_noticias_likes").select("id").eq("noticia_id", n.id).eq("user_id", user.id).maybeSingle();
        setGostou(!!meu);
      }
      // conta a leitura (não espera a resposta)
      supabase.rpc("incrementar_view_noticia", { noticia_slug: slug }).then(() => {});
      setEstado("pronto");
      window.scrollTo(0, 0);
    } catch {
      setEstado("erro");
    }
  }, [slug]);

  useEffect(() => { carregar(); }, [carregar]);

  // o "carregando" só aparece se passar de 300ms
  useEffect(() => {
    if (estado !== "carregando") { setDemorou(false); return; }
    const t = window.setTimeout(() => setDemorou(true), 300);
    return () => window.clearTimeout(t);
  }, [estado]);

  // quem abriu a notícia direto pelo link não tem pra onde "voltar": vai pra lista
  const voltar = () => {
    const temAnterior = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
    if (temAnterior) navigate(-1); else navigate("/noticias", { replace: true });
  };

  const marcar = async () => {
    if (!noticia || salvando) return;
    const era = gostou;
    setSalvando(true);
    setGostou(!era);
    setTotal(t => Math.max(0, t + (era ? -1 : 1)));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("sem usuário");
      const { error } = era
        ? await supabase.from("admin_noticias_likes").delete().eq("noticia_id", noticia.id).eq("user_id", user.id)
        : await supabase.from("admin_noticias_likes").insert({ noticia_id: noticia.id, user_id: user.id });
      if (error) throw error;
    } catch {
      setGostou(era);
      setTotal(t => Math.max(0, t + (era ? 1 : -1)));
      avisar("Não deu pra salvar. Tente de novo.", { tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  const abrirBotao = () => {
    const url = noticia?.cta_url;
    if (!url) return;
    if (url.startsWith("/")) navigate(url); else window.location.href = url;
  };

  const tempo = noticia ? linhaDeTempo(noticia.publicado_em, noticia.tempo_leitura) : "";
  const autor = noticia?.autor_info?.nome || noticia?.autor || "Equipe Doonly";

  return (
    <>
      <AppPageHeader title="Notícias" subtitle="Dicas, novidades e tutoriais do Doonly" onBack={voltar} />
      <div className="nd">
        {estado === "carregando" ? (
          demorou ? <p className="nl-carregando" role="status"><span className="ui-gira" aria-hidden="true" />Abrindo a notícia…</p> : null
        ) : estado === "erro" ? (
          <TelaVazia
            icone={<WarningCircle size={30} />}
            titulo="Não deu pra abrir a notícia"
            texto="Confira a internet e tente de novo."
            acao={<Botao variante="suave" tamanho="m" onClick={carregar}>Tentar de novo</Botao>}
          />
        ) : estado === "sumiu" || !noticia ? (
          <TelaVazia
            icone={<Newspaper size={30} />}
            titulo="Essa notícia não está mais aqui"
            texto="Ela pode ter saído do ar. As outras continuam na lista."
            acao={<Botao variante="suave" tamanho="m" onClick={() => navigate("/noticias", { replace: true })}>Ver todas as notícias</Botao>}
          />
        ) : (
          <>
            <article className="nd-cartao">
              {noticia.imagem_capa && <img className="nd-capa" src={noticia.imagem_capa} alt="" onError={e => { e.currentTarget.style.display = "none"; }} />}

              {(noticia.categoria || tempo) && (
                <p className="nd-meta">
                  {noticia.categoria && <b>{noticia.categoria}</b>}
                  {noticia.categoria && tempo && <span aria-hidden="true"> · </span>}
                  {tempo}
                </p>
              )}

              <h2 className="nd-t">{noticia.titulo}</h2>

              <div className="nd-autor">
                <span className="nd-foto" aria-hidden="true">
                  {noticia.autor_info?.foto_url ? <img src={noticia.autor_info.foto_url} alt="" /> : autor.charAt(0).toUpperCase()}
                </span>
                <span className="nd-autor-tx">
                  <b>{autor}</b>
                  <small>{noticia.autor_info?.cargo || "Time de conteúdo"}</small>
                </span>
              </div>

              {noticia.descricao && <p className="nd-resumo">{noticia.descricao}</p>}

              <div className="nd-texto">
                <RichContent content={noticia.conteudo} />
              </div>

              {noticia.cta_texto && noticia.cta_url && (
                <Botao className="nd-acao" cheio iconeDepois={<ArrowRight size={20} weight="bold" />} onClick={abrirBotao}>{noticia.cta_texto}</Botao>
              )}

              <div className="nd-gostei">
                <Botao
                  variante={gostou ? "suave" : "secundario"} tamanho="m" aria-pressed={gostou} onClick={marcar}
                  icone={<Heart size={20} weight={gostou ? "fill" : "bold"} />}
                >
                  {gostou ? "Você gostou" : "Gostei"}
                </Botao>
                {total > 0 && <p>{total === 1 ? "1 pessoa gostou" : `${total.toLocaleString("pt-BR")} pessoas gostaram`}</p>}
              </div>
            </article>

            <div className="nd-fim">
              <Botao variante="link" icone={<CaretLeft size={16} weight="bold" />} onClick={() => navigate("/noticias")}>Ver todas as notícias</Botao>
            </div>
          </>
        )}
      </div>
    </>
  );
}

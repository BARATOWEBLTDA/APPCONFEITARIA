import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MagnifyingGlass, Newspaper, PushPin, WarningCircle, X } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, BotaoIcone, TelaVazia } from "@/components/base";
import { supabase } from "@/lib/supabase";
import { linhaDeTempo, semAcento } from "@/lib/noticias";
import "./noticias.css";

/** Tira do título o nome da categoria quando ele começa igual ("Novidade: ..." com a etiqueta "Novidade" ao lado). */
function tituloSemCategoria(titulo: string, categoria: string | null): string {
  if (!categoria) return titulo;
  const sem = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const m = titulo.match(/^\s*([^:]{1,40}):\s*(.+)$/);
  if (!m) return titulo;
  const prefixo = sem(m[1]);
  const cat = sem(categoria);
  if (prefixo === cat || prefixo === cat.replace(/s$/, "") || prefixo + "s" === cat) return m[2].charAt(0).toUpperCase() + m[2].slice(1);
  return titulo;
}


/**
 * Notícias — a lista (07/10 · 3.10, no padrão do guia).
 * Busca no campo padrão (48px, letra de 16px, botão de limpar), filtros de categoria com 44px de toque,
 * cartão branco igual aos do Início, categoria e "Fixada" em texto (sem etiqueta e sem emoji).
 * Estados: carregando (só aparece se demorar), vazio, busca sem resultado e erro com "Tentar de novo".
 */
interface Noticia {
  id: string;
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

export default function Noticias() {
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [estado, setEstado] = useState<"carregando" | "erro" | "pronto">("carregando");
  const [demorou, setDemorou] = useState(false);
  const [categoria, setCategoria] = useState("todas");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    setEstado("carregando");
    try {
      const { data, error } = await supabase
        .from("admin_noticias")
        .select("id, titulo, descricao, imagem_capa, icone_url, slug, categoria, tempo_leitura, publicado_em, fixada")
        .eq("ativo", true)
        .order("fixada", { ascending: false })
        .order("publicado_em", { ascending: false });
      if (error) throw error;
      setNoticias((data || []) as Noticia[]);
      setEstado("pronto");
    } catch {
      setEstado("erro");
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // o "carregando" só aparece se passar de 300ms (não pisca em carga rápida)
  useEffect(() => {
    if (estado !== "carregando") { setDemorou(false); return; }
    const t = window.setTimeout(() => setDemorou(true), 300);
    return () => window.clearTimeout(t);
  }, [estado]);

  const categorias = useMemo(() => Array.from(new Set(noticias.map(n => n.categoria).filter(Boolean))) as string[], [noticias]);

  const filtradas = useMemo(() => {
    const q = semAcento(busca);
    return noticias.filter(n =>
      (categoria === "todas" || n.categoria === categoria) &&
      (!q || semAcento(n.titulo).includes(q) || semAcento(n.descricao).includes(q)));
  }, [noticias, categoria, busca]);

  const limpar = () => { setBusca(""); setCategoria("todas"); };
  const filtrando = !!busca.trim() || categoria !== "todas";

  return (
    <>
      <AppPageHeader
        title="Notícias"
        subtitle="Dicas, novidades e tutoriais do Doonly"
        infoIcon="📰"
        infoContent={
          <>
            <p>Aqui ficam <strong>todas as notícias</strong> do Doonly: dicas pra vender mais, novidades do app, tutoriais passo a passo e avisos importantes.</p>
            <p>A notícia <strong>fixada</strong> fica sempre no topo. As outras aparecem da mais nova pra mais antiga.</p>
          </>
        }
        infoTip={<>Escolha uma <strong>categoria</strong> pra ver só as dicas, as novidades ou os tutoriais.</>}
      />
      <div className="nl">
        {estado === "pronto" && noticias.length > 0 && (
          <div className="nl-topo">
            <div className="ui-campo-c nl-busca" onClick={e => { if (e.target === e.currentTarget) e.currentTarget.querySelector("input")?.focus(); }}>
              <span className="ui-campo-ic" aria-hidden="true"><MagnifyingGlass size={20} weight="bold" /></span>
              <input
                type="search" inputMode="search" enterKeyHint="search" autoComplete="off"
                aria-label="Buscar notícia" placeholder="Buscar notícia"
                value={busca} onChange={e => setBusca(e.target.value)}
              />
              {busca && (
                <BotaoIcone className="nl-busca-x" variante="limpo" tamanho="p" rotulo="Limpar a busca" onClick={() => setBusca("")}>
                  <X size={20} weight="bold" />
                </BotaoIcone>
              )}
            </div>

            {categorias.length > 0 && (
              <div className="nl-filtros" role="group" aria-label="Ver por categoria">
                {["todas", ...categorias].map(c => (
                  <button key={c} type="button" className="nl-filtro" aria-pressed={categoria === c} onClick={() => setCategoria(c)}>
                    {c === "todas" ? "Todas" : c}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {estado === "carregando" ? (
          demorou ? <p className="nl-carregando" role="status"><span className="ui-gira" aria-hidden="true" />Carregando as notícias…</p> : null
        ) : estado === "erro" ? (
          <TelaVazia
            icone={<WarningCircle size={30} />}
            titulo="Não deu pra carregar as notícias"
            texto="Confira a internet e tente de novo."
            acao={<Botao variante="suave" tamanho="m" onClick={carregar}>Tentar de novo</Botao>}
          />
        ) : noticias.length === 0 ? (
          <TelaVazia
            icone={<Newspaper size={30} />}
            titulo="Nenhuma notícia por enquanto"
            texto="As dicas e novidades do Doonly aparecem aqui."
          />
        ) : filtradas.length === 0 ? (
          <TelaVazia
            icone={<MagnifyingGlass size={30} />}
            titulo="Nenhuma notícia encontrada"
            texto={busca.trim() ? `Não achamos nada com “${busca.trim()}”.` : "Não tem notícia nessa categoria."}
            acao={filtrando ? <Botao variante="suave" tamanho="m" onClick={limpar}>Ver todas as notícias</Botao> : undefined}
          />
        ) : (
          <ul className="nl-lista">
            {filtradas.map(n => {
              const capa = n.icone_url || n.imagem_capa;
              const tempo = linhaDeTempo(n.publicado_em, n.tempo_leitura);
              return (
                <li key={n.id}>
                  <Link to={`/noticias/${n.slug}`} className="nl-item">
                    <span className="nl-capa" aria-hidden="true">
                      <Newspaper size={24} weight="bold" />
                      {capa && <img src={capa} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = "none"; }} />}
                    </span>
                    <span className="nl-corpo">
                      {(n.fixada || n.categoria) && (
                        <span className="nl-cat">
                          {n.fixada && <span className="nl-fixa"><PushPin size={16} weight="bold" aria-hidden="true" />Fixada</span>}
                          {n.fixada && n.categoria && <span aria-hidden="true">·</span>}
                          {n.categoria && <span>{n.categoria}</span>}
                        </span>
                      )}
                      <span className="nl-t">{tituloSemCategoria(n.titulo, n.categoria)}</span>
                      {n.descricao && <span className="nl-d">{n.descricao}</span>}
                      {tempo && <span className="nl-q">{tempo}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

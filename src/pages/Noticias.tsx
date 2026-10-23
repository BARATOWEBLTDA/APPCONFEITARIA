import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lightbulb, MagnifyingGlass, Newspaper, PushPin, WarningCircle, X } from "@phosphor-icons/react";
import { Mascote } from "@/components/marca/Mascote";
import AppPageHeader from "@/components/AppPageHeader";
import { COMO_NOVIDADES, TOUR_NOVIDADES } from "@/lib/comoTelas";
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

/** (21/10) Convites úteis no fim da lista e na tela vazia */
function Convite({ titulo, texto, botao, para, destaque }: { titulo: string; texto: string; botao: string; para: string; destaque?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className={`nl-conv${destaque ? " nl-conv--d" : ""}`}>
      <span className="nl-conv-ic" aria-hidden="true">{destaque ? <Lightbulb size={20} weight="fill" /> : <WarningCircle size={20} weight="fill" />}</span>
      <span className="nl-conv-tx"><b>{titulo}</b><small>{texto}</small></span>
      <button type="button" onClick={() => navigate(para)}>{botao}</button>
    </div>
  );
}

export default function Noticias() {
  const navigate = useNavigate();
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  // (21/10) as que ela já abriu (sem a bolinha rosa)
  const [lidas, setLidas] = useState<Set<string>>(new Set());
  useEffect(() => {
    void supabase.from("noticias_lidas").select("noticia_id").then(({ data, error }) => { if (!error && data) setLidas(new Set(data.map((x: any) => x.noticia_id))); });
  }, []);
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
        title="Novidades"
        subtitle="Dicas, novidades e tutoriais do Doonly" infoComo={COMO_NOVIDADES} infoTour={TOUR_NOVIDADES}
        infoIcon="📰"
        infoContent={
          <>
            <p>Aqui ficam <strong>todas as novidades</strong> do Doonly: dicas pra vender mais, novidades do app, tutoriais passo a passo e avisos importantes.</p>
            <p>A novidade <strong>fixada</strong> fica sempre no topo, em destaque. As outras aparecem da mais nova pra mais antiga.</p>
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
                aria-label="Buscar novidade" placeholder="Buscar novidade"
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
          demorou ? <p className="nl-carregando" role="status"><span className="ui-gira" aria-hidden="true" />Carregando as novidades…</p> : null
        ) : estado === "erro" ? (
          <TelaVazia
            icone={<WarningCircle size={30} />}
            titulo="Não deu pra carregar as novidades"
            texto="Confira a internet e tente de novo."
            acao={<Botao variante="suave" tamanho="m" onClick={carregar}>Tentar de novo</Botao>}
          />
        ) : noticias.length === 0 ? (
          /* (21/10) vazia: no computador um cartão com o mascote; embaixo, Sugerir e Relatar */
          <div className="nl-vazia">
            <div className="nl-vazia-c">
              <Mascote pose="acenando" className="nl-vazia-m" />
              <div>
                <h2>Nenhuma novidade por enquanto</h2>
                <p>As dicas pra vender mais e as novidades do Doonly aparecem aqui. A gente avisa no sininho quando sair uma nova.</p>
                <button type="button" className="nl-vazia-bt" onClick={() => navigate("/inicio")}>Voltar pro Início</button>
              </div>
            </div>
            <div className="nl-convs">
              <Convite destaque titulo="Tem uma ideia?" texto="Conta o que ajudaria você." botao="Sugerir" para="/solicitar-recurso" />
              <Convite titulo="Algo não funcionou?" texto="Conta o que aconteceu." botao="Relatar" para="/relatar-problema" />
            </div>
          </div>
        ) : filtradas.length === 0 ? (
          <TelaVazia
            icone={<MagnifyingGlass size={30} />}
            titulo="Nada encontrado"
            texto={busca.trim() ? `Não achamos nada com “${busca.trim()}”.` : "Não tem novidade nessa categoria."}
            acao={filtrando ? <Botao variante="suave" tamanho="m" onClick={limpar}>Ver todas as novidades</Botao> : undefined}
          />
        ) : (
          (() => {
            // (21/10) a fixada (sem filtro nem busca) em destaque com a capa larga; as outras em linhas compactas
            const fix = !filtrando ? filtradas.find(n => n.fixada) : undefined;
            const resto = filtradas.filter(n => n !== fix);
            return (
              <div className={`nl-grade${fix ? " nl-grade--fix" : ""}`}>
                {fix && (() => {
                  const capa = fix.imagem_capa || fix.icone_url;
                  return (
                    <Link to={`/noticias/${fix.slug}`} className="nl-fix">
                      <span className="nl-fix-capa" aria-hidden="true">{capa ? <img src={capa} alt="" onError={e => { e.currentTarget.style.display = "none"; }} /> : <Newspaper size={40} weight="bold" />}</span>
                      <span className="nl-fix-tx">
                        <span className="nl-cat"><span className="nl-fixa"><PushPin size={16} weight="bold" aria-hidden="true" />Fixada</span>{fix.categoria && <><span aria-hidden="true">·</span><span>{fix.categoria}</span></>}</span>
                        <b>{tituloSemCategoria(fix.titulo, fix.categoria)}{!lidas.has(fix.id) && <i className="nl-pt" aria-label="Não lida" />}</b>
                        {fix.descricao && <small>{fix.descricao}</small>}
                      </span>
                    </Link>
                  );
                })()}
                <div className="nl-col">
                  {resto.length > 0 && (
                    <ul className="nl-lista">
                      {resto.map(n => {
                        const capa = n.icone_url || n.imagem_capa;
                        const tempo = linhaDeTempo(n.publicado_em, n.tempo_leitura);
                        const nova = !lidas.has(n.id);
                        return (
                          <li key={n.id}>
                            <Link to={`/noticias/${n.slug}`} className={`nl-item${nova ? " nl-item--nova" : ""}`}>
                              <span className="nl-capa" aria-hidden="true">
                                <Newspaper size={20} weight="bold" />
                                {capa && <img src={capa} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = "none"; }} />}
                              </span>
                              <span className="nl-corpo">
                                <span className="nl-t">{tituloSemCategoria(n.titulo, n.categoria)}</span>
                                <span className="nl-q">{n.fixada && <><b className="nl-fixa-p">Fixada</b> · </>}{n.categoria && <><b>{n.categoria}</b>{tempo ? " · " : ""}</>}{tempo}</span>
                              </span>
                              {nova && <i className="nl-pt" aria-label="Não lida" />}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <Convite destaque titulo="Tem uma ideia?" texto="Conta o que ajudaria você." botao="Sugerir" para="/solicitar-recurso" />
                </div>
              </div>
            );
          })()
        )}
      </div>
    </>
  );
}

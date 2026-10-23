import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Checks, Lightbulb, MagnifyingGlass, Newspaper, PlayCircle, PushPin, Sparkle, WarningCircle, X } from "@phosphor-icons/react";
import { Mascote } from "@/components/marca/Mascote";
import AppPageHeader from "@/components/AppPageHeader";
import { COMO_NOVIDADES, TOUR_NOVIDADES } from "@/lib/comoTelas";
import { Botao, BotaoIcone, TelaVazia } from "@/components/base";
import { supabase } from "@/lib/supabase";
import { semAcento } from "@/lib/noticias";
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

/** (23/10) "agora", "5 min", "3 h", "2 d", "3 sem" e depois a data (como no iFood) */
function tempoCurto(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60); if (h < 24) return `${h} h`;
  const d = Math.round(h / 24); if (d < 7) return `${d} d`;
  if (d < 35) return `${Math.round(d / 7)} sem`;
  const dt = new Date(iso); return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
/** sem capa: a ilustração da categoria no quadrado rosa */
function iconeDaCategoria(c: string | null) {
  const k = semAcento(c || "");
  if (k.startsWith("dica")) return Lightbulb;
  if (k.startsWith("tutorial")) return PlayCircle;
  if (k.startsWith("novidade")) return Sparkle;
  return Newspaper;
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
  const lerTodas = async (ids: string[]) => {
    setLidas(prev => new Set([...prev, ...ids]));
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user || !ids.length) return;
    await supabase.from("noticias_lidas").upsert(ids.map(id => ({ user_id: session.user.id, noticia_id: id })), { onConflict: "user_id,noticia_id" });
    window.dispatchEvent(new CustomEvent("doonly:notif-mudou"));
  };
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
            // (23/10) no jeito do iFood: uma linha por novidade; não lida em branco, lida em cinza e apagadinha. Não dá pra apagar.
            const naoLidas = filtradas.filter(n => !lidas.has(n.id));
            return (
              <div className="nl-col">
                <div className="nl-barra">
                  <small>{naoLidas.length ? `${naoLidas.length} ${naoLidas.length === 1 ? "não lida" : "não lidas"}` : "Tudo lido"}</small>
                  {naoLidas.length > 0 && <button type="button" className="nl-ler-todas" onClick={() => void lerTodas(naoLidas.map(n => n.id))}><Checks size={18} weight="bold" aria-hidden="true" />Marcar todas como lidas</button>}
                </div>
                <ul className="nl-lista">
                  {filtradas.map(n => {
                    const capa = n.imagem_capa || n.icone_url;
                    const lida = lidas.has(n.id);
                    const Ic = iconeDaCategoria(n.categoria);
                    return (
                      <li key={n.id}>
                        <Link to={`/noticias/${n.slug}`} className={`nl-it${lida ? " nl-it--lida" : ""}`} aria-label={`${lida ? "" : "Não lida: "}${tituloSemCategoria(n.titulo, n.categoria)}`}>
                          <span className="nl-it-img" aria-hidden="true">
                            <Ic size={28} weight="duotone" />
                            {capa && <img src={capa} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = "none"; }} />}
                          </span>
                          <span className="nl-it-tx">
                            <span className="nl-it-l1"><b className="nl-it-t">{tituloSemCategoria(n.titulo, n.categoria)}</b><time dateTime={n.publicado_em}>{tempoCurto(n.publicado_em)}</time></span>
                            {n.descricao && <span className="nl-it-d">{n.descricao}</span>}
                            {(n.fixada || n.categoria) && (
                              <span className="nl-it-q">{n.fixada && <><PushPin size={13} weight="bold" aria-hidden="true" />Fixada</>}{n.fixada && n.categoria && <span>·</span>}{n.categoria}{n.tempo_leitura ? <span>· {n.tempo_leitura} min de leitura</span> : null}</span>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <Convite destaque titulo="Tem uma ideia?" texto="Conta o que ajudaria você." botao="Sugerir" para="/solicitar-recurso" />
              </div>
            );
          })()
        )}
      </div>
    </>
  );
}

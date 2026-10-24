import { useCallback, useEffect, useRef, useState } from "react";
import { useAoVoltar } from "@/hooks/useAoVoltar";
import { useNavigate } from "react-router-dom";
import { Newspaper, CaretRight } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";

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

/** (21/10) Início do computador: notícias numa linha só, na largura toda. Cabem tantas quanto a largura deixa
 *  (cartão de 240px pra cima); a fixada fica sempre na frente e as outras entram ou saem conforme o espaço. */
const CARTAO_MIN = 240, VAO = 16;

export default function UpdatesFeed({ linha = false }: { linha?: boolean }) {
  const navigate = useNavigate();
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);
  // (15/10) sem internet não vira "Nenhuma notícia": o cartão some até conseguir ler
  const [erro, setErro] = useState(false);

  // (15/10) uma busca só (antes eram 2, uma esperando a outra): a fixada vem primeiro, depois as mais recentes
  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from("admin_noticias")
      .select("id, emoji, titulo, descricao, imagem_capa, icone_url, slug, categoria, tempo_leitura, publicado_em, fixada")
      .eq("ativo", true)
      .order("fixada", { ascending: false })
      .order("ordem", { ascending: false })
      .order("publicado_em", { ascending: false })
      .limit(linha ? 8 : 3);
    if (error) { setErro(true); setLoading(false); return; }
    const todas = (data || []) as Noticia[];
    // só 1 fixada no topo (igual antes)
    const fixada = todas.find(n => n.fixada);
    setNoticias(fixada ? [fixada, ...todas.filter(n => !n.fixada)] : todas);
    setErro(false);
    setLoading(false);
  }, [linha]);
  useEffect(() => { void carregar(); }, [carregar]);
  // (21/10) quantas notícias cabem na linha
  const grade = useRef<HTMLDivElement>(null);
  const [cabem, setCabem] = useState(3);
  useEffect(() => {
    if (!linha || !grade.current) return;
    const el = grade.current;
    const medir = () => setCabem(Math.max(1, Math.floor((el.clientWidth + VAO) / (CARTAO_MIN + VAO))));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [linha, noticias.length]);
  // (15/10) ao voltar pro app, atualiza (antes ficava a notícia velha até recarregar a página)
  useAoVoltar(() => { void carregar(); });

  if (loading || erro) return null;

  // (07/10 · 3.09) Sem notícia, o cartão fica numa frase só (antes era um bloco grande vazio) e some o "Ver todas".
  // Notícia sem imagem mostra um ícone desenhado, não o emoji.
  const vazio = noticias.length === 0;
  // (21/10) sem notícia, o cartão some (no celular e no computador)
  if (vazio) return null;

  if (linha) return (
    <section className="ufl" aria-label="Novidades">
      <div className="ufl-cab">
        <h2>Novidades</h2>
        <button type="button" className="uf-ver-todas" onClick={() => navigate("/noticias")}>
          Ver todas <CaretRight size={16} weight="bold" aria-hidden="true" />
        </button>
      </div>
      <div ref={grade} className="ufl-grade" style={{ gridTemplateColumns: `repeat(${cabem}, minmax(0, 1fr))` }}>
        {noticias.slice(0, cabem).map((n) => {
          const capa = n.imagem_capa || n.icone_url;
          return (
            <button key={n.id} type="button" className="ufl-card" onClick={() => navigate(`/noticias/${n.slug}`)}>
              <span className="ufl-capa" style={capa ? { backgroundImage: `url(${capa})` } : undefined} aria-hidden="true">
                {!capa && <Newspaper size={32} weight="bold" />}
              </span>
              <span className="ufl-corpo">
                {n.categoria && <span className="uf-cat">{n.categoria}</span>}
                <b>{tituloSemCategoria(n.titulo, n.categoria)}</b>
                {n.descricao && <small>{n.descricao}</small>}
              </span>
            </button>
          );
        })}
      </div>
      <style>{CSS_LINHA}</style>
    </section>
  );

  return (
    <div className={`uf-root${vazio ? " uf-root--vazio" : ""}`}>
      <div className="uf-header">
        <h2>Novidades</h2>
        {!vazio && (
          <button type="button" className="uf-ver-todas" onClick={() => navigate("/noticias")}>
            Ver todas <CaretRight size={16} weight="bold" aria-hidden="true" />
          </button>
        )}
      </div>
      {vazio ? (
        <p className="uf-nada">Nenhuma novidade por enquanto. As dicas e novidades do Doonly aparecem aqui.</p>
      ) : (
        <div className="uf-list">
          {noticias.map((n) => (
            <button key={n.id} type="button" className="uf-item" onClick={() => navigate(`/noticias/${n.slug}`)}>
              <div className="uf-capa" style={n.icone_url ? { backgroundImage: `url(${n.icone_url})` } : undefined} aria-hidden="true">
                {!n.icone_url && <Newspaper size={24} weight="bold" />}
              </div>
              <div className="uf-body">
                {n.categoria && <span className="uf-cat">{n.categoria}</span>}
                <p className="uf-title">{tituloSemCategoria(n.titulo, n.categoria)}</p>
                {n.descricao && <p className="uf-desc">{n.descricao}</p>}
              </div>
              <CaretRight size={16} weight="bold" className="uf-arr" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <style>{`
        /* (07/10 · 3.05) no padrão do guia: letras de 12,5px para cima, "Ver todas" com toque de 44px, cores pelo themes.css */
        .uf-root { overflow: hidden; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); font-family: var(--font-base); }
        .uf-header { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 6px 8px 2px 16px; }
        .uf-root--vazio { padding-bottom: 16px; }
        .uf-nada { margin: 0; padding: 0 16px; font-size: 15px; font-weight: 500; line-height: 1.45; color: var(--ui-texto-2); }
        .uf-header h2 { flex: 1; margin: 0; font-family: var(--font-base); font-size: 16px; font-weight: 700; line-height: 1.3; color: var(--ui-texto); }
        .uf-ver-todas { display: inline-flex; align-items: center; gap: 4px; min-height: 44px; margin: 0; padding: 0 8px; background: none; border: 0; border-radius: var(--ui-raio); font-family: inherit; font-size: 13.5px; font-weight: 700; color: var(--ui-rosa-escuro); cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .uf-ver-todas:active { background: var(--ui-rosa-claro); }
        .uf-list { display: flex; flex-direction: column; }
        .uf-item { display: flex; align-items: center; gap: 12px; box-sizing: border-box; width: 100%; min-height: 64px; margin: 0; padding: 12px 16px; background: transparent; border: 0; color: var(--ui-texto); font-family: inherit; text-align: left; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .uf-item { border-top: 1px solid var(--ui-linha); }
        .uf-item:active { background: var(--ui-linha); }
        .uf-ver-todas:focus-visible, .uf-item:focus-visible { outline: 3px solid rgba(var(--ui-rosa-rgb), .45); outline-offset: -3px; }
        .uf-capa { flex: none; display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: var(--ui-raio); background: var(--ui-rosa-claro) center / cover no-repeat; color: var(--ui-rosa-escuro); }
        .uf-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .uf-cat { font-size: 12.5px; font-weight: 700; line-height: 1.3; color: var(--ui-rosa-escuro); }
        .uf-title { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin: 2px 0 0; font-size: 15px; font-weight: 600; line-height: 1.3; color: var(--ui-texto); }
        .uf-desc { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin: 2px 0 0; font-size: 12.5px; font-weight: 500; line-height: 1.4; color: var(--ui-texto-2); }
        .uf-arr { flex: none; color: var(--ui-texto-3); }
      `}</style>
    </div>
  );
}

const CSS_LINHA = `
  .ufl { padding: 16px 20px 20px; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); font-family: var(--font-base); }
  .ufl-cab { display: flex; align-items: center; justify-content: space-between; margin: 0 -8px 10px 0; }
  .ufl-cab h2 { margin: 0; font-size: 17px; font-weight: 700; color: var(--ui-texto); }
  .ufl .uf-ver-todas { display: inline-flex; align-items: center; gap: 4px; min-height: 44px; margin: 0; padding: 0 8px; background: none; border: 0; border-radius: var(--ui-raio); font-family: inherit; font-size: 13.5px; font-weight: 700; color: var(--ui-rosa-escuro); cursor: pointer; white-space: nowrap; }
  .ufl .uf-ver-todas:hover { background: var(--ui-rosa-claro); }
  .ufl .uf-cat { font-size: 12.5px; font-weight: 700; line-height: 1.3; color: var(--ui-rosa-escuro); }
  .ufl-grade { display: grid; gap: ${VAO}px; }
  .ufl-card { display: flex; flex-direction: column; min-width: 0; margin: 0; padding: 0; overflow: hidden; border: 1px solid var(--ui-linha); border-radius: 12px; background: var(--ui-branco); font-family: inherit; text-align: left; cursor: pointer; transition: box-shadow .15s, transform .15s; }
  .ufl-card:hover { box-shadow: 0 6px 16px rgba(40, 20, 25, .08); transform: translateY(-1px); }
  .ufl-card:focus-visible { outline: 3px solid rgba(var(--ui-rosa-rgb), .45); outline-offset: 2px; }
  .ufl-capa { display: flex; align-items: center; justify-content: center; height: 120px; background: var(--ui-rosa-claro) center / cover no-repeat; color: var(--ui-rosa-escuro); }
  .ufl-corpo { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px 14px; }
  .ufl-corpo b { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 15px; font-weight: 700; line-height: 1.3; color: var(--ui-texto); }
  .ufl-corpo small { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 13px; line-height: 1.4; color: var(--ui-texto-2); }
`;

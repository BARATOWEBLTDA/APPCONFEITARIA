import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppPageHeader from "@/components/AppPageHeader";

/**
 * Receitas (tela nova, aprovada 29/09 — opção A "cor do doce + desenho").
 * Abre nas CATEGORIAS (cartões com foto, ou cor + desenho) → toca → receitas da categoria.
 * Busca em tudo, atalho "Receitas salvas" e ranking "Mais curtidas" na primeira tela.
 * Ranking por curtidas. Receita em página corrida (ingredientes → modo de preparo → dicas).
 * Campos novos (receitas_v2.sql): infos, ingredientes_etapas, passos_etapas, dicas, cor, curtidas.
 * Receitas antigas (só texto) continuam funcionando: cada linha vira um item.
 */

type Etapa = { etapa: string | null; itens: string[] };
interface Categoria { id?: string; nome: string; imagem_url?: string | null; cor?: string | null; ordem?: number | null }
type Vista = { tipo: "home" } | { tipo: "categoria"; nome: string } | { tipo: "salvas" };

interface Receita {
  id: string;
  nome: string;
  categoria?: string | null;
  foto_url?: string | null;
  ingredientes?: string | null;
  modo_preparo?: string | null;
  infos?: { rotulo: string; valor: string }[] | null;
  ingredientes_etapas?: Etapa[] | null;
  passos_etapas?: Etapa[] | null;
  dicas?: string[] | null;
  cor?: string | null;
  curtidas?: number | null;
  publicada?: boolean | null;
  created_at?: string;
}

// Cor do card = cor do próprio doce
const CORES: Record<string, [string, string]> = {
  creme: ["#FBF3E4", "#8A6A2F"], chocolate: ["#EFE3DC", "#5B3524"], cacau: ["#E9DDD7", "#4A2A1E"],
  caramelo: ["#F8E6D2", "#8A4B1C"], branco: ["#F7F4EE", "#6B6254"], coco: ["#F5F1EA", "#6B5B3E"],
  amarelo: ["#FCF1CF", "#8A6A12"], rosa: ["#FCE7F3", "#9D174D"], morango: ["#FDE2E4", "#9F1239"],
  limao: ["#EEF6D8", "#4D6B12"], verde: ["#E3F4E8", "#166534"],
};
const COR_TEMA: Record<string, string> = { Recheios: "creme", Bolos: "rosa", Coberturas: "chocolate", "Doces finos": "cacau", Tortas: "limao", Salgados: "caramelo", Pudins: "caramelo", Massas: "creme", Bombons: "cacau" };
const corDe = (r: Receita): [string, string] => CORES[r.cor || ""] || CORES[COR_TEMA[r.categoria || ""] || ""] || CORES.creme;

// Desenhos de linha por tema (feitos aqui — sem imagem de terceiros)
const ICONES: Record<string, string> = {
  Recheios: "M10 18h28l-2.5 20a4 4 0 0 1-4 3.5h-15a4 4 0 0 1-4-3.5zM8 18h32M17 18c0-4 3-7 7-7s7 3 7 7M30 8l4-4",
  Bolos: "M8 40h32M10 40V26h28v14M14 26v-6h20v6M24 20v-6M24 10a2 2 0 1 0 .01 0M10 32c3 2 6 2 9 0s6-2 9 0 6 2 9 0",
  Coberturas: "M30 6l8 8-18 18-8 2 2-8zM26 10l8 8M8 40h18",
  "Doces finos": "M14 26h20l-3 14H17zM12 26h24M24 26a8 8 0 0 1-8-8c0-4 4-8 8-8s8 4 8 8a8 8 0 0 1-8 8",
  Tortas: "M6 34L24 12l18 22zM6 34v6h36v-6M14 24l20 0",
  Salgados: "M24 8c-7 8-12 16-12 23a12 12 0 0 0 24 0c0-7-5-15-12-23zM16 34h16",
  Pudins: "M13 38h22l-3.5-17h-15zM9 38h30M16.5 21c2-2.5 4.5-3.5 7.5-3.5s5.5 1 7.5 3.5M21 17.5v-3h6v3M18 27c2 1.5 4 1.5 6 0s4-1.5 6 0",
  Massas: "M10 22h28l-3 16a4 4 0 0 1-4 3H17a4 4 0 0 1-4-3zM8 22h32M30 20L38 6M34 8c3 0 5 3 4 6",
  Bombons: "M14 20h20l-2 18H16zM12 20h24M17 20c0-5 3-8 7-8s7 3 7 8M20 12l-2-4M28 12l2-4",
};
const Icone = ({ tema, size = 30 }: { tema?: string | null; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={ICONES[tema || ""] || ICONES.Recheios} />
  </svg>
);
const IcCoracao = ({ cheio = true, size = 13 }: { cheio?: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={cheio ? "currentColor" : "none"} stroke="currentColor" strokeWidth={cheio ? 0 : 2.2} aria-hidden="true">
    <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 3 4.5 6.7 4.5c2 0 3.5 1.1 4.3 2.4.8-1.3 2.3-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.3C19.5 16.4 12 21 12 21z" />
  </svg>
);
const IcSalvar = ({ cheio }: { cheio: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={cheio ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
);
const IcCompartilhar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
);

// "**3 caixas** de leite" → negrito
const Rico = ({ t }: { t: string }) => (
  <>{t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>)}</>
);
const semMarcacao = (t: string) => t.replace(/\*\*/g, "");

// Receitas antigas (só texto): cada linha vira um item; "— Etapa" vira título de etapa
function etapasDoTexto(txt?: string | null): Etapa[] {
  const out: Etapa[] = [];
  let atual: Etapa = { etapa: null, itens: [] };
  (txt || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(l => {
    const m = /^—\s*(.+)$/.exec(l);
    if (m) { if (atual.itens.length || atual.etapa) out.push(atual); atual = { etapa: m[1], itens: [] }; }
    else atual.itens.push(l.replace(/^\d+[.)]\s*/, "").replace(/^[•\-]\s*/, ""));
  });
  if (atual.itens.length || atual.etapa) out.push(atual);
  return out;
}
const ingredientesDe = (r: Receita) => (r.ingredientes_etapas?.length ? r.ingredientes_etapas : etapasDoTexto(r.ingredientes));
const passosDe = (r: Receita) => (r.passos_etapas?.length ? r.passos_etapas : etapasDoTexto(r.modo_preparo));
const nomeCurto = (n: string) => n.replace(/^Recheio (de |da |do )?/i, "");
const fmtCurtidas = (n?: number | null) => (n || 0).toLocaleString("pt-BR");

export default function ReceitasV2() {
  const [userId, setUserId] = useState<string | null>(null);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<Vista>({ tipo: "home" });
  const [busca, setBusca] = useState("");
  const [categoriasDb, setCategoriasDb] = useState<Categoria[]>([]);
  const [curti, setCurti] = useState<Set<string>>(new Set());
  const [salvas, setSalvas] = useState<Set<string>>(new Set());
  const [aberta, setAberta] = useState<Receita | null>(null);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      const [{ data: rs }, { data: cs }, { data: ss }, { data: cats }] = await Promise.all([
        supabase.from("receitas_doonly").select("*").order("created_at", { ascending: false }),
        user ? supabase.from("receitas_doonly_curtidas").select("receita_id").eq("user_id", user.id) : Promise.resolve({ data: [] as any[] }),
        user ? supabase.from("receitas_doonly_salvas").select("receita_id").eq("user_id", user.id) : Promise.resolve({ data: [] as any[] }),
        supabase.from("receitas_categorias").select("*").order("ordem", { ascending: true }),
      ]);
      setCategoriasDb((cats || []) as Categoria[]);
      setReceitas(((rs || []) as Receita[]).filter(r => r.publicada !== false));
      setCurti(new Set((cs || []).map((x: any) => x.receita_id)));
      setSalvas(new Set((ss || []).map((x: any) => x.receita_id)));
      setLoading(false);
    })();
  }, []);

  const mostrarAviso = (t: string) => { setAviso(t); window.setTimeout(() => setAviso(""), 2200); };

  // Mais curtida primeiro; empate → mais nova
  const ordenadas = useMemo(() => [...receitas].sort((a, b) =>
    (b.curtidas || 0) - (a.curtidas || 0) || String(b.created_at || "").localeCompare(String(a.created_at || ""))), [receitas]);

  // Categorias da tela inicial: as cadastradas (na ordem do admin) que têm receita,
  // mais qualquer categoria usada numa receita e ainda não cadastrada
  const categorias = useMemo(() => {
    const cont = new Map<string, number>();
    receitas.forEach(r => { const c = r.categoria || "Outras"; cont.set(c, (cont.get(c) || 0) + 1); });
    const lista: (Categoria & { qtd: number })[] = categoriasDb
      .filter(c => (cont.get(c.nome) || 0) > 0)
      .map(c => ({ ...c, qtd: cont.get(c.nome) || 0 }));
    [...cont.keys()].sort().forEach(n => { if (!lista.some(c => c.nome === n)) lista.push({ nome: n, qtd: cont.get(n) || 0 }); });
    return lista;
  }, [receitas, categoriasDb]);
  const catInfo = (nome: string) => categorias.find(c => c.nome === nome);

  const bate = (r: Receita, q: string) => {
    if (!q) return true;
    const alvo = [r.nome, r.categoria, r.ingredientes, ...ingredientesDe(r).flatMap(g => g.itens)].join(" ").toLowerCase();
    return semMarcacao(alvo).includes(q);
  };
  const q = busca.trim().toLowerCase();
  const filtradas = useMemo(() => ordenadas.filter(r => {
    if (vista.tipo === "salvas" && !salvas.has(r.id)) return false;
    if (vista.tipo === "categoria" && (r.categoria || "Outras") !== vista.nome) return false;
    return bate(r, q);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ordenadas, vista, salvas, q]);
  const top = ordenadas.filter(r => (r.curtidas || 0) > 0).slice(0, 3);
  const irPara = (v: Vista) => { setVista(v); setBusca(""); window.scrollTo(0, 0); };

  // ── Curtir / salvar (otimista: muda na tela na hora e grava no banco) ──
  const alternarCurtida = async (r: Receita) => {
    if (!userId) return;
    const ja = curti.has(r.id);
    const novo = new Set(curti); ja ? novo.delete(r.id) : novo.add(r.id); setCurti(novo);
    const delta = ja ? -1 : 1;
    const atualiza = (x: Receita) => x.id === r.id ? { ...x, curtidas: Math.max(0, (x.curtidas || 0) + delta) } : x;
    setReceitas(l => l.map(atualiza)); setAberta(a => a && a.id === r.id ? atualiza(a) : a);
    const { error } = ja
      ? await supabase.from("receitas_doonly_curtidas").delete().eq("receita_id", r.id).eq("user_id", userId)
      : await supabase.from("receitas_doonly_curtidas").insert({ receita_id: r.id, user_id: userId });
    if (error) { // desfaz se não gravou
      setCurti(curti);
      const volta = (x: Receita) => x.id === r.id ? { ...x, curtidas: Math.max(0, (x.curtidas || 0) - delta) } : x;
      setReceitas(l => l.map(volta)); setAberta(a => a && a.id === r.id ? volta(a) : a);
      mostrarAviso("Não foi possível curtir agora");
    }
  };
  const alternarSalva = async (r: Receita) => {
    if (!userId) return;
    const ja = salvas.has(r.id);
    const novo = new Set(salvas); ja ? novo.delete(r.id) : novo.add(r.id); setSalvas(novo);
    const { error } = ja
      ? await supabase.from("receitas_doonly_salvas").delete().eq("receita_id", r.id).eq("user_id", userId)
      : await supabase.from("receitas_doonly_salvas").insert({ receita_id: r.id, user_id: userId });
    if (error) { setSalvas(salvas); mostrarAviso("Não foi possível salvar agora"); }
    else mostrarAviso(ja ? "Removida das salvas" : "Salva em Receitas Salvas");
  };
  const compartilhar = async (r: Receita) => {
    const linhas = [`*${r.nome}*`, "", "*Ingredientes*"];
    ingredientesDe(r).forEach(g => { if (g.etapa) linhas.push(`_${g.etapa}_`); g.itens.forEach(i => linhas.push(`• ${semMarcacao(i)}`)); });
    linhas.push("", "*Modo de preparo*");
    passosDe(r).forEach(g => { if (g.etapa) linhas.push(`_${g.etapa}_`); g.itens.forEach((i, k) => linhas.push(`${k + 1}. ${semMarcacao(i)}`)); });
    linhas.push("", "Receita do app Doonly · doonly.com.br");
    const texto = linhas.join("\n");
    try {
      if ((navigator as any).share) { await (navigator as any).share({ title: r.nome, text: texto }); return; }
      await navigator.clipboard.writeText(texto); mostrarAviso("Receita copiada");
    } catch { /* cancelou */ }
  };

  const Card = ({ r }: { r: Receita }) => {
    const [bg, fg] = corDe(r);
    return (
      <button type="button" className="rv-card" onClick={() => { setAberta(r); window.scrollTo(0, 0); }}>
        <div className="rv-card-top" style={{ background: bg, color: fg }}>
          {r.foto_url ? <img src={r.foto_url} alt="" /> : <><Icone tema={r.categoria} /><b>{nomeCurto(r.nome)}</b></>}
        </div>
        <div className="rv-card-b">
          <span className="rv-tema">{r.categoria || "Receita"}</span>
          <span className="rv-lk"><IcCoracao /> {fmtCurtidas(r.curtidas)}</span>
        </div>
        {r.foto_url && <b className="rv-card-nome">{r.nome}</b>}
      </button>
    );
  };

  // ═══════════ Receita aberta ═══════════
  if (aberta) {
    const r = aberta; const [bg, fg] = corDe(r);
    const infos = (r.infos || []).filter(i => i?.rotulo && i?.valor);
    const colunas = infos.length === 4 ? 2 : Math.min(infos.length, 3);
    const ing = ingredientesDe(r); const passos = passosDe(r);
    let n = 0;
    return (
      <>
        <div className="rv-hero rv-sangra" style={{ background: r.foto_url ? "#000" : bg, color: fg }}>
          {r.foto_url ? <img src={r.foto_url} alt="" /> : <Icone tema={r.categoria} size={62} />}
          <button type="button" className="rv-voltar" onClick={() => setAberta(null)} aria-label="Voltar">‹</button>
        </div>
      <div className="rv-root">
        <div className="rv-det">
          <span className="rv-tema">{r.categoria || "Receita"}</span>
          <h1>{r.nome}</h1>
          <p className="rv-by">Receita Doonly</p>
          {infos.length > 0 && (
            <div className="rv-infos" style={{ gridTemplateColumns: `repeat(${colunas}, 1fr)` }}>
              {(infos || []).map((i, k) => <div key={k}><small>{i.rotulo}</small><b>{i.valor}</b></div>)}
            </div>
          )}
          <div className="rv-acoes">
            <button type="button" className={`rv-like${curti.has(r.id) ? " on" : ""}`} onClick={() => alternarCurtida(r)} aria-pressed={curti.has(r.id)}>
              <IcCoracao cheio={curti.has(r.id)} size={16} /> {fmtCurtidas(r.curtidas)}
            </button>
            <button type="button" className={`rv-ic${salvas.has(r.id) ? " on" : ""}`} onClick={() => alternarSalva(r)} aria-label="Salvar"><IcSalvar cheio={salvas.has(r.id)} /></button>
            <button type="button" className="rv-ic" onClick={() => compartilhar(r)} aria-label="Compartilhar"><IcCompartilhar /></button>
          </div>

          <h2>Ingredientes</h2>
          {ing.map((g, k) => (
            <div key={k}>
              {g.etapa && <p className="rv-etapa">{g.etapa}</p>}
              <ul className="rv-ing">{(g.itens || []).map((i, j) => <li key={j}><Rico t={i} /></li>)}</ul>
            </div>
          ))}

          <h2>Modo de preparo</h2>
          {passos.map((g, k) => {
            if (g.etapa && /^t[ée]cnica/i.test(g.etapa)) n = 0; // cada técnica recomeça do 1
            return (
              <div key={k}>
                {g.etapa && <p className="rv-etapa">{g.etapa}</p>}
                {(g.itens || []).map((i, j) => { n += 1; return (
                  <div className="rv-passo" key={j}><span className="rv-num">{n}</span><p><Rico t={i} /></p></div>
                ); })}
              </div>
            );
          })}

          {(r.dicas || []).length > 0 && (
            <div className="rv-dica"><b>💡 {r.dicas!.length > 1 ? "Dicas" : "Dica"}</b>{r.dicas!.map((d, k) => <p key={k}><Rico t={d} /></p>)}</div>
          )}
        </div>
        {aviso && <div className="rv-aviso">{aviso}</div>}
        <style>{CSS}</style>
      </div>
      </>
    );
  }

  // ═══════════ Listas ═══════════
  const grade = () => filtradas.length === 0 ? (
    <div className="rv-vazio">{vista.tipo === "salvas" && !q ? "Você ainda não salvou nenhuma receita. Toque no marcador dentro de uma receita pra guardar aqui." : "Nenhuma receita encontrada."}</div>
  ) : <div className="rv-grid">{filtradas.map(r => <Card key={r.id} r={r} />)}</div>;

  // Função (não componente) pra o campo não perder o foco a cada letra digitada
  const campoBusca = (ph: string) => (
    <div className="rv-busca">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A8A0A4" strokeWidth="2.2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
      <input value={busca} onChange={e => setBusca(e.target.value)} placeholder={ph} />
      {busca && <button type="button" className="rv-limpa" onClick={() => setBusca("")} aria-label="Limpar busca">×</button>}
    </div>
  );

  // Dentro de uma categoria ou das salvas
  if (vista.tipo !== "home") {
    const nome = vista.tipo === "categoria" ? vista.nome : "Receitas salvas";
    const info = vista.tipo === "categoria" ? catInfo(vista.nome) : undefined;
    const [bg, fg] = vista.tipo === "salvas" ? ["#F5F0F2", "#2C1219"] : (CORES[info?.cor || ""] || CORES[COR_TEMA[vista.nome] || ""] || CORES.creme);
    const total = vista.tipo === "categoria" ? (info?.qtd || 0) : salvas.size;
    return (
      <>
      <div className={`rv-cat-h rv-sangra${info?.imagem_url ? " com-foto" : ""}`} style={{ background: info?.imagem_url ? "#000" : bg, color: fg }}>
          {info?.imagem_url ? <><img src={info.imagem_url} alt="" /><span className="rv-cat-grad" /></>
            : vista.tipo === "salvas" ? <span className="rv-cat-ic"><IcSalvar cheio /></span>
            : <span className="rv-cat-ic"><Icone tema={vista.nome} size={60} /></span>}
          <button type="button" className="rv-voltar" onClick={() => irPara({ tipo: "home" })} aria-label="Voltar">‹</button>
          <div className="rv-cat-t"><b>{nome}</b><span>{total} receita{total === 1 ? "" : "s"}</span></div>
      </div>
      <div className="rv-root">
        <div className="rv-pad">
          {campoBusca(vista.tipo === "salvas" ? "Buscar nas salvas..." : `Buscar em ${nome}...`)}
          <p className="rv-sub">{q ? `${filtradas.length} receita${filtradas.length === 1 ? "" : "s"}` : "Mais curtidas primeiro"}</p>
          {grade()}
        </div>
        {aviso && <div className="rv-aviso">{aviso}</div>}
        <style>{CSS}</style>
      </div>
      </>
    );
  }

  // Tela inicial: categorias
  return (
    <>
      <AppPageHeader title="Receitas" subtitle="Escolha uma categoria" />
      <div className="rv-root">
        <div style={{ marginTop: 12 }}>{campoBusca("Buscar em todas as receitas...")}</div>
        {loading ? (
          <div className="rv-vazio">Carregando receitas...</div>
        ) : q ? (
          <>
            <p className="rv-sub">{filtradas.length} receita{filtradas.length === 1 ? "" : "s"} encontrada{filtradas.length === 1 ? "" : "s"}</p>
            {grade()}
          </>
        ) : (
          <>
            <button type="button" className="rv-salvas" onClick={() => irPara({ tipo: "salvas" })}>
              <IcSalvar cheio={salvas.size > 0} /><b>Receitas salvas</b>{salvas.size > 0 && <em>{salvas.size}</em>}<span>›</span>
            </button>
            {categorias.length === 0 ? (
              <div className="rv-vazio">Nenhuma receita por aqui ainda.</div>
            ) : (
              <div className="rv-tiles">
                {categorias.map(c => {
                  const [bg, fg] = CORES[c.cor || ""] || CORES[COR_TEMA[c.nome] || ""] || CORES.creme;
                  return (
                    <button type="button" key={c.nome} className={`rv-tile${c.imagem_url ? " com-foto" : ""}`} onClick={() => irPara({ tipo: "categoria", nome: c.nome })}
                      style={c.imagem_url ? undefined : { background: bg, color: fg }}>
                      {c.imagem_url ? <><img src={c.imagem_url} alt="" /><span className="rv-tile-grad" /></> : <span className="rv-tile-ic"><Icone tema={c.nome} size={30} /></span>}
                      <span className="rv-tile-t"><b>{c.nome}</b><small>{c.qtd} receita{c.qtd === 1 ? "" : "s"}</small></span>
                    </button>
                  );
                })}
              </div>
            )}
            {top.length > 0 && (
              <>
                <p className="rv-sec">🏆 Mais curtidas</p>
                <div className="rv-rank">
                  {top.map((r, i) => { const [bg, fg] = corDe(r); return (
                    <button type="button" key={r.id} className="rv-rk" onClick={() => { setAberta(r); window.scrollTo(0, 0); }}>
                      <span className="rv-pos">{i + 1}</span>
                      <span className="rv-rk-img" style={{ background: bg, color: fg }}>{r.foto_url ? <img src={r.foto_url} alt="" /> : <Icone tema={r.categoria} size={24} />}</span>
                      <span className="rv-rk-t"><span className="rv-tema">{r.categoria}</span><b>{r.nome}</b><span className="rv-lk"><IcCoracao /> {fmtCurtidas(r.curtidas)}</span></span>
                    </button>
                  ); })}
                </div>
              </>
            )}
          </>
        )}
      </div>
      {aviso && <div className="rv-aviso">{aviso}</div>}
      <style>{CSS}</style>
    </>
  );
}

const CSS = `
  .rv-root { font-family: var(--font-base); color: #2C1219; max-width: 1100px; margin: 0 auto; padding: 0 2px 24px; }
  .rv-busca { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; border: 1px solid #E5DDE0; border-radius: 6px; padding: 0 11px; height: 42px; background: #fff; }
  .rv-busca:focus-within { border-color: #2C1219; }
  .rv-busca input { flex: 1; min-width: 0; border: none; outline: none; background: none; font-family: inherit; font-size: 14px; color: #2C1219; }
  .rv-sec { font-size: 15px; font-weight: 800; margin: 18px 0 9px; }
  .rv-sub { font-size: 11.5px; font-weight: 700; color: #888780; margin: 12px 2px 8px; }
  .rv-pad { padding: 12px 14px 0; }
  .rv-limpa { border: none; background: none; font-size: 20px; color: #A8A0A4; cursor: pointer; line-height: 1; padding: 0 2px; }
  .rv-salvas { width: 100%; display: flex; align-items: center; gap: 9px; margin-top: 10px; padding: 11px 12px; border: 1px solid #F0EBED; border-radius: 6px; background: #fff; font-family: inherit; font-size: 13.5px; color: #2C1219; cursor: pointer; text-align: left; }
  .rv-salvas b { flex: 1; font-weight: 800; } .rv-salvas em { font-style: normal; font-size: 11px; font-weight: 800; background: #F5F0F2; padding: 1px 7px; border-radius: 4px; }
  .rv-salvas span { color: #C4B8BE; font-size: 18px; }
  .rv-tiles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 12px; }
  @media (min-width: 700px) { .rv-tiles { grid-template-columns: repeat(3, 1fr); } }
  @media (min-width: 1000px) { .rv-tiles { grid-template-columns: repeat(4, 1fr); } }
  .rv-tile { position: relative; height: 120px; border: 1px solid #F0EBED; border-radius: 6px; overflow: hidden; padding: 0; font-family: inherit; cursor: pointer; text-align: left; }
  .rv-tile img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .rv-tile-grad { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(20,8,12,.72)); }
  .rv-tile-ic { position: absolute; top: 12px; right: 12px; }
  .rv-tile-t { position: absolute; left: 11px; bottom: 9px; display: flex; flex-direction: column; }
  .rv-tile-t b { font-size: 15px; font-weight: 900; } .rv-tile-t small { font-size: 11px; font-weight: 700; opacity: .8; }
  .rv-tile.com-foto .rv-tile-t { color: #fff; }
  .rv-cat-h { position: relative; height: calc(180px + env(safe-area-inset-top, 0px)); overflow: hidden; }
  @media (min-width: 768px) { .rv-cat-h { height: 220px; } }
  .rv-cat-h img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .rv-cat-grad { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.05) 30%, rgba(20,8,12,.7)); }
  .rv-cat-ic { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
  .rv-cat-ic svg { width: 60px; height: 60px; }
  .rv-cat-t { position: absolute; left: 16px; bottom: 12px; display: flex; flex-direction: column; }
  .rv-cat-t b { font-size: 23px; font-weight: 900; } .rv-cat-t span { font-size: 12px; font-weight: 700; opacity: .75; }
  .rv-cat-h.com-foto .rv-cat-t { color: #fff; }
  .rv-rank { border: 1px solid #F0EBED; border-radius: 6px; background: #fff; }
  .rv-rk { width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 10px; border: none; border-top: 1px solid #F3ECEE; background: none; font-family: inherit; text-align: left; cursor: pointer; }
  .rv-rk:first-child { border-top: none; }
  .rv-pos { width: 18px; text-align: center; font-size: 17px; font-weight: 900; color: #C33A6E; }
  .rv-rk-img { width: 58px; height: 50px; border-radius: 4px; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .rv-rk-img img { width: 100%; height: 100%; object-fit: cover; }
  .rv-rk-t { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .rv-rk-t b { font-size: 13.5px; font-weight: 800; line-height: 1.25; margin: 1px 0 2px; color: #2C1219; }
  .rv-tema { font-size: 9.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #C33A6E; }
  .rv-lk { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 700; color: #6B5D64; }
  .rv-lk svg { color: #E85A8C; }
  .rv-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  @media (min-width: 700px) { .rv-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (min-width: 1000px) { .rv-grid { grid-template-columns: repeat(4, 1fr); } }
  .rv-card { display: flex; flex-direction: column; border: 1px solid #F0EBED; border-radius: 6px; overflow: hidden; background: #fff; padding: 0; font-family: inherit; text-align: left; cursor: pointer; }
  .rv-card-top { height: 104px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; padding: 8px; text-align: center; }
  .rv-card-top img { width: 100%; height: 100%; object-fit: cover; }
  .rv-card-top:has(img) { padding: 0; }
  .rv-card-top b { font-size: 13px; font-weight: 800; line-height: 1.2; }
  .rv-card-b { display: flex; justify-content: space-between; align-items: center; padding: 7px 9px; }
  .rv-card-nome { font-size: 12.5px; font-weight: 800; padding: 0 9px 9px; color: #2C1219; }
  .rv-vazio { padding: 34px 12px; text-align: center; font-size: 13.5px; color: #888780; line-height: 1.5; }
  /* Faixa de cima (receita e categoria) ocupando 100% da largura, colada no topo */
  .rv-sangra {
    margin-top: calc(-1 * (var(--pad-page-top, 1.5rem) + env(safe-area-inset-top, 0px)));
    margin-left: calc(50% - 50vw); margin-right: calc(50% - 50vw);
    width: 100vw; box-sizing: border-box;
  }
  @media (min-width: 768px) {
    .rv-sangra { margin-top: -3rem; margin-left: -2rem; margin-right: -2rem; width: auto; }
  }
  /* Receita aberta */
  .rv-hero { position: relative; height: calc(230px + env(safe-area-inset-top, 0px)); display: flex; align-items: center; justify-content: center; overflow: hidden; }
  @media (min-width: 768px) { .rv-hero { height: 300px; } }
  .rv-hero img { width: 100%; height: 100%; object-fit: cover; }
  .rv-voltar { position: absolute; top: calc(env(safe-area-inset-top, 0px) + 12px); left: 12px; width: 36px; height: 36px; border-radius: 6px; border: none; background: rgba(255,255,255,.94); font-size: 24px; font-weight: 700; color: #2C1219; cursor: pointer; line-height: 1; }
  .rv-det { max-width: 760px; margin: 0 auto; padding: 14px 16px 30px; }
  .rv-det h1 { font-size: 23px; font-weight: 900; line-height: 1.2; margin: 3px 0 2px; }
  .rv-by { font-size: 12px; color: #888780; margin: 0; }
  .rv-infos { display: grid; border-top: 1px solid #F0EBED; border-bottom: 1px solid #F0EBED; margin: 12px 0; }
  .rv-infos div { padding: 9px 6px; text-align: center; border-left: 1px solid #F0EBED; }
  .rv-infos div:first-child { border-left: none; }
  .rv-infos small { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #888780; }
  .rv-infos b { display: block; font-size: 13.5px; font-weight: 800; margin-top: 1px; }
  .rv-acoes { display: flex; gap: 8px; }
  .rv-acoes button { height: 42px; border: none; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-family: inherit; font-size: 13.5px; font-weight: 800; cursor: pointer; }
  .rv-like { flex: 1; background: #FDECF3; color: #C33A6E; } .rv-like.on { background: #E85A8C; color: #fff; }
  .rv-ic { width: 46px; background: #F5F0F2; color: #2C1219; } .rv-ic.on { background: #2C1219; color: #fff; }
  .rv-det h2 { font-size: 18px; font-weight: 900; margin: 22px 0 4px; padding-bottom: 6px; border-bottom: 2px solid #2C1219; }
  .rv-etapa { font-size: 13px; font-weight: 800; color: #C33A6E; margin: 12px 0 3px; }
  .rv-ing { list-style: none; margin: 0; padding: 0; }
  .rv-ing li { font-size: 14px; padding: 7px 0 7px 16px; border-bottom: 1px solid #F7F2F4; position: relative; line-height: 1.4; }
  .rv-ing li::before { content: ""; position: absolute; left: 2px; top: 14px; width: 5px; height: 5px; border-radius: 50%; background: #C33A6E; }
  .rv-passo { display: flex; gap: 12px; padding: 8px 0; }
  .rv-passo .rv-num { font-size: 19px; font-weight: 900; min-width: 20px; line-height: 1.2; flex-shrink: 0; }
  .rv-passo p { margin: 0; font-size: 14px; line-height: 1.55; color: #3B2A31; }
  .rv-dica { background: #FEF6E7; border-radius: 6px; padding: 12px 14px; margin-top: 16px; }
  .rv-dica b { font-size: 13.5px; } .rv-dica p { font-size: 13.5px; line-height: 1.5; margin: 5px 0 0; color: #5B4A1E; }
  .rv-aviso { position: fixed; left: 50%; bottom: calc(84px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 60; background: #2C1219; color: #fff; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; box-shadow: 0 8px 24px rgba(0,0,0,.2); }
`;

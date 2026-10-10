import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppPageHeader from "@/components/AppPageHeader";
import { TelaVazia, avisar } from "@/components/base";
import { BookmarkSimple, BookOpen, Cake, CaretRight, ChartPie, Cookie, CookingPot, Diamond, Drop, ForkKnife, Grains, IceCream, Lightbulb, MagnifyingGlass, ShareNetwork, Sparkle, Trophy, X } from "@phosphor-icons/react";
import type { Icon as PhIcon } from "@phosphor-icons/react";
import "./clientes.css";
import "./receitas.css";

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

// Ícone por tema (10/10: Phosphor, um diferente pra cada — antes Recheios e Massas tinham a mesma tigela e Coberturas um lápis).
// Mesma lógica do cadastro de bolo: recheio = gota, cobertura = brilho.
const ICONES: Record<string, PhIcon> = {
  Recheios: Drop, Massas: Grains, Coberturas: Sparkle, Bolos: Cake, "Doces finos": Diamond,
  Tortas: ChartPie, Salgados: ForkKnife, Pudins: IceCream, Bombons: Cookie,
};
const Icone = ({ tema, size = 30 }: { tema?: string | null; size?: number }) => {
  const Ic = ICONES[tema || ""] || CookingPot;
  return <Ic size={size} weight="bold" aria-hidden="true" />;
};
const IcCoracao = ({ cheio = true, size = 13 }: { cheio?: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={cheio ? "currentColor" : "none"} stroke="currentColor" strokeWidth={cheio ? 0 : 2.2} aria-hidden="true">
    <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 3 4.5 6.7 4.5c2 0 3.5 1.1 4.3 2.4.8-1.3 2.3-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.3C19.5 16.4 12 21 12 21z" />
  </svg>
);
const IcSalvar = ({ cheio, size = 20 }: { cheio: boolean; size?: number }) => <BookmarkSimple size={size} weight={cheio ? "fill" : "bold"} aria-hidden="true" />;
const IcCompartilhar = () => <ShareNetwork size={20} weight="bold" aria-hidden="true" />;

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

  const mostrarAviso = (t: string, erro = false) => avisar(t, { tipo: erro ? "erro" : "ok" });

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
      mostrarAviso("Não deu pra curtir agora. Tente de novo.", true);
    }
  };
  const alternarSalva = async (r: Receita) => {
    if (!userId) return;
    const ja = salvas.has(r.id);
    const novo = new Set(salvas); ja ? novo.delete(r.id) : novo.add(r.id); setSalvas(novo);
    const { error } = ja
      ? await supabase.from("receitas_doonly_salvas").delete().eq("receita_id", r.id).eq("user_id", userId)
      : await supabase.from("receitas_doonly_salvas").insert({ receita_id: r.id, user_id: userId });
    if (error) { setSalvas(salvas); mostrarAviso("Não deu pra salvar agora. Tente de novo.", true); }
    else mostrarAviso(ja ? "Tirada das salvas" : "Guardada em Receitas salvas");
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
      <AppPageHeader title="Receita" subtitle={r.categoria || "Receita Doonly"} onBack={() => setAberta(null)} />
      <div className="rv-root">
        <div className="rv-det">
          <div className="rv-hero" style={{ background: r.foto_url ? "#000" : bg, color: fg }}>
            {r.foto_url ? <img src={r.foto_url} alt="" /> : <Icone tema={r.categoria} size={62} />}
          </div>
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
            <button type="button" className={`rv-ic${salvas.has(r.id) ? " on" : ""}`} onClick={() => alternarSalva(r)} aria-label={salvas.has(r.id) ? "Tirar das salvas" : "Guardar nas salvas"} aria-pressed={salvas.has(r.id)}><IcSalvar cheio={salvas.has(r.id)} /></button>
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
            <div className="rv-dica"><b><Lightbulb size={20} weight="bold" />{r.dicas!.length > 1 ? "Dicas" : "Dica"}</b>{r.dicas!.map((d, k) => <p key={k}><Rico t={d} /></p>)}</div>
          )}
        </div>
      </div>
      </>
    );
  }

  // ═══════════ Listas ═══════════
  const grade = () => filtradas.length === 0 ? (
    vista.tipo === "salvas" && !q
      ? <TelaVazia compacta icone={<BookmarkSimple size={28} />} titulo="Nenhuma receita salva" texto="Use o marcador dentro de uma receita pra guardar aqui." />
      : <p className="cl9-semres">Nenhuma receita com esse nome ou ingrediente. Confira a busca.</p>
  ) : <div className="rv-grid">{filtradas.map(r => <Card key={r.id} r={r} />)}</div>;

  // Função (não componente) pra o campo não perder o foco a cada letra digitada
  const campoBusca = (ph: string) => (
    <label className="cl9-busca rv-busca">
      <MagnifyingGlass size={20} weight="bold" />
      <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder={ph} aria-label={ph} autoComplete="off" />
      {busca && <button type="button" onClick={() => setBusca("")} aria-label="Limpar a busca"><X size={18} weight="bold" /></button>}
    </label>
  );

  // Dentro de uma categoria ou das salvas
  if (vista.tipo !== "home") {
    const nome = vista.tipo === "categoria" ? vista.nome : "Receitas salvas";
    const info = vista.tipo === "categoria" ? catInfo(vista.nome) : undefined;
    const total = vista.tipo === "categoria" ? (info?.qtd || 0) : salvas.size;
    return (
      <>
      <AppPageHeader title={nome} subtitle={`${total} receita${total === 1 ? "" : "s"}`} onBack={() => irPara({ tipo: "home" })} />
      {info?.imagem_url && <div className="rv-root"><div className="rv-cat-h"><img src={info.imagem_url} alt="" /></div></div>}
      <div className="rv-root">
        <div className="rv-pad">
          {campoBusca(vista.tipo === "salvas" ? "Buscar nas salvas" : `Buscar em ${nome}`)}
          <p className="rv-sub">{q ? `${filtradas.length} receita${filtradas.length === 1 ? "" : "s"}` : "Mais curtidas primeiro"}</p>
          {grade()}
        </div>
      </div>
      </>
    );
  }

  // Tela inicial: categorias
  return (
    <>
      <AppPageHeader title="Receitas" subtitle="Receitas prontas pra confeitaria"
        infoContent={<>
          <p>Aqui ficam <strong>receitas prontas</strong> do Doonly: recheios, massas, coberturas e mais.</p>
          <p>Use o marcador dentro de uma receita pra guardar nas suas salvas.</p>
        </>} />
      <div className="rv-root">
        {campoBusca("Buscar receita ou ingrediente")}
        {loading ? (
          <div className="cl9-esq" aria-label="Carregando receitas">{[0, 1, 2, 3].map(k => <span key={k} />)}</div>
        ) : q ? (
          <>
            <p className="rv-sub">{filtradas.length} receita{filtradas.length === 1 ? "" : "s"} encontrada{filtradas.length === 1 ? "" : "s"}</p>
            {grade()}
          </>
        ) : (
          <>
            <button type="button" className="rv-salvas" onClick={() => irPara({ tipo: "salvas" })}>
              <span className="rv-salvas-ic"><IcSalvar cheio={salvas.size > 0} /></span><b>Receitas salvas</b>{salvas.size > 0 && <em>{salvas.size}</em>}<CaretRight size={20} weight="bold" />
            </button>
            {categorias.length === 0 ? (
              <TelaVazia caixa icone={<BookOpen size={30} />} titulo="Nenhuma receita ainda" texto="As receitas do Doonly aparecem aqui assim que forem publicadas." />
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
                <p className="rv-sec"><Trophy size={20} weight="bold" />Mais curtidas</p>
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
    </>
  );
}

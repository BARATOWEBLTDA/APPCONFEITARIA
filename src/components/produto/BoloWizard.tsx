import { useEffect, useState, type ReactNode } from "react";
import { Cake, Check, Drop, Sparkle, X } from "@phosphor-icons/react";
import { createPortal } from "react-dom";
import DooInfoModal from "@/components/DooInfoModal";

/**
 * Cadastro de BOLO em 4 etapas (aprovado 30/09):
 *  1. Sobre o bolo (tela de Informações que já existe)
 *  2. BoloOpcoesStep   — "O <bolo> deixa o cliente escolher alguma opção?" (massa · recheio · cobertura)
 *  3. BoloTamanhosStep — "Esse bolo tem tamanhos diferentes?" (preço por tamanho, pelo peso ou preço único)
 *  4. Fotos e entrega  (tela que já existe)
 * Trabalha direto no `form` do cadastro de produtos (grupo_massas, grupo_recheios, grupo_coberturas,
 * grupo_tamanhos, preco_normal, promoção) — o salvar é o mesmo de sempre.
 */

type Opcao = { id: string; nome: string; adicional: number; tipo_adicional?: string };
type Grupo = { ativo: boolean; min: number; max: number; distribuicao: string; opcoes: Opcao[] };
type Tam = { id: string; nome: string; preco: number; peso_kg?: number | null; serve?: string };

const uid = () => (typeof crypto !== "undefined" && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
const num = (v: string) => { const n = parseFloat(String(v).replace(/\./g, "").replace(",", ".")); return isNaN(n) ? 0 : n; };
/** Peso: entende "1,3", "1,3kg", "500g" e "500" (de 20 pra cima = gramas). Antes "500g" virava 500 kg (02/10). */
const numKg = (v: string) => {
  const s = String(v).toLowerCase().replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(s);
  if (isNaN(n) || n <= 0) return 0;
  if (/kg/.test(s)) return n;
  if (/g$/.test(s)) return n / 1000;
  return n >= 20 ? n / 1000 : n;
};
const moeda = (v: number) => v > 0 ? v.toFixed(2).replace(".", ",") : "";
const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
const GRUPO_VAZIO: Grupo = { ativo: false, min: 1, max: 1, distribuicao: "nenhuma", opcoes: [] };
const titulo = (s: string) => s.trim().replace(/^./, c => c.toUpperCase());

// ═══════════════════ Etapa 2 · Opções ═══════════════════
const TIPOS_OPCAO = [
  { key: "grupo_massas", titulo: "Sabor da massa", ph: "Ex: Pão de ló, Red velvet…", sug: ["Branca", "Chocolate", "Red velvet", "Cenoura", "Nozes", "Coco"] },
  { key: "grupo_recheios", titulo: "Tipo de recheio", ph: "Ex: Ninho, Doce de leite…", sug: ["Ninho", "Brigadeiro", "Doce de leite", "Morango", "Nutella", "Prestígio", "Maracujá", "Abacaxi"] },
  { key: "grupo_coberturas", titulo: "Tipo de cobertura", ph: "Ex: Chantilly, Ganache…", sug: ["Chantilly", "Ganache", "Pasta americana", "Buttercream", "Glacê"] },
] as const;

export function boloOpcoesOk(form: any): boolean {
  return TIPOS_OPCAO.every(t => { const g = form[t.key] as Grupo | undefined; return !g?.ativo || (g.opcoes?.length || 0) > 0; });
}

const ICONE: Record<string, ReactNode> = { grupo_massas: <Cake size={20} weight="bold" />, grupo_recheios: <Drop size={20} weight="bold" />, grupo_coberturas: <Sparkle size={20} weight="bold" /> };
const EXEMPLO: Record<string, string> = {
  grupo_massas: "Branca, chocolate, red velvet…",
  grupo_recheios: "Ninho, brigadeiro, doce de leite…",
  grupo_coberturas: "Chantilly, ganache, pasta americana…",
};
const NOVA: Record<string, string> = { grupo_massas: "Nova massa…", grupo_recheios: "Novo recheio…", grupo_coberturas: "Nova cobertura…" };
const LIXEIRA = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>;

export function BoloOpcoesStep({ form, setForm, edicao }: { form: any; setForm: (fn: (f: any) => any) => void; edicao?: boolean }) {
  const [texto, setTexto] = useState<Record<string, string>>({});
  const [aberto, setAberto] = useState<string | null>(null);           // cartão sendo editado
  const [extra, setExtra] = useState<{ key: string; id: string; valor: number } | null>(null); // "custa a mais?"
  const nome = (form.nome || "").trim() || "seu bolo";
  const grupo = (key: string): Grupo => ({ ...GRUPO_VAZIO, ...(form[key] || {}) });
  const setGrupo = (key: string, patch: Partial<Grupo>) => setForm((f: any) => ({ ...f, [key]: { ...GRUPO_VAZIO, ...(f[key] || {}), ...patch } }));
  const maxRecheio = (g: Grupo) => (g.max >= 99 || !g.max ? 2 : g.max);

  const alternar = (key: string) => {
    const g = grupo(key);
    if (g.ativo) { setGrupo(key, { ativo: false }); if (aberto === key) setAberto(null); return; }
    // Recheio começa com "até 2" (o normal em bolo)
    setGrupo(key, { ativo: true, min: 1, max: key === "grupo_recheios" ? (g.max > 1 && g.max < 99 ? g.max : 2) : 1 });
    setAberto(key);
  };
  const adicionar = (key: string) => {
    const n = titulo(texto[key] || "");
    if (!n) return;
    const g = grupo(key);
    if (!g.opcoes.some(o => o.nome.toLowerCase() === n.toLowerCase())) setGrupo(key, { opcoes: [...g.opcoes, { id: uid(), nome: n, adicional: 0 }] });
    setTexto(x => ({ ...x, [key]: "" }));
  };
  const salvarExtra = (valor: number) => {
    if (!extra) return;
    const g = grupo(extra.key);
    setGrupo(extra.key, { opcoes: g.opcoes.map(o => o.id === extra.id ? { ...o, adicional: valor, tipo_adicional: "fixo" } : o) });
    setExtra(null);
  };
  const opExtra = extra ? grupo(extra.key).opcoes.find(o => o.id === extra.id) : null;

  return (
    <div className="bw">
      <div className="bw-topo">
        <h2 className="bw-h">O cliente escolhe alguma opção?</h2>
        {!edicao && <p className="bw-produto">{nome}</p>}
        <p className="bw-sub">{edicao ? "Marque só o que o cliente escolhe." : "Marque só o que o cliente escolhe. Se não tiver nada, é só continuar."}</p>
      </div>

      {TIPOS_OPCAO.map(t => {
        const g = grupo(t.key);
        const editando = g.ativo && (aberto === t.key || g.opcoes.length === 0);
        const resumo = g.ativo && !editando;
        const qtd = g.opcoes.length;
        const sub = !g.ativo ? EXEMPLO[t.key]
          : `${qtd} ${qtd === 1 ? "opção" : "opções"}${t.key === "grupo_recheios" && qtd > 0 ? ` · o cliente escolhe até ${maxRecheio(g)}` : ""}`;
        return (
          <div key={t.key} className={`bo-card${g.ativo ? " on" : ""}${resumo ? " resumo" : ""}`}>
            <div className="bo-h">
              <button type="button" className="bo-h-main" onClick={() => g.ativo ? setAberto(editando ? null : t.key) : alternar(t.key)}>
                <span className="bo-ic" aria-hidden="true">{ICONE[t.key]}</span>
                <span className="bo-tx">
                  <b>{t.titulo}</b>
                  {resumo ? (
                    <span className="bo-rs">
                      {g.opcoes.map((o, i) => (
                        <span key={o.id}>{o.nome}{o.adicional > 0 && <em> +{brl(o.adicional)}</em>}{i < g.opcoes.length - 1 ? ", " : ""}</span>
                      ))}
                      {t.key === "grupo_recheios" && <small>O cliente escolhe até {maxRecheio(g)}</small>}
                    </span>
                  ) : <small className={g.ativo ? "on" : ""}>{sub}</small>}
                </span>
              </button>
              {resumo ? (
                <button type="button" className="bo-editar" onClick={() => setAberto(t.key)}>Editar</button>
              ) : (
                <button type="button" className={`bo-ck${g.ativo ? " on" : ""}`} onClick={() => alternar(t.key)} aria-pressed={g.ativo} aria-label={g.ativo ? `Desmarcar ${t.titulo}` : `Marcar ${t.titulo}`}>
                  {g.ativo ? <Check size={16} weight="bold" /> : null}
                </button>
              )}
            </div>

            {editando && (
              <div className="bo-body">
                <div className="bo-lista">
                  {g.opcoes.map(o => (
                    <div className="bo-li" key={o.id}>
                      <span className="bo-nm">{o.nome}</span>
                      <button type="button" className={`bo-vx${o.adicional > 0 ? " tem" : ""}`} onClick={() => setExtra({ key: t.key, id: o.id, valor: o.adicional || 0 })}>
                        {o.adicional > 0 ? `+ ${brl(o.adicional)}` : "+ valor extra"}
                      </button>
                      <button type="button" className="bo-rm" onClick={() => setGrupo(t.key, { opcoes: g.opcoes.filter(x => x.id !== o.id) })} aria-label={`Remover ${o.nome}`}>{LIXEIRA}</button>
                    </div>
                  ))}
                  <div className="bo-li bo-li--add">
                    <input value={texto[t.key] || ""} placeholder={NOVA[t.key]} onChange={e => setTexto(x => ({ ...x, [t.key]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); adicionar(t.key); } }} aria-label={NOVA[t.key]} />
                    <button type="button" onClick={() => adicionar(t.key)} disabled={!(texto[t.key] || "").trim()}>+ Adicionar</button>
                  </div>
                </div>
                {t.key === "grupo_recheios" && (
                  <div className="bo-lim">
                    <span>O cliente escolhe até</span>
                    <span className="bw-stepper">
                      <button type="button" onClick={() => setGrupo(t.key, { max: Math.max(1, maxRecheio(g) - 1) })} disabled={maxRecheio(g) <= 1} aria-label="Menos">−</button>
                      <b>{maxRecheio(g)}</b>
                      <button type="button" onClick={() => setGrupo(t.key, { max: Math.min(5, maxRecheio(g) + 1) })} disabled={maxRecheio(g) >= 5} aria-label="Mais">+</button>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}


      {/* "Quanto essa opção custa a mais?" — abre por baixo */}
      {extra && opExtra && createPortal(
        <div className="bw-sheet-bg" onClick={() => setExtra(null)}>
          <div className="bw-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label={`Valor extra de ${opExtra.nome}`}>
            <div className="bw-grab" aria-hidden="true" />
            <div className="bw-sheet-h"><b>{opExtra.nome}</b><button type="button" onClick={() => setExtra(null)} aria-label="Fechar"><X size={20} weight="bold" /></button></div>
            <p className="bw-hint bw-hint--top">Quanto essa opção custa a mais?</p>
            <label className="bw-money"><span>+ R$</span>
              <MoneyInput autoFocus value={extra.valor} onChange={v => setExtra(x => x ? { ...x, valor: v } : x)} ariaLabel={`Valor extra de ${opExtra.nome}`} />
            </label>
            <div className="bo-sheet-acts">
              <button type="button" className="bo-sheet-tirar" onClick={() => salvarExtra(0)}>{opExtra.adicional > 0 ? "Tirar valor extra" : "Não cobra a mais"}</button>
              <button type="button" className="bo-sheet-ok" onClick={() => salvarExtra(extra.valor)}>Salvar</button>
            </div>
          </div>
        </div>, document.body)}
      <style>{CSS}</style>
    </div>
  );
}

// ═══════════════════ Campo de dinheiro (formata enquanto digita) ═══════════════════
/** Digita só números: 1 → 0,01 · 125000 → 1.250,00 */
export function MoneyInput({ value, onChange, className, ariaLabel, autoFocus }: {
  value: number; onChange: (v: number) => void; className?: string; ariaLabel?: string; autoFocus?: boolean;
}) {
  const txt = value > 0 ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
  return (
    <input className={className} inputMode="numeric" value={txt} placeholder="0,00" aria-label={ariaLabel} autoFocus={autoFocus}
      onChange={e => { const d = e.target.value.replace(/\D/g, "").slice(0, 9); onChange(d ? parseInt(d, 10) / 100 : 0); }} />
  );
}

// ═══════════════════ Etapa 3 · Tamanhos  ·  Etapa 4 · Preço ═══════════════════
export type BoloTam = "sim" | "nao" | null;

/** Etapa 3: respondeu Sim/Não e, se Sim, tem pelo menos 1 tamanho com nome */
export function boloTamanhosOk(form: any, escolha: BoloTam): boolean {
  if (!escolha) return false;
  if (escolha === "nao") return true;
  const gt = form.grupo_tamanhos;
  const nomeados = (gt?.opcoes || []).filter((o: Tam) => o.nome?.trim());
  if (!nomeados.length) return false;
  // Marcou "Informar o rendimento": precisa preencher em todos
  if (gt?.mostra_rendimento && nomeados.some((o: Tam) => !String(o.serve || "").trim())) return false;
  return true;
}

/** Etapa 4: preços preenchidos */
export function boloPrecoOk(form: any, escolha: BoloTam): boolean {
  if (form.promocao) {
    if (form.tipo_promocao === "percentual") { if (!((form.desconto_percentual || 0) > 0)) return false; }
    else if (!((form.preco_promocional || 0) > 0 && (form.preco_promocional || 0) < (form.preco_normal || 0))) return false;
  }
  if (escolha === "nao") return (form.preco_normal || 0) > 0;
  const gt = form.grupo_tamanhos;
  const linhas: Tam[] = (gt?.opcoes || []).filter((o: Tam) => o.nome?.trim());
  if (!linhas.length) return false;
  if (gt?.modo_preco_tamanho === "por_peso") return (form.preco_normal || 0) > 0 && linhas.every(o => (o.peso_kg || 0) > 0);
  return linhas.every(o => o.preco > 0);
}

const VENDA = [
  { v: "unidade", t: "Unidade", suf: "unidade" },
  { v: "kg", t: "Por kg", suf: "kg" },
  { v: "fatia", t: "Fatia", suf: "fatia" },
];
const GT_PADRAO = { ...GRUPO_VAZIO, nome_exibicao: "Tamanhos e Pesos" };
const kgTxt = (v: number) => v > 0 && v < 1 ? `${Math.round(v * 1000)} g` : `${String(Math.round(v * 100) / 100).replace(".", ",")} kg`;

/** Atualiza grupo_tamanhos sempre com um modo de preço definido */
function useTamanhos(form: any, setForm: (fn: (f: any) => any) => void) {
  const gt = { ...GT_PADRAO, ...(form.grupo_tamanhos || {}) } as any;
  const tams: Tam[] = gt.opcoes || [];
  const setGt = (patch: any) => setForm((f: any) => {
    const g = { ...GT_PADRAO, ...(f.grupo_tamanhos || {}), ...patch };
    return { ...f, grupo_tamanhos: { ...g, modo_preco_tamanho: g.modo_preco_tamanho || "preco_fixo" } };
  });
  const setTam = (id: string, patch: Partial<Tam>) => setGt({ opcoes: tams.map(x => x.id === id ? { ...x, ...patch } : x) });
  return { gt, tams, setGt, setTam, porPeso: gt.modo_preco_tamanho === "por_peso", fatias: gt.rendimento_unidade === "fatias" };
}

const LIX = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>;

// ─────────── Etapa 3 · Tamanhos (nome, peso e rendimento — sem preço) ───────────
export function BoloTamanhosStep({ form, setForm, escolha, setEscolha, edicao }: {
  form: any; setForm: (fn: (f: any) => any) => void; escolha: BoloTam; setEscolha: (e: BoloTam) => void; edicao?: boolean;
}) {
  const { tams, setGt, setTam, porPeso, fatias } = useTamanhos(form, setForm);
  const [gerarAberto, setGerarAberto] = useState(false);
  const [gModo, setGModo] = useState<"pmg" | "peso">("pmg");
  const [gDe, setGDe] = useState("1");
  const [gAte, setGAte] = useState("3");
  const [gPasso, setGPasso] = useState(0.5);
  const { gt: gtAtual } = useTamanhos(form, setForm);
  const mostrarRend = !!gtAtual.mostra_rendimento || tams.some(x => x.serve);
  const setMostrarRend = (fn: (v: boolean) => boolean) => {
    const v = fn(mostrarRend);
    // Desmarcou: limpa os rendimentos (senão continuariam aparecendo no cardápio)
    setGt(v ? { mostra_rendimento: true } : { mostra_rendimento: false, opcoes: tams.map(x => ({ ...x, serve: "" })) });
  };
  const [editando, setEditando] = useState(false); // "Editar lista": mostra as lixeiras
  const linhaVazia = (): Tam => ({ id: uid(), nome: "", preco: 0, peso_kg: null, serve: "" });

  // Ao sair da etapa, tira as linhas que ficaram sem nome
  useEffect(() => () => {
    setForm((f: any) => {
      const g = f.grupo_tamanhos; if (!g?.opcoes?.length) return f;
      const limpas = g.opcoes.filter((o: Tam) => o.nome?.trim());
      return limpas.length === g.opcoes.length ? f : { ...f, grupo_tamanhos: { ...g, opcoes: limpas } };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const escolher = (e: "sim" | "nao") => {
    setEscolha(e);
    if (e === "sim") {
      setForm((f: any) => {
        const g = { ...GT_PADRAO, ...(f.grupo_tamanhos || {}) };
        return { ...f, forma_venda: "unidade", grupo_tamanhos: { ...g, modo_preco_tamanho: g.modo_preco_tamanho || "preco_fixo", ativo: true, min: 1, max: 1, opcoes: g.opcoes?.length ? g.opcoes : [linhaVazia()] } };
      });
    } else {
      setForm((f: any) => ({ ...f, forma_venda: VENDA.some(x => x.v === f.forma_venda) ? f.forma_venda : "unidade", grupo_tamanhos: { ...GT_PADRAO, ...(f.grupo_tamanhos || {}), ativo: false } }));
    }
  };

  const pesosGerados = (() => {
    const de = numKg(gDe), ate = numKg(gAte);
    if (!(de > 0 && ate >= de && gPasso > 0)) return [] as number[];
    const out: number[] = [];
    for (let v = de; v <= ate + 1e-9 && out.length < 20; v += gPasso) out.push(Math.round(v * 100) / 100);
    return out;
  })();
  const gerados: Tam[] = gModo === "pmg"
    ? [{ id: uid(), nome: "P", preco: 0, peso_kg: 1, serve: "" }, { id: uid(), nome: "M", preco: 0, peso_kg: 1.5, serve: "" }, { id: uid(), nome: "G", preco: 0, peso_kg: 2, serve: "" }]
    : pesosGerados.map(p => ({ id: uid(), nome: kgTxt(p), preco: 0, peso_kg: p, serve: "" }));
  const temNomes = tams.some(x => x.nome.trim());
  const nomeados = tams.filter(x => x.nome.trim());

  return (
    <div className="bw">
      <div className="bw-topo">
        <h2 className="bw-h">Esse bolo tem mais de um tamanho?</h2>
      </div>
      <div className="bw-sn" role="radiogroup">
        <button type="button" role="radio" aria-checked={escolha === "sim"} className={escolha === "sim" ? "on" : ""} onClick={() => escolher("sim")}>
          <b>Sim</b><small>P, M e G · aro · por kg</small>
        </button>
        <button type="button" role="radio" aria-checked={escolha === "nao"} className={escolha === "nao" ? "on" : ""} onClick={() => escolher("nao")}>
          <b>Não</b><small>É um tamanho só</small>
        </button>
      </div>
      {escolha === "nao" && !edicao && <p className="bw-hint bw-hint--centro">Tudo certo — o preço você define na próxima etapa.</p>}

      {escolha === "sim" && (
        <div className="bw-box">
          <h3 className="bw-tt">Tamanhos</h3>
          <p className="bw-tt-sub">Digite cada tamanho abaixo, ou use o Gerar automático pra começar mais rápido.</p>
          <div className="bw-lt-bar">
            <button type="button" className="bw-gerar-btn" onClick={() => { setGModo(porPeso ? "peso" : "pmg"); setGerarAberto(true); }}>Gerar automático</button>
            {tams.length > 0 && (
              <button type="button" className={`bw-lt-edit${editando ? " on" : ""}`} onClick={() => setEditando(v => !v)}>{editando ? "Pronto" : "Editar lista"}</button>
            )}
          </div>

          <div className={`bw-lt${editando ? " bw-lt--ed" : ""}`}>
            <div className="bw-lt-h">
              <span>Nome do tamanho</span><span>Peso</span>
            </div>
            {tams.map(x => (
              <div className="bw-lt-row" key={x.id}>
                <input className="bw-lt-nome" value={x.nome} placeholder="Ex: P" onChange={e => setTam(x.id, { nome: e.target.value })} aria-label="Nome do tamanho" />
                <label className="bw-lt-peso"><input inputMode="text" defaultValue={x.peso_kg ? (x.peso_kg < 1 ? `${Math.round(x.peso_kg * 1000)}g` : String(x.peso_kg).replace(".", ",")) : ""} placeholder="Ex: 1 ou 500g"
                  onChange={e => setTam(x.id, { peso_kg: numKg(e.target.value) || null })} aria-label="Peso (kg ou g)" /><em>{x.peso_kg && x.peso_kg < 1 ? `= ${kgTxt(x.peso_kg)}` : "kg"}</em></label>
                {editando && (
                  <button type="button" className="bw-lt-rm" onClick={() => setGt({ opcoes: tams.filter(y => y.id !== x.id) })} aria-label={`Remover ${x.nome || "tamanho"}`}>{LIX}</button>
                )}
              </div>
            ))}
            <button type="button" className="bw-lt-add" onClick={() => { setGt({ opcoes: [...tams, linhaVazia()] }); setEditando(false); }}>+ Adicionar tamanho</button>
          </div>

          <button type="button" className={`bw-check2${mostrarRend ? " on" : ""}`} onClick={() => setMostrarRend(v => !v)} aria-pressed={mostrarRend}>
            <i aria-hidden="true">{mostrarRend ? <Check size={14} weight="bold" /> : null}</i>
            <span><b>Informar o rendimento dos tamanhos</b><small>O Doonly recomenda preencher: seu cardápio fica mais completo e organizado.</small></span>
          </button>
          {mostrarRend && (
            <div className="bw-rend-body">
              <div className="bw-rend-uni" role="radiogroup" aria-label="Contar em">
                <span>Contar em</span>
                <button type="button" role="radio" aria-checked={!fatias} className={!fatias ? "on" : ""} onClick={() => setGt({ rendimento_unidade: "pessoas" })}>Pessoas</button>
                <button type="button" role="radio" aria-checked={fatias} className={fatias ? "on" : ""} onClick={() => setGt({ rendimento_unidade: "fatias" })}>Fatias</button>
              </div>
              {nomeados.some(x => !String(x.serve || "").trim()) && nomeados.length > 0 && (
                <p className="bw-falta">Preencha o rendimento de todos os tamanhos (ou desmarque a opção).</p>
              )}
              {nomeados.length === 0 ? (
                <p className="bw-hint">Cadastre os tamanhos acima pra informar o rendimento.</p>
              ) : nomeados.map(x => (
                <div className="bw-rend-row" key={x.id}>
                  <span className="bw-rend-lb">Rendimento <b>{x.nome}</b>{x.peso_kg && kgTxt(x.peso_kg) !== x.nome ? <small> · {kgTxt(x.peso_kg)}</small> : null}</span>
                  <label className="bw-in bw-suf bw-rend-in"><input inputMode="numeric" value={x.serve || ""} placeholder={`Ex: ${Math.max(5, Math.round((x.peso_kg || 1) * 10))}`}
                    onChange={e => setTam(x.id, { serve: e.target.value.replace(/\D/g, "") })} aria-label={`Rendimento do tamanho ${x.nome}`} /><em>{fatias ? "fatias" : "pessoas"}</em></label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {gerarAberto && createPortal(
        <div className="bw-sheet-bg" onClick={() => setGerarAberto(false)}>
          <div className="bw-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Gerar tamanhos">
            <div className="bw-grab" aria-hidden="true" />
            <div className="bw-sheet-h"><b>Gerar tamanhos</b><button type="button" onClick={() => setGerarAberto(false)} aria-label="Fechar"><X size={20} weight="bold" /></button></div>
            <p className="bw-hint bw-hint--top">Escolha um jeito rápido de começar. Depois dá pra editar tudo.</p>
            <button type="button" className={`bw-gopt${gModo === "pmg" ? " on" : ""}`} onClick={() => setGModo("pmg")}>
              <i aria-hidden="true" /><span><b>P, M e G</b><small>1 kg · 1,5 kg · 2 kg</small></span>
            </button>
            <div className={`bw-gopt${gModo === "peso" ? " on" : ""}`} onClick={() => setGModo("peso")} role="button" tabIndex={0}>
              <i aria-hidden="true" />
              <span><b>Por peso</b>
                <span className="bw-frase bw-frase--gerar">De
                  <label className="bw-in bw-suf bw-in--curto"><input inputMode="decimal" value={gDe} onChange={e => setGDe(e.target.value)} onFocus={() => setGModo("peso")} aria-label="Peso inicial" /><em>kg</em></label>
                  até
                  <label className="bw-in bw-suf bw-in--curto"><input inputMode="decimal" value={gAte} onChange={e => setGAte(e.target.value)} onFocus={() => setGModo("peso")} aria-label="Peso final" /><em>kg</em></label>
                </span>
                <span className="bw-passos">
                  {[0.5, 1].map(p => <button type="button" key={p} className={gPasso === p ? "on" : ""} onClick={() => { setGModo("peso"); setGPasso(p); }}>de {p === 0.5 ? "0,5" : "1"} em {p === 0.5 ? "0,5" : "1"} kg</button>)}
                </span>
              </span>
            </div>
            {gerados.length > 0 && <div className="bw-prev">{gerados.map(g => <span key={g.id}>{g.nome}</span>)}</div>}
            {temNomes && <p className="bw-hint">Isso substitui os tamanhos que você já digitou.</p>}
            <button type="button" className="bw-gerar-bt" disabled={!gerados.length} onClick={() => { setGt({ opcoes: gerados }); setGerarAberto(false); }}>
              Criar {gerados.length} {gerados.length === 1 ? "tamanho" : "tamanhos"}
            </button>
          </div>
        </div>, document.body)}
      <style>{CSS}</style>
    </div>
  );
}

// ─────────── Etapa 4 · Preço ───────────
export function BoloPrecoStep({ form, setForm, escolha, primeiroNome, edicao }: {
  form: any; setForm: (fn: (f: any) => any) => void; escolha: BoloTam; primeiroNome?: string; edicao?: boolean;
}) {
  const { tams, setGt, setTam, porPeso } = useTamanhos(form, setForm);
  const [infoBase, setInfoBase] = useState(false);
  const nome = (form.nome || "").trim();
  const precoBase = form.preco_normal || 0;
  const exBase = precoBase > 0 ? precoBase : 80;
  const suf = VENDA.find(x => x.v === form.forma_venda)?.suf || "unidade";
  const nomeados = tams.filter(x => x.nome.trim());
  const emFatias = (form.grupo_tamanhos || {}).rendimento_unidade === "fatias";
  const rotulo = (x: Tam) => (
    <span className="bw-pr-lb"><b>{x.nome}</b>{x.peso_kg && kgTxt(x.peso_kg) !== x.nome ? <small> · {kgTxt(x.peso_kg)}</small> : null}
      {x.serve ? <small className="bw-pr-rend">{emFatias ? `${x.serve} fatias` : `serve ${x.serve} pessoas`}</small> : null}
    </span>
  );

  return (
    <div className="bw">
      <div className="bw-topo">
        <h2 className="bw-h">{escolha === "sim" ? "Qual o preço de cada tamanho?" : "Qual o preço?"}</h2>
        {nome && !edicao && <p className="bw-produto">{nome}</p>}
      </div>

      {escolha === "nao" ? (
        <div className="bw-box">
          <p className="bw-bt">Como você vende esse bolo?</p>
          <div className="bw-seg3" role="radiogroup">
            {VENDA.map(x => (
              <button key={x.v} type="button" role="radio" aria-checked={form.forma_venda === x.v} className={form.forma_venda === x.v ? "on" : ""}
                onClick={() => setForm((f: any) => ({ ...f, forma_venda: x.v }))}>{x.t}</button>
            ))}
          </div>
          <p className="bw-bt bw-bt--mt">Preço</p>
          <label className="bw-money"><span>R$</span>
            <MoneyInput value={form.preco_normal || 0} onChange={v => setForm((f: any) => ({ ...f, preco_normal: v }))} ariaLabel="Preço do bolo" />
            <em>/ {suf}</em>
          </label>
          <p className="bw-hint">Digite só os números — a vírgula e o ponto aparecem sozinhos.</p>
        </div>
      ) : (
        <>
          <div className="bw-box">
            <p className="bw-bt">Como é o preço?</p>
            <div className="bw-modos bw-modos--col" role="radiogroup">
              <button type="button" role="radio" aria-checked={!porPeso} className={!porPeso ? "on" : ""} onClick={() => setGt({ modo_preco_tamanho: "preco_fixo" })}>
                <i aria-hidden="true" /><span><b>Cada tamanho tem seu preço</b><small>Você define o preço de cada tamanho</small></span>
              </button>
              <button type="button" role="radio" aria-checked={porPeso} className={porPeso ? "on" : ""} onClick={() => setGt({ modo_preco_tamanho: "por_peso" })}>
                <i aria-hidden="true" /><span><b>Calcular pelo peso</b><small>Você informa o preço do kg e o Doonly faz a conta de cada tamanho</small></span>
              </button>
            </div>
            {porPeso && (
              <div className="bw-kg">
                <span className="bw-kg-t">Preço base
                  <button type="button" className="bw-i" onClick={() => setInfoBase(true)} aria-label="O que é o preço base?">i</button>
                </span>
                <label className="bw-money bw-money--sm"><span>R$</span>
                  <MoneyInput value={precoBase} onChange={v => setForm((f: any) => ({ ...f, preco_normal: v }))} ariaLabel="Preço base por kg" />
                  <em>/kg</em>
                </label>
              </div>
            )}
          </div>

          <div className="bw-box">
            <p className="bw-bt">{porPeso ? "Preço de cada tamanho" : "Preços"}</p>
            {porPeso && <p className="bw-hint bw-hint--sob2">Calculado pelo preço base</p>}
            {nomeados.length === 0 && <p className="bw-hint">Volte uma etapa e cadastre os tamanhos.</p>}
            {nomeados.map(x => (
              <div className="bw-pr" key={x.id}>
                {rotulo(x)}
                {porPeso ? (
                  (x.peso_kg || 0) > 0
                    ? <span className={`bw-in bw-pr-calc${precoBase > 0 ? " ok" : ""}`}>{precoBase > 0 ? brl(precoBase * (x.peso_kg || 0)) : "Informe o preço base"}</span>
                    : <span className="bw-in bw-pr-calc">Sem peso — volte e preencha</span>
                ) : (
                  <label className={`bw-in bw-rs bw-pr-in${x.preco > 0 ? " ok" : ""}`}><span className="bw-rs-p">R$</span>
                    <MoneyInput value={x.preco} onChange={v => setTam(x.id, { preco: v })} ariaLabel={`Preço do tamanho ${x.nome}`} />
                  </label>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Promoção (opcional) */}
      {escolha && (() => {
        const pct = form.tipo_promocao === "percentual";
        const podeDePor = escolha === "nao"; // com tamanhos, só % (vale pra todos)
        return (
          <div className={`bw-box bw-promo2${form.promocao ? " on" : ""}`}>
            <button type="button" className={`bw-check2${form.promocao ? " on" : ""}`} aria-pressed={!!form.promocao}
              onClick={() => setForm((f: any) => ({ ...f, promocao: !f.promocao,
                tipo_promocao: f.promocao ? f.tipo_promocao : (podeDePor ? (f.tipo_promocao || "fixo") : "percentual"),
                desconto_percentual: !f.promocao && !podeDePor ? (f.desconto_percentual || 10) : f.desconto_percentual }))}>
              <i aria-hidden="true">{form.promocao ? <Check size={14} weight="bold" /> : null}</i>
              <span><b>Colocar em promoção</b><small>{podeDePor ? "O cardápio mostra o preço antigo riscado" : "Um desconto em % vale pra todos os tamanhos"}</small></span>
            </button>
            {form.promocao && (
              <div className="bw-promo-body">
                {podeDePor && (
                  <div className="bw-seg3 bw-seg2" role="radiogroup">
                    <button type="button" role="radio" aria-checked={!pct} className={!pct ? "on" : ""} onClick={() => setForm((f: any) => ({ ...f, tipo_promocao: "fixo" }))}>De / Por</button>
                    <button type="button" role="radio" aria-checked={pct} className={pct ? "on" : ""} onClick={() => setForm((f: any) => ({ ...f, tipo_promocao: "percentual", desconto_percentual: f.desconto_percentual || 10 }))}>% de desconto</button>
                  </div>
                )}
                {podeDePor && !pct ? (
                  <div className="bw-frase">De <b>{brl(form.preco_normal || 0)}</b> por
                    <label className="bw-money bw-money--sm"><span>R$</span>
                      <MoneyInput value={form.preco_promocional || 0} onChange={v => setForm((f: any) => ({ ...f, tipo_promocao: "fixo", preco_promocional: v }))} ariaLabel="Preço promocional" />
                    </label>
                  </div>
                ) : (
                  <div className="bw-frase">Desconto de
                    <label className="bw-in bw-suf bw-in--curto"><input inputMode="numeric" value={form.desconto_percentual || ""} placeholder="10"
                      onChange={e => setForm((f: any) => ({ ...f, tipo_promocao: "percentual", desconto_percentual: Math.min(90, parseInt(e.target.value.replace(/\D/g, "") || "0", 10)) }))} aria-label="Desconto em %" /><em>%</em></label>
                    {podeDePor ? (form.preco_normal > 0 && (form.desconto_percentual || 0) > 0 ? <small className="bw-hint">sai por {brl(form.preco_normal * (1 - (form.desconto_percentual || 0) / 100))}</small> : null) : <span>em todos os tamanhos</span>}
                  </div>
                )}
                {podeDePor && !pct && (form.preco_promocional || 0) >= (form.preco_normal || 0) && (form.preco_promocional || 0) > 0 && (
                  <p className="bw-falta">O preço da promoção tem que ser menor que o preço normal.</p>
                )}
              </div>
            )}
          </div>
        );
      })()}
      {infoBase && (
        <DooInfoModal open onClose={() => setInfoBase(false)} image="/Sistema/precifique.png" imageAlt="Preço base"
          ariaLabel="O que é o preço base" title={<>{primeiroNome ? `${primeiroNome}, entenda` : "Entenda"} o <span style={{ color: "#C33A6E" }}>preço base</span>.</>}>
          <p style={{ margin: "0 0 12px" }}>O preço base é <strong>quanto você cobra por 1 kg</strong> desse bolo.</p>
          <p style={{ margin: "0 0 12px" }}>O app usa esse valor pra calcular o preço de cada tamanho sozinho:</p>
          <p style={{ margin: "0 0 12px" }}><strong>1 kg</strong> = {brl(exBase)} · <strong>1,5 kg</strong> = {brl(exBase * 1.5)} · <strong>2 kg</strong> = {brl(exBase * 2)}</p>
          <p style={{ margin: 0 }}>Se você mudar o preço base, <strong>todos os tamanhos se atualizam juntos</strong>. Não precisa mexer um por um.</p>
        </DooInfoModal>
      )}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .bw { font-family: var(--font-base); color: #2C1219; padding: 4px 2px 12px; }
  .bw-eta { font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #C33A6E; margin: 0; }
  .bw-h { font-size: 22px; font-weight: 800; line-height: 1.25; letter-spacing: -.01em; margin: 6px 0 6px; color: #2C1219; }
  .bw-h span { color: #C33A6E; }
  .bw-sub { font-size: 14px; color: #6B5D64; line-height: 1.5; margin: 0 0 18px; }
  .bw-lb { font-size: 12.5px; font-weight: 700; color: #4B3A42; margin: 22px 0 8px; }

  .bw-opt { border: 1.5px solid #EDE5E8; border-radius: 16px; background: #fff; margin-bottom: 10px; transition: border-color .15s, background .15s; }
  .bw-opt.on { border-color: #E85A8C; background: #FFFAFC; }
  .bw-opt-h { width: 100%; display: flex; align-items: center; gap: 12px; padding: 15px 16px; border: none; background: none; font-family: inherit; text-align: left; cursor: pointer; color: #2C1219; }
  .bw-opt-h i { width: 24px; height: 24px; border-radius: 8px; border: 2px solid #D6CBD0; display: flex; align-items: center; justify-content: center; font-style: normal; font-size: 13px; font-weight: 900; color: #fff; flex-shrink: 0; transition: all .15s; }
  .bw-opt.on .bw-opt-h i { background: #E85A8C; border-color: #E85A8C; }
  .bw-opt-h b { font-size: 15.5px; font-weight: 700; flex: 1; }
  .bw-opt-h em { font-style: normal; font-size: 12px; font-weight: 700; color: #9D174D; background: #FCE7F3; padding: 3px 9px; border-radius: 999px; }
  .bw-opt-b { padding: 0 16px 16px 52px; }
  .bw-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .bw-chip { display: inline-flex; align-items: center; background: #FCE7F3; border-radius: 999px; border: 1.5px solid transparent; }
  .bw-chip.ed { border-color: #C33A6E; }
  .bw-chip-n { border: none; background: none; font-family: inherit; font-size: 13.5px; font-weight: 700; color: #9D174D; padding: 7px 4px 7px 13px; cursor: pointer; }
  .bw-chip-n small { font-size: 13px; font-weight: 700; color: #C33A6E; }
  .bw-chip-x { border: none; background: none; color: #C4789C; font-size: 12px; padding: 7px 11px 7px 5px; cursor: pointer; }
  .bw-extra { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: #fff; border: 1px solid #F3D6E2; border-radius: 12px; padding: 10px 12px; margin-bottom: 12px; font-size: 13.5px; color: #4B3A42; }
  .bw-extra > button { margin-left: auto; border: none; background: #2C1219; color: #fff; font-family: inherit; font-size: 12.5px; font-weight: 700; border-radius: 9px; padding: 8px 14px; cursor: pointer; }
  .bw-add { display: flex; gap: 8px; }
  .bw-add input { flex: 1; min-width: 0; height: 44px; border: 1.5px solid #EAE3E6; border-radius: 12px; padding: 0 14px; font-family: inherit; font-size: 16px; color: #2C1219; background: #fff; transition: border-color .15s; }
  .bw-add input::placeholder, .bw-in input::placeholder, .bw-rs input::placeholder, input.bw-in::placeholder { color: #B5AAB0; }
  .bw-add input:focus { outline: none; border-color: #2C1219; }
  .bw-add button { height: 44px; border: none; border-radius: 12px; background: #2C1219; color: #fff; font-family: inherit; font-size: 13.5px; font-weight: 700; padding: 0 18px; cursor: pointer; }
  .bw-add button:disabled { opacity: .3; cursor: default; }
  .bw-sug { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .bw-sug button { border: 1.5px dashed #DCCFD5; background: none; border-radius: 999px; padding: 5px 12px; font-family: inherit; font-size: 12.5px; font-weight: 600; color: #6B5D64; cursor: pointer; }
  .bw-sug button:hover { border-color: #C33A6E; color: #C33A6E; }
  .bw-frase { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 14.5px; color: #2C1219; margin-top: 14px; }
  .bw-stepper { display: inline-flex; align-items: center; border: 1.5px solid #EAE3E6; border-radius: 10px; background: #fff; overflow: hidden; }
  .bw-stepper button { width: 34px; height: 34px; border: none; background: none; font-size: 17px; font-weight: 800; color: #C33A6E; cursor: pointer; }
  .bw-stepper button:disabled { color: #D6CBD0; cursor: default; }
  .bw-stepper b { min-width: 26px; text-align: center; font-size: 15px; }
  .bw-dica { font-size: 12px; color: #9A8E94; margin: 12px 0 0; }

  .bw-sn { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; }
  .bw-sn button { border: 1.5px solid #EAE3E6; border-radius: 16px; background: #fff; padding: 16px 12px; font-family: inherit; cursor: pointer; color: #2C1219; display: flex; flex-direction: column; align-items: center; gap: 3px; transition: all .15s; }
  .bw-sn button b { font-size: 17px; font-weight: 800; } .bw-sn button small { font-size: 12.5px; color: #888780; }
  .bw-sn button.on { border-color: #2C1219; background: #2C1219; color: #fff; } .bw-sn button.on small { color: rgba(255,255,255,.75); }
  .bw-modos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .bw-modos button { display: flex; gap: 10px; align-items: flex-start; text-align: left; border: 1.5px solid #EAE3E6; border-radius: 14px; background: #fff; padding: 12px; font-family: inherit; cursor: pointer; color: #2C1219; }
  .bw-modos button i { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #D6CBD0; flex-shrink: 0; margin-top: 1px; }
  .bw-modos button.on { border-color: #2C1219; background: #FAF7F8; } .bw-modos button.on i { border: 5px solid #2C1219; }
  .bw-modos b { display: block; font-size: 13.5px; font-weight: 700; } .bw-modos small { display: block; font-size: 12px; color: #888780; margin-top: 2px; line-height: 1.35; }
  .bw-kg { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; padding: 12px 14px; border-radius: 14px; background: #FAF7F8; font-size: 14px; font-weight: 700; }
  .bw-box { border: 1px solid #F0EBED; border-radius: 16px; padding: 16px; margin-top: 14px; background: #fff; }
  .bw-bh { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
  .bw-bt { font-size: 14px; font-weight: 700; color: #2C1219; margin: 0 0 10px; }
  .bw-bh .bw-bt { margin: 0; }
  .bw-bt--mt { margin-top: 18px; }
  .bw-seg3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 4px; background: #EFE9EB; border-radius: 12px; }
  .bw-seg3 button { border: none; background: none; border-radius: 9px; padding: 10px 4px; font-family: inherit; font-size: 13.5px; font-weight: 700; color: #7C7A8E; cursor: pointer; }
  .bw-seg3 button.on { background: #fff; color: #2C1219; box-shadow: 0 1px 3px rgba(44,18,25,.1); }
  .bw-money { display: flex; align-items: center; gap: 8px; height: 58px; border: 1.5px solid #EAE3E6; border-radius: 14px; padding: 0 16px; background: #fff; transition: border-color .15s; }
  .bw-money:focus-within { border-color: #2C1219; }
  .bw-money > span { font-size: 15px; font-weight: 700; color: #9A8E94; }
  .bw-money input { flex: 1; min-width: 0; border: none; outline: none; background: none; font-family: inherit; font-size: 24px; font-weight: 800; color: #2C1219; }
  .bw-money input::placeholder { color: #D6CBD0; }
  .bw-money em { font-style: normal; font-size: 13px; font-weight: 600; color: #888780; white-space: nowrap; }
  .bw-money--sm { height: 44px; width: 150px; padding: 0 12px; } .bw-money--sm input { font-size: 16px; }
  .bw-hint { font-size: 12px; color: #9A8E94; margin: 8px 0 0; line-height: 1.45; }
  .bw-hint--top { margin: 2px 0 12px; }
  .bw-gerar-pill { border: 1px solid #F9D1E0; background: #FFF1F6; color: #C33A6E; border-radius: 999px; padding: 7px 13px; font-family: inherit; font-size: 12.5px; font-weight: 800; cursor: pointer; white-space: nowrap; }
  .bw-gerar-pill:hover { background: #FCE7F3; }
  .bw-col-sel { border: none; background: none; padding: 0 0 0 4px; font-family: inherit; font-size: 12px; font-weight: 800; color: #C33A6E; text-transform: uppercase; letter-spacing: .04em; cursor: pointer; text-align: left; }
  .bw-link--sec { display: block; color: #6B5D64; font-weight: 600; font-size: 12.5px; padding-top: 2px; }
  .bw-link--sec small { color: #B5AAB0; font-weight: 500; }
  .bw-tabela .bw-tam { grid-template-columns: 76px 1fr 1.3fr 24px; }
  .bw-tabela.bw-tam--serve .bw-tam { grid-template-columns: 70px 1fr 1fr 1.3fr 24px; }
  .bw-sheet-bg { position: fixed; inset: 0; z-index: 900; background: rgba(45,31,38,.45); display: flex; align-items: center; justify-content: center; padding: 16px; font-family: var(--font-base); }
  .bw-sheet { width: 100%; max-width: 440px; background: #fff; border-radius: 22px; padding: 16px 18px 18px; box-shadow: 0 24px 60px rgba(44,18,25,.3); color: #2C1219; }
  .bw-grab { display: none; width: 40px; height: 4px; border-radius: 2px; background: #E5DDE0; margin: 0 auto 10px; }
  .bw-sheet-h { display: flex; align-items: center; justify-content: space-between; }
  .bw-sheet-h b { font-size: 17px; font-weight: 800; }
  .bw-sheet-h button { width: 32px; height: 32px; border-radius: 50%; border: none; background: #F5F0F2; color: #6B5D64; cursor: pointer; font-size: 13px; }
  .bw-sheet .bw-gerar-bt { width: 100%; height: 48px; margin-top: 16px; }
  .bw-sheet .bw-prev { margin-top: 12px; }
  .bw-gopt { width: 100%; display: flex; gap: 10px; align-items: flex-start; text-align: left; border: 1.5px solid #EAE3E6; border-radius: 14px; padding: 12px; margin-top: 8px; background: #fff; font-family: inherit; cursor: pointer; color: #2C1219; }
  .bw-gopt > i { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #D6CBD0; flex-shrink: 0; margin-top: 1px; }
  .bw-gopt.on { border-color: #2C1219; background: #FAF7F8; } .bw-gopt.on > i { border: 5px solid #2C1219; }
  .bw-gopt > span { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .bw-gopt b { font-size: 14px; } .bw-gopt small { font-size: 12.5px; color: #888780; margin-top: 2px; }
  .bw-gopt .bw-frase--gerar { margin-top: 10px; font-size: 13.5px; }
  .bw-gopt .bw-passos { margin-top: 10px; }
  @media (max-width: 767px) {
    .bw-sheet-bg { align-items: flex-end; padding: 0; }
    .bw-sheet { max-width: none; border-radius: 22px 22px 0 0; padding-bottom: calc(18px + env(safe-area-inset-bottom, 0px)); }
    .bw-grab { display: block; }
    .bw-tabela .bw-tam, .bw-tabela.bw-tam--serve .bw-tam { grid-template-areas: none; }
    .bw-tabela .bw-tam { grid-template-columns: 68px 1fr 1.3fr 20px; }
    .bw-tabela.bw-tam--serve .bw-tam { grid-template-columns: 62px 1fr 1fr 1.2fr 18px; }
    .bw-tabela input.bw-in { font-size: 16px; padding: 0 6px; }
    .bw-tabela .bw-tam > * { grid-area: auto !important; }
    .bw-tabela .bw-tam--h { display: grid; }
    .bw-tabela .bw-tam { border-bottom: none; padding-bottom: 0; }
    .bw-money input { font-size: 22px; }
  }
  .bw-kg-t { display: inline-flex; align-items: center; gap: 8px; }
  .bw-kg-t small { font-size: 12px; font-weight: 600; color: #9A8E94; }
  .bw-i { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid #C33A6E; background: #fff; color: #C33A6E; font-family: inherit; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
  .bw-tams-h { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-top: 22px; margin-bottom: 8px; }
  .bw-tams-h .bw-lb { margin: 0; }
  .bw-rend { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #9A8E94; font-weight: 600; }
  .bw-rend span { margin-right: 4px; }
  .bw-rend button { border: 1.5px solid #EAE3E6; background: #fff; border-radius: 999px; padding: 5px 12px; font-family: inherit; font-size: 12.5px; font-weight: 700; color: #6B5D64; cursor: pointer; }
  .bw-rend button.on { border-color: #2C1219; background: #2C1219; color: #fff; }
  .bw-gerar { border: 1.5px dashed #E5C7D3; background: #FFFAFC; border-radius: 16px; padding: 16px; }
  .bw-gerar > b { font-size: 15px; color: #2C1219; }
  .bw-frase--gerar { margin-top: 12px; }
  .bw-in--curto { width: 88px; }
  .bw-passos { display: inline-flex; gap: 6px; }
  .bw-passos button { border: 1.5px solid #EAE3E6; background: #fff; border-radius: 10px; padding: 9px 12px; font-family: inherit; font-size: 13px; font-weight: 700; color: #4B3A42; cursor: pointer; }
  .bw-passos button.on { border-color: #2C1219; background: #2C1219; color: #fff; }
  .bw-prev { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
  .bw-prev span { background: #fff; border: 1px solid #F0E4EA; border-radius: 10px; padding: 6px 10px; font-size: 12.5px; color: #4B3A42; }
  .bw-prev b { color: #15803D; margin-left: 4px; }
  .bw-gerar-bt { margin-top: 14px; height: 44px; border: none; border-radius: 12px; background: #2C1219; color: #fff; font-family: inherit; font-size: 14px; font-weight: 700; padding: 0 20px; cursor: pointer; }
  .bw-gerar-bt:disabled { opacity: .3; cursor: default; }
  .bw-pmg { width: 100%; border: 1.5px dashed #E5C7D3; background: #FFFAFC; border-radius: 14px; padding: 16px; font-family: inherit; cursor: pointer; color: #C33A6E; display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .bw-pmg b { font-size: 15px; } .bw-pmg small { font-size: 12.5px; color: #888780; }
  .bw-tams { display: flex; flex-direction: column; gap: 8px; }
  .bw-tam { display: grid; grid-template-columns: 64px 1fr 1.2fr 1.2fr 24px; gap: 8px; align-items: center; }
  .bw-tam--h span { font-size: 12px; font-weight: 700; color: #9A8E94; text-transform: uppercase; letter-spacing: .04em; padding-left: 4px; }
  .bw-in, .bw-rs { height: 44px; border: 1.5px solid #EAE3E6; border-radius: 12px; background: #fff; display: flex; align-items: center; min-width: 0; transition: border-color .15s; }
  .bw-in:focus-within, .bw-rs:focus-within, input.bw-in:focus { border-color: #2C1219; outline: none; }
  input.bw-in { padding: 0 10px; font-family: inherit; font-size: 16px; font-weight: 800; color: #2C1219; text-align: center; width: 100%; }
  .bw-in input, .bw-rs input { flex: 1; min-width: 0; width: 100%; border: none; outline: none; background: none; font-family: inherit; font-size: 16px; font-weight: 700; color: #2C1219; padding: 0 0 0 10px; }
  .bw-suf em { font-style: normal; font-size: 12px; color: #9A8E94; padding: 0 10px 0 4px; white-space: nowrap; }
  .bw-rs { padding-left: 10px; font-size: 12.5px; font-weight: 700; color: #9A8E94; gap: 2px; }
  .bw-rs input { padding-left: 4px; } .bw-rs.ok input { color: #15803D; }
  .bw-rs--lg { width: 150px; background: #fff; } .bw-rs--xl { height: 60px; max-width: 260px; font-size: 16px; } .bw-rs--xl input { font-size: 24px; font-weight: 800; }
  .bw-calc { font-size: 14.5px; font-weight: 800; color: #15803D; padding-left: 6px; }
  .bw-x { border: none; background: none; color: #C4B8BE; font-size: 13px; cursor: pointer; padding: 4px; }
  .bw-x:hover { color: #DC2626; }
  .bw-link { align-self: flex-start; border: none; background: none; color: #C33A6E; font-family: inherit; font-size: 13.5px; font-weight: 700; padding: 6px 2px; cursor: pointer; }
  .bw-promo { border: 1.5px solid #EDE5E8; border-radius: 14px; margin-top: 22px; background: #fff; }
  .bw-promo.on { border-color: #F3D6E2; background: #FFFAFC; }
  .bw-promo-h { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 13px 14px; border: none; background: none; font-family: inherit; font-size: 14px; font-weight: 700; color: #2C1219; cursor: pointer; }
  .bw-promo .bw-frase { margin: 0; padding: 0 14px 14px; }
  .bw-promo .bw-frase small { color: #9A8E94; font-size: 12.5px; }
  .bw-in--pct { width: 90px; }
  .bw-tg { width: 40px; height: 23px; border-radius: 12px; background: #E5DDE0; position: relative; flex-shrink: 0; font-style: normal; }
  .bw-tg > i { position: absolute; top: 3px; left: 3px; width: 17px; height: 17px; border-radius: 50%; background: #fff; transition: left .15s; }
  .bw-tg.on { background: #E85A8C; } .bw-tg.on > i { left: 20px; }
  @media (max-width: 767px) {
    .bw-h { font-size: 20px; }
    .bw-opt-b { padding: 0 14px 14px; }
    .bw-modos { grid-template-columns: 1fr; }
    .bw-tam { grid-template-columns: 52px 1fr 1fr; grid-template-areas: "n p s" "r r x"; row-gap: 6px; padding-bottom: 10px; border-bottom: 1px solid #F3ECEE; }
    .bw-tam--h { display: none; }
    .bw-tam > :nth-child(1) { grid-area: n; } .bw-tam > :nth-child(2) { grid-area: p; } .bw-tam > :nth-child(3) { grid-area: s; }
    .bw-tam > :nth-child(4) { grid-area: r; } .bw-tam > :nth-child(5) { grid-area: x; justify-self: end; }
    .bw-tam { grid-template-columns: 52px 1fr 1fr; }
  }
  /* Ajustes de design (30/09): cantos menores, colunas largas, sem abreviação */
  .bw-in, .bw-rs, .bw-add input, .bw-add button, .bw-money, .bw-stepper, .bw-passos button, .bw-gerar-bt, .bw-extra > button { border-radius: 8px !important; }
  .bw-sn button, .bw-modos button, .bw-opt, .bw-gopt, .bw-box, .bw-pmg, .bw-gerar { border-radius: 12px !important; }
  .bw-seg3 { border-radius: 10px; } .bw-seg3 button { border-radius: 7px; }
  .bw-tabela .bw-tam, .bw-tabela.bw-tam--serve .bw-tam { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1.2fr) 28px; gap: 10px; margin-top: 8px; }
  .bw-tabela .bw-tam--h { margin-top: 0; }
  .bw-tabela .bw-tam--h span { font-size: 12px; font-weight: 700; color: #9A8E94; text-transform: uppercase; letter-spacing: .05em; padding-left: 2px; }
  .bw-tabela input.bw-in { text-align: left; padding: 0 12px; font-size: 16px; font-weight: 700; }
  .bw-tabela .bw-in input { padding-left: 12px; }
  .bw-tabela .bw-rs { padding-left: 12px; }
  .bw-rs-p { font-size: 13px; font-weight: 700; color: #9A8E94; }
  .bw-tabela .bw-calc { display: flex; align-items: center; padding: 0 12px; background: #FAF7F8; border-color: #F0EBED; color: #B5AAB0; font-size: 13px; font-weight: 600; }
  .bw-tabela .bw-calc.ok { background: #F0FDF4; border-color: #DCFCE7; color: #15803D; font-size: 14.5px; font-weight: 800; }
  .bw-rendbox { margin-top: 14px; padding-top: 14px; border-top: 1px solid #F3ECEE; }
  .bw-check { display: flex; align-items: center; gap: 10px; width: 100%; border: none; background: none; padding: 4px 0; font-family: inherit; font-size: 14px; font-weight: 600; color: #2C1219; cursor: pointer; text-align: left; }
  .bw-check i { width: 20px; height: 20px; border-radius: 6px; border: 2px solid #D6CBD0; display: flex; align-items: center; justify-content: center; font-style: normal; font-size: 12px; font-weight: 900; color: #fff; flex-shrink: 0; }
  .bw-check.on i { background: #E85A8C; border-color: #E85A8C; }
  .bw-rend-body { margin-top: 12px; padding: 14px; border-radius: 12px; background: #FAF7F8; }
  .bw-rend-uni { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; font-size: 13px; color: #6B5D64; font-weight: 600; }
  .bw-rend-uni span { margin-right: 4px; }
  .bw-rend-uni button { border: 1.5px solid #EAE3E6; background: #fff; border-radius: 8px; padding: 7px 14px; font-family: inherit; font-size: 13px; font-weight: 700; color: #6B5D64; cursor: pointer; }
  .bw-rend-uni button.on { border-color: #2C1219; background: #2C1219; color: #fff; }
  .bw-rend-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; }
  .bw-rend-row + .bw-rend-row { border-top: 1px solid #F0E9EC; }
  .bw-rend-lb { font-size: 14px; color: #4B3A42; } .bw-rend-lb b { color: #2C1219; } .bw-rend-lb small { color: #9A8E94; font-size: 12.5px; }
  .bw-rend-in { width: 170px; background: #fff; flex-shrink: 0; }
  .bw-rend-in em { padding-right: 12px; }
  @media (max-width: 767px) {
    .bw-tabela .bw-tam, .bw-tabela.bw-tam--serve .bw-tam { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.25fr) 20px; gap: 6px; }
    .bw-tabela .bw-tam--h span { font-size: 12px; letter-spacing: .03em; }
    .bw-tabela input.bw-in, .bw-tabela .bw-in input { font-size: 16px; }
    .bw-tabela input.bw-in { padding: 0 8px; } .bw-tabela .bw-in input { padding-left: 8px; } .bw-tabela .bw-rs { padding-left: 8px; }
    .bw-tabela .bw-calc { padding: 0 8px; font-size: 12px; } .bw-tabela .bw-calc.ok { font-size: 13.5px; }
    .bw-rend-in { width: 140px; }
  }

  /* Topo centralizado (igual às outras telas do cadastro) */
  .bw-topo { text-align: center; margin-bottom: 18px; }
  .bw-topo .bw-h { margin: 6px auto 6px; max-width: 520px; }
  .bw-topo .bw-sub { margin: 0 auto; max-width: 440px; }
  .bw-topo .bw-sub b { color: #2C1219; }
  .bw-topo .bw-h, .bw-topo .bw-sub { text-wrap: balance; }
  .bw-produto { display: inline-block; max-width: 100%; margin: 2px 0 8px; padding: 4px 12px; border-radius: 999px; background: #FCE7F3; color: #9D174D; font-size: 12.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* Etapa 2 — cartões de opção (aprovado 30/09) */
  .bo-card { border: 1px solid #EDE5E8; border-radius: 12px; background: #fff; margin-bottom: 10px; transition: border-color .15s, box-shadow .15s; }
  .bo-card.on { border-color: #E85A8C; box-shadow: 0 0 0 3px #FCE7F3; }
  .bo-card.resumo { border-color: #F0E0E7; box-shadow: none; background: #FFFCFD; }
  .bo-h { display: flex; align-items: center; gap: 10px; padding: 12px 14px; }
  .bo-h-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; border: none; background: none; padding: 0; font-family: inherit; text-align: left; cursor: pointer; color: #2C1219; }
  .bo-ic { width: 42px; height: 42px; border-radius: 10px; background: #FCE7F3; display: flex; align-items: center; justify-content: center; font-size: 21px; flex-shrink: 0; }
  .bo-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .bo-tx b { font-size: 15px; font-weight: 700; }
  .bo-tx small { font-size: 12.5px; color: #888780; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bo-tx small.on { color: #C33A6E; font-weight: 600; }
  .bo-rs { font-size: 13px; color: #4B3A42; margin-top: 3px; line-height: 1.45; }
  .bo-rs em { font-style: normal; color: #15803D; font-weight: 700; }
  .bo-rs small { display: block; font-size: 12px; color: #9A8E94; margin-top: 2px; white-space: normal; }
  .bo-ck { width: 26px; height: 26px; border-radius: 7px; border: 2px solid #D6CBD0; background: #fff; color: #fff; font-size: 14px; font-weight: 900; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; padding: 0; }
  .bo-ck.on { background: #E85A8C; border-color: #E85A8C; }
  .bo-editar { border: 1px solid #F9D1E0; background: #FFF1F6; color: #C33A6E; border-radius: 8px; padding: 7px 12px; font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; flex-shrink: 0; }
  .bo-body { padding: 0 14px 14px; }
  .bo-lista { border: 1px solid #F0EBED; border-radius: 10px; overflow: hidden; }
  .bo-li { display: flex; align-items: center; gap: 8px; min-height: 50px; padding: 0 6px 0 14px; border-top: 1px solid #F3ECEE; }
  .bo-li:first-child { border-top: none; }
  .bo-nm { flex: 1; min-width: 0; font-size: 14.5px; font-weight: 700; color: #2C1219; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bo-vx { border: 1.5px dashed #DCCFD5; background: none; border-radius: 999px; padding: 6px 12px; font-family: inherit; font-size: 12.5px; font-weight: 700; color: #9A8E94; cursor: pointer; white-space: nowrap; }
  .bo-vx:hover { border-color: #C33A6E; color: #C33A6E; }
  .bo-vx.tem { border: 1.5px solid #BBF7D0; background: #F0FDF4; color: #15803D; font-weight: 800; }
  .bo-rm { width: 36px; height: 36px; border: none; background: none; border-radius: 8px; color: #B5AAB0; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; margin-left: 2px; }
  .bo-rm:hover { color: #DC2626; background: #FEF2F2; }
  .bo-li--add { background: #FCFAFB; padding-right: 10px; }
  .bo-li--add input { flex: 1; min-width: 0; height: 48px; border: none; outline: none; background: none; font-family: inherit; font-size: 16px; color: #2C1219; }
  .bo-li--add input::placeholder { color: #B5AAB0; }
  .bo-li--add button { border: none; background: none; font-family: inherit; font-size: 13.5px; font-weight: 800; color: #C33A6E; cursor: pointer; padding: 8px 4px; white-space: nowrap; }
  .bo-li--add button:disabled { color: #D6CBD0; cursor: default; }
  .bo-lim { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #F3ECEE; font-size: 14px; font-weight: 600; color: #2C1219; }
  .bo-tip { font-size: 12.5px; color: #9A8E94; margin: 6px 0 0; text-align: center; }
  .bo-sheet-acts { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; }
  .bo-sheet-tirar { border: none; background: none; font-family: inherit; font-size: 13.5px; font-weight: 700; color: #6B5D64; cursor: pointer; padding: 8px 0; }
  .bo-sheet-ok { height: 46px; border: none; border-radius: 8px; background: #2C1219; color: #fff; font-family: inherit; font-size: 14.5px; font-weight: 800; padding: 0 28px; cursor: pointer; }
  @media (max-width: 767px) {
    .bo-h { padding: 12px; } .bo-ic { width: 40px; height: 40px; font-size: 20px; }
    .bo-body { padding: 0 12px 12px; }
    .bo-li { padding-left: 12px; }
    .bo-vx { padding: 6px 10px; font-size: 12px; }
  }

  /* Patch 30/09: tamanhos e preço separados */
  .bw-hint--centro { text-align: center; margin-top: 14px; }
  .bw-hint--sob { margin: -4px 0 12px; }
  .bw-gerar-btn { border: 1px solid #F3D6E2; background: #FFF6F9; color: #C33A6E; border-radius: 6px; padding: 8px 12px; font-family: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; }
  .bw-gerar-btn:hover { background: #FCE7F3; }
  .bw-t2 { display: flex; flex-direction: column; gap: 8px; }
  .bw-t2-row { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) 36px; gap: 10px; align-items: center; }
  .bw-t2-row--h span { font-size: 12px; font-weight: 700; color: #9A8E94; text-transform: uppercase; letter-spacing: .05em; padding-left: 2px; white-space: nowrap; }
  input.bw-t2-nome { text-align: left; padding: 0 12px; font-size: 16px; font-weight: 700; }
  .bw-t2 .bw-in input { padding-left: 12px; }
  .bw-check2 { display: flex; align-items: flex-start; gap: 12px; width: 100%; margin-top: 18px; border: none; background: none; padding: 0; font-family: inherit; text-align: left; cursor: pointer; color: #2C1219; }
  .bw-check2 > i { width: 24px; height: 24px; border-radius: 5px; border: 2px solid #D6CBD0; display: flex; align-items: center; justify-content: center; font-style: normal; font-size: 13px; font-weight: 900; color: #fff; flex-shrink: 0; margin-top: 1px; }
  .bw-check2.on > i { background: #E85A8C; border-color: #E85A8C; }
  .bw-check2 > span { display: flex; flex-direction: column; min-width: 0; }
  .bw-check2 b { font-size: 14px; font-weight: 700; white-space: nowrap; }
  .bw-check2 small { font-size: 12.5px; color: #888780; line-height: 1.4; margin-top: 3px; }
  .bw-modos--col { grid-template-columns: 1fr !important; }
  .bw-pr { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; }
  .bw-pr-lb { font-size: 14px; color: #4B3A42; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bw-pr-lb b { color: #2C1219; font-size: 14.5px; } .bw-pr-lb small { color: #9A8E94; font-size: 12.5px; }
  .bw-pr-in { width: 160px; flex-shrink: 0; padding-left: 12px; }
  .bw-pr-calc { width: 160px; flex-shrink: 0; display: flex; align-items: center; padding: 0 12px; background: #FAF7F8; border-color: #F0EBED; color: #B5AAB0; font-size: 12.5px; font-weight: 600; }
  .bw-pr-calc.ok { background: #F0FDF4; border-color: #DCFCE7; color: #15803D; font-size: 15px; font-weight: 800; }
  .bw-money--sm { width: 170px !important; }
  .bw-money--sm em { font-size: 12.5px; }
  @media (max-width: 767px) {
    .bw-t2-row { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) 32px; gap: 8px; }
    .bw-pr-in, .bw-pr-calc { width: 140px; }
    .bw-check2 b { font-size: 13.5px; }
    .bw-money--sm { width: 160px !important; padding: 0 10px !important; gap: 4px !important; }
    .bw-money--sm input { font-size: 16px !important; }
    .bw-kg { padding: 10px 12px; }
  }
  .bw-kg-t { white-space: nowrap; flex-shrink: 0; }

  /* Patch: lista de tamanhos com divisórias + "Editar lista" */
  .bw-tt { font-size: 17px; font-weight: 800; color: #2C1219; margin: 0; }
  .bw-tt-sub { font-size: 13.5px; color: #6B5D64; line-height: 1.45; margin: 4px 0 12px; }
  .bw-gerar-btn { display: inline-block; padding: 9px 14px; font-size: 13px; }
  .bw-lt { margin-top: 12px; border: 1px solid #EDE5E8; border-radius: 10px; overflow: hidden; background: #fff; }
  .bw-lt-h, .bw-lt-row { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); align-items: stretch; }
  .bw-lt--ed .bw-lt-row { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr) 44px; }
  .bw-lt-h { position: relative; background: #FAF7F8; border-bottom: 1px solid #EDE5E8; }
  .bw-lt-h span { font-size: 12px; font-weight: 700; color: #9A8E94; text-transform: uppercase; letter-spacing: .05em; padding: 10px 14px; white-space: nowrap; }
  .bw-lt-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .bw-lt-edit { border: 1px solid #EAE3E6; background: #fff; border-radius: 6px; font-family: inherit; font-size: 13px; font-weight: 700; color: #4B3A42; cursor: pointer; padding: 9px 14px; white-space: nowrap; }
  .bw-lt-edit.on { background: #2C1219; border-color: #2C1219; color: #fff; }
  .bw-lt--ed .bw-lt-h { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr) 44px; }
  .bw-lt-row { border-top: 1px solid #F3ECEE; min-height: 52px; }
  .bw-lt-h + .bw-lt-row { border-top: none; }
  .bw-lt-nome { border: none; outline: none; background: none; padding: 0 14px; font-family: inherit; font-size: 15px; font-weight: 700; color: #2C1219; min-width: 0; }
  .bw-lt-peso { display: flex; align-items: center; gap: 4px; border-left: 1px solid #F3ECEE; padding: 0 14px; min-width: 0; cursor: text; }
  .bw-lt-peso input { flex: 1; min-width: 0; border: none; outline: none; background: none; font-family: inherit; font-size: 16px; font-weight: 700; color: #2C1219; padding: 0; }
  .bw-lt-peso em { font-style: normal; font-size: 12.5px; color: #9A8E94; font-weight: 600; }
  .bw-lt-nome::placeholder, .bw-lt-peso input::placeholder { color: #B5AAB0; font-weight: 500; }
  .bw-lt-nome:focus, .bw-lt-peso:focus-within { background: #FFFAFC; }
  .bw-lt-rm { border: none; border-left: 1px solid #F3ECEE; background: none; color: #DC2626; display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .bw-lt-rm:hover { background: #FEF2F2; }
  .bw-lt-add { display: block; width: 100%; text-align: left; border: none; border-top: 1px solid #F3ECEE; background: #FCFAFB; padding: 15px 14px; font-family: inherit; font-size: 14px; font-weight: 800; color: #C33A6E; cursor: pointer; }
  .bw-lt-h + .bw-lt-add { border-top: none; }
  .bw-check2 { margin-top: 20px; }

  /* Patch: títulos no cinza das etapas, rendimento obrigatório, promoção */
  .bw-h { color: #4B5563 !important; }
  .bw-falta { font-size: 12.5px; font-weight: 700; color: #B45309; margin: 0 0 10px; }
  .bw-pr-rend { display: block; font-size: 12px !important; color: #9A8E94 !important; margin-top: 1px; }
  .bw-pr-lb { white-space: normal; }
  .bw-hint--sob2 { margin: -6px 0 10px; }
  .bw-promo2 .bw-check2 { margin-top: 0; }
  .bw-promo-body { margin-top: 14px; display: flex; flex-direction: column; gap: 12px; }
  .bw-promo-body .bw-frase { margin-top: 0; }
  .bw-seg2 { grid-template-columns: 1fr 1fr !important; }

  .bw-pr-col { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
  .bw-pr-por { font-size: 12px; color: #6B5D64; } .bw-pr-por b { color: #15803D; font-weight: 800; }
  .bw-pr-por--unico { margin: 8px 0 0; font-size: 13px; }
  .bw-pr-calc--promo { gap: 6px; } .bw-pr-calc--promo s { color: #9A8E94; font-weight: 600; font-size: 12px; }
`;

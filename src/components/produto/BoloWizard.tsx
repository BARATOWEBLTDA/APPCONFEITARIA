import { useEffect, useState } from "react";
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
const numKg = (v: string) => { const n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? 0 : n; };
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

export function BoloOpcoesStep({ form, setForm }: { form: any; setForm: (fn: (f: any) => any) => void }) {
  const [texto, setTexto] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<string | null>(null); // id da opção com o "cobra a mais?" aberto
  const nome = (form.nome || "").trim() || "seu bolo";
  const grupo = (key: string): Grupo => ({ ...GRUPO_VAZIO, ...(form[key] || {}) });
  const setGrupo = (key: string, patch: Partial<Grupo>) => setForm((f: any) => ({ ...f, [key]: { ...GRUPO_VAZIO, ...(f[key] || {}), ...patch } }));

  const alternar = (key: string) => {
    const g = grupo(key);
    const ligando = !g.ativo;
    setGrupo(key, { ativo: ligando, min: 1, max: key === "grupo_recheios" ? (g.max > 1 && g.max < 99 ? g.max : 2) : 1 });
  };
  const adicionar = (key: string, valor: string) => {
    const n = titulo(valor);
    if (!n) return;
    const g = grupo(key);
    if (g.opcoes.some(o => o.nome.toLowerCase() === n.toLowerCase())) { setTexto(t => ({ ...t, [key]: "" })); return; }
    setGrupo(key, { opcoes: [...g.opcoes, { id: uid(), nome: n, adicional: 0 }] });
    setTexto(t => ({ ...t, [key]: "" }));
  };

  return (
    <div className="bw">
      <p className="bw-eta">Etapa 2 de 4</p>
      <h2 className="bw-h">O <span>{nome}</span> deixa o cliente escolher alguma opção?</h2>
      <p className="bw-sub">Marque só o que o cliente escolhe. Se não tiver nenhuma, é só tocar em Avançar.</p>

      {TIPOS_OPCAO.map(t => {
        const g = grupo(t.key);
        return (
          <div key={t.key} className={`bw-opt${g.ativo ? " on" : ""}`}>
            <button type="button" className="bw-opt-h" onClick={() => alternar(t.key)} aria-pressed={g.ativo}>
              <i aria-hidden="true">{g.ativo ? "✓" : ""}</i>
              <b>{t.titulo}</b>
              {g.ativo && g.opcoes.length > 0 && <em>{g.opcoes.length} {g.opcoes.length === 1 ? "opção" : "opções"}</em>}
            </button>
            {g.ativo && (
              <div className="bw-opt-b">
                {g.opcoes.length > 0 && (
                  <div className="bw-chips">
                    {g.opcoes.map(o => (
                      <span key={o.id} className={`bw-chip${editando === o.id ? " ed" : ""}`}>
                        <button type="button" className="bw-chip-n" onClick={() => setEditando(e => e === o.id ? null : o.id)} title="Toque pra cobrar a mais por essa opção">
                          {o.nome}{o.adicional > 0 && <small> +{brl(o.adicional)}</small>}
                        </button>
                        <button type="button" className="bw-chip-x" onClick={() => setGrupo(t.key, { opcoes: g.opcoes.filter(x => x.id !== o.id) })} aria-label={`Tirar ${o.nome}`}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
                {editando && g.opcoes.some(o => o.id === editando) && (() => {
                  const o = g.opcoes.find(x => x.id === editando)!;
                  return (
                    <div className="bw-extra">
                      <span><b>{o.nome}</b> cobra a mais?</span>
                      <label className="bw-rs">R$ <MoneyInput autoFocus value={o.adicional} ariaLabel={`Quanto ${o.nome} custa a mais`}
                        onChange={v => setGrupo(t.key, { opcoes: g.opcoes.map(x => x.id === o.id ? { ...x, adicional: v, tipo_adicional: "fixo" } : x) })} /></label>
                      <button type="button" onClick={() => setEditando(null)}>Pronto</button>
                    </div>
                  );
                })()}
                <div className="bw-add">
                  <input value={texto[t.key] || ""} placeholder={t.ph} onChange={e => setTexto(x => ({ ...x, [t.key]: e.target.value }))}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); adicionar(t.key, texto[t.key] || ""); } }} aria-label={`Nova opção de ${t.titulo.toLowerCase()}`} />
                  <button type="button" onClick={() => adicionar(t.key, texto[t.key] || "")} disabled={!(texto[t.key] || "").trim()}>Adicionar</button>
                </div>
                {t.key === "grupo_recheios" && (
                  <div className="bw-frase">
                    O cliente escolhe até
                    <span className="bw-stepper">
                      <button type="button" onClick={() => setGrupo(t.key, { max: Math.max(1, (g.max || 1) - 1) })} disabled={(g.max || 1) <= 1} aria-label="Menos">−</button>
                      <b>{g.max >= 99 ? 2 : g.max}</b>
                      <button type="button" onClick={() => setGrupo(t.key, { max: Math.min(5, (g.max >= 99 ? 2 : g.max) + 1) })} disabled={g.max >= 5 && g.max < 99} aria-label="Mais">+</button>
                    </span>
                    {(g.max >= 99 ? 2 : g.max) === 1 ? "recheio" : "recheios"}
                  </div>
                )}
                {g.opcoes.length > 0 && <p className="bw-dica">Dica: toque numa opção pra cobrar a mais por ela (ex: Nutella + R$ 10).</p>}
              </div>
            )}
          </div>
        );
      })}
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

// ═══════════════════ Etapa 3 · Tamanhos e preço ═══════════════════
export type BoloTam = "sim" | "nao" | null;

export function boloTamanhosOk(form: any, escolha: BoloTam): boolean {
  if (!escolha) return false;
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

export function BoloTamanhosStep({ form, setForm, escolha, setEscolha, primeiroNome }: {
  form: any; setForm: (fn: (f: any) => any) => void; escolha: BoloTam; setEscolha: (e: BoloTam) => void; primeiroNome?: string;
}) {
  const [infoBase, setInfoBase] = useState(false);
  const [gerarAberto, setGerarAberto] = useState(false);
  const [gModo, setGModo] = useState<"pmg" | "peso">("pmg");
  const [gDe, setGDe] = useState("1");
  const [gAte, setGAte] = useState("3");
  const [gPasso, setGPasso] = useState(0.5);

  const gt = { ...GRUPO_VAZIO, modo_preco_tamanho: "preco_fixo", nome_exibicao: "Tamanhos e Pesos", ...(form.grupo_tamanhos || {}) } as any;
  const tams: Tam[] = gt.opcoes || [];
  const porPeso = gt.modo_preco_tamanho === "por_peso";
  const fatias = gt.rendimento_unidade === "fatias";
  const [mostrarServe, setMostrarServe] = useState(() => tams.some(t => t.serve));
  const setGt = (patch: any) => setForm((f: any) => ({ ...f, grupo_tamanhos: { ...GRUPO_VAZIO, modo_preco_tamanho: "preco_fixo", nome_exibicao: "Tamanhos e Pesos", ...(f.grupo_tamanhos || {}), ...patch } }));
  const setTam = (id: string, patch: Partial<Tam>) => setGt({ opcoes: tams.map(t => t.id === id ? { ...t, ...patch } : t) });
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
        const g = { ...GRUPO_VAZIO, modo_preco_tamanho: "preco_fixo", nome_exibicao: "Tamanhos e Pesos", ...(f.grupo_tamanhos || {}) };
        return { ...f, forma_venda: "unidade", grupo_tamanhos: { ...g, ativo: true, min: 1, max: 1, opcoes: g.opcoes?.length ? g.opcoes : [linhaVazia()] } };
      });
    } else {
      setForm((f: any) => ({ ...f, forma_venda: VENDA.some(x => x.v === f.forma_venda) ? f.forma_venda : "unidade", grupo_tamanhos: { ...GRUPO_VAZIO, ...(f.grupo_tamanhos || {}), ativo: false } }));
    }
  };

  const kgTxt = (v: number) => `${String(Math.round(v * 100) / 100).replace(".", ",")} kg`;
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
  const temNomes = tams.some(t => t.nome.trim());
  const precoBase = form.preco_normal || 0;
  const exBase = precoBase > 0 ? precoBase : 80;
  const suf = VENDA.find(x => x.v === form.forma_venda)?.suf || "unidade";
  const cols = mostrarServe ? "bw-tam--serve" : "";

  return (
    <div className="bw">
      <p className="bw-eta">Etapa 3 de 4</p>
      <h2 className="bw-h">Esse bolo tem mais de um tamanho ou peso?</h2>
      <p className="bw-sub">Ex: P, M e G · aro 15, 20 e 25 · 1 kg, 2 kg e 3 kg</p>
      <div className="bw-sn" role="radiogroup">
        <button type="button" role="radio" aria-checked={escolha === "sim"} className={escolha === "sim" ? "on" : ""} onClick={() => escolher("sim")}>
          <b>Sim</b><small>P, M, G ou por kg</small>
        </button>
        <button type="button" role="radio" aria-checked={escolha === "nao"} className={escolha === "nao" ? "on" : ""} onClick={() => escolher("nao")}>
          <b>Não</b><small>É um tamanho só</small>
        </button>
      </div>

      {escolha === "nao" && (
        <div className="bw-box">
          <p className="bw-bt">Como você vende esse bolo?</p>
          <div className="bw-seg3" role="radiogroup">
            {VENDA.map(x => (
              <button key={x.v} type="button" role="radio" aria-checked={form.forma_venda === x.v} className={form.forma_venda === x.v ? "on" : ""}
                onClick={() => setForm((f: any) => ({ ...f, forma_venda: x.v }))}>{x.t}</button>
            ))}
          </div>
          <p className="bw-bt bw-bt--mt">Qual o preço?</p>
          <label className="bw-money">
            <span>R$</span>
            <MoneyInput value={form.preco_normal || 0} onChange={v => setForm((f: any) => ({ ...f, preco_normal: v }))} ariaLabel="Preço do bolo" />
            <em>/ {suf}</em>
          </label>
          <p className="bw-hint">Digite só os números — a vírgula e o ponto aparecem sozinhos.</p>
        </div>
      )}

      {escolha === "sim" && (
        <>
          <div className="bw-box">
            <p className="bw-bt">Como é o preço?</p>
            <div className="bw-modos" role="radiogroup">
              <button type="button" role="radio" aria-checked={!porPeso} className={!porPeso ? "on" : ""} onClick={() => setGt({ modo_preco_tamanho: "preco_fixo" })}>
                <i aria-hidden="true" /><span><b>Cada tamanho tem seu preço</b><small>Você digita o preço de cada um</small></span>
              </button>
              <button type="button" role="radio" aria-checked={porPeso} className={porPeso ? "on" : ""} onClick={() => setGt({ modo_preco_tamanho: "por_peso" })}>
                <i aria-hidden="true" /><span><b>Calcular pelo peso</b><small>Você diz o preço do kg e o app calcula</small></span>
              </button>
            </div>
            {porPeso && (
              <div className="bw-kg">
                <span className="bw-kg-t">Preço base
                  <button type="button" className="bw-i" onClick={() => setInfoBase(true)} aria-label="O que é o preço base?">i</button>
                  <small>por kg</small>
                </span>
                <label className="bw-money bw-money--sm"><span>R$</span>
                  <MoneyInput value={precoBase} onChange={v => setForm((f: any) => ({ ...f, preco_normal: v }))} ariaLabel="Preço base por kg" />
                </label>
              </div>
            )}
          </div>

          <div className="bw-box">
            <div className="bw-bh">
              <p className="bw-bt">Tamanhos</p>
              <button type="button" className="bw-gerar-pill" onClick={() => { setGModo(porPeso ? "peso" : "pmg"); setGerarAberto(true); }}>⚡ Gerar automático</button>
            </div>
            <div className={`bw-tabela ${cols}`}>
              <div className="bw-tam bw-tam--h" aria-hidden="true">
                <span>Nome</span><span>Peso</span>
                {mostrarServe && (
                  <button type="button" className="bw-col-sel" onClick={() => setGt({ rendimento_unidade: fatias ? "pessoas" : "fatias" })} title="Trocar entre pessoas e fatias">
                    {fatias ? "Fatias" : "Serve"} ▾
                  </button>
                )}
                <span>{porPeso ? "Fica" : "Preço"}</span><span />
              </div>
              {tams.map(t => (
                <div className="bw-tam" key={t.id}>
                  <input className="bw-in bw-in--nome" value={t.nome} placeholder={porPeso ? "1 kg" : "P"} onChange={e => setTam(t.id, { nome: e.target.value })} aria-label="Nome do tamanho" />
                  <label className="bw-in bw-suf"><input inputMode="decimal" defaultValue={t.peso_kg ? String(t.peso_kg).replace(".", ",") : ""} placeholder="1,5"
                    onChange={e => setTam(t.id, { peso_kg: numKg(e.target.value) || null })} aria-label="Peso em kg" /><em>kg</em></label>
                  {mostrarServe && (
                    <label className="bw-in bw-suf"><input inputMode="numeric" value={t.serve || ""} placeholder="20"
                      onChange={e => setTam(t.id, { serve: e.target.value.replace(/\D/g, "") })} aria-label={fatias ? "Quantas fatias" : "Serve quantas pessoas"} /><em>{fatias ? "fatias" : "pess."}</em></label>
                  )}
                  {porPeso ? (
                    <span className="bw-calc">{precoBase > 0 && (t.peso_kg || 0) > 0 ? brl(precoBase * (t.peso_kg || 0)) : "—"}</span>
                  ) : (
                    <label className={`bw-rs${t.preco > 0 ? " ok" : ""}`}>R$
                      <MoneyInput value={t.preco} onChange={v => setTam(t.id, { preco: v })} ariaLabel={`Preço do tamanho ${t.nome || "novo"}`} />
                    </label>
                  )}
                  <button type="button" className="bw-x" onClick={() => setGt({ opcoes: tams.filter(x => x.id !== t.id) })} aria-label="Remover tamanho">✕</button>
                </div>
              ))}
            </div>
            <button type="button" className="bw-link" onClick={() => setGt({ opcoes: [...tams, linhaVazia()] })}>+ Adicionar tamanho</button>
            <button type="button" className="bw-link bw-link--sec" onClick={() => setMostrarServe(v => !v)}>
              {mostrarServe ? "Esconder quantas pessoas serve" : "+ Mostrar quantas pessoas cada tamanho serve"} <small>(opcional)</small>
            </button>
          </div>
        </>
      )}

      {/* ⚡ Gerar automático — abre por baixo */}
      {gerarAberto && createPortal(
        <div className="bw-sheet-bg" onClick={() => setGerarAberto(false)}>
          <div className="bw-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Gerar tamanhos">
            <div className="bw-grab" aria-hidden="true" />
            <div className="bw-sheet-h"><b>⚡ Gerar tamanhos</b><button type="button" onClick={() => setGerarAberto(false)} aria-label="Fechar">✕</button></div>
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
            {gerados.length > 0 && (
              <div className="bw-prev">{gerados.map(g => <span key={g.id}>{g.nome}{porPeso && precoBase > 0 && g.peso_kg ? <b> {brl(precoBase * g.peso_kg)}</b> : null}</span>)}</div>
            )}
            {temNomes && <p className="bw-hint">Isso substitui os tamanhos que você já digitou.</p>}
            <button type="button" className="bw-gerar-bt" disabled={!gerados.length}
              onClick={() => { setGt({ opcoes: gerados }); setGerarAberto(false); }}>
              Criar {gerados.length} {gerados.length === 1 ? "tamanho" : "tamanhos"}
            </button>
          </div>
        </div>, document.body)}

      {infoBase && (
        <DooInfoModal open onClose={() => setInfoBase(false)} image="/Sistema/precifique.png" imageAlt="Preço base"
          ariaLabel="O que é o preço base" title={<>{primeiroNome ? `${primeiroNome}, entenda` : "Entenda"} o <span style={{ color: "#C33A6E" }}>preço base</span>.</>}>
          <p style={{ margin: "0 0 12px" }}>O preço base é <strong>quanto você cobra por 1 kg</strong> desse bolo.</p>
          <p style={{ margin: "0 0 12px" }}>O app usa esse valor pra calcular o preço de cada tamanho sozinho:</p>
          <p style={{ margin: "0 0 12px" }}><strong>1 kg</strong> = {brl(exBase)} · <strong>1,5 kg</strong> = {brl(exBase * 1.5)} · <strong>2 kg</strong> = {brl(exBase * 2)}</p>
          <p style={{ margin: 0 }}>💡 Se você mudar o preço base, <strong>todos os tamanhos se atualizam juntos</strong>. Não precisa mexer um por um.</p>
        </DooInfoModal>
      )}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .bw { font-family: var(--font-base); color: #2C1219; padding: 4px 2px 12px; }
  .bw-eta { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #C33A6E; margin: 0; }
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
  .bw-chip-n small { font-size: 11.5px; font-weight: 700; color: #C33A6E; }
  .bw-chip-x { border: none; background: none; color: #C4789C; font-size: 11px; padding: 7px 11px 7px 5px; cursor: pointer; }
  .bw-extra { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: #fff; border: 1px solid #F3D6E2; border-radius: 12px; padding: 10px 12px; margin-bottom: 12px; font-size: 13.5px; color: #4B3A42; }
  .bw-extra > button { margin-left: auto; border: none; background: #2C1219; color: #fff; font-family: inherit; font-size: 12.5px; font-weight: 700; border-radius: 9px; padding: 8px 14px; cursor: pointer; }
  .bw-add { display: flex; gap: 8px; }
  .bw-add input { flex: 1; min-width: 0; height: 44px; border: 1.5px solid #EAE3E6; border-radius: 12px; padding: 0 14px; font-family: inherit; font-size: 14.5px; color: #2C1219; background: #fff; transition: border-color .15s; }
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
  .bw-col-sel { border: none; background: none; padding: 0 0 0 4px; font-family: inherit; font-size: 11px; font-weight: 800; color: #C33A6E; text-transform: uppercase; letter-spacing: .04em; cursor: pointer; text-align: left; }
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
    .bw-tabela input.bw-in { font-size: 13.5px; padding: 0 6px; }
    .bw-tabela .bw-tam > * { grid-area: auto !important; }
    .bw-tabela .bw-tam--h { display: grid; }
    .bw-tabela .bw-tam { border-bottom: none; padding-bottom: 0; }
    .bw-money input { font-size: 22px; }
  }
  .bw-kg-t { display: inline-flex; align-items: center; gap: 8px; }
  .bw-kg-t small { font-size: 12px; font-weight: 600; color: #9A8E94; }
  .bw-i { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid #C33A6E; background: #fff; color: #C33A6E; font-family: inherit; font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
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
  .bw-tam--h span { font-size: 11px; font-weight: 700; color: #9A8E94; text-transform: uppercase; letter-spacing: .04em; padding-left: 4px; }
  .bw-in, .bw-rs { height: 44px; border: 1.5px solid #EAE3E6; border-radius: 12px; background: #fff; display: flex; align-items: center; min-width: 0; transition: border-color .15s; }
  .bw-in:focus-within, .bw-rs:focus-within, input.bw-in:focus { border-color: #2C1219; outline: none; }
  input.bw-in { padding: 0 10px; font-family: inherit; font-size: 15px; font-weight: 800; color: #2C1219; text-align: center; width: 100%; }
  .bw-in input, .bw-rs input { flex: 1; min-width: 0; width: 100%; border: none; outline: none; background: none; font-family: inherit; font-size: 14.5px; font-weight: 700; color: #2C1219; padding: 0 0 0 10px; }
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
`;

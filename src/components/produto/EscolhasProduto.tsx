import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Basket, Cake, Check, Drop, IceCream, PencilSimple, Plus, Ruler, Sparkle, Trash, X } from "@phosphor-icons/react";
import KitQuantidadeEditor, { faltaKit } from "@/components/produto/KitQuantidadeEditor";
import { kitAtivo, presetKit, type KitQtdConfig } from "@/lib/kitQuantidade";
import { mascaraBRL, lerBRL, textoBRL } from "@/lib/moeda";
import "./escolhas.css";

/**
 * (13/10) "O cliente escolhe alguma coisa?" — UMA tela de escolhas pra todos os tipos de produto,
 * no lugar das duas de antes (a do bolo e a dos outros tipos). Inspirada no jeito mais simples de cadastrar:
 *   · em cima, sugestões pelo tipo e pelo nome (bolo: Tamanho, Massa, Recheio, Cobertura; cento: Quantidade, Sabor…)
 *   · sem nada marcado, "Vende como está"
 *   · cada sugestão abre um cartão ali mesmo; "Pronto" fecha numa linha com o resumo e "Editar"
 * Salva nos MESMOS campos de antes (grupo_massas, grupo_recheios, grupo_coberturas, grupo_sabores, grupo_tamanhos e kit_qtd),
 * então os produtos que já existem abrem aqui sem mudar nada.
 */

type Chave = "tamanho" | "quantidade" | "massa" | "recheio" | "cobertura" | "sabor";
type Opcao = { id: string; nome: string; adicional: number; preco?: number };
type Grupo = { ativo: boolean; min: number; max: number; distribuicao?: string; opcoes: Opcao[]; sabor_tem_preco_proprio?: boolean };
type OpTam = { id: string; nome: string; preco: number; peso_kg?: number | null; serve?: string };
type GrupoTam = { ativo: boolean; min: number; max: number; distribuicao?: string; opcoes: OpTam[]; modo_preco_tamanho?: string; nome_exibicao?: string };

const CAMPO: Record<"massa" | "recheio" | "cobertura" | "sabor", string> = {
  massa: "grupo_massas", recheio: "grupo_recheios", cobertura: "grupo_coberturas", sabor: "grupo_sabores",
};
const ROTULO: Record<Chave, string> = {
  tamanho: "Tamanho", quantidade: "Quantidade", massa: "Massa", recheio: "Recheio", cobertura: "Cobertura", sabor: "Sabor",
};
const PLURAL: Record<string, string> = { massa: "massas", recheio: "recheios", cobertura: "coberturas", sabor: "sabores" };
const NOVA: Record<string, string> = { massa: "Outra massa…", recheio: "Outro recheio…", cobertura: "Outra cobertura…", sabor: "Outro sabor…" };
const ICONE: Record<Chave, ReactNode> = {
  tamanho: <Ruler size={20} />, quantidade: <Basket size={20} />, massa: <Cake size={20} />,
  recheio: <Drop size={20} />, cobertura: <Sparkle size={20} />, sabor: <IceCream size={20} />,
};
const SUGESTOES: Record<string, string[]> = {
  massa: ["Branca", "Chocolate", "Red velvet", "Cenoura", "Nozes", "Coco"],
  recheio: ["Ninho", "Brigadeiro", "Doce de leite", "Morango", "Nutella", "Prestígio", "Maracujá", "Abacaxi"],
  cobertura: ["Chantilly", "Ganache", "Pasta americana", "Buttercream", "Glacê"],
  sabor_doce: ["Brigadeiro", "Beijinho", "Ninho", "Casadinho", "Paçoca", "Churros"],
  sabor_salgado: ["Coxinha", "Risole", "Kibe", "Bolinha de queijo", "Enroladinho", "Esfiha"],
  sabor_sobremesa: ["Chocolate", "Ninho", "Morango", "Maracujá", "Limão", "Doce de leite"],
};
const QUANTOS: [string, number][] = [["Um", 1], ["Até 2", 2], ["Até 3", 3], ["À vontade", 99]];

// Tamanho: modelos prontos (um toque monta a escada)
const MODELOS_UN: { nome: string; itens: string[] }[] = [
  { nome: "por letra", itens: ["P", "M", "G"] },
  { nome: "pelo aro", itens: ["Aro 15", "Aro 20", "Aro 25"] },
  { nome: "por pessoas", itens: ["Serve 10", "Serve 20", "Serve 30"] },
];
const MODELOS_KG: { nome: string; itens: [string, number][] }[] = [
  { nome: "de meio em meio", itens: [["1 kg", 1], ["1,5 kg", 1.5], ["2 kg", 2]] },
  { nome: "de 1 em 1", itens: [["1 kg", 1], ["2 kg", 2], ["3 kg", 3]] },
];

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
const primeiraMaiuscula = (s: string) => { const t = s.trim().replace(/\s+/g, " "); return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; };
const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** O que sugerir pelo tipo escolhido no passo 1 e pelo nome (o nome ajusta: "cento de brigadeiro" pede Quantidade) */
export function sugestoesDoProduto(tipo: string | null | undefined, nome: string, categoria: string): Chave[] {
  const n = norm(`${nome} ${categoria}`);
  const porQtd = /\bcento\b|\bkit\b|caixa|unidades|\b\d+\s*(un|unid)/.test(norm(nome));
  const t = tipo || (/bolo/.test(n) ? "bolos" : /salgad|coxinha|risole|kibe|esfiha/.test(n) ? "salgados" : /brigadeiro|docinho|doce|bombom|beijinho/.test(n) ? "doces"
    : /pudim|mousse|torta|pote|sobremesa/.test(n) ? "sobremesas" : /kit festa|combo/.test(n) ? "kitfesta" : "");
  if (t === "bolos") return /pote/.test(n) ? ["sabor", "cobertura"] : ["tamanho", "massa", "recheio", "cobertura"];
  if (t === "doces") return porQtd ? ["quantidade", "sabor"] : ["sabor", "quantidade"];
  if (t === "salgados") return ["quantidade", "sabor"];
  if (t === "sobremesas") return ["tamanho", "sabor", "cobertura"];
  if (t === "kitfesta") return ["tamanho", "massa", "recheio"];
  return ["tamanho", "sabor", "recheio", "quantidade"];
}

type Props = {
  form: any;
  setForm: (fn: (f: any) => any) => void;
  /** tipo escolhido no passo 1 (bolos, doces…); na edição vem vazio e o nome/categoria decidem */
  tipo?: string | null;
  onKitChange: (k: KitQtdConfig) => void;
};

export default function EscolhasProduto({ form, setForm, tipo, onKitChange }: Props) {
  const [aberto, setAberto] = useState<Chave | null>(null);
  const [verOutras, setVerOutras] = useState(false);
  const nome = String(form.nome || "").trim();
  const sugeridas = useMemo(() => sugestoesDoProduto(tipo, nome, form.categoria || ""), [tipo, nome, form.categoria]);
  const todas: Chave[] = ["tamanho", "quantidade", "massa", "recheio", "cobertura", "sabor"];
  const kit = form.kit_qtd as KitQtdConfig | null;
  const temKit = kitAtivo(kit);

  const ativa = (c: Chave): boolean => {
    if (c === "quantidade") return temKit;
    if (c === "tamanho") return !!form.grupo_tamanhos?.ativo;
    return !!form[CAMPO[c]]?.ativo;
  };
  // Kit e tamanho não andam juntos (o kit já é a "quantidade" do produto); sabor do kit fica dentro do kit
  const bloqueada = (c: Chave) => (c === "tamanho" && temKit) || (c === "quantidade" && !!form.grupo_tamanhos?.ativo) || (c === "sabor" && temKit);
  const ativas = todas.filter(ativa);
  const chipsSug = sugeridas.filter(c => !ativa(c) && !bloqueada(c));
  const chipsOutras = todas.filter(c => !sugeridas.includes(c) && !ativa(c) && !bloqueada(c));

  const ligar = (c: Chave) => {
    if (c === "quantidade") {
      onKitChange({ ...presetKit(tipo === "salgados" || /salgad/.test(norm(form.categoria)) ? "salgados" : "docinhos", kit), ativo: true });
    } else if (c === "tamanho") {
      setForm(f => ({ ...f, grupo_tamanhos: { ...(f.grupo_tamanhos || {}), ativo: true, min: 1, max: 1, distribuicao: "nenhuma", opcoes: f.grupo_tamanhos?.opcoes || [],
        modo_preco_tamanho: f.forma_venda === "kg" ? "por_peso" : (f.grupo_tamanhos?.modo_preco_tamanho === "por_peso" ? "preco_fixo" : (f.grupo_tamanhos?.modo_preco_tamanho || "preco_fixo")) } }));
    } else {
      const campo = CAMPO[c];
      setForm(f => {
        const g: Grupo = { ativo: false, min: 1, max: 1, distribuicao: "nenhuma", opcoes: [], ...(f[campo] || {}) };
        // começa já com as 2 primeiras sugestões marcadas (é só tirar ou pôr): menos digitação
        const sug = sugestoesDaChave(c, tipo, f.categoria);
        const opcoes = g.opcoes.length ? g.opcoes : sug.slice(0, 2).map(n => ({ id: uid(), nome: n, adicional: 0 }));
        return { ...f, [campo]: { ...g, ativo: true, min: 1, max: c === "recheio" ? 2 : 1, opcoes } };
      });
    }
    setAberto(c); setVerOutras(false);
  };
  const desligar = (c: Chave) => {
    if (c === "quantidade" && kit) onKitChange({ ...kit, ativo: false });
    else if (c === "tamanho") setForm(f => ({ ...f, grupo_tamanhos: { ...(f.grupo_tamanhos || {}), ativo: false } }));
    else setForm(f => ({ ...f, [CAMPO[c as "massa"]]: { ...(f[CAMPO[c as "massa"]] || {}), ativo: false } }));
    setAberto(null);
  };

  return (
    <div className="esc">
      <h2 className="esc-h">O cliente escolhe alguma coisa?</h2>
      <p className="esc-s">Toque no que o cliente escolhe{nome ? <> em <b>{nome}</b></> : null}. Se não escolhe nada, é só continuar.</p>

      {(chipsSug.length > 0 || chipsOutras.length > 0) && (
        <div className="esc-chips" role="group" aria-label="Escolhas sugeridas">
          {chipsSug.map(c => <button key={c} type="button" className="esc-chip" onClick={() => ligar(c)}><Plus size={14} weight="bold" aria-hidden="true" />{ROTULO[c]}</button>)}
          {chipsOutras.length > 0 && !verOutras && <button type="button" className="esc-chip esc-chip--outras" onClick={() => setVerOutras(true)}>Outras</button>}
          {verOutras && chipsOutras.map(c => <button key={c} type="button" className="esc-chip" onClick={() => ligar(c)}><Plus size={14} weight="bold" aria-hidden="true" />{ROTULO[c]}</button>)}
        </div>
      )}

      <div className="esc-lista">
        {ativas.length === 0 && (
          <div className="esc-linha esc-linha--nada">
            <span className="esc-ic esc-ic--ok"><Check size={20} weight="bold" /></span>
            <span className="esc-tx"><b>Vende como está</b><small>O cliente só escolhe a quantidade</small></span>
          </div>
        )}
        {ativas.map(c => aberto === c ? (
          <div key={c} className="esc-card" data-falta={c === "quantidade" ? undefined : c === "tamanho" ? "grupo_tamanhos" : CAMPO[c]}>
            <div className="esc-card-h">
              <span className="esc-ic">{ICONE[c]}</span>
              <span className="esc-tx"><b>{ROTULO[c]}</b>{nome && <small>{nome}</small>}</span>
            </div>
            {c === "quantidade" ? <CartaoQuantidade kit={kit!} onKitChange={onKitChange} nome={nome} />
              : c === "tamanho" ? <CartaoTamanho form={form} setForm={setForm} />
              : <CartaoGrupo chave={c} tipo={tipo} form={form} setForm={setForm} />}
            <div className="esc-card-pe">
              <button type="button" className="esc-tirar" onClick={() => desligar(c)}><Trash size={16} aria-hidden="true" />Tirar {ROTULO[c].toLowerCase()}</button>
              <button type="button" className="esc-pronto" onClick={() => setAberto(null)}>Pronto</button>
            </div>
          </div>
        ) : (
          <button key={c} type="button" className="esc-linha" onClick={() => setAberto(c)}>
            <span className="esc-ic">{ICONE[c]}</span>
            {(() => { const f = c === "quantidade" ? faltaKit(kit) : null; return (
              <span className="esc-tx"><b>{ROTULO[c]}</b><small className={f ? "esc-falta" : undefined}>{f ? faltaCurta(f.msg) : resumo(c, form)}</small></span>
            ); })()}
            <span className="esc-editar"><PencilSimple size={16} aria-hidden="true" />Editar</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function sugestoesDaChave(c: Chave, tipo: string | null | undefined, categoria: string): string[] {
  if (c === "sabor") {
    const n = norm(`${tipo || ""} ${categoria || ""}`);
    return /salgad/.test(n) ? SUGESTOES.sabor_salgado : /sobremesa|pudi|mousse|pote/.test(n) ? SUGESTOES.sabor_sobremesa : SUGESTOES.sabor_doce;
  }
  return SUGESTOES[c] || [];
}

/** a frase do que falta, curta pra caber numa linha no celular */
function faltaCurta(msg: string): string {
  const m = msg.match(/preço do kit de (\d+)/);
  if (m) return `Falta o preço do kit de ${m[1]}`;
  if (/sabor/i.test(msg) && /Adicione/.test(msg)) return "Falta pôr os sabores";
  if (/cento/.test(msg)) return "Falta o preço do cento";
  return "Falta completar · toque pra ver";
}

function resumo(c: Chave, form: any): string {
  if (c === "quantidade") {
    const k = form.kit_qtd as KitQtdConfig;
    const qts = k.modo === "livre" ? `de ${k.livre.min} em diante` : (k.kits || []).map(x => x.qtd).filter(Boolean).join(" · ") + " un";
    return `${qts} · ${k.sabores.length} ${k.sabores.length === 1 ? "sabor" : "sabores"}`;
  }
  if (c === "tamanho") {
    const g = form.grupo_tamanhos as GrupoTam;
    if (!g.opcoes.length) return "Toque pra escolher os tamanhos";
    return g.opcoes.map(o => o.nome).join(" · ") + (g.modo_preco_tamanho === "por_peso" ? " · pelo peso" : "");
  }
  const g = form[CAMPO[c as "massa"]] as Grupo;
  if (!g.opcoes.length) return "Toque pra pôr as opções";
  const quantos = g.max >= 99 ? "À vontade" : g.max === 1 ? "Escolhe 1" : `Até ${g.max}`;
  const nomes = g.opcoes.map(o => (o.adicional > 0 ? `${o.nome} +R$ ${textoBRL(o.adicional)}` : o.nome)).join(", ");
  return `${quantos}${g.min >= 1 ? "" : " · opcional"} · ${nomes}`;
}

/* ── Massa, recheio, cobertura e sabor ── */
function CartaoGrupo({ chave, tipo, form, setForm }: { chave: "massa" | "recheio" | "cobertura" | "sabor"; tipo?: string | null; form: any; setForm: Props["setForm"] }) {
  const campo = CAMPO[chave];
  const g: Grupo = { ativo: true, min: 1, max: 1, distribuicao: "nenhuma", opcoes: [], ...(form[campo] || {}) };
  const [nova, setNova] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const set = (patch: Partial<Grupo>) => setForm(f => ({ ...f, [campo]: { ...g, ...(f[campo] || {}), ...patch } }));
  const sug = sugestoesDaChave(chave, tipo, form.categoria).filter(s => !g.opcoes.some(o => norm(o.nome) === norm(s)));
  const precoProprio = chave === "sabor" && !!g.sabor_tem_preco_proprio;
  const plural = PLURAL[chave];

  const adicionar = (nomeOp: string, valor = 0) => {
    const n = primeiraMaiuscula(nomeOp);
    if (!n || g.opcoes.some(o => norm(o.nome) === norm(n))) return;
    set({ opcoes: [...g.opcoes, precoProprio ? { id: uid(), nome: n, adicional: 0, preco: valor } : { id: uid(), nome: n, adicional: valor }] });
  };
  const addDigitado = () => { adicionar(nova, lerBRL(novoValor || "0")); setNova(""); setNovoValor(""); };
  const mover = (i: number, d: number) => { const l = [...g.opcoes]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; set({ opcoes: l }); };
  const valorDe = (o: Opcao) => (precoProprio ? Number(o.preco) || 0 : Number(o.adicional) || 0);
  const mudarValor = (id: string, txt: string) => {
    const v = lerBRL(txt || "0");
    set({ opcoes: g.opcoes.map(o => (o.id === id ? (precoProprio ? { ...o, preco: v } : { ...o, adicional: v }) : o)) });
  };
  const quantosAtual = g.max >= 99 ? 99 : g.max;

  return (
    <div className="esc-corpo">
      <p className="esc-lbl">Quantos o cliente escolhe</p>
      <div className="esc-seg" role="radiogroup" aria-label="Quantos o cliente escolhe">
        {QUANTOS.map(([r, v]) => (
          <button key={r} type="button" role="radio" aria-checked={quantosAtual === v} className={quantosAtual === v ? "on" : ""}
            onClick={() => set({ max: v, min: g.min >= 1 ? 1 : 0 })}>{r}</button>
        ))}
      </div>
      <p className="esc-dica">No cardápio: {quantosAtual === 1 ? `"Escolha 1 ${chave}"` : quantosAtual >= 99 ? `"Escolha quantos ${plural} quiser"` : `"Escolha até ${quantosAtual} ${plural}"`}.</p>

      <button type="button" className="esc-sw" role="switch" aria-checked={g.min >= 1} onClick={() => set({ min: g.min >= 1 ? 0 : 1 })}>
        <span><b>Obrigatório</b><small>{g.min >= 1 ? "Sem escolher, o cliente não consegue pedir." : "O cliente pode pedir sem escolher."}</small></span>
        <i aria-hidden="true" />
      </button>

      {chave === "sabor" && (
        <button type="button" className="esc-sw" role="switch" aria-checked={precoProprio} onClick={() => set({ sabor_tem_preco_proprio: !precoProprio })}>
          <span><b>Cada sabor tem o seu preço</b><small>{precoProprio ? "O preço do sabor vale no lugar do preço do produto." : "Desligado: o sabor só soma, se tiver valor a mais."}</small></span>
          <i aria-hidden="true" />
        </button>
      )}

      <p className="esc-lbl">Opções</p>
      {g.opcoes.length > 0 && (
        <ul className="esc-ops">
          {g.opcoes.map((o, i) => (
            <li key={o.id} className="esc-op">
              <span className="esc-op-nm">{o.nome}</span>
              <label className="esc-op-v" aria-label={`${precoProprio ? "Preço" : "Valor a mais"} de ${o.nome}`}>
                <span>{precoProprio ? "R$" : "+ R$"}</span>
                <input inputMode="numeric" placeholder="0,00" value={valorDe(o) > 0 ? textoBRL(valorDe(o)) : ""}
                  onChange={e => mudarValor(o.id, mascaraBRL(e.target.value))} />
              </label>
              {g.opcoes.length > 1 && (
                <span className="esc-op-mv">
                  <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${o.nome}`}><ArrowUp size={14} weight="bold" /></button>
                  <button type="button" onClick={() => mover(i, 1)} disabled={i === g.opcoes.length - 1} aria-label={`Descer ${o.nome}`}><ArrowDown size={14} weight="bold" /></button>
                </span>
              )}
              <button type="button" className="esc-op-x" onClick={() => set({ opcoes: g.opcoes.filter(x => x.id !== o.id) })} aria-label={`Tirar ${o.nome}`}><X size={16} weight="bold" /></button>
            </li>
          ))}
        </ul>
      )}
      {sug.length > 0 && (
        <div className="esc-chips esc-chips--sug" role="group" aria-label="Sugestões">
          {sug.slice(0, 6).map(s => <button key={s} type="button" className="esc-chip esc-chip--sug" onClick={() => adicionar(s)}><Plus size={14} weight="bold" aria-hidden="true" />{s}</button>)}
        </div>
      )}
      <div className="esc-nova">
        <input placeholder={NOVA[chave]} value={nova} onChange={e => setNova(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addDigitado(); } }} aria-label={NOVA[chave].replace("…", "")} />
        <label className="esc-nova-v"><span>R$</span><input inputMode="numeric" placeholder="0,00" value={novoValor} onChange={e => setNovoValor(mascaraBRL(e.target.value))} aria-label="Valor a mais" /></label>
        <button type="button" className="esc-nova-bt" onClick={addDigitado} disabled={!nova.trim()} aria-label="Pôr opção"><Plus size={20} weight="bold" /></button>
      </div>
      <p className="esc-dica">{precoProprio ? "O preço de cada sabor aparece no cardápio." : "Sem valor: já vem no preço. Com valor: custa a mais."}</p>
    </div>
  );
}

/* ── Tamanho: modelos prontos e a lista (o preço de cada um fica no passo Preço) ── */
function CartaoTamanho({ form, setForm }: { form: any; setForm: Props["setForm"] }) {
  const g: GrupoTam = { ativo: true, min: 1, max: 1, opcoes: [], ...(form.grupo_tamanhos || {}) };
  const porPeso = g.modo_preco_tamanho === "por_peso";
  const [novo, setNovo] = useState("");
  const set = (patch: Partial<GrupoTam>) => setForm(f => ({ ...f, grupo_tamanhos: { ...g, ...(f.grupo_tamanhos || {}), ...patch } }));
  const usarModeloUn = (itens: string[]) => set({ opcoes: itens.map(n => ({ id: uid(), nome: n, preco: 0, ...(n.startsWith("Serve") ? { serve: n.replace("Serve ", "") + " pessoas" } : {}) })) });
  const usarModeloKg = (itens: [string, number][]) => set({ opcoes: itens.map(([n, kg]) => ({ id: uid(), nome: n, preco: 0, peso_kg: kg })) });
  const pesoDoNome = (n: string) => { const m = n.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*kg/i); return m ? Number(m[1]) : null; };
  const add = () => {
    const n = primeiraMaiuscula(novo);
    if (!n || g.opcoes.some(o => norm(o.nome) === norm(n))) return;
    set({ opcoes: [...g.opcoes, { id: uid(), nome: n, preco: 0, ...(porPeso ? { peso_kg: pesoDoNome(n) } : {}) }] }); setNovo("");
  };
  const renomear = (id: string, n: string) => set({ opcoes: g.opcoes.map(o => (o.id === id ? { ...o, nome: n, ...(porPeso ? { peso_kg: pesoDoNome(n) ?? o.peso_kg } : {}) } : o)) });
  const mover = (i: number, d: number) => { const l = [...g.opcoes]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; set({ opcoes: l }); };

  return (
    <div className="esc-corpo">
      <p className="esc-lbl">Como é o preço</p>
      <div className="esc-seg esc-seg--2" role="radiogroup" aria-label="Como é o preço dos tamanhos">
        <button type="button" role="radio" aria-checked={!porPeso} className={!porPeso ? "on" : ""}
          onClick={() => { set({ modo_preco_tamanho: "preco_fixo" }); setForm(f => ({ ...f, forma_venda: f.forma_venda === "kg" ? "unidade" : f.forma_venda })); }}>Cada um tem o seu</button>
        <button type="button" role="radio" aria-checked={porPeso} className={porPeso ? "on" : ""}
          onClick={() => { set({ modo_preco_tamanho: "por_peso", opcoes: g.opcoes.map(o => ({ ...o, peso_kg: o.peso_kg ?? pesoDoNome(o.nome) })) }); setForm(f => ({ ...f, forma_venda: "kg" })); }}>Pelo peso (kg)</button>
      </div>
      <p className="esc-dica">{porPeso ? "O preço sai sozinho: peso × preço do kg (no próximo passo)." : "O preço de cada tamanho você coloca no próximo passo."}</p>

      {g.opcoes.length === 0 && (<>
        <p className="esc-lbl">Comece por um modelo</p>
        <div className="esc-modelos">
          {porPeso
            ? MODELOS_KG.map(m => (
              <button key={m.nome} type="button" className="esc-modelo" onClick={() => usarModeloKg(m.itens)}>
                <span className="esc-bolas" aria-hidden="true">{m.itens.map(([, kg], i) => <i key={i} style={{ width: 10 + kg * 6, height: 10 + kg * 6 }} />)}</span>
                <b>{m.itens.map(([n]) => n).join(" · ")}</b><small>{m.nome}</small>
              </button>))
            : MODELOS_UN.map(m => (
              <button key={m.nome} type="button" className="esc-modelo" onClick={() => usarModeloUn(m.itens)}>
                <span className="esc-bolas" aria-hidden="true">{m.itens.map((_, i) => <i key={i} style={{ width: 12 + i * 6, height: 12 + i * 6 }} />)}</span>
                <b>{m.itens.join(" · ")}</b><small>{m.nome}</small>
              </button>))}
        </div>
      </>)}

      {g.opcoes.length > 0 && (<>
        <p className="esc-lbl">Tamanhos</p>
        <ul className="esc-ops">
          {g.opcoes.map((o, i) => (
            <li key={o.id} className="esc-op">
              <input className="esc-op-in" value={o.nome} onChange={e => renomear(o.id, e.target.value)} aria-label={`Nome do tamanho ${i + 1}`} />
              {porPeso && <span className={`esc-op-kg${o.peso_kg ? "" : " falta"}`}>{o.peso_kg ? `${String(o.peso_kg).replace(".", ",")} kg` : "sem peso"}</span>}
              {g.opcoes.length > 1 && (
                <span className="esc-op-mv">
                  <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${o.nome}`}><ArrowUp size={14} weight="bold" /></button>
                  <button type="button" onClick={() => mover(i, 1)} disabled={i === g.opcoes.length - 1} aria-label={`Descer ${o.nome}`}><ArrowDown size={14} weight="bold" /></button>
                </span>
              )}
              <button type="button" className="esc-op-x" onClick={() => set({ opcoes: g.opcoes.filter(x => x.id !== o.id) })} aria-label={`Tirar ${o.nome}`}><X size={16} weight="bold" /></button>
            </li>
          ))}
        </ul>
        <div className="esc-nova esc-nova--1">
          <input placeholder={porPeso ? "Ex.: 2,5 kg" : "Outro tamanho…"} value={novo} onChange={e => setNovo(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} aria-label="Outro tamanho" />
          <button type="button" className="esc-nova-bt" onClick={add} disabled={!novo.trim()} aria-label="Pôr tamanho"><Plus size={20} weight="bold" /></button>
        </div>
        {porPeso && <p className="esc-dica">Escreva o peso no nome (ex.: "2,5 kg") pra o preço sair certo.</p>}
      </>)}
    </div>
  );
}

/* ── Quantidade (cento, kit de 50, 100…) e os sabores que vão dentro: o editor de kit que já existe ── */
function CartaoQuantidade({ kit, onKitChange, nome }: { kit: KitQtdConfig; onKitChange: (k: KitQtdConfig) => void; nome: string }) {
  return (
    <div className="esc-corpo esc-corpo--kit">
      <KitQuantidadeEditor modo="completo" kit={kit} onChange={onKitChange} nomeProduto={nome} />
    </div>
  );
}

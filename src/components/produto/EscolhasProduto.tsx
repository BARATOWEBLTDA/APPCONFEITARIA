import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Basket, Cake, Check, Drop, IceCream, PencilSimple, Plus, Ruler, Sparkle, Trash, X } from "@phosphor-icons/react";
import KitQuantidadeEditor, { faltaKit } from "@/components/produto/KitQuantidadeEditor";
import { kitAtivo, presetKit, type KitQtdConfig } from "@/lib/kitQuantidade";
import { mascaraBRL, lerBRL, textoBRL } from "@/lib/moeda";
import { Botao, Janela } from "@/components/base";
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
// Por quilo (13/10): os pesos viram barrinhas que ela marca; já vêm marcados os mais comuns
const PESOS_KG = [1, 1.5, 2, 2.5, 3, 3.5, 4, 5];
const PESOS_PADRAO = [1, 1.5, 2, 3];
const nomePeso = (kg: number) => (kg < 1 ? `${Math.round(kg * 1000)} g` : `${String(kg).replace(".", ",")} kg`);
const opcoesDePesos = (pesos: number[]) => [...pesos].sort((a, b) => a - b).map(kg => ({ id: uid(), nome: nomePeso(kg), preco: 0, peso_kg: kg }));

/** (13/10) ordem natural dos tamanhos: letras (PP, P, M, G, GG…), depois números (aro, serve, kg). O resto fica no fim, na ordem em que entrou. */
const ORDEM_LETRA: Record<string, number> = { mini: 0.5, pp: 1, p: 2, pequeno: 2, m: 3, medio: 3, g: 4, grande: 4, gg: 5, xg: 6, familia: 7 };
function chaveTamanho(nome: string): number {
  const n = norm(nome).replace(/[()]/g, " ").trim();
  const primeira = n.split(/\s+/)[0] || "";
  if (primeira in ORDEM_LETRA) return ORDEM_LETRA[primeira];
  const m = n.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*(kg|g)?/);
  if (m) { const v = Number(m[1]); return 100 + (m[2] === "g" ? v / 1000 : v); }
  return Infinity;
}
export function ordenarTamanhos<T extends { nome: string; peso_kg?: number | null }>(lista: T[]): T[] {
  return lista.map((o, i) => ({ o, i, k: Number(o.peso_kg) > 0 ? 100 + Number(o.peso_kg) : chaveTamanho(o.nome) }))
    .sort((a, b) => (a.k === b.k ? a.i - b.i : a.k - b.k)).map(x => x.o);
}

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

  // (13/10) cada escolha abre numa janela própria. Ao abrir, guarda como estava: o X desfaz tudo o que mexeu ali.
  const antes = useRef<{ chave: Chave; valor: any; kit: any; forma: any } | null>(null);
  const campoDe = (c: Chave) => (c === "tamanho" ? "grupo_tamanhos" : c === "quantidade" ? "kit_qtd" : CAMPO[c]);
  const guardar = (c: Chave) => { antes.current = { chave: c, valor: form[campoDe(c)] ?? null, kit: form.kit_qtd ?? null, forma: form.forma_venda }; };
  const abrir = (c: Chave) => { guardar(c); setAberto(c); };
  const salvar = () => { antes.current = null; setAberto(null); };
  const cancelar = () => {
    const a = antes.current;
    if (a) {
      if (a.chave === "quantidade") onKitChange(a.kit ? a.kit : { ...(kit as KitQtdConfig), ativo: false });
      else setForm(f => ({ ...f, [campoDe(a.chave)]: a.valor ?? { ...(f[campoDe(a.chave)] || {}), ativo: false }, forma_venda: a.forma }));
    }
    antes.current = null; setAberto(null);
  };

  const ligar = (c: Chave) => {
    guardar(c);
    if (c === "quantidade") {
      onKitChange({ ...presetKit(tipo === "salgados" || /salgad/.test(norm(form.categoria)) ? "salgados" : "docinhos", kit), ativo: true });
    } else if (c === "tamanho") {
      setForm(f => ({ ...f, grupo_tamanhos: { ...(f.grupo_tamanhos || {}), ativo: true, min: 1, max: 1, distribuicao: "nenhuma",
        opcoes: f.grupo_tamanhos?.opcoes?.length ? f.grupo_tamanhos.opcoes : (f.forma_venda === "kg" ? opcoesDePesos(PESOS_PADRAO) : []),
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
    antes.current = null; setAberto(null);
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
        {ativas.map(c => {
          const f = c === "quantidade" ? faltaKit(kit) : null;
          return (
            <button key={c} type="button" className="esc-linha" onClick={() => abrir(c)}
              data-falta={c === "quantidade" ? undefined : c === "tamanho" ? "grupo_tamanhos" : CAMPO[c]}>
              <span className="esc-ic">{ICONE[c]}</span>
              <span className="esc-tx"><b>{ROTULO[c]}</b><small className={f ? "esc-falta" : undefined}>{f ? faltaCurta(f.msg) : resumo(c, form)}</small></span>
              <span className="esc-editar"><PencilSimple size={16} aria-hidden="true" />Editar</span>
            </button>
          );
        })}
      </div>

      <Janela aberta={!!aberto} aoFechar={cancelar} titulo={aberto ? ROTULO[aberto] : ""} tipo="conteudo" travada
        acoes={aberto ? (<>
          <Botao variante="secundario" icone={<Trash size={18} aria-hidden="true" />} onClick={() => aberto && desligar(aberto)}>Tirar</Botao>
          <Botao onClick={salvar}>Salvar</Botao>
        </>) : null}>
        {aberto && (
          <div className="esc esc-jan">
            {aberto === "quantidade" ? (kit ? <CartaoQuantidade kit={kit} onKitChange={onKitChange} nome={nome} /> : null)
              : aberto === "tamanho" ? <CartaoTamanho form={form} setForm={setForm} />
              : <CartaoGrupo chave={aberto} tipo={tipo} form={form} setForm={setForm} />}
          </div>
        )}
      </Janela>
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
    return g.opcoes.map(o => o.nome).join(" · ") + (g.modo_preco_tamanho === "por_peso" ? " · por quilo" : "");
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
  // por quilo: marcar e desmarcar um peso (a lista fica sempre do menor pro maior)
  const marcados = new Set(g.opcoes.map(o => Number(o.peso_kg) || 0).filter(Boolean));
  const semPeso = g.opcoes.filter(o => !(Number(o.peso_kg) > 0));
  const pesos = Array.from(new Set([...PESOS_KG, ...marcados])).sort((a, b) => a - b);
  const maior = Math.max(...pesos);
  const alternarPeso = (kg: number) => {
    if (marcados.has(kg)) set({ opcoes: g.opcoes.filter(o => Number(o.peso_kg) !== kg) });
    else set({ opcoes: [...g.opcoes, { id: uid(), nome: nomePeso(kg), preco: 0, peso_kg: kg }].sort((a, b) => (Number(a.peso_kg) || 99) - (Number(b.peso_kg) || 99)) });
  };
  const lerPeso = (t: string): number | null => {
    const m = t.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*(kg|g)?/i);
    if (!m) return null;
    const v = Number(m[1]); const g2 = (m[2] || "").toLowerCase() === "g" || (!m[2] && v >= 100);
    const kg = g2 ? v / 1000 : v;
    return kg > 0 && kg <= 50 ? Math.round(kg * 100) / 100 : null;
  };
  const addPeso = () => { const kg = lerPeso(novo); if (!kg) return; if (!marcados.has(kg)) alternarPeso(kg); setNovo(""); };
  const pesoDoNome = (n: string) => { const m = n.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*kg/i); return m ? Number(m[1]) : null; };
  const add = () => {
    const n = primeiraMaiuscula(novo);
    if (!n || g.opcoes.some(o => norm(o.nome) === norm(n))) return;
    set({ opcoes: ordenarTamanhos([...g.opcoes, { id: uid(), nome: n, preco: 0, ...(porPeso ? { peso_kg: pesoDoNome(n) } : {}) }]) }); setNovo("");
  };
  const renomear = (id: string, n: string) => set({ opcoes: g.opcoes.map(o => (o.id === id ? { ...o, nome: n, ...(porPeso ? { peso_kg: pesoDoNome(n) ?? o.peso_kg } : {}) } : o)) });
  return (
    <div className="esc-corpo">
      <p className="esc-lbl">Como é o preço</p>
      <div className="esc-seg esc-seg--2" role="radiogroup" aria-label="Como é o preço dos tamanhos">
        <button type="button" role="radio" aria-checked={!porPeso} className={!porPeso ? "on" : ""}
          onClick={() => {
            // (13/10) os pesos (1 kg, 1,5 kg…) não servem de tamanho no preço fixo: a lista volta vazia e aparecem os modelos
            const soPesos = g.opcoes.length > 0 && g.opcoes.every(o => Number(o.peso_kg) > 0 && norm(o.nome) === norm(nomePeso(Number(o.peso_kg))));
            set({ modo_preco_tamanho: "preco_fixo", ...(soPesos ? { opcoes: [] } : {}) });
            setForm(f => ({ ...f, forma_venda: f.forma_venda === "kg" ? "unidade" : f.forma_venda }));
          }}>Preço fixo</button>
        <button type="button" role="radio" aria-checked={porPeso} className={porPeso ? "on" : ""}
          onClick={() => { set({ modo_preco_tamanho: "por_peso", opcoes: g.opcoes.length ? g.opcoes.map(o => ({ ...o, peso_kg: o.peso_kg ?? pesoDoNome(o.nome) })) : opcoesDePesos(PESOS_PADRAO) }); setForm(f => ({ ...f, forma_venda: "kg" })); }}>Por quilo</button>
      </div>
      <p className="esc-dica">{porPeso ? "O preço sai do peso × preço do kg." : "Cada tamanho tem o seu preço."}</p>

      {porPeso && (<>
        <p className="esc-lbl">Quais pesos você faz?</p>
        <div className="esc-kgs" role="group" aria-label="Pesos">
          {pesos.map(kg => {
            const on = marcados.has(kg);
            return (
              <button key={kg} type="button" className={`esc-kg${on ? " on" : ""}`} aria-pressed={on} onClick={() => alternarPeso(kg)}
                aria-label={`${nomePeso(kg)}${on ? ", marcado" : ""}`}>
                <span className="esc-kg-a"><i style={{ height: `${Math.round(22 + (kg / maior) * 78)}%` }} /></span>
                <b>{kg < 1 ? `${Math.round(kg * 1000)}g` : String(kg).replace(".", ",")}</b>
              </button>
            );
          })}
        </div>
        <p className="esc-dica">Toque pra marcar ou desmarcar. Os números são em kg.</p>
        <div className="esc-nova esc-nova--1">
          <input placeholder="Outro peso (ex.: 6 kg)" value={novo} inputMode="decimal" onChange={e => setNovo(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPeso(); } }} aria-label="Outro peso" />
          <button type="button" className="esc-nova-bt" onClick={addPeso} disabled={!lerPeso(novo)} aria-label="Pôr peso"><Plus size={20} weight="bold" /></button>
        </div>
        {semPeso.length > 0 && (
          <ul className="esc-ops" style={{ marginTop: 12 }}>
            {semPeso.map(o => (
              <li key={o.id} className="esc-op">
                <span className="esc-op-nm">{o.nome}</span>
                <span className="esc-op-kg falta">sem peso</span>
                <button type="button" className="esc-op-x" onClick={() => set({ opcoes: g.opcoes.filter(x => x.id !== o.id) })} aria-label={`Tirar ${o.nome}`}><X size={16} weight="bold" /></button>
              </li>
            ))}
          </ul>
        )}
      </>)}

      {!porPeso && g.opcoes.length === 0 && (<>
        <p className="esc-lbl">Comece por um modelo</p>
        <div className="esc-modelos">
          {MODELOS_UN.map(m => (
              <button key={m.nome} type="button" className="esc-modelo" onClick={() => usarModeloUn(m.itens)}>
                <span className="esc-bolas" aria-hidden="true">{m.itens.map((_, i) => <i key={i} style={{ height: 10 + i * 8 }} />)}</span>
                <b>{m.itens.join(" · ")}</b><small>{m.nome}</small>
              </button>))}
        </div>
      </>)}

      {!porPeso && g.opcoes.length > 0 && (<>
        <p className="esc-lbl">Tamanhos</p>
        <ul className="esc-ops">
          {g.opcoes.map((o, i) => (
            <li key={o.id} className="esc-op">
              {/* a ordem é automática (P, M, G… e os números): ao sair do campo, a lista se arruma */}
              <input className="esc-op-in" value={o.nome} onChange={e => renomear(o.id, e.target.value)} onBlur={() => set({ opcoes: ordenarTamanhos(g.opcoes) })} aria-label={`Nome do tamanho ${i + 1}`} />
              <button type="button" className="esc-op-x" onClick={() => set({ opcoes: g.opcoes.filter(x => x.id !== o.id) })} aria-label={`Tirar ${o.nome}`}><X size={16} weight="bold" /></button>
            </li>
          ))}
        </ul>
        <div className="esc-nova esc-nova--1">
          <input placeholder={porPeso ? "Ex.: 2,5 kg" : "Outro tamanho…"} value={novo} onChange={e => setNovo(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} aria-label="Outro tamanho" />
          <button type="button" className="esc-nova-bt" onClick={add} disabled={!novo.trim()} aria-label="Pôr tamanho"><Plus size={20} weight="bold" /></button>
        </div>
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

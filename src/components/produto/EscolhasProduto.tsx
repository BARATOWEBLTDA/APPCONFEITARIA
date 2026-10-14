import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Basket, Cake, Check, Drop, IceCream, PencilSimple, Plus, Ruler, Sparkle, Trash, X } from "@phosphor-icons/react";
import KitQuantidadeEditor, { faltaKit } from "@/components/produto/KitQuantidadeEditor";
import { kitAtivo, presetKit, type KitQtdConfig } from "@/lib/kitQuantidade";
import { mascaraBRL, lerBRL, textoBRL, selecionarValorAoFocar } from "@/lib/moeda";
import { Botao, Janela, confirmar } from "@/components/base";
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
type GrupoTam = { ativo: boolean; min: number; max: number; distribuicao?: string; opcoes: OpTam[]; modo_preco_tamanho?: string; nome_exibicao?: string; rendimento_unidade?: string };

const CAMPO: Record<"massa" | "recheio" | "cobertura" | "sabor", string> = {
  massa: "grupo_massas", recheio: "grupo_recheios", cobertura: "grupo_coberturas", sabor: "grupo_sabores",
};
const ROTULO: Record<Chave, string> = {
  tamanho: "Tamanho", quantidade: "Quantidade", massa: "Massa", recheio: "Recheio", cobertura: "Cobertura", sabor: "Sabor",
};
const SALVAR: Record<Chave, string> = {
  tamanho: "Salvar tamanhos", quantidade: "Salvar quantidade", massa: "Salvar massas", recheio: "Salvar recheios", cobertura: "Salvar coberturas", sabor: "Salvar sabores",
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
  { nome: "do menor pro maior", itens: ["Pequeno", "Médio", "Grande"] },
  { nome: "pelo aro", itens: ["Aro 15", "Aro 20", "Aro 25"] },
  { nome: "por pessoas", itens: ["Serve 10", "Serve 20", "Serve 30"] },
];
// Por quilo (14/10): lista de pesos pra marcar, de 1 em 1 kg até 5 kg (todos já marcados), com o preço de cada um ao lado
const PESOS_KG = [1, 2, 3, 4, 5];
const PESOS_PADRAO = [1, 2, 3, 4, 5];
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

/** (13/10) "Usar de outro produto": os jeitos diferentes que ela já usou (sem repetir), pra copiar com um toque */
type Copia = { de: string; resumo: string; opcoes: any[]; grupo: any };
function copiasDe(outros: any[] | undefined, campo: string, chave: (g: any) => string | null): Copia[] {
  const vistos = new Set<string>(); const lista: Copia[] = [];
  for (const p of outros || []) {
    const g = p?.[campo];
    if (!g?.ativo || !(g.opcoes?.length)) continue;
    const k = chave(g); if (!k || vistos.has(k)) continue;
    vistos.add(k);
    lista.push({ de: String(p.nome || "Produto"), resumo: g.opcoes.map((o: any) => o.nome).join(", "), opcoes: g.opcoes, grupo: g });
    if (lista.length >= 3) break;
  }
  return lista;
}
const numeroServe = (v: unknown) => (String(v ?? "").match(/\d+/)?.[0] || "");

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
  /** os outros produtos da confeiteira (pra "Usar de outro produto") */
  outros?: any[];
};

export default function EscolhasProduto({ form, setForm, tipo, onKitChange, outros }: Props) {
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
  const antes = useRef<{ chave: Chave; valor: any; kit: any; forma: any; base?: string } | null>(null);
  const campoDe = (c: Chave) => (c === "tamanho" ? "grupo_tamanhos" : c === "quantidade" ? "kit_qtd" : CAMPO[c]);
  const guardar = (c: Chave) => { antes.current = { chave: c, valor: form[campoDe(c)] ?? null, kit: form.kit_qtd ?? null, forma: form.forma_venda }; };
  const abrir = (c: Chave) => { guardar(c); setAberto(c); };
  const salvar = () => { antes.current = null; setAberto(null); };
  // (13/10) Voltar (ou X) com mudança não salva: pergunta antes de desfazer
  // "como estava ao abrir a janela" (já com o que o ligar preencheu): só pergunta se ela mexeu depois disso
  const retrato = () => { const a = antes.current; if (!a) return ""; return JSON.stringify([a.chave === "quantidade" ? form.kit_qtd ?? null : form[campoDe(a.chave)] ?? null, form.forma_venda]); };
  useEffect(() => { if (aberto && antes.current && antes.current.base === undefined) antes.current.base = retrato(); });
  const mudou = () => { const a = antes.current; return !!a && a.base !== undefined && retrato() !== a.base; };
  const voltar = async () => {
    if (mudou() && !(await confirmar({ titulo: "Sair sem salvar?", texto: "O que você mexeu aqui não fica.", rotulo: "Sair sem salvar", rotuloVoltar: "Ficar" }))) return;
    cancelar();
  };
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

      <Janela aberta={!!aberto} aoFechar={voltar} titulo={aberto ? ROTULO[aberto] : ""} tipo="conteudo" travada
        acoes={aberto ? (<>
          <Botao variante="secundario" onClick={voltar}>Voltar</Botao>
          <Botao onClick={salvar}>{SALVAR[aberto]}</Botao>
        </>) : null}>
        {aberto && (
          <div className="esc esc-jan" onFocusCapture={selecionarValorAoFocar} onClickCapture={selecionarValorAoFocar}>
            {aberto === "quantidade" ? (kit ? <CartaoQuantidade kit={kit} onKitChange={onKitChange} nome={nome} /> : null)
              : aberto === "tamanho" ? <CartaoTamanho form={form} setForm={setForm} outros={outros} />
              : <CartaoGrupo chave={aberto} tipo={tipo} form={form} setForm={setForm} outros={outros} />}
            <button type="button" className="esc-tirar-link" onClick={async () => {
              if (await confirmar({ titulo: `Tirar ${ROTULO[aberto].toLowerCase()} deste produto?`, texto: "O cliente não vai mais escolher isso no cardápio.", rotulo: "Tirar", perigo: true })) desligar(aberto);
            }}><Trash size={16} aria-hidden="true" />Tirar {ROTULO[aberto].toLowerCase()} deste produto</button>
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
    if (g.modo_preco_tamanho === "por_peso") return `${Number(form.preco_normal) > 0 ? `R$ ${textoBRL(Number(form.preco_normal))} o kg` : "Falta o preço do kg"} · ${g.opcoes.map(o => o.nome).join(" · ")}`;
    return g.opcoes.map(o => o.nome).join(" · ");
  }
  const g = form[CAMPO[c as "massa"]] as Grupo;
  if (!g.opcoes.length) return "Toque pra pôr as opções";
  const quantos = g.max >= 99 ? "À vontade" : g.max === 1 ? "Escolhe 1" : `Até ${g.max}`;
  const nomes = g.opcoes.map(o => (o.adicional > 0 ? `${o.nome} +R$ ${textoBRL(o.adicional)}` : o.nome)).join(", ");
  return `${quantos}${g.min >= 1 ? "" : " · opcional"} · ${nomes}`;
}

function UsarDeOutro({ copias, onUsar }: { copias: Copia[]; onUsar: (c: Copia) => void }) {
  if (!copias.length) return null;
  return (<>
    <p className="esc-lbl">Usar de outro produto</p>
    <div className="esc-copias">
      {copias.map((c, i) => (
        <button key={i} type="button" className="esc-copia" onClick={() => onUsar(c)}>
          <span className="esc-tx"><b>{c.de}</b><small>{c.resumo}</small></span>
          <span className="esc-editar">Usar</span>
        </button>
      ))}
    </div>
  </>);
}

/* ── Massa, recheio, cobertura e sabor ── */
function CartaoGrupo({ chave, tipo, form, setForm, outros }: { chave: "massa" | "recheio" | "cobertura" | "sabor"; tipo?: string | null; form: any; setForm: Props["setForm"]; outros?: any[] }) {
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
      <UsarDeOutro
        copias={copiasDe(outros, campo, gg => { const k = gg.opcoes.map((o: any) => norm(o.nome)).join("|"); return k === g.opcoes.map(o => norm(o.nome)).join("|") ? null : k; })}
        onUsar={c => set({ opcoes: c.opcoes.map((o: any) => ({ id: uid(), nome: o.nome, adicional: Number(o.adicional) || 0, ...(o.preco ? { preco: o.preco } : {}) })),
          max: Number(c.grupo.max) || g.max, min: c.grupo.min ?? g.min, ...(chave === "sabor" ? { sabor_tem_preco_proprio: !!c.grupo.sabor_tem_preco_proprio } : {}) })} />
    </div>
  );
}

/* ── Tamanho: modelos prontos e a lista (o preço de cada um fica no passo Preço) ── */
function CartaoTamanho({ form, setForm, outros }: { form: any; setForm: Props["setForm"]; outros?: any[] }) {
  const g: GrupoTam = { ativo: true, min: 1, max: 1, opcoes: [], ...(form.grupo_tamanhos || {}) };
  const porPeso = g.modo_preco_tamanho === "por_peso";
  const [novo, setNovo] = useState("");
  const set = (patch: Partial<GrupoTam>) => setForm(f => ({ ...f, grupo_tamanhos: { ...g, ...(f.grupo_tamanhos || {}), ...patch } }));
  const usarModeloUn = (itens: string[]) => set({ opcoes: itens.map(n => ({ id: uid(), nome: n, preco: 0, ...(n.startsWith("Serve") ? { serve: n.replace("Serve ", "") + " pessoas" } : {}) })) });
  // rendimento (opcional), em cada tamanho: "serve [10] [pessoas]". Fica guardado como "10 pessoas" (o cardápio já mostra assim)
  const [unLocal, setUnLocal] = useState<Record<string, string>>({});
  const unDe = (o: OpTam) => {
    const m = String(o.serve || "").match(/^\s*\d+\s*([^\d\s].*)$/);
    if (m) return m[1].trim();
    if (unLocal[o.id]) return unLocal[o.id];
    const outra = g.opcoes.map(x => String(x.serve || "").match(/^\s*\d+\s*([^\d\s].*)$/)?.[1]).find(Boolean);
    return outra?.trim() || (g.rendimento_unidade && g.rendimento_unidade !== "" ? g.rendimento_unidade : "pessoas");
  };
  const gravarServe = (o: OpTam, num: string, un: string) =>
    set({ opcoes: g.opcoes.map(x => (x.id === o.id ? { ...x, serve: num ? `${num} ${un}` : "" } : x)) });
  const copiasTam = copiasDe(outros, "grupo_tamanhos", gg => (gg.modo_preco_tamanho === "por_peso" ? null : gg.opcoes.map((o: any) => `${norm(o.nome)}:${numeroServe(o.serve)}`).join("|")));
  const comUnidade = (serve: unknown, unGrupo?: string) => { const n = numeroServe(serve); if (!n) return ""; const m = String(serve).match(/^\s*\d+\s*([^\d\s].*)$/); return `${n} ${m ? m[1].trim() : unGrupo || "pessoas"}`; };
  const usarCopiaTam = (c: Copia) => set({ opcoes: ordenarTamanhos(c.opcoes.map((o: any) => ({ id: uid(), nome: o.nome, preco: 0, ...(comUnidade(o.serve, c.grupo.rendimento_unidade) ? { serve: comUnidade(o.serve, c.grupo.rendimento_unidade) } : {}) }))) });
  // por quilo: marcar e desmarcar um peso (a lista fica sempre do menor pro maior)
  const marcados = new Set(g.opcoes.map(o => Number(o.peso_kg) || 0).filter(Boolean));
  const semPeso = g.opcoes.filter(o => !(Number(o.peso_kg) > 0));
  const pesos = Array.from(new Set([...PESOS_KG, ...marcados])).sort((a, b) => a - b);
  const [verOutroPeso, setVerOutroPeso] = useState(false);
  const precoKg = Number(form.preco_normal) || 0;
  const alternarPeso = (kg: number) => {
    if (marcados.has(kg)) set({ opcoes: g.opcoes.filter(o => Number(o.peso_kg) !== kg) });
    else set({ opcoes: [...g.opcoes, { id: uid(), nome: nomePeso(kg), preco: 0, peso_kg: kg }].sort((a, b) => (Number(a.peso_kg) || 99) - (Number(b.peso_kg) || 99)) });
  };
  // (14/10) a unidade do "Outro peso" vem da tag kg | g (começa em kg), sem adivinhar pelo número
  const [unNovo, setUnNovo] = useState<"kg" | "g">("kg");
  const lerPeso = (t: string): number | null => {
    const m = t.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
    if (!m) return null;
    const v = Number(m[1]);
    const kg = unNovo === "g" ? v / 1000 : v;
    return kg > 0 && kg <= 50 ? Math.round(kg * 1000) / 1000 : null;
  };
  // rendimento no por quilo: o número em cada peso, a unidade (fatias ou pessoas) vale pra todos
  const unKg = g.rendimento_unidade === "pessoas" ? "pessoas" : "fatias";
  const opDoPeso = (kg: number) => g.opcoes.find(o => Number(o.peso_kg) === kg);
  const servePeso = (kg: number, num: string) => set({ opcoes: g.opcoes.map(o => (Number(o.peso_kg) === kg ? { ...o, serve: num ? `${num} ${unKg}` : "" } : o)) });
  const trocarUnKg = () => { const nova = unKg === "fatias" ? "pessoas" : "fatias";
    set({ rendimento_unidade: nova, opcoes: g.opcoes.map(o => (numeroServe(o.serve) ? { ...o, serve: `${numeroServe(o.serve)} ${nova}` } : o)) }); };
  const addPeso = () => { const kg = lerPeso(novo); if (!kg) return; if (!marcados.has(kg)) alternarPeso(kg); setNovo(""); setVerOutroPeso(false); };
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

      {porPeso && (<>
        <p className="esc-lbl">Preço do kg</p>
        <label className="esc-kg-preco"><span>R$</span>
          <input inputMode="numeric" placeholder="0,00" value={precoKg > 0 ? textoBRL(precoKg) : ""} aria-label="Preço do kg"
            onChange={e => { const v = lerBRL(mascaraBRL(e.target.value) || "0"); setForm(f => ({ ...f, preco_normal: v, ...(Number(f.preco_promocional) > 0 ? { promocao: Number(f.preco_promocional) < v } : {}) })); }} />
        </label>
        <p className="esc-lbl">Quais pesos você faz?</p>
        <div className="esc-pesos-cab" aria-hidden="true"><span>Peso</span><span>Rendimento</span><span>Preço</span></div>
        <ul className="esc-pesos" role="group" aria-label="Pesos">
          {pesos.map(kg => {
            const on = marcados.has(kg);
            return (
              <li key={kg} className={`esc-peso-li${on ? " on" : ""}`}>
                <button type="button" className={`esc-peso${on ? " on" : ""}`} role="checkbox" aria-checked={on} onClick={() => alternarPeso(kg)}>
                  <i className="esc-peso-ck" aria-hidden="true">{on && <Check size={14} weight="bold" />}</i>
                  <b>{nomePeso(kg)}</b>
                </button>
                {on ? (
                  <span className="esc-peso-rend">
                    <input inputMode="numeric" placeholder="definir" value={numeroServe(opDoPeso(kg)?.serve)} aria-label={`Quantas ${unKg} rende ${nomePeso(kg)}`}
                      onChange={e => servePeso(kg, e.target.value.replace(/\D/g, "").slice(0, 4))} />
                    <button type="button" className="esc-peso-un" onClick={trocarUnKg} title="Trocar entre fatias e pessoas">{unKg}</button>
                  </span>
                ) : <span className="esc-peso-rend" aria-hidden="true" />}
                <span className="esc-peso-v">R$ {textoBRL(Math.round(kg * precoKg * 100) / 100) || "0,00"}</span>
              </li>
            );
          })}
          <li>
            {verOutroPeso ? (
              <div className="esc-peso-novo">
                <input autoFocus placeholder={unNovo === "kg" ? "Ex.: 1,5" : "Ex.: 800"} value={novo} inputMode="decimal" onChange={e => setNovo(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPeso(); } }} aria-label="Outro peso" />
                <span className="esc-seg esc-seg--2 esc-kgg" role="radiogroup" aria-label="Unidade do peso">
                  <button type="button" role="radio" aria-checked={unNovo === "kg"} className={unNovo === "kg" ? "on" : ""} onClick={() => setUnNovo("kg")}>kg</button>
                  <button type="button" role="radio" aria-checked={unNovo === "g"} className={unNovo === "g" ? "on" : ""} onClick={() => setUnNovo("g")}>g</button>
                </span>
                <button type="button" className="esc-nova-bt" onClick={addPeso} disabled={!lerPeso(novo)} aria-label="Pôr peso"><Plus size={20} weight="bold" /></button>
              </div>
            ) : (
              <button type="button" className="esc-peso-mais" onClick={() => setVerOutroPeso(true)}><Plus size={16} weight="bold" aria-hidden="true" />Outro peso</button>
            )}
          </li>
        </ul>
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
        <p className="esc-nota">Quer dar desconto? Você coloca na próxima etapa.</p>
      </>)}

      {!porPeso && g.opcoes.length === 0 && <UsarDeOutro copias={copiasTam.map(c => {
        return { ...c, resumo: c.opcoes.map((o: any) => { const sv = comUnidade(o.serve, c.grupo.rendimento_unidade); return sv ? `${o.nome} (${sv})` : o.nome; }).join(" · ") };
      })} onUsar={usarCopiaTam} />}
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
        {/* (13/10) colunas com título em cima: Tamanho · Rendimento · Tipo (sem o "serve" em cada linha) */}
        <div className="esc-tam-cab" aria-hidden="true"><span>Tamanho</span><span>Rendimento</span><span>Tipo</span><span /></div>
        <ul className="esc-ops esc-tam">
          {g.opcoes.map((o, i) => (
            <li key={o.id} className="esc-tam-li">
              {/* a ordem é automática (P, M, G… e os números): ao sair do campo, a lista se arruma */}
              <input className="esc-op-in" value={o.nome} onChange={e => renomear(o.id, e.target.value)} onBlur={() => set({ opcoes: ordenarTamanhos(g.opcoes) })} aria-label={`Nome do tamanho ${i + 1}`} />
              <input className="esc-tam-n" inputMode="numeric" placeholder="definir" value={numeroServe(o.serve)} onChange={e => gravarServe(o, e.target.value.replace(/\D/g, "").slice(0, 4), unDe(o))} aria-label={`Quanto rende o ${o.nome}`} />
              <select className="esc-tam-u" value={unDe(o)} onChange={e => { setUnLocal(u => ({ ...u, [o.id]: e.target.value })); if (numeroServe(o.serve)) gravarServe(o, numeroServe(o.serve), e.target.value); }} aria-label={`Tipo do rendimento do ${o.nome}`}>
                {Array.from(new Set(["pessoas", "fatias", "unidades", "copos", "potes", unDe(o)])).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <button type="button" className="esc-op-x" onClick={() => set({ opcoes: g.opcoes.filter(x => x.id !== o.id) })} aria-label={`Tirar ${o.nome}`}><X size={16} weight="bold" /></button>
            </li>
          ))}
        </ul>
        <div className="esc-nova esc-nova--1">
          <input placeholder={porPeso ? "Ex.: 2,5 kg" : "Outro tamanho…"} value={novo} onChange={e => setNovo(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} aria-label="Outro tamanho" />
          <button type="button" className="esc-nova-bt" onClick={add} disabled={!novo.trim()} aria-label="Pôr tamanho"><Plus size={20} weight="bold" /></button>
        </div>
        <p className="esc-nota">Rendimento é opcional, mas ajuda no cardápio.</p>
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

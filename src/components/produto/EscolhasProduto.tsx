import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Basket, Cake, CaretDown, Check, Drop, IceCream, Info, PencilSimple, Plus, Ruler, Sparkle, Trash, X } from "@phosphor-icons/react";
import KitQuantidadeEditor, { faltaKit } from "@/components/produto/KitQuantidadeEditor";
import { kitAtivo, presetKit, type KitQtdConfig } from "@/lib/kitQuantidade";
import { mascaraBRL, lerBRL, textoBRL, selecionarValorAoFocar } from "@/lib/moeda";
import { Botao, Janela } from "@/components/base";
import { lerPredefs, gravarPredefs, chaveTam, type PredefRend } from "@/lib/predefRendimento";
import { ProductModal } from "@/components/cart/ProductModal";
import { CartProvider } from "@/context/CartContext";
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
type GrupoTam = { ativo: boolean; min: number; max: number; distribuicao?: string; opcoes: OpTam[]; modo_preco_tamanho?: string; nome_exibicao?: string; rendimento_unidade?: string; rendimento_predef?: string };

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
];
// Por quilo (14/10): lista de pesos pra marcar, de 1 em 1 kg até 5 kg (todos já marcados), com o preço de cada um ao lado
const PESOS_KG = [1, 2, 3, 4, 5];
const PESOS_PADRAO = [1, 2, 3, 4, 5];
const nomePeso = (kg: number) => (kg < 1 ? `${Math.round(kg * 1000)} g` : `${String(kg).replace(".", ",")} kg`);
const PMG = ["Pequeno", "Médio", "Grande"];
const ARO = ["Aro 15", "Aro 20", "Aro 25"];
const opcoesDeNomes = (nomes: string[]) => nomes.map(n => ({ id: uid(), nome: n, preco: 0 }));
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
  /** (14/10) 0 = checklist; 1..n = a tela da escolha marcada número n */
  tela?: number;
  setTela?: (n: number) => void;
  edicao?: boolean;
};

/** (14/10) ordem das escolhas (a mesma do checklist e das telas) */
// (14/10) ordem fixa do checklist, todas sempre à mostra
export const TODAS_ESCOLHAS: Chave[] = ["tamanho", "massa", "recheio", "cobertura", "sabor", "quantidade"];
export function escolhaAtiva(form: any, c: Chave): boolean {
  if (c === "quantidade") return kitAtivo(form.kit_qtd);
  if (c === "tamanho") return !!form.grupo_tamanhos?.ativo;
  return !!form[CAMPO[c]]?.ativo;
}
export function escolhasAtivas(form: any): Chave[] { return TODAS_ESCOLHAS.filter(c => escolhaAtiva(form, c)); }
/** O que falta numa escolha pra seguir (null = tudo certo) */
export function faltaDaEscolha(form: any, c: Chave): { msg: string; alvo?: string } | null {
  if (c === "quantidade") return faltaKit(form.kit_qtd, { semPreco: true }); // (14/10) o preço dos kits é no passo Preço
  if (c === "tamanho") {
    const g = form.grupo_tamanhos;
    if (!(g?.opcoes?.length)) return { msg: "Coloque pelo menos 1 tamanho", alvo: 'input[aria-label="Outro tamanho"]' };
    // (14/10) o preço do kg agora vai no último passo (Preço e revisão), igual ao preço fixo
    return null;
  }
  const g = form[CAMPO[c]];
  if (!(g?.opcoes?.length)) return { msg: `Coloque pelo menos 1 ${ROTULO[c].toLowerCase()}`, alvo: ".esc-nova input" };
  return null;
}

/** (14/10) Produto de exemplo pro (i): mostra como o cliente escolhe. A foto fica em public/tutorial (dá pra trocar o arquivo). */
const EXEMPLO_PRODUTO = {
  id: "exemplo", nome: "Pudim Gourmet", descricao: "Exemplo de como o cliente escolhe no seu cardápio.", preco_normal: 0, forma_venda: "unidade", disponivel: true,
  imagem_url: "/tutorial/exemplo-pudim.jpg",
  grupo_tamanhos: { ativo: true, min: 1, max: 1, modo_preco_tamanho: "preco_fixo", rendimento_unidade: "pessoas", opcoes: [{ id: "t1", nome: "Pequeno", preco: 29.9, serve: "6 pessoas" }, { id: "t2", nome: "Médio", preco: 39.9, serve: "10 pessoas" }, { id: "t3", nome: "Grande", preco: 49.9, serve: "15 pessoas" }] },
  grupo_sabores: { ativo: true, min: 1, max: 1, distribuicao: "nenhuma", sabor_tem_preco_proprio: false, opcoes: [{ id: "s1", nome: "Ninho com Nutella", adicional: 10 }, { id: "s2", nome: "Tradicional de Leite Condensado", adicional: 0 }, { id: "s3", nome: "Pudim de Pistache", adicional: 10 }] },
};

export default function EscolhasProduto({ form, setForm, tipo, onKitChange, outros, tela = 0, setTela, edicao = false }: Props) {
  const [verPrevia, setVerPrevia] = useState(false); // (14/10) (i): o produto aberto como o cliente vê
  const nome = String(form.nome || "").trim();
  const kit = form.kit_qtd as KitQtdConfig | null;
  const temKit = kitAtivo(kit);
  const ativa = (c: Chave) => escolhaAtiva(form, c);
  // Kit e tamanho não andam juntos (o kit já é a "quantidade" do produto); sabor do kit fica dentro do kit
  const bloqueada = (c: Chave) => (c === "tamanho" && temKit) || (c === "quantidade" && !!form.grupo_tamanhos?.ativo) || (c === "sabor" && temKit);
  const ativas = TODAS_ESCOLHAS.filter(ativa);

  const ligar = (c: Chave) => {
    if (c === "quantidade") {
      onKitChange({ ...presetKit(tipo === "salgados" || /salgad/.test(norm(form.categoria)) ? "salgados" : "docinhos", kit), ativo: true });
    } else if (c === "tamanho") {
      setForm(f => ({ ...f, grupo_tamanhos: { ...(f.grupo_tamanhos || {}), ativo: true, min: 1, max: 1, distribuicao: "nenhuma",
        opcoes: f.grupo_tamanhos?.opcoes?.length ? f.grupo_tamanhos.opcoes : (f.forma_venda === "kg" ? opcoesDePesos(PESOS_PADRAO) : opcoesDeNomes(PMG)),
        modo_preco_tamanho: f.forma_venda === "kg" ? "por_peso" : (f.grupo_tamanhos?.modo_preco_tamanho === "por_peso" ? "preco_fixo" : (f.grupo_tamanhos?.modo_preco_tamanho || "preco_fixo")) } }));
    } else {
      const campo = CAMPO[c];
      setForm(f => {
        const g: Grupo = { ativo: false, min: 1, max: 1, distribuicao: "nenhuma", opcoes: [], ...(f[campo] || {}) };
        // começa já com as 2 primeiras sugestões (é só tirar ou pôr): menos digitação
        const sug = sugestoesDaChave(c, tipo, f.categoria);
        const opcoes = g.opcoes.length ? g.opcoes : sug.slice(0, 2).map(n => ({ id: uid(), nome: n, adicional: 0 }));
        return { ...f, [campo]: { ...g, ativo: true, min: g.opcoes.length ? g.min : 1, max: g.opcoes.length ? g.max : (c === "recheio" ? 2 : 1), opcoes } };
      });
    }
  };
  const desligar = (c: Chave) => {
    if (c === "quantidade" && kit) onKitChange({ ...kit, ativo: false });
    else if (c === "tamanho") setForm(f => ({ ...f, grupo_tamanhos: { ...(f.grupo_tamanhos || {}), ativo: false } }));
    else setForm(f => ({ ...f, [CAMPO[c as "massa"]]: { ...(f[CAMPO[c as "massa"]] || {}), ativo: false } }));
  };
  const alternar = (c: Chave) => { if (bloqueada(c)) return; if (ativa(c)) desligar(c); else ligar(c); };

  // ── Tela de uma escolha (Tamanho 1 de 2…) ──
  const atual = tela > 0 ? ativas[tela - 1] : null;
  if (atual) {
    return (
      <div className="esc esc-tela" onFocusCapture={selecionarValorAoFocar} onClickCapture={selecionarValorAoFocar}>
        {edicao && setTela && <button type="button" className="esc-voltar-lista" onClick={() => setTela(0)}>‹ Todas as escolhas</button>}
        {/* (14/10) no cadastro novo o header rosa já diz o passo ("3 de 5 · Tamanho") */}
        {edicao && <h2 className="esc-h">{ROTULO[atual]}</h2>}
        {atual === "quantidade" ? (kit ? <CartaoQuantidade kit={kit} onKitChange={onKitChange} nome={nome} /> : null)
          : atual === "tamanho" ? <CartaoTamanho form={form} setForm={setForm} outros={outros} />
          : <CartaoGrupo chave={atual} tipo={tipo} form={form} setForm={setForm} outros={outros} />}
      </div>
    );
  }

  // ── Checklist: só marcar ──
  const linha = (c: Chave) => {
    const on = ativa(c), trava = bloqueada(c) && !on;
    const f = on ? faltaDaEscolha(form, c) : null;
    return (
      <li key={c} className={`esc-chk${on ? " on" : ""}${trava ? " trava" : ""}`}>
        <button type="button" className="esc-chk-bt" role="checkbox" aria-checked={on} disabled={trava} onClick={() => alternar(c)}>
          <i className="esc-chk-ck" aria-hidden="true">{on && <Check size={14} weight="bold" />}</i>
          <span className="esc-tx">
            <b>{ROTULO[c]}</b>
            {/* (14/10) sem texto de exemplo: só o motivo da trava e, na edição, o que já foi cadastrado */}
            {(trava || (on && edicao)) && <small className={f && edicao ? "esc-falta" : undefined}>
              {trava ? (c === "tamanho" ? "Não junta com Quantidade" : c === "quantidade" ? "Não junta com Tamanho" : "Os sabores ficam na Quantidade")
                : f ? faltaCurta(f.msg) : resumo(c, form)}
            </small>}
          </span>
        </button>
        {on && edicao && setTela && <button type="button" className="esc-chk-ed" onClick={() => setTela(ativas.indexOf(c) + 1)}>Editar</button>}
      </li>
    );
  };
  return (
    <div className="esc">
      <h2 className="esc-h esc-h--info">O que o cliente escolhe?
        <button type="button" className="esc-info" onClick={() => setVerPrevia(true)} aria-label="Ver onde isso aparece no cardápio"><Info size={20} weight="bold" /></button>
      </h2>
      {verPrevia && (
        <CartProvider>
          <ProductModal isOpen previa onClose={() => setVerPrevia(false)} onAdicionar={() => setVerPrevia(false)} product={EXEMPLO_PRODUTO as any} />
        </CartProvider>
      )}
      <p className="esc-s">Marque o que vale{nome ? <> pro <b>{nome}</b></> : null}. {edicao ? "Toque em Editar pra mudar." : "Você cadastra cada um em seguida."}</p>
      <ul className="esc-chks" role="group" aria-label="Escolhas">
        {TODAS_ESCOLHAS.map(linha)}
      </ul>
      {(ativas.length === 0 || !edicao) && <p className={`esc-nota${ativas.length === 0 ? " esc-nota--forte" : ""}`}>{ativas.length === 0 ? "Sem marcar, o cliente só diz quantos quer." : `${ativas.length} ${ativas.length === 1 ? "escolha marcada" : "escolhas marcadas"}. ${edicao ? "" : "Continue pra cadastrar."}`}</p>}
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
  const [avancado, setAvancado] = useState(false); // (14/10) janela "Avançado" (quantos, obrigatório, preço por sabor)
  const set = (patch: Partial<Grupo>) => setForm(f => ({ ...f, [campo]: { ...g, ...(f[campo] || {}), ...patch } }));
  const sug = sugestoesDaChave(chave, tipo, form.categoria).filter(s => !g.opcoes.some(o => norm(o.nome) === norm(s)));
  const precoProprio = chave === "sabor" && !!g.sabor_tem_preco_proprio;
  const plural = PLURAL[chave];

  const adicionar = (nomeOp: string, valor = 0) => {
    const n = primeiraMaiuscula(nomeOp);
    if (!n || g.opcoes.some(o => norm(o.nome) === norm(n))) return;
    set({ opcoes: [...g.opcoes, precoProprio ? { id: uid(), nome: n, adicional: 0, preco: valor } : { id: uid(), nome: n, adicional: valor }] });
  };
  const addDigitado = () => { adicionar(nova, 0); setNova(""); setNovoValor(""); void novoValor; };
  const valorDe = (o: Opcao) => (precoProprio ? Number(o.preco) || 0 : Number(o.adicional) || 0);
  const mudarValor = (id: string, txt: string) => {
    const v = lerBRL(txt || "0");
    set({ opcoes: g.opcoes.map(o => (o.id === id ? (precoProprio ? { ...o, preco: v } : { ...o, adicional: v }) : o)) });
  };
  const quantosAtual = g.max >= 99 ? 99 : g.max;

  return (
    <div className="esc-corpo">
      <p className="esc-lbl">Opções</p>
      {g.opcoes.length > 0 && (
        <div className={`esc-tab${precoProprio ? " esc-tab--1" : ""}`} role="table" aria-label={`Opções de ${chave}`}>
          <div className="esc-tab-l esc-tab-h" role="row"><span role="columnheader">{ROTULO[chave]}</span>{!precoProprio && <span role="columnheader">Custa a mais</span>}<span role="columnheader" aria-label="Tirar" /></div>
          {g.opcoes.map(o => (
            <div key={o.id} className="esc-tab-l" role="row">
              <span role="cell" className="esc-tab-nm">{o.nome}</span>
              {!precoProprio && (
                <span role="cell">
                  <label className="esc-tab-in" aria-label={`Valor a mais de ${o.nome}`}><span>+ R$</span>
                    <input inputMode="numeric" placeholder="0,00" value={valorDe(o) > 0 ? textoBRL(valorDe(o)) : ""} onChange={e => mudarValor(o.id, mascaraBRL(e.target.value))} />
                  </label>
                </span>
              )}
              <span role="cell"><button type="button" className="esc-op-x" onClick={() => set({ opcoes: g.opcoes.filter(x => x.id !== o.id) })} aria-label={`Tirar ${o.nome}`}><X size={16} weight="bold" /></button></span>
            </div>
          ))}
        </div>
      )}
      {sug.length > 0 && (
        <div className="esc-chips esc-chips--sug" role="group" aria-label="Sugestões">
          {sug.slice(0, 6).map(s => <button key={s} type="button" className="esc-chip esc-chip--sug" onClick={() => adicionar(s)}><Plus size={14} weight="bold" aria-hidden="true" />{s}</button>)}
        </div>
      )}
      <div className="esc-nova esc-nova--1">
        <input placeholder={NOVA[chave]} value={nova} onChange={e => setNova(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addDigitado(); } }} aria-label={NOVA[chave].replace("…", "")} />
        <button type="button" className="esc-nova-bt esc-nova-bt--txt" onClick={addDigitado} disabled={!nova.trim()}>Cadastrar</button>
      </div>
      <p className="esc-nota">{precoProprio ? "O preço de cada sabor você coloca no último passo." : "Sem valor: já vem no preço. Com valor: custa a mais."}</p>
      {/* (14/10) regras no "Avançado" (como o Rendimento): a tela abre direto nas opções */}
      <button type="button" className="esc-rend-linha esc-av-linha" onClick={() => setAvancado(true)}>
        <span className="esc-tx"><b>Avançado</b>
          <small>{quantosAtual === 1 ? "Escolhe 1" : quantosAtual >= 99 ? "À vontade" : `Escolhe até ${quantosAtual}`} · {g.min >= 1 ? "Obrigatório" : "Opcional"}{chave === "sabor" && precoProprio ? " · preço por sabor" : ""}</small></span>
        <span className="esc-rend-bt">Editar</span>
      </button>
      <Janela aberta={avancado} aoFechar={() => setAvancado(false)} titulo="Avançado" tipo="conteudo" umaAcao
        acoes={<Botao onClick={() => setAvancado(false)}>Pronto</Botao>}>
        <div className="esc esc-jan">
          <div className="esc-corpo">
      <p className="esc-lbl">Quantos o cliente escolhe</p>
            <div className="esc-seg" role="radiogroup" aria-label="Quantos o cliente escolhe">
              {QUANTOS.map(([r, v]) => (
                <button key={r} type="button" role="radio" aria-checked={quantosAtual === v} className={quantosAtual === v ? "on" : ""}
                  onClick={() => set({ max: v, min: g.min >= 1 ? 1 : 0 })}>{r}</button>
              ))}
            </div>
            <p className="esc-dica">No cardápio: {quantosAtual === 1 ? `"Escolha 1 ${chave}"` : quantosAtual >= 99 ? `"Escolha quantos ${plural} quiser"` : `"Escolha até ${quantosAtual} ${plural}"`}.</p>

            {/* (14/10) no padrão do resto: caixinhas no lugar das chaves, tabelinha das opções, "Cadastrar" e dica tracejada */}
            <div className="esc-cks">
              <button type="button" className={`esc-ckl${g.min >= 1 ? " on" : ""}`} role="checkbox" aria-checked={g.min >= 1} onClick={() => set({ min: g.min >= 1 ? 0 : 1 })}>
                <i aria-hidden="true">{g.min >= 1 && <Check size={14} weight="bold" />}</i>
                <span><b>Obrigatório</b><small>{g.min >= 1 ? "Sem escolher, não dá pra pedir" : "Pode pedir sem escolher"}</small></span>
              </button>
              {chave === "sabor" && (
                <button type="button" className={`esc-ckl${precoProprio ? " on" : ""}`} role="checkbox" aria-checked={precoProprio} onClick={() => set({ sabor_tem_preco_proprio: !precoProprio })}>
                  <i aria-hidden="true">{precoProprio && <Check size={14} weight="bold" />}</i>
                  <span><b>Cada sabor tem o seu preço</b><small>{precoProprio ? "Você coloca no último passo" : "Desmarcado: só soma se custar a mais"}</small></span>
                </button>
              )}
            </div>

          </div>
        </div>
      </Janela>
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
            set({ modo_preco_tamanho: "preco_fixo", ...(soPesos || !g.opcoes.length ? { opcoes: opcoesDeNomes(PMG) } : {}) });
            setForm(f => ({ ...f, forma_venda: f.forma_venda === "kg" ? "unidade" : f.forma_venda }));
          }}>Preço fixo</button>
        <button type="button" role="radio" aria-checked={porPeso} className={porPeso ? "on" : ""}
          onClick={() => {
            // (14/10) Pequeno/Médio/Grande não têm peso: no por quilo ficam só os que têm (ex.: "1,5 kg"); sem nenhum, vêm os pesos padrão
            const comPeso = g.opcoes.map(o => ({ ...o, peso_kg: Number(o.peso_kg) > 0 ? o.peso_kg : pesoDoNome(o.nome) })).filter(o => Number(o.peso_kg) > 0);
            set({ modo_preco_tamanho: "por_peso", opcoes: comPeso.length ? comPeso : opcoesDePesos(PESOS_PADRAO) }); setForm(f => ({ ...f, forma_venda: "kg" }));
          }}>Por quilo</button>
      </div>

      {porPeso && (<>
        <p className="esc-lbl">Quais pesos você vende?</p>
        <ul className="esc-pesos" role="group" aria-label="Pesos">
          {pesos.map(kg => {
            const on = marcados.has(kg);
            return (
              <li key={kg} className={`esc-peso-li${on ? " on" : ""}`}>
                <button type="button" className={`esc-peso${on ? " on" : ""}`} role="checkbox" aria-checked={on} onClick={() => alternarPeso(kg)}>
                  <i className="esc-peso-ck" aria-hidden="true">{on && <Check size={14} weight="bold" />}</i>
                  <b>{nomePeso(kg)}</b>
                </button>
                {precoKg > 0 && <span className="esc-peso-v">R$ {textoBRL(Math.round(kg * precoKg * 100) / 100)}</span>}
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
                <button type="button" className="esc-nova-bt esc-nova-bt--txt" onClick={addPeso} disabled={!lerPeso(novo)}>Cadastrar</button>
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
        <LinhaRendimento g={g} set={set} nomeProduto={String(form.nome || "")} />
        <p className="esc-nota">O preço do kg você coloca no último passo.</p>
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
        {(() => { const nomes = g.opcoes.map(o => norm(o.nome)).join("|"); const eAro = nomes === ARO.map(norm).join("|"); const outro = eAro ? PMG : ARO;
          return (
            <p className="esc-trocar">Trocar por:
              <button type="button" onClick={() => set({ opcoes: opcoesDeNomes(outro) })}>{eAro ? "Pequeno · Médio · Grande" : "Aro 15 · 20 · 25"}</button>
            </p>
          ); })()}
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
          <button type="button" className="esc-nova-bt esc-nova-bt--txt" onClick={add} disabled={!novo.trim()}>Cadastrar</button>
        </div>
        <LinhaRendimento g={g} set={set} nomeProduto={String(form.nome || "")} />
      </>)}
    </div>
  );
}

/* ── Quantidade (cento, kit de 50, 100…) e os sabores que vão dentro: o editor de kit que já existe ── */
function CartaoQuantidade({ kit, onKitChange, nome }: { kit: KitQtdConfig; onKitChange: (k: KitQtdConfig) => void; nome: string }) {
  return (
    <div className="esc-corpo esc-corpo--kit">
      <KitQuantidadeEditor modo="completo" semPreco kit={kit} onChange={onKitChange} nomeProduto={nome} />
    </div>
  );
}

/* ── (14/10) Rendimento: uma linha na janela do tamanho que abre a sua própria janela, com predefinições por nome ── */
function LinhaRendimento({ g, set, nomeProduto = "" }: { g: GrupoTam; set: (p: Partial<GrupoTam>) => void; nomeProduto?: string }) {
  const [aberta, setAberta] = useState(false);
  const comNum = g.opcoes.filter(o => numeroServe(o.serve));
  const un = String(g.opcoes.map(o => String(o.serve || "").match(/^\s*\d+\s*([^\d\s].*)$/)?.[1]).find(Boolean) || g.rendimento_unidade || "pessoas").trim();
  const ok = comNum.length > 0;
  // resumo curto que cabe numa linha: "Serve até 10 a 50 pessoas" (ou "Serve até 10 pessoas" se for um só)
  const nsR = comNum.map(o => Number(numeroServe(o.serve))).sort((x, y) => x - y);
  const resumo = ok ? `Serve até ${nsR.length > 1 && nsR[0] !== nsR[nsR.length - 1] ? `${nsR[0]} a ${nsR[nsR.length - 1]}` : nsR[0]} ${un}` : "";
  return (<>
    <button type="button" className={`esc-rend-linha${ok ? " ok" : ""}`} onClick={() => setAberta(true)}>
      {ok && <span className="esc-ic esc-ic--ok"><Check size={18} weight="bold" /></span>}
      <span className="esc-tx">
        <b>{ok ? "Rendimento" : <>Rendimento <span className="esc-rec">Recomendado</span></>}</b>
        {/* (14/10) veio de uma predefinição: diz qual */}
        <small>{ok ? (g.rendimento_predef ? <>Predefinição ativada: <b>{g.rendimento_predef}</b></> : resumo) : "Pessoas ou fatias por tamanho"}</small>
      </span>
      <span className="esc-rend-bt">{ok ? "Editar" : "Definir"}</span>
    </button>
    {aberta && <JanelaRendimento g={g} set={set} nomeProduto={nomeProduto} onFechar={() => setAberta(false)} />}
  </>);
}

// (14/10) exemplo do nome da predefinição pelo produto: "Pudim Gourmet" → "Rendimentos do Pudim"
function exemploPredef(nome: string): string {
  const p = String(nome || "").trim().split(/\s+/)[0] || "";
  if (!p) return "Rendimentos de Bolos de Aniversário";
  const w = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  return `Rendimentos ${/a$/i.test(w) ? "da" : "do"} ${w}`;
}
function JanelaRendimento({ g, set, onFechar, nomeProduto = "" }: { g: GrupoTam; set: (p: Partial<GrupoTam>) => void; onFechar: () => void; nomeProduto?: string }) {
  const unAtual = String(g.opcoes.map(o => String(o.serve || "").match(/^\s*\d+\s*([^\d\s].*)$/)?.[1]).find(Boolean) || g.rendimento_unidade || "pessoas").trim();
  const [un, setUn] = useState<string>(["fatias", "pessoas", "unidades"].includes(unAtual) ? unAtual : "pessoas");
  const [nums, setNums] = useState<Record<string, string>>(() => Object.fromEntries(g.opcoes.map(o => [o.id, numeroServe(o.serve)])));
  const [predefs, setPredefs] = useState<PredefRend[]>([]);
  const [usada, setUsada] = useState<string>(g.rendimento_predef || "");
  const [perguntar, setPerguntar] = useState(false); // (14/10) "Salvar como predefinição?" ao salvar sem uma
  const [nomeAviso, setNomeAviso] = useState("");
  // (14/10) só as predefinições que servem: pelo menos um tamanho com o mesmo nome (P/M/G não serve pra 1 kg, 2 kg…)
  const uteis = predefs.filter(p => g.opcoes.some(o => p.itens[chaveTam(o.nome)] !== undefined));
  useEffect(() => { lerPredefs().then(setPredefs); }, []);

  const aplicar = (p: PredefRend) => {
    setUn(p.un || "pessoas"); setUsada(p.nome);
    setNums(n => Object.fromEntries(g.opcoes.map(o => [o.id, p.itens[chaveTam(o.nome)] ?? n[o.id] ?? ""])));
  };
  // (14/10) a predefinição em uso continua igual (mesma unidade e mesmos números)? então não precisa perguntar
  const pUsada = predefs.find(p => p.nome === usada);
  const predefIgual = !!pUsada && (pUsada.un || "pessoas") === un
    && g.opcoes.every(o => (nums[o.id] || "") === (pUsada.itens[chaveTam(o.nome)] || ""));
  const gravar = (predef: string) => {
    set({ rendimento_unidade: un, rendimento_predef: predef, opcoes: g.opcoes.map(o => ({ ...o, serve: nums[o.id] ? `${nums[o.id]} ${un}` : "" })) });
    onFechar();
  };
  // com números: pergunta sempre se quer guardar como predefinição (menos quando a que está em uso não mudou)
  const salvar = () => {
    const temNum = g.opcoes.some(o => nums[o.id]);
    if (!temNum) { gravar(""); return; }
    if (predefIgual) { gravar(usada); return; }
    setNomeAviso(usada || ""); setPerguntar(true);
  };
  const salvarComoPredefEGravar = async () => {
    const nome = primeiraMaiuscula(nomeAviso); if (!nome) return;
    const itens: Record<string, string> = {};
    g.opcoes.forEach(o => { if (nums[o.id]) itens[chaveTam(o.nome)] = nums[o.id]; });
    const lista = [...predefs.filter(p => norm(p.nome) !== norm(nome)), { nome, un, itens }];
    const ok = await gravarPredefs(lista);
    setPerguntar(false);
    if (!ok) { gravar(""); return; } // não gravou a predefinição: salva o rendimento mesmo assim
    setPredefs(lista); gravar(nome);
  };

  return (
    <Janela aberta aoFechar={onFechar} titulo="Rendimento" tipo="conteudo" travada
      acoes={<><Botao variante="secundario" onClick={onFechar}>Voltar</Botao><Botao onClick={salvar}>Salvar rendimento</Botao></>}>
      <div className="esc esc-jan esc-rend" onFocusCapture={selecionarValorAoFocar} onClickCapture={selecionarValorAoFocar}>
        {uteis.length > 0 && (<>
          <p className="esc-lbl">Usar uma predefinição</p>
          {/* (14/10) até 4: botões; mais que isso vira uma lista pra escolher */}
          {uteis.length <= 4 ? (
            <div className="esc-chips" role="group" aria-label="Predefinições">
              {uteis.map(p => (
                <button key={p.nome} type="button" className={`esc-chip esc-predef${usada === p.nome ? " on" : ""}`} onClick={() => aplicar(p)}>{usada === p.nome && <Check size={14} weight="bold" aria-hidden="true" />}{p.nome}</button>
              ))}
            </div>
          ) : (
            <label className="esc-predef-sel">
              <select value={usada} aria-label="Escolher predefinição" onChange={e => { const p = predefs.find(x => x.nome === e.target.value); if (p) aplicar(p); }}>
                <option value="" disabled>Escolher predefinição</option>
                {uteis.map(p => <option key={p.nome} value={p.nome}>{p.nome}</option>)}
              </select>
              <CaretDown size={16} weight="bold" aria-hidden="true" />
            </label>
          )}
        </>)}

        <p className="esc-lbl">Conta em</p>
        <div className="esc-seg esc-seg--3" role="radiogroup" aria-label="Unidade do rendimento">
          {[["fatias", "Fatias"], ["pessoas", "Pessoas"], ["unidades", "Unidades"]].map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={un === v} className={un === v ? "on" : ""} onClick={() => setUn(v)}>{l}</button>
          ))}
        </div>

        <p className="esc-lbl">Quanto cada tamanho serve</p>
        <ul className="esc-ops esc-rend-lista">
          {g.opcoes.map(o => (
            <li key={o.id} className="esc-rend-li">
              <span className="esc-op-nm">{o.nome}</span>
              <span className="esc-rend-campo">serve até
                <input inputMode="numeric" placeholder="definir" value={nums[o.id] || ""} aria-label={`Quantas ${un} serve ${o.nome}`}
                  onChange={e => setNums(n => ({ ...n, [o.id]: e.target.value.replace(/\D/g, "").slice(0, 4) }))} />
                <em>{un}</em>
              </span>
            </li>
          ))}
        </ul>

        <p className="esc-nota">No cardápio aparece "Serve até 10 {un}".</p>
      </div>
      {/* tocar fora ou no X só fecha a pergunta (volta pro rendimento, sem salvar nada) */}
      <Janela aberta={perguntar} aoFechar={() => setPerguntar(false)} titulo="Salvar como predefinição?" tipo="aviso"
        icone={<Sparkle size={32} />} texto="Dê um nome e, nos próximos produtos, é só tocar nele: o rendimento vem preenchido e o cadastro fica bem mais rápido."
        acoes={<><Botao variante="secundario" onClick={() => { setPerguntar(false); gravar(""); }}>Agora não</Botao><Botao onClick={salvarComoPredefEGravar} disabled={!nomeAviso.trim()}>Salvar e usar</Botao></>}>
        <input className="esc-aviso-in" autoFocus placeholder={exemploPredef(nomeProduto)} value={nomeAviso} maxLength={40}
          onChange={e => setNomeAviso(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); salvarComoPredefEGravar(); } }} aria-label="Nome da predefinição" />
        {predefs.some(p => norm(p.nome) === norm(nomeAviso.trim())) && nomeAviso.trim() && <p className="esc-nota">Já existe uma com esse nome: ela será substituída.</p>}
      </Janela>
    </Janela>
  );
}

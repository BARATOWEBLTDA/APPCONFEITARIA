import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRecorte } from "@/components/ui/useRecorte";
import { Camera, Image as ImagemIc, MagnifyingGlass, Trash, WarningCircle, X } from "@phosphor-icons/react";
import { parseNumBR } from "@/lib/numeroBR";

// 13/10: "Quanto pagou" igual aos outros campos de dinheiro: digita 749 e aparece 7,49
const reais = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/apiFetch";
import { Botao, BotaoIcone, Campo, Janela, Titulo, avisar, confirmar } from "@/components/base";
import "@/pages/clientes.css";
import "./ingredientes.css";

export type InsumoQuick = {
  id: string;
  nome: string;
  marca?: string;
  categoria?: string;
  unidade: string;
  embalagem_tipo: string;
  custo_unitario: number;
  imagem_url?: string;
  valor_compra: number;
  qtd_embalagem: number;
};

interface Props {
  userId: string;
  initialName?: string;
  /** Quando passado, o componente entra em modo EDIÇÃO (UPDATE em vez de INSERT). */
  editing?: InsumoQuick;
  onSaved: (insumo: InsumoQuick) => void;
  onCancel: () => void;
  /** Quando passado e em modo edição, exibe botão de excluir. */
  onDelete?: () => void;
  /** true: abre numa Janela própria (tela Ingredientes). Sem isso, aparece dentro da janela de quem chamou (ficha técnica, produtos). */
  janela?: boolean;
  /** só com janela: aberta ou fechando (pra animação de saída) */
  aberta?: boolean;
}

type Form = {
  nome: string;
  marca: string;
  categoria: string;
  unidade: string;
  embalagem_tipo: string;
  valor_compra: string;
  qtd_embalagem: string;
  imagem_url: string;
};

const CATEGORIAS_DEFAULT = ["Ingredientes", "Embalagens", "Decorações", "Bebidas", "Descartáveis", "Outros"];

/** Medidas (mesmos valores de antes: un, kg, g, L, ml) */
const MEDIDAS = [
  { sigla: "g", nome: "g" },
  { sigla: "kg", nome: "kg" },
  { sigla: "ml", nome: "ml" },
  { sigla: "L", nome: "L" },
  { sigla: "un", nome: "unidade" },
];

/** Embalagens (mesmos valores salvos de antes). As mais usadas aparecem direto; o resto fica em "Outra". */
const EMB_PRINCIPAIS = ["Avulso", "Pacote", "Caixa", "Lata", "Pote", "Garrafa", "Bandeja"];
const EMB_OUTRAS = ["Frasco", "Bisnaga", "Sachê", "Envelope", "Balde", "Rolo"];
const EMB_FEMININAS = ["Caixa", "Lata", "Garrafa", "Bandeja", "Bisnaga"];

/**
 * O que o nome diz sobre a medida (4.29, revisado).
 * A primeira regra que bate vale; por isso os nomes mais específicos vêm antes
 * ("leite condensado" e "doce de leite" antes de "leite", "coco ralado" antes de "coco").
 *   tipo .... peso (g/kg), volume (ml/L) ou unidade
 *   un ...... a medida sugerida
 *   ambos ... aceita peso e volume sem alerta (vem escrito dos dois jeitos na embalagem)
 *   ex ...... exemplo que aparece no alerta
 */
type PeloNome = { tipo: "peso" | "volume" | "unidade"; un: string; ambos?: boolean; ex?: string };
const REGRAS_NOME: [string, PeloNome][] = [
  // doces e laticínios que parecem líquidos mas vêm em gramas
  ["leite condensado", { tipo: "peso", un: "g", ambos: true, ex: "lata de 395 g" }],
  ["creme de leite", { tipo: "peso", un: "g", ambos: true, ex: "caixinha de 200 g" }],
  ["doce de leite", { tipo: "peso", un: "g", ex: "pote de 400 g" }],
  ["leite em p[oó]|leite ninho", { tipo: "peso", un: "g", ex: "lata de 400 g" }],
  ["leite de coco", { tipo: "volume", un: "ml", ex: "garrafa de 200 ml" }],
  ["coco ralado|coco em flocos", { tipo: "peso", un: "g", ex: "pacote de 100 g" }],
  ["glucose|mel|xarope de glucose", { tipo: "peso", un: "g", ambos: true }],
  ["ess[eê]ncias?|extratos?|aromas?|aromatizantes?", { tipo: "volume", un: "ml", ambos: true, ex: "frasco de 30 ml" }],
  ["nutella|cacau|chocolates?|cobertura|gotas de chocolate|granulados?|confeitos?|corantes?|pasta americana|gelatina|ganache", { tipo: "peso", un: "g" }],
  ["manteiga|margarina|cream cheese|queijos?|requeij[aã]o|fermento|bicarbonato|castanhas?|nozes|am[eê]ndoas?|amendoim|pistache|uvas? passas?", { tipo: "peso", un: "g", ex: "tablete de 200 g" }],
  ["farinhas?|a[cç][uú]car(es)?|sal|polvilho|amido|maisena|fub[aá]|aveia|trigo", { tipo: "peso", un: "kg", ex: "pacote de 1 kg" }],
  // líquidos
  ["leites?", { tipo: "volume", un: "ml", ex: "caixa de 1 L" }],
  ["sucos?|[aá]guas?|[oó]leos?|[aá]lcool|vinagre|licor|rum|conhaque|caf[eé] coado|refrigerantes?", { tipo: "volume", un: "ml" }],
  // contáveis
  ["ovos?", { tipo: "unidade", un: "un", ex: "bandeja com 30 un" }],
  // frutas: vêm em bandeja/kg e a receita usa por unidade ou por peso. Sugere unidade, mas aceita peso sem alerta
  ["morangos?|lim[oõ](es)?|lim[aã]o|laranjas?|bananas?|ma[cç][aã]s?|abacaxis?|kiwis?|peras?|cocos?|maracuj[aá]s?|uvas?", { tipo: "unidade", un: "un", ambos: true }],
  ["bombons?|biscoitos?|wafers?|pa[cç]ocas?|bis", { tipo: "unidade", un: "un" }],
  ["forminhas?|velas?|palitos?|saquinhos?|sacos?|etiquetas?|adesivos?|copos?|pratinhos?|colheres?|garfos?|tampas?|toppers?|topos?|bases?|cake boards?|caixas?|potes?|marmitas?|fitas?|la[cç]os?", { tipo: "unidade", un: "un" }],
];

function pelonome(nome: string): PeloNome | null {
  const n = nome.toLowerCase();
  for (const [padrao, r] of REGRAS_NOME) {
    // \b não entende acento; aqui "palavra" é qualquer letra, com ou sem acento
    if (new RegExp(`(?<!\\p{L})(?:${padrao})(?!\\p{L})`, "u").test(n)) return r;
  }
  return null;
}

/** Sugere a medida: pelo nome primeiro (mais específico); se o nome não diz nada, pela embalagem. */
function sugerirUnidade(nome: string, embalagem: string): string {
  const r = pelonome(nome);
  if (r) return r.un;
  switch (embalagem) {
    case "Pacote": case "Caixa": case "Balde": return "kg";
    case "Garrafa": case "Frasco": return "ml";
    case "Bandeja": case "Rolo": return "un";
    default: return "g"; // Lata, Pote, Bisnaga, Sachê, Envelope, Avulso
  }
}

/** Alerta só quando a medida claramente não combina com o nome. Devolve a mensagem ou null. */
function detectarInconsistencia(nome: string, unidade: string): string | null {
  if (!nome || nome.trim().length < 3) return null;
  const r = pelonome(nome);
  if (!r) return null;
  const nm = nome.trim();
  const ex = r.ex ? `, como ${r.ex}` : "";
  const peso = unidade === "g" || unidade === "kg", volume = unidade === "ml" || unidade === "L";
  const emPeso = r.un === "kg" ? "quilos (kg) ou gramas (g)" : "gramas (g)";
  if (r.tipo === "peso" && (unidade === "un" || (volume && !r.ambos)))
    return `${nm}: o mais comum é medir em ${emPeso}${ex}. Quer trocar?`;
  if (r.tipo === "volume" && (unidade === "un" || (peso && !r.ambos)))
    return `${nm}: o mais comum é medir em mililitros (ml) ou litros (L)${ex}. Quer trocar?`;
  if (r.tipo === "unidade" && unidade !== "un" && !r.ambos)
    return `${nm}: o mais comum é contar em unidades${ex}. Quer trocar?`;
  return null;
}

/* ───────── Ajudantes de exibição (também usados na lista de Ingredientes) ───────── */

const numBR = (v: number) => (Math.round(v * 1000) / 1000).toString().replace(".", ",");

/** Custo sempre com 2 casas ("R$ 0,10"); abaixo de 1 centavo, "menos de R$ 0,01" (10/10) */
export function formatarCusto(v: number) {
  const n = Number(v) || 0;
  if (n > 0 && n < 0.01) return "menos de R$\u00a00,01";
  return `R$\u00a0${n.toFixed(2).replace(".", ",")}`;
}

/**
 * Nome da categoria na tela. O valor salvo continua o mesmo; só o rótulo muda.
 * "Ingredientes" vira "Alimentos" pra não repetir o título da tela (10/10).
 */
const ROTULO_CATEGORIA: Record<string, string> = { Ingredientes: "Alimentos" };
export function rotuloCategoria(c?: string | null) {
  const v = (c || "").trim();
  return ROTULO_CATEGORIA[v] || v;
}

/**
 * Custo na receita numa escala que se adapta ao tamanho da embalagem,
 * pra não mostrar R$ 0,005 por g.
 *   Peso/volume: em g ou ml, a cada 100 (embalagem ≥ 1 kg/L), 10 (≥ 100) ou 1.
 *   Unidade: cada.
 */
export function custoNaReceita(custo_unitario: number, unidade: string, qtd_embalagem: number): { valor: number; por: string } {
  let custoBase = custo_unitario || 0;
  let unidadeBase = unidade;
  let totalBase = qtd_embalagem || 1;
  if (unidade === "kg" || unidade === "L") {
    custoBase = custoBase / 1000;
    unidadeBase = unidade === "kg" ? "g" : "ml";
    totalBase = totalBase * 1000;
  }
  if (unidadeBase !== "g" && unidadeBase !== "ml") return { valor: custoBase, por: "cada" };
  const escala = totalBase >= 1000 ? 100 : totalBase >= 100 ? 10 : 1;
  return { valor: custoBase * escala, por: escala === 1 ? `por ${unidadeBase}` : `a cada ${escala} ${unidadeBase}` };
}

/** "lata de 395 g" · "bandeja com 30 un" · "1 kg" (avulso) */
export function descreverCompra(embalagem: string, qtd: number, unidade: string) {
  let n = qtd || 1, u = unidade;
  if ((u === "g" || u === "ml") && n >= 1000) { n = n / 1000; u = u === "g" ? "kg" : "L"; } // 1000 g → 1 kg
  const q = `${numBR(n)}\u00a0${u}`; // sem quebrar "1 / kg" em duas linhas
  if (!embalagem || embalagem === "Avulso") return q;
  return `${embalagem.toLowerCase()} ${unidade === "un" ? "com" : "de"} ${q}`;
}

/**
 * Cadastro e edição de ingrediente.
 * Reutilizado em /insumos (numa Janela) e dentro da ficha técnica e do cadastro de produto.
 */
export default function QuickAddInsumo({ userId, initialName, editing, onSaved, onCancel, onDelete, janela = false, aberta = true }: Props) {
  const isEditing = !!editing;

  const [form, setForm] = useState<Form>(() => {
    if (editing) {
      return {
        nome: editing.nome || "",
        marca: editing.marca || "",
        categoria: editing.categoria || "Ingredientes",
        unidade: editing.unidade || "g",
        embalagem_tipo: editing.embalagem_tipo || "Avulso",
        valor_compra: editing.valor_compra ? reais(Number(editing.valor_compra)) : "",
        qtd_embalagem: editing.qtd_embalagem ? String(editing.qtd_embalagem).replace(".", ",") : "1",
        imagem_url: editing.imagem_url || "",
      };
    }
    return {
      nome: initialName || "",
      marca: "",
      categoria: "Ingredientes",
      unidade: "g",
      embalagem_tipo: "Avulso",
      valor_compra: "",
      qtd_embalagem: "",
      imagem_url: "",
    };
  });
  const inicial = useRef(form);
  const mudou = JSON.stringify(form) !== JSON.stringify(inicial.current);

  // Marca se o usuário já tocou manualmente na unidade — quando true,
  // paramos de sobrescrever a escolha dele com sugestões automáticas.
  const [unidadeTocadaManualmente, setUnidadeTocadaManualmente] = useState(isEditing);

  // Re-sugere a unidade quando nome ou embalagem mudam, mas só enquanto
  // o usuário não escolheu manualmente. Em modo edição, nunca sobrescreve.
  useEffect(() => {
    if (unidadeTocadaManualmente) return;
    const sugestao = sugerirUnidade(form.nome, form.embalagem_tipo);
    if (sugestao !== form.unidade) {
      setForm(f => ({ ...f, unidade: sugestao }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.nome, form.embalagem_tipo, unidadeTocadaManualmente]);

  // Mensagem de alerta caso a combinação esteja incoerente
  const alertaIncoerencia = detectarInconsistencia(form.nome, form.unidade);
  const [alertaDispensado, setAlertaDispensado] = useState<string | null>(null);

  const [imagens, setImagens] = useState<string[]>([]);
  const [buscandoImg, setBuscandoImg] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [avisoNome, setAvisoNome] = useState(0);
  const nomeRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!avisoNome) return; const t = setTimeout(() => setAvisoNome(0), 2600); return () => clearTimeout(t); }, [avisoNome]);
  const [saving, setSaving] = useState(false);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_DEFAULT);
  const [verOutras, setVerOutras] = useState(() => EMB_OUTRAS.includes(form.embalagem_tipo));
  const [usadoEm, setUsadoEm] = useState(0);

  const galleryRef = useRef<HTMLInputElement>(null);

  // Carrega categorias customizadas do usuário
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.from("insumo_categorias").select("nome").or(`is_default.eq.true,user_id.eq.${userId}`).order("nome");
      if (!cancel && data && data.length > 0) {
        // 4.29: "Limpeza" saiu da lista (só aparece se o ingrediente já estiver nela)
        setCategorias([...new Set([...CATEGORIAS_DEFAULT, ...data.map((c: any) => c.nome)])]
          .filter(c => c.trim().toLowerCase() !== "limpeza" || c === inicial.current.categoria));
      }
    })();
    return () => { cancel = true; };
  }, [userId]);

  // Em quantas fichas técnicas o ingrediente está (só na edição, pra mostrar no resumo do custo)
  useEffect(() => {
    if (!editing?.id) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase.from("produto_insumos").select("produto_id").eq("insumo_id", editing.id);
      if (!cancel && data) setUsadoEm(new Set(data.map((r: any) => r.produto_id)).size);
    })();
    return () => { cancel = true; };
  }, [editing?.id]);

  const handleBuscarImagem = async (nome = form.nome, marca = form.marca) => {
    const termo = `${nome} ${marca}`.trim();
    // 4.29: sem nome, aviso no meio da tela e o cursor vai pro campo Nome
    if (nome.trim().length < 3) { setAvisoNome(Date.now()); nomeRef.current?.focus(); return; }
    setBuscandoImg(true);
    setImagens([]);
    try {
      const res = await apiFetch(`/api/buscar-imagem?q=${encodeURIComponent(termo)}`);
      const data = await res.json();
      if (data.images?.length) setImagens(data.images.slice(0, 3));
      else avisar("Não achamos foto pra esse nome. Tente escolher do celular.", { tipo: "info" });
    } catch (e) {
      console.error(e);
      avisar("Não deu pra buscar agora. Confira a internet e tente de novo.", { tipo: "erro" });
    }
    setBuscandoImg(false);
  };

  const handleUploadFile = async (file: File) => {
    if (!file || !userId) return;
    setUploadingImg(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `insumos/${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (error) {
      avisar("Não deu pra enviar a foto. Tente de novo.", { tipo: "erro" });
      console.error(error);
    } else {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      setForm(f => ({ ...f, imagem_url: data.publicUrl }));
      setImagens([]); // limpa resultados de busca se havia
    }
    setUploadingImg(false);
  };
  const recorte = useRecorte(f => { void handleUploadFile(f); }, { forma: "rect" });

  const valorNum = parseNumBR(form.valor_compra);
  // 10/10: em g, kg, ml e L "quanto vem" é obrigatório (vazio virava 1 e o custo saía por 1 g).
  // Em unidade, vazio continua valendo 1.
  const precisaQtd = form.unidade !== "un";
  const qtdDigitada = parseNumBR(form.qtd_embalagem);
  const qtdNum = qtdDigitada > 0 ? qtdDigitada : (precisaQtd ? 0 : 1);
  const erroNome = tentouSalvar && !form.nome.trim() ? "Falta o nome" : undefined;
  const erroValor = tentouSalvar && valorNum <= 0 ? "Falta o preço" : undefined;
  const erroQtd = tentouSalvar && qtdNum <= 0 ? "Falta quanto vem" : undefined;

  const handleSalvar = async () => {
    setTentouSalvar(true);
    if (!userId || !form.nome.trim()) return;
    const valor = valorNum;
    const qtdEmb = qtdNum;
    if (valor <= 0 || qtdEmb <= 0) return; // o que falta aparece embaixo de cada campo
    const custoUnit = valor / qtdEmb;

    setSaving(true);
    const payload: any = {
      nome: form.nome.trim(),
      marca: form.marca.trim(),
      categoria: form.categoria,
      unidade: form.unidade,
      embalagem_tipo: form.embalagem_tipo,
      valor_compra: valor,
      qtd_embalagem: qtdEmb,
      custo_unitario: custoUnit,
      imagem_url: form.imagem_url || "",
      updated_at: new Date().toISOString(),
    };

    let data: any, error: any;
    if (isEditing && editing) {
      ({ data, error } = await supabase.from("insumos").update(payload).eq("id", editing.id).select().single());
    } else {
      payload.user_id = userId;
      payload.quantidade_estoque = 0;
      payload.estoque_minimo = 0;
      ({ data, error } = await supabase.from("insumos").insert(payload).select().single());
    }
    setSaving(false);

    if (error || !data) { avisar("Não deu pra salvar. Confira a internet e tente de novo.", { tipo: "erro" }); console.error(error); return; }
    onSaved({
      id: data.id,
      nome: data.nome,
      marca: data.marca,
      categoria: data.categoria,
      unidade: data.unidade,
      embalagem_tipo: data.embalagem_tipo,
      custo_unitario: data.custo_unitario,
      imagem_url: data.imagem_url,
      valor_compra: data.valor_compra,
      qtd_embalagem: data.qtd_embalagem,
    });
  };

  // Fechar sem salvar: pergunta antes se a pessoa já mexeu em algo
  const pedirFechar = async () => {
    if (saving) return;
    if (mudou) {
      const ok = await confirmar({
        titulo: isEditing ? "Sair sem salvar?" : "Descartar o cadastro?",
        texto: isEditing ? "As mudanças que você fez neste ingrediente vão se perder." : "O que você preencheu vai se perder.",
        rotulo: isEditing ? "Sair sem salvar" : "Descartar", rotuloVoltar: "Voltar", perigo: true, icone: "alerta",
      });
      if (!ok) return;
    }
    onCancel();
  };

  const custo = valorNum > 0 && qtdNum > 0 ? custoNaReceita(valorNum / qtdNum, form.unidade, qtdNum) : null;
  const medidaTxt = form.unidade === "un" ? "un" : form.unidade;
  const emb = form.embalagem_tipo;
  const rotuloQtd = emb === "Avulso" ? "Quanto vem" : `Quanto vem ${EMB_FEMININAS.includes(emb) ? "na" : "no"} ${emb.toLowerCase()}`;
  const mostraAlerta = alertaIncoerencia && alertaDispensado !== alertaIncoerencia;
  const sugerida = !unidadeTocadaManualmente && form.nome.trim().length >= 3;

  const corpo = (
    <div className="cl9-f ig-f">
      {/* Foto (opcional) */}
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={recorte.escolher} />
      {recorte.janela}
      <div className="ig-foto2">
        <span className="ig-foto2-th">{form.imagem_url ? <img src={form.imagem_url} alt="" /> : <Camera size={26} />}</span>
        <div className="ig-foto2-tx">
          <b>Foto <small>essencial</small></b>
          <div className="ig-foto2-bts">
            <button type="button" className="ig-bt-net" disabled={buscandoImg || uploadingImg} onClick={() => handleBuscarImagem()}>
              {buscandoImg ? <span className="ig-gira" aria-hidden="true" /> : <MagnifyingGlass size={18} weight="bold" />}
              {buscandoImg ? "Buscando..." : "Buscar com Doo IA"}
            </button>
            <button type="button" className="ig-bt-cel" disabled={buscandoImg || uploadingImg} onClick={() => galleryRef.current?.click()}>
              {uploadingImg ? <span className="ig-gira" aria-hidden="true" /> : <ImagemIc size={18} weight="bold" />}
              Do celular
            </button>
          </div>
        </div>
      </div>
      {(imagens.length > 0 || form.imagem_url) && (
        <div className="ig-foto">
          {imagens.length > 0 && (<>
            <p className="ig-rot">Toque na foto que combina</p>
            <div className="ig-foto-grade">
              {imagens.map((url, idx) => (
                <button key={idx} type="button" aria-pressed={form.imagem_url === url} aria-label={`Usar a foto ${idx + 1}`}
                  onClick={() => setForm(f => ({ ...f, imagem_url: f.imagem_url === url ? "" : url }))}>
                  <img src={url} alt="" />
                </button>
              ))}
            </div>
          </>)}
          {form.imagem_url && (
            <button type="button" className="ig-foto-tirar" onClick={() => { setForm(f => ({ ...f, imagem_url: "" })); setImagens([]); }}>
              <X size={16} weight="bold" />Tirar a foto
            </button>
          )}
        </div>
      )}
      {avisoNome > 0 && createPortal(
        <div key={avisoNome} className="ig-aviso-meio" role="status">
          <MagnifyingGlass size={28} weight="bold" />
          <b>Escreva o nome primeiro</b>
          <span>A Doo IA usa o nome e a marca pra achar a foto certa.</span>
        </div>, document.body)}

      <Campo ref={nomeRef} rotulo="Nome" obrigatorio placeholder="Ex.: leite condensado" value={form.nome} erro={erroNome}
        onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
      <Campo rotulo="Marca" opcional placeholder="Ex.: Moça" value={form.marca}
        onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} />
      <div>
        <p className="ig-rot">Categoria</p>
        <div className="ig-chips ig-chips-cat">
          {categorias.map(c => (
            <button key={c} type="button" aria-pressed={form.categoria === c} onClick={() => setForm(f => ({ ...f, categoria: c }))}>{rotuloCategoria(c)}</button>
          ))}
        </div>
      </div>

      <section className="ig-compra">
      <div className="ig-compra-cab">
        <b>Como você compra</b>
        <small>Pra calcular quanto custa na receita</small>
      </div>
      <div>
        <p className="ig-rot">Vem em</p>
        <div className="ig-chips">
          {EMB_PRINCIPAIS.map(o => (
            <button key={o} type="button" aria-pressed={emb === o} onClick={() => { setVerOutras(false); setForm(f => ({ ...f, embalagem_tipo: o })); }}>{o}</button>
          ))}
          <button type="button" aria-pressed={EMB_OUTRAS.includes(emb)} aria-expanded={verOutras || EMB_OUTRAS.includes(emb)} onClick={() => setVerOutras(v => !v)}>Outra</button>
        </div>
        {(verOutras || EMB_OUTRAS.includes(emb)) && (
          <div className="ig-chips ig-outras">
            {EMB_OUTRAS.map(o => (
              <button key={o} type="button" aria-pressed={emb === o} onClick={() => setForm(f => ({ ...f, embalagem_tipo: o }))}>{o}</button>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="ig-rot">Medida</p>
        <div className="ig-seg" role="radiogroup" aria-label="Medida">
          {MEDIDAS.map(u => (
            <button key={u.sigla} type="button" role="radio" aria-checked={form.unidade === u.sigla}
              onClick={() => { setUnidadeTocadaManualmente(true); setForm(f => ({ ...f, unidade: u.sigla })); }}>{u.nome}</button>
          ))}
        </div>
        {sugerida && <p className="ig-sug">Escolhida pelo nome. Escolha outra se for diferente.</p>}
      </div>

      {mostraAlerta && (
        <div className="ig-alerta" role="status">
          <WarningCircle size={22} weight="bold" />
          <div>
            <p>{alertaIncoerencia}</p>
            <div className="ig-alerta-bts">
              <button type="button" className="on" onClick={() => {
                setUnidadeTocadaManualmente(false);
                const sugestao = sugerirUnidade(form.nome, form.embalagem_tipo);
                setForm(f => ({ ...f, unidade: sugestao }));
              }}>Trocar</button>
              <button type="button" onClick={() => { setUnidadeTocadaManualmente(true); setAlertaDispensado(alertaIncoerencia); }}>Deixar assim</button>
            </div>
          </div>
        </div>
      )}

      <div className="cl9-f-2">
        <Campo rotulo={rotuloQtd} inputMode="decimal" placeholder={precisaQtd ? "Ex.: 395" : "1"} value={form.qtd_embalagem} erro={erroQtd}
          onChange={e => setForm(f => ({ ...f, qtd_embalagem: e.target.value }))}
          depois={<span className="cl9-f-uf">{medidaTxt}</span>} />
        <Campo rotulo="Quanto pagou" inputMode="numeric" prefixo="R$" placeholder="0,00" value={form.valor_compra} erro={erroValor}
          onChange={e => { const d = e.target.value.replace(/\D/g, ""); setForm(f => ({ ...f, valor_compra: d ? reais(parseInt(d, 10) / 100) : "" })) }} />
      </div>

      {custo ? (
        <div className="ig-custo" aria-live="polite">
          <span>Custo na receita</span>
          <b>{formatarCusto(custo.valor)} {custo.por}</b>
          <small>
            R$ {valorNum.toFixed(2).replace(".", ",")} ÷ {numBR(qtdNum)} {medidaTxt}
            {usadoEm > 0 ? ` · usado em ${usadoEm} ${usadoEm === 1 ? "ficha técnica" : "fichas técnicas"}` : ""}
          </small>
        </div>
      ) : (
        <p className="ig-dica">Coloque quanto vem e quanto pagou: o Doonly calcula o custo de cada {form.unidade === "un" ? "unidade" : "grama"} pra ficha técnica.</p>
      )}
      </section>

      {isEditing && onDelete && (
        <button type="button" className="cl9-f-excluir" onClick={onDelete} disabled={saving}><Trash size={20} weight="bold" />Excluir ingrediente</button>
      )}
    </div>
  );

  const rotuloSalvar = isEditing ? "Salvar" : "Cadastrar";

  if (janela) {
    return (
      <Janela aberta={aberta} aoFechar={pedirFechar} tipo="conteudo" titulo={isEditing ? "Editar ingrediente" : "Novo ingrediente"} travada={mudou}
        acoes={<><Botao variante="secundario" onClick={pedirFechar}>Cancelar</Botao><Botao carregando={saving} onClick={handleSalvar}>{rotuloSalvar}</Botao></>}>
        {corpo}
      </Janela>
    );
  }

  // Dentro da janela de quem chamou (ficha técnica / produto)
  return (
    <div className="ig-emb">
      <div className="ig-emb-cab">
        <Titulo nivel="janela">{isEditing ? "Editar ingrediente" : "Novo ingrediente"}</Titulo>
        <BotaoIcone rotulo="Fechar" variante="limpo" onClick={pedirFechar}><X size={20} weight="bold" /></BotaoIcone>
      </div>
      {corpo}
      <Botao cheio carregando={saving} onClick={handleSalvar}>{isEditing ? "Salvar" : "Cadastrar ingrediente"}</Botao>
    </div>
  );
}

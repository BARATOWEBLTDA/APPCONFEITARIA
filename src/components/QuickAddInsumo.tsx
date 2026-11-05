import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRecorte } from "@/components/ui/useRecorte";
import { Camera, CaretDown, Check, Image as ImagemIc, MagnifyingGlass, Package, Sparkle, Trash, WarningCircle, X } from "@phosphor-icons/react";
import { parseNumBR } from "@/lib/numeroBR";
import { CATEGORIAS_INSUMO, categoriaPeloNome, normalizarCategoria } from "@/lib/categoriasInsumo";
import SelectDoonly from "@/components/base/SelectDoonly";

// 13/10: "Quanto pagou" igual aos outros campos de dinheiro: digita 749 e aparece 7,49
const reais = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
import { supabase } from "@/lib/supabase";
import type { PostgrestError } from "@supabase/supabase-js";
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
  /** (6.31) quantas unidades vêm dentro (caixa com 27 latas); qtd_embalagem é o total */
  itens_embalagem?: number | null;
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
  /** (6.31) "vem várias dentro": quantas vêm e quanto tem cada uma (opcional) */
  varias: boolean;
  itens: string;
  cada_qtd: string;
  cada_un: string;
};

/** (04/11 · 6.20) os ingredientes mais comuns, já com a embalagem: escolher preenche a medida e quanto vem */
const COMUNS: { nome: string; unidade: string; qtd: string; cat?: string }[] = [
  { nome: "Leite condensado", unidade: "g", qtd: "395" }, { nome: "Creme de leite", unidade: "g", qtd: "200" },
  { nome: "Farinha de trigo", unidade: "kg", qtd: "1" }, { nome: "Açúcar refinado", unidade: "kg", qtd: "1" },
  { nome: "Açúcar de confeiteiro", unidade: "g", qtd: "500" }, { nome: "Chocolate em pó", unidade: "g", qtd: "200" },
  { nome: "Cacau em pó", unidade: "g", qtd: "200" }, { nome: "Chocolate nobre ao leite", unidade: "kg", qtd: "1" },
  { nome: "Chocolate meio amargo", unidade: "kg", qtd: "1" }, { nome: "Granulado", unidade: "g", qtd: "500" },
  { nome: "Manteiga", unidade: "g", qtd: "200" }, { nome: "Margarina", unidade: "g", qtd: "500" },
  { nome: "Ovos", unidade: "un", qtd: "12" }, { nome: "Leite integral", unidade: "L", qtd: "1" },
  { nome: "Leite em pó", unidade: "g", qtd: "400" }, { nome: "Fermento em pó", unidade: "g", qtd: "100" },
  { nome: "Óleo", unidade: "ml", qtd: "900" }, { nome: "Coco ralado", unidade: "g", qtd: "100" },
  { nome: "Morango", unidade: "g", qtd: "250" }, { nome: "Doce de leite", unidade: "g", qtd: "400" },
  { nome: "Nutella", unidade: "g", qtd: "350" }, { nome: "Chantilly", unidade: "L", qtd: "1" },
  { nome: "Caixa para bolo", unidade: "un", qtd: "1", cat: "Embalagens" }, { nome: "Forminha de papel", unidade: "un", qtd: "100", cat: "Embalagens" },
  { nome: "Fita de cetim", unidade: "un", qtd: "1", cat: "Embalagens" }, { nome: "Pote de plástico", unidade: "un", qtd: "1", cat: "Embalagens" },
];
const semAc = (t: string) => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/** Medidas (mesmos valores de antes: un, kg, g, L, ml) · (6.31) + metro (fita, renda: a receita usa em cm) */
const MEDIDAS = [
  { sigla: "g", nome: "g", sub: "gramas" },
  { sigla: "kg", nome: "kg", sub: "quilos" },
  { sigla: "ml", nome: "ml", sub: "mililitros" },
  { sigla: "L", nome: "L", sub: "litros" },
  { sigla: "un", nome: "unidade", sub: "conta por unidade" },
  { sigla: "m", nome: "metro", sub: "fita, renda (a receita usa em cm)" },
];
/** (27/10) g e kg pesam, ml e L medem volume, unidade conta: dentro da mesma família a ficha técnica converte sozinha */
const familiaDaMedida = (u?: string | null) => (u === "g" || u === "kg" ? "peso" : u === "ml" || u === "L" || u === "l" ? "volume" : u === "m" || u === "cm" ? "comprimento" : "un");
const nomeMedida = (u: string) => MEDIDAS.find(m => m.sigla === u)?.nome || u;

/** Embalagens (mesmos valores salvos de antes). As mais usadas aparecem direto; o resto fica em "Outra". */
const EMB_PRINCIPAIS = ["Avulso", "Pacote", "Caixa", "Lata", "Pote", "Garrafa", "Bandeja", "Fardo"];
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
  if (unidadeBase === "m") return { valor: custoBase, por: "o metro" };
  if (unidadeBase !== "g" && unidadeBase !== "ml") return { valor: custoBase, por: "cada" };
  const escala = totalBase >= 1000 ? 100 : totalBase >= 100 ? 10 : 1;
  return { valor: custoBase * escala, por: escala === 1 ? `por ${unidadeBase}` : `a cada ${escala} ${unidadeBase}` };
}

/** "lata de 395 g" · "bandeja com 30 un" · "1 kg" (avulso) */
export function descreverCompra(embalagem: string, qtd: number, unidade: string, itens?: number | null) {
  // (6.31) com várias dentro: "caixa com 27 × 395 g" · "caixa com 12"
  const k = Number(itens) || 0;
  if (k > 1) {
    const e = !embalagem || embalagem === "Avulso" ? "embalagem" : embalagem.toLowerCase();
    return unidade === "un" ? `${e} com ${k}` : `${e} com ${k} ×\u00a0${numBR((qtd || 0) / k)}\u00a0${unidade}`;
  }
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
export default function QuickAddInsumo({ userId, initialName, editing, onSaved, onCancel, onDelete, janela = false, aberta = true, onSalvoOutro }: Props & { onSalvoOutro?: () => void }) {
  const isEditing = !!editing;

  const [form, setForm] = useState<Form>(() => {
    if (editing) {
      return {
        nome: editing.nome || "",
        marca: editing.marca || "",
        categoria: normalizarCategoria(editing.categoria, editing.nome),
        unidade: editing.unidade || "g",
        embalagem_tipo: editing.embalagem_tipo || "Avulso",
        valor_compra: editing.valor_compra ? reais(Number(editing.valor_compra)) : "",
        qtd_embalagem: editing.qtd_embalagem ? String(editing.qtd_embalagem).replace(".", ",") : "1",
        imagem_url: editing.imagem_url || "",
        ...(() => {
          const n = Number(editing.itens_embalagem) || 0;
          if (n <= 1) return { varias: false, itens: "", cada_qtd: "", cada_un: "g" };
          const porUm = editing.unidade === "un" ? 0 : (Number(editing.qtd_embalagem) || 0) / n;
          return { varias: true, itens: String(n), cada_qtd: porUm ? numBR(porUm) : "", cada_un: editing.unidade === "un" ? "g" : editing.unidade };
        })(),
      };
    }
    return {
      nome: initialName || "",
      marca: "",
      categoria: categoriaPeloNome(initialName || "") || "",
      unidade: "g",
      embalagem_tipo: "Avulso",
      valor_compra: "",
      qtd_embalagem: "",
      imagem_url: "",
      varias: false, itens: "", cada_qtd: "", cada_un: "g",
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
  const categorias: readonly string[] = CATEGORIAS_INSUMO;
  // (6.31) a categoria vem do nome enquanto ela não escolhe na mão
  const [catTocada, setCatTocada] = useState(isEditing);
  useEffect(() => {
    if (catTocada) return;
    const c = categoriaPeloNome(form.nome) || "";
    if (c !== form.categoria) setForm(f => ({ ...f, categoria: c }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.nome, catTocada]);
  const [medMenu, setMedMenu] = useState<"" | "qtd" | "cada">("");
  const medRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!medMenu) return;
    const fechar = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setMedMenu(""); } };
    const rolou = () => setMedMenu("");
    document.addEventListener("keydown", fechar, true); window.addEventListener("resize", rolou);
    return () => { document.removeEventListener("keydown", fechar, true); window.removeEventListener("resize", rolou); };
  }, [medMenu]);
  const [verOutras, setVerOutras] = useState(() => EMB_OUTRAS.includes(form.embalagem_tipo));
  const [fotoMenu, setFotoMenu] = useState(false); // (04/11) tocar na foto abre: IA, câmera ou galeria
  const cameraRef = useRef<HTMLInputElement>(null);
  const outroRef = useRef(false); // (04/11) "Cadastrar e adicionar outro" (ref: o salvar lê na hora)
  const [usadoEm, setUsadoEm] = useState(0);

  const galleryRef = useRef<HTMLInputElement>(null);

  // Em quantas fichas técnicas o ingrediente está (só na edição, pra mostrar no resumo do custo)
  useEffect(() => {
    if (!editing?.id) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase.from("produto_insumos").select("produto_id").eq("insumo_id", editing.id);
      if (!cancel && data) setUsadoEm(new Set(data.map((r: { produto_id: string }) => r.produto_id)).size);
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
      else avisar("Não achamos foto para esse nome. Tente escolher do celular.", { tipo: "info" });
    } catch (e) {
      console.error(e);
      avisar("Não deu para buscar agora. Confira a internet e tente de novo.", { tipo: "erro" });
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
      avisar("Não deu para enviar a foto. Tente de novo.", { tipo: "erro" });
      console.error(error);
    } else {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      setForm(f => ({ ...f, imagem_url: data.publicUrl }));
      setImagens([]); // limpa resultados de busca se havia
    }
    setUploadingImg(false);
  };
  const recorte = useRecorte(f => { void handleUploadFile(f); }, { forma: "rect", titulo: "Ajustar a foto do ingrediente" });

  const valorNum = parseNumBR(form.valor_compra);
  // 10/10: em g, kg, ml e L "quanto vem" é obrigatório (vazio virava 1 e o custo saía por 1 g).
  // Em unidade, vazio continua valendo 1.
  const precisaQtd = form.unidade !== "un";
  const qtdDigitada = parseNumBR(form.qtd_embalagem);
  // (6.31) "vem várias dentro": 27 latas × 395 g = 10.665 g (sem o peso de cada, conta por unidade)
  const nItens = Math.round(parseNumBR(form.itens));
  const cadaNum = parseNumBR(form.cada_qtd);
  const unEfetiva = form.varias ? (cadaNum > 0 ? form.cada_un : "un") : form.unidade;
  const qtdNum = form.varias ? (nItens > 0 ? (cadaNum > 0 ? nItens * cadaNum : nItens) : 0) : (qtdDigitada > 0 ? qtdDigitada : (precisaQtd ? 0 : 1));
  const erroNome = tentouSalvar && !form.nome.trim() ? "Falta o nome" : undefined;
  const erroValor = tentouSalvar && valorNum <= 0 ? "Falta o preço" : undefined;
  const erroQtd = tentouSalvar && !form.varias && qtdNum <= 0 ? "Falta quanto vem" : undefined;
  const erroItens = tentouSalvar && form.varias && nItens <= 0 ? "Falta quantas vêm" : undefined;
  const erroCat = tentouSalvar && !form.categoria ? "Escolha a categoria" : undefined;

  const handleSalvar = async () => {
    setTentouSalvar(true);
    if (!userId || !form.nome.trim() || !form.categoria) return;
    const valor = valorNum;
    const qtdEmb = qtdNum;
    if (valor <= 0 || qtdEmb <= 0) return; // o que falta aparece embaixo de cada campo
    const custoUnit = valor / qtdEmb;

    setSaving(true);
    // (27/10) confere de novo na hora de salvar: a trava da tela depende de uma leitura que pode não ter chegado
    if (isEditing && editing?.id && familiaDaMedida(unEfetiva) !== familiaDaMedida(editing.unidade)) {
      const { count, error: eUso } = await supabase.from("produto_insumos").select("id", { count: "exact", head: true }).eq("insumo_id", editing.id);
      if (eUso || (count || 0) > 0) {
        setSaving(false);
        avisar(eUso ? "Não deu para conferir. Tente de novo." : "Está em fichas: use medida do mesmo tipo", { tipo: "erro" });
        return;
      }
    }
    const payload: Record<string, unknown> = {
      nome: form.nome.trim(),
      marca: form.marca.trim(),
      categoria: form.categoria,
      unidade: unEfetiva,
      embalagem_tipo: form.embalagem_tipo,
      valor_compra: valor,
      qtd_embalagem: qtdEmb,
      itens_embalagem: form.varias && nItens > 1 ? nItens : null,
      custo_unitario: custoUnit,
      imagem_url: form.imagem_url || "",
      updated_at: new Date().toISOString(),
    };

    let data: InsumoQuick | null, error: PostgrestError | null;
    if (isEditing && editing) {
      ({ data, error } = await supabase.from("insumos").update(payload).eq("id", editing.id).select().single());
    } else {
      payload.user_id = userId;
      payload.quantidade_estoque = 0;
      payload.estoque_minimo = 0;
      ({ data, error } = await supabase.from("insumos").insert(payload).select().single());
    }
    setSaving(false);

    if (error || !data) { avisar("Não deu para salvar. Confira a internet e tente de novo.", { tipo: "erro" }); console.error(error); return; }
    if (outroRef.current && !isEditing) {
      // (04/11 · 6.20) continua aberto e limpo pra cadastrar o próximo
      outroRef.current = false; setTentouSalvar(false); setImagens([]); setUnidadeTocadaManualmente(false);
      setCatTocada(false);
      setForm(f => ({ ...f, nome: "", marca: "", categoria: "", valor_compra: "", qtd_embalagem: "", imagem_url: "", varias: false, itens: "", cada_qtd: "" }));
      avisar(`${data.nome} cadastrado. Agora o próximo.`, { tipo: "ok" });
      window.setTimeout(() => nomeRef.current?.focus(), 50);
      onSalvoOutro?.();
      return;
    }
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
      itens_embalagem: data.itens_embalagem,
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

  const custo = valorNum > 0 && qtdNum > 0 ? custoNaReceita(valorNum / qtdNum, unEfetiva, qtdNum) : null;
  const medidaTxt = unEfetiva === "un" ? "un" : unEfetiva;
  const emb = form.embalagem_tipo;
  // (6.161) deixa claro que é a COMPRA (a quantidade da receita vai na ficha técnica)
  const rotuloQtd = emb === "Avulso" ? "Quanto vem na embalagem" : `Quanto vem ${EMB_FEMININAS.some(f => f.toLowerCase() === String(emb || "").toLowerCase()) ? "na" : "no"} ${String(emb || "").toLowerCase()}`;
  const mostraAlerta = alertaIncoerencia && alertaDispensado !== alertaIncoerencia;
  const travaFamilia = isEditing && usadoEm > 0;
  const nomeEmb = emb && emb !== "Avulso" ? emb.toLowerCase() : "embalagem";

  /** (6.31) a medida num menu do app (antes era a lista do sistema, que no Windows abria torta).
   *  O menu sai por cima de tudo (portal), pra janela não cortar; abre pra cima quando falta espaço embaixo. */
  const Medida = ({ valor, qual, aoEscolher }: { valor: string; qual: "qtd" | "cada"; aoEscolher: (u: string) => void }) => {
    const aberto = medMenu === qual;
    const opcoes = MEDIDAS.filter(u => qual === "qtd" || u.sigla !== "un");
    const comPack = qual === "qtd"; // (6.161) "Caixa ou pack" abre o "vem várias dentro"
    const pos = (() => {
      if (!aberto || !medRef.current) return null;
      const r = medRef.current.getBoundingClientRect(), alt = (opcoes.length + (comPack ? 1 : 0)) * 50 + 10, larg = 260;
      const left = Math.max(8, Math.min(window.innerWidth - larg - 8, r.right - larg));
      return window.innerHeight - r.bottom > alt + 16 ? { top: r.bottom + 8, left } : { top: Math.max(8, r.top - alt - 8), left };
    })();
    return (
      <span className="ig-med-w">
        <button ref={aberto ? medRef : undefined} type="button" className="ig-med" aria-haspopup="menu" aria-expanded={aberto}
          onClick={e => { medRef.current = e.currentTarget; setMedMenu(m => (m === qual ? "" : qual)); }}>
          {nomeMedida(valor)}<CaretDown size={14} weight="bold" aria-hidden="true" />
        </button>
        {aberto && pos && createPortal(<>
          <span className="ui-menu-veu ig-med-veu" aria-hidden="true" onClick={() => setMedMenu("")} />
          <span className="ig-med-menu" role="menu" style={{ top: pos.top, left: pos.left }}>
            {opcoes.map(u => {
              const travada = travaFamilia && familiaDaMedida(u.sigla) !== familiaDaMedida(inicial.current.unidade);
              return (
                <button key={u.sigla} type="button" role="menuitemradio" aria-checked={valor === u.sigla} disabled={travada}
                  onClick={() => { setMedMenu(""); setUnidadeTocadaManualmente(true); aoEscolher(u.sigla); }}>
                  <span><b>{u.nome}</b><small>{travada ? "Não combina com as fichas em que ele está" : u.sub}</small></span>
                  {valor === u.sigla && <Check size={18} weight="bold" aria-hidden="true" />}
                </button>
              );
            })}
            {comPack && (
              <button type="button" role="menuitem" onClick={() => { setMedMenu(""); setForm(f => ({ ...f, varias: true, cada_un: f.unidade === "un" ? "g" : f.unidade })); }}>
                <span><b>Caixa ou pack</b><small>Vem várias dentro (ex.: 27 latas)</small></span>
              </button>
            )}
          </span>
        </>, document.body)}
      </span>
    );
  };

  const corpo = (
    <div className={`cl9-f ig-f${janela ? " ig-f--janela" : ""}`}>
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={recorte.escolher} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={recorte.escolher} />
      {recorte.janela}
      <div className="ig-col1">
      {/* (6.31) a foto numa caixa grande com "Escolher imagem"; o nome e a marca ao lado */}
      <div className="ig-topo">
        <span className="ig-foto-w">
          <button type="button" className={`ig-foto-cx${form.imagem_url ? " tem" : ""}`} aria-label={form.imagem_url ? "Trocar a foto" : "Escolher imagem"} aria-expanded={fotoMenu} disabled={uploadingImg || buscandoImg} onClick={() => setFotoMenu(v => !v)}>
            {form.imagem_url ? <img src={form.imagem_url} alt="" />
              : uploadingImg || buscandoImg ? <span className="ig-gira" aria-hidden="true" />
              : <><Camera size={30} weight="duotone" /><span>Escolher imagem</span></>}
          </button>
          {fotoMenu && <span className="ui-menu-veu" aria-hidden="true" onClick={() => setFotoMenu(false)} />}
          {fotoMenu && (
            <span className="ig-foto-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setFotoMenu(false); void handleBuscarImagem(); }}><Sparkle size={18} weight="bold" />Achar foto com IA</button>
              <button type="button" role="menuitem" onClick={() => { setFotoMenu(false); cameraRef.current?.click(); }}><Camera size={18} weight="bold" />Tirar foto</button>
              <button type="button" role="menuitem" onClick={() => { setFotoMenu(false); galleryRef.current?.click(); }}><ImagemIc size={18} weight="bold" />Da galeria</button>
              {form.imagem_url && <button type="button" role="menuitem" className="ig-foto-menu-tirar" onClick={() => { setFotoMenu(false); setForm(f => ({ ...f, imagem_url: "" })); setImagens([]); }}><Trash size={18} weight="bold" />Tirar a foto</button>}
            </span>
          )}
        </span>
        <div className="ig-topo-campos">
          <Campo ref={nomeRef} rotulo="Nome" obrigatorio placeholder="Ex.: leite condensado" value={form.nome} erro={erroNome}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          <Campo rotulo="Marca" opcional placeholder="Ex.: Moça" value={form.marca}
            onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} />
        </div>
      </div>
      {!isEditing && (() => {
        const q = semAc(form.nome);
        const lista = q.length >= 2 ? COMUNS.filter(c => semAc(c.nome).includes(q) && semAc(c.nome) !== q).slice(0, 4) : [];
        return lista.length ? (
          <div className="ig-comuns" aria-label="Sugestões">
            {lista.map(c => (
              <button key={c.nome} type="button" onClick={() => { setUnidadeTocadaManualmente(true); setForm(f => ({ ...f, nome: c.nome, unidade: c.unidade, qtd_embalagem: c.qtd, varias: false, ...(c.cat || categoriaPeloNome(c.nome) ? { categoria: c.cat || categoriaPeloNome(c.nome) || "" } : {}) })); }}>
                <b>{c.nome}</b><small>{c.qtd} {c.unidade === "un" ? (c.qtd === "1" ? "unidade" : "unidades") : c.unidade}</small>
              </button>
            ))}
          </div>
        ) : null;
      })()}
      {imagens.length > 0 && (
        <div className="ig-foto">
          <p className="ig-rot">Escolha a foto que combina (toque para usar)</p>
          <div className="ig-foto-grade">
            {imagens.map((url, idx) => (
              <button key={idx} type="button" aria-pressed={form.imagem_url === url} aria-label={`Usar a foto ${idx + 1}`}
                onClick={() => { setForm(f => ({ ...f, imagem_url: url })); setImagens([]); }}>
                <img src={url} alt="" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
        </div>
      )}
      {avisoNome > 0 && createPortal(
        <div key={avisoNome} className="ig-aviso-meio" role="status">
          <MagnifyingGlass size={28} weight="bold" />
          <b>Escreva o nome primeiro</b>
          <span>A Doo IA usa o nome e a marca para achar a foto certa.</span>
        </div>, document.body)}

      <section className="ig-compra ig-compra--simples">
      {travaFamilia && <p className="ig-sug">Está em fichas técnicas: a medida fica {({ peso: "em g ou kg", volume: "em ml ou L", un: "em unidade", comprimento: "em metro" } as Record<string, string>)[familiaDaMedida(inicial.current.unidade)]}.</p>}

      {mostraAlerta && !form.varias && (
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

      {form.varias ? (
        /* (6.31) caixa com várias dentro: quantas vêm × quanto tem cada uma */
        <div className="ig-varias">
          <div className="ig-varias-top">
            <span className="ig-varias-t"><Package size={18} weight="bold" aria-hidden="true" />Vem várias dentro</span>
            <button type="button" className="ig-varias-x" onClick={() => setForm(f => ({ ...f, varias: false, itens: "", cada_qtd: "" }))}>Vem uma só</button>
          </div>
          <div className="cl9-f-2 ig-varias-2">
            <Campo rotulo="Quantas vêm" inputMode="numeric" placeholder="27" value={form.itens} erro={erroItens}
              onChange={e => setForm(f => ({ ...f, itens: e.target.value.replace(/\D/g, "").slice(0, 5) }))} />
            <Campo rotulo="Cada uma tem" opcional inputMode="decimal" placeholder="395" value={form.cada_qtd}
              onChange={e => setForm(f => ({ ...f, cada_qtd: e.target.value }))}
              depois={<Medida valor={form.cada_un} qual="cada" aoEscolher={u => setForm(f => ({ ...f, cada_un: u }))} />} />
          </div>
          <Campo rotulo={(fem => `Quanto pagou ${fem ? "na" : "no"} ${nomeEmb} ${fem ? "toda" : "todo"}`)(nomeEmb === "embalagem" || EMB_FEMININAS.some(f => f.toLowerCase() === nomeEmb))} inputMode="numeric" prefixo="R$" placeholder="0,00" value={form.valor_compra} erro={erroValor}
            onChange={e => { const d = e.target.value.replace(/\D/g, ""); setForm(f => ({ ...f, valor_compra: d ? reais(parseInt(d, 10) / 100) : "" })) }} />
        </div>
      ) : (<>
        <div className="cl9-f-2">
          <Campo rotulo={rotuloQtd} inputMode="decimal" placeholder={precisaQtd ? "395" : "1"} value={form.qtd_embalagem} erro={erroQtd}
            onChange={e => setForm(f => ({ ...f, qtd_embalagem: e.target.value }))}
            depois={<Medida valor={form.unidade} qual="qtd" aoEscolher={u => setForm(f => ({ ...f, unidade: u }))} />} />
          <Campo rotulo={emb === "Avulso" ? "Quanto pagou na embalagem" : `Quanto pagou ${EMB_FEMININAS.some(f => f.toLowerCase() === String(emb || "").toLowerCase()) ? "na" : "no"} ${String(emb || "").toLowerCase()}`} inputMode="numeric" prefixo="R$" placeholder="0,00" value={form.valor_compra} erro={erroValor}
            onChange={e => { const d = e.target.value.replace(/\D/g, ""); setForm(f => ({ ...f, valor_compra: d ? reais(parseInt(d, 10) / 100) : "" })) }} />
        </div>
      </>)}

      {custo ? (
        <div className="ig-custo" aria-live="polite">
          <span>Custo na receita</span>
          <b>{formatarCusto(custo.valor)} {custo.por}</b>
          <small>
            {form.varias && nItens > 1
              ? <>{formatarCusto(valorNum / nItens)} cada · {nItens} × {cadaNum > 0 ? `${numBR(cadaNum)} ${form.cada_un}` : "unidade"}</>
              : <>Você pagou R$ {valorNum.toFixed(2).replace(".", ",")} por {numBR(qtdNum)} {medidaTxt}</>}
            {usadoEm > 0 ? ` · usado em ${usadoEm} ${usadoEm === 1 ? "ficha técnica" : "fichas técnicas"}` : ""}
          </small>
        </div>
      ) : (
        <p className="ig-dica">{form.varias ? "Coloque quantas vêm e quanto pagou: o custo de cada uma aparece aqui." : `Coloque quanto vem e quanto pagou: o custo de cada ${unEfetiva === "un" ? "unidade" : unEfetiva === "ml" || unEfetiva === "L" ? "ml" : unEfetiva === "m" ? "metro" : "grama"} aparece aqui.`}</p>
      )}
      </section>
      </div>

      {/* (6.31) categoria (obrigatória, da lista única) e "Vem em" à vista, sem "Mais detalhes" */}
      <div className="ig-col2">
      <div className="ig-grupo">
        <span className="ui-campo-r"><span>Categoria</span><small className="obr">obrigatório</small></span>
        {/* (6.161) um seletor, igual ao da categoria no cadastro de produto (antes um monte de botões) */}
        <SelectDoonly value={form.categoria || ""} title="Escolha a categoria" placeholder="Escolha a categoria…"
          options={categorias.map(c => ({ value: c, label: c }))}
          onChange={c => { setCatTocada(true); setForm(f => ({ ...f, categoria: c })); }} />
        {erroCat && <p className="ui-campo-msg" role="alert"><WarningCircle size={14} weight="bold" aria-hidden="true" /><span>{erroCat}</span></p>}
      </div>

      <div className="ig-grupo">
        <span className="ui-campo-r"><span>Vem em</span><small>opcional</small></span>
        <SelectDoonly value={emb || "Avulso"} title="Como vem" placeholder="Avulso"
          options={[...EMB_PRINCIPAIS, ...EMB_OUTRAS].map(o => ({ value: o, label: o }))}
          onChange={o => { setVerOutras(false); setForm(f => ({ ...f, embalagem_tipo: o })); }} />
      </div>

      {isEditing && onDelete && (
        <button type="button" className="ig-excluir" onClick={onDelete} disabled={saving}><Trash size={18} weight="bold" />Excluir ingrediente</button>
      )}
      {janela && !isEditing && <button type="button" className="ig-outro" disabled={saving} onClick={() => { outroRef.current = true; void handleSalvar(); }}>Cadastrar e adicionar outro</button>}
      </div>
    </div>
  );

  const rotuloSalvar = isEditing ? "Salvar" : "Cadastrar";

  if (janela) {
    return (
      <Janela aberta={aberta} aoFechar={pedirFechar} tipo="conteudo" titulo={isEditing ? "Editar ingrediente" : "Novo ingrediente"} travada={mudou} className="ig-janela-cheia"
        acoes={<><Botao variante="secundario" onClick={pedirFechar}>Cancelar</Botao><Botao carregando={saving} onClick={() => { outroRef.current = false; void handleSalvar(); }}>{rotuloSalvar}</Botao></>}>
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

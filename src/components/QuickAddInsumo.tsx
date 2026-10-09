import { useState, useEffect, useRef } from "react";
import { Camera, Image as ImagemIc, MagnifyingGlass, Trash, WarningCircle, X } from "@phosphor-icons/react";
import { parseNumBR } from "@/lib/numeroBR";
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

const CATEGORIAS_DEFAULT = ["Ingredientes", "Embalagens", "Decorações", "Bebidas", "Limpeza", "Descartáveis", "Outros"];

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

/** Heurística pra sugerir unidade de medida com base no nome + embalagem.
 *  Nível 2 (nome) tem prioridade sobre Nível 1 (embalagem) porque o nome
 *  é informação mais específica. */
function sugerirUnidade(nome: string, embalagem: string): string {
  const n = nome.toLowerCase();

  // ─── Nível 2 — palavras-chave no nome ───
  // Itens contáveis
  if (/\b(ovos?|morangos?|limões?|limao|laranjas?|bananas?|maçãs?|macas?|abacaxis?|kiwis?|peras?|coco|cocos)\b/.test(n)) return "un";
  if (/\b(bombons?|biscoitos?|wafers?|paçocas?|pacocas?|amendoim japon[eê]s)\b/.test(n)) return "un";

  // Sólidos pesáveis (kg)
  if (/\b(farinhas?|açúcares?|acucar(es)?|sal|sais|polvilhos?|amidos?)\b/.test(n)) return "kg";

  // Sólidos em quantidade menor (g)
  if (/\b(leite condensado|creme de leite|doce de leite|nutella|cacau|chocolates?|cobertura|gotas? de chocolate|granulados?|confeitos?|corante)\b/.test(n)) return "g";
  if (/\b(manteiga|margarina|cream cheese|queijos?|requeij[aã]o|fermento|essências?|essencia)\b/.test(n)) return "g";

  // Líquidos (ml)
  if (/\b(leites?|sucos?|águas?|aguas?|óleos?|oleos?|leite de coco|leite vegetal|aroma|álcool|alcool)\b/.test(n)) return "ml";

  // ─── Nível 1 — pela embalagem ───
  switch (embalagem) {
    case "Pacote":   return "kg";
    case "Caixa":    return "kg";
    case "Lata":     return "g";
    case "Pote":     return "g";
    case "Garrafa":  return "ml";
    case "Frasco":   return "ml";
    case "Bandeja":  return "un";
    case "Bisnaga":  return "g";
    case "Sachê":    return "g";
    case "Envelope": return "g";
    case "Balde":    return "kg";
    case "Rolo":     return "un";
    default:         return "g";
  }
}

/** Detecta se a combinação nome × unidade parece um cadastro incoerente.
 *  Retorna mensagem de alerta (string) ou null se estiver tudo certo. */
function detectarInconsistencia(nome: string, unidade: string): string | null {
  if (!nome || nome.trim().length < 3) return null;
  const n = nome.toLowerCase();

  // Produto sólido pesável cadastrado como "un"
  if (unidade === "un") {
    if (/\b(farinhas?|açúcares?|acucar(es)?|sal|sais|polvilhos?|amidos?|cacau)\b/.test(n))
      return `${nome.trim()} geralmente é medido em quilos (kg) ou gramas (g), não em unidades. Quer trocar?`;
    if (/\b(leites?(?! em p[oó])|sucos?|águas?|aguas?|óleos?|oleos?|essências?|essencia)\b/.test(n))
      return `${nome.trim()} geralmente é medido em mililitros (ml) ou litros (L), não em unidades. Quer trocar?`;
    if (/\b(manteiga|margarina|cream cheese|chocolates? em barra|cobertura|leite condensado|creme de leite)\b/.test(n))
      return `${nome.trim()} geralmente é medido em gramas (g), não em unidades. Quer trocar?`;
  }

  // Produto contável cadastrado como medida de peso/volume
  if (unidade === "kg" || unidade === "g" || unidade === "ml" || unidade === "L") {
    if (/\b(ovos?)\b/.test(n))
      return `Ovo geralmente é medido em unidades, não em ${unidade}. Quer trocar?`;
  }

  return null;
}

/* ───────── Ajudantes de exibição (também usados na lista de Ingredientes) ───────── */

const numBR = (v: number) => (Math.round(v * 1000) / 1000).toString().replace(".", ",");

/** "R$ 0,19" com mais casas só quando o valor é muito pequeno (a granel) */
export function formatarCusto(v: number) {
  const casas = v >= 0.1 ? 2 : v >= 0.01 ? 3 : 4;
  return `R$ ${v.toFixed(casas).replace(".", ",")}`;
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
  const q = `${numBR(n)} ${u}`;
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
        valor_compra: editing.valor_compra ? String(editing.valor_compra).replace(".", ",") : "",
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
  const [fotoAberta, setFotoAberta] = useState(false);
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
        setCategorias([...new Set([...CATEGORIAS_DEFAULT, ...data.map((c: any) => c.nome)])]);
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

  const handleBuscarImagem = async () => {
    const termo = `${form.nome} ${form.marca}`.trim();
    if (form.nome.trim().length < 3) { avisar("Escreva o nome primeiro pra buscar a foto", { tipo: "info" }); return; }
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

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
      setFotoAberta(false);
    }
    setUploadingImg(false);
    e.target.value = ""; // reseta input pra permitir mesmo arquivo de novo
  };

  const valorNum = parseNumBR(form.valor_compra);
  const qtdNum = parseNumBR(form.qtd_embalagem) || 1;
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

  const custo = valorNum > 0 ? custoNaReceita(valorNum / qtdNum, form.unidade, qtdNum) : null;
  const medidaTxt = form.unidade === "un" ? "un" : form.unidade;
  const emb = form.embalagem_tipo;
  const rotuloQtd = emb === "Avulso" ? "Quanto vem" : `Quanto vem ${EMB_FEMININAS.includes(emb) ? "na" : "no"} ${emb.toLowerCase()}`;
  const mostraAlerta = alertaIncoerencia && alertaDispensado !== alertaIncoerencia;
  const sugerida = !unidadeTocadaManualmente && form.nome.trim().length >= 3;

  const corpo = (
    <div className="cl9-f ig-f">
      {/* Foto (opcional) */}
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={handleUploadFile} />
      <button type="button" className="cl9-f-foto" onClick={() => setFotoAberta(a => !a)} aria-expanded={fotoAberta}>
        <span className="cl9-f-av ig-f-av">{form.imagem_url ? <img src={form.imagem_url} alt="" /> : <Camera size={24} weight="bold" />}</span>
        <span>
          <b>{form.imagem_url ? "Trocar a foto" : "Colocar uma foto"}</b>
          <small>{form.imagem_url ? "Buscar outra, escolher do celular ou tirar" : "Opcional · buscar na internet ou do celular"}</small>
        </span>
      </button>
      {fotoAberta && (
        <div className="ig-foto">
          <div className="ig-foto-acoes">
            <Botao variante="secundario" tamanho="m" icone={<MagnifyingGlass size={20} weight="bold" />} carregando={buscandoImg} disabled={uploadingImg} onClick={handleBuscarImagem}>Na internet</Botao>
            <Botao variante="secundario" tamanho="m" icone={<ImagemIc size={20} weight="bold" />} carregando={uploadingImg} disabled={buscandoImg} onClick={() => galleryRef.current?.click()}>Do celular</Botao>
          </div>
          {imagens.length > 0 && (
            <div className="ig-foto-grade">
              {imagens.map((url, idx) => (
                <button key={idx} type="button" aria-pressed={form.imagem_url === url} aria-label={`Usar a foto ${idx + 1}`}
                  onClick={() => setForm(f => ({ ...f, imagem_url: f.imagem_url === url ? "" : url }))}>
                  <img src={url} alt="" />
                </button>
              ))}
            </div>
          )}
          {form.imagem_url && (
            <button type="button" className="ig-foto-tirar" onClick={() => { setForm(f => ({ ...f, imagem_url: "" })); setImagens([]); }}>
              <X size={16} weight="bold" />Tirar a foto
            </button>
          )}
        </div>
      )}

      <Campo rotulo="Nome" obrigatorio placeholder="Ex.: Leite condensado" value={form.nome} erro={erroNome}
        onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
      <Campo rotulo="Marca" opcional placeholder="Ex.: Moça" value={form.marca}
        onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} />
      <div>
        <p className="ig-rot">Categoria</p>
        <div className="cl9-f-chips">
          {categorias.map(c => (
            <button key={c} type="button" aria-pressed={form.categoria === c} onClick={() => setForm(f => ({ ...f, categoria: c }))}>{c}</button>
          ))}
        </div>
      </div>

      <p className="cl9-f-sec">Como você compra</p>
      <div>
        <p className="ig-rot">Vem em</p>
        <div className="cl9-f-chips">
          {EMB_PRINCIPAIS.map(o => (
            <button key={o} type="button" aria-pressed={emb === o} onClick={() => { setVerOutras(false); setForm(f => ({ ...f, embalagem_tipo: o })); }}>{o}</button>
          ))}
          <button type="button" aria-pressed={EMB_OUTRAS.includes(emb)} aria-expanded={verOutras || EMB_OUTRAS.includes(emb)} onClick={() => setVerOutras(v => !v)}>Outra</button>
        </div>
        {(verOutras || EMB_OUTRAS.includes(emb)) && (
          <div className="cl9-f-chips ig-outras">
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
        {sugerida && <p className="ig-sug">Escolhida pelo nome. Toque em outra se for diferente.</p>}
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
        <Campo rotulo={rotuloQtd} inputMode="decimal" placeholder="1" value={form.qtd_embalagem} erro={erroQtd}
          onChange={e => setForm(f => ({ ...f, qtd_embalagem: e.target.value }))}
          depois={<span className="cl9-f-uf">{medidaTxt}</span>} />
        <Campo rotulo="Quanto pagou" inputMode="decimal" prefixo="R$" placeholder="0,00" value={form.valor_compra} erro={erroValor}
          onChange={e => setForm(f => ({ ...f, valor_compra: e.target.value }))} />
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

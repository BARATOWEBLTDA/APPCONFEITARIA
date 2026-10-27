/**
 * Insumos pela Doo IA (02/10) — salva EXATAMENTE como o cadastro manual (QuickAddInsumo):
 * custo_unitario = valor pago ÷ quantidade da embalagem, na unidade do próprio insumo
 * (ex.: lata de 395 g por R$ 6,79 → R$ 0,0172 por grama). Nada é salvo sem a confirmação dela.
 */
import { supabase } from "@/lib/supabase";
import { explicarErro } from "@/lib/erros";

export const UNIDADES_INSUMO = ["g", "kg", "ml", "L", "un"] as const;
export const EMBALAGENS_INSUMO = ["Avulso", "Pacote", "Caixa", "Lata", "Pote", "Garrafa", "Frasco", "Bandeja", "Bisnaga", "Sachê", "Envelope", "Balde", "Rolo"];
export const CATEGORIAS_INSUMO = ["Ingredientes", "Embalagens", "Decorações", "Bebidas", "Limpeza", "Descartáveis", "Outros"];

export type RascunhoInsumo = {
  acao: "insumo";
  insumo_id?: string | null;   // preenchido quando é pra ATUALIZAR um insumo que já existe
  nome: string;
  marca?: string;
  categoria?: string;
  unidade: string;
  embalagem_tipo?: string;
  qtd_embalagem: number;
  valor_compra: number;
  /** foto escolhida no cartão (a mesma busca de imagem do cadastro manual) */
  imagem_url?: string;
};

export type InsumoResumo = { id: string; nome: string; unidade: string; qtd_embalagem: number; valor_compra: number; custo_unitario: number };

const CAMPOS_RESUMO = "id, nome, unidade, qtd_embalagem, valor_compra, custo_unitario";
const paraResumo = (i: any): InsumoResumo => ({ id: i.id, nome: i.nome, unidade: i.unidade, qtd_embalagem: Number(i.qtd_embalagem) || 1, valor_compra: Number(i.valor_compra) || 0, custo_unitario: Number(i.custo_unitario) || 0 });
/** Quantos ingredientes a Doo recebe (11/10: antes 200). Os que passarem disso ainda são achados pelo nome no cartão. */
const TETO_INSUMOS_DOO = 500;

export async function listarInsumosResumo(uid: string): Promise<InsumoResumo[]> {
  const { data } = await supabase.from("insumos").select(CAMPOS_RESUMO).eq("user_id", uid).order("nome").limit(TETO_INSUMOS_DOO);
  return ((data as any[]) || []).map(paraResumo);
}

const nomeLimpo = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Ingrediente já cadastrado com esse nome (sem diferenciar acento nem maiúscula), direto do banco (11/10).
 * Serve pro cartão da Doo não cadastrar de novo um ingrediente que a IA não recebeu na lista.
 * Só devolve quando existe UM só com esse nome e a marca não é outra; na dúvida, nenhum (segue como ingrediente novo).
 */
export async function procurarInsumoPorNome(uid: string, nome: string, marca = ""): Promise<InsumoResumo | null> {
  const alvo = nomeLimpo(nome);
  if (!alvo) return null;
  // vogal, c e n viram "_" (uma letra qualquer): "acucar" acha "Açúcar"
  const padrao = alvo.replace(/[^a-z0-9 ]/gu, "_").replace(/[aeioucn]/g, "_").replace(/ /g, "%");
  const { data, error } = await supabase.from("insumos").select(`${CAMPOS_RESUMO}, marca`).eq("user_id", uid).ilike("nome", `${padrao}%`).order("nome").limit(300);
  if (error) { console.error("[Doonly] busca de ingrediente pelo nome:", error); return null; }
  const iguais = ((data as any[]) || []).filter(i => nomeLimpo(i.nome) === alvo && (!nomeLimpo(marca) || !nomeLimpo(i.marca) || nomeLimpo(i.marca) === nomeLimpo(marca)));
  return iguais.length === 1 ? paraResumo(iguais[0]) : null;
}

/** Custo "de vitrine" pra mostrar no cartão: por kg, por litro ou por unidade. */
export function custoLegivel(unidade: string, qtd: number, valor: number): string {
  if (!qtd || !valor) return "";
  const porUnidade = valor / qtd;
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (unidade === "g") return `${brl(porUnidade * 1000)} por kg`;
  if (unidade === "ml") return `${brl(porUnidade * 1000)} por litro`;
  if (unidade === "kg") return `${brl(porUnidade)} por kg`;
  if (unidade === "L") return `${brl(porUnidade)} por litro`;
  return `${brl(porUnidade)} por unidade`;
}

export function normalizarRascunho(r: any): RascunhoInsumo | null {
  if (!r || r.acao !== "insumo" || !String(r.nome || "").trim()) return null;
  const unidade = (UNIDADES_INSUMO as readonly string[]).includes(r.unidade) ? r.unidade : (String(r.unidade).toLowerCase() === "l" ? "L" : "g");
  return {
    acao: "insumo",
    insumo_id: r.insumo_id || null,
    nome: String(r.nome).trim(),
    marca: String(r.marca || "").trim(),
    categoria: CATEGORIAS_INSUMO.includes(r.categoria) ? r.categoria : "Ingredientes",
    unidade,
    embalagem_tipo: EMBALAGENS_INSUMO.includes(r.embalagem_tipo) ? r.embalagem_tipo : "Avulso",
    qtd_embalagem: Math.max(0, Number(r.qtd_embalagem) || 0),
    valor_compra: Math.max(0, Number(r.valor_compra) || 0),
  };
}

const familiaUnidade = (u: string) => (u === "g" || u === "kg" ? "peso" : u === "ml" || u === "L" ? "volume" : "unidade");

/**
 * soPrecoDe (11/10): ingrediente achado pelo nome, que a IA não viu. Só o preço e a quantidade mudam;
 * marca, categoria e embalagem ficam as do cadastro. Unidade de outra família (un × g) não grava: a receita passaria a custar errado.
 */
export async function salvarInsumoDoo(uid: string, r: RascunhoInsumo, soPrecoDe?: InsumoResumo | null): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  if (!r.nome.trim()) return { ok: false, erro: "Informe o nome do insumo." };
  if (!(r.valor_compra > 0)) return { ok: false, erro: "Informe quanto pagou." };
  if (!(r.qtd_embalagem > 0)) return { ok: false, erro: "Informe quanto veio na embalagem." };
  if (soPrecoDe && r.insumo_id) {
    if (familiaUnidade(r.unidade) !== familiaUnidade(soPrecoDe.unidade))
      return { ok: false, erro: `No cadastro, ${soPrecoDe.nome} está em ${soPrecoDe.unidade}. Atualize o preço pela tela de Insumos.` };
    const { data: mudou, error } = await supabase.from("insumos").update({
      unidade: r.unidade, valor_compra: r.valor_compra, qtd_embalagem: r.qtd_embalagem,
      custo_unitario: r.valor_compra / r.qtd_embalagem, updated_at: new Date().toISOString(),
    }).eq("id", r.insumo_id).eq("user_id", uid).select("id");
    if (error) return { ok: false, erro: explicarErro(error, "Não deu para atualizar o ingrediente. Tente de novo.") };
    if ((mudou as any[] | null)?.length) return { ok: true, id: r.insumo_id };
    return { ok: false, erro: "Esse ingrediente não está mais no cadastro. Feche e peça de novo para a Doo." };
  }
  const payload: any = {
    nome: r.nome.trim(), marca: (r.marca || "").trim(), categoria: r.categoria || "Ingredientes",
    unidade: r.unidade, embalagem_tipo: r.embalagem_tipo || "Avulso",
    valor_compra: r.valor_compra, qtd_embalagem: r.qtd_embalagem,
    custo_unitario: r.valor_compra / r.qtd_embalagem,
    updated_at: new Date().toISOString(),
    ...(r.imagem_url ? { imagem_url: r.imagem_url } : {}),
  };
  if (r.insumo_id) {
    // (27/10) a mesma trava do caminho de cima: unidade de outra família (g × un) com o ingrediente já cadastrado não grava
    const { data: atual } = await supabase.from("insumos").select("nome, unidade").eq("id", r.insumo_id).eq("user_id", uid).maybeSingle();
    if (atual && familiaUnidade(String((atual as any).unidade || "")) !== familiaUnidade(r.unidade))
      return { ok: false, erro: `No cadastro, ${(atual as any).nome} está em ${(atual as any).unidade}. Atualize pela tela de Insumos.` };
    // (11/10) confere se a linha mudou mesmo: com um id que não existe (a IA errou, ou o ingrediente foi apagado)
    // o banco não reclama e a tela dizia "atualizado" sem gravar nada. Nesse caso, cadastra como ingrediente novo.
    const { data: mudou, error } = await supabase.from("insumos").update(payload).eq("id", r.insumo_id).eq("user_id", uid).select("id");
    if (error) return { ok: false, erro: explicarErro(error, "Não deu para atualizar o ingrediente. Tente de novo.") };
    if ((mudou as any[] | null)?.length) return { ok: true, id: r.insumo_id };
  }
  const { data, error } = await supabase.from("insumos")
    .insert({ imagem_url: "", ...payload, user_id: uid, quantidade_estoque: 0, estoque_minimo: 0 }).select("id").single();
  return error || !data ? { ok: false, erro: explicarErro(error, "Não deu para cadastrar o ingrediente. Tente de novo.") } : { ok: true, id: (data as any).id };
}

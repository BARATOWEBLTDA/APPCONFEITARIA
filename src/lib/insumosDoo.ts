/**
 * Insumos pela Doo IA (02/10) — salva EXATAMENTE como o cadastro manual (QuickAddInsumo):
 * custo_unitario = valor pago ÷ quantidade da embalagem, na unidade do próprio insumo
 * (ex.: lata de 395 g por R$ 6,79 → R$ 0,0172 por grama). Nada é salvo sem a confirmação dela.
 */
import { supabase } from "@/lib/supabase";

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
};

export type InsumoResumo = { id: string; nome: string; unidade: string; qtd_embalagem: number; valor_compra: number; custo_unitario: number };

export async function listarInsumosResumo(uid: string): Promise<InsumoResumo[]> {
  const { data } = await supabase.from("insumos").select("id, nome, unidade, qtd_embalagem, valor_compra, custo_unitario").eq("user_id", uid).order("nome").limit(200);
  return ((data as any[]) || []).map(i => ({ id: i.id, nome: i.nome, unidade: i.unidade, qtd_embalagem: Number(i.qtd_embalagem) || 1, valor_compra: Number(i.valor_compra) || 0, custo_unitario: Number(i.custo_unitario) || 0 }));
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

export async function salvarInsumoDoo(uid: string, r: RascunhoInsumo): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  if (!r.nome.trim()) return { ok: false, erro: "Informe o nome do insumo." };
  if (!(r.valor_compra > 0)) return { ok: false, erro: "Informe quanto pagou." };
  if (!(r.qtd_embalagem > 0)) return { ok: false, erro: "Informe quanto veio na embalagem." };
  const payload: any = {
    nome: r.nome.trim(), marca: (r.marca || "").trim(), categoria: r.categoria || "Ingredientes",
    unidade: r.unidade, embalagem_tipo: r.embalagem_tipo || "Avulso",
    valor_compra: r.valor_compra, qtd_embalagem: r.qtd_embalagem,
    custo_unitario: r.valor_compra / r.qtd_embalagem,
    updated_at: new Date().toISOString(),
  };
  if (r.insumo_id) {
    const { error } = await supabase.from("insumos").update(payload).eq("id", r.insumo_id).eq("user_id", uid);
    return error ? { ok: false, erro: error.message } : { ok: true, id: r.insumo_id };
  }
  const { data, error } = await supabase.from("insumos")
    .insert({ ...payload, user_id: uid, quantidade_estoque: 0, estoque_minimo: 0, imagem_url: "" }).select("id").single();
  return error || !data ? { ok: false, erro: error?.message || "Não foi possível cadastrar." } : { ok: true, id: (data as any).id };
}

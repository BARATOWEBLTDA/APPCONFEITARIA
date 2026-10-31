import { supabase } from "@/lib/supabase";
/**
 * ═══════════════════════════════════════════════════════════════════
 * PRODUTO PRECIFICAÇÃO — motor central de cálculo
 * ═══════════════════════════════════════════════════════════════════
 *
 * FONTE ÚNICA DE VERDADE pra todos os cálculos de preço do sistema:
 * - cadastro (preview de "a partir de R$ X")
 * - cardápio digital (preço final que cliente vê)
 * - checkout (valor cobrado)
 * - snapshot no pedido (breakdown salvo)
 *
 * Se você está calculando preço em qualquer outro lugar, mova pra cá.
 * ═══════════════════════════════════════════════════════════════════
 *
 * IMPORTANTE — estado atual (Passo 3):
 * Este motor já suporta os 4 tipos de adicional (fixo, por_kg,
 * por_unidade, por_quantidade), mas a UI de cadastro ainda mostra
 * apenas "fixo" no dropdown. Os outros tipos ficam preparados aqui
 * pra quando o cardápio digital for refatorado pra estrutura V3.
 * ═══════════════════════════════════════════════════════════════════
 */

import { pesoDoNome } from "@/lib/itemSacola";

// ─── Tipos ──────────────────────────────────────────────────────────

export type TipoAdicional = "fixo" | "por_kg" | "por_unidade" | "por_quantidade";

export type RegraConflitoTamanho =
  | "preco_tamanho"                    // preço vem do tamanho, sabor vira só rótulo
  | "preco_sabor"                      // preço vem do sabor, tamanho vira só rótulo
  | "tamanho_base_sabor_adicional";    // tamanho define base + sabor soma adicional

export interface OpcaoComTipo {
  id: string;
  nome: string;
  adicional: number;
  tipo_adicional?: TipoAdicional;   // default "fixo" se ausente
  preco?: number;                    // pra tamanho/sabor com preço próprio
  peso_kg?: number | null;           // pra tamanho
}

export interface ContextoCalculo {
  // Quantidade que o cliente pediu (unidades, kg, ou blocos dependendo da forma_venda)
  quantidade_pedido: number;
  // Quantidade base do produto (ex: 100 pra cento, 12 pra dúzia). null/1 = venda unitária
  quantidade_base?: number | null;
  // Forma de venda do produto (kg | unidade | fatia | cento | ...)
  forma_venda?: string;
  // Se um tamanho foi escolhido, seu peso (pra cálculo por_kg)
  tamanho_escolhido_peso_kg?: number | null;
}

// ─── Constantes ─────────────────────────────────────────────────────

/**
 * Default do tipo_adicional. Toda opção sem tipo explícito é tratada
 * como "fixo" — comportamento retrocompatível (pedidos antigos e cadastros
 * feitos antes do Passo 3).
 */
export const TIPO_ADICIONAL_DEFAULT: TipoAdicional = "fixo";

/**
 * Default da regra de conflito Sabor × Tamanho. Se um produto tem sabor
 * com preço próprio E tamanho com preço próprio mas nunca foi configurado,
 * o sistema assume "preco_tamanho" (mais comum na prática).
 */
export const REGRA_CONFLITO_DEFAULT: RegraConflitoTamanho = "preco_tamanho";

// ─── Cálculo central de adicional ──────────────────────────────────

/**
 * Calcula quanto uma opção (massa/recheio/cobertura/sabor) contribui
 * ao preço final, dado o contexto do pedido.
 *
 * SEMÂNTICA:
 * - fixo:           adicional × 1
 * - por_unidade:    adicional por unidade (o preço é unitário; a sacola já multiplica pela quantidade)
 * - por_kg:         adicional × peso_em_kg (do tamanho escolhido ou quantidade_pedido se venda por kg)
 * - por_quantidade: adicional × (quantidade_pedido / quantidade_base)
 *                   Ex: cento (base=100), cliente pede 300 → 3 × adicional
 *
 * Proteção defensiva: nunca retorna NaN ou Infinity. Retorna 0 se
 * qualquer parâmetro estiver malformado.
 */
export function calcularAdicionalOpcao(
  opcao: OpcaoComTipo,
  contexto: ContextoCalculo
): number {
  const adicional = Number(opcao.adicional) || 0;
  if (adicional === 0) return 0;

  const tipo = opcao.tipo_adicional || TIPO_ADICIONAL_DEFAULT;
  const qtd = Number(contexto.quantidade_pedido) || 0;

  let resultado = 0;

  switch (tipo) {
    case "fixo":
      resultado = adicional;
      break;

    case "por_unidade":
      // Antes multiplicava pela quantidade AQUI e de novo na sacola (cobrava qtd² vezes)
      resultado = adicional;
      break;

    case "por_kg": {
      // Prioridade: peso do tamanho escolhido > quantidade em kg (venda por kg)
      const pesoTamanho = Number(contexto.tamanho_escolhido_peso_kg) || 0;
      if (pesoTamanho > 0) {
        resultado = adicional * pesoTamanho;
      } else if (contexto.forma_venda === "kg") {
        resultado = adicional * qtd;
      } else {
        // Sem peso disponível → fallback pra fixo pra não zerar silenciosamente
        resultado = adicional;
      }
      break;
    }

    case "por_quantidade": {
      const base = Number(contexto.quantidade_base) || 1;
      if (base > 1 && qtd > 0) {
        const blocos = qtd / base;
        resultado = adicional * blocos;
      } else {
        // Sem quantidade_base válida — fallback fixo pra proteger
        resultado = adicional;
      }
      break;
    }

    default:
      resultado = adicional;
  }

  // Proteção final contra NaN/Infinity
  if (!Number.isFinite(resultado)) return 0;
  return resultado;
}

// ─── Contextual: quais tipos_adicional fazem sentido pro produto ────

export interface ContextoTiposDisponiveis {
  quantidade_base?: number | null;
  forma_venda?: string;
  tem_tamanho_com_peso?: boolean;  // se o produto tem grupo tamanho ativo com opções de peso_kg
}

/**
 * Retorna a lista de tipos de adicional que fazem sentido no contexto
 * atual do produto. Usado pra UI popular dropdown contextual.
 *
 * REGRAS:
 * - "fixo": sempre disponível
 * - "por_unidade": quando há quantidade de unidades (não vale pra venda por kg pura)
 * - "por_kg": quando forma_venda="kg" OU quando algum tamanho tem peso_kg
 * - "por_quantidade": só quando quantidade_base > 1 (produto vendido em blocos)
 *
 * Ordem: sempre "fixo" primeiro (mais comum), depois por relevância.
 */
export function getTiposAdicionalDisponiveis(
  ctx: ContextoTiposDisponiveis
): TipoAdicional[] {
  const tipos: TipoAdicional[] = ["fixo"];

  const isKg = ctx.forma_venda === "kg";
  const isCento = ctx.forma_venda === "cento";
  const base = Number(ctx.quantidade_base) || 0;

  // por_unidade: qualquer venda que não seja puramente por kg
  if (!isKg) tipos.push("por_unidade");

  // por_kg: forma_venda kg OU tem tamanho com peso
  if (isKg || ctx.tem_tamanho_com_peso) tipos.push("por_kg");

  // por_quantidade: só quando quantidade_base > 1
  if (base > 1 || isCento) tipos.push("por_quantidade");

  return tipos;
}

// ─── Regra Sabor × Tamanho ──────────────────────────────────────────

export interface ContextoConflito {
  sabor_ativo: boolean;
  sabor_tem_preco_proprio: boolean;
  sabor_tem_opcao_com_preco: boolean;  // pelo menos 1 sabor com preco > 0
  tamanho_ativo: boolean;
  tamanho_tem_opcao_com_preco: boolean; // pelo menos 1 tamanho com preco > 0
}

/**
 * Existe conflito de preço entre Sabor e Tamanho quando AMBOS estão
 * ativos, sabor está configurado pra ter preço próprio, E tanto sabor
 * quanto tamanho têm pelo menos 1 opção com preço > 0.
 *
 * Só quando existe conflito é que a confeiteira precisa escolher qual
 * regra usar (`regra_conflito_tamanho`). Caso contrário, a UI esconde
 * o seletor.
 */
export function existeConflitoSaborTamanho(ctx: ContextoConflito): boolean {
  return (
    ctx.sabor_ativo &&
    ctx.sabor_tem_preco_proprio &&
    ctx.sabor_tem_opcao_com_preco &&
    ctx.tamanho_ativo &&
    ctx.tamanho_tem_opcao_com_preco
  );
}

/**
 * Aplica a regra de conflito Sabor × Tamanho pra retornar o preço base
 * efetivo (antes dos adicionais).
 *
 * - preco_tamanho:                usa preço do tamanho escolhido
 * - preco_sabor:                  usa preço do sabor escolhido
 * - tamanho_base_sabor_adicional: usa preço do tamanho + adicional do sabor
 *   (nesse caso, o adicional retornado adicional_sabor deve ser somado
 *   ao preço base pelo caller)
 */
export function aplicarRegraConflito(
  regra: RegraConflitoTamanho,
  precoTamanho: number,
  precoSabor: number
): { base_efetivo: number; adicional_sabor: number } {
  const pt = Number(precoTamanho) || 0;
  const ps = Number(precoSabor) || 0;

  switch (regra) {
    case "preco_tamanho":
      return { base_efetivo: pt, adicional_sabor: 0 };
    case "preco_sabor":
      return { base_efetivo: ps, adicional_sabor: 0 };
    case "tamanho_base_sabor_adicional":
      return { base_efetivo: pt, adicional_sabor: ps };
    default:
      return { base_efetivo: pt, adicional_sabor: 0 };
  }
}

// ─── Labels pra UI ──────────────────────────────────────────────────

export const TIPO_ADICIONAL_LABEL: Record<TipoAdicional, string> = {
  fixo: "Fixo",
  por_unidade: "Por unidade",
  por_kg: "Por kg",
  por_quantidade: "Por quantidade",
};

export const TIPO_ADICIONAL_HINT: Record<TipoAdicional, string> = {
  fixo: "Soma uma única vez no pedido",
  por_unidade: "Multiplica pelo número de unidades",
  por_kg: "Multiplica pelo peso em kg",
  por_quantidade: "Multiplica por bloco (ex: cento)",
};

export const REGRA_CONFLITO_LABEL: Record<RegraConflitoTamanho, string> = {
  preco_tamanho: "Preço vem do tamanho",
  preco_sabor: "Preço vem do sabor",
  tamanho_base_sabor_adicional: "Tamanho define base + sabor soma adicional",
};

export const REGRA_CONFLITO_HINT: Record<RegraConflitoTamanho, string> = {
  preco_tamanho: "Sabor vira só um rótulo, sem valor",
  preco_sabor: "Tamanho vira só um rótulo, sem valor",
  tamanho_base_sabor_adicional: "Ex: M (R$60) + Ninho (+R$10) = R$70",
};

// ─── Preço que o cliente paga, custo e lucro (10/10) ────────────────
// Uma conta só pra Produtos, Ficha técnica e o PDF da ficha (antes cada tela fazia a sua).

/** Desconto da promoção, de 0 a 1. Mesma regra do cardápio (cartão do produto): em % ou em valor. */
export function descontoPromocao(p: any): number {
  if (!p?.promocao) return 0;
  const pct = Number(p.desconto_percentual) || 0;
  if (p.tipo_promocao === "percentual" && pct > 0) return Math.min(pct, 100) / 100;
  const normal = Number(p.preco_normal) || 0;
  const promo = Number(p.preco_promocional) || 0;
  if (promo > 0 && normal > 0 && promo < normal) return 1 - promo / normal;
  return 0;
}

/** Preço que o cliente paga pelo produto: o preço cheio já com a promoção (em valor ou em %). */
export function precoQueClientePaga(p: any): number {
  const normal = Number(p?.preco_normal) || 0;
  const d = descontoPromocao(p);
  return d > 0 ? Math.round(normal * (1 - d) * 100) / 100 : normal;
}

const FAMILIA_UNIDADE: Record<string, { familia: string; base: number }> = {
  kg: { familia: "massa", base: 1 }, g: { familia: "massa", base: 0.001 },
  L: { familia: "volume", base: 1 }, ml: { familia: "volume", base: 0.001 },
  un: { familia: "unidade", base: 1 },
};

/** Custo de um ingrediente na receita, convertendo a unidade usada pra unidade em que ele foi comprado. */
export function custoIngrediente(qtd: number, unidadeUsada: string, insumo: { unidade?: string; custo_unitario?: number } | null | undefined): number {
  const cu = Number(insumo?.custo_unitario) || 0;
  const q = Number(qtd) || 0;
  const a = FAMILIA_UNIDADE[unidadeUsada], b = FAMILIA_UNIDADE[insumo?.unidade || ""];
  if (a && b && a.familia === b.familia && b.base > 0) return ((q * a.base) / b.base) * cu;
  return q * cu;
}

/** (13/10) Custos da venda: % que a maquininha cobra no crédito (o pior caso) + valor fixo por pedido (embalagem). */
export type CustoDaVenda = { pct: number; fixo: number };

/** Mão de obra salva na conta (Custos → Mão de obra): vale pra todos os produtos.
 *  (16/10) + os custos fixos do mês: a hora da Ficha técnica é a mesma da tela Custos (fixos + salário). */
export type MaoObraConta = { salario: number; horasSemana: number; fixos?: number } | null;
/** Semanas num mês (52 ÷ 12): a mesma conta na tela Custos, na Ficha técnica e no PDF */
export const SEMANAS_MES = 4.345;
/** Custo da sua hora = (custos fixos do mês + salário) ÷ horas trabalhadas no mês */
export function custoDaHora(mao: MaoObraConta): number {
  if (!mao) return 0;
  const horas = (Number(mao.horasSemana) || 0) * SEMANAS_MES;
  return horas > 0 ? ((Number(mao.salario) || 0) + (Number(mao.fixos) || 0)) / horas : 0;
}
/** Lê na conta o salário, a jornada e os custos fixos ativos (null quando não tem nada cadastrado) */
export async function lerMaoObraConta(uid: string): Promise<MaoObraConta> {
  const [m, f] = await Promise.all([
    supabase.from("config_mao_obra").select("*").eq("user_id", uid).maybeSingle().then(r => r, () => ({ data: null } as any)),
    supabase.from("custos_fixos").select("valor, ativo").eq("user_id", uid).then(r => r, () => ({ data: null } as any)),
  ]);
  const d: any = m.data || {};
  const salario = Number(d.salario_mensal) || 0;
  const fixos = ((f.data as any[]) || []).filter(x => x.ativo !== false).reduce((s, x) => s + (Number(x.valor) || 0), 0);
  if (salario <= 0 && fixos <= 0) return null;
  const dias = Array.isArray(d.dias_semana_array) && d.dias_semana_array.length ? d.dias_semana_array.length : (Number(d.dias_semana) || 5);
  return { salario, horasSemana: (Number(d.horas_dia) || 8) * dias, fixos };
}

/**
 * Custo e lucro de um produto: ingredientes + custos invisíveis + mão de obra (a regra da Ficha técnica).
 * `p` vem com produto_insumos(quantidade, unidade_utilizada, insumos(custo_unitario, unidade)).
 * `mao` e `cvConta` são os valores salvos na conta; sem eles valem os do próprio produto (25% quando nunca mudou).
 */
export function calcularCustoLucro(p: any, mao: MaoObraConta = null, cvConta: number | null = null, venda: CustoDaVenda | null = null) {
  const itens: any[] = (p?.produto_insumos || []).filter((x: any) => x?.insumos);
  const cmv = itens.reduce((s, pi) => s + custoIngrediente(Number(pi.quantidade) || 0, pi.unidade_utilizada || pi.insumos?.unidade || "", pi.insumos), 0);
  const cvPct = cvConta != null ? Number(cvConta) || 0 : (p?.cv_percentual != null ? Number(p.cv_percentual) || 0 : 25);
  const cv = cmv * (cvPct / 100);
  // Mão de obra: liga quando a ficha tem salário ou tempo salvos
  const moAtivo = !!(p?.salario_desejado || p?.tempo_preparo_min);
  const tempoMin = parseInt(String(p?.tempo_preparo_min || 0)) || 0;
  // (16/10) a hora vem da conta (fixos + salário); produto antigo sem nada na conta usa o que ficou salvo nele
  const custoHora = custoDaHora(mao ?? { salario: Number(p?.salario_desejado) || 0, horasSemana: Number(p?.horas_semanais) || 40 });
  const mo = moAtivo ? custoHora * (tempoMin / 60) : 0;
  const preco = precoQueClientePaga(p);
  // (13/10) taxa da maquininha (a do crédito, o pior caso) e custo fixo por pedido (embalagem)
  const taxa = venda ? preco * ((Number(venda.pct) || 0) / 100) + (Number(venda.fixo) || 0) : 0;
  const custoTotal = cmv + cv + mo + taxa;
  const lucro = preco - custoTotal;
  const margemCmv = preco > 0 ? (cmv / preco) * 100 : 0;
  const margemLucro = preco > 0 ? (lucro / preco) * 100 : 0;
  return { cmv, cvPct, cv, mo, taxa, tempoMin, custoTotal, preco, lucro, margemCmv, margemLucro, temFicha: itens.length > 0 };
}

// ─── Peso do tamanho pelo nome (10/10) ──────────────────────────────

/**
 * Lê o peso (em kg) escrito no nome do tamanho: "0,5kg" → 0.5 · "1 kg" → 1 · "1,5 Kg" → 1.5 · "500g" → 0.5.
 * Sem peso no nome ("P", "20 cm", "10 un") devolve null.
 */
export function pesoKgDoNome(nome: string | null | undefined): number | null {
  // Uma leitura só, a do cardápio (lib/itemSacola): fração ("1/2 kg"), faixa ("2 a 3 kg"), dois pesos ("1kg e 500g")
  // e "e meio" não dão pra ter certeza, então devolvem null e o cadastro pede o peso certo.
  const kg = pesoDoNome(nome);
  return kg > 0 ? kg : null;
}

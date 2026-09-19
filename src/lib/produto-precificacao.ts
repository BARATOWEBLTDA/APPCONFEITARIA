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
 * - por_unidade:    adicional × quantidade_pedido
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
      resultado = adicional * qtd;
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

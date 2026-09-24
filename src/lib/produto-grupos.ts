/**
 * ═══════════════════════════════════════════════════════════════════
 * PRODUTO GRUPOS OPÇÕES — arquitetura genérica
 * ═══════════════════════════════════════════════════════════════════
 *
 * Substitui as 4 (agora 5) colunas jsonb separadas por uma única
 * estrutura genérica de array: `grupos_opcoes`.
 *
 * Cada grupo tem um `tipo` que discrimina: massa, recheio, cobertura,
 * sabor, tamanho. A UI decide como renderizar cada tipo.
 *
 * Adicionar categoria nova (ex: "decoracao"): basta incluir no TipoGrupo
 * e no CONFIG_TIPO abaixo. Zero mudança de banco.
 * ═══════════════════════════════════════════════════════════════════
 */

// ─── Tipos base ──────────────────────────────────────────────────────

export type TipoGrupo = "massa" | "recheio" | "cobertura" | "sabor" | "tamanho";

export type OpcaoGenerica = {
  id: string;
  nome: string;
  adicional: number;       // pra tipos que somam ao preço (massa/recheio/cobertura)
  preco?: number;          // pra tipos com preço próprio (tamanho, sabor com preco_proprio)
  peso_kg?: number | null; // só pra tamanho — peso aproximado
  serve?: string;          // só pra tamanho — "quantas pessoas serve" (opcional)
  foto?: string;
};

export type GrupoOpcoes = {
  id: string;
  tipo: TipoGrupo;
  nome_exibicao: string;
  ativo: boolean;
  min_selecionavel: number;
  max_selecionavel: number;
  foto_por_opcao: boolean;
  // Campo específico de sabor: se true, o preço da opção substitui o preço base
  sabor_tem_preco_proprio?: boolean;
  // Campo específico de recheio: distribuição livre ou dividida
  distribuicao?: "nenhuma" | "igual" | "livre";
  opcoes: OpcaoGenerica[];
};

// ─── Config por tipo (defaults, labels, comportamento) ───────────────

export const CONFIG_TIPO: Record<TipoGrupo, {
  label: string;
  labelSingular: string;
  placeholderOpcao: string;
  min_default: number;
  max_default: number;
  temAdicional: boolean;  // se opcoes têm campo "adicional"
  temPreco: boolean;      // se opcoes têm campo "preco"
  temPeso: boolean;       // se opcoes têm campo "peso_kg"
}> = {
  massa: {
    label: "Massas",
    labelSingular: "massa",
    placeholderOpcao: "Baunilha, chocolate, red velvet…",
    min_default: 1,
    max_default: 1,
    temAdicional: true,
    temPreco: false,
    temPeso: false,
  },
  recheio: {
    label: "Recheios",
    labelSingular: "recheio",
    placeholderOpcao: "Brigadeiro, ninho, doce de leite…",
    min_default: 1,
    max_default: 2,
    temAdicional: true,
    temPreco: false,
    temPeso: false,
  },
  cobertura: {
    label: "Coberturas",
    labelSingular: "cobertura",
    placeholderOpcao: "Chantilly, ganache, pasta americana…",
    min_default: 1,
    max_default: 1,
    temAdicional: true,
    temPreco: false,
    temPeso: false,
  },
  sabor: {
    label: "Sabores",
    labelSingular: "sabor",
    placeholderOpcao: "Tradicional, chocolate, ninho…",
    min_default: 1,
    max_default: 1,
    temAdicional: true,  // ativa se sabor_tem_preco_proprio=false
    temPreco: true,      // ativa se sabor_tem_preco_proprio=true
    temPeso: false,
  },
  tamanho: {
    label: "Tamanhos",
    labelSingular: "tamanho",
    placeholderOpcao: "P, M, G ou 15cm, 20cm, 25cm…",
    min_default: 1,
    max_default: 1,
    temAdicional: false,
    temPreco: true,
    temPeso: true,
  },
};

// ─── Fábricas ────────────────────────────────────────────────────────

const gerarId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

/** Cria um grupo vazio pronto pra ser preenchido */
export function criarGrupoVazio(tipo: TipoGrupo): GrupoOpcoes {
  const cfg = CONFIG_TIPO[tipo];
  return {
    id: `grp_${tipo}_${gerarId()}`,
    tipo,
    nome_exibicao: cfg.label,
    ativo: false,
    min_selecionavel: cfg.min_default,
    max_selecionavel: cfg.max_default,
    foto_por_opcao: false,
    ...(tipo === "sabor" ? { sabor_tem_preco_proprio: false } : {}),
    ...(tipo === "recheio" ? { distribuicao: "nenhuma" as const } : {}),
    opcoes: [],
  };
}

/** Cria uma opção vazia pronta pra ser preenchida */
export function criarOpcaoVazia(tipo: TipoGrupo, nome = ""): OpcaoGenerica {
  const cfg = CONFIG_TIPO[tipo];
  const base: OpcaoGenerica = {
    id: `opc_${gerarId()}`,
    nome,
    adicional: 0,
  };
  if (cfg.temPreco) base.preco = 0;
  if (cfg.temPeso) base.peso_kg = null;
  return base;
}

/** Retorna array inicial com os 5 tipos, todos desativados */
export function gruposIniciais(): GrupoOpcoes[] {
  return [
    criarGrupoVazio("massa"),
    criarGrupoVazio("recheio"),
    criarGrupoVazio("cobertura"),
    criarGrupoVazio("sabor"),
    criarGrupoVazio("tamanho"),
  ];
}

// ─── Helpers de acesso ───────────────────────────────────────────────

/** Busca grupo por tipo. Se não existir, retorna null. */
export function getGrupo(grupos: GrupoOpcoes[], tipo: TipoGrupo): GrupoOpcoes | null {
  return grupos.find(g => g.tipo === tipo) || null;
}

/** Garante que existe grupo do tipo. Se faltar, cria vazio (imutável). */
export function garantirGrupo(grupos: GrupoOpcoes[], tipo: TipoGrupo): GrupoOpcoes[] {
  if (getGrupo(grupos, tipo)) return grupos;
  return [...grupos, criarGrupoVazio(tipo)];
}

/** Atualiza um grupo (imutável) — retorna novo array */
export function updateGrupo(
  grupos: GrupoOpcoes[],
  tipo: TipoGrupo,
  updater: (g: GrupoOpcoes) => GrupoOpcoes
): GrupoOpcoes[] {
  const garantido = garantirGrupo(grupos, tipo);
  return garantido.map(g => g.tipo === tipo ? updater(g) : g);
}

/** Adiciona opção a um grupo */
export function addOpcao(
  grupos: GrupoOpcoes[],
  tipo: TipoGrupo,
  opcao: OpcaoGenerica
): GrupoOpcoes[] {
  return updateGrupo(grupos, tipo, g => ({ ...g, opcoes: [...g.opcoes, opcao] }));
}

/** Remove opção de um grupo por id */
export function removeOpcao(
  grupos: GrupoOpcoes[],
  tipo: TipoGrupo,
  opcaoId: string
): GrupoOpcoes[] {
  return updateGrupo(grupos, tipo, g => ({
    ...g,
    opcoes: g.opcoes.filter(o => o.id !== opcaoId),
  }));
}

/** Move opção pra cima/baixo (reordenar) */
export function moveOpcao(
  grupos: GrupoOpcoes[],
  tipo: TipoGrupo,
  opcaoId: string,
  direcao: "up" | "down"
): GrupoOpcoes[] {
  return updateGrupo(grupos, tipo, g => {
    const idx = g.opcoes.findIndex(o => o.id === opcaoId);
    if (idx < 0) return g;
    const novoIdx = direcao === "up" ? idx - 1 : idx + 1;
    if (novoIdx < 0 || novoIdx >= g.opcoes.length) return g;
    const novas = [...g.opcoes];
    [novas[idx], novas[novoIdx]] = [novas[novoIdx], novas[idx]];
    return { ...g, opcoes: novas };
  });
}

/** Atualiza uma opção específica de um grupo */
export function updateOpcao(
  grupos: GrupoOpcoes[],
  tipo: TipoGrupo,
  opcaoId: string,
  patch: Partial<OpcaoGenerica>
): GrupoOpcoes[] {
  return updateGrupo(grupos, tipo, g => ({
    ...g,
    opcoes: g.opcoes.map(o => o.id === opcaoId ? { ...o, ...patch } : o),
  }));
}

// ─── Consultas de estado ─────────────────────────────────────────────

/** Retorna só os grupos ativos e com opções cadastradas */
export function gruposAtivos(grupos: GrupoOpcoes[]): GrupoOpcoes[] {
  return grupos.filter(g => g.ativo && g.opcoes.length > 0);
}

/** True se algum grupo está ativo */
export function algumGrupoAtivo(grupos: GrupoOpcoes[]): boolean {
  return grupos.some(g => g.ativo);
}

// ─── Formato ANTIGO (compatibilidade) ────────────────────────────────
// Mantém as 4 estruturas antigas pra facilitar refatoração incremental.
// Serão removidas ao final da migração.

export type GrupoAntigoPersonalizacao = {
  ativo: boolean;
  min: number;
  max: number;
  distribuicao: "nenhuma" | "igual" | "livre";
  opcoes: Array<{ id: string; nome: string; adicional: number; foto?: string }>;
  foto_por_opcao?: boolean;
};

export type GrupoAntigoTamanhos = {
  ativo: boolean;
  min: number;
  max: number;
  distribuicao: "nenhuma" | "igual" | "livre";
  opcoes: Array<{ id: string; nome: string; preco: number; foto?: string }>;
  foto_por_opcao?: boolean;
};

// ═══════════════════════════════════════════════════════════════════
// ADAPTER — converte entre formato antigo e novo
// ═══════════════════════════════════════════════════════════════════

/**
 * Converte 4 colunas antigas do banco → array grupos_opcoes[] novo.
 *
 * Usado no CARREGAMENTO — quando abre um produto pra editar.
 * Se o produto já tem `grupos_opcoes` (pós-migração), usa direto.
 * Senão, monta a partir das 4 colunas antigas.
 */
export function carregarGruposDoBanco(produto: any): GrupoOpcoes[] {
  // Sempre monta a partir das colunas antigas (que são o que a UI edita).
  // O grupos_opcoes[] é apenas destino de escrita, nunca fonte de leitura,
  // pra evitar divergência (ex: modo_avancado, serve, novos campos que a UI
  // adiciona só nas colunas antigas).
  const grupos: GrupoOpcoes[] = [];

  const mapearAntigo = (
    tipo: TipoGrupo,
    antigo: GrupoAntigoPersonalizacao | GrupoAntigoTamanhos | undefined
  ) => {
    const cfg = CONFIG_TIPO[tipo];
    const g = criarGrupoVazio(tipo);
    if (antigo) {
      g.ativo = !!antigo.ativo;
      g.min_selecionavel = antigo.min ?? cfg.min_default;
      g.max_selecionavel = antigo.max ?? cfg.max_default;
      g.foto_por_opcao = !!antigo.foto_por_opcao;
      if (tipo === "recheio") g.distribuicao = antigo.distribuicao || "nenhuma";
      // Preserva campos extras do grupo (modo_avancado, modo_preco_tamanho, etc)
      // — copia tudo que não é gerenciado explicitamente acima
      Object.keys(antigo).forEach(k => {
        if (!["ativo", "min", "max", "foto_por_opcao", "distribuicao", "opcoes"].includes(k)) {
          (g as any)[k] = (antigo as any)[k];
        }
      });
      g.opcoes = (antigo.opcoes || []).map((o: any) => ({
        id: o.id || `opc_${gerarId()}`,
        nome: o.nome || "",
        adicional: o.adicional ?? 0,
        ...(cfg.temPreco ? { preco: o.preco ?? 0 } : {}),
        ...(cfg.temPeso ? { peso_kg: o.peso_kg ?? null } : {}),
        ...(o.serve ? { serve: o.serve } : {}),
        ...(o.foto ? { foto: o.foto } : {}),
      }));
    }
    grupos.push(g);
  };

  mapearAntigo("massa", produto?.grupo_massas);
  mapearAntigo("recheio", produto?.grupo_recheios);
  mapearAntigo("cobertura", produto?.grupo_coberturas);
  mapearAntigo("sabor", produto?.grupo_sabores);
  mapearAntigo("tamanho", produto?.grupo_tamanhos);

  return grupos;
}

/**
 * Converte array grupos_opcoes[] novo → payload pro banco.
 *
 * Usado no SALVAMENTO — retorna objeto pronto pra spread no insert/update.
 * Salva na coluna nova `grupos_opcoes` E nas 4 antigas em paralelo,
 * pra manter compatibilidade durante a transição.
 */
export function salvarGruposParaBanco(grupos: GrupoOpcoes[]): Record<string, any> {
  const payload: Record<string, any> = {
    grupos_opcoes: grupos,
  };

  // Compatibilidade: preenche as 4 colunas antigas também
  const massa = getGrupo(grupos, "massa");
  const recheio = getGrupo(grupos, "recheio");
  const cobertura = getGrupo(grupos, "cobertura");
  const tamanho = getGrupo(grupos, "tamanho");

  if (massa) {
    payload.grupo_massas = {
      ativo: massa.ativo,
      min: massa.min_selecionavel,
      max: massa.max_selecionavel,
      distribuicao: "nenhuma",
      opcoes: massa.opcoes,
      foto_por_opcao: massa.foto_por_opcao,
    };
  }
  if (recheio) {
    payload.grupo_recheios = {
      ativo: recheio.ativo,
      min: recheio.min_selecionavel,
      max: recheio.max_selecionavel,
      distribuicao: recheio.distribuicao || "nenhuma",
      opcoes: recheio.opcoes,
      foto_por_opcao: recheio.foto_por_opcao,
    };
  }
  if (cobertura) {
    payload.grupo_coberturas = {
      ativo: cobertura.ativo,
      min: cobertura.min_selecionavel,
      max: cobertura.max_selecionavel,
      distribuicao: "nenhuma",
      opcoes: cobertura.opcoes,
      foto_por_opcao: cobertura.foto_por_opcao,
    };
  }
  if (tamanho) {
    // Preserva campos extras (modo_avancado, modo_preco_tamanho, etc)
    // que a UI armazena diretamente no grupo, além dos campos padrões
    const extras: Record<string, any> = {};
    Object.keys(tamanho).forEach(k => {
      if (!["tipo", "nome_exibicao", "ativo", "min_selecionavel", "max_selecionavel", "distribuicao", "opcoes", "foto_por_opcao"].includes(k)) {
        extras[k] = (tamanho as any)[k];
      }
    });
    payload.grupo_tamanhos = {
      ativo: tamanho.ativo,
      min: tamanho.min_selecionavel,
      max: tamanho.max_selecionavel,
      distribuicao: "nenhuma",
      opcoes: tamanho.opcoes,
      foto_por_opcao: tamanho.foto_por_opcao,
      ...extras,
    };
  }
  // Sabor não tem coluna antiga — só grupos_opcoes

  return payload;
}

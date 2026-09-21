import { supabase } from '@/lib/supabase'
import { Produto, DesignSettings, Configuracoes } from '@/types/database'

export interface CardapioData {
  design: DesignSettings | null
  config: Configuracoes | null
  produtos: Produto[]
  isPro: boolean
  categoryImages: { [key: string]: string }
  categoriasList: string[]
  /** Slug canônico esperado — 'cardapio' pra free, slug_personalizado pra PRO */
  slugCanonico: string
  /** Código público — sempre presente */
  codigoPublico: string
  /** Layout escolhido: 'padrao', 'modelo1', etc. */
  cardapioModelo: string
}

const EMPTY_RESULT: CardapioData = {
  design: null,
  config: null,
  produtos: [],
  isPro: false,
  categoryImages: {},
  categoriasList: [],
  slugCanonico: 'cardapio',
  codigoPublico: '',
  cardapioModelo: 'padrao',
}

/**
 * Busca cardápio pelo código público (4 chars).
 * Nova função principal — o código é o identificador real.
 * Slug (2º segmento) é apenas decoração/SEO.
 */
export async function getCardapioByCodigo(codigo: string): Promise<CardapioData> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('codigo_publico', codigo)
    .maybeSingle()

  if (!profile) return EMPTY_RESULT

  return fetchByUserId(profile.id, profile)
}

/**
 * @deprecated Compat com cardápios acessados via ID (UUID).
 * Mantido só pra não quebrar bookmarks antigos durante a transição.
 * Remover após 30 dias em produção.
 */
export async function getCardapioBySlug(slug: string): Promise<CardapioData> {
  // Tenta primeiro por codigo_publico (novo)
  const porCodigo = await getCardapioByCodigo(slug)
  if (porCodigo.design) return porCodigo

  // Fallback: tenta por id (comportamento antigo)
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', slug)
    .maybeSingle()

  if (!profile) return EMPTY_RESULT

  return fetchByUserId(profile.id, profile)
}

async function fetchByUserId(userId: string, profile: any): Promise<CardapioData> {
  const [{ data: produtos }, { data: categorias }] = await Promise.all([
    supabase.from('produtos').select('*').eq('user_id', userId).eq('disponivel', true).order('created_at', { ascending: false }),
    supabase.from('categorias').select('nome, imagem_url').eq('user_id', userId).order('ordem').order('nome')
  ])

  const categoryImages: { [key: string]: string } = {}
  const categoriasList: string[] = []
  if (categorias) {
    categorias.forEach((c: any) => {
      categoriasList.push(c.nome)
      if (c.imagem_url) categoryImages[c.nome] = c.imagem_url
    })
  }

  const expira = profile.pro_expira_em ? new Date(profile.pro_expira_em) : null
  const isPro = profile.plano === 'pro' && (!expira || expira > new Date())

  // Slug canônico: se PRO e tem slug_personalizado, usa. Senão, 'cardapio' fixo.
  const slugCanonico = isPro && profile.slug_personalizado
    ? profile.slug_personalizado
    : 'cardapio'

  const design: DesignSettings = {
    user_id: userId,
    nome_loja: profile.nome_loja || 'Minha Confeitaria',
    descricao_loja: profile.descricao_loja || '',
    logo_url: profile.logo_url || profile.foto_url || '',
    banner_url: profile.banner_url || '',
    banner1_url: profile.banner1_url || '',
    banner2_url: profile.banner2_url || '',
    banner3_url: profile.banner3_url || '',
    cor_borda: profile.cor_borda || '#ec4899',
    cor_background: profile.cor_background || '#fef2f2',
    cor_nome: profile.cor_nome || '#1f2937',
    banner_gradient: profile.banner_gradient || '',
    hide_stars: profile.hide_stars || false,
    cor_botao: profile.cor_botao || '#ec4899',
    cor_navbar: profile.cor_navbar || profile.cor_borda || '#ec4899',
    cor_sacola: profile.cor_sacola || '#ec4899',
    cor_rodape: profile.cor_rodape || '#ec4899',
    ocultar_categorias: profile.ocultar_categorias || false,
  }

  const config: Configuracoes = {
    user_id: userId,
    telefone: profile.telefone || '',
    avaliacao_media: profile.avaliacao_media || 4.9,
    endereco: profile.endereco || null,
    mostrar_localizacao: profile.mostrar_localizacao || false,
    mostrar_apenas_cidade: profile.mostrar_apenas_cidade || false,
    horario: profile.horario || null,
    // Novos campos de checkout
    formas_pagamento: profile.formas_pagamento || ['pix'],
    formas_entrega: profile.formas_entrega || ['retirada'],
    valor_entrega_propria: profile.valor_entrega_propria || 0,
    entrega_por_bairro: profile.entrega_por_bairro || [],
    endereco_retirada: profile.endereco_retirada || '',
    horario_retirada: profile.horario_retirada || '',
    exibir_campo_troco: profile.exibir_campo_troco !== false,
    cupons_desconto: profile.cupons_desconto || [],
    aceita_agendamento: profile.aceita_agendamento !== false,
    prazo_minimo_horas: profile.prazo_minimo_horas || 24,
  }

  return {
    design,
    config,
    produtos: produtos || [],
    isPro,
    categoryImages,
    categoriasList,
    slugCanonico,
    codigoPublico: profile.codigo_publico || '',
    cardapioModelo: profile.cardapio_modelo || 'padrao',
  }
}

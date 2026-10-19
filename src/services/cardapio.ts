import { temaAtivo, NATAL, AVISO_NATAL_PADRAO, CAPA_NATAL_PADRAO } from '@/lib/temaCardapio'
import { COR_BOTOES, corDoItem } from '@/lib/coresCardapio'
import { supabase } from '@/lib/supabase'
import { fotoDaLoja } from '@/hooks/useProfile'
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
  cardapioModelo: 'modelo1',
}

/**
 * Busca cardápio pelo código público (4 chars).
 * Nova função principal — o código é o identificador real.
 * Slug (2º segmento) é apenas decoração/SEO.
 */
/**
 * (4.22) Os dados da loja vêm da função cardapio_loja do banco, que não entrega campos internos
 * (plano interno, Hotmart, caixa, cupons, indicação). Se a função ainda não existir no banco
 * (SQL 4.22 ainda não rodado), lê o perfil como antes.
 */
const funcaoFaltando = (e: any) => !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function/i.test(String(e.message || '')))

async function perfilDaLoja(chave: string, coluna: 'codigo_publico' | 'id'): Promise<any | null> {
  const { data, error } = await supabase.rpc('cardapio_loja', { p_chave: chave })
  if (!error) return data || null
  if (!funcaoFaltando(error)) return null
  const { data: profile } = await supabase.from('profiles').select('*').eq(coluna, chave).maybeSingle()
  return profile || null
}

export async function getCardapioByCodigo(codigo: string): Promise<CardapioData> {
  const profile = await perfilDaLoja(codigo, 'codigo_publico')
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

  // Fallback: tenta por id (comportamento antigo). A função cardapio_loja também aceita o id.
  if (!/^[0-9a-f-]{36}$/i.test(slug)) return EMPTY_RESULT
  const profile = await perfilDaLoja(slug, 'id')
  if (!profile) return EMPTY_RESULT

  return fetchByUserId(profile.id, profile)
}

async function fetchByUserId(userId: string, profile: any): Promise<CardapioData> {
  // (17/10) Produtos e categorias pelas funções do banco (SQL cardapio_produtos): o cliente sem login
  // não conseguia ler as tabelas direto e o cardápio aparecia vazio. As funções também não entregam
  // os campos internos da ficha técnica (custo, salário desejado…). Sem o SQL rodado, lê como antes.
  const [rProd, rCat, { data: temCupom }] = await Promise.all([
    supabase.rpc('cardapio_produtos', { p_loja: userId }),
    supabase.rpc('cardapio_categorias', { p_loja: userId }),
    // Só sim/não — os códigos dos cupons não vêm mais pro navegador do cliente
    supabase.rpc('cardapio_tem_cupom', { p_loja: userId }),
  ])
  let produtos: any[] | null = Array.isArray(rProd.data) ? rProd.data : null
  if (rProd.error && funcaoFaltando(rProd.error)) {
    const { data } = await supabase.from('produtos').select('*').eq('user_id', userId).eq('disponivel', true).order('created_at', { ascending: false })
    produtos = data
  }
  let categorias: any[] | null = Array.isArray(rCat.data) ? rCat.data : null
  if (rCat.error && funcaoFaltando(rCat.error)) {
    const { data } = await supabase.from('categorias').select('nome, imagem_url').eq('user_id', userId).order('ordem').order('nome')
    categorias = data
  }

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

  // (18/10) Três cores, todas no topo: borda da logo, nome e faixa do topo (grátis: as prontas; PRO: qualquer uma).
  // Botões e ícones ficam sempre no rosa do Doonly.
  // (18/10) tema de Natal: usa as cores dele no topo
  const tema = temaAtivo(profile)
  const borda = tema === 'natal' ? NATAL.borda : corDoItem('cor_borda', profile.cor_borda, isPro)
  const nome = tema === 'natal' ? NATAL.nome : corDoItem('cor_nome', profile.cor_nome, isPro)
  const topo = tema === 'natal' ? NATAL.topo : corDoItem('cor_navbar', profile.cor_navbar, isPro)

  const design: DesignSettings = {
    user_id: userId,
    nome_loja: profile.nome_loja || 'Minha Confeitaria',
    descricao_loja: profile.descricao_loja || '',
    logo_url: fotoDaLoja(profile), // (18/10) a logo da loja; foto pessoal (Google) nunca aparece no cardápio
    banner_url: profile.banner_url || '',
    banner1_url: profile.banner1_url || '',
    banner2_url: profile.banner2_url || '',
    banner3_url: profile.banner3_url || '',
    banner_topo_url: profile.banner_topo_url || '',
    cor_borda: borda,
    cor_background: '#fef2f2', // fundo fixo (padrão)
    cor_nome: nome,
    banner_gradient: profile.banner_gradient || '',
    // Estrelas de avaliação removidas (02/10): ficavam deslocadas ao lado do selo de verificado
    hide_stars: true,
    cor_botao: COR_BOTOES,
    cor_navbar: topo,
    cor_sacola: COR_BOTOES,
    cor_rodape: COR_BOTOES,
    ocultar_categorias: profile.ocultar_categorias || false,
    tema,
    tema_aviso: tema === 'natal' ? String(profile.tema_aviso ?? AVISO_NATAL_PADRAO).trim() : '',
    tema_capa_url: tema === 'natal' ? (profile.tema_capa_url || CAPA_NATAL_PADRAO) : '',
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
    cupons_desconto: [],
    // Cupons são recurso PRO: loja grátis não mostra o campo de cupom no cardápio
    tem_cupom: isPro && (temCupom === true || (Array.isArray(profile.cupons_desconto) && profile.cupons_desconto.some((c: any) => c?.ativo))),
    aceita_agendamento: profile.aceita_agendamento !== false,
    prazo_minimo_horas: profile.prazo_minimo_horas ?? 24,
    msg_pedido: profile.mensagens_whatsapp?.pedido_cardapio || null,
    instagram: profile.instagram || null,
    loja_pausada: profile.loja_pausada === true,
    facebook: profile.facebook || null,
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
    cardapioModelo: profile.cardapio_modelo || 'modelo1',
  }
}

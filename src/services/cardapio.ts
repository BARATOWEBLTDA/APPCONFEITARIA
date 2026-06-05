import { supabase } from '@/lib/supabase'
import { Produto, DesignSettings, Configuracoes } from '@/types/database'

export async function getCardapioBySlug(slug: string): Promise<{
  design: DesignSettings | null
  config: Configuracoes | null
  produtos: Produto[]
  isPro: boolean
  categoryImages: { [key: string]: string }
  categoriasList: string[]
}> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', slug)
    .single()

  if (!profile) return { design: null, config: null, produtos: [], isPro: false, categoryImages: {}, categoriasList: [] }

  return fetchByUserId(profile.id, profile)
}

async function fetchByUserId(userId: string, profile: any) {
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
  }

  const config: Configuracoes = {
    user_id: userId,
    telefone: profile.telefone || '',
    avaliacao_media: profile.avaliacao_media || 4.9,
    endereco: profile.endereco || null,
    mostrar_localizacao: profile.mostrar_localizacao || false,
    mostrar_apenas_cidade: profile.mostrar_apenas_cidade || false,
    horario: profile.horario || null,
  }

  return { design, config, produtos: produtos || [], isPro, categoryImages, categoriasList }
}

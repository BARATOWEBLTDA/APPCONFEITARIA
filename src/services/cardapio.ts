import { supabase } from '@/lib/supabase'
import { Produto, DesignSettings, Configuracoes } from '@/types/database'

export async function getCardapioBySlug(slug: string): Promise<{
  design: DesignSettings | null
  config: Configuracoes | null
  produtos: Produto[]
}> {
  // Busca o perfil pelo slug (nome_loja normalizado ou id)
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .ilike('slug', slug)
    .single()

  if (!profile) {
    // Tenta buscar por id direto
    const { data: profileById } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', slug)
      .single()

    if (!profileById) return { design: null, config: null, produtos: [] }

    return fetchByUserId(profileById.id, profileById)
  }

  return fetchByUserId(profile.id, profile)
}

async function fetchByUserId(userId: string, profile: any) {
  const { data: produtos } = await supabase
    .from('produtos')
    .select('*')
    .eq('user_id', userId)
    .eq('disponivel', true)
    .order('created_at', { ascending: false })

  const design: DesignSettings = {
    user_id: userId,
    nome_loja: profile.nome_loja || 'Minha Confeitaria',
    descricao_loja: profile.descricao_loja || '',
    logo_url: profile.foto_url || '',
    cor_borda: profile.cor_borda || '#ec4899',
    cor_background: profile.cor_background || '#fef2f2',
    cor_nome: profile.cor_nome || '#1f2937',
    banner_gradient: profile.banner_gradient || 'linear-gradient(135deg, #d11b70 0%, #ff6fae 50%, #ff9acb 100%)',
    hide_stars: profile.hide_stars || false,
  }

  const config: Configuracoes = {
    user_id: userId,
    telefone: profile.telefone || '',
    avaliacao_media: profile.avaliacao_media || 4.9,
  }

  return { design, config, produtos: produtos || [] }
}

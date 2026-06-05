export interface Produto {
  id: string
  user_id: string
  nome: string
  descricao: string
  preco_normal: number
  preco_promocional?: number
  imagem_url?: string
  categoria: string
  disponivel: boolean
  promocao: boolean
  forma_venda: 'unidade' | 'fatia' | 'kg' | 'cento' | 'tamanho-p' | 'tamanho-m' | 'tamanho-g' | 'tamanho-xg' | 'tamanho' | 'caixa' | 'kit-festa' | 'kit-caixa' | 'sob-encomenda' | 'outros' | string
  permite_personalizacao?: boolean
  massas_disponiveis?: string[]
  recheios_disponiveis?: string[]
  coberturas_disponiveis?: string[]
  estoque_quantidade?: number
  created_at?: string
  updated_at?: string
}

export interface DesignSettings {
  id?: string
  user_id?: string
  codigo?: string
  nome_loja?: string
  descricao_loja?: string
  logo_url?: string
  banner_url?: string
  cor_borda?: string
  cor_background?: string
  cor_nome?: string
  cor_botao?: string
  ocultar_categorias?: boolean
  banner_gradient?: string
  banner1_url?: string
  banner2_url?: string
  banner3_url?: string
  texto_rodape?: string
  hide_stars?: boolean
  category_icons?: { [key: string]: string }
}

export interface Configuracoes {
  id?: string
  user_id?: string
  telefone?: string
  avaliacao_media?: number
  horario_abertura?: string
  horario_fechamento?: string
  dias_funcionamento?: string[]
  abre_sabado?: boolean
  abre_domingo?: boolean
  horario_sabado_abre?: string
  horario_sabado_fecha?: string
  horario_domingo_abre?: string
  horario_domingo_fecha?: string
  endereco?: string | null
  mostrar_localizacao?: boolean
  mostrar_apenas_cidade?: boolean
  horario?: string | null
}
